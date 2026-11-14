import asyncio,http.server,threading,functools,sys,json
from playwright.async_api import async_playwright
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',8795),functools.partial(Q,directory='render'));threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8795/index.html');await pg.wait_for_timeout(1000);await pg.evaluate("localStorage.clear()");await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(2000)
        N="()=>{const b=__xp.blocks[0];return [b._res.screws.filter(s=>!s.dropped).length,b._res.screws.filter(s=>s.manual!=null).length,JSON.stringify(b.screwEdit||{}).length]}"
        print('start',await pg.evaluate(N))
        await pg.click('#screwBtn');await pg.wait_for_timeout(800)
        bar=lambda:pg.evaluate("[...document.querySelectorAll('#panelBar button')].filter(b=>!b.hidden).map(b=>b.textContent.trim())")
        print('bar',await bar())
        # screen position of one screw on the top/slope face
        pos=await pg.evaluate("""()=>{const {THREE,camera,world}=__xp,b=__xp.blocks[0],r=document.querySelector('canvas').getBoundingClientRect();const ray=new THREE.Raycaster();
          for(const s of b._res.screws){if(s.dropped||!s.f?.O||s.edge[0]!=='R')continue;const P=s.p3.clone();world.localToWorld(P);const d=P.clone().sub(camera.position).normalize();if(d.dot(s.n.clone().transformDirection(world.matrixWorld))>-.5)continue;
            const Q=P.clone().project(camera);return [r.left+(Q.x+1)/2*r.width,r.top+(1-Q.y)/2*r.height,s.name,s.edge]}return null}""")
        print('screw at',pos)
        await pg.mouse.click(pos[0],pos[1]);await pg.wait_for_timeout(500);print('after click bar',await bar())
        await pg.mouse.move(pos[0],pos[1]);await pg.mouse.down();
        for i in range(1,7):await pg.mouse.move(pos[0]+i*8,pos[1]+i*3);await pg.wait_for_timeout(50)
        await pg.mouse.up();await pg.wait_for_timeout(1200);print('target',pos[0]+48,pos[1]+18,'got',await pg.evaluate('''()=>{const {THREE,camera,world}=__xp,b=__xp.blocks[0],r=document.querySelector('canvas').getBoundingClientRect(),a=b.screwEdit.add[0].p,P=new THREE.Vector3(...a);world.localToWorld(P);P.project(camera);return [r.left+(P.x+1)/2*r.width,r.top+(1-P.y)/2*r.height]}'''));print('after drag',await pg.evaluate(N),await pg.evaluate("JSON.stringify(__xp.blocks[0].screwEdit)"))
        await pg.click('#scAdd');await pg.wait_for_timeout(200);await pg.mouse.click(pos[0]-60,pos[1]+40);await pg.wait_for_timeout(1200);print('after add',await pg.evaluate(N));await pg.click('#scAdd')
        await pg.screenshot(path='scr.png',clip={'x':380,'y':100,'width':920,'height':720})
        await pg.wait_for_timeout(600);await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(2000);print('reload',await pg.evaluate(N))
        print(errs);await b.close()
    srv.shutdown()
asyncio.run(main())
