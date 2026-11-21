import asyncio,http.server,threading,functools,sys,json,base64
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
SCR="""window.scr=o=>{const v=o.getWorldPosition(new __xp.THREE.Vector3()).project(__cam),r=document.querySelector('canvas').getBoundingClientRect();return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height]};
window.scrP=p=>{const v=new __xp.THREE.Vector3(...p).project(__cam),r=document.querySelector('canvas').getBoundingClientRect();return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height]};
window.F0=()=>__fig.figs()[0];window.fp=()=>F0().p.map(x=>+x.toFixed(1)).join(',')+' pose '+F0().pose;1;"""
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:400]))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{localStorage.clear()}");await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate(SCR)
        await pg.evaluate("()=>document.querySelector('#figAdd').click()");await pg.wait_for_timeout(400)
        await pg.evaluate("()=>{__cam.position.set(110,90,160);__orbit.target.set(10,15,0);__orbit.update()}");await pg.wait_for_timeout(300)
        print('n',await pg.evaluate("()=>[__fig.figs().length,typeof F0]"));print('start',await pg.evaluate("fp()"))
        # drag the body onto the box's top
        a=await pg.evaluate("()=>scr(F0().J.chest)");t=await pg.evaluate("()=>scrP([-8,30,-6])")
        await pg.mouse.move(*a);await pg.mouse.down()
        for i in range(1,13):
            await pg.mouse.move(a[0]+(t[0]-a[0])*i/12,a[1]+(t[1]-a[1])*i/12);await pg.wait_for_timeout(20)
        await pg.mouse.up();await pg.wait_for_timeout(300);print('on box',await pg.evaluate("fp()"),await pg.evaluate("()=>__blocks[0].sizer.scale.toArray()+' '+__blocks[0].pivot.position.toArray()"))
        # drag the right hand up
        a=await pg.evaluate("()=>scr(F0().handles['hand-r'])");await pg.mouse.move(*a);await pg.mouse.down()
        for i in range(1,11):
            await pg.mouse.move(a[0]+i*2,a[1]-i*14);await pg.wait_for_timeout(20)
        await pg.mouse.up();await pg.wait_for_timeout(300)
        print('reach',await pg.evaluate("()=>fp()+' rSh '+F0().ang.rSh.map(x=>x.toFixed(0))+' rEl '+F0().ang.rEl.toFixed(0)"))
        await pg.mouse.move(5,5);await pg.wait_for_timeout(400);await pg.screenshot(path=SP+'fg2a.png')
        # sit pose, then reload to see it saved
        await pg.evaluate("()=>document.querySelector('#figPoses [data-pose=sit]').click()");await pg.wait_for_timeout(500);print('sit',await pg.evaluate("fp()"))
        await pg.wait_for_timeout(800);await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate(SCR)
        print('reloaded',await pg.evaluate("()=>__fig.figs().length+' '+fp()"))
        await pg.evaluate("()=>{__cam.position.set(110,90,160);__orbit.target.set(10,15,0);__orbit.update()}");await pg.mouse.move(5,5);await pg.wait_for_timeout(400);await pg.screenshot(path=SP+'fg2b.png')
        # panels view: figure still there, and the parts build
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(4000);await pg.mouse.move(5,5);await pg.wait_for_timeout(300);await pg.screenshot(path=SP+'fg2c.png')
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
