import asyncio,http.server,threading,functools,sys,json
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        for dn in sys.argv[1:]:
            pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
            await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
            if dn!='default':await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",json.load(open(SP+dn)));await pg.reload()
            await pg.wait_for_timeout(2500)
            for v in ['panels','build','test','sheets','mass']:
                await pg.evaluate("v=>document.querySelector('[data-view='+v+']').click()",v);await pg.wait_for_timeout(2200)
                if v=='panels':
                    for bt in ['#screwBtn','#explodeBtn','#gapBtn','#secBtn','#secTurn','#secBtn','#gapBtn','#explodeBtn']:await pg.click(bt);await pg.wait_for_timeout(700)
                if v=='build':
                    for i in range(4):await pg.keyboard.press('ArrowRight');await pg.wait_for_timeout(300)
            # right-click in massing
            await pg.mouse.click(840,480,button='right');await pg.wait_for_timeout(300);m=await pg.evaluate("[document.querySelector('#ctx').hidden,[...document.querySelectorAll('#ctx button')].map(b=>b.textContent)]");await pg.keyboard.press('Escape')
            print(dn,'errors',errs,'mass menu',m);await pg.close()
        await b.close()
    srv.shutdown()
asyncio.run(main())
