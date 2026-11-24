/* deep corner-block audit, on the finished parts only (nothing here trusts how the blocks were planned).
   Returns a list of [kind,detail] and pushes numbers into `stats`. */
function blockAudit(b,r,plan,P,stats){const out=[],I=(k,m)=>out.push([k,m]),t=thkModel(),sLen=S.screwLen,stepOf=new Map();plan.steps.forEach((s,k)=>{stepOf.set(s.i,k);s.with.forEach(j=>stepOf.set(j,k))});
  const dSeg=(x,y,a,c)=>{const ex=c[0]-a[0],ey=c[1]-a[1],l2=ex*ex+ey*ey||1e-9,u=Math.max(0,Math.min(1,((x-a[0])*ex+(y-a[1])*ey)/l2));return Math.hypot(x-a[0]-ex*u,y-a[1]-ey*u)};
  const dC=(cts,x,y)=>{let m=1e9;for(const ct of cts)for(let i=0;i<ct.length;i++)m=Math.min(m,dSeg(x,y,ct[i],ct[(i+1)%ct.length]));return m};
  const loc=(A,X)=>{const d=X.clone().sub(A.O);return [d.dot(A.u),d.dot(A.v),d.dot(A.n)]},at=(X,skip)=>P.filter(A=>A!==skip&&inPart(A,X.x,X.y,X.z));
  const blocks=P.filter(A=>A.kind==='cleat'),tagOf=A=>{const m=/(K|J)(\d+)$/.exec(A.label);return m?(m[1]==='K'?'JK':'J')+m[2]:null};
  const dirs=[];{const n=80,ga=Math.PI*(3-Math.sqrt(5));for(let i=0;i<n;i++){const y=1-2*(i+.5)/n,rr=Math.sqrt(1-y*y),th=i*ga;dirs.push(new V(Math.cos(th)*rr,y,Math.sin(th)*rr))}}
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(const A of P)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],A.mn[k]);mx[k]=Math.max(mx[k],A.mx[k])}
  const inBB=X=>X.x>mn[0]&&X.x<mx[0]&&X.y>mn[1]&&X.y<mx[1]&&X.z>mn[2]&&X.z<mx[2];
  /* the designed solid: a drawn or carved shell (faces with outlines), or a convex box-and-cuts solid (planes) */
  const SF=b.brep?b.brep.faces.map(f=>({n:f.n,O:f.O,u:f.u,v:f.v,cts:f.cts})):null,PL=b.brep?null:solidFaces(blockPlanes(b)).map(f=>f.pl),RD=new V(.5377,.6713,.5101).normalize();
  const inSolid=X=>{if(PL)return PL.every(p=>p.n.dot(X)-p.d<1e-6);let c=0;for(const f of SF){const den=f.n.dot(RD);if(Math.abs(den)<1e-9)continue;const s=f.n.dot(f.O.clone().sub(X))/den;if(s<=0)continue;const H=X.clone().addScaledVector(RD,s).sub(f.O);if(pip2(f.cts,H.dot(f.u),H.dot(f.v)))c++}return c%2===1};
  const surfDist=X=>{if(PL)return Math.max(...PL.map(p=>p.n.dot(X)-p.d));let m=1e9;for(const f of SF){const d=X.clone().sub(f.O),h=d.dot(f.n),x=d.dot(f.u),y=d.dot(f.v);m=Math.min(m,pip2(f.cts,x,y)?Math.abs(h):Math.hypot(h,dC(f.cts,x,y)))}return m};
  const labs=new Set();
  for(const A of blocks){const tag=tagOf(A),rib=A.p.sub==='rib',rfx=!!A.p.cleat?.rfx,nm=A.label+(rfx?'(in)':rib?'(rib)':'')+' '+A.p.joint;if(labs.has(A.label))I('blk-duplicate-label',A.label);labs.add(A.label);
    /* 1. what it bears on, and for how long */
    const bear={};for(const ct of A.cts)for(let i=0;i<ct.length;i++){const a=ct[i],c=ct[(i+1)%ct.length],ex=c[0]-a[0],ey=c[1]-a[1],L=Math.hypot(ex,ey);if(L<1e-6)continue;const k=Math.max(1,Math.ceil(L/.12)),nx=-ey/L,ny=ex/L;
      for(let j=0;j<k;j++){const x=a[0]+ex*(j+.5)/k,y=a[1]+ey*(j+.5)/k;let sx=x+nx*.07,sy=y+ny*.07;if(pipC(A.cts,sx,sy)){sx=x-nx*.07;sy=y-ny*.07}
        const X=A.O.clone().addScaledVector(A.u,sx).addScaledVector(A.v,sy);for(const B of at(X,A))if(B.kind!=='cleat')bear[B.label]=(bear[B.label]||0)+L/k}}
    const bs=Object.entries(bear).filter(([k,v])=>v>=.9).sort((x,y)=>y[1]-x[1]);if(bs.length<2)I('blk-bears-on-one',nm+' '+JSON.stringify(Object.fromEntries(Object.entries(bear).map(([k,v])=>[k,+v.toFixed(1)]))));
    else stats.bear.push(bs[1][1]);
    /* 2. its screws */
    const scs=(r.screws||[]).filter(sc=>sc.edge===tag&&sc.p3&&sc.n),segs=[];
    for(const sc of scs){const own=at(sc.p3.clone().addScaledVector(sc.n,-t*.5),A).find(B=>B.kind!=='cleat');if(!own){I('blk-screw-head-in-air',nm);continue}
      let emb=0,minW=1e9,offC=0,deep=0;for(let d=t+.02;d<=sLen;d+=.04){const X=sc.p3.clone().addScaledVector(sc.n,-d);if(!inPart(A,X.x,X.y,X.z))continue;emb+=.04;deep=d;const q=loc(A,X);if(d>t+.3)minW=Math.min(minW,dC(A.cts,q[0],q[1]));offC=Math.max(offC,Math.abs(q[2]-(A.z0+A.z1)/2))}
      stats.emb.push(emb);if(emb<.45)I('blk-screw-shallow',nm+' from '+own.label+' '+emb.toFixed(2)+'in');
      if(minW<.15)I('blk-screw-thin-wood',nm+' from '+own.label+' '+minW.toFixed(2));if(offC>.13)I('blk-screw-off-centre',nm+' '+offC.toFixed(2));
      const tip=sc.p3.clone().addScaledVector(sc.n,-(sLen-.03));if(emb>0&&deep<sLen-.15&&!at(tip,null).length)I('blk-screw-pokes-through',nm+' from '+own.label+' '+(sLen-deep).toFixed(2)+'in bare');
      const h=loc(own,sc.p3),ed=dC(own.cts,h[0],h[1]);stats.edge.push(ed);if(ed<.3)I('blk-screw-near-panel-edge',nm+' on '+own.label+' '+ed.toFixed(2)+'in');
      /* can a driver get at the head when it is time to drive it? */
      const bench=stepOf.get(own.idx)===stepOf.get(A.idx);/* fixed to its panel on the bench, before either goes in */
      const drive=Math.max(stepOf.get(own.idx)??0,stepOf.get(A.idx)??0);let blk=null;for(let d=.15;d<=4.5&&!blk;d+=.2){const X=sc.p3.clone().addScaledVector(sc.n,d);blk=at(X,null).find(B=>B!==own)||null}
      /* on the bench only what is in the same sub-assembly can be in the way */
      if(blk&&bench&&stepOf.get(blk.idx)!==stepOf.get(A.idx))blk=null;
      if(blk){if((stepOf.get(blk.idx)??0)<=drive)I('blk-screw-no-access',nm+' head on '+own.label+' behind '+blk.label);else stats.before.push(1)}
      segs.push([sc.p3,sc.p3.clone().addScaledVector(sc.n,-sLen),own.label])}
    const sides=new Set(segs.map(s=>s[2]));if(sides.size<2)I('blk-screwed-from<2',nm+' '+[...sides].join('+'));
    for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){const d=segDist(segs[i][0],segs[i][1],segs[j][0],segs[j][1]);if(d<.3)I('blk-screws-cross',nm+' '+d.toFixed(2))}
    /* 3. its shape */
    const ar=A.p.part.reduce((s,c)=>s+areaF(c),0),er=offsetC(A.p.part.map(rawC),-.3,false).map(fromC).filter(c=>Math.abs(areaF(c))>.15);stats.area.push(ar);
    if(ar<4)I('blk-tiny',nm+' '+ar.toFixed(1)+'sq in');else if(!er.length)I('blk-all-thin',nm);else if(er.length>1)I('blk-thin-neck',nm);
    /* 4. nothing of it sticks out of the shape (a tab standing proud for sanding is fine) */
    {let worst=0;for(let i=0;i<A.P.length;i+=3){const X=new V(A.P[i],A.P[i+1],A.P[i+2]);if(inSolid(X))continue;const d=surfDist(X);if(d>worst)worst=d}
      if(worst>.2&&!(b.softened?.length||b.strips?.length))I('blk-pokes-out',nm+' '+worst.toFixed(2)+'in outside the shape')}
    /* 5. a hand can still get to it when it goes in */
    {const k=stepOf.get(A.idx)??0,placed=P.filter(B=>B!==A&&(stepOf.get(B.idx)??0)<k);let open=0;for(const d of dirs){let hit=false;for(let s=.4;s<200&&!hit;s+=.35){const X=A.c.clone().addScaledVector(d,s);if(!inBB(X))break;hit=placed.some(B=>inPart(B,X.x,X.y,X.z))}if(!hit)open++}
      stats.open.push(open/dirs.length);const fcs=[...plan.touch[A.idx]].filter(j=>P[j].kind==='face');if(!open&&fcs.length&&fcs.every(j=>(stepOf.get(j)??0)<k))I('blk-sealed-in',nm+' step '+k+'/'+plan.steps.length+' touches '+[...plan.touch[A.idx]].map(j=>P[j].label+'@'+(stepOf.get(j)??'?')).join(' '))}}
  /* 6. along each joint: enough of them, evenly */
  {const by={};for(const A of blocks){if(A.p.sub==='rib'||!A.p.cleat)continue;(by[A.p.joint]=by[A.p.joint]||{L:A.p.cleat.L,xs:[]}).xs.push(A.p.cleat.x)}
    for(const [j,o] of Object.entries(by)){o.xs.sort((x,y)=>x-y);const gaps=o.xs.slice(1).map((x,i)=>x-o.xs[i]),end=Math.max(o.xs[0],o.L-o.xs[o.xs.length-1]),mg=Math.max(0,...gaps);
      if(mg>S.cleatSpacing*2.2+S.cleatLeg)I('blk-gap',j+' '+mg.toFixed(0)+'in between blocks, joint '+o.L.toFixed(0)+'in');if(end>S.cleatSpacing*1.6+S.cleatLeg)I('blk-end-bare',j+' '+end.toFixed(0)+'in from an end, joint '+o.L.toFixed(0)+'in');
      if(gaps.length&&Math.min(...gaps)<t*1.6)I('blk-crowded',j+' '+Math.min(...gaps).toFixed(1)+'in apart')}}
  /* 7. how many of the blocks each joint was meant to have it actually got */
  for(const j of r.joints||[]){if(!j.blk||S.blocks===false)continue;const L=j.a.distanceTo(j.b),n=Math.max(L>=t*5?1:0,new Set(cleatSpots(L,S.cleatLeg,t).cands.map(c=>c.g)).size);if(!n)continue;stats.plan.push(n);stats.got.push(Math.min(n,j.nBlk||0));if(!(j.nBlk>0))stats.none.push(L);if(!(j.nBlk>0)&&j.joint!=='meet')I(j.bare?'blk-none-on-joint(explained)':'blk-none-on-joint',j.label+' '+j.joint+' '+j.ang+'deg '+L.toFixed(0)+'in'+(j.inside?' inside':''))}
  return out}
