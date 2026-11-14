/* ---------------- single-stroke font ---------------- */
const FONT={"0":[[[.15,0],[.55,0],[.7,.2],[.7,.8],[.55,1],[.15,1],[0,.8],[0,.2],[.15,0]]],"1":[[[.15,.75],[.35,1],[.35,0]],[[.1,0],[.6,0]]],
"2":[[[0,.8],[.15,1],[.55,1],[.7,.8],[.7,.6],[0,0],[.7,0]]],"3":[[[0,1],[.7,1],[.35,.6],[.55,.6],[.7,.45],[.7,.15],[.55,0],[.15,0],[0,.15]]],
"4":[[[.5,0],[.5,1],[0,.35],[.7,.35]]],"5":[[[.7,1],[0,1],[0,.55],[.5,.55],[.7,.4],[.7,.15],[.5,0],[.15,0],[0,.1]]],
"6":[[[.6,1],[.2,1],[0,.7],[0,.15],[.15,0],[.55,0],[.7,.15],[.7,.4],[.55,.55],[0,.5]]],"7":[[[0,1],[.7,1],[.25,0]]],
"8":[[[.15,.55],[0,.7],[0,.85],[.15,1],[.55,1],[.7,.85],[.7,.7],[.55,.55],[.15,.55],[0,.4],[0,.15],[.15,0],[.55,0],[.7,.15],[.7,.4],[.55,.55]]],
"9":[[[.1,0],[.5,0],[.7,.3],[.7,.85],[.55,1],[.15,1],[0,.85],[0,.6],[.15,.45],[.7,.5]]],
"A":[[[0,0],[.35,1],[.7,0]],[[.15,.4],[.55,.4]]],"B":[[[0,0],[0,1],[.55,1],[.7,.85],[.7,.65],[.55,.55],[0,.55]],[[.55,.55],[.7,.45],[.7,.15],[.55,0],[0,0]]],
"C":[[[.7,.85],[.55,1],[.15,1],[0,.85],[0,.15],[.15,0],[.55,0],[.7,.15]]],"D":[[[0,0],[0,1],[.5,1],[.7,.8],[.7,.2],[.5,0],[0,0]]],
"E":[[[.7,1],[0,1],[0,0],[.7,0]],[[0,.55],[.5,.55]]],"F":[[[.7,1],[0,1],[0,0]],[[0,.55],[.5,.55]]],
"G":[[[.7,.85],[.55,1],[.15,1],[0,.85],[0,.15],[.15,0],[.55,0],[.7,.15],[.7,.45],[.4,.45]]],"H":[[[0,0],[0,1]],[[.7,0],[.7,1]],[[0,.55],[.7,.55]]],
"I":[[[.35,0],[.35,1]],[[.1,1],[.6,1]],[[.1,0],[.6,0]]],"J":[[[.7,1],[.7,.15],[.55,0],[.15,0],[0,.15]]],"K":[[[0,0],[0,1]],[[.7,1],[0,.4]],[[.3,.55],[.7,0]]],
"L":[[[0,1],[0,0],[.7,0]]],"M":[[[0,0],[0,1],[.35,.5],[.7,1],[.7,0]]],"N":[[[0,0],[0,1],[.7,0],[.7,1]]],
"O":[[[.15,0],[.55,0],[.7,.2],[.7,.8],[.55,1],[.15,1],[0,.8],[0,.2],[.15,0]]],"P":[[[0,0],[0,1],[.55,1],[.7,.85],[.7,.6],[.55,.5],[0,.5]]],
"Q":[[[.15,0],[.55,0],[.7,.2],[.7,.8],[.55,1],[.15,1],[0,.8],[0,.2],[.15,0]],[[.45,.25],[.75,-.05]]],
"R":[[[0,0],[0,1],[.55,1],[.7,.85],[.7,.6],[.55,.5],[0,.5]],[[.35,.5],[.7,0]]],
"S":[[[.7,.85],[.55,1],[.15,1],[0,.85],[0,.65],[.15,.55],[.55,.5],[.7,.4],[.7,.15],[.55,0],[.15,0],[0,.15]]],
"T":[[[0,1],[.7,1]],[[.35,1],[.35,0]]],"U":[[[0,1],[0,.15],[.15,0],[.55,0],[.7,.15],[.7,1]]],"V":[[[0,1],[.35,0],[.7,1]]],
"W":[[[0,1],[.15,0],[.35,.5],[.55,0],[.7,1]]],"X":[[[0,0],[.7,1]],[[0,1],[.7,0]]],"Y":[[[0,1],[.35,.5],[.7,1]],[[.35,.5],[.35,0]]],
"Z":[[[0,1],[.7,1],[0,0],[.7,0]]],"-":[[[.15,.5],[.55,.5]]],">":[[[.1,.85],[.6,.5],[.1,.15]]]};
const textW=(s,h)=>((s.length-1)*.95+.7)*h;
function strokes(text,c,h,ax=[1,0]){
  const out=[], up=[-ax[1],ax[0]], x0=-textW(text,h)/2, y0=-h/2;
  [...text].forEach((ch,k)=>{(FONT[ch]||[]).forEach(st=>{const pl=st.map(([px,py])=>{
    const lx=x0+(k*.95+px)*h, ly=y0+py*h; return [c[0]+ax[0]*lx+up[0]*ly, c[1]+ax[1]*lx+up[1]*ly];});pl.h=h;out.push(pl)})});
  return out;
}

