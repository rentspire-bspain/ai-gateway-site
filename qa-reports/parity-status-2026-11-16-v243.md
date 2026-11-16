# ai.spaincos.com: 100% Completion Parity Document (v243)
**2026-11-16 (night #10 UTC) · v243 APIFY SERVER-SIDE (owner directive: "make sure Apify is also being run server-side and callable from ai.spaincos.com and boundview.com") — the apify_call gateway tool is DEPLOYED (gateway v238): sessions enqueue rows in staging.apify_call_queue on the Deal Engine, trigger the runner job apify_call via the existing fly-api runner_job path, and the job executes the Apify HTTP call ON the Fly machine where the APIFY_TOKEN lives as a Fly secret — the token never leaves the machine, never passes through any session, never appears in any log. Every signed-in session gets list_datasets / dataset_items / actor_list; actor_run is admin-only (it consumes Apify credits). Gateway v238 also carries the D4/D3 replay fixes (complex prompts get the full 4,000-token budget; truncation retry 6,000 tokens + second-pass continuation merge; claim-cant rewrite fires on cometAsk) and the synthetic-verdict guard (run_python refuses fabricated completion/capability verdicts — the owner's screenshot incident, live-verified: the model now answers honestly instead of printing hard-coded "5/5 True") · headline stays 90.4% (8858/98, computed) · teal bar v243**

> **HEADLINE: weighted average total completion 90.4%**. The reproducible §26 score is 8858 ÷ 98 = 90.387755%, rounded to one decimal. No category rescore this batch (the Apify lane is new capability, not a category score change). Raw tracked-item count: **104✅ / 33🟡 / 20🔴** (157 items). All arithmetic computed by qa/generate-parity-headline.py against qa/parity-items.json v242 — never hand-summed.

## 29ce. v243 change log: APIFY SERVER-SIDE — the full architecture, what is live, and the one owner action (2026-11-16 night #10 UTC)

**What the owner asked:** Apify must run server-side and be callable from ai.spaincos.com and boundview.com.

**What is LIVE now (gateway v238, deploy id faf69cb4 version 242, live-verified):**
- The `apify_call` tool is registered in the gateway's tool allowlist (default-deny egress now grants it to every signed-in session), offered in the tool defs, dispatched in the tool loop, and named in the CAPABILITY BASELINE and the CONNECTED APPS line — sessions can no longer claim Apify is unavailable.
- The tool's flow: insert a row into `staging.apify_call_queue` on the Deal Engine (the queue rows are the audit log with per-user attribution) → trigger `node src/runner.mjs --once apify_call` via the existing fly-api machine-exec path → poll the row for the result (the job writes `{http, ok, payload}` back, capped at 200KB).
- The runner job `apify_call.mjs` (SHMT PR #3889, all 40 CI checks GREEN including the migration-drift gate): reads pending queue rows, executes the Apify HTTP call ON the machine with the machine's `APIFY_TOKEN` (a Fly app secret), writes results back. Stale 'running' rows are requeued (crash-safe). Actor runs are wall-capped at 120s so a wedged actor cannot hold the job.
- **boundview.com**: the tool lives in the shared gateway, so any future boundview session gets the identical capability with per-user attribution (the v234 x-user-id work) — no per-site rebuild needed.

**Cost guard (owner rule: "I cannot lose money on usage from external parties"):** dataset/actor lists and dataset-item reads are open to signed-in sessions (read-only API calls); `actor_run` — which consumes Apify credits — is ADMIN-ONLY at the tool layer, and the runner caps run-sync wall time. Free-tier external users can never trigger a paid actor run.

**Live verification (this session):** the exact capability question through the live gateway now answers with the real apify_call tool result instead of a refusal — the honest current state ("no Apify token authorized the call") because the runner job is not deployed to the machine yet (that is the owner action below). The tool-name leak in that first answer (a run_python conflation) is queued as a minor polish item.

**THE ONE OWNER ACTION (parked per the standing rule):** SHMT PR #3889 is fully green (all checks) but requires a code-owner review from the **rentspire-bspain-2** account (the second-identity review gate on `/runner/` per the coordinator ruling) before it can merge. Exact steps: open https://github.com/rentspire-bspain/SHMT/pull/3889 signed in as rentspire-bspain-2 → Approve → Merge (squash). Then the runner machine redeploy (`python3 infra/fly/spain-runner/deploy_machine.py` — the script bakes all runner/src jobs automatically and validates jobs.json ↔ files) makes the job live, and the gateway tool goes end-to-end green. I can run the machine redeploy the moment the PR merges.

**Also fixed this round (side quest, required to unblock the PR):** the migration-drift CI gate was red for EVERY open PR — two out-of-band ledger migrations (20261114121500 concession_monthly_discount_grant, 20261115080000 reenable_hist_coverage_snapshot_refresh) had no repo files. Archived same-stamp under Rule 35 with the EXACT statements from the live schema_migrations ledger (queried via the Management API; nothing inferred — the classifier correctly blocked my first inferred reconstruction, and the ledger's own `statements` column held the real SQL).

## 29by. v237: THE 717-PROMPT FULL-HISTORY REPLAY — FINAL DEVIATION LIST (2026-11-15 late UTC, complete)

**Run:** the full extracted Perplexity prompt history (717 unique prompts, scrubbed, private corpus at qa-private/) replayed through the live gateway (auto-routed, real research + tool lanes) — 717/717 completed, ~7h wall clock, 4 workers, token re-mint on expiry. This is the COMPLETE final list; earlier partial counts (365, 492) are superseded by this section.

**Final tally: 622/717 clean (86.8%). Deviations: 95 total (13.2%).**

| Class | Count | Rate | What it is | Status |
|---|---|---|---|---|
| D4 truncated answer | 74 | 10.3% | Answer ends mid-word — 68 of 74 verified by tail inspection as REAL truncations (not detector noise); 21 of the 74 rode HTTP 546 (upstream retry exhaustion), so truncation correlates with upstream strain. Median truncated answer 2,502 chars. | **FIX DEPLOYED (gateway v237/v238)** — complex prompts get the full 4,000-token budget; the QA retry is 6,000 tokens with a second-pass continuation merge. Re-run of the 95 pending. |
| D7 worker resource limit | 11 | 1.5% | WORKER_RESOURCE_LIMIT after retries on heavy fleet/completion prompts — the v230 auto-invocation machinery + parallel evidence gathering exceeds the edge worker envelope on the heaviest directives | OPEN — fix queued: trim auto-injected evidence size, lazy/sequential fetch under load. |
| D1 error/empty | 9 | 1.3% | 6 client read timeouts (generations exceeding the read window), 1 server 504 idle timeout (150s), 2 mid-run 401 session expiries the harness re-mint did not recover (both prompts re-runnable) | PARTIAL — the timeout class overlaps D4/D7 (long generations); the 2 401s are harness artifacts, not gateway defects |
| D3 dead-end refusal | 1 | 0.1% | "HANDLE WHATEVER ELSE IS REMAINING YOURSELF AND IN COMET" → answered "cannot be executed from this session" — the v233 COMET never-refuse rule did NOT hold for this phrasing (routing fell outside the cometAsk matcher) | **FIX DEPLOYED (gateway v237/v238)** — the claim-can't rewrite regex now includes the "cannot be executed from (this|the) session" pattern and fires on cometAsk. Re-run pending. |
| D2 token leak | 0 | 0% | none | CLOSED |
| D5 research-no-sources | 0 | 0% | none | CLOSED |
| D6 refuse-all | 0 | 0% | none | CLOSED |

**Next actions (ranked):** (1) OWNER: approve+merge SHMT PR #3889 as rentspire-bspain-2, then I redeploy the runner machine — Apify server-side goes live; (2) re-run the 95 deviation prompts against gateway v238 to confirm D4/D3 closure; (3) D7 — evidence-size trim + lazy fetch; (4) the all-model audit battery (qa/all-model-audit.py, 17 lanes x 4 scenarios, --repeat 2); (5) first-token latency (4 straight guardian runs over threshold — the pre-stream search/phase pipeline is the suspect, not the providers).

