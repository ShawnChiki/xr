import asyncio,http.server,threading,functools,sys,json
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
JS_DRAW="""
window.stroke=(a,b,wob=.35)=>{const M=.0254,k=__sk,c=__xp.ctrls[1],N=14,R=(i)=>Math.sin(i*12.9898+a[0]*7+b[2]*3)*wob;
  const at=t=>[a[0]+(b[0]-a[0])*t+R(t*9+1),a[1]+(b[1]-a[1])*t+R(t*7+2),a[2]+(b[2]-a[2])*t+R(t*5+3)];
  c.position.set(...at(0).map(x=>x*M));(c.updateMatrix(),c.updateMatrixWorld(true));k.skStrokeStart(c);for(let i=1;i<=N;i++){c.position.set(...at(i/N).map(x=>x*M));(c.updateMatrix(),c.updateMatrixWorld(true));k.skStrokeMove(c)}k.skStrokeEnd(c)};
window.xr=on=>{__sk.setXR(on?'vr':null);__world.scale.setScalar(on?.0254:1);__world.position.set(0,0,0);__world.updateMatrixWorld(true);__sk.skDraw()};
window.box=(o,w,h,d)=>{const P=[[0,0,0],[w,0,0],[w,0,d],[0,0,d],[0,h,0],[w,h,0],[w,h,d],[0,h,d]].map(p=>p.map((x,i)=>x+o[i]));
  for(const [i,j] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]])stroke(P[i],P[j])};
window.info=()=>({blocks:__blocks.map(b=>({name:b.name,sk:!!b.sk,nV:b.sk?Object.keys(b.sk.V).length:0,nF:b.sk?b.sk.F.length:0,cells:b.sk?__sk.skCells(b).length:0,s:b.sizer.scale.toArray().map(x=>+x.toFixed(2)),faces:b.faces.length})),sk:{v:__sk.get().SK.v.length,e:__sk.get().SK.e.length,f:__sk.get().SKF?.faces.length}});
"""
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:400]));pg.on('console',lambda m:print('CONSOLE',m.type,m.text[:400]) if m.type in('error','warning') and 'GPU' not in m.text and 'WebGL' not in m.text else None)
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify({app:'ply-grammar',v:3,blocks:[]}))}");await pg.reload();await pg.wait_for_timeout(2000)
        await pg.evaluate(JS_DRAW)
        async def shot(n):
            await pg.mouse.move(5,5);await pg.wait_for_timeout(900);await pg.screenshot(path=SP+n+'.png')
        step=sys.argv[1] if len(sys.argv)>1 else 'all'
        await pg.evaluate("()=>{xr(1);__sk.skTool('pen');box([-15,0,-9],30,20,18);xr(0)}");print('box',await pg.evaluate("info()"));await shot('sk1a')
        # a ramp beside it: triangle prism
        await pg.evaluate("""()=>{xr(1);const o=[24,0,-9],w=26,h=16,d=18,P=[[0,0,0],[w,0,0],[0,h,0],[0,0,d],[w,0,d],[0,h,d]].map(p=>p.map((x,i)=>x+o[i]));
          for(const [i,j] of [[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[0,3],[1,4],[2,5]])stroke(P[i],P[j]);xr(0)}""");print('ramp',await pg.evaluate("info()"));await shot('sk1b')
        # a loop drawn on the box's top, then pulled out as a block
        await pg.evaluate("""()=>{xr(1);const y=20,P=[[-10,y,-5],[2,y,-5],[2,y,5],[-10,y,5]];for(let i=0;i<4;i++)stroke(P[i],P[(i+1)%4],.2);xr(0)}""");print('loop',await pg.evaluate("info()"))
        r=await pg.evaluate("""()=>{xr(1);const M=.0254,k=__sk,c=__xp.ctrls[1];c.position.set(-4*M,20.3*M,0);(c.updateMatrix(),c.updateMatrixWorld(true));const h=k.skPick(__world.worldToLocal(c.userData.tip.getWorldPosition(new __xp.THREE.Vector3())).toArray(),1.4);if(!h){xr(0);return 'nopick'}
          k.skGrabStart(c,h);for(let i=1;i<=10;i++){c.position.set(-4*M,(20.3+i*1.2)*M,0);(c.updateMatrix(),c.updateMatrixWorld(true));k.skGrabMove(c)}k.skGrabEnd(c);xr(0);return h.kind+' '+h.key}""");print('pull',r,await pg.evaluate("info()"));await shot('sk1c')
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(5000);await shot('sk1d')
        print('panels',await pg.evaluate("()=>__xp.getPanels().length"))
        await pg.evaluate("document.querySelector('[data-view=mass]').click()");await pg.wait_for_timeout(500)
        # push a sketched face with the ordinary push tool
        r=await pg.evaluate("""()=>{const b=__blocks.find(b=>b.name==='B'),f=b.faces.find(f=>Math.abs(f.pl.n.y)<.01&&f.pl.n.x<-.3&&f.pl.src?.type==='sk');if(!f)return 'noface '+b.faces.map(f=>f.pl.id+':'+f.pl.src?.type);const d=__sk.startPush({b,f,id:f.pl.id,P:f.poly[0]},0);const m=__sk.pushTo(d,6);return m+' '+JSON.stringify(b.sizer.scale.toArray().map(x=>+x.toFixed(2)))}""");print('push',r)
        print('errs so far',errs);j=await pg.evaluate("()=>{try{__sk.save();return JSON.stringify(__sk.serModel())}catch(e){return 'ERR '+e.stack}}");print(j[:300]);open(SP+'d_sk1.json','w').write(j);await pg.wait_for_timeout(600)
        await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate(JS_DRAW);print('reload',await pg.evaluate("info()"));await shot('sk1e')
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
