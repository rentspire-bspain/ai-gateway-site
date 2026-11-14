const test = require("node:test");
const assert = require("node:assert");
// Evaluate the module with a stub `root` so the exported pure helpers are captured
// without needing a DOM. The module registers onto root.TeammatesPane.
const src = require("fs").readFileSync(__dirname + "/teammates.js", "utf8");
new Function("localStorage", src)({ getItem: () => "{}" });
const h = globalThis.TeammatesPane;

test("memberRow normalizes a full member", () => {
  const m = h.memberRow({ email: "a@b.co", role: "admin", last_seen: "2026-11-10T00:00:00Z" });
  assert.equal(m.email, "a@b.co");
  assert.equal(m.role, "admin");
  assert.equal(m.name, "a"); // email local-part fallback
  assert.equal(m.lastActive, "2026-11-10T00:00:00Z");
  assert.equal(m.invited, false);
});

test("memberRow: invited status flagged, defaults honest", () => {
  const m = h.memberRow({ email: "x@y.io", status: "invited" });
  assert.equal(m.invited, true);
  assert.equal(m.role, "member"); // default, never invented
  assert.equal(h.memberRow(null), null);
});

test("sortMembers sorts by email and drops junk", () => {
  const rows = h.sortMembers([{ email: "b@b.co" }, null, { email: "a@b.co" }, "junk"]);
  assert.deepEqual(rows.map(r => r.email), ["a@b.co", "b@b.co"]);
});

test("fmtLastActive: date, unparseable, and empty", () => {
  assert.match(h.fmtLastActive("2026-11-10T00:00:00Z"), /\d/);
  assert.equal(h.fmtLastActive("not-a-date"), "—");
  assert.equal(h.fmtLastActive(null), "—");
});
