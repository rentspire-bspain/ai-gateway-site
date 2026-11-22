// citations.ts — citation accuracy helpers for gateway-chat (pure Deno/Web, no imports). v128.
// Sibling of progress.ts / plan-guidance.ts. Everything here is deterministic and unit-tested (citations.test.ts).
//
// Why this exists (QA 2026-11-10):
//  1. [N] markers cited the wrong outlet ("Per Washington Post, NYT, ABC" -> bbc.com). The writer model only saw bare titles
//     in the numbered list, so outlet names in prose were guesses. buildSourceIndex() gives ONE canonical numbered list and
//     alignOutlets() re-binds a marker whose host contradicts the outlet named in its own sentence.
//  2. Junk hosts (www-ta-awsma.nytimes.com — a tracking/canary host) leaked into chips + tooltips. normalizeSourceUrl()
//     rewrites them to the real publisher host (or drops the result when it is not a real page host).
//  3. Source cards vs "N sources" disagreed. canonicalSourceItems() is the one list the phases / SSE / x_sources all carry.
//  4. Images tab junk (favicons, logos, duplicates, off-topic cards). cleanImages().

export interface RawCite { title: string; url: string; id: number; snip?: string }
export interface SourceItem { n: number; title: string; url: string; domain: string }

// ---------- hosts / urls ----------
const TWO_PART_SLD = new Set(["co", "com", "org", "net", "gov", "edu", "ac", "or", "ne", "go"]);
const BLOCKED_HOST = /(^|\.)(doubleclick\.net|googleadservices\.com|googlesyndication\.com|adservice\.google\.[a-z.]+|adsrvr\.org|scorecardresearch\.com|taboola\.com|outbrain\.com|criteo\.com|facebook\.com\/tr)$/i;
const JUNK_TLD = /\.(local|localhost|internal|invalid|test|example|lan|corp|home|intranet)$/i;
// a first label that is a tracking / canary / staging fingerprint rather than a real publisher subdomain
const JUNK_LABEL_A = /^www\d*-[a-z0-9-]+$/i;                                   // www-ta-awsma, www2-origin
const JUNK_LABEL_C = /^(?:canary|staging|stage|stg|preprod|uat)$/i;              // whole-label staging fingerprints
const JUNK_TOKENS = new Set(["ta", "stg", "stage", "staging", "qa", "uat", "dev", "test", "canary", "preprod", "origin", "edge"]); // only counted inside a hyphenated label (dev.mysql.com stays)

export function hostOf(u: string): string {
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}
function registrable(host: string): string {
  const p = host.split(".");
  if (p.length <= 2) return host;
  const tld = p[p.length - 1], sld = p[p.length - 2];
  return tld.length === 2 && TWO_PART_SLD.has(sld) ? p.slice(-3).join(".") : p.slice(-2).join(".");
}
// ---------- v279 SOURCE-QUALITY FILTER (math rows) ----------
// The v278 math teardown (AIME 46.7 / MATH-500 76.0): the dominant remaining miss is RETRIEVAL
// QUALITY — the search lane returned dataset-viewer pages (Hugging Face dataset viewers, Kaggle
// dataset listings) as "sources"; the writer wandered down a tangent discussing dataset
// internals and never concluded. These URL classes are dataset catalogs/viewers — structured
// data listings, never worked math evidence. Scoped to MATH-INTENT rows only (isMathQuery in
// index.ts); on every other row the filter never fires (monotonicity: zero change off-scope).
const LOW_QUALITY_SOURCE_URL =
  /huggingface\.co\/datasets\/[^\s]*\/(viewer|tree|blob)\b/i;   // HF dataset viewers/trees/blobs
const LOW_QUALITY_SOURCE_URL2 =
  /^https?:\/\/(www\.)?(kaggle\.com\/datasets|huggingface\.co\/datasets|paperswithcode\.com\/dataset|tensorflow\.org\/datasets|archive\.ics\.uci\.edu)\/?\b/i; // dataset catalog roots/listings
