
/* ---------------- together: a phone (or computer) and the headset in one room ----------------
   The same idea as Quadrille XR. Every device that has the page open in the same room shares one design: each change is
   stamped with when it was made and the newest change wins (an incoming design goes on the undo list like any edit). While
   something is being dragged, the design also goes out a few times a second so the others see it move.
   The headset also shares where its head and controllers are, its wrist menu, its view and its build step. A flat screen
   draws the headset and the real Quest controllers (with the button labels) in the model's own space, so they sit where they
   really are around the obstacle, at life size or tabletop, and it can look through the headset's eyes. The headset draws each
   flat screen's camera as an outline, and a small screen beside the wrist menu shows what the phone sees.
   In the Claude artifact devices meet through the artifact's `room`; on GitHub Pages by a 4-digit room number over PeerJS
   (turn-config.js adds the relay so different networks connect). Everything degrades to one device when neither is there. */
var NET=null;
const NET_CH=1200;                                     /* design text per message (the artifact room takes 4 KiB a message) */
function netHook(k,a){if(!NET)return;if(k==='saved')netSaved(a)}
const netHash=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)};
const netCmp=(a,b)=>a.t!==b.t?(a.t>b.t?1:-1):a.by===b.by?0:(a.by>b.by?1:-1);
const nr=(v,k=1e4)=>Math.round(v*k)/k;
const nClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const nOk=(a,n)=>Array.isArray(a)&&a.length>=n&&a.slice(0,n).every(v=>typeof v==='number'&&Number.isFinite(v));
const _nP=new V(),_nQ=new THREE.Quaternion(),_nS=new V(),_nM=new THREE.Matrix4();
function netPose(m,k=1e4){m.decompose(_nP,_nQ,_nS);return [nr(_nP.x,k),nr(_nP.y,k),nr(_nP.z,k),nr(_nQ.x),nr(_nQ.y),nr(_nQ.z),nr(_nQ.w)]}
function netSetPose(o,a,k){_nP.set(a[0],a[1],a[2]);_nQ.set(a[3],a[4],a[5],a[6]).normalize();if(k>=1){o.position.copy(_nP);o.quaternion.copy(_nQ)}else{o.position.lerp(_nP,k);o.quaternion.slerp(_nQ,k)}}
const IN_CLAUDE_ROOM=!window.PG_GATE&&!!window.claude?.use;
const netDev=(()=>{const ua=navigator.userAgent||'';if(/OculusBrowser|Quest/i.test(ua))return 'quest';return matchMedia('(pointer: coarse)').matches&&Math.min(screen.width,screen.height)<820?'phone':'computer'})();

/* one device claims the PeerJS id for the room number and relays between the others; if it leaves, someone else claims it
   (the same little interface as the artifact room: emit / on / presence / peers) */
function netPeerRoom(code,onStatus){
  const HOST='ply-grammar-'+code,me=NET.me,conns=new Map(),subs={},others=new Map();
  let peer=null,host=false,hostConn=null,mine={},snap=[],alive=true,retryT=0;
  const rebuild=()=>{snap=[{peer:me,sameTab:true,isMe:true,presence:mine}].concat([...others].map(([p,q])=>({peer:p,sameTab:false,isMe:false,presence:q})))};
  const deliver=m=>{if(m.t==='e')(subs[m.topic]||[]).forEach(fn=>{try{fn({topic:m.topic,data:m.data,peer:m.from,sameTab:false,isMe:false})}catch(e){console.error(e)}});
    else if(m.t==='p'){others.set(m.from,m.presence||{});rebuild()}else if(m.t==='bye'){others.delete(m.from);rebuild()}};
  const send=m=>{try{if(host){for(const c of conns.values())if(c.open)c.send(m)}else if(hostConn&&hostConn.open)hostConn.send(m)}catch(e){}};
  const retry=()=>{if(!alive||retryT)return;onStatus('connecting');
    retryT=setTimeout(()=>{retryT=0;try{peer&&peer.destroy()}catch(e){}others.clear();conns.clear();hostConn=null;rebuild();beHost()},1200+Math.random()*1800)};
  function beHost(){if(!alive)return;host=false;const p=peer=new window.Peer(HOST);
    p.on('open',()=>{host=true;onStatus('open')});
    p.on('connection',c=>{
      c.on('open',()=>{conns.set(c.peer,c);c.send({t:'p',from:me,presence:mine});for(const [o,q] of others)c.send({t:'p',from:o,presence:q})});
      c.on('data',m=>{if(!m||typeof m!=='object'||typeof m.from!=='string')return;c.who=m.from;deliver(m);for(const o of conns.values())if(o!==c&&o.open)o.send(m)});
      c.on('close',()=>{conns.delete(c.peer);if(c.who){const b={t:'bye',from:c.who};deliver(b);for(const o of conns.values())if(o.open)o.send(b)}})});
    p.on('error',e=>{if(p!==peer)return;if(e&&e.type==='unavailable-id'){try{p.destroy()}catch(x){}beClient()}else retry()});
    p.on('disconnected',()=>{try{p.reconnect()}catch(e){}})}
  function beClient(){if(!alive)return;const p=peer=new window.Peer();
    p.on('open',()=>{const c=hostConn=p.connect(HOST,{reliable:true});
      c.on('open',()=>{onStatus('open');c.send({t:'p',from:me,presence:mine})});
      c.on('data',m=>{if(m&&typeof m==='object'&&typeof m.from==='string')deliver(m)});
      c.on('close',()=>{if(p===peer)retry()})});
    p.on('error',()=>{if(p===peer)retry()})}
  rebuild();beHost();
  return {emit(topic,data){send({t:'e',topic,data,from:me});return Promise.resolve()},
    on(topic,fn){(subs[topic]=subs[topic]||[]).push(fn);return ()=>{}},
    presence(patch){mine=Object.assign({},mine,patch);rebuild();send({t:'p',from:me,presence:mine});return Promise.resolve()},
    peers:()=>snap,leave(){alive=false;clearTimeout(retryT);try{peer&&peer.destroy()}catch(e){}}}}

