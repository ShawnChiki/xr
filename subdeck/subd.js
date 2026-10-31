// Subdeck: the SubD cage and its operations.
// A cage is { verts: [[x,y,z]...], faces: [[i,j,k,l]...], creases: Set of "a_b" edge keys (a < b) }.
// Faces may have any number of sides; open edges stay as surface borders and are kept sharp, with their corners pinned.

export const ek = (a, b) => a < b ? a + '_' + b : b + '_' + a;

// ---------- edges ----------
export function edgeMap(cage){
  const m = new Map();
  cage.faces.forEach((f, fi) => {
    for (let i = 0; i < f.length; i++){
      const a = f[i], b = f[(i + 1) % f.length], k = ek(a, b);
      let e = m.get(k); if (!e){ e = { a: Math.min(a, b), b: Math.max(a, b), faces: [] }; m.set(k, e); }
      e.faces.push(fi);
    }
  });
  return m;
}

// ---------- one level of Catmull-Clark ----------
// Open edges and creased edges are sharp. A border vertex that belongs to one face only stays where it is (a corner).
export function subdivide(cage){
  const V = cage.verts, F = cage.faces, E = edgeMap(cage), cr = cage.creases || new Set();
  const nV = V.length, nF = F.length;
  const fp = F.map(f => { const p = [0, 0, 0]; for (const i of f){ p[0] += V[i][0]; p[1] += V[i][1]; p[2] += V[i][2]; } return p.map(x => x / f.length); });
  const sharp = e => e.faces.length !== 2 || cr.has(ek(e.a, e.b));
  const keys = [...E.keys()], eIndex = new Map(keys.map((k, i) => [k, i]));
  const ep = keys.map(k => {
    const e = E.get(k), a = V[e.a], b = V[e.b];
    if (sharp(e)) return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const f0 = fp[e.faces[0]], f1 = fp[e.faces[1]];
    return [0, 1, 2].map(j => (a[j] + b[j] + f0[j] + f1[j]) / 4);
  });
  // per vertex: incident edges and faces
  const vEdges = Array.from({ length: nV }, () => []), vFaces = Array.from({ length: nV }, () => []);
  for (const k of keys){ const e = E.get(k); vEdges[e.a].push(e); vEdges[e.b].push(e); }
  F.forEach((f, fi) => { for (const i of f) vFaces[i].push(fi); });
  const vp = V.map((P, i) => {
    const es = vEdges[i]; if (!es.length) return P.slice();
    const sh = es.filter(sharp);
    if (sh.length > 2 || (sh.length === 2 && vFaces[i].length === 1 && sh.every(e => e.faces.length === 1))) return P.slice();
    if (sh.length === 2){
      const o = sh.map(e => V[e.a === i ? e.b : e.a]);
      return [0, 1, 2].map(j => (6 * P[j] + o[0][j] + o[1][j]) / 8);
    }
    const n = es.length, Q = [0, 0, 0], R = [0, 0, 0];
    for (const fi of vFaces[i]) for (let j = 0; j < 3; j++) Q[j] += fp[fi][j] / vFaces[i].length;
    for (const e of es){ const a = V[e.a], b = V[e.b]; for (let j = 0; j < 3; j++) R[j] += (a[j] + b[j]) / 2 / n; }
    return [0, 1, 2].map(j => (Q[j] + 2 * R[j] + (n - 3) * P[j]) / n);
  });
  const verts = [...vp, ...fp, ...ep];
  const FI = fi => nV + fi, EI = (a, b) => nV + nF + eIndex.get(ek(a, b));
  const faces = [];
  F.forEach((f, fi) => {
    const n = f.length;
    for (let i = 0; i < n; i++){
      const p = f[(i - 1 + n) % n], c = f[i], q = f[(i + 1) % n];
      faces.push([c, EI(c, q), FI(fi), EI(p, c)]);
    }
  });
  const creases = new Set();
  for (const k of cr){ const e = E.get(k); if (!e) continue; const m = EI(e.a, e.b); creases.add(ek(e.a, m)); creases.add(ek(m, e.b)); }
  return { verts, faces, creases };
}

