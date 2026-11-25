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
        await pg.evaluate("()=>{xr(1);__xp.floorStep(false);__sk.menu.visible=true;__xp.drawMenu()}")
        # Add figure from the menu (camera stand-in: renderer.xr.getCamera falls back to the normal camera here)
        r=await pg.evaluate("()=>{const w=__xp.XR.W.find(w=>w.label==='Figure');if(!w)return 'no button';w.click();const F=__fig.figs()[0];return F?F.p.map(x=>+x.toFixed(1))+' ry '+F.ry.toFixed(0):'none'}")
        print('add',r)
        async def menu(n):
            d=await pg.evaluate("()=>{__xp.drawMenu();return __xp.menuCv.toDataURL('image/png')}");open(SP+n+'.png','wb').write(base64.b64decode(d.split(',')[1]))
        await menu('fg4_m0')
        # trigger the right-hand handle and pull it up
        r=await pg.evaluate("""()=>{__sk.menu.visible=false;const c=__xp.ctrls[1],F=__fig.figs()[0],T3=__xp.THREE;F.g.updateMatrixWorld(true);const h=F.handles['hand-r'].getWorldPosition(new T3.Vector3());
          const from=[h.x+.25,h.y+.15,h.z+.6];aim(c,from,h.toArray());const ok=__fig.xrFigTrigger(c);const st=!!c.userData.figIK;
          for(let i=1;i<=10;i++){aim(c,[from[0],from[1]+i*.03,from[2]],[h.x,h.y+i*.03+.0,h.z]);__xp.xrTick()}__xp.xrTriggerEnd(c);return [ok,st,F.pose,F.ang.rSh.map(x=>x.toFixed(0)).join(','),F.ang.rEl.toFixed(0)]}""")
        print('reach',r)
        # grip the body and carry it 0.5 m to the side
        r=await pg.evaluate("""()=>{const c=__xp.ctrls[1],F=__fig.figs()[0],T3=__xp.THREE;const ch=F.J.chest.getWorldPosition(new T3.Vector3());aim(c,[ch.x,ch.y,ch.z+.7],ch.toArray());const p0=F.p.slice();
          const ok=__fig.xrFigGrab(c);for(let i=1;i<=5;i++){aim(c,[ch.x-i*.1,ch.y+.1,ch.z+.7],[ch.x-i*.1,ch.y,ch.z]);}__fig.xrFigRelease(c);return [ok,p0.map(x=>+x.toFixed(1)),F.p.map(x=>+x.toFixed(1))]}""")
        print('carry',r)
        await pg.evaluate("()=>{__sk.menu.visible=true}");await menu('fg4_m1')
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
