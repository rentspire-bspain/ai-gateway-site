# Wave-1 rebuild acceptance

The top three catalog apps are G61 tasks/habits, G62 budget/subscriptions and F53 study planner. Prior acceptance found all three to be drafts; this rebuild replaces their inline draft code with shared, testable models and real served routes, without claiming full launch readiness.

## Implemented repairs

| App | Route | Repairs |
|---|---|---|
| G61 | `/showcase.html?app=tasks` | Add/edit/remove tasks and habits, toggle today's check-in, dynamic completion and date-based streaks. |
| G62 | `/showcase.html?app=budget` | Add/edit/remove expenses and subscriptions, income editing, integer-cent summation; “Remove from tracker” never claims bank cancellation. |
| F53 | `/showcase.html?app=study` | Add/edit/remove assignments, exams, revision and classes; one validated `date` field for inputs and countdowns. |

All three support deterministic prompt-to-theme presets changing fonts, palette and welcome copy, JSON export/import and explicit server saves. No changes to checkout, stripe-webhook or root index.html; no root inline-script CSP hashes changed.

## Persistence boundary

The API uses server-issued 256-bit private resume tokens, hashes them before storage and scopes every lookup to token hash AND app. Tokens live in the URL fragment, not query strings; fragment links are bearer capabilities, not signed-in accounts, and anyone possessing one can read/edit that workspace.

PG-backed workspaces are a functional persistence mechanism, NOT evidence of external-account isolation. The interface warns against sensitive data, honestly handles unavailable storage, and offers export; successful persistence must be checked on the deployed API rather than inferred from the source.

The handler bootstraps only `public.boundview_demo_workspaces` in one advisory-locked transaction, then enables RLS on this new table with no policies before commit. This denies ordinary anon/authenticated REST access, while the existing privileged server PG connection performs row-scoped operations; bootstrap errors roll back and fail closed, and no existing app tables, roles or policies are changed.

Parent coordination explicitly approved this new-table-only RLS exception and owns the guarded push/PR/merge because the pre-push suite requires browser execution, prohibited in this worker lane. No SKIP_PRELAUNCH bypass or false flaky-gate claim is used here.

## Verification contract

Run `node --check` for every changed JS/CJS file, `node qa/showcase-model.test.cjs`, and `node qa/showcase-api.test.cjs`. Model tests exercise arithmetic, streaks, dates and validation; API tests use mocked PG and verify create/read/update and token/app boundaries, not a real database or browser.

Post-merge curl must check HTML, both JS files, CSS and `/api/showcase?app=tasks|budget|study` on both ai.spaincos.com and boundview.com. For live persistence, create a fictional workspace, update it, fetch it in a fresh request and check wrong-token/cross-app denial; keep the private token out of logs.

Browser rendering, form interaction, import/export download behavior, accessibility/mobile appearance, browser reload persistence, two-account isolation and prompt-to-new-deployment timing remain NOT VERIFIED in this no-browser lane. The three mandatory full-suite equivalents remain a Fleet gap; no completion score is raised.

## Owner-gated versus implementation gaps

- **Not owner-gated:** draft arithmetic, static statistics, inconsistent date fields, CRUD controls, honest copy, preset theming, JSON transfer, route delivery and capability persistence can be repaired in code.
- **Deployment configuration:** if PG-backed saves return 503, the deployment operator must provision PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE and bootstrap the new table; this is not automatically an owner-only blocker.
- **External accounts:** authenticated account ownership/RLS integration is a separate security-reviewed implementation lane, not supplied by private links; no claim that a missing credential alone fixes it.
- **Stripe:** owner completes business onboarding and securely supplies approved integration credentials/webhook configuration; this lane deliberately leaves owner-gated handlers untouched.
- **Custom domain:** provide the per-deployment DNS target after a real fork/provisioning integration exists, then owner adds the exact records at the registrar and verifies HTTPS.

All 29 canonical completion dimensions remain in force: Features, Computer, API, Troubleshooting, Voice, Account, Models, Connectors, Privacy, Comet, Premium, Enterprise, GettingStarted, Desktop, Billing, Mobile, Teammates; UX, SEO, Marketing, Security, Accessibility, Legal/Compliance, Docs/Support, Observability, Fleet, Email/Notifications, i18n, NativeMobile. Scores remain unchanged; use canonical qa/parity-items.json weights and generator, never hand-sum a headline.
