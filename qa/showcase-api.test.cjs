const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const core=require('../showcase-core'),rows=new Map();
const fake={connect:async()=>({...fake,release(){}}),query:async(sql,args=[])=>{
  if(/^(BEGIN|COMMIT|ROLLBACK|CREATE|ALTER)|pg_advisory/.test(sql))return {rows:[]};
  if(sql.includes('count(*)'))return {rows:[{n:0}]};
  if(sql.startsWith('INSERT')){rows.set(args[0],{app:args[1],state:JSON.parse(JSON.stringify(args[2]))});return {rows:[]};}
  const row=rows.get(args[0]);if(!row||row.app!==args[1])return {rows:[]};
  if(sql.startsWith('UPDATE'))row.state=JSON.parse(JSON.stringify(args[2]));
  return {rows:[{state:row.state}]};
}};
const context={module:{exports:{}},require:n=>n==='pg'?{Pool:function(){return fake;}}:n==='../showcase-core'?core:require(n),process:{env:{PG_HOST:'mock',PG_USER:'mock',PG_PASSWORD:'mock'}},URL,Buffer};
vm.runInNewContext(fs.readFileSync('api/showcase.js','utf8'),context);
const call=async(method,app,state,token)=>{let code,body,headers={};await context.module.exports({method,url:'/api/showcase?app='+app,headers:token?{authorization:'Bearer '+token}:{},body:state},{setHeader:(k,v)=>headers[k]=v,set statusCode(n){code=n;},end:s=>body=JSON.parse(s)});return {code,body,headers};};
(async()=>{
  for(const app of Object.keys(core.names)){
    const sample=await call('GET',app);assert.equal(sample.code,200);
    const created=await call('POST',app,sample.body.state);assert.equal(created.code,201);assert.match(created.body.token,/^[a-f0-9]{64}$/);
    const updated=created.body.state;updated.items[0].title='Edited and persisted';
    assert.equal((await call('PUT',app,updated,created.body.token)).code,200);
    assert.equal((await call('GET',app,null,created.body.token)).body.state.items[0].title,'Edited and persisted');
    assert.equal((await call('GET',app,null,'a'.repeat(64))).code,404);
    assert.equal((await call('GET',app,null,'bad')).code,401);
    assert.equal((await call('GET',app==='tasks'?'budget':'tasks',null,created.body.token)).code,404);
  }
  assert.equal((await call('POST','study',{app:'study'})).code,400);
  assert.equal((await call('DELETE','tasks')).code,405);
  console.log('PASS: API sample/create/update/read, token rejection, cross-app lookup isolation, validation (mock PG; not live DB/account isolation)');
})().catch(e=>{console.error(e);process.exitCode=1;});
