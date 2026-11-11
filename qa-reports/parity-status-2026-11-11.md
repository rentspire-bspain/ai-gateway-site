# ai.spaincos.com — Total Parity Status vs Perplexity
**2026-11-11 · Comprehensive · ✅ at parity · 🟡 close/partial · 🔴 gap**

## 1. Core search & answer experience

| Area | Status | Detail |
|---|---|---|
| Simple/lookup queries | ✅ | Paris-class queries answer correctly < 30s (fleet-gated daily) |
| Current-events queries | ✅ | Research-sufficient fast path; 30yr-mortgage-class < 35s (regression-guarded — the 41s lookup bug is dead) |
| Citations & sources | ✅ | Canonical numbered source list, junk-host gate, citation chips, Sources picker |
| Deep/complex research | 🟡 | 94.6% parity-or-better on deep100; complex 76.9%. Residual: complex first-token ~70s (research sub-questions run serially — parallelizing without cutting quality is the open work) |
| Multi-turn quality | ✅ | deep100 multi-turn: 26→52 BETTER, 100/100 clean runs |
| Answer modes | ✅ | Research, Deep Research, Council, Incognito, Labs (image/video), Voice/Talk/Fit all shipped |
| Models | 🟡 | Open-weight fleet: GLM-5.3 (auto), Kimi K3.1 Pro, DeepSeek V4.1, Qwen3.8, GPT-OSS 120B, Llama 4, Venice/Dolphin uncensored. **Gap: no frontier models** (GPT-6.1/Claude/Gemini class) — deliberate cost decision, but it caps the ceiling on the hardest 5-10% of queries |
| Memory | ✅ | Server-side now (1,495 owner memories, RLS, merged into personalization, capped at 60) — no more localStorage dependency |
| Python/computation | ✅ | Execution guarantee: forced retry synthesizes + runs a script in the Python sandbox when the model tries to hand-wave |

## 2. Artifacts (docs, webapps, exports)

