(function () {
  "use strict";
  var KEY = "ai_skills";
  var SEEDED = "ai_skills_seeded";
  var COMPOSERS = ["landingInput", "searchbarInput", "followupInput"];

  function uid() { return "sk_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

  var STARTERS = [
    { name: "Deep Research", icon: "🔎", prompt: "Conduct deep, multi-source research on the following. Break it into sub-questions, cross-check claims across independent sources, note disagreements, and deliver a structured report with cited sources:\n\n" },
    { name: "Summarize", icon: "📝", prompt: "Summarize the following clearly with key points and sources:\n\n" },
    { name: "Act as analyst", icon: "📈", prompt: "Act as a senior financial analyst. Use current data, state key assumptions, quantify risks and upside, and give a clear bottom-line view with sources for the following:\n\n" },
    { name: "Explain simply", icon: "💡", prompt: "Explain the following in plain language, as if to a smart beginner. Avoid jargon, use a concrete analogy, and keep it short:\n\n" }
  ];

  function load() {
    var list = null;
    try { list = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    if (!Array.isArray(list)) list = null;
    var seeded = false;
    try { seeded = !!localStorage.getItem(SEEDED); } catch (e) {}
    if (!list && !seeded) {
      var now = Date.now();
      list = STARTERS.map(function (s, i) { return { id: uid(), name: s.name, icon: s.icon, prompt: s.prompt, createdAt: now + i }; });
      save(list);
      try { localStorage.setItem(SEEDED, "1"); } catch (e) {}
    }
    return list || [];
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); localStorage.setItem(SEEDED, "1"); } catch (e) {}
  }

  function el(id) { return document.getElementById(id); }
  function threadOpen() {
    var w = el("followupWrapper");
    return !!(w && w.style.display !== "none" && w.offsetParent !== null);
  }
  function setInput(inp, text) {
    inp.value = text;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.focus();
    try { inp.setSelectionRange(text.length, text.length); } catch (e) {}
  }

  /* ---------------- Manager overlay ---------------- */
  var overlay = null;
  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
    document.removeEventListener("keydown", onEsc, true);
  }
  function onEsc(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }

  function useSkill(s) {
    close();
    var inp = threadOpen() ? el("followupInput") : el("searchInput") || el("landingInput");
    if (inp) setInput(inp, s.prompt);
  }

  function open() {
    close();
    overlay = document.createElement("div");
    overlay.className = "sk-overlay";
    overlay.innerHTML = '<div class="sk-panel" role="dialog" aria-modal="true" aria-label="Skills"></div>';
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onEsc, true);
    renderList();
  }
  function panel() { return overlay && overlay.firstChild; }

  function renderList() {
    var p = panel(); if (!p) return;
    var skills = load();
    p.innerHTML = '<div class="sk-head"><h2>Skills</h2><button class="sk-btn primary" data-a="new">+ New skill</button><button class="sk-btn" data-a="close" aria-label="Close">✕</button></div>' +
      '<div class="sk-body"><p class="sk-sub">Reusable prompts. Type / in any search box to insert one.</p><div class="sk-grid">' +
      (skills.length ? skills.map(function (s) {
        return '<div class="sk-card" data-id="' + esc(s.id) + '"><div class="sk-card-top"><div class="sk-icon">' + esc(s.icon || (s.name || "?")[0]) + '</div><div class="sk-name">' + esc(s.name) + '</div></div>' +
          '<div class="sk-desc">' + esc(s.prompt) + '</div><div class="sk-actions"><button class="sk-btn primary" data-a="use">Use</button><button class="sk-btn" data-a="edit">Edit</button><button class="sk-btn danger" data-a="del">Delete</button></div></div>';
      }).join("") : '<div class="sk-empty">No skills yet. Create your first one.</div>') + '</div></div>';
    p.onclick = function (e) {
      var b = e.target.closest("button[data-a]"); if (!b) return;
      var a = b.dataset.a, card = b.closest(".sk-card"), id = card && card.dataset.id;
      var s = load().filter(function (x) { return x.id === id; })[0];
      if (a === "close") close();
      else if (a === "new") renderForm(null);
      else if (a === "use" && s) useSkill(s);
      else if (a === "edit" && s) renderForm(s);
      else if (a === "del" && s) {
        if (confirm('Delete skill "' + s.name + '"?')) { save(load().filter(function (x) { return x.id !== id; })); renderList(); }
      }
    };
  }

  function renderForm(s) {
    var p = panel(); if (!p) return;
    p.innerHTML = '<div class="sk-head"><h2>' + (s ? "Edit skill" : "New skill") + '</h2></div><div class="sk-body"><form class="sk-form">' +
      '<div class="sk-row"><label>Icon<input name="icon" maxlength="2" placeholder="🔎" value="' + esc(s ? s.icon : "") + '"></label>' +
      '<label>Name<input name="name" required maxlength="40" placeholder="e.g. Competitor brief" value="' + esc(s ? s.name : "") + '"></label></div>' +
      '<label>Prompt<textarea name="prompt" required placeholder="Instructions inserted into the search box">' + esc(s ? s.prompt : "") + '</textarea></label>' +
      '<div class="sk-form-actions"><button type="button" class="sk-btn" data-a="cancel">Cancel</button><button type="submit" class="sk-btn primary">Save</button></div></form></div>';
    var f = p.querySelector("form");
    f.querySelector('[name="name"]').focus();
    f.querySelector('[data-a="cancel"]').onclick = renderList;
    p.onclick = null;
    f.onsubmit = function (e) {
      e.preventDefault();
      var name = f.name.value.trim(), prompt = f.prompt.value, icon = f.icon.value.trim() || name[0].toUpperCase();
      if (!name || !prompt.trim()) return;
      var list = load();
      if (s) list = list.map(function (x) { return x.id === s.id ? { id: x.id, name: name, icon: icon, prompt: prompt, createdAt: x.createdAt } : x; });
      else list.push({ id: uid(), name: name, icon: icon, prompt: prompt, createdAt: Date.now() });
      save(list); renderList();
    };
  }

  /* ---------------- Slash menu ---------------- */
  var menu = null, items = [], sel = 0, active = null;

  var COMMANDS = [
    { cmd: "research", icon: "🔬", name: "/research", desc: "Turn Deep Research on", run: function () {
        var t = el("deepResearchToggle"); if (t && !t.classList.contains("active")) t.click(); } },
    { cmd: "new", icon: "✨", name: "/new", desc: "Start a new thread", run: function () {
        if (typeof window.newThread === "function") window.newThread(); else if (typeof newThread === "function") newThread(); } }
  ];

  function buildItems(q) {
    q = q.toLowerCase();
    var out = [];
    COMMANDS.forEach(function (c) { if (!q || c.cmd.indexOf(q) === 0) out.push({ type: "cmd", c: c, icon: c.icon, name: c.name, desc: c.desc }); });
    load().forEach(function (s) {
      if (!q || (s.name || "").toLowerCase().indexOf(q) !== -1) out.push({ type: "skill", s: s, icon: s.icon || (s.name || "?")[0], name: s.name, desc: s.prompt.replace(/\s+/g, " ").slice(0, 60) });
    });
    return out;
  }

  function closeMenu() { if (menu) { menu.remove(); menu = null; } items = []; active = null; }

  function position() {
    if (!menu || !active) return;
    var r = active.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = Math.min(360, vw - 16);
    menu.style.width = w + "px";
    var left = Math.max(8, Math.min(r.left, vw - w - 8));
    var spaceBelow = vh - r.bottom - 12, spaceAbove = r.top - 12;
    var h = Math.min(menu.scrollHeight + 2, 320);
    menu.style.left = left + "px";
    if (spaceBelow >= h || spaceBelow >= spaceAbove) {
      menu.style.top = (r.bottom + 6) + "px"; menu.style.bottom = "auto";
      menu.style.maxHeight = Math.max(80, Math.min(320, spaceBelow)) + "px";
    } else {
      menu.style.top = "auto"; menu.style.bottom = (vh - r.top + 6) + "px";
      menu.style.maxHeight = Math.max(80, Math.min(320, spaceAbove)) + "px";
    }
  }

  function render() {
    if (!menu) { menu = document.createElement("div"); menu.className = "sk-slash"; menu.setAttribute("role", "listbox"); document.body.appendChild(menu); }
    if (sel >= items.length) sel = items.length - 1;
    if (sel < 0) sel = 0;
    var html = "", prev = null;
    items.forEach(function (it, i) {
      if (prev && prev !== it.type) html += '<div class="sk-slash-sep"></div>';
      prev = it.type;
      html += '<div class="sk-slash-item' + (i === sel ? " sel" : "") + '" role="option" data-i="' + i + '"><span class="sk-i">' + esc(it.icon) + '</span><span class="sk-n">' + esc(it.name) + '</span><span class="sk-d">' + esc(it.desc) + '</span></div>';
    });
    menu.innerHTML = html;
    position();
    var s = menu.querySelector(".sel"); if (s && s.scrollIntoView) s.scrollIntoView({ block: "nearest" });
  }

  function refresh(inp) {
    var v = inp.value;
    if (v.charAt(0) !== "/") { closeMenu(); return; }
    var q = v.slice(1);
    if (/\s/.test(q)) { closeMenu(); return; }
    active = inp;
    var next = buildItems(q);
    if (!next.length) { closeMenu(); active = inp; items = []; return; }
    items = next; sel = 0; render();
  }

  function choose(i) {
    var it = items[i], inp = active; if (!it || !inp) return;
    closeMenu();
    if (it.type === "cmd") { inp.value = ""; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.focus(); it.c.run(); }
    else setInput(inp, it.s.prompt);
  }

  function isComposer(t) { return t && t.id && COMPOSERS.indexOf(t.id) !== -1; }

  function attach() {
    if (attach.done) return; attach.done = true;
    // capture phase on document so we run before the app's Enter handlers
    document.addEventListener("keydown", function (e) {
      if (!isComposer(e.target)) return;
      var v = e.target.value;
      if (menu && items.length && active === e.target) {
        if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); sel = (sel + 1) % items.length; render(); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); sel = (sel - 1 + items.length) % items.length; render(); return; }
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopImmediatePropagation(); choose(sel); return; }
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(); return; }
      }
      // never submit a bare slash command that has no matching menu
      if (e.key === "Enter" && v.charAt(0) === "/" && !/\s/.test(v)) {
        var m = buildItems(v.slice(1));
        e.preventDefault(); e.stopImmediatePropagation();
        if (m.length) { active = e.target; items = m; choose(0); }
      }
    }, true);
    document.addEventListener("input", function (e) { if (isComposer(e.target)) refresh(e.target); }, true);
    document.addEventListener("focusout", function (e) {
      if (menu && e.target === active) setTimeout(function () { if (document.activeElement !== active) closeMenu(); }, 120);
    }, true);
    document.addEventListener("mousedown", function (e) {
      if (!menu) return;
      var item = e.target.closest && e.target.closest(".sk-slash-item");
      if (item && menu.contains(item)) { e.preventDefault(); choose(+item.dataset.i); return; }
      if (!menu.contains(e.target) && e.target !== active) closeMenu();
    }, true);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
  }

  window.SkillsUI = { open: open, close: close };
  window.SkillsSlash = { attach: attach };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach); else attach();
})();
