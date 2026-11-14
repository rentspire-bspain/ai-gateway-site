// Unit tests for Artifact Library (34d) in modules/library.js + modules/artifact-library.js.
// Run: node --test modules/artifact-library.test.js
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const LIB_SRC = fs.readFileSync(path.join(__dirname, "library.js"), "utf8");
const ENTRY_SRC = fs.readFileSync(path.join(__dirname, "artifact-library.js"), "utf8");

function makeEnv(opts = {}) {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null
  };

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

  const navLibrary = makeEl("button");
  navLibrary.id = "navLibrary";
  const sideNav = makeEl("div");
  sideNav.appendChild(navLibrary);
  const moduleRoot = makeEl("div");
  moduleRoot.id = "moduleRoot";

  const byId = { navLibrary, moduleRoot };
  const registeredPanes = [];
  const submittedQueries = [];
  const openedArtifacts = [];
  let settingsClosed = 0;

  const document = {
    readyState: "complete",
    body: makeEl("body"),
    createElement: (tag) => makeEl(tag),
    getElementById: (id) => byId[id] || null,
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const session = opts.session !== undefined ? opts.session : {
    access_token: "jwt-tok-123",
    user: { id: "user-uuid-42" }
  };

  const windowObj = {
    localStorage,
    document,
    crypto: { randomUUID: () => "uuid-1" },
    innerWidth: 1440,
    innerHeight: 900,
    SUPABASE_URL: "https://bnxermyboeigvwonfrzx.supabase.co",
    SUPABASE_ANON: "sb_publishable_test_anon",
    __appGlobals: {
      sb: {
        supabaseUrl: "https://bnxermyboeigvwonfrzx.supabase.co",
        supabaseKey: "sb_publishable_test_anon",
        auth: {
          getSession: async () => ({ data: { session } })
        }
      },
      currentUser: session ? session.user : null,
      currentThreadId: opts.currentThreadId || "thread-1",
      threads: opts.threads || []
    },
    submitQuery: (q) => { submittedQueries.push(q); },
    ArtifactPanel: {
      open: (item) => { openedArtifacts.push(item); }
    },
    SettingsUI: {
      registerPane: (p) => { registeredPanes.push(p); },
      close: () => { settingsClosed++; }
    },
    loadModule: async () => windowObj.LibraryUI,
    openModule: (name, global, method, arg) => {
      if (windowObj[global] && typeof windowObj[global][method] === "function") {
        windowObj[global][method](arg);
      }
    }
  };

  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url: String(url), init });
    if (typeof opts.onFetch === "function") return opts.onFetch(String(url), init);
    return { ok: true, status: 200, json: async () => [], arrayBuffer: async () => new ArrayBuffer(0) };
  };

  const ctx = vm.createContext({
    window: windowObj,
    document,
    localStorage,
    fetch: fetchImpl,
    TextDecoder,
    TextEncoder,
    Uint8Array,
    ArrayBuffer,
    Event: class Event { constructor(t) { this.type = t; } },
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

  vm.runInContext(LIB_SRC, ctx, { filename: "library.js" });
  vm.runInContext(ENTRY_SRC, ctx, { filename: "artifact-library.js" });

  return {
    window: windowObj,
    sideNav,
    fetchCalls,
    registeredPanes,
    submittedQueries,
    openedArtifacts,
    getSettingsClosed: () => settingsClosed
  };
}

let env;
beforeEach(() => {
  env = makeEnv();
});

test("wires sidebar #navArtifacts button and Settings 'artifacts' pane without inline script changes", () => {
  const injected = env.sideNav.children.find((c) => c.id === "navArtifacts");
  assert.ok(injected, "expected #navArtifacts button in .side-nav");
  assert.ok(injected.innerHTML.includes("Artifacts"));
  assert.equal(env.registeredPanes.length, 1);
  assert.equal(env.registeredPanes[0].id, "artifacts");
  assert.equal(env.registeredPanes[0].label, "Artifacts");
  assert.ok(env.registeredPanes[0].icon.includes("<path"), "Settings icon must be raw SVG path markup");
});

test("groupArtifacts filters placeholders, groups by filename, and sorts by last-modified descending", () => {
  const raw = [
    { name: ".emptyFolderPlaceholder", id: null, metadata: null },
    { name: "subfolder", id: null, metadata: null },
    {
      name: "q3-report.md",
      id: "1",
      version: "v1",
      created_at: "2026-11-10T10:00:00.000Z",
      updated_at: "2026-11-10T10:00:00.000Z",
      metadata: { size: 1200, mimetype: "text/markdown" }
    },
    {
      name: "archive/Q3-Report.md",
      id: "2",
      version: "v2",
      created_at: "2026-11-12T08:00:00.000Z",
      updated_at: "2026-11-13T15:30:00.000Z",
      metadata: { size: 1850, mimetype: "text/markdown" }
    },
    {
      name: "deliverable.xlsx",
      id: "3",
      version: "v3",
      created_at: "2026-11-14T00:27:21.394Z",
      updated_at: "2026-11-14T00:27:21.394Z",
      metadata: { size: 2611, mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    }
  ];
  const threads = [
    { id: "t-99", title: "Q3 Financial Analysis", messages: [{ role: "assistant", content: "Saved [q3-report.md](https://example.com/q3-report.md)" }] }
  ];
  const grouped = env.window.LibraryUI.groupArtifacts(raw, "user-uuid-42", threads);
  assert.equal(grouped.length, 2);

  assert.equal(grouped[0].filename, "deliverable.xlsx");
  assert.equal(grouped[0].kind, "xlsx");
  assert.equal(grouped[0].kindLabel, "Spreadsheet");
  assert.equal(grouped[0].storagePath, "artifacts/user-uuid-42/deliverable.xlsx");
  assert.equal(grouped[0].size, 2611);

  assert.equal(grouped[1].filename, "Q3-Report.md");
  assert.equal(grouped[1].kind, "md");
  assert.equal(grouped[1].versionCount, 2);
  assert.equal(grouped[1].wasUpdated, true);
  assert.equal(grouped[1].storagePath, "artifacts/user-uuid-42/archive/Q3-Report.md");
  assert.equal(grouped[1].threads.length, 1);
  assert.equal(grouped[1].threads[0].id, "t-99");
});

test("listArtifacts posts to /storage/v1/object/list/gateway-assets with prefix artifacts/<userId>/", async () => {
  env = makeEnv({
    onFetch: async (url, init) => {
      assert.equal(url, "https://bnxermyboeigvwonfrzx.supabase.co/storage/v1/object/list/gateway-assets");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer jwt-tok-123");
      assert.equal(init.headers.apikey, "sb_publishable_test_anon");
      const body = JSON.parse(init.body);
      assert.equal(body.prefix, "artifacts/user-uuid-42/");
      assert.deepEqual(body.sortBy, { column: "updated_at", order: "desc" });
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            name: "market-memo.docx",
            id: "doc-1",
            version: "ver-1",
            created_at: "2026-11-13T01:00:00.000Z",
            updated_at: "2026-11-13T05:00:00.000Z",
            metadata: { size: 4096, mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
          }
        ]
      };
    }
  });

  const items = await env.window.LibraryUI.listArtifacts();
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(items.length, 1);
  assert.equal(items[0].filename, "market-memo.docx");
  assert.equal(items[0].kind, "docx");
  assert.equal(items[0].wasUpdated, true);
});

