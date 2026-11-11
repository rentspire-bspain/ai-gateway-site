# Backend dead-code report (ai-gateway-live) — 2026-11-11
Read-only audit; nothing modified or deployed. Secret values intentionally omitted.

## 1. Function vs frontend references
Frontend (index.html, modules/, js/) calls via `functions/v1/<name>` or `GATEWAY + "/<name>"`: api-keys, connectors, discover, guardian-runner, live-data, monitors, repo-pr, research-jobs, share, task-runner, team, gateway-chat, gateway-status. No other literal references found. Static grep misses dynamically built paths; verify before retiring.

Not referenced by frontend (26 functions total):
| Function | Evidence | Verdict |
|---|---|---|
| call-model | only referenced by other edge functions (`CALL_MODEL_URL`, `_shared/call-model-policy.js`) | KEEP (internal) |
| fleet-dispatch | no refs in frontend/other fns; migration 2026-11-10-fleet-dispatch.sql; gateway-chat v142 queues rows | KEEP, server-to-server; confirm caller |
| ops-health | only mentioned in a security-hardening migration comment; no caller, no cron | RETIRE candidate (or add cron/guardian) |
| push | no refs outside old `_releases` snapshots | RETIRE candidate (verify push is not called by service worker) |
| quotes | refs only in `_releases/quotes/v6` and old frontend snapshot; current frontend has none | RETIRE candidate (live-data likely replaced it) |
| cred-vault, devices, media-gen, plugins, qa, sandbox, watchlist, workspace-actions, gateway-status | have a name hit in frontend (looser match) but no `functions/v1` literal for several; spot-check | VERIFY |

Broken frontend->backend calls: none found (every literal function name has a matching directory).

## 2. gateway-chat
- All files used: connector-tools-client.ts, tool-loop.ts, progress.ts, plan-guidance.ts, citations/acronyms/slugify/credential-scrub. No orphan helper found. Note `_shared/deep-brief.ts` is imported by 2 files; `_shared/google-conn.ts` by 4.
- Likely stale: `_shared/*.js` (cors, egress, net-guard, rate-limit, call-model-policy) are not imported by gateway-chat; used by call-model, repo-pr, monitors, discover, research-jobs (fine).
- Version-comment drift (comment-only cleanup, v-numbers present: v101,103,121,124,126-128,130,137,140-142,145,152,153):
  - index.ts:5 "v141 FLEET" import comment; 2279 v140; 2281 v141; 2290 v142 — three consecutive versions describing one auto-invoke feature; consolidate into one "FLEET auto-invoke" note.
  - tool-loop.ts:196/1082/1102/1156 and index.ts:2353/2418-2420 all "v145" — fine functionally but numbered; replace with feature names.
  - tool-loop.ts:215 "v153 SPEED" and index.ts:1257 "v152" — newest; confirm the _releases/gateway-chat snapshots go past v106 (they stop at v106, so release history is stale versus v153 live).
  - index.ts:336 "self-check.ts — I7 writer pass-2 ... Sibling of tool-loop.ts": header of a file that does not exist in gateway-chat/ (inlined or removed) — stale.
- `_releases/` is 5.4MB of old snapshots (call-model v36-41, gateway-chat v96-106, frontend dc0d0dd incl. old gateway-chat corpus.ts). Archive/prune.

## 3. Guardians / cron
- checks.ts is only a generic check vocabulary; no hardcoded projects.
- Guardian definitions live in migration 2026-11-10-guardian-engine.sql. `g-ahapartments` still probes tahlequahapartments.com ("known 502") — RETIRED site; remove from probe list and from fleet-registry entry `guardian:ahapartments`.
- `g-comptrove-deal-engine` is cross-project: treat Vercel/cross-project probes as needs-key, not dead.
- Cron jobs: guardian-runner-5min and task-runner-5min — both have live functions, fine. No cron for ops-health/monitors in migrations (monitors may be scheduled elsewhere).
- terminal.spaincos.com: no hits in migrations/specs.

## 4. Config / secrets
- Hardcoded EMBEDDED_SECRETS (security risk, should move to Supabase secrets):
  - fleet-dispatch/index.ts: FLEET_DISPATCH_KEY
  - connectors/index.ts: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CONNECTOR_REDIRECT_URI, PROVISION_KEY, IMPORT_KEY
  All are read in-file (no unused key). IMPORT_KEY and the `import` action are marked one-shot "REMOVE after import" — dead if import is done. CONNECTOR_REDIRECT_URI comment says to flip back to the ai.spaincos.com proxy once registered — stale temporary workaround.
- Env names used once (check they are set / still needed): SUPABASE_ACCESS_TOKEN, SANDBOX_TOKEN, GITHUB_PR_TOKEN, DEBUG, AUTO_COUNCIL, AGENTIC_SKIP_BYPASS, ACTIONS_APPROVAL_SECRET, GW_TOKEN (vs GATEWAY_TOKEN — likely duplicate alias), VIDEO_* (media-gen only).
- COMPTROVE_API_URL/KEY: cross-project, needs-key.

## 5. Migrations / storage
- 10 migrations, all dated 2026-11-09/10 and current; none obsolete. fleet-registry.sql seeds a tahlequah-related guardian row via ahapartments (see 3). Storage buckets not inspected (no DB access in this lane).

## Prioritized actions
1. HIGH: Move hardcoded secrets (connectors, fleet-dispatch) to Supabase secrets; rotate since they are in source files/_releases.
2. HIGH: Remove IMPORT_KEY + `import` action in connectors if the Perplexity import finished.
3. MED: Drop tahlequahapartments.com from g-ahapartments checks and fleet registry.
4. MED: Decide on ops-health, push, quotes (no live callers) — retire or wire up.
5. LOW: Consolidate v140/141/142/145 comments; delete stale self-check.ts header; merge GW_TOKEN/GATEWAY_TOKEN.
6. LOW: Prune/archive `_releases` (5.4MB).
