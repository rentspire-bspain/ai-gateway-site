// auth-email-relay — v1 (2026-11-15, owner directive: "EMAIL CODES AND PASSKEYS STILL NOT WORKING")
//
// WHY: the Supabase Auth project has NO SMTP configured (smtp_host = None in the auth
// config), so signInWithOtp/recovery links return HTTP 200 but the email is NEVER
// delivered — the owner's "email code not working" defect. This project already has a
// verified Resend sender (RESEND_API_KEY + RESEND_FROM vaulted, used by
// student-verify-send), so ALL auth email goes through it:
//   POST {action:"send",     email}     — 6-digit code emailed via Resend, hashed to auth_codes
//   POST {action:"verify",    email, code} — code check -> session minted server-side via the
//                                          admin magic-link exchange, returned to the caller
//   POST {action:"recovery",  email}     — recovery link emailed via Resend (sets a password;
//                                          also the path for an account that has NO password yet)
//
// SECURITY:
//   - CORS: browser-called, origin-pinned to https://ai.spaincos.com (corsFor).
//   - Allowlist: is_signin_allowed RPC (service key) gates every action — the site is
//     invite-only; unknown emails get 403, same as the built-in flow.
//   - Codes: 6 digits, SHA-256(salt+code), 10-minute expiry, max 5 verify attempts,
//     one send per email per 60s, max 10 sends per email per UTC day.
//   - Sessions: minted ONLY via Supabase's own magic-link exchange with the service key
//     (no tokens are ever invented here); the relay never logs or echoes codes.
import { corsFor } from "../_shared/cors.js";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const svcHeaders = { "apikey": SVC, "Authorization": `Bearer ${SVC}`, "Content-Type": "application/json" };

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,10}$/;
const CODE_RE = /^\d{6}$/;

async function allowlisted(email: string): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/is_signin_allowed`, {
      method: "POST", headers: svcHeaders, body: JSON.stringify({ p_email: email }),
      signal: AbortSignal.timeout(6_000)
    });
    if (!r.ok) return false;
    const t = await r.text();
    return t.trim() === "true";
  } catch (_e) { return false; }
}

async function sendMail(to: string, subject: string, html: string): Promise<{ ok: boolean; err?: string }> {
  const key = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("RESEND_FROM") || "noreply@ai.spaincos.com";
  if (!key) return { ok: false, err: "email provider not configured" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(15_000)
    });
    if (r.ok) return { ok: true };
    return { ok: false, err: (await r.text()).slice(0, 200) };
  } catch (e) { return { ok: false, err: String(e).slice(0, 150) }; }
}

const codeMail = (code: string) => `
<div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;max-width:520px;margin:0 auto;padding:28px 24px;background:#0b0f14;border-radius:14px;color:#e7ecef">
  <h2 style="margin:0 0 12px;font-size:19px;font-weight:700">Your ai.spaincos.com sign-in code</h2>
  <p style="margin:0 0 16px;color:#9aa7b2;font-size:14px">Enter this code to sign in:</p>
  <p style="font-size:30px;font-weight:800;letter-spacing:6px;color:#14b8a6;margin:0 0 18px">${code}</p>
  <p style="margin:0;color:#66737f;font-size:12px">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
