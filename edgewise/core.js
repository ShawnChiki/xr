// Edgewise core: sketched strokes → straight edges → corners → flat faces → a tidy solid.
// Pure math, no three.js, so it can be tested on its own. All sizes are in model units (metres at 1:1).
//
// The sketch is the source of truth (like Pentimento): every corner remembers each stroke end that landed on it,
// and its target is the average of those. The solver then finds flat faces in the graph of edges and nudges the
// corners until every face is truly flat (and, with Square up on, edges that are nearly vertical, level or on the
// grid become exactly so), staying as close as it can to what you drew.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dist = (a, b) => len(sub(a, b));
export const V = { sub, add, mul, dot, cross, len, norm, dist };

// ---------------------------------------------------------------- strokes
// Best straight line through a stroke: the long axis of its points, ends where the first and last points sit on it.
export function fitLine(pts){
  const n = pts.length;
  if (n < 2) return null;
  let c = [0, 0, 0];
  for (const p of pts) c = add(c, p);
  c = mul(c, 1 / n);
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (const p of pts){ const d = sub(p, c); xx += d[0] * d[0]; xy += d[0] * d[1]; xz += d[0] * d[2]; yy += d[1] * d[1]; yz += d[1] * d[2]; zz += d[2] * d[2]; }
  let d = norm(sub(pts[n - 1], pts[0]));
  if (!len(sub(pts[n - 1], pts[0]))) d = [1, 0, 0];
  for (let i = 0; i < 24; i++){ // power iteration from the chord direction
    const nd = [xx * d[0] + xy * d[1] + xz * d[2], xy * d[0] + yy * d[1] + yz * d[2], xz * d[0] + yz * d[1] + zz * d[2]];
    const l = len(nd); if (!l) break; d = mul(nd, 1 / l);
  }
  if (dot(d, sub(pts[n - 1], pts[0])) < 0) d = mul(d, -1);
  // ends: the extreme projections (a stroke that overshoots at the start still gives the full edge)
  let t0 = Infinity, t1 = -Infinity;
  for (const p of pts){ const t = dot(sub(p, c), d); if (t < t0) t0 = t; if (t > t1) t1 = t; }
  return { a: add(c, mul(d, t0)), b: add(c, mul(d, t1)), dir: d };
}

// closest point on segment ab to p, with its parameter
function closestOnSeg(p, a, b){
  const ab = sub(b, a), L2 = dot(ab, ab);
  const t = L2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / L2)) : 0;
  return { t, q: add(a, mul(ab, t)) };
}

// ---------------------------------------------------------------- the sketch
export function emptySketch(){ return { v: [], e: [], s: [], open: [], locks: [], skip: [], nid: 1 }; }

// Faces are named by their corners (a key like "3.8.12.15"). When a corner is added to an edge, or healed away,
// every saved face name (holes, locks) that runs along that edge is renamed to match.
function renameFaces(sk, fn){
  const re = k => { const ids = k.split('.').map(Number), r = fn(ids); return r ? faceKey(r) : k; };
  sk.open = (sk.open || []).map(re);
  sk.skip = (sk.skip || []).map(re);
  for (const L of sk.locks || []){ if (L.f) L.f = re(L.f); if (L.a) L.a = re(L.a); if (L.b) L.b = re(L.b); }
}
export const clone = sk => JSON.parse(JSON.stringify(sk));

export function anchorOf(v){
  if (v.pin) return v.pin;
  let c = [0, 0, 0];
  for (const p of v.ends) c = add(c, p);
  return mul(c, 1 / v.ends.length);
}
const vById = (sk, id) => sk.v.find(v => v.id === id);
const edgeBetween = (sk, a, b) => sk.e.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));

// Where would a stroke end at p land? On a corner, on an edge (splitting it), or free.
// pos: the positions you can see (solved), so you aim at what's on screen.
export function snapEnd(sk, p, pos, snapR, skipVert, faces){
  let best = null, bd = snapR;
  for (const v of sk.v){
    if (v.id === skipVert) continue;
    const q = pos[v.id] || anchorOf(v), d = dist(p, q);
    if (d < bd){ bd = d; best = { kind: 'vert', id: v.id, at: q }; }
  }
  if (best) return best;
  bd = snapR * 0.8;
  for (const e of sk.e){
    if (e.a === skipVert || e.b === skipVert) continue;
    const A = pos[e.a] || anchorOf(vById(sk, e.a)), B = pos[e.b] || anchorOf(vById(sk, e.b));
    const { t, q } = closestOnSeg(p, A, B), d = dist(p, q), L = dist(A, B);
    if (d < bd && t * L > snapR * 0.7 && (1 - t) * L > snapR * 0.7){ bd = d; best = { kind: 'edge', id: e.id, at: q, t }; }
  }
  if (best) return best;
  // a loose end close to a face lands on it (so a shape drawn on a big face lies flat in it)
  if (faces) for (const f of faces){
    const P = f.ids.map(id => pos[id]); if (P.some(x => !x)) continue;
    const pl = planeOf(P), h = dot(pl.n, sub(p, pl.c));
    if (Math.abs(h) > snapR) continue;
    const q = sub(p, mul(pl.n, h)), [u, w] = basis(pl.n), to2 = x => { const d = sub(x, pl.c); return [dot(d, u), dot(d, w)]; };
    const q2 = to2(q);
    if (!insidePoly2(q2, P.map(to2))) continue;
    if ((f.holes || []).some(H => insidePoly2(q2, H.map(id => to2(pos[id]))))) continue;
    if (!best || Math.abs(h) < best.h) best = { kind: 'free', at: q, h: Math.abs(h), face: f.key };
  }
  return best || { kind: 'free', at: p };
}

function splitEdge(sk, eid, at){
  const e = sk.e.find(x => x.id === eid);
  const n = { id: sk.nid++, ends: [at], split: true };
  sk.v.push(n);
  sk.e.splice(sk.e.indexOf(e), 1);
  sk.e.push({ id: sk.nid++, a: e.a, b: n.id, s: e.s }, { id: sk.nid++, a: n.id, b: e.b, s: e.s });
  renameFaces(sk, ids => ids.includes(e.a) && ids.includes(e.b) ? [...ids, n.id] : null);
  return n.id;
}

