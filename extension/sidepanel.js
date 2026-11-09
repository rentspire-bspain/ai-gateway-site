// Side panel: hosts the ai.spaincos.com chat in an iframe and forwards "ask" requests to the
// site-bridge content script running inside that iframe (via postMessage, origin-checked).
const SITE = "https://ai.spaincos.com";
const frame = document.getElementById("site");
const MAX_AGE_MS = 60_000;
let bridgeReady = false;
const handled = new Set();

frame.src = SITE + "/";
document.getElementById("reload").onclick = () => { bridgeReady = false; frame.src = SITE + "/"; };
document.getElementById("openTab").onclick = () => chrome.tabs.create({ url: SITE + "/" });

window.addEventListener("message", (e) => {
  if (e.origin !== SITE || e.source !== frame.contentWindow) return;
  if (e.data && e.data.source === "aispaincos-bridge" && e.data.type === "ready") { bridgeReady = true; checkPending(); }
});
frame.addEventListener("load", () => { bridgeReady = false; });

// Deliver one ask: retry until the bridge acks (it may still be loading), give up after ~20s.
function deliver(pending) {
  if (handled.has(pending.id)) return;
  handled.add(pending.id);
  let tries = 0;
  const onAck = (e) => {
    if (e.origin === SITE && e.source === frame.contentWindow && e.data && e.data.source === "aispaincos-bridge" && e.data.type === "ack" && e.data.id === pending.id) {
      window.removeEventListener("message", onAck);
      clearInterval(timer);
      chrome.storage.session.remove("pendingAsk").catch(() => {});
    }
  };
  window.addEventListener("message", onAck);
  const timer = setInterval(() => {
    if (++tries > 40) { clearInterval(timer); window.removeEventListener("message", onAck); return; }
    try { frame.contentWindow.postMessage({ source: "aispaincos-ext", type: "ask", id: pending.id, text: pending.text, submit: true }, SITE); } catch (_e) { /* iframe not ready */ }
  }, 500);
}

async function checkPending() {
  try {
    const { pendingAsk } = await chrome.storage.session.get("pendingAsk");
    if (pendingAsk && pendingAsk.target !== "tab" && Date.now() - pendingAsk.ts < MAX_AGE_MS) deliver(pendingAsk);
  } catch (_e) { /* storage unavailable */ }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.pendingAsk && changes.pendingAsk.newValue) checkPending();
});
checkPending();
