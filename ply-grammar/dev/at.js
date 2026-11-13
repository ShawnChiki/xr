const world=new THREE.Group();
function mk(p,s,cuts){const b={cuts:[],pivot:new THREE.Object3D(),sizer:new THREE.Object3D(),edgeOpts:{}};world.add(b.pivot);b.pivot.position.fromArray(p);b.sizer.scale.fromArray(s);b.pivot.add(b.sizer);
for(const c of cuts){const o=new THREE.Object3D();o.position.fromArray(c.p);o.quaternion.setFromUnitVectors(new V(0,0,1),new V(...c.n).normalize());o.userData.cid='c'+Math.random();b.pivot.add(o);b.cuts.push(o)}return b}
const B=[['A',mk([0,15,0],[40,30,30],[{p:[0,8,9],n:[0,.85,.53]}])],['B',mk([34,21,0],[28,42,30],[{p:[8,15,0],n:[.7,.71,0]},{p:[0,14,9],n:[0,.6,.8]}])],['C',mk([-32,13,0],[24,26,30],[{p:[0,2,0],n:[-.62,.78,0]}])],['D',mk([0,24,70],[60,48,40],[])]];
Object.assign(S,{scaleDen:1,...FULL_DEF});
for(const [k,bb] of B){const t0=Date.now();bb.name=k;const r=panelizeBlock(bb);const ps=mergeSplices(r.panels.filter(p=>p.part?.length));
  const faces=ps.filter(p=>p.kind==='face');const base=basePanel(faces).label;
  const t1=Date.now();const plan=planAssembly(ps,base);const t2=Date.now();
  console.log(k,'parts',ps.length,'panelize',t1-t0,'ms plan',t2-t1,'ms clashes',plan.clash.map(([i,j])=>plan.parts[i].label+'x'+plan.parts[j].label).join(','));
  console.log(plan.steps.map(s=>plan.parts[s.i].label+(s.with.length?'+['+s.with.map(j=>plan.parts[j].label).join(' ')+']':'')+(s.stuck?'!['+s.stuck.join('/')+']':'')+'('+[s.d.x,s.d.y,s.d.z].map(x=>x.toFixed(1)).join(',')+')').join(' '))}
