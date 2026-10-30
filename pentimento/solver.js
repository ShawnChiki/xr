// Pentimento surface solver. Plain JS, no imports, so it runs in a Web Worker or in Node.
// Input: sketch strokes in park metres (y up), each tagged loose (0), guide (1) or crease (2).
// 1. Guide and crease strokes that overlap are grouped and averaged into one consensus curve each.
// 2. A sheet is laid over the plan footprint of all the lines and fitted to them in 3D, coarse to fine.
//    Each vertex moves along its normal to the weighted average of nearby line samples (a moving
//    least-squares average), so a hundred loose lines become one smooth field instead of a hundred bumps.
// 3. The sheet is remeshed every step (split long edges, collapse short ones, flip toward valence 6,
//    slide vertices evenly over the surface), so the triangles stay even even on steep walls.
// 4. Consensus curves are cut into the mesh as chains of edges. Vertices on them slide only along
//    the curve. Averaging never reaches across a sharp crease, so the two sides stay crisp.
// 5. Triangles are paired into quads (never across a crease) and one Catmull-Clark step makes an
//    all-quad retopology whose edges run exactly along the creases. More steps give the smooth subD.
(function (root) {
'use strict';

const sq = x => x * x;
const d2 = (a, b) => sq(a[0] - b[0]) + sq(a[1] - b[1]) + sq(a[2] - b[2]);
const lerp3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
function rmv(arr, v){ const i = arr.indexOf(v); if (i >= 0){ arr[i] = arr[arr.length - 1]; arr.pop(); } }

// ---------------------------------------------------------------- polylines
function polyLen(P, closed){ let s = 0; for (let i = 1; i < P.length; i++) s += Math.sqrt(d2(P[i - 1], P[i])); if (closed && P.length > 2) s += Math.sqrt(d2(P[P.length - 1], P[0])); return s; }
function resample(pts, ds, closed){
  if (pts.length < 2) return pts.map(p => p.slice());
  const P = closed ? pts.concat([pts[0]]) : pts;
  const seg = []; let total = 0;
  for (let i = 1; i < P.length; i++){ const l = Math.sqrt(d2(P[i - 1], P[i])); seg.push(l); total += l; }
  if (total < 1e-9) return [pts[0].slice()];
  const n = Math.max(closed ? 3 : 1, Math.round(total / ds)), step = total / n, out = [];
  let i = 0, acc = 0;
  for (let k = 0; k < (closed ? n : n + 1); k++){
    const t = k * step;
    while (i < seg.length - 1 && acc + seg[i] < t){ acc += seg[i]; i++; }
    const u = seg[i] > 0 ? Math.min(1, Math.max(0, (t - acc) / seg[i])) : 0;
    out.push(lerp3(P[i], P[i + 1], u));
  }
  return out;
}
function smoothPoly(P, it, closed){
  let A = P.map(p => p.slice());
  for (let k = 0; k < it; k++){
    const B = A.map(p => p.slice()), n = A.length;
    for (let i = 0; i < n; i++){
      if (!closed && (i === 0 || i === n - 1)) continue;
      const a = A[(i - 1 + n) % n], b = A[(i + 1) % n];
      for (let c = 0; c < 3; c++) B[i][c] = A[i][c] * 0.5 + (a[c] + b[c]) * 0.25;
    }
    A = B;
  }
  return A;
}
// closest point on a polyline: {p, s (arc length), d2}
function closestOnPoly(C, p){
  const P = C.pts, n = P.length, segs = C.closed ? n : n - 1;
  let best = null;
  for (let i = 0; i < segs; i++){
    const a = P[i], b = P[(i + 1) % n];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = sq(ab[0]) + sq(ab[1]) + sq(ab[2]);
    let u = L2 > 0 ? ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L2 : 0;
    u = Math.max(0, Math.min(1, u));
    const q = [a[0] + ab[0] * u, a[1] + ab[1] * u, a[2] + ab[2] * u], dd = d2(p, q);
    if (!best || dd < best.d2) best = { p: q, s: C.cum[i] + u * Math.sqrt(L2), d2: dd };
  }
  return best;
}
function pointAt(C, s){
  const P = C.pts, n = P.length, total = C.len;
  if (C.closed){ s = ((s % total) + total) % total; } else s = Math.max(0, Math.min(total, s));
  let i = 0; while (i < C.cum.length - 2 && C.cum[i + 1] < s) i++;
  const l = C.cum[i + 1] - C.cum[i], u = l > 0 ? (s - C.cum[i]) / l : 0;
  return lerp3(P[i], P[(i + 1) % n], u);
}
function makeCurve(pts, closed, sharp, tag){
  const C = { pts, closed, sharp, tag, cum: [0] };
  const n = pts.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) C.cum.push(C.cum[i] + Math.sqrt(d2(pts[i], pts[(i + 1) % n])));
  C.len = C.cum[C.cum.length - 1];
  return C;
}

// ---------------------------------------------------------------- spatial hash
class Grid {
  constructor(cell){ this.s = 1 / cell; this.m = new Map(); }
  key(i, j, k){ return (Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791)) | 0; }
  add(id, x, y, z){ const k = this.key(Math.floor(x * this.s), Math.floor(y * this.s), Math.floor(z * this.s)); let a = this.m.get(k); if (!a){ a = []; this.m.set(k, a); } a.push(id); }
  each(x, y, z, r, fn){
    const s = this.s, i0 = Math.floor((x - r) * s), i1 = Math.floor((x + r) * s), j0 = Math.floor((y - r) * s), j1 = Math.floor((y + r) * s), k0 = Math.floor((z - r) * s), k1 = Math.floor((z + r) * s);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++){ const a = this.m.get(this.key(i, j, k)); if (a) for (let q = 0; q < a.length; q++) fn(a[q]); }
  }
}

// ---------------------------------------------------------------- consensus curves
// Groups strokes that run along each other, then finds the one line through the middle of them
// (a principal curve: project every point onto the current guess, average them along it, repeat).
function consensus(strokes, g, ds, sharp, tag){
  const S = strokes.map(s => resample(s, ds * 0.6, false)).filter(s => s.length >= 2);
  const n = S.length; if (!n) return [];
  const par = S.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i]));
  const grids = S.map(s => { const G = new Grid(g); s.forEach((p, i) => G.add(i, p[0], p[1], p[2])); return G; });
  const tan = S.map(s => s.map((p, i) => norm([s[Math.min(i + 1, s.length - 1)][0] - s[Math.max(i - 1, 0)][0], s[Math.min(i + 1, s.length - 1)][1] - s[Math.max(i - 1, 0)][1], s[Math.min(i + 1, s.length - 1)][2] - s[Math.max(i - 1, 0)][2]])));
  // a point counts as shared only if the other stroke passes close by AND runs the same way,
  // so lines that meet at a corner (a box edge and a hip) stay separate curves
  const near = (i, j) => { const A = S[i]; let k = 0; A.forEach((p, a) => { let hit = false; grids[j].each(p[0], p[1], p[2], g, q => { if (!hit && d2(p, S[j][q]) < g * g && Math.abs(dot(tan[i][a], tan[j][q])) > 0.8) hit = true; }); if (hit) k++; }); return k / A.length; };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++){
    if (find(i) === find(j)) continue;
    if (Math.max(near(i, j), near(j, i)) > 0.35) par[find(i)] = find(j);
  }
  // average each group, then merge groups whose averaged curves still run alongside each other
  // (very loose passes can land as two parallel curves, which would make the surface zig-zag)
  let found = [];
  for (let round = 0; round < 3; round++){
    const groups = new Map(); S.forEach((s, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
    found = [...groups.values()].map(ids => ({ ids, C: principalCurve(ids.map(i => S[i]), g, ds) })).filter(f => f.C && f.C.pts.length >= 2);
    let merged = false;
    for (let a = 0; a < found.length; a++) for (let b = a + 1; b < found.length; b++){
      if (find(found[a].ids[0]) === find(found[b].ids[0])) continue;
      if (alongside(found[a].C.pts, found[b].C.pts, g * 1.8) > 0.5 || alongside(found[b].C.pts, found[a].C.pts, g * 1.8) > 0.5){ par[find(found[a].ids[0])] = find(found[b].ids[0]); merged = true; }
    }
    if (!merged) break;
  }
  return found.map(f => makeCurve(f.C.pts, f.C.closed, sharp, tag));
}
// fraction of A's points that lie within r of B and run the same way
function alongside(A, B, r){
  if (A.length < 2 || B.length < 2) return 0;
  const tA = i => norm([A[Math.min(i + 1, A.length - 1)][0] - A[Math.max(i - 1, 0)][0], A[Math.min(i + 1, A.length - 1)][1] - A[Math.max(i - 1, 0)][1], A[Math.min(i + 1, A.length - 1)][2] - A[Math.max(i - 1, 0)][2]]);
  let k = 0;
  A.forEach((p, i) => { let best = Infinity, bj = 0; B.forEach((q, j) => { const d = d2(p, q); if (d < best){ best = d; bj = j; } });
    if (best < r * r){ const tb = norm([B[Math.min(bj + 1, B.length - 1)][0] - B[Math.max(bj - 1, 0)][0], B[Math.min(bj + 1, B.length - 1)][1] - B[Math.max(bj - 1, 0)][1], B[Math.min(bj + 1, B.length - 1)][2] - B[Math.max(bj - 1, 0)][2]]); if (Math.abs(dot(tA(i), tb)) > 0.7) k++; } });
  return k / A.length;
}
// A line that goes round more than once (a circle drawn in two laps, a crease scrubbed back and forth)
// is cut into one piece per lap: whenever the line comes back within tol of where it already went,
// after travelling at least minArc since then, a new piece starts there.
function sliceLoops(P, tol, minArc){
  const n = P.length; if (n < 8) return [P];
  const arc = new Float64Array(n); for (let i = 1; i < n; i++) arc[i] = arc[i - 1] + Math.sqrt(d2(P[i - 1], P[i]));
  const out = [], t2 = tol * tol; let start = 0;
  for (let i = start + 1; i < n; i++){
    for (let j = start; j < i && arc[i] - arc[j] > minArc; j++){
      if (d2(P[i], P[j]) < t2){ out.push(P.slice(start, i + 1)); start = i; break; }
    }
  }
  out.push(P.slice(start));
  return out.filter(q => q.length >= 3);
}
// strict lines are used exactly as drawn: no grouping, no averaging
function strictCurves(strokes, L, sharp, tag){
  return strokes.map(s => {
    const closed = s.length > 8 && d2(s[0], s[s.length - 1]) < sq(L * 0.6) && polyLen(s) > 4 * L;
    const C = makeCurve(resample(closed ? s.slice(0, -1) : s, L * 0.25, closed), closed, sharp, tag); C.strict = true; return C;
  }).filter(C => C.pts.length >= 2 && C.len > L * 0.5);
}
function principalCurve(grp, g, ds){
  const P = [].concat(...grp);
  let ref = grp.reduce((a, b) => polyLen(b) > polyLen(a) ? b : a);
  let closed = d2(ref[0], ref[ref.length - 1]) < sq(g) && polyLen(ref) > 6 * g;
  let C = makeCurve(resample(ref, ds, closed), closed, false);
  if (grp.length === 1 && !closed){ return { pts: resample(smoothPoly(resample(ref, ds, false), 3, false), ds, false), closed }; }
  let still = 0;
  for (let it = 0; it < 60; it++){
    // project each point onto the curve; points past an open end project onto the end tangent
    const n = C.pts.length, proj = [];
    let lo = 0, hi = C.len;
    for (const p of P){
      const q = closestOnPoly(C, p); if (q.d2 > sq(2 * g)) continue;
      let s = q.s;
      if (!C.closed && n >= 2){
        if (q.s <= 1e-6){ const a = C.pts[0], b = C.pts[1], t = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], l = Math.hypot(...t); s = -((p[0] - a[0]) * t[0] + (p[1] - a[1]) * t[1] + (p[2] - a[2]) * t[2]) / l; s = Math.min(0, s); }
        else if (q.s >= C.len - 1e-6){ const a = C.pts[n - 1], b = C.pts[n - 2], t = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], l = Math.hypot(...t); s = C.len + Math.max(0, ((p[0] - a[0]) * t[0] + (p[1] - a[1]) * t[1] + (p[2] - a[2]) * t[2]) / l); }
      }
      proj.push([s, p]); lo = Math.min(lo, s); hi = Math.max(hi, s);
    }
    if (proj.length < 3) break;
    lo = Math.max(lo, -g); hi = Math.min(hi, C.len + g);
    const nb = Math.max(3, Math.round((hi - lo) / ds)), bw = (hi - lo) / (C.closed ? nb : nb - 1);
    const acc = Array.from({ length: nb }, () => [0, 0, 0, 0]);
    for (const [s0, p] of proj){
      let f = (Math.max(lo, Math.min(hi, s0)) - lo) / bw;
      for (let k = Math.floor(f) - 1; k <= Math.floor(f) + 2; k++){
        let kk = k; if (C.closed) kk = ((k % nb) + nb) % nb; else if (k < 0 || k >= nb) continue;
        const w = Math.exp(-sq((f - k) / 0.9)); const a = acc[kk];
        a[0] += p[0] * w; a[1] += p[1] * w; a[2] += p[2] * w; a[3] += w;
      }
    }
    let pts = acc.map(a => a[3] > 1e-3 ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : null);
    if (!C.closed){ while (pts.length && !pts[0]) pts.shift(); while (pts.length && !pts[pts.length - 1]) pts.pop(); }
    // fill gaps by interpolation
    for (let i = 0; i < pts.length; i++) if (!pts[i]){ let j = i; while (j < pts.length && !pts[j]) j++; const a = pts[(i - 1 + pts.length) % pts.length], b = pts[j % pts.length] || a; for (let k = i; k < j; k++) pts[k] = lerp3(a, b, (k - i + 1) / (j - i + 1)); i = j; }
    if (pts.length < 2) break;
    pts = resample(smoothPoly(pts, 2, C.closed), ds, C.closed);
    if (!C.closed && pts.length > 6 && d2(pts[0], pts[pts.length - 1]) < sq(g * 0.8) && polyLen(pts) > 6 * g){ closed = true; pts = resample(pts.slice(0, -1), ds, true); }
    const old = C; C = makeCurve(pts, closed || C.closed, false);
    const grew = Math.abs(C.len - old.len) > ds * 0.3;
    still = grew ? 0 : still + 1;
    if (still >= 3 && it > 6) break;
  }
  return { pts: resample(smoothPoly(C.pts, 2, C.closed), ds, C.closed), closed: C.closed };
}

