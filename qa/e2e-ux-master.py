#!/usr/bin/env python3
"""
qa/e2e-ux-master.py — v290 THE USER-EXPERIENCE MASTER BENCHMARK (owner directive
2026-11-21: "CREATE A FULL AND COMPLETE USER EXPERIENCE MASTER AND GRANULAR
BENCHMARK, CHECKLIST, SCORING, ETC — BE COMPLETELY EXHAUSTIVE AND VIGILANT ON THE
ENTIRE PREMORTEM OF USER EXPERIENCE AND DIAGNOSE, FIX, REPAIR, CREATE EVERYTHING
SO THAT THE USER EXPERIENCE IS FLAWLESS")

This is THE executable spec + scoring rubric for the UX master benchmark. The live
executor is the platform browser bridge (browser_cdp / browser_eval_js) driving a
real Chrome with the fleet eval session injected (never the owner's credentials).
Results land in the doc batch log + Slack; the master score gates deploys.

SCORING MODEL
-------------
Every check is PASS (1.0), PARTIAL (0.5 — the flow works but with a UX defect that
does not block the user), or FAIL (0.0 — broken, silent, or a dead end).
Category score = mean of its checks. MASTER SCORE = weighted mean of categories.
Gate: >= 90.0 GREEN (ship), 80-89.9 YELLOW (fix before next feature), < 80 RED
(block deploy). Scores are NEVER hand-edited; the executor writes them to
qa-private/bench/results/ux-master.json and the doc quotes that file.

THE CHECKS (8 categories, 46 checks — each exists because a real user can hit it)
=============================================================================

A. AUTH & SESSION (weight 15) — the v288 login-bug class: silent failure is the worst failure
  A1  Login form renders: fields visible, focusable, labeled (placeholder or aria-label)
  A2  Wrong password paints a READABLE error (never silent, never blank)
  A3  Unlisted email paints the invite-only message (auth boundary honest)
  A4  Correct login loads the app (eval account)
  A5  Session restore: reload with stored session skips the login wall
  A6  Logout clears the session from storage and returns to the gate
  A7  Expired session: stale token does not brick the app (refresh or clean re-login)

B. CORE ANSWER FLOW (weight 25) — THE product; the engine benchmarks measure this indirectly
  B1  Ask a question renders an answer in the thread (the core flow, end to end)
  B2  Inline citations [[N]] present in the answer body
  B3  Sources section present and enumerated
  B4  Markdown rendered: bold/lists render (not raw ** text)
  B5  Code blocks render with visual treatment (not raw backticks)
  B6  LaTeX renders (math rows: \( \) / \\( \\) not shown literally)
  B7  Time-to-answer < 25s for a simple factual question (user patience wall)
  B8  Follow-up in the same thread renders (multi-turn context)
  B9  New-thread button starts a clean thread (composer cleared)
  B10 Empty state: a fresh account sees guidance, not a blank void
  B11 Answer streaming: content appears progressively (no 20s blank then dump)
  B12 FINAL ANSWER line visible on math rows (v289d contract: user sees it too)

C. THREAD MANAGEMENT (weight 10) — "where did my work go" is the #1 AI-app rage class
  C1  Asked thread appears in the sidebar immediately
  C2  Thread survives reload (client + server persistence)
  C3  Deep link /t/<slug> restores the thread in a fresh tab
  C4  Thread title is meaningful (slug from the question, not "Untitled")
  C5  Old threads loadable (click an old thread -> its Q&A renders)
  C6  History awareness: history-flavored question searches my_context (v287 rule)

D. NAVIGATION & SHELL (weight 10) — every dead link is a broken promise
  D1  Sidebar nav items all resolve (click each: no dead ends, no 404s)
  D2  Browser back/forward works through thread views
  D3  Page title updates per view (tab history is usable)
  D4  Favicon + PWA manifest serve (installed-app experience)
  D5  Keyboard: Enter submits the question; Shift+Enter newlines (if composer)

E. RESPONSIVE & VISUAL (weight 10) — the owner screenshots every pixel
  E1  Mobile 375px: no horizontal overflow, composer reachable, sidebar drawer works
  E2  Tablet 768px: layout adapts (no tiny-desktop look)
  E3  Desktop 1440px: layout fills sensibly (no stretched 400px column)
  E4  No clipped/overlapping text at any viewport (visual inspection)
  E5  Focus states visible on interactive elements (keyboard users see where they are)
  E6  Contrast: body text readable (not low-contrast gray-on-gray)

F. PERFORMANCE & HEALTH (weight 10) — fast is a feature
  F1  First contentful paint < 2.5s on reload (warm cache)
  F2  Zero JS runtime errors on load + during a full ask flow
  F3  Zero CSP violations (the v288 class)
  F4  Service worker registered; cache version advances (no stale shells)
  F5  Main bundle reasonable (< 400KB gz, no megabyte JS)

G. ERROR & EDGE SURFACES (weight 10) — flawed networks are the norm
  G1  Gateway unreachable -> readable error with retry, never a blank screen
  G2  Invalid deep link (/t/garbage-uuid) -> graceful not-found, app still usable
  G3  Rapid double-submit does not duplicate threads/messages
  G4  Very long input (10k chars) does not break the composer or the gateway
  G5  Empty question submit is prevented (no blank thread created)

H. CROSS-BROWSER & INTEGRITY (weight 10) — the owner uses Chrome AND Comet
  H1  Chrome (sandbox): full flow green
  H2  No brand leaks on boundview.com (the v283/v288 contract)
  H3  Script bytes identical network-vs-DOM (no mid-parse mutation)
  H4  localStorage/sessionStorage hygiene: no tokens in URLs; keys documented
  H5  OAuth buttons (Slack/Dropbox) present and route correctly; unregistered
      providers (Google/Outlook/GitHub) show honest states, not dead buttons

Run:  python3 qa/e2e-ux-master.py --url https://ai.spaincos.com  (prints the rubric;
      the live executor fills qa-private/bench/results/ux-master.json)
Exit: 0 if master score >= 90.
"""
import argparse
import json
import sys

