// net-guard.js — SSRF-hardened outbound fetch for the gateway tools (fetch_page, fetch_asset, web fetches).
// Pure JS (no Deno/Node APIs at import time) so it runs in Supabase Edge (Deno) and in node:test.
// Defenses: full IPv4/IPv6 range classification (incl. mapped/NAT64/6to4/Teredo), hostname rules,
// port allowlist, DNS resolution of every hop (A+AAAA, all answers must be public), manual redirect
// following with re-validation per hop, DNS re-check AFTER the response (rebinding tripwire),
// streaming byte cap, timeout, per-request egress budget.

const BLOCKED_HOSTS = new Set([
  "localhost", "metadata", "metadata.google.internal", "metadata.goog", "instance-data", "instance-data.ec2.internal",
  "kubernetes", "kubernetes.default", "kubernetes.default.svc",
]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".lan", ".home", ".corp", ".intranet", ".private", ".svc", ".cluster.local", ".arpa"];
const DEFAULT_PORTS = new Set(["", "80", "443"]);

/** @returns {number[]|null} 4 octets or null */
export function parseIPv4(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((n) => n >= 0 && n <= 255) ? o : null;
}

/** Expand an IPv6 literal to 8 16-bit groups, or null. Handles :: and embedded IPv4 tails. */
export function parseIPv6(input) {
  let s = String(input).toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!s.includes(":")) return null;
  const tail = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  if (tail) {
    const v4 = parseIPv4(tail[1]);
    if (!v4) return null;
    s = s.slice(0, -tail[1].length) + ((v4[0] << 8) | v4[1]).toString(16) + ":" + ((v4[2] << 8) | v4[3]).toString(16);
  }
  const parts = s.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const rest = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  let groups;
  if (parts.length === 2) {
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    groups = [...head, ...Array(fill).fill("0"), ...rest];
  } else groups = head;
  if (groups.length !== 8) return null;
  const out = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return out.some(Number.isNaN) ? null : out;
}

function blockedV4(o) {
  const [a, b, c] = o;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||        // CGNAT
    (a === 169 && b === 254) ||                  // link-local + cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||     // benchmarking
    (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) ||
    a >= 224;                                    // multicast, reserved, broadcast
}

/** true if the IP literal is not a safe public unicast address. Unparseable input is blocked. */
export function isBlockedIp(ip) {
  const v4 = parseIPv4(String(ip));
  if (v4) return blockedV4(v4);
  const g = parseIPv6(String(ip));
  if (!g) return true;
  const allZeroTo = (n) => g.slice(0, n).every((x) => x === 0);
  if (allZeroTo(8) || (allZeroTo(7) && g[7] === 1)) return true;                        // :: and ::1
  if (allZeroTo(5) && (g[5] === 0xffff || g[5] === 0)) return blockedV4([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255]); // ::ffff:a.b.c.d, ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return blockedV4([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255]); // NAT64
  if (g[0] === 0x2002) return blockedV4([g[1] >> 8, g[1] & 255, g[2] >> 8, g[2] & 255]);                   // 6to4
  if (g[0] === 0x2001 && g[1] === 0) return true;                                       // Teredo
  if (g[0] === 0x2001 && g[1] === 0xdb8) return true;                                   // documentation
  if ((g[0] & 0xfe00) === 0xfc00) return true;                                          // ULA fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true;                                          // link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true;                                          // site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true;                                          // multicast
  return false;
}

/** Validate the syntactic parts of a URL (no DNS). Throws Error with a short reason. Returns the URL. */
export function assertPublicUrl(raw, opts = {}) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { throw new Error("invalid url"); }
  const schemes = opts.httpsOnly ? ["https:"] : ["http:", "https:"];
  if (!schemes.includes(u.protocol)) throw new Error("only " + (opts.httpsOnly ? "https" : "http(s)") + " urls are allowed");
  if (u.username || u.password) throw new Error("urls with credentials are not allowed");
  const ports = opts.ports ? new Set(opts.ports.map(String)) : DEFAULT_PORTS;
  if (!ports.has(u.port)) throw new Error("port not allowed");
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new Error("invalid host");
  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) throw new Error("host not allowed");
  const bare = host.replace(/^\[|\]$/g, "");
  if (bare.includes(":") || /^[\d.]+$/.test(bare)) { // IP literal (WHATWG URL already normalised hex/decimal/octal IPv4)
    if (isBlockedIp(bare)) throw new Error("private or reserved address");
  } else if (!bare.includes(".")) throw new Error("single-label hostnames are not allowed");
  if (/[\u0000-\u001f\s]/.test(u.hostname)) throw new Error("invalid host");
  return u;
}

