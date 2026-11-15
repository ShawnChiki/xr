/* node: load a saved design that has sketched blocks; JS env var runs with blocks in scope */
const world=new THREE.Group();const fs=require('fs');const D=JSON.parse(fs.readFileSync(process.env.F||'d_sk1.json','utf8'));Object.assign(S,{scaleDen:1,...FULL_DEF},D.S||{});
D.blocks.forEach(d=>{const b={cuts:[],carves:[],pivot:new THREE.Object3D(),sizer:new THREE.Object3D(),edgeOpts:d.edgeOpts||{},name:d.name};world.add(b.pivot);b.pivot.position.fromArray(d.p);if(d.q)b.pivot.quaternion.fromArray(d.q);b.sizer.scale.fromArray(d.s);b.pivot.add(b.sizer);
  for(const c of d.cuts||[]){const o=new THREE.Object3D();o.position.fromArray(c.p);o.quaternion.fromArray(c.q);o.userData.cid=c.cid;b.pivot.add(o);b.cuts.push(o)}if(d.sk)b.sk=d.sk;blocks.push(b)});
world.updateMatrixWorld(true);
eval(process.env.JS||'');
