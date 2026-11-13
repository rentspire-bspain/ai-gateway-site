// ============================================================================
// Edge function: student-verify-send — emails the student verification token
// House pattern (matches neurons-claim v5): thin auth wrapper, no business
// logic at the edge. All logic lives in the SECURITY DEFINER RPCs.
//
// Flow:
//   client -> POST /functions/v1/student-verify-send { email }
//   -> calls student_verification_request RPC WITH THE USER'S JWT (auth.uid())
//   -> consumes the returned email_token: builds the link, emails it, DROPS it
//   -> NEVER returns the token to the client (master-doc §32.10 rule)
//   -> fires student_verify_requested analytics (fire-and-forget, fail-open)
//
// Required env (Supabase edge function config):
//   RESEND_API_KEY      — email provider key (provider decision: confirm w/ parity)
//   APP_URL             — https://ai.spaincos.com (link target base)
//   VERIFY_FROM_EMAIL   — e.g. verify@ai.spaincos.com (must be a verified
//                         Resend sender domain; DNS records on spaincos.com)
//
// Status: DRAFT — parity review + owner approval before deploy.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // 1. Auth — same JWT discipline as gateway-chat / neurons-claim
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "auth required" }, 401);
  }
  const userJwt = authHeader.replace("Bearer ", "");

  // 2. Input
  let body: { email?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid body" }, 400); }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return json({ error: "email required" }, 400);

  // 3. Admin client for the service-side pieces (analytics fire-and-forget)
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 4. Call the RPC as the user (auth.uid() must resolve to the caller).
  //    The RPC enforces .edu pattern, domain eligibility, one-claim-per-address,
  //    and stores consent version — the edge adds none of that.
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${userJwt}` } } },
  );
  const { data: rpc, error: rpcError } = await userClient.rpc(
    "student_verification_request",
    { p_email: email },
  );

  // 5. Analytics first (fire-and-forget, fail-open) so failures still count
  const institution = rpc?.institution ?? null;
  admin.from("analytics_events").insert({
    event: "student_verify_requested",
    props: {
      domain: email.split("@")[1] ?? null,
      institution,
      outcome: rpcError ? "rpc_error" : rpc?.ok ? "ok" : rpc?.error,
    },
  }).then(() => {}, () => {}); // never block on analytics

  // 6. RPC outcomes — error shapes are returned to the client for UX copy,
  //    but never any token material
  if (rpcError) return json({ error: "request_failed" }, 500);
  if (!rpc?.ok) return json({ error: rpc.error ?? "request_failed" }, 400);

  // 7. THE ONLY TOKEN CONSUMER: build the link, email it, then drop it.
  const token: string = rpc.email_token;
  const appUrl = Deno.env.get("APP_URL") ?? "https://ai.spaincos.com";
  const link = `${appUrl}/verify?token=${encodeURIComponent(token)}`;

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    // Fail loudly for ops, softly for the user — the pending row exists and
    // the user can retry once the env is set. Flagged: this must not ship to
    // prod unconfigured (parity review note).
    console.error("student-verify-send: RESEND_API_KEY not set");
    return json({ error: "email_provider_not_configured" }, 503);
  }

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("VERIFY_FROM_EMAIL") ?? "verify@ai.spaincos.com",
      to: email,
      subject: "Verify your school email — ai.spaincos.com",
      html: verifyEmailHtml(link, rpc.expires_at),
      // plain-text alternative for spam-filter friendliness
      text: `Verify your school email to get 1,000 bonus credits and 500 Neurons.\n\nOpen this link (expires in 24 hours):\n${link}\n\nIf you didn't request this, ignore this email.`,
    }),
  });
  if (!emailRes.ok) {
    console.error("student-verify-send: resend failed", await emailRes.text());
    return json({ error: "email_send_failed" }, 502);
  }

  // token is out of scope here — never logged, never returned
  return json({ ok: true, expires_at: rpc.expires_at, institution }, 200);

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// Verification email body — plain language, disclosure, CAN-SPAM footer.
function verifyEmailHtml(link: string, expiresAt: string): string {
  return `<!doctype html>
<html><body style="font-family:-apple-system,'Segoe UI',sans-serif;color:#1a1a2e;max-width:520px;margin:0 auto;padding:24px">
  <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#5b8cff;font-weight:600">ai.spaincos.com</p>
  <h1 style="font-size:24px;margin:8px 0">Confirm your school email</h1>
  <p style="line-height:1.6;color:#444">Tap the button below to verify your student status and claim <b>1,000 bonus query credits</b> and <b>500 Neurons</b>. The link expires in 24 hours.</p>
  <p style="margin:28px 0">
    <a href="${link}" style="background:#5b8cff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;display:inline-block">Verify my email</a>
  </p>
  <p style="font-size:13px;color:#666">Or paste this link into your browser:<br><a href="${link}" style="color:#5b8cff">${link}</a></p>
  <p style="font-size:11px;color:#999;line-height:1.6;border-top:1px solid #eee;padding-top:16px;margin-top:32px">
    You're receiving this because someone entered this address at ai.spaincos.com. If that wasn't you, ignore this email.
    We never sell your email, and you can opt out of marketing email any time.
    Spain Companies, Redondo Beach, CA. Verification disclosures v1.
  </p>
</body></html>`;
}
