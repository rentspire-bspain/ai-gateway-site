# BoundView (CanonIntel LLC) — Legal Counsel Review Checklist

**For:** Counsel review of the BoundView Terms of Service and Privacy Policy drafts
**Entity:** CanonIntel LLC (operator of boundview.com, per owner directive 2026-11-21)
**Drafts under review:**
- Terms: https://boundview.com/terms (draft dated November 21, 2026)
- Privacy: https://boundview.com/privacy
**Repo:** rentspire-bspain/ai-gateway-site — terms.boundview.html, privacy.boundview.html

## A. Entity and authority
- [ ] Confirm CanonIntel LLC is in good standing and its formation/operating documents authorize it to operate the BoundView service.
- [ ] Confirm the entity name is stated exactly as registered (spelling, "LLC" designation) in the terms, privacy policy, and any copyright notices.
- [ ] Confirm who signs/binds CanonIntel LLC (authority of the signatory).
- [ ] Confirm no unresolved name-conflict or trademark issue with "BoundView" in the markets served.

## B. Governing law, venue, disputes (explicitly open in the draft)
- [ ] Select governing law and venue (owner's jurisdiction: California; CanonIntel's state of formation to confirm).
- [ ] Decide dispute-resolution mechanism: courts vs. arbitration; small-claims carve-out; class-action waiver (enforceability varies by state/market).
- [ ] Service-of-process address and registered agent for CanonIntel LLC.

## C. Liability and risk allocation (explicitly open)
- [ ] Approve or adjust the liability cap (currently: amounts paid in the prior 12 months, or zero on a free tier — consider a floor for paid tiers).
- [ ] Confirm the indirect/consequential damages waiver and its enforceability per market.
- [ ] AI-output disclaimer: confirm the draft's "AI output is not professional advice" framing covers research summaries, document analysis, and connector surfaces (email/calendar/file reads).
- [ ] Indemnification: decide whether user indemnity is included; scope and enforceability.
- [ ] Insurance review: does CanonIntel LLC carry appropriate tech E&O / media liability coverage for an AI service?

## D. Billing, refunds, subscriptions (explicitly open — checkout not yet live)
- [ ] Refund policy: default position (all sales final vs. X-day refund); state it in the terms before checkout launches.
- [ ] Subscription mechanics: auto-renewal disclosure, cancellation path, price-change notice period (auto-renewal laws e.g. California ARL require explicit disclosures).
- [ ] Free-trial disclosure rules (the checkout design uses a 30-day trial with card required).
- [ ] Tax responsibility: who collects/serves sales tax, VAT, digital-services rules per market.
- [ ] Confirm payment processing relationship matches the entity: when BoundView sells, it needs a CanonIntel LLC Stripe account (the current gateway checkout runs on RentSpire LLC's account and must NOT be used for BoundView sales — merchant-of-record consistency).

## E. Content, data, and AI-specific terms
- [ ] User content license: confirm the scope granted to CanonIntel LLC (storage, processing, RLS-scoped access, model improvement — opt-in vs. opt-out).
- [ ] Acceptable use: confirm coverage of scraping, automated access, illegal content, and connector abuse.
- [ ] Third-party sources: answers cite external sites and user-connected sources (Gmail, Calendar, Dropbox, Slack) — confirm limitation of liability for third-party content and accuracy.
- [ ] Privacy policy consistency: data-controller designation (CanonIntel LLC), subprocessor list, retention periods, GDPR/CCPA rights (access, deletion, portability), international-transfer basis.
- [ ] AI-training / model-provider disclosures: queries pass through third-party model providers — confirm the privacy policy names categories of providers.
- [ ] Neurons rewards program (if surfaced on BoundView): terms for earning/forfeiting rewards, tax responsibility for reward income.

## F. Consumer-law and market requirements (explicitly open)
- [ ] Markets served: list target countries/states; check consumer-protection minimums (cooling-off periods, mandatory disclosures).
- [ ] Minors: age minimum and parental-consent position (COPPA if under-13 possible).
- [ ] Accessibility statement obligations (ADA/Section 508 posture) — recommended companion document.

## G. Operational consistency checks (pre-launch gates)
- [ ] Terms/privacy posted at stable URLs linked from every boundview.com page (footer/nav).
- [ ] Version history: keep an archive of each published version with effective dates.
- [ ] Change-notice mechanics: how users are notified of term changes (draft currently says "date change + continued use" — counsel to approve or require notice).
- [ ] Contact points: support@boundview.com monitored; registered-agent address listed where required.
- [ ] Confirm zero cross-entity leakage: no RentSpire LLC, Spain Companies, or ai.spaincos references on any boundview.com surface (verified in real browser 2026-11-21; re-verify after any change).

## H. Sign-off
- [ ] Counsel-approved final terms and privacy text delivered to the repo (replace the "Draft pending owner legal review" banner).
- [ ] Effective date set; doc updated; banner removed; owner notified.
- [ ] Calendar review cycle set (annual, or on material change — e.g., checkout launch).

---
*Prepared from the draft's own open-items list plus the deployed product surface. Generated 2026-11-21 by the parity program; not legal advice.*
