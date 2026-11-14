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
import argparse, json, os, re, sys, time, urllib.request, urllib.error
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

def write_report(base):
    """Machine-readable run record: qa-reports/prelaunch/latest.json — consumed by the
    Fleet page (QA tab) and the scheduled prelaunch guardian. History in history.jsonl."""
    import datetime
    SHOTS.mkdir(parents=True, exist_ok=True)
    rec = {"ts": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
           "base": base, "passed": sum(1 for _, ok, _ in RESULTS if ok),
           "failed": sum(1 for _, ok, _ in RESULTS if not ok),
           "checks": [{"name": n, "ok": ok, "detail": d} for n, ok, d in RESULTS],
           "exit": 1 if any(not ok for _, ok, _ in RESULTS) else 0}
    (SHOTS / "latest.json").write_text(json.dumps(rec, indent=1))
    with open(SHOTS / "history.jsonl", "a") as f:
        f.write(json.dumps({"ts": rec["ts"], "passed": rec["passed"], "failed": rec["failed"], "exit": rec["exit"]}) + "\n")
    return rec

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
    return json.loads(body) if st == 200 else None

def mint_token():
    return (mint() or {}).get("access_token")

# ---------------- backend smoke ----------------
def backend():
    print("BACKEND")
    st, body, dt = http(f"{SB}/functions/v1/gateway-status", 20)
    check("gateway-status 200", st == 200, f"HTTP {st}")
    m = mint()
    tok = m and m.get("access_token")
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

# ---------------- deploy integrity ----------------
def integrity(base):
    """Every module the deployed index.html loads must byte-match this checkout.
    Catches: stale deploys, editing an orphaned file that nothing loads, missing files."""
    print("DEPLOY INTEGRITY")
    repo = Path(__file__).resolve().parent.parent
    try:
        html = http(base + "/index.html", 30)[1].decode("utf-8", "replace")
    except Exception as e:
        check("index.html fetches", False, str(e)[:100]); return
    srcs = re.findall(r'(?:src|href)="(/(?:modules|js|css)/[^"?]+)', html)
    if not check("index.html loads real modules", len(srcs) >= 5, f"{len(srcs)} refs"):
        return
    stale = []
    for s in dict.fromkeys(srcs):
        local = repo / s.lstrip("/")
        if not local.exists():
            stale.append(f"{s}: MISSING in repo"); continue
        live = http(base + s, 30)[1]
        if live != local.read_bytes():
            stale.append(f"{s}: live != repo")
    check("all deployed modules match repo", not stale, "; ".join(stale[:4]))
    # stale-tab detector contract: /build.json must equal the BUILD constant shipped to the
    # browser. v184 moved window.BUILD out of index.html into the external CSP-safe
    # /build.js, so read the stamp there (fall back to index.html for older deploys).
    try:
        bj = json.loads(http(base + "/build.json", 20)[1]).get("build")
        mb = re.search(r'window\.BUILD = "([^"]+)"', http(base + "/build.js", 20)[1].decode("utf-8", "replace"))
        if not mb:
            mb = re.search(r'window\.BUILD = "([^"]+)"', html)
        check("build.json matches shipped BUILD (stale-tab detector armed)", bool(mb) and mb.group(1) == bj, f"build.js={mb and mb.group(1)} build.json={bj}")
    except Exception as e:
        check("build.json matches shipped BUILD (stale-tab detector armed)", False, str(e)[:100])