function netInit(){
  const j=JSON.stringify(serModel());
  const me=Math.random().toString(36).slice(2,10);let st={t:PG_HAD?1:0,by:PG_HAD?me:''};      /* never synced: a device with a saved design outranks a fresh one */
  try{const o=JSON.parse(localStorage.getItem('pgSync')||'null');if(o&&o.h===netHash(j))st={t:+o.t||0,by:String(o.by||'')}}catch(e){}
  let pv=true;try{pv=localStorage.getItem('pgPv')!=='0'}catch(e){}
  NET={me,st,lastJ:j,ready:false,room:null,status:'off',code:'',queue:[],tokens:20,inbox:new Map(),pending:null,needAt:0,
    presAcc:0,lastPres:'',liveAt:0,liveJ:'',sentLive:false,wasBusy:false,finalAt:0,livePrev:false,spect:null,mode:'third',so:null,fr:new Map(),pv,pvTick:0,typed:'',
    peersN:1,uiKey:'',toastAt:0,respondAt:0,xrPeer:null,flats:[]};
  setTimeout(()=>{NET.ready=true;NET.lastJ=JSON.stringify(serModel())},1500);
  tgWire();netStart()}
function netPersist(){try{localStorage.setItem('pgSync',JSON.stringify({t:NET.st.t,by:NET.st.by,h:netHash(NET.lastJ)}))}catch(e){}}
/* a change made here: stamp it and send it */
function netSaved(j){if(!NET.ready){NET.lastJ=j;return}if(j===NET.lastJ)return;NET.lastJ=j;NET.st={t:Math.max(Date.now(),NET.st.t+1),by:NET.me};netPersist();netSend(false)}
function netSend(live){if(!NET.room)return;const j=live?NET.liveJ:NET.lastJ,n=Math.max(1,Math.ceil(j.length/NET_CH)),id=Math.random().toString(36).slice(2,9);
  NET.queue=NET.queue.filter(m=>m.topic!=='d');
  for(let k=0;k<n;k++)NET.queue.push({topic:'d',data:{t:NET.st.t,b:NET.st.by,l:live?1:0,i:id,k,n,x:j.slice(k*NET_CH,(k+1)*NET_CH)}});
  if(!live)NET.sentLive=false}
function netOnDesign(m){const d=m.data;if(!d||typeof d.i!=='string'||!Number.isInteger(d.k)||!Number.isInteger(d.n)||d.n<1||d.n>400||d.k<0||d.k>=d.n||typeof d.x!=='string'||typeof d.t!=='number')return;
  let e=NET.inbox.get(d.i);if(!e){e={t:d.t,by:String(d.b||''),live:!!d.l,n:d.n,parts:new Array(d.n),got:0,from:m.peer,at:performance.now()};NET.inbox.set(d.i,e)}
  if(e.parts[d.k]!=null)return;e.parts[d.k]=d.x;e.got++;
  if(NET.inbox.size>24){const old=[...NET.inbox.keys()].slice(0,8);old.forEach(k=>NET.inbox.delete(k))}
  if(e.got<e.n)return;NET.inbox.delete(d.i);const st={t:e.t,by:e.by},c=netCmp(st,NET.st);
  if(c>0||(c===0&&(e.live||NET.livePrev)))NET.pending={j:e.parts.join(''),st,live:e.live,from:e.from}}
