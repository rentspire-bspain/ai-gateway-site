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
  w.STATUS = { google: { connected: false }, dropbox: { connected: false }, github: { connected: false } };
  w.OAUTH_CFG = { ok: true, redirectUri: "https://example.test/api/oauth-callback", providers: { google: null, outlook: null, github: null, dropbox: { clientId: "dbx-live-client" }, slack: { clientId: "slk-live-client" } } };
  w.openedUrls = [];
  w.open = url => { w.openedUrls.push(url); return { closed: false, focus() {} }; };
  w.connectorCalls = [];
  w.GATEWAY = "https://example.test/functions/v1";
  w.sb = { auth: { getSession: () => Promise.resolve({ data: { session: { access_token: "test" } } }) } };
  w.fetch = (url, opts) => {
    if (String(url).includes("/api/oauth-config")) {
      return Promise.resolve({ json: () => Promise.resolve(w.OAUTH_CFG), status: 200, ok: true });
    }
    const body = opts && opts.body ? JSON.parse(opts.body) : {};
    w.connectorCalls.push(body);
    if (body.action === "start") {
      return Promise.resolve({ json: () => Promise.resolve({ url: "https://www.dropbox.com/oauth2/authorize?client_id=dbx-live-client&state=st1" }), status: 200, ok: true });
    }
    return Promise.resolve({ json: () => Promise.resolve({ providers: w.STATUS }), status: 200, ok: true });
  };
  w.eval(read("connectors.config.js"));
  w.eval(read("connectors.js"));
  const cardNode = w.ConnectorsUI.card();
  assert.equal(cardNode.querySelector(".cn-empty"), null, "suppress guide while connector status is unknown/loading");
  d.body.appendChild(cardNode);
  await new Promise(r => w.setTimeout(r, 25));

  // Persuasion surface in .cn-empty: 3 concrete Before/After examples + 4 Why-connect benefits
  assert.equal(d.querySelectorAll(".cn-empty .cn-demo-card").length, 3);
  assert.equal(d.querySelectorAll(".cn-empty [data-cn-why='1'] .cn-why-item").length, 4);
  assert(d.querySelector(".cn-empty").textContent.includes("What did my accountant say about the Q3 invoices?"));
  assert(d.querySelector(".cn-empty").textContent.includes("What's on my plate Thursday and when should I leave for the 2pm?"));
  assert(d.querySelector(".cn-empty").textContent.includes("Summarize the contract my lawyer sent last week"));
  assert(d.querySelector(".cn-empty").textContent.includes("20 minutes of scrolling"));

  // Landing & onboarding tour persuasion surfaces also mirror live OAuth states
  w.OnboardingUI.syncPersuasion();
  assert(d.querySelector("#suggestions [data-ob-persuasion='1']") && !d.querySelector("#suggestions [data-ob-persuasion='1']").hidden);
  assert.equal(d.querySelectorAll("#suggestions .ob-persuade-chip").length, 3);
  assert.equal(d.querySelectorAll("#suggestions .ob-why-item").length, 4);

  // Unregistered provider (Google = null in /api/oauth-config): shows honest registration-pending status, never dead, never submits unconnected prompt
  const before = w.sent.length;
  const gmailChip = d.querySelector(".cn-empty [data-demo-id='gmail']");
  assert.equal(gmailChip.getAttribute("data-demo-state"), "registration_pending");
  gmailChip.click();
  assert.equal(w.sent.length, before, "unconnected demo chip must not submit chat prompt");
  assert(d.querySelector(".cn-empty [data-cn-demo-status='google']").textContent.includes("OAuth registration pending"));
  assert(d.querySelector("[data-provider='google']").className.includes("cn-card-highlight"));

  // Live configured provider (Dropbox has clientId): routes to real OAuth connect flow
  const filesChip = d.querySelector(".cn-empty [data-demo-id='files']");
  assert.equal(filesChip.getAttribute("data-demo-provider"), "dropbox");
  assert.equal(filesChip.getAttribute("data-demo-state"), "oauth_ready");
  filesChip.click();
  await new Promise(r => w.setTimeout(r, 25));
  assert(
    w.openedUrls.some(u => u.includes("dropbox.com/oauth2/authorize")) ||
    w.connectorCalls.some(c => c.action === "start" && c.provider === "dropbox"),
    "configured demo chip starts real OAuth flow"
  );

  // Connected state: .cn-empty suppressed AND connected demo runs real starter prompt
  w.STATUS = { google: { connected: true, services: { gmail: true, calendar: true, drive: true } }, dropbox: { connected: false }, github: { connected: false } };
  await w.ConnectorsUI.refresh();
  assert.equal(d.querySelector(".cn-empty"), null, "suppress empty guide when a provider is connected");
  assert.equal(d.querySelector("#suggestions [data-ob-persuasion='1']").hidden, true, "hide landing persuasion card once a connector is linked");
  const connectedRes = w.OnboardingUI.triggerConnectorDemo("gmail");
  assert.equal(connectedRes.action, "asked");
  assert.equal(w.sent.at(-1).text, "What did my accountant say about the Q3 invoices?");

  // Error state: .cn-empty remains suppressed
  w.STATUS = { google: { error: "Unavailable" }, dropbox: { connected: false }, github: { connected: false } };
  await w.ConnectorsUI.refresh();
  assert.equal(d.querySelector(".cn-empty"), null, "suppress empty guide on provider status error");
  dom.window.close();
  console.log("PASS: existing onboarding preserved; sidebar/library empty states, clear/reset, connector prompts/status, real composer Enter path and busy-thread safety");
})().catch(e => { console.error(e); process.exitCode = 1; });
