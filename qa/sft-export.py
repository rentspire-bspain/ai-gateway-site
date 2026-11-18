#!/usr/bin/env python3
"""SFT DATASET EXPORT (gospel rule 15b — the training-recipe ladder, owner directive 2026-11-18).

Every round archive (results-vNNN/) is exactly the SFT dataset shape: a research
question, the system rules that produced the behavior, and a strict-graded answer.
This tool exports the VERIFIED-CORRECT rows across all archives into the standard
SFT format (chat-messages JSONL) ready for a CPT -> SFT -> RL pipeline:

  python3 qa/sft-export.py [--out sft-dataset.jsonl] [--min-chars 200]

Output rows:
  {"messages": [{"role": "system", "content": "<gateway research rules>"},
                {"role": "user",   "content": "<the ASK-formatted benchmark question>"},
                {"role": "assistant", "content": "<the graded-correct answer>"}],
   "meta": {"bench": "...", "round": "...", "chars": N, "sources": N}}

Only `correct` verdicts are exported (imitation data must be verified data — the
gospel's honesty rule applies to the training set itself). Rows are deduplicated
by prompt across rounds (the newest winning answer wins). WRONG/partial rows are
NOT exported: they would teach the failure mode.
"""
import argparse, json, sys
from pathlib import Path

BENCH = Path("/home/user/workspace/qa-private/bench")
ARCHIVE_GLOB = "results-v*"
ALLOWED_BENCHED = {"simpleqa", "frames", "dsqa", "browsecomp"}

# The ASK wrapper the bench harness uses (ruthless-bench.py ASK) — the user message
# the model actually saw. Kept in sync with the harness so the SFT user turns match
# production traffic exactly.
ASK = ("Answer the question below. Be concise; do your research, then end your "
       "reply with a final line of exactly: FINAL ANSWER: <your answer>\n\n{q}")

# The system prompt: the gateway's core research discipline (the durable rules that
# survived the round teardowns — verification, citation, answer-first). This is the
# "policy" the trained model should internalize.
SYSTEM = "\n".join([
    "You are the research engine of ai.spaincos.com. Answer with verified, cited research.",
    "Decompose the question into its explicit constraints. Run searches per constraint and per candidate.",
    "Cite a source for every factual claim. Prefer primary and recent sources.",
    "For set questions: build the candidate table, verify every cell against a source, and the FINAL ANSWER line carries exactly the qualifying items.",
    "For identification questions: an answer matching MOST constraints is WRONG — only a candidate satisfying ALL of them counts. If nothing satisfies all constraints, say so plainly — never guess.",
    "Answer first: open with the direct answer, then the FINAL ANSWER line, then the evidence. Keep the whole reply compact.",
    "End every reply with a final line of exactly: FINAL ANSWER: <the complete answer>.",
])


def load_archive(archive: Path):
    out = {}
    for bench_file in sorted(archive.glob("*.jsonl")):
        bench = bench_file.stem
        if bench not in ALLOWED_BENCHED:
            continue
        for line in bench_file.read_text().splitlines():
            if not line.strip():
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r.get("verdict") != "correct":
                continue
            out[(bench, r.get("i"))] = {
                "bench": bench,
                "round": archive.name,
                "prompt": r.get("prompt", ""),
                "gold": r.get("gold", ""),
                "content": r.get("content", ""),
                "sources": r.get("sources", 0),
                "chars": r.get("chars", len(r.get("content", ""))),
            }
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(BENCH / "sft-dataset.jsonl"))
    ap.add_argument("--min-chars", type=int, default=100,
                    help="skip correct rows whose stored content is too short to teach from")
    a = ap.parse_args()

    archives = sorted(p for p in BENCH.glob(ARCHIVE_GLOB) if p.is_dir() and "sanity" not in p.name)
    best = {}
    for arc in archives:
        for key, row in load_archive(arc).items():
            if key not in best or len(row["content"]) > len(best[key]["content"]):
                best[key] = row  # newest/longest winning answer per (bench, index)

    n = 0
    with open(a.out, "w") as f:
        for (bench, ix), row in sorted(best.items()):
            q = row["prompt"]
            if len(row["content"]) < a.min_chars or not q:
                continue
            rec = {
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": ASK.format(q=q)},
                    {"role": "assistant", "content": row["content"]},
                ],
                "meta": {"bench": bench, "round": row["round"], "index": ix,
                         "gold": row["gold"], "chars": row["chars"], "sources": row["sources"]},
            }
            f.write(json.dumps(rec) + "\n")
            n += 1

    from collections import Counter
    by_bench = Counter(json.loads(l)["meta"]["bench"] for l in open(a.out))
    print(f"SFT dataset: {n} verified-correct examples -> {a.out}")
    print(f"  by bench: {dict(by_bench)}")
    print(f"  archives: {len(archives)} rounds")
    print("Next step (rule 15c): CPT -> SFT on this file -> RL with answer-verification reward.")


if __name__ == "__main__":
    main()
