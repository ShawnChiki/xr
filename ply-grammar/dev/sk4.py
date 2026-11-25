import asyncio,http.server,threading,functools,sys,json,base64
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
exec(open(SP+'sk2.py').read().split('async def main')[0].split("SP=")[1].split('\n',1)[1])
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:400]))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{localStorage.clear()}");await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate(JS)
        async def menu(n):
            d=await pg.evaluate("()=>{__xp.drawMenu();return __xp.menuCv.toDataURL('image/png')}");open(SP+n+'.png','wb').write(base64.b64decode(d.split(',')[1]))
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(5000)
        await pg.evaluate("()=>{xr(1);__xp.floorStep(false);__sk.menu.visible=false}");await menu('sk4_m0')
        r=await pg.evaluate("""()=>{const c=__xp.ctrls[1];c.position.set(0,.75,1.2);c.updateMatrix();c.updateMatrixWorld(true);const j=__sk.xrJoint(c);__xp.xrTrigger(c);__xp.xrTriggerEnd(c);const e=__sk.getSelEdge();return [j?j.jt.label+' d='+j.d.toFixed(2):null,e&&e.key]}""");print('pick',r);await menu('sk4_m1')
        r=await pg.evaluate("""()=>{const W=__xp.XR.W;const names=W.map(w=>w.label||'');const b=__blocks[0];const k=__sk.getSelEdge().key;W.find(w=>w.label==='Fingers').click();return new Promise(res=>setTimeout(()=>res([JSON.stringify(b.edgeOpts[k]),b.joints.find(j=>j.key===k).joint]),2500))}""");print('meet',r);await menu('sk4_m2')
        r=await pg.evaluate("""()=>{const c=__xp.ctrls[1];c.position.set(3,3,3);c.updateMatrix();c.updateMatrixWorld(true);__xp.xrTrigger(c);__xp.xrTriggerEnd(c);return __sk.getSelEdge()}""");print('let go',r)
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
