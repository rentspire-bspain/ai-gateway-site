# ai.spaincos.com: 100% Completion Parity Document (v249)
**2026-11-16 (night #13 UTC) · v249 FAKE-DONE DATABASE GUARD (owner directives: "I CANNOT HAVE ANY SINGLE CAPABILITY NOT WORKING PERFECTLY... FREE MODELS CANNOT NO MATTER WHAT LIE ABOUT COMPLETED WORK" + "CONTINUE WITH AS MUCH SERVER-SIDE") — the fake-done enforcement now runs at THREE layers: (1) gateway v247 answer audit + PLATFORM VERIFICATION banner (deployed), (2) the tool-loop guidance forbidding fabricated completion statements (deployed), and (3) NEW: a production DATABASE TRIGGER on public.fleet_dispatch that refuses status='done' when the result text carries the unverified-claim banner — the lane cannot lie even if the model tries; the trigger is applied live (owner-approved) and recorded in-repo at supabase/migrations/20261116070000_fleet_dispatch_done_guard.sql · replay re-run #2: 96.1% (689/717, was 86.8% at v241) · benchmarks: SimpleQA 94.3% (194), FRAMES 67.0% (100), DSQA in flight (65 graded), BrowseComp queued · headline stays 90.4% (8858/98, computed) · teal bar v248**

> **HEADLINE: weighted average total completion 90.4%**. The reproducible §26 score is 8858 ÷ 98 = 90.387755%, rounded to one decimal. Raw tracked-item count: **104✅ / 33🟡 / 20🔴** (157 items). All arithmetic computed by qa/generate-parity-headline.py against qa/parity-items.json v242 — never hand-summed.

## 29cq. v249: THE FAKE-DONE DATABASE GUARD — three-layer enforcement (2026-11-16 ~07:00Z)

**Why a third layer was needed:** the v247 gateway banner audits ANSWERS, but a fleet lane's status field is written by the lane itself — a lane could still flip its own row to done while its answer carries the "verified executions: 0" banner. The database is the last line of defense: the trigger makes the lie IMPOSSIBLE at the write.

**The enforcement (applied live via the Management API, owner-approved, verified by a functional test):**
1. Gateway (v247, deployed): answer audit — every data-operation completion claim cross-checked against the executed tool trace; unbacked claims get the deterministic banner on both stream and non-stream paths; the tool guidance forbids fabricated completion outright.
2. Fleet dispatch DB trigger (v249, live): BEFORE UPDATE on public.fleet_dispatch — if status='done' AND result matches the unverified-claim markers ("verified executions: 0", "claims, not executed results", "never trust self-reported fleet status"), the update is REJECTED with an explicit error. The lane must either post verified results or set status='error'.
3. Repo record: supabase/migrations/20261116070000_fleet_dispatch_done_guard.sql (the exact live DDL).

**Functional verification (run against production):** a fake-done update ("Promoted 50,014 rows — PLATFORM VERIFICATION: verified executions: 0...") → **BLOCKED with P0001 FAKE-DONE GUARD exception**; an honest update ("Executed webapp_upsert (ok): 3 rows verified via re-query") → allowed; sentinel row cleaned up. The guard cannot be bypassed by the lane because it fires inside the database regardless of who writes.

**Scope note (honest):** the trigger keys on the gateway banner text — a lane that avoids the exact banner phrasing in its result while still making unbacked claims in prose would pass the DB layer; the gateway answer-layer audit still catches the ANSWER the user sees. A deeper enforcement (status='done' requires a machine-verified execution artifact, e.g. a webapp_write_log row or queue-row result with http=200) is the v250 design; the plumbing (webapp_write_log exists, apify_call_queue results exist) is already in the platform.

## 29cr. Replay re-run #2 — final: 96.1% (2026-11-16 06:08Z)
The 49 remaining deviations re-ran against gateway v245-v247: **28 remain (D4 24, D7 4)** — 689/717 clean (96.1%, from 86.8% two rounds ago). The D4 residue is concentrated in long multi-part operational prompts (2,600-5,800-char answers that end on tables/lists without terminal punctuation). The D7 four are concurrency-induced 546s (documented serial-pass behavior). Next lever: the v238 truncation retry (6,000-token + continuation merge) needs to fire on the table/list-ending answers too — the D4 detector's tail heuristic flags answers that legitimately end in tables; the fix is a D4 retry that continues-and-merges when the answer ends mid-structure.

## 29cs. Benchmark board (live, updated)
| Benchmark | n graded | strict score | status |
|---|---|---|---|
| SimpleQA | 194 | **94.3%** | complete (100 more queued for the post-v248 re-run) |
| FRAMES | 100 | **67.0%** | complete — re-run scheduled after v248 deploy for the before/after |
| DSQA | 65 graded | 23 correct / 26 partial / 16 wrong (strict-F1 partials recorded separately) | in flight |
| BrowseComp | — | — | queued after DSQA |

DSQA grading note: set-answers are scored with strict item-level F1 (partial = some gold items found); the final score will be reported as both strict-correct rate and mean F1.