/**
 * Resolve host -> addresses via injected resolver (Deno.resolveDns wrapper). Every answer must be public.
 * @param {(host:string, type:"A"|"AAAA")=>Promise<string[]>} resolve
 */
export async function resolvePublic(host, resolve) {
  const bare = host.replace(/^\[|\]$/g, "");
  if (bare.includes(":") || /^[\d.]+$/.test(bare)) { if (isBlockedIp(bare)) throw new Error("private or reserved address"); return [bare]; }
  const [a, aaaa] = await Promise.all([
    resolve(bare, "A").catch(() => []), resolve(bare, "AAAA").catch(() => []),
  ]);
  const all = [...a, ...aaaa];
  if (!all.length) throw new Error("host did not resolve");
  if (all.some(isBlockedIp)) throw new Error("host resolves to a private or reserved address");
  return all.sort();
}

/** Per-request egress budget shared by every tool call. */
export class EgressBudget {
  constructor({ maxRequests = 10, maxBytes = 4 * 1024 * 1024, maxPerHost = 4 } = {}) {
    this.maxRequests = maxRequests; this.maxBytes = maxBytes; this.maxPerHost = maxPerHost;
    this.requests = 0; this.bytes = 0; this.hosts = new Map();
  }
  chargeRequest(host) {
    if (this.requests >= this.maxRequests) throw new Error("egress budget exhausted: too many outbound requests for this question");
    const n = (this.hosts.get(host) || 0) + 1;
    if (n > this.maxPerHost) throw new Error("egress budget exhausted: too many requests to " + host);
    this.requests++; this.hosts.set(host, n);
  }
  chargeBytes(n) {
    this.bytes += n;
    if (this.bytes > this.maxBytes) throw new Error("egress budget exhausted: response bytes cap reached");
  }
}

async function readCapped(resp, maxBytes, budget) {
  const declared = Number(resp.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error(`response too large (${declared} > ${maxBytes})`);
  if (!resp.body) return new Uint8Array(0);
  const reader = resp.body.getReader();
  const chunks = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { try { await reader.cancel(); } catch { /* ignore */ } throw new Error(`response too large (> ${maxBytes} bytes)`); }
    budget?.chargeBytes(value.byteLength);
    chunks.push(value);
  }
  const out = new Uint8Array(total); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

/**
 * Safe GET. Returns { url, status, headers, bytes }.
 * opts: resolve (required), fetchImpl, maxRedirects(3), maxBytes(1MB), timeoutMs(8000), budget, headers,
 *       httpsOnly, allowContentType(RegExp), checkUrl(url)=>void  (extra policy hook, e.g. egress provenance)
 */
export async function safeFetch(rawUrl, opts) {
  const { resolve, fetchImpl = fetch, maxRedirects = 3, maxBytes = 1024 * 1024, timeoutMs = 8000, budget, headers = {}, httpsOnly = false, allowContentType, checkUrl } = opts;
  if (typeof resolve !== "function") throw new Error("safeFetch requires a DNS resolver");
  let current = String(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = assertPublicUrl(current, { httpsOnly });
    if (checkUrl) checkUrl(u);
    const before = await resolvePublic(u.hostname, resolve);
    budget?.chargeRequest(u.hostname);
    const resp = await fetchImpl(u.toString(), { method: "GET", redirect: "manual", headers, signal: AbortSignal.timeout(timeoutMs) });
    if (resp.status >= 300 && resp.status < 400 && resp.headers.get("location")) {
      try { await resp.body?.cancel(); } catch { /* ignore */ }
      if (hop === maxRedirects) throw new Error("too many redirects");
      current = new URL(resp.headers.get("location"), u).toString();
      continue;
    }
    if (allowContentType) {
      const ct = (resp.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!allowContentType.test(ct)) { try { await resp.body?.cancel(); } catch { /* ignore */ } throw new Error(`unsupported content-type '${ct || "none"}'`); }
    }
    const bytes = await readCapped(resp, maxBytes, budget);
    // DNS-rebinding tripwire: the name must still resolve to the same public set after the request.
    const after = await resolvePublic(u.hostname, resolve);
    if (after.join() !== before.join() && after.some((ip) => !before.includes(ip))) throw new Error("dns answer changed during request (possible rebinding)");
    return { url: u.toString(), status: resp.status, headers: resp.headers, bytes };
  }
  throw new Error("too many redirects");
}
