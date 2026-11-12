/* favicon-live.js — v179 Perplexity-style dynamic favicon.
   - While a response is streaming: a scanning arc animates over the favicon
     (visual "session is working" signal in the tab bar).
   - When the response completes: a LARGE green checkmark badge (Perplexity-sized,
     ~45% of the icon) in the favicon's top-right corner.
   - The checkmark clears when the user returns to the tab (focus/visibility).
   v179: renders at 64px so the badge downsamples crisply at 16/32px tab sizes,
   and rewrites EVERY icon link (SVG + PNG) so the animated PNG always wins.
   Driven by window.__isSearching() polling (set in index.html) — zero changes
   to the search flow itself. Same-origin image => canvas stays untainted. */
(function () {
  "use strict";
  if (window.FaviconLive && window.FaviconLive._loaded) return;
  var SIZE = 64, ICON = "/favicon.png";
  var canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  var ctx = canvas.getContext("2d");
  // v179: manage ALL icon links — index.html ships both an SVG link and a PNG
  // link; a single querySelector grabbed the SVG one and Chrome kept preferring
  // it, so the animation/checkmark never showed in the tab.
  var links = Array.prototype.slice.call(document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]'));
  if (!links.length) {
    var l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); links = [l];
  }
  var originals = links.map(function (l) { return l.getAttribute("href") || ICON; });
  var base = new Image();
  var baseReady = false;
  base.onload = function () { baseReady = true; drawPlain(); };
  base.src = ICON;

  var state = "idle";          // idle | scanning | done
  var animTimer = null, angle = 0;

  function drawBase() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (baseReady) {
      // cover-fit the square favicon
      ctx.drawImage(base, 0, 0, SIZE, SIZE);
    } else {
      ctx.fillStyle = "#0e2a47"; ctx.fillRect(0, 0, SIZE, SIZE);
    }
  }
  function setLink() {
    var url;
    try { url = canvas.toDataURL("image/png"); } catch (e) { return; }
    links.forEach(function (l) { try { l.setAttribute("href", url); } catch (e) {} });
  }
  function restoreLinks() {
    links.forEach(function (l, i) { try { l.setAttribute("href", originals[i]); } catch (e) {} });
  }

  function drawPlain() {
    state = "idle"; stopAnim(); restoreLinks();
  }
  function drawScanning() {
    drawBase();
    // scan ring: dark track + bright rotating arc (cyan→green gradient feel)
    var cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 3;
    ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    var g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    g.addColorStop(0, "#22d3ee"); g.addColorStop(1, "#34d399");
    ctx.strokeStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, angle, angle + Math.PI * 0.75); ctx.stroke();
    setLink();
  }
  function drawDone() {
    drawBase();
    // v179: LARGE green check badge (owner request 2026-11-12: match Perplexity's
    // proportion — badge ≈ 45% of the icon width, bold white check).
    var br = Math.round(SIZE * 0.23);            // badge radius (~15px at 64)
    var bx = SIZE - 2 * br - 1, by = 1;
    ctx.beginPath(); ctx.arc(bx + br, by + br, br, 0, Math.PI * 2);
    ctx.fillStyle = "#22c55e"; ctx.fill();
    ctx.strokeStyle = "#0b1220"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(3, SIZE * 0.075); ctx.lineCap = "round"; ctx.lineJoin = "round";
    var cx0 = bx + br * 0.42, cy0 = by + br * 1.02;
    var cx1 = bx + br * 0.85, cy1 = by + br * 1.55;
    var cx2 = bx + br * 1.62, cy2 = by + br * 0.42;
    ctx.beginPath();
    ctx.moveTo(cx0, cy0); ctx.lineTo(cx1, cy1); ctx.lineTo(cx2, cy2);
    ctx.stroke();
    setLink();
  }
  function stopAnim() { if (animTimer) { clearInterval(animTimer); animTimer = null; } }
  function start() {
    if (state === "scanning") return;
    state = "scanning"; angle = 0;
    stopAnim();
    animTimer = setInterval(function () {
      angle += 0.55; if (angle > Math.PI * 2) angle -= Math.PI * 2;
      drawScanning();
    }, 90);
    drawScanning();
  }
  function done() {
    if (state === "done") return;
    stopAnim(); state = "done"; drawDone();
  }

  // checkmark clears when the user comes back to the tab
  function onFocus() { if (state === "done") drawPlain(); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) onFocus(); });
  window.addEventListener("focus", onFocus);

  // driver: poll the search state (cheap, self-contained)
  var last = false;
  setInterval(function () {
    var busy = false;
    try { busy = window.__isSearching ? !!window.__isSearching() : false; } catch (e) {}
    if (busy && !last) start();
    else if (!busy && last) done();      // finished while away: show the check
    else if (!busy && state === "scanning") done();
    last = busy;
  }, 400);

  window.FaviconLive = { start: start, done: done, reset: drawPlain, _loaded: true };
})();