</div>`;

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const email = String(body?.email || "").trim().toLowerCase();

    if (!EMAIL_RE.test(email)) return new Response(JSON.stringify({ error: "Enter a valid email." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    if (!(await allowlisted(email))) return new Response(JSON.stringify({ error: "This site is invite-only — this email isn't on the list." }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

    // ---------- SEND ----------
    if (action === "send") {
      // rate limits: 1 per 60s, 10 per UTC day
      const day = new Date().toISOString().slice(0, 10);
      const rl = await fetch(`${SB_URL}/rest/v1/auth_codes?select=id,created_at&email=eq.${email}&created_at=gte.${new Date(Date.now() - 86400_000).toISOString()}`, { headers: svcHeaders, signal: AbortSignal.timeout(6_000) });
      const recent = rl.ok ? (await rl.json()) as any[] : [];
      if (Array.isArray(recent) && recent.length >= 10) return new Response(JSON.stringify({ error: "Too many codes requested today — try tomorrow or use password sign-in." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (Array.isArray(recent) && recent.some((r) => Date.now() - new Date(r.created_at).getTime() < 60_000)) {
        return new Response(JSON.stringify({ error: "A code was just sent — wait a minute and check your inbox (and spam)." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const salt = crypto.randomUUID();
      const hashed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + code)).then((b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""));
      const ins = await fetch(`${SB_URL}/rest/v1/auth_codes`, {
        method: "POST", headers: svcHeaders,
        body: JSON.stringify({ email, code_hash: hashed, salt, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }),
        signal: AbortSignal.timeout(6_000)
      });
      if (!ins.ok) return new Response(JSON.stringify({ error: "Could not store the code — try again." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      const m = await sendMail(email, `${code} is your ai.spaincos.com sign-in code`, codeMail(code));
      if (!m.ok) { console.error("auth-email-relay send failed:", m.err); return new Response(JSON.stringify({ error: "The email provider rejected the send — try password sign-in or contact the owner." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } }); }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ---------- VERIFY ----------
    if (action === "verify") {
      const code = String(body?.code || "").trim();
      if (!CODE_RE.test(code)) return new Response(JSON.stringify({ error: "Enter the 6-digit code from the email." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      const qr = await fetch(`${SB_URL}/rest/v1/auth_codes?select=id,code_hash,salt,expires_at,attempts,used&email=eq.${email}&used=eq.false&order=created_at.desc&limit=1`, { headers: svcHeaders, signal: AbortSignal.timeout(6_000) });
      const rows = qr.ok ? (await qr.json()) as any[] : [];
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return new Response(JSON.stringify({ error: "No active code — request a new one." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      if (new Date(row.expires_at).getTime() < Date.now()) return new Response(JSON.stringify({ error: "That code expired — request a new one." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      if (Number(row.attempts) >= 5) return new Response(JSON.stringify({ error: "Too many wrong tries — request a new code." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      const hashed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(row.salt + code)).then((b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""));
      if (hashed !== row.code_hash) {
        await fetch(`${SB_URL}/rest/v1/auth_codes?id=eq.${row.id}`, { method: "PATCH", headers: svcHeaders, body: JSON.stringify({ attempts: Number(row.attempts) + 1 }), signal: AbortSignal.timeout(6_000) });
        return new Response(JSON.stringify({ error: "Wrong code — check the email and try again." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      await fetch(`${SB_URL}/rest/v1/auth_codes?id=eq.${row.id}`, { method: "PATCH", headers: svcHeaders, body: JSON.stringify({ used: true }), signal: AbortSignal.timeout(6_000) });
      // mint the session server-side: admin magic link -> exchange (never trust a client-asserted identity)
      const gl = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
        method: "POST", headers: { "apikey": SVC, "Authorization": `Bearer ${SVC}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "magiclink", email }),
        signal: AbortSignal.timeout(15_000)
      });
      if (!gl.ok) {
        const t = (await gl.text()).slice(0, 200);
        console.error("auth-email-relay generate_link failed:", t);
        return new Response(JSON.stringify({ error: "Sign-in failed at the auth server — try password or a recovery email." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const link = ((await gl.json()) as any)?.action_link || "";
      const token = (link.match(/[?&]token=([^&]+)/) || [])[1];
      if (!token) return new Response(JSON.stringify({ error: "Sign-in link malformed — try again." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      const vf = await fetch(`${SB_URL}/auth/v1/verify`, {
        method: "POST", headers: { "apikey": ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ token: decodeURIComponent(token), type: "magiclink", redirect_to: "https://ai.spaincos.com" }),
        signal: AbortSignal.timeout(15_000)
      });
      if (!vf.ok) {
        const t = (await vf.text()).slice(0, 200);
        console.error("auth-email-relay verify failed:", t);
        return new Response(JSON.stringify({ error: "Code verified but the session exchange failed — try again." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const sess = await vf.json();
      return new Response(JSON.stringify({ ok: true, session: { access_token: sess.access_token, refresh_token: sess.refresh_token, expires_in: sess.expires_in, user: sess.user } }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ---------- RECOVERY (set / reset password) ----------
    if (action === "recovery") {
      const gl = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
        method: "POST", headers: { "apikey": SVC, "Authorization": `Bearer ${SVC}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "recovery", email }),
        signal: AbortSignal.timeout(15_000)
      });
      if (!gl.ok) {
        const t = (await gl.text()).slice(0, 200);
        console.error("auth-email-relay recovery failed:", t);
        return new Response(JSON.stringify({ error: "Could not create a reset link — contact the owner." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const link = ((await gl.json()) as any)?.action_link || "";
      if (!link) return new Response(JSON.stringify({ error: "Reset link malformed — try again." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      const m = await sendMail(email, "Set your ai.spaincos.com password", `
<div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;max-width:520px;margin:0 auto;padding:28px 24px;background:#0b0f14;border-radius:14px;color:#e7ecef">
  <h2 style="margin:0 0 12px;font-size:19px;font-weight:700">Set your ai.spaincos.com password</h2>
  <p style="margin:0 0 18px;color:#9aa7b2;font-size:14px">Click below to choose a new password. The link works once and expires in 1 hour.</p>
  <a href="${link}" style="display:inline-block;background:#14b8a6;color:#04211d;font-weight:700;padding:12px 22px;border-radius:10px;text-decoration:none;font-size:15px">Choose my password</a>
  <p style="margin:18px 0 0;color:#66737f;font-size:12px">If you didn't request this, ignore this email.</p>
</div>`);
      if (!m.ok) { console.error("auth-email-relay recovery send failed:", m.err); return new Response(JSON.stringify({ error: "The email provider rejected the send — try again shortly." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } }); }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
