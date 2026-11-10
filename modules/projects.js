/* ProjectsUI — Projects manager (Perplexity /projects parity, matrix D5).
   Spaces were renamed Projects; this manages the app's existing ai_spaces data:
   [{id, name, instructions?, ...}] with threads carrying spaceId. No new schema —
   extra fields on a space object (e.g. a default model) are only read, never required.
   Uses app globals when present: spaces, threads, saveSpaces, saveThreads,
   renderSpaces, renderThreads, loadThread, pushThreadToServer, sb, currentUser.
   Exposes window.ProjectsUI = { open, close, edit, openThread }. Esc closes. */
(function () {
  "use strict";
  var LS = window.localStorage;
  var SPACES_KEY = "ai_spaces";
  var THREADS_KEY = "ai_threads";
  var MAX_INSTR = 8000; // Perplexity Project instructions cap

  function jget(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function g(name) { try { return window.__appGlobals ? window.__appGlobals[name] : undefined; } catch (e) { return undefined; } }
  function call(name) { var f = g(name); if (typeof f === "function") { try { return f.apply(null, [].slice.call(arguments, 1)); } catch (e) { console.warn(name, e); } } }
  function uid() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "p" + Date.now() + Math.random().toString(36).slice(2); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>\"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'" : "&#39;" }[c]; }); }

  /* ---------------- App state accessors ---------------- */
  function getSpaces() {
    var s = g("spaces");
    if (Array.isArray(s)) return s;
    return jget(SPACES_KEY, []);
  }
  function getThreads() {
    var t = g("threads");
    if (Array.isArray(t)) return t;
    return jget(THREADS_KEY, []);
  }
  /* Replace the app's `spaces` binding (let-declared global, so indirect eval),
     persist via the app's saveSpaces() when present, else write localStorage. */
  function commitSpaces(list) {
    window.__pjTmp = list;
    var ok = false;
    try { if (window.__appGlobals) { window.__appGlobals.spaces = window.__pjTmp; ok = true; } } catch (e) {}
    delete window.__pjTmp;
    var saved = ok && typeof g("saveSpaces") === "function" ? call("saveSpaces") : undefined;
    if (saved === undefined) jset(SPACES_KEY, list); // no app fn or it threw -> persist ourselves
    call("renderSpaces"); call("renderThreads");
  }
  /* Persist thread changes: app's saveThreads() when present, else localStorage. */
  function commitThreads() {
    if (typeof g("saveThreads") !== "function") jset(THREADS_KEY, getThreads());
    call("saveThreads");
  }
  function serverDeleteSpace(id) {
    var sb = g("sb"), u = g("currentUser");
    if (sb && u) { try { sb.from("spaces").delete().eq("id", id).then(function () {}, function () {}); } catch (e) {} }
  }
  function serverPushThread(t) { call("pushThreadToServer", t); }
  function modelName(s) { return s && (s.model || s.defaultModel || s.default_model) || ""; }
  function threadCount(id) { return getThreads().filter(function (t) { return t.spaceId === id; }).length; }
  function plural(n) { return n === 1 ? "1 thread" : n + " threads"; }

  /* ---------------- Overlay / lifecycle ---------------- */
  var overlay = null, lastFocus = null, pickerOpen = false;
  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
    pickerOpen = false;
    document.removeEventListener("keydown", onEsc, true);
    if (lastFocus && document.body.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }
  function onEsc(e) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    if (pickerOpen) { pickerOpen = false; render(); return; }
    close();
  }
  function panel() { return overlay && overlay.firstChild; }

  function open() {
    close();
    lastFocus = document.activeElement;
    overlay = document.createElement("div");
    overlay.className = "pj-overlay";
    overlay.innerHTML = '<div class="pj-panel" role="dialog" aria-modal="true" aria-label="Projects" tabindex="-1"></div>';
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    (document.getElementById("moduleRoot") || document.body).appendChild(overlay);
    document.addEventListener("keydown", onEsc, true);
    view = { mode: "list" };
    render();
    var p = panel(); if (p) p.focus();
  }

  /* edit(id?) — no id (or unknown id) opens the editor for a NEW project. */
  function edit(id) {
    if (!overlay) open();
    var s = id ? getSpaces().filter(function (x) { return x.id === id; })[0] : null;
    view = {
      mode: "edit",
      isNew: !s,
      id: s ? s.id : uid(),
      name: s ? s.name : "",
      instructions: s ? (s.instructions || "") : "",
      // working copy of this project's thread assignments (deferred until Save)
      assigned: s ? getThreads().filter(function (t) { return t.spaceId === s.id; }).map(function (t) { return t.id; }) : []
    };
    render();
    var n = panel() && panel().querySelector('[data-f="name"]');
    if (n) n.focus();
  }

  function openThread(threadId) {
    close();
    call("loadThread", threadId);
  }

  /* ---------------- Views ---------------- */
  var view = { mode: "list" };

  function render() {
    var p = panel(); if (!p) return;
    if (view.mode === "list") renderList(p);
    else renderEditor(p);
  }

  function renderList(p) {
    var spaces = getSpaces();
    var cards = spaces.map(function (s) {
      var n = threadCount(s.id);
      var instr = (s.instructions || "").replace(/\s+/g, " ").trim();
      var m = modelName(s);
      return '<div class="pj-card" data-id="' + esc(s.id) + '" tabindex="0" role="button" aria-label="Open project ' + esc(s.name) + '">' +
        '<div class="pj-card-top"><span class="pj-card-icon" aria-hidden="true">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' +
        "</span><span class=\"pj-card-name\">" + esc(s.name || "Untitled project") + "</span></div>" +
        (m ? '<span class="pj-badge">' + esc(m) + "</span>" : "") +
        '<div class="pj-card-desc">' + (instr ? esc(instr.slice(0, 160)) + (instr.length > 160 ? "…" : "") : "No instructions") + "</div>" +
        '<div class="pj-card-meta"><span class="pj-count">' + esc(plural(n)) + "</span>" +
        '<button class="pj-btn" data-a="edit" data-id="' + esc(s.id) + '" aria-label="Edit project">Edit</button></div></div>';
    }).join("");
    p.innerHTML =
      '<div class="pj-head"><h2>Projects</h2><span class="pj-count-label">' + esc(spaces.length ? plural(spaces.length).replace("thread", "project") : "0 projects") + "</span>" +
      '<button class="pj-btn primary" data-a="new">+ New project</button>' +
      '<button class="pj-btn icon" data-a="close" aria-label="Close projects">✕</button></div>' +
      '<div class="pj-body"><p class="pj-sub">Projects group your threads and carry instructions that apply to every thread inside them.</p>' +
      '<div class="pj-grid">' + (cards || '<div class="pj-empty">No projects yet. Create your first one.</div>') + "</div></div>";
    p.onclick = function (e) {
      var b = e.target.closest("button[data-a]");
      if (b) {
        var a = b.dataset.a;
        if (a === "close") close();
        else if (a === "new") edit();
        else if (a === "edit") edit(b.dataset.id);
        return;
      }
      var card = e.target.closest(".pj-card");
      if (card) edit(card.dataset.id);
    };
    p.onkeydown = function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("pj-card")) {
        e.preventDefault(); edit(e.target.dataset.id);
      }
    };
  }

  function renderEditor(p) {
    var threads = getThreads();
    var assignedSet = {};
    view.assigned.forEach(function (id) { assignedSet[id] = true; });
    var projThreads = threads.filter(function (t) { return assignedSet[t.id]; });
    var unassigned = threads.filter(function (t) { return !t.spaceId && view.assigned.indexOf(t.id) < 0; });
    var instrLen = (view.instructions || "").length;

    var rows = projThreads.map(function (t) {
      return '<div class="pj-row"><button type="button" class="pj-row-open" data-open="' + esc(t.id) + '" title="Open thread">' + esc(t.title || "Untitled thread") + "</button>" +
        '<button type="button" class="pj-btn" data-a="unassign" data-id="' + esc(t.id) + '" aria-label="Remove from project">Remove</button></div>';
    }).join("") || '<div class="pj-empty small">No threads in this project yet.</div>';

    var picker = "";
    if (pickerOpen) {
      var picks = unassigned.map(function (t) {
        return '<div class="pj-row"><span class="pj-row-title">' + esc(t.title || "Untitled thread") + "</span>" +
          '<button type="button" class="pj-btn" data-a="assign" data-id="' + esc(t.id) + '" aria-label="Add to project">Add</button></div>';
      }).join("") || '<div class="pj-empty small">No unassigned threads to add.</div>';
      picker = '<div class="pj-picker"><div class="pj-picker-title">Add threads</div>' + picks + "</div>";
    }

    p.innerHTML =
      '<div class="pj-head"><h2>' + (view.isNew ? "New project" : "Project settings") + "</h2>" +
      '<button class="pj-btn icon" data-a="close" aria-label="Close projects">✕</button></div>' +
      '<div class="pj-body"><form class="pj-form">' +
      '<label class="pj-label">Name<input data-f="name" maxlength="80" placeholder="e.g., Oak Street Deals" value="' + esc(view.name) + '" required></label>' +
      '<label class="pj-label">Instructions<textarea data-f="instructions" maxlength="' + MAX_INSTR + '" placeholder="Custom instructions — applied to every thread in this project. E.g.,&#10;&#10;Always answer with tables. Cite rent comps from my own data when relevant.">' + esc(view.instructions) + "</textarea>" +
      '<span class="pj-counter" data-f="counter">' + instrLen.toLocaleString() + " / " + MAX_INSTR.toLocaleString() + "</span></label>" +
      '<div class="pj-section"><div class="pj-section-head"><h3>Threads <span class="pj-count">(' + projThreads.length + ")</span></h3>" +
      '<button type="button" class="pj-btn" data-a="picker">' + (pickerOpen ? "Close picker" : "+ Add threads") + "</button></div>" +
      rows + picker + "</div>" +
      '<div class="pj-form-actions">' +
      (view.isNew ? "" : '<button type="button" class="pj-btn danger" data-a="delete">Delete project</button>') +
      '<span class="pj-spacer"></span>' +
      '<button type="button" class="pj-btn" data-a="cancel">Cancel</button>' +
      '<button type="submit" class="pj-btn primary">Save</button></div>' +
      '<div class="pj-hint">Deleting a project keeps its threads — they just become unassigned.</div>' +
      "</form></div>";

    var form = p.querySelector("form");
    var ta = form.querySelector('[data-f="instructions"]');
    var counter = form.querySelector('[data-f="counter"]');
    ta.addEventListener("input", function () {
      view.instructions = ta.value;
      counter.textContent = ta.value.length.toLocaleString() + " / " + MAX_INSTR.toLocaleString();
    });
    form.querySelector('[data-f="name"]').addEventListener("input", function (e) { view.name = e.target.value; });

    p.onclick = function (e) {
      var b = e.target.closest("button[data-a]");
      if (b) {
        var a = b.dataset.a, id = b.dataset.id;
        if (a === "close") close();
        else if (a === "cancel") { view = { mode: "list" }; render(); }
        else if (a === "picker") { pickerOpen = !pickerOpen; render(); }
        else if (a === "assign" && id) { if (view.assigned.indexOf(id) < 0) view.assigned.push(id); render(); }
        else if (a === "unassign" && id) { view.assigned = view.assigned.filter(function (x) { return x !== id; }); render(); }
        else if (a === "delete") deleteProject();
        return;
      }
      var o = e.target.closest("button[data-open]");
      if (o) openThread(o.dataset.open);
    };

    form.onsubmit = function (e) {
      e.preventDefault();
      var name = (form.querySelector('[data-f="name"]').value || "").trim() || "Untitled project";
      var instructions = (ta.value || "").trim().slice(0, MAX_INSTR);
      var spaces = getSpaces();
      var existing = spaces.filter(function (x) { return x.id === view.id; })[0];
      if (existing) {
        existing.name = name;
        existing.instructions = instructions;
      } else {
        existing = { id: view.id, name: name, instructions: instructions };
        spaces.unshift(existing);
      }
      // Apply deferred thread assignments, then persist everything.
      var moved = false;
      getThreads().forEach(function (t) {
        var inProj = view.assigned.indexOf(t.id) > -1;
        if (inProj && t.spaceId !== view.id) { t.spaceId = view.id; moved = true; serverPushThread(t); }
        else if (!inProj && t.spaceId === view.id) { t.spaceId = null; moved = true; serverPushThread(t); }
      });
      commitSpaces(spaces);
      if (moved) commitThreads();
      view = { mode: "list" };
      pickerOpen = false;
      render();
    };
  }

  function deleteProject() {
    var spaces = getSpaces();
    var s = spaces.filter(function (x) { return x.id === view.id; })[0];
    if (!s) return;
    if (!window.confirm('Delete project "' + (s.name || "Untitled project") + '"? Its threads will be kept and unassigned.')) return;
    var moved = false;
    getThreads().forEach(function (t) { if (t.spaceId === view.id) { t.spaceId = null; moved = true; serverPushThread(t); } });
    commitSpaces(spaces.filter(function (x) { return x.id !== view.id; }));
    if (moved) commitThreads();
    serverDeleteSpace(view.id);
    view = { mode: "list" };
    render();
  }

  window.ProjectsUI = { open: open, close: close, edit: edit, openThread: openThread };
})();
