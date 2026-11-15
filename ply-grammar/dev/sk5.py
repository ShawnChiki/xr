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
        d=open(SP+'d_sk1.json').read()
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',d)}",d);await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate(JS)
        print('loaded',await pg.evaluate("info()"))
        # select the ramp B and duplicate it, then set its width, then delete the copy, then undo
        await pg.evaluate("()=>{__sk.select(__blocks.find(b=>b.name==='B'));document.querySelector('#dupBlock').click()}");await pg.wait_for_timeout(1500);print('dup',await pg.evaluate("info()"))
        await pg.evaluate("()=>{const i=document.querySelector('#szX');i.value=40;i.dispatchEvent(new Event('change',{bubbles:true}));i.dispatchEvent(new Event('input',{bubbles:true}))}");await pg.wait_for_timeout(1500);print('size',await pg.evaluate("info()"))
        # real mouse: push tool on the big face of block A (the step) in massing view
        box=await pg.evaluate("""()=>{const b=__blocks.find(b=>b.name==='A'),f=b.faces.find(f=>f.pl.n.z>.9),c=f.poly.reduce((s,p)=>s.add(p),new T.Vector3()).multiplyScalar(1/f.poly.length);c.y-=4;const v=c.clone().project(__xp.camera||__camera),r=document.querySelector('canvas').getBoundingClientRect();return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height]}""")
        await pg.keyboard.press('p');await pg.mouse.move(box[0],box[1]);await pg.wait_for_timeout(200);await pg.mouse.down();
        for i in range(1,9):
            await pg.mouse.move(box[0]+i*4,box[1]+i*6);await pg.wait_for_timeout(40)
        await pg.mouse.up();await pg.wait_for_timeout(1500);print('mouse push',await pg.evaluate("info()"));await pg.mouse.move(5,5);await pg.wait_for_timeout(600);await pg.screenshot(path=SP+'sk5a.png')
        await pg.evaluate("()=>{__sk.select(__blocks.find(b=>b.name==='C'));document.querySelector('#delBlock').click()}");await pg.wait_for_timeout(1200);print('del',await pg.evaluate("info()"))
        await pg.keyboard.press('Control+z');await pg.wait_for_timeout(1200);print('undo',await pg.evaluate("info()"))
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
