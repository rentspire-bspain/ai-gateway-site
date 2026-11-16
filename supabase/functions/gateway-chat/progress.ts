// progress.ts — F12 live progress for the streaming chat path (pure Deno/Web, no imports).
// Problem: on the plain/streaming path the first byte used to arrive only after intent analysis + search + tool loop + council had all
// finished, so a long multi-step query looked frozen. ProgressSink lets the handler "commit" to SSE early and report REAL steps as they
// happen. Every note is tied to an actual event (a search started, a page fetched, N sources returned) — nothing is invented.
// Wire: `phases` events (cumulative, same shape the UI already renders: {label, done, kind, count?, items?}) + an `x_progress` event
// ({id,label,state,kind,ms}) for clients that want a dedicated consumer + `: keepalive` comments every 10s.
export interface PStep { id: string; label: string; kind: string; done: boolean; failed?: boolean; count?: number; items?: Array<{ title: string; url?: string; domain?: string; n?: number; text?: string; status?: string; evidence?: string }>; t0: number; ms?: number;
  /** v130 PARALLEL AGENTS (optional, backward compatible): stable agent id ("research-1", "council-2", "writer") and its display name ("RESEARCH · rent trends"). Rows without `agent` are the main pipeline. */
  agent?: string; agentName?: string }

export class ProgressSink {
  readonly readable: ReadableStream<Uint8Array>;
  readonly committed: Promise<void>;
  steps: PStep[] = [];
  live = false;
  private ctrl!: ReadableStreamDefaultController<Uint8Array>;
  private closed = false;
  private resolveCommit!: () => void;
  private enc = new TextEncoder();
  private timer: number | undefined;
  private keepaliveMs: number;
  constructor(opts: { keepaliveMs?: number } = {}) {
    this.keepaliveMs = opts.keepaliveMs ?? 10_000;
    this.committed = new Promise<void>((r) => (this.resolveCommit = r));
    this.readable = new ReadableStream<Uint8Array>({
      start: (c) => { this.ctrl = c; },
      cancel: () => { this.closed = true; this.stopTimer(); },
    });
  }
  /** Switch to SSE. Safe to call repeatedly. After this the handler's return value is piped into the stream. */
  commit(): void {
    if (this.live) return;
    this.live = true;
    this.resolveCommit();
    this.timer = setInterval(() => this.raw(": keepalive\n\n"), this.keepaliveMs) as unknown as number;
    this.emit();
  }
  private stopTimer() { if (this.timer !== undefined) { clearInterval(this.timer); this.timer = undefined; } }
  private raw(s: string) { if (this.closed) return; try { this.ctrl.enqueue(this.enc.encode(s)); } catch { this.closed = true; this.stopTimer(); } }
  private send(o: unknown) { this.raw(`data: ${JSON.stringify(o)}\n\n`); }

