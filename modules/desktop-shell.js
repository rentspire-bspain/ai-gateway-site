/* desktop-shell.js — Desktop parity glue for the installed PWA and the desktop wrapper.
 *
 * What it wires (all of it is declared in manifest.webmanifest, which previously had NO handler in the app):
 *   - share_target  (GET /?title=&q=&url=)        -> prefill the composer (never auto-send)
 *   - protocol_handlers web+aispaincos:<text>     -> /?q=%s  -> prefill the composer
 *   - shortcuts     (/?intent=new|search|settings) -> new thread / focus thread search / open Settings
 *   - file_handlers (launchQueue files)           -> text/csv/json/md file opened into the composer
 *   - launch_handler focus-existing               -> launchQueue targetURL applied in the running window
 *   - ?source=desktop-hotkey (Electron wrapper)   -> focus the composer
 * Plus: an offline/back-online status bar, and installed-window shortcuts (Ctrl/Cmd+Shift+O new thread,
 * Ctrl/Cmd+, settings) that are only active in an installed window, never in a normal browser tab.
 * Pure vanilla JS; parseLaunch/shareText are pure and unit-tested (tests/desktop-shell.test.js).
 */
(function (root) {
  "use strict";

  var SCHEME = /^web\+aispaincos:\/*/i;
  var CLEAN_PARAMS = ["q", "title", "text", "url", "intent", "source"];

  /* ---------- pure ---------- */
  function decode(s) { try { return decodeURIComponent(String(s).replace(/\+/g, " ")); } catch (e) { return String(s); } }

  /** Combine the share-sheet fields into one composer string (text wins; title/url fill gaps). */
  function shareText(p) {
    var q = String(p.q || p.text || "").trim();
    var title = String(p.title || "").trim();
    var url = String(p.url || "").trim();
    if (SCHEME.test(q)) q = decode(q.replace(SCHEME, "")).trim();
    if (!q) q = title;
    if (url && q.indexOf(url) === -1) q = q ? q + "\n" + url : url;
    return q.slice(0, 4000);
  }

  /** Parse a launch/share/shortcut URL into { q, intent, source }. Never throws. */
  function parseLaunch(href, base) {
    var out = { q: "", intent: "", source: "" };
    var u;
    try { u = new URL(String(href || ""), base || "https://ai.spaincos.com/"); } catch (e) { return out; }
    var sp = u.searchParams;
    out.source = String(sp.get("source") || "").slice(0, 40);
    out.q = shareText({ q: sp.get("q"), text: sp.get("text"), title: sp.get("title"), url: sp.get("url") });
    var intent = String(sp.get("intent") || "").toLowerCase();
    if (!intent) { var h = String(u.hash || "").replace(/^#/, "").toLowerCase(); if (h === "search" || h === "settings" || h === "new") intent = h; }
    if (intent === "search" || intent === "settings" || intent === "new") out.intent = intent;
    if (out.source === "desktop-hotkey" && !out.intent && !out.q) out.intent = "focus";
    return out;
  }

  var api = { parseLaunch: parseLaunch, shareText: shareText, CLEAN_PARAMS: CLEAN_PARAMS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!root || !root.document) return; // node (unit tests): pure helpers only

  /* ---------- browser ---------- */
  var doc = root.document;
  function standalone() {
    try { return (root.matchMedia && root.matchMedia("(display-mode: standalone)").matches) || root.navigator.standalone === true; } catch (e) { return false; }
  }
  function isDesktopApp() { return standalone() || /Electron\/|AiSpaincosDesktop/.test(root.navigator.userAgent || ""); }

  function composer() {
    var ids = ["followupInput", "landingInput"];
    for (var i = 0; i < ids.length; i++) { var el = doc.getElementById(ids[i]); if (el && el.offsetParent !== null) return el; }
    return null;
  }
  function fill(el, text) {
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    try { el.focus(); el.setSelectionRange(text.length, text.length); } catch (e) { /* non-text */ }
  }
  // the app boots asynchronously (auth, restore); retry until the composer is visible (max ~6s)
  function whenComposer(fn, tries) {
    var el = composer();
    if (el) { fn(el); return; }
    if ((tries || 0) > 30) return;
    root.setTimeout(function () { whenComposer(fn, (tries || 0) + 1); }, 200);
  }

  function apply(launch) {
    if (!launch) return;
    if (launch.intent === "new") { if (typeof root.newThread === "function") root.newThread(); whenComposer(function (el) { el.focus(); }); }
    else if (launch.intent === "settings") { if (root.SettingsUI && root.SettingsUI.open) root.SettingsUI.open(); }
    else if (launch.intent === "search") { var s = doc.getElementById("threadSearch"); if (s) { s.focus(); s.select && s.select(); } }
    else if (launch.intent === "focus") whenComposer(function (el) { el.focus(); });
    if (launch.q) whenComposer(function (el) { fill(el, launch.q); });
  }

  function cleanUrl() {
    try {
      var u = new URL(root.location.href), changed = false;
      CLEAN_PARAMS.forEach(function (k) { if (u.searchParams.has(k)) { u.searchParams.delete(k); changed = true; } });
      if (/^#(search|settings|new)$/i.test(u.hash)) { u.hash = ""; changed = true; }
      if (changed) root.history.replaceState(root.history.state, "", u.pathname + u.search + u.hash);
    } catch (e) { /* ignore */ }
  }

  // ---- file handler: text/csv/json/md opened from the OS ("Open with ai.spaincos")
  function openFileHandle(handle) {
    return Promise.resolve(handle && handle.getFile ? handle.getFile() : null).then(function (file) {
      if (!file) return;
      if (file.size > 500000) { root.alert("File too large for the chat (500KB max)."); return; }
      return file.text().then(function (text) {
        var NL = String.fromCharCode(10);
        var body = "File: " + file.name + " (" + Math.max(1, Math.round(file.size / 1024)) + "KB)" + NL + "```" + NL + text.slice(0, 200000) + NL + "```";
        whenComposer(function (el) { fill(el, body); });
      });
    }).catch(function () { /* unreadable file: leave the composer alone */ });
  }

  function wireLaunchQueue() {
    if (!("launchQueue" in root) || !root.launchQueue || !root.launchQueue.setConsumer) return;
    root.launchQueue.setConsumer(function (params) {
      if (!params) return;
      if (params.targetURL) apply(parseLaunch(params.targetURL, root.location.href));
      if (params.files && params.files.length) openFileHandle(params.files[0]);
    });
  }

  // ---- offline / back-online bar
  var bar = null, hideTimer = null;
  function ensureBar() {
    if (bar) return bar;
    bar = doc.createElement("div");
    bar.id = "offlineBar"; bar.hidden = true; bar.setAttribute("role", "status"); bar.setAttribute("aria-live", "polite");
    var dot = doc.createElement("span"); dot.className = "ob-dot"; dot.setAttribute("aria-hidden", "true");
    var txt = doc.createElement("span"); txt.className = "ob-text";
    bar.appendChild(dot); bar.appendChild(txt);
    doc.body.appendChild(bar);
    return bar;
  }
  function showBar(text, back) {
    var b = ensureBar();
    b.querySelector(".ob-text").textContent = text;
    b.classList.toggle("back", !!back);
    b.hidden = false;
    if (hideTimer) { root.clearTimeout(hideTimer); hideTimer = null; }
    if (back) hideTimer = root.setTimeout(function () { b.hidden = true; }, 3000);
  }
  function syncOnline() {
    if (root.navigator.onLine === false) showBar("You're offline. Saved threads stay readable; new questions need a connection.", false);
    else if (bar && !bar.hidden) showBar("Back online.", true);
  }

  // ---- installed-window shortcuts (never in a normal browser tab, where the browser owns these chords)
  function onKey(e) {
    if (!isDesktopApp() || !(e.metaKey || e.ctrlKey)) return;
    if (e.shiftKey && (e.key === "o" || e.key === "O")) { e.preventDefault(); if (typeof root.newThread === "function") root.newThread(); whenComposer(function (el) { el.focus(); }); }
    else if (!e.shiftKey && e.key === ",") { e.preventDefault(); if (root.SettingsUI && root.SettingsUI.open) root.SettingsUI.open(); }
  }

  function init() {
    if (isDesktopApp()) doc.documentElement.classList.add("is-desktop-app");
    root.addEventListener("online", syncOnline);
    root.addEventListener("offline", syncOnline);
    doc.addEventListener("keydown", onKey);
    wireLaunchQueue();
    var launch = parseLaunch(root.location.href);
    if (launch.q || launch.intent) { apply(launch); }
    if (launch.q || launch.intent || launch.source) cleanUrl();
    syncOnline();
  }
  root.DesktopShell = { parseLaunch: parseLaunch, shareText: shareText, apply: apply, isDesktopApp: isDesktopApp, openFileHandle: openFileHandle };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : globalThis);
