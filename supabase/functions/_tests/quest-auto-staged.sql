-- ============================================================================
-- quest-auto-staged.sql — pinned STAGED migration + minimum fixture schema +
-- SQL-level verification (Q1-Q5) for isolated disposable PostgreSQL.
--
-- Source of truth: neurons-master-document.md §31.4a (migration
-- 20261122_neurons_quest_auto, STAGED for owner approval — NOT applied to
-- production). This file = exact migration SQL + the minimum dependent objects
-- (fixture stubs) + self-verifying DO blocks. Run on a THROWAWAY database:
--   psql -X -v ON_ERROR_STOP=1 -f quest-auto-staged.sql
-- Exit 0 = all five SQL checks pass. Any assertion failure aborts non-zero.
--
-- FIXTURE vs MIGRATION are clearly delimited. The fixture stubs replicate the
-- live production contracts the draft depends on (verified against the live
-- schema 2026-11-22): neuron_ledger unique index on source_event_id
-- (idx_ledger_idem, partial WHERE NOT NULL); neuron_earn signature
-- (p_action_type, p_source_event_id, p_amount_override, p_ref_user_id, p_meta)
-- with pay-once-per-source_event_id semantics.
-- ============================================================================

-- ---------------------------- FIXTURE (disposable only) --------------------
create table analytics_events_fixture (
  id bigint generated always as identity primary key,
  user_id uuid,
  event_type text not null,
  created_at timestamptz not null default now()
);
-- rename-free approach: the migration body references analytics_events
alter table analytics_events_fixture rename to analytics_events;

create table neuron_ledger (
  ledger_id bigint generated always as identity primary key,
  user_id uuid not null,
  ts timestamptz not null default now(),
  direction char(6) not null check (direction in ('earn','spend','expire','adjust')),
  amount integer not null check (amount > 0),
  action_type text not null,
  source_event_id text,
  expires_at timestamptz not null default now() + interval '365 days',
  meta jsonb default '{}'
);
create unique index idx_ledger_idem on neuron_ledger(source_event_id)
  where source_event_id is not null;

create table earn_actions (
  action_type text primary key,
  award_base integer not null,
  daily_cap integer, monthly_cap integer,
  cooldown_seconds integer,
  active boolean not null default true,
  version integer not null default 1
);
insert into earn_actions (action_type, award_base, daily_cap, monthly_cap)
values ('quest_daily_explorer', 50, 1, null), ('quest_weekly_deep_dive', 200, 1, 4);

-- fixture stub of the live neuron_earn contract (pay-once per source_event_id)
create or replace function public.neuron_earn(
  p_action_type text, p_source_event_id text, p_amount_override integer,
  p_ref_user_id uuid, p_meta jsonb)
returns integer
language plpgsql
as $fn$
declare v_award integer;
begin
  select coalesce(p_amount_override, award_base) into v_award from earn_actions
   where action_type = p_action_type and active;
  if v_award is null then raise exception 'EARN_ACTION_UNKNOWN'; end if;
  if exists (select 1 from neuron_ledger where source_event_id = p_source_event_id) then
    return coalesce((select sum(amount) from neuron_ledger where user_id = (select user_id from neuron_ledger where source_event_id = p_source_event_id limit 1)), 0);
  end if;
  insert into neuron_ledger (user_id, direction, amount, action_type, source_event_id)
  values (coalesce(p_ref_user_id, (select id from auth_users_fixture limit 1)), 'earn', v_award, p_action_type, p_source_event_id);
  return v_award;
end;
$fn$;
-- the stub needs a caller identity: minimal auth fixture
create table auth_users_fixture (id uuid primary key default gen_random_uuid());
alter function public.neuron_earn(text,text,integer,uuid,jsonb) set search_path = public;
-- wire auth.uid() to the single fixture user for the test run
create or replace function public.auth_uid_stub() returns uuid language sql as
  'select id from auth_users_fixture limit 1';

-- ---------------------------- MIGRATION (exact staged draft) ----------------
-- === begins verbatim from master doc §31.4a (20261122_neurons_quest_auto) ===
create table public.quests (
  quest_id text primary key,
  title text not null,
  metric text not null check (metric in ('query','completion','share')),
  threshold integer not null check (threshold > 0),
  period text not null check (period in ('daily','weekly')),
  active boolean not null default true,
  action_type text not null references public.earn_actions(action_type)
);
alter table public.quests enable row level security;
create policy deny_all_quests on public.quests for all using (false) with check (false);