// ---------------------------------------------------------------- triangle mesh with in-place edits
class Mesh {
  constructor(){ this.x = []; this.y = []; this.z = []; this.vt = []; this.dead = []; this.fc = []; this.corner = []; this.T = []; this.tdead = []; this.fe = new Map(); }
  addV(x, y, z){ const i = this.x.length; this.x.push(x); this.y.push(y); this.z.push(z); this.vt.push([]); this.dead.push(false); this.fc.push(-1); this.corner.push(false); return i; }
  addT(a, b, c){ const t = this.tdead.length; this.T.push(a, b, c); this.tdead.push(false); this.vt[a].push(t); this.vt[b].push(t); this.vt[c].push(t); return t; }
  ek(a, b){ return a < b ? a * 2097152 + b : b * 2097152 + a; }
  P(i){ return [this.x[i], this.y[i], this.z[i]]; }
  setP(i, p){ this.x[i] = p[0]; this.y[i] = p[1]; this.z[i] = p[2]; }
  len2(a, b){ return sq(this.x[a] - this.x[b]) + sq(this.y[a] - this.y[b]) + sq(this.z[a] - this.z[b]); }
  edgeTris(a, b){ const r = [], T = this.T; for (const t of this.vt[a]){ const o = 3 * t; if (T[o] === b || T[o + 1] === b || T[o + 2] === b) r.push(t); } return r; }
  nbrs(v){ const s = []; const T = this.T; for (const t of this.vt[v]) for (let i = 0; i < 3; i++){ const w = T[3 * t + i]; if (w !== v && !s.includes(w)) s.push(w); } return s; }
  isBV(v){ for (const w of this.nbrs(v)) if (this.edgeTris(v, w).length === 1) return true; return false; }
  triN(t, sub, rep){ // normal (unnormalised) of tri t, optionally with vertex sub moved to rep
    const T = this.T, o = 3 * t, p = [0, 1, 2].map(i => { const v = T[o + i]; return v === sub ? rep : this.P(v); });
    const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], w = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  }
  edges(){
    const out = [], T = this.T;
    for (let t = 0; t < this.tdead.length; t++){ if (this.tdead[t]) continue;
      for (let i = 0; i < 3; i++){ const a = T[3 * t + i], b = T[3 * t + (i + 1) % 3]; if (a < b || this.edgeTris(a, b).length === 1) out.push(a, b); } }
    return out;
  }
  split(a, b){
    const ts = this.edgeTris(a, b); if (!ts.length) return -1;
    const m = this.addV((this.x[a] + this.x[b]) / 2, (this.y[a] + this.y[b]) / 2, (this.z[a] + this.z[b]) / 2), T = this.T;
    for (const t of ts){
      const o = 3 * t; let i = 0;
      for (; i < 3; i++){ const u = T[o + i], w = T[o + (i + 1) % 3]; if ((u === a && w === b) || (u === b && w === a)) break; }
      const w = T[o + (i + 1) % 3], c = T[o + (i + 2) % 3];
      T[o + (i + 1) % 3] = m; rmv(this.vt[w], t); this.vt[m].push(t);
      this.addT(m, w, c);
    }
    const k = this.ek(a, b);
    if (this.fe.has(k)){ const id = this.fe.get(k); this.fe.delete(k); this.fe.set(this.ek(a, m), id); this.fe.set(this.ek(m, b), id); this.fc[m] = id; }
    return m;
  }
  flip(a, b, minDot){
    if (this.fe.has(this.ek(a, b))) return false;
    const ts = this.edgeTris(a, b); if (ts.length !== 2) return false;
    const T = this.T;
    const opp = (t, p, q) => { const o = 3 * t; for (let i = 0; i < 3; i++) if (T[o + i] === p && T[o + (i + 1) % 3] === q) return T[o + (i + 2) % 3]; return -1; };
    let [t1, t2] = ts; let c = opp(t1, a, b); if (c < 0){ [t1, t2] = [t2, t1]; c = opp(t1, a, b); }
    const d = opp(t2, b, a); if (c < 0 || d < 0 || c === d) return false;
    if (this.edgeTris(c, d).length) return false;
    const n1 = norm(this.triN(t1)), n2 = norm(this.triN(t2));
    if (dot(n1, n2) < minDot) return false;
    const avg = norm([n1[0] + n2[0], n1[1] + n2[1], n1[2] + n2[2]]);
    const pa = this.P(a), pb = this.P(b), pc = this.P(c), pd = this.P(d);
    const m1 = cross3(pa, pd, pc), m2 = cross3(pd, pb, pc);
    if (dot(norm(m1), avg) < 0.3 || dot(norm(m2), avg) < 0.3) return false;
    const o1 = 3 * t1, o2 = 3 * t2;
    T[o1] = a; T[o1 + 1] = d; T[o1 + 2] = c; T[o2] = d; T[o2 + 1] = b; T[o2 + 2] = c;
    rmv(this.vt[a], t2); rmv(this.vt[b], t1); this.vt[c].push(t2); this.vt[d].push(t1);
    return true;
  }
  collapse(a, b, np){ // remove a, keep b at np
    const ts = this.edgeTris(a, b); if (!ts.length) return false;
    const Na = this.nbrs(a), Nb = this.nbrs(b);
    let common = 0; for (const v of Na) if (v !== b && Nb.includes(v)) common++;
    if (common !== ts.length) return false;
    if (Na.length + Nb.length - 2 - common < 3) return false;
    const be = ts.length === 1, ba = this.isBV(a), bb = this.isBV(b);
    if (ba && !be) return false;
    if (bb && !ba && (np[0] !== this.x[b] || np[1] !== this.y[b] || np[2] !== this.z[b])) return false;
    for (const t of this.vt[a]){
      if (ts.includes(t)) continue;
      const n0 = this.triN(t), n1 = this.triN(t, a, np), l0 = Math.hypot(...n0), l1 = Math.hypot(...n1);
      if (l1 < l0 * 0.05 || dot(n0, n1) < 0.4 * l0 * l1) return false;
    }
    const T = this.T;
    for (const t of ts){ this.tdead[t] = true; for (let i = 0; i < 3; i++) rmv(this.vt[T[3 * t + i]], t); }
    for (const t of this.vt[a]){ for (let i = 0; i < 3; i++) if (T[3 * t + i] === a) T[3 * t + i] = b; this.vt[b].push(t); }
    this.vt[a] = []; this.dead[a] = true; this.setP(b, np);
    for (const x of Na){ const k = this.ek(a, x); if (this.fe.has(k)){ const id = this.fe.get(k); this.fe.delete(k); if (x !== b) this.fe.set(this.ek(b, x), id); } }
    if (this.fc[a] >= 0 && this.fc[b] < 0) this.fc[b] = this.fc[a];
    return true;
  }
  compact(){
    const map = new Int32Array(this.x.length).fill(-1), M = new Mesh();
    for (let t = 0; t < this.tdead.length; t++){ if (this.tdead[t]) continue;
      const o = 3 * t, ids = [0, 1, 2].map(i => { const v = this.T[o + i]; if (map[v] < 0){ map[v] = M.addV(this.x[v], this.y[v], this.z[v]); M.fc[map[v]] = this.fc[v]; M.corner[map[v]] = this.corner[v]; } return map[v]; });
      M.addT(ids[0], ids[1], ids[2]); }
    for (const [k, id] of this.fe){ const a = Math.floor(k / 2097152), b = k % 2097152; if (map[a] >= 0 && map[b] >= 0 && M.edgeTris(map[a], map[b]).length) M.fe.set(M.ek(map[a], map[b]), id); }
    Object.assign(this, M);
  }
}
function dot(a, b){ return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a){ const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function cross3(p0, p1, p2){ const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], w = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]]; return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; }

