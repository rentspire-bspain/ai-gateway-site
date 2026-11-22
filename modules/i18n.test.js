// node modules/i18n.test.js — dictionary/detection sanity (no DOM needed beyond stubs)
const vm = require("vm"), fs = require("fs"), assert = require("assert");
function load(search, stored, langs) {
  const store = stored ? { ai_lang: stored } : {};
  const doc = { readyState: "loading", documentElement: {}, addEventListener() {}, querySelectorAll() { return []; } };
  const ctx = { window: {}, document: doc, navigator: { languages: langs, language: langs[0] },
    location: { search }, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, URLSearchParams, CustomEvent: function () {} };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/i18n.js", "utf8"), ctx);
  return ctx.I18N;
}
assert.strictEqual(load("", null, ["en-US"]).lang, "en");
assert.strictEqual(load("", null, ["fr-FR", "es-MX"]).lang, "es");
assert.strictEqual(load("?lang=es", null, ["en-US"]).lang, "es");
assert.strictEqual(load("", "es", ["en-US"]).lang, "es");
assert.strictEqual(load("?lang=zz", null, ["en-US"]).lang, "en");
const i = load("?lang=es", null, ["en"]);
assert.strictEqual(i.t("Library"), "Biblioteca");
assert.strictEqual(i.t("Unknown string"), "Unknown string");
assert.strictEqual(i.coverage.es, "partial");
console.log("i18n tests ok");
// v2: patterns, new strings, Intl helpers
const j = load("?lang=es", null, ["en"]);
assert.strictEqual(j.t("· 2 of 4"), "· 2 de 4");
assert.strictEqual(j.t("Delete this thread?"), "¿Eliminar este hilo?");
assert.strictEqual(j.t("Next"), "Siguiente");
assert.strictEqual(typeof j.fmtNumber(1234.5), "string");
assert.ok(/nov/i.test(j.fmtDate("2026-11-21")));
assert.strictEqual(load("", null, ["en-US"]).fmtDate("2026-11-21"), "Nov 21, 2026");
console.log("i18n v2 tests ok");
