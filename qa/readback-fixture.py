#!/usr/bin/env python3
"""Deterministic local (non-production) test of the PR #362 readback checklist. v2 (hardened).

v2 hardening (coordinator review): navigation failures can no longer count as zero —
each check REQUIRES HTTP 200, the expected final URL, and an expected DOM marker before
counting indicators; the negative control is a PINNED LOCAL BASE (git worktree at the
PR base SHA), not mutable production; a missing-page negative asserts that a failed
load is reported as a failure, never as a zero-count pass.

Prereqs (documented, reproducible):
  git worktree add -f /tmp/base362 <PR-base-SHA>     # pinned unfixed base
  (branch root and /tmp/base362 served on localhost:8899 and :8898)

Exit 0 = all pass. GET requests only; no writes; no credentials."""
import re, subprocess, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXED_URL = "http://localhost:8899/index.html"   # serves the PR head working tree
BASE_URL = "http://localhost:8898/index.html"     # serves the pinned pre-fix base
MISSING_URL = "http://localhost:8899/missing-page-negative.html"
BASE_SHA_FILE = ROOT / "qa" / ".pr362-base-sha"   # records the pinned base for reproducibility
DOM_MARKER = "navTasks"                            # app shell marker present on both head and base
fails = []

# --- 1. security.txt validation (local file) ---
try:
    txt = (ROOT / ".well-known" / "security.txt").read_text()
    assert "Contact: mailto:" in txt, "missing Contact"
    m = re.search(r"Expires: (\S+)", txt)
    assert m, "missing Expires"
    exp = datetime.datetime.fromisoformat(m.group(1).replace("Z", "+00:00"))
    assert exp > datetime.datetime.now(datetime.timezone.utc), "Expires in the past"
    assert "Policy:" in txt, "missing Policy"
    print(f"PASS security.txt: Contact/Expires({m.group(1)})/Policy present, expiry in future")
except Exception as e:
    fails.append(f"security.txt: {e}"); print(f"FAIL security.txt: {e}")

# --- 2. CSP hash check (subprocess, same as CI) ---
r = subprocess.run([sys.executable, str(ROOT / "qa" / "csp-hash-check.py")],
                   capture_output=True, text=True)
if r.returncode == 0:
    print("PASS csp-hash-check:", (r.stdout or r.stderr).strip().splitlines()[-1])
else:
    fails.append("csp-hash-check failed"); print("FAIL csp-hash-check:", r.stderr[:200])

# --- 3. A11Y check with STRICT load gate (200 + final URL + DOM marker before counting) ---
def load_and_count(url, expect_status=200):
    """Returns (ok, detail, count). ok=False on any load failure — a failed navigation
    can never be reported as a zero-count pass."""
    import asyncio
    from playwright.async_api import async_playwright
    async def run():
        async with async_playwright() as pw:
            b = await pw.chromium.launch(
                executable_path=str(Path.home() / ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome"),
                args=["--no-sandbox"])
            pg = await (await b.new_context(viewport={"width": 375, "height": 812})).new_page()
            try:
                resp = await pg.goto(url, wait_until="domcontentloaded", timeout=45000)
            except Exception as e:
                await b.close(); return (False, f"navigation error: {type(e).__name__}", None)
            if resp is None:
                await b.close(); return (False, "no response object (blocked or empty)", None)
            if resp.status != expect_status:
                await b.close(); return (False, f"HTTP {resp.status} (expected {expect_status})", None)
            if pg.url.split("?")[0] != url:
                await b.close(); return (False, f"redirected to {pg.url}", None)
            html = await pg.content()
            if DOM_MARKER not in html:
                await b.close(); return (False, f"DOM marker '{DOM_MARKER}' missing — not the app shell", None)
            n = await pg.evaluate("""() => {
                const dots = [...document.querySelectorAll('[class*=status], [class*=dot], [role=status]')].slice(0, 40);
                return dots.filter(e => !e.textContent.trim() && !e.getAttribute('aria-label')
                    && e.getAttribute('aria-hidden') !== 'true' && e.getAttribute('role') !== 'status').length;
            }""")
            await b.close()
            return (True, "loaded", n)
    return asyncio.run(run())

try:
    base_sha = BASE_SHA_FILE.read_text().strip() if BASE_SHA_FILE.exists() else "unpinned"
    # 3a. POSITIVE: PR head served locally -> 200, app shell, 0 bare
    ok, why, n = load_and_count(FIXED_URL)
    if ok and n == 0:
        print(f"PASS a11y positive (PR head local): HTTP 200 + DOM marker + 0 bare color-only indicators")
    else:
        fails.append(f"a11y positive: ok={ok} why={why} count={n}")
        print(f"FAIL a11y positive: ok={ok} {why} count={n}")

    # 3b. NEGATIVE CONTROL: pinned pre-fix base served locally -> 200, app shell, >0 bare
    ok, why, n = load_and_count(BASE_URL)
    if ok and n and n > 0:
        print(f"PASS a11y negative control (pinned local base {base_sha[:12]}): HTTP 200 + DOM marker + {n} bare indicators — check detects failures")
    elif not ok:
        fails.append(f"negative control did not load: {why}")
        print(f"FAIL negative control load: {why}")
    else:
        fails.append(f"negative control count = {n} (base appears fixed or check broken)")
        print(f"FAIL negative control: count={n} — base not showing the failure signature")

    # 3c. MISSING-PAGE NEGATIVE: a 404 must be reported as a failure, never zero-count
    ok, why, n = load_and_count(MISSING_URL)
    if not ok and n is None:
        print(f"PASS missing-page negative: correctly rejected ({why}) — no zero-count pass")
    else:
        fails.append(f"missing-page negative: ok={ok} why={why} count={n}")
        print(f"FAIL missing-page negative: ok={ok} {why} count={n} — a failed load must not count")
except Exception as e:
    fails.append(f"a11y: {e}"); print(f"FAIL a11y harness: {e}")

print("\nRESULT:", "ALL PASS" if not fails else f"FAILURES: {fails}")
sys.exit(0 if not fails else 1)