const LOW_QUALITY_URL_PATH = /\/(dataset|datasets)\/?(viewer|list|browse|catalog)?\/?$/i; // bare dataset browsing paths
/** True when a search-result URL is a dataset catalog/viewer page — a data listing, not an evidence page. */
export function isLowQualitySourceUrl(url: string): boolean {
  const u = String(url || "");
  if (!u) return true;
  if (LOW_QUALITY_SOURCE_URL.test(u)) return true;
  try {
    const x = new URL(u);
    const p = x.pathname.toLowerCase();
    if (LOW_QUALITY_SOURCE_URL2.test(u)) return true;
    if (LOW_QUALITY_URL_PATH.test(p)) return true;
  } catch { /* not a URL — let the existing junk filters handle it */ }
  return false;
}

export function isJunkHost(host: string): boolean {
  const h = String(host || "").toLowerCase();
  if (!h || !h.includes(".")) return true;                       // localhost, bare names
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return true; // IP literals
  if (JUNK_TLD.test(h) || BLOCKED_HOST.test(h)) return true;
  return false;
}
export function junkSubdomain(host: string): boolean {
  const labels = String(host || "").toLowerCase().split(".");
  if (labels.length < 3) return false;                           // example.com has no subdomain to be junk
  const first = labels[0];
  return JUNK_LABEL_A.test(first) || JUNK_LABEL_C.test(first) || (first.includes("-") && first.split("-").some((t) => JUNK_TOKENS.has(t)));
}
const TRACKING_PARAM = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|yclid|_ga|ref_src|ocid|cmpid|taid|guccounter)$/i;

/** Normalize a search-result URL: junk canary/staging host -> real publisher host, tracking params + fragment stripped.
 *  Returns null when the URL is not a real http(s) page host (IP literal, localhost, ad/tracker domain). */
export function normalizeSourceUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(String(raw || "").trim()); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  let host = u.hostname.toLowerCase();
  if (isJunkHost(host)) return null;
  if (junkSubdomain(host)) {
    const reg = registrable(host);
    host = /^www/i.test(host.split(".")[0]) ? "www." + reg : reg;
    if (isJunkHost(host)) return null;
  }
  u.hostname = host;
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAM.test(k)) u.searchParams.delete(k);
  return u.toString();
}
/** Dedupe key: scheme/www/trailing-slash/fragment-insensitive. */
export function urlKey(u: string): string {
  try {
    const x = new URL(u);
    return x.hostname.toLowerCase().replace(/^www\./, "") + x.pathname.replace(/\/+$/, "") + x.search;
  } catch { return String(u || ""); }
}

