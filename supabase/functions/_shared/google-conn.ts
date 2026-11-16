// _shared/google-conn.ts — server-side Google connection store (F7 / F15).
// Used ONLY by edge functions that hold the service-role key (connectors, workspace-actions).
// Never import this from gateway-chat: the gateway never sees Google tokens, it calls `connectors`/`workspace-actions` with the user's JWT.
//
// Storage: public.user_connection_tokens (user_id, provider='google', encrypted_token jsonb). The table is service-role only
// (authenticated/anon hold no grants — BUG-055). encrypted_token = {v:1, k:"env"|"svc", iv:<b64 12B>, ct:<b64 AES-256-GCM>} where the
// plaintext JSON is {access_token, refresh_token, expires_at(ms), scopes[], email, connected_at}.
// Key: CONNECTOR_TOKEN_KEY (base64, 32 bytes) when set (k:"env"); otherwise derived from the service-role key (k:"svc") so the
// feature works before the dedicated secret is provisioned. Tokens are never logged and never returned to a client.
export type Env = (k: string) => string | undefined;
export interface Cfg { sbUrl: string; svc: string; env: Env }
export interface Tokens { access_token?: string; refresh_token?: string; expires_at?: number; scopes: string[]; email?: string; connected_at?: string }

export const PROVIDER = "google";
/** Provider rows share the table; non-Google providers (slack, github, dropbox, render, supabase) pass their id. */
const provOk = (p: string) => /^[a-z]{3,20}$/.test(p);
export const SCOPE = {
  gmailRead: "https://www.googleapis.com/auth/gmail.readonly",
  gmailSend: "https://www.googleapis.com/auth/gmail.send",
  calendarEvents: "https://www.googleapis.com/auth/calendar.events",
  driveRead: "https://www.googleapis.com/auth/drive.readonly",
  sheetsRead: "https://www.googleapis.com/auth/spreadsheets.readonly",
};
/** Scopes that satisfy each capability (a broader scope the user previously granted also counts). */
export const SATISFIES: Record<string, string[]> = {
  gmail_read: [SCOPE.gmailRead, "https://www.googleapis.com/auth/gmail.modify", "https://mail.google.com/"],
  gmail_send: [SCOPE.gmailSend, "https://www.googleapis.com/auth/gmail.compose", "https://www.googleapis.com/auth/gmail.modify", "https://mail.google.com/"],
  calendar: [SCOPE.calendarEvents, "https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.readonly"],
};
SATISFIES.drive = [SCOPE.driveRead, "https://www.googleapis.com/auth/drive"];
SATISFIES.sheets = [SCOPE.sheetsRead, "https://www.googleapis.com/auth/spreadsheets", SCOPE.driveRead, "https://www.googleapis.com/auth/drive"];
export const hasCapability = (scopes: string[], cap: keyof typeof SATISFIES) => SATISFIES[cap].some((s) => scopes.includes(s));

const enc = new TextEncoder();
const toB64 = (u: Uint8Array) => { let s = ""; for (const b of u) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFor(kind: string, cfg: Cfg, usage: KeyUsage[]): Promise<CryptoKey> {
  let raw: Uint8Array;
  if (kind === "env") {
    const k = cfg.env("CONNECTOR_TOKEN_KEY");
    if (!k) throw new Error("connector decryption key not configured");
    raw = fromB64(k);
    if (raw.length !== 32) throw new Error("CONNECTOR_TOKEN_KEY must be 32 bytes (base64)");
  } else {
    if (!cfg.svc) throw new Error("no key material available");
    const h = await crypto.subtle.importKey("raw", enc.encode(cfg.svc), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    raw = new Uint8Array(await crypto.subtle.sign("HMAC", h, enc.encode("connector-tokens-v1")));
  }
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, usage);
}
export const keySource = (cfg: Cfg): "env" | "svc" => (cfg.env("CONNECTOR_TOKEN_KEY") ? "env" : "svc");

export async function encryptTokens(t: Tokens, cfg: Cfg): Promise<Record<string, unknown>> {
  const k = keySource(cfg);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(k, cfg, ["encrypt"]), enc.encode(JSON.stringify(t))));
  return { v: 1, k, iv: toB64(iv), ct: toB64(ct) };
}
export async function decryptTokens(blob: any, cfg: Cfg): Promise<Tokens> {
  if (blob && blob.ct && blob.iv) {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) }, await keyFor(blob.k === "env" ? "env" : "svc", cfg, ["decrypt"]), fromB64(blob.ct));
    const t = JSON.parse(new TextDecoder().decode(pt));
    return { ...t, scopes: Array.isArray(t.scopes) ? t.scopes : [] };
  }
  // Legacy plaintext rows are rejected unless explicitly allowed (migration aid only).
  if (blob && (blob.access_token || blob.refresh_token) && cfg.env("ALLOW_PLAINTEXT_CONNECTOR_TOKENS") === "1") {
    const sc = Array.isArray(blob.scopes) ? blob.scopes : typeof blob.scope === "string" ? blob.scope.split(/[\s,]+/).filter(Boolean) : [];
    const e = blob.expires_at; const ms = typeof e === "number" ? (e < 1e12 ? e * 1000 : e) : e ? Date.parse(String(e)) : undefined;
    return { access_token: blob.access_token, refresh_token: blob.refresh_token, expires_at: ms, scopes: sc };
  }
  throw new Error("stored connection token is not in a supported format");
}

