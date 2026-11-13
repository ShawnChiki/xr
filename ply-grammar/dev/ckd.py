import asyncio,http.server,threading,functools,sys,json
from playwright.async_api import async_playwright
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',8792),functools.partial(Q,directory='render'));threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8792/index.html');await pg.wait_for_timeout(1000);await pg.evaluate("localStorage.clear()");await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(2000)
        L="()=>__xp.getPanels().filter(p=>p.cleat).slice(0,3).map(p=>[p.label,+p.cleat.x.toFixed(2),p.cleat.ed])"
        await pg.evaluate("__xp.pickPanel('AJ3')");await pg.wait_for_timeout(200);await pg.click('#isoBtn');await pg.wait_for_timeout(1200)
        await pg.evaluate("__xp.pickPanel('AJ3')");await pg.wait_for_timeout(200)
        # screen position of the block centre and of a point 4 in further along the joint
        pts=await pg.evaluate("""()=>{const {THREE,camera,world}=__xp,p=__xp.getPanels().find(p=>p.label==='AJ3'),c=p.cleat,r=document.querySelector('canvas').getBoundingClientRect();
          const o=p.part[0],cen=[o.reduce((a,q)=>a+q[0],0)/o.length,o.reduce((a,q)=>a+q[1],0)/o.length];const sc=x=>{const P=new THREE.Vector3(...c.a).addScaledVector(new THREE.Vector3(...c.e),x).add(new THREE.Vector3().copy(p.frame.O).sub(new THREE.Vector3(...c.a).addScaledVector(new THREE.Vector3(...c.e),c.x)).multiplyScalar(1)).add(new THREE.Vector3().copy(p.frame.u).multiplyScalar(cen[0])).add(new THREE.Vector3().copy(p.frame.v).multiplyScalar(cen[1]));world.localToWorld(P);P.project(camera);return [r.left+(P.x+1)/2*r.width,r.top+(1-P.y)/2*r.height]};return [sc(c.x),sc(c.x+4)]}""")
        print(pts,await pg.evaluate(L))
        print(await pg.evaluate('''(pt)=>{const {THREE,camera,panelGroup}=__xp,r=document.querySelector('canvas').getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((pt[0]-r.left)/r.width*2-1,-(pt[1]-r.top)/r.height*2+1),camera);const T=[];panelGroup.traverse(o=>{if(o.isMesh&&!o.userData.isStencil&&o.visible)T.push(o)});const h=ray.intersectObjects(T,false);return [T.length,h.length,h[0]&&h[0].object.userData.panel,document.elementFromPoint(pt[0],pt[1]).tagName]}''',pts[0]))
        await pg.mouse.move(*pts[0]);await pg.mouse.down();
        for i in range(1,9):
            await pg.mouse.move(pts[0][0]+(pts[1][0]-pts[0][0])*i/8,pts[0][1]+(pts[1][1]-pts[0][1])*i/8);await pg.wait_for_timeout(60)
        await pg.mouse.up();await pg.wait_for_timeout(900)
        print(await pg.evaluate(L),await pg.evaluate("document.querySelector('#selPanelName').textContent"))
        await pg.screenshot(path='ckd.png');print(errs);await b.close()
    srv.shutdown()
asyncio.run(main())
