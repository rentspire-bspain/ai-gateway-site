// plan-guidance.ts — I8 plan-tool policy (pure Deno/Web, no imports).
// One deterministic decision, used three ways, so a plan renders when the member benefits (multi-step / long-form work)
// and never for a trivial question:
//   1. tool-loop: record_plan / mark_step are only OFFERED to the model when planDecision().plan is true (ctx.planAllowed)
//   2. writer fallback (no tool loop ran a plan): PLAN_WRITER_GUIDANCE is appended, asking for a compact "Plan" block first
//   3. the UI: the recorded plan is surfaced as a "plan" phase (expandable step list) and x_plan
export interface PlanDecision { plan: boolean; score: number; reasons: string[] }

const ACTION_VERBS = ["compare", "analy[sz]e", "summari[sz]e", "fetch", "update", "push", "commit", "draft", "calculate", "research", "build", "migrate", "set up", "configure", "deploy", "create", "write", "review", "audit", "verify", "test", "refactor", "design", "outline", "evaluate", "forecast", "model", "rank", "extract", "convert", "schedule", "negotiate", "plan", "investigate", "benchmark"];
const ACTION_RE = ACTION_VERBS.map((v) => new RegExp(`\\b${v}\\b`, "i"));

/** v124: `toolLoopRunning` = the tool loop is actually about to run for this request. Complex/extreme requests then get a
 *  compact auto-plan (record_plan 2-3 steps -> act -> mark_step) even when the heuristic score is low, so the Steps box shows
 *  "Planned N steps -> Executed -> Verified" without the member having to ask for a plan. Trivial/short/conversational stay off. */
export function planDecision(query: string, complexity?: string, toolLoopRunning = false): PlanDecision {
  const q = String(query || "").trim();
  const lower = q.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean).length;
  const reasons: string[] = [];
  let score = 0;
  const add = (n: number, why: string) => { score += n; reasons.push(`${n > 0 ? "+" : ""}${n} ${why}`); };

  const explicit = /\b(step[- ]by[- ]step|road ?map|playbook|action plan|game ?plan|checklist|migration plan|rollout|implementation plan|project plan|work ?plan|runbook|workflow for|multi-?step)\b/.test(lower);
  if (explicit) add(2, "explicit plan/steps request");
  if (/\b(write|draft|create|prepare|produce|build|put together|develop)\b.{0,50}\b(report|proposal|strategy|business plan|memo|white ?paper|guide|analysis|presentation|deck|plan|policy|runbook|spec|brief|audit|review|pitch|curriculum|budget|road ?map|playbook|checklist)\b/.test(lower)) add(2, "long-form deliverable");
  const seq = (lower.match(/\b(then|after that|afterwards|next|finally|and also|once that|followed by|before that)\b/g) || []).length + (/(^|\n)\s*(1[.)]|first[,:])/.test(lower) ? 1 : 0) + ((lower.match(/(^|\n)\s*\d+[.)]\s/g) || []).length >= 2 ? 1 : 0);
  if (seq >= 2) add(2, "sequenced steps in the request");
  else if (seq === 1 && words >= 14) add(1, "one sequencing cue");
  const verbs = ACTION_RE.filter((re) => re.test(lower)).length;
  if (verbs >= 3) add(2, `${verbs} distinct actions`);
  else if (verbs === 2) add(1, "2 distinct actions");
  if (words >= 14 && (q.match(/,/g) || []).length >= 3) add(1, "multi-part enumeration");
  if ((complexity === "complex" || complexity === "extreme") && words >= 20) add(1, "complex request");
  if (words >= 40) add(1, "long request");

  // trivial / conversational: never plan
  const factual = /^(what|who|when|where|which|why|is|are|was|were|does|do|did|can|could|how (much|many|old|long|far|tall|big|fast)|define|explain|tell me|convert|calculate|what's|who's)\b/.test(lower);
  if (words <= 8 && !explicit) add(-3, "short request");
  if (factual && words <= 16 && seq === 0 && !explicit) add(-3, "single question / lookup");
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|cool|great)\b/.test(lower) && words <= 8) add(-4, "conversational");
  if (score < 3 && toolLoopRunning && (complexity === "complex" || complexity === "extreme") && words >= 10 && !(factual && words <= 16 && seq === 0 && !explicit)) {
    add(3, "auto-agentic: complex request + tool loop running (compact plan)");
  }
  return { plan: score >= 3, score, reasons };
}

/** True when the plan was granted only by the v124 auto-agentic rule (heuristic alone would not plan) -> compact 2-3 step plan. */
export function isCompactPlan(query: string, complexity?: string): boolean {
  return !planDecision(query, complexity, false).plan && planDecision(query, complexity, true).plan;
}

