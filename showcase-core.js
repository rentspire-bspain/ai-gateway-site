/* Shared deterministic Wave-1 model. No network, storage or DOM side effects. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShowcaseCore=api;})(typeof globalThis==='object'?globalThis:this, function(){
  const names={tasks:'To-Do + Habit Tracker',budget:'Budget + Subscription Tracker',study:'Homework + Study Planner'};
  function seed(app){
    if(!names[app])throw Error('Unknown app');
    const items=app==='tasks'?[{id:'seed-1',title:'Plan the week',kind:'task',done:false},{id:'seed-2',title:'Read twenty pages',kind:'habit',days:['2026-11-18','2026-11-19','2026-11-20']}]:app==='budget'?[{id:'seed-1',title:'Example streaming plan',kind:'subscription',amount:22.99},{id:'seed-2',title:'Example music plan',kind:'subscription',amount:16.99}]:[{id:'seed-1',title:'Calculus problem set',kind:'assignment',date:'2026-12-01',done:false},{id:'seed-2',title:'Biology midterm',kind:'exam',date:'2026-12-04',done:false}];
    return {version:1,app,theme:'calm',income:4750,items};
  }
  function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
  function validate(s){
    if(!s||!names[s.app]||!Array.isArray(s.items)||s.items.length>300)throw Error('Invalid workspace');
    if(!['calm','warm','mono'].includes(s.theme))throw Error('Invalid theme');
    if(!Number.isFinite(s.income)||s.income<0||s.income>1e9)throw Error('Invalid income');
    const kinds={tasks:['task','habit'],budget:['subscription','expense'],study:['assignment','exam','revision','class']};
    const ids=new Set();
    for(const i of s.items){
      if(typeof i.id!=='string'||i.id.length>80||ids.has(i.id))throw Error('Invalid item ID');ids.add(i.id);
      if(typeof i.title!=='string'||!i.title.trim()||i.title.length>160||!kinds[s.app].includes(i.kind))throw Error('Check title and type');
      if(s.app==='budget'&&(!Number.isFinite(i.amount)||i.amount<0||i.amount>1e7))throw Error('Enter a non-negative amount');
      if(s.app==='study'&&!validDate(i.date))throw Error('Enter a valid date');
      if(i.done!==undefined&&typeof i.done!=='boolean')throw Error('Invalid completion');
      if(i.days!==undefined&&(!Array.isArray(i.days)||i.days.length>366||i.days.some(d=>!validDate(d))||new Set(i.days).size!==i.days.length))throw Error('Invalid habit dates');
    }return s;
  }
  function streak(days,today){const set=new Set(days||[]);let date=new Date(today+'T00:00:00Z');if(!set.has(today))date.setUTCDate(date.getUTCDate()-1);let n=0;while(set.has(date.toISOString().slice(0,10))){n++;date.setUTCDate(date.getUTCDate()-1);}return n;}
  function summary(s,today=new Date().toISOString().slice(0,10)){
    if(s.app==='budget'){const cents=kind=>s.items.filter(i=>i.kind===kind).reduce((n,i)=>n+Math.round(i.amount*100),0);const subscriptions=cents('subscription'),expenses=cents('expense');return {subscriptions:subscriptions/100,expenses:expenses/100,remaining:(Math.round(s.income*100)-subscriptions-expenses)/100};}
    return {complete:s.items.filter(i=>i.done).length,total:s.items.length,streaks:s.items.filter(i=>i.kind==='habit').map(i=>({id:i.id,days:streak(i.days,today)})),exams:s.items.filter(i=>i.kind==='exam').map(i=>({id:i.id,days:Math.round((Date.parse(i.date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000)}))};
  }
  function theme(prompt){const p=String(prompt).toLowerCase();if(/mono|terminal|literal/.test(p))return 'mono';if(/warm|serif|sunset|friendly/.test(p))return 'warm';return 'calm';}
  return {names,seed,validate,summary,streak,theme,validDate};
});