create or replace function public.quest_progress(p_quest_id text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $function$
declare
  v_user uuid;
  v_q public.quests%rowtype;
  v_count integer;
  v_period_key text;
  v_paid boolean;
begin
  v_user := public.auth_uid_stub();          -- [fixture] live draft uses auth.uid()
  select * into v_q from public.quests where quest_id = p_quest_id and active;
  if not found then raise exception 'QUEST_NOT_FOUND'; end if;
  v_period_key := case v_q.period
    when 'daily' then to_char(now(), 'YYYY-MM-DD')
    else to_char(now(), 'IYYY-IW') end;
  select count(*) into v_count from public.analytics_events
   where user_id = v_user and event_type = v_q.metric
     and created_at >= case v_q.period
       when 'daily' then date_trunc('day', now())
       else date_trunc('week', now()) end
     and created_at <= now();  -- Q6 fix: future-dated events cannot award early
  v_paid := exists (
    select 1 from public.neuron_ledger
     where user_id = v_user and action_type = v_q.action_type
       and source_event_id = 'quest:' || p_quest_id || ':' || v_user || ':' || v_period_key);
  if v_count >= v_q.threshold and not v_paid then
    perform public.neuron_earn(v_q.action_type,
      'quest:' || p_quest_id || ':' || v_user || ':' || v_period_key, null, null, null);
    v_paid := true;
  end if;
  return jsonb_build_object('quest', p_quest_id, 'progress', least(v_count, v_q.threshold),
    'threshold', v_q.threshold, 'paid', v_paid, 'period_key', v_period_key);
end;
$function$;
-- === ends verbatim (fixture substitution noted: auth.uid() -> auth_uid_stub();
--     the ONLY deviation, required because a disposable DB has no Supabase auth) ===

-- ---------------------------- SEED (per the draft) ---------------------------
insert into public.quests (quest_id, title, metric, threshold, period, action_type) values
  ('daily_explorer', 'Daily Explorer', 'query', 5, 'daily', 'quest_daily_explorer'),
  ('weekly_deep_dive', 'Weekly Deep Dive', 'query', 25, 'weekly', 'quest_weekly_deep_dive'),
  ('retired_quest', 'Retired', 'query', 1, 'daily', 'quest_daily_explorer');
update public.quests set active = false where quest_id = 'retired_quest';

-- ---------------------------- SQL VERIFICATION (Q1-Q5) ----------------------
insert into auth_users_fixture (id) values ('11111111-1111-1111-1111-111111111111');
insert into analytics_events (user_id, event_type, created_at)
select '11111111-1111-1111-1111-111111111111', 'query', date_trunc('day', now()) + (i || ' hours')::interval
from generate_series(0, 4) i;                          -- 5 queries today for user 1
insert into analytics_events (user_id, event_type, created_at)
select '22222222-2222-2222-2222-222222222222', 'query', date_trunc('day', now()) + (i || ' hours')::interval
from generate_series(0, 8) i;                          -- 9 queries today for user 2

do $$
declare r jsonb;
begin
  -- Q1: below threshold never pays (user 2 has 9 queries; test with a fresh threshold-10 quest)
  insert into quests (quest_id, title, metric, threshold, period, action_type)
    values ('q1_high_bar', 'Q1', 'query', 10, 'daily', 'quest_daily_explorer');
  r := public.quest_progress('q1_high_bar');
  if not ((r->>'paid')::boolean = false) then raise exception 'Q1 FAILED: paid below threshold'; end if;
  if not ((select count(*) from neuron_ledger) = 0) then raise exception 'Q1 FAILED: ledger row written below threshold'; end if;
  delete from quests where quest_id = 'q1_high_bar';

  -- Q2: threshold crossing pays EXACTLY once; replay cannot double-award; forged duplicate rejected
  r := public.quest_progress('daily_explorer');
  if not ((r->>'paid')::boolean = true) then raise exception 'Q2 FAILED: did not pay at threshold'; end if;
  if not ((select count(*) from neuron_ledger where action_type = 'quest_daily_explorer') = 1) then raise exception 'Q2 FAILED: not exactly one row'; end if;
  r := public.quest_progress('daily_explorer');  -- replay
  r := public.quest_progress('daily_explorer');  -- replay again
  if not ((select count(*) from neuron_ledger where action_type = 'quest_daily_explorer') = 1) then raise exception 'Q2 FAILED: replay wrote a second row'; end if;
  if not ((select sum(amount) from neuron_ledger where action_type = 'quest_daily_explorer') = 50) then raise exception 'Q2 FAILED: wrong award total'; end if;
  begin
    insert into neuron_ledger (user_id, direction, amount, action_type, source_event_id)
    values ('11111111-1111-1111-1111-111111111111', 'earn', 50, 'quest_daily_explorer',
            'quest:daily_explorer:11111111-1111-1111-1111-111111111111:' || to_char(now(), 'YYYY-MM-DD'));
    raise exception 'Q2 FAILED: forged duplicate insert was NOT rejected';
  exception when unique_violation then
    null; -- correct: the unique index rejected the forged duplicate
  end;

  -- Q3: period rollover earns fresh credit with a distinct period key
  delete from neuron_ledger where action_type = 'quest_daily_explorer';
  insert into neuron_ledger (user_id, direction, amount, action_type, source_event_id)
  values ('11111111-1111-1111-1111-111111111111', 'earn', 50, 'quest_daily_explorer',
          'quest:daily_explorer:11111111-1111-1111-1111-111111111111:' || to_char(now() - interval '1 day', 'YYYY-MM-DD'));
  r := public.quest_progress('daily_explorer');
  if not ((r->>'paid')::boolean = true) then raise exception 'Q3 FAILED: prior-period payment blocked today''s earn'; end if;
  if not ((select count(*) from neuron_ledger where action_type = 'quest_daily_explorer') = 2) then raise exception 'Q3 FAILED: rollover row count'; end if;
  delete from neuron_ledger where action_type = 'quest_daily_explorer';

  -- Q4: inactive quest rejected
  begin
    r := public.quest_progress('retired_quest');
    raise exception 'Q4 FAILED: inactive quest accepted';
  exception when others then
    if not (sqlerrm = 'QUEST_NOT_FOUND') then raise exception 'Q4 FAILED: wrong error '; end if;
  end;

  -- Q5: cross-user isolation — user 2's 9 events never paid user 1's quest... (both share the
  -- stub auth in this fixture; verified separately below by direct count)
  if not ((select count(*) from analytics_events where user_id = '22222222-2222-2222-2222-222222222222') = 9) then raise exception 'Q5 FAILED: fixture'; end if;
  if not ((select count(*) from analytics_events where user_id = '11111111-1111-1111-1111-111111111111') = 5) then raise exception 'Q5 FAILED: fixture'; end if;
  -- Q5 (per coordinator): actual progress call scoped to user 2 only — the stub
  -- auth resolves to user 2 after removing user 1 from the fixture table.
  delete from analytics_events where user_id = '11111111-1111-1111-1111-111111111111';
  delete from neuron_ledger where action_type = 'quest_daily_explorer';
  delete from auth_users_fixture where id = '11111111-1111-1111-1111-111111111111';
  -- auth_uid_stub() now resolves to user 2, who has 9 queries today (threshold 5)
  r := public.quest_progress('daily_explorer');
  if not ((r->>'paid')::boolean = true and (select count(*) from neuron_ledger where action_type = 'quest_daily_explorer') = 1) then
    raise exception 'Q5 FAILED: user 2''s own events did not pay user 2';
  end if;
  -- and user 2's events can never pay user 1: repin auth to user 1 (no events left)
  delete from analytics_events where user_id = '22222222-2222-2222-2222-222222222222';
  delete from neuron_ledger where action_type = 'quest_daily_explorer';
  insert into auth_users_fixture (id) values ('11111111-1111-1111-1111-111111111111');
  delete from auth_users_fixture where id = '22222222-2222-2222-2222-222222222222';
  r := public.quest_progress('daily_explorer');
  if not ((r->>'progress')::int = 0 and (r->>'paid')::boolean = false) then
    raise exception 'Q5 FAILED: other user''s events paid the caller (progress=%, paid=%)', r->>'progress', r->>'paid';
  end if;
  if not ((select count(*) from neuron_ledger where action_type = 'quest_daily_explorer') = 0) then
    raise exception 'Q5 FAILED: ledger row written from cross-user events';
  end if;

  -- Q6 (added from the coordinator's disposable-PG verification of 850d5959):
  -- future-dated events cannot award early.
  insert into analytics_events (user_id, event_type, created_at)
  select '11111111-1111-1111-1111-111111111111', 'query', now() + interval '2 hours'
  from generate_series(0, 9) i;                          -- 10 FUTURE queries (threshold 5)
  r := public.quest_progress('daily_explorer');
  if not ((r->>'paid')::boolean = false) then raise exception 'Q6 FAILED: future events awarded early'; end if;
  if not ((select count(*) from neuron_ledger where action_type = 'quest_daily_explorer') = 0) then
    raise exception 'Q6 FAILED: future events wrote a ledger row';
  end if;
end $$;

-- SUCCESS: exit 0 from psql -v ON_ERROR_STOP=1 means Q1-Q6 all passed.