// ---------------------------------------------------------------- the starting sheet: a triangle lattice over the plan footprint
function startSheet(samples, a, reach, h){
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const s of samples){ x0 = Math.min(x0, s.p[0]); x1 = Math.max(x1, s.p[0]); z0 = Math.min(z0, s.p[2]); z1 = Math.max(z1, s.p[2]); }
  x0 -= reach + a; z0 -= reach + a; x1 += reach + a; z1 += reach + a;
  const cs = a / 2, W = Math.ceil((x1 - x0) / cs) + 1, H = Math.ceil((z1 - z0) / cs) + 1;
  let mask = new Uint8Array(W * H); const r = Math.ceil(reach / cs);
  for (const s of samples){ const ci = Math.round((s.p[0] - x0) / cs), cj = Math.round((s.p[2] - z0) / cs);
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++){ if (i * i + j * j > r * r) continue; const u = ci + i, v = cj + j; if (u >= 0 && v >= 0 && u < W && v < H) mask[v * W + u] = 1; } }
  // fill holes completely surrounded by lines
  const out = new Uint8Array(W * H), st = [];
  for (let i = 0; i < W; i++){ st.push(i, (H - 1) * W + i); } for (let j = 0; j < H; j++){ st.push(j * W, j * W + W - 1); }
  while (st.length){ const k = st.pop(); if (out[k] || mask[k]) continue; out[k] = 1; const i = k % W, j = (k - i) / W; if (i > 0) st.push(k - 1); if (i < W - 1) st.push(k + 1); if (j > 0) st.push(k - W); if (j < H - 1) st.push(k + W); }
  for (let k = 0; k < W * H; k++) if (!out[k]) mask[k] = 1;
  // round off one-cell spikes and nicks
  const morph = (m, keep) => { const n = new Uint8Array(W * H); for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++){ const k = j * W + i; let c = m[k - 1] + m[k + 1] + m[k - W] + m[k + W] + m[k]; n[k] = keep ? (c >= 3 ? 1 : 0) : (c >= 3 ? 1 : 0); } return n; };
  mask = morph(morph(mask, 1), 0);
  const inside = (x, z) => { const i = Math.round((x - x0) / cs), j = Math.round((z - z0) / cs); return i >= 0 && j >= 0 && i < W && j < H && mask[j * W + i]; };
  // equilateral lattice
  const M = new Mesh(), rowH = a * Math.sqrt(3) / 2, nx = Math.ceil((x1 - x0) / a) + 2, nz = Math.ceil((z1 - z0) / rowH) + 1;
  const id = new Int32Array(nx * nz).fill(-1), px = (i, j) => x0 + i * a + (j & 1 ? a / 2 : 0), pz = j => z0 + j * rowH;
  const G = new Grid(Math.max(h, a)); samples.forEach((s, k) => G.add(k, s.p[0], 0, s.p[2]));
  const height = (x, z) => { let sw = 0, sy = 0, best = Infinity, by = 0; const R = Math.max(h, a) * 1.5;
    G.each(x, 0, z, R * 1.5, k => { const s = samples[k], dd = sq(s.p[0] - x) + sq(s.p[2] - z); const w = Math.exp(-dd / (R * R)) * s.w; sw += w; sy += w * s.p[1]; if (dd < best){ best = dd; by = s.p[1]; } });
    return sw > 1e-3 ? sy / sw : by; };
  let nearestY = 0; if (samples.length) nearestY = samples[0].p[1];
  const vid = (i, j) => { const k = j * nx + i; if (id[k] < 0){ const x = px(i, j), z = pz(j); let y = height(x, z); if (!isFinite(y)) y = nearestY; id[k] = M.addV(x, y, z); } return id[k]; };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++){
    const odd = j & 1;
    const A = [i, j], B = [i + 1, j], C = odd ? [i + 1, j + 1] : [i, j + 1], D = odd ? [i, j + 1] : [i + 1, j + 1];
    // two triangles per lattice rhombus, wound so normals point up (+y)
    const tri = (p, q, r2) => { const c = [(px(...p) + px(...q) + px(...r2)) / 3, (pz(p[1]) + pz(q[1]) + pz(r2[1])) / 3]; if (!inside(c[0], c[1]) || !inside(px(...p), pz(p[1])) || !inside(px(...q), pz(q[1])) || !inside(px(...r2), pz(r2[1]))) return;
      M.addT(vid(...p), vid(...r2), vid(...q)); };
    if (odd){ tri(A, B, C); tri(A, C, D); } else { tri(A, B, D); tri(A, D, C); }
  }
  // check winding points up; flip all if not
  let up = 0; for (let t = 0; t < M.tdead.length; t++) up += M.triN(t)[1];
  if (up < 0) for (let t = 0; t < M.tdead.length; t++){ const o = 3 * t, b = M.T[o + 1]; M.T[o + 1] = M.T[o + 2]; M.T[o + 2] = b; }
  fixBowties(M); dropSmallParts(M, 12);
  M.compact();
  return M;
}
// a vertex where two fans of triangles only touch at a point gets split into one vertex per fan
function fixBowties(M){
  const nv = M.x.length;
  for (let v = 0; v < nv; v++){
    const ts = M.vt[v].slice(); if (ts.length < 2) continue;
    const comp = new Map(); let nc = 0;
    for (const t of ts){ if (comp.has(t)) continue; const st = [t]; comp.set(t, nc);
      while (st.length){ const u = st.pop(); for (let i = 0; i < 3; i++){ const w = M.T[3 * u + i]; if (w === v) continue; for (const t2 of M.edgeTris(v, w)) if (!comp.has(t2)){ comp.set(t2, nc); st.push(t2); } } }
      nc++; }
    for (let c = 1; c < nc; c++){ const nvx = M.addV(M.x[v], M.y[v], M.z[v]);
      for (const t of ts) if (comp.get(t) === c){ for (let i = 0; i < 3; i++) if (M.T[3 * t + i] === v) M.T[3 * t + i] = nvx; rmv(M.vt[v], t); M.vt[nvx].push(t); } }
  }
}
function dropSmallParts(M, minTris){
  const seen = new Uint8Array(M.tdead.length);
  for (let t = 0; t < M.tdead.length; t++){ if (seen[t] || M.tdead[t]) continue;
    const st = [t], part = []; seen[t] = 1;
    while (st.length){ const u = st.pop(); part.push(u); for (let i = 0; i < 3; i++) for (const t2 of M.vt[M.T[3 * u + i]]) if (!seen[t2]){ seen[t2] = 1; st.push(t2); } }
    if (part.length < minTris) for (const u of part){ M.tdead[u] = true; for (let i = 0; i < 3; i++) rmv(M.vt[M.T[3 * u + i]], u); }
  }
}

// ---------------------------------------------------------------- remeshing
function remesh(M, L, flipDot){
  const hi2 = sq(L * 4 / 3), lo2 = sq(L * 0.8);
  // split long edges, longest first
  let E = M.edges(), list = [];
  const strictE = (a, b) => { const id = M.fe.get(M.ek(a, b)); return id !== undefined && M.strictIds && M.strictIds.has(id); };
  const hiS = sq(L * 0.7), loS = sq(L * 0.3);
  for (let i = 0; i < E.length; i += 2){ const l = M.len2(E[i], E[i + 1]); if (l > (strictE(E[i], E[i + 1]) ? hiS : hi2)) list.push([l, E[i], E[i + 1]]); }
  list.sort((p, q) => q[0] - p[0]);
  for (const [, a, b] of list) if (M.len2(a, b) > (strictE(a, b) ? hiS : hi2)) M.split(a, b);
  // collapse short edges
  E = M.edges(); list = [];
  for (let i = 0; i < E.length; i += 2){ const l = M.len2(E[i], E[i + 1]); if (l < lo2) list.push([l, E[i], E[i + 1]]); }
  list.sort((p, q) => p[0] - q[0]);
  for (const [, a0, b0] of list){
    if (M.dead[a0] || M.dead[b0] || !M.edgeTris(a0, b0).length || M.len2(a0, b0) >= lo2) continue;
    if (strictE(a0, b0) && M.len2(a0, b0) >= loS) continue;
    let a = a0, b = b0, np;
    const fa = M.fc[a] >= 0, fb = M.fc[b] >= 0;
    if (M.corner[a] && M.corner[b]) continue;
    if (fa && fb){ if (!M.fe.has(M.ek(a, b))) continue; if (M.corner[a]){ [a, b] = [b, a]; } np = M.P(b); }
    else if (fa || fb){ if (fa){ [a, b] = [b, a]; } np = M.P(b); }
    else { const ba = M.isBV(a), bb = M.isBV(b);
      if (ba && bb){ if (M.edgeTris(a, b).length !== 1) continue; np = lerp3(M.P(a), M.P(b), 0.5); }
      else if (ba){ [a, b] = [b, a]; np = M.P(b); }
      else if (bb) np = M.P(b);
      else np = lerp3(M.P(a), M.P(b), 0.5); }
    let ok = true; for (const x of M.nbrs(a)){ if (x === b) continue; if (sq(M.x[x] - np[0]) + sq(M.y[x] - np[1]) + sq(M.z[x] - np[2]) > hi2){ ok = false; break; } }
    if (ok) M.collapse(a, b, np);
  }
  // flip toward valence 6 (4 on the border)
  for (let pass = 0; pass < 2; pass++){
    const val = new Int32Array(M.x.length), bnd = new Uint8Array(M.x.length);
    E = M.edges();
    for (let i = 0; i < E.length; i += 2){ val[E[i]]++; val[E[i + 1]]++; if (M.edgeTris(E[i], E[i + 1]).length === 1){ bnd[E[i]] = 1; bnd[E[i + 1]] = 1; } }
    const tgt = v => bnd[v] ? 4 : 6;
    for (let i = 0; i < E.length; i += 2){
      const a = E[i], b = E[i + 1], ts = M.edgeTris(a, b); if (ts.length !== 2) continue;
      const c = M.T.slice(3 * ts[0], 3 * ts[0] + 3).find(v => v !== a && v !== b), d = M.T.slice(3 * ts[1], 3 * ts[1] + 3).find(v => v !== a && v !== b);
      if (c === undefined || d === undefined) continue;
      const before = Math.abs(val[a] - tgt(a)) + Math.abs(val[b] - tgt(b)) + Math.abs(val[c] - tgt(c)) + Math.abs(val[d] - tgt(d));
      const after = Math.abs(val[a] - 1 - tgt(a)) + Math.abs(val[b] - 1 - tgt(b)) + Math.abs(val[c] + 1 - tgt(c)) + Math.abs(val[d] + 1 - tgt(d));
      if (after < before && M.flip(a, b, flipDot)){ val[a]--; val[b]--; val[c]++; val[d]++; }
    }
  }
  // flip away sliver triangles (Delaunay-ish: flip when the two opposite angles sum past 180°)
  E = M.edges();
  for (let i = 0; i < E.length; i += 2){
    const a = E[i], b = E[i + 1], ts = M.edgeTris(a, b); if (ts.length !== 2) continue;
    const c = M.T.slice(3 * ts[0], 3 * ts[0] + 3).find(v => v !== a && v !== b), d = M.T.slice(3 * ts[1], 3 * ts[1] + 3).find(v => v !== a && v !== b);
    if (c === undefined || d === undefined) continue;
    if (angleAt(M, c, a, b) + angleAt(M, d, a, b) > Math.PI * 1.08) M.flip(a, b, flipDot);
  }
  M.compact();
}
function angleAt(M, v, a, b){ const p = M.P(v), u = norm([M.x[a] - p[0], M.y[a] - p[1], M.z[a] - p[2]]), w = norm([M.x[b] - p[0], M.y[b] - p[1], M.z[b] - p[2]]); return Math.acos(Math.max(-1, Math.min(1, dot(u, w)))); }

