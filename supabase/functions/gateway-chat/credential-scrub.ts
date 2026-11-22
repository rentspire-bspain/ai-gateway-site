// credential-scrub.ts — shared output guard (cycle 2, gap 2). Pure Deno/Web; no imports.
// Both output paths call scrubCredentials(): the streaming path (after the stream ends, delivered as a {"revision": ...} event)
// and the non-streaming path (before citations/Sources are appended). Scrubs code fences too: a fence authored in response to
// "show me your config" is still a leak. When anything was redacted, REDACTION_NOTICE is appended so the user is told.
//
// Design: false positives cost a placeholder; false negatives leak a secret. But ordinary prose must survive, so:
//  - URLs (https://...) are protected from the long-run rule (slugs, hashes in paths) and are only touched by keyed rules,
//    and never when the URL is in `allowUrls` (known citation sources).
//  - obvious placeholders (your_key_here, <token>, ${VAR}, xxxx, ****, example) are left alone.
//  - a 40/64-hex run next to the words commit/sha/hash/checksum/digest/md5 is treated as an identifier, not a secret.

export const REDACTED = "[redacted credential]";
export const REDACTION_NOTICE = "\n\n> Note: credential-like values (connection strings, keys or tokens) were redacted from this answer.";

export interface ScrubResult { text: string; count: number; kinds: string[]; changed: boolean }
export interface ScrubOptions { allowUrls?: string[]; appendNotice?: boolean; knownSecrets?: string[] }

