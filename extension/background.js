// Service worker: side panel wiring + "Ask about this page / selection" context menu.
importScripts("lib.js"); // shared pure helpers (settings, question builders, frame rules)
const { buildQuestion, normalizeSettings, frameRules } = self.AISC;
const SITE = "https://ai.spaincos.com"; // update feed + default; the panel/tab site comes from settings
const MENU_PAGE = "ask-page";
const MENU_SELECTION = "ask-selection";

/* ---------------- self-update (v1.0.2) ----------------
   Chrome never auto-updates unpacked extensions by design. The extension now
   polls the site for a new version every 6h + on startup; when one exists the
   toolbar shows a NEW badge and a notification offers a one-click update
   (downloads the new zip + opens chrome://extensions). Zero-touch updates
   require the Chrome Web Store "unlisted" listing — the fallback until then. */
const VERSION_URL = SITE + "/extension-build/version.json";
const NOTIF_ID = "ext-update";

function newerVersion(remote, local) {
  const r = String(remote || "").split(".").map(Number), l = String(local || "").split(".").map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const d = (r[i] || 0) - (l[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

async function checkForUpdate() {
  try {
    const r = await fetch(VERSION_URL, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    const local = chrome.runtime.getManifest().version;
    if (!j.version || !newerVersion(j.version, local)) { chrome.action.setBadgeText({ text: "" }); return; }
    chrome.storage.local.set({ update: { version: j.version, zip: SITE + "/extension-build/" + j.zip, ts: Date.now() } }).catch(() => {});
    chrome.action.setBadgeText({ text: "NEW" });
    chrome.action.setBadgeBackgroundColor({ color: "#d92d20" });
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create(NOTIF_ID, {
        type: "basic", iconUrl: "icons/icon128.png",
        title: "ai.spaincos.com Assistant update available",
        message: `Version ${j.version} is ready (you have ${local}). Click to download it, then reload the extension.`,
        priority: 2
      }, () => void chrome.runtime.lastError);
    }
  } catch { /* offline: retry on next alarm */ }
}

chrome.notifications && chrome.notifications.onClicked && chrome.notifications.onClicked.addListener(async (id) => {
  if (id !== NOTIF_ID) return;
  const { update } = await chrome.storage.local.get({ update: null });
  const zip = (update && update.zip) || VERSION_URL.replace("version.json", "ai-spaincos-assistant.zip");
  chrome.downloads && chrome.downloads.download({ url: zip, saveAs: false }, () => void chrome.runtime.lastError);
  chrome.tabs.create({ url: "chrome://extensions/" });
  chrome.action.setBadgeText({ text: "" });
});

// Settings (site + model choice) live in chrome.storage.local under "settings"; always validated on read.
async function getSettings() {
  try { const { settings } = await chrome.storage.local.get("settings"); return normalizeSettings(settings); }
  catch { return normalizeSettings(null); }
}

// The site sends X-Frame-Options: DENY / frame-ancestors 'none'; relax it only for this extension's own iframe.
async function installFrameRules() {
  if (!(chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules)) return;
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1], addRules: frameRules(chrome.runtime.id) });
  } catch { /* leave any previous rule in place */ }
}
installFrameRules(); // idempotent; runs on every service-worker start so the rule can never go missing

chrome.alarms && chrome.alarms.create("update-check", { periodInMinutes: 360 });
chrome.alarms && chrome.alarms.onAlarm.addListener((a) => { if (a.name === "update-check") checkForUpdate(); });
chrome.runtime.onStartup.addListener(checkForUpdate);

chrome.runtime.onInstalled.addListener(() => {
  checkForUpdate();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_SELECTION, title: "Ask ai.spaincos.com about this selection", contexts: ["selection"] });
    chrome.contextMenus.create({ id: MENU_PAGE, title: "Ask ai.spaincos.com about this page", contexts: ["page", "frame"] });
  });
  // Clicking the toolbar icon opens the side panel (no popup).
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

// Fallback for browsers without the side panel API: toolbar icon opens the site in a tab.
chrome.action.onClicked.addListener(() => {
  if (!(chrome.sidePanel && chrome.sidePanel.open)) getSettings().then((st) => chrome.tabs.create({ url: st.site + "/" }));
});

// Let the site-bridge content script read the one-shot pending ask (tab fallback only).
if (chrome.storage.session && chrome.storage.session.setAccessLevel) {
  chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" }).catch(() => {});
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_PAGE && info.menuItemId !== MENU_SELECTION) return;
  dispatchAsk(buildQuestion(info, tab), tab);
});

function dispatchAsk(text, tab) {
  const pending = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 8), text, ts: Date.now() };

  // sidePanel.open() must run synchronously inside the user gesture, before any await.
  if (chrome.sidePanel && chrome.sidePanel.open && tab && tab.id !== undefined) {
    const opening = chrome.sidePanel.open({ tabId: tab.id });
    chrome.storage.session.set({ pendingAsk: pending }).catch(() => {});
    opening.catch(() => openInTab(pending));
  } else {
    openInTab(pending);
  }
}

// Fallback: open the full site in a new tab; site-bridge.js (top frame) consumes the pending ask.
function openInTab(pending) {
  Promise.all([chrome.storage.session.set({ pendingAsk: { ...pending, target: "tab" } }).catch(() => {}), getSettings()])
    .then(([, st]) => chrome.tabs.create({ url: st.site + "/" }));
}

// Use the command's tab so sidePanel.open runs before any await.
chrome.commands && chrome.commands.onCommand && chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-sidepanel") {
    const fallback = () => getSettings().then((st) => chrome.tabs.create({ url: st.site + "/" }));
    if (chrome.sidePanel?.open && tab?.id !== undefined) {
      chrome.sidePanel.open({ tabId: tab.id }).catch(fallback);
    } else {
      fallback();
    }
  } else if (command === "summarize-page" && /^https?:\/\//i.test(tab?.url || "")) {
    dispatchAsk(buildQuestion({ pageUrl: tab.url }, tab), tab);
  }
});
