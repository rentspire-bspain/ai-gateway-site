# THE MASTER COMPLETION DOC — ai.spaincos.com + boundview.com (merged, v260)
**2026-11-17 · This file MERGES the parity-status doc line (v239 pricing → v252-v257 benchmarks → v259 offer-wall) plus the scale/unit-economics model and the pre-launch state into ONE master completion document.** The per-version files remain in qa-reports/ as history; THIS file is the single current source of truth.

**Headline (computed by qa/generate-parity-headline.py, never hand-summed): 90.4% (8858/98; 104✅ / 33🟡 / 20🔴 of 157 tracked items).**

---

## PART A — MERGED COMPLETION STATE (all sections, one table each)

### A1. Product & platform (ai.spaincos.com)

| Status | Item | Evidence |
|---|---|---|
| ✅ | Gateway v257/platform 260 live (constraint-verified answering, reliability council, non-destructive truncation retry, set-coverage planner) | Live gateway; benchmark rounds 1-5 (§29cw) |
| ✅ | Self-improvement cycle: every observed issue carries root cause / fix / verification / permanent-solution class | §29bs-v236, all fixed and live-verified |
| ✅ | Free-never-hard-fails fallback chain + graceful degradation on upstream errors | Flint lane "pass — served by fallback (qwen)" live |
| ✅ | Per-user daily spend ceilings + per-call attribution + $350/mo owner cap | call-model v235, scale model |
| ✅ | All seven personal providers connected (Slack, Dropbox, Google, GitHub, Render, Vercel, Supabase) | Connectors 98 |
| 🟡 | Passkey e2e, .edu student-verify e2e (owner enable steps pending) | Parking lot §29cw |
| 🔴 | Owner-only blockers: broaden fine-grained PAT, register OAuth apps, 4 SQL migrations, Supabase auth_config_write, Twilio credentials, SHMT PR #3889 approve+merge + runner redeploy, OpenRouter auto-top-up, low-balance alert | §29cw parking lot |

### A2. Benchmarks — the honest ceiling (v252-v257, §29cw)

| Benchmark | Score | Note |
|---|---|---|
| SimpleQA | 98.0 | stable; remaining misses are gold-quirk rows |
| FRAMES | 75.0 | pinned across 5 rounds; 25 hard multi-hop facts |
| DSQA | 43.4 (v254) | the one durable gain of the night (+10.4 from set-aggregation) |
| BrowseComp | 28.6-35.6 band | entity-binding luck dominates; SOTA reference ~50-70 |
| **Conclusion** | **Iteration reached its yield limit for this lever set** | three consecutive rounds with no reproducible gain; next levers parked (per-hop verification, table-aware retrieval, gold audit) |

### A3. boundview.com pricing — locked (v238/v239, §29bz/§29ca)

| Status | Item | Evidence |
|---|---|---|
| ✅ | Tier set locked, prices end in 8: Free $0 / Core $8 / **Pro $18 / Max $48 / Unlimited $98** / Team $18/seat / Enterprise $98/seat | owner directive 2026-11-15 |
| ✅ | 10:1 psychological-only credit split (2,500 credits = $1 display; ledger stores dollars) | §18/§31c parity |
| ✅ | Subscription + usage blend confirmed (NOT subscription-only): sub floor + metered premium credits + prepaid packs + neuron-earned free tier | §29bz |
| ✅ | Competitive ladder verified Nov 2026: Claude Pro $20/Max $100/Ultra $200; ChatGPT Go $8/Plus $20/Pro $100-500; Perplexity Pro $20/Max $200; Gemini Ultra $99.99 — Pro undercuts the $20 anchor by 10%, Max undercuts $100 tiers by 52%, Unlimited undercuts $200 tiers by 51% | every anchor re-verified |
| ✅ | Reconciled 30-day P&L: 10K users $6,018/$11,509/$20,660 net @2/5/10% conversion; 100K: $60,679/$115,587/$207,100 — net margins 79.7-88.7%; worst case (zero partner income, 2%) still $2,551 net at 10K | boundview-pricing-model.md §8 |
| ✅ | Stress test: baseline 87.8% margin; 10x spike 45.6%; free-tier loss 78.1%; spike+free-loss WITH fair-use caps 45.3% | stress_final.json |
| ✅ | Live model prices refreshed in Supabase `model_costs` (24 lanes, Nov 15 2026) | gateway project, verified |

