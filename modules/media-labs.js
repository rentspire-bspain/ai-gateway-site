/* media-labs.js — Labs mode (B3): build a small app or report from a prompt using existing artifacts.
 * window.MediaLabs = { open(tab), close(), build(opts), assets(), parseHtml(text), tabs }
 * Tabs: Tasks | Sources | Assets | Apps | Images. Builds call gateway-chat (same SSE contract as the main composer),
 * save to localStorage "ai_labs_apps", and open in the sandboxed artifact viewer (ArtifactsUI).
 */
(function () {
  "use strict";
  var TABS = ["Tasks", "Sources", "Assets", "Apps", "Images"];
  var KEY = "ai_labs_apps", MAX_APPS = 20, MAX_CTX = 3, CTX_CHARS = 5000;
  var overlay = null, tab = "Assets", picked = {}, kind = "app", busy = false;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function gateway() { return (typeof GATEWAY !== "undefined" && GATEWAY) || "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1"; }
  function client() { return (typeof sb !== "undefined") ? sb : window.sb; }
  function apps() { var a = lsGet(KEY, []); return Array.isArray(a) ? a : []; }
  function saveApps(a) { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, MAX_APPS))); return true; } catch (e) { return false; } }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

  /* ---- data sources: everything already in the app ---- */
  function threadList() { var t = lsGet("ai_threads", []); return Array.isArray(t) ? t : []; }
  function assets() {
    var out = [], seen = {};
    function add(a, from) { if (!a || seen[a.id]) return; seen[a.id] = 1; a.from = from; out.push(a); }
    apps().forEach(function (a) { add({ id: "lab-" + a.id, kind: a.kind === "report" ? "html" : "webapp", lang: "html", title: a.title, content: a.html }, "Labs"); });
    threadList().forEach(function (t) {
      (t.messages || []).forEach(function (m) {
        if (m.role !== "assistant" || !window.Artifacts || !Artifacts.extractFromAnswer) return;
        try { Artifacts.extractFromAnswer(String(m.content || "")).forEach(function (a) { add(a, t.title || "Thread"); }); } catch (e) {}
      });
    });
    return out;
  }
  function images() {
    var out = [];
    threadList().forEach(function (t) { (t.messages || []).forEach(function (m) {
      (Array.isArray(m.images) ? m.images : []).forEach(function (im) { if (im && im.image_url) out.push({ url: im.image_url, title: im.title || "", from: t.title || "Thread" }); });
    }); });
    return out;
  }

  /* ---- build ---- */
  function parseHtml(text) {
    text = String(text || "");
    var m = /```(?:html|htm)?[ \t]*\n([\s\S]*?)\n```/i.exec(text);
    var body = m ? m[1] : text;
    var d = /<!doctype html[\s\S]*<\/html>/i.exec(body) || /<html[\s\S]*<\/html>/i.exec(body);
    if (d) return d[0];
    return m && /<[a-z][\s\S]*>/i.test(body) ? body : "";
  }
  function title(html, prompt) {
    var t = /<title>([^<]{1,80})<\/title>/i.exec(html);
    return (t && t[1].trim()) || prompt.slice(0, 50);
  }
  function composePrompt(prompt, k, ctx) {
    var s = k === "report"
      ? "Create a polished, self-contained HTML REPORT document (headings, tables, simple inline SVG/CSS charts where useful) for the request below."
      : "Create a small, working, self-contained single-file HTML WEB APP (inline CSS and JavaScript only) for the request below.";
    s += " Rules: output exactly ONE complete HTML document (<!doctype html> … </html>) inside a single ```html fenced block and nothing else of substance; no external scripts, fonts, images or network calls; responsive; dark-on-light readable; no citation markers.";
    s += "\n\nRequest: " + prompt;
    if (ctx.length) {
      s += "\n\nExisting artifacts to build on or take data from:";
      ctx.forEach(function (a, i) { s += "\n\n--- Artifact " + (i + 1) + ": " + a.title + " (" + (a.lang || a.kind) + ") ---\n" + String(a.content).slice(0, CTX_CHARS); });
    }
    return s;
  }
  function readStream(res) {
    var ct = res.headers.get("content-type") || "";
    if (!(ct.indexOf("text/event-stream") >= 0 && res.body)) {
      return res.json().then(function (j) { return (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || j.answer || j.content || ""; });
    }
    var rd = res.body.getReader(), dec = new TextDecoder(), buf = "", full = "", rev = "";
    function pump() {
      return rd.read().then(function (r) {
        if (r.done) return rev || full;
        buf += dec.decode(r.value, { stream: true });
        var lines = buf.split("\n"); buf = lines.pop() || "";
        lines.forEach(function (ln) {
          if (ln.indexOf("data:") !== 0) return;
          var p = ln.slice(5).trim(); if (p === "[DONE]") return;
          try {
            var e = JSON.parse(p);
            if (typeof e.revision === "string" && e.revision.trim()) rev = e.revision;
            var dl = e && e.choices && e.choices[0] && e.choices[0].delta && e.choices[0].delta.content;
            if (dl) full += dl;
          } catch (x) {}
        });
        return pump();
      });
    }
    return pump();
  }
  function build(o) {
    o = o || {};
    var prompt = String(o.prompt || "").trim(), k = o.kind === "report" ? "report" : "app";
    if (!prompt) return Promise.reject(new Error("Describe what to build."));
    var ctx = (o.context || []).slice(0, MAX_CTX);
    return client().auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in to use Labs.");
      var srcOff = { web: false, academic: false, finance: false, files: false };
      var sf = k === "report" && window.SourcesPicker && SourcesPicker.state ? SourcesPicker.state() : srcOff;
      return fetch(gateway() + "/gateway-chat", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
        body: JSON.stringify({ messages: [{ role: "user", content: composePrompt(prompt, k, ctx) }], purpose: "coding", max_tokens: 8192, stream: true, sources_filter: sf }) });
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (j) { throw new Error((j.error && (j.error.message || j.error)) || ("Gateway error " + res.status)); });
      return readStream(res);
    }).then(function (text) {
      var html = parseHtml(text);
      if (!html) throw new Error("The model did not return a complete HTML document. Try a simpler request.");
      var rec = { id: hash(html + Date.now()), kind: k, title: title(html, prompt), prompt: prompt, html: html, created: Date.now(), from: ctx.map(function (a) { return a.title; }) };
      var list = apps(); list.unshift(rec);
      if (!saveApps(list)) { list = list.slice(0, 5); saveApps(list); }
      return rec;
    });
  }

  /* ---- UI ---- */
  function onEsc(e) { if (e.key === "Escape" && overlay) { e.stopPropagation(); close(); } }
  function close() { if (overlay) { overlay.remove(); overlay = null; } document.removeEventListener("keydown", onEsc, true); }
  function openArtifact(a) { if (window.ArtifactsUI && ArtifactsUI.open) ArtifactsUI.open({ kind: a.kind, lang: a.lang || "html", title: a.title, content: a.content }); }

  function paneTasks(p) {
    var note = el("div", "ml-note", "Loading monitors…"); p.appendChild(note);
    var openBtn = el("button", "ml-btn", "Open Tasks manager"); openBtn.type = "button";
    openBtn.onclick = function () { if (window.TasksUI) { close(); TasksUI.open(); } };
    client().auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Sign in to see tasks.");
      return fetch(gateway() + "/monitors", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ action: "list" }) });
    }).then(function (r) { return r.json(); }).then(function (j) {
      var list = j.monitors || j.items || j.data || (Array.isArray(j) ? j : []);
      note.textContent = list.length ? list.length + (list.length === 1 ? " monitor" : " monitors") : "No monitors yet.";
      list.forEach(function (m) {
        var r = el("div", "ml-row"); r.appendChild(el("div", "ml-t", m.name || m.query));
        r.appendChild(el("div", "ml-s", (m.enabled === false ? "Paused · " : "") + "every " + m.interval_min + " min" + (m.last_digest ? " · " + String(m.last_digest).slice(0, 140) : "")));
        if (m.last_digest) {
          var c = el("label", "ml-chk"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!picked["task:" + m.id];
          cb.onchange = function () { picked["task:" + m.id] = cb.checked ? { id: "task-" + m.id, title: "Monitor: " + (m.name || m.query), lang: "text", kind: "text", content: m.last_digest } : null; };
          c.appendChild(cb); c.appendChild(document.createTextNode(" Use digest as context")); r.appendChild(c);
        }
        p.appendChild(r);
      });
    }).catch(function (e) { note.textContent = String(e && e.message || e); });
    if (window.TasksUI) p.appendChild(openBtn);
  }
  function paneSources(p) {
    var st = window.SourcesPicker && SourcesPicker.state ? SourcesPicker.state() : null;
    var h = el("div", "ml-note", st ? "Search sources currently enabled for reports:" : "Sources picker unavailable."); p.appendChild(h);
    if (st) Object.keys(st).forEach(function (k) { var r = el("div", "ml-row"); r.appendChild(el("div", "ml-t", k.charAt(0).toUpperCase() + k.slice(1))); r.appendChild(el("div", "ml-s", st[k] ? "On" : "Off")); p.appendChild(r); });
    var c = lsGet("ai_connectors", null), names = [];
    if (Array.isArray(c)) c.forEach(function (x) { names.push(typeof x === "string" ? x : (x && (x.name || x.id))); });
    else if (c && typeof c === "object") Object.keys(c).forEach(function (k) { if (c[k]) names.push(k); });
    p.appendChild(el("div", "ml-note", names.length ? "Connectors: " + names.filter(Boolean).join(", ") : "No connectors configured."));
    p.appendChild(el("div", "ml-note", "Apps build from the assets you tick; reports also use the sources above."));
  }
  function paneAssets(p) {
    var list = assets();
    p.appendChild(el("div", "ml-note", list.length ? "Tick up to " + MAX_CTX + " artifacts to build on." : "No artifacts yet. Ask for code, charts or HTML in a thread and they appear here."));
    list.slice(0, 60).forEach(function (a) {
      var r = el("div", "ml-row");
      var c = el("label", "ml-chk"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!picked[a.id];
      cb.onchange = function () { if (cb.checked) { if (Object.keys(picked).filter(function (k) { return picked[k]; }).length >= MAX_CTX) { cb.checked = false; return; } picked[a.id] = a; } else picked[a.id] = null; refreshCtx(); };
      c.appendChild(cb); r.appendChild(c);
      var b = el("div", "ml-grow"); b.appendChild(el("div", "ml-t", a.title)); b.appendChild(el("div", "ml-s", a.kind + " · " + a.from)); r.appendChild(b);
      var o = el("button", "ml-btn", "Open"); o.type = "button"; o.onclick = function () { openArtifact(a); }; r.appendChild(o);
      p.appendChild(r);
    });
  }
  function paneApps(p) {
    var list = apps();
    p.appendChild(el("div", "ml-note", list.length ? list.length + " saved" : "Nothing built yet. Describe an app or report above and press Build."));
    list.forEach(function (a) {
      var r = el("div", "ml-row"), b = el("div", "ml-grow");
      b.appendChild(el("div", "ml-t", a.title)); b.appendChild(el("div", "ml-s", (a.kind === "report" ? "Report" : "App") + " · " + new Date(a.created).toLocaleString()));
      r.appendChild(b);
      var o = el("button", "ml-btn", "Open"); o.type = "button"; o.onclick = function () { openArtifact({ kind: "webapp", lang: "html", title: a.title, content: a.html }); };
      var d = el("button", "ml-btn", "Download"); d.type = "button";
      d.onclick = function () { var u = URL.createObjectURL(new Blob([a.html], { type: "text/html" })), l = document.createElement("a"); l.href = u; l.download = (a.title || "labs").replace(/[^\w-]+/g, "_").slice(0, 40) + ".html"; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 5000); };
      var x = el("button", "ml-btn", "Delete"); x.type = "button"; x.onclick = function () { saveApps(apps().filter(function (z) { return z.id !== a.id; })); render(); };
      r.appendChild(o); r.appendChild(d); r.appendChild(x); p.appendChild(r);
    });
  }
  function paneImages(p) {
    var gen = el("button", "ml-btn", "Generate new image"); gen.type = "button";
    gen.onclick = function () { if (window.MediaGen) { close(); MediaGen.open(); } };
    p.appendChild(gen);
    var list = images();
    p.appendChild(el("div", "ml-note", list.length ? list.length + " images in your threads" : "No images yet."));
    var g = el("div", "ml-grid");
    list.slice(0, 48).forEach(function (im) { var a = el("a"); a.href = im.url; a.target = "_blank"; a.rel = "noopener noreferrer"; var i = el("img"); i.src = im.url; i.alt = im.title; i.loading = "lazy"; a.appendChild(i); g.appendChild(a); });
    p.appendChild(g);
  }

  var ctxLine = null;
  function ctxPicked() { return Object.keys(picked).map(function (k) { return picked[k]; }).filter(Boolean); }
  function refreshCtx() { if (ctxLine) { var n = ctxPicked().length; ctxLine.textContent = n ? n + " artifact" + (n > 1 ? "s" : "") + " selected as context" : "No artifacts selected — building from scratch"; } }

  var body = null, tabBar = null;
  function render() {
    if (!overlay) return;
    [].forEach.call(tabBar.children, function (b) { b.classList.toggle("on", b.textContent === tab); });
    body.innerHTML = "";
    ({ Tasks: paneTasks, Sources: paneSources, Assets: paneAssets, Apps: paneApps, Images: paneImages })[tab](body);
    refreshCtx();
  }
  function open(t) {
    close();
    tab = TABS.indexOf(t) >= 0 ? t : "Assets";
    overlay = el("div", "ml-overlay");
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    var dlg = el("div", "ml-dialog"); dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "Labs");
    var head = el("div", "ml-head"); head.appendChild(el("h3", "", "Labs"));
    var x = el("button", "ml-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.onclick = close; head.appendChild(x);
    var ta = el("textarea", "ml-prompt"); ta.rows = 3; ta.placeholder = "Describe the app or report to build, e.g. “A budget calculator using the data in my chart”";
    var row = el("div", "ml-brow");
    var sel = el("select", "ml-sel"); [["app", "App"], ["report", "Report"]].forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; sel.appendChild(op); }); sel.value = kind; sel.onchange = function () { kind = sel.value; };
    var go = el("button", "ml-go", "Build"); go.type = "button";
    var st = el("div", "ml-status"); st.setAttribute("aria-live", "polite");
    row.appendChild(sel); row.appendChild(go); row.appendChild(st);
    ctxLine = el("div", "ml-ctx");
    tabBar = el("div", "ml-tabs"); TABS.forEach(function (n) { var b = el("button", "ml-tab", n); b.type = "button"; b.onclick = function () { tab = n; render(); }; tabBar.appendChild(b); });
    body = el("div", "ml-body");
    [head, ta, row, ctxLine, tabBar, body].forEach(function (n) { dlg.appendChild(n); });
    overlay.appendChild(dlg); document.body.appendChild(overlay);
    document.addEventListener("keydown", onEsc, true);
    go.onclick = function () {
      if (busy) return;
      busy = true; go.disabled = true; go.textContent = "Building…"; st.className = "ml-status"; st.textContent = "Building — usually 20–60 seconds.";
      build({ prompt: ta.value, kind: kind, context: ctxPicked() }).then(function (rec) {
        st.textContent = "Built “" + rec.title + "”."; tab = "Apps"; render(); openArtifact({ kind: "webapp", lang: "html", title: rec.title, content: rec.html });
      }).catch(function (e) { st.className = "ml-status err"; st.textContent = String(e && e.message || e); })
        .then(function () { busy = false; go.disabled = false; go.textContent = "Build"; });
    };
    render(); setTimeout(function () { ta.focus(); }, 0);
  }

  function mount() {
    ["landingPills", "followupPills"].forEach(function (id) {
      var host = document.getElementById(id);
      if (!host || host.querySelector(".ml-pill")) return;
      var b = el("button", "width-toggle ml-pill", "🧪 Labs"); b.type = "button"; b.title = "Labs: build an app or report";
      b.onclick = function (e) { e.stopPropagation(); open(); };
      host.appendChild(b);
    });
  }
  window.MediaLabs = { open: open, close: close, build: build, assets: assets, images: images, parseHtml: parseHtml, tabs: TABS, mount: mount };
  function start() { mount(); new MutationObserver(mount).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