/* a picture of every block, cut through its own mid-plane: the block in orange, each plate it meets in its own colour, wood on
   wood in red, screws as black lines (grey where they run out of the plane). One raw RGB file per block plus index.json. */
function blockSections(r,P,dir,only){const fs=require('fs'),t=thkModel(),sLen=S.screwLen,px=+process.env.PX||.03,idx=[];fs.mkdirSync(dir,{recursive:true});
  const hue=i=>{const h=(i*.618034)%1,f=(n,k=(n+h*6)%6)=>Math.round(255*(.82-.5*Math.max(Math.min(k,4-k,1),0)));return [f(5),f(3),f(1)]};
  for(const A of P.filter(A=>A.kind==='cleat')){if(only&&!only.includes(A.label))continue;const m=2.2,x0=A.bb[0]-m,y0=A.bb[1]-m,W=Math.ceil((A.bb[2]-A.bb[0]+2*m)/px),H=Math.ceil((A.bb[3]-A.bb[1]+2*m)/px),buf=Buffer.alloc(W*H*3,255),zc=(A.z0+A.z1)/2;
    const near=P.filter(B=>B!==A&&bbHit(A,B,0,0,0,m)),col=new Map();near.forEach((B,i)=>col.set(B,B.kind==='rib'?[150,120,90]:B.kind==='cleat'?[230,200,60]:hue(B.idx)));
    for(let j=0;j<H;j++)for(let i=0;i<W;i++){const x=x0+(i+.5)*px,y=y0+(j+.5)*px,X=A.O.clone().addScaledVector(A.u,x).addScaledVector(A.v,y).addScaledVector(A.n,zc);let c=null,n=0;
      if(pipC(A.cts,x,y)){c=[240,140,40];n++}for(const B of near)if(inPart(B,X.x,X.y,X.z)){c=n?[255,0,0]:col.get(B);n++}
      if(c){const o=((H-1-j)*W+i)*3;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2]}}
    const dot=(x,y,c,rad=1)=>{const i=Math.round((x-x0)/px),j=Math.round((y-y0)/px);for(let a=-rad;a<=rad;a++)for(let b_=-rad;b_<=rad;b_++){const ii=i+a,jj=j+b_;if(ii<0||jj<0||ii>=W||jj>=H)continue;const o=((H-1-jj)*W+ii)*3;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2]}};
    const tag=(/(K|J)(\d+)$/.exec(A.label)||[]),tg=tag[1]?(tag[1]==='K'?'JK':'J')+tag[2]:null,legend=near.map(B=>[B.label,col.get(B)]);
    for(const sc of r.screws||[]){if(!sc.p3||!sc.n)continue;const d0=sc.p3.clone().sub(A.O),h0=d0.dot(A.n)-zc;const mine=sc.edge===tg;if(!mine&&Math.abs(h0)>t*1.2)continue;
      for(let s=0;s<=sLen;s+=px*.5){const X=sc.p3.clone().addScaledVector(sc.n,-s).sub(A.O),h=X.dot(A.n)-zc;dot(X.dot(A.u),X.dot(A.v),Math.abs(h)<t*.5?(mine?[0,0,0]:[90,90,200]):[170,170,170],s<.1?3:1)}}
    fs.writeFileSync(`${dir}/${A.label}.rgb`,buf);idx.push({label:A.label,joint:A.p.joint,rfx:!!A.p.cleat?.rfx,rib:A.p.sub==='rib',W,H,legend})}
  fs.writeFileSync(dir+'/index.json',JSON.stringify(idx));return idx.length}
