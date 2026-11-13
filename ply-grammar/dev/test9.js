const world=new THREE.Group();
function mk(p,s,cuts){const b={cuts:[],pivot:new THREE.Object3D(),sizer:new THREE.Object3D(),edgeOpts:{}};world.add(b.pivot);b.pivot.position.fromArray(p);b.sizer.scale.fromArray(s);b.pivot.add(b.sizer);
for(const c of cuts){const o=new THREE.Object3D();o.position.fromArray(c.p);o.quaternion.setFromUnitVectors(new V(0,0,1),new V(...c.n).normalize());o.userData.cid='c'+Math.random();b.pivot.add(o);b.cuts.push(o)}return b}
const B=[['A',mk([0,15,0],[40,30,30],[{p:[0,8,9],n:[0,.85,.53]}])],['B',mk([34,21,0],[28,42,30],[{p:[8,15,0],n:[.7,.71,0]},{p:[0,14,9],n:[0,.6,.8]}])],['C',mk([-32,13,0],[24,26,30],[{p:[0,2,0],n:[-.62,.78,0]}])],['D',mk([0,24,70],[60,48,40],[])]];
for(const cfg of [{scaleDen:1,...FULL_DEF},{scaleDen:8,...MODEL_DEF}]){Object.assign(S,cfg);
 for(const [k,bb] of B){const r=panelize(bb,k),ribs=r.panels.filter(p=>p.kind==='rib');
  // minimum distance from any slot corner to the panel outline, per face
  let worst=Infinity;for(const p of r.panels.filter(p=>p.kind==='face')){const outer=p.part.find(c=>areaF(c)>0);if(!outer)continue;
    for(const c of p.part)if(areaF(c)<0&&c.length===4)for(const pt of c){for(let i=0;i<outer.length;i++){const a=outer[i],b2=outer[(i+1)%outer.length],ab=sub(b2,a),L2=dot(ab,ab),tt=Math.max(0,Math.min(1,dot(sub(pt,a),ab)/L2));worst=Math.min(worst,Math.hypot(...sub(pt,add(a,mul(ab,tt)))))}}}
  console.log(cfg.scaleDen,k,'ribs',ribs.length,'notched',ribs.filter(p=>p.part.length&&p.part[0].length>8).length,'rib contours',ribs.map(p=>p.part.length).join(''),'blocks',r.panels.filter(p=>p.kind==='cleat').length,'min wood to edge',worst.toFixed(2),'flags',r.screws.filter(s=>s.flag).length)}}
Object.assign(S,{scaleDen:1,...FULL_DEF});for(const [k,bb] of B){const r=panelize(bb,k);
 const slots=r.panels.filter(p=>p.kind==='face').reduce((a,p)=>a+p.part.filter(c=>areaF(c)<0).length,0);
 console.log(k,'slots in faces',slots,'ribs',r.panels.filter(p=>p.kind==='rib').map(p=>p.label).join(' '))}
