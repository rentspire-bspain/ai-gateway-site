/* ConnectorOAuthConfig — generic OAuth provider registry, URL builder, config loader,
   and connect-flow state machine for Settings > Connectors (section 34c / 34e).
   Reads client_id / redirect_uri / scope from window.CONNECTOR_OAUTH or /api/oauth-config
   (fetched on panel open, falling back cleanly to null). Never stores client secrets. */
(function (root, factory) {
  "use strict";
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ConnectorOAuthConfig = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this, function (root) {
  "use strict";

  var DEFAULT_ORIGIN = "https://ai.spaincos.com";
  var CALLBACK_PATH = "/api/oauth-callback";
  var CONFIG_ENDPOINT = "/api/oauth-config";

  var OAUTH_PROVIDERS = {
    slack: {
      id: "slack",
      aliases: [],
      name: "Slack",
      authorizeUrl: "https://slack.com/oauth/v2/authorize",
      registrationUrl: "https://api.slack.com/apps",
      allowedHosts: ["slack.com"],
      responseType: "",
      defaultScope: "channels:history,channels:read,groups:history,im:history,mpim:history,search:read,users:read",
      scopeSeparator: ",",
      extraParams: {}
    },
    dropbox: {
      id: "dropbox",
      aliases: [],
      name: "Dropbox",
      authorizeUrl: "https://www.dropbox.com/oauth2/authorize",
      registrationUrl: "https://www.dropbox.com/developers/apps",
      allowedHosts: ["www.dropbox.com", "dropbox.com"],
      responseType: "code",
      defaultScope: "",
      scopeSeparator: " ",
      extraParams: { token_access_type: "offline" }
    },
    outlook: {
      id: "outlook",
      aliases: ["microsoft", "msft", "entra"],
      name: "Outlook",
      authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      registrationUrl: "https://entra.microsoft.com",
      allowedHosts: ["login.microsoftonline.com"],
      responseType: "code",
      defaultScope: "openid profile email offline_access Mail.Read Calendars.Read",
      scopeSeparator: " ",
      extraParams: { response_mode: "query" }
    },
    box: {
      id: "box",
      aliases: [],
      name: "Box",
      authorizeUrl: "https://app.box.com/api/oauth2/authorize",
      registrationUrl: "https://app.box.com/developers/console",
      allowedHosts: ["app.box.com", "account.box.com"],
      responseType: "code",
      defaultScope: "",
      scopeSeparator: " ",
      extraParams: {}
    },
    google: {
      id: "google",
      aliases: ["gmail", "gmail-gcal"],
      name: "Google",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      registrationUrl: "https://console.cloud.google.com/apis/credentials",
      allowedHosts: ["accounts.google.com"],
      responseType: "code",
      defaultScope: "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly",
      scopeSeparator: " ",
      extraParams: { access_type: "offline", prompt: "consent" }
    },
    github: {
      id: "github",
      aliases: [],
      name: "GitHub",
      authorizeUrl: "https://github.com/login/oauth/authorize",
      registrationUrl: "https://github.com/settings/developers",
      allowedHosts: ["github.com"],
      responseType: "",
      defaultScope: "repo read:user",
      scopeSeparator: " ",
      extraParams: {}
    }
  };

  var ALIAS_INDEX = {};
  Object.keys(OAUTH_PROVIDERS).forEach(function (k) {
    var spec = OAUTH_PROVIDERS[k];
    ALIAS_INDEX[k] = k;
    (spec.aliases || []).forEach(function (a) { ALIAS_INDEX[a] = k; });
  });

  function normalizeProviderId(id) {
    if (!id || typeof id !== "string") return "";
    var clean = id.trim().toLowerCase();
    return ALIAS_INDEX[clean] || clean;
  }

  function getProviderSpec(id) {
    var canon = normalizeProviderId(id);
    return OAUTH_PROVIDERS[canon] || null;
  }

  function isPlaceholderValue(val) {
    if (val == null || typeof val !== "string") return true;
    var s = val.trim();
    if (!s) return true;
    var lower = s.toLowerCase();
    if (lower === "null" || lower === "undefined" || lower === "none" || lower === "false" || lower === "..." || lower === "todo" || lower === "tbd") return true;
    if (/^(your[_-]|replace[_-]|placeholder|change[_-]me|insert[_-]|example[_-]|client[_-]id[_-]here)/i.test(s)) return true;
    if (/^<[^>]+>$/.test(s) || /^\{\{[\s\S]*\}\}$/.test(s) || /^\$\{[\s\S]*\}$/.test(s)) return true;
    return false;
  }

  function currentOrigin(opts) {
    if (opts && typeof opts.origin === "string" && opts.origin.trim()) return opts.origin.trim().replace(/\/+$/, "");
    try {
      if (root && root.location && /^https?:\/\//i.test(root.location.origin || "")) {
        return root.location.origin.replace(/\/+$/, "");
      }
    } catch (e) {}
    return DEFAULT_ORIGIN;
  }

  function isValidRedirectUri(uri) {
    if (!uri || typeof uri !== "string") return false;
    try {
      var u = new URL(uri);
      if (u.protocol === "https:") return true;
      if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function extractRawEntry(spec, rawConfig) {
    if (!rawConfig || typeof rawConfig !== "object") return null;
    var pools = [];
    if (rawConfig.providers && typeof rawConfig.providers === "object") pools.push(rawConfig.providers);
    pools.push(rawConfig);
    var keys = [spec.id].concat(spec.aliases || []);
    for (var p = 0; p < pools.length; p++) {
      var pool = pools[p];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (Object.prototype.hasOwnProperty.call(pool, k) && pool[k] != null) return pool[k];
      }
    }
    return null;
  }

  function mergeOAuthConfigs(baseCfg, overrideCfg) {
    if (!baseCfg && !overrideCfg) return null;
    var out = { providers: {} };
    function ingest(src) {
      if (!src || typeof src !== "object") return;
      var redir = src.redirectUri || src.redirect_uri;
      if (redir && !isPlaceholderValue(redir)) out.redirectUri = redir.trim();
      var map = (src.providers && typeof src.providers === "object") ? src.providers : null;
      if (map) {
        Object.keys(map).forEach(function (k) {
          if (map[k] != null) out.providers[normalizeProviderId(k) || k] = map[k];
        });
      }
      Object.keys(src).forEach(function (k) {
        if (k === "providers" || k === "redirectUri" || k === "redirect_uri" || k === "ok") return;
        if (src[k] != null) out.providers[normalizeProviderId(k) || k] = src[k];
      });
    }
    ingest(baseCfg);
    ingest(overrideCfg);
    if (!out.redirectUri && !Object.keys(out.providers).length) return null;
    return out;
  }

  function resolveProviderConfig(providerId, rawConfig, opts) {
    var spec = getProviderSpec(providerId);
    if (!spec) return null;
    var origin = currentOrigin(opts);
    var fallbackRedirect = origin + CALLBACK_PATH;
    var topRedirect = rawConfig && typeof rawConfig === "object" ? (rawConfig.redirectUri || rawConfig.redirect_uri || "") : "";
    var entry = extractRawEntry(spec, rawConfig);

    var clientId = "";
    var entryRedirect = "";
    var scope = spec.defaultScope || "";
    var userScope = "";
    var tenant = "";

    if (typeof entry === "string") {
      clientId = entry.trim();
    } else if (entry && typeof entry === "object") {
      clientId = String(entry.clientId || entry.client_id || "").trim();
      entryRedirect = String(entry.redirectUri || entry.redirect_uri || "").trim();
      if (typeof entry.scope === "string") scope = entry.scope.trim();
      else if (Array.isArray(entry.scopes)) scope = entry.scopes.join(spec.scopeSeparator || " ").trim();
      userScope = String(entry.userScope || entry.user_scope || "").trim();
      tenant = String(entry.tenant || entry.tenantId || entry.tenant_id || "").trim();
    }

    var redirectCandidate = !isPlaceholderValue(entryRedirect) ? entryRedirect : (!isPlaceholderValue(topRedirect) ? String(topRedirect).trim() : fallbackRedirect);
    var redirectUri = isValidRedirectUri(redirectCandidate) ? redirectCandidate : fallbackRedirect;

    if (isPlaceholderValue(clientId)) {
      return {
        provider: spec.id,
        name: spec.name,
        configured: false,
        clientId: null,
        redirectUri: redirectUri,
        scope: scope,
        registrationUrl: spec.registrationUrl,
        authorizeBaseUrl: spec.authorizeUrl
      };
    }

    return {
      provider: spec.id,
      name: spec.name,
      configured: true,
      clientId: clientId,
      redirectUri: redirectUri,
      scope: scope,
      userScope: userScope,
      tenant: tenant,
      registrationUrl: spec.registrationUrl,
      authorizeBaseUrl: spec.authorizeUrl
    };
  }

  function makeStateToken(providerId, randFn) {
    var canon = normalizeProviderId(providerId) || "oauth";
    var nonce = "";
    if (typeof randFn === "function") {
      nonce = String(randFn());
    } else if (root && root.crypto && typeof root.crypto.randomUUID === "function") {
      nonce = root.crypto.randomUUID().replace(/-/g, "");
    } else {
      nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    }
    return canon + ":" + nonce.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 48);
  }

  function parseProviderFromState(state) {
    if (!state || typeof state !== "string") return "";
    var idx = state.indexOf(":");
    if (idx <= 0) return "";
    return normalizeProviderId(state.slice(0, idx));
  }

  function buildAuthorizeUrl(providerId, rawConfig, opts) {
    var spec = getProviderSpec(providerId);
    if (!spec) return null;
    var resolved = resolveProviderConfig(spec.id, rawConfig, opts);
    if (!resolved || !resolved.configured) return null;

    var baseUrl = spec.authorizeUrl;
    if (spec.id === "outlook" && resolved.tenant && /^[a-zA-Z0-9._-]+$/.test(resolved.tenant)) {
      baseUrl = "https://login.microsoftonline.com/" + encodeURIComponent(resolved.tenant) + "/oauth2/v2.0/authorize";
    }

    var u;
    try { u = new URL(baseUrl); } catch (e) { return null; }
    if (u.protocol !== "https:" || spec.allowedHosts.indexOf(u.hostname) < 0) return null;

    u.searchParams.set("client_id", resolved.clientId);
    if (spec.responseType) u.searchParams.set("response_type", spec.responseType);
    if (resolved.scope) u.searchParams.set("scope", resolved.scope);
    if (spec.id === "slack" && resolved.userScope) u.searchParams.set("user_scope", resolved.userScope);
    u.searchParams.set("redirect_uri", resolved.redirectUri);

    var state = (opts && typeof opts.state === "string" && opts.state.trim()) ? opts.state.trim() : makeStateToken(spec.id, opts && opts.randFn);
    u.searchParams.set("state", state);

    var extra = spec.extraParams || {};
    Object.keys(extra).forEach(function (k) {
      if (extra[k] != null && extra[k] !== "") u.searchParams.set(k, String(extra[k]));
    });

    return u.toString();
  }

  function fetchOAuthConfig(opts) {
    var fetchImpl = (opts && opts.fetch) || (root && typeof root.fetch === "function" ? root.fetch.bind(root) : null);
    var winCfg = (opts && opts.windowConfig !== undefined) ? opts.windowConfig : (root && root.CONNECTOR_OAUTH ? root.CONNECTOR_OAUTH : null);
    var endpoint = (opts && opts.endpoint) || CONFIG_ENDPOINT;

    if (!fetchImpl) return Promise.resolve(mergeOAuthConfigs(null, winCfg));

    return Promise.resolve().then(function () {
      return fetchImpl(endpoint, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
    }).then(function (res) {
      if (!res || !res.ok) return mergeOAuthConfigs(null, winCfg);
      return res.json().then(function (data) {
        if (!data || typeof data !== "object") return mergeOAuthConfigs(null, winCfg);
        return mergeOAuthConfigs(data, winCfg);
      }).catch(function () {
        return mergeOAuthConfigs(null, winCfg);
      });
    }).catch(function () {
      return mergeOAuthConfigs(null, winCfg);
    });
  }

  function serverHasOAuthConfig(providerId, serverStatus) {
    if (!serverStatus || typeof serverStatus !== "object") return false;
    var canon = normalizeProviderId(providerId);
    if (canon === "google") {
      return !!(serverStatus.configured && (serverStatus.configured === true || serverStatus.configured.oauth_client === true));
    }
    return serverStatus.configured === true;
  }

  function deriveConnectorState(providerId, ctx) {
    var spec = getProviderSpec(providerId);
    if (!spec) return null;
    var c = ctx || {};
    var st = c.serverStatus || null;
    var resolved = resolveProviderConfig(spec.id, c.oauthConfig || null, c);
    var hasClientConfig = !!(resolved && resolved.configured);
    var hasServerConfig = serverHasOAuthConfig(spec.id, st);
    var hasConfig = hasClientConfig || hasServerConfig;
    var connected = !!(st && st.connected);
    var runtime = c.runtimeState || null;

    if (connected) {
      var acct = st.email || st.account || "";
      return {
        provider: spec.id,
        state: "connected",
        hasConfig: true,
        hasClientConfig: hasClientConfig,
        hasServerConfig: hasServerConfig,
        canConnect: true,
        buttonLabel: "Reconnect",
        subLabel: "Connected" + (acct ? (spec.id === "google" ? " as " : " — ") + acct : ""),
        badgeLabel: "Connected",
        registrationUrl: spec.registrationUrl,
        error: null
      };
    }

    if (runtime && runtime.status === "awaiting_callback") {
      return {
        provider: spec.id,
        state: "awaiting_callback",
        hasConfig: hasConfig,
        hasClientConfig: hasClientConfig,
        hasServerConfig: hasServerConfig,
        canConnect: false,
        buttonLabel: "Awaiting callback…",
        subLabel: "Awaiting callback",
        badgeLabel: "Awaiting callback",
        registrationUrl: spec.registrationUrl,
        authorizeUrl: runtime.authorizeUrl || null,
        stateToken: runtime.stateToken || null,
        error: null
      };
    }

    if (runtime && runtime.status === "callback_received") {
      return {
        provider: spec.id,
        state: "callback_received",
        hasConfig: hasConfig,
        hasClientConfig: hasClientConfig,
        hasServerConfig: hasServerConfig,
        canConnect: hasConfig,
        buttonLabel: "Reconnect",
        subLabel: "Callback received — paste-free flow pending gateway wiring",
        badgeLabel: "Callback received",
        registrationUrl: spec.registrationUrl,
        callbackRecord: runtime.record || null,
        message: "Callback received — paste-free flow pending gateway wiring",
        error: null
      };
    }

    if (!c.statusLoaded && !st && !hasClientConfig) {
      return {
        provider: spec.id,
        state: "checking",
        hasConfig: false,
        hasClientConfig: false,
        hasServerConfig: false,
        canConnect: false,
        buttonLabel: "Checking…",
        subLabel: "Checking connection…",
        badgeLabel: "Checking…",
        registrationUrl: spec.registrationUrl,
        error: null
      };
    }

    if (!hasConfig) {
      return {
        provider: spec.id,
        state: "owner_setup_required",
        hasConfig: false,
        hasClientConfig: false,
        hasServerConfig: false,
        canConnect: false,
        buttonLabel: "Owner setup required",
        subLabel: "Owner setup required",
        badgeLabel: "Owner setup required",
        registrationUrl: spec.registrationUrl,
        error: runtime && runtime.status === "error" ? runtime.error : null
      };
    }

    return {
      provider: spec.id,
      state: runtime && runtime.status === "error" ? "error" : "ready",
      hasConfig: true,
      hasClientConfig: hasClientConfig,
      hasServerConfig: hasServerConfig,
      canConnect: true,
      buttonLabel: "Connect " + spec.name,
      subLabel: "Not connected",
      badgeLabel: "Not connected",
      registrationUrl: spec.registrationUrl,
      error: runtime && runtime.status === "error" ? runtime.error : null
    };
  }

  function createOAuthStateMachine(initialOpts) {
    var opts = initialOpts || {};
    var oauthConfig = opts.oauthConfig || null;
    var statusLoaded = !!opts.statusLoaded;
    var serverStatuses = Object.assign({}, opts.serverStatuses || {});
    var runtimeByProvider = {};

    function setOAuthConfig(cfg) {
      oauthConfig = cfg || null;
    }

    function getOAuthConfig() {
      return oauthConfig;
    }

    function setServerStatus(providerId, statusObj) {
      var canon = normalizeProviderId(providerId);
      if (!canon) return;
      serverStatuses[canon] = statusObj || null;
      if (statusObj && statusObj.connected) {
        delete runtimeByProvider[canon];
      }
    }

    function setStatusLoaded(loaded) {
      statusLoaded = !!loaded;
    }

    function getState(providerId) {
      var canon = normalizeProviderId(providerId);
      return deriveConnectorState(canon, {
        oauthConfig: oauthConfig,
        serverStatus: serverStatuses[canon] || null,
        statusLoaded: statusLoaded,
        runtimeState: runtimeByProvider[canon] || null,
        origin: opts.origin
      });
    }

    function startAuth(providerId, startOpts) {
      var spec = getProviderSpec(providerId);
      if (!spec) return { ok: false, state: "unknown_provider", error: "Unknown OAuth provider." };
      var sOpts = Object.assign({ origin: opts.origin }, startOpts || {});
      var cfgToUse = sOpts.oauthConfig !== undefined ? sOpts.oauthConfig : oauthConfig;
      var stateToken = sOpts.state || makeStateToken(spec.id, sOpts.randFn);
      var url = buildAuthorizeUrl(spec.id, cfgToUse, Object.assign({}, sOpts, { state: stateToken }));
      if (!url) {
        return {
          ok: false,
          provider: spec.id,
          state: "owner_setup_required",
          registrationUrl: spec.registrationUrl,
          error: "Owner setup required"
        };
      }
      runtimeByProvider[spec.id] = {
        status: "awaiting_callback",
        stateToken: stateToken,
        authorizeUrl: url,
        startedAt: Date.now()
      };
      return {
        ok: true,
        provider: spec.id,
        state: "awaiting_callback",
        stateToken: stateToken,
        url: url
      };
    }

    function cancelAwait(providerId) {
      var canon = normalizeProviderId(providerId);
      if (canon && runtimeByProvider[canon] && runtimeByProvider[canon].status === "awaiting_callback") {
        delete runtimeByProvider[canon];
      }
      return getState(canon);
    }

    function receiveCallback(payload) {
      var p = payload || {};
      var fromState = parseProviderFromState(p.state || "");
      var canon = normalizeProviderId(p.provider || fromState);
      var spec = getProviderSpec(canon);
      if (!spec) {
        return { ok: false, state: "error", error: "Unrecognized OAuth callback provider." };
      }
      var cur = runtimeByProvider[spec.id];
      if (p.error) {
        var msg = p.error === "access_denied"
          ? "Access was not granted."
          : ("Authorization failed (" + String(p.error).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 48) + ").");
        runtimeByProvider[spec.id] = { status: "error", error: msg };
        return { ok: false, provider: spec.id, state: "error", error: msg };
      }
      if (cur && cur.status === "awaiting_callback" && cur.stateToken && p.state && cur.stateToken !== p.state) {
        var mismatch = "OAuth state mismatch — please start the connection again.";
        runtimeByProvider[spec.id] = { status: "error", error: mismatch };
        return { ok: false, provider: spec.id, state: "error", error: mismatch };
      }
      if (!p.code && !p.codeReceived) {
        var missing = "Callback missing authorization code.";
        runtimeByProvider[spec.id] = { status: "error", error: missing };
        return { ok: false, provider: spec.id, state: "error", error: missing };
      }
      var record = {
        provider: spec.id,
        state: p.state || (cur && cur.stateToken) || "",
        stateVerified: !!(cur && cur.stateToken && p.state === cur.stateToken) || !!p.stateVerified,
        receivedAt: p.receivedAt || new Date().toISOString(),
        status: "pending_gateway_wiring"
      };
      if (p.code) record.code = String(p.code);
      runtimeByProvider[spec.id] = {
        status: "callback_received",
        record: record
      };
      return {
        ok: true,
        provider: spec.id,
        state: "callback_received",
        message: "Callback received — paste-free flow pending gateway wiring",
        record: record
      };
    }

    function resetProvider(providerId) {
      var canon = normalizeProviderId(providerId);
      if (canon) delete runtimeByProvider[canon];
    }

    return {
      setOAuthConfig: setOAuthConfig,
      getOAuthConfig: getOAuthConfig,
      setServerStatus: setServerStatus,
      setStatusLoaded: setStatusLoaded,
      getState: getState,
      startAuth: startAuth,
      cancelAwait: cancelAwait,
      receiveCallback: receiveCallback,
      resetProvider: resetProvider
    };
  }

  return {
    OAUTH_PROVIDERS: OAUTH_PROVIDERS,
    CALLBACK_PATH: CALLBACK_PATH,
    CONFIG_ENDPOINT: CONFIG_ENDPOINT,
    normalizeProviderId: normalizeProviderId,
    getProviderSpec: getProviderSpec,
    isPlaceholderValue: isPlaceholderValue,
    mergeOAuthConfigs: mergeOAuthConfigs,
    resolveProviderConfig: resolveProviderConfig,
    makeStateToken: makeStateToken,
    parseProviderFromState: parseProviderFromState,
    buildAuthorizeUrl: buildAuthorizeUrl,
    fetchOAuthConfig: fetchOAuthConfig,
    serverHasOAuthConfig: serverHasOAuthConfig,
    deriveConnectorState: deriveConnectorState,
    createOAuthStateMachine: createOAuthStateMachine
  };
});
