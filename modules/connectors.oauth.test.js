// Unit tests for Connector OAuth config mapping, state machine, UI cards, and callback stub (34c / 34e).
// Run: node --test modules/connectors.oauth.test.js
const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { Readable } = require("node:stream");

const OAuthCfg = require("./connectors.config.js");
const oauthCallbackHandler = require("../api/oauth-callback.js");
const oauthConfigHandler = require("../api/oauth-config.js");

const CFG_SRC = fs.readFileSync(path.join(__dirname, "connectors.config.js"), "utf8");
const UI_SRC = fs.readFileSync(path.join(__dirname, "connectors.js"), "utf8");
const CB_CLIENT_SRC = fs.readFileSync(path.join(__dirname, "oauth-callback-client.js"), "utf8");

const ENV_KEYS = [
  "SLACK_OAUTH_CLIENT_ID",
  "SLACK_OAUTH_SCOPE",
  "SLACK_OAUTH_USER_SCOPE",
  "DROPBOX_OAUTH_CLIENT_ID",
  "OUTLOOK_OAUTH_CLIENT_ID",
  "MICROSOFT_OAUTH_CLIENT_ID",
  "MICROSOFT_OAUTH_TENANT_ID",
  "BOX_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GITHUB_OAUTH_CLIENT_ID",
  "CONNECTOR_OAUTH_REDIRECT_URI"
];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

// ---------------- Minimal DOM harness for VM tests ----------------
function createMiniDom(opts = {}) {
  const storageMap = opts.storageMap || new Map();
  const localStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => { storageMap.set(k, String(v)); },
    removeItem: (k) => { storageMap.delete(k); }
  };

  function makeNode(tag) {
    const listeners = {};
    const node = {
      tagName: String(tag || "div").toUpperCase(),
      id: "",
      className: "",
      type: "",
      href: "",
      target: "",
      rel: "",
      title: "",
      value: "",
      placeholder: "",
      disabled: false,
      checked: false,
      isConnected: false,
      style: {},
      attributes: {},
      children: [],
      parentNode: null,
      _text: "",
      get textContent() {
        if (this.children.length === 0) return this._text;
        return this._text + this.children.map((c) => c.textContent).join("");
      },
      set textContent(v) {
        this._text = String(v == null ? "" : v);
        this.children.forEach((c) => { c.parentNode = null; setConnected(c, false); });
        this.children = [];
      },
      get childNodes() {
        return this.children;
      },
      setAttribute(k, v) {
        this.attributes[k] = String(v);
        if (k === "id") this.id = String(v);
      },
      getAttribute(k) {
        return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
      },
      appendChild(ch) {
        if (ch.parentNode) {
          ch.parentNode.children = ch.parentNode.children.filter((x) => x !== ch);
        }
        ch.parentNode = this;
        this.children.push(ch);
        setConnected(ch, this.isConnected);
        return ch;
      },
      remove() {
        if (this.parentNode) {
          this.parentNode.children = this.parentNode.children.filter((x) => x !== this);
          this.parentNode = null;
        }
        setConnected(this, false);
      },
      focus() {},
      select() {},
      addEventListener(ev, fn) {
        (listeners[ev] = listeners[ev] || []).push(fn);
      },
      dispatch(ev, payload = {}) {
        (listeners[ev] || []).forEach((fn) => fn(Object.assign({ isTrusted: true, target: node }, payload)));
      },
      findAll(pred, acc = []) {
        for (const ch of this.children) {
          if (pred(ch)) acc.push(ch);
          ch.findAll(pred, acc);
        }
        return acc;
      }
    };
    return node;
  }

  function setConnected(n, flag) {
    n.isConnected = flag;
    for (const c of n.children) setConnected(c, flag);
  }

  const body = makeNode("body");
  body.isConnected = true;
  const resultsContent = makeNode("div");
  resultsContent.setAttribute("id", "resultsContent");
  body.appendChild(resultsContent);

  const byId = { resultsContent };
  const docListeners = {};
  const winListeners = {};
  const openedTabs = [];
  const copiedTexts = [];
  const replacedUrls = [];
  const channelSubscribers = opts.channelSubscribers || [];

  class FakeBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      channelSubscribers.push(this);
    }
    postMessage(data) {
      for (const sub of channelSubscribers) {
        if (sub !== this && sub.name === this.name && typeof sub.onmessage === "function") {
          sub.onmessage({ data });
        }
      }
    }
    close() {}
  }

  const document = {
    readyState: "complete",
    body,
    createElement: (tag) => makeNode(tag),
    execCommand: () => true,
    getElementById: (id) => {
      if (byId[id]) return byId[id];
      const found = body.findAll((n) => n.id === id)[0];
      return found || null;
    },
    addEventListener: (ev, fn) => { (docListeners[ev] = docListeners[ev] || []).push(fn); },
    removeEventListener: () => {}
  };

  const locUrl = new URL(opts.url || "https://ai.spaincos.com/");
  const location = {
    origin: locUrl.origin,
    pathname: locUrl.pathname,
    search: locUrl.search,
    hash: locUrl.hash,
    href: locUrl.href,
    assign(next) { this.href = next; }
  };

  const windowObj = {
    window: null,
    globalThis: null,
    document,
    localStorage,
    location,
    URL,
    URLSearchParams,
    BroadcastChannel: FakeBroadcastChannel,
    crypto: { randomUUID: () => "11112222-3333-4444-5555-666677778888" },
    navigator: {
      clipboard: {
        writeText: async (txt) => { copiedTexts.push(txt); }
      }
    },
    history: {
      replaceState(_st, _title, nextUrl) {
        replacedUrls.push(nextUrl);
        const u = new URL(nextUrl, location.origin);
        location.pathname = u.pathname;
        location.search = u.search;
        location.hash = u.hash;
      }
    },
    open(url, target, features) {
      openedTabs.push({ url, target, features });
      return { closed: false };
    },
    confirm: () => true,
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    addEventListener: (ev, fn) => { (winListeners[ev] = winListeners[ev] || []).push(fn); },
    CONNECTOR_OAUTH: opts.CONNECTOR_OAUTH !== undefined ? opts.CONNECTOR_OAUTH : undefined,
    GATEWAY: "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1",
    sb: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: "jwt-test" } } })
      }
    },
    SettingsUI: { open: () => {} },
    fetch: opts.fetch || (async () => ({ ok: false, status: 404, json: async () => ({}) }))
  };
  windowObj.window = windowObj;
  windowObj.globalThis = windowObj;

  return {
    windowObj,
    document,
    body,
    resultsContent,
    byId,
    makeNode,
    storageMap,
    openedTabs,
    copiedTexts,
    replacedUrls,
    channelSubscribers,
    winListeners
  };
}

