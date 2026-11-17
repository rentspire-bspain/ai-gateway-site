// Unit tests for Response Versioning — Diff View (34b) in modules/response-diff.js.
// Run: node --test modules/response-diff.test.js
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ResponseDiff = require("./response-diff.js");

// Helper: verify that any diffLines result losslessly reconstructs both inputs
function assertValidDiff(oldText, newText, res) {
  const norm = (s) => (s === "" ? [] : String(s).replace(/\r\n?/g, "\n").split("\n"));
  const oldExpected = norm(oldText);
  const newExpected = norm(newText);
  const oldActual = res.ops.filter((o) => o.type !== "add").map((o) => o.text);
  const newActual = res.ops.filter((o) => o.type !== "del").map((o) => o.text);
  assert.deepEqual(oldActual, oldExpected, "equal+del must reconstruct oldText lines");
  assert.deepEqual(newActual, newExpected, "equal+add must reconstruct newText lines");
}

test("diffLines handles empty and single-sided inputs without phantom empty lines", () => {
  const bothEmpty = ResponseDiff.diffLines("", "");
  assert.equal(bothEmpty.identical, true);
  assert.deepEqual(bothEmpty.ops, []);
  assert.deepEqual(bothEmpty.stats, { added: 0, removed: 0, unchanged: 0, oldCount: 0, newCount: 0 });

  const fromEmpty = ResponseDiff.diffLines("", "# Heading\nBody line");
  assert.equal(fromEmpty.identical, false);
  assert.equal(fromEmpty.stats.added, 2);
  assert.equal(fromEmpty.stats.removed, 0);
  assertValidDiff("", "# Heading\nBody line", fromEmpty);

  const toEmpty = ResponseDiff.diffLines("Alpha\nBeta", "");
  assert.equal(toEmpty.identical, false);
  assert.equal(toEmpty.stats.added, 0);
  assert.equal(toEmpty.stats.removed, 2);
  assertValidDiff("Alpha\nBeta", "", toEmpty);
});

test("diffLines normalizes CRLF and marks identical markdown as identical", () => {
  const mdA = "# Cap Rate Summary\r\n\r\n- Austin: 5.4%\r\n- Dallas: 5.7%";
  const mdB = "# Cap Rate Summary\n\n- Austin: 5.4%\n- Dallas: 5.7%";
  const res = ResponseDiff.diffLines(mdA, mdB);
  assert.equal(res.identical, true);
  assert.equal(res.stats.unchanged, 4);
  assert.equal(res.stats.added, 0);
  assert.equal(res.stats.removed, 0);
  assert.equal(res.ops[0].oldLine, 1);
  assert.equal(res.ops[0].newLine, 1);
  assert.equal(res.ops[3].oldLine, 4);
  assert.equal(res.ops[3].newLine, 4);
});

test("diffLines computes exact LCS across multi-hunk markdown tables and code blocks", () => {
  const v1 = [
    "# Q4 Multifamily Report",
    "",
    "Vacancy held steady across Sunbelt metros.",
    "",
    "| Metro | Cap Rate | YoY |",
    "|---|---|---|",
    "| Austin | 5.45% | +25 bps |",
    "| Phoenix | 5.60% | +15 bps |",
    "",
    "```sql",
    "SELECT metro, cap_rate FROM deals WHERE quarter = '2026-Q3';",
    "```",
    "",
    "Conclusion: disciplined underwriting remains essential."
  ].join("\n");

  const v2 = [
    "# Q4 Multifamily Report",
    "",
    "Vacancy tightened by 20 bps across core Sunbelt metros.",
    "",
    "| Metro | Cap Rate | YoY |",
    "|---|---|---|",
    "| Austin | 5.30% | +10 bps |",
    "| Phoenix | 5.60% | +15 bps |",
    "| Nashville | 5.50% | +5 bps |",
    "",
    "```sql",
    "SELECT metro, cap_rate FROM deals WHERE quarter = '2026-Q4';",
    "```",
    "",
    "Conclusion: disciplined underwriting remains essential."
  ].join("\n");

  const res = ResponseDiff.diffLines(v1, v2);
  assertValidDiff(v1, v2, res);
  assert.equal(res.identical, false);
  // 3 lines replaced (vacancy sentence, Austin row, SQL query) + 1 Nashville row added => -3 / +4, 11 unchanged
  assert.equal(res.stats.unchanged, 11);
  assert.equal(res.stats.removed, 3);
  assert.equal(res.stats.added, 4);

  // Replacements emit del before add
  const firstChangeIdx = res.ops.findIndex((o) => o.type !== "equal");
  assert.equal(res.ops[firstChangeIdx].type, "del");
  assert.equal(res.ops[firstChangeIdx + 1].type, "add");
});

