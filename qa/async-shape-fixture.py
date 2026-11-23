#!/usr/bin/env python3
"""async-shape-fixture — v336 (coordinator directive BND-DSQA-ASYNC-30ED275):
the next admissible test for the async truncation question is a NO-PROVIDER
request-shape fixture, not another benchmark run or a new model run.

Asserts, from the deployed gateway-chat source (read-only, no network, no
provider calls):
  F1  The deep_research branch returns a deep_research_id BEFORE the sync
      completeSet predicate and tokenBudget are reached — i.e. the v310
      budget fix STRUCTURALLY CANNOT apply to async rows (do not infer
      truncation causality from it).
  F2  The async request body carries: background: true, max_output_tokens:
      DEEP_MAX_OUTPUT_TOKENS, max_steps: DEEP_MAX_STEPS, web_search tool.
  F3  DEEP_MAX_OUTPUT_TOKENS >= 16000 (output cap is not the truncation
      constraint).
Exit 1 on any assertion failure. Run: python3 qa/async-shape-fixture.py [path-to-index.ts]
"""
import re, sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else
           Path(__file__).resolve().parent.parent / "supabase/functions/gateway-chat/index.ts")
BRIEF = (SRC.parent.parent / "_shared" / "deep-brief.ts") if (SRC.parent.parent / "_shared" / "deep-brief.ts").exists() else (SRC.parent / "_shared" / "deep-brief.ts")

def main() -> int:
    s = SRC.read_text(encoding="utf-8")
    # F1: ordering — async return precedes the sync predicate/budget lines
    dr_return = s.find('JSON.stringify({ deep_research_id: run.id')
    complete_set = s.find('const completeSet =')
    token_budget = s.find('const tokenBudget =')
    assert dr_return != -1 and complete_set != -1 and token_budget != -1, "markers not found in source"
    f1 = dr_return < complete_set and dr_return < token_budget
    print(f"F1 async returns before completeSet/tokenBudget: {'PASS' if f1 else 'FAIL'} (async@{dr_return}, completeSet@{complete_set}, tokenBudget@{token_budget})")
    # F2: async request body shape
    seg = s[dr_return-4000:dr_return]
    f2a = "background: true" in seg
    f2b = "max_output_tokens: DEEP_MAX_OUTPUT_TOKENS" in seg
    f2c = "max_steps: DEEP_MAX_STEPS" in seg
    f2d = '"web_search"' in seg
    print(f"F2 body shape: background={f2a} max_output_tokens={f2b} max_steps={f2c} web_search={f2d}")
    # F3: brief constants
    b = BRIEF.read_text(encoding="utf-8")
    m = re.search(r"DEEP_MAX_OUTPUT_TOKENS\s*=\s*(\d+)", b)
    f3 = m and int(m.group(1)) >= 16000
    print(f"F3 DEEP_MAX_OUTPUT_TOKENS: {m.group(1) if m else 'not found'} ({'PASS' if f3 else 'FAIL'})")
    ok = f1 and f2a and f2b and f2c and f2d and f3
    print("ASYNC SHAPE FIXTURE:", "PASS" if ok else "FAIL")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
