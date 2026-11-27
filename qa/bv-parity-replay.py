#!/usr/bin/env python3
"""
bv-parity-replay.py — Response-parity harness (owner directive 2026-11-25):
"test every prompt I've sent to Perplexity and make sure the same responses
come from BoundView."

Replays first-user-messages sampled from the imported Perplexity history
(messages_archive) through gateway-chat on the boundview.com origin and scores
each answer against the owner's ORIGINAL Perplexity answer on:
  - non-empty answer            - citation parity (has sources when original did)
  - length ratio (0.4x-3x band) - structure (headings/lists presence parity)
  - brand hygiene (no spaincos on BV origin)  - self-check clean
  - latency

Usage: python3 qa/bv-parity-replay.py [--n 10] [--seed 20261125] [--threads 1]
Writes qa-reports/parity-replay-<date>.md and prints a WTD pass-rate.
"""
import argparse, json, os, random, re, sys, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
import prelaunch

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SB = prelaunch.SB

def sql(query):
    open('/tmp/q.json', 'w').write(json.dumps({"query": query}))
    import subprocess
    out = subprocess.run(
        ["pplx", "credentials", "run",
         "custom-cred:d2732368-0d3a-4666-a914-1a195e4180d9@api.supabase.com",
         "--", "sh", "-c",
         'curl -s -X POST "https://api.supabase.com/v1/projects/bnxermyboeigvwonfrzx/database/query"'
         ' -H "authorization: Bearer $PPLX_CRED_VALUE" -H "content-type: application/json"'
         ' --data-binary @/tmp/q.json'],
        capture_output=True, text=True, timeout=60)
    return json.loads(out.stdout)

def sample_threads(n, seed):
    # conversations with >=2 user and >=2 assistant turns, exclude mega-threads
    rows = sql("""
        select thread_id, min(created_at) t0, count(*) filter (where role='user') u,
               count(*) filter (where role='assistant') a
        from messages_archive group by thread_id
        having count(*) filter (where role='user') >= 2
           and count(*) filter (where role='assistant') >= 2
           and count(*) <= 80
        order by thread_id
    """)
    rng = random.Random(seed)
    rng.shuffle(rows)
    return [r["thread_id"] for r in rows[:n]]

def first_exchange(thread_id):
    rows = sql(f"""
        select role, content, sources from messages_archive
        where thread_id='{thread_id}' order by created_at limit 6
    """)
    first_user = next((r for r in rows if r["role"] == "user"), None)
    first_asst = next((r for r in rows if r["role"] == "assistant"), None)
    if not first_user or not first_asst:
        return None
    u = first_user["content"] or ""
    a = first_asst["content"] or ""
    if len(u) < 15 or len(u) > 2000 or len(a) < 40:
        return None
    # v359b honest-metric rule: mid-conversation follow-ups ("master doc please",
    # "ok now the second half") CANNOT be graded cold — Perplexity's short original
    # answer leaned on conversation position. These are counted separately as
    # followup_cold (reported, never silently dropped), not as product failures.
    words = u.split()
    followup_cold = (len(words) <= 8 and len(a) < 220
                     and not re.search(r"\?$", u.strip())
                     and re.search(r"\b(doc|document|that|this|those|continue|second half|part 2|now do|next|same for|ok now|go ahead)\b", u, re.I))
    return u[:1500], a, (first_asst.get("sources") or []), followup_cold

def ask(tok, prompt, tid):
    t0 = time.time()
    st, body, _ = prelaunch.http(f"{SB}/functions/v1/gateway-chat", 180,
        json.dumps({"messages": [{"role": "user", "content": prompt}],
                   "thread_id": tid, "mode": "concise",
                   "origin_host": "boundview.com"}).encode(),
        {"Authorization": f"Bearer {tok}", "Origin": "https://boundview.com",
         "apikey": prelaunch.ANON, "content-type": "application/json"})
    dt = time.time() - t0
    if st != 200:
        return {"http": st, "dt": dt}
    d = json.loads(body)
    ans = (d.get("choices") or [{}])[0].get("message", {}).get("content", "")
    return {"http": 200, "answer": ans, "dt": dt,
            "srcs": len(d.get("search_results") or []),
            "selfcheck": d.get("x_selfcheck", {}),
            "quality": d.get("x_quality", {}).get("verdict", ""),
            "dead_end": d.get("x_dead_end", "")}

