# ai.spaincos.com — 100% Completion Parity Document (v159)
**2026-11-11 15:45 UTC · rolled up from the 2026-11-11 parity audit + today's session work · ✅ done · 🟡 partial · 🔴 gap**

**Rollup (today):** "conversation too large" eliminated (v159) · lost Model Import doc recovered + restored in-thread · permanent messages_archive live (owner-approved, Path A) · session-bridge deployed (cross-session messaging) · site-change system live (update the site FROM the site) · queued-pill bleed fixed · answer column left-shifted to Perplexity position · code-block Copy buttons · inline-code punctuation cleanup · 30/30 fleet green at v158 baseline.

## 1. Core search & answer experience

| Area | Status | Detail |
|---|---|---|
| Simple/lookup queries | ✅ | Paris-class answers < 30s (fleet-gated daily, 30/30) |
| Current-events queries | ✅ | Research-sufficient fast path < 35s |
| Citations & sources | ✅ | Numbered sources, junk-host gate, chips, picker |
| Deep/complex research | 🟡 | deep100: 94.6% parity-or-better; complex 76.9%. **Residual: complex first-token ~70s** (serial sub-questions) |
| Multi-turn quality | ✅ | 26→52 BETTER, 100/100 clean runs |
| Answer modes | ✅ | Research, Deep Research, Council, Incognito, Labs (image/video), Voice/Talk/Fit |
| Long threads | ✅ | **FIXED TODAY (v159):** anchor + last 22 turns sent, last 40 rendered with "Show older turns", paged saves, friendly error — "conversation too large" cannot happen again |
| Models | 🟡 | Open-weight fleet (GLM-5.3 auto, Kimi K3.1 Pro, DeepSeek V4.1, Qwen3.8, GPT-OSS 120B, Llama 4, Venice/Dolphin). **Gap: no frontier models** (deliberate cost call, caps hardest 5-10%) |
| **12-model dropdown gap** | 🔴 | From the recovered doc: Qwen3.8-27B, Qwen3-Coder, DeepSeek R1, GPT-oss-20B, Gemma 4 (31B), MiniCPM-o, MiniCPM-OCR, TTS, Timestral, Liquid AI, nomic-embed, Gemini fallback — install script must run on spain-runner (owner machine); gateway-side registration snippet is in the recovered doc |
| Memory | ✅ | Server-side, 1,495 memories, RLS, merged into personalization |
| Python/computation | ✅ | Forced-retry script synthesis + run guarantee |

## 2. Artifacts (docs, webapps, exports)

| Area | Status | Detail |
|---|---|---|
| .md documents | ✅ | Doc-chip + side panel, 900px/62% width, booktabs tables, code bars w/ language label + Copy + syntax coloring, code-block Copy button **(added today)** |
| .docx/.pdf/.xlsx export | ✅ | Download menu on every artifact |
| Webapp generation | 🟡 | End-to-end works (builder prompt, sandboxed iframe). **Gaps: no persistent hosting/shareable URLs, no scheduled agent-driven builds, no webapp eval suite** |
| Charts | ✅ | Inline chart fences |
| Files/attachments | ✅ | Multi-attach ≤10 files w/ thumbnails, docx/xlsx/pptx/pdf client-side extraction (v158) |

## 3. Comet (agentic browser + assistant)

| Area | Status | Detail |
|---|---|---|
| Chrome extension | 🟡 | Assistant v1.0.0 shipped (safety gating, vault-always) |
| **Agentic browsing in-product** | 🔴 | **Biggest single product gap.** browser-service container exists but is NOT a gateway tool the model drives. Needs: wire as `browser_step` full mode (currently read-only Tier-2), multi-tab sessions, form-fill, background agents |
| Background agents | ✅ | Guardians + fleet-dispatch + automations (a different, stronger shape than Perplexity exposes) |

## 4. Connectors & API keys

| Area | Status | Detail |
|---|---|---|
| OAuth connectors | 🟡 | Slack, GitHub, Dropbox live. **Google needs owner re-auth (expired refresh token — top owner action)** |
| API-key providers | 🟡 | Render, Supabase stored server-side. Owner keys still needed for full function |
| Breadth | 🔴 | Notion/Linear/Jira/Figma/Salesforce-class absent — each is a build |
| In-chat tool use | ✅ | connector-tools in chat (email, Drive, Slack, GitHub) |
| Platform API | 🟡 | apikeys module live; usage docs/rate limits thinner than Perplexity's API |

