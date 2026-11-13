import asyncio,http.server,threading,functools
from playwright.async_api import async_playwright
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',8793),functools.partial(Q,directory='render'));threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8793/index.html');await pg.wait_for_timeout(1000);await pg.evaluate("localStorage.clear()");await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(2000)
        await pg.mouse.click(770,530);await pg.wait_for_timeout(500);print('edge card hidden',await pg.evaluate("document.querySelector('#edgeCard').hidden"))
        print('mode',await pg.evaluate("__xp.getMode()"),'selected',await pg.evaluate("document.querySelector('#selPanelName').textContent"),'bar hidden',await pg.evaluate("document.querySelector('#panelBar').hidden"))
        await pg.evaluate("document.querySelector('[data-view=build]').click()");await pg.wait_for_timeout(2500)
        await pg.evaluate("__xp.showStep(5)");await pg.wait_for_timeout(1600);await pg.screenshot(path='drill.png',clip={'x':380,'y':100,'width':920,'height':720})
        print(errs);await b.close()
    srv.shutdown()
asyncio.run(main())
