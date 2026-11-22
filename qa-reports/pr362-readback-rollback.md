# PR #362 (routine-ux-fixes) — exact-head production readback + rollback checklist

Head: dde9743c70e5ce9b0e335276a194c90253bb69f0 (CLEAN, all checks pass, Vercel deployment completed).
Scope: security.txt, A11Y attributes (index.html + voice-convo.js), static title, QA register data.
EXCLUDED (still only in #342): terms/legal copy, Earn wiring, CSP frame-src change.

## A. Production readback (run after merge; all credential-free)

```bash
# 1. security.txt live (expect 200 + Contact/Expires/Policy lines)
curl -s https://ai.spaincos.com/.well-known/security.txt
curl -s -o /dev/null -w "%{http_code}\n" https://ai.spaincos.com/.well-known/security.txt   # expect 200

# 2. A11Y negative-control flip (expect bare 0/16; pre-merge production shows 6/16)
#    Playwright check (completion-loop/browser-audit.py pattern) against https://ai.spaincos.com

# 3. title unchanged-correct
curl -s https://ai.spaincos.com/ | rg -o "<title>[^<]*</title>"    # expect "ai.spaincos.com — Where knowledge begins"

# 4. CSP unchanged (no frame-src; hash check)
curl -s https://ai.spaincos.com/ | rg -c "frame-src"               # expect 0 matches (no output)

# 5. smoke suite (repo-standard, includes CSP self-check)
cd ai-gateway-site && python3 qa/csp-hash-check.py                  # expect PASS
```

## B. Preview note

The Vercel preview URL is SSO/password-protected ("Login – Vercel") — the credential-free
0/16 comparison CANNOT run against the preview. Equivalent proof already recorded locally:
branch files served locally = 0/16 bare indicators; live production = 6/16 (negative control,
verified 2026-11-22). Post-merge readback item A.2 is the production equivalent.

## C. Rollback (routine, reversible, no state)

```bash
# full rollback: revert the merge commit (creates a revert commit; auto-deploys)
gh pr merge 362 --merge   # (when authorized)
git revert <merge-commit-sha> --no-edit && git push origin master

# or single-file surgical rollback:
git rm .well-known/security.txt && git commit -m "rollback: remove security.txt" && git push origin master
# A11Y attributes: remove aria-hidden/role additions from index.html (5 elements) and
#   voice-convo.js (1 element) — CSP hash check passes both ways (verified).
# Title: single string revert.
# QA data: git revert of the data files only (no runtime effect).
```

Risk note: all changes are static/attribute-level; no backend, DB, or auth changes;
no behavior coupling; CSP hashes unchanged by this PR.
