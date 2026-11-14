import asyncio,http.server,threading,functools,sys,json,os
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
PROJ="""(P3)=>{const {THREE,camera,world}=__xp,r=document.querySelector('canvas').getBoundingClientRect(),P=new THREE.Vector3(...P3);world.localToWorld(P);P.project(camera);return [r.left+(P.x+1)/2*r.width,r.top+(1-P.y)/2*r.height]}"""
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    D=json.load(open(SP+(sys.argv[1] if len(sys.argv)>1 else 'd_u1.json')))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(1000)
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(2500)
        bar=lambda:pg.evaluate("[...document.querySelectorAll('#panelBar button')].filter(b=>!b.hidden).map(b=>b.textContent.trim())")
        cam=lambda c,t:pg.evaluate("([c,t])=>{__cam.position.set(...c);__orbit.target.set(...t);__orbit.update()}",[c,t])
        await pg.evaluate("__xp.getPanels().filter(p=>p.kind==='face').forEach(p=>__xp.ghost.add(p.label));__xp.highlightPanel()")
        for sub in ['rib',None]:
            await pg.evaluate("(s)=>{__xp.getPanels().forEach(p=>{if(p.kind==='rib'){s?__xp.ghost.add(p.label):__xp.ghost.delete(p.label)}});__xp.highlightPanel()}",sub=='rib')
            kb=await pg.evaluate("""(sub)=>{const p=__xp.getPanels().find(p=>p.kind==='cleat'&&(p.sub||null)===sub&&p.cleat&&p.cleat.x>4&&p.cleat.x<p.cleat.L-8);if(!p)return null;const c=p.part[0],x=c.reduce((s,q)=>s+q[0],0)/c.length,y=c.reduce((s,q)=>s+q[1],0)/c.length,{O,u,v,n}=p.frame;return {l:p.label,P:O.clone().addScaledVector(u,x).addScaledVector(v,y).toArray(),n:n.toArray(),e:p.cleat.e,x:p.cleat.x,key:p.cleat.key,L:p.cleat.L}}""",sub)
            print(sub,'block',kb and (kb['l'],kb['key'],round(kb['x'],2),round(kb['L'],1)))
            if not kb:continue
            P=kb['P'];n=kb['n'];await cam([P[0]+n[0]*14+6,P[1]+n[1]*14+16,P[2]+n[2]*14+8],P);await pg.wait_for_timeout(500)
            xy=await pg.evaluate(PROJ,[P[i]+n[i]*.4 for i in range(3)]);await pg.mouse.click(*xy);await pg.wait_for_timeout(400);print(' sel',await pg.evaluate("__xp.getSel()"),await bar())
            await pg.screenshot(path=SP+'ui_blk_%s.png'%(sub or 'c'))
            x2=await pg.evaluate(PROJ,[P[i]+n[i]*.4+kb['e'][i]*3 for i in range(3)])
            await pg.mouse.move(*xy);await pg.mouse.down()
            for i in range(1,9):await pg.mouse.move(xy[0]+(x2[0]-xy[0])*i/8,xy[1]+(x2[1]-xy[1])*i/8);await pg.wait_for_timeout(60)
            await pg.mouse.up();await pg.wait_for_timeout(1800)
            print(' after drag',await pg.evaluate("(k)=>{const b=__xp.blocks[0];return [JSON.stringify(b.cleatEdit),__xp.getPanels().filter(p=>p.cleat?.key===k).map(p=>[p.label,+p.cleat.x.toFixed(2)])]}",kb['key']))
            await pg.mouse.click(*x2,button='right');await pg.wait_for_timeout(300);print(' ctx',await pg.evaluate("[document.querySelector('#ctx').hidden,document.querySelector('#ctx .ct')?.textContent,[...document.querySelectorAll('#ctx button')].map(b=>b.textContent)]"))
            await pg.evaluate("[...document.querySelectorAll('#ctx button')].find(b=>/Add a block/.test(b.textContent))?.click()");await pg.wait_for_timeout(1800)
            print(' after add',await pg.evaluate("(k)=>{const b=__xp.blocks[0];return [JSON.stringify(b.cleatEdit),__xp.getSel().selPanel]}",kb['key']))
            await pg.evaluate("document.querySelector('#ckDel').click()");await pg.wait_for_timeout(1800);print(' after delete',await pg.evaluate("JSON.stringify(__xp.blocks[0].cleatEdit)"))
            await pg.evaluate("document.querySelector('#ckReset').click()");await pg.wait_for_timeout(1800)
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
