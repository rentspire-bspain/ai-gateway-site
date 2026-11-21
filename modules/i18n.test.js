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
