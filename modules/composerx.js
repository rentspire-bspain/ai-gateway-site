/* ComposerX — @-mention menu for the composers (matrix C10).
   Typing "@" in the landing / search-bar / follow-up input opens a menu of Connectors, Projects
   and past Threads. Picking one removes the "@query" text and adds a reference chip above the
   composer. On send, index.html calls ComposerX.take() which returns
     { mentions:[{type,id,label}], context:"<text spliced onto the outgoing user message>" }
   Exposes window.ComposerX = { take, peek, clear, add, contextFor }. */
(function () {
  "use strict";
  var CONNECTORS = [
    ["gmail", "Gmail"], ["gcal", "Google Calendar"], ["gdrive", "Google Drive"], ["slack", "Slack"],
    ["github", "GitHub"], ["notion", "Notion"], ["dropbox", "Dropbox"], ["stripe", "Stripe"]
  ];
  var INPUTS = ["landingInput", "searchbarInput", "followupInput"];
  var mentions = [], menu = null, items = [], sel = 0, activeInput = null, atStart = -1;

  function g(name) { try { return (0, eval)("typeof " + name + "!==\"undefined\"?" + name + ":undefined"); } catch (e) { return undefined; } }
  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  function arr(x) { return Array.isArray(x) ? x : []; }

  function candidates(q) {
    q = q.toLowerCase();
    var out = [], m = function (s) { return !q || String(s || "").toLowerCase().indexOf(q) !== -1; };
    var have = function (t, id) { return mentions.some(function (x) { return x.type === t && x.id === id; }); };
    CONNECTORS.forEach(function (c) { if (m(c[1]) && !have("connector", c[0])) out.push({ type: "connector", id: c[0], label: c[1] }); });
    arr(g("spaces")).forEach(function (s) { if (s && m(s.name) && !have("project", s.id)) out.push({ type: "project", id: s.id, label: s.name || "Untitled project" }); });
    arr(g("threads")).filter(function (t) { return t && !t.incognito && m(t.title) && !have("thread", t.id); }).slice(0, 40)
      .forEach(function (t) { out.push({ type: "thread", id: t.id, label: t.title || "Untitled thread" }); });
    var per = { connector: 0, project: 0, thread: 0 }, cap = { connector: 4, project: 4, thread: 6 };
    return out.filter(function (x) { return ++per[x.type] <= cap[x.type]; });
  }
  var HEAD = { connector: "Connectors", project: "Projects", thread: "Past threads" };
  var ICON = { connector: "⚡", project: "▣", thread: "💬" };

  function closeMenu() { if (menu) { menu.remove(); menu = null; } items = []; atStart = -1; }
  function place(input) {
    if (!menu) return;
    var r = input.getBoundingClientRect(), mh = menu.offsetHeight, mw = menu.offsetWidth;
    var left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8));
    var below = r.bottom + 6 + mh <= window.innerHeight - 8;
    menu.style.left = left + "px";
    menu.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - mh - 6)) + "px";
  }
  function render(input, q) {
    items = candidates(q); sel = Math.min(sel, Math.max(0, items.length - 1));
    if (!menu) { menu = el("div", "mention-menu"); menu.setAttribute("role", "listbox"); document.body.appendChild(menu); }
    menu.innerHTML = "";
    if (!items.length) menu.appendChild(el("div", "mention-empty", "No matches"));
    var last = "";
    items.forEach(function (it, i) {
      if (it.type !== last) { menu.appendChild(el("div", "mention-head", HEAD[it.type])); last = it.type; }
      var b = el("button", "mention-item" + (i === sel ? " active" : "")); b.type = "button"; b.setAttribute("role", "option");
      b.appendChild(el("b", "", ICON[it.type])); b.appendChild(el("span", "", it.label));
      b.onmousedown = function (e) { e.preventDefault(); pick(i); };
      menu.appendChild(b);
    });
    place(input);
  }
  function onInput(e) {
    var input = e.target, pos = input.selectionStart == null ? input.value.length : input.selectionStart;
    var m = /(^|\s)@([^\s@]{0,30})$/.exec(input.value.slice(0, pos));
    if (!m) { closeMenu(); return; }
    activeInput = input; atStart = pos - m[2].length - 1; sel = 0;
    render(input, m[2]);
  }
  function pick(i) {
    var it = items[i], input = activeInput; if (!it || !input) return;
    var pos = input.selectionStart == null ? input.value.length : input.selectionStart;
    input.value = input.value.slice(0, atStart).replace(/\s+$/, " ") + input.value.slice(pos);
    input.value = input.value.replace(/^\s+/, "");
    closeMenu(); add(it); input.focus();
  }
  function onKey(e) {
    if (!menu) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopImmediatePropagation(); if (items.length) { sel = (sel + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length; render(e.target, ""); /* re-render keeps query below */ rerender(e.target); } }
    else if ((e.key === "Enter" || e.key === "Tab") && items.length) { e.preventDefault(); e.stopImmediatePropagation(); pick(sel); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeMenu(); }
  }
  function rerender(input) {
    var pos = input.selectionStart == null ? input.value.length : input.selectionStart;
    var m = /(^|\s)@([^\s@]{0,30})$/.exec(input.value.slice(0, pos)); if (m) render(input, m[2]);
  }

  /* ---- chips ---- */
  function chipHosts() {
    return ["landingAttachChip", "followupAttachChip"].map(function (id) {
      var anchor = document.getElementById(id); if (!anchor) return null;
      var h = anchor.previousElementSibling && anchor.previousElementSibling.classList.contains("mention-chips") ? anchor.previousElementSibling : null;
      if (!h) { h = el("div", "mention-chips"); anchor.parentNode.insertBefore(h, anchor); }
      return h;
    }).filter(Boolean);
  }
  function drawChips() {
    chipHosts().forEach(function (h) {
      h.innerHTML = "";
      mentions.forEach(function (m, i) {
        var c = el("div", "mention-chip"); c.appendChild(el("b", "", "@")); c.appendChild(el("span", "", m.label)); c.title = HEAD[m.type] + ": " + m.label;
        var x = el("button", "", "×"); x.type = "button"; x.setAttribute("aria-label", "Remove " + m.label);
        x.onclick = function () { mentions.splice(i, 1); drawChips(); }; c.appendChild(x); h.appendChild(c);
      });
    });
  }
  function add(it) { if (mentions.length >= 5) mentions.shift(); mentions.push({ type: it.type, id: it.id, label: it.label }); drawChips(); }

  /* ---- context ---- */
  function clip(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; }
  function contextFor(list) {
    var parts = [];
    list.forEach(function (m) {
      if (m.type === "thread") {
        var t = arr(g("threads")).filter(function (x) { return x && x.id === m.id; })[0]; if (!t) return;
        var ms = arr(t.messages), lu = "", la = "";
        for (var i = ms.length - 1; i >= 0; i--) { if (!la && ms[i].role !== "user") la = ms[i].content; else if (la && !lu && ms[i].role === "user") { lu = ms[i].content; break; } }
        parts.push("Past thread \"" + t.title + "\" — question: " + clip(lu, 200) + " | answer: " + clip(la, 700));
      } else if (m.type === "project") {
        var s = arr(g("spaces")).filter(function (x) { return x && x.id === m.id; })[0]; if (!s) return;
        var tt = arr(g("threads")).filter(function (x) { return x && x.spaceId === s.id; }).slice(0, 5).map(function (x) { return x.title; });
        parts.push("Project \"" + s.name + "\"" + (s.instructions ? " — instructions: " + clip(s.instructions, 600) : "") + (tt.length ? " — recent threads: " + tt.join("; ") : ""));
      } else if (m.type === "connector") {
        parts.push("Use the user's " + m.label + " connector as a source for this question.");
      }
    });
    return parts.length ? "[Referenced context — use it if relevant, do not repeat it verbatim]\n" + parts.map(function (p) { return "- " + p; }).join("\n") + "\n\n" : "";
  }
  function peek() { return mentions.slice(); }
  function clear() { mentions = []; drawChips(); }
  function take() { var list = mentions.slice(); var ctx = contextFor(list); clear(); return { mentions: list, context: ctx }; }

  function init() {
    INPUTS.forEach(function (id) {
      var i = document.getElementById(id); if (!i) return;
      i.addEventListener("keydown", onKey, true);
      i.addEventListener("input", onInput);
      i.addEventListener("blur", function () { setTimeout(closeMenu, 120); });
    });
    window.addEventListener("resize", function () { if (menu && activeInput) place(activeInput); });
    drawChips();
  }
  window.ComposerX = { take: take, peek: peek, clear: clear, add: add, contextFor: contextFor };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
