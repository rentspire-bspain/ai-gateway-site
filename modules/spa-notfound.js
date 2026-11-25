/* spa-notfound.js — U-STATE-07 (batch 35): branded 404 state for unknown paths.
   Every unmatched path 404s at the HTTP layer (spa-redirect.js) and lands on the
   app shell with ?p=<original-path>. This module renders a visible, branded
   "page not found" card instead of silently loading the landing, so a bad link
   is never mistaken for the product. CSP-safe: external module, no inline code. */
(function () {
  "use strict";
  function init() {
    try {
      var m = (location.search || "").match(/[?&]p=([^&]+)/);
      if (!m) return;
      var path = decodeURIComponent(m[1]);
      if (!path || path === "/") return;
      // Only the SPA fallback sets ?p= — the real pages never do.
      var host = document.querySelector(".landing-subtitle, main, #composer, body");
      var card = document.createElement("div");
      card.id = "spaNotFound";
      card.setAttribute("role", "alert");
      card.style.cssText = "max-width:640px;margin:18px auto;padding:16px 20px;border:1px solid var(--border,#2a2a2a);border-radius:12px;background:var(--bg-elevated,#17181c);text-align:center";
      var title = document.createElement("h2");
      title.style.cssText = "margin:0 0 6px;font-size:18px";
      title.textContent = "Page not found";
      var body = document.createElement("p");
      body.style.cssText = "margin:0 0 12px;color:var(--muted,#9aa4b8);font-size:14px;word-break:break-all";
      body.textContent = "There is no page at " + path + " — it may have moved or never existed.";
      var link = document.createElement("a");
      link.href = "/";
      link.textContent = "Go to the home page";
      card.appendChild(title); card.appendChild(body); card.appendChild(link);
      // Insert above the fold: before the auth card / composer if present, else top of main.
      var anchor = document.querySelector(".auth-card, #composer, main") || document.body;
      anchor.parentNode.insertBefore(card, anchor);
    } catch (e) { /* never break the page over a 404 nicety */ }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
