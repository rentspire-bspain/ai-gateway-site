# Deploying ai.spaincos.com (durable path)

Primary path: Vercel REST API with a saved Vercel personal access token (vault handle
`custom-cred:<uuid>@api.vercel.com`, team `spain-companies-llc` / `team_qpLUu8GANcBKGRNwaQP1J1gl`).
Do NOT use the Vercel OAuth connector as the primary path.

- Project: `ai-gateway` (prj_mkgPk4qdRGWbKS9S9W6h73knAaJy), NOT `ai-gateway-site` (empty, no domains).
- Domain: ai.spaincos.com. The project has no Git link; deploys are uploads (source: cli/API).
- Files shipped: CNAME, api/geocode.js, index.html, package.json, robots.txt.

Deploy: POST https://api.vercel.com/v13/deployments?teamId=...&forceNew=1 with
{name:"ai-gateway", project:"ai-gateway", target:"production", files:[{file,data(base64),encoding:"base64"}]}
Run via `pplx credentials run <handle> -- curl ...`; never print the token.
Verify: poll GET /v13/deployments/{id} until READY and aliasAssigned, then compare md5 of https://ai.spaincos.com with index.html.

## Why the OAuth connector kept disconnecting
OAuth connector grants are short-lived/refresh-dependent and tied to an interactive consent; each lapse needs
a human reauthorization. Personal access tokens do not expire on that cycle (unless an expiry was set at creation)
and need no refresh. Note: the connector was not the only gap - nothing auto-deploys, since the project has no Git
integration, so merges to master never publish without a manual API/CLI deploy.
Follow-up: consider a GitHub Action deploying on push using a VERCEL_TOKEN repo secret.

## Update: Git-linked auto-deploy
The live Vercel project is `ai-gateway` (prj_mkgPk4qdRGWbKS9S9W6h73knAaJy). On 2026-11-02 it was linked to this repo
(POST /v9/projects/{id}/link {type:github, repo:rentspire-bspain/ai-gateway-site}); production branch = master.
Every push to master now auto-deploys to ai.spaincos.com through Vercel's Git integration - no token, no OAuth connector.
A GitHub Action with a VERCEL_TOKEN secret was not needed (and the vault token value cannot be read out to set as a secret).

## Verification and /api/geocode
- `.github/workflows/verify-live.yml` runs on push to master and on demand; it md5-compares https://ai.spaincos.com with index.html and fails red if they differ.
- `/api/geocode` returning 401 is BY DESIGN: api/geocode.js requires the X-Worker-Token header (or ?token=) matching env GEOCODE_WORKER_TOKEN and returns 401 `unauthorized` otherwise. Code is unchanged by the move to Git deploys. Direct *.vercel.app deployment URLs additionally sit behind Vercel Authentication (302).

## Post-deploy verification checklist (standing gates)
Run after every production frontend or `gateway-chat` deploy (all four stay lightweight; no full benchmark suites):

1. `python3 qa/e2e-real-flows.py --url https://ai.spaincos.com` (and `https://boundview.com`) — 9 browser shell flows.
2. `python3 qa/e2e-ux-flows.py --url https://ai.spaincos.com` — 9 signed-in experience flows.
3. `python3 qa/e2e-ux-master.py --url https://ai.spaincos.com` — 46-check UX master rubric (gate `>= 90` GREEN).
4. `python3 qa/eval-replay.py --deploy-id <dpl_or_sha>` (optional combined wrapper: `./qa/run.sh --post-deploy <dpl_or_sha>` or `./qa/run.sh --eval-replay <dpl_or_sha>`) — the cheap 10-query gateway regression gate (3 live research, 2 `OK CONTINUE AUTONOMOUSLY` continuations, 2 status/claim-guard checks, 2 facts, 1 doc creation). Writes `qa-reports/eval-replay/latest.md` + `latest.json` and appends a drift row to `qa-reports/eval-replay/history.jsonl` + `history.md`.
