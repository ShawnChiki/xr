const world=new THREE.Group();
function mk(p,s,cuts){const b={cuts:[],pivot:new THREE.Object3D(),sizer:new THREE.Object3D(),edgeOpts:{}};world.add(b.pivot);b.pivot.position.fromArray(p);b.sizer.scale.fromArray(s);b.pivot.add(b.sizer);
for(const c of cuts){const o=new THREE.Object3D();o.position.fromArray(c.p);o.quaternion.setFromUnitVectors(new V(0,0,1),new V(...c.n).normalize());o.userData.cid='c'+Math.random();b.pivot.add(o);b.cuts.push(o)}return b}
Object.assign(S,{scaleDen:1,...FULL_DEF});
const carve=(b,p,s)=>{const o=new THREE.Object3D(),z=new THREE.Object3D();o.position.fromArray(p);z.scale.fromArray(s);o.add(z);o.userData={cid:'v'+Math.random().toString(36).slice(2,6),sizer:z};b.pivot.add(o);(b.carves=b.carves||[]).push(o);return o};
const cfgs=[['Bz',()=>{const b=mk([34,21,0],[28,42,30],[{p:[8,15,0],n:[.7,.71,0]},{p:[0,14,9],n:[0,.6,.8]}]);carve(b,[0,-2,0],[14,18,34]);return b}],
 ['Bx',()=>{const b=mk([34,21,0],[28,42,30],[{p:[8,15,0],n:[.7,.71,0]},{p:[0,14,9],n:[0,.6,.8]}]);carve(b,[0,-2,0],[34,18,14]);return b}],
 ['Bhi',()=>{const b=mk([34,21,0],[28,42,30],[{p:[8,15,0],n:[.7,.71,0]},{p:[0,14,9],n:[0,.6,.8]}]);carve(b,[0,4,0],[14,22,34]);return b}],
 ['Dz',()=>{const b=mk([0,24,70],[60,48,40],[]);carve(b,[0,0,0],[24,20,50]);return b}]];
for(const [nm,f] of cfgs){const b=f();b.name='B';const r=panelizeBlock(b),ps=r.panels.filter(p=>p.part?.length);
  const mp=mergeSplices(ps),faces=mp.filter(p=>p.kind==='face'),base=faces.reduce((m,p)=>p.frame.n.y<m.frame.n.y?p:m,faces[0]).label,plan=planAssembly(mp,base);
  // slots with nothing in them: sample slot centers in faces, test whether any other part's wood fills it
  const P=plan.parts;let empty=[];for(const A of P){if(A.kind!=='face')continue;for(const c of A.cts){if(areaF(c)>=0||c.length>12)continue;
      const cx=c.reduce((s,q)=>s+q[0],0)/c.length,cy=c.reduce((s,q)=>s+q[1],0)/c.length,X=A.O.clone().addScaledVector(A.u,cx).addScaledVector(A.v,cy).addScaledVector(A.n,(A.z0+A.z1)/2);
      if(!P.some(B=>B!==A&&inPart(B,X.x,X.y,X.z)))empty.push(A.label)}}
  // tabs poking into air: rib boundary points outside every face plate but outside the brep solid
  console.log(nm,'parts',ps.map(p=>p.label).join(' '),'\n  clash',plan.clash.map(([i,j])=>P[i].label+'x'+P[j].label).join(','),'stuck',plan.steps.filter(s=>s.stuck).map(s=>P[s.i].label+'['+s.stuck.join('/')+']').join(' '),'emptySlots',empty.join(','),'flags',r.screws.filter(s=>s.flag).length)}
