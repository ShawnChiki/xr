import asyncio,http.server,threading,functools,sys,json
from playwright.async_api import async_playwright
# par.py design.json -> which panels' meshes are not closed (odd ray crossings)
JS='''()=>{const {THREE,panelGroup}=__xp,by={};panelGroup.traverse(o=>{if(o.isMesh&&!o.userData.noStencil&&!o.userData.isStencil&&o.userData.panel){(by[o.userData.panel]=by[o.userData.panel]||[]).push(o)}});
 const out={},rc=new THREE.Raycaster();let seed=7;const R=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 for(const [lab,ms] of Object.entries(by)){const tmp=ms.map(m=>{const t=new THREE.Mesh(m.userData.stencilGeo||m.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));t.matrixWorld.copy(m.matrixWorld);return t});
   const bx=new THREE.Box3();tmp.forEach(t=>{t.geometry.computeBoundingBox();bx.union(t.geometry.boundingBox.clone().applyMatrix4(t.matrixWorld))});let odd=0,n=0,ex=null;
   for(let i=0;i<300;i++){const p=new THREE.Vector3(bx.min.x+R()*(bx.max.x-bx.min.x),bx.min.y+R()*(bx.max.y-bx.min.y),bx.min.z+R()*(bx.max.z-bx.min.z)),d=new THREE.Vector3(R()-.5,R()-.5,R()-.5).normalize();
     rc.set(p.clone().addScaledVector(d,-500),d);const h=rc.intersectObjects(tmp,false);n++;if(h.length%2){odd++;ex=ex||p.toArray().map(x=>+x.toFixed(1))}}
   if(odd>3)out[lab]=[odd,n,ex]}
 return JSON.stringify(out)}'''
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',8794),functools.partial(Q,directory='render'));threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8794/index.html');await pg.wait_for_timeout(1000)
        for f in sys.argv[1:]:
            D=json.load(open(f));await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
            await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(2000)
            print(f,await pg.evaluate(JS))
        print(errs);await b.close()
    srv.shutdown()
asyncio.run(main())
