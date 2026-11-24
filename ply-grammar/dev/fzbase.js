/* torture test: random obstacles through panelizing, overlap, build-order, fit and screw checks.
   node h.mjs [count] [firstSeed] [verbose seed]  */
const world=new THREE.Group(),WHYT={},BST={bear:[],emb:[],edge:[],area:[],open:[],before:[],plan:[],got:[],none:[]};
function mk(p,s,cuts){const b={cuts:[],carves:[],pivot:new THREE.Object3D(),sizer:new THREE.Object3D(),edgeOpts:{}};world.add(b.pivot);b.pivot.position.fromArray(p);b.sizer.scale.fromArray(s);b.pivot.add(b.sizer);
  for(const c of cuts){const o=new THREE.Object3D();o.position.fromArray(c.p);o.quaternion.setFromUnitVectors(new V(0,0,1),new V(...c.n).normalize());o.userData.cid='c'+b.cuts.length;b.pivot.add(o);b.cuts.push(o)}return b}
const carve=(b,p,s)=>{const o=new THREE.Object3D(),z=new THREE.Object3D();o.position.fromArray(p);z.scale.fromArray(s);o.add(z);o.userData={cid:'v'+b.carves.length,sizer:z};b.pivot.add(o);b.carves.push(o);return o};
function rng(seed){let a=seed>>>0;return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function gen(seed){const R=rng(seed*7919+13),ri=(a,b)=>Math.round(a+R()*(b-a)),pick=a=>a[Math.floor(R()*a.length)];
  if(process.env.SK){/* sketched solids: prisms with all sorts of outlines, a block standing on a block, a few leaning shapes */
    const kind=process.env.SK==='1'?pick(['box','ramp','L','house','step','U','T','frustum','stairs','lean']):process.env.SK,w=ri(18,60),h=ri(12,44),dp=ri(14,48);let prof=null,V_={},F_=[],nid=1,desc=kind+' ';
    const prism=(pr,z0,z1)=>{const n=pr.length,a=[],c=[];pr.forEach(([x,y])=>{V_[nid]=[x,y,z1];a.push(nid++);V_[nid]=[x,y,z0];c.push(nid++)});F_.push({ids:a},{ids:c});for(let i=0;i<n;i++)F_.push({ids:[a[i],a[(i+1)%n],c[(i+1)%n],c[i]]})};
    if(kind==='box')prof=[[0,0],[w,0],[w,h],[0,h]];
    else if(kind==='ramp'){const lip=pick([0,0,4,8]);prof=lip?[[0,0],[w,0],[w,lip],[0,h]]:[[0,0],[w,0],[0,h]]}
    else if(kind==='L'){const a=ri(6,w-8),c=ri(6,h-6);prof=[[0,0],[w,0],[w,c],[a,c],[a,h],[0,h]]}
    else if(kind==='house'){const e=ri(6,h-5);prof=[[0,0],[w,0],[w,e],[w/2,h],[0,e]]}
    else if(kind==='U'){const a=ri(6,Math.max(7,w/3)),c=ri(5,h-6);prof=[[0,0],[w,0],[w,h],[w-a,h],[w-a,c],[a,c],[a,h],[0,h]]}
    else if(kind==='T'){const a=ri(5,Math.max(6,w/3)),c=ri(6,h-6);prof=[[a,0],[w-a,0],[w-a,c],[w,c],[w,h],[0,h],[0,c],[a,c]]}
    else if(kind==='stairs'){const n=pick([2,3,3,4]),tr=w/n,rs=h/n;prof=[[0,0],[w,0]];for(let i=0;i<n;i++){prof.push([w-i*tr,(i+1)*rs]);if(i<n-1)prof.push([w-(i+1)*tr,(i+1)*rs])}prof.push([0,h]);prof=prof.filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>1e-6)}
    if(prof)prism(prof,-dp/2,dp/2);
    else if(kind==='step'){prism([[0,0],[w,0],[w,h*.5],[0,h*.5]],-dp/2,dp/2);const a=ri(6,Math.max(7,w*.6)),x0=ri(1,Math.max(1,w-a-1)),d2=ri(6,Math.max(7,dp-4)),z0=-dp/2+ri(1,Math.max(1,dp-d2-1));prism([[x0,h*.5],[x0+a,h*.5],[x0+a,h],[x0,h]],z0,z0+d2);desc+=`top ${a}x${d2} `}
    else if(kind==='frustum'){const i=ri(2,Math.max(3,w/4)),j=ri(2,Math.max(3,dp/4)),B=[[0,0,-dp/2],[w,0,-dp/2],[w,0,dp/2],[0,0,dp/2]],T_=[[i,h,-dp/2+j],[w-i,h,-dp/2+j],[w-i,h,dp/2-j],[i,h,dp/2-j]],a=[],c=[];B.forEach(p=>{V_[nid]=p;a.push(nid++)});T_.forEach(p=>{V_[nid]=p;c.push(nid++)});F_.push({ids:a},{ids:c});for(let k=0;k<4;k++)F_.push({ids:[a[k],a[(k+1)%4],c[(k+1)%4],c[k]]})}
    else if(kind==='lean'){const sx=ri(-10,10),B=[[0,0,-dp/2],[w,0,-dp/2],[w,0,dp/2],[0,0,dp/2]],a=[],c=[];B.forEach(p=>{V_[nid]=p;a.push(nid++)});B.forEach(p=>{V_[nid]=[p[0]+sx,h,p[2]];c.push(nid++)});F_.push({ids:a},{ids:c});for(let k=0;k<4;k++)F_.push({ids:[a[k],a[(k+1)%4],c[(k+1)%4],c[k]]})}
    const b=mk([0,h/2,0],[w,h,dp],[]);for(const k in V_){V_[k][0]-=w/2;V_[k][1]-=h/2}F_.forEach(f=>f.key=EW.faceKey(f.ids));b.sk={V:V_,F:F_};
    if(R()<.2){const o=new THREE.Object3D(),n=new V(pick([-1,1])*.5,.8,pick([0,.3])).normalize();o.position.set(0,h*.25,0);o.quaternion.setFromUnitVectors(new V(0,0,1),n);o.userData.cid='c0';b.pivot.add(o);b.cuts.push(o);desc+='+cut '}
    b.name='A';return {b,desc:desc+`${w}x${h}x${dp} cells ${skCells(b).length}`}}
  const EV=process.env.ROT==='2',s=[ri(14,72),ri(12,54),ri(14,60)],cuts=[],nc=EV?pick([0,1,1]):pick([0,0,1,1,1,2,2,3]);
  for(let i=0;i<nc;i++){const ax=pick([0,2]),sg=pick([-1,1]),ang=pick([15,20,30,35,45,50,60,70])*Math.PI/180,n=[0,Math.cos(ang),0];n[ax]=sg*Math.sin(ang);
    if(R()<.2){n[1]=0;n[ax]=sg*Math.cos(ang);n[2-ax]=pick([-1,1])*Math.sin(ang)}       /* a vertical chamfer now and then */
    const p=[0,0,0];p[1]=n[1]?s[1]*(.5-R()*.55):0;p[ax]=sg*s[ax]*(R()*.45);cuts.push({p,n})}
  const b=mk([0,s[1]/2,0],s,cuts),nv=EV?1:pick([0,0,0,1,1,2]);
  for(let i=0;i<nv;i++){const cs=[0,1,2].map(k=>ri(6,Math.max(7,s[k]*.6))),thru=pick([-1,-1,0,1,2]);if(thru>=0)cs[thru]=s[thru]+4;
    const cp=[0,1,2].map(k=>k===thru?0:Math.round((R()-.5)*(s[k]-cs[k]*.2)));const o=carve(b,cp,cs);
    if(process.env.ROT){const R2=rng(seed*104729+i*31+7),m=R2();if(EV)o.rotation.set(m<.3?(R2()-.5)*.3:0,(R2()-.5)*1.2,0);else o.rotation.set(m<.35?(R2()-.5)*.5:0,(R2()-.5)*1.6,m>.8?(R2()-.5)*.4:0);o.updateMatrixWorld(true)}}
  b.name='A';return {b,desc:`box ${s.join('x')} cuts ${cuts.map(c=>c.n.map(x=>x.toFixed(2)).join(',')+'@'+c.p.map(x=>x.toFixed(0)).join(',')).join(' | ')} carves ${b.carves.map(c=>c.userData.sizer.scale.toArray().join('x')+'@'+c.position.toArray().join(',')).join(' | ')}`}}
