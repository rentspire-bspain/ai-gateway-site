/* teammates.js — read-only Teammates shared view (parity §26e item 2 / 34c).
   Every top agentic product shows who is on the team and what they can see; this pane
   renders the members list read-only (name, email, role, last active) for ALL members,
   not just owner/admin (settings-org's management pane stays admin-gated). Data comes
   from the same team edge function the Settings > Organization pane uses (action:
   members), read through the signed-in user's session token — RLS applies server-side.
   Pure helpers are exported for node:test. */
(function (root) {
  "use strict";

  var SB = "https://bnxermyboeigvwonfrzx.supabase.co";
  var TEAM_URL = SB + "/functions/v1/team";

  // ---------- pure helpers (unit-tested in teammates.test.js) ----------
  function anonKey() {
    try { var c = JSON.parse(localStorage.getItem("sb-credential") || "{}"); return (c && c.supabaseKey) || ""; } catch (_e) { return ""; }
  }
  function authToken() {
    try { var c = JSON.parse(localStorage.getItem("sb-credential") || "{}"); return (c && c.token) || ""; } catch (_e) { return ""; }
  }
  // memberRow(m) — one normalized member: {name, email, role, lastActive, invited}
  function memberRow(m) {
    if (!m || typeof m !== "object") return null;
    return {
      name: String(m.name || m.full_name || "").trim() || String(m.email || "").split("@")[0],
      email: String(m.email || ""),
      role: String(m.role || "member"),
      lastActive: m.last_active || m.last_seen || null,
      invited: String(m.status || "") === "invited"
    };
  }
  function sortMembers(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map(memberRow)
      .filter(Boolean)
      .sort(function (a, b) { return a.email.localeCompare(b.email); });
  }
  function fmtLastActive(v) {
    if (!v) return "—";
    var n = typeof v === "number" ? v : Date.parse(String(v));
    if (!Number.isFinite(n)) return "—";
    return new Date(n).toLocaleDateString();
  }

  // ---------- pane ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function render() {
    var host = document.getElementById("teammates-pane");
    if (!host) return null;
    host.innerHTML = "";
    host.appendChild(el("h3", "stg-pane-title", "Teammates"));
    host.appendChild(el("p", "stg-pane-sub", "Everyone with access to this workspace (read-only — roles are managed in Settings > Organization)."));
    var status = el("p", "stg-desc", "Loading…");
    host.appendChild(status);
    var tok = authToken(), ak = anonKey();
    if (!tok) { status.textContent = "Sign in to see your teammates."; return host; }
    var h = { "Content-Type": "application/json", Authorization: "Bearer " + tok };
    if (ak) h.apikey = ak;
    fetch(TEAM_URL, { method: "POST", headers: h, body: JSON.stringify({ action: "members" }) })
      .then(function (r) { if (!r.ok) throw new Error("team " + r.status); return r.json(); })
      .then(function (d) {
        var rows = sortMembers(d && d.members);
        status.textContent = "";
        if (!rows.length) {
          host.appendChild(el("p", "stg-empty-note", "No teammates yet — invites are managed in Settings > Organization."));
          return;
        }
        var wrap = el("div", "teammates-list");
        rows.forEach(function (m) {
          var row = el("div", "org-member-row");
          var txt = el("div", "sec-device-text");
          var nm = el("div", "sec-device-name");
          nm.textContent = m.name + (m.invited ? " (invited)" : "");
          txt.appendChild(nm);
          var meta = el("div", "sec-device-meta");
          meta.textContent = m.email + " · " + m.role + " · last active " + fmtLastActive(m.lastActive);
          txt.appendChild(meta);
          row.appendChild(txt);
          wrap.appendChild(row);
        });
        host.appendChild(wrap);
      })
      .catch(function (e) {
        status.textContent = "Teammates unavailable right now — " + (e && e.message ? e.message : "try again shortly.");
      });
    return host;
  }

  root.TeammatesPane = { render: render, memberRow: memberRow, sortMembers: sortMembers, fmtLastActive: fmtLastActive };
  if (root.BUILD && root.BUILD.modules) root.BUILD.modules.push({ id: "teammates", init: function () {} });
})(typeof window !== "undefined" ? window : this);
