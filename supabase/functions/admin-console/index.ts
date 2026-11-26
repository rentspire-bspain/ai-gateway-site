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

    return json({ admin: email, generated_at: new Date().toISOString(), signups_30d: signups, activity_30d: activity, users, recent_searches: recent }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