/* surface coverage: walk a grid over every outside face, half a ply under the surface; each point must be inside some part.
   Returns the bare spots per face, largest first. */
function coverage(b,r,step=.5,depth=.06){const t=thkModel(),meets=(r.joints||[]).filter(j=>j.joint==='meet').map(j=>({a:j.a,d:j.b.clone().sub(j.a),w:t*Math.tan((180-j.ang)/2*Math.PI/180)+.5})),
  /* the open strip either side of a meet joint is there by design (the two panels stop short and touch at their inside corners) */
  /* ...and so is the mouth of that strip at either end, where the end panel is trimmed back to match */
  nearMeet=X=>meets.some(m=>{const l2=m.d.lengthSq()||1,ex=t*1.5/Math.sqrt(l2),u=Math.max(-ex,Math.min(1+ex,X.clone().sub(m.a).dot(m.d)/l2));return m.a.clone().addScaledVector(m.d,u).distanceTo(X)<m.w}),ps=r.panels.filter(p=>p.part?.length),parts=ps.map((p,i)=>asmPart(p,i)),out=[];
  const faces=b.brep?b.brep.faces.filter(f=>!f.skip).map(f=>({name:'A'+f.num,n:f.n,O:f.O,u:f.u,v:f.v,cts:f.cts})):solidFaces(blockPlanes(b)).map((f,i)=>{const n=f.pl.n,O=f.poly[0],u=f.poly[1].clone().sub(O).normalize(),v=new V().crossVectors(n,u);return {name:'f'+i+':'+f.pl.id,n,O,u,v,cts:[f.poly.map(p=>{const q=p.clone().sub(O);return [q.dot(u),q.dot(v)]})]}});
  for(const f of faces){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;f.cts[0].forEach(([x,y])=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)});const bare=[];
    for(let x=x0+.2;x<x1;x+=step)for(let y=y0+.2;y<y1;y+=step){if(!pip2(f.cts,x,y))continue;const X0=f.O.clone().addScaledVector(f.u,x).addScaledVector(f.v,y);if(nearMeet(X0))continue;
      /* a see-through hole: no wood anywhere through the skin at this spot */
      if([.06,.25,.45,.68].every(h=>{const X=X0.clone().addScaledVector(f.n,-h*t/.75);return !parts.some(P=>inPart(P,X.x,X.y,X.z))}))bare.push([x,y])}
    /* group touching bare points */
    const seen=new Set(),key=(x,y)=>Math.round(x/step)+','+Math.round(y/step),S_=new Map(bare.map(p=>[key(...p),p]));
    for(const p of bare){const k0=key(...p);if(seen.has(k0))continue;const q=[p],grp=[];seen.add(k0);while(q.length){const c=q.pop();grp.push(c);for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){const k=key(c[0]+dx,c[1]+dy);if(S_.has(k)&&!seen.has(k)){seen.add(k);q.push(S_.get(k))}}}
      let a=1e9,b_=1e9,c=-1e9,d=-1e9;grp.forEach(([x,y])=>{a=Math.min(a,x);b_=Math.min(b_,y);c=Math.max(c,x);d=Math.max(d,y)});
      const sq=grp.some(([x,y])=>S_.has(key(x+step,y))&&S_.has(key(x,y+step))&&S_.has(key(x+step,y+step)));
      out.push({face:f.name,sq,area:grp.length*step*step,w:c-a+step,h:d-b_+step,at:[+((a+c)/2).toFixed(1),+((b_+d)/2).toFixed(1)],p3:f.O.clone().addScaledVector(f.u,(a+c)/2).addScaledVector(f.v,(b_+d)/2).toArray().map(x=>+x.toFixed(1)),ext:[+(x1-x0).toFixed(1),+(y1-y0).toFixed(1)]})}}
  return out.sort((p,q)=>q.area-p.area)}

