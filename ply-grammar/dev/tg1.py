"""Together test: two pages in one stand-in room (BroadcastChannel standing in for the artifact `room`).
A = computer with a saved design, B = phone, fresh. Then a stand-in headset peer is added for B to watch, and A is put in
headset mode to check the frustum, the phone preview and the wrist-menu row + keypad."""
import os,asyncio,http.server,threading,functools,sys,json,base64
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
ROOM="""(()=>{const me=Math.random().toString(36).slice(2,8),subs={},others=new Map();let mine={},big=0;
 const out=m=>{try{window.__relayOut(JSON.stringify(m))}catch(e){}};
 const snap=()=>[{peer:me,isMe:true,sameTab:true,presence:mine}].concat([...others].map(([p,q])=>({peer:p,isMe:true,sameTab:false,presence:q})));let S=snap();
 const recv=m=>{if(m.t==='e')(subs[m.topic]||[]).forEach(f=>f({topic:m.topic,data:m.data,peer:m.from,isMe:true,sameTab:false}));else if(m.t==='p'){others.set(m.from,m.p);S=snap()}else if(m.t==='hello')out({t:'p',from:me,p:mine})};
 const room={emit(t,d){const s=JSON.stringify(d);if(s.length>4096)big++;window.__sent=(window.__sent||0)+1;out({t:'e',topic:t,data:JSON.parse(s),from:me});return Promise.resolve()},on(t,f){(subs[t]=subs[t]||[]).push(f);return()=>{}},
   presence(p){mine=Object.assign({},mine,p);if(JSON.stringify(mine).length>4096)big++;S=snap();out({t:'p',from:me,p:mine});return Promise.resolve()},peers:()=>S,
   inject(id,p){if(p)others.set(id,p);else others.delete(id);S=snap()},big:()=>big,recv};
 window.__room=room;window.claude={use:n=>Promise.resolve(n==='room'?room:null)};setTimeout(()=>out({t:'hello'}),300)})();"""
HS="""(o)=>{const q=(x,y,z)=>{const e=new __xp.THREE.Euler(x,y,z),Q=new __xp.THREE.Quaternion().setFromEuler(e);return [Q.x,Q.y,Q.z,Q.w]};
 const pose=(p,r)=>p.concat(q(...r));const S=o.s||.0254,W=o.W||[0,0,-1.6];
 return {v:1,r:'xr',dv:'quest',st:o.st||[0,''],vw:o.vw||'panels',as:null,c:null,h:pose(o.h||[.0,1.55,-.2],[-.35,.15,0]),w:W.concat([0,0,0,1,S]),
  L:{g:pose([-.22,1.15,-.55],[-.6,.3,0]),a:pose([-.22,1.17,-.57],[-.9,.3,0]),b:[0,0,0,0,0],ln:0,f:0,pf:['meta-quest-touch-plus']},
  R:{g:pose([.2,1.2,-.6],[-.5,-.2,0]),a:pose([.2,1.22,-.62],[-.7,-.2,0]),b:[1,0,2,0,0],ln:.9,f:1,pf:['meta-quest-touch-plus']},
  m:{on:1,x:'Panels view. Tap a joint to change it, or pull a face or an edge to reshape.',t:'push',s:'',h:-1},ls:o.ls||null}}"""
