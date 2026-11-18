/* settings-teammates-premium.js — v231: Teammates management (real invite/role actions)
   + Premium feature surface. Registers two panes into SettingsUI. */
(function () {
  "use strict";
  var TEAM_URL = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/team";
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/[&<>]/g, function (c) { return "&" + ({ "&": "amp", "<": "lt", ">": "gt" })[c] + ";"; });
  }
  function authToken() {
    // v231: use the live Supabase session (the legacy sb-credential key is often absent)
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    if (!client || !client.auth) return Promise.resolve("");
    return client.auth.getSession().then(function (r) {
      return (r && r.data && r.data.session && r.data.session.access_token) || "";
    });
  }
  function anonKey() {
    try { var g = window.__appGlobals || {}; return g.SUPABASE_ANON || ""; } catch (e) { return ""; }
  }
  function team(action, extra) {
    var body = Object.assign({ action: action }, extra || {});
    return authToken().then(function (tok) {
    return fetch(TEAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok, apikey: anonKey() },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(String(j.error || ("HTTP " + r.status)).slice(0, 180));
        return j;
      });
    });
    });
  }
  function btn(label, kind) { return el("button", "stg-btn" + (kind ? " stg-btn-" + kind : ""), label); }
  function input(placeholder, type) {
    var i = el("input", "stg-input");
    i.type = type || "text"; i.placeholder = placeholder; i.autocomplete = "off";
    return i;
  }

  // ---------- Teammates pane (management, owner/admin gated server-side) ----------
  function buildTeammates() {
    var pane = el("div", "stg-pane");
    // mount into the settings host if present (the settings.js wrapper calls us via setTimeout)
    var host0 = document.getElementById("teammates-pane");
    if (host0 && !host0.children.length) { setTimeout(function () { host0.appendChild(pane); }, 0); }
    pane.appendChild(el("h3", "stg-pane-title", "Teammates"));
    pane.appendChild(el("p", "stg-pane-sub", "Invite teammates and manage roles. Only owners/admins can make changes — the server enforces it."));
    var who = el("p", "stg-desc", "Checking your role…");
    pane.appendChild(who);

    // invite row
    var inviteEmail = input("teammate@company.com", "email");
    var roleSel = el("select", "stg-input");
    inviteEmail.setAttribute("aria-label", "Teammate email");
    roleSel.setAttribute("aria-label", "Invitation role");
    ["member", "admin"].forEach(function (r) {
      var o = el("option", "", r); o.value = r; roleSel.appendChild(o);
    });
    var inviteBtn = btn("Invite", "");
    var inviteMsg = el("div", "stg-desc", "");
    inviteMsg.setAttribute("role", "status");
    var inviteRow = el("div", "stg-controls");
    inviteRow.appendChild(inviteEmail);
    inviteRow.appendChild(roleSel);
    inviteRow.appendChild(inviteBtn);
    var inviteTitle = el("div", "stg-group-label", "Invite a teammate");
    inviteTitle.hidden = inviteRow.hidden = true;
    pane.appendChild(inviteTitle);
    pane.appendChild(inviteRow);
    pane.appendChild(inviteMsg);

    // member list (with role controls when permitted)
    var list = el("div", "");
    var filter = input("Search by name, email, or role", "search");
    filter.setAttribute("aria-label", "Search teammates");
    filter.hidden = true;
    pane.appendChild(el("div", "stg-group-label", "Members"));
    pane.appendChild(filter);
    pane.appendChild(list);

    var roster = [], myRole = "";
    function renderList() {
      list.innerHTML = "";
      var q = filter.value.trim().toLowerCase();
      var members = roster.filter(function (m) {
        return [m.name, m.full_name, m.email, m.role].join(" ").toLowerCase().includes(q);
      });
      if (!members.length) {
        list.appendChild(el("p", "stg-empty-note", q ? "No teammates match your search." : "No teammates yet."));
        return;
      }
      members.forEach(function (m) {
        var row = el("div", "stg-row");
        var left = el("div", "stg-row-left");
        var nm = el("div", "stg-row-label", String(m.name || m.full_name || m.email || "Member") + (String(m.status) === "invited" ? " (invited)" : ""));
        left.appendChild(nm);
        left.appendChild(el("div", "stg-desc", String(m.email || "") + " · " + String(m.role || "member")));
        var dateText = window.TeammatesPane && window.TeammatesPane.fmtLastActive;
        if (dateText) {
          var activity = dateText(m.last_active || m.last_seen);
          var joined = dateText(m.created_at);
          left.appendChild(el("div", "stg-desc", "Added: " + joined + " · Last active: " + activity));
        }
        row.appendChild(left);
        if (myRole === "owner" && m.email && (m.role === "member" || m.role === "admin")) {
          var role = el("select", "stg-input");
          role.setAttribute("aria-label", "Role for " + m.email);
          ["member", "admin"].forEach(function (value) {
            var option = el("option", "", value === "admin" ? "Admin" : "Member");
            option.value = value;
            option.selected = value === m.role;
            role.appendChild(option);
          });
          role.addEventListener("change", function () {
            var next = role.value;
            role.disabled = true;
            team("set_role", { email: m.email, role: next }).then(function () {
              m.role = next;
              inviteMsg.textContent = "Role updated for " + m.email + ".";
              renderList();
            }).catch(function (e) {
              role.value = m.role;
              role.disabled = false;
              inviteMsg.textContent = String(e.message || e).slice(0, 140);
            });
          });
          row.appendChild(role);
        }
        if (m.email && (m.role === "member" ? myRole === "admin" || myRole === "owner" : m.role === "admin" && myRole === "owner")) {
          var rm = btn("Remove", "danger");
          rm.setAttribute("aria-label", "Remove " + m.email);
          rm.addEventListener("click", function () {
            if (!confirm("Remove " + (m.email || "this member") + "?")) return;
            rm.disabled = true;
            team("remove_member", { email: m.email }).then(refresh).catch(function (e) {
              rm.disabled = false;
              inviteMsg.textContent = String(e.message || e).slice(0, 120);
            });
          });
          row.appendChild(rm);
        }
        list.appendChild(row);
      });
    }
    filter.addEventListener("input", renderList);
    function refresh() {
      return team("whoami").then(function (w) {
        if (!w || !w.role) {
          // not on a team yet — honest state, not an error
          who.textContent = "You're not on a team yet — ask an owner to invite you.";
          list.innerHTML = "";
          list.appendChild(el("p", "stg-empty-note", "No team membership for this account."));
          return;
        }
        var canManage = w.role === "owner" || w.role === "admin";
        myRole = w.role;
        inviteTitle.hidden = inviteRow.hidden = !canManage;
        who.textContent = "Your role: " + w.role + (canManage ? " — you can manage teammates." : " — view only.");
        return team("members").then(function (d) {
          roster = d && Array.isArray(d.members) ? d.members.filter(Boolean) : [];
          filter.hidden = !roster.length;
          renderList();
        });
      }).catch(function (e) {
        myRole = "";
        roster = [];
        inviteTitle.hidden = inviteRow.hidden = filter.hidden = true;
        list.innerHTML = "";
        who.textContent = "Team data unavailable right now.";
      });
    }
    inviteBtn.addEventListener("click", function () {
      var email = inviteEmail.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { inviteMsg.textContent = "Enter a valid email."; return; }
      inviteBtn.disabled = true;
      team("invite", { email: email, role: roleSel.value }).then(function () {
        inviteMsg.textContent = "Invite sent to " + email + ".";
        inviteEmail.value = "";
        refresh();
      }).catch(function (e) { inviteMsg.textContent = String(e.message || e).slice(0, 140); })
        .finally(function () { inviteBtn.disabled = false; });
    });
    refresh();
    return pane;
  }

  // ---------- Premium pane (feature surface) ----------
  function buildPremium() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Premium"));
    pane.appendChild(el("p", "stg-pane-sub", "What your plan includes on ai.spaincos.com — and what Pro adds."));
    var rows = [
      ["Deep Research", "Minutes-long expert-grade reports with many sources.", "Included"],
      ["Labs (create files & apps)", "Generate documents, spreadsheets, and small apps from chat.", "Included"],
      ["Model choice", "All 17 lanes, including uncensored, at no extra cost.", "Included"],
      ["Connectors", "Gmail, Slack, Dropbox, GitHub, Render, Vercel, Supabase — encrypted server-side.", "Included"],
      ["Fleet dispatches", "Free agent fleets for research and audits.", "Included"],
      ["Usage & Neurons", "See Settings > Usage for your live balance and rate limits.", "Included"]
    ];
    rows.forEach(function (r) {
      var row = el("div", "stg-row");
      var left = el("div", "stg-row-left");
      left.appendChild(el("div", "stg-row-label", r[0]));
      left.appendChild(el("div", "stg-desc", r[1]));
      row.appendChild(left);
      row.appendChild(el("span", "stg-desc", r[2]));
      pane.appendChild(row);
    });
    pane.appendChild(el("p", "stg-desc", "This platform is the owner's private deployment — there is no paid tier to buy. External users on boundview.com will see their own plan here."));
    return pane;
  }

  window.SettingsTeammatesPane = { render: buildTeammates };
  function register() {
    if (!window.SettingsUI || typeof window.SettingsUI.registerPane !== "function") return;
    window.SettingsUI.registerPane({ id: "premium", label: "Premium", render: buildPremium, after: "billing" });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", register);
  else register();
})();