def score(orig, mine):
    o, m = orig[0], (mine.get("answer") or "")
    checks = {}
    checks["nonempty"] = len(m) > 30
    ratio = (len(m) / max(len(orig[1]), 1))
    checks["length_parity"] = 0.4 <= ratio <= 3.0
    def struct(t):
        return {"h": bool(re.search(r"^#{1,4} ", t, re.M)), "l": bool(re.search(r"^\s*[-*] ", t, re.M)),
                "b": "**" in t}
    so, sm = struct(orig[1]), struct(m)
    checks["structure_parity"] = (so["h"] or so["l"]) == (sm["h"] or sm["l"])
    orig_had_srcs = bool(orig[2]) or bool(re.search(r"\[[^\]]{2,60}\]\(https?://", orig[1]))
    checks["citation_parity"] = (mine.get("srcs", 0) > 0) if orig_had_srcs else True
    checks["brand_hygiene"] = "spaincos" not in m.lower() and "spain companies" not in m.lower()
    checks["quality_clean"] = mine.get("quality") == "clean" and mine.get("dead_end") == "clean"
    checks["latency_ok"] = mine["dt"] < 90
    return checks

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--seed", type=int, default=20261125)
    args = ap.parse_args()
    tok = prelaunch.mint_token()
    tids = sample_threads(args.n, args.seed)
    results = []
    for i, tid in enumerate(tids):
        ex = first_exchange(tid)
        if not ex:
            continue
        prompt, orig_ans, orig_srcs, followup_cold = ex
        mine = ask(tok, prompt, f"parity-replay-{tid[:8]}")
        if mine.get("http") != 200:
            results.append({"tid": tid, "prompt": prompt[:80], "error": f"HTTP {mine['http']}"})
            continue
        checks = score((prompt, orig_ans, orig_srcs), mine)
        if followup_cold:
            # reported separately — never silently dropped
            results.append({"tid": tid, "prompt": prompt[:80], "followup_cold": True,
                            "ratio": round(len(mine.get('answer',''))/max(len(orig_ans),1), 2),
                            "dt": round(mine["dt"], 1), "srcs": mine["srcs"]})
            print(f"[{i+1}/{len(tids)}] FOLLOWUP-COLD (not gradeable cold): {prompt[:50]}", flush=True)
            continue
        results.append({"tid": tid, "prompt": prompt[:80], "checks": checks,
                        "ratio": round(len(mine.get('answer',''))/max(len(orig_ans),1), 2),
                        "dt": round(mine["dt"], 1), "srcs": mine["srcs"]})
        print(f"[{i+1}/{len(tids)}] {'PASS' if all(checks.values()) else 'FAIL'} "
              f"ratio={results[-1].get('ratio')} {sorted(k for k,v in checks.items() if not v)}", flush=True)
    graded = [r for r in results if "checks" in r]
    cold = [r for r in results if r.get("followup_cold")]
    flat = [c for r in graded for c in r["checks"].values()]
    wtd = round(100 * sum(flat) / max(len(flat), 1), 1)
    date = datetime.date.today().isoformat()
    rep = os.path.join(REPO, "qa-reports", f"parity-replay-{date}.md")
    with open(rep, "w") as f:
        f.write(f"# BoundView response-parity replay — {date}\n\n"
                f"- Corpus: imported Perplexity history (messages_archive, 6,071 threads)\n"
                f"- Sample: {args.n} first-prompts (seed {args.seed}), replayed via gateway-chat on boundview.com origin\n"
                f"- **WTD pass-rate: {wtd}%** ({sum(flat)}/{len(flat)} checks; {len(graded)} graded, {len(cold)} follow-up prompts reported as not-gradeable-cold)\n\n"
                "| # | Prompt | Ratio | s | Checks failed |\n|---|---|---|---|---|\n")
        for i, r in enumerate(results):
            fails = ", ".join(k for k, v in r.get("checks", {}).items() if not v) or ("HTTP " + r.get("error", "?") if "error" in r else "none")
            f.write(f"| {i+1} | {r['prompt'][:60].replace('|','/')} | {r.get('ratio','-')} | {r.get('dt','-')} | {fails} |\n")
    print(f"\nWTD pass-rate: {wtd}%  report: {rep}")
    return 0 if wtd >= 90 else 1

if __name__ == "__main__":
    sys.exit(main())