  /** Start (or restart) a step. Idempotent by id. */
  begin(id: string, label: string, kind = "tool", extra: Partial<PStep> = {}): void {
    const ex = this.steps.find((s) => s.id === id);
    if (ex) { Object.assign(ex, { label, done: false }, extra); }
    else this.steps.push({ id, label, kind, done: false, t0: Date.now(), ...extra });
    this.emit(id);
  }
  /** Complete a step, optionally relabelling it ("Searching…" -> "Searched the web — 8 sources"). */
  end(id: string, label?: string, extra: Partial<PStep> = {}): void {
    const s = this.steps.find((x) => x.id === id); if (!s) return;
    s.done = true; s.ms = Date.now() - s.t0; if (label) s.label = label; Object.assign(s, extra);
    this.emit(id);
  }
  /** v130: start a named parallel agent. Step id is namespaced (`agent:<id>`) so it can never collide with pipeline steps. Idempotent. */
  beginAgent(agent: string, agentName: string, label: string, kind = "search", extra: Partial<PStep> = {}): void {
    this.begin(`agent:${agent}`, label, kind, { ...extra, agent, agentName: String(agentName).slice(0, 80) });
  }
  /** v130: finish a named agent (optionally relabelled / failed). */
  endAgent(agent: string, label?: string, extra: Partial<PStep> = {}): void { this.end(`agent:${agent}`, label, extra); }
  /** One-shot informational note (already complete). */
  note(id: string, label: string, kind = "note"): void { this.begin(id, label, kind); this.end(id); }
  /** Replace/insert the plan row (kind "plan", expandable items). */
  setPlan(plan: Array<{ n: number; text: string; status: string; evidence?: string }>): void {
    const done = plan.filter((p) => p.status === "done").length, failed = plan.filter((p) => p.status === "failed").length;
    // v124: items carry structured n/text/status/evidence (checklist UI) + the legacy glyph-prefixed title (older clients).
    const items = plan.map((p) => ({ title: `${p.status === "done" ? "✓" : p.status === "failed" ? "✗" : "•"} ${p.n}. ${p.text}`, n: p.n, text: p.text, status: p.status, ...(p.evidence ? { evidence: String(p.evidence).slice(0, 300) } : {}) }));
    const head = `Planned ${plan.length} step${plan.length === 1 ? "" : "s"}`;
    const label = failed ? `${head} — ${done} verified, ${failed} failed` : done === plan.length ? `${head} — executed and verified` : done > 0 ? `${head} — ${done}/${plan.length} verified` : head;
    const ex = this.steps.find((s) => s.id === "plan");
    if (ex) Object.assign(ex, { label, items, count: plan.length, done: done + failed === plan.length });
    else this.steps.push({ id: "plan", label, kind: "plan", done: false, count: plan.length, items, t0: Date.now() });
    this.emit("plan");
  }
  /** Visible window: all running steps + the most recent completed ones, so a 20-tool run doesn't flood the UI. */
  visible(max = 8): PStep[] {
    if (this.steps.length <= max) return this.steps;
    const running = this.steps.filter((s) => !s.done || s.kind === "plan");
    const doneRecent = this.steps.filter((s) => s.done && s.kind !== "plan").slice(-(max - running.length));
    return this.steps.filter((s) => running.includes(s) || doneRecent.includes(s));
  }
  private emitPhases() {
    if (!this.live) return;
    // v130: `failed` is only surfaced for named agent rows (explicit, so a topic like "rate limits" is never mistaken for an error); pipeline rows are unchanged.
    this.send({ phases: this.visible().map(({ id: _i, t0: _t, ms: _m, failed: f, ...p }) => (p.agent && f ? { ...p, failed: true } : p)) });
  }
  private emit(id?: string) {
    if (!this.live || !this.steps.length) return;   // nothing real to say yet: stay quiet (no empty phases event)
    this.emitPhases();
    const s = id ? this.steps.find((x) => x.id === id) : undefined;
    if (s) this.send({ x_progress: { id: s.id, label: s.label, kind: s.kind, state: s.failed ? "failed" : s.done ? "done" : "running", ms: s.ms, n: this.steps.length, ...(s.agent ? { agent: s.agent, agent_name: s.agentName } : {}) } });
  }

