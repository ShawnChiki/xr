import json,sys,subprocess,os
import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
# pl2.py out.png design.json A3 A13 ...   -> flat outlines of those panels (outer blue, holes red, face outline grey dashed)
out,des,labs=sys.argv[1],sys.argv[2],sys.argv[3:]
js="JSON.stringify(r.panels.filter(p=>%s.includes(p.label)).map(p=>({l:p.label,part:p.part,holes:p.holes||[],face:p.face||[],shapes:(p.shapes||[]).map(s=>({o:s.outer||s.contour||null,h:s.holes||[]}))})))"%json.dumps(labs)
r=subprocess.run(['node','h.mjs'],env={**os.environ,'D':des,'JS':js},capture_output=True,text=True)
d=json.loads(r.stdout.strip().split('\n')[-1])
fig,ax=plt.subplots(1,len(d),figsize=(7*len(d),7))
if len(d)==1:ax=[ax]
for a,p in zip(ax,d):
    for c in p['face']:
        if c and isinstance(c[0],list):a.plot([q[0] for q in c]+[c[0][0]],[q[1] for q in c]+[c[0][1]],'--',color='#999',lw=.8)
    for c in p['part']:a.plot([q[0] for q in c]+[c[0][0]],[q[1] for q in c]+[c[0][1]],'-',color='#1f5fff',lw=1.4)
    a.set_aspect('equal');a.set_title(p['l']);a.grid(alpha=.3)
plt.tight_layout();plt.savefig(out,dpi=70)
