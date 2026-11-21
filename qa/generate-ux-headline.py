#!/usr/bin/env python3
"""UX Master (Part E) headline generator — modeled on generate-parity-headline.py.

The Part E headline is computed from qa/ux-items.json, NEVER hand-summed.
Per app: strict = sum(W*score)/sum(W) with unmeasured (U) = 0; measured-only excludes U;
coverage = share of applicable checks that are measured (G/Y/R).
Portfolio = sum(app_weight*app_score)/sum(app_weight). Long-tail apps have weight 0 until audited.

Usage:
    python3 qa/generate-ux-headline.py           # recompute + validate + report
    python3 qa/generate-ux-headline.py --write   # also write qa-reports/ux-headline-latest.json

Exits non-zero if the JSON is malformed, weights changed, or an item is invalid.
"""
import json, sys, datetime, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "qa" / "ux-items.json"
OUT = ROOT / "qa-reports" / "ux-headline-latest.json"
EXPECTED_APP_WEIGHT = 100
SC = {"G": 100, "Y": 50, "R": 0, "U": 0}


def main() -> int:
    try:
        d = json.loads(ITEMS.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"FAIL: cannot read {ITEMS}: {e}")
        return 1
    aw = d["app_weights"]
    if sum(aw.values()) != EXPECTED_APP_WEIGHT:
        print(f"FAIL: app weight total {sum(aw.values())} != {EXPECTED_APP_WEIGHT} (deliberate rebalance needs a change-log entry)")
        return 1
    apps = {}
    for a in aw:
        num = den = numm = denm = 0
        n = collections.Counter()
        for it in d["items"]:
            s = it["status"].get(a)
            if s is None or s == "-":
                continue
            if s not in SC or not 1 <= it["W"] <= 10:
                print(f"FAIL: bad item {it['id']}")
                return 1
            n[s] += 1
            num += it["W"] * SC[s]; den += it["W"]
            if s != "U":
                numm += it["W"] * SC[s]; denm += it["W"]
        tot = sum(n.values())
        apps[a] = dict(strict=round(num / den, 1) if den else None,
                       measured_only=round(numm / denm, 1) if denm else None,
                       coverage=round(100 * (tot - n["U"]) / tot, 1) if tot else None,
                       counts=dict(n), weighted_num=num, weighted_den=den)
    tw = sum(aw.values())
    port = round(sum(aw[a] * apps[a]["strict"] for a in aw) / tw, 1)
    portm = round(sum(aw[a] * apps[a]["measured_only"] for a in aw) / tw, 1)
    open_sev = collections.Counter(f["severity"] for f in d.get("findings", []))
    rec = dict(ts=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
               version=d.get("version"), portfolio_strict_pct=port, portfolio_measured_only_pct=portm,
               apps=apps, findings_by_severity=dict(open_sev),
               launch_gate=d.get("launch_gate"),
               launch_ready={a: bool(apps[a]["strict"] >= 85 and apps[a]["coverage"] >= 90) for a in aw})
    print(f"UX headline: strict {port}%  measured-only {portm}%  version={d.get('version')}")
    for a in aw:
        x = apps[a]
        print(f"  {a}: strict {x['strict']}%  measured-only {x['measured_only']}%  coverage {x['coverage']}%  {x['counts']}")
    print(f"findings by severity: {dict(open_sev)} (launch gate also requires zero open S0/S1)")
    if "--write" in sys.argv:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(rec, indent=1), encoding="utf-8")
        print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
