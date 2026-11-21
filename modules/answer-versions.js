/* answer-versions.js — Response versioning + diff view for assistant answers (section 34b)
 *
 * Users re-ask the same question inside a thread and get different answers with
 * no way to see what changed. When the open thread holds 2+ assistant answers,
 * each rendered answer gets a small "v2 of 3 · diff vs v1" affordance in its
 * action row (v1 gets a muted "v1 of 3" badge). Clicking opens a modal with a
 * unified line-level diff of that answer against the previous assistant answer
 * in the same thread.
 *
 * Wiring is DOM-only (zero inline-script edits): a MutationObserver on
 * #resultsContent re-scans after every render (renderPriorTurns, live stream
 * ticks, "Show older turns"), and the version data comes from the app's
 * CSP-safe bridge window.__appGlobals (threads / currentThreadId) — the same
 * pattern tool-chips.js and docs-panel.js use.
 *
 * The diff is a small vanilla-JS algorithm (common prefix/suffix trim, then
 * LCS dynamic programming over the remainder, capped; oversized middles fall
 * back to a whole-block replace). No dependencies, no innerHTML with content.
 *
 * COEXISTENCE: master's modules/response-diff.js (§34b, merged while this was
 * in flight) implements the same section. When window.ResponseDiff is present
 * this module stays dormant (never double-decorates answers); set
 * localStorage av_force=1 or ?av=1 to activate it for comparison/testing.
 */
