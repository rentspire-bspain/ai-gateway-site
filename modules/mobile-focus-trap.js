/* mobile-focus-trap.js — v229: trap focus inside open modals/dialogs on phones.
   Fleet-audit fix (375px pass): without a trap, keyboard/SR users tab out of the
   settings/thread-restore dialogs into the page behind them. Runs on DOMContentLoaded,
   no dependencies, additive only. */
(function (root) {
  "use strict";
  function trap(host) {
    host.addEventListener("focusin", function (e) {
      if (!host.contains(e.target)) {
        var first = host.querySelector("button, input, select, a[href], [tabindex]");
        if (first) first.focus();
      }
    });
  }
  function init() {
    var doc = root.document;
    if (!doc) return;
    if (doc.__mft) return; doc.__mft = true;
    var sel = '[role="dialog"], dialog, .modal, [data-modal]';
    doc.querySelectorAll(sel).forEach(trap);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        (m.addedNodes || []).forEach(function (n) {
          if (n && n.querySelectorAll) {
            if (n.matches && n.matches(sel)) trap(n);
            n.querySelectorAll(sel).forEach(trap);
          }
        });
      });
    }).observe(doc.body, { childList: true, subtree: true });
  }
  if (root.BUILD && root.BUILD.modules) root.BUILD.modules.push({ id: "mobile-focus-trap", init: init });
  if (root.document && root.document.readyState !== "loading") init();
  else if (root.document) root.document.addEventListener("DOMContentLoaded", init);
})(window);
