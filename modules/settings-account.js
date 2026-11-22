/* ============ SETTINGS EXTENSION: Account pane (E20, v230) ============
   Perplexity /account parity: profile (name, email), change password,
   sign out everywhere, and the real delete-account flow (edge function
   `account-controls`, service-side deletion of auth user + rows).
   Registers into SettingsUI via window.SettingsUI.registerPane(). */
(function () {
  "use strict";
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    var AMP = String.fromCharCode(38);
    return String(s == null ? "" : s)
      .replace(/[&<>]/g, function (c) { return AMP + ({ "&": "amp", "<": "lt", ">": "gt" })[c] + ";"; })
      .replace(/["']/g, function (c) { return c === String.fromCharCode(34) ? AMP + "quot;" : AMP + "#39;"; });
  }
  function api(body) {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    if (!client || !client.auth) return Promise.reject(new Error("Sign in to manage this."));
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in first.");
      return fetch("https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/account-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
        body: JSON.stringify(body || {}),
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(String(j.error || ("HTTP " + res.status)).slice(0, 200));
        return j;
      });
    });
  }
  function row(label, sub, right) {
    var r = el("div", "stg-row");
    var left = el("div", "stg-row-left");
    left.appendChild(el("div", "stg-row-label", esc(label)));
    if (sub) left.appendChild(el("div", "stg-desc", sub));
    r.appendChild(left);
    if (right) r.appendChild(right);
    return r;
  }
  function input(placeholder, type) {
    var i = el("input", "stg-input");
    i.type = type || "text";
    i.placeholder = placeholder;
    i.autocomplete = "off";
    return i;
  }
  function btn(label, kind) {
    var b = el("button", "stg-btn" + (kind ? " stg-btn-" + kind : ""), label);
    return b;
  }
  function msg(target, text, ok) {
    target.textContent = text;
    target.className = "stg-desc " + (ok ? "ok" : "err");
  }

  function build() {
    var pane = el("div", "stg-pane");
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    if (!client || !client.auth) { pane.appendChild(el("p", "stg-desc", "Sign in to manage your account.")); return pane; }

    // ---------- Profile ----------
    pane.appendChild(el("h3", "stg-pane-title", "Account"));
    pane.appendChild(el("p", "stg-pane-sub", "Your profile and sign-in credentials for ai.spaincos.com."));
    var u = (client.auth.user && client.auth.user()) || null;
    var email = (u && u.email) || "";
    var name = (u && u.user_metadata && u.user_metadata.full_name) || "";
    var created = (u && u.created_at) ? new Date(u.created_at).toLocaleDateString(window.I18N ? window.I18N.locale() : undefined, { month: "long", day: "numeric", year: "numeric" }) : "";
    pane.appendChild(row("Email", "Your sign-in address. Changing it sends a confirmation to both addresses.", el("span", "stg-desc", esc(email))));
    pane.appendChild(row("Member since", null, el("span", "stg-desc", esc(created))));

    var nameIn = input("Display name");
    nameIn.value = name;
    var nameSave = btn("Save name");
    var nameMsg = el("div", "stg-desc", "");
    var nameRow = row("Display name", "Shown on your profile and shared threads.", nameSave);
    nameSave.addEventListener("click", function () {
      var v = nameIn.value.trim().slice(0, 80);
      if (!v) { msg(nameMsg, "Enter a name.", false); return; }
      nameSave.disabled = true;
      client.auth.updateUser({ data: { full_name: v } }).then(function () {
        msg(nameMsg, "Name saved.", true);
      }).catch(function (e) { msg(nameMsg, String(e.message || e).slice(0, 120), false); })
        .finally(function () { nameSave.disabled = false; });
    });
    pane.appendChild(nameRow);
    pane.appendChild(nameIn);
    pane.appendChild(nameMsg);

    // ---------- Change email (v234: real flow, confirmation sent to both addresses) ----------
    pane.appendChild(el("h3", "stg-pane-title", "Change email"));
    pane.appendChild(el("p", "stg-pane-sub", "Changing your email sends a confirmation to both the old and new address. The change applies once you confirm."));
    var emIn = input("New email address");
    var emBtn = btn("Send confirmation");
    var emMsg = el("div", "stg-desc", "");
    emBtn.addEventListener("click", function () {
      var v = emIn.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { msg(emMsg, "Enter a valid email address.", false); return; }
      if (v === email) { msg(emMsg, "That is already your email.", false); return; }
      emBtn.disabled = true;
      client.auth.updateUser({ email: v }).then(function () {
        msg(emMsg, "Confirmation sent to " + v + " — check both inboxes and click the link.", true);
        emIn.value = "";
      }).catch(function (e) {
        var m = String(e.message || e);
        msg(emMsg, /already registered|already in use/i.test(m) ? "That email is already registered to an account." : m.slice(0, 140), false);
      }).finally(function () { emBtn.disabled = false; });
    });
    pane.appendChild(emIn); pane.appendChild(emBtn); pane.appendChild(emMsg);

    // ---------- Change password ----------
    pane.appendChild(el("h3", "stg-pane-title", "Change password"));
    pane.appendChild(el("p", "stg-pane-sub", "Pick a strong password you don't use anywhere else."));
    var pw1 = input("New password (8+ characters)", "password");
    var pw2 = input("Confirm new password", "password");
    var pwSave = btn("Update password");
    var pwMsg = el("div", "stg-desc", "");
    pwSave.addEventListener("click", function () {
      var v = pw1.value;
      if (v.length < 8) { msg(pwMsg, "Password must be at least 8 characters.", false); return; }
      if (v !== pw2.value) { msg(pwMsg, "Passwords don't match.", false); return; }
      pwSave.disabled = true;
      client.auth.updateUser({ password: v }).then(function () {
        msg(pwMsg, "Password updated. Other sessions stay signed in — use Devices to revoke them.", true);
        pw1.value = pw2.value = "";
      }).catch(function (e) {
        var m = String(e.message || e);
        msg(pwMsg, /recent|same password|session/i.test(m) ? "For your security, sign in again first, then change the password here." : m.slice(0, 140), false);
      }).finally(function () { pwSave.disabled = false; });
    });
    pane.appendChild(pw1); pane.appendChild(pw2); pane.appendChild(pwSave); pane.appendChild(pwMsg);

    // ---------- Sign out everywhere ----------
    pane.appendChild(el("h3", "stg-pane-title", "Sessions"));
    var soAll = btn("Sign out of all devices", "danger");
    var soMsg = el("div", "stg-desc", "");
    soAll.addEventListener("click", function () {
      if (!confirm("Sign out of every device, including this one?")) return;
      client.auth.signOut({ scope: "global" }).then(function () {
        location.href = "/";
      }).catch(function (e) { msg(soMsg, String(e.message || e).slice(0, 120), false); });
    });
    pane.appendChild(row("Sign out everywhere", "Revokes all sessions. You'll sign in again on each device.", soAll));
    pane.appendChild(soMsg);

    // ---------- Danger zone: delete account ----------
    pane.appendChild(el("h3", "stg-pane-title", "Danger zone"));
    pane.appendChild(el("p", "stg-pane-sub", "Permanently delete your account and all data. This cannot be undone."));
    var delIn = input("Type DELETE to confirm");
    var delBtn = btn("Delete my account", "danger");
    var delMsg = el("div", "stg-desc", "");
    var stats = el("div", "stg-desc", "");
    api({ action: "stats" }).then(function (j) {
      var c = j.counts || {};
      var parts = [];
      if (c.threads > 0) parts.push(c.threads + " threads");
      if (c.thread_messages > 0) parts.push(c.thread_messages + " messages");
      if (c.artifacts > 0) parts.push(c.artifacts + " artifacts");
      if (c.memory_entries > 0) parts.push(c.memory_entries + " memory entries");
      stats.textContent = parts.length ? "Will be deleted: " + parts.join(", ") + "." : "";
    }).catch(function () {});
    delBtn.addEventListener("click", function () {
      if (delIn.value.trim() !== "DELETE") { msg(delMsg, "Type DELETE to confirm.", false); return; }
      if (!confirm("Really delete your account and all data forever?")) return;
      delBtn.disabled = true;
      msg(delMsg, "Deleting…", true);
      api({ action: "delete_account", confirm: "DELETE" }).then(function () {
        try { client.auth.signOut(); } catch (e) {}
        location.href = "/";
      }).catch(function (e) {
        msg(delMsg, String(e.message || e).slice(0, 160), false);
        delBtn.disabled = false;
      });
    });
    pane.appendChild(stats);
    pane.appendChild(delIn); pane.appendChild(delBtn); pane.appendChild(delMsg);
    return pane;
  }

  // register the pane (same pattern as settings-security.js: render + after)
  function register() {
    if (!window.SettingsUI || typeof window.SettingsUI.registerPane !== "function") return;
    window.SettingsUI.registerPane({
      id: "account",
      label: "Account",
      icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
      render: build,
      after: "preferences"
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", register);
  else register();
})();