function netOnNeed(m){const d=m.data;if(!d||typeof d.t!=='number')return;if(d.t===NET.st.t&&String(d.b)===NET.st.by&&performance.now()>NET.respondAt){NET.respondAt=performance.now()+800;netSend(false)}}
/* something is being dragged here: don't swap the design out from under the hand */
function netBusy(){let sc=false;try{sc=!!scDrag}catch(e){}
  return !!(tc.dragging||pushDrag||hDrag||figDrag||sc||ctrls.some(c=>{const U=c.userData;return U.push||U.hd||U.grab||U.skGrab||U.stroke||U.erasing||U.figIK||U.figGrab}))}
function netApply(p){let d;try{d=JSON.parse(p.j)}catch(e){return}if(!d||d.app!=='ply-grammar'||!Array.isArray(d.blocks))return;
  const sn=sel?.name,lite=p.live||(xrMode&&view==='mass');
  restoreModel(d,{lite,live:p.live,remote:true});
  if(sn){const b=blocks.find(x=>x.name===sn);if(b)select(b)}
  if(p.live){if(!NET.livePrev&&view==='panels'){massGroup.visible=true;panelGroup.visible=false;if(gapMesh)gapMesh.visible=false}NET.livePrev=true;return}
  if(NET.livePrev){NET.livePrev=false;if(view==='panels'){massGroup.visible=false;panelGroup.visible=true;if(gapMesh)gapMesh.visible=true}}
  NET.st=p.st;NET.lastJ=JSON.stringify(serModel());netPersist();pushUndo(NET.lastJ);
  if(view==='build')buildAsm(true);
  const now=performance.now();if(!NET.spect&&now>NET.toastAt){NET.toastAt=now+4000;const q=(NET.room?.peers()||[]).find(x=>x.peer===p.from)?.presence;
    toast(q?.r==='xr'?'Design updated from the headset':q?.dv==='phone'?'Design updated from the phone':'Design updated from your other device')}}

function netStart(){
  if(IN_CLAUDE_ROOM){window.claude.use('room').then(r=>{if(!r)return;NET.status='open';netHookRoom(r);tgUI()}).catch(()=>{});return}
  let saved='';try{saved=localStorage.getItem('pgRoom')||''}catch(e){}
  const fromHash=(location.hash||'').replace(/\D/g,'').slice(0,4);
  NET.code=fromHash.length===4?fromHash:saved.length===4?saved:String(1000+Math.floor(Math.random()*9000));
  /* the GitHub copy joins only once the password is in */
  const go=()=>{if(window.PG_GATE&&!unlocked){setTimeout(go,700);return}netJoin(NET.code)};go()}
