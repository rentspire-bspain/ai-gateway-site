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
    try { var c = JSON.parse(localStorage.getItem("sb-credential") || "{}"); return (c && c.supabaseKey) || ""; } catch (_e) { return ""; }
  }
  function authToken() {
    try { var c = JSON.parse(localStorage.getItem("sb-credential") || "{}"); return (c && c.token) || ""; } catch (_e) { return ""; }
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
    var tok = authToken(), ak = anonKey();
    if (!tok) { host.appendChild(el("p", "stg-desc", "Sign in to view organization stats.")); return host; }
    var h = { "Content-Type": "application/json", Authorization: "Bearer " + tok };
    if (ak) h.apikey = ak;

    var seatBox = el("div", "ent-seat-box");
    host.appendChild(seatBox);
    var trail = el("div");
    host.appendChild(el("div", "stg-group-label", "Recent org activity (fleet dispatches)"));
    host.appendChild(trail);

    // members + seats (team edge function — same source as Settings > Organization)
    fetch(TEAM_URL, { method: "POST", headers: h, body: JSON.stringify({ action: "members" }) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("team " + r.status)); })
      .then(function (d) {
        seatBox.innerHTML = "";
        var u = seatUsage(d && d.members);
        seatBox.appendChild(el("div", "sec-device-name", u.members + " member" + (u.members === 1 ? "" : "s") + (u.seats ? " of " + u.seats + " seats" : "")));
        var meta = el("div", "sec-device-meta");
        meta.textContent = u.usedPct != null ? u.usedPct + "% of seats in use" : "Seat limit not configured";
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
    return host;
  }

  root.EnterpriseAdminPane = { render: render, dispatchRow: dispatchRow, seatUsage: seatUsage, fmtAt: fmtAt, isAdminRole: isAdminRole };
  if (root.BUILD && root.BUILD.modules) root.BUILD.modules.push({ id: "enterprise-admin", init: function () {} });
})(typeof window !== "undefined" ? window : this);