// Add one stroke (array of [x,y,z]) as one straight edge. Returns { ok, why, a, b, edge } and changes sk.
export function addStroke(sk, pts, pos, o){
  const f = fitLine(pts);
  if (!f) return { ok: false, why: 'too short' };
  const snapR = o.snapR;
  const sa = snapEnd(sk, f.a, pos, snapR, undefined, o.faces);
  const sb = snapEnd(sk, f.b, pos, snapR, sa.kind === 'vert' ? sa.id : undefined, o.faces);
  const A = sa.at, B = sb.at;
  if (dist(A, B) < Math.max(snapR * 0.9, o.minLen || 0)) return { ok: false, why: 'too short' };
  if (sa.kind === 'edge' && sb.kind === 'edge' && sa.id === sb.id) return { ok: false, why: 'runs along an edge' };
  const sid = sk.nid++;
  sk.s.push({ id: sid, p: pts.map(p => p.map(x => +x.toFixed(4))) });
  const endTo = (sn, raw) => {
    if (sn.kind === 'vert'){ const v = vById(sk, sn.id); v.ends.push(raw); return v.id; }
    if (sn.kind === 'edge') return splitEdge(sk, sn.id, sn.at);
    const v = { id: sk.nid++, ends: [raw] }; sk.v.push(v); return v.id;
  };
  // a corner's target is the average of every stroke end that landed on it
  const a = endTo(sa, sa.kind === 'vert' ? f.a.map(x => +x.toFixed(4)) : A);
  let sb2 = sb;
  if (sb.kind === 'edge' && sa.kind === 'edge'){
    // the first split may have replaced the edge the far end was going to land on: find it again
    sb2 = snapEnd(sk, f.b, pos, snapR, a, o.faces);
  }
  const b = endTo(sb2, sb2.kind === 'vert' ? f.b.map(x => +x.toFixed(4)) : B);
  let e = edgeBetween(sk, a, b);
  if (!e){ e = { id: sk.nid++, a, b, s: sid }; sk.e.push(e); }
  return { ok: true, a, b, edge: e.id, snapA: sa.kind, snapB: sb.kind };
}

// Take edges out; corners left with nothing go, and a split point left in the middle of a straight run is healed.
export function removeEdges(sk, ids){
  const set = new Set(ids);
  sk.e = sk.e.filter(e => !set.has(e.id));
  cleanup(sk);
}
// Join two corners into one: every line to `drop` goes to `keep` (a line between them disappears, doubled lines become
// one), faces, holes and locks follow. `at` pins the joined corner there.
export function mergeVerts(sk, keepId, dropId, at){
  if (keepId === dropId) return;
  const keep = vById(sk, keepId), drop = vById(sk, dropId); if (!keep || !drop) return;
  for (const e of sk.e){ if (e.a === dropId) e.a = keepId; if (e.b === dropId) e.b = keepId; }
  const seen = new Set();
  sk.e = sk.e.filter(e => { if (e.a === e.b) return false; const k = e.a < e.b ? e.a + '-' + e.b : e.b + '-' + e.a; if (seen.has(k)) return false; seen.add(k); return true; });
  keep.ends = keep.ends.concat(drop.ends);
  if (at) keep.pin = at.map(x => +x.toFixed(4));
  else if (drop.pin && !keep.pin) keep.pin = anchorOf(keep).map(x => +x.toFixed(4));
  sk.v = sk.v.filter(v => v !== drop);
  renameFaces(sk, ids => ids.includes(dropId) ? [...new Set(ids.map(i => i === dropId ? keepId : i))] : null);
  for (const L of sk.locks || []) for (const k of ['e', 'ea', 'eb']) if (L[k]) L[k] = L[k].map(i => i === dropId ? keepId : i);
  sk.locks = (sk.locks || []).filter(L => ['e', 'ea', 'eb'].every(k => !L[k] || L[k][0] !== L[k][1]));
  cleanup(sk);
}
// Corners closer than r (positions P) become one. Returns how many joined.
export function weld(sk, P, r){
  let n = 0, again = true;
  while (again){
    again = false;
    for (let i = 0; i < sk.v.length && !again; i++) for (let j = i + 1; j < sk.v.length && !again; j++){
      const a = sk.v[i], b = sk.v[j], pa = P[a.id], pb = P[b.id];
      if (!pa || !pb || dist(pa, pb) >= r) continue;
      mergeVerts(sk, a.id, b.id); n++; again = true;
    }
  }
  return n;
}
export function splitEdgeAt(sk, eid, at){ return splitEdge(sk, eid, at); }

export function removeVert(sk, id){
  const es = sk.e.filter(e => e.a === id || e.b === id);
  if (es.length === 2){
    const o0 = es[0].a === id ? es[0].b : es[0].a, o1 = es[1].a === id ? es[1].b : es[1].a;
    sk.e = sk.e.filter(e => e !== es[0] && e !== es[1]);
    if (o0 !== o1 && !edgeBetween(sk, o0, o1)) sk.e.push({ id: sk.nid++, a: o0, b: o1, s: es[0].s });
  } else sk.e = sk.e.filter(e => e.a !== id && e.b !== id);
  sk.v = sk.v.filter(v => v.id !== id);
  renameFaces(sk, ids => ids.includes(id) ? ids.filter(i => i !== id) : null);
  cleanup(sk);
}

// Pull a face out into a block: copies of its corners (where they are now, nudged out by `off` along n) joined back
// to the originals by side lines. The old loop is marked as the cap inside the extrusion. Returns the new face's corners.
export function extrude(sk, f, X, n, off, keepCap){
  const loops = [f.ids, ...(f.holes || [])], map = new Map();
  for (const L of loops) for (const id of L){
    const v = { id: sk.nid++, ends: [add(X[id], mul(n, off)).map(x => +x.toFixed(4))] };
    v.pin = v.ends[0]; sk.v.push(v); map.set(id, v.id);
    sk.e.push({ id: sk.nid++, a: id, b: v.id, s: null });
  }
  for (const L of loops) for (let i = 0; i < L.length; i++) sk.e.push({ id: sk.nid++, a: map.get(L[i]), b: map.get(L[(i + 1) % L.length]), s: null });
  // pulled out of a bigger face, the old loop stays as the new block's bottom (Join hides it); pulled out of a
  // solid's own face, the old loop is now inside that solid
  sk.skip = sk.skip || [];
  if (!keepCap && !sk.skip.includes(f.key)) sk.skip.push(f.key);
  // a lock or hole on the old face carries on to the new one
  const nk = faceKey(f.ids.map(id => map.get(id)));
  if (!keepCap) for (const L of sk.locks || []){ if (L.f === f.key) L.f = nk; if (L.a === f.key) L.a = nk; if (L.b === f.key) L.b = nk; }
  sk.open = (sk.open || []).map(k => k === f.key ? nk : k);
  return { key: nk, ids: [...map.values()], map };
}

