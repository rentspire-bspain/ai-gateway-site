"use strict";
// Node-based tests for the browser extension (extension/). No browser is used: chrome.* is mocked and the side panel /
// content script run in jsdom. Run: node --test tests/extension.test.js   (jsdom: npm i jsdom, or NODE_PATH=<dir>/node_modules)
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ext = path.join(__dirname, "..", "extension");
const read = (f) => fs.readFileSync(path.join(ext, f), "utf8");
const L = require(path.join(ext, "lib.js"));
let JSDOM = null;
try { ({ JSDOM } = require("jsdom")); } catch (_e) { /* jsdom suites are skipped */ }
const jsd = { skip: JSDOM ? false : "jsdom not installed" };
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
// Values created inside jsdom / vm contexts have foreign prototypes; compare them as plain JSON.
const eq = (actual, expected) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual === undefined ? null : actual)), expected);
const openDoms = [];
test.afterEach(() => { while (openDoms.length) { try { openDoms.pop().window.close(); } catch (_e) { /* already closed */ } } }); // stop panel polling timers even when an assertion failed

// ---------------------------------------------------------------- manifest
test("manifest: valid MV3, files exist, minimal permissions, CSP scoped to first-party sites", () => {
  const m = JSON.parse(read("manifest.json"));
  assert.strictEqual(m.manifest_version, 3);
  assert.match(m.version, /^\d+\.\d+\.\d+$/);
  assert.deepStrictEqual([...m.permissions].sort(),
    ["activeTab", "alarms", "contextMenus", "declarativeNetRequest", "downloads", "notifications", "scripting", "sidePanel", "storage"]);
  assert.deepStrictEqual(m.host_permissions, L.SITES.map((s) => s + "/*"));
  assert.deepStrictEqual(m.content_scripts[0].matches, m.host_permissions);
  assert.deepStrictEqual(m.optional_host_permissions, ["https://*/*", "http://*/*"]); // never granted at install time
  assert.ok(!m.permissions.includes("tabs"), "tabs permission not needed");
  const csp = m.content_security_policy.extension_pages;
  assert.ok(!/unsafe-eval|unsafe-inline/.test(csp));
  assert.strictEqual(csp.match(/frame-src ([^;]*)/)[1], L.SITES.join(" "));
  for (const f of [m.background.service_worker, m.side_panel.default_path, ...m.content_scripts[0].js, ...Object.values(m.icons)]) {
    assert.ok(fs.existsSync(path.join(ext, f)), "missing " + f);
  }
  assert.ok(m.commands["summarize-page"] && m.commands["open-sidepanel"]);
});

test("sidepanel.html: no inline script/handlers (MV3 CSP), loads lib.js before sidepanel.js", () => {
  const h = read("sidepanel.html");
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(h), "inline <script>");
  assert.ok(!/\son[a-z]+\s*=/i.test(h), "inline event handler");
  assert.ok(h.indexOf('src="lib.js"') > 0 && h.indexOf('src="lib.js"') < h.indexOf('src="sidepanel.js"'));
});

test("build metadata: version.json points at an existing zip that matches the manifest version", () => {
  const m = JSON.parse(read("manifest.json"));
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "extension-build", "version.json"), "utf8"));
  const zip = path.join(__dirname, "..", "extension-build", v.zip);
  if (v.version === m.version) assert.ok(fs.existsSync(zip), "zip for " + v.version + " missing");
  else assert.ok(!L.SITES.length, "version.json (" + v.version + ") != manifest (" + m.version + ")");
});

// ---------------------------------------------------------------- lib.js
test("normalizeSettings: allowlisted site, safe model id, booleans; garbage falls back to defaults", () => {
  assert.deepStrictEqual(L.normalizeSettings(null), { site: "https://ai.spaincos.com", model: "", includePage: true, includeSelection: true });
  assert.strictEqual(L.normalizeSettings({ site: "https://boundview.com" }).site, "https://boundview.com");
  assert.strictEqual(L.normalizeSettings({ site: "https://evil.example" }).site, "https://ai.spaincos.com");
  assert.strictEqual(L.normalizeSettings({ site: "https://boundview.com.evil.io" }).site, "https://ai.spaincos.com");
  assert.strictEqual(L.normalizeSettings({ model: "kimi" }).model, "kimi");
  assert.strictEqual(L.normalizeSettings({ model: "x'; drop" }).model, "");
  assert.strictEqual(L.normalizeSettings({ model: "a".repeat(65) }).model, "");
  assert.strictEqual(L.normalizeSettings({ includePage: "yes" }).includePage, true);
  assert.strictEqual(L.normalizeSettings({ includeSelection: false }).includeSelection, false);
  assert.deepStrictEqual(L.normalizeSettings("junk"), L.normalizeSettings(null));
});

