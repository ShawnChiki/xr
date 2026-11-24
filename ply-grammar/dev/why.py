# why.py : build hwhy.mjs = fz harness with every `continue` in the corner block loops counted per joint (DBG.no[joint][line:n])
import re,subprocess,shutil
src=open('post.js').read();L=src.split('\n');n=0
for i,l in enumerate(L):
    if l.startswith("      for(const {x:sP,g:sG,leg,ed,fb,asy} of cnd){"):
        j=i
        while "panels.push({kind:'cleat'" not in L[j]: j+=1
        for k in range(i,j+1):
            c=[0]
            def rp(m):
                c[0]+=1;return "{const W_=globalThis.DBGW=globalThis.DBGW||{},J_=f.num+'>'+g.num;(W_[J_]=W_[J_]||{})['%d:%d']=((W_[J_]||{})['%d:%d']||0)+1;continue}"%(k+1,c[0],k+1,c[0])
            L[k]=re.sub(r'(?<![\w{])continue(?=;|\}|$)',rp,L[k])
        n+=1
print('loops instrumented',n)
shutil.copy('post.js','post.why_keep');open('post.js','w').write('\n'.join(L))
try:
    subprocess.run('python3 regen.py >/dev/null && ./mkfz.sh && cp hfz.mjs hwhy.mjs',shell=True,check=True)
finally:
    shutil.copy('post.why_keep','post.js');subprocess.run('python3 regen.py >/dev/null && ./mkfz.sh',shell=True,check=True)