function netJoin(c){if(IN_CLAUDE_ROOM)return;NET.code=c;NET.status='connecting';try{localStorage.setItem('pgRoom',c)}catch(e){}
  if(NET.room&&NET.room.leave)NET.room.leave();NET.room=null;NET.queue=[];NET.inbox.clear();NET.pending=null;NET.lastPres='';tgUI();
  const go=()=>{if(NET.code!==c)return;if(!window.Peer){NET.status='off';tgUI();return}netHookRoom(netPeerRoom(c,st=>{NET.status=st;tgUI();if(st==='open'){NET.lastPres=''}}))};
  if(window.Peer)return go();
  const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';sc.onload=go;sc.onerror=()=>{NET.status='off';tgUI()};document.head.appendChild(sc)}
function netHookRoom(r){NET.room=r;const q=()=>{};
  r.on('d',m=>{if(!(m.isMe&&m.sameTab))netOnDesign(m)},q);
  r.on('need',m=>{if(!(m.isMe&&m.sameTab))netOnNeed(m)},q)}

/* ---- what this device tells the others, about 15 times a second ---- */
function netPresence(){
  const p={v:1,r:xrMode?'xr':'flat',dv:netDev,st:[NET.st.t,NET.st.by],vw:view,as:view==='build'&&AS.b?[AS.b.name,AS.step|0]:null,c:null,h:null,w:null,L:null,R:null,m:null,ls:null};
  if(xrMode){const cam=renderer.xr.getCamera();world.updateMatrixWorld();p.h=netPose(cam.matrixWorld);p.w=netPose(world.matrixWorld).concat([+world.scale.x.toPrecision(6)]);
    for(const c of ctrls){const U=c.userData,hand=U.hand;if((hand!=='left'&&hand!=='right')||!U.src)continue;const g=U.src.gamepad,bt=i=>g?.buttons?.[i];
      const o={g:netPose(U.grip.matrixWorld),a:netPose(c.matrixWorld),b:g?[nr(bt(0)?.value||0,100),nr(bt(1)?.value||0,100),(bt(3)?.pressed?1:0)|(bt(4)?.pressed?2:0)|(bt(5)?.pressed?4:0),nr(g.axes?.[2]||0,100),nr(g.axes?.[3]||0,100)]:null,
        ln:U.line.visible?nr(U.line.scale.z,1000):0,f:(U.dot.visible?1:0)|(U.tip.visible?2:0)|(XR.tool==='erase'?4:0),pf:(U.src.profiles||[]).slice(0,4)};
      p[hand==='left'?'L':'R']=o}
    p.m={on:menu.visible?1:0,x:String(menuMsg||'').slice(0,280),t:XR.tool,s:XR.step||'',h:XR.hover|0};
    const st=ctrls.find(c=>c.userData.stroke)?.userData.stroke;if(st&&st.pts.length){const P=st.pts,n=P.length,k=Math.max(1,Math.ceil(n/60)),o=[];for(let i=0;i<n;i+=k)o.push(P[i].map(z=>nr(z,10)));if((n-1)%k)o.push(P[n-1].map(z=>nr(z,10)));p.ls=o}}
  else{camera.updateMatrixWorld();world.updateMatrixWorld();_nM.copy(world.matrixWorld).invert().multiply(camera.matrixWorld);p.c=netPose(_nM,100).concat([Math.round(camera.fov),nr(camera.aspect,100)])}
  return p}

function netFrame(dt){if(!NET)return;
  const r=NET.room;let peers=[];if(r){try{peers=r.peers()||[]}catch(e){peers=[]}}
  /* send what is queued, at a polite rate */
  NET.tokens=Math.min(30,NET.tokens+dt*20);
  while(r&&NET.queue.length&&NET.tokens>=1){const m=NET.queue.shift();NET.tokens--;try{r.emit(m.topic,m.data).catch(()=>{})}catch(e){}}
  let xp=null,want=null;const flats=[];
  for(const p of peers){const q=p.presence;if(p.sameTab||!q||q.v!==1)continue;      /* (isMe is also your other device: only sameTab is this page) */
    if(q.r==='xr'&&!xp)xp=p;else if(q.r==='flat')flats.push(p);
    if(nOk(q.st,1)){const s={t:q.st[0],by:String(q.st[1]||'')};if(netCmp(s,NET.st)>0&&(!want||netCmp(s,want)>0))want=s}}
  NET.xrPeer=xp;NET.flats=flats;
  const now=performance.now(),busy=netBusy();
  /* someone has a newer design: ask for it (again, if it got lost) */
  if(r&&want&&now>NET.needAt&&!NET.pending){NET.needAt=now+1500;NET.queue.unshift({topic:'need',data:{t:want.t,b:want.by}})}
  if(NET.pending&&!busy){const p=NET.pending;NET.pending=null;netApply(p)}
  /* while dragging here, the others see it move */
  if(r&&busy&&peers.length>1&&now-NET.liveAt>260){NET.liveAt=now;const j=JSON.stringify(serModel());if(j!==NET.liveJ&&j!==NET.lastJ){NET.liveJ=j;NET.sentLive=true;netSend(true)}}
  if(NET.wasBusy&&!busy)NET.finalAt=now+900;NET.wasBusy=busy;
  if(NET.finalAt&&now>NET.finalAt){NET.finalAt=0;if(NET.sentLive)netSend(false);NET.liveJ=''}
  /* watching the headset from a flat screen */
  if(!xrMode&&xp)netWatch(xp,dt);else if(NET.spect)netUnwatch();
  if(xrMode)netFrusta(flats,dt);else if(NET.fr.size)netFrusta([],dt);
  if(r){NET.presAcc+=dt;if(NET.presAcc>.066){NET.presAcc=0;const t=JSON.stringify(netPresence());if(t!==NET.lastPres){NET.lastPres=t;try{r.presence(JSON.parse(t)).catch(()=>{})}catch(e){}}}}
  if(peers.length!==NET.peersN||(xp?.presence?.vw||'')+(xp?'x':'')!==NET.uiKey){NET.peersN=peers.length;NET.uiKey=(xp?.presence?.vw||'')+(xp?'x':'');tgUI();if(xrMode)drawMenu()}}

/* ---- a flat screen draws the headset ---- */
function netHeadMesh(){const g=new THREE.Group(),wht=new THREE.MeshLambertMaterial({color:0xF2F2F2}),drk=new THREE.MeshLambertMaterial({color:0x202020});
  const body=new THREE.Mesh(new THREE.BoxGeometry(.18,.095,.085),wht);body.position.z=-.045;g.add(body);
  const face=new THREE.Mesh(new THREE.BoxGeometry(.165,.078,.012),drk);face.position.z=-.092;g.add(face);
  const strap=new THREE.Mesh(new THREE.TorusGeometry(.095,.011,8,28),drk);strap.rotation.x=Math.PI/2;strap.position.z=.06;g.add(strap);
  g.traverse(o=>{o.frustumCulled=false});return g}
function netSpectObjs(){if(NET.so)return NET.so;
  const hs=new THREE.Group();hs.matrixAutoUpdate=false;hs.visible=false;world.add(hs);
  const head=netHeadMesh();hs.add(head);const hands={};
  for(const hand of ['left','right']){const grip=new THREE.Group(),aim=new THREE.Group();hs.add(grip,aim);
    const line=new THREE.Line(rayGeo,new THREE.LineBasicMaterial({color:0xF2A01F}));aim.add(line);
    const dot=new THREE.Mesh(new THREE.SphereGeometry(.007,12,8),new THREE.MeshBasicMaterial({color:0xF2A01F,depthTest:false}));dot.renderOrder=20;aim.add(dot);
    const tip=new THREE.Mesh(new THREE.SphereGeometry(.005,14,10),new THREE.MeshBasicMaterial({color:0x15181D}));tip.position.set(0,0,-.02);aim.add(tip);
    const gp={id:'',mapping:'xr-standard',buttons:Array.from({length:7},()=>({pressed:false,touched:false,value:0})),axes:[0,0,0,0]};
    let fmodel=null;if(!IN_CLAUDE_ROOM)try{if(ctrlFactory){fmodel=ctrlFactory.createControllerModel(grip);grip.add(fmodel)}}catch(e){fmodel=null}
    const model=ctrlModel(hand==='left'?0x2E5BFF:0xE5392B);grip.add(model);
    hands[hand]={grip,aim,line,dot,tip,gp,fake:{userData:{hand,grip,fmodel,model,icons:{},decTries:0}},prof:''};
    hs.traverse(o=>{o.frustumCulled=false})}
  const W={p:new V(),q:new THREE.Quaternion(),s:1};
  return NET.so={hs,head,hands,W}}
function netWatch(p,dt){const q=p.presence,so=netSpectObjs(),first=!NET.spect||NET.spect.peer!==p.peer;
  if(first){NET.spect={peer:p.peer,vw:null,as:'',mk:'',ls:'',keep:{tool:XR.tool,step:XR.step}};so.hs.visible=true;tgUI()}
  const sp=NET.spect,k=first?1:1-Math.exp(-dt*14);
  if(nOk(q.w,8)){_nP.set(q.w[0],q.w[1],q.w[2]);_nQ.set(q.w[3],q.w[4],q.w[5],q.w[6]).normalize();const s=nClamp(q.w[7],1e-5,10);
    if(k>=1){so.W.p.copy(_nP);so.W.q.copy(_nQ);so.W.s=s}else{so.W.p.lerp(_nP,k);so.W.q.slerp(_nQ,k);so.W.s+=(s-so.W.s)*k}
    so.hs.matrix.compose(so.W.p,so.W.q,_nS.setScalar(so.W.s)).invert();so.hs.matrixWorldNeedsUpdate=true}
  so.head.visible=nOk(q.h,7);if(so.head.visible)netSetPose(so.head,q.h,k);
  for(const hand of ['left','right']){const H=so.hands[hand],a=q[hand==='left'?'L':'R'],on=!!a&&nOk(a.g,7)&&nOk(a.a,7);H.grip.visible=H.aim.visible=on;if(!on)continue;
    netSetPose(H.grip,a.g,k);netSetPose(H.aim,a.a,k);
    const ln=+a.ln||0,f=a.f|0;H.line.visible=ln>0;H.line.scale.z=Math.max(.01,ln);H.dot.visible=!!(f&1)&&ln>0;H.dot.position.set(0,0,-ln);H.tip.visible=!!(f&2);H.tip.material.color.set(f&4?0xFF2D95:0x15181D);
    if(Array.isArray(a.b)){const g=H.gp,b=a.b;g.buttons[0].value=+b[0]||0;g.buttons[0].pressed=g.buttons[0].value>.5;g.buttons[1].value=+b[1]||0;g.buttons[1].pressed=g.buttons[1].value>.5;
      g.buttons[3].pressed=!!(b[2]&1);g.buttons[4].pressed=!!(b[2]&2);g.buttons[5].pressed=!!(b[2]&4);g.buttons[4].value=g.buttons[4].pressed?1:0;g.buttons[5].value=g.buttons[5].pressed?1:0;g.axes[2]=+b[3]||0;g.axes[3]=+b[4]||0}
    /* the real controller model, fetched by the same profile the headset uses */
    const pf=Array.isArray(a.pf)?a.pf.filter(x=>typeof x==='string'&&/^[a-z0-9-]{2,40}$/.test(x)).slice(0,4):[];
    if(H.fake.userData.fmodel&&pf.length&&pf.join()!==H.prof){H.prof=pf.join();H.grip.dispatchEvent({type:'connected',data:{handedness:hand,profiles:pf.concat(['generic-trigger-squeeze-thumbstick']),gamepad:H.gp,targetRayMode:'tracked-pointer'}})}
    xrDecorate(H.fake)}
  /* the wrist menu, as the headset has it */
  const m=q.m||{},L=so.hands.left;
  if(menu.parent!==L.grip){menu.parent?.remove(menu);L.grip.add(menu);menu.position.set(0,.08,-.13);menu.rotation.set(-.35-Math.PI/2,0,0)}
  netMenuBack(true);
  menu.visible=!!m.on&&L.grip.visible;
  const mk=[m.x,m.t,m.s,m.h,view,q.vw].join('|');if(menu.visible&&mk!==sp.mk){sp.mk=mk;menuMsg=String(m.x||'');XR.tool=['push','pen','erase'].includes(m.t)?m.t:'push';XR.step=m.s==='floor'||m.s==='room'?m.s:null;XR.hover=m.h|0;drawMenu()}
  /* the line being drawn with the pen */
  const ls=Array.isArray(q.ls)?q.ls.filter(x=>nOk(x,3)).slice(0,80):null,lk=ls?ls.length+':'+(ls[ls.length-1]||[]).join():'';
  if(lk!==sp.ls){sp.ls=lk;skLive(ls||[])}
  /* follow the headset's view and build step when it changes (you can still look around in between) */
  if(q.vw!==sp.vw){sp.vw=q.vw;if(['mass','panels','build'].includes(q.vw)&&q.vw!==view)setView(q.vw)}
  if(view==='build'&&Array.isArray(q.as)&&q.as.length===2){const key=q.as.join('|');if(key!==sp.as){sp.as=key;const b=blocks.find(x=>x.name===String(q.as[0]));
      if(b&&AS.b!==b){select(b);AS.b=b;buildAsm(true)}if(Number.isInteger(q.as[1])&&q.as[1]!==AS.step)showStep(q.as[1])}}}
function netUnwatch(){const so=NET.so,sp=NET.spect;NET.spect=null;if(so)so.hs.visible=false;
  netMenuBack(false);
  if(!xrMode){menu.visible=false;if(so&&menu.parent===so.hands.left.grip)so.hands.left.grip.remove(menu)}
  if(sp){XR.tool=sp.keep.tool;XR.step=sp.keep.step;if(sp.ls)skLive([])}
  if(NET.mode!=='third'){NET.mode='third';resize()}tgUI()}

/* seen from a phone the wrist menu can face away: its back is a dark slate, like the back of a tablet */
var NET_MB=null;function netMenuBack(on){if(!NET_MB){const g=menu.geometry.parameters;NET_MB=new THREE.Mesh(new THREE.PlaneGeometry(g.width,g.height),new THREE.MeshBasicMaterial({color:0x2A2D34,side:THREE.BackSide}));NET_MB.position.z=-.0005;menu.add(NET_MB)}NET_MB.visible=on}
/* their eyes: the headset's view drawn on this screen, whole or in the bottom half */
const fpCam=new THREE.PerspectiveCamera(80,1,.5,20000),_nV2=new THREE.Vector2();
function netRender(){const sp=NET&&NET.spect;if(!sp||xrMode||NET.mode==='third'||view==='sheets'||!NET.so.head.visible)return false;
  const so=NET.so;so.hs.updateMatrixWorld(true);so.head.matrixWorld.decompose(fpCam.position,fpCam.quaternion,_nS);
  renderer.getSize(_nV2);const w=_nV2.x,h=_nV2.y,split=NET.mode==='split',hh=Math.floor(h/2),ws=Math.max(1e-5,so.W.s);
  fpCam.aspect=split?w/hh:w/h;fpCam.fov=nClamp(2*Math.atan(Math.tan(.74)/fpCam.aspect)*180/Math.PI,60,112);fpCam.near=.02/ws;fpCam.far=400/ws;fpCam.updateProjectionMatrix();
  if(split){const a=camera.aspect;camera.aspect=w/(h-hh);camera.updateProjectionMatrix();renderer.setScissorTest(true);renderer.setViewport(0,hh,w,h-hh);renderer.setScissor(0,hh,w,h-hh);renderer.render(scene,camera);
    renderer.setViewport(0,0,w,hh);renderer.setScissor(0,0,w,hh);camera.aspect=a;camera.updateProjectionMatrix()}
  so.head.visible=false;renderer.render(scene,fpCam);so.head.visible=true;
  if(split){renderer.setScissorTest(false);renderer.setViewport(0,0,w,h)}
  return true}

/* ---- the headset draws each flat screen's camera ---- */
function netFrustum(){const g=new THREE.Group(),lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xFFD400}));
  lines.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(16*3),3));
  const box=new THREE.BoxGeometry(1,1,.009),body=new THREE.Mesh(box,new THREE.MeshBasicMaterial({color:0x15181D}));body.add(new THREE.LineSegments(new THREE.EdgesGeometry(box),new THREE.LineBasicMaterial({color:0xFFD400})));
  g.add(lines,body);g.userData={lines,body,key:'',fresh:true};g.traverse(o=>{o.frustumCulled=false});return g}
