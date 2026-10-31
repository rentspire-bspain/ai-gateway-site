# Held-out terminal eval (2026-10-31)

19 new questions (`questions.json`), written after retrieval was built and not used for any tuning: 17 about the Terminal docs (8 from the public-safe tier, 9 from the internal tier) and 2 honesty tests (a specific property's rent, and company revenue). Ground truth and source file for each are in the question file. Run through the live gateway-chat function with the PR #1 system prompt and DeepSeek V4.1 Flash, as two real users: a temporary owner account and a temporary viewer account (both deleted). Answers: `raw_answers.json`. Grading: one AI judge (the same model that wrote the questions) against the truth, 2 = correct, 1 = partial, 0 = wrong; not blind (single condition), so read it as indicative.

## Scores
| Account | Questions it can answer | Points | Notes |
|--|--|--|--|
| Owner (full corpus) | 19 | 37 of 38 (97%) | 18 correct, 1 partial |
| Viewer (public-safe corpus) | 10 (8 public-tier plus the 2 honesty tests) | 20 of 20 (100%) | all correct |
| Viewer on the 9 internal-tier questions | 9 | 9 of 9 declined honestly | none of the internal facts leaked; the model said the documentation it had did not cover them |

The one miss: the fleet roster has 16 agents, and the model said seven, because the roster table was split across chunks and only the first seven rows were retrieved. It got the Anomaly and Drift mission right. This is a real retrieval weakness: tables that span chunks can yield confident undercounts.

## What this does and does not show
- The earlier 80% estimate was too pessimistic for fact-lookup questions that are answerable from a single doc passage: held-out accuracy was 97% (owner).
- It does not show performance on questions that need synthesis across several docs, arithmetic, or live data; I wrote both the retrieval and the questions, so overlap in vocabulary favors keyword retrieval. Treat 97% as an upper bound on easy lookups.
- A first attempt (`raw_answers_run0_invalid_owner_was_public.json`) was discarded: the owner account was mistakenly served the public tier because the service-role shortcut in the owner check does not fire (the project's service key is not a readable JWT). Owner status works only through a confirmed owner email. That path is what was tested in the valid run.
- Median latency per answer was about 3.3 seconds for the owner and 2.6 seconds for the viewer.
