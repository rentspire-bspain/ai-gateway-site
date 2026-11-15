#!/usr/bin/env python3
"""ai.spaincos.com FULL PROMPT-REPLAY DEVIATION AUDIT (owner directive 2026-11-15 night #5).

Replays EVERY prompt the owner has ever sent to Perplexity (extracted from the
memory corpus, 717 unique prompts) through the LIVE ai.spaincos.com gateway and
machine-checks each response for deviations vs Perplexity parity:

  D1 empty        — HTTP != 200 or empty/blank answer
  D2 leak         — raw <|open|>tools<|sep|> token syntax leaked into answer text
  D3 dead-end     — "(no response from model)", "cannot be executed", "not exposed",
                    "no callable tool", "unavailable in this session" refusals
  D4 truncated    — answer cut mid-sentence (no terminal punctuation/section)
  D5 ungrounded   — research-class prompt answered with ZERO citations/sources
  D6 refuse-all   — model refuses the work outright with no path forward

Usage:  python3 qa/prompt-replay.py [--limit 50] [--workers 4] [--offset 0]
Incremental results: qa-reports/prompt-replay/results.jsonl (one line per prompt).
Summary + deviation report: qa-reports/prompt-replay/latest.json
"""
import argparse, sys, concurrent.futures as cf, datetime, json, os, re, sys, time, urllib.request, urllib.error
from pathlib import Path

SB = "https://bnxermyboeigvwonfrzx.supabase.co"
GW = SB + "/functions/v1/gateway-chat"
ANON = "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from prelaunch import EVAL_EMAIL, EVAL_PASS  # the shipped QA harness credentials (qa/prelaunch.py)
ROOT = Path(__file__).resolve().parent.parent
OUT = Path(os.environ.get("QA_OUT", "/home/user/workspace/qa-private/prompt-replay"))
# PRIVACY (v230): the owner's prompt corpus is PRIVATE — it contains raw owner prompts
# and possibly pasted keys. It must NEVER live inside the repo (qa-reports/ is publicly
# served by the live site). Default location is outside the repo; override with QA_CORPUS.
CORPUS = Path(os.environ.get("QA_CORPUS", "/home/user/workspace/qa-private/prompt-corpus.json"))

LEAK_RE = re.compile(r"<\|(open|sep|close)\|>")
DEAD_END_RE = re.compile(r"\(no response from model\)|cannot be executed from (this|the)|no callable tool|not exposed (in|to) this session|tools are (not|un)available|Live search unavailable", re.I)
REFUSE_ALL_RE = re.compile(r"^(?:i can(?:'|no)t|i cannot|i'm unable)\b.{0,80}(?:help|assist|do that|comply)\b", re.I | re.S)
ENDS_OK_RE = re.compile(r"[.!?`\)]\s*(?:\*\*)?$|[.!?]\s*$")
RESEARCH_RE = re.compile(r"\b(research|find|search|latest|news|who is|what is|compare|price|market|data|list of|source)\b", re.I)

def http(url, body=None, headers=None, timeout=280):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers or {"Content-Type": "application/json"}, method="POST" if data else "GET")
    t0 = time.time()
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, r.read().decode("utf-8", "replace"), round(time.time() - t0, 1)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), round(time.time() - t0, 1)
    except Exception as e:
        return 0, f"EXC {e}", round(time.time() - t0, 1)

def mint():
    st, body, _ = http(SB + "/auth/v1/token?grant_type=password",
                       {"email": EVAL_EMAIL, "password": EVAL_PASS},
                       {"apikey": ANON, "Content-Type": "application/json"})
    if st != 200:
        raise SystemExit("auth failed " + str(st))
    j = json.loads(body)
    return j["access_token"], j["user"]["id"]

SCRUB_RE = re.compile(r"(sbp_[a-f0-9]{20,}|rnd_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})")
def scrub(p: str) -> str:
    """Redact credential-looking tokens from owner prompts before they enter replay threads."""
    return SCRUB_RE.sub("[REDACTED]", p)

