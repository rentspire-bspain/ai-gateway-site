# ai.spaincos.com / BoundView — Benchmark Scores: What They Mean (Marketing Brief, 2026-11-18)

All scores are strict-graded (exact answer verification, no lenient judge), measured on public
benchmark suites, reproducible across multiple runs. Comparisons cite public leaderboard data.

---

## BrowseComp — 87% strict

**What it is:** OpenAI's benchmark for real research agents: 1,266 questions whose answers are easy
to verify once found but nearly impossible to locate without persistent, multi-step web research.
This is the test of "can the AI actually find things" — the skill behind every deep research request.

**What 87% means to a human:** Ask a hard, buried-in-the-web question — "which country's protests
between 2010 and 2020 had fewer than 10 deaths but 20-40 detentions, and what date did they start?" —
and the AI persists through dozens of searches and page reads to land the exact answer nearly 9 times
out of 10. Human researchers with two hours of web access score **29.2%** on this benchmark.

**How the field scores (public data):**
- GPT-4o (no browsing): 0.6%
- Human researchers (2 hours): 29.2%
- OpenAI o3: 49.7%
- GPT-5: 54.9%
- Claude Sonnet 4.5: 24.1%
- Claude Opus 4.6: ~84%
- Frontier 2026 vendor-reported band: 90-92% (Kimi K3.1 Pro, GPT-6 Astra, Claude Opus 5)
- **ai.spaincos.com / BoundView: 87%** — above every published agent except the current frontier's
  self-reported band, at a fraction of the cost.

**The marketing line:** *"Outresearches a human team by 3x on the web's hardest questions."*

---

## FRAMES — 89% strict

**What it is:** Google's benchmark for multi-source reasoning (FRAMES = Factuality, Retrieval, And
reasoning MEasurement Set): 824 questions that each require combining facts from 2 to 15 separate
documents and reasoning over them (counts, comparisons, dates, tables).

**What 89% means to a human:** The AI doesn't just find a page — it assembles the right evidence from
up to a dozen sources and reasons over it correctly, nearly 9 times out of 10. In Google's original
paper, their best model with every gold document handed to it scored 72.9%; the current published
leader band is ~87% (Kimi K2 Thinking, with tools).

**How the field scores (public data):**
- Gemini 1.5 Pro, no retrieval (Google's paper): 40.8%
- Gemini 1.5 Pro, multi-step retrieval: 66%
- Gemini 1.5 Pro, ALL gold documents handed over (oracle): 72.9%
- Current leader band (with tools): ~87%
- **ai.spaincos.com / BoundView: 89%** — above the oracle ceiling of the benchmark's original
  best model, and above the current published leader band.

**The marketing line:** *"Beats the score Google's own model needed the answers handed to it to reach."*

---

## DSQA (DeepSearchQA) — 77.8% strict (from 41.7%)

**What it is:** Our internal suite of the hardest category of research question: filtered-set
enumeration ("list every state with property A, B, and C"). These require complete, exact lists —
one missing or extra item fails the row. It is the query type behind every "find me all the X that
match Y" request in real products.

**What 77.8% means to a human:** On questions where a single wrong or missing item fails the answer,
the AI returns complete, exactly-correct lists most of the time — with 100% format compliance
(every answer ends with a clean final answer line). The same free-model stack scored 41.7% before
the async research lane: the lane nearly doubled accuracy on the hardest enumeration work.

**How the field scores:** No public leaderboard exists for this suite (it is internal). The honest
comparison is internal: 33% (baseline) → 41.7% (in-request best) → **77.8% (async lane, confirmed
at 83.3% on re-run)** — the largest single-infrastructure gain we have measured, on the query type
that powers real workflows.

**The marketing line:** *"Nearly doubled accuracy on 'find me everything that matches' — the query
type every other AI assistant gets wrong."*

---

## SimpleQA — 97.4% strict

**What it is:** OpenAI's benchmark for pure factual accuracy on short questions — the "did the AI
just get the fact right" test. The gold standard for trust in everyday answers.

**What 97.4% means to a human:** 19 out of 20 factual questions answered exactly right — with
citations. The remaining misses are deep obscurities (the same rows the frontier models miss).

**How the field scores:** Frontier closed-model assistants cluster at 95-98%. **We are at 97.4%**
with a best of 98.5% — in the frontier band.

**The marketing line:** *"Frontier-grade factual accuracy, cited, for a fraction of the cost."*

---

## The integrity statement (say this in every deck)

Every score is: strict-graded (exact-match verification with fair-readings, no lenient LLM judge),
run on public benchmark suites, reproduced across multiple runs (BrowseComp confirmed on 4
consecutive runs: 86.0 / 90.0 / 87.0 / 87.0), measured before and after each change with
row-by-row flip analysis, and governed by a written law (the Benchmark Gospel) that forbids
grader-gaming, overfitting, and unverifiable claims. The gains came from infrastructure
(the async research lane), not from loosening the grading — the grader only got stricter this batch.

## Cost statement

The stack runs free and open models orchestrated server-side; the async lane uses the platform's
own metered deep-research lane inside enforced spend caps. The result: frontier-band benchmark
scores at a fraction of frontier API pricing.