function netShapeFrustum(g,fov,aspect){const key=fov+'/'+aspect;if(g.userData.key===key)return;g.userData.key=key;
  const D=.3,hh=D*Math.tan(nClamp(fov,10,120)*Math.PI/360),hw=hh*nClamp(aspect,.2,5),c=[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]],a=g.userData.lines.geometry.attributes.position;let o=0;
  for(let i=0;i<4;i++){a.setXYZ(o++,0,0,0);a.setXYZ(o++,c[i][0],c[i][1],-D)}
  for(let i=0;i<4;i++){const j=(i+1)%4;a.setXYZ(o++,c[i][0],c[i][1],-D);a.setXYZ(o++,c[j][0],c[j][1],-D)}a.needsUpdate=true;
  if(aspect<1)g.userData.body.scale.set(.074,.154,1);else g.userData.body.scale.set(.154,.074,1)}
function netFrusta(flats,dt){const seen=new Set();
  for(const p of flats){const c=p.presence.c;if(!nOk(c,9))continue;let g=NET.fr.get(p.peer);if(!g){g=netFrustum();world.add(g);NET.fr.set(p.peer,g)}seen.add(p.peer);
    netShapeFrustum(g,c[7],c[8]);netSetPose(g,c,g.userData.fresh?1:1-Math.exp(-dt*14));g.userData.fresh=false;g.scale.setScalar(1/Math.max(1e-5,world.scale.x))}
  for(const [peer,g] of NET.fr)if(!seen.has(peer)){world.remove(g);NET.fr.delete(peer)}}

