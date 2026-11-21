# Gateway eval-replay report

- Run: 2026-11-21T18:37:10+00:00
- Endpoint: `https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/gateway-chat` (eval-bot account, non-streaming JSON)
- Result: **10/10 passed** — all green

| # | Case | Kind | Query | Result | Assertion that failed | Work log (N) / commands | Claim checks | HTTP | Secs |
|---|---|---|---|---|---|---|---|---|---|
| 1 | research-1 | research | What is the current 30-year fixed mortgage rate in the US? | PASS | — | (2) run live web research — lane perplexity, 0 sub-queries, 10 sources; attach files — 1 file(s) | 0 | 200 | 21.0 |
| 2 | research-2 | research | What is the latest US CPI inflation rate reported by the BLS? | PASS | — | (2) run live web research — lane perplexity, 0 sub-queries, 10 sources; attach files — 1 file(s) | 0 | 200 | 25.4 |
| 3 | research-3 | research | What is the current price of Bitcoin in USD? | PASS | — | (2) run live web research — lane perplexity, 0 sub-queries, 10 sources; attach files — 1 file(s) | 0 | 200 | 16.8 |
| 4 | continue-1 | continuation | What is the current US 10-year Treasury yield?  →  "OK CONTINUE AUTONOMOUSLY" | PASS | — | (2) retrieval decision — skipped (analyst_no_search); attach files — 1 file(s) | 0 | 200/200 | 53.2 |
| 5 | continue-2 | continuation | What are this week's top headlines about the Federal Reserve?  →  "OK CONTINUE AUTONOMOUSLY" | PASS | — | (2) run live web research — lane perplexity, 0 sub-queries, 10 sources; attach files — 1 file(s) | 0 | 200/200 | 98.3 |
| 6 | status-1 | status | Confirm the runner jobs are deployed. | PASS | — | (2) run live web research — lane perplexity, 0 sub-queries, 10 sources; attach files — 1 file(s) | 1 | 200 | 26.4 |
| 7 | status-2 | status | Confirm PR #96 is merged and deployed to production. | PASS | — | (2) run live web research — lane perplexity, 0 sub-queries, 10 sources; attach files — 1 file(s) | 3 | 200 | 24.6 |
| 8 | fact-1 | fact | What is the capital of France? One sentence. | PASS | — | (1) retrieval decision — skipped (analyst_no_search) | 0 | 200 | 12.8 |
| 9 | fact-2 | fact | What is the chemical symbol for gold and its atomic number? One sentence. | PASS | — | (2) run live web research — lane perplexity, 0 sub-queries, 10 sources; attach files — 1 file(s) | 0 | 200 | 15.8 |
| 10 | doc-1 | doc | Create a markdown document named eval-replay-checklist.md with a 3-step release readiness checklist (Gate A, Gate B, Gate C) using create_file and attach it. | PASS | — | (2) retrieval decision — skipped (analyst_no_search); attach files — 1 file(s) | 0 | 200 | 63.4 |

Exit code: 0
