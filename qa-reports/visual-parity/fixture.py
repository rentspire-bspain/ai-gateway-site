import json
from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path(__file__).parent
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=["--no-sandbox"])
    page=b.new_page(viewport={"width":1440,"height":1100})
    page.goto("https://ai.spaincos.com",wait_until="domcontentloaded")
    page.wait_for_selector("#landingInput")
    page.evaluate("""() => {
      const node=document.createElement('section');
      node.id='qa-fixture';
      node.style='position:fixed;inset:0;z-index:99999;background:var(--bg);padding:48px;overflow:auto';
      node.innerHTML='<div style="max-width:800px;margin:auto"><p style="color:#b45309;font-weight:600">QA FIXTURE ONLY: manually inserted markup, not a generated answer</p><div class="question-header">write a short markdown report with a heading, a bullet list and a code block</div><div class="answer-content"><h1>Short markdown report</h1><p>This paragraph measures the deployed answer stylesheet. It is not model output.</p><p>A second paragraph exposes spacing between blocks.</p><h2>Findings</h2><ul><li>First item</li><li>Second item with <code>inline code</code></li></ul><pre><code>print("Hello, world!")</code></pre></div></div>';
      document.body.append(node);
    }""")
    page.evaluate("document.fonts.ready")
    data=page.evaluate("""()=>Object.fromEntries(['.question-header','.answer-content','.answer-content p','.answer-content h1','.answer-content h2','.answer-content li','.answer-content pre','.answer-content pre code','.answer-content li code'].map(sel=>{let e=document.querySelector('#qa-fixture '+sel),s=getComputedStyle(e);return [sel,{text:e.textContent,styles:Object.fromEntries(['font-family','font-size','font-weight','line-height','letter-spacing','color','margin-top','margin-bottom','margin-left','margin-right','max-width','width'].map(p=>[p,s.getPropertyValue(p)]))}]}))""")
    (out/"fixture-measurements.json").write_text(json.dumps(data,indent=2))
    page.screenshot(path=str(out/"ai-synthetic-fixture.png"),full_page=True)
    b.close()
