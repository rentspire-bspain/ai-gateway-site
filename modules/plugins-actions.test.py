import json
from playwright.sync_api import sync_playwright
R=lambda f:open('modules/'+f).read()
css=R('skills.css')+R('skills-actions.css')+R('plugins.css')
manifest=lambda tools:{"skills":[{"name":"Polite follow-up","icon":"↩️","prompt":"Write follow-up:\n"}],"tools":tools}
reg=[{"id":"fp-inbox","name":"Inbox Assistant","description":"Draft and send email.","icon":"✉️","version":"1.0.0","author":"Spain Companies","first_party":True,"required_connectors":["google"],"manifest":manifest([{"name":"send_email","action":"send_email","description":"x"}])},
     {"id":"fp-res","name":"Research Pack","description":"Prompts","icon":"🔬","version":"1.0.0","author":"Spain Companies","first_party":True,"required_connectors":[],"manifest":manifest([])}]
pre="""
:root{--bg:#15171B;--bg-elevated:#1C1E23;--bg-surface:#1C1E23;--bg-input:#1C1E23;--border:#2a2d33;--text:#eee;--text-muted:#9aa;--accent:#3D9595;--accent-hover:#56ABAB;--accent-light:rgba(61,149,149,.14);--radius:12px;--radius-sm:8px;--font-sans:sans-serif}body{background:var(--bg);color:var(--text)}
"""
html="<style>"+pre+css+"</style><button id=deepResearchToggle>R</button><input id=landingInput><div id=followupWrapper style='display:none'><input id=followupInput></div><script>"+f"""
var REG={json.dumps(reg)};var INS=[];window.exec=[];window.NOTREADY=false;
var q=function(t){{var o={{}};var c={{select:()=>c,eq:()=>c,order:()=>c,upsert:(r)=>{{INS.push(r.plugin_id);return Promise.resolve({{}})}},update:()=>c,delete:()=>c,then:(f,g)=>Promise.resolve({{data:t==='plugins'?REG:INS.map(i=>({{plugin_id:i,enabled:true}})),error:null}}).then(f,g)}};return c}};
var sb={{from:q,auth:{{getSession:()=>Promise.resolve({{data:{{session:{{access_token:'t',user:{{id:'u1'}}}}}}}})}}}};
var GATEWAY='https://x/functions/v1';
window.fetch=function(u,o){{var b=JSON.parse(o.body);exec.push(b.action);
 if(b.action==='preview')return Promise.resolve(new Response(JSON.stringify({{kind:b.kind,preview:{{title:'Send email',fields:{{To:b.payload.to,Subject:b.payload.subject,Body:b.payload.body}},warning:'This email will be sent immediately on approval and cannot be unsent.'}},payload:b.payload,ready:!window.NOTREADY,missing:['OAuth scope https://www.googleapis.com/auth/gmail.send'],detail:'no Google connection',approval_token:'tok'}}),{{status:200}}));
 return Promise.resolve(new Response(JSON.stringify({{executed:true,id:'G1'}}),{{status:200}}));}};
"""+"</script><script>"+R('skills.js')+"</script><script>"+R('skills-actions.js')+"</script><script>"+R('plugins.js')+"</script>"
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1000,'height':760}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_content(html)
    pg.evaluate("PluginsUI.open()"); pg.wait_for_selector('.pl-card')
    print('cards',pg.locator('.pl-card').count())
    pg.locator('.pl-card').first.locator('[data-a=install]').click(); pg.wait_for_selector('[data-a=toggle]')
    print('enabled btn',pg.locator('[data-a=toggle]').first.inner_text(), 'tools btn',pg.locator('[data-a=try]').count())
    pg.screenshot(path='/tmp/p.png')
    pg.locator('[data-a=toggle]').first.click(); pg.wait_for_timeout(100); print('after toggle',pg.locator('[data-a=toggle]').first.inner_text(),pg.evaluate("SkillsPluginSource().length"))
    pg.locator('[data-a=toggle]').first.click(); pg.wait_for_timeout(100); print('re-enabled slash src',pg.evaluate("SkillsPluginSource().map(s=>s.name)"))
    pg.keyboard.press('Escape')
    pg.click('#landingInput'); pg.keyboard.type('/pol'); print('slash plugin item',pg.locator('.sk-slash-item').count())
    pg.keyboard.press('Escape'); pg.fill('#landingInput',''); pg.keyboard.type('/ema'); pg.keyboard.press('Enter')
    print('actions form open',pg.locator('.sa-panel form').count(), 'input cleared',repr(pg.input_value('#landingInput')))
    pg.fill('[name=to]','a@b.com'); pg.fill('[name=subject]','Hello'); pg.fill('[name=body]','Body text')
    pg.click('button[type=submit]'); pg.wait_for_selector('.sa-preview')
    print('exec calls after preview',pg.evaluate('exec'))
    pg.screenshot(path='/tmp/a.png')
    pg.evaluate("document.querySelector('[data-a=approve]').click()"); pg.wait_for_timeout(200)
    print('programmatic click executed?',pg.evaluate('exec'))
    pg.click('[data-a=approve]'); pg.wait_for_selector('.sa-ok'); print('after real click',pg.evaluate('exec'))
    # not-ready
    pg.evaluate("NOTREADY=true;SkillsActions.open('send_email',{to:'a@b.com',subject:'s',body:'b'})"); pg.click('button[type=submit]'); pg.wait_for_selector('.sa-preview')
    print('approve disabled when missing',pg.locator('[data-a=approve]').is_disabled()); pg.screenshot(path='/tmp/m.png')
    print('errors',errs); b.close()
