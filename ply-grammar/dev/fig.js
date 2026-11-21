/* ---------------- figure: a posable person to design around ----------------
   Proportions are the standard body-segment fractions of standing height (thigh .245, shank .246, upper arm .186,
   forearm .146, hand .108, shoulders at .818, hips at .53). Every joint keeps to a human range of motion: knees and
   elbows only fold one way, hips and shoulders swing within their limits. Hands and feet can be dragged (the arm or leg
   follows, as far as its joints allow), and a pose list sets the whole body at once. A figure is saved with the design
   ({p: where it stands or holds on, ry: which way it faces, h: height in inches, pose, a: joint angles}); it is never panelized. */
const FIG_LIM={spine:[[-30,60],[-25,25],[-30,30]],chest:[[-20,40],[-20,20],[-30,30]],neck:[[-45,60],[-70,70],[-35,35]],
  Sh:[[-60,180],[-30,180],[-90,90]],El:[0,150],Hip:[[-30,130],[-30,60],[-45,45]],Kn:[0,150],Ank:[-45,30]};
/* angles in plain body terms: flex (forward), then side or abduction (out), then twist; elbows and knees just fold */
const FIG_POSES={
  stand:{name:'Stand',anchor:'low',a:{lSh:[0,8,0],rSh:[0,8,0],lEl:10,rEl:10}},
  walk:{name:'Walk',anchor:'low',a:{lHip:[22,0,0],rHip:[-14,0,0],lKn:8,rKn:28,rAnk:-10,lSh:[-18,6,0],rSh:[22,6,0],lEl:12,rEl:24}},
  run:{name:'Run',anchor:'low',a:{spine:[12,0,0],lHip:[55,0,0],lKn:70,rHip:[-22,0,0],rKn:95,rAnk:-25,lSh:[-45,8,0],lEl:95,rSh:[55,8,0],rEl:95}},
  reach:{name:'Reach up',anchor:'low',a:{chest:[-6,0,0],lSh:[172,6,0],rSh:[172,6,0],lEl:4,rEl:4,lAnk:-25,rAnk:-25}},
  squat:{name:'Land / squat',anchor:'low',a:{spine:[32,0,0],chest:[10,0,0],neck:[-25,0,0],lHip:[112,10,0],rHip:[112,10,0],lKn:132,rKn:132,lAnk:28,rAnk:28,lSh:[70,10,0],rSh:[70,10,0],lEl:25,rEl:25}},
  sit:{name:'Sit on a ledge',anchor:'seat',a:{spine:[6,0,0],lHip:[90,6,0],rHip:[90,6,0],lKn:85,rKn:85,lSh:[12,10,0],rSh:[12,10,0],lEl:40,rEl:40}},
  kneel:{name:'Kneel',anchor:'low',a:{lHip:[2,4,0],rHip:[2,4,0],lKn:100,rKn:100,lAnk:-40,rAnk:-40,lSh:[10,8,0],rSh:[10,8,0],lEl:20,rEl:20}},
  climb:{name:'Step up high',anchor:'low',a:{spine:[18,0,0],lHip:[105,4,0],lKn:118,lAnk:15,rHip:[-6,0,0],rKn:12,lSh:[140,10,0],rSh:[120,12,0],lEl:40,rEl:45}},
  vault:{name:'Vault',anchor:'low',a:{root:[70,0],neck:[-40,0,0],lSh:[95,12,0],rSh:[95,12,0],lEl:5,rEl:5,lHip:[118,14,0],rHip:[118,14,0],lKn:128,rKn:128}},
  cat:{name:'Cat hang',anchor:'hands',a:{lSh:[168,12,0],rSh:[168,12,0],lEl:35,rEl:35,lHip:[72,8,0],rHip:[60,8,0],lKn:78,rKn:70,lAnk:20,rAnk:20}},
  hang:{name:'Hang',anchor:'hands',a:{lSh:[178,10,0],rSh:[178,10,0],lEl:2,rEl:2,lHip:[8,0,0],rHip:[4,0,0],lKn:12,rKn:8,lAnk:-20,rAnk:-20}},
  crawl:{name:'Crawl',anchor:'low',a:{root:[90,0],neck:[-55,0,0],lSh:[90,6,0],rSh:[90,6,0],lEl:2,rEl:2,lHip:[90,4,0],rHip:[90,4,0],lKn:92,rKn:92,lAnk:-40,rAnk:-40}},
  lie:{name:'Lie down',anchor:'low',a:{root:[-90,0],lSh:[0,14,0],rSh:[0,14,0],lEl:8,rEl:8,lAnk:-30,rAnk:-30}}};
