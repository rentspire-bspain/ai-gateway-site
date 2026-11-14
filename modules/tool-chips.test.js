// node modules/tool-chips.test.js
"use strict";

const assert = require("assert");
const ToolChips = require("./tool-chips.js");

// Minimal DOM shim so `node modules/tool-chips.test.js` runs standalone with zero npm deps.
function createMockDoc() {
  function makeEl(tag, ns) {
    const attrs = Object.create(null);
    const listeners = Object.create(null);
    const classSet = new Set();
    const el = {
      tagName: String(tag).toUpperCase(),
      namespaceURI: ns || "http://www.w3.org/1999/xhtml",
      ownerDocument: null,
      parentNode: null,
      children: [],
      dataset: Object.create(null),
      hidden: false,
      title: "",
      type: "",
      id: "",
      isConnected: true,
      _text: "",
      get className() { return Array.from(classSet).join(" "); },
      set className(v) {
        classSet.clear();
        String(v || "").split(/\s+/).filter(Boolean).forEach((c) => classSet.add(c));
      },
      classList: {
        add(c) { classSet.add(c); },
        remove(c) { classSet.delete(c); },
        contains(c) { return classSet.has(c); },
        toggle(c, force) {
          const next = force !== undefined ? !!force : !classSet.has(c);
          if (next) classSet.add(c); else classSet.delete(c);
          return next;
        }
      },
      get textContent() {
        if (this.children.length === 0) return this._text;
        return this._text + this.children.map((c) => c.textContent).join("");
      },
      set textContent(v) {
        this.children.forEach((c) => { c.parentNode = null; });
        this.children = [];
        this._text = String(v == null ? "" : v);
      },
      setAttribute(k, v) {
        attrs[k] = String(v);
        if (k === "id") this.id = String(v);
      },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
      appendChild(child) {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      insertBefore(child, ref) {
        if (child.parentNode) child.parentNode.removeChild(child);
        const idx = this.children.indexOf(ref);
        child.parentNode = this;
        if (idx < 0) this.children.push(child);
        else this.children.splice(idx, 0, child);
        return child;
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) { this.children.splice(idx, 1); child.parentNode = null; }
        return child;
      },
      remove() { if (this.parentNode) this.parentNode.removeChild(this); },
      addEventListener(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); },
      click() { (listeners.click || []).forEach((fn) => fn({ currentTarget: this, target: this })); },
      querySelectorAll(sel) {
        const out = [];
        const matchSimple = (node, s) => {
          const parts = s.split(/(?=\.)|(?=\[)/);
          return parts.every((p) => {
            if (p.startsWith(".")) return node.classList.contains(p.slice(1));
            if (p.startsWith("[") && p.endsWith("]")) return node.getAttribute(p.slice(1, -1)) !== null;
            return node.tagName.toLowerCase() === p.toLowerCase();
          });
        };
        const walk = (n) => {
          n.children.forEach((c) => {
            if (matchSimple(c, sel)) out.push(c);
            walk(c);
          });
        };
        walk(this);
        return out;
      },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    };
    el.ownerDocument = doc;
    return el;
  }
  const doc = {
    createElement: (tag) => makeEl(tag, "http://www.w3.org/1999/xhtml"),
    createElementNS: (ns, tag) => makeEl(tag, ns)
  };
  return doc;
}

// 1) JSON gateway payload: x_auto_asset + x_research + x_tool_loop (repeated tools, 0ms, failure) + x_plan
{
  const chips = ToolChips.extract({
    x_auto_asset: [{ round: 0, tool: "fetch_asset(auto)", ms: 185, ok: true, chars: 4200 }],
    x_research: { used_live_search: true, sources: 6, sub_questions: 2, lane: "hybrid", skipped: null },
    x_tool_loop: {
      rounds: 2,
      used: true,
      skipped: null,
      tools: [
        { round: 1, tool: "record_plan", ms: 1, ok: true, chars: 48 },
        { round: 1, tool: "web_search", ms: 412, ok: true, chars: 1890 },
        { round: 1, tool: "calculator", ms: 0, ok: true, chars: 12 },
        { round: 2, tool: "web_search", ms: 389, ok: true, chars: 1420 },
        { round: 2, tool: "query_comptrove", ms: 240, ok: false, chars: 63 }
      ]
    },
    x_plan: [
      { n: 1, text: "Check rent escalations", status: "done", evidence: "3.5% annual" },
      { n: 2, text: "Pull comps from CompTrove", status: "failed", evidence: "timeout" }
    ]
  });

  assert.deepEqual(
    chips.map((c) => c.tool),
    ["fetch_asset(auto)", "web_search", "record_plan", "web_search", "calculator", "web_search", "query_comptrove"],
    "Execution order must preserve auto-asset, pre-loop research, and every tool-loop call including duplicate tool names"
  );
  assert.equal(chips[4].ms, 0, "0ms tool call duration must be preserved, never dropped as falsy");
  assert.equal(chips[6].status, "failed");
  assert.equal(chips[6].ok, false);
  assert.ok(chips[2].details.some((l) => l.includes("3.5% annual")), "record_plan chip should include plan evidence");
}

// 2) Skipped search must NOT produce a fake search chip
{
  const s = ToolChips.createStream();
  s.ingestSSE({ x_progress: { id: "analyze", state: "running", label: "Understanding your question…" } }, null);
  s.ingestSSE({ x_progress: { id: "search", state: "done", ms: 2, label: "Direct answer — no web search needed" } }, null);
  s.ingestSSE({ x_progress: { id: "draft", state: "running", label: "Writing answer…" } }, null);
  assert.equal(s.finalize().length, 0, "Internal pipeline phases and skipped search must emit zero tool chips");
}

