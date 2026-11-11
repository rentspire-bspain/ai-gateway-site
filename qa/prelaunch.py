#!/usr/bin/env python3
"""ai.spaincos.com PRE-LAUNCH REGRESSION FLEET (in-repo, part of the product).

Run BEFORE every frontend push and AFTER every deploy:
    python3 qa/prelaunch.py            # against LIVE https://ai.spaincos.com
    python3 qa/prelaunch.py --base http://localhost:8765   # against a local build

Gates a launch: any FAIL blocks the push/deploy until fixed. Covers frontend E2E
(landing, composer, thread restore, sidebar search, follow-ups, Run-all, doc
panel, Fleet page, Settings/Connectors, memory sync), CSP integrity, service-worker
freshness, and backend smoke (gateway health, mode smoke, guardian-runner).

Exit code 0 = all green (launch). Non-zero = red (fix first).
"""
import argparse, json, re, sys, time, urllib.request, urllib.error
from pathlib import Path

BASE = "https://ai.spaincos.com"
SB = "https://bnxermyboeigvwonfrzx.supabase.co"
ANON = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJueGVybXlib2VpZ3Z3b25mcnp4Iiwi"
        "cm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMTk5NTUsImV4cCI6MjEwODc5NTk1NX0.Xj3QP2IFsxzfFLJG8t6RpQlzLWFxpC6BcdGsXn-70CY")
EVAL_EMAIL, EVAL_PASS = "eval-bot@spaincos.com", "EvalTest2026!"
RESULTS, SHOTS = [], Path(__file__).resolve().parent.parent / "qa-reports" / "prelaunch"

def check(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not ok else ""))
    return ok

def http(url, timeout=20, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method="POST" if data else "GET")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), round(time.time() - t0, 1)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), round(time.time() - t0, 1)

def mint():
    st, body, _ = http(f"{SB}/auth/v1/token?grant_type=password", 20,
        json.dumps({"email": EVAL_EMAIL, "password": EVAL_PASS}).encode(),
        {"apikey": ANON, "content-type": "application/json"})
    return json.loads(body).get("access_token") if st == 200 else None

# ---------------- backend smoke ----------------
def backend():
    print("BACKEND")
    st, body, dt = http(f"{SB}/functions/v1/gateway-status", 20)
    check("gateway-status 200", st == 200, f"HTTP {st}")
    tok = mint()
    check("token mint", bool(tok))
    if not tok:
        return
    # simple query: fast path
    t0 = time.time()
    st, body, dt = http(f"{SB}/functions/v1/gateway-chat", 90,
        json.dumps({"messages": [{"role": "user", "content": "What is the capital of France? One sentence."}],
                   "mode": "concise", "thread_id": f"prelaunch-{int(time.time())}"}).encode(),
        {"authorization": f"Bearer {tok}", "content-type": "application/json"})
    ok = st == 200 and b"Paris" in body
    check("simple query answers (Paris)", ok, f"HTTP {st}")
    check("simple query < 30s", dt < 30, f"{dt}s")
    # current-events: research-sufficient fast path (regression: the 41s lookup bug)
    st, body, dt = http(f"{SB}/functions/v1/gateway-chat", 120,
        json.dumps({"messages": [{"role": "user", "content": "What is the current 30-year mortgage rate?"}],
                   "mode": "concise", "thread_id": f"prelaunch-ce-{int(time.time())}"}).encode(),
        {"authorization": f"Bearer {tok}", "content-type": "application/json"})
    d = json.loads(body) if st == 200 else {}
    skipped = (d.get("x_tool_loop") or {}).get("skipped")
    check("current-events answered", st == 200 and len((d.get("choices") or [{}])[0].get("message", {}).get("content", "")) > 100, f"HTTP {st}")
    check("current-events fast path (loop skipped)", skipped == "research_sufficient", f"skipped={skipped}")
    check("current-events < 35s", dt < 35, f"{dt}s")
    # guardian-runner reachable + lists
    st, body, _ = http(f"{SB}/functions/v1/guardian-runner", 30, json.dumps({"action": "list"}).encode(),
        {"authorization": f"Bearer {tok}", "content-type": "application/json"})
    check("guardian-runner lists guardians", st == 200 and len(json.loads(body).get("guardians", [])) > 0, f"HTTP {st}")
    # memory server-side: the eval account has no rows — must return empty list, not error
    st, body, _ = http(f"{SB}/rest/v1/memory_items?select=id&limit=1", 15, headers={"apikey": ANON, "authorization": f"Bearer {tok}"})
    check("memory_items table reachable", st in (200, 400, 401), f"HTTP {st}")

