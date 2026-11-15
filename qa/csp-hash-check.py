#!/usr/bin/env python3
"""csp-hash-check — v241 permanent guard.

ROOT CAUSE this closes (owner incident 2026-11-15 night #7, "login broken, dark
theme, buttons dead"): the site's CSP pins a sha256 hash of EVERY inline
<script> block. Any edit to an inline script (auth fixes, features, anything)
silently invalidates the hash, and every browser then refuses to execute the
ENTIRE app script — login dead, theme defaults dark, buttons dead. The page
still loads (HTML renders), so grep-style checks pass while the app is broken.

This check recomputes the hash of every inline script block in index.html and
fails (exit 1) unless every one matches the CSP. Run it in CI on every PR and
after every deploy. It needs no network access.
"""
import base64
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"


def main() -> int:
    html = HTML.read_text(encoding="utf-8")
    csp_m = re.search(r'Content-Security-Policy" content="([^"]+)"', html)
    if not csp_m:
        print("FAIL: no CSP meta tag found")
        return 1
    hashes = set(re.findall(r"'sha256-([^']+)'", csp_m.group(1)))
    blocks = re.findall(r"<script>(.*?)</script>", html, re.S)
    if not blocks:
        print("FAIL: no inline script blocks found")
        return 1
    bad = 0
    for i, b in enumerate(blocks):
        h = base64.b64encode(hashlib.sha256(b.encode()).digest()).decode()
        ok = h in hashes
        print(f"inline block {i}: {'OK' if ok else 'HASH MISMATCH'} (len={len(b)}, sha256={h[:16]}...)")
        if not ok:
            bad += 1
    if bad:
        print(f"FAIL: {bad} inline script block(s) do not match the CSP — the app is JS-dead in every browser.")
        print("     Fix: recompute the hash and update the CSP meta tag (see qa/csp-hash-check.py docstring).")
        return 1
    print(f"PASS: all {len(blocks)} inline script blocks match the CSP hashes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
