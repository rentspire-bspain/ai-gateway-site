#!/usr/bin/env python3
"""
qa/route-classification.py — deterministic unknown-route classification (both hosts).
Owner/coordinator directive 2026-11-22: classify unknown-route behavior; gate on
HTTP status, robots disallow of /t/, and browser recovery (no dead ends).
Usage: python3 qa/route-classification.py (exit 1 on regression)
"""
import json
from playwright.sync_api import sync_playwright
HOSTS=["https://ai.spaincos.com","https://boundview.com"]
CASES={
 "unknown_public":"/definitely-not-a-page-xyz",
 "unknown_nested":"/a/b/not-a-thing",
 "spa_thread":"/t/nonexistent-slug-zzz",
 "private_qa":"/qa/secret",
 "private_sql":"/sql/dump",
}
out={}
with sync_playwright() as pw:
    b=pw.chromium.launch(args=["--no-sandbox"])
    pg=b.new_page()
    for h in HOSTS:
        R=out.setdefault(h,{})
        # robots
        try: R["robots"]=pg.request.get(h+"/robots.txt",timeout=15000).__class__ and (pg.request.get(h+"/robots.txt",timeout=15000).status, pg.request.get(h+"/robots.txt",timeout=15000).text()[:200])
        except Exception as e: R["robots"]=str(e)[:60]
        for name,path in CASES.items():
            e=R.setdefault(name,{})
            try:
                r=pg.request.get(h+path,timeout=15000)
                hdr=dict(r.headers)
                e["status"]=r.status
                e["x_robots"]=hdr.get("x-robots-tag")
                e["content_type"]=hdr.get("content-type")
                # browser behavior
                resp=pg.goto(h+path,wait_until="domcontentloaded",timeout=20000)
                e["browser_status"]=resp.status if resp else None
                e["title"]=pg.title()[:60]
                e["canonical"]=pg.eval_on_selector_all("link[rel=canonical]","e=>e.map(x=>x.href)")
                e["robots_meta"]=pg.eval_on_selector_all("meta[name=robots]","e=>e.map(x=>x.content)")
                e["body_sample"]=pg.evaluate("document.body.innerText.slice(0,160).replace(/\\s+/g,' ')")
                e["recovery"]=pg.evaluate("!!(document.querySelector('textarea,input[type=text],input[type=email],[contenteditable]'))")
            except Exception as ex:
                e["error"]=str(ex)[:100]
    b.close()

fails=[]
for h,R in out.items():
    if R["unknown_public"]["status"]!=404: fails.append((h,"unknown_public not 404",R["unknown_public"]["status"]))
    if R["unknown_nested"]["status"]!=404: fails.append((h,"unknown_nested not 404",R["unknown_nested"]["status"]))
    for p in ("private_qa","private_sql"):
        if R[p]["status"]!=404: fails.append((h,p+" not 404",R[p]["status"]))
    if R["spa_thread"]["status"]!=200: fails.append((h,"spa_thread not 200",R["spa_thread"]["status"]))
    if not R["spa_thread"].get("recovery"): fails.append((h,"spa_thread dead end",""))
    if "Disallow: /t/" not in str(R["robots"]): fails.append((h,"robots missing /t/ disallow",""))
print(json.dumps(out,indent=1))
json.dump(out,open("qa-private/bench/results/route-classification.json","w"),indent=1)
if fails:
    print("REGRESSION:",fails); sys.exit(1)
print("ROUTE CLASSIFICATION: PASS (unknown+private 404, SPA deep links 200 with recovery, /t/ disallowed)")
