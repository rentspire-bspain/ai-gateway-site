#!/usr/bin/env node
// test-auth-expiry.mjs — jsdom regression test for the expired-session / sign-out bugs on ai.spaincos.com.
//
//   node tools/test-auth-expiry.mjs            (needs `jsdom`; see "Setup" below)
//
// It loads the REAL index.html + modules/ + the pinned supabase-js build into jsdom with a mocked network, seeds a
// signed-in session in localStorage, then simulates a dead server-side session and asserts the user always SEES it:
//   A  expired token -> submit a question            => sign-in gate + "Your session expired" in the thread, auth keys wiped,
//                                                       unsent question back in the composer
//   B  expired token -> Deep Research submit         => same (this used to silently do nothing)
//   C  Deep Research POST 500                        => visible error on the results view, session untouched
//   D  Deep Research POST 200 without job id        => visible error, never a silent clear
//   E  sign out while the server session is dead     => all local auth state cleared + gate (used to no-op)
//   F  sign out while the logout request hangs       => still completes (time-boxed server revoke)
//   G  stale access token but valid refresh token    => request is transparently replayed, NO gate
//   H  revoked session on page load                  => proactive check flips to the gate before any send
//   I  gateway 401 but session healthy (not session) => no sign-out (refresh succeeds and 401 persists -> normal error)
//
// Setup (once):  mkdir -p /tmp/authtest && cd /tmp/authtest && npm i jsdom   — or set JSDOM_PATH=/path/to/node_modules/jsdom
// CDN scripts (supabase-js, marked, dompurify) are fetched once and cached in $TMPDIR/authtest-cache.
// No secrets are used: the session is a fabricated JWT and every Supabase URL is answered by the in-process mock.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = process.env.SITE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); // SITE_ROOT: run against another checkout (e.g. a pre-fix export) to prove the test fails there
const require = createRequire(import.meta.url);
function loadJsdom() {
  const cands = [process.env.JSDOM_PATH, "jsdom", "/tmp/authtest/node_modules/jsdom", "/tmp/dr-qa/node_modules/jsdom", "/tmp/qa/node_modules/jsdom", "/tmp/node_modules/jsdom"].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch (e) { /* next */ } }
  console.error("jsdom not found. Run: mkdir -p /tmp/authtest && cd /tmp/authtest && npm i jsdom   (or set JSDOM_PATH)"); process.exit(2);
}
const { JSDOM, ResourceLoader, VirtualConsole } = loadJsdom();

const ORIGIN = "https://ai.spaincos.com";
const SB = "https://bnxermyboeigvwonfrzx.supabase.co";
const KEY = "sb-bnxermyboeigvwonfrzx-auth-token";
const MSG = "Your session expired — sign in again.";
const CACHE = path.join(os.tmpdir(), "authtest-cache");
fs.mkdirSync(CACHE, { recursive: true });