/* ---- and a small screen beside the wrist menu showing what the phone sees ---- */
var NET_PV=null,_pvKey='';
const pvRT=new THREE.WebGLRenderTarget(360,360),pvCam=new THREE.PerspectiveCamera(50,1,.01,400),pvHead=netHeadMesh();pvHead.visible=false;scene.add(pvHead);
{const pv=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:pvRT.texture,side:THREE.DoubleSide}));
  const fr=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xFFD400,side:THREE.DoubleSide}));fr.scale.set(1.06,1.06,1);fr.position.z=-.001;pv.add(fr);
  pv.visible=false;pv.renderOrder=15;pv.traverse(o=>{o.frustumCulled=false});menu.add(pv);NET_PV=pv}
function netPreview(){const pv=NET_PV;if(!NET)return;const f=NET.flats[0],c=f?.presence?.c,on=xrMode&&NET.pv&&menu.visible&&nOk(c,9)&&!XR.step;pv.visible=!!on;if(!on)return;
  const asp=nClamp(c[8],.3,3),mw=menu.geometry.parameters.width,mh=menu.geometry.parameters.height,w=asp<1?.17*asp:.17,h=asp<1?.17:.17/asp;
  pv.scale.set(w,h,1);pv.position.set(mw/2+.014+w/2,mh/2-h/2,0);
  if((NET.pvTick++)%3)return;
  const key=asp.toFixed(2);if(key!==_pvKey){_pvKey=key;pvRT.setSize(asp<1?Math.round(360*asp):360,asp<1?360:Math.round(360/asp))}
  world.updateMatrixWorld();_nP.set(c[0],c[1],c[2]);_nQ.set(c[3],c[4],c[5],c[6]).normalize();_nM.compose(_nP,_nQ,_nS.set(1,1,1)).premultiply(world.matrixWorld);
  _nM.decompose(pvCam.position,pvCam.quaternion,_nS);pvCam.fov=nClamp(c[7],10,120);pvCam.aspect=asp;pvCam.updateProjectionMatrix();pvCam.updateMatrixWorld();
  /* the phone sees you (your headset), and neither this screen nor its own outline */
  const cam=renderer.xr.getCamera();cam.matrixWorld.decompose(pvHead.position,pvHead.quaternion,_nS);pvHead.visible=true;pv.visible=false;for(const g of NET.fr.values())g.visible=false;
  const xe=renderer.xr.enabled,rt=renderer.getRenderTarget();renderer.xr.enabled=false;renderer.setRenderTarget(pvRT);renderer.clear();renderer.render(scene,pvCam);renderer.setRenderTarget(rt);renderer.xr.enabled=xe;
  pvHead.visible=false;pv.visible=true;for(const g of NET.fr.values())g.visible=true}

