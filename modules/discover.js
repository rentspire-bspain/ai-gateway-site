(function () {
  "use strict";
  var URL_ = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/discover";
  var REFRESH_MS = 300000; // 5 minutes
  var root = null, feed = [], timer = null;
  var state = { loading: true, error: "" };

  function clean(s) {
    if (s == null) return "";
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "").replace(/ {2,}/g, " ").trim();
  }
  function esc(s) { var d = document.createElement("div"); d.textContent = clean(s); return d.innerHTML; }
  // Markdown-safe text: drop [label](url) syntax (keep the label), strip bold/italic markers.
  function mdText(s) {
    return clean(s)
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\*\*([^*]*)\*\*/g, "$1").replace(/__([^_]*)__/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1").trim();
  }
  function domain(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }
  function ago(t) {
    if (!t) return "";
    var s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  // Question built from the card title, sent through the app's search thread.
  function askQuestion(title) {
    return "What's the latest on " + clean(title).replace(/[.?!]+$/, "") + "?";
  }

  function api(body) {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in to use Discover.");
      return fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(body) });
    }).then(function (res) {
      if (res.status === 404) { var e = new Error("setup"); e.setup = true; throw e; }
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(clean(j.error || j.message) || "Request failed (" + res.status + ")");
        return j;
      });
    });
  }

  function ensureCss() {
    if (document.querySelector('link[href*="discover.css"]')) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "modules/discover.css"; document.head.appendChild(l);
  }

  function refresh() {
    return api({ action: "feed" }).then(function (r) {
      feed = r.feed || [];
      state.error = ""; state.loading = false;
    }).catch(function (e) {
      state.loading = false;
      state.error = e.setup ? "Discover isn't set up yet. The service is still being deployed — please check back shortly." : clean(e.message);
    }).then(render);
  }

  // A title that is just a field label ("Date: …") or a bare date is never a
  // headline — fall back to the first sentence of the summary.
  function isJunkTitle(t) {
    if (/^(date|day|source|url|link|published|summary|headline|title)\s*[:\-–]/i.test(t)) return true;
    return t.replace(/[^A-Za-z]/g, "").length < 4;
  }
  function effectiveTitle(c) {
    var t = mdText(c.title);
    if (isJunkTitle(t)) {
      var s = mdText(c.summary || "");
      var first = s.split(/(?<=[.!?])\s+/)[0] || s;
      t = first.split(/\s[—–]\s/)[0].slice(0, 120) || t;
    }
    return t;
  }

  function card(c) {
    var d = domain(c.url);
    // Title may carry a markdown link: show its text and link to its URL.
    // Empty links like "[Multifamily sales]()" are dropped — text only.
    var raw = clean(c.title);
    var linkM = raw.match(/\[([^\]]*)\]\((https?:\/\/[^\s)]*)\)/);
    var title = effectiveTitle(c);
    var href = linkM ? linkM[2] : (c.url || "");
    return '<div class="dv-card">' +
      '<div class="dv-title">' + (href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(title) + '</a>' : esc(title)) + '</div>' +
      '<div class="dv-summary">' + esc(mdText(c.summary)) + '</div>' +
      '<div class="dv-row"><span class="dv-meta">' + (d ? esc(d) + ' · ' : '') + esc(ago(c.published_at || c.fetched_at)) + '</span><span class="dv-grow"></span>' +
      '<button class="dv-btn" data-act="ask" data-title="' + esc(title) + '">Ask about this</button></div></div>';
  }

  function view() {
    var h = '<div class="dv-wrap">';
    if (state.error) h += '<div class="dv-err">' + esc(state.error) + '</div>';
    else if (state.loading) h += '<div class="dv-msg">Connecting…</div>';
    else if (!feed.length) h += '<div class="dv-empty">First refresh running — check back in a few minutes.</div>';
    else {
      var seen = {}, order = [];
      feed.forEach(function (c) { var t = clean(c.topic) || "General"; if (!seen[t]) { seen[t] = []; order.push(t); } seen[t].push(c); });
      order.forEach(function (t) {
        h += '<div class="dv-topic">' + esc(mdText(t)) + '</div>' + seen[t].map(card).join("");
      });
    }
    return h + "</div>";
  }

  function render() {
    if (!root) return;
    var body = root.querySelector(".dv-body"), scroll = body ? body.scrollTop : 0;
    body.innerHTML = view();
    body.scrollTop = scroll;
  }

  function onClick(ev) {
    var t = ev.target.closest("[data-act],.dv-x"); if (!t) return;
    if (t.classList.contains("dv-x")) return close();
    if (t.dataset.act === "ask") {
      var q = askQuestion(t.dataset.title);
      if (typeof window.performSearch === "function") { close(); window.performSearch(q); }
    }
  }
  function onKey(e) { if (e.key === "Escape" && root) close(); }

  var lastFocus = null;
  function open() {
    if (root) return;
    lastFocus = document.activeElement;
    ensureCss();
    root = document.createElement("div");
    root.className = "dv-root";
    root.innerHTML = '<div class="dv-head"><div class="dv-grow"><h2 class="dv-title-h">Discover</h2><div class="dv-sub">Fresh takes on your topics</div></div><button class="dv-x" aria-label="Close">×</button></div><div class="dv-body"></div>';
    (document.getElementById("moduleRoot") || document.body).appendChild(root);
    root.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Discover");
    state.loading = true; state.error = ""; feed = []; render();
    var xb = root.querySelector(".dv-x"); if (xb) xb.focus();
    refresh();
    timer = setInterval(refresh, REFRESH_MS);
  }
  function close() {
    if (!root) return;
    clearInterval(timer); timer = null;
    document.removeEventListener("keydown", onKey);
    root.remove(); root = null;
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }
  window.DiscoverUI = { open: open, close: close };
})();
