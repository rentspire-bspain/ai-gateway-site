/* Offline regressions. Run: node modules/getting-started.test.js */
const { JSDOM } = require("jsdom");
const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const read = name => readFileSync(__dirname + "/" + name, "utf8");

(async function () {
  const dom = new JSDOM(`<!doctype html><div id="landing"><div id="suggestions"></div>
    <textarea id="landingInput"></textarea><button id="landingSubmit"></button>
    <select id="modelSel"><option>Auto</option></select><p><a id="statusLink">Status</a></p></div>
    <textarea id="followupInput"></textarea><input id="threadSearch"><div id="threadItems"></div><div id="moduleRoot"></div>`,
    { url: "https://example.test", runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  w.sent = [];
  w.__appGlobals = {
    threads: [], spaces: [],
    newThread() { d.getElementById("landing").style.display = ""; w.created = (w.created || 0) + 1; }
  };
  w.SettingsUI = { close() {}, open() {} };
  ["landingInput", "followupInput"].forEach(id => {
    d.getElementById(id).addEventListener("keydown", e => {
      if (e.key === "Enter") { w.sent.push({ input: id, text: e.target.value }); e.target.value = ""; }
    });
  });
  d.getElementById("landingSubmit").onclick = () => { throw Error("Must not click stop/send"); };
  w.renderThreads = function () {
    const list = d.getElementById("threadItems");
    list.textContent = "";
    const q = d.getElementById("threadSearch").value;
    if (!q && w.__appGlobals.threads.length) list.appendChild(d.createElement("div"));
  };
  d.getElementById("threadSearch").addEventListener("input", () => w.renderThreads());
  w.localStorage.setItem("pplx-onboarded", "1");
  w.eval(read("onboarding.js"));
  await new Promise(r => w.setTimeout(r, 10));
  assert.equal(d.querySelectorAll(".ob-example-chip").length, 6, "preserve existing landing examples");
  assert(d.querySelector("[data-ob-checklist]"), "preserve existing checklist");
  assert.equal(d.querySelectorAll("#tour.open").length, 0, "honor existing dismissal key");
  const search = d.getElementById("threadSearch");
  search.value = "unmatched"; search.dispatchEvent(new w.Event("input"));
  assert.equal(d.querySelectorAll(".ob-threads-empty .ob-empty-starter").length, 3);
  d.querySelector(".ob-threads-empty button").click();
  assert.equal(search.value, "");
  search.value = "missing"; search.dispatchEvent(new w.Event("input"));
  d.querySelectorAll(".ob-threads-empty .ob-empty-starter")[1].click();
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].text, w.OnboardingUI.EXAMPLE_PROMPTS[0].query);
  w.eval(read("library.js"));
  w.LibraryUI.open();
  assert.equal(d.querySelector(".lib-empty h2").textContent, "No threads yet");
  assert.equal(d.querySelectorAll(".lib-empty .ob-empty-starter").length, 3);
  d.querySelector(".lib-empty .ob-empty-starter").click();
  assert.equal(w.sent.length, 2);
  assert.equal(d.getElementById("libraryRoot").classList.contains("open"), false);
  w.__appGlobals.threads = [{ id: "1", title: "Saved thread", messages: [] }];
  w.LibraryUI.open();
  d.getElementById("libQ").value = "zzzzzzz";
  d.getElementById("libQ").dispatchEvent(new w.Event("input"));
  assert.equal(d.querySelectorAll(".lib-empty .ob-empty-starter").length, 2);
  [...d.querySelectorAll(".lib-empty button")].find(b => b.textContent === "Clear search and filters").click();
  assert.equal(d.querySelectorAll(".lib-card").length, 1);
  d.getElementById("landing").style.display = "none";
  w.isSearching = true;
  w.OnboardingUI.runStarter("Queue a useful follow-up");
  assert.equal(w.created || 0, 0, "busy starter must not switch thread under a live response");
  assert.equal(w.sent.at(-1).input, "followupInput");
  w.isSearching = false;
  w.OnboardingUI.runStarter("Start a fresh question");
  assert.equal(w.created, 1);
  assert.equal(w.sent.at(-1).input, "landingInput");
  w.STATUS = { google: { connected: false }, github: { connected: false } };
  w.GATEWAY = "https://example.test/functions/v1";
  w.sb = { auth: { getSession: () => Promise.resolve({ data: { session: { access_token: "test" } } }) } };
  w.fetch = () => Promise.resolve({ json: () => Promise.resolve({ providers: w.STATUS }), status: 200, ok: true });
  w.eval(read("connectors.js"));
  d.body.appendChild(w.ConnectorsUI.card());
  await new Promise(r => w.setTimeout(r, 20));
  assert.equal(d.querySelectorAll(".cn-empty button").length, 3);
  const before = w.sent.length;
  [...d.querySelectorAll(".cn-empty button")].forEach(b => b.click());
  assert.equal(w.sent.length, before + 3);
  w.STATUS = { google: { connected: true }, github: { connected: false } };
  await w.ConnectorsUI.refresh();
  assert.equal(d.querySelector(".cn-empty"), null);
  w.STATUS = { google: { error: "Unavailable" }, github: { connected: false } };
  await w.ConnectorsUI.refresh();
  assert.equal(d.querySelector(".cn-empty"), null);
  dom.window.close();
  console.log("PASS: existing onboarding preserved; sidebar/library empty states, clear/reset, connector prompts/status, real composer Enter path and busy-thread safety");
})().catch(e => { console.error(e); process.exitCode = 1; });
