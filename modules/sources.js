/* sources.js — Perplexity-style Sources picker (Wave 2, B4/B6/B7)
 *
 * UI + state only. The gateway request builder (performSearch) reads
 * SourcesPicker.state() as `sources_filter` on every request and
 * SourcesPicker.timeRange() when academic/finance search is enabled.
 *
 * Contract:
 *   SourcesPicker.state()     -> { web, academic, finance, files } (booleans)
 *   SourcesPicker.timeRange() -> "any" | "day" | "week" | "month" | "year"
 *   SourcesPicker.attach()    -> mounts the pill into BOTH composers
 *                                (#landingPills + #followupPills), idempotent.
 *
 * Persistence: localStorage "ai_sources" ({web,academic,finance,files}) and
 * "ai_time_range" (range id). All unchecked = "Sources: Off" (model's own
 * knowledge + attached files only).
 */
(function () {
  "use strict";

  var SRC_KEY = "ai_sources";
  var RANGE_KEY = "ai_time_range";

  var SOURCES = [
    { id: "web", label: "Web", hint: "Search the open web" },
    { id: "academic", label: "Academic", hint: "Peer-reviewed papers and journals" },
    { id: "finance", label: "Finance", hint: "Market data, filings and quotes" },
    { id: "files", label: "Files", hint: "Search inside attached files" }
  ];
  var RANGES = [
    { id: "any", label: "Any time" },
    { id: "day", label: "Past day" },
    { id: "week", label: "Past week" },
    { id: "month", label: "Past month" },
    { id: "year", label: "Past year" }
  ];

  var HOSTS = [
    { id: "landingPills", btn: null },
    { id: "followupPills", btn: null }
  ];

  var ICON_GLOBE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  var ICON_CARET = '<svg class="sources-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  var ICON_CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  /* ---------------- state ---------------- */

  var current = loadState();
  var range = loadRange();

  function loadState() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(SRC_KEY) || "null"); } catch (e) { raw = null; }
    var out = { web: true, academic: false, finance: false, files: false };
    if (raw && typeof raw === "object") {
      SOURCES.forEach(function (s) { if (typeof raw[s.id] === "boolean") out[s.id] = raw[s.id]; });
    }
    return out;
  }
  function saveState() { try { localStorage.setItem(SRC_KEY, JSON.stringify(current)); } catch (e) {} }
  function loadRange() {
    var v = null;
    try { v = localStorage.getItem(RANGE_KEY); } catch (e) { v = null; }
    return RANGES.some(function (r) { return r.id === v; }) ? v : "any";
  }
  function saveRange() { try { localStorage.setItem(RANGE_KEY, range); } catch (e) {} }

  function allOff() { return !current.web && !current.academic && !current.finance && !current.files; }
  function needsRange() { return !!(current.academic || current.finance); }
  function isDefault() { return current.web && !current.academic && !current.finance && !current.files; }

  function stateLabel() {
    if (allOff()) return "Sources: Off";
    var on = SOURCES.filter(function (s) { return current[s.id]; }).map(function (s) { return s.label; });
    return "Sources: " + on.join(" + ");
  }
  function tooltip() {
    var on = SOURCES.filter(function (s) { return current[s.id]; }).map(function (s) { return s.label; });
    var txt = on.length ? on.join(" + ") : "off — model knowledge + attached files only";
    return "Sources: " + txt + ". Click to change.";
  }
  function emit() {
    try {
      document.dispatchEvent(new CustomEvent("sourceschange", {
        detail: { sources: state(), timeRange: range }
      }));
    } catch (e) {}
  }

  /* ---------------- pill ---------------- */

  function syncPills() {
    HOSTS.forEach(function (h) {
      if (!h.btn) return;
      var lbl = h.btn.querySelector(".sources-label");
      if (lbl) lbl.textContent = stateLabel();
      h.btn.title = tooltip();
      h.btn.classList.toggle("active", !isDefault());
    });
  }

  /* Keep the pill directly after the deepResearchToggle pill in whichever
     composer it currently lives in (positionComposerPills relocates it). */
  var mover = null;
  function fixPlacement() {
    HOSTS.forEach(function (h) {
      var host = document.getElementById(h.id);
      if (!host || !h.btn) return;
      var dr = document.getElementById("deepResearchToggle");
      var anchor = (dr && dr.parentElement === host) ? dr : null;
      if (anchor) {
        if (anchor.nextElementSibling !== h.btn) host.insertBefore(h.btn, anchor.nextSibling);
      } else if (h.btn.parentElement !== host) {
        host.appendChild(h.btn);
      }
    });
  }
  function watchPlacement() {
    if (mover || typeof MutationObserver === "undefined") return;
    mover = new MutationObserver(fixPlacement);
    HOSTS.forEach(function (h) {
      var host = document.getElementById(h.id);
      if (host) mover.observe(host, { childList: true });
    });
  }

  function attach() {
    HOSTS.forEach(function (h) {
      var host = document.getElementById(h.id);
      if (!host) return;
      if (h.btn) h.btn.remove();
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "width-toggle sources-pill";
      btn.setAttribute("aria-haspopup", "menu");
      btn.setAttribute("aria-expanded", "false");
      btn.title = tooltip();
      btn.innerHTML = ICON_GLOBE + '<span class="sources-label">' + stateLabel() + "</span>" + ICON_CARET;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleMenu(btn);
      });
      h.btn = btn;
      host.appendChild(btn);
    });
    fixPlacement();
    watchPlacement();
    syncPills();
  }

  /* ---------------- dropdown menu ---------------- */

  var menu = null, scrim = null, openPill = null;

  function menuHTML() {
    var html = '<div class="sources-title">Sources</div>';
    SOURCES.forEach(function (s) {
      html += '<button type="button" class="sources-item" role="menuitemcheckbox" aria-checked="' +
        (current[s.id] ? "true" : "false") + '" data-src="' + s.id + '">' +
        '<span class="sources-box">' + ICON_CHECK + "</span>" +
        '<span class="sources-item-main"><span class="sources-item-name">' + s.label + "</span><em>" + s.hint + "</em></span>" +
        "</button>";
    });
    html += '<div class="sources-sep"></div>';
    html += '<div class="sources-range"' + (needsRange() ? "" : ' style="display:none"') + ">";
    html += '<div class="sources-range-title">Time range</div>';
    RANGES.forEach(function (r) {
      html += '<button type="button" class="sources-range-item' + (range === r.id ? " selected" : "") +
        '" data-range="' + r.id + '" aria-pressed="' + (range === r.id ? "true" : "false") + '">' + r.label + "</button>";
    });
    html += "</div>";
    html += '<div class="sources-hint"' + (allOff() ? "" : ' style="display:none"') +
      ">All sources off — answers come from the model&rsquo;s own knowledge plus attached files.</div>";
    return html;
  }

  function buildMenu() {
    menu = document.createElement("div");
    menu.className = "sources-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Sources");
    menu.innerHTML = menuHTML();
    menu.addEventListener("click", function (e) {
      var srcBtn = e.target.closest("[data-src]");
      if (srcBtn) {
        var id = srcBtn.getAttribute("data-src");
        current[id] = !current[id];
        saveState();
        renderMenu();
        syncPills();
        fixPlacement();
        emit();
        return;
      }
      var rBtn = e.target.closest("[data-range]");
      if (rBtn) {
        range = rBtn.getAttribute("data-range");
        saveRange();
        renderMenu();
        emit();
      }
    });
  }
  function renderMenu() {
    if (!menu) return;
    menu.innerHTML = menuHTML();
    place();
  }

  function place() {
    if (!menu || !openPill) return;
    var r = openPill.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    if (vw <= 480) { // compact bottom sheet
      menu.style.left = ""; menu.style.right = ""; menu.style.top = "";
      menu.style.bottom = "12px"; menu.style.width = "";
      return;
    }
    var w = Math.min(280, vw - 16);
    menu.style.width = w + "px";
    menu.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + "px";
    var mh = menu.offsetHeight || 0;
    var fitsBelow = r.bottom + mh + 12 < vh;
    if (fitsBelow) {
      menu.style.top = (r.bottom + 6) + "px";
      menu.style.bottom = "";
    } else {
      menu.style.top = "";
      menu.style.bottom = Math.max(8, vh - r.top + 6) + "px"; // opens ABOVE the pill
    }
  }

  function close(refocus) {
    if (menu) menu.remove();
    if (scrim) scrim.remove();
    menu = scrim = null;
    if (openPill) openPill.setAttribute("aria-expanded", "false");
    if (refocus && openPill) { try { openPill.focus(); } catch (e) {} }
    openPill = null;
  }
  function openMenu(pill) {
    close(false);
    openPill = pill;
    scrim = document.createElement("div");
    scrim.className = "sources-scrim";
    scrim.onclick = function () { close(true); };
    buildMenu();
    document.body.appendChild(scrim);
    document.body.appendChild(menu);
    pill.setAttribute("aria-expanded", "true");
    place();
    var first = menu.querySelector(".sources-item");
    if (first) { try { first.focus(); } catch (e) {} }
  }
  function toggleMenu(pill) {
    if (menu && openPill === pill) close(true);
    else openMenu(pill);
  }

  document.addEventListener("keydown", function (e) {
    if (!menu) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      var items = Array.prototype.slice.call(menu.querySelectorAll("button"));
      var i = items.indexOf(document.activeElement);
      if (i === -1) i = e.key === "ArrowDown" ? -1 : 0;
      var next = items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
      if (next) next.focus();
    }
  }, true);
  window.addEventListener("resize", place);
  document.addEventListener("scroll", function () { if (menu) place(); }, true);

  /* ---------------- public API ---------------- */

  window.SourcesPicker = {
    state: function () {
      return {
        web: !!current.web,
        academic: !!current.academic,
        finance: !!current.finance,
        files: !!current.files
      };
    },
    timeRange: function () { return range; },
    attach: attach
  };

  // mount immediately (script loads after the composers exist) — same
  // convention as SkillsSlash; attach() stays public and idempotent.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach);
  else attach();
})();
