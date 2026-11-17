-- Per-webapp schema/ontology tools (Parity doc §34e) — ai-gateway (bnxermyboeigvwonfrzx).
-- SHIP-ONLY migration: never executed by an agent; apply via Supabase SQL editor / governed migration runner.
-- Idempotent and backward-compatible. Extends the existing fleet_registry registry pattern:
-- each webapp row (kind='webapp' or 'web_app') gains an explicit stack — backend DB project ref,
-- frontend domain, repo, and ontology/schema notes — so webapps can be worked on individually
-- with full confidence about which database/backend/frontend belongs to which app.

-- ---------------------------------------------------------------------------
-- public.webapp_stack — one row per webapp with its explicit stack
-- ---------------------------------------------------------------------------
-- Joins fleet_registry rows that are webapps (kind 'webapp' or 'web_app') with their
-- known database project ref (the fleet_registry parent/lookup convention: the DB row is
-- the fleet_registry row whose kind='supabase_db'/'database'/'db' and project_ref matches,
-- or the same project_ref) and their frontend domain. Ontology/schema notes come from the
-- webapp row's description plus an explicit schema_notes column when present (see the
-- optional ALTER below — it is additive and safe).
--
-- The view is intentionally tolerant: it never errors when the stack is only partially
-- known. Missing pieces surface as NULLs in the UI rather than breaking the page.

-- Optional additive columns on fleet_registry (schema notes + repo URL per webapp row).
-- These are commented out because the base table is shared; run only after review.
-- alter table public.fleet_registry
--   add column if not exists schema_notes text,
--   add column if not exists repo_url text;

create or replace view public.webapp_stack
with (security_invoker = true) as
select
  w.id                as fleet_id,
  w.name              as webapp_name,
  w.kind              as webapp_kind,
  w.domain            as frontend_domain,
  w.project_ref       as db_project_ref,
  w.parent            as parent_id,
  w.description       as description,
  w.status            as status,
  w.schedule          as schedule,
  w.owner             as owner,
  w.updated_at        as updated_at,
  -- schema/ontology notes: the description doubles as notes until the additive
  -- schema_notes column ships (see the commented ALTER above)
  w.description      as schema_notes,
  -- repo URL: unknown for now (additive repo_url column commented above)
  cast(null as text) as repo_url,
  -- the DB-side fleet_registry row for the same project (kind = database-ish), if any
  (select d.id from public.fleet_registry d
    where d.project_ref = w.project_ref
      and d.kind in ('supabase_db', 'database', 'db')
    limit 1)        as db_fleet_id,
  (select d.name from public.fleet_registry d
    where d.project_ref = w.project_ref
      and d.kind in ('supabase_db', 'database', 'db')
    limit 1)        as db_name,
  (select d.status from public.fleet_registry d
    where d.project_ref = w.project_ref
      and d.kind in ('supabase_db', 'database', 'db')
    limit 1)        as db_status,
  (select d.updated_at from public.fleet_registry d
    where d.project_ref = w.project_ref
      and d.kind in ('supabase_db', 'database', 'db')
    limit 1)        as db_updated_at
from public.fleet_registry w
where w.kind in ('webapp', 'web_app');

grant select on public.webapp_stack to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- public.list_webapp_schemas(project_ref text) — RPC STUB
-- ---------------------------------------------------------------------------
-- RETURNS schema/table counts for a given webapp project.
--
-- REQUIRES A PER-PROJECT CONNECTION: this stub CANNOT answer by itself, because
-- each webapp's schema lives in that webapp's own Supabase project (or its own
-- schema inside this project for the ai-gateway webapps). The stub documents the
-- contract and returns an honest "not wired" payload until a governed
-- per-project connection (a DB link / postgres_fdw / foreign server, or an
-- edge function that proxies the target project's REST introspection endpoint
-- with a stored per-project token) is provisioned by the owner.
--
-- The intent for the full version (DO NOT SHIP until the per-project
-- connection exists — the sql is illustrative only):
--
--   create or replace function public.list_webapp_schemas(project_ref text)
--   returns table (
--     schema_name text,
--     table_count bigint,
--     view_count  bigint,
--     rpc_count   bigint
--   )
--   language plpgsql
--   security invoker
--   set search_path = public
--   as $$
--   begin
--     -- requires: a foreign server / db_link to the target project, e.g.
--     --   create server webapp_<ref> foreign data wrapper postgres_fdw
--     --     options (host '<ref>.supabase.co', dbname 'postgres', port '5432');
--     --   create user mapping for authenticated server webapp_<ref>
--     --     options (user '...', password '...');  -- stored per-project token
--     return query
--       select n.nspname::text,
--              (select count(*) from pg_class c where c.relnamespace = n.oid and c.relkind = 'r'),
--              (select count(*) from pg_class c where c.relnamespace = n.oid and c.relkind = 'v'),
--              (select count(*) from pg_proc p where p.pronamespace = n.oid)
--       from pg_namespace n
--       where n.nspname not in ('pg_catalog', 'information_schema')
--         and n.nspname not like 'pg_%';
--   end;
--   $$;

create or replace function public.list_webapp_schemas(project_ref text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_w record;
begin
  select * into v_w from public.webapp_stack s
    where s.db_project_ref = list_webapp_schemas.project_ref
    limit 1;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'no webapp registered with project ref ' || coalesce(list_webapp_schemas.project_ref, '(null)')
    );
  end if;
  -- Honest stub: schema introspection requires a per-project connection
  -- (see the commented full version above). Do not fake counts here.
  return jsonb_build_object(
    'ok', false,
    'requires_per_project_connection', true,
    'note', 'Schema introspection requires per-project credentials; wire a governed '
            'foreign server / edge-function proxy for project ' || v_w.db_project_ref
            || ' (webapp ' || v_w.webapp_name || ') before this RPC can return counts.',
    'webapp', jsonb_build_object(
      'fleet_id', v_w.fleet_id,
      'name', v_w.webapp_name,
      'frontend_domain', v_w.frontend_domain,
      'db_project_ref', v_w.db_project_ref,
      'schema_notes', v_w.schema_notes
    )
  );
end;
$$;

revoke all on function public.list_webapp_schemas(text) from public, anon;
grant execute on function public.list_webapp_schemas(text) to authenticated, service_role;
