import asyncio,http.server,threading,functools,sys,json,base64
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:400]));pg.on('console',lambda m:errs.append('C:'+m.text[:300]) if m.type=='error' else None)
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{localStorage.clear()}");await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('.tab[data-tab=model]')?.click()");await pg.wait_for_timeout(300)
        print('btn',await pg.evaluate("()=>!!document.querySelector('#figAdd')"));await pg.evaluate("()=>document.querySelector('#figAdd').click()");await pg.wait_for_timeout(500)
        print('added',await pg.evaluate("()=>__fig.figs().map(F=>F.p.map(x=>+x.toFixed(1))+' '+F.pose)"))
        poses=await pg.evaluate("()=>__fig.FIG_KEYS")
        shots=[]
        for k in poses:
            await pg.evaluate("k=>{const F=__fig.figs()[0];F.p=[0,0,40];__fig.figSetPose(F,k)}",k)
            await pg.evaluate("()=>{__cam.position.set(95,60,170);__orbit.target.set(0,28,40);__orbit.update()}");await pg.mouse.move(5,5);await pg.wait_for_timeout(250)
            await pg.screenshot(path=SP+'fg_'+k+'.png',clip={'x':560,'y':180,'width':560,'height':560});shots.append(k)
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
