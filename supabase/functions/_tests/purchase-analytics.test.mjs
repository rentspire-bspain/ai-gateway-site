// Run: node --test _tests/purchase-analytics.test.mjs (requires esbuild via npx).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { createHmac, webcrypto } from "node:crypto";

const code = execFileSync("npx", ["--yes", "esbuild", "stripe-webhook/index.ts", "--bundle", "--format=iife", "--platform=neutral", "--log-level=error"], { encoding: "utf8" });
async function run(object = {}, { type = "invoice.paid", grantStatus = 201, analyticsFailure, signatureValid = true } = {}) {
  let handler;
  const calls = [], jobs = [];
  const fixtureSecret = "local-fixture-only";
  runInNewContext(code, {
    Deno: { env: { get: (key) => ({ SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "test-service", STRIPE_WEBHOOK_SECRET: fixtureSecret })[key] }, serve: (fn) => { handler = fn; } },
    Request, Response, TextEncoder, Uint8Array, AbortSignal, crypto: webcrypto, console: { error() {} },
    EdgeRuntime: { waitUntil: (job) => jobs.push(job) },
    fetch: async (url, init = {}) => {
      calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
      if (url.endsWith("/analytics_events") && analyticsFailure === "throw") throw new Error("offline");
      if (url.endsWith("/analytics_events") && analyticsFailure === "http") return new Response("", { status: 500 });
      return new Response("", { status: url.endsWith("/credits_ledger") ? grantStatus : 201 });
    }
  });
  const body = JSON.stringify({ id: "evt-local-test", type, data: { object: { metadata: { user_id: "user-test" }, currency: "usd", amount_paid: 800, ...object } } });
  const t = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", fixtureSecret).update(`${t}.${body}`).digest("hex");
  const response = await handler(new Request("https://example.test/stripe-webhook", {
    method: "POST", body, headers: { "stripe-signature": `t=${t},v1=${signatureValid ? signature : "0".repeat(64)}` }
  }));
  await Promise.all(jobs);
  return { response, calls, jobs, events: calls.filter((c) => c.url.endsWith("/analytics_events")) };
}

test("paid invoice emits monthly amount in dollars through service role and waitUntil", async () => {
  const result = await run();
  assert.equal(result.response.status, 200);
  assert.equal(result.events.length, 1);
  assert.equal(result.jobs.length, 1);
  assert.deepEqual(result.events[0].body, { user_id: "user-test", event_type: "purchase", payload: { amount_usd: 8, product: "signal_pass_monthly" }, model: null, credits_delta: 2500 });
  assert.equal(result.events[0].headers.Authorization, "Bearer test-service");
});
test("explicit product metadata is preserved for all supported products", async () => {
  for (const product of ["pack", "signal_pass_monthly", "signal_pass_annual"]) {
    const result = await run({ metadata: { user_id: "user-test", product }, amount_paid: 1234 });
    assert.deepEqual(result.events[0].body.payload, { amount_usd: 12.34, product });
  }
});
test("credits_delta matches actual granted credits and optional Stripe session ID is retained", async () => {
  const max = await run({ metadata: { user_id: "user-test", plan: "max", stripe_session_id: "cs_fixture_invoice" } });
  assert.equal(max.events[0].body.credits_delta, 25000);
  assert.equal(max.calls.find((c) => c.url.endsWith("/credits_ledger")).body.delta, max.events[0].body.credits_delta);
  assert.equal(max.events[0].body.payload.stripe_session_id, "cs_fixture_invoice");
  const pack = await run({ id: "cs_fixture_pack", mode: "payment", payment_status: "paid", amount_total: 999, client_reference_id: "pack-user" }, { type: "checkout.session.completed" });
  assert.equal(pack.events[0].body.payload.stripe_session_id, "cs_fixture_pack");
  assert.equal(pack.events[0].body.credits_delta, 2500);
});
test("annual invoice and one-time checkout infer supported product names", async () => {
  assert.equal((await run({ lines: { data: [{ price: { recurring: { interval: "year" } } }] } })).events[0].body.payload.product, "signal_pass_annual");
  const pack = await run({ mode: "payment", payment_status: "paid", amount_total: 999, client_reference_id: "pack-user" }, { type: "checkout.session.completed" });
  assert.equal(pack.events[0].body.payload.product, "pack");
  assert.equal(pack.events[0].body.user_id, "pack-user");
});
test("zero-dollar trials, unpaid, non-USD, malformed amounts, and subscription checkout are excluded", async () => {
  for (const object of [{ amount_paid: 0 }, { amount_paid: -1 }, { currency: "eur" }, { amount_paid: "800" }]) assert.equal((await run(object)).events.length, 0);
  for (const object of [{ mode: "subscription", payment_status: "paid", amount_total: 800 }, { mode: "payment", payment_status: "unpaid", amount_total: 800 }]) assert.equal((await run(object, { type: "checkout.session.completed" })).events.length, 0);
});
test("replayed/failed grants, missing user and invalid signatures produce no purchase", async () => {
  for (const grantStatus of [409, 500]) assert.equal((await run({}, { grantStatus })).events.length, 0);
  assert.equal((await run({ metadata: {} })).events.length, 0);
  const invalid = await run({}, { signatureValid: false });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.calls.length, 0);
});
test("analytics network and HTTP failures never break webhook acknowledgement", async () => {
  for (const analyticsFailure of ["throw", "http"]) assert.equal((await run({}, { analyticsFailure })).response.status, 200);
});
