# BENCHMARK GOSPEL — the standing performance law of ai.spaincos.com / BoundView.com

**Owner directive, codified 2026-11-17 by Brett Spain. These rules are binding on every agent,
guardian, automation, build lane, and subagent working on ai.spaincos.com, BoundView.com, or any
sibling in the Spain Companies platform. They are version-controlled in this repo and may only be
changed by owner directive.**

## The creed

**The benchmarks are the gospel on performance.** SimpleQA, FRAMES, DSQA, and BrowseComp — strict
grading, fair-reading grader (v256+) — are the ONLY accepted measure of answer-quality improvement.
There is no other claim of "better" that counts.

## The law (binding rules)

1. **Measure everything.** Any change that can affect answer quality (gateway, tool loop, research
   lanes, writer prompts, retry logic, model routing) MUST be measured by a full benchmark round
   before it is called an improvement. No exceptions. A change with no round behind it is
   "unmeasured", never "an improvement".

2. **Reproducible gains only.** A lever counts as an improvement only if its gain is reproducible —
   held across at least two rounds, or clearly beyond run noise. Noise floors (binomial, strict
   grading): SimpleQA n=200 ±2%, FRAMES n=100 ±4.3%, DSQA ±5%, BrowseComp ±4.7%. A one-round jump
   inside the noise band is a draw, not a win. Cite the noise floor with every reported delta.

3. **Regressions are fixed within one round.** If a round regresses beyond noise (the v255 case:
   SimpleQA 98.0 → 95.5, DSQA 43.4 → 38.0), the lever is fixed or reverted and re-measured in the
   very next round. Never ship a regression and move on.

4. **Never game the grader.** The grader grades fairly and only fairly: fair readings of gold
   (unit synonyms, hyphenation, gold-cores) are added; nothing that inflates scores. Every grader
   change must be verified offline against the archived results with zero regressions on
   previously-correct rows before it merges (PR #209 is the precedent and the pattern).

5. **No overfitting.** No dataset-specific hacks: no gold answers or benchmark phrasings in
   prompts, no per-question special cases. Levers must be general rules that fire on question
   SHAPE (multi-constraint, narrative-chain, set-aggregation), never on question content. Every
   predicate is tested offline against all four corpora for false-fires (SimpleQA 0 false-fires
   is the bar) before it ships.

6. **Archive and compare every round.** Every round is archived (`qa-private/bench/results-vNNN/`)
   and committed as a PR with the full row-by-row grid (✅/🟡/🔴 icons, Gold and Verdict/Fail
   filled on every row). Improvement claims are made from row-by-row flip analysis, not headline
   arithmetic.

7. **The headline is computed, never hand-summed.** Parity completion percentages come from
   `qa/generate-parity-headline.py` against `qa/parity-items.json`. Benchmark strict scores come
   from `qa/ruthless-bench.py --report`. No human or agent arithmetic in any report.

8. **Resource discipline.** Benchmark rounds NEVER run concurrently with the pre-launch harness
   or audit loads (546 WORKER_RESOURCE_LIMIT). One suite at a time.

9. **Cadence.** The suite runs on every gateway deploy that touches the answer path, and on a
   standing cadence during active improvement campaigns (nightly while iterating). The
   self-improvement guardians run on schedule between rounds and every defect they catch becomes
   a deterministic, versioned rule in the gateway.

10. **Miss-mode accounting.** Every round's misses are classified (truncation, entity-binding,
    retrieval-depth, gold-conflict, knowledge-miss) and every miss class either has an owner-lever
    or is parked with a reason in the completion doc. No unexplained misses.

11. **Honest ceilings.** The goal is the honest ceiling for each benchmark — SimpleQA toward 100%,
    FRAMES/DSQA/BrowseComp toward their SOTA-relative ceilings — never at the cost of honesty.
    Data-conflict golds (where the dataset answer conflicts with retrievable sources) are audited
    as dataset errors, not model failures, and reported as such.

12. **Cost rule stays.** Benchmark egress and the agent fleet run free models; paid lanes only
    through the product's own spend caps (per-user daily ceilings, global monthly cap,
    fail-closed allowlist). A performance lever that triples spend (the v258 council) must carry
    its cost math in the change record.

## Enforcement (how this law polices itself)

- **The PR gate**: every benchmark-round PR carries the grid, the flip analysis vs the prior
  round, and the noise-floor statement. A PR without them does not merge.
- **PARITY_STATE**: every gateway change is recorded in the versioned PARITY_STATE log with root
  cause + measured effect. The log is the audit trail.
- **The grader is version-controlled**: grader changes are PRs with offline verification.
- **The guardians**: scheduled self-improvement runs catch quality regressions between rounds;
  each caught defect becomes a permanent rule.

