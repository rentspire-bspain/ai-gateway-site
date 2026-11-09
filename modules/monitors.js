(function () {
  "use strict";
  var URL_ = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/monitors";
  var INTERVALS = [[15, "Every 15 min"], [30, "Every 30 min"], [60, "Every hour"], [360, "Every 6 hours"], [720, "Every 12 hours"], [1440, "Every 24 hours"]];
  var root = null, tab = "monitors", monitors = [], events = [], timer = null;
  var state = { loading: true, setup: false, error: "", running: {}, editing: null, creating: false };

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
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
        if (!res.ok) throw new Error(j.error || j.message || "Request failed (" + res.status + ")");
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
    }).catch(function (e) {
      state.loading = false;
      if (e.setup) state.setup = true; else state.error = e.message;
    }).then(render);
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
    if (!events.length) h += '<div class="tk-empty">Your inbox is empty. Alerts and digests from your monitors will appear here.</div>';
    else h += events.map(function (e) {
      var al = e.kind === "alert";
      return '<div class="tk-card tk-ev"><span class="tk-dot' + (e.read ? " read" : "") + '"></span><div class="tk-grow">' +
        '<div class="tk-row"><span class="tk-badge' + (al ? " alert" : "") + '">' + (al ? "ALERT" : "DIGEST") + '</span><span class="tk-name">' + esc(e.title) + '</span></div>' +
        '<div class="tk-evbody">' + esc(e.body) + '</div><div class="tk-meta">' + esc(e.monitor_name || "") + (e.monitor_name ? " · " : "") + esc(ago(e.created_at)) + '</div></div></div>';
    }).join("");
    return h + "</div>";
  }

  function render() {
    if (!root) return;
    var body = root.querySelector(".tk-body"), scroll = body ? body.scrollTop : 0;
    var u = unread();
    root.querySelector(".tk-tabs").innerHTML =
      '<button class="tk-tab' + (tab === "monitors" ? " active" : "") + '" data-tab="monitors">Monitors</button>' +
      '<button class="tk-tab' + (tab === "inbox" ? " active" : "") + '" data-tab="inbox">Inbox' + (u ? ' <span class="tk-count">' + u + '</span>' : "") + '</button>';
    var h;
    if (state.loading) h = '<div class="tk-msg">Connecting…</div>';
    else if (state.setup) h = '<div class="tk-msg">Tasks isn\'t set up yet. The monitors service is still being deployed — please check back shortly.</div>';
    else h = tab === "monitors" ? monitorsView() : inboxView();
    // keep create-form input while polling re-renders
    var keep = {};
    body.querySelectorAll("#tkCreate [data-f]").forEach(function (i) { keep[i.getAttribute("data-f")] = i.value; });
    body.innerHTML = h;
    body.querySelectorAll("#tkCreate [data-f]").forEach(function (i) { var k = i.getAttribute("data-f"); if (keep[k] != null) i.value = keep[k]; });
    body.scrollTop = scroll;
  }

  function vals(scope) {
    var o = {}; scope.querySelectorAll("[data-f]").forEach(function (i) { o[i.getAttribute("data-f")] = i.value; });
    return { name: (o.name || "").trim(), query: (o.query || "").trim(), interval_min: parseInt(o.interval, 10) || 60 };
  }
  function find(id) { return monitors.filter(function (m) { return m.id === id; })[0]; }
  function fail(e) { state.error = e.message === "setup" ? "Service unavailable." : e.message; render(); }

  function onClick(ev) {
    var t = ev.target.closest("[data-tab],[data-act],.tk-x"); if (!t) return;
    if (t.classList.contains("tk-x")) return close();
    if (t.dataset.tab) { tab = t.dataset.tab; render(); if (tab === "inbox") refreshEvents(); return; }
    var act = t.dataset.act, card = t.closest("[data-id]"), id = card && card.dataset.id, m = id && find(id);
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
  function onKey(e) { if (e.key === "Escape" && root) close(); }

  function open() {
    if (root) return;
    ensureCss();
    root = document.createElement("div");
    root.className = "tk-root";
    root.innerHTML = '<div class="tk-head"><h2 class="tk-title">Tasks</h2><div class="tk-tabs"></div><button class="tk-x" aria-label="Close">×</button></div><div class="tk-body"></div>';
    (document.getElementById("moduleRoot") || document.body).appendChild(root);
    root.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    state.loading = true; state.error = ""; render();
    refresh();
    timer = setInterval(refreshEvents, 60000);
  }
  function close() {
    if (!root) return;
    clearInterval(timer); timer = null;
    document.removeEventListener("keydown", onKey);
    root.remove(); root = null;
  }
  window.TasksUI = { open: open, close: close };
})();
