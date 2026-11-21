// node modules/answer-versions.test.js
"use strict";

const assert = require("assert");
const AnswerVersions = require("./answer-versions.js");

// The diff engine runs DOM-free (the module stays dormant outside a browser),
// so these tests exercise the pure text-diff core with zero npm deps.
function fmt(ops) {
  return ops.map((o) => (o.t === "add" ? "+" : o.t === "del" ? "-" : " ") + o.text).join("\n");
}

// --- normalization (mirrors renderAnswer's rules so diffs stay meaningful) ---
assert.strictEqual(
  AnswerVersions.normalizeAnswer("[OPS FLEET] hi\r\nthere"),
  "hi\nthere",
  "OPS FLEET marker + CRLF normalized"
);
assert.strictEqual(AnswerVersions.normalizeAnswer("'''py\ncode\n'''"), "```py\ncode\n```", "python fences normalized");

// --- identical inputs -> all context, no +/- ---
assert.strictEqual(fmt(AnswerVersions.diffLines("a\nb", "a\nb")), " a\n b", "identical");

// --- minimal edits ---
assert.strictEqual(
  fmt(AnswerVersions.diffLines("line1\nline2\nline3", "line1\nchanged\nline3")),
  " line1\n-line2\n+changed\n line3",
  "single-line change"
);
assert.strictEqual(fmt(AnswerVersions.diffLines("a\nc", "a\nb\nc")), " a\n+b\n c", "pure insertion");
assert.strictEqual(fmt(AnswerVersions.diffLines("a\nb\nc", "a\nc")), " a\n-b\n c", "pure deletion");
assert.strictEqual(fmt(AnswerVersions.diffLines("x\ny\nz", "x\nq\nr\nz")), " x\n-y\n+q\n+r\n z", "block replace");

// --- empty-string edges (no phantom blank-line deletions) ---
assert.strictEqual(fmt(AnswerVersions.diffLines("", "hello")), "+hello", "empty -> content");
assert.strictEqual(fmt(AnswerVersions.diffLines("hello", "")), "-hello", "content -> empty");

// --- common suffix must never overlap the common prefix ---
assert.strictEqual(fmt(AnswerVersions.diffLines("a\nend", "b\nend")), "-a\n+b\n end", "suffix handling");

// --- oversized middles fall back to block-replace (no O(n*m) blowup, no crash) ---
{
  const big1 = Array.from({ length: 900 }, (_, i) => "l" + i).join("\n");
  const big2 = Array.from({ length: 900 }, (_, i) => "m" + i).join("\n");
  const ops = AnswerVersions.diffLines(big1, big2);
  const adds = ops.filter((o) => o.t === "add").length;
  const dels = ops.filter((o) => o.t === "del").length;
  assert.strictEqual(dels, 900, "oversized fallback deletes all old middle lines");
  assert.strictEqual(adds, 900, "oversized fallback adds all new middle lines");
}

// --- the LCS core stays bounded: a mid-size rewrite diff is minimal ---
{
  const ops = AnswerVersions.diffLines("a\nb\nc\nd\ne", "a\nX\nc\nd\nY");
  const changes = ops.filter((o) => o.t !== "ctx").length;
  assert.strictEqual(changes, 4, "minimal edit count for two scattered line changes");
}

console.log("diff core: ALL PASSED");

// --- coexistence guard: dormant while master's response-diff.js (§34b sibling) is present ---
{
  const fs = require("fs");
  const vm = require("vm");
  const ctx = vm.createContext({ ResponseDiff: { open: function () {} }, console: console });
  vm.runInContext(fs.readFileSync(__dirname + "/answer-versions.js", "utf8"), ctx);
  assert.ok(ctx.AnswerVersions && ctx.AnswerVersions.dormant === true, "stays dormant when ResponseDiff is present");
  assert.strictEqual(ctx.AnswerVersions.diffLines, undefined, "dormant export exposes no engine");
}
{
  const fs = require("fs");
  const vm = require("vm");
  const ctx = vm.createContext({ ResponseDiff: { open: function () {} }, localStorage: { getItem: () => "1" }, console: console });
  vm.runInContext(fs.readFileSync(__dirname + "/answer-versions.js", "utf8"), ctx);
  assert.ok(ctx.AnswerVersions && ctx.AnswerVersions.dormant !== true, "av_force=1 activates even beside ResponseDiff");
  assert.strictEqual(fmt(ctx.AnswerVersions.diffLines("a", "b")), "-a\n+b", "forced mode diff engine works");
}

console.log("answer-versions.test.js: ALL PASSED (incl. coexistence guard)");
