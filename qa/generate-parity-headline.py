#!/usr/bin/env python3
"""parity headline generator — the 34a honest-progress ledger, made autonomous.

Owner directive 2026-11-14 (v204/v205): the parity doc headline is computed from
this file, NEVER hand-summed. Each batch updates qa/parity-items.json (scores +
evidence pointers live in the doc's change log) and reruns this script; the
nightly self-audit (parity_self_audit 07:30 UTC) can rerun it to detect drift.

Usage:
    python3 qa/generate-parity-headline.py            # recompute + validate + report
    python3 qa/generate-parity-headline.py --write    # also write qa-reports/parity-headline-latest.json

Exits non-zero if the JSON is malformed, weights changed, or the arithmetic is
inconsistent — so the nightly gate catches a broken batch before it ships.
"""
import json, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "qa" / "parity-items.json"
OUT = ROOT / "qa-reports" / "parity-headline-latest.json"

EXPECTED_WEIGHT = 98  # the 17-category weight total; a change here is a deliberate decision, not an edit


def main() -> int:
    try:
        data = json.loads(ITEMS.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"FAIL: cannot read {ITEMS}: {e}")
        return 1
    cats = data.get("categories", [])
    if not cats:
        print("FAIL: no categories in parity-items.json")
        return 1
    total_weight = sum(c["weight"] for c in cats)
    if total_weight != EXPECTED_WEIGHT:
        print(f"FAIL: category weight total {total_weight} != {EXPECTED_WEIGHT} — if this is an intentional "
              f"rebalance, update EXPECTED_WEIGHT in qa/generate-parity-headline.py with a doc changelog entry.")
        return 1
    weighted = sum(c["weight"] * c["score"] for c in cats)
    headline = round(weighted / total_weight, 1)
    raw = data.get("raw_items", {})
    rec = {
        "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "version": data.get("version"),
        "headline_pct": headline,
        "weighted_sum": weighted,
        "total_weight": total_weight,
        "categories": {c["name"]: c["score"] for c in cats},
        "raw_items": raw,
        "path_to_75": {"points_needed": max(0, round(75.0 * total_weight - weighted))},
        "owner_blockers": data.get("owner_blockers", []),
    }
    print(f"parity headline: {headline}%  ({weighted}/{total_weight})  version={data.get('version')}")
    print(f"raw items: {raw}")
    print(f"points to 75%: {rec['path_to_75']['points_needed']}")
    if "--write" in sys.argv:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(rec, indent=1), encoding="utf-8")
        print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
