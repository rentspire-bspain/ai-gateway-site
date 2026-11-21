# COORDINATION RECORD — The 29-Dimension Contract for ALL Webapps and Completion Documents

**Origin:** v291b (2026-11-21), owner directive: "tell all other open sessions working on webapps
to add/confirm all of these dimensions and make sure there is full continuity in the level of
dimensions and rigor for all webapps and all completion documents."

**Status: ACTIVE STANDING RULE.** Every session working on any webapp or completion document in
this program applies this dimension set and this rigor level. BROADCAST to 21 live sessions on
2026-11-21 (acknowledgments logged in each session).

## The 29 dimensions (weights and current scores in qa/parity-items.json)

The parity headline is computed by `qa/generate-parity-headline.py` from `qa/parity-items.json` —
NEVER hand-summed. Current: **84.4% (10804/128)**. Feature-parity-only view: 90.4%.

| Group | Dimensions (weight, score) |
|---|---|
| Feature parity (17 cats, w98) | Features 99, Computer 99, API 95, Troubleshooting 90, Voice 80, Account 95, Models 92, Connectors 98, Privacy 88, Comet 70, Premium 80, Enterprise 70, GettingStarted 90, Desktop 70, Billing 92, Mobile 60, Teammates 68 |
| Product surfaces (12 cats, w30) | UX 91 (w6), SEO 75 (w3), Marketing 60 (w3), Security 80 (w4), Accessibility 55 (w2), Legal/Compliance 45 (w2), Docs/Support 50 (w2), Observability 65 (w2), Fleet 55 (w3), Email/Notifications 30 (w1), i18n 10 (w1), NativeMobile 40 (w1) |

## The rigor contract (what "continuity" means)

1. **Evidence-scored, never vibes**: every dimension score cites live-verified evidence (curl
   results, browser-run checks, measured suites). Partials are honest (P = 0.5).
2. **The standing post-deploy gates**: `qa/e2e-real-flows.py` (9 shell flows),
   `qa/e2e-ux-flows.py` (9 UX flows), `qa/e2e-ux-master.py` (46 checks, gate >= 90 GREEN), and
   `qa/eval-replay.py --deploy-id <dpl_or_sha>` (or `./qa/run.sh --eval-replay <dpl_or_sha>`, the
   cheap 10-query gateway work-log / claim-guard / continuation / artifact gate appending per-deploy
   drift rows to `qa-reports/eval-replay/history.jsonl` + `history.md`).
   Any webapp without equivalent gates is flagged as a Fleet-category gap in its doc.
3. **No false claims**: never report work complete without live verification. No grader-gaming.
4. **Serving-layer lessons (v290/v291, apply to every webapp)**:
   - Verify WHICH server actually serves each domain (DNS assumptions go stale — ai.spaincos.com
     was assumed GitHub Pages but is Vercel-served).
   - Never serve one brand's HTML on another brand's domain (the bv-render hostname gate).
   - Function-routed paths do NOT get vercel.json headers — the function carries its own.
   - Non-git-connected deploy targets go stale silently (boundview.com was frozen at v288 until
     v291 consolidated it onto the auto-deploying project).
5. **Doc discipline**: master-doc updates go branch + PR (never push master directly, never
   --admin merge, SKIP_PRELAUNCH=1 pushes, Perplexity co-author trailer on commits).

## Per-webapp completion docs

Every webapp completion doc adopts this dimension set (the subset that applies, with the full
29 listed and N/A marked where genuinely out of scope) and the same scoring rubric
(PASS 1.0 / PARTIAL 0.5 / FAIL 0.0, weighted category means, gate >= 90 GREEN).
