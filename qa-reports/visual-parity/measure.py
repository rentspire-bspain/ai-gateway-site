import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent
QUERIES = ["What is the capital of France? One sentence.", "write a short markdown report with a heading, a bullet list and a code block"]
PROPS = ["font-family", "font-size", "font-weight", "line-height", "letter-spacing", "color", "margin-top", "margin-bottom", "margin-left", "margin-right", "max-width", "width"]
JS = """(args) => {let e=document.querySelector(args.selector);if(!e)return null;let s=getComputedStyle(e);return {selector:args.selector,text:e.textContent.slice(0,600),rect:{width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height},styles:Object.fromEntries(args.props.map(p=>[p,s.getPropertyValue(p)])),ancestors:[e.parentElement,e.parentElement?.parentElement,e.parentElement?.parentElement?.parentElement].filter(Boolean).map(a=>({tag:a.tagName,cls:a.className,width:a.getBoundingClientRect().width,maxWidth:getComputedStyle(a).maxWidth}))}}"""

def measure(page, selector):
    return page.evaluate(JS, {"selector":selector, "props":PROPS})

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
    data={"viewport":{"width":1440,"height":1100},"deviceScaleFactor":1,"queries":QUERIES,"perplexity":[],"ai":[]}
    context=browser.new_context(viewport=data["viewport"],device_scale_factor=1,color_scheme="light")
    page=context.new_page()
    for url in ["https://www.perplexity.ai","https://m.perplexity.ai"]:
        record={"url":url}
        try:
            page.goto(url,wait_until="domcontentloaded",timeout=30000)
            page.wait_for_selector("body",timeout=10000)
            try:
                page.wait_for_selector('textarea,[contenteditable="true"],input[placeholder]',timeout=15000)
            except Exception:
                pass
            record["title"]=page.title()
            record["visibleText"]=page.locator("body").inner_text()[:3000]
            record["body"]=measure(page,"body")
            record["h1"]=measure(page,"h1")
            record["p"]=measure(page,"p")
            record["inputs"]=page.locator('textarea,[contenteditable="true"],input[placeholder]').count()
            page.screenshot(path=str(OUT/("perplexity-answer.png" if "www." in url else "perplexity-mobile-host.png")),full_page=True)
        except Exception as e:
            record["error"]=str(e)
        data["perplexity"].append(record)
        print("PERPLEXITY",json.dumps(record),flush=True)
        if record.get("inputs"):
            break
    for i,query in enumerate(QUERIES):
        page=context.new_page()
        record={"query":query,"url":"https://ai.spaincos.com"}
        page.goto(record["url"],wait_until="domcontentloaded",timeout=30000)
        page.wait_for_selector("#landingInput",timeout=15000)
        page.locator("#landingInput").fill(query)
        page.locator("#landingInput").press("Enter")
        try:
            page.wait_for_selector(".answer-content p",timeout=40000)
            if i:
                page.wait_for_selector(".answer-content pre code",timeout=40000)
            page.evaluate("document.fonts.ready")
            # Wait for response controls to be enabled, if available; no networkidle.
            try:
                page.wait_for_function("!document.querySelector('.answer-content .streaming-cursor')",timeout=10000)
            except Exception:
                pass
        except Exception as e:
            record["error"]=str(e)
        record["measurements"]={k:measure(page,s) for k,s in {"question":".question-header","paragraph":".answer-content p","h1":".answer-content h1","h2":".answer-content h2","li":".answer-content li","code":".answer-content pre code","answer":".answer-content"}.items()}
        record["visibleText"]=page.locator("body").inner_text()[-6000:]
        record["fonts"]=page.evaluate("({sans:document.fonts.check('16px pplxSans'),serif:document.fonts.check('16px pplxSerif'),loaded:[...document.fonts].map(f=>({family:f.family,status:f.status}))})")
        page.screenshot(path=str(OUT/("ai-answer.png" if i==0 else "ai-markdown.png")),full_page=True)
        data["ai"].append(record)
        print("AI",json.dumps(record),flush=True)
    (OUT/"measurements.json").write_text(json.dumps(data,indent=2))
    browser.close()
