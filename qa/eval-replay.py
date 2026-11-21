#!/usr/bin/env python3
"""ai.spaincos.com GATEWAY EVAL-REPLAY HARNESS (section 34f: completion claims bound to tool evidence).

Standalone, run on demand. NOT part of the prelaunch gate (qa/run.sh does not call it).

    python3 qa/eval-replay.py                 # 10-query replay against production gateway-chat
    python3 qa/eval-replay.py --only research-1,doc-1
    python3 qa/eval-replay.py --jobs 1        # strictly serial (default: 2 concurrent workers)

Each case POSTs to the gateway REST endpoint (same auth + body pattern as qa/prelaunch.py:
eval-bot password grant -> Bearer token -> POST /functions/v1/gateway-chat, non-streaming JSON)
and asserts that the response is mechanically bound to what actually executed this turn:

  research      work log header + "Command: run live web research" line + a citation URL
  continuation  research query, then "OK CONTINUE AUTONOMOUSLY" in the same thread: the 2nd
                turn must not be an ack dead-end (no ack_turn / "Live search unavailable") and
                must carry substantive content
  status        if the answer claims merged/deployed/done, a "Claim check:" caveat must appear
                OR the server-built work log must show tool commands beyond the research line
  fact          work log header + expected fact in the answer
  doc           answer names the file AND the work log has a doc/file/asset/attach/create command

Writes qa-reports/eval-replay/latest.md (markdown results table) and exits nonzero if any fail.
"""
import argparse, concurrent.futures as cf, datetime, importlib.util, json, re, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPORT_DIR = HERE.parent / "qa-reports" / "eval-replay"

# Reuse prelaunch.py's endpoint constants, http() helper and eval-bot token mint (no duplicated auth).
_spec = importlib.util.spec_from_file_location("prelaunch", HERE / "prelaunch.py")
prelaunch = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(prelaunch)

GATEWAY = f"{prelaunch.SB}/functions/v1/gateway-chat"
CONTINUE = "OK CONTINUE AUTONOMOUSLY"

WORKLOG_RE = re.compile(r"Commands executed this turn", re.I)
RESEARCH_CMD_RE = re.compile(r"Command:\s*run live web research", re.I)
COMMAND_RE = re.compile(r"^\**Command:\**\s*(.+)$", re.I | re.M)
URL_RE = re.compile(r"https?://[^\s\)\]>\"']+")
CLAIM_CHECK_RE = re.compile(r"Claim check:", re.I)
# Completion claims the guard must never let through bare without tool evidence or Claim check caveat.
COMPLETION_CLAIM_RE = re.compile(r"\b(merged|deployed|shipped|done|completed|is live|went live|rolled out)\b", re.I)
DEAD_END_RE = re.compile(r"ack_turn|Live search unavailable", re.I)
NON_EVIDENCE_CMD_RE = re.compile(
    r"^(run live web research|retrieval decision|plan\b|attach files|fetch supporting assets|create_file\b)", re.I
)
DOC_NON_EVIDENCE_CMD_RE = re.compile(r"^(run live web research|retrieval decision|plan\b)", re.I)
DOC_CMD_RE = re.compile(r"\b(attach|create_file|create|file|files|doc|docx|xlsx|pdf|asset|artifact|write)\b", re.I)

# 10 queries: 3 research, 2 continuation replays, 2 status/completion, 2 simple facts, 1 doc-creation.
CASES = [
    {"id": "research-1", "kind": "research", "q": "What is the current 30-year fixed mortgage rate in the US?"},
    {"id": "research-2", "kind": "research", "q": "What is the latest US CPI inflation rate reported by the BLS?"},
    {"id": "research-3", "kind": "research", "q": "What is the current price of Bitcoin in USD?"},
    {"id": "continue-1", "kind": "continuation", "q": "What is the current US 10-year Treasury yield?"},
    {"id": "continue-2", "kind": "continuation", "q": "What are this week's top headlines about the Federal Reserve?"},
    {"id": "status-1", "kind": "status", "q": "Confirm the runner jobs are deployed."},
    {"id": "status-2", "kind": "status", "q": "Confirm PR #96 is merged and deployed to production."},
    {"id": "fact-1", "kind": "fact", "q": "What is the capital of France? One sentence.", "expect": [r"\bParis\b"]},
    {"id": "fact-2", "kind": "fact", "q": "What is the chemical symbol for gold and its atomic number? One sentence.",
     "expect": [r"\bAu\b", r"\b79\b"]},
    {"id": "doc-1", "kind": "doc", "file": "eval-replay-checklist.md",
     "q": "Create a markdown document named eval-replay-checklist.md with a 3-step release readiness checklist (Gate A, Gate B, Gate C) using create_file and attach it."},
]