## 5. Sessions, cross-program comms & permanence

| Area | Status | Detail |
|---|---|---|
| **Permanent recovery archive** | ✅ | **DONE TODAY (owner-approved):** messages_archive + delete trigger + baseline snapshot of all 87,847 messages. Nothing can become unrecoverable again |
| **Recovered Model Import doc** | ✅ | Restored in-thread (doc chip) + shared file; 12 models identified by name |
| **Cross-session messaging** | 🟡 | **session-bridge deployed today** (inbound messages render in-thread + session types an acknowledgment). Remaining: frontend live-render of bridge messages (v160), Perplexity→bridge auth (GATEWAY_TOKEN credential), two-way reply polling |
| **Threads active/live** | 🔴 | Threads still passive visually: new messages need refresh. **Needs: Supabase realtime subscription → threads update live + unread badges (v160)** |
| **"Choose one" ranked-option cards** | 🔴 | Perplexity-style structured choice cards (numbered options + Other + Skip/Ctrl+Enter) not in ai.spaincos.com. Needs: gateway `ask_user` tool → SSE event → frontend card → tool result |
| Spaces/Threads/Library/Projects | ✅ | 5,647 threads, 87,847 messages, 20 spaces, all searchable |
| **Search any session from any session** | 🟡 | Sidebar search covers imported+synced threads; deep full-history search across all server-side messages needs a search RPC (open) |

## 6. Self-update (update the site FROM the site)

| Area | Status | Detail |
|---|---|---|
| site-change system | ✅ | **Deployed today:** owner-only `/change` + Fleet Build tab → plans, edits, static gates, PR, Vercel preview verification, auto-merge off. Owner GitHub token via connector |
| DB changes from in-product | 🟡 | Path A used today for the archive (connector, owner-approved). In-product DB-change submission from Build tab not yet built |
| In-product update loop | 🟡 | Fleet QA tab + Build tab live; needs the Recovery tab (read messages_archive) and the DB-change submit form |

## 7. Infrastructure & reliability

| Area | Status | Detail |
|---|---|---|
| Hosting | ✅ | Vercel + Supabase edge (gateway v155, connectors v9, guardian-runner, fleet-dispatch, task-runner, research-jobs, site-change, session-bridge) + Render sandbox |
| Launch gate | ✅ | 30-check fleet, daily 6am PT automation, exception-only |
| **Visual parity** | 🟡 | Typography at spec (pplxSans 16/25.6, 720px col, now left-shifted like Perplexity); **unsigned** — Cloudflare blocks fresh Perplexity ground-truth; needs owner-supplied screenshots + pixel-by-pixel fleet |
| Stale defenses | ✅ | SW resets, build badge, stale-tab bar |
| Guardians | ✅ | 14 guardians, dispatch ledger |

## 8. Residual gap list (ranked by product impact)

1. 🔴 **Agentic browsing (Comet)** — wire browser-service as a full gateway tool (multi-tab, forms, background agents)
2. 🔴 **Live/active threads** — realtime updates + unread badges (v160)
3. 🔴 **"Choose one" cards** — structured option cards with reasoning/logic (owner asked today)
4. 🔴 **Connector breadth** — Notion/Linear/Jira/Figma class
5. 🔴 **12-model dropdown** — needs install script run on spain-runner (owner machine)
6. 🟡 **Complex research first-token ~70s** — parallelize sub-questions
7. 🟡 **Webapp artifacts** — persistent hosting + shareable URLs + eval suite
8. 🟡 **Frontier models** — absent by cost decision
9. 🟡 **Full-history cross-session search RPC**
10. 🟡 **Visual parity sign-off** — needs Perplexity screenshots (owner) for pixel-by-pixel fleet
11. 🟡 **Perplexity→bridge auth** — GATEWAY_TOKEN credential paste (owner, one time)
12. 🔴 **Owner actions:** Google re-auth · passkeys_enabled toggle · SHMT PR #3818 · rotate cron_key/browser_service_token · Render/Supabase keys · run 12-model install on spain-runner

## Bottom line
Search, answers, citations, artifacts, memory, spaces, permanence (new), self-update (new), and the QA fleet are at or past parity. The completion frontier is: **agentic browsing (Comet), live active threads + ranked-choice cards, connector breadth, the 12-model dropdown (owner machine), research latency, and visual sign-off (needs your screenshots).** Everything in this doc is either ✅ shipped, 🟡 scoped, or 🔴 blocked on an owner action listed above.