## Change record

| Date | Change | By |
|---|---|---|
| 2026-11-17 | Gospel codified from owner directive (this session, rounds 1-6) | Brett Spain (directive) / parity session |
| 2026-11-18 | **v262 ASYNC RESEARCH LANE + TABLE-VERIFIED SETS codified** (SOTA teardown: BrowseComp leaders are RL-trained agents with 300+ step budgets, multi-agent swarms, context management — see Round-9 owner analysis). Rule 13: BrowseComp-class questions route to the async deep-research lane (submit + poll; the 150s edge wall killed 28/100 round-9 rows as HTTP 504 at 150.1s). Rule 14: set questions get the Table-as-Search treatment (candidate × constraint table, enumeration sub-query, FINAL ANSWER = exactly the qualifying rows). Rule 15: the training-recipe ladder (CPT → SFT → RL on search trajectories) is the documented path for the next tier of gains; harness-level equivalents (step budgets, swarm verification, context compaction) are the free-model proxies until then. | Brett Spain (directive) / parity session |
| 2026-11-18 | **v264 ASYNC-EVERYWHERE (rounds 12-14)**: the async research lane rolled across all research suites — BrowseComp 38.9→87.0 (4 confirming runs), DSQA 41.7→77.8 (confirmed 83.3), FRAMES 77.3→89.0 (confirmed 96.7). SPEND_CEILING_USD raised 50→200 (owner-approved). Rule 16 added: research benchmarks run the async lane; the in-request lane is the legacy path. SFT export tool shipped (qa/sft-export.py, 466 verified examples). | Brett Spain (directive) / parity session |
| 2026-11-18 | **v263 grader fair-reading fix** (FRAMES gold-conflict audit: trailing-formality gold variants — "140 years old." → "140 years", "Blue Ribbon Sports Inc." → "Blue Ribbon Sports"). Offline-verified on the full r9 archives: +2 FRAMES, +1 DSQA, +0 SimpleQA, 0 negative flips. The token-subset reading is deliberately NOT added — it loosens. | parity session (audit directive: rule 11) |

## Rule 13 — Async research lane (BrowseComp-class questions)

Multi-hop research questions that cannot finish inside the 150s Supabase edge wall
(round 9: 28/100 BrowseComp rows died as HTTP 504 at 150.1s — infrastructure, not
modeling) MUST run on the async lane: submit a background deep-research run
(`deep_research: true`, `deep_research_effort`, `deep_research_style: "concise"`),
return the run id immediately, poll `GET ?deep_research_id=` until completed. The
bench harness runs this lane with `--async-deep`. A BrowseComp round through the
in-request lane measures the wall, not the model.

## Rule 14 — Table-verified set answering (DSQA-class set questions)

A filtered-set question is a table-completion problem (the SOTA "Table-as-Search"
recipe): one row per candidate, one column per constraint, every cell verified
against a source. Detection is two-signal (the intent analyst's `set_question`
LLM flag OR the offline-tested set-phrase regexes — the v259 predicate fired on
only 1/42 round-9 partial rows). Detected questions upgrade to complex so the
planner emits an enumeration sub-query plus one per constraint. The FINAL ANSWER
line carries exactly the qualifying rows — no padding, no near-misses.

## Rule 15 — The training-recipe ladder (the documented next tier)

What the BrowseComp leaders actually do (verified 2026-11-18): RL-trained search
agents — continual pre-training on massive corpora, then supervised fine-tuning
(SFT) on search trajectories, then reinforcement learning (RL) against
answer-verification rewards. Our stack runs free third-party models, so the ladder
maps to: (a) harness-level proxies NOW — persistent step budgets (the async
lane), swarm verification (the council), context compaction (source capping),
Table-as-Search (rule 14); (b) trajectory data NOW — every round's archive
(results-vNNN/) is exactly the SFT dataset shape (question → search trajectory →
verified answer); (c) the SFT/RL run itself is an owner-level infrastructure
decision (GPU budget, base-model choice) — parked with the exact recipe in the
completion doc, not silently attempted.

## Rule 16 — Research benchmarks run the async lane (2026-11-18, rounds 12-14)

SimpleQA (single-fact lookups) may run in-request; FRAMES, DSQA and BrowseComp rounds
run through the async research lane (`--async-deep`, medium effort) — the in-request
lane's 150s wall and clock-pressured writer are a structural cap (proven: DSQA 41.7%
in-request vs 77.8% async with 100% FINAL-ANSWER compliance on the same sample and
grader). A benchmark score from the in-request lane measures the wall, not the model
(extends rule 13).
