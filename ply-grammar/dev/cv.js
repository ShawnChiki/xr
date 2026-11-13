const world=new THREE.Group();
function mk(p,s,cuts){const b={cuts:[],pivot:new THREE.Object3D(),sizer:new THREE.Object3D(),edgeOpts:{}};world.add(b.pivot);b.pivot.position.fromArray(p);b.sizer.scale.fromArray(s);b.pivot.add(b.sizer);
for(const c of cuts){const o=new THREE.Object3D();o.position.fromArray(c.p);o.quaternion.setFromUnitVectors(new V(0,0,1),new V(...c.n).normalize());o.userData.cid='c'+Math.random();b.pivot.add(o);b.cuts.push(o)}return b}
const B=[['A',mk([0,15,0],[40,30,30],[{p:[0,8,9],n:[0,.85,.53]}])],['B',mk([34,21,0],[28,42,30],[{p:[8,15,0],n:[.7,.71,0]},{p:[0,14,9],n:[0,.6,.8]}])],['C',mk([-32,13,0],[24,26,30],[{p:[0,2,0],n:[-.62,.78,0]}])],['D',mk([0,24,70],[60,48,40],[])]];
Object.assign(S,{scaleDen:1,...FULL_DEF});
const carve=(b,p,s)=>{const o=new THREE.Object3D(),z=new THREE.Object3D();o.position.fromArray(p);z.scale.fromArray(s);o.add(z);o.userData={cid:'v'+Math.random().toString(36).slice(2,6),sizer:z};b.pivot.add(o);(b.carves=b.carves||[]).push(o);return o};
const tests=[['step',mk([0,20,0],[48,40,30],[]),b=>carve(b,[14,10,0],[24,24,40])],
             ['tunnel',mk([0,20,0],[60,40,30],[]),b=>carve(b,[0,-6,0],[20,20,40])],
             ['slopecorner',mk([0,15,0],[40,30,30],[{p:[0,8,9],n:[0,.85,.53]}]),b=>carve(b,[-14,8,0],[16,20,40])]];
for(const [nm,b,f] of tests){f(b);b.name='A';const t0=Date.now();let res;try{res=panelizeBlock(b)}catch(e){console.log(nm,'ERR',e.stack.split('\n').slice(0,4).join(' | '));continue}
  const panels=res.panels.filter(p=>p.part?.length);const B=b.brep;
  console.log(nm,'faces',B?B.faces.length:'-',B?B.faces.map(f=>f.cts.length).join(''):'', 'panels',panels.length,panels.map(p=>p.label).join(' '),'ms',Date.now()-t0);
  if(B){const free=B.faces.flatMap(f=>f.E.filter(e=>e.L>1e-6&&e.nb<0)).length,ins=B.faces.flatMap(f=>f.E.filter(e=>e.nb>=0&&!e.convex)).length;console.log('   free edges',free,'inside-corner edges',ins,'joints',res.joints.length)}
  const mp=mergeSplices(panels),faces=mp.filter(p=>p.kind==='face');const base=basePanel(faces).label;
  const plan=planAssembly(mp,base);
  console.log('   clash',plan.clash.map(([i,j])=>plan.parts[i].label+'x'+plan.parts[j].label).join(','),'stuck',plan.steps.filter(s=>s.stuck).map(s=>plan.parts[s.i].label+'['+s.stuck.join('/')+']').join(' '));
  console.log('   ',plan.steps.map(s=>plan.parts[s.i].label+(s.with.length?'+'+s.with.length:'')).join(' '))}
{const b=mk([0,20,0],[110,40,30],[]);b.name='A';const res=panelizeBlock(b),ps=res.panels.filter(p=>p.part?.length);
 console.log('big',ps.map(p=>p.label+(p.splice?'('+p.splice.of+' keys '+p.splice.keys+')':'')).join(' '));
 const [Wu,Hu]=sheetUse();for(const p of ps){let a=1e9,c=-1e9,d=1e9,e=-1e9;p.part.forEach(q=>q.forEach(([x,y])=>{a=Math.min(a,x);c=Math.max(c,x);d=Math.min(d,y);e=Math.max(e,y)}));if(p.splice)console.log('  ',p.label,(c-a).toFixed(1)+'x'+(e-d).toFixed(1),'contours',p.part.length)}
 const mp=mergeSplices(ps),faces=mp.filter(p=>p.kind==='face'),base=basePanel(faces).label,plan=planAssembly(mp,base);
 console.log('   clash',plan.clash.map(([i,j])=>plan.parts[i].label+'x'+plan.parts[j].label).join(','),'stuck',plan.steps.filter(s=>s.stuck).map(s=>plan.parts[s.i].label+'['+s.stuck.join('/')+']').join(' '));
 console.log('   ',plan.steps.map(s=>plan.parts[s.i].label).join(' '))}
