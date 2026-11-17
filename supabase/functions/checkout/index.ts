// checkout — Stripe Checkout for ai.spaincos.com subscriptions (v172 + uid fix + four-tier ladder).
// POST {plan:'starter'|'pro'|'unlimited'} (caller's Supabase JWT; user must be signed in)
//   -> {url} Stripe Checkout Session (30-day free trial, card required)
//   -> {not_configured:true, setup} when STRIPE_SECRET_KEY is absent (fail visible, never fake).
// client_reference_id = the buyer's user id — the webhook grants credits to that id (idempotent).
// subscription_data.metadata.user_id/plan — copied by Stripe onto the Subscription and
// snapshotted onto EVERY renewal invoice (parent.subscription_details.metadata), so
// invoice.paid renewals carry the uid without any lookup. Without this, subscription
// invoices have no uid and the webhook skips them.
//
// FOUR-TIER LADDER (owner-approved blanket pricing, master doc §32.6): Free $0 / Starter $4.99 /
// Pro $9.99 / Unlimited $12.99. Prices use the live-mode Stripe Price IDs created for
// RENTSPIRE LLC acct_1QbFSiEobD5Y9pei (product ai.spaincos.com Signal Pass prod_VdOApg0KuA1ICn)
// instead of inline price_data — one place to change a price now (Stripe dashboard), no redeploy.
// Unlimited is scoped to standard free-model usage: unlimited searches and quick questions;
// the frontier sampler stays capped and agent work stays complexity-settled (§32.6 truth-in-name).
import { corsFor, preflight } from "../_shared/cors.js";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
let _cors: Record<string, string> = {};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ..._cors, "Content-Type": "application/json" } });

// Live-mode Price IDs (lookup keys: ai_spaincos_{starter,pro,unlimited}_monthly).
// Monthly credits per tier are the webhook's grant amounts (see stripe-webhook PLANS).
const PLANS: Record<string, { name: string; priceId: string; desc: string }> = {
  starter:  { name: "Starter",  priceId: "price_1Uc7OPEobD5Y9peixAv33V1c", desc: "Starter plan — 2,500 credits/month" },
  pro:      { name: "Pro",      priceId: "price_1Uc7OQEobD5Y9peitDy83mLR", desc: "Pro plan — 10,000 credits/month" },
  unlimited: { name: "Unlimited", priceId: "price_1Uc7OSEobD5Y9pei8nv8PDK8", desc: "Unlimited plan — 25,000 credits/month + priority processing" },
};

Deno.serve(async (req) => {
  _cors = corsFor(req);
  if (req.method === "OPTIONS") return preflight(req, _cors);
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.length < 20) return json({ error: "signed-in session required" }, 401);
  // resolve the caller's user id (client_reference_id for the webhook)
  const me: any = await fetch(`${SB_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: ANON }, signal: AbortSignal.timeout(8_000) }).then((r) => r.json()).catch(() => null);
  const uid = me?.id;
  if (!uid) return json({ error: "could not resolve signed-in user" }, 401);

  let b: any = {};
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const plan = PLANS[String(b?.plan || "")];
  if (!plan) return json({ error: "plan must be 'starter', 'pro', or 'unlimited'" }, 400);

  const key = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!key) return json({ not_configured: true, setup: "Add STRIPE_SECRET_KEY in Supabase project secrets, then retry. No card is charged until then." });

  // Stripe Checkout Session via raw fetch (no SDK in edge functions).
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("client_reference_id", String(uid));
  form.set("success_url", "https://ai.spaincos.com/?billing=success");
  form.set("cancel_url", "https://ai.spaincos.com/?billing=cancel");
  form.set("subscription_data[trial_period_days]", "30");
  // THE FIX: subscription metadata is what reaches renewal invoices (session metadata does not).
  form.set("subscription_data[metadata][user_id]", String(uid));
  form.set("subscription_data[metadata][plan]", String(b.plan));
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price]", plan.priceId);
  form.set("metadata[plan]", String(b.plan));
  form.set("metadata[user_id]", String(uid));
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(20_000)
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.url) return json({ error: String(d?.error?.message || `stripe HTTP ${r.status}`).slice(0, 300) }, 502);
  return json({ url: d.url, plan: b.plan, session: d.id });
});
