(function () {
  "use strict";
  var URL_ = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/monitors";
  var INTERVALS = [[15, "Every 15 min"], [30, "Every 30 min"], [60, "Every hour"], [360, "Every 6 hours"], [720, "Every 12 hours"], [1440, "Every 24 hours"]];
  var root = null, tab = "monitors", monitors = [], events = [], timer = null;
  var workflows = [], runs = [], prefs = null, pcfg = null, pushCount = 0, draft = null, openRun = null, notice = "";
  var state = { loading: true, setup: false, error: "", running: {}, editing: null, creating: false, wfRunning: {} };

  var MOJI = /[\u00C2\u00C3][\u0080-\u00BF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]*|\u00E2[\u0080-\u00BF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]*/g;
  function clean(s) {
    if (s == null) return "";
    return String(s).replace(MOJI, "-").replace(/\uFFFD+/g, " ").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
      .replace(/ {2,}/g, " ").replace(/(\S) - (\S)/g, "$1 - $2");
  }
  function esc(s) { var d = document.createElement("div"); d.textContent = clean(s); return d.innerHTML; }
  function ivLabel(m) { for (var i = 0; i < INTERVALS.length; i++) if (INTERVALS[i][0] === +m) return INTERVALS[i][1]; return "Every " + m + " min"; }
  function ago(t) {
    if (!t) return "never";
    var s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  function ivOptions(sel) { return INTERVALS.map(function (o) { return '<option value="' + o[0] + '"' + (+sel === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join(""); }

  function api(body) {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in to use Tasks.");
      return fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(body) });
    }).then(function (res) {
      if (res.status === 404) { var e = new Error("setup"); e.setup = true; throw e; }
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(clean(j.error || j.message) || "Request failed (" + res.status + ")");
        return j;
      });
    });
  }

  function ensureCss() {
    if (document.querySelector('link[href*="monitors.css"]')) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "modules/monitors.css"; document.head.appendChild(l);
  }

  function refresh() {
    return Promise.all([api({ action: "list" }), api({ action: "events", limit: 50 })]).then(function (r) {
      monitors = r[0].monitors || []; events = r[1].events || [];
      state.setup = false; state.error = ""; state.loading = false;
      return loadExtras();
    }).catch(function (e) {
      state.loading = false;
      if (e.setup) state.setup = true; else state.error = clean(e.message);
    }).then(render);
  }
  // F5/F6 data — older backends without these actions just leave the sections empty.
  function loadExtras() {
    return Promise.all([
      api({ action: "wf_list" }).then(function (r) { workflows = r.workflows || []; }).catch(function () {}),
      api({ action: "wf_runs", limit: 30 }).then(function (r) { runs = r.runs || []; }).catch(function () {}),
      api({ action: "prefs_get" }).then(function (r) { prefs = r.prefs; pushCount = r.push_subscriptions || 0; }).catch(function () {}),
      api({ action: "push_config" }).then(function (r) { pcfg = r; }).catch(function () {})
    ]);
  }
  function refreshEvents() {
    return api({ action: "events", limit: 50 }).then(function (r) { events = r.events || []; render(); }).catch(function () {});
  }

  function unread() { return events.filter(function (e) { return !e.read; }).length; }

  function monitorCard(m) {
    if (state.editing === m.id) return '<div class="tk-card" data-id="' + m.id + '"><div class="tk-form">' +
      '<input class="tk-input" data-f="name" value="' + esc(m.name) + '" placeholder="Name">' +
      '<textarea class="tk-textarea" data-f="query" placeholder="What should be monitored?">' + esc(m.query) + '</textarea>' +
      '<div class="tk-row"><select class="tk-select" data-f="interval">' + ivOptions(m.interval_min) + '</select><span class="tk-grow"></span>' +
      '<button class="tk-btn" data-act="cancel-edit">Cancel</button><button class="tk-btn primary" data-act="save-edit">Save</button></div></div></div>';
    var run = state.running[m.id];
    return '<div class="tk-card" data-id="' + m.id + '"><div class="tk-row">' +
      '<div class="tk-grow"><div class="tk-name">' + esc(m.name) + '</div><div class="tk-q">' + esc(m.query) + '</div></div>' +
      '<button class="tk-switch' + (m.enabled ? " on" : "") + '" data-act="toggle" title="' + (m.enabled ? "Enabled" : "Paused") + '" aria-label="Toggle"></button></div>' +
      '<div class="tk-meta">' + esc(ivLabel(m.interval_min)) + ' · Last run ' + esc(ago(m.last_run_at)) + '</div>' +
      (m.last_digest ? '<div class="tk-digest">' + esc(m.last_digest) + '</div>' : '') +
      '<div class="tk-row" style="margin-top:12px"><button class="tk-btn" data-act="run"' + (run ? " disabled" : "") + '>' + (run ? '<span class="tk-spin"></span>Running…' : "Run now") + '</button>' +
      '<button class="tk-btn" data-act="edit">Edit</button><button class="tk-btn danger" data-act="delete">Delete</button></div></div>';
  }

  function monitorsView() {
    var h = '<div class="tk-wrap">';
    if (state.creating) h += '<div class="tk-card" id="tkCreate"><div class="tk-form"><input class="tk-input" data-f="name" placeholder="Name (e.g. NVDA news)">' +
      '<textarea class="tk-textarea" data-f="query" placeholder="What should be monitored? e.g. Any material news about NVIDIA"></textarea>' +
      '<div class="tk-row"><select class="tk-select" data-f="interval">' + ivOptions(60) + '</select><span class="tk-grow"></span>' +
      '<button class="tk-btn" data-act="cancel-create">Cancel</button><button class="tk-btn primary" data-act="save-create">Create monitor</button></div></div></div>';
    else h += '<div class="tk-row"><span class="tk-grow tk-meta" style="margin:0">Monitors re-run a query on a schedule and alert you to changes.</span><button class="tk-btn primary" data-act="new">+ New monitor</button></div>';
    if (state.error) h += '<div class="tk-err">' + esc(state.error) + '</div>';
    if (!monitors.length) h += '<div class="tk-empty">No monitors yet. Create one to track a topic automatically.</div>';
    else h += monitors.map(monitorCard).join("");
    return h + "</div>";
  }

  function inboxView() {
    var h = '<div class="tk-wrap"><div class="tk-row"><span class="tk-grow tk-meta" style="margin:0">' + unread() + ' unread</span>' +
      '<button class="tk-btn" data-act="read-all"' + (unread() ? "" : " disabled") + '>Mark all read</button></div>';
    h += notifPanel();
    if (!events.length) h += '<div class="tk-empty">Your inbox is empty. Alerts and digests from your monitors will appear here.</div>';
    else h += events.map(function (e) {
      var al = e.kind === "alert" || e.kind === "error";
      var lbl = { alert: "ALERT", error: "ERROR", digest: "DIGEST", task: "TASK", workflow: "WORKFLOW" }[e.kind] || String(e.kind || "").toUpperCase();
      return '<div class="tk-card tk-ev"><span class="tk-dot' + (e.read ? " read" : "") + '"></span><div class="tk-grow">' +
        '<div class="tk-row"><span class="tk-badge' + (al ? " alert" : "") + '">' + lbl + '</span><span class="tk-name">' + esc(e.title) + '</span></div>' +
        '<div class="tk-evbody">' + esc(e.body) + '</div><div class="tk-meta">' + esc(e.monitor_name || "") + (e.monitor_name ? " · " : "") + esc(ago(e.created_at)) + '</div></div></div>';
    }).join("");
    return h + "</div>";
  }


  // ---- Notification settings (email + web push) ----
  function modeOpts(list, sel) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (sel === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join(""); }
  var EMAIL_MODES = [["off", "Off"], ["alerts", "Alerts & completions"], ["all", "Everything"], ["daily", "Daily digest"]];
  var PUSH_MODES = [["off", "Off"], ["alerts", "Alerts & completions"], ["all", "Everything"]];
  function notifPanel() {
    var p = prefs || { email_mode: "alerts", push_mode: "alerts", email_to: "" };
    var pushOk = !!(pcfg && pcfg.push_available) && ("serviceWorker" in navigator) && ("PushManager" in window);
    var h = '<div class="tk-card" id="tkNotif"><div class="tk-name">Notification delivery</div><div class="tk-form" style="margin-top:10px">';
    h += '<div class="tk-row"><span class="tk-grow">Email</span><select class="tk-select" data-p="email_mode">' + modeOpts(EMAIL_MODES, p.email_mode) + '</select></div>';
    h += '<input class="tk-input" data-p="email_to" placeholder="' + esc((pcfg && pcfg.user_email) || "Send to (defaults to your account email)") + '" value="' + esc(p.email_to || "") + '">';
    if (pcfg && !pcfg.email_configured) h += '<div class="tk-meta" style="margin:0">Email sending is not configured on the server yet (missing email API key). Preferences are saved and will apply once it is.</div>';
    h += '<div class="tk-row"><span class="tk-grow">Browser push</span><select class="tk-select" data-p="push_mode">' + modeOpts(PUSH_MODES, p.push_mode) + '</select></div>';
    h += '<div class="tk-row"><span class="tk-grow tk-meta" style="margin:0">' + (pushCount ? pushCount + " device(s) subscribed" : "No devices subscribed") + '</span>' +
      (pushOk ? '<button class="tk-btn" data-act="push-on">Enable on this device</button>' + (pushCount ? '<button class="tk-btn" data-act="push-off">Disable here</button>' : "") : '<span class="tk-meta" style="margin:0">' + (pcfg && !pcfg.push_available ? "Push not configured on server" : "Push unsupported in this browser") + '</span>') +
      '<button class="tk-btn" data-act="notify-test">Send test</button></div>';
    if (notice) h += '<div class="tk-meta" style="margin:0">' + esc(notice) + '</div>';
    return h + '</div></div>';
  }
  function savePrefs() {
    var o = { action: "prefs_set" };
    root.querySelectorAll("#tkNotif [data-p]").forEach(function (i) { o[i.getAttribute("data-p")] = i.value; });
    return api(o).then(function (r) { prefs = r.prefs || prefs; notice = "Saved."; render(); }).catch(function (e) { notice = e.message; render(); });
  }
  function urlB64(s) { s = (s + "====".slice(s.length % 4 || 4)).replace(/-/g, "+").replace(/_/g, "/"); var r = atob(s), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
  function pushOn() {
    notice = "Requesting permission…"; render();
    return Notification.requestPermission().then(function (perm) {
      if (perm !== "granted") throw new Error("Notification permission was not granted.");
      return navigator.serviceWorker.register("/sw.js");
    }).then(function () { return navigator.serviceWorker.ready; }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (ex) { return ex || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(pcfg.vapid_public) }); });
    }).then(function (sub) {
      return api({ action: "push_subscribe", subscription: sub.toJSON(), user_agent: navigator.userAgent });
    }).then(function () { notice = "Push enabled on this device."; return loadExtras(); }).then(render)
      .catch(function (e) { notice = e.message || "Could not enable push."; render(); });
  }
  function pushOff() {
    return navigator.serviceWorker.getRegistration("/sw.js").then(function (reg) { return reg && reg.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return; var ep = sub.endpoint; return sub.unsubscribe().then(function () { return api({ action: "push_unsubscribe", endpoint: ep }); });
    }).then(loadExtras).then(function () { notice = "Push disabled on this device."; render(); }).catch(function (e) { notice = e.message; render(); });
  }
  function notifyTest() {
    notice = "Sending test…"; render();
    return api({ action: "notify_test" }).then(function (r) {
      var x = r.result || {}; var parts = [];
      parts.push("Push: " + (typeof x.push === "object" ? x.push.sent + " sent, " + x.push.failed + " failed" : x.push));
      parts.push("Email: " + x.email);
      notice = parts.join(" · "); render();
    }).catch(function (e) { notice = e.message; render(); });
  }

  // ---- Workflows ----
  function stepEditor(st, i, n) {
    var isTool = st.type === "tool";
    return '<div class="tk-step" data-i="' + i + '"><div class="tk-row"><span class="tk-badge">' + (i + 1) + '</span>' +
      '<select class="tk-select" data-s="type"><option value="prompt"' + (!isTool ? " selected" : "") + '>Prompt</option><option value="tool"' + (isTool ? " selected" : "") + '>Tool</option></select>' +
      (isTool ? '<select class="tk-select" data-s="tool"><option value="web_search"' + (st.tool === "web_search" ? " selected" : "") + '>Web search</option><option value="fetch_url"' + (st.tool === "fetch_url" ? " selected" : "") + '>Fetch URL</option></select>' : "") +
      '<span class="tk-grow"></span><button class="tk-btn" data-act="step-up"' + (i === 0 ? " disabled" : "") + '>↑</button><button class="tk-btn" data-act="step-down"' + (i === n - 1 ? " disabled" : "") + '>↓</button><button class="tk-btn danger" data-act="step-del">✕</button></div>' +
      '<textarea class="tk-textarea" data-s="' + (isTool ? "arg" : "prompt") + '" placeholder="' + (isTool ? (st.tool === "fetch_url" ? "https://… (can use {{input}} / {{prev}})" : "Search query, e.g. {{input}} latest news") : "Instruction. Use {{input}} for the run input and {{prev}} for the previous step's output") + '">' + esc(isTool ? st.arg : st.prompt) + '</textarea></div>';
  }
  function wfDraftView() {
    return '<div class="tk-card" id="tkWf"><div class="tk-form"><input class="tk-input" data-w="name" placeholder="Workflow name" value="' + esc(draft.name) + '">' +
      draft.steps.map(function (s, i) { return stepEditor(s, i, draft.steps.length); }).join("") +
      '<div class="tk-row"><button class="tk-btn" data-act="step-add">+ Add step</button><span class="tk-grow"></span><button class="tk-btn" data-act="wf-cancel">Cancel</button><button class="tk-btn primary" data-act="wf-save">Save workflow</button></div></div></div>';
  }
  function runCard(r) {
    var open = openRun === r.id, st = r.status;
    var h = '<div class="tk-run" data-run="' + r.id + '"><div class="tk-row"><span class="tk-badge' + (st === "error" ? " alert" : "") + '">' + esc(String(st).toUpperCase()) + '</span><span class="tk-grow tk-meta" style="margin:0">' + esc(r.workflow_name || "") + ' · ' + esc(ago(r.started_at)) + (r.input ? ' · input: ' + esc(String(r.input).slice(0, 60)) : "") + '</span><button class="tk-btn" data-act="run-toggle">' + (open ? "Hide" : "Details") + '</button></div>';
    if (open) {
      h += (r.steps_log || []).map(function (s) {
        return '<div class="tk-digest"><b>' + s.i + '. ' + esc(s.title || s.type) + '</b> · ' + esc(s.status) + (s.ms ? ' · ' + (s.ms / 1000).toFixed(1) + 's' : "") + '\n' + esc(s.error || s.output || "") + '</div>';
      }).join("");
    }
    return h + "</div>";
  }
  function workflowsView() {
    var h = '<div class="tk-wrap">';
    if (draft) h += wfDraftView();
    else h += '<div class="tk-row"><span class="tk-grow tk-meta" style="margin:0">Chain prompts and tools. Each step\'s output feeds the next as {{prev}}.</span><button class="tk-btn primary" data-act="wf-new">+ New workflow</button></div>';
    if (state.error) h += '<div class="tk-err">' + esc(state.error) + '</div>';
    if (!workflows.length && !draft) h += '<div class="tk-empty">No workflows yet. Create one to run multi-step research automatically.</div>';
    h += workflows.map(function (w) {
      var run = state.wfRunning[w.id];
      return '<div class="tk-card" data-wf="' + w.id + '"><div class="tk-name">' + esc(w.name) + '</div><div class="tk-q">' +
        (w.steps || []).map(function (s, i) { return (i + 1) + '. ' + (s.type === "tool" ? "[" + (s.tool === "fetch_url" ? "fetch" : "search") + "] " : "") + esc(String(s.type === "tool" ? s.arg : s.prompt).slice(0, 70)); }).join("<br>") + '</div>' +
        '<div class="tk-row" style="margin-top:12px"><input class="tk-input tk-grow" data-w="input" placeholder="Input (optional) → {{input}}"' + (run ? " disabled" : "") + '>' +
        '<button class="tk-btn primary" data-act="wf-run"' + (run ? " disabled" : "") + '>' + (run ? '<span class="tk-spin"></span>Running…' : "Run") + '</button><button class="tk-btn" data-act="wf-edit">Edit</button><button class="tk-btn danger" data-act="wf-delete">Delete</button></div></div>';
    }).join("");
    h += '<div class="tk-name" style="margin-top:8px">Run history</div>';
    h += runs.length ? runs.map(runCard).join("") : '<div class="tk-empty">No runs yet.</div>';
    return h + "</div>";
  }
  function readDraft() {
    if (!draft) return;
    var sc = root.querySelector("#tkWf"); if (!sc) return;
    draft.name = sc.querySelector('[data-w=name]').value;
    sc.querySelectorAll(".tk-step").forEach(function (el, i) {
      var st = draft.steps[i]; if (!st) return;
      el.querySelectorAll("[data-s]").forEach(function (f) { st[f.getAttribute("data-s")] = f.value; });
    });
  }

  function render() {
    if (!root) return;
    var body = root.querySelector(".tk-body"), scroll = body ? body.scrollTop : 0;
    var u = unread();
    root.querySelector(".tk-tabs").innerHTML =
      '<button class="tk-tab' + (tab === "monitors" ? " active" : "") + '" data-tab="monitors">Monitors</button>' +
      '<button class="tk-tab' + (tab === "workflows" ? " active" : "") + '" data-tab="workflows">Workflows</button>' +
      '<button class="tk-tab' + (tab === "inbox" ? " active" : "") + '" data-tab="inbox">Inbox' + (u ? ' <span class="tk-count">' + u + '</span>' : "") + '</button>';
    var h;
    if (state.loading) h = '<div class="tk-msg">Connecting…</div>';
    else if (state.setup) h = '<div class="tk-msg">Tasks isn\'t set up yet. The monitors service is still being deployed — please check back shortly.</div>';
    else h = tab === "monitors" ? monitorsView() : tab === "workflows" ? workflowsView() : inboxView();
    // keep create-form input while polling re-renders
    var keep = {}, keepIn = {};
    body.querySelectorAll("[data-wf] [data-w=input]").forEach(function (i) { keepIn[i.closest("[data-wf]").dataset.wf] = i.value; });
    body.querySelectorAll("#tkNotif [data-p=email_to]").forEach(function (i) { keep.__email = i.value; });
    body.querySelectorAll("#tkCreate [data-f]").forEach(function (i) { keep[i.getAttribute("data-f")] = i.value; });
    body.innerHTML = h;
    body.querySelectorAll("#tkCreate [data-f]").forEach(function (i) { var k = i.getAttribute("data-f"); if (keep[k] != null) i.value = keep[k]; });
    body.querySelectorAll("[data-wf] [data-w=input]").forEach(function (i) { var v = keepIn[i.closest("[data-wf]").dataset.wf]; if (v != null) i.value = v; });
    body.scrollTop = scroll;
  }

  function vals(scope) {
    var o = {}; scope.querySelectorAll("[data-f]").forEach(function (i) { o[i.getAttribute("data-f")] = i.value; });
    return { name: (o.name || "").trim(), query: (o.query || "").trim(), interval_min: parseInt(o.interval, 10) || 60 };
  }
  function find(id) { return monitors.filter(function (m) { return m.id === id; })[0]; }
  function fail(e) { state.error = e.message === "setup" ? "Service unavailable." : clean(e.message); render(); }

  function onClick(ev) {
    var t = ev.target.closest("[data-tab],[data-act],.tk-x"); if (!t) return;
    if (t.classList.contains("tk-x")) return close();
    if (t.dataset.tab) { tab = t.dataset.tab; render(); if (tab === "inbox") refreshEvents(); return; }
    var act = t.dataset.act;
    if (tab === "workflows" || act === "push-on" || act === "push-off" || act === "notify-test") { if (handleExtra(act, t)) return; }
    var card = t.closest("[data-id]"), id = card && card.dataset.id, m = id && find(id);
    if (act === "new") { state.creating = true; render(); }
    else if (act === "cancel-create") { state.creating = false; render(); }
    else if (act === "save-create") {
      var v = vals(root.querySelector("#tkCreate"));
      if (!v.name || !v.query) { state.error = "Name and query are required."; return render(); }
      state.error = "";
      api({ action: "create", name: v.name, query: v.query, interval_min: v.interval_min }).then(function () { state.creating = false; return refresh(); }).catch(fail);
    }
    else if (act === "toggle" && m) {
      api({ action: "update", id: id, enabled: !m.enabled }).then(function (r) { if (r.monitor) Object.assign(m, r.monitor); else m.enabled = !m.enabled; render(); }).catch(fail);
    }
    else if (act === "edit") { state.editing = id; render(); }
    else if (act === "cancel-edit") { state.editing = null; render(); }
    else if (act === "save-edit") {
      var e = vals(card);
      if (!e.name || !e.query) { state.error = "Name and query are required."; return render(); }
      api({ action: "update", id: id, name: e.name, query: e.query, interval_min: e.interval_min }).then(function () { state.editing = null; state.error = ""; return refresh(); }).catch(fail);
    }
    else if (act === "delete" && m) {
      if (!window.confirm('Delete monitor "' + m.name + '"?')) return;
      api({ action: "delete", id: id }).then(refresh).catch(fail);
    }
    else if (act === "run" && m) {
      state.running[id] = true; render();
      api({ action: "run", id: id }).catch(fail).then(function () { delete state.running[id]; return refresh(); });
    }
    else if (act === "read-all") {
      api({ action: "read_all" }).then(function () { events.forEach(function (x) { x.read = true; }); render(); }).catch(fail);
    }
  }

  function handleExtra(act, t) {
    var wcard = t.closest("[data-wf]"), wid = wcard && wcard.dataset.wf, w = wid && workflows.filter(function (x) { return x.id === wid; })[0];
    var blank = function () { return { type: "prompt", prompt: "" }; };
    switch (act) {
      case "push-on": pushOn(); return true;
      case "push-off": pushOff(); return true;
      case "notify-test": notifyTest(); return true;
      case "wf-new": draft = { id: null, name: "", steps: [blank()] }; render(); return true;
      case "wf-edit": draft = { id: w.id, name: w.name, steps: JSON.parse(JSON.stringify(w.steps || [])) }; render(); return true;
      case "wf-cancel": draft = null; state.error = ""; render(); return true;
      case "step-add": readDraft(); if (draft.steps.length < 8) draft.steps.push(blank()); render(); return true;
      case "step-del": case "step-up": case "step-down": {
        readDraft(); var i = +t.closest(".tk-step").dataset.i, s = draft.steps;
        if (act === "step-del") { if (s.length > 1) s.splice(i, 1); }
        else { var j = act === "step-up" ? i - 1 : i + 1; if (s[j]) { var tmp = s[i]; s[i] = s[j]; s[j] = tmp; } }
        render(); return true;
      }
      case "wf-save": {
        readDraft();
        if (!draft.name.trim()) { state.error = "Give the workflow a name."; render(); return true; }
        var steps = draft.steps.map(function (s) { return s.type === "tool" ? { type: "tool", tool: s.tool || "web_search", arg: s.arg || "" } : { type: "prompt", prompt: s.prompt || "" }; });
        var body = draft.id ? { action: "wf_update", id: draft.id, name: draft.name, steps: steps } : { action: "wf_create", name: draft.name, steps: steps };
        api(body).then(function () { draft = null; state.error = ""; return loadExtras(); }).then(render).catch(fail); return true;
      }
      case "wf-delete":
        if (!window.confirm('Delete workflow "' + w.name + '" and its run history?')) return true;
        api({ action: "wf_delete", id: wid }).then(loadExtras).then(render).catch(fail); return true;
      case "wf-run": {
        var input = (wcard.querySelector("[data-w=input]") || {}).value || "";
        state.wfRunning[wid] = true; state.error = ""; render();
        api({ action: "wf_run", id: wid, input: input }).then(function (r) { if (r.run) openRun = r.run.id; }).catch(fail)
          .then(function () { delete state.wfRunning[wid]; return Promise.all([loadExtras(), refreshEvents()]); }).then(render);
        return true;
      }
      case "run-toggle": { var rid = t.closest("[data-run]").dataset.run; openRun = openRun === rid ? null : rid; render(); return true; }
    }
    return false;
  }
  function onChange(ev) {
    var t = ev.target;
    if (t.matches && t.matches("#tkNotif [data-p]")) savePrefs();
    else if (t.matches && t.matches("#tkWf .tk-step select[data-s]")) { readDraft(); var i = +t.closest(".tk-step").dataset.i; if (t.dataset.s === "type") { var st = draft.steps[i]; draft.steps[i] = t.value === "tool" ? { type: "tool", tool: "web_search", arg: "" } : { type: "prompt", prompt: "" }; } render(); }
  }
  function onKey(e) { if (e.key === "Escape" && root) close(); }

  var lastFocus = null;
  function open() {
    if (root) return;
    lastFocus = document.activeElement;
    ensureCss();
    root = document.createElement("div");
    root.className = "tk-root";
    root.innerHTML = '<div class="tk-head"><h2 class="tk-title">Tasks</h2><div class="tk-tabs"></div><button class="tk-x" aria-label="Close">×</button></div><div class="tk-body"></div>';
    (document.getElementById("moduleRoot") || document.body).appendChild(root);
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey);
    state.loading = true; state.error = ""; render();
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Tasks");
    var xb = root.querySelector(".tk-x"); if (xb) xb.focus();
    refresh();
    timer = setInterval(refreshEvents, 60000);
  }
  function close() {
    if (!root) return;
    clearInterval(timer); timer = null;
    document.removeEventListener("keydown", onKey);
    root.remove(); root = null;
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }
  window.TasksUI = { open: open, close: close, openInbox: function () { tab = "inbox"; open(); if (root) { render(); refreshEvents(); } } };
  if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", function (e) { if (e.data && e.data.type === "open-tasks-inbox") window.TasksUI.openInbox(); });
  try { if (/[?&]tasks=inbox\b/.test(location.search)) window.addEventListener("load", function () { setTimeout(function () { window.TasksUI.openInbox(); }, 800); }); } catch (e) {}
})();
