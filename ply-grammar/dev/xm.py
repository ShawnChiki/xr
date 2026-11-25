import asyncio,http.server,threading,functools,sys,json,base64
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(600)
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",json.load(open(SP+'d_user5.json')));await pg.reload();await pg.wait_for_timeout(3000)
        await pg.evaluate("()=>{__sk.setXR('vr');__world.scale.setScalar(.0254);__world.updateMatrixWorld(true);__xp.floorStep(false);__sk.menu.visible=true}")
        shots=[('m_mass',"()=>{__xp.XR.page=null;__net.setView('mass');__sk.skTool('push');__xp.select?0:0;__xp.drawMenu()}"),
               ('m_pen',"()=>{__sk.skTool('pen');__xp.drawMenu()}"),
               ('m_panels',"()=>{__sk.skTool('push');__net.setView('panels');__xp.drawMenu()}"),
               ('m_build',"()=>{__net.setView('build');__xp.drawMenu()}"),
               ('m_settings',"()=>{__xp.XR.page='settings';__xp.drawMenu()}"),
               ('m_room',"()=>{__xp.XR.page=null;__xp.XR.step='room';__net.NET.typed='48';__xp.drawMenu()}"),
               ('m_floor',"()=>{__xp.XR.step=null;__xp.floorStep(true);__xp.drawMenu()}")]
        for n,js in shots:
            await pg.evaluate(js);await pg.wait_for_timeout(1500)
            d=await pg.evaluate("()=>{__xp.drawMenu();return __xp.menuCv.toDataURL('image/png')}");open(SP+n+'.png','wb').write(base64.b64decode(d.split(',')[1]))
            print(n,await pg.evaluate("()=>({h:__sk.menu.scale.y*1500|0,btns:__xp.XR.W.length})"))
        print('errs',errs[:4]);await b.close()
    srv.shutdown()
asyncio.run(main())