// ---------- titles ----------
const JUNK_TITLE = /^(untitled|home|homepage|index|just a moment\.*|attention required!?.*|access denied|forbidden|403|404|page not found|not found|error|loading\.*|redirect(?:ing)?\.*|document|download|log ?in|sign ?in|web source|search results?|null|undefined)$/i;
/** True when a search-result title is sludge ("rust vs go", "article316900069", "404") rather than a real headline. */
export function looksLikeSludgeTitle(title: string, url = ""): boolean {
  const t = String(title ?? "").replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (JUNK_TITLE.test(t)) return true;
  if (/^https?:\/\//i.test(t) || /^\[?\d+\]?$/.test(t)) return true;
  const words = t.split(" ");
  const digits = (t.match(/\d/g) || []).length;
  if (words.length === 1) {
    if (t.length <= 3) return true;
    if (digits / t.length >= 0.4) return true;                  // article316900069, 20261110
    if (/^[a-z_-]+\d{4,}$/i.test(t)) return true;               // news-12345
    if (/^[a-z0-9_-]+$/.test(t) && /[-_]/.test(t)) return true; // raw slug: some-page-name
    if (/^[a-z0-9.-]+\.(com|org|net|io|co|gov|edu)$/i.test(t)) return true; // a bare domain adds nothing over the domain row
  }
  if (t === t.toLowerCase() && words.length <= 3 && t.length <= 16) return true; // lowercase query-fragment: "rust vs go"
  if (url) { const h = hostOf(url); if (h && t.toLowerCase() === h) return true; }
  return false;
}
export function cleanSourceTitle(title: string, url: string): string {
  const t = String(title ?? "").replace(/\s+/g, " ").trim();
  return looksLikeSludgeTitle(t, url) ? (hostOf(url) || "Web source") : t;
}

// ---------- canonical numbered source list ----------
/** Dedupe search results by normalized URL, number them (startAt = first marker number), and build the
 *  [web:N] id -> marker-number map. This is the ONLY place the mapping is computed, so the evidence slots, the numbered list
 *  the writer sees, the SSE phases and the final Sources list can never disagree. */
export function buildSourceIndex(cites: RawCite[], opts: { cap: number; startAt?: number }): {
  uniq: Array<{ title: string; url: string }>;
  urlNum: Map<string, number>;       // urlKey -> marker number
  idToNum: Map<number, number>;      // [web:N] id -> marker number
  numOfCite: (c: RawCite) => number | undefined;
  dropped: number;
} {
  const startAt = opts.startAt ?? 1;
  const uniq: Array<{ title: string; url: string }> = [];
  const urlNum = new Map<string, number>();
  let dropped = 0;
  const norm = cites.map((c) => ({ c, url: normalizeSourceUrl(c.url) }));
  for (const { c, url } of norm) {
    if (!url) { dropped++; continue; }
    const k = urlKey(url);
    if (!urlNum.has(k) && uniq.length < opts.cap) { uniq.push({ title: cleanSourceTitle(c.title, url), url }); urlNum.set(k, uniq.length - 1 + startAt); }
    else if (urlNum.has(k)) {
      // a later duplicate may carry the better title
      const e = uniq[urlNum.get(k)! - startAt];
      if (e && looksLikeSludgeTitle(e.title, e.url) && !looksLikeSludgeTitle(c.title, url)) e.title = String(c.title).trim();
    }
  }
  // [web:N] ids: unique 1-based ids are used as-is; colliding ids (each search call restarts at 1) or 0-based ids mean the
  // model's N is the 1-based POSITION in the concatenated results, so key by position.
  const seenIds = new Map<number, string>();
  let positional = false;
  for (const { c, url } of norm) {
    if (!url) continue;
    const k = urlKey(url);
    if (seenIds.has(c.id) && seenIds.get(c.id) !== k) positional = true;
    seenIds.set(c.id, k);
    if (c.id === 0) positional = true;
  }
  const idToNum = new Map<number, number>();
  cites.forEach((c, i) => {
    const url = norm[i].url; if (!url) return;
    const n = urlNum.get(urlKey(url));
    const key = positional ? i + 1 : c.id;
    if (n && !idToNum.has(key)) idToNum.set(key, n);
  });
  const numOfCite = (c: RawCite) => { const u = normalizeSourceUrl(c.url); return u ? urlNum.get(urlKey(u)) : undefined; };
  return { uniq, urlNum, idToNum, numOfCite, dropped };
}

/** Rewrite [web:1, web:3] -> [2][4] using idToNum; unmapped ids are dropped. Adjacent duplicates collapse. */
export function rewriteWebMarkers(text: string, idToNum: Map<number, number>): string {
  return text.replace(/\[((?:\s*web:\d+\s*,?)+)\]/g, (_m, grp: string) => {
    const nums = [...new Set([...grp.matchAll(/web:(\d+)/g)].map((mm) => idToNum.get(Number(mm[1]))).filter((n): n is number => !!n))];
    return nums.map((n) => `[${n}]`).join("");
  }).replace(/(\[\d+\])\1+/g, "$1");
}

/** The single canonical list carried by phases items, the `sources` SSE event and x_sources. n == the [N] marker number. */
export function canonicalSourceItems(findings: Array<{ title: string; url: string; extract?: string }>, max = 18): Array<SourceItem & { snippet?: string }> {
  const out: Array<SourceItem & { snippet?: string }> = [];
  findings.slice(0, max).forEach((f, i) => {
    const url = normalizeSourceUrl(f.url); if (!url) return;
    const it: SourceItem & { snippet?: string } = { n: i + 1, title: cleanSourceTitle(f.title, url), url, domain: hostOf(url) };
    if (f.extract && f.extract.length <= 700) { const s = f.extract.replace(/\s+/g, " ").trim().slice(0, 220); if (s) it.snippet = s; }
    out.push(it);
  });
  return out;
}

// ---------- outlet <-> marker alignment ----------
const OUTLETS: Array<{ id: string; name: RegExp; host: RegExp }> = [
  { id: "wapo", name: /\b(?:The )?Washington Post\b|\bWaPo\b/, host: /(^|\.)washingtonpost\.com$/ },
  { id: "nyt", name: /\b(?:The )?New York Times\b|\bNY Times\b|\bNYT\b/, host: /(^|\.)nytimes\.com$/ },
  { id: "abc", name: /\bABC News\b|\bABC\b/, host: /(^|\.)(abcnews\.go\.com|abc\.net\.au)$/ },
  { id: "bbc", name: /\bBBC(?: News)?\b/, host: /(^|\.)(bbc\.com|bbc\.co\.uk)$/ },
  { id: "cnn", name: /\bCNN\b/, host: /(^|\.)cnn\.com$/ },
  { id: "reuters", name: /\bReuters\b/, host: /(^|\.)reuters\.com$/ },
  { id: "ap", name: /\bAssociated Press\b|\bAP News\b|\bthe AP\b|\bAP\b/, host: /(^|\.)(apnews\.com|ap\.org)$/ },
  { id: "nbc", name: /\bNBC(?: News)?\b/, host: /(^|\.)(nbcnews\.com|nbcsports\.com|nbc\.com)$/ },
  { id: "cbs", name: /\bCBS(?: News)?\b/, host: /(^|\.)(cbsnews\.com|cbssports\.com)$/ },
  { id: "fox", name: /\bFox News\b/, host: /(^|\.)foxnews\.com$/ },
  { id: "wsj", name: /\bWall Street Journal\b|\bWSJ\b/, host: /(^|\.)wsj\.com$/ },
  { id: "bloomberg", name: /\bBloomberg\b/, host: /(^|\.)bloomberg\.com$/ },
  { id: "guardian", name: /\b(?:The )?Guardian\b/, host: /(^|\.)theguardian\.com$/ },
  { id: "forbes", name: /\bForbes\b/, host: /(^|\.)forbes\.com$/ },
  { id: "cnbc", name: /\bCNBC\b/, host: /(^|\.)cnbc\.com$/ },
  { id: "politico", name: /\bPolitico\b|\bPOLITICO\b/, host: /(^|\.)politico\.(com|eu)$/ },
  { id: "npr", name: /\bNPR\b/, host: /(^|\.)npr\.org$/ },
  { id: "usatoday", name: /\bUSA Today\b|\bUSA TODAY\b/, host: /(^|\.)usatoday\.com$/ },
  { id: "aljazeera", name: /\bAl Jazeera\b/, host: /(^|\.)aljazeera\.com$/ },
  { id: "ft", name: /\bFinancial Times\b|\bFT\b/, host: /(^|\.)ft\.com$/ },
  { id: "axios", name: /\bAxios\b/, host: /(^|\.)axios\.com$/ },
  { id: "hill", name: /\bThe Hill\b/, host: /(^|\.)thehill\.com$/ },
  { id: "bi", name: /\bBusiness Insider\b/, host: /(^|\.)businessinsider\.com$/ },
  { id: "wikipedia", name: /\bWikipedia\b/, host: /(^|\.)wikipedia\.org$/ },
  { id: "techcrunch", name: /\bTechCrunch\b/, host: /(^|\.)techcrunch\.com$/ },
  { id: "verge", name: /\bThe Verge\b/, host: /(^|\.)theverge\.com$/ },
  { id: "wired", name: /\bWired\b|\bWIRED\b/, host: /(^|\.)wired\.com$/ },
  { id: "guinness", name: /\bGuinness World Records\b/, host: /(^|\.)guinnessworldrecords\.com$/ },
  { id: "britannica", name: /\bBritannica\b/, host: /(^|\.)britannica\.com$/ },
  { id: "nasa", name: /\bNASA\b/, host: /(^|\.)nasa\.gov$/ },
  { id: "espn", name: /\bESPN\b/, host: /(^|\.)espn\.com$/ },
  { id: "time", name: /\bTIME magazine\b|\bTime magazine\b/, host: /(^|\.)time\.com$/ },
  { id: "newsweek", name: /\bNewsweek\b/, host: /(^|\.)newsweek\.com$/ },
];
const outletsIn = (sentence: string): string[] => {
  const clean = sentence.replace(/\[\[?\d{1,2}\]?(?:\([^)]*\))?\]/g, " ");
  return OUTLETS.filter((o) => o.name.test(clean)).map((o) => o.id);
};
const outletOfHost = (host: string): string[] => OUTLETS.filter((o) => o.host.test(host)).map((o) => o.id);