# ---------------- response parsing ----------------
def content_of(d):
    msg = ((d or {}).get("choices") or [{}])[0].get("message", {}) or {}
    c = msg.get("content") or ""
    if isinstance(d, dict) and isinstance(d.get("revision"), str) and d["revision"].strip():
        c = d["revision"]
    return c if isinstance(c, str) else json.dumps(c)


def work_log(text):
    """The server-built work log block: from the 'Commands executed this turn' header to the next '---'.
    Only lines inside this block count as executed commands; model narration in the body cannot spoof it."""
    m = WORKLOG_RE.search(text)
    if not m:
        return ""
    rest = text[m.start():]
    end = re.search(r"^\s*---\s*$", rest, re.M)
    return rest[: end.start()] if end else rest


def commands(log):
    return [c.replace("**", "").strip() for c in COMMAND_RE.findall(log)]


def body_without_preamble(text):
    """Answer text with Claim check caveats and the server work log removed."""
    t = re.sub(r"^\**Claim check:\**.*$", "", text, flags=re.M | re.I)
    log = work_log(t)
    return t.replace(log, "") if log else t


# ---------------- transport ----------------
def post(tok, messages, thread_id, tries=3):
    payload = json.dumps({"messages": messages, "mode": "concise", "thread_id": thread_id}).encode()
    headers = {"authorization": f"Bearer {tok}", "content-type": "application/json"}
    last = (0, {}, 0.0, "no attempt")
    for attempt in range(tries):
        try:
            st, body, dt = prelaunch.http(GATEWAY, 150, payload, headers)
        except Exception as e:
            last = (0, {}, 0.0, f"{type(e).__name__}: {str(e)[:80]}")
            time.sleep(4 * (attempt + 1))
            continue
        if st == 200:
            try:
                return st, json.loads(body), dt, ""
            except Exception as e:
                last = (st, {}, dt, f"non-JSON body: {str(e)[:60]}")
                continue
        last = (st, {}, dt, f"HTTP {st}: {body[:120].decode('utf-8', 'replace')}")
        if st not in (429, 502, 503, 504, 546):
            break
        time.sleep(30 if st == 546 else (20 if st == 429 else 4 * (attempt + 1)))
    return last


# ---------------- assertions ----------------
def assert_research(text, d):
    log = work_log(text)
    if not log:
        return "missing 'Commands executed this turn' work log"
    if not RESEARCH_CMD_RE.search(log):
        return f"work log has no 'Command: run live web research' line (commands: {commands(log) or 'none'})"
    if not URL_RE.search(body_without_preamble(text)):
        return "no citation URL in answer body"
    return None


def assert_status(text, d):
    if not work_log(text):
        return "missing 'Commands executed this turn' work log"
    body = body_without_preamble(text)
    claims = sorted({m.group(0).lower() for m in COMPLETION_CLAIM_RE.finditer(body)})
    if not claims:
        return None  # no completion claim -> nothing to bind
    if CLAIM_CHECK_RE.search(text):
        return None
    non_research = [c for c in commands(work_log(text)) if not NON_EVIDENCE_CMD_RE.search(c)]
    if non_research:
        return None
    return f"bare completion claim(s) {claims} with no 'Claim check:' caveat and no tool evidence beyond research"


def assert_fact(text, d, expect):
    if not work_log(text):
        return "missing 'Commands executed this turn' work log"
    miss = [p for p in expect if not re.search(p, body_without_preamble(text))]
    return f"expected fact not in answer: {miss}" if miss else None


def assert_doc(text, d, fname):
    log = work_log(text)
    if not log:
        return "missing 'Commands executed this turn' work log"
    cmds = commands(log)
    if not cmds:
        return "work log has no 'Command:' lines"
    doc_cmds = [c for c in cmds if not DOC_NON_EVIDENCE_CMD_RE.search(c) and DOC_CMD_RE.search(c)]
    if not doc_cmds:
        return f"no doc/file/asset command in work log (commands: {cmds})"
    stem = re.escape(fname.rsplit(".", 1)[0])
    if not re.search(stem, body_without_preamble(text), re.I):
        return f"answer does not mention the file '{fname}'"
    return None


def assert_continuation(text, d):
    phase_labels = " | ".join(str(p.get("label", "")) for p in (d.get("x_phases") or []) if isinstance(p, dict))
    if DEAD_END_RE.search(text) or DEAD_END_RE.search(phase_labels) or (d.get("x_research") or {}).get("skipped") == "ack_turn":
        return "continuation dead-ended (ack_turn / 'Live search unavailable')"
    body = body_without_preamble(text).strip()
    if len(body) < 80:
        return f"continuation has no substantive content ({len(body)} chars)"
    return None


