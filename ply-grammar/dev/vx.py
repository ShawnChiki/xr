import asyncio,http.server,threading,functools,sys,json,os
from playwright.async_api import async_playwright
# vx.py design.json name:cx,cy,cz:tx,ty,tz[:hideLabels] ...   x-ray views: the faces turned toward the camera are hidden so the blocks behind show.
# env PRE=js, VIEW=panels|build, DSF, HIDE=labels always hidden (comma), KEEP=1 hide nothing automatically, STEP=n (build view step)
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory='render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    D=json.load(open(sys.argv[1]))
    if os.environ.get('SET'):D.setdefault('S',{}).update(json.loads(os.environ['SET']))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850},device_scale_factor=int(os.environ.get('DSF','1')));errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(1000)
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=%s]').click()"%os.environ.get('VIEW','panels'));await pg.wait_for_timeout(3500)
        await pg.keyboard.press('Escape');await pg.mouse.move(840,450);await pg.mouse.move(150,300)
        if os.environ.get('PRE'):
            r=await pg.evaluate(os.environ['PRE']);await pg.wait_for_timeout(1500)
            if r is not None:print(r)
        for a in sys.argv[2:]:
            parts=a.split(':');nm,c,t=parts[:3];hide=(parts[3].split(',') if len(parts)>3 and parts[3] else [])+[x for x in os.environ.get('HIDE','').split(',') if x]
            await pg.evaluate("([c,t])=>{__cam.position.set(...c);__orbit.target.set(...t);__orbit.update()}",[[float(x) for x in c.split(',')],[float(x) for x in t.split(',')]]);await pg.wait_for_timeout(300)
            r=await pg.evaluate("""([hide,keep])=>{const lp=__lp(),cam=__cam.position.clone();__world.worldToLocal(cam);const H=new Set(hide);
              if(!keep)for(const p of lp){if(p.kind!=='face'||!p.frame)continue;let cx=0,cy=0,n=0;for(const ct of p.part||[])for(const q of ct){cx+=q[0];cy+=q[1];n++}if(!n)continue;const C=p.frame.O.clone().addScaledVector(p.frame.u,cx/n).addScaledVector(p.frame.v,cy/n);if(p.frame.n.dot(cam.clone().sub(C))>0)H.add(p.label)}
              __scene.traverse(o=>{if(o.userData&&o.userData.panel!=null)o.visible=!H.has(o.userData.panel)});return [...H].join(' ')}""",[hide,bool(os.environ.get('KEEP'))])
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=nm+'.png',clip=({'x':0,'y':0,'width':1300,'height':850} if nm.startswith('F') else {'x':380,'y':100,'width':920,'height':720}))
            print(nm,'hidden:',r)
        if errs:print(errs)
        await b.close()
    srv.shutdown()
asyncio.run(main())
