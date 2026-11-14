/* torture test: random obstacles through panelizing, overlap, build-order, fit and screw checks.
   node h.mjs [count] [firstSeed] [verbose seed]  */
const world=new THREE.Group();
function mk(p,s,cuts){const b={cuts:[],carves:[],pivot:new THREE.Object3D(),sizer:new THREE.Object3D(),edgeOpts:{}};world.add(b.pivot);b.pivot.position.fromArray(p);b.sizer.scale.fromArray(s);b.pivot.add(b.sizer);
  for(const c of cuts){const o=new THREE.Object3D();o.position.fromArray(c.p);o.quaternion.setFromUnitVectors(new V(0,0,1),new V(...c.n).normalize());o.userData.cid='c'+b.cuts.length;b.pivot.add(o);b.cuts.push(o)}return b}
const carve=(b,p,s)=>{const o=new THREE.Object3D(),z=new THREE.Object3D();o.position.fromArray(p);z.scale.fromArray(s);o.add(z);o.userData={cid:'v'+b.carves.length,sizer:z};b.pivot.add(o);b.carves.push(o);return o};
function rng(seed){let a=seed>>>0;return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function gen(seed){const R=rng(seed*7919+13),ri=(a,b)=>Math.round(a+R()*(b-a)),pick=a=>a[Math.floor(R()*a.length)];
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

function check(seed,verbose){Object.assign(S,{scaleDen:1,...FULL_DEF});const {b,desc}=gen(seed);if(process.env.DUMP&&verbose)require('fs').writeFileSync('d_seed'+seed+'.json',JSON.stringify({app:'ply-grammar',v:3,blocks:[{name:'A',p:b.pivot.position.toArray(),s:b.sizer.scale.toArray(),cuts:b.cuts.map(c=>({p:c.position.toArray(),q:c.quaternion.toArray()})),carves:b.carves.map(c=>({cid:c.userData.cid,p:c.position.toArray(),q:c.quaternion.toArray(),s:c.userData.sizer.scale.toArray()}))}]}));const out={seed,desc,issues:[]},I=(k,m)=>out.issues.push([k,m]),name0='A';
  if(process.env.KEY)S.keyShape=process.env.KEY;
  if(process.env.FORCE){try{const r0=panelizeBlock(b),ar=p=>p.part.reduce((x,c)=>x+areaF(c),0),big=r0.panels.filter(p=>p.part?.length&&p.kind!=='cleat'&&!p.splice).sort((x,y)=>ar(y)-ar(x)).slice(0,2);b.forceSplit={};big.forEach(p=>b.forceSplit[p.label]=2);out.forced=big.map(p=>p.label)}catch(e){}}
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
  /* a corner block must have something to hold it when it goes in */
  {const at=new Map();plan.steps.forEach((s,k)=>{at.set(s.i,k);s.with.forEach(j=>at.set(j,k))});const fl=plan.parts.filter(P=>P.kind==='cleat'&&![...plan.touch[P.idx]].some(j=>at.get(j)<=at.get(P.idx)));if(fl.length)I('floating-block',fl.map(P=>P.label).join(' '))}
  for(const [i,j] of plan.clash){const ex=thin.some(x=>[x.A,x.B].includes(P[i].label)||[x.A,x.B].includes(P[j].label))||b.strips?.length>0;I(ex?'overlap-thin(explained)':'overlap',P[i].label+'x'+P[j].label)}
  for(const s of plan.steps)if(s.stuck)I('stuck',P[s.i].label+'['+s.stuck.join('/')+']');
  P.forEach((p,i)=>{if(i!==P.findIndex(q=>q.label===base)&&!plan.touch[i].size)I('floating',p.label)});
  const fl=r.screws.filter(s=>s.flag).length;if(fl)I('screw-flag',fl+'');
  if(b.carveWarn)I('sliver-dropped(explained)','');if(b.strips?.length)I('strip-kept(explained)','');if(b.brep&&b.openStrips?.length)I('strip-open(explained)','');if(b.softened?.length)I('strip-softened(explained)','');
  if(verbose){console.log(desc);console.log(' parts',ps.map(p=>p.label).join(' '));console.log(' thin',JSON.stringify(thin.map(x=>[x.A,x.B,x.th.toFixed(2)])))}
  return out}
const N=+process.argv[2]||100,S0=+process.argv[3]||1,VS=process.argv[4];
if(VS){const o=check(+VS,true);console.log(o.issues);process.exit(0)}
const G={},t0=Date.now();
for(let s=S0;s<S0+N;s++){const o=check(s);const real=o.issues.filter(([k])=>!k.includes('(explained)'));const grp=/carves \S/.test(o.desc)?'with cut-outs':/cuts \S/.test(o.desc)?'cuts only':'plain box';
  const g=G[grp]=G[grp]||{n:0,clean:0,tally:{}};g.n++;if(!real.length)g.clean++;
  for(const k of new Set(o.issues.map(x=>x[0]))){(g.tally[k]=g.tally[k]||[]).push(s)}}
console.log(`${N} shapes, ${((Date.now()-t0)/1000).toFixed(0)}s`);
for(const [grp,g] of Object.entries(G)){console.log(`${grp}: ${g.n} shapes, ${g.clean} clean (${Math.round(g.clean/g.n*100)}%)`);
  for(const [k,v] of Object.entries(g.tally).sort((a,b)=>b[1].length-a[1].length))console.log('   ',k.padEnd(28),String(v.length).padStart(4),' seeds',v.slice(0,14).join(','))}
