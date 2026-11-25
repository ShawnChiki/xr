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
        D=json.load(open(SP+'d_user3.json'))
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate(JS);await pg.evaluate(AIM)
        await pg.evaluate("()=>{xr(1);__xp.floorStep(false);__sk.menu.visible=true;__xp.drawMenu()}")
        r=await pg.evaluate("()=>{const w=__xp.XR.W.find(w=>w.label==='step-build');w.click();return 'ok'}");await pg.wait_for_timeout(5000)
        async def menu(n):
            d=await pg.evaluate("()=>{__xp.drawMenu();return __xp.menuCv.toDataURL('image/png')}");open(SP+n+'.png','wb').write(base64.b64decode(d.split(',')[1]))
        print('build',await pg.evaluate("()=>[__sk.getView?__sk.getView():'', __xp.AS?__xp.AS.step:'' ]"))
        await menu('sk10_m0')
        await pg.evaluate("()=>{const w=__xp.XR.W.find(w=>w.label==='Next \u25B6');w.click()}");await pg.wait_for_timeout(300);await pg.evaluate("()=>{const w=__xp.XR.W.find(w=>w.label==='Next \u25B6');w.click()}");await pg.wait_for_timeout(300)
        await menu('sk10_m1')
        # trigger a part: aim at the middle of the model
        r=await pg.evaluate("""()=>{const c=__xp.ctrls[1];__sk.menu.visible=false;const b=__blocks[0];const P=__world.localToWorld(new T.Vector3(0,0.4,0));aim(c,[P.x+.2,P.y+1.2,P.z+.4],[P.x,P.y,P.z]);const before=__xp.AS.step;__xp.xrTrigger(c);__xp.xrTriggerEnd(c);__sk.menu.visible=true;return [before,__xp.AS.step]}""")
        print("tap",r);await menu("sk10_m2")
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
