// research — Deep Research mode for ai.spaincos.com (Wave 2, matrix B2).
// When the composer's Deep Research pill is active, submissions go to the
// research-jobs edge function as an async job (minutes-long, high effort)
// instead of the inline performSearch. window.ResearchMode.intercept(query)
// returns true when it handled the submission; the orchestrator calls it from
// the submit handlers before performSearch. window.ResearchUI.open() lists
// past research jobs with re-open. Esc cancels the VIEW only — the job keeps
// running server-side.
(function () {
  "use strict";
  var URL_ = "https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/research-jobs";
  var POLL_MS = 5000;
  var MAX_WAIT_MS = 15 * 60 * 1000; // stop polling after 15 min (job continues server-side)

  var panel = null, pollTimer = null, tickTimer = null, escHandler = null;
  var uiRoot = null, uiLastFocus = null;

  function clean(s) {
    if (s == null) return "";
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "").replace(/\uFFFD+/g, " ").trim();
  }
  function esc(s) {
    var d = document.createElement("div"); d.textContent = clean(s); return d.innerHTML;
  }
  function ago(t) {
    if (!t) return "never";
    var s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  function fmtElapsed(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60); s = s % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  // ---- auth + api (same client pattern as monitors.js) ----
  var EXPIRED = "Your session expired — sign in again.";
  function guard() { return window.AuthGuard || null; }
  // dead session: flip the app to the sign-in gate (central AuthGuard) and raise a typed error the callers render
  function authError() {
    var g = guard(); if (g) g.expire();
    var e = new Error(EXPIRED); e.authExpired = true; e.status = 401; return e;
  }
  function api(body) {
    var client = (typeof sb !== "undefined") ? sb : window.sb;
    if (!client || !client.auth || !client.auth.getSession) return Promise.reject(authError());
    return client.auth.getSession().then(function (r) {
      var tok = r && r.data && r.data.session && r.data.session.access_token;
      if (!tok) throw authError();
      return fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(body) });
    }).then(function (res) {
      if (res.authExpired) throw authError(); // set by AuthGuard only after the token AND a refresh were rejected
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) { var e = new Error(clean(j.error || j.message) || "Request failed (" + res.status + ")"); e.status = res.status; throw e; }
        return j;
      });
    });
  }

  function ensureCss() {
    if (document.querySelector('link[href*="research.css"]')) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "modules/research.css"; document.head.appendChild(l);
  }

  // ---- app reachability (index.html classic-script globals are on window) ----
  function appFn(name) { var f = window[name]; return typeof f === "function" ? f : null; }
  function resultsContent() { return document.getElementById("resultsContent"); }
  function enterResultsView() {
    var show = appFn("showResults");
    if (show) show(); else {
      var l = document.getElementById("landing"); if (l) l.style.display = "none";
      var rs = document.getElementById("resultsScroll"); if (rs) rs.style.display = "block";
    }
  }

  // ---- built-in markdown renderer (fallback when marked/DOMPurify are absent;
  // styled identically via the app's .answer-content rules) ----
  function safeUrl(u) {
    var t = String(u || "").trim();
    return /^https?:\/\//i.test(t) ? t : "";
  }
  function mdInline(t) {
    return t
      .replace(/`([^`]+)`/g, function (_, c) { return "<code>" + c + "</code>"; })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,!?)…]|$)/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, txt, url) {
        var u = safeUrl(url); return u ? '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + txt + "</a>" : txt;
      })
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (m, p, u) { return p + '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + "</a>"; });
  }
  function mdToHtml(md) {
    var src = String(md || "").replace(/\r\n/g, "\n").split("\n");
    var out = [], i = 0;
    var flushP = function (buf) {
      if (buf.length) out.push("<p>" + mdInline(buf.join(" ")) + "</p>");
      buf.length = 0;
    };
    var para = [];
    while (i < src.length) {
      var line = src[i];
      if (/^\s*```/.test(line)) { // fenced code block
        flushP(para);
        var code = [], i2 = i + 1;
        while (i2 < src.length && !/^\s*```/.test(src[i2])) { code.push(src[i2]); i2++; }
        out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>");
        i = i2 + 1; continue;
      }
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { flushP(para); out.push("<h" + h[1].length + ">" + mdInline(h[2]) + "</h" + h[1].length + ">"); i++; continue; }
      if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) { flushP(para); out.push("<hr>"); i++; continue; }
      if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(src[i + 1] || "")) { // table
        flushP(para);
        var head = line.split("|").slice(1, -1).map(function (c) { return c.trim(); });
        var rows = [], i3 = i + 2;
        while (i3 < src.length && /^\s*\|.*\|\s*$/.test(src[i3])) { rows.push(src[i3].split("|").slice(1, -1).map(function (c) { return c.trim(); })); i3++; }
        var t = "<table><thead><tr>" + head.map(function (c) { return "<th>" + mdInline(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
        rows.forEach(function (r) { t += "<tr>" + r.map(function (c) { return "<td>" + mdInline(c) + "</td>"; }).join("") + "</tr>"; });
        out.push(t + "</tbody></table>");
        i = i3; continue;
      }
      var q = line.match(/^\s*>\s?(.*)$/);
      if (q) { flushP(para); out.push("<blockquote>" + mdInline(q[1]) + "</blockquote>"); i++; continue; }
      var li = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
      if (li) {
        flushP(para);
        var ordered = /^\s*\d/.test(line), items = [];
        while (i < src.length) {
          var m2 = src[i].match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
          if (!m2) break;
          items.push("<li>" + mdInline(m2[1]) + "</li>"); i++;
        }
        out.push((ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>"));
        continue;
      }
      if (!line.trim()) { flushP(para); i++; continue; }
      para.push(line.trim()); i++;
    }
    flushP(para);
    return out.join("\n");
  }
  function renderMarkdown(el, text) {
    try {
      if (window.marked && window.DOMPurify) {
        el.innerHTML = window.DOMPurify.sanitize(window.marked.parse(text, { breaks: true, gfm: true }));
        return;
      }
    } catch (e) { /* fall through to built-in */ }
    el.innerHTML = mdToHtml(text);
    el.querySelectorAll("table").forEach(function (tbl) {
      var w = document.createElement("div"); w.className = "table-wrap";
      tbl.parentNode.insertBefore(w, tbl); w.appendChild(tbl);
    });
  }

  // ---- sources (mapped to the app's {domain,title,url} shape) ----
  function mapSources(raw) {
    var out = [];
    (Array.isArray(raw) ? raw : []).forEach(function (s) {
      var url = safeUrl(s && s.url);
      if (!url) return;
      var host = ""; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) {}
      out.push({ domain: host, title: clean(s && s.title) || url, url: url });
    });
    return out;
  }
  function renderSources(container, sources) {
    if (!sources.length) return;
    var sec = document.createElement("div");
    sec.className = "sources-section";
    sec.innerHTML = '<div class="sources-row"></div>';
    var row = sec.querySelector(".sources-row");
    sources.forEach(function (s, idx) {
      var card = document.createElement("a");
      card.className = "source-card";
      card.href = s.url; card.target = "_blank"; card.rel = "noopener noreferrer";
      var favicon = document.createElement("div"); favicon.className = "source-favicon";
      favicon.textContent = (s.domain || "?")[0].toUpperCase();
      var domainEl = document.createElement("div"); domainEl.className = "source-domain";
      var numEl = document.createElement("span"); numEl.className = "src-num"; numEl.textContent = String(idx + 1);
      domainEl.insertBefore(numEl, domainEl.firstChild);
      domainEl.appendChild(document.createTextNode(s.domain || ""));
      var titleEl = document.createElement("div"); titleEl.className = "source-title";
      titleEl.textContent = s.title; titleEl.title = s.url;
      card.appendChild(favicon); card.appendChild(domainEl); card.appendChild(titleEl);
      row.appendChild(card);
    });
    container.appendChild(sec);
  }

  // ---- "Save to thread": append to the current thread (app object shape);
  // create one if no thread is active. Falls back to localStorage if the app
  // globals are unreachable. ----
  function saveToThread(question, report, sources) {
    try {
      var list = (typeof threads !== "undefined") ? threads : window.threads;
      var curId = (typeof currentThreadId !== "undefined") ? currentThreadId : window.currentThreadId;
      var create = appFn("createThread"), save = appFn("saveThreads"), render = appFn("renderThreads");
      var thread = null;
      if (Array.isArray(list)) thread = list.filter(function (t) { return t && t.id === curId; })[0];
      if (!thread && create) thread = create(question.slice(0, 60));
      if (!thread) return false;
      thread.messages.push({ role: "user", content: question });
      thread.messages.push({ role: "assistant", content: report, sources: sources, model: "deep-research" });
      thread.updatedAt = Date.now();
      if (save) save();
      if (render) render();
      return true;
    } catch (e) { return false; }
  }

  // ---- progress panel ----
  function stopTimers() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (escHandler) { document.removeEventListener("keydown", escHandler); escHandler = null; }
  }
  function closePanel() {
    stopTimers();
    if (panel) { panel.remove(); panel = null; }
  }
  // Always visible: switch to the results view (the error used to render into a hidden container while the
  // landing page stayed on screen, so a failed submit looked like nothing happened), keep the question on screen.
  function showError(message, question, authExpired) {
    closePanel();
    enterResultsView();
    var content = resultsContent(); if (!content) return;
    if (question && !content.querySelector(".dr-question")) {
      var q = document.createElement("div"); q.className = "dr-question"; q.textContent = question;
      content.innerHTML = ""; content.appendChild(q);
    }
    var errFn = appFn("renderAnswerError");
    var title = authExpired ? "Your session expired" : "Deep Research failed";
    var detail = authExpired ? EXPIRED : message;
    if (errFn) { errFn(content, title, detail, ""); return; }
    var d = document.createElement("div");
    d.className = "dr-error"; d.setAttribute("role", "alert");
    d.textContent = authExpired ? detail : "Deep Research failed: " + detail;
    content.appendChild(d);
  }
  function showPanel(question) {
    closePanel();
    ensureCss();
    enterResultsView();
    var content = resultsContent(); if (!content) return null;
    content.innerHTML = "";
    var q = document.createElement("div"); q.className = "dr-question"; q.textContent = question;
    panel = document.createElement("div");
    panel.className = "dr-panel";
    panel.setAttribute("role", "status");
    panel.innerHTML =
      '<div class="dr-steps">' +
      '<div class="dr-step active" data-step="queued"><span class="dr-dot"></span>Queued</div>' +
      '<div class="dr-step" data-step="researching"><span class="dr-dot"></span>Researching</div>' +
      '<div class="dr-step" data-step="done"><span class="dr-dot"></span>Report</div>' +
      "</div>" +
      '<div class="dr-elapsed" data-el="elapsed">0:00</div>' +
      '<div class="dr-note">Deep Research usually takes 2-6 minutes. Press Esc to hide this — the research continues in the background and you can reopen it from Research jobs.</div>';
    content.appendChild(q);
    content.appendChild(panel);
    var started = Date.now();
    tickTimer = setInterval(function () {
      var el = panel && panel.querySelector('[data-el="elapsed"]');
      if (el) el.textContent = fmtElapsed(Date.now() - started);
    }, 1000);
    // Esc cancels the VIEW only — the job continues server-side.
    escHandler = function (e) { if (e.key === "Escape") closePanel(); };
    document.addEventListener("keydown", escHandler);
    return started;
  }
  function setStep(step) {
    if (!panel) return;
    panel.querySelectorAll(".dr-step").forEach(function (s) {
      var name = s.getAttribute("data-step");
      var active = name === step;
      s.classList.toggle("active", active);
      s.classList.toggle("done", !active && (name === "queued" || (name === "researching" && step === "done")));
    });
  }

  // ---- report rendering (answer + Sources + Save to thread) ----
  function renderReport(job, startedMs) {
    closePanel();
    ensureCss();
    enterResultsView();
    var content = resultsContent(); if (!content) return;
    content.innerHTML = "";
    var question = clean(job.question);
    var q = document.createElement("div"); q.className = "dr-question"; q.textContent = question;
    content.appendChild(q);
    if (startedMs) {
      var stamp = document.createElement("div"); stamp.className = "search-timer";
      stamp.textContent = "Finished " + Math.max(1, Math.round((Date.now() - startedMs) / 1000)) + "s";
      content.appendChild(stamp);
    }
    if (job.status === "error") {
      var d = document.createElement("div"); d.className = "dr-error";
      d.textContent = "Deep Research failed: " + (clean(job.result) || "unknown error");
      content.appendChild(d);
      return;
    }
    var report = String(job.result || "");
    var ansSec = document.createElement("div"); ansSec.className = "answer-section";
    var label = document.createElement("div"); label.className = "answer-label"; label.textContent = "Deep Research";
    var body = document.createElement("div"); body.className = "answer-content dr-answer";
    renderMarkdown(body, report);
    ansSec.appendChild(label); ansSec.appendChild(body);
    var sources = mapSources(job.sources);
    var actions = document.createElement("div"); actions.className = "answer-actions";
    var copyBtn = document.createElement("button"); copyBtn.className = "action-btn"; copyBtn.textContent = "Copy";
    copyBtn.onclick = function () {
      try { navigator.clipboard.writeText(report); } catch (e) {}
      copyBtn.classList.add("active");
      setTimeout(function () { copyBtn.classList.remove("active"); }, 1500);
    };
    var saveBtn = document.createElement("button"); saveBtn.className = "action-btn dr-save"; saveBtn.textContent = "Save to thread";
    saveBtn.onclick = function () {
      var ok = saveToThread(question, report, sources);
      saveBtn.textContent = ok ? "Saved" : "Could not save";
      saveBtn.disabled = true;
    };
    actions.appendChild(copyBtn); actions.appendChild(saveBtn);
    ansSec.appendChild(actions);
    content.appendChild(ansSec);
    renderSources(content, sources);
    var sc = document.getElementById("resultsScroll");
    if (sc) sc.scrollTop = 0;
  }

  // ---- poll loop ----
  function watchJob(jobId, question) {
    var started = Date.now();
    var fails = 0;
    setStep("queued");
    var poll = function () {
      api({ action: "status", id: jobId }).then(function (r) {
        fails = 0;
        var j = r && r.job;
        if (!j) throw new Error("job not found");
        if (j.status === "done" || j.status === "error") {
          api({ action: "result", id: jobId }).then(function (r2) {
            renderReport((r2 && r2.job) || j, started);
          }).catch(function () { renderReport(j, started); });
          stopTimers();
          return;
        }
        if (j.status === "running") setStep("researching");
        if (Date.now() - started > MAX_WAIT_MS) {
          stopTimers();
          if (panel) {
            var note = panel.querySelector(".dr-note");
            if (note) note.textContent = "Still running after 15 minutes — the job continues server-side. Reopen it later from Research jobs.";
          }
        }
      }).catch(function (e) {
        var net = !e.authExpired && !e.status && /failed to fetch|networkerror|load failed|network request failed/i.test(String(e && e.message));
        if (net && ++fails < 4) return; // transient network blip: the job runs server-side, keep polling
        stopTimers();
        showError(net ? "Lost contact with the research service (" + clean(e.message) + "). The job may still be running — reopen it from Research jobs." : clean(e.message), question, e.authExpired);
      });
    };
    poll();
    pollTimer = setInterval(poll, POLL_MS);
  }

  // ---- public: ResearchMode ----
  function active() {
    var pill = document.getElementById("deepResearchToggle");
    return !!(pill && pill.classList.contains("active"));
  }
  function hook() {
    // Mirror the app's own toggle handler (it flips the .active class and the
    // label); we only track state. Called once after the module loads.
    var pill = document.getElementById("deepResearchToggle");
    if (!pill) return false;
    ensureCss();
    return true;
  }
  function submit(question) {
    var q = clean(question);
    return new Promise(function (resolve, reject) {
      if (!q) { reject(new Error("empty question")); return; }
      api({ action: "create", question: q }).then(function (r) {
        var job = r && r.job;
        if (!job || !job.id) throw new Error("Deep Research did not start — the server returned no job id. Nothing was queued; retry in a moment.");
        showPanel(q);
        watchJob(job.id, q);
        resolve(job);
      }).catch(function (e) {
        showError(clean(e.message), q, e.authExpired);
        var g = guard(); if (g && g.stashQuery) g.stashQuery(q);
        reject(e);
      });
    });
  }
  function intercept(query) {
    if (!active()) return false;
    var q = clean(query);
    if (!q) return false;
    submit(q).catch(function () { /* panel already shows the error */ });
    return true;
  }

  // ---- public: ResearchUI (past jobs, re-open) ----
  function uiClose() {
    if (uiRoot) { uiRoot.remove(); uiRoot = null; }
    if (uiLastFocus && uiLastFocus.focus && document.contains(uiLastFocus)) { try { uiLastFocus.focus(); } catch (e) {} }
    uiLastFocus = null;
  }
  function uiOpenJob(id) {
    api({ action: "result", id: id }).then(function (r) {
      var j = r && r.job;
      if (!j) throw new Error("not found");
      uiClose();
      if (j.status === "queued" || j.status === "running") {
        showPanel(clean(j.question));
        watchJob(j.id, clean(j.question));
      } else {
        renderReport(j, null);
      }
    }).catch(function (e) {
      if (uiRoot) {
        var b = uiRoot.querySelector(".dr-ui-body");
        if (b) b.innerHTML = '<div class="dr-err">' + esc(clean(e.message)) + "</div>";
      }
    });
  }
  function uiRender(jobs) {
    if (!uiRoot) return;
    var body = uiRoot.querySelector(".dr-ui-body");
    if (!body) return;
    if (!jobs.length) {
      body.innerHTML = '<div class="dr-empty">No research jobs yet. Toggle Deep Research in the composer and ask a question.</div>';
      return;
    }
    body.innerHTML = jobs.map(function (j) {
      var st = j.status || "queued";
      return '<div class="dr-card" data-id="' + esc(j.id) + '">' +
        '<div class="dr-row"><div class="dr-grow"><div class="dr-name">' + esc(j.question) + "</div>" +
        '<div class="dr-meta">' + esc(st) + " · " + esc(ago(j.created_at)) + "</div></div>" +
        '<button class="dr-btn" data-open="' + esc(j.id) + '">' + (st === "done" || st === "error" ? "Open" : "View") + "</button></div></div>";
    }).join("");
  }
  function uiRefresh() {
    if (!uiRoot) return;
    api({ action: "list" }).then(function (r) { uiRender(r.jobs || []); })
      .catch(function (e) {
        if (uiRoot) {
          var b = uiRoot.querySelector(".dr-ui-body");
          if (b) b.innerHTML = '<div class="dr-err">' + esc(clean(e.message)) + "</div>";
        }
      });
  }
  function uiOpen() {
    if (uiRoot) { uiRefresh(); return; }
    ensureCss();
    uiLastFocus = document.activeElement;
    uiRoot = document.createElement("div");
    uiRoot.className = "dr-ui-root";
    uiRoot.setAttribute("role", "dialog"); uiRoot.setAttribute("aria-modal", "true"); uiRoot.setAttribute("aria-label", "Research jobs");
    uiRoot.innerHTML = '<div class="dr-ui-head"><h2 class="dr-ui-title">Research jobs</h2><span class="dr-grow"></span>' +
      '<button class="dr-btn" data-act="refresh">Refresh</button><button class="dr-x" aria-label="Close">×</button></div>' +
      '<div class="dr-ui-body"><div class="dr-empty">Loading…</div></div>';
    (document.getElementById("moduleRoot") || document.body).appendChild(uiRoot);
    uiRoot.addEventListener("click", function (ev) {
      var x = ev.target.closest(".dr-x");
      if (x) { uiClose(); return; }
      if (ev.target.closest('[data-act="refresh"]')) { uiRefresh(); return; }
      var open = ev.target.closest("[data-open]");
      if (open) uiOpenJob(open.getAttribute("data-open"));
    });
    uiRoot.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { ev.stopPropagation(); uiClose(); }
    });
    uiRefresh();
  }

  window.ResearchMode = { active: active, submit: submit, hook: hook, intercept: intercept };
  window.ResearchUI = { open: uiOpen, close: uiClose };
})();
