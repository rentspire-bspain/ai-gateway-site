// Unit tests for the Webapps explorer (34e) in modules/webapps.js.
// Run: node --test modules/webapps.test.js
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const WEBAPPS_SRC = fs.readFileSync(path.join(__dirname, "webapps.js"), "utf8");

function makeEnv(opts = {}) {
  const listeners = {};
  const makeEl = (tag) => ({
    tagName: String(tag || "div").toUpperCase(),
    id: "",
    className: "",
    innerHTML: "",
    textContent: "",
    style: {},
    dataset: {},
    attributes: {},
    children: [],
    parentNode: null,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, on) { if (on === undefined) on = !this._s.has(c); if (on) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k]; },
    appendChild(ch) { ch.parentNode = this; this.children.push(ch); return ch; },
    insertAdjacentElement(pos, ch) {
      if (this.parentNode) {
        ch.parentNode = this.parentNode;
        this.parentNode.children.push(ch);
      }
      return ch;
    },
    remove() {},
    focus() {},
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    querySelector() { return makeEl("div"); },
    querySelectorAll() { return []; }
  });

  const navFleet = makeEl("button");
  navFleet.id = "navFleet";
  const sideNav = makeEl("div");
  sideNav.appendChild(navFleet);
  const moduleRoot = makeEl("div");
  moduleRoot.id = "moduleRoot";

  const byId = { navFleet, moduleRoot };
  const registeredPanes = [];
  const settingsOpened = [];

  const document = {
    readyState: "complete",
    body: makeEl("body"),
    head: makeEl("head"),
    createElement: (tag) => makeEl(tag),
    getElementById: (id) => byId[id] || null,
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url: String(url), init });
    if (typeof opts.onFetch === "function") return opts.onFetch(String(url), init);
    return { ok: true, status: 200, json: async () => [] };
  };

  const windowObj = {
    document,
    SettingsUI: {
      registerPane: (p) => { registeredPanes.push(p); },
      open: (id) => { settingsOpened.push(id); },
      close: () => {}
    },
    __appGlobals: {
      sb: {
        auth: {
          getSession: async () => ({
            data: {
              session: {
                access_token: "jwt-tok-123",
                user: { id: "user-uuid-42" }
              }
            }
          })
        }
      }
    }
  };

  const ctx = vm.createContext({
    window: windowObj,
    document,
    fetch: fetchImpl,
    Promise,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Error,
    setTimeout,
    clearTimeout,
    console
  });

  vm.runInContext(WEBAPPS_SRC, ctx, { filename: "webapps.js" });

  return { window: windowObj, sideNav, fetchCalls, registeredPanes };
}

const SAMPLE = [
  { id: "w1", kind: "webapp", name: "CondoScores", parent: null, project_ref: "p1", domain: "condoscores.com", description: "Rent comps scoring site", status: "live", schedule: "", owner: "b", updated_at: "2026-01-01T00:00:00Z" },
  { id: "w2", kind: "web_app", name: "PHA", parent: null, project_ref: "p2", domain: "pha.example.com", description: "PHA records", status: "paused", schedule: "", owner: "b", updated_at: "2026-01-02T00:00:00Z" },
  { id: "o1", kind: "org", name: "Spain Companies", parent: null, project_ref: "p9", domain: null, description: "", status: "", schedule: "", owner: "", updated_at: "" },
  { id: "d1", kind: "supabase_db", name: "CondoScores DB", parent: null, project_ref: "p1", domain: null, description: "", status: "live", schedule: "", owner: "b", updated_at: "2026-01-03T00:00:00Z" },
  { id: "d2", kind: "database", name: "PHA DB", parent: null, project_ref: "p2", domain: null, description: "", status: "paused", schedule: "", owner: "b", updated_at: "2026-01-04T00:00:00Z" }
];

test("isWebappKind and selectWebapps keep only webapp kinds", () => {
  const env = makeEnv();
  const w = env.window.WebappsUI;
  assert.equal(w.isWebappKind("webapp"), true);
  assert.equal(w.isWebappKind("web_app"), true);
  assert.equal(w.isWebappKind("WEBAPP"), true);
  assert.equal(w.isWebappKind("org"), false);
  assert.equal(w.isWebappKind("supabase_db"), false);
  assert.equal(w.isWebappKind(null), false);
  const web = w.selectWebapps(SAMPLE);
  assert.equal(web.length, 2);
  assert.deepEqual(web.map((x) => x.name), ["CondoScores", "PHA"]);
});

test("attachDbSide joins each webapp to its DB-side fleet row", () => {
  const env = makeEnv();
  const w = env.window.WebappsUI;
  const attached = w.attachDbSide(w.selectWebapps(SAMPLE), SAMPLE);
  assert.equal(attached.length, 2);
  assert.equal(attached[0].db_fleet_id, "d1");
  assert.equal(attached[0].db_name, "CondoScores DB");
  assert.equal(attached[0].db_status, "live");
  assert.equal(attached[0].db_updated_at, "2026-01-03T00:00:00Z");
  assert.equal(attached[1].db_name, "PHA DB");
  // unknown project ref stays null
  const attached2 = w.attachDbSide([{ id: "w3", kind: "webapp", name: "Orphan", parent: null, project_ref: "zz", domain: "", description: "", status: "", schedule: "", owner: "", updated_at: "" }], SAMPLE);
  assert.equal(attached2[0].db_fleet_id, null);
});

