// deep-brief.ts — worse-elimination (2026-11-10). Pure Deno/Web, no imports.
// The Deep Research run used to be submitted with the raw question only (no `instructions`, max_steps 10, default output
// budget). In the 100-query replay that produced 1.4-5.4K-char answers against 9-45K-char reference reports (5 of 11 WORSE)
// and thin entity coverage (BART / LA Metro missing from the transit-land answer). This file is the single source for:
//   - DEEP_INSTRUCTIONS: report-grade brief (decompose -> research every sub-question -> sectioned report, dense citations, dated figures)
//   - DEEP_MAX_STEPS / DEEP_MAX_OUTPUT_TOKENS: research-loop and writer budgets
//   - isImageGenAsk: "generate IMAGES / I need to see designs" must not be answered with SVG source by a text-only deep run
//   - isClarifierAnswer: a short reply that answers the assistant's own questions ("(1) yes ... (2) no ...") is a continuation,
//     not a "simple" question — the deliverable promised earlier (revised letter, memo, plan) must be produced in full.

export const DEEP_MAX_STEPS = 18;            // was 10: more search/read loops = more sub-questions actually researched
export const DEEP_MAX_OUTPUT_TOKENS = 16000; // ~60K chars ceiling; the reference reports run 10-45K chars

// v262 ASYNC RESEARCH LANE — concise brief for short-answer research questions (BrowseComp-class).
// The report brief (deepInstructions) targets 2,500-5,000-word deliverables; benchmark and
// factual single-answer questions need persistent constraint-verified research with a terse
// FINAL ANSWER line instead. Same multi-hop persistence, none of the report scaffolding.
export function deepConciseInstructions(today: string): string {
  return [
    `You are answering ONE research question whose answer is short (a name, date, number, or a set of items). Today is ${today}.`,
    `PERSIST: this question is hard because the answer is buried behind multiple hops. Decompose it into its explicit constraints (dates, categories, thresholds, relationships). Run MANY searches — one per constraint and one per candidate — and read the actual pages. Do not stop at the first plausible candidate; enumerate 3-6 candidates and test EACH against every constraint. An answer matching MOST constraints is WRONG — only a candidate satisfying ALL of them counts.`,
    `VERIFY: cite the source for every constraint check. When sources disagree, prefer primary and recent sources and say so in one line. If genuinely nothing satisfies all constraints, state that plainly — never guess.`,
    `END: your reply must end with a final line of exactly "FINAL ANSWER: <answer>" — for set questions the COMPLETE comma-separated list of every qualifying item and nothing else (no padding with near-misses: an item failing ANY constraint never appears on that line).`,
  ].join("\n");
}

export function deepInstructions(today: string, followUp = false): string {
  return [
    `You are a deep-research analyst writing a decision-grade report. Today is ${today}; treat anything older than 12 months as possibly stale and say so.`,
    `PROCESS: first decompose the request into 6-10 concrete sub-questions (every entity, program, statute, party, scenario or metric the question touches, plus the obvious adjacent question the user will ask next). Research EACH sub-question with its own searches; do not stop after the first good answer. When the user asks "has X happened / who has done Y / what types of Z", enumerate ALL major examples you can find (at least 4-6 distinct entities or cases), not just the first one.`,
    `SOURCES: prefer primary sources (statute and regulation text, agency and program pages, filings, court documents, official PDFs) over blogs and aggregators; confirm every key figure, date and legal rule with at least two independent sources where possible, and say plainly when sources disagree or a figure could not be verified.`,
    `FORMAT: open with a 2-4 sentence direct answer (bottom line first, no preamble, no "I will now..." narration). Then write a structured report with ## headings per sub-question, ### sub-headings where useful, and a markdown table whenever you compare 3+ items or give numbers (agencies, programs, costs, scenarios, deadlines). Target 2,500-5,000 words for a research question (multi-party, legal, scenario or multi-entity questions: be exhaustive - cover every party, program, scenario and variant, each with its own subsection, table and citations); shorter only if the question is genuinely narrow AND self-contained.`,
    `CITATIONS: cite inline after EVERY factual sentence, table row or figure using the search-result citation markers; a section with no citations is a defect. Include dates ("as of March 2026") next to figures that change over time.`,
    `NUMBERS: for any cost, rate, percentage, ownership split or deadline, show the arithmetic (inputs x assumptions = result), give a low / base / high range when inputs are uncertain, and re-check any total the user quotes against its components instead of agreeing or disagreeing from memory.`,
    `LEGAL AND REGULATORY QUESTIONS: name the controlling statute / rule / case with its section number or citation, state the exception tests and counter-arguments, distinguish settled law from open questions, cover each fact pattern the user mentioned (and the 2-3 most likely variants), and finish with concrete next steps. Add one brief line that this is research, not legal advice - do not repeat it.`,
    `END WITH: "## Confidence and what to verify" (3-5 bullets: what is well-sourced, what is inferred, what the user should confirm with a professional or primary document) and "## Suggested next steps".`,
    DOCUMENT_RULE,
    WEBAPP_RULE,
    VERIFY_RULE,
    `If the request depends on an attachment or file that is not in the conversation, say so in one sentence and still do the most useful research you can on the stated topic.`,
    `If the user is clarifying or correcting an earlier turn, apply it to the full thread context and deliver the complete updated work product, not a summary of what changed.`,
    ...(followUp ? [DEEP_FOLLOWUP_RULE] : []),
  ].join("\n");
}

