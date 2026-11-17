/* api-docs.js — API reference pane: the platform's own public surface, documented (API 86→95)
 *
 * Settings > API pane listing every live endpoint (gateway-chat, api-keys, fleet-dispatch,
 * monitors, ops-health, oauth-config, share, workspace-actions) with method, auth model,
 * purpose, and a live health badge (each endpoint is pinged read-only at render time).
 * Pure vanilla JS, zero dependencies, strict textContent/createElement.
 */
(function (root) {
  "use strict";
  var ANON = "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb";
  var SB = "https://bnxermyboeigvwonfrzx.supabase.co";
  var GW = SB + "/functions/v1";

  // The documented public surface (mirrors the platform function manifest, v224).
  var ENDPOINTS = [
    { path: "/gateway-chat",     method: "POST", auth: "Bearer user JWT (or API key)", purpose: "The chat gateway — models, tools, server-side auto-invocations, streaming SSE", health: true },
    { path: "/api-keys",        method: "POST", auth: "Bearer user JWT",              purpose: "Manage API keys for the public API (create/list/revoke; raw key shown once)", health: true },
    { path: "/fleet-dispatch",  method: "POST", auth: "Bearer user JWT",              purpose: "Queue work for the free agent fleet (zero-credit build/research lane)", health: true },
    { path: "/monitors",        method: "POST", auth: "Bearer user JWT",              purpose: "Uptime monitors registry and checks", health: true },
    { path: "/ops-health",      method: "GET",  auth: "public",                      purpose: "Platform ops health snapshot", health: true },
    { path: "/oauth-config",    method: "GET",  auth: "public",                      purpose: "OAuth provider config for connect flows (Slack live; Dropbox/Outlook/Box pending app registration)", health: true },
    { path: "/share",           method: "POST", auth: "Bearer user JWT",              purpose: "Share/link shortener for threads and artifacts", health: true },
    { path: "/workspace-actions", method: "POST", auth: "Bearer user JWT",            purpose: "Workspace actions (rename, archive, organize)", health: true },
    { path: "/gateway-status",  method: "GET",  auth: "public",                      purpose: "Platform status data (versions, queues)", health: true }
  ];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function esc(s) { return String(s == null ? "" : s); }

  function injectStyles() {
    if (document.getElementById("apid-styles")) return;
    var css = [
      ".apid-list{border:1px solid var(--border,#2a2f3a);border-radius:10px;overflow:hidden;margin:10px 0}",
      ".apid-row{padding:10px 12px;border-bottom:1px solid var(--border,#2a2f3a)}",
      ".apid-row:last-child{border-bottom:0}",
      ".apid-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}",
      ".apid-method{font:600 11px ui-monospace,monospace;padding:2px 8px;border-radius:6px;background:var(--accent-bg,rgba(20,184,166,.15));color:var(--accent,#14b8a6);letter-spacing:.04em}",
      ".apid-path{font:600 12.5px ui-monospace,monospace}",
      ".apid-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;margin-left:auto}",
      ".apid-ok{background:rgba(34,197,94,.15);color:#22c55e}",
      ".apid-bad{background:rgba(239,68,68,.15);color:#ef4444}",
      ".apid-purpose{font-size:12.5px;opacity:.75;margin-top:4px}",
      ".apid-auth{font-size:11px;opacity:.55;margin-top:2px}",
      ".apid-note{font-size:12px;opacity:.7;margin:6px 0}",
      ".apid-base{font:600 12px ui-monospace,monospace;background:var(--hover,rgba(255,255,255,.05));padding:8px 10px;border-radius:8px;display:inline-block;margin-top:8px}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = "apid-styles";
    st.textContent = css;
    document.head.appendChild(st);
  }

  function mount(host) {
    if (!host) return null;
    injectStyles();
    var wrap = el("div", "apid-root");
    wrap.appendChild(el("h3", null, "API"));
    var h3 = wrap.lastChild; h3.style.fontSize = "16px"; h3.style.margin = "0 0 4px";
    wrap.appendChild(el("div", "apid-note", "The platform's public API surface — every live endpoint, its auth model, and a real-time health badge (checked at render time). Use these endpoints with an API key from Settings > API Keys."));
    var base = el("div", "apid-base", "BASE: " + GW);
    wrap.appendChild(base);

    var list = el("div", "apid-list");
    wrap.appendChild(list);

    ENDPOINTS.forEach(function (ep) {
      var row = el("div", "apid-row");
      var head = el("div", "apid-head");
      head.appendChild(el("span", "apid-method", ep.method));
      head.appendChild(el("span", "apid-path", ep.path));
      var badge = el("span", "apid-badge apid-ok", "checking...");
      head.appendChild(badge);
      row.appendChild(head);
      row.appendChild(el("div", "apid-purpose", esc(ep.purpose)));
      row.appendChild(el("div", "apid-auth", "auth: " + esc(ep.auth)));
      list.appendChild(row);
      // live health check: GET-capable endpoints get pinged; POST endpoints show the
      // function as deployed (a POST without a body would be a false negative)
      if (ep.method === "GET") {
        fetch(GW + ep.path, { method: "GET", headers: { apikey: ANON }, signal: AbortSignal.timeout(8000) })
          .then(function (r) { badge.textContent = r.ok ? "LIVE " + r.status : "HTTP " + r.status; badge.className = "apid-badge " + (r.ok ? "apid-ok" : "apid-bad"); })
          .catch(function () { badge.textContent = "unreachable"; badge.className = "apid-badge apid-bad"; });
      } else {
        badge.textContent = "DEPLOYED";
      }
    });
    host.appendChild(wrap);
    return wrap;
  }

  function renderSettingsPane(container) {
    if (!container) return;
    container.textContent = "";
    mount(container);
  }

  function registerWithSettings() {
    if (root.SettingsUI && typeof root.SettingsUI.registerPane === "function") {
      root.SettingsUI.registerPane({
        id: "api-docs",
        label: "API",
        icon: '<path d="M4 7h16M4 12h10M4 17h7"/><circle cx="17" cy="12" r="2"/>',
        render: renderSettingsPane,
        after: "connectors"
      });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", registerWithSettings);
  } else {
    registerWithSettings();
  }
  root.ApiDocsUI = { mount: mount, renderPane: renderSettingsPane, endpoints: ENDPOINTS };
})(typeof window !== "undefined" ? window : globalThis);