function loadDesign(file){const D=JSON.parse(require('fs').readFileSync(file,'utf8')),d=D.blocks[0];if(D.S)Object.assign(S,D.S);const b={cuts:[],carves:[],pivot:new THREE.Object3D(),sizer:new THREE.Object3D(),edgeOpts:d.edgeOpts||{}};world.add(b.pivot);b.pivot.position.fromArray(d.p);if(d.q)b.pivot.quaternion.fromArray(d.q);b.sizer.scale.fromArray(d.s);b.pivot.add(b.sizer);
  (d.cuts||[]).forEach((c,i)=>{const o=new THREE.Object3D();o.position.fromArray(c.p);if(c.q)o.quaternion.fromArray(c.q);else o.quaternion.setFromUnitVectors(new V(0,0,1),new V(...c.n).normalize());o.userData.cid=c.cid||'c'+i;b.pivot.add(o);b.cuts.push(o)});
  (d.carves||[]).forEach((c,i)=>{const o=new THREE.Object3D(),z=new THREE.Object3D();o.position.fromArray(c.p);if(c.q)o.quaternion.fromArray(c.q);z.scale.fromArray(c.s);o.add(z);o.userData={cid:c.cid||'v'+i,sizer:z,tilt:c.tilt};b.pivot.add(o);b.carves.push(o)});
  if(d.sk)b.sk=d.sk;b.name=d.name||'A';if(d.cleatEdit)b.cleatEdit=d.cleatEdit;if(d.screwEdit)b.screwEdit=d.screwEdit;world.updateMatrixWorld(true);return {b,desc:'design '+file}}
