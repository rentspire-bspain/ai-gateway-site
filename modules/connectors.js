/* ConnectorsUI — Google (Gmail + Calendar) connect flow + in-chat Approve cards for email/calendar actions (F7 / F15).
   - ConnectorsUI.card()            -> DOM node for Settings > Connectors: status, Connect / Reconnect / Disconnect.
   - ConnectorsUI.renderActions(el, actions) -> Approve cards for x_actions returned by gateway-chat (send_email / create_event).
   Nothing is sent or created until the user presses Approve (trusted click only); tokens never reach the browser:
   the OAuth code is exchanged server-side by the `connectors` function and only status is returned here.
   All dynamic text is set with textContent (no innerHTML). */
(function (root) {
  "use strict";
  var status = null, busy = false, banner = null, hosts = [];

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
  var SERVICES = [["gmail_read", "Read email"], ["gmail_send", "Send email (with your approval)"], ["calendar", "Calendar: read + create events"]];

  function loadStatus() {
    return call("connectors", { action: "status" }).then(function (d) { status = d && !d.error ? d : { connected: false, error: d && d.error }; render(); }).catch(function (e) { status = { connected: false, error: e.message }; render(); });
  }
  function say(msg, kind) { banner = msg ? { msg: msg, kind: kind || "info" } : null; render(); }

  function connect() {
    if (busy) return; busy = true; render();
    call("connectors", { action: "start", services: ["gmail", "calendar"] }).then(function (d) {
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
    call("connectors", { action: "disconnect" }).then(function (d) { busy = false; status = d && !d.error ? d : status; say(d.error || "Google disconnected.", d.error ? "err" : "ok"); }).catch(function (e) { busy = false; say(e.message, "err"); });
  }

  function build() {
    var c = el("div", "cn-card");
    var head = el("div", "cn-head");
    var logo = el("div", "cn-logo", "G"); logo.setAttribute("aria-hidden", "true");
    var t = el("div", "cn-titles");
    t.appendChild(el("div", "cn-title", "Google — Gmail and Calendar"));
    var connected = status && status.connected;
    var sub = !status ? "Checking connection…" : connected ? ("Connected" + (status.email ? " as " + status.email : "")) : "Not connected";
    var subEl = el("div", "cn-sub" + (connected ? " on" : ""), sub); subEl.setAttribute("role", "status");
    t.appendChild(subEl);
    head.appendChild(logo); head.appendChild(t);
    var acts = el("div", "cn-actions");
    if (status) {
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
    c.appendChild(el("p", "cn-note", "Ask in chat: “what’s on my calendar Friday”, “find the email from my landlord”, “email John about the lease”. Emails and events are always shown as a preview and only sent or created after you press Approve. Your Google token is encrypted on the server and never sent to your browser."));
    return c;
  }
  function render() { hosts = hosts.filter(function (h) { return h.isConnected; }); hosts.forEach(function (h) { h.textContent = ""; h.appendChild(build()); }); }
  function card() {
    var h = el("div", "cn-host"); hosts.push(h); h.appendChild(build());
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
    if (err) { banner = { msg: err === "access_denied" ? "Google access was not granted." : "Google connection failed (" + err.replace(/[^a-z_]/gi, "").slice(0, 40) + ").", kind: "err" }; setTimeout(openPane, 400); return; }
    if (!code || !state) return;
    var tries = 0;
    (function go() {
      if (typeof sb === "undefined" || ++tries > 40) { banner = { msg: "Sign in, then connect Google again.", kind: "err" }; return openPane(); }
      session().then(function () {
        return call("connectors", { action: "exchange", code: code, state: state });
      }).then(function (d) {
        if (d.error) banner = { msg: d.error, kind: "err" }; else { status = d; banner = { msg: "Google connected" + (d.email ? " as " + d.email : "") + ".", kind: "ok" }; }
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

  root.ConnectorsUI = { card: card, renderActions: renderActions, refresh: loadStatus, _handleReturn: handleReturn };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", handleReturn); else handleReturn();
})(window);
