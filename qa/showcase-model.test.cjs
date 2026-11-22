const assert=require('node:assert/strict'),c=require('../showcase-core');
for(const app of Object.keys(c.names))assert.equal(c.validate(c.seed(app)).app,app);
assert.equal(c.streak(['2026-11-18','2026-11-19','2026-11-20'],'2026-11-20'),3);
assert.deepEqual(c.summary(c.seed('budget')),{subscriptions:39.98,expenses:0,remaining:4710.02});
const s=c.seed('study');s.items.push({id:'new',title:'New exam',kind:'exam',date:'2026-12-02'});assert.equal(c.summary(s,'2026-12-01').exams.find(x=>x.id==='new').days,1);
assert.throws(()=>c.validate({...s,items:[{id:'bad',title:'Bad',kind:'exam',date:'2026-02-30'}]}));
assert.throws(()=>c.validate({...c.seed('budget'),items:[{id:'bad',title:'Bad',kind:'expense',amount:-1}]}));
assert.equal(c.theme('warm serif friendly'),'warm');assert.equal(c.theme('terminal literal'),'mono');
console.log('PASS: seeds, amounts, dates, streaks, invalid fields and theme routing');
