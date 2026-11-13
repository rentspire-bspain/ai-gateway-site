// student-verify-send — emails the .edu verification link for ai.spaincos.com campus verification.
// POST {} (caller's Supabase JWT; user must be signed in)
//   -> {sent: true, email_masked} when the verification email goes out
//   -> {not_configured: true, setup} when RESEND_API_KEY is absent (fail visible, never fake).
// House pattern: thin JWT wrapper, no business logic — eligibility, token minting, claim guards,
// and consent recording all live in the student_verification_request RPC, which this function
// calls AS THE USER so auth.uid() resolves. The raw token NEVER returns to the client (master
// doc §32.10 rule) — this edge function is the only consumer of the RPC's token response.
// Analytics: fires a fire-and-forget student_verify_requested event via the analytics_events lane.
import { corsFor, preflight } from "../_shared/cors.js";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
let _cors: Record<string, string> = {};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ..._cors, "Content-Type": "application/json" } });

function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}${"*".repeat(Math.max(0, u.length - 2))}@${d}`;
}

Deno.serve(async (req) => {
  _cors = corsFor(req);
  if (req.method === "OPTIONS") return preflight(req, _cors);
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.length < 20) return json({ error: "signed-in session required" }, 401);

  // 1. Call the request RPC AS THE USER (their JWT) — auth.uid() resolves inside the RPC.
  const r = await fetch(`${SB_URL}/rest/v1/rpc/student_verification_request`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_email: (await req.json().catch(() => ({})))?.email ?? "" }),
    signal: AbortSignal.timeout(15_000),
  });
  const rpc = await r.json().catch(() => null);
  if (!r.ok) return json({ error: String(rpc?.message ?? `request RPC HTTP ${r.status}`).slice(0, 200) }, r.status === 400 ? 400 : 502);
  const email = String(rpc?.email ?? "");
  const verifyToken = String(rpc?.token ?? "");
  if (!email || !verifyToken) return json({ error: "request RPC returned no email/token" }, 502);

  // 2. Email the link via Resend. Fail visible when unconfigured.
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const appUrl = Deno.env.get("APP_URL") || "https://ai.spaincos.com";
  const from = Deno.env.get("VERIFY_FROM_EMAIL") || "verify@spaincos.com";
  if (!resendKey) return json({ not_configured: true, setup: "Add RESEND_API_KEY (and optionally VERIFY_FROM_EMAIL, APP_URL) in Supabase project secrets, then retry. No email is sent until then." });
  const link = `${appUrl}/verify?token=${encodeURIComponent(verifyToken)}`;
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Verify your student email — ai.spaincos.com",
      text: `Verify your student email to unlock your 1,000 credits + 500 Neurons campus bonus.\n\nOpen this link within 24 hours:\n${link}\n\nOr paste this code in Settings > Campus:\n${verifyToken}\n\nYou received this because you requested student verification on ai.spaincos.com. Didn't request it? Ignore this email — nothing happens.`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!send.ok) return json({ error: `resend HTTP ${send.status}` }, 502);

  // 3. Fire-and-forget analytics (never blocks the send).
  try {
    const job = fetch(`${SB_URL}/rest/v1/analytics_events`, {
      method: "POST",
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ event_type: "student_verify_requested", payload: { email_domain: email.split("@")[1] } }),
      signal: AbortSignal.timeout(6_000),
    }).then((x) => { if (!x.ok) console.error("analytics insert failed: student_verify_requested", x.status); }).catch(() => {});
    (globalThis as any).EdgeRuntime?.waitUntil?.(job);
  } catch (_e) { /* never fail the send on analytics */ }

  return json({ sent: true, email_masked: maskEmail(email) });
});
