/* mobile-375.js — phone helpers (pairs with css/mobile-375.css).
   v311: the injected hamburger + body.m375-open drawer were removed. The app already owns a drawer
   (#sidebar.collapsed, #expandSidebar, #collapseSidebar, .sidebar-scrim in index.html, active at <=768px);
   the second drawer opened it in its icon-only "collapsed" skin and left #expandSidebar dead at <=420px.
   Mobile375.toggle() is kept as a thin, backwards-compatible wrapper around the real controls.

   Also here: prefers-reduced-motion support for scripted smooth scrolling. CSS cannot override an
   explicit `behavior: "smooth"` passed to scrollTo/scrollIntoView, so those calls are downgraded to
   instant when the user has asked the OS for reduced motion. */
(function (root) {
  "use strict";

  function toggle(open) {
    var doc = root.document;
    var sb = doc && doc.getElementById("sidebar");
    if (!sb) return;
    var isOpen = !sb.classList.contains("collapsed");
    if (open === undefined) open = !isOpen;
    if (!!open === isOpen) return;
    var btn = doc.getElementById(open ? "expandSidebar" : "collapseSidebar");
    if (btn) btn.click();
  }

  function reducedMotion() {
    try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }

  function calm(args) {
    var a = args[0];
    if (a && typeof a === "object" && a.behavior === "smooth" && reducedMotion()) {
      var c = {};
      for (var k in a) c[k] = a[k];
      c.behavior = "auto";
      var out = Array.prototype.slice.call(args);
      out[0] = c;
      return out;
    }
    return args;
  }

  function patchReducedMotion() {
    var E = root.Element && root.Element.prototype;
    ["scroll", "scrollTo", "scrollBy", "scrollIntoView"].forEach(function (name) {
      [E, root].forEach(function (host) {
        if (!host || typeof host[name] !== "function" || host[name].__calm) return;
        var orig = host[name];
        var wrapped = function () { return orig.apply(this, calm(arguments)); };
        wrapped.__calm = true;
        host[name] = wrapped;
      });
    });
  }

  function init() { patchReducedMotion(); }

  patchReducedMotion(); // as early as possible: later scripts call scrollTo/scrollIntoView
  root.Mobile375 = { init: init, toggle: toggle, reducedMotion: reducedMotion, _calm: calm };
  if (root.BUILD && root.BUILD.modules) root.BUILD.modules.push({ id: "mobile-375", init: init });
})(typeof window !== "undefined" ? window : this);
