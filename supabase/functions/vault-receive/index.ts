// vault-receive (v369 autonomous-repair infrastructure, owner-approved 2026-11-28):
// stores the Supabase Management API token for the warden's auto-repair deploys.
// The token arrives ONLY as the Authorization Bearer (from the credential vault's
// curl substitution) and is VERIFIED against the Management API before storing.
// It never appears in logs, query strings, or response bodies.
import { corsFor, preflight } from "../_shared/cors.js";

const SB = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return preflight(req, cors);
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok.startsWith("sbp_") && !tok.startsWith("sbx_")) return new Response(JSON.stringify({ error: "not a management token" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  // verify before storing — a bad token must never overwrite a good one
  const v = await fetch("https://api.supabase.com/v1/projects/bnxermyboeigvwonfrzx/functions?per_page=1", { headers: { authorization: `Bearer ${tok}` }, signal: AbortSignal.timeout(10_000) });
  if (!v.ok) return new Response(JSON.stringify({ error: "token failed verification", status: v.status }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  const r = await fetch(`${SB}/rest/v1/gateway_config`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key: "warden_mgmt_token", value: tok }),
  });
  return new Response(JSON.stringify({ ok: r.ok, stored: r.ok, verified: true, len: tok.length }), { status: r.ok ? 200 : 500, headers: { ...cors, "Content-Type": "application/json" } });
});
