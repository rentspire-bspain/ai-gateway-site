// rate-limit.js — two layers: (1) per-instance in-memory sliding window (cheap, always on),
// (2) durable DB counter via public.gw_rate_check (see _migrations). The DB layer FAILS CLOSED for
// paid/expensive buckets: if the check errors we deny, instead of silently allowing.
export class MemoryLimiter {
  constructor(now = () => Date.now()) { this.now = now; this.m = new Map(); }
  check(key, limit, windowMs) {
    const t = this.now(); const arr = (this.m.get(key) || []).filter((x) => t - x < windowMs);
    if (arr.length >= limit) { this.m.set(key, arr); return { ok: false, retryAfter: Math.ceil((windowMs - (t - arr[0])) / 1000) }; }
    arr.push(t); this.m.set(key, arr);
    if (this.m.size > 5000) for (const k of this.m.keys()) { if (this.m.size <= 4000) break; this.m.delete(k); }
    return { ok: true, retryAfter: 0 };
  }
}
export const RATE_POLICY = {
  // 2026-11-10: site is private + invite-only (allowlist-enforced sign-in) — limits
  // raised from the original public-posture numbers. Owner + QA account are exempt
  // from the durable DB layer; the per-instance memory limiter still caps bursts.
  chat:      { limit: 120, windowSec: 3600 },
  deep:      { limit: 20,  windowSec: 3600 },
  embed:     { limit: 90,  windowSec: 3600 },
  tool_fetch:{ limit: 360, windowSec: 3600 },
  repo_prepare: { limit: 60, windowSec: 3600 },
  repo_approve: { limit: 30, windowSec: 3600 },
};
/** @returns {Promise<{ok:boolean, retryAfter:number, reason?:string}>} */
export async function dbRateCheck({ fetchImpl = fetch, supabaseUrl, serviceKey, userId, bucket, limit, windowSec, failOpen = false }) {
  try {
    const r = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/gw_rate_check`, {
      method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user: userId, p_bucket: bucket, p_limit: limit, p_window_sec: windowSec }), signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) throw new Error("rate rpc " + r.status);
    const d = await r.json();
    return { ok: d?.allowed === true, retryAfter: Number(d?.retry_after || 0) };
  } catch (e) {
    return failOpen ? { ok: true, retryAfter: 0, reason: "rate_check_error_open" } : { ok: false, retryAfter: 30, reason: "rate_check_error_closed" };
  }
}
export function tooMany(retryAfter, cors) {
  return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly.", retry_after: retryAfter }), { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(retryAfter) } });
}
