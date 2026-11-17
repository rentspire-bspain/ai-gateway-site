# ai.spaincos.com / Boundview — Scale & Unit-Economics Model (v1, 2026-11-15)

**Owner directive (2026-11-15):** "I cannot lose money on usage from external parties and need to generate profits... extremely thorough and comprehensive and accurate on financial figures and margins." Every number below is either (a) verified live from a provider's API/docs today, or (b) explicitly labeled an estimate with its assumption. No hand-waving.

---

## 1. The verified cost basis (per-provider, per-token)

### OpenRouter (all paid lanes — verified from the live /api/v1/models endpoint, 2026-11-15)

| Lane (composer name) | OpenRouter model | Input $/Mtok | Output $/Mtok | Context | Cost per typical answer* |
|---|---|---|---|---|---|
| Default (Auto) | deepseek/deepseek-v4.1-flash-1017 | $0.02 | $0.108 | 1M | **$0.0001** |
| Kimi K3.1 Pro | moonshotai/kimi-k3.1-pro | $0.24 | $8.402 | 1M | $0.006–0.04 (reasoning-heavy) |
| DeepSeek R1 | deepseek/deepseek-r1-0528 | $0.50 | $2.15 | 164K | $0.003–0.01 |
| MiniMax M2 | minimax/minimax-m2.7 (live ID) | $0.21 | $0.84 | 197K | $0.001 |
| GPT-OSS 120B | openai/gpt-oss-120b | $0.15 | $0.60 | 131K | $0.0007 |
| GPT-OSS 20B | openai/gpt-oss-20b | $0.15 | $0.60 | 131K | $0.0005 |
| Llama 4 Maverick | meta-llama/llama-4-maverick | $0.35 | $1.00 | 524K | $0.001 |
| Llama 4 Scout | meta-llama/llama-4-scout | $0.25 | $0.80 | 524K | $0.0007 |
| Gemma 4 31B | google/gemma-4-31b-it (live ID) | $0.20 | $0.40 | 262K | $0.0004 |
| GLM 5.3 (Air) | z-ai/glm-5.3 (air ID not on OR) | $0.084 | $3.60 | 1M | $0.001–0.006 |
| Qwen3 Coder | qwen/qwen3-coder | $0.30 | $1.00 | 262K | $0.001 |
| Venice / Dolphin | cognitivecomputations/dolphin-mistral-24b-venice-edition | $0.20 | $0.50 | 32K | $0.0005 |

*Typical answer = ~2K input tokens (system prompt + context) + ~700 output tokens.

**Lane-ID drift found during this audit (fix queued):** `kimi-k3.1-flash`, `glm-5.3-air`, `minimax-m2` (exact), `gemma-4-31b` (non-it) are NOT current OpenRouter IDs — these lanes either route through the custom LiteLLM backend (owner hardware, $0 marginal) or will 404. MiniMax M2 has drifted to `minimax-m2.7`; Gemma to `gemma-4-31b-it`. Action: reconcile MODEL_OVERRIDES against the live catalog and add a lane-health probe to the nightly cycle.

### Free lanes (verified 2026-11-15)

| Lane | Provider | Limits | Effective daily capacity |
|---|---|---|---|
| Flint v1.0 | OpenRouter `:free` | 20 RPM; **50 req/day** (1,000/day once $10 lifetime credits) | 50 now → 1,000 after one $10 top-up |
| Qwen3.8-27B (summary) | Groq free | 30 RPM, 1K RPD, 8K TPM, **200K tokens/day** (org-pooled) | ~130–200 summary answers/day |
| Cloudflare Workers AI | CF free | 10K neurons/day | small aux calls |

**Critical scaling fact:** the free pools are **per-provider-account, shared across ALL users**. Every external free user draws from the same 50–1,000 OpenRouter free requests/day and the same 200K Groq tokens/day. Free external users must be hard-capped (see §5) or the shared pool dies within minutes of launch.

### Research lane (verified from Perplexity's published pricing, Nov 2026)

