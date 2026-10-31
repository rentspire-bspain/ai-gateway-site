import json,sys,urllib.request,concurrent.futures as cf,os
URL="https://dcyjmftriqayqaonitlx.supabase.co/functions/v1/eval-run-tmp"
TOK=open('/tmp/evaltok').read().strip()
conds={"OLD_auto_nosys":{"model":"openrouter/auto","system":False},
"QWEN_sys":{"model":"qwen/qwen3.8-27b","system":True},
"FLINT_sys":{"model":"recursive/flint-v1.0:free","system":True},
"AUTO_sys":{"model":"openrouter/auto","system":True},
"QWEN_nosys":{"model":"qwen/qwen3.8-27b","system":False}}
qs=[{"id":q["id"],"q":q["q"]} for q in json.load(open('questions.json'))]
def call(name,batch):
    req=urllib.request.Request(URL,json.dumps({"cond":conds[name],"questions":batch}).encode(),{"Content-Type":"application/json","x-eval-token":TOK})
    for a in range(3):
        try: return name,json.load(urllib.request.urlopen(req,timeout=140))
        except Exception as e: err=str(e)
    return name,[{"id":b["id"],"ok":False,"err":err} for b in batch]
res={n:[] for n in conds}
with cf.ThreadPoolExecutor(5) as ex:
    fs=[ex.submit(call,n,qs[i:i+4]) for n in conds for i in range(0,len(qs),4)]
    for f in fs:
        n,r=f.result(); res[n]+=r
json.dump(res,open('raw_answers.json','w'),indent=1)
for n,r in res.items(): print(n,len(r),sum(1 for x in r if x.get("ok") and x.get("answer")),set(x.get("model") for x in r), sum(1 for x in r if x.get("fallback")))
