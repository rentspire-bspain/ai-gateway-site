#!/usr/bin/env python3
"""BENCHMARK GOSPEL ENFORCER (owner directive 2026-11-17, qa/BENCHMARK_GOSPEL.md).

Mechanically enforces the gospel so the law does not depend on memory:

  python3 qa/gospel-check.py pre          # gate: is it SAFE to start a benchmark round?
  python3 qa/gospel-check.py compare A B  # round vs round with noise floors + flips

pre     FAILS if another benchmark/pre-launch/audit load is running (rule 8: one suite
        at a time; the 546 WORKER_RESOURCE_LIMIT incident) or if the results dir
        already has graded rows from a prior round that was never archived (rule 6).

compare prints the strict-score delta per benchmark WITH the binomial noise floor
(rule 2: a gain inside the band is a draw, not a win) and the row-by-row flip
counts (rule 6: claims come from flip analysis, not headline arithmetic).
"""
import json, subprocess, sys
from pathlib import Path

RES = Path("/home/user/workspace/qa-private/bench/results")
ARCH = RES.parent
NOISE = {"simpleqa": 0.02, "frames": 0.043, "dsqa": 0.05, "browsecomp": 0.047}

def graded(path):
    rows = [json.loads(l) for l in path.read_text().splitlines()]
    g = [r for r in rows if r.get("verdict") in ("correct", "wrong", "partial")]
    n = len(g)
    return (sum(1 for r in g if r["verdict"] == "correct") / n if n else 0.0), n

def cmd_pre():
    out = subprocess.run(["pgrep", "-af", "ruthless-bench|prelaunch|analyze-bench"],
                         capture_output=True, text=True).stdout.strip()
    live = [l for l in out.splitlines() if l and "gospel-check" not in l]
    if live:
        print("GOSPEL VIOLATION (rule 8): another suite is running — one at a time (546 risk):")
        for l in live: print("  ", l[:120])
        sys.exit(1)
    if RES.exists():
        done = [p for p in RES.glob("*.jsonl") if any(
            json.loads(l).get("verdict") in ("correct","wrong","partial")
            for l in p.read_text().splitlines()[:50])]
        if done:
            print("GOSPEL VIOLATION (rule 6): unarchived graded results exist — archive the")
            print("prior round (cp -r results results-vNNN) and commit its grid PR first:")
            print("  ", ", ".join(p.name for p in done))
            sys.exit(1)
    print("GOSPEL PRE-CHECK: PASS — no concurrent load, results dir clean. Round may start.")

def cmd_compare(a, b):
    pa, pb = Path(a), Path(b)
    print(f"# Gospel comparison: {pa.name} -> {pb.name}\n")
    print("| Bench | Before | After | Delta | Noise floor | Verdict |")
    print("|---|---|---|---|---|---|")
    for bench, floor in NOISE.items():
        fa, na = graded(pa / f"{bench}.jsonl") if (pa / f"{bench}.jsonl").exists() else (None, 0)
        fb, nb = graded(pb / f"{bench}.jsonl") if (pb / f"{bench}.jsonl").exists() else (None, 0)
        if fa is None or fb is None:
            print(f"| {bench} | — | — | — | — | missing |"); continue
        d = fb - fa
        if abs(d) <= floor: v = "DRAW (inside noise)"
        elif d > 0: v = "GAIN (reproducibility required — rule 2)"
        else: v = "REGRESSION (fix within one round — rule 3)"
        print(f"| {bench} | {fa*100:.1f}% (n={na}) | {fb*100:.1f}% (n={nb}) | {d*100:+.1f} | ±{floor*100:.1f}% | {v} |")
    # row flips
    print("\n## Row-by-row flips (rule 6)\n")
    for bench in NOISE:
        ra, rb = pa / f"{bench}.jsonl", pb / f"{bench}.jsonl"
        if not (ra.exists() and rb.exists()): continue
        A = {json.loads(l)["prompt"]: json.loads(l) for l in ra.read_text().splitlines()}
        B = {json.loads(l)["prompt"]: json.loads(l) for l in rb.read_text().splitlines()}
        ups = sum(1 for p in B if A.get(p, {}).get("verdict") != "correct" and B[p]["verdict"] == "correct")
        downs = sum(1 for p in B if A.get(p, {}).get("verdict") == "correct" and B[p]["verdict"] != "correct")
        print(f"- **{bench}**: {ups} wrong→correct, {downs} correct→wrong (net {ups-downs:+d})")

if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "pre": cmd_pre()
    elif len(sys.argv) >= 4 and sys.argv[1] == "compare": cmd_compare(sys.argv[2], sys.argv[3])
    else: print(__doc__); sys.exit(2)
