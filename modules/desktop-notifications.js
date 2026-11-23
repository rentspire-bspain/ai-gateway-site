/* desktop-notifications.js — v230: Desktop phase 2 (1 of 2): native notifications.
   Perplexity-desktop parity: the site can raise a native OS notification when a
   thread finishes while the tab is backgrounded. Opt-in (the browser permission
   prompt is only shown on an explicit click), off by default, state remembered. */
(function (root) {
  "use strict";
  var KEY = "ai_native_notifications";
  function enabled() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
  function supported() { return typeof root.Notification === "function"; }
  function permission() { return supported() ? root.Notification.permission : "unsupported"; }

  function request(onDone) {
    if (!supported()) { onDone && onDone("unsupported"); return; }
    root.Notification.requestPermission().then(function (p) {
      try { localStorage.setItem(KEY, p === "granted" ? "1" : "0"); } catch (e) {}
      onDone && onDone(p);
    });
  }
  function disable() { try { localStorage.setItem(KEY, "0"); } catch (e) {} }

  /** Fire a native notification (only when enabled + granted + tab hidden). */
  function tr(x) { try { return root.I18N && root.I18N.t ? root.I18N.t(x) : x; } catch (e) { return x; } }
  function notify(title, body, onclickFocus) {
    if (!enabled() || !supported() || root.Notification.permission !== "granted") return false;
    if (!document.hidden) return false; // only when backgrounded — foreground has its own UI
    try {
      var n = new root.Notification(tr(String(title || "ai.spaincos.com").slice(0, 120)), {
        body: tr(String(body || "")).slice(0, 200), tag: "ai-thread-done", silent: false,
      });
      n.onclick = function () { try { root.focus(); } catch (e) {} if (onclickFocus) onclickFocus(); n.close(); };
      return true;
    } catch (e) { return false; }
  }

  // watch for thread completion: hook the app's response-ready signal
  function watch() {
    // the app signals a finished thread by updating the thread list / a DOM marker.
    // We watch for new assistant messages landing while the tab is hidden.
    var last = 0;
    root.addEventListener("message", function () {}, false); // no-op: keep alive
    // MutationObserver on the main thread area: an assistant bubble appearing while hidden = completion
    var host = document.getElementById("moduleRoot") || document.body;
    var obs = new MutationObserver(function () {
      if (!document.hidden) return;
      // debounce to one notification per completion burst
      var now = Date.now();
      if (now - last < 4000) return;
      var threads = document.querySelectorAll(".thread-item, [data-thread]");
      var t = (threads.length && (threads[threads.length - 1].textContent || "").trim().slice(0, 60)) || "your thread";
      last = now;
      notify("Response ready", t);
    });
    obs.observe(host, { childList: true, subtree: true });
  }

  root.DesktopNotifications = {
    supported: supported, permission: permission, enabled: enabled,
    request: request, disable: disable, notify: notify,
  };
  if (root.BUILD && root.BUILD.modules) root.BUILD.modules.push({ id: "desktop-notifications", init: watch });
  if (document.readyState !== "loading") watch();
  else document.addEventListener("DOMContentLoaded", watch);
})(window);
