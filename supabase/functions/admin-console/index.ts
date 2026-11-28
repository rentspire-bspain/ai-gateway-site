// admin-console v1 (owner directive 2026-11-26: private superadmin dashboard — all
// sign-ups, activity, analytics, each user's search history, full profile per user).
// SECURITY: requires a valid Supabase JWT whose email is listed in gateway_config
// key admin_emails (JSON array). No other caller sees anything.
import { corsFor, preflight } from "../_shared/cors.js";

const SB = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function json(data: unknown, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return preflight(req, cors);
  const url = new URL(req.url);
  if (url.pathname.endsWith("/ping")) return json({ ok: true }, 200, cors);
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method" }, 405, cors);
  try {
    // 1) authenticate caller via their JWT
    const auth = req.headers.get("authorization") || "";
    const me = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: SERVICE, Authorization: auth } });
    if (!me.ok) return json({ error: "invalid token" }, 401, cors);
    const user = await me.json();
    const email = String(user.email || "").toLowerCase();
    // 2) check the admin allowlist in gateway_config
    const cfg = await (await fetch(`${SB}/rest/v1/gateway_config?key=eq.admin_emails`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })).json();
    const admins: string[] = (() => { try { return JSON.parse(String((cfg[0] || {}).value || "[]")); } catch (_e) { return []; } })();
    if (!admins.includes(email)) return json({ error: "not an admin" }, 403, cors);
    const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

    // analytics: signups + activity by day (last 30 days)
    const signups = await (await fetch(`${SB}/rest/v1/rpc/admin_signups_by_day`, { method: "POST", headers: H, body: "{}" })).json().catch(() => []);
    const activity = await (await fetch(`${SB}/rest/v1/rpc/admin_activity_by_day`, { method: "POST", headers: H, body: "{}" })).json().catch(() => []);

    // per-user profiles: threads, messages, last activity
    const users = await (await fetch(`${SB}/rest/v1/rpc/admin_user_profiles`, { method: "POST", headers: H, body: "{}" })).json().catch(() => []);

    // recent searches (latest 200 user messages across all users)
    const recent = await (await fetch(`${SB}/rest/v1/rpc/admin_recent_searches?limit=200`, { method: "POST", headers: H, body: "{}" })).json().catch(() => []);
    // v365 RICH CONSOLE (owner directive 2026-11-27: "embarrassingly sparse — no analytics,
    // no breakdown by users"): DAU + per-day volume, weekly retention cohorts, per-user
    // usage/cost, warden health + alerts, and per-user drilldown (threads + messages +
    // memories + imported volume).
    const rpc = async (fn: string, body: any = {}) => await (await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(body) })).json().catch(() => []);
    const [dau, retention, usage, wardenHealth, wardenAlerts, userValue] = await Promise.all([
      rpc("admin_dau"), rpc("admin_retention"), rpc("admin_usage"), rpc("admin_warden_health"), rpc("admin_warden_alerts"), rpc("admin_user_value"),
    ]);
    }
    // per-user drilldown (POST ?user=<uuid> via body)
    let detail: any = null;
    const wantUser = String((req as any).__user || "");
    const url = new URL(req.url);
    const qUser = url.searchParams.get("user");
    const bodyUser = wantUser || qUser;
    if (bodyUser) {
      const [threads, msgs, prof, dossier] = await Promise.all([
        rpc("admin_user_threads", { p_user: bodyUser, p_limit: 100 }),
        rpc("admin_user_messages", { p_user: bodyUser, p_limit: 200 }),
        rpc("admin_user_profile_detail", { p_user: bodyUser }),
        rpc("admin_user_dossier", { p_user: bodyUser }),
      ]);
      detail = { user_id: bodyUser, threads, messages: msgs, profile: (prof || [])[0] || null, dossier: Array.isArray(dossier) ? dossier[0] : dossier };
    // v367 OSINT ENRICHMENT (owner directive 2026-11-28): reverse-IP geolocation for
    // every IP in the requested dossier (ip-api.com, free tier, server-side, best-effort).
    // Breach checks activate when HIBP_API_KEY is set (owner-gated — see completion doc).
    if (bodyUser && detail) {
      try {
        const ips = ((detail.dossier || {}).ips || []).map((x: any) => String(x.ip || "")).filter((x: string) => /^\d+\.\d+\.\d+\.\d+$/.test(x)).slice(0, 8);
        if (ips.length) {
          const geo = await (await fetch(`http://ip-api.com/batch?fields=status,country,regionName,city,isp,org,query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ips), signal: AbortSignal.timeout(6_000) })).json().catch(() => []);
          if (Array.isArray(geo)) (detail.dossier as any).geo = geo;
        }
      } catch { /* enrichment never blocks the dossier */ }
      const hibp = Deno.env.get("HIBP_API_KEY") || "";
      (detail.dossier as any).breach_check = hibp ? "configured" : "needs HIBP_API_KEY (owner-gated)";

    }
    return json({ admin: email, generated_at: new Date().toISOString(), signups_30d: signups, activity_30d: activity, users, recent_searches: recent, dau_30d: dau, retention: retention, usage: usage, warden_health: wardenHealth, warden_alerts: wardenAlerts, user_detail: detail, user_value: userValue }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