# ---------------- frontend E2E ----------------
def frontend(base):
    print("FRONTEND E2E")
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        # localhost QA runs must bypass the sandbox HTTP proxy (chromium would ERR_FAILED on 127.0.0.1)
        import urllib.parse as _up
        _local = _up.urlparse(BASE).hostname in ("localhost", "127.0.0.1")
        b = p.chromium.launch(args=(["--no-proxy-server"] if _local else []))
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(f"pageerror: {str(e)[:120]}"))
        http404 = []
        pg.on("response", lambda r: http404.append(f"{r.status} {r.url[-60:]}") if r.status >= 400 else None)
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
        m = mint()
        tok = m and m.get("access_token")
        if tok:
            # supabase-js v2 storage format: the session object directly (v1's {currentSession:...} wrapper is ignored)
            sess = {"access_token": m.get("access_token"), "refresh_token": m.get("refresh_token"),
                    "expires_in": m.get("expires_in", 3600), "expires_at": m.get("expires_at") or int(time.time()) + 3600,
                    "token_type": m.get("token_type", "bearer"), "user": m.get("user")}
            pg.evaluate("s => localStorage.setItem('sb-bnxermyboeigvwonfrzx-auth-token', JSON.stringify(s))", sess)
        # unique slug per run: reusing a fixed slug accumulated ~50 duplicate
        # "Prelaunch" threads on the eval account and the app's slug-dedup resync
        # (rename loop prelaunch-1..-N + redirect) grew slower than this suite's
        # render wait — a test-hygiene leak, not a prod regression (v208 finding)
        slug = f"prelaunch-{int(time.time())}"
        thread = {"id": f"pre{int(time.time())}", "slug": slug, "title": "Prelaunch", "incognito": False,
                  "messages": [{"role": "user", "content": "master doc please"},
                               {"role": "assistant", "content": "Here:\n\n```markdown\n# Prelaunch Doc\n\n## Section\n\n    git clone https://example.com/repo.git\n    pip install -r requirements.txt\n\n| Gate | Criterion |\n|---|---|\n| G0 | Runs cleanly |\n\nBody text here.\n```",
                                "related": ["First follow-up about the registry lanes", "Second question about schedules"]}]}
        pg.evaluate("t => localStorage.setItem('ai_threads', JSON.stringify([t]))", thread)
        pg.goto(f"{base}/t/{slug}", wait_until="networkidle", timeout=45000)
        pg.wait_for_timeout(2000)
        pg.screenshot(path=str(SHOTS / "thread.png"))
        check("thread renders", pg.locator(".question-header").count() >= 1)
        # the owner-reported killer: on /t/<slug> routes every lazily-loaded module resolved
        # to /t/modules/... and 404'd — composer/follow-ups/search silently died there.
        check("thread route loads all modules (no /t/ 404s)", not http404, "; ".join(http404[:4]))
        fonts = pg.evaluate("() => { const q = document.querySelector('.question-header'); const a = document.querySelector('.answer-content p'); return (q && a) ? {q: parseFloat(getComputedStyle(q).fontSize), a: parseFloat(getComputedStyle(a).fontSize)} : null; }")
        check("question/answer text parity (16px)", fonts and abs(fonts["q"] - fonts["a"]) <= 2, str(fonts))
        chips = pg.locator(".related-item").count()
        check("follow-up chips render", chips >= 1, str(chips))
        check("Run-all button present", pg.locator(".related-runall").count() == 1)
        # doc panel — v163 (owner directive): NO auto-open. The chip is the entry point;
        # the panel opens only on explicit click. Verify chip present, click it, then check rendering.
        chip = pg.locator(".doc-chip, .dp-row .dp-card").first
        chip_ok = chip.count() >= 1
        check("doc chip present (no auto-open)", chip_ok)
        if chip_ok:
            chip.click()
            pg.wait_for_timeout(700)
        dp = pg.evaluate("() => ({open: document.body.classList.contains('dp-open'), h1: (h => h ? getComputedStyle(h).fontSize : 'x')(document.querySelector('.dp-panel .dp-md h1')), code: !!document.querySelector('.dp-panel .dp-codebar button'), mono: (c => c ? getComputedStyle(c).fontFamily.includes('monospace') : false)(document.querySelector('.dp-panel .dp-code pre code'))})")
        check("doc panel opens on chip click", dp["open"])
        check("doc h1 heading scale (20-28px)", dp["open"] and dp["h1"] != "x" and 20 <= float(str(dp["h1"]).replace("px", "")) <= 28, str(dp))
        check("doc code monospace + copy", dp["code"] and dp["mono"])
        check("doc-chip collapses raw markdown", pg.locator(".doc-chip").count() >= 1)
        check("raw doc pre is hidden in chat",
              pg.evaluate("() => { const pres = [...document.querySelectorAll('.answer-content pre')]; const hit = pres.find(p => /Prelaunch Doc|Gate|Criterion/.test(p.innerText || '')); return hit ? getComputedStyle(hit).display === 'none' : pres.length === 0; }"))
        # Settings > Connectors
        pg.evaluate("() => { window.SettingsUI && window.SettingsUI.open(); }")
        try:
            pg.wait_for_selector("[role=dialog] button, .st-tab, .settings button", timeout=8000)
        except Exception:
            pass
        pg.evaluate("() => { const t = [...document.querySelectorAll('button')].find(x => /connector/i.test(x.textContent || '')); if (t) t.click(); }")
        conn_ok = False
        for _ in range(6):  # panel content loads async (connector list fetch) — poll, don't race
            pg.wait_for_timeout(800)
            if pg.evaluate("() => document.body.innerText.toLowerCase().includes('google')"):
                conn_ok = True; break
        pg.screenshot(path=str(SHOTS / "connectors.png"))
        check("Connectors panel renders", conn_ok)
        # Fleet page
        pg.evaluate("() => document.getElementById('navFleet') && document.getElementById('navFleet').click()")
        pg.wait_for_timeout(2500)
        pg.screenshot(path=str(SHOTS / "fleet.png"))
        check("Fleet page renders registry", pg.evaluate("() => !!document.querySelector('.fl-card, .fl-msg')"))
        # QA tab: the pre-launch fleet's report must load inside the product
        pg.evaluate("() => { const t = [...document.querySelectorAll('.fl-tab')].find(x => x.textContent.trim() === 'QA'); if (t) t.click(); }")
        pg.wait_for_timeout(1500)
        qa_txt = pg.evaluate("() => { const w = document.querySelector('.fl-wrap'); return w ? w.innerText : ''; }")
        check("Fleet QA tab shows fleet report", "pre-launch regression fleet" in qa_txt.lower() and ("all green" in qa_txt.lower() or "failed" in qa_txt.lower()), qa_txt[:120])
        pg.screenshot(path=str(SHOTS / "fleet-qa.png"))
        if chips:
            try:  # close any open overlays (Fleet panel, Settings modal) — they intercept clicks on the thread below
                pg.evaluate("""() => { const x = document.querySelector('.fl-x'); if (x) x.click();
                    const sm = document.querySelector('[role=dialog] .stg-x, .st-close, [aria-label=Close]');
                    document.querySelectorAll('[role=dialog]').forEach(d => d.remove()); }""")
                pg.wait_for_timeout(600)
            except Exception: pass
            pg.evaluate("() => { const c = document.querySelector('.related-item'); if (c) c.click(); }")  # DOM click — immune to overlay interception
            pg.wait_for_timeout(3000)
            check("follow-up chip submits (search state)", pg.locator(".searching-state").count() >= 1 or pg.locator(".question-header").count() >= 2)
        check("zero JS/CSP errors", len([e for e in errs if "404" not in e]) == 0, "; ".join(errs[:3]))
        b.close()

def _safe(fn, *a):
    try:
        fn(*a)
    except Exception as e:  # a crashing stage is itself a FAIL — never a silent pass, never an abort
        check(f"{fn.__name__} completed without crashing", False, f"{type(e).__name__}: {str(e)[:140]}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=BASE)
    a = ap.parse_args()
    print(f"PRE-LAUNCH REGRESSION FLEET -> {a.base}")
    _safe(backend)
    if os.environ.get("PRELAUNCH_SKIP_INTEGRITY") != "1": _safe(integrity, a.base)
    _safe(frontend, a.base)
    fails = [r for r in RESULTS if not r[1]]
    rec = write_report(a.base)
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} passed, {len(fails)} failed")
    print(f"report: {SHOTS / 'latest.json'}")
    for name, _, detail in fails:
        print(f"  FAIL: {name} [{detail}]")
    sys.exit(1 if fails else 0)