CATEGORIES = [
    ("A", "AUTH & SESSION", 15, 7),
    ("B", "CORE ANSWER FLOW", 25, 12),
    ("C", "THREAD MANAGEMENT", 10, 6),
    ("D", "NAVIGATION & SHELL", 10, 5),
    ("E", "RESPONSIVE & VISUAL", 10, 6),
    ("F", "PERFORMANCE & HEALTH", 10, 5),
    ("G", "ERROR & EDGE SURFACES", 10, 5),
    ("H", "CROSS-BROWSER & INTEGRITY", 10, 5),
]

def score(results):
    """results: {"A1": 1.0|"P"|0.0, ...} — 1.0 pass, 0.5 partial, 0.0 fail."""
    total_w, total = 0.0, 0.0
    per_cat = {}
    for cid, cname, w, n in CATEGORIES:
        vals = []
        for i in range(1, n + 1):
            key = f"{cid}{i}"
            v = results.get(key)
            if v is None:
                continue
            vals.append(0.5 if v == "P" else float(v))
        cat = sum(vals) / len(vals) if vals else 0.0
        per_cat[cid] = round(cat * 100, 1)
        total += cat * w
        total_w += w
    master = round(total / total_w * 100, 1) if total_w else 0.0
    return master, per_cat

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://ai.spaincos.com")
    ap.add_argument("--results", default="qa-private/bench/results/ux-master.json")
    args = ap.parse_args()
    print("qa/e2e-ux-master.py — THE USER-EXPERIENCE MASTER BENCHMARK v290")
    print("target:", args.url)
    n_checks = sum(n for *_, n in CATEGORIES)
    n_weight = sum(w for *_, w, _ in [(c[0], c[1], c[2], c[3]) for c in CATEGORIES])
    print(f"categories: {len(CATEGORIES)} | checks: {n_checks} | weights sum: {n_weight}")
    for cid, cname, w, n in CATEGORIES:
        print(f"  {cid}. {cname} (w={w}, {n} checks)")
    try:
        with open(args.results) as f:
            results = json.load(f)
        master, per_cat = score(results)
        print("recorded results:", json.dumps(per_cat))
        print(f"MASTER SCORE: {master}")
        print("gate:", "GREEN (ship)" if master >= 90 else "YELLOW (fix first)" if master >= 80 else "RED (block deploy)")
        return 0 if master >= 90 else 1
    except FileNotFoundError:
        print("no recorded results yet — run the live executor to fill", args.results)
        return 2

if __name__ == "__main__":
    sys.exit(main())