function check(seed,verbose){if(process.env.WHY){globalThis.DBG={jt:'*'}}Object.assign(S,{scaleDen:1,...FULL_DEF});if(process.env.SET)Object.assign(S,JSON.parse(process.env.SET));const {b,desc}=process.env.DESIGN?loadDesign(process.env.DESIGN):gen(seed);if(process.env.DUMP&&verbose)require('fs').writeFileSync('d_seed'+seed+'.json',JSON.stringify({app:'ply-grammar',v:3,blocks:[{name:'A',p:b.pivot.position.toArray(),s:b.sizer.scale.toArray(),cuts:b.cuts.map(c=>({p:c.position.toArray(),q:c.quaternion.toArray()})),carves:b.carves.map(c=>({cid:c.userData.cid,p:c.position.toArray(),q:c.quaternion.toArray(),s:c.userData.sizer.scale.toArray()})),sk:b.sk}]}));const out={seed,desc,issues:[]},I=(k,m)=>out.issues.push([k,m]),name0='A';
  if(process.env.KEY)S.keyShape=process.env.KEY;
  if(process.env.FORCE){try{const r0=panelizeBlock(b),ar=p=>p.part.reduce((x,c)=>x+areaF(c),0),big=r0.panels.filter(p=>p.part?.length&&p.kind!=='cleat'&&!p.splice).sort((x,y)=>ar(y)-ar(x)).slice(0,2);b.forceSplit={};big.forEach(p=>b.forceSplit[p.label]=2);out.forced=big.map(p=>p.label)}catch(e){}}
  if(process.env.TIME){panelizeBlock(b);const t0=Date.now();for(let i=0;i<5;i++)panelizeBlock(b);console.log(' panelize ms',((Date.now()-t0)/5).toFixed(0));if(globalThis.PROF)console.log(JSON.stringify(PROF))}
  let r;try{r=panelizeBlock(b)}catch(e){I('crash',e.message+' @ '+(e.stack.split('\n')[1]||'').trim().slice(0,90));return out}
  const ps=r.panels.filter(p=>p.part?.length);
  const solid=b.brep?b.brep.faces.length:solidFaces(piecesOf(b)[0]||blockPlanes(b)).length;
  if(!ps.length){if(solid>=4)I('empty','no parts from a real solid');return out}
  for(const p of ps)for(const c of p.part)for(const q of c)if(!isFinite(q[0])||!isFinite(q[1])){I('nan',p.label);break}
  const [Wu,Hu]=sheetUse();
  for(const p of ps){let a=1e9,c=-1e9,d=1e9,e=-1e9,A=0;p.part.forEach(q=>{A+=areaF(q);q.forEach(([x,y])=>{a=Math.min(a,x);c=Math.max(c,x);d=Math.min(d,y);e=Math.max(e,y)})});
    if(p.kind!=='cleat'&&A<6)I('tiny',p.label+' '+A.toFixed(1)+' sq in');
    if(Math.min(c-a,e-d)>Math.min(Wu,Hu)+.01||Math.max(c-a,e-d)>Math.max(Wu,Hu)+.01){/* rotated fit */const out2=p.part.reduce((m,q)=>areaF(q)>areaF(m)?q:m,p.part[0]);let ok=false;
      for(let i=0;i<out2.length&&!ok;i++){const p0=out2[i],p1=out2[(i+1)%out2.length],th=Math.atan2(p1[1]-p0[1],p1[0]-p0[0]),cs=Math.cos(th),sn=Math.sin(th);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
        for(const [x,y] of out2){const X=x*cs+y*sn,Y=-x*sn+y*cs;x0=Math.min(x0,X);x1=Math.max(x1,X);y0=Math.min(y0,Y);y1=Math.max(y1,Y)}const w=x1-x0,h=y1-y0;if((w<=Wu&&h<=Hu)||(w<=Hu&&h<=Wu))ok=true}
      if(!ok)I('oversize',p.label)}}
  if(b.brep&&b.freeEdges)I('open-shell',b.freeEdges+' free edges');
  /* no panel in two pieces, and none held together by a neck narrower than 5/8 in */
  for(const p of ps){if(p.kind!=='face')continue;const outs=p.part.filter(c=>areaF(c)>.05);
    /* a face that is itself drawn with a thin arm or neck (a cut-out that leaves a lip) is the design's doing, not the joints' */
    if(p.face&&outs.length>1&&!p.splice){const fo=offsetC(p.face.map(c=>rawC(c)),-1.1,false).map(fromC),big=outs.reduce((m,c)=>areaF(c)>areaF(m)?c:m,outs[0]);
      if(outs.every(c=>c===big||(()=>{const cx=c.reduce((s_,q)=>s_+q[0],0)/c.length,cy=c.reduce((s_,q)=>s_+q[1],0)/c.length;return !pip2(fo,cx,cy)})())){I('thin-face(explained)',p.label);continue}}
    if(outs.length>1&&!p.splice){I('split-part',p.label+' in '+outs.length);continue}
    const sm=offsetC(p.part.map(rawC),-.31,false).map(fromC).filter(c=>areaF(c)>.3);if(sm.length>outs.length)I('thin-neck',p.label)}
  /* no see-through hole an inch square or more anywhere on the outside */
  {const hs=coverage(b,r).filter(x=>x.sq);if(hs.length)I('hole',hs.length+' biggest '+hs[0].face+' '+hs[0].area.toFixed(1)+'sq in'+(verbose?' at '+JSON.stringify(hs.map(h=>[h.face,h.p3,h.w,h.h])):''))}
  /* every outside corner filled: walk each shell edge half a ply under both faces; that stick of wood must belong to some part.
     And no two neighbors may lie in one plane: that is one plate wrongly cut in two. */
  if(b.brep){const t=thkModel(),parts=ps.map((p,i)=>asmPart(p,i)),F=b.brep.faces.slice().sort((x,y)=>x.i-y.i);
    /* beside a meet joint the corner is cut back on purpose, and the panels at its ends are trimmed to match */
    const meets=(r.joints||[]).filter(j=>j.joint==='meet').map(j=>({a:j.a,d:j.b.clone().sub(j.a),w:t*Math.tan((180-j.ang)/2*Math.PI/180)+1.2})),nearM=X=>meets.some(m=>{const l2=m.d.lengthSq()||1,u=Math.max(0,Math.min(1,X.clone().sub(m.a).dot(m.d)/l2));return m.a.clone().addScaledVector(m.d,u).distanceTo(X)<m.w});
    F.forEach(f=>f.E.forEach(e=>{if(e.nb<0||e.nb<f.i||e.L<4*t)return;const g=F[e.nb];if(f.skip||g.skip)return;const c=f.n.dot(g.n);
      if(c>.999){I('split-plate',name0+f.num+'|'+name0+g.num);return}if(!e.convex||c<-.9||(S.meetAngle>0&&c>Math.cos(S.meetAngle*Math.PI/180))||(S.meetSharp>0&&-c>Math.cos(S.meetSharp*Math.PI/180)))return;/* a 'meet' joint is an open V by design */const a=-(t/2)/(1+c),dir=e.B.clone().sub(e.A).normalize();let miss=0,run=0,best=0;
      for(let s=3*t;s<e.L-3*t;s+=.25){const X=e.A.clone().addScaledVector(dir,s).addScaledVector(f.n,a).addScaledVector(g.n,a);if(nearM(X)||parts.some(P=>inPart(P,X.x,X.y,X.z)))run=0;else{miss++;run++;best=Math.max(best,run)}}
      if(best>=4){const th=b.thin||[],ex=th.some(x=>[x.A,x.B].includes(name0+f.num)||[x.A,x.B].includes(name0+g.num));I(ex?'empty-socket-thin(explained)':'empty-socket',name0+f.num+'|'+name0+g.num+' '+(best*.25).toFixed(1)+'in')}}))}
  const mp=mergeSplices(ps),faces=mp.filter(p=>p.kind==='face');if(!faces.length){I('nofaces','');return out}
  const base=basePanel(faces).label,plan=planAssembly(mp,base),P=plan.parts,thin=b.thin||[];
  /* audit: every block screwed from both of its panels; every joint that relies on blocks has one; every screw ends in wood */
  {const by={};for(const sc of r.screws||[]){if(!sc.edge||!/^(J|JK)\d/.test(sc.edge))continue;(by[sc.edge]=by[sc.edge]||new Set()).add(sc.name)}const one=Object.entries(by).filter(([k,v])=>v.size<2).map(([k])=>k);if(one.length)I('block-screwed-one-side',one.join(' '));
    const nb=mp.filter(p=>p.kind==='cleat').length;if(nb>Object.keys(by).length)I('block-no-screws',String(nb-Object.keys(by).length));
    const cl={};mp.filter(p=>p.kind==='cleat'&&!p.cleat?.rib).forEach(p=>cl[p.joint]=1);const un=(r.joints||[]).filter(j=>j.joint==='meet'&&!cl[j.label]).map(j=>j.label+'('+j.ang+')');if(un.length&&S.blocks!==false)I('meet-joint-no-block(explained)',un.join(' '));
    const tt=thkModel(),air=[];for(const sc of r.screws||[]){if(!sc.p3||!sc.n)continue;const X=sc.p3.clone().addScaledVector(sc.n,-(tt+Math.min(.5,tt*.6)));if(!P.some(A=>A.label!==sc.name&&inPart(A,X.x,X.y,X.z)))air.push(sc.name+':'+sc.edge)}if(air.length)I('screw-into-air',air.length+' e.g. '+air.slice(0,verbose?40:3).join(' '))}
  if(process.env.BLK){for(const [k,m] of blockAudit(b,r,plan,P,BST))I(k,m)}
  if(process.env.SECT&&verbose)blockSections(r,P,process.env.SECT,process.env.ONLY?process.env.ONLY.split(','):null);
  /* a corner block must have something to hold it when it goes in */
  {const at=new Map();plan.steps.forEach((s,k)=>{at.set(s.i,k);s.with.forEach(j=>at.set(j,k))});const fl=plan.parts.filter(P=>P.kind==='cleat'&&![...plan.touch[P.idx]].some(j=>at.get(j)<=at.get(P.idx)));if(fl.length)I('floating-block',fl.map(P=>P.label).join(' '))}
  for(const [i,j] of plan.clash){const ex=thin.some(x=>[x.A,x.B].includes(P[i].label)||[x.A,x.B].includes(P[j].label))||b.strips?.length>0;I(ex?'overlap-thin(explained)':'overlap',P[i].label+'x'+P[j].label)}
  for(const s of plan.steps)if(s.stuck)I('stuck',P[s.i].label+'['+s.stuck.join('/')+']');
  P.forEach((p,i)=>{if(i!==P.findIndex(q=>q.label===base)&&!plan.touch[i].size)I('floating',p.label)});
  const fl=r.screws.filter(s=>s.flag).length;if(fl)I('screw-flag',fl+'');
  if(b.carveWarn)I('sliver-dropped(explained)','');if(b.strips?.length)I('strip-kept(explained)','');if(b.brep&&b.openStrips?.length)I('strip-open(explained)','');if(b.softened?.length)I('strip-softened(explained)','');
  if(globalThis.DBG?.sd){for(const j of r.joints||[]){if(!j.blk||j.nBlk>0)continue;const L=j.a.distanceTo(j.b);if(!new Set(cleatSpots(L,S.cleatLeg,thkModel()).cands.map(c=>c.g)).size)continue;const k=j.label.replace(/[A-Z]/g,''),top=Object.entries(DBG.sd[k]||{}).filter(x=>!x[0].startsWith('  ')).sort((x,y)=>y[1]-x[1])[0];const key=(j.inside?'inside ':j.joint==='meet'?'meet ':'outside ')+(top?top[0].replace(/[0-9.]+/g,'#'):'no candidates');(WHYT[key]=WHYT[key]||[]).push(seed+":"+j.label+":"+L.toFixed(0))}if(!verbose)DBG.sd={}}
  if(verbose&&globalThis.DBG?.sd){for(const j of r.joints||[]){if(!j.blk)continue;const n_=new Set(cleatSpots(j.a.distanceTo(j.b),S.cleatLeg,thkModel()).cands.map(c=>c.g)).size;if(j.nBlk>=n_)continue;const k=j.label.replace(/[A-Z]/g,'');console.log(j.nBlk?' FEW '+j.nBlk+'/'+n_:' NONE',j.label,j.joint,j.ang+'deg',j.a.distanceTo(j.b).toFixed(0)+'in',JSON.stringify(Object.entries(DBG.sd[k]||{}).sort((x,y)=>y[1]-x[1]).slice(0,9)))}}
  if(verbose&&globalThis.DBGW){console.log(' why',JSON.stringify(globalThis.DBGW));console.log(' joints',JSON.stringify((r.joints||[]).filter(j=>j.blk).map(j=>[j.label,j.joint,j.ang,+j.a.distanceTo(j.b).toFixed(0),j.nBlk])))}
  if(verbose&&process.env.ORDER)console.log(' order',plan.steps.map(s=>P[s.i].label+(s.with.length?'+'+s.with.map(j=>P[j].label).join('+'):'')+(s.stuck?'!STUCK':'')).join(' '));
  if(verbose){console.log(desc);console.log(' parts',ps.map(p=>p.label).join(' '));console.log(' thin',JSON.stringify(thin.map(x=>[x.A,x.B,x.th.toFixed(2)])))}
  return out}
