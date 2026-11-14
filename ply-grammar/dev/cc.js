const world=new THREE.Group();
function mk(p,s,cuts){const b={cuts:[],carves:[],pivot:new THREE.Object3D(),sizer:new THREE.Object3D(),edgeOpts:{}};world.add(b.pivot);b.pivot.position.fromArray(p);b.sizer.scale.fromArray(s);b.pivot.add(b.sizer);
  for(const c of cuts){const o=new THREE.Object3D();o.position.fromArray(c.p);o.quaternion.setFromUnitVectors(new V(0,0,1),new V(...c.n).normalize());o.userData.cid='c'+b.cuts.length;b.pivot.add(o);b.cuts.push(o)}return b}
const carve=(b,p,s)=>{const o=new THREE.Object3D(),z=new THREE.Object3D();o.position.fromArray(p);z.scale.fromArray(s);o.add(z);o.userData={cid:'v'+b.carves.length,sizer:z};b.pivot.add(o);b.carves.push(o);return o};
Object.assign(S,{scaleDen:1,...FULL_DEF});
const b=mk([0,15,0],[30,30,30],[]);carve(b,[-10,22,10],[16,20,16]);b.name='A';world.updateMatrixWorld(true);
const r=panelizeBlock(b),t=thkModel(),ps=r.panels.filter(p=>p.part?.length),parts=ps.map((p,i)=>asmPart(p,i)),F=b.brep.faces.slice().sort((x,y)=>x.i-y.i);
F.forEach(f=>f.E.forEach(e=>{if(e.nb<0||e.nb<f.i)return;const g=F[e.nb];if(e.convex)return;const c=f.n.dot(g.n),a=-(t/2)/(1+c),dir=e.B.clone().sub(e.A).normalize();let row='';
  for(let s=.5;s<e.L;s+=.5){const X=e.A.clone().addScaledVector(dir,s).addScaledVector(f.n,a).addScaledVector(g.n,a);const hit=parts.findIndex(P=>inPart(P,X.x,X.y,X.z));row+=hit<0?'.':ps[hit].label.replace('A','')[0]}
  console.log('concave A'+f.num+'|A'+g.num,'L',e.L.toFixed(1),'ext',e.ext,'s',e.s,row)}));
