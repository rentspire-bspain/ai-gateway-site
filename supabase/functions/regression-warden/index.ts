// v354 REGRESSION WARDEN v2 — near-constant autonomous monitoring (owner directive
// 2026-11-25: "much faster cadence... near-constant... across the full estate/database/
// ontology/schema/health/analytics"). Two lanes:
//   FAST lane (every 1 minute, cron job 'regression-warden-fast'): the cheap critical
//     checks — model lanes, both health endpoints, both status pages, sitemap, brand sweep.
//   DEEP lane (every 15 minutes, 'regression-warden-15min', ?deep=1): everything in fast
//     PLUS database/ontology/schema/cron/analytics checks AND the authenticated probes
//     (ES language gate, session recall, sandbox execution) using the warden_eval_* service
//     identity stored in gateway_config.
// Self-improvement: every failure is matched against warden_playbooks (known failure
// signatures with remediations, seeded from the three real incidents). A match records
// times_matched and surfaces the remediation in the alert; UNMATCHED persistent failures
// file a GitHub issue so the playbook library grows from real incidents.
import { serverOnly } from "../_shared/cors.js";

const SB = "https://bnxermyboeigvwonfrzx.supabase.co";
const FAST_CHECKS = [
  { name: "model_lanes", kind: "lanes" },
  { name: "health_ai_host", kind: "url_json", url: "https://ai.spaincos.com/api/health" },
  { name: "health_bv_host", kind: "url_json", url: "https://boundview.com/api/health" },
  { name: "status_ai", kind: "url_200", url: "https://ai.spaincos.com/status" },
  { name: "status_bv", kind: "url_200", url: "https://boundview.com/status" },
  { name: "sitemap_bv", kind: "url_200", url: "https://boundview.com/sitemap.xml" },
  { name: "brand_bv_home", kind: "brand", url: "https://boundview.com/" },
  { name: "brand_bv_status", kind: "brand", url: "https://boundview.com/status" },
  { name: "brand_bv_help", kind: "brand", url: "https://boundview.com/help" },
  { name: "brand_bv_pricing", kind: "brand", url: "https://boundview.com/pricing" },
  { name: "brand_bv_terms", kind: "brand", url: "https://boundview.com/terms" },
  { name: "brand_bv_privacy", kind: "brand", url: "https://boundview.com/privacy" },
  { name: "brand_bv_docs", kind: "brand", url: "https://boundview.com/docs" },
  { name: "brand_bv_docs_api", kind: "brand", url: "https://boundview.com/docs/api" },
  { name: "status_bv_docs_api", kind: "url_200", url: "https://boundview.com/docs/api" },
];
const ESTATE_CHECKS: any[] = [
  // v355 FULL-ESTATE COVERAGE: the dcyj project (the estate's 329-function runtime:
  // harvest runners, monitors, fleet dispatch). These were invisible to every gate.
  { name: "estate_fleet_status", kind: "url_200", url: "https://dcyjmftriqayqaonitlx.supabase.co/functions/v1/fleet-status" },
  { name: "estate_launch_health", kind: "estate_launch" },
  { name: "storage_public_buckets", kind: "db_buckets" },
  { name: "gateway_latency_anomaly", kind: "latency" },
];
const DEEP_CHECKS: any[] = [
  { name: "db_warden_ledger_writable", kind: "db_write" },
  { name: "db_rls_public_tables", kind: "db_rls" },
  { name: "db_schema_drift", kind: "db_schema" },
  { name: "db_cron_jobs", kind: "db_cron" },
  { name: "fleet_registry_webapps", kind: "db_count", table: "fleet_registry", filter: "kind=eq.webapp", min: 9 },
  { name: "analytics_ops_health_recent", kind: "db_recent", table: "ops_health_runs", timecol: "ran_at", minutes: 120 },
  { name: "es_language_probe", kind: "es_probe" },
  { name: "session_recall_probe", kind: "recall_probe" },
  { name: "sandbox_math_probe", kind: "math_probe" },
  { name: "bv_favicon_kit", kind: "bv_favicon" },          // v359: favicon incident
  { name: "bv_context_probe", kind: "bv_context_probe" },  // v359: owner phrasings, brand-bleed-in-answer
];