export function cleanup(sk){
  for (let pass = 0; pass < 4; pass++){
    const deg = new Map();
    for (const e of sk.e){ deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
    sk.v = sk.v.filter(v => deg.get(v.id));
    let changed = false;
    for (const v of sk.v){
      if (!v.split || deg.get(v.id) !== 2) continue;
      const es = sk.e.filter(e => e.a === v.id || e.b === v.id);
      const o0 = es[0].a === v.id ? es[0].b : es[0].a, o1 = es[1].a === v.id ? es[1].b : es[1].a;
      const P = anchorOf(v), A = anchorOf(vById(sk, o0)), B = anchorOf(vById(sk, o1));
      if (dot(norm(sub(A, P)), norm(sub(B, P))) < -0.985 && !edgeBetween(sk, o0, o1)){
        sk.e = sk.e.filter(e => e !== es[0] && e !== es[1]);
        sk.e.push({ id: sk.nid++, a: o0, b: o1, s: es[0].s });
        sk.v = sk.v.filter(x => x !== v);
        renameFaces(sk, ids => ids.includes(v.id) ? ids.filter(i => i !== v.id) : null);
        changed = true; break;
      }
    }
    if (!changed) break;
  }
  const used = new Set(sk.e.map(e => e.s));
  sk.s = sk.s.filter(s => used.has(s.id));
  const alive = new Set(sk.v.map(v => v.id));
  sk.skip = (sk.skip || []).filter(k => k.split('.').every(id => alive.has(+id)));
  sk.locks = (sk.locks || []).filter(L => [L.e, L.ea, L.eb].every(e => !e || e.every(id => alive.has(id))));
}

// ---------------------------------------------------------------- faces
const faceKey = ids => [...ids].sort((a, b) => a - b).join('.');
export { faceKey };

// Newell normal + centroid of a polygon
function planeOf(P){
  let n = [0, 0, 0], c = [0, 0, 0];
  for (let i = 0; i < P.length; i++){
    const a = P[i], b = P[(i + 1) % P.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    c = add(c, a);
  }
  const area = len(n) / 2;
  return { n: norm(n), c: mul(c, 1 / P.length), area };
}
function basis(n){
  const t = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(t, n)), w = cross(n, u);
  return [u, w];
}
function segsCross2(a, b, c, d){
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 && d2 && d3 && d4;
}
function insidePoly2(p, poly){
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function distToPoly2(p, poly){
  let d = Infinity;
  for (let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length], ab = [b[0] - a[0], b[1] - a[1]], L2 = ab[0] * ab[0] + ab[1] * ab[1];
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2)) : 0;
    d = Math.min(d, Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t));
  }
  return d;
}