/** Conversational request for real images/designs/renders ("I need you to generate IMAGES though - I need to actually see designs"). */
export function isImageGenAsk(query: string): boolean {
  const q = String(query || "");
  if (q.length > 600) return false;
  const verb = /\b(generate|create|make|render|produce|draw|design|show|give)\b/i;
  const noun = /\b(images?|pictures?|photos?|renders?|renderings?|mock-?ups?|visuals?|illustrations?)\b/i;
  const seeIt = /\b(actually|really)?\s*(see|visuali[sz]e)\b.{0,30}\b(designs?|it|them|this|these|renders?|room|space)\b/i;
  const imageWord = /\b(images?|pictures?|renders?|renderings?|mock-?ups?)\b/i;
  if (verb.test(q) && noun.test(q)) return true;
  if (/\bneed\b.{0,20}\bimages?\b/i.test(q)) return true;
  if (seeIt.test(q) && imageWord.test(q)) return true;
  return false;
}

/** A short reply that answers the assistant's previous questions. messages = full thread incl. the last user turn. */
export function isClarifierAnswer(messages: Array<{ role?: string; content?: unknown }>): boolean {
  const arr = Array.isArray(messages) ? messages : [];
  if (arr.length < 3) return false;
  const last = arr[arr.length - 1];
  if (last?.role !== "user" || typeof last.content !== "string") return false;
  const words = last.content.trim().split(/\s+/).filter(Boolean).length;
  if (words > 90) return false;
  let prevA: string | null = null;
  for (let i = arr.length - 2; i >= 0; i--) { if (arr[i]?.role === "assistant") { prevA = typeof arr[i].content === "string" ? String(arr[i].content) : ""; break; } }
  if (!prevA) return false;
  const tail = prevA.slice(-1500);
  const asksQuestions = (tail.match(/\?/g) || []).length >= 1;
  const numberedAnswers = /(^|\s)\(?[1-3][).:-]\s/.test(last.content) || /^\s*(yes|no|correct|right|exactly|those|that|they|it|we|i)\b/i.test(last.content);
  const deliverable = /\b(letter|draft|memo|brief|agreement|email|report|plan|proposal|contract|revis(?:e|ed|ion)|rewrite|update[sd]?)\b/i.test(arr.slice(-8).map((m) => (typeof m?.content === "string" ? m.content : "")).join(" ").slice(0, 12000));
  return asksQuestions && numberedAnswers && deliverable;
}

/** A short conversational follow-up (<=40 words) that leans on the earlier thread ("can you include both bed count and unit count",
 *  "put all of this back in table format", "what are other similar deals like this in america?"). The v134 run answered these in
 *  80-500 chars (ratio 0.01-0.1 vs 3-5K-char references). They must be re-researched/re-delivered as a full standalone report. */
export function isShortFollowUp(messages: Array<{ role?: string; content?: unknown }>): boolean {
  const arr = Array.isArray(messages) ? messages : [];
  const last = arr[arr.length - 1];
  if (last?.role !== "user" || typeof last.content !== "string") return false;
  if (!arr.slice(0, -1).some((m) => m?.role === "assistant")) return false;
  const words = last.content.trim().split(/\s+/).filter(Boolean).length;
  return words > 0 && words <= 40;
}

export const DEEP_FOLLOWUP_RULE =
  "FOLLOW-UP: the current request is a short follow-up that refers to the earlier conversation. NEVER answer in one or two lines, with a clarifying question, or with only the delta. Resolve every pronoun and 'this/those/the table' against the earlier conversation, then deliver the COMPLETE, standalone updated work product (the full table / analysis / list, rebuilt end to end with the requested change applied, every row and entity retained), followed by fresh research that extends it (additional comparable deals, entities, figures, rules), with ## headings, tables and inline citations, at the same depth as a first-turn report. If you disagree with a premise the member states, say so first with the evidence, then still deliver the full corrected work.";

