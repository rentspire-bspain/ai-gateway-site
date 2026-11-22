/* mobile-focus-trap.js — keyboard / screen-reader focus containment.
   v311 rewrite. The v229 version attached a `focusin` listener to each dialog and tested
   `!host.contains(e.target)` — a focusin that fires on the host is always inside it, so that trap
   could never trigger (verified: Tab walked straight out of every dialog). This version:

   1. Mobile sidebar drawer (body.sidebar-open, set by index.html when the drawer is open at <=768px):
      - moves focus into the drawer on open and returns it to the opener on close,
      - makes the page behind (main) inert so neither Tab nor a screen reader can reach it,
      - wraps Tab / Shift+Tab inside the drawer, and Escape closes it.
   2. Any visible [aria-modal="true"] dialog (settings, library, projects, skills, tasks, ...): Tab and
      Shift+Tab wrap inside the topmost one, and Tab from outside it moves focus into it.
      Deliberately keyboard-only (no focusin pulling): pointer/touch use and transient popups such as
      menus appended to <body> keep working exactly as before. */
(function (root) {
  "use strict";
  var doc = root.document;
  if (!doc) return;

  var FOCUSABLE = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]';
  var drawerOpener = null;
  var drawerWasOpen = false;
  var drawerLabel = null;

  function isShown(el) {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    var cs = root.getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
    return true;
  }

  function focusables(container) {
    return Array.prototype.filter.call(container.querySelectorAll(FOCUSABLE), function (el) {
      if (el.disabled || el.tabIndex < 0) return false;
      if (el.closest("[hidden],[inert]")) return false;
      return isShown(el);
    });
  }

  // topmost visible modal dialog = the last aria-modal element in DOM order that is really on screen
  function topModal() {
    var list = doc.querySelectorAll('[aria-modal="true"]');
    for (var i = list.length - 1; i >= 0; i--) {
      var el = list[i];
      if (el.closest("[hidden],[inert]") || !isShown(el)) continue;
      var cs = root.getComputedStyle(el);
      if (cs.opacity === "0" || cs.pointerEvents === "none") continue;
      var r = el.getBoundingClientRect();
      if (r.right <= 0 || r.bottom <= 0 || r.left >= root.innerWidth || r.top >= root.innerHeight) continue; // parked off-screen
      return el;
    }
    return null;
  }

  function drawerEl() { return doc.getElementById("sidebar"); }
  function drawerIsOpen() { return doc.body.classList.contains("sidebar-open"); }

  function setBackgroundInert(on) {
    var sb = drawerEl();
    var main = doc.querySelector("main.main, .main");
    if (!main || (sb && main.contains(sb))) return;
    if ("inert" in main) main.inert = on;
    else if (on) main.setAttribute("aria-hidden", "true");
    else main.removeAttribute("aria-hidden");
  }

  function syncExpandedState(open) {
    var exp = doc.getElementById("expandSidebar");
    if (exp) exp.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function onDrawerChange() {
    var open = drawerIsOpen();
    if (open === drawerWasOpen) return;
    drawerWasOpen = open;
    var sb = drawerEl();
    var closeBtn = doc.getElementById("collapseSidebar");
    syncExpandedState(open);
    setBackgroundInert(open);
    if (open) {
      drawerOpener = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : doc.getElementById("expandSidebar");
      if (closeBtn) { drawerLabel = closeBtn.getAttribute("aria-label"); closeBtn.setAttribute("aria-label", "Close sidebar"); }
      root.requestAnimationFrame(function () {
        if (!drawerIsOpen() || !sb) return;
        var target = closeBtn && isShown(closeBtn) ? closeBtn : focusables(sb)[0];
        if (target) target.focus();
      });
    } else {
      if (closeBtn && drawerLabel) closeBtn.setAttribute("aria-label", drawerLabel);
      var a = doc.activeElement;
      var inDrawer = sb && a && sb.contains(a);
      if (inDrawer || !a || a === doc.body) {
        var back = drawerOpener && doc.contains(drawerOpener) && isShown(drawerOpener) ? drawerOpener : doc.getElementById("expandSidebar");
        if (back && isShown(back)) back.focus();
      }
      drawerOpener = null;
    }
  }

  function onKeydown(e) {
    var modal = topModal();
    if (e.key === "Escape" && !modal && drawerIsOpen() && !doc.querySelector(".account-menu")) {
      var closeBtn = doc.getElementById("collapseSidebar");
      if (closeBtn) { e.preventDefault(); closeBtn.click(); }
      return;
    }
    if (e.key !== "Tab" || e.defaultPrevented) return;
    var container = modal || (drawerIsOpen() ? drawerEl() : null);
    if (!container) return;
    var items = focusables(container);
    if (!items.length) { e.preventDefault(); container.setAttribute("tabindex", "-1"); container.focus(); return; }
    var first = items[0], last = items[items.length - 1], a = doc.activeElement;
    if (!a || !container.contains(a)) {
      // focus is outside the modal (or on <body>): bring it in — unless it sits in a transient popup
      if (a && a !== doc.body && a.closest && a.closest('[role="menu"],[role="listbox"],[role="tooltip"],.account-menu')) return;
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && (a === first || a === container)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }

  function init() {
    if (doc.__mft) return; doc.__mft = true;
    doc.addEventListener("keydown", onKeydown, true);
    if (root.MutationObserver) new root.MutationObserver(onDrawerChange).observe(doc.body, { attributes: true, attributeFilter: ["class"] });
    syncExpandedState(drawerIsOpen());
    onDrawerChange();
  }

  root.MobileFocusTrap = { init: init, topModal: topModal, focusables: focusables };
  if (root.BUILD && root.BUILD.modules) root.BUILD.modules.push({ id: "mobile-focus-trap", init: init });
  if (doc.readyState !== "loading") init();
  else doc.addEventListener("DOMContentLoaded", init);
})(window);
