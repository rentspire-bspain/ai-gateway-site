/* OnboardingUI (34e) — Getting-started polish for ai.spaincos.com:
   1. First-run onboarding overlay (#tour): shown only when localStorage['pplx-onboarded']
      is absent on the landing surface; 4 compact steps, skippable, sets the flag.
   2. Empty-state guidance: when #landingInput is empty and no threads exist, renders
      6 runnable example prompt chips under the search box; clicking one fills and submits.
   Exposes window.OnboardingUI for programmatic control and node:test unit verification. */
(function () {
  "use strict";

  var STORAGE_KEY = "pplx-onboarded";

  var STEPS = [
    {
      id: "ask",
      title: "Ask anything \u2014 live web research with citations",
      body: "Every question searches live web sources, synthesizes answers with inline citations, and surfaces one-tap follow-up chips. Press / to focus the search box or type @ to reference connectors, projects, and past threads.",
      pills: ["Live citations", "@-mentions", "One-tap follow-ups"],
      icon: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6M11 8v6"/>'
    },
    {
      id: "files-docs",
      title: "Attach files and generate docs/tables",
      body: "Drop or attach CSVs, Markdown, JSON, PDFs, or screenshots into the composer. Ask for structured underwriting memos, rent-comp tables, or downloadable Markdown, Word, and spreadsheet files in the Docs & Artifacts panel.",
      pills: ["Drag & drop files", "Docs side-panel", "Artifact library"],
      icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>'
    },
    {
      id: "models",
      title: "Model picker \u2014 pick the lane that fits the task",
      body: "Start on Auto (GLM-5.3) for everyday research, switch to DeepSeek R1 or Kimi K3.1 Pro for hard reasoning and long context, Flint or Qwen3 Coder for engineering, or toggle Research and Council right inside the composer.",
      pills: ["Auto \u00b7 R1 \u00b7 Kimi", "Deep Research", "Model Council"],
      icon: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
    },
    {
      id: "settings",
      title: "Settings \u2014 connectors, fleet, tasks, automations",
      body: "Turn 20 minutes of inbox, calendar, or folder digging into one cited question. Link OAuth sources in Settings \u2192 Connectors, schedule recurring jobs in Tasks & Automations, and monitor runs in Fleet.",
      pills: ["OAuth Connectors", "Tasks & Automations", "Fleet & QA"],
      icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
    }
  ];

  var CONNECTOR_EXAMPLES = [
    {
      id: "gmail",
      capability: "Gmail connected",
      provider: "google",
      fallbackProviders: [],
      before: "20 minutes of scrolling \u2192 one question, cited",
      prompt: "What did my accountant say about the Q3 invoices?",
      after: "Answers cited from your inbox, no digging."
    },
    {
      id: "calendar",
      capability: "Calendar connected",
      provider: "google",
      fallbackProviders: [],
      before: "20 minutes of tab-hopping \u2192 one question, cited",
      prompt: "What's on my plate Thursday and when should I leave for the 2pm?",
      after: "Reads your real schedule and travel window."
    },
    {
      id: "files",
      capability: "Files connected",
      provider: "dropbox",
      fallbackProviders: ["google"],
      before: "20 minutes of folder hunting \u2192 one question, cited",
      prompt: "Summarize the contract my lawyer sent last week",
      after: "Your documents become searchable, cited context."
    }
  ];

  var CONNECTOR_BENEFITS = [
    {
      id: "ownership",
      title: "Your data stays yours",
      body: "Row-level security (RLS) isolates every token per user \u2014 disconnect and delete anytime."
    },
    {
      id: "citations",
      title: "Answers cite your real emails & files",
      body: "Inline citations point back to the exact message, calendar invite, or document."
    },
    {
      id: "history",
      title: "History-aware across devices",
      body: "Threads and connected context stay synced wherever you sign in."
    },
    {
      id: "incognito",
      title: "Incognito available",
      body: "Switch on Incognito anytime for off-the-record questions with zero saved history."
    }
  ];

  var EXAMPLE_PROMPTS = [
    {
      id: "cap-rates",
      tag: "Live research",
      query: "Research Redondo Beach multifamily cap rates with live data"
    },
    {
      id: "loan-limits",
      tag: "Lending",
      query: "Compare FHA vs conventional loan limits 2026"
    },
    {
      id: "rent-comps",
      tag: "Table \u00b7 Comps",
      query: "Build a rent-comp table for Austin TX ZIP 78704"
    },
    {
      id: "comptrove",
      tag: "Comptrove",
      query: "What's in my Comptrove coverage for Maricopa County?"
    },
    {
      id: "underwriting-doc",
      tag: "Artifact \u00b7 Doc",
      query: "Draft a 50-unit multifamily acquisition underwriting checklist as a Markdown doc"
    },
    {
      id: "hud-fmr",
      tag: "HUD \u00b7 Macro",
      query: "Compare FY2026 HUD Fair Market Rents across Phoenix, Dallas, and Tampa"
    }
  ];

  var state = {
    open: false,
    step: 0,
    emptyPromptsVisible: false,
    demoNotice: null
  };


  /* ---- v212 §26e item 3: Getting-started checklist with self-check-off states ----
     Auto-detected items check themselves off from live app state (threads,
     connectors, artifacts, skills, model choice); the user can also click any
     item to check it off manually (auto-flags win over manual only when true).
     Persisted in localStorage 'ai_checklist' as { manual: {id: ts} }. */
  var CHECKLIST_KEY = "ai_checklist";

  var CHECKLIST = [
    { id: "first-question", label: "Ask your first question", hint: "Any query \u2014 live web research with citations." },
    { id: "connect-source",  label: "Connect a data source", hint: "Slack, Dropbox, Google Drive, or Comptrove in Settings \u2192 Connectors." },
    { id: "make-artifact",   label: "Create a doc, table, or file", hint: "Ask for a memo, rent-comp table, or Word/Excel/PDF export." },
    { id: "save-skill",      label: "Save a custom skill", hint: "Settings \u2192 Skills \u2014 reusable prompt + tool recipes." },
    { id: "pick-model",      label: "Try a model or Research mode", hint: "Auto for everyday, R1/Kimi Pro for hard reasoning, Research for depth." },
    { id: "automate",        label: "Set up an automation or fleet task", hint: "Schedule recurring jobs in Tasks & Automations, or dispatch the fleet." }
  ];

  function manualMap() {
    try {
      var raw = JSON.parse(lsGet(CHECKLIST_KEY) || "{}");
      return raw && typeof raw.manual === "object" && raw.manual ? raw.manual : {};
    } catch (e) { return {}; }
  }

  function setManual(id, on) {
    var m = manualMap();
    if (on) m[id] = Date.now(); else delete m[id];
    lsSet(CHECKLIST_KEY, JSON.stringify({ manual: m }));
  }

  function detectChecklistAuto() {
    var auto = {};
    try {
      if (getThreadCount() > 0) auto["first-question"] = 1;
    } catch (e) {}
    try {
      var conns = {};
      try { conns = JSON.parse(lsGet("ai_conn_watch") || "{}") || {}; } catch (e2) {}
      var connected = Object.keys(conns).filter(function (k) { return conns[k]; }).length > 0;
      if (!connected && window.ConnectorsUI && typeof window.ConnectorsUI.hasAnyConnected === "function") {
        connected = !!window.ConnectorsUI.hasAnyConnected();
      }
      if (!connected && window.ConnectorUI && typeof window.ConnectorUI.connectedCount === "function") {
        connected = (window.ConnectorUI.connectedCount() || 0) > 0;
      }
      if (connected) auto["connect-source"] = 1;
    } catch (e) {}
    try {
      var arts = [];
      try { arts = JSON.parse(lsGet("ai_artifacts") || "[]") || []; } catch (e2) {}
      if (Array.isArray(arts) && arts.length > 0) auto["make-artifact"] = 1;
    } catch (e) {}
    try {
      if (window.SkillsUI && typeof window.SkillsUI.cachedItems === "function") {
        var skills = window.SkillsUI.cachedItems() || [];
        if (skills.length > 0) auto["save-skill"] = 1;
      }
    } catch (e) {}
    try {
      var model = lsGet("pplx-model");
      if (model && model !== "auto") auto["pick-model"] = 1;
    } catch (e) {}
    return auto;
  }

  /* v226: the "automate" checklist item now self-checks from the DATABASE (the last
   * auto-flag gap — GettingStarted completion). Any automation row OR fleet dispatch
   * in the user's own history marks it done automatically. Runs after render; if it
   * flips the flag the checklist re-renders. */
  function detectAutomateAsync() {
    try {
      var sbClient = (typeof sb !== "undefined") ? sb : window.sb;
      if (!sbClient || !sbClient.auth || typeof sbClient.auth.getSession !== "function") return;
      sbClient.auth.getSession().then(function (r) {
        var tok = r && r.data && r.data.session && r.data.session.access_token;
        if (!tok) return;
        var H = { apikey: window.SUPABASE_ANON || "", Authorization: "Bearer " + tok };
        var SB_REST = "https://bnxermyboeigvwonfrzx.supabase.co/rest/v1";
        var check = SB_REST + "/automations?select=id&limit=1";
        fetch(check, { headers: H }).then(function (res) {
          if (!res.ok) return fetch(SB_REST + "/fleet_dispatch?select=id&limit=1", { headers: H });
          return res;
        }).then(function (res) {
          if (!res || !res.ok) return;
          return res.json().then(function (rows) {
            if (Array.isArray(rows) && rows.length > 0) {
              var cur = window.__obAutoCache || {};
              if (!cur["automate"]) {
                cur["automate"] = 1;
                window.__obAutoCache = cur;
                if (typeof window.OnboardingUI !== "undefined" && typeof window.OnboardingUI.refresh === "function") {
                  window.OnboardingUI.refresh();
                }
              }
            }
          });
        }).catch(function () {});
      }).catch(function () {});
    } catch (e) { /* best effort */ }
  }

  function checklistState() {
    var manual = manualMap();
    var auto = detectChecklistAuto();
    var done = 0;
    var items = CHECKLIST.map(function (it) {
      var isAuto = !!auto[it.id];
      var isManual = !!manual[it.id];
      var checked = isAuto || isManual;
      if (checked) done += 1;
      return { id: it.id, label: it.label, hint: it.hint, checked: checked, auto: isAuto, manual: isManual };
    });
    return { total: CHECKLIST.length, done: done, items: items };
  }

  function checklistCardHtml(st) {
    var pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
    var rows = st.items.map(function (it) {
      return '<li class="ob-cl-row' + (it.checked ? " done" : "") + '" data-cl-id="' + esc(it.id) + '" role="checkbox" tabindex="0" aria-checked="' + (it.checked ? "true" : "false") + '">' +
        '<span class="ob-cl-box" aria-hidden="true">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
        "</span>" +
        '<span class="ob-cl-copy"><span class="ob-cl-label">' + esc(it.label) + "</span>" +
        '<span class="ob-cl-hint">' + esc(it.hint) + "</span></span>" +
        (it.auto ? '<span class="ob-cl-auto" title="Completed automatically from your activity">auto</span>' : "") +
      "</li>";
    }).join("");
    return '<div class="ob-cl-card" data-ob-checklist="1">' +
      '<div class="ob-cl-head"><span class="ob-cl-title">Getting-started checklist</span>' +
      '<span class="ob-cl-count">' + st.done + " of " + st.total + "</span></div>" +
      '<div class="ob-cl-bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct + '%"></span></div>' +
      '<ul class="ob-cl-list">' + rows + "</ul>" +
      (st.done === st.total ? '<div class="ob-cl-done">All set \u2014 ai.spaincos.com is fully yours. Click any item to uncheck it.</div>' : "") +
      "</div>";
  }

  function mountChecklist() {
    var host = document.getElementById("suggestions");
    if (!host) return null;
    var card = host.querySelector('[data-ob-checklist]');
    if (!card) {
      card = document.createElement("div");
      card.setAttribute("data-ob-checklist", "1");
      // insert after the persuasion panel (or example grid) inside #suggestions
      var persuade = null;
      if (host.children) {
        for (var k = 0; k < host.children.length; k++) {
          if (host.children[k] && host.children[k].getAttribute && host.children[k].getAttribute("data-ob-persuasion") === "1") {
            persuade = host.children[k];
            break;
          }
        }
      }
      var anchor = persuade || host.querySelector(".ob-example-grid");
      if (anchor && anchor.parentNode === host && anchor.nextSibling && typeof host.insertBefore === "function") host.insertBefore(card, anchor.nextSibling);
      else host.appendChild(card);
      host.addEventListener("click", function (e) {
        var row = e.target && e.target.closest ? e.target.closest("[data-cl-id]") : null;
        if (!row) return;
        e.preventDefault();
        toggleChecklistRow(row.getAttribute("data-cl-id"));
      });
      host.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        var row = e.target && e.target.closest ? e.target.closest("[data-cl-id]") : null;
        if (!row) return;
        e.preventDefault();
        toggleChecklistRow(row.getAttribute("data-cl-id"));
      });
    }
    card.innerHTML = checklistCardHtml(checklistState());
    return card;
  }

  function toggleChecklistRow(id) {
    var st = checklistState();
    var it = st.items.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    // auto-detected items toggle a manual override OFF; unchecked items self-check-off
    setManual(id, !it.checked);
    mountChecklist();
  }

  var tourEl = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function lsGet(k) {
    try { return window.localStorage ? window.localStorage.getItem(k) : null; } catch (e) { return null; }
  }

  function lsSet(k, v) {
    try { if (window.localStorage) window.localStorage.setItem(k, String(v)); } catch (e) {}
  }

  function lsDel(k) {
    try { if (window.localStorage) window.localStorage.removeItem(k); } catch (e) {}
  }

  function isOnboarded() {
    var v = lsGet(STORAGE_KEY);
    return v !== null && v !== "";
  }

  function markOnboarded() {
    lsSet(STORAGE_KEY, "1");
  }

  function resetOnboarding() {
    lsDel(STORAGE_KEY);
  }

  function clampStep(idx) {
    var n = Number(idx);
    if (!Number.isFinite(n)) n = 0;
    n = Math.floor(n);
    if (n < 0) return 0;
    if (n >= STEPS.length) return STEPS.length - 1;
    return n;
  }

  function shouldAutoOpen(opts) {
    opts = opts || {};
    var onboarded = opts.onboarded !== undefined ? Boolean(opts.onboarded) : isOnboarded();
    if (onboarded) return false;
    var loc = opts.location || window.location || { pathname: "/", search: "" };
    var pathname = String(loc.pathname || "/");
    var search = String(loc.search || "");
    if (/^\/t\/./.test(pathname)) return false;
    if (/[?&]share=/.test(search)) return false;
    if (/[?&]p=(?:%2Ft%2F|\/t\/)/i.test(search)) return false;
    if (document && document.documentElement && document.documentElement.classList &&
        document.documentElement.classList.contains("pre-boot")) return false;
    var landing = opts.landing !== undefined ? opts.landing : (document && document.getElementById ? document.getElementById("landing") : null);
    if (landing && landing.style && landing.style.display === "none") return false;
    return true;
  }

  function shouldShowEmptyPrompts(composerValue, threadCount) {
    var emptyComposer = String(composerValue == null ? "" : composerValue).trim().length === 0;
    var zeroThreads = (Number(threadCount) || 0) === 0;
    return emptyComposer && zeroThreads;
  }

  function getThreadCount() {
    try {
      if (window.__appGlobals && Array.isArray(window.__appGlobals.threads)) {
        return window.__appGlobals.threads.length;
      }
    } catch (e) {}
    try {
      var raw = JSON.parse(lsGet("ai_threads") || "[]");
      return Array.isArray(raw) ? raw.length : 0;
    } catch (e2) {
      return 0;
    }
  }

  function getComposerValue() {
    var input = document.getElementById("landingInput");
    return input && typeof input.value === "string" ? input.value : "";
  }

  function isAuthBlocking() {
    var auth = document.getElementById("authOverlay");
    return Boolean(auth && auth.style && auth.style.display && auth.style.display !== "none");
  }

  /* ---- OAuth Connector Persuasion (Before/After examples + Why connect? + wired demos) ---- */
  function findClosestAttr(el, attrs) {
    if (!el) return null;
    if (typeof el.closest === "function") {
      var sel = attrs.map(function (a) { return "[" + a + "]"; }).join(", ");
      var m = el.closest(sel);
      if (m) return m;
    }
    var cur = el;
    while (cur && cur !== document) {
      if (cur.getAttribute) {
        for (var i = 0; i < attrs.length; i++) {
          if (cur.getAttribute(attrs[i]) != null) return cur;
        }
      }
      cur = cur.parentNode;
    }
    return null;
  }

  function preloadConnectorsReady() {
    try {
      if (window.ConnectorsUI && typeof window.ConnectorsUI.ensureReady === "function") {
        window.ConnectorsUI.ensureReady();
      }
    } catch (e) {}
  }

  function hasAnyConnectedConnector() {
    try {
      if (window.ConnectorsUI && typeof window.ConnectorsUI.hasAnyConnected === "function") {
        if (window.ConnectorsUI.hasAnyConnected()) return true;
      }
      var conns = JSON.parse(lsGet("ai_conn_watch") || "{}") || {};
      return Object.keys(conns).some(function (k) { return !!conns[k]; });
    } catch (e) {
      return false;
    }
  }

  function fallbackProviderName(id) {
    var names = { google: "Google", dropbox: "Dropbox", slack: "Slack", outlook: "Outlook", github: "GitHub" };
    return names[id] || (id ? id.charAt(0).toUpperCase() + id.slice(1) : "Provider");
  }

  function getConnectorDemoState(demoId) {
    if (window.ConnectorsUI && typeof window.ConnectorsUI.getDemoState === "function") {
      var live = window.ConnectorsUI.getDemoState(demoId);
      if (live) return live;
    }
    var item = CONNECTOR_EXAMPLES.find(function (x) { return x.id === demoId; }) || CONNECTOR_EXAMPLES[0];
    var candidates = [item.provider].concat(item.fallbackProviders || []);
    var winCfg = (window && window.CONNECTOR_OAUTH) || null;
    var pool = winCfg && ((winCfg.providers && typeof winCfg.providers === "object") ? winCfg.providers : winCfg);
    var watched = {};
    try { watched = JSON.parse(lsGet("ai_conn_watch") || "{}") || {}; } catch (e) {}

    for (var i = 0; i < candidates.length; i++) {
      var cid = candidates[i];
      if (watched[cid]) {
        return {
          id: item.id,
          capability: item.capability,
          provider: cid,
          providerName: fallbackProviderName(cid),
          state: "connected",
          actionLabel: "Ask in chat \u2192",
          prompt: item.prompt,
          statusNote: ""
        };
      }
    }
    for (var j = 0; j < candidates.length; j++) {
      var pid = candidates[j];
      var entry = pool && pool[pid];
      var clientId = typeof entry === "string" ? entry : (entry && (entry.clientId || entry.client_id)) || "";
      if (clientId && String(clientId).trim()) {
        var pName = fallbackProviderName(pid);
        return {
          id: item.id,
          capability: item.capability,
          provider: pid,
          providerName: pName,
          state: "oauth_ready",
          actionLabel: "Connect " + pName + " \u2192",
          prompt: item.prompt,
          statusNote: ""
        };
      }
    }
    var defName = fallbackProviderName(item.provider);
    return {
      id: item.id,
      capability: item.capability,
      provider: item.provider,
      providerName: defName,
      state: "registration_pending",
      actionLabel: "Registration pending",
      prompt: item.prompt,
      statusNote: defName + " OAuth registration pending \u2014 Google, Outlook, and GitHub OAuth apps are not registered on this host yet."
    };
  }

  function oauthSummaryLine() {
    if (window.ConnectorsUI && typeof window.ConnectorsUI.oauthMatrixSummaryText === "function") {
      return window.ConnectorsUI.oauthMatrixSummaryText();
    }
    return "OAuth registration pending: Google, Outlook, GitHub \u00b7 Live when configured: Dropbox, Slack";
  }

  function persuasionMarkup(surface) {
    var cardsHtml = CONNECTOR_EXAMPLES.map(function (item) {
      var info = getConnectorDemoState(item.id);
      return '<button type="button" class="ob-persuade-chip state-' + esc(info.state) + '" ' +
        'data-ob-demo="' + esc(item.id) + '" ' +
        'data-demo-provider="' + esc(info.provider) + '" ' +
        'data-demo-state="' + esc(info.state) + '">' +
          '<span class="ob-persuade-top">' +
            '<span class="ob-persuade-cap">' + esc(item.capability) + "</span>" +
            '<span class="ob-persuade-pill is-' + esc(info.state) + '">' + esc(info.actionLabel) + "</span>" +
          "</span>" +
          '<span class="ob-persuade-before">' + esc(item.before) + "</span>" +
          '<span class="ob-persuade-prompt">\u201c' + esc(item.prompt) + "\u201d</span>" +
          '<span class="ob-persuade-after">' + esc(item.after) + "</span>" +
        "</button>";
    }).join("");

    var whyHtml = CONNECTOR_BENEFITS.map(function (w) {
      return '<li class="ob-why-item" data-ob-why-id="' + esc(w.id) + '">' +
        '<strong class="ob-why-head">' + esc(w.title) + "</strong>" +
        '<span class="ob-why-body">' + esc(w.body) + "</span>" +
      "</li>";
    }).join("");

    var notice = state.demoNotice;
    var statusText = notice ? notice.text : oauthSummaryLine();
    var statusCls = "ob-persuade-status" + (notice ? (" is-active " + (notice.kind || "warn")) : "");
    var openConnBtn = notice && notice.provider
      ? ' <button type="button" class="ob-persuade-open-btn" data-ob-open-connectors="' + esc(notice.provider) + '">View in Connectors \u2192</button>'
      : "";

    return '<div class="ob-persuade-box ob-persuade-' + esc(surface) + '" data-ob-persuasion-surface="' + esc(surface) + '">' +
      '<div class="ob-persuade-head">' +
        '<span class="ob-persuade-kicker">Why link your email, calendar &amp; files</span>' +
        '<strong class="ob-persuade-title">20 minutes of scrolling \u2192 one question, cited</strong>' +
      "</div>" +
      '<div class="ob-persuade-grid">' + cardsHtml + "</div>" +
      '<div class="' + statusCls + '" role="status" aria-live="polite" data-ob-demo-status="' + esc(notice && notice.provider ? notice.provider : "summary") + '">' +
        "<span>" + esc(statusText) + "</span>" + openConnBtn +
      "</div>" +
      '<div class="ob-why-block" data-ob-why="1">' +
        '<div class="ob-why-title">Why connect?</div>' +
        '<ul class="ob-why-grid">' + whyHtml + "</ul>" +
      "</div>" +
    "</div>";
  }

  function openConnectorsForDemo(demoOrProviderId) {
    if (state.open) closeTour(false);
    if (window.SettingsUI && typeof window.SettingsUI.open === "function") {
      window.SettingsUI.open("connectors");
    }
    if (window.ConnectorsUI && typeof window.ConnectorsUI.triggerDemo === "function") {
      var matching = CONNECTOR_EXAMPLES.find(function (x) { return x.id === demoOrProviderId || x.provider === demoOrProviderId; });
      if (matching) window.ConnectorsUI.triggerDemo(matching.id);
    }
  }

  function triggerConnectorDemo(demoId) {
    var info = getConnectorDemoState(demoId);
    if (!info) return { ok: false, action: "unknown" };
    if (info.state === "connected") {
      state.demoNotice = null;
      runStarter(info.prompt);
      return { ok: true, action: "asked", state: "connected", provider: info.provider, prompt: info.prompt };
    }
    if (info.state === "oauth_ready" || info.state === "awaiting_callback") {
      state.demoNotice = {
        kind: "info",
        provider: info.provider,
        text: "Starting " + info.providerName + " OAuth \u2014 once connected, ask: \u201c" + info.prompt + "\u201d"
      };
      if (state.open) closeTour(false);
      if (window.SettingsUI && typeof window.SettingsUI.open === "function") {
        window.SettingsUI.open("connectors");
      }
      if (window.ConnectorsUI && typeof window.ConnectorsUI.triggerDemo === "function") {
        return window.ConnectorsUI.triggerDemo(demoId);
      }
      syncPersuasion();
      return { ok: true, action: "oauth_started", state: info.state, provider: info.provider, prompt: info.prompt };
    }
    state.demoNotice = {
      kind: "warn",
      provider: info.provider,
      text: info.statusNote + " (" + oauthSummaryLine() + ")."
    };
    syncPersuasion();
    return { ok: true, action: "registration_pending", state: "registration_pending", provider: info.provider, message: state.demoNotice.text };
  }

  function mountPersuasionPanel() {
    var host = document.getElementById("suggestions");
    if (!host) return null;
    var panel = null;
    if (host.children) {
      for (var i = 0; i < host.children.length; i++) {
        var ch = host.children[i];
        if (ch && ch.getAttribute && ch.getAttribute("data-ob-persuasion") === "1") {
          panel = ch;
          break;
        }
      }
    }
    if (hasAnyConnectedConnector()) {
      if (panel) {
        panel.hidden = true;
        if (panel.style) panel.style.display = "none";
        panel.innerHTML = "";
      }
      return null;
    }
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "ob-persuade-wrap";
      panel.setAttribute("data-ob-persuasion", "1");
      var cl = null;
      if (host.children) {
        for (var j = 0; j < host.children.length; j++) {
          if (host.children[j] && host.children[j].getAttribute && host.children[j].getAttribute("data-ob-checklist") === "1") {
            cl = host.children[j];
            break;
          }
        }
      }
      if (cl && cl.parentNode === host && typeof host.insertBefore === "function") {
        host.insertBefore(panel, cl);
      } else {
        host.appendChild(panel);
      }
      if (!host.__obPersuadeBound) {
        host.__obPersuadeBound = true;
        host.addEventListener("click", function (e) {
          var hit = findClosestAttr(e.target, ["data-ob-demo", "data-ob-open-connectors"]);
          if (!hit) return;
          e.preventDefault();
          if (hit.getAttribute("data-ob-open-connectors") != null) {
            openConnectorsForDemo(hit.getAttribute("data-ob-open-connectors"));
            return;
          }
          triggerConnectorDemo(hit.getAttribute("data-ob-demo"));
        });
      }
    }
    panel.hidden = false;
    if (panel.style) panel.style.display = "";
    panel.innerHTML = persuasionMarkup("landing");
    return panel;
  }

  function syncPersuasion() {
    try {
      if (state.open && state.step === STEPS.length - 1) renderTourStep();
      mountPersuasionPanel();
      mountChecklist();
    } catch (e) {}
  }

  /* ---- Onboarding Tour (#tour) ---- */
  function ensureTourElement() {
    if (tourEl && tourEl.parentNode) return tourEl;
    tourEl = document.getElementById("tour") || tourEl;
    if (!tourEl) {
      tourEl = document.createElement("div");
      tourEl.id = "tour";
    }
    if (!tourEl.parentNode && document.body) {
      document.body.appendChild(tourEl);
    }
    tourEl.className = "import-modal-backdrop ob-tour-backdrop";
    tourEl.setAttribute("role", "dialog");
    tourEl.setAttribute("aria-modal", "true");
    tourEl.setAttribute("aria-labelledby", "obTourTitle");
    tourEl.setAttribute("aria-describedby", "obTourDesc");
    tourEl.setAttribute("aria-hidden", "true");
    tourEl.setAttribute("data-no-global-drop", "1");

    if (!tourEl.__obBound) {
      tourEl.__obBound = true;
      tourEl.addEventListener("click", function (e) {
        if (e.target === tourEl) {
          skipTour();
          return;
        }
        var demoHit = findClosestAttr(e.target, ["data-ob-demo", "data-ob-open-connectors"]);
        if (demoHit) {
          e.preventDefault();
          if (demoHit.getAttribute("data-ob-open-connectors") != null) {
            openConnectorsForDemo(demoHit.getAttribute("data-ob-open-connectors"));
          } else {
            triggerConnectorDemo(demoHit.getAttribute("data-ob-demo"));
          }
          return;
        }
        var target = findClosestAttr(e.target, ["data-tour-act", "data-tour-step"]);
        if (!target) return;
        if (target.getAttribute("data-tour-step") != null) {
          goToStep(Number(target.getAttribute("data-tour-step")));
          return;
        }
        var act = target.getAttribute("data-tour-act");
        if (act === "skip" || act === "close" || act === "done") {
          closeTour(true);
        } else if (act === "next") {
          nextStep();
        } else if (act === "prev") {
          prevStep();
        }
      });
    }

    return tourEl;
  }

  function renderTourStep() {
    var host = ensureTourElement();
    var idx = clampStep(state.step);
    var step = STEPS[idx];
    var isFirst = idx === 0;
    var isLast = idx === STEPS.length - 1;

    var dotsHtml = STEPS.map(function (s, i) {
      var active = i === idx;
      return '<button type="button" class="ob-tour-dot' + (active ? " active" : "") + '" ' +
        'data-tour-step="' + i + '" ' +
        'aria-label="Step ' + (i + 1) + " of " + STEPS.length + ": " + esc(s.title) + '" ' +
        (active ? 'aria-current="step"' : "") +
        "></button>";
    }).join("");

    var pillsHtml = (step.pills || []).map(function (p) {
      return '<span class="ob-tour-pill">' + esc(p) + "</span>";
    }).join("");
    if (!isLast) {
      pillsHtml += '<button type="button" class="ob-tour-pill ob-tour-pill-jump" data-tour-step="' + (STEPS.length - 1) + '">OAuth email &amp; file examples \u2192</button>';
    }

    host.innerHTML =
      '<div class="import-modal ob-tour-modal' + (isLast ? " ob-tour-modal-wide" : "") + '">' +
        '<div class="ob-tour-top">' +
          '<div class="ob-tour-kicker">' +
            '<span>Getting started</span>' +
            '<span class="ob-tour-step-count">\u00b7 ' + (idx + 1) + " of " + STEPS.length + "</span>" +
          "</div>" +
          '<button type="button" class="ob-tour-x" data-tour-act="close" aria-label="Skip onboarding tour" title="Skip tour (Esc)">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
          "</button>" +
        "</div>" +
        '<div class="ob-tour-card">' +
          '<div class="ob-tour-icon" aria-hidden="true">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + step.icon + "</svg>" +
          "</div>" +
          '<div class="ob-tour-copy">' +
            '<h3 class="ob-tour-title" id="obTourTitle">' + esc(step.title) + "</h3>" +
            '<p class="ob-tour-desc" id="obTourDesc">' + esc(step.body) + "</p>" +
            '<div class="ob-tour-pills">' + pillsHtml + "</div>" +
          "</div>" +
        "</div>" +
        (isLast ? persuasionMarkup("tour") : "") +
        '<div class="ob-tour-foot">' +
          '<div class="ob-tour-dots" role="group" aria-label="Onboarding progress">' + dotsHtml + "</div>" +
          '<div class="ob-tour-actions">' +
            (!isLast ? '<button type="button" class="ob-tour-btn ob-tour-btn-ghost" data-tour-act="skip">Skip</button>' : "") +
            (!isFirst ? '<button type="button" class="ob-tour-btn ob-tour-btn-sec" data-tour-act="prev">Back</button>' : "") +
            '<button type="button" class="ob-tour-btn ob-tour-btn-pri" data-tour-act="' + (isLast ? "done" : "next") + '">' +
              (isLast ? "Get started" : "Next") +
            "</button>" +
          "</div>" +
        "</div>" +
      "</div>";
  }

  function openTour(stepIdx, opts) {
    preloadConnectorsReady();
    state.step = clampStep(stepIdx === undefined ? 0 : stepIdx);
    state.open = true;
    var host = ensureTourElement();
    renderTourStep();
    host.classList.add("open");
    host.setAttribute("aria-hidden", "false");
    if ((!opts || opts.focus !== false) && !isAuthBlocking()) {
      var pri = host.querySelector ? host.querySelector(".ob-tour-btn-pri") : null;
      if (pri && typeof pri.focus === "function") {
        try { pri.focus({ preventScroll: true }); } catch (e) { pri.focus(); }
      }
      var modal = host.querySelector ? host.querySelector(".ob-tour-modal") : null;
      if (modal && typeof modal.scrollTop === "number") modal.scrollTop = 0;
    }
    return getState();
  }

  function closeTour(focusComposer) {
    state.open = false;
    markOnboarded();
    if (tourEl) {
      tourEl.classList.remove("open");
      tourEl.setAttribute("aria-hidden", "true");
    }
    if (focusComposer && !isAuthBlocking()) {
      var landing = document.getElementById("landing");
      var input = document.getElementById("landingInput");
      if (input && (!landing || !landing.style || landing.style.display !== "none") && typeof input.focus === "function") {
        input.focus();
      }
    }
    return getState();
  }

  function skipTour() {
    return closeTour(true);
  }

  function nextStep() {
    if (state.step < STEPS.length - 1) {
      state.step += 1;
      if (state.open) renderTourStep();
      return getState();
    }
    return closeTour(true);
  }

  function prevStep() {
    if (state.step > 0) {
      state.step -= 1;
      if (state.open) renderTourStep();
    }
    return getState();
  }

  function goToStep(idx) {
    state.step = clampStep(idx);
    if (state.open) renderTourStep();
    return getState();
  }

  function onDocumentKeyDown(e) {
    if (!state.open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (typeof e.stopPropagation === "function") e.stopPropagation();
      skipTour();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (typeof e.stopPropagation === "function") e.stopPropagation();
      if (state.step < STEPS.length - 1) goToStep(state.step + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (typeof e.stopPropagation === "function") e.stopPropagation();
      if (state.step > 0) goToStep(state.step - 1);
    }
  }

  /* ---- Empty-state Example Prompt Chips ---- */
  function runExample(query) {
    var q = String(query == null ? "" : query).trim();
    if (!q) return false;
    var input = document.getElementById("landingInput");
    if (input) {
      input.value = q;
      if (typeof window.autosize === "function") {
        try { window.autosize(input); } catch (e) {}
      }
    }
    lsDel("ai_draft_landing");
    if (state.open) closeTour(false);
    syncEmptyState();
    if (typeof window.submitQuery === "function") {
      window.submitQuery(q);
      return true;
    }
    var btn = document.getElementById("landingSubmit");
    if (btn && typeof btn.click === "function") {
      btn.click();
      return true;
    }
    return false;
  }

  /* Empty surfaces share the existing examples and real composer send/queue path.
     Never click the round send button here: while busy it means Stop. */
  function runStarter(query) {
    var q = String(query == null ? "" : query).trim();
    if (!q) return false;
    if (window.LibraryUI && window.LibraryUI.close) window.LibraryUI.close();
    if (window.SettingsUI && window.SettingsUI.close) window.SettingsUI.close();
    if (state.open) closeTour(false);
    var landing = document.getElementById("landing");
    var busy = typeof isSearching !== "undefined" && isSearching;
    if (!busy && landing && landing.style.display === "none") {
      var create = window.__appGlobals && window.__appGlobals.newThread;
      if (typeof create === "function") create();
    }
    var input = document.getElementById(busy && landing && landing.style.display === "none" ? "followupInput" : "landingInput");
    if (!input) return false;
    if (typeof Event === "function" && typeof KeyboardEvent === "function" && typeof input.dispatchEvent === "function") {
      input.value = q;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      return true;
    }
    return runExample(q);
  }

  function starterButtons(host, count) {
    EXAMPLE_PROMPTS.slice(0, count || 3).forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ob-empty-starter";
      button.textContent = item.query;
      button.addEventListener("click", function () { runStarter(item.query); });
      host.appendChild(button);
    });
    return host;
  }

  function mountExamplePrompts() {
    var box = document.getElementById("suggestions");
    if (!box) return null;
    if (box.getAttribute("data-ob-mounted") === "1") return box;
    box.setAttribute("data-ob-mounted", "1");
    box.classList.add("ob-empty-prompts");
    box.innerHTML = "";

    var head = document.createElement("div");
    head.className = "ob-empty-head";

    var label = document.createElement("span");
    label.className = "ob-empty-label";
    label.textContent = "Try an example";
    head.appendChild(label);

    var tourBtn = document.createElement("button");
    tourBtn.type = "button";
    tourBtn.className = "ob-tour-reopen";
    tourBtn.setAttribute("data-ob-open-tour", "1");
    tourBtn.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
      "<span>Quick tour</span>";
    tourBtn.addEventListener("click", function () { openTour(0); });
    head.appendChild(tourBtn);
    box.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "ob-example-grid";

    EXAMPLE_PROMPTS.forEach(function (item) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "suggestion-chip ob-example-chip";
      chip.setAttribute("data-q", item.query);
      chip.setAttribute("data-example-id", item.id);
      chip.setAttribute("aria-label", item.query);
      chip.innerHTML =
        '<span class="ob-chip-top">' +
          '<span class="ob-chip-tag">' + esc(item.tag) + "</span>" +
          '<span class="ob-chip-arrow" aria-hidden="true">\u2192</span>' +
        "</span>" +
        '<span class="ob-chip-query">' + esc(item.query) + "</span>";
      chip.addEventListener("click", function () {
        runExample(item.query);
      });
      grid.appendChild(chip);
    });

    box.appendChild(grid);
    return box;
  }

  function syncSidebarEmptyHint() {
    var list = document.getElementById("threadItems");
    if (!list || !list.children) return;
    if (list.children.length > 0) return;
    var searchEl = document.getElementById("threadSearch");
    var q = searchEl && typeof searchEl.value === "string" ? searchEl.value.trim() : "";
    var empty = document.createElement("div");
    empty.className = "ob-threads-empty";
    empty.textContent = q ? "No matching threads" : "Your research threads will appear here.";
    if (q) {
      var reset = document.createElement("button");
      reset.type = "button"; reset.className = "ob-empty-starter"; reset.textContent = "Clear search";
      reset.addEventListener("click", function () {
        searchEl.value = ""; searchEl.dispatchEvent(new Event("input", { bubbles: true })); searchEl.focus();
      });
      empty.appendChild(reset);
      starterButtons(empty, 2);
    }
    list.appendChild(empty);
  }

  function syncEmptyState() {
    var box = mountExamplePrompts();
    mountPersuasionPanel();
    mountChecklist();
    var show = shouldShowEmptyPrompts(getComposerValue(), getThreadCount());
    state.emptyPromptsVisible = show;
    if (box) {
      box.hidden = !show;
      if (box.style) box.style.display = show ? "" : "none";
      box.setAttribute("aria-hidden", show ? "false" : "true");
    }
    return show;
  }

  function wireFooterTourLink() {
    var statusLink = document.getElementById("statusLink");
    if (!statusLink || !statusLink.parentNode || document.getElementById("tourLink")) return;
    var sep = document.createTextNode(" \u00b7 ");
    var link = document.createElement("a");
    link.href = "#";
    link.id = "tourLink";
    link.textContent = "Quick tour";
    link.title = "Open the 4-step getting-started tour";
    link.addEventListener("click", function (e) {
      e.preventDefault();
      openTour(0);
    });
    statusLink.parentNode.appendChild(sep);
    statusLink.parentNode.appendChild(link);
  }

  function wrapGlobalFn(name, afterFn) {
    var orig = window[name];
    if (typeof orig !== "function" || orig.__obWrapped) return;
    var wrapped = function () {
      var res = orig.apply(this, arguments);
      try { afterFn(); } catch (e) {}
      return res;
    };
    wrapped.__obWrapped = true;
    window[name] = wrapped;
  }

  function getState() {
    return {
      open: state.open,
      step: state.step,
      totalSteps: STEPS.length,
      onboarded: isOnboarded(),
      emptyPromptsVisible: state.emptyPromptsVisible
    };
  }

  function wire() {
    ensureTourElement();
    mountExamplePrompts();
    wireFooterTourLink();

    var input = document.getElementById("landingInput");
    if (input && input.addEventListener) {
      ["input", "change", "keyup", "blur"].forEach(function (ev) {
        input.addEventListener(ev, syncEmptyState);
      });
      input.addEventListener("focus", function () {
        syncEmptyState();
        setTimeout(syncEmptyState, 0);
      });
    }

    wrapGlobalFn("renderThreads", function () {
      syncEmptyState();
      syncSidebarEmptyHint();
    });
    wrapGlobalFn("showLanding", function () {
      syncEmptyState();
    });

    if (document.addEventListener) {
      document.addEventListener("keydown", onDocumentKeyDown, true);
    }
    if (window.addEventListener) {
      window.addEventListener("storage", syncEmptyState);
      window.addEventListener("popstate", syncEmptyState);
    }

    syncEmptyState();
    syncSidebarEmptyHint();
    preloadConnectorsReady();

    if (shouldAutoOpen()) {
      openTour(0, { focus: false });
    }
  }

  window.OnboardingUI = {
    STORAGE_KEY: STORAGE_KEY,
    STEPS: STEPS,
    EXAMPLE_PROMPTS: EXAMPLE_PROMPTS,
    CONNECTOR_EXAMPLES: CONNECTOR_EXAMPLES,
    CONNECTOR_BENEFITS: CONNECTOR_BENEFITS,
    isOnboarded: isOnboarded,
    markOnboarded: markOnboarded,
    resetOnboarding: resetOnboarding,
    shouldAutoOpen: shouldAutoOpen,
    shouldShowEmptyPrompts: shouldShowEmptyPrompts,
    open: openTour,
    close: closeTour,
    skip: skipTour,
    next: nextStep,
    prev: prevStep,
    goToStep: goToStep,
    getState: getState,
    refresh: function () { detectAutomateAsync(); try { mountChecklist(); syncPersuasion(); } catch (e) {} },
    runExample: runExample,
    runStarter: runStarter,
    starterButtons: starterButtons,
    syncEmptyState: syncEmptyState,
    syncPersuasion: syncPersuasion,
    getConnectorDemoState: getConnectorDemoState,
    triggerConnectorDemo: triggerConnectorDemo,
    CHECKLIST: CHECKLIST,
    checklistState: checklistState,
    checklistCardHtml: checklistCardHtml,
    toggleChecklistRow: toggleChecklistRow
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
