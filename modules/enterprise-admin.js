/* enterprise-admin.js — read-only Enterprise admin pane (parity §26e item 3 / 34e).
   Perplexity Enterprise surfaces member/seat counts and an org activity trail; this pane
   gives owners/admins read-only visibility: (1) member + seat usage from the team edge
   function (same source as Settings > Organization), (2) the 20 most recent fleet
   dispatches (id, instruction head, status, time) from the gateway REST API — RLS-scoped
   to what the signed-in user may see. NO member management, NO permission changes, NO
   writes. Pure helpers are exported for node:test. */
(function (root) {
  "use strict";

  var SB = "https://bnxermyboeigvwonfrzx.supabase.co";
  var TEAM_URL = SB + "/functions/v1/team";

  // ---------- pure helpers (unit-tested in enterprise-admin.test.js) ----------
  function anonKey() {
    return (root.__appGlobals && root.__appGlobals.SUPABASE_ANON) || "";
  }
  function authToken() {
    var client = typeof sb !== "undefined" ? sb : root.sb;
    if (!client || !client.auth) return Promise.resolve("");
    return client.auth.getSession().then(function (r) {
      return (r && r.data && r.data.session && r.data.session.access_token) || "";
    });
  }
  // dispatchRow(d) — normalized fleet_dispatch row: {id, head, status, at}
  function dispatchRow(d) {
    if (!d || typeof d !== "object") return null;
    return {
      id: String(d.id || ""),
      head: String(d.instruction || "").replace(/\s+/g, " ").trim().slice(0, 80),
      status: String(d.status || "unknown"),
      at: d.created_at || null
    };
  }
  // seatUsage(members, seatLimit) — {members, seats, usedPct} — usedPct null when no limit known
  function seatUsage(members, seatLimit) {
    var n = Array.isArray(members) ? members.length : 0;
    var lim = Number(seatLimit);
    var pct = Number.isFinite(lim) && lim > 0 ? Math.round((n / lim) * 100) : null;
    return { members: n, seats: Number.isFinite(lim) && lim > 0 ? lim : null, usedPct: pct };
  }
  function fmtAt(v) {
    if (!v) return "—";
    var n = typeof v === "number" ? v : Date.parse(String(v));
    if (!Number.isFinite(n)) return "—";
    return new Date(n).toLocaleString();
  }
  // isAdminRole(role) — owner/admin see the pane; anything else sees a lock note
  function isAdminRole(role) { return role === "owner" || role === "admin"; }
  function auditCsv(rows) {
    function cell(value) {
      var s = String(value == null ? "" : value);
      // Prevent formulas when untrusted audit fields are opened in a spreadsheet.
      if (/^\s*[=+\-@]|^[\t\r\n]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return ["action,detail,created_at"].concat(rows.map(function (row) {
      return [row.action, row.detail, row.created_at].map(cell).join(",");
    })).join("\r\n");
  }

  // ---------- pane ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function render() {
    var host = document.getElementById("enterprise-admin-pane");
    if (!host) return null;
    host.innerHTML = "";
    host.appendChild(el("h3", "stg-pane-title", "Enterprise"));
    host.appendChild(el("p", "stg-pane-sub", "Seats, members, and the organization activity trail — read-only."));
    var status = el("p", "stg-desc", "Checking your organization role…");
    status.setAttribute("role", "status");
    host.appendChild(status);
    authToken().then(function (tok) {
      if (!tok) { status.textContent = "Sign in to view organization stats."; return; }
      var ak = anonKey();
      var h = { "Content-Type": "application/json", Authorization: "Bearer " + tok };
      if (ak) h.apikey = ak;
      return fetch(TEAM_URL, { method: "POST", headers: h, body: JSON.stringify({ action: "whoami" }) })
        .then(function (r) { if (!r.ok) throw new Error("Role lookup failed"); return r.json(); })
        .then(function (account) {
          if (!isAdminRole(account && account.role)) {
            status.textContent = "Only organization owners and admins can view this pane.";
            return;
          }
          status.remove();
          renderAdmin(host, h, tok, ak);
        });
    }).catch(function () { status.textContent = "Organization access could not be verified. Reopen this pane to retry."; });
    return host;
  }

  function renderAdmin(host, h, tok, ak) {
    host.appendChild(el("div", "stg-group-label", "Members and billing"));
    var seatBox = el("div", "ent-seat-box");
    host.appendChild(seatBox);
    seatBox.appendChild(el("p", "stg-desc", "Loading member data…"));
    var teamButton = el("button", "stg-btn", "Open Team settings");
    teamButton.type = "button";
    teamButton.addEventListener("click", function () { root.SettingsUI.open("team"); });
    host.appendChild(teamButton);
    var billing = el("button", "stg-btn", "Open account billing");
    billing.type = "button";
    billing.addEventListener("click", function () { root.SettingsUI.open("billing"); });
    host.appendChild(billing);
    var trail = el("div");
    host.appendChild(el("div", "stg-group-label", "Recent org activity (fleet dispatches)"));
    host.appendChild(trail);

    // members + seats (team edge function — same source as Settings > Organization)
    fetch(TEAM_URL, { method: "POST", headers: h, body: JSON.stringify({ action: "members" }) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("team " + r.status)); })
      .then(function (d) {
        seatBox.innerHTML = "";
        if (!d || !Array.isArray(d.members)) throw new Error("Missing member data");
        var pending = d.members.filter(function (m) { return m && m.status === "invited"; }).length;
        seatBox.appendChild(el("div", "sec-device-name", d.members.length + " roster entries · " + pending + " pending invite" + (pending === 1 ? "" : "s")));
        var meta = el("div", "sec-device-meta");
        meta.textContent = "The team API does not report purchased seats. Account billing shows personal credit usage, not organization invoices.";
        seatBox.appendChild(meta);
      })
      .catch(function () {
        seatBox.innerHTML = "";
        seatBox.appendChild(el("p", "stg-empty-note", "Member data unavailable right now."));
      });

    // recent dispatches (REST, RLS-scoped)
    fetch(SB + "/rest/v1/fleet_dispatch?select=id,instruction,status,created_at&order=created_at.desc&limit=20", { headers: { Authorization: "Bearer " + tok, apikey: ak || "" } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("dispatches " + r.status)); })
      .then(function (rows) {
        trail.innerHTML = "";
        var list = (Array.isArray(rows) ? rows : []).map(dispatchRow).filter(Boolean);
        if (!list.length) {
          trail.appendChild(el("p", "stg-empty-note", "No recent dispatches visible to your account."));
          return;
        }
        list.forEach(function (d) {
          var row = el("div", "ent-dispatch-row");
          var t = el("div", "sec-device-text");
          var nm = el("div", "sec-device-name");
          nm.textContent = d.head || "(no instruction)";
          t.appendChild(nm);
          var meta = el("div", "sec-device-meta");
          meta.textContent = d.status + " · " + fmtAt(d.at) + " · " + d.id.slice(0, 8);
          t.appendChild(meta);
          row.appendChild(t);
          trail.appendChild(row);
        });
      })
      .catch(function () {
        trail.innerHTML = "";
        trail.appendChild(el("p", "stg-empty-note", "Dispatch trail unavailable right now."));
      });

    // v232: enterprise configuration surface (SSO / SCIM / audit export) — status cards
    host.appendChild(el("div", "stg-group-label", "Enterprise configuration"));
    var cfgBox = el("div");
    host.appendChild(cfgBox);
    [
      { n: "Single sign-on (SSO)", d: "Identity-provider configuration is not available from this pane. This deployment uses the existing account sign-in flow.", status: "Not configurable here" },
      { n: "SCIM directory sync", d: "Directory provisioning is not configurable here. Use Team settings to manage invitations and roles manually.", status: "Not configurable here" }
    ].forEach(function (c) {
      var row = el("div", "ent-dispatch-row");
      var t = el("div", "sec-device-text");
      var nm = el("div", "sec-device-name");
      nm.textContent = c.n;
      t.appendChild(nm);
      var meta = el("div", "sec-device-meta");
      meta.textContent = c.status + " · " + c.d;
      t.appendChild(meta);
      row.appendChild(t);
      cfgBox.appendChild(row);
    });

    // v230: security audit trail (audit_logs, RLS-scoped to the signed-in user)
    var auditBox = el("div");
    host.appendChild(el("div", "stg-group-label", "Security audit trail (your account actions)"));
    var exportButton = el("button", "stg-btn", "Download visible audit rows (CSV)");
    exportButton.type = "button";
    exportButton.hidden = true;
    host.appendChild(exportButton);
    host.appendChild(auditBox);
    fetch(SB + "/rest/v1/audit_logs?select=action,detail,created_at&order=created_at.desc&limit=20", { headers: { Authorization: "Bearer " + tok, apikey: ak || "" } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("audit " + r.status)); })
      .then(function (rows) {
        auditBox.innerHTML = "";
        if (!Array.isArray(rows) || !rows.length) {
          auditBox.appendChild(el("p", "stg-empty-note", "No account actions recorded yet."));
          return;
        }
        rows.forEach(function (a) {
          var row = el("div", "ent-dispatch-row");
          var t = el("div", "sec-device-text");
          var nm = el("div", "sec-device-name");
          nm.textContent = String(a.action || "event");
          t.appendChild(nm);
          var meta = el("div", "sec-device-meta");
          meta.textContent = String(a.detail || "") + " · " + fmtAt(a.created_at);
          t.appendChild(meta);
          row.appendChild(t);
          auditBox.appendChild(row);
        });
        exportButton.hidden = false;
        exportButton.addEventListener("click", function () {
          var url = URL.createObjectURL(new Blob([auditCsv(rows)], { type: "text/csv;charset=utf-8" }));
          var link = el("a");
          link.href = url;
          link.download = "account-audit.csv";
          host.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        });
      })
      .catch(function () {
        auditBox.innerHTML = "";
        auditBox.appendChild(el("p", "stg-empty-note", "Audit trail unavailable right now."));
      });
    return host;
  }

  root.EnterpriseAdminPane = { render: render, dispatchRow: dispatchRow, seatUsage: seatUsage, fmtAt: fmtAt, isAdminRole: isAdminRole, auditCsv: auditCsv };
  if (root.BUILD && root.BUILD.modules) root.BUILD.modules.push({ id: "enterprise-admin", init: function () {} });
})(typeof window !== "undefined" ? window : this);
