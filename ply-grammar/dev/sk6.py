import asyncio,http.server,threading,functools,sys,json,base64
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
exec(open(SP+'sk2.py').read().split('async def main')[0].split("SP=")[1].split('\n',1)[1])
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:400]))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{localStorage.clear()}");await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate(JS)
        # an Edgewise sketch in metres: a ramp 0.9 x 0.4 x 0.6 and a loose line, made with the Edgewise core itself
        await pg.evaluate("""()=>{const E=__sk.EW,sk=E.emptySketch();let X={};const L=(a,b)=>{const pts=[];for(let i=0;i<=10;i++)pts.push(a.map((x,k)=>x+(b[k]-x)*i/10+Math.sin(i*3+k)*.004));E.addStroke(sk,pts,X,{snapR:.04});X=E.build(sk,{square:true,squareDeg:10,floor:true,floorR:.05,flat:1,minTol:.015,rel:.18,iters:60,warm:X}).X};
          const w=.9,h=.4,d=.6,P=[[0,0,0],[w,0,0],[0,h,0],[0,0,d],[w,0,d],[0,h,d]];for(const [i,j] of [[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[0,3],[1,4],[2,5]])L(P[i],P[j]);L([1.3,0,0],[1.3,.5,0]);
          localStorage.setItem('edgewise:sketch',JSON.stringify(sk));localStorage.setItem('edgewise:lib',JSON.stringify([{name:'Nov 14 · ramp',sk}]))}""")
        await pg.evaluate("()=>document.querySelector('[data-tab=model],#tab-model')?.click()");await pg.wait_for_timeout(300)
        vis=await pg.evaluate("()=>{__sk.select(null);const r=document.querySelector('#ewRow');return [r.hidden,r.offsetParent!==null]}");print('row',vis)
        await pg.evaluate("()=>document.querySelector('#ewBtn').click()");await pg.wait_for_timeout(300)
        items=await pg.evaluate("()=>[...document.querySelectorAll('#ctx button, #ctx .ci, #ctx [role=menuitem]')].map(x=>x.textContent)");print('menu',items)
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('#ctx *')].find(x=>x.textContent==='On the Edgewise table now'&&x.children.length===0);b.click()}");await pg.wait_for_timeout(2500)
        print('after',await pg.evaluate("info()"));await pg.mouse.move(5,5);await pg.wait_for_timeout(500);await pg.screenshot(path=SP+'sk6.png')
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
