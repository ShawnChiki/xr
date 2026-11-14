import asyncio,http.server,threading,functools,sys,json,os
from playwright.async_api import async_playwright
# vw.py design.json name:cx,cy,cz:tx,ty,tz ...   env PRE=js run once after Panels opens, VIEW=panels|build..., DSF
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory='render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    D=json.load(open(sys.argv[1]))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850},device_scale_factor=int(os.environ.get('DSF','1')));errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(1000)
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=%s]').click()"%os.environ.get('VIEW','panels'));await pg.wait_for_timeout(2500)
        await pg.keyboard.press('Escape');await pg.mouse.move(840,450);await pg.mouse.move(150,300)
        if os.environ.get('PRE'):
            r=await pg.evaluate(os.environ['PRE']);await pg.wait_for_timeout(1500)
            if r is not None:print(r)
        for a in sys.argv[2:]:
            nm,c,t=a.split(':')[:3]
            await pg.evaluate("([c,t])=>{__cam.position.set(...c);__orbit.target.set(...t);__orbit.update()}",[[float(x) for x in c.split(',')],[float(x) for x in t.split(',')]]);await pg.wait_for_timeout(700)
            await pg.screenshot(path=nm+'.png',clip=({'x':0,'y':0,'width':1300,'height':850} if nm.startswith('F') else {'x':380,'y':100,'width':920,'height':720}))
        if errs:print(errs)
        await b.close()
    srv.shutdown()
asyncio.run(main())
