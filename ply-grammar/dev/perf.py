import asyncio,http.server,threading,functools,sys,json,os
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    D=json.load(open(SP+sys.argv[1]))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850})
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(4000)
        for scr in (os.environ.get('MODES') or 'base').split(','):
            r=await pg.evaluate("""m=>{if(window.__setLook)window.__setLook(m);const R=__renderer;R.info.autoReset=false;R.info.reset();R.render(__xp.scene||__scene,__cam);const i=R.info.render;
              let meshes=0,lines=0,tris=0,mats=new Set();(__xp.scene||__scene).traverse(o=>{if(o.visible===false)return;if(o.isMesh){meshes++;mats.add(o.material)}if(o.isLine)lines++});
              return JSON.stringify({mode:m,calls:i.calls,tris:i.triangles,lines:i.lines,meshes,lineObjs:lines,mats:mats.size,perf:window.__PERF||null})}""",scr)
            print(r)
        await b.close()
    srv.shutdown()
asyncio.run(main())
