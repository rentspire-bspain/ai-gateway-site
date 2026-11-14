// Unit tests for the Usage pane aggregation helpers (section 34b) in modules/usage.js.
// Run: node --test modules/usage.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Usage = require("./usage.js");

const DAY = 86400000, WEEK = 7 * DAY;

// ---------- threadTs ----------
test("threadTs parses updated_at / created_at / local camelCase fields", () => {
  const iso = "2026-11-13T10:00:00.000Z";
  assert.equal(Usage.threadTs({ updated_at: iso }), Date.parse(iso));
  assert.equal(Usage.threadTs({ created_at: iso }), Date.parse(iso));
  assert.equal(Usage.threadTs({ updatedAt: 1770000000000 }), 1770000000000);
  assert.equal(Usage.threadTs({}), null);
  assert.equal(Usage.threadTs(null), null);
  assert.equal(Usage.threadTs({ updated_at: "not a date" }), null);
});

// ---------- weekBuckets ----------
test("weekBuckets: 4 buckets, oldest first, half-open ranges", () => {
  const now = Date.UTC(2026, 10, 13); // fixed "now" — Nov 13 2026
  const buckets = Usage.weekBuckets([], now, 4);
  assert.equal(buckets.length, 4);
  assert.ok(buckets[0].start < buckets[0].end, "bucket 0 spans a week");
  for (let i = 1; i < 4; i++) assert.equal(buckets[i - 1].end, buckets[i].start, "contiguous buckets");
  assert.equal(buckets[3].end, now, "newest bucket ends at now");
});

test("weekBuckets: counts land in the right weekly bucket, old/untimestamped ignored", () => {
  const now = 1_700_000_000_000;
  const items = [
    { updated_at: new Date(now - 0.5 * DAY).toISOString() }, // newest bucket
    { updated_at: new Date(now - 8 * DAY).toISOString() },   // bucket 2
    { updated_at: new Date(now - 8 * DAY).toISOString() },   // bucket 2 again
    { updated_at: new Date(now - 22 * DAY).toISOString() },  // oldest bucket
    { updated_at: new Date(now - 40 * DAY).toISOString() },  // older than window -> ignored
    { title: "no timestamp" },                                // ignored
    { updated_at: "garbage" },                                // ignored
  ];
  const b = Usage.weekBuckets(items, now, 4);
  // oldest bucket gets the 22d-old thread, middle bucket the two 8d-old ones, newest the 0.5d one
  assert.deepEqual(b.map((x) => x.count), [1, 0, 2, 1]);
});

test("weekBuckets: boundary timestamps belong to the newer bucket (half-open)", () => {
  const now = 1_700_000_000_000;
  const b = Usage.weekBuckets([{ updated_at: new Date(now - 2 * WEEK).toISOString() }], now, 4);
  // exactly 2 weeks old starts bucket index 2 (the [now-3w, now-2w) range)
  assert.deepEqual(b.map((x) => x.count), [0, 0, 1, 0]);
});

// ---------- topModels ----------
test("topModels: servedModel wins, sorted by count desc then name, capped at n", () => {
  const msgs = [
    { servedModel: "glm-4.6", model: "ignored" },
    { servedModel: "glm-4.6" },
    { model: "qwen3-coder" },
    { model: "qwen3-coder" },
    { servedModel: "kimi-k2" },
    { role: "user" }, // no model metadata
  ];
  const top = Usage.topModels(msgs, 2);
  assert.deepEqual(top, [
    { model: "glm-4.6", count: 2 },
    { model: "qwen3-coder", count: 2 }, // tie -> name asc
  ]);
});

test("topModels: empty when no per-message model metadata exists (honest not-recorded case)", () => {
  assert.deepEqual(Usage.topModels([{ role: "assistant", content: "hi" }, {}]), []);
  assert.deepEqual(Usage.topModels(null), []);
});

// ---------- avgLen ----------
test("avgLen: mean char length over non-empty answers", () => {
  const r = Usage.avgLen(["12345", "1234567890", ""]);
  assert.equal(r.n, 2);
  assert.equal(r.avg, 7.5);
});

test("avgLen: empty set never returns NaN", () => {
  assert.deepEqual(Usage.avgLen([]), { avg: 0, n: 0 });
  assert.deepEqual(Usage.avgLen(["", null, undefined]), { avg: 0, n: 0 });
  assert.deepEqual(Usage.avgLen(null), { avg: 0, n: 0 });
});

// ---------- recentItems ----------
test("recentItems: newest first, timestamp-less entries last, sliced to n", () => {
  const now = 1_700_000_000_000;
  const items = [
    { id: "old", updated_at: new Date(now - 10 * DAY).toISOString() },
    { id: "newest", updated_at: new Date(now).toISOString() },
    { id: "mid", updated_at: new Date(now - DAY).toISOString() },
    { id: "nots" },
  ];
  assert.deepEqual(Usage.recentItems(items, 3).map((t) => t.id), ["newest", "mid", "old"]);
  // n=4 keeps the timestamp-less entry at the end
  assert.deepEqual(Usage.recentItems(items, 4).map((t) => t.id), ["newest", "mid", "old", "nots"]);
  // pure: input array untouched
  assert.equal(items[0].id, "old");
});

// ---------- parseCount ----------
test("parseCount: reads the total from PostgREST Content-Range headers", () => {
  assert.equal(Usage.parseCount("0-0/5647"), 5647);
  assert.equal(Usage.parseCount("*/5647"), 5647);
  assert.equal(Usage.parseCount("0-999/5647"), 5647);
  assert.equal(Usage.parseCount("*/0"), 0); // zero rows
  assert.equal(Usage.parseCount(""), null);
  assert.equal(Usage.parseCount(null), null);
  assert.equal(Usage.parseCount("no-slash-here"), null);
});
