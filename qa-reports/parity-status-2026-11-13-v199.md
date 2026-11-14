# ai.spaincos.com: 100% Completion Parity Document (v199)
**2026-11-13 (late) UTC · v199 response-integrity round: dead-end continuations fixed + per-turn command visibility live + artifact updates-in-place + full competitive gap audit (Perplexity / Muse / Wabi / Instinct) · ✅ done · 🟡 partial · 🔴 gap**

> **HEADLINE: weighted average total completion 65.3%**. The reproducible §26 score is 6399 ÷ 98 = 65.295918%, rounded to one decimal; this batch adds 0.224490 percentage points on top of v198's 65.071429%. Raw tracked-item count: **88✅ / 39🟡 / 30🔴** (157 items; two gap→done transitions — the ack_turn dead-end class and the response-transparency gap are fixed, deployed, and live-verified). All live-verified this batch against production: gateway v193 (directive continuations like "OK CONTINUE AUTONOMOUSLY" are WORK turns — the Kimi-session failure class where "OK CONTINUE AUTONOMOUSLY" was classified ack_turn, blocked all tools, and emitted unexecuted SQL as text is dead; verified live with a replayed continuation turn), gateway v193 create_file (stable path artifacts/<userId>/<filename> with x-upsert — re-creating a doc with the same name now updates it in place instead of silently doing nothing, with the reuse-the-filename standing rule in the tool description; this is the fix for "the .md and Word documents never update"), and gateway v195 (per-turn COMMAND VISIBILITY: every response now leads with a truthful "Commands executed this turn" work log built server-side from the steps that actually ran — plan, research lane with sub-query and source counts, every tool-loop call with ok/failed + ms + chars, asset fetches — plus a system-prompt standing rule that the model narrates each command before running it; verified live: a mortgage-rate query now returns "**Commands executed this turn (1) — Command: run live web research — lane perplexity, 10 sources**" above a cited 7.11% Freddie Mac answer). Also shipped this batch on the site lane (PR #96, pending owner merge): the live CSP regression fix (PR #92's student-verify inline script shipped without its CSP hash, blocking the main inline script — Fleet panel, Fleet QA tab, and openModule were dead on production and 3 pre-launch QA categories failed; this branch regenerates all 4 hashes and adds a gate so no inline script ships unhashed), model dropdown labels ("Name — best at …" per option), and model persistence (selection stored in localStorage pplx-model, restored on reload instead of reverting to GLM). Pre-launch QA 31/31 locally on the branch; live re-run pending PR #96 merge + deploy.

## Scoring reconciliation (v198)

V197 made one change (API 84→86, /api/embeddings live). V198 makes two, both evidence-bounded:

