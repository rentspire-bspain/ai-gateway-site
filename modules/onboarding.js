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
      body: "Connect Google Drive, Gmail, Calendar, GitHub, and Comptrove data in Settings \u2192 Connectors. Schedule recurring jobs in Tasks & Automations, and monitor live multi-agent health and QA in Fleet.",
      pills: ["Connectors", "Tasks & Automations", "Fleet & QA"],
      icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
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
    emptyPromptsVisible: false
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
      // insert after the example grid (both live inside #suggestions)
      var grid = host.querySelector(".ob-example-grid");
      if (grid && grid.nextSibling) host.insertBefore(card, grid.nextSibling);
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
        var target = e.target && e.target.closest ? e.target.closest("[data-tour-act], [data-tour-step]") : null;
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

    host.innerHTML =
      '<div class="import-modal ob-tour-modal">' +
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
    state.step = clampStep(stepIdx === undefined ? 0 : stepIdx);
    state.open = true;
    var host = ensureTourElement();
    renderTourStep();
    host.classList.add("open");
    host.setAttribute("aria-hidden", "false");
    if ((!opts || opts.focus !== false) && !isAuthBlocking()) {
      var pri = host.querySelector ? host.querySelector(".ob-tour-btn-pri") : null;
      if (pri && typeof pri.focus === "function") pri.focus();
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
    list.appendChild(empty);
  }

  function syncEmptyState() {
    var box = mountExamplePrompts();
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

    if (shouldAutoOpen()) {
      openTour(0, { focus: false });
    }
  }

  window.OnboardingUI = {
    STORAGE_KEY: STORAGE_KEY,
    STEPS: STEPS,
    EXAMPLE_PROMPTS: EXAMPLE_PROMPTS,
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
    runExample: runExample,
    syncEmptyState: syncEmptyState,
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