async function flushMicrotasks(turns = 6) {
  for (let i = 0; i < turns; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

async function invokeHandler(handler, { method = "GET", url = "/api/oauth-callback", headers = {}, body = null } = {}) {
  const req = Readable.from(body && typeof body === "string" ? [body] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;
  if (body && typeof body === "object") req.body = body;
  let status = 200;
  let outHeaders = {};
  let outBody = "";
  await handler(req, {
    writeHead(s, h) { status = s; outHeaders = h || {}; },
    end(chunk) { if (chunk !== undefined) outBody += String(chunk); }
  });
  return { status, headers: outHeaders, body: outBody };
}

// ---------------- 1. Config mapping & authorize URL tests ----------------
test("maps Slack, Dropbox, Microsoft/Outlook, Box, and Google to exact authorize and registration URLs", () => {
  const cfg = {
    redirectUri: "https://ai.spaincos.com/api/oauth-callback",
    slack: { clientId: "slack-cid-101", scope: "channels:read,search:read", userScope: "search:read" },
    dropbox: { client_id: "dbx-cid-202" },
    microsoft: { clientId: "msft-cid-303" },
    box: { clientId: "box-cid-404" },
    google: { clientId: "goog-cid-505.apps.googleusercontent.com" }
  };

  // Slack
  const slackUrl = new URL(OAuthCfg.buildAuthorizeUrl("slack", cfg, { state: "slack:st1" }));
  assert.equal(`${slackUrl.origin}${slackUrl.pathname}`, "https://slack.com/oauth/v2/authorize");
  assert.equal(slackUrl.searchParams.get("client_id"), "slack-cid-101");
  assert.equal(slackUrl.searchParams.get("scope"), "channels:read,search:read");
  assert.equal(slackUrl.searchParams.get("user_scope"), "search:read");
  assert.equal(slackUrl.searchParams.get("redirect_uri"), "https://ai.spaincos.com/api/oauth-callback");
  assert.equal(slackUrl.searchParams.get("state"), "slack:st1");
  assert.equal(OAuthCfg.getProviderSpec("slack").registrationUrl, "https://api.slack.com/apps");

  // Dropbox
  const dbxUrl = new URL(OAuthCfg.buildAuthorizeUrl("dropbox", cfg, { state: "dropbox:st2" }));
  assert.equal(`${dbxUrl.origin}${dbxUrl.pathname}`, "https://www.dropbox.com/oauth2/authorize");
  assert.equal(dbxUrl.searchParams.get("client_id"), "dbx-cid-202");
  assert.equal(dbxUrl.searchParams.get("response_type"), "code");
  assert.equal(dbxUrl.searchParams.get("token_access_type"), "offline");
  assert.equal(dbxUrl.searchParams.get("redirect_uri"), "https://ai.spaincos.com/api/oauth-callback");
  assert.equal(OAuthCfg.getProviderSpec("dropbox").registrationUrl, "https://www.dropbox.com/developers/apps");

  // Outlook / Microsoft alias
  const msUrl = new URL(OAuthCfg.buildAuthorizeUrl("outlook", cfg, { state: "outlook:st3" }));
  assert.equal(`${msUrl.origin}${msUrl.pathname}`, "https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  assert.equal(msUrl.searchParams.get("client_id"), "msft-cid-303");
  assert.equal(msUrl.searchParams.get("response_type"), "code");
  assert.equal(msUrl.searchParams.get("response_mode"), "query");
  assert.match(msUrl.searchParams.get("scope"), /Mail\.Read/);
  assert.equal(OAuthCfg.getProviderSpec("microsoft").registrationUrl, "https://entra.microsoft.com");

  // Box
  const boxUrl = new URL(OAuthCfg.buildAuthorizeUrl("box", cfg, { state: "box:st4" }));
  assert.equal(`${boxUrl.origin}${boxUrl.pathname}`, "https://app.box.com/api/oauth2/authorize");
  assert.equal(boxUrl.searchParams.get("client_id"), "box-cid-404");
  assert.equal(boxUrl.searchParams.get("response_type"), "code");
  assert.equal(OAuthCfg.getProviderSpec("box").registrationUrl, "https://app.box.com/developers/console");

  // Google / Gmail alias
  const googUrl = new URL(OAuthCfg.buildAuthorizeUrl("gmail", cfg, { state: "google:st5" }));
  assert.equal(`${googUrl.origin}${googUrl.pathname}`, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(googUrl.searchParams.get("client_id"), "goog-cid-505.apps.googleusercontent.com");
  assert.equal(googUrl.searchParams.get("access_type"), "offline");
  assert.equal(googUrl.searchParams.get("prompt"), "consent");
  assert.equal(OAuthCfg.getProviderSpec("google").registrationUrl, "https://console.cloud.google.com/apis/credentials");
});

test("rejects placeholder client_ids and unsafe redirect URIs", () => {
  const placeholders = ["", "   ", "YOUR_CLIENT_ID", "<CLIENT_ID>", "{{client_id}}", "${SLACK_ID}", "REPLACE_ME", "todo", "...", "null", "undefined"];
  for (const bad of placeholders) {
    const resolved = OAuthCfg.resolveProviderConfig("slack", { slack: { clientId: bad } });
    assert.equal(resolved.configured, false, `expected placeholder '${bad}' to be unconfigured`);
    assert.equal(OAuthCfg.buildAuthorizeUrl("slack", { slack: { clientId: bad } }), null);
  }

  // Unsafe javascript: redirect falls back to https://ai.spaincos.com/api/oauth-callback
  const safeFallback = OAuthCfg.resolveProviderConfig("box", {
    redirectUri: "javascript:alert(1)",
    box: { clientId: "real-box-id" }
  }, { origin: "https://ai.spaincos.com" });
  assert.equal(safeFallback.configured, true);
  assert.equal(safeFallback.redirectUri, "https://ai.spaincos.com/api/oauth-callback");
});

test("fetchOAuthConfig merges /api/oauth-config with window.CONNECTOR_OAUTH and falls back to null on error", async () => {
  const remoteOnly = await OAuthCfg.fetchOAuthConfig({
    fetch: async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        redirectUri: "https://ai.spaincos.com/api/oauth-callback",
        providers: { slack: { clientId: "remote-slack-id" }, dropbox: null }
      })
    }),
    windowConfig: { box: { clientId: "win-box-id" } }
  });
  assert.equal(OAuthCfg.resolveProviderConfig("slack", remoteOnly).clientId, "remote-slack-id");
  assert.equal(OAuthCfg.resolveProviderConfig("box", remoteOnly).clientId, "win-box-id");
  assert.equal(OAuthCfg.resolveProviderConfig("dropbox", remoteOnly).configured, false);

  // Network failure with no window config -> null
  const failedNull = await OAuthCfg.fetchOAuthConfig({
    fetch: async () => { throw new Error("network down"); },
    windowConfig: null
  });
  assert.equal(failedNull, null);

  // 404 with window config -> preserves window config
  const fallbackWin = await OAuthCfg.fetchOAuthConfig({
    fetch: async () => ({ ok: false, status: 404 }),
    windowConfig: { dropbox: { clientId: "local-dbx-id" } }
  });
  assert.equal(OAuthCfg.resolveProviderConfig("dropbox", fallbackWin).clientId, "local-dbx-id");
});

// ---------------- 2. State machine unit tests ----------------
test("state machine transitions: checking -> owner_setup_required -> ready -> awaiting_callback -> callback_received", () => {
  const sm = OAuthCfg.createOAuthStateMachine({ origin: "https://ai.spaincos.com" });

  // 1. Before status loads and no config: checking
  assert.equal(sm.getState("slack").state, "checking");

  // 2. Status loaded, no OAuth config: owner_setup_required + registration URL
  sm.setStatusLoaded(true);
  const setupSt = sm.getState("slack");
  assert.equal(setupSt.state, "owner_setup_required");
  assert.equal(setupSt.buttonLabel, "Owner setup required");
  assert.equal(setupSt.registrationUrl, "https://api.slack.com/apps");
  assert.equal(setupSt.canConnect, false);

  // Attempting startAuth without config stays in owner_setup_required
  const blocked = sm.startAuth("slack");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.state, "owner_setup_required");
  assert.equal(blocked.registrationUrl, "https://api.slack.com/apps");

  // 3. Injecting config transitions to ready
  sm.setOAuthConfig({ slack: { clientId: "12345.67890" } });
  const readySt = sm.getState("slack");
  assert.equal(readySt.state, "ready");
  assert.equal(readySt.buttonLabel, "Connect Slack");
  assert.equal(readySt.canConnect, true);

  // 4. Starting auth transitions to awaiting_callback
  const started = sm.startAuth("slack", { randFn: () => "nonce99" });
  assert.equal(started.ok, true);
  assert.equal(started.state, "awaiting_callback");
  assert.equal(started.stateToken, "slack:nonce99");
  assert.match(started.url, /^https:\/\/slack\.com\/oauth\/v2\/authorize\?/);

  const awaitingSt = sm.getState("slack");
  assert.equal(awaitingSt.state, "awaiting_callback");
  assert.equal(awaitingSt.buttonLabel, "Awaiting callback…");
  assert.equal(awaitingSt.canConnect, false);

  // 5. State mismatch is rejected cleanly
  const badCb = sm.receiveCallback({ provider: "slack", code: "x", state: "slack:wrong" });
  assert.equal(badCb.ok, false);
  assert.equal(badCb.state, "error");
  assert.match(badCb.error, /state mismatch/i);

  // Re-start and receive valid callback -> callback_received
  sm.startAuth("slack", { randFn: () => "nonce100" });
  const okCb = sm.receiveCallback({ code: "code_abc_123", state: "slack:nonce100" });
  assert.equal(okCb.ok, true);
  assert.equal(okCb.state, "callback_received");
  assert.equal(okCb.message, "Callback received — paste-free flow pending gateway wiring");
  assert.equal(okCb.record.code, "code_abc_123");
  assert.equal(okCb.record.stateVerified, true);

  const cbSt = sm.getState("slack");
  assert.equal(cbSt.state, "callback_received");
  assert.equal(cbSt.subLabel, "Callback received — paste-free flow pending gateway wiring");

  // 6. Server status connected overrides runtime stub state
  sm.setServerStatus("slack", { connected: true, account: "spaincos" });
  const connSt = sm.getState("slack");
  assert.equal(connSt.state, "connected");
  assert.equal(connSt.subLabel, "Connected — spaincos");
});

