# run: python3 modules/connectors.test.py  (playwright; mocks sb + fetch; no network)
import json
from playwright.sync_api import sync_playwright
R=lambda f:open('modules/'+f).read()
pre="""<style>:root{--bg:#15171B;--bg-elevated:#1C1E23;--border:#2a2d33;--text:#eee;--text-muted:#9aa;--accent:#3D9595}body{background:var(--bg);color:var(--text);font-family:sans-serif}.stg-btn{padding:6px 10px}</style>"""
html=pre+"<style>"+R('connectors.css')+"</style><div id=host></div><div id=chat></div><script>"+"""
var GATEWAY='https://x/functions/v1';window.calls=[];window.STATUS={connected:false,configured:{oauth_client:true},services:{}};
var sb={auth:{getSession:()=>Promise.resolve({data:{session:{access_token:'JWT'}}})}};
window.SettingsUI={open:function(p){window.opened=p}};
window.fetch=function(u,o){var b=JSON.parse(o.body);window.calls.push([u.split('/').pop(),b.action,b.kind||'']);
 var R=(x)=>Promise.resolve(new Response(JSON.stringify(x),{status:200}));
 if(b.action==='status')return R(window.STATUS);
 if(b.action==='start')return R({url:window.STARTURL||'https://accounts.google.com/o/oauth2/v2/auth?x=1'});
 if(b.action==='exchange'){window.STATUS={connected:true,email:'j@gmail.com',configured:{oauth_client:true},services:{gmail_read:true,gmail_send:true,calendar:false}};return R(window.STATUS)}
 if(b.action==='disconnect'){window.STATUS={connected:false,configured:{oauth_client:true},services:{}};return R(Object.assign({disconnected:true},window.STATUS))}
 if(b.action==='execute')return R({executed:true,id:'G1',link:'https://mail.google.com/x'});
 return R({})};
history.replaceState(null,'','#connector_code=CODE&connector_state=ST');
</script><script>"""+R('connectors.js')+"</script>"
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':800,'height':700}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_content(html); pg.wait_for_timeout(600)
    print('exchange called',[c for c in pg.evaluate('calls') if c[1]=='exchange'], 'hash cleared',repr(pg.evaluate('location.hash')), 'opened',pg.evaluate('opened'))
    pg.evaluate("document.getElementById('host').appendChild(ConnectorsUI.card())"); pg.wait_for_timeout(300)
    print('sub:',pg.inner_text('.cn-sub'),'| granted:',pg.locator('.cn-li.on').count(),'| buttons:',pg.locator('.cn-actions button').all_inner_texts())
    pg.screenshot(path='/tmp/cn1.png')
    pg.on('dialog',lambda d:d.accept()); pg.click('.cn-danger'); pg.wait_for_timeout(400)
    print('after disconnect:',pg.inner_text('.cn-sub'),'|',pg.locator('.cn-actions button').all_inner_texts(), '|', pg.inner_text('.cn-msg'))
    # actions
    acts=[{'kind':'send_email','preview':{'title':'Send email','fields':{'To':'john@x.com','Subject':'<img src=x onerror=alert(1)>','Body':'Thu 12?'},'warning':'This email will be sent immediately on approval and cannot be unsent.'},'payload':{'to':['john@x.com'],'subject':'s','body':'b'},'approval_token':'T.S'}]
    pg.evaluate("a=>ConnectorsUI.renderActions(document.getElementById('chat'),a)",acts)
    print('xss img nodes:',pg.locator('#chat img').count(),'| approve btn:',pg.locator('.cn-approve').inner_text())
    pg.evaluate("document.querySelector('.cn-approve').click()"); pg.wait_for_timeout(200)
    print('programmatic click executed?',[c for c in pg.evaluate('calls') if c[1]=='execute'])
    pg.screenshot(path='/tmp/cn2.png')
    pg.click('.cn-approve'); pg.wait_for_timeout(300)
    print('real click executed:',[c for c in pg.evaluate('calls') if c[1]=='execute'],'|',pg.inner_text('.cn-act-msg'))
    print('errors',errs)
    b.close()
