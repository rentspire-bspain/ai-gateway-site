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
      var name = f.elements.name.value.trim(), prompt = f.elements.prompt.value, icon = f.elements.icon.value.trim() || name[0].toUpperCase();
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
        if (typeof window.newThread === "function") window.newThread(); else if (typeof newThread === "function") newThread(); } },
    { cmd: "email", icon: "✉️", name: "/email", desc: "Draft or send email (preview + approval)", run: function () { if (window.SkillsActions) window.SkillsActions.open("send_email"); } },
    { cmd: "draft", icon: "📝", name: "/draft", desc: "Create a Gmail draft (preview + approval)", run: function () { if (window.SkillsActions) window.SkillsActions.open("draft_email"); } },
    { cmd: "event", icon: "📅", name: "/event", desc: "Create calendar event (preview + approval)", run: function () { if (window.SkillsActions) window.SkillsActions.open("create_event"); } }
  ];

  function buildItems(q) {
    q = q.toLowerCase();
    var out = [];
    COMMANDS.forEach(function (c) { if (!q || c.cmd.indexOf(q) === 0) out.push({ type: "cmd", c: c, icon: c.icon, name: c.name, desc: c.desc }); });
    var extra = [];
    try { extra = (typeof window.SkillsPluginSource === "function" ? window.SkillsPluginSource() : []) || []; } catch (e) {}
    // v1 (§34c): user-authorable skills synced from public.skills also appear in the slash menu
    var cloud = [];
    try { cloud = (window.SkillsV1 && typeof window.SkillsV1.cachedItems === "function") ? (window.SkillsV1.cachedItems() || []) : []; } catch (e) {}
    load().concat(extra).concat(cloud).forEach(function (s) {
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

  // Guarded so this file can be required in Node (unit tests import the v1 pure API below).
  if (typeof window !== "undefined") {
    window.SkillsUI = { open: open, close: close };
    window.SkillsSlash = { attach: attach };
    window.SkillsLibrary = { open: open, close: close }; // legacy prompt-library overlay (kept reachable)
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach); else attach();
  }
})();

/* ================= Skills v1 — user-authorable skills (Parity doc §34c) =================
   Reusable prompt + tool recipes stored in public.skills (Supabase, RLS-scoped to the
   owner). Manager UI: Settings → Skills pane + the sidebar Skills button. "Use in chat"
   submits "Use the skill 'NAME': <instructions>" through the existing submitQuery() path
   (the same one suggestion chips and follow-ups use). Schema ships in sql/skills.sql. */