/* ---- the wrist menu: one row, and a number pad for the room ---- */
function netMenuRow(B,y,c3,w3){const n=NET?NET.peersN:1,more=Math.max(0,n-1),wide=c3[1]+w3-c3[0];
  const who=more?(NET.flats.length?NET.flats.map(p=>p.presence.dv==='phone'?'phone':p.presence.dv==='quest'?'Quest':'computer').join(' + ')+' here':more+' more here'):'only you so far';
  if(IN_CLAUDE_ROOM)B(c3[0],y,wide,'Together: '+who,{fs:32});
  else B(c3[0],y,wide,NET?.status==='open'?`Room ${NET.code} · ${who}`:`Room ${NET?.code||'----'} · ${NET?.status==='off'?'offline':'connecting'}`,{fs:32,click:()=>{NET.typed='';XR.step='room';drawMenu()}});
  B(c3[2],y,w3,'Phone view',{on:!!NET?.pv,col:'#19B5A1',fs:32,click:()=>{NET.pv=!NET.pv;try{localStorage.setItem('pgPv',NET.pv?'1':'0')}catch(e){}menuMsg=NET.pv?'What the phone sees shows beside this menu.':'Phone view hidden.';drawMenu()}})}
function netKeypad(B,c3,w3){const d=NET.typed||'';mText('Room number',48,160,46,'#FFFFFF','left',800);
  mWrap('Type the 4 digits shown in the Together tab on your phone.',48,226,MW-96,32,'#C9CED8',44,2);
  mText((d+'····').slice(0,4).split('').join('  '),MW/2,350,92,'#F2A01F','center',800);
  const key=s=>()=>{if(s==='del')NET.typed=d.slice(0,-1);else if(s==='done'){XR.step=null}else if(d.length<4)NET.typed=d+s;
    if(NET.typed.length===4&&s!=='del'&&s!=='done'){netJoin(NET.typed);XR.step=null;menuMsg='Room '+NET.typed+'. Type the same number on your phone.'}drawMenu()};
  let y=430;for(const row of [['1','2','3'],['4','5','6'],['7','8','9'],['del','0','done']]){row.forEach((s,i)=>B(c3[i],y,w3,s==='del'?'⌫':s==='done'?'Done':s,{fs:s==='done'?38:48,solid:s==='done',col:s==='done'?'#2FBF5B':undefined,click:key(s)}));y+=124}}