export function subdivideN(cage, n){ let c = cage; for (let i = 0; i < n; i++) c = subdivide(c); return c; }

// triangles + per-vertex positions for drawing (fan per face)
export function triangulate(cage){
  const pos = new Float32Array(cage.verts.length * 3);
  cage.verts.forEach((v, i) => { pos[3 * i] = v[0]; pos[3 * i + 1] = v[1]; pos[3 * i + 2] = v[2]; });
  const idx = [];
  for (const f of cage.faces) for (let i = 1; i < f.length - 1; i++) idx.push(f[0], f[i], f[i + 1]);
  return { pos, idx };
}

// ---------- primitives ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// A rectangle from corner o along u and v, cut into nu x nv quads
export function makeSurface(o, u, v, nu = 3, nv = 3){
  const verts = [], faces = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) verts.push(add(o, add(mul(u, i / nu), mul(v, j / nv))));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++){ const a = j * (nu + 1) + i; faces.push([a, a + 1, a + nu + 2, a + nu + 1]); }
  return { verts, faces, creases: new Set() };
}

// A box from its centre and axes (half sizes built into x, y, z). All twelve edges start sharp, so it reads as a box.
export function makeBlock(c, x, y, z){
  const verts = [];
  for (const sz of [-1, 1]) for (const sy of [-1, 1]) for (const sx of [-1, 1]) verts.push(add(c, add(mul(x, sx), add(mul(y, sy), mul(z, sz)))));
  // vertex index = (sz>0)*4 + (sy>0)*2 + (sx>0)
  const faces = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
  const cage = { verts, faces, creases: new Set() };
  for (const k of edgeMap(cage).keys()) cage.creases.add(k);
  return cage;
}

// A ring of n sides around centre c (axes x, z horizontal radii, y up the height). rings = number of rows of vertices.
// cap: close the bottom with one n-sided face (a bowl).
export function makeTube(c, x, y, z, n = 8, rings = 3, cap = false){
  const verts = [], faces = [];
  for (let r = 0; r < rings; r++){
    const h = r / (rings - 1);
    for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2; verts.push(add(c, add(mul(x, Math.cos(a)), add(mul(z, Math.sin(a)), mul(y, h))))); }
  }
  for (let r = 0; r < rings - 1; r++) for (let i = 0; i < n; i++){
    const a = r * n + i, b = r * n + (i + 1) % n; faces.push([a, a + n, b + n, b]);
  }
  if (cap) faces.push(Array.from({ length: n }, (_, i) => i));
  return { verts, faces, creases: new Set() };
}

// ---------- editing ----------
// Pull a new strip off an open border edge. Returns the two new vertex indices, or null if the edge is not open.
export function extrudeEdge(cage, a, b){
  const e = edgeMap(cage).get(ek(a, b)); if (!e || e.faces.length !== 1) return null;
  // follow the face's own direction round this edge so the new face winds the same way
  const f = cage.faces[e.faces[0]], i = f.indexOf(a), fwd = f[(i + 1) % f.length] === b;
  const [p, q] = fwd ? [a, b] : [b, a];             // the face runs p -> q
  const p2 = cage.verts.length, q2 = p2 + 1;
  cage.verts.push(cage.verts[p].slice(), cage.verts[q].slice());
  cage.faces.push([q, p, p2, q2]);
  return [p2, q2];
}