const FIG_KEYS=Object.keys(FIG_POSES);
const figs=[];let figSel=null;const figRoot=new THREE.Group();world.add(figRoot);
const figMat=new THREE.MeshStandardMaterial({color:0xF25C2A,roughness:.6}),figJoint=new THREE.MeshStandardMaterial({color:0x1F2430,roughness:.5}),
  figHandleM=new THREE.MeshBasicMaterial({color:0xFFD23F,depthTest:false,transparent:true,opacity:.95}),figSelM=new THREE.MeshStandardMaterial({color:0xFF7A45,roughness:.55,emissive:0x5A1A00});
const deg=x=>x*Math.PI/180;
const ftIn=h=>{const t=Math.round(h);return `${Math.floor(t/12)}′ ${t%12}″`};
function figAngles(F){const a={},src=F.a||FIG_POSES[F.pose]?.a||{};for(const k of ['spine','chest','neck','lSh','rSh','lHip','rHip'])a[k]=(src[k]||[0,0,0]).slice();
  for(const k of ['lEl','rEl','lKn','rKn','lAnk','rAnk'])a[k]=src[k]||0;a.root=(src.root||[0,0]).slice();return a}
/* build the jointed body for one figure */
function figBuild(F){const H=F.h,g=new THREE.Group(),rig=new THREE.Group();g.add(rig);g.userData.fig=F;F.g=g;F.rig=rig;const J={};
  const node=(par,x,y,z,name)=>{const o=new THREE.Object3D();o.position.set(x*H,y*H,z*H);par.add(o);if(name)J[name]=o;return o};
  const mesh=(par,geo,mat,x,y,z,part)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x*H,y*H,z*H);m.userData.fig=F;m.userData.part=part||'body';par.add(m);return m};
  const limb=(par,len,r0,part)=>{const L=len*H,R=r0*H;mesh(par,new THREE.CapsuleGeometry(R,Math.max(.01,L-R*2),4,10),figMat,0,-len/2,0,part)};
  const ball=(par,r,part)=>mesh(par,new THREE.SphereGeometry(r*H,12,8),figJoint,0,0,0,part);
  const ell=(par,rx,ry,rz,x,y,z)=>{const m=mesh(par,new THREE.SphereGeometry(1,16,12),figMat,x,y,z);m.scale.set(rx*H,ry*H,rz*H);return m};
  const pel=node(rig,0,.56,0,'pelvis');ell(pel,.088,.06,.06,0,-.005,0);
  const sp=node(pel,0,.03,0,'spine');mesh(sp,new THREE.CapsuleGeometry(.062*H,.06*H,4,12),figMat,0,.065,0);
  const ch=node(sp,0,.13,0,'chest');ell(ch,.1,.085,.062,0,.05,0);
  const nk=node(ch,0,.1,0,'neck');mesh(nk,new THREE.CapsuleGeometry(.022*H,.03*H,3,8),figMat,0,.025,0);
  const hd=node(nk,0,.05,0,'head');ell(hd,.052,.065,.058,0,.055,.005);
  for(const s of [1,-1]){const k=s>0?'l':'r';
    const sh=node(ch,.105*s,.095,0,k+'Sh');ball(sh,.033);limb(sh,.186,.03);const el=node(sh,0,-.186,0,k+'El');ball(el,.026);limb(el,.146,.025);
    const wr=node(el,0,-.146,0,k+'Wr');const hand=mesh(wr,new THREE.SphereGeometry(1,10,8),figMat,0,-.045,0,'hand-'+k);hand.scale.set(.022*H,.05*H,.032*H);
    const hip=node(pel,.052*s,-.03,0,k+'Hip');ball(hip,.04);limb(hip,.245,.047);const kn=node(hip,0,-.245,0,k+'Kn');ball(kn,.034);limb(kn,.246,.036);
    const an=node(kn,0,-.246,0,k+'Ank');const foot=mesh(an,new THREE.BoxGeometry(.05*H,.039*H,.15*H),figMat,0,-.02,.035,'foot-'+k);foot.geometry.translate(0,0,0)}
  /* the four grab handles: hands and feet */
  F.handles={};for(const [k,par,off] of [['hand-l','lWr',-.06],['hand-r','rWr',-.06],['foot-l','lAnk',-.02],['foot-r','rAnk',-.02]]){
    const hm=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),figHandleM);hm.position.set(0,off*H,k.startsWith('foot')?.05*H:0);hm.renderOrder=20;hm.userData.fig=F;hm.userData.part=k;hm.visible=false;J[par].add(hm);F.handles[k]=hm}
  F.J=J;figRoot.add(g);figPose(F);return F}
