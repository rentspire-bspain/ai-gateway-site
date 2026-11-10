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
  var api = { buildOrgTree: buildOrgTree, countBy: countBy };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  var URL_ = "https://bnxermyboeigvwonfrzx.supabase.co/rest/v1/fleet_registry?select=id,kind,name,parent,project_ref,domain,description,status,schedule,owner,updated_at&order=name.asc&limit=1000";
  var ANON = "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb";
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
    }).catch(function (e) { st.error = e.message; }).then(function () { st.loading = false; render(); });
  }
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
  function card(r) {
    return '<div class="fl-card"><div class="fl-ct"><span class="fl-dot fl-s-' + esc(r.status) + '"></span><b>' + esc(r.name) + '</b></div><div class="fl-m">' +
      esc(r.status.replace("_", " ")) + (r.schedule ? " · " + esc(r.schedule) : "") + (r.domain ? " · " + esc(r.domain) : "") + (r.project_ref ? " · " + esc(r.project_ref.slice(0, 8)) : "") + "</div></div>";
  }
  function section(title, list) { return list.length ? '<h3 class="fl-h">' + esc(title) + " (" + list.length + ')</h3><div class="fl-grid">' + list.map(card).join("") + "</div>" : ""; }
  function render() {
    if (!el) return;
    var body = el.querySelector(".fl-body");
    if (st.loading) { body.innerHTML = '<p class="fl-msg">Loading fleet registry…</p>'; return; }
    if (st.error) { body.innerHTML = '<p class="fl-msg">' + esc(st.error) + "</p>"; return; }
    var by = function (k) { return rows.filter(function (r) { return r.kind === k; }); };
    var autos = by("automation"), live = autos.filter(function (r) { return r.status === "live"; }), paused = autos.filter(function (r) { return r.status === "paused"; });
    body.innerHTML = '<div class="fl-wrap"><h3 class="fl-h">Org chart</h3>' + treeHtml(buildOrgTree(rows), true) +
      section("Guardians (per-project specs)", by("guardian")) + section("Live automations", live) +
      '<h3 class="fl-h">Paused automations (' + paused.length + ') <button class="fl-tg" type="button">' + (st.showPaused ? "Hide" : "Show") + "</button></h3>" +
      (st.showPaused ? '<div class="fl-grid">' + paused.map(card).join("") + "</div>" : "") +
      section("Build lanes", by("build_lane")) + section("Runtime agents", by("runtime_agent")) + "</div>";
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  function open() {
    if (el) return;
    if (!document.querySelector('link[href*="fleet.css"]')) { var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/modules/fleet.css"; document.head.appendChild(l); }
    el = document.createElement("div"); el.className = "fl-root"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Fleet");
    el.innerHTML = '<div class="fl-head"><div class="fl-grow"><h2>Fleet</h2><div class="fl-sub">Agents, guardians and org chart</div></div><button class="fl-x" aria-label="Close">×</button></div><div class="fl-body"></div>';
    (document.getElementById("moduleRoot") || document.body).appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target.classList.contains("fl-x")) close();
      if (e.target.classList.contains("fl-tg")) { st.showPaused = !st.showPaused; render(); }
    });
    document.addEventListener("keydown", onKey);
    st.loading = true; render(); load();
  }
  function close() { if (!el) return; document.removeEventListener("keydown", onKey); el.remove(); el = null; }
  root.FleetUI = { open: open, close: close };
})(typeof window !== "undefined" ? window : globalThis);