// Pull several faces out as one piece: shared edges stay inside, side walls go round the outline.
// Returns a Map old vertex -> new vertex.
export function extrudeFaces(cage, fis){
  const set = new Set(fis), map = new Map(), cnt = new Map();
  const nv = v => { if (!map.has(v)){ map.set(v, cage.verts.length); cage.verts.push(cage.verts[v].slice()); } return map.get(v); };
  for (const fi of set){ const f = cage.faces[fi]; for (let i = 0; i < f.length; i++){ const k = ek(f[i], f[(i + 1) % f.length]); cnt.set(k, (cnt.get(k) || 0) + 1); } }
  const sides = [];
  for (const fi of set){ const f = cage.faces[fi]; for (let i = 0; i < f.length; i++){ const a = f[i], b = f[(i + 1) % f.length]; if (cnt.get(ek(a, b)) === 1) sides.push([a, b]); } }
  const old = new Set(cage.creases);
  for (const fi of set) cage.faces[fi] = cage.faces[fi].map(nv);
  for (const [a, b] of sides){ cage.faces.push([a, b, map.get(b), map.get(a)]); if (old.has(ek(a, b))) cage.creases.add(ek(map.get(a), map.get(b))); }
  // sharp edges inside the region move up to the new top
  for (const k of old){ if (cnt.get(k) === 2){ const [a, b] = k.split('_').map(Number); cage.creases.delete(k); cage.creases.add(ek(map.get(a), map.get(b))); } }
  // a corner where both outline edges were sharp keeps a sharp edge up the side (a box stays a box)
  const sharpSides = new Map(); for (const [a, b] of sides) for (const v of [a, b]) sharpSides.set(v, (sharpSides.get(v) || []).concat(old.has(ek(a, b))));
  for (const [v, l] of sharpSides) if (l.length >= 2 && l.every(Boolean)) cage.creases.add(ek(v, map.get(v)));
  return map;
}
// one face; returns the new face's vertices
export function extrudeFace(cage, fi){ extrudeFaces(cage, [fi]); return cage.faces[fi].slice(); }

// Pull a run of open edges out together (neighbouring edges share their new points). Returns Map old -> new, or null.
export function extrudeEdges(cage, edges){
  const E = edgeMap(cage), map = new Map(); let n = 0;
  const nv = v => { if (!map.has(v)){ map.set(v, cage.verts.length); cage.verts.push(cage.verts[v].slice()); } return map.get(v); };
  for (const [a, b] of edges){
    const e = E.get(ek(a, b)); if (!e || e.faces.length !== 1) continue;
    const f = cage.faces[e.faces[0]], i = f.indexOf(a), fwd = f[(i + 1) % f.length] === b;
    const [p, q] = fwd ? [a, b] : [b, a];
    cage.faces.push([q, p, nv(p), nv(q)]); n++;
  }
  return n ? map : null;
}

// a mirror copy across the x = 0 plane (faces flipped so they still face out)
export function mirrorCage(c){ return { verts: c.verts.map(v => [-v[0], v[1], v[2]]), faces: c.faces.map(f => f.slice().reverse()), creases: new Set(c.creases) }; }

// a smooth ball: a cube cage with no sharp edges
export function makeBlob(c, x, y, z){ const b = makeBlock(c, x, y, z); b.creases.clear(); return b; }