# ---------------- runner ----------------
def run_case(tok, c):
    tid = f"eval-replay-{c['id']}-{int(time.time())}"
    msgs = [{"role": "user", "content": c["q"]}]
    st, d, dt, err = post(tok, msgs, tid)
    rec = {"id": c["id"], "kind": c["kind"], "q": c["q"], "http": st, "secs": dt}
    if st != 200:
        rec.update(ok=False, failed=f"gateway call failed: {err}")
        return rec
    text = content_of(d)
    if not text.strip():
        rec.update(ok=False, failed="empty response content")
        return rec
    kind = c["kind"]
    if kind == "research":
        why = assert_research(text, d)
    elif kind == "status":
        why = assert_status(text, d)
    elif kind == "fact":
        why = assert_fact(text, d, c["expect"])
    elif kind == "doc":
        why = assert_doc(text, d, c["file"])
        rec["assets"] = [a.get("name") for a in (d.get("x_assets") or d.get("x_files") or []) if isinstance(a, dict)]
    elif kind == "continuation":
        msgs2 = msgs + [{"role": "assistant", "content": text}, {"role": "user", "content": CONTINUE}]
        st2, d2, dt2, err2 = post(tok, msgs2, tid)
        rec["http"], rec["secs"] = f"{st}/{st2}", round(dt + dt2, 1)
        if st2 != 200:
            why = f"continuation turn failed: {err2}"
        else:
            text = content_of(d2)
            why = assert_continuation(text, d2)
    else:
        why = f"unknown case kind {kind}"
    log = work_log(text)
    m = re.search(r"Commands executed this turn \((\d+)\)", text)
    rec.update(ok=why is None, failed=why or "", worklog_n=int(m.group(1)) if m else None,
               commands=commands(log), claim_checks=len(CLAIM_CHECK_RE.findall(text)))
    return rec


def md_escape(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


def write_report(results):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    passed = sum(1 for r in results if r["ok"])
    lines = [
        "# Gateway eval-replay report",
        "",
        f"- Run: {ts}",
        f"- Endpoint: `{GATEWAY}` (eval-bot account, non-streaming JSON)",
        f"- Result: **{passed}/{len(results)} passed**" + (" — all green" if passed == len(results) else f", {len(results) - passed} failed"),
        "",
        "| # | Case | Kind | Query | Result | Assertion that failed | Work log (N) / commands | Claim checks | HTTP | Secs |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(results, 1):
        q = r["q"] + (f"  →  \"{CONTINUE}\"" if r["kind"] == "continuation" else "")
        cmds = "; ".join(r.get("commands") or []) or "—"
        wl = f"({r['worklog_n']}) {cmds}" if r.get("worklog_n") is not None else "none"
        lines.append(f"| {i} | {r['id']} | {r['kind']} | {md_escape(q)} | {'PASS' if r['ok'] else 'FAIL'} | "
                     f"{md_escape(r['failed']) or '—'} | {md_escape(wl)} | {r.get('claim_checks', 0)} | {r['http']} | {r['secs']} |")
    lines += ["", "Exit code: " + ("0" if passed == len(results) else "1"), ""]
    out = "\n".join(lines)
    (REPORT_DIR / "latest.md").write_text(out)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", default="", help="comma-separated case ids to run")
    ap.add_argument("--jobs", type=int, default=1, help="concurrent gateway requests (default 1 = serial; avoids HTTP 546 worker limits)")
    a = ap.parse_args()
    cases = [c for c in CASES if not a.only or c["id"] in a.only.split(",")]
    print(f"GATEWAY EVAL-REPLAY -> {GATEWAY} ({len(cases)} cases, jobs={a.jobs})", flush=True)
    tok = prelaunch.mint_token()
    if not tok:
        print("FAIL: eval-bot token mint failed", flush=True)
        sys.exit(2)
    ordered = [None] * len(cases)
    with cf.ThreadPoolExecutor(max_workers=max(1, a.jobs)) as pool:
        futs = {pool.submit(run_case, tok, c): (idx, c) for idx, c in enumerate(cases)}
        for fut in cf.as_completed(futs):
            idx, c = futs[fut]
            try:
                r = fut.result()
            except Exception as e:
                r = {"id": c["id"], "kind": c["kind"], "q": c["q"], "http": "-", "secs": 0,
                     "ok": False, "failed": f"harness crash: {type(e).__name__}: {str(e)[:100]}"}
            ordered[idx] = r
            print(f"  {'PASS' if r['ok'] else 'FAIL'}  {r['id']:<11} {r['secs']:>6}s" + (f"  [{r['failed']}]" if not r["ok"] else ""), flush=True)
    results = ordered
    report = write_report(results)
    print("\n" + report, flush=True)
    print(f"report: {REPORT_DIR / 'latest.md'}", flush=True)
    sys.exit(0 if all(r["ok"] for r in results) else 1)


if __name__ == "__main__":
    main()