export const CLARIFIER_CONTINUATION_RULE =
  "CONTINUATION: the member's latest message answers the questions you asked earlier. Do NOT respond with guidance, a framing note or a list of tips. Apply their answers and DELIVER the complete work product that was being built (the full revised letter / memo / plan / document, start to finish, ready to paste), then add at most a short list of remaining caveats after it.";

export const COMPLEX_DEPTH_RULE =
  "DEPTH: this is a research-grade, multi-part request. Address EVERY part the member listed, each under its own ## heading, with concrete names, figures, sources and an ordered build/ingest/decision sequence where relevant. Use a table when comparing options. Do not compress to a summary or stop after the first few items; a thorough answer here runs well over 1,500 words. Cite the research findings inline when you have them.";

/** The member asked for a document/file deliverable (.md report, tracker, memo, checklist).
 *  Rule: write it as normal markdown in the answer body — the frontend detects document-shaped
 *  markdown and opens a rendered, downloadable copy in the side panel (md/docx/pdf/xlsx download).
 *  A fenced ``` block would render as raw monospace text in chat and never reach the doc panel. */
export const DOCUMENT_RULE =
  "DOCUMENT / FILE REQUEST: the member asked for a document, report, tracker, checklist, memo, spec or '.md' file. Write the document as NORMAL MARKDOWN in the answer body - real # / ## headings, markdown tables, bold labels, checklists as - [ ] items - and do NOT wrap the document in a code fence (no ``` block) and do not narrate the file as if saving it. The app detects document-shaped markdown and opens a rendered, downloadable copy in a side panel automatically. Code fences are for code only.";

/** The member asked to BUILD an interactive thing (app, prototype, dashboard, calculator, game).
 *  Rule: one complete self-contained HTML file in a single ```html fence — the frontend renders it
 *  LIVE in the side panel (sandboxed iframe, open-in-new-tab available), exactly like a Perplexity app. */
export const WEBAPP_RULE =
  "WEB APP REQUEST: the member asked you to BUILD an app, prototype, tool, dashboard, calculator, game or interactive page. Deliver ONE complete, self-contained HTML document inside a single ```html code fence: <!doctype html> with ALL CSS and JavaScript inline in that same file, no external local files, no placeholder or stubbed functions - every button and input must be wired and functional the moment it opens. Use a clean modern design (system fonts, sensible spacing, light or dark as the request suggests). Keep any explanation before or after the fence to a few lines. The app renders the page live in a side panel and offers open-in-new-tab.";

/** The member asked to VERIFY something. The chat HAS real execution tools — a live Python sandbox
 *  (run_python), web_search, fetch_page, the fleet registry and connectors — so "verify" must mean
 *  actually running the computation or the searches, never disclaiming capability. */
export const VERIFY_RULE =
  "VERIFICATION REQUEST: you have REAL execution tools in this chat: a live Python sandbox (run_python - numpy, pandas, matplotlib, no network, 10s), live web_search, fetch_page, the fleet registry and account connectors. When the member asks you to verify numbers, math, data or claims: RUN the computation with run_python and/or confirm the facts with web_search - do not re-derive by hand and do not describe what you would compute. NEVER say you have no execution tool, cannot run code, or can only cross-check text - that is false; if a specific check is impossible (e.g. a private system you have no connector for), name exactly that check and what would be needed.";

/** Intent detectors for the two rules above (fast-path injection in gateway-chat/index.ts). */
export function isDocumentAsk(q: string): boolean {
  return /\.(md|markdown)\b|\bartifact\b|\btracker\b|\bchecklist\b|\bmemo\b|\btemplate\b|\bdocument\b|\breport\b|\bwrite[- ]?up\b|\bdeliverable\b/i.test(String(q || ""));
}
export function isWebappAsk(q: string): boolean {
  return /\b(build|create|make|design|spin ?up|prototype)\b[\s\S]{0,80}\b(app|prototype|dashboard|tool|calculator|game|webapp|web page|website|interactive)\b|\bwebapp\b/i.test(String(q || ""));
}
export function isVerifyAsk(q: string): boolean {
  return /\bverif(y|ying|ied|ication)\b|\bdouble[- ]check\b|\bprove (it|that|this)\b|\bconfirm (the|those|these|your)? ?(numbers|figures|claims|math|totals)\b/i.test(String(q || ""));
}

export const IMAGE_ASK_RULE =
  "IMAGE REQUEST: the member wants to SEE images. The app opens its image generator for them alongside this reply. Do NOT output SVG, HTML, canvas or any code as a substitute for images, and do not tell them to save code into a file. Instead give (a) a short design direction (palette, materials, furniture, lighting) grounded in the conversation and (b) 3-4 ready-to-use image prompts, each one self-contained (room, camera angle, style, colors, key furniture).";