  /** Consume the real handler's Response and forward it into the open SSE stream. Never throws. */
  streamResponse(work: Promise<Response>, headers: Record<string, string>): Response {
    (async () => {
      try { await this.forward(await work); }
      catch (e) {
        // hardening: log details server-side; never stream raw engine error text to the client
        console.error("gateway-chat stream handler error:", e instanceof Error ? (e.stack || e.message) : String(e));
        const msg = "internal error";
        this.send({ id: "chatcmpl-progress", object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content: `⚠ ${msg}` }, finish_reason: null }] });
        this.send({ error: msg, status: 500 }); this.raw("data: [DONE]\n\n");
      } finally { this.stopTimer(); if (!this.closed) { try { this.ctrl.close(); } catch { /* client gone */ } } this.closed = true; }
    })();
    return new Response(this.readable, { headers: { ...headers, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "X-Progress": "early" } });
  }
  private async forward(r: Response): Promise<void> {
    this.stopTimer();
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("text/event-stream") && r.body) {
      const rd = r.body.getReader();
      while (!this.closed) { const { done, value } = await rd.read(); if (done) break; try { this.ctrl.enqueue(value); } catch { this.closed = true; } }
      try { await rd.cancel(); } catch { /* ignore */ }
      return;
    }
    // Handler returned JSON after we committed (non-stream-capable answer, error, blocked, tool-loop result): re-frame as SSE.
    let j: any = null; const text = await r.text(); try { j = JSON.parse(text); } catch { /* not json */ }
    if (Array.isArray(j?.x_phases)) this.send({ phases: j.x_phases });
    if (Array.isArray(j?.images) && j.images.length) this.send({ images: j.images });
    const content = j?.choices?.[0]?.message?.content;
    const base = { id: j?.id || "chatcmpl-progress", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: j?.model || "gateway" };
    if (r.ok && typeof content === "string") {
      this.send({ ...base, choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] });
      if (j?.revision) this.send({ revision: j.revision });
      const meta: Record<string, unknown> = {};
      for (const k of ["x_dead_end", "x_quality", "x_fallback", "x_selfcheck", "x_plan", "x_research"]) if (j[k] !== undefined) meta[k] = j[k];
      if (Object.keys(meta).length) this.send({ x_meta: meta });
      this.send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
    } else {
      const err = String(typeof j?.error === "string" ? j.error : j?.error?.message || `HTTP ${r.status}`).slice(0, 500);
      // The current client SSE parser ignores a bare `error` event, so ALSO deliver the message as visible answer text.
      this.send({ ...base, choices: [{ index: 0, delta: { role: "assistant", content: `⚠ ${err}` }, finish_reason: null }] });
      this.send({ error: err, status: r.status });
      this.send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
    }
    this.raw("data: [DONE]\n\n");
  }
}

/** Should this request get early-committed SSE? Cheap + conservative; anything unusual falls back to the unchanged path. */
export async function wantsLiveProgress(req: Request, opts: { isApiKey: (authHeader: string) => boolean; disabled?: boolean }): Promise<boolean> {
  if (opts.disabled || req.method !== "POST") return false;
  if (opts.isApiKey(req.headers.get("authorization") || "")) return false;   // API-key mode speaks strict OpenAI chunks only
  if (!(req.headers.get("content-type") || "").includes("json")) return false;
  try {
    const b = await req.clone().json();
    return b?.stream === true && !b?.embed_context && !b?.deep_research && !b?.admin_raw && Array.isArray(b?.messages);
  } catch { return false; }
}

/** Truthful, human label for a tool call (args are parsed defensively; nothing user-private is echoed beyond the search query). */
export function describeToolCall(name: string, rawArgs: string): string {
  let a: any = {}; try { a = JSON.parse(rawArgs || "{}"); } catch { /* keep {} */ }
  const host = (u: unknown) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const clip = (s: unknown, n = 70) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
  switch (name) {
    case "web_search": return a.query ? `Searching: ${clip(a.query)}` : "Searching the web…";
    case "fetch_page": return host(a.url) ? `Reading ${host(a.url)}…` : "Reading a page…";
    case "browser_step": return host(a.url) ? `Browsing ${host(a.url)}…` : "Browsing…";
    case "fetch_asset": return host(a.url) ? `Fetching asset from ${host(a.url)}…` : "Fetching an asset…";
    case "calculator": return "Calculating…";
    case "run_python": return "Running Python…";
    case "search_my_context": return "Searching your documents…";
    case "search_drive": case "read_file": case "list_spreadsheet": case "read_sheet": return "Checking your Google Drive…";
    case "slack_search": case "slack_read_channel": return "Checking Slack…";
    case "github_search_code": case "github_search_issues": case "github_search_repos": case "github_read_issue": return "Checking GitHub…";
    case "dropbox_list_files": case "dropbox_read_file": return "Checking Dropbox…";
    case "render_list_services": case "render_deploy_status": case "render_logs": return "Checking Render…";
    case "supabase_list_projects": case "supabase_project_health": return "Checking Supabase…";
    case "search_email": return "Searching your email…";
    case "read_email": return "Reading an email…";
    case "list_events": return "Checking your calendar…";
    case "send_email": return "Preparing an email for your approval…";
    case "create_event": return "Preparing a calendar event for your approval…";
    case "record_plan": return Array.isArray(a.steps) ? `Planning ${a.steps.length} steps…` : "Planning…";
    case "mark_step": return `Verifying step ${a.step ?? ""}…`.replace(" …", "…");
    default: return `Running ${name}…`;
  }
}
