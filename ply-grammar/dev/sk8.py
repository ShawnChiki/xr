import asyncio,http.server,threading,functools,sys,json,base64
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
exec(open(SP+'sk2.py').read().split('async def main')[0].split("SP=")[1].split('\n',1)[1])
AIM="""window.aim=(c,from,to)=>{c.position.set(...from);const d=new T.Vector3(...to).sub(new T.Vector3(...from)).normalize();c.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),d);c.updateMatrix();c.updateMatrixWorld(true);c.userData.grip.position.copy(c.position);c.userData.grip.updateMatrix();c.userData.grip.updateMatrixWorld(true)};
window.faceC=(b,n)=>{const f=b.faces.find(f=>f.pl.n.dot(new T.Vector3(...n))>.99);const c=f.poly.reduce((s,p)=>s.add(p),new T.Vector3()).multiplyScalar(1/f.poly.length);return __world.localToWorld(c.clone()).toArray()};
window.sz=()=>__blocks.map(b=>b.name+':'+b.sizer.scale.toArray().map(x=>+x.toFixed(1)).join('x')).join(' ');"""
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:400]))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{localStorage.clear()}");await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate(JS);await pg.evaluate(AIM)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(4000)
        await pg.evaluate("()=>{xr(1);__sk.menu.visible=false;__sk.setView('panels')}");await pg.wait_for_timeout(300)
        print('start',await pg.evaluate("sz()"))
        # drag: aim at the +z face of A, pull trigger, move hand 6 cm towards you
        r=await pg.evaluate("""()=>{const c=__xp.ctrls[1],b=__blocks[0],F=faceC(b,[0,0,1]);const from=[F[0]+.05,F[1]+.02,F[2]+.8];aim(c,from,F);__xp.xrTrigger(c);const st=[!!c.userData.push,!!c.userData.hd];
          for(let i=1;i<=10;i++){aim(c,[from[0],from[1],from[2]+i*.006],[F[0],F[1],F[2]+i*.006]);__xp.xrTick()}const mid=__sk.menu.visible+' mass:'+__xp.massGroup?.visible;__xp.xrTriggerEnd(c);return [st,sz()]}""");print('drag face',r)
        await pg.wait_for_timeout(2500)
        print('panels rebuilt',await pg.evaluate("()=>__xp.getPanels().length"))
        # tap: aim near the top edge joint, quick trigger without moving
        r=await pg.evaluate("""()=>{const c=__xp.ctrls[1],b=__blocks[0],F=faceC(b,[0,0,1]),top=faceC(b,[0,1,0]);const P=[F[0]+.1,18.2*.0254,F[2]];aim(c,[P[0],P[1]+.02,P[2]+.8],P);const j=__sk.xrJoint(c),h=__sk.xrFace(c);__xp.xrTrigger(c);const st=[!!c.userData.push,!!c.userData.hd,!!c.userData.tap];__xp.xrTick();__xp.xrTriggerEnd(c);const e=__sk.getSelEdge();return [j&&j.jt.label,!!h,st,e&&e.key,sz()]}""");print('tap joint',r)
        # grip on a part: the model moves, the box does not
        r=await pg.evaluate("""()=>{const c=__xp.ctrls[1],b=__blocks[0],F=faceC(b,[0,0,1]);aim(c,[F[0],F[1],F[2]+.6],F);const p0=b.pivot.position.clone();__sk.grab(c);const nav=c.userData.nav;__sk.release(c);return [nav,b.pivot.position.distanceTo(p0)]}""");print('grip',r)
        # buttons: icons for each
        r=await pg.evaluate("()=>[0,1].map(i=>['left','right'].map(h=>__sk.xrIconFor(h,i)))");print('icons',r)
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
