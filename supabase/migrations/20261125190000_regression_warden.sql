-- v353 REGRESSION WARDEN (owner directive: autonomous health checks, no silent failures).
-- Tables + 15-minute cron schedule. Applied to production bnxermyboeigvwonfrzx on
-- 2026-11-25 via the management SQL API; the function source is
-- supabase/functions/regression-warden/index.ts (deployed v1).
create table if not exists public.warden_ledger (
  id bigint generated always as identity primary key,
  name text not null,
  ok boolean not null,
  detail text,
  run_at timestamptz not null
);
alter table public.warden_ledger enable row level security;
create index if not exists warden_ledger_name_run on public.warden_ledger (name, run_at desc);
create table if not exists public.warden_alerts (
  id bigint generated always as identity primary key,
  name text not null,
  kind text not null,
  detail text,
  issue_url text,
  run_at timestamptz not null
);
alter table public.warden_alerts enable row level security;
-- enable the scheduler extensions (idempotent) and the 15-min job
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('regression-warden-15min','*/15 * * * *', $$
  select net.http_post(
    url := 'https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/regression-warden',
    headers := jsonb_build_object('Content-Type','application/json'))
$$);