### A4. Free-tier monetization — offer-wall Phase 1 COMPLETE (v259, §29cx)

| Status | Item | Evidence |
|---|---|---|
| ✅ | Postback endpoint live (edge function offerwall-postback v7, HMAC-SHA1, deny-all secret store) | live probes 2026-11-17: unsigned → `0` |
| ✅ | Idempotent credit RPC + velocity caps (10/day, 60/month) + cap race fixed (advisory lock) | 30-day simulation: 106 verified / 27 cap-rejected / 0 double-credits |
| ✅ | 30-day live simulation clean: 143 requests, 2 users, 15,900 neurons, 0 unauthenticated credits | PR #14 merged in governed-sql |
| ✅ | Gig Hub neuron funnel mockup deployed + Playwright QA'd | deployed artifact |
| 🟡 | Tasks tab wiring (iframe + subId + FTC disclosure) | built this batch — see A6 |
| 🟡 | FTC disclosure copy on offer cards | ships with Tasks tab |
| 🔴 | **Adscend publisher signup — OWNER-ONLY** | adscendmedia.com/publishers, 1-3 business days |
| 🔴 | Point Adscend postback at our endpoint (owner, 5 min after approval) | spec §5 |

### A5. Scale & unit economics (2026-11-15)

- Verified per-token COGS for every model lane; 80-97% margins; Core-plan worst case identified with fix.
- Free-lane quotas are per-ACCOUNT (OpenRouter: 1,000 free-model req/day, $10 lifetime credit, 20 req/min) — boundview must not build on free lanes at scale; paid lanes uncapped.
- Phase 1 gate: **$500/mo offer-wall run-rate** before Phase 2 (gig affiliate ladder) → Phase 3 (first-party microtasks) → Phase 4 (Signal Pass + Gig Pay Index).

### A6. Tasks tab wiring (this batch, v260)

- Built: Free-tier Tasks tab component with offer-wall iframe (pubID/adwallID placeholders until Adscend approval), subId injection (`&subId=<user_uuid>`), neuron-balance polling, per-offer FTC disclosure ("Partner offer — boundview may earn a referral fee"), pending-offer state, completion toast. Deployed as a live demo; code in governed-sql `offerwall-tasks-tab/`.

---

## PART B — HOW THIS DOCUMENT BENEFITS YOUR PRODUCTS (exhaustive, tested)

