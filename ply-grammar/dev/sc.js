const world=new THREE.Group();
function mk(p,s,cuts){const b={cuts:[],pivot:new THREE.Object3D(),sizer:new THREE.Object3D(),edgeOpts:{}};world.add(b.pivot);b.pivot.position.fromArray(p);b.sizer.scale.fromArray(s);b.pivot.add(b.sizer);
for(const c of cuts){const o=new THREE.Object3D();o.position.fromArray(c.p);o.quaternion.setFromUnitVectors(new V(0,0,1),new V(...c.n).normalize());o.userData.cid='c'+Math.random();b.pivot.add(o);b.cuts.push(o)}return b}
const B=[['A',mk([0,15,0],[40,30,30],[{p:[0,8,9],n:[0,.85,.53]}])],['B',mk([34,21,0],[28,42,30],[{p:[8,15,0],n:[.7,.71,0]},{p:[0,14,9],n:[0,.6,.8]}])],['C',mk([-32,13,0],[24,26,30],[{p:[0,2,0],n:[-.62,.78,0]}])],['D',mk([0,24,70],[60,48,40],[])]];
const carve=(b,p,s)=>{const o=new THREE.Object3D(),z=new THREE.Object3D();o.position.fromArray(p);z.scale.fromArray(s);o.add(z);o.userData={cid:'v'+Math.random().toString(36).slice(2,6),sizer:z};b.pivot.add(o);(b.carves=b.carves||[]).push(o);return o};
const E=mk([0,20,0],[60,40,30],[]);carve(E,[0,-6,0],[20,20,40]);B.push(['E',E]);
const check=(scr,sLen,sMin,bMin,sd,t)=>{let n=0;const on=scr.filter(s=>!s.dropped);for(let i=0;i<on.length;i++)for(let j=i+1;j<on.length;j++){const A=on[i],Bq=on[j];
  if(segDist(A.p3,A.p3.clone().addScaledVector(A.n,-sLen),Bq.p3,Bq.p3.clone().addScaledVector(Bq.n,-sLen))<(A.edge===Bq.edge&&A.edge[0]==='J'?bMin:sMin)-1e-6)n++}return n};
for(const tweak of [{},{screwMin:3},{screwMin:4,fingerScrews:2,screwEvery:1},{screwMin:5}]){for(const fix of [true,false]){
  Object.assign(S,{scaleDen:1,...FULL_DEF,...tweak,screwFix:fix});const t=thkModel(),bMin=Math.min(S.screwMin,t*.67);let line=[];
  for(const [k,bb] of B){bb.name=k;const r=panelizeBlock(bb),sc=r.screws,mv=sc.filter(s=>s.fix?.type==='move').length,dr=sc.filter(s=>s.dropped).length,fl=sc.filter(s=>s.flag).length;
    line.push(`${k}:${sc.length} mv${mv} out${dr} flag${fl} left${fix?check(sc,S.screwLen,S.screwMin,bMin,S.screwD,t):'-'}`)}
  console.log(JSON.stringify(tweak),fix?'FIX':'HINT',line.join('  '))}}
Object.assign(S,{scaleDen:1,...FULL_DEF,screwMin:4,fingerScrews:2,screwEvery:1,screwFix:true});
for(const [k,bb] of B.slice(0,2)){const r=panelizeBlock(bb);r.screws.filter(s=>s.fix).slice(0,4).forEach(s=>console.log(' ',k,s.name,s.edge,'|',s.fix.why))}
Object.assign(S,{screwFix:false});{const r=panelizeBlock(B[0][1]);r.screws.filter(s=>s.hint).slice(0,3).forEach(s=>console.log(' hint',s.name,s.edge,'|',s.hint))}
