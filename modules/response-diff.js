/* response-diff.js — Response versioning & diff view (Parity doc §34b) for ai.spaincos.com.
   When a thread has more than one assistant answer, older answers display a version badge
   ("v1", "v2", ...) and a "Compare with latest" action that opens an accessible modal diff
   (Side-by-side + Unified modes) powered by a dependency-free LCS line/token diff. */
(function (root) {
  "use strict";

  var STYLE_ID = "rd-styles";
  var MODAL_ID = "responseDiffModal";
  var DP_CELL_CAP = 4000000;
  var INLINE_TOKEN_CELL_CAP = 25000;

  var rawBySection = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  var overlayEl = null;
  var prevFocus = null;
  var preferredMode = null; // "split" | "unified"

  var DIFF_ICON =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>' +
    "</svg>";

  // ---------------- Pure LCS diff engine ----------------

  function normalizeText(s) {
    return String(s == null ? "" : s).replace(/\r\n?/g, "\n");
  }

  function splitLines(s) {
    var norm = normalizeText(s);
    return norm === "" ? [] : norm.split("\n");
  }

  // Hirschberg linear-space exact LCS fallback for huge inputs (M * N > DP_CELL_CAP).
  function lcsHirschberg(a, b) {
    var pairs = [];
    var stack = [[0, a.length, 0, b.length]];

    function scoreForward(a0, a1, b0, b1) {
      var len = b1 - b0;
      var prev = new Int32Array(len + 1);
      var curr = new Int32Array(len + 1);
      for (var i = a0; i < a1; i++) {
        var ai = a[i];
        for (var j = 1; j <= len; j++) {
          if (ai === b[b0 + j - 1]) {
            curr[j] = prev[j - 1] + 1;
          } else {
            curr[j] = prev[j] >= curr[j - 1] ? prev[j] : curr[j - 1];
          }
        }
        var tmp = prev;
        prev = curr;
        curr = tmp;
        curr.fill(0);
      }
      return prev;
    }

    function scoreBackward(a0, a1, b0, b1) {
      var len = b1 - b0;
      var prev = new Int32Array(len + 1);
      var curr = new Int32Array(len + 1);
      for (var i = a1 - 1; i >= a0; i--) {
        var ai = a[i];
        for (var j = len - 1; j >= 0; j--) {
          if (ai === b[b0 + j]) {
            curr[j] = prev[j + 1] + 1;
          } else {
            curr[j] = prev[j] >= curr[j + 1] ? prev[j] : curr[j + 1];
          }
        }
        var tmp = prev;
        prev = curr;
        curr = tmp;
        curr.fill(0);
      }
      return prev;
    }

    while (stack.length) {
      var frame = stack.pop();
      var a0 = frame[0], a1 = frame[1], b0 = frame[2], b1 = frame[3];
      while (a0 < a1 && b0 < b1 && a[a0] === b[b0]) {
        pairs.push([a0, b0]);
        a0++;
        b0++;
      }
      var tailPairs = [];
      while (a1 > a0 && b1 > b0 && a[a1 - 1] === b[b1 - 1]) {
        a1--;
        b1--;
        tailPairs.push([a1, b1]);
      }
      for (var t = 0; t < tailPairs.length; t++) pairs.push(tailPairs[t]);

      var m = a1 - a0;
      var n = b1 - b0;
      if (m <= 0 || n <= 0) continue;
      if (m === 1) {
        for (var jb = b0; jb < b1; jb++) {
          if (a[a0] === b[jb]) {
            pairs.push([a0, jb]);
            break;
          }
        }
        continue;
      }
      if (n === 1) {
        for (var ia = a0; ia < a1; ia++) {
          if (a[ia] === b[b0]) {
            pairs.push([ia, b0]);
            break;
          }
        }
        continue;
      }
      var mid = a0 + (m >> 1);
      var topScores = scoreForward(a0, mid, b0, b1);
      var botScores = scoreBackward(mid, a1, b0, b1);
      var bestK = 0;
      var bestVal = -1;
      for (var k = 0; k <= n; k++) {
        var v = topScores[k] + botScores[k];
        if (v > bestVal) {
          bestVal = v;
          bestK = k;
        }
      }
      var splitB = b0 + bestK;
      stack.push([mid, a1, splitB, b1]);
      stack.push([a0, mid, b0, splitB]);
    }

    pairs.sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; });
    return pairs;
  }

  // Core sequence diff over two arrays of strings using exact LCS.
  function diffSequence(oldArr, newArr) {
    var m = oldArr.length;
    var n = newArr.length;
    var start = 0;
    while (start < m && start < n && oldArr[start] === newArr[start]) {
      start++;
    }
    var endOld = m;
    var endNew = n;
    while (endOld > start && endNew > start && oldArr[endOld - 1] === newArr[endNew - 1]) {
      endOld--;
      endNew--;
    }

    var ops = [];
    for (var p = 0; p < start; p++) {
      ops.push({ type: "equal", text: oldArr[p], oldIndex: p, newIndex: p });
    }

    var midM = endOld - start;
    var midN = endNew - start;

    if (midM === 0 && midN > 0) {
      for (var ja = start; ja < endNew; ja++) {
        ops.push({ type: "add", text: newArr[ja], oldIndex: -1, newIndex: ja });
      }
    } else if (midN === 0 && midM > 0) {
      for (var id = start; id < endOld; id++) {
        ops.push({ type: "del", text: oldArr[id], oldIndex: id, newIndex: -1 });
      }
    } else if (midM > 0 && midN > 0) {
      if (midM * midN <= DP_CELL_CAP) {
        var stride = midN + 1;
        var dp = new Int32Array((midM + 1) * stride);
        for (var i = midM - 1; i >= 0; i--) {
          var ai = oldArr[start + i];
          var row = i * stride;
          var nextRow = (i + 1) * stride;
          for (var j = midN - 1; j >= 0; j--) {
            if (ai === newArr[start + j]) {
              dp[row + j] = dp[nextRow + j + 1] + 1;
            } else {
              var down = dp[nextRow + j];
              var right = dp[row + j + 1];
              dp[row + j] = down >= right ? down : right;
            }
          }
        }
        var ci = 0, cj = 0;
        while (ci < midM || cj < midN) {
          if (ci < midM && cj < midN && oldArr[start + ci] === newArr[start + cj]) {
            ops.push({
              type: "equal",
              text: oldArr[start + ci],
              oldIndex: start + ci,
              newIndex: start + cj
            });
            ci++;
            cj++;
          } else if (ci < midM && (cj === midN || dp[(ci + 1) * stride + cj] >= dp[ci * stride + cj + 1])) {
            ops.push({
              type: "del",
              text: oldArr[start + ci],
              oldIndex: start + ci,
              newIndex: -1
            });
            ci++;
          } else {
            ops.push({
              type: "add",
              text: newArr[start + cj],
              oldIndex: -1,
              newIndex: start + cj
            });
            cj++;
          }
        }
      } else {
        var matches = lcsHirschberg(oldArr.slice(start, endOld), newArr.slice(start, endNew));
        var oi = 0, ni = 0;
        for (var k = 0; k < matches.length; k++) {
          var mo = matches[k][0], mn = matches[k][1];
          while (oi < mo) {
            ops.push({ type: "del", text: oldArr[start + oi], oldIndex: start + oi, newIndex: -1 });
            oi++;
          }
          while (ni < mn) {
            ops.push({ type: "add", text: newArr[start + ni], oldIndex: -1, newIndex: start + ni });
            ni++;
          }
          ops.push({ type: "equal", text: oldArr[start + mo], oldIndex: start + mo, newIndex: start + mn });
          oi = mo + 1;
          ni = mn + 1;
        }
        while (oi < midM) {
          ops.push({ type: "del", text: oldArr[start + oi], oldIndex: start + oi, newIndex: -1 });
          oi++;
        }
        while (ni < midN) {
          ops.push({ type: "add", text: newArr[start + ni], oldIndex: -1, newIndex: start + ni });
          ni++;
        }
      }
    }

    var sufLen = m - endOld;
    for (var s = 0; s < sufLen; s++) {
      ops.push({
        type: "equal",
        text: oldArr[endOld + s],
        oldIndex: endOld + s,
        newIndex: endNew + s
      });
    }
    return ops;
  }

  function diffLines(oldText, newText) {
    var oldLines = splitLines(oldText);
    var newLines = splitLines(newText);
    var rawOps = diffSequence(oldLines, newLines);
    var added = 0, removed = 0, unchanged = 0;
    var ops = new Array(rawOps.length);
    for (var i = 0; i < rawOps.length; i++) {
      var op = rawOps[i];
      if (op.type === "add") added++;
      else if (op.type === "del") removed++;
      else unchanged++;
      ops[i] = {
        type: op.type,
        text: op.text,
        oldLine: op.oldIndex >= 0 ? op.oldIndex + 1 : null,
        newLine: op.newIndex >= 0 ? op.newIndex + 1 : null
      };
    }
    return {
      ops: ops,
      stats: {
        added: added,
        removed: removed,
        unchanged: unchanged,
        oldCount: oldLines.length,
        newCount: newLines.length
      },
      identical: added === 0 && removed === 0
    };
  }

  function buildSideBySideRows(ops) {
    var rows = [];
    var i = 0;
    var list = Array.isArray(ops) ? ops : [];
    while (i < list.length) {
      var cur = list[i];
      if (cur.type === "equal") {
        rows.push({ kind: "equal", left: cur, right: cur });
        i++;
        continue;
      }
      var dels = [];
      var adds = [];
      while (i < list.length && list[i].type !== "equal") {
        if (list[i].type === "del") dels.push(list[i]);
        else if (list[i].type === "add") adds.push(list[i]);
        i++;
      }
      var len = Math.max(dels.length, adds.length);
      for (var k = 0; k < len; k++) {
        var l = k < dels.length ? dels[k] : null;
        var r = k < adds.length ? adds[k] : null;
        rows.push({
          kind: l && r ? "change" : l ? "del" : "add",
          left: l,
          right: r
        });
      }
    }
    return rows;
  }

  function diffInlineTokens(oldLine, newLine) {
    var a = String(oldLine == null ? "" : oldLine);
    var b = String(newLine == null ? "" : newLine);
    if (!a || !b || a === b) {
      return {
        left: [{ text: a, changed: a !== b && !!a }],
        right: [{ text: b, changed: a !== b && !!b }]
      };
    }
    var tokA = a.match(/\S+|\s+/g) || [a];
    var tokB = b.match(/\S+|\s+/g) || [b];
    if (tokA.length * tokB.length > INLINE_TOKEN_CELL_CAP) {
      return {
        left: [{ text: a, changed: true }],
        right: [{ text: b, changed: true }]
      };
    }
    var seq = diffSequence(tokA, tokB);
    var left = [];
    var right = [];
    function pushSeg(arr, txt, changed) {
      if (!txt) return;
      if (arr.length && arr[arr.length - 1].changed === changed) {
        arr[arr.length - 1].text += txt;
      } else {
        arr.push({ text: txt, changed: changed });
      }
    }
    for (var i = 0; i < seq.length; i++) {
      var op = seq[i];
      if (op.type === "equal") {
        pushSeg(left, op.text, false);
        pushSeg(right, op.text, false);
      } else if (op.type === "del") {
        pushSeg(left, op.text, true);
      } else if (op.type === "add") {
        pushSeg(right, op.text, true);
      }
    }
    return { left: left, right: right };
  }

  function formatUnifiedDiff(oldText, newText, opts) {
    var o = opts || {};
    var fromLabel = o.fromLabel || "v1";
    var toLabel = o.toLabel || "latest";
    var res = diffLines(oldText, newText);
    var out = ["--- " + fromLabel, "+++ " + toLabel];
    for (var i = 0; i < res.ops.length; i++) {
      var op = res.ops[i];
      var prefix = op.type === "add" ? "+ " : op.type === "del" ? "- " : "  ";
      out.push(prefix + op.text);
    }
    return out.join("\n");
  }

  // ---------------- App state & thread answer resolution ----------------

  function readAppState() {
    var ag = root && root.__appGlobals;
    var thList = null;
    var tid = null;
    if (ag) {
      try { thList = ag.threads; } catch (e) {}
      try { tid = ag.currentThreadId; } catch (e2) {}
    }
    if (!Array.isArray(thList)) {
      try {
        if (typeof threads !== "undefined" && Array.isArray(threads)) thList = threads;
      } catch (e3) {}
    }
    if (!tid) {
      try {
        if (typeof currentThreadId !== "undefined" && currentThreadId) tid = currentThreadId;
      } catch (e4) {}
    }
    if (!Array.isArray(thList) && root && root.localStorage) {
      try {
        var parsed = JSON.parse(root.localStorage.getItem("ai_threads") || "[]");
        if (Array.isArray(parsed)) thList = parsed;
      } catch (e5) {}
    }
    var activeThread = null;
    if (Array.isArray(thList)) {
      if (tid) {
        for (var i = 0; i < thList.length; i++) {
          if (thList[i] && thList[i].id === tid) {
            activeThread = thList[i];
            break;
          }
        }
      }
      if (!activeThread && root && root.location && root.location.pathname) {
        var m = /^\/t\/([^/?#]+)/.exec(root.location.pathname);
        if (m) {
          var slugOrId = decodeURIComponent(m[1]);
          for (var j = 0; j < thList.length; j++) {
            if (thList[j] && (thList[j].slug === slugOrId || thList[j].id === slugOrId)) {
              activeThread = thList[j];
              break;
            }
          }
        }
      }
    }
    return { threads: thList || [], currentThreadId: tid || (activeThread && activeThread.id) || null, thread: activeThread };
  }

  function directAnswerSections(container) {
    if (!container) return [];
    var out = [];
    var kids = container.children || [];
    for (var i = 0; i < kids.length; i++) {
      var ch = kids[i];
      if (ch && ch.classList && ch.classList.contains("answer-section")) {
        out.push(ch);
      }
    }
    return out;
  }

  function cleanQuestion(q) {
    return String(q || "").split("\n\n[Attached")[0].trim();
  }

  function questionAboveSection(sec) {
    var p = sec && sec.previousElementSibling;
    while (p) {
      if (p.classList && p.classList.contains("question-header")) {
        return String(p.textContent || "").trim();
      }
      p = p.previousElementSibling;
    }
    return "";
  }

  function fallbackSectionMarkdown(sec) {
    if (rawBySection && rawBySection.has(sec)) {
      return rawBySection.get(sec);
    }
    var ac = sec && sec.querySelector ? sec.querySelector(".answer-content") : null;
    if (!ac) return "";
    return String(ac.innerText || ac.textContent || "").trim();
  }

  function hasOlderTurnsButton(container) {
    if (!container || !container.children) return false;
    for (var i = 0; i < container.children.length; i++) {
      var ch = container.children[i];
      if (ch && ch.classList && ch.classList.contains("older-turns-btn")) return true;
    }
    return false;
  }

  // Build ordered version list [{ index, versionLabel, content, question, model, section }]
  function collectThreadVersions(container, explicitThread) {
    var state = readAppState();
    var th = explicitThread !== undefined ? explicitThread : state.thread;
    var sections = directAnswerSections(container);
    var msgEntries = [];

    if (th && Array.isArray(th.messages)) {
      var lastUserQ = "";
      for (var i = 0; i < th.messages.length; i++) {
        var m = th.messages[i];
        if (!m) continue;
        if (m.role === "user") {
          lastUserQ = cleanQuestion(m.content);
        } else {
          var body = String(m.content || "");
          if (!body.trim()) continue;
          msgEntries.push({
            content: body,
            question: lastUserQ,
            model: m.servedModel || m.model || ""
          });
        }
      }
    }

    var versions = [];
    if (msgEntries.length > 0) {
      var truncated = hasOlderTurnsButton(container) && msgEntries.length > sections.length;
      var domOffset = truncated ? msgEntries.length - sections.length : 0;
      var total = Math.max(msgEntries.length, domOffset + sections.length);

      for (var k = 0; k < total; k++) {
        var secIdx = k - domOffset;
        var sec = secIdx >= 0 && secIdx < sections.length ? sections[secIdx] : null;
        var msg = k < msgEntries.length ? msgEntries[k] : null;
        var md = msg ? msg.content : fallbackSectionMarkdown(sec);
        var q = (msg && msg.question) || (sec ? questionAboveSection(sec) : "");
        versions.push({
          index: k,
          version: k + 1,
          label: "v" + (k + 1),
          content: md,
          question: q,
          model: (msg && msg.model) || "",
          section: sec
        });
      }
    } else {
      for (var s = 0; s < sections.length; s++) {
        var sEl = sections[s];
        versions.push({
          index: s,
          version: s + 1,
          label: "v" + (s + 1),
          content: fallbackSectionMarkdown(sEl),
          question: questionAboveSection(sEl),
          model: "",
          section: sEl
        });
      }
    }
    return versions;
  }

  // ---------------- Styles ----------------

  function ensureStyles(doc) {
    doc = doc || (typeof document !== "undefined" ? document : null);
    if (!doc || !doc.head || doc.getElementById(STYLE_ID)) return;
    var st = doc.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      ".answer-label.rd-has-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
      ".rd-turn-meta{display:inline-flex;align-items:center;gap:6px;text-transform:none;letter-spacing:normal;font-weight:500}" +
      ".rd-ver-badge{display:inline-flex;align-items:center;justify-content:center;padding:1px 8px;border-radius:999px;font-size:11.5px;font-weight:600;font-family:var(--font-sans);font-variant-numeric:tabular-nums;background:var(--accent-light);color:var(--citation-text,var(--accent));border:1px solid var(--border-light);line-height:1.45;cursor:pointer;transition:border-color .15s ease,background .15s ease}" +
      ".rd-ver-badge:hover,.rd-ver-badge:focus-visible{border-color:var(--accent);outline:none}" +
      ".rd-compare-btn{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:500;font-family:var(--font-sans);color:var(--text-muted);background:var(--bg-elevated);border:1px solid var(--border-light);cursor:pointer;line-height:1.45;transition:color .15s ease,border-color .15s ease,background .15s ease}" +
      ".rd-compare-btn:hover,.rd-compare-btn:focus-visible{color:var(--text);border-color:var(--accent);background:var(--accent-light);outline:none}" +
      ".rd-overlay{position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:var(--font-sans);color:var(--text);animation:rdFade .14s ease}" +
      "@keyframes rdFade{from{opacity:0}to{opacity:1}}" +
      ".rd-modal{background:var(--bg-surface);border:1px solid var(--border-light);border-radius:16px;width:min(1120px,100%);max-height:calc(100dvh - 40px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.45)}" +
      ".rd-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border);flex-wrap:wrap;flex-shrink:0}" +
      ".rd-title-wrap{min-width:0;flex:1 1 220px}" +
      ".rd-title{margin:0;font-size:16px;font-weight:600;letter-spacing:-.01em;color:var(--text)}" +
      ".rd-sub{font-size:12.5px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".rd-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
      ".rd-pair{display:inline-flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:8px;padding:3px 8px;font-size:12.5px}" +
      ".rd-select{background:transparent;color:var(--text);border:0;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;padding:2px 4px;border-radius:4px}" +
      ".rd-select option{background:var(--bg-elevated);color:var(--text)}" +
      ".rd-arrow{color:var(--text-faint);font-size:12px}" +
      ".rd-stats{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}" +
      ".rd-stat{padding:2px 7px;border-radius:6px;border:1px solid var(--border)}" +
      ".rd-stat-add{color:#4ade80;background:rgba(46,160,67,.14);border-color:rgba(46,160,67,.3)}" +
      ".rd-stat-del{color:#f87171;background:rgba(248,81,73,.14);border-color:rgba(248,81,73,.3)}" +
      ".rd-stat-eq{color:var(--text-muted);background:var(--bg-elevated)}" +
      "[data-theme=\"light\"] .rd-stat-add{color:#15803d;background:rgba(22,163,74,.11);border-color:rgba(22,163,74,.28)}" +
      "[data-theme=\"light\"] .rd-stat-del{color:#b91c1c;background:rgba(220,38,38,.10);border-color:rgba(220,38,38,.26)}" +
      ".rd-modes{display:inline-flex;background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:8px;padding:2px}" +
      ".rd-mode-btn{padding:4px 10px;border-radius:6px;font-size:12px;font-weight:500;color:var(--text-muted);background:none;border:0;cursor:pointer;transition:background .12s ease,color .12s ease}" +
      ".rd-mode-btn.active{background:var(--accent-btn,var(--accent));color:#fff}" +
      ".rd-copy-btn{padding:5px 10px;border-radius:8px;font-size:12px;font-weight:500;color:var(--text-muted);background:var(--bg-elevated);border:1px solid var(--border-light);cursor:pointer}" +
      ".rd-copy-btn:hover{color:var(--text);border-color:var(--accent)}" +
      ".rd-close{width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;line-height:1;color:var(--text-muted);background:transparent;border:1px solid transparent;cursor:pointer}" +
      ".rd-close:hover,.rd-close:focus-visible{color:var(--text);background:var(--bg-elevated);border-color:var(--border-light);outline:none}" +
      ".rd-col-heads{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--border);background:var(--bg-elevated);font-size:12px;font-weight:600;color:var(--text-muted);flex-shrink:0}" +
      ".rd-col-head{padding:8px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}" +
      ".rd-col-head:first-child{border-right:1px solid var(--border)}" +
      ".rd-col-q{font-weight:400;color:var(--text-faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".rd-body{overflow:auto;flex:1 1 auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;font-family:ui-monospace,\"SF Mono\",\"Fira Code\",Menlo,Consolas,monospace;font-size:12.5px;line-height:1.55}" +
      ".rd-empty{padding:36px 20px;text-align:center;font-family:var(--font-sans);font-size:14px;color:var(--text-muted)}" +
      ".rd-split{display:flex;flex-direction:column;min-width:100%}" +
      ".rd-srow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border-bottom:1px solid var(--border)}" +
      ".rd-scell{display:grid;grid-template-columns:40px 18px minmax(0,1fr);align-items:stretch;min-width:0}" +
      ".rd-scell:first-child{border-right:1px solid var(--border)}" +
      ".rd-scell.rd-void{background:rgba(127,127,127,.05)}" +
      ".rd-unified{display:flex;flex-direction:column;min-width:100%}" +
      ".rd-urow{display:grid;grid-template-columns:40px 40px 20px minmax(0,1fr);border-bottom:1px solid var(--border);min-width:0}" +
      ".rd-ln{padding:3px 6px;text-align:right;color:var(--text-faint);user-select:none;font-size:11px;font-variant-numeric:tabular-nums;border-right:1px solid var(--border)}" +
      ".rd-sign{padding:3px 0;text-align:center;user-select:none;font-weight:600;color:var(--text-muted);border-right:1px solid var(--border)}" +
      ".rd-txt{padding:3px 10px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;min-width:0}" +
      ".rd-add{background:rgba(46,160,67,.15)}" +
      ".rd-add .rd-ln,.rd-add .rd-sign{background:rgba(46,160,67,.24);color:#4ade80}" +
      ".rd-del{background:rgba(248,81,73,.14)}" +
      ".rd-del .rd-ln,.rd-del .rd-sign{background:rgba(248,81,73,.23);color:#f87171}" +
      ".rd-tok-add{background:rgba(46,160,67,.38);border-radius:3px;padding:0 1px}" +
      ".rd-tok-del{background:rgba(248,81,73,.38);border-radius:3px;padding:0 1px}" +
      "[data-theme=\"light\"] .rd-add{background:rgba(22,163,74,.10)}" +
      "[data-theme=\"light\"] .rd-add .rd-ln,[data-theme=\"light\"] .rd-add .rd-sign{background:rgba(22,163,74,.18);color:#15803d}" +
      "[data-theme=\"light\"] .rd-del{background:rgba(220,38,38,.09)}" +
      "[data-theme=\"light\"] .rd-del .rd-ln,[data-theme=\"light\"] .rd-del .rd-sign{background:rgba(220,38,38,.17);color:#b91c1c}" +
      "[data-theme=\"light\"] .rd-tok-add{background:rgba(22,163,74,.26)}" +
      "[data-theme=\"light\"] .rd-tok-del{background:rgba(220,38,38,.24)}" +
      "@media (max-width:680px){" +
      ".rd-overlay{padding:10px}" +
      ".rd-modal{max-height:calc(100dvh - 20px);border-radius:12px}" +
      ".rd-head{position:relative;padding:12px 44px 12px 14px;gap:8px}" +
      ".rd-close{position:absolute;top:10px;right:10px}" +
      ".rd-mode-btn,.rd-copy-btn,.rd-select{min-height:32px}" +
      ".rd-col-heads{font-size:11px}" +
      ".rd-scell{grid-template-columns:30px 14px minmax(0,1fr)}" +
      ".rd-urow{grid-template-columns:30px 30px 16px minmax(0,1fr)}" +
      ".rd-txt{padding:3px 7px;font-size:12px}" +
      "}";
    doc.head.appendChild(st);
  }

  // ---------------- Modal diff UI ----------------

  function defaultMode() {
    if (preferredMode) return preferredMode;
    var w = root && typeof root.innerWidth === "number" ? root.innerWidth : 1280;
    return w <= 680 ? "unified" : "split";
  }

  function closeDiffModal() {
    if (overlayEl) {
      if (overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
      overlayEl = null;
    }
    if (prevFocus && typeof prevFocus.focus === "function") {
      try { prevFocus.focus(); } catch (e) {}
    }
    prevFocus = null;
  }

  function renderSegmentedText(doc, host, segments, tokCls) {
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (seg.changed) {
        var sp = doc.createElement("span");
        sp.className = tokCls;
        sp.textContent = seg.text;
        host.appendChild(sp);
      } else {
        host.appendChild(doc.createTextNode(seg.text));
      }
    }
  }

  function buildSplitBody(doc, diffRes) {
    var wrap = doc.createElement("div");
    wrap.className = "rd-split";
    var rows = buildSideBySideRows(diffRes.ops);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var rowEl = doc.createElement("div");
      rowEl.className = "rd-srow";

      var inlineToks = r.kind === "change" ? diffInlineTokens(r.left.text, r.right.text) : null;

      // Left cell (older / base)
      var leftCell = doc.createElement("div");
      leftCell.className = "rd-scell" + (r.left ? (r.left.type === "del" ? " rd-del" : "") : " rd-void");
      var lNum = doc.createElement("div");
      lNum.className = "rd-ln";
      lNum.textContent = r.left && r.left.oldLine != null ? String(r.left.oldLine) : "";
      var lSign = doc.createElement("div");
      lSign.className = "rd-sign";
      lSign.textContent = r.left && r.left.type === "del" ? "-" : "";
      var lTxt = doc.createElement("div");
      lTxt.className = "rd-txt";
      if (r.left) {
        if (inlineToks) renderSegmentedText(doc, lTxt, inlineToks.left, "rd-tok-del");
        else lTxt.textContent = r.left.text;
      }
      leftCell.appendChild(lNum);
      leftCell.appendChild(lSign);
      leftCell.appendChild(lTxt);

      // Right cell (latest / target)
      var rightCell = doc.createElement("div");
      rightCell.className = "rd-scell" + (r.right ? (r.right.type === "add" ? " rd-add" : "") : " rd-void");
      var rNum = doc.createElement("div");
      rNum.className = "rd-ln";
      rNum.textContent = r.right && r.right.newLine != null ? String(r.right.newLine) : "";
      var rSign = doc.createElement("div");
      rSign.className = "rd-sign";
      rSign.textContent = r.right && r.right.type === "add" ? "+" : "";
      var rTxt = doc.createElement("div");
      rTxt.className = "rd-txt";
      if (r.right) {
        if (inlineToks) renderSegmentedText(doc, rTxt, inlineToks.right, "rd-tok-add");
        else rTxt.textContent = r.right.text;
      }
      rightCell.appendChild(rNum);
      rightCell.appendChild(rSign);
      rightCell.appendChild(rTxt);

      rowEl.appendChild(leftCell);
      rowEl.appendChild(rightCell);
      wrap.appendChild(rowEl);
    }
    return wrap;
  }

  function buildUnifiedBody(doc, diffRes) {
    var wrap = doc.createElement("div");
    wrap.className = "rd-unified";
    for (var i = 0; i < diffRes.ops.length; i++) {
      var op = diffRes.ops[i];
      var rowEl = doc.createElement("div");
      rowEl.className = "rd-urow" + (op.type === "add" ? " rd-add" : op.type === "del" ? " rd-del" : "");

      var oldLn = doc.createElement("div");
      oldLn.className = "rd-ln";
      oldLn.textContent = op.oldLine != null ? String(op.oldLine) : "";

      var newLn = doc.createElement("div");
      newLn.className = "rd-ln";
      newLn.textContent = op.newLine != null ? String(op.newLine) : "";

      var sign = doc.createElement("div");
      sign.className = "rd-sign";
      sign.textContent = op.type === "add" ? "+" : op.type === "del" ? "-" : " ";

      var txt = doc.createElement("div");
      txt.className = "rd-txt";
      txt.textContent = op.text;

      rowEl.appendChild(oldLn);
      rowEl.appendChild(newLn);
      rowEl.appendChild(sign);
      rowEl.appendChild(txt);
      wrap.appendChild(rowEl);
    }
    return wrap;
  }

  function openDiffModal(opts) {
    var doc = (opts && opts.document) || (typeof document !== "undefined" ? document : null);
    if (!doc || !doc.body) return null;
    ensureStyles(doc);
    closeDiffModal();
    prevFocus = (opts && opts.trigger) || doc.activeElement || null;

    var versions = Array.isArray(opts && opts.versions) && opts.versions.length
      ? opts.versions
      : [
          { index: 0, version: 1, label: (opts && opts.fromLabel) || "v1", content: String((opts && opts.oldText) || ""), question: (opts && opts.question) || "", model: "" },
          { index: 1, version: 2, label: (opts && opts.toLabel) || "v2", content: String((opts && opts.newText) || ""), question: (opts && opts.question) || "", model: "" }
        ];

    var fromIdx = typeof (opts && opts.fromIndex) === "number" ? opts.fromIndex : 0;
    var toIdx = typeof (opts && opts.toIndex) === "number" ? opts.toIndex : versions.length - 1;
    fromIdx = Math.max(0, Math.min(versions.length - 1, fromIdx));
    toIdx = Math.max(0, Math.min(versions.length - 1, toIdx));
    var mode = (opts && opts.mode) || defaultMode();

    var ov = doc.createElement("div");
    ov.className = "rd-overlay";
    ov.id = MODAL_ID;
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-labelledby", "rdModalTitle");
    ov.tabIndex = -1;

    var modal = doc.createElement("div");
    modal.className = "rd-modal";

    // Header
    var head = doc.createElement("div");
    head.className = "rd-head";

    var titleWrap = doc.createElement("div");
    titleWrap.className = "rd-title-wrap";
    var titleEl = doc.createElement("h2");
    titleEl.className = "rd-title";
    titleEl.id = "rdModalTitle";
    titleEl.textContent = "Response diff";
    var subEl = doc.createElement("div");
    subEl.className = "rd-sub";
    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(subEl);

    var controls = doc.createElement("div");
    controls.className = "rd-controls";

    // Version picker pair
    var pair = doc.createElement("div");
    pair.className = "rd-pair";
    var selFrom = doc.createElement("select");
    selFrom.className = "rd-select";
    selFrom.setAttribute("aria-label", "Older response version");
    selFrom.setAttribute("data-rd-role", "from-version");
    var selTo = doc.createElement("select");
    selTo.className = "rd-select";
    selTo.setAttribute("aria-label", "Target response version");
    selTo.setAttribute("data-rd-role", "to-version");

    versions.forEach(function (v, idx) {
      var suffix = idx === versions.length - 1 ? " (latest)" : "";
      var o1 = doc.createElement("option");
      o1.value = String(idx);
      o1.textContent = v.label + suffix;
      if (idx === fromIdx) o1.selected = true;
      selFrom.appendChild(o1);

      var o2 = doc.createElement("option");
      o2.value = String(idx);
      o2.textContent = v.label + suffix;
      if (idx === toIdx) o2.selected = true;
      selTo.appendChild(o2);
    });
    selFrom.value = String(fromIdx);
    selTo.value = String(toIdx);

    var arrow = doc.createElement("span");
    arrow.className = "rd-arrow";
    arrow.textContent = "\u2192";
    pair.appendChild(selFrom);
    pair.appendChild(arrow);
    pair.appendChild(selTo);

    // Stats box
    var statsBox = doc.createElement("div");
    statsBox.className = "rd-stats";

    // Mode toggle (Side-by-side / Unified)
    var modes = doc.createElement("div");
    modes.className = "rd-modes";
    modes.setAttribute("role", "tablist");
    modes.setAttribute("aria-label", "Diff layout");

    var btnSplit = doc.createElement("button");
    btnSplit.type = "button";
    btnSplit.className = "rd-mode-btn";
    btnSplit.setAttribute("role", "tab");
    btnSplit.setAttribute("data-mode", "split");
    btnSplit.textContent = "Side-by-side";

    var btnUnified = doc.createElement("button");
    btnUnified.type = "button";
    btnUnified.className = "rd-mode-btn";
    btnUnified.setAttribute("role", "tab");
    btnUnified.setAttribute("data-mode", "unified");
    btnUnified.textContent = "Unified";

    modes.appendChild(btnSplit);
    modes.appendChild(btnUnified);

    // Copy unified diff button
    var copyBtn = doc.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "rd-copy-btn";
    copyBtn.setAttribute("data-action", "copy-diff");
    copyBtn.textContent = "Copy diff";

    // Close button
    var closeBtn = doc.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "rd-close";
    closeBtn.setAttribute("aria-label", "Close diff view");
    closeBtn.setAttribute("data-action", "close-diff");
    closeBtn.textContent = "\u00d7";

    controls.appendChild(pair);
    controls.appendChild(statsBox);
    controls.appendChild(modes);
    controls.appendChild(copyBtn);
    controls.appendChild(closeBtn);

    head.appendChild(titleWrap);
    head.appendChild(controls);

    // Column subheaders (shown in split mode)
    var colHeads = doc.createElement("div");
    colHeads.className = "rd-col-heads";

    // Body
    var body = doc.createElement("div");
    body.className = "rd-body";

    modal.appendChild(head);
    modal.appendChild(colHeads);
    modal.appendChild(body);
    ov.appendChild(modal);

    var lastDiffText = "";

    function paint() {
      var vFrom = versions[fromIdx] || versions[0];
      var vTo = versions[toIdx] || versions[versions.length - 1];
      var res = diffLines(vFrom.content, vTo.content);

      var fromTag = vFrom.label + (fromIdx === versions.length - 1 ? " (latest)" : "");
      var toTag = vTo.label + (toIdx === versions.length - 1 ? " (latest)" : "");
      lastDiffText = formatUnifiedDiff(vFrom.content, vTo.content, { fromLabel: fromTag, toLabel: toTag });

      var qText = vTo.question || vFrom.question || "";
      subEl.textContent = qText
        ? "Comparing " + fromTag + " with " + toTag + " \u00b7 \u201c" + qText.slice(0, 90) + (qText.length > 90 ? "\u2026" : "") + "\u201d"
        : "Comparing " + fromTag + " with " + toTag + " (markdown line diff)";

      statsBox.textContent = "";
      if (res.identical) {
        var eqBadge = doc.createElement("span");
        eqBadge.className = "rd-stat rd-stat-eq";
        eqBadge.textContent = "Identical (" + res.stats.unchanged + (res.stats.unchanged === 1 ? " line)" : " lines)");
        statsBox.appendChild(eqBadge);
      } else {
        var addBadge = doc.createElement("span");
        addBadge.className = "rd-stat rd-stat-add";
        addBadge.textContent = "+" + res.stats.added;
        var delBadge = doc.createElement("span");
        delBadge.className = "rd-stat rd-stat-del";
        delBadge.textContent = "-" + res.stats.removed;
        statsBox.appendChild(addBadge);
        statsBox.appendChild(delBadge);
      }

      var isSplit = mode === "split";
      btnSplit.classList.toggle("active", isSplit);
      btnSplit.setAttribute("aria-selected", String(isSplit));
      btnUnified.classList.toggle("active", !isSplit);
      btnUnified.setAttribute("aria-selected", String(!isSplit));

      colHeads.textContent = "";
      if (isSplit) {
        colHeads.style.display = "grid";
        var hLeft = doc.createElement("div");
        hLeft.className = "rd-col-head";
        var hLeftTitle = doc.createElement("span");
        hLeftTitle.textContent = fromTag + (vFrom.model ? " \u00b7 " + vFrom.model : "");
        var hLeftLines = doc.createElement("span");
        hLeftLines.className = "rd-col-q";
        hLeftLines.textContent = res.stats.oldCount + (res.stats.oldCount === 1 ? " line" : " lines");
        hLeft.appendChild(hLeftTitle);
        hLeft.appendChild(hLeftLines);

        var hRight = doc.createElement("div");
        hRight.className = "rd-col-head";
        var hRightTitle = doc.createElement("span");
        hRightTitle.textContent = toTag + (vTo.model ? " \u00b7 " + vTo.model : "");
        var hRightLines = doc.createElement("span");
        hRightLines.className = "rd-col-q";
        hRightLines.textContent = res.stats.newCount + (res.stats.newCount === 1 ? " line" : " lines");
        hRight.appendChild(hRightTitle);
        hRight.appendChild(hRightLines);

        colHeads.appendChild(hLeft);
        colHeads.appendChild(hRight);
      } else {
        colHeads.style.display = "none";
      }

      body.textContent = "";
      if (res.ops.length === 0) {
        var empty = doc.createElement("div");
        empty.className = "rd-empty";
        empty.textContent = "Both responses are empty.";
        body.appendChild(empty);
      } else if (isSplit) {
        body.appendChild(buildSplitBody(doc, res));
      } else {
        body.appendChild(buildUnifiedBody(doc, res));
      }
    }

    selFrom.addEventListener("change", function () {
      fromIdx = Number(selFrom.value) || 0;
      paint();
    });
    selTo.addEventListener("change", function () {
      toIdx = Number(selTo.value) || 0;
      paint();
    });
    btnSplit.addEventListener("click", function () {
      mode = "split";
      preferredMode = "split";
      paint();
    });
    btnUnified.addEventListener("click", function () {
      mode = "unified";
      preferredMode = "unified";
      paint();
    });
    copyBtn.addEventListener("click", function () {
      var done = function () {
        copyBtn.textContent = "Copied";
        setTimeout(function () { copyBtn.textContent = "Copy diff"; }, 1400);
      };
      try {
        if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
          root.navigator.clipboard.writeText(lastDiffText).then(done, done);
        } else {
          done();
        }
      } catch (e) {
        done();
      }
    });
    closeBtn.addEventListener("click", closeDiffModal);
    ov.addEventListener("click", function (e) {
      if (e.target === ov) closeDiffModal();
    });

    paint();
    var mountTarget = doc.getElementById("moduleRoot") || doc.body;
    mountTarget.appendChild(ov);
    overlayEl = ov;
    try { closeBtn.focus(); } catch (e) {}
    return ov;
  }

  // ---------------- Thread DOM decoration & wiring ----------------

  var mo = null;
  var scanTimer = null;

  function removeTurnMeta(section) {
    if (!section || !section.querySelectorAll) return;
    var existing = section.querySelectorAll(".rd-turn-meta");
    for (var i = 0; i < existing.length; i++) {
      var node = existing[i];
      var parent = node.parentNode;
      if (parent) {
        parent.removeChild(node);
        if (parent.classList && parent.classList.contains("answer-label")) {
          parent.classList.remove("rd-has-meta");
        }
      }
    }
  }

  function decorateOlderSection(doc, ver, totalVersions) {
    var sec = ver.section;
    if (!sec) return;
    var latestLabel = "v" + totalVersions;
    var labelRow = null;
    if (sec.children) {
      for (var i = 0; i < sec.children.length; i++) {
        if (sec.children[i].classList && sec.children[i].classList.contains("answer-label")) {
          labelRow = sec.children[i];
          break;
        }
      }
    }
    if (!labelRow) {
      labelRow = doc.createElement("div");
      labelRow.className = "answer-label";
      labelRow.textContent = "Answer";
      if (sec.firstChild) sec.insertBefore(labelRow, sec.firstChild);
      else sec.appendChild(labelRow);
    }
    labelRow.classList.add("rd-has-meta");

    var meta = null;
    if (labelRow.children) {
      for (var j = 0; j < labelRow.children.length; j++) {
        if (labelRow.children[j].classList && labelRow.children[j].classList.contains("rd-turn-meta")) {
          meta = labelRow.children[j];
          break;
        }
      }
    }
    if (!meta) {
      meta = doc.createElement("span");
      meta.className = "rd-turn-meta";

      var badge = doc.createElement("span");
      badge.className = "rd-ver-badge";

      var btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "rd-compare-btn";
      btn.setAttribute("data-action", "compare-latest");
      btn.innerHTML = DIFF_ICON + "<span>Compare with latest</span>";

      var openHandler = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var idx = Number(meta.getAttribute("data-rd-index")) || 0;
        var container = sec.parentNode;
        var currentVersions = collectThreadVersions(container);
        if (currentVersions.length < 2) return;
        openDiffModal({
          document: doc,
          versions: currentVersions,
          fromIndex: Math.min(idx, currentVersions.length - 2),
          toIndex: currentVersions.length - 1,
          trigger: btn
        });
      };
      badge.addEventListener("click", openHandler);
      btn.addEventListener("click", openHandler);

      meta.appendChild(badge);
      meta.appendChild(btn);
      labelRow.appendChild(meta);
    }

    meta.setAttribute("data-rd-index", String(ver.index));
    meta.setAttribute("data-rd-version", ver.label);

    var badgeEl = meta.children[0];
    var btnEl = meta.children[1];
    if (badgeEl) {
      if (badgeEl.textContent !== ver.label) badgeEl.textContent = ver.label;
      badgeEl.setAttribute("data-version", ver.label);
      badgeEl.title = "Response " + ver.label + " of " + totalVersions + " \u2014 click to compare with latest (" + latestLabel + ")";
    }
    if (btnEl) {
      btnEl.setAttribute("aria-label", "Compare " + ver.label + " with latest response (" + latestLabel + ")");
      btnEl.title = "Compare " + ver.label + " markdown with " + latestLabel + " (latest)";
    }
  }

  function syncThreadVersions(container, explicitThread) {
    var doc = (container && container.ownerDocument) || (typeof document !== "undefined" ? document : null);
    if (!doc) return [];
    container = container || doc.getElementById("resultsContent");
    if (!container) return [];
    ensureStyles(doc);

    if (mo) mo.disconnect();
    try {
      var versions = collectThreadVersions(container, explicitThread);
      var sections = directAnswerSections(container);
      if (versions.length <= 1) {
        for (var i = 0; i < sections.length; i++) removeTurnMeta(sections[i]);
        return versions;
      }
      for (var k = 0; k < versions.length; k++) {
        var v = versions[k];
        if (!v.section) continue;
        if (k < versions.length - 1) {
          decorateOlderSection(doc, v, versions.length);
        } else {
          removeTurnMeta(v.section);
        }
      }
      return versions;
    } finally {
      if (mo && container) {
        try { mo.observe(container, { childList: true, subtree: true }); } catch (e) {}
      }
    }
  }

  function patchRenderHooks() {
    if (!root) return;

    // 1. Capture exact raw markdown for every rendered .answer-section via renderAnswer
    var origRenderAnswer = root.renderAnswer;
    if (typeof origRenderAnswer === "function" && !origRenderAnswer._rdPatched) {
      var wrappedRenderAnswer = function (container, text) {
        var r = origRenderAnswer.apply(this, arguments);
        try {
          if (rawBySection && container) {
            var secs = directAnswerSections(container);
            var lastSec = secs.length ? secs[secs.length - 1] : null;
            if (lastSec) rawBySection.set(lastSec, String(text || ""));
          }
        } catch (e) {}
        return r;
      };
      wrappedRenderAnswer._rdPatched = true;
      root.renderAnswer = wrappedRenderAnswer;
      try { renderAnswer = wrappedRenderAnswer; } catch (e) {}
    }

    // 2. Sync immediately after renderPriorTurns / renderPriorTurnsFull
    ["renderPriorTurns", "renderPriorTurnsFull"].forEach(function (fnName) {
      var orig = root[fnName];
      if (typeof orig === "function" && !orig._rdPatched) {
        var wrapped = function (content, thread) {
          var r = orig.apply(this, arguments);
          try { syncThreadVersions(content, thread); } catch (e) {}
          return r;
        };
        wrapped._rdPatched = true;
        root[fnName] = wrapped;
        try {
          if (fnName === "renderPriorTurns") renderPriorTurns = wrapped;
          else if (fnName === "renderPriorTurnsFull") renderPriorTurnsFull = wrapped;
        } catch (e2) {}
      }
    });

    // 3. Sync when saveThreads() persists a newly completed live turn
    var origSaveThreads = root.saveThreads;
    if (typeof origSaveThreads === "function" && !origSaveThreads._rdPatched) {
      var wrappedSave = function () {
        var r = origSaveThreads.apply(this, arguments);
        try { syncThreadVersions(); } catch (e) {}
        return r;
      };
      wrappedSave._rdPatched = true;
      root.saveThreads = wrappedSave;
      try { saveThreads = wrappedSave; } catch (e) {}
    }
  }

  var attached = false;
  function attach() {
    if (typeof document === "undefined" || !document.body) return false;
    ensureStyles(document);
    patchRenderHooks();

    if (!attached) {
      attached = true;
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && overlayEl) {
          e.stopPropagation();
          closeDiffModal();
        }
      });
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("load", function () {
          patchRenderHooks();
          syncThreadVersions();
        });
      }
    }

    var target = document.getElementById("resultsContent");
    if (target && !mo && typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(function () {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(function () {
          patchRenderHooks();
          syncThreadVersions(target);
        }, 60);
      });
      mo.observe(target, { childList: true, subtree: true });
    }

    syncThreadVersions(target);
    return true;
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", attach);
    } else {
      attach();
    }
  }

  var api = {
    diffLines: diffLines,
    buildSideBySideRows: buildSideBySideRows,
    diffInlineTokens: diffInlineTokens,
    formatUnifiedDiff: formatUnifiedDiff,
    collectThreadVersions: collectThreadVersions,
    syncThreadVersions: syncThreadVersions,
    open: openDiffModal,
    close: closeDiffModal,
    attach: attach,
    isOpen: function () { return !!overlayEl; },
    _lcsHirschberg: lcsHirschberg
  };

  root.ResponseDiff = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