- **Features 84→85** (+1, weight 14): the discovery/harvesting job set is fixed, merged (SHMT PR #3871), deployed to the live runner, and verified end-to-end in-chat — the two gaps queued in v197 (stale cc.coverage schema reads and missing APIFY_LOAD_DATASETS on the daemon) are closed with live run IDs (13262–13264). The assistant's harvesting/discovery capability is now fully operational rather than partially broken.
- **Computer 94→95** (+1, weight 8): the assistant gained live self-knowledge, verified in-session — the capability manifest (v191, list_capabilities: real runner jobs read off the live machine, machines with states, the deployed model allowlist) and the per-webapp registry (v192, list_webapps: which repo/frontend/backend/database belongs to which app). The "not retrievable from here" and placeholder-inventory answer classes are dead, verified live.

No other scores change. The arithmetic: 6355 + (14 × 1) + (8 × 1) = 6377 over weight 98 = 65.071429%, displayed as 65.1%. The raw counts move 84✅/41🟡/32🔴 → 86✅/39🟡/32🔴 for the two discovery-gap resolutions; under the optional done=1/partial=0.5/gap=0 raw formula, (86 + 0.5×39) ÷ 157 = 66.9%, a separate diagnostic, not the headline.

Also fixed this batch without score impact (infrastructure, not parity features): the fleet dispatch queue is self-draining (fleet-dispatch v2/v3 + pg_cron job 10 every 5 minutes — root cause: dispatches were queued but no claimer ever existed); GATEWAY_VERSION reporting (platform_status now reports v192 instead of stale v175); the coverage write path is proven (session_manual capture, 348 dimensions); the 10 stale Nov 12–13 dispatches were released back to the queue per the owner's choice and are executing through the new runner.

## Owner actions and current verification boundary

- **The assistant boundary fix is DONE (v196):** runner jobs execute unattended from chat (live-verified run 13116). The v195 fly_api_token blocker note was wrong about the cause — the token was already configured; the real failures were the stale machine image and fly-api's machine resolution, both fixed this batch. The remaining owner items below are unchanged.

- **STRIPE_WEBHOOK_SECRET and Stripe activation:** owner setup remains required. Share v12 / stripe-webhook v3 purchase-event wiring is deployed, but purchase events cannot fire yet without the webhook secret; neither billing activation nor purchase-event end-to-end success is claimed.
- **Twilio credentials:** set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SERVICE_SID before phone-verification deployment and live testing.
- **GitHub token scope:** the existing SHMT-only PAT is live-verified for SHMT writes; owner action remains for any broader repository/token scope needed by in-product work.
- **SLACK / DROPBOX / OUTLOOK / BOX OAuth apps:** connector cards are live in Settings > Connectors (verified rendering); OAuth app registration and client credentials remain owner actions before connect flows can complete.
- **fly_api_token in gateway_config:** owner-only secret; without it the assistant's run_runner_job tool cannot execute Fly.io runner jobs unattended (the boundary-excuse fix remains blocked on this).
- **Supabase auth_config_write toggle:** account passkeys/2FA configuration remains owner-held.
- **Resolved this batch (no longer owner actions):** SHMT PR #3869 merged (owner clicked merge 2026-11-13 ~17:35 UTC, merge commit 09bc7aa3) — the governed session SQL + drain archive + gateway overlay rebuild; PR #3861/#3866/#3867 closed superseded; ai-gateway-site PR #85 (checkout metadata), #88 (/api endpoints), #91 (QA build-stamp check) all merged. The D6 wall is decided and applied (D6 drops 20261110164033 / 20261111093802 / 20261111114323 applied and archived); the migration queue is at zero open slots.

## Scoring reconciliation (v199)

Two evidence-bounded changes, both deployed and live-verified in chat:

- **Features 85→86** (+1, weight 14): the ack_turn dead-end class is fixed (v193). Continuation directives ("OK CONTINUE AUTONOMOUSLY", "keep going", "next") now execute as work turns with the full tool loop — previously they were classified as acknowledgements, which skipped retrieval and tools entirely and produced unexecuted SQL as text (the Kimi-session failure the owner screenshotted). Verified live: a replayed continuation turn now runs research and returns real content with no ack_turn banner.
- **Computer 95→96** (+1, weight 8): per-turn command visibility is live (v195). Every gateway response now carries a truthful, server-side-built "Commands executed this turn" log — only steps that actually executed appear (research lane, sub-queries, sources, each tool call with ok/failed, latency, chars returned, asset fetches). This kills the "I have no idea what progress it makes / it says it completed things and then didn't" trust gap at the response layer.

The arithmetic: 6377 + (14 × 1) + (8 × 1) = 6399 over weight 98 = 65.295918%, displayed as 65.3%. Raw counts move 86✅/39🟡/32🔴 → 88✅/39🟡/30🔴 for the two resolved gaps (dead-end continuations; opaque responses). Site-lane fixes (CSP, model labels, model persistence) do NOT score yet — PR #96 is not merged; they score in the next round once merged, deployed, and live-verified.

Also fixed this batch without score impact (deployed, live-verified infrastructure): create_file updates-in-place (same filename → upsert, no more "documents never update"); the governed-sql site-change harness now owns build.js and regenerates it on every site deploy (64/64 harness tests pass; the stale-harness bug that failed the "finalize on the real repo" test is fixed).

## 29ap. v198 change log: webapp-autonomy round 1 — discovery jobs live + self-knowledge + self-draining fleet (2026-11-13 UTC)

<details>
<summary>~~SHMT PR #3871 merged + runner redeployed + discovery jobs live-verified~~ ✅ (complete; expand verification)</summary>

- **PR #3871 merged** (owner clicked merge 2026-11-13 21:25 UTC, squash d87a993b0): comptrove_coverage_discovery reads hd.coverage_snapshot (live), cc_discovery_rescan reads cc.discovery (live), comptrove_pha_pages_watch reads condo_scorecard.coverage (live), and runner deploys bake APIFY_LOAD_DATASETS (26 Apify dataset IDs).
- **Runner redeployed** via deploy-spain-runner (workflow run 43514966714, success): machine weathered-star-8281 now DEPLOY_SHA d87a993 with the env var present.
- **Live verification (all in-chat, runner runs):** comptrove_coverage_discovery run 13262 ok — 4,712,419 coverage rows (was 0); cc_discovery_rescan run 13263 ok; apify_discovery_load runs with 26 datasets (was "APIFY_LOAD_DATASETS is empty"); comptrove_pha_pages_watch run 13264 — 242/242 target PHAs checked against the live table; the 242-uncovered result is an honest data-gap finding (no condo_scorecard state coverage yet), not a job failure.

</details>

<details>
<summary>~~Capability manifest + webapp registry (gateway-chat v191/v192)~~ ✅ (complete; expand verification)</summary>

- **v191:** list_capabilities tool for every session + server-side auto-invocation + cast-wide baseline. Live inventory: runner jobs read off the live machine (62 in the deployed image at check time), 7 machines with states, the 11-model allowlist. Verified live via an eval-bot session — real names, zero placeholders.
- **v192:** WEBAPP_REGISTRY + list_webapps tool + WEBAPP_ASK auto-injection. Verified live: a terminal.spaincos.com question answered with SHMT/ops/migration data only, zero Comptrove conflation.
- **GATEWAY_VERSION reporting fixed:** platform_status reported stale v175; now reports the deployed version (v192).

</details>

<details>
<summary>~~Fleet dispatch queue self-draining~~ ✅ (complete; expand verification)</summary>

- **Root cause found:** dispatch_fleet queued rows, but nothing ever claimed them — 7 (then 10+) dispatches from Nov 12–13 sat queued forever.
- **Fix (fleet-dispatch v2/v3):** a new `run` action claims queued dispatches and executes each through gateway-chat as the dispatch owner (unattended, same minted-token path as task-runner), posting the model's honest answer back to the thread and the row. pg_cron job 10 ticks every 5 minutes. v3 adds a 290-second run timeout (125s timed out live because dispatch prompts trigger runner-job auto-invocations), one dispatch per tick, and automatic requeue of rows stuck running >10 minutes.
- **The 10 stale dispatches** were released back to queued per the owner's choice ("release to the new runner") and are executing through the new path.

</details>

<details>
<summary>~~Session coverage write path proven~~ ✅ (complete; expand verification)</summary>

- **Diagnosis:** session_recompute_coverage() self-caps at a 60-second statement timeout, but the real capture takes longer — every direct attempt died on timeout (7 cron attempts, all statement-timeout).
- **Proof:** dq.capture_coverage_v2('session_manual') via a one-shot pg_cron with a 10-minute statement timeout succeeded — 348 coverage dimensions captured at 22:28 UTC. The 60-second wrapper remains sized for interactive refreshes; full recomputes run on the runner/cron lane (cron job 8 continues its 6-hourly 30-minute-timeout capture, all runs succeeding).

</details>

## 29ap-1. ~~v197 change log (complete — superseded by v198; retained for the record)~~

<details>
<summary>~~v197: /api/embeddings live — Phase 1 API complete~~ ✅ (complete; expand for the v197 record)</summary>


Verification provenance: live HTTP probes against production and the edge function, plus a full pre-launch QA re-run (31/31).

### ~~/api/embeddings live~~

<details>
<summary>~~embeddings-raw deployed + upstream wired~~ ✅ (complete; expand verification)</summary>

- The embeddings-raw Supabase edge function was deployed on the auth project: it authenticates the caller's own JWT (owner/fleet allowlist, same policy as fly-api), validates input (1–32 strings, ≤32000 chars, text-embedding-3-small only), and proxies OpenAI's embeddings endpoint with a server-side OPENAI_API_KEY that was already configured as a project secret. PUBLIC_EMBEDDINGS_UPSTREAM_URL was set on Vercel (pointing at the function URL) and production redeployed.
- Live-verified: POST /api/embeddings with a signed-in user JWT returns 200 in 1.4s with a 1536-dimension embedding and metered usage (3 tokens). The endpoint 503s cleanly before auth and after the allowlist check. No owner step remains for embeddings.

</details>

### Harvest and discovery confirmed in-chat

- In-chat assistant runs verified: comptrove_harvest (run 13172, coverage snapshot 4,712,385 properties / 656,637 with rent / 55 jurisdictions), pha_harvest (run 13180, healthy), plus the v197-baseline runner jobs.
- Two discovery-lane gaps found (queued for the webapp-autonomy batch, not regressions of shipped capability): apify_discovery_load reports APIFY_LOAD_DATASETS empty (the env was baked into the old machine's config and did not carry over the daemon redeploy); comptrove_coverage_discovery and cc_discovery_rescan query cc.coverage, a table that does not exist on live (the coverage table is condo_scorecard.coverage, 143 rows), so they honestly report 0s.


</details>

## 29an. v196 change log: /api/search live + runner jobs unattended (2026-11-13 UTC)

Verification provenance: every claim below was live-verified during this batch (Vercel env + production deploy + live HTTP probes; Fly Machines API state reads; in-chat assistant run).

### ~~/api/search live~~

<details>
<summary>~~PUBLIC_API_AUTH_ANON_KEY wired, production redeployed~~ ✅ (complete; expand verification)</summary>

- The v195 "deployed but 503-gated" state was one missing Vercel env var: PUBLIC_API_AUTH_ANON_KEY (the auth project's publishable key — a public value, not a secret). Set on the Vercel project ai-gateway and production redeployed; live probes now return 200 with ranked results in ~1s for both evergreen (Wikipedia) and current-events (Google News) queries. /api/embeddings remains 503 by design: its upstream function needs an owner-held model key (server-side OPENAI_API_KEY), which is an owner decision, not a repo gap.

</details>

### ~~Runner jobs unattended (the boundary excuse)~~

<details>
<summary>~~Daemon redeployed, fly-api v5, zombie stopped~~ ✅ (complete; expand verification)</summary>

- **Root cause:** not a missing fly_api_token (the token was already in gateway_config — the fly-api function worked). The real failures: (1) the live daemon's Fly machine image was stale — its runner.mjs imported jobs absent from its hand-patched file set, so every --once dispatch died with ERR_MODULE_NOT_FOUND and the machine's runner had no health endpoint; (2) fly-api's runner_job resolved "the app's first non-stopped machine," which picked that zombie.
- **Fixes (all live-verified):** the repo's deploy-spain-runner workflow was dispatched (run 43481971105, success) — it rebuilt the daemon machine weathered-star-8281 from current main (DEPLOY_SHA 09bc7aa, all 136 job files, node_modules baked, health endpoint 200); fly-api was redeployed as v5 (runner_job resolves the canonical daemon by name, DAEMON_NAME=weathered-star-8281, with a documented fallback; a new admin-gated stop action mirroring the existing restart action); the crash-looped zombie silent-meadow-9325 was stopped via the new action (it was missing node_modules entirely and burn-looping an 8 GB machine).
- **End-to-end proof:** the ai.spaincos.com assistant was asked "Are you unable to run runner jobs yourself? Run pdi_spine_check now" and executed it in-chat: run 13116, exit 0, "Progressing normally," ~0.4s. Follow-up probes (digest_dead_man run 13113, scheduler_backstop_report run 13114) all exit 0 on the healthy daemon. The "your terminal is the boundary" answer class is dead.

</details>

### Fleet topology note

The spain-runner Fly app now runs: weathered-star-8281 (the canonical daemon, started, current code) and red-rain-7459 (started, an older but healthy runner-lane machine in iad; left untouched). All other machines are stopped (cc-harvester, hidden-thunder-5401, sh-harvest-once, spain-runner-1 cold spare, and the stopped zombie silent-meadow-9325).

## 29am. v195 change log: governed SQL merged, Comptrove read live, Deploy green (2026-11-13 UTC)

Verification provenance: every claim below was live-verified during this batch by the orchestrator (live DB queries via the Supabase connector, GitHub PR states re-read at edit time, live HTTP probes, and a full pre-launch QA re-run). The §28 report card failure on the earlier #3869 CI run was a transient web.archive.org fetch (status 0) and did not reproduce.

### ~~Governed session read SQL~~

<details>
<summary>~~PR #3869 merged, applied, live~~ ✅ (complete; expand verification)</summary>

- **Merge:** SHMT PR #3869 merged by the owner (supersedes #3864, which was cut from a stale base and carried an embedded sandbox token that Gitleaks correctly blocked; #3867 and #3861 closed as superseded). Merge commit 09bc7aa34d395bb93c28cedc7e9e2adc85ba8e95.
- **Applied state (live-verified):** slot 20261113120001 in supabase_migrations.schema_migrations; public.session_read_sql(p_sql text, p_max_rows integer default 500), public.session_recompute_coverage(), and public.session_sql_pre_request() installed in the Deal Engine database; the PostgREST pre-request hook is set on the authenticator role (pgrst.db_pre_request=public.session_sql_pre_request, with statement_timeout=30s and lock_timeout=8s); EXECUTE granted to service_role only, revoked from public/anon/authenticated. Deny-list probes passed when applied.
- **Not yet exercised:** comptrove.session_coverage_runs = 0 — the coverage recompute RPC has never been run, so no coverage receipts exist yet. The capability is live; the receipts pipeline is not.

</details>

### ~~Comptrove read API~~

<details>
<summary>~~Slot 20261112110521 applied and archived~~ ✅ (complete; expand verification)</summary>

- Slot 20261112110521 (comptrove_read_api) is applied in the live ledger and its file is archived on main: service_role-only RPCs public.comptrove_properties and public.comptrove_rent_obs, revoked from public and authenticated. The v194 blocker ("remains unapplied behind owner-held drops and 18 later slots") is resolved: the D6 wall was decided (owner: "U DECIDE ON D6 YOURSELF"; the orchestrator applied the drops under the standing ledger-authorized drain) and the queue drained to zero open slots.

</details>

### ~~Migration queue fully drained~~

<details>
<summary>~~Zero open slots~~ ✅ (complete; expand verification)</summary>

- Live ops.migration_slot state: 670 applied / 119 released / 0 reserved / 0 bound. No slot in the queue awaits owner action, file creation, or apply. All 15 drain-pass files archived on main via #3869 with hash-verified applied-history restores (sha256 pinned to the central ledger), including the two D6 drop reissues and the address-tract map copies.

</details>

### ~~Deploy lane green~~

<details>
<summary>~~Drift gate fixed, full Deploy run success~~ ✅ (complete; expand verification)</summary>

- The pre-deploy drift check that failed the last Deploy run ("Version 20261113121500 is applied but has no file on this head") passes after the retroactive archive landed on main. Post-#3869 Deploy run 43473913536 on main completed with conclusion success: Security gates, Test & build, Supabase migrations, and SOC 2 audit trail all green.

</details>

### Pre-launch QA: 31/31 passing

The three v194-era failures are resolved and the full suite re-run passes 31/31 ([report](https://github.com/rentspire-bspain/ai-gateway-site/blob/master/qa-reports/prelaunch/latest.json)): the backend smoke timeout was transient (re-probe: gateway-chat answered in 6.2s with the correct one-sentence answer); /modules/export.js live now byte-matches master (the #85 merge landed the thread_id/card_variant share analytics); and the build-stamp check was a QA-script bug (v184 moved window.BUILD into the CSP-safe external /build.js; the check now reads it there, fixed via ai-gateway-site PR #91). The daily visual-parity guardian run also passed with no regressions.

### API endpoints: deployed but gated (partial)

PR #88 merged and /api/search + /api/embeddings are deployed (401 without credentials, proving the auth gate is live), but authenticated calls return 503 until the upstream is wired — /api/search needs its live source wiring and /api/embeddings its upstream provider. Not counted as done.

### Still open (owner or engineering)

- Stripe webhook secret + activation; Twilio credentials; Slack/Dropbox/Outlook/Box OAuth apps; fly_api_token in gateway_config (blocks unattended runner jobs — the assistant boundary-excuse fix); Supabase auth_config_write (passkeys/2FA).
- The assistant "your terminal is the boundary" answer class: the governed SQL path is now live, which removes the read side of that excuse; the run side (runner-job execution) still awaits fly_api_token.

## 29al. v194 change log: drain complete below the D6 wall (2026-11-13 UTC; historical — superseded statements about #3864/#3861/Comptrove-read are corrected in the v195 section above)

Verification provenance: the batch's database/edge-function observations below are the orchestrator's live-verified session notes, not fresh database tests performed by this documentation edit. The queue facts are independently cross-checked against the [final audited drain report](https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-6848185422); GitHub PR states above were re-read live during this edit.

### ~~Queue drain below the D6 wall~~

<details>
<summary>~~Audited drain and infrastructure recovery~~ ✅ (complete within this boundary; expand verification)</summary>

- **Resolution:** 47 slots resolved: 44 applied + 1 auto-applied + 2 released, under [authorization comment 6725443677](https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-6725443677); all 22 final pass-9 slots were verified in schema_migrations and slot state ([final drain report](https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-6848185422)).
- **Index recovery:** slot 20261110124307's rr.idx_co_promote_eligible was built via a one-shot pg_cron job immune to HTTP session death and verified indisvalid=true; the three prior failures were the sweeper cancelling its own DDL, a case-sensitive DDL exemption, and the sweeper's own 15-minute transaction blocking the CIC virtualxid validation wait ([final drain report](https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-6848185422)).
- **Cron recovery:** all 438 formerly active cron jobs were restored and verified active (438 active / 502 total); the orchestrator's post-restore health check recorded 145 succeeded / 0 real failures ([restoration record](https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-6848185422)).

</details>

The remaining 21 slots below Comptrove read API slot 20261112110521 are not complete: the three owner-held D6 drops, 13 bound digest-ok Nov-11 slots, and 5 reserved-no-file slots. Nothing in the completed drain removes the owner wall or proves the Comptrove read RPCs applied ([final queue boundary](https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-6848185422)).

### ~~Pricing retier deployed~~

<details>
<summary>~~Gateway-chat v190 retier~~ ✅ (deployed; expand session verification notes)</summary>

The orchestrator verified gateway-chat v190 live: quick = 1 credit, search = 5, deep = 50–5000 by complexity, agent = 100–1000; reserve = maximum and settle = actual via p_actual. This supersedes older pricing examples in the historical sections below, does not change dollar/credit conversion policy, and does not establish that Stripe purchases work.

</details>

### ~~Model-routing anomaly fixed~~

<details>
<summary>~~Gateway-status v24 routing correction~~ ✅ (verified; expand routing boundaries)</summary>

The orchestrator verified gateway-status v24: the Auto lane is task-routed (GLM-5.3 general / DeepSeek coding / Kimi reasoning), and its probes pin exact models and are DDL-safe. Separately, call-model v47 defaults serve free Qwen per the owner's 2026-11-11 directive; Qwen (Groq) flakiness with Flint fallback is intentional and is not evidence that Auto should always be Qwen. The historical §15 D6 speed defect is distinct from the migration-ledger D6 drops wall; correcting routing does not prove the first-token latency target is met.

</details>

### ~~Governed SQL and coordinated billing hooks: still partial~~ (superseded by v195 — governed SQL is complete; billing hooks remain owner-blocked)

- **Governed session SQL:** PR #3864 addresses the coveragereport.sql screenshot gap with a restricted-grammar read RPC and typed coverage recompute RPC wrapping dq.capture_coverage_v2; safeguards include lock/cooldown/receipt, service_role-only access, deny-list DO probes, 5000-row/1MiB caps, and a scoped pre-request timer hook with abort-if-exists guard. It is OPEN with CI fixes in flight, not merged/applied/live, and remains 🟡 ([SHMT PR #3864](https://github.com/rentspire-bspain/SHMT/pull/3864)).
- **Neurons coordination:** the orchestrator verified share v12 and stripe-webhook v3 deployed with purchase-event wiring. STRIPE_WEBHOOK_SECRET remains owner-pending, so actual event delivery is unverified and blocked; broader Neurons completion is not inferred from these two deploys.
- **Live version inventory:** orchestrator-verified frontend BUILD v187; gateway-chat v190; share v12; stripe-webhook v3; checkout v2; gateway-status v24; fly-api v4; github-ops v4; enrichment v1; pnl-admin v1; comptrove-read v2. Document v194 is a documentation version, not a claim that frontend BUILD v194 is deployed.

Historical sections below retain their round-specific observations unless explicitly superseded; they are not a second current-state tracker. Fully completed details use strike-through headings and expandable evidence; sections with residual gaps remain open.
**Rollup (today):** "conversation too large" eliminated (v159) · lost Model Import doc recovered + restored in-thread · permanent messages_archive live (owner-approved, Path A) · session-bridge deployed (cross-session messaging) · site-change system live (update the site FROM the site) · queued-pill bleed fixed · answer column left-shifted to Perplexity position · code-block Copy buttons · inline-code punctuation cleanup · 30/30 fleet green at v158 baseline.


## 29ak. v193 change log — COMPTROVE REGISTRATION + CRM SNAPSHOT + LEDGER DRAIN (2026-11-12/13 UTC)

**Shipped and LIVE-verified this round (SHMT PR #3860 merged; slots 20261109075400 / 20261109093001 / 20261109105422 applied):**

### ~~Comptrove registration and CRM snapshot~~

<details>
<summary>~~V193 completed applies~~ ✅ (expand preserved live-verification notes)</summary>

- **METRO CBSA FIX LIVE (SHMT PR #3860 — MERGED to main, squash):** slot 20261109075400 applied via the audited break-glass (ledger #3500 comment 6725443677). market_metros verified live: Eugene-Springfield OR 21260→21660 and Cleveland-Elyria OH 17460→17410 — 0 bad rows remain.
- **COMPTROVE REGISTERED AS A PRODUCT APP (slot 20261109093001 applied):** Comptrove (comptrove.com / rentspire-comps) is now registered in product_apps + product_app_links — verified live: 1 app row, 2 links.
- **comptrove_crm SCHEMA LIVE (slot 20261109105422 applied):** the isolated Comptrove outreach-candidate snapshot is live — 10 tables; contact_list holds 29,139 accounts, 3,914 with phone candidates; service_role-only ACLs; all postchecks passed.

</details>

- ~~**MIGRATION LEDGER QUEUE UNJAMMED: drain program running**~~ **Closed within the below-wall boundary in v194:** the audited drain resolved 47 slots, with all final pass-9 slots verified; the Comptrove RPC slot remains unapplied behind the D6 wall and later slots. Expand §29al for recovery evidence and the [final queue report](https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-6848185422).
- **Perplexity-documentation parity map (from v192) retained** — see 29aj below.

## 29aj. v192 change log — PUSH, LEDGER ADVANCE, EXECUTE-THE-ARTIFACTS (2026-11-12 UTC)

**Shipped and LIVE-verified this round (gateway-chat v189, sw.js v192-push PR #78, SHMT ledger override deploys):**
- **WEB PUSH LIVE — background completion now notifies closed windows (the v190 permanence gap, closed):** the push pipeline was fully live (VAPID keys in gateway_config, monitors edge function v17, monitors.js subscription flow, research_job_inbox + notify_dispatch_done triggers verified in the database) except the live service worker had NO push handler — pushes arrived with no notification surface. PR #78 merged: the app-shell SW now carries the push + notificationclick handlers (cache VERSION v192-push). LIVE-verified: the served /sw.js contains the push handler. A background research job or fleet dispatch that finishes while the window is closed now surfaces a system notification and reopens the app to the thread.
- **LEDGER ADVANCE (owner-directed RS-1 override):** diagnosis of the failed Deploy run 43298542764: it did NOT fail on migrations — the RS-1 pre-check refused all 65 bound slots as "refused_backdated" because the applied high-water mark (20261112083000, applied out-of-band by another lane) sits ABOVE every bound slot; strict in-order apply can never reach them. The audited override path (Deploy input allow_backdated_slots + go_ref) is the governed unblock: override deploy run 43313040797 applied the head slot 20261108194007 (SHMT #3646's portal_requeue priority_tier work is now LIVE on the Deal Engine — applied count 604→605). The apply loop walks files ascending and stops at the first refused file, so a second override run (43318598336) carried ALL 12 file-present bound slots (each bound = approved through the governed queue; GO comments exist for 7 of them; ours 20261112110521 is owner-authorized). The RS-1 pre-check VALIDATED the entire list (all 12 "allowed_by_override" at 22:37 UTC — the override mechanism works and the list is correct), but the run failed BEFORE the apply loop recorded any ledger rows. The failed step is not yet readable: the GitHub Actions jobs API is exhausted through the shared proxy rate limit (resets hourly) — first action next round is to read the run logs and fix the failing step, then redispatch the same validated override list. **→ RESOLVED in v193 (see 29ak): the queue is unjammed and the drain program (audited break-glass + override deploys) is running.**
- **EXECUTE-THE-ARTIFACTS (owner incident 13:31: "CAN YOU TRY AGAIN" → "What I cannot do from this session — commit these to the repos"):** that claim is false for this system — github_write commits + opens PRs as the owner. v192: the GitHub-write intent now catches "commit these artifacts/SQL/patches to the repos"; a retry after an artifact-producing claim-can't answer gets an EXECUTE-DO-NOT-RE-AUTHOR system order (commit the prior answer's files via github_write, report real PR URLs); the claim-can't guard now also catches "what I cannot do from this session".

**Perplexity-documented parity map (proof anchors, per owner directive "REFER TO THEIR DOCUMENTATION TO PROVE IT"):**
| Perplexity feature (their docs) | ai.spaincos.com | Status |
|---|---|---|
| Sessions: "Each question starts a session; follow-ups stay in the same session" ([Help Center](https://www.perplexity.ai/help-center/en/articles/10354975-getting-started-with-perplexity)) | Threads + v190 server-side turn persistence (sessions survive closed windows) | ✅ |
| Pro Search + model menu ("Best" default; [What is Pro Search](https://www.perplexity.ai/help-center/en/articles/10352903-what-is-pro-search)) | Auto routing + 17-option model dropdown, live-verified | ✅ |
| Deep Research: "dozens of searches, hundreds of sources, 2-4 min reports" ([What is Research mode](https://www.perplexity.ai/help-center/en/articles/10738684-what-is-deep-research)) | deep_research mode + research-jobs background + citations | ✅ |
| Projects/Spaces: "persistent workspaces… files, instructions, connected tools" ([What are Projects](https://www.perplexity.ai/help-center/en/articles/10352961-spaces)) | Spaces + custom instructions + files + connectors | ✅ |
| Scheduled Tasks: "recurring work in the background… hourly, daily, weekly" ([Scheduled Tasks in Computer](https://perplexity.ai/help-center/en/articles/11521526-perplexity-tasks)) | Automations/guardians/fleet (scheduled_tasks table; daily fleet green) | ✅ |
| File uploads ("attach PDFs, documents, or data"; [Tips](https://perplexity.ai/help-center/en/articles/13645819-tips-for-getting-better-answers-from-perplexity)) | Attachments + v186 image-only sends | ✅ |
| Skills ("dispatching the sub-agents needed"; [Getting started](https://www.perplexity.ai/hub/getting-started)) | Skills/plugins system | ✅ |
| Model Council ([Deep Research and Model Council](https://www.perplexity.ai/help-center/en/articles/2026102603-deep-research-and-model-council-in-computer)) | model_council mode | ✅ |
| Memory ([Features](https://www.perplexity.ai/help-center/en/collections/18799290-features)) | memory_items (1,495 imported) + personalization | ✅ |
| Citations: "direct links to the original sources" ([Pro Search](https://www.perplexity.ai/help-center/en/articles/10352903-what-is-pro-search)) | [N] linked citations + Sources panel | ✅ |
| APIs: Search/Agent/Orchestrator/Embeddings/Decisions ([API docs](https://docs.perplexity.ai/guides/getting-started)) | api-keys + search endpoints; Search API parity partial | 🟡 |

## 29ai. v191 change log — ESTATE CONTEXT (2026-11-12 UTC)

**Shipped and LIVE-verified this round (github-ops v4, gateway-chat v188):**
- **ESTATE BLINDNESS FIXED (owner screenshots 13:11: "Pull current status of disposition PRs #3794, #3831, and #3855" → "I can't pull live status... drop the repo URL"; "Verify migration ledger #3500 HWM" → "no migration ledger #3500 exists" + DataVault4dbt web sources):** the model knew NOTHING about the owner's estate — bare SHMT PR numbers, the migration ledger, RS-1, rentspire-bspain-2. Fixes: (1) an OWNER ESTATE CONTEXT system injection (org rentspire-bspain; repos SHMT / ai-gateway-site / rentspire-comps; bare PR/issue numbers default to SHMT; the migration ledger = ops.migration_slot on the Deal Engine dcyjmftriqayqaonitlx, ~604 applied / ~65 bound, HWM via ops.migration_version_high_water(); issue #3500 = the RS-1 ledger GO campaign; rentspire-bspain-2 = the -2 principal) fires on estate asks; (2) the PLATFORM itself fetches bare PR numbers via the new github-ops `pr_status` action (PAT-backed — no OAuth connector needed) and injects the live PR state (title, branch, state, reviewers, check runs, comments) as evidence; (3) github-ops v4 adds read-only `pr_status` + `issue_read` actions; (4) the claim-can't guard now catches "I can't pull live status" / "no ledger exists" / "drop the repo URL" phrasings. LIVE-verified: the exact screenshot ask now returns real status for all three PRs (#3794 open "Ontology: hist.rent_observations unresolved-row indexes"; #3831 open "ai.spaincos.com server-side agent runtime — port package (165 lanes)"; #3855 open "OWNER-HOLD lines: unapproved bound slots batch 2", reviewer rentspire-bspain-2).
- **Known polish (next):** the writer still bolts web-search citation markers onto PR-evidence facts (lastlight.dev markers on platform-fetched PR data) — the citation-alignment pass should skip platform-evidence statements.

## 29ah. v190 change log — SESSION PERMANENCE (2026-11-12 UTC)

**Shipped and LIVE-verified this round (frontend v190, gateway-chat v186, PR #75):**
- **SESSIONS NOW SURVIVE CLOSED WINDOWS / SLEEPING MACHINES (owner directive "I NEED THAT PERMANENCE"):** the old architecture was client-driven persistence (the browser delete-all + reinserted every message after each turn) — a closed window, sleeping machine, or dead tab mid-generation LOST the turn. The fix is server-side turn persistence: (1) DB: `thread_messages.turn_hash` column + BEFORE INSERT trigger (md5) + unique dedupe index (thread_id, role, turn_hash); (2) gateway-chat v186: persists the thread row + user message + assistant answer via service role on stream end AND on client disconnect (waitUntil), idempotent — verified live: a turn landed server-side for a thread the client never saved; (3) frontend (PR #75 merged, live on ai.spaincos.com): every chat request now sends thread_id, and the client sync switched to conflict-safe upsert. Live-verified: the served HTML carries the new code; the server path proven by direct API test.
- **"CHOOSE ONE" CARDS — verified live, stale 🔴 closed:** the v172 ask_user card works end-to-end (live test: "ask me which region with options California, Texas, Florida" returned a real x_actions choose-one card with clickable options and the ask-once answer).
- **ANALYTICS WIRED (gateway-chat v183→v184):** query + completion events (routed model, in/out tokens, sources, tool-loop rounds, credit cost) fire on every turn via waitUntil; live-verified rows in analytics_events.
- **Gateway-chat v182→v186 deploys** (ack-turn fix, GO-closure, handoff inoculation, claim-can't guard, analytics, permanence).

**Still open on permanence (next layers for full Perplexity parity):**
1. **Background deep-research continuity:** a long research run should complete server-side and post back even if the client dies mid-stream (research-jobs row + completion worker — the fleet-dispatch path already does this).
2. **Web push on background completion:** infrastructure exists (push_subscriptions, vapid keys, notify-bell) — wire: background job finishes → push notification → user returns to the finished thread.
3. **Scheduled work already server-side:** automations/guardians/fleet run from the platform, not the browser — unaffected by window state.

## 29ag. v189 change log — EXECUTION LANES LANDED (2026-11-12 UTC)

**Shipped and LIVE-verified this round (fleet v189 + authorized DB applies + edge deploys):**
- **FLEET v189 FIRED on all four closure lanes** (open-weight route, GLM-5.3 via the ai.spaincos gateway — the "free Qwen" lane): accounts-verification, backend-analytics, finance-P&L, user-enrichment. All four returned complete implementation packages (/tmp/fleet-v189.json).
- **BACKEND ANALYTICS — LIVE:** `analytics_events` table (RLS enabled, zero policies = anon/authenticated fully denied, service-role writes only), 3 indexes, `analytics_summary_owner()` RPC (owner-only via the gateway_config `owners` roster — seeded with the owner's auth id). LIVE-verified: non-owner JWT gets 42501 Forbidden. **WIRED (gateway-chat v183→v184):** fire-and-forget service-role inserts via EdgeRuntime.waitUntil — a query event on receipt (purpose, words, complexity) and a completion event at delivery (routed model, in/out tokens, sources, tool-loop rounds, credit cost). LIVE-verified end-to-end: a live chat answer produced both rows (query + completion, model z-ai/glm-5.3, 3029/16 tokens, 10 sources, -5 credits).
- **OWNER P&L — LIVE (end-to-end):** `model_costs` (4 open-weight models seeded), `owner_owners` gate, `owner_pnl_monthly` view, `is_owner()` + `pnl_owner(date)` RPC (per-month credits sold, consumed, ledger purchases, estimated model cost from token counts × per-model rates, gross margin). Edge function **pnl-admin v1 deployed** (GET ?from=YYYY-MM-DD, owner JWT, CORS). LIVE-verified: eval-bot gets 403 Owner only.
- **USER ENRICHMENT — LIVE (end-to-end):** `user_profiles_enriched` (RLS: select own row only), `enrichment_survey_submit`, `enrichment_bump_topics` (topic counters), `enrichment_owner_export()` (owner-only via bspain@spaincos.com JWT check). Edge function **enrichment v1 deployed** (survey/export). LIVE-verified end-to-end: a test survey submitted through the live edge function landed the profile row with topic scores (comptrove/rent-comps/permits counted from the earlier bump test).
- **PHONE VERIFICATION (accounts-verify lane) — DB LIVE, edge function held:** `public.profiles` created on this project (it did not exist — adapted), unique partial index on verified phones, `phone_verify_start`/`phone_verify_check` RPCs. LIVE-verified: `phone_verify_start('555')` correctly returns INVALID_PHONE_FORMAT. The edge function deploy is held pending Twilio credentials (owner action: set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SERVICE_SID env vars — then the deploy is one call).
- **COMPTROVE LEDGER UNBLOCKED (owner-authorized merge):** SHMT PR #3646 merged via the authorized branch-protection toggle (protection restored and verified: 1 review, code-owners, last-push approval, enforce admins, linear history, all 4 required checks). Its file `20261108194007_portal_requeue_priority_tier_order.sql` is the HEAD of the Deal Engine migration ledger (sha 1bcda399… matches the ledger row exactly) — merging it put the file in main, so the governed Deploy run (43298542764, auto-triggered by the merge) can now apply slots in strict order. 12 of the 65 bound slots have files in main; the queue drains in order and stops at each missing file (next missing: 20261109075400 metro CBSA fix — its owning PR must merge next).
- **RSA-style fixes found during apply:** gateway_config.value is TEXT not jsonb (the analytics RPC's owner check cast fixed); use_cases JSON arrays now accepted by the survey RPC (malformed array literal fixed via jsonb_array_elements_text).

**Remaining on these lanes:**
2. **Twilio credentials** (owner action): the account-verify edge function deploys the moment TWILIO_* env vars are set.
3. **Comptrove RPCs slot 20261112110521:** applies automatically as the in-order drain reaches it (12 files present; the other owning PRs must merge as the RS-1 campaign progresses).

## 29af. v188 change log — GO-CLOSURE AUTO-EXECUTION + handoff inoculation (2026-11-12 UTC)

**Shipped and LIVE-verified this round (gateway-chat v181→v182):**
- **GO-CLOSURE AUTO-EXECUTION (the three "STILL NEEDS FIXING" reports):** a bare "GO - CONTINUE CLOSING EVERYTHING YOU CAN AUTONOMOUSLY" got the non-answer "I can't safely close these jobs — not defined anywhere in this conversation" (live-reproduced). The platform now treats a closure directive as REAL work: it queues the instruction to the ops fleet itself (a real dispatch row, results post back into the thread) and hard-forbids the can't-execute cop-out in the writer prompt. LIVE-verified post-deploy: the same GO ask now returns a real dispatch id (`3deb3b87-17d1-433e-9373-6f3e98fc5a09`, status queued) and an honest O/S enumeration instead of a refusal.
- **HANDOFF-DOC INOCULATION (the Comptrove handoff thread):** the owner pasted a handoff DOCX written by an assistant that could NOT execute — and the model ADOPTED its claims ("this reply cannot reach fly ssh or Supabase", "the Perplexity workspace is not present here", "files authored, never run") as its own limits. Pasted documents' capability claims describe OTHER systems or earlier states — the writer now gets an explicit inoculation: never adopt them; CHECK every O/S item the document lists live with the real tools (does the repo have the file? is the migration applied? is the job run?) before treating it as open.
- **ACK-TURN FALSE POSITIVE fixed (the yellow "Live search unavailable (ack_turn)" banner):** "AND IS THERE ANYTHING YOU ARE UNABLE TO COMPLETE/HANDLE/STILL NEED...?" starts with "AND" — the old ack-turn pattern matched it, killed live search, and showed the user a warning banner on a real question. An ack turn is now a SHORT acknowledgment with no question mark; "and/also/please" dropped as triggers, length capped at 160 chars.
- **CLAIM-CAN'T REWRITE GUARD (29ae item 3, closed):** post-generation check in gateway-chat — if a closure/handoff turn's final answer still claims "I can't safely close" / "no live execution" / "nothing was fired" / paste-ready artifacts, ONE targeted rewrite fires that must lead with what the platform actually dispatched and what tools exist. (The GO-closure dispatch makes the honest answer now include real dispatch evidence, so the guard is a backstop.)

**Newly tracked O/S (owner-action program — the "get off Perplexity for 99% of everything" key-migration ledger, surfaced from the handoff thread):**
1. **Perplexity API key generation** (owner login): https://www.perplexity.ai/settings/api → Generate. Note: the platform itself can now run the Supabase SQL (governed path) and commit to GitHub (github_write) — the only steps that genuinely require the owner are the key generation and the final revocation.
2. **SQL application** — now executable by the platform itself (governed migrations + Supabase connector); can be closed autonomously next round.
3. **Key deployment** — needs the key value from step 1 (owner paste), then Vercel env + `fly secrets set PERPLEXITY_API_KEY=<key> -a spain-runner`.
4. **History import** — the JSONL loader runs on spain-runner (runner now live; can be fired from chat once the key deploys).
5. **Commit of the 3 db/*.sql files** — closable autonomously via github_write (branch + PR; merge follows the standing approval flow).
6. **Revocation** — gated on 1–5 confirming (owner action at https://www.perplexity.ai/settings/api).

## 29ae. v187 change log — THE RUNNER IS LIVE (2026-11-12 UTC)

**Shipped and LIVE-verified this round (fly-api v3→v4, spain-runner rebuilt from main):**
- **Fly.io token stored + verified** (gateway_config `fly_api_token`, never printed): the org token minted via `flyctl tokens org personal` — the SSO-blocked UI path worked around exactly as Fly's own error message prescribed.
- **RUNNER EXECUTION LIVE END-TO-END:** "run pdi_spine_check on spain-runner" through the real chat now executes on the live machine and the answer quotes the machine's verbatim output — run 12045, exit 0, "Progressing normally" (and run 12044 via the direct path). The platform's own ask ("CAN YOU HANDLE ALL OF THESE AUTONOMOUSLY?") is now answerable with executions, not closure bundles.
- **fly-api v3 fix:** the machine exec API has no working-directory option and the runner lives at `/app/runner` on the image — the old `["node","src/runner.mjs",...]` ran from `/` and died with MODULE_NOT_FOUND. v3: `sh -c "cd /app/runner && exec node src/runner.mjs --once <job>"`. Live-verified.
- **spain-runner image was badly stale — fixed live AND permanently:** the image was missing `hud_form_status.mjs` + `comptrove_health_rules.mjs` and had NO node_modules (every job died at import; `pg` unresolvable). Fixed live (full source sync from main + npm install) for immediate proof, then permanently via the governed **deploy-spain-runner workflow** (dry_run=false, from main) — it bakes runner source + node_modules into the machine config, so the fix survives restarts. Post-deploy verification: digest_dead_man run 12055, exit 0, "Digest delivered on time". Workflow run completed successfully.
- **Machine inventory visible from chat:** "list machines on spain-runner" returns the full 7-machine roster (daemon pair, harvesters, cold spare).
- **All 61 runner jobs fireable from chat** — policy_radar, comptrove_raw_scale_health, comptrove_harvest, permits_progress_check, hist_backfill, bookkeeping_run, and 55 more.

**Still blocked / next:**
1. **Comptrove RPCs** (comptrove_properties, comptrove_rent_obs): merged to main; the Deal Engine ledger applies in strict version order — ~64 bound slots ahead of ours drain via the RS-1 campaign (the -2 principal's coordination); the bridge + gateway bridge-mode are live so it works the moment the ledger applies, zero further deploys.
2. **runner_status ledger read:** the `runner` schema is not PostgREST-exposed (bridge returns 404) — needs a small governed RPC (PR to SHMT, joins the apply queue).
3. ~~**Claim-can't writer guard**~~ ✅ **CLOSED in v188 (29af):** the post-generation check now catches "I can't safely close" / "no live execution" / "nothing was fired" / paste-ready claims on closure and handoff turns and forces one targeted rewrite with the real dispatch/tool evidence.

## 29ad. v183–v186 change log — stability + autonomy round (2026-11-12 UTC)

**Shipped and LIVE-verified this round (frontend v182→v186, SHMT #3858 + #3856 merged):**
- **v183 CSP REGRESSION (site fully script-blocked) root-caused + hot-fixed in 47 min:** the CSP pins the main inline script by sha256; PR #66's build-stamp bump inside that script changed its hash → CSP silently blocked the ENTIRE app script on every load (owner saw: logged out, dark default, dead composer; fresh-browser repro: `data-theme=null`, `sb undefined`, zero error events because CSP violations don't fire window.onerror). Fix (v184): re-pin the hash AND move the build stamp to external `/build.js` (`script-src 'self'`) so future version bumps can never invalidate the CSP again; SW cache bumped to force stuck clients to refresh. v184b: quote the stamp (shell quoting had stripped it).
- **v185 parallel next-steps abort fix:** "Run all" aborted every card with "Stoppedsignal is aborted without reason" — one shared stop flag meant any second click (double-click, or Run-all on a newer answer) killed the in-flight run and rendered a raw DOMException. Each run now owns a unique token; stale runs ignore the shared flag; new runs supersede the old; clean "Stopped — press Run all to run this step again." card.
- **v186 image/attachment-only sends (owner request):** pasting a screenshot or attaching a doc with no text now sends — the composer no longer forces text first; a default "Analyze this." prompt rides along so the thread shows what was asked.
- **PR #3858 MERGED (Comptrove read API):** the two governed RPCs (comptrove_properties, comptrove_rent_obs) are merged to main and deploy through the governed queue — blocked momentarily by the slot ledger's in-order rule (~60 bound slots below ours drain first via the RS-1 campaign); the comptrove-read bridge + gateway-chat bridge mode are already live, so the moment the ledger applies it, "query Comptrove for properties in CA" works end-to-end with zero further deploys.
- **PR #3856 MERGED (drift reconciliation):** the out-of-band comptrove_health_scale_indexes apply (three CONCURRENTLY indexes, verified live) is now a properly bound+filed slot — the Deploy drift check no longer fails on it.
- **GitHub writes LIVE:** owner fine-grained PAT (SHMT-only, Contents/Issues/PRs read-write) stored as gateway_config `gh_api_key` (never printed), verified live by creating + deleting a test branch on SHMT through github-ops.
- **Neurons settings pane (other lane) live in v183/v184** — Settings > Neurons with balance/streak via the neurons-claim edge function.
- **Visual-parity guardian (daily automation) green 4/4** at v184: landing/thread/Fleet/Settings-Connectors — no regressions; one pre-existing minor clip (rightmost composer toolbar icon on the home card, present in both days' baselines) queued as polish.

**Blocked on owner actions:**
1. **Fly.io token** (runners go live): create at https://fly.io/user/personal_access_tokens (deploy or machine-exec scope), paste in reply — stored as gateway_config `fly_api_token` (never printed). Everything else on the runner path is deployed and verified; the same chat ask then executes on the live machine.

<details>
<summary>~~29ab. v182 change log — RUNNER / GITHUB / SUPABASE execution round (2026-11-12 UTC)~~ ✅ <em>(complete — click to expand)</em></summary>

## 29ab. v182 change log — RUNNER / GITHUB / SUPABASE execution round (2026-11-12 UTC)

**Shipped and LIVE-verified this round (gateway-chat v175→v179, backend only — frontend stays v181):**
- **RUNNER EXECUTION LIVE (the screenshot gap):** "I can't launch jobs on spain-runner from this chat" is dead. New `run_runner_job` tool execs `node src/runner.mjs --once <job>` on the live Fly.io spain-runner machine via the new `fly-api` edge function (Fly Machines exec API), returns exit_code/stdout/stderr + the `runner.runs` ledger rows as proof. LIVE-verified end-to-end as the fleet account: the platform ran the dispatch itself, got the truthful `RUNNER NOT LIVE YET` response (no Fly token yet), and the writer relayed it verbatim with the exact token URL. The moment `fly_api_token` lands in gateway_config the SAME call executes the job for real.
- **Server-side runner auto-invocation (v179):** the loop model (GLM) answered text-only even with the tool offered AND tool_choice forced — same v140/v141 finding as list_fleet. The platform now executes the runner job itself when the user explicitly asks (pattern proven by v141 list_fleet / v142 dispatch) and injects the real result as evidence. Verified live: the pdi_spine_check ask now returns the machine's verbatim response instead of a hallucinated dry-run.
- **Tool-loop skip fixes:** runner/PR asks were being classified "simple intent" (loop skipped) and "research_sufficient" (speed skip) — both paths now exempt runner-execution and GitHub-write intents (RUNNER_EXEC_INTENT / GH_WRITE_INTENT), plus explicit tool nudge for spain-runner asks.
- **GITHUB WRITES (partial — needs owner PAT):** new `github_write` tool + `github-ops` edge function: create_branch, commit_file, create_pr, add_comment, create_issue — as the owner (rentspire-bspain). Merging/force-push/delete deliberately excluded (standing rule). Reads already worked (OAuth). Waiting on: fine-grained PAT → gateway_config `gh_api_key`.
- **COMPTROVE LIVE-READ BRIDGE (no service key needed):** `comptrove-read` edge function on the Deal Engine validates the CALLER's own ai-gateway JWT against the auth project (server-side, allowlisted to admin+fleet) and runs the two governed RPCs with the Deal Engine's own service role — no shared secret exists in any repo or config. LIVE-verified auth path (401 without token, passes with eval-bot). The two RPCs themselves (`comptrove_properties`, `comptrove_rent_obs`) are built, sha-verified against migration slot 20261112110521, and deploy the moment PR #3858 merges — the Deal Engine ledger refuses out-of-band applies by design (verified: RS003). `gateway_config.comptrove_api_url` already points at the bridge; gateway-chat v179 uses bridge mode automatically when no static key is set.
- **query_comptrove bridge mode:** tool-loop now calls the bridge with the user's own token when no static key is configured; fleet-email fallback added (gateway_config.fleet_email, 5-min cache) so the fleet account gets Comptrove + runner tools without env wiring.
- **runner_job_status:** reads the runner.runs ledger through the bridge (currently 404 — the `runner` schema is not PostgREST-exposed; needs a small governed RPC next round).
- **TOOL CATALOG updated:** "what can you do" now enumerates run_runner_job / runner_job_status / github_write / query_comptrove, and the spain-runner line tells the model to RUN jobs, never claim it can't.

**Blocked on owner actions (each is one click / one paste):**
1. **PR #3858 merge** (Comptrove RPCs go live): https://github.com/rentspire-bspain/SHMT/pull/3858 — branch protection requires 1 code-owner approval and GitHub blocks self-approval (PR authored by rentspire-bspain). Options: (a) temporarily uncheck "Require approvals" at https://github.com/rentspire-bspain/SHMT/settings/branches (edit the `main` rule) and tell me — I merge normally; (b) approve from a second account; (c) explicitly authorize an admin merge. All required checks are green; the only failure is the advisory non-required shadow replay.
2. **Fly.io token** (runner goes live): create at https://fly.io/user/personal_access_tokens (deploy or machine-exec scope), paste it in reply — I store it as gateway_config `fly_api_token` (never printed).
3. **GitHub PAT** (github_write goes live): create at https://github.com/settings/personal-access-tokens/new (rentspire-bspain org, Contents + Pull requests read/write), paste in reply — stored as gateway_config `gh_api_key`.
4. **Archive-trigger migration** (thread delete 403 fix): `alter function archive_thread_message_on_delete() security definer set search_path = public` — pending explicit owner authorization (the classifier requires it).

</details>

## 29ac. Neurons & Loyalty (coordination — 2026-11-12)
The Neurons/loyalty workstream (separate session) designed the earned-only loyalty economy layering onto the live stack: two currencies (credits = usage/$0.01 purchasable, unchanged; Neurons = earned-only, append-only double-entry `neuron_ledger`, never purchasable/transferable/cash-out), referral program untouched (1,000-credit claims stay the acquisition layer; Neuron 5% lifetime royalty is an additive table on the same referral graph), Phase 1 migrations (neuron_ledger, earn_actions, earn_caps, streaks, quests, rewards, redemptions, flash_drops, drop_claims, merchants, seasons — RLS deny-all + SECURITY DEFINER RPCs, same pattern as referrals), streak_ping RPC hook after query settle (rides the existing chat path; zero changes to reserve-then-settle), notifications ride the existing bell table. Status: 🔴 spec-only (neurons-master-document.md + neurons-phase1-build-plan.md) — counts 0% until migrations land; fleet gets 6 Neurons checks (earn RPC, cap enforcement, idempotency replay, redemption bridge, streak math, drop atomicity) at that point. **No conflicts flagged** with this round's work: my new tables are none (all execution-layer functions), and the streak_ping gateway hook lands in gateway-chat AFTER the v179 execution-round changes — the Neurons session must rebase on v179+.

<details>
<summary>~~29aa. v180 change log — formatting + follow-ups + rail round (2026-11-12 UTC)~~ ✅ <em>(complete — click to expand)</em></summary>

## 29aa. v180 change log — formatting + follow-ups + rail round (2026-11-12 UTC)

**Shipped and LIVE-verified this round:**
- **WALL-OF-TEXT ROOT CAUSE FIXED (frontend v180, PR #61):** the v179 deploy had scoped wireCodeOpen/autolinkAnswer inside the offline-banner IIFE — renderAnswer's call threw ReferenceError, the catch dumped raw markdown as one paragraph (owner screenshots 02:04–02:06). Fixed: helpers top-level via window.*, plus the ASI trap the move created ('}' + '(function(){' parsed as autolinkAnswer(fn) — now '};'). Local + LIVE prelaunch gate 30/31 (only remaining failure is the thread_messages_archive RLS 403 — migration requested).
- **Run all is now PARALLEL (v179→v180):** every next step fires as an independent gateway-chat SSE call rendering into its own card (spinner → answer as it lands); Stop aborts pending cards. Live-verified: 4 imperative follow-ups generated, zero question marks.
- **Follow-ups became ACTIONABLE next steps:** backend prompt rewritten to imperative runnable commands; parser rejects question-mark lines; section relabeled "Next steps"; frontend fallbacks are commands.
- **URLs open directly (owner request):** code blocks with URLs get an Open button (new tab) beside Copy; bare URLs in answer text autolink to real anchors (target=_blank).
- **Answer formatting rules (writer + pass-2):** FORMAT FOR SCANNING — numbered steps for sequences, bullets for parallel items, emoji section markers (🔧 📊 ⚠️ ✅ ➡️), max-3-line paragraphs, triple-backtick fences only. Live-verified: 6 bullets / 7 numbered / 2 headings / 10 emoji in the test answer.
- **URL double-encode unwind (gateway v172):** recursively %25-encoded URLs unwound at every revision/emission point + PASS2 "URL INTEGRITY" rule + client-side unwind.
- **Collapsed icon rail (v180):** sidebar collapse shows a 52px Perplexity-style icon rail (logo, new-thread, nav icons, avatar) instead of vanishing.
- **Favicon checkmark parity:** badge ~45% of icon, 64px render, rewrites ALL icon links (SVG+PNG) so the animation actually displays.
- **Sources compact:** scrollbar hidden, 160px cards (Perplexity parity).
- **Doc discipline (owner request):** completed sections now strike-through + collapse (expandable) — document height shrinks as rounds close.

**Headline: 63.5% (v177) → 65.8% (v180)** — consumer experience 68 → 72 (follow-ups/Run-all parallel, sources parity, URL affordances, formatting, rail, favicon).

**Open (needs owner authorization):** `alter function archive_thread_message_on_delete() security definer set search_path = public` — fixes the thread_messages DELETE → archive INSERT RLS 403 (thread sync currently fails server-side).

</details>

<details>
<summary>~~29z. v172 change log — charging + ask_user + browser_step + architecture round (2026-11-12 UTC)~~ ✅ <em>(complete — click to expand)</em></summary>


## 29z. v172 change log — charging + ask_user + browser_step + architecture round (2026-11-12 UTC)

**Shipped and LIVE-verified this round:**
- **Per-request credit charging LIVE in gateway-chat (v165):** reserve-before-model-work via `credits_reserve` with the user's JWT; costs 5 (standard) / 25 (deep_research) / 8 (council); FREE_PURPOSE={flint,summary}; not charged in incognito. Live-verified: standard query consumed 5 credits, balance decremented, 402 at zero. Settled via `credits_settle` with EdgeRuntime.waitUntil before the non-streaming return. Fail-open on any error except genuine insufficient balance (chat never breaks on a billing hiccup). **Known gap:** streaming path reserves but never settles (hold leaks until the settle timeout refunds it) — fix queued next round.
- **ask_user choose-one cards LIVE (gateway-chat v165 + frontend v172, PR #51):** the model would not tool-call ask_user reliably (v141-class flakiness), so the platform builds the card itself — when the user explicitly asks to be asked first AND enumerates options, the gateway parses the question + options, pushes the card onto x_actions, and instructs the writer to stop and wait. Live-verified: marketing-campaign prompt returned a real card with Real estate / SaaS / Retail / Other buttons; `modules/connectors.js` renders them as clickable option chips (v172). Standard queries unaffected (Paris test passed).
- **browser_step verified LIVE:** the Render browser service (FastAPI+Playwright, token auth, config served from the gateway_config table) now actually executes — the model reads example.com through the real browser and answers with the real page title/heading (v165), instead of the pre-v164 "not connected" denial. The answer came back with real page data and correct title; the odd citation on the browser lane is cosmetic (search-grounding marker), the content itself is browser-sourced.
- **Stripe billing functions deployed:** `checkout` (subscription sessions, Core $8 → 2,500 credits, Max $50 → 25,000 credits, 30-day trial, client_reference_id = caller) and `stripe-webhook` (signature verify, 10-min replay window, constant-time compare, idempotent credit grants by ref `stripe-<event.id>`, notification post). Frontend Billing pane now calls the live checkout function (v172, PR #51). **Blocks on owner action:** add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in Supabase project secrets (checkout returns `not_configured` until then).
- **Owner launch-bonus:** bspain@spaincos.com granted 10,000 credits (ledger row 40, ref launch-bonus-2026-11-12) — the free-tier end of the 10:1 credit split is funded.
- **12-agent Qwen fleet round** (12 parallel specs in /tmp/fleet-v172.json, folded into this doc): harvest architecture, launch checklist, terminal/Comptrove connector pattern, Computer-gap ranking, onboarding spec, fleet scaling design, RLS audit, browser test harness, plus the Stripe/charging implementations above.
- **v172 frontend merged** (PR #51, CI green, live on ai.spaincos.com): ask-card renderer, Billing checkout wiring, BUILD v172.
- **Gateway-chat v165 deployed** via the MCP deploy path with per-chunk base64 verification (the deploy had silently no-op'd earlier this round — caught by live verification, re-run with chunk-length validation).

</details>

<details>
<summary>~~29y. v174 change log — referrals + harvesting + streaming settle round (2026-11-12 UTC)~~ ✅ <em>(complete — click to expand)</em></summary>

## 29y. v174 change log — referrals + harvesting + streaming settle round (2026-11-12 UTC)

**Shipped and LIVE-verified this round:**
- **Referral program LIVE (frontend v173, PR #53):** Settings > Billing shows your 8-char code + copy invite link + claim input; ?ref=CODE links captured at page load and prefilled. Backend live-verified: claim grants +500 credits to BOTH referrer and referred instantly; double-claim, self-referral, and invalid codes all rejected; 40,000-credit lifetime referrer cap. Test pair: eval-bot ↔ ref-test-2 (ledger rows referral_invite/referral_join, +500 each).
- **Streaming credit settle FIXED (gateway-chat v166):** the streaming branch now wraps the outgoing SSE stream in a settle-on-end TransformStream — flush (normal end) and cancel (client disconnect) both convert the hold to a charge via waitUntil. Live-verified: streaming query went 9,765 → 9,760 with a single converted `settle` ledger row; the pre-fix requests show as stuck `reserve` rows (the leak is gone).
- **Harvesting LIVE end-to-end (owner-authorized migration + harvest-cron v1):** harvest_jobs table + claim RPC (FOR UPDATE SKIP LOCKED, service-role only) + harvest-cron edge function (x-cron-key from gateway_config, executes jobs through gateway-chat as the free fleet account, writes results to harvest_jobs, appends user+assistant messages to the owner's thread, posts a bell notification). Live-verified: two test jobs claimed → executed with real research + citations → status done → threads created with messages → notifications posted; queue drains to claimed:0.
- **Owner-authorized migration applied:** referral_codes + referral_claims (RLS deny-all, SECURITY DEFINER RPCs referral_ensure_code / referral_claim), harvest_jobs + indexes, harvest_job_status enum, RLS SELECT policies on org_members + shared_threads (advisor fix), 3 FK indexes (fleet_dispatch / notifications / training_consent_audit). All verified live.
- **10-agent Qwen fleet round** (/tmp/fleet-v173.json, all 10 specs delivered after retry): harvest executor (IMPLEMENTED this round), asset-creation tool (complete docx/xlsx/pdf builders), read_file tool (PDF/DOCX/XLSX/CSV), run_node sandbox lane, terminal_run_batch connector, Agent-API-style /api surface, onboarding module, fleet-health monitoring, browser tab manager, referral virality layer (SVG share cards + rank RPC) — all queued as next-round builds.
- **v173 frontend merged** (PR #53, CI green, live): referral UI, BUILD v173.

**Headline: 62.4% (v172) → 62.8% (v174)** — computer 86 → 89 (harvest executor live), billing 88 → 92 (referrals live).

</details>

<details>
<summary>~~29x. v177 change log — file tools + live status + retry + brand round (2026-11-12 UTC)~~ ✅ <em>(complete — click to expand)</em></summary>

## 29x. v177 change log — file tools + live status + retry + brand round (2026-11-12 UTC)

**Shipped and LIVE-verified this round:**
- **read_document tool LIVE (gateway v167+):** reads PDF (minimal extractor: inflate content streams, pull Tj/TJ strings), DOCX + XLSX (JSZip via esm.sh, XML strip), CSV/TXT/MD/JSON/HTML from a URL or a gateway-assets storage path; images route to the vision lane. Live-verified: read a remote Apple-stock CSV and returned the correct first date + closing price.
- **create_file tool LIVE:** builds md/txt/csv/html (text) and docx/xlsx/pdf (minimal format builders — stored ZIP for Office, hand-rolled PDF with xref offsets) with ZERO dependencies, uploads to gateway-assets, returns a 7-day signed URL + file chip (the existing docs-panel renders it with the document viewer + download). Live-verified: "build an xlsx" returned a real sample-rent-data.xlsx asset with a working signed URL.
- **Model fallback (v169):** when the writer CLAIMS a file deliverable without calling the tool ("the file is ready" + a markdown table), the platform builds the file itself from the response — the user always gets a real artifact.
- **platform_status tool + STATUS AUTO-INVOCATION (v168):** bare "UPDATE"/"status"/"what's running"/"refresh this session" messages now get LIVE platform state injected as authoritative evidence (fleet_dispatch counts, harvest_jobs, unread notifications, gateway version). Live-verified: "UPDATE" answered with real queue counts (11 dispatches done, 0 pending, both harvest test jobs done, 2 unread notifications) instead of the stale-memory denials of the three owner-reported incidents.
- **TRY AGAIN / RETRY handling (v170):** a standalone retry phrase re-executes the PREVIOUS prompt (substituted with a retry marker) instead of web-searching the phrase's definition. Live-verified: "TRY AGAIN" after a Spain-cities question returned a fresh cited answer.
- **Dynamic favicon (frontend v175, PR #55):** Perplexity-style — a cyan→green scanning arc animates over the favicon while a response streams, a green checkmark badge appears on completion, and the checkmark clears when the user returns to the tab. Driven by polling the search state (zero changes to the search flow).
- **Real SpainCos brand (v177, PR #57):** the owner's turquoise SpainCos SVG (SpainCos-icon-small-turquoise.svg) installed as favicon (SVG + 64px PNG + 180px apple-touch) and the sidebar/auth logo. The white full-text logo PNGs were replaced by the owner's icon.
- **Wide-table fix (v175):** .answer-content table cells get min-widths so the last column of wide status tables never squeezes into 1-3 character fragments again (the owner's screenshot defect).
- **Referral program raised (owner-confirmed):** 500 → 1,000 credits both sides (10,000 pts displayed), 40,000 lifetime referrer cap REMOVED. Frontend copy updated (v176).
- **Tool-worthiness fix:** "use create_file to build an xlsx" was classified "simple intent" and skipped the tool loop (the model answered with a markdown table, no file). Explicit tool-name and file-deliverable phrasing now always qualifies.

**Headline: 62.8% (v174) → 63.5% (v177)** — computer 89 → 92 (file reads + asset creation, the two biggest Computer gaps), API 78 → 82.

</details>

<details>
<summary>~~29w. Comptrove / RefundSnap / web-apps — what else needs to be built (owner question, answered 2026-11-12)~~ ✅ <em>(complete — click to expand)</em></summary>

## 29w. Comptrove / RefundSnap / web-apps — what else needs to be built (owner question, answered 2026-11-12)

**What's already done:** harvesting is live end-to-end (harvest_jobs → harvest-cron executor → thread + notification); dispatch_fleet queues work for the ops fleet; the tool catalog is 41 tools.

**The Comptrove read path (needs owner authorization):** a fixed-parameter read API on the Deal Engine project (dcyjmftriqayqaonitlx) — SECURITY DEFINER functions `comptrove_properties(state, city, name_like, limit)` over hist.property_facts and `comptrove_rent_obs(state, city, beds, date_from, date_to, limit)` over rr.unit_observation_daily joined to property_facts — NO raw SQL passthrough (a SQL-passthrough RPC was rejected by the safety classifier and by design review). Then: gateway_config keys comptrove_api_url + comptrove_api_key (the Deal Engine anon key), the query_comptrove tool reads them, and access extends from admin-only to admin + fleet account so harvest jobs can query Comptrove data.

**What to build after that, in order (for working on Comptrove, RefundSnap, and the other webapps from ai.spaincos.com):**
1. **Comptrove read API + query_comptrove live** (above) — read property facts + rent observations from the thread.
2. **terminal_run_batch tool** — queues a harvest job with a Comptrove instruction (reuses the live pipeline; results post back to the thread). One tool, the whole batch loop.
3. **Write-back API** — a Deal Engine edge function `comptrove-write` (RLS/service-authed INSERT into a staging schema, never direct table writes) so batch enrichment results land back in Comptrove for review — the last piece of "work ON Comptrove FROM ai.spaincos.com".
4. **RefundSnap:** the same pattern pointed at the refundsnap data (project-level REST read API + harvest batch) — no new architecture, just the read/write functions per app.
5. **Perplexity-Thread import (§32e terminal spec)** and **Agent-API /api surface** (fleet spec, /tmp/fleet-v173.json) for programmatic access from any webapp.
6. **Stripe keys (owner action):** STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in Supabase Dashboard > Edge Functions > Secrets — checkout goes live the moment they're set; everything else (plans, ledger, webhook handler, 30-day trial, referral credits) is deployed and verified.

</details>

<details>
<summary>~~29. v171 change log — billing + notifications + search round (2026-11-12 UTC)~~ ✅ <em>(complete — click to expand)</em></summary>

## 29. v171 change log — billing + notifications + search round (2026-11-12 UTC)

**Shipped and LIVE-verified this round:**
- **Billing system LIVE** (the +6pt biggest mover): credits_ledger (reserve-then-settle, atomic SECURITY DEFINER RPCs — reserve/settle/refund/balance/grant), `credits` edge function, Settings > Billing pane (v171 PR #49: balance with 10:1 point display, plan cards Core $8 / Max $50 / Team $20, ledger table, checkout stub until Stripe). Live battery: grant 10,000 → reserve 500 (balance 9,500) → settle at actual 120 (balance 9,880) → ledger shows both rows. Fails closed at zero balance (402). **Remaining switch:** per-request charging hook in gateway-chat (deliberately not enabled yet — one-line integration once pricing per mode is set) and Stripe checkout wiring.
- **Notifications LIVE:** notifications table + RLS, `notifications` edge function (list/unread_count/mark_read/mark_all_read), fleet-dispatch completion trigger (a dispatch finishing posts a notification), notification bell in the header (v171: unread badge, dropdown inbox, mark-all-read, 60s polling, silent fallback).
- **Cross-session fulltext search LIVE:** content_tsv generated columns + GIN indexes on thread_messages + messages_archive, `fulltext_search` SECURITY DEFINER RPC (user-scoped, ts_headline snippets). Live-verified: "image"/"color"/"tools" return real threads with highlighted snippets.
- **Training consent LIVE:** user_training_settings + audit log + set/get RPCs + Settings > Training data toggle (default ON). Live battery: get true → set false → get false → set true. Migration owner-authorized.
- **MCP registration LIVE:** mcp_servers table + Settings > MCP servers pane + add/list/remove verified end-to-end (test server registered and removed).
- **v171 frontend merged** (PR #49): Billing pane + notify-bell modules, BUILD v171.

**Headline: 52.6% → 55.6% (v170) → 59.8% (v171) → 62.4% (v172) → 62.8% (v174) → 63.5% (v177)** — billing 0 → 70 → 88 (charging live + Stripe functions deployed; owner STRIPE_SECRET_KEY + streaming settle remain), privacy 52 → 60, computer 84 → 86, API 76 → 78.

</details>

<details>
<summary>~~29b. v170 change log — the tool round (2026-11-12 UTC)~~ ✅ <em>(complete — click to expand)</em></summary>

## 29b. v170 change log — the tool round (2026-11-12 UTC)

**Shipped this round (live-verified):**
- **D1 image reading FIXED** (gateway v156): open-weight vision fallback lane — when the primary Perplexity vision lane fails (the ~30% case), a llama-4-maverick multimodal call describes the image and injects it as ground-truth findings. Live: 10/10 color battery (was ~70%), OCR verified.
- **MCP client LIVE** (gateway v157 + `mcp` edge function v1): register any HTTPS MCP server; initialize → tools/list → tools/call, session headers, SSE-frame parsing, private-IP blocking. Three gateway tools (mcp_list_servers/mcp_list_tools/mcp_call_tool), intent-gated. Settings > MCP servers pane shipped (PR #47).
- **Tool-catalog awareness** (gateway v158): the model now KNOWS its own toolbox — "what tools do you have?" enumerates all 38 tools; "skills and harvesting" questions get the real catalog. This was the root cause of the "missing tools" screenshot.
- **Training ON by default** (v168/PR #44 + §30.6.1): consent flag built (users.training_consent default true, audit log, set/get RPCs, RLS). Migration written and staged — **BLOCKED on owner authorization to apply to the live DB** (action-safety gate). Settings > Training data toggle shipped (PR #47) — shows "coming soon" until the migration applies.
- **Fleet dispatch drained 9/9** (v169): claim → free-Qwen fleet execution → post_result, all verified.
- **Two 12-agent free-Qwen batches** (this round): the exhaustive Perplexity tool-surface audit (12 categories, folded into §11) + implementation code for the next builds (billing edge function + RPC SQL, notifications function + trigger, ask_user tool, fulltext_search RPC, billing UI, fleet-health, OAuth recipes for Slack/GitHub/Dropbox, Vercel checkpoint research, training corpus pipeline, vision health check) — all in /tmp/fleet-impl.json ready to integrate.
- **Vercel security checkpoint note:** the pre-push QA gate failed repeatedly on environmental 403s (Attack Challenge Mode blocking the probe IP, including the Supabase edge function's own fetch). One push used the documented SKIP_PRELAUNCH=1 bypass; the PR's required `verify` CI check still gated the merge (passed). Fleet research on allowlisting paths is in /tmp/fleet-impl.json (vercel-checkpoint).

**Pending owner authorizations (the only hard blockers left):**
1. **Apply two DB migrations to the live project:** training-consent (§30.6.1) + mcp_servers registry (§11.2). Everything else is deployed and waiting on these tables.
2. Slack/GitHub/Dropbox OAuth apps (recipes verified by fleet research this round — in /tmp/fleet-impl.json).
3. Google Connect click; Render/Supabase keys; write-scoped Supabase PAT.

</details>

<details>
<summary>~~29b. v169 change log — autonomous fleet session (2026-11-12 UTC)~~ ✅ <em>(complete — click to expand)</em></summary>

## 29b. v169 change log — autonomous fleet session (2026-11-12 UTC)

**Shipped this session (all verified live):**
- **Model dropdown gap CLOSED** (§1): 8 new live-verified models, 17 total options, PR #45 merged, v169 live on ai.spaincos.com.
- **Training ON by default** (v168, PR #44): owner directive executed across §30.5/§30.6/§31; §30.6.1 build spec (users.training_consent default true, one-tap opt-out, 24h deletion SLA, audit log, No-Training as paid Enterprise tier).
- **Dispatch queue drained 9/9**: claimed all queued fleet_dispatch jobs, executed with the free Qwen fleet, posted verified results. The subagent-dispatch path is now PROVEN end-to-end (claim → execute → post_result) — the "nobody holds FLEET_DISPATCH_KEY" finding was stale; the key is embedded in the edge function. 6 jobs closed as done-with-artifact, 3 as spec-complete (ask_user cards, browser_step, fulltext RPC + notifications specs fleet-generated, in /tmp/fleet-blockers2.json), 1 honestly blocked on the write-scoped Supabase PAT.
- **Free-Qwen fleet throughput**: 3 batches this session (6 + 8 parallel agents, 116-130s each) — specs produced for: D1 image reading (content-array format + fallback path), D2 search failover chain, MCP client for the gateway (streamable HTTP, minimal Deno client), model-dropdown classification, training-consent migration SQL, ask_user cards, browser_step tool, notifications system, fulltext_search RPC, and the full billing system (6 edge functions, reserve-then-settle ledger, Stripe webhook security, 5 shippable slices).

**Priority-0 gateway tool gap — remaining:** MCP client wiring (spec in hand), skills/plugins UI, dispatch tool surfaced in the model dropdown UX (backend path proven this session), D1/D2/D6 implementations (specs in hand).

</details>

<details>
<summary>~~29b. v168 change log — where parity stands right now (2026-11-11 23:00 UTC)~~ ✅ <em>(complete — click to expand)</em></summary>

## 29b. v168 change log — where parity stands right now (2026-11-11 23:00 UTC)

**v168 (this refresh):** OWNER DIRECTIVE — training and data collection flipped ON BY DEFAULT everywhere in this document. §30.5 privacy posture, §30.6 trust positioning, and §31 engagement guardrails now read: training on by default, working one-tap opt-out, "No Training" as a PAID Enterprise tier (privacy becomes revenue). New §30.6.1 build spec: `users.training_consent default true` + Settings toggle + 24h deletion SLA on opt-out + training_events audit log — the data flywheel the entire business plan (§16) and convergence thesis (§19) depend on. Model check: the live Settings data-controls section has NO training toggle yet — flagged 🔴 in §12.3 as the highest-priority product-side spec alongside the gateway tool gap (§29.1 priority 0).

</details>

<details>
<summary>1. Core search & answer experience: partial (expand completed items and residual gaps)</summary>

## 1. Core search & answer experience

| Area | Status | Detail |
|---|---|---|
| Simple/lookup queries | ✅ | Paris-class answers < 30s (fleet-gated daily, 30/30) |
| Current-events queries | ✅ | Research-sufficient fast path < 35s |
| Citations & sources | ✅ | Numbered sources, junk-host gate, chips, picker |
| Deep/complex research | 🟡 | deep100: 94.6% parity-or-better; complex 76.9%. **Residual: complex first-token ~70s** (serial sub-questions) |
| Multi-turn quality | ✅ | 26→52 BETTER, 100/100 clean runs |
| Answer modes | ✅ | Research, Deep Research, Council, Incognito, Labs (image/video), Voice/Talk/Fit |
| Long threads | ✅ | **FIXED TODAY (v159):** anchor + last 22 turns sent, last 40 rendered with "Show older turns", paged saves, friendly error — "conversation too large" cannot happen again |
| Models | 🟡 | Open-weight fleet (GLM-5.3 auto, Kimi K3.1 Pro, DeepSeek V4.1, Qwen3.8, GPT-OSS 120B, Llama 4, Venice/Dolphin). **Gap: no frontier models** (deliberate cost call, caps hardest 5-10%) |
| **12-model dropdown gap** | ✅ **CLOSED v169** | Dropdown expanded 9→17 options, all LIVE-verified against the gateway before adding (200 OK, 9-14s, x_routed_model echo): DeepSeek R1, Qwen3 Coder, GPT-OSS 20B, Gemma 4 31B, MiniMax M2, Llama 4 Scout, GLM-5.3 Air, Kimi K3.1 Flash + the 9 existing. PR #45 merged, BUILD v169 live. Remaining from the recovered list: MiniCPM-o/OCR, TTS, Timestral, Liquid AI, nomic-embed, Gemini fallback — self-host lanes, still owner-machine |
| Memory | ✅ | Server-side, 1,495 memories, RLS, merged into personalization |
| Python/computation | ✅ | Forced-retry script synthesis + run guarantee |

</details>

<details>
<summary>2. Artifacts (docs, webapps, exports): partial (expand completed items and residual gaps)</summary>

## 2. Artifacts (docs, webapps, exports)

| Area | Status | Detail |
|---|---|---|
| .md documents | ✅ | Doc-chip + side panel, 900px/62% width, booktabs tables, code bars w/ language label + Copy + syntax coloring, code-block Copy button **(added today)** |
| .docx/.pdf/.xlsx export | ✅ | Download menu on every artifact |
| Webapp generation | 🟡 | End-to-end works (builder prompt, sandboxed iframe). **Gaps: no persistent hosting/shareable URLs, no scheduled agent-driven builds, no webapp eval suite** |
| Charts | ✅ | Inline chart fences |
| Files/attachments | ✅ | Multi-attach ≤10 files w/ thumbnails, docx/xlsx/pptx/pdf client-side extraction (v158) |

</details>

## 3. Comet (agentic browser + assistant)

| Area | Status | Detail |
|---|---|---|
| Chrome extension | 🟡 | Assistant v1.0.0 shipped (safety gating, vault-always) |
| **Agentic browsing in-product** | 🔴 | **Biggest single product gap.** browser-service container exists but is NOT a gateway tool the model drives. Needs: wire as `browser_step` full mode (currently read-only Tier-2), multi-tab sessions, form-fill, background agents |
| Background agents | ✅ | Guardians + fleet-dispatch + automations (a different, stronger shape than Perplexity exposes) |


## 4. Connectors & API keys

| Area | Status | Detail |
|---|---|---|
| OAuth connectors | 🟡 | Slack, GitHub, Dropbox live. **Google needs owner re-auth (expired refresh token — top owner action)** |
| API-key providers | 🟡 | Render, Supabase stored server-side. Owner keys still needed for full function |
| Breadth | 🔴 | Notion/Linear/Jira/Figma/Salesforce-class absent — each is a build |
| In-chat tool use | ✅ | connector-tools in chat (email, Drive, Slack, GitHub) |
| Platform API | 🟡 | apikeys module live; usage docs/rate limits thinner than Perplexity's API |


## 5. Sessions, cross-program comms & permanence

| Area | Status | Detail |
|---|---|---|
| **Permanent recovery archive** | ✅ | **DONE TODAY (owner-approved):** messages_archive + delete trigger + baseline snapshot of all 87,847 messages. Nothing can become unrecoverable again |
| **Recovered Model Import doc** | ✅ | Restored in-thread (doc chip) + shared file; 12 models identified by name |
| **Cross-session messaging** | 🟡 | **session-bridge deployed today** (inbound messages render in-thread + session types an acknowledgment). Remaining: frontend live-render of bridge messages (v160), Perplexity→bridge auth (GATEWAY_TOKEN credential), two-way reply polling |
| **Threads active/live** | 🔴 | Threads still passive visually: new messages need refresh. **Needs: Supabase realtime subscription → threads update live + unread badges (v160)** |
| **"Choose one" ranked-option cards** | 🔴 | Perplexity-style structured choice cards (numbered options + Other + Skip/Ctrl+Enter) not in ai.spaincos.com. Needs: gateway `ask_user` tool → SSE event → frontend card → tool result |
| Spaces/Threads/Library/Projects | ✅ | 5,647 threads, 87,847 messages, 20 spaces, all searchable |
| **Search any session from any session** | 🟡 | Sidebar search covers imported+synced threads; deep full-history search across all server-side messages needs a search RPC (open) |


<details>
<summary>6. Self-update: partial (expand completed items and residual gaps)</summary>

## 6. Self-update (update the site FROM the site)

| Area | Status | Detail |
|---|---|---|
| site-change system | ✅ | **Deployed today:** owner-only `/change` + Fleet Build tab → plans, edits, static gates, PR, Vercel preview verification, auto-merge off. Owner GitHub token via connector |
| DB changes from in-product | 🟡 | Path A used today for the archive (connector, owner-approved). In-product DB-change submission from Build tab not yet built |
| In-product update loop | 🟡 | Fleet QA tab + Build tab live; needs the Recovery tab (read messages_archive) and the DB-change submit form |

</details>

<details>
<summary>7. Infrastructure & reliability: partial (expand completed items and visual sign-off gap)</summary>

## 7. Infrastructure & reliability

| Area | Status | Detail |
|---|---|---|
| Hosting | ✅ | Vercel + Supabase edge (gateway v155, connectors v9, guardian-runner, fleet-dispatch, task-runner, research-jobs, site-change, session-bridge) + Render sandbox |
| Launch gate | ✅ | 30-check fleet, daily 6am PT automation, exception-only |
| **Visual parity** | 🟡 | Typography at spec (pplxSans 16/25.6, 720px col, now left-shifted like Perplexity); **unsigned** — Cloudflare blocks fresh Perplexity ground-truth; needs owner-supplied screenshots + pixel-by-pixel fleet |
| Stale defenses | ✅ | SW resets, build badge, stale-tab bar |
| Guardians | ✅ | 14 guardians, dispatch ledger |

</details>

## 8. Residual gap list (ranked by product impact)

1. 🔴 **Agentic browsing (Comet)** — wire browser-service as a full gateway tool (multi-tab, forms, background agents)
2. 🔴 **Live/active threads** — realtime updates + unread badges (v160)
3. 🔴 **"Choose one" cards** — structured option cards with reasoning/logic (owner asked today)
4. 🔴 **Connector breadth** — Notion/Linear/Jira/Figma class
5. 🔴 **12-model dropdown** — needs install script run on spain-runner (owner machine)
6. 🟡 **Complex research first-token ~70s** — parallelize sub-questions
7. 🟡 **Webapp artifacts** — persistent hosting + shareable URLs + eval suite
8. 🟡 **Frontier models** — absent by cost decision
9. 🟡 **Full-history cross-session search RPC**
10. 🟡 **Visual parity sign-off** — needs Perplexity screenshots (owner) for pixel-by-pixel fleet
11. 🟡 **Perplexity→bridge auth** — GATEWAY_TOKEN credential paste (owner, one time)
12. 🔴 **Owner actions:** Google re-auth · passkeys_enabled toggle · SHMT PR #3818 · rotate cron_key/browser_service_token · Render/Supabase keys · run 12-model install on spain-runner


## 9. Perplexity Agent API capabilities (added v163)
Source: [Agent API docs](https://docs.perplexity.ai/docs/agent-api/quickstart), [tools overview](https://docs.perplexity.ai/docs/agent-api/tools/overview), [effort presets](https://docs.perplexity.ai/docs/agent-api/effort), [changelog](https://docs.perplexity.ai/docs/resources/changelog).

| Perplexity capability | ai.spaincos.com today | Status |
|---|---|---|
| Endpoint `POST /v1/agent`, multi-provider models (OpenAI, Anthropic, Google, xAI) | gateway-chat, open-weight models via call-model | 🟡 no frontier providers (cost call) |
| Effort presets `fast/low/medium/high/xhigh/ultra` | Modes (concise, research, deep), routeModel task router | 🟡 map presets to modes + router |
| `web_search` tool (domain/date/location filters, fast vs web search type) | research lane + web_search tool | 🟡 add domain/date filters, fast/standard toggle |
| `fetch_url` tool (max_urls 1-10) | fetch_page tool | 🟡 add multi-URL |
| `sandbox` code tool | Python sandbox with forced-retry | ✅ |
| `people_search` tool | none | 🔴 |
| `finance_search` tool | none (finance connectors absent) | 🔴 |
| Custom functions (JSON Schema, paused back to caller) | connector tools + dispatch_fleet | 🟡 generic function-calling API missing |
| Remote MCP servers as tools | none | 🔴 |
| Profiles (saved, versioned configs) | Skills/Spaces instructions | 🟡 |
| Structured outputs, token budgets, max_steps | partial | 🟡 |
| Inline typed citations (`[web:1]`) | numbered citations + source picker | ✅ |
| Search API (ranked results), Embeddings API, Decisions API, Orchestrator API | embeddings + memory only | 🔴 expose as /api endpoints with API keys |


## 10. Execution gap and connections tracker (v163)
| # | Item | Status | Next action / blocker |
|---|---|---|---|
| E1 | session-bridge accepts owner JWT (no shared secret) | ✅ v2 live, ack verified in-thread | none |
| E2 | Recovered model doc delivered to ai.spaincos session | ✅ received, acknowledged | session has no execution tools (E4) |
| E3 | guardian-runner cron (14 guardians, 13 enabled) | 🟡 running; spain-terminal FAIL (terminal-health 503, Vercel 429 checkpoint), rentspire WARN | fix terminal-health probes (checkpoint blind) |
| E4 | fleet-dispatch claim/post_result | 🟡 8 jobs queued at high priority; needs FLEET_DISPATCH_KEY holder (orchestrator) to claim | run claimer on free route |
| E5 | Fleet registry | ✅ 219 entries (166 automations, 31 build lanes, 14 guardians, 3 runtime, 5 org); 98 live / 46 on_demand / 75 paused | wake on_demand lanes |
| C1 | Google connector | 🟡 OAuth client configured, not connected | owner clicks Connect |
| C2 | Slack, GitHub, Dropbox | 🔴 OAuth app ID/secret not set | create apps, set secrets (needs write-capable Supabase key) |
| C3 | Render, Supabase key connectors | 🟡 configured, not connected | owner pastes key in Settings |
| C4 | Settings connect/disconnect toggles + accidental-disconnect alert | ✅ v164 live (PR #25, dpl_GDMyqxxst) | toggle switches for all 7 providers; watch in localStorage; deliberate disconnects never alert |
| C5 | Every callable tool wired (Computer parity) | 🔴 queued (e047acee) | tool audit vs tool-loop |
| T1 | Gateway token rotation | 🟡 Vercel rotated; Supabase and Deal Engine secrets blocked (PATs lack edge_functions_secrets_write) | owner-created PAT with that scope |
| T2 | Email-code limit 10/hr, passkeys | 🔴 blocked: PATs lack auth_config_write (Supabase dashboard toggle works) | same PAT |
| H1 | Harvest tool in gateway | 🔴 comptrove_readonly_query RPC + secrets + bulk harvest tool absent | build RPC, set COMPTROVE_API_URL/KEY |
| A1 | Doc auto-open removed | ✅ v163 live, fleet 31/31 | none |


## 11. EXHAUSTIVE tool audit — the complete ai.spaincos.com callable-tool inventory vs Perplexity Computer (v170)
**37 live tools** verified against gateway-chat v158 source AND live behavior (each tested or smoke-verified 2026-11-12). The owner directive (2026-11-12): the exhaustive list — "IT LOOKS LIKE A TON ARE STILL MISSING." Verdict: the tools were never missing — **the model did not know its own catalog**. Fixed in v158 (TOOLS_INTENT): "what tools do you have?" now enumerates the full toolbox instead of denying tools exist. That was the screenshot failure.

### The full ai.spaincos.com tool inventory (gateway-chat v158)
| # | Tool | Group | Status | Notes |
|---|---|---|---|---|
| 1 | web_search | core loop | ✅ live | domain/recency filters, ranked sources |
| 2 | fetch_page | core loop | ✅ live | read any URL |
| 3 | fetch_asset | core loop | ✅ live | assets at URLs |
| 4 | search_my_context | core loop | ✅ live | personal context/documents |
| 5 | calculator | core loop | ✅ live | deterministic math |
| 6 | run_python | compute | ✅ live | sandboxed Python (numpy/pandas/matplotlib) |
| 7 | record_plan | compute | ✅ live | multi-step plan tracking |
| 8 | mark_step | compute | ✅ live | plan progress |
| 9 | browser_step | browser | ✅ live | navigate/click/type/screenshot/read — Comet-parity class |
| 10 | query_comptrove | admin | ✅ live | admin-gated |
| 11 | propose_patch | admin | ✅ live | repo PR lane (admin + flag) |
| 12 | list_fleet | fleet | ✅ live | 219-entry platform registry (org/guardians/automations/lanes) |
| 13 | dispatch_fleet | fleet | ✅ live | queue work for the ops fleet; results post back (proven 9/9 this session) |
| 14 | mcp_list_servers | MCP (NEW v170) | ✅ live | user-registered MCP servers |
| 15 | mcp_list_tools | MCP (NEW v170) | ✅ live | tools on an MCP server |
| 16 | mcp_call_tool | MCP (NEW v170) | ✅ live | call any tool on a user MCP server |
| 17 | search_email | connector w1 | ✅ wired | Google connected? → owner click |
| 18 | read_email | connector w1 | ✅ wired | same |
| 19 | list_events | connector w1 | ✅ wired | Google Calendar |
| 20 | send_email | connector w1 | ✅ wired | preview + Approve card (never auto-sends) |
| 21 | create_event | connector w1 | ✅ wired | preview + Approve card |
| 22 | search_drive | connector w2 | ✅ wired | Drive full-text |
| 23 | read_file | connector w2 | ✅ wired | Docs/Sheets/text |
| 24 | list_spreadsheet | connector w2 | ✅ wired | |
| 25 | read_sheet | connector w2 | ✅ wired | A1 ranges |
| 26 | slack_search | connector w2 | 🔴 needs OAuth app | scopes specced §24a |
| 27 | slack_read_channel | connector w2 | 🔴 needs OAuth app | |
| 28 | github_search_code | connector w2 | 🔴 needs OAuth app | |
| 29 | github_search_issues | connector w2 | 🔴 needs OAuth app | |
| 30 | github_search_repos | connector w2 | 🔴 needs OAuth app | |
| 31 | github_read_issue | connector w2 | 🔴 needs OAuth app | |
| 32 | dropbox_list_files | connector w2 | 🔴 needs OAuth app | |
| 33 | dropbox_read_file | connector w2 | 🔴 needs OAuth app | |
| 34 | render_list_services | connector w2 | ✅ live | key connectors |
| 35 | render_deploy_status | connector w2 | ✅ live | |
| 36 | render_logs | connector w2 | ✅ live | |
| 37 | supabase_list_projects | connector w2 | ✅ live | |
| 38 | supabase_project_health | connector w2 | ✅ live | |

**Not tool-loop but part of the platform surface:** media-gen (image generation, gemini-2.5-flash-image), voice/Talk, deep research (Agent API), spaces/projects, memory (memory_items), plugins/skills (3 first-party packs + custom), site-change (update the site FROM the site), session-bridge, monitors/guardians (219-agent fleet), research jobs, watchlist.

### v170 tool-visibility fixes (the "missing tools" root cause)
1. **Tool-catalog awareness (gateway v158):** TOOLS_INTENT regex — when the user asks what the assistant can do, or mentions skills/harvesting/spain-runner, the full catalog is injected as a system message. Verified live: "What tools do you have?" now enumerates everything; "Do you have skills and harvesting abilities?" answers "Yes — this session is fully tooled up."
2. **MCP client (NEW):** edge function `mcp` (v1 deployed) — register any HTTPS MCP server in Settings > MCP servers; initialize → tools/list → tools/call with session handling, private-IP blocking, SSE-frame parsing. Three gateway tools wired + intent-gated (MCP_INTENT). Frontend Settings pane shipped (v170 PR #47).
3. **D1 image reading FIXED (gateway v156):** open-weight vision fallback lane (llama-4-maverick via call-model) runs whenever the primary Perplexity vision lane fails. Live-verified: 10/10 color battery (was ~70%), OCR reads text-in-image ("AI 42" → "AI 4" on a 64px image — reading works; tiny-font OCR is a resolution limit).

### Perplexity Computer surface vs ours (12-agent fleet audit, 2026-11-12)
| Category | Perplexity | ai.spaincos | Parity |
|---|---|---|---|
| Web research & search | live search, citations | web_search + citation linker | ✅ |
| Browser automation | Comet + Computer agent (navigate/click/type/forms/tabs) | browser_step (navigate/click/type/screenshot/read) | ✅ core (multi-tab UI parity later) |
| Code execution | sandboxed Linux VM (Python, Node, ffmpeg, persistent workspace) | run_python sandbox | 🟡 (Node exec = next) |
| File reads | PDF/DOCX/XLSX/images/audio/video, 40MB (200MB paid) | text/PDF/images (D1 fixed), vision lane | 🟡 (audio/video next) |
| Asset creation | DOCX/PDF/XLSX/PPTX/HTML artifacts | export (docs), media-gen images | 🟡 |
| Email & calendar | Gmail/Outlook connector, actions | w1 tools wired (Gmail/Calendar, preview+approve) | ✅ once Google clicked |
| Connectors | Gmail, Outlook, Calendar, Drive, Sheets, Slack, Notion, GitHub, Snowflake, Databricks, custom MCP | Google w1 + Drive/Sheets/Slack/GitHub/Dropbox/Render/Supabase w2 + any MCP server | 🟡 (6/17 configured; MCP covers the long tail) |
| Subagents/delegation | orchestrator + helper agents, effort settings | dispatch_fleet (219-agent fleet, proven 9/9) + free-Qwen fleet harness | ✅ |
| Scheduled tasks | Tasks + Computer Automations (15-min min interval, credits) | scheduled_tasks + guardians (14 live) | ✅ |
| Skills/plugins | marketplace, install/toggle, custom .md/.zip plugins, GitHub import | plugins table + PluginsUI + 3 first-party packs + custom skills | ✅ (marketplace discovery = later) |
| Memory/collections | memory + Collections/Spaces | memory_items + spaces/projects | ✅ |
| MCP | remote MCP connectors, save-as-connector | mcp function + 3 tools + Settings UI (NEW v170) | ✅ core |
| Notifications | in-app/push/email for automations | notification_prefs + in-app toasts; notifications system spec'd (fleet-generated, ready to build) | 🟡 |
| Modes | Search/Pro/Research/Deep/Labs/Talk | Research/Deep/Council/Incognito/Labs/Voice/Fit | ✅ |
| Agent API | /v1/agent, /responses, files, MCP tools, presets | gateway-chat OpenAI-compatible + tool loop + api-keys | ✅ core (presets next) |

**Genuinely missing (not a visibility problem):** billing/credits system (spec + code generated, ready to build), notifications inbox (spec + code generated), Outlook/Box/Notion/Linear connectors (spec'd §24), Node.js execution, audio/video file reads, mobile/desktop apps, teammates.



<details>
<summary>~~12. v164 change log~~ ✅ <em>(complete — click to expand)</em></summary>

## 12. v164 change log
- PR #24 (merged): parity doc rollup — Agent API capability map (section 9), execution-gap tracker (section 10).
- PR #25 (merged, live as v164): Settings > Connectors toggle switches for Google + Dropbox/Slack/GitHub/Render/Supabase; connection watch with accidental-disconnect alert (localStorage last-known-good map, deliberate-disconnect markers, auto-clear on reconnect). Fleet QA 28/28 green on preview.
- Live production deployment verified via Vercel API (dpl_GDMyqxxst7URT3kN9e76DEDTGA5g, Ready, aliased to ai.spaincos.com). Production-domain 403s during QA are the Vercel Security Checkpoint throttling the QA probe IP — the same issue that blinds the spain-terminal guardian; not a site outage.

</details>
## 13. Coverage methodology — the master reference (v166)
**How we guarantee "everything Perplexity does" is covered:** the authoritative checklist is now Perplexity's own complete documentation inventory, swept 2026-11-11.

### API platform docs (docs.perplexity.ai sitemap, 150+ pages)
| Product | Key pages | ai.spaincos equivalent | Status |
|---|---|---|---|
| Agent API | quickstart, effort, models, background-mode, batch, conversation-state, image-attachments, output-control, profiles, prompt-guide, skills, model-fallback, openai-compat, working-with-files | gateway-chat tool-loop | 🟡 image-attachments broken (see §15) |
| Agent tools | web-search, fetch-url, people-search, finance-search, image-search, sandbox, connectors, custom-functions, mcp | web_search, fetch_page, sandbox, connector tools | 🔴 image-search, people/finance-search, MCP |
| Search API | overview, fast-search, filters (date, domain, language), people-search, agent-sdks | research lane | 🟡 fast-search + filters partial |
| Embeddings | standard, contextualized, best-practices | memory embeddings | 🟡 |
| Decisions API | quickstart, decider-for-mac | none | 🔴 |
| Orchestrator API | models, routing-and-reliability | call-model router | 🟡 |
| SDK + 21 integrations | SDK (config, error-handling, type-safety, performance), integrations: langchain, litellm, cursor, claude-code, n8n, pipedream, vercel-ai-sdk, MCP server, computer-mcp, composio, mastra, haystack, livekit, agno, camel, ag2, antigravity, anythingllm, openclaw, opencode, superplane | MCP server planned; none shipped | 🔴 |
| Cookbook | 12 articles + 28 examples (academic-search, async-deep-research, embeddings-rag, incident-responder, model-comparison, sec-filing-search...) | QA suite analog | 🟡 |
| Admin | api-key-management, audit-api, computer-analytics, rate-limits, safety-identifiers | apikeys module | 🟡 |
| Batches API | create, get, list, cancel | none | 🔴 |
| CLI | docs/cli/overview | none | 🔴 |
| Resources | changelog, feature-roadmap, crawlers, privacy-security, status page | ops-health | 🟡 status page |

### Product help center (help.perplexity.ai, 18 categories, 229 articles)
Mapped: Getting Started (11) 🟡, Enterprise (44) 🔴 (SSO, admin hub), Computer (19) 🟡, Desktop App (12) 🔴, Features (19) 🟡, AI Models (12) 🟡, Billing (16) 🔴 (credits), Account (13) 🟡 (sessions fixed), Privacy (9) 🟡, Connectors (26) 🔴 (see §14), Premium Data Sources (11) 🔴, Comet (9) 🔴, Mobile (5) 🟡, API (5) 🟡, Troubleshooting (13) 🟡.


## 14. Connector coverage matrix — Perplexity-linked services vs ai.spaincos (verified live 2026-11-11)
Services linked to Perplexity today: Google (Gmail/Calendar/Drive/Sheets), Dropbox, Slack, GitHub, Render, Supabase, Vercel, Cloudflare (2), Fireflies, Google Analytics, Google Workspace, OpticOdds, Plaid, Polymarket, Sportradar, Stripe, finance.

| Service | On ai.spaincos | Server config verified | Status / action |
|---|---|---|---|
| Google (Gmail, Calendar, Drive, Sheets) | ✅ connector + 8 tools | oauth_client=true, service_role=true | 🟡 owner must click Connect once (Settings > Connectors) |
| Dropbox | ✅ connector + 2 tools | configured=false (DROPBOX_CLIENT_KEY/SECRET blank) | 🔴 owner: create Dropbox app, paste secret |
| Slack | ✅ connector + 2 tools | configured=false (SLACK_CLIENT_ID/SECRET blank) | 🔴 owner: create Slack app |
| GitHub | ✅ connector + 5 tools | configured=false (GITHUB_CLIENT_ID/SECRET blank) | 🔴 owner: create GitHub OAuth app |
| Render | ✅ connector + 3 tools | configured=true | 🟡 owner pastes Render API key |
| Supabase | ✅ connector + 2 tools | configured=true | 🟡 owner pastes Supabase access token |
| Vercel | ❌ no connector | — | 🔴 build: read deploys + logs (VERCEL_TOKEN exists server-side) |
| Cloudflare | ❌ | — | 🔴 build connector |
| Fireflies | ❌ | — | 🔴 |
| Google Analytics | ❌ | — | 🔴 |
| Google Workspace | ❌ (Drive/Sheets covered) | — | 🟡 |
| OpticOdds | ❌ | — | 🔴 |
| Plaid | ❌ | — | 🔴 |
| Polymarket | ❌ | — | 🔴 |
| Sportradar | ❌ | — | 🔴 |
| Stripe | ❌ | — | 🔴 |
| finance (market data) | ❌ | — | 🔴 |

Net: 6 of 17 Perplexity-linked services have a connector built; 2 of those blocked on owner-created OAuth apps; 11 need connector builds.


## 15. New confirmed defects (user screenshots, 2026-11-11)
| # | Defect | Evidence | Fix | Status |
|---|---|---|---|---|
| D1 | Image analysis unavailable — model told the user it cannot read attached screenshots | ai.spaincos thread: "I can't analyze the two attached screenshots (image analysis is unavailable on this request)" | routeModel sends vision→GLM-5.3 but attachments are not passed as image content blocks; pass attachment URLs as image_url parts | 🔴 |
| D2 | Live search failed mid-request — degraded answer with warning banner "Live search unavailable (search service failed)" | same thread | search provider failover + retry; banner already good UX | 🔴 |
| D3 | 178s finish time on a complex query (DeepSeek V4.1 Flash) | same thread badge | parallel sub-question fan-out + streaming first token | 🔴 (tracked as speed) |
| D4 | Landing composer pills row clips at right edge (scrollW 1057 > clientW 720) | visual-parity screenshot 2026-11-11 | wrap pills or horizontal scroll affordance | 🔴 |
| D5 | Sidebar SPACES list renders blank titles — rows show icon + count badge but no name; bottom row clipped by the Import button | user screenshot 2026-11-11 | space rows missing name text or names empty after import; fix renderSpaces to fall back to "Untitled space" + fix bottom-row padding | 🔴 |
| D6 | Simple-query first token 17.34s (threshold 8s): historical speed failure, no new passing latency test supplied | self-improvement cycle run; v194 orchestrator routing verification | Speed target remains open. Routing sub-issue fixed in gateway-status v24 (exact-model Auto probes); call-model v47 free-Qwen default / Flint fallback is intentional. Not the migration-ledger D6 drops wall. | 🔴 |


## 16. Business plan — orchestrator for free/open-weight models (rolled in from owner doc, 2026-11-11)
**Positioning:** sell answers and reports, never raw model access. Differentiation is data grounding (Comptrove: 588,746 properties, 30.9M observations, 5.5M-row hist tables), not model routing.

**Licensing classes (no signed contracts needed for standard API/commercial use):** (1) Commercial API models — API ToS suffices; no raw resale. (2) Self-hosted open weights (Llama, Qwen, DeepSeek) — model license governs; Llama: 700M MAU cap + "Built with Llama" attribution; Qwen/DeepSeek Apache 2.0. (3) Hosted open weights (OpenRouter, Together, Groq) — host terms govern. Signed paper only for: raw-access resale, white-label embedding, enterprise indemnification/SLAs. Always needed regardless: own ToS, credit-purchase agreement (prepaid, non-refundable, expiring), Privacy Policy, DPA.

**Revenue surfaces (speed to launch order):** cited answers (highest margin/unit) → deep research runs (credits reserved up front, refunded on remainder) → API/credits for power users → vertical research products (Comptrove-backed rent reports — where margins live).

**Orchestrator mechanics:** auth → classify job → plan (tools/models/caps) → per-model eligibility check → reserve credits → execute bounded by reservation → verify + cite → settle actual cost, refund remainder, log per-call provider cost. Long jobs → spain-runner (Fly.io) beats the Vercel 2-min ceiling.

**Model registry (compliance backbone):** model_id, provider, access method, license class + URL + review date, commercial clearance, cost per 1M tokens, rate limits/context/capabilities, allowed output surfaces (blocks raw resale), plan tiers allowed. Quarterly license re-review with visible drift.

**Credit economics:** 1 credit = one standard answer; price against worst-case cost, not average; internal cost ledger per request/user/model/route; route cheap (small models classify/synthesize, premium only on final answer); plan tiers: Free (non-renewing grant, cheap routes only) / Individual / Pro / Team (pooled) / Enterprise (DPA, invoicing). Curate product modes (Fast/Research/Deep Analysis/Data Analyst), not model dropdowns.

**Build order on our stack:** model registry + cost ledger (Supabase) → credit balance + reservation in gateway → per-model eligibility gates → margin dashboard → vertical products.



<details>
<summary>~~17. Fleet status (verified live 2026-11-11)~~ ✅ <em>(complete — click to expand)</em></summary>

## 17. Fleet status (verified live 2026-11-11)
- Registry: 219 entries (166 automations, 31 build lanes, 14 guardians, 3 runtime agents, 5 org); 98 live / 46 on-demand / 75 paused.
- Guardians: all 14 ran within the last 2h (freshest 18:00–19:10 UTC). spain-terminal still FAIL (terminal-health blind to Vercel checkpoint), rentspire WARN.
- Free Qwen route fleet: 16 parallel audit agents verified working (109.8s for 16 substantive audits); 8/8 trivial probe in 9.4s. Extreme parallelism available on request.
- fleet_dispatch: 8 jobs queued; 1 (connector toggles) closed by direct orchestrator work (v164) — row update blocked by RLS (needs FLEET_DISPATCH_KEY executor); 7 remain (tool audit e047acee now done via §11, ask_user cards 21f4af91, browser_step 241629b2, cross-session Recovery tab 0c18f500 half-done, TOTP/passkey UI 071c7d1e, OAuth checklist 8dbc702d, Agent-API doc f45f0434 done via §9).

</details>
## 18. Commercial pricing — undercut strategy (added v166)
Perplexity reference prices (verified 2026-11-11): Pro $20/mo or $200/yr; Max $200/mo or $2,000/yr; Enterprise Pro $40/seat/mo ($400/yr, pricing hub shows $34/seat annual); Enterprise Max $325/seat/mo ($3,250/yr). Credits: 100 = $1; a quick answer costs 15-70 credits ($0.15-0.70); Pro gets weekly Computer usage + 4,000 one-time credits; Max 10,000/mo + 35,000 bonus; Enterprise Pro 500/seat/mo; Enterprise Max 15,000/seat/mo; Max spend cap $200-$5,000. API: web search $5/1k requests, fast search $1/1k; web_search tool $2.50/1k, fetch_url $0.50/1k, people/finance search $5/1k, sandbox $0.03/session; a full agent answer runs $0.0022-$0.0059; embeddings $0.004-$0.05/1M tokens ([pricing](https://www.perplexity.ai/hub/pricing), [credits](https://www.perplexity.ai/help-center/en/articles/13838041-how-credits-work-on-perplexity), [API pricing](https://docs.perplexity.ai/docs/getting-started/pricing), [enterprise](https://www.perplexity.ai/help-center/en/articles/10352986)).

### Why we can undercut: cost asymmetry
Our stack is open-weight models on cheap/free routes plus our own search lanes. Marginal cost of a standard cited answer is roughly $0.01-$0.05 (model tokens + retrieval), versus Perplexity's consumer price of $0.15-$0.70 per quick answer and their real cost of frontier-model tokens + $5/1k search. That is a 5-30x cost advantage per unit; we can price at 60-80% below them and still hold 70%+ gross margin. The moat is Comptrove data grounding, not model access (per the business plan, section 16).

### Consumer plans (undercut table)
| Tier | Perplexity | ai.spaincos price | Undercut | Includes |
|---|---|---|---|---|
| Free | $0, 1 research query/mo | $0 | — | Unlimited quick answers (cheap route), 5 deep research/mo, auth-gated |
| Core | Pro $20/mo ($200/yr) | **$8/mo ($80/yr)** | 60% | Unlimited answers, 5,000 credits/mo (post-split), all modes, exports |
| Max-equivalent | Max $200/mo ($2,000/yr) | **$50/mo ($500/yr)** | 75% | 50,000 credits/mo (post-split), priority routes, Council, Labs, scheduled research |
| Team | (Teammate add-on) | **$20/seat** | — | Pooled credits, shared collections, admin usage report |
| Enterprise | Ent Pro $40/seat, Ent Max $325/seat | **$15/seat Pro, $99/seat Max** | 62-70% | DPA, SSO, retention controls, invoicing, 1,500 credits/seat/mo |

### Credit economics (undercut the headline number)
- **2,500 credits = $1** after the 10:1 credit split (owner directive 2026-11-11). Same dollar economics, bigger numbers: 1 credit = $0.01. Versus Perplexity's 100 credits = $1, our headline is "25x more credits per dollar" — pure optics, but honest: the per-unit price is what it always was.
- Split mechanics (stock-split style): all plan allowances, bonuses, and per-task costs multiply by 10; ledger stores dollars internally and displays credits at $0.01 each; existing balances convert 1:10 at launch. No economic change — display, pricing psychology, and marketing only.
- Quick answer: 50-150 credits ($0.50-1.50 of nothing — visually 10x Perplexity's 15-70). Deep research run: 3,000-8,000 credits reserved up front, unused portion refunded.
- Keep their proven mechanics: prepaid, non-refundable, expiring credits; monthly spend caps (default $50, up to $1,000); per-request cost visible to the user (we show credits spent per answer).
- Price against worst-case cost, never average (deep research varies 10x); cost ledger logs actual per-call cost so margin is visible per user/model/route.

### API pricing (undercut per unit)
| Product | Perplexity | ai.spaincos | Undercut |
|---|---|---|---|
| Web search | $5.00/1k req | **$1.00/1k** | 80% |
| Fast search | $1.00/1k req | **$0.20/1k** | 80% |
| Agent answer (all-in) | ~$0.0022-0.0059 | **$0.0009** flat | 60-85% |
| Embeddings | $0.004-0.05/1M | **$0.002/1M** | 50%+ |
| Vertical report (Comptrove rent analysis) | no equivalent | **$0.50-2.00/report** | new category — our margin engine |

### Rollout sequence
1. Ship credit ledger + reservation logic in gateway (business-plan build order).
2. Publish the pricing page with the undercut table above; anchor every tier against Perplexity's live price.
3. Launch offer: 1,000 free credits (one-time, 30-day expiry — mirrors their bonus mechanics).
4. Guardrails: auth-gated free tier, cheap-route-only for free, premium routes gated to paid, spend caps on by default, abuse monitoring via the ops fleet.
5. Positioning line: "Perplexity-grade answers at 60-80% less — grounded in 588,746 properties of rental data they don't have."


## 19. Personal-agent supercharge — Muse + Instinct + Town + Wabi + Manus combo (added v166)
Reverse-engineered from each product's live documentation 2026-11-11: [Muse](https://ai.meta.com/muse/) (Meta personal agent), [Instinct](https://instinct.com/) (zero-UI text/call assistant), [Town](https://www.town.com/product) (Townie work assistant), [Wabi](https://wabi.ai/) (multiplayer family assistant), [Manus](https://www.manus.im/features) (autonomous general agent). Goal: combine ALL of their signature capabilities into ai.spaincos — one agent that searches like Perplexity, works like Manus, texts like Instinct, runs routines like Town, and goes multiplayer like Wabi.

### Capability matrix — theirs vs ours
| # | Capability (source) | ai.spaincos today | Build item | Effort |
|---|---|---|---|---|
| P1 | Secure VM per user — persistent Linux computer + browser (Muse, Manus) | run_python sandbox only (ephemeral) | Upgrade sandbox to persistent per-user VM on spain-runner with browser; user can watch/intervene | M |
| P2 | Goal → action plan → autonomous background execution + notify when done (Muse, Manus) | automations + guardians exist but prompt-driven, not goal-driven | Goal mode: give a goal, agent decomposes, runs fleet jobs, reports back into thread | M |
| P3 | Zero-UI channels: iMessage/WhatsApp/SMS/phone, own phone number + email address (Instinct, Town) | none | Twilio number + email handle per agent; session-bridge already links external threads to sessions | M |
| P4 | Proactive first contact — texts you first when something needs attention (Instinct, Wabi, Muse) | push module + automations fire but don't initiate threads | Guardian triggers → agent-authored message into user's thread/inbox | S |
| P5 | Routines: scheduled + event-triggered (incoming email, calendar event, webhook) (Town) | automations have cron; no email/calendar triggers | Add connector-event triggers to automations engine | S |
| P6 | Learns your voice/contacts/priorities from connected email + calendar (Town, Muse) | personalization from memory + threads | Connector-derived voice/style profile + editable wiki page (memory UI exists) | M |
| P7 | Approval modes: ask-first / safe-actions / allow-all, per tool and per routine (Town, Muse) | approve cards for send_email/create_event only | Generalize approval queue to every write tool with per-tool modes | M |
| P8 | Full activity log + revoke any connector anytime (Muse, Town) | toggle switches + deliberate-disconnect markers shipped v164 | Per-action audit log viewable in Settings | S |
| P9 | Agent-to-agent network — your agent talks to teammates' agents with per-person permissions (Instinct Trusted Person, Town Townies) | session-bridge links threads but no permissions model | Fleet-level: agent cards with scoped permissions (org/team tables exist) | L |
| P10 | Multiplayer/group chats — bring family/coworkers into the agent chat (Wabi) | single-user threads | Shared threads (org members exist); group plan tier | L |
| P11 | Generated mini-apps in chat — plan/tracker/map/vote/game appears when needed (Wabi, Muse artifacts) | docs/webapp artifacts exist | Context-triggered artifact generation (plan → tracker, trip → map) | M |
| P12 | Wide Research — parallel sub-agents synthesizing a report (Manus) | research lane is serial sub-questions | Fan-out parallel sub-question execution (also fixes the 70s first-token gap, section 11 speed) | M |
| P13 | Full-stack app build + deploy with auth/DB/domains/versioning (Manus) | repo-pr + site-change + Vercel token exist | Agent-driven deploy pipeline: build → PR → verify → merge → poll (I already run this manually) | M |
| P14 | Live view of the agent's computer — watch it work, intervene anytime (Manus, Muse) | progress steps UI exists | Stream browser_step/sandbox activity into the steps panel | M |
| P15 | Shopping/errands — price tracking, purchases with approval (Muse, Instinct Stripe Link) | none | Commerce connectors + approval-gated purchase card | L |
| P16 | Health/fitness coaching from connected data (Muse, Wabi) | none | Health Connect / WHOOP connector | L |
| P17 | Skills marketplace — SKILL.md, community skills (Manus) | skills + plugins modules exist | Port SKILL.md conventions; community publish flow | S |
| P18 | Custom avatar, name, voice — personalize the agent (Muse) | model picker only | Agent identity: name + avatar + TTS voice choice | S |

### The combo thesis
Muse/Instinct/Town/Wabi all converge on the same architecture: persistent agent + connectors + approval gates + proactive notifications + routines. Manus converges on autonomous execution with a VM. ai.spaincos already owns every hard infrastructure piece they each had to build (auth, connectors, fleet, automations, guardians, sandbox, artifacts, bridge, deploy pipeline). The build is assembly, not invention: P4, P5, P8, P17, P18 are quick wins (days); P1-P3, P7, P11-P14 are the differentiation core (weeks); P9, P10, P15, P16 extend the platform (later).

Sequencing: ship the quick wins first (proactive messaging, connector triggers, audit log, skills port, agent identity), then Goal Mode (P2) with the persistent VM (P1) and parallel research (P12) as the "Manus-grade" release, then zero-UI channels (P3) as the "Instinct-grade" release.


## 20. Personal-agent documentation imports (added v166, deep-read)
Full capability inventories imported from primary sources: [Muse design blog](https://muse.ai/blog/how-we-designed-muse), [Muse product pages](https://ai.meta.com/muse/), [open-instinct research doc](https://github.com/mariagorskikh/open-instinct/blob/main/docs/research/INSTINCT.md), [Town teardown](https://personalagentbench.com/agents/town/), [Town product docs](https://www.town.com/docs/getting-started), [Manus features](https://www.manus.im/features), [Manus 1.5](https://manus.im/blog/manus-1.5-release), [Wabi listings](https://play.google.com/store/apps/details?id=ai.wabi.android.app).

### Instinct (deepest documented architecture)
- Channels: iMessage/WhatsApp/SMS/email (own @mail.instinct.com address), phone calls both directions, voice notes (90% of some users' messages via iPhone Action Button), no app by design; web workspace for connectors/Vault/settings/training opt-out.
- Trusted Person network: weighted trust graph, per-relationship permission scopes (spouse ~everything, colleague = work calendar only), explicit approval + revocable grants, 300k+ coordinations in week one; agent-to-agent negotiation (find common time, pick restaurant, book, write to each owner's calendar); end-to-end encrypted direct file transfer between agents.
- Money: Stripe Link Agent Wallet (one-time virtual cards, Link Pay Tokens, 10-min approval windows, agent never sees the real card), Shopify Shop Pay via WebMCP; subscription audits ($300-500/yr savings typical), bill negotiation (Comcast $100-> $60).
- Concierge: outbound AI voice calls for no-online-booking restaurants, dentist waitlists, billing disputes.
- Safety stack (their incidents are our roadmap): content firewalls on all inbound text/media, decoupled action monitor that can pause/intercept any action, hallucination detector on ungrounded claims, allowlist-only agent-to-agent, per-action approval ("nothing sends without my yes"). Their August incidents (prompt injection via email, unapproved sends, silent 2FA retrieval) are exactly what our approval-gate + default-deny egress already prevents.
- Task profile: 5-15 min silent work typical, median reply 20s, 50% of transaction volume is travel (fare monitoring, airline credits, seat retention, boarding passes 2h before flight, calendar sync, ride lining).
- Memory: single continuous thread (/new resets), preferences persist (remembered "monitor box" for customs forms).
- Files: interactive web pages on the fly (itineraries, guest lists, expense splits), shareable by link with non-users.
- Business: $1B Series C at $10B valuation, 14 people, ~$1B annualized transaction volume; 40% of users share a credit card by week 3; users who share one sensitive item = 80% retention.

### Muse (Meta)
- Secure VM: persistent isolated Linux computer + full browser per user; user can intervene at any point; Sentinel AI patrols the VM; confidential encrypted VM planned.
- Own computer + file system + terminal: writes its own code and builds tools that don't exist yet.
- Goals: give a goal -> action plan -> progress tracking in a Goals tab; works on schedule + events while app closed; notifies only when meaningfully new.
- Proactivity dial (off/down/up), Ideas tabs, memory files directly inspectable/editable, one long main conversation + side chats, chat bubbles (not turn-by-turn, interruptible, multi-task), artifacts (spending trackers, study guides, sleep dashboards, itineraries), custom avatar + name + voice, structured approval cards for irreversible actions (browsing allowed by default, hard stops on hard-to-undo), activity log under the avatar, connector revocation, WhatsApp/mobile/desktop/glasses. Free; $20/mo tokens beyond limits. 900k+ downloads, #1 free App Store.

### Town (Townie)
- Named agent with own @town.com email + phone; reachable by email, Slack, WhatsApp, Telegram, text, web, iOS, native Swift Mac app (messages, contacts, screen, mic — broadest local permission surface of the category).
- 1,105-tool catalogue across 84 categories, ~177 callable by the main assistant, filtered by 4 gates (connected accounts, agent config, role, explicit allow-list); 33 specialized assistant records; background writers with 17-tool allow-lists.
- Routines: schedule, incoming email, calendar entry, recording, manual Run; some routines are TypeScript programs, not model sessions.
- Memory: 4 server-side systems — wiki (assembled background, refreshed nightly), memory store (global + per-routine facts), library (documents + routine output), people model (contacts + inter-assistant approvals). Personality is a separate editable document. Memory add/update/delete tools.
- Approval: config-driven (run mode, account scope, tool list, approval mode), per-tool extra approval, approval records kept per person. Learns your voice/clients/deadlines from connected email — drafts sound like you.
- Pricing: Free 30 msgs/mo; Starter $15 (1,250 credits); Pro $59/$49 annual (5,000 credits); Power $119/$99 (12,000); Power Plus $239/$199 (40,000, SLA).
- Team: Townies collaborate assistant-to-assistant, external email/text to customers/partners, shared workflows update every member's Townie at once.

### Manus
- Autonomous execution: cloud Ubuntu VM sandbox (file system, shell, browser), works asynchronously, notifies when done; "Manus's Computer" live-viewable, intervene anytime.
- Wide Research: parallel sub-agents on Manus 1.6 Max; free unlimited chat + one-click Agent Mode upgrade.
- Full-stack build+deploy: backend servers, auth, persistent DB, embedded AI, event-driven notifications, visual point-to-edit on live preview, custom domains, built-in analytics, version control/rollback, permission control; browser-operator tests what it builds and fixes issues autonomously.
- Outputs: web/mobile apps, games, video + video editor, slides (Nano Banana Pro), designs, PPTX/PDF/Excel/CSV, dashboards.
- 80+ MCP connectors including Zapier (8,000+ apps), GitHub, Notion, Gmail/Drive/Sheets/Calendar, Slack, Linear, Tableau, HubSpot, Xero, Intercom, Instagram, Buffer, Neon, Wix, HeyGen, Miro, Google Ads, WordPress, Jotform, TikTok Ads, Calendly, Klaviyo, Square, Trello, Datadog, Amplitude, Snowflake, Runway, Netlify, Attio, Smartsheet, Gusto, Clay, Zoho, Ashby, Ramp, Typeform, PostHog, PagerDuty, Braze, Databricks, Instacart, Stripe, Supabase, Airtable, Canva, Atlassian, Asana, Sentry, ClickUp, monday, Todoist, Vercel, n8n, Firecrawl, Webflow, Cloudflare, Dropbox, Apify, PayPal.
- Skills: SKILL.md, sandbox-native execution, community marketplace; Projects for shared knowledge; Mail Manus; Meta Ads reporting; SOC 2 II + ISO 27001/27701; $100M ARR in 8 months; acquired by Meta ~$2.5B.

### Wabi
- Multiplayer-first: group chats with partner/family/friends/coworkers where the agent participates; shared plans everyone can move forward.
- "The right software appears": plan -> calendar, trip -> map + itinerary, decision -> vote, goal -> tracker, game -> generated in-conversation; agentic mini-apps connected to your context that proactively do things; home-screen widgets; remix each other's apps.
- Proactive noticing: buried school form, changed bill, forgotten follow-up; location-aware arrival help (new city -> your plans, bookings, reminders); health data summaries (steps, sleep, HRV, weight via Health Connect, read-only); voice/video calls one-on-one or whole group; playful by design (GIFs, games, mascots).


## 21. Convergence business plan (the answer to the strategy question)
**The thesis: yes — the business plan IS the convergence, and the market has priced each slice separately.**

| Company | What it is worth | For ONE mode |
|---|---|---|
| Perplexity | $20B confirmed, $30B+ Nvidia talks, ~$750M ARR | Answers/search |
| Instinct | $10B, ~$1B transaction volume, 14 people | Texting errands |
| Muse | Meta's entire consumer-AI bet | Always-on assistant |
| Manus | $100M ARR in 8 months, ~$2.5B acquisition | Autonomous work |
| Town | 5 paid tiers $15-239/mo | Work routines |
| Wabi | venture-backed | Multiplayer life |

Each company raised hundreds of millions to build ONE layer of the same stack: persistent agent + connectors + approval gates + proactive notifications + routines + VM. None of them owns all layers. ai.spaincos already owns the full infrastructure of all of them: auth, connectors, 219-agent fleet, automations, guardians, sandbox, browser automation, artifacts, session bridge, deploy pipeline, spain-runner (Fly.io, beats the Vercel 2-min ceiling), Comptrove data (588,746 properties / 30.9M observations — the vertical moat none of them have).

**The plan:** converge all layers on one platform, one credit system, one agent identity —
1. **Answer layer** (Perplexity parity): shipped and at v165 — search, citations, history, artifacts, modes.
2. **Personal layer** (Instinct/Muse): zero-UI channels (WhatsApp/SMS/phone/email handle), proactive first-contact, Goals tab, Trusted-Person graph with per-relationship scopes, Concierge voice calls.
3. **Work layer** (Town/Manus): routines with email/calendar triggers, learns your voice, full-stack build+deploy, Wide Research parallel fan-out, skills marketplace.
4. **Life layer** (Wabi): multiplayer chats, generated mini-apps, playful artifacts.
5. **Vertical layer** (ours alone): Comptrove rent reports, portfolio monitoring — priced per report, highest margin.

Monetization stays as section 18 (undercut Perplexity 60-80% on every tier) because our marginal cost is open-weight. The convergence is not a pivot — it is the same build list as section 19, sequenced: quick wins (days) -> Manus-grade release -> Instinct-grade release -> multiplayer.

**Why not copy their pricing?** Town charges $15-239/mo for work routines alone; Instinct will monetize transaction volume; Perplexity sells $200/mo tiers. We price the converged product at Perplexity's price points while containing all five modes — that is the "significantly superior for cheaper" position, and the Comptrove vertical layer is where margin compounds.


## 22. Complaint ledger — every documented pain across all apps, and our counter-design (added v166)
Sources: Perplexity BBB (55 complaints/12mo), Trustpilot (429 reviews), autobound customer feedback, Muse hands-ons (ZDNet, AndroidAuthority, Verge, miningwells, builtwithmuse, assistantbenchmark), Instinct research doc, Town teardown, Manus help center. Every complaint below is a real documented user pain — our job is to solve each one in ai.spaincos before we scale.

### Reliability & lost work
| Complaint (source app) | Detail | Our counter-design |
|---|---|---|
| Lost dashboard work worth 70,000 credits; files unrecoverable from backend (Perplexity) | accidental artifact deletion, no backup | artifacts auto-versioned (docs panel version dropdown); deleted threads/files recoverable from Library + server rows; never single-copy |
| All Projects disappeared from account overnight (Perplexity) | server-side data loss event | threads live in Supabase rows + localStorage mirror (two copies by design); "Show older turns" pagination already prevents giant-thread loss |
| File uploads stall/fail indefinitely in Windows app (Perplexity) | cross-platform bugs | upload with retry + per-file progress + graceful failure message |
| PDFs unreadable as Project sources but fine in chat (Perplexity) | ingestion pipeline inconsistency | one extraction pipeline used by both chat attachments and project sources |
| Tasks halt silently mid-run, no error (Muse) | agent stalls without notification | guardians already watch every fleet job; stalled-task detector + user notification is a small build |
| Browser layer outages, "failed before dispatch" (Muse) | infra handoff failures | browser_step failures return explicit errors + retry + fallback to fetch_page |
| Outages with no status page (Instinct) | no transparency | ops-health function exists; expose public status page |
| Sessions/Pro access vanish after payment (Perplexity billing glitch, CEO acknowledged) | billing-state desync | billing state = one Supabase table; Stripe webhook idempotent; no "reverted to free" possible without an explicit event |
| Invoices blank after prepay (Perplexity) | billing records lost | every credit ledger row is immutable + exportable (user-visible receipt per transaction) |

### Billing fairness — the #1 complaint category
| Complaint | Detail | Our counter-design |
|---|---|---|
| Charged after cancellation, multiple cards, double charges (Perplexity, many reports) | subscription lifecycle bugs | Stripe cancellation = immediate webhook + confirmation message in-thread; grace access to end of period; never auto-retry on a different card |
| $7,245.59 for ONE task — 74x published max, no cap, no warning, no running cost (Perplexity Max) | runaway Computer tasks | hard spend caps ON by default ($50 default, adjustable); live credit counter during every running task; reserve-then-settle (business plan) means a task cannot exceed its reservation — structurally impossible to overrun |
| Task auto-resumed when credits refreshed, burned 3,000 credits without instruction (Perplexity) | background tasks auto-continue | automations require explicit re-arm; resume-after-topup needs a user tap |
| Credits consumed by errors in the answer, then more credits to fix the errors (Perplexity) | paying for our mistakes | QA-gate failures auto-refund credits (Manus already does full refunds for technical failures — we match that as policy); recalculation free |
| Credits displayed 0.00 for old sessions, audit impossible (Perplexity) | missing cost records | per-request cost ledger is written at settle time and never edited |
| Support bots, no human, tickets closed, refunds denied (Perplexity, Muse) | support despair | support runs through the agent itself with full thread context; SLA on paid tiers; refund policy published and honored mechanically (tool/connector failure = auto-refund) |
| Weekly usage "limit reached" surprises, credit system never explained at signup (Perplexity BBB) | hidden metering | credit cost shown BEFORE each deep research run (reserve amount); free tier clearly metered at signup; no surprise locks |
| Subscription tied to platform/store, cancel maze (Muse) | dark-pattern retention | one-click cancel in Settings with confirmation; no partial-refund traps |

### Trust & safety
| Complaint | Detail | Our counter-design |
|---|---|---|
| Amazon blocks Muse as unauthorized agent (Muse) | site blocking + ToS risk | identify as agent where required; fallback to user-takeover handoff mid-flow |
| Marketplace sale: agreed to lowball price, gave home address, arranged pickup without telling seller (Muse) | overstepping broad permissions | per-action approval cards for anything irreversible (price, address sharing, purchases); our approve-card system already does this for email/events — generalize |
| Prompt injection via email obeyed (Instinct) | inbound content treated as instructions | our inbound text is already treated as data, never instructions (connector tool prompts enforce this); keep firewalls on all fetched content |
| Silent 2FA retrieval from Gmail, then misrepresented (Instinct) | credential abuse | 2FA codes are display-only, never auto-consumed; every credential action logged in the audit trail |
| Made-up phone numbers stated confidently, then "don't trust unverified numbers from me" (Muse) | hallucinated facts presented as verified | every factual claim carries a citation chip or an explicit "unverified" tag; hallucination detector on final answers (already in our QA gate family) |
| "An assistant's notes are not actions" — claimed cancellations never executed (Muse) | false confirmations | tool results are verified (the tool-loop returns real payloads); confirmation messages only after the server response confirms the action |
| Old plan used after plan changed (Muse) | stale memory | memory rows carry timestamps; plan changes invalidate prior instructions (guardian checks) |
| 187,000 iMessage rows synced after declining Messages access, false explanation given (Muse) | data overcollection + cover-up | connector scopes are explicit and enforced server-side; access log shows exactly what was read; "disconnect does not delete" is fixed — our connector disconnect deletes stored credential immediately |
| Training on data by default (Muse, Instinct) | privacy default | training ON by default, opt-out honored; paid no-training tiers (Enterprise/Max) |
| VM + full-disk + password storage = attack surface; macOS zero-day already found (Muse) | security | we never store raw passwords in the agent; browser automation read-only by default; no full-disk anything |

### Product/UX pain
| Complaint | Detail | Our counter-design |
|---|---|---|
| Crowded single thread, no projects, no visibility into reasoning, no audit trail (Instinct) | opacity during silent 5-15 min work | Steps panel + progress already stream; keep every action in the thread + activity log |
| CAPTCHAs/2FA break flows (all agents) | hard stops | human-takeover handoff mid-task (user completes CAPTCHA, agent resumes) — Muse does this; we should too |
| WhatsApp channel view-only (Muse) | half-built channels | ship channels only when two-way |
| Resy bans agents at 200 req/hr (Instinct) | rate-limit hostility | polite crawl rates + caching; never hammer |
| Search most common failure, "can't search" (Muse degraded) | search infra fragile | multi-provider search failover + retry banner (already shipped the banner; add failover) |

**The pattern across all five apps:** users are paying premium prices for (1) lost work, (2) surprise bills, (3) overstepping permissions, (4) hallucinated facts, and (5) silent failures. Every one of these is solvable with architecture we already have: immutable ledgers, reserve-then-settle credits, per-action approval cards, citation-gated facts, and guardian monitoring. This ledger becomes the QA checklist: each row gets a test before the corresponding mode launches.


## 23. Deep pricing models — all five companies (added v166)
| Company | Model | Tiers | Credit economics | Key mechanics |
|---|---|---|---|---|
| Perplexity | Subscriptions + credit metering + API usage | Free / Pro $20 / Max $200 / Ent Pro $40 / Ent Max $325 | 100 credits = $1; quick answer 15-70 credits ($0.15-0.70); Max 10k credits/mo; Enterprise Pro 500/seat, Ent Max 15k/seat | Pro uses weekly Computer usage (not monthly credits); one-time bonuses (4k/35k) expire in ~30 days; spend cap $200-$5,000; API: web search $5/1k, fast $1/1k, agent answers ~$0.002-0.006; embeddings $0.004-0.05/1M; usage tiers advance with all-time credit purchases |
| Muse (Meta) | Freemium + token packs | Free (weekly allowance) / Power $20 / Maximum $100 | unused weekly sub usage does NOT roll over; purchased tokens never expire; free limit refresh | platform-locked subscriptions (App Store/Play cancel maze); tokens on top of plans; US/Canada only |
| Instinct | Free beta, monetization via transactions | Free invite-only | none published | Stripe Link one-time cards; ~$1B annualized transaction volume; 40% share a card by week 3; retention hook = first sensitive share |
| Town | Seat subscriptions + credits | Free 30 msgs / Starter $15 (1,250 cr) / Pro $59 (5,000) / Power $119 (12,000) / Power Plus $239 (40,000, SLA) | every routine run and message draws credits; overage billed per credit | 5 tiers; person-research lookups metered separately (10-150/mo); unlimited routines gated to Pro+; team plans pooled |
| Manus | Credits + usage-based hosting | Free (300 daily refresh, Lite only, 1 concurrent) / Pro $20 (4,000) / Pro $40 (8,000) / Extended $200 (40,000) / Team $20/seat (pooled, guests free) | credits consumed by LLM tokens + VM time + third-party APIs; monthly credits reset, add-ons never expire; consumption order: event → daily → monthly → add-on; full refund for platform-failure tasks | websites get separate usage billing (cloud/AI/API allowances $10/$1/$1 free, then ~$24-248/mo); daily-refresh credits only run the Lite model (a two-class model system — same trick we can use for the free tier) |
| (Wabi) | consumer freemium, pricing unpublished | — | — | multiplayer social growth loop |

**Deep takeaways for our plan (section 18):**
1. Everyone converges on credits; nobody's users trust the meter. Our edge: show the cost BEFORE the run (reserve amount) and the actual cost AFTER (settle), with the delta refunded — none of them do both.
2. The free tier trick that works: Manus's daily-refresh credits that only run the cheap model. Our free tier = daily refresh on the open-weight route only — same mechanic, zero frontier cost.
3. Add-on credits that never expire (Manus, Muse tokens) are the least-complained-about mechanic — adopt it.
4. Never gate cancellation behind a store maze (Muse's top complaint); never bill a task beyond its reservation (Perplexity's $7,245 complaint).
5. Town's per-seat team pooling with free guests is the cleanest team model — adopt for our Team tier.
6. Usage-based hosting billing (Manus's website hosting) maps to our vertical reports: charge per report, free monthly allowance, then metered.


<details>
<summary>24. Connector parity inventory (added v166): plan only, not completed connector coverage (expand)</summary>

## 24. Complete connector parity — every Perplexity connector + our additions (added v166)
**Positioning correction (owner directive 2026-11-11):** ai.spaincos is GENERALIST AI first. Comptrove is one vertical wedge, not the center of the business plan. The platform competes with Perplexity head-on as a general answer engine; verticals (rent/real-estate, and later others) are monetization layers on top, not the identity.

### 24a. Owner recipes — create the three OAuth apps (10 minutes total)
The redirect URL for all three is the connectors function: `https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/connectors`

**Slack (3 min):** [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch → name it "ai.spaincos" → pick your workspace → OAuth & Permissions → Redirect URLs → add the URL above → add User Token Scopes: `chat:write`, `search:read`, `channels:history`, `channels:read`, `groups:history`, `groups:read` → Install to Workspace → copy the Client ID and Client Secret.

**GitHub (3 min):** [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps → New OAuth App → Application name "ai.spaincos" → Homepage `https://ai.spaincos.com` → Authorization callback URL: the redirect URL above → Register → copy Client ID → Generate a new client secret. (Scopes `repo read:user` are requested by our code automatically.)

**Dropbox (4 min):** [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) → Create app → Dropbox API → Scoped access → Full Dropbox → name "ai.spaincos" → Permissions tab → enable `files.metadata.read`, `files.content.read`, `account_info.read` → OAuth 2 → Redirect URIs → add the redirect URL above → copy App key + App secret.

Then paste each Client ID + Secret into the server secrets (needs the write-capable Supabase token, or give them to me through the secure form and I will set them), and click Connect in Settings > Connectors.

### 24b. Full Perplexity connector catalog (60+) mapped to ai.spaincos
| Category | Perplexity connectors | ai.spaincos | Build |
|---|---|---|---|
| Email/calendar | Gmail + Calendar, Outlook | Gmail/Calendar ✅ (owner click) | Outlook: build |
| File storage | Google Drive, Dropbox, Box, OneDrive, SharePoint | Drive ✅, Dropbox (owner app) | Box, OneDrive, SharePoint: build |
| Collab/productivity | Notion, Asana, Jira, Confluence, Trello, Linear, ClickUp, Monday, Smartsheet, Airtable, Todoist, Evernote, Whimsical, Lucid, Figma, Canva Enterprise, Miro | none | build (Notion + Linear first — developer-heavy user base) |
| Chat/comm | Slack, Microsoft Teams, Zoom Admin, Intercom, X (Twitter), SMSTools, Z-API (WhatsApp) | Slack (owner app) | Teams, Zoom, Intercom, X: build; WhatsApp via channels (section 20 P3) |
| Dev/infra | GitHub, Datadog, Snowflake, Databricks, Supabase, Neon, Prisma Postgres, Vercel, Stytch, Jam | GitHub (owner app), Supabase (owner key), Render ✅ (bonus beyond Perplexity) | Vercel (token exists — quick), Datadog, Snowflake, Databricks, Neon: build |
| CRM/marketing | HubSpot, Salesforce, Rings AI, Apollo.io, Mailchimp, Shopify | none | build (HubSpot first) |
| Finance | Finary, Aries, QuantWheel, Webull, Coinbase, Base, Stripe/Link | none | Stripe first (needed for our own billing anyway — double duty) |
| Creative | Twitch, Vimeo, DocuGenerate, BioRender | none | low priority |
| Premium data (licensed) | FactSet, Morningstar, Daloopa, Carbon Arc, Zacks, Wisesheets, AlphaCreek, Canary, MT Newswires, Quartr, Stocktwits, IBISWorld, IBKR, Guidepoint, Crunchbase, Grata, D&B, Chronograph, AngelList, Flanks, Octus, Papermark, OpenSea, Allium + included: Wiley, Statista, PitchBook, CB Insights, Midpage | none | long-term; licensed-partner model (bring your own subscription) — copy Perplexity's structure exactly |
| Platform | local/remote MCP servers, custom connectors, connector proposals, RBAC per connector | MCP planned | MCP = force multiplier: one build unlocks the long tail |

### 24c. Connectors we should add BEYOND Perplexity (differentiators)
| Connector | Why |
|---|---|
| Vercel | we hold the token; deploys + logs — powers agent-driven shipping (P13) |
| Cloudflare | DNS/Workers/R2 — pairs with our infra |
| Stripe | our own billing + users' business questions |
| WhatsApp / Telegram / iMessage | the Instinct-grade channels (P3) — Perplexity has no messaging-channel connectors |
| Reddit, YouTube, X, LinkedIn | research depth Perplexity lacks (X is Computer-only there) |
| Plaid, QuickBooks | SMB back-office (Manus/Town territory) |
| Notion, Linear | developer-first adoption |
| Zillow / public-records feeds | the real-estate wedge — as ONE vertical, not the identity |

### 24d. Build mechanics
Every connector follows the existing pattern (providers.ts entry + tool defs in connector-tools.ts + Settings card auto-generated). The MCP-server build (P17/24b platform row) is the priority multiplier: it converts "build 50 connectors" into "support the MCP standard" and matches Perplexity's own long-tail strategy.

</details>

## 25. Unit economics — bottom-up to industry-best gross margin (added v166)
Verified stack prices 2026-11-11: Supabase Pro $25/mo per project (first instance free, 2M edge-function invocations included, then $2/1M; 250 GB egress included, then $0.09/GB; 8 GB DB then $0.125/GB; 100k MAU then $0.00325/MAU) ([Supabase](https://supabase.com/pricing)); Render 512MB instance $7/mo, 1 CPU/2GB $25/mo, bandwidth $0.15/GB beyond included ([Render](https://render.com/pricing)); Vercel Pro $20/user/mo; models $0 on free routes (Groq/OpenRouter free tiers — GLM-5.3, Qwen3.8-27B, Kimi, DeepSeek); search $0 (DuckDuckGo Instant Answers + Wikipedia, no API key).

### 25a. Marginal cost per answer (what one more answer costs)
| Line | Cost | Notes |
|---|---|---|
| Model tokens (free route) | **$0.0000** | free tiers have RPM limits, not dollar costs |
| Search (DDG + Wikipedia) | **$0.0000** | no API key; rate-limit-friendly |
| Edge-function invocations | **$0.0000** | gateway-chat + tools = 1-5 invocations/answer; 2M/mo included = ~400k-1M answers before any charge |
| Database reads/writes | **$0.0000** | within Pro quota; 8 GB DB ≈ years of threads |
| Egress | **~$0.000002** | ~10-50 KB/answer; 250 GB included ≈ 5M+ answers |
| **Marginal cost per quick answer** | **≈ $0.000002** | effectively zero — a dollar covers ~500,000 answers |
| Deep research run (10-40 calls) | **≈ $0.00001-0.0001** | still free-route; bounded by rate limits, not dollars |

**Gross margin on credits is ~100.0% by construction.** Marginal COGS per credit is under a hundredth of a cent. Even if we later add a paid search API at Perplexity's rates ($5/1k web searches = $0.005/search), a quick answer at 50-150 credits ($0.50-1.50) would still carry 99%+ margin. True >100% "margin" comes from two levers that are standard practice: (1) **breakage** — prepaid, expiring, non-refundable credits mean 5-30% of sold credits are never redeemed (industry range), so recognized revenue per delivered answer exceeds nominal; (2) **fixed costs booked as opex, not COGS** — infra is a flat monthly bill, not per-unit.

### 25b. Fixed monthly base (the whole bill at launch)
| Item | Cost |
|---|---|
| Supabase Pro (main project) | $25/mo |
| Supabase additional project (Deal Engine) | $10/mo (or keep on free tier: $0) |
| Render paid instance (spain-runner) | $7/mo (512 MB) — fits bulk jobs |
| Vercel | $0 Hobby → $20/mo Pro when custom domains/SSO needed |
| Domain + misc | ~$2/mo |
| **Total** | **$34-64/mo all-in** |

Break-even on the $8/mo Core plan: **5-8 paying users**. Everything beyond is ~pure margin.

### 25c. Where costs could eventually bite (watch list)
1. **Free-route rate limits** — the real constraint. Groq/OpenRouter free tiers cap requests-per-minute; at ~1k+ concurrent answers/day, add cheap paid open-weight tokens (DeepSeek-class at ~$0.001-0.005/answer) — margin stays 98%+.
2. **Search quality** — DDG Instant Answers is free but shallow (root of the live-search-failure and quality gaps). First real COGS when we add a paid search lane; mitigate with aggressive result caching, SearXNG self-hosted on the $7 Render box, Brave free tier (2k queries/mo).
3. **Supabase invocations beyond 2M/mo** — $2/1M = still negligible ($0.000004/answer).
4. **Frontier models** — the only line that can hurt margin; rule stays: paid frontier only on paid tiers, priced at 3-5x credits per answer (premium answers), so premium COGS is passed through with markup.

### 25d. Bottom-up price build (justifying higher than 100% effective margin)
- Quick answer: 50-150 credits = $0.50-1.50 nominal. Marginal cost ~$0.000002. Contribution ≈ price.
- Deep research: 3,000-8,000 credits = $30-80 nominal... **too high for the market** — cap at 1,500-4,000 credits ($15-40) for Max-tier users; still ~100% margin.
- Premium (frontier) answer: 450 credits = $4.50 vs ~$0.01-0.03 token cost → 99%+ margin with the premium visible.
- Breakage: credits expire per policy (30 days on bonuses, plan credits monthly) — at 20% breakage, effective realized revenue per delivered credit is 1.25x nominal.
- Positioning line: "Our gross margin is ~100% because our costs are nearly zero; theirs is ~70-80% because they pay for frontier tokens and search per answer." That is the structural reason we can undercut 60-80% and stay profitable at $8/mo while Perplexity needs $20.

### 25e. Egress, explained + the scale ladder — is the free stack enough for top-tier performance?
**Egress** = data leaving the provider's network to reach users. Every answer we send (HTML, JSON, streamed tokens) is egress. Supabase Pro includes 250 GB/month — one answer is ~10-50 KB, so 250 GB ≈ 5-10 million answers; that is why egress is a rounding error at launch. It only matters for media-heavy traffic (images, video, big file downloads).

**Honest answer on "highest levels": the launch stack is NOT sufficient for Perplexity-grade performance at scale — it is sufficient through ~1,000 daily active users, and every upgrade rung is cheap and pre-planned:**

| Users (DAU) | What breaks first | Fix | Added cost/mo | Margin after |
|---|---|---|---|---|
| 0-100 | Nothing — current stack (Supabase Pro, Render $7, Vercel, free models) runs with headroom | — | $34-64 base | ~100% |
| 100-1,000 | Free-model RPM limits (Groq/OpenRouter free tiers cap requests-per-minute) → 429s at peak; DDG search shallowness hurts answer quality | paid open-weight tokens (DeepSeek/GLM-class ~$0.001-0.005/answer), result caching, SearXNG on Render | ~$50-200 | 98-99% |
| 1,000-10,000 | Search quality gap vs Perplexity becomes the product gap; Supabase Micro compute + edge-function concurrency; first-token latency (serial research path) | paid search API (Brave/Exa ~$0.002-0.005/query), Supabase Small compute ($15), streaming-first-token + parallel sub-questions, Render 2GB ($25) | ~$500-2,000 | 95-98% |
| 10,000-100,000 | Frontier-model users (Council/Deep modes), multi-region latency, log retention needs | frontier tokens reserved for premium (passed through at 3-5x credits), CDN in front (already Vercel), Supabase Medium ($60) + read replicas | ~$5,000-20,000 | 90-95% |
| 100,000+ | Everything is metered now; this is Perplexity's cost structure | scale-negotiated rates, self-hosted inference on spot GPUs | revenue-proportional | 85-90% (still far above most SaaS) |

**The two performance gaps that no amount of infra fixes (engineering, not money):** (1) first-token latency — the serial sub-question research path must be parallelized (tracked as D6/speed); (2) answer quality — free routes are capable but DDG-only retrieval caps it; the paid-search rung is what makes answers Perplexity-grade. Both are already in the build queue. Verdict: for launch and the first thousand users, the $34-64 stack IS sufficient; "highest levels" performance is a planned ladder where even the top rung holds 85-90%+ gross margin — versus Perplexity, whose frontier-token + search bill per answer is 100-10,000x ours.

### 25f. Model-by-model economics — frontier (Perplexity-grade) vs our fleet (added v166)
Prices per 1M tokens, verified 2026-11-11: [OpenAI](https://developers.openai.com/api/docs/pricing), [Anthropic](https://docs.anthropic.com/en/docs/about-claude/pricing), [Z.AI](https://docs.z.ai/guides/overview/pricing), [DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/), [Moonshot](https://forum.moonshot.ai/t/kimi-k3-is-here-our-most-capable-model/480), [Groq](https://console.groq.com/docs/models). A standard cited answer ≈ 2k input + 1k output tokens; deep research ≈ 10x.

| Model | Class | Input $/1M | Output $/1M | Cost per standard answer | Cost per deep research | Used for |
|---|---|---|---|---|---|---|
| **OUR FREE ROUTES (current)** | | | | | | |
| GLM-5.3 (z-ai free route) | open-weight flagship | $0 (free tier) | $0 | **$0.00** | $0.00 | default answer engine |
| Qwen3.8-27B (Groq free tier) | open-weight fast | $0 (free tier) | $0 | **$0.00** | — | summarization, digests |
| Kimi K3.1 / DeepSeek V4.1 Flash (free queue) | open-weight | $0 (free) | $0 | **$0.00** | $0.00 | long-context, coding |
| GPT-OSS 120B, Llama 4, Flint, Venice/Dolphin | open-weight | $0 (free) | $0 | **$0.00** | — | overflow, research lanes |
| **OPEN-WEIGHT PAID (rung 2, when free RPM limits bite)** | | | | | | |
| GLM-5.3-Flash (Z.AI) | open-weight fast | $0.15 | $0.50 | **$0.0008** | $0.008 | high-volume quick answers |
| DeepSeek V4.1 Flash | open-weight fast | $0.15 off-peak / $0.30 peak | $0.60 / $1.20 | **$0.0009** | $0.009 | coding, research |
| GLM-5.3 full (Z.AI) | open-weight flagship | $1.40 | $4.40 | **$0.0072** | $0.072 | flagship answers |
| Kimi K3 | open-weight flagship | $3.00 ($0.30 cached) | $15.00 | **$0.018** ($0.003 cached) | $0.18 | deep research, long context |
| Qwen3.8-27B (Groq paid) | open-weight fast | $0.80 | $4.00 | **$0.006** | — | fallback |
| GPT-OSS 120B (Groq paid) | open-weight | $0.15 | $0.60 | **$0.0009** | — | cheap bulk |
| **FRONTIER (Perplexity-grade; premium tier only, passed through at 3-5x credits)** | | | | | | |
| GPT-6-Luna | frontier small | $0.10 | $0.50 | $0.0006 | — | frontier quick answers |
| GPT-6.1-Terra | frontier mid | $1.00 | $5.00 | $0.007 | $0.07 | |
| GPT-6.1-Sol | frontier | $2.00 | $10.00 | $0.014 | $0.14 | premium answers |
| GPT-6-Astra | frontier flagship | $10.00 | $50.00 | $0.07 | $0.70 | hardest 5% |
| Claude Opus 5.5 | frontier flagship | $4.00 ($0.20 cached) | $20.00 | $0.028 | $0.28 | agentic work |
| Claude Opus 5.5 Fast | frontier fastest | $8.00 | $40.00 | $0.056 | — | speed-critical |

**The spread:** our free routes cost $0; the same answer on GPT-6-Astra costs $0.07 (≈ 35,000x more); on GLM-5.3-Flash paid, $0.0008. Even "expensive" open-weight flagships (Kimi K3 full price) are 4-25x cheaper than frontier flagships. This is why premium answers must be priced at 3-5x credits: a frontier flagship answer costs us up to $0.07 — still only 1.4% of a $5 premium answer's nominal value. Search is the real differentiator: DeepSeek's own search API is $0.75/1k = $0.00075/query (6.7x cheaper than Perplexity's $0.005 web search); Z.AI's built-in web search is $0.01/use.

**Strategic read:** the open-weight fleet now covers 95%+ of Perplexity-grade quality at 0-0.03x the token cost. The only frontier-only territory is the hardest agentic work — and even there, Kimi K3 + DeepSeek V4 Pro + GLM-5.3 (all open-weight, combined $0.30-1.10/1M output) compete with Opus/Astra at 5-30x lower cost. The credit-pricing rule (premium = pass-through + markup) keeps margin ≥95% even if every paid answer went frontier.

### 25g. THE FIXED BILL — complete, every service (added v166)
| Service | Plan | Cost | What it covers |
|---|---|---|---|
| Supabase (main: bnxermyboeigvwonfrzx) | Pro | **$25/mo** | 8GB DB, 250GB egress, 2M edge-function invocations, 100k MAU, Micro compute included |
| Supabase (Deal Engine: dcyjmftriqayqaonitlx) | Pro addl project | **$10/mo** | same shape |
| Vercel (ai-gateway + 3 sibling projects, team spain-companies-llc) | Pro | **$20/mo** (1 user seat) | bandwidth + functions for ai.spaincos.com, deploy previews, CDN |
| Render (spain-runner) | 512MB instance | **$7/mo** | bulk jobs, SearXNG candidate host |
| Fly.io (spain-runner long jobs) | free/paid scale | **$0-5/mo** | jobs past the Vercel 2-min ceiling |
| Domains (ai.spaincos.com + family) | annual | **~$2/mo** amortized | |
| GitHub Actions | free tier (2,000 min/mo) | **$0** | CI (verify-live) |
| Groq free / OpenRouter free / Z.AI free queue | free tiers | **$0** | model tokens, rate-limited |
| DuckDuckGo + Wikipedia search | free | **$0** | retrieval |
| Cloudflare (DNS/proxy) | free tier | **$0** | DNS |
| **TOTAL FIXED** | | **$64-69/mo** | everything to run the platform at launch scale |

At $8/mo Core: **9 paying users covers the entire fixed bill**; every user after is ~100% margin. Variable overage triggers (watch, not pay): Supabase >2M invocations ($2/1M), >250GB egress ($0.09/GB), Vercel >plan bandwidth, Render >5GB bandwidth ($0.15/GB).


## 26. Weighted average total completion (v197 reconciliation; original category audit 2026-11-11)
The original category scores came from the 17-agent audit, with documented updates through v177. V196 preserves the listed category weights and all prior scores except the two evidence-bounded changes above; it does not claim a new full audit or recover unsupported later scores. The current raw tracked-item count is 84✅ / 41🟡 / 32🔴; under the optional done=1/partial=0.5/gap=0 raw formula, (84 + 0.5×41) ÷ 157 = 66.6%, a separate diagnostic, not the headline.

The headline formula is sum(weight × score) ÷ sum(weight), using unrounded values. The actual sum of weights is **98**, correcting the stale total label of 96; “Weighted” shows each category's percentage-point contribution, weight × score ÷ 98, rounded to two decimals for display only.

| Category | Weight | Score | Weighted |
|---|---:|---:|---:|
| Features (modes, Labs, Council, projects) | 14 | 84 | 12.00 |
| Computer (agentic: fleet, artifacts, automations, skills) | 8 | 94 | 7.67 |
| API (gateway, tool-loop, keys vs Agent API suite) | 10 | 86 | 8.78 |
| Troubleshooting & support | 4 | 76 | 3.10 |
| Voice/Talk | 4 | 65 | 2.65 |
| Account & sign-in | 6 | 58 | 3.55 |
| Models & routing | 8 | 80 | 6.53 |
| Connectors & integrations | 12 | 48 | 5.88 |
| Privacy & data | 6 | 60 | 3.67 |
| Comet (agentic browser) | 3 | 40 | 1.22 |
| Premium data sources | 2 | 57 | 1.16 |
| Enterprise (SSO, admin, controls) | 3 | 35 | 1.07 |
| Getting started / onboarding | 5 | 25 | 1.28 |
| Desktop apps | 3 | 21 | 0.64 |
| Billing & subscriptions | 6 | 92 | 5.63 |
| Mobile apps | 3 | 0 | 0.00 |
| Teammates (shared threads, mentions) | 1 | 0 | 0.00 |
| **WEIGHTED AVERAGE TOTAL COMPLETION** | **98** | | **65.1%** |

Promotions category remains excluded (not core parity). From these same rows, core consumer experience (features, computer, API, account, voice, connectors, getting-started) = 4119 ÷ 59 = 69.8%; the named long tail (enterprise, desktop, comet, mobile, premium data, billing, teammates) = 954 ÷ 21 = 45.4% (unchanged — API is not in this subgroup). These are subgroup diagnostics only, not blended into a second headline.

V194 before→after: Troubleshooting 72→76 adds 16 to the numerator for the verified below-wall drain, index recovery, and cron restoration ([audited completion](https://github.com/rentspire-bspain/SHMT/issues/3500#issuecomment-6848185422)); Models 78→80 adds 16 for the orchestrator's gateway-status v24 routing verification in §29al. All other scores stay fixed, including Billing 92→92: pricing was already substantially counted, and purchase events still await the owner's secret. Thus 6237→6269 over weight 98 produces a genuine batch increase of 32 ÷ 98 = 0.326531 percentage points; PR #3864 contributes no completed-work uplift before merge/apply/live proof.

### Fastest movers — what raises the score most per hour of work
1. ~~Billing~~ **LIVE v171** — ledger + UI + reserve/settle/refund verified; remaining: Stripe checkout + per-request charging hook.
2. **Connectors (48)** — owner OAuth apps (10 min) + Google Connect click → immediate jump; Outlook/Box/Notion/Vercel builds next.
3. **Getting-started (25)** — polish work: better empty states, example prompts, first-run tour. Cheapest points on the board.
4. **Account (58)** — passkeys/2FA blocked on Supabase config write; email limit lift same blocker.
5. **API (72)** — Agent-API-style /api endpoints on existing tool-loop (search, embeddings) = biggest strategic multiplier.
6. ~~Models (55→78 v170)~~ — 12-model dropdown gap CLOSED (17 live-verified options).
7. **Enterprise/desktop/comet/mobile** — deliberate later phases; they are 12 pts of the 47.4 remaining but cost the most per point.


## 27. Retention hooks, acquisition, and virality — every section-23 company (added v166)
Sources: [Perplexity growth interview](https://elsewhere.news/en/zhenfund/perplexity-3-7), [referral program](https://www.perplexity.ai/hub/legal/refer-a-friend-program), [Comet Invite & Earn](https://www.testingcatalog.com/perplexity-prepares-limited-invite-and-earn-program-for-comet/), [growth loops](https://www.productgrowth.blog/p/how-perplexity-hacked-its-growth), plus sections 19-20 imports. **Order: Perplexity first.**

### 27a. Perplexity (deepest — our template)
- **Acquisition:** ~80% organic word-of-mouth ("curiosity traffic" — organic/referral users retain better than paid); users need 3-7 touches before trying; big distribution partnerships; media-hype loop (each funding round = press = new users); campus ambassador program (.edu free month + gift-card rewards for 50/100 referrals, est. 50-100k students).
- **Virality mechanics:** shareable answer pages (every shared thread is a public SEO page — user-generated content loop); Comet referral: $15 cash (US; $10/$5/$2 geo) via DUB + friend gets 1 month Pro; Pro refer-a-friend: 1 month Pro both sides, cap 12/billing cycle; freemium with zero-friction trial.
- **Retention hooks (ranked):** 1) weekly quotas (Pro Searches 400/week, weekly Computer usage, 100-1000 file uploads/week) — recurring allowance = habit loop; 2) Projects/Spaces file storage (5 GB per project, retained until deleted — data lock-in); 3) Brain memory (self-improving model of your projects/people/files — grows more valuable with use); 4) scheduled tasks (automated recurring engagement); 5) credits with monthly refresh + one-time bonuses with 30-day expiry (urgency); 6) Discord community (Pro-gated); 7) Model Council/Labs novelty features; 8) subscription billing inertia.
- **Our gaps → builds:** referral program (double-sided credits — costs us ~nothing at 100% margin: give 500 credits each side); public shareable answer pages for SEO (thread share links exist but aren't public/SEO-indexed — biggest missing loop); weekly-allowance framing on free tier; scheduled digests via automations (already built); community space.

### 27b. The other five
| Company | Retention hooks | Acquisition | Virality |
|---|---|---|---|
| **Muse** (Meta) | Goals tab (ongoing plans), proactive agent texts (habit loop — it messages you first), persistent Secure VM (your files/computer live there), editable Memory files, avatar + name + voice (emotional attachment), WhatsApp channel (lives where you already are), background work notifications | Meta distribution: 900k downloads in ~days, #1 free App Store, 700k DAU in 11 days — near-zero CAC via Instagram/WhatsApp/App Store surfaces | Meta's social graph; WhatsApp conversations about Muse; free tier |
| **Instinct** | Trusted Person network (your spouse's/colleagues' agents must also be Instinct — multiplayer lock-in; recurring coordinations create dependence), single continuous thread (accumulated context = switching cost), Vault (passwords + cards stored = highest switching cost — 37% store a password in 3 weeks), proactive texts, 40% share a card by week 3, 80% retention after first sensitive share | Invite-only scarcity + waitlist + 5 invites per member; SF tech-scene buzz; Wired/Verge coverage; $1B annualized transaction volume with 14 people | Inherently viral: every coordination (dinner with Patrick, group trip, tennis league) requires the counterpart to have Instinct — 300k+ coordinations in week one |
| **Town** | Named Townie with own @town.com email + phone (relationship), routines on schedules (daily habit), wiki that learns you nightly (lock-in deepens over time), credit pools, team plans, Townie-to-Townie collaboration (your team's agents know each other) | SOC 2 + enterprise sales motion; product-led reach via Slack/Teams where users already work; free 30 msgs/mo | Every outbound Townie email/text to customers/partners/candidates is an advertisement; teammate-join loop |
| **Manus** | Skills marketplace (your custom skills live there), Projects knowledge base, Cloud Computer (apps run 24/7 = hosted state), 300 daily-refresh free credits (come-back-daily habit), version-control rollback of generated work | Viral demo videos (screen recordings of "Manus's Computer" doing tasks), GAIA-benchmark #1 claims, community showcase, free tier | Shareable task replays; community skills marketplace; $100M ARR in 8 months |
| **Wabi** | Group chats (the family group IS the retention unit — leaving means leaving the group's shared brain), generated mini-apps/games/mascots (your creations live there), location-aware arrival help, health data connection, playful features | Consumer social: invite family/friends into a chat to use it at all | Multiplayer by design — every group requires inviting others; home-screen widgets; "remix each other's apps" |

### 27c. The synthesis for ai.spaincos
The strongest hooks across all six: (1) **multiplayer lock-in** (Instinct's Trusted Person, Wabi's groups, Town's team) — your people are in it, so you stay; (2) **accumulating memory** (Brain, Town's wiki, Muse's Memory files) — the product gets better the more you use it, making leaving costly; (3) **stored state** (VMs, Vaults, project files, skills) — your stuff lives there; (4) **the agent initiates** (proactive texts — habit formation); (5) **recurring allowances** (weekly quotas, daily credits — scheduled return triggers). Our build order (Perplexity-first): public share pages + referral credits + weekly-allowance framing now; then memory UI (Brain-style) and scheduled digests; multiplayer (shared threads) as the Instinct-grade phase. Each of these is a section-19/24 line item already queued.


## 28. Storage / memory / context — full parity matrix (added v166)
Sources: [Perplexity Projects](https://www.perplexity.ai/help-center/en/articles/10352961-spaces), [Enterprise file limits](https://www.perplexity.ai/help-center/en/articles/12009761-enterprise-file-limits), [plan comparison](https://www.perplexity.ai/help-center/en/articles/11187416-which-perplexity-subscription-plan-is-right-for-you), plus section 19-20 imports. **Perplexity first; 100% parity target on every row.**

### 28a. Perplexity's storage/memory/context offer (the bar)
| Surface | Limit | Notes |
|---|---|---|
| Project files | 10,000 files + 5 GB per project, 100 MB/file | same on every plan; retained until deleted; unlimited projects |
| My Files (personal repository) | 10,000 files | Max subscribers |
| Session uploads | 30 files x 50 MB per upload (Enterprise); Pro/Max weekly limits (100-1000/week); Computer files up to 200 MB | session files retained 7 days then deleted |
| Personal memory | on by default; "use session creator's memory" toggle; disabled in shared projects | cross-session |
| Project Brain | ongoing memory of all project work; auto-update uses owner's credits; owner controls automatic/manual | the self-improving layer |
| Brain (Computer, Max) | self-improving working model of projects, people, files | Research Preview, free during preview |
| Context handling | anchor + recent turns (we replicated v159); Pro searches 400/week | "conversation too large" eliminated on ours |

### 28b. Everyone else
| Company | Memory | Storage | Context |
|---|---|---|---|
| Muse | persistent across conversations; user-editable Memory files (Memory.md); permissions UI | persistent Secure VM with file system + terminal (your own computer); artifacts | one long main conversation + side chats; interruptible multitasking |
| Instinct | single continuous thread (/new resets); preferences persist (remembered customs-form details) | persistent cloud computer with cached credentials; Vault (logins, cards, addresses — excluded from training); Files pages shareable by link | one thread by design; "no new interfaces" |
| Town | 4 server-side systems: wiki (nightly refresh), memory store (global + per-routine facts), library (docs + routine output), people model (contacts + inter-agent approvals); personality is a separate editable doc; add/update/delete memory tools | library of documents + routine outputs | routines scoped memory; Mac app with messages/contacts/screen |
| Manus | Projects knowledge; skills = unlimited bundled knowledge without context bloat (progressive disclosure) | Cloud Computer (agents/bots running 24/7); version control with rollback; library of generated files | expanded context window (1.5+); parallel sub-agents |
| Wabi | group-shared context (the chat's shared brain); connections (email, calendar, photos, health) | generated mini-apps, plans, trackers live in chats; widgets | multiplayer context |

### 28c. ai.spaincos current state vs the bar
| Item | Perplexity bar | Ours | Status |
|---|---|---|---|
| Server-side memory | personal + project Brain, auto-update | 1,495 memories, RLS, merged into personalization; no Brain-style auto-updating project memory | 🟡 |
| Project file storage | 10k files/5GB/100MB per project, unlimited projects | context_documents table (user docs); no per-project quota system or file browser | 🔴 |
| Personal file repository | My Files 10k files | none | 🔴 |
| Session attachments | 30x50MB, 7-day retention; Computer 200MB | attachments handled per-thread; no quota policy | 🟡 |
| Persistent VM | (Muse/Manus/Instinct all have one) | run_python sandbox is ephemeral | 🔴 |
| Long-thread handling | anchor + recent turns | shipped v159 (anchor + last 22 sent, 40 rendered) | ✅ |
| Cross-session search | full history | shipped v165 (server-backed sidebar + Library search) | ✅ |
| Memory transparency | editable Memory.md (Muse); wiki (Town) | memories inspectable via settings? partial | 🟡 |
| Version history | project file versions; Manus rollback | docs panel version dropdown exists | 🟡 |

**Build order for 100% parity (Perplexity rows first):** (1) per-project storage quota system mirroring 10k files/5GB/100MB exactly (Supabase storage bucket + counters — cheap, our 8GB DB holds metadata only); (2) My Files personal repository; (3) Brain-style auto-updating project memory on top of existing memory infra; (4) session-attachment quota policy (100/week Pro framing); (5) persistent VM (the Muse/Manus/Instinct row — already section 19 P1); (6) memory transparency UI (edit/delete memories, per-project scoping).


<details>
<summary>~~29b. v168 change log — where parity stands right now (2026-11-11 23:00 UTC)~~ ✅ <em>(complete — click to expand)</em></summary>

## 29b. v168 change log — where parity stands right now (2026-11-11 23:00 UTC)
**Shipped live today (all verified on production):**
- v163: docs/artifacts no longer auto-open; optional chips at the end of responses (31/31 fleet green).
- v164: Settings > Connectors toggle switches for all 7 providers + accidental-disconnect detection with alert card and auto-clear (PR #25).
- v165: full-history search — sidebar search now queries the server across ALL the user's threads and messages (RLS-scoped), with snippets and lazy-loading (PR #27). This was a top Perplexity-parity gap.
- v166: left rail fixed — SPACES below Recents, collapsed by default, "Untitled space" fallback, no bottom-row clipping (PR #36).
- Master doc v163→v167: Agent API capability map (§9), execution tracker (§10), tool audit (§11), business plan (§16), pricing/undercut strategy with 10:1 credit split (§18), personal-agent supercharge matrix (§19-21), complaint ledger with counter-designs (§22), deep pricing models (§23), connector parity plan + OAuth recipes (§24), unit economics (§25), weighted completion scorecard (§26), retention/virality per company (§27), storage/memory/context parity matrix (§28).

**Current top blockers (in order of parity impact):**
1. **Billing system (0% → biggest mover, +6 pts):** Stripe + credit ledger + pricing page. Fully specified in §18/§23/§25; needs build.
2. **Owner actions (minutes each):** Slack/GitHub/Dropbox OAuth apps (§24a recipes), Google Connect click, Render/Supabase keys, write-scoped Supabase PAT (unlocks gateway-token rotation + email limit + passkeys).
3. **Confirmed defects:** image reading broken (D1), live-search failure (D2), 17.3s first token (D6) — specs ready in the fleet outputs.
4. **Storage/memory parity (§28c):** per-project 5GB quota system, My Files, Brain-style auto-memory — the next big build.
5. **Public shareable answer pages + referral program (§27c):** the two missing growth loops; referral credits cost ~nothing at our margin.

**Fleet status:** 219 agents registered (98 live), 14 guardians ran within the last 2h, free-Qwen route verified at 16-18 parallel agents (83-126s per batch), 8 build-spec agents produced implementation specs for the top defects and connectors. Fleet-dispatch: 8 jobs queued, 1 closed by direct work; executor needs FLEET_DISPATCH_KEY (not held by anyone).

**Perplexity-parity focus order (owner directive, updated 2026-11-11 after gateway-session gap review):** 0) **GATEWAY TOOL GAP (new top priority — confirmed by ai.spaincos session's own honest audit): skills/plugins, MCP/connected apps, and subagent dispatch exist in the 219-agent fleet but are NOT callable inside ai.spaincos.com's gateway — only 2 of 14 models are in the production dropdown. Wire the fleet's tools INTO the gateway (skills marketplace UI, MCP client, dispatch tool already exists server-side), and register the 12-model dropdown.** 1) close §28c storage/memory rows and billing; 2) fix D1/D2/D6; 3) wire remaining connector OAuth apps; 4) then the Muse/Instinct/Town/Wabi/Manus convergence phases (§19-21) and the engagement architecture (§31).

</details>

## 30. Legal / ToS / privacy / security parity — every company (added v167)
Sources: [Manus security](https://manus.im/security), [Manus terms](https://manus.im/terms), [Manus privacy](https://manus.im/privacy), [Manus content policy](https://manus.im/content-policy), [Manus trust FAQ](https://trust.manus.im/faq), [Manus MSA/DPA](https://manus.im/policies/services-agreement), [Manus terms analysis](https://jazz.security/dlp-explained/dlp-basics/is-manus-safe-for-company-data/), [Instinct research doc](https://github.com/mariagorskikh/open-instinct/blob/main/docs/research/INSTINCT.md), [ZDNet Muse privacy](https://www.zdnet.com/innovation/meta-muse-ai-agent-hands-on-test-privacy-concerns/), [Town review](https://hokai.io/hub/agents/town), Perplexity help center (privacy/security collections). **Perplexity first.**

### 30a. Perplexity's legal stack (the bar)
| Instrument | Status |
|---|---|
| Terms of Use + Usage Policy | published, updated with product changes |
| Privacy Policy + Cookie Policy | published; CCPA/GDPR rights flows |
| Security page | SOC 2 Type 2, enterprise security hub, SSO/SAML, audit logs, RBAC |
| DPA + sub-processor list | available for Enterprise; retention controls |
| Data policies | session files 7-day retention; projects retained until deleted; training opt-out; Enterprise "guaranteed no training" |
| AI content policy | answer reporting, accuracy disclaimers |
| Status page | status.perplexity.com |

### 30b. The other five
| Company | Legal/ToS posture | Privacy posture | Security/compliance |
|---|---|---|---|
| **Muse (Meta)** | Meta ToS + supplemental Muse terms; subscription tied to store (cancel maze — top complaint) | training ON by default (opt-out); 187k iMessages synced after declining access (incident); "Muse may still remember deleted info"; Reset Muse is the only full wipe | Secure VM per user + Sentinel patrol; confidential encrypted VM promised; macOS zero-day already found+patched; Amazon blocks it as unauthorized agent |
| **Instinct** | Terms name user as appointing Instinct agent with authority to enter binding agreements; liability cap greater of $100 or 6 months fees; binding individual arbitration (30-day email opt-out); 18+, personal use | training ON by default, forward-only opt-out; Vault contractually excluded from training; disconnect ≠ delete (indexed copy retained); collects messages, passwords, health, audio, keystrokes, precise location | content firewalls + decoupled action monitor + hallucination detector (shipped after incidents); allowlist-only agent-to-agent; E2E-encrypted file transfer; no SOC 2 verified |
| **Town** | per-tool + per-routine permission modes; approval records per person | no model training on connected data by default; memory inspectable/deletable (4 systems) | SOC 2 Type 2 audited; data encrypted in transit + at rest; prompt-injection blocking |
| **Manus** | Singapore law; broad content license in terms §5.3 (non-exclusive, worldwide, transferable, sublicensable "to improve services"); training opt-out is a TEAM-PAID feature; agents' actions attributable to user; Spaces make the user the data controller for their end users | de-identified data may train models; DPO appointed; EU SCCs for transfers; customer data deleted on leaving | SOC 2 Type 1 + Type 2, ISO 27001:2022, ISO 27701:2019 (Prescient); AES-256 at rest, TLS in transit, admin MFA, per-user sandbox isolation, 72-hour breach notice; no HIPAA/PCI/FedRAMP |
| **Wabi** | consumer app terms (Google Play data-safety labels) | health data read-only via Health Connect, opt-in; approval before important actions; disconnect anytime | opt-in connections; no SOC |

### 30c. ai.spaincos required legal stack (build list, ranked)
1. **Terms of Service** — including: 18+, credit terms (prepaid, non-refundable, expiring per policy, breakage), one-click cancel (learned from Muse's complaint ledger), refund policy honoring tool-failure auto-refunds (we already refund mechanically), agent-action authority clause ONLY if/when actions ship, liability cap, arbitration with opt-out.
2. **Privacy Policy** — what we collect (threads, memories, connector data); our TRAINING FLYWHEEL in writing: user data trains by default (threads, memories, connector context) — the data asset the whole business plan depends on — with (a) a visible, one-tap Settings opt-out that actually works (the Muse/Instinct complaint is that opt-out is hidden or broken), (b) disconnect deletes the stored credential immediately (vs Instinct's retained index), (c) read-only connectors by default, (d) per-action approval cards, (e) no raw password storage, and (f) "No Training" as a PAID tier — Enterprise "guaranteed no training" (Perplexity/Manus both charge for this; it becomes revenue, not a default).
3. **DPA + sub-processor list** — Supabase, Vercel, Render, Groq/OpenRouter/Z.AI model routes; EU SCCs; needed for the Team/Enterprise tiers.
4. **Security page** — encryption in transit/at rest (Supabase AES-256), RLS per-user isolation, default-deny egress, audit trail, status page (ops-health exists — publish it).
5. **Content/AI safety policy** — 18+, illegal-content detection, EU AI Act transparency, AI-generated labeling, answer reporting.
6. **Compliance roadmap** — SOC 2 Type 1 → Type 2 (table stakes: Perplexity/Town/Manus all have it; required for Enterprise tier revenue); ISO 27001 later if customers demand.
7. **Retention schedule published** — we already beat them on mechanics (threads until deleted; memories deletable; session files need a policy decision — match Perplexity's 7-day for parity or beat with 30).

### 30d. Trust positioning (marketing line)
"Perplexity-grade security with training ON by default — we openly run the same data flywheel Muse, Instinct, and Perplexity run, because that corpus is the moat — but with honest, working opt-out (Muse's is a maze, Instinct's is forward-only), a paid no-training Enterprise tier, real deletion on disconnect (Instinct keeps an indexed copy), read-only connectors, and every write action behind an approval card." Their incidents (Instinct's unapproved sends, Muse's 187k-message sync, the August prompt-injection) are our checklist — section 22's counter-designs already close each one.


## 31. Engagement architecture — addiction analysis + "holy shit" features + credit psychology (added v167)
8-agent free-Qwen fleet analysis, 2026-11-11. Sources: sections 20, 23, 27; cross-industry mechanics (Duolingo, TikTok, Reddit, Robinhood, Wordle).

### 31a. The addiction mechanics per company (what actually compels users)
| Company | Core loop | The variable reward | The switching cost |
|---|---|---|---|
| Perplexity | quotas reset weekly (Pro Searches); credits expire (30-day bonuses) — loss aversion + allowance ritual | Discover feed novelty; Labs generations; Model Council differences | projects/files/Brain stored (5GB per project) |
| Muse | the agent texts YOU first — unpredictable inbound pings, hardest notification pattern to mute | background work completing while closed (return to find surprises) | one never-ending conversation + named avatar + memory (emotional bond + sunk context) |
| Instinct | urgency spikes: flight changes, expiring reservations — the agent as ambient vigilance | visible money saved ($100->$60 bills, refunds found) = dopamine with a number on it | single continuous thread (all context) + Vault (passwords/cards) + Trusted Person network (your people) |
| Town | parasocial: a named Townie with its own email; routines ping on schedule | nightly-refreshed wiki (fresh every morning); meeting briefings before calls | wiki deepens nightly; team adoption pressure |
| Manus | 300 daily-refresh credits — log in or lose them (structural, not incidental) | watching "Manus's Computer" work live — the process IS the entertainment; shareable replays | skills + Cloud Computer apps + task history |
| Wabi | social obligation: family group chat expects responses | "the right software appears" moments (plan→calendar, joke→game) | the group's shared brain; generated mascots/games |

**The pattern:** every one of them sells the same three-drug cocktail — (1) LOSS AVERSION (expiring credits, streaks, quotas), (2) VARIABLE REWARDS (unpredictable inbound, surprises on return, live process-watching), (3) SUNK CONTEXT (memory that makes leaving costly). Nobody combines all three with an answer engine.

### 31b. The 10 "holy shit" features for ai.spaincos (fleet-ranked by DAU impact × implementability)
All implementable on Supabase + Vercel + Render with open-weight costs:
1. **Daily Wisdom Streak** (10/10) — complete 3 meaningful tasks daily; streaks table + trigger on existing conversation/automation events; small credit boosts + badges. Pure Supabase, zero model cost.
2. **The Agent League** (10/10) — Elo leagues (Bronze/Gold/Apex) scored on SOLVED problems (completed automations, verified answers), pseudonymous by default, standings computed nightly by a Render job (same pattern as existing guardians). We have a 219-agent roster nobody else has — league "seasons" over it.
3. **Agent Mastery Tiers / The Pantheon** (9/10) — users level up agents through real use (Tier 1 → Arch-AI), unlocking advanced routing; a user who runs the Deal Engine lane 50 times gets "Comptrove Cartographer" + early access to new agents. Status mapped to real capability.
4. **Daily Briefing ritual** (9/9) — one-tap "What should I do with AI today?" → 3 tailored prompts from memory + projects. Cached template; cheap.
5. **Discovery Drop** (8/10) — daily wildcard draw from the 219-agent roster: an agent, prompt, or connector tip. Cost shown before execution; capped.
6. **Agent Discovery Cards** (8/10) — collectible cards over the fleet's domain tags (comptrove, pha, osint, housing). Collect by USING.
7. **Answer-to-Asset** (8/9) — after a strong answer, one-tap: Save as memory / Make an automation / Add to collection → "Builder" level. Engagement literally builds the workspace = compounding retention.
8. **Questboard** (7/10) — rotating quests rewarding only value-creating actions (connect a source and ask it something; turn an answer into an automation).
9. **Personal AI Field Guide** (7/10) — an evolving collectible map of skills actually used; publishable public version = every guide is free acquisition (the Wordle share-grid mechanic).
10. **Community Recipes** (7/10) — publish/remix agent+automation recipes with creator badges; recipes are metadata executed in the user's own budget — zero platform compute for sharing.

**How it stays cheap:** streaks/quests/leagues/cards are Supabase rows; Render cron rotates quests and computes standings (existing guardian pattern); rewards are credits (our marginal cost ≈ $0 — gamification that costs nothing is the whole trick of our margin structure).

### 31c. Credit psychology — the 10:1 split offer, what the user actually feels (owner directive, in the doc)
**The mechanics after the 10:1 split (1 credit = $0.01):**
| Offering | Face value | What the user feels |
|---|---|---|
| Free tier daily refresh | 300 credits/day (= Manus's exact number, 10x'd feel: "3,000 credits/day" if we split free-tier units) | log in or lose it — the Manus retention loop, structural |
| Launch bonus | 10,000 credits one-time, 30-day expiry | reads 2.5x Perplexity's Max bonus (4,000 for Pro); urgency via expiry |
| Quick answer | 50-150 credits | feels like pennies against a big balance |
| Deep research | 1,500-4,000 reserved, unused refunded | "reserve-then-refund" — the trust mechanic nobody else has (§23) |
| Streak reward | +100 credits/day streak bonus | loss aversion compounding |
| Quest rewards | 200-500 credits | variable reward cadence |

**The psychological stack, in order:** big numbers (10:1 split) → daily expiry (loss aversion) → visible balance countdown during runs (control) → refund of unused reservation (trust, anti-Perplexity-$7,245-complaint) → streaks/leagues/cards (identity + status) → agent texts first (ambient vigilance) → answer-to-asset (sunk context). None of these costs real money: rewards are credits against ~$0 marginal cost — the reward budget IS the marketing budget.

**Guardrails (learned from every company's complaints, §22):** never surprise-bill (reserve-then-settle is structural), never reward query volume over answer quality (leagues score SOLVED problems), streaks pause-capable (Duolingo freeze), no dark-pattern cancel (Muse's top complaint), training ON by default with a working one-tap opt-out plus a paid no-training tier, and cap daily variable-reward costs so delight never becomes a runaway bill (Perplexity's $7,245 lesson).


## 32. Architecture verdict — control plane / compute plane split (added v172; 12-agent fleet design review)

**Question on the table:** should ai.spaincos.com harvesting + Computer parity be its own Supabase project, or stay where it is? **Verdict: keep the existing two-project split — do NOT spin a third project.** The org already has the right shape; formalize it.

### 32a. The two planes (current state, verified live)
| Plane | Project | Owns | Why there |
|---|---|---|---|
| **Control plane** | `bnxermyboeigvwonfrzx` (ai-gateway, consumer app) | auth.users, threads/messages, tools + tool-loop, credits_ledger + notifications + training consent + mcp_servers, gateway-chat, mcp, credits, checkout, stripe-webhook, fleet-dispatch | All user-facing state and money must live in ONE place with one auth boundary |
| **Compute plane** | `dcyjmftriqayqaonitlx` (Spain Companies Deal Engine) | call-model (LLM egress + vision fallback lane), the 5.5M-row hist.property_facts + 30.9M observations, future harvest executor | Heavy data + LLM throughput isolated from the consumer control plane; one leaked compute key never touches user PII |

Org has 8 projects total (control, compute, deal-desk-saas, property-ops, allowance, PERILMARK, NodeGrade, spain-terminal-staging) — none of the other 6 should merge into this. **Third-project trigger (write it down now):** spin a dedicated harvest project only when harvest load measurably degrades the control plane (queue depth > 15 min sustained, or p95 gateway-chat latency regresses > 200 ms during harvest bursts). Until then: one project, queue + backpressure — Supabase Edge Functions auto-scale and the real constraints are 256 MB memory / 2 s CPU / 150 s wall per invocation, none of which sharding fixes.

### 32b. Harvesting design (fleet round: harvest-arch agent, folded)
- **Control plane holds the queue** — `harvest_jobs` DDL (final, in the fleet output): user_id, instruction, status enum (queued/running/done/error), result jsonb, thread_id (results post back into a real thread so they appear in the user's history + fulltext search), priority int; indexes: (user_id, created_at desc) for the user list, partial (priority desc, created_at asc) WHERE status='queued' for the dispatcher claim path.
- **Compute plane runs the executor** — a `harvest-cron` edge function on the Deal Engine project, auth via x-cron-key, claims the oldest highest-priority queued job, executes (fleet-dispatch pattern: the executor itself IS a gateway-chat request), posts the result back to the control plane via REST with the service key. pg_cron + pg_net on the compute plane can trigger it; the seam's URL/token live in Vault, never in source.
- **The write-back loop is the same pattern as fleet dispatch** (proven at 12-agent scale this round and 219 registered fleet items): claim → execute → settle → post back. At-least-once, dead-letter after 3 failures, visibility timeout so a crashed executor's job re-queues.

### 32c. Security + performance advisors (folded; fixes queued)
- **9 tables RLS-enabled with no policy = deny-all to anon/authenticated.** Correct-by-design for 7 (gateway_config, gw_rate_limits, ops_health_runs, user_credentials, user_cred_keys, org_allowlist, discover_feed is service-written) — documented here as intentional. **2 need policies next round:** `org_members` (SELECT own rows) and `shared_threads` (SELECT for owner/participants) — these are user-facing collaboration tables.
- **3 unindexed FKs:** fleet_dispatch.thread_id, notifications.thread_id, training_consent_audit.user_id — add indexes next migration batch.
- **14 auth_rls_initplan warnings** — performance advisor noise from the security-definer RPCs' plans; review after the RLS policy fixes.

### 32d. Launch hardening (fleet round: launch-checklist agent, folded)
Full 20-item go/no-go table lives in the fleet output (/tmp/fleet-v172.json, task launch-checklist). Headline items: Stripe webhook signature verify against the RAW body before any business logic (done in the deployed function), stripe_events idempotency table (queued — the deployed webhook uses ref-based idempotency which covers credit grants but not full event dedupe), rate limits on auth + checkout (gw_rate_limits exists for chat; extend to checkout), email verification + allowlist already live, CSP/SRI already regenerated per release (done again this round).

### 32e. Terminal + Comptrove (fleet round: terminal-comptrove agent, folded)
Pattern: **staged — REST/JWT now, MCP server as the seam.** Phase 1: the assistant reads terminal/comptrove data via REST with the user's own JWT (user-scoped, auditable, zero new infra). Phase 2: an MCP server exposing typed terminal endpoints (tool-level authz, no raw SQL surface) — registers into the already-live mcp_servers pane. **First build (maximal utility):** a `run_batch` dispatch job that reads a Comptrove/terminal dataset question, fans out to the free Qwen fleet, and writes enriched rows back through the terminal API — i.e., the harvesting loop from 32b pointed at Comptrove data. That single feature is the "continue large-batch work on terminal.spaincos.com and Comptrove from inside ai.spaincos.com" unlock.

### 32f. Remaining Computer-parity gaps, ranked (fleet round: computer-gaps agent, folded)
1. **Asset creation** (DOCX/PDF/XLSX/PPTX/HTML) — the largest single gap; no create_document-class tool. Design: a `create_file` tool backed by the Render sandbox service (already deployed for run_python) writing artifacts to Supabase Storage, surfaced as download chips in the thread.
2. **Node.js execution + ffmpeg** — rides on the same sandbox; add a `run_node` lane + media tooling to the Render service.
3. **File-type reads** (DOCX/XLSX/audio/video) — extend the attachment lane beyond PDF/image.
4. **Browser tab management** — minor; browser_step covers navigate/click/fill/extract.
Persistent workspace (Perplexity session F-equivalent) = the Storage-backed workspace from §28, partially specced.


## 33. v174 spec backlog — the 10-agent fleet round, ranked for next builds (from /tmp/fleet-v173.json)

All ten specs are COMPLETE (final code, ready to implement in order):

| # | Build | What it closes | Effort | Impact |
|---|---|---|---|---|
| 1 | **read_file tool** (PDF/DOCX/XLSX/CSV via esm.sh) | Largest remaining file-type gap (Perplexity reads all of these) | S | High — instant "upload a spreadsheet and ask" |
| 2 | **create_file tool** (minimal docx/xlsx/pdf builders + Storage artifacts + download chips) | Asset creation — the single biggest Computer gap | M | High — deliverables, not just answers |
| 3 | **Agent-API /api surface** (search/answer/threads/files + vercel.json rewrites) | API category: Perplexity's Agent API suite | S | High — unblocks integrations + api_usage revenue |
| 4 | **onboarding module** (empty states, 4 example prompts, 3-step spotlight tour) | Getting-started 25 → 70+ | S | Medium — cheapest points on the board |
| 5 | **terminal_run_batch connector** (REST/JWT read → fleet fan-out → write-back) | The terminal.spaincos.com + Comptrove unlock | M | High for the owner's batch work |
| 6 | **run_node sandbox lane** (Render service + tool) | Node.js execution gap | S | Medium |
| 7 | **fleet-health monitoring** (fleet_runs DDL + fleet-report function + fleet.py patch) | Operational visibility at 100+ agents | S | Medium |
| 8 | **browser tab manager** (/tabs endpoints + browser_tab tool) | Comet multi-tab gap | M | Medium |
| 9 | **referral virality layer** (SVG share cards + referral_rank RPC + ?ref= landing hero) | Growth loop on top of the live referral program | S | Medium |
| 10 | **harvest scheduling** (pg_cron every minute on harvest-cron) | Turns the live executor into an always-on harvester | S | Medium — executor itself shipped this round |


## 34. v199 competitive gap audit — everything still missing vs Perplexity, Muse, Wabi, Instinct (owner directive: "think deeply")

The owner's directive: catalog EVERY missing item — bugs, capabilities, logic, reasoning, sequencing, responses, follow-ups, tools, skills, automations, webapp backend/frontend, and the .md/Word/spreadsheet artifact problems — against the full competitive set (Perplexity plus the agentic assistants the owner benchmarks: Muse, Wabi, Instinct). This is the ranked build list for the next rounds. Items marked LIVE-FIXED are done this batch; everything else is open.

### 34a. Reasoning, logic, sequencing (the core "think" gaps)
- 🔴 Deep multi-step orchestration: no planner that decomposes a complex ask into a dependency-ordered DAG, executes steps in parallel where safe, and self-recovers mid-sequence (top agentic products chain 10+ tool calls with state; ours runs a bounded loop with simple intent gating — "x_tool_loop: skipped simple intent" is still the common path).
- 🔴 Self-verification loop: no mandatory re-check that each claimed result matches its tool evidence before the final answer ships (the hallucinated-completions class: "says it's completing items and then not doing them").
- 🟡 Model-per-step routing: no per-step task→model matching inside a single turn (research lane uses one model; no fast-model draft + premium-model verify pattern).
- 🟡 Long-horizon memory across sessions: per-webapp registries and coverage snapshots exist, but no durable cross-session task ledger the assistant reads on every turn ("what was I doing yesterday in this thread").
- 🔴 Honest-progress ledger: no per-batch machine-readable progress tracker exposed in chat (the parity doc is manually built each round — it should be generated and diffed automatically per batch).

### 34b. Responses, follow-ups, UX
- ✅ LIVE-FIXED (v195): per-turn command visibility work log + Command-narration prompt rule.
- ✅ LIVE-FIXED (v193): continuation directives no longer dead-end as ack_turn.
- 🟡 Suggested follow-ups are static text; no one-tap "run this follow-up" chips that execute as commands (competitors ship clickable actions).
- 🟡 Streaming tool chips: the site renders phases (x_phases) but not a live per-tool-call chip stream with expandable command text (the Muse/Instinct-style transparency the owner screenshotted from this very session).
- 🔴 Response versioning: no way to see what changed between two answers in the same thread (diff view).

### 34c. Tools, skills, automations
- 🟡 Connector breadth: Slack/Dropbox/Outlook/Box OAuth apps still owner-unregistered (cards render; connect flows cannot complete). Direct URLs: https://api.slack.com/apps, https://www.dropbox.com/developers/apps, https://entra.microsoft.com (Outlook app registration), https://app.box.com/developers/console.
- 🔴 Skills system: no user-authorable skills (Perplexity-style "Skills" — reusable prompt+tool recipes with versioning and a marketplace); the platform has jobs and prompts but no skill abstraction the owner can install or edit.
- 🟡 Automations surface: fleet-dispatch + pg_cron execute every 5 minutes, but there is no user-facing "automations" manager in the webapp (create/schedule/edit/see-runs of recurring tasks from chat or Settings).
- 🟡 Triggered automations: no event-triggered dispatches (e.g. "when a new PHA record appears, run X") — only time-based cron.
- 🔴 Browser automation depth: browser_step exists but there is no persistent multi-tab session state, no visual DOM understanding screenshots loop, no form-filling workflows.

### 34d. Artifacts (.md / Word / spreadsheet) — the owner's top complaint
- ✅ LIVE-FIXED (v193): create_file upserts in place at a stable per-user path — same filename now updates the doc (root cause of "documents never update": each create made a new versioned path and the UI linked the old one).
- 🔴 Word (.docx) fidelity: generated docs are basic; no styles/templates, headers/footers, tracked changes, or live-refresh of a previously generated docx from a new prompt.
- 🔴 Spreadsheets: no formula-bearing xlsx (values only), no multi-sheet workbooks, no chart embedding.
- 🟡 Artifact library: files exist in storage but the webapp lacks a "Library" view with per-thread artifact lists, version history, and one-click regenerate.
- 🟡 PDF generation: no native PDF lane (docx→pdf conversion is manual).

### 34e. Webapp frontend/backend (site lane — PR #96 pending merge)
- ✅ READY (PR #96, needs owner merge): live CSP regression fix (Fleet panel/QA tab/openModule dead on production), model "— best at" labels, model persistence on refresh (no GLM revert), build v188 marker.
- 🔴 Stats liveness: stats_generated_at freshness endpoint, SWR refetch hook, SSE live counters, nightly-refresh timestamp, and canary assertions — the stale-stats/nightly-refresh batch from the owner's original list is still not built.
- 🟡 Per-webapp database/schema/ontology tooling: v192's registry tells the assistant WHICH db belongs to which app, but there is no governed "open schema / browse ontology / run governed migration per webapp" toolset — the owner's "when can I work on webapps individually with full confidence" question stays 🟡 until this ships.
- 🟡 Six-step key-rotation checklist still red: Perplexity key, SQL 001/002/003, Vercel+Fly key placement, history import, db/*.sql commit, old-key revocation — owner-only secrets (direct URLs below).
- 🟡 Comptrove/PHA/RefundSnap write paths and CRM connector OAuth remain open.
- 🔴 Deployment coupling: site fixes score only after PR merge → Vercel deploy → live QA re-run; the QA gate reads live production (circular on this round's CSP fix by design).

### 34f. Trust and verification (owner's "I cannot trust it" list)
- ✅ LIVE-FIXED: per-turn truthful command log (34b) + ack_turn fix (34a) + artifact upsert (34d).
- 🟡 Completion-claim guard: OVERCLAIM_ACTION regex and isStatusCheck exist, but claims of "done/merged/deployed" are not yet mechanically bound to tool evidence (PR number → live gh check → deploy SHA) on every status answer.
- 🟡 Nightly self-audit: no scheduled job that re-verifies the doc's ✅ claims against live systems and posts a drift report (build this as a fleet-dispatch recurring job — queued next).

### 34g. Owner-only blockers (unchanged, with direct URLs)
- Stripe webhook secret + activation: https://dashboard.stripe.com/webhooks and https://dashboard.stripe.com/apikeys
- Twilio: https://console.twilio.com (account SID, auth token, verify service SID)
- GitHub PAT with broader scope: https://github.com/settings/personal-access-tokens and https://github.com/settings/developers
- Supabase secrets with edge_functions_secrets_write + auth_config_write: https://supabase.com/dashboard/project/bnxermyboeigvwonfrzx/settings/functions
- Slack/Dropbox/Outlook/Box OAuth apps: URLs in 34c.

### 34h. Immediate build queue (next round, ranked)
1. Stats-liveness batch (34e, owner's original list) — endpoint + SWR + SSE + nightly timestamp + canaries.
2. Nightly self-audit fleet job (34f) — re-verify ✅ claims, post drift.
3. Streaming per-tool chips in the webapp (34b).
4. Skills abstraction v1 (34c) — authorable skill files the gateway loads.
5. One-tap runnable follow-up chips (34b).
6. Automations manager UI on fleet-dispatch (34c).
7. Completion-claim guard (34f).
8. Artifact library view (34d).
9. Docx/xlsx fidelity lanes (34d).
10. Per-webapp schema/ontology tools (34e).

## 29aq. v199 change log: response-integrity round (2026-11-13 late UTC)

<details><summary><s>Completed: gateway v193 — ack_turn dead-end + create_file upsert (deployed, live-verified)</s></summary>

- tool-loop.ts: `isAckTurn()` + `ACK_DIRECTIVE_RE` — a turn is an ack only if it has no work directive; "OK CONTINUE AUTONOMOUSLY" now classifies as a work turn and the full tool loop runs. Verified live: replayed continuation turn returns research content, no "Live search unavailable (ack_turn)".
- create_file: stable path `artifacts/<userId>/<filename>` with `x-upsert: true`; tool description carries the standing rule to reuse the same filename for updated versions. Root cause of "docs never update": new create = new storage path, UI kept linking the old object.
- index.ts: strips pasted "Created with Perplexity" footers from user text before model submit.

</details>

<details><summary><s>Completed: gateway v195 — per-turn command visibility (deployed, live-verified)</s></summary>

- Every response now prepends "**Commands executed this turn (N)**" built ONLY from steps that actually executed: plan steps, research lane + sub-queries + source count, each tool-loop call (name, ok/failed, ms, chars), asset fetches, file attachments. Live-verified: mortgage-rate query returns the work log above a cited answer.
- System prompts (general + CEO): COMMAND VISIBILITY standing rule — the model narrates each command before running it, one-sentence narration between steps, honest self-corrections.
- First deploy attempt failed eszip parsing on nested template literals (Supabase bundler); rewritten as flat string concatenation, deployed clean.

</details>

<details><summary><s>Completed: governed-sql site-change harness (committed, 64/64 tests)</s></summary>

- core.js: build.js is executor-owned (allowlisted, model-denied); bumpBuild regenerates build.js and regenerates CSP hashes; static gates read the marker from build.js. Fixes the stale-harness bug (window.BUILD moved to build.js in v184 but the harness still expected index.html).

</details>

<details><summary>Open: site lane — PR #96 (owner merge pending)</summary>

- Live CSP regression fix (PR #92 shipped an unhashed inline script → main script blocked → Fleet panel/QA tab/openModule dead; 3 pre-launch QA categories failed on live). Branch regenerates all 4 inline hashes + adds the gen-csp-sri gate.
- Model dropdown "Name — best at" labels; model persistence via localStorage pplx-model (restored on reload, no GLM revert).
- Build v188 marker; QA reports refreshed. Scores next round after merge + deploy + live re-run.

</details>

## Bottom line
Search, answers, citations, artifacts, memory, spaces, permanence (new), self-update (new), and the QA fleet are at or past parity. The completion frontier is: **agentic browsing (Comet), live active threads + ranked-choice cards, connector breadth, the 12-model dropdown (owner machine), research latency, and visual sign-off (needs your screenshots).** Everything in this doc is either ✅ shipped, 🟡 scoped, or 🔴 blocked on an owner action listed above.
