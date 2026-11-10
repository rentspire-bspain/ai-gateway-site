/* ============ SETTINGS EXTENSION: Team (G3) ============
   Registers an admin-gated "Team" pane into SettingsUI:
     - members list with roles (owner/admin/member)
     - invites by email
     - allowlist management
   All mutating calls go through the `team` edge function, which enforces
   owner/admin permissions server-side. The pane is only visible when the
   signed-in user is an owner or admin (role is fetched on load). */
(function () {
  "use strict";

  var TEAM_URL = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/team";

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function errText(e) { return String((e && e.message) || e || "Something went wrong").slice(0, 200); }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim()); }

  // ---------- API (same pattern as modules/monitors.js) ----------
  function api(body) {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    if (!client || !client.auth) return Promise.reject(new Error("Sign in to manage the team."));
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in first.");
      return fetch(TEAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
        body: JSON.stringify(body || {})
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(errText(j.error || j.message) || "Request failed (" + res.status + ")");
        return j;
      });
    });
  }

  // ---------- role state (drives pane visibility) ----------
  var myRole = null; // "owner" | "admin" | "member" | null
  var myEmail = "";
  function whoami() {
    return api({ action: "whoami" }).then(function (j) {
      myRole = j.role || null;
      myEmail = String(j.email || "").toLowerCase();
    }).catch(function () { myRole = null; });
  }

  // ============================================================
  // TEAM PANE
  // ============================================================
  function paneTeam() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Team"));
    pane.appendChild(el("p", "stg-pane-sub", "Members, roles, and the sign-in allowlist for this site."));

    if (myRole !== "owner" && myRole !== "admin") {
      var lock = el("p", "stg-desc", "Only owners and admins can manage the team.");
      lock.style.color = "var(--error)";
      pane.appendChild(lock);
      return pane;
    }
    var isOwner = myRole === "owner";

    var status = el("p", "stg-desc", "Loading…");

    // ---- members ----
    var membersWrap = el("div");
    pane.appendChild(el("div", "stg-group-label", "Members"));
    pane.appendChild(membersWrap);

    function renderMembers(members) {
      membersWrap.innerHTML = "";
      if (!members.length) {
        membersWrap.appendChild(el("p", "stg-empty-note", "No members yet."));
      }
      members.forEach(function (m) {
        var row = el("div", "org-member-row");
        var txt = el("div", "sec-device-text");
        var name = el("div", "sec-device-name");
        name.textContent = m.email;
        if (m.status === "invited") {
          var chip = el("span", "stg-version-chip", "invited");
          name.appendChild(document.createTextNode(" "));
          name.appendChild(chip);
        }
        txt.appendChild(name);
        var meta = el("div", "sec-device-meta");
        meta.textContent = m.role + " · added " + (m.created_at ? new Date(m.created_at).toLocaleDateString() : "—");
        txt.appendChild(meta);
        row.appendChild(txt);

        // role select
        var sel = el("select", "stg-select");
        sel.setAttribute("aria-label", "Role for " + m.email);
        ["member", "admin", "owner"].forEach(function (r) {
          var o = el("option");
          o.value = r;
          o.textContent = r.charAt(0).toUpperCase() + r.slice(1);
          if (m.role === r) o.selected = true;
          sel.appendChild(o);
        });
        var isOwnerRow = m.role === "owner";
        if (isOwnerRow || !isOwner) {
          // owner row is immutable; only owners can change roles
          sel.disabled = true;
        }
        sel.addEventListener("change", function () {
          var to = sel.value;
          sel.disabled = true;
          api({ action: "set_role", email: m.email, role: to })
            .then(refresh)
            .catch(function (e) {
              status.textContent = errText(e);
              sel.disabled = false;
              sel.value = m.role;
            });
        });
        row.appendChild(sel);

        // remove (not for the owner; admins can only remove members)
        if (!isOwnerRow && (isOwner || m.role === "member")) {
          var del = el("button", "stg-icon-btn danger", "✕");
          del.type = "button";
          del.title = "Remove member";
          del.setAttribute("aria-label", "Remove " + m.email);
          var armed = false, timer = null;
          del.addEventListener("click", function () {
            if (!armed) {
              armed = true;
              del.classList.add("solid");
              del.title = "Click again to remove";
              timer = setTimeout(function () { armed = false; del.classList.remove("solid"); del.title = "Remove member"; }, 4000);
              return;
            }
            clearTimeout(timer);
            del.disabled = true;
            api({ action: "remove_member", email: m.email })
              .then(refresh)
              .catch(function (e) { status.textContent = errText(e); del.disabled = false; });
          });
          row.appendChild(del);
        }
        membersWrap.appendChild(row);
      });
    }

    // ---- invite form ----
    pane.appendChild(el("div", "stg-group-label", "Invite"));
    var inviteForm = el("div", "org-invite-form");
    var emailInput = el("input", "stg-input");
    emailInput.type = "text";
    emailInput.placeholder = "teammate@company.com";
    emailInput.setAttribute("aria-label", "Invite email");
    var roleSel = el("select", "stg-select");
    roleSel.setAttribute("aria-label", "Invite role");
    var memberOpt = el("option", null, "Member");
    memberOpt.value = "member";
    var adminOpt = el("option", null, "Admin");
    adminOpt.value = "admin";
    if (!isOwner) adminOpt.disabled = true; // only owners can mint admins
    roleSel.appendChild(memberOpt);
    roleSel.appendChild(adminOpt);
    var inviteBtn = el("button", "stg-btn", "Send invite");
    inviteBtn.type = "button";
    function sendInvite() {
      var email = emailInput.value.trim().toLowerCase();
      if (!validEmail(email)) { status.textContent = "Enter a valid email address."; emailInput.focus(); return; }
      inviteBtn.disabled = true;
      api({ action: "invite", email: email, role: roleSel.value })
        .then(function (r) {
          emailInput.value = "";
          if (r && r.temp_password) {
            status.innerHTML = "";
            var box = document.createElement("div");
            box.className = "org-invite-pw";
            box.style.cssText = "margin:8px 0;padding:10px 12px;border:1px solid var(--border,#26282E);border-radius:10px;background:rgba(127,180,255,.08)";
            var l1 = document.createElement("div"); l1.textContent = "Account created for " + email + "."; l1.style.marginBottom = "4px";
            var l2 = document.createElement("div"); l2.textContent = "One-time password (shown only here — copy and share it with them):"; l2.style.marginBottom = "4px"; l2.style.opacity = ".8";
            var pw = document.createElement("code"); pw.textContent = r.temp_password; pw.style.cssText = "font-size:14px;padding:2px 8px;border-radius:6px;background:rgba(127,180,255,.15);word-break:break-all";
            var l3 = document.createElement("div"); l3.textContent = "They sign in with this email + password, and can change it in Settings."; l3.style.marginTop = "6px"; l3.style.opacity = ".7"; l3.style.fontSize = "12px";
            box.appendChild(l1); box.appendChild(l2); box.appendChild(pw); box.appendChild(l3);
            status.appendChild(box);
          } else if (r && r.note) {
            status.textContent = r.note;
          } else {
            status.textContent = "Invited.";
          }
          refresh();
        })
        .catch(function (e) { status.textContent = errText(e); })
        .then(function () { inviteBtn.disabled = false; });
    }
    inviteBtn.addEventListener("click", sendInvite);
    emailInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); sendInvite(); } });
    inviteForm.appendChild(emailInput);
    inviteForm.appendChild(roleSel);
    inviteForm.appendChild(inviteBtn);
    pane.appendChild(inviteForm);
    pane.appendChild(el("p", "stg-empty-note",
      "Invites create the sign-in account and add the email to the sign-in allowlist. A one-time password is shown to you when you invite — share it with them directly."));

    // ---- allowlist ----
    pane.appendChild(el("div", "stg-group-label", "Sign-in allowlist"));
    var allowWrap = el("div");
    var allowForm = el("div", "org-invite-form");
    var allowInput = el("input", "stg-input");
    allowInput.type = "text";
    allowInput.placeholder = "email to allow";
    allowInput.setAttribute("aria-label", "Allowlist email");
    var allowBtn = el("button", "stg-btn ghost", "Add");
    allowBtn.type = "button";
    function addAllow() {
      var email = allowInput.value.trim().toLowerCase();
      if (!validEmail(email)) { status.textContent = "Enter a valid email address."; allowInput.focus(); return; }
      allowBtn.disabled = true;
      api({ action: "allowlist_add", email: email })
        .then(function () { allowInput.value = ""; status.textContent = ""; refresh(); })
        .catch(function (e) { status.textContent = errText(e); })
        .then(function () { allowBtn.disabled = false; });
    }
    allowBtn.addEventListener("click", addAllow);
    allowInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addAllow(); } });
    allowForm.appendChild(allowInput);
    allowForm.appendChild(allowBtn);
    pane.appendChild(allowWrap);
    pane.appendChild(allowForm);
    pane.appendChild(el("p", "stg-empty-note",
      "The allowlist gates who can sign in to this site — only emails on this list can log in."));

    // ---- status + refresh ----
    pane.insertBefore(status, membersWrap);
    function renderAllowlist(emails) {
      allowWrap.innerHTML = "";
      if (!emails.length) {
        allowWrap.appendChild(el("p", "stg-empty-note", "Allowlist is empty."));
      }
      emails.forEach(function (email) {
        var row = el("div", "org-member-row");
        var txt = el("div", "sec-device-text");
        var name = el("div", "sec-device-name");
        name.textContent = email;
        if (email === myEmail) {
          var chip = el("span", "stg-version-chip", "you");
          name.appendChild(document.createTextNode(" "));
          name.appendChild(chip);
        }
        txt.appendChild(name);
        row.appendChild(txt);
        var del = el("button", "stg-icon-btn danger", "✕");
        del.type = "button";
        del.title = "Remove from allowlist";
        del.setAttribute("aria-label", "Remove " + email + " from allowlist");
        var armed = false, timer = null;
        del.addEventListener("click", function () {
          if (!armed) {
            armed = true;
            del.classList.add("solid");
            del.title = "Click again to remove";
            timer = setTimeout(function () { armed = false; del.classList.remove("solid"); del.title = "Remove from allowlist"; }, 4000);
            return;
          }
          clearTimeout(timer);
          del.disabled = true;
          api({ action: "allowlist_remove", email: email })
            .then(refresh)
            .catch(function (e) { status.textContent = errText(e); del.disabled = false; });
        });
        row.appendChild(del);
        allowWrap.appendChild(row);
      });
    }
    function refresh() {
      return Promise.all([
        api({ action: "members" }),
        api({ action: "allowlist_list" })
      ]).then(function (r) {
        status.textContent = "";
        renderMembers(r[0].members || []);
        renderAllowlist(r[1].allowlist || []);
      }).catch(function (e) {
        status.textContent = errText(e);
      });
    }
    refresh();
    return pane;
  }

  // ---------- register (admin-gated) ----------
  function register() {
    if (!window.SettingsUI || typeof window.SettingsUI.registerPane !== "function") return;
    window.SettingsUI.registerPane({
      id: "team",
      label: "Team",
      icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      render: paneTeam,
      after: "credentials",
      visible: function () { return myRole === "owner" || myRole === "admin"; }
    });
    // fetch the caller's role once so the tab can appear/hide correctly;
    // re-check when settings opens in case the session changed.
    whoami();
    var origOpen = window.SettingsUI.open;
    window.SettingsUI.open = function (paneId) {
      whoami().then(function () { origOpen(paneId); });
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", register);
  else register();
})();
