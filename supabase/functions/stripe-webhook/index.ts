// stripe-webhook — grants credits on Stripe subscription events (v172).
// POST (raw body from Stripe) — signature-verified with STRIPE_WEBHOOK_SECRET.
//   checkout.session.completed  -> first-month credits (core 2,500 / max 25,000)
//   invoice.paid                -> renewal credits (same amounts)
// Idempotent: ref = 'stripe-' + event.id (unique constraint on credits_ledger blocks replays).
// Always 200 to Stripe except signature failures (400) so Stripe never retries forever.
import { corsFor, preflight } from "../_shared/cors.js";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
let _cors: Record<string, string> = {};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ..._cors, "Content-Type": "application/json" } });
const PLANS: Record<string, number> = { core: 2500, max: 25000 };

// constant-time compare (lengths are public: 64 hex chars)
function ctEq(a: string, b: string): boolean {
  if (a.length !== b.length || !a.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function hmac(secret: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function grant(uid: string, credits: number, ref: string, reason: string): Promise<boolean> {
  // insert with unique (reason, ref) — a replayed event hits the constraint and is skipped
  return await fetch(`${SB_URL}/rest/v1/credits_ledger`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SVC}`, apikey: SVC, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: uid, delta: credits, reason, ref }),
    signal: AbortSignal.timeout(10_000)
  }).then((r) => r.ok).catch(() => false);
}

// Same service-role, waitUntil, fail-open analytics pipeline as gateway-chat.
function logAnalyticsEvent(userId: string, eventType: string, payload: Record<string, unknown>, model: string | null, creditsDelta: number) {
  try {
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!svcKey) return;
    const job = fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/analytics_events`, {
      method: "POST",
      headers: { "apikey": svcKey, "Authorization": `Bearer ${svcKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ user_id: userId || null, event_type: eventType, payload, model, credits_delta: creditsDelta }),
      signal: AbortSignal.timeout(6_000)
    }).then((r) => { if (!r.ok) console.error("analytics insert failed:", eventType, r.status); }).catch(() => {});
    (globalThis as any).EdgeRuntime?.waitUntil?.(job);
  } catch (_e) { /* never fail the webhook on analytics */ }
}

Deno.serve(async (req) => {
  _cors = corsFor(req, { extraHeaders: ["stripe-signature"] });
  if (req.method === "OPTIONS") return preflight(req, _cors);
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  if (!secret || !SVC) return json({ error: "not configured" }, 503);
  const body = await req.text();
  const sigHeader = req.headers.get("stripe-signature") || "";
  const tMatch = sigHeader.match(/t=(\d+)/);
  const v1Match = sigHeader.match(/v1=([0-9a-f]+)/);
  if (!tMatch || !v1Match) return json({ error: "missing signature" }, 400);
  const t = Number(tMatch[1]);
  if (!Number.isFinite(t)) return json({ error: "bad timestamp" }, 400);
  if (Math.abs(Date.now() / 1000 - t) > 600) return json({ error: "signature too old" }, 400); // 10-min replay window
  const expected = await hmac(secret, `${t}.${body}`);
  if (!ctEq(expected, v1Match[1])) return json({ error: "signature mismatch" }, 400);
  let evt: any;
  try { evt = JSON.parse(body); } catch { return json({ error: "invalid JSON" }, 400); }
  const type = String(evt?.type || "");
  const eventId = String(evt?.id || "");
  try {
    if (type === "checkout.session.completed" || type === "invoice.paid") {
      const obj = evt?.data?.object || {};
      // Subscription-generated invoices snapshot the subscription's metadata at
      // parent.subscription_details.metadata (Stripe copies subscription_data.metadata
      // from Checkout onto the Subscription, then onto every invoice it creates) —
      // that snapshot is the only uid source on invoice.paid renewals.
      const subMeta = obj?.parent?.subscription_details?.metadata || {};
      const uid = String(obj?.client_reference_id || obj?.metadata?.user_id || subMeta?.user_id || "");
      const plan = String(obj?.metadata?.plan || subMeta?.plan || (obj?.amount_total === 5000 ? "max" : "core"));
      const credits = PLANS[plan] || 2500;
      if (uid && eventId) {
        const granted = await grant(uid, credits, `stripe-${eventId}`, type === "invoice.paid" ? "purchase" : "purchase");
        // Subscription revenue belongs to invoice.paid, not the checkout event as well.
        // A free trial/zero-dollar invoice is not a purchase; ledger uniqueness skips replays.
        const amount = type === "invoice.paid" ? obj.amount_paid : obj.amount_total;
        const paid = type === "invoice.paid" || obj.payment_status === "paid";
        if (granted && paid && Number.isFinite(amount) && amount > 0 && obj.currency === "usd"
          && (type === "invoice.paid" || obj.mode === "payment")) {
          const metadataProduct = obj?.metadata?.product;
          const interval = obj?.lines?.data?.[0]?.price?.recurring?.interval;
          const product = ["pack", "signal_pass_monthly", "signal_pass_annual"].includes(metadataProduct)
            ? metadataProduct
            : obj.mode === "payment" ? "pack" : interval === "year" ? "signal_pass_annual" : "signal_pass_monthly";
          const stripeSessionId = type === "checkout.session.completed" ? obj.id : obj?.metadata?.stripe_session_id;
          logAnalyticsEvent(uid, "purchase", {
            amount_usd: amount / 100, product,
            ...(typeof stripeSessionId === "string" && stripeSessionId ? { stripe_session_id: stripeSessionId } : {})
          }, null, credits);
        }
        // notification for the buyer
        await fetch(`${SB_URL}/rest/v1/notifications`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SVC}`, apikey: SVC, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ user_id: uid, type: "credits", title: `${plan === "max" ? "Max" : "Core"} plan active — ${credits.toLocaleString()} credits added`, body: type === "invoice.paid" ? "Renewal credits applied." : "Welcome aboard. Credits are live in Settings > Billing." }),
          signal: AbortSignal.timeout(8_000)
        }).catch(() => {});
      }
    }
  } catch (_e) { /* never fail the webhook on grant errors — Stripe would retry */ }
  return json({ received: true });
});
