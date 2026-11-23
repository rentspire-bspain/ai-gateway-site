# Proposal: narrow frame-src for the Earn tab (follow-up to PR #342)

PR #342 head (c3cb263) ships `frame-src https:` — broad. This proposal narrows it to the
exact approved partner origins once Adscend/ayeT profile URLs are confirmed:

```
frame-src https://adscendmedia.com https://*.adscendmedia.com https://ayetstudios.com https://*.ayetstudios.com;
```

## Local proof (deterministic, reproducible)

Harness: `/home/user/workspace/csp-proof/harness.html` — CSP meta with the narrow list above;
two iframes (approved `https://www.adscendmedia.com`, untrusted `https://example.com`);
`securitypolicyviolation` events recorded. Run via local HTTP + headless Chromium.

Result (2026-11-22):
- POSITIVE (allow): `https://www.adscendmedia.com` produced NO frame-src violation —
  the approved origin is permitted by the narrow list.
- NEGATIVE (deny): `https://example.com` was BLOCKED — violation event recorded
  (`directive: frame-src, blockedURI: https://example.com`).
- Additional correct behavior: adscendmedia's own redirect to `http://adscendmedia.com`
  (insecure scheme downgrade) was blocked by the CSP — schemes are matched, not just hosts.

## Deployment note

Apply by replacing the `frame-src https:` directive in PR #342's index.html CSP when the
partner profile URLs are confirmed (keep `https:` only if partners use unpredictable
per-profile subdomains — confirm first). Alternative already shipped in #342: leave the
embed disabled (Adscend IDs empty) — the wall renders a setup placeholder and loads nothing.

Recommendation: adopt the narrow list at partner-approval time; until then the disabled
embed is the safe state. Do not alter #342 head without ownership coordination.