def check(idx, prompt, tok, uid):
    prompt = scrub(prompt)
    body = {"thread_id": f"replay-{idx}-{int(time.time()*1000)%99991}", "user_id": uid,
            "purpose": "general", "max_tokens": 2048, "stream": False,
            "messages": [{"role": "user", "content": prompt[:6000]}]}
    st, txt, dt = http(GW, body, {"Authorization": "Bearer " + tok, "apikey": ANON, "Content-Type": "application/json"})
    rec = {"i": idx, "http": st, "s": dt, "prompt": prompt[:160]}
    # v230 replay lesson: 429 rate-limit and 546 WORKER_RESOURCE_LIMIT (concurrency-induced —
    # the same prompts pass serially) are RETRYABLE, not deviations; back off and retry twice.
    tries = 0
    while st in (429, 546) and tries < 2:
        tries += 1
        time.sleep(30 if st == 546 else 20)
        st, txt, dt = http(GW, body, {"Authorization": "Bearer " + tok, "apikey": ANON, "Content-Type": "application/json"})
        rec["retry"] = tries
    if st == 546:
        rec.update(dev="D7", why="WORKER_RESOURCE_LIMIT after retries (concurrency or heavy auto-invocation)")
        return rec
    if st != 200:
        rec.update(dev="D1", why=f"HTTP {st}: {txt[:150]}")
        return rec
    try:
        j = json.loads(txt)
    except Exception:
        rec.update(dev="D1", why="non-JSON: " + txt[:150])
        return rec
    c = str((j.get("choices") or [{}])[0].get("message", {}).get("content") or "")
    rec["chars"] = len(c)
    if len(c.strip()) < 5:
        rec.update(dev="D1", why="empty answer"); return rec
    if LEAK_RE.search(c):
        rec.update(dev="D2", why="token-syntax leak"); return rec
    if DEAD_END_RE.search(c):
        rec.update(dev="D3", why="dead-end/refusal-to-tool: " + DEAD_END_RE.search(c).group(0)); return rec
    tail = c.rstrip()[-60:]
    if not ENDS_OK_RE.search(c.rstrip()) or tail.count("```") % 2 == 1:
        rec.update(dev="D4", why="possibly truncated: ..." + tail[-40:]); return rec
    if REFUSE_ALL_RE.match(c.strip()) and len(c) < 600:
        rec.update(dev="D6", why="refuse-all: " + c[:120]); return rec
    if RESEARCH_RE.search(prompt) and (j.get("x_sources") or []) == [] and "source" not in c.lower()[:1500]:
        rec.update(dev="D5", why="research prompt, no sources in response"); return rec
    rec.update(dev=None, why="ok")
    return rec

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--offset", type=int, default=0)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    corpus = json.load(open(CORPUS))
    done = set()
    if (OUT / "results.jsonl").exists():
        for line in open(OUT / "results.jsonl"):
            try: done.add(json.loads(line)["i"])
            except Exception: pass
    todo = [(i, p["text"]) for i, p in enumerate(corpus) if i >= a.offset and i not in done][: a.limit]
    print(f"PROMPT-REPLAY: {len(todo)} prompts to run ({len(done)} already done, corpus {len(corpus)})", flush=True)
    tok, uid = mint()
    lock_write = open(OUT / "results.jsonl", "a")
    devs, n = {}, 0
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(check, i, p, tok, uid): (i, p) for i, p in todo}
        for f in cf.as_completed(futs):
            i, p = futs[f]
            try: r = f.result()
            except Exception as e: r = {"i": i, "http": 0, "dev": "D0", "why": f"harness {e}", "prompt": p[:160]}
            lock_write.write(json.dumps(r) + "\n"); lock_write.flush()
            n += 1
            if r.get("dev"): devs[r["dev"]] = devs.get(r["dev"], 0) + 1
            if n % 10 == 0 or r.get("dev"):
                print(f"  [{n}/{len(todo)} {time.time()-t0:.0f}s] {'DEV ' + r.get('dev','') if r.get('dev') else 'ok  '} {r.get('why','')[:90]} | {r.get('prompt','')[:70]}", flush=True)
    lock_write.close()
    # summary from full results file
    allr = [json.loads(l) for l in open(OUT / "results.jsonl")]
    bydev = {}
    for r in allr:
        if r.get("dev"): bydev.setdefault(r["dev"], []).append(r)
    summary = {"ts": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
               "corpus": len(corpus), "replayed": len(allr), "ok": sum(1 for r in allr if not r.get("dev")),
               "deviations": {k: len(v) for k, v in sorted(bydev.items())},
               "deviation_detail": {k: v[:40] for k, v in bydev.items()}}
    (OUT / "latest.json").write_text(json.dumps(summary, indent=1))
    print("\nSUMMARY:", json.dumps({k: summary[k] for k in ("replayed", "ok", "deviations")}, indent=1))
    sys.exit(1 if summary["deviations"] else 0)

if __name__ == "__main__":
    main()