/* ---- the Together tab and the little pill on the stage ---- */
const TG_MODES={third:'Around it',first:'Their eyes',split:'Both'};
function tgWire(){const inp=$('#tgRoom');if(!inp)return;
  $('#tgRoomRow').hidden=IN_CLAUDE_ROOM;
  inp.addEventListener('input',()=>{const v=inp.value.replace(/\D/g,'').slice(0,4);inp.value=v;if(v.length===4&&v!==NET.code){netJoin(v);inp.blur()}});
  inp.addEventListener('keydown',e=>e.stopPropagation());
  $$('#tgMode button').forEach(b=>b.onclick=()=>tgSetMode(b.dataset.m));
  $('#tgPill').onclick=()=>tgSetMode(NET.mode==='third'?'first':NET.mode==='first'?'split':'third');tgUI()}
function tgSetMode(m){if(!NET.spect)return;NET.mode=m;resize();tgUI()}
function tgUI(){if(!NET||!$('#tgStat'))return;const peers=NET.room?.peers()||[],others=peers.filter(p=>!p.sameTab&&p.kind!=='agent'),xp=NET.xrPeer;
  if(document.activeElement!==$('#tgRoom'))$('#tgRoom').value=NET.code;
  $('#tgStat').textContent=IN_CLAUDE_ROOM?(NET.room?'Everyone with this page open is here.':'Open this page on another device.'):NET.status==='open'?'Connected':NET.status==='off'?'Offline':'Connecting…';
  $('#tgStat').dataset.on=NET.status==='open'?'1':'0';
  const name=q=>q?.r==='xr'?'Quest headset, in '+({mass:'Massing',panels:'Panels',build:'Build'}[q.vw]||'VR'):q?.dv==='phone'?'Phone':q?.dv==='quest'?'Quest (not in VR)':'Computer';
  const L=$('#tgList');L.innerHTML='';const rows=[[name({r:xrMode?'xr':'flat',dv:netDev,vw:view})+' (this one)',true]].concat(others.map(p=>[name(p.presence),false]));
  for(const [t,me] of rows){const d=document.createElement('div');d.className='tgdev'+(me?' me':'');d.textContent=t;L.appendChild(d)}
  if(!others.length){const d=document.createElement('div');d.className='tgdev none';d.textContent=IN_CLAUDE_ROOM?'Nobody else yet.':'Nobody else in room '+NET.code+' yet.';L.appendChild(d)}
  const w=!!NET.spect;$('#tgWatch').hidden=!w;$$('#tgMode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===NET.mode));
  $('#tgPill').hidden=!w;$('#tgPillTxt').textContent='Headset · '+TG_MODES[NET.mode];
  $('.tab[data-tab=together]')?.classList.toggle('live',others.length>0)}
netInit();
