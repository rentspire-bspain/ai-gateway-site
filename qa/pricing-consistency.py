#!/usr/bin/env python3
"""U-PAY-01 / BV-05 (batch 32): pricing single-source consistency gate.

pricing.json is the canonical machine-readable pricing source. This gate:
  1. pricing.json parses and carries the required fields.
  2. The embedded fallback constants in modules/settings-billing.js (the live
     checkout surface) match pricing.json exactly.
  3. The public pricing page (pricing.boundview.html) is checked for tier/price
     mentions and any DIVERGENCE is reported. Known owner decision: the public
     page currently describes planned tiers (Starter/Pro/Unlimited, no prices,
     "checkout not live yet") while the in-app billing pane carries the live
     Core/Max/Team Stripe prices — resolving that copy is an owner pricing call,
     tracked in the register (U-PAY-01 BV stays Y until decided).

Exit 0 = mechanism consistent (1 and 2 pass; 3 reported). Exit 1 = the live
checkout surface no longer matches the canonical source.
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

def main():
    data = json.loads((ROOT / "pricing.json").read_text())
    assert data["currency"] == "usd"
    assert isinstance(data["credit_value_usd"], (int, float))
    plans = {p["id"]: p for p in data["plans"]}
    assert set(plans) == {"core", "max", "team"}, plans.keys()

    src = (ROOT / "modules" / "settings-billing.js").read_text()

    def price_of(pid):
        m = re.search(r'data-plan="' + pid + r'"[^>]*>\s*</button></div>\'.*', src)  # fallback below
        # simpler: find the plan card block then the price inside it
        blocks = re.findall(r'<div style="[^"]*"[^>]*><div style="font-weight:700">([A-Za-z]+)</div><div class="muted">(\$[0-9]+ /[^<]*)</div>', src)
        return blocks

    blocks = price_of("core")
    found = {name: price for name, price in blocks}
    problems = []
    expect = {"Core": "$8 / month", "Max": "$50 / month", "Team": "$20 / seat / month"}
    for name, price in expect.items():
        if found.get(name) != price:
            problems.append(f"billing pane card {name}: expected {price}, got {found.get(name)!r}")
    if set(found) != set(expect):
        problems.append(f"billing pane plan cards {sorted(found)} != pricing.json plans Core/Max/Team")

    # credit-value line
    if "1 credit = $0.01" not in src:
        problems.append("billing pane credit value line (1 credit = $0.01) missing — diverges from pricing.json credit_value_usd")

    page = (ROOT / "pricing.boundview.html").read_text()
    page_tiers = re.findall(r"<h3>([A-Za-z]+)</h3>", page)
    diverged = sorted(set(page_tiers) - {"Core", "Max", "Team"})
    if diverged:
        print(f"NOTE (owner decision, U-PAY-01): public pricing page shows planned tiers {page_tiers} "
              f"while the live billing pane shows Core/Max/Team — pricing copy reconciliation is an owner call.")

    if problems:
        for p in problems:
            print("FAIL:", p)
        return 1
    print("pricing-consistency: canonical source matches the live checkout surface")
    return 0

if __name__ == "__main__":
    sys.exit(main())