| Area | Status | Detail |
|---|---|---|
| .md documents | ✅ | Fenced markdown → single doc-chip (raw dump collapsed), side panel with Perplexity artifact typography: 15.5px/1.75, **900px measure, 62% default width (widened today per owner)**, booktabs tables, numeric right-align, code bars with language label + Copy + syntax coloring |
| .docx / .pdf / .xlsx export | ✅ | Download menu on every md/txt artifact |
| Webapp generation | 🟡 | **Works end-to-end**: WEBAPP_RULE + isWebappAsk route webapp asks to a builder prompt; unfenced-HTML detection; renders live in a sandboxed iframe side panel (v145). **Gaps vs Perplexity Computer/Labs**: no persistent webapp hosting (artifacts are per-thread blobs, not shareable URLs), no scheduled/agent-driven webapp building, and output quality on complex apps hasn't been eval'd the way deep-research has |
| Charts | ✅ | ```chart fences render inline (bar/line/pie) |
| Files/attachments | ✅ | Images/text/PDF splice or ride the vision lane; csv/xlsx render in panel with sheet tabs |

## 3. Perplexity Comet (browser + assistant)

| Area | Status | Detail |
|---|---|---|
| Chrome extension | 🟡 | ai.spaincos.com Assistant v1.0.0 shipped (real per-message safety gating, vault-always, dead-gate watchdog) |
| Agentic browsing in-product | 🔴 | No Comet-class browser. Comet does autonomous multi-tab browsing, form filling, and background agents. We have a `browser-service` container (Dockerfile + main.py) as a headless-browser backend, but it is **not wired into gateway-chat as a tool the model can drive** — that's the single biggest missing product surface |
| Background agents | ✅ (different shape) | Guardians + fleet-dispatch + automations give scheduled agent work Perplexity doesn't expose to users |

## 4. Connectors & API keys

| Area | Status | Detail |
|---|---|---|
| OAuth connectors | 🟡 | Slack, GitHub, Dropbox (provisioning incl. repo/PR actions). Google (Gmail/Calendar/Drive/Sheets read-only) is **built but needs the owner to reconnect it in Settings→Connectors** (expired refresh token — the #1 pending user action) |
| API-key providers | 🟡 | Render, Supabase (stored server-side, EMBEDDED_SECRETS, never printed). Owner still needs to paste keys for full function |
| Breadth | 🔴 | Perplexity-class breadth (Notion, Linear, Jira, Figma, Salesforce…) absent — architecture supports adding providers, each is a build |
| In-chat tool use | ✅ | connector-tools: the model can read/send email, search Drive, post Slack, act on GitHub during a chat |
| Platform API (api keys for OUR product) | 🟡 | apikeys module exists (users mint keys, use /api endpoints). Usage docs + rate limits thinner than Perplexity's API |

## 5. Spaces / Projects / Library / organization

| Area | Status | Detail |
|---|---|---|
| Spaces | ✅ | 20 spaces imported w/ custom instructions riding requests |
| Threads | ✅ | 5,647 threads / 87,847 messages imported and searchable (sidebar search now fixed + quota-hardened) |
| Library / Discover / Tasks / Hubs | ✅ | All shipped (media labs, entity cards, hubs weather/city) |
| Projects (Perplexity-style) | ✅ | projects.js module shipped |

## 6. Infrastructure & reliability

| Area | Status | Detail |
|---|---|---|
| Hosting | ✅ | Vercel (frontend, deploy-on-push), Supabase edge functions (gateway v153, connectors v9, guardian-runner, fleet-dispatch, task-runner, research-jobs), Render (Python sandbox + browser-service). Verified directly — no mystery layers |
| Launch gate | ✅ | 29-check pre-launch fleet (backend smoke, deploy integrity, frontend E2E, thread routes, doc panel, Fleet QA tab, CSP/JS) runs pre-push, post-deploy, and daily at 6am PT (automation 0568559c) |
| Visual parity lane | 🟡 | Side-by-side machinery + measurements exist; live typography matches Perplexity's recorded spec and serves their own webfont, but fresh ground-truth screenshots from Perplexity are blocked (Cloudflare) — needs one human-eye pass to sign off |
| Stale-browser defenses | ✅ | SW network-first + one-time resets (v100), build badge (v157), stale-tab detector bar, quota-hardened storage |
| Guardians | ✅ | 14 guardians, Fleet page (Overview/Guardians/QA tabs), dispatch ledger |

## 7. Known residuals (honest list)

1. **Complex deep-research first-token ~70s** — parallelize research sub-questions without quality loss
2. **Webapp artifacts not eval'd or hosted persistently** — quality gap unknown; no shareable URLs
3. **No agentic browsing** (Comet gap) — browser-service exists but isn't a gateway tool
4. **Google connector needs owner re-auth; GitHub/Slack/Dropbox/Render/Supabase keys need pasting**
5. **Frontier models absent** — hardest queries hit the open-weight ceiling
6. **Visual parity unsigned** — typography measured at spec, but no fresh side-by-side vs live Perplexity (sandbox is Cloudflare-blocked)
7. **5 unidentified 404 console resource errors** on live (filtered by fleet; cosmetic)
8. **Mobile** — responsive + PWA shipped; no native apps
9. **passkeys_enabled** toggle still off in Supabase dashboard (owner action)
10. **SHMT PR #3818** merge + cron_key/browser_service_token rotation (owner actions)

## Bottom line

Search, answers, citations, docs/artifacts, memory, spaces, guardians, and the QA/launch fleet are at or past parity — several things (guardians, launch gate, uncensored models, execution guarantee) are beyond Perplexity. The three genuine product gaps: **agentic browsing (Comet), persistent/eval'd webapp generation, and connector breadth** — plus the owner-action list above. Fixing 1-3 of section 7 is what moves "significantly superior for cheaper" from mostly-true to fully-true.
