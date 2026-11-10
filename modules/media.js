/* media.js — image generation dialog (/image) + Videos answer tab
 * window.MediaGen = { generate(prompt) -> Promise<string[]>, open(), close(), videoIds(urls), attach() }
 * Image generation calls the media-gen edge function. Video GENERATION is not offered;
 * the Videos tab only lists video links already present in an answer's sources.
 */
(function () {
  "use strict";
  var FN = ((typeof GATEWAY !== "undefined" && GATEWAY) || "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1") + "/media-gen";
  var overlay = null, results = [], busy = false;

  // Self-load companion assets (so index.html only needs ONE <script src="modules/media.js">).
  (function loadCompanions() {
    var cs = document.currentScript, base = cs && cs.src ? cs.src.replace(/[^/]*$/, "") : "modules/";
    function css(n) { if (document.querySelector('link[data-mg="' + n + '"]')) return; var l = document.createElement("link"); l.rel = "stylesheet"; l.href = base + n; l.setAttribute("data-mg", n); document.head.appendChild(l); }
    css("media.css"); css("media-labs.css");
    if (!window.MediaLabs && !document.querySelector('script[data-mg="labs"]')) { var s = document.createElement("script"); s.src = base + "media-labs.js"; s.defer = true; s.setAttribute("data-mg", "labs"); document.head.appendChild(s); }
  })();

  function client() { return (typeof sb !== "undefined") ? sb : window.sb; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function generate(prompt) {
    var c = client();
    return c.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in to generate images.");
      return fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ action: "generate", prompt: prompt }) });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok || j.error) throw new Error(j.error || ("Request failed (" + res.status + ")"));
        return Array.isArray(j.images) ? j.images : [];
      });
    });
  }

  function token() {
    return client().auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw new Error("Please sign in first.");
      return tok;
    });
  }
  function api(body) {
    return token().then(function (tok) {
      return fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(body) });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok || (j.error && j.available !== false)) throw new Error(j.error || ("Request failed (" + res.status + ")"));
        return j;
      });
    });
  }
  function fetchBlob(body) {
    return token().then(function (tok) {
      return fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(body) });
    }).then(function (res) { if (!res.ok) throw new Error("Download failed (" + res.status + ")"); return res.blob(); });
  }

  function download(url, i) {
    var a = document.createElement("a");
    a.href = url; a.download = "image-" + (i + 1) + ".png"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Shrink generated PNGs (~300KB+) to a JPEG <=768px so thread storage (localStorage) stays small.
  function shrink(url) {
    return new Promise(function (resolve) {
      try {
        var im = new Image();
        im.onload = function () {
          try {
            var sc = Math.min(1, 768 / Math.max(im.width, im.height)), c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(im.width * sc)); c.height = Math.max(1, Math.round(im.height * sc));
            c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
            var out = c.toDataURL("image/jpeg", 0.82);
            resolve(out && out.length < url.length ? out : url);
          } catch (e) { resolve(url); }
        };
        im.onerror = function () { resolve(url); };
        setTimeout(function () { resolve(url); }, 4000);
        im.src = url;
      } catch (e) { resolve(url); }
    });
  }

  function insert(prompt, url) {
    if (typeof threads === "undefined" || typeof saveThreads !== "function") return false;
    var t = threads.find(function (x) { return x.id === currentThreadId; });
    if (!t) t = createThread(prompt.slice(0, 60) || "Generated image");
    t.messages.push({ role: "assistant", content: "Generated image for: " + prompt, sources: [], related: [], images: [{ image_url: url, title: prompt.slice(0, 80) }] });
    t.updatedAt = Date.now();
    saveThreads();
    if (typeof loadThread === "function") loadThread(t.id);
    return true;
  }

  function onEsc(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
    document.removeEventListener("keydown", onEsc, true);
  }

  function open(initial, mode) {
    close();
    mode = mode === "video" ? "video" : "image";
    results = [];
    overlay = el("div", "mg-overlay");
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    var dlg = el("div", "mg-dialog");
    dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "Generate image");
    var head = el("div", "mg-head");
    var seg = el("div", "mg-seg");
    var bImg = el("button", "mg-segbtn", "Image"), bVid = el("button", "mg-segbtn", "Video");
    bImg.type = bVid.type = "button"; seg.appendChild(bImg); seg.appendChild(bVid);
    head.appendChild(seg);
    var x = el("button", "mg-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.onclick = close;
    head.appendChild(x);
    var ta = el("textarea", "mg-prompt"); ta.rows = 3; ta.maxLength = 1000; ta.placeholder = "Describe what you want to create…";
    if (typeof initial === "string") ta.value = initial;
    var row = el("div", "mg-row");
    var go = el("button", "mg-go", "Generate"); go.type = "button";
    var status = el("div", "mg-status"); status.setAttribute("aria-live", "polite");
    row.appendChild(go); row.appendChild(status);
    var grid = el("div", "mg-grid");
    var vnote = el("div", "mg-vnote"); vnote.style.display = "none";
    dlg.appendChild(head); dlg.appendChild(ta); dlg.appendChild(vnote); dlg.appendChild(row); dlg.appendChild(grid);
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onEsc, true);
    setTimeout(function () { ta.focus(); }, 0);

    function render(prompt) {
      grid.innerHTML = "";
      results.forEach(function (url, i) {
        var card = el("div", "mg-card");
        var img = el("img"); img.src = url; img.alt = prompt; card.appendChild(img);
        var acts = el("div", "mg-acts");
        var d = el("button", "mg-btn", "Download"); d.type = "button"; d.onclick = function () { download(url, i); };
        var ins = el("button", "mg-btn", "Insert into thread"); ins.type = "button";
        ins.onclick = function () {
          ins.disabled = true;
          shrink(url).then(function (small) {
            if (insert(prompt, small)) close(); else { ins.disabled = false; status.textContent = "Could not insert into thread."; status.className = "mg-status err"; }
          });
        };
        acts.appendChild(d); acts.appendChild(ins); card.appendChild(acts); grid.appendChild(card);
      });
    }
    var vcfg = null;
    function setMode(m) {
      mode = m;
      bImg.classList.toggle("on", m === "image"); bVid.classList.toggle("on", m === "video");
      dlg.setAttribute("aria-label", m === "video" ? "Generate video" : "Generate image");
      go.textContent = "Generate"; grid.innerHTML = ""; status.textContent = ""; status.className = "mg-status";
      vnote.style.display = m === "video" ? "" : "none";
      if (m === "video") {
        vnote.textContent = "Checking video availability…"; go.disabled = true;
        (vcfg ? Promise.resolve(vcfg) : api({ action: "video_config" })).then(function (c) {
          vcfg = c;
          if (!c.available) {
            vnote.className = "mg-vnote off";
            vnote.textContent = "Video generation is not enabled yet. It needs an OpenRouter API key (OPENROUTER_API_KEY) set on this project's media-gen function; it will turn on automatically once that key is added.";
            go.disabled = true;
          } else {
            vnote.className = "mg-vnote";
            vnote.textContent = c.duration + "s clip, " + c.resolution + ", ≈ $" + c.est_cost_usd.toFixed(2) + " per video. Takes 1–3 minutes.";
            go.disabled = busy;
          }
        }).catch(function (e) { vnote.className = "mg-vnote off"; vnote.textContent = String(e && e.message || e); go.disabled = true; });
      } else { go.disabled = busy; }
    }
    bImg.onclick = function () { if (!busy) setMode("image"); };
    bVid.onclick = function () { if (!busy) setMode("video"); };

    function runVideo(p) {
      busy = true; go.disabled = true; go.textContent = "Generating…";
      status.className = "mg-status"; status.textContent = "Submitting video job…";
      grid.innerHTML = ""; grid.appendChild(el("div", "mg-skel"));
      var t0 = Date.now(), id = null;
      function done() { busy = false; go.textContent = "Generate"; go.disabled = !(vcfg && vcfg.available); }
      function fail(e) { grid.innerHTML = ""; status.className = "mg-status err"; status.textContent = String(e && e.message || e); done(); }
      function poll() {
        if (!overlay) { busy = false; return; }
        if (Date.now() - t0 > 6 * 60 * 1000) return fail(new Error("Video timed out after 6 minutes."));
        api({ action: "video_status", job_id: id }).then(function (s) {
          if (s.status === "completed") {
            status.textContent = "Downloading video…";
            return fetchBlob({ action: "video_content", job_id: id }).then(function (blob) {
              var u = URL.createObjectURL(blob); grid.innerHTML = "";
              var card = el("div", "mg-card"), v = el("video"); v.src = u; v.controls = true; v.playsInline = true; v.style.width = "100%";
              var acts = el("div", "mg-acts"), d = el("button", "mg-btn", "Download"); d.type = "button";
              d.onclick = function () { var a = document.createElement("a"); a.href = u; a.download = "video.mp4"; document.body.appendChild(a); a.click(); a.remove(); };
              acts.appendChild(d); card.appendChild(v); card.appendChild(acts); grid.appendChild(card);
              status.textContent = ""; done();
            });
          }
          if (/^(failed|cancelled|expired)$/.test(s.status)) throw new Error("Video " + s.status + (s.error ? ": " + s.error : ""));
          status.textContent = "Rendering (" + s.status + ", " + Math.round((Date.now() - t0) / 1000) + "s)…";
          setTimeout(poll, 8000);
        }).catch(fail);
      }
      api({ action: "video_submit", prompt: p }).then(function (r) {
        if (r.available === false) throw new Error(r.error);
        id = r.job_id; status.textContent = "Rendering…"; setTimeout(poll, 5000);
      }).catch(fail);
    }

    function run() {
      var p = ta.value.trim();
      if (!p || busy) return;
      if (mode === "video") { if (vcfg && vcfg.available) runVideo(p); return; }
      busy = true; go.disabled = true; go.textContent = "Generating…";
      status.className = "mg-status"; status.textContent = "Creating your image — this can take 10–30 seconds.";
      grid.innerHTML = ""; grid.appendChild(el("div", "mg-skel"));
      generate(p).then(function (imgs) {
        results = imgs;
        if (!imgs.length) { grid.innerHTML = ""; status.className = "mg-status err"; status.textContent = "No image returned."; return; }
        status.textContent = ""; render(p);
      }).catch(function (e) {
        grid.innerHTML = ""; status.className = "mg-status err"; status.textContent = String(e && e.message || e);
      }).then(function () { busy = false; go.disabled = false; go.textContent = "Generate"; });
    }
    go.onclick = run;
    setMode(mode);
    ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } });
  }

  /* ---------- composer entry point ('/image' via standalone pill; SkillsSlash has no registration API) ---------- */
  // v95: icon + text spans so the follow-up composer can collapse these pills to icon-only (one-row toolbar)
  function pillLabel(b, ico, txt) {
    var i = document.createElement("span"); i.className = "pill-ico"; i.textContent = ico;
    var t = document.createElement("span"); t.className = "pill-txt"; t.textContent = txt;
    b.appendChild(i); b.appendChild(t); b.setAttribute("aria-label", txt);
  }
  function mountPills() {
    ["landingPills", "followupPills"].forEach(function (id) {
      var host = document.getElementById(id);
      if (!host || host.querySelector(".mg-pill")) return;
      var b = el("button", "width-toggle mg-pill"); pillLabel(b, "🖼", "Image"); b.type = "button"; b.title = "Generate an image (/image)";
      b.onclick = function (e) { e.stopPropagation(); open(); };
      host.appendChild(b);
      var v = el("button", "width-toggle mg-pill mg-pill-video"); pillLabel(v, "🎬", "Video"); v.type = "button"; v.title = "Generate a short video";
      v.onclick = function (e) { e.stopPropagation(); open("", "video"); };
      host.appendChild(v);
    });
  }
  // '/image <prompt>' typed in a composer and submitted with Enter opens the dialog instead of searching
  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (e.key !== "Enter" || e.shiftKey || !t || t.tagName !== "TEXTAREA" && t.tagName !== "INPUT") return;
    var m = /^\/image(?:\s+([\s\S]*))?$/i.exec(String(t.value || "").trim());
    if (!m) return;
    e.preventDefault(); e.stopImmediatePropagation();
    t.value = ""; t.dispatchEvent(new Event("input", { bubbles: true }));
    open(m[1] || "");
  }, true);

  /* ---------- Videos tab ---------- */
  function videoIds(urls) {
    var out = [], seen = {};
    (urls || []).forEach(function (u) {
      var m = null, id = null, kind = null;
      try {
        var p = new URL(u), h = p.hostname.replace(/^(www|m)\./, "");
        if (h === "youtu.be") { id = p.pathname.slice(1).split("/")[0]; kind = "yt"; }
        else if (h === "youtube.com" || h === "youtube-nocookie.com") {
          if (p.pathname === "/watch") id = p.searchParams.get("v");
          else if ((m = /^\/(?:shorts|embed|live)\/([\w-]{6,})/.exec(p.pathname))) id = m[1];
          kind = "yt";
        } else if (h === "vimeo.com" && /^\/(\d+)/.test(p.pathname)) { id = /^\/(\d+)/.exec(p.pathname)[1]; kind = "vimeo"; }
      } catch (e) { return; }
      if (!id || !/^[\w-]+$/.test(id)) return;
      var key = kind + ":" + id;
      if (seen[key]) return; seen[key] = 1;
      out.push({ kind: kind, id: id, url: u, thumb: kind === "yt" ? "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg" : "" });
    });
    return out.slice(0, 6);
  }

  function addVideosTab(tabs) {
    if (tabs.dataset.mgDone) return;
    tabs.dataset.mgDone = "1";
    var sec = tabs.parentElement;
    if (!sec) return;
    var urls = [].map.call(sec.querySelectorAll("a[href]"), function (a) { return a.href; });
    var vids = videoIds(urls);
    if (!vids.length) return;
    var content = tabs.previousElementSibling;
    var panel = el("div", "tab-panel mg-videos"); panel.style.display = "none";
    var grid = el("div", "mg-vgrid");
    vids.forEach(function (v) {
      var a = el("a", "mg-vcard"); a.href = v.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      if (v.thumb) { var im = el("img"); im.src = v.thumb; im.alt = ""; im.loading = "lazy"; a.appendChild(im); }
      else a.appendChild(el("div", "mg-vph", "▶"));
      a.appendChild(el("div", "mg-vcap", v.kind === "yt" ? "YouTube" : "Vimeo"));
      grid.appendChild(a);
    });
    panel.appendChild(grid);
    sec.appendChild(panel);
    var tab = el("button", "answer-tab", "Videos · " + vids.length); tab.type = "button";
    var others = [].slice.call(tabs.querySelectorAll(".answer-tab"));
    tab.onclick = function () {
      if (content) content.style.display = "none";
      [].forEach.call(sec.querySelectorAll(".tab-panel"), function (p) { p.style.display = p === panel ? "" : "none"; });
      [].forEach.call(tabs.querySelectorAll(".answer-tab"), function (b) { b.classList.toggle("active", b === tab); });
    };
    others.forEach(function (b) { b.addEventListener("click", function () { panel.style.display = "none"; }); });
    tabs.appendChild(tab);
  }
  function scan(root) {
    [].forEach.call((root || document).querySelectorAll(".answer-tabs"), function (t) { setTimeout(function () { addVideosTab(t); }, 0); });
  }

  function attach() { mountPills(); scan(document); }
  var mo = new MutationObserver(function () { mountPills(); scan(document); });
  function start() { attach(); mo.observe(document.body, { childList: true, subtree: true }); }

  window.MediaGen = { api: api, shrink: shrink, generate: generate, open: open, close: close, videoIds: videoIds, attach: attach };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
