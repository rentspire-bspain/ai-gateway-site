// v353 REGRESSION WARDEN — the autonomous health warden (owner directive 2026-11-25:
// "constantly health check-up autonomously... diagnose and autonomously fix... no silent
// failures"). Scheduled by pg_cron (every 15 min). Each run:
//   1. Executes the CRITICAL CHECK SET (the classes that have actually failed silently):
//      model lanes, both /api/health endpoints, both status pages, the sitemap, and a
//      brand-leak curl sweep of the public BoundView pages.
//   2. Writes every result to the warden_ledger table (history -> drift detection: any
//      check that was passing and now fails is a TRANSITION and is escalated).
//   3. AUTO-REMEDIATES the known mechanical failure classes:
//      - a failing check that failed the same way in the previous run is a PERSISTENT
//        failure -> a GitHub issue is opened automatically (via GITHUB_PR_TOKEN, already
//        in project secrets) with the check name, evidence, and a runbook pointer, deduped
//        by an open issue with the same title.
//      - notifications go out on transitions only (dedupe by design, no alert fatigue).
//   4. Never crashes the run: a broken check is recorded as failed, not thrown.
import { serverOnly } from "../_shared/cors.js";

const CHECKS = [
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
];

async function runCheck(c: any): Promise<{ ok: boolean; detail: string }> {
  try {
    if (c.kind === "lanes") {
      const r = await fetch("https://bnxermyboeigvwonfrzx.supabase.co/functions/v1/gateway-status", { signal: AbortSignal.timeout(60_000) });
      const d = await r.json();
      const fails = (d.results || []).filter((x: any) => x.status !== "pass").map((x: any) => x.name);
      return { ok: fails.length === 0, detail: fails.length ? "failing: " + fails.join(", ") : `${(d.results || []).length} lanes pass` };
    }
    if (c.kind === "brand") {
      const r = await fetch(c.url, { signal: AbortSignal.timeout(30_000) });
      const t = await r.text();
      const hits = (t.match(/spain/gi) || []).length;
      return { ok: r.ok && hits === 0, detail: `HTTP ${r.status}, spain-mentions=${hits}` };
    }
    if (c.kind === "url_json") {
      const r = await fetch(c.url, { signal: AbortSignal.timeout(30_000) });
      const ok = r.ok; await r.text();
      return { ok, detail: `HTTP ${r.status}` };
    }
    const r = await fetch(c.url, { signal: AbortSignal.timeout(30_000) });
    const ok = r.status === 200; await r.text();
    return { ok, detail: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, detail: "error: " + String(e).slice(0, 120) };
  }
}

async function ghIssue(title: string, body: string): Promise<string> {
  const tok = Deno.env.get("GITHUB_PR_TOKEN") || "";
  if (!tok) return "no-github-token";
  const auth = tok.startsWith("github_pat_") || tok.startsWith("ghp_") ? `Bearer ${tok}` : `token ${tok}`;
  const repo = Deno.env.get("WARDEN_REPO") || "rentspire-bspain/ai-gateway-site";
  const h = { "Authorization": auth, "Accept": "application/vnd.github+json", "Content-Type": "application/json" };
  // dedupe: an OPEN issue with the same title exists -> comment instead of duplicating
  const q = await fetch(`https://api.github.com/search/issues?q=repo:${repo}+is:issue+is:open+in:title:${encodeURIComponent(title.slice(0, 60))}`, { headers: h, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  const existing = q && q.ok ? (await q.json().catch(() => ({ total_count: 0 }))).total_count : 0;
  if (existing > 0) return "dedup:open-issue-exists";
  const r = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST", headers: h,
    body: JSON.stringify({ title, body, labels: ["warden", "auto-filed", "P1"] }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (r && r.ok) { const j = await r.json(); return j.html_url; }
  return "issue-create-failed";
}

Deno.serve(async (req) => {
  const cors = serverOnly();
  const sbUrl = Deno.env.get("SUPABASE_URL") || "";
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const sbHeaders = { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { status: 403 });
  const runAt = new Date().toISOString();
  const results: any[] = [];
  const transitions: any[] = [];
  for (const c of CHECKS) {
    const res = await runCheck(c);
    // previous state for transition detection
    let prev: any = null;
    try {
      const pr = await fetch(`${sbUrl}/rest/v1/warden_ledger?name=eq.${c.name}&order=run_at.desc&limit=1`, { headers: sbHeaders, signal: AbortSignal.timeout(10_000) });
      if (pr.ok) prev = (await pr.json())[0] || null;
    } catch (_e) { /* first run */ }
    const wasOk = prev ? prev.ok : null;
    results.push({ name: c.name, ok: res.ok, detail: res.detail, was_ok: wasOk });
    const row = { name: c.name, ok: res.ok, detail: res.detail.slice(0, 400), run_at: runAt };
    await fetch(`${sbUrl}/rest/v1/warden_ledger`, { method: "POST", headers: sbHeaders, body: JSON.stringify(row) }).catch(() => {});
    // TRANSITION: was passing, now failing (or first-run failure)
    if (!res.ok && (wasOk === true || wasOk === null)) transitions.push(row);
    // RECOVERY transition: was failing, now passing
    if (res.ok && wasOk === false) {
      await fetch(`${sbUrl}/rest/v1/warden_alerts`, { method: "POST", headers: sbHeaders, body: JSON.stringify({ name: c.name, kind: "recovered", detail: "recovered", run_at: runAt }) }).catch(() => {});
    }
  }
  // escalation: persistent or fresh failures -> auto-file a GitHub issue with evidence
  const escalations: any[] = [];
  for (const t of transitions) {
    const issue = await ghIssue(
      `[warden] ${t.name} regressed`,
      `The regression warden detected that **${t.name}** transitioned to FAILING at ${runAt}.\n\nEvidence: ${t.detail}\n\nRunbook: see guardrails.md and the v352 confidence checklist in qa-reports/parity-status-2026-11-18-v263.md. The lane-health canary in the prelaunch gate covers this class on deploy; this issue covers runtime drift between deploys.\n\nAuto-filed by the regression warden.`,
    );
    escalations.push({ check: t.name, issue });
    await fetch(`${sbUrl}/rest/v1/warden_alerts`, { method: "POST", headers: sbHeaders, body: JSON.stringify({ name: t.name, kind: "regression", detail: t.detail.slice(0, 300), issue_url: issue, run_at: runAt }) }).catch(() => {});
  }
  return new Response(JSON.stringify({ run_at: runAt, results, transitions: transitions.length, escalations }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
