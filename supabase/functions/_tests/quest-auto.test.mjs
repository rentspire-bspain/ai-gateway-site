// quest-auto.test.mjs — deterministic offline verification of the EG1 quest auto-completion
// draft (master doc §31.4a, migration 20261122_neurons_quest_auto, STAGED — not applied).
// Verifies, without any database or network, the draft's core safety claim: a replayed or
// unqualified synthetic event cannot award quest credit twice.
//
// The harness reproduces the draft's algorithm exactly (source_event_id construction,
// v_paid pre-check, unique-index enforcement on neuron_ledger.source_event_id) with an
// in-memory ledger whose INSERT enforces the same uniqueness constraint semantics the
// production index idx_ledger_idem provides (unique on source_event_id WHERE NOT NULL).
// Run: node --test _tests/quest-auto.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

// --- in-memory ledger with the production unique-index semantics ---
function makeLedger() {
  const rows = [];
  return {
    insert({ user_id, action_type, source_event_id, amount }) {
      if (source_event_id != null && rows.some((r) => r.source_event_id === source_event_id)) {
        const err = new Error("duplicate key value violates unique constraint \"idx_ledger_idem\"");
        err.code = "23505";
        throw err;
      }
      rows.push({ user_id, action_type, source_event_id, amount });
      return true;
    },
    exists(source_event_id) { return rows.some((r) => r.source_event_id === source_event_id); },
    count() { return rows.length; },
    sumFor(user_id) { return rows.filter((r) => r.user_id === user_id).reduce((a, r) => a + r.amount, 0); }
  };
}

// --- the draft's quest_progress, translated line-for-line (§31.4a) ---
// neuron_earn is stubbed to the real RPC's contract: pay once per source_event_id,
// unique-constraint-protected, returns current balance.
function makeQuestProgress({ ledger, quests, eventsByUser }) {
  function neuron_earn(user_id, action_type, source_event_id, award) {
    if (ledger.exists(source_event_id)) return ledger.sumFor(user_id); // replay: return balance, no second row
    ledger.insert({ user_id, action_type, source_event_id, amount: award });
    return ledger.sumFor(user_id);
  }
  function periodKey(period, now) {
    return period === "daily" ? now.slice(0, 10) : now.slice(0, 7) + "-W" + Math.floor(Number(now.slice(8, 10)) / 7);
  }
  return function quest_progress(p_quest_id, user_id, now = "2026-11-22T12:00:00Z") {
    const q = quests.find((x) => x.quest_id === p_quest_id && x.active);
    if (!q) throw Object.assign(new Error("QUEST_NOT_FOUND"), { code: "P0001" });
    const pk = periodKey(q.period, now);
    const count = (eventsByUser[user_id] || []).filter((e) => e.type === q.metric && e.at < now &&
      (q.period === "daily" ? e.at.slice(0, 10) === pk : true)).length;
    const sourceEventId = `quest:${p_quest_id}:${user_id}:${pk}`;
    let paid = ledger.exists(sourceEventId);
    if (count >= q.threshold && !paid) {
      neuron_earn(user_id, q.action_type, sourceEventId, q.award);
      paid = true;
    }
    return { quest: p_quest_id, progress: Math.min(count, q.threshold), threshold: q.threshold, paid, period_key: pk };
  };
}

const USER = "11111111-1111-1111-1111-111111111111";
const quests = [
  { quest_id: "daily_explorer", title: "Daily Explorer", metric: "query", threshold: 5, period: "daily", active: true, action_type: "quest_daily_explorer", award: 50 },
  { quest_id: "weekly_deep_dive", title: "Weekly Deep Dive", metric: "query", threshold: 25, period: "weekly", active: true, action_type: "quest_weekly_deep_dive", award: 200 },
  { quest_id: "retired_quest", title: "Retired", metric: "query", threshold: 1, period: "daily", active: false, action_type: "quest_retired", award: 10 }
];

