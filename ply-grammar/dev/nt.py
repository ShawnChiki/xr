import asyncio,http.server,threading,functools,sys,json
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/f3d32ac7-29d5-57b3-96d3-496098c93dbf/scratchpad/'
MOCK="""window.__db={};window.__sets=0;window.claude={use:async n=>n==='db'?{doc:p=>({get:async()=>({exists:p in window.__db,data:()=>window.__db[p]}),set:async d=>{window.__sets++;window.__db[p]=JSON.parse(JSON.stringify(d));try{sessionStorage.setItem('mockdb',JSON.stringify(window.__db))}catch(e){}}})}:null};try{Object.assign(window.__db,JSON.parse(sessionStorage.getItem('mockdb')||'{}'))}catch(e){}"""
async def main():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a):pass
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Q,directory=SP+'render'));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
    D=json.load(open(SP+'d_u1.json'))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1300,'height':850});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));await pg.add_init_script(MOCK)
        await pg.goto(f'http://127.0.0.1:{port}/index.html');await pg.wait_for_timeout(1000)
        await pg.evaluate("d=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('plyGrammar.v2',JSON.stringify(d))}",D);await pg.reload();await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(5000)
        st=lambda:pg.evaluate("[__xp.getNotes().map(n=>[n.text,n.panel,n.p]),window.__sets,window.__db['claude/design']&&JSON.parse(window.__db['claude/design'].json).notes?.length,document.querySelector('#cloudLine').textContent]")
        print('load',await st())
        await pg.click('#noteBtn');await pg.wait_for_timeout(200);await pg.mouse.click(760,380);await pg.wait_for_timeout(300)
        print('pop',await pg.evaluate("[document.querySelector('#notePop').hidden,document.querySelector('#npHead').textContent]"))
        await pg.keyboard.type('fix this corner, spike sticks out');await pg.keyboard.press('Enter');await pg.wait_for_timeout(7000);print('saved',await st(),errs,await pg.evaluate('__xp.dbg()'))
        # right-click note
        await pg.mouse.click(900,430,button='right');await pg.wait_for_timeout(300);print('ctx',await pg.evaluate("[document.querySelector('#ctx').hidden,[...document.querySelectorAll('#ctx button')].map(b=>b.textContent)]"),errs);await pg.evaluate("[...document.querySelectorAll('#ctx button')].find(b=>/Pin a note/.test(b.textContent)).click()");await pg.wait_for_timeout(300)
        print('pop2',await pg.evaluate("[document.querySelector('#notePop').hidden,document.activeElement.id,document.querySelector('#npHead').textContent]"));await pg.keyboard.type('screws too tight here');print('typed',await pg.evaluate("[document.querySelector('#npText').value,document.querySelector('#notePop').hidden]"));await pg.click('#npSave');await pg.wait_for_timeout(7000);print('second',await st())
        await pg.click('#explodeBtn');await pg.wait_for_timeout(1500);await pg.screenshot(path=SP+'nt1.png');await pg.click('#explodeBtn');await pg.wait_for_timeout(1200)
        # reply from Claude shows after reload; notes persist; no extra write on load
        await pg.evaluate("window.__db['claude/replies']={[__xp.getNotes()[0].id]:{text:'Fixed in v1.17',at:'x'}};sessionStorage.setItem('mockdb',JSON.stringify(window.__db))")
        n0=await pg.evaluate("window.__sets");await pg.reload();await pg.wait_for_timeout(2500);await pg.evaluate("document.querySelector('[data-view=panels]').click()");await pg.wait_for_timeout(4500)
        print('reload',await st(),'(sets before reload',n0,')')
        # click the first pin
        xy=await pg.evaluate("""()=>{const {THREE,camera,world}=__xp,r=document.querySelector('canvas').getBoundingClientRect(),P=new THREE.Vector3(...__xp.getNotes()[0].p);world.localToWorld(P);P.project(camera);return [r.left+(P.x+1)/2*r.width,r.top+(1-P.y)/2*r.height]}""")
        await pg.mouse.click(*xy);await pg.wait_for_timeout(300);print('pin click',await pg.evaluate("[document.querySelector('#notePop').hidden,document.querySelector('#npHead').textContent,document.querySelector('#npText').value,document.querySelector('#npReply').textContent]"))
        await pg.screenshot(path=SP+'nt2.png')
        await pg.click('#npDel');await pg.wait_for_timeout(7000);print('deleted',await st())
        await pg.keyboard.press('Control+z');await pg.wait_for_timeout(7000);print('undo',await st())
        print('errors',errs);await b.close()
    srv.shutdown()
asyncio.run(main())
