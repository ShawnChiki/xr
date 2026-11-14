import asyncio,http.server,threading,functools,sys,json,os
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
PROJ="""(P3)=>{const {THREE,camera,world}=__xp,r=document.querySelector('canvas').getBoundingClientRect(),P=new THREE.Vector3(...P3);world.localToWorld(P);P.project(camera);return [r.left+(P.x+1)/2*r.width,r.top+(1-P.y)/2*r.height]}"""
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    D=json.load(open(SP+'d_u1.json'))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(1000)
        await pg.evaluate("d=>{localStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(2500)
        bar=lambda:pg.evaluate("[...document.querySelectorAll('#panelBar button')].filter(b=>!b.hidden).map(b=>b.textContent.trim())")
        cam=lambda c,t:pg.evaluate("([c,t])=>{__cam.position.set(...c);__orbit.target.set(...t);__orbit.update()}",[c,t])
        # ---- 1 multi-select + isolate
        await cam([60,60,75],[0,8,5]);await pg.wait_for_timeout(400)
        cen=await pg.evaluate("""()=>{const out={};for(const l of ['A9','A10','A8']){const p=__xp.getPanels().find(p=>p.label===l||p.label===l+'-1');if(!p)continue;const c=p.part[0],x=c.reduce((s,q)=>s+q[0],0)/c.length,y=c.reduce((s,q)=>s+q[1],0)/c.length,{O,u,v}=p.frame;out[l]=O.clone().addScaledVector(u,x).addScaledVector(v,y).toArray()}return out}""")
        pts={k:await pg.evaluate(PROJ,v) for k,v in cen.items()};print('centres',{k:[round(a) for a in v] for k,v in pts.items()})
        await pg.mouse.click(*pts['A10']);await pg.wait_for_timeout(300);print('click',await pg.evaluate("__xp.getSel()"))
        await pg.keyboard.down('Shift');await pg.mouse.click(*pts['A8']);await pg.keyboard.up('Shift');await pg.wait_for_timeout(300);print('shift',await pg.evaluate("__xp.getSel()"),await bar())
        await pg.keyboard.press('i');await pg.wait_for_timeout(1500);print('isolated: hidden',await pg.evaluate("[__xp.hidden.size,__xp.getPanels().length]"))
        await pg.screenshot(path=SP+'ui_iso.png');await pg.evaluate("document.querySelector('#showAllBtn').click()");await pg.wait_for_timeout(1500)
        # ---- 2 right-click menu on a panel
        await pg.mouse.click(*pts['A10'],button='right');await pg.wait_for_timeout(300)
        print('ctx panel',await pg.evaluate("[document.querySelector('#ctx').hidden,[...document.querySelectorAll('#ctx button')].map(b=>b.textContent)]"))
        await pg.screenshot(path=SP+'ui_ctx.png');await pg.keyboard.press('Escape');await pg.wait_for_timeout(200)
        # ---- 3 screws: add (snap / refuse), guides
        await pg.click('#screwBtn');await pg.wait_for_timeout(1200);await pg.click('#scAdd');await pg.wait_for_timeout(1200)
        N="()=>{const b=__xp.blocks[0];return [b._res.screws.filter(s=>!s.dropped).length,(b.screwEdit?.add||[]).length,(b.screwEdit?.del||[]).length]}"
        print('start',await pg.evaluate(N),'guide segs',await pg.evaluate("__world.children.filter(o=>o.isLineSegments).map(o=>o.geometry.attributes.position.count/2)"))
        await pg.screenshot(path=SP+'ui_guides.png')
        tg=await pg.evaluate("""()=>{const p=__xp.getPanels().find(p=>p.label==='A10'),T=__xp.scTargets(p),{O,u,v}=p.frame,P=q=>O.clone().addScaledVector(u,q[0]).addScaledVector(v,q[1]).toArray();
          // a spot 4 in from every line, and one right by a line
          let far=null;const c=p.part[0];for(let i=0;i<4000&&!far;i++){const x=Math.min(...c.map(q=>q[0]))+Math.random()*(Math.max(...c.map(q=>q[0]))-Math.min(...c.map(q=>q[0]))),y=Math.min(...c.map(q=>q[1]))+Math.random()*(Math.max(...c.map(q=>q[1]))-Math.min(...c.map(q=>q[1])));
            const d=Math.min(...T.map(t=>{const dx=t.b[0]-t.a[0],dy=t.b[1]-t.a[1],l2=dx*dx+dy*dy,k=Math.max(0,Math.min(1,((x-t.a[0])*dx+(y-t.a[1])*dy)/l2));return Math.hypot(x-t.a[0]-dx*k,y-t.a[1]-dy*k)}));if(d>3.2)far=[x,y]}
          const t0=T.find(t=>/R/.test(t.into)&&Math.hypot(t.b[0]-t.a[0],t.b[1]-t.a[1])>4),scr=__xp.blocks[0]._res.screws.filter(s=>!s.dropped&&s.name==='A10').map(s=>{const d=s.p3.clone().sub(O);return [d.dot(u),d.dot(v)]});let m=null,bd=-1;for(let k=.1;k<=.9;k+=.02){const q=[t0.a[0]+(t0.b[0]-t0.a[0])*k,t0.a[1]+(t0.b[1]-t0.a[1])*k],d=Math.min(...scr.map(z=>Math.hypot(z[0]-q[0],z[1]-q[1])));if(d>bd){bd=d;m=[q[0]+.5,q[1]+.5]}};return {n:T.length,into:[...new Set(T.map(t=>t.into.replace(/[0-9]+/,'')))],far:far&&P(far),near:P(m),line:[P(t0.a),P(t0.b)]}}""")
        print('targets',tg['n'],tg['into'])
        if tg['far']:
            xy=await pg.evaluate(PROJ,tg['far']);await pg.mouse.click(*xy);await pg.wait_for_timeout(1200);print('add far ->',await pg.evaluate(N),await pg.evaluate("document.querySelector('#toast').textContent"))
        xy=await pg.evaluate(PROJ,tg['near']);await pg.mouse.click(*xy);await pg.wait_for_timeout(1500);print('add near ->',await pg.evaluate(N),await pg.evaluate("document.querySelector('#toast').textContent"))
        on=await pg.evaluate("""(L)=>{const b=__xp.blocks[0],a=b.screwEdit.add.at(-1).p,V=__xp.THREE.Vector3,A=new V(...L[0]),B=new V(...L[1]),P=new V(...a),d=B.clone().sub(A),t=P.clone().sub(A).dot(d)/d.lengthSq();return +P.distanceTo(A.addScaledVector(d,t)).toFixed(3)}""",tg['line']);print('  distance of new screw from the rib line',on)
        await pg.click('#scAdd');await pg.wait_for_timeout(500)
        # ---- 4 pick three screws on that rib, one fewer
        sc=await pg.evaluate("""(L)=>{const b=__xp.blocks[0],V=__xp.THREE.Vector3,A=new V(...L[0]),B=new V(...L[1]),d=B.clone().sub(A),out=[];for(const s of b._res.screws){if(s.dropped||s.name!=='A10')continue;const t=s.p3.clone().sub(A).dot(d)/d.lengthSq(),dd=s.p3.distanceTo(A.clone().addScaledVector(d,t));if(dd<.3&&t>-.6&&t<1.6)out.push(s.p3.toArray())}return out}""",tg['line'])
        print('screws on that line',len(sc))
        for i,P in enumerate(sc[:3]):
            xy=await pg.evaluate(PROJ,P)
            if i:await pg.keyboard.down('Shift')
            await pg.mouse.click(*xy)
            if i:await pg.keyboard.up('Shift')
            await pg.wait_for_timeout(300)
        print('picked',await pg.evaluate("__xp.getSel()"),await bar())
        if len(sc)>=2:
            await pg.click('#scFewer');await pg.wait_for_timeout(1500);print('one fewer ->',await pg.evaluate(N),await pg.evaluate("document.querySelector('#toast').textContent"))
        # right-click a screw
        s1=await pg.evaluate("()=>{const b=__xp.blocks[0];return b._res.screws.find(s=>!s.dropped&&s.name==='A10').p3.toArray()}");xy=await pg.evaluate(PROJ,s1);await pg.mouse.click(*xy,button='right');await pg.wait_for_timeout(300)
        print('ctx screw',await pg.evaluate("[...document.querySelectorAll('#ctx button')].map(b=>b.textContent)"));await pg.keyboard.press('Escape')
        await pg.click('#screwBtn');await pg.wait_for_timeout(800)
        # ---- 5 rib block: select, bar, drag
        await pg.evaluate("__xp.getPanels().filter(p=>p.kind==='face').forEach(p=>__xp.ghost.add(p.label));__xp.highlightPanel()");await cam([10,70,60],[-5,8,10]);await pg.wait_for_timeout(500)
        kb=await pg.evaluate("""()=>{const p=__xp.getPanels().find(p=>p.sub==='rib'&&p.cleat);if(!p)return null;const c=p.part[0],x=c.reduce((s,q)=>s+q[0],0)/c.length,y=c.reduce((s,q)=>s+q[1],0)/c.length,{O,u,v}=p.frame;return {l:p.label,P:O.clone().addScaledVector(u,x).addScaledVector(v,y).toArray(),e:p.cleat.e,x:p.cleat.x,key:p.cleat.key}}""")
        print('rib block',kb and (kb['l'],kb['key'],kb['x']))
        if kb:
            xy=await pg.evaluate(PROJ,kb['P']);await pg.mouse.click(*xy);await pg.wait_for_timeout(400);print(' sel',await pg.evaluate("__xp.getSel()"),await bar())
            x2=await pg.evaluate(PROJ,[kb['P'][i]+kb['e'][i]*3 for i in range(3)])
            await pg.mouse.move(*xy);await pg.mouse.down()
            for i in range(1,9):await pg.mouse.move(xy[0]+(x2[0]-xy[0])*i/8,xy[1]+(x2[1]-xy[1])*i/8);await pg.wait_for_timeout(60)
            await pg.mouse.up();await pg.wait_for_timeout(1500)
            print(' after drag',await pg.evaluate("(k)=>{const b=__xp.blocks[0];return [JSON.stringify(b.cleatEdit),__xp.getPanels().filter(p=>p.cleat?.key===k).map(p=>[p.label,+p.cleat.x.toFixed(2)])]}",kb['key']))
            await pg.screenshot(path=SP+'ui_blk.png')
            await pg.mouse.click(*x2,button='right');await pg.wait_for_timeout(300);print(' ctx block',await pg.evaluate("[...document.querySelectorAll('#ctx button')].map(b=>b.textContent)"));await pg.keyboard.press('Escape')
        await pg.evaluate("__xp.ghost.clear();__xp.highlightPanel()")
        # ---- 6 section turn
        await pg.click('#secBtn');await pg.wait_for_timeout(500);await pg.click('#secTurn');await pg.wait_for_timeout(300)
        print('sec mode',await pg.evaluate("[__xp.secTC.mode,__xp.secTC.showX,__xp.secTC.showY,__xp.secTC.showZ]"))
        await pg.evaluate("(()=>{const q=new __xp.THREE.Quaternion().setFromEuler(new __xp.THREE.Euler(0,.5,.25));__S.secQ=q.toArray();__xp.updateSection()})()");await cam([70,55,70],[0,8,0]);await pg.wait_for_timeout(600)
        await pg.screenshot(path=SP+'ui_sec.png');print('straighten shown',await pg.evaluate("!document.querySelector('#secStraight').hidden"))
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
