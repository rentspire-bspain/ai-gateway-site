/* ============ SETTINGS UI (v74) ============
   Full settings overlay for ai.spaincos.com — Perplexity /account style.
   Exposes window.SettingsUI = { open(paneId?), close() }.
   Vanilla JS, no framework. Persists to localStorage; reads app globals
   (sb, currentUser, setTheme, openShortcutsHelp) defensively when present.

   Storage keys owned/read here:
     ai_theme ("light" | "dark" | "system"), voiceOn ("1"|"0"),
     ai_personalize, ai_tone ("direct"|"balanced"|"detailed"),
     ai_memory ("1"|"0", default on), ai_memory_items ([{id,text,createdAt}]),
     ai_site_instructions, ai_notify_inapp (default on), ai_notify_email (default off)
   Reads only: ai_threads, ai_spaces, sidebarWidth, answerWidth, answerWidthPx, artifactWidth */
(function () {
  "use strict";

  var VERSION = "v74";

  // ---------- tiny helpers ----------
  function $(sel, el) { return (el || document).querySelector(sel); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function lsJSON(k, fallback) {
    try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function uid() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID()
      : "m" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }

  // ---------- icons (16px stroke, matches the app) ----------
  var ICON = {
    prefs: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    person: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    brain: '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44A2.5 2.5 0 0 1 4.5 17.5a2.5 2.5 0 0 1-1.98-4A2.5 2.5 0 0 1 3 8.5a2.5 2.5 0 0 1 2.04-4.46A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.54-2.44 2.5 2.5 0 0 0 1.98-4A2.5 2.5 0 0 0 21 8.5a2.5 2.5 0 0 0-2.04-4.46A2.5 2.5 0 0 0 14.5 2z"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    plug: '<path d="M9 7V2M15 7V2"/><path d="M6 7h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V7z"/><path d="M12 17v5"/>',
    chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    kbd: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'
  };
  function svg(k) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + "</svg>";
  }

  // ---------- theme integration ----------
  // The host app's setTheme(theme) sets data-theme + localStorage ai_theme and
  // syncs the header icon/label. It only understands "light"|"dark", so for
  // "system" we call it with the resolved value and then re-persist "system".
  var sysMq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function applyThemeVisual(theme) {
    if (typeof window.setTheme === "function") { window.setTheme(theme); return; }
    document.documentElement.setAttribute("data-theme", theme);
    lsSet("ai_theme", theme);
  }
  function storedTheme() { return lsGet("ai_theme") === "dark" || lsGet("ai_theme") === "system" ? lsGet("ai_theme") : "light"; }
  function setThemePref(theme) {
    if (theme === "system") {
      var resolved = sysMq ? (sysMq.matches ? "dark" : "light") : "light";
      applyThemeVisual(resolved);      // host setTheme writes ai_theme=resolved…
      lsSet("ai_theme", "system");     // …so re-persist "system" right after
    } else {
      applyThemeVisual(theme);         // persists ai_theme=light|dark itself
    }
  }
  // Re-resolve "system" whenever the OS preference flips (while in system mode).
  function onSysChange() {
    if (lsGet("ai_theme") !== "system") return;
    applyThemeVisual(sysMq.matches ? "dark" : "light");
    lsSet("ai_theme", "system");
    if (panel && activePane === "preferences") renderPane("preferences"); // refresh active state
  }
  if (sysMq) {
    if (sysMq.addEventListener) sysMq.addEventListener("change", onSysChange);
    else if (sysMq.addListener) sysMq.addListener(onSysChange);
  }
  // On load: if the app booted with ai_theme="system", resolve the visual theme
  // now (and again on DOMContentLoaded/load in case we load before the host script).
  function normalizeStoredTheme() {
    if (lsGet("ai_theme") !== "system") return;
    applyThemeVisual(sysMq && sysMq.matches ? "dark" : "light");
    lsSet("ai_theme", "system");
  }
  normalizeStoredTheme();
  document.addEventListener("DOMContentLoaded", normalizeStoredTheme);
  window.addEventListener("load", normalizeStoredTheme);

  // ---------- shared control builders ----------
  function makeToggle(checked, onChange, label) {
    var wrap = el("label", "stg-switch");
    wrap.title = label || "";
    var input = el("input");
    input.type = "checkbox";
    input.setAttribute("role", "switch");
    input.checked = !!checked;
    input.addEventListener("change", function () { onChange(input.checked); });
    wrap.appendChild(input);
    wrap.appendChild(el("span", "stg-track"));
    return wrap;
  }
  function makeSelect(options, value, onChange, ariaLabel) {
    var s = el("select", "stg-select");
    if (ariaLabel) s.setAttribute("aria-label", ariaLabel);
    options.forEach(function (o) {
      var opt = el("option");
      opt.value = o.v;
      opt.textContent = o.t;
      s.appendChild(opt);
    });
    s.value = value;
    s.addEventListener("change", function () { onChange(s.value); });
    return s;
  }
  function row(label, desc, controls, block) {
    var r = el("div", "stg-row" + (block ? " stg-row-block" : ""));
    var top = el("div", "stg-row-top");
    var text = el("div", "stg-row-text");
    var lab = el("p", "stg-label"); lab.textContent = label; text.appendChild(lab);
    if (desc) {
      var d = el("p", "stg-desc"); d.innerHTML = desc; text.appendChild(d);
    }
    top.appendChild(text);
    if (controls) {
      var c = el("div", "stg-controls"); c.appendChild(controls); top.appendChild(c);
    }
    r.appendChild(top);
    return r;
  }

  // ---------- panes ----------
  var PANES = [
    { id: "preferences", label: "Preferences", icon: "prefs" },
    { id: "personalize", label: "Personalize", icon: "person" },
    { id: "memory", label: "Memory", icon: "brain" },
    { id: "instructions", label: "Site instructions", icon: "doc" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "connectors", label: "Connectors", icon: "plug" },
    { id: "usage", label: "Usage", icon: "chart" },
    { id: "data", label: "Data controls", icon: "db" },
    { id: "about", label: "About", icon: "info" }
  ];
  var activePane = "preferences";

  // ===== 1. Preferences =====
  function panePreferences() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Preferences"));
    pane.appendChild(el("p", "stg-pane-sub", "Appearance and behavior defaults."));

    // Theme segmented control
    var seg = el("div", "stg-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Theme");
    var cur = storedTheme();
    ["light", "dark", "system"].forEach(function (t) {
      var b = el("button", null, t === "light" ? "Light" : t === "dark" ? "Dark" : "System");
      b.type = "button";
      b.setAttribute("aria-pressed", String(cur === t));
      b.addEventListener("click", function () {
        setThemePref(t);
        seg.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
      });
      seg.appendChild(b);
    });
    pane.appendChild(row("Theme", 'System follows your device\u2019s light/dark setting and updates automatically.', seg));

    // Default answer width (read-only)
    var widthMode = lsGet("answerWidth") === "full" ? "Full width" : "Fit";
    var widthNote = (lsGet("answerWidthPx") ? " (custom " + Math.round(parseFloat(lsGet("answerWidthPx"))) + "px)" : "");
    var widthBadge = el("span", "stg-version-chip", esc(widthMode + widthNote));
    pane.appendChild(row("Default answer width",
      'Read-only — drag the answer column edge or use the fit/full control in the main view to change it.',
      widthBadge));

    // Voice read-aloud default (shares the app\u2019s "voiceOn" key)
    pane.appendChild(row("Read answers aloud",
      "Default for the voice button — answers are spoken automatically when enabled.",
      makeToggle(lsGet("voiceOn") === "1", function (on) { lsSet("voiceOn", on ? "1" : "0"); }, "Read answers aloud")));

    // Language
    pane.appendChild(row("Language", "Interface and answer language.",
      makeSelect([{ v: "en", t: "English" }], "en", function () {}, "Language"), true));
    return pane;
  }

  // ===== 2. Personalize =====
  function panePersonalize() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Personalize"));
    pane.appendChild(el("p", "stg-pane-sub", "Help the assistant tailor answers to you."));

    var ta = el("textarea", "stg-textarea");
    ta.placeholder = "About you — e.g., what you do, what you\u2019re working on, preferences to keep in mind.";
    ta.value = lsGet("ai_personalize") || "";
    ta.setAttribute("aria-label", "About you");
    ta.addEventListener("input", function () { lsSet("ai_personalize", ta.value); });
    var r1 = row("About you", "Free-form context applied to your conversations.", null, true);
    r1.appendChild(ta);
    pane.appendChild(r1);

    var tone = lsGet("ai_tone") || "balanced";
    pane.appendChild(row("Tone", "How detailed and direct the answers should be.",
      makeSelect(
        [{ v: "direct", t: "Direct" }, { v: "balanced", t: "Balanced" }, { v: "detailed", t: "Detailed" }],
        tone,
        function (v) { lsSet("ai_tone", v); },
        "Tone")));
    return pane;
  }

  // ===== 3. Memory =====
  function memoryItems() { return lsJSON("ai_memory_items", []); }
  function saveMemoryItems(list) { lsSet("ai_memory_items", JSON.stringify(list)); }

  function paneMemory() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Memory"));
    pane.appendChild(el("p", "stg-pane-sub", "Facts the assistant remembers and applies to every answer."));

    // master toggle (default on)
    pane.appendChild(row("Remember across sessions",
      "When on, memory entries below are included as context in every conversation.",
      makeToggle(lsGet("ai_memory") !== "0", function (on) { lsSet("ai_memory", on ? "1" : "0"); }, "Remember across sessions")));

    // list container
    var listWrap = el("div");
    function renderList() {
      listWrap.innerHTML = "";
      var items = memoryItems();
      var list = el("div", "stg-memory-list");
      if (!items.length) {
        var note = el("p", "stg-empty-note", "No memories yet — add one below.");
        listWrap.appendChild(note);
      } else {
        items.forEach(function (m) {
          list.appendChild(memoryRow(m, renderList));
        });
        listWrap.appendChild(list);
      }
      // add form
      var add = el("div", "stg-memory-add");
      var input = el("input", "stg-input");
      input.type = "text";
      input.placeholder = "Add a memory — e.g., I prefer concise answers with tables";
      input.setAttribute("aria-label", "New memory");
      var btn = el("button", "stg-btn", "Add");
      btn.type = "button";
      function commit() {
        var v = input.value.trim();
        if (!v) return;
        var items2 = memoryItems();
        items2.push({ id: uid(), text: v, createdAt: new Date().toISOString() });
        saveMemoryItems(items2);
        input.value = "";
        renderList();
        input.focus();
      }
      btn.addEventListener("click", commit);
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); commit(); } });
      add.appendChild(input); add.appendChild(btn);
      listWrap.appendChild(add);
    }
    renderList();
    pane.appendChild(row("Memory entries", "Add, edit, or remove individual memories.", null, true));
    pane.appendChild(listWrap);
    return pane;
  }
  function memoryRow(m, rerender) {
    var rowEl = el("div", "stg-memory-item");
    function viewMode() {
      rowEl.innerHTML = "";
      var txt = el("div", "stg-mem-text" + (m.text ? "" : " stg-empty"), esc(m.text || "(empty)"));
      rowEl.appendChild(txt);
      var editBtn = el("button", "stg-icon-btn", svg("edit"));
      editBtn.type = "button";
      editBtn.title = "Edit memory";
      editBtn.setAttribute("aria-label", "Edit memory");
      editBtn.addEventListener("click", editMode);
      var delBtn = el("button", "stg-icon-btn danger", svg("trash"));
      delBtn.type = "button";
      delBtn.title = "Delete memory";
      delBtn.setAttribute("aria-label", "Delete memory");
      delBtn.addEventListener("click", function () {
        saveMemoryItems(memoryItems().filter(function (x) { return x.id !== m.id; }));
        rerender();
      });
      rowEl.appendChild(editBtn);
      rowEl.appendChild(delBtn);
    }
    function editMode() {
      rowEl.innerHTML = "";
      var input = el("input", "stg-input");
      input.type = "text";
      input.value = m.text;
      input.setAttribute("aria-label", "Edit memory text");
      var save = el("button", "stg-icon-btn", svg("check"));
      save.type = "button";
      save.title = "Save";
      save.setAttribute("aria-label", "Save memory");
      var cancel = el("button", "stg-icon-btn danger", svg("x"));
      cancel.type = "button";
      cancel.title = "Cancel";
      cancel.setAttribute("aria-label", "Cancel edit");
      function commit() {
        var v = input.value.trim();
        var items = memoryItems();
        var i = items.findIndex(function (x) { return x.id === m.id; });
        if (i >= 0) {
          if (v) { items[i].text = v; saveMemoryItems(items); }
          else items.splice(i, 1), saveMemoryItems(items);
        }
        rerender();
      }
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") { e.stopPropagation(); rerender(); }
      });
      save.addEventListener("click", commit);
      cancel.addEventListener("click", rerender);
      rowEl.appendChild(input); rowEl.appendChild(save); rowEl.appendChild(cancel);
      input.focus();
      input.select();
    }
    viewMode();
    return rowEl;
  }

  // ===== 4. Site instructions =====
  function paneInstructions() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Site instructions"));
    pane.appendChild(el("p", "stg-pane-sub", "Custom instructions applied to every answer."));
    var ta = el("textarea", "stg-textarea");
    ta.style.minHeight = "140px";
    ta.placeholder = "E.g., Always answer with tables. Keep answers under 300 words. Use metric units.";
    ta.value = lsGet("ai_site_instructions") || "";
    ta.setAttribute("aria-label", "Site instructions");
    ta.addEventListener("input", function () { lsSet("ai_site_instructions", ta.value); });
    var r = row("Custom instructions", "Applied on top of any space-level instructions.", null, true);
    r.appendChild(ta);
    pane.appendChild(r);
    return pane;
  }

  // ===== 5. Notifications =====
  function paneNotifications() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Notifications"));
    pane.appendChild(el("p", "stg-pane-sub", "Choose how you hear about activity."));

    pane.appendChild(row("In-app inbox",
      "Show in-app notifications for finished research and updates.",
      makeToggle(lsGet("ai_notify_inapp") !== "0", function (on) { lsSet("ai_notify_inapp", on ? "1" : "0"); }, "In-app inbox")));

    var emailCtl = el("div", "stg-controls");
    emailCtl.appendChild(makeToggle(lsGet("ai_notify_email") === "1", function (on) { lsSet("ai_notify_email", on ? "1" : "0"); }, "Email digest"));
    var soon = el("span", "stg-desc stg-note", "Coming soon");
    soon.style.whiteSpace = "nowrap";
    emailCtl.appendChild(soon);
    pane.appendChild(row("Email digest",
      "A periodic summary of your threads and activity.",
      emailCtl));
    return pane;
  }

  // ===== 5b. Connectors (E10) =====
  // Available-but-disabled by default; the gateway/frontend reads this list
  // via window.ConnectorPrefs.list() — no extra fetch needed.
  var CONNECTOR_SEEDS = [
    { id: "gmail-gcal", name: "Gmail", category: "Google", enabled: false, note: "Email and calendar (gcal)" },
    { id: "google-drive", name: "Google Drive", category: "Google", enabled: false, note: "Files and documents" },
    { id: "google-sheets", name: "Google Sheets", category: "Google", enabled: false, note: "Spreadsheets" },
    { id: "dropbox", name: "Dropbox", category: "Files", enabled: false, note: "Files and folders" },
    { id: "slack", name: "Slack", category: "Communication", enabled: false, note: "Workspaces and messages" },
    { id: "github", name: "GitHub", category: "Developer", enabled: false, note: "Repositories, issues, and PRs" },
    { id: "stripe", name: "Stripe", category: "Payments", enabled: false, note: "Payments and billing data" },
    { id: "render", name: "Render", category: "Developer", enabled: false, note: "Services and deploys" },
    { id: "supabase", name: "Supabase", category: "Developer", enabled: false, note: "Databases and auth" },
    { id: "cloudflare", name: "Cloudflare", category: "Developer", enabled: false, note: "DNS, CDN, and security" }
  ];
  var CONNECTOR_HINT_KEY = "ai_connectors_hint_dismissed";
  function connectorList() {
    var raw = lsGet("ai_connectors");
    if (raw == null) { // first run: seed available-but-disabled entries
      lsSet("ai_connectors", JSON.stringify(CONNECTOR_SEEDS));
      return CONNECTOR_SEEDS.slice();
    }
    return lsJSON("ai_connectors", []);
  }
  function saveConnectors(list) { lsSet("ai_connectors", JSON.stringify(list)); }

  function paneConnectors() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Connectors"));
    pane.appendChild(el("p", "stg-pane-sub", "Data sources the assistant can reference in your answers."));

    // dismissible info line
    if (lsGet(CONNECTOR_HINT_KEY) !== "1") {
      var info = el("div", "stg-info");
      var infoTxt = el("p", null, "Connectors you enable here tell the assistant what data it may reference; live per-connector access is configured by the administrator.");
      var dismiss = el("button", "stg-icon-btn", svg("x"));
      dismiss.type = "button";
      dismiss.title = "Dismiss";
      dismiss.setAttribute("aria-label", "Dismiss connector info");
      dismiss.addEventListener("click", function () {
        lsSet(CONNECTOR_HINT_KEY, "1");
        renderPane("connectors");
      });
      info.appendChild(infoTxt);
      info.appendChild(dismiss);
      pane.appendChild(info);
    }

    // grouped connector list
    var wrap = el("div");
    function renderConnList() {
      wrap.innerHTML = "";
      var list = connectorList();
      if (!list.length) {
        wrap.appendChild(el("p", "stg-empty-note", "No connectors configured — add one below."));
      } else {
        var cats = [];
        list.forEach(function (c) { if (cats.indexOf(c.category) < 0) cats.push(c.category); });
        cats.forEach(function (cat) {
          wrap.appendChild(el("div", "stg-group-label", esc(cat)));
          list.filter(function (c) { return c.category === cat; }).forEach(function (c) {
            var rowEl = el("div", "stg-conn-row");
            var text = el("div", "stg-conn-text");
            text.appendChild(el("div", "stg-conn-name", esc(c.name)));
            if (c.note) text.appendChild(el("div", "stg-conn-note", esc(c.note)));
            rowEl.appendChild(text);
            if (cat === "Custom") {
              var del = el("button", "stg-icon-btn danger", svg("trash"));
              del.type = "button";
              del.title = "Remove connector";
              del.setAttribute("aria-label", "Remove " + c.name);
              del.addEventListener("click", function () {
                saveConnectors(connectorList().filter(function (x) { return x.id !== c.id; }));
                renderConnList();
              });
              rowEl.appendChild(del);
            }
            rowEl.appendChild(makeToggle(c.enabled, function (on) {
              var items = connectorList();
              var i = items.findIndex(function (x) { return x.id === c.id; });
              if (i >= 0) { items[i].enabled = on; saveConnectors(items); }
            }, c.name));
            wrap.appendChild(rowEl);
          });
        });
      }
    }
    renderConnList();
    pane.appendChild(wrap);

    // add custom connector
    var addWrap = el("div");
    addWrap.style.marginTop = "18px";
    var addBtn = el("button", "stg-btn ghost", "Add connector");
    addBtn.type = "button";
    addBtn.addEventListener("click", function () {
      addWrap.innerHTML = "";
      var form = el("div", "stg-memory-add");
      form.style.flexDirection = "column";
      var nameInput = el("input", "stg-input");
      nameInput.type = "text";
      nameInput.placeholder = "Connector name";
      nameInput.setAttribute("aria-label", "Connector name");
      var noteInput = el("input", "stg-input");
      noteInput.type = "text";
      noteInput.placeholder = "Note (optional) — what this source covers";
      noteInput.setAttribute("aria-label", "Connector note");
      var btns = el("div", "stg-confirm");
      var cancel = el("button", "stg-btn ghost", "Cancel");
      cancel.type = "button";
      var save = el("button", "stg-btn", "Add");
      save.type = "button";
      function commit() {
        var name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        var items = connectorList();
        items.push({ id: uid(), name: name, category: "Custom", enabled: false, note: noteInput.value.trim() });
        saveConnectors(items);
        renderConnList();
        resetForm();
      }
      function resetForm() {
        addWrap.innerHTML = "";
        addWrap.appendChild(addBtn);
      }
      nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); commit(); } });
      save.addEventListener("click", commit);
      cancel.addEventListener("click", resetForm);
      btns.appendChild(cancel); btns.appendChild(save);
      form.appendChild(nameInput); form.appendChild(noteInput); form.appendChild(btns);
      addWrap.appendChild(form);
      nameInput.focus();
    });
    addWrap.appendChild(addBtn);
    pane.appendChild(addWrap);

    pane.appendChild(el("p", "stg-empty-note", "Toggle changes take effect on the next answer."));
    return pane;
  }

  // ===== 6. Usage =====
  // ai_threads is stored most-recent-first (createThread unshifts; the server
  // merge appends remote-only rows). Locally created threads carry no
  // timestamps — only server-synced rows may keep updated_at/created_at.
  function threadTs(t) {
    var raw = t.updated_at || t.created_at || t.createdAt || t.ts;
    if (!raw) return null;
    var v = typeof raw === "number" ? raw : Date.parse(raw);
    return Number.isFinite(v) ? v : null;
  }
  function monthCounts() {
    var threads = lsJSON("ai_threads", []);
    var now = new Date();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    var monthThreads = 0, monthMsgs = 0, earlierThreads = 0, earlierMsgs = 0, hasTs = false;
    threads.forEach(function (t, i) {
      var msgs = Array.isArray(t.messages) ? t.messages.length : 0;
      var ts = threadTs(t);
      if (ts != null) {
        hasTs = true;
        if (ts >= monthStart) { monthThreads++; monthMsgs += msgs; }
        else { earlierThreads++; earlierMsgs += msgs; }
      } else {
        // No timestamp: estimate from position. The array is newest-first, so
        // untimestamped entries that appear before the newest timestamped
        // thread (and everything below it) can't be proven to fall in the
        // current month — bucket them conservatively as "Earlier" activity.
        earlierThreads++; earlierMsgs += msgs;
      }
    });
    return {
      monthThreads: monthThreads, monthMsgs: monthMsgs,
      earlierThreads: earlierThreads, earlierMsgs: earlierMsgs,
      hasTs: hasTs, totalThreads: threads.length
    };
  }
  window.UsageStats = { monthCounts: monthCounts };
  function paneUsage() {
    var s = monthCounts();
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Usage"));
    pane.appendChild(el("p", "stg-pane-sub", "Activity on this device, from your local thread library."));
    var grid = el("div", "stg-stats");
    function stat(num, lbl) {
      var c = el("div", "stg-stat");
      c.appendChild(el("div", "stg-stat-num", num));
      c.appendChild(el("div", "stg-stat-lbl", lbl));
      return c;
    }
    grid.appendChild(stat(String(s.totalThreads), "Total threads"));
    grid.appendChild(stat(String(s.monthMsgs + s.earlierMsgs), "Total messages"));
    grid.appendChild(stat(s.hasTs ? String(s.monthThreads) : "—", "Threads this month"));
    grid.appendChild(stat(s.hasTs ? String(s.monthMsgs) : "—", "Messages this month"));
    grid.appendChild(stat(String(s.earlierThreads), "Earlier threads (est.)"));
    grid.appendChild(stat(String(s.earlierMsgs), "Earlier messages (est.)"));
    pane.appendChild(grid);
    pane.appendChild(el("p", "stg-empty-note",
      "Month counts use recorded timestamps when present. Threads without timestamps \u2014 including those positioned before the newest timestamped thread \u2014 are estimated as earlier activity based on their position in your library."));
    return pane;
  }

  // ===== 7. Data controls =====
  var EXPORT_KEYS = ["ai_threads", "ai_spaces", "ai_theme", "ai_personalize", "ai_tone", "ai_memory",
    "ai_memory_items", "ai_site_instructions", "ai_notify_inapp", "ai_notify_email",
    "ai_connectors", "ai_connectors_hint_dismissed",
    "voiceOn", "sidebarWidth", "answerWidth", "answerWidthPx", "artifactWidth"];
  var ALL_KEYS = EXPORT_KEYS.slice();

  function downloadExport() {
    var data = { exportedAt: new Date().toISOString(), version: VERSION, data: {} };
    EXPORT_KEYS.forEach(function (k) { if (lsGet(k) != null) data.data[k] = lsGet(k); });
    // keep raw types for the two JSON-stored keys
    data.data.ai_threads = lsJSON("ai_threads", []);
    data.data.ai_spaces = lsJSON("ai_spaces", []);
    data.data.ai_memory_items = lsJSON("ai_memory_items", []);
    data.data.ai_connectors = lsJSON("ai_connectors", []);
    var blob;
    try { blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); }
    catch (e) { return; }
    var a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ai-spaincos-export-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // Two-step confirm: click → armed (danger, "click again") → fires.
  function twoStepConfirm(btnLabel, onConfirm) {
    var box = el("div", "stg-confirm");
    var btn = el("button", "stg-btn danger", btnLabel);
    btn.type = "button";
    var armed = false, timer = null;
    btn.addEventListener("click", function () {
      if (!armed) {
        armed = true;
        btn.classList.add("solid");
        btn.textContent = "Click again to confirm";
        var warn = el("span", "stg-warn", "This cannot be undone.");
        if (!box.querySelector(".stg-warn")) box.appendChild(warn);
        timer = setTimeout(function () { reset(); }, 5000);
        return;
      }
      clearTimeout(timer);
      onConfirm();
    });
    function reset() {
      armed = false;
      btn.classList.remove("solid");
      btn.textContent = btnLabel;
      var w = box.querySelector(".stg-warn"); if (w) w.remove();
    }
    box.appendChild(btn);
    return box;
  }

  function paneData() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Data controls"));
    pane.appendChild(el("p", "stg-pane-sub", "Export or delete the data stored on this device."));

    // Export
    var exBtn = el("button", "stg-btn", svg("download") + " Export all data");
    exBtn.type = "button";
    exBtn.addEventListener("click", downloadExport);
    pane.appendChild(row("Export data",
      "Download a JSON file with your threads, spaces, and settings.",
      exBtn));

    // Delete all threads (confirm twice)
    pane.appendChild(row("Delete all threads",
      "Removes every thread stored on this device. Server-synced copies remain in your account.",
      twoStepConfirm("Delete all threads", function () {
        lsDel("ai_threads");
        location.reload();
      })));

    // Delete everything (confirm twice + typed DELETE)
    var wrap = el("div", "stg-confirm");
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "flex-start";
    var startBtn = el("button", "stg-btn danger", "Delete everything");
    startBtn.type = "button";
    var stage = el("div", "stg-confirm");
    function renderStart() {
      stage.innerHTML = "";
      startBtn.classList.remove("solid");
      startBtn.textContent = "Delete everything";
      stage.appendChild(startBtn);
    }
    startBtn.addEventListener("click", function () {
      // confirm #1
      stage.innerHTML = "";
      var p = el("p", "stg-desc", "This erases <b>all</b> local data: threads, spaces, memories, and every setting on this device.");
      p.style.color = "var(--error)";
      var contBtn = el("button", "stg-btn danger", "Yes, continue");
      contBtn.type = "button";
      stage.appendChild(p);
      stage.appendChild(contBtn);
      contBtn.focus();
      contBtn.addEventListener("click", function () {
        // confirm #2 + typed DELETE
        stage.innerHTML = "";
        var p2 = el("p", "stg-desc", "Last chance — type <b>DELETE</b> to confirm.");
        var input = el("input", "stg-input narrow");
        input.type = "text";
        input.placeholder = "Type DELETE";
        input.autocomplete = "off";
        input.setAttribute("aria-label", "Type DELETE to confirm");
        var finalBtn = el("button", "stg-btn danger solid", "Erase everything");
        finalBtn.type = "button";
        finalBtn.disabled = true;
        input.addEventListener("input", function () {
          finalBtn.disabled = input.value.trim() !== "DELETE";
        });
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && input.value.trim() === "DELETE") { e.preventDefault(); erase(); }
        });
        function erase() {
          ALL_KEYS.forEach(function (k) { lsDel(k); });
          location.reload();
        }
        finalBtn.addEventListener("click", erase);
        stage.appendChild(p2);
        stage.appendChild(input);
        stage.appendChild(finalBtn);
        input.focus();
      });
    });
    renderStart();
    pane.appendChild(row("Delete everything",
      "Clears all local data on this device and signs you out of stored preferences.",
      stage));
    return pane;
  }

  // ===== 8. About =====
  function paneAbout() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "About"));
    pane.appendChild(el("p", "stg-pane-sub", "ai.spaincos.com — a Perplexity-style gateway to open-weight models."));

    pane.appendChild(row("Version", null, el("span", "stg-version-chip", VERSION)));

    var email = (typeof currentUser !== "undefined" && currentUser && currentUser.email) || "";
    if (email) pane.appendChild(row("Account", null, el("span", "stg-desc", esc(email))));

    // keyboard shortcuts
    var kbdBtn = el("button", "stg-link", "View keyboard shortcuts");
    kbdBtn.type = "button";
    kbdBtn.addEventListener("click", function () {
      if (typeof window.openShortcutsHelp === "function") window.openShortcutsHelp();
    });
    pane.appendChild(row("Keyboard shortcuts", null, kbdBtn));

    // sign out
    var outBtn = el("button", "stg-btn danger", svg("out") + " Sign out");
    outBtn.type = "button";
    outBtn.addEventListener("click", async function () {
      outBtn.disabled = true;
      outBtn.textContent = "Signing out\u2026";
      try { if (typeof sb !== "undefined" && sb && sb.auth) await sb.auth.signOut(); }
      catch (e) { /* best-effort */ }
      currentUser = null;
      location.reload();
    });
    pane.appendChild(row("Sign out", "Ends your session on this device.", outBtn));
    return pane;
  }

  var RENDERERS = {
    preferences: panePreferences, personalize: panePersonalize, memory: paneMemory,
    instructions: paneInstructions, notifications: paneNotifications,
    connectors: paneConnectors,
    usage: paneUsage, data: paneData, about: paneAbout
  };

  // ---------- overlay shell ----------
  var overlay = null, panel = null, navEl = null, contentEl = null, lastFocus = null;

  function focusables() {
    if (!panel) return [];
    return Array.prototype.filter.call(
      panel.querySelectorAll("button, input, select, textarea, [href], [tabindex]:not([tabindex='-1'])"),
      function (n) { return !n.disabled && n.offsetParent !== null; }
    );
  }
  function onKey(e) {
    if (!panel) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    var f = focusables();
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1];
    var ae = document.activeElement;
    if (e.shiftKey && (ae === first || !panel.contains(ae))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && ae === last) { e.preventDefault(); first.focus(); }
    else if (!panel.contains(ae)) { e.preventDefault(); first.focus(); }
  }

  function renderPane(id) {
    activePane = id;
    if (contentEl) {
      contentEl.innerHTML = "";
      contentEl.setAttribute("aria-labelledby", "stg-tab-" + id);
      contentEl.appendChild(RENDERERS[id]());
    }
    if (navEl) {
      navEl.querySelectorAll(".stg-nav-btn").forEach(function (b) {
        b.setAttribute("aria-selected", String(b.dataset.pane === id));
      });
    }
  }

  function build() {
    overlay = el("div", "stg-overlay");
    panel = el("div", "stg-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Settings");

    // header
    var head = el("div", "stg-head");
    head.appendChild(el("h2", null, "Settings"));
    var closeBtn = el("button", "stg-close", svg("x"));
    closeBtn.type = "button";
    closeBtn.title = "Close settings";
    closeBtn.setAttribute("aria-label", "Close settings");
    closeBtn.addEventListener("click", close);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    // body: nav + content
    var body = el("div", "stg-body");
    navEl = el("nav", "stg-nav");
    navEl.setAttribute("role", "tablist");
    navEl.setAttribute("aria-label", "Settings sections");
    PANES.forEach(function (p) {
      var b = el("button", "stg-nav-btn", svg(p.icon) + "<span>" + esc(p.label) + "</span>");
      b.type = "button";
      b.id = "stg-tab-" + p.id;
      b.dataset.pane = p.id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", "false");
      b.setAttribute("aria-controls", "stg-content");
      b.addEventListener("click", function () { renderPane(p.id); contentEl.focus(); });
      navEl.appendChild(b);
    });
    body.appendChild(navEl);

    contentEl = el("div", "stg-content");
    contentEl.id = "stg-content";
    contentEl.setAttribute("role", "tabpanel");
    contentEl.tabIndex = -1;
    body.appendChild(contentEl);
    panel.appendChild(body);
    overlay.appendChild(panel);

    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey, true);
  }

  function open(paneId) {
    var valid = PANES.some(function (p) { return p.id === paneId; });
    if (overlay) { renderPane(valid ? paneId : activePane); return; }
    lastFocus = document.activeElement;
    build();
    renderPane(valid ? paneId : "preferences");
    var host = document.getElementById("moduleRoot") || document.body;
    host.appendChild(overlay);
    var f = focusables();
    if (f.length) f[0].focus();
  }
  function close() {
    if (!overlay) return;
    document.removeEventListener("keydown", onKey, true);
    overlay.remove();
    overlay = panel = navEl = contentEl = null;
    if (lastFocus && typeof lastFocus.focus === "function") {
      try { lastFocus.focus(); } catch (e) {}
    }
    lastFocus = null;
  }

  // Public read APIs for the host app (no fetch needed):
  //   window.ConnectorPrefs.list() -> [{id, name, category, enabled, note}]
  //   window.ConnectorPrefs.enabled() -> [names of enabled connectors]
  //   window.UsageStats.monthCounts() -> {monthThreads, monthMsgs, earlierThreads, earlierMsgs, hasTs, totalThreads}
  window.ConnectorPrefs = {
    list: connectorList,
    enabled: function () { return connectorList().filter(function (c) { return c.enabled; }).map(function (c) { return c.name; }); }
  };
  window.SettingsUI = { open: open, close: close };
})();