// ---------------------------------------------------------------- one fitting step
function vertexNormals(M){
  const N = Array.from({ length: M.x.length }, () => [0, 0, 0]);
  for (let t = 0; t < M.tdead.length; t++){ if (M.tdead[t]) continue; const n = M.triN(t); for (let i = 0; i < 3; i++){ const v = M.T[3 * t + i]; N[v][0] += n[0]; N[v][1] += n[1]; N[v][2] += n[2]; } }
  return N.map(norm);
}
let WB = new Float64Array(64), GU = new Float64Array(64), GW = new Float64Array(64), RW = new Float64Array(64);
// smooth paint: how strongly a spot was painted (0..1)
function makePaint(dabs){
  if (!dabs || !dabs.length) return null;
  const G = new Grid(Math.max(...dabs.map(d => d.r)));
  dabs.forEach((d, i) => G.add(i, d.x, d.y, d.z));
  return (x, y, z) => { let m = 0; G.each(x, y, z, G.s ? 1 / G.s : 1, i => { const d = dabs[i], q = ((d.x - x) ** 2 + (d.y - y) ** 2 + (d.z - z) ** 2) / (d.r * d.r); if (q < 1) m += d.s * (1 - q) * (1 - q); }); return Math.min(1, m); };
}
function fitStep(M, samples, curves, o){
  const nv = M.x.length, N = vertexNormals(M), nb = [], bnd = new Uint8Array(nv);
  for (let v = 0; v < nv; v++) nb.push(M.nbrs(v));
  const E = M.edges(); for (let i = 0; i < E.length; i += 2) if (M.edgeTris(E[i], E[i + 1]).length === 1){ bnd[E[i]] = 1; bnd[E[i + 1]] = 1; }
  const sharpV = v => M.fc[v] >= 0 && curves[M.fc[v]] && curves[M.fc[v]].sharp;
  // hand each sample to its nearest vertex
  const VG = new Grid(o.L); for (let v = 0; v < nv; v++) VG.add(v, M.x[v], M.y[v], M.z[v]);
  const own = Array.from({ length: nv }, () => []);
  for (let k = 0; k < samples.length; k++){ const p = samples[k].p; let best = -1, bd = sq(o.reach2);
    VG.each(p[0], p[1], p[2], o.reach2, v => { const dd = sq(M.x[v] - p[0]) + sq(M.y[v] - p[1]) + sq(M.z[v] - p[2]); if (dd < bd){ bd = dd; best = v; } });
    if (best >= 0){ if (sharpV(best) && !samples[k].curve){ let b2 = -1, bd2 = Infinity; for (const w of nb[best]) if (!sharpV(w)){ const dd = sq(M.x[w] - p[0]) + sq(M.y[w] - p[1]) + sq(M.z[w] - p[2]); if (dd < bd2){ bd2 = dd; b2 = w; } } if (b2 >= 0) best = b2; } own[best].push(k); } }
  const stamp = new Int32Array(nv).fill(-1), R = o.h * o.grow, R2 = R * R, ihn2 = 1 / (o.hn * o.hn), h2 = o.h * o.h;
  const nx = M.x.slice(), ny = M.y.slice(), nz = M.z.slice();
  // umbrella vectors, for the thin-plate smoothing that fills gaps between lines
  const U = new Float64Array(nv * 3);
  for (let v = 0; v < nv; v++){ const r = nb[v]; if (!r.length) continue; let lx = 0, ly = 0, lz = 0; for (const w of r){ lx += M.x[w]; ly += M.y[w]; lz += M.z[w]; } U[3 * v] = lx / r.length - M.x[v]; U[3 * v + 1] = ly / r.length - M.y[v]; U[3 * v + 2] = lz / r.length - M.z[v]; }
  const gk = [], gn = [], gt = [], minT = new Map();
  for (let v = 0; v < nv; v++){
    if (M.dead[v] || !M.vt[v].length) continue;
    const p = M.P(v), n = N[v];
    if (M.fc[v] >= 0){
      // on a curve: slide along it toward the middle of its curve neighbours, stay on the curve
      const C = curves[M.fc[v]]; if (M.corner[v]) continue;
      let cx = 0, cy = 0, cz = 0, k = 0;
      for (const w of nb[v]) if (M.fe.get(M.ek(v, w)) === M.fc[v]){ cx += M.x[w]; cy += M.y[w]; cz += M.z[w]; k++; }
      const tgt = k === 2 ? lerp3(p, [cx / 2, cy / 2, cz / 2], 0.5) : p;
      const q = closestOnPoly(C, tgt).p; nx[v] = q[0]; ny[v] = q[1]; nz[v] = q[2];
      continue;
    }
    // gather line samples from the mesh neighbourhood without walking across a sharp crease
    gk.length = gn.length = gt.length = 0; minT.clear();
    const st = [v]; stamp[v] = v;
    while (st.length){
      const x = st.pop();
      for (const k of own[x]){ const s = samples[k], dx = s.p[0] - p[0], dy = s.p[1] - p[1], dz = s.p[2] - p[2];
        const dn = dx * n[0] + dy * n[1] + dz * n[2], dt2 = Math.max(0, dx * dx + dy * dy + dz * dz - dn * dn);
        if (dn * dn * ihn2 > 6) continue;
        gk.push(k); gn.push(dn); gt.push(dt2);
        if (s.guide) continue;
        const m = minT.get(s.sid); if (m === undefined || dt2 < m) minT.set(s.sid, dt2); }
      if (x !== v && sharpV(x)) continue;
      for (const y of nb[x]){ if (stamp[y] === v) continue; if (sq(M.x[y] - p[0]) + sq(M.y[y] - p[1]) + sq(M.z[y] - p[2]) > R2) continue; stamp[y] = v; st.push(y); }
    }
    // widen the averaging until it spans at least `lines` different strokes, so one wobbly
    // stroke on its own can't put a bump in the surface
    const pm = o.paint ? o.paint(p[0], p[1], p[2]) : 0;
    let r2 = h2;
    if (minT.size){ const ms = [...minT.values()].sort((a, b) => a - b); r2 = Math.max(h2, ms[Math.min(o.lines, ms.length) - 1] * 1.3); r2 = Math.min(r2, R2 * 0.5); }
    if (pm) r2 = Math.min(r2 * (1 + 4 * pm), R2 * 0.6);   // painted smooth: average over a wider area
    const ir2 = 1 / r2;
    // fit a small plane to the nearby line samples (in the vertex's tangent frame) and take where it
    // crosses the normal. A plain average is biased wherever all the lines sit to one side (the edges).
    const t1 = norm(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [0, -n[2], n[1]]), t2 = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]];
    // base weights, and each sample's position in the tangent frame
    const m = gk.length; if (WB.length < m){ WB = new Float64Array(m * 2); GU = new Float64Array(m * 2); GW = new Float64Array(m * 2); RW = new Float64Array(m * 2); }
    for (let i = 0; i < m; i++){ const q = samples[gk[i]].p, dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
      WB[i] = samples[gk[i]].w * Math.exp(-gt[i] * ir2 - gn[i] * gn[i] * ihn2); GU[i] = dx * t1[0] + dy * t1[1] + dz * t1[2]; GW[i] = dx * t2[0] + dy * t2[1] + dz * t2[2]; RW[i] = 1; }
    // plane fit: offset a0 plus slopes; then refit twice, trusting less the samples far off the plane
    // (a line that floated up, an overshoot into the air), so the bulk of your lines decides
    let W = 0, dataN = 0, a0 = 0, b1 = 0, b2 = 0;
    for (let pass = 0; pass < (o.robust ? 3 : 1); pass++){
      W = 0; let Su = 0, Sw = 0, Suu = 0, Suw = 0, Sww = 0, Sn = 0, Sun = 0, Swn = 0;
      for (let i = 0; i < m; i++){ const w = WB[i] * RW[i], u = GU[i], ww = GW[i], dn = gn[i];
        W += w; Su += w * u; Sw += w * ww; Suu += w * u * u; Suw += w * u * ww; Sww += w * ww * ww; Sn += w * dn; Sun += w * u * dn; Swn += w * ww * dn; }
      if (W <= 1e-9) break;
      dataN = Sn / W; a0 = dataN; b1 = b2 = 0;
      const lam = 0.03 * W * r2, a11 = Suu + lam, a22 = Sww + lam;
      const det = W * (a11 * a22 - Suw * Suw) - Su * (Su * a22 - Suw * Sw) + Sw * (Su * Suw - a11 * Sw);
      if (Math.abs(det) > 1e-12){
        const A0 = (Sn * (a11 * a22 - Suw * Suw) - Su * (Sun * a22 - Suw * Swn) + Sw * (Sun * Suw - a11 * Swn)) / det;
        const B1 = (W * (Sun * a22 - Suw * Swn) - Sn * (Su * a22 - Suw * Sw) + Sw * (Su * Swn - Sun * Sw)) / det;
        const B2 = (W * (a11 * Swn - Sun * Suw) - Su * (Su * Swn - Sun * Sw) + Sn * (Su * Suw - a11 * Sw)) / det;
        if (isFinite(A0) && Math.abs(A0) < Math.sqrt(r2) * 2){ a0 = A0; b1 = B1; b2 = B2; dataN = A0; }
      }
      if (!o.robust) break;
      let rr = 0; for (let i = 0; i < m; i++){ const res = gn[i] - (a0 + b1 * GU[i] + b2 * GW[i]); rr += WB[i] * RW[i] * res * res; }
      const sig = Math.max(Math.sqrt(rr / W), o.L * 0.15), c2 = 1 / (sig * sig * 1.5);
      for (let i = 0; i < m; i++){ const res = gn[i] - (a0 + b1 * GU[i] + b2 * GW[i]); RW[i] = 1 / (1 + res * res * c2); }
    }
    const c = W / (W + 0.4);
    const ring = nb[v];
    const lx = U[3 * v], ly = U[3 * v + 1], lz = U[3 * v + 2];
    const lapN = lx * n[0] + ly * n[1] + lz * n[2];
    // thin-plate term: extends the surface smoothly where there are no lines (no droop at the edges)
    // (next to the border the one-sided umbrella is lopsided, so there it falls back to plain smoothing)
    let bx = -lx, by = -ly, bz = -lz, nearB = bnd[v]; for (const w of ring){ if (bnd[w] || sharpV(w)) nearB = 1; bx += U[3 * w] / ring.length; by += U[3 * w + 1] / ring.length; bz += U[3 * w + 2] / ring.length; }
    const bilN = nearB ? lapN : -(bx * n[0] + by * n[1] + bz * n[2]) * 0.35;
    const fairN = c * lapN + (1 - c) * bilN;
    const fv = Math.min(0.75, o.fair + (1 - o.fair) * 0.9 * pm), k = 1 - c * (1 - fv);
    let offN = (1 - k) * dataN + k * fairN; offN = Math.max(-o.maxStep, Math.min(o.maxStep, offN));
    let tx = lx - lapN * n[0], ty = ly - lapN * n[1], tz = lz - lapN * n[2];
    if (bnd[v]){
      // border: smooth along the border only (alternating shrink/grow so it doesn't creep inward)
      const bn = ring.filter(w => bnd[w] && M.edgeTris(v, w).length === 1);
      if (bn.length === 2){ const lam = o.parity ? 0.45 : -0.47;
        tx = ((M.x[bn[0]] + M.x[bn[1]]) / 2 - p[0]) * lam; ty = ((M.y[bn[0]] + M.y[bn[1]]) / 2 - p[1]) * lam; tz = ((M.z[bn[0]] + M.z[bn[1]]) / 2 - p[2]) * lam;
        const tn = tx * n[0] + ty * n[1] + tz * n[2]; tx -= tn * n[0]; ty -= tn * n[1]; tz -= tn * n[2];
      } else { tx = ty = tz = 0; }
    } else if (o.flow && o.flow.conf[v] > 0.05 && v < o.flow.conf.length){
      const c = o.flow.conf[v], al = alignTarget(M, o.flow, v, n);
      tx = (tx * (1 - c) + al[0] * c) * o.relax; ty = (ty * (1 - c) + al[1] * c) * o.relax; tz = (tz * (1 - c) + al[2] * c) * o.relax;
    } else { tx *= o.relax; ty *= o.relax; tz *= o.relax; }
    nx[v] = p[0] + offN * n[0] * o.step + tx; ny[v] = p[1] + offN * n[1] * o.step + ty; nz[v] = p[2] + offN * n[2] * o.step + tz;
  }
  M.x = nx; M.y = ny; M.z = nz;
}
// tangential-only relaxation, used right after cutting curves in to untangle the neighbourhood
function untangle(M, iters){
  for (let it = 0; it < iters; it++){
    const N = vertexNormals(M), nx = M.x.slice(), ny = M.y.slice(), nz = M.z.slice();
    for (let v = 0; v < M.x.length; v++){
      if (M.fc[v] >= 0 || !M.vt[v].length || M.isBV(v)) continue;
      const ring = M.nbrs(v); let lx = 0, ly = 0, lz = 0;
      for (const w of ring){ lx += M.x[w]; ly += M.y[w]; lz += M.z[w]; }
      lx = lx / ring.length - M.x[v]; ly = ly / ring.length - M.y[v]; lz = lz / ring.length - M.z[v];
      const n = N[v], d = lx * n[0] + ly * n[1] + lz * n[2];
      nx[v] += (lx - d * n[0]) * 0.7 + d * n[0] * 0.3; ny[v] += (ly - d * n[1]) * 0.7 + d * n[1] * 0.3; nz[v] += (lz - d * n[2]) * 0.7 + d * n[2] * 0.3;
    }
    M.x = nx; M.y = ny; M.z = nz;
  }
}

