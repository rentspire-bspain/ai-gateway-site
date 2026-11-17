// node modules/automations.test.js
const assert = require("assert");
const a = require("./automations.js");

assert.deepEqual(
  a.SCHEDULES.map((s) => s.value),
  ["hourly", "2x-daily", "daily", "weekly"]
);

assert.equal(a.scheduleLabel("2x-daily"), "2x daily (every 12 hours)");
assert.equal(a.scheduleLabel("weekly"), "Weekly (every 7 days)");

assert.equal(a.validateAutomationInput({ name: "", instruction: "x", schedule: "daily" }).ok, false);
assert.equal(a.validateAutomationInput({ name: "Test", instruction: "   ", schedule: "daily" }).ok, false);
assert.equal(a.validateAutomationInput({ name: "Test", instruction: "Run", schedule: "every-5-sec" }).ok, false);

const okAuto = a.validateAutomationInput({ name: "  Morning brief ", instruction: " Summarize news ", schedule: "2x-daily" });
assert.equal(okAuto.ok, true);
assert.deepEqual(okAuto.value, {
  name: "Morning brief",
  instruction: "Summarize news",
  schedule: "2x-daily",
  enabled: true
});

assert.equal(a.validateDispatchInput({ instruction: "" }).ok, false);
const okDisp = a.validateDispatchInput({ instruction: "  Check health ", priority: "high" });
assert.equal(okDisp.ok, true);
assert.deepEqual(okDisp.value, { instruction: "Check health", priority: "high" });

const sample = [
  { id: "1", status: "queued" },
  { id: "2", status: "running" },
  { id: "3", status: "done" },
  { id: "4", status: "error" }
];
assert.deepEqual(a.summarizeDispatches(sample), { total: 4, queued: 1, running: 1, done: 1, error: 1 });
assert.equal(a.filterDispatches(sample, "active").length, 2);
assert.equal(a.filterDispatches(sample, "done").length, 1);
assert.equal(a.dispatchStatusMeta("done").dot, "fl-s-live");
assert.equal(a.dispatchStatusMeta("error").dot, "fl-s-paused");

console.log("automations ok");