/** v128: a sentence that NAMES outlets ("Per Washington Post, NYT, ABC [5][6][7]") must not carry a marker whose source host belongs to a
 *  different outlet or to none of the named ones (bbc.com). Re-point each contradicting marker to a not-yet-cited slot whose host IS a named
 *  outlet. Conservative: only re-binds when a named outlet has an uncited slot; otherwise the marker is left (we never invent a source). */
export function alignOutlets(text: string, slotUrls: Map<number, string>): { text: string; rebound: number } {
  let rebound = 0;
  const slotOutlets = new Map<number, string[]>(), slotHost = new Map<number, string>();
  for (const [n, u] of slotUrls) { const h = hostOf(u); if (h) { slotHost.set(n, h); slotOutlets.set(n, outletOfHost(h)); } }
  if (!slotHost.size) return { text, rebound };
  const parts = text.split(/(```[\s\S]*?```)/g);
  const out = parts.map((part, pi) => {
    if (pi % 2 === 1) return part;
    return part.replace(/[^\n]*?(?:[.!?](?=\s|$)|\n|$)/g, (sent) => {
      if (!sent.trim()) return sent;
      const markers = [...sent.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1]));
      if (!markers.length) return sent;
      const named = outletsIn(sent);
      if (!named.length) return sent;
      const cited = new Set(markers);
      const matched = new Set<string>();                 // named outlets already backed by a cited marker
      const wrong: number[] = [];
      for (const n of markers) {
        if (!slotHost.has(n)) continue;                  // unknown slot: cannot judge
        const so = slotOutlets.get(n) || [];
        const hit = so.filter((id) => named.includes(id));
        if (hit.length) hit.forEach((id) => matched.add(id)); else wrong.push(n);
      }
      if (!wrong.length) return sent;
      const missing = named.filter((id) => !matched.has(id));
      let result = sent;
      for (const w of [...new Set(wrong)]) {
        let repl: number | undefined;
        for (const id of missing) {
          const cand = [...slotOutlets.entries()].find(([n, so]) => so.includes(id) && !cited.has(n));
          if (cand) { repl = cand[0]; missing.splice(missing.indexOf(id), 1); break; }
        }
        if (repl !== undefined) { result = result.replace(`[${w}]`, `[${repl}]`); cited.add(repl); rebound++; }
      }
      return result.replace(/(\[\d+\])\1+/g, "$1");
    });
  });
  return { text: out.join(""), rebound };
}

