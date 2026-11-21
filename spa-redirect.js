// Any unmatched path is the SPA root — preserve the full query string
// (required for /verify?token=... and other parameterized routes).
// v262 (2026-11-20 UX debug-loop, F-AI-VERIFY-01): /verify is a REAL page, not an SPA route —
// the live Vercel rewrite for it does not fire (observed 404 + SPA fallback). Redirect it
// client-side as a permanent guard so the magic-link flow never lands in the app shell.
(function () {
  var p = (location.pathname || "").replace(/\/+$/, "");
  var map = { "/verify": "/verify.html", "/privacy": "/privacy.html", "/terms": "/terms.html" };
  if (map[p]) location.replace(map[p] + location.search);
  else location.replace("/?p=" + encodeURIComponent(location.pathname) + location.search);
})();