(function (root) {
  "use strict";
  if (root.AnswerVersions && root.AnswerVersions._loaded) return;

  // §34b NOTE: master also ships modules/response-diff.js (window.ResponseDiff —
  // "Compare with latest" badges + split/unified diff modal, merged while this
  // implementation was in flight). While that module is present this one stays
  // DORMANT so answers are never double-decorated. Activate this implementation
  // explicitly for comparison or testing with localStorage av_force=1 or ?av=1.
  function forceEnabled() {
    try {
      /* global location */
      if (typeof location !== "undefined" && /(^|[?&])av=1($|&)/.test(location.search)) return true;
      /* global localStorage */
      if (typeof localStorage !== "undefined" && localStorage.getItem("av_force") === "1") return true;
    } catch (e) { /* storage blocked — stay dormant */ }
    return false;
  }
  if (root.ResponseDiff && !forceEnabled()) {
    root.AnswerVersions = { _loaded: true, dormant: true };
    return;
  }

  /* ---------- answer text normalization (mirrors renderAnswer's rules) ---------- */
  function normalizeAnswer(text) {
    return String(text == null ? "" : text)
      .replace(/\r\n?/g, "\n")
      .replace(/^\s*\[OPS FLEET\]\s*/, "")
      .replace(/'''/g, "```");
  }

  /* ---------- line-level diff (LCS with prefix/suffix trim) ---------- */
  var LCS_CAP = 700; // middle segments beyond this fall back to block-replace

  function lcsDiffMiddle(a, b) {
    var n = a.length, m = b.length, out = [];
    if (!n && !m) return out;
    if (n > LCS_CAP || m > LCS_CAP) {
      // oversized: don't run an O(n*m) DP — mark the whole middle as replaced
      for (var i = 0; i < n; i++) out.push({ t: "del", text: a[i] });
      for (var j = 0; j < m; j++) out.push({ t: "add", text: b[j] });
      return out;
    }
    var W = m + 1;
    var dp = new Int32Array((n + 1) * W); // LCS lengths; Int32Array keeps this cheap
    for (var x = n - 1; x >= 0; x--) {
      for (var y = m - 1; y >= 0; y--) {
        dp[x * W + y] = a[x] === b[y]
          ? dp[(x + 1) * W + y + 1] + 1
          : Math.max(dp[(x + 1) * W + y], dp[x * W + y + 1]);
      }
    }
    var i2 = 0, j2 = 0;
    while (i2 < n && j2 < m) {
      if (a[i2] === b[j2]) { out.push({ t: "ctx", text: a[i2] }); i2++; j2++; }
      else if (dp[(i2 + 1) * W + j2] >= dp[i2 * W + j2 + 1]) { out.push({ t: "del", text: a[i2] }); i2++; }
      else { out.push({ t: "add", text: b[j2] }); j2++; }
    }
    while (i2 < n) { out.push({ t: "del", text: a[i2] }); i2++; }
    while (j2 < m) { out.push({ t: "add", text: b[j2] }); j2++; }
    return out;
  }

  function diffLines(aText, bText) {
    var split = function (t) { t = String(t == null ? "" : t); return t === "" ? [] : t.split("\n"); };
    var A = split(normalizeAnswer(aText));
    var B = split(normalizeAnswer(bText));
    var p = 0; // common prefix
    while (p < A.length && p < B.length && A[p] === B[p]) p++;
    var s = 0; // common suffix (never overlapping the prefix)
    while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
    var out = [];
    for (var i = 0; i < p; i++) out.push({ t: "ctx", text: A[i] });
    out = out.concat(lcsDiffMiddle(A.slice(p, A.length - s), B.slice(p, B.length - s)));
    for (var j = 0; j < s; j++) out.push({ t: "ctx", text: A[A.length - s + j] });
    return out;
  }

  /* ---------- thread state via the CSP-safe bridge ---------- */
  function currentThread() {
    try {
      var g = root.__appGlobals;
      if (!g || !g.currentThreadId) return null;
      var list = g.threads || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === g.currentThreadId) return list[i];
      }
    } catch (e) { /* bridge unavailable — feature stays dormant */ }
    return null;
  }

  function assistantMsgs(thread) {
    var msgs = (thread && thread.messages) || [];
    var out = [];
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (m && m.role !== "user" && String(m.content || "").trim()) out.push(m);
    }
    return out;
  }

  /* ---------- DOM helpers (textContent only — never innerHTML with content) ---------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  /* ---------- decorate rendered answers ---------- */
  function scan() {
    var host = document.getElementById("resultsContent");
    if (!host) return;
    var thread = currentThread();
    if (!thread) return;
    var msgs = assistantMsgs(thread);
    if (msgs.length < 2) return; // versions affordance only when 2+ answers exist
    var secs = [];
    var nodes = host.querySelectorAll(".answer-section");
    for (var i = 0; i < nodes.length; i++) {
      var sec = nodes[i];
      // run-all follow-up cards and any card-embedded answers are ephemeral, not thread turns
      if (sec.closest && sec.closest(".parallel-card")) continue;
      secs.push(sec);
    }
    if (!secs.length) return;
    // threads truncated to the last 40 turns render fewer sections than the
    // thread holds — align from the END so the newest answer keeps its number
    var offset = Math.max(0, msgs.length - secs.length);
    for (var k = 0; k < secs.length; k++) {
      var idx = offset + k;
      if (idx >= msgs.length) continue; // live-streaming partial not yet saved to the thread
      decorate(secs[k], idx + 1, msgs.length, msgs[idx], msgs[idx - 1]);
    }
  }

  function decorate(sec, vNo, total, msg, prevMsg) {
    var stamp = vNo + "/" + total;
    if (sec.__avStamp === stamp) return; // already decorated for this state
    if (sec.__avBadge && sec.__avBadge.parentNode) sec.__avBadge.parentNode.removeChild(sec.__avBadge);
    sec.__avBadge = null;
    var actions = sec.querySelector(".answer-actions");
    if (!actions) return; // no action row (unexpected shape) — skip rather than guess
    var badge;
    if (vNo === 1) {
      badge = el("span", "av-version-badge", "v1 of " + total);
      badge.title = "First answer to this thread";
    } else {
      badge = el("button", "action-btn av-version-btn");
      badge.type = "button";
      var sign = el("span", "av-version-label", "v" + vNo + " of " + total);
      badge.appendChild(sign);
      badge.appendChild(document.createTextNode(" · diff vs v" + (vNo - 1)));
      badge.title = "Compare this answer with the previous answer (v" + (vNo - 1) + ")";
      badge.setAttribute("aria-label", "Show diff of answer version " + vNo + " against version " + (vNo - 1));
      badge.addEventListener("click", function () {
        if (!prevMsg || !String(prevMsg.content || "").trim()) return;
        openDiff(prevMsg, msg, vNo, total);
      });
    }
    actions.insertBefore(badge, actions.firstChild);
    sec.__avBadge = badge;
    sec.__avStamp = stamp;
  }

  /* ---------- diff modal (import-modal-backdrop pattern) ---------- */
  var backdrop = null, bodyEl = null, subEl = null, lastFocus = null;

  function ensureModal() {
    if (backdrop) return;
    backdrop = el("div", "av-backdrop");
    backdrop.id = "avBackdrop";
    var modal = el("div", "av-modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "avTitle");
    var head = el("div", "av-head");
    var headTxt = el("div", "av-headtxt");
    var title = el("div", "av-title", "Answer versions");
    title.id = "avTitle";
    subEl = el("div", "av-sub");
    headTxt.appendChild(title);
    headTxt.appendChild(subEl);
    var close = el("button", "av-close", "\u00d7");
    close.type = "button";
    close.setAttribute("aria-label", "Close diff view");
    close.addEventListener("click", closeModal);
    head.appendChild(headTxt);
    head.appendChild(close);
    bodyEl = el("div", "av-body");
    var legend = el("div", "av-legend");
    var lgAdd = el("span", "av-lg av-lg-add", "+ added");
    var lgDel = el("span", "av-lg av-lg-del", "\u2212 removed");
    legend.appendChild(lgAdd);
    legend.appendChild(lgDel);
    legend.appendChild(el("span", "av-lg", "\u00b7 unchanged lines are collapsed"));
    modal.appendChild(head);
    modal.appendChild(bodyEl);
    modal.appendChild(legend);
    backdrop.appendChild(modal);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && backdrop.classList.contains("open")) closeModal();
    });
    document.body.appendChild(backdrop);
  }

  function closeModal() {
    if (!backdrop || !backdrop.classList.contains("open")) return;
    backdrop.classList.remove("open");
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }

  function openDiff(prevMsg, msg, vNo, total) {
    ensureModal();
    lastFocus = document.activeElement;
    var aText = normalizeAnswer(prevMsg.content);
    var bText = normalizeAnswer(msg.content);
    var ops = diffLines(aText, bText);
    var adds = 0, dels = 0;
    for (var i = 0; i < ops.length; i++) {
      if (ops[i].t === "add") adds++;
      else if (ops[i].t === "del") dels++;
    }
    subEl.textContent = "v" + vNo + " of " + total + " \u00b7 diff vs v" + (vNo - 1) +
      " \u00b7 +" + adds + " \u2212" + dels + " line" + (adds + dels === 1 ? "" : "s");
    bodyEl.textContent = "";
    renderOps(bodyEl, ops);
    backdrop.classList.add("open");
    var closeBtn = backdrop.querySelector(".av-close");
    if (closeBtn) { try { closeBtn.focus(); } catch (e) {} }
  }

  /* unified view: sign column + monospace text, unchanged runs collapsed */
  function renderOps(host, ops) {
    var CTX_EDGE = 3; // context lines kept around each change
    var i = 0;
    while (i < ops.length) {
      if (ops[i].t !== "ctx") {
        host.appendChild(diffRow(ops[i]));
        i++;
        continue;
      }
      var j = i;
      while (j < ops.length && ops[j].t === "ctx") j++;
      var run = j - i;
      if (run <= CTX_EDGE * 2 + 2) {
        for (var k = i; k < j; k++) host.appendChild(diffRow(ops[k]));
      } else {
        for (var k2 = i; k2 < i + CTX_EDGE; k2++) host.appendChild(diffRow(ops[k2]));
        var gap = el("div", "av-gap", "\u22ef " + (run - CTX_EDGE * 2) + " unchanged line" + (run - CTX_EDGE * 2 === 1 ? "" : "s"));
        host.appendChild(gap);
        for (var k3 = j - CTX_EDGE; k3 < j; k3++) host.appendChild(diffRow(ops[k3]));
      }
      i = j;
    }
  }

  function diffRow(op) {
    var row = el("div", "av-ln av-" + op.t);
    var sign = el("span", "av-sign", op.t === "add" ? "+" : op.t === "del" ? "\u2212" : " ");
    var txt = el("span", "av-txt", op.text === "" ? "\u00a0" : op.text);
    row.appendChild(sign);
    row.appendChild(txt);
    return row;
  }

  /* ---------- boot: watch #resultsContent and (re)decorate after every render ---------- */
  var scanTimer = null;
  function schedule() {
    if (scanTimer) return;
    scanTimer = setTimeout(function () {
      scanTimer = null;
      try { scan(); } catch (e) { /* never break the app over a badge */ }
    }, 150);
  }

  function boot() {
    if (typeof document === "undefined") return false; // unit-test / non-DOM context
    var host = document.getElementById("resultsContent");
    if (!host) return false;
    var mo = new MutationObserver(schedule);
    mo.observe(host, { childList: true, subtree: true });
    schedule();
    return true;
  }

  if (typeof document !== "undefined" && !boot() && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  }

  var api = {
    _loaded: true,
    diffLines: diffLines,
    normalizeAnswer: normalizeAnswer,
    scan: scan,
    open: openDiff,
    close: closeModal
  };
  root.AnswerVersions = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
