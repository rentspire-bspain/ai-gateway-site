import json,sys
sys.argv=['x']
src=open('run_eval.py').read().split("res={n:[]")[0]
exec(src)
res=json.load(open('raw_answers_run2.json'))
for n in ["QWEN_sys","QWEN_nosys"]:
    out=[]
    for i in range(0,len(qs),2):
        out+=call(n,qs[i:i+2])[1]
    res[n]=out; print(n,sum(1 for x in out if x.get('answer')),flush=True)
    json.dump(res,open('raw_answers.json','w'),indent=1)
