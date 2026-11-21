"use strict";
// Plain-node tests for the pure launch helpers + manifest/service-worker wiring. Run: node --test tests/desktop-shell.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { parseLaunch, shareText } = require("../modules/desktop-shell.js");
const root = path.join(__dirname, "..");

test("share target: text/title/url combine, never empty-throw", () => {
  assert.strictEqual(shareText({ text: "hello" }), "hello");
  assert.strictEqual(shareText({ title: "T", url: "https://x.io/a" }), "T\nhttps://x.io/a");
  assert.strictEqual(shareText({ text: "see https://x.io/a", url: "https://x.io/a" }), "see https://x.io/a");
  assert.strictEqual(shareText({}), "");
  assert.strictEqual(shareText({ text: "a".repeat(9000) }).length, 4000);
});

test("parseLaunch: q, share params, intents, hotkey, protocol", () => {
  assert.deepStrictEqual(parseLaunch("/?q=hi%20there"), { q: "hi there", intent: "", source: "" });
  assert.strictEqual(parseLaunch("/?source=pwa-shortcut&intent=settings").intent, "settings");
  assert.strictEqual(parseLaunch("/?intent=new").intent, "new");
  assert.strictEqual(parseLaunch("/#search").intent, "search");
  assert.strictEqual(parseLaunch("/#settings").intent, "settings");
  assert.strictEqual(parseLaunch("/?intent=<script>").intent, "");
  assert.strictEqual(parseLaunch("/?source=desktop-hotkey").intent, "focus");
  assert.strictEqual(parseLaunch("/?q=" + encodeURIComponent("web+aispaincos:what%20is%20rust")).q, "what is rust");
  assert.strictEqual(parseLaunch("/?title=A&url=https%3A%2F%2Fx.io").q, "A\nhttps://x.io");
  assert.deepStrictEqual(parseLaunch("::not a url::", "not-a-base"), { q: "", intent: "", source: "" });
  assert.deepStrictEqual(parseLaunch("/?tasks=inbox"), { q: "", intent: "", source: "" });
});

test("manifest: every declared entry point is handled and the manifest is valid", () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  assert.ok(m.launch_handler && m.protocol_handlers.length && m.file_handlers.length && m.categories.length);
  for (const s of m.shortcuts) { const l = parseLaunch(s.url); assert.ok(l.intent, "shortcut has intent: " + s.url); assert.ok(s.icons && s.icons.length); }
  const p = m.protocol_handlers[0]; assert.ok(p.url.includes("%s") && /^web\+/.test(p.protocol));
  const sp = m.share_target.params; assert.strictEqual(sp.text, "q");
  const launched = parseLaunch(m.share_target.action + "?title=T&" + sp.text + "=body&url=https%3A%2F%2Fa.b");
  assert.ok(launched.q.includes("body"));
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(root, i.src.replace(/^\//, ""))), "icon exists " + i.src);
});

test("service worker precaches offline.html and bumped version; index loads the shell", () => {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.ok(/shell-"|CACHE_PREFIX \+ "3"/.test(sw) && sw.includes("./offline.html"));
  assert.ok(fs.existsSync(path.join(root, "offline.html")));
  const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(idx.includes("/modules/desktop-shell.js") && idx.includes("/modules/desktop-shell.css"));
  assert.ok(!idx.includes("installAppBtn"), "legacy duplicate install button removed");
});