/** Appended to TOOL_GUIDANCE in place of the old "2+ distinct actions" rule. */
export const PLAN_TOOL_RULES =
  `PLANNING: record_plan and mark_step are available ONLY because this request is multi-step or long-form. Call record_plan ONCE, before the first action, with 3-6 short, verifiable steps that match what was actually asked. ` +
  `Then execute each step with real tool calls, verify, and call mark_step with evidence (what you checked and what it showed). Finish with a report listing every step as done or failed with its evidence. Never claim a step is done without verification. ` +
  `Never plan for a single lookup, one fetch, a calculation, a quick comparison, or small talk — answer those directly. `;

/** v124 AUTO-AGENTIC (complexity=complex): ONE compact plan that rides inside the existing tool rounds — never a round of its own. */
export const PLAN_TOOL_RULES_COMPACT =
  `AGENTIC SEQUENCE (plan -> act -> verify -> write): this is a complex request. In your FIRST round, call record_plan ONCE with 2-3 short, verifiable steps AND, in that SAME round, issue the first real tool calls (parallel calls are allowed) — never spend a round on the plan alone. ` +
  `Execute the steps with web_search / fetch_page / run_python as needed (at most 2-3 rounds in total). Then, in your last tool round, call mark_step once per step with concrete evidence (what you checked and what it showed; status failed if it did not hold up). ` +
  `Then stop calling tools and write the answer. Never mark a step done without evidence; report any failed step honestly. `;

export const PLAN_TOOL_RULES_OFF =
  `NO PLAN TOOL: this request is simple; do not announce a plan or outline your approach. Use at most the tools it needs, then answer directly. `;

/** System message for the plain writer path (tool loop did not run or recorded no plan) when the request deserves a plan. */
export const PLAN_WRITER_GUIDANCE =
  `PLAN BLOCK (this request is multi-step or long-form): open the answer with a compact "**Plan**" block of 3-6 one-line numbered steps that match what the member asked, then deliver the work, section by section, in that order. ` +
  `End by marking each step ✓ done or ✗ not done (with one clause of reason). Do not use a Plan block for single-fact questions, quick lookups, calculations or small talk. Never pad: the plan is an outline of the real work, not narration.`;

/** Shape of a plan row for the expandable step list (phases[].items). */
export function planLabel(plan: Array<{ status: string }>): string {
  const done = plan.filter((p) => p.status === "done").length, failed = plan.filter((p) => p.status === "failed").length;
  const head = `Planned ${plan.length} step${plan.length === 1 ? "" : "s"}`;
  if (failed) return `${head} — ${done} verified, ${failed} failed`;
  if (done === plan.length) return `${head} — executed and verified`;
  if (done > 0) return `${head} — ${done}/${plan.length} verified`;
  return head;
}
/** Plan item for the UI checklist: `title` keeps the legacy glyph-prefixed string (old clients); `n`/`text`/`status`/`evidence` drive the new per-item ✓/✗ checklist. */
export function planItem(p: { n: number; text: string; status: string; evidence?: string }) {
  return { title: `${p.status === "done" ? "✓" : p.status === "failed" ? "✗" : "•"} ${p.n}. ${p.text}`, n: p.n, text: p.text, status: p.status, ...(p.evidence ? { evidence: String(p.evidence).slice(0, 300) } : {}) };
}
export function planPhase(plan: Array<{ n: number; text: string; status: string; evidence?: string }>) {
  return { label: planLabel(plan), done: true, kind: "plan", count: plan.length, items: plan.map(planItem) };
}

// ---- Cycle 3: answer-shape for follow-up / refine / continuation asks (complex chat path) ----
/** True when the ask is an edit/extension/continuation of earlier work in the thread, not a fresh research question. */
export function isFollowUpDeliverable(query: string, priorTurns: number): boolean {
  if (priorTurns < 1) return false;
  const l = String(query || "").toLowerCase().trim();
  return /\b(add (task|section|step|item)|re-?emit|paste-?able|one block|refine (this|it)|rewrite|revise|update (the|this|that)|handle (all|every)|explicit tasks|as written|continue|go ahead|do (it|all|everything)|yes,? (let'?s|please|do|go)|absolutely|perfect|sounds good|those (answers|are)|spell out|take one of)\b/.test(l)
    || /^(yes|yep|ok|okay|perfect|great|sure|go)\b/.test(l);
}
/** Writer rule for follow-ups: answer-first, no Plan block, no meta disambiguation, full requested artifact in one piece, conversation-grounded. */
export const FOLLOWUP_DIRECT_RULE =
  `FOLLOW-UP SHAPE: this message continues earlier work in the conversation. Open with the deliverable or a one-sentence direct answer — NO "Plan" block, no restating the ask, no preamble. ` +
  `Ground everything in the earlier turns (their data, names, numbers, decisions) and treat them as the context; do not stop to disambiguate a term or acronym the thread already defines. ` +
  `If asked to re-emit or consolidate, output the WHOLE artifact in one paste-able block, not a summary. If the user confirms or answers your questions, acknowledge in one line, then move the work forward with concrete next-step content (specifics, tables, drafts) at the length the task needs. ` +
  `State plainly anything you could not verify instead of omitting it.`;