test("state machine cancelAwait and access_denied recovery", () => {
  const sm = OAuthCfg.createOAuthStateMachine({
    statusLoaded: true,
    oauthConfig: { dropbox: { clientId: "dbx-live" } }
  });
  sm.startAuth("dropbox", { randFn: () => "n1" });
  assert.equal(sm.getState("dropbox").state, "awaiting_callback");

  const afterCancel = sm.cancelAwait("dropbox");
  assert.equal(afterCancel.state, "ready");

  sm.startAuth("dropbox", { randFn: () => "n2" });
  const denied = sm.receiveCallback({ provider: "dropbox", error: "access_denied", state: "dropbox:n2" });
  assert.equal(denied.ok, false);
  assert.equal(denied.error, "Access was not granted.");
  assert.equal(sm.getState("dropbox").canConnect, true);
});

// ---------------- 3. UI card + cross-tab callback flow tests ----------------
test("ConnectorsUI renders Owner setup required with copyable/one-tap URLs when unconfigured, and completes new-tab -> callback stub flow when configured", async () => {
  const sharedStorage = new Map();
  const sharedChannels = [];

  const appEnv = createMiniDom({
    storageMap: sharedStorage,
    channelSubscribers: sharedChannels,
    fetch: async (url) => {
      if (String(url).includes("/api/oauth-config")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, providers: { slack: null, dropbox: null, outlook: null, box: null } }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          providers: {
            google: { configured: { oauth_client: false }, connected: false, services: {} },
            slack: { provider: "slack", configured: false, kind: "oauth", connected: false },
            dropbox: { provider: "dropbox", configured: false, kind: "oauth", connected: false }
          }
        })
      };
    }
  });

  vm.runInNewContext(CFG_SRC, appEnv.windowObj);
  vm.runInNewContext(UI_SRC, appEnv.windowObj);

  const host = appEnv.windowObj.ConnectorsUI.card();
  appEnv.body.appendChild(host);
  await flushMicrotasks();

  const expectedReg = {
    google: "https://console.cloud.google.com/apis/credentials",
    slack: "https://api.slack.com/apps",
    dropbox: "https://www.dropbox.com/developers/apps",
    outlook: "https://entra.microsoft.com",
    box: "https://app.box.com/developers/console"
  };

  for (const [prov, regUrl] of Object.entries(expectedReg)) {
    const card = host.findAll((n) => n.getAttribute("data-provider") === prov)[0];
    assert.ok(card, `missing card for ${prov}`);
    assert.equal(card.getAttribute("data-oauth-state"), "owner_setup_required");
    const ownerBtn = card.findAll((n) => n.tagName === "BUTTON" && n.textContent === "Owner setup required")[0];
    assert.ok(ownerBtn, `missing 'Owner setup required' button for ${prov}`);
    const link = card.findAll((n) => n.tagName === "A" && n.href === regUrl)[0];
    assert.ok(link, `missing direct registration link ${regUrl} for ${prov}`);
    assert.equal(link.target, "_blank");
    const copyBtn = card.findAll((n) => n.tagName === "BUTTON" && n.textContent === "Copy URL")[0];
    assert.ok(copyBtn, `missing Copy URL button for ${prov}`);
    copyBtn.dispatch("click");
    await flushMicrotasks(2);
    assert.equal(appEnv.copiedTexts.at(-1), regUrl);
  }

  // Inject Slack OAuth credentials -> Connect Slack appears, opens authorize URL in _blank, enters awaiting_callback
  appEnv.windowObj.ConnectorsUI.setOAuthConfig({
    redirectUri: "https://ai.spaincos.com/api/oauth-callback",
    slack: { clientId: "slack-live-client-999", scope: "channels:read,search:read" }
  });

  let slackCard = host.findAll((n) => n.getAttribute("data-provider") === "slack")[0];
  assert.equal(slackCard.getAttribute("data-oauth-state"), "ready");
  const connectBtn = slackCard.findAll((n) => n.tagName === "BUTTON" && n.textContent === "Connect Slack")[0];
  assert.ok(connectBtn, "Connect Slack button should render once config exists");

  connectBtn.dispatch("click");
  assert.equal(appEnv.openedTabs.length, 1);
  assert.equal(appEnv.openedTabs[0].target, "_blank");
  const openedUrl = new URL(appEnv.openedTabs[0].url);
  assert.equal(`${openedUrl.origin}${openedUrl.pathname}`, "https://slack.com/oauth/v2/authorize");
  assert.equal(openedUrl.searchParams.get("client_id"), "slack-live-client-999");
  const issuedState = openedUrl.searchParams.get("state");
  assert.match(issuedState, /^slack:/);

  slackCard = host.findAll((n) => n.getAttribute("data-provider") === "slack")[0];
  assert.equal(slackCard.getAttribute("data-oauth-state"), "awaiting_callback");
  assert.ok(slackCard.findAll((n) => n.tagName === "BUTTON" && n.textContent === "Awaiting callback…")[0]);

  // Simulate /api/oauth-callback landing in the opened tab
  const cbEnv = createMiniDom({
    storageMap: sharedStorage,
    channelSubscribers: sharedChannels,
    url: `https://ai.spaincos.com/api/oauth-callback?code=xox_oauth_code_777&state=${encodeURIComponent(issuedState)}`
  });
  const rootMain = cbEnv.makeNode("main");
  rootMain.setAttribute("id", "oauth-callback-root");
  cbEnv.body.appendChild(rootMain);
  vm.runInNewContext(CB_CLIENT_SRC, cbEnv.windowObj);

  // URL cleaned immediately, code stored for gateway, opener tab transitioned to callback_received + system note posted
  assert.equal(cbEnv.replacedUrls[0], "/api/oauth-callback");
  const storedCodes = JSON.parse(sharedStorage.get("ai_oauth_pending_codes"));
  assert.equal(storedCodes.slack.code, "xox_oauth_code_777");
  assert.equal(storedCodes.slack.stateVerified, true);
  assert.equal(storedCodes.slack.status, "pending_gateway_wiring");

  slackCard = host.findAll((n) => n.getAttribute("data-provider") === "slack")[0];
  assert.equal(slackCard.getAttribute("data-oauth-state"), "callback_received");
  assert.match(slackCard.textContent, /Callback received — paste-free flow pending gateway wiring/);
  assert.match(appEnv.resultsContent.textContent, /\[System\] Slack: Callback received — paste-free flow pending gateway wiring/);
});

