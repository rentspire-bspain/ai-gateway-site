/* media.js — image generation dialog (/image) + Videos answer tab
 * window.MediaGen = { generate(prompt) -> Promise<string[]>, open(), close(), videoIds(urls), attach() }
 * Image generation calls the media-gen edge function. Video GENERATION is not offered;
 * the Videos tab only lists video links already present in an answer's sources.
 */
(function () {
  "use strict";
  var FN = ((typeof GATEWAY !== "undefined" && GATEWAY) || "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1") + "/media-gen";
  var overlay = null, results = [], busy = false;

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

  function download(url, i) {
    var a = document.createElement("a");
    a.href = url; a.download = "image-" + (i + 1) + ".png"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
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

  function open(initial) {
    close();
    results = [];
    overlay = el("div", "mg-overlay");
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    var dlg = el("div", "mg-dialog");
    dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "Generate image");
    var head = el("div", "mg-head");
    head.appendChild(el("h3", "", "Generate image"));
    var x = el("button", "mg-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.onclick = close;
    head.appendChild(x);
    var ta = el("textarea", "mg-prompt"); ta.rows = 3; ta.maxLength = 1000; ta.placeholder = "Describe the image you want…";
    if (typeof initial === "string") ta.value = initial;
    var row = el("div", "mg-row");
    var go = el("button", "mg-go", "Generate"); go.type = "button";
    var status = el("div", "mg-status"); status.setAttribute("aria-live", "polite");
    row.appendChild(go); row.appendChild(status);
    var grid = el("div", "mg-grid");
    dlg.appendChild(head); dlg.appendChild(ta); dlg.appendChild(row); dlg.appendChild(grid);
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
        ins.onclick = function () { if (insert(prompt, url)) { close(); } else { status.textContent = "Could not insert into thread."; status.className = "mg-status err"; } };
        acts.appendChild(d); acts.appendChild(ins); card.appendChild(acts); grid.appendChild(card);
      });
    }
    function run() {
      var p = ta.value.trim();
      if (!p || busy) return;
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
    ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } });
  }

  /* ---------- composer entry point ('/image' via standalone pill; SkillsSlash has no registration API) ---------- */
  function mountPills() {
    ["landingPills", "followupPills"].forEach(function (id) {
      var host = document.getElementById(id);
      if (!host || host.querySelector(".mg-pill")) return;
      var b = el("button", "width-toggle mg-pill", "🖼 Image"); b.type = "button"; b.title = "Generate an image (/image)";
      b.onclick = function (e) { e.stopPropagation(); open(); };
      host.appendChild(b);
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

  window.MediaGen = { generate: generate, open: open, close: close, videoIds: videoIds, attach: attach };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