test("Hirschberg linear-space LCS matches exact subsequence length on non-trivial sequences", () => {
  const a = ["h1", "p1", "old-1", "shared-a", "old-2", "old-3", "shared-b", "shared-c", "tail-old"];
  const b = ["p1", "new-1", "shared-a", "new-2", "shared-b", "inserted", "shared-c", "tail-new"];
  const pairs = ResponseDiff._lcsHirschberg(a, b);
  const matched = pairs.map(([i, j]) => {
    assert.equal(a[i], b[j]);
    return a[i];
  });
  assert.deepEqual(matched, ["p1", "shared-a", "shared-b", "shared-c"]);
});

test("buildSideBySideRows pairs asymmetric change hunks and diffInlineTokens highlights changed words", () => {
  const res = ResponseDiff.diffLines(
    "Header\nRate is 6.42% today.\nOld note\nFooter",
    "Header\nRate is 6.18% today.\nFooter"
  );
  const rows = ResponseDiff.buildSideBySideRows(res.ops);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].kind, "equal");
  assert.equal(rows[1].kind, "change");
  assert.equal(rows[1].left.text, "Rate is 6.42% today.");
  assert.equal(rows[1].right.text, "Rate is 6.18% today.");
  assert.equal(rows[2].kind, "del");
  assert.equal(rows[2].left.text, "Old note");
  assert.equal(rows[2].right, null);
  assert.equal(rows[3].kind, "equal");

  const inline = ResponseDiff.diffInlineTokens(rows[1].left.text, rows[1].right.text);
  assert.deepEqual(
    inline.left,
    [
      { text: "Rate is ", changed: false },
      { text: "6.42%", changed: true },
      { text: " today.", changed: false }
    ]
  );
  assert.deepEqual(
    inline.right,
    [
      { text: "Rate is ", changed: false },
      { text: "6.18%", changed: true },
      { text: " today.", changed: false }
    ]
  );
});

test("formatUnifiedDiff produces unified diff text with labels and +/- prefixes", () => {
  const txt = ResponseDiff.formatUnifiedDiff("line 1\nold line", "line 1\nnew line", {
    fromLabel: "v1",
    toLabel: "v2 (latest)"
  });
  assert.equal(
    txt,
    ["--- v1", "+++ v2 (latest)", "  line 1", "- old line", "+ new line"].join("\n")
  );
});

