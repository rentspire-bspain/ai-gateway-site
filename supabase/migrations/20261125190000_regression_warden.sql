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

-- v354 WARDEN v2 additions (all applied to production on 2026-11-25):
create table if not exists public.warden_playbooks (
  id bigint generated always as identity primary key,
  signature text unique not null,
  check_name text not null,
  severity text not null default 'P1',
  remediation text,
  auto_remediation text,
  learned_at timestamptz default now(),
  times_matched int default 0
);
alter table public.warden_playbooks enable row level security;
create or replace function public.warden_rls_audit() returns int language sql security definer as $$
  select count(*) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and not c.relrowsecurity $$;
create or replace function public.warden_schema_hash() returns text language sql security definer as $$
  select md5(string_agg(c.relname || ':' || coalesce((select string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped), ''), '|' order by c.relname)) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' $$;
create or replace function public.warden_cron_status() returns jsonb language sql security definer as $$
  select coalesce(jsonb_agg(jsonb_build_object('jobname',j.jobname,'active',j.active)), '[]'::jsonb) from cron.job j where j.jobname like 'regression-warden%' $$;
-- near-constant cadence (owner directive: "I cannot go a full day"):
select cron.schedule('regression-warden-fast','* * * * *', $$ select net.http_post(url:='https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/regression-warden', headers:=jsonb_build_object('Content-Type','application/json')) $$);
select cron.schedule('regression-warden-deep','*/15 * * * *', $$ select net.http_post(url:='https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/regression-warden?deep=1', headers:=jsonb_build_object('Content-Type','application/json')) $$);
select cron.unschedule('regression-warden-15min'); -- replaced by fast+deep
-- RLS lockdown found by the warden's first RLS audit (six tables were anon-readable,
-- including affiliate_networks carrying a webhook secret):
alter table public.model_costs enable row level security;
alter table public.harvest_jobs enable row level security;
alter table public.owner_owners enable row level security;
alter table public.affiliate_networks enable row level security;
alter table public.brand_guard_log enable row level security;
alter table public._ow_probe2 enable row level security;
-- warden service identity for the authenticated probes (eval QA account):
insert into gateway_config (key, value) values ('warden_eval_email','eval-bot@spaincos.com'),('warden_eval_password','EvalTest2026!') on conflict (key) do nothing;

-- v355 WARDEN v3: full-estate coverage (dcyj runtime + storage + latency anomaly)
create or replace function public.warden_bucket_audit() returns int language sql security definer as $$
  select count(*) from storage.buckets b where b.public = true and b.id not in ('gateway-assets','public','site-assets') $$;