function figSetRot(F,name,e,order){const o=F.J[name];o.rotation.order=order||'XZY';o.rotation.set(e[0],e[1],e[2])}
/* angles (body terms) -> joint rotations, each clamped to its range */
function figApply(F){const a=F.ang,c=(v,[lo,hi])=>Math.max(lo,Math.min(hi,v));
  for(const k of ['spine','chest']){const L=FIG_LIM[k],v=a[k];a[k]=[c(v[0],L[0]),c(v[1],L[1]),c(v[2],L[2])];figSetRot(F,k,[deg(a[k][0]),deg(a[k][2]),deg(a[k][1])],'XYZ')}
  {const L=FIG_LIM.neck,v=a.neck;a.neck=[c(v[0],L[0]),c(v[1],L[1]),c(v[2],L[2])];figSetRot(F,'neck',[deg(a.neck[0]),deg(a.neck[1]),deg(a.neck[2])],'XYZ')}
  for(const s of ['l','r']){const sg=s==='l'?1:-1;
    {const L=FIG_LIM.Sh,v=a[s+'Sh'];a[s+'Sh']=[c(v[0],L[0]),c(v[1],L[1]),c(v[2],L[2])];const w=a[s+'Sh'];figSetRot(F,s+'Sh',[-deg(w[0]),sg*deg(w[2]),sg*deg(w[1])],'XZY')}
    a[s+'El']=c(a[s+'El'],FIG_LIM.El);F.J[s+'El'].rotation.set(-deg(a[s+'El']),0,0);
    {const L=FIG_LIM.Hip,v=a[s+'Hip'];a[s+'Hip']=[c(v[0],L[0]),c(v[1],L[1]),c(v[2],L[2])];const w=a[s+'Hip'];figSetRot(F,s+'Hip',[-deg(w[0]),sg*deg(w[2]),sg*deg(w[1])],'XZY')}
    a[s+'Kn']=c(a[s+'Kn'],FIG_LIM.Kn);F.J[s+'Kn'].rotation.set(deg(a[s+'Kn']),0,0);
    a[s+'Ank']=c(a[s+'Ank'],FIG_LIM.Ank);F.J[s+'Ank'].rotation.set(-deg(a[s+'Ank']),0,0)}
  F.J.pelvis.rotation.set(deg(a.root[0]),0,deg(a.root[1]))}
/* set the body down: its lowest point on the floor (or on the seat, or hanging by the hands) at the figure's spot */
function figAnchor(F){const g=F.g,rig=F.rig;rig.position.set(0,0,0);g.updateMatrixWorld(true);const inv=g.matrixWorld.clone().invert(),M=new THREE.Matrix4(),P=new V();
  let lo=1e9,hiH=-1e9,seat=1e9;const handC=new V();let nh=0;
  rig.traverse(o=>{if(!o.isMesh||o.material===figHandleM)return;M.multiplyMatrices(inv,o.matrixWorld);const pos=o.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){P.fromBufferAttribute(pos,i).applyMatrix4(M);if(P.y<lo)lo=P.y;if(o.userData.part.startsWith('hand')){if(P.y>hiH)hiH=P.y}}});
  for(const k of ['lWr','rWr']){const w=F.J[k].getWorldPosition(new V()).applyMatrix4(inv);handC.add(w);nh++}handC.multiplyScalar(1/nh);
  const pv=F.J.pelvis.getWorldPosition(new V()).applyMatrix4(inv);
  {/* the pelvis shell, for sitting */const pm=F.J.pelvis.children.find(x=>x.isMesh);if(pm){M.multiplyMatrices(inv,pm.matrixWorld);const pos=pm.geometry.attributes.position;for(let i=0;i<pos.count;i++){P.fromBufferAttribute(pos,i).applyMatrix4(M);if(P.y<seat)seat=P.y}}}
  const an=F.anchor||FIG_POSES[F.pose]?.anchor||'low';
  if(an==='hands')rig.position.set(-handC.x,-hiH,-handC.z);else if(an==='seat')rig.position.set(-pv.x,-seat,-pv.z);else rig.position.set(-pv.x,-lo,-pv.z)}
