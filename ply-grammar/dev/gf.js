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
function coverage(b,r,step=.5,depth=.06){const t=thkModel(),ps=r.panels.filter(p=>p.part?.length),parts=ps.map((p,i)=>asmPart(p,i)),out=[];
  const faces=b.brep?b.brep.faces.filter(f=>!f.skip).map(f=>({name:'A'+f.num,n:f.n,O:f.O,u:f.u,v:f.v,cts:f.cts})):solidFaces(blockPlanes(b)).map((f,i)=>{const n=f.pl.n,O=f.poly[0],u=f.poly[1].clone().sub(O).normalize(),v=new V().crossVectors(n,u);return {name:'f'+i+':'+f.pl.id,n,O,u,v,cts:[f.poly.map(p=>{const q=p.clone().sub(O);return [q.dot(u),q.dot(v)]})]}});
  for(const f of faces){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;f.cts[0].forEach(([x,y])=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)});const bare=[];
    for(let x=x0+.2;x<x1;x+=step)for(let y=y0+.2;y<y1;y+=step){if(!pip2(f.cts,x,y))continue;const X0=f.O.clone().addScaledVector(f.u,x).addScaledVector(f.v,y);
      /* a see-through hole: no wood anywhere through the skin at this spot */
      if([.06,.25,.45,.68].every(h=>{const X=X0.clone().addScaledVector(f.n,-h*t/.75);return !parts.some(P=>inPart(P,X.x,X.y,X.z))}))bare.push([x,y])}
    /* group touching bare points */
    const seen=new Set(),key=(x,y)=>Math.round(x/step)+','+Math.round(y/step),S_=new Map(bare.map(p=>[key(...p),p]));
    for(const p of bare){const k0=key(...p);if(seen.has(k0))continue;const q=[p],grp=[];seen.add(k0);while(q.length){const c=q.pop();grp.push(c);for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){const k=key(c[0]+dx,c[1]+dy);if(S_.has(k)&&!seen.has(k)){seen.add(k);q.push(S_.get(k))}}}
      let a=1e9,b_=1e9,c=-1e9,d=-1e9;grp.forEach(([x,y])=>{a=Math.min(a,x);b_=Math.min(b_,y);c=Math.max(c,x);d=Math.max(d,y)});
      const sq=grp.some(([x,y])=>S_.has(key(x+step,y))&&S_.has(key(x,y+step))&&S_.has(key(x+step,y+step)));
      out.push({face:f.name,sq,area:grp.length*step*step,w:c-a+step,h:d-b_+step,at:[+((a+c)/2).toFixed(1),+((b_+d)/2).toFixed(1)],ext:[+(x1-x0).toFixed(1),+(y1-y0).toFixed(1)]})}}
  return out.sort((p,q)=>q.area-p.area)}


function gapsOf(res){const t=thkModel(),step=Math.max(.2,t*.27),spots=[];
  const ps=res.panels.filter(p=>p.part?.length),parts=ps.map((p,i)=>asmPart(p,i)),seen=new Set();
  for(const p of ps){if(p.kind!=='face'||!p.face?.length||seen.has(p.planeId))continue;seen.add(p.planeId);const {O,u,v,n}=p.frame;
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;p.face[0].forEach(([x,y])=>{x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)});
    const at=(x,y,h)=>{const X=O.x+u.x*x+v.x*y-n.x*h,Y=O.y+u.y*x+v.y*y-n.y*h,Z=O.z+u.z*x+v.z*y-n.z*h;for(const P of parts)if(inPart(P,X,Y,Z))return true;return false};
    const cells=new Map(),key=(i,j)=>i+','+j,nx=Math.ceil((x1-x0)/step),ny=Math.ceil((y1-y0)/step),j_=step*.33;
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const x=x0+(i+.5)*step,y=y0+(j+.5)*step;if(!pip2(p.face,x,y))continue;const h0=t*.06;
      if(at(x,y,h0)||at(x+j_,y,h0)||at(x-j_,y,h0)||at(x,y+j_,h0)||at(x,y-j_,h0))continue;
      /* right through only if the bottom is open too: a V that closes at the back (a meet joint) is a dent, however narrow its last hairline */
        const hb=t*.92,thru=!at(x,y,t*.35)&&!at(x,y,t*.65)&&!at(x,y,hb)&&!at(x+j_,y,hb)&&!at(x-j_,y,hb)&&!at(x,y+j_,hb)&&!at(x,y-j_,hb);cells.set(key(i,j),{i,j,x,y,thru})}
    const done=new Set();for(const c of cells.values()){const k0=key(c.i,c.j);if(done.has(k0))continue;const q=[c],grp=[];done.add(k0);
      while(q.length){const a=q.pop();grp.push(a);for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const kk=key(a.i+di,a.j+dj);if(cells.has(kk)&&!done.has(kk)){done.add(kk);q.push(cells.get(kk))}}}
      if(grp.length<2)continue;const thru=grp.filter(g=>g.thru).length>=Math.max(2,grp.length*.3);
      let a=1e9,b_=1e9,c2=-1e9,d=-1e9;grp.forEach(g=>{a=Math.min(a,g.x);b_=Math.min(b_,g.y);c2=Math.max(c2,g.x);d=Math.max(d,g.y)});
      const nv=Math.min(...p.face[0].map(([x,y])=>Math.hypot(x-(a+c2)/2,y-(b_+d)/2)));spots.push({w:c2-a+step,h:d-b_+step,thru,label:p.label,n:grp.length,nv})}}
  return spots}
Object.assign(S,{scaleDen:1,...FULL_DEF});const N=+process.argv[2]||40,S0=+process.argv[3]||1;let th=0,dn=0,shapes=0,cor=0;const rows=[];
for(let sd=S0;sd<S0+N;sd++){const {b,desc}=gen(sd);if(b.carves.length&&!process.env.CARVE)continue;world.updateMatrixWorld(true);let r;try{r=panelizeBlock(b)}catch(e){continue}
  const sp=gapsOf(r),H=sp.filter(s=>s.thru),D=sp.filter(s=>!s.thru);shapes++;th+=H.length;dn+=D.length;cor+=H.filter(h=>h.nv<2.5).length;
  if(H.length)rows.push(sd+': '+H.length+' thru '+H.slice(0,5).map(h=>h.label+' '+h.w.toFixed(1)+'x'+h.h.toFixed(1)+(h.nv<2.5?'c':'')).join(' ; ')+' | '+desc)}
if(!process.env.Q)console.log(rows.join('\n'));console.log('shapes',shapes,'thru',th,'at corners',cor,'dents',dn);