/* deep corner-block audit, on the finished parts only (nothing here trusts how the blocks were planned).
   Returns a list of [kind,detail] and pushes numbers into `stats`. */
function blockAudit(b,r,plan,P,stats){const out=[],I=(k,m)=>out.push([k,m]),t=thkModel(),sLen=S.screwLen,stepOf=new Map();plan.steps.forEach((s,k)=>{stepOf.set(s.i,k);s.with.forEach(j=>stepOf.set(j,k))});
  const dSeg=(x,y,a,c)=>{const ex=c[0]-a[0],ey=c[1]-a[1],l2=ex*ex+ey*ey||1e-9,u=Math.max(0,Math.min(1,((x-a[0])*ex+(y-a[1])*ey)/l2));return Math.hypot(x-a[0]-ex*u,y-a[1]-ey*u)};
  const dC=(cts,x,y)=>{let m=1e9;for(const ct of cts)for(let i=0;i<ct.length;i++)m=Math.min(m,dSeg(x,y,ct[i],ct[(i+1)%ct.length]));return m};
  const loc=(A,X)=>{const d=X.clone().sub(A.O);return [d.dot(A.u),d.dot(A.v),d.dot(A.n)]},at=(X,skip)=>P.filter(A=>A!==skip&&inPart(A,X.x,X.y,X.z));
  const blocks=P.filter(A=>A.kind==='cleat'),tagOf=A=>{const m=/(K|J)(\d+)$/.exec(A.label);return m?(m[1]==='K'?'JK':'J')+m[2]:null};
  const dirs=[];{const n=80,ga=Math.PI*(3-Math.sqrt(5));for(let i=0;i<n;i++){const y=1-2*(i+.5)/n,rr=Math.sqrt(1-y*y),th=i*ga;dirs.push(new V(Math.cos(th)*rr,y,Math.sin(th)*rr))}}
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(const A of P)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],A.mn[k]);mx[k]=Math.max(mx[k],A.mx[k])}
  const inBB=X=>X.x>mn[0]&&X.x<mx[0]&&X.y>mn[1]&&X.y<mx[1]&&X.z>mn[2]&&X.z<mx[2];
  const labs=new Set();
  for(const A of blocks){const tag=tagOf(A),rib=A.p.sub==='rib',rfx=!!A.p.cleat?.rfx,nm=A.label+(rfx?'(in)':rib?'(rib)':'')+' '+A.p.joint;if(labs.has(A.label))I('blk-duplicate-label',A.label);labs.add(A.label);
    /* 1. what it bears on, and for how long */
    const bear={};for(const ct of A.cts)for(let i=0;i<ct.length;i++){const a=ct[i],c=ct[(i+1)%ct.length],ex=c[0]-a[0],ey=c[1]-a[1],L=Math.hypot(ex,ey);if(L<1e-6)continue;const k=Math.max(1,Math.ceil(L/.12)),nx=-ey/L,ny=ex/L;
      for(let j=0;j<k;j++){const x=a[0]+ex*(j+.5)/k,y=a[1]+ey*(j+.5)/k;let sx=x+nx*.07,sy=y+ny*.07;if(pipC(A.cts,sx,sy)){sx=x-nx*.07;sy=y-ny*.07}
        const X=A.O.clone().addScaledVector(A.u,sx).addScaledVector(A.v,sy);for(const B of at(X,A))if(B.kind!=='cleat')bear[B.label]=(bear[B.label]||0)+L/k}}
    const bs=Object.entries(bear).filter(([k,v])=>v>=.9).sort((x,y)=>y[1]-x[1]);if(bs.length<2)I('blk-bears-on-one',nm+' '+JSON.stringify(Object.fromEntries(Object.entries(bear).map(([k,v])=>[k,+v.toFixed(1)]))));
    else stats.bear.push(bs[1][1]);
    /* 2. its screws */
    const scs=(r.screws||[]).filter(sc=>sc.edge===tag&&sc.p3&&sc.n),segs=[];
    for(const sc of scs){const own=at(sc.p3.clone().addScaledVector(sc.n,-t*.5),A).find(B=>B.kind!=='cleat');if(!own){I('blk-screw-head-in-air',nm);continue}
      let emb=0,minW=1e9,offC=0,deep=0;for(let d=t+.02;d<=sLen;d+=.04){const X=sc.p3.clone().addScaledVector(sc.n,-d);if(!inPart(A,X.x,X.y,X.z))continue;emb+=.04;deep=d;const q=loc(A,X);if(d>t+.3)minW=Math.min(minW,dC(A.cts,q[0],q[1]));offC=Math.max(offC,Math.abs(q[2]-(A.z0+A.z1)/2))}
      stats.emb.push(emb);if(emb<.45)I('blk-screw-shallow',nm+' from '+own.label+' '+emb.toFixed(2)+'in');
      if(minW<.2)I('blk-screw-thin-wood',nm+' from '+own.label+' '+minW.toFixed(2));if(offC>.13)I('blk-screw-off-centre',nm+' '+offC.toFixed(2));
      const tip=sc.p3.clone().addScaledVector(sc.n,-(sLen-.03));if(emb>0&&deep<sLen-.15&&!at(tip,null).length)I('blk-screw-pokes-through',nm+' from '+own.label+' '+(sLen-deep).toFixed(2)+'in bare');
      const h=loc(own,sc.p3),ed=dC(own.cts,h[0],h[1]);stats.edge.push(ed);if(ed<.3)I('blk-screw-near-panel-edge',nm+' on '+own.label+' '+ed.toFixed(2)+'in');
      /* can a driver get at the head when it is time to drive it? */
      const drive=Math.max(stepOf.get(own.idx)??0,stepOf.get(A.idx)??0);let blk=null;for(let d=.15;d<=7&&!blk;d+=.2){const X=sc.p3.clone().addScaledVector(sc.n,d);blk=at(X,null).find(B=>B!==own)||null}
      if(blk){if((stepOf.get(blk.idx)??0)<=drive)I('blk-screw-no-access',nm+' head on '+own.label+' behind '+blk.label);else stats.before.push(1)}
      segs.push([sc.p3,sc.p3.clone().addScaledVector(sc.n,-sLen),own.label])}
    const sides=new Set(segs.map(s=>s[2]));if(sides.size<2)I('blk-screwed-from<2',nm+' '+[...sides].join('+'));
    for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){const d=segDist(segs[i][0],segs[i][1],segs[j][0],segs[j][1]);if(d<.3)I('blk-screws-cross',nm+' '+d.toFixed(2))}
    /* 3. its shape */
    const ar=A.p.part.reduce((s,c)=>s+areaF(c),0),er=offsetC(A.p.part.map(rawC),-.3,false).map(fromC).filter(c=>Math.abs(areaF(c))>.15);stats.area.push(ar);
    if(ar<4)I('blk-tiny',nm+' '+ar.toFixed(1)+'sq in');else if(!er.length)I('blk-all-thin',nm);else if(er.length>1)I('blk-thin-neck',nm);
    /* 4. nothing of it sticks out through a face */
    {let worst=0,who='';for(const B of P){if(B.kind!=='face'||!B.p.face)continue;for(let i=0;i<A.P.length;i+=3){const q=loc(B,new V(A.P[i],A.P[i+1],A.P[i+2]));if(q[2]>worst&&pip2(B.p.face,q[0],q[1])){worst=q[2];who=B.label}}}
      if(worst>.2)I('blk-pokes-out',nm+' '+worst.toFixed(2)+'in past '+who)}
    /* 5. a hand can still get to it when it goes in */
    {const k=stepOf.get(A.idx)??0,placed=P.filter(B=>B!==A&&(stepOf.get(B.idx)??0)<k);let open=0;for(const d of dirs){let hit=false;for(let s=.4;s<200&&!hit;s+=.35){const X=A.c.clone().addScaledVector(d,s);if(!inBB(X))break;hit=placed.some(B=>inPart(B,X.x,X.y,X.z))}if(!hit)open++}
      stats.open.push(open/dirs.length);if(!open)I('blk-sealed-in',nm+' step '+k+'/'+plan.steps.length)}}
  /* 6. along each joint: enough of them, evenly */
  {const by={};for(const A of blocks){if(A.p.sub==='rib'||!A.p.cleat)continue;(by[A.p.joint]=by[A.p.joint]||{L:A.p.cleat.L,xs:[]}).xs.push(A.p.cleat.x)}
    for(const [j,o] of Object.entries(by)){o.xs.sort((x,y)=>x-y);const gaps=o.xs.slice(1).map((x,i)=>x-o.xs[i]),end=Math.max(o.xs[0],o.L-o.xs[o.xs.length-1]),mg=Math.max(0,...gaps);
      if(mg>S.cleatSpacing*2.2+S.cleatLeg)I('blk-gap',j+' '+mg.toFixed(0)+'in between blocks, joint '+o.L.toFixed(0)+'in');if(end>S.cleatSpacing*1.6+S.cleatLeg)I('blk-end-bare',j+' '+end.toFixed(0)+'in from an end, joint '+o.L.toFixed(0)+'in');
      if(gaps.length&&Math.min(...gaps)<t*1.6)I('blk-crowded',j+' '+Math.min(...gaps).toFixed(1)+'in apart')}}
  return out}