// Cut a new edge loop across the ring of four-sided faces that this edge belongs to. Returns the new vertex indices.
export function loopCut(cage, a, b, t = 0.5){
  const E = edgeMap(cage), start = E.get(ek(a, b)); if (!start) return [];
  const ringEdges = new Map();                 // edge key -> [from, to] (direction used for t)
  const ringFaces = new Map();                 // face index -> local index i of the entry edge
  ringEdges.set(ek(a, b), [a, b]);
  // walk away from the start edge through each of its faces
  for (const f0 of start.faces){
    let fi = f0, from = a, to = b;
    while (fi !== undefined && !ringFaces.has(fi)){
      const f = cage.faces[fi]; if (f.length !== 4) break;
      let i = -1; for (let k = 0; k < 4; k++){ const x = f[k], y = f[(k + 1) % 4]; if ((x === from && y === to) || (x === to && y === from)){ i = k; break; } }
      if (i < 0) break;
      ringFaces.set(fi, i);
      // the opposite edge, oriented so it lines up with the entry edge (from sits across from oFrom)
      const x = f[i], y = f[(i + 1) % 4], z = f[(i + 2) % 4], w = f[(i + 3) % 4];
      const oFrom = x === from ? w : z, oTo = x === from ? z : w, k = ek(oFrom, oTo);
      if (ringEdges.has(k)) break;
      ringEdges.set(k, [oFrom, oTo]);
      const oe = E.get(k); fi = oe.faces.find(g => g !== fi); from = oFrom; to = oTo;
    }
  }
  // a new vertex on each crossed edge
  const mid = new Map(), out = [];
  for (const [k, [p, q]] of ringEdges){
    const P = cage.verts[p], Q = cage.verts[q];
    mid.set(k, cage.verts.length); out.push(cage.verts.length);
    cage.verts.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, P[2] + (Q[2] - P[2]) * t]);
    if (cage.creases.has(k)){ cage.creases.delete(k); const m = mid.get(k); cage.creases.add(ek(p, m)); cage.creases.add(ek(m, q)); }
  }
  const faces = [];
  cage.faces.forEach((f, fi) => {
    if (ringFaces.has(fi)){
      const i = ringFaces.get(fi), v = k => f[(i + k) % 4];
      const m1 = mid.get(ek(v(0), v(1))), m2 = mid.get(ek(v(2), v(3)));
      faces.push([v(0), m1, m2, v(3)], [m1, v(1), v(2), m2]);
    } else {
      // a neighbouring face that shares a cut edge gets the new vertex in its outline
      const g = [];
      for (let i = 0; i < f.length; i++){ g.push(f[i]); const m = mid.get(ek(f[i], f[(i + 1) % f.length])); if (m !== undefined) g.push(m); }
      faces.push(g);
    }
  });
  cage.faces = faces;
  return out;
}

// Delete faces, then drop vertices nobody uses. Returns false if the cage is now empty.
export function deleteFaces(cage, list){
  const kill = new Set(list); cage.faces = cage.faces.filter((f, i) => !kill.has(i));
  compact(cage); return cage.faces.length > 0;
}

export function compact(cage){
  const used = new Set(); for (const f of cage.faces) for (const v of f) used.add(v);
  const map = new Map(), verts = [];
  cage.verts.forEach((v, i) => { if (used.has(i)){ map.set(i, verts.length); verts.push(v); } });
  cage.faces = cage.faces.map(f => f.map(v => map.get(v)));
  const cr = new Set(); for (const k of cage.creases){ const [a, b] = k.split('_').map(Number); if (map.has(a) && map.has(b)) cr.add(ek(map.get(a), map.get(b))); }
  cage.creases = cr; return map;
}

// Merge vertex `from` into vertex `to`. Faces that would collapse lose the doubled corner; faces with fewer than 3 corners go.
export function weld(cage, from, to){
  if (from === to) return;
  cage.faces = cage.faces.map(f => {
    const g = f.map(v => v === from ? to : v), h = [];
    for (let i = 0; i < g.length; i++) if (g[i] !== g[(i + 1) % g.length]) h.push(g[i]);
    return h;
  }).filter(f => f.length >= 3);
  const cr = new Set(); for (const k of cage.creases){ let [a, b] = k.split('_').map(Number); if (a === from) a = to; if (b === from) b = to; if (a !== b) cr.add(ek(a, b)); }
  cage.creases = cr; compact(cage);
}

// open border vertices (on an edge with only one face)
export function borderVerts(cage){
  const s = new Set(); for (const e of edgeMap(cage).values()) if (e.faces.length === 1){ s.add(e.a); s.add(e.b); } return s;
}

export const cloneCage = c => ({ verts: c.verts.map(v => v.slice()), faces: c.faces.map(f => f.slice()), creases: new Set(c.creases) });
export const cageToJSON = c => ({ verts: c.verts.map(v => v.map(x => Math.round(x * 1e5) / 1e5)), faces: c.faces, creases: [...c.creases] });
export const cageFromJSON = o => ({ verts: o.verts.map(v => v.slice()), faces: o.faces.map(f => f.slice()), creases: new Set(o.creases || []) });