// Every closed loop of edges that lies (nearly) flat and has nothing cutting across it is a face.
// Loops are kept smallest first, and an edge belongs to at most two faces.
// o: { rel: how flat, as a share of the loop's edge length (0.18), minTol, maxSides (8) }
export function findFaces(sk, pos, o = {}){
  const rel = o.rel ?? 0.22, minTol = o.minTol ?? 0.015, maxSides = o.maxSides ?? 32;
  const P = id => pos[id];
  const adj = new Map();
  for (const v of sk.v) adj.set(v.id, []);
  for (const e of sk.e){ adj.get(e.a)?.push(e.b); adj.get(e.b)?.push(e.a); }
  const hasEdge = (a, b) => adj.get(a)?.includes(b);
  const cands = new Map();
  const skipSet = new Set(sk.skip || []);
  let work = 0;
  for (const e of sk.e){
    // loops through this edge, found from the loop's smallest corner (so the search stays small)
    const s = Math.min(e.a, e.b), t = Math.max(e.a, e.b);
    const path = [s, t], onPath = new Set(path), pl = { n: null, c: null };
    let maxL = dist(P(s), P(t));
    const go = () => {
      if (++work > 3000000) return;
      const last = path[path.length - 1];
      for (const w of adj.get(last)){
        if (w === s && path.length >= 3){ const k = faceKey(path); if (!cands.has(k)) cands.set(k, path.slice()); continue; }
        if (onPath.has(w) || path.length >= maxSides || w < s) continue;
        const pw = P(w), L = Math.max(maxL, dist(P(last), pw)), tol = Math.max(minTol, rel * L) * 1.6;
        const sn = pl.n, sc = pl.c;
        if (pl.n){ if (Math.abs(dot(pl.n, sub(pw, pl.c))) > tol) continue; }
        else {
          // the first time three corners make a real angle, that's the plane to test the rest against
          const p0 = P(path[0]), p1 = P(last);
          for (let i = 0; i < path.length - 1 && !pl.n; i++){
            const a = norm(sub(P(path[i + 1]), P(path[i]))), b = norm(sub(pw, p1)), c = cross(sub(p1, p0), sub(pw, p0));
            if (len(cross(a, b)) > 0.25 && len(c) > 1e-9){ pl.n = norm(c); pl.c = p0; }
          }
        }
        const sL = maxL; maxL = L; path.push(w); onPath.add(w);
        go();
        path.pop(); onPath.delete(w); pl.n = sn; pl.c = sc; maxL = sL;
      }
    };
    go();
  }

  // test each loop properly
  const good = [];
  for (const [k, ids] of cands){
    const pts = ids.map(P);
    const pl = planeOf(pts);
    if (pl.area < 1e-8) continue;
    let sumL = 0;
    for (let i = 0; i < pts.length; i++) sumL += dist(pts[i], pts[(i + 1) % pts.length]);
    const tol = Math.max(minTol, rel * sumL / pts.length);
    let err = 0;
    for (const p of pts) err = Math.max(err, Math.abs(dot(pl.n, sub(p, pl.c))));
    if (err > tol) continue;
    const [u, w] = basis(pl.n), to2 = p => { const d = sub(p, pl.c); return [dot(d, u), dot(d, w)]; };
    const poly = pts.map(to2);
    // a chord: an edge joining two corners of the loop that aren't next to each other, running across the inside,
    // cuts it in two. (One running outside it, across the mouth of a notch, like the bottom of a box standing in
    // the notch, doesn't.)
    let chord = false;
    for (let i = 0; i < ids.length && !chord; i++)
      for (let j = i + 2; j < ids.length && !chord; j++){
        if (i === 0 && j === ids.length - 1) continue;
        if (!hasEdge(ids[i], ids[j])) continue;
        // inside means inside on both sides of it (a line along the mouth of a notch has the notch on one side
        // and the outside on the other); tested a little either side so a line lying along the rim can't fool it
        const a = poly[i], b = poly[j], dx = b[0] - a[0], dy = b[1] - a[1], Lc = Math.hypot(dx, dy) || 1, e = 0.02 * Lc;
        const nx = -dy / Lc * e, ny = dx / Lc * e;
        let both = 0;
        for (const t of [0.3, 0.5, 0.7]){
          const m = [a[0] + dx * t, a[1] + dy * t];
          if (insidePoly2([m[0] + nx, m[1] + ny], poly) && insidePoly2([m[0] - nx, m[1] - ny], poly)) both++;
        }
        if (both >= 2) chord = true;
      }
    if (chord) continue;
    // must not cross itself
    let selfX = false;
    for (let i = 0; i < poly.length && !selfX; i++)
      for (let j = i + 2; j < poly.length && !selfX; j++){
        if (i === 0 && j === poly.length - 1) continue;
        if (segsCross2(poly[i], poly[(i + 1) % poly.length], poly[j], poly[(j + 1) % poly.length])) selfX = true;
      }
    if (selfX) continue;
    // a loop that's the cap left inside an extrusion isn't a face (while something still stands on it)
    if (skipSet.has(k) && ids.every(id => adj.get(id).length >= 3)) continue;
    // corners sitting inside it, on its plane: a closed loop of them (touching nothing on the rim) is a hole,
    // like a rectangle drawn in the middle of a big face; lines that cut across from rim to rim mean it isn't one face
    // (lying on it means close to its plane by the measure of a hand's wobble, much tighter than the loop's own test)
    const inSet = new Set(ids), inner = new Set(), tolIn = Math.max(minTol * 2, Math.min(tol, 0.06 * sumL / pts.length));
    for (const v of sk.v){
      if (inSet.has(v.id)) continue;
      const p = P(v.id);
      if (Math.abs(dot(pl.n, sub(p, pl.c))) > tolIn) continue;
      const q = to2(p);
      if (insidePoly2(q, poly) && distToPoly2(q, poly) > tol * 0.5) inner.add(v.id);
    }
    let blocked = false;
    const islands = [];
    for (const start of inner){
      if (islands.some(I => I.set.has(start))) continue;
      const set = new Set([start]), st = [start];
      let contacts = 0;
      while (st.length){ const x = st.pop(); for (const y of adj.get(x)){ if (inner.has(y) && !set.has(y)){ set.add(y); st.push(y); } else if (inSet.has(y)) contacts++; } }
      if (contacts >= 2){ blocked = true; break; }
      islands.push({ set, contacts });
    }
    if (blocked) continue;
    const holes = [];
    for (const I of islands){
      if (I.contacts) continue;                     // a single spur off the rim: just a loose line on the face
      // only a shape drawn flat in the face is a hole in it; something standing on the face (lines leaving the
      // plane) is a solid of its own, and Join sorts out where they meet
      if ([...I.set].some(id => adj.get(id).some(y => !I.set.has(y)))) continue;
      const loop = islandLoop(I.set, adj, cands, P);
      if (loop) holes.push(loop);
    }
    // only the outermost islands are holes in this face (one inside another belongs to that one)
    const hp = holes.map(h => h.map(id => to2(P(id))));
    const top = holes.filter((h, i) => !hp.some((q, j) => j !== i && insidePoly2(to2(P(h[0])), q)));
    let area = pl.area;
    for (const h of top) area -= planeOf(h.map(P)).area;
    good.push({ key: k, ids, holes: top, all: top.length ? [...ids, ...top.flat()] : ids, n: pl.n, c: pl.c, area, err: err / tol, poly });
  }
  // a wall between two solids drawn sharing a face is inside them: along every one of its lines, two other faces
  // carry straight on across it (flat, one each side), like the two tops of boxes drawn side by side. Drop it.
  {
    const byE = new Map(), ek = (a, b) => a < b ? a + '-' + b : b + '-' + a;
    for (const f of good) for (let i = 0; i < f.ids.length; i++){ const k = ek(f.ids[i], f.ids[(i + 1) % f.ids.length]); if (!byE.has(k)) byE.set(k, []); byE.get(k).push(f); }
    const crossesAt = (W, a, b) => {
      const others = (byE.get(ek(a, b)) || []).filter(g => g !== W);
      const A = P(a), ed = norm(sub(P(b), A));
      const side = g => { const d = sub(g.c, A); return sub(d, mul(ed, dot(d, ed))); };
      for (let i = 0; i < others.length; i++) for (let j = i + 1; j < others.length; j++){
        const g = others[i], h = others[j];
        if (Math.abs(dot(g.n, h.n)) > 0.995 && dot(side(g), side(h)) < 0) return true;
      }
      return false;
    };
    for (let i = good.length - 1; i >= 0; i--){
      const f = good[i];
      if (!f.holes.length && f.ids.every((id, j) => crossesAt(f, id, f.ids[(j + 1) % f.ids.length]))) good.splice(i, 1);
    }
  }
  good.sort((a, b) => (a.area * (1 + a.err)) - (b.area * (1 + b.err)));
  const ekey = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  const use = new Map(), faces = [], byEdge = new Map();
  const openSet = new Set(sk.open || []);
  for (const f of good){
    const loopEdges = L => L.map((id, i) => ekey(id, L[(i + 1) % L.length]));
    const es = [f.ids, ...f.holes].flatMap(loopEdges);
    if (es.some(k => (use.get(k) || 0) >= 2)) continue;
    // two faces folded flat onto each other over a shared edge (same plane, same side) overlap: skip
    let overlap = false;
    for (let i = 0; i < f.ids.length && !overlap; i++){
      for (const g of byEdge.get(es[i]) || []){
        if (g.holes.some(h => h.includes(f.ids[i]) && h.includes(f.ids[(i + 1) % f.ids.length]))) continue;   // the face filling g's hole
        if (Math.abs(dot(g.n, f.n)) < 0.97) continue;
        // which side of the shared line each face lies on: the inside of a loop is on its left (works for notched faces too)
        const ia = f.ids[i], ib = f.ids[(i + 1) % f.ids.length];
        const inward = (F, u, v) => { const L = F.ids, k = L.indexOf(u), fwd = L[(k + 1) % L.length] === v; return cross(F.n, norm(fwd ? sub(P(v), P(u)) : sub(P(u), P(v)))); };
        if (g.ids.indexOf(ia) < 0 || g.ids.indexOf(ib) < 0) continue;
        if (dot(inward(f, ia, ib), inward(g, ia, ib)) > 0) overlap = true;
      }
    }
    if (overlap) continue;
    f.open = openSet.has(f.key);
    faces.push(f);
    for (const k of es){ use.set(k, (use.get(k) || 0) + 1); if (!byEdge.has(k)) byEdge.set(k, []); byEdge.get(k).push(f); }
  }
  // pieces: corners joined by edges; a piece is closed when every edge has a face on both sides
  const comp = new Map();
  let nc = 0;
  for (const v of sk.v){
    if (comp.has(v.id)) continue;
    const st = [v.id]; comp.set(v.id, nc);
    while (st.length){ const x = st.pop(); for (const y of adj.get(x)) if (!comp.has(y)){ comp.set(y, nc); st.push(y); } }
    nc++;
  }
  // a face with a hole joins the hole's corners into its piece (a block standing on a face is part of that piece)
  const par = Array.from({ length: nc }, (_, i) => i), root = i => par[i] === i ? i : (par[i] = root(par[i]));
  for (const f of faces) for (const h of f.holes) par[root(comp.get(h[0]))] = root(comp.get(f.ids[0]));
  const renum = new Map();
  for (const [id, c] of comp){ const r = root(c); if (!renum.has(r)) renum.set(r, renum.size); comp.set(id, renum.get(r)); }
  nc = renum.size;
  const pieces = Array.from({ length: nc }, (_, i) => ({ id: i, closed: true, faces: 0, edges: 0 }));
  const loose = [];
  for (const e of sk.e){
    const pc = pieces[comp.get(e.a)], u = use.get(ekey(e.a, e.b)) || 0;
    pc.edges++;
    if (u < 2) pc.closed = false;
    if (u === 0) loose.push(e.id);
  }
  for (const f of faces){ const pc = pieces[comp.get(f.ids[0])]; pc.faces++; if (f.open) pc.closed = false; f.piece = pc.id; }
  for (const pc of pieces) if (!pc.faces) pc.closed = false;
  const edgeUse = new Map(sk.e.map(e => [e.id, use.get(ekey(e.a, e.b)) || 0]));
  return { faces, pieces, comp, loose, edgeUse };
}

