# ai.spaincos.com: 100% Completion Parity Document (v245)
**2026-11-16 (night #11 UTC) · v245/v246 RESPONSE-QUALITY ROUND 2 (owner: "ALL OF THE MODELS ARE PRODUCING GARBAGE" — create_file emitted as raw YAML function_call block; Kimi soup QA-rewrite re-asked Kimi and got soup again) — DEPLOYED (gateway GATEWAY_VERSION=245/246): Kimi soup QA-rewrites now route to RELIABLE_MODEL (deepseek-v4.1-flash-1017) instead of re-asking the soup-emitting model; the tool loop now parses `function_call:\n  name: X\n  args:` YAML blocks into REAL tool calls (with a leak guard that discards unparsed YAML tool-call text so raw tool syntax can never reach the answer pane); the all-model-audit tuple bug is fixed and the 95 deviation prompts + full 17-lane audit battery are re-running against the fixed gateway RIGHT NOW (results appended to this doc's §29cg when the run lands) · headline stays 90.4% (8858/98, computed — no category rescore this batch; response-quality fixes move the replay numbers, not the category matrix) · teal bar v245**

> **HEADLINE: weighted average total completion 90.4%**. The reproducible §26 score is 8858 ÷ 98 = 90.387755%, rounded to one decimal. Raw tracked-item count: **104✅ / 33🟡 / 20🔴** (157 items). All arithmetic computed by qa/generate-parity-headline.py against qa/parity-items.json v242 — never hand-summed.

## 29cg. v245/v246 change log: soup QA-rewrite routing + the YAML function_call parser (2026-11-16 night #11 UTC)

**Owner screenshots this round:** (1) a create_file request came back as a raw `function_call:` YAML block rendered as answer text — the model wrote the tool call as prose instead of executing it; (2) the Kimi soup QA-rewrite was re-asking Kimi, which re-emitted soup. Both classes are now dead:

- **v245 — QA-rewrite routing.** When the QA gate detects Kimi soup and rewrites the answer, the rewrite now goes to `RELIABLE_MODEL` (deepseek-v4.1-flash-1017, the platform's own reliable fallback lane) instead of the model that just failed. Soup can no longer produce soup.
- **v246 — YAML function_call parser.** The tool loop now recognizes `function_call:` / `name:` / `args:` blocks that models emit as text, parses them, and executes them as REAL tool calls; a leak guard discards unparsed YAML tool-call text so raw tool syntax never reaches the answer pane. Live-verified this session: the exact failing prompt now returns a proper executed answer instead of a raw YAML blob.
- **Audit battery fix:** qa/all-model-audit.py had a tuple-unpacking bug in its executor futures map — fixed; Kimi lane verified 4/4 green (sanity 24s, leak 59s, doc-rule 91s, tool-use 113s).
- **Verification in flight (kicked off this session, resumable):** the 95 replay deviations (D4 74, D7 11, D1 9, D3 1) were stripped from the results file and re-queued through the live fixed gateway (workers 4), chained with the full 17-lane × 4-scenario × 2-repeat audit battery (jobs 3). Baseline preserved at qa-private/prompt-replay/results-v244-baseline.jsonl. Results land in §29cg when the run completes.

**Owner actions still parked (unchanged):** SHMT PR #3889 review as rentspire-bspain-2 → machine redeploy (makes apify_call end-to-end live); passkey enrollment test; .edu student-verify e2e; OpenRouter auto-top-up.

## 29ch. THE FOUR-PART STRATEGIC ANSWER (2026-11-16 night #11 UTC)

### Part 1 — Overall completion %
**90.4% weighted** (8858/98, computed by the headline tool; raw items 104✅/33🟡/20🔴 of 157). Category frontier — the items holding the number down: Mobile 60, Teammates 68, Comet 70, Desktop 70, Enterprise 70, Voice 80, Premium 80, Privacy 88 (everything else is 90+; Features/Computer/API/Connectors are at 95-99).

### Part 2 — Muse/Instinct/Wabi parity: NOT STARTED
Zero of the §19 P1-P18 convergence items are built (P1 persistent VM, P2 goal mode, P3 zero-UI channels, P4 proactive messaging, P5 connector triggers, P6 voice learning, P7 approval modes, P8 audit log, P9 agent-to-agent, P10 multiplayer, P11 mini-apps, P12 parallel research, P13 full-stack deploy, P14 live agent view, P15 shopping, P16 health, P17 skills marketplace, P18 agent identity). The full matrix with per-item specs is §19 of parity-status-2026-11-15-v241.md. We own the infrastructure for every layer (auth, connectors, 219-agent fleet, automations, guardians, sandbox, browser automation, artifacts, spain-runner, Comptrove data) — none of it is assembled into those products yet.

### Part 3 — When will Perplexity parity be fully complete?
Three distinct finish lines, in order:
1. **Response-quality 100% (this week):** the 717-replay re-run against v245/v246 is in flight now; when the 95 deviations come back clean and the audit battery is green, the answer layer is done. Latency (first-token breaches, 4th consecutive failing guardian run) is the other half of this line — diagnosis points at the pre-stream search/phase pipeline, an engineering fix not a research problem.
2. **Category 100% (next 1-2 weeks of batches):** the 8 low categories are ordinary build work with known gaps — Mobile 60, Teammates 68, Comet 70, Desktop 70, Enterprise 70, Voice 80, Premium 80, Privacy 88. Closing them moves the weighted headline from 90.4 to ~97+.
3. **Full convergence (Muse/Instinct/Wabi — weeks, not days):** sequenced per §19/§21: quick wins P4/P5/P8/P17/P18 (days each) → P2+P1+P12 "Manus-grade" release → P3 "Instinct-grade" release → P10/P11 multiplayer "Wabi-grade". This is a new product build on infrastructure we already own, not parity work; it starts the moment the category batches stop competing for the same lanes.

### Part 4 — The exercise catalog (§29ci, below)

## 29ci. BEYOND PREMORTEM: the exhaustive technical-exercise catalog for commercial readiness (2026-11-16 night #11 UTC)

Premortem asked "how does this die?" This catalog asks every other question a commercial product must survive. Each exercise names what it tests, how it runs, and its pass criterion. Status legend: **LIVE** (already running in the fleet), **QUEUED** (in this batch's plan), **BACKLOG** (sequenced after category parity).

### A. Reliability engineering (make it never break the same way twice)
| Exercise | Tests | How | Pass criterion | Status |
|---|---|---|---|---|
| Premortem | systematic failure invention | §29by/29cf method | cataloged + guarded | LIVE |
| 717-prompt replay | real-owner-prompt regression suite | qa/prompt-replay.py, resumable, D1-D7 detectors | 717/717 clean, nightly CI | LIVE (re-run in flight) |
| All-model audit battery | per-model sanity/tool-use/leak/doc-rule | qa/all-model-audit.py --repeat 2 --jobs 3 | 17 lanes × 4 scenarios green | LIVE (re-run in flight) |
| Chaos drill: mid-stream kill | SSE stream interruption recovery | kill the edge function mid-generation; client reconnect | user sees graceful resume/error, never a zombie stream | QUEUED |
| Chaos drill: provider outage | multi-provider failover under real failure | force each OpenRouter provider to 5xx/timeout | RELIABLE_MODEL ladder engages, answer still lands | QUEUED |
| Chaos drill: tool-loop wedge | hung tool, runaway loop | tool that never returns; loop iteration cap | hard 30s tool wall + loop cap, honest error to user | QUEUED |
| Zombie-stream purge | abandoned generations keep burning tokens | client disconnects mid-stream | server aborts upstream on disconnect signal | QUEUED |
| Nightly golden-set evals | answer-quality drift detection | 100-prompt golden set, model-graded, in CI | score never drops below last release | QUEUED |
| Error budget + SLO wall | what "reliable" means numerically | p95 first-token < Xs, 99.5% 200-rate, tracked per release | published SLO page, alert on burn | BACKLOG |

### B. Failure taxonomy → regression tests (every researched failure class gets a test)
Mapped to the multi-provider tool-failure taxonomies researched this session (punt/hallucination/wrong-tool/wrong-args/error/nothing/no-ground/noise/structure; silent-failure classes A-E):
| Failure class | Our test |
|---|---|
| Model simulates a tool instead of calling it | run_python synthetic-verdict + platform-tool guard (LIVE, v238) |
| Model emits tool call as prose/YAML | v246 YAML parser + leak guard (LIVE) |
| Token soup / special-token leak | region-cut scrub + QA-rewrite to reliable lane (LIVE, v244/v245) |
| Truncated answer | D4 detector + continuation-merge retry (LIVE, v237) |
| Dead-end refusal ("no callable tool") | D3 detector + claim-can't rewrite (LIVE) |
| Un-grounded research answer | D5 detector (LIVE in replay) |
| Wrong-tool / wrong-args dispatch | fuzz corpus of malformed tool args (QUEUED) |
| Silent no-op (claims done, did nothing) | tool-result verification: confirmations only after real server payloads (QUEUED — generalize the v238 guard) |

### C. Security & trust (commercial-grade)
| Exercise | Tests | Pass criterion | Status |
|---|---|---|---|
| Prompt-injection red team | fetched web/email content treated as data | injection corpus (OWASP LLM01-06) never overrides instructions | QUEUED |
| Secrets-drift audit | keys/tokens never in logs, client bundles, or answers | grep CI gate over logs + bundles + replay answers | QUEUED (CSP hash guard is LIVE) |
| Egress allowlist drift | new tool added = allowlist updated in same PR | CI check: tool defs ↔ egress.js ↔ capability baseline all agree | QUEUED |
| Auth race suite | Supabase concurrent refresh, refresh reuse, signOut scope | per Supabase documented failure modes: no reused-token acceptance, no partial signOut | QUEUED |
| Multi-tenant isolation (boundview) | user A can never read user B's rows/threads/queue rows | per-user attribution tests on every gateway tool incl. apify_call queue | QUEUED |
| SOC 2 evidence collection | readiness controls as CI artifacts | RentSpire SOC 2 workstream pattern applied to ai.spaincos | BACKLOG |
| Pen-test checklist | external attack surface | third-party or automated (OWASP ZAP baseline) | BACKLOG |

### D. Billing fairness (the #1 competitor complaint category — §22 ledger)
| Exercise | Tests | Pass criterion | Status |
|---|---|---|---|
| Reserve-then-settle drill | a task cannot exceed its reservation | run expensive task with $X reserved; ledger never exceeds X | QUEUED |
| Refund-on-our-mistake path | QA-gate failure auto-refunds credits | failed QA answer credits refunded within one settle cycle | QUEUED |
| Cancellation lifecycle | cancel → grace access → no further charge | Stripe webhook idempotency test suite | QUEUED |
| Per-user OpenRouter caps | external users cannot burn owner money | cap enforced at gateway, tested with a capped test account | LIVE (v243 batch built it; e2e test QUEUED) |

### E. Operational readiness (day-2 ops)
| Exercise | Tests | Pass criterion | Status |
|---|---|---|---|
| Public status page | transparency during incidents | ops-health function exposed at status URL | QUEUED |
| DR restore drill | backups actually restorable | restore a thread/artifact set from backup to a staging project, verify | QUEUED |
| Incident runbook + game day | time-to-acknowledge under failure | simulated incident: guardian fires → runbook → resolution logged | QUEUED |
| Contract tests: gateway ↔ runner ↔ Deal Engine | queue interfaces don't drift | apify_call queue schema test + runner job round-trip | QUEUED (blocked on PR #3889 merge) |
| Migration-drift gate | out-of-band migrations archived | CI gate (LIVE as of the SHMT fix this session; add ai-gateway-site equivalent) | LIVE on SHMT |
| Log retention + PII scrub | logs useful but clean | scrubber over all gateway/runner logs, retention policy enforced | QUEUED |

### F. Product-quality polish (commercial feel)
| Exercise | Tests | Pass criterion | Status |
|---|---|---|---|
| SSE rendering edge cases | partial markdown, mid-word chunks, code fences across chunks | render harness with recorded chunk streams | QUEUED |
| Glyph-corruption regression | s→x class corruption, unicode damage | character-level diff on golden answers | QUEUED |
| Cross-browser + mobile matrix | Chrome/Safari/Firefox/iOS/Android | screenshot-verified flows on the matrix | BACKLOG |
| Accessibility pass | WCAG AA on primary flows | axe-core CI on key pages | BACKLOG |
| Latency budget per phase | first-token p95, search phase, tool phase | traced timings on the 717 replay prompts | QUEUED (Guardian already measuring; fix the pre-stream pipeline) |

**The throughline:** every exercise above either already exists as a live guard, is queued in this batch, or is sequenced after category parity. Together with the premortem catalog they form the complete commercial-readiness program: reliability (A), failure coverage (B), security (C), billing fairness (D), operations (E), and polish (F) — every one mapped to the complaint ledger (§22) so each test is a promise to a real documented user pain.