// ---------- images ----------
export interface ImgRes { image_url: string; origin_url: string; title: string }
const ICON_HOST = /(^|\.)(icon\.horse|logo\.clearbit\.com|favicons?\.[a-z.]+|favicon\.[a-z.]+)$/i;
const ICON_PATH = /(favicon|apple-touch-icon|touch-icon|sprite|\b1x1\b|spacer|\/pixel\.|\.ico(\?|$)|\/s2\/favicons|faviconV2|\/icons?\/|\/(?:static\/)?images?\/(?:logo|icon)s?[\/._-]|[-_.\/]logo(?:[-_.\/@]|v\d|$)|[-_.]icon[-_.@]|wikipedia-?logo|wikimedia-?logo|commons-?logo|wiktionary-?logo|\/static\/images\/)/i;
const GENERIC_Q = new Set(["image", "images", "photo", "photos", "picture", "pictures", "pic", "pics", "show", "me", "of", "the", "a", "an", "and", "or", "in", "on", "for", "to", "is", "are", "what", "how", "does", "do", "did", "look", "looks", "like", "view", "views", "with", "about", "from", "tell", "give", "who", "when", "where", "which", "why", "tall", "high", "long", "height", "length", "wide", "width", "big", "large", "old", "age", "much", "many", "far", "bridge", "building", "tower", "city", "world", "record", "records", "biggest", "tallest", "longest", "largest", "latest", "new", "best", "top", "vs", "versus", "compare", "comparison", "diagram", "map", "screenshot", "facts", "history"]);
const tok = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
const stem = (w: string) => w.replace(/(ies|es|s)$/, "");
export function cleanImages(images: ImgRes[], query = "", max = 12): ImgRes[] {
  const wantsLogo = /\b(logo|logos|icon|icons|favicon|brand|emblem)\b/i.test(query);
  const seen = new Set<string>(), seenName = new Set<string>();
  const distinctive = tok(query).filter((w) => !GENERIC_Q.has(w)).map(stem);
  const kept: ImgRes[] = [];
  for (const im of images || []) {
    let u: URL; try { u = new URL(String(im?.image_url || "")); } catch { continue; }
    if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    const host = u.hostname.toLowerCase(), full = host + u.pathname + u.search;
    if (ICON_HOST.test(host)) continue;
    if (!wantsLogo && (ICON_PATH.test(full) || /^(logo|icon|favicon)s?$/i.test(String(im.title || "").trim()))) continue;
    if (/\.svg(\?|$)/i.test(u.pathname) && !wantsLogo && /(logo|icon|brand)/i.test(u.pathname)) continue;
    const key = host.replace(/^www\./, "") + u.pathname;
    const base = (u.pathname.split("/").pop() || "").toLowerCase().replace(/^\d+px-/, "").replace(/\.(jpe?g|png|webp|gif|svg|avif)$/, "");
    const nameKey = base ? (hostOf(im.origin_url || "") || host.split(".").slice(-2).join(".")) + "|" + base : "";
    if (seen.has(key) || (nameKey && seenName.has(nameKey))) continue;
    // relevance: a card whose own text/URLs share NO distinctive query word is off-topic (Tacoma Narrows for "Golden Gate").
    // Cards with no text at all can't be judged and are kept.
    if (distinctive.length) {
      const hay = (String(im.title || "") + " " + decodeURIComponent((im.origin_url || "").replace(/%(?![0-9a-f]{2})/gi, "")) + " " + u.pathname).toLowerCase();
      const hayToks = new Set(tok(hay).map(stem));
      const hasText = String(im.title || "").trim().length > 0;
      if (hasText && !distinctive.some((w) => hayToks.has(w) || hay.includes(w))) continue;
    }
    seen.add(key); if (nameKey) seenName.add(nameKey);
    kept.push({ image_url: u.toString(), origin_url: String(im.origin_url || ""), title: String(im.title || "").slice(0, 200) });
    if (kept.length >= max) break;
  }
  return kept;
}
