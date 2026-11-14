// Edgewise join: closed solids that overlap or touch show as one solid with one outer surface.
// Your sketch stays as separate solids you can keep editing; this only works out what to show (and export):
// every face is trimmed to the part that's outside the other solids, faces pressed together vanish, and where
// two solids share a flat face it's drawn once.
//
// How: for a face of solid A, cut every other solid B in its group with the face's plane, nudged a hair outward.
// That slice is the part of the plane B fills just outside A, so whatever of the face lies in it is buried.
// The 2D sums are done by polygon-clipping (pc).

import { planeOf, basis, orient, V } from './core.js';
const { sub, add, mul, dot, cross, norm } = V;

const EPS = 5e-4;   // half a millimetre at 1:1: how far "touching" reaches

// slice a closed solid (its faces with outward loops) by the plane n·x = d: closed loops of 3D points
function slice(faces, X, n, d){
  const segs = [];           // [keyA, pA, keyB, pB]
  for (const f of faces){
    const loops = [f.loop, ...f.holes];
    const nf = f.n, L = norm(cross(n, nf));
    if (Math.hypot(...cross(n, nf)) < 1e-9) continue;          // parallel to the plane: no crossing
    const hits = [];
    for (const lp of loops){
      for (let i = 0; i < lp.length; i++){
        const a = lp[i], b = lp[(i + 1) % lp.length];
        const sa = dot(n, X[a]) - d, sb = dot(n, X[b]) - d;
        if ((sa > 0) === (sb > 0) || sa === sb) continue;
        const t = sa / (sa - sb), p = add(X[a], mul(sub(X[b], X[a]), t));
        hits.push({ key: a < b ? a + '-' + b : b + '-' + a, p, s: dot(p, L) });
      }
    }
    if (hits.length % 2) return null;                              // a corner sits right on the plane: give up on this one
    hits.sort((x, y) => x.s - y.s);
    for (let i = 0; i < hits.length; i += 2) segs.push([hits[i].key, hits[i].p, hits[i + 1].key, hits[i + 1].p]);
  }
  // chain the pieces into loops: each crossed edge is shared by exactly two faces
  const at = new Map();
  segs.forEach((s, i) => { for (const k of [s[0], s[2]]){ if (!at.has(k)) at.set(k, []); at.get(k).push(i); } });
  const used = new Array(segs.length).fill(false), loops = [];
  for (let s0 = 0; s0 < segs.length; s0++){
    if (used[s0]) continue;
    const loop = []; let i = s0, from = segs[s0][0];
    for (let guard = 0; guard < segs.length + 2; guard++){
      used[i] = true;
      const s = segs[i], [k1, p1, k2, p2] = s[0] === from ? s : [s[2], s[3], s[0], s[1]];
      loop.push(p1);
      const nx = (at.get(k2) || []).find(j => !used[j]);
      if (nx === undefined) break;
      i = nx; from = k2;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

// F: findFaces result, X: corner positions. Returns null when nothing overlaps, else
// { group: Map piece -> group id (the lowest piece in it), faces: [{ piece, group, n, rings: [outer, ...holes] (3D) }], replaced: Set of face keys }
export function joinSolids(sk, F, X, pc){
  const closed = F.pieces.filter(p => p.closed).map(p => p.id);
  if (closed.length < 2) return null;
  // each closed solid: its faces wound outward, and a box around it
  const solids = new Map();
  for (const pid of closed){
    const fs = F.faces.filter(f => f.piece === pid && !f.open);
    if (fs.some(f => f.all.some(id => !X[id]))) continue;
    const loops = orient(fs, X);
    const faces = fs.map((f, i) => ({ key: f.key, loop: loops[i], holes: f.holes, n: planeOf(loops[i].map(id => X[id])).n, all: f.all }));
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const f of fs) for (const id of f.all) for (let k = 0; k < 3; k++){ lo[k] = Math.min(lo[k], X[id][k]); hi[k] = Math.max(hi[k], X[id][k]); }
    solids.set(pid, { pid, faces, lo, hi });
  }
  // groups: solids whose boxes overlap or touch
  const ids = [...solids.keys()], par = new Map(ids.map(i => [i, i]));
  const root = i => par.get(i) === i ? i : (par.set(i, root(par.get(i))), par.get(i));
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++){
    const A = solids.get(ids[a]), B = solids.get(ids[b]);
    if ([0, 1, 2].every(k => A.lo[k] <= B.hi[k] + EPS && B.lo[k] <= A.hi[k] + EPS)){
      const ra = root(ids[a]), rb = root(ids[b]); if (ra !== rb) par.set(Math.max(ra, rb), Math.min(ra, rb));
    }
  }
  const group = new Map(ids.map(i => [i, root(i)]));
  const members = new Map();
  for (const i of ids){ const g = group.get(i); if (!members.has(g)) members.set(g, []); members.get(g).push(i); }
  const out = [], replaced = new Set();
  let any = false;
  for (const [g, ms] of members){
    if (ms.length < 2) continue;
    for (const pid of ms){
      const A = solids.get(pid);
      for (const f of A.faces){
        const n = f.n, c = X[f.loop[0]], d0 = dot(n, c), [u, w] = basis(n);
        const to2 = p => { const q = sub(p, c); return [dot(q, u), dot(q, w)]; };
        const to3 = q => add(c, add(mul(u, q[0]), mul(w, q[1])));
        const me = [f.loop.map(id => to2(X[id])), ...f.holes.map(H => H.map(id => to2(X[id])))];
        const cuts = [];
        for (const qid of ms){
          if (qid === pid) continue;
          const B = solids.get(qid);
          // quick skip: B's box doesn't reach this plane
          let mn = Infinity, mx = -Infinity;
          for (const x of [B.lo[0], B.hi[0]]) for (const y of [B.lo[1], B.hi[1]]) for (const z of [B.lo[2], B.hi[2]]){ const s = dot(n, [x, y, z]) - d0; mn = Math.min(mn, s); mx = Math.max(mx, s); }
          const sl = (mx < EPS * 0.5 || mn > EPS * 1.5) ? null : slice(B.faces, X, n, d0 + EPS);
          if (sl && sl.length){
            // the loops of a slice nest (a slice through a ring is a ring): xor sorts out which is inside which
            const rings = sl.map(L => [L.map(p => to2(p))]);
            try { cuts.push(rings.length === 1 ? rings[0] : pc.xor(...rings)); } catch (e) {}
          }
          // a face of B lying flat on this face, facing the same way: drawn once, by the older solid
          if (qid < pid) for (const g2 of B.faces){
            if (dot(g2.n, n) < 0.999 || Math.abs(dot(n, X[g2.loop[0]]) - d0) > EPS * 2) continue;
            cuts.push([g2.loop.map(id => to2(X[id])), ...g2.holes.map(H => H.map(id => to2(X[id])))]);
          }
        }
        if (!cuts.length) continue;
        let res;
        try { res = pc.difference(me, ...cuts); } catch (e) { continue; }
        // a sliver thinner than the touching distance is nothing
        const area2 = r => { let a = 0; for (let i = 0; i < r.length; i++){ const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
        const before = area2(me[0]) - me.slice(1).reduce((s, r) => s + area2(r), 0);
        const after = res.reduce((s, poly) => s + area2(poly[0]) - poly.slice(1).reduce((t, r) => t + area2(r), 0), 0);
        if (Math.abs(before - after) < 1e-7) continue;          // nothing of it was buried
        any = true; replaced.add(f.key);
        for (const poly of res){
          if (area2(poly[0]) < 1e-6) continue;
          const rings = poly.map(r => { const rr = r.slice(); const a = rr[0], z = rr[rr.length - 1]; if (a[0] === z[0] && a[1] === z[1]) rr.pop(); return rr.map(to3); });
          out.push({ piece: pid, group: g, n, rings });
        }
      }
    }
  }
  if (!any) return { group, faces: [], replaced };
  return { group, faces: out, replaced };
}
