/* ============ SETTINGS EXTENSIONS: Devices (E8) + Credentials vault (E12) ============
   Registers two panes into SettingsUI via window.SettingsUI.registerPane():
     - "devices"     — Devices & sessions (E8): tracked device list, sign out
                       of this device, sign out everywhere.
     - "credentials" — Credentials vault (E12): per-user secrets, encrypted at
                       rest (pgcrypto), write-only in the UI.

   Talks to edge functions `devices` and `cred-vault` with the signed-in user's
   JWT. No secrets are ever written to localStorage. */
(function () {
  "use strict";

  var SB_FUNCTIONS = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1";
  var DEVICES_URL = SB_FUNCTIONS + "/devices";
  var VAULT_URL = SB_FUNCTIONS + "/cred-vault";
  var DEVICE_KEY = "ai_device_id"; // random id per browser, NOT a secret

  // ---------- tiny DOM helpers (same conventions as settings.js) ----------
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
  function ago(t) {
    if (!t) return "never";
    var s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  function fmtDate(t) {
    try { return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
    catch (e) { return ""; }
  }
  function errText(e) { return String((e && e.message) || e || "Something went wrong").slice(0, 200); }

  // ---------- API (same pattern as modules/monitors.js) ----------
  function api(url, body) {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    if (!client || !client.auth) return Promise.reject(new Error("Sign in to manage this."));
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in first.");
      return fetch(url, {
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

  // ---------- device identity ----------
  function deviceId() {
    var id = null;
    try { id = localStorage.getItem(DEVICE_KEY); } catch (e) {}
    if (!id) {
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID()
        : "d" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
    }
    return id;
  }
  function parseUA(ua) {
    ua = String(ua || "");
    var os = /Windows/i.test(ua) ? "Windows"
      : /Android/i.test(ua) ? "Android"
      : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
      : /Mac OS X/i.test(ua) ? "macOS"
      : /CrOS/i.test(ua) ? "ChromeOS"
      : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
    var browser = /Edg\//i.test(ua) ? "Edge"
      : /OPR\//i.test(ua) ? "Opera"
      : /Chrome\//i.test(ua) ? "Chrome"
      : /Firefox\//i.test(ua) ? "Firefox"
      : /Safari\//i.test(ua) ? "Safari" : "Browser";
    return { browser: browser, os: os };
  }

  // ============================================================
  // E8 — DEVICES PANE
  // ============================================================
  function paneDevices() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Devices & sessions"));
    pane.appendChild(el("p", "stg-pane-sub", "Devices that have signed in to this app."));

    // sign-out actions (this device / everywhere)
    var outWrap = el("div", "sec-actions");
    var thisBtn = el("button", "stg-btn ghost", "Sign out of this device");
    thisBtn.type = "button";
    thisBtn.addEventListener("click", async function () {
      thisBtn.disabled = true;
      try { await sb.auth.signOut(); } catch (e) {}
      location.reload();
    });
    var allBtn = el("button", "stg-btn danger", "Sign out everywhere");
    allBtn.type = "button";
    var armed = false, timer = null;
    allBtn.addEventListener("click", async function () {
      if (!armed) {
        armed = true;
        allBtn.classList.add("solid");
        allBtn.textContent = "Click again to sign out ALL devices";
        timer = setTimeout(function () {
          armed = false; allBtn.classList.remove("solid"); allBtn.textContent = "Sign out everywhere";
        }, 5000);
        return;
      }
      clearTimeout(timer);
      allBtn.disabled = true;
      try { await sb.auth.signOut({ scope: "global" }); } catch (e) {}
      location.reload();
    });
    outWrap.appendChild(thisBtn);
    outWrap.appendChild(allBtn);
    pane.appendChild(outWrap);

    // device list
    var status = el("p", "stg-desc", "Loading devices…");
    var list = el("div", "sec-device-list");
    pane.appendChild(status);
    pane.appendChild(list);

    var myId = deviceId();
    var ua = parseUA(navigator.userAgent);

    function renderList(devices) {
      status.textContent = "";
      list.innerHTML = "";
      if (!devices.length) {
        list.appendChild(el("p", "stg-empty-note", "No devices registered yet."));
      }
      devices.forEach(function (d) {
        var row = el("div", "sec-device-row");
        var txt = el("div", "sec-device-text");
        var name = el("div", "sec-device-name");
        name.textContent = (d.label || (d.browser || "Browser") + " on " + (d.os || "unknown"));
        if (d.device_id === myId) {
          var badge = el("span", "stg-version-chip", "This device");
          name.appendChild(document.createTextNode(" "));
          name.appendChild(badge);
        }
        txt.appendChild(name);
        var meta = el("div", "sec-device-meta");
        meta.textContent = "Last active " + ago(d.last_seen_at) +
          " · first seen " + fmtDate(d.first_seen_at);
        txt.appendChild(meta);
        row.appendChild(txt);
        if (d.device_id !== myId) {
          var rm = el("button", "stg-icon-btn danger", "✕");
          rm.type = "button";
          rm.title = "Remove device from list";
          rm.setAttribute("aria-label", "Remove device from list");
          rm.addEventListener("click", function () {
            rm.disabled = true;
            api(DEVICES_URL, { action: "remove", device_id: d.device_id })
              .then(refresh)
              .catch(function (e) { status.textContent = errText(e); rm.disabled = false; });
          });
          row.appendChild(rm);
        }
        list.appendChild(row);
      });
    }
    function refresh() {
      return api(DEVICES_URL, {
        action: "register",
        device_id: myId,
        label: ua.browser + " on " + ua.os,
        browser: ua.browser,
        os: ua.os
      }).then(function () {
        return api(DEVICES_URL, { action: "list" });
      }).then(function (j) {
        renderList(j.devices || []);
      }).catch(function (e) {
        status.textContent = errText(e);
        list.innerHTML = "";
      });
    }
    refresh();

    pane.appendChild(el("p", "stg-empty-note",
      "Supabase doesn\u2019t expose an inventory of live sessions, so this list tracks devices that signed in from this app. " +
      "Removing a device only removes it from this list \u2014 use \u201cSign out everywhere\u201d to revoke all sessions."));
    return pane;
  }

  // ============================================================
  // E12 — CREDENTIALS VAULT PANE
  // ============================================================
  function paneCredentials() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Credentials"));
    pane.appendChild(el("p", "stg-pane-sub", "Secrets for tools and connectors, encrypted at rest."));

    var info = el("div", "stg-info");
    var infoTxt = el("p", null, "Values are encrypted before storage (pgcrypto, per-user key) and are write-only: after saving, a value is never returned to the browser \u2014 only a masked hint.");
    info.appendChild(infoTxt);
    pane.appendChild(info);

    var status = el("p", "stg-desc", "Loading…");
    var list = el("div", "sec-cred-list");
    var form = el("div", "sec-cred-form");

    function buildForm(existing, done) {
      form.innerHTML = "";
      var isEdit = !!existing;
      var nameWrap = el("div", "sec-field");
      nameWrap.appendChild(el("label", "stg-label", isEdit ? "Name" : "Credential name"));
      var nameInput = el("input", "stg-input");
      nameInput.type = "text";
      nameInput.placeholder = "e.g., MLS API key";
      nameInput.value = existing ? existing.name : "";
      nameInput.disabled = isEdit; // rename = delete + re-add, keeps upserts unambiguous
      if (!isEdit) nameInput.setAttribute("aria-label", "Credential name");
      nameWrap.appendChild(nameInput);
      var valWrap = el("div", "sec-field");
      valWrap.appendChild(el("label", "stg-label", isEdit ? "New value (overwrites)" : "Secret value"));
      var valInput = el("input", "stg-input");
      valInput.type = "password";
      valInput.autocomplete = "off";
      valInput.placeholder = "Paste the secret — it is never shown again after saving";
      valInput.setAttribute("aria-label", "Secret value");
      valWrap.appendChild(valInput);
      var btns = el("div", "stg-confirm");
      var cancel = el("button", "stg-btn ghost", "Cancel");
      cancel.type = "button";
      var save = el("button", "stg-btn", isEdit ? "Overwrite secret" : "Save secret");
      save.type = "button";
      function commit() {
        var name = nameInput.value.trim();
        var value = valInput.value;
        if (!name) { nameInput.focus(); return; }
        if (!value) { valInput.focus(); return; }
        save.disabled = true;
        save.textContent = "Saving…";
        api(VAULT_URL, { action: "upsert", name: name, value: value })
          .then(function () {
            valInput.value = ""; // write-only: clear immediately
            buildForm(null);
            refresh();
          })
          .catch(function (e) {
            status.textContent = errText(e);
            save.disabled = false;
            save.textContent = isEdit ? "Overwrite secret" : "Save secret";
          });
      }
      save.addEventListener("click", commit);
      valInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); commit(); } });
      nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); valInput.focus(); } });
      cancel.addEventListener("click", function () { buildForm(null); if (done) done(); });
      btns.appendChild(cancel);
      btns.appendChild(save);
      form.appendChild(nameWrap);
      form.appendChild(valWrap);
      form.appendChild(btns);
    }
    buildForm(null);
    pane.appendChild(status);
    pane.appendChild(list);
    pane.appendChild(form);

    function renderList(creds) {
      status.textContent = "";
      list.innerHTML = "";
      if (!creds.length) {
        list.appendChild(el("p", "stg-empty-note", "No credentials saved yet — add one below."));
        return;
      }
      creds.forEach(function (c) {
        var row = el("div", "sec-cred-row");
        var txt = el("div", "sec-device-text");
        var name = el("div", "sec-device-name");
        name.textContent = c.name;
        txt.appendChild(name);
        var masked = el("div", "sec-cred-mask");
        masked.textContent = "••••••••" + (c.value_hint ? " " + c.value_hint : ""); // textContent: safe, no escaping needed
        txt.appendChild(masked);
        var meta = el("div", "sec-device-meta");
        meta.textContent = "Updated " + ago(c.updated_at);
        txt.appendChild(meta);
        row.appendChild(txt);
        var edit = el("button", "stg-icon-btn", "✎");
        edit.type = "button";
        edit.title = "Overwrite value";
        edit.setAttribute("aria-label", "Overwrite value for " + c.name);
        edit.addEventListener("click", function () {
          buildForm({ name: c.name }, function () {});
          var first = form.querySelector("input[type=password]");
          if (first) first.focus();
        });
        var del = el("button", "stg-icon-btn danger", "✕");
        del.type = "button";
        del.title = "Delete credential";
        del.setAttribute("aria-label", "Delete " + c.name);
        var armed = false, timer = null;
        del.addEventListener("click", function () {
          if (!armed) {
            armed = true;
            del.classList.add("solid");
            del.title = "Click again to delete";
            timer = setTimeout(function () { armed = false; del.classList.remove("solid"); del.title = "Delete credential"; }, 4000);
            return;
          }
          clearTimeout(timer);
          del.disabled = true;
          api(VAULT_URL, { action: "delete", id: c.id })
            .then(refresh)
            .catch(function (e) { status.textContent = errText(e); del.disabled = false; });
        });
        row.appendChild(edit);
        row.appendChild(del);
        list.appendChild(row);
      });
    }
    function refresh() {
      return api(VAULT_URL, { action: "list" }).then(function (j) {
        renderList(j.credentials || []);
      }).catch(function (e) {
        status.textContent = errText(e);
        list.innerHTML = "";
      });
    }
    refresh();
    return pane;
  }

  // ---------- Two-factor authentication (TOTP, optional) ----------
  function paneTwoFA() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Two-factor authentication"));
    pane.appendChild(el("p", "stg-pane-sub", "Optional. Add an authenticator-app code (TOTP) as a second step after your password. You will only be asked for a code if you turn this on."));
    var body = el("div", "sec-actions"); pane.appendChild(body);
    var status = el("p", "stg-pane-sub", ""); pane.appendChild(status);
    pane.appendChild(el("p", "stg-pane-sub", "Recovery: if you lose your authenticator, use Devices \u2192 Sign out everywhere, then ask the owner to remove the factor. Keep the setup key somewhere safe."));
    var mfa = function () { return sb.auth.mfa; };
    function btn(t, cls, fn) { var b = el("button", "stg-btn " + cls, t); b.type = "button"; b.addEventListener("click", fn); return b; }
    function refresh() {
      body.innerHTML = "";
      mfa().listFactors().then(function (r) {
        if (r.error) throw r.error;
        var all = (r.data && r.data.all) || [];
        all.filter(function (f) { return f.factor_type === "totp" && f.status !== "verified"; }).forEach(function (f) { mfa().unenroll({ factorId: f.id }); });
        var ok = (r.data && r.data.totp) || [];
        if (ok.length) {
          body.appendChild(el("span", "", "Status: <b>On</b> "));
          body.appendChild(btn("Turn off", "ghost", function () {
            var code = window.prompt("Enter a current 6-digit code to turn off 2FA");
            if (!code) return;
            mfa().challengeAndVerify({ factorId: ok[0].id, code: code.trim() }).then(function (v) {
              if (v.error) throw v.error;
              return mfa().unenroll({ factorId: ok[0].id });
            }).then(function () { status.textContent = "Two-factor authentication is off."; refresh(); })
              .catch(function (e) { status.textContent = errText(e); });
          }));
        } else {
          body.appendChild(el("span", "", "Status: Off "));
          body.appendChild(btn("Set up authenticator", "solid", enroll));
        }
      }).catch(function (e) { status.textContent = errText(e); });
    }
    function enroll() {
      mfa().enroll({ factorType: "totp", friendlyName: "Authenticator " + Date.now() }).then(function (r) {
        if (r.error) throw r.error;
        var f = r.data; body.innerHTML = "";
        var img = el("img"); img.alt = "TOTP QR code"; img.width = 160; img.height = 160; img.src = f.totp.qr_code; img.id = "totpQr";
        body.appendChild(img);
        var sec = el("code", "", esc(f.totp.secret)); sec.id = "totpSecret"; body.appendChild(el("div", "", "Setup key: ")); body.lastChild.appendChild(sec);
        var inp = el("input", "stg-input"); inp.placeholder = "6-digit code"; inp.inputMode = "numeric"; inp.id = "totpCode"; body.appendChild(inp);
        body.appendChild(btn("Verify and turn on", "solid", function () {
          mfa().challengeAndVerify({ factorId: f.id, code: inp.value.trim() }).then(function (v) {
            if (v.error) throw v.error;
            status.textContent = "Two-factor authentication is on."; refresh();
          }).catch(function (e) { status.textContent = errText(e); });
        }));
        body.appendChild(btn("Cancel", "ghost", function () { mfa().unenroll({ factorId: f.id }).then(refresh); }));
      }).catch(function (e) { status.textContent = errText(e); });
    }
    refresh();
    return pane;
  }

  // ---------- register panes ----------
  function register() {
    if (!window.SettingsUI || typeof window.SettingsUI.registerPane !== "function") return;
    window.SettingsUI.registerPane({
      id: "devices",
      label: "Devices",
      icon: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
      render: paneDevices,
      after: "data"
    });
    window.SettingsUI.registerPane({
      id: "credentials",
      label: "Credentials",
      icon: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3-3.5 3.5z"/>',
      render: paneCredentials,
      after: "devices"
    });
    window.SettingsUI.registerPane({
      id: "twofa",
      label: "Two-factor",
      icon: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
      render: paneTwoFA,
      after: "devices"
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", register);
  else register();
})();
