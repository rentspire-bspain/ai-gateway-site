-- Automations manager schema (Parity doc §34c) — ai-gateway (bnxermyboeigvwonfrzx).
-- Ship-only migration: idempotent and backward-compatible. Apply via Supabase SQL editor / governed migration runner.
-- Recurring automations insert due work into public.fleet_dispatch, executed every 5 minutes by the existing fleet runner.

create table if not exists public.automations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 1 and 160),
  instruction        text not null check (char_length(btrim(instruction)) between 1 and 4000),
  schedule           text not null check (schedule in ('hourly', '2x-daily', 'daily', 'weekly')),
  enabled            boolean not null default true,
  last_dispatched_at timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists automations_user_created_idx
  on public.automations (user_id, created_at desc);

create index if not exists automations_due_idx
  on public.automations (schedule, last_dispatched_at)
  where enabled;

alter table public.automations enable row level security;

drop policy if exists automations_select on public.automations;
create policy automations_select on public.automations
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists automations_insert on public.automations;
create policy automations_insert on public.automations
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists automations_update on public.automations;
create policy automations_update on public.automations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists automations_delete on public.automations;
create policy automations_delete on public.automations
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Defense-in-depth allowlist policy matching other user tables when gw_is_allowed_user() is present
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'gw_is_allowed_user'
  ) then
    execute 'drop policy if exists "gw allowlist only" on public.automations';
    execute 'create policy "gw allowlist only" on public.automations as restrictive for all to authenticated using (public.gw_is_allowed_user()) with check (public.gw_is_allowed_user())';
  end if;
end $$;

revoke all on public.automations from anon, authenticated;
grant select, insert, update, delete on public.automations to authenticated;
grant all on public.automations to service_role;

-- View + RPC for listing user-owned automations with human-readable schedule cadence and next due timestamp
create or replace view public.automations_overview
with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.instruction,
  a.schedule,
  case a.schedule
    when 'hourly'   then 'Every hour'
    when '2x-daily' then 'Twice daily (every 12h)'
    when 'daily'    then 'Daily (every 24h)'
    when 'weekly'   then 'Weekly (every 7d)'
    else a.schedule
  end as schedule_label,
  a.enabled,
  a.last_dispatched_at,
  case
    when not a.enabled then null
    when a.last_dispatched_at is null then a.created_at
    when a.schedule = 'hourly'   then a.last_dispatched_at + interval '1 hour'
    when a.schedule = '2x-daily' then a.last_dispatched_at + interval '12 hours'
    when a.schedule = 'daily'    then a.last_dispatched_at + interval '1 day'
    when a.schedule = 'weekly'   then a.last_dispatched_at + interval '7 days'
    else null
  end as next_due_at,
  a.created_at
from public.automations a;

grant select on public.automations_overview to authenticated, service_role;

create or replace function public.list_automations()
returns setof public.automations
language sql
stable
security invoker
set search_path = public
as $$
  select a.*
  from public.automations a
  where a.user_id = (select auth.uid())
  order by a.created_at desc;
$$;

revoke all on function public.list_automations() from public, anon;
grant execute on function public.list_automations() to authenticated, service_role;

-- Scheduler bridge: enqueues due recurring automations into public.fleet_dispatch (picked up by the 5-min fleet runner)
create or replace function public.enqueue_due_automations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with due as (
    select a.id, a.user_id, a.name, a.instruction
    from public.automations a
    where a.enabled = true
      and (
        a.last_dispatched_at is null
        or (a.schedule = 'hourly'   and a.last_dispatched_at <= now() - interval '1 hour')
        or (a.schedule = '2x-daily' and a.last_dispatched_at <= now() - interval '12 hours')
        or (a.schedule = 'daily'    and a.last_dispatched_at <= now() - interval '1 day')
        or (a.schedule = 'weekly'   and a.last_dispatched_at <= now() - interval '7 days')
      )
    order by coalesce(a.last_dispatched_at, a.created_at) asc
    limit 25
    for update skip locked
  ),
  ins as (
    insert into public.fleet_dispatch (user_id, instruction, priority, status)
    select
      d.user_id,
      left('[Automation: ' || d.name || '] ' || d.instruction, 4000),
      'normal',
      'queued'
    from due d
    returning 1
  ),
  upd as (
    update public.automations a
    set last_dispatched_at = now()
    from due d
    where a.id = d.id
    returning 1
  )
  select count(*) into v_count from upd;

  return v_count;
end;
$$;

revoke all on function public.enqueue_due_automations() from public, anon, authenticated;
grant execute on function public.enqueue_due_automations() to service_role;

-- Optional idempotent pg_cron registration when pg_cron is installed
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'automations-enqueue-5min') then
      perform cron.unschedule('automations-enqueue-5min');
    end if;
    perform cron.schedule(
      'automations-enqueue-5min',
      '*/5 * * * *',
      $job$select public.enqueue_due_automations();$job$
    );
  end if;
end $$;
