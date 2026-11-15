import asyncio,http.server,threading,functools,sys,json,base64
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
exec(open(SP+'sk2.py').read().split('async def main')[0].split("SP=")[1].split('\n',1)[1])
def prism(V,F,pr,z0,z1,nid):
    a=[];c=[]
    for (x,y) in pr:
        V[nid]=[x,y,z1];a.append(nid);nid+=1;V[nid]=[x,y,z0];c.append(nid);nid+=1
    F.append(a);F.append(c);n=len(pr)
    for i in range(n):F.append([a[i],a[(i+1)%n],c[(i+1)%n],c[i]])
    return nid
V={};F=[];n=prism(V,F,[(0,0),(34,0),(34,11.5),(0,11.5)],-11.5,11.5,1);import os;X0=float(os.environ.get('X0',10));Z0=float(os.environ.get('Z0',-6));n=prism(V,F,[(X0,11.5),(X0+14,11.5),(X0+14,23),(X0,23)],Z0,Z0+13,n)
for k in V:V[k]=[V[k][0]-17,V[k][1]-11.5,V[k][2]]
D={'app':'ply-grammar','v':3,'blocks':[{'name':'A','p':[0,11.5,0],'q':[0,0,0,1],'s':[34,23,23],'cuts':[],'carves':[],'sk':{'V':V,'F':[{'key':'.'.join(map(str,sorted(f))),'ids':f} for f in F]}}]}
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:400]))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',d)}",json.dumps(D));await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate(JS)
        print('loaded',await pg.evaluate("info()"))
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(4000)
        r=await pg.evaluate("()=>{const b=__blocks[0],r=__sk.planFor(b);return [r.bad,r.plan.steps.filter(s=>s.stuck).map(s=>r.plan.parts[s.i].label+'['+s.stuck.join('/')+']')]}");print('before',r)
        r=await pg.evaluate("async()=>{const b=__blocks[0];const m=await __sk.findBuildFix(b);const r=__sk.planFor(b);return [m,r.bad,JSON.stringify(b.edgeOpts),b.ribMax,b.ribAxis]}");print('fix',r)
        await pg.mouse.move(5,5);await pg.wait_for_timeout(2500);await pg.screenshot(path=SP+'sk7.png')
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
