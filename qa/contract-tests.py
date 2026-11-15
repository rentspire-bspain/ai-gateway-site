#!/usr/bin/env python3
"""ai.spaincos.com TOOL-CONTRACT TESTS (nightly, part of the product).

Asserts that server-side auto-invocations actually run: webapp health asks must
be answered from the platform-run webapp_doctor matrix, and webapp schema asks
from the platform-fetched list_webapp_tables output — never from stale web
research (the 2026-11-14 deferral defect). Run after every gateway deploy and
nightly via the parity harness:

    python3 qa/contract-tests.py

Exit 0 = all green. Non-zero = a contract is broken; fix before shipping.
"""
import json, re, sys, time, urllib.request, urllib.error
from pathlib import Path

SB = "https://bnxermyboeigvwonfrzx.supabase.co"
GW = SB + "/functions/v1/gateway-chat"
ANON = "sb_publishable_nrmUxUfyytgCscz8zfQ9Cw_LapbvKIb"  # the site's live publishable key (auth grants accept it)
EVAL_EMAIL, EVAL_PASS = "eval-bot@spaincos.com", "EvalTest2026!"
RESULTS = Path(__file__).resolve().parent.parent / "qa-reports" / "contract-tests"

def http(method, url, body=None, headers=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {"Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

def token():
    st, body = http("POST", SB + "/auth/v1/token?grant_type=password",
                    {"email": EVAL_EMAIL, "password": EVAL_PASS},
                    {"apikey": ANON, "Content-Type": "application/json"})
    if st != 200:
        raise SystemExit("auth failed: " + str(st))
    return json.loads(body)["access_token"], json.loads(body)["user"]["id"]

def ask(tok, uid, q):
    st, body = http("POST", GW, {"thread_id": "contract-" + str(int(time.time())) + "-" + str(int(time.time() * 1000) % 9973),
                                 "user_id": uid, "lane": "glm", "messages": [{"role": "user", "content": q}]},
                    {"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    if st != 200:
        return ""
    j = json.loads(body)
    return str((j.get("choices") or [{}])[0].get("message", {}).get("content") or "")

def main():
    RESULTS.mkdir(parents=True, exist_ok=True)
    tok, uid = token()
    tests = []
    def run(name, q, must_any, must_none=()):
        a = ask(tok, uid, q)
        ok = any(re.search(m, a) for m in must_any) and not any(re.search(m, a, re.I) for m in must_none)
        tests.append({"name": name, "query": q, "ok": ok,
                      "evidence": {"matched": [m for m in must_any if re.search(m, a)],
                                   "forbidden_found": [m for m in must_none if re.search(m, a, re.I)]},
                      "answer_head": a[:300]})
        print(("PASS" if ok else "FAIL") + "  " + name + ("  (evidence: " + ", ".join(tests[-1]["evidence"]["matched"]) + ")" if ok else ""))
        return ok

    # Contract 1: webapp health asks answer from the platform-run doctor matrix
    run("webapp-health-allowance", "Is the Allowance webapp healthy? Check webapp health for Allowance.",
        [r"44 tables", r"HTTP 200", r"sohkloywunleaftzzdof"],
        [r"tedix", r"mcp endpoint did not advertise"])
    # Contract 2: schema asks answer from the platform-fetched table list
    run("webapp-schema-comptrove", "What tables does the Comptrove database have? I need the schema.",
        [r"1,?743"])
    run("webapp-schema-allowance", "How many tables are in the Allowance webapp's database?",
        [r"44 tables", r"\b44\b"])
    # Contract 3: registry injection on webapp asks
    run("webapp-registry", "what webapps exist on this platform",
        [r"terminal\.spaincos\.com", r"Comptrove"])

    out = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "passed": sum(1 for t in tests if t["ok"]), "total": len(tests), "tests": tests}
    (RESULTS / "latest.json").write_text(json.dumps(out, indent=1))
    print("\n{}/{} contracts green — results: qa-reports/contract-tests/latest.json".format(out["passed"], out["total"]))
    sys.exit(0 if out["passed"] == out["total"] else 1)

if __name__ == "__main__":
    main()
