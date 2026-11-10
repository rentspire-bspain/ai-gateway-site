// Content script for https://ai.spaincos.com/* (all frames). Does two things without any change to the site:
//   1. SIGN-IN REUSE: mirrors the site's Supabase session (localStorage key sb-<ref>-auth-token) through
//      chrome.storage.local so the side-panel copy of the site (whose storage may be partitioned) and a
//      normal tab stay signed in together. Sign-out in one place signs out the other.
//   2. ASK: receives {type:"ask"} from the side panel (postMessage, extension-origin checked) or a pending
//      ask from the background (tab fallback), types it into the site's composer and presses Enter.
(() => {
  "use strict";
  const IS_TOP = window === window.top;
  const AUTH_KEY_RE = /^sb-[a-z0-9]+-auth-token$/;
  const STORE = "authSession";
  const EXT_ORIGIN = "chrome-extension://" + chrome.runtime.id;
  let known = null; // last session string this frame has synced (to tell "signed out" from "not yet synced")

  const alive = () => { try { return !!chrome.runtime.id; } catch (_e) { return false; } };

  // ---------- session sync ----------
  function localEntry() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && AUTH_KEY_RE.test(k)) return { key: k, value: localStorage.getItem(k) };
      }
    } catch (_e) { /* storage blocked */ }
    return null;
  }
  function expiry(value) {
    try { const j = JSON.parse(value); return j && j.access_token && j.refresh_token ? Number(j.expires_at) || 1 : 0; } catch (_e) { return 0; }
  }
  const get = () => new Promise((res) => { try { chrome.storage.local.get(STORE, (r) => res((r && r[STORE]) || null)); } catch (_e) { res(null); } });
  const put = (v) => { try { chrome.storage.local.set({ [STORE]: v }); } catch (_e) { /* ignore */ } };
  const del = () => { try { chrome.storage.local.remove(STORE); } catch (_e) { /* ignore */ } };
  function reloadOnce(tag) {
    try {
      if (sessionStorage.getItem("aisc_bridge_reload") === tag) return;
      sessionStorage.setItem("aisc_bridge_reload", tag);
    } catch (_e) { return; }
    location.reload();
  }

  async function syncOnStart() {
    const loc = localEntry();
    const stored = await get();
    const locExp = loc ? expiry(loc.value) : 0;
    if (stored && stored.value && expiry(stored.value) > locExp) {
      // Shared session is newer (or we have none): adopt it, and reload once so the site picks it up.
      try { localStorage.setItem(stored.key, stored.value); known = stored.value; reloadOnce(String(stored.expires_at)); } catch (_e) { /* ignore */ }
    } else if (loc && locExp) {
      known = loc.value;
      if (!stored || locExp > expiry(stored.value)) put({ key: loc.key, value: loc.value, expires_at: locExp });
    }
  }

  function watchLocal() {
    setInterval(() => {
      if (!alive()) return;
      const loc = localEntry();
      const val = loc && expiry(loc.value) ? loc.value : null;
      if (val && val !== known) { known = val; put({ key: loc.key, value: val, expires_at: expiry(val) }); }
      else if (!val && known) { known = null; del(); } // signed out here
    }, 1000);
  }
  // Sign-out fix: the site signs out and reloads immediately, faster than the 1 s poll above. Flush the
  // sign-out to the shared store on pagehide so the next page load does not re-adopt the stale session.
  window.addEventListener("pagehide", () => {
    if (!alive()) return;
    const loc = localEntry();
    if (known && !(loc && expiry(loc.value))) { known = null; del(); }
  });
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== "local" || !ch[STORE]) return;
      const nv = ch[STORE].newValue;
      const loc = localEntry();
      if (!nv) { // signed out elsewhere
        if (loc && known) { try { localStorage.removeItem(loc.key); } catch (_e) { /* ignore */ } known = null; reloadOnce("out-" + Date.now()); }
        return;
      }
      if (loc && loc.value === nv.value) return;
      if (expiry(nv.value) > (loc ? expiry(loc.value) : 0)) { try { localStorage.setItem(nv.key, nv.value); known = nv.value; } catch (_e) { /* ignore */ } }
    });
  } catch (_e) { /* ignore */ }

  // ---------- ask injection ----------
  const visible = (el) => !!el && el.offsetParent !== null && !el.disabled;
  function pickInput() {
    return ["landingInput", "followupInput", "searchbarInput"].map((id) => document.getElementById(id)).find(visible) || null;
  }
  function setValue(el, text) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  async function ask(text, submit) {
    const deadline = Date.now() + 10000;
    // Wait for the site's inline script to bind its Enter handler (it runs while the document is still parsing).
    while (document.readyState !== "complete" && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    let el = pickInput();
    while (!el && Date.now() < deadline) { await new Promise((r) => setTimeout(r, 200)); el = pickInput(); }
    if (!el) return false;
    el.focus();
    setValue(el, String(text).slice(0, 4000));
    if (submit) {
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    }
    return true;
  }

  if (!IS_TOP) {
    window.addEventListener("message", async (e) => {
      if (e.origin !== EXT_ORIGIN || e.source !== window.parent) return;
      const d = e.data;
      if (!d || d.source !== "aispaincos-ext" || d.type !== "ask" || typeof d.text !== "string") return;
      // One ask() per id; retries from the panel wait for the same result instead of getting a premature ack.
      const done = (window.__aiscDone = window.__aiscDone || new Map());
      if (!done.has(d.id)) done.set(d.id, ask(d.text, d.submit !== false));
      const ok = await done.get(d.id);
      if (!ok) done.delete(d.id); // allow a later retry if the composer was not found
      e.source.postMessage({ source: "aispaincos-bridge", type: ok ? "ack" : "nack", id: d.id }, e.origin);
    });
    // Tell the side panel we are listening.
    const hello = () => { try { window.parent.postMessage({ source: "aispaincos-bridge", type: "ready" }, EXT_ORIGIN); } catch (_e) { /* ignore */ } };
    hello();
    document.addEventListener("DOMContentLoaded", hello);
    window.addEventListener("load", hello);
  } else {
    // Tab fallback: background stored an ask targeted at a tab; consume it once.
    const consume = async () => {
      try {
        const r = await chrome.storage.session.get("pendingAsk");
        const p = r && r.pendingAsk;
        if (p && p.target === "tab" && Date.now() - p.ts < 30000) {
          await chrome.storage.session.remove("pendingAsk");
          await ask(p.text, true);
        }
      } catch (_e) { /* session storage not exposed to content scripts */ }
    };
    window.addEventListener("load", consume);
  }

  syncOnStart().then(watchLocal);
})();
