# UX Item Register — Part E instrument (immutable snapshot)

Generated 2026-11-22 from qa/ux-items.json v15. 386 line items x 7 apps.

## Summary

- Total item IDs: 386
- Fully green (all measured apps G): 51
- Partial/open (Y somewhere): 141
- Known failure (R, no G): 115
- Unmeasured (U everywhere): 79
- Findings register: 30 (F-01..F-30); open S0: 2, S1: 14

## Rubric mapping (UX-LANE register → shared 11-section rubric)

| Rubric | Weight | Items | State |
|---|---:|---|---|
| 01 scope/ownership | 5 | UX-LANE-01 | G |
| 02 functional workflow | 15 | UX-LANE-02, UX-LANE-03 | G/Y |
| 03 UX/accessibility | 10 | UX-LANE-04 | Y |
| 04 data/freshness | 10 | UX-LANE-05, UX-LANE-06 | G/R |
| 05 security/privacy | 10 | UX-LANE-07, UX-LANE-08 | G/Y |
| 06 legal/authority | 10 | UX-LANE-09 | Y |
| 07 integration/readback | 10 | UX-LANE-10 | G |
| 08 CI/release/rollback | 10 | UX-LANE-11 | Y |
| 09 production verification | 10 | UX-LANE-12 | G |
| 10 operations/recovery | 5 | UX-LANE-13 | G |
| 11 adoption/commercial | 5 | UX-LANE-14 | U |

## Per-category counts (item x app)

| Category | G | Y | R | U |
|---|---:|---:|---:|---:|
| A11Y | 9 | 29 | 14 | 81 |
| AG | 1 | 2 | 4 | 2 |
| AI | 16 | 10 | 2 | 2 |
| AUTH | 1 | 11 | 3 | 36 |
| BAL | 1 | 1 | 12 | 0 |
| BV | 2 | 10 | 4 | 4 |
| CAP | 1 | 4 | 3 | 0 |
| COPY | 2 | 12 | 10 | 32 |
| CT | 0 | 4 | 3 | 8 |
| DES | 4 | 17 | 2 | 24 |
| DG | 1 | 6 | 5 | 8 |
| ECON | 0 | 1 | 2 | 2 |
| FORM | 0 | 8 | 0 | 53 |
| FTC | 5 | 2 | 2 | 1 |
| GH | 3 | 5 | 8 | 4 |
| HELP | 3 | 1 | 9 | 12 |
| INT | 0 | 0 | 4 | 1 |
| MEAS | 0 | 7 | 12 | 11 |
| MOB | 10 | 2 | 7 | 59 |
| NOT | 4 | 4 | 5 | 33 |
| NW | 0 | 7 | 20 | 55 |
| ONB | 4 | 5 | 7 | 45 |
| PAY | 3 | 5 | 4 | 24 |
| PEN | 0 | 0 | 5 | 0 |
| PERF | 7 | 7 | 14 | 70 |
| REL | 4 | 10 | 9 | 45 |
| SEO | 3 | 15 | 20 | 37 |
| ST | 7 | 8 | 2 | 7 |
| STATE | 9 | 11 | 6 | 63 |
| TRU | 7 | 20 | 19 | 97 |
| WALL | 2 | 2 | 9 | 0 |

## Shared/duplicate ownership

- Master-doc parity headline + capability items: coordinator lane (ai-gateway-site master cadence v317+).
- Part E UX instrument (this register): UX completion lane — sole writer via PR #342.
- SHMT ledger/gap items: owner-gated (ledger #3500 slot GOs); PRs #4080/#4081 staged by this lane.

## Open gates (no blind retries)

1. PR #342 owner merge approval (auto-deploys production).
2. SHMT ledger #3500 slot GO for PR #4080 (Rule 11 dedup) and PR #4081 (nationwide CR).
3. Adscend publisher approval (Tasks tab go-live).
4. Counsel review of consumer terms (E11).