// 3) Live SSE streaming into .searching-state -> running -> done + click-to-expand persistence across re-renders
{
  const doc = createMockDoc();
  const searchingState = doc.createElement("div");
  searchingState.className = "searching-state";
  const phasesBox = doc.createElement("div");
  phasesBox.className = "searching-phases";
  searchingState.appendChild(phasesBox);

  const stream = ToolChips.createStream();
  stream.ingestSSE({ x_progress: { id: "t1.0", kind: "search", state: "running", label: "Searching: oak street lease…" } }, searchingState);

  const liveSlot = searchingState.querySelector(".tool-chips");
  assert.ok(liveSlot, "Live chip bar mounts inside .searching-state");
  assert.equal(searchingState.children[0], liveSlot, "Chip bar mounts above .searching-phases");
  let btns = liveSlot.querySelectorAll(".tc-chip");
  assert.equal(btns.length, 1);
  assert.equal(btns[0].classList.contains("is-run"), true);
  assert.equal(btns[0].querySelector(".tc-name").textContent, "web_search");

  // User clicks chip while it is STILL streaming!
  btns[0].click();
  assert.equal(btns[0].getAttribute("aria-expanded"), "true");

  // Tool finishes + second tool starts & fails + phases upgrade generic Drive label to exact read_sheet tool
  stream.ingestSSE({ x_progress: { id: "t1.0", kind: "search", state: "done", ms: 482, label: "Searched: oak street lease" } }, searchingState);
  stream.ingestSSE({ x_progress: { id: "t1.1", kind: "tool", state: "running", label: "Checking your Google Drive…" } }, searchingState);
  stream.ingestSSE({ x_progress: { id: "t1.1", kind: "tool", state: "failed", ms: 915, label: "Checking your Google Drive — failed" } }, searchingState);
  stream.ingestSSE({
    phases: [{
      kind: "tool",
      label: "Ran tools (web_search, read_sheet (failed))",
      done: true,
      items: [{ title: "web_search" }, { title: "read_sheet (failed)" }]
    }]
  }, searchingState);

  // Disconnect searchingState (simulating first answer token arriving) and render into answer meta
  searchingState.isConnected = false;
  const metaWrap = doc.createElement("div");
  const rendered = ToolChips.renderInto(metaWrap, { toolChips: stream.finalize(), toolStream: stream });
  assert.ok(rendered);

  btns = rendered.querySelectorAll(".tc-chip");
  const panels = rendered.querySelectorAll(".tc-detail");
  assert.equal(btns.length, 2);
  assert.equal(btns[0].querySelector(".tc-name").textContent, "web_search");
  assert.equal(btns[0].querySelector(".tc-status").textContent, "✓ ok");
  assert.equal(btns[0].querySelector(".tc-ms").textContent, "482ms");
  assert.equal(btns[0].getAttribute("aria-expanded"), "true", "Expanded state must persist from live SSE into final answer");
  assert.equal(panels[0].hidden, false);
  assert.ok(panels[0].textContent.includes("oak street lease"));

  assert.equal(btns[1].querySelector(".tc-name").textContent, "read_sheet", "Generic Drive progress label upgrades to exact read_sheet tool name");
  assert.equal(btns[1].classList.contains("is-err"), true);
  assert.equal(btns[1].querySelector(".tc-status").textContent, "✗ failed");
  assert.equal(btns[1].querySelector(".tc-ms").textContent, "915ms");
  assert.equal(panels[1].hidden, true);

  // Clicking chip #2 opens panel #2; clicking chip #1 closes panel #1
  btns[1].click();
  assert.equal(panels[1].hidden, false);
  assert.equal(btns[1].getAttribute("aria-expanded"), "true");
  btns[0].click();
  assert.equal(panels[0].hidden, true);
  assert.equal(btns[0].getAttribute("aria-expanded"), "false");
}

// 4) Legacy saved thread steps fallback
{
  const legacy = ToolChips.fromLegacySteps([
    { kind: "tool", label: "Ran Python", done: true, items: [{ title: "✓ 12 * 1956" }, { title: "→ 23472" }] }
  ]);
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].tool, "run_python");
  assert.ok(legacy[0].details.includes("→ 23472"));
}

// 5) SSE progress + later plan phase + x_meta.x_tool_loop preserves exact trace execution order
{
  const s = ToolChips.createStream();
  s.ingestSSE({ x_progress: { id: "t1.0", kind: "search", state: "done", ms: 480, label: "Searched: oak street" } }, null);
  s.ingestSSE({ x_progress: { id: "t1.1", kind: "tool", state: "done", ms: 2, label: "Calculated" } }, null);
  s.ingestSSE({
    phases: [{ kind: "plan", label: "Planned 1 step", done: true, items: [{ n: 1, text: "Verify rent", status: "done" }] }],
    x_meta: {
      x_tool_loop: {
        rounds: 1,
        used: true,
        tools: [
          { round: 1, tool: "record_plan", ms: 1, ok: true, chars: 40 },
          { round: 1, tool: "web_search", ms: 480, ok: true, chars: 900 },
          { round: 1, tool: "calculator", ms: 0, ok: true, chars: 10 }
        ]
      }
    }
  }, null);
  assert.deepEqual(s.finalize().map((c) => c.tool), ["record_plan", "web_search", "calculator"]);
}

console.log("tool-chips tests ok (5 suites passed)");
