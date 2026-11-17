/* LibraryUI — full-screen Library (threads, collections, pins, filters + Artifact Library 34d).
   Uses app globals when present: threads, saveThreads, renderThreads, renderSpaces,
   loadThread, newThread, pushThreadToServer, sb, currentUser, currentThreadId, showLanding, submitQuery.
   Own storage: ai_collections, ai_pins, ai_library_seen, ai_artifact_revs. */
(function () {
  "use strict";
  var LS = window.localStorage;
  var DEFAULT_SUPABASE_URL = "https://bnxermyboeigvwonfrzx.supabase.co";
  var BUCKET = "gateway-assets";

  function jget(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function g(name) {
    try {
      if (window.__appGlobals && window.__appGlobals[name] !== undefined) return window.__appGlobals[name];
      return window[name];
    } catch (e) { return undefined; }
  }
  function call(name) { var f = g(name); if (typeof f === "function") { try { return f.apply(null, [].slice.call(arguments, 1)); } catch (e) { console.warn(name, e); } } }
  function getThreads() { var t = g("threads"); return Array.isArray(t) ? t : jget("ai_threads", []); }
  function removeThread(id) {
    window.__libTmp = getThreads().filter(function (x) { return x.id !== id; });
    var ok = false;
    try { if (window.__appGlobals) { window.__appGlobals.threads = window.__libTmp; ok = true; } } catch (e) {}
    if (!ok) jset("ai_threads", window.__libTmp);
    delete window.__libTmp;
    if (g("currentThreadId") === id) { try { if (window.__appGlobals) window.__appGlobals.currentThreadId = null; } catch (e) {} call("showLanding"); }
    var sb = g("sb"), u = g("currentUser");
    if (sb && u) { try { sb.from("threads").delete().eq("id", id).then(function () {}, function () {}); } catch (e) {} }
    call("saveThreads"); call("renderSpaces"); call("renderThreads");
  }

  var state = {
    tab: "threads",
    q: "",
    pinOnly: false,
    sources: false,
    archived: false,
    model: "",
    col: "",
    root: null,
    menu: null,
    renaming: null,
    selecting: false,
    sel: {},
    ext: null,
    extQ: "",
    artKind: "",
    artThreadOnly: false,
    artLoading: false,
    artLoaded: false,
    artError: "",
    artItems: [],
    artOpening: ""
  };
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

  /* ---- Search: keyword (substring) + local semantic-lite ranking ---- */
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
  function fmtDateTime(ts) {
    if (!ts) return "Unknown date";
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function relAge(ts) {
    if (!ts) return "";
    var diff = Math.max(0, Date.now() - ts);
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    if (diff < 172800000) return "Yesterday";
    if (diff < 2592000000) return Math.floor(diff / 86400000) + "d ago";
    return "";
  }
  function fmtBytes(n) {
    n = Number(n) || 0;
    if (!n) return "";
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  var ICON = {
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    more: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
    pin: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3l5 5-2 1-3 3v4l-2 2-4-4-5 5-1-1 5-5-4-4 2-2h4l3-3z"/></svg>',
    doc: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>',
    sheet: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
    webapp: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/><path d="M10 13l-2 2 2 2M14 13l2 2-2 2"/></svg>',
    open: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
    regen: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>',
    history: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>'
  };

  /* ---- Artifact Library (34d: gateway-assets/artifacts/<userId>/<filename>) ---- */
  var EXT_KIND = {
    md: "md", markdown: "md",
    csv: "csv",
    xlsx: "xlsx",
    docx: "docx",
    pdf: "pdf",
    html: "webapp", htm: "webapp",
    txt: "txt", json: "txt", log: "txt", tsv: "txt", yaml: "txt", yml: "txt", sql: "txt", xml: "txt"
  };
  var KIND_LABEL = {
    md: "Markdown",
    csv: "CSV",
    txt: "Text",
    xlsx: "Spreadsheet",
    docx: "Word",
    pdf: "PDF",
    webapp: "Web app"
  };

  function kindOfFile(filename, mimetype) {
    var m = /\.([a-z0-9]+)$/i.exec(String(filename || ""));
    var ext = m ? m[1].toLowerCase() : "";
    if (EXT_KIND[ext]) return EXT_KIND[ext];
    var mt = String(mimetype || "").toLowerCase();
    if (mt.indexOf("spreadsheetml") > -1) return "xlsx";
    if (mt.indexOf("wordprocessingml") > -1) return "docx";
    if (mt.indexOf("pdf") > -1) return "pdf";
    if (mt.indexOf("csv") > -1) return "csv";
    if (mt.indexOf("html") > -1) return "webapp";
    if (mt.indexOf("markdown") > -1) return "md";
    return "txt";
  }

  function isTextKind(kind) {
    return kind === "md" || kind === "csv" || kind === "txt" || kind === "webapp";
  }

  function titleFromFilename(filename) {
    var base = String(filename || "").replace(/\.[^.]+$/, "").trim();
    return base || String(filename || "Document");
  }

  function encodeStoragePath(path) {
    return String(path || "").split("/").map(function (seg) { return encodeURIComponent(seg); }).join("/");
  }

  function getStorageAuth() {
    var sbClient = g("sb");
    var url = g("SUPABASE_URL") || (sbClient && sbClient.supabaseUrl) || DEFAULT_SUPABASE_URL;
    var anon = g("SUPABASE_ANON") || (sbClient && sbClient.supabaseKey) || "";
    var curUser = g("currentUser");
    var pSession = (sbClient && sbClient.auth && typeof sbClient.auth.getSession === "function")
      ? Promise.resolve(sbClient.auth.getSession()).catch(function () { return null; })
      : Promise.resolve(null);
    return pSession.then(function (res) {
      var sess = res && res.data && res.data.session;
      var token = sess && sess.access_token;
      var userId = (sess && sess.user && sess.user.id) || (curUser && curUser.id) || "";
      if (!token) {
        try {
          for (var i = 0; i < LS.length; i++) {
            var k = LS.key(i);
            if (k && /^sb-.*-auth-token$/.test(k)) {
              var parsed = JSON.parse(LS.getItem(k) || "null");
              if (parsed && parsed.access_token) {
                token = parsed.access_token;
                if (!userId && parsed.user && parsed.user.id) userId = parsed.user.id;
                break;
              }
            }
          }
        } catch (e) {}
      }
      return { ok: Boolean(token && userId), url: String(url).replace(/\/+$/, ""), anon: anon, token: token || "", userId: userId };
    });
  }

  function recordAndMergeRevs(userId, filename, version, updatedAt, size) {
    if (!userId || !filename || !updatedAt) return 1;
    var key = "ai_artifact_revs";
    var store = jget(key, {});
    var uMap = store[userId] || {};
    var fk = filename.toLowerCase();
    var arr = Array.isArray(uMap[fk]) ? uMap[fk] : [];
    var sig = (version || "") + ":" + updatedAt;
    var exists = arr.some(function (r) { return r && ((r.version || "") + ":" + r.updatedAt) === sig; });
    if (!exists) {
      arr.unshift({ version: version || "", updatedAt: updatedAt, size: size || 0 });
      arr.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      if (arr.length > 10) arr = arr.slice(0, 10);
      uMap[fk] = arr;
      store[userId] = uMap;
      jset(key, store);
    }
    return arr.length || 1;
  }

  function matchThreadsForArtifact(filename, allThreads) {
    var out = [], seenIds = {}, seenTitles = {};
    if (!filename || !Array.isArray(allThreads) || !allThreads.length) return out;
    var needle = filename.toLowerCase();
    var encNeedle = encodeURIComponent(filename).toLowerCase();
    for (var i = 0; i < allThreads.length; i++) {
      var t = allThreads[i];
      if (!t || !t.id || seenIds[t.id]) continue;
      var ms = msgs(t);
      var hit = false;
      for (var j = 0; j < ms.length; j++) {
        var c = String(ms[j] && ms[j].content || "").toLowerCase();
        if (c && (c.indexOf(needle) > -1 || c.indexOf(encNeedle) > -1)) { hit = true; break; }
      }
      if (hit) {
        var ttl = (t.title || "Untitled thread").trim();
        var tKey = ttl.toLowerCase();
        seenIds[t.id] = 1;
        if (seenTitles[tKey]) continue;
        seenTitles[tKey] = 1;
        out.push({ id: t.id, title: ttl });
      }
      if (out.length >= 2) break;
    }
    return out;
  }

  function groupArtifacts(rawItems, userId, allThreads) {
    var prefix = userId ? ("artifacts/" + userId + "/") : "";
    var byName = {};
    (Array.isArray(rawItems) ? rawItems : []).forEach(function (obj) {
      if (!obj || !obj.name) return;
      var rawName = String(obj.name).replace(/^\/+/, "");
      if (!rawName || rawName === ".emptyFolderPlaceholder" || rawName.slice(-1) === "/") return;
      if (obj.is_delete_marker) return;
      if (obj.id == null && obj.metadata == null && !obj.updated_at && !obj.created_at) return;
      var relPath = prefix && rawName.indexOf(prefix) === 0 ? rawName.slice(prefix.length) : rawName;
      var parts = relPath.split("/");
      var filename = parts[parts.length - 1] || relPath;
      if (!filename || filename === ".emptyFolderPlaceholder") return;
      var meta = obj.metadata || {};
      var modIso = obj.updated_at || meta.lastModified || obj.created_at || "";
      var creIso = obj.created_at || modIso;
      var updatedAt = modIso ? (Date.parse(modIso) || 0) : 0;
      var createdAt = creIso ? (Date.parse(creIso) || updatedAt) : updatedAt;
      var size = Number(meta.size != null ? meta.size : (meta.contentLength != null ? meta.contentLength : 0)) || 0;
      var mimetype = meta.mimetype || "";
      var kind = kindOfFile(filename, mimetype);
      var storagePath = userId ? ("artifacts/" + userId + "/" + relPath) : relPath;
      var verEntry = {
        filename: filename,
        relPath: relPath,
        storagePath: storagePath,
        version: obj.version || meta.eTag || obj.id || "",
        updatedAt: updatedAt,
        updatedIso: modIso,
        createdAt: createdAt,
        createdIso: creIso,
        size: size,
        mimetype: mimetype,
        kind: kind,
        kindLabel: KIND_LABEL[kind] || "File"
      };
      var key = filename.toLowerCase();
      if (!byName[key]) {
        byName[key] = { key: key, versions: [verEntry] };
      } else {
        byName[key].versions.push(verEntry);
      }
    });

    var threadsList = Array.isArray(allThreads) ? allThreads : getThreads();
    var groups = Object.keys(byName).map(function (k) {
      var vers = byName[k].versions.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      var latest = vers[0];
      var earliestCreated = vers.reduce(function (acc, v) { return v.createdAt && (!acc || v.createdAt < acc) ? v.createdAt : acc; }, latest.createdAt);
      var seenRevs = recordAndMergeRevs(userId, latest.filename, latest.version, latest.updatedAt, latest.size);
      var versionCount = Math.max(vers.length, seenRevs);
      var wasUpdated = versionCount > 1 || (latest.updatedAt && earliestCreated && (latest.updatedAt - earliestCreated > 2000));
      return {
        filename: latest.filename,
        relPath: latest.relPath,
        storagePath: latest.storagePath,
        version: latest.version,
        updatedAt: latest.updatedAt,
        updatedIso: latest.updatedIso,
        createdAt: earliestCreated,
        size: latest.size,
        mimetype: latest.mimetype,
        kind: latest.kind,
        kindLabel: latest.kindLabel,
        versions: vers,
        versionCount: versionCount,
        wasUpdated: Boolean(wasUpdated),
        threads: matchThreadsForArtifact(latest.filename, threadsList)
      };
    });

    groups.sort(function (a, b) {
      return ((b.updatedAt || 0) - (a.updatedAt || 0)) || a.filename.localeCompare(b.filename);
    });
    return groups;
  }

  function fetchListPage(auth, prefix, offset, limit) {
    var headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + auth.token
    };
    if (auth.anon) headers.apikey = auth.anon;
    return fetch(auth.url + "/storage/v1/object/list/" + BUCKET, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        prefix: prefix,
        limit: limit,
        offset: offset,
        sortBy: { column: "updated_at", order: "desc" }
      })
    }).then(function (r) {
      if (!r.ok) throw new Error("Storage list failed (HTTP " + r.status + ")");
      return r.json();
    });
  }

  function listArtifacts() {
    return getStorageAuth().then(function (auth) {
      if (!auth.ok) {
        var err = new Error("Sign in to view your generated artifacts.");
        err.code = "UNAUTHENTICATED";
        throw err;
      }
      var prefix = "artifacts/" + auth.userId + "/";
      var limit = 200;
      return fetchListPage(auth, prefix, 0, limit).then(function (first) {
        var arr = Array.isArray(first) ? first : [];
        if (arr.length < limit) return groupArtifacts(arr, auth.userId, getThreads());
        return fetchListPage(auth, prefix, limit, limit).then(function (second) {
          return groupArtifacts(arr.concat(Array.isArray(second) ? second : []), auth.userId, getThreads());
        }, function () {
          return groupArtifacts(arr, auth.userId, getThreads());
        });
      });
    });
  }

  function loadArtifacts(force) {
    if (state.artLoading) return Promise.resolve(state.artItems);
    if (state.artLoaded && !force) return Promise.resolve(state.artItems);
    state.artLoading = true;
    state.artError = "";
    if (state.tab === "artifacts") renderBody();
    return listArtifacts().then(function (items) {
      state.artItems = items;
      state.artLoaded = true;
      state.artLoading = false;
      state.artError = "";
      updateTabCounts();
      if (state.tab === "artifacts") renderBody();
      return items;
    }, function (err) {
      state.artLoading = false;
      state.artLoaded = true;
      state.artError = (err && err.message) ? err.message : "Could not load artifacts.";
      if (err && err.code === "UNAUTHENTICATED") state.artItems = [];
      updateTabCounts();
      if (state.tab === "artifacts") renderBody();
      return state.artItems;
    });
  }

  function fetchArtifactBytes(auth, storagePath) {
    var encPath = encodeStoragePath(storagePath);
    var headers = { "Authorization": "Bearer " + auth.token };
    if (auth.anon) headers.apikey = auth.anon;
    return fetch(auth.url + "/storage/v1/object/" + BUCKET + "/" + encPath, { headers: headers }).then(function (r) {
      if (r.ok) return r.arrayBuffer();
      var signHeaders = { "Content-Type": "application/json", "Authorization": "Bearer " + auth.token };
      if (auth.anon) signHeaders.apikey = auth.anon;
      return fetch(auth.url + "/storage/v1/object/sign/" + BUCKET + "/" + encPath, {
        method: "POST",
        headers: signHeaders,
        body: JSON.stringify({ expiresIn: 300 })
      }).then(function (sr) {
        if (!sr.ok) throw new Error("Could not download artifact (HTTP " + r.status + ")");
        return sr.json();
      }).then(function (sj) {
        var rel = sj && (sj.signedURL || sj.signedUrl);
        if (!rel) throw new Error("Missing signed URL for artifact");
        var fullUrl = /^https?:/i.test(rel) ? rel : (auth.url + "/storage/v1" + (rel.charAt(0) === "/" ? "" : "/") + rel);
        return fetch(fullUrl).then(function (fr) {
          if (!fr.ok) throw new Error("Signed download failed (HTTP " + fr.status + ")");
          return fr.arrayBuffer();
        });
      });
    });
  }

  function closeOverlaysForArtifact() {
    close();
    try {
      if (window.SettingsUI && typeof window.SettingsUI.close === "function") window.SettingsUI.close();
    } catch (e) {}
  }

  function openArtifact(art) {
    if (!art || !art.storagePath) return Promise.reject(new Error("Invalid artifact"));
    state.artOpening = art.filename;
    if (state.tab === "artifacts") renderBody();
    return getStorageAuth().then(function (auth) {
      if (!auth.ok) throw new Error("Sign in to open artifacts.");
      return fetchArtifactBytes(auth, art.storagePath);
    }).then(function (buf) {
      state.artOpening = "";
      var bytes = new Uint8Array(buf);
      var kind = art.kind || kindOfFile(art.filename, art.mimetype);
      var item = {
        name: art.filename,
        title: titleFromFilename(art.filename),
        kind: kind,
        size: bytes.byteLength || art.size || 0,
        bytes: bytes
      };
      if (isTextKind(kind)) {
        item.text = new TextDecoder("utf-8").decode(bytes);
      }
      closeOverlaysForArtifact();
      if (window.ArtifactPanel && typeof window.ArtifactPanel.open === "function") {
        window.ArtifactPanel.open(item);
      }
      return item;
    }).catch(function (err) {
      state.artOpening = "";
      state.artError = (err && err.message) ? err.message : "Could not open " + art.filename;
      if (state.tab === "artifacts") renderBody();
      throw err;
    });
  }

  function regenerateArtifact(art) {
    var filename = typeof art === "string" ? art : (art && art.filename ? art.filename : "");
    if (!filename) return "";
    var promptText = "Regenerate " + filename + " with the latest data";
    closeOverlaysForArtifact();
    var submitFn = g("submitQuery");
    if (typeof submitFn === "function") {
      submitFn(promptText);
      return promptText;
    }
    var searchFn = g("performSearch");
    if (typeof searchFn === "function") {
      searchFn(promptText);
      return promptText;
    }
    var inp = document.getElementById("followupInput") || document.getElementById("landingInput") || document.getElementById("searchInput");
    if (inp) {
      inp.value = promptText;
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      var btn = document.getElementById("followupBtn") || document.getElementById("landingBtn") || document.getElementById("searchSubmit");
      if (btn) btn.click();
    }
    return promptText;
  }

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

  function updateTabCounts() {
    if (!state.root) return;
    var tc = state.root.querySelector("#libTabThreadsCount");
    var ac = state.root.querySelector("#libTabArtifactsCount");
    if (tc) {
      var n = getThreads().length;
      tc.textContent = n ? String(n) : "";
    }
    if (ac) {
      var m = state.artItems.length;
      ac.textContent = state.artLoaded && m ? String(m) : "";
    }
    var q = state.root.querySelector("#libQ");
    if (q) {
      q.placeholder = state.tab === "artifacts" ? "Search artifacts by filename" : "Search threads and messages";
    }
    var tabs = state.root.querySelectorAll(".lib-tab[data-tab]");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].setAttribute("aria-selected", tabs[i].dataset.tab === state.tab ? "true" : "false");
    }
  }

  function switchTab(tab) {
    if (tab !== "threads" && tab !== "artifacts") return;
    if (state.tab === tab) return;
    state.tab = tab;
    state.selecting = false;
    state.sel = {};
    updateTabCounts();
    renderBody();
    if (tab === "artifacts" && !state.artLoaded) loadArtifacts(true);
  }

  function shell() {
    var r = ensureRoot();
    r.innerHTML = '<div class="lib-header"><div class="lib-top"><h1 class="lib-title">Library</h1>' +
      '<div class="lib-tabs" role="tablist" aria-label="Library sections">' +
      '<button type="button" class="lib-tab" role="tab" data-tab="threads" aria-selected="' + (state.tab === "threads" ? "true" : "false") + '">Threads <span class="lib-tab-count" id="libTabThreadsCount"></span></button>' +
      '<button type="button" class="lib-tab" role="tab" data-tab="artifacts" aria-selected="' + (state.tab === "artifacts" ? "true" : "false") + '">Artifacts <span class="lib-tab-count" id="libTabArtifactsCount"></span></button>' +
      '</div>' +
      '<label class="lib-search">' + ICON.search + '<input id="libQ" type="search" placeholder="' + (state.tab === "artifacts" ? "Search artifacts by filename" : "Search threads and messages") + '" autocomplete="off"></label>' +
      '<span class="lib-spacer"></span><button class="lib-icon-btn" id="libClose" aria-label="Close library" title="Close (Esc)">' + ICON.close + '</button></div>' +
      '<div class="lib-chips" id="libChips"></div></div><div class="lib-body" id="libBody"></div>';
    var q = r.querySelector("#libQ"); q.value = state.q;
    q.addEventListener("input", function () {
      state.q = q.value;
      state.ext = null;
      renderBody();
      if (state.tab === "threads") runExternal(state.q);
    });
    r.querySelector(".lib-tabs").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-tab]");
      if (b) switchTab(b.dataset.tab);
    });
    r.querySelector("#libClose").onclick = close;
    updateTabCounts();
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

  function renderArtifactChips() {
    var el = document.getElementById("libChips"); if (!el) return;
    var curTid = g("currentThreadId");
    var kinds = [
      { k: "", lbl: "All files" },
      { k: "md", lbl: "Markdown" },
      { k: "docx", lbl: "Word" },
      { k: "xlsx", lbl: "Spreadsheet" },
      { k: "csv", lbl: "CSV" },
      { k: "pdf", lbl: "PDF" },
      { k: "webapp", lbl: "Web app" }
    ];
    var h = "";
    kinds.forEach(function (it) {
      var cnt = it.k ? state.artItems.filter(function (a) { return a.kind === it.k; }).length : state.artItems.length;
      if (it.k && !cnt && state.artKind !== it.k) return;
      h += '<button type="button" class="lib-chip' + (state.artKind === it.k ? " active" : "") + '" data-ak="' + esc(it.k) + '">' +
        esc(it.lbl) + (state.artLoaded && cnt ? ' <span class="x">' + cnt + '</span>' : '') + '</button>';
    });
    if (curTid) {
      h += '<span class="lib-sep"></span>';
      h += '<button type="button" class="lib-chip' + (state.artThreadOnly ? " active" : "") + '" data-athread="1">Current thread</button>';
    }
    h += '<span class="lib-sep"></span>';
    h += '<button type="button" class="lib-chip" data-arefresh="1">' + (state.artLoading ? "Refreshing\u2026" : "Refresh") + '</button>';
    el.innerHTML = h;
    el.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.arefresh) { loadArtifacts(true); return; }
      if (b.dataset.athread) { state.artThreadOnly = !state.artThreadOnly; renderBody(); return; }
      if (b.dataset.ak !== undefined) {
        state.artKind = (state.artKind === b.dataset.ak && b.dataset.ak !== "") ? "" : b.dataset.ak;
        renderBody();
      }
    };
  }

  function filteredArtifacts() {
    var q = state.q.trim().toLowerCase();
    var curTid = g("currentThreadId");
    return state.artItems.filter(function (a) {
      if (state.artKind && a.kind !== state.artKind) return false;
      if (state.artThreadOnly && curTid) {
        var inCur = (a.threads || []).some(function (t) { return t.id === curTid; });
        if (!inCur) return false;
      }
      if (q) {
        var hay = (a.filename + " " + a.kindLabel + " " + (a.threads || []).map(function (t) { return t.title; }).join(" ")).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  // v212 §26f item 6: artifact version-history drawer (expandable under the card)
  function toggleArtifactHistory(cardEl, art) {
    var existing = cardEl.querySelector(".lib-art-hist");
    if (existing) { existing.remove(); return; }
    var box = document.createElement("div");
    box.className = "lib-art-hist";
    var vers = (art.versions && art.versions.length) ? art.versions.slice(0, 10) : [];
    if (!vers.length) vers = [art];
    var head = document.createElement("div");
    head.className = "lib-art-hist-head";
    head.textContent = vers.length + (vers.length === 1 ? " version on record" : " versions on record") + " \u00b7 click a row to open that version";
    box.appendChild(head);
    vers.forEach(function (v, i) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "lib-art-hist-row" + (i === 0 ? " latest" : "");
      row.setAttribute("data-ver-idx", String(i));
      var when = document.createElement("span");
      when.className = "lib-art-hist-when";
      when.textContent = v.updatedIso ? String(v.updatedIso).slice(0, 16).replace("T", " ") : "unknown date";
      var meta = document.createElement("span");
      meta.className = "lib-art-hist-meta";
      meta.textContent = (v.size ? fmtBytes(v.size) : "") + (v.version ? " \u00b7 " + String(v.version).slice(0, 12) : "");
      var tag = document.createElement("span");
      tag.className = "lib-art-hist-tag";
      tag.textContent = i === 0 ? "latest" : ("v" + (vers.length - i));
      row.appendChild(when);
      row.appendChild(meta);
      row.appendChild(tag);
      box.appendChild(row);
    });
    cardEl.appendChild(box);
  }

  function artifactIcon(kind) {
    if (kind === "xlsx" || kind === "csv") return ICON.sheet;
    if (kind === "webapp") return ICON.webapp;
    return ICON.doc;
  }

  function artifactCard(art) {
    var el = document.createElement("div");
    el.className = "lib-art-card";
    el.tabIndex = 0;
    el.dataset.filename = art.filename;
    if (state.artOpening === art.filename) el.setAttribute("aria-busy", "true");
    var sizeTxt = fmtBytes(art.size);
    var modTxt = fmtDateTime(art.updatedAt);
    var ageTxt = relAge(art.updatedAt);
    var revBadge = "";
    if (art.versionCount > 1) revBadge = '<span class="lib-art-updated">' + art.versionCount + ' versions</span>';
    else if (art.wasUpdated) revBadge = '<span class="lib-art-updated">Updated</span>';
    var threadsHtml = "";
    if (art.threads && art.threads.length) {
      threadsHtml = '<div class="lib-art-threads">' + art.threads.map(function (t) {
        return '<button type="button" class="lib-art-thread" data-tid="' + esc(t.id) + '" title="Open thread: ' + esc(t.title) + '">' + esc(t.title) + '</button>';
      }).join("") + '</div>';
    }
    el.innerHTML =
      '<div class="lib-art-head">' +
        '<div class="lib-art-ico">' + artifactIcon(art.kind) + '</div>' +
        '<div class="lib-art-head-txt">' +
          '<div class="lib-art-name" title="' + esc(art.filename) + '">' + esc(art.filename) + '</div>' +
          '<div class="lib-art-sub"><span class="lib-art-kind">' + esc(art.kindLabel) + '</span>' +
            (sizeTxt ? '<span>\u00b7 ' + esc(sizeTxt) + '</span>' : '') + revBadge +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="lib-art-modified" data-ts="' + esc(art.updatedAt || 0) + '" title="' + esc(art.updatedIso || modTxt) + '">' +
        '<span>Last modified ' + esc(modTxt) + '</span>' +
        (ageTxt ? '<span>\u00b7 ' + esc(ageTxt) + '</span>' : '') +
      '</div>' +
      threadsHtml +
      '<div class="lib-art-actions">' +
        '<button type="button" class="lib-art-btn open-btn" data-act="open">' + ICON.open + '<span>' + (state.artOpening === art.filename ? "Opening\u2026" : "Open") + '</span></button>' +
        '<button type="button" class="lib-art-btn regen-btn" data-act="regen" title="Send regenerate prompt to current thread">' + ICON.regen + '<span>Regenerate</span></button>' +
        '<button type="button" class="lib-art-btn hist-btn" data-act="hist" title="Version history">' + ICON.history + '<span>History</span></button>' +
      '</div>';

    el.addEventListener("click", function (e) {
      var regenBtn = e.target.closest("[data-act=regen]");
      if (regenBtn) {
        e.stopPropagation();
        regenerateArtifact(art);
        return;
      }
      var histBtn = e.target.closest("[data-act=hist]");
      if (histBtn) {
        e.stopPropagation();
        toggleArtifactHistory(el, art);
        return;
      }
      var verRow = e.target.closest("[data-ver-idx]");
      if (verRow) {
        e.stopPropagation();
        var vi = Number(verRow.getAttribute("data-ver-idx"));
        var vers = (art.versions && art.versions.length) ? art.versions : [art];
        var target = Number.isFinite(vi) && vers[vi] ? vers[vi] : art;
        closeOverlaysForArtifact();
        openArtifact(target).catch(function () {});
        return;
      }
      var thBtn = e.target.closest("[data-tid]");
      if (thBtn) {
        e.stopPropagation();
        var tid = thBtn.dataset.tid;
        close();
        call("loadThread", tid);
        return;
      }
      var openBtn = e.target.closest("[data-act=open]");
      if (openBtn) e.stopPropagation();
      openArtifact(art).catch(function () {});
    });
    el.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target === el) {
        e.preventDefault();
        openArtifact(art).catch(function () {});
      }
    });
    return el;
  }

  function renderArtifactsBody(body) {
    renderArtifactChips();
    var bb = document.getElementById("libBulk"); if (bb) bb.remove();
    state.root.classList.remove("selecting");

    if (state.artLoading && !state.artItems.length) {
      body.innerHTML =
        '<div class="lib-art-bar"><span>Loading your artifacts\u2026</span></div>' +
        '<div class="lib-art-grid"><div class="lib-art-skel"></div><div class="lib-art-skel"></div><div class="lib-art-skel"></div></div>';
      return;
    }

    var list = filteredArtifacts();
    body.innerHTML = "";

    if (state.artError) {
      var errBox = document.createElement("div");
      errBox.className = "lib-art-err";
      errBox.innerHTML = '<span>' + esc(state.artError) + '</span><button type="button" class="lib-btn">Retry</button>';
      errBox.querySelector("button").onclick = function () { loadArtifacts(true); };
      body.appendChild(errBox);
    }

    if (!list.length) {
      var empty = document.createElement("div");
      empty.className = "lib-empty";
      var hasAny = state.artItems.length > 0;
      empty.innerHTML =
        '<h2>' + (hasAny ? "No matching artifacts" : "No generated artifacts yet") + '</h2>' +
        '<p>' + (hasAny
          ? "Try a different filename search or clear a format filter."
          : "Documents, spreadsheets, PDFs, and web apps generated in chat are saved to your library automatically and updated in place when regenerated.") + '</p>' +
        (hasAny
          ? '<button type="button" class="lib-btn" id="libArtClear">Clear filters</button>'
          : '<button type="button" class="lib-btn primary" id="libArtAsk">Ask in chat</button>');
      body.appendChild(empty);
      var clr = empty.querySelector("#libArtClear");
      if (clr) clr.onclick = function () { state.q = ""; state.artKind = ""; state.artThreadOnly = false; var q = document.getElementById("libQ"); if (q) q.value = ""; renderBody(); };
      var ask = empty.querySelector("#libArtAsk");
      if (ask) ask.onclick = function () { close(); var inp = document.getElementById("followupInput") || document.getElementById("landingInput"); if (inp) inp.focus(); };
      return;
    }

    var bar = document.createElement("div");
    bar.className = "lib-art-bar";
    bar.innerHTML =
      '<span>' + list.length + ' artifact' + (list.length === 1 ? "" : "s") + ' \u00b7 grouped by filename</span>' +
      '<span>Sorted by last modified</span>';
    body.appendChild(bar);

    var grid = document.createElement("div");
    grid.className = "lib-art-grid";
    list.forEach(function (art) { grid.appendChild(artifactCard(art)); });
    body.appendChild(grid);
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
    updateTabCounts();
    if (state.tab === "artifacts") {
      renderArtifactsBody(body);
      return;
    }
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

  function open(arg) {
    if (arg === "artifacts" || (arg && typeof arg === "object" && arg.tab === "artifacts")) state.tab = "artifacts";
    else if (arg === "threads" || (arg && typeof arg === "object" && arg.tab === "threads") || arg === undefined) state.tab = "threads";
    ensureRoot(); shell(); state.root.classList.add("open");
    if (state.tab === "artifacts") {
      renderBody();
      loadArtifacts(true);
    } else {
      renderBody();
      if (!state.artLoaded) loadArtifacts(false);
    }
    document.addEventListener("keydown", onKey);
    var q = document.getElementById("libQ"); if (q) q.focus();
  }
  function close() {
    closeMenu(); state.renaming = null; state.selecting = false; state.sel = {};
    var bb = document.getElementById("libBulk"); if (bb) bb.remove();
    if (state.root) state.root.classList.remove("open");
    document.removeEventListener("keydown", onKey);
  }
  window.LibraryUI = {
    open: open,
    close: close,
    listArtifacts: listArtifacts,
    groupArtifacts: groupArtifacts,
    openArtifact: openArtifact,
    regenerateArtifact: regenerateArtifact
  };
})();
