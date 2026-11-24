import asyncio,http.server,threading,functools,sys,json,os
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
# ck1.py design.json : delete / slide / auto on a stand-in corner block
INFO="""()=>{const lp=__lp().filter(p=>p.kind==='cleat'&&p.cleat&&!p.cleat.rib);return lp.map(p=>[p.label,p.joint,p.cleat.key,+p.cleat.x.toFixed(2)])}"""
PICK="""(lab)=>{const p=__lp().find(p=>p.label===lab),{THREE,camera,world}=__xp;let cx=0,cy=0,n=0;for(const ct of p.part)for(const q of ct){cx+=q[0];cy+=q[1];n++}
  const C=p.frame.O.clone().addScaledVector(p.frame.u,cx/n).addScaledVector(p.frame.v,cy/n);
  /* look at it from inside the box, along the joint */
  const cam=C.clone().addScaledVector(p.frame.n,9).addScaledVector(p.frame.u,3).addScaledVector(p.frame.v,3),cw=cam.clone(),tw=C.clone();world.localToWorld(cw);world.localToWorld(tw);__cam.position.copy(cw);__orbit.target.copy(tw);__orbit.update();
  const hide=new Set();for(const q of __lp()){if(q.kind!=='face'||!q.frame||!q.part?.length)continue;const d=C.clone().sub(cam),den=q.frame.n.dot(d);if(Math.abs(den)<1e-6)continue;const s=q.frame.n.dot(q.frame.O.clone().sub(cam))/den;if(s>0&&s<.95)hide.add(q.label)}
  return [...hide]}"""
PROJ="""(lab)=>{const p=__lp().find(p=>p.label===lab),{THREE,camera,world}=__xp;let cx=0,cy=0,n=0;for(const ct of p.part)for(const q of ct){cx+=q[0];cy+=q[1];n++}
  const P=p.frame.O.clone().addScaledVector(p.frame.u,cx/n).addScaledVector(p.frame.v,cy/n);world.localToWorld(P);P.project(camera);const r=document.querySelector('canvas').getBoundingClientRect();return [r.left+(P.x+1)/2*r.width,r.top+(1-P.y)/2*r.height]}"""
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    D=json.load(open(sys.argv[1]));D.setdefault('S',{}).update({"secOn":False,"look":"color"})
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(1000)
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(3500)
        info=await pg.evaluate(INFO);print('blocks',info)
        stand=[x for x in info if '#f' in x[2]]
        if not stand:print('no stand-in blocks on this design');await b.close();srv.shutdown();return
        lab,jt,key,x=stand[0];print('stand-in',lab,jt,key)
        sel=lambda:pg.evaluate("__xp.getSel()")
        await pg.evaluate('l=>__xp.pickPanel(l)',lab);await pg.wait_for_timeout(400);print('picked',await sel())
        bar=await pg.evaluate("[...document.querySelectorAll('#panelBar .ckb')].filter(b=>!b.hidden).map(b=>b.textContent.trim())");print('bar',bar)
        await pg.evaluate("document.querySelector('#ckR').click()");await pg.wait_for_timeout(2500)
        i2=await pg.evaluate(INFO);print('after slide',[z for z in i2 if z[1]==jt],'edit',await pg.evaluate("JSON.stringify(__blocks[0].cleatEdit)"))
        await pg.evaluate("document.querySelector('#ckDel').click()");await pg.wait_for_timeout(2500)
        i3=await pg.evaluate(INFO);print('after delete',[z for z in i3 if z[1]==jt],'total',len(info),'->',len(i3))
        await pg.evaluate("__rebuild()");await pg.wait_for_timeout(2500);i4=await pg.evaluate(INFO);print('stays deleted',len(i4)==len(i3))
        await pg.evaluate("document.querySelector('#ckReset').click()");await pg.wait_for_timeout(2500);i5=await pg.evaluate(INFO);print('reset brings back',len(i5)==len(info))
        print('errors',errs)
        await b.close()
    srv.shutdown()
asyncio.run(main())
