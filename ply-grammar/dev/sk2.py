import asyncio,http.server,threading,functools,sys,json,base64
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
JS="""
window.M=.0254;window.T=__xp.THREE;
window.pose=(c,p)=>{c.position.set(p[0]*M,p[1]*M,p[2]*M);c.updateMatrix();c.updateMatrixWorld(true)};
window.xr=on=>{__sk.menu.visible=false;__sk.setXR(on?'vr':null);__world.scale.setScalar(on?.0254:1);__world.position.set(0,0,0);__world.updateMatrixWorld(true);__sk.skDraw()};
window.line=(a,b,wob=.3)=>{const c=__xp.ctrls[1],N=14,R=i=>Math.sin(i*12.9898+a[0]*7+b[2]*3)*wob,at=t=>[a[0]+(b[0]-a[0])*t+R(t*9+1),a[1]+(b[1]-a[1])*t+R(t*7+2),a[2]+(b[2]-a[2])*t+R(t*5+3)];
  pose(c,at(0));__xp.xrTrigger(c);for(let i=1;i<=N;i++){pose(c,at(i/N));__xp.xrTick()}__xp.xrTriggerEnd(c)};
window.prism=(pr,z0,z1)=>{const n=pr.length;for(const z of [z0,z1])for(let i=0;i<n;i++)line([...pr[i],z],[...pr[(i+1)%n],z]);for(let i=0;i<n;i++)line([...pr[i],z0],[...pr[i],z1])};
window.info=()=>({tool:__xp.XR.tool,blocks:__blocks.map(b=>({name:b.name,nV:b.sk?Object.keys(b.sk.V).length:0,nF:b.sk?b.sk.F.length:0,cells:b.sk?__sk.skCells(b).length:0,s:b.sizer.scale.toArray().map(x=>+x.toFixed(2)),faces:b.faces.length})),sk:{v:__sk.get().SK.v.length,e:__sk.get().SK.e.length,loose:__sk.get().SK.e.filter(e=>!__blocks.some(b=>b.sk&&b.sk.V[e.a]&&b.sk.V[e.b])).length}});
"""
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:400]))
        pg.on('requestfailed',lambda r:print('REQFAIL',r.url[:120]));pg.on('response',lambda r:print('HTTP',r.status,r.url[:120]) if r.status>=400 else None)
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify({app:'ply-grammar',v:3,blocks:[]}))}");await pg.reload();await pg.wait_for_timeout(2000)
        await pg.evaluate(JS)
        async def shot(n):
            await pg.evaluate("xr(0)");await pg.mouse.move(5,5);await pg.wait_for_timeout(900);await pg.screenshot(path=SP+n+'.png');await pg.evaluate("xr(1)")
        async def menu(n):
            d=await pg.evaluate("()=>{__xp.drawMenu();return __xp.menuCv.toDataURL('image/png')}");open(SP+n+'.png','wb').write(base64.b64decode(d.split(',')[1]))
        await pg.evaluate("()=>{xr(1);__xp.floorStep(false);__sk.skTool('pen');__sk.menu.visible=false}")
        # an L-shaped platform drawn as one outline, 36 wide, 14 high, with an 18-deep leg
        await pg.evaluate("()=>prism([[0,0],[36,0],[36,14],[14,14],[14,28],[0,28]],-10,10)");print('L',await pg.evaluate("info()"));await menu('sk2_menu1');await shot('sk2a')
        # undo twice: the solid opens up again and is loose lines; redo brings it back
        await pg.wait_for_timeout(500);await pg.evaluate("()=>__xp.menuDo('undo')");await pg.wait_for_timeout(400);print('undo',await pg.evaluate("info()"));await shot('sk2b')
        await pg.evaluate("()=>__xp.menuDo('redo')");await pg.wait_for_timeout(400);print('redo',await pg.evaluate("info()"))
        # grab a top corner with the grip and move it: the faces stay flat
        r=await pg.evaluate("""()=>{const c=__xp.ctrls[1];pose(c,[0,28,10]);__sk.grab(c);const g=!!c.userData.skGrab;for(let i=1;i<=8;i++){pose(c,[0,28+i*.6,10+i*.3]);__xp.xrTick()}__sk.release(c);return g}""");await pg.wait_for_timeout(400);print('grab corner',r,await pg.evaluate("info()"));await shot('sk2c')
        # eraser: brush one line away -> the block goes back to loose lines; then clear loose
        r=await pg.evaluate("""()=>{__sk.skTool('erase');const c=__xp.ctrls[1];pose(c,[25,0,-10]);__xp.xrTrigger(c);for(let i=0;i<4;i++){pose(c,[25+i*.2,0,-10]);__xp.xrTick()}__xp.xrTriggerEnd(c);return __xp.XR.tool}""");await pg.wait_for_timeout(400);print('erase',r,await pg.evaluate("info()"));await menu('sk2_menu2');await shot('sk2d')
        await pg.evaluate("()=>__xp.menuDo('undo')");await pg.wait_for_timeout(400);print('undo erase',await pg.evaluate("info()"))
        # the A button steps through the tools; icons
        ic=await pg.evaluate("()=>['push','pen','erase','del','undo','redo','menu'].map(k=>__sk.xrIcon(k).image.toDataURL('image/png'))")
        from PIL import Image;import io
        ims=[Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))) for d in ic];o=Image.new('RGBA',(128*7,128),(60,60,70,255))
        for i,im in enumerate(ims):o.paste(im,(i*128,0),im)
        o.save(SP+'sk2_icons.png')
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(6000);await shot('sk2e')
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
