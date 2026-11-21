import asyncio,http.server,threading,functools,sys,json,base64
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
exec(open(SP+'sk2.py').read().split('async def main')[0].split("SP=")[1].split('\n',1)[1])
AIM="""window.aim=(c,from,to)=>{c.position.set(...from);const d=new T.Vector3(...to).sub(new T.Vector3(...from)).normalize();c.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),d);c.updateMatrix();c.updateMatrixWorld(true);c.userData.grip.position.copy(c.position);c.userData.grip.updateMatrix();c.userData.grip.updateMatrixWorld(true)};
window.faceC=(b,n)=>{const f=b.faces.find(f=>f.pl.n.dot(new T.Vector3(...n))>.99);const c=f.poly.reduce((s,p)=>s.add(p),new T.Vector3()).multiplyScalar(1/f.poly.length);return __world.localToWorld(c.clone()).toArray()};
window.sz=()=>__blocks.map(b=>b.name+':'+b.sizer.scale.toArray().map(x=>+x.toFixed(1)).join('x')).join(' ');"""
POLY="""window.poly=(P,wob=.25,N=12)=>{const c=__xp.ctrls[1];let first=true;const R=i=>Math.sin(i*12.9898)*wob;
  for(let k=0;k<P.length-1;k++){const a=P[k],b=P[k+1];for(let i=(k?1:0);i<=N;i++){const t=i/N,p=[a[0]+(b[0]-a[0])*t+R(i+k*7),a[1]+(b[1]-a[1])*t+R(i*3+k),a[2]+(b[2]-a[2])*t+R(i*5+k*2)];pose(c,p);if(first){__xp.xrTrigger(c);first=false}else __xp.xrTick()}}__xp.xrTriggerEnd(c);return __xp.getMenuMsg?__xp.getMenuMsg():''};
window.edges=()=>{const g=__sk.get();return g.SK.v.length+'v '+g.SK.e.length+'e'};"""
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:400]))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify({app:'ply-grammar',v:3,blocks:[]}))}");await pg.reload();await pg.wait_for_timeout(2000)
        await pg.evaluate(JS);await pg.evaluate(POLY);await pg.evaluate("()=>{xr(1);__xp.floorStep(false);__sk.skTool('pen');__sk.menu.visible=false}")
        print('L stroke',await pg.evaluate("()=>{poly([[0,0,0],[30,0,0],[30,20,0]]);return edges()}"))
        print('extend straight',await pg.evaluate("()=>{poly([[30,20,0],[30,34,0.4]]);return edges()+' len '+__sk.get().SK.e.map(e=>{const X=__sk.get().SKX;return Math.hypot(...X[e.a].map((x,i)=>x-X[e.b][i])).toFixed(1)}).join(',')}"))
        print('rectangle in one stroke',await pg.evaluate("()=>{poly([[0,0,20],[24,0,20],[24,0,40],[0,0,40],[0,0,20]]);return edges()+' faces '+__sk.get().SKF.faces.length}"))
        print('gentle curve stays one line',await pg.evaluate("()=>{poly([[50,0,0],[62,1.5,0],[74,0,0]]);return edges()}"))
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
