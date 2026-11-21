import asyncio,http.server,threading,functools,sys,json
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:400]))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{localStorage.clear()}");await pg.reload();await pg.wait_for_timeout(2500)
        print(await pg.evaluate("""()=>{const T=__xp.THREE,F=__fig.figNew({p:[0,0,60],h:69,pose:'stand'});const out=[];
          const sh=F.J.rSh.getWorldPosition(new T.Vector3()),hp=F.J.rHip.getWorldPosition(new T.Vector3());
          const tests=[['hand-r',[sh.x,sh.y,sh.z+20],'front'],['hand-r',[sh.x,sh.y+20,sh.z],'up'],['hand-r',[sh.x-20,sh.y,sh.z],'side out'],['hand-r',[sh.x,sh.y-10,sh.z+10],'low front'],['hand-r',[sh.x+5,sh.y-5,sh.z+12],'across'],
            ['foot-r',[hp.x,hp.y-30,hp.z+20],'kick fwd'],['foot-r',[hp.x,hp.y-20,hp.z-25],'back'],['foot-r',[hp.x-15,hp.y-28,hp.z],'out'],['hand-r',[sh.x,sh.y+40,sh.z],'too far up']];
          for(const [part,t,nm] of tests){__fig.figSetPose(F,'stand');const Tm=new T.Vector3(...t);__fig.figIK(F,part,Tm);F.g.updateMatrixWorld(true);const h=F.handles[part].getWorldPosition(new T.Vector3());
            const k=part.startsWith('hand')?'rSh':'rHip',m=part.startsWith('hand')?'rEl':'rKn';out.push(nm.padEnd(10)+' err '+h.distanceTo(Tm).toFixed(2)+' '+k+' '+F.ang[k].map(x=>x.toFixed(0))+' '+m+' '+F.ang[m].toFixed(0))}
          return out.join('\\n')}"""))
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