test("openArtifact fetches markdown text and opens ArtifactPanel, closing overlays first", async () => {
  const mdBytes = new TextEncoder().encode("# Rent Comps\n\nUpdated figures.");
  env = makeEnv({
    onFetch: async (url) => {
      assert.equal(url, "https://bnxermyboeigvwonfrzx.supabase.co/storage/v1/object/gateway-assets/artifacts/user-uuid-42/rent-comps.md");
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => mdBytes.buffer.slice(mdBytes.byteOffset, mdBytes.byteOffset + mdBytes.byteLength)
      };
    }
  });

  const item = await env.window.LibraryUI.openArtifact({
    filename: "rent-comps.md",
    storagePath: "artifacts/user-uuid-42/rent-comps.md",
    kind: "md",
    size: mdBytes.byteLength
  });

  assert.equal(env.openedArtifacts.length, 1);
  assert.equal(item.name, "rent-comps.md");
  assert.equal(item.title, "rent-comps");
  assert.equal(item.kind, "md");
  assert.equal(item.text, "# Rent Comps\n\nUpdated figures.");
  assert.equal(env.getSettingsClosed(), 1);
});

test("openArtifact falls back to signed URL when direct object GET fails", async () => {
  const bin = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  env = makeEnv({
    onFetch: async (url, init) => {
      if (url.includes("/storage/v1/object/gateway-assets/")) {
        return { ok: false, status: 400 };
      }
      if (url.includes("?token=abc")) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => bin.buffer
        };
      }
      if (url.includes("/storage/v1/object/sign/gateway-assets/")) {
        assert.equal(init.method, "POST");
        return {
          ok: true,
          status: 200,
          json: async () => ({ signedURL: "/object/sign/gateway-assets/artifacts/user-uuid-42/deliverable.xlsx?token=abc" })
        };
      }
      throw new Error("Unexpected URL: " + url);
    }
  });

  const item = await env.window.LibraryUI.openArtifact({
    filename: "deliverable.xlsx",
    storagePath: "artifacts/user-uuid-42/deliverable.xlsx",
    kind: "xlsx",
    size: 4
  });

  assert.equal(env.openedArtifacts.length, 1);
  assert.equal(item.kind, "xlsx");
  assert.equal(item.text, undefined);
  assert.equal(item.bytes.byteLength, 4);
});

test("regenerateArtifact sends exact prompt 'Regenerate <filename> with the latest data' to current thread", () => {
  const sent = env.window.LibraryUI.regenerateArtifact({ filename: "deliverable.xlsx" });
  assert.equal(sent, "Regenerate deliverable.xlsx with the latest data");
  assert.deepEqual(env.submittedQueries, ["Regenerate deliverable.xlsx with the latest data"]);
  assert.equal(env.getSettingsClosed(), 1);
});
