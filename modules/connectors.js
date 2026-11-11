/* ConnectorsUI — Google (Gmail + Calendar) connect flow + in-chat Approve cards for email/calendar actions (F7 / F15).
   - ConnectorsUI.card()            -> DOM node for Settings > Connectors: status, Connect / Reconnect / Disconnect.
   - ConnectorsUI.renderActions(el, actions) -> Approve cards for x_actions returned by gateway-chat (send_email / create_event).
   Nothing is sent or created until the user presses Approve (trusted click only); tokens never reach the browser:
   the OAuth code is exchanged server-side by the `connectors` function and only status is returned here.
   All dynamic text is set with textContent (no innerHTML). */
(function (root) {
  "use strict";
  var status = null, busy = false, banner = null, hosts = [], pstat = {}, pbusy = {}, pbanner = {}, badges = [];

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function fnBase() { return (typeof GATEWAY !== "undefined" && GATEWAY) || ((typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL : "") + "/functions/v1"); }
  function session() {
    if (typeof sb === "undefined") return Promise.reject(new Error("Not signed in"));
    return sb.auth.getSession().then(function (r) { var s = r && r.data && r.data.session; if (!s) throw new Error("Not signed in — sign in again."); return s; });
  }
  function call(fn, body) {
    return session().then(function (s) {
      return fetch(fnBase() + "/" + fn, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.access_token }, body: JSON.stringify(body) });
    }).then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { d._http = res.status; return d; }); });
  }

  // ---------- Settings card ----------
  var SERVICES = [["gmail_read", "Read email"], ["gmail_send", "Send email (with your approval)"], ["calendar", "Calendar: read + create events"], ["drive", "Google Drive (read-only)"], ["sheets", "Google Sheets (read-only)"]];
  var PROVS = [
    { id: "dropbox", name: "Dropbox", logo: "D", kind: "oauth", keyLabel: "Dropbox access token", help: "Or paste a token: Dropbox App Console > your app > Settings > Generated access token (short-lived), or a full access token.", hosts: ["www.dropbox.com"], note: "Ask in chat: “list my Dropbox files”, “read /notes/todo.txt”." },
    { id: "slack", name: "Slack", logo: "S", kind: "oauth", keyLabel: "Slack token (xoxp- / xoxb-)", help: "Or paste a Slack user token (xoxp-) or bot token (xoxb-) from your app’s OAuth & Permissions page.", hosts: ["slack.com"], note: "Ask in chat: “search Slack for the vendor invoice”. Uses your own Slack user token, read-only in chat." },
    { id: "github", name: "GitHub", logo: "H", kind: "oauth", keyLabel: "GitHub fine-grained token", help: "Or paste a fine-grained personal access token, read-only (github.com/settings/personal-access-tokens: Contents, Issues, Pull requests, Metadata = Read).", hosts: ["github.com"], note: "Ask in chat: “open issues in my repo”, “search my code for fetchUser”." },
    { id: "render", name: "Render", logo: "R", kind: "key", keyLabel: "Render API key", help: "Render dashboard > Account Settings > API Keys > Create API Key.", note: "Ask in chat: “what’s the deploy status of my Render services”." },
    { id: "supabase", name: "Supabase", logo: "B", kind: "key", keyLabel: "Supabase access token", help: "supabase.com/dashboard/account/tokens > Generate new token.", note: "Ask in chat: “list my Supabase projects”, “is my project healthy”." }
  ];
  // ---------- Connection watch: detect accidental disconnects ----------
  // Last-known-good connection map + deliberate-drop markers live in localStorage.
  function watchGet(k, d) { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } }
  function watchSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function connectedMap() {
    var m = {};
    if (pstat.google && pstat.google.connected) m.google = 1;
    PROVS.forEach(function (P) { if (pstat[P.id] && pstat[P.id].connected) m[P.id] = 1; });
    return m;
  }
  function markDeliberate(ids) { var d = watchGet("ai_conn_deliberate", {}); ids.forEach(function (id) { d[id] = Date.now(); }); watchSet("ai_conn_deliberate", d); }
  var activeDrop = null;
  function checkWatch() {
    var prev = watchGet("ai_conn_watch", {}), now = connectedMap(), deliberate = watchGet("ai_conn_deliberate", {}), alerted = watchGet("ai_conn_alerted", {});
    var dropped = [], restored = false;
    Object.keys(prev).forEach(function (id) { if (prev[id] && !now[id] && !(deliberate[id] && Date.now() - deliberate[id] < 60000) && !alerted[id]) dropped.push(id); });
    Object.keys(alerted).forEach(function (id) { if (now[id]) { delete alerted[id]; delete deliberate[id]; restored = true; } });
    watchSet("ai_conn_watch", now); watchSet("ai_conn_alerted", alerted); watchSet("ai_conn_deliberate", deliberate);
    if (dropped.length) { dropped.forEach(function (id) { alerted[id] = 1; }); watchSet("ai_conn_alerted", alerted); activeDrop = dropped; }
    else if (restored) activeDrop = null;
    render();
  }
  function droppedAlert(ids) { activeDrop = ids; render(); }
  function dropCard(ids) {
    var c = el("div", "cn-card cn-drop");
    c.setAttribute("role", "alert");
    c.appendChild(el("div", "cn-title", "Connection lost"));
    var names = ids.map(function (id) { return id === "google" ? "Google" : (PROVS.find(function (P) { return P.id === id; }) || {}).name || id; });
    c.appendChild(el("div", "cn-sub", names.join(", ") + (ids.length > 1 ? " got" : " got") + " disconnected. Nothing you asked for was lost — reconnect below."));
    var acts = el("div", "cn-actions");
    var ok = el("button", "stg-btn", "Open Settings to reconnect");
    ok.type = "button";
    ok.addEventListener("click", function () { if (root.SettingsUI && root.SettingsUI.open) root.SettingsUI.open("connectors"); });
    acts.appendChild(ok);
    c.appendChild(acts);
    return c;
  }
  function loadAll() {
    return call("connectors", { action: "status", provider: "all" }).then(function (d) {
      if (d && d.providers) { pstat = d.providers; if (d.providers.google && !d.providers.google.error) status = d.providers.google; }
      render(); notifyBadges(); checkWatch();
    }).catch(function () { render(); notifyBadges(); });
  }
  function notifyBadges() { badges = badges.filter(function (b) { return b.node.isConnected; }); badges.forEach(function (b) { paintBadge(b); }); }
  // Settings-list badge: reflects REAL connection status (no fake toggles).
  var BADGE_MAP = { "gmail-gcal": ["google", null], "google-drive": ["google", "drive"], "google-sheets": ["google", "sheets"], dropbox: ["dropbox"], slack: ["slack"], github: ["github"], render: ["render"], supabase: ["supabase"] };
  function paintBadge(b) {
    var m = b.map, st = pstat[m[0]], on = false, soon = false;
    if (!st) { b.node.textContent = "Checking…"; b.node.className = "stg-conn-soon"; return; }
    if (m[0] === "google") on = !!st.connected && (!m[1] || !!(st.services && st.services[m[1]]));
    else { on = !!st.connected; soon = st.configured === false; }
    b.node.textContent = on ? "Connected" : soon ? "Coming soon" : "Not connected";
    b.node.className = "stg-conn-soon" + (on ? " on" : "");
    b.node.title = soon ? "Needs app credentials on the server." : "";
  }
  function badge(settingsId) {
    var m = BADGE_MAP[settingsId]; if (!m) return null;
    var n = el("span", "stg-conn-soon", "Checking…"); var b = { node: n, map: m }; badges.push(b); paintBadge(b);
    if (!Object.keys(pstat).length) loadAll();
    return n;
  }
  function pcall(id, body) { return call("connectors", Object.assign({ provider: id }, body)); }
  function pconnect(P) {
    if (pbusy[P.id]) return; pbusy[P.id] = true; render();
    pcall(P.id, { action: "start" }).then(function (d) {
      var u; try { u = new URL(d.url); } catch (e) { u = null; }
      if (!d.url || !u || u.protocol !== "https:" || P.hosts.indexOf(u.hostname) < 0) { pbusy[P.id] = false; pbanner[P.id] = { msg: d.error || "Unexpected connect URL; aborting.", kind: "err" }; render(); return; }
      root.location.href = u.href;
    }).catch(function (e) { pbusy[P.id] = false; pbanner[P.id] = { msg: e.message, kind: "err" }; render(); });
  }
  function pdisconnect(P) {
    if (pbusy[P.id] || !root.confirm("Disconnect " + P.name + "? The stored credential is deleted.")) return;
    pbusy[P.id] = true; render();
    markDeliberate([P.id]);
    pcall(P.id, { action: "disconnect" }).then(function (d) { pbusy[P.id] = false; if (!d.error) pstat[P.id] = d; pbanner[P.id] = { msg: d.error || P.name + " disconnected.", kind: d.error ? "err" : "ok" }; render(); notifyBadges(); checkWatch(); }).catch(function (e) { pbusy[P.id] = false; pbanner[P.id] = { msg: e.message, kind: "err" }; render(); });
  }
  function psetkey(P, key) {
    if (pbusy[P.id]) return; pbusy[P.id] = true; render();
    pcall(P.id, { action: "setkey", key: key }).then(function (d) { pbusy[P.id] = false; if (d.error) pbanner[P.id] = { msg: d.error, kind: "err" }; else { pstat[P.id] = d; pbanner[P.id] = { msg: P.name + " connected.", kind: "ok" }; } render(); notifyBadges(); }).catch(function (e) { pbusy[P.id] = false; pbanner[P.id] = { msg: e.message, kind: "err" }; render(); });
  }
  function toggle(checked, onChange, label) {
    var wrap = el("label", "stg-switch"); wrap.title = label || "";
    var input = el("input"); input.type = "checkbox"; input.setAttribute("role", "switch"); input.checked = !!checked;
    input.addEventListener("change", function () { onChange(input.checked); });
    wrap.appendChild(input); wrap.appendChild(el("span", "stg-track"));
    return wrap;
  }
  function provCard(P) {
    var st = pstat[P.id] || null, connected = !!(st && st.connected), unconf = !!(st && st.configured === false), busyP = !!pbusy[P.id];
    var c = el("div", "cn-card"), head = el("div", "cn-head");
    var logo = el("div", "cn-logo", P.logo); logo.setAttribute("aria-hidden", "true");
    var t = el("div", "cn-titles"); t.appendChild(el("div", "cn-title", P.name));
    var sub = !st ? "Checking connection…" : connected ? "Connected" + (st.account ? " — " + st.account : "") : unconf ? "Coming soon" : "Not connected";
    var subEl = el("div", "cn-sub" + (connected ? " on" : ""), sub); subEl.setAttribute("role", "status"); t.appendChild(subEl);
    head.appendChild(logo); head.appendChild(t);
    var acts = el("div", "cn-actions");
    // Toggle switch: ON = connected. Turning ON starts OAuth (or focuses the key box); turning OFF disconnects (with confirm).
    var tg = toggle(connected, function (on) {
      if (on) { if (P.kind === "oauth" && !unconf) pconnect(P); else if (keyInput) keyInput.focus(); }
      else if (connected) pdisconnect(P);
    }, "Connect / disconnect " + P.name);
    if (!st || unconf) tg.style.opacity = "0.4";
    acts.appendChild(tg);
    if (st && P.kind === "oauth" && !unconf) {
      var b = el("button", "stg-btn" + (connected ? " ghost" : ""), busyP ? "Working…" : connected ? "Reconnect" : "Connect " + P.name);
      b.type = "button"; b.disabled = busyP; b.addEventListener("click", function () { pconnect(P); }); acts.appendChild(b);
    }
    if (connected) { var d = el("button", "stg-btn ghost cn-danger", "Disconnect"); d.type = "button"; d.disabled = busyP; d.addEventListener("click", function () { pdisconnect(P); }); acts.appendChild(d); }
    head.appendChild(acts); c.appendChild(head);
    var keyInput = null;
    if (st && P.keyLabel && !connected) {
      var row = el("div", "cn-act-btns"), inp = el("input", "stg-input"); inp.type = "password"; inp.autocomplete = "off"; inp.spellcheck = false;
      inp.placeholder = "Paste " + P.keyLabel; inp.setAttribute("aria-label", P.keyLabel);
      var sv = el("button", "stg-btn", busyP ? "Checking…" : (P.kind === "oauth" ? "Save token" : "Save key")); sv.type = "button"; sv.disabled = busyP;
      sv.addEventListener("click", function () { var v = inp.value.trim(); inp.value = ""; if (v) psetkey(P, v); });
      keyInput = inp;
      row.appendChild(inp); row.appendChild(sv); c.appendChild(row); c.appendChild(el("div", "cn-note", P.help));
    }
    if (unconf && !P.keyLabel) c.appendChild(el("div", "cn-msg warn", "Not available yet: the " + P.name + " app credentials have not been added to the server."));
    if (st && st.error) c.appendChild(el("div", "cn-msg err", st.error));
    var bn = pbanner[P.id]; if (bn) { var m = el("div", "cn-msg " + bn.kind, bn.msg); m.setAttribute("role", "alert"); c.appendChild(m); }
    var ul = el("ul", "cn-list");
    ((st && st.permissions) || []).forEach(function (txt) { var li = el("li", "cn-li" + (connected ? " on" : "")); li.appendChild(el("span", "cn-dot")); li.appendChild(el("span", "cn-li-t", txt)); li.appendChild(el("span", "cn-li-s", connected ? "Granted" : "Off")); ul.appendChild(li); });
    c.appendChild(ul); c.appendChild(el("p", "cn-note", P.note + " Credentials are encrypted on the server and never sent to your browser."));
    return c;
  }

  function loadStatus() { return loadAll().then(function () { if (!status) { status = { connected: false }; render(); } }); }
  function say(msg, kind) { banner = msg ? { msg: msg, kind: kind || "info" } : null; render(); }

  function connect() {
    if (busy) return; busy = true; render();
    call("connectors", { action: "start", services: ["gmail", "calendar", "drive", "sheets"] }).then(function (d) {
      if (!d.url) { busy = false; say(d.error || "Could not start the Google connection.", "err"); return; }
      // Only ever navigate to Google's own consent endpoint.
      var u; try { u = new URL(d.url); } catch (e) { u = null; }
      if (!u || u.protocol !== "https:" || u.hostname !== "accounts.google.com") { busy = false; say("Unexpected connect URL; aborting.", "err"); return; }
      root.location.href = u.href;
    }).catch(function (e) { busy = false; say(e.message, "err"); });
  }
  function disconnect() {
    if (busy) return;
    if (!root.confirm("Disconnect Google? The assistant will no longer be able to read your email or calendar, and the stored token is deleted and revoked.")) return;
    busy = true; render();
    markDeliberate(["google"]);
    call("connectors", { action: "disconnect" }).then(function (d) { busy = false; status = d && !d.error ? d : status; say(d.error || "Google disconnected.", d.error ? "err" : "ok"); }).catch(function (e) { busy = false; say(e.message, "err"); });
  }

  function build() {
    var c = el("div", "cn-card");
    var head = el("div", "cn-head");
    var logo = el("div", "cn-logo", "G"); logo.setAttribute("aria-hidden", "true");
    var t = el("div", "cn-titles");
    t.appendChild(el("div", "cn-title", "Google — Gmail, Calendar, Drive and Sheets"));
    var connected = status && status.connected;
    var sub = !status ? "Checking connection…" : connected ? ("Connected" + (status.email ? " as " + status.email : "")) : "Not connected";
    var subEl = el("div", "cn-sub" + (connected ? " on" : ""), sub); subEl.setAttribute("role", "status");
    t.appendChild(subEl);
    head.appendChild(logo); head.appendChild(t);
    var acts = el("div", "cn-actions");
    if (status) {
      var gt = toggle(connected, function (on) { if (on) connect(); else if (connected) disconnect(); }, "Connect / disconnect Google");
      acts.appendChild(gt);
      var b = el("button", "stg-btn" + (connected ? " ghost" : ""), busy ? "Working…" : connected ? "Reconnect" : "Connect Google");
      b.type = "button"; b.disabled = busy; b.addEventListener("click", connect); acts.appendChild(b);
      if (connected) { var d = el("button", "stg-btn ghost cn-danger", "Disconnect"); d.type = "button"; d.disabled = busy; d.addEventListener("click", disconnect); acts.appendChild(d); }
    }
    head.appendChild(acts); c.appendChild(head);
    if (status && status.configured && !status.configured.oauth_client) c.appendChild(el("div", "cn-msg err", "Google sign-in credentials are not configured on the server yet."));
    if (status && status.error) c.appendChild(el("div", "cn-msg err", status.error));
    if (banner) { var m = el("div", "cn-msg " + banner.kind, banner.msg); m.setAttribute("role", "alert"); c.appendChild(m); }
    var ul = el("ul", "cn-list");
    SERVICES.forEach(function (s) {
      var on = !!(connected && status.services && status.services[s[0]]);
      var li = el("li", "cn-li" + (on ? " on" : ""));
      li.appendChild(el("span", "cn-dot")); li.appendChild(el("span", "cn-li-t", s[1])); li.appendChild(el("span", "cn-li-s", on ? "Granted" : connected ? "Not granted" : "Off"));
      ul.appendChild(li);
    });
    c.appendChild(ul);
    c.appendChild(el("p", "cn-note", "Ask in chat: “what’s on my calendar Friday”, “find the email from my landlord”, “find the lease spreadsheet in my Drive”. If you connected Google earlier, press Reconnect once to add Drive and Sheets. Emails and events are always shown as a preview and only sent or created after you press Approve. Your Google token is encrypted on the server and never sent to your browser."));
    return c;
  }
  function render() { hosts = hosts.filter(function (h) { return h.isConnected; }); hosts.forEach(function (h) { h.textContent = ""; if (activeDrop) h.appendChild(dropCard(activeDrop)); h.appendChild(build()); PROVS.forEach(function (P) { h.appendChild(provCard(P)); }); }); }
  function card() {
    var h = el("div", "cn-host"); hosts.push(h); h.appendChild(build()); PROVS.forEach(function (P) { h.appendChild(provCard(P)); });
    loadStatus();
    return h;
  }

  // ---------- OAuth return (…/#connector_code=…&connector_state=… or #connector_error=…) ----------
  function handleReturn() {
    var h = root.location.hash || ""; if (h.indexOf("connector_") < 0) return;
    var p = new URLSearchParams(h.replace(/^#/, ""));
    var code = p.get("connector_code"), state = p.get("connector_state"), err = p.get("connector_error");
    try { root.history.replaceState(null, "", root.location.pathname + root.location.search); } catch (e) {}   // drop the one-time code from the URL immediately
    function openPane() { if (root.SettingsUI && root.SettingsUI.open) root.SettingsUI.open("connectors"); }
    if (err) { banner = { msg: err === "access_denied" ? "Access was not granted." : "Connection failed (" + err.replace(/[^a-z_]/gi, "").slice(0, 40) + ").", kind: "err" }; setTimeout(openPane, 400); return; }
    if (!code || !state) return;
    var tries = 0;
    (function go() {
      if (typeof sb === "undefined" || ++tries > 40) { banner = { msg: "Sign in, then connect again.", kind: "err" }; return openPane(); }
      session().then(function () {
        return call("connectors", { action: "exchange", code: code, state: state });
      }).then(function (d) {
        if (d.error) banner = { msg: d.error, kind: "err" }; else { var nm = d.provider ? d.provider.charAt(0).toUpperCase() + d.provider.slice(1) : "Google"; if (d.provider) pstat[d.provider] = d; else status = d; banner = { msg: nm + " connected" + (d.email || d.account ? " as " + (d.email || d.account) : "") + ".", kind: "ok" }; }
        openPane();
      }).catch(function () { setTimeout(go, 500); });
    })();
  }

  // ---------- Approve cards for assistant-prepared actions ----------
  var DONE = { send_email: "Sent.", create_event: "Event created." };
  var APPROVE = { send_email: "Approve & send now", create_event: "Approve & create event" };
  function actionCard(a) {
    var pv = a.preview || {}, c = el("div", "cn-act");
    c.appendChild(el("div", "cn-act-title", pv.title || (a.kind === "send_email" ? "Send email" : "Create calendar event")));
    var f = el("div", "cn-act-fields");
    Object.keys(pv.fields || {}).forEach(function (k) {
      var row = el("div", "cn-act-row"); row.appendChild(el("div", "cn-act-k", k));
      row.appendChild(el("div", "cn-act-v" + (k === "Body" || k === "Description" ? " pre" : ""), String(pv.fields[k])));
      f.appendChild(row);
    });
    c.appendChild(f);
    if (pv.warning) c.appendChild(el("div", "cn-msg warn", pv.warning));
    var msg = el("div", "cn-act-msg"); msg.setAttribute("role", "status");
    var ok = el("button", "stg-btn cn-approve", APPROVE[a.kind] || "Approve"), no = el("button", "stg-btn ghost", "Reject");
    ok.type = no.type = "button";
    var row = el("div", "cn-act-btns"); row.appendChild(ok); row.appendChild(no);
    ok.addEventListener("click", function (e) {
      if (!e.isTrusted) return;   // never honor programmatic clicks
      ok.disabled = no.disabled = true; ok.textContent = "Working…"; msg.textContent = "";
      call("workspace-actions", { action: "execute", kind: a.kind, payload: a.payload, approval_token: a.approval_token, approved: true }).then(function (d) {
        if (d.executed) {
          row.remove(); msg.className = "cn-act-msg ok"; msg.textContent = DONE[a.kind] || "Done.";
          if (d.link && /^https:\/\//.test(d.link)) { var l = el("a", "cn-link", " Open"); l.href = d.link; l.target = "_blank"; l.rel = "noopener noreferrer"; msg.appendChild(l); }
        } else {
          ok.textContent = APPROVE[a.kind] || "Approve"; no.disabled = false; msg.className = "cn-act-msg err";
          msg.textContent = /expired|already used/i.test(d.error || "") ? "This approval expired. Ask again to get a fresh preview." : (d.error || "Failed.");
          if (/expired|already used|content changed/i.test(d.error || "")) ok.disabled = true; else ok.disabled = false;
        }
      }).catch(function (er) { ok.disabled = no.disabled = false; ok.textContent = APPROVE[a.kind] || "Approve"; msg.className = "cn-act-msg err"; msg.textContent = er.message; });
    });
    no.addEventListener("click", function () { row.remove(); msg.className = "cn-act-msg"; msg.textContent = "Rejected — nothing was " + (a.kind === "send_email" ? "sent." : "created."); });
    c.appendChild(row); c.appendChild(msg);
    return c;
  }
  function renderActions(container, actions) {
    if (!container || !Array.isArray(actions) || !actions.length) return;
    var wrap = el("div", "cn-acts");
    actions.slice(0, 5).forEach(function (a) { if (a && (a.kind === "send_email" || a.kind === "create_event") && a.approval_token) wrap.appendChild(actionCard(a)); });
    if (wrap.childNodes.length) container.appendChild(wrap);
  }

  root.ConnectorsUI = { card: card, badge: badge, renderActions: renderActions, refresh: loadStatus, _handleReturn: handleReturn };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", handleReturn); else handleReturn();
})(window);
