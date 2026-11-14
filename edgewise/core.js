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
export function emptySketch(){ return { v: [], e: [], s: [], open: [], locks: [], nid: 1 }; }

// Faces are named by their corners (a key like "3.8.12.15"). When a corner is added to an edge, or healed away,
// every saved face name (holes, locks) that runs along that edge is renamed to match.
function renameFaces(sk, fn){
  const re = k => { const ids = k.split('.').map(Number), r = fn(ids); return r ? faceKey(r) : k; };
  sk.open = (sk.open || []).map(re);
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
export function snapEnd(sk, p, pos, snapR, skipVert){
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
  const sa = snapEnd(sk, f.a, pos, snapR);
  const sb = snapEnd(sk, f.b, pos, snapR, sa.kind === 'vert' ? sa.id : undefined);
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
    sb2 = snapEnd(sk, f.b, pos, snapR, a);
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
  const rel = o.rel ?? 0.18, minTol = o.minTol ?? 0.015, maxSides = o.maxSides ?? 8;
  const P = id => pos[id];
  const adj = new Map();
  for (const v of sk.v) adj.set(v.id, []);
  for (const e of sk.e){ adj.get(e.a)?.push(e.b); adj.get(e.b)?.push(e.a); }
  const hasEdge = (a, b) => adj.get(a)?.includes(b);
  const cands = new Map();
  let work = 0;
  for (const e of sk.e){
    // loops through this edge, found from the loop's smallest corner (so the search stays small)
    const s = Math.min(e.a, e.b), t = Math.max(e.a, e.b);
    const path = [s, t], onPath = new Set(path), pl = { n: null, c: null };
    let maxL = dist(P(s), P(t));
    const go = () => {
      if (++work > 400000) return;
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
    // a chord: an edge joining two corners of the loop that aren't next to each other cuts it in two
    let chord = false;
    for (let i = 0; i < ids.length && !chord; i++)
      for (let j = i + 2; j < ids.length && !chord; j++){
        if (i === 0 && j === ids.length - 1) continue;
        if (hasEdge(ids[i], ids[j])) chord = true;
      }
    if (chord) continue;
    const [u, w] = basis(pl.n), to2 = p => { const d = sub(p, pl.c); return [dot(d, u), dot(d, w)]; };
    const poly = pts.map(to2);
    // must not cross itself
    let selfX = false;
    for (let i = 0; i < poly.length && !selfX; i++)
      for (let j = i + 2; j < poly.length && !selfX; j++){
        if (i === 0 && j === poly.length - 1) continue;
        if (segsCross2(poly[i], poly[(i + 1) % poly.length], poly[j], poly[(j + 1) % poly.length])) selfX = true;
      }
    if (selfX) continue;
    // no other corner sitting inside it (on its plane)
    const inSet = new Set(ids);
    let blocked = false;
    for (const v of sk.v){
      if (inSet.has(v.id)) continue;
      const p = P(v.id);
      if (Math.abs(dot(pl.n, sub(p, pl.c))) > tol) continue;
      const q = to2(p);
      if (insidePoly2(q, poly) && distToPoly2(q, poly) > tol * 0.5){ blocked = true; break; }
    }
    if (blocked) continue;
    // nor an edge passing through it
    good.push({ key: k, ids, n: pl.n, c: pl.c, area: pl.area, err: err / tol, poly });
  }
  good.sort((a, b) => (a.area * (1 + a.err)) - (b.area * (1 + b.err)));
  const ekey = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  const use = new Map(), faces = [], byEdge = new Map();
  const openSet = new Set(sk.open || []);
  for (const f of good){
    const es = f.ids.map((id, i) => ekey(id, f.ids[(i + 1) % f.ids.length]));
    if (es.some(k => (use.get(k) || 0) >= 2)) continue;
    // two faces folded flat onto each other over a shared edge (same plane, same side) overlap: skip
    let overlap = false;
    for (let i = 0; i < es.length && !overlap; i++){
      for (const g of byEdge.get(es[i]) || []){
        if (Math.abs(dot(g.n, f.n)) < 0.97) continue;
        const a = P(f.ids[i]), b = P(f.ids[(i + 1) % f.ids.length]), ed = norm(sub(b, a));
        const side = F => { let s = 0; for (const id of F.ids){ const d = sub(P(id), a); const off = sub(d, mul(ed, dot(d, ed))); s += dot(cross(ed, off), f.n); } return s; };
        if (side(f) * side(g) > 0) overlap = true;
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
  const byKey = new Map(F.faces.map(f => [f.key, f])), locks = (sk.locks || []).filter(L => L.f ? byKey.has(L.f) : byKey.has(L.a) && byKey.has(L.b));
  const lockedV = new Set();
  for (const L of locks) for (const k of [L.f, L.a, L.b]) if (k) for (const id of byKey.get(k).ids) lockedV.add(id);
  const G = {}, W = {};
  for (let it = 0; it < iters; it++){
    for (const id of ids){ G[id] = mul(A[id], wA[id]); W[id] = wA[id]; }
    if (wFlat){
      for (const f of faces){
        const pts = f.ids.map(id => X[id]), pl = planeOf(pts);
        for (const id of f.ids){
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
    if (locks.length) applyLocks(sk, locks, byKey, X, G, W, 30);
    if (o.floor){
      for (const id of ids){
        if (A[id][1] < (o.floorR ?? 0.05) && A[id][1] > -(o.floorR ?? 0.05)){ G[id] = add(G[id], mul([X[id][0], 0, X[id][2]], 2)); W[id] += 2; }
      }
    }
    for (const id of ids) X[id] = mul(G[id], 1 / W[id]);
  }
  return X;
}

// How far from flat each face still is (for a little readout), as a share of its size
export function flatness(F, X){
  let worst = 0;
  for (const f of F.faces){
    if (f.open) continue;
    const pts = f.ids.map(id => X[id]), pl = planeOf(pts);
    let s = 0; for (let i = 0; i < pts.length; i++) s = Math.max(s, dist(pts[i], pts[(i + 1) % pts.length]));
    for (const p of pts) worst = Math.max(worst, Math.abs(dot(pl.n, sub(p, pl.c))) / (s || 1));
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
  if (L.mode === 'level') return [0, n[1] < 0 ? -1 : 1, 0];
  if (L.mode === 'upright'){ const h = Math.hypot(n[0], n[2]); return h > 1e-6 ? [n[0] / h, 0, n[2] / h] : null; }
  if (L.mode === 'hold' && L.n) return dot(L.n, n) < 0 ? mul(L.n, -1) : L.n;
  return null;
}
function applyLocks(sk, locks, byKey, X, G, W, w){
  const goal = (id, p) => { G[id] = add(G[id], mul(p, w)); W[id] += w; };
  for (const L of locks){
    if (L.f){
      const f = byKey.get(L.f), pl = planeOf(f.ids.map(id => X[id])), t = orientTarget(L, pl.n);
      if (!t) continue;
      const ax = cross(pl.n, t), sl = len(ax), a = Math.atan2(sl, dot(pl.n, t));
      for (const id of f.ids) goal(id, sl > 1e-9 ? rotAbout(X[id], pl.c, mul(ax, 1 / sl), a) : X[id]);
    } else {
      const A = byKey.get(L.a).ids, B = byKey.get(L.b).ids, g = faceAngle(A, B, X);
      if (!g) continue;
      const d = (lockTarget(L, g.deg) - g.deg) * Math.PI / 180;
      // turn both faces about their shared edge, half each, toward the locked angle
      for (const id of B) goal(id, g.se.includes(id) ? X[id] : rotAbout(X[id], g.p, g.k, d / 2));
      for (const id of A) goal(id, g.se.includes(id) ? X[id] : rotAbout(X[id], g.p, g.k, -d / 2));
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
      const ax = cross(pl.n, t), sl = len(ax); if (sl < 1e-9) continue;
      for (const id of f.ids) P[id] = rotAbout(P[id], pl.c, mul(ax, 1 / sl), Math.atan2(sl, dot(pl.n, t)));
    } else if ((L.a === key || L.b === key) && byKey.has(L.a) && byKey.has(L.b)){
      const other = byKey.get(L.a === key ? L.b : L.a).ids, g = faceAngle(f.ids, other, P); if (!g) continue;
      // g is measured from the held face to the other one: turning the held face by -d widens the angle by d
      const d = (lockTarget(L, g.deg) - g.deg) * Math.PI / 180;
      for (const id of f.ids) if (!g.se.includes(id)) P[id] = rotAbout(P[id], g.p, g.k, -d);
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

export function toOBJ(sk, F, X, scale = 1){
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
    for (const f of fs) s += 'f ' + f._loop.map(id => idx.get(id)).join(' ') + '\n';
  }
  return s;
}