function figPose(F){F.ang=figAngles(F);figApply(F);figPlace(F);figAnchor(F)}
function figPlace(F){F.g.position.fromArray(F.p);F.g.rotation.set(0,deg(F.ry||0),0)}
function figShow(){figRoot.visible=view==='mass'||view==='panels';for(const F of figs){const on=F===figSel;for(const k in F.handles){const h=F.handles[k];h.visible=on;h.scale.setScalar((xrMode?.05:.038)*F.h)}
    F.rig.traverse(o=>{if(o.isMesh&&o.material!==figHandleM&&o.material!==figJoint)o.material=on?figSelM:figMat})}}
function figNew(d){const F={id:d.id||'f'+Math.random().toString(36).slice(2,8),p:(d.p||[0,0,0]).slice(),ry:d.ry||0,h:d.h||69,pose:d.pose||'stand',anchor:d.anchor||null,a:d.a?JSON.parse(JSON.stringify(d.a)):null};figs.push(F);figBuild(F);return F}
function figRemove(F){figRoot.remove(F.g);F.g.traverse(o=>o.geometry?.dispose());figs.splice(figs.indexOf(F),1);if(figSel===F)figSelect(null)}
function figRebuild(F){figRoot.remove(F.g);F.g.traverse(o=>o.geometry?.dispose());figBuild(F);figShow()}
const serFig=F=>({id:F.id,p:F.p.map(x=>+x.toFixed(2)),ry:+(F.ry||0).toFixed(1),h:+F.h.toFixed(1),pose:F.pose,anchor:F.anchor||undefined,a:F.pose==='custom'?F.ang:undefined});
function figLoad(list){figs.slice().forEach(figRemove);for(const d of list||[])if(d&&Array.isArray(d.p))figNew(d);figShow();figCard()}
/* where things are: the top surface under a spot (boxes, then the floor) */
function figGroundAt(x,z,fromY){let best=0;const rc=new THREE.Raycaster(),o=world.localToWorld(new V(x,fromY??1e4,z)),d=new V(0,-1,0).transformDirection(world.matrixWorld);rc.set(o,d);massGroup.updateMatrixWorld(true);
  const h=rc.intersectObjects(blocks.map(b=>b.mesh),false)[0];if(h){const y=world.worldToLocal(h.point.clone()).y;if(y>best)best=y}return best}
/* two-bone reach: move a hand or foot toward T (model space); the shoulder or hip swings and the elbow or knee folds, within their ranges */
function figIK(F,part,Tm){const arm=part.startsWith('hand'),s=part.slice(-1),A=F.J[s+(arm?'Sh':'Hip')],B=F.J[s+(arm?'El':'Kn')],H=F.h,a=(arm?.186:.245)*H,b=(arm?.206:.246)*H;
  F.g.updateMatrixWorld(true);const T=world.localToWorld(Tm.clone()),S=A.getWorldPosition(new V()),ws=world.scale.x,aw=a*ws,bw=b*ws;
  let d=T.clone().sub(S);const dl=Math.max(Math.abs(aw-bw)+1e-4,Math.min(aw+bw-1e-4,d.length()));const dir=d.normalize();
  /* elbows point back and a little out; knees point forward */
  const pq=A.parent.getWorldQuaternion(new THREE.Quaternion()),out=s==='l'?1:-1,pole=(arm?new V(.3*out,-.3,-1):new V(.15*out,0,1)).applyQuaternion(pq);let pp=pole.clone().addScaledVector(dir,-pole.dot(dir));if(pp.lengthSq()<1e-8)pp=new V(0,0,arm?-1:1).applyQuaternion(pq);pp.normalize();
  const ca=(aw*aw+dl*dl-bw*bw)/(2*aw*dl),al=Math.acos(Math.max(-1,Math.min(1,ca))),M=S.clone().addScaledVector(dir,aw*Math.cos(al)).addScaledVector(pp,aw*Math.sin(al));
  const u=M.clone().sub(S).normalize(),bd=pp.clone().negate().addScaledVector(u,pp.dot(u)).normalize(),Yw=u.clone().negate(),Zw=arm?bd:bd.clone().negate(),Xw=new V().crossVectors(Yw,Zw).normalize();
  const qW=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xw,Yw,Zw)),qL=pq.clone().invert().multiply(qW),e=new THREE.Euler().setFromQuaternion(qL,'XZY'),sg=s==='l'?1:-1;
  const flex=180-Math.acos(Math.max(-1,Math.min(1,(aw*aw+bw*bw-dl*dl)/(2*aw*bw))))*180/Math.PI;
  F.ang[s+(arm?'Sh':'Hip')]=[-e.x*180/Math.PI,sg*e.z*180/Math.PI,sg*e.y*180/Math.PI];F.ang[s+(arm?'El':'Kn')]=flex;if(F.pose!=='custom')F.anchor=F.anchor||FIG_POSES[F.pose]?.anchor||'low';F.pose='custom';F.a=F.ang;figApply(F)}
