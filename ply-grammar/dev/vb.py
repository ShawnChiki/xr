import asyncio,http.server,threading,functools,sys,json,os
from playwright.async_api import async_playwright
# vb.py design.json [labels...|all]   close-up of each corner block, looking along its joint, with whatever stands between the camera and the block hidden.
# env SET=json settings override, DIST=inches, DSF, OUT=prefix, MAX=n
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory='render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    D=json.load(open(sys.argv[1]));D.setdefault('S',{}).update({"secOn":False,"look":"color"})
    if os.environ.get('SET'):D['S'].update(json.loads(os.environ['SET']))
    want=sys.argv[2:];pre=os.environ.get('OUT','b_')
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850},device_scale_factor=int(os.environ.get('DSF','1')));errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(1000)
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(3500)
        await pg.keyboard.press('Escape');await pg.mouse.move(840,450);await pg.mouse.move(150,300)
        labs=await pg.evaluate("()=>__lp().filter(p=>p.kind==='cleat'&&p.part&&p.part.length).map(p=>[p.label,p.joint,p.sub||'',!!(p.cleat&&p.cleat.rfx)])")
        print('blocks:',' '.join(f"{l}[{j}{'/in' if x else ''}{'/rib' if s else ''}]" for l,j,s,x in labs))
        pick=[l for l,_,_,_ in labs] if (not want or want==['all']) else want
        pick=pick[:int(os.environ.get('MAX','99'))]
        for L in pick:
            for sgn in ([1,-1] if os.environ.get('BOTH') else [1]):
                r=await pg.evaluate("""([L,dist,sgn])=>{const lp=__lp(),p=lp.find(x=>x.label===L);if(!p)return null;const V3=p.frame.O.constructor;let cx=0,cy=0,n=0;for(const ct of p.part)for(const q of ct){cx+=q[0];cy+=q[1];n++}
                  const C=p.frame.O.clone().addScaledVector(p.frame.u,cx/n).addScaledVector(p.frame.v,cy/n),cam=C.clone().addScaledVector(p.frame.n,sgn*dist).addScaledVector(p.frame.u,dist*.25).addScaledVector(p.frame.v,dist*.25);
                  const nm=L.replace(/[JK]\d+$/,''),own=new Set((p.joint||'').split('>').map(z=>{const m=/^(\d+)[A-Z]+$/.exec(z);return m?nm+m[1]:z}));const H=new Set();for(const q of lp){if(q===p||!q.frame||!q.part||!q.part.length)continue;if(q.kind==='cleat'||own.has(q.label))continue;
                    /* hide plates the sight line passes through */
                    for(const tt of [0,.15,-.15]){const A=cam.clone().addScaledVector(p.frame.u,tt*dist),d=C.clone().sub(A),den=q.frame.n.dot(d);if(Math.abs(den)<1e-6)continue;const s=q.frame.n.dot(q.frame.O.clone().sub(A))/den;if(s<=0.02||s>=.97)continue;
                      const X=A.clone().addScaledVector(d,s).sub(q.frame.O),x=X.dot(q.frame.u),y=X.dot(q.frame.v);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const ct of q.part)for(const w of ct){x0=Math.min(x0,w[0]);x1=Math.max(x1,w[0]);y0=Math.min(y0,w[1]);y1=Math.max(y1,w[1])}
                      if(x>x0-1&&x<x1+1&&y>y0-1&&y<y1+1)H.add(q.label)}}
                  __scene.traverse(o=>{if(o.userData&&o.userData.panel!=null)o.visible=!H.has(o.userData.panel)});
                  const cw=cam.clone(),tw=C.clone();__world.localToWorld(cw);__world.localToWorld(tw);__cam.position.copy(cw);__orbit.target.copy(tw);__orbit.update();return [p.joint,[...H].join(' ')]}""",[L,float(os.environ.get('DIST','16')),sgn])
                await pg.wait_for_timeout(700)
                fn=f"{pre}{L}{'b' if sgn<0 else ''}.png";await pg.screenshot(path=fn,clip={'x':380,'y':100,'width':920,'height':720});print(fn,r)
        if errs:print(errs)
        await b.close()
    srv.shutdown()
asyncio.run(main())
