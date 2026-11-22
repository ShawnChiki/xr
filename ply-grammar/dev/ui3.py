import asyncio,http.server,threading,functools,sys,json,base64
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':900});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:300]));pg.on('console',lambda m:print('CON',m.type,m.text[:300]) if m.type in('error','warning') and 'GL' not in m.text and 'GPU' not in m.text else None)
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{localStorage.clear()}");await pg.reload();await pg.wait_for_timeout(2500)
        for t in ['model','joints']:
            await pg.evaluate("t=>document.querySelector('.tab[data-tab='+t+']').click()",t);await pg.wait_for_timeout(300);await pg.screenshot(path=SP+'ui3_'+t+'.png',clip={'x':0,'y':0,'width':400,'height':900})
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(4000)
        print('joints',await pg.evaluate("()=>[__blocks.length,(__blocks[0].joints||[]).map(j=>j.joint).join(','),__xp.getPanels().length]"),errs)
        pos=await pg.evaluate("()=>{const b=__blocks[0],j=b.joints.filter(j=>j.joint==='fingers').sort((p,q)=>q.a.y+q.b.y+q.a.z+q.b.z-(p.a.y+p.b.y+p.a.z+p.b.z))[0],m=j.a.clone().add(j.b).multiplyScalar(.5);const v=__world.localToWorld(m).project(__cam),r=document.querySelector('canvas').getBoundingClientRect();return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height,j.label,j.key]}")
        await pg.mouse.click(pos[0],pos[1]);await pg.wait_for_timeout(500)
        items=await pg.evaluate("()=>[document.querySelector('#ctx').hidden,document.querySelector('#ctx .ct')?.textContent,...[...document.querySelectorAll('#ctx button')].map(x=>x.textContent)]");print(pos[2],items)
        await pg.screenshot(path=SP+'ui3_joint.png',clip={'x':max(0,pos[0]-250),'y':max(0,pos[1]-150),'width':600,'height':450})
        await pg.evaluate("()=>[...document.querySelectorAll('#ctx button')].find(x=>x.textContent.includes('Meet')).click()");await pg.wait_for_timeout(2500)
        print('now',await pg.evaluate("k=>{const b=__blocks[0];return [JSON.stringify(b.edgeOpts[k]),b.joints.find(j=>j.key===k).joint]}",pos[3]))
        print(errs);await b.close()
    srv.shutdown()
asyncio.run(main())
