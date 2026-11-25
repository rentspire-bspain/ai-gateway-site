# Gateway eval-replay rolling history

Appended automatically on every full 10-query run of `qa/eval-replay.py` (machine-readable companion: `qa-reports/eval-replay/history.jsonl`).

| Timestamp (UTC) | Deploy ID | Live build | Score | Lanes (research / continuation / status / fact / doc) | Failures | Secs | Exit |
|---|---|---|---|---|---|---|---|
| 2026-11-21T18:37:10+00:00 | `PR#276-seed (baf3b30)` | `v275` | **10/10** | research:3/3 / continuation:2/2 / status:2/2 / fact:2/2 / doc:1/1 | — | 357.7 | 0 |
| 2026-11-21T19:13:01+00:00 | `master-8c8ee47` | `v275` | **10/10** | research:3/3 / continuation:2/2 / status:2/2 / fact:2/2 / doc:1/1 | — | 416.5 | 0 |
| 2026-11-22T07:58:02+00:00 | `unspecified` | `v275` | **10/10** | research:3/3 / continuation:2/2 / status:2/2 / fact:2/2 / doc:1/1 | — | 308.3 | 0 |
| 2026-11-23T17:30:23+00:00 | `9d70894` | `v275` | **10/10** | research:3/3 / continuation:2/2 / status:2/2 / fact:2/2 / doc:1/1 | — | 278.9 | 0 |
| 2026-11-24T07:35:15+00:00 | `gw-v313` | `v275` | **10/10** | research:3/3 / continuation:2/2 / status:2/2 / fact:2/2 / doc:1/1 | — | 37.3 | 0 |
| 2026-11-25T06:19:02+00:00 | `unspecified` | `v275` | **9/10** | research:3/3 / continuation:2/2 / status:1/2 / fact:2/2 / doc:1/1 | status-1 (status): bare completion claim(s) ['completed'] with no 'Claim check:' caveat and no tool evidence beyond research | 30.8 | 1 |
| 2026-11-25T06:46:14+00:00 | `unspecified` | `v275` | **9/10** | research:3/3 / continuation:1/2 / status:2/2 / fact:2/2 / doc:1/1 | continue-2 (continuation): continuation has no substantive content (2 chars) | 171.9 | 1 |
| 2026-11-25T06:48:22+00:00 | `unspecified` | `v275` | **9/10** | research:3/3 / continuation:2/2 / status:1/2 / fact:2/2 / doc:1/1 | status-2 (status): bare completion claim(s) ['merged', 'shipped', 'went live'] with no 'Claim check:' caveat and no tool evidence beyond research | 126.6 | 1 |
| 2026-11-25T08:19:28+00:00 | `unspecified` | `v275` | **10/10** | research:3/3 / continuation:2/2 / status:2/2 / fact:2/2 / doc:1/1 | — | 275.9 | 0 |
