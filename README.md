# ai.spaincos.com — frontend + QA fleet

Vercel deploy-on-push (master). Backend edge functions live in the `ai-gateway-live` workspace (deployed via Supabase).

## Pre-launch regression fleet (part of the product)

Every push to master and every deploy is gated by `qa/prelaunch.py` — a 29-check fleet: backend smoke (gateway, modes, guardians, memory), deploy integrity (live modules must byte-match this repo), and frontend E2E (composer, thread routes, follow-ups, doc panel, Fleet page, Connectors, CSP/JS errors). Screenshots land in `qa-reports/prelaunch/`.

```bash
bash qa/install-hooks.sh        # once per clone: installs the pre-push gate
./qa/run.sh                    # full run against LIVE
./qa/run.sh --local            # against a local build (http://localhost:8765)
SKIP_PRELAUNCH=1 git push ...   # emergencies only
```

- Machine report: `qa-reports/prelaunch/latest.json` (+ `history.jsonl`) — rendered inside the product on the Fleet page → QA tab.
- A push is blocked when any check fails; the failing check names print with details.

## Stale-cleanup fleet

`qa-reports/hygiene/` holds the multi-lane hygiene audits (DB, disk, frontend dead code, backend dead code) and `db-cleanup.sql` (commented, safe-first; review before running). Rerun the lanes after major changes; findings feed the Fleet page and the pre-launch gate.

## Hard rules learned the hard way

- After ANY edit to an inline script in `index.html`: `node tools/gen-csp-sri.mjs index.html` then `--check`. A stale CSP bricks the page (dead buttons, Enter eating prompts).
- Module URLs must be ABSOLUTE (`/modules/...`): relative URLs resolve to `/t/modules/...` on thread routes and 404, silently killing the composer.
- `sw.js` version must be bumped whenever modules change; the one-time reset in `index.html` (guard key `ai_sw_reset_99`) unregisters old workers and wipes caches for returning browsers.
- The doc-chip / doc panel path lives in `modules/artifacts.js` + `modules/docs-panel.js` — never edit orphaned copies elsewhere.
