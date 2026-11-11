// node modules/fleet.test.js
const assert = require("assert"); const f = require("./fleet.js");
const t = f.buildOrgTree([{ id: "a", kind: "org", name: "A", parent: null }, { id: "b", kind: "org", name: "B", parent: "a" }, { id: "c", kind: "guardian", name: "C", parent: "b" }, { id: "x", kind: "org", name: "X", parent: "y" }, { id: "y", kind: "org", name: "Y", parent: "x" }, { id: "o", kind: "org", name: "O", parent: "zz" }]);
assert.equal(t.length, 4);                       // a, plus the cycle pair and the orphan fall back to roots
assert.equal(t[0].children[0].children[0].row.id, "c");
assert.deepEqual(f.countBy([{ kind: "a" }, { kind: "a" }, { kind: "b" }], "kind"), { a: 2, b: 1 });
console.log("fleet tree ok");
const tr = f.changeTrail({ status: "pr_opened", events: [] }).map((x) => x.state);
assert.deepEqual(tr, ["done", "done", "done", "done", "active", "todo", "todo"]);
assert.equal(f.changeTrail({ status: "merged" }).every((x) => x.state === "done"), true);
assert.equal(f.changeTrail({ status: "needs_review" })[6].label, "Needs your review");
console.log("changeTrail ok");
