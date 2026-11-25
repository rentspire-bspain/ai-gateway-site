-- v351: distributed rate limiter for the public API (Security lane).
-- Fixed-window counter keyed to resolved identity (api key id / user id / IP).
-- Applied to production bnxermyboeigvwonfrzx on 2026-11-25 via the management SQL API
-- (same autonomous class as the fleet_registry backfill); this file is the record.
create table if not exists public.api_rate_limits (
  identity text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (identity, window_start)
);
alter table public.api_rate_limits enable row level security;

create or replace function public.api_rate_limit_take(p_identity text, p_limit int, p_window_s int)
returns jsonb language plpgsql as $fn$
declare ws timestamptz; n int; allowed boolean; retry int;
begin
  ws := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s);
  insert into public.api_rate_limits (identity, window_start, hits) values (p_identity, ws, 1)
  on conflict (identity, window_start) do update set hits = public.api_rate_limits.hits + 1
  returning hits into n;
  allowed := n <= p_limit;
  retry := case when allowed then 0 else p_window_s - (extract(epoch from now())::int % p_window_s) end;
  return jsonb_build_object('allowed', allowed, 'retry_after', greatest(retry, 1));
end $fn$;
