/* tool-chips.js — Streaming per-tool-call chips for assistant responses (section 34b)
 *
 * Consumes both live SSE gateway events (`x_progress`, `phases`, `x_meta`,
 * `sources`, `assets`, `actions`) and JSON gateway fields (`x_tool_loop`,
 * `x_auto_asset`, `x_phases`, `x_research`, `x_plan`, `x_sources`, `x_assets`,
 * `x_actions`, `x_proposals`) to render each executed step in execution order
 * as a compact single-line chip:
 *   [icon] [tool_name] [ok / failed / running] [ms] [▾]
 * Clicking any chip expands/collapses its detail card (args/summary/output if
 * available, plus the underlying trace entry).
 *
 * Pure vanilla JS, zero dependencies, zero innerHTML (strict textContent +
 * createElementNS SVG construction).
 */
(function (root) {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var uidSeq = 0;

  var SKIP_SEARCH_RE = /direct answer|no web search needed|sources?:\s*off|search skipped|ack_turn|simple_intent/i;
  var DEGRADED_LABEL_RE = /unavailable|failed|couldn.?t|could not|timed out|time-?out|error|rate.?limit/i;
  var GENERIC_INFERRED = {
    google_drive: true,
    slack_search: true,
    github_search: true,
    dropbox_files: true,
    render_status: true,
    supabase_health: true
  };

  function clip(val, max) {
    var s = String(val == null ? "" : val).replace(/\s+/g, " ").trim();
    if (!max || s.length <= max) return s;
    return s.slice(0, max - 1) + "\u2026";
  }

  function formatArgs(raw) {
    if (raw == null || raw === "") return "";
    if (typeof raw === "string") {
      var trimmed = raw.trim();
      if (!trimmed) return "";
      if (trimmed[0] === "{" && trimmed[trimmed.length - 1] === "}") {
        try {
          var parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === "object") return formatArgsObject(parsed);
        } catch (_e) { /* keep raw string */ }
      }
      return clip(trimmed, 400);
    }
    if (typeof raw === "object") return formatArgsObject(raw);
    return clip(String(raw), 400);
  }

  function formatArgsObject(obj) {
    var keys = Object.keys(obj || {});
    if (!keys.length) return "";
    if (keys.length === 1) {
      var v0 = obj[keys[0]];
      if (typeof v0 === "string" || typeof v0 === "number" || typeof v0 === "boolean") {
        return keys[0] + ": " + clip(String(v0), 360);
      }
    }
    try {
      return clip(JSON.stringify(obj), 400);
    } catch (_e) {
      return "";
    }
  }

  function inferFromProgressLabel(rawLabel, kind) {
    var full = String(rawLabel == null ? "" : rawLabel).trim();
    var base = full.replace(/\s+[—-]\s*failed$/i, "").replace(/(?:\u2026|\.{3})$/, "").trim();
    var m;

    if ((m = base.match(/^(?:Searching|Searched):\s*(.+)$/i))) {
      return { tool: "web_search", args: m[1].trim(), summary: full };
    }
    if (/^(?:Searching multiple sources|Searching the web|Searched the web\b)/i.test(base)) {
      return { tool: "web_search", args: "", summary: full };
    }
    if ((m = base.match(/^(?:Researching|Researched|No results):\s*(.+)$/i))) {
      return { tool: "web_search", args: m[1].trim(), summary: full };
    }
    if (/^(?:Reading an email|Read an email)$/i.test(base)) {
      return { tool: "read_email", args: "", summary: full };
    }
    if (/^(?:Reading a page|Read a page)$/i.test(base)) {
      return { tool: "fetch_page", args: "", summary: full };
    }
    if ((m = base.match(/^(?:Reading|Read)\s+(.+)$/i))) {
      return { tool: "fetch_page", args: m[1].trim(), summary: full };
    }
    if (/^Browsing$/i.test(base)) {
      return { tool: "browser_step", args: "", summary: full };
    }
    if ((m = base.match(/^(?:Browsing|Browsed)\s+(.+)$/i))) {
      return { tool: "browser_step", args: m[1].trim(), summary: full };
    }
    if ((m = base.match(/^(?:Fetching|Fetched) asset from\s+(.+)$/i))) {
      return { tool: "fetch_asset", args: m[1].trim(), summary: full };
    }
    if (/^(?:Fetching|Fetched) an? asset/i.test(base)) {
      return { tool: "fetch_asset", args: "", summary: full };
    }
    if (/^(?:Calculating|Calculated)$/i.test(base)) {
      return { tool: "calculator", args: "", summary: full };
    }
    if (/^(?:Running Python|Ran Python|Synthesizing the computation|Computation executed in sandbox|Sandbox run unavailable)/i.test(base)) {
      return { tool: "run_python", args: "", summary: full };
    }
    if (/^Searching your documents$/i.test(base)) {
      return { tool: "search_my_context", args: "", summary: full };
    }
    if (/^Checking your Google Drive$/i.test(base)) {
      return { tool: "google_drive", args: "", summary: full };
    }
    if (/^Checking Slack$/i.test(base)) {
      return { tool: "slack_search", args: "", summary: full };
    }
    if (/^Checking GitHub$/i.test(base)) {
      return { tool: "github_search", args: "", summary: full };
    }
    if (/^Checking Dropbox$/i.test(base)) {
      return { tool: "dropbox_files", args: "", summary: full };
    }
    if (/^Checking Render$/i.test(base)) {
      return { tool: "render_status", args: "", summary: full };
    }
    if (/^Checking Supabase$/i.test(base)) {
      return { tool: "supabase_health", args: "", summary: full };
    }
    if (/^Searching your email$/i.test(base)) {
      return { tool: "search_email", args: "", summary: full };
    }
    if (/^Checking your calendar$/i.test(base)) {
      return { tool: "list_events", args: "", summary: full };
    }
    if (/^Preparing an email/i.test(base)) {
      return { tool: "send_email", args: "", summary: full };
    }
    if (/^Preparing a calendar event/i.test(base)) {
      return { tool: "create_event", args: "", summary: full };
    }
    if ((m = base.match(/^(?:Planning|Planned)\s+(\d+)\s+steps?\b/i))) {
      return { tool: "record_plan", args: m[1] + (m[1] === "1" ? " step" : " steps"), summary: full };
    }
    if (/^Planning$/i.test(base)) {
      return { tool: "record_plan", args: "", summary: full };
    }
    if ((m = base.match(/^(?:Verifying|Verified) step\s*(.*)$/i))) {
      return { tool: "mark_step", args: m[1] ? "step " + m[1].trim() : "", summary: full };
    }
    if ((m = base.match(/^Running\s+([a-z0-9_().-]+)$/i))) {
      return { tool: m[1], args: "", summary: full };
    }
    return {
      tool: kind === "search" ? "web_search" : kind === "read" ? "fetch_page" : kind === "plan" ? "record_plan" : "tool",
      args: "",
      summary: full
    };
  }

  function normalizePlanLines(plan) {
    if (!Array.isArray(plan)) return [];
    return plan.slice(0, 8).map(function (p, idx) {
      if (!p) return "";
      var st = p.status === "done" ? "\u2713" : p.status === "failed" ? "\u2717" : "\u25cb";
      var num = p.n != null ? p.n : (idx + 1);
      var txt = p.text ? (num + ". " + String(p.text)) : String(p.title || "");
      var ev = p.evidence ? (" \u2014 " + String(p.evidence)) : "";
      return clip(st + " " + txt + ev, 240);
    }).filter(Boolean);
  }

  function addUniqueLines(target, lines) {
    if (!Array.isArray(lines) || !lines.length) return;
    lines.forEach(function (ln) {
      var c = clip(ln, 240);
      if (c && target.indexOf(c) < 0 && target.length < 8) target.push(c);
    });
  }

  function createStream() {
    var entries = [];
    var byKey = Object.create(null);
    var seqCounter = 0;
    var expanded = new Set();
    var liveHost = null;
    var tickTimer = null;
    var cachedPhases = [];
    var cachedResearch = null;
    var cachedPlan = null;
    var cachedAssets = [];
    var cachedActions = [];
    var cachedProposals = [];
    var cachedSources = [];

    function upsert(key, group, patch) {
      var item = byKey[key];
      if (!item) {
        item = {
          key: key,
          group: group,
          seq: ++seqCounter,
          tool: patch.tool || "tool",
          status: patch.status || "ok",
          ok: patch.ok != null ? patch.ok : (patch.status === "failed" ? false : patch.status === "running" ? null : true),
          ms: (patch.ms != null && Number.isFinite(Number(patch.ms))) ? Math.max(0, Math.round(Number(patch.ms))) : null,
          round: patch.round != null ? Number(patch.round) : null,
          chars: patch.chars != null ? Number(patch.chars) : null,
          args: patch.args ? formatArgs(patch.args) : "",
          summary: patch.summary ? clip(patch.summary, 300) : "",
          details: Array.isArray(patch.details) ? patch.details.slice(0, 8) : [],
          trace: patch.trace || null,
          startedAt: patch.status === "running" ? Date.now() : null
        };
        byKey[key] = item;
        entries.push(item);
        return item;
      }
      if (patch.tool && (GENERIC_INFERRED[item.tool] || item.tool === "tool" || patch.exactTool)) {
        item.tool = patch.tool;
      }
      if (patch.status) {
        item.status = patch.status;
        if (patch.status !== "running") item.startedAt = null;
        else if (!item.startedAt) item.startedAt = Date.now();
      }
      if (patch.ok !== undefined) item.ok = patch.ok;
      if (patch.ms != null && Number.isFinite(Number(patch.ms))) {
        item.ms = Math.max(0, Math.round(Number(patch.ms)));
      }
      if (patch.round != null) item.round = Number(patch.round);
      if (patch.chars != null) item.chars = Number(patch.chars);
      if (patch.args) {
        var fa = formatArgs(patch.args);
        if (fa) item.args = fa;
      }
      if (patch.summary) item.summary = clip(patch.summary, 300);
      if (Array.isArray(patch.details)) addUniqueLines(item.details, patch.details);
      if (patch.trace) item.trace = patch.trace;
      return item;
    }

    function removeKey(key) {
      if (!byKey[key]) return;
      delete byKey[key];
      entries = entries.filter(function (e) { return e.key !== key; });
    }

    function ingestProgress(xp) {
      if (!xp || typeof xp !== "object") return false;
      var id = String(xp.id || "");
      if (!id || id === "analyze" || id === "draft" || id === "sub" || id.indexOf("agent:council-") === 0) {
        return false;
      }
      var label = String(xp.label || "");
      if (id === "search" && SKIP_SEARCH_RE.test(label)) {
        removeKey("p:search");
        return true;
      }

      var rawState = String(xp.state || "");
      var isRunning = rawState === "running";
      var isFailed = rawState === "failed" || (!isRunning && DEGRADED_LABEL_RE.test(label) && !SKIP_SEARCH_RE.test(label));
      var status = isRunning ? "running" : (isFailed ? "failed" : "ok");
      var ok = isRunning ? null : !isFailed;
      var ms = (!isRunning && xp.ms != null && Number.isFinite(Number(xp.ms))) ? Number(xp.ms) : null;

      if (id === "search") {
        upsert("p:search", 1, {
          tool: "web_search",
          status: status,
          ok: ok,
          ms: ms,
          round: 0,
          summary: label
        });
        return true;
      }

      if (id.indexOf("agent:research-") === 0) {
        var infSub = inferFromProgressLabel(label, "search");
        upsert("p:" + id, 1, {
          tool: "web_search",
          status: status,
          ok: ok,
          ms: ms,
          round: 0,
          args: infSub.args,
          summary: (xp.agent_name ? xp.agent_name + " \u2014 " : "") + label
        });
        return true;
      }

      if (id === "agent:py-verify") {
        upsert("p:py-verify", 3, {
          tool: "run_python",
          exactTool: true,
          status: status,
          ok: ok,
          ms: ms,
          summary: label
        });
        return true;
      }

      if (id === "plan") {
        upsert("p:plan", 2, {
          tool: "record_plan",
          status: status,
          ok: ok,
          ms: ms,
          summary: label
        });
        return true;
      }

      var tm = id.match(/^t(\d+)\.(\d+)$/);
      if (tm) {
        var inf = inferFromProgressLabel(label, String(xp.kind || "tool"));
        upsert("t:" + tm[1] + "." + tm[2], 2, {
          tool: inf.tool,
          status: status,
          ok: ok,
          ms: ms,
          round: Number(tm[1]),
          args: inf.args,
          summary: inf.summary
        });
        return true;
      }

      var infOther = inferFromProgressLabel(label, String(xp.kind || "tool"));
      upsert("p:" + id, 2, {
        tool: infOther.tool,
        status: status,
        ok: ok,
        ms: ms,
        args: infOther.args,
        summary: infOther.summary
      });
      return true;
    }

    function applyPhases(phases) {
      if (!Array.isArray(phases) || !phases.length) return;
      cachedPhases = phases;

      // 1) Pre-loop search & sub-research rows
      phases.forEach(function (p, idx) {
        if (!p || p.kind !== "search") return;
        var lbl = String(p.label || "");
        if (SKIP_SEARCH_RE.test(lbl)) return;
        if (p.agent && String(p.agent).indexOf("research-") === 0) {
          var subInf = inferFromProgressLabel(lbl, "search");
          var subFail = p.failed === true;
          upsert("p:agent:" + p.agent, 1, {
            tool: "web_search",
            status: p.done === false ? "running" : (subFail ? "failed" : "ok"),
            ok: p.done === false ? null : !subFail,
            round: 0,
            args: subInf.args,
            summary: (p.agentName ? p.agentName + " \u2014 " : "") + lbl
          });
          return;
        }
        var items = Array.isArray(p.items) ? p.items.filter(function (x) { return x && x.url; }) : [];
        var cnt = Number(p.count) || items.length;
        var degraded = DEGRADED_LABEL_RE.test(lbl);
        if (cnt > 0 || items.length > 0 || (byKey["p:search"] && lbl)) {
          var srcLines = items.slice(0, 5).map(function (it) {
            return (it.domain ? it.domain + " \u2014 " : "") + String(it.title || it.url || "");
          });
          upsert("p:search", 1, {
            tool: "web_search",
            status: p.done === false ? "running" : (degraded ? "failed" : "ok"),
            ok: p.done === false ? null : !degraded,
            round: 0,
            summary: lbl || ("Searched the web \u2014 " + cnt + (cnt === 1 ? " source" : " sources")),
            details: srcLines
          });
        } else if (idx > 0 && degraded) {
          upsert("p:search", 1, {
            tool: "web_search",
            status: "failed",
            ok: false,
            round: 0,
            summary: lbl
          });
        }
      });

      // 2) Tool-loop summary phase: { kind: "tool", label: "Ran tools (...)", items: [{ title: "tool_name" | "tool_name (failed)" }] }
      var toolPhase = null;
      var pyPhase = null;
      var planPhase = null;
      var assetPhases = [];
      phases.forEach(function (p) {
        if (!p) return;
        var lbl = String(p.label || "");
        if (p.kind === "tool" && /^Ran tools\b/i.test(lbl) && Array.isArray(p.items)) toolPhase = p;
        else if (p.kind === "tool" && /^Ran Python\b/i.test(lbl)) pyPhase = p;
        else if (p.kind === "plan" && Array.isArray(p.items)) planPhase = p;
        else if (p.kind === "read" && /^Fetched\s+/i.test(lbl)) assetPhases.push(p);
      });

      if (toolPhase && Array.isArray(toolPhase.items)) {
        var existingLoop = entries.filter(function (e) { return e.key.indexOf("t:") === 0; });
        if (existingLoop.length) {
          var nonPlanItems = toolPhase.items.filter(function (it) {
            var nm = String((it && it.title) || "").replace(/\s*\(failed\)\s*$/i, "").trim();
            return nm && nm !== "record_plan" && nm !== "mark_step";
          });
          nonPlanItems.forEach(function (it, i) {
            var rawT = String((it && it.title) || "").trim();
            var failed = /\(failed\)\s*$/i.test(rawT);
            var cleanName = rawT.replace(/\s*\(failed\)\s*$/i, "").trim();
            if (existingLoop[i] && cleanName) {
              existingLoop[i].tool = cleanName;
              if (existingLoop[i].status === "running") {
                existingLoop[i].status = failed ? "failed" : "ok";
                existingLoop[i].ok = !failed;
                existingLoop[i].startedAt = null;
              }
            }
          });
        } else if (!entries.some(function (e) { return e.key.indexOf("trace:") === 0; })) {
          toolPhase.items.forEach(function (it, i) {
            var rawT = String((it && it.title) || "").trim();
            if (!rawT) return;
            var failed = /\(failed\)\s*$/i.test(rawT);
            var cleanName = rawT.replace(/\s*\(failed\)\s*$/i, "").trim();
            upsert("phase-tool:" + i, 2, {
              tool: cleanName,
              exactTool: true,
              status: failed ? "failed" : "ok",
              ok: !failed,
              summary: failed ? (cleanName + " (failed)") : ("Executed " + cleanName)
            });
          });
        }
      }

      // 3) Python code/output lines -> attach to run_python chip(s), or create fallback run_python chip
      if (pyPhase) {
        var pyLines = (Array.isArray(pyPhase.items) ? pyPhase.items : []).map(function (it) {
          return String((it && it.title) || "").trim();
        }).filter(Boolean);
        var pyFailed = /failed/i.test(String(pyPhase.label || ""));
        var pyTargets = entries.filter(function (e) { return e.tool === "run_python"; });
        if (pyTargets.length) {
          pyTargets.forEach(function (t) {
            addUniqueLines(t.details, pyLines);
            if (!t.summary) t.summary = String(pyPhase.label || "Ran Python");
          });
        } else {
          upsert("p:py-verify", 3, {
            tool: "run_python",
            exactTool: true,
            status: pyFailed ? "failed" : "ok",
            ok: !pyFailed,
            summary: String(pyPhase.label || "Ran Python"),
            details: pyLines
          });
        }
      }

      // 4) Plan checklist phase
      if (planPhase && Array.isArray(planPhase.items) && planPhase.items.length) {
        var pLines = normalizePlanLines(planPhase.items);
        var planTarget = entries.find(function (e) { return e.tool === "record_plan" || e.tool === "plan"; });
        var anyPlanFail = planPhase.items.some(function (x) { return x && x.status === "failed"; });
        if (planTarget) {
          addUniqueLines(planTarget.details, pLines);
          if (planPhase.label) planTarget.summary = clip(planPhase.label, 300);
        } else {
          upsert("p:plan", 2, {
            tool: "record_plan",
            status: planPhase.done === false ? "running" : (anyPlanFail ? "failed" : "ok"),
            ok: planPhase.done === false ? null : !anyPlanFail,
            summary: String(planPhase.label || "Planned steps"),
            details: pLines
          });
        }
      }

      // 5) Fetched asset phases
      assetPhases.forEach(function (ap, idx) {
        var aLines = (Array.isArray(ap.items) ? ap.items : []).map(function (it) {
          return String((it && (it.title || it.url)) || "").trim();
        }).filter(Boolean);
        var assetTarget = entries.find(function (e) { return e.tool.indexOf("fetch_asset") === 0; });
        if (assetTarget) {
          if (!assetTarget.summary) assetTarget.summary = String(ap.label || "");
          addUniqueLines(assetTarget.details, aLines);
        } else {
          upsert("phase-asset:" + idx, 0, {
            tool: "fetch_asset",
            status: "ok",
            ok: true,
            summary: String(ap.label || "Fetched asset"),
            details: aLines
          });
        }
      });
    }

    function applyToolTrace(toolLoop, autoAssets) {
      // Round 0: auto-fetched assets
      if (Array.isArray(autoAssets) && autoAssets.length) {
        removeKey("phase-asset:0");
        autoAssets.forEach(function (at, i) {
          if (!at || typeof at !== "object") return;
          var okA = at.ok !== false;
          upsert("auto:" + i, 0, {
            tool: String(at.tool || "fetch_asset(auto)"),
            exactTool: true,
            status: okA ? "ok" : "failed",
            ok: okA,
            ms: at.ms,
            round: at.round != null ? at.round : 0,
            chars: at.chars,
            args: at.args || at.arguments || "",
            summary: at.summary || "",
            trace: {
              round: at.round != null ? Number(at.round) : 0,
              tool: String(at.tool || "fetch_asset(auto)"),
              ms: Number(at.ms) || 0,
              ok: okA,
              chars: Number(at.chars) || 0
            }
          });
        });
      }

      if (!toolLoop || !Array.isArray(toolLoop.tools) || !toolLoop.tools.length) return;

      // Remove phase-only synthetic tool entries if authoritative trace arrived
      entries.slice().forEach(function (e) {
        if (e.key.indexOf("phase-tool:") === 0) removeKey(e.key);
      });

      var progressLoop = entries.filter(function (e) { return e.key.indexOf("t:") === 0; });
      var pIdx = 0;

      toolLoop.tools.forEach(function (tr, i) {
        if (!tr || typeof tr !== "object") return;
        var name = String(tr.tool || tr.name || "tool");
        var ok = tr.ok !== false;
        var traceObj = {
          round: tr.round != null ? Number(tr.round) : 1,
          tool: name,
          ms: tr.ms != null ? Math.max(0, Math.round(Number(tr.ms))) : 0,
          ok: ok,
          chars: tr.chars != null ? Number(tr.chars) : 0
        };
        var rawArgs = tr.args != null ? tr.args : (tr.arguments != null ? tr.arguments : tr.input);
        var rawSum = tr.summary || tr.detail || tr.output || tr.error || "";

        // Match against existing live progress entry if present (progress omits record_plan/mark_step)
        if (name === "record_plan" && byKey["p:plan"]) {
          var planItem = byKey["p:plan"];
          planItem.tool = "record_plan";
          planItem.status = ok ? "ok" : "failed";
          planItem.ok = ok;
          planItem.ms = traceObj.ms;
          planItem.round = traceObj.round;
          planItem.chars = traceObj.chars;
          planItem.trace = traceObj;
          planItem.traceOrder = i;
          if (rawArgs) planItem.args = formatArgs(rawArgs);
          if (rawSum) planItem.summary = clip(rawSum, 300);
          return;
        }

        if (name !== "record_plan" && name !== "mark_step" && pIdx < progressLoop.length) {
          var liveItem = progressLoop[pIdx++];
          liveItem.tool = name;
          liveItem.status = ok ? "ok" : "failed";
          liveItem.ok = ok;
          liveItem.ms = traceObj.ms;
          liveItem.round = traceObj.round;
          liveItem.chars = traceObj.chars;
          liveItem.trace = traceObj;
          liveItem.traceOrder = i;
          liveItem.startedAt = null;
          if (rawArgs) liveItem.args = formatArgs(rawArgs);
          if (rawSum) liveItem.summary = clip(rawSum, 300);
          return;
        }

        var created = upsert("trace:" + i, 2, {
          tool: name,
          exactTool: true,
          status: ok ? "ok" : "failed",
          ok: ok,
          ms: traceObj.ms,
          round: traceObj.round,
          chars: traceObj.chars,
          args: rawArgs,
          summary: rawSum,
          trace: traceObj
        });
        created.traceOrder = i;
      });
    }

    function applyEnrichments() {
      // Research metadata enrichment
      if (cachedResearch && typeof cachedResearch === "object") {
        var rSkipped = cachedResearch.skipped;
        var rSources = Number(cachedResearch.sources) || 0;
        var rSubs = Number(cachedResearch.sub_questions) || 0;
        var rLane = cachedResearch.lane ? String(cachedResearch.lane) : "";
        if (!rSkipped && (rSources > 0 || (rLane && rLane !== "none"))) {
          var metaBits = [];
          if (rLane) metaBits.push("lane: " + rLane);
          metaBits.push(rSources + (rSources === 1 ? " source" : " sources"));
          if (rSubs > 0) metaBits.push(rSubs + (rSubs === 1 ? " sub-query" : " sub-queries"));
          var sEntry = upsert("p:search", 1, {
            tool: "web_search",
            status: "ok",
            ok: true,
            round: 0,
            summary: byKey["p:search"] && byKey["p:search"].summary
              ? byKey["p:search"].summary
              : ("Searched the web \u2014 " + metaBits.join(" \u00b7 "))
          });
          addUniqueLines(sEntry.details, ["Research " + metaBits.join(" \u00b7 ")]);
        }
      }

      // Canonical sources enrichment on pre-loop web_search
      if (cachedSources.length && byKey["p:search"] && byKey["p:search"].details.length < 2) {
        var domLines = cachedSources.slice(0, 5).map(function (s) {
          if (!s) return "";
          return (s.domain ? s.domain + " \u2014 " : "") + String(s.title || s.url || "");
        }).filter(Boolean);
        addUniqueLines(byKey["p:search"].details, domLines);
      }

      // x_plan enrichment
      if (Array.isArray(cachedPlan) && cachedPlan.length) {
        var pLines = normalizePlanLines(cachedPlan);
        var planChip = entries.find(function (e) { return e.tool === "record_plan" || e.tool === "plan"; });
        var anyFailed = cachedPlan.some(function (p) { return p && p.status === "failed"; });
        var doneCount = cachedPlan.filter(function (p) { return p && p.status === "done"; }).length;
        if (planChip) {
          addUniqueLines(planChip.details, pLines);
          if (!planChip.summary) {
            planChip.summary = "Planned " + cachedPlan.length + " steps (" + doneCount + "/" + cachedPlan.length + " verified)";
          }
        } else {
          upsert("p:plan", 2, {
            tool: "record_plan",
            status: anyFailed ? "failed" : "ok",
            ok: !anyFailed,
            summary: "Planned " + cachedPlan.length + " steps (" + doneCount + "/" + cachedPlan.length + " verified)",
            details: pLines
          });
        }
        // Enrich mark_step chips with matching plan steps
        var markChips = entries.filter(function (e) { return e.tool === "mark_step"; });
        markChips.forEach(function (mc, idx) {
          var stepObj = cachedPlan[idx];
          if (stepObj && !mc.summary) {
            mc.summary = clip("Step " + (stepObj.n || (idx + 1)) + ": " + String(stepObj.text || "") + (stepObj.evidence ? " \u2014 " + stepObj.evidence : ""), 300);
          }
        });
      }

      // x_assets enrichment
      if (Array.isArray(cachedAssets) && cachedAssets.length) {
        var assetChips = entries.filter(function (e) { return e.tool.indexOf("fetch_asset") === 0 || e.tool === "create_file"; });
        cachedAssets.forEach(function (as, idx) {
          if (!as) return;
          var desc = String(as.name || as.filename || "asset") + (as.bytes ? " (" + as.bytes + " bytes)" : "");
          var target = assetChips[idx] || assetChips[0];
          if (target) addUniqueLines(target.details, [desc]);
        });
      }

      // x_actions enrichment (send_email / create_event approval previews)
      if (Array.isArray(cachedActions) && cachedActions.length) {
        cachedActions.forEach(function (act) {
          if (!act) return;
          var mailChip = entries.find(function (e) { return e.tool === "send_email" || e.tool === "create_event"; });
          if (mailChip) {
            var line = act.subject ? ("Subject: " + act.subject) : (act.title ? ("Event: " + act.title) : "");
            if (line) addUniqueLines(mailChip.details, [line]);
          }
        });
      }

      // x_proposals enrichment (GitHub PR proposals)
      if (Array.isArray(cachedProposals) && cachedProposals.length) {
        cachedProposals.forEach(function (pr) {
          if (!pr || !pr.title) return;
          var ghChip = entries.find(function (e) { return e.tool.indexOf("github") === 0; });
          if (ghChip) addUniqueLines(ghChip.details, ["Proposal: " + pr.title]);
        });
      }
    }

    function orderedList() {
      return entries.slice().sort(function (a, b) {
        if (a.group !== b.group) return a.group - b.group;
        if (a.traceOrder != null && b.traceOrder != null) return a.traceOrder - b.traceOrder;
        return a.seq - b.seq;
      });
    }

    function syncTickTimer() {
      var hasRunning = entries.some(function (e) { return e.status === "running"; });
      if (!hasRunning || !liveHost || !liveHost.isConnected) {
        if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
        return;
      }
      if (tickTimer) return;
      tickTimer = setInterval(function () {
        if (!liveHost || !liveHost.isConnected) {
          clearInterval(tickTimer);
          tickTimer = null;
          return;
        }
        var any = false;
        liveHost.querySelectorAll(".tc-chip.is-run[data-started]").forEach(function (btn) {
          any = true;
          var t0 = Number(btn.getAttribute("data-started")) || 0;
          var msEl = btn.querySelector(".tc-ms");
          if (msEl && t0 > 0) msEl.textContent = Math.max(0, Date.now() - t0) + "ms";
        });
        if (!any) { clearInterval(tickTimer); tickTimer = null; }
      }, 200);
    }

    function mountInSearching(stateEl) {
      if (!stateEl || !stateEl.isConnected) return;
      var list = orderedList();
      var slot = stateEl.querySelector(".tool-chips.in-searching");
      if (!list.length) {
        if (slot) slot.remove();
        return;
      }
      if (!slot) {
        slot = stateEl.ownerDocument.createElement("div");
        slot.className = "tool-chips in-searching";
        slot.setAttribute("role", "region");
        slot.setAttribute("aria-label", "Streaming tool calls");
        var phasesBox = stateEl.querySelector(".searching-phases");
        if (phasesBox && phasesBox.parentNode === stateEl) stateEl.insertBefore(slot, phasesBox);
        else stateEl.appendChild(slot);
      }
      liveHost = slot;
      populateContainer(slot, list, expanded);
      syncTickTimer();
    }

    function ingestSSE(evt, stateEl) {
      if (!evt || typeof evt !== "object") return;
      var changed = false;
      if (evt.x_progress) {
        if (ingestProgress(evt.x_progress)) changed = true;
      }
      if (Array.isArray(evt.sources) && evt.sources.length) {
        cachedSources = evt.sources;
        changed = true;
      }
      if (Array.isArray(evt.assets) && evt.assets.length) {
        cachedAssets = evt.assets;
        changed = true;
      }
      if (Array.isArray(evt.actions) && evt.actions.length) {
        cachedActions = evt.actions;
        changed = true;
      }
      if (Array.isArray(evt.phases)) {
        applyPhases(evt.phases);
        changed = true;
      }
      if (evt.x_tool_loop) {
        applyToolTrace(evt.x_tool_loop, evt.x_auto_asset);
        changed = true;
      }
      if (evt.x_meta && typeof evt.x_meta === "object") {
        if (evt.x_meta.x_research) cachedResearch = evt.x_meta.x_research;
        if (Array.isArray(evt.x_meta.x_plan)) cachedPlan = evt.x_meta.x_plan;
        if (evt.x_meta.x_tool_loop) applyToolTrace(evt.x_meta.x_tool_loop, evt.x_meta.x_auto_asset);
        changed = true;
      }
      if (changed) {
        applyEnrichments();
        if (stateEl) mountInSearching(stateEl);
      }
    }

    function ingestJSON(data) {
      if (!data || typeof data !== "object") return;
      if (data.x_research) cachedResearch = data.x_research;
      if (Array.isArray(data.x_plan)) cachedPlan = data.x_plan;
      if (Array.isArray(data.x_sources)) cachedSources = data.x_sources;
      if (Array.isArray(data.x_assets)) cachedAssets = data.x_assets;
      if (Array.isArray(data.x_actions)) cachedActions = data.x_actions;
      if (Array.isArray(data.x_proposals)) cachedProposals = data.x_proposals;
      applyToolTrace(data.x_tool_loop, data.x_auto_asset);
      if (Array.isArray(data.x_phases)) applyPhases(data.x_phases);
      applyEnrichments();
    }

    function finalize(extra) {
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      if (extra && typeof extra === "object") {
        if (Array.isArray(extra.sources) && extra.sources.length && !cachedSources.length) cachedSources = extra.sources;
        if (Array.isArray(extra.phases) && extra.phases.length && !cachedPhases.length) applyPhases(extra.phases);
        applyEnrichments();
      }
      // Settle any still-running chip when the response finishes
      entries.forEach(function (e) {
        if (e.status === "running") {
          if (e.ms == null && e.startedAt) e.ms = Math.max(0, Date.now() - e.startedAt);
          e.status = "ok";
          e.ok = true;
          e.startedAt = null;
        }
      });
      return serializeList(orderedList());
    }

    return {
      expanded: expanded,
      ingestSSE: ingestSSE,
      ingestJSON: ingestJSON,
      list: function () { return orderedList(); },
      finalize: finalize,
      setLiveHost: function (el) { liveHost = el; syncTickTimer(); }
    };
  }

  function serializeList(list) {
    return (list || []).slice(0, 24).map(function (c, idx) {
      var out = {
        id: String(c.key || c.id || ("c" + idx)).slice(0, 40),
        tool: clip(c.tool || "tool", 60),
        status: c.status === "failed" || c.ok === false ? "failed" : "ok",
        ok: !(c.status === "failed" || c.ok === false)
      };
      if (c.ms != null && Number.isFinite(Number(c.ms))) out.ms = Math.max(0, Math.round(Number(c.ms)));
      if (c.round != null && Number.isFinite(Number(c.round))) out.round = Number(c.round);
      if (c.chars != null && Number.isFinite(Number(c.chars))) out.chars = Number(c.chars);
      if (c.args) out.args = clip(c.args, 400);
      if (c.summary) out.summary = clip(c.summary, 300);
      if (Array.isArray(c.details) && c.details.length) out.details = c.details.slice(0, 8).map(function (d) { return clip(d, 240); });
      if (c.trace && typeof c.trace === "object") out.trace = c.trace;
      return out;
    });
  }

  function extract(payload) {
    var s = createStream();
    s.ingestJSON(payload || {});
    return s.finalize();
  }

  function fromLegacySteps(steps) {
    if (!Array.isArray(steps) || !steps.length) return [];
    var hasExec = steps.some(function (p) {
      if (!p) return false;
      if (p.kind === "tool" || p.kind === "plan") return true;
      if (p.kind === "read" && /^Fetched\s+/i.test(String(p.label || ""))) return true;
      if (p.kind === "search" && Array.isArray(p.items) && p.items.length > 0) return true;
      return false;
    });
    if (!hasExec) return [];
    var s = createStream();
    s.ingestSSE({ phases: steps }, null);
    return s.finalize();
  }

  function resolveChips(meta) {
    if (!meta || typeof meta !== "object") return [];
    if (meta.toolStream && typeof meta.toolStream.list === "function") {
      var live = meta.toolStream.list();
      if (live.length) return live;
    }
    if (Array.isArray(meta.toolChips) && meta.toolChips.length) return meta.toolChips;
    if (meta.x_tool_loop || meta.x_research || meta.x_plan || meta.x_phases) return extract(meta);
    if (Array.isArray(meta.steps) && meta.steps.length) return fromLegacySteps(meta.steps);
    return [];
  }

  function hasChips(meta) {
    return resolveChips(meta).length > 0;
  }

  /* ---------------- SVG Icon Builder (zero innerHTML) ---------------- */

  function svgEl(doc, tag, attrs) {
    var node = doc.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  function buildToolIcon(doc, tool, status) {
    var wrap = doc.createElement("span");
    wrap.className = "tc-ico";
    wrap.setAttribute("aria-hidden", "true");
    if (status === "running") {
      var sp = doc.createElement("span");
      sp.className = "tc-spin";
      wrap.appendChild(sp);
      return wrap;
    }

    var svg = svgEl(doc, "svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });
    var t = String(tool || "").toLowerCase();

    if (/search|research/.test(t) && !/context|drive|email|slack|github/.test(t)) {
      // Globe / web search
      svg.appendChild(svgEl(doc, "circle", { cx: "12", cy: "12", r: "10" }));
      svg.appendChild(svgEl(doc, "path", { d: "M2 12h20" }));
      svg.appendChild(svgEl(doc, "path", { d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" }));
    } else if (/python|code|sandbox/.test(t)) {
      // Terminal >_
      svg.appendChild(svgEl(doc, "polyline", { points: "4 17 10 11 4 5" }));
      svg.appendChild(svgEl(doc, "line", { x1: "12", y1: "19", x2: "20", y2: "19" }));
    } else if (/calc/.test(t)) {
      // Calculator
      svg.appendChild(svgEl(doc, "rect", { x: "4", y: "2", width: "16", height: "20", rx: "2" }));
      svg.appendChild(svgEl(doc, "line", { x1: "8", y1: "6", x2: "16", y2: "6" }));
      svg.appendChild(svgEl(doc, "line", { x1: "8", y1: "11", x2: "10", y2: "11" }));
      svg.appendChild(svgEl(doc, "line", { x1: "14", y1: "11", x2: "16", y2: "11" }));
      svg.appendChild(svgEl(doc, "line", { x1: "8", y1: "16", x2: "10", y2: "16" }));
      svg.appendChild(svgEl(doc, "line", { x1: "14", y1: "16", x2: "16", y2: "16" }));
    } else if (/comptrove|supabase|sql|query|db/.test(t)) {
      // Database
      svg.appendChild(svgEl(doc, "ellipse", { cx: "12", cy: "5", rx: "9", ry: "3" }));
      svg.appendChild(svgEl(doc, "path", { d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" }));
      svg.appendChild(svgEl(doc, "path", { d: "M3 12c0 1.66 4 3 9 3s9-1.34 9-3" }));
    } else if (/page|browser/.test(t)) {
      // Browser window
      svg.appendChild(svgEl(doc, "rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }));
      svg.appendChild(svgEl(doc, "line", { x1: "3", y1: "9", x2: "21", y2: "9" }));
    } else if (/email|mail/.test(t)) {
      // Mail
      svg.appendChild(svgEl(doc, "rect", { x: "2", y: "4", width: "20", height: "16", rx: "2" }));
      svg.appendChild(svgEl(doc, "path", { d: "m22 7-10 6L2 7" }));
    } else if (/event|calendar/.test(t)) {
      // Calendar
      svg.appendChild(svgEl(doc, "rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }));
      svg.appendChild(svgEl(doc, "line", { x1: "16", y1: "2", x2: "16", y2: "6" }));
      svg.appendChild(svgEl(doc, "line", { x1: "8", y1: "2", x2: "8", y2: "6" }));
      svg.appendChild(svgEl(doc, "line", { x1: "3", y1: "10", x2: "21", y2: "10" }));
    } else if (/github|repo|git/.test(t)) {
      // Git branch
      svg.appendChild(svgEl(doc, "circle", { cx: "6", cy: "6", r: "3" }));
      svg.appendChild(svgEl(doc, "circle", { cx: "18", cy: "18", r: "3" }));
      svg.appendChild(svgEl(doc, "line", { x1: "6", y1: "9", x2: "6", y2: "21" }));
      svg.appendChild(svgEl(doc, "path", { d: "M18 15V9a3 3 0 0 0-3-3H9" }));
    } else if (/plan|step/.test(t)) {
      // Checklist
      svg.appendChild(svgEl(doc, "path", { d: "m9 11 3 3L22 4" }));
      svg.appendChild(svgEl(doc, "path", { d: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" }));
    } else if (/file|asset|context|drive|dropbox|sheet/.test(t)) {
      // Document
      svg.appendChild(svgEl(doc, "path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }));
      svg.appendChild(svgEl(doc, "polyline", { points: "14 2 14 8 20 8" }));
    } else {
      // Wrench / tool fallback
      svg.appendChild(svgEl(doc, "path", { d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" }));
    }

    wrap.appendChild(svg);
    return wrap;
  }

  /* ---------------- DOM Rendering ---------------- */

  // v212: reconstruct a single readable command line for a chip, e.g.
  // "web_search(query=\"...\"", round 2)" - falls back to "tool" alone.
  function buildCommandText(chip, index) {
    var tool = String((chip && chip.tool) || "").trim();
    if (!tool) return "";
    var bits = [];
    if (chip && chip.args != null && String(chip.args).trim()) {
      bits.push("query=" + String(chip.args).replace(/\s+/g, " ").trim().slice(0, 160));
    }
    if (chip && chip.round != null && Number(chip.round) > 0) bits.push("round " + Number(chip.round));
    var head = "#" + (index + 1) + " " + tool;
    return bits.length ? head + "(" + bits.join(", ") + ")" : head;
  }

  function buildDetailPanel(doc, chip, index, panelId, isOpen) {
    var isErr = chip.status === "failed" || chip.ok === false;
    var isRun = chip.status === "running";
    var panel = doc.createElement("div");
    panel.className = "tc-detail" + (isErr ? " is-err" : "");
    panel.id = panelId;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", (chip.tool || "tool") + " step details");
    panel.hidden = !isOpen;

    var head = doc.createElement("div");
    head.className = "tc-detail-head";
    var title = doc.createElement("span");
    title.className = "tc-detail-title";
    title.textContent = "#" + (index + 1) + " \u00b7 " + String(chip.tool || "tool");
    head.appendChild(title);

    var metaParts = [];
    if (chip.round != null && chip.round > 0) metaParts.push("round " + chip.round);
    metaParts.push(isRun ? "running" : (isErr ? "failed" : "ok"));
    if (chip.ms != null && Number.isFinite(Number(chip.ms))) metaParts.push(Math.max(0, Math.round(Number(chip.ms))) + "ms");
    if (chip.chars != null && Number.isFinite(Number(chip.chars))) metaParts.push(Number(chip.chars).toLocaleString() + " chars");
    var metaEl = doc.createElement("span");
    metaEl.className = "tc-detail-meta";
    metaEl.textContent = metaParts.join(" \u00b7 ");
    head.appendChild(metaEl);
    panel.appendChild(head);

    // v212 §26f item 5: explicit runnable command line + copy button
    var cmdText = buildCommandText(chip, index);
    if (cmdText) {
      var rCmd = doc.createElement("div");
      rCmd.className = "tc-detail-row tc-detail-cmd";
      var kCmd = doc.createElement("span");
      kCmd.className = "tc-k";
      kCmd.textContent = "Command";
      var vCmd = doc.createElement("code");
      vCmd.className = "tc-v";
      vCmd.textContent = cmdText;
      var copyCmd = doc.createElement("button");
      copyCmd.type = "button";
      copyCmd.className = "tc-copy-btn";
      copyCmd.textContent = "Copy";
      copyCmd.setAttribute("data-copy", cmdText);
      copyCmd.addEventListener("click", function () {
        var done = function () {
          copyCmd.textContent = "Copied";
          setTimeout(function () { copyCmd.textContent = "Copy"; }, 1400);
        };
        try {
          if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
            root.navigator.clipboard.writeText(cmdText).then(done, done);
          } else { done(); }
        } catch (_e) { done(); }
      });
      rCmd.appendChild(kCmd);
      rCmd.appendChild(vCmd);
      rCmd.appendChild(copyCmd);
      panel.appendChild(rCmd);
    }

    var hasRich = Boolean(cmdText);
    if (chip.args) {
      hasRich = true;
      var rArgs = doc.createElement("div");
      rArgs.className = "tc-detail-row";
      var kArgs = doc.createElement("span");
      kArgs.className = "tc-k";
      kArgs.textContent = "Args";
      var vArgs = doc.createElement("code");
      vArgs.className = "tc-v";
      vArgs.textContent = String(chip.args);
      rArgs.appendChild(kArgs);
      rArgs.appendChild(vArgs);
      panel.appendChild(rArgs);
    }

    if (chip.summary) {
      hasRich = true;
      var rSum = doc.createElement("div");
      rSum.className = "tc-detail-row";
      var kSum = doc.createElement("span");
      kSum.className = "tc-k";
      kSum.textContent = "Summary";
      var vSum = doc.createElement("span");
      vSum.className = "tc-v";
      vSum.textContent = String(chip.summary);
      rSum.appendChild(kSum);
      rSum.appendChild(vSum);
      panel.appendChild(rSum);
    }

    if (Array.isArray(chip.details) && chip.details.length) {
      hasRich = true;
      var linesBox = doc.createElement("div");
      linesBox.className = "tc-detail-lines";
      chip.details.forEach(function (ln) {
        var d = doc.createElement("div");
        d.textContent = String(ln);
        linesBox.appendChild(d);
      });
      panel.appendChild(linesBox);
    }

    // Always show the trace entry when present (or build a fallback trace object when no args/summary exist)
    var tracePayload = chip.trace || (!hasRich ? {
      step: index + 1,
      tool: chip.tool || "tool",
      ok: isRun ? null : !isErr,
      ...(chip.round != null ? { round: chip.round } : {}),
      ...(chip.ms != null ? { ms: chip.ms } : {}),
      ...(chip.chars != null ? { chars: chip.chars } : {})
    } : null);

    if (tracePayload) {
      var pre = doc.createElement("pre");
      pre.className = "tc-trace";
      try {
        pre.textContent = JSON.stringify(tracePayload);
      } catch (_e) {
        pre.textContent = String(chip.tool || "tool");
      }
      panel.appendChild(pre);
    }

    return panel;
  }

  function populateContainer(rootEl, chips, expandedSet) {
    var doc = rootEl.ownerDocument || document;
    rootEl.textContent = "";
    var openSet = expandedSet || new Set();
    var batchId = ++uidSeq;

    var bar = doc.createElement("div");
    bar.className = "tc-bar";
    bar.setAttribute("role", "list");

    var panels = doc.createElement("div");
    panels.className = "tc-panels";

    chips.forEach(function (chip, idx) {
      var chipKey = String(chip.key || chip.id || ("idx-" + idx));
      var isOpen = openSet.has(chipKey);
      var isRun = chip.status === "running";
      var isErr = !isRun && (chip.status === "failed" || chip.ok === false);
      var panelId = "tc-detail-" + batchId + "-" + idx;

      var btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "tc-chip " + (isRun ? "is-run" : (isErr ? "is-err" : "is-ok")) + (isOpen ? " expanded" : "");
      btn.setAttribute("role", "listitem");
      btn.setAttribute("aria-expanded", String(isOpen));
      btn.setAttribute("aria-controls", panelId);
      btn.dataset.chipKey = chipKey;
      if (isRun && chip.startedAt) btn.setAttribute("data-started", String(chip.startedAt));

      btn.appendChild(buildToolIcon(doc, chip.tool, isRun ? "running" : (isErr ? "failed" : "ok")));

      var nameEl = doc.createElement("span");
      nameEl.className = "tc-name";
      nameEl.textContent = String(chip.tool || "tool");
      btn.appendChild(nameEl);

      var statusEl = doc.createElement("span");
      statusEl.className = "tc-status";
      statusEl.textContent = isRun ? "running" : (isErr ? "\u2717 failed" : "\u2713 ok");
      btn.appendChild(statusEl);

      var hasMs = chip.ms != null && Number.isFinite(Number(chip.ms));
      if (hasMs || isRun) {
        var msEl = doc.createElement("span");
        msEl.className = "tc-ms";
        msEl.textContent = hasMs
          ? (Math.max(0, Math.round(Number(chip.ms))) + "ms")
          : (chip.startedAt ? Math.max(0, Date.now() - chip.startedAt) + "ms" : "\u2026");
        btn.appendChild(msEl);
      }

      var chev = doc.createElement("span");
      chev.className = "tc-chev";
      chev.setAttribute("aria-hidden", "true");
      chev.textContent = "\u25be";
      btn.appendChild(chev);

      var tipBits = [String(chip.tool || "tool"), isRun ? "running" : (isErr ? "failed" : "ok")];
      if (hasMs) tipBits.push(Math.max(0, Math.round(Number(chip.ms))) + "ms");
      btn.title = tipBits.join(" \u00b7 ") + " \u2014 click to " + (isOpen ? "collapse" : "expand") + " details";

      var detailEl = buildDetailPanel(doc, chip, idx, panelId, isOpen);

      btn.addEventListener("click", function () {
        var nextOpen = detailEl.hidden;
        detailEl.hidden = !nextOpen;
        btn.classList.toggle("expanded", nextOpen);
        btn.setAttribute("aria-expanded", String(nextOpen));
        if (nextOpen) openSet.add(chipKey);
        else openSet.delete(chipKey);
      });

      bar.appendChild(btn);
      panels.appendChild(detailEl);
    });

    rootEl.appendChild(bar);
    rootEl.appendChild(panels);
    return rootEl;
  }

  function renderInto(container, meta) {
    if (!container) return null;
    var chips = resolveChips(meta);
    if (!chips.length) return null;
    var doc = container.ownerDocument || document;
    var wrap = doc.createElement("div");
    wrap.className = "tool-chips";
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "Executed tool steps");
    var expandedSet = (meta && meta.toolStream && meta.toolStream.expanded) ? meta.toolStream.expanded : new Set();
    populateContainer(wrap, chips, expandedSet);
    if (meta && meta.toolStream && typeof meta.toolStream.setLiveHost === "function") {
      meta.toolStream.setLiveHost(wrap);
    }
    container.appendChild(wrap);
    return wrap;
  }

  var api = {
    createStream: createStream,
    extract: extract,
    fromLegacySteps: fromLegacySteps,
    resolveChips: resolveChips,
    hasChips: hasChips,
    renderInto: renderInto,
    _inferFromProgressLabel: inferFromProgressLabel
  };

  root.ToolChips = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
