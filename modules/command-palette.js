/* command-palette.js — Keyboard command palette (Parity doc §34b) for ai.spaincos.com.
   Cmd/Ctrl+K opens a Perplexity-style palette: one-tap actions, thread search and
   example research prompts, all local (no backend). Reuses the site's modal CSS
   tokens (var(--bg), var(--border), var(--accent), …) and global entry points
   (newThread, submitQuery, SettingsUI, LibraryUI, FleetUI) — zero inline-script edits. */
(function (root) {
  "use strict";

  /* ---------------- Pure: fuzzy matcher ----------------
     Subsequence match with scoring: exact substring > word-start > plain
     subsequence; contiguous runs and matches near the start rank higher.
     Returns a score (higher = better) or null when there is no match. */
  function fuzzyScore(query, text) {
    var q = String(query || "").toLowerCase();
    var t = String(text || "").toLowerCase();
    if (!q) return 1;
    if (!t) return null;
    var idx = t.indexOf(q);
    if (idx === 0) return 1000;            // exact prefix — best
    if (idx > 0) return 600 - Math.min(idx, 100); // substring anywhere
    // subsequence walk
    var qi = 0, score = 0, last = -2, streak = 0;
    var wordStarts = wordStartIndexes(t);
    for (var ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        streak = ti === last + 1 ? streak + 1 : 0;
        var s = 10;
        if (qi === 0 && wordStarts.indexOf(ti) !== -1) s = 30; // first char at a word start
        else if (wordStarts.indexOf(ti) !== -1) s = 18;         // later chars at word starts
        score += s + streak * 2;
        if (ti === 0) score += 5;          // match at the very start
        last = ti;
        qi++;
      }
    }
    return qi === q.length ? score : null;
  }

  function wordStartIndexes(t) {
    var out = [], i;
    for (i = 0; i < t.length; i++) {
      var prev = i > 0 ? t[i - 1] : " ";
      if (t[i] !== " " && (prev === " " || prev === "/" || prev === "-" || prev === "_" || prev === "." || prev === "(") ) out.push(i);
    }
    return out;
  }

  /* Pure: fuzzy-match a list of {item, text} pairs; returns matches sorted best-first. */
  function fuzzySearch(query, entries) {
    var q = String(query || "").trim();
    var out = [];
    (entries || []).forEach(function (e) {
      var s = fuzzyScore(q, e.text);
      if (s !== null) out.push({ item: e.item, score: s });
    });
    out.sort(function (a, b) { return b.score - a.score || (a.item.order || 0) - (b.item.order || 0); });
    return out.map(function (o) { return o.item; });
  }

  /* ---------------- Pure: action registry ----------------
     Actions declare id/name/section/keywords and an optional `run(ctx)` where
     ctx = { window } so tests can verify wiring without a browser. */
  var RESEARCH_PROMPTS = [
    { name: "Research: competitive landscape of AI gateways", prompt: "Research the competitive landscape of AI gateways. Compare leading platforms on pricing, model coverage, rate limits and differentiation, and summarize with sources." },
    { name: "Research: latest AI model releases", prompt: "Research the most recent AI model releases. For each, cover capabilities, benchmarks, availability and pricing, with cited sources." },
    { name: "Research: best practices for RAG pipelines", prompt: "Research current best practices for building retrieval-augmented generation (RAG) pipelines: chunking, embedding choice, reranking and evaluation. Summarize with sources." }
  ];

  function buildActions() {
    var actions = [
      { id: "new-thread", name: "New thread", section: "Actions", keywords: "new chat start thread", order: 1,
        run: function (ctx) { var w = (ctx && ctx.window) || root; if (typeof w.newThread === "function") w.newThread(); } },
      { id: "search-threads", name: "Search threads", section: "Actions", keywords: "find history thread sidebar filter", order: 2,
        run: function (ctx) { focusThreadSearch(ctx); } },
      { id: "open-settings", name: "Open Settings", section: "Actions", keywords: "settings preferences account", order: 3,
        run: function (ctx) { var w = (ctx && ctx.window) || root; if (w.SettingsUI && w.SettingsUI.open) w.SettingsUI.open(); } },
      { id: "settings-connectors", name: "Open Settings → Connectors", section: "Actions", keywords: "settings connectors apps integrations", order: 4,
        run: function (ctx) { openSettingsPane(ctx, "connectors"); } },
      { id: "settings-automations", name: "Open Settings → Automations", section: "Actions", keywords: "settings automations recurring schedule", order: 5,
        run: function (ctx) { openSettingsPane(ctx, "automations"); } },
      { id: "settings-skills", name: "Open Settings → Skills", section: "Actions", keywords: "settings skills prompts", order: 6,
        run: function (ctx) { openSettingsPane(ctx, "skills"); } },
      { id: "settings-artifacts", name: "Open Settings → Artifacts", section: "Actions", keywords: "settings artifacts library saved", order: 7,
        run: function (ctx) { openSettingsPane(ctx, "artifacts"); } },
      { id: "open-library", name: "Open Library", section: "Actions", keywords: "library saved threads artifacts", order: 8,
        run: function (ctx) { openLazyModule(ctx, "library", "LibraryUI", "open"); } },
      { id: "open-fleet", name: "Open Fleet", section: "Actions", keywords: "fleet agents guardians registry", order: 9,
        run: function (ctx) { openLazyModule(ctx, "fleet", "FleetUI", "open"); } },
      { id: "toggle-theme", name: "Toggle theme", section: "Actions", keywords: "theme dark light appearance mode", order: 10,
        run: function (ctx) {
          var w = (ctx && ctx.window) || root;
          if (typeof w.setTheme !== "function") return;
          w.setTheme((w.document && w.document.documentElement.getAttribute("data-theme")) === "dark" ? "light" : "dark");
        } }
    ];
    RESEARCH_PROMPTS.forEach(function (r, i) {
      actions.push({
        id: "prompt-" + (i + 1), name: r.name, section: "Research", keywords: "research example prompt query", order: 20 + i,
        run: function (ctx) { var w = (ctx && ctx.window) || root; if (typeof w.submitQuery === "function") w.submitQuery(r.prompt); }
      });
    });
    return actions;
  }

  function openSettingsPane(ctx, pane) {
    var w = (ctx && ctx.window) || root;
    if (w.SettingsUI && w.SettingsUI.open) w.SettingsUI.open(pane);
  }
  function openLazyModule(ctx, name, globalName, method) {
    var w = (ctx && ctx.window) || root;
    if (typeof w.openModule === "function") { w.openModule(name, globalName, method); return; }
    var g = w[globalName];
    if (g && typeof g[method] === "function") g[method]();
  }
  function focusThreadSearch(ctx) {
    var w = (ctx && ctx.window) || root;
    var ts = w.document && w.document.getElementById("threadSearch");
    if (!ts) return;
    // filter the sidebar's thread list client-side with the palette query, then hand focus over
    if (ctx && typeof ctx.query === "string" && ctx.query.trim()) {
      ts.value = ctx.query.trim();
      ts.dispatchEvent(new w.Event("input", { bubbles: true }));
    }
    ts.focus();
    try { ts.setSelectionRange(ts.value.length, ts.value.length); } catch (e) {}
  }

  var pureApi = {
    fuzzyScore: fuzzyScore,
    fuzzySearch: fuzzySearch,
    buildActions: buildActions,
    RESEARCH_PROMPTS: RESEARCH_PROMPTS,
    RESULT_LIMIT: 12
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = pureApi;
    return;
  }

  /* ---------------- Browser: palette UI ---------------- */
  var overlay = null, input = null, listEl = null, sel = 0, results = [], actions = [];

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

  function injectStyles() {
    if (document.getElementById("cp-styles")) return;
    var st = document.createElement("style");
    st.id = "cp-styles";
    st.textContent = [
      ".cp-overlay{position:fixed;inset:0;z-index:420;background:rgba(0,0,0,.45);display:flex;justify-content:center;align-items:flex-start;padding:12vh 16px 16px;font-family:var(--font-sans)}",
      ".cp-overlay[hidden]{display:none}",
      ".cp-panel{background:var(--bg);color:var(--text);border:1px solid var(--border-light,var(--border));border-radius:var(--radius);width:min(640px,100%);max-height:70vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden}",
      ".cp-input{width:100%;box-sizing:border-box;background:var(--bg-input,var(--bg-elevated));border:0;border-bottom:1px solid var(--border);color:var(--text);font:inherit;font-size:15.5px;padding:15px 18px;outline:none}",
      ".cp-input::placeholder{color:var(--text-faint)}",
      ".cp-list{list-style:none;margin:0;padding:6px;overflow-y:auto}",
      ".cp-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--radius-sm);cursor:pointer;border:1px solid transparent}",
      ".cp-item[aria-selected=true]{background:var(--accent-light);border-color:transparent}",
      ".cp-item-icon{width:28px;height:28px;border-radius:var(--radius-sm);background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;color:var(--accent);flex-shrink:0}",
      ".cp-item-icon svg{width:15px;height:15px}",
      ".cp-item-name{flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".cp-item-kicker{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin:8px 12px 2px}",
      ".cp-foot{display:flex;justify-content:space-between;gap:10px;padding:8px 14px;border-top:1px solid var(--border);color:var(--text-muted);font-size:11.5px}",
      ".cp-foot kbd{background:var(--bg-elevated);border:1px solid var(--border-light,var(--border));border-radius:4px;padding:1px 5px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px}",
      ".cp-empty{padding:24px;color:var(--text-muted);text-align:center;font-size:13px}"
    ].join("");
    document.head.appendChild(st);
  }

  var ICONS = {
    "new-thread": '<path d="M12 5v14M5 12h14"/>',
    "search-threads": '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    "open-settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    "open-library": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    "open-fleet": '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    "toggle-theme": '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    "prompt": '<path d="M4 4h16v12H4z"/><path d="M4 16l-2 4"/><path d="m8 8 8 0M8 12h5"/>'
  };

  function collectThreads() {
    var out = [];
    var sidebar = document.getElementById("threadItems");
    if (sidebar) {
      // live sidebar rows (already space-filtered)
      Array.prototype.forEach.call(sidebar.querySelectorAll(".thread-item"), function (row) {
        var span = row.querySelector("span");
        if (span) out.push({ id: null, el: row, title: span.textContent, order: 40 });
      });
      return out;
    }
    return out;
  }

  function computeResults(q) {
    var entries = actions.map(function (a) {
      return { item: { type: "action", action: a, name: a.name, order: a.order }, text: a.name + " " + (a.keywords || "") };
    });
    collectThreads().forEach(function (t) {
      entries.push({ item: { type: "thread", thread: t, name: t.title, order: t.order }, text: t.title });
    });
    var seen = {}, uniq = [];
    fuzzySearch(q, entries).forEach(function (m) {
      if (seen[m.name]) return;
      seen[m.name] = 1;
      uniq.push(m);
    });
    return uniq.slice(0, pureApi.RESULT_LIMIT);
  }

  function render() {
    if (!listEl) return;
    results = computeResults(input.value);
    sel = Math.min(sel, Math.max(0, results.length - 1));
    if (!results.length) {
      listEl.innerHTML = '<li class="cp-empty">No matches. Try a thread title or an action like "settings".</li>';
      return;
    }
    var html = "", lastSection = null;
    results.forEach(function (r, i) {
      var sec = r.type === "action" ? r.action.section : "Threads";
      if (sec !== lastSection) { html += '<li class="cp-item-kicker">' + esc(sec) + "</li>"; lastSection = sec; }
      var icon = r.type === "action" ? (ICONS[r.action.id] || ICONS.prompt) : ICONS["search-threads"];
      html += '<li class="cp-item" role="option" aria-selected="' + (i === sel) + '" data-i="' + i + '">' +
        '<span class="cp-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + icon + "</svg></span>" +
        '<span class="cp-item-name">' + esc(r.name) + "</span></li>";
    });
    listEl.innerHTML = html;
  }

  function move(delta) {
    if (!results.length) return;
    sel = (sel + delta + results.length) % results.length;
    render();
    var el = listEl.querySelector('[data-i="' + sel + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }

  function runSelected() {
    var r = results[sel];
    if (!r) return;
    var q = input ? input.value : "";
    close();
    if (r.type === "thread" && r.thread.el) {
      var el = r.thread.el;
      if (typeof el.click === "function") el.click();
      else if (el.onclick) el.onclick();
    } else if (r.type === "action") {
      r.action.run({ window: window, query: q });
    }
  }

  function open() {
    if (overlay) { input.focus(); input.select(); return; }
    injectStyles();
    overlay = document.createElement("div");
    overlay.className = "cp-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Command palette");
    overlay.innerHTML =
      '<div class="cp-panel">' +
      '<input class="cp-input" id="cpInput" type="text" placeholder="Search actions and threads, or type a query…" autocomplete="off" spellcheck="false" aria-label="Command palette input">' +
      '<ul class="cp-list" id="cpList" role="listbox" aria-label="Results"></ul>' +
      '<div class="cp-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>↵</kbd> run · <kbd>esc</kbd> close</span><span><kbd>⌘</kbd><kbd>K</kbd> toggle</span></div>' +
      "</div>";
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    input = overlay.querySelector("#cpInput");
    listEl = overlay.querySelector("#cpList");
    listEl.addEventListener("mousedown", function (e) {
      var li = e.target.closest && e.target.closest(".cp-item");
      if (!li) return;
      e.preventDefault();
      sel = parseInt(li.getAttribute("data-i"), 10) || 0;
      runSelected();
    });
    input.addEventListener("input", function () { sel = 0; render(); });
    sel = 0;
    render();
    input.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null; input = null; listEl = null; results = []; sel = 0;
  }

  function onKey(e) {
    var k = e.key;
    if ((e.metaKey || e.ctrlKey) && (k === "k" || k === "K")) {
      e.preventDefault();
      e.stopPropagation();
      if (overlay) close(); else open();
      return;
    }
    if (!overlay) return;
    if (k === "Escape") { e.preventDefault(); close(); }
    else if (k === "ArrowDown") { e.preventDefault(); move(1); }
    else if (k === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (k === "Enter") { e.preventDefault(); runSelected(); }
  }

  actions = buildActions();
  document.addEventListener("keydown", onKey, true);

  root.CommandPalette = {
    open: open,
    close: close,
    computeResults: computeResults,
    actions: actions
  };
})(typeof window !== "undefined" ? window : globalThis);
