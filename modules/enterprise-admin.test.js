const test = require("node:test");
const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/enterprise-admin.js", "utf8");
new Function("localStorage", src)({ getItem: () => "{}" });
const h = globalThis.EnterpriseAdminPane;

test("dispatchRow normalizes and truncates the instruction head", () => {
  const d = h.dispatchRow({ id: "abc-123", instruction: "fleet-dispatch   build task (turn 1 of 1): MOBILE-RESPONSIVE PASS with lots of extra words that go past eighty characters for sure", status: "done", created_at: "2026-11-14T12:19:00Z" });
  assert.equal(d.id, "abc-123");
  assert.equal(d.status, "done");
  assert.ok(d.head.length <= 80);
  assert.equal(d.head, "fleet-dispatch build task (turn 1 of 1): MOBILE-RESPONSIVE PASS with lots of ext");
  assert.equal(h.dispatchRow(null), null);
  assert.equal(h.dispatchRow({}).status, "unknown"); // never invented
});

test("seatUsage: with limit, without limit, junk input", () => {
  assert.deepEqual(h.seatUsage([1, 2, 3], 10), { members: 3, seats: 10, usedPct: 30 });
  const u = h.seatUsage([1]);
  assert.equal(u.usedPct, null); // no limit configured — honest, never guessed
  assert.equal(u.seats, null);
  assert.deepEqual(h.seatUsage("junk", "junk"), { members: 0, seats: null, usedPct: null });
});

test("fmtAt renders parseable timestamps and honest dashes", () => {
  assert.match(h.fmtAt("2026-11-14T12:19:00Z"), /\d/);
  assert.equal(h.fmtAt("garbage"), "—");
  assert.equal(h.fmtAt(undefined), "—");
});

test("isAdminRole gates the pane correctly", () => {
  assert.equal(h.isAdminRole("owner"), true);
  assert.equal(h.isAdminRole("admin"), true);
  assert.equal(h.isAdminRole("member"), false);
  assert.equal(h.isAdminRole(""), false);
});