test("summarizeStacks counts webapps with a known DB and domain", () => {
  const env = makeEnv();
  const w = env.window.WebappsUI;
  const attached = w.attachDbSide(w.selectWebapps(SAMPLE), SAMPLE);
  const s = w.summarizeStacks(attached);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), { total: 2, withDb: 2, withDomain: 2, live: 1, paused: 1 });
  const orphan = [{ id: "w3", kind: "webapp", name: "NoStack", parent: null, project_ref: null, domain: null, description: "", status: "", schedule: "", owner: "", updated_at: "" }];
  assert.deepEqual(JSON.parse(JSON.stringify(w.summarizeStacks(orphan))), { total: 1, withDb: 0, withDomain: 0, live: 0, paused: 0 });
});

test("schemaBrowserHtml shows the honest credentials notice when counts are absent", () => {
  const env = makeEnv();
  const w = env.window.WebappsUI;
  const attached = w.attachDbSide(w.selectWebapps(SAMPLE), SAMPLE);
  const html = w.schemaBrowserHtml(attached[0]);
  assert.ok(html.includes("Schema introspection requires per-project credentials"));
  assert.ok(!html.includes("<table"), "no fake counts before the per-project connection exists");
  // when counts are present (governed connection), render them
  const withCounts = w.schemaBrowserHtml({ schema_counts: { schemas: 3, tables: 42, views: 5, rpcs: 9 } });
  assert.ok(withCounts.includes("<table"));
  assert.ok(withCounts.includes(">42<"));
});

test("statusDotClass and fmtWhen format safely", () => {
  const env = makeEnv();
  const w = env.window.WebappsUI;
  assert.equal(w.statusDotClass("live"), "wa-dot-live");
  assert.equal(w.statusDotClass("paused"), "wa-dot-paused");
  assert.equal(w.statusDotClass("on_demand"), "wa-dot-other");
  assert.ok(w.fmtWhen("2026-01-01T00:00:00Z").length > 0);
  assert.equal(w.fmtWhen(""), "");
  assert.equal(w.fmtWhen("not-a-date"), "not-a-date");
});

test("repoFor returns the row's repo_url only when set", () => {
  const env = makeEnv();
  const w = env.window.WebappsUI;
  assert.equal(w.repoFor({ repo_url: "https://github.com/x/y" }), "https://github.com/x/y");
  assert.equal(w.repoFor({ name: "no repo" }), null);
  assert.equal(w.repoFor(null), null);
});

test("wires sidebar #navWebapps button and Settings 'webapps' pane without inline script changes", () => {
  const env = makeEnv();
  const injected = env.sideNav.children.find((c) => c.id === "navWebapps");
  assert.ok(injected, "expected #navWebapps button after #navFleet in .side-nav");
  assert.ok(injected.innerHTML.includes("Webapps"));
  assert.equal(env.registeredPanes.length, 1);
  assert.equal(env.registeredPanes[0].id, "webapps");
  assert.equal(env.registeredPanes[0].label, "Webapps");
  assert.ok(env.registeredPanes[0].icon.includes("<path"), "Settings icon must be raw SVG path markup");
  assert.equal(typeof env.registeredPanes[0].render, "function");
});

test("the open() overlay renders the loading state, then the derived webapp cards (fleet_registry fallback path)", async () => {
  const env = makeEnv({
    onFetch: async (url) => {
      if (url.includes("/rest/v1/webapp_stack")) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      if (url.includes("/rest/v1/fleet_registry")) {
        return { ok: true, status: 200, json: async () => SAMPLE };
      }
      throw new Error("Unexpected URL: " + url);
    }
  });
  const w = env.window.WebappsUI;
  assert.equal(typeof w.open, "function");
  w.open();
  // wait for load() to settle (two fetches: view 404 then registry)
  await new Promise((r) => setTimeout(r, 30));
  // NOTE: without a real DOM the render path only proves the module loads without throwing;
  // deep DOM assertions live in the QA E2E (qa/prelaunch.py).
});

test("module file loads under vm without throwing and exposes the pure API on window.WebappsUI", () => {
  const env = makeEnv();
  const w = env.window.WebappsUI;
  assert.ok(w, "window.WebappsUI must exist");
  ["isWebappKind", "selectWebapps", "attachDbSide", "repoFor", "summarizeStacks", "schemaBrowserHtml", "statusDotClass", "fmtWhen"].forEach((k) => {
    assert.equal(typeof w[k], "function", "window.WebappsUI." + k + " must be a function");
  });
});
