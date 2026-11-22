-- Teammate template assignments. Same pattern as qa/showcase-schema.sql: atomic advisory-lock bootstrap,
-- CREATE TABLE IF NOT EXISTS (idempotent), RLS enabled with NO policies = deny-all for anon/authenticated;
-- only the service role (team + gateway-chat edge functions) can read/write. One row per teammate email.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('teammate_template_assignments_bootstrap'));
CREATE TABLE IF NOT EXISTS public.teammate_template_assignments (
  member_email text PRIMARY KEY CHECK (member_email = lower(member_email)),
  template_id text NOT NULL,
  instructions text NOT NULL CHECK (length(instructions) <= 1000),
  assigned_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teammate_template_assignments ENABLE ROW LEVEL SECURITY;
COMMIT;