// ---------------- 4. Serverless API handler tests ----------------
test("api/oauth-callback.js handles HTML redirect, JSON mode, missing code, and XSS escaping", async () => {
  const htmlRes = await invokeHandler(oauthCallbackHandler, {
    method: "GET",
    url: "/api/oauth-callback?code=supersecretcode9876&state=outlook:xyz",
    headers: { accept: "text/html" }
  });
  assert.equal(htmlRes.status, 200);
  assert.match(htmlRes.headers["Content-Security-Policy"], /script-src 'self'/);
  assert.doesNotMatch(htmlRes.body, /<script>[\s\S]*<\/script>/i);
  assert.match(htmlRes.body, /Callback received — paste-free flow pending gateway wiring/);
  assert.match(htmlRes.body, /supe…9876/);

  const jsonRes = await invokeHandler(oauthCallbackHandler, {
    method: "GET",
    url: "/api/oauth-callback?code=abcdef123456&state=box:42",
    headers: { accept: "application/json" }
  });
  assert.equal(jsonRes.status, 200);
  const parsed = JSON.parse(jsonRes.body);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.provider, "box");
  assert.equal(parsed.status, "callback_received");
  assert.equal(parsed.message, "Callback received — paste-free flow pending gateway wiring");

  const missingRes = await invokeHandler(oauthCallbackHandler, {
    method: "GET",
    url: "/api/oauth-callback",
    headers: { accept: "application/json" }
  });
  assert.equal(missingRes.status, 400);

  const xssRes = await invokeHandler(oauthCallbackHandler, {
    method: "GET",
    url: "/api/oauth-callback?error=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E",
    headers: { accept: "text/html" }
  });
  assert.equal(xssRes.status, 200);
  assert.doesNotMatch(xssRes.body, /<img src=x/i);
});

test("api/oauth-config.js returns null entries by default and populates clientIds when env vars exist", async () => {
  const emptyRes = await invokeHandler(oauthConfigHandler, { method: "GET", url: "/api/oauth-config", headers: { host: "ai.spaincos.com" } });
  assert.equal(emptyRes.status, 200);
  const emptyBody = JSON.parse(emptyRes.body);
  assert.equal(emptyBody.ok, true);
  assert.equal(emptyBody.redirectUri, "https://ai.spaincos.com/api/oauth-callback");
  assert.equal(emptyBody.providers.slack, null);
  assert.equal(emptyBody.providers.outlook, null);

  process.env.SLACK_OAUTH_CLIENT_ID = "slack-env-id";
  process.env.MICROSOFT_OAUTH_CLIENT_ID = "msft-env-id";
  const cfgRes = await invokeHandler(oauthConfigHandler, { method: "GET", url: "/api/oauth-config", headers: { host: "ai.spaincos.com" } });
  const cfgBody = JSON.parse(cfgRes.body);
  assert.deepEqual(cfgBody.providers.slack, { clientId: "slack-env-id" });
  assert.deepEqual(cfgBody.providers.outlook, { clientId: "msft-env-id" });
  assert.equal(cfgBody.providers.box, null);
});
