/* settings-troubleshooting.js — v230: Troubleshooting KB (Perplexity help-center parity).
   Top issues with causes and fixes, searchable. Content grounded in the platform's
   own behavior (connectors, gateway, webapps, fleet) — no external scrape. */
(function () {
  "use strict";
  var KB = [
    { q: "Connectors won't connect (Slack, Dropbox, Google)", a: "The paste-free OAuth flow needs two things: the server-side app credentials (owner-configured — if Connect shows 'Owner setup required', the app secret is missing) and your one click on Allow at the provider. If the pane shows 'Callback received' but nothing else, open Settings > Connectors again — the stored authorization code is exchanged automatically on pane open. Google: make sure popups are allowed for ai.spaincos.com." },
    { q: "I clicked Connect but no authorization window opened", a: "The browser blocked the popup. Allow popups for ai.spaincos.com (the address bar's icon on the right) and click Connect again. The authorization page must finish and redirect back to ai.spaincos.com for the exchange to complete." },
    { q: "Answers cite old or wrong information", a: "Ask the question again — every answer runs live research with fresh sources. For data about your own apps, name the app (e.g. 'in Comptrove…') so the platform pulls the live webapp registry instead of the open web." },
    { q: "A tool the assistant should have used wasn't used", a: "The platform auto-invokes key tools (webapp health, fleet registry, platform status) when your question matches. If the answer still seems to lack live data, reply 'use the live data' — the platform re-runs with the real registry injected." },
    { q: "Response is slow or times out", a: "First token should arrive in under ~8 seconds. If a request hangs, start a new thread (stuck threads can hold a queued tool). Deep research questions legitimately take longer — the progress indicator shows live steps." },
    { q: "Fleet dispatches not returning results", a: "Fleet work is asynchronous — results post back into the thread that queued them. If nothing returns after several minutes, check Settings > API health badges; a red gateway badge means dispatches are queuing but not processing." },
    { q: "Signed out unexpectedly", a: "Sessions expire for security. 'Sign out everywhere' (Settings > Account) revokes all sessions — if you used it, sign in again on each device. Changing your password does NOT sign out other sessions; use Devices to revoke them." },
    { q: "Can't sign in with passkey", a: "Passkeys require the platform owner to enable them in the auth configuration (in progress). Use email + password or an email code meanwhile." },
    { q: "Mobile layout is broken or cramped", a: "The site is verified at 375px width. If a pane overflows horizontally, rotate to landscape or use desktop; report the specific pane — panes with horizontal scroll are a bug." },
    { q: "Exported data is missing messages", a: "The export includes locally cached threads. The server keeps everything — 'Delete all chat history' in Data controls is the only server-side deletion; export before deleting, since deletion is permanent." },
    { q: "Keyboard shortcuts", a: " '/' focuses the composer, 'j'/'k' move between threads, cmd+K opens the command palette. Shortcuts are disabled while typing in an input." },
    { q: "Install as an app (desktop/mobile)", a: "Use the 'Install app' button in the sidebar (or your browser's install/shortcuts menu). The app runs standalone with offline shell support." },
    { q: "Two-factor recovery", a: "If you lose your authenticator: sign in with a recovery path is not self-service yet — ask the owner to remove the factor, then re-enroll. Keep the setup key somewhere safe when enrolling." },
    { q: "API key requests fail with 401", a: "API keys authorize API-mode requests only. Browser sessions use your sign-in token. If a key stops working, rotate it in Settings > API." },
    { q: "Where do my files/artifacts live", a: "Artifacts are stored per-account on the server; 'Artifacts' in the sidebar lists them. Export from Settings > Data controls downloads your data as JSON." },
    { q: "Voice input not working", a: "Voice input needs microphone permission for ai.spaincos.com. If denied, reset the permission in your browser's site settings." },
    { q: "Incognito threads", a: "Incognito mode turns off memory and personalization for that thread only. The thread is still stored in your account unless you delete it." },
    { q: "Model differences (Auto, Flint, Kimi…)", a: "Auto (GLM-5.3) is the default all-rounder. Free lanes (Flint, Qwen) are fast; long-context research benefits from Kimi/DeepSeek. The selector shows live descriptions." },
    { q: "Report a bug", a: "Describe what happened, what you clicked, and the time — paste it in chat. The reliability ledger (first-token latency, stale citations, tool failures) is monitored continuously." },
    { q: "Data isolation between users", a: "Every user's threads, messages, and artifacts are row-level-security scoped. Cross-user access is blocked at the database layer (verified by audit: reads, inserts, updates, and deletes all refuse cross-user rows)." }
  ];
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function build() {
    var pane = el("div", "stg-pane");
    pane.appendChild(el("h3", "stg-pane-title", "Troubleshooting"));
    pane.appendChild(el("p", "stg-pane-sub", "Answers to the most common issues. Search or browse."));
    var search = el("input", "stg-input");
    search.type = "search";
    search.placeholder = "Search help articles…";
    search.style.width = "100%";
    search.style.margin = "8px 0 12px";
    var list = el("div", "");
    function render(q) {
      list.innerHTML = "";
      var needle = (q || "").toLowerCase();
      KB.forEach(function (item, i) {
        if (needle && (item.q + " " + item.a).toLowerCase().indexOf(needle) < 0) return;
        var det = el("details", "");
        det.style.border = "1px solid var(--border)";
        det.style.borderRadius = "10px";
        det.style.padding = "10px 14px";
        det.style.margin = "8px 0";
        var sum = el("summary", "");
        sum.style.cursor = "pointer";
        sum.style.fontWeight = "600";
        sum.style.fontSize = "13.5px";
        sum.textContent = (i + 1) + ". " + item.q;
        var body = el("div", "stg-desc");
        body.style.padding = "8px 2px 2px";
        body.style.lineHeight = "1.6";
        body.textContent = item.a;
        det.appendChild(sum); det.appendChild(body);
        list.appendChild(det);
      });
      if (!list.children.length) list.appendChild(el("p", "stg-desc", "No articles matched '" + q + "'."));
    }
    search.addEventListener("input", function () { render(search.value); });
    render("");
    pane.appendChild(search);
    pane.appendChild(list);
    return pane;
  }
  function register() {
    if (!window.SettingsUI || typeof window.SettingsUI.registerPane !== "function") return;
    window.SettingsUI.registerPane({ id: "troubleshooting", label: "Troubleshooting", render: build, after: "data" });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", register);
  else register();
})();