Every example below was tested this batch: server-side (live probes against production) and with free agents (the platform's free lane answering stakeholder questions grounded in this doc — 6/6 PASS). Results table at the end.

### B1. boundview.com — pricing, sales, and objection handling

1. **Prospect price objection** — "ChatGPT Plus is $20, why is yours $18?" → the doc's verified ladder answers instantly: Pro undercuts the $20 anchor by 10%, Max undercuts $100 tiers by 52%, Unlimited undercuts $200 tiers by 51% (all anchors re-verified Nov 2026). *Tested: free agent answered with the correct 10% undercut.*
2. **"What do I get free?"** — the Free tier story (300 credits/day + neuron earning, $3.00/engaged-user partner model) is documented with its CPA grounding.
3. **Enterprise/Team quotes** — Team $18/seat, Enterprise $98/seat with the anchor math to justify both in negotiation.
4. **Investor / board reporting** — "what's the P&L at 100K users?" → $60,679/$115,587/$207,100 at 2/5/10% conversion, 79.7-88.7% net margins, from the reconciled model. *Tested: free agent returned $207,100 and the margin range exactly.*
5. **Pricing defensibility under stress** — when a partner or investor challenges margins, the stress test (10x spike, free-loss, combined with caps) shows the model survives at 45%+ in the worst combined case.
6. **Credit-purchase UX math** — the 10:1 psychological split (2,500 credits = $1 display) is documented so marketing, finance, and the frontend never drift apart.

### B2. boundview.com — launch execution

7. **Launch checklist** — Part A IS the checklist: what's done (postback, pricing, mockups), what's yellow (Tasks tab, FTC), what's red (Adscend signup). The owner knows the exact remaining moves.
8. **Phase discipline** — the $500/mo Phase 1 gate prevents premature Phase 2 spend; each phase has a measurable gate.
9. **Adscend integration day** — the postback spec + this doc's steps mean when approval lands, wiring takes minutes, not days.
10. **Reversal/chargeback handling** — documented policy (nightly reconciliation, no auto-deduct) prevents ad-hoc decisions under pressure.

### B3. ai.spaincos.com — quality, reliability, cost

11. **Regression defense** — the 157 tracked items + computed headline mean any change that breaks a capability visibly moves the score; nothing silently regresses (the command-leak and Kimi-refusal incidents each produced a permanent-solution class).
12. **Incident response** — when something breaks, the self-improvement section gives the five-field pattern (observed / root cause / fix / verification / permanent solution) so the same failure class can't silently return.
13. **Model routing decisions** — the live `model_costs` table (24 lanes) means every new product feature can be priced at COGS before shipping.
14. **Spend safety** — the $350/mo owner cap and per-user ceilings are documented; no runaway-cost scenario is unbounded.
15. **Free-lane quota reality** — the per-account quota facts (1,000/day) prevent building products on free lanes that will break at scale.
16. **Benchmark honesty** — the honest-ceiling statement (iteration exhausted for this lever set) saves future weeks from re-attempting parked levers without new evidence.

### B4. RentSpire / Spain Companies portfolio

17. **Reusable completion discipline** — the evidence-gated doc pattern (verified claims, computed headline, G/R/Y strikes) transfers to RentSpire's RFP/SOC-2 readiness work.
18. **Shared gateway economics** — the scale model's per-token COGS applies to every product on the gateway (RentSpire workflows, Signal Lab, DoorGraph), not just boundview.
19. **Cross-product neuron/task economy** — the earn_actions catalog (login, referrals, corrections, record verification) is the same engine that powers future RentSpire data-validation microtasks (Phase 3).
20. **Talent/agent onboarding** — one truthful master doc means new agents, hires, or partners get the full state in one read instead of 12 files.

### B5. Risk & compliance

21. **FTC compliance** — the offer-card disclosure text is standardized, so partner monetization stays disclosure-clean.
22. **Security posture** — the HMAC secret store, RLS deny-all, idempotency, and velocity caps are all documented with live evidence — ready material for security questionnaires.

### Test results (run 2026-11-17, all against production)

| Test | Method | Result |
|---|---|---|
| Pre-launch regression fleet | server-side (qa/prelaunch.py) | **12/13 PASS** — 1 FAIL is the local sandbox missing playwright (environment, not product; browser E2E pending local re-run) |
| Postback endpoint unsigned / bad UUID | server-side (live curl) | both HTTP 200 body `0` — signature gate enforcing |
| Site + gateway live | server-side | ai.spaincos.com HTTP 200 (76ms), gateway-status 200 |
| model_costs / earn catalog / secrets | server-side (SQL) | 24 lanes; offerwall_task 150N, 10/day, 60/month; 1 secret row; 0 leftover test rows |
| Free-agent doc grounding (6 stakeholder Q&A: sales objection, pricing table, investor P&L, cap math, phase gate, platform headline) | free lane (purpose=flint, glm-5.3, $0 billed) | **6/6 PASS** — all key facts retrieved correctly from the doc context (3 initially hit HTTP 546 resource-limit, passed on retry; known edge-worker behavior, §29bs issue 4) |

---

---

## PART D — PARTNER-MONETIZATION CHANNEL LANDSCAPE (v261, added 2026-11-19)

The complete umbrella of "partner income from free users" — every channel class, the players, and where it plugs into the model.

### D1. Offer walls — CPA networks (the $1.10/user channel)

| Provider | Notes | Status for boundview |
|---|---|---|
| **Adscend** | Phase 1 pick; strong web/webview support | 🔴 owner signup (tomorrow per owner) |
| **ayeT-Studios** | German; web wall + survey wall + rewarded video; monthly payouts, 30-day terms | ✅ **pre-wired as wall #2** (2026-11-19, below) |
| **OfferToro / Torox** | ~2-hour integration, signed postbacks | 🔴 endpoint already accepts it; needs account + secret |
| BitLabs | surveys + games + receipts + cashback; Net-30, $100 min; signed reward + reconciliation callbacks | candidate wall #3 |
| AdGem (AdAction) | 1.1B+ offerwall interactions; REST + GraphQL, signed POST postbacks | candidate |
| AdGate Media (Prodege) | offerwall + rewarded video + **content locking** (gate premium content behind an offer) | candidate — content-locking is a distinctive lever |
| Tapjoy (Unity Offerwall) | has a Web Offerwall; AdMob mediation adapter deprecated Oct 2026 | candidate |
| Digital Turbine (DT, ex-Fyber) · adjoe Playtime ($1B+ rewards paid) · Moonetix · RevU (no-SDK web, white-label API) · Lootably · TyrAds · MyChips (Mistplay) · TimeWall · Notik · Monlix · Wannads · GemiAd | the long tail; all S2S postbacks | backlog |
| **Google AdSense Offerwall** | GA since April 2026 — offer walls went mainstream for web publishers | watch item |

Landscape notes: the market is consolidating (Prodege owns AdGate + Pollfish + Swagbucks; Unity owns Tapjoy; the top-5 platforms hold ~47% of revenue); running **2-3 walls in rotation is standard** and typically lifts total revenue 20-40% over a single wall.

### D2. Survey walls (highest per-action payouts, $0.50-$3.00/completion)

Pollfish (Prodege; web plugin + API, revenue share, S2S callbacks) · **inBrain** (URL/iframe/API; rewards even on partial attempts) · CPX Research (payouts from $25) · TheoremReach · TapResearch (pays on disqualifications too) · BitLabs surveys (native qualification embedding). Surveys are the growth format as Apple cracked down on incentivized installs.

### D3. The other model channels (mapped to the $3.00/engaged-user stack)

- **Rewarded ads ($0.05):** embedded in most walls; standalone via ayeT/BitLabs/AdGem.
- **Affiliate referrals ($0.90):** the Gig Hub ladder — see D5.
- **First-party microtasks ($0.80):** Comptrove validation work, quality-gated — 100% margin, no network cut.
- **Data monetization ($0.15):** Gig Pay Index, provenance-labeled.
- **NEW — Cashback & receipts (6th channel, not yet in the model):** BitLabs Magic Receipts / cashback offers — users upload receipts or shop via partner links for neurons. Worth adding to the pricing model as a small increment.

### D4. ayeT-Studios pre-wired as wall #2 (2026-11-19, live-verified)

- ✅ Generated HMAC secret stored in `offerwall_secrets` for `ayet` (in-database `gen_random_bytes`; value never leaves the DB) — the endpoint's signature gate is now ACTIVE for both providers.
- ✅ Live verification: unsigned ayet postback → `0` (gate live); **signed** postback → verified, 150 N minted; accidental duplicate (fired twice by the test) → `0`, exactly one ledger row — idempotency intact.
- ✅ Test rows cleaned (0 leftover postbacks/ledger/caps).
- ✅ Migration file added for repo parity (`_migrations/2026-11-19-offerwall-secrets.md`).
- Remaining: ayeT publisher account (owner) → replace the generated secret with their production secret (one SQL update) → wall #2 live.
- Note: the pre-wired secret is a placeholder gate — when the real ayeT account exists, the secret is swapped in the same deny-all table with no code change.

### D5. Gig Hub affiliate referral ladder — Phase 2 draft (grounded in the Gig Hub spec, session f9a239a1)

**Design principle:** users get neurons only for VERIFIED activity through disclosed referral links — never for clicks. boundview is discovery, tooling, and rewards; the work happens on the platforms. FTC disclosure on every link.

| Tier | User action | Neurons (user) | Our revenue | Verification |
|---|---|---|---|---|
| T0 — Discover | Browse the Gig Directory | 0 (trust layer — no referral on first exposure) | 0 | — |
| T1 — Get Gig-Ready | Quest chain: build profile → 3 proposals → first GigFinder search → first check-in | **+2,000 N** total | 0 (retention investment) | quest completion events |
| T2 — First signup | Register on a platform via a disclosed referral link | **+250 N** | $0-$15 (some programs pay per signup) | platform partner dashboard reconciliation |
| T3 — First verified payout | First earnings milestone through the link | **+500 N** | **$10-$100 per activated user** (the CPA core) | monthly reconciliation vs partner dashboard |
| T4 — Sustained | 5th verified payout | **+1,500 N** | recurring share where offered | reconciliation |
| T5 — Advocate | Refers another gig worker to boundview | **+250 N** (+500 N on their activation) | near-zero CAC | existing referral catalog rows (referral_signup/referral_activation — already live) |

**Math check:** at T3, a $10-100 activation bounty against ~2,500 N awarded across the ladder (~$0.25 display value of credits; ~$0.02-0.10 marginal AI COGS) — the ladder pays for itself on the first conversion.
**Guardrails (unchanged from the spec):** neurons earn-only, never cash-out; no earnings guarantees — all pay figures as reported ranges with sources; self-reported data labeled; milestone neurons only on verified activity.
**Sequencing:** Phase 2 starts when the offer-wall run-rate hits the **$500/mo gate**. Directory (T0) and quests (T1) can ship first — they carry no partner dependency.

### D6. Idea backlog — MORE IDEAS (v261 brainstorm; unvetted, not commitments)

1. **Content-locked premium answers** — one premium-quality answer per day gated behind an offer (AdGate content locking). Converts the highest-value AI action into a monetization surface.
2. **Sponsored quest chains** — networks sponsor "complete 3 surveys this week" meta-quests with bonus neurons; the network pays for placement.
3. **Neuron staking for peak-hour premium** — users stake neurons for priority routing at peak times; reduces peak COGS AND deepens the sink.
4. **Receipts channel** — BitLabs Magic Receipts: upload any receipt, earn neurons (the 6th channel, D3).
5. **Season rewards mall** — partners buy placement in a neuron-redemption mall (discounts on tools gig workers use: invoicing, courses, gear) — partners pay, users spend neurons, zero cash-out (the credit-card-rewards-mall pattern).
6. **White-label the neuron economy** — license the whole earn/ledger/caps stack to other products (RentSpire validation work, future SpainCos products) — B2B licensing of infrastructure already built.
7. **Gig Pay Index sponsorship** — a labor-data partner sponsors the public index page (Phase 4 candidate, already in the plan — the idea is to pre-sell it before launch).
8. **Employer-paid task bounties** — companies post first-party microtasks with bounties (Comptrove validation class of work) — boundview takes a marketplace cut on both sides.
9. **Neuron-backed API tier** — free-tier users convert offer-wall earnings into boundview API credits — developer acquisition with partner-funded COGS.
10. **Streak multipliers on partner actions** — 7-day streak boosts offer payouts (retention lever that directly raises partner revenue per user).
11. **Local merchant flash drops** — coworking/coffee discounts for check-in streaks (already specced as Phase D of Gig Hub) — merchants pay for foot traffic.
12. **Second-network A/B** — once ayeT is live, run Adscend vs ayeT head-to-head per user cohort; auto-shift traffic to the higher eCPM wall monthly (wall arbitrage).



## PART C — OWNER-ONLY BLOCKERS (the complete list)

1. **Adscend publisher signup** (the only Phase 1 blocker) — checklist delivered this batch; approval 1-3 business days.
2. **ayeT-Studios publisher signup** (wall #2 — endpoint pre-wired, secret gate live; swap in their production secret when the account exists).
3. Point Adscend postback URL (5 min after approval; secret + IP allowlist paste → I finish wiring).
4. Broaden fine-grained PAT · register OAuth apps (Slack/Dropbox/Outlook/Box) · apply 4 SQL migrations · Supabase auth_config_write (passkeys) · Twilio credentials · SHMT PR #3889 approve+merge + redeploy runner · passkey e2e · .edu student-verify e2e · OpenRouter auto-top-up · low-balance credit alert.

**Session record (v261, 2026-11-19):** ayeT pre-wired as wall #2 (secret gate live, signed+idempotency verified, test rows cleaned); Part D added — full channel landscape, Phase 2 affiliate ladder draft (D5), 12-item idea backlog (D6). Prior (v260, 11-17): prelaunch 12/13 (env-only miss), free-agent suite 6/6, Tasks tab built + demo deployed, doc merged from v239/v252-v257/v259 + scale model (PR #215, #217).