const rest = (cfg: Cfg, path: string, init: RequestInit = {}) =>
  fetch(`${cfg.sbUrl}/rest/v1/${path}`, { ...init, headers: { apikey: cfg.svc, Authorization: `Bearer ${cfg.svc}`, "Content-Type": "application/json", ...(init.headers || {}) }, signal: AbortSignal.timeout(10_000) });
const uidOk = (uid: string) => /^[0-9a-f-]{36}$/i.test(uid);

/** Loads ONLY the given user's row. uid must come from a verified JWT. */
export async function loadConnection(uid: string, cfg: Cfg, provider: string = PROVIDER): Promise<Tokens | null> {
  if (!uidOk(uid) || !provOk(provider)) throw new Error("invalid user id");
  if (!cfg.svc) throw new Error("service role key not available on this function");
  const r = await rest(cfg, `user_connection_tokens?select=encrypted_token&user_id=eq.${uid}&provider=eq.${provider}&order=updated_at.desc&limit=1`);
  if (!r.ok) throw new Error(`connection lookup failed (HTTP ${r.status})`);
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return await decryptTokens(rows[0].encrypted_token, cfg);
}
export async function saveConnection(uid: string, t: Tokens, cfg: Cfg, provider: string = PROVIDER): Promise<void> {
  if (!uidOk(uid) || !provOk(provider)) throw new Error("invalid user id");
  const blob = await encryptTokens(t, cfg);
  const q = `user_id=eq.${uid}&provider=eq.${provider}`;
  const ex = await rest(cfg, `user_connection_tokens?select=id&${q}`);
  if (!ex.ok) throw new Error(`connection save failed (HTTP ${ex.status})`);
  const rows = await ex.json();
  const res = rows.length
    ? await rest(cfg, `user_connection_tokens?${q}`, { method: "PATCH", body: JSON.stringify({ encrypted_token: blob, updated_at: new Date().toISOString() }), headers: { Prefer: "return=minimal" } })
    : await rest(cfg, "user_connection_tokens", { method: "POST", body: JSON.stringify({ user_id: uid, provider, encrypted_token: blob }), headers: { Prefer: "return=minimal" } });
  if (!res.ok) throw new Error(`connection save failed (HTTP ${res.status})`);
}
export async function deleteConnection(uid: string, cfg: Cfg, provider: string = PROVIDER): Promise<void> {
  if (!uidOk(uid) || !provOk(provider)) throw new Error("invalid user id");
  const r = await rest(cfg, `user_connection_tokens?user_id=eq.${uid}&provider=eq.${provider}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!r.ok) throw new Error(`disconnect failed (HTTP ${r.status})`);
}

export class ConnError extends Error { constructor(public code: "not_connected" | "missing_scope" | "expired" | "misconfigured", msg: string) { super(msg); } }

/** Returns a usable access token, refreshing (and re-persisting, encrypted) when it is within 60s of expiry. */
export async function getAccessToken(uid: string, t: Tokens, cfg: Cfg): Promise<string> {
  if (t.access_token && (t.expires_at ?? 0) - Date.now() > 60_000) return t.access_token;
  if (!t.refresh_token) throw new ConnError("expired", "Google connection expired; ask the user to reconnect Google in Settings > Connectors.");
  const id = cfg.env("GOOGLE_CLIENT_ID"), secret = cfg.env("GOOGLE_CLIENT_SECRET");
  if (!id || !secret) throw new ConnError("misconfigured", "Google client credentials are not configured on the server.");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: id, client_secret: secret }), signal: AbortSignal.timeout(10_000) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new ConnError("expired", `Google token refresh failed (${String(j?.error ?? r.status).slice(0, 40)}); ask the user to reconnect Google.`);
  const next: Tokens = { ...t, access_token: j.access_token, expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  try { await saveConnection(uid, next, cfg); } catch { /* non-fatal: next call refreshes again */ }
  return j.access_token;
}