The research lane runs on the platform's Perplexity API key:
- Search API: $5.00 per 1,000 requests (**$0.005/request**), Fast Search $1/1K (**$0.001/request**); up to 5 queries per request = 1 billing unit
- Legacy Sonar-class answers: ~$0.006–0.008/request (request fee + tokens)
- **Modeled COGS per research-grounded answer: $0.002–0.008** (1–2 search units + the flash writer's $0.0001)

### Fixed infrastructure (monthly)

| Item | Cost | Notes |
|---|---|---|
| Supabase Pro (per project) | $25 | needed for boundview as its own project; removes edge-function invocation + resource ceilings |
| Groq Dev Tier | pay-per-token, no fixed fee | needed to lift the 200K TPD summary ceiling |
| OpenRouter | usage only | paid models have NO request cap |
| Domains/Cloudflare | ~$1–3 | existing |
| Owner Mac (LiteLLM open-weight lanes) | ~$5–10 electricity | $0 marginal per token |

---

## 2. The revenue side (verified from the live checkout function)

Current pricing (supabase/functions/checkout, live):

| Plan | Price | Credits granted | Face value (1 credit = $0.01) | Effective $/credit |
|---|---|---|---|---|
| Core | $8.00/mo | 2,500 | $25 | **$0.0032** |
| Max | $50.00/mo | 25,000 | $250 | **$0.0020** |

Credit tiers charged per answer (CREDIT_TIERS, live in gateway):

| Turn type | Credits | Face price | Verified COGS | Gross margin at face | Margin at Core $/cr | Margin at Max $/cr |
|---|---|---|---|---|---|---|
| Quick answer | 1 | $0.01 | $0.0001 | 99% | 97% | 95% |
| Search answer | 5 | $0.05 | $0.002–0.008 | 84–96% | 55–87% | 20–68% |
| Deep research | 50 | $0.50 | $0.01–0.05 | 90–98% | 84–94% | 80–96% |
| Agent turn | 100 | $1.00 | $0.02–0.10 | 90–98% | 94–97% | 90–96% |

**Margin reading (honest):** the thinnest case is search-tier usage on the Max plan — $50 revenue buys 5,000 search answers; at worst-case $0.008 COGS that is $40 COGS → ~20% margin. Three levers fix this (see §5): Fast Search for simple queries ($0.001/unit), tier-aware research depth, and price positioning. Every other combination runs 80–97% margin.

---

## 3. Bottom-up: one heavy user, one month

"Heavy usage daily" modeled as: 40 quick answers, 15 search answers, 2 deep-research reports, 1 agent turn per day.

| Component | Daily volume | COGS/day | Monthly COGS |
|---|---|---|---|
| Quick (flash writer) | 40 | $0.004 | $0.12 |
| Search (research lane + writer) | 15 | $0.03–0.12 | $0.90–3.60 |
| Deep research (Kimi Pro long-context) | 2 | $0.02–0.10 | $0.60–3.00 |
| Agent turn (tool loop, GLM/Kimi) | 1 | $0.02–0.10 | $0.60–3.00 |
| **Total per heavy user** | | **$0.07–0.32** | **$2.22–9.72** |

| Plan | Revenue/mo | COGS/mo (heavy) | Gross profit | Margin |
|---|---|---|---|---|
| Core ($8) | $8 | $2.22–9.72 | –$1.72 to +$5.78 | –21% to 72% |
| Max ($50) | $50 | $2.22–9.72 | $40.28–47.78 | 81–96% |

**Finding: the Core plan is break-even-to-lossy for a truly heavy user at worst-case research COGS.** Core's 2,500 credits only cover ~12 days of the heavy pattern above (500 search-class answers ≈ 2,500 credits), so most Core users self-cap — but the fix is structural: either raise Core to $12–15, cut Core's credit grant to 2,000, or route Core-tier research through Fast Search only. Max is solidly profitable at every usage mix.

---

## 4. Scale projections (the numbers that answer "can I not lose money")

Assumptions: 70% Core / 30% Max mix; average user = 30% of the heavy pattern; free users capped at 20 answers/day and served ONLY from free pools.

| Scale | MRR | Model COGS/mo | Infra/mo | Gross margin |
|---|---|---|---|---|
| 100 users | $710 | $70–300 | $50 (2 Supabase Pro) | 51–83% |
| 1,000 users | $7,100 | $700–3,000 | $75 | 57–90% |
| 10,000 users | $71,000 | $7,000–30,000 | $150–300 | 57–89% |

Break-even (infra + first $100 model spend): **~15–20 paying users.**

Worst-case stress (every user heavy, all research at $0.008): 10,000 users × $9.72 = $97K COGS vs $71K revenue → **negative**. That is the scenario to price against: enforce tier-aware research depth (Fast Search for search-tier turns), keep the monthly cap as circuit-breaker, and monitor per-user COGS (§5). At $0.002 fast-search COGS the same population costs $24K → 66% margin. **The single most important cost control is: cheap queries must use cheap search.**

---

## 5. The per-user attribution design ("no cap, with margins")

The owner directive: remove the global dollar cap; attribute usage and pricing to individual users with set margins. This is already 80% built:

1. **The credits ledger IS per-user attribution.** Every answer runs `credits_reserve` (before model work) → `credits_settle` (after, at actual cost) scoped to the user. A user cannot spend credits they don't have, and credits are prepaid — **model spend is revenue-backed by construction.**
2. **Done (call-model v234→v235, gateway-chat v234, deployed + live-verified 2026-11-15 late UTC):** global guardrails raised — MONTHLY_SPEND_CAP $20→$100→**$350** (the owner's personal ai.spaincos.com ceiling), DAILY_PAID_CALL_CAP 2,000→**50,000**. These act as circuit-breakers against a runaway loop or an attack, not as business limits.
3. **The no-cap safety pieces are now BUILT (not just designed):** (a) spend alerts — the gateway drops a `spend_alert` notification at 50%+ of the monthly cap (one per user per day); (b) per-user daily model-spend ceilings — every chargeable request from a non-exempt user checks the new `user_daily_spend` table BEFORE work starts (default $3/day, `DAILY_SPEND_CEILING_USD` env, owner + eval-bot exempt) and records the day's estimated cost; (c) per-call user attribution — every call-model request carries `x-user-id`, and both the `ops.llm_requests` ledger (new `user_id` column) and the gateway-meter objects attribute every paid call to its user, so per-user COGS vs revenue is directly queryable: `select user_id, sum(cost_usd) from ops.llm_requests where user_id is not null group by 1`. Owner-only next step: enable auto-top-up on the OpenRouter account so the balance never hits zero mid-day.

## 6. Free-tier design for boundview external users

- Free users get: flint + summary lanes ONLY (the $0 pools), 20 answers/day, no deep research, no agent turns, no artifacts beyond 1/day.
- One-time $10 OpenRouter credit purchase raises the shared flint pool 50→1,000/day — do this before launch.
- The v232 graceful-degradation path means even pool exhaustion returns honest guidance, never raw errors.
- Free-tier conversion lever: the first search-tier answer each day can sample the paid lane (COGS $0.005/user/day; at 1,000 free users = $5/day = acceptable marketing spend).

## 7. Auto-scale architecture (up/down with usage)

1. **Queue the heavy lanes (the build):** deep-research and agent turns route through the existing fleet-dispatch/research-jobs queue instead of the synchronous gateway call. This removes the observed 546 WORKER_RESOURCE_LIMIT and 150s idle-timeout failures under concurrency — the two walls we hit live at just 4 parallel heavy turns. Light turns (quick/search) stay synchronous for latency.
2. **Concurrency-based routing:** when active gateway requests exceed a threshold (Supabase provides queue depth), new deep/agent turns auto-queue; when idle, they run synchronously. One env flag, one gauge.
3. **Provider-level auto-failover (already live):** free-lane failure → other free model → honest notice. Add: OpenRouter 429 → retry-with-backoff → alternate provider (Groq paid) so paid lanes never hard-fail.
4. **Scale down = spend nothing:** every provider is usage-only; the only fixed costs are the Supabase plans — pause boundview's project if external usage is zero.

## 8. Boundview.com as its own project

- New Supabase project (Pro, $25/mo) with its own auth, its own `users`/`credits`/`usage` tables, its own edge functions (fork of gateway-chat + checkout with boundview branding and its own Stripe account or Stripe connect).
- The model/gateway layer can stay shared initially (the call-model token is a platform secret) — per-project keys mean boundview usage is metered separately from ai.spaincos.com.
- Own analytics: per-user COGS vs revenue report from the meter + credits ledger (§5.3).

## 9. Standing risks (tracked)

| Risk | Exposure | Mitigation |
|---|---|---|
| Shared free pools | free users exhaust flint/summary | per-user caps (§6), $10 OR top-up |
| Core plan worst case | –21% margin for heavy Core user | price/grant adjustment or fast-search routing (§3) |
| Edge resource limits under concurrency | 546s observed at 4 heavy parallel | queue heavy lanes (§7.1) |
| Lane-ID drift (4 lanes stale) | silent 404s | lane-health probe in nightly cycle (§1) |
| Research COGS variance | $0.001 vs $0.008/request | fast-search default for search tier |

---
*Sources: OpenRouter live models API (2026-11-15), OpenRouter pricing/limits docs, Groq free-tier limits (multiple trackers, Nov 2026), Perplexity pricing docs (Nov 2026), live site checkout function, live gateway CREDIT_TIERS. Estimates are labeled with their assumptions.*