(function (root) {
  "use strict";

  var LIMITS = { name: 80, description: 300, instructions: 8000, tool: 40, tools: 12 };

  // ---------- pure API (unit-tested in skills.test.js) ----------

  function normalizeTools(raw) {
    var list;
    if (raw == null) list = [];
    else if (Array.isArray(raw)) list = raw;
    else if (typeof raw === "string") list = raw.split(/[,\n]/);
    else return null; // unsupported shape -> caller reports a validation error
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var t = String(list[i] == null ? "" : list[i]).trim();
      if (!t) continue;
      if (t.length > LIMITS.tool) return null;
      var k = t.toLowerCase();
      if (seen[k]) continue; // dedupe (case-insensitive)
      seen[k] = 1;
      out.push(t);
      if (out.length > LIMITS.tools) return null;
    }
    return out;
  }

  function validateSkillInput(raw) {
    raw = raw || {};
    var name = String(raw.name || "").trim();
    var description = String(raw.description || "").trim();
    var instructions = String(raw.instructions || "").trim();
    if (!name) return { ok: false, error: "Enter a name for this skill." };
    if (name.length > LIMITS.name) return { ok: false, error: "Name must be " + LIMITS.name + " characters or fewer." };
    if (description.length > LIMITS.description) return { ok: false, error: "Description must be " + LIMITS.description + " characters or fewer." };
    if (!instructions) return { ok: false, error: "Enter the instructions for this skill." };
    if (instructions.length > LIMITS.instructions) return { ok: false, error: "Instructions must be " + LIMITS.instructions + " characters or fewer." };
    var tools = normalizeTools(raw.tools);
    if (tools === null) return { ok: false, error: "Tools must be " + LIMITS.tools + " tags or fewer, each " + LIMITS.tool + " characters or fewer." };
    return { ok: true, value: { name: name, description: description, instructions: instructions, tools: tools } };
  }

  // The exact message "Use in chat" submits to the current thread.
  function buildUseInChatMessage(skill) {
    var name = String((skill && skill.name) || "").trim();
    var instructions = String((skill && skill.instructions) || "").trim();
    return "Use the skill '" + name + "': " + instructions;
  }

  // Map a public.skills row to the client shape (tools jsonb -> array with fallback).
  function skillFromRow(row) {
    row = row || {};
    return {
      id: row.id,
      name: String(row.name || ""),
      description: String(row.description || ""),
      instructions: String(row.instructions || ""),
      tools: normalizeTools(row.tools) || [],
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    };
  }

  // Payload shape for POST/PATCH: only the authorable columns (id/user_id/timestamps are
  // server-side defaults; tools is always a JSON array).
  function buildSkillWritePayload(skill) {
    var v = validateSkillInput(skill);
    if (!v.ok) return { ok: false, error: v.error };
    return { ok: true, value: { name: v.value.name, description: v.value.description, instructions: v.value.instructions, tools: v.value.tools } };
  }

  var pureApi = {
    LIMITS: LIMITS,
    validateSkillInput: validateSkillInput,
    normalizeTools: normalizeTools,
    buildUseInChatMessage: buildUseInChatMessage,
    skillFromRow: skillFromRow,
    buildSkillWritePayload: buildSkillWritePayload
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = pureApi; // Node (unit tests) — stop before any DOM code
    return;
  }

  // ---------- runtime: Supabase data layer ----------

  var SB_REST = "https://bnxermyboeigvwonfrzx.supabase.co/rest/v1";
  var ANON = "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb";
  var TABLE_URL = SB_REST + "/skills";
  var RPC_URL = SB_REST + "/rpc/list_skills";
  var SELECT_COLS = "id,name,description,instructions,tools,created_at,updated_at";

  var cloudCache = [];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "\u0026amp;", "<": "\u0026lt;", ">": "\u0026gt;", '"': "\u0026quot;", "'": "\u0026#39;" }[c];
    });
  }

  function fmt(t) {
    if (!t) return "";
    var d = new Date(t);
    return isNaN(d.getTime()) ? String(t) : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function getSessionInfo() {
    var client = (typeof sb !== "undefined") ? sb : ((root.__appGlobals && root.__appGlobals.sb) || root.sb);
    if (!client || !client.auth || typeof client.auth.getSession !== "function") {
      return Promise.resolve(null);
    }
    return client.auth.getSession().then(function (r) {
      var sess = r && r.data && r.data.session;
      if (!sess || !sess.access_token) return null;
      return { token: sess.access_token, userId: sess.user && sess.user.id ? sess.user.id : null };
    }).catch(function () { return null; });
  }

  function sbHeaders(tok, extra) {
    var h = { Authorization: "Bearer " + tok, apikey: ANON };
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  function readJson(res) {
    return res.text().then(function (txt) {
      var data = null;
      try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
      return { status: res.status, ok: res.ok, data: data };
    });
  }

  function isMissingTable(status, payload) {
    if (status === 404) return true;
    var code = payload && payload.code;
    var msg = String((payload && (payload.message || payload.error || payload.hint)) || "");
    return code === "PGRST205" || code === "42P01" || /skills.*(not find|does not exist)/i.test(msg);
  }

  // List via the list_skills() RPC; fall back to a direct table select.
  function requestSkills(sess) {
    return fetch(RPC_URL, { method: "POST", headers: sbHeaders(sess.token) }).then(readJson).then(function (r) {
      if (r.ok) return r;
      return fetch(TABLE_URL + "?select=" + SELECT_COLS + "&order=updated_at.desc&limit=200", { headers: sbHeaders(sess.token) }).then(readJson);
    });
  }

  function loadSkills() {
    return getSessionInfo().then(function (sess) {
      if (!sess) return { signedOut: true, skills: [] };
      return requestSkills(sess).then(function (r) {
        if (!r.ok) return { signedOut: false, missing: isMissingTable(r.status, r.data), skills: [] };
        var rows = Array.isArray(r.data) ? r.data : [];
        return { signedOut: false, skills: rows.map(skillFromRow) };
      });
    }).catch(function () { return { signedOut: false, skills: [] }; });
  }

  function saveSkill(skill, id) {
    var p = buildSkillWritePayload(skill);
    if (!p.ok) return Promise.reject(new Error(p.error));
    return getSessionInfo().then(function (sess) {
      if (!sess) throw new Error("Please sign in to save skills.");
      var url = id ? TABLE_URL + "?id=eq." + encodeURIComponent(id) : TABLE_URL;
      return fetch(url, {
        method: id ? "PATCH" : "POST",
        headers: sbHeaders(sess.token, { "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify(p.value)
      }).then(readJson);
    }).then(function (r) {
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) throw new Error("Save failed (" + r.status + ").");
      return skillFromRow(r.data[0]);
    });
  }

  function deleteSkill(id) {
    return getSessionInfo().then(function (sess) {
      if (!sess) throw new Error("Please sign in.");
      return fetch(TABLE_URL + "?id=eq." + encodeURIComponent(id), { method: "DELETE", headers: sbHeaders(sess.token) });
    }).then(function (res) {
      if (!res.ok) throw new Error("Delete failed (" + res.status + ").");
    });
  }

  // ---------- runtime: "Use in chat" ----------

  function useSkillInChat(skill) {
    var msg = buildUseInChatMessage(skill);
    try { if (root.SettingsUI && typeof root.SettingsUI.close === "function") root.SettingsUI.close(); } catch (e) {}
    if (typeof root.submitQuery === "function") { root.submitQuery(msg); return true; }
    return false;
  }

  // ---------- runtime: manager UI ----------

  function injectStyles() {
    if (document.getElementById("skm-styles")) return;
    var st = document.createElement("style");
    st.id = "skm-styles";
    st.textContent = [
      ".skm-wrap{display:flex;flex-direction:column;gap:14px;color:var(--text);font-family:var(--font-sans)}",
      ".skm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}",
      ".skm-title{font-size:17px;font-weight:600;margin:0;color:var(--text)}",
      ".skm-sub{margin:2px 0 0;font-size:12.5px;color:var(--text-muted);line-height:1.5}",
      ".skm-btn{background:var(--bg-elevated);color:var(--text);border:1px solid var(--border-light,var(--border));border-radius:8px;padding:7px 13px;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:border-color .15s,background .15s}",
      ".skm-btn:hover:not(:disabled){border-color:var(--accent)}",
      ".skm-btn:disabled{opacity:.55;cursor:not-allowed}",
      ".skm-btn-primary{background:var(--accent-btn,var(--accent));border-color:var(--accent-btn,var(--accent));color:#fff}",
      ".skm-btn-danger{color:var(--error,#e5484d);border-color:rgba(229,72,77,.35)}",
      ".skm-btn-sm{padding:4px 9px;font-size:11.5px;font-weight:500}",
      ".skm-status{font-size:12.5px;color:var(--text-muted);min-height:1em}",
      ".skm-status.err{color:var(--error,#e5484d)}",
      ".skm-status.ok{color:var(--accent)}",
      ".skm-form{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;display:flex;flex-direction:column;gap:11px}",
      ".skm-form-h{font-size:14px;font-weight:600;margin:0;color:var(--text)}",
      ".skm-field{display:flex;flex-direction:column;gap:5px}",
      ".skm-field label{font-size:12px;font-weight:600;color:var(--text-muted)}",
      ".skm-input,.skm-textarea{width:100%;box-sizing:border-box;background:var(--bg-input,var(--bg));border:1px solid var(--border-light,var(--border));border-radius:var(--radius-sm);color:var(--text);font-family:inherit;font-size:13.5px;padding:9px 11px;outline:none;transition:border-color .15s}",
      ".skm-input:focus,.skm-textarea:focus{border-color:var(--accent)}",
      ".skm-textarea{resize:vertical;min-height:96px;line-height:1.45}",
      ".skm-form-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
      ".skm-list{display:flex;flex-direction:column;gap:10px}",
      ".skm-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;display:flex;flex-direction:column;gap:6px}",
      ".skm-name{font-size:13.5px;font-weight:600;color:var(--text)}",
      ".skm-desc{color:var(--text-muted);font-size:12px;line-height:1.45}",
      ".skm-body{color:var(--text);font-size:12.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}",
      ".skm-tools{display:flex;gap:5px;flex-wrap:wrap}",
      ".skm-tag{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid var(--border);background:var(--accent-light,var(--bg-elevated));color:var(--accent)}",
      ".skm-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:4px;padding-top:8px;border-top:1px solid var(--border)}",
      ".skm-meta{color:var(--text-muted);font-size:11.5px}",
      ".skm-actions{display:flex;gap:6px;flex-wrap:wrap}",
      ".skm-empty{background:var(--bg-surface);border:1px dashed var(--border-light,var(--border));border-radius:var(--radius);padding:18px;color:var(--text-muted);font-size:13px;text-align:center;line-height:1.6}"
    ].join("\n");
    document.head.appendChild(st);
  }

  function mount(host) {
    if (!host) return null;
    injectStyles();
    var state = { skills: [], loading: true, error: "", signedOut: false, missing: false, editing: null, busy: false, confirmDeleteId: null };

    host.innerHTML =
      '<div class="skm-wrap">' +
        '<div class="skm-head">' +
          '<div><h3 class="skm-title">Skills</h3>' +
            '<p class="skm-sub">Reusable prompt + tool recipes. “Use in chat” sends the skill into the current thread, or type / in the composer to insert one.</p></div>' +
          '<button type="button" class="skm-btn skm-btn-primary" data-a="new">+ New skill</button>' +
        '</div>' +
        '<div class="skm-status" data-skm-msg></div>' +
        '<div data-skm-form></div>' +
        '<div class="skm-list" data-skm-list></div>' +
      '</div>';

    var msgEl = host.querySelector("[data-skm-msg]");
    var formBox = host.querySelector("[data-skm-form]");
    var listBox = host.querySelector("[data-skm-list]");

    function setMsg(text, kind) {
      msgEl.textContent = text || "";
      msgEl.className = "skm-status" + (kind ? " " + kind : "");
    }

    function renderForm() {
      if (!state.editing) { formBox.innerHTML = ""; return; }
      var s = state.editing === "new" ? null : state.editing;
      formBox.innerHTML =
        '<form class="skm-form" novalidate>' +
          '<h4 class="skm-form-h">' + (s ? "Edit skill" : "New skill") + '</h4>' +
          '<div class="skm-field"><label for="skmName">Name</label>' +
            '<input id="skmName" class="skm-input" name="name" type="text" maxlength="80" placeholder="e.g. Competitor brief" autocomplete="off" value="' + esc(s ? s.name : "") + '"></div>' +
          '<div class="skm-field"><label for="skmDesc">Description <span style="font-weight:400">(optional)</span></label>' +
            '<input id="skmDesc" class="skm-input" name="description" type="text" maxlength="300" placeholder="One line: what this skill does" autocomplete="off" value="' + esc(s ? s.description : "") + '"></div>' +
          '<div class="skm-field"><label for="skmInstr">Instructions</label>' +
            '<textarea id="skmInstr" class="skm-textarea" name="instructions" maxlength="8000" placeholder="What the assistant should do when this skill is used — the full recipe.">' + esc(s ? s.instructions : "") + '</textarea></div>' +
          '<div class="skm-field"><label for="skmTools">Tool tags <span style="font-weight:400">(optional, comma-separated)</span></label>' +
            '<input id="skmTools" class="skm-input" name="tools" type="text" placeholder="e.g. web search, github, email" autocomplete="off" value="' + esc(s && s.tools ? s.tools.join(", ") : "") + '"></div>' +
          '<div class="skm-form-actions">' +
            '<button type="submit" class="skm-btn skm-btn-primary" data-a="save"' + (state.busy ? " disabled" : "") + '>Save skill</button>' +
            '<button type="button" class="skm-btn" data-a="cancel">Cancel</button>' +
          '</div>' +
        '</form>';
      var form = formBox.querySelector("form");
      form.querySelector('[name="name"]').focus();
      form.onsubmit = function (e) {
        e.preventDefault();
        if (state.busy) return;
        var skill = {
          name: form.elements.name.value,
          description: form.elements.description.value,
          instructions: form.elements.instructions.value,
          tools: form.elements.tools.value
        };
        state.busy = true;
        setMsg("Saving…");
        saveSkill(skill, s ? s.id : null).then(function (row) {
          state.editing = null;
          state.busy = false;
          setMsg("Saved “" + row.name + "”.", "ok");
          return load();
        }, function (err) {
          state.busy = false;
          setMsg(err && err.message ? err.message : "Save failed.", "err");
          renderForm();
        });
      };
      form.querySelector('[data-a="cancel"]').onclick = function () { state.editing = null; renderForm(); };
    }

    function renderList() {
      if (state.loading) {
        listBox.innerHTML = '<div class="skm-empty">Loading skills…</div>';
        return;
      }
      if (state.signedOut) {
        listBox.innerHTML = '<div class="skm-empty">Sign in to create and use skills. Skills sync to your account and appear in the / menu.</div>';
        return;
      }
      if (state.missing) {
        listBox.innerHTML = '<div class="skm-empty">The skills table isn’t set up yet — apply <code>sql/skills.sql</code> in the Supabase SQL editor to enable it.</div>';
        return;
      }
      if (!state.skills.length) {
        listBox.innerHTML = '<div class="skm-empty">No skills yet. Create a reusable prompt + tool recipe — for example a competitor brief or a weekly research digest.</div>';
        return;
      }
      listBox.innerHTML = state.skills.map(function (s) {
        var tools = (s.tools || []).map(function (t) { return '<span class="skm-tag">' + esc(t) + '</span>'; }).join("");
        return '<div class="skm-card" data-sid="' + esc(s.id) + '">' +
          '<div><div class="skm-name">' + esc(s.name) + '</div>' +
            (s.description ? '<div class="skm-desc">' + esc(s.description) + '</div>' : "") + '</div>' +
          '<div class="skm-body">' + esc(s.instructions) + '</div>' +
          (tools ? '<div class="skm-tools">' + tools + '</div>' : "") +
          '<div class="skm-foot"><span class="skm-meta">Updated ' + esc(fmt(s.updatedAt || s.createdAt)) + '</span>' +
            '<div class="skm-actions">' +
              '<button type="button" class="skm-btn skm-btn-sm skm-btn-primary" data-a="use">Use in chat</button>' +
              '<button type="button" class="skm-btn skm-btn-sm" data-a="edit">Edit</button>' +
              (state.confirmDeleteId === s.id
                ? '<button type="button" class="skm-btn skm-btn-sm skm-btn-danger" data-a="confirm-del">Confirm delete</button>' +
                  '<button type="button" class="skm-btn skm-btn-sm" data-a="cancel-del">Keep</button>'
                : '<button type="button" class="skm-btn skm-btn-sm skm-btn-danger" data-a="del">Delete</button>') +
            '</div></div></div>';
      }).join("");
    }

    function load() {
      return loadSkills().then(function (r) {
        state.loading = false;
        state.signedOut = !!r.signedOut;
        state.missing = !!r.missing;
        state.skills = (r && r.skills) || [];
        refreshCloud();
        renderList();
      });
    }

    function refreshCloud() {
      cloudCache = state.signedOut ? [] : state.skills.map(function (s) {
        return { id: s.id, name: s.name, prompt: s.instructions, description: s.description };
      });
    }

    host.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("[data-a]");
      if (!btn || !host.contains(btn)) return;
      var act = btn.getAttribute("data-a");
      if (act === "new") { state.editing = "new"; state.confirmDeleteId = null; renderForm(); return; }
      if (act === "save" || act === "cancel") return; // handled by the form
      var card = btn.closest("[data-sid]");
      var id = card ? card.getAttribute("data-sid") : null;
      var skill = id ? state.skills.filter(function (x) { return String(x.id) === String(id); })[0] : null;

      if (act === "use" && skill) {
        if (!useSkillInChat(skill)) setMsg("Chat is not available on this page.", "err");
        return;
      }
      if (act === "edit" && skill) { state.editing = skill; state.confirmDeleteId = null; renderForm(); return; }
      if (act === "del" && skill) { state.confirmDeleteId = skill.id; renderList(); return; }
      if (act === "cancel-del") { state.confirmDeleteId = null; renderList(); return; }
      if (act === "confirm-del" && skill) {
        state.busy = true;
        setMsg("Deleting…");
        deleteSkill(skill.id).then(function () {
          state.skills = state.skills.filter(function (x) { return x.id !== skill.id; });
          state.confirmDeleteId = null;
          state.busy = false;
          refreshCloud();
          setMsg("Deleted “" + skill.name + "”.", "ok");
          renderList();
        }, function (err) {
          state.busy = false;
          setMsg(err && err.message ? err.message : "Delete failed.", "err");
        });
      }
    });

    load();
    return { refresh: load };
  }

  function renderSettingsPane() {
    var pane = document.createElement("div");
    pane.className = "stg-pane";
    mount(pane);
    return pane;
  }

  // ---------- runtime: wiring (Settings pane + sidebar + slash-menu cache) ----------

  function refreshCloudCache() {
    return loadSkills().then(function (r) {
      cloudCache = (r && !r.signedOut && r.skills) ? r.skills.map(function (s) {
        return { id: s.id, name: s.name, prompt: s.instructions, description: s.description };
      }) : [];
      return r;
    }).catch(function () { cloudCache = []; return null; });
  }

  function wire() {
    if (root.SettingsUI && typeof root.SettingsUI.registerPane === "function") {
      root.SettingsUI.registerPane({
        id: "skills",
        label: "Skills",
        icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
        render: renderSettingsPane,
        after: "connectors"
      });
    }
    // Sidebar: the Skills button opens the v1 manager; the legacy prompt-library overlay
    // stays reachable via window.SkillsLibrary (and remains the fallback without SettingsUI).
    if (root.SkillsLibrary && typeof root.SkillsLibrary.open === "function") {
      var legacyOpen = root.SkillsLibrary.open;
      root.SkillsUI = {
        open: function () {
          if (root.SettingsUI && typeof root.SettingsUI.open === "function") root.SettingsUI.open("skills");
          else legacyOpen();
        },
        close: function () {
          if (root.SettingsUI && typeof root.SettingsUI.close === "function") root.SettingsUI.close();
          else if (root.SkillsLibrary && typeof root.SkillsLibrary.close === "function") root.SkillsLibrary.close();
        }
      };
    }
    // NOTE: cloud skills are fetched lazily (when the Skills pane opens, or via SkillsV1.refresh()).
    // No fetch fires on page load: pre-provisioning (before sql/skills.sql is applied) that would
    // mean guaranteed 404s on every page load, which the prelaunch QA gate rightly flags.
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();

  root.SkillsV1 = {
    mount: mount,
    renderPane: renderSettingsPane,
    open: function () { if (root.SettingsUI) root.SettingsUI.open("skills"); },
    useInChat: useSkillInChat,
    list: function () { return loadSkills().then(function (r) { return (r && r.skills) || []; }); },
    save: function (skill, id) { return saveSkill(skill, id); },
    remove: function (id) { return deleteSkill(id); },
    cachedItems: function () { return cloudCache; },
    refresh: refreshCloudCache,
    validateSkillInput: validateSkillInput,
    buildUseInChatMessage: buildUseInChatMessage
  };
})(typeof window !== "undefined" ? window : globalThis);