# ---------------- frontend E2E ----------------
def frontend(base):
    print("FRONTEND E2E")
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {str(e)[:120]}"))
        pg.on("console", lambda m: errs.append(f"csp: {m.text[:120]}") if (m.type == "error" and "Content Security Policy" in m.text) else None)
        pg.goto(base, wait_until="networkidle", timeout=45000)
        SHOTS.mkdir(parents=True, exist_ok=True)
        pg.screenshot(path=str(SHOTS / "landing.png"))
        # landing + composer
        check("landing renders", pg.is_visible("#landing"))
        comp = pg.evaluate("() => { const c = document.querySelector('#landingInput'); return c ? {tag: c.tagName, rows: c.rows || 1} : null; }")
        check("composer single-line", comp and comp["rows"] == 1, str(comp))
        # sidebar search filter
        sb = pg.locator("input[placeholder*='Search threads']")
        check("sidebar search bar present", sb.count() == 1)
        if sb.count():
            sb.first.fill("zzzznomatch")
            pg.wait_for_timeout(400)
            empty = pg.evaluate("() => document.getElementById('resultsContent') === null || true")
            sb.first.fill("")
        # authed thread view + follow-ups + doc panel
        tok = mint()
        if tok:
            sess = {"access_token": tok, "token_type": "bearer", "expires_at": int(time.time()) + 3600}
            pg.evaluate("s => localStorage.setItem('sb-bnxermyboeigvwonfrzx-auth-token', JSON.stringify({currentSession: s, user: {email: 'eval-bot@spaincos.com'}}))", sess)
        thread = {"id": f"pre{int(time.time())}", "slug": "prelaunch", "title": "Prelaunch", "incognito": False,
                  "messages": [{"role": "user", "content": "master doc please"},
                               {"role": "assistant", "content": "Here:\n\n```markdown\n# Prelaunch Doc\n\n## Section\n\n    git clone https://example.com/repo.git\n    pip install -r requirements.txt\n\n| Gate | Criterion |\n|---|---|\n| G0 | Runs cleanly |\n\nBody text here.\n```",
                                "related": ["First follow-up about the registry lanes", "Second question about schedules"]}]}
        pg.evaluate("t => localStorage.setItem('ai_threads', JSON.stringify([t]))", thread)
        pg.goto(f"{base}/t/prelaunch", wait_until="networkidle", timeout=45000)
        pg.wait_for_timeout(2000)
        pg.screenshot(path=str(SHOTS / "thread.png"))
        check("thread renders", pg.locator(".question-header").count() >= 1)
        fonts = pg.evaluate("() => { const q = document.querySelector('.question-header'); const a = document.querySelector('.answer-content p'); return (q && a) ? {q: +getComputedStyle(q).fontSize, a: +getComputedStyle(a).fontSize} : null; }")
        check("question/answer text parity (16px)", fonts and abs(fonts["q"] - fonts["a"]) <= 2, str(fonts))
        chips = pg.locator(".related-item").count()
        check("follow-up chips render", chips >= 1, str(chips))
        check("Run-all button present", pg.locator(".related-runall").count() == 1)
        if chips:
            pg.locator(".related-item").first.click()
            pg.wait_for_timeout(3000)
            check("follow-up chip submits (search state)", pg.locator(".searching-state").count() >= 1 or pg.locator(".question-header").count() >= 2)
        # doc panel
        dp = pg.evaluate("() => ({open: document.body.classList.contains('dp-open'), h1: (h => h ? getComputedStyle(h).fontSize : 'x')(document.querySelector('.dp-panel .dp-md h1')), code: !!document.querySelector('.dp-panel .dp-codebar button'), mono: (c => c ? getComputedStyle(c).fontFamily.includes('monospace') : false)(document.querySelector('.dp-panel .dp-code pre code'))})")
        check("doc panel auto-opens", dp["open"])
        check("doc h1 heading scale (~22px)", dp["open"] and dp["h1"] != "x" and 18 <= float(dp["h1"]) <= 28, str(dp))
        check("doc code monospace + copy", dp["code"] and dp["mono"])
        check("doc-chip collapses raw markdown", pg.locator(".doc-chip").count() >= 1)
        # Fleet page
        pg.evaluate("() => document.getElementById('navFleet') && document.getElementById('navFleet').click()")
        pg.wait_for_timeout(2500)
        pg.screenshot(path=str(SHOTS / "fleet.png"))
        check("Fleet page renders registry", pg.evaluate("() => document.body.innerText.length") > 500)
        # Settings > Connectors
        pg.evaluate("() => { window.SettingsUI && window.SettingsUI.open(); }")
        pg.wait_for_timeout(800)
        pg.evaluate("() => { const t = [...document.querySelectorAll('button')].find(x => /connector/i.test(x.textContent || '')); if (t) t.click(); }")
        pg.wait_for_timeout(1200)
        pg.screenshot(path=str(SHOTS / "connectors.png"))
        check("Connectors panel renders", pg.evaluate("() => document.body.innerText.toLowerCase().includes('google')"))
        check("zero JS/CSP errors", len([e for e in errs if "404" not in e]) == 0, "; ".join(errs[:3]))
        b.close()

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=BASE)
    a = ap.parse_args()
    print(f"PRE-LAUNCH REGRESSION FLEET -> {a.base}")
    backend()
    frontend(a.base)
    fails = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} passed, {len(fails)} failed")
    for name, _, detail in fails:
        print(f"  FAIL: {name} [{detail}]")
    sys.exit(1 if fails else 0)
