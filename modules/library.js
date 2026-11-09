/* LibraryUI — full-screen Library (threads, collections, pins, filters).
   Uses app globals when present: threads, saveThreads, renderThreads, renderSpaces,
   loadThread, newThread, pushThreadToServer, sb, currentUser, currentThreadId, showLanding.
   Own storage: ai_collections, ai_pins, ai_library_seen (first-seen timestamps; threads carry no dates). */
(function () {
  "use strict";
  var LS = window.localStorage;
  function jget(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function g(name) { try { return (0, eval)("typeof " + name + "!=='undefined'?" + name + ":undefined"); } catch (e) { return undefined; } }
  function call(name) { var f = g(name); if (typeof f === "function") { try { return f.apply(null, [].slice.call(arguments, 1)); } catch (e) { console.warn(name, e); } } }
  function getThreads() { var t = g("threads"); return Array.isArray(t) ? t : jget("ai_threads", []); }
  function removeThread(id) {
    window.__libTmp = getThreads().filter(function (x) { return x.id !== id; });
    var ok = false;
    try { (0, eval)("threads=window.__libTmp"); ok = true; } catch (e) {}
    if (!ok) jset("ai_threads", window.__libTmp);
    delete window.__libTmp;
    if (g("currentThreadId") === id) { try { (0, eval)("currentThreadId=null"); } catch (e) {} call("showLanding"); }
    var sb = g("sb"), u = g("currentUser");
    if (sb && u) { try { sb.from("threads").delete().eq("id", id).then(function () {}, function () {}); } catch (e) {} }
    call("saveThreads"); call("renderSpaces"); call("renderThreads");
  }

  var state = { q: "", pinOnly: false, sources: false, model: "", col: "", root: null, menu: null, renaming: null };
  var seen = jget("ai_library_seen", {});

  function stamp(t) {
    var v = t.updatedAt || t.updated_at || t.createdAt || t.created_at || t.ts || t.timestamp;
    if (v) { var d = new Date(v).getTime(); if (!isNaN(d)) return d; }
    var m = /^t?(\d{13})/.exec(String(t.id)); if (m) return +m[1];
    if (!seen[t.id]) { seen[t.id] = Date.now(); jset("ai_library_seen", seen); }
    return seen[t.id];
  }
  function collections() { return jget("ai_collections", []); }
  function saveCols(c) { jset("ai_collections", c); }
  function pins() { return jget("ai_pins", []); }
  function colOf(id) { var c = collections(); for (var i = 0; i < c.length; i++) if ((c[i].threadIds || []).indexOf(id) > -1) return c[i]; return null; }
  function uid() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "c" + Date.now() + Math.random().toString(36).slice(2); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function msgs(t) { return Array.isArray(t.messages) ? t.messages : []; }
  function hasSources(t) { return msgs(t).some(function (m) { return (m.sources && m.sources.length) || (m.citations && m.citations.length); }); }
  function modelsOf(t) { var o = []; msgs(t).forEach(function (m) { if (m.model && o.indexOf(m.model) < 0) o.push(m.model); }); if (t.model && o.indexOf(t.model) < 0) o.push(t.model); return o; }
  function groupOf(ts) {
    var n = new Date(), s = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(), day = 864e5;
    if (ts >= s) return "Today"; if (ts >= s - day) return "Yesterday";
    if (ts >= s - 7 * day) return "Previous 7 days"; if (ts >= s - 30 * day) return "Previous 30 days"; return "Older";
  }
  var ORDER = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];
  function fmt(ts) { return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }

  var ICON = {
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    more: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
    pin: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3l5 5-2 1-3 3v4l-2 2-4-4-5 5-1-1 5-5-4-4 2-2h4l3-3z"/></svg>'
  };

  function ensureRoot() {
    if (state.root) return state.root;
    var r = document.createElement("div");
    r.id = "libraryRoot"; r.setAttribute("role", "dialog"); r.setAttribute("aria-label", "Library");
    (document.getElementById("moduleRoot") || document.body).appendChild(r);
    state.root = r;
    r.addEventListener("click", function (e) { if (state.menu && !e.target.closest(".lib-menu") && !e.target.closest(".lib-more")) closeMenu(); });
    return r;
  }
  function closeMenu() { if (state.menu) { state.menu.remove(); state.menu = null; } var o = document.querySelector(".lib-more.on"); if (o) o.classList.remove("on"); }

  function shell() {
    var r = ensureRoot();
    r.innerHTML = '<div class="lib-header"><div class="lib-top"><h1 class="lib-title">Library</h1>' +
      '<label class="lib-search">' + ICON.search + '<input id="libQ" type="search" placeholder="Search threads and messages" autocomplete="off"></label>' +
      '<span class="lib-spacer"></span><button class="lib-icon-btn" id="libClose" aria-label="Close library" title="Close (Esc)">' + ICON.close + '</button></div>' +
      '<div class="lib-chips" id="libChips"></div></div><div class="lib-body" id="libBody"></div>';
    var q = r.querySelector("#libQ"); q.value = state.q;
    q.addEventListener("input", function () { state.q = q.value; renderBody(); });
    r.querySelector("#libClose").onclick = close;
  }

  function renderChips(all) {
    var el = document.getElementById("libChips"); if (!el) return;
    var h = "";
    h += '<button class="lib-chip' + (state.pinOnly ? " active" : "") + '" data-a="pin">Pinned</button>';
    h += '<button class="lib-chip' + (state.sources ? " active" : "") + '" data-a="src">Has sources</button>';
    var models = []; all.forEach(function (t) { modelsOf(t).forEach(function (m) { if (models.indexOf(m) < 0) models.push(m); }); });
    if (models.length) { h += '<span class="lib-sep"></span>'; models.forEach(function (m) { h += '<button class="lib-chip' + (state.model === m ? " active" : "") + '" data-a="model" data-v="' + esc(m) + '">' + esc(m) + '</button>'; }); }
    h += '<span class="lib-sep"></span>';
    h += '<button class="lib-chip' + (!state.col ? " active" : "") + '" data-a="col" data-v="">All</button>';
    var cols = collections();
    cols.forEach(function (c) {
      h += '<button class="lib-chip' + (state.col === c.id ? " active" : "") + '" data-a="col" data-v="' + esc(c.id) + '">' + esc(c.name) + ' <span class="x">' + (c.threadIds || []).length + '</span></button>';
    });
    if (state.col === "none") { }
    h += '<button class="lib-chip' + (state.col === "none" ? " active" : "") + '" data-a="col" data-v="none">Uncollected</button>';
    h += '<button class="lib-chip" data-a="newcol">+ New collection</button>';
    if (state.col && state.col !== "none") h += '<button class="lib-chip" data-a="rencol">Rename</button><button class="lib-chip" data-a="delcol">Delete collection</button>';
    el.innerHTML = h;
    el.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return; var a = b.dataset.a, v = b.dataset.v;
      if (a === "pin") state.pinOnly = !state.pinOnly;
      else if (a === "src") state.sources = !state.sources;
      else if (a === "model") state.model = state.model === v ? "" : v;
      else if (a === "col") state.col = v;
      else if (a === "newcol") { var n = (prompt("Collection name") || "").trim(); if (n) { var c = collections(); var o = { id: uid(), name: n.slice(0, 40), createdAt: Date.now(), threadIds: [] }; c.push(o); saveCols(c); state.col = o.id; } }
      else if (a === "rencol") { var cc = collections(), cur = cc.filter(function (x) { return x.id === state.col; })[0]; if (cur) { var nn = (prompt("Rename collection", cur.name) || "").trim(); if (nn) { cur.name = nn.slice(0, 40); saveCols(cc); } } }
      else if (a === "delcol") { if (confirm("Delete this collection? Threads are kept.")) { saveCols(collections().filter(function (x) { return x.id !== state.col; })); state.col = ""; } }
      renderBody();
    };
  }

  function filtered(all) {
    var q = state.q.trim().toLowerCase(), p = pins(), col = null;
    if (state.col && state.col !== "none") col = collections().filter(function (c) { return c.id === state.col; })[0];
    return all.filter(function (t) {
      if (state.pinOnly && p.indexOf(t.id) < 0) return false;
      if (state.sources && !hasSources(t)) return false;
      if (state.model && modelsOf(t).indexOf(state.model) < 0) return false;
      if (state.col === "none" && colOf(t.id)) return false;
      if (state.col && state.col !== "none" && (!col || (col.threadIds || []).indexOf(t.id) < 0)) return false;
      if (q && String(t.title || "").toLowerCase().indexOf(q) < 0 &&
        !msgs(t).some(function (m) { return String(m.content || "").toLowerCase().indexOf(q) > -1; })) return false;
      return true;
    });
  }

  function renderBody() {
    var body = document.getElementById("libBody"); if (!body) return;
    closeMenu();
    var all = getThreads();
    renderChips(all);
    var list = filtered(all), p = pins();
    if (!list.length) {
      var none = !all.length;
      body.innerHTML = '<div class="lib-empty"><h2>' + (none ? "Your library is empty" : "No matching threads") + '</h2><p>' +
        (none ? "Threads you start will show up here, ready to revisit, pin and organize." : "Try a different search or clear a filter.") +
        '</p><button class="lib-btn primary" id="libNew">New thread</button></div>';
      body.querySelector("#libNew").onclick = function () { close(); call("newThread"); };
      return;
    }
    var items = list.map(function (t) { return { t: t, ts: stamp(t), pin: p.indexOf(t.id) > -1 }; });
    items.sort(function (a, b) { return (b.pin - a.pin) || (b.ts - a.ts); });
    var groups = {}, pinned = [];
    items.forEach(function (it) { if (it.pin) pinned.push(it); else (groups[groupOf(it.ts)] = groups[groupOf(it.ts)] || []).push(it); });
    body.innerHTML = "";
    function section(name, arr) {
      if (!arr || !arr.length) return;
      var s = document.createElement("section"); s.className = "lib-group";
      s.innerHTML = "<h3>" + esc(name) + "</h3>"; var gr = document.createElement("div"); gr.className = "lib-grid";
      arr.forEach(function (it) { gr.appendChild(card(it)); }); s.appendChild(gr); body.appendChild(s);
    }
    section("Pinned", pinned);
    ORDER.forEach(function (n) { section(n, groups[n]); });
  }

  function card(it) {
    var t = it.t, c = colOf(t.id), ms = msgs(t);
    var el = document.createElement("div"); el.className = "lib-card" + (it.pin ? " pinned" : ""); el.tabIndex = 0; el.dataset.id = t.id;
    var first = ""; for (var i = 0; i < ms.length; i++) if (ms[i].role === "assistant" && ms[i].content) { first = ms[i].content; break; }
    first = String(first).replace(/\[\d+\]/g, "").replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().slice(0, 160);
    var titleHtml = state.renaming === t.id ? '<input class="lib-rename" value="' + esc(t.title) + '" maxlength="60">' : '<div class="lib-card-title">' + esc(t.title || "Untitled") + '</div>';
    el.innerHTML = titleHtml + '<span class="lib-pin" title="Pinned">' + ICON.pin + '</span>' +
      '<button class="lib-more" aria-label="More actions" title="More">' + ICON.more + '</button>' +
      (first ? '<div class="lib-card-snippet">' + esc(first) + '</div>' : '') +
      '<div class="lib-card-meta"><span>' + fmt(it.ts) + '</span><span>' + ms.length + ' message' + (ms.length === 1 ? '' : 's') + '</span>' +
      (c ? '<span class="lib-badge">' + esc(c.name) + '</span>' : '') + '</div>';
    var inp = el.querySelector(".lib-rename");
    if (inp) {
      setTimeout(function () { inp.focus(); inp.select(); }, 0);
      var done = false;
      var fin = function (save) {
        if (done) return; done = true; state.renaming = null;
        var v = inp.value.trim().slice(0, 60);
        if (save && v) { t.title = v; call("saveThreads"); if (!g("threads")) { var a = getThreads(); jset("ai_threads", a); } call("pushThreadToServer", t); call("renderThreads"); }
        renderBody();
      };
      inp.onclick = function (e) { e.stopPropagation(); };
      inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === "Enter") fin(true); else if (e.key === "Escape") fin(false); };
      inp.onblur = function () { fin(true); };
    }
    el.onclick = function () { if (state.renaming) return; close(); call("loadThread", t.id); };
    el.onkeydown = function (e) { if (e.key === "Enter" && e.target === el) el.click(); };
    el.querySelector(".lib-more").onclick = function (e) { e.stopPropagation(); openMenu(t, e.currentTarget); };
    return el;
  }

  function openMenu(t, anchor) {
    var was = state.menu && state.menu.dataset.id === t.id; closeMenu(); if (was) return;
    anchor.classList.add("on");
    var m = document.createElement("div"); m.className = "lib-menu"; m.dataset.id = t.id;
    var p = pins().indexOf(t.id) > -1, cur = colOf(t.id), cols = collections();
    var h = '<button data-a="pin">' + (p ? "Unpin" : "Pin") + '</button><button data-a="ren">Rename</button><hr><div class="lbl">Add to collection</div>';
    cols.forEach(function (c) { h += '<button data-a="col" data-v="' + esc(c.id) + '">' + ((cur && cur.id === c.id) ? "&#10003; " : "") + esc(c.name) + '</button>'; });
    h += '<button data-a="newcol">+ New collection&hellip;</button>';
    if (cur) h += '<button data-a="uncol">Remove from collection</button>';
    h += '<hr><button class="danger" data-a="del">Delete</button>';
    m.innerHTML = h; document.body.appendChild(m); state.menu = m;
    var rc = anchor.getBoundingClientRect(), w = m.offsetWidth, hh = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - w - 8, rc.right - w)) + "px";
    m.style.top = Math.max(8, Math.min(innerHeight - hh - 8, rc.bottom + 4)) + "px";
    m.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return; var a = b.dataset.a;
      function assign(cid) { var cs = collections(); cs.forEach(function (c) { c.threadIds = (c.threadIds || []).filter(function (x) { return x !== t.id; }); if (c.id === cid) c.threadIds.push(t.id); }); saveCols(cs); }
      if (a === "pin") { var ps = pins(), i = ps.indexOf(t.id); if (i > -1) ps.splice(i, 1); else ps.push(t.id); jset("ai_pins", ps); }
      else if (a === "ren") { state.renaming = t.id; }
      else if (a === "col") assign(b.dataset.v);
      else if (a === "uncol") assign(null);
      else if (a === "newcol") { var n = (prompt("Collection name") || "").trim(); if (!n) return closeMenu(); var cs = collections(), o = { id: uid(), name: n.slice(0, 40), createdAt: Date.now(), threadIds: [] }; cs.push(o); saveCols(cs); assign(o.id); }
      else if (a === "del") { if (!confirm("Delete this thread?")) return closeMenu(); removeThread(t.id); var ps2 = pins().filter(function (x) { return x !== t.id; }); jset("ai_pins", ps2); assign(null); }
      renderBody();
    };
  }

  function onKey(e) { if (e.key === "Escape" && state.root && state.root.classList.contains("open") && !state.renaming) { if (state.menu) closeMenu(); else close(); } }

  function open() {
    ensureRoot(); shell(); state.root.classList.add("open"); renderBody();
    document.addEventListener("keydown", onKey);
    var q = document.getElementById("libQ"); if (q) q.focus();
  }
  function close() {
    closeMenu(); state.renaming = null;
    if (state.root) state.root.classList.remove("open");
    document.removeEventListener("keydown", onKey);
  }
  window.LibraryUI = { open: open, close: close };
})();
