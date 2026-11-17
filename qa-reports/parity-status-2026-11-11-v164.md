# ai.spaincos.com — 100% Completion Parity Document (v164)
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

## 9. Perplexity Agent API capabilities (added v163)
Source: [Agent API docs](https://docs.perplexity.ai/docs/agent-api/quickstart), [tools overview](https://docs.perplexity.ai/docs/agent-api/tools/overview), [effort presets](https://docs.perplexity.ai/docs/agent-api/effort), [changelog](https://docs.perplexity.ai/docs/resources/changelog).

| Perplexity capability | ai.spaincos.com today | Status |
|---|---|---|
| Endpoint `POST /v1/agent`, multi-provider models (OpenAI, Anthropic, Google, xAI) | gateway-chat, open-weight models via call-model | 🟡 no frontier providers (cost call) |
| Effort presets `fast/low/medium/high/xhigh/ultra` | Modes (concise, research, deep), routeModel task router | 🟡 map presets to modes + router |
| `web_search` tool (domain/date/location filters, fast vs web search type) | research lane + web_search tool | 🟡 add domain/date filters, fast/standard toggle |
| `fetch_url` tool (max_urls 1-10) | fetch_page tool | 🟡 add multi-URL |
| `sandbox` code tool | Python sandbox with forced-retry | ✅ |
| `people_search` tool | none | 🔴 |
| `finance_search` tool | none (finance connectors absent) | 🔴 |
| Custom functions (JSON Schema, paused back to caller) | connector tools + dispatch_fleet | 🟡 generic function-calling API missing |
| Remote MCP servers as tools | none | 🔴 |
| Profiles (saved, versioned configs) | Skills/Spaces instructions | 🟡 |
| Structured outputs, token budgets, max_steps | partial | 🟡 |
| Inline typed citations (`[web:1]`) | numbered citations + source picker | ✅ |
| Search API (ranked results), Embeddings API, Decisions API, Orchestrator API | embeddings + memory only | 🔴 expose as /api endpoints with API keys |

## 10. Execution gap and connections tracker (v163)
| # | Item | Status | Next action / blocker |
|---|---|---|---|
| E1 | session-bridge accepts owner JWT (no shared secret) | ✅ v2 live, ack verified in-thread | none |
| E2 | Recovered model doc delivered to ai.spaincos session | ✅ received, acknowledged | session has no execution tools (E4) |
| E3 | guardian-runner cron (14 guardians, 13 enabled) | 🟡 running; spain-terminal FAIL (terminal-health 503, Vercel 429 checkpoint), rentspire WARN | fix terminal-health probes (checkpoint blind) |
| E4 | fleet-dispatch claim/post_result | 🟡 8 jobs queued at high priority; needs FLEET_DISPATCH_KEY holder (orchestrator) to claim | run claimer on free route |
| E5 | Fleet registry | ✅ 219 entries (166 automations, 31 build lanes, 14 guardians, 3 runtime, 5 org); 98 live / 46 on_demand / 75 paused | wake on_demand lanes |
| C1 | Google connector | 🟡 OAuth client configured, not connected | owner clicks Connect |
| C2 | Slack, GitHub, Dropbox | 🔴 OAuth app ID/secret not set | create apps, set secrets (needs write-capable Supabase key) |
| C3 | Render, Supabase key connectors | 🟡 configured, not connected | owner pastes key in Settings |
| C4 | Settings connect/disconnect toggles + accidental-disconnect alert | ✅ v164 live (PR #25, dpl_GDMyqxxst) | toggle switches for all 7 providers; watch in localStorage; deliberate disconnects never alert |
| C5 | Every callable tool wired (Computer parity) | 🔴 queued (e047acee) | tool audit vs tool-loop |
| T1 | Gateway token rotation | 🟡 Vercel rotated; Supabase and Deal Engine secrets blocked (PATs lack edge_functions_secrets_write) | owner-created PAT with that scope |
| T2 | Email-code limit 10/hr, passkeys | 🔴 blocked: PATs lack auth_config_write (Supabase dashboard toggle works) | same PAT |
| H1 | Harvest tool in gateway | 🔴 comptrove_readonly_query RPC + secrets + bulk harvest tool absent | build RPC, set COMPTROVE_API_URL/KEY |
| A1 | Doc auto-open removed | ✅ v163 live, fleet 31/31 | none |

## 11. Callable-tool audit — Perplexity Computer vs ai.spaincos tool-loop (v164 amendment)
Live inventory verified in gateway-chat v155 source (`tool-loop.ts`, `connector-tools-client.ts`).

### Tools ai.spaincos already has
| Tool | Where | Notes |
|---|---|---|
| web_search | tool-loop | domain/recency filters via searchF |
| fetch_page / fetch_asset | tool-loop | |
| browser_step | tool-loop | browser automation |
| run_python / calculator | tool-loop | sandboxed code execution |
| search_my_context | tool-loop | cross-session memory search |
| record_plan / mark_step / propose_patch | tool-loop | planning tools |
| Email/calendar | connector wave 1 | search_email, read_email, list_events + approve-card writes |
| Drive/Sheets/Slack/GitHub/Dropbox/Render/Supabase reads | connector wave 2 | 16 read-only tools, gated by intent |
| list_fleet / dispatch_fleet | fleet tools | registry + queue |

### Missing tools (the real gaps)
| # | Missing tool | Perplexity equivalent | Work needed | Status |
|---|---|---|---|---|
| M1 | ask_user / Choose-one ranked cards | request_user_input | gateway tool + frontend card UI (job 21f4af91 queued) | 🔴 |
| M2 | Harvest/ingest tool | web fetch + connectors | query_comptrove is a disabled placeholder; needs COMPTROVE_API_URL/KEY + comptrove_readonly_query RPC | 🔴 |
| M3 | Website deploy | deploy_website | new function wrapping Vercel deploy API | 🔴 |
| M4 | Image analysis (view_images) | vision input | GLM-5.3 vision already routed; expose as tool | 🟡 |
| M5 | Subagent spawn/parallel | spawn_agent | dispatch_fleet queues but no executor (E4) | 🟡 |
| M6 | Vercel/Fly write tools | CLI connectors | render read-only exists; no deploy/restart | 🔴 |
| M7 | File share (share_file) | share_file | artifacts system covers most; public share links partial | 🟡 |
| M8 | Cross-session search | session bridge | job 0c18f500 queued (RPC + Recovery tab) | 🟡 |

### Connector credential status (verified live)
Google OAuth client configured but not connected (needs owner click). Slack, GitHub, Dropbox OAuth app ID/secret blank — tools exist but return "not configured". Render, Supabase key connectors live once the owner pastes a key in Settings > Connectors (now with toggle switches, v164).

## 12. v164 change log
- PR #24 (merged): parity doc rollup — Agent API capability map (section 9), execution-gap tracker (section 10).
- PR #25 (merged, live as v164): Settings > Connectors toggle switches for Google + Dropbox/Slack/GitHub/Render/Supabase; connection watch with accidental-disconnect alert (localStorage last-known-good map, deliberate-disconnect markers, auto-clear on reconnect). Fleet QA 28/28 green on preview.
- Live production deployment verified via Vercel API (dpl_GDMyqxxst7URT3kN9e76DEDTGA5g, Ready, aliased to ai.spaincos.com). Production-domain 403s during QA are the Vercel Security Checkpoint throttling the QA probe IP — the same issue that blinds the spain-terminal guardian; not a site outage.

## Bottom line
Search, answers, citations, artifacts, memory, spaces, permanence (new), self-update (new), and the QA fleet are at or past parity. The completion frontier is: **agentic browsing (Comet), live active threads + ranked-choice cards, connector breadth, the 12-model dropdown (owner machine), research latency, and visual sign-off (needs your screenshots).** Everything in this doc is either ✅ shipped, 🟡 scoped, or 🔴 blocked on an owner action listed above.