test("buildQuestion keeps the v1.1.x wording for the context menu and shortcut", () => {
  const tab = { url: "https://x.io/a", title: "  My   Page " };
  assert.strictEqual(L.buildQuestion({ menuItemId: "ask-page", pageUrl: "https://x.io/a" }, tab), 'Read and summarize this page: "My Page" (https://x.io/a)');
  assert.strictEqual(L.buildQuestion({ menuItemId: "ask-selection", selectionText: "hi\n there", pageUrl: "https://x.io/a" }, tab),
    'Explain this text selected on "My Page" (https://x.io/a): "hi there"');
  assert.strictEqual(L.buildQuestion({ menuItemId: "ask-page", pageUrl: "https://x.io/a" }, {}), "Read and summarize this page: https://x.io/a");
  const long = L.buildQuestion({ menuItemId: "ask-selection", selectionText: "z".repeat(5000), pageUrl: "https://x.io" }, {});
  assert.ok(long.length < 2100 && long.endsWith("\u2026\""));
});

test("buildContextQuestion: clearly labelled, single line, respects the include toggles and limits", () => {
  const ctx = { title: "Doc", url: "https://x.io/p", selection: "some\nselected text" };
  const q = L.buildContextQuestion("what does it mean?", ctx, {});
  assert.strictEqual(q, '[Context from my browser tab \u2014 Page: "Doc" (https://x.io/p). Selected text: "some selected text"] My question: what does it mean?');
  assert.ok(!/\n/.test(q));
  assert.ok(!/Selected text/.test(L.buildContextQuestion("q", ctx, { includeSelection: false })));
  assert.ok(!/Page:/.test(L.buildContextQuestion("q", ctx, { includePage: false })));
  assert.strictEqual(L.buildContextQuestion("q", ctx, { includePage: false, includeSelection: false }), "q");
  assert.strictEqual(L.buildContextQuestion("plain", null, {}), "plain");
  assert.strictEqual(L.buildContextQuestion("q", { url: "chrome://settings", title: "T" }, {}), "q"); // internal pages are never shared
  assert.strictEqual(L.buildContextQuestion("q", { url: "javascript:alert(1)" }, {}), "q");
  assert.ok(L.buildContextQuestion("q", { url: "https://x.io", selection: "s".repeat(9000) }, {}).length < 2300);
  assert.ok(L.buildContextQuestion("q".repeat(5000), null, {}).length <= L.MAX_QUESTION + 1);
});

test("buildSummaryQuestion uses the same wording as the context menu; empty for unshareable pages", () => {
  assert.strictEqual(L.buildSummaryQuestion({ url: "https://x.io/a", title: "T" }), 'Read and summarize this page: "T" (https://x.io/a)');
  assert.strictEqual(L.buildSummaryQuestion({ url: "about:blank" }), "");
  assert.strictEqual(L.buildSummaryQuestion(null), "");
});

test("frameRules: strips frame-blocking headers only for sub-frames initiated by this extension, both sites", () => {
  const [r] = L.frameRules("abcdefg");
  assert.strictEqual(r.action.type, "modifyHeaders");
  assert.deepStrictEqual(r.condition.resourceTypes, ["sub_frame"]);
  assert.deepStrictEqual(r.condition.initiatorDomains, ["abcdefg"]);
  assert.deepStrictEqual(r.condition.requestDomains, ["ai.spaincos.com", "boundview.com"]);
  const hdr = Object.fromEntries(r.action.responseHeaders.map((h) => [h.header, h]));
  assert.strictEqual(hdr["x-frame-options"].operation, "remove");
  assert.ok(/object-src 'none'/.test(hdr["content-security-policy"].value) && !/frame-ancestors/.test(hdr["content-security-policy"].value));
});

