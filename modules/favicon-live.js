/* favicon-live.js — v175 Perplexity-style dynamic favicon.
   - While a response is streaming: a scanning arc animates over the favicon
     (visual "session is working" signal in the tab bar).
   - When the response completes: a green checkmark badge in the favicon's
     top-right corner.
   - The checkmark clears when the user returns to the tab (focus/visibility).
   Driven by window.__isSearching() polling (set in index.html) — zero changes
   to the search flow itself. Same-origin image => canvas stays untainted. */
(function () {
  "use strict";
  if (window.FaviconLive && window.FaviconLive._loaded) return;
  var SIZE = 32, ICON = "/favicon.png";
  var canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  var ctx = canvas.getContext("2d");
  var link = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
  if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
  var originalHref = link.getAttribute("href") || ICON;
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
  function setLink() { try { link.setAttribute("href", canvas.toDataURL("image/png")); } catch (e) {} }

  function drawPlain() {
    state = "idle"; stopAnim();
    drawBase(); setLink();
  }
  function drawScanning() {
    drawBase();
    // scan ring: dark track + bright rotating arc (cyan→green gradient feel)
    var cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 1.5;
    ctx.lineWidth = 3; ctx.lineCap = "round";
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
    // green check badge, top-right corner
    var bx = SIZE - 11, by = 3, br = 7;
    ctx.beginPath(); ctx.arc(bx + br, by + br, br, 0, Math.PI * 2);
    ctx.fillStyle = "#22c55e"; ctx.fill();
    ctx.strokeStyle = "#0b1220"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(bx + 3, by + br); ctx.lineTo(bx + br - 1, by + 2 * br - 3); ctx.lineTo(bx + 2 * br - 3, by + 3);
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
