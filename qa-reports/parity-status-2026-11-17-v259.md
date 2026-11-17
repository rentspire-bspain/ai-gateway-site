# ai.spaincos.com — 100% Completion Parity Document (2026-11-17, v259)

## §29cx — Offer-wall Phase 1 COMPLETE: postback endpoint live, HMAC enforced, 30-day simulation clean, PR #14 merged

**Headline (computed by qa/generate-parity-headline.py): 90.4% (8858/98; 104✅ / 33🟡 / 20🔴 of 157).** No category rescore this batch — this section tracks the boundview offer-wall Phase 1 (partner monetization of the Free tier), which is complete end to end on the infrastructure side. Every item below is verified against the live Supabase project (bnxermyboeigvwonfrzx) with attached evidence.

### The completion table (G/R/Y with strikethroughs — done items struck)

| # | Status | Item | Evidence |
|---|---|---|---|
| ~~1~~ | ✅ | ~~Postback endpoint deployed (`offerwall-postback` edge function, server-to-server, no CORS/JWT)~~ | Supabase edge function v7 ACTIVE, live URL responding |
| ~~2~~ | ✅ | ~~Idempotent credit RPC (`partner_offerwall_credit`: (provider, txn) unique + ledger source_event_id, duplicates never double-mint)~~ | Live test: duplicate trans_id → body `0`, exactly one ledger row |
| ~~3~~ | ✅ | ~~Velocity caps enforced (10/day, 60/month per user, UTC periods)~~ | 30-day sim: day-3 burst of 12 → exactly 10 verified + 2 cap_daily; day 8 onward → cap_monthly with zero neurons |
| ~~4~~ | ✅ | ~~Cap race fixed (check-then-act → `pg_advisory_xact_lock` per user+day)~~ | Migration `offerwall-cap-race-lock` applied live; 12-request concurrent burst produced exactly 10 credits |
| ~~5~~ | ✅ | ~~Unknown-user / malformed / unknown-provider requests return `0` cleanly (no retry storms)~~ | Live probes: all return HTTP 200 body `0`, no postback rows |
| ~~6~~ | ✅ | ~~Neurons minted through the governed ledger (150 N base from OUR catalog — network reward values never trusted) with 1-year expiry~~ | neuron_ledger rows verified: action_type offerwall_task, expires_at = now()+1y |
| ~~7~~ | ✅ | ~~HMAC-SHA1 signing live: OFFERWALL_SECRET_ADSCEND set in a deny-all `offerwall_secrets` table (service-role-only RPC read; value never in code/logs/repo)~~ | Unsigned + tampered-signature probes → `0`, never reach the RPC; signed requests verify |
| ~~8~~ | ✅ | ~~Full 30-day postback simulation against the live endpoint (143 requests, 2 users)~~ | 106 verified / 27 cap-rejected / 15,900 neurons / 0 double-credits / 0 unauthenticated credits; test data fully removed after the run |
| ~~9~~ | ✅ | ~~Spec + migration + code merged to governed-sql default branch (PR #14)~~ | https://github.com/rentspire-bspain/ai-gateway-governed-sql/pull/14 — MERGED 2026-11-17T17:43:51Z |
| ~~10~~ | ✅ | ~~Gig Hub neuron funnel mockup deployed (Free-tier Tasks tab design)~~ | Deployed mockup, Playwright QA'd (task cards, modal flow, neuron credit animation, contrast fixes) |
| 11 | 🟡 | Tasks tab wiring: boundview frontend embeds the offer wall with `subId=<user_uuid>` and shows verified offers | Blocked on item 13 (Adscend account); design done in the Gig Hub mockup |
| 12 | 🟡 | FTC disclosure copy on every offer card ("Partner offer — boundview may earn a referral fee") | Spec'd (§5 of the postback spec); ships with the Tasks tab |
| 13 | 🔴 | **Adscend Media publisher account signup — OWNER-ONLY** (needs Brett's business info: legal name, tax form, payment details, domain boundview.com) | https://adscendmedia.com/publishers — signup form; approval typically 1-3 business days |
| 14 | 🔴 | Point Adscend global postback at our endpoint (owner, 5 min after approval): map `subId` → user UUID, `transId` → trans_id | Spec §5; endpoint already enforces signature + caps |

### The 30-day simulation (run 2026-11-17 UTC, live endpoint)

- **Traffic:** 143 requests over 30 simulated days — heavy user (8-12 offers/day early, cap-limited later) + light user (1-2/day), plus duplicate retries, tampered signatures, and unknown users.
- **Results:** 106 verified (60 heavy, 46 light) · 27 cap-rejected · 15,900 neurons minted · 0 double-credits · 0 unauthenticated credits · simulated network share $96.22.
- **Bugs found and fixed during the run:** (1) the cap check was check-then-act — two concurrent postbacks could both pass at daily_used = 9 and mint 11; fixed with a per-user daily advisory lock, verified by re-running the 12-request burst (exactly 10). (2) Unknown-user requests hit the postback FK and returned 500, which would make networks retry forever; fixed with a no-user guard returning `0`.
- **Cleanup:** all simulation data removed (postbacks, ledger rows, caps, sim user, helper functions) — ledger shows 0 offerwall rows; the eval user's caps reset.

### Owner-only blockers (unchanged from §29cw parking lot, plus this section's)

1. **Adscend publisher account** (item 13 above) — the only Phase 1 blocker left. Signup steps are in the session record below.
2. The standing list: broaden fine-grained PAT, register OAuth apps, apply 4 SQL migrations, Supabase auth_config_write (passkeys), Twilio credentials, SHMT PR #3889 approve+merge + redeploy runner, passkey e2e, .edu student-verify e2e, OpenRouter auto-top-up, low-balance credit alert.

**Session record:** governed-sql PR #14 MERGED (feat/offerwall-phase1 → default). Edge function offerwall-postback v7. Migrations applied live: `2026-11-15-partner-offerwall` (schema+RPC), `offerwall-no-user-guard`, `offerwall-cap-race-lock`. Spec: `_specs/offerwall-postback-spec.md` in governed-sql (shared as an artifact 2026-11-15). Pricing model unchanged: Phase 1 gate = $500/mo offer-wall run-rate before Phase 2 (gig affiliate ladder).
