// Side panel: hosts the chat site in an iframe, forwards "ask" requests to the site-bridge content script running
// inside that iframe (postMessage, origin-checked), shows the active tab's page context, and persists settings.
(function () {
  "use strict";
  const L = self.AISC;
  const $ = (id) => document.getElementById(id);
  const frame = $("site");
  const MAX_AGE_MS = 60000;
  const POLL_MS = 3000;
  let settings = L.normalizeSettings(null);
  let ctx = { state: "loading", title: "", url: "", selection: "" };
  let modelOptions = null; // { origin, options } published by the site bridge
  const handled = new Set();
  let seq = 0;

  // ---------- site frame + ask delivery ----------
  function loadFrame() { frame.src = settings.site + "/"; }

  window.addEventListener("message", (e) => {
    if (e.origin !== settings.site || e.source !== frame.contentWindow) return;
    if (e.data && e.data.source === "aispaincos-bridge" && e.data.type === "ready") checkPending();
  });

  // Deliver one ask: retry until the bridge acks (it may still be loading), give up after ~20 s.
  function deliver(pending) {
    if (handled.has(pending.id)) return;
    handled.add(pending.id);
    const site = settings.site;
    let tries = 0;
    const onAck = (e) => {
      if (e.origin === site && e.source === frame.contentWindow && e.data && e.data.source === "aispaincos-bridge" && e.data.type === "ack" && e.data.id === pending.id) {
        window.removeEventListener("message", onAck);
        clearInterval(timer);
        try { chrome.storage.session.remove("pendingAsk").catch(() => {}); } catch (_e) { /* ignore */ }
      }
    };
    window.addEventListener("message", onAck);
    const timer = setInterval(() => {
      if (++tries > 40) { clearInterval(timer); window.removeEventListener("message", onAck); return; }
      try { frame.contentWindow.postMessage({ source: "aispaincos-ext", type: "ask", id: pending.id, text: pending.text, submit: true }, site); } catch (_e) { /* iframe not ready */ }
    }, 500);
  }

  // Asks that originate in this panel go through the very same deliver() path as context-menu asks.
  function ask(text) {
    if (!text) return false;
    deliver({ id: "panel-" + Date.now() + "-" + (++seq), text });
    return true;
  }

  async function checkPending() {
    try {
      const { pendingAsk } = await chrome.storage.session.get("pendingAsk");
      if (pendingAsk && pendingAsk.target !== "tab" && Date.now() - pendingAsk.ts < MAX_AGE_MS) deliver(pendingAsk);
    } catch (_e) { /* storage unavailable */ }
  }

  // ---------- page context ----------
  async function readContext() {
    let tab = null;
    try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch (_e) { /* ignore */ }
    if (!tab) return { state: "none", title: "", url: "", selection: "" };
    if (typeof tab.url !== "string" || !tab.url) return { state: "noaccess", title: "", url: "", selection: "" };
    if (!L.isShareableUrl(tab.url)) return { state: "unsupported", title: tab.title || "", url: tab.url, selection: "" };
    let selection = "";
    try {
      const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => String(window.getSelection() || "").slice(0, 4000) });
      selection = (res && res[0] && typeof res[0].result === "string") ? res[0].result : "";
    } catch (_e) { /* no access to this tab (restricted page or permission not granted) */ }
    return { state: "ok", title: tab.title || "", url: tab.url, selection };
  }

  async function refreshContext() {
    ctx = await readContext();
    renderContext();
  }

  function opts() { return { includePage: settings.includePage, includeSelection: settings.includeSelection }; }

  function renderContext() {
    const t = $("ctxTitle");
    const hint = $("ctxHint"), hintText = $("ctxHintText"), grant = $("grantBtn");
    const selRow = $("ctxSelRow");
    hint.hidden = true; grant.hidden = true;
    if (ctx.state === "ok") {
      const host = (() => { try { return new URL(ctx.url).host; } catch (_e) { return ctx.url; } })();
      t.textContent = (L.clip(ctx.title, 80) || host) + " \u2014 " + host;
      t.title = ctx.url;
    } else {
      t.textContent = ctx.state === "loading" ? "Reading the active tab..." : "No shareable page";
      t.title = "";
      hint.hidden = false;
      if (ctx.state === "noaccess") { hintText.textContent = "This tab is not shared yet. Click Allow page access once, or press Ctrl+Shift+A on the tab."; grant.hidden = false; }
      else if (ctx.state === "unsupported") hintText.textContent = "Browser-internal pages cannot be shared. Open a normal web page.";
      else if (ctx.state === "none") hintText.textContent = "No active tab found.";
    }
    const sel = ctx.state === "ok" ? L.clip(ctx.selection, 160) : "";
    selRow.hidden = !sel;
    $("ctxSel").textContent = sel ? "\u201c" + sel + "\u201d" : "";
    const canAsk = ctx.state === "ok";
    $("sumBtn").disabled = !canAsk;
    $("incPage").checked = settings.includePage;
    $("incSel").checked = settings.includeSelection;
    $("askBtn").disabled = false;
    renderPreview();
  }

  function renderPreview() {
    const q = $("askInput").value;
    const built = L.buildContextQuestion(q.trim() || "<your question>", ctx.state === "ok" ? ctx : null, opts());
    $("preview").textContent = "Will send: " + L.clip(built, 300);
  }

  // ---------- settings ----------
  async function loadSettings() {
    try { const { settings: s, modelOptions: m } = await chrome.storage.local.get(["settings", "modelOptions"]); settings = L.normalizeSettings(s); modelOptions = m || null; }
    catch (_e) { settings = L.normalizeSettings(null); }
  }

  async function saveSettings(patch) {
    const before = settings.site;
    settings = L.normalizeSettings(Object.assign({}, settings, patch));
    try { await chrome.storage.local.set({ settings }); } catch (_e) { /* ignore */ }
    if (settings.site !== before) loadFrame();
    renderSettings();
    renderContext();
  }

  function renderSettings() {
    const siteSel = $("siteSel");
    if (!siteSel.options.length) for (const s of L.SITES) siteSel.add(new Option(s.replace("https://", ""), s));
    siteSel.value = settings.site;
    const modelSel = $("modelSel");
    while (modelSel.options.length > 1) modelSel.remove(1);
    const list = modelOptions && modelOptions.origin === settings.site ? L.sanitizeModelOptions(modelOptions.options) : [];
    for (const o of list) modelSel.add(new Option(o.label, o.value));
    if (settings.model && !list.some((o) => o.value === settings.model)) modelSel.add(new Option(settings.model + " (saved)", settings.model));
    modelSel.value = settings.model;
  }

  // ---------- wiring ----------
  $("reload").onclick = () => loadFrame();
  $("openTab").onclick = () => chrome.tabs.create({ url: settings.site + "/" });
  $("settingsBtn").onclick = () => {
    const box = $("settings");
    box.hidden = !box.hidden;
    $("settingsBtn").setAttribute("aria-expanded", String(!box.hidden));
  };
  $("siteSel").onchange = (e) => saveSettings({ site: e.target.value });
  $("modelSel").onchange = (e) => saveSettings({ model: e.target.value });
  $("incPage").onchange = (e) => saveSettings({ includePage: e.target.checked });
  $("incSel").onchange = (e) => saveSettings({ includeSelection: e.target.checked });
  $("ctxRefresh").onclick = () => refreshContext();
  $("askInput").addEventListener("input", renderPreview);
  $("grantBtn").onclick = async () => {
    try { await chrome.permissions.request({ origins: ["https://*/*", "http://*/*"] }); } catch (_e) { /* user declined */ }
    refreshContext();
  };
  $("askForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("askInput").value.trim();
    if (!q) { $("askInput").focus(); return; }
    if (ask(L.buildContextQuestion(q, ctx.state === "ok" ? ctx : null, opts()))) $("askInput").value = "";
    renderPreview();
  });
  $("sumBtn").onclick = () => {
    const text = L.buildSummaryQuestion(ctx);
    if (text) ask(text);
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && changes.pendingAsk && changes.pendingAsk.newValue) checkPending();
    if (area === "local" && changes.modelOptions) { modelOptions = changes.modelOptions.newValue || null; renderSettings(); }
    if (area === "local" && changes.settings) {
      const next = L.normalizeSettings(changes.settings.newValue);
      const siteChanged = next.site !== settings.site;
      settings = next;
      if (siteChanged) loadFrame();
      renderSettings(); renderContext();
    }
  });
  try {
    chrome.tabs.onActivated.addListener(refreshContext);
    chrome.tabs.onUpdated.addListener((id, info) => { if (info.status === "complete" || info.url || info.title) refreshContext(); });
    chrome.permissions.onAdded && chrome.permissions.onAdded.addListener(refreshContext);
  } catch (_e) { /* events unavailable */ }
  window.addEventListener("focus", refreshContext);
  // The selection changes without any browser event, so poll lightly while the panel is visible.
  setInterval(() => { if (document.visibilityState === "visible" && settings.includeSelection) refreshContext(); }, POLL_MS);

  const ready = (async function init() {
    await loadSettings();
    renderSettings();
    loadFrame();
    renderContext();
    await refreshContext();
    checkPending();
  })();
  self.__aiscPanel = { ready, ask, deliver, refreshContext, getSettings: () => settings, getContext: () => ctx }; // test hook
})();