// the boundary of an island of corners: walk it if it's a plain ring, otherwise the biggest flat loop through
// its corners that has all the rest inside
function islandLoop(set, adj, cands, P){
  const nb = id => adj.get(id).filter(y => set.has(y));
  if ([...set].every(id => nb(id).length === 2)){
    const s0 = [...set][0], L = [s0];
    let prev = s0, cur = nb(s0)[0];
    while (cur !== s0 && L.length <= set.size){ L.push(cur); const nx = nb(cur).find(y => y !== prev); prev = cur; cur = nx; }
    return L.length === set.size ? L : null;
  }
  let best = null, ba = 0;
  for (const [, ids] of cands){
    if (!ids.every(id => set.has(id))) continue;
    const a = planeOf(ids.map(P)).area;
    if (a > ba){ ba = a; best = ids; }
  }
  return best;
}

// ---------------------------------------------------------------- solver
// o: { iters, flat (0..1), square (bool), squareDeg, floor (bool), floorR, warm: positions to start from, drag: {id: [x,y,z]} }
export function solve(sk, F, o = {}){
  const iters = o.iters ?? 60, wFlat = (o.flat ?? 1) * 2, wSq = o.square ? 1.2 : 0, cosT = Math.cos((o.squareDeg ?? 10) * Math.PI / 180);
  const sinT = Math.sin((o.squareDeg ?? 10) * Math.PI / 180);
  const ids = sk.v.map(v => v.id), A = {}, X = {}, wA = {};
  for (const v of sk.v){
    A[v.id] = (o.drag && o.drag[v.id]) || anchorOf(v);
    wA[v.id] = (o.drag && o.drag[v.id]) ? 40 : v.pin ? 4 : 0.6;
    X[v.id] = (o.warm && o.warm[v.id] && !(o.drag && o.drag[v.id])) ? o.warm[v.id].slice() : A[v.id].slice();
  }
  // each piece's grid direction in plan: the length-weighted average of its level edges' directions (mod 90°)
  const yaw = new Map();
  if (wSq){
    const acc = new Map();
    for (const e of sk.e){
      const d = sub(A[e.b], A[e.a]), h = Math.hypot(d[0], d[2]);
      if (h < 0.3 * len(d)) continue;
      const ph = Math.atan2(d[2], d[0]) * 4, c = F.comp.get(e.a), a = acc.get(c) || [0, 0];
      a[0] += h * Math.cos(ph); a[1] += h * Math.sin(ph); acc.set(c, a);
    }
    for (const [c, a] of acc) yaw.set(c, Math.atan2(a[1], a[0]) / 4);
  }
  const faces = F.faces.filter(f => !f.open);
  const byKey = new Map(F.faces.map(f => [f.key, f])), locks = (sk.locks || []).filter(L => lockAlive(L, byKey, X));
  const lockedV = new Set();
  for (const L of locks){
    // a lock that sets a face's or line's direction takes its lines out of Square up (they follow the lock);
    // one plane / parallel faces and level or floor faces leave Square up to keep them square
    if (L.mode === 'coplanar' || L.mode === 'parallel' && !L.ea || L.mode === 'level' || L.mode === 'floor') continue;
    for (const k of [L.f, L.a, L.b]) if (k) for (const id of byKey.get(k).all) lockedV.add(id);
    for (const e of [L.e, L.ea, L.eb]) if (e) for (const id of e) lockedV.add(id);
  }
  const G = {}, W = {};
  for (let it = 0; it < iters; it++){
    for (const id of ids){ G[id] = mul(A[id], wA[id]); W[id] = wA[id]; }
    if (wFlat){
      for (const f of faces){
        const pl = planeOf(f.ids.map(id => X[id]));
        for (const id of f.all){
          const p = X[id], q = sub(p, mul(pl.n, dot(pl.n, sub(p, pl.c))));
          G[id] = add(G[id], mul(q, wFlat)); W[id] += wFlat;
        }
      }
    }
    if (wSq){
      for (const e of sk.e){
        if (lockedV.has(e.a) && lockedV.has(e.b)) continue;   // a locked face's own lines follow its lock
        const a = X[e.a], b = X[e.b], d = sub(b, a), L = len(d);
        if (!L) continue;
        const u = mul(d, 1 / L);
        let t = null;
        if (Math.abs(u[1]) > cosT) t = [0, Math.sign(u[1]) * L, 0];            // plumb
        else {
          let dy = d[1], hx = d[0], hz = d[2], h = Math.hypot(hx, hz), snapped = false;
          if (Math.abs(u[1]) < sinT){ dy = 0; snapped = true; }                 // level
          const y0 = yaw.get(F.comp.get(e.a));
          if (y0 !== undefined && h > 0.2 * L){
            const ang = Math.atan2(hz, hx), q = Math.PI / 2, k = Math.round((ang - y0) / q), ta = y0 + k * q;
            if (Math.abs(ang - ta) < (o.squareDeg ?? 10) * Math.PI / 180){ hx = Math.cos(ta) * h; hz = Math.sin(ta) * h; snapped = true; } // on the grid
          }
          if (snapped){ const s = L / Math.hypot(hx, dy, hz); t = [hx * s, dy * s, hz * s]; }
        }
        if (!t) continue;
        const m = mul(add(a, b), 0.5);
        G[e.a] = add(G[e.a], mul(sub(m, mul(t, 0.5)), wSq)); W[e.a] += wSq;
        G[e.b] = add(G[e.b], mul(add(m, mul(t, 0.5)), wSq)); W[e.b] += wSq;
      }
    }
    if (locks.length) applyLocks(sk, locks, byKey, X, G, W, 30, wSq ? (o.squareDeg ?? 10) : 0);
    if (o.floor){
      for (const id of ids){
        if (A[id][1] < (o.floorR ?? 0.05) && A[id][1] > -(o.floorR ?? 0.05)){ G[id] = add(G[id], mul([X[id][0], 0, X[id][2]], 2)); W[id] += 2; }
      }
    }
    for (const id of ids) X[id] = mul(G[id], 1 / W[id]);
  }
  hardFlat(faces, X, wA, o.hardIters ?? 400);
  // locks are firm too: take turns holding them exactly and flattening again, until both settle
  if (locks.length){
    for (let r = 0; r < 30; r++){
      const G2 = {}, W2 = {};
      for (const id of ids){ G2[id] = [0, 0, 0]; W2[id] = 0; }
      applyLocks(sk, locks, byKey, X, G2, W2, 1, wSq ? (o.squareDeg ?? 10) : 0);
      let moved = 0;
      for (const id of ids) if (W2[id]){ const q = mul(G2[id], 1 / W2[id]); moved = Math.max(moved, dist(q, X[id])); X[id] = q; }
      hardFlat(faces, X, wA, 60);
      if (moved < 1e-5) break;
    }
  }
  return X;
}

