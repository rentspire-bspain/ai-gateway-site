-- Skills abstraction v1 (Parity doc §34c) — ai-gateway (bnxermyboeigvwonfrzx).
-- User-authorable skills: reusable prompt + tool recipes (Perplexity-Skills-style).
-- SHIP-ONLY migration: idempotent and backward-compatible. NEVER executed from this
-- repo — apply via the Supabase SQL editor / governed migration runner.
-- Backed by the skills.js manager UI (Settings → Skills) via PostgREST.

create table if not exists public.skills (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(btrim(description)) <= 300),
  instructions text not null check (char_length(btrim(instructions)) between 1 and 8000),
  tools       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists skills_user_updated_idx
  on public.skills (user_id, updated_at desc);

alter table public.skills enable row level security;

drop policy if exists skills_select on public.skills;
create policy skills_select on public.skills
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists skills_insert on public.skills;
create policy skills_insert on public.skills
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists skills_update on public.skills;
create policy skills_update on public.skills
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists skills_delete on public.skills;
create policy skills_delete on public.skills
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
    execute 'drop policy if exists "gw allowlist only" on public.skills';
    execute 'create policy "gw allowlist only" on public.skills as restrictive for all to authenticated using (public.gw_is_allowed_user()) with check (public.gw_is_allowed_user())';
  end if;
end $$;

revoke all on public.skills from anon, authenticated;
grant select, insert, update, delete on public.skills to authenticated;
grant all on public.skills to service_role;

-- Keep updated_at fresh on edits
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists skills_touch_updated_at on public.skills;
create trigger skills_touch_updated_at
  before update on public.skills
  for each row execute function public.touch_updated_at();

-- RPC for listing the signed-in user's own skills (newest first)
create or replace function public.list_skills()
returns setof public.skills
language sql
stable
security invoker
set search_path = public
as $$
  select s.*
  from public.skills s
  where s.user_id = (select auth.uid())
  order by s.updated_at desc;
$$;

revoke all on function public.list_skills() from public, anon;
grant execute on function public.list_skills() to authenticated, service_role;
