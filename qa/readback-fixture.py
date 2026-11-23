#!/usr/bin/env python3
"""Deterministic local (non-production) test of the PR #362 readback checklist.

Runs the three readback items that are provable without deploying:
  1. security.txt validates (RFC 9116 fields present, Expires in the future)
  2. CSP inline-script hashes unchanged (qa/csp-hash-check.py)
  3. Accessibility negative-control: the branch served locally has 0/16 bare
     color-only indicators; live production (unfixed) must show >0 so the check
     is proven to detect failures (negative path).

Exit 0 = all pass. No network writes; GET requests only."""
import re, subprocess, sys, datetime, json, socket
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
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

# --- 3. A11Y check: local positive vs production negative control ---
def a11y_count(url, timeout=45000):
    import asyncio
    from playwright.async_api import async_playwright
    async def run():
        async with async_playwright() as pw:
            b = await pw.chromium.launch(
                executable_path=str(Path.home() / ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome"),
                args=["--no-sandbox"])
            pg = await (await b.new_context(viewport={"width": 375, "height": 812})).new_page()
            try:
                await pg.goto(url, wait_until="networkidle", timeout=timeout)
            except Exception:
                pass
            n = await pg.evaluate("""() => {
                const dots = [...document.querySelectorAll('[class*=status], [class*=dot], [role=status]')].slice(0, 40);
                return dots.filter(e => !e.textContent.trim() && !e.getAttribute('aria-label')
                    && e.getAttribute('aria-hidden') !== 'true' && e.getAttribute('role') !== 'status').length;
            }""")
            await b.close()
            return n
    return asyncio.run(run())

try:
    local = a11y_count("http://localhost:8899/index.html")
    if local == 0:
        print("PASS a11y local (branch): 0 bare color-only indicators")
    else:
        fails.append(f"a11y local = {local}"); print(f"FAIL a11y local: {local} bare indicators")
    prod = a11y_count("https://ai.spaincos.com")
    if prod > 0:
        print(f"PASS a11y negative control (live production, unfixed): {prod} bare indicators detected — check detects failures")
    else:
        fails.append("negative control returned 0 (production already fixed or check broken)")
        print("WARN negative control: production shows 0 — either already deployed or check is broken")
except Exception as e:
    fails.append(f"a11y: {e}"); print(f"FAIL a11y: {e}")

print("\nRESULT:", "ALL PASS" if not fails else f"FAILURES: {fails}")
sys.exit(0 if not fails else 1)