// Relax: settles the finished mesh. Each pass pulls every vertex toward the middle of its neighbours
// (which smooths bumps and evens out the spacing), then pushes back a little so the shape doesn't
// shrink or sag. Every guide and crease vertex stays put, so nothing slides across or off a crease.
function relaxMesh(M, passes, F){
  for (let it = 0; it < passes * 2; it++){
    const lam = it & 1 ? -0.53 : 0.5, nx = M.x.slice(), ny = M.y.slice(), nz = M.z.slice();
    for (let v = 0; v < M.x.length; v++){
      if (M.fc[v] >= 0 || !M.vt[v].length) continue;
      const ring = M.nbrs(v), bn = ring.filter(w => M.edgeTris(v, w).length === 1);
      const use = bn.length === 2 ? bn : bn.length ? null : ring; if (!use) continue;   // border: only along the border
      let cx = 0, cy = 0, cz = 0, W = 0;
      const fl = F && use === ring && v < F.conf.length && F.conf[v] > 0.05;
      for (const w of use){ let wt = 1;
        if (fl){ const e = norm([M.x[w] - M.x[v], M.y[w] - M.y[v], M.z[w] - M.z[v]]), al = Math.abs(dot(e, [F.d1[3 * v], F.d1[3 * v + 1], F.d1[3 * v + 2]])); wt = 1 + 3 * F.conf[v] * al * al; }
        cx += M.x[w] * wt; cy += M.y[w] * wt; cz += M.z[w] * wt; W += wt; }
      nx[v] += (cx / W - M.x[v]) * lam; ny[v] += (cy / W - M.y[v]) * lam; nz[v] += (cz / W - M.z[v]) * lam;
    }
    M.x = nx; M.y = ny; M.z = nz;
  }
}
// find faces that flipped over (a fold) and relax them and their neighbours until the sheet lies flat again
function unfold(M, iters){
  let worst = 0;
  for (let it = 0; it < iters; it++){
    const N = vertexNormals(M), nv = M.x.length, SN = N.map((n, v) => { const s = n.slice(); for (const w of M.nbrs(v)){ s[0] += N[w][0]; s[1] += N[w][1]; s[2] += N[w][2]; } return norm(s); });
    const bad = new Set();
    for (let t = 0; t < M.tdead.length; t++){ if (M.tdead[t]) continue; const n = norm(M.triN(t));
      for (let i = 0; i < 3; i++){ const v = M.T[3 * t + i]; if (dot(n, SN[v]) < 0.25){ for (let j = 0; j < 3; j++) bad.add(M.T[3 * t + j]); break; } } }
    if (it === 0) worst = bad.size;
    if (!bad.size) break;
    const zone = new Set(bad); for (const v of bad) for (const w of M.nbrs(v)) zone.add(w);
    const nx = M.x.slice(), ny = M.y.slice(), nz = M.z.slice();
    for (const v of zone){
      if (M.fc[v] >= 0 || !M.vt[v].length) continue;
      const ring = M.nbrs(v), bn = ring.filter(w => M.edgeTris(v, w).length === 1);
      const use = bn.length === 2 ? bn : ring; let cx = 0, cy = 0, cz = 0;
      for (const w of use){ cx += M.x[w]; cy += M.y[w]; cz += M.z[w]; }
      nx[v] += (cx / use.length - M.x[v]) * 0.7; ny[v] += (cy / use.length - M.y[v]) * 0.7; nz[v] += (cz / use.length - M.z[v]) * 0.7;
    }
    M.x = nx; M.y = ny; M.z = nz;
  }
  return worst;
}

// ---------------------------------------------------------------- cutting a curve into the mesh
function embedCurve(M, C, id, L){
  const S = resample(C.pts, L * 0.35, C.closed); if (S.length < 2) return 0;
  const VG = new Grid(L); for (let v = 0; v < M.x.length; v++) if (M.vt[v].length) VG.add(v, M.x[v], M.y[v], M.z[v]);
  const near = p => { let best = -1, bd = sq(L * 1.6); VG.each(p[0], p[1], p[2], L * 1.6, v => { const dd = sq(M.x[v] - p[0]) + sq(M.y[v] - p[1]) + sq(M.z[v] - p[2]); if (dd < bd){ bd = dd; best = v; } }); return best; };
  // runs of curve samples that lie over the mesh
  const runs = []; let cur = [];
  for (const p of S){ const v = near(p); if (v < 0){ if (cur.length) runs.push(cur); cur = []; continue; } if (cur[cur.length - 1] !== v) cur.push(v); }
  if (cur.length) runs.push(cur);
  if (C.closed && runs.length === 1 && runs[0].length > 3) runs[0].push(runs[0][0]);
  let added = 0;
  for (const run of runs){
    if (run.length < 2) continue;
    let path = [run[0]];
    for (let i = 1; i < run.length; i++){
      const u = path[path.length - 1], w = run[i]; if (u === w) continue;
      const sp = shortestPath(M, u, w, L * 4); if (!sp){ break; }
      for (let k = 1; k < sp.length; k++) path.push(sp[k]);
    }
    const closed = C.closed && path.length > 3 && path[0] === path[path.length - 1];
    // cut out any loops the walk made
    const seen = new Map(), clean = [];
    for (let i = 0; i < path.length; i++){ const v = path[i];
      if (closed && i === path.length - 1) break;
      if (seen.has(v)){ const j = seen.get(v); for (const u of clean.splice(j + 1)) seen.delete(u); continue; }
      seen.set(v, clean.length); clean.push(v); }
    if (clean.length < 2) continue;
    // spread the chain evenly along the stretch of curve it covers
    const s0 = closestOnPoly(C, M.P(clean[0])).s, s1 = closestOnPoly(C, M.P(clean[clean.length - 1])).s;
    let a0 = s0, a1 = s1;
    if (closed){ a1 = a0 + C.len * (clean.length) / clean.length; }
    else { if (a0 < L) a0 = 0; if (C.len - a1 < L) a1 = C.len; if (a1 < a0 && !C.closed){ const t = a0; a0 = a1; a1 = t; clean.reverse(); } }
    const n = clean.length, denom = closed ? n : n - 1;
    for (let i = 0; i < n; i++){
      const v = clean[i], q = pointAt(C, a0 + (a1 - a0) * i / denom);
      if (M.fc[v] >= 0 && M.fc[v] !== id){ M.corner[v] = true; continue; }
      M.setP(v, q); M.fc[v] = id;
    }
    for (let i = 0; i < (closed ? n : n - 1); i++){ const a = clean[i], b = clean[(i + 1) % n]; if (!M.fe.has(M.ek(a, b))) M.fe.set(M.ek(a, b), id); }
    if (!closed){ M.corner[clean[0]] = true; M.corner[clean[n - 1]] = true; }
    added += n;
  }
  return added;
}
function shortestPath(M, src, dst, maxLen){
  const dist = new Map([[src, 0]]), prev = new Map(), open = [src], done = new Set();
  const goal = M.P(dst), h = v => Math.sqrt(sq(M.x[v] - goal[0]) + sq(M.y[v] - goal[1]) + sq(M.z[v] - goal[2]));
  let guard = 0;
  while (open.length && guard++ < 600){
    let bi = 0; for (let i = 1; i < open.length; i++) if (dist.get(open[i]) + h(open[i]) < dist.get(open[bi]) + h(open[bi])) bi = i;
    const u = open[bi]; open.splice(bi, 1); if (u === dst) break; if (done.has(u)) continue; done.add(u);
    if (dist.get(u) > maxLen) continue;
    for (const w of M.nbrs(u)){
      if (M.fe.has(M.ek(u, w))) continue;          // don't run along another curve
      if (w !== dst && M.fc[w] >= 0) continue;       // or through it
      const nd = dist.get(u) + Math.sqrt(M.len2(u, w));
      if (!dist.has(w) || nd < dist.get(w)){ dist.set(w, nd); prev.set(w, u); open.push(w); }
    }
  }
  if (!prev.has(dst)) return null;
  const path = [dst]; while (path[path.length - 1] !== src) path.push(prev.get(path[path.length - 1]));
  return path.reverse();
}

