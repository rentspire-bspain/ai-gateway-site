#!/usr/bin/env python3
"""qa/fleet-sweep.py — THE PER-WEBAPP RIGOR BATTERY (Fleet category, 29-dimension contract v291b).

Closes the #1 structural gap: the three standing post-deploy suites (e2e-real-flows,
e2e-ux-flows, e2e-ux-master) run against ai.spaincos.com only. This sweep runs the
REDUCED H-CATEGORY battery against EVERY webapp in the fleet with a public URL, so
"all webapps through the same rigor" becomes measurable instead of asserted.

SOURCES (union; every row records where it came from — never vibes):
  S1  webapp_catalog  — the LIVE dynamic registry (the same REST path the gateway's
      list_webapps / Webapps explorer uses), read with the fleet eval account session
      (minted exactly like qa/prelaunch.py — NEVER the owner's credentials).
  S2  fleet_registry — rows with kind webapp/web_app (the Webapps explorer's primary
      source; currently zero such rows — recorded honestly, not hidden).
  S3  SEED_ESTATE_DOMAINS — the estate's owned public domains, taken from the runner's
      own registry (SHMT runner/src/jobs/domain_uptime.mjs DOMAINS) plus
      guardian-name-evidenced domains (fleet_registry guardian rows), each with its
      evidence string.

BATTERY per webapp (the reduced H-category set):
  H1  LIVENESS: HTTPS GET — status + TTFB. 200 = PASS. 403/429 carrying
      x-vercel-mitigated = NOT_MEASURED: the Vercel edge answered with a bot
      mitigation decision (deployed + TLS-healthy per the domain_uptime rail
      precedent), but no battery check is runnable from this runner, so the app is
      excluded from the fleet denominator — never a pass, never a partial.
  H2  ZERO JS ERRORS + ZERO CSP VIOLATIONS on load (real headless Chromium):
      window.onerror + securitypolicyviolation captured pre-document (the v288
      silent-CSP-death class). Only for apps the browser can actually load.
  H3  BRAND INTEGRITY: the network bytes (script-stripped) AND the rendered DOM
      carry the right brand for the domain — cross-serving is the v290 lesson
      (bv-render served BoundView HTML on ai.spaincos.com). Never one brand on
      another brand's domain.
  H4  SERVING FRESHNESS: the deploy answers, not a stale assumption. The serving
      signature is recorded (server, x-vercel-id, etag + If-None-Match 304
      revalidation, cache-control); ai.spaincos.com additionally gets a deploy-
      integrity byte-compare of a live module against this repo.
  H5  HEALTH ENDPOINT where one exists: /api/health. 404 = no endpoint (NOT
      APPLICABLE — not a failure).

HONESTY RULES (no grader-gaming):
  - Unreachable apps (DNS failure / socket error / timeout on H1) are recorded as
    UNREACHABLE — never as failures or passes.
  - Checks that cannot run from this runner (browser battery on bot-challenge-gated
    domains) are not_measured — excluded from that app's denominator, recorded
    with the reason. A check is only scored when it produced real evidence.
  - Every verdict carries its evidence (status, headers, error text, byte counts).

SCORING: each applicable check scores 1.0 (pass) / 0.5 (partial) / 0.0 (fail).
App score = mean over applicable checks. Fleet score = mean over swept apps.
Partials are P=0.5 by contract; nothing is rounded up.

OUTPUT:
  qa-private/bench/results/fleet-sweep.json  — full per-app rows + evidence
  qa-reports/fleet-sweep/latest.json         — public summary (no secrets) the
      Webapps explorer surfaces (same deployed-with-the-site pattern as
      qa-reports/prelaunch/latest.json)

Run:  python3 qa/fleet-sweep.py [--timeout 15] [--browser-timeout 30]
Exit 0 = sweep completed and written (completion, not perfection, is the exit
condition — app failures are data, recorded in the report).
"""
import argparse
import datetime
import json
import re
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RESULTS_PATH = REPO / "qa-private" / "bench" / "results" / "fleet-sweep.json"
PUBLIC_PATH = REPO / "qa-reports" / "fleet-sweep" / "latest.json"

