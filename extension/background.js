// Service worker: side panel wiring + "Ask about this page / selection" context menu.
const SITE = "https://ai.spaincos.com";
const MAX_SELECTION = 2000;
const MENU_PAGE = "ask-page";
const MENU_SELECTION = "ask-selection";

chrome.runtime.onInstalled.addListener(() => {
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
  if (!(chrome.sidePanel && chrome.sidePanel.open)) chrome.tabs.create({ url: SITE + "/" });
});

// Let the site-bridge content script read the one-shot pending ask (tab fallback only).
if (chrome.storage.session && chrome.storage.session.setAccessLevel) {
  chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" }).catch(() => {});
}

function clean(s) { return String(s || "").replace(/\s+/g, " ").trim(); }

// The site's composer is a single-line input, so the question is built as one line.
function buildQuestion(info, tab) {
  const url = clean(info.pageUrl || (tab && tab.url));
  const title = clean(tab && tab.title).slice(0, 200);
  const where = title ? `"${title}" (${url})` : url;
  if (info.menuItemId === MENU_SELECTION && info.selectionText) {
    let sel = clean(info.selectionText);
    const cut = sel.length > MAX_SELECTION;
    sel = sel.slice(0, MAX_SELECTION) + (cut ? "…" : "");
    return `Explain this text selected on ${where}: "${sel}"`;
  }
  return `Read and summarize this page: ${where}`;
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_PAGE && info.menuItemId !== MENU_SELECTION) return;
  const pending = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 8), text: buildQuestion(info, tab), ts: Date.now() };

  // sidePanel.open() must run synchronously inside the user gesture, before any await.
  if (chrome.sidePanel && chrome.sidePanel.open && tab && tab.id !== undefined) {
    const opening = chrome.sidePanel.open({ tabId: tab.id });
    chrome.storage.session.set({ pendingAsk: pending }).catch(() => {});
    opening.catch(() => openInTab(pending));
  } else {
    openInTab(pending);
  }
});

// Fallback: open the full site in a new tab; site-bridge.js (top frame) consumes the pending ask.
function openInTab(pending) {
  chrome.storage.session.set({ pendingAsk: { ...pending, target: "tab" } })
    .finally(() => chrome.tabs.create({ url: SITE + "/" }));
}
