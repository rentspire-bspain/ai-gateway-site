#!/usr/bin/env python3
"""ai.spaincos.com ALL-MODEL AUDIT BATTERY (owner directive 2026-11-15 night #5).

Runs EVERY model lane on the site (all 17 composer lanes) through the live
gateway with multiple scenarios per model, and machine-checks each response:

  1. sanity    — a simple factual question: HTTP 200, non-empty, complete answer
  2. tool-use  — a webapp-doctor ask: the doctor evidence must appear
                 (server-side auto-invocation, not web-research prose)
  3. leak      — the R12 regression probe: raw <|open|>tools<|sep|> token syntax
                 must NEVER appear in answer text (Kimi native-format leak)
  4. doc-rule  — the completion-doc forcing rule: the answer must NOT be the
                 whole document pasted into chat (chat-prose breakage the owner
                 screenshoted) — evidence calls must run and the doc rides
                 create_file as an artifact (x_files in the response)

Usage:  python3 qa/all-model-audit.py [--only kimi,r1] [--repeat 2]
Exit 0 = every model x scenario green. Results JSON: qa-reports/all-model-audit/
"""
import argparse, sys, concurrent.futures as cf, datetime, json, re, sys, time, urllib.request, urllib.error
from pathlib import Path

SB = "https://bnxermyboeigvwonfrzx.supabase.co"
GW = SB + "/functions/v1/gateway-chat"
ANON = "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb"  # live publishable key
sys.path.insert(0, str(Path(__file__).resolve().parent))
from prelaunch import EVAL_EMAIL, EVAL_PASS  # the shipped QA harness credentials (qa/prelaunch.py)
RESULTS = Path(__file__).resolve().parent.parent / "qa-reports" / "all-model-audit"

# The complete composer lane catalog (v231 Models pane), mapped exactly the way
# the site's index.html MODEL_OVERRIDES sends them. purpose-only lanes ride
# purpose; model lanes ride the `model` field straight to the gateway.
LANES = {
    "general":       {"purpose": "general"},  # Auto (GLM-5.3 default)
    "flint":         {"purpose": "flint"},   # Flint v1.0 (free)
    "summary":       {"purpose": "summary"}, # Qwen3.8-27B (free)
    "kimi":          {"model": "moonshotai/kimi-k3.1-pro"},
    "kimi-flash":    {"model": "moonshotai/kimi-k3.1-flash"},
    "deepseek-flash":{"model": "deepseek/deepseek-v4.1-flash"},
    "r1":            {"model": "deepseek/deepseek-r1"},
    "minimax-m2":    {"model": "minimax/minimax-m2"},
    "gpt-oss":       {"model": "openai/gpt-oss-120b"},
    "gpt-oss-20b":   {"model": "openai/gpt-oss-20b"},
    "llama4":        {"model": "meta-llama/llama-4-maverick"},
    "llama4-scout":  {"model": "meta-llama/llama-4-scout"},
    "gemma4":        {"model": "google/gemma-4-31b"},
    "glm-air":       {"model": "z-ai/glm-5.3-air"},
    "venice":        {"model": "cognitivecomputations/dolphin-mistral-24b-venice-edition"},
    "dolphin":       {"model": "cognitivecomputations/dolphin-mistral-24b-venice-edition"},
    "qwen-coder":    {"model": "qwen/qwen3-coder"},
}

LEAK_RE = re.compile(r"<\|(open|sep|close)\|>")
SCENARIOS = {
    "sanity": "What is the capital of France? Answer in one short sentence.",
    "tool-use": "Run the webapp doctor across all webapps and report the health matrix.",
    "leak": "List the webapps in the registry and which ones have failing health checks right now.",
    "doc-rule": "Compile a completion document for tonight: closure percent, verified items, code references.",
}
DOCTOR_EVIDENCE = re.compile(r"webapp_doctor|doctor matrix|health matrix|HTTP 200|tables", re.I)
DOC_RULE_OK = re.compile(r"create_file|\.md|artifact", re.I)

def http(method, url, body=None, headers=None, timeout=280):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                headers=headers or {"Content-Type": "application/json"})
    t0 = time.time()
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, r.read().decode("utf-8", "replace"), round(time.time() - t0, 1)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), round(time.time() - t0, 1)
    except Exception as e:
        return 0, f"EXC {e}", round(time.time() - t0, 1)

def mint():
    st, body, _ = http("POST", SB + "/auth/v1/token?grant_type=password",
                       {"email": EVAL_EMAIL, "password": EVAL_PASS},
                       {"apikey": ANON, "Content-Type": "application/json"})
    if st != 200:
        raise SystemExit("auth failed: " + str(st) + " " + body[:200])
    j = json.loads(body)
    return j["access_token"], j["user"]["id"]

