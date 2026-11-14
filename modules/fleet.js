(function (root) {
  "use strict";
  // Pure: rows -> forest keyed by parent edges. Cycles / missing parents become roots; children sorted by kind then name.
  function buildOrgTree(rows) {
    var byId = {}, roots = [];
    (rows || []).forEach(function (r) { byId[r.id] = { row: r, children: [] }; });
    Object.keys(byId).forEach(function (id) {
      var n = byId[id], p = n.row.parent && byId[n.row.parent];
      var cyc = false, c = p, hops = 0;
      while (c && hops++ < 50) { if (c.row.id === id) { cyc = true; break; } c = c.row.parent && byId[c.row.parent]; }
      if (p && !cyc) p.children.push(n); else roots.push(n);
    });
    function cmp(a, b) { return (a.row.kind + a.row.name).localeCompare(b.row.kind + b.row.name); }
    (function sort(list) { list.sort(cmp); list.forEach(function (n) { sort(n.children); }); })(roots);
    return roots;
  }
  function countBy(rows, key) { var o = {}; (rows || []).forEach(function (r) { o[r[key]] = (o[r[key]] || 0) + 1; }); return o; }
  // Lifecycle trail for a site_changes row: [{key,label,state:"done"|"active"|"todo"|"bad"}]
  var TRAIL = [["queued", "Queued"], ["planning", "Planning"], ["editing", "Editing"], ["testing", "Testing"], ["pr_opened", "PR opened"], ["gating", "Gate result"], ["merged", "Merged / deployed"]];
  function changeTrail(row) {
    var st = row && row.status, idx = TRAIL.map(function (t) { return t[0]; }).indexOf(st === "needs_review" ? "gating" : st);
    var dead = st === "failed" || st === "refused" || st === "cancelled";
    var reached = dead ? Math.max(0, TRAIL.map(function (t) { return t[0]; }).indexOf((row.events || []).length ? (row.events[row.events.length - 2] || row.events[0]).state : "queued")) : idx;
    return TRAIL.map(function (t, i) {
      var s = i < reached ? "done" : i === reached ? (dead ? "bad" : (st === "merged" || st === "needs_review") ? "done" : "active") : "todo";
      return { key: t[0], label: st === "needs_review" && t[0] === "merged" ? "Needs your review" : t[1], state: s };
    });
  }
  var api = { buildOrgTree: buildOrgTree, countBy: countBy, changeTrail: changeTrail };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  var URL_ = "https://bnxermyboeigvwonfrzx.supabase.co/rest/v1/fleet_registry?select=id,kind,name,parent,project_ref,domain,description,status,schedule,owner,updated_at&order=name.asc&limit=1000";
  var ANON = "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb";
  var DISP_URL = "https://bnxermyboeigvwonfrzx.supabase.co/rest/v1/fleet_dispatch?select=id,thread_id,instruction,priority,status,result,error,claimed_at,claimed_by,created_at,finished_at&order=created_at.desc&limit=30";
  var disp = [];
  var GURL = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/guardian-runner";
  var guards = [], gst = { loaded: false, error: "", busy: {} }, tab = "overview";
  var el = null, rows = [], st = { loading: true, error: "", showPaused: false };
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function load() {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in to view the fleet.");
      return fetch(URL_, { headers: { Authorization: "Bearer " + tok, apikey: ANON } });
    }).then(function (res) {
      if (res.status === 404) throw new Error("The fleet registry is not set up yet.");
      return res.json().then(function (j) { if (!res.ok || !Array.isArray(j)) throw new Error((j && j.message) || "Request failed (" + res.status + ")"); rows = j; st.error = ""; });
    }).catch(function (e) { st.error = e.message; }).then(loadDisp).then(function () { st.loading = false; render(); });
  }
  // "Dispatched work": the user's fleet_dispatch rows (RLS-scoped); failures are non-fatal (table may not exist yet)
  function loadDisp() {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) return;
      return fetch(DISP_URL, { headers: { Authorization: "Bearer " + tok, apikey: ANON } }).then(function (res) { return res.json(); }).then(function (j) { disp = Array.isArray(j) ? j : []; });
    }).catch(function () { disp = []; });
  }
  function fmt(t) { return t ? new Date(t).toLocaleString() : ""; }
  function dispHtml() {
    if (!disp.length) return "";
    return '<h3 class="fl-h">Dispatched work (' + disp.length + ') <button class="fl-rf" type="button">Refresh</button></h3><div class="fl-grid">' + disp.map(function (d) {
      var out = d.error ? "Error: " + d.error : d.result;
      var tl = ["Queued · " + fmt(d.created_at)];
      if (d.claimed_at) tl.push("Claimed" + (d.claimed_by ? " by " + d.claimed_by : "") + " · " + fmt(d.claimed_at));
      if (d.finished_at) tl.push((d.status === "error" ? "Failed" : "Done") + " · " + fmt(d.finished_at));
      return '<div class="fl-card"><div class="fl-ct"><span class="fl-dot fl-s-' + (d.status === "done" ? "live" : d.status === "error" ? "paused" : "on_demand") + '"></span><b>' + esc(d.status) + "</b> · #" + esc(String(d.id).slice(0, 8)) + (d.priority === "high" ? " · high" : "") + '</div><div class="fl-m">' + esc(String(d.instruction).slice(0, 160)) + "</div>" +
        '<ol class="fl-m" style="margin:6px 0 0 16px;padding:0">' + tl.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" +
        (out ? "<details><summary>Result</summary><pre style=\"white-space:pre-wrap\">" + esc(String(out).slice(0, 8000)) + "</pre></details>" : "") + "</div>";
    }).join("") + "</div>";
  }
  // live ledger: poll every 8s while the Fleet page is open and any dispatch is still in flight
  var pollT = null;
  function poll() { if (!el) return; var busy = disp.some(function (d) { return d.status === "queued" || d.status === "running"; }); (busy ? loadDisp().then(render) : Promise.resolve()).then(function () { pollT = setTimeout(poll, 8000); }); }
  // ---- Guardians tab: native guardian-runner edge function (list / update / run_now) ----
  function gcall(body) {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in.");
      return fetch(GURL, { method: "POST", headers: { Authorization: "Bearer " + tok, apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }).then(function (res) { return res.json().then(function (j) { if (!res.ok) throw new Error((j && j.error) || "Request failed (" + res.status + ")"); return j; }); });
  }
  function loadGuards() {
    return gcall({ action: "list" }).then(function (j) { guards = j.guardians || []; gst.error = ""; })
      .catch(function (e) { gst.error = e.message; }).then(function () { gst.loaded = true; render(); });
  }
  function gcard(g) {
    var s = gst.busy[g.id] ? "running" : (g.last_status || "never");
    return '<div class="fl-card" data-gid="' + esc(g.id) + '"><div class="fl-ct"><span class="fl-dot fl-s-' + (s === "ok" ? "live" : s === "fail" || s === "error" ? "paused" : "on_demand") + '"></span><b>' + esc(g.name) + '</b></div>' +
      '<div class="fl-m">' + esc(g.schedule_label || g.schedule) + " · " + esc(s) + (g.last_run ? " · " + esc(fmt(g.last_run)) : "") + '</div>' +
      (g.last_result ? '<div class="fl-m" style="white-space:pre-wrap;max-height:84px;overflow:auto;margin-top:6px">' + esc(g.last_result.split("\n").slice(0, 4).join("\n")) + "</div>" : "") +
      '<div class="fl-m" style="margin-top:8px"><label><input type="checkbox" class="fl-gen"' + (g.enabled ? " checked" : "") + '> Enabled</label> ' +
      '<button class="fl-grun" type="button"' + (gst.busy[g.id] ? " disabled" : "") + '>' + (gst.busy[g.id] ? "Running…" : "Run now") + "</button></div></div>";
  }
  function guardHtml() {
    if (!gst.loaded) return '<p class="fl-msg">Loading guardians…</p>';
    if (gst.error) return '<p class="fl-msg">' + esc(gst.error) + ' <button class="fl-grf" type="button">Retry</button></p>';
    return '<h3 class="fl-h">Guardians (' + guards.length + ') <button class="fl-grf" type="button">Refresh</button></h3><div class="fl-grid">' + guards.map(gcard).join("") + "</div>";
  }
  function gAct(id, body) {
    var g = guards.filter(function (x) { return x.id === id; })[0]; if (!g) return;
    gst.busy[id] = true; render();
    gcall(body).then(function (j) { var n = j.guardian; if (n) guards = guards.map(function (x) { return x.id === id ? n : x; }); })
      .catch(function (e) { alert(e.message); }).then(function () { delete gst.busy[id]; render(); });
  }
  // ---- Build tab: owner self-update via the site-change edge function ([OPS FLEET]) ----
  var SCURL = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/site-change";
  var bld = { loaded: false, rows: [], error: "", busy: false, msg: "", draft: "", att: "" }, bldT = null;
  function scall(body) {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token; if (!tok) throw new Error("Please sign in.");
      return fetch(SCURL, { method: "POST", headers: { Authorization: "Bearer " + tok, apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }).then(function (res) { return res.json().then(function (j) { if (!res.ok) throw new Error((j && j.error) || "Request failed (" + res.status + ")"); return j; }); });
  }
  var ACTIVE = { queued: 1, planning: 1, editing: 1, testing: 1, pr_opened: 1, gating: 1 };
  function loadBuild() {
    return scall({ action: "list" }).then(function (j) { bld.rows = j.changes || []; bld.error = ""; }).catch(function (e) { bld.error = e.message; })
      .then(function () { bld.loaded = true; if (tab === "build" && el) renderBuildKeep(); scheduleBuild(); });
  }
  // keep the textbox contents while the list refreshes
  function renderBuildKeep() { var t = el.querySelector(".fl-bd"); if (t) bld.draft = t.value; render(); }
  function scheduleBuild() {
    clearTimeout(bldT); if (!el || tab !== "build") return;
    var act = bld.rows.filter(function (r) { return ACTIVE[r.status]; })[0]; if (!act) return;
    bldT = setTimeout(function () { scall({ action: "step", id: act.id }).catch(function () {}).then(loadBuild); }, bld.rows.length && act.status === "gating" ? 10000 : 500);
  }
  function trailHtml(r) {
    return '<ol class="fl-m" style="margin:6px 0 0 16px;padding:0">' + changeTrail(r).map(function (t) {
      return '<li style="' + (t.state === "active" ? "font-weight:700" : t.state === "todo" ? "opacity:.5" : t.state === "bad" ? "color:#c0392b" : "") + '">' + esc(t.label) + (t.state === "done" ? " ✓" : t.state === "active" ? " …" : t.state === "bad" ? " ✗" : "") + "</li>";
    }).join("") + "</ol>";
  }
  function buildCard(r) {
    var gates = (r.gates || []).map(function (g) { return "<li>" + esc(g.name) + ": <b>" + esc(g.status) + "</b>" + (g.detail ? " — " + esc(g.detail) : "") + "</li>"; }).join("");
    return '<div class="fl-card" data-cid="' + esc(r.id) + '"><div class="fl-ct"><span class="ops-fleet-pill">OPS FLEET</span> <b>' + esc(r.title || String(r.description).slice(0, 60)) + "</b> · " + esc(r.status.replace("_", " ")) + "</div>" +
      '<div class="fl-m">' + esc(String(r.description).slice(0, 300)) + "</div>" + trailHtml(r) +
      (r.pr_url ? '<div class="fl-m" style="margin-top:6px"><a href="' + esc(r.pr_url) + '" target="_blank" rel="noopener noreferrer">PR #' + esc(r.pr_number) + "</a>" + (r.build ? " · build " + esc(r.build) : "") + (r.preview_url ? ' · <a href="' + esc(r.preview_url) + '" target="_blank" rel="noopener noreferrer">preview</a>' : "") + "</div>" : "") +
      (gates ? '<details><summary>Pre-launch gate result</summary><ul style="margin:6px 0 0 16px;padding:0">' + gates + "</ul></details>" : "") +
      ((r.review_reasons || []).length ? '<div class="fl-m" style="margin-top:6px"><b>Needs your review:</b> ' + esc(r.review_reasons.join("; ")) + "</div>" : "") +
      (r.error ? '<div class="fl-m" style="margin-top:6px">' + esc(r.error) + "</div>" : "") +
      (ACTIVE[r.status] ? '<div class="fl-m" style="margin-top:6px"><button type="button" class="fl-bcancel">Cancel</button></div>' : "") + "</div>";
  }
  function buildHtml() {
    var form = '<div class="fl-card"><div class="fl-ct"><b>Change this site</b></div><div class="fl-m">Describe the change. It is planned by an open-weight model, opened as a pull request, checked, and merged only if every runnable gate passes (owner only, 10 requests/day).</div>' +
      '<textarea class="fl-bd" rows="4" maxlength="2000" style="width:100%;margin-top:8px" aria-label="Describe the change" placeholder="Describe the change…">' + esc(bld.draft) + "</textarea>" +
      '<div class="fl-m" style="margin-top:6px"><label>Screenshot (optional) <input type="file" class="fl-bf" accept="image/png,image/jpeg,image/webp"></label>' + (bld.att ? " attached ✓" : "") + "</div>" +
      '<div class="fl-m" style="margin-top:8px"><button type="button" class="fl-bsub"' + (bld.busy ? " disabled" : "") + ">" + (bld.busy ? "Submitting…" : "Submit change request") + "</button> " + (bld.msg ? esc(bld.msg) : "") + "</div></div>";
    if (!bld.loaded) return form + '<p class="fl-msg">Loading requests…</p>';
    return form + (bld.error ? '<p class="fl-msg">' + esc(bld.error) + "</p>" : "") + '<h3 class="fl-h">Requests (' + bld.rows.length + ') <button class="fl-brf" type="button">Refresh</button></h3><div class="fl-grid">' + bld.rows.map(buildCard).join("") + "</div>";
  }
  function submitBuild() {
    var t = el.querySelector(".fl-bd"); bld.draft = t ? t.value : bld.draft;
    if (bld.draft.trim().length < 5) { bld.msg = "Describe the change first."; render(); return; }
    bld.busy = true; bld.msg = ""; render();
    scall({ action: "submit", description: bld.draft.trim(), attachment: bld.att || undefined }).then(function () { bld.draft = ""; bld.att = ""; bld.msg = "Queued."; })
      .catch(function (e) { bld.msg = e.message; }).then(function () { bld.busy = false; return loadBuild(); });
  }
  // ---- QA tab: the pre-launch regression fleet's latest report (qa-reports/prelaunch/latest.json, deployed with the site) ----
  var qa = { loaded: false, rec: null, error: "" };
  function loadQa() {
    return fetch("/qa-reports/prelaunch/latest.json", { cache: "no-store" }).then(function (r) { return r.json(); })
      .then(function (j) { qa.rec = j; qa.error = ""; }).catch(function (e) { qa.error = "No QA report found — run ./qa/run.sh and deploy."; })
      .then(function () { qa.loaded = true; render(); });
  }
  function qaHtml() {
    if (!qa.loaded) return '<p class="fl-msg">Loading pre-launch QA report…</p>';
    if (qa.error && !qa.rec) return '<p class="fl-msg">' + esc(qa.error) + '</p>';
    var r = qa.rec, red = (r.failed || 0) > 0, checks = r.checks || [], fails = checks.filter(function (c) { return !c.ok; });
    return '<h3 class="fl-h">Pre-launch regression fleet <button class="fl-qrf" type="button">Refresh</button></h3>' +
      '<div class="fl-card"><div class="fl-ct"><span class="fl-dot fl-s-' + (red ? "paused" : "live") + '"></span><b>' +
      (red ? r.failed + " FAILED" : "ALL GREEN") + "</b> · " + r.passed + "/" + (r.passed + r.failed) + " checks · " + esc(fmt(r.ts)) + "</div>" +
      '<div class="fl-m">Run before every push and after every deploy: <code>./qa/run.sh</code> — backend smoke, deploy integrity (live modules must match the repo), frontend E2E (composer, threads, follow-ups, doc panel, Fleet, Connectors), CSP and JS errors. ' + (r.base ? "Last run: " + esc(r.base) : "") + "</div>" +
      (fails.length ? '<div class="fl-m" style="margin-top:8px"><b>Regressions — fix before launch:</b><ol style="margin:6px 0 0 16px;padding:0">' +
        fails.map(function (c) { return "<li><b>" + esc(c.name) + "</b>" + (c.detail ? " — " + esc(c.detail) : "") + "</li>"; }).join("") + "</ol></div>" : "") +
      '<details style="margin-top:8px"><summary>' + (checks.length - fails.length) + " passing checks</summary><ol style=\"margin:6px 0 0 16px;padding:0\">" +
      checks.filter(function (c) { return c.ok; }).map(function (c) { return "<li>" + esc(c.name) + "</li>"; }).join("") + "</ol></details></div>";
  }
  function card(r) {
    return '<div class="fl-card"><div class="fl-ct"><span class="fl-dot fl-s-' + esc(r.status) + '"></span><b>' + esc(r.name) + '</b></div><div class="fl-m">' +
      esc(r.status.replace("_", " ")) + (r.schedule ? " · " + esc(r.schedule) : "") + (r.domain ? " · " + esc(r.domain) : "") + (r.project_ref ? " · " + esc(r.project_ref.slice(0, 8)) : "") + "</div></div>";
  }
  // v155 FIX: restored — treeHtml was dropped from fleet.js in 7e7e678, so render() threw a
  // ReferenceError and the Overview tab stayed stuck on "Loading fleet registry…" for everyone.
  function treeHtml(nodes, top) {
    return '<ul class="fl-tree' + (top ? " fl-top" : "") + '">' + nodes.map(function (n) {
      var r = n.row, leaf = r.kind !== "org", inner = "";
      if (!leaf) {
        var kids = n.children, kinds = countBy(kids.map(function (k) { return k.row; }), "kind");
        inner = treeHtml(n.children.filter(function (k) { return k.row.kind === "org"; }), false) +
          '<div class="fl-sum">' + Object.keys(kinds).filter(function (k) { return k !== "org"; }).map(function (k) { return esc(kinds[k] + " " + k.replace("_", " ") + "s"); }).join(" · ") + "</div>";
      }
      return '<li><div class="fl-node fl-k-' + esc(r.kind) + '"><b>' + esc(r.name) + "</b>" + (r.description && !leaf ? '<span class="fl-d">' + esc(r.description) + "</span>" : "") + "</div>" + inner + "</li>";
    }).join("") + "</ul>";
  }

  function mountAutomations(host) {
    if (!host) return;
    if (root.AutomationsUI && typeof root.AutomationsUI.mount === "function") {
      root.AutomationsUI.mount(host, { hideHeading: true });
      return;
    }
    host.innerHTML = '<p class="fl-msg">Loading automations…</p>';
    var s = document.createElement("script");
    s.src = "/modules/automations.js";
    s.onload = function () {
      if (root.AutomationsUI && typeof root.AutomationsUI.mount === "function") {
        root.AutomationsUI.mount(host, { hideHeading: true });
      }
    };
    s.onerror = function () { host.innerHTML = '<p class="fl-msg">Could not load Automations module.</p>'; };
    document.head.appendChild(s);
  }
  function section(title, list) { return list.length ? '<h3 class="fl-h">' + esc(title) + " (" + list.length + ')</h3><div class="fl-grid">' + list.map(card).join("") + "</div>" : ""; }
  function render() {
    if (!el) return;
    var body = el.querySelector(".fl-body");
    var tabs = '<div class="fl-tabs" style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px"><button type="button" class="fl-tab" data-tab="overview"' + (tab === "overview" ? ' aria-pressed="true" style="font-weight:700"' : "") + '>Overview</button><button type="button" class="fl-tab" data-tab="automations"' + (tab === "automations" ? ' aria-pressed="true" style="font-weight:700"' : "") + '>Automations</button><button type="button" class="fl-tab" data-tab="guardians"' + (tab === "guardians" ? ' aria-pressed="true" style="font-weight:700"' : "") + '>Guardians</button><button type="button" class="fl-tab" data-tab="qa"' + (tab === "qa" ? ' aria-pressed="true" style="font-weight:700"' : "") + '>QA</button><button type="button" class="fl-tab" data-tab="build"' + (tab === "build" ? ' aria-pressed="true" style="font-weight:700"' : "") + '>Build</button></div>';
    if (tab === "automations") {
      if (!body.querySelector(".fl-auto-host")) {
        body.innerHTML = '<div class="fl-wrap">' + tabs + '<div class="fl-auto-host"></div></div>';
        mountAutomations(body.querySelector(".fl-auto-host"));
      }
      return;
    }
    if (tab === "guardians") { body.innerHTML = '<div class="fl-wrap">' + tabs + guardHtml() + "</div>"; return; }
    if (tab === "build") { body.innerHTML = '<div class="fl-wrap">' + tabs + buildHtml() + "</div>"; return; }
    if (tab === "qa") { body.innerHTML = '<div class="fl-wrap">' + tabs + qaHtml() + "</div>"; return; }
    if (st.loading) { body.innerHTML = '<p class="fl-msg">Loading fleet registry…</p>'; return; }
    if (st.error) { body.innerHTML = '<p class="fl-msg">' + esc(st.error) + "</p>"; return; }
    var by = function (k) { return rows.filter(function (r) { return r.kind === k; }); };
    var autos = by("automation"), live = autos.filter(function (r) { return r.status === "live"; }), paused = autos.filter(function (r) { return r.status === "paused"; });
    body.innerHTML = '<div class="fl-wrap">' + tabs + '<h3 class="fl-h">Org chart</h3>' + treeHtml(buildOrgTree(rows), true) +
      section("Guardians (per-project specs)", by("guardian")) + section("Live automations", live) +
      '<h3 class="fl-h">Paused automations (' + paused.length + ') <button class="fl-tg" type="button">' + (st.showPaused ? "Hide" : "Show") + "</button></h3>" +
      (st.showPaused ? '<div class="fl-grid">' + paused.map(card).join("") + "</div>" : "") +
      dispHtml() + section("Build lanes", by("build_lane")) + section("Runtime agents", by("runtime_agent")) + "</div>";
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  function open(initialTab) {
    if (typeof initialTab === "string" && initialTab) tab = initialTab;
    if (el) { render(); return; }
    if (!document.querySelector('link[href*="fleet.css"]')) { var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/modules/fleet.css"; document.head.appendChild(l); }
    el = document.createElement("div"); el.className = "fl-root"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Fleet");
    el.innerHTML = '<div class="fl-head"><div class="fl-grow"><h2>Fleet</h2><div class="fl-sub">Agents, guardians and org chart</div></div><button class="fl-x" aria-label="Close">×</button></div><div class="fl-body"></div>';
    (document.getElementById("moduleRoot") || document.body).appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target.classList.contains("fl-x")) close();
      var t = e.target, gc = t.closest && t.closest("[data-gid]");
      if (t.classList.contains("fl-tab")) { tab = t.getAttribute("data-tab"); render(); if (tab === "guardians" && !gst.loaded) loadGuards(); if (tab === "qa" && !qa.loaded) loadQa(); if (tab === "build") loadBuild(); return; }
      if (t.classList.contains("fl-bsub")) { submitBuild(); return; }
      if (t.classList.contains("fl-brf")) { loadBuild(); return; }
      if (t.classList.contains("fl-bcancel")) { var bc = t.closest("[data-cid]"); if (bc) scall({ action: "cancel", id: bc.getAttribute("data-cid") }).catch(function (x) { alert(x.message); }).then(loadBuild); return; }
      if (t.classList.contains("fl-grf")) { gst.loaded = false; render(); loadGuards(); return; }
      if (t.classList.contains("fl-qrf")) { qa.loaded = false; render(); loadQa(); return; }
      if (t.classList.contains("fl-grun") && gc) { gAct(gc.getAttribute("data-gid"), { action: "run_now", id: gc.getAttribute("data-gid") }); return; }
      if (t.classList.contains("fl-gen") && gc) { gAct(gc.getAttribute("data-gid"), { action: "update", id: gc.getAttribute("data-gid"), enabled: t.checked }); return; }
      if (e.target.classList.contains("fl-rf")) loadDisp().then(render);
      if (e.target.classList.contains("fl-tg")) { st.showPaused = !st.showPaused; render(); }
    });
    el.addEventListener("change", function (e) {
      if (!e.target.classList.contains("fl-bf")) return;
      var f = e.target.files && e.target.files[0]; if (!f || f.size > 1000000) { bld.msg = "Screenshot must be under 1 MB."; render(); return; }
      var fr = new FileReader(); fr.onload = function () { bld.att = String(fr.result); var t = el.querySelector(".fl-bd"); if (t) bld.draft = t.value; render(); }; fr.readAsDataURL(f);
    });
    document.addEventListener("keydown", onKey);
    if (window.__fleetBuildDraft != null) { bld.draft = window.__fleetBuildDraft; window.__fleetBuildDraft = null; tab = "build"; loadBuild(); }
    st.loading = true; render(); load().then(function () { pollT = setTimeout(poll, 8000); });
  }
  function close() { if (!el) return; clearTimeout(bldT); tab = "overview"; clearTimeout(pollT); document.removeEventListener("keydown", onKey); el.remove(); el = null; }
  root.FleetUI = { open: open, close: close };
})(typeof window !== "undefined" ? window : globalThis);
