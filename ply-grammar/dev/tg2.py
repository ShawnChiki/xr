"""Together over PeerJS: the real GitHub copy (password gate, turn-config.js) on two devices in room 4821, with a local
PeerJS server standing in for the public one. CDN files are served from local copies."""
import asyncio,http.server,threading,functools,sys,json,subprocess,os,time
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
NM=SP+'node_modules/'
PW='99f7855eb789dfecf9ea66df3221a743f4ab8be59ae6b9c503499c1940a90fd5'
srvjs="const {ExpressPeerServer}=require('peer'),express=require('express'),app=express(),http=require('http').createServer(app);app.use('/',ExpressPeerServer(http,{path:'/'}));http.listen(9077,'127.0.0.1',()=>console.log('up'))"
async def main():
    ps=subprocess.Popen(['node','-e',srvjs],cwd=SP,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);time.sleep(1.5)
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory='/home/claude/xr'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    peerjs=open(NM+'peerjs/dist/peerjs.min.js').read()+"\n;(()=>{const P=window.Peer;window.Peer=class extends P{constructor(id,o){if(id&&typeof id==='object'){o=id;id=undefined}super(id,Object.assign({host:'127.0.0.1',port:9077,path:'/',secure:false},o||{}))}}})();"
    async def routes(ctx):
        async def r3(route):
            u=route.request.url
            if 'peerjs' in u:return await route.fulfill(body=peerjs,content_type='application/javascript')
            if 'clipper-lib' in u:return await route.fulfill(path=SP+'render/clipper-lib/clipper.js',content_type='application/javascript')
            if 'three@0.160.0' in u:
                rel=u.split('three@0.160.0/')[1]
                return await route.fulfill(path=SP+'render/three/'+rel,content_type='application/javascript')
            if 'fonts.g' in u:return await route.fulfill(body='',content_type='text/css')
            return await route.abort()
        await ctx.route('https://**/*',r3)
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        errs=[];pages={}
        async def mk(name,vp,mobile,design):
            ctx=await b.new_context(viewport=vp,is_mobile=mobile,has_touch=mobile);await routes(ctx)
            pg=await ctx.new_page();pages[name]=pg;pg.on('pageerror',lambda e:errs.append(name+':'+str(e)[:300]));pg.on('requestfailed',lambda r:errs.append(name+'F:'+r.url[:150]));pg.on('console',lambda m:errs.append(name+'C:'+m.text[:200]) if 'GL Driver' not in m.text else None)
            await pg.goto(f'http://127.0.0.1:{port}/ply-grammar/#4821');await pg.wait_for_timeout(500)
            await pg.evaluate("([d,pw])=>{localStorage.clear();localStorage.setItem('pgUnlock',pw);if(d)localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",[design,PW])
            await pg.reload();await pg.wait_for_timeout(3000);return pg
        D=json.load(open(SP+'d_user5.json'))
        A=await mk('A',{'width':1300,'height':850},False,D)
        B=await mk('B',{'width':390,'height':844},True,None)
        await A.wait_for_timeout(9000)
        st=lambda pg:pg.evaluate("()=>({stat:document.querySelector('#tgStat').textContent,room:document.querySelector('#tgRoom').value,list:[...document.querySelectorAll('#tgList .tgdev')].map(d=>d.textContent)})")
        print('A',await st(A));print('B',await st(B))
        sig="()=>{const d=JSON.parse(localStorage.getItem('plyGrammar.v2')||'{}');return (d.blocks||[]).map(b=>b.name+':'+b.p.map(Math.round)+':'+b.s.map(Math.round)).join(' ')}"
        print('design A',await A.evaluate(sig),'| B',await B.evaluate(sig))
        print('peer',await A.evaluate("()=>new Promise(res=>{const p=new window.Peer('probe-'+Math.random().toString(36).slice(2,6));p.on('open',id=>res('open '+id));p.on('error',e=>res('err '+e.type+' '+e.message));setTimeout(()=>res('timeout'),5000)})"))
        print('srv',ps.stdout.read1(2000) if hasattr(ps.stdout,'read1') else '');print('turn-config on',await A.evaluate("()=>!!window.CHIKI_TURN&&!!window.__chikiNativePC"))
        print('errs',errs[:5])
        await b.close()
    srv.shutdown();ps.kill()
asyncio.run(main())
