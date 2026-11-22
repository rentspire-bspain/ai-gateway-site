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

  // ---------- Teammate templates + shared profile preview (pure helpers, exported for tests) ----------
  var PRESETS = [
    { id: "research-analyst", name: "Research Analyst", instructions: "Research the question across multiple sources, cross-check claims, and cite every source. Separate facts from inference and state confidence and gaps." },
    { id: "code-reviewer", name: "Code Reviewer", instructions: "Review code for correctness, security, and maintainability. List issues by severity with file/line references and a concrete fix for each. Do not rewrite unrelated code." },
    { id: "data-extractor", name: "Data Extractor", instructions: "Extract the requested fields from the supplied material into a structured table or JSON. Never guess: mark missing values as null and quote the source text for each." },
    { id: "summarizer", name: "Summarizer", instructions: "Summarize the material in a short brief: key points, decisions, open questions, and next steps. Keep it faithful to the source and under 200 words unless asked." }
  ];
  var TPL_KEY = "teammate-templates:v1:";
  function presetById(id) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i]; return null; }
  function tplStore(owner) {
    var ls = typeof localStorage !== "undefined" ? localStorage : null;
    var k = TPL_KEY + String(owner || "me").toLowerCase();
    return {
      load: function () { try { var o = JSON.parse(ls.getItem(k) || "{}"); return o && typeof o === "object" ? o : {}; } catch (_e) { return {}; } },
      save: function (o) { try { ls.setItem(k, JSON.stringify(o)); return true; } catch (_e) { return false; } }
    };
  }
  // applyTemplate(assignments, email, templateId) -> new assignments (pure); unknown template or blank email = unchanged; "" clears.
  function applyTemplate(a, email, id) {
    var out = {}; Object.keys(a || {}).forEach(function (k) { out[k] = a[k]; });
    var e = String(email || "").trim().toLowerCase();
    if (!e) return out;
    if (id === "") { delete out[e]; return out; }
    var t = presetById(id); if (!t) return out;
    out[e] = { templateId: t.id, instructions: t.instructions };
    return out;
  }
  // effectiveProfile — what a teammate will actually get; read-only. Memory is honest: none is stored for teammates.
  function effectiveProfile(member, a) {
    var m = member || {}, e = String(m.email || "").toLowerCase();
    var asg = (a || {})[e], t = asg && presetById(asg.templateId);
    return {
      name: String(m.name || m.full_name || e.split("@")[0] || "Teammate"),
      email: e, role: String(m.role || "member"),
      template: t ? t.name : null,
      instructions: t ? t.instructions : "No template applied — default assistant behavior.",
      memory: "No shared memory is stored for this teammate."
    };
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

    var profile = btn("Edit my account profile", "");
    profile.addEventListener("click", function () { window.SettingsUI.open("account"); });
    pane.appendChild(profile);

    // Keep invitations in the one flow that handles onboarding instructions.
    var inviteBtn = btn("Open Team invitations", "");
    inviteBtn.addEventListener("click", function () { window.SettingsUI.open("team"); });
    var inviteMsg = el("div", "stg-desc", "");
    inviteMsg.setAttribute("role", "status");
    var inviteRow = el("div", "stg-controls");
    inviteRow.appendChild(inviteBtn);
    var inviteTitle = el("div", "stg-group-label", "Invite a teammate");
    inviteTitle.hidden = inviteRow.hidden = true;
    pane.appendChild(inviteTitle);
    pane.appendChild(inviteRow);
    pane.appendChild(inviteMsg);

    // templates + read-only profile preview (local to this account; no network calls)
    var store = tplStore(), assigns = store.load();
    pane.appendChild(el("div", "stg-group-label", "Teammate templates"));
    pane.appendChild(el("p", "stg-desc", "Reusable instruction presets. Pick a preset to preview it, then apply it to a teammate from the roster."));
    var preview = el("div", "stg-desc"); preview.setAttribute("role", "status");
    function showProfile(pf, pre) {
      preview.textContent = (pre ? "Preview (read-only): " : "Profile (read-only): ") + pf.name + (pf.email ? " <" + pf.email + ">" : "") + " · " + pf.role + " · Template: " + (pf.template || "none") + " · Instructions: " + pf.instructions + " · Memory: " + pf.memory;
    }
    var presetRow = el("div", "stg-controls");
    PRESETS.forEach(function (t) {
      var b = btn(t.name, ""); b.setAttribute("aria-label", "Preview template " + t.name);
      b.addEventListener("click", function () { showProfile({ name: t.name, email: "", role: "member", template: t.name, instructions: t.instructions, memory: "No shared memory is stored for this teammate." }, true); });
      presetRow.appendChild(b);
    });
    pane.appendChild(presetRow); pane.appendChild(preview);

    // member list (with role controls when permitted)
    var list = el("div", "");
    var filter = input("Search by name, email, or role", "search");
    filter.setAttribute("aria-label", "Search teammates");
    var statusFilter = el("select", "stg-input");
    statusFilter.setAttribute("aria-label", "Teammate invitation status");
    [["all", "All teammates"], ["invited", "Pending invitations"]].forEach(function (entry) {
      var option = el("option", "", entry[1]);
      option.value = entry[0];
      statusFilter.appendChild(option);
    });
    var filters = el("div", "stg-controls");
    filters.hidden = true;
    filters.appendChild(filter);
    filters.appendChild(statusFilter);
    pane.appendChild(el("div", "stg-group-label", "Members"));
    pane.appendChild(filters);
    pane.appendChild(list);

    var roster = [], myRole = "";
    function renderList() {
      list.innerHTML = "";
      var q = filter.value.trim().toLowerCase();
      var pendingOnly = statusFilter.value === "invited";
      var members = roster.filter(function (m) {
        return (!pendingOnly || m.status === "invited") &&
          [m.name, m.full_name, m.email, m.role].join(" ").toLowerCase().includes(q);
      });
      if (!members.length) {
        list.appendChild(el("p", "stg-empty-note", q ? "No teammates match your search." : pendingOnly ? "No pending invitations." : "No teammates yet."));
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
        if (myRole === "owner" || myRole === "admin") {
          var tsel = el("select", "stg-input"); tsel.setAttribute("aria-label", "Template for " + (m.email || "member"));
          var none = el("option", "", "No template"); none.value = ""; tsel.appendChild(none);
          PRESETS.forEach(function (t) { var o = el("option", "", t.name); o.value = t.id; o.selected = !!(assigns[String(m.email || "").toLowerCase()] && assigns[String(m.email || "").toLowerCase()].templateId === t.id); tsel.appendChild(o); });
          tsel.addEventListener("change", function () {
            var v = tsel.value; tsel.disabled = true;
            team("template_set", { email: m.email, template_id: v }).then(function () {
              assigns = applyTemplate(assigns, m.email, v); store.save(assigns); inviteMsg.textContent = "Template saved for " + m.email + " (enforced on their chats)."; showProfile(effectiveProfile(m, assigns));
            }).catch(function (e) {
              assigns = applyTemplate(assigns, m.email, v); store.save(assigns); // offline fallback only; NOT enforced server-side
              inviteMsg.textContent = "Saved on this device only (not enforced): " + String(e && e.message || e).slice(0, 100); showProfile(effectiveProfile(m, assigns));
            }).then(function () { tsel.disabled = false; });
          });
          row.appendChild(tsel);
        }
        var pv = btn("Preview profile", ""); pv.setAttribute("aria-label", "Preview profile for " + (m.email || "member"));
        pv.addEventListener("click", function () { showProfile(effectiveProfile(m, assigns)); });
        row.appendChild(pv);
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
    statusFilter.addEventListener("change", renderList);
    function refresh() {
      return team("whoami").then(function (w) {
        if (!w || !w.role) {
          // not on a team yet — honest state, not an error
          who.textContent = "You're not on a team yet — ask an owner to invite you.";
          myRole = "";
          roster = [];
          inviteTitle.hidden = inviteRow.hidden = filters.hidden = true;
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
          filters.hidden = !roster.length;
          if (!canManage) { renderList(); return; }
          return team("template_get").then(function (t) {
            if (t && Array.isArray(t.assignments)) {
              var srv = {};
              t.assignments.forEach(function (r) { var tp = r && presetById(r.template_id); if (tp) srv[String(r.member_email).toLowerCase()] = { templateId: tp.id, instructions: tp.instructions }; });
              assigns = srv; store.save(assigns); // server is the source of truth; localStorage mirrors it
            }
          }).catch(function () { /* keep the local fallback */ }).then(renderList);
        });
      }).catch(function (e) {
        myRole = "";
        roster = [];
        inviteTitle.hidden = inviteRow.hidden = filters.hidden = true;
        list.innerHTML = "";
        who.textContent = "Team data unavailable right now.";
      });
    }
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
  window.TeammateTemplates = { PRESETS: PRESETS, applyTemplate: applyTemplate, effectiveProfile: effectiveProfile };
  function register() {
    if (!window.SettingsUI || typeof window.SettingsUI.registerPane !== "function") return;
    window.SettingsUI.registerPane({ id: "premium", label: "Premium", render: buildPremium, after: "billing" });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", register);
  else register();
})();
