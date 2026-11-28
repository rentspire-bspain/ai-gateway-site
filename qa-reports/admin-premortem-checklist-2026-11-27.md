# Superadmin console — premortem and full completion checklist (2026-11-27)

Premortem format: "It's launch day plus 30 and the owner says the console failed him. Why?" Each failure mode below has a guard, a status, and a completion criterion.

## Premortem failure modes

| # | Failure mode | Guard | Status |
|---|---|---|---|
| 1 | **The console is sparse again** — the owner opens it and sees four numbers and a table (the v1 complaint) | v2 ships 7 tabs + per-user drilldown (see checklist); KPI cards include DAU, active/total users, monthly cost | DONE (deployed) |
| 2 | **No per-user breakdown** — "who is this person and what have they done?" unanswerable | Users tab has a View button: threads with counts + dates, latest 200 messages, memories, imported volume | DONE |
| 3 | **Wrong person sees everything** — the richest data leak in the product | JWT required + admin_emails allowlist (owner only); all RPCs security-definer and revoked from public/anon/authenticated; non-admin verified 403 | DONE (verified) |
| 4 | **The numbers are wrong** — silently stale or double-counted | Every figure comes from a named SQL function (admin_dau, admin_retention, admin_usage) with a single aggregation path; warden fast lane pings the console every minute (bv_favicon-style check for /admin 200) | PARTIAL — 200-check is implicit; add admin-console content check to warden deep lane |
| 5 | **It breaks silently after a deploy** (the v338 pattern) | Post-deploy health gate (qa/deploy-gateway.sh) + warden; add admin-console RPC smoke to the deploy script | TODO (next batch) |
| 6 | **No history of incidents** — the owner sees a bad number with no context | Alerts tab shows the last 25 warden alerts with issue links | DONE |
| 7 | **Cost surprises** — spend runs away unnoticed | Usage & cost tab (per-user monthly requests + est. cost); KPI card for month-to-date cost | DONE; alerting on thresholds TODO |
| 8 | **Retention invisible** — signups happen but nobody returns | Retention cohorts tab (weekly cohorts, W1/W2/W4 return) | DONE |
| 9 | **The owner's own activity drowns the signal** — 5582 threads vs 3-user beta | Filter box on every tab; per-user drilldown separates the owner from test accounts | DONE |
| 10 | **Search history not searchable** | Recent searches tab, filterable by user or query text | DONE |

## Full completion checklist

- [x] KPIs: signups 30d, DAU today, threads 30d, messages 30d, active/total users, month-to-date cost
- [x] Users tab: email, threads, messages, first thread, last active, filter, per-user View
- [x] Per-user drilldown: memories, imported threads/messages, thread list with counts and date ranges, latest 200 messages (full content)
- [x] Recent searches tab: every user's latest 200 queries with thread titles and timestamps
- [x] Activity by day tab: signups/threads/messages with a volume bar chart
- [x] Retention cohorts tab: weekly cohort size and W1/W2/W4 return rates
- [x] Usage & cost tab: per-user monthly requests and estimated cost
- [x] Warden health tab: last hour of check results with pass/fail and details
- [x] Alerts tab: last 25 alerts with GitHub issue links
- [x] Auth: JWT + admin allowlist, non-admin 403 verified; noindex
- [ ] Live-updating (auto-refresh every 60s) — next batch
- [ ] CSV export of every tab — next batch
- [ ] Cost-threshold alerting (email/Slack when monthly spend crosses a line) — next batch
- [ ] Warden deep-lane check: admin-console RPC smoke (asserts every tab's data source returns rows) — next batch
- [ ] Thread-level drilldown from a user's thread row into the full conversation view — next batch
- [ ] Funnel: signup -> first question -> first sourced answer -> D7 return (needs event logging) — specced, next batch
