# Retrieval-augmented re-run (2026-10-31)

Setup: gateway-chat now retrieves up to 6 excerpts per question (BM25 over 162 chunks of Spain Terminal docs at spain-terminal-shell commit 78c4d2d plus the latest nightly anomaly snapshot and a gateway facts file), injects them with numbered labels, and returns only the sources the answer actually cites (invented [S#] markers are stripped). Model: DeepSeek V4.1 Flash (the pinned default) with the PR #1 prompt, max_tokens 2048, through the real gateway-chat function. Raw answers: `raw_answers_retrieval.json`. Grading: one AI judge against the original ground truth, not blind to condition this time (there is a single condition), so treat as indicative.

## Terminal-specific questions (T01-T09)
Before (best condition, no retrieval): 0 of 9 correct (best case honest refusal). After: 7 correct, 1 partial, 1 wrong = 15/18 points (83%).

| Q | Result | Note |
|--|--|--|
| T01 grade for score 66 | correct (B-) | cited V50_GRADE_MAPPING_VERIFICATION |
| T02 scorable universe | correct | also surfaced the open reconciliation issue from ANOMALY_DRIFT |
| T03 'scored' meaning | correct | quoted SCORING_DATA_COVERAGE |
| T04 model version | partial | says v50.0 but hedges on authorization status |
| T05 mean score | correct (41.90) | |
| T06 share with no rent_signal_source | WRONG | answered about 99% (conflated 'rent is observed' 0.8% with 'source field is null' 66%); the snapshot chunk with 65.98% was not retrieved |
| T07 parcels_general rescoring | correct (on hold) | cited LAUNCH_READINESS and FLEET.md |
| T08 properties_base rows / flagged share | correct, fresher | 1,189,952 rows, 19.3% flagged from the 2026-10-30 snapshot |
| T09 gateway cost/models | correct vs current config | ground truth updated: default is now paid DeepSeek, about $0.0003 per question |

## Public questions (Q01-Q31), regression check
About 71% on the same 0/1/2 scale (21 correct, 2 partial, 2 confidently wrong, 5 honest hedges, 1 truncated) versus 74.2% before. No meaningful change (one run, same judge). Weak spots are the 2025-2026 changes: OBBBA 9% allocation increase (stated $4.00 per capita, wrong), success-rate payment standard (wrong), 4% bond test still stated as 50% (stale).

## What it can and cannot answer
Can: scoring definitions, grade bands, universe definition, model version, score statistics, holds and fleet rules, nightly row counts and data-quality rates, with source and line citations.
Cannot: any individual property's score or fields, live queries, anything not in the bundled docs. The corpus is a snapshot and must be rebuilt (`python3 retrieval/build_corpus.py <spain-terminal-shell checkout>`) to refresh; the anomaly figures are dated in the text. Retrieval is keyword-only, so a paraphrased question can miss the right chunk (T06).

## Second run after a retrieval fix (tuned on the miss, so read with caution)
The T06 miss came from the tokenizer treating `rent_signal_source` as one word. I made snake_case column names also match their component words, redeployed, and re-ran T01-T09 (`raw_answers_retrieval_v2_terminal.json`). Result: all 9 correct (T06 now answers 66.0% from the 2026-10-30 snapshot with a citation; T04 now states v50.0 plainly). That is 18/18, but the fix was made after seeing the failure on this same question set, so the honest figure for unseen terminal questions is closer to the first run (about 80%) than to 100%. A held-out set of new terminal questions is the right next test.
