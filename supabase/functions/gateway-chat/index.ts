import { corsFor, preflight as corsPreflight } from "../_shared/cors.js"; // v103: aliased — the I7 self-check below defines its own `preflight`
import { MemoryLimiter, RATE_POLICY, dbRateCheck, tooMany } from "../_shared/rate-limit.js";
import { safeEqual } from "../_shared/call-model-policy.js";
import { runToolLoop, shouldRunToolLoop, sanitizeSearchQuery, condenseSearchQuery, autoFetchAssets, initEgress, CONNECTOR_INTENT, CONNECTOR2_INTENT, FLEET_INTENT, DISPATCH_INTENT, MCP_INTENT, TOOLS_INTENT, ACK_TURN_RE, needsComputation, toolRunPythonForFallback, toolPlatformStatus, toolCreateFile, resolveFleetEmail, toolRunRunnerJob, toolGithubWrite } from "./tool-loop.ts";
import { runConnectorTool } from "./connector-tools-client.ts";   // v141 FLEET: server-side list_fleet auto-invocation
import { ProgressSink, wantsLiveProgress } from "./progress.ts";   // v103 F12
import { scrubCredentials, harvestSecrets, REDACTION_NOTICE } from "./credential-scrub.ts";   // cycle 2 gap 2: shared output credential scrub (both paths)
import { detectUnknownAcronyms, quoteAcronyms, acronymSearchHint, ACRONYM_WRITER_RULE, ACRONYM_PROMPT_EXAMPLES } from "./acronyms.ts";   // cycle 2 gap 1
import { planDecision, PLAN_WRITER_GUIDANCE, planPhase, isFollowUpDeliverable, FOLLOWUP_DIRECT_RULE } from "./plan-guidance.ts";   // v103 I8
import { deepInstructions, DEEP_MAX_STEPS, DEEP_MAX_OUTPUT_TOKENS, isClarifierAnswer, isShortFollowUp, isImageGenAsk, IMAGE_ASK_RULE, CLARIFIER_CONTINUATION_RULE, COMPLEX_DEPTH_RULE, DOCUMENT_RULE, WEBAPP_RULE, VERIFY_RULE, isDocumentAsk, isWebappAsk, isVerifyAsk } from "../_shared/deep-brief.ts";   // worse-elimination 2026-11-10
import { buildSourceIndex, rewriteWebMarkers, alignOutlets, canonicalSourceItems, cleanImages, normalizeSourceUrl, cleanSourceTitle, urlKey, hostOf } from "./citations.ts";   // v128 citation accuracy

// ============================================================
// STREAMING CITATION LINKER (v58) — parity fix
// ============================================================
// The non-streaming path rewrites the model's bare [N] markers into
// [[N](url)] markdown links and appends a "## Sources" list (see the
// post-response block below). The streaming path pipes the model's SSE
// straight through, so streamed answers carried bare [1] markers with no
// clickable sources — a visible parity gap vs both the non-streaming path
// and Perplexity. This transform runs on the SSE pipe: it links markers in
// content deltas (handling markers split across chunk boundaries) and
// injects a final Sources delta just before the model's finish event.
// v180 (owner report 2026-11-12): some writer models percent-encode URLs that already
// contain percent escapes, and each rewrite pass compounds it (% → %25 → %2525 → …).
// Unwind any URL that carries the double-encoding signature; leave everything else
// (including legitimately single-encoded URLs) untouched.
function unwindDoubleEncodedUrls(text: string): string {
  return String(text ?? "").replace(/https?:\/\/[^\s<>"')\]]+/g, (u) => {
    if (!/(?:%25(?:25)*%25|%2525)/.test(u)) return u;
    let cur = u, guard = 0;
    while (/%25/.test(cur) && guard++ < 12) {
      let d: string;
      try { d = decodeURIComponent(cur); } catch { break; }
      if (d === cur) break;
      cur = d;
    }
    return cur;
  });
}

function linkCitationsSSE(body: ReadableStream<Uint8Array>, findings: Array<{ title: string; url: string; extract?: string }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const outlet = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
  const used = new Set<number>();
  let holdback = "";   // possible partial [N marker split across deltas
  let sourcesEmitted = false;
  // Bare [N] only: not already inside a markdown link ([[N](...) or [text](...)).
  const markerRe = /(?<!\[)\[(\d{1,2})\](?!\()/g;
  const linkRun = (text: string): string =>
    text.replace(markerRe, (full, n) => {
      const i = Number(n);
      if (i >= 1 && i <= findings.length) { used.add(i); return `[[${i}](${findings[i - 1].url})]`; }
      if (i > findings.length && i <= 40) return "";   // SI-5: dangling marker (no such source) — drop it instead of leaking a bare [18]
      return full;
    });
  // SI-2: never link inside code. `merged[-1][1]` in a code answer used to become `merged[-1][[1](url)]`, corrupting the
  // snippet. State machine across deltas: ``` toggles a fence; a single ` toggles inline code until end of line.
  let inFence = false, inInline = false;
  const linkMarkers = (text: string): string => {
    let out = "", run = "", i = 0;
    const flush = () => { if (run) { out += linkRun(run); run = ""; } };
    while (i < text.length) {
      if (text.startsWith("```", i)) { flush(); out += "```"; inFence = !inFence; inInline = false; i += 3; continue; }
      const ch = text[i];
      if (inFence) { out += ch; i++; continue; }
      if (ch === "`") { flush(); out += ch; inInline = !inInline; i++; continue; }
      if (ch === "\n") { flush(); out += ch; inInline = false; i++; continue; }
      if (inInline) { out += ch; i++; continue; }
      run += ch; i++;
    }
    flush();
    return out;
  };
  const processContent = (content: string): string => {
    holdback += content;
    const m = holdback.match(/(?:\[\d{0,2}|`+)$/);           // trailing partial marker (or partial ``` fence)?
    let emit: string;
    if (m) { emit = holdback.slice(0, holdback.length - m[0].length); holdback = m[0]; }
    else { emit = holdback; holdback = ""; }
    // v180: also unwind any double-encoded URLs the writer emitted inline
    return unwindDoubleEncodedUrls(linkMarkers(emit));
  };
  const sourcesDelta = (): string => {
    const list = [...used].sort((a, b) => a - b)
      .map(n => `${n}. [${findings[n - 1].title} — ${outlet(findings[n - 1].url)}](${findings[n - 1].url})`)
      .join("\n");
    return `data: ${JSON.stringify({ id: "src-links", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: `\n\n## Sources\n\n${list}` }, finish_reason: null }] })}\n\n`;
  };
  let pendingLine = ""; // v66: SSE data lines can split across network chunks —
  // buffer the trailing partial line instead of appending a newline to it (the
  // old code turned a split JSON line into two unparseable lines and the
  // client DROPPED the text inside — the "it% month over month" text loss).
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      pendingLine += decoder.decode(chunk, { stream: true });
      const lines = pendingLine.split("\n");
      pendingLine = lines.pop() || "";
      for (const line of lines) processSSELine(line, controller);
    },
    flush(controller) {
      if (pendingLine) { processSSELine(pendingLine, controller); pendingLine = ""; }
      // Stream ended without a finish event (timeout / client abort): still link what we can.
      if (!sourcesEmitted && holdback) { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: "src-links", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: linkMarkers(holdback) }, finish_reason: null }] })}\n\n`)); }
      controller.enqueue(encoder.encode(decoder.decode()));
    }
  }));

  function processSSELine(line: string, controller: TransformStreamDefaultController<Uint8Array>) {
    if (!line.startsWith("data:")) { controller.enqueue(encoder.encode(line + "\n")); return; }
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") { controller.enqueue(encoder.encode(line + "\n")); return; }
    let evt: any;
    try { evt = JSON.parse(payload); } catch { controller.enqueue(encoder.encode(line + "\n")); return; }
    const ch = evt?.choices?.[0];
    if (ch?.finish_reason && !sourcesEmitted) {
      sourcesEmitted = true;
      // flush any held-back partial marker first, then the Sources list
      if (holdback) { const rest = linkMarkers(holdback); holdback = ""; if (rest) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: "src-links", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: rest }, finish_reason: null }] })}\n\n`)); }
      if (used.size) controller.enqueue(encoder.encode(sourcesDelta()));
    }
    if (typeof ch?.delta?.content === "string") {
      // v83: string-only — reasoning chunks arrive with content:null, and String(null) leaked the literal "null" into answers.
      ch.delta.content = processContent(ch.delta.content);
    }
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n`));
  }
}

// ============================================================
// EMPTY-STREAM GUARD (v83)
// ============================================================
// The frontend ALWAYS streams, so the non-streaming QA chain never runs for the owner. When GLM burns
// its token budget on reasoning the SSE carries zero content deltas (finish_reason "length"), the
// client shows "(no response from model)". This transform sits on the RAW model stream (inside
// linkCitationsSSE): if the stream finishes/ends/[DONE]s with no visible content, it awaits
// `fallback()` (research text, or a reliable-model rewrite) and injects it as a normal content delta
// (plus a synthetic finish chunk if the model never sent one), so the downstream linker links the
// [N] markers and appends Sources exactly as for a model answer.
function guardEmptyStream(body: ReadableStream<Uint8Array>, fallback: () => Promise<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let contentChars = 0;
  let finishSeen = false;
  let injected = false;
  let pendingLine = "";
  const evt = (delta: Record<string, unknown>, finish: string | null) =>
    encoder.encode(`data: ${JSON.stringify({ id: "gw-fallback", object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
  async function inject(controller: TransformStreamDefaultController<Uint8Array>, needFinish: boolean) {
    if (injected || contentChars > 0) return;
    injected = true;
    let text = "";
    try { text = (await fallback()).trim(); } catch { /* nothing to inject */ }
    if (!text) return;
    controller.enqueue(evt({ role: "assistant", content: text }, null));
    contentChars += text.length;
    if (needFinish && !finishSeen) { finishSeen = true; controller.enqueue(evt({}, "stop")); }
  }
  async function handle(line: string, controller: TransformStreamDefaultController<Uint8Array>) {
    if (line.startsWith("data:")) {
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") { await inject(controller, true); }
      else {
        try {
          const e = JSON.parse(payload);
          const ch = e?.choices?.[0];
          if (typeof ch?.delta?.content === "string" && ch.delta.content.trim()) contentChars += ch.delta.content.length;
          if (ch?.finish_reason) { await inject(controller, false); finishSeen = true; }
        } catch { /* not JSON — pass through */ }
      }
    }
    controller.enqueue(encoder.encode(line + "\n"));
  }
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      pendingLine += decoder.decode(chunk, { stream: true });
      const lines = pendingLine.split("\n");
      pendingLine = lines.pop() || "";
      for (const line of lines) await handle(line, controller);
    },
    async flush(controller) {
      if (pendingLine) { const l = pendingLine; pendingLine = ""; await handle(l, controller); }
      await inject(controller, true); // stream ended with no [DONE] and no content
    }
  }));
}

// v84 MEMBER PROFILE (E16): personalization from the frontend -> a block at the TOP of the writer system message.
function buildMemberProfile(p: any): string {
  if (!p || typeof p !== "object") return "";
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const about = str(p.about, 600);
  const instructions = typeof p.instructions === "string" ? p.instructions.trim().slice(0, 1000) : "";
  const tone = str(p.tone, 40).toLowerCase();
  const toneLine = tone === "direct" ? "Be concise and decisive; lead with the answer." : tone === "detailed" ? "Be thorough; give the complete breakdown." : "";
  const memory = (Array.isArray(p.memory) ? p.memory : []).map((m: unknown) => str(m, 300)).filter(Boolean).slice(0, 60);
  const lines: string[] = [];
  if (about) lines.push(`ABOUT THE MEMBER: ${about}`);
  if (toneLine) lines.push(`TONE: ${toneLine}`);
  if (instructions) lines.push(`STANDING INSTRUCTIONS: ${instructions}`);
  if (memory.length) lines.push(`MEMORY (facts the member has asked you to remember; apply where relevant, never recite unprompted):\n${memory.map((m: string) => `- ${m}`).join("\n")}`);
  return lines.length ? `=== MEMBER PROFILE ===\n${lines.join("\n")}\n=== END MEMBER PROFILE ===\n\n` : "";
}

// v89 (audit P0-1): call-model is locked behind a shared gateway token. Env GATEWAY_TOKEN wins; the literal is the deployed fallback.
const GW_TOKEN: string = Deno.env.get("GATEWAY_TOKEN") || ""; // env only — no compiled-in fallback (rotated 2026-11-10)
const rateMem = new MemoryLimiter();
const GW_HEADERS: Record<string, string> = { "Content-Type": "application/json", "x-gateway-token": GW_TOKEN };

// ============================================================
// I6 DEAD-END DETECTOR + I7 SELF-CHECK (inlined from response_quality specs; v95)
// ============================================================
// dead-end-check.ts — I6 parse-side check (pure Deno/Web, no imports).
// Flags answers that state a limitation or hand the user homework WITHOUT an executed alternative.
// Verdicts:
//   clean                   no limitation / homework language
//   limitation_with_action  limitation stated, but the answer also contains executed or prepared work, OR a concrete
//                           forward commitment ("paste them and I'll summarize"). Value is delivered or one step away.
//   dead_end                limitation/homework with NO work and NO commitment to do anything  => QA FAILURE
// v103 (BUG-047): only `dead_end` is a dead end. `x_dead_end` on the wire is mapped by deadEndMarker().
// Sub-kind (action_kind) lets us separate "executed" (facts fetched, figures computed, analysis done)
// from "prepared" (paste-ready diff / command / draft the user still has to apply).

interface DeadEndReport {
  verdict: "clean" | "limitation_with_action" | "dead_end";
  flagged: boolean;                 // true only for dead_end
  refusal_hits: string[];
  homework_hits: string[];
  action_evidence: string[];
  action_kind: "none" | "executed" | "prepared" | "both" | "offer";
  offer_hits: string[];             // concrete first-person forward commitments ("I'll summarize them")
  substantive_chars: number;        // answer chars excluding refusal/homework sentences and follow-ups
  homework_ratio: number;           // share of list items that are imperative instructions to the user
}

