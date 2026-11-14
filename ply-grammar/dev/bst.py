import asyncio,http.server,threading,functools,sys,json
from playwright.async_api import async_playwright
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',8797),functools.partial(Q,directory='render'));threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8797/index.html');await pg.wait_for_timeout(1000);await pg.evaluate("localStorage.clear()");await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=build]').click()");await pg.wait_for_timeout(2500)
        print(await pg.evaluate("[...document.querySelectorAll('#aList .item .nm')].map(e=>e.textContent).join(' | ')"))
        n=await pg.evaluate("__xp.AS.plan.steps.length")
        for k in range(n):
            await pg.evaluate("k=>__xp.showStep(k)",k);await pg.wait_for_timeout(120)
            st=await pg.evaluate("__xp.AS.plan.steps[__xp.AS.step].sub||__xp.AS.plan.steps[__xp.AS.step].pre||false")
            if st or k<2:print(k+1,await pg.inner_text('#aText'))
        # pause test
        sub=await pg.evaluate("__xp.AS.plan.steps.findIndex(s=>s.sub)");await pg.evaluate("k=>__xp.showStep(k)",sub);await pg.wait_for_timeout(500)
        await pg.screenshot(path='bst1.png',clip={'x':380,'y':100,'width':920,'height':720})
        await pg.click('#aPlay');await pg.wait_for_timeout(300);await pg.click('#aPlay');t1=await pg.evaluate("__xp.AS.tt");await pg.wait_for_timeout(700);t2=await pg.evaluate("__xp.AS.tt")
        print('paused: tt',round(t1,2),'->',round(t2,2),'button',await pg.inner_text('#aPlay'))
        await pg.evaluate("(()=>{const e=document.querySelector('#aStepSlider');e.value=500;e.dispatchEvent(new Event('input'))})()");await pg.wait_for_timeout(300)
        print('scrub: tt',round(await pg.evaluate("__xp.AS.tt"),2),'of',round(await pg.evaluate("__xp.AS.total"),2))
        await pg.click('#aPlay');await pg.wait_for_timeout(600);print('resumed: tt',round(await pg.evaluate("__xp.AS.tt"),2),'step',await pg.evaluate("__xp.AS.step"),'sub idx',sub)
        print(errs);await b.close()
    srv.shutdown()
asyncio.run(main())