test("Q1: below threshold never pays, and replays of the no-pay state still pay nothing", () => {
  const ledger = makeLedger();
  const qp = makeQuestProgress({ ledger, quests, eventsByUser: { [USER]: Array.from({ length: 4 }, (_, i) => ({ type: "query", at: "2026-11-22T0" + i + ":00:00Z" })) } });
  const r1 = qp("daily_explorer", USER);
  assert.equal(r1.progress, 4); assert.equal(r1.paid, false);
  const r2 = qp("daily_explorer", USER); // replay
  assert.equal(r2.paid, false); assert.equal(ledger.count(), 0);
});

test("Q2: threshold crossing pays EXACTLY ONCE — replay cannot award twice", () => {
  const ledger = makeLedger();
  const events = { [USER]: Array.from({ length: 5 }, (_, i) => ({ type: "query", at: "2026-11-22T0" + i + ":00:00Z" })) };
  const qp = makeQuestProgress({ ledger, quests, eventsByUser: events });
  const r1 = qp("daily_explorer", USER);
  assert.equal(r1.paid, true); assert.equal(ledger.count(), 1); assert.equal(ledger.sumFor(USER), 50);
  // replay the SAME call (same synthetic events, same period) — the exact double-award attack
  const r2 = qp("daily_explorer", USER);
  const r3 = qp("daily_explorer", USER);
  assert.equal(r2.paid, true); assert.equal(r3.paid, true);
  assert.equal(ledger.count(), 1);                    // exactly one ledger row
  assert.equal(ledger.sumFor(USER), 50);              // exactly one award
  // even a forged duplicate insert with the same source_event_id is rejected by the unique index
  assert.throws(() => ledger.insert({ user_id: USER, action_type: "quest_daily_explorer", source_event_id: `quest:daily_explorer:${USER}:2026-11-22`, amount: 50 }), (e) => e.code === "23505");
});

test("Q3: period rollover earns fresh credit (new period key), proving idempotency is per-period not global", () => {
  const ledger = makeLedger();
  const events = { [USER]: [...Array.from({ length: 5 }, (_, i) => ({ type: "query", at: "2026-11-22T0" + i + ":00:00Z" })), ...Array.from({ length: 5 }, (_, i) => ({ type: "query", at: "2026-11-23T0" + i + ":00:00Z" }))] };
  const qp = makeQuestProgress({ ledger, quests, eventsByUser: events });
  assert.equal(qp("daily_explorer", USER, "2026-11-22T23:00:00Z").paid, true);
  assert.equal(qp("daily_explorer", USER, "2026-11-23T12:00:00Z").paid, true); // new period, new key
  assert.equal(ledger.count(), 2); assert.equal(ledger.sumFor(USER), 100);      // two DIFFERENT awards, correct
  assert.equal(qp("daily_explorer", USER, "2026-11-23T12:00:00Z").paid, true); // same-day replay still no double
  assert.equal(ledger.count(), 2);
});

test("Q4: inactive quest is rejected", () => {
  const ledger = makeLedger();
  const qp = makeQuestProgress({ ledger, quests, eventsByUser: {} });
  assert.throws(() => qp("retired_quest", USER), (e) => e.code === "P0001");
  assert.equal(ledger.count(), 0);
});

test("Q5: a different user's events cannot pay this user (per-user source_event_id isolation)", () => {
  const ledger = makeLedger();
  const OTHER = "22222222-2222-2222-2222-222222222222";
  const events = { [OTHER]: Array.from({ length: 9 }, (_, i) => ({ type: "query", at: "2026-11-22T0" + i + ":00:00Z" })) };
  const qp = makeQuestProgress({ ledger, quests, eventsByUser: events });
  const r = qp("daily_explorer", USER); // USER has zero events; OTHER's 9 don't count for USER
  assert.equal(r.progress, 0); assert.equal(r.paid, false); assert.equal(ledger.count(), 0);
});