test("sanitizeModelOptions drops malformed entries", () => {
  const out = L.sanitizeModelOptions([{ value: "kimi", label: "Kimi" }, { value: "bad value" }, null, { value: 3 }, { value: "r1" }]);
  assert.deepStrictEqual(out, [{ value: "kimi", label: "Kimi" }, { value: "r1", label: "r1" }]);
  assert.deepStrictEqual(L.sanitizeModelOptions("x"), []);
});

// ---------------------------------------------------------------- service worker (vm + chrome mock)
function makeChrome(store = {}) {
  const calls = { menus: [], created: [], dnr: [], open: [], tabs: [] };
  const ev = () => ({ addListener(fn) { this.fn = fn; } });
  const area = (data) => ({ data, async get(k) { if (typeof k === "string") return k in data ? { [k]: data[k] } : {}; const o = {}; for (const x of [].concat(k)) if (x in data) o[x] = data[x]; return o; }, async set(o) { Object.assign(data, o); }, async remove(k) { delete data[k]; }, setAccessLevel: async () => {} });
  const chrome = {
    runtime: { id: "extid123", getManifest: () => ({ version: "1.2.0" }), onInstalled: ev(), onStartup: ev(), lastError: null },
    contextMenus: { removeAll: (cb) => cb(), create: (m) => calls.menus.push(m), onClicked: ev() },
    sidePanel: { setPanelBehavior: async () => {}, open: (o) => { calls.open.push(o); return Promise.resolve(); } },
    action: { onClicked: ev(), setBadgeText() {}, setBadgeBackgroundColor() {} },
    alarms: { create() {}, onAlarm: ev() },
    notifications: { create() {}, onClicked: ev() },
    downloads: { download() {} },
    commands: { onCommand: ev() },
    tabs: { create: (o) => calls.tabs.push(o) },
    declarativeNetRequest: { updateDynamicRules: async (o) => { calls.dnr.push(o); } },
    storage: { local: area(store.local || {}), session: area(store.session || {}) }
  };
  return { chrome, calls };
}
function loadSW(store) {
  const { chrome, calls } = makeChrome(store);
  const ctx = { chrome, fetch: async () => ({ ok: false }), console, setTimeout, importScripts: (f) => vm.runInContext(read(f), ctx, { filename: f }) };
  ctx.self = ctx; vm.createContext(ctx);
  vm.runInContext(read("background.js"), ctx, { filename: "background.js" });
  return { chrome, calls, ctx };
}

test("service worker: installs the frame-header rule on every start with its own extension id", async () => {
  const { calls } = loadSW();
  await tick(5);
  assert.strictEqual(calls.dnr.length, 1);
  eq(calls.dnr[0].removeRuleIds, [1]);
  eq(calls.dnr[0].addRules[0].condition.initiatorDomains, ["extid123"]);
});

test("service worker: context menu opens the side panel synchronously and stores one pending ask", async () => {
  const { chrome, calls } = loadSW();
  chrome.contextMenus.onClicked.fn({ menuItemId: "ask-page", pageUrl: "https://x.io/a" }, { id: 7, url: "https://x.io/a", title: "T" });
  eq(calls.open, [{ tabId: 7 }]); // sync, inside the user gesture
  await tick(5);
  const { pendingAsk } = await chrome.storage.session.get("pendingAsk");
  assert.strictEqual(pendingAsk.text, 'Read and summarize this page: "T" (https://x.io/a)');
  chrome.contextMenus.onClicked.fn({ menuItemId: "other" }, { id: 7 });
  assert.strictEqual(calls.open.length, 1);
});

test("service worker: summarize shortcut works on http(s) only; tab fallback follows the chosen site", async () => {
  const { chrome, calls } = loadSW({ local: { settings: { site: "https://boundview.com", model: "kimi" } } });
  chrome.commands.onCommand.fn("summarize-page", { id: 3, url: "chrome://extensions", title: "x" });
  assert.strictEqual(calls.open.length, 0);
  chrome.commands.onCommand.fn("summarize-page", { id: 3, url: "https://x.io/", title: "x" });
  assert.strictEqual(calls.open.length, 1);
  chrome.sidePanel.open = () => Promise.reject(new Error("no panel")); // browsers without the side panel -> tab fallback
  chrome.commands.onCommand.fn("summarize-page", { id: 3, url: "https://x.io/", title: "x" });
  await tick(20);
  eq(calls.tabs, [{ url: "https://boundview.com/" }]);
  const { pendingAsk } = await chrome.storage.session.get("pendingAsk");
  assert.strictEqual(pendingAsk.target, "tab");
});

