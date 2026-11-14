/* mobile-375.js — hamburger toggle for the off-canvas drawer (pairs with css/mobile-375.css).
   Injects ONE button into the top bar; tapping toggles body.m375-open (the CSS does the
   drawer animation + scrim). The scrim click also closes. No other DOM is touched. */
(function (root) {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function toggle(open) {
    document.body.classList.toggle("m375-open", open);
    var b = document.querySelector(".m375-burger");
    if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function init() {
    if (window.matchMedia && !window.matchMedia("(max-width: 420px)").matches) return; // phones only
    if (document.querySelector(".m375-burger")) return;
    var bar = document.getElementById("topbar") || document.querySelector(".topbar, header.topbar");
    if (!bar) return;
    var btn = document.createElement("button");
    btn.className = "m375-burger";
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle navigation");
    btn.setAttribute("aria-expanded", "false");
    var lines = document.createElement("span");
    btn.appendChild(lines);
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggle(!document.body.classList.contains("m375-open"));
    });
    bar.insertBefore(btn, bar.firstChild);
    // scrim (rendered by CSS on body.m375-open::after) — close on any tap outside the drawer
    document.addEventListener("click", function (e) {
      if (!document.body.classList.contains("m375-open")) return;
      var drawer = document.getElementById("sidebar") || document.querySelector(".sidebar, nav.sidebar");
      if (drawer && !drawer.contains(e.target) && !btn.contains(e.target)) toggle(false);
    });
    // swipe-open is out of scope (pointer-event work); the button is the interface.
  }

  ready(init);
  root.Mobile375 = { init: init, toggle: toggle };
  if (root.BUILD && root.BUILD.modules) root.BUILD.modules.push({ id: "mobile-375", init: init });
})(typeof window !== "undefined" ? window : this);