// ---------------- guides: laid onto the surface, smoothed, and turned into a flow direction for the quads
// closest point on the mesh to p (search the triangles around the nearest few vertices)
function closestOnMesh(M, VG, p, r){
  let best = null, bd = Infinity;
  VG.each(p[0], p[1], p[2], r, v => { const dd = sq(M.x[v] - p[0]) + sq(M.y[v] - p[1]) + sq(M.z[v] - p[2]); if (dd < bd){ bd = dd; best = v; } });
  if (best === null) return null;
  let q = M.P(best), qd = bd;
  for (const t of M.vt[best]){ const c = closestOnTri(p, M.P(M.T[3 * t]), M.P(M.T[3 * t + 1]), M.P(M.T[3 * t + 2])), dd = d2(p, c); if (dd < qd){ qd = dd; q = c; } }
  return { p: q, d: Math.sqrt(qd) };
}
function closestOnTri(p, a, b, c){
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const d1 = dot(ab, ap), d2_ = dot(ac, ap); if (d1 <= 0 && d2_ <= 0) return a;
  const bp = [p[0] - b[0], p[1] - b[1], p[2] - b[2]], d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2_; if (vc <= 0 && d1 >= 0 && d3 <= 0){ const v = d1 / (d1 - d3); return lerp3(a, b, v); }
  const cp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2_ - d1 * d6; if (vb <= 0 && d2_ >= 0 && d6 <= 0){ const w = d2_ / (d2_ - d6); return lerp3(a, c, w); }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0){ const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return lerp3(b, c, w); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}
// lay each guide onto the surface; averaged guides are also smoothed (strict ones keep their shape)
function layGuides(M, guides, L, h){
  const VG = new Grid(L); for (let v = 0; v < M.x.length; v++) if (M.vt[v].length) VG.add(v, M.x[v], M.y[v], M.z[v]);
  const out = [];
  for (const G of guides){
    let P = resample(G.pts, L * 0.25, G.closed);
    for (let pass = 0; pass < (G.strict ? 1 : 4); pass++){
      const Q = []; for (const p of P){ const c = closestOnMesh(M, VG, p, h * 3); if (c && c.d < h * 3) Q.push(c.p); else if (!G.closed) Q.push(null); }
      // keep the longest run that lies over the surface
      let best = [], cur = []; for (const q of Q){ if (q) cur.push(q); else { if (cur.length > best.length) best = cur; cur = []; } } if (cur.length > best.length) best = cur;
      P = best; if (P.length < 3) break;
      if (!G.strict) P = smoothPoly(P, 6, G.closed && P.length === Q.length);
    }
    if (P.length >= 3) out.push(makeCurve(P, G.closed && P.length > 6 && d2(P[0], P[P.length - 1]) < sq(L), false, G.tag));
  }
  return out;
}
// The flow field: at every vertex, a direction for the quads to run (four-way symmetric, so a line and the
// direction across it count the same) and how sure we are of it. It comes from the guides and the creases,
// blended smoothly with distance, so between guides the quads turn gradually from one to the next.
function flowField(M, sources, h){
  const S = []; for (const { C, w } of sources){ const P = C.pts, n = P.length;
    for (let i = 0; i < n; i++){ const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]); S.push({ p: P[i], t, w }); } }
  if (!S.length) return null;
  while (S.length > 2500){ for (let i = S.length - 1; i > 0; i -= 2) S.splice(i, 1); }
  const N = vertexNormals(M), nv = M.x.length, d1 = new Float64Array(nv * 3), conf = new Float64Array(nv), r2 = sq(h * 1.5);
  for (let v = 0; v < nv; v++){
    if (!M.vt[v].length) continue;
    const n = N[v], b1 = norm(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [0, -n[2], n[1]]), b2 = [n[1] * b1[2] - n[2] * b1[1], n[2] * b1[0] - n[0] * b1[2], n[0] * b1[1] - n[1] * b1[0]];
    let zr = 0, zi = 0, W = 0, near = 0;
    for (const q of S){ const dd = sq(q.p[0] - M.x[v]) + sq(q.p[1] - M.y[v]) + sq(q.p[2] - M.z[v]), w = q.w / sq(dd + r2);
      let c = dot(q.t, b1), s2 = dot(q.t, b2); const l = Math.hypot(c, s2); if (l < 0.2) continue; c /= l; s2 /= l;
      const c2 = c * c - s2 * s2, s2b = 2 * c * s2, c4 = c2 * c2 - s2b * s2b, s4 = 2 * c2 * s2b;   // angle × 4
      zr += w * c4; zi += w * s4; W += w; if (dd < sq(h * 4)) near += q.w; }
    if (W <= 0) continue;
    const a = Math.atan2(zi, zr) / 4, co = Math.cos(a), si = Math.sin(a);
    d1[3 * v] = co * b1[0] + si * b2[0]; d1[3 * v + 1] = co * b1[1] + si * b2[1]; d1[3 * v + 2] = co * b1[2] + si * b2[2];
    conf[v] = Math.min(1, Math.hypot(zr, zi) / W) * Math.min(1, near / 4);
  }
  return { d1, conf, N };
}
// flip an edge when the flipped one sits closer to the flow's directions (axis or 45° diagonal, as in a grid of squares split by diagonals)
function flowFlips(M, F){
  const E = M.edges(), N = vertexNormals(M);
  const grid = (v, e, n) => { const d = [F.d1[3 * v], F.d1[3 * v + 1], F.d1[3 * v + 2]], d2v = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
    const a = dot(e, d), b = dot(e, d2v), l = Math.hypot(a, b); if (l < 1e-12) return 0; const ang = Math.atan2(b, a); return Math.abs(Math.sin(4 * ang)); };   // 0 on axes and diagonals
  for (let i = 0; i < E.length; i += 2){
    const a = E[i], b = E[i + 1]; if (F.conf[a] < 0.1 || M.fe.has(M.ek(a, b))) continue;
    const ts = M.edgeTris(a, b); if (ts.length !== 2) continue;
    const c = M.T.slice(3 * ts[0], 3 * ts[0] + 3).find(v => v !== a && v !== b), d = M.T.slice(3 * ts[1], 3 * ts[1] + 3).find(v => v !== a && v !== b);
    if (c === undefined || d === undefined) continue;
    const e1 = norm([M.x[b] - M.x[a], M.y[b] - M.y[a], M.z[b] - M.z[a]]), e2 = norm([M.x[d] - M.x[c], M.y[d] - M.y[c], M.z[d] - M.z[c]]);
    if (grid(a, e2, N[a]) + 0.15 < grid(a, e1, N[a]) && angleAt(M, c, a, b) + angleAt(M, d, a, b) > Math.PI * 0.75) M.flip(a, b, 0.8);
  }
}
// how far an edge is from the flow's four directions: 0 lined up, 1 at 45°
function misalign(F, v, e, n){
  const d = [F.d1[3 * v], F.d1[3 * v + 1], F.d1[3 * v + 2]], d2v = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
  const a = dot(e, d), b = dot(e, d2v), l = Math.hypot(a, b); if (l < 1e-12) return 0;
  const c = a / l, s2 = b / l, c2 = c * c - s2 * s2, s2b = 2 * c * s2; return (1 - (c2 * c2 - s2b * s2b)) / 2;
}
// nudge a vertex so the edges around it line up with the flow (straight along it, across it, or on a 45° diagonal)
function alignTarget(M, F, v, n){
  const d = [F.d1[3 * v], F.d1[3 * v + 1], F.d1[3 * v + 2]], e2 = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
  let tx = 0, ty = 0, tz = 0, k = 0; const p = M.P(v), ring = M.nbrs(v);
  // grid spacing: sides of the squares are 1, their diagonals √2, so a grid turned 45° doesn't count as lined up
  let mean = 0; for (const w of ring) mean += Math.hypot(M.x[w] - p[0], M.y[w] - p[1], M.z[w] - p[2]); const side = mean / ring.length / 1.14;
  for (const w of ring){
    const e = [M.x[w] - p[0], M.y[w] - p[1], M.z[w] - p[2]], a = dot(e, d), b = dot(e, e2), l = Math.hypot(a, b); if (l < 1e-9) continue;
    const q = Math.round(Math.atan2(b, a) / (Math.PI / 4)), ang = q * (Math.PI / 4), len = 0.5 * l + 0.5 * side * (q & 1 ? Math.SQRT2 : 1), sa = Math.cos(ang) * len, sb = Math.sin(ang) * len;
    tx += M.x[w] - (sa * d[0] + sb * e2[0]); ty += M.y[w] - (sa * d[1] + sb * e2[1]); tz += M.z[w] - (sa * d[2] + sb * e2[2]); k++;
  }
  if (!k) return [0, 0, 0];
  let dx = tx / k - p[0], dy = ty / k - p[1], dz = tz / k - p[2]; const dn = dx * n[0] + dy * n[1] + dz * n[2];
  return [dx - dn * n[0], dy - dn * n[1], dz - dn * n[2]];
}