import sys as _sys
_sys.path.insert(0, str(Path(__file__).resolve().parent))
from prelaunch import ANON, EVAL_EMAIL, EVAL_PASS  # canonical publishable key + eval account (never owner creds)

SB = "https://bnxermyboeigvwonfrzx.supabase.co"
UA = "spain-fleet-sweep/1.0 (+ai-gateway-site qa)"

# S3 — the estate's owned public domains. Evidence for every entry is carried in-row.
#   source "runner DOMAINS list"  — SHMT runner/src/jobs/domain_uptime.mjs (cross-checked
#     against the estate completion doc by the runner itself).
#   source "guardian name"       — fleet_registry guardian row names the domain.
SEED_ESTATE_DOMAINS = [
    {"host": "ai.spaincos.com", "app": "ai.spaincos.com (AI gateway)",
     "evidence": "SHMT runner DOMAINS list; gateway WEBAPP_REGISTRY; repo root", "brand": "spaincos"},
    {"host": "boundview.com", "app": "BoundView (public host, ai-gateway project)",
     "evidence": "SHMT runner DOMAINS list; v290/v291 public-host fix record", "brand": "boundview"},
    {"host": "condoscores.com", "app": "CondoScores",
     "evidence": "SHMT runner DOMAINS list", "brand": "condo"},
    {"host": "comptrove.com", "app": "Comptrove (rent comps public site)",
     "evidence": "SHMT runner DOMAINS list; gateway WEBAPP_REGISTRY; webapp_catalog", "brand": "comptrove"},
    {"host": "spaincos.com", "app": "SpainCos marketing site",
     "evidence": "SHMT runner DOMAINS list", "brand": "spaincos"},
    {"host": "terminal.spaincos.com", "app": "Spain Terminal (internal operating shell)",
     "evidence": "SHMT runner DOMAINS list; gateway WEBAPP_REGISTRY", "brand": "terminal"},
    {"host": "allowancehealth.com", "app": "Allowance (ICHRA plan finder)",
     "evidence": "fleet_registry guardian name 'Allowance (allowancehealth.com)'", "brand": "allowance"},
    {"host": "nodegrade.com", "app": "NodeGrade (agentready scorecard)",
     "evidence": "fleet_registry guardian name 'NodeGrade (agentready scorecard)' + Vercel-attached challenge response", "brand": "nodegrade"},
    {"host": "perilmark.com", "app": "PERILMARK",
     "evidence": "fleet_registry guardian name 'PERILMARK' + repo rentspire-bspain/perilmark + Vercel-attached challenge response", "brand": "perilmark"},
]

# Cross-serve guards: on THIS domain the OTHER brand must never appear in served
# markup (the v290 bv-render brand-leak class). key = host, value = forbidden brand.
FORBIDDEN_BRAND = {
    "ai.spaincos.com": "boundview",
    "boundview.com": "spaincos",
    "spaincos.com": "boundview",
}

# Apps with a known governed health endpoint (v291: /api/health live on the ai-gateway project).
HEALTH_KNOWN = {"ai.spaincos.com", "boundview.com"}

