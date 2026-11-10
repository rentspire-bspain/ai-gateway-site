/* tasks.js — SCHEDULED TASKS manager (Computer-parity build, 2026-11-10).
   Mounted by modules/monitors.js as the first tab ("Scheduled") of the Tasks overlay: window.ScheduledTasks.mount(container, host).
   Backend: edge function `task-runner` (list / create / update / delete / run_now / preview). Results land in a dedicated thread per task.
   CSP-safe: no inline handlers, no innerHTML with data (DOM built with textContent), external stylesheet only. */
(function () {
  "use strict";
  var URL_ = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/task-runner";
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var FREQS = [["daily", "Daily"], ["weekdays", "Weekdays (Mon–Fri)"], ["weekly", "Weekly"], ["once", "Once"], ["custom", "Custom (cron)"]];
  var browserTz = (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } })();
  var COMMON_TZ = ["UTC", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "Europe/London", "Europe/Madrid", "Europe/Berlin", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];

  var S = { tasks: [], loading: true, setup: false, error: "", form: null, busy: {}, preview: "", previewSeq: 0 };
  var host = null, wrap = null, pollT = null, bound = null;

  // ---------- helpers ----------
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === "text") n.textContent = props[k];
      else if (k === "cls") n.className = props[k];
      else if (k === "data") for (var d in props[k]) n.dataset[d] = props[k][d];
      else if (k === "value") n.value = props[k];
      else if (k === "checked" || k === "disabled" || k === "selected" || k === "hidden") n[k] = !!props[k];
      else n.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function clip(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(iso, tz, withTz) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString([], { timeZone: tz || undefined, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: withTz ? "short" : undefined });
    } catch (e) { return new Date(iso).toLocaleString(); }
  }
  function ago(t) {
    if (!t) return "never";
    var s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  // cron <-> form model (numeric daily / weekdays / weekly patterns; anything else is "custom")
  function fromCron(cron) {
    var f = String(cron || "").trim().split(/\s+/);
    if (f.length === 5 && /^\d+$/.test(f[0]) && /^\d+$/.test(f[1]) && f[2] === "*" && f[3] === "*") {
      var time = pad(+f[1]) + ":" + pad(+f[0]);
      if (f[4] === "*") return { freq: "daily", time: time };
      if (f[4] === "1-5") return { freq: "weekdays", time: time };
      if (/^[0-7]$/.test(f[4])) return { freq: "weekly", time: time, dow: String(+f[4] % 7) };
    }
    return { freq: "custom", cron: cron };
  }
  function toCron(m) {
    if (m.freq === "custom") return String(m.cron || "").trim();
    var p = String(m.time || "07:00").split(":"), hh = parseInt(p[0], 10) || 0, mm = parseInt(p[1], 10) || 0;
    var dow = m.freq === "daily" ? "*" : m.freq === "weekdays" ? "1-5" : String(m.dow || "1");
    return mm + " " + hh + " * * " + dow;
  }
  function scheduleLabel(t) {
    if (t.schedule === "@once") return "Once";
    var m = fromCron(t.schedule);
    if (m.freq === "daily") return "Daily at " + m.time;
    if (m.freq === "weekdays") return "Weekdays at " + m.time;
    if (m.freq === "weekly") return "Weekly on " + DAYS[+m.dow].slice(0, 3) + " at " + m.time;
    return t.schedule;
  }
  function tzList() {
    var seen = {}, out = [];
    [browserTz].concat(COMMON_TZ).forEach(function (z) { if (!seen[z]) { seen[z] = 1; out.push(z); } });
    return out;
  }
  function ensureCss() {
    if (document.querySelector('link[href*="tasks.css"]')) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/modules/tasks.css"; document.head.appendChild(l);
  }

  // ---------- API ----------
  function api(body) {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in to use Tasks.");
      return fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(body) });
    }).then(function (res) {
      if (res.status === 404) { var e = new Error("setup"); e.setup = true; throw e; }
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(String(j.error || j.message || "Request failed (" + res.status + ")"));
        return j;
      });
    });
  }
  function load(quiet) {
    return api({ action: "list" }).then(function (r) {
      S.tasks = r.tasks || []; S.setup = false; S.loading = false; if (!quiet) S.error = "";
    }).catch(function (e) {
      S.loading = false;
      if (e.setup) S.setup = true; else if (!quiet) S.error = e.message;
    }).then(function () { render(); schedulePoll(); });
  }
  function schedulePoll() {
    clearTimeout(pollT);
    if (!alive()) return;
    var running = S.tasks.some(function (t) { return t.last_status === "running"; });
    pollT = setTimeout(function () { if (alive() && !S.form) load(true); else schedulePoll(); }, running ? 5000 : 60000);
  }
  function alive() { return !!(wrap && wrap.isConnected); }

  // ---------- thread opening (results open in the normal thread view) ----------
  function openThread(id, title) {
    if (!id) return;
    if (host && host.close) host.close();
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    client.from("thread_messages").select("role,content,sources,related").eq("thread_id", id).order("created_at", { ascending: true }).then(function (r) {
      var msgs = ((r && r.data) || []).map(function (m) { return { role: m.role, content: m.content, sources: m.sources, related: m.related }; });
      // the runner appends on the server; always replace the local cache so a stale copy is never pushed back over new runs
      var t = null;
      try { t = threads.filter(function (x) { return x.id === id; })[0]; } catch (e) { return; }
      if (!t) { t = { id: id, title: title || "Scheduled task", spaceId: null, messages: msgs }; threads.unshift(t); }
      else t.messages = msgs;
      try { localStorage.setItem("ai_threads", JSON.stringify(threads.filter(function (x) { return !x.incognito; }))); } catch (e) {}
      try { renderThreads(); } catch (e) {}
      loadThread(id);
    });
  }

  // ---------- form ----------
  function blankForm() {
    return { id: null, title: "", instruction: "", query_template: "", freq: "daily", time: "07:00", dow: "1", cron: "", run_at: "", tz: browserTz, email: false, showAdv: false };
  }
  function formFromTask(t) {
    var f = blankForm(), m = t.schedule === "@once" ? { freq: "once" } : fromCron(t.schedule);
    f.id = t.id; f.title = t.title; f.instruction = t.instruction; f.query_template = t.query_template || ""; f.tz = t.timezone || browserTz;
    f.freq = m.freq; f.time = m.time || f.time; f.dow = m.dow || f.dow; f.cron = m.cron || "";
    f.email = (t.delivery || []).indexOf("email") >= 0; f.showAdv = !!t.query_template;
    if (t.schedule === "@once" && t.next_run) f.run_at = localInput(t.next_run);
    return f;
  }
  function localInput(iso) { var d = new Date(iso); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function readForm() {
    var f = S.form; if (!f || !wrap) return;
    wrap.querySelectorAll("[data-f]").forEach(function (i) {
      var k = i.getAttribute("data-f");
      f[k] = i.type === "checkbox" ? i.checked : i.value;
    });
  }
  function scheduleBody(f) {
    var b = { timezone: f.tz, delivery: f.email ? ["thread", "email"] : ["thread"] };
    if (f.freq === "once") {
      var d = f.run_at ? new Date(f.run_at) : null;   // datetime-local is interpreted in the browser's zone
      b.schedule = "@once"; b.run_at = d && !isNaN(+d) ? d.toISOString() : "";
      b.timezone = browserTz;
    } else b.schedule = toCron(f);
    return b;
  }
  function refreshPreview() {
    var f = S.form; if (!f) return;
    var seq = ++S.previewSeq, body = scheduleBody(f);
    body.action = "preview";
    if ((body.schedule === "@once" && !body.run_at) || !body.schedule) { S.preview = ""; paintPreview(); return; }
    api(body).then(function (r) {
      if (seq !== S.previewSeq) return;
      S.preview = "Next runs: " + (r.next_runs || []).map(function (x) { return fmt(x, body.timezone, false); }).join("  ·  ") + (body.schedule !== "@once" ? "  (" + body.timezone + ")" : "");
      S.previewErr = false; paintPreview();
    }).catch(function (e) { if (seq !== S.previewSeq) return; S.preview = e.message; S.previewErr = true; paintPreview(); });
  }
  function paintPreview() { var p = wrap && wrap.querySelector(".st-preview"); if (p) { p.textContent = S.preview; p.classList.toggle("err", !!S.previewErr); } }
  var previewT = null;
  function schedulePreview() { clearTimeout(previewT); previewT = setTimeout(refreshPreview, 350); }

  function field(label, node, hint) {
    return el("label", { cls: "st-field" }, [el("span", { cls: "st-lbl", text: label }), node, hint ? el("span", { cls: "st-hint", text: hint }) : null]);
  }
  function formView() {
    var f = S.form;
    var freq = el("select", { cls: "tk-select", data: { f: "freq" } }, FREQS.map(function (o) { return el("option", { value: o[0], text: o[1], selected: f.freq === o[0] }); }));
    var time = el("input", { cls: "tk-input st-time", type: "time", value: f.time, data: { f: "time" }, hidden: f.freq === "once" || f.freq === "custom" });
    var dow = el("select", { cls: "tk-select", data: { f: "dow" }, hidden: f.freq !== "weekly" }, DAYS.map(function (d, i) { return el("option", { value: String(i), text: d, selected: String(i) === String(f.dow) }); }));
    var once = el("input", { cls: "tk-input", type: "datetime-local", value: f.run_at, data: { f: "run_at" }, hidden: f.freq !== "once" });
    var cron = el("input", { cls: "tk-input", value: f.cron, placeholder: "min hour day month weekday — e.g. 30 9 * * 1", data: { f: "cron" }, hidden: f.freq !== "custom" });
    var tz = el("select", { cls: "tk-select", data: { f: "tz" }, hidden: f.freq === "once", "aria-label": "Time zone" }, tzList().map(function (z) { return el("option", { value: z, text: z, selected: z === f.tz }); }));
    var adv = el("details", { cls: "st-adv" }, [
      el("summary", { text: "Advanced: query template" }),
      el("textarea", { cls: "tk-textarea", data: { f: "query_template" }, placeholder: "Optional. The exact prompt sent each run. Placeholders: {{date}} {{weekday}} {{time}} {{last_result}}", text: f.query_template }),
      el("span", { cls: "st-hint", text: "Leave blank to send the instruction as written. {{last_result}} inserts the previous run's answer, handy for “what changed since last time”." })
    ]);
    if (f.showAdv) adv.open = true;
    return el("div", { cls: "tk-card st-form", id: "stForm" }, [
      el("div", { cls: "tk-name", text: f.id ? "Edit task" : "New scheduled task" }),
      field("Title", el("input", { cls: "tk-input", value: f.title, maxlength: "120", placeholder: "e.g. Morning market brief", data: { f: "title" } })),
      field("Instruction", el("textarea", { cls: "tk-textarea", maxlength: "2000", placeholder: "What should run? e.g. Summarize overnight news on NVIDIA and flag anything that moved the stock.", data: { f: "instruction" }, text: f.instruction })),
      adv,
      el("div", { cls: "st-sched" }, [el("span", { cls: "st-lbl", text: "Schedule" }), el("div", { cls: "tk-row" }, [freq, dow, time, once, cron, tz])]),
      el("div", { cls: "st-preview" + (S.previewErr ? " err" : ""), "aria-live": "polite", text: S.preview }),
      el("div", { cls: "st-deliver" }, [
        el("span", { cls: "st-lbl", text: "Deliver to" }),
        el("label", { cls: "st-check" }, [el("input", { type: "checkbox", checked: true, disabled: true }), " Thread (always)"]),
        el("label", { cls: "st-check" }, [el("input", { type: "checkbox", checked: f.email, data: { f: "email" } }), " Email me"])
      ]),
      el("div", { cls: "tk-row" }, [el("span", { cls: "tk-grow" }),
        el("button", { cls: "tk-btn", type: "button", data: { act: "form-cancel" }, text: "Cancel" }),
        el("button", { cls: "tk-btn primary", type: "button", data: { act: "form-save" }, text: f.id ? "Save changes" : "Create task" })])
    ]);
  }

  // ---------- list ----------
  function statusBadge(t) {
    var s = t.last_status;
    if (s === "running") return el("span", { cls: "tk-badge st-running" }, [el("span", { cls: "tk-spin" }), "RUNNING"]);
    if (s === "ok") return el("span", { cls: "tk-badge st-ok", text: "OK" });
    if (s === "error") return el("span", { cls: "tk-badge alert", text: "FAILED" });
    return el("span", { cls: "tk-badge", text: "NOT RUN" });
  }
  function taskRow(t) {
    var busy = S.busy[t.id], running = t.last_status === "running";
    var emailOn = (t.delivery || []).indexOf("email") >= 0;
    var next = !t.enabled ? "Paused" : t.next_run ? fmt(t.next_run, t.timezone, true) : "—";
    var result = t.last_status === "error" ? clip(t.last_error, 160) : t.last_result ? clip(t.last_result.replace(/[#*>`_]/g, ""), 160) : "No runs yet";
    return el("div", { cls: "tk-card st-row" + (t.enabled ? "" : " paused"), data: { id: t.id } }, [
      el("div", { cls: "st-main" }, [
        el("div", { cls: "tk-name", text: t.title }),
        el("div", { cls: "tk-q", text: clip(t.instruction, 140) }),
        el("div", { cls: "tk-meta", text: (emailOn ? "Thread + email" : "Thread") + " · " + (t.run_count || 0) + " run" + (t.run_count === 1 ? "" : "s") })
      ]),
      el("div", { cls: "st-col" }, [el("span", { cls: "st-k", text: "Schedule" }), el("span", { text: scheduleLabel(t) }), t.schedule !== "@once" ? el("span", { cls: "tk-meta st-tz", text: t.timezone }) : null]),
      el("div", { cls: "st-col" }, [el("span", { cls: "st-k", text: "Next run" }), el("span", { text: next })]),
      el("div", { cls: "st-col st-last" }, [el("span", { cls: "st-k", text: "Last result" }),
        el("div", { cls: "tk-row st-lastrow" }, [statusBadge(t), el("span", { cls: "tk-meta st-ago", text: t.last_run ? ago(t.last_run) : "" })]),
        el("span", { cls: "st-snip" + (t.last_status === "error" ? " err" : ""), text: result }),
        t.thread_id && t.last_status !== "running" ? el("button", { cls: "tk-btn st-open", type: "button", data: { act: "open-thread" }, text: "Open thread" }) : null]),
      el("div", { cls: "st-actions" }, [
        el("button", { cls: "tk-switch" + (t.enabled ? " on" : ""), type: "button", data: { act: "toggle" }, title: t.enabled ? "Enabled" : "Paused", "aria-label": (t.enabled ? "Pause " : "Enable ") + t.title, "aria-pressed": String(!!t.enabled) }),
        el("button", { cls: "tk-btn", type: "button", data: { act: "run-now" }, disabled: busy || running, text: running ? "Running…" : "Run now" }),
        el("button", { cls: "tk-btn", type: "button", data: { act: "edit" }, text: "Edit" }),
        el("button", { cls: "tk-btn danger", type: "button", data: { act: "delete" }, "aria-label": "Delete " + t.title, text: "Delete" })
      ])
    ]);
  }

  function render() {
    if (!alive()) return;
    var keepScroll = wrap.parentNode ? wrap.parentNode.scrollTop : 0;
    // preserve live typing while a poll re-renders
    if (S.form) readForm();
    wrap.textContent = "";
    var head = el("div", { cls: "tk-row" }, [
      el("span", { cls: "tk-grow tk-meta st-intro", text: "Scheduled tasks run an instruction on a schedule and post the answer to a thread (and optionally email you)." }),
      S.form ? null : el("button", { cls: "tk-btn primary", type: "button", data: { act: "new" }, text: "+ New task" })
    ]);
    wrap.appendChild(head);
    if (S.error) wrap.appendChild(el("div", { cls: "tk-err", role: "alert", text: S.error }));
    if (S.form) wrap.appendChild(formView());
    if (S.loading) wrap.appendChild(el("div", { cls: "tk-msg", text: "Loading tasks…" }));
    else if (S.setup) wrap.appendChild(el("div", { cls: "tk-msg", text: "Scheduled tasks aren't set up yet. The task service is still being deployed — please check back shortly." }));
    else if (!S.tasks.length && !S.form) wrap.appendChild(el("div", { cls: "tk-empty", text: "No scheduled tasks yet. Create one to get a daily brief, a weekly report, or a one-time reminder delivered automatically." }));
    else {
      if (S.tasks.length) wrap.appendChild(el("div", { cls: "st-list" }, S.tasks.map(taskRow)));
    }
    if (wrap.parentNode) wrap.parentNode.scrollTop = keepScroll;
  }

  // ---------- events ----------
  function fail(e) { S.error = e.message === "setup" ? "Service unavailable." : String(e.message || e); render(); }
  function onClick(ev) {
    var t = ev.target.closest("[data-act]"); if (!t || !alive() || !wrap.contains(t)) return;
    var act = t.dataset.act, card = t.closest("[data-id]"), id = card && card.dataset.id;
    var task = id && S.tasks.filter(function (x) { return x.id === id; })[0];
    if (act === "new") { S.form = blankForm(); S.preview = ""; S.previewErr = false; S.error = ""; render(); refreshPreview(); }
    else if (act === "form-cancel") { S.form = null; S.error = ""; render(); schedulePoll(); }
    else if (act === "edit" && task) { S.form = formFromTask(task); S.preview = ""; S.error = ""; render(); refreshPreview(); }
    else if (act === "form-save") saveForm();
    else if (act === "toggle" && task) {
      S.busy[id] = true;
      api({ action: "update", id: id, enabled: !task.enabled }).then(function (r) { if (r.task) Object.assign(task, r.task); S.error = ""; }).catch(function (e) { S.error = e.message; }).then(function () { delete S.busy[id]; render(); });
    }
    else if (act === "delete" && task) {
      if (!window.confirm('Delete scheduled task "' + task.title + '"? Its result thread is kept.')) return;
      api({ action: "delete", id: id }).then(function () { return load(); }).catch(fail);
    }
    else if (act === "run-now" && task) {
      S.busy[id] = true; task.last_status = "running"; render();
      api({ action: "run_now", id: id }).catch(function (e) { S.error = e.message; }).then(function () { delete S.busy[id]; return load(true); });
    }
    else if (act === "open-thread" && task) openThread(task.thread_id, task.title);
  }
  function onInput(ev) {
    if (!S.form || !ev.target.closest || !ev.target.closest("#stForm")) return;
    var k = ev.target.getAttribute("data-f"); if (!k) return;
    if (k === "freq") { readForm(); render(); refreshPreview(); return; }
    if (k === "title" || k === "instruction" || k === "query_template" || k === "email") { readForm(); return; }
    readForm(); schedulePreview();
  }
  function saveForm() {
    readForm();
    var f = S.form, body = scheduleBody(f);
    if (!f.title.trim() || !f.instruction.trim()) { S.error = "A title and an instruction are required."; return render(); }
    if (f.freq === "once" && !body.run_at) { S.error = "Pick a date and time for a one-time task."; return render(); }
    if (f.freq === "custom" && !body.schedule) { S.error = "Enter a cron expression."; return render(); }
    body.action = f.id ? "update" : "create"; if (f.id) body.id = f.id;
    body.title = f.title.trim(); body.instruction = f.instruction.trim(); body.query_template = (f.query_template || "").trim();
    S.error = "";
    api(body).then(function () { S.form = null; return load(); }).catch(function (e) { S.error = e.message; render(); });
  }

  // ---------- public ----------
  function mount(container, h) {
    ensureCss();
    host = h || null;
    wrap = el("div", { cls: "tk-wrap st-wrap" });
    container.textContent = "";
    container.appendChild(wrap);
    if (bound !== container) {
      container.addEventListener("click", onClick);
      container.addEventListener("input", onInput);
      container.addEventListener("change", onInput);
      bound = container;
    }
    S.loading = true; S.error = ""; S.form = null;
    render();
    load();
  }
  window.ScheduledTasks = { mount: mount, openThread: openThread, _test: { fromCron: fromCron, toCron: toCron, scheduleLabel: scheduleLabel } };

  // Deep link from the delivery email: /?task_thread=<uuid> opens the result thread once the session is ready.
  try {
    var m = /[?&]task_thread=([0-9a-f-]{36})\b/i.exec(location.search);
    if (m) window.addEventListener("load", function () {
      var tries = 0, iv = setInterval(function () {
        tries++;
        var client = (typeof sb !== "undefined") ? sb : window.sb;
        if (!client || tries > 40) return clearInterval(iv);
        client.auth.getSession().then(function (r) {
          if (r && r.data && r.data.session) { clearInterval(iv); openThread(m[1], "Scheduled task"); try { history.replaceState(null, "", location.pathname); } catch (e) {} }
        });
      }, 500);
    });
  } catch (e) {}
})();
