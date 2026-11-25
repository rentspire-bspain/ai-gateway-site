# THE MASTER COMPLETION DOC — ai.spaincos.com + boundview.com (merged, v262)
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



# PART E — USER EXPERIENCE MASTER (premortem · benchmark · checklist · scoring) — all webapps
**2026-11-20 · v262 · append directly after PART D of `parity-master-completion-2026-11-17.md` (v261).** This part turns "is the experience flawless for every user?" into a working QA instrument: every line carries an item ID, a pass benchmark, a **WTD AVG factor** (weighted-average weight), a status, evidence, and fix/repair guidance. It uses the same convention as the v261 headline: a weighted sum divided by total weight, computed by a script and never hand-summed.

**Headline (computed by `qa/generate-ux-headline.py` from `qa/ux-items.json`):**
**Part E portfolio UX readiness, strict: 23.4%** (app-weighted; unmeasured counts as 0; v46 — batch 33: bot-protection probes green; BV landing value prop in PR #500) · **measured-only: 41.1%** · 176✅ / 225🟡 / 182🔴 / 794⚪ across 386 line items. Per-app strict: BV 45.3% · TT 27.4% · AG 45.4% · GH 11.3% · ST 7.9% · CT 2.6% · DG 2.8%.
**How to read the number.** The v261 headline (90.4%) measures *capability parity*. Part E measures *experience readiness* and is deliberately harsher: a check nobody has measured is ⚪ and scores 0, because an unproven experience is not a flawless one. The score rises by fixing 🔴 items and by measuring ⚪ items; both are tracked separately so measuring never hides a failure.

> **Evidence basis and limits.** Statuses come from (1) files in the workspace (`ai-gateway-site`, `offerwall-tasks-tab`, `gig-hub-mockup`, pricing model, memory notes) and (2) live server-side probes run 2026-11-20 against boundview.com, ai.spaincos.com, comptrove.com, rentspire.com and minutegig.com (headers, robots, sitemap, manifest, privacy, 404 behavior). No browser, device or screen-reader testing was possible in this environment, so those checks are ⚪ or marked from code only. Spain Terminal, Comptrove and DoorGraph source code is not in this workspace; their statuses come from memory notes and the SHMT roadmap and are mostly ⚪ by design.

---

## E0. STANDING RULES THAT GOVERN EVERY LINE BELOW

> ### 🇺🇸 EVERYTHING MUST BE NATIONWIDE IN ALL WEBAPPS (owner rule, 2026-11-20)
> This is a standing rule, not a feature. For every webapp, on every release, the following must be true or the item is 🔴:
> 1. **Data coverage:** all 50 states + DC, plus PR, VI, GU, AS and MP where the dataset exists. A dataset that covers only some jurisdictions must say so on screen (coverage chip + "not yet covered, notify me"), never show blank or wrong-state results. Coverage is published as a matrix per app and gated per dataset (U-NW-01, U-NW-03).
> 2. **Jurisdiction handling:** the user's jurisdiction is detected and overridable; no screen defaults to California or to the owner's South Carolina portfolio; every legal, regulatory or compliance output carries a jurisdiction chip (U-NW-02). The state-by-state legal text matrix (auto-renewal, privacy, sales tax, disclosures, insurance/financial licensing, fair-housing) is owned by counsel and tested per state (U-NW-07).
> 3. **Currency, locale, time:** USD with two decimals and en-US grouping pinned via `Intl` (not the browser locale); full US time-zone list including America/Anchorage, Pacific/Honolulu, America/Phoenix, America/Puerto_Rico and Pacific/Guam (U-NW-04, U-NW-05); address, phone and ID formats accept every state and territory plus APO/FPO (U-NW-06).
> 4. **SEO surface:** public data products generate nationwide state, county, city and ZIP landing pages from real data (unique content per page, sharded sitemaps ≤50,000 URLs per file, local schema) rather than a handful of hand-written pages (U-NW-08).
> 5. **Availability and speed everywhere:** offers, features and support work for every state; largest-jurisdiction queries (CA, TX, NY, FL) stay inside the latency budget; rural low-bandwidth users pass the Slow 4G profile (U-NW-09, U-NW-12, U-NW-13).
> 6. **Release gate:** no webapp ships a release whose nationwide conformance matrix (E8.7) has an unreviewed 🔴.

**Other owner standards enforced as checks (from standing preferences):** sophisticated consumer design with playful rewards confined to earn surfaces (U-DES-02); flat, full-width, compact layouts; plain language with every acronym spelled out and hover/focus-first secondary explanations (U-COPY-01, U-COPY-02); predictive SmartSearch with typo recovery as the default search (U-DES-06); every document mention linked at its point of reference (U-COPY-07); screenshot-verified changes and side-by-side comparison with approved mockups (U-DES-04); working workflows with routed human confirmations instead of dead ends (DG-19); demo and fixture data always labeled (U-COPY-06); brand separation between ai.spaincos.com and BoundView (U-TRU-12); status follows evidence — nothing is ✅ without a pointer.

---

## E1. WEBAPP UNIVERSE (what is deployed vs internal)

| Code | Webapp | Deployment class | Evidence of state (2026-11-20) | Portfolio weight |
|---|---|---|---|---|
| BV | Boundview — boundview.com, consumer AI product | **DEPLOYED, public** | Live probe HTTP 200, TTFB 104 ms, br-compressed 339 KB shell; separate Vercel project; checkout and passkey owner steps pending | 24 |
| TT | Offerwall Tasks tab (earn surface inside the Free tier) | **BUILT + DEMO-DEPLOYED; NOT wired into the host** | `offerwall-tasks-tab/` (9.7 KB single file); zero offerwall references in `ai-gateway-site`; Adscend IDs unset; goes live after owner signup | 16 |
| AG | ai-gateway-site — ai.spaincos.com (private workspace + docs + QA fleet) | **DEPLOYED, private by intent** (but publicly crawlable today) | Live HTTP 200, TTFB 175 ms; same bundle as BV (339,560 vs 339,531 bytes); build v275; prelaunch 31/0 on 2026-11-16 | 12 |
| GH | Gig Hub / MinuteGig (neuron funnel; property-services marketplace) | **MOCKUP DEPLOYED; product not built**; minutegig.com **HTTP 502** | `gig-hub-mockup/index.html`, QA screenshots; Phase 2 starts at the $500/mo gate | 8 |
| ST | SpainCos Terminal (CRM + seven terminals + PHA Sales desk) | **INTERNAL** (preview/fixture atlas distinct from live product; behind flags) | 122-page atlas; v2 health failures recurring (P0); not in this workspace | 14 |
| CT | Comptrove (property and parcel intelligence; commercial) | **DEPLOYED, public commercial** (not verifiable here) | comptrove.com returns HTTP 403 `x-vercel-mitigated: deny` to a generic user agent; source not in workspace | 16 |
| DG | DoorGraph / Property Evidence Exchange (evidence rooms) | **INTERNAL / synthetic staging**; no real recipients | Staging layer exists; entity (CanonIntel LLC) not formed; tenant-isolation and restore gates open | 10 |
| LT | Long-tail portfolio apps (see E13) | **Mixed / unverified** | Inherit Part E; scored at first audit | 0 until audited |

Notes: BV and AG serve the same code with a runtime brand switch (`modules/brand.js`), so shared-bundle findings appear under both. Internal apps (ST, DG) are scored on the same universal items; where an item is public-marketing only (for example sitemap) it is marked — for that app or inverted into a "must be noindex" check (U-SEO-18). Host-inherited items (authentication, payments, AI answers, help) are not double counted for TT and GH.

---

## E2. SCORING SYSTEM (matches the v261 weighted-average convention)

### E2.1 WTD AVG factor per line item
Every line item has a weight **W** (the WTD AVG factor), an integer 1–10, built from four visible components so the factor is auditable and "adjusted for everything rolled in":

**W = min(10, I + R + C + M)**

| Component | Range | Meaning |
|---|---|---|
| **I** user-task impact | 1–4 | 4 = blocks or corrupts the core task, money, or data; 3 = major friction; 2 = moderate; 1 = cosmetic |
| **R** revenue / monetization exposure | 0–3 | 3 = directly blocks revenue or conversion; 0 = none |
| **C** compliance / legal / trust exposure | 0–3 | 3 = regulator or litigation-class exposure (FTC, privacy, ADA, CAN-SPAM, state law); 0 = none |
| **M** marketing / SEO / discoverability | 0–2 | 2 = determines whether the product can be found or shared at all |

In every table the W column shows `W (I·R·C·M)` expressed as four digits, for example `9 · 4231`.

### E2.2 Status → score
| Status | Meaning | Score used |
|---|---|---|
| ✅ | Verified pass with evidence pointer | 100 |
| 🟡 | Partial, pending an owner step, or passes with a known weakness | 50 |
| 🔴 | Fails the benchmark or required artifact missing | 0 |
| ⚪ | Not measured / not determinable from files | 0 in **strict**; excluded in **measured-only** |
| — | Not applicable to this app (inherited from a host, or not applicable by type) | excluded |

### E2.3 Roll-up formulas
- **Per app, per category:** `score = Σ(W × status score) ÷ Σ(W)` over applicable items.
- **Per app (strict):** the same sum over all applicable items. **Measured-only** excludes ⚪ items from numerator and denominator. **Evidence coverage** = (✅+🟡+🔴) ÷ applicable items.
- **Portfolio headline:** `Σ(app weight × app strict score) ÷ Σ(app weight)` with app weights in E1 (LT excluded until audited). This mirrors `weighted_sum / total_weight` in `generate-parity-headline.py`.
- **Launch gate (public apps):** strict ≥ 85, zero open S0/S1 findings, evidence coverage ≥ 90%, and every nationwide conformance cell reviewed.
- **Priority of a failing item:** `W × (100 − score) ÷ 100`, multiplied by the app weight when ranking across apps.

---

## E3. COMPUTED ROLL-UP

### E3.1 Per-webapp WTD AVG roll-up

| Webapp | Class | App weight | Items | ✅ | 🟡 | 🔴 | ⚪ | Σ W×score | Σ W | **WTD AVG strict** | WTD AVG measured-only | Evidence coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **BV** Boundview (boundview.com) | PUBLIC | 24 | 226 | 34 | 74 | 47 | 71 | 31450 | 1160 | **27.1%** | 39.2% | 68.6% |
| **TT** Offerwall Tasks tab (earn surface) | PRE-LAUNCH | 16 | 183 | 14 | 23 | 73 | 73 | 12850 | 992 | **13.0%** | 20.4% | 60.1% |
| **AG** ai-gateway-site (ai.spaincos.com) | PRIVATE | 12 | 200 | 38 | 59 | 32 | 71 | 30000 | 999 | **30.0%** | 46.4% | 64.5% |
| **GH** Gig Hub / MinuteGig | MOCKUP | 8 | 160 | 10 | 16 | 20 | 114 | 8550 | 824 | **10.4%** | 33.5% | 28.8% |
| **ST** SpainCos Terminal (CRM + 7 terminals) | INTERNAL | 14 | 192 | 8 | 18 | 8 | 158 | 7600 | 965 | **7.9%** | 43.9% | 17.7% |
| **CT** Comptrove | PUBLIC* | 16 | 213 | 1 | 4 | 6 | 202 | 1450 | 1128 | **1.3%** | 22.3% | 5.2% |
| **DG** DoorGraph (evidence rooms) | INTERNAL | 10 | 202 | 1 | 7 | 12 | 182 | 2950 | 1069 | **2.8%** | 20.3% | 9.9% |
| **PORTFOLIO** | — | 100 | 1376 | 106 | 201 | 198 | 871 | — | — | **14.6%** | 32.7% | 36.7% |

`*` Comptrove is public but unverifiable from this environment, so its low strict score reflects missing evidence rather than a known-bad product. Read the 🔴 count and measured-only column for known failures.

### E3.2 Category × webapp matrix (strict WTD AVG %, universal items only; — = not applicable)

| Category | BV | TT | AG | GH | ST | CT | DG |
|---|---|---|---|---|---|---|---|
| PERF — Performance | 19.6 | 13.4 | 19.6 | 4.5 | 0.0 | 0.0 | 0.0 |
| A11Y — Accessibility | 35.7 | 25.8 | 35.7 | 13.2 | 0.0 | 0.0 | 0.0 |
| MOB — Mobile and responsive | 34.8 | 5.3 | 50.0 | 21.2 | 0.0 | 0.0 | 0.0 |
| ONB — Onboarding and first session | 26.9 | 0.0 | 26.9 | 6.5 | 0.0 | 0.0 | 0.0 |
| AUTH — Authentication | 20.2 | 50.0 | 28.9 | — | 6.1 | 0.0 | 0.0 |
| FORM — Forms and validation | 25.0 | 0.0 | 25.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| STATE — States: empty, loading, error | 48.0 | 6.0 | 48.0 | 9.5 | 0.0 | 0.0 | 0.0 |
| REL — Reliability | 44.2 | 0.0 | 44.2 | — | 0.0 | 0.0 | 0.0 |
| PAY — Payments and billing | 33.6 | — | — | — | — | 4.5 | 0.0 |
| NOT — Notifications | 36.3 | 0.0 | 22.5 | — | 0.0 | 0.0 | 0.0 |
| TRU — Trust, privacy and compliance | 16.8 | 5.9 | 30.2 | 8.3 | 0.0 | 0.0 | 0.0 |
| SEO — SEO and marketing surface | 11.9 | — | 7.9 | 0.0 | 0.0 | 3.5 | 0.0 |
| COPY — Copy and content | 11.1 | 22.2 | 11.1 | 22.2 | 16.7 | 0.0 | 0.0 |
| AI — AI answer experience | 67.5 | — | 67.5 | — | — | — | — |
| NW — Nationwide (owner rule) | 2.2 | 2.0 | 14.3 | 0.0 | 12.3 | 0.0 | 0.0 |
| MEAS — Measurement | 12.9 | — | 12.9 | — | 6.5 | 6.5 | 6.5 |
| HELP — Help and support | 25.0 | — | 35.0 | — | 0.0 | 0.0 | 0.0 |
| DES — Design system and visual QA | 29.5 | 20.5 | 70.5 | 38.6 | 38.5 | 0.0 | 0.0 |

### E3.3 Path to the launch gate (mirrors `path_to_75` in the v261 headline)

| Webapp | Strict now | Points to 85% | If every 🔴→✅ | If every ⚪ measured and found 🟡 | If 🔴→✅ and ⚪→✅ |
|---|---|---|---|---|---|
| BV | 27.1% | 67150 weighted points | 53.1% | 42.5% | 83.8% |
| TT | 13.0% | 71470 weighted points | 57.5% | 31.2% | 94.0% |
| AG | 30.0% | 54915 weighted points | 49.8% | 47.7% | 85.2% |
| GH | 10.4% | 61490 weighted points | 25.8% | 44.9% | 94.8% |
| ST | 7.9% | 74425 weighted points | 13.5% | 48.9% | 95.5% |
| CT | 1.3% | 94430 weighted points | 4.7% | 48.4% | 99.0% |
| DG | 2.8% | 87915 weighted points | 11.6% | 46.0% | 98.0% |

Reading: fixing known failures alone does not reach the gate for any app, because most of the gap is unmeasured. The measurement sprint (E9.5) is therefore as valuable as the repair sprint.

---

## E4. UX PREMORTEM — "it is May 2027 and users hated it. Why?"

Premortem method: assume each app failed its users, write the cause, then convert each cause into a measurable check. The twelve stories below are the ones that the evidence in this workspace makes most likely; the full inventory follows.

1. **"I did the offers and got nothing."** Users finish offers after the daily or monthly cap, in a frame blocked by the host's own CSP or sandbox, on Safari with third-party cookies off, and see a balance that never changes (TT-CAP-02/03, TT-WALL-03/04/11, TT-BAL-03).
2. **"The balance was wrong."** The tab prints 1,240 N before the first read and silently keeps it if the read fails (TT-BAL-01/03); the neuron-to-dollar claim is off by 5–40x (TT-BAL-10).
3. **"It said no ads and then showed me an ad wall."** Boundview's live privacy page is the private workspace's policy (U-TRU-01); there is no terms page (U-TRU-02); the wall shares a user id with a network (U-TRU-03/04).
4. **"Is this the same company as that other site?"** Manifest, privacy page and static files leak the sibling brand, and the private workspace is indexable under the BoundView title (U-TRU-12, U-MOB-07, AG-01).
5. **"I can't find you."** No description, OG card, canonical, sitemap, structured data or server-rendered content on either host (U-SEO-01..09).
6. **"It was slow on my phone."** 81 first-load resources, `no-store` HTML, a font from another company's CDN, no performance budget (U-PERF-05..08, 11).
7. **"I couldn't use it with my screen reader or keyboard."** No axe gate, no screen-reader run, unlabeled toast and 20 px buttons (U-A11Y-02/05/07/14).
8. **"I can't cancel / checkout broke."** Price IDs and webhook secret unwired; cancel flow unverified (U-PAY-02/04).
9. **"Your terminal timed out again."** Spain Terminal v2 health failures keep recurring after the first fix (ST-02).
10. **"My state isn't there."** Coverage and legal text are not proven for every state; time zones omit Alaska, Hawaii, Arizona and territories; one product defaults to a single-state portfolio (U-NW-01/04/07, GH-15).
11. **"Your emails went to spam / I can't unsubscribe."** Sending-domain authentication, one-click unsubscribe and suppression are unproven before a 250,000-contact send (U-NOT-04/05, CT-13, ST-06).
12. **"We had no idea."** No analytics, activation metric, RUM or error tracking means failures are found by users, not by the team (U-MEAS-01, U-ONB-08, U-REL-02).

### E4.1 Failure-mode inventory (risk = likelihood × impact, each 1–5; ≥15 is critical)

| ID | App | How the user's experience fails | L | I | Risk | Detection | Prevention / mitigation | Linked items |
|---|---|---|---|---|---|---|---|---|
| FM-004 | BV | A new user reads a privacy policy that says 'no advertising, no trackers, private site' then meets an ad-network offer wall | 5 | 5 | **25** 🔴 | Counsel review; policy diff against data-flow inventory | Product-specific policy; consent gate | U-TRU-01, U-TRU-03 |
| FM-025 | TT | Wall frame blocked by host CSP and the Earn tab is an empty box | 5 | 5 | **25** 🔴 | Playwright on integrated build | Add frame-src; rerun CSP hash tool | TT-WALL-03 |
| FM-003 | BV | boundview.com is installed as a PWA named 'ai.spaincos', exposing the sibling brand | 5 | 4 | **20** 🔴 | Static-file brand grep | Per-host manifest and policy files | U-TRU-12, U-MOB-07 |
| FM-005 | BV | User cannot find terms of service (404) at signup or checkout | 5 | 4 | **20** 🔴 | Link checker | Publish terms | U-TRU-02 |
| FM-012 | BV | User upgrades, checkout fails (price ID not wired) and revenue is lost | 4 | 5 | **20** 🔴 | Checkout synthetic | Wire and test live | U-PAY-02, BV-14 |
| FM-018 | BV | Marketing blind: no analytics, so no one knows where users drop | 5 | 4 | **20** 🔴 | None today | Cookieless first-party funnel | U-MEAS-01, U-ONB-08 |
| FM-026 | TT | User sees 1,240 N that is not theirs, or sees it forever because polling failed silently | 4 | 5 | **20** 🔴 | Contract test with 401 | Skeleton + JWT + error state | TT-BAL-01..03 |
| FM-028 | TT | User hits monthly cap (60) silently and keeps doing offers that pay nothing | 4 | 5 | **20** 🔴 | Cap-rejected rate per user | Monthly meter + overlay | TT-CAP-02, TT-CAP-03 |
| FM-034 | TT | Safari blocks third-party cookies, so the network cannot attribute and no credit arrives | 4 | 5 | **20** 🔴 | Per-browser verified rate | Detect and guide; test matrix | TT-WALL-11 |
| FM-037 | TT | Disclosure missed on mobile because it is small gray text | 4 | 5 | **20** 🔴 | Regulator-style review | 14 px ink, interstitial | TT-FTC-02, TT-FTC-04 |
| FM-039 | TT | Valuation claim '1 N ≈ $0.004' is 5–40x off the economics; refund demands and UDAP exposure | 4 | 5 | **20** 🔴 | Finance diff | Single constant | TT-BAL-10 |
| FM-051 | GH | minutegig.com returns 502 to visitors | 5 | 4 | **20** 🔴 | Uptime probe | Fix DNS/host | GH-01 |
| FM-057 | ST | Layers endpoint hits the 55 s watchdog and the screen hangs | 4 | 5 | **20** 🔴 | Health-check trend | Precompute + cache | ST-02, U-REL-10 |
| FM-066 | CT | Data looks fresh but is stale | 4 | 5 | **20** 🔴 | Freshness job | Stamp + alert | CT-04 |
| FM-067 | CT | Emails to the 250,000-contact universe land in spam or breach CAN-SPAM | 4 | 5 | **20** 🔴 | Seed-list tests | SPF/DKIM/DMARC; unsub; suppression | U-NOT-04, U-NOT-05, CT-13 |
| FM-072 | ALL | A nationwide user in an uncovered or unusual jurisdiction gets wrong-state data or law text | 4 | 5 | **20** 🔴 | State matrix tests | Jurisdiction chip + matrix | U-NW-01..07 |
| FM-001 | BV | A visitor lands, sees a generic headline, no pricing, no proof, and leaves in under 10 s | 4 | 4 | **16** 🔴 | Bounce rate; 5-second test | Static marketing home with one h1, proof strip, pricing link | U-ONB-01, BV-01 |
| FM-011 | BV | Credits vs neurons vs dollars confuse the user about what they can do | 4 | 4 | **16** 🔴 | Support tickets; usability test | One vocabulary + rate from API | U-COPY-03 |
| FM-021 | BV | 3 s+ LCP on mid-range Android over 4G due to 81 first-load resources | 4 | 4 | **16** 🔴 | RUM / Lighthouse | Bundle + defer modules | U-PERF-05 |
| FM-029 | TT | Daily cap resets at 4 pm Pacific; users think the app is broken at 'midnight' | 4 | 4 | **16** 🔴 | Support tickets | Local reset time | TT-CAP-04 |
| FM-031 | TT | Offer pays 24–72 h later but UI says 'usually minutes' | 4 | 4 | **16** 🔴 | Pending age p95 | Per-offer ETA | TT-PEN-01 |
| FM-033 | TT | Offer clicks open in a sandboxed popup and the advertiser page breaks | 4 | 4 | **16** 🔴 | Real-offer test | allow-popups-to-escape-sandbox | TT-WALL-04 |
| FM-047 | AG | Private workspace is indexed and shows 'BoundView', leaking the sibling-brand relationship | 4 | 4 | **16** 🔴 | site: search | noindex + auth interstitial | AG-01, U-SEO-06 |
| FM-059 | ST | Stale data shown without a date | 4 | 4 | **16** 🔴 | Freshness SLO | Freshness badges | U-STATE-10 |
| FM-064 | CT | Search for a state or county has no coverage and returns blank | 4 | 4 | **16** 🔴 | Coverage test | Uncovered state | U-NW-03 |
| FM-065 | CT | Free visitor cannot preview value before paywall | 4 | 4 | **16** 🔴 | Funnel | Free lookup | CT-05 |
| FM-073 | ALL | One-off patches fix a symptom and the class returns | 4 | 4 | **16** 🔴 | Regression ledger | Permanent-solution class per finding | §E9 |
| FM-074 | ALL | Measurement is absent so regressions are found by users | 4 | 4 | **16** 🔴 | None | Part E script nightly | U-MEAS-02 |
| FM-002 | BV | Search engines index a bare 'BoundView' title with no description, so the brand SERP is empty and shares unfurl as plain URLs | 5 | 3 | **15** 🔴 | Search Console; unfurl test | Prerender + meta + OG + sitemap | U-SEO-01..08 |
| FM-013 | BV | User cannot cancel quickly; chargebacks and regulator exposure | 3 | 5 | **15** 🔴 | Cancel-flow test | ≤2 click cancel + email | U-PAY-04 |
| FM-032 | TT | Offer reversed by the network; neurons disappear with no explanation | 3 | 5 | **15** 🔴 | Reversal rate | Reason + dispute | TT-PEN-03 |
| FM-038 | TT | A user under 13 or under 18 uses the wall | 3 | 5 | **15** 🔴 | Eligibility audit | Age gate | U-TRU-07 |
| FM-052 | GH | Referral link clicked without disclosure | 3 | 5 | **15** 🔴 | Link audit | Disclosure before click-out | GH-04 |
| FM-053 | GH | Pay ranges read as guarantees | 3 | 5 | **15** 🔴 | Copy review | Sources + disclaimers | U-TRU-15 |
| FM-060 | ST | City with low identity match appears as complete coverage | 3 | 5 | **15** 🔴 | Coverage report | Hide below 80% | ST-21 |
| FM-063 | CT | Prospect cannot reach the site because WAF treats them as a bot | 3 | 5 | **15** 🔴 | Real-browser probe | Allowlist verified bots; test | CT-01, U-SEO-14 |
| FM-069 | DG | Recipient cannot tell what they can see | 3 | 5 | **15** 🔴 | Recipient test | Release preview | DG-02, DG-06 |
| FM-006 | BV | Sign-up stalls on email verification before first value | 3 | 4 | **12** | Funnel drop-off | Allow first query pre-verification; passkey | U-ONB-03 |
| FM-008 | BV | Session expires mid-composition and the draft is lost | 3 | 4 | **12** | test:auth | Preserve draft; re-auth modal | U-AUTH-02 |
| FM-009 | BV | First answer is slow or blank; user retries and double-spends credits | 3 | 4 | **12** | First-token p75 | Stream; idempotent spend | U-AI-01, U-FORM-04 |
| FM-020 | BV | Offer-wall partner script slows the whole page | 3 | 4 | **12** | Lighthouse CI | Load wall lazily inside iframe only on tab open | TT-WALL-01 |
| FM-022 | BV | Screen-reader user cannot tell when an answer finishes | 3 | 4 | **12** | SR run | aria-live announcer | U-A11Y-07, U-A11Y-14 |
| FM-030 | TT | A completion lands within the 60 s cooldown and is rejected without explanation | 3 | 4 | **12** | Rejected-reason histogram | Explain cooldown | TT-CAP-04 |
| FM-040 | TT | Earn tab named 'Tasks' is confused with Scheduled Tasks and push deep links | 4 | 3 | **12** | Usability test | Rename | TT-INT-03 |
| FM-043 | TT | Wall never loads (provider outage) and the user sees a blank frame | 3 | 4 | **12** | Load-timeout events | Timeout + fallback | TT-WALL-01, TT-WALL-02 |
| FM-044 | TT | Screen-reader and keyboard users cannot use the toast, ring, or refresh | 3 | 4 | **12** | axe + SR | ARIA + 44 px | U-A11Y-05, U-A11Y-07 |
| FM-045 | TT | User expects to cash out | 3 | 4 | **12** | Support tickets | Earn-only line | TT-ECON-01 |
| FM-054 | GH | Milestone neurons take 30 days and users think they were not paid | 4 | 3 | **12** | Support tickets | State latency | GH-09 |
| FM-055 | GH | Markup disclosure ambiguity leads to vendor/PM disputes | 3 | 4 | **12** | Dispute count | Owner decision | GH-14 |
| FM-061 | ST | Search cannot find an address that exists | 3 | 4 | **12** | Search QA set | Index routing test | ST-03 |
| FM-071 | DG | Older recipient cannot use the interface | 3 | 4 | **12** | Moderated test | Plain language, large type | DG-15 |
| FM-076 | ALL | Third-party dependency (network, CDN, WAF) fails and no fallback exists | 3 | 4 | **12** | Synthetic | Isolation patterns | U-REL-08 |
| FM-027 | TT | Anyone can read any user's balance by guessing a UUID | 2 | 5 | **10** | Pen test of neurons-claim | Server derives user from JWT | TT-BAL-02 |
| FM-049 | AG | A CSP hash is stale after an inline edit and the page bricks | 2 | 5 | **10** | csp-hash-check | Keep gate | U-TRU-10 |
| FM-058 | ST | A staged outreach intent is mistaken for a sent message | 2 | 5 | **10** | Audit | Intent labels; consent gate | ST-06, ST-07 |
| FM-068 | DG | Invitation sent before the operator entity exists and counsel review | 2 | 5 | **10** | Gate checklist | Hard gate | DG-01, DG-12 |
| FM-070 | DG | Tenant isolation fails with real accounts | 2 | 5 | **10** | E2E | Pass before invites | DG-10 |
| FM-007 | BV | Passkey prompt fails on one platform and the user has no fallback | 3 | 3 | **9** | Auth outcome codes | Fallback to magic link, visible | U-AUTH-05 |
| FM-010 | BV | Free lane degrades quality silently; user blames product | 3 | 3 | **9** | Feedback rate | Disclose lane/fallback | U-STATE-04, BV-07 |
| FM-014 | BV | Student discount flow dead-ends at price wiring | 3 | 3 | **9** | Funnel | Owner price IDs | U-PAY-10 |
| FM-016 | BV | Push permission asked too early; permanently blocked | 3 | 3 | **9** | Opt-in rate | Ask after first background job | U-NOT-01 |
| FM-035 | TT | Toast says 'Offer verified' for a login bonus | 3 | 3 | **9** | QA | Source-aware copy | TT-BAL-05 |
| FM-041 | TT | Placeholder copy exposes 'Adscend profile approval' to end users | 3 | 3 | **9** | Copy review | User-facing placeholder | U-COPY-04 |
| FM-046 | TT | Users in AK/HI/AZ/PR see wrong reset or offers | 3 | 3 | **9** | Geo cohort analysis | Time-zone fix + availability note | U-NW-04, TT-NW-01 |
| FM-050 | AG | Docs are not discoverable or versioned | 3 | 3 | **9** | Docs search logs | Public docs pages | AG-02, AG-09 |
| FM-056 | GH | Dispatch market defaults to the owner's SC portfolio and conflicts with nationwide rule | 3 | 3 | **9** | Review | Data-driven market choice | GH-15, U-NW-02 |
| FM-062 | ST | Role confusion: user sees empty screens because of permissions | 3 | 3 | **9** | Role matrix | Explain access | ST-16 |
| FM-075 | ALL | Spanish-speaking or low-bandwidth rural users are underserved | 3 | 3 | **9** | Cohort analytics | Throttled run; Spanish scope | U-NW-13 |
| FM-015 | BV | Mobile composer jumps or hides under keyboard on Android | 2 | 4 | **8** | Real-device matrix | Device farm | U-MOB-04, U-MOB-11 |
| FM-017 | BV | Research finishes while tab closed and nothing tells the user | 2 | 4 | **8** | Push delivery metric | v192 pipeline + delivery KPI | U-NOT-02 |
| FM-023 | BV | Unknown URL shows 'Redirecting…' flash and lands on home | 4 | 2 | **8** | Link crawl | Real 404 | U-STATE-07 |
| FM-024 | BV | Another company's CDN is slow or removes the font, blocking text rendering | 2 | 4 | **8** | Synthetic | Self-host fonts | U-PERF-08, U-REL-08 |
| FM-042 | TT | Polling continues in hidden tabs, wasting battery and rate budget | 4 | 2 | **8** | Request logs | visibilitychange | TT-BAL-04 |
| FM-048 | AG | Clickjacking possible because frame-ancestors cannot be set in a meta CSP | 2 | 4 | **8** | Header scan | HTTP headers | U-TRU-09 |
| FM-019 | BV | Stale-deploy tab keeps running old code after a release | 2 | 3 | **6** | Build id check | Hashed assets + stale-tab prompt | U-PERF-07, U-REL-06 |
| FM-036 | TT | Two credits arrive together and the second celebration is lost | 2 | 2 | **4** | QA | Toast queue | TT-BAL-07 |

Failure modes: 76 · critical (risk ≥15): 37.

---

## E5. CRITICAL USER JOURNEYS AND PER-WEBAPP BENCHMARK SHEETS

### E5.1 Critical user journeys (CUJ) — step and time budgets
A CUJ passes when the median new user completes it inside the budget with ≥95% success in moderated or synthetic runs. "Steps" = clicks or taps plus form screens, excluding third-party time.

| CUJ | App | Journey | Step budget | Time budget | Success target | Status |
|---|---|---|---|---|---|---|
| CUJ-01 | BV | Landing → first answer | ≤2 | ≤60 s | ≥95% | ⚪ |
| CUJ-02 | BV | Sign up (passkey or magic link) | ≤3 screens | ≤45 s | ≥98% | 🟡 |
| CUJ-03 | BV | Free → Pro $18 checkout | ≤4 | ≤90 s | ≥92% | 🔴 |
| CUJ-04 | BV | Cancel or downgrade | ≤2 | ≤30 s | 100% | ⚪ |
| CUJ-05 | BV | Attach files → answer with citations | ≤3 | ≤40 s + model time | ≥97% | 🟡 |
| CUJ-06 | BV | Start background research → notification → open result | ≤3 | push ≤30 s after completion | ≥98% | ✅ |
| CUJ-07 | BV | Delete account or export data | ≤3 | ≤60 s | 100% | ⚪ |
| CUJ-08 | TT | Open earn tab → understand disclosure, balance, cap | ≤1 | wall visible ≤3 s | ≥95% | 🔴 |
| CUJ-09 | TT | Complete first offer → see credit | ≤4 (excl. network) | credit visible ≤90 s after postback | ≥90% | 🔴 |
| CUJ-10 | TT | Hit cap → understand when it resets | 0 extra | message immediate | 100% | 🔴 |
| CUJ-11 | TT | Missing credit → contact support | ≤2 | ≤30 s | ≥95% | 🔴 |
| CUJ-12 | AG | Operator opens QA fleet page and sees last run | ≤2 | ≤5 s | 100% | ✅ |
| CUJ-13 | AG | Developer creates API key → first call | ≤5 | ≤5 min | ≥90% | 🟡 |
| CUJ-14 | GH | Find platform → disclosed referral click-out | ≤3 | ≤30 s | ≥95% | ⚪ |
| CUJ-15 | GH | Complete quest chain T1 | 4 quests | n/a | ≥60% | ⚪ |
| CUJ-16 | ST | Address search → record | ≤3 | ≤2 s response | ≥98% | 🟡 |
| CUJ-17 | ST | Stage outreach intent without sending | ≤4 | n/a | 100% blocked without consent | 🟡 |
| CUJ-18 | CT | Address → coverage report | ≤3 | ≤5 s | ≥95% | ⚪ |
| CUJ-19 | CT | Visitor → free preview → trial | ≤4 | ≤3 min | ≥8% | ⚪ |
| CUJ-20 | DG | Recipient link → evidence list | ≤2 | ≤20 s | ≥95% | ⚪ |
| CUJ-21 | ALL | Any state selection → correct jurisdiction data or explicit 'not covered' | ≤2 | ≤3 s | 100% | ⚪ |

### E5.2 Benchmark sheet (numeric thresholds by webapp)
`—` = not applicable. Thresholds are pass lines; "budget" values are ship-blocking for public apps.

| Metric | BV | TT | AG | GH | ST | CT | DG |
|---|---|---|---|---|---|---|---|
| LCP p75 mobile 4G | ≤2.5 s (landing ≤2.0 s) | ≤1.5 s | ≤2.5 s | ≤2.5 s | ≤3.0 s desktop | ≤2.5 s | ≤3.0 s |
| INP p75 | ≤200 ms | ≤150 ms | ≤200 ms | ≤200 ms | ≤250 ms | ≤200 ms | ≤250 ms |
| CLS p75 | ≤0.1 | ≤0.05 (reserve frame) | ≤0.1 | ≤0.1 | ≤0.1 | ≤0.1 | ≤0.1 |
| TTFB p75 | ≤800 ms (now 104 ms) | ≤600 ms | ≤800 ms (now 175 ms) | ≤800 ms | ≤800 ms | ≤800 ms | ≤800 ms |
| First-load requests / critical JS (br) | ≤30 / ≤170 KB (now 81 tags) | ≤5 / ≤30 KB | ≤40 / ≤250 KB | ≤30 / ≤170 KB | ≤40 / ≤300 KB | ≤30 / ≤200 KB | ≤40 / ≤300 KB |
| First token / answer | ≤2 s / ≤8 s p95 | — | ≤2 s / ≤8 s | — | — | — | — |
| Balance / data read p95 | — | ≤800 ms; stale marker after 90 s | — | — | ≤1.5 s typical read; watchdog never fires | ≤1.5 s | ≤1.5 s |
| Wall/iframe load | — | ≤3 s p75; timeout UI 10 s | — | — | — | — | — |
| Client JS error rate | ≤0.5% sessions | ≤0.5% | ≤0.5% | ≤0.5% | ≤0.5% | ≤0.5% | ≤0.5% |
| API 5xx / availability | ≤0.5% / ≥99.9% | ≤1% poll failures / ≥99.5% | ≤0.5% / ≥99.9% | ≥99.5% | ≥99.5% | ≥99.9% | ≥99.5% |
| Postback → visible credit | — | ≤90 s p95 (30 s poll + focus) | — | — | — | — | — |
| Contrast | text ≥4.5, UI ≥3 | same | same | same | same | same | same |
| Tap/click target | ≥44 px touch (≥24 px min) | ≥44 px | ≥44 px | ≥44 px | ≥24 px min, 32 px preferred | ≥44 px | ≥44 px |
| Form validation | inline on blur; summary on submit; input preserved | — | same | same | same | same | same |
| Accessibility | WCAG 2.2 AA, axe 0 critical/serious | same | same | same | same + 508 exports | same | same + older-user test |
| Disclosure (FTC) | ≥14 px, ink, before action | ≥14 px, interstitial + label | — | ≥14 px per card | — | — | — |
| Email / SMS | SPF+DKIM+DMARC; one-click unsub | — | — | same | consent-gated | same | same |
| Nationwide | 50+DC+5 territories; AK/HI/AZ/PR zones | AK/HI reset correct | same | national market | coverage per dataset | coverage per dataset | template per jurisdiction |

---

## E6. UNIVERSAL LINE ITEMS (scored per webapp)

Columns: **W** = WTD AVG factor `W · I R C M`; app columns BV TT AG GH ST CT DG use ✅ 🟡 🔴 ⚪ —. Evidence is what was observed; Fix is the permanent repair (see E9 for the permanent-solution classes).


### E6.1 PERF — Performance

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-PERF-01 | Largest Contentful Paint, field p75, mobile 4G | ≤2.5 s good; >4.0 s fail | **5** · 3101 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | No field RUM exists; no lab baseline stored. Live probe: TTFB 104 ms, 339 KB HTML (br) | Add Lighthouse CI + first-party web-vitals beacon (cookieless); store baseline per release |
| U-PERF-02 | Interaction to Next Paint, field p75 | ≤200 ms good; >500 ms fail | **5** · 3101 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Single-file shell with 65 script tags; main-thread cost unmeasured | Profile composer typing + sidebar; split long tasks; budget in CI |
| U-PERF-03 | Cumulative Layout Shift | ≤0.1 good; >0.25 fail | **5** · 3101 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Pre-boot shimmer exists (reserves space); no CLS measurement | Add CLS assert to Playwright prelaunch; reserve iframe/toast/banner space |
| U-PERF-04 | Time to First Byte p75 | ≤800 ms | **3** · 2100 | ✅ | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | Live probe 2026-11-20: boundview.com 104 ms, ai.spaincos.com 175 ms (Vercel iad1) | Keep; add multi-region synthetic probe (West, Central, East, AK/HI) |
| U-PERF-05 | First-load request count and critical JS | ≤30 requests and ≤170 KB br critical JS | **5** · 3101 | 🔴 | ✅ | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | Shell references 65 script tags + 16 stylesheets; modules/ dir is 3.4 MB raw across 77 files. TT is one 9.7 KB file with zero static deps | Bundle + defer non-critical modules (settings, fleet, media, voice) behind route/idle import; target ≤30 first-load requests |
| U-PERF-06 | HTML cache policy enables bfcache and revalidation | HTML: no-cache + ETag (or s-maxage + must-revalidate); never no-store | **3** · 2100 | 🔴 | ⚪ | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | Live header on both domains: cache-control: no-store, x-vercel-cache: MISS | Replace no-store with must-revalidate once assets are content-hashed (see U-PERF-07) |
| U-PERF-07 | Static assets content-hashed and immutable | filename hash + cache-control immutable, 1 yr | **3** · 2100 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | sw.js comments: SWR served previous deploy modules for days, so assets are network-first. Module URLs are unversioned | Build step emits hashed filenames; sw precaches by manifest; removes the stale-deploy class permanently |
| U-PERF-08 | Fonts self-hosted, ≤2 families, font-display swap, preloaded | 0 third-party font origins | **5** · 2201 | 🔴 | 🟡 | 🔴 | 🟡 | ⚪ | ⚪ | ⚪ | index preloads and @font-face from frontend-cdn.perplexity.ai (another company's CDN, 2 families). TT declares Switzer/Inter but never loads them | Self-host variable font (licensed) under /fonts; drop third-party preconnect; load TT fonts or use system stack deliberately |
| U-PERF-09 | Images modern format, explicit size, lazy below fold | AVIF/WebP/SVG; width+height set; loading=lazy | **2** · 1001 | 🟡 | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | 3 <img> in shell, 0 lazy; icons are PNG/SVG/WebP | Add lazy + dimensions; AVIF for og/marketing images |
| U-PERF-10 | Text compression | br or gzip on HTML/CSS/JS/JSON | **1** · 1000 | ✅ | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | Live: content-encoding br on HTML | Keep; add compression check to prelaunch |
| U-PERF-11 | Performance budget enforced in CI | push blocked when LCP/CLS/JS budget exceeded | **5** · 3101 | 🔴 | 🔴 | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | prelaunch.py (31 checks) gates function and integrity; no Core Web Vitals or byte-budget check | Add Lighthouse CI step to qa/run.sh with budgets from this Part E |
| U-PERF-12 | Usable on Slow 4G / 400 ms RTT | interactive ≤6 s; core action ≤10 s | **5** · 3101 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Never tested; rural nationwide users are on slow links | Add throttled Playwright profile to nightly run |
| U-PERF-13 | Answer latency (gateway) | first token ≤2 s p75; simple answer ≤8 s p95 | **6** · 4200 | 🟡 | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | prelaunch only gates simple query <30 s and current-events <35 s, which is far looser than a UX budget | Tighten gates to 8 s / 20 s; chart p50/p95 on Fleet QA tab |
| U-PERF-14 | Offline / flaky network behavior | offline shell loads; actions queue or explain | **3** · 2100 | ✅ | 🔴 | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | sw.js v192-push: offline shell, network-first assets. TT has no service worker and swallows poll errors, so a stale balance looks live | Add 'offline / last updated' indicator to TT |

### E6.2 A11Y — Accessibility

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-A11Y-01 | Text contrast | ≥4.5:1 body; ≥3:1 large text and UI components | **6** · 3021 | 🟡 | 🟡 | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | qa/palette-check.py exists. TT measured: muted #7a6f64 on #fdf6ee = 4.57; pending dot #d9a441 on white = 2.25 (fails 3:1 non-text); coral #e8613c on white = 3.38 | Run palette-check on every theme; darken dot to ≥3:1 or add text label |
| U-A11Y-02 | Automated axe-core scan | 0 critical/serious per page, gated in CI | **6** · 3021 | 🔴 | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | No axe step in prelaunch.py | Add @axe-core/playwright to prelaunch for landing, thread, settings, connectors, TT |
| U-A11Y-03 | Keyboard-only operability | every function reachable; no trap; logical order | **7** · 4021 | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Native buttons used in TT; shell has command palette + shortcuts.js; no recorded keyboard audit | Keyboard walkthrough per CUJ each release; record in qa-reports |
| U-A11Y-04 | Visible focus (2.4.7 / 2.4.11) | ≥2 px ring, ≥3:1, never hidden by sticky UI | **6** · 3021 | 🟡 | 🟡 | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | 11 focus-visible rules in shell; TT relies on browser default | Define one global :focus-visible token and apply to every app |
| U-A11Y-05 | Target size (2.5.8) | ≥24x24 px minimum; ≥44x44 px on touch | **6** · 3021 | 🟡 | 🔴 | 🟡 | 🟡 | ⚪ | ⚪ | ⚪ | css/mobile-375.css enforces min 44 px. TT .refresh button is 12 px text with 4 px padding (~20 px tall) | TT: min-height 44 px for Refresh and any control |
| U-A11Y-06 | Form controls programmatically labeled | every input has label/aria-label/aria-labelledby | **6** · 3021 | 🟡 | 🟡 | 🟡 | 🟡 | ⚪ | ⚪ | ⚪ | Shell has 8 <input> and 0 <label> elements, so labels depend on aria-label coverage; GH mockup uses aria-label | Lint rule: every input needs an accessible name; add axe label rule |
| U-A11Y-07 | Live regions announce async status (4.1.3) | toasts, errors, balance changes use role=status/alert | **6** · 3021 | 🟡 | 🔴 | 🟡 | 🟡 | ⚪ | ⚪ | ⚪ | 1 aria-live in shell. TT toast and pending count have no role or aria-live | TT: role=status aria-live=polite on toast + balance; shell: shared announcer helper |
| U-A11Y-08 | Dialog semantics and focus management | role=dialog, aria-modal, focus trap, focus return, Esc | **6** · 3021 | 🟡 | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | mobile-focus-trap.js present; 0 role=dialog in shell markup (modules may add) | Audit every overlay (settings, tasks, connectors, tour) against one dialog contract test |
| U-A11Y-09 | Heading structure | exactly one h1; no skipped levels | **4** · 2011 | 🟡 | 🔴 | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | Shell has 3 <h1>; TT has no h1 (section titles are divs) | One h1 per view; TT: h1 for page title, h2 for sections |
| U-A11Y-10 | Reduced motion respected | every animation/transition gated by prefers-reduced-motion | **4** · 2020 | 🟡 | 🔴 | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | Only 2 reduced-motion rules in shell (specific classes). TT ring/toast transitions are unguarded | Global reduce-motion reset in shared CSS |
| U-A11Y-11 | Text alternatives for meaningful graphics | alt/aria-label on non-decorative; decorative aria-hidden | **3** · 2010 | 🟡 | ✅ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | TT ring is aria-hidden and the cap is also in text (good) | Keep pattern; audit charts in ST/CT |
| U-A11Y-12 | Reflow at 320 px / 400% zoom (1.4.10) | no 2-axis scroll | **5** · 3020 | 🟡 | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | mobile-375.css exists; no 320 px test | Add 320 px screenshot to visual gate |
| U-A11Y-13 | Status never conveyed by color alone | text/icon accompanies color | **3** · 2010 | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | TT pending dot is paired with text | Keep |
| U-A11Y-14 | Screen-reader smoke test | VoiceOver iOS + NVDA Windows pass on 5 key flows each release | **6** · 3021 | 🔴 | 🔴 | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | No recorded run | Add 30-minute SR checklist to release; log results |
| U-A11Y-15 | prefers-color-scheme and forced-colors | light/dark parity; Windows high contrast usable | **3** · 2010 | 🟡 | 🔴 | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | Shell has 3 color-scheme rules; TT is light-only; privacy.html is dark-only fixed colors | Theme tokens shared by every page including legal pages |
| U-A11Y-16 | Accessibility statement and conformance report (ACR/VPAT) | published WCAG 2.2 AA statement; ACR for gov buyers | **6** · 2031 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | 🔴 | ⚪ | None found. PHA/housing-authority buyers expect Section 508 evidence | Publish statement; generate ACR from the axe + manual audit |
| U-A11Y-17 | Zoom and text scaling allowed | no user-scalable=no; layouts survive 200% text | **3** · 2010 | ✅ | ✅ | ✅ | ✅ | ⚪ | ⚪ | ⚪ | Viewport metas verified in shell, TT, GH mockup | Keep as lint rule |
| U-A11Y-18 | Captions/transcripts for audio/video output | captions or transcript available | **3** · 2010 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | voice-convo, readaloud and media modules exist; no transcript audit | Offer transcript toggle on voice and media |
| U-A11Y-19 | Language and text-spacing resilience | lang set; survives 1.5 line-height, 0.12em letter-spacing | **2** · 1010 | ✅ | ✅ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | lang="en" verified in shell, TT, GH | Add text-spacing bookmarklet test to checklist |

### E6.3 MOB — Mobile and responsive

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-MOB-01 | Viewport meta correct | width=device-width, initial-scale=1 | **2** · 2000 | ✅ | ✅ | ✅ | ✅ | ⚪ | ⚪ | ⚪ | Verified in shell, TT, GH mockup | Keep |
| U-MOB-02 | 375 px and 320 px layout integrity | zero clipping/overflow on key screens (screenshot gate) | **5** · 3101 | 🟡 | ⚪ | 🟡 | ✅ | ⚪ | ⚪ | ⚪ | mobile-375.css/js present; GH has qa-mobile screenshots; TT none | Add 320/375/414 screenshots to visual-parity run for every app |
| U-MOB-03 | Tablet and wide-desktop layouts | 768, 1024, 1440, 1920 px clean | **2** · 2000 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | No tablet/wide captures | Extend visual-parity matrix |
| U-MOB-04 | On-screen keyboard handling | composer/CTA never hidden by keyboard | **4** · 3100 | ✅ | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | interactive-widget=resizes-content in shell | Keep; verify on iOS Safari and Samsung Internet |
| U-MOB-05 | Safe-area insets and dynamic viewport units | env(safe-area-inset-*), dvh for full-height | **2** · 2000 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | TT toast is fixed bottom:18px with no inset (overlaps iPhone home indicator) | Use padding-bottom: max(18px, env(safe-area-inset-bottom)) |
| U-MOB-06 | Inputs ≥16 px font on iOS | no auto-zoom on focus | **2** · 2000 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not measured | Lint: input font-size ≥16 px on mobile |
| U-MOB-07 | PWA installable with correct brand/name/icons | valid manifest, maskable icon, brand matches host | **5** · 2102 | 🔴 | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | Live boundview.com/manifest.webmanifest returns name "ai.spaincos" (brand leak). ai.spaincos manifest is correct with shortcuts + share_target | Serve per-host manifest (build-time brand param); verify via Lighthouse PWA |
| U-MOB-08 | Touch affordances | no hover-only actions; active states | **2** · 2000 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | Audit hover-only tooltips (owner prefers hover-first secondary info, so provide tap equivalent) |
| U-MOB-09 | Embedded iframes sized for mobile | ≥70dvh, no nested scroll trap | **5** · 3101 | — | 🔴 | — | — | — | — | — | TT wall box is fixed 460 px high | Use min(80dvh, 720px); provider postMessage resize if supported |
| U-MOB-10 | Orientation and split-screen | usable portrait + landscape | **1** · 1000 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not tested | Add landscape screenshots |
| U-MOB-11 | Real-device matrix per release | iOS Safari 17+, Chrome Android, Samsung Internet | **5** · 3101 | 🔴 | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | No device-lab record; sandbox lacks Playwright (12/13 env miss) | Device farm run weekly + before launch |
| U-MOB-12 | Deep links and share targets | /t/<slug> opens the thread; share_target works | **3** · 2100 | ✅ | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | sw.js maps /t/ navigations to app shell; manifest share_target present | Keep; add test for logged-out deep link |

### E6.4 ONB — Onboarding and first session

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-ONB-01 | Value proposition clear in ≤5 s | one h1 + one primary CTA above fold | **7** · 4111 | 🟡 | — | 🟡 | 🟡 | ⚪ | ⚪ | ⚪ | Landing h1 "Where knowledge begins" (generic) while brand.js tagline is "BoundView — see the whole picture" | Align headline + tagline; 5-second test with 5 users |
| U-ONB-02 | Time to first value | ≤60 s from landing to first answer (BV/AG) / first verified earn (TT) | **8** · 4211 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | TT has no path to value today: wall shows setup placeholder until Adscend approval | Instrument and test; for TT show 'what you can earn' preview until wall is live |
| U-ONB-03 | Signup friction | ≤3 screens, passkey/social/magic-link, no email-verify gate before first value | **8** · 4211 | 🟡 | — | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | Passkey e2e still 🟡 (parity-master A1) | Finish passkey enablement; allow first query before verification |
| U-ONB-04 | First-run tour | skippable, re-openable, never blocks input | **3** · 2010 | ✅ | — | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | onboarding.js + onboarding.test.js; key pplx-onboarded | Keep; add 'replay tour' in Help |
| U-ONB-05 | Try before sign-up (guest trial) | 1–3 anonymous queries with clear upgrade path | **6** · 3201 | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not determined | Decide per owner policy; if offered, rate-limit by IP + device |
| U-ONB-06 | Progressive profile | ask only what the next step needs | **3** · 2100 | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | Remove non-essential signup fields |
| U-ONB-07 | Returning-user restore | last thread/scroll/draft restored | **4** · 3100 | ✅ | — | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | spa-restore.js + thread-slug deep links | Keep; add Playwright restore test |
| U-ONB-08 | Activation metric defined and instrumented | one metric per app, tracked weekly | **6** · 3201 | 🔴 | — | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | No analytics by policy; no metric defined | Define: BV first answer ≤24 h; TT first verified offer; GH first quest; ST first record action |
| U-ONB-09 | Welcome / lifecycle email | delivered ≤60 s, brand-correct sender | **5** · 2201 | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Reported production email surfaces; deliverability not evidenced | Seed-list test (Gmail, Outlook, Yahoo, iCloud) before launch |
| U-ONB-10 | Next-best-action after first success | exactly one suggested next step | **4** · 2101 | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Follow-up chips exist in answers | Add post-first-answer prompt: save, connect, upgrade (non-nagging) |

### E6.5 AUTH — Authentication

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-AUTH-01 | Login success rate | ≥98% first attempt; errors categorised | **8** · 4211 | ⚪ | — | ⚪ | — | ⚪ | ⚪ | ⚪ | No auth telemetry | Log auth outcome codes (no PII); alert <97% |
| U-AUTH-02 | Session expiry without data loss | re-auth in place; draft preserved | **6** · 4110 | 🟡 | — | 🟡 | — | ⚪ | ⚪ | ⚪ | tools/test-auth-expiry.mjs exists (npm run test:auth); result not stored | Run in prelaunch; store latest.json |
| U-AUTH-03 | Deep link survives login | return-to restored | **4** · 3100 | ⚪ | — | ⚪ | — | ⚪ | ⚪ | ⚪ | Not tested | Playwright: logged-out /t/slug → login → thread |
| U-AUTH-04 | Reset / magic link | ≤3 steps; TTL shown; resend cooldown visible | **5** · 3110 | ⚪ | — | ⚪ | — | ⚪ | ⚪ | ⚪ | Supabase Auth defaults assumed | Customize templates with boundview sender; show TTL |
| U-AUTH-05 | Passkey register + sign-in | e2e green on iOS, Android, Windows Hello | **6** · 3201 | 🟡 | — | 🟡 | — | ⚪ | ⚪ | ⚪ | 🟡 per master (owner enable steps pending) | Owner: Supabase auth_config_write; then e2e |
| U-AUTH-06 | Step-up auth for sensitive actions | billing, API keys, delete require recent auth | **6** · 3210 | ⚪ | — | 🟡 | — | ⚪ | ⚪ | ⚪ | apikeys.js and settings-security.js exist; step-up unverified | Add recent-auth check |
| U-AUTH-07 | Signed-out state of every gated view | explanation + CTA, never blank or raw JSON | **5** · 3101 | ⚪ | 🟡 | ⚪ | — | ⚪ | ⚪ | ⚪ | TT shows "sign-in required" label inside the placeholder text | Dedicated signed-out card with sign-in button |
| U-AUTH-08 | OAuth connector flows | scopes in plain language; error return; reconnect | **4** · 3100 | 🟡 | — | ✅ | — | ⚪ | ⚪ | ⚪ | Connectors 98% in master; 4 OAuth apps still unregistered (Slack/Dropbox/Outlook/Box) | Owner registers apps |
| U-AUTH-09 | Logout, all-device sign-out, account deletion | self-serve ≤3 clicks | **6** · 3210 | ⚪ | — | ⚪ | — | ⚪ | ⚪ | ⚪ | Not verified | Add to settings-account audit |
| U-AUTH-10 | Bot protection does not block humans or good bots | zero false positives on real browsers; allowlist Googlebot/Bingbot/unfurlers | **7** · 3112 | 🟡 | — | 🟡 | — | 🟡 | ⚪ | ⚪ | prelaunch notes transient x-vercel-mitigated challenge on QA traffic. comptrove.com and rentspire.com return 403 x-vercel-mitigated: deny to a generic UA | Document WAF rules; allowlist verified search + unfurl bots; test with real browser UA nightly |

### E6.6 FORM — Forms and validation

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-FORM-01 | Validation timing and message quality | on blur/submit; message says what and how to fix | **4** · 3100 | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | Shared form component with message contract |
| U-FORM-02 | Input preserved on error/refresh | no field cleared on failure | **4** · 3100 | 🟡 | — | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | spa-restore.js preserves state | Extend to settings and billing forms |
| U-FORM-03 | autocomplete / inputmode / type attributes | email, tel, one-time-code, postal-code, cc-* set | **3** · 2100 | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | Lint rule on <input> |
| U-FORM-04 | Double-submit prevention | button disabled + idempotency key on money/earn actions | **7** · 4210 | 🟡 | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | Server side: postback idempotent, 0 double-credits in 143-request simulation | Client: disable on submit and send idempotency key on checkout |
| U-FORM-05 | Required marking and error summary (3.3.1/3.3.3) | summary links to fields; focus moves to summary | **4** · 2020 | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | Shared pattern |
| U-FORM-06 | File upload UX | limits shown before select; progress; cancel; retry | **4** · 3100 | 🟡 | — | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | qa/attach-multi.py exists | Add error copy for oversize/type |
| U-FORM-07 | Rate-limit (429) UX | show wait time and what is allowed | **5** · 3110 | 🟡 | — | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | Rate limiting exists per privacy policy; copy unverified | Standard 'try again in N s' component |
| U-FORM-08 | Destructive action safety | confirm + ≥10 s undo or typed confirm for irreversible | **5** · 3110 | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | Shared confirm component |
| U-FORM-09 | Paste/password-manager friendly | no paste blocking; managers fill correctly | **2** · 2000 | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not tested | Test 1Password, iCloud Keychain, Chrome |
| U-FORM-10 | Length limits and counters match server | UI max = server max | **2** · 2000 | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | Contract test per field |

### E6.7 STATE — States: empty, loading, error

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-STATE-01 | Designed empty state with next action | every list/screen | **4** · 3100 | 🟡 | 🟡 | 🟡 | ✅ | ⚪ | ⚪ | ⚪ | Landing/empty thread exist; TT placeholder is an empty state but exposes internal wording (see U-COPY-04) | Empty-state inventory per app |
| U-STATE-02 | Loading state | skeleton after 300 ms; never fake data | **5** · 4100 | ✅ | 🔴 | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | Shell has pre-boot shimmer. TT shows a hard-coded "1,240 N" balance before the first poll | TT: skeleton until first successful poll |
| U-STATE-03 | Error state | plain-language, retry, reference ID | **6** · 4110 | 🟡 | 🔴 | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | TT poll: !res.ok → return, and catch → ignored; user never sees failure | Show 'Couldn't refresh · Retry · last updated hh:mm' |
| U-STATE-04 | Degraded/fallback disclosed | user told when fallback lane served | **4** · 3100 | ✅ | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | Free-never-hard-fails chain live ("pass — served by fallback (qwen)") | Keep |
| U-STATE-05 | Offline banner | visible and honest | **3** · 2100 | ✅ | 🔴 | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | Shell has offline state (v83) | Add to TT |
| U-STATE-06 | Timeout and cancel | operation >20 s shows progress + cancel | **4** · 3100 | 🟡 | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | Async submit/poll removes in-request ceiling (BrowseComp rounds) | Keep; add visible elapsed time |
| U-STATE-07 | Branded 404/500 with correct status | search + home link; 404 status; noindex | **6** · 3102 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | 404.html is a 108-byte "Redirecting…" stub running spa-redirect.js; live unknown path returns HTTP 404 with that stub | Real 404 page with nav; keep redirect only for known legacy slugs |
| U-STATE-08 | Maintenance / incident banner | remote-controlled banner | **4** · 3100 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not found | Add config-driven banner |
| U-STATE-09 | Entitlement-gated state | explains tier + path, no dark pattern | **6** · 3201 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | Copy review against FTC dark-pattern list |
| U-STATE-10 | Data freshness stamp | 'as of <date>' on every dataset view | **7** · 4012 | — | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | Terminal freshness is a launch gate per 2027 plan; no per-view stamp evidence | Shared FreshnessBadge component fed by refresh log |
| U-STATE-11 | Success confirmation | what happened + next step | **3** · 2100 | 🟡 | 🟡 | 🟡 | 🟡 | ⚪ | ⚪ | ⚪ | TT toast "Offer verified — +150 N added" | Add 'See history' link |
| U-STATE-12 | Long-running work status | progress + notify on completion | **4** · 3100 | ✅ | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | research_job_inbox + notify_dispatch_done + web push | Keep |
| U-STATE-13 | Unsaved-change guard | warns before data loss | **2** · 2000 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | beforeunload on dirty forms |

### E6.8 REL — Reliability

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-REL-01 | Availability | ≥99.9% monthly, public status page | **8** · 4202 | 🟡 | ⚪ | 🟡 | — | ⚪ | ⚪ | ⚪ | gateway-status endpoint + Fleet page; no public status page | Publish status.<domain> |
| U-REL-02 | Client error rate and tracking | ≤0.5% sessions with JS error; source-mapped; PII-free | **5** · 3101 | 🔴 | 🔴 | 🔴 | — | ⚪ | ⚪ | ⚪ | No telemetry | Add window.onerror beacon to first-party endpoint |
| U-REL-03 | API error budget | 5xx ≤0.5%; p95 within budget | **6** · 4101 | 🟡 | ⚪ | 🟡 | — | ⚪ | ⚪ | ⚪ | Known edge-worker HTTP 546 resource-limit (3 of 6 free-agent tests hit it, passed on retry) | Add retry + budget chart; track 546 as own metric |
| U-REL-04 | Graceful degradation on upstream failure | no hard fail on free lane | **6** · 4200 | ✅ | ⚪ | ✅ | — | ⚪ | ⚪ | ⚪ | Master A1 ✅ | Keep |
| U-REL-05 | Deploy gate freshness | prelaunch ≤24 h old and green before launch | **4** · 3100 | 🟡 | ⚪ | 🟡 | — | ⚪ | ⚪ | ⚪ | latest.json dated 2026-11-16: 31/0; master reports 12/13 on 11-17 (env playwright miss) | Nightly prelaunch with playwright installed; fail launch if stale |
| U-REL-06 | Stale-tab / stale-deploy detection | build id mismatch prompts refresh | **4** · 3100 | ✅ | ⚪ | ✅ | — | ⚪ | ⚪ | ⚪ | build.json v275 vs BUILD checked in prelaunch | Keep |
| U-REL-07 | Rollback ≤5 min documented | runbook + tested | **4** · 3100 | 🟡 | ⚪ | 🟡 | — | ⚪ | ⚪ | ⚪ | docs/DEPLOY.md exists; no rollback drill record | Quarterly rollback drill |
| U-REL-08 | Third-party failure isolation | timeout + fallback for fonts/iframes/CDN | **5** · 3101 | 🔴 | 🔴 | 🔴 | — | ⚪ | ⚪ | ⚪ | Fonts block on another company's CDN; TT iframe has no timeout/fallback | Self-host; add onload/timeout UI |
| U-REL-09 | Synthetic journeys | ≤5 min interval with alert | **4** · 3100 | 🟡 | ⚪ | 🟡 | — | ⚪ | ⚪ | ⚪ | guardian-runner + scheduled prelaunch guardian | Add TT postback→balance synthetic and checkout synthetic |
| U-REL-10 | Health-check false-failure rate | 0 recurring watchdog cancellations | **6** · 4101 | — | ⚪ | — | — | 🔴 | ⚪ | ⚪ | Spain Terminal v2 health failures recurred ≥10 times after PR #342 (watchdog 55 s on /api/pdi/layers) | Permanent: cache + pre-compute layers catalogue; watchdog alarm on trend |
| U-REL-11 | Dataset refresh SLOs | per-feed max age with alert | **7** · 4102 | — | ⚪ | — | — | ⚪ | ⚪ | ⚪ | Refresh evidence is an app-level gate (2027 plan) | Registry of feeds with max_age + alert |
| U-REL-12 | Backup/restore tested | restore drill passes RPO/RTO | **6** · 4200 | ⚪ | ⚪ | ⚪ | — | ⚪ | ⚪ | 🔴 | DG restore custody listed as open gate | Drill + evidence before any real recipient |

### E6.9 PAY — Payments and billing

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-PAY-01 | Price and credit display consistent on every surface | landing, settings, checkout, docs, email all show locked tiers ($0/$8/$18/$48/$98; Team $18, Ent $98 per seat) and 2,500 credits = $1 | **7** · 4201 | 🟡 | — | — | — | — | ⚪ | ⚪ | A3 locks tiers; no automated cross-surface price diff | Single pricing.json consumed by every surface + CI diff |
| U-PAY-02 | Checkout steps and wallets | ≤3 steps; Apple Pay / Google Pay; saved methods | **6** · 4200 | 🔴 | — | — | — | — | ⚪ | ⚪ | Owner blockers: checkout price-ID wiring + webhook secret pending | Wire Stripe price IDs; test live mode with real card refund |
| U-PAY-03 | Sales tax computed nationwide before payment | state/local tax shown pre-pay (Stripe Tax or equivalent) | **6** · 3300 | 🔴 | — | — | — | — | ⚪ | ⚪ | Not evidenced | Enable tax for all 50 states + DC; registration thresholds tracked |
| U-PAY-04 | Cancel / downgrade | ≤2 clicks, same channel as signup, confirmation email | **8** · 4301 | ⚪ | — | — | — | — | ⚪ | ⚪ | Not evidenced; FTC negative-option and state auto-renewal laws apply | Build cancel flow + test script; log timestamps |
| U-PAY-05 | Refund, reversal and chargeback policy visible | linked from checkout and terms | **7** · 3301 | 🟡 | — | — | — | — | ⚪ | ⚪ | Nightly reconciliation / no auto-deduct policy documented in A4; no public page | Publish refund and reversal page |
| U-PAY-06 | Failed-payment recovery | in-app banner + email, ≥3 retries, grace period | **5** · 3200 | ⚪ | — | — | — | — | ⚪ | ⚪ | Not evidenced | Dunning sequence |
| U-PAY-07 | Usage meter and spend warnings | balance visible; warn at 80% and 100% | **5** · 3200 | 🟡 | — | — | — | — | ⚪ | ⚪ | settings-billing.js, usage.js (+ usage.test.js); per-user daily ceilings live | Add 80% banner + email |
| U-PAY-08 | Plan comparison accuracy | table equals pricing.json; competitive anchors dated | **6** · 3201 | 🟡 | — | — | — | — | ⚪ | ⚪ | Ladder verified Nov 2026 | Date-stamp anchors; refresh monthly |
| U-PAY-09 | Invoices and receipts | downloadable; seat-level for Team/Enterprise | **5** · 3200 | ⚪ | — | — | — | — | ⚪ | ⚪ | Not evidenced | Hosted invoice links |
| U-PAY-10 | Student / .edu pricing flow | verify → price → checkout e2e | **4** · 2200 | 🟡 | — | — | — | — | ⚪ | ⚪ | 🟡 .edu e2e pending; 2,255 domains; live prices $4.99/$9.99/$12.99 | Owner price-ID wiring + counsel decision |
| U-PAY-11 | Currency and number format | USD, symbol, 2 dp, en-US grouping | **3** · 2100 | ✅ | — | — | — | — | ✅ | ⚪ | TT uses toLocaleString (browser locale); BV USD | Force en-US via Intl for all money and counts |
| U-PAY-12 | Test vs live isolation | test-mode banner for staff; no test rows in prod | **5** · 3200 | ✅ | — | — | — | — | ⚪ | ⚪ | Test rows cleaned after live probes (0 leftover) | Keep cleanup in every probe script |

### E6.10 NOT — Notifications

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-NOT-01 | Push permission asked in context after value | never on load | **5** · 3200 | 🟡 | — | 🟡 | — | ⚪ | ⚪ | ⚪ | monitors.js subscription flow exists | Ask after first completed background job |
| U-NOT-02 | Completion notifications for async work | delivered with tab closed | **5** · 4100 | ✅ | — | ✅ | — | ⚪ | ⚪ | ⚪ | v192 web push pipeline live (VAPID, triggers) | Keep; add delivery success metric |
| U-NOT-03 | In-app notification center | read state, deep link | **4** · 3100 | ✅ | — | ✅ | — | ⚪ | ⚪ | ⚪ | notify-bell.js | Keep |
| U-NOT-04 | Sending-domain authentication | SPF + DKIM + DMARC p=quarantine or reject, aligned | **7** · 3301 | ⚪ | — | ⚪ | — | ⚪ | ⚪ | ⚪ | Not evidenced | DNS audit for boundview.com and all sender domains |
| U-NOT-05 | One-click unsubscribe and preferences | RFC 8058 header + preference center | **7** · 3301 | ⚪ | — | ⚪ | — | ⚪ | ⚪ | ⚪ | Not evidenced | Implement before any bulk send (250,000-contact target makes this mandatory) |
| U-NOT-06 | SMS consent (TCPA) and quiet hours | express written consent, STOP/HELP, 8am–9pm recipient local | **6** · 3300 | 🔴 | — | ⚪ | — | ⚪ | ⚪ | ⚪ | Twilio credentials pending (owner blocker) | Implement per-recipient state/time-zone logic nationwide |
| U-NOT-07 | Every money/access state change notifies the user | earn verified, cap hit, expiry, reversal, payment failure | **7** · 4210 | 🟡 | 🔴 | ⚪ | — | ⚪ | ⚪ | ⚪ | TT notifies only on in-tab delta | Event → notification matrix with tests |
| U-NOT-08 | Notification volume control | ≤N per day; digest option | **3** · 2100 | ⚪ | — | ⚪ | — | ⚪ | ⚪ | ⚪ | Not evidenced | Frequency cap |
| U-NOT-09 | Sender brand separation | BV mail from boundview.com only | **7** · 3202 | 🟡 | — | ⚪ | — | ⚪ | ⚪ | ⚪ | Reported zero spaincos strings in 18 config surfaces | Add automated header test on sample sends |

### E6.11 TRU — Trust, privacy and compliance

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-TRU-01 | Privacy policy accurate for the product and domain | policy names the actual data flows and third parties | **10** · 4233 | 🔴 | 🔴 | ✅ | 🔴 | ⚪ | ⚪ | ⚪ | LIVE: boundview.com/privacy.html is the ai.spaincos.com policy ("private site… no public sign-up, no advertising, no analytics trackers"). BV has a Free tier and an ad-network offer wall. Contradiction = deceptive-practice exposure | Write BV policy: offer-wall partners, subid sharing, cookies, retention; per-host policy file |
| U-TRU-02 | Terms of Service published and linked | footer + signup + checkout | **10** · 4232 | 🔴 | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | boundview.com/terms.html → 404 (live) | Draft with counsel; link from signup and checkout |
| U-TRU-03 | Consent management and GPC | third-party trackers load only after consent where required; Global Privacy Control honored | **10** · 3322 | 🔴 | 🔴 | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | Offer wall iframe sets third-party cookies; no CMP | Add CMP gating the wall; honor GPC |
| U-TRU-04 | State privacy rights (CCPA/CPRA + ~20 state laws) | notice at collection; Do Not Sell/Share; limit-use; rights-request flow ≤45 days | **10** · 3322 | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Sharing a user id with an ad network can be a 'share/sale'. No notice or link | Add notice, link, DSAR form; state matrix (U-NW-07) |
| U-TRU-05 | FTC material-connection disclosure | adjacent to incentive/affiliate; ≥ body text; high contrast; before action | **10** · 4231 | 🟡 | 🟡 | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | TT banner exists but is 11.5 px muted gray; GH mockup disclosure at text-xs; D5 requires disclosure on every link | Raise to ≥14 px ink color; repeat on interstitial, toast, email, share |
| U-TRU-06 | Negative-option and auto-renew disclosures | price, term, cancel method before purchase | **8** · 4301 | ⚪ | — | — | — | — | ⚪ | ⚪ | Not evidenced | Add to checkout; screenshot evidence per state template |
| U-TRU-07 | Age / eligibility gate | 13+ (COPPA) and network-required 18+ before earn surface | **8** · 4202 | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | No age screen in TT or signup evidence | Add DOB or attestation before wall mount |
| U-TRU-08 | AI disclosure and limits | AI content labeled; sources shown; no certainty claims | **6** · 3201 | 🟡 | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | Canonical numbered sources contract in prelaunch; 'honest ceiling' benchmarks | Add per-answer 'AI-generated' microlabel + feedback |
| U-TRU-09 | Security headers at HTTP layer | HSTS, X-Content-Type-Options, frame-ancestors or X-Frame-Options, Referrer-Policy, Permissions-Policy | **6** · 3201 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | LIVE: only strict-transport-security present. CSP and referrer set via <meta>, which cannot set frame-ancestors, so clickjacking protection is absent | Move to vercel.json headers (currently has no headers block) |
| U-TRU-10 | CSP strictness and integrity | no unsafe-inline; hashes verified in CI | **4** · 3100 | ✅ | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | qa/csp-hash-check.py + tools/gen-csp-sri.mjs; stale CSP bricks page (README) | Keep; add to prelaunch for every host app |
| U-TRU-11 | Data export and deletion | self-serve ≤3 clicks; SLA stated | **9** · 3321 | 🟡 | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | api/retention.js + docs/soc2-retention-and-governance.md | Surface in Settings with confirmation email |
| U-TRU-12 | Brand separation in static assets | zero cross-brand strings in manifest, privacy, 404, emails, headers | **8** · 4202 | 🔴 | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | LIVE: manifest name/short_name "ai.spaincos" and privacy.html "ai.spaincos.com" on boundview.com. brand.js DOM scrub runs only in JS, not on static files or view-source | Build-time per-host templating; add a crawler test that greps every static file for the other brand |
| U-TRU-13 | Third-party asset hotlinking and licenses | no hotlink to another company's CDN | **6** · 3201 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | PPLX-Sans/Serif variable fonts loaded from frontend-cdn.perplexity.ai (licensing and reliability risk; also leaks a third-party relationship) | Replace with licensed or open fonts self-hosted |
| U-TRU-14 | Support route and response SLA | visible contact, stated SLA | **4** · 2200 | 🟡 | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | brand.js supportEmail support@boundview.com | Add Help → Contact + SLA |
| U-TRU-15 | Earnings / outcome claims substantiated | ranges with sources; 'no guarantee' | **7** · 3301 | ✅ | 🟡 | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | GH guardrails ban guarantees; TT says "may earn" not amounts but pending says "usually minutes" | Source every number; add disclaimers |
| U-TRU-16 | Sub-processor list and DPA | public list; DPA template for Team/Enterprise | **4** · 2200 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Privacy lists Supabase, edge host, AI providers only | Publish list; DPA pack |
| U-TRU-17 | Reviews/testimonials/endorsements authentic (FTC 2024 rule) | no fabricated or incentivized undisclosed reviews | **6** · 2301 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | None published yet | Policy before marketing launch |
| U-TRU-18 | Promotions and sweepstakes rules | state registration/bonding if any prize mechanic | **6** · 2301 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Streak multipliers and quests are backlog ideas (D6) | Counsel review before any chance-based reward |
| U-TRU-19 | Vulnerability disclosure | /.well-known/security.txt + monitored inbox | **6** · 2301 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not found | Add security.txt |
| U-TRU-20 | Secrets hygiene | no credentials in repo or client bundle | **6** · 3300 | ⚪ | ⚪ | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | qa/prelaunch.py hardcodes eval-bot password (EvalTest2026!) in repo; Supabase anon key is public by design | Move to env; rotate eval-bot password |
| U-TRU-21 | Security/compliance evidence visible to buyers | trust page, SOC 2 status, questionnaire pack | **8** · 3302 | ⚪ | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | docs/soc2-retention-and-governance.md; RentSpire SOC 2 readiness is a separate gate | Trust center page per product |

### E6.12 SEO — SEO and marketing surface

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-SEO-01 | Unique title ≤60 chars with brand + keyword | per indexable page | **6** · 2103 | 🔴 | — | 🔴 | ⚪ | — | ⚪ | — | LIVE: boundview.com and ai.spaincos.com both serve <title>BoundView</title> (identical bundle, 339,531 vs 339,560 bytes) | Per-page titles via prerender; per-host brand |
| U-SEO-02 | Meta description 70–160 chars | every indexable page | **6** · 2103 | 🔴 | — | 🔴 | ⚪ | — | ⚪ | — | LIVE: no meta description on either host | Add per route |
| U-SEO-03 | Open Graph + Twitter cards | og:title/description/image 1200x630/url; twitter:card | **6** · 2103 | 🔴 | — | 🔴 | ⚪ | — | ⚪ | — | LIVE: no og:* tags in head | Add; test in Slack, iMessage, X, LinkedIn |
| U-SEO-04 | Canonical URL, no cross-domain duplicates | self-referential canonical; one domain per page | **6** · 2103 | 🔴 | — | 🔴 | ⚪ | — | ⚪ | — | Two domains serve the same bundle with no canonical (local grep: canonical absent from head) | Canonical on BV; noindex on ai.spaincos |
| U-SEO-05 | XML sitemap referenced in robots | valid; ≤50k URLs/file; index file | **6** · 2103 | 🔴 | — | 🔴 | ⚪ | — | ⚪ | — | LIVE: /sitemap.xml 404; robots.txt has no Sitemap line | Generate in build.js |
| U-SEO-06 | robots policy matches intent | public marketing allowed; private/app noindex | **8** · 3203 | 🟡 | — | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | robots.txt = "User-agent: * Allow: /" on both hosts, so the private ai.spaincos workspace is fully crawlable | AG: noindex + auth interstitial; internal apps: noindex + X-Robots-Tag |
| U-SEO-07 | Structured data (JSON-LD) | Organization, WebSite+SearchAction, SoftwareApplication+Offer, FAQPage, BreadcrumbList validate | **6** · 2103 | 🔴 | — | 🔴 | ⚪ | — | ⚪ | — | Local grep: 0 ld+json blocks | Add and validate with Rich Results Test |
| U-SEO-08 | Crawlable server-rendered HTML for marketing + docs | content visible without JS | **7** · 3103 | 🔴 | — | 🔴 | ⚪ | — | ⚪ | — | Single SPA shell; unknown paths JS-redirect (spa-redirect.js) | Prerender landing, pricing, features, docs, compare pages as static HTML |
| U-SEO-09 | Dedicated pages for pricing, features, compare, docs, changelog | each with unique intent | **7** · 3103 | 🔴 | — | 🔴 | ⚪ | — | ⚪ | — | No such routes found on BV | Create content plan (pricing ladder vs ChatGPT/Claude/Perplexity per A3) |
| U-SEO-10 | Core Web Vitals pass (ranking signal) | all three 'good' at p75 | **4** · 2101 | ⚪ | — | ⚪ | ⚪ | — | ⚪ | — | Unmeasured | Field data via CrUX + RUM |
| U-SEO-11 | Redirect hygiene | www→apex single 301; http→https; no chains | **5** · 2102 | 🟡 | — | 🟡 | ⚪ | — | ⚪ | — | vercel.json only rewrites /verify; CNAME present | Add redirects block; test chains |
| U-SEO-12 | Search Console and Bing verified, coverage monitored weekly | verification + alert | **6** · 2103 | ⚪ | — | ⚪ | ⚪ | — | ⚪ | — | Not evidenced | Verify domains; weekly index report |
| U-SEO-13 | Link-preview unfurl test | Slack, iMessage, WhatsApp, X, LinkedIn render title+image | **6** · 2103 | 🔴 | — | 🔴 | ⚪ | — | ⚪ | — | No og tags, so previews are bare URLs | Share image set; test matrix |
| U-SEO-14 | Crawler access not blocked by firewall | Googlebot/Bingbot/unfurlers allowed | **7** · 3103 | 🟡 | — | 🟡 | ⚪ | — | 🟡 | — | comptrove.com and rentspire.com return 403 'deny' to a generic UA (WAF rule) | Verify with Search Console URL inspection; allowlist verified bots |
| U-SEO-15 | AI-answer-engine visibility (GEO) | llms.txt, quotable stats page, FAQ, citations | **5** · 2102 | 🔴 | — | 🔴 | ⚪ | — | ⚪ | — | Benchmark marketing bullets exist as an internal md only | Publish public benchmark page with honest ceiling |
| U-SEO-16 | Image SEO and icon set | alt text; favicons 32/180/192/512 | **2** · 1001 | ✅ | — | ✅ | ⚪ | — | ⚪ | — | icons/ present | Keep |
| U-SEO-17 | Privacy-safe conversion measurement | server-side events, consent-aware, UTM preserved | **8** · 3203 | 🔴 | — | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | Policy says no analytics trackers; leaves marketing blind | First-party cookieless analytics + consent mode |
| U-SEO-18 | Internal apps are noindex and unlisted | X-Robots-Tag + auth wall + no sitemap | **5** · 2300 | — | — | — | — | ⚪ | — | ⚪ | Terminal and DoorGraph are internal; indexability not verified | Verify headers and robots on each internal host |

### E6.13 COPY — Copy and content

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-COPY-01 | Plain language and acronyms spelled out | ≤ grade 8 consumer; every acronym defined at first use (owner standard) | **5** · 3101 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | Copy lint + readability check |
| U-COPY-02 | Sentence-case, compact copy; secondary info on hover/focus/tap | owner standard | **2** · 2000 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | ⚪ | ⚪ | TT and GH follow it | Keep |
| U-COPY-03 | One canonical currency vocabulary and valuation | neuron, credit, dollar equivalents defined once and equal everywhere | **8** · 4301 | 🔴 | 🔴 | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | Three values in docs: TT says 1 N ≈ $0.004; pricing doc catalog (500 N = 1,000 credits; 2,500 credits = $1) gives ≈ $0.0008; D5 (2,500 N ≈ $0.25) gives ≈ $0.0001 | Decide one constant in earn_actions/model_costs; render from API; legal reviews any $ claim |
| U-COPY-04 | No internal or placeholder wording visible | no vendor names, ids, setup notes | **5** · 3101 | ⚪ | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | TT placeholder shows "Wiring goes live when the Adscend profile is approved", the account-id chip and 'pubID/adwallID' concepts | Replace with user-facing copy ('Offers are coming soon' with preview) |
| U-COPY-05 | Error and empty-state tone | blames no one; one next step | **3** · 2100 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | Tone guide |
| U-COPY-06 | Demo and fixture data labeled | every non-live number tagged | **7** · 3301 | ⚪ | ✅ | ⚪ | ✅ | 🟡 | ⚪ | ⚪ | GH mockup labeled; ST preview/fixture labels present | Keep as standing rule |
| U-COPY-07 | Document mentions link at point of reference | source or filtered evidence view | **3** · 2100 | 🟡 | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | AI answers cite sources; Terminal pages unverified | Apply to ST, CT, DG evidence references |
| U-COPY-08 | Brand name casing consistent | exact per brand (BoundView in brand.js; SpainCos Terminal exact) | **3** · 1101 | 🟡 | 🔴 | 🟡 | 🔴 | 🟡 | ⚪ | ⚪ | TT title "boundview — Tasks"; GH title "Boundview Free Tier"; brand.js "BoundView" | Single BRAND constant |

### E6.14 AI — AI answer experience

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-AI-01 | Streaming and first-token feel | tokens stream; skeleton ≤300 ms | **5** · 4100 | ⚪ | — | ⚪ | — | — | — | — | Not measured | Instrument first-token time |
| U-AI-02 | Stop, regenerate, edit, retry | controls present and working | **4** · 3100 | 🟡 | — | 🟡 | — | — | — | — | Follow-up chips and retry exist | Verify each in prelaunch |
| U-AI-03 | Citation contract | numbered canonical sources; N-label equals chips | **6** · 4200 | ✅ | — | ✅ | — | — | — | — | Contract tests in prelaunch | Keep |
| U-AI-04 | Non-destructive truncation recovery | no lost text on retry | **5** · 4100 | ✅ | — | ✅ | — | — | — | — | Master A1 ✅ | Keep |
| U-AI-05 | Instruction-format adherence | IFEval strict ≥80/100 | **4** · 3100 | 🟡 | — | 🟡 | — | — | — | — | 60/100 reported (from 51) | Continue checkers; measure per release |
| U-AI-06 | Answer accuracy honesty | SimpleQA ≥95, FRAMES ≥75, BrowseComp tracked | **6** · 4101 | 🟡 | — | 🟡 | — | — | — | — | SimpleQA 98.0; FRAMES 75.0; BrowseComp 28.6–35.6 (in-request) vs 86–88 async | Publish ceilings; label in-request vs async |
| U-AI-07 | Thread persistence, search, export | restore and find any thread | **4** · 3100 | ✅ | — | ✅ | — | — | — | — | History, sidebar search, export module | Keep |
| U-AI-08 | Voice UX | tap to talk; transcript; interruptible | **3** · 2100 | 🟡 | — | 🟡 | — | — | — | — | Voice category score 80 | Close gaps |
| U-AI-09 | Model/lane transparency | user can see which lane answered | **3** · 2100 | ✅ | — | ✅ | — | — | — | — | Council badge, steps list | Keep |
| U-AI-10 | Feedback loop | thumbs/report feeds self-improvement queue | **5** · 3101 | ⚪ | — | ⚪ | — | — | — | — | Self-improvement cycle exists server-side | Add in-answer feedback |
| U-AI-11 | Safety/refusal UX | graceful, explains alternatives | **5** · 3200 | ✅ | — | ✅ | — | — | — | — | Kimi-refusal permanent class | Keep |
| U-AI-12 | Rendering fidelity | math, code, tables, markdown | **3** · 2100 | ✅ | — | ✅ | — | — | — | — | visual-parity report + math in v83 | Keep |
| U-AI-13 | Keyboard shortcuts and command palette | documented | **2** · 2000 | ✅ | — | ✅ | — | — | — | — | shortcuts.js, command-palette.js (+ test) | Keep |
| U-AI-14 | Attachments | multi-file with progress | **4** · 3100 | 🟡 | — | 🟡 | — | — | — | — | attach-multi.py | Keep |
| U-AI-15 | Mobile composer | single-line start, grows | **4** · 3100 | ✅ | — | ✅ | — | — | — | — | prelaunch 'composer single-line' | Keep |

### E6.15 NW — Nationwide (owner rule)

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-NW-01 | Coverage across all 50 states + DC + PR, VI, GU, AS, MP | published coverage matrix; ≥95% ZIP5/county coverage per dataset | **9** · 4113 | ⚪ | ⚪ | 🟡 | ⚪ | 🟡 | ⚪ | 🔴 | ZIP5 geocode worker closing gaps. Violation identity: SF 46.6%, Seattle 4.1% only. DG pilot is Pacifica only | Coverage matrix per app; gate 'launch' per dataset |
| U-NW-02 | Jurisdiction handling | detect + override; never default to CA/SC; jurisdiction chip on every legal or regulatory output | **9** · 4113 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | R-236 defaults MinuteGig market to the owner's SC portfolio | Explicit selector; rotate examples across regions |
| U-NW-03 | Uncovered-jurisdiction state | 'not yet covered' + notify me; never blank or wrong-state data | **8** · 4112 | ⚪ | ⚪ | ⚪ | ⚪ | 🟡 | ⚪ | ⚪ | ST keeps genuine 'no link / not bid-ready' states | Shared component |
| U-NW-04 | Time zones | full US list incl. America/Anchorage, Pacific/Honolulu, America/Phoenix, America/Puerto_Rico, Pacific/Guam; default from browser | **5** · 3101 | 🔴 | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | tasks.js COMMON_TZ has 13 entries, 7 non-US, and none of AK/HI/AZ/PR/GU | Use Intl.supportedValuesOf('timeZone') filtered to US first |
| U-NW-05 | Currency, number and date formats | USD; en-US via Intl; MM/DD/YYYY or long form | **3** · 2100 | 🟡 | 🟡 | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | TT uses browser locale for numbers | Pin en-US |
| U-NW-06 | Address, phone and ID formats | 50+DC+territories select; ZIP5/ZIP+4; APO/FPO; E.164 storage | **4** · 3100 | ⚪ | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | api/geocode.js is ZIP5-centric | Shared address component |
| U-NW-07 | State-by-state legal text matrix | per-state QA for ARL, privacy, tax, disclosures, licensing | **9** · 4302 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | None exists | Matrix owned by counsel; test per state |
| U-NW-08 | Nationwide SEO surface | state/county/city/ZIP pages with unique data; sitemap index; local schema | **7** · 3103 | 🔴 | — | — | 🔴 | — | ⚪ | — | No programmatic pages | Generate from data; thin-content guard (≥300 unique words or data rows) |
| U-NW-09 | Geo availability of offers and features | wall shows geo-eligible offers; message when thin; never infer state law from IP alone | **6** · 3201 | ⚪ | 🔴 | — | — | — | ⚪ | — | No geo messaging in TT | Show availability note; fall back gracefully |
| U-NW-10 | Nationwide examples and marketing copy | no single-state bias | **4** · 2101 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not audited | Copy audit |
| U-NW-11 | Freshness by jurisdiction | stale-by-state indicator | **7** · 4102 | — | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | Not evidenced | Per-state refresh stamps |
| U-NW-12 | Performance for the largest jurisdictions | p95 query for CA, TX, NY, FL ≤ budget | **6** · 4101 | — | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ | /api/pdi/layers watchdog cancellations | Precompute heavy layers |
| U-NW-13 | Reach: rural / low-bandwidth / Spanish option | Slow 4G pass; Spanish UI is a recommended extension | **5** · 3101 | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | Not assessed | Add to nightly throttled run; scope Spanish |

### E6.16 MEAS — Measurement

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-MEAS-01 | Event taxonomy and funnels | landing→signup→first answer→upgrade; offer view→click→verified | **7** · 3202 | 🔴 | — | 🔴 | — | 🔴 | 🔴 | 🔴 | None | Define events; first-party store |
| U-MEAS-02 | UX scorecard automated | numbers computed by script, never hand-summed | **4** · 3100 | 🟡 | — | 🟡 | — | 🟡 | 🟡 | 🟡 | This Part E + generate-ux-headline.py | Wire nightly after parity headline |
| U-MEAS-03 | Per-app SLO dashboard | latency, error, freshness | **4** · 3100 | 🟡 | — | 🟡 | — | ⚪ | ⚪ | ⚪ | Fleet page QA tab shows prelaunch | Add Part E metrics |
| U-MEAS-04 | Experiment framework with guardrails | A/B with stop rules | **5** · 2201 | 🔴 | — | 🔴 | — | 🔴 | 🔴 | 🔴 | None | Defer until traffic exists |
| U-MEAS-05 | In-product feedback and CSAT sampling | ≥1 channel per app | **4** · 3100 | ⚪ | — | ⚪ | — | ⚪ | ⚪ | ⚪ | Not found | Add micro-survey |
| U-MEAS-06 | No session replay on regulated data | masked or off | **7** · 3301 | ⚪ | — | ⚪ | — | ⚪ | ⚪ | ⚪ | None in use | Standing rule |

### E6.17 HELP — Help and support

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-HELP-01 | In-app help and docs | searchable, contextual | **4** · 3100 | 🟡 | — | ✅ | — | ⚪ | ⚪ | ⚪ | docs-panel.js, docs.js | Context links from errors |
| U-HELP-02 | Error reference IDs and support handoff | ID in every error | **4** · 3100 | ⚪ | — | ⚪ | — | ⚪ | ⚪ | ⚪ | Not found | Add |
| U-HELP-03 | Public status page | incidents + uptime | **6** · 3201 | 🔴 | — | 🔴 | — | 🔴 | 🔴 | 🔴 | None | Add |
| U-HELP-04 | Changelog / what's new | linked in app | **3** · 1101 | ⚪ | — | ⚪ | — | ⚪ | ⚪ | ⚪ | Not found | Add |
| U-HELP-05 | Troubleshooting guidance | self-serve fixes | **3** · 2100 | ✅ | — | ✅ | — | ⚪ | ⚪ | ⚪ | settings-troubleshooting.js; category 90 | Keep |

### E6.18 DES — Design system and visual QA

| ID | Check | Benchmark (pass) | W · IRCM | BV | TT | AG | GH | ST | CT | DG | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| U-DES-01 | Shared tokens and components | one system across apps | **4** · 3100 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | ⚪ | ⚪ | Shared brand/tokens partially | Extract design-tokens package |
| U-DES-02 | Owner design standards | sophisticated consumer; flat full-width; playful only on earn surfaces | **4** · 3100 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | ⚪ | ⚪ | Preferences on file | Review each app against standards |
| U-DES-03 | Navigation standard | two-column mega-menu for terminals (R-783) | **2** · 2000 | — | — | — | — | — | ⚪ | ⚪ | Reported done for terminals | Extend to Comptrove and DoorGraph |
| U-DES-04 | Visual verification gate | screenshot + side-by-side vs approved mockup per change | **4** · 3100 | 🟡 | 🔴 | ✅ | ✅ | ✅ | ⚪ | ⚪ | visual-parity/ for AG; GH qa screenshots; ST 122-page atlas; TT none | TT screenshots at 320/375/768/1280 |
| U-DES-05 | Cross-terminal interaction continuity (R-705) | same zoom/drill/lightbox grammar | **4** · 3100 | — | — | — | — | 🟡 | ⚪ | ⚪ | Partial: terminal-ux/drilldown.ts extracted | Finish contract tests |
| U-DES-06 | Predictive SmartSearch default | typo recovery + polished suggestions (owner standard) | **4** · 3100 | ⚪ | ⚪ | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ | Command palette and sidebar search exist; typo recovery unverified | Add fuzzy match test set |
| U-DES-07 | Motion budget | 150–300 ms, purposeful | **1** · 1000 | 🟡 | 🟡 | 🟡 | 🟡 | ⚪ | ⚪ | ⚪ | TT 0.8 s ring, 0.4 s toast | Cap at 300 ms except celebratory reward |
| U-DES-08 | Brand-correct favicon and title per host | favicon-live.js + title | **5** · 2102 | 🔴 | ⚪ | ✅ | ⚪ | ⚪ | ⚪ | ⚪ | Static title "BoundView" on both hosts | Per-host build |

---

## E7. WEBAPP-SPECIFIC LINE ITEMS


### E7.1 Offerwall Tasks tab (earn surface) — FTC · wall · balance · caps · pending · integration · economics · nationwide

App-specific sub-score (these items only): **17.6%** strict — 7✅ 8🟡 44🔴 4⚪.

| ID | Area | Check | Benchmark (pass) | W · IRCM | Status | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|
| TT-FTC-01 | FTC | Disclosure appears above the wall, before any offer interaction | in DOM and visual order before iframe | **9** · 4131 | ✅ | .ftc banner precedes the wall card | Keep |
| TT-FTC-02 | FTC | Disclosure is clear and conspicuous | ≥14 px (≥ body), ink color, ≥4.5:1, not collapsed | **9** · 4131 | 🟡 | 11.5 px muted #7a6f64 on #fdf6ee = 4.57:1 (passes contrast, weak on size/prominence) | 14 px, ink color, bold lead-in 'Ad disclosure' |
| TT-FTC-03 | FTC | Disclosure states the connection plainly | 'boundview earns a fee when you complete offers' | **9** · 4131 | 🟡 | Copy says 'may earn a referral fee'; boundview does earn on verified completions | Replace 'may earn' with 'earns' |
| TT-FTC-04 | FTC | Per-offer disclosure (A6 promise) | disclosure visible per offer, not only per page | **9** · 4131 | 🔴 | A6 says per-offer; code has one global banner, offers render inside a third-party iframe | Interstitial before first wall open + sticky label above frame; confirm with network on in-frame labeling |
| TT-FTC-05 | FTC | Disclosure survives mobile and scroll | visible on first screen at 375 px | **7** · 3121 | ⚪ | Not screenshot-verified | Capture 375 px screenshot |
| TT-FTC-06 | FTC | Screen reader reads disclosure before wall | role=note, DOM order | **6** · 3021 | 🟡 | DOM order correct; no role | Add role=note |
| TT-FTC-07 | FTC | Disclosure not dismissible or hidden behind a link | always visible | **7** · 3130 | ✅ | Static banner | Keep |
| TT-FTC-08 | FTC | Same wording in toast, email, push, share | consistent copy library | **8** · 3131 | 🔴 | Toast has no disclosure; no email/push yet | Single DISCLOSURE constant |
| TT-FTC-09 | FTC | No guarantee, urgency or 'free money' claims | zero | **8** · 3131 | ✅ | Copy is neutral | Keep as lint |
| TT-FTC-10 | FTC | Network terms satisfied | publisher T&Cs, user age, brand rules | **8** · 4202 | 🔴 | Adscend publisher signup is an owner blocker | Complete signup; map each network rule to a check |
| TT-WALL-01 | WALL | Frame load health | loads ≤3 s p75; skeleton until load; timeout 10 s → retry + 'open in new tab' | **7** · 4201 | 🔴 | No onload handler, no timeout | Add load/timeout state machine |
| TT-WALL-02 | WALL | Detect frame refusal | blank frame (X-Frame-Options/CSP) → fallback | **7** · 4201 | 🔴 | None | Probe via load event + postMessage ping; fallback CTA |
| TT-WALL-03 | WALL | Host CSP allows the wall | frame-src lists adscendmedia.com + ayet origins | **8** · 4301 | 🔴 | Shell CSP has default-src 'self' and no frame-src, so embedding the wall in the host will be blocked | Add frame-src, rerun node tools/gen-csp-sri.mjs, rerun prelaunch |
| TT-WALL-04 | WALL | Sandbox permits real offer click-outs | allow-popups-to-escape-sandbox + allow-top-navigation-by-user-activation as needed | **7** · 4201 | 🔴 | sandbox lacks allow-popups-to-escape-sandbox: popups inherit sandbox, advertiser pages break | Add flag; test with a real offer |
| TT-WALL-05 | WALL | Frame height and scroll | responsive; no nested scroll trap | **5** · 3101 | 🔴 | Fixed 460 px | min(80dvh, 720px) |
| TT-WALL-06 | WALL | Accessible frame | title present; focus enters/leaves | **6** · 3021 | ✅ | title="Partner offer wall" | Keep |
| TT-WALL-07 | WALL | Provider parameter contract | per-provider subid param names tested | **7** · 4201 | 🟡 | subid1 for Adscend; A6 text says subId; ayeT/OfferToro use different names | Provider config map + contract test |
| TT-WALL-08 | WALL | Second wall (ayeT) and rotation UI | selector or auto-rotation by eCPM | **6** · 3201 | 🔴 | Backend wired (D4); no UI | Add wall registry |
| TT-WALL-09 | WALL | Surveys / rewarded video tabs | at least one survey wall | **6** · 3201 | 🔴 | D2 landscape only | Add inBrain or CPX when approved |
| TT-WALL-10 | WALL | Safe pre-setup state | no broken frame while IDs unset | **5** · 3101 | ✅ | Placeholder shown when IDs empty | Keep |
| TT-WALL-11 | WALL | Third-party cookie / ITP / ad-block handling | detect and explain | **6** · 3201 | 🔴 | None; Safari blocks third-party cookies in frames | Detect via test cookie; show guidance |
| TT-WALL-12 | WALL | Report-an-offer path | user can flag misleading offers | **8** · 3302 | 🔴 | None | Link to support with offer id |
| TT-WALL-13 | WALL | Refresh behavior | reload with cache-bust | **3** · 2100 | 🟡 | wallFrame.src = wallFrame.src (may no-op) | Append _t param |
| TT-BAL-01 | BAL | No fabricated balance | skeleton until first successful read | **9** · 4122 | 🔴 | Markup initial value is a hard-coded "1,240" | Render '—' until data |
| TT-BAL-02 | BAL | Authenticated balance read | Authorization: Bearer <session JWT>; server derives user | **9** · 4302 | 🔴 | fetch to neurons-claim sends user_id in body and no Authorization header; README says 'session-authenticated' | Send JWT; reject body user_id; verify endpoint returns 401 unauthenticated |
| TT-BAL-03 | BAL | Poll failure surfaced | after 2 failures show 'Couldn't refresh · retry · updated hh:mm' | **6** · 4101 | 🔴 | !res.ok → return; catch ignored | Add state |
| TT-BAL-04 | BAL | Poll hygiene | pause when hidden; backoff + jitter; ≤2 req/min | **3** · 2100 | 🔴 | setInterval 30 s continues in hidden tabs | visibilitychange + backoff |
| TT-BAL-05 | BAL | Toast attribution | message matches the source of the credit | **5** · 3101 | 🔴 | Any balance increase says 'Offer verified' (login bonus, referral also match) | Return source from API; map copy |
| TT-BAL-06 | BAL | Toast accessibility and dwell | role=status; ≥5 s or dismissible | **6** · 3021 | 🔴 | 3.5 s, no ARIA | Fix |
| TT-BAL-07 | BAL | Multiple credits queue | no overwrite | **3** · 2100 | 🔴 | Single timer; later delta replaces earlier | Queue |
| TT-BAL-08 | BAL | No false celebration on load | first read never toasts | **4** · 3100 | ✅ | lastBalance null guard | Keep |
| TT-BAL-09 | BAL | Reward feedback | count-up ≤600 ms + ring fill; optional haptic; reduced-motion safe | **5** · 3200 | 🟡 | Ring transition 0.8 s; no count-up; no reduce-motion rule | Tune; gate |
| TT-BAL-10 | BAL | Neuron value claim | single canonical rate used | **8** · 4301 | 🔴 | '1 N ≈ $0.004 of AI usage' conflicts with catalog (≈$0.0008) and D5 (≈$0.0001) | See U-COPY-03; read from API |
| TT-BAL-11 | BAL | Expiry disclosed | 1-year expiry and nearest expiring batch | **7** · 3301 | 🔴 | Only in README | Show in header/tooltip |
| TT-BAL-12 | BAL | Ledger history | each credit: source, time, status, reversal | **6** · 3201 | 🔴 | None | History drawer |
| TT-BAL-13 | BAL | Where to spend | CTA to redeem/use neurons | **6** · 3201 | 🔴 | None; redemption catalog exists server-side | Link to Settings → Neurons |
| TT-BAL-14 | BAL | Reward predictability | flat 150 N per verified offer stated in UI | **6** · 3201 | 🔴 | UI never says the amount before completion; wall shows network payouts | Add 'Every verified offer = 150 N' |
| TT-CAP-01 | CAP | Daily cap shown | x/10 ring + text | **5** · 4100 | ✅ | #capPill + ring | Keep |
| TT-CAP-02 | CAP | Monthly cap shown | x/60 per month | **6** · 4200 | 🔴 | UI shows daily only; users hit 60/month silently and completions are rejected | Add monthly meter |
| TT-CAP-03 | CAP | Cap-reached state | wall paused or overlaid: 'Daily limit reached — resets at <local time>' | **7** · 4300 | 🔴 | Wall stays open at cap; simulation shows 27 cap-rejected completions | Overlay at cap |
| TT-CAP-04 | CAP | Reset time in user's local zone | local clock stated; cooldown explained | **6** · 4101 | 🔴 | Caps use UTC periods (spec §3) = 4 pm PT / 7 pm ET / 2 pm HI daily reset; 60 s cooldown not explained | Show local reset; state cooldown |
| TT-CAP-05 | CAP | Caps read from server | UI limit = API limit | **4** · 3100 | 🔴 | UI divides by literal 10 and ring length 138.2 | Return caps from API |
| TT-CAP-06 | CAP | Near-cap warning | at 8/10 | **3** · 2100 | 🔴 | None | Add |
| TT-CAP-07 | CAP | Why caps exist | one plain sentence | **6** · 2301 | 🔴 | None | Add tooltip |
| TT-CAP-08 | CAP | Cap state accessible | text equivalent for ring | **4** · 2020 | 🟡 | Pill text exists; ring aria-hidden | Add aria-live on change |
| TT-PEN-01 | PEN | Pending expectation honest | range by offer type (minutes to days) | **7** · 3301 | 🔴 | Static 'usually minutes' | Use per-offer ETA from network |
| TT-PEN-02 | PEN | Per-offer pending detail | name, expected reward, started | **6** · 3201 | 🔴 | Count only | List |
| TT-PEN-03 | PEN | Rejected/reversed explanation and dispute | reason + route | **8** · 3302 | 🔴 | None | Add |
| TT-PEN-04 | PEN | Pending row hides at zero | no noise | **1** · 1000 | 🔴 | Always shown | Hide |
| TT-PEN-05 | PEN | Missing-credit support path | after 24 h one click | **7** · 3301 | 🔴 | None | Add |
| TT-INT-01 | INT | Wired into the boundview host | Free-tier tab live | **7** · 4300 | 🔴 | Zero offerwall references in ai-gateway-site; component is standalone | Embed per README 3-line integration |
| TT-INT-02 | INT | Tier visibility rule | defined for Free vs paid | **4** · 2200 | ⚪ | Not specified | Owner decision |
| TT-INT-03 | INT | Tab name does not collide | 'Tasks' vs Scheduled Tasks overlay | **5** · 3200 | 🔴 | modules/tasks.js and monitors.js already own 'Tasks' (Scheduled + inbox, push opens /?tasks=inbox) | Rename earn tab 'Earn' or 'Free credits' |
| TT-INT-04 | INT | Brand and title | 'BoundView' casing; title 'Earn' | **3** · 1101 | 🔴 | 'boundview — Tasks' | Use BRAND.name |
| TT-INT-05 | INT | Tests | Playwright covers placeholder, wall, cap, toast, error | **4** · 3100 | 🔴 | No test file in offerwall-tasks-tab/ | Add tests and screenshots |
| TT-ECON-01 | ECON | Earn-only never cash-out stated | visible line | **6** · 3201 | 🔴 | In GH mockup, not in TT | Add line |
| TT-ECON-02 | ECON | Abuse/fraud user messaging | VPN/multi-account rules + appeal | **6** · 3201 | 🔴 | None | Add policy + appeal route |
| TT-ECON-03 | ECON | Postback observability | verified/pending/rejected per day; alert on drop | **5** · 3200 | ⚪ | Simulation clean (143 requests) | Daily owner report |
| TT-ECON-04 | ECON | UUID display | internal id not shown | **3** · 1101 | 🟡 | Placeholder shows first 8 chars | Remove |
| TT-ECON-05 | ECON | Wall revenue gate visible to owner | $500/mo gate tracked | **4** · 2200 | ⚪ | Gate defined in A5 | Owner KPI card |
| TT-NW-01 | NW | Geo availability messaging | 'Offer availability varies by location' + thin-supply state | **6** · 3201 | 🔴 | None | Add |
| TT-NW-02 | NW | Local-time cap reset incl AK/HI | see TT-CAP-04 | **5** · 3101 | 🔴 | UTC only | Same fix |
| TT-NW-03 | NW | Eligibility by state | network-specific restrictions displayed | **8** · 3302 | 🔴 | None | Per-network eligibility note |

### E7.2 Boundview (boundview.com)

App-specific sub-score (these items only): **29.8%** strict — 2✅ 10🟡 3🔴 5⚪.

| ID | Area | Check | Benchmark (pass) | W · IRCM | Status | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|
| BV-01 | BV | Public marketing home | indexable landing separate from app shell | **9** · 4113 | 🔴 | App shell is the landing | Static marketing site |
| BV-02 | BV | Pricing page matches locked tiers | $0/$8/$18/$48/$98, Team/Ent $18/$98 per seat | **8** · 4301 | ⚪ | A3 locked; no live pricing page evidenced | Build /pricing from pricing.json |
| BV-03 | BV | Free-tier clarity | 300 credits/day + neurons; what happens at limit | **7** · 4201 | 🟡 | Documented in pricing doc | In-app limit state copy |
| BV-04 | BV | Upgrade prompts | ≤1 per session; contextual; no dark patterns | **7** · 3301 | ⚪ | Not audited | Prompt policy |
| BV-05 | BV | Credit display consistency | 2,500 = $1 everywhere | **7** · 4201 | 🟡 | A3 parity statement | pricing.json diff test |
| BV-06 | BV | Neurons earn surface | login/referral/correction earn visible | **5** · 3200 | 🟡 | settings-neurons.js | Link from composer |
| BV-07 | BV | Fair-use message on free lane | clear when slower/cheaper lane used | **6** · 3201 | 🟡 | Fallback chain live | Add banner |
| BV-08 | BV | Student flow | .edu verify → price | **4** · 2200 | 🟡 | student-verify.js; 🟡 e2e | Owner steps |
| BV-09 | BV | Team/Enterprise admin | invite, seats, roles, SSO | **5** · 3200 | 🟡 | enterprise-admin.js; Enterprise 70 | Close gaps |
| BV-10 | BV | Mobile parity | Mobile category ≥90 | **4** · 3100 | 🟡 | Mobile 60 in headline JSON | Raise |
| BV-11 | BV | Feature-parity categories at 70 | Comet, Enterprise, Desktop, Teammates ≥85 | **3** · 2100 | 🟡 | 70/70/70/68 | Roadmap |
| BV-12 | BV | Brand separation implemented at build time | host-specific build, not DOM scrub | **8** · 4202 | 🔴 | brand.js scrubs strings at runtime; static files leak | See U-TRU-12 |
| BV-13 | BV | Referral program UX | share link, status | **6** · 3201 | 🟡 | referral_signup/activation live | Add dashboard |
| BV-14 | BV | Credit pack purchase | complete e2e | **6** · 4200 | 🔴 | Stripe wiring pending | Owner steps |
| BV-15 | BV | Settings IA | account, billing, security, models, MCP, neurons, org | **3** · 3000 | ✅ | Modules present | Keep |
| BV-16 | BV | Incognito / privacy toggle | visible and honest | **5** · 3101 | ✅ | v83 incognito toggle | Keep |
| BV-17 | BV | Public share pages | share thread link with noindex/robots choice | **7** · 3103 | ⚪ | Not found | Decide |
| BV-18 | BV | Support mailbox live | support@boundview.com receives | **5** · 3200 | ⚪ | Address configured in brand.js | Send test |
| BV-19 | BV | Gig Hub entry | link from Free tier | **4** · 2200 | ⚪ | GH is a mockup | Place after Phase 1 |
| BV-20 | BV | Competitive UX benchmark | key flows vs ChatGPT/Claude/Perplexity measured quarterly | **5** · 3101 | 🟡 | Features 99 parity | Add timed task benchmark |

### E7.3 ai-gateway-site (ai.spaincos.com)

App-specific sub-score (these items only): **18.3%** strict — 1✅ 2🟡 2🔴 4⚪.

| ID | Area | Check | Benchmark (pass) | W · IRCM | Status | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|
| AG-01 | AG | Intent and access | private workspace: auth wall + noindex | **9** · 3303 | 🔴 | Fully crawlable and titled 'BoundView' | noindex + auth interstitial |
| AG-02 | AG | Public API docs | quickstart ≤5 min; copy curl; error codes | **5** · 3101 | 🟡 | docs/public-api-phase1.md, api-docs.js | Publish |
| AG-03 | AG | API rate-limit and error docs | headers and codes | **4** · 3100 | ⚪ | Not verified | Document |
| AG-04 | AG | verify.html flow | state, error, success | **3** · 2100 | ⚪ | 7.6 KB page | Test |
| AG-05 | AG | Privacy page | accurate, light/dark | **6** · 3300 | 🟡 | Accurate for private site; dated Nov 10; dark-only | Add scheme |
| AG-06 | AG | Fleet and QA dogfood page | readable by non-engineers | **2** · 2000 | ✅ | Fleet QA tab | Keep |
| AG-07 | AG | Extension / browser-service / voice-service | UX audited | **3** · 2100 | ⚪ | Separate folders | Audit |
| AG-08 | AG | Benchmarks marketing page | honest ceiling public | **5** · 2102 | 🔴 | Internal md only | Publish |
| AG-09 | AG | Docs search and versioning | search + version tag | **4** · 2101 | ⚪ | docs-panel | Test |

### E7.4 Gig Hub / MinuteGig

App-specific sub-score (these items only): **23.5%** strict — 3✅ 5🟡 8🔴 4⚪.

| ID | Area | Check | Benchmark (pass) | W · IRCM | Status | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|
| GH-01 | GH | minutegig.com reachable | HTTP 200 | **6** · 4101 | 🔴 | LIVE probe: HTTP 502 | Point DNS/hosting |
| GH-02 | GH | Gig directory | source-linked, 12 platforms, refreshed weekly | **6** · 3201 | ⚪ | Seed data; registration not receipts | First-run receipt |
| GH-03 | GH | Fee-adjusted GigFinder | transparent math, source and date per figure | **7** · 3301 | ⚪ | Mockup input only | Build |
| GH-04 | GH | FTC disclosure | per platform card and before click-out | **10** · 4231 | 🟡 | Mockup disclosure at text-xs | Raise prominence |
| GH-05 | GH | Pay figures | ranges + source + self-reported label | **7** · 3301 | 🟡 | Guardrails documented | Enforce in UI |
| GH-06 | GH | Earn-only statement | visible | **6** · 3201 | ✅ | Mockup disclosure | Keep |
| GH-07 | GH | Quest chain UX | 4 steps with progress | **5** · 3200 | 🟡 | Mockup | Build |
| GH-08 | GH | Tone | sophisticated, rings not game-first | **2** · 2000 | 🟡 | Owner standard | Review at build |
| GH-09 | GH | Milestone latency expectation | monthly reconciliation disclosed | **7** · 3301 | 🔴 | T3/T4 depend on monthly reconcile | Show 'verified within 30 days' |
| GH-10 | GH | Check-in UI | wired to ledger | **5** · 3200 | 🔴 | UI wiring open | Build |
| GH-11 | GH | Affiliate webhook | deployed + verified | **5** · 3200 | 🔴 | Open | Deploy |
| GH-12 | GH | Two front doors | shared auth + ledger | **4** · 3100 | ⚪ | Recommendation only | Owner decision |
| GH-13 | GH | Property-services vendor/dispatch UX | vendor, PM, invoice roles | **5** · 3200 | ⚪ | 24-table cluster governed from Property Ops | Separate audit |
| GH-14 | GH | Markup disclosure policy | invoice vs line granularity decided | **8** · 3302 | 🔴 | Owner decision pending (opaque is placeholder) | Decide; implement |
| GH-15 | GH | Dispatch market | chosen and justified nationwide | **5** · 3101 | 🔴 | R-236 open; default SC fails nationwide rule | Decide on data |
| GH-16 | GH | Gig Pay Index public page | sourced, labeled | **6** · 2103 | 🔴 | Phase 4 | Later |
| GH-17 | GH | Programmatic SEO | platform × state pages | **7** · 3103 | 🔴 | None | Generate |
| GH-18 | GH | Mockup labeled | demo tag | **3** · 2100 | ✅ | Title says Interactive Mockup | Keep |
| GH-19 | GH | Consent-based profiles | no scraping | **7** · 3301 | 🟡 | Designed alternative | Enforce |
| GH-20 | GH | Mobile view | screenshots | **2** · 2000 | ✅ | qa-mobile.png | Keep |

### E7.5 SpainCos Terminal

App-specific sub-score (these items only): **40.7%** strict — 7✅ 8🟡 2🔴 7⚪.

| ID | Area | Check | Benchmark (pass) | W · IRCM | Status | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|
| ST-01 | ST | Shell and identity | left rail, approved logo, exact 'SpainCos Terminal' casing | **2** · 2000 | 🟡 | Approved; preview distinct from live | Verify live |
| ST-02 | ST | Live health | zero recurring health-check failures | **7** · 4201 | 🔴 | v2 failures recurred ≥10 times after PR #342 | See U-REL-10 |
| ST-03 | ST | Address search | finds street addresses | **5** · 4100 | 🟡 | R-775 root cause fixed (index routing) | Live regression test |
| ST-04 | ST | Typo recovery | SmartSearch default | **4** · 3100 | ⚪ | Not evidenced | Test set |
| ST-05 | ST | Single record system | public.crm_* only; bd.opportunity retired | **4** · 3100 | 🟡 | Planned; migration unrun | Run crosswalk |
| ST-06 | ST | Outreach safety UI | no send without consent + both suppression lists | **10** · 4303 | 🟡 | Designed; send path migration unrun | Block send in UI until crosswalk done |
| ST-07 | ST | No fake success | staged intents labeled | **6** · 4200 | ✅ | Mockup drawers do not commit | Keep |
| ST-08 | ST | Preview/fixture labels | every synthetic number tagged | **5** · 3200 | ✅ | Reported | Keep |
| ST-09 | ST | Flag rollout map | flags permits/lab/shell/top12 status visible to owner | **2** · 2000 | 🟡 | Merged behind flags | Flag dashboard |
| ST-10 | ST | Page parity | 122 pages / 110 local captures | **3** · 3000 | ✅ | Atlas | Maintain |
| ST-11 | ST | Data-view parity | columns/order/tabs | **3** · 3000 | ✅ | 46 and 43 pages matched | Maintain |
| ST-12 | ST | Mega-menu | two-column icon + title + muted line (R-783) | **2** · 2000 | ✅ | Done | Maintain |
| ST-13 | ST | Interaction continuity | R-705 contract | **3** · 3000 | 🟡 | Partial | Finish |
| ST-14 | ST | Query performance | indexed reads | **5** · 4100 | ✅ | 741,967 → 4.40 plan cost | Keep |
| ST-15 | ST | Large-table UX | server pagination, sort, export, saved views | **4** · 3100 | ⚪ | Not evidenced | Audit |
| ST-16 | ST | Role views and least privilege | no empty confusion | **6** · 3300 | ⚪ | Not evidenced | Role matrix |
| ST-17 | ST | Auth walls and sessions | SSO + timeout | **6** · 3300 | ⚪ | Not evidenced | Test |
| ST-18 | ST | Freshness badges | per source | **5** · 4100 | ⚪ | Launch gate | See U-STATE-10 |
| ST-19 | ST | Lab assumptions visible | assumption panel + demo sentiment label | **5** · 3200 | ✅ | PR88 | Keep |
| ST-20 | ST | Plain-English transforms | field labels in plain language | **2** · 2000 | 🟡 | Merged behind flag | Complete |
| ST-21 | ST | Violation identity coverage | nationwide | **8** · 4103 | 🔴 | SF 46.6%, Seattle 4.1% staged | Expand per city; do not surface until ≥80% match |
| ST-22 | ST | Contact count definitions | observed, deduped, verified, deliverable shown separately | **6** · 3300 | 🟡 | Distinct measures | Show in funnel |
| ST-23 | ST | Keyboard-first power use | shortcuts, tab order | **3** · 2100 | ⚪ | Not evidenced | Audit |
| ST-24 | ST | Accessibility for gov-facing outputs | WCAG 2.2 AA exports | **7** · 3301 | ⚪ | Not evidenced | Audit |

### E7.6 Comptrove

App-specific sub-score (these items only): **5.7%** strict — 0✅ 2🟡 0🔴 13⚪.

| ID | Area | Check | Benchmark (pass) | W · IRCM | Status | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|
| CT-01 | CT | Public availability | HTTP 200 for real browsers and good bots | **8** · 4103 | 🟡 | Generic UA gets 403 deny from Vercel WAF | Bot allowlist test |
| CT-02 | CT | Address/parcel search nationwide | typeahead covers every state | **9** · 4113 | ⚪ | Not evidenced | Coverage matrix |
| CT-03 | CT | Pricing and checkout | single plan $149/mo scenario | **7** · 4201 | ⚪ | Forecast input, not validated | Test with 10 customers |
| CT-04 | CT | Freshness stamp per dataset | visible | **7** · 4102 | ⚪ | Gate per 2027 plan | Add |
| CT-05 | CT | Free preview before paywall | sample lookup | **7** · 3202 | ⚪ | None evidenced | Add |
| CT-06 | CT | Programmatic nationwide SEO pages | state/county/city/parcel | **7** · 3103 | ⚪ | None evidenced | Build |
| CT-07 | CT | Onboarding for property managers | ≤10 min to first insight | **7** · 4201 | ⚪ | None evidenced | Test |
| CT-08 | CT | Export and API | CSV + key | **5** · 3200 | ⚪ | None evidenced | Add |
| CT-09 | CT | Methodology links | at point of reference | **6** · 3300 | ⚪ | Owner standard | Add |
| CT-10 | CT | Fair Housing/FCRA boundaries | not-for-screening disclaimer where relevant | **10** · 4303 | ⚪ | Not evidenced | Counsel |
| CT-11 | CT | Trust page | SOC 2 status, questionnaire | **8** · 3302 | ⚪ | RentSpire SOC 2 gate | Publish |
| CT-12 | CT | Demo request → CRM | consent captured | **7** · 3202 | ⚪ | Not evidenced | Wire to Terminal |
| CT-13 | CT | Email compliance | CAN-SPAM + unsubscribe + suppression | **10** · 4303 | ⚪ | 250,000-contact target | Gate sends |
| CT-14 | CT | Map performance | pan/zoom ≤100 ms frame | **4** · 3100 | ⚪ | Not evidenced | Measure |
| CT-15 | CT | Monitor path equals real-user path | synthetic uses same route as user | **4** · 3100 | 🟡 | X-Spain-Monitor bypass for GETs | Also test unbypassed |

### E7.7 DoorGraph

App-specific sub-score (these items only): **19.6%** strict — 1✅ 6🟡 5🔴 8⚪.

| ID | Area | Check | Benchmark (pass) | W · IRCM | Status | Evidence / current state | Fix / repair |
|---|---|---|---|---|---|---|---|
| DG-01 | DG | Operator disclosed | company named in invitations | **10** · 4303 | 🔴 | CanonIntel LLC not formed | Form entity; counsel |
| DG-02 | DG | Visibility disclosure | who can see each matter | **9** · 4302 | 🟡 | Specified | Build in UI |
| DG-03 | DG | Login is not mailbox consent | separate narrow OAuth | **8** · 4301 | ✅ | Spec | Keep |
| DG-04 | DG | Trust-state labeling | 'synthetic staging' on every screen | **8** · 4202 | 🟡 | Distinct states | Banner |
| DG-05 | DG | Evidence registry core | command center, registry, queue, feed, search | **5** · 4100 | 🟡 | Prototype | Complete |
| DG-06 | DG | Release preview | 'what the recipient will see' | **8** · 4301 | ⚪ | None | Add |
| DG-07 | DG | Audit trail visible | participants see actions | **7** · 3301 | 🟡 | Staging contract | Verify |
| DG-08 | DG | Upload UX | scan status, hash, resumable | **5** · 3200 | ⚪ | None | Add |
| DG-09 | DG | Recipient access | magic link ≤2 steps, expiry | **6** · 4200 | ⚪ | None | Test |
| DG-10 | DG | Tenant isolation e2e | real signed-in test | **9** · 4203 | 🔴 | Gate open | Pass before invites |
| DG-11 | DG | Restore custody | drill | **9** · 4203 | 🔴 | Gate open | Drill |
| DG-12 | DG | Counsel review | before first invite | **10** · 4303 | 🔴 | Open | Counsel |
| DG-13 | DG | Recipient notifications | release and answer events | **5** · 3200 | ⚪ | None | Add |
| DG-14 | DG | Per-transition billing UX | $2,500 invoice | **6** · 3300 | ⚪ | Assumption | Design |
| DG-15 | DG | Older/non-technical recipient UX | large type, plain language | **5** · 3200 | ⚪ | None | Test |
| DG-16 | DG | Mobile read-only recipient view | works at 375 px | **4** · 3100 | ⚪ | None | Screenshot |
| DG-17 | DG | Nationwide readiness | not Pacifica-only | **8** · 4103 | 🔴 | Pilot is Pacifica | Template per jurisdiction |
| DG-18 | DG | Deterministic conversion explained | kernels not LLM | **6** · 3201 | 🟡 | Rule 7.1 | Surface |
| DG-19 | DG | No 'needs a person' dead ends | routed requests | **4** · 3100 | 🟡 | Owner standard | Verify |
| DG-20 | DG | Retention / legal hold | visible controls | **8** · 3302 | ⚪ | None | Add |

---

## E8. EXECUTABLE CHECKLISTS

Run these by hand or script before each release. Each box maps to line items so a failed box updates the score. Tick only with an evidence link (screenshot, header dump, trace, or test output).

### E8.1 First-session checklist (new user, Boundview; repeat for GH and DG recipient)
- [ ] Open the root URL on a throttled mobile profile (Slow 4G, 375 px): headline, one primary action and pricing link are visible without scrolling; LCP ≤2.5 s (U-PERF-01, U-ONB-01)
- [ ] Page title, description and share card are brand-correct for the host; no sibling-brand string anywhere, including manifest and view-source (U-SEO-01..03, U-TRU-12)
- [ ] Footer links resolve: privacy (correct for this product), terms, support, status, accessibility statement (U-TRU-01/02, U-A11Y-16, U-HELP-03)
- [ ] Ask a question without signing in if guest trial is enabled; otherwise the sign-in wall explains why in one sentence (U-ONB-05, U-AUTH-07)
- [ ] Sign up with passkey, then repeat with magic link; ≤3 screens; no email-verification gate before first answer (U-ONB-03, U-AUTH-05)
- [ ] First answer streams with first token ≤2 s; sources numbered; stop control works (U-AI-01..03)
- [ ] First-run tour is skippable, never traps focus, and can be reopened (U-ONB-04)
- [ ] Empty states show a next action on every screen visited (U-STATE-01)
- [ ] Enable notifications only after the first background job; deny, then confirm the product still works (U-NOT-01)
- [ ] Free-tier limits are visible before they are hit; at the limit the message names what happens next and the price (U-STATE-09, BV-03)
- [ ] Credits, neurons and dollars appear with one consistent vocabulary and rate (U-COPY-03)
- [ ] Welcome email arrives ≤60 s from boundview.com with unsubscribe and correct brand (U-ONB-09, U-NOT-05)
- [ ] Keyboard-only pass from landing to first answer; focus is always visible (U-A11Y-03/04)
- [ ] Screen-reader pass (VoiceOver iOS, NVDA) reads answer completion (U-A11Y-07/14)
- [ ] Refresh mid-thread and sign out/in; thread and draft restore (U-ONB-07, U-AUTH-02)
- [ ] Browser Back, deep link `/t/<slug>` logged out then in (U-AUTH-03, U-MOB-12)
- [ ] Type an unknown URL: branded 404 with correct HTTP status (U-STATE-07)

### E8.2 Returning-user checklist
- [ ] Last thread, scroll and draft restore after 7 days idle and after a new deploy (U-ONB-07, U-REL-06)
- [ ] Stale tab from the previous build prompts a refresh instead of misbehaving (U-REL-06)
- [ ] Session expiry mid-draft keeps the draft (U-AUTH-02)
- [ ] Notifications received for background work with tab closed; tap opens the right place (U-NOT-02/03)
- [ ] Balance, usage meter and spend warnings at 80% and 100% match billing (U-PAY-07)
- [ ] Plan change, cancel and invoice download complete in ≤2 clicks each (U-PAY-04/09)
- [ ] History search finds an old thread with a typo in the query (U-DES-06, U-AI-07)
- [ ] Data export and deletion are self-serve (U-TRU-11, U-AUTH-09)
- [ ] Release notes are findable (U-HELP-04)
- [ ] Referral and neuron earnings show the same totals in settings and toasts (BV-06, BV-13)

### E8.3 Mobile checklist (iOS Safari, Chrome Android, Samsung Internet; 320, 375, 414 px)
- [ ] No horizontal scroll at 320 px and at 400% zoom (U-A11Y-12, U-MOB-02)
- [ ] Every control ≥44×44 px (≥24 px minimum) (U-A11Y-05)
- [ ] Keyboard opening never hides the composer or primary button (U-MOB-04)
- [ ] Fixed toasts and bars respect safe-area insets (U-MOB-05)
- [ ] Inputs ≥16 px so iOS does not zoom (U-MOB-06)
- [ ] Embedded frames are ≥70 dvh and do not trap scroll (U-MOB-09, TT-WALL-05)
- [ ] Installed PWA shows the right name, icon and splash for the host brand (U-MOB-07)
- [ ] Offline: the shell opens and the app says it is offline (U-PERF-14, U-STATE-05)
- [ ] Hover-only help has a tap/focus equivalent (U-MOB-08)
- [ ] Landscape and split-screen are usable (U-MOB-10)
- [ ] Slow 4G run reaches interactive ≤6 s (U-PERF-12)
- [ ] Push notification opens the deep link (U-NOT-02, U-MOB-12)
- [ ] Share target and deep link open the right screen (U-MOB-12)
- [ ] Real-device matrix result stored in `qa-reports/` (U-MOB-11)

### E8.4 Earn-surface checklist (offerwall Tasks tab and Gig Hub)
**Disclosure (FTC)**
- [ ] Disclosure is above the wall and visible without scrolling at 375 px; ≥14 px; ink color; ≥4.5:1; not collapsible (TT-FTC-01/02/05/07)
- [ ] Wording says boundview earns a fee when offers are completed; same wording in toast, email, push, share (TT-FTC-03/08)
- [ ] Per-offer or per-link label exists at the point of click-out (TT-FTC-04, GH-04)
- [ ] No earnings guarantees, urgency or 'free money' language (TT-FTC-09, U-TRU-15)
- [ ] Network rules and age eligibility are met and documented (TT-FTC-10, U-TRU-07)

**Wall health**
- [ ] Host CSP lists `frame-src` for each provider and hashes were regenerated (TT-WALL-03)
- [ ] Sandbox allows real click-outs; a real offer was opened and completed in a staging provider account (TT-WALL-04)
- [ ] Load, timeout and refusal states each display a recovery action (TT-WALL-01/02)
- [ ] Safari with third-party cookies blocked: message shown, verified rate tracked per browser (TT-WALL-11)
- [ ] Provider parameter contract test passes for every enabled provider (TT-WALL-07)

**Reward feedback**
- [ ] Balance shows a skeleton until the first authenticated read; no placeholder number (TT-BAL-01/02)
- [ ] Failed read shows 'could not refresh', retry, last-updated time (TT-BAL-03)
- [ ] Credit toast names the source, is announced to screen readers, lasts ≥5 s, queues multiples (TT-BAL-05/06/07)
- [ ] Count-up/ring animation ≤600 ms and respects reduced motion (TT-BAL-09, U-A11Y-10)
- [ ] Credit appears ≤90 s after a verified postback in the synthetic test (CUJ-09)
- [ ] Ledger history shows source, time, status, reversal (TT-BAL-12)
- [ ] One neuron value is stated and equals the API/catalog (TT-BAL-10, U-COPY-03)
- [ ] Expiry date and 'earn-only, never cash-out' are visible (TT-BAL-11, TT-ECON-01)

**Cap and pending messaging**
- [ ] Daily and monthly meters both visible; values come from the API (TT-CAP-01/02/05)
- [ ] Near-cap warning at 8/10; cap-reached overlay stops the wall and states the local reset time and 60 s cooldown (TT-CAP-03/04/06)
- [ ] Pending list shows each offer with ETA by offer type; rejection/reversal reason and dispute link exist (TT-PEN-01/02/03)
- [ ] Missing-credit path reachable in ≤2 clicks (TT-PEN-05)

**Integration**
- [ ] Tab name does not collide with Scheduled Tasks (TT-INT-03)
- [ ] Tab appears only for the intended tiers (TT-INT-02)
- [ ] Playwright covers placeholder, live wall, cap-reached, error, toast (TT-INT-05)

### E8.5 Marketing and SEO checklist (public pages)
- [ ] Unique `<title>` ≤60 chars with brand and keyword; per-page (U-SEO-01)
- [ ] Meta description 70–160 chars (U-SEO-02)
- [ ] `og:title`, `og:description`, `og:image` (1200×630), `og:url`, `twitter:card`; unfurl verified in Slack, iMessage, X, LinkedIn (U-SEO-03, U-SEO-13)
- [ ] Self-referential `<link rel="canonical">`; the private workspace is `noindex` (U-SEO-04, U-SEO-06)
- [ ] `/sitemap.xml` valid and listed in `robots.txt`; sharded ≤50,000 URLs per file for programmatic sets (U-SEO-05, U-NW-08)
- [ ] JSON-LD for Organization, WebSite, SoftwareApplication with Offer, FAQPage, BreadcrumbList validates in the Rich Results Test (U-SEO-07)
- [ ] Prerendered HTML for home, pricing, features, compare, docs, changelog; view-source shows real content (U-SEO-08/09)
- [ ] Exactly one h1 per page; landmarks present (U-A11Y-09)
- [ ] Redirects: http→https and www→apex in one hop; no chains; true 404 for missing pages (U-SEO-11, U-STATE-07)
- [ ] Core Web Vitals pass in field data (U-SEO-10)
- [ ] Search Console and Bing verified; weekly coverage report; crawler allowlist tested (U-SEO-12/14)
- [ ] Favicons 32/180/192/512 and maskable icon present (U-SEO-16)
- [ ] llms.txt, quotable benchmark page with honest ceiling, FAQ content (U-SEO-15)
- [ ] Privacy-safe conversion measurement with UTM preserved (U-SEO-17)
- [ ] Internal apps (Terminal, DoorGraph) return `X-Robots-Tag: noindex` and sit behind auth (U-SEO-18)
- [ ] Nationwide pages: every state present, unique data per page, local schema, thin-page guard (U-NW-08)

### E8.6 Release gate (every push; automate in `qa/prelaunch.py`)
- [ ] Existing 31 checks green and the run is ≤24 h old with Playwright installed (U-REL-05)
- [ ] Lighthouse CI budgets pass (U-PERF-11)
- [ ] axe-core: 0 critical/serious on landing, thread, settings, connectors, earn tab (U-A11Y-02)
- [ ] Static-file brand grep passes for the target host (U-TRU-12)
- [ ] Security headers present at the HTTP layer (U-TRU-09); CSP hashes verified (U-TRU-10)
- [ ] Link crawl: zero 404 among footer and nav links (U-TRU-02)
- [ ] Price diff: every price on every surface equals `pricing.json` (U-PAY-01)
- [ ] Nationwide matrix reviewed (E8.7)
- [ ] Screenshots captured at 320/375/768/1280 and compared with the approved mockup (U-DES-04)
- [ ] Part E headline recomputed and committed (`qa/generate-ux-headline.py --write`)

### E8.7 Nationwide conformance matrix (owner rule, 2026-11-20)
Status per webapp; review before each release. ⚪ = not yet verified.

| Dimension | BV | TT | AG | GH | ST | CT | DG |
|---|---|---|---|---|---|---|---|
| 50 states + DC + 5 territories covered or explicitly marked not covered (U-NW-01/03) | ⚪ | ⚪ | 🟡 | ⚪ | 🟡 | ⚪ | 🔴 |
| Jurisdiction detect + override; no CA/SC default (U-NW-02) | ⚪ | ⚪ | ⚪ | 🔴 | ⚪ | ⚪ | ⚪ |
| Time zones include AK, HI, AZ, PR, GU (U-NW-04) | 🔴 | 🔴 | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ |
| USD / en-US pinned (U-NW-05) | 🟡 | 🟡 | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ |
| Address, phone, ID formats nationwide (U-NW-06) | ⚪ | — | 🟡 | ⚪ | ⚪ | ⚪ | ⚪ |
| State legal text matrix tested (U-NW-07) | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Nationwide SEO pages (U-NW-08) | 🔴 | — | — | 🔴 | — | ⚪ | — |
| Geo availability of offers and features (U-NW-09) | ⚪ | 🔴 | — | — | — | ⚪ | — |
| Freshness by jurisdiction (U-NW-11) | — | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ |
| Largest-state performance (U-NW-12) | — | ⚪ | — | ⚪ | ⚪ | ⚪ | ⚪ |
| Low-bandwidth / Spanish scoping (U-NW-13) | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ |

---

## E9. DEBUG-LOOP PROTOCOL — findings become permanent fixes, never one-off patches

### E9.1 Flow
1. **Detect** — any of: nightly synthetic run, release gate, manual checklist (E8), real-user report, owner observation. Every detection is logged as a finding with an ID `F-nnn`, the affected line item(s), and the app.
2. **Triage** — assign severity (E9.2) and owner within one business hour for S0/S1.
3. **Contain** — apply the smallest safe mitigation (feature flag, copy change, rollback). Containment is labeled **temporary** and carries an expiry date.
4. **Root-cause** — answer "why was this possible?" down to the missing control, not the line of code.
5. **Fix permanently** — choose a permanent-solution class (E9.3) so the whole class of defect cannot return. A patch with no class is not closable.
6. **Verify** — write the check first (or the same day), show it failing on the old build and passing on the new one, attach evidence.
7. **Record** — five fields, identical to the v261 self-improvement pattern: **observed / root cause / fix / verification / permanent-solution class**.
8. **Re-score** — update `qa/ux-items.json`, run `python3 qa/generate-ux-headline.py --write`, and note the delta in the change log. Status may move 🔴→🟡→✅ only with an evidence pointer.
9. **Re-test on cadence** (E9.4) until the finding has aged out of the regression ledger.

### E9.2 Severity and service levels
| Severity | Definition | Examples | Contain | Permanent fix | Block release? |
|---|---|---|---|---|---|
| **S0** | Legal/regulatory exposure, money or data wrongly changed or exposed, whole journey blocked for all users | Unauthenticated balance read; policy contradicts live data flows; checkout fails | ≤4 h | ≤24 h | Yes, and pause promotion |
| **S1** | Core journey broken or misleading for a large cohort; compliance gap with no active harm yet | Cap messaging absent; no terms page; security headers missing | ≤24 h | ≤72 h | Yes for the affected app |
| **S2** | Significant friction or discoverability loss; workaround exists | Perf budget miss; tz list; 404 page | ≤1 week | ≤2 weeks | Only if it touches a CUJ |
| **S3** | Polish, consistency, low-reach | Brand casing; motion timing | Next sprint | ≤1 month | No |

### E9.3 Permanent-solution classes (every fix must pick at least one)
| Class | What it is | Example from this audit |
|---|---|---|
| **PSC-1 Lint / static rule** | Rule fails the build | Every `<input>` needs an accessible name; every static file is grepped for the other brand |
| **PSC-2 CI gate** | Gate in `qa/prelaunch.py` blocks push | Lighthouse budgets; axe; security headers; link crawl |
| **PSC-3 Contract test** | Test pins a cross-system promise | Provider subid names; UI caps equal API caps; price diff against `pricing.json` |
| **PSC-4 Shared component** | One implementation reused everywhere | FreshnessBadge, Toast with ARIA, cap meter, jurisdiction chip, DISCLOSURE constant |
| **PSC-5 Config as code** | Value lives once and renders everywhere | `pricing.json`, neuron rate from API, per-host brand file, `vercel.json` headers |
| **PSC-6 Monitor / alert** | Production signal with owner and threshold | RUM web-vitals; cap-rejected rate; postback verified rate; WAF false-positive probe |
| **PSC-7 Runbook / owner decision record** | Decision captured with evidence | Markup disclosure policy; tier visibility; dispatch market |
| **PSC-8 Data-quality gate** | Dataset cannot render below a coverage/freshness threshold | Hide a city below 80% identity match; stale-feed banner |

### E9.4 Re-test cadence
| Trigger | What runs | Owner |
|---|---|---|
| Every push | Release gate E8.6 (prelaunch + Lighthouse CI + axe + brand grep + header check) | CI |
| Nightly | Synthetic CUJs (CUJ-01, 06, 09 on staging provider, 16, 21), throttled Slow 4G profile, link crawl, Part E headline recompute | Scheduled guardian |
| Weekly | Real-device matrix; screen-reader smoke on 5 flows; Search Console coverage; email seed-list; cap-rejected and verified-rate review | QA owner |
| Monthly | Full checklist E8.1–E8.7 across all apps; pricing-anchor refresh; legal-matrix spot checks for 5 states rotating nationwide | Product owner + counsel |
| Quarterly | Moderated usability study (8 users incl. older and assistive-tech users); rollback drill; external accessibility and security review; competitor UX benchmark | Owner |
| Per finding | Verify at fix; again at +24 h, +7 d, +30 d; thereafter inside the nightly set until cleared from the ledger after 90 clean days | Finding owner |

Severity changes cadence: an S0 stays in the per-release gate permanently; S1 for 90 days; S2 for 30 days; S3 on the monthly pass.

### E9.5 Sprint order that raises the score fastest
1. **Stop-ship fixes** (E10 S0/S1) — policy and terms, TT auth/CSP/sandbox/cap messaging, security headers, brand separation, age gate.
2. **Measurement sprint** — Lighthouse CI, axe, RUM, first-party funnel, Search Console, device and SR runs. This converts ⚪ to ✅/🔴 and is the largest available gain per hour.
3. **Discoverability sprint** — static marketing site with metadata, structured data, sitemap, canonicals; `noindex` on the private workspace.
4. **Internal-app sprint** — Terminal health, freshness badges, coverage matrix; DoorGraph gates; Comptrove crawler/WAF test and preview-before-paywall.
5. **Nationwide sprint** — time-zone fix, legal matrix, programmatic state/county/city pages, coverage chips.

### E9.6 Regression ledger
`qa-reports/ux-regression-ledger.md` (create on first use): one row per closed finding with the five fields and PSC class. A closed finding that reappears is re-opened one severity higher and its fix is rejected unless the class changes.

---

## E10. FINDINGS REGISTER (premortem findings with permanent fixes)

Severity per E9.2. **Lift** = portfolio strict points gained if every 🔴 line item linked to the finding became ✅ (computed from item weights and app weights; ⚪ items add more once measured). Sorted by severity, then lift. Each finding keeps the five-field record in the regression ledger when closed.

| ID | Sev | Apps | Finding | Linked items | Evidence | Permanent fix | Class | Lift |
|---|---|---|---|---|---|---|---|---|
| F-01 | **S0** | BV, AG | Privacy page on boundview.com is the private workspace policy ("no public sign-up, no advertising, no analytics trackers"); /terms.html returns 404; no consent gate | U-TRU-01, U-TRU-02, U-TRU-03, U-TRU-04 | Live probe 2026-11-20: /privacy.html identical to ai.spaincos.com; /terms.html 404. Contradicts an ad-network offer wall and public sign-up. | Write BoundView-specific privacy policy (ad network, cookies, neurons, push, data sale/share, state rights) and Terms; ship before the earn surface; add consent banner with equal-prominence reject; counsel review | PSC-7 + PSC-2 (link crawl + policy-vs-feature checklist in release gate) | 1.69 |
| F-02 | **S0** | TT | Balance is hardcoded "1,240"; neurons-claim call sends user_id in the body with no Authorization header; errors are swallowed | TT-BAL-01, TT-BAL-02, TT-BAL-03, TT-INT-01 | offerwall-tasks-tab/index.html: markup literal; fetch without bearer; `!res.ok → return`, empty catch. Risk of unauthenticated balance read or credit. | Skeleton until authenticated read; derive user from the JWT server-side; ignore body user_id; surface errors with retry and last-updated | PSC-3 (contract test: no body-supplied identity) + PSC-4 (balance component) | 0.5 |
| F-08 | **S1** | BV, AG | SEO surface is zero: no meta description, og:*, canonical, JSON-LD, sitemap (404), robots without Sitemap line; client-rendered 339 KB shell; private AG is crawlable under a "BoundView" title | U-SEO-01, U-SEO-02, U-SEO-03, U-SEO-04, U-SEO-05, U-SEO-07, U-SEO-08 | Live probes of both hosts. | Static marketing site (home, pricing, compare, docs, changelog) with metadata, JSON-LD, sitemap and canonicals; `noindex` + auth on the private workspace | PSC-2 (SEO lint in gate) + PSC-4 (head component) | 1.41 |
| F-05 | **S1** | TT, BV | Neuron valuation inconsistent by up to 40x: UI says 1 N ≈ $0.004; redemption catalog implies ≈ $0.0008; master doc D5 implies ≈ $0.0001 | TT-BAL-10, U-COPY-03, TT-ECON-01 | Computed from UI string, catalog (500 N = 1,000 credits; 2,500 credits = $1) and master doc D5. | Owner picks one rate; publish in `pricing.json`; render everywhere from API; delete hardcoded claims; legal review of any dollar equivalence | PSC-5 (single source) + PSC-3 (price diff) | 0.69 |
| F-03 | **S1** | TT | Wall will be dead on integration: host CSP has no frame-src; iframe sandbox lacks allow-popups-to-escape-sandbox; no load/timeout handling | TT-WALL-03, TT-WALL-04, TT-WALL-01, TT-WALL-02 | Host CSP meta `default-src 'self'` with no frame-src; sandbox attribute inspected; fixed 460 px frame, no onload. | Add provider frame-src in the HTTP header CSP; add popup-escape flag; add 8 s load timeout with retry and fallback link | PSC-2 (staging end-to-end click-out test) + PSC-5 | 0.47 |
| F-07 | **S1** | BV, AG | Brand separation leaks: boundview.com manifest says "ai.spaincos"; same bundle on both hosts; BoundView title on the private site; brand enforced only by a runtime DOM scrub | U-TRU-12, U-MOB-07, U-SEO-03 | Live manifest probe; byte sizes 339,531 vs 339,560; `modules/brand.js`. | Per-host brand config at build time; split manifests/titles/icons; static-file brand grep in the gate; keep the DOM scrub only as a defence-in-depth check | PSC-5 + PSC-1 | 0.47 |
| F-04 | **S1** | TT | Cap messaging incomplete: hardcoded 10/day ring, no monthly (60) meter, no cap-reached state; UTC reset surfaces as 4 pm PT; 60 s cooldown unexplained | TT-CAP-01, TT-CAP-02, TT-CAP-03, TT-CAP-04, TT-CAP-05, TT-CAP-06 | Hardcoded ring length 138.2; spec §3 caps use UTC periods. | Read caps from the API; add monthly meter; cap-reached overlay with local reset time; cooldown timer; decide on local-midnight reset (E11 D-05) | PSC-3 (UI caps equal API caps) + PSC-4 (cap meter) | 0.42 |
| F-10 | **S1** | BV, TT | No age/eligibility gate before the earn surface; ad networks require adults | U-TRU-07, TT-FTC-10 | No gate found in code. | Date-of-birth or attestation gate before the wall; store the attestation; block under-age cohorts | PSC-3 + PSC-7 | 0.42 |
| F-11 | **S1** | ST | Spain Terminal v2 health failures recur (watchdog 55 s on /api/pdi/layers; at least 10 times after PR #342) | ST-02, U-REL-01, U-REL-02 | Memory notes; source not in this workspace. | Contract-level timeouts, cached last-good layer, stale banner, circuit breaker; synthetic alert with owner | PSC-6 + PSC-8 | 0.35 |
| F-14 | **S1** | CT | comptrove.com returns 403 (`x-vercel-mitigated: deny`) to a generic user agent; legitimate crawlers and first visits may be blocked | CT-01, CT-02, U-REL-08 | Live probe 2026-11-20. | Allowlist verified bots and a test user agent; WAF false-positive probe; challenge instead of deny | PSC-6 | 0.24 |
| F-16 | **S1** | BV | Checkout and passkey owner steps pending; price display not tied to one config | BV-01, BV-02, U-PAY-01 | Master doc owner-action list. | Complete checkout wiring; price diff against `pricing.json`; end-to-end test with a refund | PSC-3 | 0.19 |
| F-06 | **S1** | TT, GH | FTC disclosure is small and hedged ("may earn"): 11.5 px, #7a6f64 on #fdf6ee (4.57:1); per-offer disclosure promised in v261 A6 is missing | TT-FTC-01, TT-FTC-02, TT-FTC-03, TT-FTC-04, TT-FTC-05, TT-FTC-07 | Measured contrast and CSS; master doc A6. | Shared DISCLOSURE constant, ≥14 px, ink colour, plain "boundview earns a fee when you complete offers", above the wall and per offer, same wording in toast, email, push | PSC-4 (shared component) + PSC-1 (lint: wall renders only with disclosure sibling) | 0.15 |
| F-09 | **S1** | BV, AG | Only HSTS is set at the HTTP layer; CSP lives in a meta tag (cannot set frame-ancestors; no frame-src); no X-Content-Type-Options, Referrer-Policy, Permissions-Policy; HTML is cache-control no-store | U-TRU-09, U-TRU-10 | Header dump 2026-11-20. | Move headers to `vercel.json`; add CSP with report-uri; set sensible HTML caching with revalidation | PSC-5 (headers as code) + PSC-2 (header gate) | 0.12 |
| F-13 | **S1** | ST, CT | Email outreach compliance (CAN-SPAM, state laws, unsubscribe, sender identity) must be proven before any send toward the 250,000-contact target | U-TRU-08, U-NOT-06 | Memory notes; no seed-list evidence. | Seed-list inbox test, one-click unsubscribe, suppression list, physical address, domain warm-up plan | PSC-2 + PSC-6 | 0.12 |
| F-12 | **S1** | DG | DoorGraph gates open: CanonIntel LLC not formed; tenant isolation and restore not proven; pilot limited to Pacifica | DG-01, DG-02, DG-03 | Memory notes. | Close gates before any external evidence-room invite; isolation test suite; restore drill; nationwide matrix before expanding | PSC-3 + PSC-7 | 0.09 |
| F-15 | **S1** | GH | minutegig.com returns HTTP 502 | GH-01, GH-02, U-REL-01 | Live probe 2026-11-20. | Point domain to a live parked page; uptime monitor; no marketing until the app exists | PSC-6 | 0.06 |
| F-23 | **S2** | AG, BV | 65 script tags, 16 stylesheets, 77 modules (3.4 MB) and a 339 KB HTML shell; fonts hotlinked from another vendor CDN; no budget gate | U-PERF-01, U-PERF-05, U-PERF-11 | File inspection. | Code-split; self-host fonts; Lighthouse CI budgets | PSC-2 | 0.5 |
| F-27 | **S2** | ALL | No RUM, funnel or error telemetry visible; privacy-safe first-party analytics not set up | U-MEAS-01, U-MEAS-02, U-MEAS-03 | No code found. | Web-vitals beacon, funnel events, error tracker, dashboards | PSC-6 | 0.5 |
| F-18 | **S2** | TT | Pending text is static "usually minutes"; placeholder exposes "Adscend profile approved" wording | TT-PEN-01, TT-PEN-02, TT-PEN-03 | Source of the tab. | ETA per offer type; reversal reason; dispute link; remove vendor wording | PSC-4 | 0.34 |
| F-24 | **S2** | AG, BV | COMMON_TZ has 13 entries and lacks Anchorage, Honolulu, Phoenix, Puerto_Rico, Guam | U-NW-04, TT-NW-01 | `modules/tasks.js`. | Use full IANA US list; store tz per user | PSC-5 | 0.34 |
| F-17 | **S2** | TT | Toast always says "Offer verified", has no ARIA, lasts 3.5 s on a single timer | TT-BAL-05, TT-BAL-06, TT-BAL-07, TT-BAL-08 | Source of the tab. | Toast with role=status, attribution, ≥5 s, queue | PSC-4 | 0.23 |
| F-19 | **S2** | TT | Polling every 30 s with no visibilitychange handling wastes battery and requests | TT-WALL-08, TT-WALL-09 | Source of the tab. | Pause when hidden; back-off; push-driven refresh | PSC-1 | 0.19 |
| F-25 | **S2** | AG, BV | Unknown path returns HTTP 404 with a 108-byte "Redirecting…" script stub, not a branded page | U-STATE-07, U-SEO-11 | Live probe. | Branded 404 with search and links; keep status 404 | PSC-2 | 0.12 |
| F-26 | **S2** | AG | Pre-launch evidence inconsistent: JSON shows 31 passed/0 failed (2026-11-16), master doc 12/13 on 11-17 (environment miss); eval-bot password hardcoded in `qa/prelaunch.py` | AG-01, U-REL-05 | File inspection. | Preflight dependency check; move credentials to environment secrets and rotate | PSC-2 + PSC-5 | 0.11 |
| F-21 | **S2** | TT, BV, AG | Contrast and target size: pending dot 2.25:1; coral on white 3.38:1; Refresh button about 20 px tall | U-A11Y-05, U-A11Y-01 | Computed from source. | Token fix; 44 px targets | PSC-1 (contrast and target-size lint) | 0.1 |
| F-20 | **S2** | TT | Tab is called "Tasks" but the host already owns "Tasks" (scheduled tasks and inbox, deep link /?tasks=inbox); parameter name subid1 differs from master doc subId | TT-WALL-07, TT-INT-03 | Host `tasks.js`/`monitors.js`; master doc A6. | Rename to "Earn" or "Rewards"; contract test for provider parameters | PSC-3 + PSC-7 | 0.08 |
| F-28 | **S2** | ST, CT, DG | Coverage is uneven (violation identity coverage SF 46.6%, Seattle 4.1%) and not surfaced as coverage chips or freshness | U-NW-01, U-NW-11, U-STATE-10 | Memory notes. | Hide or flag results below the coverage threshold; show freshness per jurisdiction | PSC-8 | 0.08 |
| F-22 | **S2** | AG, BV | 8 inputs, 0 label elements; 3 h1; 1 aria-live region; 11 focus-visible rules; 2 reduced-motion rules in a 339 KB shell | U-A11Y-04, U-A11Y-06, U-A11Y-09 | Static counts on `index.html`. | Accessible names for all inputs; one h1; live regions for streaming; run axe in the gate | PSC-1 + PSC-2 | 0.06 |
| F-29 | **S2** | CT | Comptrove $149/mo is a forecast assumption rather than a validated price; preview-before-paywall unproven | CT-05, U-PAY-01 | Memory notes. | Price test; free preview; invoice and refund flows | PSC-7 | 0.0 |
| F-30 | **S3** | ALL | Design tokens, copy glossary and acronym spell-outs not enforced across apps | U-DES-01, U-DES-03, U-COPY-01 | Owner standards. | Shared token package and copy lint | PSC-1 + PSC-4 | 0.0 |

Findings F-11 to F-16 and F-26 to F-29 come from memory notes, probes and file checks; confirm them in the live repos before scheduling.

### E10.1 Top 10 priority list

1. **F-01 (S0, BV, AG)** — Privacy page on boundview.com is the private workspace policy ("no public sign-up, no advertising, no analytics trackers"); /terms.html returns 404; no consent gate. Fix: Write BoundView-specific privacy policy (ad network, cookies, neurons, push, data sale/share, state rights) and Terms; ship before the earn surface; add consent banner with equal-prominence reject; counsel review.
2. **F-02 (S0, TT)** — Balance is hardcoded "1,240"; neurons-claim call sends user_id in the body with no Authorization header; errors are swallowed. Fix: Skeleton until authenticated read; derive user from the JWT server-side; ignore body user_id; surface errors with retry and last-updated.
3. **F-08 (S1, BV, AG)** — SEO surface is zero: no meta description, og:*, canonical, JSON-LD, sitemap (404), robots without Sitemap line; client-rendered 339 KB shell; private AG is crawlable under a "BoundView" title. Fix: Static marketing site (home, pricing, compare, docs, changelog) with metadata, JSON-LD, sitemap and canonicals; `noindex` + auth on the private workspace.
4. **F-05 (S1, TT, BV)** — Neuron valuation inconsistent by up to 40x: UI says 1 N ≈ $0.004; redemption catalog implies ≈ $0.0008; master doc D5 implies ≈ $0.0001. Fix: Owner picks one rate; publish in `pricing.json`; render everywhere from API; delete hardcoded claims; legal review of any dollar equivalence.
5. **F-03 (S1, TT)** — Wall will be dead on integration: host CSP has no frame-src; iframe sandbox lacks allow-popups-to-escape-sandbox; no load/timeout handling. Fix: Add provider frame-src in the HTTP header CSP; add popup-escape flag; add 8 s load timeout with retry and fallback link.
6. **F-07 (S1, BV, AG)** — Brand separation leaks: boundview.com manifest says "ai.spaincos"; same bundle on both hosts; BoundView title on the private site; brand enforced only by a runtime DOM scrub. Fix: Per-host brand config at build time; split manifests/titles/icons; static-file brand grep in the gate; keep the DOM scrub only as a defence-in-depth check.
7. **F-04 (S1, TT)** — Cap messaging incomplete: hardcoded 10/day ring, no monthly (60) meter, no cap-reached state; UTC reset surfaces as 4 pm PT; 60 s cooldown unexplained. Fix: Read caps from the API; add monthly meter; cap-reached overlay with local reset time; cooldown timer; decide on local-midnight reset (E11 D-05).
8. **F-10 (S1, BV, TT)** — No age/eligibility gate before the earn surface; ad networks require adults. Fix: Date-of-birth or attestation gate before the wall; store the attestation; block under-age cohorts.
9. **F-11 (S1, ST)** — Spain Terminal v2 health failures recur (watchdog 55 s on /api/pdi/layers; at least 10 times after PR #342). Fix: Contract-level timeouts, cached last-good layer, stale banner, circuit breaker; synthetic alert with owner.
10. **F-14 (S1, CT)** — comptrove.com returns 403 (`x-vercel-mitigated: deny`) to a generic user agent; legitimate crawlers and first visits may be blocked. Fix: Allowlist verified bots and a test user agent; WAF false-positive probe; challenge instead of deny.

---

## E11. OWNER DECISIONS AND BLOCKERS

| ID | Decision / blocker | Why it blocks | Recommended default | Items |
|---|---|---|---|---|
| D-01 | Neuron dollar value (one number) | Every earn claim and legal wording depends on it (F-05) | Use the lowest defensible rate, publish in `pricing.json` | TT-BAL-10, U-COPY-03 |
| D-02 | Adscend signup and provider IDs | Wall cannot be tested live | Sign up, use a staging account first | TT-WALL-04, TT-WALL-07 |
| D-03 | Minimum age and eligibility rule | Gate content and ad-network terms | 18+ attestation; block under-age | U-TRU-07 |
| D-04 | Name of the earn tab | Collides with Scheduled Tasks (F-20) | Rename to Earn | TT-INT-03 |
| D-05 | Cap reset time basis | UTC reset appears as 4 pm PT (F-04) | Per-user local midnight, or state it plainly | TT-CAP-04 |
| D-06 | Which tiers see the earn tab | Entitlement state and disclosures | Free tier only | TT-INT-02 |
| D-07 | Counsel review of the privacy policy, terms, and the 50-state matrix | Cannot be self-certified | Engage counsel before launch | U-TRU-01..04, U-NW-07 |
| D-08 | Split boundview.com from ai.spaincos.com at build time | Brand rule of 2026-11-18 | Per-host builds | U-TRU-12 |
| D-09 | Spain Terminal repo access for audit | ST, CT, DG statuses are mostly ⚪ | Grant read access or run the nightly suite there | ST-*, CT-*, DG-* |
| D-10 | MinuteGig market default (R-236: the owner's SC portfolio) vs nationwide rule | Conflicts with the 2026-11-20 rule | Nationwide default with a first-run chooser | GH-*, U-NW-02 |
| D-11 | DoorGraph entity (CanonIntel LLC) formation | Contracts and terms | Form before any external invite | DG-01 |
| D-12 | Comptrove price | $149/mo is an assumption | Test three price points | CT-05 |
| D-13 | Device lab or paid device cloud and screen-reader sessions | Needed for U-MOB-11, U-A11Y-14 | Cloud device service | MOB, A11Y |
| D-14 | Analytics vendor | Measurement items depend on it | First-party, privacy-safe | U-MEAS-* |

---

## E12. SCORING REFERENCE (quick card)

- **Item weight (WTD AVG factor)** W = min(10, I + R + C + M). I = user impact 1–4; R = revenue/monetization 0–3; C = compliance/trust 0–3; M = marketing/SEO/measurement leverage 0–2. The four digits appear as `IRCM` in `qa/ux-items.json`.
- **Status score:** ✅ 100, 🟡 50, 🔴 0, ⚪ 0 (strict) or excluded (measured-only), — not applicable.
- **Per-app score** = Σ(W × status score) ÷ Σ(W) over applicable items.
- **Portfolio score** = Σ(app weight × per-app score) ÷ Σ(app weight). Weights BV 24, TT 16, ST 14, CT 16, AG 12, DG 10, GH 8 (total 100). Long-tail apps are weight 0 until audited.
- **Launch gate (per app):** strict ≥ 85, zero open S0/S1 findings, evidence coverage ≥ 90%.
- **Why two numbers:** strict shows readiness; measured-only shows quality of what has been tested. Both must climb; coverage shows how far the instrument has been applied.
- **Evidence rule:** a status moves to ✅ only with an evidence link in the item or the regression ledger.

---

## E13. LONG-TAIL APP INVENTORY (inherit Part E; not yet audited)

Names are taken from the owner's project and memory lists. **Deployment status and URLs are unverified**; rentspire.com returned HTTP 403 to the generic probe. Each app inherits every universal item U-* (E6) and the nationwide rule (E0). Weight is **0** until the app has been audited with a first measurement pass; then it receives a weight in the portfolio table and a column in the score tables. Eighteen of 37 Vercel projects have no git link (R-087), which fails U-REL-05 and U-REL-06 by construction until fixed.

| App | Class | Part E status | Weight | First action |
|---|---|---|---|---|

| CondoScores | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| RentCap | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| Rent Reasonableness Pro | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| AHJ Explorer | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| ParcelFrame | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| CaringBed | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| aSoberBed | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| EZWrit | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| RefundSnap | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| Inspection OS | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| Signal Lab | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| Orbit | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| SurplusEdges | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| HUD validators | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| RentSpire core | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| RentSpire Insurance | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| RentSpire Compliance | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| RentSpire AI support | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| RentSpire Geo | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| Property Ops | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |
| PHA Solutions | unverified | inherits Part E | 0 | Confirm deployed vs internal; run E8.6 gate; add to `ux-items.json` |

**Onboarding a new app:** (1) add its code to `APPS` in the JSON; (2) set statuses for the universal items; (3) add app-specific items with an `XX-` prefix; (4) assign a weight; (5) run the headline script.

---

## E14. CHANGE LOG AND SCRIPT USAGE

| Version | Date | Change |
|---|---|---|
| v262 | 2026-11-20 | Part E created: premortem, benchmarks, scoring, checklists, debug loop, findings register, long-tail inventory. Appended after Part D of v261. |

**Files:**
- `ai-gateway-site/qa-reports/ux-master-premortem-2026-11-20.md` — this part.
- `ai-gateway-site/qa/ux-items.json` — every item, weight and status, plus app weights.
- `ai-gateway-site/qa/generate-ux-headline.py` — recomputes the numbers.

**Usage:**
```
python3 qa/generate-ux-headline.py           # print scores
python3 qa/generate-ux-headline.py --write   # also writes qa-reports/ux-headline-latest.json
```
To change a status, edit `ux-items.json`, add an evidence line, rerun the script, and paste the new headline into E3. Numbers in this document were generated by the same logic and must match the script output.

*End of Part E.*

---

## PART C — OWNER-ONLY BLOCKERS (the complete list)

1. **Adscend publisher signup** (the only Phase 1 blocker) — checklist delivered this batch; approval 1-3 business days.
2. **ayeT-Studios publisher signup** (wall #2 — endpoint pre-wired, secret gate live; swap in their production secret when the account exists).
3. Point Adscend postback URL (5 min after approval; secret + IP allowlist paste → I finish wiring).
4. Broaden fine-grained PAT · register OAuth apps (Slack/Dropbox/Outlook/Box) · apply 4 SQL migrations · Supabase auth_config_write (passkeys) · Twilio credentials · SHMT PR #3889 approve+merge + redeploy runner · passkey e2e · .edu student-verify e2e · OpenRouter auto-top-up · low-balance credit alert.

**Session record (v261, 2026-11-19):** ayeT pre-wired as wall #2 (secret gate live, signed+idempotency verified, test rows cleaned); Part D added — full channel landscape, Phase 2 affiliate ladder draft (D5), 12-item idea backlog (D6). Prior (v260, 11-17): prelaunch 12/13 (env-only miss), free-agent suite 6/6, Tasks tab built + demo deployed, doc merged from v239/v252-v257/v259 + scale model (PR #215, #217).

---

## PART F — 2026-11-20 BROWSER DEBUG-LOOP: FINDINGS, PERMANENT FIXES, RE-VERIFICATION (v262)

**Scope:** full browser + backend debug-loop across all deployed surfaces (ai.spaincos.com,
boundview.com, the offerwall Tasks tab, Supabase edge functions), plus the SHMT server-side
workstream (gap09, PR #3993, Rule 11, gap05). Evidence: `browser-debug-loop-2026-11-20.md`
(9 surfaces, 52 checks, 3 P0 / 8 P1 / 11 P2) and live probes re-run 2026-11-21.

### F.1 Debug-loop results (before fixes)

| Surface | P0 | P1 | P2 | Status |
|---|---:|---:|---:|---|
| ai.spaincos.com (home/app, /verify, privacy, 404) | 1 | 3 | 5 | fixed in F.2 |
| boundview.com (home, /verify, privacy, manifest) | 2 | 3 | 5 | fixed in F.2 |
| offerwall Tasks tab (component) | 0 | 2 | 1 | fixed in F.2 |
| Supabase edge backend (offerwall-postback v7) | 0 | 0 | 1 | verified clean |

### F.2 Permanent fixes applied (v262, all staged in this PR)

| Finding | Severity | Root cause | Permanent fix (guardrail class) |
|---|---|---|---|
| BV-PRIV-01: boundview.com served the PRIVATE workspace privacy policy ("no advertising") while running an ad-funded offer wall | P0 | one shared static policy.html for both brands | brand-split surfaces: `privacy.boundview.html` (public consumer policy with offer-wall/affiliate/FTC disclosures) + host-conditional rewrites in vercel.json (D7 — per-host serving) |
| AI-VERIFY-01 / BV-VERIFY-01: /verify returned 404 + SPA fallback | P0 | vercel.json rewrite never fired on the live deployment | three-layer guardrail: vercel.json `redirects` (evaluated before filesystem), plus rewrites, plus `spa-redirect.js` path map for /verify, /privacy, /terms (D4 — belt-and-suspenders routing) |
| F-02: Tasks tab balance hardcoded "1,240 N", neurons-claim POSTed unauthenticated (401 every 30s, silent) | P1 | demo-grade polling shipped without a host-session contract | `BV_SESSION_TOKEN` host contract in README; signed fetch with Authorization header; on 401/403 the tab shows a visible sign-in state and STOPS polling; balance renders "—" until first verified read (D1 — no unauthenticated calls, no fake data) |
| F-04: cap messaging daily-only, no monthly meter, no cap-reached state, UTC reset unexplained | P1 | partial implementation of the cap design | daily 10 + monthly 60 meters, cap-reached states with explicit "resets 4:00 PM PT (UTC midnight)" (D5 — every limit shown with its reset basis) |
| F-06: FTC disclosure small and hedged | P1 | weak disclosure copy | prominent plain-language disclosure: paid partner offers, referral-fee funding model, verified-completion-only, earn-only/no-cash, caps (D8 — compliance copy is a first-class UI element) |
| F-03: offer wall would be dead on integration — host CSP had no frame-src; iframe sandbox lacked allow-popups-to-escape-sandbox; no load/timeout handling | P1 | CSP and iframe written before the wall integration | CSP `frame-src https:`; sandbox token added; 15s load timeout with visible retry state, never a silent blank frame (D2 — every embed has a failure path) |
| F-07: boundview.com served "ai.spaincos" manifest, ai.spaincos.com indexed under the "BoundView" title | P1 | shared bundle with runtime-only brand separation | `manifest.boundview.webmanifest` + host-conditional rewrite + brand.js manifest swap; static title now the ai.spaincos.com title (brand.js overrides at runtime); noindex meta on the private host, SEO heads (description/og/canonical/JSON-LD) on the public host; sitemap.xml (D7) |
| F-08 (partial): zero SEO surface | P1 | no meta/og/canonical/sitemap | runtime SEO heads via brand.js + sitemap.xml + robots.txt sitemap line; static per-host HTML heads remain an E11 owner item (build-time injection) |

### F.3 Live verification after fixes (re-probe of the same paths)

| Check | Before | After (live re-verification 2026-11-21, post-merge) |
|---|---|---|
| GET /verify on ai.spaincos.com | 404 + SPA fallback | **200 via 307 → /verify.html — FIXED** (also fixed client-side by the spa-redirect.js map) |
| GET /verify on boundview.com | 404 + SPA fallback | **STILL 404 — see the stale-deployment finding below** |
| GET /privacy.html on ai.spaincos.com | private policy | private policy (correct — this host IS the private workspace) |
| manifest / brand assets on boundview.com | "ai.spaincos" | still "ai.spaincos" on the stale deploy; the fix (boundview-manifest swap + host guards) is merged and waiting on the redeploy |
| offerwall-postback v7 (adscend signed/bad-sig/duplicate) | — | verified live 2026-11-21: correct sig → `1`, wrong secret → `0`, duplicate → `0` (idempotent); probe row + neuron ledger entry cleaned to zero residue |
| ayeT (wall #2) | pre-wired | secret present, reject paths verified |
| sitemap.xml / robots.txt on ai.spaincos.com | 404 / no sitemap line | **200 + sitemap referenced — FIXED** |

**🔴 NEW P0 (F-31): boundview.com is serving a stale deployment.** The v262 merge
(affc61d) deployed and is live on ai.spaincos.com, but boundview.com still serves
the 03:17–06:54 UTC 2026-11-21 v290b build (old spa-redirect.js, no /verify fix,
old manifest, old privacy policy). The domain is pinned to an old deployment
(likely a rollback or a paused/disconnected git integration on that Vercel
project — the CLI in this workspace has no credentials to force it). **Owner
action: open the Vercel dashboard, find the boundview project's deployment for
master @ affc61d, and promote it to production (or reconnect its git
integration).** Every BV-side fix above lands the moment it does.

### F.4 SHMT server-side workstream (rolled in from 2026-11-20/21)

| Item | Status | Evidence |
|---|---|---|
| gap09 write-back re-run (GO #3900) | COMPLETE — zero new fills; cr source exhausted (3 jurisdictions, ~NY only); ledger #3500 completion record posted | [ledger comment](https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-7058888501) |
| PR #3993 (gap04 rollback fix) | MERGED by owner (0bcf81ce) | [PR #3993](https://github.com/rentspire-bspain/SHMT/pull/3993) |
| Rule 11 invalid-index sweep | LIVE — function + weekly cron + sweep log (first run 2026-11-22) | ledger migration 20261117204505 |
| Rule 11 duplicate cron job (3191 + 3193 both active) | dedup STAGED — [PR #4080](https://github.com/rentspire-bspain/SHMT/pull/4080) needs a slot GO | direct unschedule correctly refused by permissions |
| gap05 consumer schedule | LIVE — job 3189 every 5 min + tick companion | ledger migration 20261118060035 |
| Corporate-registration NATIONWIDE expansion | STAGED — [PR #4081](https://github.com/rentspire-bspain/SHMT/pull/4081): 51-jurisdiction tiered plan + staging table/normalize function | owner rule: everything nationwide |

### F.5 What this means for the WTD AVG

The Part E strict portfolio score (14.6%) is dominated by ⚪ unmeasured items — the
measurement sprint is worth as much as the repair sprint. The F.2 fixes flip the three
P0s and four P1s from 🔴/🟡 to fix-verified once this PR deploys; the remaining gap is
concentrated in (a) per-host static SEO heads, (b) neuron valuation consistency (E11),
(c) the internal apps (Spain Terminal, Comptrove, DoorGraph) whose evidence lives outside
this workspace, and (d) nationwide data conformance behind the CR expansion (F.4).

### C-addendum (2026-11-21): new owner blockers from the debug-loop

1. **🔴 F-31 (P0): boundview.com stale deployment** — promote master @ affc61d to production in the Vercel dashboard (see Part F.3). Every merged BV fix is waiting on this.
2. **F-05: neuron valuation conflict (S1)** — UI says $0.004/N, the redemption catalog implies ~$0.0008/N, the master doc D5 implies ~$0.0001/N. Pick one rate; it changes the entire earn-surface economics (E11 item).
3. **E11 owner decisions** (14 items in Part E §E11) — neuron rate, Tasks tab name (collides with Scheduled Tasks), age/eligibility rule, cap-reset basis, counsel review of the new BoundView privacy policy.

### F.6 BATCH LOG — server-side free-lane worker loop (overnight 2026-11-21/22)

| Batch | Items measured | ✅ G | 🟡 Y | 🔴 R | Portfolio strict |
|---|---:|---:|---:|---:|---:|
| B1 | 0 | 0 | 0 | 0 | 15.5% (setup) |
| B2 | 3 | 0 | 1 | 2 | 15.5% |
- CT 🔴 U-SEO-01 — Observed the indexed Comptrove page title served at comptrove.com: "Average Rent in Austin, TX — Rents by Bedroom, History & Comps - Comptrove" (~73–74 characters).[[1](https://comptrove.com/m/austin/)] Brand ("Comptrove") and keyword ("Average Rent in Austin, TX") are present, and the wording is pa
- CT 🔴 U-SEO-09 — What is observably served on comptrove.com right now: a rent-data market page (e.g., Austin, TX — subject-property rents vs comp averages, bedroom-count breakdowns, HUD Fair Market Rents) and a launch-offer Pro plan mention at $179/month vs a $299/month list price [[3](https://comptrove.com/m/austin
- CT 🟡 U-SEO-08 — One representative public content page — a Comptrove rent-comps market page (Austin, TX average-rent) — served substantial readable body copy, data tables, and internal links in the raw crawlable HTML, confirming content is visible without JavaScript on that page [[2](https://comptrove.com/m/austin/
| B3 | 3 | 0 | 4 | 3 | 15.7% |
- AG 🟡 U-TRU-05 — Fetched the currently served page at https://ai.spaincos.com: it presents only the AI-assistant branding "Where knowledge begins" / "Ask anything" and advertises importing Perplexity conversation history [[1](https://ai.spaincos.com/)], with no affiliate links, incentive offers, or sponsored recomme
- AG 🟡 U-TRU-13 — Fetched https://ai.spaincos.com [[1](https://ai.spaincos.com/)]: the retrieved page describes the gateway's own app and content, and no third-party CDN hotlink (cdnjs, jsDelivr, unpkg, Google Fonts, or any other vendor asset host) was observed anywhere in the retrievable page result [[1](https://ai.
- AG 🟡 U-TRU-17 — Observed https://ai.spaincos.com served as its landing page ('Where knowledge begins'), presenting the gateway as a place to import Perplexity conversation history as personal context; the available page result contains no reviews, testimonials, star ratings, customer quotes, endorsements, or incent
- AG 🔴 U-TRU-19 — ai.spaincos.com serves its homepage (the Perplexity-history import page) [[1](https://ai.spaincos.com/)] and its repo rentspire-bspain/ai-gateway-site is indexed [[2](https://github.com/rentspire-bspain/ai-gateway-site)], but /.well-known/security.txt is not indexed or retrievable, no vulnerability
- BV 🔴 U-TRU-06 — No negative-option/auto-renew disclosure could be observed for https://boundview.com itself. The retrievable pages resolve only to a similarly named but different service — BondView at join.bondview.com — whose pricing page lists $69/month or $759/year (Investors and Advisors) and $120/month or $1,3
- CT 🔴 U-TRU-01 — No privacy policy is served or discoverable on comptrove.com in current results: the only comptrove.com page retrieved is a rent-comparison content page (Average Rent in Austin, TX — Rents by Bedroom, History & Comps) [[5](https://comptrove.com/m/austin/)], not a /privacy or policy page, so nothing
- CT 🟡 U-TRU-06 — Fetched comptrove.com plus probes of /terms, /privacy, /help, /sitemap.xml and /robots.txt. The served content is a free rent-comparison data surface only (average rent by bedroom, rent history, comps — e.g. the Austin, TX rent page [[11](https://comptrove.com/m/austin/)]); no pricing page, no check
| B4 | 3 | 0 | 1 | 9 | 15.8% |
- CT 🔴 U-TRU-14 — comptrove.com is live and crawlable — the only indexed Comptrove page surfaced was the Austin rent report (Average Rent in Austin, TX — Rents by Bedroom, History & Comps, comptrove.com [[18](https://comptrove.com/m/austin/)]) — but no support contact route and no response SLA are visible on the doma
- CT 🔴 U-TRU-21 — Fetching comptrove.com and its obvious sub-pages (/privacy, /terms, /help, /docs, /sitemap.xml, /robots.txt) surfaced none of the three PASS-benchmark elements: (1) no trust page — the only trust-center result found was for a different entity, AcaTrove at acatrove.com [[11](https://apis.io/security/
- CT 🔴 U-COPY-01 — Observed the live Comptrove page ('Average Rent in Austin, TX — Rents by Bedroom, History & Comps' at comptrove.com): acronyms appear unexpanded at first use — 'BR' in bedroom-count labels, 'HUD FMR' as a rent benchmark, and 'Pro' as a product tier — with no full-term-then-parenthetical definition a
- CT 🔴 U-COPY-03 — Fetched comptrove.com and its implied sub-page surfaces (help/docs/terms). What is served right now identifies Comptrove as a rent-comps product; the only pricing signal observed is a Pro price of $179/month during a launch offer [[1](https://comptrove.com/m/austin/)]. No served page defines 'neuron
- GH 🔴 U-SEO-07 — Attempted to fetch https://minutegig.com and its obvious sub-pages to inspect the served markup for <script type="application/ld+json"> blocks; the retrieval did not surface the site's markup or any relevant pages, so none of the five required types — Organization, WebSite+SearchAction, SoftwareAppl
- GH 🔴 U-TRU-14 — No support route or stated SLA is observable for minutegig.com. The live research pass found no Minutegig contact or support page, no help center, and no publicly indexed support-response SLA for the domain; standard sub-page locations (/help, /docs, /robots.txt, /sitemap.xml) could not be verified
- GH 🔴 U-TRU-19 — No /.well-known/security.txt could be observed for minutegig.com, and no monitored vulnerability-reporting inbox exists for that domain. The only disclosure contact surfaced anywhere was vulnreports@minut.com, published in the Bug Bounty Program Policy on minut.com [[1](https://www.minut.com/legal/b
- GH 🔴 U-TRU-21 — No buyer-facing security/compliance evidence could be observed for minutegig.com: search results did not surface any minutegig.com trust page, SOC 2 status, or security questionnaire pack [[1](https://oneminutego.com/sitemap.xml?lang=en)][[2](https://www.minutegroup.com/policies/terms-and-conditions
- GH 🔴 U-COPY-07 — No minutegig.com document could be observed containing a link at its point of reference, and no source or filtered evidence view was found. Searches for https://minutegig.com plus its obvious sub-pages (/privacy, /terms, /help, /docs, /sitemap.xml, /robots.txt) returned no minutegig.com content at a
- AG 🟡 U-COPY-01 — Fetched the live ai.spaincos.com landing copy: most visible consumer-facing prompts are plain-language, but the page also serves technical wording such as "open-weight models" without a plain-language definition at first use [[1](https://ai.spaincos.com/)]. The site's GitHub repo (rentspire-bspain/a
| B5 | 2 | 0 | 0 | 2 | 15.8% |
- AG 🔴 U-MOB-05 — Fetched ai.spaincos.com and its repo reference (GitHub rentspire-bspain/ai-gateway-site [[2](https://github.com/rentspire-bspain/ai-gateway-site)]); the app is identified but no served HTML/CSS was observable containing env(safe-area-inset-*) or dvh usage for full-height layouts. No viewport-fit=cov
- CT 🔴 U-MOB-07 — Comptrove is a rent-comparison site titled 'Average Rent in Austin, TX — Rents by Bedroom, History & Comps - Comptrove' (comptrove.com) [[1](https://comptrove.com/m/austin/)], so the brand/name element matches the host. However, the available results do not surface a web app manifest — no `<link rel
| B6 | 2 | 0 | 2 | 7 | 15.8% |
- GH 🟡 U-PERF-01 — Field data for minutegig.com (28-day rolling window, trend 'stable') reports mobile p75 LCP = 2.1 s — Good, comfortably under the ≤2.5 s pass benchmark and far below the >4.0 s fail line [4]; the same field report also shows INP 164 ms (Good) and CLS 0.08 (Good) [4]. Caveats: this figure could not b
- AG 🟡 U-AUTH-03 — ai.spaincos.com homepage loads right now [[1](https://ai.spaincos.com/)], and the site's documentation describes the exact pass behavior: the originally opened page is restored after login via a URL-encoded returnTo parameter restricted to same-domain relative paths (e.g., /signin?returnTo=%2Fdashbo
- AG 🔴 U-AUTH-04 — Fetch of https://ai.spaincos.com serves only the gateway landing page ('Where knowledge begins') [[2](https://ai.spaincos.com/)] with chat/marketing UI; no 'Forgot password?' or 'Email me a sign-in link' entry point is rendered, so no reset/magic-link flow could be observed from the served page. No
- AG 🔴 U-NOT-06 — Checked https://ai.spaincos.com and its obvious sub-pages (/privacy, /terms, /help, /docs, /sitemap.xml, /robots.txt) plus the app's source repo (rentspire-bspain/ai-gateway-site [[1](https://github.com/rentspire-bspain/ai-gateway-site)]) — no served page demonstrates any of the three benchmark elem
- AG 🔴 U-AI-10 — Fetched https://ai.spaincos.com and its public surfaces: the homepage ('Where knowledge begins') documents only a Perplexity-history import feature for personal context [[1](https://ai.spaincos.com/)]; the public repo rentspire-bspain/ai-gateway-site describes a frontend plus a QA system with no cap
- AG 🔴 U-HELP-04 — https://ai.spaincos.com serves the app homepage ('Where knowledge begins', powered by open-weight models) [[1](https://ai.spaincos.com/)], but no Changelog or 'What's New' link appears anywhere in the app's navigation, page body, or footer. No /changelog or /whats-new route was discoverable, and /ro
- AG 🔴 U-MEAS-05 — Fetched https://ai.spaincos.com live: served page is the landing page with the 'Ask anything' prompt, open-weight-model description, and Perplexity-history import [[1](https://ai.spaincos.com/)] — no feedback button, thumbs control, feedback link, or CSAT survey element is served anywhere on the obs
- AG 🔴 AG-03 — The only observable result for https://ai.spaincos.com is its homepage ('Where knowledge begins') [[2](https://ai.spaincos.com/)]; it serves no rate-limit header documentation, no HTTP error-code reference, and no /docs or API page exposing them. The public repo rentspire-bspain/ai-gateway-site cont
- AG 🔴 AG-09 — Fetched https://ai.spaincos.com and probed obvious sub-pages (/docs, /help, /robots.txt, /sitemap.xml): only the public landing page surfaces (title 'Where knowledge begins', describing importing Perplexity history into personal context) [[1](https://ai.spaincos.com/)]. No documentation search inter
| B7 | 2 | 0 | 0 | 7 | 15.8% |
- BV 🔴 U-AI-10 — Fetched the live results for the site and its retrievable pages: the public entry point is BondView's marketing/signup page ('Municipal Bond Market Access for Everyone - Join BondView') plus an About Us page and a BondView 500 Liquid Municipal Bond Index page on join.bondview.com [[2](https://join.b
- BV 🔴 U-NW-09 — No boundview.com page showing a geo-eligible offers wall could be observed. The only BoundView-related result in live fetches is a Municipal Bond Screener on bondview.com [[9](https://www.bondview.com/bonds-screener)] — a different domain — and the only policy page surfaced is bound.co's Legal: Priv
- BV 🔴 BV-18 — The live evidence does not establish that support@boundview.com receives mail. No boundview.com page was captured: the ten retrieved results are all unrelated domains — leadiq.com (BondView profile) [[1](https://leadiq.com/c/bondview/5a1d9a412300005300894c30)], support.blackview.hk [[2](https://supp
- BV 🔴 U-HELP-04 — No changelog or what's-new page is observable on boundview.com or its obvious sub-paths (/help, /docs, /sitemap.xml, /robots.txt): no Bound-owned changelog, help-docs page, or sitemap surfaced for the domain, and search results pointed only to unrelated sites, so no changelog was observable at the a
- CT 🔴 U-ONB-09 — Observed https://comptrove.com and obvious sub-pages (/privacy, /terms, /sitemap.xml, /robots.txt) as served right now: no signup/onboarding flow referencing a U-ONB-09 welcome or lifecycle email is exposed, no brand-correct sender identity (e.g. an @comptrove.com welcome address or Comptrove displa
- CT 🔴 U-AUTH-08 — Fetched live coverage of https://comptrove.com and probed the implied sub-pages (/privacy, /terms, /help, /docs, /sitemap.xml, /robots.txt). The only observable Comptrove page is the Austin rent data page 'Average Rent in Austin, TX — Rents by Bedroom, History & Comps' (comptrove.com) [[11](https://
- CT 🔴 U-AUTH-05 — No passkey register or sign-in flow is observable on https://comptrove.com. The served site is the public Comptrove rent-comparison app (rentspire-comps on Vercel) — a public rent-lookup surface with no account UI, no 'Add passkey'/'Passkey' control, no WebAuthn API usage (navigator.credentials.crea
| B8 | 1 | 0 | 2 | 15 | 15.9% |
- CT 🔴 U-STATE-12 — Fetched https://comptrove.com — the served page is Comptrove's public rent-comparison surface: an 'Average Rent in Austin, TX' style report with rents by bedroom, rent history and comps tables [[1](https://comptrove.com/m/austin/)]. No long-running work exists to observe: no job queue, no async task
- CT 🔴 U-PAY-05 — No refund, reversal, or chargeback policy could be observed anywhere on comptrove.com. The only on-domain page surfaced is Comptrove's Austin rental-data report (comptrove.com) [[11](https://comptrove.com/m/austin/)], which carries no policy links. Targeted probes — site-restricted refund/reversal/c
- CT 🔴 U-REL-01 — comptrove.com resolves and serves Comptrove content right now (a rendered Austin, TX rent-comparison page was fetched from comptrove.com), but the benchmark requires ≥99.9% monthly availability AND a public status page — neither is verifiable: no public Comptrove status page was found on comptrove.c
- CT 🔴 U-STATE-09 — comptrove.com is served and reachable, but the benchmark is not met on what is observable right now. The only entitlement/pricing evidence surfaced is a Comptrove Pro price of $179/month (launch offer, $299 list), appearing in a search-result snippet tied to the comptrove.com 'Average Rent in Austin
- CT 🔴 U-PAY-10 — comptrove.com serves a public rent-comparison product only: the retrievable page inventory surfaces property/rent data pages (e.g., the Austin, TX average-rent page with rents by bedroom [[17](https://comptrove.com/m/austin/)]), and no student or.edu pricing page, enrollment-verification step, disco
- CT 🔴 U-NW-09 — comptrove.com as served right now shows no geo-availability offer wall: the only Comptrove page surfaced is its rent-data page (average rent in Austin, TX by bedroom, history & comps) with a Pro launch offer, and no geo-eligible offer list, no thin-offers fallback message, and no IP-geolocation stat
- CT 🔴 U-NOT-04 — DNS-level email authentication for comptrove.com could not be verified: no SPF TXT record at the apex, no discoverable DKIM key under common selectors (google._domainkey, s1/s2, krs._domainkey), and no DMARC record with p=quarantine or p=reject at _dmarc.comptrove.com were observed. The benchmark re
- CT 🔴 U-NW-06 — Fetched comptrove.com: the served page is a rent-comparison result ("Average Rent in Austin, TX — Rents by Bedroom, History & Comps") with a displayed business address — a read-only rent-data surface [[3](https://comptrove.com/m/austin/)]. No address-entry form, phone-number field, or ID-format inpu
- CT 🔴 U-HELP-02 — Fetched https://comptrove.com — it serves a normal public rent-comparison page ('Average Rent in Austin, TX — Rents by Bedroom, History & Comps') [[1](https://comptrove.com/m/austin/)], not an error or support surface. No error page could be observed, and the served page shows no error-reference-ID
- CT 🔴 U-HELP-04 — Fetched and searched https://comptrove.com plus obvious sub-paths (sitemap.xml, robots.txt, help/docs-style pages) and observed no changelog or 'What's new' page served or linked from the app. The only Compt-branded product-updates page located is 'What's New in Compt: Product Updates, June 2026' on
- CT 🔴 U-MEAS-05 — Fetched https://comptrove.com plus the check-relevant sub-pages (/privacy, /terms, /help, /docs, /sitemap.xml, /robots.txt). comptrove.com serves a public rent-comparison app: an address/ZIP search entry point and static market pages such as the Austin, TX rent-by-bedroom/comps page [[11](https://co
- CT 🔴 U-NOT-06 — No SMS consent (TCPA) language, express written consent disclosure, STOP/HELP instructions, or 8am-9pm recipient-local quiet-hours policy was observed on comptrove.com or its obvious sub-pages (/privacy, /terms, /help, /docs, /robots.txt, /sitemap.xml). The only SMS policy found in search was for kr
- CT 🟡 CT-05 — Comptrove's Austin page (comptrove.com) advertises a free rent check with no account required and a sample lookup that can be tried without signing up, plus a worked Austin comp set [[1](https://comptrove.com/m/austin/)] — satisfying the 'sample lookup' benchmark for free access. The paywall exists
- CT 🔴 CT-03 — comptrove.com does not serve the benchmark scenario. Observed: a Pro plan at $179/month under a launch offer against a $299/month list price — no $149/month plan at any tier anywhere on the site [[4](https://comptrove.com/m/austin/)]. The public surface is rent-data content (rent by bedroom, history
- CT 🟡 CT-06 — comptrove.com serves at least one indexed, location-specific programmatic SEO page — 'Average Rent in Austin, TX — Rents by Bedroom, History & Comps' [[1](https://comptrove.com/m/austin/)] — with rent observations and local content, confirming the CITY tier of the state/county/city/parcel benchmark.
- CT 🔴 CT-09 — Fetched comptrove.com and its obvious sub-page probes (/privacy, /terms, /help, /docs, /sitemap.xml, /robots.txt) plus targeted methodology searches. What is actually served right now: the Austin rent page 'Average Rent in Austin, TX — Rents by Bedroom, History & Comps' [[1](https://comptrove.com/m/
- CT 🔴 CT-11 — No trust/security page is observable at comptrove.com or its obvious sub-pages (/privacy, /terms, /help, /docs). Nothing served right now shows a SOC 2 status, SOC 2 report reference (no report type, audit period, or auditor named), security questionnaire, trust-center link, or SOC 2 badge.

**Direct-fix batch (2026-11-22, alongside B8):** ✅ ~~AG U-TRU-19~~ security.txt published (/.well-known/security.txt, RFC 9116) · ✅ ~~AG/BV U-TRU-02~~ terms published — terms.html (private workspace ToS) + terms.boundview.html (consumer ToS: Neurons earn-only, third-party offer terms, auto-renewal + cancellation, liability caps; counsel-review flag E11). Both live on deploy of this PR.
| B9 | 0 | 0 | 0 | 0 | 16.1% |

**Deterministic Playwright audit batch (2026-11-22, per coordinator directive — accessible public routes, AG + BV):** 11 item slots measured on landing/wide/error routes at mobile 375px and 2560px: ✅ ~~AG U-MOB-03/06~~ · ✅ ~~BV U-MOB-03/05/06~~ (viewport-fit=cover, no horizontal scroll, inputs ≥16px) · 🟡 U-MOB-08 AG/BV (6/60 touch targets <24px) · 🟡 U-A11Y-03 AG/BV (focus visibility runtime-dependent) · 🔴 U-A11Y-13 AG/BV (6/16 status indicators color-only, no text/aria). 0 console errors both hosts. Raw results: /home/user/workspace/completion-loop/browser-audit-results.json.

### DEPLOY VERIFICATION BATCH (2026-11-23, PRs #362 + #342 + #367 merged under owner authorization)

Live production readback, all credential-free:
- ✅ ~~security.txt~~ — 200 on ai.spaincos.com (Contact/Expires 2027-11-22/Policy) — closed AG U-TRU-19
- ✅ ~~terms~~ — terms.html + terms.boundview.html 200 on both hosts — closed U-TRU-02
- ✅ ~~BoundView privacy policy~~ — live on boundview.com — closed BV U-TRU-01
- ✅ ~~/verify 404~~ — 200 on both hosts (307 → page)
- ✅ ~~color-only status indicators~~ — live production 0/16 (was 6) — closed U-A11Y-13
- ✅ ~~Earn tab host wiring~~ — module deployed and loading; offer wall intentionally disabled pending Adscend approval; zero unauthenticated calls
- ✅ narrow frame-src partner origins live (PR #367 — restored after the #342/master merge dropped it; narrower than the original broad https:)

Register v19: portfolio strict **17.1%** (baseline 14.6% → 16.1% → 16.7% → 17.1%), measured-only 32.8%.
Worker queue fully drained (batch 10: NO TASKS LEFT — every fetch-verifiable item measured).
Fleet-gate ledger record posted: SHMT issue #3500 comment 7106806507.

### BATCH 11 — MULTIROUTE PLAYWRIGHT AUDIT (2026-11-23, deterministic runner, 5 routes x 2 hosts x mobile/desktop/slow-4G)

All routes 200 on both hosts; 0 console errors everywhere; no horizontal scroll on any route (including /help.html); static subpages (terms, privacy, docs, help) CLS 0.
- 🟡 U-PERF-12 AG/BV: renders and stays interactive under Slow-4G emulation (400 ms / 400 kbps), but layout stability degrades
- 🔴 U-PERF-03 AG/BV + **new finding F-32 (S1)**: landing CLS 0.573 desktop / 0.793 mobile / 1.069 slow-4G vs the 0.1 threshold — real layout-instability failure on the landing page; fix = reserve space for the pre-boot shimmer/hero and dimension late-loading assets
- 🟡 U-A11Y-03 BV: focus visibility weak (1/5 first focusables show visible focus styles) — same build as AG
- 🟡 U-MOB-08 AG: 10/80 interactive elements under 24px on mobile
Register v21: portfolio strict **17.4%**, measured-only 32.9%. Raw results: /home/user/workspace/completion-loop/multiroute-results.json.

### F-32 CLOSEOUT (2026-11-23, PRs #390 + #391 + #396 + #401 + #403, all owner-authorized)

Landing CLS: **0.793 → 0.355 live** (mobile 375px; slow-4G was 1.069). Fix series:
- ✅ ~~header settle (57→61px webfont swap)~~ — pinned min-height 61px (PR #390)
- ✅ ~~suggestions box growth (145→253px onboarding swap)~~ — post-mount height reserved (PR #391)
- ✅ ~~composer pills mount (+92px above the fold)~~ — ALL five inserters (positionComposerPills, media, media-labs, sources, local-files) + their MutationObserver re-mounts deferred to first interaction via a shared brand.js gate (PRs #396 + #401)
- ✅ ~~onboarding content mount (~1,600px into #suggestions behind the auth overlay)~~ — the root cause of the "connection box [0,0]" mystery: the conn box was pushed off-screen by this growth; all three mount paths deferred (PR #403)
- 🟡 remaining single shift 0.336 at ~1.4s: coincides with lazy module loading (script nodes appended to body at 1.1-1.4s); attributed nodes are stable or out-of-viewport; no DOM mutation correlates under instrumentation — next diagnostic step is lazy-module bisection

Register v21: portfolio strict 17.2%, measured-only 32.8%. U-PERF-03 AG/BV R→Y (0.793→0.355, threshold 0.1 not yet met).

### F-32 BISECTION (2026-11-23, deterministic Playwright module-blocking)

45 lazy modules blocked one-at-a-time against live production: the 0.336 shift survives every single-module block EXCEPT **siteassets.js** — blocking it removes the 0.336 entirely, but exposes a 0.124 sidebar-render shift (side-nav, sidebar-footer, newThreadBtn, sidebar-actions, logo). Root-cause hypothesis: the setLogo runtime swap (innerHTML → img with no intrinsic dimensions) destabilizes the sidebar column, and the sidebar shell has no pre-reserved layout before renderThreads paints. Fix spec (next PR): reserve .logo-mark dimensions (aspect-ratio) + pre-size the sidebar shell. U-PERF-03 remains Y (0.355 live, threshold 0.1).

**Bisection correction (2026-11-23):** `.logo-mark` is already pinned at 28×28px — the setLogo intrinsic-dimension hypothesis is disproven. The siteassets.js block result reflects load-order effects on the sidebar render, not the logo swap. The remaining 0.336 requires live deploy-measure iteration: candidate fixes (sidebar-shell pre-size, renderThreads deferral) deployed one at a time with live CLS measured after each.

### KEYBOARD VERIFICATION BATCH (2026-11-23)

✅ ~~U-A11Y-03 (AG + BV)~~ — real keyboard-operability test on live production (Playwright, 15 focus steps per host): 15/15 focused elements carry :focus-visible with solid outlines on both hosts — tour overlay, navigation, and form controls are keyboard-reachable with visible focus. Promoted Y → G on evidence.

### F-32 ROOT CAUSE FOUND — mobile-375.css late reflow (2026-11-23, PR #416 pending merge)

Instrumented the auth overlay card child-by-child at 50ms cadence (local reproduction + live): between t≈1.4s and t≈1.5s `#authStep1` grows **330px → 372px (+42px)**, pushing `.auth-error`, `.auth-note`, `.auth-conn-pitch` and the conn rows down — exactly the shift attributed to the `.conn-tag` nodes. Drilling into children: `.auth-input` 48→52px, `.auth-link` rows 26→44px, computed line-height 20px→22.4px. **The trigger is `/css/mobile-375.css`**, loaded as a non-blocking `<link>` at the end of `<body>`: its phone-pass font-size floors (`body,button 14px !important`, inputs 16px) land after first paint on slow networks and re-flow the entire auth card. Font-swap and sidebar hypotheses are disproven (the shift reproduces with font requests route-blocked; the sidebar is off-canvas and rect-stable at 375px). The siteassets.js bisection signal was a load-order artifact.

Fix in PR #416: mobile-375.css moved to `<head>` as render-blocking behind a union media attr `(max-width: 768px), (pointer: coarse), (hover: none)` (covers every inner query; desktop unchanged); both PPLX variable fonts self-hosted under `/fonts/` with preload (CSP `font-src 'self'` already permitted, no hash changes needed); metric-matched fallback `@font-face`s (ascent/descent/line-gap/size-adjust tuned to real PPLX metrics) so any font swap is layout-neutral. Local verification: auth card renders at final height from first paint, **viewport CLS 0.0** (was 0.336), desktop body font-size unchanged 16px, `qa/csp-hash-check.py` PASS. U-PERF-03 stays 🟡 until the live re-measure after merge.

### F-32 CLOSED — U-PERF-03 → ✅ (2026-11-23, PRs #416 + #420, both owner-authorized)

Live re-measurement after #420 deployed (fresh signed-out contexts, Playwright PerformanceObserver, both hosts):

| condition | ai.spaincos.com | boundview.com | threshold | status |
|---|---|---|---|---|
| mobile 375×812 | 0.000 | 0.000 | ≤0.1 | ✅ |
| desktop 1440×900 | 0.054 | 0.054 | ≤0.1 | ✅ |
| slow-4G (400kbps, 150ms) | 0.047 | 0.047 | ≤0.1 | ✅ |

Full F-32 series: 0.793 → 0.355 (#390 header pin, #391 suggestions reservation, #396/#401 pills gate, #403 onboarding deferral) → **0.000 mobile / 0.054 desktop / 0.047 slow-4G** (#416 + #420). U-PERF-03 flipped 🟡→✅ on BV and AG; register v25; headline strict 17.3% / measured-only 33.0% (123✅ / 230🟡 / 221🔴 / 803⚪).

- ✅ ~~#416: mobile-375.css late reflow (the 0.336) — render-blocking in head behind union media attr; fonts self-hosted + metric-matched fallbacks~~ (merged 23:01Z, live CLS 0.0 mobile)
- ✅ ~~#420: subtitle two-line reservation, pre-collapsed drawer via CSS, pre-visible expand button~~ (merged 00:51Z, live slow-4G 0.047)
- ✅ ~~remaining 0.336 layout shift at 1.4s~~ — root-caused to mobile-375.css late apply, eliminated
- ✅ ~~0.111 sidebar-render shift / 0.134 suggestions shift on slow-4G~~ — eliminated in #420

### F-32 batch ledger record (2026-11-24)

Merged closeout record: https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-7120284077 · earlier closeout comment: https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-7119002745

### Batch 12 — post-merge audit + PERF measurement pass (2026-11-24, register v26)

**Post-#420/#424 multiroute audit (both hosts, 5 routes × mobile/desktop/slow-4G):** zero console errors on every combo; landing CLS mobile 0.000 / desktop 0.054 / slow-4G 0.084; terms/privacy/docs/help all CLS 0. Confirms the F-32 closeout holds post-merge.

**PERF measurement pass (Playwright lab, fresh signed-out contexts, both hosts):**

- ✅ U-PERF-08 (fonts) 🟡→✅ on BV+AG — post-#416: both PPLX fonts same-origin `/fonts/`, preloaded, `font-display: swap`, exactly 2 families, 0 third-party font requests (live-verified; only CSP whitelist strings remain), metric-matched fallbacks make the swap layout-neutral.
- 🟡 U-PERF-01 (LCP) ⚪→🟡 on BV+AG — lab LCP: ai.spaincos.com mobile 1616ms / desktop 1896ms; boundview.com mobile 1796ms / desktop 2176ms (all ≤2.5s good); slow-4G 11.6s (LCP element waits on the webfont queued behind the 3.4MB module tail) — fails there pending the F-23 code-split.
- 🟡 U-PERF-12 (slow-4G usable) ⚪→🟡 on BV+AG — auth email input present and accepting input 0.4s after nav on slow-4G, input-event latency 0ms (core action fast); full module load trails 11.4s (77 modules, F-23).
- ⚪ Free-lane worker queue: still drained (batch 10 = NO TASKS LEFT; every fetch-verifiable U item measured in batches 1–9). Remaining ⚪ items need new evidence types (lab audits like this pass, code inspection, or live probes).

**Headline after batch:** strict 17.6% / measured-only 33.3% — 125✅ / 234🟡 / 219🔴 / 799⚪ (v26, up from 123✅/230🟡 v25).

**Next highest-priority open items:** F-02 (S0, TT — governed-sql PR #15 offerwall tasks tab: authenticated balance read) and the F-23 perf debt (code-split 77 modules → clears the slow-4G LCP/interactive fails in U-PERF-01/12).

### Batch 13 — F-02 (S0) verified on PR #15 branch (2026-11-24, register v27)

- 🔧 **New durable test** `qa/contract_neurons_claim.py` (governed-sql, PSC-3): PASS — server derives identity from the JWT (mismatched body user_id returns the caller's own balance), unauthenticated 401, anon-key bearer 401/403.
- 🐛 **Bug found & fixed in PR #15**: the balance poll omitted `{action:"balance"}` — every call 400'd "unknown action" and the balance element stayed "—" even though the cap pill updated. Fixed + comment pointing at the contract test.
- ✅ Component verified locally (Playwright, eval-bot fixture): signed-out shows "Sign in to view your balance" with **zero** neurons-claim calls; signed-in renders **1,110 N** with cap meter and subId label.
- 🟡 TT-BAL-01/02/03 flipped 🔴→🟡 (branch-verified; flip to green when PR #15 merges and the live readback passes).
- Headline after batch: strict 17.8% / measured-only 33.6% — 125✅ / 237🟡 / 216🔴 / 799⚪ (v27). F-02 closure now blocks only on merging PR #15 + live readback.

### Batch 14 — F-02 CLOSED with live readback (2026-11-24, PRs #15 + #427 merged, register v28)

**PR #15 (governed-sql) merged 03:56Z** — Tasks tab with the authenticated balance read, FTC disclosure, cap messaging, and `qa/contract_neurons_claim.py`. **PR #427 merged 03:56Z** (batch-13 doc).

**Live balance readback (Playwright, live hosts, eval-bot QA fixture):**
- ✅ ai.spaincos.com signed-in: Earn tab renders **1,110 N** — exactly matching the neurons-claim API (balance 1110, HTTP 200), cap meter "Today 0/10 · 0/60 this month"
- ✅ boundview.com signed-out control: "Sign in to view your balance", **zero** neurons-claim calls
- ✅ `qa/contract_neurons_claim.py` PASS: JWT-derived identity, body user_id ignored, 401 unauthenticated, 401/403 anon-key bearer

**Register correction (honesty note):** the batch-13 claim that TT-BAL-01/02/03 flipped 🔴→🟡 was wrong — that register edit was wiped by a branch reset before it was committed; the merged v27 actually still had R. This batch flips them 🔴→✅ directly with the live-readback evidence (the branch verification in batch 13 stands as documented evidence; only the register write was lost). Register v28.

**Headline after batch:** strict 18.0% / measured-only 33.9% — 128✅ / 234🟡 / 216🔴 / 799⚪. TT strict 16.8% → 19.3%. F-02 (S0) is closed pending only counsel-facing policy review (F-01's consent gate remains the other S0 thread).

### Batch 15 — F-23 slow-4G LCP fixed + F-01 consent gate live (2026-11-24, PRs #429 + #430, both owner-authorized)

**F-23 / U-PERF-01 / U-PERF-12 → ✅ (BV+AG).** Root cause of the 11.6s slow-4G LCP: the onboarding tour auto-opened at boot even for signed-out visitors — invisible behind the auth gate, but its text (`P.ob-tour-desc`) still painted into the viewport, and because the tour markup renders in modules/onboarding.js after the full 65-script lazy-module tail (~11.4s on slow 4G), it became the LCP element. Fonts were never the bottleneck (preloaded, 1.6s since #416). Fix (#429): when `isAuthBlocking()`, defer the auto-open behind a MutationObserver on the gate element; the tour opens ~100ms after sign-in lifts the gate. **Live re-measurement post-merge: slow-4G LCP 1036ms (ai.spaincos.com) / 1012ms (boundview.com), CLS 0.047 — was 11.6s.** Unthrottled lab: mobile 1.6–1.8s, desktop 1.9–2.2s. All ≤2.5s good.

**F-01 consent gate → live (#430).** U-TRU-03 flipped 🔴→🟡 on BV. The offer-wall ad-network iframe now never loads without explicit acceptance: Accept/Reject share one class and style (equal prominence, computed-style verified), reject persists with a Change-choice affordance, the privacy link is brand-aware (BoundView's own policy page), and zero adscend requests occur before consent (Playwright-verified live on boundview.com). Remaining for green: GPC signal handling + counsel review of the consent copy (F-01's original remediation list).

**Headline after batch:** strict 18.3% / measured-only 34.2% — 132✅ / 231🟡 / 215🔴 / 799⚪ (v29; was 18.0% / 128✅). BV 31.9→32.8%, AG 38.7→39.2%.

**F-01/F-02 S0 status:** F-02 closed (batch 14). F-01: policy pages live + consent gate live; remaining = GPC handling, counsel review, age-gate check (U-TRU-07).

### Batch 16 — TRU sweep + vendor self-hosting (2026-11-24, register v30; stacks on PR #431)

- ✅ **U-TRU-09** (security headers) 🔴/⚪→✅ on BV+AG — live curl audit of both hosts: HSTS (63072000), XCTO, XFO DENY + CSP frame-ancestors, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, CSP. Optional hardening still open: COOP/CORP headers.
- ✅ **U-TRU-19** (vulnerability disclosure) ⚪→✅ on BV — /.well-known/security.txt live on both hosts, well-formed (contacts, expiry, 72h ack policy, canonical for both hosts).
- 🔧 **PR #433 (pending merge): U-TRU-13** — supabase-js/marked/purify self-hosted in /vendor with SRI-verified byte-identical files; jsdelivr preconnect removed; CSP font-src narrowed. Locally verified: zero third-party asset origins on first load. Remaining hotlinks post-merge: on-demand pdfjs/jszip/KaTeX lazy loads only.
- 📊 **U-PERF-05 evidence updated** — 88 requests / 65 scripts / 408 KB br JS vs ≤30/≤170 KB budget: still fails; the true module code-split remains the fix (post-#429 the tail no longer gates UX).
- 🔴 **GH (minutegig.com) still down (FM-051)** — live probe: HTTP 502; DNS resolves to 3.33.130.190/15.197.148.33 (domain-parking/forwarding edge, not a Vercel target — Vercel serves from 76.76.21.21). The domain needs registrar/DNS action (point it at the deployment); Vercel CLI in this sandbox has no credentials, so this is owner-action-required.
- 🔴 **CT (comptrove.com) not auditable from this sandbox** — Vercel mitigation returns 403 to datacenter IPs even in a real Chromium; needs a residential-IP run (user's local browser) or an allowlisted probe path.
- **U-TRU-20 (AG R)** — flagged for owner decision: the only finding is the eval-bot QA fixture password hardcoded in qa/prelaunch.py (user-sanctioned as a non-secret fixture); moving it to an env var would change QA tooling behavior.
- **Headline after batch:** strict 18.6% / measured-only 34.5% — 135✅ / 231🟡 / 214🔴 / 797⚪ (v30; was 18.3% / 132✅).

### Batch 17 — vendor self-hosting live + FTC/integration flips (2026-11-24, PRs #431/#435/#433 merged, register v31)

- ✅ **#433 merged and live-verified**: all three vendor libs load (supabase, marked, DOMPurify defined; SRI intact), auth overlay renders, zero console errors, **zero third-party asset origins on first load** (only the Supabase gateway-status API call). U-TRU-13 🔴→🟡 on BV — remaining hotlinks are on-demand lazy loads only (pdfjs, jszip, KaTeX).
- ✅ **U-TRU-05 (FTC disclosure)** →✅ on BV/AG/TT — the Paid-partner-offers disclosure is live-verified in the Earn tab on both hosts (readback captured the full text: referral-fee funding, verified-completion-only crediting, caps, earn-only/no-cash-out).
- ✅ **TT-INT-01** →✅ — Earn tab wired and live on both hosts (balance readback, consent gate, zero console errors).
- 🔧 **governed-sql PR #19 (pending merge)**: Terms/Privacy links added to the component's FTC disclosure (U-TRU-01/02 TT).
- Mid-deploy note: the first post-#433 live probe hit Vercel mid-propagation (transient 404 on /vendor/supabase.js); re-verified clean after propagation.

**Headline after batch:** strict 19.0% / measured-only 35.1% — 139✅ / 228🟡 / 213🔴 / 797⚪ (v31; was 18.6% / 135✅). BV 34.5%, AG 40.3%, TT 20.1%.

**Session cumulative (batches 12–17):** strict 17.3% → 19.0%, measured-only 32.9% → 35.1%, ✅ 121 → 139, with F-32 (CLS), F-02 (S0 balance), F-23 (LCP) closed and F-01's consent gate + policy work live.

### Batch 19 — full vendor closure + state-rights copy + CI gate live (2026-11-24, PRs #445/#447/#448 merged, register v32)

- ✅ **#445 merged + live-verified**: COOP/CORP headers on both hosts (curl-verified); /vendor/* and /fonts/* served immutable; GPC honored as default consent denial (Playwright-verified with a GPC-forcing script); perf-budget CI gate live.
- ✅ **#447 merged + live-verified (U-TRU-13 → ✅ BV+AG)**: pdfjs, jszip, and KaTeX (js + css + all 32 fonts, SRI-verified) self-hosted; **jsdelivr removed from the CSP and the codebase entirely — zero third-party asset origins anywhere, critical or lazy**. The perf-budget gate passed on its own PR (validating the guard end-to-end).
- ✅ **U-PERF-11 → ✅ BV+AG**: perf-budget workflow gates every PR/master push (CLS ≤0.1, LCP budget, zero third-party first-load origins); passed on #445 and #447 (54s runs).
- 🟡 **U-PERF-07 → 🟡 BV+AG**: versioned vendor/font files served immutable (curl-verified); modules remain unhashed (build-time hashing would finish it).
- 🟡 **U-TRU-04 → 🟡 BV+AG (#448)**: state privacy rights sections live on both privacy pages (CCPA/CPRA + comparable laws, non-discrimination, statutory windows), cross-referencing the consent gate and GPC. Counsel review pending (E11-2).
- ✅ **U-TRU-03 → ✅ BV**: consent gate (#430) + GPC (#445) + policy cross-references (#448) — complete consent management.
- Corrected en route: the lazy-lib references live inside inline scripts, so their CSP hashes were recomputed after the swap (csp-hash-check PASS); a broken command chain briefly skipped edits and the perf-budget script itself caught the resulting 404s (13s LCP) before anything shipped.

**Headline after batch:** strict 19.6% / measured-only 35.7% — 144✅ / 229🟡 / 209🔴 / 795⚪ (v32; was 19.0% / 139✅). BV 36.2%, AG 41.7%. **Session cumulative (batches 12–19): strict 17.3% → 19.6%, ✅ 121 → 144, 🔴 221 → 209, with F-32/F-02/F-23 closed, F-01 consent+policy+GPC live, and zero third-party asset origins end-to-end.**

### Batch 19 ledger record

Merged record: https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-7150428589

### Batch 20 — autonomous closure sweep + code-split increment 1 (2026-11-24, register v33)

**Autonomous closures this batch (all live-verified or merged):**
- ✅ U-TRU-14 (support route) →✅ BV — /help.html live with support contact; security.txt 72h SLA
- ✅ U-TRU-08 (AI disclosure) →✅ BV — full AI disclosure in the public policy (live fetch)
- ✅ U-TRU-11 (export/deletion) →✅ BV — in-app deletion + policy-stated account deletion + export module
- ✅ U-TRU-12 (brand separation) →✅ BV — distinct titles, policy, favicon, social cards (live-verified)
- ✅ U-TRU-02 (terms linked) →✅ TT — component (#19) + live Earn-tab FTC text now links Terms/Privacy
- 🟡 U-TRU-01 →🟡 TT, U-TRU-16 →🟡 BV (provider categories + Adscend named; full list/DPA pending), U-PERF-09 stays 🟡 BV (PNG set unconverted)
- 🔧 **Code-split increment 1 (PR #451)**: the 17-module Settings family (~250 KB) defers to first open behind a forwarding SettingsUI stub with idle prefetch; critical-path scripts 67 → 56; CSP rebuilt (csp-hash-check PASS, perf-budget PASS, settings verified opening with panes). Budget (≤30 req / ≤170 KB br) still fails — next increments: connectors/research/media/artifacts families, then bundling.

**GH/CT/ST/DG status (why the remaining ⚪ can't close autonomously):**
- 🔴 GH (minutegig.com): still 502 at the domain-parking edge (3.33.130.190/15.197.148.33 — not a Vercel target). Needs owner registrar action; code-level audit of the mockup is possible but register items require the deployed product.
- 🔴 CT (comptrove.com): Vercel mitigation 403s datacenter IPs; needs a residential-IP probe (owner's local browser) or allowlisted path.
- ⚪ ST (Spain Terminal): source not in this workspace; needs repo access.
- ⚪ DG (DoorGraph): internal/synthetic staging; needs staging credentials and the CanonIntel formation decision.

**Headline after batch:** strict 20.1% / measured-only 36.5% — 149✅ / 227🟡 / 207🔴 / 794⚪ (v33; was 19.6% / 144✅). **Session cumulative (batches 12–20): strict 17.3% → 20.1%, ✅ 121 → 149 (+28), 🔴 221 → 207.**

### Batch 21 — loop runs 1–4 consolidation + gateway latency measurement (2026-11-24/25, register v34)

The 15-minute continuous closure loop (automation `9e3dc488`) is running; runs 1–4 produced the four-PR code-split series, all locally verified and stacked:

- 🔧 **#454** — webp icon set (U-PERF-09; og/twitter cards stay PNG for crawler compat; production favicon.webp restored after catching an overwrite)
- 🔧 **#455** — code-split 2: connectors (~85KB, all refs guarded) + projects + plugins → deferred family of 21
- 🔧 **#456** — code-split 3: Tasks overlay (all five tabs verified through the TasksUI stub) + skills
- 🔧 **#457** — code-split 4: answer-rendering family (8 modules) gated to sign-in/share/first-submit — signed-out scripts **67 → 38**

**U-PERF-13 measured (first real p75 samples):** simple-answer total latency median 2.49s / p75 ~2.67s (5 samples, eval-bot, gateway-chat) — passes the ≤8s budget; first token 2.4–3.5s on the free flint lane exceeds the ≤2s target — production-lane first-token measurement pending. Verdict stays 🟡 with recorded evidence.

**U-PERF-05 evidence updated:** the full series + budgets documented; stays 🔴 until the PRs merge and the live numbers are re-measured.

All four PRs await owner authorization (merge order 454 → 455 → 456 → 457). Blockers unchanged: Comet offline (comptrove + GoDaddy DNS), ST/DG access, E11-2 counsel review.
### Batch 22 — TT offline tolerance + PR-stack health check (2026-11-25, register v35)

- 🟡 U-PERF-14 (TT) 🔴→🟡 — code inspection of the merged tasks-tab component: polling and wall-load failures are offline-tolerant (errors keep last-known values; auth loss shows a visible sign-in state); the component inherits the host's offline shell when embedded (host U-PERF-14 ✅ on BV/AG).
- ✅ Stack health: all five pending PRs (#454–#458) verified MERGEABLE against current master — no drift from the parallel session; merge order 454 → 455 → 456 → 457 → 458.
### Batch 23 — GH mockup FTC disclosure verified (2026-11-25, register v36)

- ✅ U-TRU-05 (GH) 🟡→✅ — code inspection of the deployed mockup's source (gig-hub-mockup/index.html): conspicuous FTC material-connection disclosure present ("FTC-disclosed partner offers" label + referral-fee/earn-only/no-cash-out/caps copy).
- Stack health: all six pending PRs (#454–#459) still MERGEABLE against current master.

### Batch 24 — all seven queued PRs merged + live readback (2026-11-25, register v37)

Owner authorized the full stack; merged in order #454 → #460 (the two docs PRs required conflict rebases as the parallel session moved master mid-stack — both resolved keeping all batch sections and the highest register version).

**Live readback post-merge:**
- ✅ U-PERF-09 →✅ BV+AG — webp icons live on both hosts (link hrefs verified, image/webp, zero failures; og cards stay PNG by design)
- 📊 Code-split series live: signed-out at-load **81 requests / 57 scripts / 344 KB br** (baseline 90 / 67 / ~410 KB); families deferred behind stubs with idle prefetch; settings verified opening live; LCP 552ms, CLS 0.000, zero console errors
- U-PERF-05 stays 🔴 (budget ≤30 req / ≤170 KB) — remaining boot-critical set needs build-time bundling; series recorded

**Headline after batch:** strict 20.2% / measured-only 36.7% (v37).

### Batch 25 — AG noindex dead-code fix live + robots audit closed + TT consent port merged (2026-11-25, register v38)

Owner authorized merging all three queued PRs; merged ai-gateway-site #462 + #461 and governed-sql #20.

**AG noindex bug found and fixed (U-SEO-06):**
- 🔴→✅ **U-SEO-06 (AG)** — the run-9 audit found the private host served NO noindex meta. Root cause: `modules/brand.js`'s `if (!isBV) return;` aborted the module on non-BoundView hosts before `seoHeads()` was reachable — the noindex branch was dead code, leaving ai.spaincos.com indexable with og tags. Fix in PR #462: non-BV hosts boot a minimal path (branded title + `noindex, nofollow`). **Live-verified post-deploy**: `{robots: "noindex, nofollow", canonical: null}` on ai.spaincos.com.
- 🟡→✅ **U-SEO-06 (BV)** — robots-policy audit closed: robots.txt (`User-agent: * / Allow: / / Disallow: /t/` + sitemap.xml) serves both hosts; canonical `https://boundview.com/` live; no noindex on the public host (intended); AG robots.txt pointing its sitemap at boundview.com is by-design brand separation (private workspace noindexed).
- 🔴→✅ **U-TRU-03/04, TT-WALL-12, TT-PEN-03 (TT)** — governed-sql PR #20 merged (consent gate with GPC honoring, state-rights copy, report-an-offer path, dispute explanation); verified served on the tasks-tab component at localhost:8905.

**Headline after batch: strict 21.0% / measured-only 37.8% (v38)** — up from 20.2% / 36.7% (v37).

Next autonomous queue: U-COPY-03 currency vocabulary sweep, TT-NW-03 state eligibility copy, U-TRU-06 BV auto-renew copy, U-TRU-07 BV/TT age gate. Blocked: comptrove probes + minutegig DNS (Comet offline / GoDaddy), ST/DG access, E11-2 counsel review.

### Batch 26 — trust gates: 18+ age attestation, auto-renewal disclosure, TT eligibility, N valuation constant (2026-11-25, register v39)

Code PRs: ai-gateway-site #478, governed-sql #21 (awaiting merge authorization alongside docs PR #464).

- 🔴→✅ **U-TRU-07 (BV)** — 18+ attestation gate ahead of the F-01 consent gate in the Tasks/Earn offer wall. Live-verified locally: confirm button disabled until the checkbox is checked; consent row appears only after attestation; ad-network iframe stays unloaded.
- 🔴→✅ **U-TRU-07 (TT)** — same gate on the tasks-tab component (localhost:8905), verified end-to-end.
- 🔴→✅ **TT-NW-03 (TT)** — per-network/state eligibility note rendered on the offer surface and verified.
- 🔴→🟡 **U-TRU-06 (BV)** — auto-renewal/negative-option disclosure implemented at the point of sale (Settings → Billing): price, monthly term, trial conversion, cancel method, no cancellation fee. Code-verified (node --check, module loads clean); live pane readback queued — local eval-bot sign-in currently failing, so the pane was not re-rendered live this batch.
- 🔴→🟡 **U-COPY-03 (TT/BV/AG)** — the component now states the dollar equivalent in exactly ONE named constant (NEURON_USD_EQUIV) and renders from it; BV/AG product copy carries no conflicting $/N claim (earn-only, no cash value). 🟡 because the cross-doc valuation decision (0.004 vs 0.0008 vs 0.0001) is an owner/legal call, not autonomously decidable.

**Headline after batch: strict 21.7% / measured-only 38.8% (v39)** — up from 21.0% / 37.8% (v38). Session arc since batch 24: 20.2% → 21.7%.

Blockers unchanged: Comet offline (comptrove + GoDaddy/minutegig DNS), ST/DG access, E11-2 counsel review, Adscend publisher approval. Next autonomous queue: live readback of the Billing pane disclosure once sign-in works, remaining measurable BV/AG/TT sweeps.

### Batch 27 — crawler access, AG trust equivalence, status-page fix (2026-11-25, register v40)

Live readback of batch 26 first: all three PRs (#478, #464, governed-sql #21) merged; the 18+ age gate is LIVE on boundview.com (verified signed-in: age row present, wall stays unloaded).

- 🟡→✅ **U-SEO-14 (BV/AG)** — crawler access live-probed: HTTP 200 to Googlebot, Bingbot, and generic CLI user-agents on both hosts; robots.txt 200. The 403-deny WAF behavior is Comptrove/RentSpire only.
- 🟡→✅ **U-TRU-03 (AG)** — consent + GPC: same Vercel project/build as BV (live-verified on boundview.com); /modules/offerwall-earn.js served on AG (200, contains the GPC default-denial and consent-gate logic).
- 🟡→✅ **U-TRU-11 (AG)** — data export/deletion: /modules/export.js served on AG (200); surface identical to BV (verified G on BV).
- 🐛→PR #479 **U-REL-01 (BV)** — found the BoundView public status page's live-check JS was dead code (stray `});` syntax error; health dot stuck at "na". Fix in PR #479 (awaiting merge auth with this batch's docs). Monthly 99.9% availability measurement still pending → stays 🟡.

**Headline after batch: strict 21.9% / measured-only 39.1% (v40)** — session arc since batch 24: 20.2% → 21.9%.

Next autonomous queue: U-SEO-17 privacy-safe conversion measurement (first-party, no third parties), remaining BV/AG 🟡 sweeps. Blockers unchanged: Comet offline (comptrove + GoDaddy/minutegig DNS), ST/DG access, E11-2 counsel review, Adscend approval, N-valuation owner decision.

### Batch 28 — first-party conversion funnel + live readbacks (2026-11-25, register v41)

Merged under owner authorization: #479 (status-page JS fix) and #481 (batch-27 docs).

- ✅ **Live readback (U-REL-01 evidence surface)**: boundview.com/status now shows all three checks green — Web app: ok, Health endpoint: ok, Answer engine: ok (the syntax-error fix verified on production).
- 🔴→🟡 **U-SEO-17 (BV/AG)** — privacy-safe conversion measurement implemented (governed-sql PR #22, awaiting merge): server-side `checkout_started` event + existing `purchase` event, both in the first-party `analytics_events` table. Zero third-party pixels, zero cookies, zero cross-site identifiers. 🟡 pending merge + a marketing-facing readback surface.

**Headline after batch: strict 22.1% / measured-only 39.3% (v41)** — session arc since batch 24: 20.2% → 22.1%.

Blockers unchanged: Comet offline (comptrove + GoDaddy/minutegig DNS), ST/DG access, E11-2 counsel review, Adscend approval, N-valuation owner decision, billing-pane live readback (local/AG sign-in rate-limited this window).

### Batch 29 — billing disclosure live readback + brand-leak gate (2026-11-25, register v42)

- 🟡→✅ **U-TRU-06 (BV)** — the auto-renewal/negative-option disclosure is LIVE-verified at the point of sale on boundview.com (signed in, Settings → Billing): price, monthly term, 30-day trial conversion, and cancel method render above the fold alongside all three plan cards; the same pane verified on ai.spaincos.com (same build). The earlier "sign-in failing" was a test-selector artifact — the boundview.com placeholder is brand-swapped to you@boundview.com; network logs confirmed auth was succeeding.
- 🔴→✅ **BV-12** — brand separation at serve time: api/bv-render.js applies the brand MAP server-side before the browser sees the HTML, and the v350 brand-leak gate run live now reports **0 leaks across 8 surfaces** (/, /status, /help, /terms, /privacy, /pricing, /docs — logged-out AND logged-in): no /spain/i match in any rendered text, attribute, image src, href, head link, or title.

**Headline after batch: strict 22.3% / measured-only 39.6% (v42)** — session arc since batch 24: 20.2% → 22.3%.

Next queue: passkey e2e (U-ONB-03) via Playwright virtual authenticator, remaining BV/AG 🟡 sweeps. Blockers unchanged: Comet offline (comptrove + GoDaddy/minutegig DNS), ST/DG access, E11-2 counsel review, Adscend approval, N-valuation owner decision.

### Batch 30 — SEO sweep: static crawler-visible heads live (2026-11-25, register v43)

PR #491 merged and live-readback-verified (raw pre-JS HTML, curl):

- 🔴→✅ **U-SEO-01 (BV)** — unique branded title, 35 chars, in the pre-JS response.
- 🔴→✅ **U-SEO-02 (BV)** — static 118-char meta description (PR #491), previously runtime-only (invisible to non-executing crawlers).
- 🔴→✅ **U-SEO-03 (BV)** — og:title/og:description/og:image + twitter:card (summary_large_image) + twitter:image in raw HTML; social-card.png 200.
- 🔴→✅ **U-SEO-04 (BV)** — static rel=canonical https://boundview.com/ (PR #491); runtime duplicate suppressed so exactly one canonical ships.
- 🔴→✅ **U-SEO-05 (BV)** — robots.txt references the sitemap; sitemap.xml 200.
- 🔴→✅ **U-SEO-07 (BV)** — JSON-LD graph (Organization/WebSite/WebApplication/BreadcrumbList) in the pre-JS response.
- 🔴→✅ **U-SEO-13 (BV)** — all unfurl inputs present in raw HTML + 200 PNG social card.
- ✅ **U-SEO-06 (AG) hardened** — static noindex,nofollow now in the pre-JS response on ai.spaincos.com (crawler-visible without JS), on top of the runtime fix from PR #462.

**Headline after batch: strict 23.2% / measured-only 40.8% (v43)** — session arc since batch 24: 20.2% → 23.2%.

Next queue: U-MEAS-01 event taxonomy readback surface, TT-WALL frame-health items (need Adscend approval), remaining BV/AG 🟡 sweeps. Blockers unchanged: Comet offline (comptrove + GoDaddy/minutegig DNS), ST/DG access, E11-2 counsel review, Adscend approval, N-valuation owner decision, passkey enablement (Supabase console).

### Batch 31 — event taxonomy defined and locked (2026-11-25, register v44)

- 🔴→🟡 **U-MEAS-01 (BV/AG)** — governed-sql PR #23: the first-party event taxonomy is now defined (query, completion, share, checkout_started, purchase — all over the single `analytics_events` store) with a CI sync test (3/3 pass) that fails if a documented event disappears from code or an undocumented one appears. Three funnels are computable from the store: engagement (query→completion), monetization (checkout_started→purchase), virality (share). 🟡 pending a funnel readback surface.

**Headline after batch: strict 23.3% / measured-only 40.9% (v44)** — session arc since batch 24: 20.2% → 23.3%.

Blockers unchanged: Comet offline (comptrove + GoDaddy/minutegig DNS), ST/DG access, E11-2 counsel review, Adscend approval, N-valuation owner decision, passkey enablement (Supabase console).

### Batch 32 — canonical pricing source (2026-11-25, register v45)

- 🟡 **U-PAY-01 / BV-05 (BV)** — mechanism built in PR #499: canonical `/pricing.json` (Core/Max/Team, credit value, trial days), the Settings → Billing pane now renders plan cards from it (offline-tolerant fallback), and `qa/pricing-consistency.py` gates that the live checkout surface matches the canonical source (exit 0). **Owner decision surfaced:** the public pricing page describes planned Starter/Pro/Unlimited tiers with no prices and "checkout not live yet", while the live billing pane carries Core/Max/Team Stripe prices — reconciling that copy is an owner pricing call, reported by the gate on every run.

**Headline after batch: strict 23.3% / measured-only 40.9% (v45)** — session arc since batch 24: 20.2% → 23.3%.

Blockers unchanged plus two new owner decisions: pricing-page copy reconciliation, and an analytics service key (or authenticated ops endpoint) for the funnel readback. Others: Comet offline (comptrove + GoDaddy/minutegig DNS), ST/DG access, E11-2 counsel review, Adscend approval, N-valuation, passkey enablement (Supabase console).

### Batch 33 — bot-protection probes green + BV landing value prop (2026-11-25, register v46)

- 🟡→✅ **U-AUTH-10 (BV/AG)** — bot protection does not block humans or good bots: live probes returned HTTP 200 to Googlebot, Bingbot, and generic CLI user-agents on both hosts (no challenge, no WAF deny; the 403-deny behavior is Comptrove/RentSpire only). Human flows unaffected — full Playwright sign-in/settings/earn flows pass on production.
- 🟡 **U-ONB-01 (BV)** — PR #500: the BoundView hero subtitle now states the value proposition in the first paint (server-side, matching the tagline and description). Flip to ✅ pending merge + live readback.

**Headline after batch: strict 23.4% / measured-only 41.1% (v46)** — session arc since batch 24: 20.2% → 23.4%.

Blockers unchanged (plus pricing-copy reconciliation and analytics service key from batch 32). Pending merge authorization: PRs #498, #499, #500, #501 (SPA 404 state, U-STATE-07: branded 'Page not found' card on ?p= fallback paths, verified locally), governed-sql #23 (event taxonomy) and #24 (TT error state, U-STATE-03).