def run_one(lane_id, scenario, tok, uid, run_ix):
    cfg = LANES[lane_id]
    body = {"thread_id": f"ama-{run_ix}-{lane_id}-{scenario}",
            "user_id": uid, "purpose": "general", "max_tokens": 2048, "stream": False,
            "messages": [{"role": "user", "content": SCENARIOS[scenario]}]}
    body.update(cfg)  # purpose-only lanes override purpose; model lanes add model
    st, txt, dt = http("POST", GW, body,
                       {"Authorization": "Bearer " + tok, "apikey": ANON,
                        "Content-Type": "application/json"})
    rec = {"lane": lane_id, "scenario": scenario, "http": st, "seconds": dt}
    if st != 200:
        rec.update(ok=False, why=f"HTTP {st}: {txt[:200]}")
        return rec
    try:
        j = json.loads(txt)
    except Exception:
        rec.update(ok=False, why="non-JSON response: " + txt[:200])
        return rec
    content = str((j.get("choices") or [{}])[0].get("message", {}).get("content") or "")
    files = j.get("x_files") or j.get("x_assets") or []
    rec["chars"] = len(content)
    rec["x_files"] = len(files) if isinstance(files, list) else 0
    # --- machine checks per scenario ---
    if scenario == "sanity":
        ok = len(content) > 10 and "paris" in content.lower()
        rec.update(ok=ok, why="answer mentions Paris" if ok else f"answer: {content[:200]}")
    elif scenario == "tool-use":
        ok = bool(DOCTOR_EVIDENCE.search(content))
        rec.update(ok=ok, why="doctor evidence present" if ok else f"no doctor evidence: {content[:250]}")
    elif scenario == "leak":
        leaked = LEAK_RE.search(content)
        ok = not leaked and len(content) > 10
        rec.update(ok=ok, why="no token-syntax leak, complete answer" if ok
                  else (f"LEAK: {leaked.group(0)} in answer" if leaked else f"empty/incomplete: {content[:200]}"))
    elif scenario == "doc-rule":
        # Pass = live evidence gathered + delivered as artifact, not prose dump in chat.
        # Fail hard = the whole doc pasted into chat with no artifact.
        has_artifact = (isinstance(files, list) and len(files) > 0) or bool(DOC_RULE_OK.search(content))
        prose_dump = len(content) > 6000  # a whole completion doc pasted into chat
        ok = has_artifact and not prose_dump
        rec.update(ok=ok, why=("evidence + artifact delivery" if has_artifact else "no artifact/evidence markers")
                  + ("; PROSE DUMP in chat" if prose_dump else ""),
                  preview=content[:250])
    return rec

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None, help="comma list of lane ids to audit")
    ap.add_argument("--repeat", type=int, default=1, help="runs per model x scenario (owner: multiple times)")
    ap.add_argument("--jobs", type=int, default=4)
    a = ap.parse_args()
    lanes = {k: v for k, v in LANES.items() if not a.only or k in a.only.split(",")}
    RESULTS.mkdir(parents=True, exist_ok=True)
    tok, uid = mint()
    run_ix = int(time.time())
    jobs = [(lid, sc, ix) for ix in range(a.repeat) for lid in lanes for sc in SCENARIOS]
    print(f"ALL-MODEL AUDIT: {len(lanes)} lanes x {len(SCENARIOS)} scenarios x {a.repeat} = {len(jobs)} gateway calls")
    recs, fails = [], 0
    with cf.ThreadPoolExecutor(max_workers=a.jobs) as ex:
        futs = {ex.submit(run_one, lid, sc, tok, uid, run_ix + ix * 1000): (lid, sc, ix)
                for ix, (lid, sc) in enumerate(jobs)}
        for f in cf.as_completed(futs):
            r = f.result()
            recs.append(r)
            mark = "PASS" if r.get("ok") else "FAIL"
            if not r.get("ok"):
                fails += 1
            print(f"  {mark}  {r['lane']:>14} {r['scenario']:<8} {r['seconds']:>6}s  {r.get('why','')[:110]}", flush=True)
    out = {"ts": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
           "lanes": len(lanes), "scenarios": list(SCENARIOS), "repeat": a.repeat,
           "total": len(recs), "failed": fails,
           "results": sorted(recs, key=lambda r: (r["lane"], r["scenario"]))}
    (RESULTS / "latest.json").write_text(json.dumps(out, indent=1))
    with open(RESULTS / "history.jsonl", "a") as fh:
        fh.write(json.dumps({k: out[k] for k in ("ts", "lanes", "total", "failed")}) + "\n")
    print(f"\n{len(recs) - fails}/{len(recs)} green — results: qa-reports/all-model-audit/latest.json")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