// Minimal DOM harness to test thread version badges + modal interaction in isolation
function createTestEnv(initialThread) {
  const docListeners = {};

  function makeEl(tag) {
    const classSet = new Set();
    const attrs = {};
    const listeners = {};
    const el = {
      tagName: String(tag || "div").toUpperCase(),
      ownerDocument: null,
      parentNode: null,
      children: [],
      style: {},
      id: "",
      type: "",
      value: "",
      title: "",
      tabIndex: 0,
      selected: false,
      _text: "",
      _html: "",
      get firstChild() { return this.children[0] || null; },
      get previousElementSibling() {
        if (!this.parentNode) return null;
        const idx = this.parentNode.children.indexOf(this);
        return idx > 0 ? this.parentNode.children[idx - 1] : null;
      },
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
          const on = force !== undefined ? !!force : !classSet.has(c);
          if (on) classSet.add(c); else classSet.delete(c);
          return on;
        }
      },
      get textContent() {
        if (!this.children.length) return this._text;
        return this._text + this.children.map((c) => c.textContent).join("");
      },
      set textContent(v) {
        this.children.forEach((c) => { c.parentNode = null; });
        this.children = [];
        this._text = String(v == null ? "" : v);
      },
      get innerHTML() { return this._html; },
      set innerHTML(v) {
        this._html = String(v || "");
        const m = /<span>([^<]+)<\/span>/.exec(this._html);
        this._text = m ? m[1] : "";
      },
      setAttribute(k, v) {
        attrs[k] = String(v);
        if (k === "id") this.id = String(v);
      },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
      appendChild(ch) {
        if (ch.parentNode) ch.parentNode.removeChild(ch);
        ch.parentNode = this;
        this.children.push(ch);
        return ch;
      },
      insertBefore(ch, ref) {
        if (ch.parentNode) ch.parentNode.removeChild(ch);
        ch.parentNode = this;
        const idx = this.children.indexOf(ref);
        if (idx >= 0) this.children.splice(idx, 0, ch);
        else this.children.push(ch);
        return ch;
      },
      removeChild(ch) {
        const idx = this.children.indexOf(ch);
        if (idx >= 0) {
          this.children.splice(idx, 1);
          ch.parentNode = null;
        }
        return ch;
      },
      addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
      click() {
        (listeners.click || []).slice().forEach((fn) => fn({ target: el, stopPropagation() {} }));
      },
      dispatchChange() {
        (listeners.change || []).slice().forEach((fn) => fn({ target: el }));
      },
      focus() { doc.activeElement = el; },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const out = [];
        const matchOne = (node) => {
          if (!node || !node.classList) return false;
          if (sel.startsWith(".")) return node.classList.contains(sel.slice(1));
          if (sel.startsWith("#")) return node.id === sel.slice(1);
          const attrM = /^\[([a-zA-Z0-9_-]+)="([^"]+)"\]$/.exec(sel);
          if (attrM) return node.getAttribute(attrM[1]) === attrM[2];
          return node.tagName === sel.toUpperCase();
        };
        const walk = (parent) => {
          for (const c of parent.children || []) {
            if (matchOne(c)) out.push(c);
            walk(c);
          }
        };
        walk(this);
        return out;
      }
    };
    el.ownerDocument = doc;
    return el;
  }

  const doc = {
    readyState: "complete",
    activeElement: null,
    head: null,
    body: null,
    createElement: (tag) => makeEl(tag),
    createTextNode: (txt) => {
      const t = makeEl("#text");
      t._text = String(txt == null ? "" : txt);
      return t;
    },
    getElementById(id) {
      if (this.head) {
        const h = this.head.querySelector("#" + id);
        if (h) return h;
      }
      if (this.body) {
        if (this.body.id === id) return this.body;
        const b = this.body.querySelector("#" + id);
        if (b) return b;
      }
      return null;
    },
    addEventListener(ev, fn) { (docListeners[ev] = docListeners[ev] || []).push(fn); },
    pressKey(key) {
      (docListeners.keydown || []).slice().forEach((fn) => fn({ key, stopPropagation() {} }));
    }
  };
  doc.head = makeEl("head");
  doc.body = makeEl("body");

  const resultsContent = makeEl("div");
  resultsContent.id = "resultsContent";
  const moduleRoot = makeEl("div");
  moduleRoot.id = "moduleRoot";
  doc.body.appendChild(resultsContent);
  doc.body.appendChild(moduleRoot);

  const threads = initialThread ? [initialThread] : [];
  const ctx = {
    window: null,
    document: doc,
    innerWidth: 1440,
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    __appGlobals: {
      get threads() { return threads; },
      get currentThreadId() { return threads[0] ? threads[0].id : null; }
    },
    renderSection(question, md) {
      const q = doc.createElement("div");
      q.className = "question-header";
      q.textContent = question;
      resultsContent.appendChild(q);
      const sec = doc.createElement("div");
      sec.className = "answer-section";
      const lbl = doc.createElement("div");
      lbl.className = "answer-label";
      lbl.textContent = "Answer";
      const ac = doc.createElement("div");
      ac.className = "answer-content";
      ac.textContent = md;
      sec.appendChild(lbl);
      sec.appendChild(ac);
      resultsContent.appendChild(sec);
      return sec;
    }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;

  const src = fs.readFileSync(path.join(__dirname, "response-diff.js"), "utf8");
  vm.runInNewContext(src, ctx);
  return { ctx, doc, resultsContent, moduleRoot, threads };
}