class Loader extends ResourceLoader {
  fetch(url) {
    if (url.startsWith(ORIGIN + "/")) {
      const rel = decodeURIComponent(new URL(url).pathname).replace(/^\//, "") || "index.html";
      const f = path.join(ROOT, rel);
      return fs.existsSync(f) ? Promise.resolve(fs.readFileSync(f)) : Promise.resolve(Buffer.from(""));
    }
    if (url.startsWith("https://cdn.jsdelivr.net/")) {
      const f = path.join(CACHE, url.replace(/[^a-z0-9.]+/gi, "_"));
      if (fs.existsSync(f)) return Promise.resolve(fs.readFileSync(f));
      return fetch(url).then((r) => r.arrayBuffer()).then((b) => { fs.writeFileSync(f, Buffer.from(b)); return Buffer.from(b); });
    }
    return Promise.resolve(Buffer.from("")); // fonts etc.
  }
}

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fakeJwt = (exp) => `${b64u({ alg: "HS256", typ: "JWT" })}.${b64u({ sub: "u-1", exp, role: "authenticated" })}.sig`;
const USER = { id: "u-1", aud: "authenticated", role: "authenticated", email: "tester@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
function session(tag = "old") {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return { access_token: fakeJwt(exp) + "." + tag, refresh_token: "rt-" + tag, token_type: "bearer", expires_in: 3600, expires_at: exp, user: USER };
}
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// ---- one scenario = fresh jsdom + scenario-specific network behaviour ----
async function boot(sc) {
  const calls = [];
  const logs = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => { if (!/Not implemented/.test(String(e && e.message))) logs.push("jsdomError: " + (e && e.message)); });
  vc.on("error", (m) => logs.push("console.error: " + m));
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), {
    url: ORIGIN + "/", runScripts: "dangerously", resources: new Loader(), pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.assign(w, { TextEncoder, TextDecoder, Response, Headers, Request });
      if (sc.session !== null) w.localStorage.setItem(KEY, JSON.stringify(sc.session || session()));
      let refreshN = 0;
      w.addEventListener("aisc:signout", () => { calls.push({ kind: "ext-signout-event" }); });
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      w.fetch = async (input, init = {}) => {
        const url = typeof input === "string" ? input : input.url;
        const h = new Headers(init.headers || {});
        const rec = { url: url.replace(SB, ""), method: init.method || "GET", auth: (h.get("authorization") || "").slice(-12) };
        calls.push(rec);
        if (url.startsWith(SB + "/auth/v1/token")) {
          refreshN++;
          if (sc.refresh === "dead") return json(400, { code: "refresh_token_not_found", error: "invalid_grant", error_description: "Invalid Refresh Token: Refresh Token Not Found" });
          if (sc.refresh === "net") throw new TypeError("Failed to fetch");
          return json(200, session("new" + refreshN));
        }
        if (url.startsWith(SB + "/auth/v1/user")) return sc.user === 401 ? json(401, { code: "bad_jwt", msg: "invalid JWT" }) : json(200, USER);
        if (url.startsWith(SB + "/auth/v1/logout")) {
          if (sc.logout === "hang") return new Promise(() => {});
          if (sc.logout === "net") throw new TypeError("Failed to fetch");
          return json(401, { msg: "session_not_found" });
        }
        if (url.includes("/rest/v1/rpc/is_signin_allowed")) return json(200, true);
        if (url.includes("/rest/v1/")) return json(200, []);
        if (url.includes("/functions/v1/gateway-status")) return json(200, { results: [], tested_at: new Date().toISOString() });
        if (url.includes("/functions/v1/research-jobs")) return sc.research ? sc.research(rec, init) : json(401, { error: "Not authenticated" });
        if (url.includes("/functions/v1/gateway-chat")) return sc.chat ? sc.chat(rec, init) : json(401, { error: "Not authenticated" });
        return json(200, {});
      };
    },
  });
  const w = dom.window;
  await until(() => w.document.readyState === "complete" && w.ResearchMode, 8000, "page init");
  await sleep(300); // let init() / checkAuth() / background verify settle
  return { dom, w, doc: w.document, calls, logs };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, what) { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return; } catch (e) { /* retry */ } await sleep(40); } throw new Error("timeout waiting for " + what); }