// Flat is a rule, not a wish: after the soft pass, every face is projected onto its own plane, one face at a time,
// over and over, until no corner is more than a hundredth of a millimetre off any of its faces. Each plane passes
// through its corners' weighted middle, so a corner you're holding (or have placed) barely moves and the others give.
export function hardFlat(faces, X, wt, maxIt){
  if (!faces.length) return 0;
  let worst = 0;
  for (let it = 0; it < maxIt; it++){
    worst = 0;
    for (const f of faces){
      const all = f.all || f.ids, pl = planeOf(f.ids.map(id => X[id]));
      let c = [0, 0, 0], sw = 0;
      for (const id of all){ const w = wt ? wt[id] || 1 : 1; c = add(c, mul(X[id], w)); sw += w; }
      c = mul(c, 1 / sw);
      for (const id of all){
        const d = dot(pl.n, sub(X[id], c));
        if (Math.abs(d) > worst) worst = Math.abs(d);
        X[id] = sub(X[id], mul(pl.n, d));
      }
    }
    if (worst < 1e-5) break;
  }
  return worst;
}

// How far from flat each face still is (for a little readout), as a share of its size
export function flatness(F, X){
  let worst = 0;
  for (const f of F.faces){
    if (f.open) continue;
    const pts = f.ids.map(id => X[id]), pl = planeOf(pts);
    let s = 0; for (let i = 0; i < pts.length; i++) s = Math.max(s, dist(pts[i], pts[(i + 1) % pts.length]));
    for (const p of f.all.map(id => X[id])) worst = Math.max(worst, Math.abs(dot(pl.n, sub(p, pl.c))) / (s || 1));
  }
  return worst;
}
export { planeOf, basis };

// ---------------------------------------------------------------- locks
// A face can be locked Level, Upright, or Held at its tilt; two faces sharing an edge can be locked at an angle
// (a fixed one, or the nearest of a step like 15°). The angle between two faces is measured inside, across their
// shared edge: 90° at a box corner, 180° where they carry on flat.

