// checkout — Stripe Checkout for ai.spaincos.com subscriptions (v172 + uid fix).
// POST {plan:'core'|'max'}  (caller's Supabase JWT; user must be signed in)
//   -> {url} Stripe Checkout Session (30-day free trial, card required)
//   -> {not_configured:true, setup} when STRIPE_SECRET_KEY is absent (fail visible, never fake).
// client_reference_id = the buyer's user id — the webhook grants credits to that id (idempotent).
// subscription_data.metadata.user_id/plan — copied by Stripe onto the Subscription and
// snapshotted onto EVERY renewal invoice (parent.subscription_details.metadata), so
// invoice.paid renewals carry the uid without any lookup. Without this, subscription
// invoices have no uid and the webhook skips them.
import { corsFor, preflight } from "../_shared/cors.js";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
let _cors: Record<string, string> = {};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ..._cors, "Content-Type": "application/json" } });

const PLANS: Record<string, { name: string; price: number; credits: number; desc: string }> = {
  core: { name: "Core", price: 800, credits: 2500, desc: "Core plan — 25,000 points/day-class usage" },
  max: { name: "Max", price: 5000, credits: 25000, desc: "Max plan — 250,000 points/day-class usage + Deep Research" },
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
  if (!plan) return json({ error: "plan must be 'core' or 'max'" }, 400);

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
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(plan.price));
  form.set("line_items[0][price_data][recurring][interval]", "month");
  form.set("line_items[0][price_data][product_data][name]", `ai.spaincos.com ${plan.name}`);
  form.set("line_items[0][price_data][product_data][description]", plan.desc);
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
