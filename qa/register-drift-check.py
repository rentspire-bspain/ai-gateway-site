#!/usr/bin/env python3
"""v354 register/doc drift gate — headline integrity.

Fails when the master completion doc's headline paragraph has been hand-edited
away from what qa/generate-ux-headline.py actually computes, or when the
register version in qa/ux-items.json disagrees with the doc's (vNN) tag.
The headline is computed, never hand-summed; this makes that rule mechanical.

Run: python3 qa/register-drift-check.py   (exit 0 = consistent)
"""
import json, pathlib, re, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOC = ROOT / "qa-reports" / "parity-master-completion-2026-11-17.md"

def main():
    reg = json.loads((ROOT / "qa" / "ux-items.json").read_text())
    subprocess.run([sys.executable, str(ROOT / "qa" / "generate-ux-headline.py"), "--write"], check=True, capture_output=True)
    h = json.loads((ROOT / "qa-reports" / "ux-headline-latest.json").read_text())
    strict = h["portfolio_strict_pct"]
    meas = h["portfolio_measured_only_pct"]
    g = sum(h["apps"][a]["counts"]["G"] for a in h["apps"])
    y = sum(h["apps"][a]["counts"]["Y"] for a in h["apps"])
    r = sum(h["apps"][a]["counts"]["R"] for a in h["apps"])
    u = sum(h["apps"][a]["counts"]["U"] for a in h["apps"])

    doc = DOC.read_text()
    m = re.search(r"\*\*Part E portfolio UX readiness, strict: *([0-9.]+)%\*\*.*?\*\*measured-only: *([0-9.]+)%\*\* · *(\d+)✅ */ *(\d+)🟡 */ *(\d+)🔴 */ *(\d+)⚪", doc)
    problems = []
    if not m:
        problems.append("headline paragraph not found / malformed")
    else:
        vals = [float(m.group(1)), float(m.group(2)), int(m.group(3)), int(m.group(4)), int(m.group(5)), int(m.group(6))]
        want = [strict, meas, g, y, r, u]
        for name, got, exp in zip(["strict", "measured-only", "G", "Y", "R", "U"], vals, want):
            if abs(got - exp) > 0.05:
                problems.append(f"doc headline {name}={got} but computed={exp} (hand-edit drift)")

    vm = re.search(r"v(\d+) — batch", doc)
    if not vm:
        problems.append("doc headline carries no (vNN — batch …) version tag")
    elif int(vm.group(1)) != reg.get("version"):
        problems.append(f"doc says v{vm.group(1)} but qa/ux-items.json is v{reg.get('version')}")

    if problems:
        for p in problems:
            print("DRIFT:", p)
        return 1
    print(f"register-drift-check: consistent (v{reg['version']}, strict {strict}% / measured {meas}%, {g}G/{y}Y/{r}R/{u}U)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