SIG="()=>__blocks.map(b=>b.name+':'+b.pivot.position.toArray().map(x=>Math.round(x)).join(',')+':'+b.sizer.scale.toArray().map(x=>Math.round(x)).join('x')).join(' ')"
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pages={}
        async def mk(name,vp,mobile=False,design=None):
            ctx=await b.new_context(viewport=vp,is_mobile=mobile,has_touch=mobile,device_scale_factor=2 if mobile else 1)
            pg=await ctx.new_page();pages[name]=pg
            async def relay(m,name=name):
                for k,o in pages.items():
                    if k!=name:
                        try:await o.evaluate("m=>window.__room&&__room.recv(JSON.parse(m))",m)
                        except Exception as e:pass
            await pg.expose_function('__relayOut',relay)
            pg.on('pageerror',lambda e:errs.append(name+':'+str(e)[:300]))
            await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(400)
            await pg.evaluate("d=>{localStorage.clear();if(d)localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",design)
            await ctx.add_init_script(ROOM);await pg.reload();await pg.wait_for_timeout(2500);return pg
        errs=[]
        D=json.load(open(SP+'d_user5.json'))
        A=await mk('A',{'width':1300,'height':850},False,D)
        Bp=await mk('B',{'width':390,'height':844},True,None)
        await A.wait_for_timeout(3000)
        print('1 join: A',await A.evaluate(SIG));print('       B',await Bp.evaluate(SIG))
        print('   dbg A',await A.evaluate("()=>({peers:__room.peers().length,room:!!__net.NET.room,q:__net.NET.queue.length,sent:window.__sent||0,pres:Object.keys(__room.peers()[0].presence||{})})"))
        print('   dbg B',await Bp.evaluate("()=>({peers:__room.peers().map(p=>p.presence&&p.presence.st),room:!!__net.NET.room,q:__net.NET.queue.length,sent:window.__sent||0,pend:!!__net.NET.pending,inbox:__net.NET.inbox.size})"))
        print('   stamps',await A.evaluate("()=>__net.NET.st"),await Bp.evaluate("()=>__net.NET.st"))
        # 2. A edits: box A moves 6 in
        await A.evaluate("()=>{const b=__blocks[0];b.pivot.position.x+=6;__net.updateMass(b);__net.save()}");await A.wait_for_timeout(2500)
        print('2 A edit: B',await Bp.evaluate(SIG),'undo list',await Bp.evaluate("()=>document.querySelector('#undoBtn').disabled"))
        # 3. B edits back
        await Bp.evaluate("()=>{const b=__blocks[0];b.sizer.scale.y=30;__net.updateMass(b);__net.save()}");await Bp.wait_for_timeout(2500)
        print('3 B edit: A',await A.evaluate(SIG))
        # 4. a drag on A: B sees it move before the drag ends
        await A.evaluate("()=>{window.__fakeDrag=true;__tc.dragging=true}")
        for k in range(4):
            await A.evaluate("()=>{const b=__blocks[0];b.pivot.position.z+=3;__net.updateMass(b)}");await A.wait_for_timeout(400)
        print('4 mid-drag: B',await Bp.evaluate(SIG),'live',await Bp.evaluate("()=>__net.NET.livePrev"))
        await A.evaluate("()=>{__tc.dragging=false;__net.save()}");await A.wait_for_timeout(2500)
        print('  after drag: B',await Bp.evaluate(SIG),'live',await Bp.evaluate("()=>__net.NET.livePrev"),'A',await A.evaluate(SIG))
        # 5. undo on A goes to B
        await A.evaluate("()=>__xp.undo()");await A.wait_for_timeout(2500)
        print('5 undo A:',await A.evaluate(SIG),'B',await Bp.evaluate(SIG))
        print('  sizes over 4KiB:',await A.evaluate("()=>__room.big()"),await Bp.evaluate("()=>__room.big()"))
        # 6. a stand-in headset joins: B watches it
        await Bp.evaluate("hs=>__room.inject('hs1',("+HS+")({vw:'panels',st:__net.NET.st?[__net.NET.st.t,__net.NET.st.by]:[0,'']}))",None) if False else None
        await Bp.evaluate("()=>{const f="+HS+";window.__hsp=f({vw:'panels',st:[__net.NET.st.t,__net.NET.st.by]});__room.inject('hs1',__hsp)}")
        await Bp.wait_for_timeout(3500)
        print('6 watching:',await Bp.evaluate("()=>({spect:!!__net.NET.spect,view:__net.view,menu:__sk.menu.visible,pill:!document.querySelector('#tgPill').hidden})"))
        await Bp.screenshot(path=SP+'tg_b_third.png')
        await Bp.evaluate("()=>{document.querySelector('.app').classList.add('collapsed');window.dispatchEvent(new Event('resize'));__cam.position.set(160,140,260);__orbit.target.set(0,30,20);__orbit.update()}");await Bp.wait_for_timeout(900)
        await Bp.screenshot(path=SP+'tg_b_wide.png')
        print('  objs',await Bp.evaluate("()=>{const so=__net.NET.so,P=new __xp.THREE.Vector3();so.hs.updateMatrixWorld(true);const w=o=>o.getWorldPosition(P).toArray().map(x=>Math.round(x));return {head:w(so.head),hv:so.head.visible,L:w(so.hands.left.grip),menu:w(__sk.menu),mv:__sk.menu.visible,mp:__sk.menu.parent===so.hands.left.grip,hs:so.hs.visible}}"))
        for m in ['first','split']:
            await Bp.evaluate("m=>__net.tgSetMode(m)",m);await Bp.wait_for_timeout(900);await Bp.screenshot(path=SP+'tg_b_'+m+'.png')
        await Bp.evaluate("()=>__net.tgSetMode('third')")
        if os.environ.get('PV'):
            await Bp.evaluate("()=>{const f="+HS+";const q=f({vw:'panels',st:[__net.NET.st.t,__net.NET.st.by],h:[.05,1.5,.25]});const T=__xp.THREE,e=new T.Quaternion().setFromEuler(new T.Euler(.35,.35,0));q.L.g=[-.2,1.12,-.15,e.x,e.y,e.z,e.w];q.L.a=[-.2,1.14,-.17,e.x,e.y,e.z,e.w];q.m.x='Panels view. Tap a joint to change it, or pull a face or an edge to reshape.';__room.inject('hs1',q)}")
            await Bp.evaluate("()=>{document.querySelector('.app').classList.add('collapsed');window.dispatchEvent(new Event('resize'));__cam.position.set(-30,120,190);__orbit.target.set(0,22,-10);__orbit.update()}");await Bp.wait_for_timeout(1500)
            await Bp.screenshot(path=SP+'pv_third.png')
            await Bp.evaluate("()=>__net.tgSetMode('split')");await Bp.wait_for_timeout(1200);await Bp.screenshot(path=SP+'pv_split.png');await Bp.evaluate("()=>__net.tgSetMode('third')")
        # B opens the Together tab
        await Bp.evaluate("()=>document.querySelector('.tab[data-tab=together]').click()");await Bp.wait_for_timeout(700);await Bp.screenshot(path=SP+'tg_b_tab.png')
        await Bp.evaluate("()=>document.querySelector('.tab[data-tab=together]').click()")
        # the headset switches to Build: B follows
        await Bp.evaluate("()=>{__hsp={...__hsp,vw:'build',as:['A',3]};__room.inject('hs1',__hsp)}");await Bp.wait_for_timeout(2500)
        print('  follows build:',await Bp.evaluate("()=>({view:__net.view,step:__xp.AS.step})"))
        await Bp.evaluate("()=>{__room.inject('hs1',null)}");await Bp.wait_for_timeout(800)
        print('  headset left:',await Bp.evaluate("()=>({spect:!!__net.NET.spect,menu:__sk.menu.visible,pill:!document.querySelector('#tgPill').hidden})"))
        # 7. A as the headset: frustum for B, phone preview, wrist menu row and keypad
        await A.evaluate("()=>{__sk.setXR('vr');__world.scale.setScalar(.0254);__world.position.set(0,0,-1.6);__world.updateMatrixWorld(true);__sk.menu.visible=true;__xp.floorStep(false)}")
        await A.wait_for_timeout(1500)
        print('7 headset A:',await A.evaluate("()=>({fr:__net.NET.fr.size,flats:__net.NET.flats.length})"))
        d=await A.evaluate("()=>{__xp.drawMenu();return __xp.menuCv.toDataURL('image/png')}");open(SP+'tg_menu.png','wb').write(base64.b64decode(d.split(',')[1]))
        await A.evaluate("()=>{__xp.XR.step='room';__net.NET.typed='48';__xp.drawMenu()}")
        d=await A.evaluate("()=>__xp.menuCv.toDataURL('image/png')");open(SP+'tg_keypad.png','wb').write(base64.b64decode(d.split(',')[1]))
        await A.evaluate("()=>{__xp.XR.step=null;__xp.drawMenu()}")
        print('  B presence sent to A has camera:',await A.evaluate("()=>!!__net.NET.flats[0].presence.c"))
        print('errs',errs[:6]);print('done')
        await b.close()
    srv.shutdown()
asyncio.run(main())