// turn point x about the line through p along unit k by angle a
export function rotAbout(x, p, k, a){
  const v = sub(x, p), c = Math.cos(a), sn = Math.sin(a);
  return add(p, add(add(mul(v, c), mul(cross(k, v), sn)), mul(k, dot(k, v) * (1 - c))));
}
export function sharedEdge(A, B){
  for (let i = 0; i < A.length; i++){
    const u = A[i], v = A[(i + 1) % A.length], j = B.indexOf(u);
    if (j < 0) continue;
    if (B[(j + 1) % B.length] === v || B[(j - 1 + B.length) % B.length] === v) return [u, v];
  }
  return null;
}
// the faces' inside directions away from their shared edge, and the angle between them
export function faceAngle(A, B, X){
  const se = sharedEdge(A, B); if (!se) return null;
  const p = X[se[0]], q = X[se[1]], e = norm(sub(q, p));
  const inward = ids => {
    const pl = planeOf(ids.map(id => X[id])), i = ids.indexOf(se[0]), fwd = ids[(i + 1) % ids.length] === se[1];
    return norm(cross(pl.n, fwd ? e : mul(e, -1)));   // the inside of a loop is on its left
  };
  const dA = inward(A), dB = inward(B);
  const deg = Math.acos(Math.max(-1, Math.min(1, dot(dA, dB)))) * 180 / Math.PI;
  const s = Math.sign(dot(e, cross(dA, dB))) || 1;
  return { deg, se, p, k: mul(e, s), dA, dB };
}
export function lockTarget(L, deg){
  if (L.mode === 'step') return Math.max(L.step, Math.min(180, Math.round(deg / L.step) * L.step));
  return L.deg;
}
function orientTarget(L, n){
  if (L.mode === 'level' || L.mode === 'floor') return [0, n[1] < 0 ? -1 : 1, 0];
  if (L.mode === 'upright'){ const h = Math.hypot(n[0], n[2]); return h > 1e-6 ? [n[0] / h, 0, n[2] / h] : null; }
  if (L.mode === 'hold' && L.n) return dot(L.n, n) < 0 ? mul(L.n, -1) : L.n;
  return null;
}
// a lock still applies while what it holds is still there (faces by their corners, lines by their two ends)
export function lockAlive(L, byKey, X){
  if (L.f) return byKey.has(L.f);
  if (L.a) return byKey.has(L.a) && byKey.has(L.b);
  if (L.e) return !!(X[L.e[0]] && X[L.e[1]]);
  if (L.ea) return !!(X[L.ea[0]] && X[L.ea[1]] && X[L.eb[0]] && X[L.eb[1]]);
  return false;
}
// turn face points P (ids) about centroid c so normal n becomes t
function turnTo(ids, X, c, n, t, goal){
  const ax = cross(n, t), sl = len(ax), a = Math.atan2(sl, dot(n, t));
  for (const id of ids) goal(id, sl > 1e-9 ? rotAbout(X[id], c, mul(ax, 1 / sl), a) : X[id]);
}
// a line's two ends set so it runs along t (a unit direction), same length, same middle
function lineTo(e, X, t, goal){
  const a = X[e[0]], b = X[e[1]], d = sub(b, a), L = len(d), m = mul(add(a, b), 0.5), tt = dot(t, d) < 0 ? mul(t, -1) : t;
  goal(e[0], sub(m, mul(tt, L / 2))); goal(e[1], add(m, mul(tt, L / 2)));
}
function applyLocks(sk, locks, byKey, X, G, W, w, sqDeg){
  const goal = (id, p) => { G[id] = add(G[id], mul(p, w)); W[id] += w; };
  for (const L of locks){
    if (L.f){
      const f = byKey.get(L.f), pl = planeOf(f.ids.map(id => X[id])), t = orientTarget(L, pl.n);
      if (L.mode === 'floor'){ for (const id of f.all) goal(id, [X[id][0], 0, X[id][2]]); continue; }   // lying on the floor
      if (!t) continue;
      turnTo(f.all, X, pl.c, pl.n, t, goal);
    } else if (L.e){
      // a line held upright or level
      const d = norm(sub(X[L.e[1]], X[L.e[0]]));
      if (L.mode === 'upright') lineTo(L.e, X, [0, 1, 0], goal);
      else { const h = Math.hypot(d[0], d[2]); if (h > 1e-6) lineTo(L.e, X, [d[0] / h, 0, d[2] / h], goal); }
    } else if (L.ea){
      // two lines held parallel or square to each other
      let dA = norm(sub(X[L.ea[1]], X[L.ea[0]])), dB = norm(sub(X[L.eb[1]], X[L.eb[0]]));
      if (L.mode === 'parallel'){ if (dot(dA, dB) < 0) dB = mul(dB, -1); const t = norm(add(dA, dB)); lineTo(L.ea, X, t, goal); lineTo(L.eb, X, t, goal); }
      else { const c = dot(dA, dB); lineTo(L.ea, X, norm(sub(dA, mul(dB, c * 0.5))), goal); lineTo(L.eb, X, norm(sub(dB, mul(dA, c * 0.5))), goal); }
    } else if (L.mode === 'coplanar' || L.mode === 'parallel'){
      // two faces on one plane, or facing the same way
      const FA = byKey.get(L.a), FB = byKey.get(L.b), pA = planeOf(FA.ids.map(id => X[id])), pB = planeOf(FB.ids.map(id => X[id]));
      const nB = dot(pA.n, pB.n) < 0 ? mul(pB.n, -1) : pB.n;
      let n = norm(add(pA.n, nB));
      // with Square up on, a shared plane that's nearly level or upright becomes exactly so
      if (sqDeg){ const sn = Math.sin(sqDeg * Math.PI / 180), h = Math.hypot(n[0], n[2]);
        if (h < sn) n = [0, Math.sign(n[1]) || 1, 0]; else if (Math.abs(n[1]) < sn) n = [n[0] / h, 0, n[2] / h]; }
      if (L.mode === 'parallel'){ turnTo(FA.all, X, pA.c, pA.n, n, goal); turnTo(FB.all, X, pB.c, nB, n, goal); continue; }
      const ids = [...new Set([...FA.all, ...FB.all])];
      let c = [0, 0, 0]; for (const id of ids) c = add(c, X[id]); c = mul(c, 1 / ids.length);
      for (const id of ids) goal(id, sub(X[id], mul(n, dot(n, sub(X[id], c)))));
    } else {
      const FA = byKey.get(L.a), FB = byKey.get(L.b), g = faceAngle(FA.ids, FB.ids, X);
      if (!g) continue;
      const d = (lockTarget(L, g.deg) - g.deg) * Math.PI / 180;
      // turn both faces about their shared edge, half each, toward the locked angle
      for (const id of FB.all) goal(id, g.se.includes(id) ? X[id] : rotAbout(X[id], g.p, g.k, d / 2));
      for (const id of FA.all) goal(id, g.se.includes(id) ? X[id] : rotAbout(X[id], g.p, g.k, -d / 2));
    }
  }
}
// Snap a moved face (targets for its corners) to its locks before the solver sees it, so a locked face clicks
// into place while you hold it: orientation locks keep its tilt, angle locks swing it about the shared edge.
export function snapHeld(sk, F, key, T, X){
  const byKey = new Map(F.faces.map(f => [f.key, f])), f = byKey.get(key); if (!f) return T;
  const P = Object.assign({}, X, T);
  for (const L of sk.locks || []){
    if (L.f === key){
      const pl = planeOf(f.ids.map(id => P[id])), t = orientTarget(L, pl.n); if (!t) continue;
      const ax = cross(pl.n, t), sl = len(ax);
      if (sl > 1e-9) for (const id of f.all) if (P[id]) P[id] = rotAbout(P[id], pl.c, mul(ax, 1 / sl), Math.atan2(sl, dot(pl.n, t)));
      if (L.mode === 'floor') for (const id of f.all) if (P[id]) P[id] = [P[id][0], 0, P[id][2]];   // it slides along the floor
    } else if ((L.a === key || L.b === key) && byKey.has(L.a) && byKey.has(L.b) && (L.mode === 'fixed' || L.mode === 'step')){
      const other = byKey.get(L.a === key ? L.b : L.a).ids, g = faceAngle(f.ids, other, P); if (!g) continue;
      // g is measured from the held face to the other one: turning the held face by -d widens the angle by d
      const d = (lockTarget(L, g.deg) - g.deg) * Math.PI / 180;
      for (const id of f.all) if (!g.se.includes(id)) P[id] = rotAbout(P[id], g.p, g.k, -d);
    }
  }
  const out = {}; for (const id in T) out[id] = P[id];
  return out;
}

