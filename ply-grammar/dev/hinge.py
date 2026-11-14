import asyncio,http.server,threading,functools,sys,json
from playwright.async_api import async_playwright
D={"app":"ply-grammar","v":3,"blocks":[{"name":"A","p":[0,15,0],"s":[40,30,30],"cuts":[],"carves":[]}]}
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',8796),functools.partial(Q,directory='render'));threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8796/index.html');await pg.wait_for_timeout(1000)
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
        for hinge in (True,):
            r=await pg.evaluate("""(hinge)=>{const X=__xp,b=X.blocks[0];X.setMode('tilt');const f=b.faces.find(f=>f.pl.n.x>.9);
              const lo=f.poly.slice().sort((p,q)=>p.y-q.y),A=lo[0],B=lo[1];X.setTiltTarget({b,f},hinge?{A,B}:null);
              const q=new X.THREE.Quaternion().setFromAxisAngle(new X.THREE.Vector3(1,0,0),hinge?-0.35:-0.35);X.tiltH.quaternion.multiply(q);X.applyTilt();
              return JSON.stringify({hinge,faces:b.faces.map(f=>f.pl.id+':'+f.pl.n.toArray().map(x=>x.toFixed(2)).join(',')+' pts'+f.poly.length),cuts:b.cuts.length})}""",hinge)
            print(r);await pg.wait_for_timeout(600);await pg.screenshot(path=f'hinge_{int(hinge)}.png',clip={'x':380,'y':100,'width':920,'height':720})
            await pg.evaluate("__xp.undo()");await pg.wait_for_timeout(600)
        print(errs);await b.close()
    srv.shutdown()
asyncio.run(main())
