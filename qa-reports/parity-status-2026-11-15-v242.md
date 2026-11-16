# ai.spaincos.com: 100% Completion Parity Document (v242)
**2026-11-16 (night #9 UTC) · v242 EMAIL DELIVERY LIVE — the Resend blocker is CLOSED: the three DNS records are live at GoDaddy (TXT resend._domainkey.ai DKIM, CNAME rsend.ai → rsend.forge.rmta.net, CNAME send.ai → send.forge.rmta.net), the Resend domain ai.spaincos.com is VERIFIED (Forge Ready, verified at 2026-11-15 16:31 UTC), a fresh Resend API key is vaulted as RESEND_API_KEY (the dead key replaced via the Supabase dashboard), RESEND_FROM is corrected to login@ai.spaincos.com, and the auth-email-relay live send is DELIVERED (Resend Logs: bspain@spaincos.com "Delivered", code 517745) · Account 90→95 · gateway v237 deployed with the D4/D3 replay fixes (complex prompts now get the full 4,000-token budget; the truncation retry is raised to 6,000 tokens with a second-pass continuation merge; the claim-can't rewrite now fires on cometAsk) · headline 90.1% → 90.4% (8858/98, computed) · teal bar v242** — headline 90.1% (8828/98, computed) · the v241 full postmortem (JS-dead app, CSP hash) is in §29ca · the student-verification diagnosis is in §29cb (now unblocked — see §29cc) · the 717-prompt replay final list is §29by · the self-improvement-cycle rollout is §29bs–§29bv

> **HEADLINE: weighted average total completion 90.4%**. The reproducible §26 score is 8858 ÷ 98 = 90.387755%, rounded to one decimal. Rescore this batch: Account 90→95 (auth email codes working end-to-end, password login + logout fixed in v240; passkeys enabled by owner, enrollment test pending). Raw tracked-item count: **104✅ / 33🟡 / 20🔴** (157 items). All arithmetic computed by qa/generate-parity-headline.py against qa/parity-items.json v242 — never hand-summed.

## 29cc. v242 change log: RESEND EMAIL DELIVERY LIVE — the auth/student-verification blocker closed (2026-11-16 night #9 UTC, owner directive "add the three Resend DNS records to GoDaddy / create a Resend API key and store it as the auth email key")

| Item | What was done | Live verification |
|---|---|---|
| GoDaddy DNS records | Drove GoDaddy in Comet (owner logged in): added TXT `resend._domainkey.ai` (DKIM, full 218-char value from Resend's aria-label), CNAME `rsend.ai` → `rsend.forge.rmta.net`, CNAME `send.ai` → `send.forge.rmta.net` to the spaincos.com zone (TTL 1800 — GoDaddy's minimum; Resend's requested 60 is advisory only) | Resend domain status went "Not Started" → "Pending" → **Verified** (domain events: DNS verified 2026-11-15 16:31 UTC, domain verified 16:32 UTC; RESEND FORGE: Ready) |
| Resend API key | Created `ai-spaincos-auth-email` (Sending access) in the Resend dashboard and vaulted it as `RESEND_API_KEY` in the Supabase project secrets (replacing the dead key via the dashboard — confirmed "Successfully created new secret") | Key value never printed; the send test below is the proof |
| RESEND_FROM | Corrected from the broken hex string to `login@ai.spaincos.com` | Supabase secrets row shows the address; auth-email-relay send succeeded |
| Auth email codes | auth-email-relay POST {action:"send", email:"bspain@spaincos.com"} | **HTTP 200 {"ok":true} and Resend Logs: bspain@spaincos.com — "517745 is your ai.spaincos.com sign-in code" — Delivered, just now** |
| Student verification | The send path (student-verify-send) now has a working provider. End-to-end test (.edu address → email → code → 1,000 credits + 500 Neurons) is queued — the function correctly rejects non-.edu (HTTP 400 email_must_be_edu on the owner address, by design) | Function responds; .edu flow queued for the next verification pass |
| Gateway v237 (replay fixes) | Deployed (deploy id faf69cb4, version 238 in the platform's internal version counter): (a) D4 — `complex` prompts (not just extreme/longMultiPart) now get the full 4,000-token budget; the QA check-0 retry is raised 4000→6000 tokens; a second-pass continuation merges the remainder when the retry still cuts; (b) D3 — the claim-can't rewrite regex now includes "cannot be executed from (this|the) session" and fires on cometAsk | Live probe: gateway responds 200 on the eval-bot token; the replay re-run of the 95 deviation prompts is the remaining verification step |

**Owner actions remaining (parked, exact steps):**
1. **Passkey enrollment test** — passkeys are enabled in the Supabase dashboard; open ai.spaincos.com, sign in, register a passkey in account settings, then sign out and sign back in with the passkey. If the registration UI is missing, that is a frontend gap to file.
2. **Student verification end-to-end** — send a verification email to a .edu address you control, paste the code at /verify, confirm the 1,000 credits + 500 Neurons grant.
3. **OpenRouter auto-top-up** (owner-only, financial) — add a payment method and set auto top-up in the OpenRouter dashboard.
4. **The 95-prompt deviation re-run** — after the D4/D7/D1 fixes settle, re-run `python3 qa/prompt-replay.py` against only the deviation set from qa-private/prompt-replay/results.jsonl (rows where dev != null). The harness is resumable.

**The remaining open classes from §29by:** D7 (11 — evidence-size trim queued), D1 read-timeouts (6 — overlap with D4 long generations; the 6,000-token retry shortens them), D1 401s (2 — harness artifacts, re-runnable). D3 is addressed in v237 (pending the re-run to confirm). D4 is addressed in v237 (pending the re-run to confirm).

## 29by. v237: THE 717-PROMPT FULL-HISTORY REPLAY — FINAL DEVIATION LIST (2026-11-15 late UTC, complete)

**Run:** the full extracted Perplexity prompt history (717 unique prompts, scrubbed, private corpus at qa-private/) replayed through the live gateway (auto-routed, real research + tool lanes) — 717/717 completed, ~7h wall clock, 4 workers, token re-mint on expiry. This is the COMPLETE final list; earlier partial counts (365, 492) are superseded by this section.

**Final tally: 622/717 clean (86.8%). Deviations: 95 total (13.2%).**

| Class | Count | Rate | What it is | Status |
|---|---|---|---|---|
| D4 truncated answer | 74 | 10.3% | Answer ends mid-word — 68 of 74 verified by tail inspection as REAL truncations (not detector noise); 21 of the 74 rode HTTP 546 (upstream retry exhaustion), so truncation correlates with upstream strain. Median truncated answer 2,502 chars. | **FIX IN FLIGHT (gateway v237)** — complex prompts now get the full 4,000-token budget; the QA word-limit retry is raised to 6,000 tokens with a second-pass continuation merge. Re-run pending. |
| D7 worker resource limit | 11 | 1.5% | WORKER_RESOURCE_LIMIT after retries on heavy fleet/completion prompts — the v230 auto-invocation machinery + parallel evidence gathering exceeds the edge worker envelope on the heaviest directives | OPEN — same family as the 14:00Z pre-launch gate cascade. Fix: trim auto-injected evidence size, make parallel evidence fetches lazy/sequential under load. |
| D1 error/empty | 9 | 1.3% | 6 client read timeouts (generations exceeding the read window), 1 server 504 idle timeout (150s), 2 mid-run 401 session expiries the harness re-mint did not recover (both prompts re-runnable) | PARTIAL — the timeout class overlaps D4/D7 (long generations); the 2 401s are harness artifacts, not gateway defects |
| D3 dead-end refusal | 1 | 0.1% | "HANDLE WHATEVER ELSE IS REMAINING YOURSELF AND IN COMET" → answered "cannot be executed from this session" — the v233 COMET never-refuse rule did NOT hold for this phrasing (routing fell outside the cometAsk matcher) | **FIX IN FLIGHT (gateway v237)** — the claim-can't rewrite now fires on cometAsk with the "cannot be executed from this session" pattern. Re-run pending. |
| D2 token leak | 0 | 0% | none | CLOSED |
| D5 research-no-sources | 0 | 0% | none | CLOSED |
| D6 refuse-all | 0 | 0% | none | CLOSED |

**Context for the numbers:** the corpus is the owner's ENTIRE history — hundreds of RentSpire/Comptrove/SHMT internal-tooling prompts referencing PRs, migrations, ledgers, and tools that do not exist on this platform. The replay measures graceful handling of out-of-context, long, multi-part directives. The D4/D7 classes concentrate exactly there: prompts that legitimately demand report-length outputs and maximal evidence gathering.

**What the replay PROVES is closed:** zero token leaks (D2), zero ungrounded research answers (D5), zero refuse-all answers (D6), and only ONE dead-end refusal across 717 prompts (the v220–v233 never-refuse architecture holds at 99.9% on this class).

**Next actions (ranked):** (1) re-run the 95 deviation prompts against gateway v237 to confirm D4/D3 closure; (2) D7 — evidence-size trim + lazy fetch; (3) the all-model audit battery (qa/all-model-audit.py, 17 lanes x 4 scenarios, --repeat 2) still to run as the companion pass; (4) contract tests + prelaunch re-run when idle.

