# Edge function source (Supabase project dcyjmftriqayqaonitlx)

Version-controlled copies of the gateway edge functions. They are NOT CI-deployed: deploys go through the Supabase connector (`deploy_edge_function`) or `supabase functions deploy`, both with `verify_jwt=false` (the functions gate themselves with `GATEWAY_TOKEN`).

- `call-model` v16: `DEFAULTS.general` pinned to Groq free `qwen/qwen3.8-27b` (2026-10-30), default max_tokens 1024, falls back to free Flint on Groq failure.
- `gateway-status` v3: live model tests; Auto label reads "pinned: Qwen3.8-27B". (Copied from the deployed function.)
- `gateway-chat`: authenticated chat entrypoint (calls call-model with GATEWAY_TOKEN).

If the deployed function and this copy disagree, the deployed one is truth; re-export and commit.
