/* ConnectorsUI — Google (Gmail + Calendar + Drive + Sheets) + Slack, Dropbox, Outlook, Box, GitHub,
   Render, Supabase connect flows + in-chat Approve cards for email/calendar actions (F7 / F15 / 34c / 34e).
   - ConnectorsUI.card()            -> DOM node for Settings > Connectors: status, Connect / Reconnect / Disconnect,
                                       or honest "Owner setup required" with direct OAuth app registration URLs.
   - ConnectorsUI.renderActions(el, actions) -> Approve cards for x_actions returned by gateway-chat (send_email / create_event).
   Nothing is sent or created until the user presses Approve (trusted click only); tokens never reach the browser:
   OAuth client_id / redirect_uri config comes from window.CONNECTOR_OAUTH or /api/oauth-config (fetched on panel open,
   falling back to null), and OAuth codes are exchanged server-side.
   All dynamic text is set with textContent (no innerHTML). */
(function (root) {
  "use strict";
  var status = null, busy = false, banner = null, hosts = [], pstat = {}, pbusy = {}, pbanner = {}, badges = [];
  var statusLoaded = false, oauthRemoteCfg = null, seenCallbackStates = {};

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

  // ---------- Generic OAuth config & state-machine bridge (modules/connectors.config.js) ----------
  var FALLBACK_REG_URLS = {
    slack: "https://api.slack.com/apps",
    dropbox: "https://www.dropbox.com/developers/apps",
    outlook: "https://entra.microsoft.com",
    box: "https://app.box.com/developers/console",
    google: "https://console.cloud.google.com/apis/credentials",
    github: "https://github.com/settings/developers"
  };

  var cfgLib = (root && root.ConnectorOAuthConfig) || null;
  var oauthMachine = cfgLib ? cfgLib.createOAuthStateMachine() : null;

  function activeOAuthConfig() {
    var winCfg = (root && root.CONNECTOR_OAUTH) || null;
    if (cfgLib) return cfgLib.mergeOAuthConfigs(oauthRemoteCfg, winCfg);
    return winCfg || oauthRemoteCfg || null;
  }

  function syncMachineConfig() {
    if (!oauthMachine) return;
    oauthMachine.setOAuthConfig(activeOAuthConfig());
    oauthMachine.setStatusLoaded(statusLoaded);
    if (status) oauthMachine.setServerStatus("google", status);
    Object.keys(pstat).forEach(function (k) { oauthMachine.setServerStatus(k, pstat[k]); });
  }

  function loadOAuthConfig() {
    if (cfgLib && cfgLib.fetchOAuthConfig) {
      return cfgLib.fetchOAuthConfig({
        fetch: typeof fetch === "function" ? fetch : null,
        windowConfig: (root && root.CONNECTOR_OAUTH) || null
      }).then(function (merged) {
        oauthRemoteCfg = merged;
        syncMachineConfig();
        render();
        notifyBadges();
        return merged;
      });
    }
    return Promise.resolve().then(function () {
      if (typeof fetch !== "function") return null;
      return fetch("/api/oauth-config", { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
    }).then(function (res) {
      if (!res || !res.ok) return null;
      return res.json().catch(function () { return null; });
    }).then(function (data) {
      oauthRemoteCfg = (data && typeof data === "object") ? data : null;
      render();
      notifyBadges();
      return activeOAuthConfig();
    }).catch(function () {
      return activeOAuthConfig();
    });
  }

  function getProviderOAuthState(id, serverSt) {
    syncMachineConfig();
    if (oauthMachine) {
      if (serverSt !== undefined) oauthMachine.setServerStatus(id, serverSt);
      var derived = oauthMachine.getState(id);
      if (derived) return derived;
    }
    var connected = !!(serverSt && serverSt.connected);
    var hasServer = id === "google"
      ? !!(serverSt && serverSt.configured && (serverSt.configured === true || serverSt.configured.oauth_client === true))
      : !!(serverSt && serverSt.configured === true);
    var raw = activeOAuthConfig();
    var entry = raw && ((raw.providers && raw.providers[id]) || raw[id]);
    var cid = typeof entry === "string" ? entry : (entry && (entry.clientId || entry.client_id)) || "";
    var hasClient = !!(cid && String(cid).trim());
    var hasCfg = hasClient || hasServer;
    var regUrl = FALLBACK_REG_URLS[id] || "";
    if (connected) return { provider: id, state: "connected", hasConfig: true, hasClientConfig: hasClient, hasServerConfig: hasServer, canConnect: true, buttonLabel: "Reconnect", subLabel: "Connected", badgeLabel: "Connected", registrationUrl: regUrl };
    if (!statusLoaded && !serverSt && !hasClient) return { provider: id, state: "checking", hasConfig: false, hasClientConfig: false, hasServerConfig: false, canConnect: false, buttonLabel: "Checking…", subLabel: "Checking connection…", badgeLabel: "Checking…", registrationUrl: regUrl };
    if (!hasCfg) return { provider: id, state: "owner_setup_required", hasConfig: false, hasClientConfig: false, hasServerConfig: false, canConnect: false, buttonLabel: "Owner setup required", subLabel: "Owner setup required", badgeLabel: "Owner setup required", registrationUrl: regUrl };
    return { provider: id, state: "ready", hasConfig: true, hasClientConfig: hasClient, hasServerConfig: hasServer, canConnect: true, buttonLabel: "Connect " + (id.charAt(0).toUpperCase() + id.slice(1)), subLabel: "Not connected", badgeLabel: "Not connected", registrationUrl: regUrl };
  }

  // ---------- Settings cards ----------
  var SERVICES = [["gmail_read", "Read email"], ["gmail_send", "Send email (with your approval)"], ["calendar", "Calendar: read + create events"], ["drive", "Google Drive (read-only)"], ["sheets", "Google Sheets (read-only)"]];
  var PROVS = [
    {
      id: "slack", name: "Slack", logo: "S", kind: "oauth",
      registrationUrl: "https://api.slack.com/apps",
      keyLabel: "Slack token (xoxp- / xoxb-)",
      help: "Or paste a Slack user token (xoxp-) or bot token (xoxb-) from your app’s OAuth & Permissions page.",
      hosts: ["slack.com"],
      permissions: ["Search messages", "Read channel history", "Post messages (user token; only with your request)"],
      note: "Ask in chat: “search Slack for the vendor invoice”. Uses your own Slack user token, read-only in chat."
    },
    {
      id: "dropbox", name: "Dropbox", logo: "D", kind: "oauth",
      registrationUrl: "https://www.dropbox.com/developers/apps",
      keyLabel: "Dropbox access token",
      help: "Or paste a token: Dropbox App Console > your app > Settings > Generated access token (short-lived), or a full access token.",
      hosts: ["www.dropbox.com", "dropbox.com"],
      permissions: ["List files and folders", "Read file contents (text)"],
      note: "Ask in chat: “list my Dropbox files”, “read /notes/todo.txt”."
    },
    {
      id: "outlook", name: "Outlook", logo: "O", kind: "oauth",
      registrationUrl: "https://entra.microsoft.com",
      hosts: ["login.microsoftonline.com"],
      permissions: ["Read mail (Mail.Read)", "Read calendar events (Calendars.Read)"],
      note: "Ask in chat: “summarize unread Outlook messages”, “what’s on my Outlook calendar today”."
    },
    {
      id: "box", name: "Box", logo: "X", kind: "oauth",
      registrationUrl: "https://app.box.com/developers/console",
      hosts: ["app.box.com", "account.box.com"],
      permissions: ["List files and folders", "Read document contents"],
      note: "Ask in chat: “find the Q3 report in Box”, “list folders in my Box account”."
    },
    {
      id: "github", name: "GitHub", logo: "H", kind: "oauth",
      registrationUrl: "https://github.com/settings/developers",
      keyLabel: "GitHub fine-grained token",
      help: "Or paste a fine-grained personal access token, read-only (github.com/settings/personal-access-tokens: Contents, Issues, Pull requests, Metadata = Read).",
      hosts: ["github.com"],
      permissions: ["Search code, issues and repos", "Read issues and pull requests", "Private repo read access (repo scope)"],
      note: "Ask in chat: “open issues in my repo”, “search my code for fetchUser”."
    },
    {
      id: "render", name: "Render", logo: "R", kind: "key",
      keyLabel: "Render API key",
      help: "Render dashboard > Account Settings > API Keys > Create API Key.",
      permissions: ["List services", "Deploy status", "Service events/logs"],
      note: "Ask in chat: “what’s the deploy status of my Render services”."
    },
    {
      id: "supabase", name: "Supabase", logo: "B", kind: "key",
      keyLabel: "Supabase access token",
      help: "supabase.com/dashboard/account/tokens > Generate new token.",
      permissions: ["List projects", "Project health"],
      note: "Ask in chat: “list my Supabase projects”, “is my project healthy”."
    }
  ];

  // ---------- Connection watch: detect accidental disconnects ----------
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
  function dropCard(ids) {
    var c = el("div", "cn-card cn-drop");
    c.setAttribute("role", "alert");
    c.appendChild(el("div", "cn-title", "Connection lost"));
    var names = ids.map(function (id) { return id === "google" ? "Google" : (PROVS.find(function (P) { return P.id === id; }) || {}).name || id; });
    c.appendChild(el("div", "cn-sub", names.join(", ") + " got disconnected. Nothing you asked for was lost — reconnect below."));
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
      statusLoaded = true;
      if (d && d.providers) { pstat = d.providers; if (d.providers.google && !d.providers.google.error) status = d.providers.google; }
      syncMachineConfig();
      render(); notifyBadges(); checkWatch();
    }).catch(function () {
      statusLoaded = true;
      syncMachineConfig();
      render(); notifyBadges();
    });
  }
  function notifyBadges() { badges = badges.filter(function (b) { return b.node.isConnected; }); badges.forEach(function (b) { paintBadge(b); }); }

  // Settings-list badge: reflects REAL connection / setup status (no fake toggles).
  var BADGE_MAP = {
    "gmail-gcal": ["google", null],
    "google-drive": ["google", "drive"],
    "google-sheets": ["google", "sheets"],
    dropbox: ["dropbox"],
    slack: ["slack"],
    outlook: ["outlook"],
    box: ["box"],
    github: ["github"],
    render: ["render"],
    supabase: ["supabase"]
  };
  function paintBadge(b) {
    var m = b.map, id = m[0], st = id === "google" ? (status || pstat.google) : pstat[id];
    if (id === "google") {
      var gState = getProviderOAuthState("google", st);
      if (gState.state === "checking") { b.node.textContent = "Checking…"; b.node.className = "stg-conn-soon"; return; }
      var gOn = !!(st && st.connected && (!m[1] || !!(st.services && st.services[m[1]])));
      b.node.textContent = gOn ? "Connected" : gState.badgeLabel;
      b.node.className = "stg-conn-soon" + (gOn ? " on" : "");
      b.node.title = gState.state === "owner_setup_required" ? ("Register OAuth app: " + gState.registrationUrl) : "";
      return;
    }
    var P = PROVS.find(function (x) { return x.id === id; });
    if (P && P.kind === "oauth") {
      var oState = getProviderOAuthState(id, st);
      var isOn = oState.state === "connected";
      b.node.textContent = oState.badgeLabel;
      b.node.className = "stg-conn-soon" + (isOn ? " on" : "");
      b.node.title = oState.state === "owner_setup_required" ? ("Owner setup required: " + oState.registrationUrl) : "";
      return;
    }
    if (!st && !statusLoaded) { b.node.textContent = "Checking…"; b.node.className = "stg-conn-soon"; return; }
    var kOn = !!(st && st.connected);
    var kSoon = !!(st && st.configured === false);
    b.node.textContent = kOn ? "Connected" : kSoon ? "Owner setup required" : "Not connected";
    b.node.className = "stg-conn-soon" + (kOn ? " on" : "");
    b.node.title = kSoon ? "Needs app credentials on the server." : "";
  }
  function badge(settingsId) {
    var m = BADGE_MAP[settingsId]; if (!m) return null;
    var n = el("span", "stg-conn-soon", "Checking…"); var b = { node: n, map: m }; badges.push(b); paintBadge(b);
    if (!statusLoaded && !Object.keys(pstat).length) { loadOAuthConfig(); loadAll(); }
    return n;
  }

  function copyRegistrationUrl(url, btn, providerName) {
    function markCopied() {
      if (!btn) return;
      var orig = btn.getAttribute("data-orig-label") || btn.textContent;
      btn.setAttribute("data-orig-label", orig);
      btn.textContent = "Copied";
      setTimeout(function () { if (btn.isConnected) btn.textContent = orig; }, 1800);
    }
    try {
      if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === "function") {
        root.navigator.clipboard.writeText(url).then(markCopied).catch(function () {});
        return;
      }
    } catch (e) {}
    try {
      var ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      markCopied();
    } catch (e) {
      if (providerName) pbanner[providerName] = { msg: "Register OAuth app at " + url, kind: "info" };
      render();
    }
  }

  function ownerSetupRow(providerName, regUrl) {
    var box = el("div", "cn-setup");
    box.appendChild(el("span", "cn-setup-label", "Register OAuth app:"));
    var link = el("a", "cn-reg-link", regUrl);
    link.href = regUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Open " + providerName + " OAuth app console");
    box.appendChild(link);
    var copyBtn = el("button", "stg-btn ghost cn-copy-btn", "Copy URL");
    copyBtn.type = "button";
    copyBtn.setAttribute("aria-label", "Copy " + providerName + " registration URL");
    copyBtn.addEventListener("click", function () { copyRegistrationUrl(regUrl, copyBtn, null); });
    box.appendChild(copyBtn);
    return box;
  }

  function startClientOAuth(providerId, providerName, allowedHosts) {
    syncMachineConfig();
    if (!oauthMachine) return false;
    var res = oauthMachine.startAuth(providerId, {
      oauthConfig: activeOAuthConfig(),
      origin: (root.location && /^https?:\/\//i.test(root.location.origin || "")) ? root.location.origin : "https://ai.spaincos.com"
    });
    if (!res || !res.ok || !res.url) return false;
    var u;
    try { u = new URL(res.url); } catch (e) { u = null; }
    if (!u || u.protocol !== "https:" || (allowedHosts && allowedHosts.indexOf(u.hostname) < 0)) {
      oauthMachine.cancelAwait(providerId);
      if (providerId === "google") say("Unexpected connect URL; aborting.", "err");
      else pbanner[providerId] = { msg: "Unexpected connect URL; aborting.", kind: "err" };
      render();
      return true;
    }
    var pending = watchGet("ai_oauth_pending", {});
    pending[providerId] = { state: res.stateToken, startedAt: Date.now() };
    watchSet("ai_oauth_pending", pending);

    if (typeof root.open === "function") {
      root.open(u.href, "_blank", "noopener,noreferrer");
    } else {
      root.location.href = u.href;
    }
    if (providerId === "google") banner = { msg: "Opened Google authorization in a new tab — awaiting callback.", kind: "info" };
    else pbanner[providerId] = { msg: "Opened " + providerName + " authorization in a new tab — awaiting callback.", kind: "info" };
    render();
    notifyBadges();
    return true;
  }

  function cancelClientOAuth(providerId) {
    if (oauthMachine) oauthMachine.cancelAwait(providerId);
    var pending = watchGet("ai_oauth_pending", {});
    delete pending[providerId];
    watchSet("ai_oauth_pending", pending);
    if (providerId === "google") banner = null;
    else delete pbanner[providerId];
    render();
    notifyBadges();
  }

  function pcall(id, body) { return call("connectors", Object.assign({ provider: id }, body)); }
  function pconnect(P) {
    var oState = getProviderOAuthState(P.id, pstat[P.id]);
    if (oState.hasClientConfig) {
      startClientOAuth(P.id, P.name, P.hosts);
      return;
    }
    if (!oState.hasServerConfig) {
      pbanner[P.id] = { msg: "Owner setup required — register the " + P.name + " OAuth app at " + (oState.registrationUrl || P.registrationUrl) + " first.", kind: "warn" };
      render();
      return;
    }
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
  function toggle(checked, onChange, label, disabled) {
    var wrap = el("label", "stg-switch"); wrap.title = label || "";
    var input = el("input"); input.type = "checkbox"; input.setAttribute("role", "switch"); input.checked = !!checked;
    if (disabled) input.disabled = true;
    input.addEventListener("change", function () { onChange(input.checked); });
    wrap.appendChild(input); wrap.appendChild(el("span", "stg-track"));
    return wrap;
  }

  function provCard(P) {
    var st = pstat[P.id] || (statusLoaded ? { provider: P.id, configured: P.kind === "key", kind: P.kind, permissions: P.permissions || [], connected: false } : null);
    var connected = !!(st && st.connected), busyP = !!pbusy[P.id];
    var oState = P.kind === "oauth" ? getProviderOAuthState(P.id, pstat[P.id] || null) : null;
    var unconf = P.kind === "oauth" ? (oState.state === "owner_setup_required") : !!(st && st.configured === false);
    var awaiting = !!(oState && oState.state === "awaiting_callback");
    var cbReceived = !!(oState && oState.state === "callback_received");

    var c = el("div", "cn-card");
    c.setAttribute("data-provider", P.id);
    if (oState) c.setAttribute("data-oauth-state", oState.state);

    var head = el("div", "cn-head");
    var logo = el("div", "cn-logo", P.logo); logo.setAttribute("aria-hidden", "true");
    var t = el("div", "cn-titles"); t.appendChild(el("div", "cn-title", P.name));
    var sub = P.kind === "oauth"
      ? oState.subLabel
      : (!st ? "Checking connection…" : connected ? "Connected" + (st.account ? " — " + st.account : "") : unconf ? "Owner setup required" : "Not connected");
    var subCls = "cn-sub" + (connected || cbReceived ? " on" : awaiting ? " awaiting" : unconf ? " warn" : "");
    var subEl = el("div", subCls, sub); subEl.setAttribute("role", "status"); t.appendChild(subEl);
    head.appendChild(logo); head.appendChild(t);

    var acts = el("div", "cn-actions");
    var keyInput = null;
    var toggleDisabled = (!st && !oState) || (P.kind === "oauth" && !connected && (!oState.canConnect) && !P.keyLabel);
    var tg = toggle(connected, function (on) {
      if (on) {
        if (P.kind === "oauth" && oState && oState.canConnect) pconnect(P);
        else if (keyInput) keyInput.focus();
      } else if (connected) pdisconnect(P);
    }, "Connect / disconnect " + P.name, toggleDisabled);
    if (!st || unconf || awaiting) tg.style.opacity = "0.4";
    acts.appendChild(tg);

    if (P.kind === "oauth" && oState) {
      if (oState.state === "owner_setup_required") {
        var ownerBtn = el("button", "stg-btn ghost cn-owner-btn", "Owner setup required");
        ownerBtn.type = "button";
        ownerBtn.addEventListener("click", function () {
          var regUrl = oState.registrationUrl || P.registrationUrl;
          copyRegistrationUrl(regUrl, null, null);
          pbanner[P.id] = { msg: "Owner setup required — register the " + P.name + " OAuth app at " + regUrl + " and configure CONNECTOR_OAUTH.", kind: "info" };
          render();
        });
        acts.appendChild(ownerBtn);
      } else if (awaiting) {
        var waitBtn = el("button", "stg-btn", "Awaiting callback…");
        waitBtn.type = "button";
        waitBtn.disabled = true;
        acts.appendChild(waitBtn);
        var cancelBtn = el("button", "stg-btn ghost", "Cancel");
        cancelBtn.type = "button";
        cancelBtn.addEventListener("click", function () { cancelClientOAuth(P.id); });
        acts.appendChild(cancelBtn);
      } else if (oState.canConnect) {
        var b = el("button", "stg-btn" + (connected || cbReceived ? " ghost" : ""), busyP ? "Working…" : oState.buttonLabel);
        b.type = "button"; b.disabled = busyP; b.addEventListener("click", function () { pconnect(P); }); acts.appendChild(b);
      }
    }

    if (connected) {
      var d = el("button", "stg-btn ghost cn-danger", "Disconnect");
      d.type = "button"; d.disabled = busyP; d.addEventListener("click", function () { pdisconnect(P); }); acts.appendChild(d);
    }
    head.appendChild(acts); c.appendChild(head);

    if (P.kind === "oauth" && unconf && ( (oState && oState.registrationUrl) || P.registrationUrl )) {
      c.appendChild(ownerSetupRow(P.name, (oState && oState.registrationUrl) || P.registrationUrl));
    }

    if (st && P.keyLabel && !connected) {
      var row = el("div", "cn-act-btns"), inp = el("input", "stg-input"); inp.type = "password"; inp.autocomplete = "off"; inp.spellcheck = false;
      inp.placeholder = "Paste " + P.keyLabel; inp.setAttribute("aria-label", P.keyLabel);
      var sv = el("button", "stg-btn", busyP ? "Checking…" : (P.kind === "oauth" ? "Save token" : "Save key")); sv.type = "button"; sv.disabled = busyP;
      sv.addEventListener("click", function () { var v = inp.value.trim(); inp.value = ""; if (v) psetkey(P, v); });
      keyInput = inp;
      row.appendChild(inp); row.appendChild(sv); c.appendChild(row); c.appendChild(el("div", "cn-note", P.help));
    }

    if (P.kind !== "oauth" && unconf && !P.keyLabel) {
      c.appendChild(el("div", "cn-msg warn", "Not available yet: the " + P.name + " app credentials have not been added to the server."));
    }
    if (st && st.error) c.appendChild(el("div", "cn-msg err", st.error));
    var bn = pbanner[P.id]; if (bn) { var m = el("div", "cn-msg " + bn.kind, bn.msg); m.setAttribute("role", "alert"); c.appendChild(m); }
    var perms = (st && st.permissions && st.permissions.length) ? st.permissions : (P.permissions || []);
    var ul = el("ul", "cn-list");
    perms.forEach(function (txt) {
      var li = el("li", "cn-li" + (connected ? " on" : ""));
      li.appendChild(el("span", "cn-dot"));
      li.appendChild(el("span", "cn-li-t", txt));
      li.appendChild(el("span", "cn-li-s", connected ? "Granted" : "Off"));
      ul.appendChild(li);
    });
    c.appendChild(ul);
    c.appendChild(el("p", "cn-note", P.note + " Credentials are encrypted on the server and never sent to your browser."));
    return c;
  }

  function loadStatus() {
    loadOAuthConfig();
    return loadAll().then(function () { if (!status) { status = { connected: false }; syncMachineConfig(); render(); } });
  }
  function say(msg, kind) { banner = msg ? { msg: msg, kind: kind || "info" } : null; render(); }

  function connect() {
    var gState = getProviderOAuthState("google", status);
    if (gState.hasClientConfig) {
      startClientOAuth("google", "Google", ["accounts.google.com"]);
      return;
    }
    if (!gState.hasServerConfig) {
      say("Owner setup required — register Google OAuth credentials at " + gState.registrationUrl + " first.", "warn");
      return;
    }
    if (busy) return; busy = true; render();
    call("connectors", { action: "start", services: ["gmail", "calendar", "drive", "sheets"] }).then(function (d) {
      if (!d.url) { busy = false; say(d.error || "Could not start the Google connection.", "err"); return; }
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
    call("connectors", { action: "disconnect" }).then(function (d) { busy = false; status = d && !d.error ? d : status; syncMachineConfig(); say(d.error || "Google disconnected.", d.error ? "err" : "ok"); }).catch(function (e) { busy = false; say(e.message, "err"); });
  }

  function build() {
    var c = el("div", "cn-card");
    c.setAttribute("data-provider", "google");
    var gState = getProviderOAuthState("google", status);
    c.setAttribute("data-oauth-state", gState.state);

    var head = el("div", "cn-head");
    var logo = el("div", "cn-logo", "G"); logo.setAttribute("aria-hidden", "true");
    var t = el("div", "cn-titles");
    t.appendChild(el("div", "cn-title", "Google — Gmail, Calendar, Drive and Sheets"));
    var connected = !!(status && status.connected);
    var awaiting = gState.state === "awaiting_callback";
    var cbReceived = gState.state === "callback_received";
    var unconf = gState.state === "owner_setup_required";
    var sub = !status && gState.state === "checking"
      ? "Checking connection…"
      : connected
        ? ("Connected" + (status.email ? " as " + status.email : ""))
        : awaiting
          ? "Awaiting callback"
          : cbReceived
            ? "Callback received — paste-free flow pending gateway wiring"
            : unconf
              ? "Owner setup required"
              : "Not connected";
    var subEl = el("div", "cn-sub" + (connected || cbReceived ? " on" : awaiting ? " awaiting" : unconf ? " warn" : ""), sub);
    subEl.setAttribute("role", "status");
    t.appendChild(subEl);
    head.appendChild(logo); head.appendChild(t);

    var acts = el("div", "cn-actions");
    if (status || gState.hasClientConfig || statusLoaded) {
      var gt = toggle(connected, function (on) { if (on) connect(); else if (connected) disconnect(); }, "Connect / disconnect Google", unconf || awaiting);
      if (unconf || awaiting) gt.style.opacity = "0.4";
      acts.appendChild(gt);
      if (unconf) {
        var ownerBtn = el("button", "stg-btn ghost cn-owner-btn", "Owner setup required");
        ownerBtn.type = "button";
        ownerBtn.addEventListener("click", function () {
          copyRegistrationUrl(gState.registrationUrl, null, null);
          say("Owner setup required — register Google OAuth credentials at " + gState.registrationUrl + " and configure CONNECTOR_OAUTH.", "info");
        });
        acts.appendChild(ownerBtn);
      } else if (awaiting) {
        var waitBtn = el("button", "stg-btn", "Awaiting callback…");
        waitBtn.type = "button";
        waitBtn.disabled = true;
        acts.appendChild(waitBtn);
        var cancelBtn = el("button", "stg-btn ghost", "Cancel");
        cancelBtn.type = "button";
        cancelBtn.addEventListener("click", function () { cancelClientOAuth("google"); });
        acts.appendChild(cancelBtn);
      } else {
        var b = el("button", "stg-btn" + (connected || cbReceived ? " ghost" : ""), busy ? "Working…" : connected || cbReceived ? "Reconnect" : "Connect Google");
        b.type = "button"; b.disabled = busy; b.addEventListener("click", connect); acts.appendChild(b);
      }
      if (connected) { var d = el("button", "stg-btn ghost cn-danger", "Disconnect"); d.type = "button"; d.disabled = busy; d.addEventListener("click", disconnect); acts.appendChild(d); }
    }
    head.appendChild(acts); c.appendChild(head);
    if (unconf && gState.registrationUrl) c.appendChild(ownerSetupRow("Google", gState.registrationUrl));
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

  function render() {
    hosts = hosts.filter(function (h) { return h.isConnected; });
    hosts.forEach(function (h) {
      h.textContent = "";
      if (activeDrop) h.appendChild(dropCard(activeDrop));
      h.appendChild(build());
      PROVS.forEach(function (P) { h.appendChild(provCard(P)); });
    });
  }
  function card() {
    syncMachineConfig();
    var h = el("div", "cn-host"); hosts.push(h); h.appendChild(build()); PROVS.forEach(function (P) { h.appendChild(provCard(P)); });
    loadStatus();
    return h;
  }

  // ---------- OAuth callback stub reception (/api/oauth-callback -> BroadcastChannel / storage / #connector_stub) ----------
  function appendThreadSystemNote(providerLabel, text) {
    try {
      var rc = document.getElementById("resultsContent");
      if (!rc) return;
      var note = el("div", "cn-callback-note", "[System] " + providerLabel + ": " + text);
      note.setAttribute("role", "status");
      rc.appendChild(note);
    } catch (e) {}
  }

  function receiveOAuthCallback(evt) {
    if (!evt || typeof evt !== "object") return null;
    var dedupeKey = (evt.provider || "") + "|" + (evt.state || "") + "|" + (evt.receivedAt || "") + "|" + (evt.error || "");
    if (dedupeKey !== "|||" && seenCallbackStates[dedupeKey]) return null;
    if (dedupeKey !== "|||") seenCallbackStates[dedupeKey] = 1;

    syncMachineConfig();
    var res = oauthMachine ? oauthMachine.receiveCallback(evt) : null;
    var prov = (res && res.provider) || (cfgLib ? cfgLib.normalizeProviderId(evt.provider || "") : String(evt.provider || "").toLowerCase());
    if (!prov) return res;
    var P = PROVS.find(function (x) { return x.id === prov; });
    var label = prov === "google" ? "Google" : (P && P.name) || (prov.charAt(0).toUpperCase() + prov.slice(1));

    if (res && !res.ok) {
      if (prov === "google") banner = { msg: res.error, kind: "err" };
      else pbanner[prov] = { msg: res.error, kind: "err" };
    } else {
      var msg = (res && res.message) || evt.message || "Callback received — paste-free flow pending gateway wiring";
      if (prov === "google") banner = { msg: msg, kind: "ok" };
      else pbanner[prov] = { msg: msg, kind: "ok" };
      appendThreadSystemNote(label, msg);
    }
    render();
    notifyBadges();
    return res;
  }

  // ---------- OAuth return (…/#connector_code=…&connector_state=… or #connector_error=… or #connector_stub=…) ----------
  function handleReturn() {
    var h = root.location.hash || ""; if (h.indexOf("connector_") < 0) return;
    var p = new URLSearchParams(h.replace(/^#/, ""));
    var stubProv = p.get("connector_stub");
    var code = p.get("connector_code"), state = p.get("connector_state"), err = p.get("connector_error");
    try { root.history.replaceState(null, "", root.location.pathname + root.location.search); } catch (e) {}
    function openPane() { if (root.SettingsUI && root.SettingsUI.open) root.SettingsUI.open("connectors"); }
    if (stubProv) {
      var lastEvt = watchGet("ai_oauth_callback_event", null);
      if (lastEvt) receiveOAuthCallback(lastEvt);
      setTimeout(openPane, 200);
      return;
    }
    if (err) { banner = { msg: err === "access_denied" ? "Access was not granted." : "Connection failed (" + err.replace(/[^a-z_]/gi, "").slice(0, 40) + ").", kind: "err" }; setTimeout(openPane, 400); return; }
    if (!code || !state) return;
    var tries = 0;
    (function go() {
      if (typeof sb === "undefined" || ++tries > 40) { banner = { msg: "Sign in, then connect again.", kind: "err" }; return openPane(); }
      session().then(function () {
        return call("connectors", { action: "exchange", code: code, state: state });
      }).then(function (d) {
        if (d.error) banner = { msg: d.error, kind: "err" }; else { var nm = d.provider ? d.provider.charAt(0).toUpperCase() + d.provider.slice(1) : "Google"; if (d.provider) pstat[d.provider] = d; else status = d; syncMachineConfig(); banner = { msg: nm + " connected" + (d.email || d.account ? " as " + (d.email || d.account) : "") + ".", kind: "ok" }; }
        openPane();
      }).catch(function () { setTimeout(go, 500); });
    })();
  }

  try {
    if (typeof root.BroadcastChannel === "function") {
      var bc = new root.BroadcastChannel("ai_connector_oauth");
      bc.onmessage = function (ev) { if (ev && ev.data) receiveOAuthCallback(ev.data); };
    }
  } catch (e) {}
  try {
    root.addEventListener("storage", function (ev) {
      if (ev && ev.key === "ai_oauth_callback_event" && ev.newValue) {
        try { receiveOAuthCallback(JSON.parse(ev.newValue)); } catch (e) {}
      }
    });
  } catch (e) {}

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
    actions.slice(0, 5).forEach(function (a) {
      if (!a) return;
      if ((a.kind === "send_email" || a.kind === "create_event") && a.approval_token) wrap.appendChild(actionCard(a));
      else if (a.kind === "ask_user") wrap.appendChild(askCard(a));
    });
    if (wrap.childNodes.length) container.appendChild(wrap);
  }

  function askCard(a) {
    var card = el("div", "cn-act");
    card.style.cssText = "background:var(--bg-elevated,#212121);border:1px solid var(--border,#333);border-radius:12px;padding:12px 14px;margin:8px 0";
    var q = el("div", null, a.question || "");
    q.style.cssText = "font-weight:600;font-size:13px;margin-bottom:8px";
    card.appendChild(q);
    (a.options || []).forEach(function (opt) {
      var b = el("button", "sk-btn", opt.label);
      b.style.cssText = "display:block;width:100%;text-align:left;margin:6px 0;font:inherit;font-size:13px";
      b.addEventListener("click", function () {
        card.remove();
        try { submitQuery(opt.value); } catch (e) {}
      });
      card.appendChild(b);
    });
    var hint = el("div", null, "Pick one — or just type your own answer.");
    hint.style.cssText = "font-size:11px;opacity:.6;margin-top:6px";
    card.appendChild(hint);
    return card;
  }

  function setOAuthConfig(cfg) {
    if (root) root.CONNECTOR_OAUTH = cfg || null;
    syncMachineConfig();
    render();
    notifyBadges();
  }

  root.ConnectorsUI = {
    card: card,
    badge: badge,
    renderActions: renderActions,
    refresh: loadStatus,
    setOAuthConfig: setOAuthConfig,
    getOAuthState: function (id) { return getProviderOAuthState(id, id === "google" ? status : pstat[id]); },
    _receiveOAuthCallback: receiveOAuthCallback,
    _handleReturn: handleReturn
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", handleReturn); else handleReturn();
})(window);