/* a picture of the parts cut by any plane: O centre, u/v in-plane unit vectors, w/h inches. Writes raw RGB + legend json. */
function sliceParts(P,O,u,v,w,h,file,px=.03){const fs=require('fs'),W=Math.ceil(w/px),H=Math.ceil(h/px),buf=Buffer.alloc(W*H*3,255),col=new Map(),hue=i=>{const hh=(i*.618034)%1,f=(n,k=(n+hh*6)%6)=>Math.round(255*(.85-.55*Math.max(Math.min(k,4-k,1),0)));return [f(5),f(3),f(1)]};
  P.forEach((B,i)=>col.set(B,B.kind==='rib'?[150,120,90]:B.kind==='cleat'?[240,140,40]:hue(B.idx)));const seen=new Set();
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const X=O.clone().addScaledVector(u,(i+.5)*px-w/2).addScaledVector(v,(j+.5)*px-h/2);let c=null,n=0;for(const B of P)if(inPart(B,X.x,X.y,X.z)){c=n?[255,0,0]:col.get(B);n++;seen.add(B)}
    if(c){const o=((H-1-j)*W+i)*3;buf[o]=c[0];buf[o+1]=c[1];buf[o+2]=c[2]}}
  fs.writeFileSync(file+'.rgb',buf);fs.writeFileSync(file+'.json',JSON.stringify({W,H,legend:[...seen].map(B=>[B.label,col.get(B)])}))}
