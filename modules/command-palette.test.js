// node --test modules/command-palette.test.js
const test = require("node:test");
const assert = require("node:assert");
const cp = require("./command-palette.js");

/* ---------------- fuzzy matcher ---------------- */

test("fuzzyScore: empty query matches everything", () => {
  assert.equal(cp.fuzzyScore("", "New thread"), 1);
  assert.equal(cp.fuzzyScore(null, "New thread"), 1);
});

test("fuzzyScore: exact prefix beats substring beats subsequence", () => {
  const prefix = cp.fuzzyScore("new", "New thread");
  const substr = cp.fuzzyScore("thread", "New thread");
  const subseq = cp.fuzzyScore("nwt", "New thread");
  assert.ok(prefix > substr, `prefix (${prefix}) should beat substring (${substr})`);
  assert.ok(substr > subseq, `substring (${substr}) should beat subsequence (${subseq})`);
});

test("fuzzyScore: no match returns null", () => {
  assert.equal(cp.fuzzyScore("xyz", "New thread"), null);
  assert.equal(cp.fuzzyScore("q", ""), null);
  assert.equal(cp.fuzzyScore("zzz", "settings"), null);
});

test("fuzzyScore: subsequence must consume the whole query", () => {
  // "sett" is a subsequence of "settings" (s-e-t-t)
  assert.notEqual(cp.fuzzyScore("sett", "settings"), null);
  // "sss" is not (only two s's)
  assert.equal(cp.fuzzyScore("sss", "settings"), null);
});

test("fuzzyScore: case-insensitive", () => {
  assert.equal(cp.fuzzyScore("NEW", "new thread"), 1000);
  assert.notEqual(cp.fuzzyScore("Settings", "settings"), null);
});

test("fuzzyScore: word starts rank above mid-word letters", () => {
  const atWordStart = cp.fuzzyScore("nw", "new thread");
  const midWord = cp.fuzzyScore("nw", "anaw");
  assert.ok(atWordStart !== null && midWord !== null);
  assert.ok(atWordStart > midWord);
});

test("fuzzySearch: sorts best match first", () => {
  const entries = [
    { item: "Toggle theme", text: "Toggle theme" },
    { item: "Open Settings", text: "Open Settings" },
    { item: "New thread", text: "New thread" }
  ];
  const hits = cp.fuzzySearch("set", entries);
  assert.deepEqual(hits, ["Open Settings"]);
});

test("fuzzySearch: empty query returns everything in stable order", () => {
  const entries = [
    { item: "a", text: "New thread" },
    { item: "b", text: "Open Settings" }
  ];
  assert.deepEqual(cp.fuzzySearch("", entries), ["a", "b"]);
  assert.deepEqual(cp.fuzzySearch("   ", entries), ["a", "b"]);
});

test("fuzzySearch: matches keywords alongside names", () => {
  const entries = [
    { item: "new-thread", text: "New thread new chat start thread" },
    { item: "toggle-theme", text: "Toggle theme dark light" }
  ];
  const hits = cp.fuzzySearch("dark", entries);
  assert.deepEqual(hits, ["toggle-theme"]);
});

/* ---------------- action registry ---------------- */

test("buildActions: exposes every required action", () => {
  const ids = cp.buildActions().map((a) => a.id);
  [
    "new-thread", "search-threads", "open-settings", "settings-connectors",
    "settings-automations", "settings-skills", "settings-artifacts",
    "open-library", "open-fleet", "toggle-theme",
    "prompt-1", "prompt-2", "prompt-3"
  ].forEach((id) => assert.ok(ids.includes(id), `missing action: ${id}`));
});

test("buildActions: ids are unique and metadata is present", () => {
  const actions = cp.buildActions();
  const ids = new Set(actions.map((a) => a.id));
  assert.equal(ids.size, actions.length, "duplicate action ids");
  actions.forEach((a) => {
    assert.equal(typeof a.id, "string");
    assert.equal(typeof a.name, "string");
    assert.ok(a.name.length > 0);
    assert.ok(["Actions", "Research"].includes(a.section), `bad section: ${a.section}`);
    assert.equal(typeof a.keywords, "string");
    assert.equal(typeof a.run, "function");
  });
});

test("buildActions: registry is rebuilt fresh each call", () => {
  const a = cp.buildActions();
  const b = cp.buildActions();
  assert.notEqual(a, b);
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id));
});

test("research prompts are non-empty and submit via ctx.window.submitQuery", () => {
  assert.equal(cp.RESEARCH_PROMPTS.length, 3);
  cp.RESEARCH_PROMPTS.forEach((r) => {
    assert.ok(r.name.length > 0);
    assert.ok(r.prompt.length > 20);
  });
  const actions = cp.buildActions();
  const p1 = actions.find((a) => a.id === "prompt-1");
  let submitted = null;
  p1.run({ window: { submitQuery: (q) => { submitted = q; } } });
  assert.equal(submitted, cp.RESEARCH_PROMPTS[0].prompt);
});

test("actions run through ctx.window and tolerate missing globals", () => {
  const actions = cp.buildActions();
  const byId = Object.fromEntries(actions.map((a) => [a.id, a]));
  let openedPane = null;
  byId["settings-skills"].run({ window: { SettingsUI: { open: (p) => { openedPane = p; } } } });
  assert.equal(openedPane, "skills");
  let moduleOpened = null;
  byId["open-fleet"].run({ window: { openModule: (n, g, m) => { moduleOpened = n; } } });
  assert.equal(moduleOpened, "fleet");
  // no window functions at all — must not throw
  ["new-thread", "toggle-theme", "open-settings", "search-threads", "open-library"].forEach((id) => {
    assert.doesNotThrow(() => byId[id].run({ window: {} }));
  });
});

test("RESULT_LIMIT is a sane positive number", () => {
  assert.ok(cp.RESULT_LIMIT >= 5 && cp.RESULT_LIMIT <= 50);
});
