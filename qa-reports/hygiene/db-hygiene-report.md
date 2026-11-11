# DB Hygiene Report — ai-gateway (bnxermyboeigvwonfrzx)
Audited 2026-11-11, read-only. Bottom line: no launch-blocking data corruption. DB is healthy; cleanup is optional/low-risk.

| Table | Rows | Issue | Risk | Recommended action |
|---|---|---|---|---|
| thread_messages | 87,849 (92 MB) | 0 orphans (FK enforced), 0 null thread_id. Indexed on thread_id. | None | None |
| threads | 5,648 | 0 same user+title+slug dupes (slug unique index). 176 title groups repeat (582 extra rows) but with distinct slugs - mostly repeated/scheduled queries (one title x129). 24 threads have no messages, all <7 days old (likely in-flight); 19 of them are empty duplicates of a newer same-title thread. | Low | Optional delete of the 19 empty dupes (SQL B1). Do not bulk-dedupe by title. |
| spaces | 20 | 1 dead space (0 threads): "Spain Companies — Standing Rules". Other 19 are in use. | Low | Review with owner; SQL B2 (commented). |
| memory_items | 1,495 | 0 dupes by user_id+text. | None | None |
| fleet_registry | 220 (98 live, 75 paused, 47 on_demand) | 1 duplicate: "Frontend Sweep lane" (lane:frontend-sweep-2026-11-09 and ...-v82). 75 paused rows all updated 2026-11-10, so not stale by age. No domain column matches tahlequah; guardian:ahapartments description still says "tahlequahapartments.com down (502)" - stale text, and guardian ahapartments is still enabled and running. | Med (ahapartments guardian will keep alerting on a retired domain) | Fix description / disable or repoint guardian ahapartments (SQL B3, B4). Remove one duplicate lane (B5). |
| fleet_dispatch | 2 | Both done (2026-11-10). None stuck queued/running. | None | None |
| guardians | 14 | All enabled; spain-terminal last_status=fail, rentspire=warn. ahapartments targets retired domain. | Med | Investigate spain-terminal; see fleet_registry. |
| scheduled_tasks | 2 | Two disabled "QA smoke task" rows (one error). | Low | Delete (SQL A2). |
| shared_threads | 72 | 71 revoked, containing full message copies. | Low | Purge revoked (SQL A3). |
| research_jobs | 21 | 1 error, 20 done. | Low | Keep. |
| ops_health_runs | 252 | Only ~2 days old, but grows ~125/day. | Low | Add retention (SQL C1, 14 days). |
| cron.job_run_details | 2,469 (1.6 MB) | pg_stat shows 0 live but table 1.6 MB; unbounded growth. | Low | Retention job (SQL C2). |
| net._http_response | 440 | pg_net auto-purges. | None | None |
| context_documents | 5,894 (125 MB, 52 MB text) | Largest table. 0 dupes by source_url, 0 orphans, all embedded. 2,353 seq scans vs 12,080 idx scans. | Med (growth) | Watch; consider retention/TTL policy. Verify hot queries use user_created_idx. |
| Empty, unreferenced in code | 0 | scim_users, scim_tokens, custom_oauth_providers: zero code refs, 0 rows. (Likely auth/extension-owned; confirm schema before action.) | Low | Candidate drops only if in public schema; otherwise leave. |
| Empty, referenced | 0 | workflows, workflow_runs, watchlist, hub_prefs, subscription, user_assets, user_consents, user_connections, gw_rate_limits, context_embeddings, user_connections: all referenced by code/migrations; just unused yet. | None | Keep. |
| messages | 0 | Appears in stats but not in public schema (public.messages does not exist; realtime/other schema). Only referenced in old _releases. | None | Ignore. |
| Auth/storage/etc. tables | - | Supabase-managed. | - | Do not touch. |

## Indexes
Hot paths are covered: thread_messages(thread_id), threads(user_id, space_id, unique slug), context_documents(user+created, embedding), fleet_dispatch(status,created_at), memory_items(user). Possible additions: threads(user_id, updated_at desc) for recents lists, and memory_items(user_id,text) if dedup enforcement wanted (SQL C3/C4, optional). Verify against real query plans before applying.

## Not verified
No edge-function source diff against live deployed functions; table-reference grep covered ai-gateway-live and ai-gateway-site text/SQL/JS/TS/Python files. Row counts for small tables are from exact count queries where noted, others from pg_stat estimates.