// One call for the app: find faces on the sketch, solve, then look again on the solved shape (catches loops that
// only came flat once squared up) and solve once more from there.
export function build(sk, o = {}){
  const anchors = {};
  for (const v of sk.v) anchors[v.id] = (o.drag && o.drag[v.id]) || anchorOf(v);
  const fo = { rel: o.rel, minTol: o.minTol };
  let F = findFaces(sk, o.warm ? Object.assign({}, anchors, pick(o.warm, anchors)) : anchors, fo);
  let X = solve(sk, F, o);
  if (o.second !== false){
    const F2 = findFaces(sk, X, fo);
    if (F2.faces.length !== F.faces.length || F2.faces.some((f, i) => f.key !== F.faces[i]?.key)){ F = F2; X = solve(sk, F, Object.assign({}, o, { warm: X })); }
  }
  return { F, X };
}
// Consistent winding for a set of faces; outward when they close up (by signed volume)
export function orient(fs, X){
  const loops = fs.map(f => f.ids.slice()), done = new Array(fs.length).fill(false);
  const dirEdges = L => L.map((id, i) => id + '>' + L[(i + 1) % L.length]);
  const owners = new Map();
  fs.forEach((f, i) => f.ids.forEach((id, k) => { const o = f.ids[(k + 1) % f.ids.length], key = id < o ? id + '-' + o : o + '-' + id; if (!owners.has(key)) owners.set(key, []); owners.get(key).push(i); }));
  for (let s0 = 0; s0 < fs.length; s0++){
    if (done[s0]) continue;
    done[s0] = true; const q = [s0];
    while (q.length){
      const i = q.shift(), mine = new Set(dirEdges(loops[i]));
      for (const [key, os] of owners){
        if (!os.includes(i)) continue;
        for (const j of os){
          if (j === i || done[j]) continue;
          // if j runs the shared edge the same way as i, flip j
          if (dirEdges(loops[j]).some(d => mine.has(d))) loops[j].reverse();
          done[j] = true; q.push(j);
        }
      }
    }
  }
  let vol = 0;
  for (const L of loops){ const p0 = X[L[0]]; for (let i = 1; i < L.length - 1; i++) vol += dot(p0, cross(X[L[i]], X[L[i + 1]])); }
  if (vol < 0) loops.forEach(L => L.reverse());
  return loops;
}
function pick(warm, anchors){ const r = {}; for (const k in anchors) if (warm[k]) r[k] = warm[k]; return r; }

export function toOBJ(sk, F, X, scale = 1, tri){
  const ids = sk.v.map(v => v.id), idx = new Map(ids.map((id, i) => [id, i + 1]));
  let s = '# Edgewise XR\n';
  for (const id of ids){ const p = X[id]; s += `v ${(p[0] * scale).toFixed(5)} ${(-p[2] * scale).toFixed(5)} ${(p[1] * scale).toFixed(5)}\n`; }
  const byPiece = new Map();
  for (const f of F.faces){ if (f.open) continue; if (!byPiece.has(f.piece)) byPiece.set(f.piece, []); byPiece.get(f.piece).push(f); }
  let n = 0;
  for (const [pc, fs] of byPiece){
    // wind every face the same way round (neighbours run a shared edge in opposite directions), facing out
    const loops = orient(fs, X);
    fs.forEach((f, i) => f._loop = loops[i]);
    s += `o ${F.pieces[pc].closed ? 'Solid' : 'Surface'}_${++n}\n`;
    for (const f of fs){
      if (f.holes && f.holes.length && tri){
        // a face with a hole goes out as triangles (OBJ faces can't have holes), wound like its rim
        const n = planeOf(f._loop.map(id => X[id])).n;
        for (const t of tri(f)){ const c = cross(sub(X[t[1]], X[t[0]]), sub(X[t[2]], X[t[0]])); const tt = dot(c, n) < 0 ? [t[0], t[2], t[1]] : t; s += 'f ' + tt.map(id => idx.get(id)).join(' ') + '\n'; }
      } else s += 'f ' + f._loop.map(id => idx.get(id)).join(' ') + '\n';
    }
  }
  return s;
}
