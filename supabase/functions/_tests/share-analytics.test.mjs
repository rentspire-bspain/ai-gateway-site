// Run: node --test _tests/share-analytics.test.mjs (requires esbuild via npx).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";

const code = execFileSync("npx", ["--yes", "esbuild", "share/index.ts", "--format=iife", "--platform=neutral", "--log-level=error"], { encoding: "utf8" });
async function run(payload, { analyticsFailure, insertFailure, authorized = true } = {}) {
  let handler;
  const calls = [], jobs = [];
  runInNewContext(code, {
    Deno: { env: { get: (key) => ({ SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "test-service", SUPABASE_ANON_KEY: "test-anon" })[key] }, serve: (fn) => { handler = fn; } },
    Request, Response, URL, AbortSignal, Uint8Array, crypto: webcrypto, console: { error() {} },
    EdgeRuntime: { waitUntil: (job) => jobs.push(job) },
    fetch: async (url, init = {}) => {
      const body = init.body ? JSON.parse(init.body) : null;
      calls.push({ url, body, headers: init.headers });
      if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-test", email: "eval-bot@spaincos.com" });
      if (url.endsWith("/analytics_events") && analyticsFailure === "throw") throw new Error("offline");
      if (url.endsWith("/analytics_events") && analyticsFailure === "http") return new Response("", { status: 500 });
      if (url.endsWith("/shared_threads") && insertFailure) return new Response("insert failed", { status: 500 });
      return new Response("", { status: 201 });
    }
  });
  const response = await handler(new Request("https://example.test/share", {
    method: "POST", headers: authorized ? { Authorization: "Bearer test-jwt" } : {},
    body: JSON.stringify({ action: "create", messages: [{ role: "assistant", content: "test" }], ...payload })
  }));
  await Promise.all(jobs);
  return { response, calls, jobs, events: calls.filter((c) => c.url.endsWith("/analytics_events")) };
}

test("share emits once after insert with authenticated user, source thread, and each card variant", async () => {
  for (const card_variant of ["standard", "flash", "node"]) {
    const result = await run({ thread_id: "thread-test", card_variant });
    assert.equal(result.response.status, 200);
    assert.equal(result.events.length, 1);
    assert.equal(result.jobs.length, 1);
    assert.deepEqual(result.events[0].body, { user_id: "user-test", event_type: "share", payload: { thread_id: "thread-test", card_variant }, model: null, credits_delta: 0 });
    assert.equal(result.events[0].headers.Authorization, "Bearer test-service");
    assert.ok(result.calls.findIndex((c) => c.url.endsWith("/shared_threads")) < result.calls.findIndex((c) => c.url.endsWith("/analytics_events")));
  }
});
test("missing or unsupported optional fields are null", async () => {
  for (const payload of [{}, { card_variant: "invalid", thread_id: 42 }, ...["answer", "streak", "ring", "nodedex"].map((card_variant) => ({ card_variant }))]) {
    assert.deepEqual((await run(payload)).events[0].body.payload, { thread_id: null, card_variant: null });
  }
});
test("analytics network and HTTP failures never break a successful share", async () => {
  for (const analyticsFailure of ["throw", "http"]) assert.equal((await run({}, { analyticsFailure })).response.status, 200);
});
test("failed inserts, unauthenticated calls, and empty messages do not emit shares", async () => {
  assert.equal((await run({}, { insertFailure: true })).events.length, 0);
  const unauthorized = await run({}, { authorized: false });
  assert.equal(unauthorized.response.status, 401);
  assert.equal(unauthorized.events.length, 0);
  assert.equal((await run({ messages: [] })).events.length, 0);
});
