# HIBP breach-check key — screenshot checklist (2026-11-28)

Follow along screen by screen. You are already subscribed (Core 1 active).

## Screen 1 — HIBP Dashboard → API Key (where you are now)
- [x] Left sidebar shows **Business → API Key** selected
- [x] Your tier badge shows **Core 1**
- [ ] Click the blue **"Generate New API Key"** button (below the "Your existing API key cannot be retrieved" note, after the Cloudflare check shows Success!)
- [ ] A key string appears ONCE (starts with a long hex string) — copy it immediately; the page will not show it again

## Screen 2 — Supabase dashboard (supabase.com/dashboard)
- [ ] Open the project **bnxermyboeigvwonfrzx** (the main gateway project)
- [ ] Left nav: **Edge Functions → Secrets** (the padlock icon section)
- [ ] Click **Add new secret**
  - **Name:** `HIBP_API_KEY`
  - **Value:** (paste the key you copied)
- [ ] Save

## Screen 3 — Activate (me, automatic on next deploy)
- [ ] Tell me "key is in" — I redeploy admin-console (or any deploy picks it up)
- [ ] Verify: Superadmin Console → any user's dossier → **Breach check** section shows live breach counts instead of "needs HIBP_API_KEY"

## Notes
- Generating a new key replaces any existing key — if you regenerate later, update the Supabase secret too.
- Core 1 allows 10 email searches/minute — enough for on-demand dossier lookups; the integration calls per-email on dossier open, not in bulk.
- Cost: your active Core 1 subscription (from $4.39/month billed annually).
