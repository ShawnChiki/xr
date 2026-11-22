import asyncio,http.server,threading,functools,sys,json
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        D=json.load(open(SP+'d_user4.json'));D['S']['secOn']=False
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
        info="()=>{const b=__blocks[0],c=b.carves[0];return JSON.stringify({p:c.position.toArray().map(x=>+x.toFixed(1)),tc:!!__tc.object,tcIs:__tc.object===c,tm:__tc.mode,obj:__tc.object?[__tc.object.userData.isCarve,__tc.object.userData.cid,__tc.object.type,__tc.object===c.userData.sizer]:null,gp:__tc.object?__tc.object.getWorldPosition(new __xp.THREE.Vector3()).toArray().map(x=>+x.toFixed(1)):null,mode:__mode(),selCut:!!__selCut(),sel:__xp.getSel?JSON.stringify(__xp.getSel()).slice(0,120):''})}"
        print('start',await pg.evaluate(info))
        # click on the cut-out's see-through box in massing view
        pos=await pg.evaluate("()=>{const b=__blocks[0],T=__xp.THREE,fs=b.faces.filter(f=>f.pl.src?.type==='carve').map(f=>f.poly.reduce((s,p)=>s.add(p),new T.Vector3()).multiplyScalar(1/f.poly.length)).sort((a,c)=>a.distanceTo(__cam.position)-c.distanceTo(__cam.position));const w=fs[0];const v=w.project(__cam),r=document.querySelector('canvas').getBoundingClientRect();return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height]}")
        await pg.mouse.click(*pos);await pg.wait_for_timeout(500);print('after click',await pg.evaluate(info))
        g=await pg.evaluate("()=>{const c=__blocks[0].carves[0],T=__xp.THREE,w=c.getWorldPosition(new T.Vector3());const pr=v=>{const q=v.clone().project(__cam),r=document.querySelector('canvas').getBoundingClientRect();return [r.left+(q.x+1)/2*r.width,r.top+(1-q.y)/2*r.height]};return [pr(w),pr(w.clone().add(new T.Vector3(10,0,0)))]}")
        ax=None
        for k in range(2,40):
            x=g[0][0]+(g[1][0]-g[0][0])*k/10;y=g[0][1]+(g[1][1]-g[0][1])*k/10
            await pg.mouse.move(x,y);await pg.wait_for_timeout(40)
            ax=await pg.evaluate("()=>__tc.axis")
            if ax=='X':break
        print('arrow found',ax,k)
        await pg.mouse.down()
        for i in range(1,9):
            await pg.mouse.move(x+(g[1][0]-g[0][0])*i/8,y+(g[1][1]-g[0][1])*i/8);await pg.wait_for_timeout(30)
        await pg.mouse.up();await pg.wait_for_timeout(600);print('after drag',await pg.evaluate(info))
        await pg.mouse.move(5,5);await pg.wait_for_timeout(300);await pg.screenshot(path=SP+'cv1.png')
        print(errs);await b.close()
    srv.shutdown()
asyncio.run(main())
