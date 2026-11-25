# Ontology Drift Guardrails — Codified Permanent Rules

**Filed 2026-11-17 by the quality session, at owner direction ("I cannot have drift whatsoever — permanent, codified rules and guardrails").**
Every rule below was learned live in this database during Oct–Nov 2026, most of them the hard way. These are standing rules, not suggestions: each has a mechanism that already enforces it (noted per rule) and an owner-verification step.

---

## Rule 1 — No out-of-band schema applies
All SQL that changes schema ships through the slot system: `reserve → write file → bind (sha256 + commit) → PR → merge → apply`. Break-glass (`ops.allow_unbound_ledger_apply`) is for incidents only, is logged as `break_glass_unbound_apply`, and **requires a retroactive archive stub PR within 24 hours**.
*Mechanism: RS003 ledger trigger + RS-1 monotonicity guard + drift check. Verified: four out-of-band fleet applies in Nov 2026 each blocked all PRs until stubbed (#3817, #3836, and the two carried on #3820).*

## Rule 2 — Reissues must be additive
Never delete or rename an already-applied migration's file when reissuing. The ledger records history; the repo must mirror it exactly.
*Mechanism: the version-uniqueness check ("already-applied history was deleted/renamed; restore its exact path"). Learned: PR #3937 repaired exactly this.*

## Rule 3 — Merge and apply in the same session
A bound slot's version goes backdated the moment the ledger high-water mark moves past it. The gap between merge and apply is the risk window — hours, not days.
*Mechanism: RS-1 refuses backdated versions. Learned: three D6 reissues (20261110164033, 20261111093802, 20261111114323) went stale in the window; the fourth was applied minutes after merge.*

## Rule 4 — Archive before drop; verify before delete
Every purge candidate gets a full compressed pg_dump archived to private release assets with a manifest (exact row counts + sha256), and the manifest is verified against the live database and the asset checksum byte-for-byte BEFORE anything is dropped. The archive is the permanent restore path.
*Mechanism: the d6-archive workflow pattern (d6-archive + d6-phase3-rent-observations releases). Verified: phase-0 archive verified before the phase-1 drops; the phase-3 archive verified byte-for-byte (39,912,418 rows).*

## Rule 5 — Verify with live counts, never catalog stats
`pg_stat_user_tables.n_live_tup` is unreliable on never-analyzed tables. Purge decisions require real `COUNT(*)` on the candidate table.
*Learned: "1.3 GB of empty-table bloat" was actually 5.3M live rows across three tables; the truncate was aborted at the verification step.*

## Rule 6 — "Unused" requires proof of no active reads AND duplication
A table is purgeable only if ALL hold: (a) zero meaningful scans, (b) no view/function/cron/workflow references (including dynamic SQL in view definitions — pg_depend misses those), (c) its content is duplicated in actively-read tables, (d) a fleet reference check of repo code. Otherwise it is pipeline data.
*Learned: pdi.\*_parcels_stage looked cold but is the live national-parcel ingest path (promotion ran the same morning).*

## Rule 7 — Protected data classes (never purge candidates)
Historical wayback captures (archived rent evidence for Comptrove) and all parcel product data (pdi/spine parcel tables) are protected. Old observations leave the hot DB only via the partition-and-archive path (Rule 4 discipline), never via purge.

## Rule 8 — Fleet out-of-band applies file their own stubs same-day
The drift check blocks every PR in the repo until each unarchived applied version has its exact file on main (verbatim from the authoring repo, digest-matched to the slot). The retroactive archive pattern is the sanctioned repair; the quality session may perform it when the fleet is slow, always with the fleet's original bytes.
*Mechanism: check_migration_drift.py + DEPLOY-HARDEN-1 (checkout-lag re-check against latest main).*

## Rule 9 — Stale-slot hygiene
Bound-but-never-applied slots (superseded reissues) are flagged for the fleet's stale-slot cleanup pattern and must not accumulate. Current known: 20261110164033, 20261117055340.

## Rule 10 — One-time jobs clean up after themselves
Any one-time catch-up/fix job (e.g., the photo-sync catch-up, job 3186) must be unscheduled immediately after its success is verified. No orphaned one-time schedules.
*Verified: the catch-up ran 19:47–19:50 UTC 2026-11-17 and was removed within minutes.*

## Rule 11 — Invalid-index hygiene
Interrupted concurrent index builds leave `indisvalid=FALSE` corpses. A weekly sweep drops or rebuilds them. Current known set: the `spine.parcel_upi_phcand_idx_ccnew*` series and `public.idx_tax_delinq_property_year` (38 total).
*Mechanism: a simple pg_index query; candidate for a fleet cron.*

## Rule 12 — Ontology receipt cadence is a monitored SLA
The `shmt_ontology_control` tracker receipt (ops.ontology_tracker_receipt) must land on its schedule. **Currently breached: last receipt 2026-10-25 (23 days)** while the dataset registry itself updates daily — the report layer, not the data, went quiet. This is the one open ontology-universe gap: the fleet must restore the ontology_control run cadence or the owner is notified.

---

## Current health verdict (2026-11-17, all measured live)

| Layer | State |
|---|---|
| Migration ledger | 🟢 7,511 versions, zero drift (40 newest verified archived; CI drift check green on the latest merge) |
| Fleet activity | 🟢 40 merges/7d, 8 governed migrations today, 33,146 cron runs/24h |
| Harvest/linkage | 🟢 parcel promotion ran today; newest rent observation today; photo-sync healthy after dedup fix |
| Ontology registry | 🟢 3,719 datasets, updated today |
| Ontology receipts | 🟡 last receipt Oct 25 — Rule 12 breach, fleet follow-up |
| Invalid indexes | 🟡 38 known corpses — Rule 11 sweep pending |
| DDL out-of-path audit | 🟡 1,825 events/24h — mostly recurring Supavisor ALTER churn on operational tables; the audit view is the guard, volume is the watch metric |

<sub>Created with [Perplexity](https://www.perplexity.ai/computer/tasks/3fe340fb-38e8-40e8-9a42-b96efa46136c)</sub>

## v350 — Cross-project token discipline + brand separation (incident-driven, 2026-11-25)

1. **NEVER rotate a Supabase GATEWAY_TOKEN on a project whose call-model is called cross-project** (call-model lives on dcyj; bnx callers present the token). The 11-23 rotation caused a 34h silent all-lane 401 outage. Re-alignment path: set `GATEWAY_TOKEN_B` on BOTH projects (secondary accepted token, call-model v57+); the bnx deploy bundles carry a compiled-in fallback until the env secret is set.
2. **Every shared JSON rendered on boundview.com must be brand-audited.** The estate fleet-sweep JSON leaked internal app names on the public BoundView status page. The prelaunch brand-leak gate (Playwright, 8 surfaces) now enforces zero cross-brand strings in the rendered UI.
3. **Every gate must assert lane health, not just answer quality.** The prelaunch lane-health canary (gateway-status all-pass) exists because a dead tool loop hid behind green Perplexity-lane benchmarks for 34 hours.
