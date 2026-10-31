# Reasoning effort: low vs default (owner tier, held-out set, 2026-10-31)

Same 19 held-out questions (eval/heldout/questions.json), run back to back through the live streaming gateway-chat as a temporary confirmed-owner user, once with reasoning effort "low" and once with the model default. One run per condition, graded by one AI judge against the recorded ground truth (same caveats as eval/heldout/RESULTS.md).

Quality
- low: 37/38 points. Default: 37/38 points. Both miss only H12 (both say seven agents where the roster has 16, the table-split chunk issue, unrelated to reasoning).
- All 9 internal-tier answers, both honesty tests (H18, H19), and the public answers matched on both conditions.

Latency (ms, whole 19 questions)
- Total time: low median 3110, mean 3174, max 5091. Default median 3558, mean 3724, max 5651.
- First answer text: low median 1189, mean 1440, max 2663. Default median 1351, mean 1582, max 2760.
- So low is about 13% faster on median total and 12% on median first token. This is small and within what a single run can show; no 15 to 39 s outliers occurred in either condition during this run, so the effect on the long tail is untested.

Decision: quality is unchanged on this set, latency is modestly better, so gateway-chat now defaults to effort "low" (clients may override with the effort field).
