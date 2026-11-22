// Private capability workspaces, not signed-in accounts. Tokens stay in URL fragments.
const crypto=require('crypto');
const {Pool}=require('pg');
const core=require('../showcase-core');
let pool,bootstrap;
const DDL=`CREATE TABLE IF NOT EXISTS public.boundview_demo_workspaces (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  app text NOT NULL CHECK (app IN ('tasks','budget','study')),
  state jsonb NOT NULL,
  actor_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`;
async function db(){
  if(!process.env.PG_HOST||!process.env.PG_USER||!process.env.PG_PASSWORD)throw Error('storage_unavailable');
  if(!pool)pool=new Pool({host:process.env.PG_HOST,port:Number(process.env.PG_PORT||5432),user:process.env.PG_USER,password:process.env.PG_PASSWORD,database:process.env.PG_DATABASE||'postgres',ssl:{rejectUnauthorized:false},max:2,connectionTimeoutMillis:6000});
  if(!bootstrap)bootstrap=(async()=>{
    const c=await pool.connect();
    try{
      await c.query('BEGIN');
      await c.query("SELECT pg_advisory_xact_lock(hashtext('boundview_demo_workspaces_bootstrap'))");
      await c.query(DDL);
      // Only this feature's new table. No policies: public anon/authenticated roles denied.
      // CREATE + RLS commit atomically, so failure cannot expose a newly created table.
      await c.query('ALTER TABLE public.boundview_demo_workspaces ENABLE ROW LEVEL SECURITY');
      await c.query('COMMIT');
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  })().catch(e=>{bootstrap=null;throw e;});
  await bootstrap;
  return pool;
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
  const app=new URL(req.url,'https://local.invalid').searchParams.get('app');
  if(!core.names[app])return send(400,{error:'Unknown app'});
  if(!['GET','POST','PUT'].includes(req.method)){res.setHeader('Allow','GET, POST, PUT');return send(405,{error:'Method not allowed'});}
  const auth=req.headers.authorization||'';
  if(req.method==='GET'&&!auth)return send(200,{state:core.seed(app),mode:'sample',revision:'wave1-r1',limits:'Private-link workspace, not account isolation. No payments, bank cancellation, notifications or domain provisioning.'});
  let state;
  if(req.method!=='GET'){
    try{state=typeof req.body==='string'?JSON.parse(req.body):req.body;if(Buffer.byteLength(JSON.stringify(state)||'')>100000)throw Error();core.validate(state);if(state.app!==app)throw Error();}catch{return send(400,{error:'Invalid workspace data; check fields and size'});}
  }
  if(req.method==='POST'&&auth)return send(400,{error:'Create without Authorization'});
  const token=req.method==='POST'?crypto.randomBytes(32).toString('hex'):auth.replace(/^Bearer /,'');
  if(!/^[a-f0-9]{64}$/.test(token))return send(401,{error:'Valid private workspace key required'});
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  try{
    const p=await db();
    // Only server-side PG credentials access capability rows; no public REST policies.
    if(req.method==='POST'){
      const actor=crypto.createHash('sha256').update(String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0]).digest('hex');
      const c=await p.connect();try{
        await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[actor]);
        const count=await c.query("SELECT count(*)::int AS n FROM public.boundview_demo_workspaces WHERE actor_hash=$1 AND created_at>now()-interval '1 hour'",[actor]);
        if(count.rows[0].n>=20){await c.query('ROLLBACK');return send(429,{error:'Workspace creation limit; try later'});}
        await c.query('INSERT INTO public.boundview_demo_workspaces (token_hash,app,state,actor_hash) VALUES ($1,$2,$3,$4)',[hash,app,state,actor]);await c.query('COMMIT');
      }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
      return send(201,{token,state,mode:'private-link'});
    }
    const q=req.method==='GET'?await p.query('SELECT state FROM public.boundview_demo_workspaces WHERE token_hash=$1 AND app=$2',[hash,app]):await p.query('UPDATE public.boundview_demo_workspaces SET state=$3,updated_at=now() WHERE token_hash=$1 AND app=$2 RETURNING state',[hash,app,state]);
    if(!q.rows.length)return send(404,{error:'Workspace not found'});
    return send(200,{state:q.rows[0].state,mode:'private-link'});
  }catch{return send(503,{error:'Durable storage unavailable. Export your work; nothing was saved. Deployment operator must configure PG_* and install the showcase schema.'});}
};
