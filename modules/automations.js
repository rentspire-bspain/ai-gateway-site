/* automations.js — Automations manager UI (Parity doc §34c) for ai.spaincos.com.
   Lets signed-in users create/toggle/delete recurring automations (public.automations)
   and inspect or enqueue jobs in the live fleet_dispatch queue (executed every 5 min by pg_cron).
   Entry points: Fleet > Automations tab AND Settings > Automations pane. */
(function (root) {
  "use strict";

  var SCHEDULES = [
    { value: "hourly", label: "Hourly", detail: "Every hour" },
    { value: "2x-daily", label: "2x daily", detail: "Every 12 hours" },
    { value: "daily", label: "Daily", detail: "Every 24 hours" },
    { value: "weekly", label: "Weekly", detail: "Every 7 days" }
  ];

  var VALID_SCHEDULES = { "hourly": 1, "2x-daily": 1, "daily": 1, "weekly": 1 };
  var VALID_PRIORITIES = { "normal": 1, "high": 1 };

  function scheduleLabel(schedule) {
    for (var i = 0; i < SCHEDULES.length; i++) {
      if (SCHEDULES[i].value === schedule) return SCHEDULES[i].label + " (" + SCHEDULES[i].detail.toLowerCase() + ")";
    }
    return String(schedule || "Custom");
  }

  function validateAutomationInput(raw) {
    var name = String((raw && raw.name) || "").trim();
    var instruction = String((raw && raw.instruction) || "").trim();
    var schedule = String((raw && raw.schedule) || "daily").trim();
    if (!name) return { ok: false, error: "Enter a name for this automation." };
    if (name.length > 160) return { ok: false, error: "Name must be 160 characters or fewer." };
    if (!instruction) return { ok: false, error: "Enter the instruction the fleet should run." };
    if (instruction.length > 4000) return { ok: false, error: "Instruction must be 4,000 characters or fewer." };
    if (!VALID_SCHEDULES[schedule]) return { ok: false, error: "Choose a valid schedule (hourly, 2x-daily, daily, or weekly)." };
    return {
      ok: true,
      value: {
        name: name,
        instruction: instruction,
        schedule: schedule,
        enabled: raw && typeof raw.enabled === "boolean" ? raw.enabled : true
      }
    };
  }

  function validateDispatchInput(raw) {
    var instruction = String((raw && raw.instruction) || "").trim();
    var priority = String((raw && raw.priority) || "normal").trim();
    if (!instruction) return { ok: false, error: "Enter an instruction to queue for the fleet." };
    if (instruction.length > 4000) return { ok: false, error: "Instruction must be 4,000 characters or fewer." };
    if (!VALID_PRIORITIES[priority]) priority = "normal";
    return { ok: true, value: { instruction: instruction, priority: priority } };
  }

  function dispatchStatusMeta(status) {
    var s = String(status || "queued");
    if (s === "done") return { key: "done", label: "Done", dot: "fl-s-live", pill: "am-pill-ok" };
    if (s === "error") return { key: "error", label: "Error", dot: "fl-s-paused", pill: "am-pill-err" };
    if (s === "running") return { key: "running", label: "Running", dot: "fl-s-on_demand", pill: "am-pill-run" };
    return { key: "queued", label: "Queued", dot: "fl-s-on_demand", pill: "am-pill-wait" };
  }

  function summarizeDispatches(list) {
    var out = { total: 0, queued: 0, running: 0, done: 0, error: 0 };
    (list || []).forEach(function (d) {
      out.total += 1;
      var st = d && d.status;
      if (st === "done") out.done += 1;
      else if (st === "error") out.error += 1;
      else if (st === "running") out.running += 1;
      else out.queued += 1;
    });
    return out;
  }

  function filterDispatches(list, filter) {
    var rows = Array.isArray(list) ? list : [];
    if (!filter || filter === "all") return rows;
    if (filter === "active") return rows.filter(function (d) { return d.status === "queued" || d.status === "running"; });
    return rows.filter(function (d) { return d.status === filter; });
  }

  var pureApi = {
    SCHEDULES: SCHEDULES,
    scheduleLabel: scheduleLabel,
    validateAutomationInput: validateAutomationInput,
    validateDispatchInput: validateDispatchInput,
    dispatchStatusMeta: dispatchStatusMeta,
    summarizeDispatches: summarizeDispatches,
    filterDispatches: filterDispatches
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = pureApi;
    return;
  }

  var SB_REST = "https://bnxermyboeigvwonfrzx.supabase.co/rest/v1";
  var ANON = "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb";
  var AUTO_SELECT_URL = SB_REST + "/automations?select=id,user_id,name,instruction,schedule,enabled,created_at&order=created_at.desc&limit=100";
  var AUTO_WRITE_URL = SB_REST + "/automations";
  var DISP_SELECT_URL = SB_REST + "/fleet_dispatch?select=id,thread_id,instruction,priority,status,result,error,claimed_at,claimed_by,created_at,finished_at&order=created_at.desc&limit=40";
  var DISP_WRITE_URL = SB_REST + "/fleet_dispatch";

  function injectStyles() {
    if (document.getElementById("am-styles")) return;
    var st = document.createElement("style");
    st.id = "am-styles";
    st.textContent = [
      ".am-wrap{display:flex;flex-direction:column;gap:20px;color:var(--text);font-family:var(--font-sans)}",
      ".am-intro{color:var(--text-muted);font-size:13px;line-height:1.5;margin:0}",
      ".am-panel{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px}",
      ".am-panel-h{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 12px}",
      ".am-panel-title{font-size:14px;font-weight:600;margin:0;color:var(--text)}",
      ".am-sec-h{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:4px 0 10px}",
      ".am-kicker{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin:0}",
      ".am-form-stack{display:flex;flex-direction:column;gap:12px}",
      ".am-disp-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}",
      ".am-disp-grow{flex:1 1 240px;min-width:0}",
      ".am-disp-ctrls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
      ".am-field{display:flex;flex-direction:column;gap:5px}",
      ".am-field label{font-size:12px;font-weight:600;color:var(--text-muted)}",
      ".am-input,.am-select,.am-textarea{width:100%;box-sizing:border-box;background:var(--bg-input,var(--bg));border:1px solid var(--border-light,var(--border));border-radius:var(--radius-sm);color:var(--text);font-family:inherit;font-size:13.5px;padding:9px 11px;outline:none;transition:border-color .15s}",
      ".am-input:focus,.am-select:focus,.am-textarea:focus{border-color:var(--accent)}",
      ".am-textarea{resize:vertical;min-height:74px;line-height:1.45}",
      ".am-sched-group{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}",
      "@media(max-width:560px){.am-sched-group{grid-template-columns:repeat(2,minmax(0,1fr))}}",
      ".am-sched-btn{background:var(--bg-input,var(--bg));border:1px solid var(--border-light,var(--border));border-radius:var(--radius-sm);color:var(--text);padding:9px 10px;cursor:pointer;text-align:left;font-family:inherit;transition:border-color .15s,background .15s}",
      ".am-sched-btn b{display:block;font-size:12.5px;font-weight:600}",
      ".am-sched-btn span{display:block;font-size:11px;color:var(--text-muted);margin-top:1px}",
      ".am-sched-btn[aria-pressed=\"true\"]{border-color:var(--accent);background:var(--accent-light)}",
      ".am-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}",
      ".am-btn{background:var(--bg-elevated);color:var(--text);border:1px solid var(--border-light,var(--border));border-radius:var(--radius-sm);padding:7px 13px;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s}",
      ".am-btn:hover:not(:disabled){border-color:var(--accent)}",
      ".am-btn:disabled{opacity:.55;cursor:not-allowed}",
      ".am-btn-primary{background:var(--accent-btn,var(--accent));border-color:var(--accent-btn,var(--accent));color:#fff}",
      ".am-btn-primary:hover:not(:disabled){background:var(--accent-btn-hover,var(--accent-hover));border-color:var(--accent-btn-hover,var(--accent-hover))}",
      ".am-btn-sm{padding:4px 9px;font-size:11.5px;font-weight:500}",
      ".am-btn-danger{color:var(--error,#e5484d);border-color:rgba(229,72,77,.35)}",
      ".am-status-msg{font-size:12.5px;color:var(--text-muted)}",
      ".am-status-msg.err{color:var(--error,#e5484d)}",
      ".am-status-msg.ok{color:var(--accent)}",
      ".am-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}",
      ".am-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;display:flex;flex-direction:column;gap:6px}",
      ".am-card-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px}",
      ".am-card-meta{color:var(--text-muted);font-size:12px;line-height:1.45}",
      ".am-card-body{color:var(--text);font-size:12.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}",
      ".am-card-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;padding-top:6px;border-top:1px solid var(--border)}",
      ".am-dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--text-muted)}",
      ".am-dot.fl-s-live{background:#2e9e5b}.am-dot.fl-s-paused{background:#c98a1b}.am-dot.fl-s-on_demand{background:#4a7fd0}",
      ".am-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid var(--border)}",
      ".am-pill-ok{background:rgba(46,158,91,.14);color:#3ec472;border-color:rgba(46,158,91,.3)}",
      "[data-theme=\"light\"] .am-pill-ok{color:#1d7540}",
      ".am-pill-err{background:rgba(229,72,77,.14);color:#ff8085;border-color:rgba(229,72,77,.3)}",
      "[data-theme=\"light\"] .am-pill-err{color:#b42328}",
      ".am-pill-run,.am-pill-wait{background:rgba(74,127,208,.14);color:#7db0ff;border-color:rgba(74,127,208,.3)}",
      "[data-theme=\"light\"] .am-pill-run,[data-theme=\"light\"] .am-pill-wait{color:#28559a}",
      ".am-filters{display:flex;align-items:center;gap:6px;flex-wrap:wrap}",
      ".am-filter{background:var(--bg-surface);border:1px solid var(--border);border-radius:999px;color:var(--text-muted);padding:4px 10px;font-family:inherit;font-size:12px;cursor:pointer}",
      ".am-filter[aria-pressed=\"true\"]{border-color:var(--accent);color:var(--accent);background:var(--accent-light);font-weight:600}",
      ".am-empty{background:var(--bg-surface);border:1px dashed var(--border-light,var(--border));border-radius:var(--radius);padding:16px;color:var(--text-muted);font-size:13px;text-align:center}",
      ".am-tl{margin:4px 0 0 16px;padding:0;color:var(--text-muted);font-size:11.5px;line-height:1.5}",
      ".am-result{margin-top:4px;border-top:1px solid var(--border);padding-top:6px;font-size:12px}",
      ".am-result summary{cursor:pointer;color:var(--accent);font-weight:500}",
      ".am-result pre{margin:6px 0 0;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-xs,6px);white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;font-size:11.5px;color:var(--text)}"
    ].join("\n");
    document.head.appendChild(st);
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function fmt(t) {
    if (!t) return "";
    var d = new Date(t);
    return isNaN(d.getTime()) ? String(t) : d.toLocaleString();
  }

  function getSessionInfo() {
    var client = (typeof sb !== "undefined") ? sb : ((root.__appGlobals && root.__appGlobals.sb) || root.sb);
    if (!client || !client.auth || typeof client.auth.getSession !== "function") {
      return Promise.resolve(null);
    }
    return client.auth.getSession().then(function (r) {
      var sess = r && r.data && r.data.session;
      if (!sess || !sess.access_token) return null;
      return {
        token: sess.access_token,
        userId: sess.user && sess.user.id ? sess.user.id : null
      };
    }).catch(function () { return null; });
  }

  function sbHeaders(tok, extra) {
    var h = { Authorization: "Bearer " + tok, apikey: ANON };
    if (extra) {
      Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    }
    return h;
  }

  function isMissingTableError(status, payload) {
    if (status === 404) return true;
    var code = payload && payload.code;
    var msg = String((payload && (payload.message || payload.error || payload.hint)) || "");
    return code === "PGRST205" || code === "42P01" || /automations.*(not find|does not exist)/i.test(msg);
  }

  function mount(host, opts) {
    if (!host) return null;
    injectStyles();
    var uidSuffix = Math.random().toString(36).slice(2, 8);
    var state = {
      schedule: "daily",
      alsoQueueNow: false,
      automations: [],
      autoLoading: true,
      autoError: "",
      autoTablePending: false,
      autoBusy: {},
      confirmDeleteId: null,
      dispatches: [],
      dispLoading: true,
      dispError: "",
      dispFilter: "all",
      signedOut: false,
      pollTimer: null
    };

    var showTitle = !(opts && opts.hideHeading);
    host.innerHTML =
      '<div class="am-wrap">' +
        (showTitle
          ? '<div><h2 style="font-size:18px;font-weight:600;margin:0 0 4px">Automations</h2>' +
            '<p class="am-intro">Schedule recurring instructions and monitor queued or completed runs on the 5-minute fleet-dispatch runner.</p></div>'
          : '<p class="am-intro">Create recurring automations and track live dispatches executed every 5 minutes by the gateway fleet.</p>') +

        '<section class="am-panel" aria-labelledby="amCreateTitle-' + uidSuffix + '">' +
          '<div class="am-panel-h">' +
            '<h3 class="am-panel-title" id="amCreateTitle-' + uidSuffix + '">New recurring automation</h3>' +
            '<span class="am-card-meta">Runs through fleet_dispatch</span>' +
          '</div>' +
          '<form class="am-create-form" novalidate>' +
            '<div class="am-form-stack">' +
              '<div class="am-field">' +
                '<label for="amName-' + uidSuffix + '">Automation name</label>' +
                '<input id="amName-' + uidSuffix + '" class="am-input" name="name" type="text" maxlength="160" placeholder="Morning market &amp; portfolio brief" autocomplete="off">' +
              '</div>' +
              '<div class="am-field">' +
                '<label id="amSchedLbl-' + uidSuffix + '">Schedule</label>' +
                '<div class="am-sched-group" role="group" aria-labelledby="amSchedLbl-' + uidSuffix + '">' +
                  SCHEDULES.map(function (s) {
                    return '<button type="button" class="am-sched-btn" data-sched="' + esc(s.value) + '" aria-pressed="' + (s.value === state.schedule ? "true" : "false") + '">' +
                      '<b>' + esc(s.label) + '</b><span>' + esc(s.detail) + '</span></button>';
                  }).join("") +
                '</div>' +
              '</div>' +
              '<div class="am-field">' +
                '<label for="amInst-' + uidSuffix + '">Instruction</label>' +
                '<textarea id="amInst-' + uidSuffix + '" class="am-textarea" name="instruction" rows="3" maxlength="4000" placeholder="Summarize overnight news, check key metrics, and flag anything needing action…"></textarea>' +
              '</div>' +
            '</div>' +
            '<div class="am-actions">' +
              '<button type="submit" class="am-btn am-btn-primary" data-role="create-submit">Create automation</button>' +
              '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);cursor:pointer">' +
                '<input type="checkbox" data-role="queue-first"> Also queue first run now' +
              '</label>' +
              '<span class="am-status-msg" data-role="create-msg" aria-live="polite"></span>' +
            '</div>' +
          '</form>' +
        '</section>' +

        '<section>' +
          '<div class="am-sec-h">' +
            '<h3 class="am-kicker" data-role="auto-heading">Recurring automations</h3>' +
            '<button type="button" class="am-btn am-btn-sm" data-action="refresh-auto">Refresh</button>' +
          '</div>' +
          '<div data-role="auto-list"><div class="am-empty">Loading automations…</div></div>' +
        '</section>' +

        '<section>' +
          '<div class="am-sec-h">' +
            '<h3 class="am-kicker" data-role="disp-heading">Fleet dispatch queue</h3>' +
            '<div class="am-filters" data-role="disp-filters"></div>' +
          '</div>' +
          '<div class="am-panel" style="margin-bottom:12px">' +
            '<form class="am-dispatch-form" novalidate>' +
              '<div class="am-disp-bar">' +
                '<div class="am-field am-disp-grow">' +
                  '<label for="amDispInst-' + uidSuffix + '">Run one-off dispatch now</label>' +
                  '<input id="amDispInst-' + uidSuffix + '" class="am-input" type="text" maxlength="4000" placeholder="Queue an immediate instruction for the 5-minute fleet runner…" autocomplete="off">' +
                '</div>' +
                '<div class="am-field">' +
                  '<label for="amDispPrio-' + uidSuffix + '">Priority &amp; queue</label>' +
                  '<div class="am-disp-ctrls">' +
                    '<select id="amDispPrio-' + uidSuffix + '" class="am-select" style="width:116px;flex:none" aria-label="Priority">' +
                      '<option value="normal">Normal</option>' +
                      '<option value="high">High</option>' +
                    '</select>' +
                    '<button type="submit" class="am-btn am-btn-primary" style="white-space:nowrap" data-role="disp-submit">Queue run</button>' +
                    '<button type="button" class="am-btn" data-action="refresh-disp" title="Refresh queue">Refresh</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div class="am-actions" style="margin-top:8px;min-height:18px">' +
                '<span class="am-status-msg" data-role="disp-msg" aria-live="polite"></span>' +
              '</div>' +
            '</form>' +
          '</div>' +
          '<div data-role="disp-list"><div class="am-empty">Loading dispatch queue…</div></div>' +
        '</section>' +
      '</div>';

    var autoHeading = host.querySelector('[data-role="auto-heading"]');
    var autoListEl = host.querySelector('[data-role="auto-list"]');
    var dispHeading = host.querySelector('[data-role="disp-heading"]');
    var dispFiltersEl = host.querySelector('[data-role="disp-filters"]');
    var dispListEl = host.querySelector('[data-role="disp-list"]');
    var createForm = host.querySelector(".am-create-form");
    var nameInput = host.querySelector("#amName-" + uidSuffix);
    var instInput = host.querySelector("#amInst-" + uidSuffix);
    var queueFirstInput = host.querySelector('[data-role="queue-first"]');
    var createSubmit = host.querySelector('[data-role="create-submit"]');
    var createMsg = host.querySelector('[data-role="create-msg"]');
    var dispForm = host.querySelector(".am-dispatch-form");
    var dispInput = host.querySelector("#amDispInst-" + uidSuffix);
    var dispPrio = host.querySelector("#amDispPrio-" + uidSuffix);
    var dispSubmit = host.querySelector('[data-role="disp-submit"]');
    var dispMsg = host.querySelector('[data-role="disp-msg"]');

    function setMsg(el, text, kind) {
      if (!el) return;
      el.textContent = text || "";
      el.className = "am-status-msg" + (kind ? " " + kind : "");
    }

    function syncScheduleButtons() {
      var btns = host.querySelectorAll(".am-sched-btn");
      for (var i = 0; i < btns.length; i++) {
        var active = btns[i].getAttribute("data-sched") === state.schedule;
        btns[i].setAttribute("aria-pressed", active ? "true" : "false");
      }
    }

    function renderAutomations() {
      autoHeading.textContent = "Recurring automations" + (state.automations.length ? " (" + state.automations.length + ")" : "");
      if (state.autoLoading) {
        autoListEl.innerHTML = '<div class="am-empty">Loading automations…</div>';
        return;
      }
      if (state.signedOut) {
        autoListEl.innerHTML = '<div class="am-empty">Sign in to view and create recurring automations.</div>';
        return;
      }
      if (state.autoTablePending) {
        autoListEl.innerHTML = '<div class="am-empty">Recurring automations schema (<code>sql/automations.sql</code>) has not been applied on this database yet. You can already queue and monitor runs in the Fleet dispatch queue below.</div>';
        return;
      }
      if (state.autoError) {
        autoListEl.innerHTML = '<div class="am-empty">' + esc(state.autoError) + '</div>';
        return;
      }
      if (!state.automations.length) {
        autoListEl.innerHTML = '<div class="am-empty">No recurring automations yet — use the form above to schedule hourly, 2x-daily, daily, or weekly fleet work.</div>';
        return;
      }
      autoListEl.innerHTML = '<div class="am-grid">' + state.automations.map(function (a) {
        var busy = !!state.autoBusy[a.id];
        var confirming = state.confirmDeleteId === a.id;
        return '<div class="am-card" data-aid="' + esc(a.id) + '">' +
          '<div class="am-card-top">' +
            '<span class="am-dot ' + (a.enabled ? "fl-s-live" : "fl-s-paused") + '"></span>' +
            '<b style="flex:1;min-width:0;overflow-wrap:anywhere">' + esc(a.name) + '</b>' +
            '<span class="am-pill ' + (a.enabled ? "am-pill-ok" : "am-pill-err") + '">' + (a.enabled ? "Enabled" : "Paused") + '</span>' +
          '</div>' +
          '<div class="am-card-meta">' + esc(scheduleLabel(a.schedule)) + (a.created_at ? " · Created " + esc(fmt(a.created_at)) : "") + '</div>' +
          '<div class="am-card-body">' + esc(String(a.instruction || "").slice(0, 320)) + (String(a.instruction || "").length > 320 ? "…" : "") + '</div>' +
          '<div class="am-card-foot">' +
            '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--text-muted);cursor:pointer">' +
              '<input type="checkbox" data-action="toggle-auto"' + (a.enabled ? " checked" : "") + (busy ? " disabled" : "") + '> Active' +
            '</label>' +
            '<button type="button" class="am-btn am-btn-sm" data-action="run-auto"' + (busy ? " disabled" : "") + '>Run now</button>' +
            (confirming
              ? '<button type="button" class="am-btn am-btn-sm am-btn-danger" data-action="confirm-del-auto"' + (busy ? " disabled" : "") + '>Confirm</button>' +
                '<button type="button" class="am-btn am-btn-sm" data-action="cancel-del-auto">Cancel</button>'
              : '<button type="button" class="am-btn am-btn-sm am-btn-danger" style="margin-left:auto" data-action="del-auto"' + (busy ? " disabled" : "") + '>Delete</button>') +
          '</div>' +
        '</div>';
      }).join("") + '</div>';
    }

    function renderDispatches() {
      var counts = summarizeDispatches(state.dispatches);
      dispHeading.textContent = "Fleet dispatch queue (" + counts.total + ")";
      var filters = [
        { id: "all", label: "All (" + counts.total + ")" },
        { id: "active", label: "In flight (" + (counts.queued + counts.running) + ")" },
        { id: "done", label: "Done (" + counts.done + ")" },
        { id: "error", label: "Errors (" + counts.error + ")" }
      ];
      dispFiltersEl.innerHTML = filters.map(function (f) {
        return '<button type="button" class="am-filter" data-filter="' + f.id + '" aria-pressed="' + (state.dispFilter === f.id ? "true" : "false") + '">' + esc(f.label) + '</button>';
      }).join("");

      if (state.dispLoading) {
        dispListEl.innerHTML = '<div class="am-empty">Loading dispatch history…</div>';
        return;
      }
      if (state.signedOut) {
        dispListEl.innerHTML = '<div class="am-empty">Sign in to view your fleet dispatch queue and run history.</div>';
        return;
      }
      if (state.dispError) {
        dispListEl.innerHTML = '<div class="am-empty">' + esc(state.dispError) + '</div>';
        return;
      }
      var visible = filterDispatches(state.dispatches, state.dispFilter);
      if (!visible.length) {
        dispListEl.innerHTML = '<div class="am-empty">' +
          (state.dispatches.length ? "No dispatches match the selected filter." : "No dispatches queued yet — runs from automations and one-off dispatches appear here.") +
          '</div>';
        return;
      }
      dispListEl.innerHTML = '<div class="am-grid">' + visible.map(function (d) {
        var meta = dispatchStatusMeta(d.status);
        var out = d.error ? "Error: " + d.error : d.result;
        var tl = ["Queued · " + fmt(d.created_at)];
        if (d.claimed_at) tl.push("Claimed" + (d.claimed_by ? " by " + d.claimed_by : "") + " · " + fmt(d.claimed_at));
        if (d.finished_at) tl.push((d.status === "error" ? "Failed" : "Finished") + " · " + fmt(d.finished_at));
        return '<div class="am-card" data-did="' + esc(d.id) + '">' +
          '<div class="am-card-top">' +
            '<span class="am-dot ' + meta.dot + '"></span>' +
            '<span class="am-pill ' + meta.pill + '">' + esc(meta.label) + '</span>' +
            '<span class="am-card-meta">#' + esc(String(d.id || "").slice(0, 8)) + (d.priority === "high" ? " · high priority" : "") + '</span>' +
          '</div>' +
          '<div class="am-card-body">' + esc(String(d.instruction || "").slice(0, 220)) + (String(d.instruction || "").length > 220 ? "…" : "") + '</div>' +
          '<ol class="am-tl">' + tl.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ol>' +
          (out
            ? '<details class="am-result"><summary>' + (d.error ? "Error details" : "Run output") + '</summary><pre>' + esc(String(out).slice(0, 8000)) + '</pre></details>'
            : "") +
        '</div>';
      }).join("") + '</div>';
    }

    function loadAutomations() {
      return getSessionInfo().then(function (sess) {
        if (!sess) {
          state.signedOut = true;
          state.autoLoading = false;
          renderAutomations();
          return;
        }
        state.signedOut = false;
        return fetch(AUTO_SELECT_URL, { headers: sbHeaders(sess.token) })
          .then(function (res) {
            return res.json().catch(function () { return null; }).then(function (j) {
              if (!res.ok) {
                if (isMissingTableError(res.status, j)) {
                  state.autoTablePending = true;
                  state.autoError = "";
                  state.automations = [];
                  return;
                }
                throw new Error((j && (j.message || j.error)) || ("Request failed (" + res.status + ")"));
              }
              state.autoTablePending = false;
              state.autoError = "";
              state.automations = Array.isArray(j) ? j : [];
            });
          })
          .catch(function (e) {
            state.autoError = e && e.message ? e.message : "Could not load automations.";
          })
          .then(function () {
            state.autoLoading = false;
            renderAutomations();
          });
      });
    }

    function loadDispatches() {
      return getSessionInfo().then(function (sess) {
        if (!sess) {
          state.signedOut = true;
          state.dispLoading = false;
          renderDispatches();
          return;
        }
        state.signedOut = false;
        return fetch(DISP_SELECT_URL, { headers: sbHeaders(sess.token) })
          .then(function (res) {
            return res.json().catch(function () { return null; }).then(function (j) {
              if (!res.ok) {
                throw new Error((j && (j.message || j.error)) || ("Request failed (" + res.status + ")"));
              }
              state.dispError = "";
              state.dispatches = Array.isArray(j) ? j : [];
            });
          })
          .catch(function (e) {
            state.dispError = e && e.message ? e.message : "Could not load fleet dispatches.";
          })
          .then(function () {
            state.dispLoading = false;
            renderDispatches();
          });
      });
    }

    function insertDispatch(instruction, priority) {
      return getSessionInfo().then(function (sess) {
        if (!sess || !sess.userId) throw new Error("Please sign in to queue a fleet dispatch.");
        return fetch(DISP_WRITE_URL, {
          method: "POST",
          headers: sbHeaders(sess.token, { "Content-Type": "application/json", Prefer: "return=representation" }),
          body: JSON.stringify({
            thread_id: null,
            user_id: sess.userId,
            instruction: instruction,
            priority: priority || "normal"
          })
        }).then(function (res) {
          return res.json().catch(function () { return null; }).then(function (j) {
            if (!res.ok) throw new Error((j && (j.message || j.error)) || ("Dispatch failed (" + res.status + ")"));
            return Array.isArray(j) ? j[0] : j;
          });
        });
      });
    }

    function pollLoop() {
      clearTimeout(state.pollTimer);
      if (!host.isConnected) return;
      var inFlight = state.dispatches.some(function (d) { return d.status === "queued" || d.status === "running"; });
      (inFlight ? loadDispatches() : Promise.resolve()).then(function () {
        if (host.isConnected) state.pollTimer = setTimeout(pollLoop, 8000);
      });
    }

    createForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var check = validateAutomationInput({
        name: nameInput.value,
        instruction: instInput.value,
        schedule: state.schedule
      });
      if (!check.ok) {
        setMsg(createMsg, check.error, "err");
        return;
      }
      var runFirst = !!(queueFirstInput && queueFirstInput.checked);
      createSubmit.disabled = true;
      createSubmit.textContent = "Saving…";
      setMsg(createMsg, "", "");

      getSessionInfo().then(function (sess) {
        if (!sess || !sess.userId) throw new Error("Please sign in to create an automation.");
        var payload = {
          user_id: sess.userId,
          name: check.value.name,
          instruction: check.value.instruction,
          schedule: check.value.schedule,
          enabled: true
        };
        return fetch(AUTO_WRITE_URL, {
          method: "POST",
          headers: sbHeaders(sess.token, { "Content-Type": "application/json", Prefer: "return=representation" }),
          body: JSON.stringify(payload)
        }).then(function (res) {
          return res.json().catch(function () { return null; }).then(function (j) {
            if (!res.ok) {
              if (isMissingTableError(res.status, j)) {
                throw new Error("Database migration sql/automations.sql is pending — use Queue run below for immediate dispatches.");
              }
              throw new Error((j && (j.message || j.error)) || ("Create failed (" + res.status + ")"));
            }
            var created = Array.isArray(j) && j[0] ? j[0] : payload;
            state.autoTablePending = false;
            state.automations = [created].concat(state.automations.filter(function (x) { return x.id !== created.id; }));
            renderAutomations();
            if (!runFirst) return null;
            return insertDispatch("[Automation: " + check.value.name + "] " + check.value.instruction, "normal")
              .then(function () { return loadDispatches(); });
          });
        });
      }).then(function () {
        nameInput.value = "";
        instInput.value = "";
        if (queueFirstInput) queueFirstInput.checked = false;
        setMsg(createMsg, "Saved — scheduled " + scheduleLabel(check.value.schedule) + (runFirst ? " and queued now." : "."), "ok");
      }).catch(function (err) {
        setMsg(createMsg, err && err.message ? err.message : "Could not create automation.", "err");
      }).then(function () {
        createSubmit.disabled = false;
        createSubmit.textContent = "Create automation";
      });
    });

    dispForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var check = validateDispatchInput({
        instruction: dispInput.value,
        priority: dispPrio.value
      });
      if (!check.ok) {
        setMsg(dispMsg, check.error, "err");
        return;
      }
      dispSubmit.disabled = true;
      dispSubmit.textContent = "Queueing…";
      setMsg(dispMsg, "", "");
      insertDispatch(check.value.instruction, check.value.priority)
        .then(function (row) {
          dispInput.value = "";
          setMsg(dispMsg, "Queued dispatch #" + String((row && row.id) || "").slice(0, 8) + " — executes on the 5-minute cycle.", "ok");
          return loadDispatches();
        })
        .catch(function (err) {
          setMsg(dispMsg, err && err.message ? err.message : "Could not queue dispatch.", "err");
        })
        .then(function () {
          dispSubmit.disabled = false;
          dispSubmit.textContent = "Queue run";
        });
    });

    host.addEventListener("click", function (e) {
      var schedBtn = e.target.closest && e.target.closest(".am-sched-btn");
      if (schedBtn) {
        state.schedule = schedBtn.getAttribute("data-sched") || "daily";
        syncScheduleButtons();
        return;
      }
      var filterBtn = e.target.closest && e.target.closest(".am-filter");
      if (filterBtn) {
        state.dispFilter = filterBtn.getAttribute("data-filter") || "all";
        renderDispatches();
        return;
      }
      var actEl = e.target.closest && e.target.closest("[data-action]");
      if (!actEl) return;
      var act = actEl.getAttribute("data-action");
      if (act === "refresh-auto") {
        state.autoLoading = true;
        renderAutomations();
        loadAutomations();
        return;
      }
      if (act === "refresh-disp") {
        state.dispLoading = true;
        renderDispatches();
        loadDispatches();
        return;
      }
      var card = actEl.closest("[data-aid]");
      if (!card) return;
      var id = card.getAttribute("data-aid");
      var item = state.automations.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!item) return;

      if (act === "del-auto") {
        state.confirmDeleteId = item.id;
        renderAutomations();
        return;
      }
      if (act === "cancel-del-auto") {
        state.confirmDeleteId = null;
        renderAutomations();
        return;
      }
      if (act === "confirm-del-auto") {
        state.autoBusy[item.id] = true;
        renderAutomations();
        getSessionInfo().then(function (sess) {
          if (!sess) throw new Error("Please sign in.");
          return fetch(AUTO_WRITE_URL + "?id=eq." + encodeURIComponent(item.id), {
            method: "DELETE",
            headers: sbHeaders(sess.token)
          }).then(function (res) {
            if (!res.ok) throw new Error("Delete failed (" + res.status + ")");
            state.automations = state.automations.filter(function (x) { return x.id !== item.id; });
            state.confirmDeleteId = null;
          });
        }).catch(function (err) {
          setMsg(createMsg, err && err.message ? err.message : "Delete failed.", "err");
        }).then(function () {
          delete state.autoBusy[item.id];
          renderAutomations();
        });
        return;
      }
      if (act === "run-auto") {
        state.autoBusy[item.id] = true;
        renderAutomations();
        insertDispatch("[Automation: " + item.name + "] " + item.instruction, "normal")
          .then(function (row) {
            setMsg(dispMsg, "Queued \"" + item.name + "\" as dispatch #" + String((row && row.id) || "").slice(0, 8) + ".", "ok");
            return loadDispatches();
          })
          .catch(function (err) {
            setMsg(dispMsg, err && err.message ? err.message : "Could not queue run.", "err");
          })
          .then(function () {
            delete state.autoBusy[item.id];
            renderAutomations();
          });
      }
    });

    host.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || t.getAttribute("data-action") !== "toggle-auto") return;
      var card = t.closest("[data-aid]");
      if (!card) return;
      var id = card.getAttribute("data-aid");
      var item = state.automations.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!item) return;
      var nextEnabled = !!t.checked;
      state.autoBusy[item.id] = true;
      renderAutomations();
      getSessionInfo().then(function (sess) {
        if (!sess) throw new Error("Please sign in.");
        return fetch(AUTO_WRITE_URL + "?id=eq." + encodeURIComponent(item.id), {
          method: "PATCH",
          headers: sbHeaders(sess.token, { "Content-Type": "application/json", Prefer: "return=representation" }),
          body: JSON.stringify({ enabled: nextEnabled })
        }).then(function (res) {
          if (!res.ok) throw new Error("Update failed (" + res.status + ")");
          item.enabled = nextEnabled;
        });
      }).catch(function (err) {
        setMsg(createMsg, err && err.message ? err.message : "Could not update automation.", "err");
      }).then(function () {
        delete state.autoBusy[item.id];
        renderAutomations();
      });
    });

    Promise.all([loadAutomations(), loadDispatches()]).then(function () {
      if (host.isConnected) state.pollTimer = setTimeout(pollLoop, 8000);
    });

    return {
      refresh: function () { return Promise.all([loadAutomations(), loadDispatches()]); },
      destroy: function () { clearTimeout(state.pollTimer); }
    };
  }

  function renderSettingsPane() {
    var pane = document.createElement("div");
    pane.className = "stg-pane";
    mount(pane, { hideHeading: false });
    return pane;
  }

  function openAutomations() {
    if (root.SettingsUI && typeof root.SettingsUI.open === "function") {
      root.SettingsUI.open("automations");
      return;
    }
    if (typeof root.openModule === "function") {
      root.openModule("fleet", "FleetUI", "open", "automations");
    }
  }

  function registerWithSettings() {
    if (root.SettingsUI && typeof root.SettingsUI.registerPane === "function") {
      root.SettingsUI.registerPane({
        id: "automations",
        label: "Automations",
        icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        render: renderSettingsPane,
        after: "connectors"
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", registerWithSettings);
  } else {
    registerWithSettings();
  }

  root.AutomationsUI = {
    mount: mount,
    renderPane: renderSettingsPane,
    open: openAutomations,
    SCHEDULES: SCHEDULES,
    scheduleLabel: scheduleLabel
  };
})(typeof window !== "undefined" ? window : globalThis);