// ---------------- quads and subdivision
function quadify(M, curves, FL){
  M.compact();
  const T = M.T, nt = M.tdead.length, used = new Uint8Array(nt), cand = [];
  const E = M.edges();
  for (let i = 0; i < E.length; i += 2){
    const a = E[i], b = E[i + 1]; if (M.fe.has(M.ek(a, b))) continue;
    const ts = M.edgeTris(a, b); if (ts.length !== 2) continue;
    let [t1, t2] = ts; const opp = (t, p, q) => { const o = 3 * t; for (let k = 0; k < 3; k++) if (T[o + k] === p && T[o + (k + 1) % 3] === q) return T[o + (k + 2) % 3]; return -1; };
    let c = opp(t1, a, b); if (c < 0){ [t1, t2] = [t2, t1]; c = opp(t1, a, b); } const d = opp(t2, b, a); if (c < 0 || d < 0) continue;
    const q = [a, d, b, c]; let worst = 0;
    for (let k = 0; k < 4; k++){ const ang = angleAt(M, q[k], q[(k + 3) % 4], q[(k + 1) % 4]); worst = Math.max(worst, Math.abs(ang - Math.PI / 2)); }
    const n1 = norm(M.triN(t1)), n2 = norm(M.triN(t2)); if (dot(n1, n2) < 0.85) continue;
    let cost = worst;
    if (FL && FL.conf[a] > 0.05){ const nn = norm([n1[0] + n2[0], n1[1] + n2[1], n1[2] + n2[2]]); let m = 0;
      for (let k = 0; k < 4; k++){ const u = q[k], w = q[(k + 1) % 4]; m += misalign(FL, a, norm([M.x[w] - M.x[u], M.y[w] - M.y[u], M.z[w] - M.z[u]]), nn); }
      cost += 2.5 * FL.conf[a] * m / 4; }
    cand.push([cost, t1, t2, q, worst]);
  }
  cand.sort((p, q) => p[0] - q[0]);
  const F = [];
  for (const [, t1, t2, q, w] of cand){ if (w > 0.75 || used[t1] || used[t2]) continue; used[t1] = used[t2] = 1; F.push(q); }
  for (let t = 0; t < nt; t++) if (!used[t]) F.push([T[3 * t], T[3 * t + 1], T[3 * t + 2]]);
  const V = []; for (let v = 0; v < M.x.length; v++) V.push(M.x[v], M.y[v], M.z[v]);
  const sharp = new Set(); for (const [k, id] of M.fe) if (curves[id] && curves[id].sharp) sharp.add(k);
  return { V, F, sharp, feat: new Map(M.fe) };
}
function ek(a, b){ return a < b ? a * 2097152 + b : b * 2097152 + a; }
// Square up the quads: each quad pulls its corners toward the nearest square of the same size, turned to
// match the guide flow where there is one (or just its own best fit where there isn't). Vertices are then
// put back onto the fitted surface, so the shape doesn't change, only the layout of the quads on it.
function squareQuads(cage, M, flow, iters, L){
  const { V, F } = cage, nv = V.length / 3, fixed = new Uint8Array(nv);
  for (let v = 0; v < nv; v++) if (M.fc[v] >= 0) fixed[v] = 1;
  const eCount = new Map(); for (const f of F) for (let i = 0; i < f.length; i++){ const k = ek(f[i], f[(i + 1) % f.length]); eCount.set(k, (eCount.get(k) || 0) + 1); }
  for (const [k, c] of eCount) if (c === 1){ fixed[Math.floor(k / 2097152)] = 1; fixed[k % 2097152] = 1; }
  const VG = new Grid(L); for (let v = 0; v < M.x.length; v++) if (M.vt[v].length) VG.add(v, M.x[v], M.y[v], M.z[v]);
  const sum = new Float64Array(nv * 3), cnt = new Float64Array(nv);
  for (let it = 0; it < iters; it++){
    sum.fill(0); cnt.fill(0);
    for (const f of F){
      if (f.length !== 4) continue;
      const P = f.map(v => [V[3 * v], V[3 * v + 1], V[3 * v + 2]]), c = [0, 1, 2].map(k => (P[0][k] + P[1][k] + P[2][k] + P[3][k]) / 4);
      const n = norm(cross3([0, 0, 0], [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]], [P[3][0] - P[1][0], P[3][1] - P[1][1], P[3][2] - P[1][2]]));
      const u = norm(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [0, -n[2], n[1]]), w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      const q = P.map(p => { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; return [dot(d, u), dot(d, w)]; });
      // best rotation of a square onto these corners (corner k sits at φ + k·90°)
      let sn = 0, cs = 0, r2 = 0; q.forEach(([a, b], k) => { const t = k * Math.PI / 2, ct = Math.cos(t), st = Math.sin(t); cs += a * ct + b * st; sn += b * ct - a * st; r2 += a * a + b * b; });
      let phi = Math.atan2(sn, cs); const r = Math.sqrt(r2 / 4);
      const conf = flow ? Math.max(flow.conf[f[0]], flow.conf[f[1]], flow.conf[f[2]], flow.conf[f[3]]) : 0;
      if (conf > 0.05){
        const v0 = f.reduce((b, v) => flow.conf[v] > flow.conf[b] ? v : b, f[0]), d = [flow.d1[3 * v0], flow.d1[3 * v0 + 1], flow.d1[3 * v0 + 2]];
        const fa = Math.atan2(dot(d, w), dot(d, u)) + Math.PI / 4;           // corners sit 45° off the edge directions
        let best = fa, bd = Infinity; for (let m = -4; m <= 4; m++){ const t = fa + m * Math.PI / 2, dd = Math.abs(Math.atan2(Math.sin(t - phi), Math.cos(t - phi))); if (dd < bd){ bd = dd; best = t; } }
        const dlt = Math.atan2(Math.sin(best - phi), Math.cos(best - phi)); phi += dlt * conf;
      }
      f.forEach((v, k) => { const t = phi + k * Math.PI / 2, a = r * Math.cos(t), b = r * Math.sin(t);
        sum[3 * v] += c[0] + a * u[0] + b * w[0]; sum[3 * v + 1] += c[1] + a * u[1] + b * w[1]; sum[3 * v + 2] += c[2] + a * u[2] + b * w[2]; cnt[v]++; });
    }
    for (let v = 0; v < nv; v++){
      if (fixed[v] || !cnt[v]) continue;
      const t = [sum[3 * v] / cnt[v], sum[3 * v + 1] / cnt[v], sum[3 * v + 2] / cnt[v]], p = [V[3 * v] + (t[0] - V[3 * v]) * 0.5, V[3 * v + 1] + (t[1] - V[3 * v + 1]) * 0.5, V[3 * v + 2] + (t[2] - V[3 * v + 2]) * 0.5];
      const on = closestOnMesh(M, VG, p, L * 3); const q = on ? on.p : p; V[3 * v] = q[0]; V[3 * v + 1] = q[1]; V[3 * v + 2] = q[2];
    }
  }
}
function catmullClark({ V, F, sharp, feat }, curves){
  const nv = V.length / 3, eid = new Map(), E = [];
  F.forEach((f, fi) => { for (let i = 0; i < f.length; i++){ const a = f[i], b = f[(i + 1) % f.length], k = ek(a, b); let e = eid.get(k); if (e === undefined){ e = E.length; eid.set(k, e); E.push({ a, b, f: [] }); } E[e].f.push(fi); } });
  const ne = E.length, nf = F.length, out = new Float64Array((nv + ne + nf) * 3);
  const FP = F.map(f => { const c = [0, 0, 0]; for (const v of f){ c[0] += V[3 * v]; c[1] += V[3 * v + 1]; c[2] += V[3 * v + 2]; } return c.map(x => x / f.length); });
  FP.forEach((c, i) => out.set(c, (nv + ne + i) * 3));
  E.forEach((e, i) => { const k = ek(e.a, e.b); e.crease = e.f.length !== 2 || sharp.has(k); e.sharp = sharp.has(k);
    const m = [0, 1, 2].map(c => (V[3 * e.a + c] + V[3 * e.b + c]) / 2);
    const p = e.crease ? m : [0, 1, 2].map(c => (V[3 * e.a + c] + V[3 * e.b + c] + FP[e.f[0]][c] + FP[e.f[1]][c]) / 4);
    out.set(p, (nv + i) * 3); });
  const vf = Array.from({ length: nv }, () => []), ve = Array.from({ length: nv }, () => []);
  F.forEach((f, fi) => f.forEach(v => vf[v].push(fi))); E.forEach((e, i) => { ve[e.a].push(i); ve[e.b].push(i); });
  for (let v = 0; v < nv; v++){
    const P = [V[3 * v], V[3 * v + 1], V[3 * v + 2]], cr = ve[v].filter(i => E[i].crease);
    let q = P;
    if (!ve[v].length){ q = P; }
    else if (cr.length < 2){ const n = ve[v].length, Fa = [0, 0, 0], Ra = [0, 0, 0];
      for (const fi of vf[v]) for (let c = 0; c < 3; c++) Fa[c] += FP[fi][c] / vf[v].length;
      for (const i of ve[v]){ const e = E[i]; for (let c = 0; c < 3; c++) Ra[c] += (V[3 * e.a + c] + V[3 * e.b + c]) / 2 / n; }
      q = [0, 1, 2].map(c => (Fa[c] + 2 * Ra[c] + (n - 3) * P[c]) / n); }
    else if (cr.length === 2){ const o = cr.map(i => E[i].a === v ? E[i].b : E[i].a); q = [0, 1, 2].map(c => (6 * P[c] + V[3 * o[0] + c] + V[3 * o[1] + c]) / 8); }
    out.set(q, v * 3);
  }
  const NF = [], NS = new Set();
  F.forEach((f, fi) => { const n = f.length; for (let i = 0; i < n; i++){ const a = f[i], b = f[(i + 1) % n], z = f[(i - 1 + n) % n];
    NF.push([a, nv + eid.get(ek(a, b)), nv + ne + fi, nv + eid.get(ek(z, a))]); } });
  E.forEach((e, i) => { if (e.sharp){ NS.add(ek(e.a, nv + i)); NS.add(ek(nv + i, e.b)); } });
  // curve edges carry their curve down to the finer level; points on strict lines go back exactly onto them
  const NFt = new Map();
  if (feat) E.forEach((e, i) => { const id = feat.get(ek(e.a, e.b)); if (id === undefined) return; NFt.set(ek(e.a, nv + i), id); NFt.set(ek(nv + i, e.b), id);
    const C = curves && curves[id]; if (C && C.strict) for (const v of [e.a, nv + i, e.b]){ const q = closestOnPoly(C, [out[3 * v], out[3 * v + 1], out[3 * v + 2]]); if (q.d2 < 1) out.set(q.p, 3 * v); } });
  return { V: Array.from(out), F: NF, sharp: NS, feat: NFt };
}
// triangles for drawing, with normals that stay smooth except across sharp creases
function shade({ V, F, sharp }){
  const nv = V.length / 3, fn = F.map(f => { const a = f[0], b = f[1], c = f[2], d = f[3] !== undefined ? f[3] : f[0];
    const u = [V[3 * c] - V[3 * a], V[3 * c + 1] - V[3 * a + 1], V[3 * c + 2] - V[3 * a + 2]], w = [V[3 * d] - V[3 * b], V[3 * d + 1] - V[3 * b + 1], V[3 * d + 2] - V[3 * b + 2]];
    if (f.length === 3){ const x = [V[3 * b] - V[3 * a], V[3 * b + 1] - V[3 * a + 1], V[3 * b + 2] - V[3 * a + 2]]; return [x[1] * u[2] - x[2] * u[1], x[2] * u[0] - x[0] * u[2], x[0] * u[1] - x[1] * u[0]]; }
    return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; });
  const vf = Array.from({ length: nv }, () => []); F.forEach((f, fi) => f.forEach(v => vf[v].push(fi)));
  const cornerN = new Map();
  for (let v = 0; v < nv; v++){
    const fs = vf[v], par = new Map(fs.map(f => [f, f])), find = f => par.get(f) === f ? f : find(par.get(f));
    const byEdge = new Map();
    for (const fi of fs){ const f = F[fi], i = f.indexOf(v), n = f.length; for (const w of [f[(i + 1) % n], f[(i - 1 + n) % n]]){ const k = ek(v, w); if (sharp.has(k)) continue; if (byEdge.has(k)) par.set(find(fi), find(byEdge.get(k))); else byEdge.set(k, fi); } }
    const sum = new Map(); for (const fi of fs){ const r = find(fi); const s = sum.get(r) || [0, 0, 0]; s[0] += fn[fi][0]; s[1] += fn[fi][1]; s[2] += fn[fi][2]; sum.set(r, s); }
    for (const fi of fs) cornerN.set(fi * 4 + F[fi].indexOf(v), norm(sum.get(find(fi))));
  }
  let nt = 0; for (const f of F) nt += f.length - 2;
  const pos = new Float32Array(nt * 9), nrm = new Float32Array(nt * 9); let o = 0;
  F.forEach((f, fi) => { for (let k = 1; k < f.length - 1; k++) for (const i of [0, k, k + 1]){ const v = f[i]; pos.set([V[3 * v], V[3 * v + 1], V[3 * v + 2]], o); nrm.set(cornerN.get(fi * 4 + i), o); o += 3; } });
  return { pos, nrm };
}
function wire({ V, F }){
  const seen = new Set(), seg = [];
  for (const f of F) for (let i = 0; i < f.length; i++){ const a = f[i], b = f[(i + 1) % f.length], k = ek(a, b); if (seen.has(k)) continue; seen.add(k); seg.push(V[3 * a], V[3 * a + 1], V[3 * a + 2], V[3 * b], V[3 * b + 1], V[3 * b + 2]); }
  return new Float32Array(seg);
}
function creaseLines({ V, sharp }){
  const seg = []; for (const k of sharp){ const a = Math.floor(k / 2097152), b = k % 2097152; seg.push(V[3 * a], V[3 * a + 1], V[3 * a + 2], V[3 * b], V[3 * b + 1], V[3 * b + 2]); }
  return new Float32Array(seg);
}