test("DOM integration: single-answer thread renders zero version badges", () => {
  const thread = {
    id: "t-single",
    messages: [
      { role: "user", content: "What is Austin vacancy?" },
      { role: "assistant", content: "Austin vacancy is 8.1%." }
    ]
  };
  const env = createTestEnv(thread);
  env.ctx.renderSection("What is Austin vacancy?", "Austin vacancy is 8.1%.");
  env.ctx.ResponseDiff.syncThreadVersions(env.resultsContent, thread);

  assert.equal(env.resultsContent.querySelectorAll(".rd-ver-badge").length, 0);
  assert.equal(env.resultsContent.querySelectorAll(".rd-compare-btn").length, 0);
});

test("DOM integration: multi-answer thread decorates older answers (v1, v2) and opens diff modal against latest", () => {
  const thread = {
    id: "t-multi",
    messages: [
      { role: "user", content: "Summarize cap rates" },
      { role: "assistant", content: "# Summary\nAustin: 5.5%\nDallas: 5.8%", servedModel: "glm-5.3" },
      { role: "user", content: "Summarize cap rates" },
      { role: "assistant", content: "# Summary\nAustin: 5.4%\nDallas: 5.8%", servedModel: "kimi-k3.1" },
      { role: "user", content: "Include Phoenix too" },
      { role: "assistant", content: "# Summary\nAustin: 5.3%\nDallas: 5.8%\nPhoenix: 5.6%", servedModel: "glm-5.3" }
    ]
  };
  const env = createTestEnv(thread);
  const sec1 = env.ctx.renderSection("Summarize cap rates", thread.messages[1].content);
  const sec2 = env.ctx.renderSection("Summarize cap rates", thread.messages[3].content);
  const sec3 = env.ctx.renderSection("Include Phoenix too", thread.messages[5].content);

  env.ctx.ResponseDiff.syncThreadVersions(env.resultsContent, thread);

  // Older answers get v1 and v2; latest (sec3) has none
  const b1 = sec1.querySelector(".rd-ver-badge");
  const b2 = sec2.querySelector(".rd-ver-badge");
  const b3 = sec3.querySelector(".rd-ver-badge");
  assert.ok(b1 && b1.textContent === "v1");
  assert.ok(b2 && b2.textContent === "v2");
  assert.equal(b3, null);

  const compareBtns = env.resultsContent.querySelectorAll(".rd-compare-btn");
  assert.equal(compareBtns.length, 2);

  // Click "Compare with latest" on v1 -> opens modal comparing v1 (index 0) to v3 (index 2, latest)
  compareBtns[0].click();
  assert.equal(env.ctx.ResponseDiff.isOpen(), true);
  const modal = env.doc.getElementById("responseDiffModal");
  assert.ok(modal);
  assert.equal(modal.getAttribute("role"), "dialog");
  assert.equal(modal.getAttribute("aria-modal"), "true");

  // Stats: Austin 5.5% -> 5.3% (-1/+1) and Phoenix: 5.6% (+1) => +2 / -1
  assert.equal(modal.querySelector(".rd-stat-add").textContent, "+2");
  assert.equal(modal.querySelector(".rd-stat-del").textContent, "-1");
  assert.equal(modal.querySelectorAll(".rd-split").length, 1);

  // Switch to Unified mode
  const unifiedBtn = modal.querySelector('[data-mode="unified"]');
  unifiedBtn.click();
  assert.equal(modal.querySelectorAll(".rd-unified").length, 1);

  // Escape closes modal and restores focus to trigger button
  env.doc.pressKey("Escape");
  assert.equal(env.ctx.ResponseDiff.isOpen(), false);
  assert.equal(env.doc.getElementById("responseDiffModal"), null);
  assert.equal(env.doc.activeElement, compareBtns[0]);
});