/* ---- desktop: pick, drag, the Model tab card and the right-click menu ---- */
function figHit(rc){const T=[];figRoot.traverse(o=>{if(o.isMesh&&o.visible)T.push(o)});const h=rc.intersectObjects(T,false);if(!h.length)return null;
  const hd=h.find(x=>x.object.material===figHandleM);return hd?{F:hd.object.userData.fig,part:hd.object.userData.part,hit:hd}:{F:h[0].object.userData.fig,part:'body',hit:h[0]}}
function figSelect(F){figSel=F;if(F&&sel)select(null);figShow();figCard();if(xrMode)drawMenu()}
function figCard(){const c=$('#figCard');if(!c)return;c.hidden=!figSel;$('#figAdd').textContent=figs.length?'+ Add another figure':'+ Add a figure';if(!figSel)return;const F=figSel;
  $('#figH').value=F.h;$('#figHLab').textContent=`${ftIn(F.h)} · ${Math.round(F.h*2.54)} cm`;$$('#figPoses button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.pose===F.pose))}
function figAddInFront(){let x=0,z=0;if(blocks.length){let mx=-1e9;for(const b of blocks)for(const f of b.faces||[])for(const q of f.poly)mx=Math.max(mx,q.x);x=mx+18}
  const F=figNew({p:[x,figGroundAt(x,z),z],h:69,pose:'stand'});figSelect(F);save();return F}
{const pc=$('#figPoses');if(pc)pc.innerHTML=FIG_KEYS.map(k=>`<button data-pose="${k}" aria-pressed="false">${FIG_POSES[k].name}</button>`).join('')}
$('#figAdd')&&($('#figAdd').onclick=()=>{figAddInFront();toast('Figure added. Drag it onto your design; drag a hand or foot to pose it.')});
$('#figPoses')&&($('#figPoses').onclick=e=>{const k=e.target.closest('[data-pose]')?.dataset.pose;if(!k||!figSel)return;figSetPose(figSel,k)});
function figSetPose(F,k){F.pose=k;F.a=null;F.anchor=null;figPose(F);
  /* a pose that sits or holds on lands on the surface under it; a standing one on the top surface below its spot */
  if((FIG_POSES[k].anchor||'low')!=='hands'){F.p[1]=figGroundAt(F.p[0],F.p[2],F.p[1]+F.h*.2);figPlace(F)}figShow();figCard();save()}
$('#figH')&&($('#figH').oninput=e=>{if(!figSel)return;figSel.h=+e.target.value;const keep=figSel.ang;figRebuild(figSel);if(figSel.pose==='custom'){figSel.ang=keep;figApply(figSel);figAnchor(figSel)}figCard()});
$('#figH')&&($('#figH').onchange=()=>save());
$('#figTurnL')&&($('#figTurnL').onclick=()=>{if(!figSel)return;figSel.ry=((figSel.ry||0)+15)%360;figPlace(figSel);save()});
$('#figTurnR')&&($('#figTurnR').onclick=()=>{if(!figSel)return;figSel.ry=((figSel.ry||0)-15)%360;figPlace(figSel);save()});
$('#figDel')&&($('#figDel').onclick=()=>{if(!figSel)return;figRemove(figSel);save();toast('Figure removed')});
$$('[data-figh]').forEach(b=>b.onclick=()=>{if(!figSel)return;$('#figH').value=+b.dataset.figh;$('#figH').oninput({target:$('#figH')});save()});
/* dragging on the computer: a hand or foot reaches, the body moves the whole figure across whatever it stands on */
let figDrag=null;
function figRay(e){const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);return ray}
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0||xrMode||!figRoot.visible||!figs.length)return;const h=figHit(figRay(e));if(!h)return;
  e.stopImmediatePropagation();e.preventDefault();if(figSel!==h.F)figSelect(h.F);orbit.enabled=false;
  const W=h.hit.point.clone(),n=camera.getWorldDirection(new V());figDrag={F:h.F,part:h.part,plane:new THREE.Plane().setFromNormalAndCoplanarPoint(n,W),x:e.clientX,y:e.clientY,moved:false,off:world.worldToLocal(W.clone()).sub(new V().fromArray(h.F.p))}},{capture:true});