// ---------------------------------------------------------------- the whole thing
// strokes: [{ tag, pts: [x,y,z, x,y,z, ...] }]   (park metres, y up)
//   tag 0 loose · 1 guide (averaged) · 2 strict guide (exact) · 3 crease (averaged, sharp) · 4 strict crease (exact, sharp)
// guides (tags 1, 2) steer the quad flow and the Relax direction; they don't pull the surface
// prm: { detail, avg, lines, fair (0..1), reach, group, subd, relax (0..10), dabs }
function solve(strokes, prm, progress = () => {}){
  const L = Math.max(0.05, prm.detail), h = Math.max(prm.avg, L * 1.1), g = Math.max(prm.group, L * 0.5);
  const toPts = s => { const a = []; for (let i = 0; i + 2 < s.pts.length; i += 3) a.push([s.pts[i], s.pts[i + 1], s.pts[i + 2]]); return a; };
  const byTag = [[], [], [], [], []];
  for (const s of strokes){ const p = toPts(s), t = Math.min(4, s.tag || 0); if (p.length < 2) continue;
    if (t === 0) byTag[0].push(p); else for (const q of sliceLoops(p, g * 0.6, Math.max(g * 5, L * 4))) byTag[t].push(q); }
  progress(0.02, 'Finding the guide and crease lines');
  // Creases shape the surface (strict ones first, so they get cut in first and the averaged ones fit around them).
  // Guides don't compete with the loose lines: they're laid onto the surface afterwards and steer the quads.
  const curves = [...strictCurves(byTag[4], L, true, 4), ...consensus(byTag[3], g, L * 0.5, true, 3)];
  const guides0 = [...strictCurves(byTag[2], L, false, 2), ...consensus(byTag[1], g, L * 0.5, false, 1)];
  const samples = [];
  const ds = Math.min(L, h) / 3;
  byTag[0].forEach((s, i) => { for (const p of resample(s, ds, false)) samples.push({ p, w: 1, sid: i }); });
  // guides only fill in where there are no loose lines at all (a whisper of weight, and they don't count as strokes)
  guides0.forEach(G => { for (const p of resample(G.pts, ds, G.closed)) samples.push({ p, w: 0.04, guide: true }); });
  curves.forEach((C, i) => { for (const p of resample(C.pts, ds, C.closed)) samples.push({ p, w: C.strict ? 6 : 3, curve: true, sid: -1 - i }); });
  if (samples.length < 6) return { empty: true, curves: [...curves, ...guides0].map(C => ({ tag: C.tag, closed: C.closed, pts: C.pts.flat() })) };
  progress(0.08, 'Laying out the sheet');
  const aA = Math.max(L * 2, h * 0.9);
  const M = startSheet(samples, aA, prm.reach, h);
  if (!M.tdead.length) return { empty: true, curves: [] };
  const paint = makePaint(prm.dabs);
  const base = { paint, fair: prm.fair, reach2: Math.max(h * 2, L * 3), step: 0.8, relax: 0.6, lines: Math.max(1, prm.lines | 0 || 4), grow: 2.4, robust: prm.robust !== false };
  // coarse fit
  for (let it = 0; it < 6; it++){
    remesh(M, aA, 0.6);
    fitStep(M, samples, curves, { ...base, L: aA, h: h * 1.5, hn: h * 4, maxStep: aA * 1.5, parity: it & 1, reach2: h * 4 });
    if (prm.onStep) prm.onStep(M, "coarse", it); progress(0.1 + 0.25 * it / 6, 'Fitting the rough shape');
  }
  // fine fit, no curves yet
  for (let it = 0; it < 3; it++){
    remesh(M, L, 0.7);
    fitStep(M, samples, curves, { ...base, L, h, hn: h * 2.5, maxStep: L * 1.2, parity: it & 1, reach2: h * 2.5 });
    if (prm.onStep) prm.onStep(M, "fine", it); progress(0.35 + 0.2 * it / 3, 'Fitting the detail');
  }
  // lay the guides on the surface found so far, and work out the flow they ask for
  M.compact();
  const guides = layGuides(M, guides0, L, h);
  let flow = guides.length ? flowField(M, [...guides.map(C => ({ C, w: 1 })), ...curves.map(C => ({ C, w: 0.6 }))], h) : null;
  M.strictIds = new Set(curves.map((C, i) => C.strict ? i : -1).filter(i => i >= 0));
  curves.forEach((C, i) => embedCurve(M, C, i, L));
  untangle(M, 4);
  for (let it = 0; it < 8; it++){
    remesh(M, L, 0.8);
    if (it < 3) untangle(M, 2);
    if (guides.length) flow = flowField(M, [...guides.map(C => ({ C, w: 1 })), ...curves.map(C => ({ C, w: 0.6 }))], h);
    fitStep(M, samples, curves, { ...base, flow, L, h, hn: h * 1.8, maxStep: L * 0.8, parity: it & 1, reach2: h * 2.2 });
    unfold(M, 3);
    if (prm.onStep) prm.onStep(M, "crease", it); progress(0.55 + 0.35 * it / 8, 'Sharpening the creases');
  }
  // last pass: settle without new splits so every vertex has been fitted
  fitStep(M, samples, curves, { ...base, L, h, hn: h * 1.8, maxStep: L * 0.8, parity: 0, reach2: h * 2.2 });
  if (paint){
    // painted areas get relaxed directly too (alternating shrink/grow steps, so they don't sink)
    for (let it = 0; it < 24; it++){
      const nx = M.x.slice(), ny = M.y.slice(), nz = M.z.slice(), lam = it & 1 ? -0.53 : 0.5;
      for (let v = 0; v < M.x.length; v++){
        if (M.fc[v] >= 0 || !M.vt[v].length) continue;
        const m = paint(M.x[v], M.y[v], M.z[v]); if (!m) continue;
        const ring = M.nbrs(v), bn = ring.filter(w => M.edgeTris(v, w).length === 1), use = bn.length === 2 ? bn : bn.length ? null : ring; if (!use) continue;
        let cx = 0, cy = 0, cz = 0; for (const w of use){ cx += M.x[w]; cy += M.y[w]; cz += M.z[w]; }
        nx[v] += (cx / use.length - M.x[v]) * lam * m; ny[v] += (cy / use.length - M.y[v]) * lam * m; nz[v] += (cz / use.length - M.z[v]) * lam * m;
      }
      M.x = nx; M.y = ny; M.z = nz;
    }
  }
  progress(0.9, 'Smoothing out folds');
  M.compact();
  if (guides.length){
    flow = flowField(M, [...guides.map(C => ({ C, w: 1 })), ...curves.map(C => ({ C, w: 0.6 }))], h);
    // comb the mesh along the flow: slide vertices over the surface until their edges line up with it
    progress(0.9, 'Lining up with the guides');
    for (let it = 0; it < (prm.alignIters ?? 14); it++){
      const N = vertexNormals(M), nx = M.x.slice(), ny = M.y.slice(), nz = M.z.slice();
      for (let v = 0; v < M.x.length; v++){
        if (M.fc[v] >= 0 || !M.vt[v].length || flow.conf[v] < 0.05 || M.isBV(v)) continue;
        const a = alignTarget(M, flow, v, N[v]), k = 0.6 * flow.conf[v]; nx[v] += a[0] * k; ny[v] += a[1] * k; nz[v] += a[2] * k;
      }
      M.x = nx; M.y = ny; M.z = nz;
      if (it % 4 === 3) unfold(M, 2);
    }
    // a light flip pass that prefers edges along the flow, then re-measure the flow on the combed mesh
    flowFlips(M, flow);
    M.compact();
    flow = flowField(M, [...guides.map(C => ({ C, w: 1 })), ...curves.map(C => ({ C, w: 0.6 }))], h);
  }
  if (prm.relax > 0){ progress(0.91, 'Relaxing'); relaxMesh(M, Math.round(prm.relax * prm.relax * 0.8 + prm.relax * 2), flow); }
  const folds = unfold(M, 25);
  progress(0.93, 'Making quads');
  const cage = quadify(M, curves, flow);
  progress(0.95, 'Squaring up the quads');
  squareQuads(cage, M, flow, prm.squareIters ?? 32, L);
  const quads = catmullClark(cage, curves);
  let smooth = quads; for (let i = 0; i < (prm.subd | 0); i++) smooth = catmullClark(smooth, curves);
  const sh = shade(smooth);
  if (paint){ sh.paint = new Float32Array(sh.pos.length / 3); for (let i = 0; i < sh.paint.length; i++) sh.paint[i] = paint(sh.pos[3 * i], sh.pos[3 * i + 1], sh.pos[3 * i + 2]); }
  progress(1, 'Done');
  return {
    surface: sh, quadWire: wire(quads), fineWire: smooth === quads ? null : wire(smooth), creases: creaseLines(smooth),
    quads: { V: new Float32Array(quads.V), F: new Int32Array(quads.F.flat()) },
    curves: [...curves.map(C => ({ tag: C.tag, closed: C.closed, strict: !!C.strict, pts: C.pts.flat() })),
      ...guides.map(C => ({ tag: C.tag, closed: C.closed, guide: true, pts: C.pts.flat() }))],
    nQuads: quads.F.length, folds
  };
}

const api = { solve, consensus, resample, catmullClark, sliceLoops };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.PentimentoSolver = api;
// as a Web Worker: build in the background so the headset never stalls
if (typeof importScripts === 'function' && typeof window === 'undefined'){
  self.onmessage = e => {
    const { id, strokes, prm } = e.data;
    try {
      let last = 0;
      const r = solve(strokes, prm, (p, msg) => { const now = Date.now(); if (now - last > 120 || p >= 1){ last = now; self.postMessage({ type: 'progress', id, p, msg }); } });
      const tr = r.surface ? [...(r.surface.paint ? [r.surface.paint.buffer] : []), r.surface.pos.buffer, r.surface.nrm.buffer, r.quadWire.buffer, ...(r.fineWire ? [r.fineWire.buffer] : []), r.creases.buffer, r.quads.V.buffer, r.quads.F.buffer] : [];
      self.postMessage({ type: 'done', id, r }, tr);
    } catch (err){ self.postMessage({ type: 'error', id, msg: String((err && err.message) || err) }); }
  };
}
})(typeof self !== 'undefined' ? self : globalThis);
