-- v248 FAKE-DONE GUARD (fleet fake-completion incident 2026-11-16): fleet lanes with
-- no DB write access self-reported status=done while zero rows landed. The gateway
-- (v247) now audits answers and appends a deterministic PLATFORM VERIFICATION banner
-- when data-operation completion claims have no executed tool behind them; this
-- trigger enforces the same rule at the DATABASE level — a lane cannot flip
-- fleet_dispatch.status to 'done' if its result carries the unverified-claim banner.
-- APPLIED LIVE 2026-11-16 via the Management API (owner approved); this file is the
-- repo record of the live trigger.
create or replace function public.fleet_dispatch_done_guard() returns trigger as $$
begin
  if new.status = 'done' and (
       coalesce(new.result,'') ilike '%verified executions: 0%'
       or coalesce(new.result,'') ilike '%claims, not executed results%'
       or coalesce(new.result,'') ilike '%never trust self-reported fleet status%'
  ) then
    raise exception 'FAKE-DONE GUARD: result contains unverified completion claims — lanes cannot mark done without executed evidence. Set status=error or post verified results.';
  end if;
  return coalesce(new, old);
end $$ language plpgsql;

drop trigger if exists fleet_dispatch_done_guard on public.fleet_dispatch;
create trigger fleet_dispatch_done_guard before update on public.fleet_dispatch
  for each row execute function public.fleet_dispatch_done_guard();
