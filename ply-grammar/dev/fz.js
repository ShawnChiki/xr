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
function check(seed,verbose){Object.assign(S,{scaleDen:1,...FULL_DEF});const {b,desc}=gen(seed),out={seed,desc,issues:[]},I=(k,m)=>out.issues.push([k,m]),name0='A';
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
  /* every outside corner filled: walk each shell edge half a ply under both faces; that stick of wood must belong to some part.
     And no two neighbors may lie in one plane: that is one plate wrongly cut in two. */
  if(b.brep){const t=thkModel(),parts=ps.map((p,i)=>asmPart(p,i)),F=b.brep.faces.slice().sort((x,y)=>x.i-y.i);
    F.forEach(f=>f.E.forEach(e=>{if(e.nb<0||e.nb<f.i||e.L<4*t)return;const g=F[e.nb];if(f.skip||g.skip)return;const c=f.n.dot(g.n);
      if(c>.999){I('split-plate',name0+f.num+'|'+name0+g.num);return}if(!e.convex||c<-.9)return;const a=-(t/2)/(1+c),dir=e.B.clone().sub(e.A).normalize();let miss=0,run=0,best=0;
      for(let s=3*t;s<e.L-3*t;s+=.25){const X=e.A.clone().addScaledVector(dir,s).addScaledVector(f.n,a).addScaledVector(g.n,a);if(parts.some(P=>inPart(P,X.x,X.y,X.z)))run=0;else{miss++;run++;best=Math.max(best,run)}}
      if(best>=4){const th=b.thin||[],ex=th.some(x=>[x.A,x.B].includes(name0+f.num)||[x.A,x.B].includes(name0+g.num));I(ex?'empty-socket-thin(explained)':'empty-socket',name0+f.num+'|'+name0+g.num+' '+(best*.25).toFixed(1)+'in')}}))}
  const mp=mergeSplices(ps),faces=mp.filter(p=>p.kind==='face');if(!faces.length){I('nofaces','');return out}
  const base=basePanel(faces).label,plan=planAssembly(mp,base),P=plan.parts,thin=b.thin||[];
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
