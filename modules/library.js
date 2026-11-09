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

  var state = { q: "", pinOnly: false, sources: false, archived: false, model: "", col: "", root: null, menu: null, renaming: null, selecting: false, sel: {}, ext: null, extQ: "" };
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
  function archive() { return jget("ai_archived", []); }
  function persistThreads() {
    call("saveThreads");
    if (!Array.isArray(g("threads"))) jset("ai_threads", getThreads());
  }
  function spaces() { var s = g("spaces"); return Array.isArray(s) ? s : jget("ai_spaces", []); }

  /* ---- Search: keyword (substring) + local semantic-lite ranking ----
     Semantic-lite = stemmed TF-IDF cosine with fuzzy prefix/trigram term matching, built in-browser
     from the thread text. No thread vectors exist client-side (the server index covers imported context
     only), so an optional hook window.LibrarySemanticSearch(query) -> Promise<[{id,score}]> can plug in
     server embeddings; its hits are merged in when it resolves. */
  var STOP = {}; "the a an and or of to in on for is are was were be it this that with as at by from how what why do does i you we my me can about".split(" ").forEach(function (w) { STOP[w] = 1; });
  function stem(w) { return w.length > 4 ? w.replace(/(ingly|ing|edly|ed|ies|es|ly|s)$/, function (m) { return m === "ies" ? "y" : ""; }) : w; }
  function tok(str) { return String(str || "").toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1 && !STOP[w]; }).map(stem); }
  function tri(w) { var o = {}, p = "^" + w + "$"; for (var i = 0; i < p.length - 2; i++) o[p.substr(i, 3)] = 1; return o; }
  function triSim(a, b) { var A = tri(a), B = tri(b), n = 0, ka = 0, kb = 0, k; for (k in A) { ka++; if (B[k]) n++; } for (k in B) kb++; return n / (ka + kb - n || 1); }
  var idx = null;
  function buildIndex(all) {
    var sig = all.length + ":" + all.reduce(function (n, t) { return n + msgs(t).length + String(t.title || "").length; }, 0);
    if (idx && idx.sig === sig) return idx;
    var df = {}, docs = {}, N = all.length || 1;
    all.forEach(function (t) {
      var tf = {}, len = 0;
      function add(txt, w) { tok(txt).forEach(function (x) { tf[x] = (tf[x] || 0) + w; len += w; }); }
      add(t.title, 3); msgs(t).forEach(function (m) { add(m.content, 1); });
      for (var k in tf) df[k] = (df[k] || 0) + 1;
      docs[t.id] = { tf: tf, len: len || 1 };
    });
    idx = { sig: sig, df: df, docs: docs, N: N, vocab: Object.keys(df) };
    return idx;
  }
  function semScore(ix, id, qt) {
    var d = ix.docs[id]; if (!d || !qt.length) return 0;
    var tot = 0;
    qt.forEach(function (q) {
      var best = 0, hit = d.tf[q] ? 1 : 0;
      if (hit) best = 1;
      else if (q.length >= 4) {
        for (var k in d.tf) { if (k.length >= 4 && (k.indexOf(q) === 0 || q.indexOf(k) === 0)) { best = Math.max(best, .7); } else if (k.length >= 4 && Math.abs(k.length - q.length) < 3 && triSim(q, k) >= .55) best = Math.max(best, .5); }
      }
      if (!best) return;
      var key = d.tf[q] ? q : null, idf = Math.log(1 + ix.N / ((key && ix.df[key]) || 1));
      tot += best * idf * (1 + Math.log(1 + (d.tf[q] || 1)));
    });
    return tot / (qt.length * Math.sqrt(1 + Math.log(1 + d.len)) * 2.5);
  }
  function searchScores(all, q) {
    var out = {}, ql = q.toLowerCase(), qt = tok(q), ix = buildIndex(all);
    all.forEach(function (t) {
      var kw = String(t.title || "").toLowerCase().indexOf(ql) > -1, snip = "";
      if (!kw) { var ms = msgs(t); for (var i = 0; i < ms.length; i++) { var c = String(ms[i].content || ""), p = c.toLowerCase().indexOf(ql); if (p > -1) { kw = true; snip = c.slice(Math.max(0, p - 50), p + 90); break; } } }
      var sem = semScore(ix, t.id, qt), ext = state.ext && state.extQ === q && state.ext[t.id] || 0;
      if (kw || sem >= .12 || ext) out[t.id] = { score: (kw ? 2 : 0) + sem + ext, kw: kw, snip: snip.replace(/\s+/g, " ") };
    });
    return out;
  }
  var extTimer = null;
  function runExternal(q) {
    var f = window.LibrarySemanticSearch; if (typeof f !== "function" || !q.trim()) return;
    clearTimeout(extTimer);
    extTimer = setTimeout(function () {
      Promise.resolve(f(q)).then(function (r) {
        if (state.q !== q || !Array.isArray(r)) return;
        var m = {}; r.forEach(function (x) { if (x && x.id != null) m[x.id] = +x.score || .5; });
        state.ext = m; state.extQ = q; renderBody();
      }).catch(function () {});
    }, 350);
  }

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
    r.addEventListener("click", function (e) { if (state.menu && !e.target.closest(".lib-menu") && !e.target.closest(".lib-more") && !e.target.closest("[data-b=move],[data-b=col]")) closeMenu(); });
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
    q.addEventListener("input", function () { state.q = q.value; state.ext = null; renderBody(); runExternal(state.q); });
    r.querySelector("#libClose").onclick = close;
  }

  function renderChips(all) {
    var el = document.getElementById("libChips"); if (!el) return;
    var h = "";
    h += '<button class="lib-chip' + (state.pinOnly ? " active" : "") + '" data-a="pin">Pinned</button>';
    h += '<button class="lib-chip' + (state.sources ? " active" : "") + '" data-a="src">Has sources</button>';
    h += '<button class="lib-chip' + (state.archived ? " active" : "") + '" data-a="arch">Archived <span class="x">' + archive().length + '</span></button>';
    h += '<button class="lib-chip' + (state.selecting ? " active" : "") + '" data-a="sel">Select</button>';
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
      else if (a === "arch") { state.archived = !state.archived; state.sel = {}; }
      else if (a === "sel") { state.selecting = !state.selecting; state.sel = {}; }
      else if (a === "model") state.model = state.model === v ? "" : v;
      else if (a === "col") state.col = v;
      else if (a === "newcol") { var n = (prompt("Collection name") || "").trim(); if (n) { var c = collections(); var o = { id: uid(), name: n.slice(0, 40), createdAt: Date.now(), threadIds: [] }; c.push(o); saveCols(c); state.col = o.id; } }
      else if (a === "rencol") { var cc = collections(), cur = cc.filter(function (x) { return x.id === state.col; })[0]; if (cur) { var nn = (prompt("Rename collection", cur.name) || "").trim(); if (nn) { cur.name = nn.slice(0, 40); saveCols(cc); } } }
      else if (a === "delcol") { if (confirm("Delete this collection? Threads are kept.")) { saveCols(collections().filter(function (x) { return x.id !== state.col; })); state.col = ""; } }
      renderBody();
    };
  }

  function filtered(all) {
    var q = state.q.trim(), p = pins(), col = null, ar = archive(), sc = q ? searchScores(all, q) : null;
    state.scores = sc;
    if (state.col && state.col !== "none") col = collections().filter(function (c) { return c.id === state.col; })[0];
    return all.filter(function (t) {
      if ((ar.indexOf(t.id) > -1) !== state.archived) return false;
      if (state.pinOnly && p.indexOf(t.id) < 0) return false;
      if (state.sources && !hasSources(t)) return false;
      if (state.model && modelsOf(t).indexOf(state.model) < 0) return false;
      if (state.col === "none" && colOf(t.id)) return false;
      if (state.col && state.col !== "none" && (!col || (col.threadIds || []).indexOf(t.id) < 0)) return false;
      if (q && !sc[t.id]) return false;
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
      var none = !all.length; renderBulk();
      body.innerHTML = '<div class="lib-empty"><h2>' + (none ? "Your library is empty" : state.archived && !state.q ? "Nothing archived" : "No matching threads") + '</h2><p>' +
        (none ? "Threads you start will show up here, ready to revisit, pin and organize." : "Try a different search or clear a filter.") +
        '</p><button class="lib-btn primary" id="libNew">New thread</button></div>';
      body.querySelector("#libNew").onclick = function () { close(); call("newThread"); };
      return;
    }
    var sc = state.scores, items = list.map(function (t) { return { t: t, ts: stamp(t), pin: p.indexOf(t.id) > -1, m: sc && sc[t.id] }; });
    var groups = {}, pinned = [];
    if (sc) items.sort(function (a, b) { return b.m.score - a.m.score; });
    else items.sort(function (a, b) { return (b.pin - a.pin) || (b.ts - a.ts); });
    if (!sc) items.forEach(function (it) { if (it.pin) pinned.push(it); else (groups[groupOf(it.ts)] = groups[groupOf(it.ts)] || []).push(it); });
    body.innerHTML = "";
    function section(name, arr) {
      if (!arr || !arr.length) return;
      var s = document.createElement("section"); s.className = "lib-group";
      s.innerHTML = "<h3>" + esc(name) + "</h3>"; var gr = document.createElement("div"); gr.className = "lib-grid";
      arr.forEach(function (it) { gr.appendChild(card(it)); }); s.appendChild(gr); body.appendChild(s);
    }
    if (sc) section((state.archived ? "Archived results" : "Results") + " (" + items.length + ")", items);
    else { section(state.archived ? "Archived" : "Pinned", state.archived ? items : pinned); if (!state.archived) ORDER.forEach(function (n) { section(n, groups[n]); }); }
    renderBulk();
  }

  function card(it) {
    var t = it.t, c = colOf(t.id), ms = msgs(t);
    var el = document.createElement("div"); el.className = "lib-card" + (it.pin ? " pinned" : ""); el.tabIndex = 0; el.dataset.id = t.id;
    var first = ""; for (var i = 0; i < ms.length; i++) if (ms[i].role === "assistant" && ms[i].content) { first = ms[i].content; break; }
    if (it.m && it.m.snip) first = it.m.snip;
    first = String(first).replace(/\[\d+\]/g, "").replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().slice(0, 160);
    var titleHtml = state.renaming === t.id ? '<input class="lib-rename" value="' + esc(t.title) + '" maxlength="60">' : '<div class="lib-card-title">' + esc(t.title || "Untitled") + '</div>';
    var sel = !!state.sel[t.id]; if (sel) el.classList.add("selected");
    el.innerHTML = (state.selecting ? '<span class="lib-sel' + (sel ? " on" : "") + '" role="checkbox" aria-checked="' + sel + '"></span>' : '') + titleHtml + '<span class="lib-pin" title="Pinned">' + ICON.pin + '</span>' +
      '<button class="lib-more" aria-label="More actions" title="More">' + ICON.more + '</button>' +
      (first ? '<div class="lib-card-snippet">' + esc(first) + '</div>' : '') +
      '<div class="lib-card-meta"><span>' + fmt(it.ts) + '</span><span>' + ms.length + ' message' + (ms.length === 1 ? '' : 's') + '</span>' +
      (c ? '<span class="lib-badge">' + esc(c.name) + '</span>' : '') +
      (it.m && !it.m.kw ? '<span class="lib-badge" title="Related by meaning, not an exact match">Related</span>' : '') +
      (t.spaceId ? '<span class="lib-badge">' + esc((spaces().filter(function (s) { return s.id === t.spaceId; })[0] || {}).name || "Project") + '</span>' : '') + '</div>';
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
    el.onclick = function () { if (state.renaming) return; if (state.selecting) { if (state.sel[t.id]) delete state.sel[t.id]; else state.sel[t.id] = 1; renderBody(); return; } close(); call("loadThread", t.id); };
    el.onkeydown = function (e) { if (e.key === "Enter" && e.target === el) el.click(); };
    el.querySelector(".lib-more").onclick = function (e) { e.stopPropagation(); openMenu(t, e.currentTarget); };
    return el;
  }

  function openMenu(t, anchor) {
    var was = state.menu && state.menu.dataset.id === t.id; closeMenu(); if (was) return;
    anchor.classList.add("on");
    var m = document.createElement("div"); m.className = "lib-menu"; m.dataset.id = t.id;
    var p = pins().indexOf(t.id) > -1, cur = colOf(t.id), cols = collections();
    var h = '<button data-a="pin">' + (p ? "Unpin" : "Pin") + '</button><button data-a="ren">Rename</button><button data-a="arch">' + (archive().indexOf(t.id) > -1 ? "Unarchive" : "Archive") + '</button><hr><div class="lbl">Add to collection</div>';
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
      else if (a === "arch") { setArchived([t.id], archive().indexOf(t.id) < 0); }
      else if (a === "col") assign(b.dataset.v);
      else if (a === "uncol") assign(null);
      else if (a === "newcol") { var n = (prompt("Collection name") || "").trim(); if (!n) return closeMenu(); var cs = collections(), o = { id: uid(), name: n.slice(0, 40), createdAt: Date.now(), threadIds: [] }; cs.push(o); saveCols(cs); assign(o.id); }
      else if (a === "del") { if (!confirm("Delete this thread?")) return closeMenu(); removeThread(t.id); var ps2 = pins().filter(function (x) { return x !== t.id; }); jset("ai_pins", ps2); assign(null); }
      renderBody();
    };
  }

  function setArchived(ids, on) {
    var a = archive().filter(function (x) { return ids.indexOf(x) < 0; });
    if (on) a = a.concat(ids);
    jset("ai_archived", a);
  }
  function selIds() { return Object.keys(state.sel); }
  function renderBulk() {
    var bar = document.getElementById("libBulk");
    var ids = selIds();
    state.root.classList.toggle("selecting", state.selecting);
    if (!state.selecting) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement("div"); bar.id = "libBulk"; bar.className = "lib-bulk"; state.root.appendChild(bar); }
    var disabled = ids.length ? "" : " disabled";
    bar.innerHTML = '<span class="lib-bulk-n">' + ids.length + ' selected</span>' +
      '<button class="lib-btn" data-b="all">Select all</button>' +
      '<button class="lib-btn" data-b="pin"' + disabled + '>Pin</button><button class="lib-btn" data-b="unpin"' + disabled + '>Unpin</button>' +
      '<button class="lib-btn" data-b="arch"' + disabled + '>' + (state.archived ? "Unarchive" : "Archive") + '</button>' +
      '<button class="lib-btn" data-b="move"' + disabled + '>Move to project</button>' +
      '<button class="lib-btn" data-b="col"' + disabled + '>Add to collection</button>' +
      '<button class="lib-btn danger" data-b="del"' + disabled + '>Delete</button>' +
      '<button class="lib-btn" data-b="done">Done</button>';
    bar.onclick = function (e) {
      var b = e.target.closest("button"); if (!b || b.disabled) return; var k = b.dataset.b, ids = selIds();
      if (k === "done") { state.selecting = false; state.sel = {}; }
      else if (k === "all") { filtered(getThreads()).forEach(function (t) { state.sel[t.id] = 1; }); }
      else if (k === "pin" || k === "unpin") { var ps = pins().filter(function (x) { return ids.indexOf(x) < 0; }); if (k === "pin") ps = ps.concat(ids); jset("ai_pins", ps); }
      else if (k === "arch") { setArchived(ids, !state.archived); state.sel = {}; }
      else if (k === "move") return bulkMenu(b, "move", ids);
      else if (k === "col") return bulkMenu(b, "col", ids);
      else if (k === "del") { if (!confirm("Delete " + ids.length + " thread" + (ids.length === 1 ? "" : "s") + "? This cannot be undone.")) return;
        ids.forEach(function (id) { removeThread(id); }); jset("ai_pins", pins().filter(function (x) { return ids.indexOf(x) < 0; })); setArchived(ids, false);
        var cs = collections(); cs.forEach(function (c) { c.threadIds = (c.threadIds || []).filter(function (x) { return ids.indexOf(x) < 0; }); }); saveCols(cs); state.sel = {}; }
      renderBody();
    };
  }
  function bulkMenu(anchor, kind, ids) {
    closeMenu();
    var m = document.createElement("div"); m.className = "lib-menu";
    var h = '<div class="lbl">' + (kind === "move" ? "Move to project" : "Add to collection") + '</div>';
    if (kind === "move") { spaces().forEach(function (s) { h += '<button data-v="' + esc(s.id) + '">' + esc(s.name) + '</button>'; }); h += '<hr><button data-v="">No project</button>'; if (!spaces().length) h = '<div class="lbl">No projects yet</div><button data-v="">No project</button>'; }
    else { collections().forEach(function (c) { h += '<button data-v="' + esc(c.id) + '">' + esc(c.name) + '</button>'; }); h += '<button data-v="__new">+ New collection&hellip;</button><hr><button data-v="">Remove from collections</button>'; }
    m.innerHTML = h; document.body.appendChild(m); state.menu = m;
    var rc = anchor.getBoundingClientRect(), w = m.offsetWidth, hh = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - w - 8, rc.left)) + "px";
    m.style.top = Math.max(8, rc.top - hh - 6) + "px";
    m.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return; var v = b.dataset.v;
      if (kind === "move") {
        getThreads().forEach(function (t) { if (ids.indexOf(t.id) > -1) { t.spaceId = v || null; call("pushThreadToServer", t); } });
        persistThreads(); call("renderSpaces"); call("renderThreads");
      } else {
        var cs = collections();
        if (v === "__new") { var n = (prompt("Collection name") || "").trim(); if (!n) return closeMenu(); var o = { id: uid(), name: n.slice(0, 40), createdAt: Date.now(), threadIds: [] }; cs.push(o); v = o.id; }
        cs.forEach(function (c) { c.threadIds = (c.threadIds || []).filter(function (x) { return ids.indexOf(x) < 0; }); if (c.id === v) c.threadIds = c.threadIds.concat(ids); });
        saveCols(cs);
      }
      state.sel = {}; renderBody();
    };
  }

  function onKey(e) { if (e.key === "Escape" && state.root && state.root.classList.contains("open") && !state.renaming) { if (state.menu) closeMenu(); else close(); } }

  function open() {
    ensureRoot(); shell(); state.root.classList.add("open"); renderBody();
    document.addEventListener("keydown", onKey);
    var q = document.getElementById("libQ"); if (q) q.focus();
  }
  function close() {
    closeMenu(); state.renaming = null; state.selecting = false; state.sel = {};
    var bb = document.getElementById("libBulk"); if (bb) bb.remove();
    if (state.root) state.root.classList.remove("open");
    document.removeEventListener("keydown", onKey);
  }
  window.LibraryUI = { open: open, close: close };
})();