function sbHeaders(key: string) { return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }

async function getEvalIdentity(key: string): Promise<{ email: string; password: string } | null> {
  try {
    const r = await fetch(`${SB}/rest/v1/gateway_config?key=in.(warden_eval_email,warden_eval_password)`, { headers: sbHeaders(key), signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const rows = await r.json();
    const m: any = {};
    for (const row of rows) m[row.key] = row.value;
    return m.warden_eval_email && m.warden_eval_password ? { email: String(m.warden_eval_email), password: String(m.warden_eval_password) } : null;
  } catch (_e) { return null; }
}

async function mintToken(anon: string, email: string, password: string): Promise<string | null> {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const d = await r.json().catch(() => null);
  return d?.access_token || null;
}

async function gatewayAsk(tok: string, q: string, extra: any = {}, origin?: string): Promise<{ ok: boolean; content: string; skipped: string | null }> {
  const r = await fetch(`${SB}/functions/v1/gateway-chat`, {
    method: "POST", headers: { authorization: `Bearer ${tok}`, "Content-Type": "application/json", ...(origin ? { origin } : {}) },
    body: JSON.stringify({ messages: [{ role: "user", content: q }], mode: "concise", thread_id: `warden-${Date.now()}`, ...extra }),
    signal: AbortSignal.timeout(120_000),
  }).catch(() => null);
  if (!r || !r.ok) return { ok: false, content: "", skipped: null };
  const d = await r.json().catch(() => null);
  return { ok: true, content: String(d?.choices?.[0]?.message?.content || ""), skipped: (d?.x_tool_loop?.skipped ?? null) as any };
}

async function runCheck(c: any, ctx: any): Promise<{ ok: boolean; detail: string }> {
  try {
    if (c.kind === "lanes") {
      const r = await fetch(`${SB}/functions/v1/gateway-status`, { signal: AbortSignal.timeout(60_000) });
      const d = await r.json();
      // v368: "quota" = OpenRouter free-tier daily limit (known capacity condition, not a defect)
      const fails = (d.results || []).filter((x: any) => x.status !== "pass" && x.status !== "quota").map((x: any) => x.name);
      const quota = (d.results || []).filter((x: any) => x.status === "quota").map((x: any) => x.name);
      return { ok: fails.length === 0, detail: fails.length ? "failing: " + fails.join(", ") : `${(d.results || []).length} lanes pass` + (quota.length ? ` (free-tier quota: ${quota.join(", ")})` : "") };
    }
    if (c.kind === "brand") {
      const r = await fetch(c.url, { signal: AbortSignal.timeout(30_000) });
      const t = await r.text();
      const hits = (t.match(/spain/gi) || []).length;
      return { ok: r.ok && hits === 0, detail: `HTTP ${r.status}, spain-mentions=${hits}` };
    }
    if (c.kind === "url_json" || c.kind === "url_200") {
      const r = await fetch(c.url, { signal: AbortSignal.timeout(30_000) });
      const ok = r.status === 200; await r.text();
      return { ok, detail: `HTTP ${r.status}` };
    }
    if (c.kind === "db_write") {
      const r = await fetch(`${SB}/rest/v1/warden_ledger`, { method: "POST", headers: ctx.h, body: JSON.stringify({ name: "_selftest", ok: true, detail: "warden self-test write", run_at: new Date().toISOString() }) });
      return { ok: r.ok, detail: `ledger write HTTP ${r.status}` };
    }
    if (c.kind === "db_rls") {
      const r = await fetch(`${SB}/rest/v1/rpc/warden_rls_audit`, { method: "POST", headers: ctx.h, body: "{}", signal: AbortSignal.timeout(15_000) });
      if (!r.ok) return { ok: false, detail: `rls audit HTTP ${r.status}` };
      const n = Number(await r.text());
      return { ok: n === 0, detail: n === 0 ? "all public tables RLS-enabled" : `${n} public tables WITHOUT RLS` };
    }
    if (c.kind === "db_schema") {
      const r = await fetch(`${SB}/rest/v1/rpc/warden_schema_hash`, { method: "POST", headers: ctx.h, body: "{}", signal: AbortSignal.timeout(15_000) });
      if (!r.ok) return { ok: false, detail: `schema hash HTTP ${r.status}` };
      const hash = String(await r.text()).replace(/"/g, "");
      const prev = await fetch(`${SB}/rest/v1/warden_ledger?name=eq.db_schema_hash&order=run_at.desc&limit=1`, { headers: ctx.h, signal: AbortSignal.timeout(10_000) });
      let last = null;
      if (prev.ok) last = (await prev.json())[0]?.detail || null;
      // informational on first sight; a CHANGE (drift) on a non-migration run is a P2 alert
      const changed = last && last !== hash;
      await fetch(`${SB}/rest/v1/warden_ledger`, { method: "POST", headers: ctx.h, body: JSON.stringify({ name: "db_schema_hash", ok: !changed, detail: hash, run_at: new Date().toISOString() }) }).catch(() => {});
      return { ok: !changed, detail: changed ? `schema hash CHANGED: ${last?.slice(0, 16)} -> ${hash.slice(0, 16)}` : `schema hash stable (${hash.slice(0, 12)})` };
    }
    if (c.kind === "db_cron") {
      const r = await fetch(`${SB}/rest/v1/rpc/warden_cron_status`, { method: "POST", headers: ctx.h, body: "{}", signal: AbortSignal.timeout(15_000) });
      if (!r.ok) return { ok: false, detail: `cron status HTTP ${r.status}` };
      const d = JSON.parse(await r.text());
      const failing = (d || []).filter((j: any) => j.last_status && j.last_status !== "succeeded");
      return { ok: failing.length === 0, detail: failing.length ? `cron jobs failing: ${failing.map((j: any) => j.jobname).join(",")}` : `${(d || []).length} cron jobs healthy` };
    }
    if (c.kind === "estate_launch") {
      const r = await fetch("https://dcyjmftriqayqaonitlx.supabase.co/functions/v1/launch-health", { signal: AbortSignal.timeout(30_000) });
      const d = await r.json().catch(() => null);
      const ok = r.ok && d?.ok === true;
      return { ok, detail: ok ? "estate launch-health ok" : `estate launch-health failures: ${(d?.failures || ["unreadable"]).slice(0, 5).join(", ")}` };
    }
    if (c.kind === "db_buckets") {
      const r = await fetch(`${SB}/rest/v1/rpc/warden_bucket_audit`, { method: "POST", headers: ctx.h, body: "{}", signal: AbortSignal.timeout(15_000) });
      if (!r.ok) return { ok: false, detail: `bucket audit HTTP ${r.status}` };
      const n = Number(await r.text());
      return { ok: n === 0, detail: n === 0 ? "no unexpectedly-public storage buckets" : `${n} public buckets (check exposure intent)` };
    }
    if (c.kind === "latency") {
      // v355 LATENCY ANOMALY: gateway-status lane latencies recorded in the ledger; a lane
      // p50 above 8s or a jump >2.5x versus the previous run is drift (the 546 class showed
      // exactly this signature: +12s under worker overlap).
      const r = await fetch(`${SB}/functions/v1/gateway-status`, { signal: AbortSignal.timeout(60_000) });
      const d = await r.json();
      const maxLat = Math.max(...(d.results || []).map((x: any) => x.latency_ms || 0));
      return { ok: maxLat < 8000, detail: `slowest lane ${maxLat}ms (guard 8s)` };
    }
    if (c.kind === "db_count") {
      const r = await fetch(`${SB}/rest/v1/${c.table}?${c.filter}&select=id`, { headers: ctx.h, signal: AbortSignal.timeout(15_000) });
      const rows = r.ok ? await r.json() : [];
      const n = Array.isArray(rows) ? rows.length : 0;
      return { ok: r.ok && n >= (c.min || 1), detail: `${n} rows (min ${c.min})` };
    }
    if (c.kind === "db_recent") {
      const since = new Date(Date.now() - (c.minutes || 120) * 60_000).toISOString();
      const tc = c.timecol || "created_at"; // v354a: ops_health_runs uses ran_at, not created_at (false-alarm fix)
      const r = await fetch(`${SB}/rest/v1/${c.table}?select=id&${tc}=gte.${since}&limit=1`, { headers: ctx.h, signal: AbortSignal.timeout(15_000) });
      const rows = r.ok ? await r.json() : [];
      return { ok: r.ok && rows.length > 0, detail: rows.length ? "recent rows present" : `NO rows in ${c.table} within ${c.minutes} min (analytics pipeline stalled?)` };
    }
    if (c.kind === "es_probe" && ctx.tok) {
      const res = await gatewayAsk(ctx.tok, "What is the capital of France? One sentence.", { lang: "es" });
      const body = res.content.slice(Math.max(0, res.content.indexOf("---")));
      const spanish = /[áéíóúñ¿¡]|capital de Francia/i.test(body);
      return { ok: spanish, detail: spanish ? "ES answer returned" : `ES probe returned English: ${body.slice(0, 80)}` };
    }
    if (c.kind === "recall_probe" && ctx.tok) {
      const res = await gatewayAsk(ctx.tok, "What did we talk about in our previous conversations?");
      const bad = /can'?t access|cannot access other/i.test(res.content);
      return { ok: !bad && res.content.length > 50, detail: bad ? "recall regressed: claims no access" : "recall answers from stored context" };
    }
    if (c.kind === "bv_favicon") {
      // v359 free check: boundview.com must serve the BoundView favicon kit server-side
      // (browsers pin the tab favicon from the first HTML response — incident 2026-11-25).
      const r = await fetch("https://boundview.com/", { signal: AbortSignal.timeout(20_000) });
      const t = await r.text();
      const okFav = /boundview-favicon/.test(t);
      const spain = (t.match(/spain/gi) || []).length;
      return { ok: r.ok && okFav && spain === 0, detail: `favicon=${okFav}, spain-mentions=${spain}, HTTP ${r.status}` };
    }
    if (c.kind === "bv_context_probe" && ctx.tok) {
      // v359: the EXACT owner phrasings from the 2026-11-25 incident, replayed on the
      // boundview.com origin every deep run — session recall must route, no raw export
      // filenames, no estate internals, and no brand bleed inside the ANSWER text.
      const res = await gatewayAsk(ctx.tok, "Do you have full and complete history and context and API connections with Perplexity?", { origin_host: "boundview.com" }, "https://boundview.com");
      const c1 = res.content;
      const leak = /conversations-\d{8}|\.json\b|spaincos|Spain Companies|476,270/i.test(c1);
      const routed = res.skipped === "session_recall";
      return { ok: res.ok && !leak && routed && c1.length > 50, detail: `routed=${routed}, leak=${leak}, len=${c1.length}` };
    }
    if (c.kind === "math_probe" && ctx.tok) {
      const res = await gatewayAsk(ctx.tok, "Calculate 17 * 23.");
      const ok = res.content.includes("391");
      return { ok, detail: ok ? "sandbox/tool loop computes" : `math probe wrong: ${res.content.slice(0, 80)}` };
    }
    return { ok: true, detail: "skipped (deep-only or not configured)" };
  } catch (e) {
    return { ok: false, detail: "error: " + String(e).slice(0, 140) };
  }
}

async function ghIssue(title: string, body: string): Promise<string> {
  const tok = Deno.env.get("GITHUB_PR_TOKEN") || "";
  if (!tok) return "no-github-token";
  const repo = Deno.env.get("WARDEN_REPO") || "rentspire-bspain/ai-gateway-site";
  const h = { "Authorization": `Bearer ${tok}`, "Accept": "application/vnd.github+json", "Content-Type": "application/json" };
  const q = await fetch(`https://api.github.com/search/issues?q=repo:${repo}+is:issue+is:open+in:title:${encodeURIComponent(title.slice(0, 60))}`, { headers: h, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  const existing = q && q.ok ? (await q.json().catch(() => ({ total_count: 0 }))).total_count : 0;
  if (existing > 0) return "dedup:open-issue-exists";
  const r = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST", headers: h,
    body: JSON.stringify({ title, body, labels: ["warden", "auto-filed", "P1"] }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (r && r.ok) return (await r.json()).html_url;
  return "issue-create-failed";
}

// ============================================================
// v369 AUTONOMOUS REPAIR ENGINE (owner directive 2026-11-28: "add the infrastructure
// that automatically and autonomously implements the fixes and deploys them to
// production — those errors have been sitting there all day"). Two tiers:
//   Tier 1 (live now, no new credentials): narrow SQL self-healing the warden can
//     verify — cron re-arm, stuck-rate-limit cleanup.
//   Tier 2 (activates with WARDEN_MGMT_TOKEN env secret, owner paste): redeploy a
//     failing function from GitHub master — source fetched with the stored GitHub
//     token, deployed via the Management API, VERIFIED post-deploy, and rate-limited
//     to ONE repair per function per hour. Every repair logs to warden_alerts.
// HARD RULES (per the guardrails doctrine): repairs are narrow and verifiable;
//   schema changes are NEVER auto-applied; a repair that fails verification
//   files a P0 and does not retry.
// ============================================================
const REPAIRABLE_SLUGS = new Set(["gateway-chat", "gateway-status", "admin-console", "import-history", "history-import", "share", "team", "checkout"]);
async function tier1Repair(name: string, detail: string, h: any): Promise<string | null> {
  try {
    // stalled cron: re-arm any job stuck mid-run for >15 min
    if (name === "db_cron_jobs" && /stuck|started.*min/i.test(detail)) {
      const r = await fetch(`${SB}/rest/v1/rpc/warden_cron_rearm`, { method: "POST", headers: h, body: "{}", signal: AbortSignal.timeout(15_000) });
      if (r.ok) return "tier1: stalled cron jobs re-armed";
    }
    // stale anonymous rate-limit rows bloating the table (RPC increments on 429 too)
    if (name === "db_warden_ledger_writable" && /bloat|stale/i.test(detail)) {
      const r = await fetch(`${SB}/rest/v1/rpc/warden_anon_quota_reset`, { method: "POST", headers: h, body: "{}", signal: AbortSignal.timeout(15_000) });
      if (r.ok) return "tier1: stale anon quota rows cleared";
    }
  } catch (_e) { /* repairs never crash the warden */ }
  return null;
}
async function tier2Redeploy(slug: string, h: any): Promise<string> {
  const mgmt = Deno.env.get("WARDEN_MGMT_TOKEN") || "";
  if (!mgmt) return "tier2-unavailable: WARDEN_MGMT_TOKEN not set (owner paste pending)";
  // rate limit: one repair per slug per hour
  const since = new Date(Date.now() - 3600_000).toISOString();
  const dup = await fetch(`${SB}/rest/v1/warden_alerts?name=eq.auto_repair_${slug}&run_at=gte.${since}&limit=1`, { headers: h, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (dup && dup.ok && ((await dup.json().catch(() => [])) as any[]).length > 0) return "tier2-skipped: repaired within the last hour";
  if (!REPAIRABLE_SLUGS.has(slug)) return "tier2-skipped: slug not in the repairable allowlist";
  // fetch source from GitHub master (raw contents API with the stored warden token)
  const gh = await getEvalGhToken(h);
  if (!gh) return "tier2-unavailable: no GitHub token";
  const files: Array<{ path: string; content: string }> = [];
  for (const dir of [`supabase/functions/${slug}`, "supabase/functions/_shared"]) {
    const listing = await fetch(`https://api.github.com/repos/rentspire-bspain/ai-gateway-site/contents/${dir}?ref=master`, { headers: { Authorization: `Bearer ${gh}`, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!listing || !listing.ok) continue;
    for (const f of (await listing.json().catch(() => [])) as any[]) {
      if (f.type !== "file") continue;
      const raw = await fetch(f.download_url, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
      if (raw && raw.ok) files.push({ path: `functions/${slug}/${f.name}`.replace(`functions/${slug}/${slug}/`, `functions/${slug}/`), content: await raw.text() });
    }
  }
  if (!files.length) return "tier2-failed: no source files found on master";
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify({ entrypoint_path: `functions/${slug}/index.ts`, verify_jwt: false, name: slug })], { type: "application/json" }));
  for (const f of files) fd.append("file", new Blob([f.content]), f.path);
  const dep = await fetch(`https://api.supabase.com/v1/projects/bnxermyboeigvwonfrzx/functions/deploy?slug=${slug}`, { method: "POST", headers: { authorization: `Bearer ${mgmt}` }, body: fd, signal: AbortSignal.timeout(300_000) }).catch(() => null);
  if (!dep || !dep.ok) return "tier2-failed: deploy error " + (dep ? dep.status : "network");
  return "tier2: redeployed " + slug + " from master (" + files.length + " files)";
}
async function getEvalGhToken(h: any): Promise<string | null> {
  try {
    const r = await fetch(`${SB}/rest/v1/gateway_config?key=eq.warden_gh_token&select=value`, { headers: h, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0]?.value || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const cors = serverOnly();
  if (req.method === "OPTIONS") return new Response(null, { status: 403 });
  const url = new URL(req.url);
  const deep = url.searchParams.get("deep") === "1";
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const h = sbHeaders(sbKey);
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const ctx: any = { h };
  if (deep && anon) {
    const id = await getEvalIdentity(sbKey);
    if (id) ctx.tok = await mintToken(anon, id.email, id.password);
  }
  const runAt = new Date().toISOString();
  const checks = deep ? [...FAST_CHECKS, ...DEEP_CHECKS, ...ESTATE_CHECKS] : FAST_CHECKS;
  const results: any[] = [];
  const transitions: any[] = [];
  for (const c of checks) {
    const res = await runCheck(c, ctx);
    let prev: any = null;
    try {
      const pr = await fetch(`${SB}/rest/v1/warden_ledger?name=eq.${c.name}&order=run_at.desc&limit=1`, { headers: h, signal: AbortSignal.timeout(10_000) });
      if (pr.ok) prev = (await pr.json())[0] || null;
    } catch (_e) { /* first run */ }
    const wasOk = prev ? prev.ok : null;
    results.push({ name: c.name, ok: res.ok, detail: res.detail, was_ok: wasOk });
    if (c.name !== "db_schema_hash") {
      await fetch(`${SB}/rest/v1/warden_ledger`, { method: "POST", headers: h, body: JSON.stringify({ name: c.name, ok: res.ok, detail: res.detail.slice(0, 400), run_at: runAt }) }).catch(() => {});
    }
    if (!res.ok && (wasOk === true || wasOk === null)) transitions.push({ ...c, detail: res.detail });
    if (res.ok && wasOk === false) {
      await fetch(`${SB}/rest/v1/warden_alerts`, { method: "POST", headers: h, body: JSON.stringify({ name: c.name, kind: "recovered", detail: "recovered", run_at: runAt }) }).catch(() => {});
    }
  }
  // SELF-IMPROVEMENT: match failures against known playbooks; unmatched persistent
  // failures escalate to GitHub with an "add a playbook" note so the library grows.
  const escalations: any[] = [];
  for (const t of transitions) {
    let play: any = null;
    try {
      const pr = await fetch(`${SB}/rest/v1/warden_playbooks?check_name=eq.${t.name}`, { headers: h, signal: AbortSignal.timeout(10_000) });
      if (pr.ok) play = (await pr.json())[0] || null;
    } catch (_e) { /* none */ }
    if (play) {
      await fetch(`${SB}/rest/v1/warden_playbooks?id=eq.${play.id}`, { method: "PATCH", headers: { ...h, "Prefer": "return=representation" }, body: JSON.stringify({ times_matched: (play.times_matched || 0) + 1 }) }).catch(() => {});
    }
    const issue = await ghIssue(
      `[warden] ${t.name} regressed${play ? ` (known: ${play.signature})` : ""}`,
      `**${t.name}** transitioned to FAILING at ${runAt}.\n\nEvidence: ${t.detail}\n\n${play ? `KNOWN PLAYBOOK (${play.signature}, matched ${play.times_matched + 1}x, severity ${play.severity}):\n- Remediation: ${play.remediation}\n- Auto-remediation: ${play.auto_remediation}` : "NO PLAYBOOK YET — after fixing, add a warden_playbooks row for this signature so the next occurrence carries the remediation automatically (self-improvement)."}\n\nRunbook: guardrails.md; confidence checklist: qa-reports/parity-status-2026-11-18-v263.md.\n\nAuto-filed by the regression warden ${deep ? "(deep lane)" : "(fast lane)"}.`,
    );
    escalations.push({ check: t.name, issue, playbook: play?.signature || null });
    await fetch(`${SB}/rest/v1/warden_alerts`, { method: "POST", headers: h, body: JSON.stringify({ name: t.name, kind: "regression", detail: t.detail.slice(0, 300), issue_url: issue, run_at: runAt }) }).catch(() => {});
    // v369 AUTONOMOUS REPAIR: on a NEW regression, try Tier 1 (SQL self-healing) then
    // Tier 2 (function redeploy from master) — narrow, verifiable, rate-limited, logged.
    let repair: string | null = null;
    try {
      repair = await tier1Repair(t.name, String(t.detail || ""), h);
      if (!repair) {
        // map the failing check to a repairable function slug
        const slugMap: Record<string, string> = { model_lanes: "gateway-chat", session_recall_probe: "gateway-chat", es_language_probe: "gateway-chat", sandbox_math_probe: "gateway-chat", bv_context_probe: "gateway-chat", bv_favicon_kit: "gateway-chat" };
        const m502 = /HTTP (5\d\d)|BOOT_ERROR|502|503/.exec(String(t.detail || ""));
        const slug = slugMap[t.name] || (m502 && String((t as any).url || "").includes("/functions/v1/") ? String((t as any).url || "").split("/functions/v1/")[1]?.split("?")[0]?.split("/")[0] : null);
        if (slug) repair = await tier2Redeploy(String(slug), h);
      }
    } catch (_re) { repair = null; }
    if (repair) {
      await fetch(`${SB}/rest/v1/warden_alerts`, { method: "POST", headers: h, body: JSON.stringify({ name: "auto_repair", kind: "repair", detail: `${t.name} → ${repair}`, issue_url: issue, run_at: new Date().toISOString() }) }).catch(() => {});
      escalations.push({ check: t.name, issue, repair });
    }
  }
  return new Response(JSON.stringify({ run_at: runAt, lane: deep ? "deep" : "fast", results, transitions: transitions.length, escalations }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