test("service worker: corrupted stored site never reaches chrome.tabs.create", async () => {
  const { chrome, calls } = loadSW({ local: { settings: { site: "https://evil.example" } } });
  chrome.commands.onCommand.fn("open-sidepanel", { id: undefined });
  await tick(20);
  eq(calls.tabs, [{ url: "https://ai.spaincos.com/" }]);
});

// ---------------------------------------------------------------- side panel (jsdom)
async function loadPanel({ local = {}, tab = { id: 5, url: "https://x.io/post", title: "A Post" }, selection = "", scriptingFails = false } = {}) {
  const dom = new JSDOM(read("sidepanel.html"), { runScripts: "outside-only", url: "chrome-extension://extid123/sidepanel.html", pretendToBeVisual: true });
  openDoms.push(dom);
  const w = dom.window;
  const store = { local: { ...local }, session: {} };
  const { chrome } = makeChrome(store);
  const listeners = [];
  chrome.storage.onChanged = { addListener: (f) => listeners.push(f) };
  chrome.tabs = { query: async () => (tab ? [tab] : []), create: (o) => (chrome.__tabs = chrome.__tabs || []).push(o), onActivated: { addListener() {} }, onUpdated: { addListener() {} } };
  chrome.scripting = { executeScript: async () => { if (scriptingFails) throw new Error("no access"); return [{ result: selection }]; } };
  chrome.permissions = { request: async (p) => { chrome.__perm = p; return true; }, onAdded: { addListener() {} } };
  w.chrome = chrome;
  w.eval(read("lib.js"));
  const posted = [];
  // jsdom swaps the iframe's window on navigation and drops cross-origin postMessage, so stand in a recording window.
  const fakeWin = { postMessage: (data, origin) => posted.push({ data, origin }), close() {} };
  const frame = w.document.getElementById("site");
  Object.defineProperty(frame, "contentWindow", { get: () => fakeWin });
  w.eval(read("sidepanel.js"));
  await w.__aiscPanel.ready;
  const fire = (origin, source, data) => { const ev = new w.Event("message"); Object.defineProperties(ev, { origin: { value: origin }, source: { value: source }, data: { value: data } }); w.dispatchEvent(ev); };
  return { w, doc: w.document, chrome, store, posted, frame, fakeWin, fire, listeners, close: () => dom.window.close() };
}

