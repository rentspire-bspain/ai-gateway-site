/* No browser storage: explicit server saves and private-link resume. */
(() => {
  'use strict';
  const c=window.ShowcaseCore,$=id=>document.getElementById(id);
  const app=new URLSearchParams(location.search).get('app')||'tasks';
  if(!c.names[app]){$('status').textContent='Unknown app. Choose a demo above.';return;}
  let state=c.seed(app),editing=null,token=location.hash.slice(1),busy=false;
  const types={tasks:['task','habit'],budget:['subscription','expense'],study:['assignment','exam','revision','class']};
  const today=()=>new Date().toISOString().slice(0,10);
  const say=text=>{$('status').textContent=text;};
  const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.type='button';b.onclick=fn;return b;};
  $('title').textContent=c.names[app];document.title=c.names[app]+' | Showcase';
  types[app].forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;$('kind').append(o);});
  $('amount-label').hidden=app!=='budget';$('date-label').hidden=app!=='study';$('income-box').hidden=app!=='budget';
  $('date').value=today();
  function dirty(){say('Unsaved changes. Save to keep them across reloads.');render();}
  function resetForm(){editing=null;$('editor').reset();$('date').value=today();$('submit').textContent='Add item';$('cancel-edit').hidden=true;}
  function render(){
    document.body.dataset.theme=state.theme;
    $('voice').textContent={calm:'Make room for what matters.',warm:'A little progress, a brighter day.',mono:'Track. Review. Repeat.'}[state.theme];
    const s=c.summary(state,today());
    $('summary').textContent=app==='budget'?`Monthly subscriptions $${s.subscriptions.toFixed(2)} · Expenses $${s.expenses.toFixed(2)} · Remaining $${s.remaining.toFixed(2)}`:`${s.complete} of ${s.total} items complete`;
    $('income').value=state.income;$('items').replaceChildren();$('empty').hidden=state.items.length!==0;
    for(const it of state.items){
      const li=document.createElement('li'),text=document.createElement('span');
      let detail=app==='budget'?`$${it.amount.toFixed(2)}`:it.date||'';
      if(it.kind==='habit')detail=`${c.streak(it.days,today())} day current streak`;
      if(it.kind==='exam'){const d=s.exams.find(x=>x.id===it.id).days;detail+=d<0?` · ${-d} days ago`:` · ${d} days remaining`;}
      text.textContent=`${it.done?'Complete: ':''}${it.title} · ${it.kind} · ${detail}`;li.append(text);
      if(app!=='budget')li.append(button(it.kind==='habit'?'Toggle today':it.done?'Reopen':'Complete',()=>{if(it.kind==='habit'){it.days=it.days||[];it.days=it.days.includes(today())?it.days.filter(d=>d!==today()):[...it.days,today()];}else it.done=!it.done;dirty();}));
      li.append(button('Edit',()=>{editing=it.id;$('item-title').value=it.title;$('kind').value=it.kind;$('amount').value=it.amount||0;$('date').value=it.date||today();$('submit').textContent='Save edit';$('cancel-edit').hidden=false;$('item-title').focus();}));
      li.append(button('Remove from tracker',()=>{state.items=state.items.filter(i=>i.id!==it.id);if(editing===it.id)resetForm();dirty();}));$('items').append(li);
    }
    $('save').textContent=token?'Save private workspace':'Create private resume link';
  }
  $('editor').onsubmit=e=>{e.preventDefault();try{
    const old=state.items.find(i=>i.id===editing);
    const item={...(old||{}),id:editing||crypto.randomUUID(),title:$('item-title').value.trim(),kind:$('kind').value};
    if(app==='budget')item.amount=Number($('amount').value);
    if(app==='study')item.date=$('date').value;
    if(item.kind==='habit')item.days=item.days||[];
    const next={...state,items:editing?state.items.map(i=>i.id===editing?item:i):[...state.items,item]};c.validate(next);state=next;resetForm();dirty();
  }catch(e){say(e.message);}};
  $('cancel-edit').onclick=resetForm;
  $('income-save').onclick=()=>{try{const next={...state,income:Number($('income').value)};c.validate(next);state=next;dirty();}catch(e){say(e.message);}};
  $('theme-form').onsubmit=e=>{e.preventDefault();state.theme=c.theme($('theme-prompt').value);dirty();};
  async function request(method,data){
    const r=await fetch('/api/showcase?app='+app,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});
    const result=await r.json();if(!r.ok)throw Error(result.error||'Request failed');return result;
  }
  function resume(){const a=document.createElement('a');a.href=location.href;a.textContent='Your private resume link (keep it secret)';$('saved-link').replaceChildren(a);}
  $('save').onclick=async()=>{if(busy)return;busy=true;$('save').disabled=true;try{
    const sent=JSON.stringify(state);const r=await request(token?'PUT':'POST',state);
    if(r.token){token=r.token;history.replaceState(null,'','#'+token);}resume();render();say(sent===JSON.stringify(state)?'Saved on the server. Keep your private resume link.':'Earlier snapshot saved. Newer edits are still unsaved.');
  }catch(e){say(e.message);}finally{busy=false;$('save').disabled=false;}};
  $('export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=app+'-workspace.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
  $('import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>100000)throw Error('File too large');const next=JSON.parse(await f.text());c.validate(next);if(next.app!==app)throw Error('Choose a file from this demo type');state=next;resetForm();dirty();}catch(e){say(e.message);}};
  render();
  if(token){say('Loading private workspace…');$('save').disabled=true;request('GET').then(r=>{c.validate(r.state);state=r.state;render();resume();say('Loaded from server.');$('save').disabled=false;}).catch(e=>{token='';history.replaceState(null,'',location.pathname+location.search);say(e.message+' Sample shown; export or create a new workspace.');render();$('save').disabled=false;});}
})();
