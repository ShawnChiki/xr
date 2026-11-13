import asyncio,http.server,threading,functools,sys,json
from playwright.async_api import async_playwright
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',8791),functools.partial(Q,directory='render'));threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8791/index.html');await pg.wait_for_timeout(1000);await pg.evaluate("localStorage.clear()");await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(2000)
        L="()=>__xp.getPanels().filter(p=>p.cleat).map(p=>[p.label,p.joint,+p.cleat.x.toFixed(2),p.cleat.leg,p.cleat.ed])"
        c0=await pg.evaluate(L);print('before',c0)
        lab=c0[0][0]
        await pg.evaluate("l=>__xp.pickPanel(l)",lab);await pg.wait_for_timeout(300)
        print('bar',await pg.evaluate("[...document.querySelectorAll('#panelBar button')].filter(b=>!b.hidden).map(b=>b.textContent.trim())"))
        for i in range(3):
            await pg.click('#ckR');await pg.wait_for_timeout(500)
        await pg.click('#ckB');await pg.wait_for_timeout(500);await pg.click('#ckB');await pg.wait_for_timeout(700)
        c1=await pg.evaluate(L);print('after ',c1)
        print('bar',await pg.evaluate("[...document.querySelectorAll('#panelBar button')].filter(b=>!b.hidden).map(b=>b.textContent.trim())"))
        await pg.screenshot(path='ck1.png')
        await pg.wait_for_timeout(600);await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(2000)
        print('reload',await pg.evaluate(L))
        lab2=(await pg.evaluate(L))[0][0]
        await pg.evaluate("l=>__xp.pickPanel(l)",lab2);await pg.wait_for_timeout(300);await pg.click('#ckAuto');await pg.wait_for_timeout(800)
        print('auto  ',await pg.evaluate(L))
        print(errs);await b.close()
    srv.shutdown()
asyncio.run(main())