test("panel: shows the active tab's title/host and labelled selection; preview shows exactly what will be sent", jsd, async () => {
  const p = await loadPanel({ selection: "interesting passage" });
  assert.match(p.doc.getElementById("ctxTitle").textContent, /A Post \u2014 x\.io/);
  assert.strictEqual(p.doc.querySelector("#ctx .tag").textContent, "Page context");
  assert.strictEqual(p.doc.getElementById("ctxSelRow").hidden, false);
  assert.match(p.doc.getElementById("ctxSel").textContent, /interesting passage/);
  p.doc.getElementById("askInput").value = "why?";
  p.doc.getElementById("askInput").dispatchEvent(new p.w.Event("input"));
  assert.match(p.doc.getElementById("preview").textContent, /^Will send: \[Context from my browser tab/);
  assert.strictEqual(p.frame.src, "https://ai.spaincos.com/");
  p.close();
});

test("panel: Ask sends the labelled context question through the same bridge message as menu asks", jsd, async () => {
  const p = await loadPanel({ selection: "quote me" });
  p.doc.getElementById("askInput").value = "explain";
  p.doc.getElementById("askForm").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await tick(650);
  assert.ok(p.posted.length >= 1);
  const m = p.posted[0];
  assert.strictEqual(m.origin, "https://ai.spaincos.com");
  assert.strictEqual(m.data.source, "aispaincos-ext");
  assert.strictEqual(m.data.type, "ask");
  assert.strictEqual(m.data.submit, true);
  assert.strictEqual(m.data.text, '[Context from my browser tab \u2014 Page: "A Post" (https://x.io/post). Selected text: "quote me"] My question: explain');
  assert.strictEqual(p.doc.getElementById("askInput").value, "");
  // bridge ack stops the retries and clears the pending slot
  p.fire("https://ai.spaincos.com", p.fakeWin, { source: "aispaincos-bridge", type: "ack", id: m.data.id });
  const n = p.posted.length; await tick(700);
  assert.strictEqual(p.posted.length, n);
  p.close();
});

test("panel: include toggles change the question and persist", jsd, async () => {
  const p = await loadPanel({ selection: "sel" });
  const inc = p.doc.getElementById("incSel"); inc.checked = false; inc.dispatchEvent(new p.w.Event("change"));
  await tick(5);
  assert.strictEqual(p.store.local.settings.includeSelection, false);
  p.doc.getElementById("askInput").value = "q";
  p.doc.getElementById("askForm").dispatchEvent(new p.w.Event("submit", { cancelable: true }));
  await tick(650);
  assert.ok(!/Selected text/.test(p.posted[0].data.text) && /Page: "A Post"/.test(p.posted[0].data.text));
  p.close();
});

test("panel: Summarize page is one click and uses the shared summary wording", jsd, async () => {
  const p = await loadPanel();
  assert.strictEqual(p.doc.getElementById("sumBtn").disabled, false);
  p.doc.getElementById("sumBtn").click();
  await tick(650);
  assert.strictEqual(p.posted[0].data.text, 'Read and summarize this page: "A Post" (https://x.io/post)');
  p.close();
});

test("panel: tab without access shows an explanation + grant button; grant requests optional host permissions", jsd, async () => {
  const p = await loadPanel({ tab: { id: 9 } });
  assert.strictEqual(p.doc.getElementById("sumBtn").disabled, true);
  assert.strictEqual(p.doc.getElementById("grantBtn").hidden, false);
  p.doc.getElementById("grantBtn").click(); await tick(10);
  eq(p.chrome.__perm, { origins: ["https://*/*", "http://*/*"] });
  p.close();
});

test("panel: internal pages are never shared; selection read failure degrades to page-only", jsd, async () => {
  let p = await loadPanel({ tab: { id: 1, url: "chrome://extensions", title: "Ext" } });
  assert.strictEqual(p.doc.getElementById("sumBtn").disabled, true);
  assert.match(p.doc.getElementById("ctxHintText").textContent, /Browser-internal/);
  p.close();
  p = await loadPanel({ scriptingFails: true });
  assert.strictEqual(p.w.__aiscPanel.getContext().state, "ok");
  assert.strictEqual(p.doc.getElementById("ctxSelRow").hidden, true);
  p.close();
});

test("panel: settings persist to chrome.storage.local and are restored on next open", jsd, async () => {
  const p = await loadPanel();
  p.doc.getElementById("modelSel").add(new p.w.Option("Kimi", "kimi")); // as published by the bridge
  const ms = p.doc.getElementById("modelSel"); ms.value = "kimi"; ms.dispatchEvent(new p.w.Event("change"));
  await tick(5);
  assert.strictEqual(p.store.local.settings.model, "kimi");
  const ss = p.doc.getElementById("siteSel"); ss.value = "https://boundview.com"; ss.dispatchEvent(new p.w.Event("change"));
  await tick(5);
  assert.strictEqual(p.store.local.settings.site, "https://boundview.com");
  assert.strictEqual(p.frame.src, "https://boundview.com/");
  const saved = JSON.parse(JSON.stringify(p.store.local));
  p.close();
  const q = await loadPanel({ local: saved });
  assert.strictEqual(q.frame.src, "https://boundview.com/");
  assert.strictEqual(q.doc.getElementById("siteSel").value, "https://boundview.com");
  assert.strictEqual(q.doc.getElementById("modelSel").value, "kimi"); // kept (as "saved") even before the site list arrives
  q.close();
});

test("panel: model list comes from the bridge-published options for the current site only", jsd, async () => {
  const opts = { origin: "https://ai.spaincos.com", options: [{ value: "general", label: "Auto" }, { value: "kimi", label: "Kimi K3.1" }, { value: "bad val", label: "x" }] };
  const p = await loadPanel({ local: { modelOptions: opts } });
  assert.deepStrictEqual([...p.doc.getElementById("modelSel").options].map((o) => o.value), ["", "general", "kimi"]); // values are strings: realm-safe
  const q = await loadPanel({ local: { modelOptions: opts, settings: { site: "https://boundview.com" } } });
  assert.deepStrictEqual([...q.doc.getElementById("modelSel").options].map((o) => o.value), [""]); // list is for the other origin
  p.close(); q.close();
});

test("panel: ignores bridge messages from the wrong origin or window", jsd, async () => {
  const p = await loadPanel();
  p.fire("https://evil.example", p.fakeWin, { source: "aispaincos-bridge", type: "ready" });
  p.fire("https://ai.spaincos.com", p.w, { source: "aispaincos-bridge", type: "ready" });
  p.chrome.storage.session.data.pendingAsk = { id: "m1", text: "hello", ts: Date.now() };
  await tick(650);
  assert.strictEqual(p.posted.length, 0); // nothing was delivered by the spoofed ready events
  p.close();
});

// ---------------------------------------------------------------- site-bridge (jsdom, tab-fallback path)
test("site-bridge: applies the chosen model via the site's change event, publishes model list, then submits", jsd, async () => {
  const html = `<!doctype html><body><select id="modelSel"><option value="general">Auto</option><option value="kimi">Kimi</option></select><input id="landingInput"></body>`;
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://boundview.com/", pretendToBeVisual: true });
  const w = dom.window; openDoms.push(dom);
  Object.defineProperty(w.HTMLElement.prototype, "offsetParent", { get() { return this.ownerDocument.body; } }); // jsdom has no layout
  const store = { local: { settings: { model: "kimi" } }, session: { pendingAsk: { id: "t1", text: "hello there", ts: Date.now(), target: "tab" } } };
  const { chrome } = makeChrome(store);
  chrome.runtime.id = "extid123";
  chrome.storage.onChanged = { addListener() {} };
  const wrapGet = (area) => { const g = area.get.bind(area); area.get = (k, cb) => { const pr = g(k); return cb ? (pr.then(cb), undefined) : pr; }; };
  wrapGet(chrome.storage.local); wrapGet(chrome.storage.session);
  w.chrome = chrome;
  const events = [];
  w.document.getElementById("modelSel").addEventListener("change", () => events.push("change:" + w.document.getElementById("modelSel").value));
  w.document.getElementById("landingInput").addEventListener("keydown", (e) => events.push("enter:" + e.key + ":" + e.target.value));
  w.eval(read("site-bridge.js"));
  w.dispatchEvent(new w.Event("load"));
  await tick(500);
  assert.deepStrictEqual(events, ["change:kimi", "enter:Enter:hello there"]);
  eq(store.local.modelOptions, { origin: "https://boundview.com", options: [{ value: "general", label: "Auto" }, { value: "kimi", label: "Kimi" }] });
  assert.strictEqual(store.session.pendingAsk, undefined); // consumed once
  dom.window.close();
});

test("site-bridge: unknown model value in settings is ignored (never forced onto the site)", jsd, async () => {
  const dom = new JSDOM(`<!doctype html><body><select id="modelSel"><option value="general">Auto</option></select><input id="landingInput"></body>`, { runScripts: "outside-only", url: "https://ai.spaincos.com/" });
  const w = dom.window; openDoms.push(dom);
  Object.defineProperty(w.HTMLElement.prototype, "offsetParent", { get() { return this.ownerDocument.body; } });
  const store = { local: { settings: { model: "nope" } }, session: { pendingAsk: { id: "t2", text: "x", ts: Date.now(), target: "tab" } } };
  const { chrome } = makeChrome(store); chrome.storage.onChanged = { addListener() {} };
  w.chrome = chrome;
  w.eval(read("site-bridge.js")); w.dispatchEvent(new w.Event("load"));
  await tick(400);
  assert.strictEqual(w.document.getElementById("modelSel").value, "general");
  assert.strictEqual(w.document.getElementById("landingInput").value, "x");
  dom.window.close();
});