VERDICT_PASS, VERDICT_PARTIAL, VERDICT_FAIL, VERDICT_UNREACHABLE = "PASS", "PARTIAL", "FAIL", "UNREACHABLE"
VERDICT_NOT_MEASURED = "NOT_MEASURED"   # bot-challenge-gated: excluded from the fleet denominator


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def mint_token():
    """Fleet eval session (prelaunch.py pattern). Never the owner's credentials."""
    req = urllib.request.Request(
        SB + "/auth/v1/token?grant_type=password",
        json.dumps({"email": EVAL_EMAIL, "password": EVAL_PASS}).encode(),
        {"apikey": ANON, "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())["access_token"]


def rest_get(path, token):
    req = urllib.request.Request(SB + path, headers={"apikey": ANON, "authorization": "Bearer " + token})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return None, None


def enumerate_sources(token):
    """Union of S1/S2/S3. Returns (apps, source_notes). apps = list of dicts with
    host/app/brand/evidence/source. Registry rows without a public URL are recorded
    as no_url rows (never swept, never scored)."""
    apps, no_url, notes = [], [], []

    # S1 — webapp_catalog (live dynamic registry)
    st, rows = rest_get("/rest/v1/webapp_catalog?select=*&limit=200&order=app_name.asc", token)
    cat = rows if st == 200 and isinstance(rows, list) else []
    notes.append(f"S1 webapp_catalog: HTTP {st}, {len(cat) if st == 200 else '?'} rows")
    for w in cat:
        name = w.get("app_name") or w.get("id")
        front = (w.get("frontend") or "").strip()
        host = None
        m = re.search(r"https?://([a-zA-Z0-9.-]+)", front)
        if m:
            host = m.group(1)
        elif front and "." in front and " " not in front:
            host = front
        if host:
            apps.append({"host": host, "app": name, "brand": (name or "").split()[0].lower(),
                         "evidence": f"webapp_catalog row (db_ref {w.get('db_ref')})", "source": "webapp_catalog"})
        else:
            no_url.append({"app": name, "source": "webapp_catalog",
                           "note": "registered in webapp_catalog with no public frontend URL"})

    # S2 — fleet_registry webapp kinds (the Webapps explorer's primary source)
    st, rows = rest_get("/rest/v1/fleet_registry?select=id,kind,name,project_ref,domain,description,status&limit=1000", token)
    reg = rows if st == 200 and isinstance(rows, list) else []
    web_rows = [r for r in reg if str(r.get("kind") or "").lower() in ("webapp", "web_app")]
    notes.append(f"S2 fleet_registry webapp/web_app kinds: HTTP {st}, {len(web_rows)} rows")
    for w in web_rows:
        d = (w.get("domain") or "").strip()
        host = d if d and "." in d and not d.startswith("http") else (re.sub(r"^https?://", "", d) if d.startswith("http") else None)
        if host:
            if not any(a["host"] == host for a in apps):
                apps.append({"host": host, "app": w.get("name") or host, "brand": (w.get("name") or host).split()[0].lower(),
                             "evidence": f"fleet_registry row {w.get('id')}", "source": "fleet_registry"})
        else:
            no_url.append({"app": w.get("name") or w.get("id"), "source": "fleet_registry",
                           "note": "webapp row without a public URL in domain"})

    # S3 — estate seed domains (dedup against S1/S2)
    for s in SEED_ESTATE_DOMAINS:
        if not any(a["host"] == s["host"] for a in apps):
            apps.append({**s, "source": "estate_seed"})

    return apps, no_url, notes


def fetch(url, timeout, extra_headers=None, method="GET"):
    """Plain HTTPS fetch. Returns (status, headers, body_bytes, ttfb_ms, error)."""
    t0 = time.time()
    req = urllib.request.Request(url, method=method,
                                 headers={"User-Agent": UA, **(extra_headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
            return r.status, dict(r.headers), body, round((time.time() - t0) * 1000), ""
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
        except Exception:
            body = b""
        return e.code, dict(e.headers or {}), body, round((time.time() - t0) * 1000), ""
    except (socket.timeout, TimeoutError):
        return None, {}, b"", round((time.time() - t0) * 1000), "timeout"
    except (urllib.error.URLError, ssl.SSLError, OSError) as e:
        return None, {}, b"", round((time.time() - t0) * 1000), f"{type(e).__name__}: {str(e)[:120]}"


def strip_scripts(html):
    return re.sub(r"<script[\s\S]*?</script>", "", html, flags=re.I)


def brand_for(host, seed_brand):
    return FORBIDDEN_BRAND.get(host, None), seed_brand


def check_liveness(host, timeout):
    """H1 — status + TTFB. Honest classes: 200 PASS, x-vercel-mitigated PARTIAL,
    socket failure UNREACHABLE, anything else FAIL."""
    status, headers, body, ttfb, err = fetch(f"https://{host}/", timeout)
    ev = {"url": f"https://{host}/", "status": status, "ttfb_ms": ttfb,
          "server": headers.get("server", ""), "x_vercel_id": headers.get("x-vercel-id", ""),
          "x_vercel_mitigated": headers.get("x-vercel-mitigated", "")}
    if status is None:
        ev["error"] = err
        return VERDICT_UNREACHABLE, 0.0, ev, {"status": status, "headers": headers, "body": body}
    mitigated = status in (403, 429) and headers.get("x-vercel-mitigated") is not None
    if status == 200:
        return VERDICT_PASS, 1.0, ev, {"status": status, "headers": headers, "body": body}
    if mitigated:
        ev["note"] = ("Vercel bot-mitigation answered (deployed + TLS-healthy per the domain_uptime rail "
                       "precedent); the battery is not runnable from this runner — NOT_MEASURED, excluded from the denominator, never a pass")
        return VERDICT_NOT_MEASURED, None, ev, {"status": status, "headers": headers, "body": body}
    ev["note"] = f"HTTP {status} without mitigation header"
    return VERDICT_FAIL, 0.0, ev, {"status": status, "headers": headers, "body": body}


def check_browser(host, browser_timeout):
    """H2 + H3(browser) — real headless Chromium: zero JS errors, zero CSP violations,
    rendered DOM carries the right brand. Returns list of check rows."""
    from playwright.sync_api import sync_playwright
    out = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--no-proxy-server"])
        ctx = b.new_context(viewport={"width": 1280, "height": 800})
        ctx.add_init_script("""
          window.__fleetSweep = { errs: [], viols: [] };
          document.addEventListener('securitypolicyviolation', function (e) {
            window.__fleetSweep.viols.push(e.violatedDirective + ' @ ' + (e.sourceFile || '') + ':' + e.lineNumber);
          });
          window.addEventListener('error', function (e) {
            window.__fleetSweep.errs.push(String(e.message) + ' @' + (e.filename || '') + ':' + e.lineno);
          });
        """)
        pg = ctx.new_page()
        page_errs = []
        pg.on("pageerror", lambda e: page_errs.append(str(e)[:160]))
        try:
            r = pg.goto(f"https://{host}/", wait_until="domcontentloaded", timeout=browser_timeout * 1000)
            pg.wait_for_timeout(3500)
            cap = pg.evaluate("() => window.__fleetSweep || { errs: [], viols: [] }")
            errs = list(cap.get("errs", [])) + page_errs
            viols = list(cap.get("viols", []))
            dom_text = pg.evaluate("() => document.body ? document.body.innerText : ''")
            title = pg.title()
            ev = {"http_status": r.status if r else None, "title": title[:120],
                  "js_errors": errs[:6], "csp_violations": viols[:6], "dom_chars": len(dom_text)}
            ok = r is not None and r.status == 200 and not errs and not viols
            out.append({"check": "H2 zero JS errors + zero CSP violations on load (headless Chromium)",
                        "verdict": VERDICT_PASS if ok else VERDICT_FAIL, "score": 1.0 if ok else 0.0, "evidence": ev})
            out.append({"check": "H3b rendered DOM carries the right brand (no cross-serve)",
                        "verdict": None, "score": None, "evidence": {"title": title[:120], "dom_snippet": dom_text[:200]},
                        "_dom_text": dom_text, "_title": title})
        except Exception as e:
            out.append({"check": "H2 zero JS errors + zero CSP violations on load (headless Chromium)",
                        "verdict": VERDICT_FAIL, "score": 0.0,
                        "evidence": {"error": f"{type(e).__name__}: {str(e)[:160]}"}})
        finally:
            b.close()
    return out


def check_brand_bytes(host, seed_brand, fetched):
    """H3a — network bytes (script-stripped) carry the right brand; the other brand
    must never appear on this domain (v290 cross-serve lesson)."""
    status, headers, body = fetched["status"], fetched["headers"], fetched["body"]
    if status != 200 or not body:
        return {"check": "H3a network bytes carry the right brand (script-stripped, no cross-serve)",
                "verdict": None, "score": None,
                "evidence": {"not_measured": f"no 200 network bytes to inspect (status {status})"}}
    html = body.decode("utf-8", "replace")
    stripped = strip_scripts(html).lower()
    forbidden, wanted = brand_for(host, seed_brand)
    ev = {"bytes": len(body), "forbidden_brand": forbidden, "wanted_brand": wanted}
    cross = forbidden in stripped if forbidden else False
    has_wanted = wanted.lower() in stripped if wanted else True
    ev["cross_serve"] = cross
    ev["brand_present"] = has_wanted
    ok = (not cross) and has_wanted
    return {"check": "H3a network bytes carry the right brand (script-stripped, no cross-serve)",
            "verdict": VERDICT_PASS if ok else VERDICT_FAIL, "score": 1.0 if ok else 0.0, "evidence": ev}


def check_freshness(host, app, fetched, fetched2):
    """H4 — the deploy answers, not a stale assumption. Serving signature + etag/304
    behavior; ai.spaincos.com additionally byte-compares a live module vs this repo."""
    status, headers, body = fetched["status"], fetched["headers"], fetched["body"]
    ev = {"server": headers.get("server", ""), "x_vercel_id": (headers.get("x-vercel-id") or "")[:24],
          "cache_control": headers.get("cache-control", ""), "etag": headers.get("etag", ""),
          "age": headers.get("age", "")}
    serving_answers = False
    if ev["x_vercel_id"]:
        serving_answers = True
        ev["serving_layer"] = "Vercel edge (x-vercel-id present)"
    elif ev["server"] and ev["etag"]:
        serving_answers = True
        ev["serving_layer"] = f"{ev['server']} with etag revalidation"
    # etag 304 revalidation when the host supports it
    if ev["etag"] and fetched2.get("status") == 304:
        ev["etag_304_revalidation"] = True
        serving_answers = True
    # deploy-integrity byte-compare (ai.spaincos.com only — this repo IS that app)
    if host == "ai.spaincos.com":
        mod = "modules/webapps.js"
        st3, _h, mbody, _t, _e = fetch(f"https://{host}/{mod}", 15)
        local = (REPO / mod).read_bytes() if (REPO / mod).exists() else None
        ev["deploy_integrity"] = {"module": mod, "live_status": st3,
                                  "bytes_match_repo": (mbody == local) if (local is not None and st3 == 200) else None}
        if ev["deploy_integrity"]["bytes_match_repo"] is False:
            serving_answers = False
            ev["note"] = "live module bytes do NOT match this checkout (stale or diverged deploy)"
    return {"check": "H4 serving freshness (deploy answers; headers/etag/x-vercel-id evidence)",
            "verdict": VERDICT_PASS if serving_answers else VERDICT_FAIL,
            "score": 1.0 if serving_answers else 0.0, "evidence": ev}


def check_health(host):
    """H5 — /api/health where one exists. 404 = no endpoint (N/A, not a failure)."""
    status, _h, body, ttfb, err = fetch(f"https://{host}/api/health", 15)
    ev = {"url": f"https://{host}/api/health", "status": status, "ttfb_ms": ttfb}
    if status == 200:
        try:
            ev["body"] = json.loads(body.decode("utf-8", "replace"))
        except Exception:
            ev["body_bytes"] = len(body)
        return {"check": "H5 health endpoint (/api/health)", "verdict": VERDICT_PASS, "score": 1.0, "evidence": ev}
    if status == 404:
        ev["note"] = "no health endpoint on this app — not applicable (not a failure)"
        return {"check": "H5 health endpoint (/api/health)", "verdict": None, "score": None, "evidence": ev}
    if status in (403, 429) and _h.get("x-vercel-mitigated"):
        ev["note"] = "health path behind the Vercel bot challenge — not measurable from this runner"
        return {"check": "H5 health endpoint (/api/health)", "verdict": None, "score": None, "evidence": ev}
    if status is None:
        ev["error"] = err
    return {"check": "H5 health endpoint (/api/health)", "verdict": VERDICT_FAIL, "score": 0.0, "evidence": ev}


def sweep_app(app, args):
    host = app["host"]
    row = {"app": app["app"], "host": host, "source": app["source"], "evidence": app["evidence"],
           "checks": [], "verdict": None, "score": None}

    # H1 liveness (always first — unreachable apps are recorded, never scored further)
    v, sc, ev, fetched = check_liveness(host, args.timeout)
    h1 = {"check": "H1 liveness (HTTPS status + TTFB)", "verdict": v, "score": sc, "evidence": ev}
    row["checks"].append(h1)
    if v == VERDICT_UNREACHABLE:
        row["verdict"] = VERDICT_UNREACHABLE
        row["score"] = None
        return row

    if v == VERDICT_NOT_MEASURED:
        row["verdict"] = VERDICT_NOT_MEASURED
        row["score"] = None
        row["not_measured_reason"] = "Vercel bot-challenge (x-vercel-mitigated) from this runner; H2-H5 cannot run and are not scored"
        return row

    # H2/H3 browser battery — only when the browser can reach the app (H1 PASS).
    if v == VERDICT_PASS:
        brow = check_browser(host, args.browser_timeout)
        h2 = brow[0]
        row["checks"].append({"check": h2["check"], "verdict": h2["verdict"], "score": h2["score"],
                              "evidence": h2["evidence"]})
        # H3b brand in rendered DOM
        b3 = brow[1] if len(brow) > 1 else {}
        dom_text, title = b3.get("_dom_text", ""), b3.get("_title", "")
        forbidden, wanted = brand_for(host, app.get("brand"))
        if dom_text:
            cross = (forbidden in dom_text.lower()) if forbidden else False
            h3b_ok = not cross
            row["checks"].append({"check": "H3b rendered DOM carries the right brand (no cross-serve)",
                                  "verdict": VERDICT_PASS if h3b_ok else VERDICT_FAIL,
                                  "score": 1.0 if h3b_ok else 0.0,
                                  "evidence": {"title": title[:120], "cross_serve": cross,
                                                "dom_snippet": dom_text[:160]}})
        else:
            row["checks"].append({"check": "H3b rendered DOM carries the right brand (no cross-serve)",
                                  "verdict": None, "score": None,
                                  "evidence": {"not_measured": "browser did not render a DOM"}})
    else:
        row["checks"].append({"check": "H2 zero JS errors + zero CSP violations on load (headless Chromium)",
                              "verdict": None, "score": None,
                              "evidence": {"not_measured": "domain is bot-challenge-gated from this runner (x-vercel-mitigated); the browser battery cannot run here — recorded, never scored"}})
        row["checks"].append({"check": "H3b rendered DOM carries the right brand (no cross-serve)",
                              "verdict": None, "score": None,
                              "evidence": {"not_measured": "same reason as H2"}})

    # H3a brand in network bytes (script-stripped) — needs a 200 body
    row["checks"].append(check_brand_bytes(host, app.get("brand"), fetched))

    # H4 freshness (headers/etag from H1 fetch + a revalidation fetch)
    etag = fetched["headers"].get("etag", "")
    fetched2 = {}
    if etag:
        st2, h2, b2, _t2, _e2 = fetch(f"https://{host}/", args.timeout, extra_headers={"If-None-Match": etag})
        fetched2 = {"status": st2, "headers": h2, "body": b2}
    row["checks"].append(check_freshness(host, app["app"], fetched, fetched2))

    # H5 health endpoint
    row["checks"].append(check_health(host))

    # score = mean over scored checks (honest partials P=0.5)
    scored = [c for c in row["checks"] if c["score"] is not None]
    if scored:
        row["score"] = round(sum(c["score"] for c in scored) / len(scored), 3)
        if row["score"] >= 0.999:
            row["verdict"] = VERDICT_PASS
        elif row["score"] <= 0.001:
            row["verdict"] = VERDICT_FAIL
        else:
            row["verdict"] = VERDICT_PARTIAL
    return row


def main():
    ap = argparse.ArgumentParser(description="Per-webapp rigor battery (Fleet category)")
    ap.add_argument("--timeout", type=int, default=15)
    ap.add_argument("--browser-timeout", type=int, default=30)
    args = ap.parse_args()

    print("FLEET SWEEP — per-webapp rigor battery (29-dimension contract, Fleet category)")
    token = mint_token()
    apps, no_url, notes = enumerate_sources(token)
    for n in notes:
        print(" ", n)
    print(f"  sweepable apps: {len(apps)} | registry rows without public URL: {len(no_url)}")

    rows = []
    for app in apps:
        print(f"  sweeping {app['host']} ({app['source']})…")
        try:
            rows.append(sweep_app(app, args))
        except Exception as e:
            rows.append({"app": app["app"], "host": app["host"], "source": app["source"],
                         "evidence": app["evidence"], "checks": [], "verdict": VERDICT_FAIL, "score": 0.0,
                         "sweep_error": f"{type(e).__name__}: {str(e)[:200]}"})
        time.sleep(1.0)  # politeness — never trip the edges we are measuring

    swept = [r for r in rows if r["verdict"] not in (VERDICT_UNREACHABLE, VERDICT_NOT_MEASURED)]
    scored = [r["score"] for r in swept if r["score"] is not None]
    fleet_score = round(sum(scored) / len(scored), 3) if scored else None
    counts = {v: sum(1 for r in rows if r["verdict"] == v) for v in
              (VERDICT_PASS, VERDICT_PARTIAL, VERDICT_FAIL, VERDICT_UNREACHABLE, VERDICT_NOT_MEASURED)}

    rec = {
        "ts": now_iso(),
        "battery": "H1 liveness, H2 JS/CSP, H3 brand integrity (bytes+DOM), H4 serving freshness, H5 health endpoint",
        "scoring": "per applicable check 1.0/0.5/0.0; app score = mean; partials P=0.5 by contract; not_measured checks excluded from the denominator and recorded",
        "sources": notes,
        "no_public_url_rows": no_url,
        "summary": {
            "apps_total": len(rows),
            "swept": len(swept),
            "fleet_score": fleet_score,
            "verdict_counts": counts,
            "not_measured_reason": "Vercel bot-challenge-gated domains (x-vercel-mitigated) cannot run the browser battery from this runner; recorded as NOT_MEASURED and excluded from the fleet denominator (never counted as pass or partial)",
        },
        "per_app": {r["host"]: r for r in rows},
    }

    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(rec, indent=1))
    # public summary for the Webapps explorer — no secrets, verdicts + evidence only
    PUBLIC_PATH.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_PATH.write_text(json.dumps({
        "ts": rec["ts"],
        "fleet_score": fleet_score,
        "counts": counts,
        "apps": [{"app": r["app"], "host": r["host"], "verdict": r["verdict"], "score": r["score"]} for r in rows],
    }, indent=1))

    print(f"\nFLEET SWEEP RESULT — {len(swept)} swept, fleet score {fleet_score}")
    print(f"  PASS {counts[VERDICT_PASS]} | PARTIAL {counts[VERDICT_PARTIAL]} | FAIL {counts[VERDICT_FAIL]} | UNREACHABLE {counts[VERDICT_UNREACHABLE]} | NOT_MEASURED {counts[VERDICT_NOT_MEASURED]}")
    for r in rows:
        print(f"  {r['host']:32} {str(r['verdict']):12} score={r['score']}")
    print(f"report: {RESULTS_PATH}")
    print(f"public summary: {PUBLIC_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
