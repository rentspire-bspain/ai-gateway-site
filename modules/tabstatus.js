/* TabStatus — tab title + animated favicon while a session is working (Perplexity parity).
   Polls the app's isSearching / currentThreadId / threads so every exit path (success, error, abort, stop) restores. */
(function () {
  var SITE = document.title, BASE_HREF = null, img = null, imgOk = false, timer = null, frame = 0, lastTitle = null, saved = null;
  var cv = document.createElement("canvas"); cv.width = cv.height = 32; var cx = cv.getContext("2d");
  function link() { var l = document.querySelector('link[rel~="icon"]'); if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); } return l; }
  function g(fn, d) { try { return fn(); } catch (e) { return d; } }
  function working() { return g(function () { return isSearching; }, false); }
  function threadTitle() {
    var t = g(function () { return threads.find(function (x) { return x.id === currentThreadId; }); }, null);
    return t && t.title ? String(t.title) : "";
  }
  function question() {
    var qs = document.querySelectorAll("#resultsContent .question-header"); // the running question (queued text lives elsewhere)
    return qs.length ? (qs[qs.length - 1].textContent || "").trim() : "";
  }
  function clip(s, n) { s = s.replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }
  function wantTitle() {
    var tt = threadTitle();
    if (working()) { var q = question(); return q ? (q.length > 60 && tt ? tt : clip(q, 60)) : (tt || "Searching…"); }
    return tt || SITE;
  }
  function setTitle() { var t = wantTitle(); if (t !== lastTitle || document.title !== t) { document.title = t; lastTitle = t; } }
  function loadBase() {
    var l = link(); if (!l.dataset.tsOrig) l.dataset.tsOrig = l.getAttribute("href");
    var h = saved ? saved.href : l.getAttribute("href"); if (img && BASE_HREF === h) return; BASE_HREF = h; imgOk = false;
    img = new Image(); img.onload = function () { imgOk = true; }; img.src = h;
  }
  function draw() {
    var S = 32, c = S / 2, a = frame * 0.35;
    cx.clearRect(0, 0, S, S);
    cx.save(); cx.globalAlpha = 0.45 + 0.2 * Math.sin(frame * 0.3);
    if (imgOk) cx.drawImage(img, 5, 5, 22, 22); else { cx.fillStyle = "#20808d"; cx.beginPath(); cx.arc(c, c, 8, 0, 7); cx.fill(); }
    cx.restore();
    cx.lineWidth = 3; cx.lineCap = "round";
    cx.strokeStyle = "rgba(32,128,141,.25)"; cx.beginPath(); cx.arc(c, c, 13, 0, Math.PI * 2); cx.stroke();
    for (var i = 0; i < 8; i++) { // fading comet tail
      cx.strokeStyle = "rgba(32,184,205," + (1 - i / 8).toFixed(2) + ")";
      cx.beginPath(); cx.arc(c, c, 13, a - i * 0.16 - 0.16, a - i * 0.16); cx.stroke();
    }
    var l = link(); l.type = "image/png"; l.href = cv.toDataURL("image/png"); frame++;
  }
  function start() { if (timer || document.hidden) return; var l0 = link(); if (!saved) saved = { href: l0.getAttribute("href"), type: l0.getAttribute("type") || "image/webp" }; BASE_HREF = null; loadBase(); timer = setInterval(draw, 80); }
  function stop() { if (!timer) return; clearInterval(timer); timer = null; restore(); }
  function restore() { if (!saved) return; var l = link(); l.href = saved.href; l.type = saved.type; saved = null; }
  function tick() {
    setTitle();
    if (working()) { if (!timer && !document.hidden) start(); } else if (timer) stop();
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (timer) { clearInterval(timer); timer = null; } } else tick();
  });
  setInterval(tick, 250); tick();
})();
