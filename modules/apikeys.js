(function () {
  "use strict";
  var URL_ = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/api-keys";
  var PREFIX_LIT = "sk-spaincos-";
  var root = null;
  var state = { loading: true, error: "", creating: false, busy: false, copied: false };
  var keys = [];
  var newKey = null; // { name, raw } — shown exactly once, never re-fetched

  function clean(s) {
    if (s == null) return "";
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "").replace(/ {2,}/g, " ").trim();
  }
  function esc(s) { var d = document.createElement("div"); d.textContent = clean(s); return d.innerHTML; }

  function ago(t) {
    if (!t) return "never";
    var s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  function dateLabel(t) {
    if (!t) return "";
    try { return new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch (e) { return String(t).slice(0, 10); }
  }
  // "sk-spaincos-…ab12" — first 4 chars of the stored 8-char prefix.
  function prefixLabel(p) { return PREFIX_LIT + "…" + String(p || "").slice(0, 4); }

  function api(body) {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in to manage API keys.");
      return fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(body) });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(clean(j.error || j.message) || "Request failed (" + res.status + ")");
        return j;
      });
    });
  }

  function ensureCss() {
    if (document.querySelector('link[href*="apikeys.css"]')) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "modules/apikeys.css"; document.head.appendChild(l);
  }

  function refresh() {
    return api({ action: "list" }).then(function (r) {
      keys = r.keys || [];
      state.error = ""; state.loading = false;
    }).catch(function (e) {
      state.loading = false; state.error = clean(e.message);
    }).then(render);
  }

  function fail(e) { state.error = clean(e.message); state.busy = false; render(); }

  function keyCard(k) {
    return '<div class="ak-card" data-id="' + esc(k.id) + '">' +
      '<div class="ak-row"><div class="ak-grow"><div class="ak-name">' + esc(k.name) + '</div>' +
      '<div class="ak-prefix"><code>' + esc(prefixLabel(k.key_prefix)) + '</code></div></div>' +
      '<button class="ak-btn danger" data-act="revoke">Revoke</button></div>' +
      '<div class="ak-meta">Created ' + esc(dateLabel(k.created_at)) + " · Last used " + esc(ago(k.last_used_at)) + "</div>" +
      "</div>";
  }

  function newKeyBox() {
    return '<div class="ak-card ak-newkey">' +
      '<div class="ak-newkey-title">Your new key' + (newKey.name ? ' — ' + esc(newKey.name) : "") + "</div>" +
      '<div class="ak-keyline"><code class="ak-keyraw">' + esc(newKey.raw) + "</code></div>" +
      '<div class="ak-row" style="margin-top:12px">' +
      '<button class="ak-btn" data-act="copy">' + (state.copied ? "Copied" : "Copy") + "</button>" +
      '<span class="ak-grow"></span>' +
      '<button class="ak-btn primary" data-act="saved">I saved my key</button></div>' +
      '<div class="ak-warn">This is the only time the full key is shown. Store it somewhere safe — you won\'t be able to see it again.</div>' +
      "</div>";
  }

  function bodyHtml() {
    var h = '<div class="ak-wrap">';
    if (newKey) h += newKeyBox();
    h += '<div class="ak-intro">Use these keys with the upcoming ai.spaincos.com API.</div>';
    h += '<div class="ak-row"><span class="ak-grow ak-usage"><strong>' + keys.length + "</strong> active " + (keys.length === 1 ? "key" : "keys") + "</span>" +
      (state.creating ? "" : '<button class="ak-btn primary" data-act="new"' + (state.busy ? " disabled" : "") + ">+ New key</button>") + "</div>";
    if (state.creating) h += '<div class="ak-card" id="akCreate"><div class="ak-form">' +
      '<input class="ak-input" data-f="name" placeholder="Key name (e.g. production server)" maxlength="120">' +
      '<div class="ak-row"><span class="ak-grow"></span>' +
      '<button class="ak-btn" data-act="cancel-create">Cancel</button>' +
      '<button class="ak-btn primary" data-act="save-create"' + (state.busy ? " disabled" : "") + ">Create key</button></div></div></div>";
    if (state.error) h += '<div class="ak-err">' + esc(state.error) + "</div>";
    if (!state.creating && !keys.length && !newKey) h += '<div class="ak-empty">No API keys yet. Create one to get started.</div>';
    else h += keys.map(keyCard).join("");
    return h + "</div>";
  }

  function render() {
    if (!root) return;
    var body = root.querySelector(".ak-body"), scroll = body ? body.scrollTop : 0;
    if (state.loading) body.innerHTML = '<div class="ak-msg">Connecting…</div>';
    else {
      var keep = {};
      body.querySelectorAll("#akCreate [data-f]").forEach(function (i) { keep[i.getAttribute("data-f")] = i.value; });
      body.innerHTML = bodyHtml();
      body.querySelectorAll("#akCreate [data-f]").forEach(function (i) { var k = i.getAttribute("data-f"); if (keep[k] != null) i.value = keep[k]; });
    }
    body.scrollTop = scroll;
  }

  function copyKey() {
    if (!newKey) return;
    var done = function () { state.copied = true; render(); setTimeout(function () { state.copied = false; if (root) render(); }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(newKey.raw).then(done, done);
    } else {
      try {
        var ta = document.createElement("textarea");
        ta.value = newKey.raw; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
      } catch (e) { /* noop */ }
      done();
    }
  }

  function onClick(ev) {
    var t = ev.target.closest("[data-act],.ak-x"); if (!t) return;
    if (t.classList.contains("ak-x")) return close();
    var act = t.dataset.act;
    var card = t.closest("[data-id]"), id = card && card.dataset.id;
    var k = id && keys.filter(function (x) { return x.id === id; })[0];
    if (act === "new") { state.creating = true; state.error = ""; render(); var i = root.querySelector("#akCreate .ak-input"); if (i) i.focus(); }
    else if (act === "cancel-create") { state.creating = false; render(); }
    else if (act === "save-create") {
      var input = root.querySelector("#akCreate .ak-input");
      var name = clean(input ? input.value : "").slice(0, 120);
      if (!name) { state.error = "Give the key a name so you can tell it apart later."; return render(); }
      state.error = ""; state.busy = true; render();
      api({ action: "create", name: name }).then(function (r) {
        newKey = { name: name, raw: String(r.key || "") };
        state.creating = false; state.busy = false;
        return refresh();
      }).catch(fail);
    }
    else if (act === "copy") copyKey();
    else if (act === "saved") { newKey = null; render(); }
    else if (act === "revoke" && k) {
      if (!window.confirm('Revoke key "' + k.name + '"? Anything using it will stop working immediately.')) return;
      state.busy = true; render();
      api({ action: "revoke", id: id }).then(function () { state.busy = false; return refresh(); }).catch(fail);
    }
  }

  function onKey(e) {
    if (!root) return;
    if (e.key === "Escape") return close();
    // keep focus inside the dialog while it's open
    if (e.key === "Tab") {
      var f = root.querySelectorAll("button, input, [tabindex]:not([tabindex='-1'])");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  }

  var lastFocus = null;
  function open() {
    if (root) return;
    lastFocus = document.activeElement;
    ensureCss();
    root = document.createElement("div");
    root.className = "ak-root";
    root.innerHTML = '<div class="ak-head"><h2 class="ak-title">API Keys</h2><span class="ak-grow"></span><button class="ak-x" aria-label="Close">×</button></div><div class="ak-body"></div>';
    (document.getElementById("moduleRoot") || document.body).appendChild(root);
    root.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "API Keys");
    state.loading = true; state.error = ""; state.creating = false; state.busy = false; newKey = null;
    render();
    var xb = root.querySelector(".ak-x"); if (xb) xb.focus();
    refresh();
  }
  function close() {
    if (!root) return;
    document.removeEventListener("keydown", onKey);
    root.remove(); root = null;
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }
  window.ApiKeysUI = { open: open, close: close };
})();