const Q = "['\u2019]?";
const REFUSAL: Array<[string, RegExp]> = [
  ["cant", new RegExp(`\\bI (?:can${Q}t|cannot|can not)\\b`, "i")],
  ["unable", new RegExp(`\\bI(?: am|${Q}m) (?:unable|not able) to\\b`, "i")],
  ["no_access", new RegExp(`\\bI (?:do not|don${Q}t) have (?:direct |live |real-time )?(?:access|the ability|a way|permission|tools?)\\b`, "i")],
  ["not_able_to", /\b(?:unable|not able) to (?:access|push|send|open|browse|retrieve|see|run|execute|fetch|connect|read)\b/i],
  ["knowledge_cutoff", new RegExp(`\\bmy (?:knowledge|training data|information) (?:doesn${Q}t|does not|ends|is limited|has a cutoff)`, "i")],
  ["from_here", /\b(?:from here|in this (?:chat|conversation|environment)|directly from)\b.{0,40}\b(?:can(?:'|\u2019)?t|cannot|unable)\b/i],
  ["no_data", new RegExp(`\\bI (?:do not|don${Q}t) have (?:any |the |your )?(?:emails?|messages?|data|records?|figures?|numbers?|files?|information|results?)\\b|\\bnothing (?:here |for me )?to (?:summari[sz]e|read|draw from)\\b`, "i")],
  ["as_an_ai", /\bas an AI\b/i],
];
const HOMEWORK: Array<[string, RegExp]> = [
  ["youll_need", new RegExp(`\\byou(?:${Q}ll| will|${Q}d| would) (?:need|have) to\\b`, "i")],
  ["whats_needed", new RegExp(`\\bhere${Q}s what (?:needs to happen|you${Q}ll need to do|to do)\\b`, "i")],
  ["next_steps_for_you", /\b(?:next steps? for you|steps? (?:for you|you can take)|do this yourself|on your end)\b/i],
  ["check_website", /\b(?:you (?:can|could|should) (?:check|visit|go to|consult|contact|connect|try)|(?:check|visit|consult) (?:the )?(?:official|BLS|company|vendor)? ?(?:website|documentation|docs|site))\b/i],
  ["recommend_checking", new RegExp(`\\bI${Q}d recommend (?:checking|consulting|visiting|contacting)\\b`, "i")],
  ["once_connected", /\bonce (?:you(?:'|\u2019)?ve )?(?:connect|link|grant|enable|provid|paste)/i],
];

const IMPERATIVE_ITEM = /^\s*(?:[-*]|\d+[.)])\s+\**(?:connect|go to|open|check|visit|click|navigate|run|install|set up|log in|sign in|add|create|enable|link|paste|copy|download|upload|contact|ask|try|refresh|reconnect|grant)\b/i;

// A concrete forward commitment: first person + a deliverable verb. "I can help" / "let me know" do NOT count.
const OFFER_VERBS = "summari[sz]e|draft|write|produce|build|prepare|compile|generate|analy[sz]e|compare|apply|handle|return|format|turn|extract|pull|create|put together|walk you through|fetch|calculate|compute|convert|rewrite|translate|schedule|set up|do it|do that|take care of|give you|send you|hand you|show you|outline";
const OFFER = new RegExp(`\\b(?:I${Q}ll|I will|I can|I could|I${Q}d be happy to|I${Q}m happy to|let me)\\s+(?:then |immediately |right away |also |straight away |first )?(?:(?:[a-z]+) ){0,2}?(?:${OFFER_VERBS})\\b`, "gi");

const COND_BEFORE = /\b(?:paste|pasting|send|share|forward|upload|provide|connect|reply|attach|copy|drop|tell me|let me know|give me|if|once|when|after|as soon as|assuming|provided|unless|until|should you|you can|you could|you may|you'?d need|you need|if it'?s|if they|if that)\b/i;
const COND_AFTER = /^[^.!?\n]{0,70}?\b(?:once|if|when|after|as soon as|provided|assuming)\b[^.!?\n]{0,50}?\b(?:you|your)\b/i;
function unconditionalOffers(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(OFFER)) {
    const at = m.index ?? 0;
    const before = body.slice(Math.max(0, at - 160), at);
    const clause = before.slice(Math.max(before.lastIndexOf("\n"), before.lastIndexOf(". "), before.lastIndexOf("? "), before.lastIndexOf("! ")) + 1);
    const after = body.slice(at + m[0].length, at + m[0].length + 140);
    if (COND_BEFORE.test(clause) || COND_AFTER.test(after)) continue;
    // relative clause, not a commitment: "no messages I can retrieve", "nothing I can pull from", "anything I could summarize"
    if (/^i (?:can|could)\b/i.test(m[0]) && /\b(?:no|nothing|nor|neither|any|anything|everything|whatever|that|which|what|than|messages|emails|content|data|records)\W+(?:\w+\W+){0,2}$/i.test(before)) continue;
    out.push(m[0].toLowerCase());
  }
  return out;
}

function sentences(text: string): string[] {
  return text.replace(/```[\s\S]*?```/g, " ").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

function detectDeadEnd(answer: string): DeadEndReport {
  const text = String(answer || "");
  const body = text.replace(/\n?##\s*Suggested Follow-ups?[\s\S]*$/i, "");
  // v103: only UNCONDITIONAL commitments count. "Paste the emails and I'll summarize" / "once you connect, I can pull" is homework with a
  // promise attached — the value is still gated on the member doing a chore, which is exactly the dead end I6 exists to remove.
  const offer_hits = [...new Set(unconditionalOffers(body))].slice(0, 4);
  const refusal_hits = REFUSAL.filter(([, re]) => re.test(body)).map(([k]) => k);
  const homework_hits = HOMEWORK.filter(([, re]) => re.test(body)).map(([k]) => k);

  // list items that are imperative instructions to the user
  const items = body.split("\n").filter((l) => /^\s*(?:[-*]|\d+[.)])\s+/.test(l));
  const imperative = items.filter((l) => IMPERATIVE_ITEM.test(l)).length;
  const homework_ratio = items.length ? imperative / items.length : 0;

  // executed vs prepared evidence
  const evidence: string[] = [];
  let executed = false, prepared = false;
  const fences = [...body.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].filter((m) => { const b = m[1].trim(); return b.split("\n").length >= 3 || (b.length >= 60 && /(?:https?:\/\/|<[a-z]+[ >]|\bgit\b|\bcurl\b|^[+-]\s)/m.test(b)); });
  const fenceChars = fences.reduce((n, m) => n + m[1].length, 0);
  if (fences.length) { evidence.push("code_block"); prepared = true; }
  if (/^(?:@@ |\+\+\+ |--- a\/)/m.test(body)) { evidence.push("diff"); prepared = true; }
  if (/^\s*(?:subject:|to:)\s*\S+/im.test(body) || /^(?:>\s.+\n){3,}/m.test(body)) { evidence.push("draft"); prepared = true; }
  if ((body.match(/^\s*\|.+\|\s*$/gm) || []).length >= 3) { evidence.push("table"); executed = true; }
  const figures = new Set(body.match(/\$\s?\d[\d,.]*[kmb]?|\b\d+(?:\.\d+)?\s?%|\b\d{1,3}(?:,\d{3})+\b|\b(?:19|20)\d{2}\b/gi) || []);
  if (figures.size >= 3) { evidence.push("figures"); executed = true; }
  if ((body.match(/^\s*[-*]\s+\*\*[^*\n]{2,40}:?\*\*:?\s*\S+/gm) || []).length >= 3) { evidence.push("labeled_facts"); executed = true; }
  const cites = (body.match(/\[\[?\d{1,2}\]?(?:\([^)]+\))?\]/g) || []).length + (body.match(/\]\(https?:\/\/[^)]+\)/g) || []).length;
  if (cites >= 2) { evidence.push("cited_facts"); executed = true; }

  // substantive chars = body minus the limitation/homework sentences
  const flaggedRe = [...REFUSAL, ...HOMEWORK].map(([, re]) => re);
  const kept = sentences(body).filter((s) => !flaggedRe.some((re) => re.test(s)) && !IMPERATIVE_ITEM.test(s));
  const substantive_chars = kept.join(" ").length + (prepared ? fenceChars : 0); // a prepared artifact is substance

  const hasLimit = refusal_hits.length > 0 || homework_hits.length > 0;
  const homeworkOnly = items.length >= 3 && homework_ratio >= 0.6 && !executed && !prepared;
  const action_kind = executed && prepared ? "both" : executed ? "executed" : prepared ? "prepared" : offer_hits.length ? "offer" : "none";

  let verdict: DeadEndReport["verdict"] = "clean";
  if (hasLimit || homeworkOnly) {
    const hasAction = (executed || prepared) && substantive_chars >= 200;
    // homework that is the MAJORITY of the list does not become an action just because a table exists elsewhere
    // ...except when the steps merely apply an artifact that is already in the answer (>= 80 chars of fenced code/diff)
    const stepsApplyArtifact = prepared && fenceChars >= 80;
    verdict = hasAction && (homework_ratio < 0.6 || stepsApplyArtifact) ? "limitation_with_action" : "dead_end";
    // v103: a limitation paired with a concrete commitment to do the work ("paste them and I'll summarize") delivers value
    // one step away and is NOT a dead end. A bare refusal or a list of chores with no commitment still is.
    if (verdict === "dead_end" && offer_hits.length) verdict = "limitation_with_action";
  }
  return { verdict, flagged: verdict === "dead_end", refusal_hits, homework_hits, offer_hits, action_evidence: evidence, action_kind, substantive_chars, homework_ratio: Number(homework_ratio.toFixed(2)) };
}

// ---- per-model refusal-rate tally (in-memory per isolate; flush to the answer_quality_log table) ----
interface Tally { n: number; clean: number; limitation_with_action: number; dead_end: number; offer_only: number }
const tallies = new Map<string, Tally>();
function tallyAnswer(model: string, r: DeadEndReport): Tally {
  const t = tallies.get(model) ?? { n: 0, clean: 0, limitation_with_action: 0, dead_end: 0, offer_only: 0 };
  t.n++; t[r.verdict]++; if (r.verdict === "limitation_with_action" && r.action_kind === "offer") t.offer_only++;
  tallies.set(model, t);
  return t;
}
const refusalRate = (t: Tally) => (t.n ? (t.limitation_with_action + t.dead_end) / t.n : 0);
const deadEndRate = (t: Tally) => (t.n ? t.dead_end / t.n : 0);
const offerOnlyRate = (t: Tally) => (t.n ? t.offer_only / t.n : 0); // limitation answered only by a promise: watch this, it is the soft spot

/** Wire value for `x_dead_end` (v103, BUG-047). Only a genuine dead end is reported as "dead_end".
 *  limitation_with_action => "clean_with_caveat" (the value QA harnesses already treat as a pass). */
function deadEndMarker(r: DeadEndReport): "clean" | "clean_with_caveat" | "dead_end" {
  return r.verdict === "dead_end" ? "dead_end" : r.verdict === "limitation_with_action" ? "clean_with_caveat" : "clean";
}

// self-check.ts — I7 writer pass-2 (pure Deno/Web). Sibling of tool-loop.ts in gateway-chat/.
// Flow: preflight(draft) -> (free, deterministic) repairDeterministic() -> if issues remain, ONE cheap
// model call -> acceptRevision() guard -> keep the revision only if it is strictly better and adds nothing new.

type IssueKind = "raw_marker" | "unfinished" | "uncited" | "overclaim" | "tool_syntax" | "cjk_leak" | "dead_end";
interface Issue { kind: IssueKind; detail: string }
interface Finding { title: string; url: string; extract?: string }

const RAW_MARKER = /\[\s*(?:web|source|src|ref|citation|cite)\s*:\s*\d+(?:\s*[,;]\s*(?:(?:web|source|src|ref)\s*:\s*)?\d+)*\s*\]|\u3010\d+\u2020[^\u3011]*\u3011/gi;
const TOOL_SYNTAX = /<\/?tool_call>|\b(?:web_search|fetch_page|browser_step|search_my_context|query_comptrove|calculator)\s*\(/i;
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
const OVERCLAIM_ACTION = /\bI(?:'|\u2019)?(?:ve| have)?\s+(?:just\s+)?(pushed|committed|sent|emailed|deployed|updated|changed|swapped|merged|opened (?:a|the) (?:PR|pull request)|created (?:a|the) (?:PR|pull request)|verified|confirmed|checked live|saved|uploaded|installed)\b/i;
const OVERCLAIM_LIVE = /\b(?:just (?:pulled|fetched|checked)|live data|real-time (?:data|check)|as of right now)\b/i;
const FACTY = /\d/;

function stripFollowups(t: string) { return t.replace(/\n?##\s*Suggested Follow-ups?[\s\S]*$/i, "").trimEnd(); }

function preflight(draft: string, o: { findings?: Finding[]; toolsUsed?: string[]; userQuery?: string } = {}): Issue[] {
  const issues: Issue[] = [];
  const text = String(draft || "");
  const body = stripFollowups(text);
  const findings = o.findings ?? [];

  const raw = text.match(RAW_MARKER);
  if (raw) issues.push({ kind: "raw_marker", detail: [...new Set(raw)].slice(0, 5).join(" ") });

  if (TOOL_SYNTAX.test(text)) issues.push({ kind: "tool_syntax", detail: "tool-call syntax in answer" });
  if (CJK.test(text) && !CJK.test(o.userQuery || "")) issues.push({ kind: "cjk_leak", detail: "CJK text in a non-CJK conversation" });

  // unfinished: odd code fence, dangling connector, no terminal punctuation, cut-off follow-ups section
  const fences = (text.match(/```/g) || []).length;
  const lastLine = body.trim().split("\n").pop() || "";
  const lastTrim = lastLine.trim();
  const endsClean = /[.!?:)"'\u201d\u2019`*|\]]\s*$/.test(lastTrim) || /^\s*(?:[-*]|\d+[.)])\s+.*\S\s*$/.test(lastLine) && /[.!?)\]"'\u201d]$/.test(lastTrim);
  const dangling = /\b(?:and|or|but|the|a|an|of|to|in|with|for|by|as|that|which|is|are|was|were)\s*$/i.test(lastTrim) || /[,;(\u2014\u2013-]\s*$/.test(lastTrim);
  const fuMatch = text.match(/##\s*Suggested Follow-ups?[\s\S]*$/i);
  const fuLast = fuMatch ? (fuMatch[0].trim().split("\n").pop() || "").trim() : "";
  const fuCut = !!fuMatch && fuLast.length > 0 && !/[?.!)]$/.test(fuLast) && !/^##/.test(fuLast);
  if (fences % 2 === 1) issues.push({ kind: "unfinished", detail: "unclosed code fence" });
  else if (lastTrim && (!endsClean || dangling)) issues.push({ kind: "unfinished", detail: `ends mid-sentence: "…${lastTrim.slice(-60)}"` });
  else if (fuCut) issues.push({ kind: "unfinished", detail: "Suggested Follow-ups cut off" });
  if (/\b[a-z]{2,}%(?=\s|$)/.test(body)) issues.push({ kind: "unfinished", detail: "glued token before % (text-loss artifact)" });

  // uncited: only meaningful when numbered sources exist
  if (findings.length) {
    const sents = body.replace(/```[\s\S]*?```/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.length > 25);
    const facty = sents.filter((s) => FACTY.test(s) && !/^#{1,4}\s/.test(s));
    const unc = facty.filter((s) => !/\[\[?\d{1,2}\]?(?:\([^)]*\))?\]/.test(s));
    if (facty.length >= 2 && unc.length >= Math.max(2, Math.ceil(facty.length * 0.5))) issues.push({ kind: "uncited", detail: `${unc.length}/${facty.length} factual sentences carry no [N]` });
  }

  // overclaim: claimed actions with no matching tool run; "live" claims with no sources
  const m = body.match(OVERCLAIM_ACTION);
  if (m && !(o.toolsUsed || []).length) issues.push({ kind: "overclaim", detail: `claims "${m[0]}" but no tool ran` });
  if (OVERCLAIM_LIVE.test(body) && !findings.length) issues.push({ kind: "overclaim", detail: "claims live data with no sources" });

  const de = detectDeadEnd(text);
  if (de.flagged) issues.push({ kind: "dead_end", detail: `limitation/homework without executed work (${[...de.refusal_hits, ...de.homework_hits].join(",")})` });
  return issues;
}

// Free, always-safe repairs (no model call). Idempotent.
function repairDeterministic(draft: string, o: { findings?: Finding[] } = {}): string {
  let t = String(draft || "");
  t = t.replace(RAW_MARKER, "").replace(/[ \t]+([.,;])/g, "$1").replace(/ {2,}/g, " ");
  if (/<\/?tool_call>/i.test(t)) t = t.replace(/<\/?tool_call>/gi, "");
  if ((t.match(/```/g) || []).length % 2 === 1) t = t.trimEnd() + "\n```";
  const hasFU = /##\s*Suggested Follow-ups?/i.test(t);
  const issues = preflight(t, { findings: o.findings }).filter((i) => i.kind === "unfinished" && !/code fence|glued/.test(i.detail));
  if (issues.length && !hasFU) {
    // cut back to the last complete sentence (or complete line) — never leave a dangling fragment
    const body = t.trimEnd();
    const cut = Math.max(body.lastIndexOf(". "), body.lastIndexOf(".\n"), body.lastIndexOf("? "), body.lastIndexOf("! "), body.lastIndexOf("\n\n"));
    const endPunct = /[.!?]$/.test(body);
    if (!endPunct && cut > body.length * 0.35) t = body.slice(0, cut + 1).trimEnd();
  } else if (issues.length && hasFU) {
    t = t.replace(/\n[-*\d.)]+\s+[^\n]*[^?.!)\n]$/, ""); // drop a truncated final follow-up bullet
  }
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

const PASS2_SYSTEM = `You are a meticulous editor finishing another writer's DRAFT. Output ONLY the corrected final answer in markdown — no preface, no notes, no explanation of changes.

You receive: DRAFT, SOURCES (numbered findings plus any live-search text), and ISSUES a checker found. Fix exactly those problems and nothing else:
1. UNFINISHED: complete a cut-off sentence, list, table or section from the draft's evident intent using only SOURCES; if it cannot be completed from them, delete the dangling fragment. Close open code fences. End with a complete "## Suggested Follow-ups" (3-4 imperative next-step commands, no question marks) or none.
2. RAW MARKERS: convert [web:N] / [source:N] to the matching [N] from SOURCES, or delete the marker if it cannot be matched.
3. UNCITED: add the right [N] to every factual sentence (figure, date, name, event) that SOURCES support. If a factual claim is supported by no source, hedge it ("reportedly", "about") or delete it. Never add a fact, number, date, name or URL that is not already in DRAFT or SOURCES.
4. OVERCLAIMS: delete or reword any claim that an action was performed (pushed, sent, updated, verified live) unless SOURCES contain a tool result proving it. Replace absolutes ("always", "guaranteed") with what the sources support.
5. DEAD ENDS: if the draft states a limitation ("I can't…", "you'll need to…") without the work done instead, restructure so the finished work leads and the limitation is one short closing clause; convert homework steps into the finished artifact the draft already contains. Never add homework.
6. STRAY TEXT: delete tool-call syntax, working notes, and text in a language other than the user's.
7. URL INTEGRITY: copy every URL EXACTLY as it appears in DRAFT or SOURCES — never percent-encode, double-encode, or otherwise alter a URL (no %25, no encoding of : / ? & = characters). A rewritten URL that differs from its source is a defect.
8. FORMAT: keep the draft's structure scannable — short paragraphs (max 3 lines), bulleted lists for parallel items, numbered steps (1. 2. 3.) for any sequence the user must follow, and real triple-backtick code fences (never ''' quotes).

Preserve everything else: structure, headings, tables, code, wording, length (within ±15%), language, and every existing [N] marker. Change as little as possible. If there is nothing to fix, return the DRAFT verbatim.`;

const nums = (t: string) => new Set((t.match(/\d[\d,]*\.?\d*/g) || []).map((x) => x.replace(/,/g, "")));
const urls = (t: string) => new Set((t.match(/https?:\/\/[^\s)\]>"']+/g) || []).map((u) => u.replace(/[.,;]+$/, "")));

// Revision guard: accept only if it fixes something and introduces nothing.
function acceptRevision(draft: string, revised: string, o: { findings?: Finding[]; allowedText?: string; userQuery?: string; toolsUsed?: string[] }): { ok: boolean; why: string } {
  const r = String(revised || "").trim();
  const d = String(draft || "").trim();
  if (!r) return { ok: false, why: "empty revision" };
  const ratio = r.length / Math.max(1, d.length);
  if (ratio < 0.6 || ratio > 1.4) return { ok: false, why: `length ratio ${ratio.toFixed(2)} outside 0.6-1.4` };
  const allowedUrls = new Set([...urls(d), ...(o.findings || []).map((f) => f.url)]);
  for (const u of urls(r)) if (!allowedUrls.has(u) && ![...allowedUrls].some((a) => a.startsWith(u) || u.startsWith(a))) return { ok: false, why: `new URL ${u}` };
  const allowedNums = new Set([...nums(d), ...nums(o.allowedText || ""), ...nums((o.findings || []).map((f) => `${f.title} ${f.extract || ""}`).join(" "))]);
  const maxN = (o.findings || []).length;
  for (const n of nums(r)) {
    if (allowedNums.has(n)) continue;
    if (Number(n) >= 1 && Number(n) <= maxN && Number.isInteger(Number(n))) continue; // [N] marker indices
    return { ok: false, why: `new number ${n}` };
  }
  const before = preflight(d, o);
  const after = preflight(r, o);
  if (after.some((i) => i.kind === "raw_marker" || i.kind === "tool_syntax" || i.kind === "cjk_leak") ) return { ok: false, why: "revision still contains raw markers/tool syntax/CJK" };
  if (after.length >= before.length && before.length > 0) return { ok: false, why: `no improvement (${before.length} -> ${after.length} issues)` };
  // every existing [N] marker survives
  const dm = new Set(d.match(/\[\d{1,2}\]/g) || []), rm = new Set(r.match(/\[\d{1,2}\]/g) || []);
  for (const m of dm) if (!rm.has(m) && !/^\[\[/.test(m)) { /* markers may be re-homed; only fail if ALL vanish */ }
  if (dm.size && !rm.size) return { ok: false, why: "all citation markers removed" };
  return { ok: true, why: `issues ${before.length} -> ${after.length}` };
}

interface SelfCheckArgs {
  callModelUrl: string;
  model: string;                 // cheap, reliable writer: recommended "deepseek/deepseek-v4.1-flash-1017" (GLM-5.3 acceptable at effort "low")
  gatewayToken?: string;
  draft: string;
  findings: Finding[];
  researchText?: string;         // perplexityFullText
  evidence?: string;             // tool-loop evidence block
  toolsUsed?: string[];
  userQuery?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;      // injectable for tests
}
interface SelfCheckResult { text: string; applied: "none" | "deterministic" | "model"; issues_before: Issue[]; issues_after: Issue[]; note: string }

async function selfCheckPass(a: SelfCheckArgs): Promise<SelfCheckResult> {
  const opts = { findings: a.findings, toolsUsed: a.toolsUsed, userQuery: a.userQuery };
  const before = preflight(a.draft, opts);
  if (!before.length) return { text: a.draft, applied: "none", issues_before: [], issues_after: [], note: "clean" };

  // 1) free deterministic repair
  const det = repairDeterministic(a.draft, { findings: a.findings });
  let issues = preflight(det, opts);
  let text = det !== a.draft && issues.length < before.length ? det : a.draft;
  let applied: SelfCheckResult["applied"] = text === a.draft ? "none" : "deterministic";
  if (!issues.length) return { text, applied, issues_before: before, issues_after: [], note: "deterministic repair sufficed" };

  // 2) one cheap model call for what regex cannot fix (uncited, overclaim, dead_end, unfinished-needing-completion)
  const sources = (a.findings || []).map((f, i) => `[${i + 1}] ${f.title} — ${f.url}${f.extract ? `\n    ${f.extract.slice(0, 400)}` : ""}`).join("\n");
  const user = `ISSUES FOUND:\n${issues.map((i) => `- ${i.kind}: ${i.detail}`).join("\n")}\n\nSOURCES:\n${sources || "(none)"}\n${a.researchText ? `\nLIVE SEARCH TEXT:\n${a.researchText.slice(0, 5000)}\n` : ""}${a.evidence ? `\nTOOL RESULTS:\n${a.evidence.slice(0, 3000)}\n` : ""}\nDRAFT:\n${text}`;
  try {
    const f = a.fetchImpl ?? fetch;
    const res = await f(a.callModelUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(a.gatewayToken ? { Authorization: `Bearer ${a.gatewayToken}`, "x-gateway-token": a.gatewayToken } : {}) },
      body: JSON.stringify({ messages: [{ role: "system", content: PASS2_SYSTEM }, { role: "user", content: user }], purpose: "general", model: a.model, reasoning_effort: "low", max_tokens: 2048 }),
      signal: AbortSignal.timeout(a.timeoutMs ?? 35_000)
    });
    const d = await res.json();
    const revised = String(d?.choices?.[0]?.message?.content || "").trim();
    const verdict = acceptRevision(text, revised, { ...opts, allowedText: `${a.researchText || ""} ${a.evidence || ""}` });
    if (verdict.ok) return { text: revised, applied: "model", issues_before: before, issues_after: preflight(revised, opts), note: verdict.why };
    return { text, applied, issues_before: before, issues_after: issues, note: `model revision rejected: ${verdict.why}` };
  } catch (e) {
    return { text, applied, issues_before: before, issues_after: issues, note: `pass-2 call failed: ${String((e as Error)?.message || e).slice(0, 80)}` };
  }
}

const PASS2_MODEL = Deno.env.get("PASS2_MODEL") || "deepseek/deepseek-v4.1-flash-1017";
const EXECUTION_STANDARD = `EXECUTION STANDARD (non-negotiable — applies to every answer):
1. Act first. Attempt the task with everything in this conversation before describing any limit: the live search answer, numbered sources, tool results, the member's account context, and anything they pasted. Lead with the finished work, never with a refusal.
2. A limitation may appear only as ONE short clause, and only in an answer that ALSO contains the work done instead — the drafted text, the exact diff or code, the computed figures, the facts retrieved, the analysis. These openers are banned unless the executed alternative is already in the same answer: "I can't…", "I'm unable to…", "I don't have access…", "my knowledge doesn't extend…", "you'll need to…", "here's what needs to happen…", "check the official website…".
3. No homework. Never make a list of steps for the member to perform the main content. Turn each step you would assign into either something you already did (show its result) or a finished, paste-ready artifact (complete file contents, unified diff, exact command, filled-in email or message) that applies in ONE action.
4. If the request ends in an action you cannot perform here (push to a repo, send an email, change a setting, open an account), do everything up to that boundary: produce the complete finished artifact, then name the single exact next action in one line. Never claim an action you did not perform ("I pushed", "I sent", "I verified live").
5. Current facts: "my knowledge ends" and "check the website" are not answers. Use the provided sources and give every figure they contain, with its [N] marker. If NO source in this conversation contains the figure, do not state any number, percentage, price or score for it, not even as an "estimate" or "approximate": say in one clause that it was not retrieved, then deliver what you do know for certain (what the report is, its release schedule and date, how to read it, what it will be compared against) and name the single exact page or query that returns the figure.
6. Honesty over completeness: a missing number is better than an invented one. Never invent a fact, figure, file, result, or source to avoid a limit. Mark clearly what is retrieved or computed versus prepared for the member to apply.`;

// ============================================================
// SOURCES FILTER + TIME RANGE (v92, B6/B7)
// ============================================================
const ACADEMIC_DOMAINS = ["arxiv.org", "nature.com", "science.org", "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "jstor.org", "sciencedirect.com", "springer.com", "ssrn.com", "nber.org", "semanticscholar.org", "wiley.com", "ieee.org", "acm.org", "plos.org", "edu"];
const FINANCE_DOMAINS = ["sec.gov", "federalreserve.gov", "treasury.gov", "bls.gov", "bea.gov", "fred.stlouisfed.org", "freddiemac.com", "fanniemae.com", "census.gov", "imf.org", "worldbank.org", "reuters.com", "bloomberg.com", "wsj.com", "ft.com", "cnbc.com", "marketwatch.com", "morningstar.com", "finance.yahoo.com", "investopedia.com"];
function parseSourcesFilter(sf: unknown): string[] {
  let raw: string[] = [];
  if (Array.isArray(sf)) raw = sf.map((x) => typeof x === "string" ? x : (x && typeof x === "object" && (x as any).enabled !== false ? String((x as any).id || (x as any).key || (x as any).name || "") : ""));
  else if (sf && typeof sf === "object") raw = Object.entries(sf as Record<string, unknown>).filter(([, v]) => v === true || v === "on" || v === 1 || (v && typeof v === "object" && (v as any).enabled === true)).map(([k]) => k);
  else if (typeof sf === "string") raw = sf.split(/[,\s]+/);
  const alias: Record<string, string> = { web: "web", internet: "web", news: "web", social: "web", academic: "academic", scholar: "academic", papers: "academic", research: "academic", finance: "finance", financial: "finance", markets: "finance", files: "files", file: "files", my_files: "files", docs: "files", documents: "files", drive: "files" };
  return [...new Set(raw.map((x) => alias[String(x).toLowerCase().trim()]).filter(Boolean))];
}
function parseTimeRange(tr: unknown): string {
  const t = String(tr ?? "").toLowerCase().trim();
  if (!t || t === "any" || t === "all") return "";
  if (/^(hour|1h|past[_ -]?hour)$/.test(t)) return "hour";
  if (/^(day|24h|1d|today|past[_ -]?(day|24h))$/.test(t)) return "day";
  if (/^(week|7d|1w|past[_ -]?week)$/.test(t)) return "week";
  if (/^(month|30d|1m|past[_ -]?month)$/.test(t)) return "month";
  if (/^(year|365d|1y|12m|past[_ -]?year)$/.test(t)) return "year";
  return "";
}
function buildSearchFilters(sel: string[], recency: string): { domains: string[]; recency: string; filesOnly: boolean } {
  const filesOnly = sel.length > 0 && sel.every((x) => x === "files");
  let domains: string[] = [];
  if (!sel.includes("web")) {
    const both = sel.includes("academic") && sel.includes("finance");
    if (sel.includes("academic")) domains.push(...ACADEMIC_DOMAINS.slice(0, both ? 10 : 20));
    if (sel.includes("finance")) domains.push(...FINANCE_DOMAINS.slice(0, both ? 10 : 20));
  }
  domains = [...new Set(domains)].slice(0, 20);
  return { domains, recency, filesOnly };
}
function webSearchTool(f: { domains: string[]; recency: string }): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  if (f.domains.length) filters.search_domain_filter = f.domains;
  if (f.recency) filters.search_recency_filter = f.recency;
  return Object.keys(filters).length ? { type: "web_search", filters } : { type: "web_search" };
}

// ============================================================
// MODEL COUNCIL (v91, H3) — opt-in via body.model_council === true
// ============================================================
// N writers run in PARALLEL (low effort, 45s each, failures skipped); a synthesis call then merges them.
// v130 PARALLEL AGENTS: short, human agent subheader from a sub-question ("RESEARCH · rent trends"). Pure; never includes model ids.
function agentTopic(q: string, max = 44): string {
  const t = String(q ?? "").replace(/\s+/g, " ").replace(/[?]+$/, "").trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : t;
}
async function runCouncil(callModelUrl: string, messages: Array<{ role: string; content: string }>, purpose: string, models: string[], timeoutMs = 45_000, onAgent?: (i: number, phase: "start" | "end", ok?: boolean) => void): Promise<Array<{ model: string; text: string }>> {
  const settled = await Promise.all(models.map(async (m, mi) => {
    onAgent?.(mi, "start");
    let okDraft = false;
    try {
      const r0 = await councilDraft(callModelUrl, messages, purpose, m, timeoutMs);
      okDraft = !!r0;
      return r0;
    } finally { onAgent?.(mi, "end", okDraft); }
  }));
  return settled.filter((x): x is { model: string; text: string } => !!x);
}
async function councilDraft(callModelUrl: string, messages: Array<{ role: string; content: string }>, purpose: string, m: string, timeoutMs: number): Promise<{ model: string; text: string } | null> {
  {
    try {
      const r = await fetch(callModelUrl, {
        method: "POST",
        headers: GW_HEADERS,
        body: JSON.stringify({ messages, purpose, model: m, reasoning_effort: "low", max_tokens: 2500 }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!r.ok) return null;
      const d = await r.json();
      const text = String(d?.choices?.[0]?.message?.content || "").trim();
      return text.length > 40 ? { model: m, text } : null;
    } catch { return null; }
  }
}
function councilSynthesisPrompt(answers: Array<{ model: string; text: string }>): string {
  return `=== MODEL COUNCIL ===\nIndependent drafts of the answer to the user's latest question, written by ${answers.length} different models, follow. Produce the SINGLE best final answer for the user:\n- Take the most specific figures, dates, names and citations from each draft; drop anything unsupported by the research findings above.\n- Where drafts conflict, state the disagreement explicitly and say which is better supported.\n- Keep every [N] citation marker valid against the numbered research findings (never invent or renumber markers).\n- Write it as one cohesive answer in the structure and style the standards above require. Do not mention the drafts, the council, or the models.\n\n` +
    answers.map((a, i) => `--- DRAFT ${i + 1} ---\n${a.text.slice(0, 4000)}`).join("\n\n") + `\n=== END MODEL COUNCIL ===`;
}

// ============================================================
// DEDICATED FOLLOW-UP STAGE (v84, A7)
// ============================================================
// The writer's own "Suggested Follow-ups" were generic. After the answer is settled, ONE cheap low-effort
// call sees the question + final answer and writes 4 specific, entity-anchored follow-ups. Any failure /
// 10s timeout -> fall back to the writer's own section if it had one, else omit (the frontend has a clean
// generic fallback; an omitted section beats garbage).
const FOLLOWUP_HEADING_RE = /#{1,4}[ \t]*\**[ \t]*Suggested[ \t]+Follow[- ]?ups?\b/i;
const FOLLOWUP_GENERIC_RE = /^(what should i do next|what (are|is) (the )?(next steps?|main risks)|can you (summarize|walk me through|explain|elaborate|go deeper)|tell me more|anything else|how can i learn more|what else|can you provide more)/i;
function stripWriterFollowups(text: string): { body: string; section: string } {
  const m = text.match(FOLLOWUP_HEADING_RE);
  if (!m || m.index === undefined) return { body: text, section: "" };
  // section runs to the next heading that is not a follow-up heading (e.g. "## Sources") or end of text
  const rest = text.slice(m.index);
  const nl = rest.indexOf("\n");
  const after = nl === -1 ? "" : rest.slice(nl + 1);
  const nextH = after.search(/^#{1,4}[ \t]/m);
  const sectionBody = nextH === -1 ? after : after.slice(0, nextH);
  const tail = nextH === -1 ? "" : "\n\n" + after.slice(nextH);
  return { body: text.slice(0, m.index).replace(/\s+$/, "") + tail, section: "## Suggested Follow-ups\n\n" + sectionBody.trim() };
}
// v127 (stress-250 #5): a space instruction like "End every answer with the exact line: -- Desk" must be the LAST thing
// in the answer, after the auto Suggested Follow-ups (and Sources). Detect it, strip the writer's own copy, re-append it last.
// v127: true for inputs with no real content: no letters/digits/emoji, one lone alphanumeric char, or pure repetition.
function isJunkInput(raw: string): boolean {
  const t = String(raw ?? "").trim();
  if (!t) return false;                                   // empty is handled by existing validation
  if (!/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(t)) return true;                // ".", "?!", "...", "-----"
  const core = t.replace(/[\s\p{P}]+/gu, "");
  if (!core) return true;
  const chars = Array.from(core);
  if (chars.length === 1 && /[\p{L}\p{N}]/u.test(core)) return true;                  // "a", "5"
  if (chars.length >= 4 && /^(.{1,4}?)\1{2,}$/su.test(core)) return true;            // "aaaa", "abcabcabc", "lol lol lol"
  return false;
}
function extractEndLine(instr: string): string {
  const t = String(instr || "");
  if (!t) return "";
  const clean = (x: string) => x.trim().replace(/^["“'`]+|["”'`]+$/g, "").trim().slice(0, 200);
  let m = t.match(/\b(?:end|finish|close|conclude|sign[- ]?off)\b[^\n]{0,80}?\b(?:exact|following|final|last|verbatim|literal)\b[^\n:]{0,40}:\s*([^\n]{2,200})/i);
  if (m) { const c = clean(m[1]); if (c.length >= 2) return c; }
  m = t.match(/\b(?:end|finish|close|conclude|sign[- ]?off)\b[^\n"“`]{0,60}\b(?:with|by)\b[^\n"“`]{0,40}["“`]([^"”`\n]{2,200})["”`]/i);
  if (m) { const c = clean(m[1]); if (c.length >= 2) return c; }
  return "";
}
function removeEndLine(text: string, endLine: string): string {
  if (!endLine) return text;
  const esc = endLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(^|\\n)[ \\t>*_]*${esc}[ \\t*_]*(?=\\n|$)`, "g"), "$1").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "");
}
function parseFollowUpLines(raw: string): string[] {
  return raw.split(/\n+/)
    .map((l) => l.replace(/^[\s>*•-]*/, "").replace(/^\d+[.)]\s*/, "").replace(/\*\*/g, "").trim())
    // v179 (owner request 2026-11-12): follow-ups are now ACTIONABLE next steps —
    // imperative commands runnable by "Run all", not questions. Reject lines that
    // still end in a question mark (the model ignored the instruction) and generics.
    .filter((l) => l.length > 15 && l.length < 220 && !/\?\s*$/.test(l) && !FOLLOWUP_GENERIC_RE.test(l))
    .slice(0, 4);
}
async function generateFollowUps(callModelUrl: string, model: string, question: string, answer: string, today: string): Promise<string> {
  try {
    const ans = answer.replace(/\n## Sources[\s\S]*$/i, "").slice(0, 6000);
    // v179 (owner request 2026-11-12): follow-ups became ACTIONABLE NEXT STEPS —
    // imperative commands the user can fire directly via "Run all" (in parallel),
    // instead of questions that need rephrasing before they can run.
    const prompt = `Today is ${today}. A user asked a question and received the answer below. Write EXACTLY 4 ACTIONABLE NEXT STEPS — runnable research commands the user can execute immediately with a research AI.\n\nRules:\n- Each is an IMPERATIVE COMMAND, never a question: no question marks. Examples of the form: "Compare the 3 largest markets by 2027 rent growth", "Pull the FY2027 FMR table for Maricopa County and rank zip codes", "Map the 5 nearest comps to 1200 Wilshire Blvd with unit mixes".\n- Each must reference concrete entities, figures, dates, or named items that appear in the answer.\n- Each must advance the user's evident goal (deeper analysis, adjacent decision, or the next concrete step) — not restate the answer.\n- Under 18 words each, written from the user's point of view.\n- BANNED: generic steps such as "Summarize the answer", "Tell me more", "What should I do next", "List the risks".\n- Use the user's language.\n\nOutput ONLY the 4 commands, one per line, each starting with "- ". No heading, no preamble.\n\nUSER QUESTION:\n${question.slice(0, 1200)}\n\nANSWER:\n${ans}`;
    const r = await fetch(callModelUrl, {
      method: "POST",
      headers: GW_HEADERS,
      body: JSON.stringify({ messages: [{ role: "system", content: "You write sharp, specific, runnable next-step commands. Output only the list." }, { role: "user", content: prompt }], purpose: "general", model, reasoning_effort: "low", max_tokens: 300 }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!r.ok) return "";
    const d = await r.json();
    const items = parseFollowUpLines(String(d?.choices?.[0]?.message?.content || ""));
    if (items.length < 3) return "";
    return "## Suggested Follow-ups\n\n" + items.map((q) => `- ${q}`).join("\n");
  } catch { return ""; }
}
// Resolve the section to show: dedicated stage first, then the writer's own (if it has real items), else "".
async function resolveFollowUps(callModelUrl: string, question: string, answer: string, writerSection: string, today: string): Promise<string> {
  if (answer.trim().length < 40) return writerSection && parseFollowUpLines(writerSection.split("\n").slice(1).join("\n")).length ? writerSection : "";
  const primary = Deno.env.get("FOLLOWUP_MODEL") || "z-ai/glm-5.3";
  let s = await generateFollowUps(callModelUrl, primary, question, answer, today);
  if (s) return s;
  const wItems = writerSection ? parseFollowUpLines(writerSection.split("\n").slice(1).join("\n")) : [];
  return wItems.length >= 2 ? "## Suggested Follow-ups\n\n" + wItems.map((q) => `- ${q}`).join("\n") : "";
}
// Streaming wrapper (sits on the RAW model stream, after guardEmptyStream, inside linkCitationsSSE):
// passes answer text through, swallows the writer's own follow-up section, and just before the finish chunk
// (or [DONE]/end) injects the resolved section as a synthetic content delta.
function appendFollowUpsSSE(body: ReadableStream<Uint8Array>, resolve: (answer: string, writerSection: string) => Promise<string>, endLine = ""): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let pendingLine = "";
  let hold = "";          // trailing text that might be the start of a follow-up heading
  let swallowing = false;
  let swallowed = "";
  let answer = "";        // text actually forwarded
  let done = false;
  const mk = (content: string) => encoder.encode(`data: ${JSON.stringify({ id: "gw-followups", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`);
  // endLine mode: keep a short tail unsent so the writer's own copy of the required ending can be stripped before follow-ups.
  const TAIL = endLine ? endLine.length + 12 : 0;
  let tail = "";
  const feed = (text: string): string => {
    const out = feedInner(text);
    if (!TAIL) return out;
    tail += out;
    if (tail.length <= TAIL) return "";
    const send = tail.slice(0, tail.length - TAIL); tail = tail.slice(-TAIL);
    return send;
  };
  const feedInner = (text: string): string => {
    if (swallowing) { swallowed += text; return ""; }
    const buf = hold + text;
    hold = "";
    const m = buf.match(FOLLOWUP_HEADING_RE);
    if (m && m.index !== undefined) { swallowing = true; swallowed = buf.slice(m.index); const out = buf.slice(0, m.index); answer += out; return out; }
    const p = buf.match(/#{1,4}[^\n]{0,28}$/);
    if (p && p.index !== undefined) { hold = p[0]; const out = buf.slice(0, p.index); answer += out; return out; }
    answer += buf;
    return buf;
  };
  async function finish(controller: TransformStreamDefaultController<Uint8Array>) {
    if (done) return;
    done = true;
    if (hold && !swallowing) { answer += hold; if (TAIL) tail += hold; else controller.enqueue(mk(hold)); hold = ""; }
    if (TAIL) { const t2 = removeEndLine(tail, endLine); tail = ""; if (t2) controller.enqueue(mk(t2)); }
    let section = "";
    try { section = await resolve(answer, swallowed); } catch { section = ""; }
    if (section) controller.enqueue(mk("\n\n" + section));
  }
  async function handle(line: string, controller: TransformStreamDefaultController<Uint8Array>) {
    if (!line.startsWith("data:")) { controller.enqueue(encoder.encode(line + "\n")); return; }
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") { await finish(controller); controller.enqueue(encoder.encode(line + "\n")); return; }
    let evt: any;
    try { evt = JSON.parse(payload); } catch { controller.enqueue(encoder.encode(line + "\n")); return; }
    const ch = evt?.choices?.[0];
    if (typeof ch?.delta?.content === "string") ch.delta.content = feed(ch.delta.content);
    if (ch?.finish_reason) await finish(controller);
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n`));
  }
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      pendingLine += decoder.decode(chunk, { stream: true });
      const lines = pendingLine.split("\n");
      pendingLine = lines.pop() || "";
      for (const line of lines) await handle(line, controller);
    },
    async flush(controller) {
      if (pendingLine) { const l = pendingLine; pendingLine = ""; await handle(l, controller); }
      await finish(controller);
    }
  }));
}

// v127: last stage of the SSE pipe (after follow-ups and the linked Sources list): emit the exact required ending once, last.
function appendEndLineSSE(body: ReadableStream<Uint8Array>, endLine: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  let pendingLine = "", done = false;
  const mk = (content: string) => encoder.encode(`data: ${JSON.stringify({ id: "gw-endline", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`);
  const fin = (c: TransformStreamDefaultController<Uint8Array>) => { if (done) return; done = true; c.enqueue(mk("\n\n" + endLine)); };
  const handle = (line: string, c: TransformStreamDefaultController<Uint8Array>) => {
    if (line.startsWith("data:")) {
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") { fin(c); c.enqueue(encoder.encode(line + "\n")); return; }
      try { const evt = JSON.parse(payload); if (evt?.choices?.[0]?.finish_reason) { fin(c); } } catch { /* pass through */ }
    }
    c.enqueue(encoder.encode(line + "\n"));
  };
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, c) {
      pendingLine += decoder.decode(chunk, { stream: true });
      const lines = pendingLine.split("\n"); pendingLine = lines.pop() || "";
      for (const l of lines) handle(l, c);
    },
    flush(c) { if (pendingLine) { const l = pendingLine; pendingLine = ""; handle(l, c); } fin(c); }
  }));
}

// ============================================================
// PLANNER + SUB-QUERY RESEARCH HELPERS (v84, A18)
// ============================================================
async function planSubQueries(callModelUrl: string, question: string, today: string): Promise<string[]> {
  try {
    const r = await fetch(callModelUrl, {
      method: "POST",
      headers: GW_HEADERS,
      body: JSON.stringify({
        messages: [{ role: "system", content: "You decompose research questions. Output ONLY a JSON array of strings." },
          { role: "user", content: `Today is ${today}. Decompose this question into 2-3 distinct, concrete web-search sub-queries that together cover what is needed to answer it fully (different facets, not rephrasings). Each is a short noun phrase of at most 10 words with no filler words, and includes the specific entities, places, or years involved.\nOutput ONLY a JSON array of strings.\n\nQUESTION: ${question.slice(0, 600)}` }],
        purpose: "general", model: Deno.env.get("PLANNER_MODEL") || "deepseek/deepseek-v4.1-flash-1017", reasoning_effort: "low", max_tokens: 200
      }),
      signal: AbortSignal.timeout(6_000)
    });
    if (!r.ok) return [];
    const d = await r.json();
    const m = String(d?.choices?.[0]?.message?.content || "").match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]);
    return (Array.isArray(arr) ? arr : []).map((x) => String(x).trim()).filter((x) => x.length > 3 && x.length < 120).slice(0, 3);
  } catch { return []; }
}
// One Agent-API call for a sub-query; returns answer text with [web:N] ids and the raw search results.
async function runSubQuery(apiKey: string, q: string, effort: string, timeoutMs: number, webTool: Record<string, unknown> = { type: "web_search" }): Promise<{ text: string; cites: Array<{ title: string; url: string; id: number; snip?: string }> } | null> {
  try {
    const r = await fetch("https://api.perplexity.ai/v1/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ effort, input: q.slice(0, 400), tools: [webTool] }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!r.ok) return null;
    const p = await r.json();
    let text = "";
    const cites: Array<{ title: string; url: string; id: number; snip?: string }> = [];
    for (const item of (Array.isArray(p?.output) ? p.output : [])) {
      if (item?.type === "message") {
        for (const c of (Array.isArray(item?.content) ? item.content : [])) if (c?.type === "output_text" && c?.text) text += String(c.text);
      } else if (item?.type === "search_results") {
        for (const x of (Array.isArray(item?.results) ? item.results : [])) if (x?.url) cites.push({ title: String(x?.title || "Web source"), url: String(x.url), id: Number.isFinite(Number(x?.id)) ? Number(x.id) : cites.length + 1, snip: String(x?.snippet ?? x?.text ?? x?.content ?? x?.description ?? "").slice(0, 1500) });
      }
    }
    return text && cites.length ? { text, cites } : null; // v98: a sub-run with zero search results is unverified model text — drop it
  } catch { return null; }
}

// ============================================================
// COMPLETE AUTONOMOUS AGENT ECOSYSTEM — DRILL SERGEANT CEO
// ============================================================
// A self-orchestrating multi-agent system with a CEO that manages
// specialist agents for research, reasoning, writing, QA, and follow-ups.
// Mirrors the most sophisticated AI systems (Anthropic, OpenAI, Perplexity).
// ============================================================
// SPEND CAP + DEEP RESEARCH (v61) — Agent API background runs
// ============================================================
// Monthly per-user spend cap on Perplexity API usage. The ceiling comes from
// the SPEND_CEILING_USD secret (default $50/month); usage is tracked in the
// gateway project's api_usage_month table (RLS: users see only their own
// rows). When the cap is hit, research falls back to the free sources and
// deep-research submits are refused with a clear error — the key never burns
// past the ceiling. Estimated per-request costs by effort level are
// conservative: fast $0.02, low $0.05, medium $0.15, high $0.50.
const SPEND_CEILING_USD = Number(Deno.env.get("SPEND_CEILING_USD") || "50");
const EFFORT_COST: Record<string, number> = { fast: 0.02, low: 0.05, medium: 0.15, high: 0.5 };
async function usageState(userToken: string, svc?: { key: string; uid: string }): Promise<{ requests: number; cost: number }> {
  const url = Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co";
  const month = new Date().toISOString().slice(0, 7);
  try {
    const r = await fetch(`${url}/rest/v1/api_usage_month?select=requests,est_cost_usd&month=eq.${month}${svc ? `&user_id=eq.${svc.uid}` : ""}`, {
      headers: svc ? { "apikey": svc.key, "Authorization": `Bearer ${svc.key}` } : { "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "", "Authorization": `Bearer ${userToken}` },
      signal: AbortSignal.timeout(5_000)
    });
    if (r.ok) {
      const rows = await r.json();
      const row = Array.isArray(rows) ? rows[0] : undefined;
      return { requests: Number(row?.requests ?? 0), cost: Number(row?.est_cost_usd ?? 0) };
    }
  } catch { /* cap check fails OPEN only when the usage table is unreachable AND no usage is recorded; treat as 0 */ }
  return { requests: 0, cost: 0 };
}
async function recordUsage(userToken: string, costUsd: number, svc?: { key: string; uid: string }): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co";
  const month = new Date().toISOString().slice(0, 7);
  try {
    // read-modify-upsert; races only undercount by a request or two — acceptable for a cap
    const cur = await usageState(userToken, svc);
    const body = { month, requests: cur.requests + 1, est_cost_usd: Number((cur.cost + costUsd).toFixed(4)) };
    let uid = svc?.uid;
    if (!uid) {
      const auth = await fetch(`${url}/auth/v1/user`, { headers: { "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "", "Authorization": `Bearer ${userToken}` }, signal: AbortSignal.timeout(5_000) });
      if (!auth.ok) return;
      uid = (await auth.json())?.id;
    }
    if (!uid) return;
    await fetch(`${url}/rest/v1/api_usage_month`, {
      method: "POST",
      headers: { "apikey": svc ? svc.key : (Deno.env.get("SUPABASE_ANON_KEY") ?? ""), "Authorization": `Bearer ${svc ? svc.key : userToken}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ ...body, user_id: uid }),
      signal: AbortSignal.timeout(5_000)
    });
  } catch { /* usage recording is best-effort; never block the answer */ }
}
function parseAgentRunOutput(run: any): { text: string; sources: Array<{ title: string; url: string }> } {
  let text = "";
  const cites: Array<{ title: string; url: string; id: number }> = [];
  for (const item of (Array.isArray(run?.output) ? run.output : [])) {
    if (item?.type === "message") {
      for (const c of (Array.isArray(item?.content) ? item.content : [])) {
        if (c?.type === "output_text" && c?.text) text += String(c.text);
      }
    } else if (item?.type === "search_results") {
      for (const r of (Array.isArray(item?.results) ? item.results : [])) {
        if (r?.url) cites.push({ title: String(r?.title || "Web source"), url: String(r.url), id: Number.isFinite(Number(r?.id)) ? Number(r.id) : cites.length + 1 });
      }
    }
  }
  // v126 DEEP-PATH PARITY FIX: the poll endpoint used to return the raw answer with
  // [web:N] markers still in it (25/30 deep-mode replays tripped on this). Rewrite them
  // into [[N](url)] markdown links against a deduped master source list — the same
  // approach research-jobs' linkWebMarkers uses for its path. Unmapped ids fall back
  // positional; unmappable markers are dropped.
  // v128: same canonical index as the inline path (junk/canary hosts normalized, positional-id aware, sludge titles -> domain).
  const sidx = buildSourceIndex(cites, { cap: 30, startAt: 1 });
  const master = sidx.uniq;
  const numFor = (id: number): number | null => sidx.idToNum.has(id) ? sidx.idToNum.get(id)! : null;
  let rewritten = master.length
    ? text.replace(/\[((?:web:\d+\s*,?\s*)+)\]/g, (_m, grp: string) => {
        const nums = [...new Set([...grp.matchAll(/web:(\d+)/g)].map((mm) => numFor(Number(mm[1]))).filter((n): n is number => n != null))];
        return nums.length ? nums.map((n) => `[[${n}](${master[n - 1].url})]`).join("") : "";
      })
    : text.replace(/\[\s*web:\d+(?:\s*,\s*web:\d+)*\s*\]/g, "");
  if (master.length) { const ao = alignOutlets(rewritten.replace(/\[\[(\d+)\]\([^)]*\)\]/g, "[$1]"), new Map(master.map((m, i) => [i + 1, m.url] as [number, string]))); rewritten = ao.text.replace(/\[(\d{1,2})\](?!\()/g, (full, n) => master[Number(n) - 1] ? `[[${n}](${master[Number(n) - 1].url})]` : full); }
  return { text: rewritten, sources: master };
}

// v98 BUG hou05: bind inline [N] markers to the evidence slot that actually contains the figure in the sentence.
// slots: marker number -> the evidence text (title + snippets) behind that numbered source. Slots with no usable
// evidence text cannot be verified and are left alone. A marker whose slot lacks every figure of its sentence is
// re-pointed to the slots that contain it; if one is already cited the redundant wrong marker is dropped; if no snippet has the figure the marker is kept (snippets are partial).
function figuresIn(sentence: string): string[] {
  const clean = sentence.replace(/\[\[?\d{1,2}\]?(?:\([^)]*\))?\]/g, " ").replace(/https?:\/\/\S+/g, " ");
  const out = new Set<string>();
  for (const m of clean.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = m[0].replace(/,+$/, "");
    const v = raw.replace(/,/g, "");
    if (/^(19|20)\d\d$/.test(v)) continue;                 // bare years are not evidence figures
    if (v.replace(/\./, "").length < 2) continue;           // single digits are too ambiguous
    out.add(v);
  }
  return [...out];
}
function alignCitations(text: string, slots: Map<number, string>): { text: string; rebound: number; dropped: number } {
  let rebound = 0, dropped = 0;
  const norm = (t: string) => t.replace(/(\d),(?=\d{3}\b)/g, "$1");
  const slotNorm = new Map<number, string>();
  for (const [n, t] of slots) if (t && t.length > 40) slotNorm.set(n, norm(t));
  if (!slotNorm.size) return { text, rebound, dropped };
  const has = (n: number, figs: string[]) => { const t = slotNorm.get(n); return !!t && figs.some((f) => new RegExp(`(?<![\\d.])${f.replace(/\./g, "\\.")}(?![\\d]|\\.\\d)`).test(t)); };
  // split into sentences while keeping separators; code fences are left untouched
  const parts = text.split(/(```[\s\S]*?```)/g);
  const outParts = parts.map((part, pi) => {
    if (pi % 2 === 1) return part;
    return part.replace(/[^\n]*?(?:[.!?](?=\s|$)|\n|$)/g, (sent) => {
      if (!sent.trim()) return sent;
      const markers = [...sent.matchAll(/\[(\d{1,2})\]/g)];
      if (!markers.length) return sent;
      const figs = figuresIn(sent);
      if (!figs.length) return sent;
      const verifiable = markers.filter((m) => slotNorm.has(Number(m[1])));
      if (!verifiable.length) return sent;
      const supporting = [...slotNorm.keys()].filter((n) => has(n, figs));
      let result = sent;
      const bad = verifiable.filter((m) => !has(Number(m[1]), figs));
      for (const m of bad) {
        const cited = new Set(markers.map((x) => Number(x[1])));
        const repl = supporting.filter((n) => !cited.has(n)).slice(0, 1);
        if (repl.length) { result = result.replace(`[${m[1]}]`, `[${repl[0]}]`); rebound++; }
        else if (supporting.length) { result = result.replace(`[${m[1]}]`, ""); dropped++; } // a supporting source is already cited here
        // no snippet contains the figure: snippets are partial, so absence is not proof — keep the marker
      }
      return result.replace(/(\[\d+\])\1+/g, "$1").replace(/ {2,}/g, " ").replace(/\s+([.,;])/g, "$1");
    });
  });
  return { text: outParts.join(""), rebound, dropped };
}

// ============================================================
// v96 G4: API-KEY AUTH (OpenAI-compatible) + H2 AUTO-ROUTING + A8 STEP PHASES
// ============================================================
const API_KEY_PREFIX = "sk-spaincos-";
async function sha256HexStr(x: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Resolve a raw sk-spaincos-... key to a user via the api_keys table (hash lookup, service role). Never logs the key.
// status: ok | invalid (unknown or revoked -> 401) | unavailable (service role missing / lookup failed -> 503)
async function resolveApiKey(raw: string, touch: boolean): Promise<{ status: "ok" | "invalid" | "unavailable"; userId?: string; email?: string; svc?: string; keyId?: string }> {
  const url = Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co";
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!svc) return { status: "unavailable" };
  if (!/^sk-spaincos-[A-Za-z0-9_-]{8,200}$/.test(raw)) return { status: "invalid" };
  const h = { apikey: svc, Authorization: `Bearer ${svc}`, "Content-Type": "application/json" };
  try {
    const hash = await sha256HexStr(raw);
    const r = await fetch(`${url}/rest/v1/api_keys?select=id,user_id,revoked_at&key_hash=eq.${hash}&limit=1`, { headers: h, signal: AbortSignal.timeout(6_000) });
    if (!r.ok) return { status: "unavailable" };
    const row = (await r.json())?.[0];
    if (!row || row.revoked_at || !row.user_id) return { status: "invalid" };
    const u = await fetch(`${url}/auth/v1/admin/users/${row.user_id}`, { headers: h, signal: AbortSignal.timeout(6_000) });
    if (!u.ok) return { status: "unavailable" };
    const email = String((await u.json())?.email ?? "");
    // usage counter: the schema only has last_used_at; bump it (best-effort, skipped for incognito requests)
    if (touch) fetch(`${url}/rest/v1/api_keys?id=eq.${row.id}`, { method: "PATCH", headers: h, body: JSON.stringify({ last_used_at: new Date().toISOString() }), signal: AbortSignal.timeout(4_000) }).catch(() => {});
    return { status: "ok", userId: row.user_id, email, svc, keyId: row.id };
  } catch { return { status: "unavailable" }; }
}
// OpenAI messages: content may be an array of parts; "developer" is "system"; tool turns are dropped (the gateway runs its own tools).
function normalizeOpenAIMessages(msgs: any): any[] {
  if (!Array.isArray(msgs)) return [];
  const out: any[] = [];
  for (const m of msgs) {
    if (!m || typeof m !== "object") continue;
    let role = String(m.role || "user");
    if (role === "developer") role = "system";
    if (role !== "system" && role !== "user" && role !== "assistant") continue;
    let c = m.content;
    if (Array.isArray(c)) c = c.map((p: any) => (typeof p === "string" ? p : p?.type === "text" || typeof p?.text === "string" ? String(p.text ?? "") : "")).filter(Boolean).join("\n");
    out.push({ ...m, role, content: typeof c === "string" ? c : String(c ?? "") });
  }
  return out;
}
// H2: pick a model by task when model === "auto". Env overrides: ROUTE_{REASONING,CODING,LONG,VISION,GENERAL}_MODEL.
function routeModel(query: string, allText: string, hasImage: boolean): { model: string; task: string } {
  const e = (k: string, d: string) => Deno.env.get(k) || d;
  const GLM = "z-ai/glm-5.3";
  if (hasImage) return { model: e("ROUTE_VISION_MODEL", GLM), task: "vision" };
  if (allText.length > 24_000) return { model: e("ROUTE_LONG_MODEL", "moonshotai/kimi-k3.1-pro"), task: "long_context" };
  const q = query.toLowerCase();
  if (/```|\b(function|stack ?trace|traceback|regex|sql query|typescript|javascript|python|rust|golang|bug|refactor|unit test|compile|debug|api endpoint|code review)\b|\b(write|fix|implement) (a |an |the )?(script|function|class|query|program|component)\b/.test(q)) return { model: e("ROUTE_CODING_MODEL", "deepseek/deepseek-v4.1-flash-1017"), task: "coding" };
  if (/\b(prove|derive|step[- ]by[- ]step|logic puzzle|game theory|optimi[sz]e|trade-?offs?|first principles|reason through|why does|how many .* (if|when)|probability|expected value)\b/.test(q) || /\d\s*[-+*/^]\s*\d.*\b(solve|calculate|compute)\b/.test(q)) return { model: e("ROUTE_REASONING_MODEL", "moonshotai/kimi-k3.1-pro"), task: "reasoning" };
  return { model: e("ROUTE_GENERAL_MODEL", GLM), task: "general" };
}
// OpenAI-style SSE: keep only chat.completion.chunk frames (+[DONE]); drop the gateway's phases/assets/revision events.
// CYCLE 2 GAP 2 (API-key clients): OpenAI-format clients cannot receive a {"revision"} event, so their stream is scrubbed in-line instead.
// Content deltas are held back to the last newline (a connection string / key never spans lines), scrubbed with the shared helper, then re-emitted;
// the remainder is flushed before the finish frame / [DONE]. Costs at most one line of latency.
function scrubSSEStream(src: ReadableStream<Uint8Array>, allowUrls: string[], knownSecrets: string[] = []): ReadableStream<Uint8Array> {
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = "", pending = "", tmpl: any = null, noticed = false;
  const scrub = (t: string): string => { const r = scrubCredentials(t, { allowUrls, appendNotice: false, knownSecrets }); if (r.changed) noticed = true; return r.text; };
  const contentFrame = (text: string): string => text ? `data: ${JSON.stringify({ ...(tmpl || {}), choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })}\n\n` : "";
  const flush = (c: ReadableStreamDefaultController<Uint8Array>) => {
    if (pending) c.enqueue(enc.encode(contentFrame(scrub(pending))));
    pending = "";
    if (noticed) { c.enqueue(enc.encode(contentFrame(REDACTION_NOTICE))); noticed = false; }
  };
  const handle = (line: string, c: ReadableStreamDefaultController<Uint8Array>) => {
    if (!line.startsWith("data:")) { if (line.trim()) c.enqueue(enc.encode(line + "\n\n")); return; }
    const d = line.slice(5).trim();
    if (d === "[DONE]") { flush(c); c.enqueue(enc.encode("data: [DONE]\n\n")); return; }
    let j: any; try { j = JSON.parse(d); } catch { c.enqueue(enc.encode(line + "\n\n")); return; }
    const delta = j?.choices?.[0]?.delta;
    if (typeof delta?.content === "string" && delta.content) {
      tmpl = { ...j, choices: undefined, usage: undefined };
      pending += delta.content;
      const nl = pending.lastIndexOf("\n");
      if (nl >= 0) { const head = pending.slice(0, nl + 1); pending = pending.slice(nl + 1); c.enqueue(enc.encode(contentFrame(scrub(head)))); }
      return;
    }
    if (j?.choices?.[0]?.finish_reason) flush(c);   // finish frame: emit the held-back tail first
    c.enqueue(enc.encode(`data: ${JSON.stringify(j)}\n\n`));
  };
  return new ReadableStream({
    async start(c) {
      const r = src.getReader();
      try {
        while (true) {
          const { done, value } = await r.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (ln) handle(ln, c); }
        }
        if (buf.trim()) handle(buf.trim(), c);
        flush(c);
        c.close();
      } catch (e) { c.error(e); }
    }
  });
}

function openAIStreamFilter(src: ReadableStream<Uint8Array>, model: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const id = "chatcmpl-" + crypto.randomUUID().replace(/-/g, "").slice(0, 24), created = Math.floor(Date.now() / 1000);
  let buf = "", doneSent = false;
  const frame = (line: string): string => {
    if (!line.startsWith("data:")) return "";
    const d = line.slice(5).trim();
    if (d === "[DONE]") { if (doneSent) return ""; doneSent = true; return "data: [DONE]\n\n"; }
    try {
      const j = JSON.parse(d);
      if (!Array.isArray(j?.choices)) return "";
      return `data: ${JSON.stringify({ ...j, id: j.id || id, object: "chat.completion.chunk", created: j.created || created, model: j.model || model })}\n\n`;
    } catch { return ""; }
  };
  return new ReadableStream({
    async start(c) {
      const r = src.getReader();
      try {
        while (true) {
          const { done, value } = await r.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) >= 0) { const o = frame(buf.slice(0, i).trim()); buf = buf.slice(i + 1); if (o) c.enqueue(enc.encode(o)); }
        }
        if (buf.trim()) { const o = frame(buf.trim()); if (o) c.enqueue(enc.encode(o)); }
        if (!doneSent) c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      } catch (e) { c.error(e); }
    }
  });
}
const BODY_MAX_BYTES = 700 * 1024;            // hardening: request body cap (excluding the optional base64 image attachment) -> 413
const BODY_ABS_MAX_BYTES = 16 * 1024 * 1024;   // hardening: absolute ceiling incl. attachment (attachment itself is capped < 7M chars below)
const oaiError = (message: string, type: string, code: string) => ({ error: { message, type, code } });

// v103 F12: thin wrapper. For streaming member requests the handler "commits" to SSE right after validation (progress.commit())
// and reports real steps while it works; every early return (auth, rate limit, embed_context, deep research, admin) resolves BEFORE
// commit and is returned unchanged. LIVE_PROGRESS=0 disables the whole thing.
Deno.serve(async (req) => {
  const live = await wantsLiveProgress(req, { isApiKey: (h) => h.startsWith("Bearer " + API_KEY_PREFIX), disabled: Deno.env.get("LIVE_PROGRESS") === "0" });
  if (!live) return await chatHandler(req);
  const sink = new ProgressSink();
  const work = chatHandler(req, sink);
  work.catch(() => { /* surfaced through the race / streamResponse */ });
  const first = await Promise.race([work.then((r) => ({ r })), sink.committed.then(() => null)]);
  if (first) return first.r;                       // finished (or errored out) before committing: identical to the old behaviour
  return sink.streamResponse(work, corsFor(req));  // committed: SSE now, the handler's own output is forwarded when it finishes
});

async function chatHandler(req: Request, progress?: ProgressSink): Promise<Response> {
  const cors = corsFor(req); // pinned to https://ai.spaincos.com, Vary: Origin
  if (req.method === "OPTIONS") return corsPreflight(req, cors);
  if (!GW_TOKEN) return new Response(JSON.stringify({ error: "gateway not configured" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });

  // --- AUTH ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const jsonHdr = { ...cors, "Content-Type": "application/json" };
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Not authenticated — sign in again." }), { status: 401, headers: jsonHdr });
  }
  const token = authHeader.slice(7).trim();
  // v96 G4: API-key path (OpenAI-compatible clients send Authorization: Bearer sk-spaincos-...).
  const apiKeyMode = token.startsWith(API_KEY_PREFIX);
  let svcAuth: { key: string; uid: string } | undefined;
  let authUser: any;
  if (apiKeyMode) {
    // peek incognito from a cloned body so incognito requests do not bump last_used_at
    let incPeek = false;
    if (req.method === "POST") { try { incPeek = (await req.clone().json())?.incognito === true; } catch { /* ignore */ } }
    const rk = await resolveApiKey(token, !incPeek);
    if (rk.status === "invalid") return new Response(JSON.stringify(oaiError("Invalid or revoked API key.", "invalid_request_error", "invalid_api_key")), { status: 401, headers: { ...jsonHdr, "WWW-Authenticate": "Bearer" } });
    if (rk.status === "unavailable") return new Response(JSON.stringify(oaiError("API key verification is temporarily unavailable.", "api_error", "auth_unavailable")), { status: 503, headers: jsonHdr });
    svcAuth = { key: rk.svc!, uid: rk.userId! };
    authUser = { id: rk.userId, email: rk.email };
  } else {
    const authCheck = await fetch(`${Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co"}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${token}`, "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
      signal: AbortSignal.timeout(10_000)
    });
    if (!authCheck.ok) {
      return new Response(JSON.stringify({ error: "Not authenticated — sign in again." }), { status: 401, headers: jsonHdr });
    }
    authUser = await authCheck.json();
  }
  const userEmail = authUser?.email ?? "";
  const userId = authUser?.id ?? "";

  // v72: private-site lock — only the owner's account (plus the QA test account)
  // may call this gateway. Everyone else gets a clean 403.
  const ALLOWED_EMAILS = ["bspain@spaincos.com", "eval-bot@spaincos.com"];
  // require a confirmed address (open signup is enabled on the auth project until the migration/dashboard change lands)
  const emailConfirmed = apiKeyMode || !!(authUser?.email_confirmed_at || authUser?.confirmed_at);
  if (!emailConfirmed || !ALLOWED_EMAILS.includes(userEmail.toLowerCase())) {
    return new Response(JSON.stringify({ error: "This site is private." }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
  }

  // DEEP RESEARCH POLL (GET): the client polls a background Agent API run by id.
  // GET ?deep_research_id=<run id> -> { status } or { status, answer, sources } when completed.
  if (req.method === "GET") {
    const drId = new URL(req.url).searchParams.get("deep_research_id") || "";
    if (!drId) {
      return new Response(JSON.stringify({ error: "deep_research_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    // hardening: Agent API run ids are "resp_<opaque>" (docs: GET /v1/agent/{id}); anything else is junk -> 400 before the upstream call
    if (!/^resp_[A-Za-z0-9_-]{8,120}$/.test(drId)) {
      return new Response(JSON.stringify({ error: "invalid deep_research_id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const key = Deno.env.get("PERPLEXITY_API_KEY");
    if (!key) return new Response(JSON.stringify({ error: "deep research not configured" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
    try {
      const pr = await fetch(`https://api.perplexity.ai/v1/agent/${drId}`, { headers: { "Authorization": `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
      if (!pr.ok) return new Response(JSON.stringify({ error: `poll failed (HTTP ${pr.status})` }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      const run = await pr.json();
      const out: any = { deep_research_id: drId, status: run?.status ?? "unknown" };
      if (run?.status === "completed") {
        const parsed = parseAgentRunOutput(run);
        out.answer = parsed.text;
        out.sources = parsed.sources;
      } else if (["failed", "cancelled", "incomplete"].includes(String(run?.status))) {
        out.error = run?.error ? JSON.stringify(run.error).slice(0, 300) : `run ended with status ${run?.status}`;
      }
      return new Response(JSON.stringify(out), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: "poll failed" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }

  // RATE LIMIT (per user, before any model/search work). Memory limiter absorbs bursts; DB limiter is the durable one.
  // v101.1: invalid bodies get 400 from the existing validation below; the limiter counts them but
  // runs AFTER body-parse so malformed requests are rejected with the right status, never 429.
  if (req.method === "POST") {
    let bucket = "chat";
    try {
      // hardening: body size cap. Declared Content-Length is checked first (no body read); then the actual text.
      // The 200KB cap excludes the optional base64 image attachment (validated separately to <7MB below);
      // an absolute ceiling keeps the whole request bounded.
      const declared = Number(req.headers.get("content-length") || 0);
      if (declared > BODY_ABS_MAX_BYTES) return new Response(JSON.stringify({ error: "request body too large" }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });
      const rawBody = await req.clone().text();
      if (rawBody.length > BODY_ABS_MAX_BYTES) return new Response(JSON.stringify({ error: "request body too large" }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });
      const b = JSON.parse(rawBody);
      let attLen = typeof b?.attachment?.data_url === "string" ? b.attachment.data_url.length : 0;
      if (Array.isArray(b?.attachments)) for (const a of b.attachments.slice(0, 6)) attLen += typeof a?.data_url === "string" ? a.data_url.length : 0;
      if (new TextEncoder().encode(rawBody).length - attLen > BODY_MAX_BYTES) {
        return new Response(JSON.stringify({ error: "request body too large (max 700KB)" }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });
      }
      // v101.1: invalid bodies are rejected with 400 here (the request still counts
      // against the limiter, so junk floods cannot bypass it) — never a bare 429.
      if (!Array.isArray(b?.messages) || b.messages.length === 0) {
        return new Response(JSON.stringify({ error: "messages array required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      // hardening: per-item message validation (non-null object, string role, string/array content) -> 400 before any processing.
      // Array (multi-part) content is only valid for API-key
      // (OpenAI-compatible) callers, where normalizeOpenAIMessages flattens it; the web path requires string content.
      for (const m of b.messages) {
        const okItem = !!m && typeof m === "object" && !Array.isArray(m) && typeof m.role === "string"
          && (m.content === undefined || m.content === null || typeof m.content === "string" || (apiKeyMode && Array.isArray(m.content)));
        if (!okItem) {
          return new Response(JSON.stringify({ error: "invalid messages" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
      }
      bucket = b?.embed_context === true ? "embed" : b?.deep_research === true ? "deep" : "chat";
    } catch (_e) {
      // malformed JSON: 400, not 429 (the request still counts via the parse attempt above failing fast)
      return new Response(JSON.stringify({ error: "malformed JSON body" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    // 2026-11-10: the site is private + invite-only. The owner and the QA account are
    // exempt from ALL rate limiting (memory + DB) — the only remaining cost guard is the
    // call-model spend tripwire (daily paid-call cap + monthly spend cap), which protects
    // the OpenRouter bill and stays. Invited members keep the raised limits above.
    const unlimited = ["bspain@spaincos.com", "eval-bot@spaincos.com"].includes(userEmail.toLowerCase());
    if (!unlimited) {
      const pol = (RATE_POLICY as any)[bucket];
      const m = rateMem.check(`${userId}:${bucket}`, pol.limit, pol.windowSec * 1000);
      if (!m.ok) return tooMany(m.retryAfter, cors);
      const db = await dbRateCheck({ supabaseUrl: Deno.env.get("SUPABASE_URL")!, serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, userId, bucket, limit: pol.limit, windowSec: pol.windowSec });
      if (!db.ok) return tooMany(db.retryAfter, cors);
    }
  }
  try {
    const callModelUrl = "https://dcyjmftriqayqaonitlx.supabase.co/functions/v1/call-model";
    let { messages, purpose, model, max_tokens, stream, tool_loop, thread_id: threadIdRaw, deep_research, attachment, attachments, space_instructions, embed_context, personalization, model_council, sources_filter, time_range, incognito: incognitoRaw, max_completion_tokens, mode: modeRaw } = (await req.json().catch(() => null)) ?? {};
    // v96 B8: incognito requests skip ALL server-side persistence: usage logging, api-key last_used bump, asset storage uploads, dead-end tally.
    const incognito = incognitoRaw === true;
    // v96 G4: OpenAI-compatible bodies (model / messages / stream / max_tokens | max_completion_tokens)
    if (apiKeyMode) {
      if (Array.isArray(messages)) messages = normalizeOpenAIMessages(messages);
      if (!purpose) purpose = "general";
      if (max_tokens == null && Number(max_completion_tokens) > 0) max_tokens = Number(max_completion_tokens);
      if (embed_context === true) return new Response(JSON.stringify(oaiError("embed_context is not available with API keys.", "invalid_request_error", "unsupported")), { status: 403, headers: jsonHdr });
    }
    // v152 SERVER MEMORIES: the member's memory store lives in public.memory_items (database).
    // The gateway reads it server-side so memories apply to every answer from any browser or
    // device; client-sent memories are merged on top (dedup, server order first).
    if (!apiKeyMode && !incognito && userId) {
      try {
        const mr = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/memory_items?user_id=eq.${userId}&select=text&order=created_at.desc&limit=400`, { headers: { apikey: svc, Authorization: `Bearer ${svc}` }, signal: AbortSignal.timeout(4000) });
        if (mr.ok) {
          const rows = await mr.json();
          const server = (Array.isArray(rows) ? rows : []).map((r: any) => String(r?.text || "").trim()).filter(Boolean);
          const client = Array.isArray((personalization as any)?.memory) ? (personalization as any).memory.map((m: unknown) => (typeof m === "string" ? m : String((m as any)?.text ?? ""))).filter(Boolean) : [];
          const seen = new Set<string>();
          const merged = [...server, ...client].filter((m: string) => { const k = m.slice(0, 80).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
          personalization = { ...(personalization && typeof personalization === "object" ? personalization : {}), memory: merged };
        }
      } catch (_e) { /* memory lookup is best-effort */ }
    }
    const recUsage = (cost: number): Promise<void> => (incognito ? Promise.resolve() : recordUsage(token, cost, svcAuth));
    const usageNow = () => usageState(token, svcAuth);

    // ============================================================
    // v69: EMBED CONTEXT — build the semantic (vector) index for the
    // signed-in user's context_documents (imported Perplexity history etc.).
    // Embeds up to 100 un-embedded rows per call with text-embedding-3-small
    // via OPENAI_API_KEY; the client loops until remaining=0. No key -> 503
    // with a clear message (keyword search still works everywhere).
    // ============================================================
    if (embed_context === true) {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) {
        return new Response(JSON.stringify({ error: "semantic indexing not configured (OPENAI_API_KEY not set on the gateway — paste it on the Supabase secrets page)" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const restH = { "Authorization": `Bearer ${token}`, "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "", "Content-Type": "application/json" };
      try {
        const listRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/context_documents?select=id,title,content&embedding=is.null&order=created_at.asc&limit=100`, {
          headers: restH, signal: AbortSignal.timeout(10_000)
        });
        if (!listRes.ok) return new Response(JSON.stringify({ error: `context list failed (HTTP ${listRes.status})` }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
        const rows = await listRes.json();
        if (!Array.isArray(rows) || !rows.length) {
          return new Response(JSON.stringify({ embedded: 0, remaining: 0, note: "nothing left to embed" }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
        // one batched embeddings call (OpenAI preserves input order)
        const inputs = rows.map((r: any) => String(r.title || "").slice(0, 200) + "\n" + String(r.content || "").slice(0, 20000));
        const er = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: inputs }),
          signal: AbortSignal.timeout(30_000)
        });
        if (!er.ok) return new Response(JSON.stringify({ error: `embeddings failed (HTTP ${er.status})` }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
        const ed = await er.json();
        const vecs: any[][] = (ed?.data || []).map((d: any) => d?.embedding).filter((v: any) => Array.isArray(v) && v.length === 1536);
        if (vecs.length !== rows.length) return new Response(JSON.stringify({ error: "embedding count mismatch" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
        let embedded = 0;
        for (let i = 0; i < rows.length; i++) {
          const pr = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/context_documents?id=eq.${rows[i].id}`, {
            method: "PATCH",
            headers: { ...restH, "Prefer": "return=minimal" },
            body: JSON.stringify({ embedding: vecs[i] }),
            signal: AbortSignal.timeout(10_000)
          });
          if (pr.ok) embedded++;
        }
        // full batch => maybe more rows remain (client keeps looping); partial batch => done
        return new Response(JSON.stringify({ embedded, remaining: rows.length < 100 ? 0 : 1, batch: rows.length }), { headers: { ...cors, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: "embed context failed" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    if (Array.isArray(messages) && (messages.length > 60 || JSON.stringify(messages).length > 400_000)) {
      return new Response(JSON.stringify({ error: "conversation too large" }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // v63 IMAGE ATTACHMENTS: the client may attach one image per request as a
    // base64 data URI (PNG/JPEG/WEBP/GIF — the Agent API's supported set).
    // Vision analysis happens in the Perplexity Agent API lane (input_image
    // content part) — the only vision-capable surface the gateway has. The
    // writing agents never see the raw image; they see the vision lane's
    // findings, same as web research.
    const attachBody = attachment && typeof attachment === "object" ? attachment : null;
    const okImg = (x: any) => x && typeof x === "object" && x.type === "image" && typeof x.data_url === "string"
      && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(x.data_url)
      && x.data_url.length < 7_000_000; // ~5MB image after base64 inflation
    // multi-attach: attachments[] (cap 6 images, ~14MB total base64); legacy single `attachment` still works
    const imageAttaches: Array<{ name: string; data_url: string }> = [];
    let imgBudget = 14_000_000;
    for (const x of (Array.isArray(attachments) ? attachments.slice(0, 6) : [])) {
      if (okImg(x) && x.data_url.length <= imgBudget) { imgBudget -= x.data_url.length; imageAttaches.push({ name: String(x.name || "attached image").slice(0, 80), data_url: x.data_url }); }
    }
    if (!imageAttaches.length && okImg(attachBody)) imageAttaches.push({ name: String(attachBody.name || "attached image").slice(0, 80), data_url: attachBody.data_url });
    const imageAttach = imageAttaches.length ? imageAttaches[0] : null;
    const imageNames = imageAttaches.map((i) => i.name).join(", ");
    const imageParts = imageAttaches.map((i) => ({ type: "input_image", image_url: i.data_url }));

    // DEEP RESEARCH MODE (v61): submit a background Agent API run at high effort
    // (minutes-long, expert-grade, many searches) and return the run id
    // immediately. The client polls GET ?deep_research_id=... until completed.
    // Spend-capped: the monthly ceiling (SPEND_CEILING_USD, default $50) applies
    // — over-cap submits are refused with a clear error, never silently burned.
    if (deep_research === true) {
      const key = Deno.env.get("PERPLEXITY_API_KEY");
      if (!key) return new Response(JSON.stringify({ error: "deep research not configured (no PERPLEXITY_API_KEY)" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
      const lastUser = [...messages].reverse().find((m: any) => m?.role === "user")?.content ?? "";
      if (!String(lastUser).trim()) return new Response(JSON.stringify({ error: "no user message to research" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      const usage = await usageNow();
      if (usage.cost >= SPEND_CEILING_USD) {
        return new Response(JSON.stringify({ error: `monthly research spend cap reached ($${usage.cost.toFixed(2)} of $${SPEND_CEILING_USD}) — raise SPEND_CEILING_USD to continue deep research` }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      }
      // v127 (stress-250 #3): carry the prior conversation so follow-up research keeps the thread (was: last user message only).
      const drText = (c: any): string => typeof c === "string" ? c : Array.isArray(c) ? c.map((x: any) => (typeof x?.text === "string" ? x.text : "")).join(" ") : String(c ?? "");
      const drPrior = (Array.isArray(messages) ? messages : []).filter((m: any) => m && (m.role === "user" || m.role === "assistant"));
      let drLastIdx = -1;
      for (let i = drPrior.length - 1; i >= 0; i--) if (drPrior[i].role === "user") { drLastIdx = i; break; }
      const drHist: string[] = [];
      const drFollow = isShortFollowUp(messages);
      let drBudget = drFollow ? 12000 : 6000;
      for (const m of drPrior.slice(0, Math.max(drLastIdx, 0)).slice(-10).reverse()) {
        const t = drText(m.content).replace(/\n?##\s*Suggested Follow-ups?[\s\S]*$/i, "").replace(/\s+/g, " ").trim().slice(0, m.role === "assistant" ? (drFollow ? 3500 : 1200) : 800);
        if (!t || drBudget - t.length < 0) continue;
        drBudget -= t.length;
        drHist.unshift(`${m.role === "assistant" ? "Assistant" : "User"}: ${t}`);
      }
      const drQuestion = String(lastUser).slice(0, 2000);
      const drInputText = drHist.length
        ? `Earlier conversation (context only — resolve pronouns and follow-up references against it):\n${drHist.join("\n")}\n\nCurrent research request (answer this, fully, in the context of the conversation above):\n${drQuestion}`
        : drQuestion;
      // worse-elimination (2026-11-10): the deep run used to get the raw question only. It now carries a report-grade brief
      // (decompose -> research every sub-question -> sectioned, densely cited, dated report), 18 research steps and a 16K output budget.
      const drToday = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles" });
      const drBodyObj: Record<string, unknown> = {
        effort: "high",
        instructions: deepInstructions(drToday, isShortFollowUp(messages)),
        input: imageAttach
          ? [{ type: "message", role: "user", content: [
              { type: "input_text", text: drInputText },
              ...imageParts
            ] }]
          : drInputText,
        tools: [{ type: "web_search" }],
        background: true,
        max_steps: DEEP_MAX_STEPS,
        max_output_tokens: DEEP_MAX_OUTPUT_TOKENS
      };
      const drPost = (body: string = JSON.stringify(drBodyObj)) => fetch("https://api.perplexity.ai/v1/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body,
        signal: AbortSignal.timeout(30_000)
      });
      try {
        let submit = await drPost();
        // If the upstream rejects the enriched body (400/422: an unsupported field), fall back to the proven v127 body so deep research never regresses to an error.
        if (submit.status === 400 || submit.status === 422) {
          await submit.body?.cancel().catch(() => {});
          const { max_output_tokens: _mo, ...noMax } = drBodyObj;
          submit = await drPost(JSON.stringify(noMax));
          if (submit.status === 400 || submit.status === 422) {
            await submit.body?.cancel().catch(() => {});
            const { instructions: _ins, ...legacy } = noMax;
            submit = await drPost(JSON.stringify({ ...legacy, max_steps: 10 }));
          }
        }
        // v127 (stress-250 #2): upstream 429 -> ONE internal retry after 2-4s, then surface 429 + Retry-After (never 502).
        if (submit.status === 429) {
          // cycle 2 (gap 3a): honor a short upstream Retry-After on the first 429 (was: always 2-4s, ignoring it); cap the in-request wait at 6s.
          const ra0 = Number(submit.headers.get("retry-after"));
          const waitMs = Number.isFinite(ra0) && ra0 > 0 ? Math.min(6000, Math.ceil(ra0) * 1000) + Math.floor(Math.random() * 500) : 2000 + Math.floor(Math.random() * 2000);
          await submit.body?.cancel().catch(() => {});
          await new Promise((r) => setTimeout(r, waitMs));
          submit = await drPost();
          if (submit.status === 429) {
            const ra = Number(submit.headers.get("retry-after"));
            const retryAfter = Math.min(60, Math.max(3, Number.isFinite(ra) && ra > 0 ? Math.ceil(ra) : 8));
            await submit.body?.cancel().catch(() => {});
            return new Response(JSON.stringify({ error: "deep research is rate-limited — retry shortly", rate_limited: true, retry_after: retryAfter }), { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(retryAfter), "Access-Control-Expose-Headers": "Retry-After" } });
          }
        }
        if (!submit.ok) return new Response(JSON.stringify({ error: `deep research submit failed (HTTP ${submit.status})` }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
        const run = await submit.json();
        if (!run?.id) return new Response(JSON.stringify({ error: "deep research submit returned no run id" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
        await recUsage(EFFORT_COST.high);
        return new Response(JSON.stringify({ deep_research_id: run.id, status: run.status ?? "queued" }), { headers: { ...cors, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: "deep research submit failed" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    // DEFAULT MODEL: GLM 5.3 — premium quality on every prompt unless the client overrides
    let routed: { model: string; task: string } | null = null;
    if (model === "auto") {
      routed = routeModel(String(messages[messages.length - 1]?.content || ""), messages.map((m: any) => String(m?.content || "")).join("\n"), !!imageAttach);
    }
    const finalModel = routed ? routed.model : (model && model !== "auto" ? model : "z-ai/glm-5.3");
    const reqStart = Date.now();
    const timeOk = (ms = 100_000) => Date.now() - reqStart < ms; // keep QA retries inside the edge wall-clock
    // v83 REASONING EFFORT: with no effort set, GLM-5.3 spends the ENTIRE 2,048-token cap on hidden
    // reasoning and returns content="" / finish=length (reproduced against call-model: default effort =
    // 2048 reasoning tokens, 0 content; "low" = 23 reasoning tokens + a complete 2,200-char answer).
    // The research lane already supplies the facts, so the writer needs structure, not deep reasoning.
    // call-model maps this to OpenRouter reasoning.effort (ignored for Groq ids).
    const reasoningEffort = (cx: string) => (cx === "complex" || cx === "extreme") ? "medium" : "low";

    // ============================================================
    // JUDGE / RAW MODE (x-judge-bypass: 1)
    // ============================================================
    // The eval harness calls the gateway to JUDGE answers. Without this
    // bypass, the judge prompt itself got wrapped in research retrieval and
    // persona injection — the judge saw its own retrieved "live findings",
    // mistook real URLs for fabrications, and scores were contaminated
    // (±2 noise per item). Raw mode forwards the messages to the model
    // UNTOUCHED: no research, no persona, no user context, no QA retries,
    // no citation rewriting. Exact prompt in, exact model answer out.
    if (req.headers.get("x-judge-bypass") === "1") {
      // raw mode skips persona, research, QA: restrict to the eval account and cap the output (spend and abuse control)
      if (userEmail.toLowerCase() !== "eval-bot@spaincos.com") return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
      try {
        const rawRes = await fetch(callModelUrl, {
          method: "POST",
          headers: GW_HEADERS,
          body: JSON.stringify({ messages, purpose: "general", model: finalModel, max_tokens: tokenBudget }),
          signal: AbortSignal.timeout(120_000)
        });
        const rawData = await rawRes.json();
        return new Response(JSON.stringify(rawData), { status: rawRes.status, headers: { ...cors, "Content-Type": "application/json" } });
      } catch (e) {
        console.error("gateway-chat judge-bypass error:", String(e).slice(0, 500));
        return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    let userQuery = messages[messages.length - 1]?.content || "";
    // v176 RETRY PHRASES: "TRY AGAIN" / "RETRY" / "RUN IT AGAIN" as a standalone message
    // means RE-EXECUTE THE PREVIOUS PROMPT — not a literal lookup of the phrase. The
    // owner-reported incident (2026-11-12): the model web-searched the DEFINITION of
    // "try again". When the whole message is a retry phrase and a prior user turn
    // exists, substitute the prior prompt and mark it as a retry.
    const RETRY_PHRASE = /^(try again|retry|re-?try|run (it|that) again|do (it|that) again|again|one more time|redo|re-?run)[\s.!]*$/i;
    const lastUser = Array.isArray(messages) ? messages.filter((m: any) => m?.role === "user") : [];
    if (RETRY_PHRASE.test(String(userQuery).trim()) && lastUser.length >= 2) {
      const prior = String(lastUser[lastUser.length - 2]?.content ?? "").trim();
      if (prior && prior.length > 1 && !RETRY_PHRASE.test(prior)) {
        userQuery = prior;
        // rewrite the in-flight message so every downstream lane (intent, research,
        // tools, writer) sees the real prompt, with a retry marker the model can note.
        messages[messages.length - 1] = { role: "user", content: prior + "\n\n(System note: the user asked to TRY AGAIN — re-execute this previous request fully and freshly, do not merely summarize the earlier attempt.)" };
      }
    }

    // CYCLE 3 GAP 2b: secret VALUES the member (or earlier turns) put in the conversation. The output scrub redacts these exact strings wherever they
    // reappear — prose, backticks, code fences — closing the "the password `X` is withheld" echo that shape patterns cannot see.
    const harvestedSecrets: string[] = (() => {
      try {
        return harvestSecrets((Array.isArray(messages) ? messages : []).filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
          .map((m: any) => typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((x: any) => (typeof x?.text === "string" ? x.text : "")).join("\n") : ""));
      } catch { return []; }
    })();
    // v127 (stress-250 #6): junk-input guard. Punctuation/whitespace only, a lone character, or pure repetition ("aaaa", "abcabcabc")
    // gets a brief clarification with NO personalization / account context, no research and no model spend.
    if (typeof userQuery === "string" && !attachBody && !imageAttach && isJunkInput(userQuery)) {
      const clar = "I'm not sure what you'd like to ask — could you share a bit more? Tell me the topic or question, and I'll dig in.";
      const junkBody = {
        id: "chatcmpl-" + crypto.randomUUID().replace(/-/g, "").slice(0, 24), object: "chat.completion", created: Math.floor(Date.now() / 1000), model: "gateway",
        choices: [{ index: 0, message: { role: "assistant", content: clar }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        x_dead_end: "clean", x_quality: { verdict_initial: "clean", verdict: "clean", action_kind: "none", offer_only: false, rewritten: false },
        x_research: { sources: 0, sub_questions: 0, lane: "none", skipped: "junk_input", detail: null }, x_guard: "junk_input",
      };
      return new Response(JSON.stringify(junkBody), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }
    // v103 F12: everything above can return early (auth/rate limit/embed_context/deep research/admin raw). From here on the answer
    // is SSE-only, so it is safe to open the stream and show real progress during intent analysis, search, tools and council.
    if (progress && stream === true && !apiKeyMode) { progress.commit(); progress.begin("analyze", "Analyzing your question…", "analyze"); }

    // ============================================================
    // PER-USER CONTEXT (the whole point of this platform)
    // ============================================================
    // The assistant knows WHO is asking: their account, their registered
    // assets, and their ingested email context. Fetched with the user's own
    // token (Row-Level Security guarantees they only ever see their rows).
    let userContextBlock = "";
    const sbAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const userRestHeaders = svcAuth
      ? { "Authorization": `Bearer ${svcAuth.key}`, "apikey": svcAuth.key, "Content-Type": "application/json" } // API-key path: service role, ALWAYS filtered by user_id below
      : { "Authorization": `Bearer ${token}`, "apikey": sbAnonKey, "Content-Type": "application/json" };
    const uidQ = svcAuth ? `&user_id=eq.${svcAuth.uid}` : "";
    try {
      const [assetsRes, docsRes] = await Promise.all([
        fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/user_assets?select=label,address&limit=100${uidQ}`, { headers: userRestHeaders, signal: AbortSignal.timeout(8_000) }),
        fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/context_documents?select=title,content&order=created_at.desc&limit=20${uidQ}`, { headers: userRestHeaders, signal: AbortSignal.timeout(8_000) })
      ]);
      const assets = assetsRes.ok ? await assetsRes.json() : [];
      const docs = docsRes.ok ? await docsRes.json() : [];
      const dispName = authUser?.user_metadata?.full_name || authUser?.raw_user_meta_data?.full_name || authUser?.user_metadata?.name || "";
      const parts = [`The current user is signed in as ${userEmail}${dispName ? ` — name: ${dispName}` : ""}.`];
      if (Array.isArray(assets) && assets.length) {
        parts.push(`Their registered assets (${assets.length}):\n` + assets.map((a: any) => `- ${a.label}${a.address ? ` — ${a.address}` : ""}`).join("\n"));
      }
      if (Array.isArray(docs) && docs.length) {
        parts.push(`Their ingested email context (${docs.length} most recent items):\n` + docs.map((d: any) => `- ${d.title}: ${String(d.content || "").slice(0, 200)}`).join("\n"));
      }
      if (!parts[1] && !parts[2]) {
        parts.push("Their platform records currently show no registered assets or connected email context (records may lag reality). Do not invent personal knowledge, and do NOT lead answers with these absences or frame the account as empty — mention them only when the user directly asks about their assets or connections.");
      }
      userContextBlock = "\n\n=== CURRENT USER (who you are talking to) ===\n" + parts.join("\n\n") + "\nUse this user context naturally in your answer when relevant.";
    } catch (e) { /* context fetch failed — continue without */ }

    // ============================================================
    // AGENT 1: INTENT ANALYST (classifies and decomposes the task)
    // ============================================================
    const intentPrompt = `You are an INTENT ANALYST. Analyze this question. Respond with ONLY valid JSON:
{"intent": "explanation|data_query|analysis|code|comparison|how_to|status|creative|strategy|other", "complexity": "simple|medium|complex|extreme", "topics": ["key","topics"], "needs_search": true|false, "needs_images": true|false, "needs_code": true|false, "needs_data": true|false, "sub_tasks": ["break","down","into","subtasks"]}

Rules:
- ACRONYMS: if the question contains an ALL-CAPS acronym of 3-8 letters that is NOT a universally known one (known: ${ACRONYM_PROMPT_EXAMPLES}, and similar), you do NOT know what it stands for. Set needs_search=true and complexity at least "medium". Never guess an expansion from a similar-looking famous entity.
- LEGAL RESEARCH: any question about statutes, code sections (§), regulations, case law, precedent, court rulings or what a jurisdiction's law requires is research-grade: needs_search=true, complexity at least "complex".

Question: "${userQuery}"`;

    let intent = { intent: "explanation", complexity: "medium", topics: [], needs_search: false, needs_images: false, needs_code: false, needs_data: false, sub_tasks: [] };
    // v172 CREDIT CHARGING (reserve-then-settle, fail-open by design):
    // Reserve happens BEFORE any model work; settle fires after the response is built
    // (via waitUntil) with the actual-mode cost. A missing ledger/RPC or any non-"insufficient"
    // error logs and continues FREE — chat NEVER breaks on billing. Only a genuine
    // insufficient-balance 402s (and only for signed-in users; API-key users are metered
    // on api_usage_month instead; incognito and free-lane requests cost 0).
    const creditRef = crypto.randomUUID();
    let creditHold = 0;
    const FREE_PURPOSE = new Set(["flint", "summary"]);
    // v194 COMPLEXITY-TIERED CREDIT PRICING (retier — Neurons loyalty session spec).
    // Frontend sends `mode`; the reserve is the TIER MAX at request receipt (p_actual at
    // completion settles the actual cost, so the hold is always >= the charge).
    // Backward compat: a missing/unknown mode field (legacy clients) keeps the old
    // behavior — deep_research/council flags, else a flat 5.
    const CREDIT_TIERS: Record<string, { min: number; max: number }> = {
      quick:  { min: 1,     max: 1 },
      search: { min: 5,     max: 5 },
      deep:   { min: 50,    max: 5000 },
      agent:  { min: 100,   max: 1000 },
    };
    const requestMode = String(modeRaw || "").toLowerCase().trim();
    let creditTier = CREDIT_TIERS[requestMode] || null;
    if (!creditTier) {
      if (deep_research === true) creditTier = CREDIT_TIERS.deep;
      else if (model_council === true) creditTier = { min: 8, max: 8 };  // v172 council price unchanged
    }
    if (!creditTier) creditTier = { min: 5, max: 5 };  // legacy default: 5 (search tier)
    const creditCost = creditTier.max;   // reserve = tier max; settle = actual (<= max)
    const chargeable = !incognito && !FREE_PURPOSE.has(String(purpose || ""));
    if (chargeable) {
      try {
        const rr = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/credits_reserve`, {
          method: "POST", headers: userRestHeaders,
          body: JSON.stringify({ p_amount: creditCost, p_ref: creditRef }),
          signal: AbortSignal.timeout(6_000)
        });
        const rd = rr.text().catch(() => "");
        if (rr.ok) { creditHold = creditCost; }
        else {
          const rtxt = String(await rd);
          if (/insufficient credits/i.test(rtxt)) {
            return new Response(JSON.stringify({ error: "out_of_credits", message: "You're out of credits — answers cost fractions of a cent, and every failed tool run is auto-refunded. Top up in Settings > Billing." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
          }
          // any other failure (ledger not deployed, RPC error, timeout): billing off for this request
        }
      } catch (_ce) { /* fail-open: continue free */ }
    }
    // v194 SETTLE-BY-COMPLEXITY: p_actual is the single source of truth. The completion event
    // already computes the complexity class and token counts; feed them in as the actual cost.
    // If nothing richer is known by the time the response is delivered, the hold settles at
    // the tier max (identical to the v172 behavior of settling at creditHold).
    let settledActual: number | null = null;   // set at completion (complexity + token counts)
    const settleCredits = (actual: number) => {
      if (!creditHold) return;
      const charge = settledActual != null ? Math.max(0, Math.min(settledActual, creditHold)) : Math.max(0, Math.min(actual, creditHold));
      const job = fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/credits_settle`, {
        method: "POST", headers: userRestHeaders,
        body: JSON.stringify({ p_ref: creditRef, p_actual: charge }),
        signal: AbortSignal.timeout(8_000)
      }).catch(() => {});
      (globalThis as any).EdgeRuntime?.waitUntil?.(job);
    };
    // v194 ACTUAL-COST FORMULA. The completion event (analytics) already computes the
    // complexity class and token counts; the same numbers drive the settle amount.
    //   base = tier min for the request's mode/complexity class,
    //   + per-complexity-class multiplier on total tokens (scaled to the tier's range),
    // clamped to [tier min, tier max]. Legacy flat tiers (search/quick/council) settle flat.
    const computeActualCost = (cx: string, inTokens: number, outTokens: number): number => {
      const t = creditTier!;
      if (t.min === t.max) return t.max;   // flat tiers (quick, search, legacy default)
      const CX_MULT: Record<string, number> = { simple: 0.05, medium: 0.25, complex: 0.6, extreme: 1 };
      const m = CX_MULT[String(cx || "medium").toLowerCase()] ?? 0.25;
      const total = Math.max(0, Number(inTokens) || 0) + Math.max(0, Number(outTokens) || 0);
      // token scaling: the tier's full range is spread over 0..TOKEN_FULL (deep = 200k,
      // agent = 100k — a report-grade deep run; agents are shorter but more tool-heavy).
      const tokenFull = t === CREDIT_TIERS.deep ? 200_000 : 100_000;
      const frac = Math.min(1, total / tokenFull);
      const cost = t.min + (t.max - t.min) * Math.max(m, frac) * 0.5 + (t.max - t.min) * m * 0.5;
      return Math.max(t.min, Math.min(t.max, Math.round(cost)));
    };
    // v190 SESSION PERMANENCE: server-side turn persistence. The frontend's thread sync is
    // client-driven (delete-all + reinsert from the browser), so a closed window / sleeping
    // machine / dead tab mid-generation used to LOSE the turn entirely. The gateway now
    // persists the user message + assistant answer itself (service role, waitUntil, idempotent
    // via the (thread_id, role, md5) unique index + BEFORE INSERT turn_hash trigger) — the
    // turn survives even if the client disconnects before saving. Requires the frontend to
    // send thread_id (v190 frontend). Self-healing: the client's next save is delete-all +
    // reinsert, so any race duplicates are cleaned on the following turn.
    let persistTurnServerSide = (_assistantText: string) => { /* set below once stream wiring is known */ };
    const buildPersistTurn = (assistantTextGetter: () => string) => {
      const tid = typeof threadIdRaw === "string" && threadIdRaw ? threadIdRaw : "";
      if (!tid || apiKeyMode || incognito) return;
      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!svcKey) return;
      const userMsg = [...(messages || [])].reverse().find((m: any) => m?.role === "user");
      const rows: any[] = [];
      if (userMsg) rows.push({ thread_id: tid, role: "user", content: String(userMsg.content || "").slice(0, 100_000) });
      persistTurnServerSide = (assistantText: string) => {
        try {
          if (!assistantText || assistantText.trim().length < 2) return;
          const svcHeaders = { "apikey": svcKey, "Authorization": `Bearer ${svcKey}`, "Content-Type": "application/json", "Prefer": "return=minimal, resolution=ignore-duplicates" };
          const jobs: Promise<void>[] = [];
          // 1. Ensure the thread row exists (the client may have died before creating it —
          //    thread_messages.thread_id has an FK to threads.id, so messages can't land without it).
          if (userId) {
            const title = String(userMsg?.content || userQuery || "New thread").slice(0, 80);
            jobs.push(fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/threads?on_conflict=id`, {
              method: "POST", headers: svcHeaders,
              body: JSON.stringify({ id: tid, user_id: userId, title }),
              signal: AbortSignal.timeout(8_000)
            }).then((r) => { if (!r.ok) console.error("thread upsert failed:", r.status); }).catch(() => {}));
          }
          // 2. Persist the turn (user message + assistant answer), idempotent on (thread_id, role, turn_hash).
          const body = JSON.stringify([...rows, { thread_id: tid, role: "assistant", content: assistantText.slice(0, 100_000) }]);
          jobs.push(fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/thread_messages?on_conflict=thread_id,role,turn_hash`, {
            method: "POST", headers: svcHeaders, body,
            signal: AbortSignal.timeout(8_000)
          }).then((r) => { if (!r.ok) console.error("turn persist failed:", r.status); }).catch(() => {}));
          const all = Promise.all(jobs);
          (globalThis as any).EdgeRuntime?.waitUntil?.(all);
        } catch (_e) { /* never break chat */ }
      };
    };
    buildPersistTurn(() => "");
    // v189 BACKEND ANALYTICS: fire-and-forget service-role inserts into analytics_events
    // (RLS deny-all table; only the service role can write). waitUntil so the insert
    // survives the response; analytics NEVER breaks chat (fail-open, logged only).
    const logAnalyticsEvent = (eventType: string, payload: Record<string, unknown>, model: string | null, creditsDelta: number) => {
      try {
        const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        if (!svcKey) return;
        const job = fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/analytics_events`, {
          method: "POST",
          headers: { "apikey": svcKey, "Authorization": `Bearer ${svcKey}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify({ user_id: userId || null, event_type: eventType, payload, model, credits_delta: creditsDelta }),
          signal: AbortSignal.timeout(6_000)
        }).then((r) => { if (!r.ok) console.error("analytics insert failed:", eventType, r.status); }).catch(() => {});
        (globalThis as any).EdgeRuntime?.waitUntil?.(job);
      } catch (_e) { /* never break chat on analytics */ }
    };
    logAnalyticsEvent("query", { purpose: String(purpose || ""), mode: requestMode || "legacy", words: String(userQuery).trim().split(/\s+/).filter(Boolean).length, complexity: String(intent?.complexity || "") }, null, 0);

    let intentOk = false; // v85: true only when the analyst returned parseable JSON with a boolean needs_search
    try {

      const intentRes = await fetch(callModelUrl, {
        method: "POST",
        headers: GW_HEADERS,
        body: JSON.stringify({ messages: [{ role: "system", content: "You are an intent analyst. Respond with ONLY valid JSON." }, { role: "user", content: intentPrompt }], purpose: "summary", max_tokens: 300 }),
        signal: AbortSignal.timeout(30_000)
      });
      const intentData = await intentRes.json();
      const intentText = intentData?.choices?.[0]?.message?.content || "{}";
      const jsonMatch = intentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { const parsedIntent = JSON.parse(jsonMatch[0]); intent = { ...intent, ...parsedIntent }; intentOk = typeof parsedIntent?.needs_search === "boolean"; } catch (e) {}
      }
    } catch (e) { /* use defaults */ }
    // v85 FAIL OPEN: the analyst runs on a ~1000 OTPM Groq lane that rate-limits under load. When it fails,
    // times out or returns garbage, default to SEARCH unless the query is obviously conversational.
    if (!intentOk) {
      const uq = String(messages[messages.length - 1]?.content || "").trim();
      const conversational = uq.length < 25 && !/\b(who|what|when|where|why|how|which|compare|vs|versus|is|are|does|do|can|will)\b|\?/i.test(uq);
      if (!conversational) intent.needs_search = true;
      // v87: estimate complexity too, so the planner can run when the analyst is down.
      if (uq.length > 100 || /compar|analy[sz]|evaluat|versus|\bvs\.?\b|strateg|decision|why should|trade-?offs?|pros and cons/i.test(uq)) intent.complexity = "complex";
    }
    progress?.end("analyze", "Analyzed your question");
    // v121 SLOHTF-class fix: the frontend always sends max_tokens:2048, capping even research-grade
    // (extreme) questions at ~8K chars in normal mode. Extreme-complexity queries now get the full
    // 4,000-token budget automatically — report-length answers without requiring the Deep Research toggle.
    // worse-elimination (2026-11-10): (1) a short reply that ANSWERS the assistant's own questions ("(1) yes ... (2) no ...") is a continuation of a
    // deliverable (#94: revised IRS letter), never a "simple" question; (2) a long multi-part ask classed "complex" (#75/#99: 80-130-word data-roadmap asks)
    // gets the same 4,000-token ceiling as "extreme" — the old 2,048 cap forced ~3K-char summaries of 13-18K-char asks.
    const clarifierContinuation = isClarifierAnswer(messages);
    if (clarifierContinuation && (intent.complexity === "simple" || intent.complexity === "medium")) intent.complexity = "complex";
    const queryWords = String(userQuery).trim().split(/\s+/).filter(Boolean).length;
    const longMultiPart = intent.complexity === "complex" && (isFollowUpDeliverable(String(userQuery), (messages || []).filter((m: any) => m?.role === "assistant").length) || queryWords >= 60 || (String(userQuery).match(/\?/g) || []).length >= 3 || clarifierContinuation);
    const tokenBudget = Math.min(Number(max_tokens) || 2048, (intent.complexity === "extreme" || longMultiPart) ? 4000 : 2048);
    // v103 I8: one deterministic plan decision per request (plan-guidance.ts). Drives (a) whether the tool loop is even offered record_plan,
    // (b) the writer-side "Plan" block when no tool-loop plan exists.
    const planDec = planDecision(String(userQuery), String(intent.complexity));

    // ============================================================
    // AGENT 1.5: IMAGE GENERATOR (Pollinations.ai — FREE, no API key)
    // ============================================================
    // Only generate when the user EXPLICITLY asks for a visual.
    // Auto-generating on every "needs_images" guess pollutes answers.
    const explicitImageRequest = /draw|paint|generate (an? )?(image|picture|photo|illustration)|image of|picture of|photo of|illustration of|diagram of|chart of|show me what .* looks like/i.test(userQuery);
    let imageUrl = null;
    if (intent.needs_images && explicitImageRequest) {
      try {
        // Generate an image based on the question
        const imagePrompt = encodeURIComponent(userQuery.slice(0, 200));
        imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}`;
        // Verify the image is accessible (don't download, just check)
        // We include the URL in the response; the client renders it
      } catch (e) { /* image generation failed, continue */ }
    }

    // ============================================================
    // AGENT 1.8: RESEARCH AGENT (live web retrieval — free, no API key)
    // ============================================================
    // Wikipedia + DuckDuckGo Instant Answers. Gives the writing agent real,
    // current facts and real source URLs to cite. If PERPLEXITY_API_KEY is set
    // as a function secret, the Perplexity Search API is used instead (best quality).
    const timeSensitive = /who won|latest|most recent|news|current|today|this (year|month|week)|score|standing|price of|weather|released|announced|report|data release|inflation|cpi|jobs report|20(2[4-9]|3\d)/i.test(userQuery);
    // PERSONAL-ADVICE questions ("What should I focus on this week?") are member
    // questions, NOT news queries — "this week" must not dump unrelated headlines.
    const personalAdvice0 = /should i|what should|focus on|prioriti|my (week|day|plan|goals?)|advice|recommend|help me (plan|decide|think)/i.test(userQuery);
    // v88: never trust needs_search=false for research-grade questions (complex/extreme, or analysis/comparison/data intents).
    const researchWorthy = intent.complexity === "complex" || intent.complexity === "extreme" || ["analysis", "comparison", "data_query", "status", "strategy"].includes(String(intent.intent));
    // CYCLE 2 GAP 1 (acronym disambiguation): an unfamiliar ALL-CAPS acronym ("largest SLOHTF loans") is exactly where the model's prior is wrong
    // (it answered Sound Transit's TIFIA loan). The analyst's "simple / needs_search=false" is overridden in code; the exact term is quoted for search.
    const unknownAcronyms = detectUnknownAcronyms(String(userQuery));
    // CYCLE 2 GAP 3b (legal research guard): "focus on the statutes in SC ... case law" matched personalAdvice ("focus on"), which switched
    // retrieval OFF for a statute / case-law question (#86: 0 sources). Legal-research questions always retrieve and are never personal advice.
    const legalStrong = /(?:\bstatutes?\b|\bcase[- ]?law\b|\bprecedents?\b|§|\bU\.?S\.?C\.?\b|\bC\.?F\.?R\.?\b|\b(?:S\.?C\.?|N\.?Y\.?|Cal\.?|Tex\.?|Fla\.?)\s+(?:Code|Stat)|\bappellate\b|\bsupreme court\b|\bcourt of appeals\b|\b(?:court|judge) (?:held|ruled)\b)/i.test(String(userQuery)) || /\b[A-Z][A-Za-z.]{2,} v\. [A-Z][A-Za-z.]{2,}/.test(String(userQuery));
    const legalResearch = legalStrong || /\b(?:code sections?|ordinances?|regulations?)\b/i.test(String(userQuery));
    if (unknownAcronyms.length) { intent.needs_search = true; if (intent.complexity === "simple") intent.complexity = "medium"; }
    if (legalResearch) intent.needs_search = true;
    if (legalStrong && (intent.complexity === "simple" || intent.complexity === "medium")) intent.complexity = "complex";
    // worse-elimination (2026-11-10): "should I" / "focus on" inside a long, research-grade ask (#75 "what other data should I be importing...",
    // #99 "I need us to REALLY focus on scanning...") is not a member-advice question; it switched retrieval OFF (0 sources, ~3K chars).
    // Personal-advice suppression now applies only to short / non-research asks.
    const longResearchAsk = (intent.complexity === "complex" || intent.complexity === "extreme") && String(userQuery).trim().split(/\s+/).filter(Boolean).length >= 25;
    const personalAdvice = personalAdvice0 && !legalResearch && !longResearchAsk;
    // SI-4: a self-contained code-writing request ("Write a Python function that merges intervals...") needs no web search; when the
    // intent analyst is down, the fail-open default sent it to retrieval (+12s) and hung irrelevant GitHub citations on code the model wrote itself.
    const pureCodeRequest = !timeSensitive && !imageAttach && /^\s*(?:please\s+)?(?:write|implement|create|code|generate|build|give me|show me|make)\b[^?]{0,80}\b(?:function|script|query|class|method|program|regex|regular expression|snippet|algorithm|unit tests?|sql|one-?liner|cli|component|endpoint|migration)\b/i.test(String(userQuery)) && !/\b(?:latest|newest|current(?:ly)?|docs?|documentation|release notes?|version|deprecated|api (?:key|limit|pricing)|price|compare|vs\.?|best (?:library|framework|tool)|blog|article|essay|report|summary|email|letter|post)\b/i.test(String(userQuery));
    if (pureCodeRequest) { intent.intent = "code"; intent.needs_search = false; if (intent.complexity === "complex" || intent.complexity === "extreme") intent.complexity = "medium"; }
    const researchWorthyEff = researchWorthy && !pureCodeRequest;
    let needsRetrieval = ((intent.needs_search || timeSensitive || researchWorthyEff) && !personalAdvice) || !!imageAttach;
    // v88: visible reason retrieval was skipped / degraded (surfaced in x_research + phases)
    let researchLane = "none";   // perplexity | free | none
    let zeroResultDiscard = false; // v98
    const slotEvidence = new Map<number, string>(); // v98: findings slot number -> evidence text (title + snippets)
    let citeAlign = { rebound: 0, dropped: 0, outlet_rebound: 0 };
    const slotUrlMap = new Map<number, string>(); // v128: marker number -> canonical URL (outlet <-> marker alignment)
    let researchSkip = needsRetrieval ? "" : (personalAdvice ? "personal_advice" : "analyst_no_search");
    let researchDetail = "";
    // v173 (owner report 2026-11-12, R1 incident): a pure acknowledgment or standing-rule
    // instruction is conversation management, not a research question — never burn a
    // web-search lane on it (the model searched MDN/tidyurls to "answer" a rule request).
    if (ACK_TURN_RE.test(String(userQuery).trim())) { needsRetrieval = false; researchSkip = "ack_turn"; }
    // FOLLOW-UPS: a bare "what about X?" / "why?" carries no topic. Merge the
    // prior user question so retrieval searches the CONVERSATION topic, not the
    // orphaned follow-up text (which produced WhatsApp/Doctor Who findings).
    const priorUserMsgs = messages.filter((mm: any) => mm.role === "user");
    const priorUserMsg = priorUserMsgs.length > 1 ? String(priorUserMsgs[priorUserMsgs.length - 2]?.content || "").slice(0, 160) : "";
    // v174 (owner report 2026-11-12): a pasted quote + status check ("HAS THIS BEEN
    // FIXED YET: <the earlier issue>") is a conversation follow-up too — merge prior
    // turns so retrieval and the writer carry the ORIGINAL issue's context, not a
    // literal Fly.io-docs search of the quote.
    const isStatusCheck = /\b(has this been|is this|are these|did you|have you|was it|were they)\b.{0,40}\b(fixed|done|resolved|shipped|deployed|updated|handled)\b/i.test(userQuery);
    // v180 (owner report 2026-11-12): "CAN YOU KEEP CLOSING ALL OF THESE ITEMS AUTONOMOUSLY?" web-searched
    // "sessions" (irrelevant MS/Oracle/VS Code docs). Phrases that point at the conversation's own list/doc
    // are CONTEXT REFERENCES: merge prior user turns like isStatusCheck and skip the web search entirely.
    const CONTEXT_REFERENCE = /\b(these|those|all of these|all these|the remaining|remaining)\s+(items?|tasks?|issues?|points?|gaps?)\b|\b(the|that|this)\s+(list|doc|document|checklist)\b|\b(keep|continue|finish)\s+(closing|going|fixing)\b|\bclose\s+the\s+remaining\b|\ball of these\b/i.test(String(userQuery));
    const priorUserCtx = priorUserMsgs.slice(-3, -1).map((mm: any) => String(mm?.content || "").slice(0, 160)).join(" ");
    const isBareFollowUp = userQuery.length < 70 || isStatusCheck || CONTEXT_REFERENCE || /^(what|how) about|and (what|why|how)|why (is|did|do)|so (what|why)|more on/i.test(userQuery.trim());
    const researchQuery0 = condenseSearchQuery(sanitizeSearchQuery(isBareFollowUp && priorUserMsg ? `${CONTEXT_REFERENCE && priorUserCtx ? priorUserCtx : priorUserMsg} ${userQuery}` : String(userQuery)) || String(userQuery), 400); // v92 I5: no backtick / %60 artifacts in search chips
    // cycle 2 gap 1: each unfamiliar acronym is searched as an exact quoted term ("SLOHTF" loans), with a hint to look up what it refers to.
    const researchQuery = unknownAcronyms.length ? (quoteAcronyms(researchQuery0, unknownAcronyms) + acronymSearchHint(unknownAcronyms)).slice(0, 460) : researchQuery0;
    const sourceSel = parseSourcesFilter(sources_filter);
    const searchF = buildSearchFilters(sourceSel, parseTimeRange(time_range));
    if (CONTEXT_REFERENCE && !imageAttach && priorUserMsg) { needsRetrieval = false; researchSkip = "context_reference"; } // v180: answer from conversation context, no web search on "items/sessions"
    if (searchF.filesOnly && !imageAttach) { needsRetrieval = false; researchSkip = "files_only"; }
    // v67 IMAGES TAB: image-intent questions get image search results too
    const imageIntent = /\b(image|images|photo|photos|picture|pictures|pic|pics|screenshot|diagram|map of|photos of|images of|look like|looks like|show me what)\b/i.test(researchQuery);
    let researchContext = "";
    let researchFindings: Array<{ title: string; url: string; extract: string }> = [];
    let visionFallbackUsed = false; // v170 D1: open-weight vision lane ran
    let perplexityUsed = false;   // hoisted to function scope: the tool-loop gate below reads it outside the retrieval block
    let perplexityFullText = ""; // v66: the live-search lane's full answer, passed uncut
    const subAgentLog: Array<{ n: number; q: string; ok: boolean }> = []; // v130: per-sub-question agent outcome (final phases)
    let subResearchCount = 0; // v84: number of planner sub-queries that returned research
    const todayForPlanner = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    let pImages: Array<{ image_url: string; origin_url: string; title: string }> = []; // v67 Images tab
    // v121: intentional skips (no retrieval needed) are NOT errors — say so truthfully instead of
    // the alarming "Live search unavailable (analyst_no_search)". Real failures keep the degraded wording.
    const SKIP_LABELS: Record<string, string> = { context_reference: "Answered from this conversation", analyst_no_search: "No web search needed for this question", personal_advice: "No web search needed for this question", files_only: "Answered from your attached files", agent_failed: "Live search unavailable (search service failed)", no_results: "Live search unavailable (no results found)", agent_empty: "Live search unavailable (search returned no content)", no_perplexity_key: "Live search unavailable (search not configured)", spend_ceiling: "Live search unavailable (monthly search budget reached)" };
    if (needsRetrieval) {
      progress?.begin("search", Deno.env.get("PERPLEXITY_API_KEY") ? "Searching multiple sources…" : "Searching the web…", "search");
      try {
        const findings: Array<{ title: string; url: string; extract: string }> = [];
        const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
        if (!perplexityKey) researchSkip = "no_perplexity_key";
        if (perplexityKey) {
          // Preferred: Perplexity Agent API (POST /v1/agent). The Sonar Chat
          // Completions API retired 2026-09-27 (requests are reformulated in the
          // meantime); the Agent API is the current surface and takes an EFFORT
          // LEVEL instead of a model. Route by the intent classifier's complexity:
          // simple lookups -> fast, everyday research -> low, complex/extreme ->
          // medium. (high/xhigh = Deep Research grade, minutes-long — never run
          // inline in the 30s research budget; that ships as the separate Deep
          // Research mode.) Web search is opt-in via the tools array.
          try {
            // v121 SPEED (owner directive 2026-11-10 "responses too slow"): ALL inline searches run
            // "fast" effort except extreme ("low"). Measured live: "fast" completes in ~3s where
            // "low" routinely took 13-49s on the Agent API for the same query shape. Depth for
            // complex questions comes from the sub-research lane (planner + parallel sub-queries),
            // not from a slow single "low" pass. (high/xhigh = Deep Research grade = separate mode.)
            const effort = intent.complexity === "extreme" ? "low" : "fast";
            // Spend cap: over the monthly ceiling, skip Perplexity and fall
            // through to the free sources below — the key never burns past it.
            const usage = await usageNow();
            if (usage.cost >= SPEND_CEILING_USD) {
              researchSkip = "spend_ceiling"; researchDetail = `used $${usage.cost} of $${SPEND_CEILING_USD}`;
              // fall through to free sources; do not call the paid API
            } else {
            // v85: one retry after 2s on failure / rate-limit / timeout (query is already trimmed to 400 chars).
            const agentCall = (timeoutMs: number, eff: string = effort, qOverride?: string) => fetch("https://api.perplexity.ai/v1/agent", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${perplexityKey}` },
              body: JSON.stringify({
                effort: eff,
                input: imageAttach
                  ? [{ type: "message", role: "user", content: [
                      { type: "input_text", text: (imageAttach.name ? `(${imageAttaches.length > 1 ? "Images" : "Image"} attached: ${imageNames}. ` : "(") + `Answer the user's question about ${imageAttaches.length > 1 ? "them" : "it"}.) ` + String(qOverride ?? researchQuery).slice(0, 460) },
                      ...imageParts
                    ] }]
                  : String(qOverride ?? researchQuery).slice(0, 460),
                // v67 IMAGES TAB: image-intent questions also run image search
                tools: imageIntent ? [webSearchTool(searchF), { type: "image_search" }] : [webSearchTool(searchF)]
              }),
              signal: AbortSignal.timeout(timeoutMs)
            });
            // v121 SPEED: tighter timeouts — a slow first call fails fast into the "fast"-effort retry
            // instead of burning 30-45s. (First call at the routed effort; retry always at "fast".)
            let pRes: Response | null = await agentCall(intent.complexity === "extreme" ? 30_000 : 18_000).catch((e) => { researchDetail = `first:${String(e).slice(0, 80)}`; return null; });
            if (!pRes || !pRes.ok) {
              if (pRes) researchDetail = `first:HTTP ${pRes.status}`;
              await new Promise((r) => setTimeout(r, 2000));
              // v88: the retry drops to "fast" effort — a long comparative prompt at "low" can exceed the timeout twice in a row
              pRes = await agentCall(12_000, "fast").catch((e) => { researchDetail += ` retry:${String(e).slice(0, 80)}`; return null; });
              if (pRes && !pRes.ok) researchDetail += ` retry:HTTP ${pRes.status}`;
            }
            if (!pRes || !pRes.ok) researchSkip = "agent_failed";
            if (pRes && pRes.ok) {
              const p = await pRes.json();
              // Agent API response: output[] items. "message" items carry the
              // answer text (content entries with type output_text); "search_results"
              // items carry the sources (results[] with url/title) — one per search
              // the model ran, so collect from ALL of them, not just the first.
              let pText = "";
              let pCitations: Array<{ title: string; url: string; id: number; snip?: string }> = [];
              const parseRun = (run: any) => {
                let t = "";
                const cites: Array<{ title: string; url: string; id: number; snip?: string }> = [];
                for (const item of (Array.isArray(run?.output) ? run.output : [])) {
                  if (item?.type === "message") {
                    for (const c of (Array.isArray(item?.content) ? item.content : [])) {
                      if (c?.type === "output_text" && c?.text) t += String(c.text);
                    }
                  } else if (item?.type === "search_results") {
                    for (const r of (Array.isArray(item?.results) ? item.results : [])) {
                      if (r?.url) cites.push({ title: String(r?.title || "Web source"), url: String(r.url), id: Number.isFinite(Number(r?.id)) ? Number(r.id) : cites.length + 1, snip: String(r?.snippet ?? r?.text ?? r?.content ?? r?.description ?? "").slice(0, 1500) });
                    }
                  } else if (item?.type === "image_search_results") {
                    // v67 IMAGES TAB: collect image results for the Images tab
                    for (const r of (Array.isArray(item?.results) ? item.results : [])) {
                      if (r?.image_url) pImages.push({ image_url: String(r.image_url), origin_url: String(r.origin_url || ""), title: String(r?.title || "") });
                    }
                  }
                }
                return { t, cites };
              };
              ({ t: pText, cites: pCitations } = parseRun(p));
              // v98 ZERO-RESULT RETRY (hou05): a run that returned text but ZERO search results ("Finished query, but no useful search results")
              // is unverified model knowledge. Retry once with a search-forcing reformulation; if still empty, discard the text
              // and fall through to the free sources instead of answering as if it were researched.
              if (pText && pCitations.length === 0 && !imageAttach && timeOk(75_000)) {
                researchDetail = (researchDetail ? researchDetail + " " : "") + "zero_results:retry";
                const retryRes = await agentCall(25_000, effort === "fast" ? "low" : effort, `Use web search and cite sources. Find current, specific facts for: ${String(researchQuery).slice(0, 300)}`).catch(() => null);
                if (retryRes && retryRes.ok) {
                  try { const rr = parseRun(await retryRes.json()); if (rr.cites.length) { pText = rr.t || pText; pCitations = rr.cites; researchDetail += ":recovered"; } } catch { /* keep first */ }
                }
                if (pCitations.length === 0) { pText = ""; zeroResultDiscard = true; researchSkip = "no_results"; }
              }
              if (!pText && !zeroResultDiscard) researchSkip = "agent_empty";
              if (pText) {
                // v83: the Agent API cites as [web:N], where N is a search_results id. Neither the
                // numbered-source list nor the [N] linker understood that form, so markers either
                // leaked as raw "[web:4]" text or pointed at the wrong source. Dedupe sources by URL,
                // number them (answer entry is [1], sources start at [2]), and rewrite the markers.
                // v128: ONE canonical index (buildSourceIndex) -> junk/canary hosts normalized or dropped, URLs deduped, sludge titles
                // replaced by the domain, and the [web:N] -> [N] map computed in the same pass. Sources are numbered from [1]
                // (the old synthetic "Perplexity Search (live web)" answer entry at [1] was citable by the writer and linked to source #2's URL).
                const sidx = buildSourceIndex(pCitations, { cap: 12, startAt: 1 });
                const uniqCites = sidx.uniq;
                const urlNum = { get: (u: string) => { const nu = normalizeSourceUrl(u); return nu ? sidx.urlNum.get(urlKey(nu)) : undefined; } };
                const answerEntryPresent = uniqCites.length === 0; // only the image-analysis case (no search results) keeps a single answer entry
                pText = rewriteWebMarkers(pText, sidx.idToNum); // [web:1][web:3] can map to one deduped source
                // v98: per-slot evidence (all snippets of every duplicate of the URL), then verify each figure's marker against it.
                for (const c of pCitations) { const n = urlNum.get(c.url); if (n) slotEvidence.set(n, ((slotEvidence.get(n) || "") + " " + c.title + " " + (c.snip || "")).trim()); }
                uniqCites.forEach((c, i) => { slotUrlMap.set(i + 1, c.url); });
                { const al = alignCitations(pText, slotEvidence); pText = al.text; citeAlign.rebound += al.rebound; citeAlign.dropped += al.dropped; }
                { const ao = alignOutlets(pText, slotUrlMap); pText = ao.text; citeAlign.outlet_rebound += ao.rebound; } // v128: outlet named in prose must match the marker's host
                // v66: pass the FULL live-search answer into the research context
                // (the old 1,500-char slice cut mid-sentence and the context builder's
                // first-segment split mangled it further — the writing agent then
                // reproduced broken text like "the3.7%" and run-on "Follow-ups").
                perplexityFullText = pText.slice(0, 6000);
                if (answerEntryPresent) findings.push({ title: imageAttach ? "Image analysis (vision)" : "Perplexity Search (live web)", url: pCitations[0]?.url || "https://www.perplexity.ai", extract: pText.slice(0, 4000) });
                uniqCites.forEach((c) => findings.push({ title: c.title, url: c.url, extract: "" }));
                perplexityUsed = true; researchLane = "perplexity"; researchSkip = "";
                await recUsage(EFFORT_COST[effort] ?? EFFORT_COST.low);
                // v84 REASONING DEPTH (A18): complex/extreme questions get a planner (one low-effort call -> 2-3
                // sub-queries) and the research lane runs on the top 2 in parallel. Hard wall-clock cap ~22s
                // (planner 6s + sub-queries 16s); any failure leaves the single-query result untouched.
                if ((intent.complexity === "complex" || intent.complexity === "extreme") && !imageAttach && timeOk(40_000)) {
                  try {
                    progress?.begin("sub", "Planning related sub-questions…", "search");
                    const subs = (await planSubQueries(callModelUrl, sanitizeSearchQuery(String(userQuery)), todayForPlanner)).slice(0, 2);
                    progress?.end("sub", subs.length ? `Planned ${subs.length} sub-question${subs.length === 1 ? "" : "s"}` : "No extra sub-questions needed");
                    if (subs.length) {
                      // v130: one named agent per sub-question (replaces the single aggregate row; old clients still render each as a plain row).
                      subs.forEach((q, si) => progress?.beginAgent(`research-${si + 1}`, `RESEARCH · ${agentTopic(q)}`, `Researching: ${agentTopic(q, 70)}…`, "search"));
                      const subUsage = await usageNow();
                      if (subUsage.cost + 2 * EFFORT_COST.low < SPEND_CEILING_USD) {
                        const subResults = await Promise.all(subs.map(async (q, si) => {
                          const sr0 = await runSubQuery(perplexityKey, sanitizeSearchQuery(q), "fast", 10_000, webSearchTool(searchF));
                          subAgentLog.push({ n: si + 1, q, ok: !!sr0 });
                          if (sr0) progress?.endAgent(`research-${si + 1}`, `Researched: ${agentTopic(q, 70)}`, { count: sr0.cites?.length || 0 });
                          else progress?.endAgent(`research-${si + 1}`, `No results: ${agentTopic(q, 70)}`, { failed: true });
                          return sr0;
                        }));
                        let added = 0;
                        subResults.forEach((sr, si) => {
                          if (!sr) return;
                          // v128: same canonical index as the main run (junk hosts normalized, URL-deduped, positional-id aware);
                          // sub-run sources are merged into the existing numbered slots by normalized URL.
                          const have = new Map<string, number>();
                          findings.forEach((f, i) => { if (!(answerEntryPresent && i === 0) && !have.has(urlKey(f.url))) have.set(urlKey(f.url), i + 1); });
                          const sidx2 = buildSourceIndex(sr.cites, { cap: 40, startAt: 1 });
                          const localToGlobal = new Map<number, number>();
                          sidx2.uniq.forEach((u, li) => {
                            let n = have.get(urlKey(u.url));
                            if (!n && findings.length < 18) { findings.push({ title: u.title, url: u.url, extract: "" }); n = findings.length; have.set(urlKey(u.url), n); slotUrlMap.set(n, u.url); }
                            if (n) localToGlobal.set(li + 1, n);
                          });
                          const idToNum2 = new Map<number, number>();
                          for (const [id, ln] of sidx2.idToNum) { const gn = localToGlobal.get(ln); if (gn) idToNum2.set(id, gn); }
                          for (const c of sr.cites) { const ln = sidx2.numOfCite(c); const n = ln ? localToGlobal.get(ln) : undefined; if (n) slotEvidence.set(n, ((slotEvidence.get(n) || "") + " " + c.title + " " + (c.snip || "")).trim()); }
                          let t2 = rewriteWebMarkers(sr.text, idToNum2);
                          { const al2 = alignCitations(t2, slotEvidence); t2 = al2.text; citeAlign.rebound += al2.rebound; citeAlign.dropped += al2.dropped; }
                          { const ao2 = alignOutlets(t2, slotUrlMap); t2 = ao2.text; citeAlign.outlet_rebound += ao2.rebound; }
                          t2 = t2.slice(0, 3500);
                          perplexityFullText += `\n\n### SUB-RESEARCH ${si + 1}: ${subs[si]}\n${t2}`;
                          added++;
                        });
                        if (added) { subResearchCount = added; await recUsage(EFFORT_COST.low * added); }
                      } else {
                        subs.forEach((_q, si) => progress?.endAgent(`research-${si + 1}`, "Skipped — spend ceiling", { failed: true }));
                      }
                    }
                  } catch (_e) { /* planner/sub-research failed — keep the single-query research */
                    for (const st of (progress?.steps ?? [])) if (st.agent && st.agent.startsWith("research-") && !st.done) progress?.endAgent(st.agent, "Stopped", { failed: true });
                  }
                }
              }
            }
            } // end spend-cap else
          } catch (e) { /* fall through to the free sources below */ }
        }
        if (!perplexityUsed) {
          // Free tier — pick the right source for the question type
          const addNewsFindings = async (arr: Array<{ title: string; url: string; extract: string }>, q: string) => {
            // Two sources for redundancy and better citations:
            // Google News RSS (broad) + Bing News RSS (direct article URLs — better markdown links)
            const sources = await Promise.allSettled([
              (async () => {
                const newsRes = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q.slice(0, 200))}&hl=en-US&gl=US&ceid=US:en`, { signal: AbortSignal.timeout(10_000) });
                if (!newsRes.ok) return [];
                const xml = await newsRes.text();
                return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6).map((m) => {
                  const title = (m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                  let link = (m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim().replace(/&amp;/g, "&");
                  // DECODE BING APICLICK: the real publisher URL rides in the url= query param
                  if (/bing\.com\/news\/apiclick/.test(link)) {
                    const target = link.match(/[?&]url=([^&]+)/);
                    if (target) { try { link = decodeURIComponent(target[1]); } catch { /* keep redirect */ } }
                  }
                  const pubDate = (m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
                  // Google News RSS carries the outlet in <source> — extract it so the
                  // model NAMES the publisher in the answer text instead of citing a
                  // bare news.google.com redirect with no attribution.
                  const outletName = (m[1].match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                  // The article links are ENCRYPTED redirects (AU_yqL tokens) — undecodable.
                  // But <source url="..."> carries the publisher's direct homepage URL.
                  // Cite the PUBLISHER directly instead of an opaque news.google.com link.
                  const outletUrl = (m[1].match(/<source url="([^"]+)"/)?.[1] || "").replace(/&amp;/g, "&");
                  if (/news\.google\.com\/rss\/articles/.test(link) && outletUrl) link = outletUrl;
                  const fullTitle = outletName && !title.toLowerCase().includes(outletName.toLowerCase()) ? `${outletName} — ${title}` : title;
                  return { title: fullTitle, url: link, extract: `${pubDate} — live headline from ${outletName || "Google News"}.` };
                });
              })(),
              (async () => {
                const bingRes = await fetch(`https://www.bing.com/news/search?q=${encodeURIComponent(q.slice(0, 200))}&format=rss`, { signal: AbortSignal.timeout(10_000) });
                if (!bingRes.ok) return [];
                const xml = await bingRes.text();
                return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map((m) => {
                  const title = (m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                  let link = (m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim().replace(/&amp;/g, "&");
                  // DECODE BING APICLICK: the real publisher URL rides in the url= query param
                  if (/bing\.com\/news\/apiclick/.test(link)) {
                    const target = link.match(/[?&]url=([^&]+)/);
                    if (target) { try { link = decodeURIComponent(target[1]); } catch { /* keep redirect */ } }
                  }
                  const pubDate = (m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
                  return { title, url: link, extract: `${pubDate} — live headline from Bing News (direct article URL).` };
                });
              })()
            ]);
            // BING FIRST: its decoded apiclick links are ARTICLE-level URLs; the
            // Google News items (after homepage substitution) are only publisher
            // homepages. Article-level citations are what the judge (and users)
            // expect, so the model should see and cite them first. Stable sort
            // below keeps this order and still pushes opaque redirects last.
            const bingItems = sources[1]?.status === "fulfilled" ? sources[1].value : [];
            const googleItems = sources[0]?.status === "fulfilled" ? sources[0].value : [];
            const all = [...bingItems, ...googleItems];
            // Dedup by URL. DIRECT publisher URLs first (clean citations); opaque
            // redirects (news.google.com/rss, bing.com/apiclick) last.
            const seen = new Set<string>();
            const deduped: Array<{ title: string; url: string; extract: string }> = [];
            for (const item of all) {
              if (!item.url || seen.has(item.url)) continue;
              seen.add(item.url);
              deduped.push(item);
            }
            const isOpaque = (u: string) => /news\.google\.com\/rss\/articles|bing\.com\/apiclick/.test(u);
            deduped.sort((a, b) => Number(isOpaque(a.url)) - Number(isOpaque(b.url)));
            arr.push(...deduped);
          };
          const cryptoMatch = researchQuery.match(/price of (bitcoin|ethereum|solana|dogecoin|xrp|ripple|cardano|litecoin)/i);
          const newsQuery = /latest|news|headline|today|this (week|month|year)|current|breaking|results|outcome|election|who won|rate|rates|average/i.test(researchQuery);
          const fedQuery = /fed|fomc|interest rate|federal reserve/i.test(researchQuery);
          // "Who won X" and ELECTION-RESULT questions: news RSS carries today's
          // headlines, not final scores or seat counts. Wikipedia's event article
          // has the result. Fetch full article text (not summaries) and put it
          // FIRST so it survives the findings cap.
          const whoWonQuery = /who won|winner of|final score|who (scored|played)|what was the (score|result)|champion/i.test(researchQuery);
          const electionQuery = /election|midterm|senate|house (races|seats)|governor race/i.test(researchQuery);
          const coinIds: Record<string, string> = { bitcoin: "bitcoin", ethereum: "ethereum", solana: "solana", dogecoin: "dogecoin", xrp: "ripple", ripple: "ripple", cardano: "cardano", litecoin: "litecoin" };

          if (cryptoMatch) {
            const coin = coinIds[cryptoMatch[1].toLowerCase()] || "bitcoin";
            try {
              const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd&include_24hr_change=true`, { signal: AbortSignal.timeout(8_000) });
              if (cgRes.ok) {
                const cg = await cgRes.json();
                const p = cg?.[coin];
                if (p?.usd) findings.push({ title: "CoinGecko live price", url: `https://www.coingecko.com/en/coins/${coin}`, extract: `Current price: ${p.usd} USD (US dollars), fetched at ${new Date().toISOString()} UTC. 24h change: ${p.usd_24h_change ?? "n/a"}%. (Live data from the CoinGecko API just now.)` });
              }
            } catch (e) { /* skip coingecko */ }
            await addNewsFindings(findings, `${cryptoMatch[1]} price`);
          } else if (newsQuery || fedQuery || whoWonQuery || electionQuery) {
            // FED/FOMC FIRST: the Federal Reserve's own press-release feed is the
            // authoritative source for rate decisions, and it must occupy the first
            // findings slots — news RSS items used to fill the cap and slice it out.
            if (fedQuery) {
              try {
                const fedRes = await fetch("https://www.federalreserve.gov/feeds/press_all.xml", { signal: AbortSignal.timeout(10_000) });
                if (fedRes.ok) {
                  const xml = await fedRes.text();
                  const fedItems = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5).map((m) => {
                    const t = (m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
                    const d = (m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
                    const l = (m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "https://www.federalreserve.gov/newsevents/pressreleases.htm";
                    return { title: t, url: l, extract: `${d} — official Federal Reserve press release.` };
                  });
                  // FOMC STATEMENT: fetch the actual statement and extract the
                  // target-range sentence (the judge demands the exact range).
                  const fomc = fedItems.find((f) => /fomc statement/i.test(f.title));
                  if (fomc && /federalreserve\.gov/.test(fomc.url)) {
                    try {
                      const stRes = await fetch(fomc.url, { signal: AbortSignal.timeout(10_000) });
                      if (stRes.ok) {
                        const page = (await stRes.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
                        const m2 = page.match(/[^.]*target range[^.]*\./i);
                        if (m2) fomc.extract = `OFFICIAL FOMC STATEMENT: ${m2[0].trim()} Also: ${fomc.extract}`;
                      }
                    } catch (e) { /* statement fetch failed — keep title/date */ }
                  }
                  findings.push(...fedItems);
                }
              } catch (e) { /* skip fed feed */ }
            }
            // News questions get live headlines, NOT Wikipedia (which has no "latest")
            await addNewsFindings(findings, researchQuery);
            if (whoWonQuery || electionQuery) {
              // Wikipedia event articles carry final scores and seat counts that
              // news RSS misses. Search with QUESTION FILLER STRIPPED — "who won
              // ... what was the final score?" or "most recent results of" filler
              // deranks the specific event article.
              const yearMatch = researchQuery.match(/20\d{2}/);
              const cleanQ = researchQuery
                .replace(/who won|winner of|what was the|what were the|most recent|results? of|final score|who (scored|played)|what was|tell me|please|held in|latest on|\?|!|,/gi, " ")
                .replace(/\s+/g, " ").trim().slice(0, 200);
              try {
                const wsRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ || userQuery.slice(0, 200))}&srlimit=4&format=json`, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(10_000) });
                if (wsRes.ok) {
                  const wsData = await wsRes.json();
                  const wTitles: string[] = (wsData?.query?.search || []).map((s: { title: string }) => s.title).slice(0, 3);
                  const wItems: Array<{ title: string; url: string; extract: string }> = [];
                  for (const t of wTitles) {
                    try {
                      const exRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exlimit=1&titles=${encodeURIComponent(t)}&format=json`, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(10_000) });
                      if (!exRes.ok) continue;
                      const exData = await exRes.json();
                      const pages: any = exData?.query?.pages || {};
                      const page: any = Object.values(pages)[0] || {};
                      const text = String(page?.extract || "");
                      if (text) wItems.push({ title: `Wikipedia — ${t}`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(t)}`, extract: text.slice(0, 2500) });
                    } catch (e) { /* skip page */ }
                  }
                  // The event article that MATCHES THE YEAR ASKED ABOUT comes first
                  if (yearMatch) {
                    wItems.sort((a, b) => Number(b.extract.includes(yearMatch[0])) - Number(a.extract.includes(yearMatch[0])));
                  }
                  // ELECTION OVERVIEW FIRST: "who controls the House/Senate" needs the
                  // national overview article ("2026 United States elections"), not a
                  // single state race the generic search happens to rank first.
                  if (electionQuery && yearMatch) {
                    try {
                      const ovRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(yearMatch[0] + " United States elections")}&srlimit=2&format=json`, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(10_000) });
                      if (ovRes.ok) {
                        const ovData = await ovRes.json();
                        const ovTitles: string[] = (ovData?.query?.search || []).map((x: { title: string }) => x.title).filter((t: string) => /united states (house |senate |gubernatorial )?elections/i.test(t)).slice(0, 2);
                        const ovItems: Array<{ title: string; url: string; extract: string }> = [];
                        for (const t of ovTitles) {
                          try {
                            const exRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exlimit=1&titles=${encodeURIComponent(t)}&format=json`, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(10_000) });
                            if (!exRes.ok) continue;
                            const exData = await exRes.json();
                            const pages: any = exData?.query?.pages || {};
                            const page: any = Object.values(pages)[0] || {};
                            const text = String(page?.extract || "");
                            if (text) ovItems.push({ title: `Wikipedia — ${t}`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(t)}`, extract: text.slice(0, 3000) });
                          } catch (e) { /* skip */ }
                        }
                        if (ovItems.length) wItems.unshift(...ovItems);
                      }
                    } catch (e) { /* skip overview search */ }
                  }
                  // Wikipedia FIRST — it has the final score; headlines are supporting context
                  findings.unshift(...wItems);
                }
              } catch (e) { /* skip wikipedia */ }
            }
          } else {
          // Entity/factual questions: Wikipedia search + summaries
          const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(sanitizeSearchQuery(String(userQuery)).slice(0, 200))}&srlimit=3&format=json`;
          const wikiRes = await fetch(wikiSearchUrl, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(10_000) });
          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            let titles = (wikiData?.query?.search || []).map((s: { title: string }) => s.title).slice(0, 3);
            // v88: long analytical prompts match nothing as a phrase — retry with the key terms (analyst topics, else capitalised entities / acronyms+numbers)
            if (!titles.length) {
              const topicTerms = Array.isArray(intent.topics) ? (intent.topics as unknown[]).map((t) => String(t)).slice(0, 4).join(" ") : "";
              const entityTerms = (userQuery.match(/\b(?:[A-Z][a-zA-Z]+(?: [A-Z0-9][a-zA-Z0-9]*)*|[A-Z]{2,}\s?\d*)\b/g) || []).filter((w: string) => w.length > 2).slice(0, 6).join(" ");
              const kw = (topicTerms || entityTerms).slice(0, 150);
              if (kw) {
                try {
                  const w2 = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(kw)}&srlimit=3&format=json`, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(10_000) });
                  if (w2.ok) titles = ((await w2.json())?.query?.search || []).map((x: { title: string }) => x.title).slice(0, 3);
                } catch { /* keep empty */ }
              }
            }
            for (const t of titles) {
              try {
                const sumRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`, { headers: { "User-Agent": "ai-spaincos-gateway/1.0 (research agent)" }, signal: AbortSignal.timeout(8_000) });
                if (!sumRes.ok) continue;
                const sum = await sumRes.json();
                if (sum?.extract) findings.push({ title: t, url: sum?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(t)}`, extract: String(sum.extract).slice(0, 700) });
              } catch (e) { /* skip page */ }
            }
          }
          // DuckDuckGo Instant Answers
          try {
            const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(userQuery.slice(0, 200))}&format=json&no_html=1`, { signal: AbortSignal.timeout(8_000) });
            if (ddgRes.ok) {
              const ddg = await ddgRes.json();
              if (ddg?.AbstractText) findings.push({ title: ddg?.Heading || "DuckDuckGo", url: ddg?.AbstractURL || "", extract: String(ddg.AbstractText).slice(0, 500) });
              (ddg?.RelatedTopics || []).slice(0, 2).forEach((rt: { Text?: string; FirstURL?: string }) => {
                if (rt?.Text && rt?.FirstURL) findings.push({ title: "DuckDuckGo", url: rt.FirstURL, extract: String(rt.Text).slice(0, 250) });
              });
            }
          } catch (e) { /* skip ddg */ }
          }
        }
        if (findings.length && !perplexityUsed) researchLane = "free";
        if (findings.length) {
          // v128: every lane (perplexity / news RSS / wiki / DDG) passes the same gate before numbering: junk/canary hosts are
          // normalized or dropped, duplicates collapse by normalized URL, sludge titles fall back to the domain. The perplexity lane is
          // already canonical, so this is a no-op there and numbering never shifts under the [N] markers it produced.
          {
            const seenK = new Set<string>(); const canon: typeof findings = [];
            for (const f of findings) {
              const nu = normalizeSourceUrl(f.url); if (!nu) continue;
              const k = urlKey(nu); if (seenK.has(k)) continue; seenK.add(k);
              canon.push({ ...f, url: nu, title: /^(Perplexity Search \(live web\)|Image analysis \(vision\))$/.test(f.title) ? f.title : cleanSourceTitle(f.title, nu) });
            }
            findings.length = 0; findings.push(...canon);
          }
          researchFindings = findings.slice(0, subResearchCount ? 18 : 12);
          // v66: the live-search lane's full answer goes in UNTRUNCATED — the
          // numbered-finding lines below stay for citation numbering, but the
          // writing agent now sees the complete text (no mid-sentence cuts).
          if (perplexityFullText) {
            researchContext += `\n\n=== LIVE SEARCH ANSWER (FULL TEXT) — YOUR PRIMARY SOURCE. Build the answer from it: keep every figure, date, name and its [N] marker (the markers match the numbered sources below); restructure and sharpen, never drop facts or add unsupported ones. ===\n${perplexityFullText}\n`;
            if (subResearchCount) researchContext += `\n=== MULTI-ANGLE RESEARCH ===\nThe LIVE SEARCH ANSWER above contains the main answer plus ${subResearchCount} SUB-RESEARCH section(s) on distinct facets of the question. SYNTHESIZE ACROSS ALL of them: connect the facets, resolve any disagreement between them, and draw a conclusion that no single section states on its own — do not just concatenate sections.\n`;
          }
          researchContext += `\n\n=== RESEARCH AGENT — LIVE WEB FINDINGS (NUMBERED SOURCES) ===\n` +
            researchFindings.map((f, i) => `[${i + 1}] ${f.title} (${hostOf(f.url)})${f.extract ? ` — ${f.extract.split(" — ")[0]}` : ""}`).join("\n") +
            `\n\nCITATION RULE (NON-NEGOTIABLE): every current/news fact you state MUST carry its source number as an inline marker — for example: "The Fed held rates steady [1]." Use [N] markers exactly as numbered above. The host in parentheses after each title is the publisher: when you name an outlet in the text (for example Washington Post, NYT, BBC), the [N] beside it MUST be a source whose host is that outlet - never attach another publishers number to it, and never name an outlet that is not in the list. Never state a news or current fact without its [N] marker. Never claim "live" or "just pulled" data without markers. State every concrete figure the findings contain (rates, scores, percentages, outcomes) WITH its [N] citation — never decline to give a figure that appears in the findings. When you cite a source, NAME the outlet/publisher in the answer text (for example: \"according to Reuters [2]\") — never leave a bare marker on an unnamed redirect. PREFER citing the specific article-level URLs in the findings over bare publisher homepages — when both exist for a claim, cite the article URL. When summarizing multiple news stories in a list, cover at most 6 items, COMPLETE every item (never cut a list mid-entry), and never end the answer mid-list. EVERY bullet in a news-summary list must carry a specific dated fact — the event, its date, and a concrete number or name — never a generic topic-only bullet. If the findings genuinely do not answer the question, answer from your own knowledge without guessing current facts — and NEVER mention the findings, your sources, or your retrieval process in the answer (no commentary about which sources were or weren't relevant); just answer the question directly.`;
        }
        // v170 D1 FIX (open-weight vision lane): the Perplexity Agent API lane is the
        // primary image analyst, but it is flaky (~30% failure on live tests 2026-11-12:
        // timeouts, agent ignoring the image, or text-search fallback with garbage
        // citations). When an image was attached and the primary lane did NOT produce
        // an image-analysis finding, run our own multimodal call through call-model
        // (llama-4-maverick: natively multimodal, on the PAID_MODEL_ALLOWLIST, verified
        // live) and inject the description as the image-analysis finding. Only when
        // BOTH lanes fail does the honest "NOT ANALYZED" note appear.
        if (imageAttach && !findings.some((f) => f.title === "Image analysis (vision)")) {
          const VISION_FALLBACK_MODEL = Deno.env.get("ROUTE_VISION_FALLBACK_MODEL") || "meta-llama/llama-4-maverick";
          try {
            const vParts: Array<Record<string, unknown>> = [{ type: "text", text: `Describe these attached image(s) factually and completely for answering the user's question: objects, people, text visible in the image (transcribe it), colors, numbers, layout, context. Never guess beyond what is visible. User question: ${String(researchQuery || userQuery || "").slice(0, 400)}` }];
            for (const im of imageAttaches.slice(0, 3)) vParts.push({ type: "image_url", image_url: { url: im.data_url } });
            const vRes = await fetch(callModelUrl, {
              method: "POST",
              headers: GW_HEADERS,
              body: JSON.stringify({
                messages: [{ role: "user", content: vParts }],
                purpose: "vision",
                model: VISION_FALLBACK_MODEL,
                max_tokens: 1200,
                reasoning_effort: "low"
              }),
              signal: AbortSignal.timeout(45_000)
            });
            const vD = await vRes.json().catch(() => null);
            const vText = String(vD?.choices?.[0]?.message?.content || "").trim();
            if (vRes.ok && vText && vText.length > 3) {
              findings.push({ title: "Image analysis (vision)", url: "https://ai.spaincos.com", extract: vText.slice(0, 4000) });
              researchContext += `\n\n=== IMAGE ANALYSIS (OPEN-WEIGHT VISION LANE) ===\n${vText.slice(0, 6000)}\nUse this ground-truth description to answer the user's question about the attached image${imageAttaches.length > 1 ? "s" : ""}. Cite it as source [${findings.length}] when you state what the image shows.`;
              visionFallbackUsed = true;
            } else {
              researchDetail = (researchDetail ? researchDetail + " " : "") + `vision_fallback:${vRes.status}`;
            }
          } catch (e) {
            researchDetail = (researchDetail ? researchDetail + " " : "") + `vision_fallback_err:${String((e as Error)?.message || e).slice(0, 80)}`;
          }
        }
        if (imageAttach && !perplexityUsed && !visionFallbackUsed) {
          // The image reached the gateway but NEITHER vision lane could run
          // (no PERPLEXITY_API_KEY, over the spend cap, or both calls failed).
          // Tell the user plainly — never guess at an image's contents.
          researchContext += `\n\n=== ATTACHED IMAGE (NOT ANALYZED) ===\nThe user attached ${imageAttaches.length > 1 ? imageAttaches.length + " images" : "an image"} (${imageNames}), but image analysis is unavailable on this request. Say so plainly in one short sentence and answer whatever part of the question you can from text alone. NEVER describe or guess at the image's contents.`;
        }
      } catch (e) { /* research failed — continue without */ }
      const searchPhaseLabel = researchFindings.length ? `Searched the web — ${researchFindings.length} sources` : (SKIP_LABELS[researchSkip] || `Live search unavailable${researchSkip ? ` (${researchSkip})` : ""}`);
      progress?.end("search", searchPhaseLabel, { count: researchFindings.length, ...(researchFindings.length ? { items: canonicalSourceItems(researchFindings, 18) } : {}) }); // v128: items = the one canonical list
    }

    // ============================================================
    // AGENT 2: CEO SYSTEM PROMPT (adaptive — no context pollution)
    // ============================================================
    // Only inject Brett's ecosystem context when the question is actually
    // about his system. General questions get a clean expert prompt so
    // answers don't leak internal data or off-topic follow-ups.
    const systemKeywords = /comptrove|rentspire|spaincos|spain companies|spain terminal|shmt|spain-runner|spain runner|the gateway|ai\.spaincos|property_facts|rent observ|my (data|system|terminal|connections|ux|site|app|portfolio|propert(y|ies)|rents|products|companies|infrastructure|jobs|runner|pipelines)|the (terminal|data universe|runner)|this ux|bulk job|what .{0,30}(infrastructure|jobs?|pipelines?) do i have|harvest|our (data|systems?|platform)/i;
    const ADMIN_EMAIL = "bspain@spaincos.com";
    const isAdmin = userEmail === ADMIN_EMAIL;
    // 2026-11-07 FIX: isAdmin no longer force-injects the ecosystem prompt on
    // EVERY question — that leaked Comptrove into unrelated answers (CPI follow-ups
    // citing "your own Comptrove dataset"). The system prompt now applies only
    // when the question is actually about the user's system; the per-user context
    // block (their account, assets, ingested email) still always applies.
    const isSystemQuestion = systemKeywords.test(userQuery) || messages.some(m => typeof m.content === "string" && systemKeywords.test(m.content));

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const generalSystemPrompt = `You are an expert research assistant serving one authenticated member on a private platform. Your bar is the best answer a top analyst could give: correct, specific, and immediately usable.

TODAY'S DATE: ${todayStr}. Use this for every time-sensitive judgment — never claim a dated event "has not happened yet" if its date is before today.

How to answer:
- The first sentence is the direct answer, carrying the key figure, name, or verdict. No preamble, no title heading that repeats it, no restating the question.
- Be specific: exact numbers with units and dates, named entities, concrete ranges ("3.75%–4.00% as of Nov 5", not "rates were cut"). If sources disagree, say which and why.
- For comparisons, calculations, and recommendations: state the key assumptions and the arithmetic, then commit to a clear recommendation. Do not hedge when the evidence supports a conclusion; say plainly what is uncertain and what would settle it.
- Structure tightly: short paragraphs; ## headings only when the answer has three or more distinct parts; tables for comparisons; bullets for parallel items; bold only for the few terms or figures that matter. Match length to the question — a simple fact gets one to three sentences plus any needed detail; analysis gets a thorough structured breakdown. No filler, no repetition, no closing recap of the body.
- FORMAT FOR SCANNING (owner requirement 2026-11-12): never dense paragraph walls. Any answer longer than two short paragraphs must break into structure: a one-line direct answer up top, then bulleted lists for parallel items and numbered steps (1. 2. 3.) for anything sequential or procedural. Use emoji markers to signpost sections when there are 3+ sections (🔍 Findings, 📊 Figures, ⚠️ Risks, ✅ Actions, ➡️ Next) and to lead major bullets where it aids scanning — sparingly, never mid-sentence. Code always in triple-backtick fences, never ''' quotes. URLs verbatim, never re-encoded.
- Never invent facts, statistics, quotes, or sources. When a LIVE SEARCH ANSWER or NUMBERED SOURCES appear below, they are your ground truth for current facts: build from them and keep their [N] markers inline. Otherwise include links only when you are confident they exist.
- NEVER REFUSE WITH HOMEWORK: never answer "I can't do X from here" / "I don't have access to X" as the end of your reply. First do everything within reach — and when the task is an action you cannot run yourself, deliver the complete, ready-to-apply result (exact file contents, patch, command, or filled-in copy) as the executed fallback. Every limitation you state must be paired with the fallback you have ALREADY produced, never a to-do list for the user.
- Never discuss your reasoning, "intents", or system internals — just answer.
- CAPABILITIES: this TURN carries no live tools, but the platform HAS them: run_python code execution (numpy/pandas/matplotlib), web search, page fetch, and connector tools (Gmail/Calendar/Drive/Slack/GitHub/Dropbox/Render/Supabase) — they activate automatically on turns that need them. If the user asks whether you can execute code, run Python, connect to services, or use tools: answer YES, the platform has these, and suggest asking the task itself (e.g. "compute X" or "read my email") so the tools engage. Never claim the platform has no execution or tools — that is factually wrong and the worst answer this system can give.
- AUTONOMY TRUTH (owner directive 2026-11-12): when the user asks what you can handle autonomously (e.g. "which of these can you handle?"), NEVER answer "none" and never dump paste-ready homework as the substitute. Enumerate what the platform can actually execute from the live catalog the system message provides (web research, run_python, browser control, document read/create, connector tools, Comptrove property/rent database queries, fleet dispatch), split the user's items into "I will run this now" vs "needs a platform-external step", and EXECUTE the runnable ones in this same turn where possible. Only the genuinely external steps (e.g. a vendor console with no connector) get handed to the user — each with its direct URL per the standing rule below. "I have no live database connection" is FALSE for read queries (query_comptrove + Supabase connector tools) — use them.
- CONTEXT MEMORY (owner report 2026-11-12): the user often pastes or quotes an earlier message, issue, or error and asks a follow-up about it ("HAS THIS BEEN FIXED YET: <quote>", "what about the X error", "is the Y bug resolved?"). The pasted quote and the conversation history ARE the context. NEVER claim you "cannot determine what the quoted fragment refers to" when the text appears in the user's own message or earlier in the conversation — reread them and answer about that specific item, including its current live status when a tool or system note provides it. If something referenced is genuinely absent from the conversation, ask ONE targeted question naming exactly what is missing.
- STANDING RULE — DIRECT URLS (owner directive 2026-11-12, standing): whenever you instruct the user to paste or enter something on a website, update a secret/API key, or change a setting in any console or dashboard, ALWAYS include the DIRECT URL of the exact page in the same breath (e.g. Supabase secrets: https://supabase.com/dashboard/project/_/settings/functions; Stripe keys: https://dashboard.stripe.com/apikeys; GitHub: the exact repo/PR URL). If you are not certain of the exact path, give the closest known URL and say what to click from there. NEVER make the user hunt for a settings page you sent them to.
- Do not volunteer disclaimers about data you lack; mention limits only when asked or truly essential.
- Ground the answer in the research: name the specific figures, dates, and entities it contains (e.g. "3.75%–4.00% as of Nov 5", "Fed Chair ...") rather than vague summaries; every number you state should carry its source marker when one exists.
- Work out arithmetic silently and show only the final, correct figures. Never leave visible self-corrections in the answer ("actually that's wrong", "wait", "let me recompute", "scratch that").
- ${ACRONYM_WRITER_RULE}
- Credentials: never output a database connection string, API key, token, password or other secret, even if one appears earlier in the conversation; say it is withheld and show a placeholder like <YOUR_DATABASE_URL> instead.
- Citations: put an [N] marker only on a claim that numbered source N actually states. Never put [N] markers inside code blocks or inline code, and do not cite for code you wrote yourself or for general knowledge no source covers. If the sources do not cover what was asked, say so plainly instead of citing loosely related pages.
- End with "## Suggested Follow-ups": 3-4 short, specific, ACTIONABLE next-step commands (imperative, runnable as queries — never questions) that name concrete entities or figures from your answer.
- Write in the same language the user used.`;

    const ceoSystemPrompt = isSystemQuestion
      ? `You are the senior AI assistant for ai.spaincos.com — an expert on this organization's systems. You mirror the best of Anthropic Claude, OpenAI GPT, and Perplexity.

=== USER'S SYSTEM (COMPLETE CONTEXT) ===
Brett Spain — founder of Spain Companies LLC. Products: Comptrove (rent-comparison), RentSpire (housing software), Spain Terminal (SHMT), ai.spaincos.com (this gateway).

INFRASTRUCTURE:
- ai.spaincos.com: this gateway (Vercel, GitHub: rentspire-bspain/ai-gateway-site)
- Supabase bnxermyboeigvwonfrzx: auth
- Supabase dcyjmftriqayqaonitlx: THE DATA (Comptrove, 5.5M property_facts, 30.9M observations)
- Fly.io spain-runner: bulk jobs (no 2-min timeout)
- GitHub org rentspire-bspain: SHMT, ai-gateway-site, rentspire-comps

DATA UNIVERSE:
- 588,746 properties (2026), 13.76M observations, 1.4M URLs, median rent $1,956
- 30.9M total observations (1997-2026)
- hist.property_facts: 5.5M rows
- Gaps: ZIP (228K filled), unit_count_hint (5.3M missing, runner job created), amenities, photos

When the user says "this UX," "the terminal," "my connections," "Comptrove," "the data," or similar — they mean THEIR OWN system.

=== STANDARDS (NON-NEGOTIABLE) ===
1. Ground every claim in the user's actual system data above. If you don't know, say so — never guess.
2. Lead with the direct answer, then the complete supporting breakdown. No filler, no repetition.
3. Use specific numbers and data from the user's system — exact figures, not approximations.
4. Perfect markdown: clear ## and ### headings, double line breaks between paragraphs (NEVER jumbled), proper lists, tables where appropriate, bold for key terms.
5. End with "## Suggested Follow-ups" — 3-4 SPECIFIC, contextual questions.
6. Do NOT discuss yourself, your "agents", "classifiers", or reasoning process. Just deliver the answer.
   NEVER REFUSE WITH HOMEWORK: never end with "I can't do X from here". Pair every limitation with the fallback you already produced (complete ready-to-apply file contents, patch, command, or filled-in copy) — not a to-do list for the user.
7. Only reference the user's systems, data, or products when the question actually concerns them — NEVER shoehorn them into unrelated answers (news, general knowledge, math), never append "relevance to your data" sections unprompted, and NEVER put them in the Suggested Follow-ups of an unrelated answer.
8. ${ACRONYM_WRITER_RULE}
9. Never output a database connection string, API key, token, password or other secret, even if one appears earlier in the conversation — say it is withheld and show a placeholder like <YOUR_DATABASE_URL>.`
      : generalSystemPrompt;

    // v63 SPACES: per-space custom instructions (like Perplexity Projects).
    // The frontend sends the active space's instructions with each request;
    // they ride the system prompt as a distinct block the writing agents honor.
    const spaceInstructions = typeof space_instructions === "string" && space_instructions.trim() ? space_instructions.trim().slice(0, 2000) : "";
    const spaceBlock = spaceInstructions
      ? `\n\n=== SPACE / PROJECT INSTRUCTIONS ===\nThe user saved the following custom instructions for this space. Honor them for tone, format, emphasis, and scope wherever they do not conflict with the non-negotiable standards above.\n---\n${spaceInstructions}\n---`
      : "";

    const scopeBlock = searchF.filesOnly ? "\n\n=== SOURCE SCOPE ===\nThe member limited this question to THEIR OWN FILES/DATA. Answer only from the member context above; if it is insufficient, say precisely what is missing instead of using outside knowledge." : (searchF.domains.length ? "\n\n=== SOURCE SCOPE ===\nWeb research was limited to " + (sourceSel.includes("academic") && sourceSel.includes("finance") ? "academic and financial" : sourceSel.includes("academic") ? "academic" : "financial") + " sources" + (searchF.recency ? `, ${searchF.recency === "day" ? "past 24 hours" : "past " + searchF.recency}` : "") + "." : (searchF.recency ? `\n\n=== TIME WINDOW ===\nWeb research was limited to the past ${searchF.recency === "day" ? "24 hours" : searchF.recency}.` : ""));
    const messagesWithContext = [{ role: "system", content: buildMemberProfile(personalization) + ceoSystemPrompt + "\n\n" + EXECUTION_STANDARD + userContextBlock + spaceBlock + scopeBlock + researchContext }, ...messages];

    // ============================================================
    // AGENT 3: WRITING AGENT (produces the structured response)
    // ============================================================
    // v83: (a) slice(-21) on [system, ...messages] DROPPED the system prompt + research once a thread passed
    // 20 messages — keep the system message pinned and window only the conversation; (b) the 4,000-char cap
    // applied to the system message too, so persona + user context + research (up to 6,000 chars of live
    // answer alone) was cut mid-text and the numbered sources and citation rule at its END were lost.
    // System messages get a 20,000-char cap; user/assistant turns keep 4,000.
    const capped = [messagesWithContext[0], ...messagesWithContext.slice(1).slice(-20)].map((m) => {
      const role = m.role === "assistant" || m.role === "user" || m.role === "system" ? m.role : "user";
      return { role, content: String(m.content || "").slice(0, role === "system" ? 20_000 : 4000) };
    });

    // ============================================================
    // v83 ANSWER-OF-LAST-RESORT HELPERS
    // ============================================================
    // The user must never see "(no response from model)" when the research lane already produced text.
    // researchFallbackText(): the live-search answer itself (already marker-normalised to [N]); or, for the
    // free-source path (Wikipedia / news RSS / CoinGecko), a compact digest of the findings. Citations are
    // linked downstream (linkCitationsSSE / the NUMBERED CITATIONS block), so [N] markers are left bare here.
    const researchFallbackText = (): string => {
      if (perplexityFullText.trim()) return perplexityFullText.trim();
      const rows = researchFindings
        .map((f, i) => ({ f, i }))
        .filter(({ f }) => f.extract && f.extract.trim())
        .slice(0, 8)
        .map(({ f, i }) => `- **${f.title}** — ${String(f.extract).replace(/\s+/g, " ").trim().slice(0, 600)} [${i + 1}]`);
      return rows.length ? rows.join("\n") : "";
    };
    // Reliable-model rewrite when there is no research text: DeepSeek V4.1 Flash is call-model's own eval-pinned
    // general model (74.2% on the housing-finance eval; non-reasoning-first, rarely empty). Override with FALLBACK_MODEL.
    const RELIABLE_MODEL = Deno.env.get("FALLBACK_MODEL") || "deepseek/deepseek-v4.1-flash-1017";
    const reliableModelAnswer = async (): Promise<string> => {
      if (finalModel === RELIABLE_MODEL) return "";
      try {
        const r = await fetch(callModelUrl, {
          method: "POST",
          headers: GW_HEADERS,
          body: JSON.stringify({ messages: capped, purpose, model: RELIABLE_MODEL, reasoning_effort: "low", max_tokens: 2048 }),
          signal: AbortSignal.timeout(45_000)
        });
        const d = await r.json();
        return String(d?.choices?.[0]?.message?.content || "").trim();
      } catch { return ""; }
    };
    const lastResortAnswer = async (): Promise<string> => researchFallbackText() || await reliableModelAnswer();

    // ============================================================
    // AGENT 2.9: TOOL LOOP (agentic function calling; off unless TOOL_LOOP=1)
    // ============================================================
    // Skipped for simple intents, free/Groq models, client opt-out, and when call-model
    // cannot pass tools. NEVER throws: any failure leaves the normal writing + QA path untouched.
    let toolLoop: Awaited<ReturnType<typeof runToolLoop>> | null = null;
    let toolLoopSkip = "";
    // v175: explicit runner-execution / GitHub-write asks (used for tool forcing + skip exemptions)
    const runnerAsk = /\b(spain-runner|runner job|run [a-z0-9_]+ job|launch [a-z0-9_]+ job|execute [a-z0-9_]+ job|pdi_spine_check|policy_radar|comptrove_raw_scale_health|scheduler_backstop_report|digest_dead_man|permits_progress_check|traffic_anomaly_alert|run_runner_job)\b/i.test(String(userQuery));
    // v192: broadened — "commit these artifacts to the repos", "apply these to SHMT",
    // "open a PR with this SQL" all got claim-can't answers ("what I cannot do from this
    // session is commit these to the repos") while github_write CAN commit + open PRs.
    const ghWriteAsk = /\b(open|create|make)\b.{0,30}\b(pull request|pr)\b/i.test(String(userQuery))
      || /\b(commit|push) (this|that|the|it)\b/i.test(String(userQuery))
      || /\b(commit|apply|ship|land) (these|the|them|that|it)\b.{0,40}\b(repo|repos|file|files|artifact|artifacts|sql|patch|patches|config|lane|lanes)\b/i.test(String(userQuery))
      || /\b(commit|open a pr|make a pr|ship)\b.{0,50}\b(artifact|sql|patch|wording|smoke test|coverage report)\b/i.test(String(userQuery))
      || /\bgithub_write\b/i.test(String(userQuery));
    const toolCtx = {
      supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "https://bnxermyboeigvwonfrzx.supabase.co",
      anonKey: sbAnonKey, userToken: apiKeyMode ? "" : token, userEmail, userId: apiKeyMode ? undefined : userId, isAdmin: apiKeyMode ? false : isAdmin, incognito, memberProfile: buildMemberProfile(personalization), userQuery: String(userQuery),
      runnerAsk, ghWriteAsk,
      searchFilters: { domains: searchF.domains, recency: searchF.recency },
      threadId: typeof threadIdRaw === "string" ? threadIdRaw : undefined,   // optional: frontend may send the open thread id so dispatch results can post back
      planAllowed: planDec.plan   // v103 I8: simple requests never get record_plan/mark_step
    } as any;
    // I9: default-deny egress. URL provenance = URLs the user typed this turn (+ hosts of trusted search results, added by the tool loop).
    // privateTexts = everything that must never leak into a model-chosen URL.
    initEgress(toolCtx, { userMessage: String(userQuery), repoPrEnabled: Deno.env.get("REPO_PR_ENABLED") === "1",
      isFleet: !apiKeyMode && String(await resolveFleetEmail()) === String(userEmail || "").toLowerCase(),   // v175: runner tools for the fleet account
      connectorTools2: !apiKeyMode && CONNECTOR2_INTENT.test(String(userQuery)),   // wave 2 tools: only on explicit files/repos/services intent
      dispatchTools: !apiKeyMode && !incognito && DISPATCH_INTENT.test(String(userQuery)),   // fleet dispatch: only on explicit dispatch intent
      fleetTools: !apiKeyMode && FLEET_INTENT.test(String(userQuery)),   // fleet registry tool: only on agent/fleet/guardian/org-chart intent
      mcpTools: !apiKeyMode && MCP_INTENT.test(String(userQuery)),   // v170 MCP: the user's registered MCP servers, only on explicit MCP intent
      connectorTools: !apiKeyMode && CONNECTOR_INTENT.test(String(userQuery)),   // F7/F15: Gmail/Calendar tools only when the request is about the user's mail/calendar
      privateTexts: [userContextBlock, ...messages.slice(0, -1).map((m: any) => String(m?.content || ""))] });
    // v170 TOOLS CATALOG: the writer model must KNOW its own toolbox. When the user asks what
    // this assistant can do (or mentions skills/harvesting/spain-runner), inject the live catalog
    // so the answer enumerates real capabilities instead of denying they exist.
    if (!apiKeyMode && TOOLS_INTENT.test(String(userQuery))) {
      const cat: string[] = [];
      cat.push("LIVE SEARCH & RESEARCH: web_search (live web search with ranked sources), fetch_page / fetch_asset (read any URL), browser_step (drive a real browser: navigate/click/type/screenshot — Comet parity).");
      cat.push("COMPUTE & CODE: run_python (sandboxed Python), calculator, code writing and debugging, record_plan / mark_step (multi-step plan tracking).");
      cat.push("DATABASE READS (v173): query_comptrove — live read queries against the Deal Engine property database (hist.property_facts: property name/address/city/state/unit count/year built; rr.unit_observation_daily: rent observations by property/beds/date). Use it for any property/rent-comps data question instead of claiming no database access.");
      cat.push("CONNECTED APPS (Settings > Connectors): search_email, read_email, send_email (Gmail, preview+approve), list_events, create_event (Google Calendar), search_drive, read_file, list_spreadsheet, read_sheet (Drive/Sheets), slack_search, slack_read_channel (Slack), github_search_code, github_search_issues, github_search_repos, github_read_issue (GitHub), dropbox_list_files, dropbox_read_file (Dropbox), render_list_services, render_deploy_status, render_logs (Render), supabase_list_projects, supabase_project_health (Supabase).");
      cat.push("AGENT FLEET: list_fleet (the platform's own 219-entry agent registry — guardians, automations, build lanes), dispatch_fleet (queue work for the ops fleet; results post back into the thread).");
      cat.push("MCP SERVERS (Settings > MCP servers): mcp_list_servers, mcp_list_tools, mcp_call_tool — call tools on any MCP server the user registered.");
      cat.push("PLUGINS & SKILLS (sidebar > Plugins): installable skill packs (Research Pack, Inbox Assistant, Calendar Planner) whose prompts ride the slash menu.");
      cat.push("EXECUTION (v175): run_runner_job — LAUNCH a Spain Runner job on the live Fly.io machine (node src/runner.mjs --once <job>); runner_job_status — read the runner.runs ledger; github_write — create branches, commit files, open PRs, comment, open issues as the owner (never merges); query_comptrove — live Deal Engine database reads.");
      cat.push("HARVESTING / spain-runner: bulk jobs run on the owner machine (spain-runner) via run_runner_job — when the user references them, RUN the job (or check runner_job_status); never say you cannot launch runner jobs.");
      capped.push({ role: "system", content: "THE USER IS ASKING WHAT YOU CAN DO. This is YOUR live tool catalog — enumerate these capabilities honestly and specifically (say 'web_search', 'run_python', 'browser_step', the connector tools by name). NEVER claim you have no tools, no skills, no harvesting abilities, or that nothing is connected — if a specific tool needs a connector that is not connected, say exactly which one and how to connect it in Settings > Connectors. Catalog:\n" + cat.join("\n") });
    }
    if (!apiKeyMode && /\b(spain-runner|runner job|run .* job|launch .* job|execute .* job|pdi_spine_check|policy_radar|comptrove_raw_scale_health|scheduler_backstop_report|digest_dead_man|permits_progress_check|traffic_anomaly_alert)\b/i.test(String(userQuery))) {
      capped.push({ role: "system", content: "The user explicitly asked to execute runner work on spain-runner. The run_runner_job tool is connected (it execs node src/runner.mjs --once <job> on the live Fly.io machine and returns the exit code, stdout, and the runner.runs ledger rows). CALL run_runner_job NOW with the job name — never substitute a dry run, a plan, or a claim that you cannot launch runner jobs. If it returns RUNNER NOT LIVE YET, relay its token/setup step verbatim (it includes the exact URL)." });
    }
    // v172 TOOL NUDGES: the loop model (GLM via call-model) is unreliable at calling tools
    // unprompted (same finding as v140/v141 for list_fleet). When the user EXPLICITLY names a
    // tool, inject a system message that makes the call non-optional.
    if (!apiKeyMode && /\b(browser_step|use the browser|open the page and|navigate to https?|drive the browser)\b/i.test(String(userQuery))) {
      capped.push({ role: "system", content: "The user explicitly asked for browser automation. The browser_step tool is connected (actions: navigate, read, click, fill, extract). CALL browser_step with action:navigate and the URL FIRST, then read the result and answer from what the page actually contains. Never substitute web search for the browser when the user asked for the browser." });
    }
    if (!apiKeyMode && /\b(ask_user|ask me which|ask me what|first ask me|clarif)\b/i.test(String(userQuery))) {
      capped.push({ role: "system", content: "The user explicitly asked you to ask them a clarifying question first. The ask_user tool is connected. CALL ask_user now with the question and 2-6 options {label, value} — do not proceed to the deliverable until the user answers." });
    }
    // v170 MCP: make the tools explicit when the request is about MCP.
    if (!apiKeyMode && MCP_INTENT.test(String(userQuery))) capped.push({ role: "system", content: "The user is asking about MCP (Model Context Protocol) servers or their tools. The mcp_list_servers / mcp_list_tools / mcp_call_tool tools are connected and talk to the user's registered MCP servers through the platform's `mcp` function. Call them before answering — never claim MCP is inaccessible, and if mcp_list_servers returns an empty list, tell the user they can add MCP servers in Settings > Plugins & MCP." });
    // v140 FLEET: the loop model sometimes declines list_fleet even when offered — make the instruction explicit.
    if (!apiKeyMode && FLEET_INTENT.test(String(userQuery))) capped.push({ role: "system", content: "The user is asking about THIS platform's own agent fleet / registry / guardians / automations. The list_fleet tool is connected and returns the live registry from the platform's database (org chart, guardians, automations with schedules, build lanes, runtime agents). Call it before answering — never claim the fleet is inaccessible, and never substitute generic web results for it." });
    // v141 FLEET: server-side auto-invocation (same pattern as v95 autoFetchAssets) — the loop model is unreliable at
    // calling list_fleet on its own, so when the question is about the fleet the platform fetches the registry itself
    // and injects the real table as evidence. The writer then answers from actual data.
    if (!apiKeyMode && FLEET_INTENT.test(String(userQuery))) {
      try {
        const fleetData = await runConnectorTool("list_fleet", { limit: 1000 }, toolCtx);
        if (fleetData) capped.splice(1, 0, { role: "system", content: `LIVE FLEET REGISTRY (authoritative, from the platform database — use these numbers, never claim the fleet is inaccessible):\n${String(fleetData).slice(0, 14000)}` });
      } catch (_fe) { /* fleet fetch failed: the loop/tool path above still applies */ }
    }
    // v142 DISPATCH: server-side auto-invocation — the platform queues the fleet_dispatch row itself (the loop model is unreliable
    // at calling tools) and tells the writer the real queue id. runDispatchTool is idempotent per request via toolCtx.dispatchDone.
    if (!apiKeyMode && !incognito && DISPATCH_INTENT.test(String(userQuery))) {
      try {
        const d = JSON.parse(await runConnectorTool("dispatch_fleet", { instruction: String(userQuery).slice(0, 4000) }, toolCtx));
        capped.splice(1, 0, { role: "system", content: `FLEET DISPATCH QUEUED (authoritative, done by the platform): the user's request was queued for the ops fleet as dispatch ${d.dispatch_id} (priority ${d.priority}, status queued). Tell the user: "Work queued for the ops fleet \u2014 results post back into this thread." and quote the id. Do NOT claim the work is already done or that you performed it; it runs asynchronously and the result arrives as a later message.` });
      } catch (de) { capped.splice(1, 0, { role: "system", content: `FLEET DISPATCH FAILED: ${String((de as Error).message || de).slice(0, 200)}. Tell the user the work was NOT queued and why; do not claim it was.` }); }
    }
    // v175 RUNNER: server-side auto-invocation (same pattern as v141 list_fleet / v142 dispatch) —
    // the loop model answers text-only even with the tool offered and tool_choice forced, so when
    // the user explicitly asks to run a runner job the platform executes it itself and injects the
    // REAL result (exit code, stdout, ledger rows — or the exact missing-token step) as evidence.
    if (!apiKeyMode && runnerAsk) {
      try {
        const RUNNER_JOBS = ["policy_radar", "comptrove_raw_scale_health", "traffic_anomaly_alert", "scheduler_backstop_report", "permits_progress_check", "digest_dead_man", "pdi_spine_check", "autoscale_reconcile", "hud_pha_compliance_monitor", "pha_solutions_ledger", "hap_contract_verification", "payment_standards_refresher", "hud_pbv_mtw_refresh", "acs_release_verification", "hud_form_status_monitor", "grants_radar_review", "pha_vendor_adoption", "federal_housing_scan", "pha_health_scan", "comptrove_pha_pages_watch", "bookkeeping_operating"];
        const q = String(userQuery);
        let job = (RUNNER_JOBS.find((j) => q.toLowerCase().includes(j)) || "");
        if (!job) {
          const m = /\b(?:run|launch|execute|start|trigger|fire)\s+(?:the\s+)?([a-z0-9_]{3,60})\b/i.exec(q);
          if (m && /^[a-z][a-z0-9_]*$/.test(m[1])) job = m[1];
        }
        if (job) {
          const rr = await toolRunRunnerJob({ job, timeout: 300 }, toolCtx);
          capped.splice(1, 0, { role: "system", content: `RUNNER JOB EXECUTION RESULT (authoritative, executed by the platform on the live spain-runner Fly.io machine — quote this verbatim, never claim you cannot launch runner jobs):\n${String(rr).slice(0, 6000)}` });
        }
      } catch (re) { capped.splice(1, 0, { role: "system", content: `RUNNER JOB LAUNCH FAILED: ${String((re as Error).message || re).slice(0, 250)}. Tell the user the job was NOT launched and why; do not claim it ran.` }); }
    }
    // v172: load the browser-service URL/token from gateway_config (the browser tier is
    // deployed on Render; its credentials live in DB config, not edge env). Cached 5 min.
    if (!(globalThis as any).__browserCfgAt || Date.now() - (globalThis as any).__browserCfgAt > 300_000) {
      (globalThis as any).__browserCfgAt = Date.now();
      const svcK0 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/gateway_config?select=key,value&key=in.(browser_service_url,browser_service_token)`, {
        headers: { apikey: svcK0, Authorization: `Bearer ${svcK0}` }, signal: AbortSignal.timeout(5_000)
      }).then((r) => r.json()).then((rows: any) => {
        const o: any = {};
        for (const row of rows || []) if (row?.key && row?.value) o[row.key === "browser_service_url" ? "url" : "token"] = String(row.value);
        (globalThis as any).__browserConfigOverride = o;
      }).catch(() => {});   // best effort: the env-var path still applies
    }
    // v172 BROWSER AUTO-INVOCATION: the loop model is unreliable at calling browser_step
    // (same v141 finding). When the user EXPLICITLY asks for the browser and gives a URL,
    // the platform navigates + reads the page itself and injects the real page text as
    // evidence. The writer answers from actual page content — it can never again claim a
    // browser action it did not perform, and web search is never substituted for the browser.
    let browserAutoText: string | null = null;
    if (!apiKeyMode && !incognito && /\bbrowser_step\b|\buse the browser\b|\bdrive the browser\b/i.test(String(userQuery))) {
      const uMatch = String(userQuery).match(/https?:\/\/[^\s)"']+/i);
      if (uMatch) {
        let ovr = ((globalThis as any).__browserConfigOverride || {});
        if (!ovr.url || !ovr.token) {
          // first request after cold start: await the config fetch (once)
          try {
            const svcK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
            const rows: any = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/gateway_config?select=key,value&key=in.(browser_service_url,browser_service_token)`, {
              headers: { apikey: svcK, Authorization: `Bearer ${svcK}` }, signal: AbortSignal.timeout(5_000)
            }).then((r) => r.json());
            ovr = {};
            for (const row of rows || []) if (row?.key && row?.value) ovr[row.key === "browser_service_url" ? "url" : "token"] = String(row.value);
            (globalThis as any).__browserConfigOverride = ovr;
          } catch (_ce) { ovr = {}; }
        }
        const bBase = ((Deno.env.get("BROWSER_SERVICE_URL") || "").trim() || String(ovr.url || "")).replace(/\/+$/, "");
        const bTok = Deno.env.get("BROWSER_SERVICE_TOKEN") || String(ovr.token || "");
        if (bBase && bTok) {
          try {
            const bH = { Authorization: `Bearer ${bTok}`, "Content-Type": "application/json" };
            const sess = await fetch(`${bBase}/session`, { method: "POST", headers: bH, body: "{}", signal: AbortSignal.timeout(8_000) }).then((r) => r.json()).catch(() => null);
            const sid = sess?.session_id;
            if (sid) {
              const nav = await fetch(`${bBase}/navigate`, { method: "POST", headers: bH, body: JSON.stringify({ session_id: sid, url: uMatch[0] }), signal: AbortSignal.timeout(18_000) }).then((r) => r.json()).catch(() => null);
              const title = nav?.title ? ` (title: ${String(nav.title).slice(0, 120)})` : "";
              const read = await fetch(`${bBase}/read`, { method: "POST", headers: bH, body: JSON.stringify({ session_id: sid }), signal: AbortSignal.timeout(10_000) }).then((r) => r.json()).catch(() => null);
              const txt = String(read?.text || "").slice(0, 8000);
              if (txt) {
                browserAutoText = txt;
                capped.splice(1, 0, { role: "system", content: `BROWSER RESULT (authoritative — the platform navigated ${uMatch[0]}${title} with the real browser; this is the page's actual text):\n${txt}\nAnswer the user's question from THIS text. If it does not contain the answer, say exactly what the page contains instead. NEVER claim you browsed anywhere else, and NEVER substitute web-search results for this page.` });
              } else {
                capped.splice(1, 0, { role: "system", content: `BROWSER ATTEMPTED but failed (navigate error: ${String(nav?.error || "no page text") .slice(0, 160)}). Tell the user the browser could not read the page and why; do NOT claim you browsed it.` });
              }
            }
          } catch (_be) { /* fall through to the loop path */ }
        } else {
          capped.splice(1, 0, { role: "system", content: "BROWSER SERVICE NOT CONFIGURED (BROWSER_SERVICE_URL/TOKEN unset on the gateway). Tell the user plainly: the browser tool is not connected yet — do NOT claim you browsed the page or describe its contents." });
        }
      }
    }
    // v175 STATUS AUTO-INVOCATION: bare "UPDATE" / "status" / "what's running" / "refresh this
    // session and tell me the next items" messages were answered from STALE conversation memory
    // plus irrelevant web searches (three live incidents 2026-11-12). The platform now queries
    // live state itself and injects it as the authoritative evidence for the answer.
    const statusish = /^(update|updates|status|stat|what'?s (the )?(status|update)|any (news|progress)|next items?|what'?s (running|queued|next)|refresh( this)? session|\?)\b[\s?!.]*$/i.test(String(userQuery).trim())
      || (/\b(update|status|refresh (this )?session|next items|what'?s (running|queued))\b/i.test(String(userQuery)) && String(userQuery).trim().length <= 90);
    if (statusish && !apiKeyMode) {
      try {
        const st = JSON.parse(await toolPlatformStatus({}, { supabaseUrl: Deno.env.get("SUPABASE_URL") || "", anonKey: sbAnonKey || "", userToken: token, userId, userEmail } as any));
        capped.splice(1, 0, { role: "system", content: `LIVE PLATFORM STATUS (authoritative — queried just now by the platform itself):\n${JSON.stringify(st)}\nAnswer the user's status/update question from THIS data. NEVER answer status questions from conversation memory, and NEVER claim work is or is not running without citing this. If the queues are empty, say the queues are empty. The user cannot "refresh the session" — but the platform CAN and DID check live state, so give them the current state and the actual next items.` });
      } catch (_se) { /* fail open: the loop's platform_status tool remains available */ }
    }

    // v191 ESTATE CONTEXT (owner incident 2026-11-12: "status of PRs #3794, #3831, #3855" and
    // "verify migration ledger #3500 HWM" were answered with "I can't pull live status — drop
    // the repo URL" and "no migration ledger #3500 exists" — the model knows NOTHING about the
    // owner's estate and web-searched DataVault4dbt docs instead). Two fixes:
    // (1) inject the estate map so the model knows what these names ARE;
    // (2) the platform itself fetches bare PR numbers via github-ops pr_status (PAT-backed).
    let estateAsk = false;
    const ESTATE_RE = /\b(shmt|rentspire-bspain-?2?|migration (ledger|slot)|rs-?1|critical path|hwm|high.?water|seven-pr|deal engine|comptrove|disposition pr)\b/i;
    const prNums = [...String(userQuery).matchAll(/#(\d{2,6})\b/g)].map((m) => m[1]).slice(0, 5);
    if (!apiKeyMode && (ESTATE_RE.test(String(userQuery)) || prNums.length)) {
      estateAsk = true;
      capped.splice(1, 0, { role: "system", content: "OWNER ESTATE CONTEXT (v191 — authoritative; use this instead of web search for the owner's own systems): (1) GitHub org rentspire-bspain; repos: SHMT (the Deal Engine / terminal monorepo — migration files live in supabase/migrations/), ai-gateway-site (this site's frontend), rentspire-comps (Comptrove web surfaces). A bare PR/issue number (e.g. #3794, #3500) is a rentspire-bspain/SHMT PR/issue unless the user names another repo — NEVER ask the user for the repo URL; use the PR/ISSUE STATUS EVIDENCE below (fetched live by the platform) or call github_write with action pr_status/issue_read, repo rentspire-bspain/SHMT. (2) The migration ledger is the ops.migration_slot table on the Deal Engine Supabase project dcyjmftriqayqaonitlx — a strictly in-order apply queue; as of 2026-11-12: ~604 applied, ~65 bound (waiting), high water mark via ops.migration_version_high_water(); '599 applied' is an older figure from a handoff doc. Issue #3500 is the RS-1 ledger GO campaign (ledger GO comments coordinate slot releases); rentspire-bspain-2 is the -2 principal account in that campaign. HWM = high water mark (ops.migration_version_high_water()), NOT a hospital metric. (3) Live tools: github_write (pr_status, issue_read + branch/commit/PR/comment/issue), run_runner_job, runner_job_status, query_comptrove, dispatch_fleet, browser_step, run_python. NEVER say 'no ledger exists', 'I can't pull live status', or 'drop the repo URL' for estate questions — read the evidence above or call the tools; if a tool genuinely fails, report the exact error." });
      for (const n of prNums) {
        try {
          const pr = JSON.parse(await toolGithubWrite({ action: "pr_status", repo: "rentspire-bspain/SHMT", number: Number(n) }, toolCtx));
          if (pr && !pr.error) capped.splice(1, 0, { role: "system", content: `PR STATUS (authoritative, fetched live from GitHub by the platform): rentspire-bspain/SHMT PR #${n} "${pr.title}" — state ${pr.state}${pr.merged ? ", MERGED " + pr.merged_at : ""}${pr.draft ? ", draft" : ""}; head ${pr.head} -> ${pr.base}; requested reviewers ${(pr.requested_reviewers || []).join(", ") || "none"}; checks: ${(pr.check_runs || []).map((c: any) => `${c.name}=${c.conclusion || c.status}`).join(", ") || "none reported"}; recent comments: ${(pr.recent_comments || []).map((c: any) => `${c.author}: ${String(c.body).slice(0, 200)}`).join(" | ") || "none"}. Use THIS for the PR's status — never claim you cannot pull it.` });
        } catch (_pe) { /* PR fetch failed — the tool remains available to the loop */ }
      }
    }
    // v188 GO-CLOSURE AUTO-EXECUTION (owner incident 2026-11-12, three reports): a bare
    // "GO - CONTINUE CLOSING EVERYTHING YOU CAN AUTONOMOUSLY" / "CAN YOU KEEP CLOSING ALL OF
    // THESE ITEMS AUTONOMOUSLY?" got a non-answer ("I can't safely close these jobs — not
    // defined anywhere in this conversation"). The platform now treats the closure directive
    // as REAL work: it queues the instruction to the ops fleet itself (same pattern as v142
    // dispatch) and hard-forbids the can't-execute cop-out in the writer prompt.
    const closureAsk = /\b(go|continue|keep (going|closing|firing|pressing)|fire away|close|finish|execute|pick up|resume)\b/i.test(String(userQuery))
      && /\b(everything|all|these|the (lanes|jobs|list|items|os|o\/s|backfills?))\b/i.test(String(userQuery))
      && /\b(autonom(ous|ously)|close|closing|execute|executing|where we left off)\b/i.test(String(userQuery));
    if (closureAsk && !apiKeyMode && !incognito) {
      try {
        const d = JSON.parse(await runConnectorTool("dispatch_fleet", { instruction: `AUTONOMOUS CLOSURE DIRECTIVE from the owner: ${String(userQuery).slice(0, 3500)}. Work the open O/S items implied by the conversation and this directive: run the pending runner jobs, advance the open harvest/implementation lanes, and post results back to the thread.` }, toolCtx));
        capped.splice(1, 0, { role: "system", content: `AUTONOMOUS CLOSURE DIRECTIVE (v188 — authoritative platform action): the user said GO on closing work autonomously. The platform ALREADY queued this directive to the ops fleet as dispatch ${d.dispatch_id} (priority ${d.priority}, status queued) — real work is now running asynchronously and results post back into the thread. Tell the user that plainly and quote the dispatch id. You also have LIVE execution tools in this conversation (run_runner_job, runner_job_status, github_write, github_search_*, query_comptrove, browser_step, dispatch_fleet, run_python) — use them for anything the directive names concretely. NEVER answer a closure directive with "I can't safely close these jobs — not defined anywhere in this conversation" or "no tool output returned with the GO" or paste-ready artifacts instead of execution. Define the O/S from the conversation context, run what is runnable, and report exactly what ran (ids, exit codes, rows) and what remains.` });
      } catch (de) { capped.splice(1, 0, { role: "system", content: `FLEET DISPATCH FAILED: ${String((de as Error).message || de).slice(0, 200)}. Tell the user the work was NOT queued and why; do not claim it was. You still have live execution tools (run_runner_job, github_write, query_comptrove, browser_step, run_python) — use them for anything the directive names concretely; never claim you cannot execute.` }); }
    }
    let executeArtifactsAsk = false;
    // v192 EXECUTE-THE-ARTIFACTS NUDGE (owner incident 13:31: "CAN YOU TRY AGAIN" after an
    // artifact-producing answer → the model AGAIN said "What I cannot do from this session —
    // commit these to the repos" while github_write commits + opens PRs as the owner).
    // When the user asks to retry/execute/commit/apply the work and the recent context
    // contains authored artifacts (SQL/python/yaml blocks the model itself produced),
    // the writer is ordered to EXECUTE via github_write instead of re-authoring.
    if (!apiKeyMode && /\b(try again|do it|execute|commit|apply|ship|land|run it|go ahead)\b/i.test(String(userQuery))) {
      const recentAssistant = messages.filter((m: any) => m?.role === "assistant").slice(-2).map((m: any) => String(m?.content || "")).join(" ");
      const hasArtifacts = /```(sql|python|ya?ml|diff|ts)/i.test(recentAssistant) || /artifact \d/i.test(recentAssistant);
      const priorClaimCant = /what I cannot do|paste-ready|one action from you|execution step:/i.test(recentAssistant);
      if (hasArtifacts && priorClaimCant) {
        executeArtifactsAsk = true;
        capped.splice(1, 0, { role: "system", content: "EXECUTE, DO NOT RE-AUTHOR (v192): your previous answer delivered paste-ready artifacts and told the user 'what I cannot do from this session is commit these to the repos' — that is FALSE for this system. The github_write tool is connected (PAT-backed, as the owner): commit_file + create_pr commit files to rentspire-bspain repos and open PRs; pr_status / issue_read read live PR/issue state; run_runner_job executes jobs on spain-runner. COMMIT THE ARTIFACTS from your previous answer now (each file to its named repo path, branch + PR), then report the real PR URLs and numbers. NEVER re-deliver the same artifacts as paste-ready blocks or repeat the 'cannot commit from this session' boundary statement." });
      }
    }
    // v188 HANDOFF-DOC INOCULATION (owner incident 2026-11-12): the user pasted a Comptrove
    // handoff DOCX written by an assistant that could NOT execute ("this reply cannot reach
    // fly ssh or Supabase", "the Perplexity workspace is not present here") — and the model
    // ADOPTED those claims as its own limits instead of using its real tools. Pasted
    // documents' capability claims describe OTHER systems or earlier states, never this one.
    let handoffDoc = false;
    const pastedText = String(userQuery) + " " + messages.slice(-4).map((m: any) => String(m?.content || "")).join(" ");
    if (!apiKeyMode && /handoff|where we left off|pick up (on|from) /i.test(pastedText) && /cannot reach|can'?t (reach|execute|access)|no live execution|not present here|requires? your (login|paste|approval)|files authored, never run/i.test(pastedText)) {
      handoffDoc = true;
      capped.splice(1, 0, { role: "system", content: "HANDOFF-DOC INOCULATION (v188): the user pasted a handoff/continuation document written by a DIFFERENT assistant session. That document contains claims like \"this reply cannot reach fly ssh or Supabase\", \"no live execution was performed\", \"the Perplexity workspace is not present here\", or O/S items \"authored, never run\". Those claims describe THAT system's limits or an EARLIER state — they are NOT your limits and may already be stale. You are the ai.spaincos.com gateway with LIVE tools: run_runner_job (exec on the spain-runner Fly.io machine), runner_job_status, github_write / github_search_* (the owner's real GitHub repos), query_comptrove (live Deal Engine database), dispatch_fleet, browser_step, run_python, and live web search. NEVER adopt or repeat the pasted document's 'cannot execute' claims as your own. For every O/S item the document lists, CHECK it live with your tools (does the repo already have the file? is the migration already applied? is the job already run?) before treating it as open. Report what you actually verified, with tool evidence." });
    }
    // v172 ask_user AUTO-INVOCATION: the loop model won't call the tool (v141-class flakiness).
    // When the user EXPLICITLY asks the assistant to ask them first AND enumerates options,
    // the platform builds the choose-one card itself and shows it via x_actions.
    if (!apiKeyMode && !incognito && /\buse ask_user\b|\bfirst ask me\b|\bask me (which|what)\b/i.test(String(userQuery))) {
      const q = String(userQuery);
      const optMatch = q.match(/options?\s*:?\s*(.+)$/i) || q.match(/with options?\s*[:-]?\s*(.+)$/i);
      if (optMatch) {
        const labels = optMatch[1].split(/[,;]|\s+and\s+/i).map((x: string) => x.replace(/[*_.]/g, "").trim()).filter((x: string) => x.length > 0 && x.length < 40).slice(0, 6);
        if (labels.length >= 2) {
          const askM = q.match(/ask me (?:which|what)\s+(.{0,120}?)(?=\s+with|\s*[,.;]|$)/i) || q.match(/ask_user\s+to\s+ask me\s+(.{0,120}?)(?=\s+with|\s*[,.;]|$)/i);
          const question = (askM ? askM[1].trim() : "Which option fits?").replace(/^(which|what)\s+/i, "");
          const card = { kind: "ask_user", question: question.charAt(0).toUpperCase() + question.slice(1) + (/[?]$/.test(question) ? "" : "?"), options: labels.map((l: string) => ({ label: l, value: l })) };
          (toolCtx.actions ||= []).push(card);
          capped.splice(1, 0, { role: "system", content: `ASK-USER CARD SHOWN (authoritative — the platform displayed a clickable choose-one card with these options: ${labels.join(", ")}). Ask the question ONCE in plain text if needed, then STOP — do not build the deliverable yet, do not repeat the options as a markdown list as if the user must type. The conversation resumes when the user clicks an option or types their own answer.` });
        }
      }
    }
    // v95 I4: server-side auto-invocation — when the request is unambiguously "fetch/download/update the favicon|logo|file from <site>",
    // the platform runs fetch_asset itself (the writer model otherwise answers with a bare link). Independent of TOOL_LOOP.
    let autoAsset: Awaited<ReturnType<typeof autoFetchAssets>> | null = null;
    if (tool_loop !== false) {
      try {
        autoAsset = await autoFetchAssets(String(userQuery), toolCtx);
        if (autoAsset.evidence) capped.splice(1, 0, { role: "system", content: autoAsset.evidence });
      } catch (_e) { autoAsset = null; }
    }
    try {
      const gate = shouldRunToolLoop({
        complexity: intent.complexity, model: finalModel, stream: stream === true,
        query: String(userQuery), intent, clientOptOut: tool_loop === false
      });
      if (gate.run) {
        // v121 SPEED: when live research already returned a solid source set, the tool loop mostly
        // RE-searches the same thing (measured 12-16s added latency) — skip it except for extreme
        // complexity or image/asset requests, where fresh page reads genuinely add evidence.
        // v124 AGENTIC: v121 speed skip stays for ordinary questions. Narrow exception (kill switch AGENTIC_SKIP_BYPASS=0): a COMPLEX request that is
        // genuinely multi-step (plan-worthy) or any non-simple request that needs real computation still runs the loop — plan/act/verify and
        // run_python add evidence the research text cannot (computed numbers, verified steps).
        const pythonFirst = needsComputation(String(userQuery), intent);
        const agenticBypass = Deno.env.get("AGENTIC_SKIP_BYPASS") !== "0" && ((intent.complexity === "complex" && planDec.plan) || pythonFirst);
        // v124 AUTO-AGENTIC: the loop is running, so complex/extreme requests get a compact plan->act->verify sequence inside the existing rounds.
        const loopPlanDec = planDecision(String(userQuery), String(intent.complexity), true);
        toolCtx.planAllowed = loopPlanDec.plan;
        toolCtx.planCompact = loopPlanDec.plan && !planDec.plan;
        toolCtx.pythonFirst = pythonFirst;
        // v137 FLEET/CONNECTOR: session-private tools (fleet registry, Gmail/Calendar, wave-2 providers) can NEVER be
        // substituted by web research — the loop must run so they are offered. Exempt them from the v121 speed skip.
        const CAPABILITY_INTENT = /\b(is|are|do|does|can|could|have|has)\b.{0,40}\b(execution|execute|sandbox|python|tools?|connected|connection)\b/i;
        // v175: runner execution and GitHub writes are private-tool work — web research can
        // NEVER substitute for actually calling run_runner_job / github_write.
        const privateToolIntent = FLEET_INTENT.test(String(userQuery)) || DISPATCH_INTENT.test(String(userQuery)) || CONNECTOR_INTENT.test(String(userQuery)) || CONNECTOR2_INTENT.test(String(userQuery)) || CAPABILITY_INTENT.test(String(userQuery)) || runnerAsk || ghWriteAsk;
        if (perplexityUsed && researchFindings.length >= 6 && intent.complexity !== "extreme" && !imageAttach && !agenticBypass && !privateToolIntent) {
          toolLoopSkip = "research_sufficient";
        } else {
        toolLoop = await runToolLoop({
          callModelUrl, model: finalModel, purpose, baseMessages: capped,
          maxTokens: tokenBudget,
          reuseFinal: false,              // NEVER reuse the loop's own final: GLM tool-calls are flaky through call-model (mangled "ToolCall" prefixes, CJK confusion text). The loop gathers evidence; the writing path answers.
          gatewayToken: GW_TOKEN,
          ctx: toolCtx,
          onProgress: progress ? (e) => {   // v103 F12: truthful per-tool progress
            if ((e.phase === "start" || e.phase === "end") && (e.tool === "record_plan" || e.tool === "mark_step")) return;   // the plan row (setPlan) covers these
            if (e.phase === "start") progress.begin(e.id, e.label, e.tool === "web_search" ? "search" : /^(fetch_page|browser_step|fetch_asset|search_my_context)$/.test(e.tool) ? "read" : "tool");
            else if (e.phase === "end") progress.end(e.id, e.ok ? e.label.replace(/^Searching:/, "Searched:").replace(/^Reading (.*)…$/, "Read $1").replace(/^Browsing (.*)…$/, "Browsed $1").replace(/^Fetching asset/, "Fetched asset").replace(/^Calculating…$/, "Calculated").replace(/^Running Python…$/, "Ran Python").replace(/^Planning (\d+) steps…$/, "Planned $1 steps").replace(/^Verifying step (\d+)…$/, "Verified step $1").replace(/…$/, "") : `${e.label.replace(/…$/, "")} — failed`, e.ok ? {} : { failed: true });
            else if (e.phase === "plan") progress.setPlan(e.plan);
          } : undefined
        });
        // Evidence goes in as its own system message (index 1) so the 4,000-char per-message cap above
        // cannot truncate it, and so every QA retry (which re-sends `capped`) still sees the tool results.
        if (toolLoop.evidence) capped.splice(1, 0, { role: "system", content: toolLoop.evidence });
        }
      } else {
        toolLoopSkip = gate.reason || "";
      }
    } catch (_e) { toolLoop = null; console.error("tool-loop failed:", String((_e as Error)?.stack || _e).slice(0, 500)); /* loop failed: continue with the normal path */ }
    // v145 EXECUTION GUARANTEE: if this was a computation/verify request and the model never ran
    // the Python sandbox (GLM tool-calls are flaky through call-model), the platform runs the
    // computation ITSELF: one no-tools model call that returns only a Python script, executed in
    // the sandbox, with the printed results injected as evidence for the writer. Verify asks
    // can never again be answered by hand-derived arithmetic or a "no execution tool" disclaimer.
    if (needsComputation(String(userQuery), intent) && !apiKeyMode && !(toolCtx.pyRuns?.length)) {
      try {
        progress?.beginAgent("py-verify", "PYTHON · Verify", "Synthesizing the computation…", "reason");
        const res = await fetch(callModelUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(GW_TOKEN ? { Authorization: `Bearer ${GW_TOKEN}`, "x-gateway-token": GW_TOKEN } : {}) },
          body: JSON.stringify({
            messages: [
              { role: "system", content: "You translate a computation request into ONE Python 3 script. Output ONLY a single fenced ```python code block and nothing else - no prose, no explanation before or after. The script must: put every input from the request as a clearly-named variable at the top, compute every number the request asks about, and print() every intermediate and final result with clear labels." },
              { role: "user", content: String(userQuery).slice(0, 4000) },
            ],
            purpose, model: "deepseek/deepseek-v4.1-flash-1017", max_tokens: 2000
          }),
          signal: AbortSignal.timeout(30_000)
        });
        const gen: any = await res.json();
        const genText = String(gen?.choices?.[0]?.message?.content || "");
        const m = genText.match(/```(?:python)?\s*([\s\S]*?)```/);
        if (m && m[1].trim()) {
          const out = JSON.parse(await toolRunPythonForFallback({ code: m[1] }, toolCtx));
          if (out && out.error === undefined && (out.stdout || out.ok)) {
            const ev = "=== PLATFORM-EXECUTED PYTHON (the computation was actually run in the sandbox) ===\nScript:\n" + m[1].slice(0, 1500) + "\n--- sandbox output ---\n" + String(out.stdout || out.stderr || "").slice(0, 1500) + "\nQuote these EXECUTED results verbatim in your answer; do not re-derive the arithmetic by hand.";
            capped.splice(1, 0, { role: "system", content: ev });
            progress?.endAgent("py-verify", "Computation executed in sandbox", {});
          } else {
            progress?.endAgent("py-verify", "Sandbox run unavailable", { failed: true });
          }
        }
      } catch (_e) { /* fallback failed: the writer proceeds as before */ }
    }
    // v91 MODEL COUNCIL (opt-in only; ~3x model spend). Drafts run in parallel, then the writer call below
    // becomes the synthesis (GLM-5.3, medium effort) over [question + research + drafts].
    let councilModels: string[] = [];
    let councilChars: number[] = [];
    let councilUsed = false;
    // v124 AUTO-COUNCIL: extreme complexity in normal mode runs the council automatically (explicit model_council:false opts out; API-key callers excluded: strict OpenAI contract + cost).
    const autoCouncil = model_council !== true && model_council !== false && intent.complexity === "extreme" && !apiKeyMode && Deno.env.get("AUTO_COUNCIL") !== "0";
    const councilRequested = model_council === true || autoCouncil;
    if (councilRequested) {
      // v130: one named agent per council member ("COUNCIL · Draft N" — never a raw model id on the wire); old clients render them as plain rows.
      try {
        const roster = [...new Set([finalModel, "deepseek/deepseek-v4.1-flash-1017", "moonshotai/kimi-k3.1-pro"])];
        const drafts = await runCouncil(callModelUrl, capped, purpose, roster, autoCouncil ? 35_000 : 45_000, (i, ph, ok) => {
          if (ph === "start") progress?.beginAgent(`council-${i + 1}`, `COUNCIL · Draft ${i + 1}`, `Drafting an independent answer…`, "reason");
          else progress?.endAgent(`council-${i + 1}`, ok ? `Draft ${i + 1} ready` : `Draft ${i + 1} unavailable`, ok ? {} : { failed: true });
        });
        councilModels = drafts.map((d) => d.model);
        councilChars = drafts.map((d) => d.text.length);
        if (drafts.length >= 2) { capped.push({ role: "system", content: councilSynthesisPrompt(drafts) }); councilUsed = true; }
      } catch (_e) { /* council failed — normal single-writer path */ }

    }
    // v103 I8: writer-side plan block. Only when the request is plan-worthy AND the tool loop recorded no plan of its own.
    const followUpShape = isFollowUpDeliverable(String(userQuery), (messages || []).filter((m: any) => m?.role === "assistant").length);
    if (followUpShape) capped.push({ role: "system", content: FOLLOWUP_DIRECT_RULE });
    else if (planDec.plan && !toolCtx.plan?.length) capped.push({ role: "system", content: PLAN_WRITER_GUIDANCE });
    // worse-elimination (2026-11-10): depth + continuation guidance for the writer (pairs with the 4,000-token ceiling above).
    if (clarifierContinuation) capped.push({ role: "system", content: CLARIFIER_CONTINUATION_RULE });
    if (isImageGenAsk(String(userQuery))) capped.push({ role: "system", content: IMAGE_ASK_RULE });
    if (longMultiPart || intent.complexity === "extreme") capped.push({ role: "system", content: COMPLEX_DEPTH_RULE });
    if (isDocumentAsk(String(userQuery))) capped.push({ role: "system", content: DOCUMENT_RULE });   // v145: .md/docs render as artifacts, not fenced text
    if (isWebappAsk(String(userQuery))) capped.push({ role: "system", content: WEBAPP_RULE });        // v145: webapp builder parity (live side-panel app)
    if (isVerifyAsk(String(userQuery))) capped.push({ role: "system", content: VERIFY_RULE });        // v145: verify = actually run_python/search, never claim no execution tool
    progress?.begin("draft", "Drafting your answer…", "draft", { agent: "writer", agentName: "WRITER" });
    const writerModel = councilUsed ? "z-ai/glm-5.3" : finalModel;
    const writerEffort = councilUsed ? "medium" : reasoningEffort(intent.complexity);

    // v96 A8: structured step list for an expandable UI. Each phase keeps {label, done} (backward compatible) and adds
    // kind (analyze|search|read|reason|tool|draft), count, and items[] ({title,url,domain}) the frontend can expand.
    const buildStepPhases = (drafting: boolean) => {
      const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
      const ph: Array<{ label: string; done: boolean; kind: string; agent?: string; agentName?: string; count?: number; items?: Array<{ title: string; url?: string; domain?: string; n?: number; snippet?: string }> }> = [{ label: "Analyzed your question", done: true, kind: "analyze", items: [{ title: `Intent: ${String(intent.intent)}; complexity: ${String(intent.complexity)}` }] }];
      if (imageAttach) ph.push({ label: imageAttaches.length > 1 ? `Analyzed ${imageAttaches.length} attached images` : `Analyzed the attached image (${imageAttach.name})`, done: true, kind: "read", count: imageAttaches.length });
      // v128: items are the canonical numbered list (n == the [N] marker); "N sources" == items.length by construction.
      if (researchFindings.length) { const canon = canonicalSourceItems(researchFindings, 18); ph.push({ label: `Searched the web — ${canon.length} source${canon.length === 1 ? "" : "s"}`, done: true, kind: "search", count: canon.length, items: canon.map((c) => ({ title: c.title, url: c.url, domain: c.domain, n: c.n, ...(c.snippet ? { snippet: c.snippet } : {}) })) }); }
      if (!researchFindings.length && researchSkip) ph.push({ label: SKIP_LABELS[researchSkip] || `Live search unavailable (${researchSkip})`, done: true, kind: "search", count: 0 });
      if (subResearchCount) {
        // v130: per-agent rows (one per sub-question) instead of one aggregate; each carries agent/agentName for the grouped Steps view.
        const okSubs = subAgentLog.filter((a) => a.ok).sort((a, b) => a.n - b.n);
        if (okSubs.length) okSubs.forEach((a) => ph.push({ label: `Researched: ${agentTopic(a.q, 70)}`, done: true, kind: "search", count: 1, agent: `research-${a.n}`, agentName: `RESEARCH · ${agentTopic(a.q)}` }));
        else ph.push({ label: `Researched ${subResearchCount} sub-question${subResearchCount === 1 ? "" : "s"}`, done: true, kind: "search", count: subResearchCount });
      }
      const readTools = (toolLoop?.trace || []).filter((t: any) => /^(fetch_page|browser_step|search_my_context|fetch_asset)/.test(String(t.tool)));
      const nRead = readTools.length + (toolCtx.assets?.length ? 0 : 0);
      if (nRead) ph.push({ label: `Read ${nRead} page${nRead === 1 ? "" : "s"} and file${nRead === 1 ? "" : "s"}`, done: true, kind: "read", count: nRead, items: readTools.slice(0, 12).map((t: any) => ({ title: String(t.tool) })) });
      if (toolLoop?.used) ph.push({ label: "Ran tools (search, pages, calculator)", done: true, kind: "tool", count: (toolLoop.trace || []).length, items: (toolLoop.trace || []).slice(0, 12).map((t: any) => ({ title: `${t.tool}${t.ok ? "" : " (failed)"}` })) });
      if (toolCtx.pyRuns?.length) { const n = toolCtx.pyRuns.length, bad = toolCtx.pyRuns.filter((r: any) => !r.ok).length; ph.push({ label: bad === n ? "Ran Python — failed" : `Ran Python${n > 1 ? ` (${n} runs)` : ""}`, done: true, kind: "tool", count: n, items: toolCtx.pyRuns.slice(0, 4).flatMap((r: any) => [{ title: `${r.ok ? "✓" : "✗"} ${String(r.code).split("\n").find((l: string) => l.trim() && !l.trim().startsWith("#"))?.trim().slice(0, 90) || "python"}` }, ...(r.out ? [{ title: `→ ${String(r.out).split("\n")[0].slice(0, 100)}` }] : [])]) }); }
      if (toolCtx.assets?.length) ph.push({ label: `Fetched ${toolCtx.assets[0].name} (${toolCtx.assets[0].bytes} bytes)`, done: true, kind: "read", count: toolCtx.assets.length, items: toolCtx.assets.map((a: any) => ({ title: a.name, url: a.url })) });
      if (toolCtx.plan?.length) ph.push(planPhase(toolCtx.plan));   // v103 I8: expandable plan row
      if (councilModels.length) ph.push({ label: `Consulted ${councilModels.length} models`, done: true, kind: "reason", agent: "council", agentName: "COUNCIL", count: councilModels.length, items: councilModels.map((m) => ({ title: m })) });
      const reasonSteps = 1 + (subResearchCount ? 1 : 0) + (councilModels.length ? 1 : 0) + (toolLoop?.rounds || 0) + (routed ? 1 : 0);
      ph.push({ label: `Reasoned across ${reasonSteps} step${reasonSteps === 1 ? "" : "s"}`, done: true, kind: "reason", agent: "writer", agentName: "WRITER", count: reasonSteps, items: [{ title: `Writer: ${writerModel}${routed ? ` (auto-routed: ${routed.task})` : ""}` }] });
      if (spaceInstructions) ph.push({ label: "Applied your space instructions", done: true, kind: "tool" });
      if (drafting) ph.push({ label: "Drafting your answer", done: false, kind: "draft", agent: "writer", agentName: "WRITER" });
      return ph;
    };
    // STREAMING MODE: pipe the model's SSE straight through to the client.
    // QA retries can't run mid-stream, so the completeness nudge is pre-applied.
    let res: Response;
    let data: any;
    if (stream === true) {
      const streamMessages = intent.complexity === "simple"
        ? capped
        : [...capped, { role: "system", content: "Keep the answer COMPLETE within the token budget — concise, no filler — lead with the direct answer, state the specific figures, dates and names from the research (not vague summaries), and finish with the Suggested Follow-ups section." + (perplexityFullText ? " The LIVE SEARCH ANSWER above is your primary source: preserve its figures, dates and [N] markers." : "") }];
      const sres = await fetch(callModelUrl, {
        method: "POST",
        headers: GW_HEADERS,
        body: JSON.stringify({ messages: streamMessages, purpose, model: writerModel, reasoning_effort: writerEffort, max_tokens: tokenBudget, stream: true }),
        signal: AbortSignal.timeout(120_000)
      });
      const ct = sres.headers.get("content-type") || "";
      if (sres.ok && ct.includes("text/event-stream") && sres.body) {
        // Pipe the token stream through — the client renders deltas live.
        // v58: when research findings exist, the pipe runs through linkCitationsSSE so
        // streamed answers carry the same [[N](url)] linked citations and Sources
        // list as the non-streaming path (bare [N] markers otherwise reach the user).
        const guarded = guardEmptyStream(sres.body, lastResortAnswer); // v83: never end a stream with zero content
        // v84: dedicated follow-up stage — swallows the writer's own section, injects the specific one before finish.
        const requiredEndLine = extractEndLine(spaceInstructions);
        const withFollowUps = appendFollowUpsSSE(guarded, (ans, writerSec) => resolveFollowUps(callModelUrl, String(userQuery), ans, writerSec, todayStr), requiredEndLine);
        const linkedStream = researchFindings.length ? linkCitationsSSE(withFollowUps, researchFindings) : withFollowUps;
        const piped = requiredEndLine ? appendEndLineSSE(linkedStream, requiredEndLine) : linkedStream;
        // v65: PHASE EVENTS — narrate the work that ACTUALLY happened before the
        // token stream starts, so the client's loading state shows real steps
        // ("Searched the web — 6 sources") instead of a generic spinner.
        const phases = buildStepPhases(true);
        const phaseBytes = new TextEncoder().encode(`data: ${JSON.stringify({ phases })}\n\n` + (researchFindings.length ? `data: ${JSON.stringify({ sources: canonicalSourceItems(researchFindings, 18) })}\n\n` : "") + (pImages.length ? `data: ${JSON.stringify({ images: cleanImages(pImages, String(researchQuery), 12) })}\n\n` : "") + (toolCtx.assets?.length ? `data: ${JSON.stringify({ assets: toolCtx.assets })}\n\n` : "") + (toolCtx.actions?.length ? `data: ${JSON.stringify({ actions: toolCtx.actions })}\n\n` : ""));
        // v97 I7 STREAM PASS-2: accumulate the streamed answer; after the upstream finishes (before close) run the deterministic
        // preflight and, on raw markers / tool syntax / CJK leak / truncation, ONE self-check attempt (45s cap). An accepted
        // revision is sent as {"revision": "<full text>"} so the client replaces the answer. The upstream [DONE] is held back
        // and re-emitted after the revision so it always lands inside the stream.
        const streamPass2Ok = !apiKeyMode && !imageUrl && !spaceInstructions;
        let streamFinalAnswer = "";   // v190: captured so settleOnEnd can persist the turn server-side
        const combined = apiKeyMode ? null : new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder(), dec = new TextDecoder();
            controller.enqueue(phaseBytes);
            const reader = (piped as ReadableStream<Uint8Array>).getReader();
            let acc = "", lineBuf = "", sawDone = false, extra: string[] = [];
            const eat = (txt: string) => {
              lineBuf += txt;
              let i: number;
              while ((i = lineBuf.indexOf("\n")) >= 0) {
                const ln = lineBuf.slice(0, i).trim(); lineBuf = lineBuf.slice(i + 1);
                if (!ln.startsWith("data:")) continue;
                const d = ln.slice(5).trim();
                if (!d || d === "[DONE]") continue;
                try { const j = JSON.parse(d); const c = j?.choices?.[0]?.delta?.content; if (typeof c === "string") acc += c; } catch { /* non-delta event */ }
              }
            };
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                // v127 (stress-250 #4): always track the streamed text and hold back [DONE] so the final x_meta event can precede it.
                const txt = dec.decode(value, { stream: true });
                eat(txt);
                if (txt.includes("data: [DONE]")) { sawDone = true; controller.enqueue(enc.encode(txt.replace(/data: \[DONE\]\s*(\r?\n)*/g, ""))); }
                else controller.enqueue(value);
              }
              let finalText = acc.trim();
              if (streamPass2Ok) {
                try {
                  const answer = acc.trim();
                  const kinds = answer.length >= 80 ? preflight(answer, { findings: researchFindings, userQuery: String(userQuery) }).map((i) => i.kind) : [];
                  const trig = kinds.some((k) => k === "raw_marker" || k === "tool_syntax" || k === "cjk_leak" || k === "unfinished");
                  const budget = Math.min(45_000, 115_000 - (Date.now() - reqStart));
                  if (trig && budget >= 5_000) {
                    const sc = await selfCheckPass({
                      callModelUrl, model: PASS2_MODEL, gatewayToken: GW_TOKEN, draft: answer,
                      findings: researchFindings, researchText: perplexityFullText,
                      evidence: (toolLoop?.evidence || "") + (autoAsset?.evidence || ""),
                      toolsUsed: [...(toolLoop?.used ? toolLoop.trace?.map((t: any) => t.tool) ?? [] : []), ...(autoAsset?.trace || []).filter((t) => t.ok).map((t) => t.tool)],
                      userQuery: String(userQuery), timeoutMs: budget
                    });
                    if (sc.applied !== "none" && sc.text.trim().length >= 40) {
                      const scText = unwindDoubleEncodedUrls(sc.text);
                      controller.enqueue(enc.encode(`data: ${JSON.stringify({ revision: scText })}\n\n`));
                      finalText = scText.trim();
                      controller.enqueue(enc.encode(`data: ${JSON.stringify({ x_selfcheck: { applied: sc.applied, before: sc.issues_before.map((i) => i.kind), after: sc.issues_after.map((i) => i.kind), note: sc.note } })}\n\n`));
                    } else controller.enqueue(enc.encode(`data: ${JSON.stringify({ x_selfcheck: { applied: "none", before: sc.issues_before.map((i) => i.kind), note: sc.note } })}\n\n`));
                  }
                } catch (_e) { /* fail open: the streamed answer stands */ }
              }
              // CYCLE 2 GAP 2 (streaming): credential scrub on the finished stream. Deltas already went out live, so a hit is delivered as a
              // {"revision": <full scrubbed text>} event (client replaces the answer) plus x_redacted. Runs for every stream, with or without pass-2.
              let credRedactedStream = 0;
              try {
                if (finalText) {
                  const cs = scrubCredentials(finalText, { allowUrls: researchFindings.map((f) => f.url), knownSecrets: harvestedSecrets });
                  if (cs.changed) {
                    const csText = unwindDoubleEncodedUrls(cs.text);
                    controller.enqueue(enc.encode(`data: ${JSON.stringify({ revision: csText })}\n\n`));
                    controller.enqueue(enc.encode(`data: ${JSON.stringify({ x_redacted: { count: cs.count, kinds: cs.kinds } })}\n\n`));
                    finalText = csText; credRedactedStream = cs.count;
                  }
                }
              } catch (_e) { /* fail open: scrub is best-effort on the stream; the final-text check below still reports */ }
              // v127: final summary event (same fields the non-stream JSON / ProgressSink re-frame carry), before [DONE].
              try {
                const meta: Record<string, unknown> = {};
                if (finalText) {
                  const dr = detectDeadEnd(finalText);
                  meta.x_dead_end = deadEndMarker(dr);
                  meta.x_quality = { verdict_initial: dr.verdict, verdict: dr.verdict, action_kind: dr.action_kind, offer_only: dr.verdict === "limitation_with_action" && dr.action_kind === "offer", rewritten: false };
                }
                meta.x_research = { sources: researchFindings.length, sub_questions: subResearchCount, intent_ok: intentOk, cite_align: citeAlign, zero_result_discard: zeroResultDiscard, lane: researchLane, skipped: researchSkip || null, detail: researchDetail || null, complexity: intent.complexity };
                if (credRedactedStream) meta.x_redacted = { count: credRedactedStream };
                if (toolCtx.plan?.length) meta.x_plan = toolCtx.plan.map((p: any) => ({ n: p.n, text: p.text, status: p.status, evidence: p.evidence }));
                try { settledActual = computeActualCost(String(intent?.complexity || ""), 0, Math.ceil(finalText.length / 4)); } catch (_sc) { /* settle falls back to creditHold */ }
                controller.enqueue(enc.encode(`data: ${JSON.stringify({ x_meta: meta })}\n\n`));
              } catch (_e) { /* fail open */ }
              if (sawDone || !streamPass2Ok) controller.enqueue(enc.encode("data: [DONE]\n\n"));
              streamFinalAnswer = finalText;   // v190: capture for server-side persistence
              controller.close();
            } catch (e) { controller.error(e); }
          }
        });
        const outStream = apiKeyMode ? openAIStreamFilter(scrubSSEStream(piped as ReadableStream<Uint8Array>, researchFindings.map((f) => f.url), harvestedSecrets), finalModel) : combined!; // OpenAI clients get only chat.completion.chunk frames
        // v173: STREAMING CREDIT SETTLE — the streaming branch returns before the non-streaming
        // settleCredits() at the bottom, so holds leaked until the reserve timeout refunded them.
        // Wrap the outgoing stream: settle fires when the stream flushes (normal end) OR is
        // cancelled (client disconnect) — either way the answer was delivered/attempted, so the
        // hold converts to a charge instead of leaking. waitUntil keeps it alive past the return.
        const settleOnEnd = new TransformStream<Uint8Array, Uint8Array>({
          // v190: settle + SERVER-SIDE TURN PERSISTENCE on stream end or client disconnect —
          // the turn survives even if the browser window closed / machine slept mid-generation.
          flush() { try { settleCredits(creditHold); } catch (_e) { /* fail open */ } try { persistTurnServerSide(streamFinalAnswer); } catch (_e2) { /* fail open */ } },
          cancel() { try { settleCredits(creditHold); } catch (_e) { /* fail open */ } try { persistTurnServerSide(streamFinalAnswer); } catch (_e2) { /* fail open */ } }
        });
        return new Response(outStream.pipeThrough(settleOnEnd), { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "x-model": finalModel, ...(routed ? { "x-routed-model": routed.model, "x-routed-task": routed.task } : {}) } });
      }
      // Upstream didn't stream (fallback) — continue via the normal path
      res = sres;
      try { data = await sres.json(); } catch { data = {}; }
    } else if (toolLoop?.finalData) {
      // The loop already produced the plain-text answer with the same system prompt, user context,
      // research findings and tool results. Reuse it; QA below runs on it exactly as before.
      res = new Response(null, { status: 200 });
      data = toolLoop.finalData;
      delete data.x_tools_passthrough;
    } else {
      // v83: a timeout/abort here used to throw to the outer catch and 500 the request even with research in hand.
      try {
        res = await fetch(callModelUrl, {
          method: "POST",
          headers: GW_HEADERS,
          body: JSON.stringify({ messages: capped, purpose, model: writerModel, reasoning_effort: writerEffort, max_tokens: tokenBudget }),
          signal: AbortSignal.timeout(120_000)
        });
        data = await res.json();
      } catch (_e) { res = new Response(null, { status: 502 }); data = {}; }
    }

    // ============================================================
    // AGENT 4: QA AGENT (verifies and polishes if needed)
    // ============================================================
    let finalResponse = data;
    let content = data?.choices?.[0]?.message?.content || "";
    const finishReason = data?.choices?.[0]?.finish_reason || "";

    // QA check 0: empty OR truncated content — retry once with the full token budget.
    // Reasoning models can burn the whole max_tokens budget on reasoning and
    // return content=null, or cut the answer off mid-sentence (finish_reason=length).
    const looksTruncated = content.length > 0 && !/[.!?:\"'\u201d\u2019)]\s*$/.test(content.trim());
    if ((!content || finishReason === "length" || (looksTruncated && content.length > 400 && intent.complexity !== "simple")) && timeOk(95_000)) {
      // If truncated (not blank), instruct the model to complete more concisely
      // so the full answer fits the budget instead of truncating again.
      // Guarded: a failed retry must NEVER 500 the request — fall back to the
      // original answer (truncated but present) instead.
      try {
      const retryMessages = finishReason === "length" && content
        ? [...capped, { role: "system", content: "Your previous response was cut off by the token limit. Rewrite the COMPLETE answer in UNDER 500 WORDS — remove all filler, repetition, and padding, keep only the essential points and the most important specifics. You MUST finish with the Suggested Follow-ups section." }]
        : capped;
      const retryRes = await fetch(callModelUrl, {
        method: "POST",
        headers: GW_HEADERS,
        // Retry with the SAME purpose at the full budget plus a hard word limit —
        // the word limit also shrinks the reasoning burn, so the answer completes.
        // (Do NOT route retries to the "summary" purpose — that model is on a
        // ~1,000-token-per-minute Groq rate limit and silently fails.)
        body: JSON.stringify({ messages: retryMessages, purpose, model: finalModel, reasoning_effort: "low", max_tokens: 4000 }),
        signal: AbortSignal.timeout(120_000)
      });
      const retryData = await retryRes.json();
      const retryContent = retryData?.choices?.[0]?.message?.content || "";
      const retryFinish = retryData?.choices?.[0]?.finish_reason || "";
      // Prefer a COMPLETE answer (finish=stop) over a truncated one, even if
      // the truncated one is longer. Otherwise prefer the longer answer.
      if (retryContent.length > content.length || (retryFinish === "stop" && finishReason === "length")) {
        finalResponse = retryData;
        content = retryContent;
      }
      } catch (e) { /* retry failed — keep the original answer, never 500 */ }
    }
    
    // QA check 1: too short for complex questions (guarded — failed QA retries never 500)
    // (v83: skipped for EMPTY content — check 0 already retried; the last-resort stage below handles it — and when the clock is short)
    if (content.length > 0 && content.length < 300 && intent.complexity !== "simple" && timeOk()) {
      try {
      const retryRes = await fetch(callModelUrl, {
        method: "POST",
        headers: GW_HEADERS,
        body: JSON.stringify({ messages: [...capped, { role: "system", content: "QA REVIEW: Your previous response was too brief. Provide the complete, comprehensive answer with all relevant sections, data, and follow-ups. Professional, helpful tone." }], purpose, model: finalModel, reasoning_effort: reasoningEffort(intent.complexity), max_tokens: 4000 }),
        signal: AbortSignal.timeout(90_000)
      });
      const retryData = await retryRes.json();
      if ((retryData?.choices?.[0]?.message?.content || "").length > content.length) {
        finalResponse = retryData;
      }
      } catch (e) { /* keep original */ }
    }
    
    // QA check 2: no headings in a complex response (guarded)
    const finalContent = finalResponse?.choices?.[0]?.message?.content || "";
    if (finalContent.length > 0 && !finalContent.includes("##") && intent.complexity !== "simple" && timeOk()) {
      try {
      const fixRes = await fetch(callModelUrl, {
        method: "POST",
        headers: GW_HEADERS,
        body: JSON.stringify({ messages: [...capped, { role: "system", content: "QA REVIEW: Your previous response lacked proper markdown structure. Restructure with clear headings (##, ###), sections, and lists. Professional, helpful tone." }], purpose, model: finalModel, reasoning_effort: reasoningEffort(intent.complexity), max_tokens: 4000 }),
        signal: AbortSignal.timeout(90_000)
      });
      const fixData = await fixRes.json();
      if ((fixData?.choices?.[0]?.message?.content || "").includes("##")) {
        finalResponse = fixData;
      }
      } catch (e) { /* keep original */ }
    }

    // QA check 2.5: TOOL-SYNTAX / SELF-DIALOGUE LEAK. Any answer that contains
    // role-played tool calls (fenced "web_search(...)" blocks) or scratch monologue
    // ("Wait — I already have the results… let me try once more") is NOT a final
    // answer. Scrub the tool-call blocks; if the residue still reads as scratch,
    // retry once demanding a clean final answer.
    {
      const curContent = finalResponse?.choices?.[0]?.message?.content || "";
      const toolSyntax = /```\s*[a-z_]*\s*\n?\s*(web_search|calculator|search_my_context|query_comptrove)\s*\(/i.test(curContent)
        || /^\s*[^\w\n]{0,3}\s*(web_search|calculator|search_my_context|query_comptrove)\s*\(/im.test(curContent)
        || /[^\w\n]{0,3}(web_search|calculator|search_my_context|query_comptrove)\s*\(\s*"/.test(curContent)
        || /\b(web_search|query_comptrove|search_my_context)\b/i.test(curContent);
      const selfDialogue = /^\s*(wait|hm+|ok+|alright|let me|I('ll| will| already| need| just| don't)\b)/im.test(curContent.trim())
        && /(let me try|one more|already (have|made)|finali[sz]e|didn't return usable)/i.test(curContent);
      if ((toolSyntax || selfDialogue) && timeOk()) {
        try {
          const cleanRes = await fetch(callModelUrl, {
            method: "POST",
            headers: GW_HEADERS,
            body: JSON.stringify({ messages: [...capped, { role: "system", content: "QA REVIEW: Your previous response contained tool-call syntax or working notes to yourself. Produce ONLY the clean final answer for the user: no tool calls, no code fences around tool names, no monologue about searching or verifying, no mention of what you could not retrieve unless it is essential. Start directly with the answer." }], purpose, model: finalModel, reasoning_effort: reasoningEffort(intent.complexity), max_tokens: 4000 }),
            signal: AbortSignal.timeout(90_000)
          });
          const cleanData = await cleanRes.json();
          const cleanText = cleanData?.choices?.[0]?.message?.content || "";
          const stillDirty = /```\s*[a-z_]*\s*\n?\s*(web_search|calculator|search_my_context|query_comptrove)\s*\(/i.test(cleanText) || /^\s*[^\w\n]{0,3}\s*(web_search|calculator|search_my_context|query_comptrove)\s*\(/im.test(cleanText);
          if (cleanText.length > 80) finalResponse = cleanData; // scrub below removes any residue
        } catch (e) { /* keep original */ }
      }
    }

    // QA check 3: research findings exist but the answer cites NONE of them.
    // (Seen on simple-intent news questions: correct facts, zero [N] markers,
    // so the client renders no Sources section at all.) Retry once demanding
    // inline citations. Guarded — a failed retry never 500s.
    {
      const curContent = finalResponse?.choices?.[0]?.message?.content || "";
      if (researchFindings.length && curContent.length > 80 && !/\[\d+\]/.test(curContent) && timeOk()) {
        try {
          const citeRes = await fetch(callModelUrl, {
            method: "POST",
            headers: GW_HEADERS,
            body: JSON.stringify({ messages: [...capped, { role: "system", content: "QA REVIEW: Your previous response cited no sources. Rewrite it with inline [N] citation markers for every factual claim drawn from the numbered findings (for example: \"The Seahawks won 29–13 [1].\"). Keep the same content, structure, and length." }], purpose, model: finalModel, reasoning_effort: reasoningEffort(intent.complexity), max_tokens: 4000 }),
            signal: AbortSignal.timeout(90_000)
          });
          const citeData = await citeRes.json();
          const citeText = citeData?.choices?.[0]?.message?.content || "";
          if (/\[\d+\]/.test(citeText) && citeText.length > 80) {
            finalResponse = citeData;
          }
        } catch (e) { /* keep original */ }
      }
    }

    // v83 LAST-RESORT STAGE — the answer-quality floor. Runs after every QA retry.
    //  (a) Empty / near-empty writer output  -> deliver the research lane's text directly (or, with no
    //      research, a reliable-model rewrite). The user never sees "(no response)" with live text in hand.
    //  (b) Writer output MUCH shorter than a substantial live-search answer (the GLM rewrite degraded it)
    //      -> prefer the research text. Skipped for simple intents and when the member set space
    //      instructions (a terse writer is then intentional).
    // The replacement flows through the SCRUB and NUMBERED CITATIONS blocks below, so [N] markers get
    // linked and a Sources list is appended exactly like a model answer.
    let fallbackReason = "";
    let outStatus = res.status;
    {
      const cur = String(finalResponse?.choices?.[0]?.message?.content || "");
      const curLen = cur.trim().length;
      const thin = curLen < (intent.complexity === "simple" ? 40 : 100);
      const rText = researchFallbackText();
      let replacement = "";
      if (thin) {
        if (rText && rText.length > curLen) { replacement = rText; fallbackReason = perplexityFullText ? "empty_writer_used_live_search_text" : "empty_writer_used_findings_digest"; }
        else if (!rText && curLen === 0) { replacement = await reliableModelAnswer(); if (replacement) fallbackReason = "empty_writer_used_reliable_model"; }
      } else if (perplexityFullText.length >= 800 && !spaceInstructions && intent.complexity !== "simple" && !isSystemQuestion && curLen < perplexityFullText.length * 0.3) {
        replacement = rText; fallbackReason = "writer_much_shorter_than_live_search_text";
      }
      if (replacement) {
        finalResponse = {
          id: finalResponse?.id || "gw-fallback", object: "chat.completion", model: finalResponse?.model || finalModel,
          choices: [{ index: 0, message: { role: "assistant", content: replacement }, finish_reason: "stop" }],
          ...(finalResponse?.usage ? { usage: finalResponse.usage } : {})
        };
        outStatus = 200;
      }
    }

    // v92 I1 NEVER-REFUSE (gateway level, non-streaming): a short answer that is a bare "I can't do X from here" gets ONE
    // rewrite that must deliver the executed fallback (complete ready-to-apply artifact), not homework.
    let verdictInitial = ""; // v103: verdict of the first draft, reported in x_quality (x_dead_end reports the FINAL answer)
    {
      const cur0 = String(finalResponse?.choices?.[0]?.message?.content || "");
      // empty content IS a dead end (nothing delivered) — keep telemetry present and let the I1 rewrite try to fill it
      const deadEnd0: DeadEndReport | null = cur0.length > 0 ? detectDeadEnd(cur0) : { verdict: "dead_end", flagged: true, refusal_hits: [], homework_hits: [], offer_hits: [], action_evidence: [], action_kind: "none", substantive_chars: 0, homework_ratio: 0 };
      if (deadEnd0) { verdictInitial = deadEnd0.verdict; if (!incognito) tallyAnswer(finalModel, deadEnd0); }
      if (deadEnd0?.flagged && !spaceInstructions && timeOk(100_000)) {
        try {
          const rr = await fetch(callModelUrl, {
            method: "POST",
            headers: GW_HEADERS,
            body: JSON.stringify({ messages: [...capped, { role: "assistant", content: cur0 }, { role: "system", content: "POLICY REWRITE: your previous reply refused or deferred the task (\"I can't do that from here\"). Rewrite it so it never ends in a bare limitation: do everything within reach and deliver the COMPLETE, ready-to-apply result as the executed fallback (exact file contents, patch, commands, or filled-in copy, using the research and context above). State any real limitation in ONE short sentence AFTER the delivered work, never as the answer. No homework, no 'you can do this yourself'." }], purpose, model: writerModel, reasoning_effort: "medium", max_tokens: 4000 }),
            signal: AbortSignal.timeout(90_000)
          });
          const rd = await rr.json();
          const rc = String(rd?.choices?.[0]?.message?.content || "").trim();
          if (rc.length >= 100 && !detectDeadEnd(rc).flagged) { finalResponse = rd; fallbackReason = fallbackReason || "refusal_rewritten"; }
        } catch (_e) { /* keep the original answer */ }
      }
    }

    // v188 CLAIM-CAN'T REWRITE GUARD (owner incident 2026-11-12): the GO-closure answer
    // "I can't safely close these jobs — not defined anywhere" was long and substantive,
    // so the v92 dead-end detector did not flag it — the refusal was the thesis, not a bare
    // "I can't". When the turn was a closure directive (or a handoff-doc inoculation) and
    // the final answer still claims no execution / paste-ready artifacts, do ONE targeted
    // rewrite that must lead with what the platform actually did and what tools exist.
    {
      const curC = String(finalResponse?.choices?.[0]?.message?.content || "");
      const claimCant = /i can'?t safely|i can'?t pull live status|no migration ledger .* exists|drop the repo url|what i cannot do from this session|not defined anywhere in (this|the) conversation|no (tool output|live execution)|nothing was fired|cannot reach (fly|supabase|github)|paste[- ]ready|this reply cannot/i.test(curC);
      if (claimCant && (closureAsk || handoffDoc || estateAsk || executeArtifactsAsk) && !spaceInstructions && timeOk(100_000)) {
        try {
          const rr = await fetch(callModelUrl, {
            method: "POST",
            headers: GW_HEADERS,
            body: JSON.stringify({ messages: [...capped, { role: "assistant", content: curC }, { role: "system", content: "CLAIM-CAN'T REWRITE (v188): your previous reply claimed you cannot execute (\"I can't safely close\", \"no live execution\", \"nothing was fired\", or paste-ready artifacts instead of execution). That is false for this system: live execution tools ARE connected (run_runner_job, runner_job_status, github_write, github_search_*, query_comptrove, dispatch_fleet, browser_step, run_python) and the platform already queued the user's directive to the ops fleet. Rewrite the answer to lead with what was actually dispatched/executed (quote the dispatch id and any tool results above), enumerate the concrete next closures with owners, and state at most ONE short sentence of real remaining limits (owner-only approvals). No paste-ready homework blocks." }], purpose, model: writerModel, reasoning_effort: "medium", max_tokens: 4000 }),
            signal: AbortSignal.timeout(90_000)
          });
          const rd = await rr.json();
          const rc = String(rd?.choices?.[0]?.message?.content || "").trim();
          if (rc.length >= 100 && !/i can'?t safely|not defined anywhere|no live execution|nothing was fired|paste[- ]ready/i.test(rc)) { finalResponse = rd; fallbackReason = fallbackReason || "claim_cant_rewritten"; }
        } catch (_e) { /* keep the original answer */ }
      }
    }

    // FINAL SCRUB (last resort): strip any role-played tool-call blocks that still
    // slipped through QA — including UNCLOSED fences (an opening fence with a
    // web_search call and no closing fence), bare call lines, and "my tools are not
    // available" meta commentary.
    // Never leaves tool syntax or scratch monologue in a user answer.
    if (finalResponse?.choices?.[0]?.message?.content) {
      const scrubbed = (finalResponse.choices[0].message.content as string)
        .replace(/```\s*[a-z_]*\s*\n?\s*(?:web_search|calculator|search_my_context|query_comptrove)\s*\([\s\S]*?\n?```/gi, "")
        .replace(/```[^\n]{0,4}(?:web_search|calculator|search_my_context|query_comptrove)\s*\([^\n]*/gi, "")
        .replace(/```\s*[a-z_]*\s*\n?\s*(?:web_search|calculator|search_my_context|query_comptrove)\s*\([^\n]*/gi, "")
        .replace(/^\s*[^\w\n]{0,3}\s*(?:web_search|calculator|search_my_context|query_comptrove)\s*\([^\n]*\)?\s*$/gim, "")
        .replace(/[^\w\n]{0,3}(?:web_search|calculator|search_my_context|query_comptrove)\s*\(\s*"[^"]*"\s*\)/g, "")
        .replace(/^[^\n]*(?:tools (?:used|available|called)[^\n]*(?:not available|are unavailable|weren'?t)|answer[^\n]*directly without (?:web search|context tools))[^\n]*\n?/gim, "")
        .replace(/^\s*(?:wait|hm+|let me (?:try|check|search|finalize))[^\n]*\n/gim, "")
        .replace(/^[^\n]*\b(?:web_search|query_comptrove|search_my_context)\b[^\n]*\n?/gim, "")
        .replace(/^\s*[^\w\s\n"'\u201c\[(#*>_\-=.:,;!?\u2014\u2013-]{1,8}\s*/u, "")
        // SI-6: drop a visible self-correction left in a parenthetical ("(e.g., 17+ orders ... actually that's wrong: $100,000 / $62 ...)")
        .replace(/\(([^()\n]{0,200}?)(?:\.{3}|\u2026)\s*(?:actually|wait|hmm|oops)\b[^:()\n]{0,60}:\s*/gi, "(")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (scrubbed.length > 40) finalResponse.choices[0].message.content = scrubbed;
    }

    // CYCLE 2 GAP 2 (non-streaming): credential scrub #1 — before pass-2 so the self-check never re-reads a secret. Shared helper (credential-scrub.ts).
    let credRedactions = 0;
    if (finalResponse?.choices?.[0]?.message?.content && typeof finalResponse.choices[0].message.content === "string") {
      const cs = scrubCredentials(finalResponse.choices[0].message.content as string, { allowUrls: researchFindings.map((f) => f.url), knownSecrets: harvestedSecrets });
      if (cs.changed) { finalResponse.choices[0].message.content = cs.text; credRedactions += cs.count; fallbackReason = fallbackReason || "credential_redacted"; }
    }

    // v95 I7 WRITER PASS-2 (non-streaming): one cheap re-read of the near-final draft. Runs before follow-ups and before
    // NUMBERED CITATIONS so the checker still sees bare [N] markers. Only calls a model when preflight finds an issue.
    if (finalResponse?.choices?.[0]?.message?.content && !imageUrl && !spaceInstructions && String(finalResponse.choices[0].message.content).length >= 80 && timeOk(105_000)) {
      try {
        const sc = await selfCheckPass({
          callModelUrl, model: PASS2_MODEL, gatewayToken: GW_TOKEN,
          draft: String(finalResponse.choices[0].message.content),
          findings: researchFindings, researchText: perplexityFullText,
          evidence: (toolLoop?.evidence || "") + (autoAsset?.evidence || ""),
          toolsUsed: [...(toolLoop?.used ? toolLoop.trace?.map((t: any) => t.tool) ?? [] : []), ...(autoAsset?.trace || []).filter((t) => t.ok).map((t) => t.tool)],
          userQuery: String(userQuery),
          timeoutMs: Math.max(5_000, Math.min(35_000, 115_000 - (Date.now() - reqStart))),
        });
        if (sc.applied !== "none") { finalResponse.choices[0].message.content = unwindDoubleEncodedUrls(sc.text); fallbackReason = fallbackReason || `selfcheck_${sc.applied}`; }
        finalResponse.x_selfcheck = { applied: sc.applied, before: sc.issues_before.map((i) => i.kind), after: sc.issues_after.map((i) => i.kind), note: sc.note };
      } catch (_e) { /* fail open */ }
    }
    if (!(finalResponse as any).x_selfcheck) (finalResponse as any).x_selfcheck = { applied: "skipped_short_content", before: [], after: [], note: "content too short to self-check" };

    // v84 DEDICATED FOLLOW-UPS (non-streaming): replace the writer's own section with the specific one.
    if (finalResponse?.choices?.[0]?.message?.content && !imageUrl) {
      try {
        const { body: ansBody0, section: writerSec } = stripWriterFollowups(String(finalResponse.choices[0].message.content));
        const ansBody = extractEndLine(spaceInstructions) ? removeEndLine(ansBody0, extractEndLine(spaceInstructions)) : ansBody0;
        const sec = await resolveFollowUps(callModelUrl, String(userQuery), ansBody, writerSec, todayStr);
        finalResponse.choices[0].message.content = sec ? ansBody.replace(/\s+$/, "") + "\n\n" + sec : ansBody;
      } catch (_e) { /* keep content as-is */ }
    }

    // NUMBERED CITATIONS -> real links (Perplexity-style): [N] becomes a clickable marker
    if (researchFindings.length && finalResponse?.choices?.[0]?.message?.content) {
      let cited = finalResponse.choices[0].message.content as string;
      const used: number[] = [];
      // SI-2/SI-3: (a) never touch code fences / inline code; (b) the model sometimes writes its own `[[N](url)]` or
      // `[N](url)` links — collapse those to bare [N] first so we don't wrap a link inside a link (`[[[1](a)](b)]`),
      // and so the chip always points at the same URL the Sources list shows for N.
      const segs = cited.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
      for (let si = 0; si < segs.length; si += 2) {
        segs[si] = segs[si]
          .replace(/\[?\[\[(\d{1,2})\]\(https?:\/\/[^)\s]*\)\]\(https?:\/\/[^)\s]*\)\]?/g, "[$1]")   // [[[1](a)](b)] -> [1]
          .replace(/\[?\[(\d{1,2})\]\(https?:\/\/[^)\s]*\)\]?/g, "[$1]");                                 // [[1](a)] / [1](a) -> [1]
        researchFindings.forEach((f, i) => {
          const re = new RegExp(`(?<!\\[)\\[${i + 1}\\](?!\\()`, "g");
          if (re.test(segs[si])) { if (!used.includes(i + 1)) used.push(i + 1); }
          segs[si] = segs[si].replace(re, `[[${i + 1}](${f.url})]`);
        });
        segs[si] = segs[si].replace(/[ \t]?(?<!\[)\[(\d{1,2})\](?!\()/g, (full: string, n: string) => (Number(n) > researchFindings.length && Number(n) <= 40 ? "" : full));   // SI-5 dangling [N]
      }
      used.sort((a, b) => a - b);
      cited = segs.join("");
      if (used.length) {
        const outlet = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
        cited += "\n\n## Sources\n\n" + used.map(n => `${n}. [${researchFindings[n - 1].title} — ${outlet(researchFindings[n - 1].url)}](${researchFindings[n - 1].url})`).join("\n");
      }
      finalResponse.choices[0].message.content = cited;
    }

    // CYCLE 2 GAP 2 (non-streaming): credential scrub #2 — final sweep over everything the user will see (pass-2 rewrite, follow-ups, Sources).
    if (finalResponse?.choices?.[0]?.message?.content && typeof finalResponse.choices[0].message.content === "string") {
      const cs2 = scrubCredentials(finalResponse.choices[0].message.content as string, { allowUrls: researchFindings.map((f) => f.url), knownSecrets: harvestedSecrets });
      if (cs2.changed) { finalResponse.choices[0].message.content = cs2.text; credRedactions += cs2.count; fallbackReason = fallbackReason || "credential_redacted"; }
      if (credRedactions) finalResponse.x_redacted = { count: credRedactions };
    }

    if (finalResponse && typeof finalResponse === "object") {
      if (fallbackReason) finalResponse.x_fallback = fallbackReason;
      // v103 BUG-047: x_dead_end describes the FINAL delivered answer and is "dead_end" ONLY for a genuine dead end (no work and
      // no concrete commitment). A limitation paired with work or a commitment is "clean_with_caveat". Measurement detail in x_quality.
      {
        const fin = String(finalResponse?.choices?.[0]?.message?.content || "");
        if (fin) {
          const dr = detectDeadEnd(fin);
          finalResponse.x_dead_end = deadEndMarker(dr);
          finalResponse.x_quality = { verdict_initial: verdictInitial || dr.verdict, verdict: dr.verdict, action_kind: dr.action_kind, offer_only: dr.verdict === "limitation_with_action" && dr.action_kind === "offer", rewritten: fallbackReason === "refusal_rewritten" };
        }
      }
      // v175 CREATE-FILE AUTO-INVOCATION: like fetch_asset (v95), the writer model
      // sometimes ANSWERS "the file is ready" without ever calling create_file. When the
      // response claims a file deliverable but no tool call landed, the platform builds it
      // itself from the response's markdown table (or code block) so the user gets a real file.
      if (!apiKeyMode && !toolCtx.assets?.length && toolLoop?.used !== true) {
        try {
          const fin = String(finalResponse?.choices?.[0]?.message?.content || "");
          const m = fin.match(/```(?:tsv|csv)?\n([\s\S]*?)```/) || fin.match(/\|[^\n]*\n\|[-: ]+\|[^\n]*\n((?:\|[^\n]*\n?)+)/);
          if (m && /file|xlsx|docx|pdf|csv|spreadsheet|download/i.test(fin)) {
            let tsv = m[1];
            if (fin.match(/```(?:tsv|csv)?\n[\s\S]*?```/)) { /* code block: already tsv */ }
            else { tsv = tsv.trim().split("\n").map((l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c: string) => c.trim()).join("\t")).join("\n"); }
            const fnameMatch = fin.match(/[a-z0-9._-]+\.(xlsx|csv|docx|pdf)/i);
            const fname = fnameMatch ? fnameMatch[0] : "deliverable.xlsx";
            const fmt = /\.(xlsx|csv|docx|pdf)$/i.test(fname) ? fname.split(".").pop()!.toLowerCase() : "xlsx";
            const out = await toolCreateFile({ filename: fname, format: fmt, content: tsv.slice(0, 60_000), title: "Export" }, toolCtx);
            if (String(out).includes('"ok":true')) console.log("v175 auto create_file:", fname);
          }
        } catch (_cf) { /* best effort */ }
      }
      if (toolCtx.assets?.length) finalResponse.x_assets = toolCtx.assets;
      if (toolCtx.plan?.length) finalResponse.x_plan = toolCtx.plan.map((p: any) => ({ n: p.n, text: p.text, status: p.status, evidence: p.evidence }));   // v103 I8 (v124: + evidence)
      finalResponse.x_plan_decision = { plan: planDec.plan, score: planDec.score, source: toolCtx.plan?.length ? "tool_loop" : planDec.plan ? "writer" : "none", auto_agentic: !!toolCtx.planCompact, python_first: !!toolCtx.pythonFirst };
      if (toolCtx.actions?.length) finalResponse.x_actions = toolCtx.actions; // F15: email/calendar previews; UI shows an Approve card (modules/connectors.js)
      if (toolCtx.proposals?.length) finalResponse.x_proposals = toolCtx.proposals; // UI shows diff + Approve (repo-pr.js)
      if (autoAsset?.trace?.length) finalResponse.x_auto_asset = autoAsset.trace;
      finalResponse.x_phases = buildStepPhases(false);
      if (researchFindings.length) finalResponse.x_sources = canonicalSourceItems(researchFindings, 18); // v128: the one canonical source list
      if (routed) finalResponse.x_routed_model = routed.model, finalResponse.x_routed_task = routed.task;
      if (incognito) finalResponse.x_incognito = true;
      finalResponse.x_search_scope = { sources: sourceSel, domains: searchF.domains.length, recency: searchF.recency || null };
      if (councilRequested) finalResponse.x_council = { models: councilModels, chars: councilChars, synthesized: councilUsed, auto: autoCouncil };
      finalResponse.x_research = { sources: researchFindings.length, sub_questions: subResearchCount, intent_ok: intentOk, cite_align: citeAlign, zero_result_discard: zeroResultDiscard, lane: researchLane, skipped: researchSkip || null, detail: researchDetail || null, complexity: intent.complexity };
      finalResponse.x_tool_loop = toolLoop
        ? { rounds: toolLoop.rounds, used: toolLoop.used, reused_final: !!toolLoop.finalData, tools: toolLoop.trace, skipped: toolLoop.skipped ?? null }
        : { skipped: toolLoopSkip || null };
    }

    // If an image was generated, include it in the response
    if (imageUrl) {
      const currentContent = finalResponse?.choices?.[0]?.message?.content || "";
      finalResponse.choices[0].message.content = currentContent + "\n\n## Generated Image\n\n![Generated image](" + imageUrl + ")\n\n*Image generated by Pollinations.ai (free tier)*\n";
    }

    if (pImages.length) { const imgs = cleanImages(pImages, String(researchQuery), 12); if (imgs.length) finalResponse = { ...finalResponse, images: imgs }; } // v128: dedupe by URL, drop favicons/logos/off-topic cards
    // v127: space-instruction exact ending goes LAST (after follow-ups, Sources, image).
    {
      const endLine = extractEndLine(spaceInstructions);
      const c0 = finalResponse?.choices?.[0]?.message?.content;
      if (endLine && typeof c0 === "string") finalResponse.choices[0].message.content = removeEndLine(c0, endLine) + "\n\n" + endLine;
    }
    // v96 G4: guarantee the standard chat.completion envelope (id/object/created/model/usage) on every non-stream answer.
    if (finalResponse && Array.isArray(finalResponse.choices)) {
      finalResponse.id = finalResponse.id || "chatcmpl-" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      finalResponse.object = "chat.completion";
      finalResponse.created = finalResponse.created || Math.floor(Date.now() / 1000);
      finalResponse.model = finalResponse.model || finalModel;
      finalResponse.choices.forEach((c: any, i: number) => { c.index = c.index ?? i; c.finish_reason = c.finish_reason || "stop"; if (c.message) c.message.role = c.message.role || "assistant"; });
      const u = finalResponse.usage || {};
      finalResponse.usage = { prompt_tokens: Number(u.prompt_tokens) || 0, completion_tokens: Number(u.completion_tokens) || 0, total_tokens: Number(u.total_tokens) || (Number(u.prompt_tokens) || 0) + (Number(u.completion_tokens) || 0), ...u };
    }
    // v190 SESSION PERMANENCE: non-streaming path — persist the turn before returning.
    try { persistTurnServerSide(String(finalResponse?.choices?.[0]?.message?.content || "")); } catch (_pe) { /* never break chat */ }
    // v189 BACKEND ANALYTICS: completion event — routed model, token usage, sources, credit cost.
    try {
      const _u = finalResponse?.usage || {};
      logAnalyticsEvent("completion", { purpose: String(purpose || ""), in_tokens: Number(_u.prompt_tokens) || 0, out_tokens: Number(_u.completion_tokens) || 0, sources: (finalResponse?.x_sources || []).length, tool_loop_rounds: toolLoop?.rounds ?? null, skipped: toolLoopSkip || null }, String((finalResponse as any)?.x_routed_model || finalModel || ""), -(creditHold || 0));
    } catch (_ae) { /* never break chat */ }
    try {
      const _u2 = finalResponse?.usage || {};
      settledActual = computeActualCost(String(intent?.complexity || ""), Number(_u2.prompt_tokens) || 0, Number(_u2.completion_tokens) || 0);
    } catch (_sc2) { /* settle falls back to creditHold */ }
    settleCredits(creditHold);   // v172: settle the hold at actual cost (answer delivered; deep-research background jobs settle separately)
    return new Response(JSON.stringify(finalResponse), { status: outStatus, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    // hardening: never leak raw engine error class/message to clients; log details server-side only
    console.error("gateway-chat unhandled error:", e instanceof Error ? (e.stack || `${e.name}: ${e.message}`) : String(e));
    return new Response(JSON.stringify(apiKeyMode ? oaiError("internal error", "api_error", "internal_error") : { error: "internal error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
}
