/* SiteAssets — in-chat favicon / logo update flow (matrix I2).
   Flow: user asks "update the favicon to the one from spaincos.com" -> intercept() opens
   this panel prefilled -> (a) gateway asset-fetch tool -> (b) side-by-side preview ->
   (c) explicit Apply: runtime swap of <link rel=icon> (+ logo mark), persisted to
   localStorage and best-effort Supabase Storage. Nothing is applied without a click
   (prompt-injection safe: the model never swaps assets on its own).

   GATEWAY CONTRACT (proposed; confirm with gateway_brain):
     POST {GATEWAY}/gateway-asset   Authorization: Bearer <session token>
     body    { action:"fetch", kind:"favicon"|"logo", url:"https://spaincos.com" }
     200     { ok:true, kind, source_url, content_type:"image/png"|..., width?, height?,
               bytes, sha256?, data_base64 }       (<=256KB, image/* only, https only)
     4xx/5xx { ok:false, error:"reason" }
   Override the endpoint with window.SITE_ASSET_ENDPOINT. If it 404s the panel falls back to
   a public favicon service (favicon only) and says so.
   Exposes window.SiteAssets = { intercept, open, close, applyStored, revert }. */
(function () {
  "use strict";
  var LS = window.localStorage, MAX = 256 * 1024, BUCKET = "site-assets";
  var KEYS = { favicon: "ai_site_favicon", logo: "ai_site_logo" };
  var DEFAULT_DOMAIN = "spaincos.com";
  var overlay = null, lastFocus = null, state = null;

  function g(name) { try { return (0, eval)("typeof " + name + "!==\"undefined\"?" + name + ":undefined"); } catch (e) { return undefined; } }
  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  function iconLink() {
    var l = document.querySelector('link[rel~="icon"]');
    if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); }
    return l;
  }
  if (!iconLink().dataset.orig) iconLink().dataset.orig = iconLink().getAttribute("href") || "";
  function logoMark() { return document.querySelector(".logo-mark"); }

  /* ---------- runtime swap ---------- */
  function setFavicon(url) {
    var l = iconLink();
    l.removeAttribute("type"); // let the browser sniff the new format
    l.href = url;
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(function (a) { a.href = url; });
  }
  function setLogo(url) {
    var m = logoMark(); if (!m) return;
    if (!m.dataset.origHtml) m.dataset.origHtml = m.innerHTML;
    m.innerHTML = "";
    var im = document.createElement("img");
    im.src = url; im.alt = ""; im.style.cssText = "width:100%;height:100%;object-fit:contain;border-radius:inherit";
    m.appendChild(im);
    m.style.background = "transparent";
  }
  function applyStored() {
    try { var f = LS.getItem(KEYS.favicon); if (f && /^data:image\//.test(f)) setFavicon(f); } catch (e) {}
    try { var lg = LS.getItem(KEYS.logo); if (lg && /^data:image\//.test(lg)) setLogo(lg); } catch (e) {}
  }
  function revert(kind) {
    kinds(kind).forEach(function (k) {
      try { LS.removeItem(KEYS[k]); } catch (e) {}
      if (k === "favicon") { var l = iconLink(); l.href = l.dataset.orig || "favicon.webp"; l.setAttribute("type", "image/webp"); }
      else { var m = logoMark(); if (m && m.dataset.origHtml != null) { m.innerHTML = m.dataset.origHtml; m.style.background = ""; } }
    });
  }
  function kinds(k) { return k ? [k] : ["favicon", "logo"]; }

  /* ---------- fetching ---------- */
  function normUrl(v) {
    v = String(v || "").trim();
    if (!v) return "";
    if (!/^https?:\/\//i.test(v)) v = "https://" + v;
    try { var u = new URL(v); if (u.protocol !== "https:") return ""; return u.origin + (u.pathname === "/" ? "" : u.pathname); } catch (e) { return ""; }
  }
  function sniffOk(b64, type) {
    // magic bytes: PNG, JPEG, GIF, WEBP(RIFF), ICO, or SVG text
    try {
      var bin = atob(b64.slice(0, 64)), c = function (i) { return bin.charCodeAt(i); };
      if (c(0) === 0x89 && bin.slice(1, 4) === "PNG") return true;
      if (c(0) === 0xFF && c(1) === 0xD8) return true;
      if (bin.slice(0, 3) === "GIF") return true;
      if (bin.slice(0, 4) === "RIFF") return true;
      if (c(0) === 0 && c(1) === 0 && c(2) === 1 && c(3) === 0) return true;
      if (/svg/.test(type)) return true;
    } catch (e) {}
    return false;
  }
  async function viaGateway(kind, url) {
    var sb = g("sb"), GW = g("GATEWAY");
    var endpoint = window.SITE_ASSET_ENDPOINT || (GW ? GW + "/gateway-asset" : "");
    if (!endpoint) throw new Error("Gateway endpoint not configured");
    var tok = "";
    try { var s = await sb.auth.getSession(); tok = s && s.data && s.data.session ? s.data.session.access_token : ""; } catch (e) {}
    if (!tok) throw new Error("Sign in to fetch assets");
    var res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ action: "fetch", kind: kind, url: url }) });
    var data = {}; try { data = await res.json(); } catch (e) {}
    if (res.status === 404) { var nf = new Error("The gateway asset tool isn't deployed yet"); nf.notDeployed = true; throw nf; }
    if (!res.ok || !data || data.ok === false) throw new Error((data && (data.error && data.error.message || data.error)) || ("Gateway error " + res.status));
    var type = String(data.content_type || "").toLowerCase();
    if (!/^image\//.test(type)) throw new Error("The fetched file isn't an image (" + (type || "unknown type") + ")");
    var b64 = String(data.data_base64 || "");
    if (!b64 || b64.length * 0.75 > MAX) throw new Error("Image is empty or larger than 256 KB");
    if (!sniffOk(b64, type)) throw new Error("File contents don't look like an image");
    return { dataUrl: "data:" + type + ";base64," + b64, type: type, source: data.source_url || url, bytes: data.bytes || Math.round(b64.length * 0.75), via: "gateway" };
  }
  async function viaPublicService(url) {
    var host; try { host = new URL(url).hostname; } catch (e) { throw new Error("Invalid URL"); }
    var res = await fetch("https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=128");
    if (!res.ok) throw new Error("Public favicon service returned " + res.status);
    var blob = await res.blob();
    if (!/^image\//.test(blob.type) || blob.size > MAX) throw new Error("Public favicon service returned an unusable file");
    var dataUrl = await new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsDataURL(blob); });
    return { dataUrl: dataUrl, type: blob.type, source: "https://www.google.com/s2/favicons?domain=" + host, bytes: blob.size, via: "public favicon service (fallback)" };
  }

  /* ---------- persistence ---------- */
  async function persist(kind, asset) {
    try { LS.setItem(KEYS[kind], asset.dataUrl); } catch (e) { throw new Error("Browser storage is full — asset not saved"); }
    var sb = g("sb"), note = "saved in this browser";
    try {
      if (sb && sb.storage) {
        var blob = await (await fetch(asset.dataUrl)).blob();
        var up = await sb.storage.from(BUCKET).upload(kind, blob, { upsert: true, contentType: asset.type });
        if (!up.error) note = "saved in this browser and Supabase Storage (" + BUCKET + "/" + kind + ")";
        else note += "; cloud copy skipped (" + up.error.message + ")";
      }
    } catch (e) { note += "; cloud copy skipped"; }
    return note;
  }

  /* ---------- UI ---------- */
  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
    document.removeEventListener("keydown", onKey, true);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  function onKey(e) { if (e.key === "Escape" && overlay) { e.stopPropagation(); close(); } }
  function sizesBox(title, url, meta) {
    var b = el("div", "sa-box"); b.appendChild(el("h4", "", title));
    var row = el("div", "sa-sizes");
    if (url) [16, 32, 64].forEach(function (n) { var im = document.createElement("img"); im.src = url; im.width = n; im.height = n; im.alt = n + "px"; row.appendChild(im); });
    else row.appendChild(el("span", "sa-note", "—"));
    b.appendChild(row);
    if (meta) b.appendChild(el("div", "sa-meta", meta));
    return b;
  }
  function currentUrl(kind) {
    if (kind === "favicon") return iconLink().href;
    var m = logoMark(), im = m && m.querySelector("img"); return im ? im.src : "";
  }
  function open(opts) {
    opts = opts || {};
    close(); lastFocus = document.activeElement;
    state = { kind: opts.kind === "logo" ? "logo" : "favicon", asset: null };
    overlay = el("div", "sa-overlay");
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    var p = el("div", "sa-panel"); p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true"); p.setAttribute("aria-label", "Update site asset"); p.tabIndex = -1;
    var head = el("div", "sa-head"); head.appendChild(el("h2", "sa-title", "Update site icon"));
    var x = el("button", "sa-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.onclick = close; head.appendChild(x); p.appendChild(head);
    p.appendChild(el("div", "sa-note", "Fetch an icon from a website, preview it, then apply it to this site. Nothing changes until you press Apply."));
    var row = el("div", "sa-row");
    var sel = el("select", "sa-sel"); [["favicon", "Favicon"], ["logo", "Logo"]].forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; sel.appendChild(op); }); sel.value = state.kind;
    var inp = el("input", "sa-input"); inp.type = "text"; inp.placeholder = "spaincos.com"; inp.value = opts.url || DEFAULT_DOMAIN; inp.setAttribute("aria-label", "Website URL");
    var fetchBtn = el("button", "sa-btn primary", "Fetch"); fetchBtn.type = "button";
    row.appendChild(sel); row.appendChild(inp); row.appendChild(fetchBtn); p.appendChild(row);
    var status = el("div", "sa-status"); status.setAttribute("role", "status"); p.appendChild(status);
    var cmp = el("div", "sa-compare"); p.appendChild(cmp);
    var acts = el("div", "sa-row");
    var apply = el("button", "sa-btn primary", "Apply to site"); apply.type = "button"; apply.disabled = true;
    var rev = el("button", "sa-btn", "Revert to default"); rev.type = "button";
    acts.appendChild(apply); acts.appendChild(rev); p.appendChild(acts);
    overlay.appendChild(p); (document.getElementById("moduleRoot") || document.body).appendChild(overlay);
    document.addEventListener("keydown", onKey, true);

    function draw() {
      cmp.innerHTML = "";
      cmp.appendChild(sizesBox("Current", currentUrl(sel.value), ""));
      cmp.appendChild(sizesBox("New", state.asset && state.asset.dataUrl, state.asset ? (state.asset.type + " · " + Math.round(state.asset.bytes / 1024 * 10) / 10 + " KB · via " + state.asset.via + " · " + state.asset.source) : ""));
    }
    function say(msg, cls) { status.textContent = msg; status.className = "sa-status" + (cls ? " " + cls : ""); }
    sel.onchange = function () { state.kind = sel.value; state.asset = null; apply.disabled = true; say(""); draw(); };
    async function doFetch() {
      var url = normUrl(inp.value);
      if (!url) { say("Enter a valid https website address.", "err"); return; }
      fetchBtn.disabled = true; apply.disabled = true; state.asset = null; draw(); say("Fetching…");
      try {
        var a;
        try { a = await viaGateway(sel.value, url); }
        catch (e) {
          if (e.notDeployed && sel.value === "favicon") { a = await viaPublicService(url); say("Gateway asset tool unavailable — used a public favicon service instead. Review the preview carefully.", ""); }
          else throw e;
        }
        state.asset = a; draw(); apply.disabled = false;
        if (a.via === "gateway") say("Fetched. Review the preview, then apply.", "ok");
      } catch (e) { say("Couldn't fetch the asset: " + (e && e.message ? e.message : e), "err"); draw(); }
      fetchBtn.disabled = false;
    }
    fetchBtn.onclick = doFetch;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); doFetch(); } });
    apply.onclick = async function () {
      if (!state.asset) return;
      apply.disabled = true; say("Applying…");
      try {
        if (sel.value === "favicon") setFavicon(state.asset.dataUrl); else setLogo(state.asset.dataUrl);
        var note = await persist(sel.value, state.asset);
        say("Applied — " + note + ". The deployed file (favicon.webp) is unchanged; this swap is re-applied on each visit.", "ok");
        draw();
      } catch (e) { say("Couldn't apply: " + (e && e.message ? e.message : e), "err"); apply.disabled = false; }
    };
    rev.onclick = function () { revert(sel.value); state.asset = null; say("Reverted to the built-in " + sel.value + ".", "ok"); apply.disabled = true; draw(); };
    draw();
    if (opts.autofetch) doFetch();
    p.focus();
  }

  /* ---------- chat intent ---------- */
  var INTENT = /\b(update|change|replace|set|swap|use|switch|make)\b[^.?!]{0,60}\b(favicon|fav icon|site icon|tab icon|logo)\b/i;
  function intercept(query) {
    var q = String(query || "");
    if (!INTENT.test(q)) return false;
    var kind = /logo/i.test(q) && !/favicon|tab icon|site icon/i.test(q) ? "logo" : "favicon";
    var m = q.match(/\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i);
    open({ kind: kind, url: m ? m[1].replace(/[.,;)]+$/, "") : DEFAULT_DOMAIN, autofetch: true });
    return true;
  }

  applyStored();
  window.SiteAssets = { intercept: intercept, open: open, close: close, applyStored: applyStored, revert: revert };
})();