const N=+process.argv[2]||100,S0=+process.argv[3]||1,VS=process.argv[4];
if(VS){const o=check(+VS,true);console.log(o.issues);process.exit(0)}
const G={},t0=Date.now();
for(let s=S0;s<S0+N;s++){const o=check(s);const real=o.issues.filter(([k])=>!k.includes('(explained)'));const grp=process.env.SK?o.desc.split(' ')[0]:/carves \S/.test(o.desc)?'with cut-outs':/cuts \S/.test(o.desc)?'cuts only':'plain box';
  const g=G[grp]=G[grp]||{n:0,clean:0,tally:{}};g.n++;if(!real.length)g.clean++;
  for(const k of new Set(o.issues.map(x=>x[0]))){(g.tally[k]=g.tally[k]||[]).push(s)}}
console.log(`${N} shapes, ${((Date.now()-t0)/1000).toFixed(0)}s`);
if(process.env.WHY){for(const [k,v] of Object.entries(WHYT).sort((a,b)=>b[1].length-a[1].length))console.log('  none:',k.padEnd(34),String(v.length).padStart(3),v.slice(0,6).join(' '))}
if(process.env.BLK){const q=(a,p)=>{a=a.slice().sort((x,y)=>x-y);return a.length?+a[Math.floor((a.length-1)*p)].toFixed(2):null};{const sum=a=>a.reduce((x,y)=>x+y,0);console.log('  blocks planned',sum(BST.plan),'placed',sum(BST.got),'('+Math.round(100*sum(BST.got)/Math.max(1,sum(BST.plan)))+'%)  joints with none',BST.none.length,'of',BST.plan.length)}for(const k in BST)console.log('  stat',k.padEnd(7),'n',BST[k].length,'min',q(BST[k],0),'p5',q(BST[k],.05),'med',q(BST[k],.5),'max',q(BST[k],1))}
for(const [grp,g] of Object.entries(G)){console.log(`${grp}: ${g.n} shapes, ${g.clean} clean (${Math.round(g.clean/g.n*100)}%)`);
  for(const [k,v] of Object.entries(g.tally).sort((a,b)=>b[1].length-a[1].length))console.log('   ',k.padEnd(28),String(v.length).padStart(4),' seeds',v.slice(0,14).join(','))}