addEventListener('pointermove',e=>{if(!figDrag)return;if(!figDrag.moved&&Math.hypot(e.clientX-figDrag.x,e.clientY-figDrag.y)<4)return;figDrag.moved=true;const F=figDrag.F,rc=figRay(e);
  if(figDrag.part!=='body'){const W=rc.ray.intersectPlane(figDrag.plane,new V());if(W)figIK(F,figDrag.part,world.worldToLocal(W));return}
  /* the body: onto the box face under the pointer (a hanging pose grips any edge it is put on), else the floor */
  const an=F.anchor||FIG_POSES[F.pose]?.anchor||'low';massGroup.updateMatrixWorld(true);const h=rc.intersectObjects(blocks.map(b=>b.mesh),false)[0];let P=null;
  if(h&&(an==='hands'||h.face&&h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.6))P=world.worldToLocal(h.point.clone());
  else{const W=rc.ray.intersectPlane(new THREE.Plane(new V(0,1,0),0),new V());if(W){P=world.worldToLocal(W);P.y=0}}
  if(P){F.p=[P.x,P.y,P.z];figPlace(F)}});
addEventListener('pointerup',()=>{if(!figDrag)return;const d=figDrag;figDrag=null;orbit.enabled=true;if(d.part!=='body'&&d.moved)figAnchor(d.F);if(d.moved)save();figCard()});
/* clicking empty space lets a figure go */
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0||xrMode||!figSel)return;setTimeout(()=>{if(!figDrag&&figSel){const h=figHit(figRay(e));if(!h)figSelect(null)}},0)});
addEventListener('keydown',e=>{if(!figSel||xrMode||e.target.closest?.('input,textarea,select'))return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();figRemove(figSel);save()}},{capture:true});
/* ---- headset: trigger a hand or foot to reach with it, trigger the body to pick the figure, grip to carry it ---- */
function xrFigTrigger(c){if(!figRoot.visible||!figs.length)return false;const h=figHit(ctrlRay(c));if(!h)return false;figSelect(h.F);
  if(h.part!=='body'){c.userData.figIK={F:h.F,part:h.part,D0:h.hit.distance};menuMsg='Reaching: move your hand to place it.'}else menuMsg=`Figure, ${ftIn(h.F.h)}: ${FIG_POSES[h.F.pose]?.name||'your own pose'}. Grip it to carry it somewhere.`;buzz(c,.3,20);drawMenu();return true}
function xrFigTick(c){const U=c.userData.figIK;if(!U)return false;ctrlRay(c);figIK(U.F,U.part,world.worldToLocal(xray.ray.origin.clone().addScaledVector(xray.ray.direction,U.D0)));return true}
function xrFigEnd(c){const U=c.userData.figIK;if(!U)return false;c.userData.figIK=null;figAnchor(U.F);save();return true}
function xrFigGrab(c){if(!figRoot.visible||!figs.length)return false;const h=figHit(ctrlRay(c));if(!h)return false;figSelect(h.F);c.userData.figGrab=h.F;c.attach(h.F.g);buzz(c,.3,20);return true}
function xrFigRelease(c){const F=c.userData.figGrab;if(!F)return false;c.userData.figGrab=null;figRoot.attach(F.g);const e=new THREE.Euler().setFromQuaternion(F.g.quaternion,'YXZ');F.ry=e.y*180/Math.PI;
  F.p=F.g.position.toArray();if((F.anchor||FIG_POSES[F.pose]?.anchor||'low')!=='hands')F.p[1]=figGroundAt(F.p[0],F.p[2],F.p[1]+F.h*.15);figPlace(F);save();menuMsg='Figure set down.';drawMenu();return true}
