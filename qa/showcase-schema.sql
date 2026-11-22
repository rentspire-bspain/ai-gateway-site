-- Handler executes this new-table bootstrap atomically with an advisory lock.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('boundview_demo_workspaces_bootstrap'));
CREATE TABLE IF NOT EXISTS public.boundview_demo_workspaces (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  app text NOT NULL CHECK (app IN ('tasks','budget','study')),
  state jsonb NOT NULL,
  actor_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- No public grants. Handler uses existing server-side PG credentials.
ALTER TABLE public.boundview_demo_workspaces ENABLE ROW LEVEL SECURITY;
COMMIT;