const PLACEHOLDER = /^(?:<[^>]*>|\[[^\]]*\]|\{\{?[^}]*\}\}?|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|%[A-Za-z_]+%|\.{2,}|…|[xX*•#_.-]{3,}|(?:your|my|the|some|example|sample|dummy|fake|test|placeholder|changeme|redacted|insert|replace|enter)[-_ a-z0-9]*|(?:password|passwd|pwd|pass|secret|token|apikey|api_key|key|user|username|dbname|host|hostname|localhost|database)|[a-z_]*(?:here|placeholder)[a-z_]*)$/i;
const isPlaceholder = (v: string): boolean => PLACEHOLDER.test(String(v).replace(/^["'`]+|["'`,;)]+$/g, "").trim());

const SCHEMES = "postgres(?:ql)?|mysql|mariadb|mongodb(?:\\+srv)?|redis|rediss|amqps?|mssql|sqlserver|cockroachdb|clickhouse|couchdb|jdbc:[a-z]+";

// ---- shared pattern tables (used by both the shape-based scrub and the input harvest) ----
const VENDOR_SHAPES: Array<[string, RegExp]> = [
  ["jwt", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ["vendor_key", /\b(?:sk|pk|rk)[-_](?:live|test|proj|ant|or|prod)?[-_]?[A-Za-z0-9_-]{20,}\b/g],
  ["vendor_key", /\b(?:pplx|gsk|xai|hf|sbp|sb_secret|sb_publishable)[-_][A-Za-z0-9_-]{16,}\b/g],
  ["vendor_key", /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/g],
  ["vendor_key", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g],
  ["vendor_key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["vendor_key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
];
const KEYED_RE = /(\b[A-Za-z][A-Za-z0-9_.-]*?(?:SK|KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|PASS|_sk|_key|_secret|_token|_password|_pass)|\b(?:token|apikey|api_key|access_token|auth_token|secret|password|passwd|pwd|pass|sig|signature))(["']?\s*(?:[=:]|\bis\b|\bwas\b)\s*)(["'`]?)([^\s"'`,;&<>)\]}]{6,})/gi;
const isProseSep = (sep: string): boolean => /\b(?:is|was)\b/i.test(sep);
const looksSecretValue = (val: string): boolean => {
  if (!val || val === REDACTED || val.startsWith("[redacted")) return false;
  if (isPlaceholder(val)) return false;
  if (/^(?:true|false|null|none|undefined|string|number|required|optional|bearer)$/i.test(val)) return false;
  // a plain word after "key:" / "password is" in prose is not a secret: require a digit, a symbol, or 20+ chars
  return /[0-9_\-+/=.!@#$%^&*~]/.test(val) || val.length >= 20;
};

/** HARVEST FROM INPUT (cycle 3): pull candidate secret VALUES out of the conversation (the user's and earlier assistant messages), so the
 *  output scrub can redact those exact strings anywhere they reappear — prose, backticks, code fences — even when they match no shape.
 *  Sources: passwords inside connection strings; values after KEY=/TOKEN=/SECRET=/PASSWORD=/PASS=/"password is"; vendor-shaped keys; Bearer
 *  tokens; random-looking 40+ char runs. Placeholders and plain words are never harvested. Returns de-duplicated values, longest first. */
export function harvestSecrets(texts: string[]): string[] {
  const out = new Set<string>();
  const add = (v: string) => {
    let t = String(v || "").replace(/^["'`]+/, "");
    t = t.replace(/["'`]+$/, "");
    if (t.length < 6 || t.length > 512 || !looksSecretValue(t)) return;
    out.add(t);
    const trimmed = t.replace(/[.!?:]+$/, "");           // "password is Hunter2." -> also Hunter2
    if (trimmed !== t && trimmed.length >= 6 && looksSecretValue(trimmed)) out.add(trimmed);
    try { const d = decodeURIComponent(t); if (d !== t && d.length >= 6) out.add(d); } catch { /* not percent-encoded */ }
    if (/[^A-Za-z0-9\-._~]/.test(t)) { try { const e = encodeURIComponent(t); if (e !== t) out.add(e); } catch { /* ignore */ } }
  };
  for (const raw of texts) {
    const text = String(raw ?? "");
    if (!text || text.length > 200_000) continue;
    // connection-string passwords
    for (const m of text.matchAll(new RegExp(`\\b(?:${SCHEMES}):\\/\\/([^\\s'"\`<>]+)`, "gi"))) {
      const rest = m[1], at = rest.lastIndexOf("@");
      if (at <= 0) continue;
      const ui = rest.slice(0, at), c = ui.indexOf(":");
      if (c < 0) continue;
      const pw = ui.slice(c + 1);
      if (!isPlaceholder(pw)) add(pw);
    }
    for (const [, re] of VENDOR_SHAPES) for (const m of text.matchAll(new RegExp(re.source, "g"))) add(m[0]);
    for (const m of text.matchAll(/\bBearer\s+([A-Za-z0-9._~+/=-]{16,})/g)) add(m[1]);
    for (const m of text.matchAll(new RegExp(KEYED_RE.source, "gi"))) { if (isProseSep(m[2]) && !/(?:password|passwd|pwd)$/i.test(m[1])) continue; add(m[4]); }
    for (const m of text.matchAll(/(?<![A-Za-z0-9+/=_-])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/=_-])/g)) {
      const r = m[0];
      if (/\d/.test(r) && /[a-z]/.test(r) && /[A-Z]/.test(r) || /^[0-9a-f]{40,}$/i.test(r) && /\d/.test(r) && /[a-f]/i.test(r)) {
        if (!/^[0-9a-f]{40}$/i.test(r) || !/commit|sha|hash|checksum|digest/i.test(text.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + r.length + 20))) add(r);
      }
    }
  }
  return [...out].sort((a, b) => b.length - a.length).slice(0, 200);
}

const escRe = (x: string): string => x.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&");

export function scrubCredentials(input: string, opts: ScrubOptions = {}): ScrubResult {
  let text = String(input ?? "");
  const kinds = new Set<string>();
  let count = 0;
  const hit = (kind: string) => { kinds.add(kind); count++; return REDACTED; };
  if (!text) return { text, count: 0, kinds: [], changed: false };
  const allow = new Set((opts.allowUrls || []).map((u) => String(u)));
  const allowed = (u: string) => allow.has(u) || allow.has(u.replace(/[).,;]+$/, ""));

  // 0. Echo of a secret the USER supplied (harvestSecrets): exact-string redaction wherever it appears — prose, backticks, code fences.
  //    Longest first so a password is not half-eaten by a shorter substring. Edges must not be alphanumeric, so a short harvested value
  //    cannot corrupt an ordinary word that merely contains it.
  if (opts.knownSecrets?.length) {
    for (const sec of [...opts.knownSecrets].sort((a, b) => b.length - a.length)) {
      if (!sec || sec.length < 6) continue;
      const re = new RegExp(`(?<![A-Za-z0-9])${escRe(sec)}(?![A-Za-z0-9])`, "g");
      text = text.replace(re, () => hit("echoed_secret"));
    }
  }

  // 1. Connection strings: scheme://user:password@host... (credential in userinfo). Credential-less URIs (postgres://localhost/db)
  //    and placeholder passwords (user:password@, user:<pw>@, user:${PW}@) are examples, not leaks.
  text = text.replace(new RegExp(`\\b(?:${SCHEMES}):\\/\\/([^\\s'"\`<>]+)`, "gi"), (m, rest: string) => {
    const at = rest.lastIndexOf("@");
    if (at <= 0) {
      // no userinfo: still a secret if the query string carries one (?password=..., ?sslpassword=...)
      return /[?&;](?:pass(?:word)?|pwd|secret|token|apikey|api_key|sslpassword)=[^&\s]{4,}/i.test(rest) ? hit("conn_string") : m;
    }
    const userinfo = rest.slice(0, at);
    const colon = userinfo.indexOf(":");
    if (colon < 0) return m;                         // user only, no password
    const pw = userinfo.slice(colon + 1);
    return isPlaceholder(pw) ? m : hit("conn_string");
  });

  // 2. Well-known token shapes (vendor prefixes), anywhere including code fences.
  const SHAPES: Array<[string, RegExp]> = [...VENDOR_SHAPES, ["private_key", /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g]];
  for (const [k, re] of SHAPES) text = text.replace(re, () => hit(k));

  // 3. Authorization: Bearer <token>
  text = text.replace(/\b(Bearer)\s+([A-Za-z0-9._~+/=-]{16,})/g, (m, b: string, tok: string) => (isPlaceholder(tok) || tok === REDACTED ? m : `${b} ${hit("bearer")}`));

  // 4. KEY=value / SK=value / token=value / password: value (env-style and query-style). Keeps the name, redacts the value.
  //    Names: anything ending in SK|KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD, or a bare token/apikey/api_key/access_token/secret/password.
  text = text.replace(
    new RegExp(KEYED_RE.source, "gi"),
    (m, name: string, sep: string, q: string, val: string, offset: number, whole: string) => {
      if (!looksSecretValue(val)) return m;
      // prose "is/was" separators are only trusted for password names (avoid "the token is valid-for-24h" style prose)
      if (isProseSep(sep) && !/(?:password|passwd|pwd)$/i.test(name)) return m;
      // inside a known citation URL: leave alone
      const urlStart = whole.lastIndexOf("http", offset);
      if (urlStart >= 0 && !/\s/.test(whole.slice(urlStart, offset))) {
        const urlEnd = whole.slice(urlStart).search(/[\s)\]>"']/);
        const url = whole.slice(urlStart, urlEnd < 0 ? undefined : urlStart + urlEnd);
        if (allowed(url)) return m;
      }
      return `${name}${sep}${q}${hit("keyed")}`;
    },
  );

  // 5. Long base64 / hex runs (40+ chars), outside URLs. Must look random: mixed classes, not an identifier next to "commit/sha".
  const parts = text.split(/(https?:\/\/[^\s)\]>"']+)/g);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(/(?<![A-Za-z0-9+/=_-])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/=_-])/g, (run: string, off: number, whole: string) => {
      const hasDigit = /\d/.test(run), hasLower = /[a-z]/.test(run), hasUpper = /[A-Z]/.test(run);
      const classes = Number(hasDigit) + Number(hasLower) + Number(hasUpper);
      if (!hasDigit || classes < 2) return run;                       // plain words / long identifiers
      if (/^[0-9a-f]+$/i.test(run) && (run.length === 40 || run.length === 64 || run.length === 32)) {
        const ctx = whole.slice(Math.max(0, off - 60), off + run.length + 20).toLowerCase();
        if (/commit|sha-?\d*|hash|checksum|digest|md5|revision|rev\b|tag|git /.test(ctx)) return run;
      }
      if (/^[a-z]+(?:[A-Z][a-z]+){5,}$/.test(run)) return run;        // CamelCaseIdentifierInLongNames
      return hit("long_secret");
    });
  }
  text = parts.join("");

  const changed = count > 0;
  if (changed && opts.appendNotice !== false && !text.includes(REDACTION_NOTICE.trim())) text = text.replace(/\s+$/, "") + REDACTION_NOTICE;
  return { text, count, kinds: [...kinds], changed };
}
