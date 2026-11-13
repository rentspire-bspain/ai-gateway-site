/* export.js — Export / Rewrite / Feedback / Share menu + read-only ShareView.
   NOTE: the app is login-gated; the orchestrator must let ?share=<id> bypass the gate
   and call ShareView.maybeOpen() (it also self-runs on DOMContentLoaded). */
(function () {
  "use strict";
  var FN = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/share";
  var APP = "https://ai.spaincos.com/";
  var MODELS = [["general", "Auto"], ["kimi", "Kimi"], ["deepseek-flash", "DeepSeek"], ["gpt-oss", "GPT-OSS"], ["llama4", "Llama 4"], ["summary", "Qwen"]];
  var ICON = {
    exp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>',
    rw: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10v11H3V10z"/><path d="M7 10l4-8a3 3 0 0 1 3 3v4h6a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7"/></svg>',
    down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 14V3h4v11z"/><path d="M17 14l-4 8a3 3 0 0 1-3-3v-4H4a2 2 0 0 1-2-2l2-8a2 2 0 0 1 2-2h13"/></svg>'
  };

  // CSP-safe global getter: no eval (blocked without unsafe-eval). Top-level bindings
  // of the main script live in the shared global lexical environment, so a direct
  // typeof check reaches them from this module.
  function g(name) {
    try {
      switch (name) {
        case "threads": return typeof threads !== "undefined" ? threads : undefined;
        case "currentThreadId": return typeof currentThreadId !== "undefined" ? currentThreadId : undefined;
        case "sb": return typeof sb !== "undefined" ? sb : undefined;
        case "submitQuery": return typeof submitQuery !== "undefined" ? submitQuery : undefined;
        default: return undefined;
      }
    } catch (e) { return undefined; }
  }
  function lsGet(k) { try { var v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function escH(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function slug(s) { var r = String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, ""); return r || "answer"; }

  // ---------- context ----------
  function ctxFor(row) {
    var all = Array.prototype.slice.call(document.querySelectorAll(".answer-actions"));
    var idx = all.indexOf(row);
    var sec = row.closest(".answer-section") || row.parentNode;
    var q = "", p = sec && sec.previousElementSibling;
    while (p && !(p.classList && p.classList.contains("question-header"))) p = p.previousElementSibling;
    if (p) q = p.textContent.trim();
    var threads = g("threads") || [], tid = g("currentThreadId") || null;
    var th = null; for (var i = 0; i < threads.length; i++) if (threads[i].id === tid) th = threads[i];
    var msgIndex = -1, msg = null;
    if (th) {
      var n = -1;
      (th.messages || []).forEach(function (m, j) { if (m.role !== "user") { n++; if (n === idx) { msgIndex = j; msg = m; } } });
    }
    var content = msg ? String(msg.content || "") : "";
    if (!content) { var c = sec && sec.querySelector(".answer-content"); content = c ? c.innerText || c.textContent || "" : ""; }
    var sources = (msg && msg.sources) || [];
    return { question: q, answer: content, sources: normSources(sources), threadId: tid, messageIndex: msgIndex < 0 ? idx : msgIndex, thread: th };
  }
  function normSources(s) {
    return (Array.isArray(s) ? s : []).map(function (x) {
      if (typeof x === "string") return { title: x, url: x };
      return { title: String((x && (x.title || x.name || x.url)) || ""), url: String((x && (x.url || x.link)) || "") };
    }).filter(function (x) { return x.url || x.title; });
  }

  // ---------- markdown ----------
  function inline(s) {
    s = escH(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }
  function md2html(md) {
    var lines = String(md || "").replace(/\r/g, "").split("\n"), out = [], i = 0, list = null;
    function close() { if (list) { out.push("</" + list + ">"); list = null; } }
    while (i < lines.length) {
      var l = lines[i], m;
      if (/^```/.test(l)) { close(); var buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push("<pre><code>" + escH(buf.join("\n")) + "</code></pre>"); continue; }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { close(); out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">"); }
      else if ((m = /^\s*[-*]\s+(.*)$/.exec(l))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push("<li>" + inline(m[1]) + "</li>"); }
      else if ((m = /^\s*\d+\.\s+(.*)$/.exec(l))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push("<li>" + inline(m[1]) + "</li>"); }
      else if (l.indexOf("|") !== -1 && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        // v84: GFM table
        close();
        var cells = function (ln) { return ln.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (x) { return x.trim(); }); };
        var hd = cells(l), t = "<table><thead><tr>" + hd.map(function (x) { return "<th>" + inline(x) + "</th>"; }).join("") + "</tr></thead><tbody>";
        i += 2;
        while (i < lines.length && lines[i].indexOf("|") !== -1 && lines[i].trim()) { t += "<tr>" + cells(lines[i]).map(function (x) { return "<td>" + inline(x) + "</td>"; }).join("") + "</tr>"; i++; }
        out.push(t + "</tbody></table>"); continue;
      }
      else if (!l.trim()) close();
      else { close(); out.push("<p>" + inline(l) + "</p>"); }
      i++;
    }
    close(); return out.join("\n");
  }
  function plain(md) {
    return String(md || "").replace(/```[a-z]*\n?/g, "").replace(/^#{1,6}\s+/gm, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)");
  }

  // ---------- builders ----------
  function buildMd(c) {
    var s = "# " + (c.question || "Answer") + "\n\n" + c.answer.trim() + "\n";
    if (c.sources.length) s += "\n## Sources\n\n" + c.sources.map(function (x, i) { return (i + 1) + ". " + (x.url ? "[" + (x.title || x.url) + "](" + x.url + ")" : x.title); }).join("\n") + "\n";
    return s;
  }
  function buildTxt(c) {
    var s = (c.question || "Answer") + "\n\n" + plain(c.answer).trim() + "\n";
    if (c.sources.length) s += "\nSources\n" + c.sources.map(function (x, i) { return (i + 1) + ". " + (x.title && x.url && x.title !== x.url ? x.title + " - " : "") + (x.url || x.title); }).join("\n") + "\n";
    return s;
  }
  var DOC_CSS = "body{font:16px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#1a1c20}h1{font-size:24px}h2{font-size:19px;margin-top:28px}pre{background:#f3f4f6;padding:12px;border-radius:8px;overflow-x:auto}code{background:#f3f4f6;padding:1px 4px;border-radius:4px}a{color:#1f6f6f}.src{font-size:14px;color:#444}";
  function buildHtml(c, forPrint) {
    var src = c.sources.length ? "<h2>Sources</h2><ol class=\"src\">" + c.sources.map(function (x) { return "<li>" + (x.url ? '<a href="' + escH(x.url) + '">' + escH(x.title || x.url) + "</a>" : escH(x.title)) + "</li>"; }).join("") + "</ol>" : "";
    return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + escH(c.question || "Answer") + "</title><style>" + DOC_CSS + (forPrint ? "@page{margin:18mm}" : "") + "</style></head><body><h1>" + escH(c.question || "Answer") + "</h1>" + md2html(c.answer) + (forPrint ? "" : src) + "</body></html>";
  }
  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime + ";charset=utf-8" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 500);
  }
  function printPdf(c) {
    var f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    f.setAttribute("aria-hidden", "true");
    document.body.appendChild(f);
    var d = f.contentWindow.document; d.open(); d.write(buildHtml(c, true)); d.close();
    var done = false;
    function go() { if (done) return; done = true; try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(function () { f.remove(); }, 60000); }
    f.onload = go; setTimeout(go, 400);
  }

  // ---------- menus ----------
  var openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
  function showMenu(anchor, items) {
    closeMenu();
    var m = document.createElement("div"); m.className = "ex-menu"; m.setAttribute("role", "menu");
    items.forEach(function (it) {
      if (it === "-") { var s = document.createElement("div"); s.className = "ex-sep"; m.appendChild(s); return; }
      if (it.note) { var n = document.createElement("div"); n.className = "ex-note"; n.textContent = it.note; m.appendChild(n); return; }
      var b = document.createElement("button"); b.type = "button"; b.className = "ex-item"; b.setAttribute("role", "menuitem"); b.textContent = it.label;
      b.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); it.run(); });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 0, bottom: 0 };
    var top = r.bottom + 4, left = r.left;
    var h = m.offsetHeight || 0;
    var limit = window.innerHeight - 8, fw = document.getElementById("followupWrapper"); // v84: never sit on top of the pinned composer
    if (fw && fw.offsetParent !== null) { var ft = fw.getBoundingClientRect().top; if (ft > 60) limit = Math.min(limit, ft - 8); }
    if (h && top + h > limit) top = Math.max(8, Math.min(r.top - h - 4, limit - h));
    m.style.top = top + "px"; m.style.left = Math.max(8, Math.min(left, window.innerWidth - (m.offsetWidth || 180) - 8)) + "px";
    openMenu = m;
    var first = m.querySelector(".ex-item"); if (first && first.focus) first.focus();
    return m;
  }
  document.addEventListener("click", function (e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeMenu(); closeComment(); } });

  function mkBtn(row, cls, html, title) {
    var b = document.createElement("button"); b.className = "action-btn ex-btn " + cls; b.type = "button"; b.title = title || ""; b.innerHTML = html; row.appendChild(b); return b;
  }

  // ---------- feedback ----------
  function fbGet(c) {
    var a = lsGet("ai_feedback");
    for (var i = a.length - 1; i >= 0; i--) if (a[i].threadId === c.threadId && a[i].messageIndex === c.messageIndex) return a[i];
    return null;
  }
  function fbSave(c, rating, comment) {
    var a = lsGet("ai_feedback").filter(function (x) { return !(x.threadId === c.threadId && x.messageIndex === c.messageIndex); });
    var rec = { threadId: c.threadId, messageIndex: c.messageIndex, rating: rating, ts: Date.now() };
    if (comment) rec.comment = String(comment).slice(0, 1000);
    a.push(rec); if (a.length > 500) a = a.slice(a.length - 500);
    try { localStorage.setItem("ai_feedback", JSON.stringify(a)); } catch (e) {}
    return rec;
  }
  function fbClear(c) {
    var a = lsGet("ai_feedback").filter(function (x) { return !(x.threadId === c.threadId && x.messageIndex === c.messageIndex); });
    try { localStorage.setItem("ai_feedback", JSON.stringify(a)); } catch (e) {}
  }
  var commentBox = null;
  function closeComment() { if (commentBox) { commentBox.remove(); commentBox = null; } }
  function openComment(anchor, c) {
    closeComment();
    var b = document.createElement("div"); b.className = "ex-comment";
    b.innerHTML = '<label>What went wrong? (optional)</label><textarea maxlength="1000"></textarea><div class="ex-row"><button type="button" data-x="skip">Skip</button><button type="button" class="primary" data-x="send">Send</button></div>';
    document.body.appendChild(b);
    var r = anchor.getBoundingClientRect();
    b.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 276)) + "px"; b.style.top = Math.min(r.bottom + 4, window.innerHeight - 160) + "px";
    b.querySelector('[data-x="skip"]').onclick = closeComment;
    b.querySelector('[data-x="send"]').onclick = function () { var t = b.querySelector("textarea").value.trim(); if (t) fbSave(c, "down", t); closeComment(); };
    commentBox = b; b.querySelector("textarea").focus();
  }
  function paintFb(row, c) {
    var cur = fbGet(c), u = row.querySelector(".ex-up"), d = row.querySelector(".ex-down");
    if (u) { u.classList.toggle("on", !!cur && cur.rating === "up"); u.setAttribute("aria-pressed", String(!!cur && cur.rating === "up")); }
    if (d) { d.classList.toggle("on", !!cur && cur.rating === "down"); d.setAttribute("aria-pressed", String(!!cur && cur.rating === "down")); }
  }

  // ---------- rewrite ----------
  function rewrite(c, value) {
    var sel = document.getElementById("modelSel");
    var q = c.question; if (!q) return;
    var prev = sel ? sel.value : null;
    if (sel) {
      var has = Array.prototype.some.call(sel.options, function (o) { return o.value === value; });
      if (has) sel.value = value;
    }
    var fn = window.submitQuery || g("submitQuery");
    if (typeof fn === "function") fn(q);
    if (sel && prev != null) setTimeout(function () { sel.value = prev; }, 250);
  }

  // ---------- attach ----------
  function decorate(row) {
    if (!row || row.getAttribute("data-ex") === "1") return;
    row.setAttribute("data-ex", "1");
    var ex = mkBtn(row, "ex-export", ICON.exp + " Export \u25BE", "Export this answer");
    var rw = mkBtn(row, "ex-rewrite", ICON.rw + " Rewrite", "Re-run with another model");
    var up = mkBtn(row, "ex-up", ICON.up, "Good answer");
    var dn = mkBtn(row, "ex-down down", ICON.down, "Bad answer");
    ex.addEventListener("click", function (e) {
      e.stopPropagation(); var c = ctxFor(row), base = slug(c.question);
      var items = [
        { label: "Markdown (.md)", run: function () { download(base + ".md", "text/markdown", buildMd(c)); } },
        { label: "Plain text (.txt)", run: function () { download(base + ".txt", "text/plain", buildTxt(c)); } },
        { label: "HTML (.html)", run: function () { download(base + ".html", "text/html", buildHtml(c, false)); } },
        { label: "PDF (print)", run: function () { printPdf(c); } }
      ];
      // v95: Word / Excel / PowerPoint / PDF files from artifacts-files.js live in this same menu (no second button)
      if (window.ArtifactsFiles && window.ArtifactsFiles.menuItems) {
        try { items = items.concat(window.ArtifactsFiles.menuItems(function () { return { text: c.answer }; })); } catch (err) {}
      }
      showMenu(ex, items);
    });
    rw.addEventListener("click", function (e) {
      e.stopPropagation(); var c = ctxFor(row);
      showMenu(rw, MODELS.map(function (m) { return { label: m[1], run: function () { rewrite(c, m[0]); } }; }));
    });
    function rate(r, btn) {
      return function (e) {
        e.stopPropagation(); var c = ctxFor(row), cur = fbGet(c);
        if (cur && cur.rating === r) { fbClear(c); closeComment(); } else { fbSave(c, r); if (r === "down") openComment(btn, c); else closeComment(); }
        paintFb(row, c);
      };
    }
    up.addEventListener("click", rate("up", up));
    dn.addEventListener("click", rate("down", dn));
    paintFb(row, ctxFor(row));
  }
  var obs = null;
  function scan() { var rows = document.querySelectorAll(".answer-actions"); for (var i = 0; i < rows.length; i++) decorate(rows[i]); }
  function attach() {
    scan();
    if (obs || typeof MutationObserver === "undefined") return;
    obs = new MutationObserver(function () { scan(); });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  window.ExportUI = { attach: attach, _build: { md: buildMd, txt: buildTxt, html: buildHtml }, _slug: slug };

  // ---------- share ----------
  function token() {
    var client = g("sb") || window.sb;
    if (!client) return Promise.reject(new Error("Not signed in"));
    return client.auth.getSession().then(function (r) {
      var t = r && r.data && r.data.session && r.data.session.access_token;
      if (!t) throw new Error("Please sign in to share."); return t;
    });
  }
  function call(body, auth) {
    var p = auth ? token() : Promise.resolve(null);
    return p.then(function (t) {
      var h = { "Content-Type": "application/json" }; if (t) h.Authorization = "Bearer " + t;
      return fetch(FN, { method: "POST", headers: h, body: JSON.stringify(body) });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) { if (!res.ok) throw new Error(j.error || "Request failed (" + res.status + ")"); return j; });
    });
  }
  function shareMap() { try { var m = JSON.parse(localStorage.getItem("ai_shares") || "{}"); return m && typeof m === "object" ? m : {}; } catch (e) { return {}; } }
  function setShare(tid, id) { var m = shareMap(); if (id) m[tid] = id; else delete m[tid]; try { localStorage.setItem("ai_shares", JSON.stringify(m)); } catch (e) {} }
  function copy(t) { try { return Promise.resolve(navigator.clipboard.writeText(t)); } catch (e) { return Promise.resolve(); } }
  function createLink(c) {
    var th = c.thread; if (!th) return Promise.reject(new Error("Nothing to share yet"));
    var msgs = (th.messages || []).map(function (m) { return { role: m.role === "user" ? "user" : "assistant", content: String(m.content || ""), sources: normSources(m.sources) }; });
    return call({ action: "create", title: th.title || c.question || "Shared thread", messages: msgs, thread_id: th.id, card_variant: "answer" }, true).then(function (r) {
      setShare(th.id, r.id); return APP + "?share=" + r.id;
    });
  }
  function revokeLink(c) {
    var id = shareMap()[c.threadId]; if (!id) return Promise.reject(new Error("No public link for this thread"));
    return call({ action: "revoke", id: id }, true).then(function () { setShare(c.threadId, null); });
  }
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest("[data-action=share]");
    if (!btn) return;
    e.stopPropagation(); e.preventDefault();
    var row = btn.closest(".answer-actions"), c = ctxFor(row || btn);
    var existing = shareMap()[c.threadId];
    var note = function (m) { showMenu(btn, [{ note: m }]); };
    var items = [
      { label: "Copy app link", run: function () { copy(location.href); } },
      { label: existing ? "Copy public link" : "Create public link", run: function () {
        if (existing) { copy(APP + "?share=" + existing); note("Copied: " + APP + "?share=" + existing); return; }
        createLink(c).then(function (u) { copy(u); note("Public link copied: " + u); }).catch(function (er) { note(er.message); });
      } }
    ];
    if (existing) items.push("-", { label: "Revoke public link", run: function () { revokeLink(c).then(function () { note("Public link revoked"); }).catch(function (er) { note(er.message); }); } });
    showMenu(btn, items);
  }, true);

  // ---------- ShareView ----------
  var viewer = null;
  function render(j) {
    var h = '<div class="sv-wrap"><div class="sv-badge">Shared thread - read only</div><h1 class="sv-title">' + escH(j.title || "Shared thread") + "</h1>";
    (j.messages || []).forEach(function (m) {
      if (m.role === "user") h += '<div class="sv-q">' + escH(m.content) + "</div>";
      else {
        h += '<div class="sv-a">' + md2html(m.content) + "</div>";
        var s = normSources(m.sources).filter(function (x) { return /^https?:\/\//i.test(x.url); });
        if (s.length) h += '<div class="sv-src">Sources' + s.map(function (x) { return '<a href="' + escH(x.url) + '" target="_blank" rel="noopener noreferrer">' + escH(x.title || x.url) + "</a>"; }).join("") + "</div>";
      }
    });
    return h + '<a class="sv-cta" href="' + APP + '">Open ai.spaincos.com</a></div>';
  }
  function maybeOpen() {
    var id; try { id = new URLSearchParams(location.search).get("share"); } catch (e) { return Promise.resolve(false); }
    if (!id || !/^[A-Za-z0-9_-]{6,32}$/.test(id) || viewer) return Promise.resolve(false);
    viewer = document.createElement("div"); viewer.className = "sv-root"; viewer.innerHTML = '<div class="sv-wrap"><div class="sv-badge">Loading shared thread...</div></div>';
    document.body.appendChild(viewer);
    return call({ action: "get", id: id }, false).then(function (j) { viewer.innerHTML = render(j); return true; })
      .catch(function (er) { viewer.innerHTML = '<div class="sv-wrap"><div class="sv-badge">Shared thread</div><h1 class="sv-title">Link not found</h1><div class="sv-err">' + escH("This share link is invalid, unavailable or was revoked.") + '</div><a class="sv-cta" href="' + APP + '">Back to ai.spaincos.com</a></div>'; return false; });
  }
  window.ShareView = { maybeOpen: maybeOpen, _render: render };

  function boot() { attach(); maybeOpen(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
