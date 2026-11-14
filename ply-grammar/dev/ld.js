const world=new THREE.Group();const fs=require('fs');
function load(d){const b={cuts:[],carves:[],pivot:new THREE.Object3D(),sizer:new THREE.Object3D(),edgeOpts:d.edgeOpts||{}};world.add(b.pivot);b.pivot.position.fromArray(d.p);b.sizer.scale.fromArray(d.s);b.pivot.add(b.sizer);
  (d.cuts||[]).forEach((c,i)=>{const o=new THREE.Object3D();o.position.fromArray(c.p);if(c.q)o.quaternion.fromArray(c.q);else o.quaternion.setFromUnitVectors(new V(0,0,1),new V(...c.n).normalize());o.userData.cid=c.cid||'c'+i;b.pivot.add(o);b.cuts.push(o)});
  (d.carves||[]).forEach((c,i)=>{const o=new THREE.Object3D(),z=new THREE.Object3D();o.position.fromArray(c.p);if(c.q)o.quaternion.fromArray(c.q);z.scale.fromArray(c.s);o.add(z);o.userData={cid:c.cid||'v'+i,sizer:z,tilt:c.tilt};b.pivot.add(o);b.carves.push(o)});
  b.name=d.name||'A';if(d.cleatEdit)b.cleatEdit=d.cleatEdit;if(d.screwEdit)b.screwEdit=d.screwEdit;world.updateMatrixWorld(true);return b}
const D=JSON.parse(fs.readFileSync(process.env.D||'d_u1.json','utf8'));if(D.S)Object.assign(S,D.S);globalThis.DBG={};const b=load(D.blocks[0]);const r=panelizeBlock(b);
const out=await (async()=>eval(process.env.JS||'r.panels.length'))();console.log(typeof out==='string'?out:JSON.stringify(out));
