/* Client-side companion for /api/oauth-callback (strict CSP: external script only).
   Stores the returned OAuth authorization code locally in ai_oauth_pending_codes for
   future gateway exchange, removes ?code= from browser history immediately, and notifies
   any open ai.spaincos.com tab via BroadcastChannel + storage event. */
(function (root) {
  "use strict";
  var doc = root && root.document;
  if (!doc) return;

  function lsGet(k) {
    try { return JSON.parse(root.localStorage.getItem(k) || "null"); } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  function parseProvider(providerAttr, state) {
    var p = String(providerAttr || "").trim().toLowerCase();
    if (!p && state && state.indexOf(":") > 0) p = state.slice(0, state.indexOf(":")).trim().toLowerCase();
    if (p === "microsoft" || p === "msft" || p === "entra") return "outlook";
    if (p === "gmail" || p === "gmail-gcal") return "google";
    return p.replace(/[^a-z0-9_-]/g, "") || "oauth";
  }

  function run() {
    var host = doc.getElementById("oauth-callback-root");
    var qs = new URLSearchParams((root.location && root.location.search) || "");
    var code = (host && host.getAttribute("data-code")) || qs.get("code") || "";
    var state = (host && host.getAttribute("data-state")) || qs.get("state") || "";
    var error = (host && host.getAttribute("data-error")) || qs.get("error") || "";
    var errorDesc = (host && host.getAttribute("data-error-description")) || qs.get("error_description") || "";
    var provider = parseProvider((host && host.getAttribute("data-provider")) || qs.get("provider") || "", state);

    // Strip one-time code and state from URL bar immediately.
    try {
      if (root.history && typeof root.history.replaceState === "function") {
        root.history.replaceState(null, "", root.location.pathname);
      }
    } catch (e) {}

    var pendingMap = lsGet("ai_oauth_pending") || {};
    var pendingEntry = pendingMap[provider] || null;
    var stateVerified = !!(pendingEntry && pendingEntry.state && state && pendingEntry.state === state);
    var stateMismatch = !!(pendingEntry && pendingEntry.state && state && pendingEntry.state !== state);
    var nowIso = new Date().toISOString();

    var statusNote = doc.getElementById("cb-storage-note");
    var stateBadge = doc.getElementById("cb-state-status");

    if (error || stateMismatch) {
      var errCode = stateMismatch ? "state_mismatch" : error;
      var evtErr = {
        provider: provider,
        state: state,
        error: errCode,
        errorDescription: stateMismatch ? "OAuth state did not match the pending request." : errorDesc,
        receivedAt: nowIso
      };
      lsSet("ai_oauth_callback_event", evtErr);
      try {
        if (typeof root.BroadcastChannel === "function") {
          var bcErr = new root.BroadcastChannel("ai_connector_oauth");
          bcErr.postMessage(evtErr);
          bcErr.close();
        }
      } catch (e) {}
      if (stateBadge && stateMismatch) stateBadge.textContent = "Mismatch — rejected";
      return;
    }

    if (!code) return;

    var codesMap = lsGet("ai_oauth_pending_codes") || {};
    codesMap[provider] = {
      provider: provider,
      code: code,
      state: state,
      stateVerified: stateVerified,
      receivedAt: nowIso,
      status: "pending_gateway_wiring"
    };
    lsSet("ai_oauth_pending_codes", codesMap);

    if (pendingMap[provider]) {
      delete pendingMap[provider];
      lsSet("ai_oauth_pending", pendingMap);
    }

    // Broadcast sanitized event (without raw code) to open app tabs.
    var evt = {
      provider: provider,
      state: state,
      stateVerified: stateVerified,
      codeReceived: true,
      receivedAt: nowIso,
      message: "Callback received — paste-free flow pending gateway wiring"
    };
    lsSet("ai_oauth_callback_event", evt);
    try {
      if (typeof root.BroadcastChannel === "function") {
        var bc = new root.BroadcastChannel("ai_connector_oauth");
        bc.postMessage(evt);
        bc.close();
      }
    } catch (e) {}

    if (stateBadge) {
      stateBadge.textContent = stateVerified ? "Verified" : (state ? "Received" : "None");
    }
    if (statusNote) {
      statusNote.textContent = "Stored for gateway exchange and notified open ai.spaincos.com tabs.";
    }

    var closeBtn = doc.getElementById("cb-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        try { root.close(); } catch (e) {}
        root.location.assign("/#connector_stub=" + encodeURIComponent(provider));
      });
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", run);
  else run();
})(typeof window !== "undefined" ? window : null);