/* ---------------- 3D convex solids from half-spaces ---------------- */
function anyPerp(n){const r=Math.abs(n.y)<.9?new V(0,1,0):new V(1,0,0);return new V().crossVectors(n,r).normalize()}
function clipPoly(poly,q){
  const out=[], m=poly.length;
  for(let i=0;i<m;i++){const a=poly[i],b=poly[(i+1)%m],da=q.n.dot(a)-q.d,db=q.n.dot(b)-q.d;
    if(da<=1e-7)out.push(a);
    if((da<-1e-7&&db>1e-7)||(da>1e-7&&db<-1e-7))out.push(a.clone().lerp(b,da/(da-db)));}
  const r=[];for(const p of out){if(!r.length||r[r.length-1].distanceToSquared(p)>1e-6)r.push(p)}
  if(r.length>1&&r[0].distanceToSquared(r[r.length-1])<1e-6)r.pop();
  return r;
}
function polygonOnPlane(pl,planes,size){
  const n=pl.n,u=anyPerp(n),v=new V().crossVectors(n,u),c=n.clone().multiplyScalar(pl.d);
  let poly=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>c.clone().addScaledVector(u,a*size).addScaledVector(v,b*size));
  for(const q of planes){if(q===pl)continue;poly=clipPoly(poly,q);if(poly.length<3)return null}
  return poly;
}
function area3(poly,n){const s=new V();for(let i=0;i<poly.length;i++)s.add(new V().crossVectors(poly[i],poly[(i+1)%poly.length]));return Math.abs(s.dot(n))/2}
function solidFaces(planes){const F=[];for(const pl of planes){const p=polygonOnPlane(pl,planes,1000);if(p&&area3(p,pl.n)>.05)F.push({pl,poly:p})}return F}

/* ---------------- 2D helpers + Clipper ---------------- */
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]], mul=(a,s)=>[a[0]*s,a[1]*s], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
function clip2(poly,p0,m,off){
  const out=[],f=p=>dot(sub(p,p0),m)-off;
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],fa=f(a),fb=f(b);
    if(fa>=0)out.push(a);if((fa<0&&fb>0)||(fa>0&&fb<0))out.push(add(a,mul(sub(b,a),fa/(fa-fb))));}
  return out;
}
const CS=10000;
function toC(p){let c=p.map(([x,y])=>({X:Math.round(x*CS),Y:Math.round(y*CS)}));if(ClipperLib.Clipper.Area(c)<0)c.reverse();return c}
function boolTree(subj,holes){
  const c=new ClipperLib.Clipper();
  c.AddPaths(subj.filter(p=>p.length>2).map(toC),ClipperLib.PolyType.ptSubject,true);
  const h=holes.filter(p=>p.length>2);if(h.length)c.AddPaths(h.map(toC),ClipperLib.PolyType.ptClip,true);
  const tree=new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctDifference,tree,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);
  return treeData(tree);
}
function treeData(tree){
  const contours=[],shapes=[],cv=n=>n.Contour().map(p=>[p.X/CS,p.Y/CS]);
  (function walk(node){for(const o of node.Childs()){const outer=cv(o);if(outer.length<3)continue;contours.push(outer);const hs=[];
    for(const hn of o.Childs()){const hp=cv(hn);if(hp.length>2){contours.push(hp);hs.push(hp)}walk(hn)}shapes.push({outer,holes:hs})}})(tree);
  return {contours,shapes};
}
const rawC=p=>p.map(([x,y])=>({X:Math.round(x*CS),Y:Math.round(y*CS)})), fromC=p=>p.map(q=>[q.X/CS,q.Y/CS]);
const areaF=c=>{let a=0;for(let i=0;i<c.length;i++){const p=c[i],q=c[(i+1)%c.length];a+=p[0]*q[1]-q[0]*p[1]}return a/2};
function clipTree(subjRaw,clipPolys,type){const c=new ClipperLib.Clipper();c.AddPaths(subjRaw,ClipperLib.PolyType.ptSubject,true);
  if(clipPolys.length)c.AddPaths(clipPolys.map(toC),ClipperLib.PolyType.ptClip,true);const tree=new ClipperLib.PolyTree();
  c.Execute(type,tree,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);return treeData(tree)}
function offsetC(raw,delta,round){const co=new ClipperLib.ClipperOffset(2,CS*.002);
  co.AddPaths(ClipperLib.Clipper.CleanPolygons(raw,CS*.001),round?ClipperLib.JoinType.jtRound:ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);const sol=new ClipperLib.Paths();co.Execute(sol,delta*CS);
  return sol.filter(c=>c.length>2&&Math.abs(ClipperLib.Clipper.Area(c))>CS*CS*1e-4)}
const circle=(c,r,n=14)=>Array.from({length:n},(_,i)=>[c[0]+r*Math.cos(i/n*Math.PI*2),c[1]+r*Math.sin(i/n*Math.PI*2)]);
