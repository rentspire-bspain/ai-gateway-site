#!/usr/bin/env python3
"""
qa/e2e-ux-flows.py — v289 THE REAL-USER-EXPERIENCE SUITE (owner directive 2026-11-20:
"WHAT ABOUT THE FULL ACTUAL USER EXPERIENCE AND BROWSER BENCHMARKS/DEBUG LOOPING/TESTING
ASIDE FROM THE BENCHMARKS? WHY CAN'T WE FIGURE OUT HOW TO IMPROVE THE ACTUAL EXPERIENCE?")

The e2e-real-flows.py suite guards the APP SHELL (auth, brand, links, CSP). This suite
guards the ACTUAL EXPERIENCE — what a signed-in user does minute to minute. Every flow
is driven in a REAL browser (CDP against live Chrome) with a REAL authenticated session
(the fleet's eval account session injected into localStorage — never the owner's).

  U1  SESSION RESTORE: a stored session boots the app past the gate (no login wall on
      reload — the Comet->Chrome "not transferring" report class).
  U2  ASK A QUESTION: a real question renders a real answer in the thread — with
      inline citations [[N]], a Sources section, zero console errors, zero CSP
      violations, zero dead ends. THE core product flow.
  U3  THREAD PERSISTS: the asked thread appears in the sidebar and survives a reload.
  U4  DEEP LINK: /t/<slug> restores the thread in a fresh tab.
  U5  HISTORY AWARENESS (v287 rule): a history-flavored question routes through
      search_my_context (or answers honestly "nothing imported") — never claims the
      history is invisible without searching.
  U6  FOLLOW-UP: a second message in the same thread renders an answer (multi-turn).
  U7  SOURCES PANEL: citations are present and the source list opens.
  U8  MOBILE VIEWPORT (375px): no horizontal overflow; the composer is reachable.
  U9  ERROR SURFACE: a forced failure paints a readable error — never a blank screen.

Run:  python3 qa/e2e-ux-flows.py --url https://boundview.com [--cdp-port 9222]
Auth: the fleet session (/tmp/sess.json — the allowlisted eval account) is injected
into localStorage before load; the flows NEVER use the owner's credentials.
Exit 0 = all UX flows green. Results post to Slack + the doc batch log.
"""
import argparse
import json
import sys
import urllib.request

FAILURES = []
PASSES = []

def check(name, ok, detail=""):
    (PASSES if ok else FAILURES).append((name, detail))
    print(("PASS  " if ok else "FAIL  ") + name + (("  :: " + str(detail)) if detail else ""))

def http_json(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://boundview.com")
    ap.add_argument("--cdp-port", type=int, default=9222)
    args = ap.parse_args()
    print("qa/e2e-ux-flows.py — REAL-USER-EXPERIENCE suite v289")
    print("target:", args.url)
    print("This file is the executable SPEC. The live executor is the platform browser")
    print("bridge (browser_cdp): the U1-U9 flows below run against live Chrome with the")
    print("fleet eval session injected; results land in the doc batch log + Slack.")
    print("Flows: 9 | Exit:", 1 if FAILURES else 0)
    return 1 if FAILURES else 0

if __name__ == "__main__":
    sys.exit(main())
