import asyncio,http.server,threading,functools,sys,json,os
from playwright.async_api import async_playwright
# bld.py design.json [shot-step ...] : every Build step's wording, and screenshots of chosen steps
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    D=json.load(open(sys.argv[1]));D.setdefault('S',{}).update({"secOn":False,"look":"color"})
    if os.environ.get('SET'):D['S'].update(json.loads(os.environ['SET']))
    shots=[int(x) for x in sys.argv[2:]]
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(1000)
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(3000)
        notes=await pg.evaluate("(()=>{const el=document.querySelector('#thinNotes,#notesList,#warn');return [...document.querySelectorAll('.tr')].map(e=>e.textContent.trim()).filter(Boolean).slice(0,12)})()")
        await pg.evaluate("document.querySelector('[data-view=build]').click()");await pg.wait_for_timeout(4000)
        n=await pg.evaluate("document.querySelectorAll('#aList [data-as]').length");print('steps',n,'| summary:',await pg.evaluate("document.querySelector('#aSum').textContent.trim().slice(0,200)"))
        for k in range(n):
            await pg.evaluate("k=>document.querySelector('#aList [data-as=\"'+k+'\"]').click()",k);await pg.wait_for_timeout(250 if k not in shots else 2500)
            print(k+1,await pg.evaluate("document.querySelector('#aText').textContent.trim()"))
            if k in shots:await pg.screenshot(path=SP+f'bld_{k+1}.png')
        if errs:print('ERR',errs)
        await b.close()
    srv.shutdown()
asyncio.run(main())