const visible = (el) => !!el && el.style.display !== "none" && el.style.display !== "";
function submit(app, text, id = "landingInput") {
  const el = app.doc.getElementById(id); el.value = text;
  el.dispatchEvent(new app.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
}
const results = (app) => app.doc.getElementById("resultsContent").textContent;
const gateText = (app) => app.doc.getElementById("authOverlay").textContent;
const authKeys = (app) => Object.keys(app.w.localStorage).filter((k) => /^sb-.*-auth-token/.test(k));

let failed = 0, passed = 0;
function check(name, cond, extra) { if (cond) { passed++; console.log("  ok   " + name); } else { failed++; console.log("  FAIL " + name + (extra ? "  -> " + extra : "")); } }
async function scenario(title, sc, body) {
  console.log("\n" + title);
  let app; try { app = await boot(sc); await body(app); } catch (e) { failed++; console.log("  FAIL scenario threw: " + (e && e.stack || e)); }
  finally { try { app && app.dom.window.close(); } catch (e) { /* ignore */ } }
}
function expectExpiredUi(app, { gate = true } = {}) {
  check("sign-in gate is shown", visible(app.doc.getElementById("authOverlay")));
  check('gate says "' + MSG + '"', gateText(app).includes(MSG), gateText(app).slice(0, 120));
  check("message is rendered in the thread where the answer would be", results(app).includes(MSG) || results(app).includes("session expired"), results(app).slice(0, 160));
  check("results view is visible (not left on the landing page)", app.doc.getElementById("landing").style.display === "none" && app.doc.getElementById("resultsScroll").style.display === "block");
  check("stored auth keys are wiped", authKeys(app).length === 0, authKeys(app).join(","));
  check("account row flipped back to signed-out", app.doc.getElementById("userEmail").textContent === "Sign in");
  check("extension bridge told to drop its mirrored copy", app.calls.some((c) => c.kind === "ext-signout-event"));
}

// A
await scenario("A. expired session -> submit question", { refresh: "dead" }, async (app) => {
  check("starts signed in", app.doc.getElementById("userEmail").textContent === "tester@example.com");
  submit(app, "what is the capital of france");
  await until(() => visible(app.doc.getElementById("authOverlay")), 6000, "gate");
  await sleep(200);
  expectExpiredUi(app);
  check("unsent question restored to the composer", app.doc.getElementById("landingInput").value === "what is the capital of france" || app.doc.getElementById("followupInput").value === "what is the capital of france");
});
// B
await scenario("B. expired session -> Deep Research submit", { refresh: "dead" }, async (app) => {
  app.doc.getElementById("deepResearchToggle").click();
  check("Deep Research pill is active", app.doc.getElementById("deepResearchToggle").classList.contains("active"));
  submit(app, "state of solid state batteries");
  await until(() => visible(app.doc.getElementById("authOverlay")), 6000, "gate");
  await sleep(300);
  expectExpiredUi(app);
  check("the research question is shown on the thread", results(app).includes("state of solid state batteries"));
});
// C
await scenario("C. Deep Research POST -> HTTP 500", { research: () => json(500, { error: "worker crashed" }) }, async (app) => {
  app.doc.getElementById("deepResearchToggle").click();
  submit(app, "q500");
  await until(() => /Deep Research failed/.test(results(app)), 6000, "error card");
  check("error text is visible with the server message", results(app).includes("worker crashed"), results(app).slice(0, 160));
  check("results view is visible", app.doc.getElementById("resultsScroll").style.display === "block" && app.doc.getElementById("landing").style.display === "none");
  check("question stays on screen", results(app).includes("q500"));
  check("session untouched (no gate, keys kept)", !visible(app.doc.getElementById("authOverlay")) && authKeys(app).length === 1);
});
// D
await scenario("D. Deep Research POST 200 without a job id", { research: () => json(200, { ok: true }) }, async (app) => {
  app.doc.getElementById("deepResearchToggle").click();
  submit(app, "qnojob");
  await until(() => /Deep Research failed/.test(results(app)), 6000, "error card");
  check("error says no job id was returned", /no job id/i.test(results(app)), results(app).slice(0, 200));
  check("results view is visible", app.doc.getElementById("resultsScroll").style.display === "block");
});
// E
await scenario("E. sign out while the server session is dead (logout request fails)", { refresh: "dead", logout: "net" }, async (app) => {
  app.doc.getElementById("userRow").click();
  await until(() => app.doc.querySelector('.account-menu [data-act="out"]'), 3000, "account menu");
  app.doc.querySelector('.account-menu [data-act="out"]').click();
  await until(() => visible(app.doc.getElementById("authOverlay")), 5000, "gate after sign-out");
  check("sign-in gate is shown", true);
  check("stored auth keys are wiped", authKeys(app).length === 0, authKeys(app).join(","));
  check("account row flipped back to signed-out", app.doc.getElementById("userEmail").textContent === "Sign in");
  check("extension bridge told to drop its mirrored copy", app.calls.some((c) => c.kind === "ext-signout-event"));
  await sleep(300);
  check("auth keys still absent after the server round-trip finishes", authKeys(app).length === 0);
});
// F
await scenario("F. sign out while the logout request hangs forever", { logout: "hang" }, async (app) => {
  app.doc.getElementById("userRow").click();
  await until(() => app.doc.querySelector('.account-menu [data-act="out"]'), 3000, "account menu");
  const t0 = Date.now();
  app.doc.querySelector('.account-menu [data-act="out"]').click();
  await until(() => visible(app.doc.getElementById("authOverlay")) && authKeys(app).length === 0, 5000, "gate + wiped storage");
  check("gate + wiped storage appear immediately (" + (Date.now() - t0) + " ms)", Date.now() - t0 < 1500);
  await sleep(3000);
  check("still wiped after the hung request is abandoned", authKeys(app).length === 0);
});
// G
await scenario("G. stale access token, valid refresh token -> transparent replay", {
  refresh: "ok",
  chat: (rec) => (rec.auth.endsWith(".old") ? json(401, { error: "jwt expired" }) : json(200, { choices: [{ message: { content: "Paris." } }] })),
}, async (app) => {
  submit(app, "capital of france");
  await until(() => /Paris/.test(results(app)), 8000, "answer after replay");
  check("answer rendered after the token was refreshed and the request replayed", true);
  check("no sign-in gate", !visible(app.doc.getElementById("authOverlay")));
  check("session kept", authKeys(app).length === 1);
  check("chat was called twice with different tokens", new Set(app.calls.filter((c) => c.url.includes("gateway-chat")).map((c) => c.auth)).size === 2);
});
// H
await scenario("H. revoked session discovered on load (before any send)", { user: 401, refresh: "dead" }, async (app) => {
  await until(() => visible(app.doc.getElementById("authOverlay")), 5000, "gate");
  check("gate shown without the user sending anything", true);
  check('gate says "' + MSG + '"', gateText(app).includes(MSG));
  check("stored auth keys are wiped", authKeys(app).length === 0);
  check("account row flipped to signed-out", app.doc.getElementById("userEmail").textContent === "Sign in");
});
// I
await scenario("I. gateway 401 but the session is healthy (refresh works, 401 persists)", { refresh: "ok", chat: () => json(401, { error: "Not authenticated" }) }, async (app) => {
  submit(app, "hello");
  await until(() => /Something went wrong|session expired/i.test(results(app)), 8000, "error card");
  check("a visible error is shown", true);
  check("healthy session is NOT signed out", !visible(app.doc.getElementById("authOverlay")) && authKeys(app).length === 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