test("DOM integration: promotes v1 dynamically when second answer arrives and supports version dropdowns", () => {
  const thread = {
    id: "thread-grow",
    slug: "grow-test",
    messages: [
      { role: "user", content: "Explain DSCR" },
      { role: "assistant", content: "DSCR = NOI / Debt Service\nTarget >= 1.25x" }
    ]
  };
  const env = createTestEnv(thread);
  const sec1 = env.ctx.renderSection("Explain DSCR", thread.messages[1].content);
  env.ctx.ResponseDiff.syncThreadVersions(env.resultsContent, thread);
  assert.equal(sec1.querySelector(".rd-ver-badge"), null);

  // Append regenerated answer
  thread.messages.push(
    { role: "user", content: "Explain DSCR" },
    { role: "assistant", content: "DSCR = Net Operating Income / Total Debt Service\nAgency target >= 1.25x" }
  );
  const sec2 = env.ctx.renderSection("Explain DSCR", thread.messages[3].content);
  env.ctx.ResponseDiff.syncThreadVersions(env.resultsContent, thread);

  assert.equal(sec1.querySelector(".rd-ver-badge").textContent, "v1");
  assert.ok(sec1.querySelector(".rd-compare-btn"));
  assert.equal(sec2.querySelector(".rd-ver-badge"), null);

  // Open modal and switch both dropdowns to v1 -> Identical state
  sec1.querySelector(".rd-compare-btn").click();
  const modal = env.doc.getElementById("responseDiffModal");
  const selTo = modal.querySelector('[data-rd-role="to-version"]');
  selTo.value = "0";
  selTo.dispatchChange();
  assert.equal(modal.querySelector(".rd-stat-eq").textContent, "Identical (2 lines)");
  assert.equal(modal.querySelectorAll(".rd-add").length, 0);
  assert.equal(modal.querySelectorAll(".rd-del").length, 0);
});

test("DOM integration: preserves accurate version numbers in >40-turn truncated threads (.older-turns-btn)", () => {
  const messages = [];
  for (let i = 1; i <= 42; i++) {
    messages.push({ role: "user", content: "Prompt " + i });
    messages.push({ role: "assistant", content: "Answer version " + i + "\nCommon footer" });
  }
  const thread = { id: "thread-long", slug: "long-thread", messages };
  const env = createTestEnv(thread);

  const olderBtn = env.doc.createElement("button");
  olderBtn.className = "older-turns-btn";
  olderBtn.textContent = "Show 21 earlier turns";
  env.resultsContent.appendChild(olderBtn);

  const rendered = [];
  for (let i = 22; i <= 42; i++) {
    rendered.push(env.ctx.renderSection("Prompt " + i, "Answer version " + i + "\nCommon footer"));
  }
  env.ctx.ResponseDiff.syncThreadVersions(env.resultsContent, thread);

  // First visible section is v22, 20th visible is v41, 21st visible (v42, latest) has no badge
  assert.equal(rendered[0].querySelector(".rd-ver-badge").textContent, "v22");
  assert.equal(rendered[19].querySelector(".rd-ver-badge").textContent, "v41");
  assert.equal(rendered[20].querySelector(".rd-ver-badge"), null);

  // Clicking Compare on v22 opens modal with all 42 versions available
  rendered[0].querySelector(".rd-compare-btn").click();
  const modal = env.doc.getElementById("responseDiffModal");
  const selFrom = modal.querySelector('[data-rd-role="from-version"]');
  const selTo = modal.querySelector('[data-rd-role="to-version"]');
  assert.equal(selFrom.children.length, 42);
  assert.equal(selFrom.value, "21"); // 0-based index of v22
  assert.equal(selTo.value, "41");   // 0-based index of v42 (latest)
});
