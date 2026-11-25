#!/usr/bin/env python3
"""v350 BRAND-LEAK GATE (owner report 2026-11-24: Spain names on boundview.com/status).

Loads the live BoundView public pages in a real browser (logged out AND logged in as
the QA account) and fails if ANY rendered DOM text, attribute, image src, href, head
link, or the document title matches /spain/i. This is the regression gate for the
brand-separation contract: zero cross-brand strings on BoundView, ever.

Exit 0 = clean. Exit 1 = leaks found (printed)."""
import json, re, sys, urllib.request

PAGES = ["/", "/status", "/help", "/terms", "/privacy", "/pricing", "/docs"]

def main():
    from playwright.sync_api import sync_playwright
    src = open(__file__.replace("bv-brand-leak.py", "prelaunch.py")).read()
    anon = eval(re.search(r"ANON\s*=\s*((?:\([^\n]*\n)+[^\n]*\))", src).group(1))
    req = urllib.request.Request("https://bnxermyboeigvwonfrzx.supabase.co/auth/v1/token?grant_type=password",
        data=json.dumps({"email": "eval-bot@spaincos.com", "password": "EvalTest2026!"}).encode(),
        headers={"apikey": anon, "content-type": "application/json"})
    tok = json.loads(urllib.request.urlopen(req, timeout=20).read())["access_token"]

    SWEEP = """() => {
      const out = [];
      document.querySelectorAll('*').forEach(el => {
        const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join(' ');
        if (/spain/i.test(txt)) out.push('TEXT: ' + txt.trim().slice(0, 80));
        for (const a of (el.attributes || [])) if (/spain/i.test(a.value)) out.push('ATTR ' + a.name + ': ' + a.value.slice(0, 80));
      });
      if (/spain/i.test(document.title)) out.push('TITLE: ' + document.title);
      [...(document.head ? document.head.querySelectorAll('link') : [])].forEach(l => {
        const h = l.getAttribute('href') || ''; if (/spain/i.test(h)) out.push('HEADLINK: ' + h);
      });
      return out.slice(0, 20);
    }"""
    leaks_total = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        for path in PAGES:
            try:
                page.goto("https://boundview.com" + path, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(2500)
                leaks = page.evaluate(SWEEP)
                if leaks:
                    leaks_total += [(path, l) for l in leaks]
            except Exception as e:
                leaks_total.append((path, "PAGE LOAD FAILED: " + str(e)[:80]))
        # logged-in app shell
        try:
            page.evaluate("""(t) => localStorage.setItem('sb-bnxermyboeigvwonfrzx-auth-token', JSON.stringify({access_token: t, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: 'x', user: {}}))""", tok)
            page.goto("https://boundview.com/", wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(4000)
            page.keyboard.press("Escape")
            page.wait_for_timeout(1200)
            leaks = page.evaluate(SWEEP)
            if leaks:
                leaks_total += [("(authed)", l) for l in leaks]
        except Exception as e:
            leaks_total.append(("(authed)", "PAGE LOAD FAILED: " + str(e)[:80]))
        b.close()
    if leaks_total:
        for pth, l in leaks_total:
            print("LEAK", pth, l)
        sys.exit(1)
    print("bv-brand-leak: 0 leaks across", len(PAGES) + 1, "surfaces")

if __name__ == "__main__":
    main()
