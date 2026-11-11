# ai.spaincos.com — SOC 2 retention policy and governance record

Date: 2026-11-11 | Owner: Brett Spain | Status: DECIDED (owner rulings recorded below)

This record implements the SOC 2 Type II inclusion decisions for ai.spaincos.com
(the Vercel `ai-gateway` project, backed by Supabase `bnxermyboeigvwonfrzx`).
It is the authoritative reference for the retention policy and the change-management
rationale; the risk register and phased hardening plan live in the SHMT repo
(`docs/soc2/AI_GATEWAY_SOC2_INCLUSION_PLAN_2026-11-11.md`).

## 1. Retention policy — 12 months (owner ruling)

Saved conversation data expires 12 months after last activity:

| Data | Rule | Mechanism |
|---|---|---|
| `threads` | deleted when `updated_at` > 12 months | `/api/retention` (daily 09:00 UTC Vercel cron) |
| `thread_messages` | deleted with their thread | same (children first, FK-safe) |
| `context_documents` (Perplexity history imports, uploads) | deleted when `created_at` > 12 months | same |
| `shared_threads` (revoked copies) | deleted when revoked > 12 months | same |
| `ops_health_runs` | 14-day trim (operational hygiene, not PII) | same |
| `memory_items`, `spaces` | retained (user-curated, not conversation history) | documented exclusion |
| Incognito threads | 24 hours (existing behavior) | app-level |

Exceptions: documented legal holds (litigation/audit preservation) suspend the
deletion for the affected rows; holds are recorded with reason and expiry.
Client-side caches (localStorage `ai_threads` etc.) are browser-local and expire
with the browser data; the server policy is authoritative.

Implementation: `api/retention.js` (dry-run by default; the cron passes
`execute=1`). Each table's outcome is logged per run. First verification: run
`/api/retention` (dry) and confirm the counts, then let the cron execute.

## 2. Change management — integrity-only protection (owner ruling, CC8.1)

`master` of `rentspire-bspain/ai-gateway-site` auto-deploys to production.
Owner ruling (2026-11-11): integrity-only branch protection.

- Required status check: `verify` (the live-site md5 post-deploy guard).
- Force pushes: BLOCKED. Deletions: BLOCKED. Enforced for admins.
- Direct pushes: ALLOWED (no PR or review requirement).

Rationale (documented for the auditor): single-developer repository under rapid
iteration (~15 direct commits/day, owner-operator). The controls that matter for
this risk profile are deployed: history integrity (no force pushes/deletions),
a post-deploy verification gate proving production matches the repo, and full
commit provenance. Full four-eyes review (PR + CODEOWNERS approval) is applied
on the SHMT compliance-critical repo; this repo carries the lighter, documented
tier. If the developer count changes, upgrade to full four-eyes.

## 3. The -2 ledger relay — keep in place, documented (owner ruling)

`GITHUB_LEDGER_TOKEN` stays in the `ai-gateway` production environment for the
R-010 ledger relay (`/api/ledger-verify`). Compensating controls: the token is
never echoed, comparisons are constant-time, the endpoint returns only the
authenticated login, and Vercel platform authentication gates the direct
*.vercel.app deployment URLs. Risk accepted and documented; revisit if the
gateway's attack surface grows (public API surface, third-party contributors).

## 4. Sub-processors (prompt data leaves the boundary via model routing)

| Provider | Use | Data |
|---|---|---|
| OpenRouter | DeepSeek V4.1 Flash (pinned, paid), Flint free | prompts + context |
| Groq | free-tier general/coding models | prompts + context |
| Cloudflare Workers AI | glm/gemma/nemotron free tier | prompts + context |
| Perplexity API | research answers (`perplexityKey`) | prompts |

Vendor pack action (owner): DPA status + SOC 2 report or mapped questionnaire
for each, added to the vendor register before the Type II window's evidence
collection. Prompt data must not include tenant/customer PII (the gateway is
single-member use; the retention policy above governs history).

## 5. Auth

Supabase Auth (email 6-digit code). MFA enforcement for the gateway's auth
project mirrors the estate-wide CT-05 item (owner action, in the consolidated
list). Server-side auth verification on every gateway-chat call (401 otherwise)
is already enforced.
