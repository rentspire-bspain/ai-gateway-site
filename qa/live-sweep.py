#!/usr/bin/env python3
"""v354 hourly live sweep — production health, no browser needed (pure HTTP).

Checks the deployed estate every run so drift and outages are caught within the
hour, never silently. Exit 0 = all green. Any failure prints SWEEP-FAIL lines and
exits 1 (the workflow files a regression issue that the closure loop picks up).

Run: python3 qa/live-sweep.py
"""
import json, pathlib, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent

BV = "https://boundview.com"
AG = "https://ai.spaincos.com"

def get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "qa-live-sweep/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""

def check(name, ok, detail=""):
    print(("PASS " if ok else "SWEEP-FAIL ") + name + (" — " + detail if detail else ""))
    return ok

def main():
    fails = 0

    st, body = get(BV + "/api/health")
    fails += not check("bv health endpoint 200+ok", st == 200 and b'"ok":true' in body)

    st, body = get(BV + "/status")
    fails += not check("bv status page 200", st == 200)

    st, body = get(BV + "/")
    b = body.decode("utf-8", "replace")
    fails += not check("bv title branded", "<title>BoundView" in b)
    fails += not check("bv static description", 'name="description" content="BoundView' in b)
    fails += not check("bv canonical", '<link rel="canonical" href="https://boundview.com/">' in b)
    fails += not check("bv json-ld present", 'application/ld+json" data-bv="1"' in b)
    fails += not check("bv no spaincos leak in raw html", "spaincos" not in b.replace("you@spaincos.com", "") if False else "spaincos" not in b)

    st, body = get(AG + "/")
    a = body.decode("utf-8", "replace")
    fails += not check("ag static noindex", '<meta name="robots" content="noindex, nofollow">' in a)

    st, body = get(BV + "/robots.txt")
    fails += not check("robots.txt sitemap ref", st == 200 and b"Sitemap: https://boundview.com/sitemap.xml" in body)

    st, body = get(BV + "/sitemap.xml")
    fails += not check("sitemap 200", st == 200)

    for pg in ("features", "refund", "compare"):
        st, body = get(BV + "/" + pg)
        fails += not check(f"bv /{pg} page 200 + branded", st == 200 and b"BoundView" in body)

    # v359 (U-SEO-08): crawler-visible marketing copy on the BV landing without JS.
    st, body = get(BV + "/")
    b = body.decode("utf-8", "replace")
    fails += not check("bv landing noscript prerender", 'id="seo-prerender"' in b)

    # v358 (AG-01): the AG workspace root is a static auth interstitial (noindex,
    # no workspace shell); ?ws=1 still reaches the workspace shell.
    st, body = get(AG + "/")
    a = body.decode("utf-8", "replace")
    fails += not check("ag auth interstitial", st == 200 and "Private workspace" in a and "spa-restore" not in a)
    st, body = get(AG + "/?ws=1")
    a = body.decode("utf-8", "replace")
    fails += not check("ag ws bypass reaches shell", st == 200 and "spa-restore" in a)

    # pricing.json is only checked when the repo itself ships it (the canonical-source
    # feature lands via its own PR; the sweep must not file regressions for pending work).
    if (ROOT / "pricing.json").exists():
        st, body = get(BV + "/pricing.json")
        ok = st == 200
        if ok:
            try:
                d = json.loads(body)
                ok = set(p["id"] for p in d["plans"]) == {"core", "max", "team"}
            except Exception:
                ok = False
        fails += not check("pricing.json canonical source", ok)
    else:
        print("SKIP pricing.json (not shipped by this checkout yet)")

    print(f"live-sweep: {'ALL GREEN' if fails == 0 else str(fails) + ' FAILURES'}")
    return 0 if fails == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
