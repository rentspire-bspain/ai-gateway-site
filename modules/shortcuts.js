/* shortcuts.js — Global keyboard shortcuts (Desktop phase 1, §26f mobile/desktop round)
 *
 * "/" focuses the composer (landing or follow-up, whichever is visible).
 * "j"/"k" move to the next/previous thread in the sidebar (vim-style).
 * cmd/ctrl+K is already the command palette (modules/command-palette.js).
 * Plain keys are ignored while typing in any input/textarea/select or contenteditable.
 * Pure vanilla JS, zero dependencies.
 */
(function (root) {
  "use strict";

  function isTyping(e) {
    var t = e.target;
    if (!t) return false;
    var tag = (t.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable) return true;
    return false;
  }

  function visibleComposer() {
    var fb = document.getElementById("followupInput");
    if (fb && fb.offsetParent !== null) return fb;
    var li = document.getElementById("landingInput");
    if (li && li.offsetParent !== null) return li;
    return null;
  }

  function threadItems() {
    var host = document.getElementById("threadItems");
    if (!host) return [];
    return Array.prototype.filter.call(host.querySelectorAll(".thread-item"), function (el) {
      return el.offsetParent !== null;
    });
  }

  function moveThread(dir) {
    var items = threadItems();
    if (!items.length) return;
    var idx = -1;
    for (var i = 0; i < items.length; i++) {
      if (String(items[i].className).indexOf("active") !== -1) { idx = i; break; }
    }
    var next = idx + dir;
    if (next < 0) next = 0;
    if (next >= items.length) next = items.length - 1;
    if (items[next]) items[next].click();
  }

  function onKey(e) {
    if (isTyping(e)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return; // leave chords to the palette
    var k = e.key;
    if (k === "/") {
      var c = visibleComposer();
      if (c) {
        e.preventDefault();
        c.focus();
        try { c.setSelectionRange(c.value.length, c.value.length); } catch (err) { /* non-text */ }
      }
    } else if (k === "j" || k === "J") {
      e.preventDefault();
      moveThread(1);
    } else if (k === "k" || k === "K") {
      e.preventDefault();
      moveThread(-1);
    }
  }

  function initHint() {
    // a one-line hint under the sidebar search, visible on wide screens only
    if (document.getElementById("kbd-hint")) return;
    var search = document.getElementById("threadSearch");
    if (!search || !search.parentElement) return;
    var hint = document.createElement("div");
    hint.id = "kbd-hint";
    hint.style.cssText = "font-size:12px;opacity:.78;padding:4px 10px;display:none;";
    hint.textContent = "/ composer \u00b7 j/k threads \u00b7 \u2318K commands";
    search.parentElement.appendChild(hint);
    if (window.matchMedia && window.matchMedia("(min-width:900px)").matches) hint.style.display = "block";
  }

  function init() {
    document.addEventListener("keydown", onKey);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initHint);
    } else {
      initHint();
    }
  }
  init();

  root.ShortcutsUI = { moveThread: moveThread, visibleComposer: visibleComposer };
})(typeof window !== "undefined" ? window : globalThis);
