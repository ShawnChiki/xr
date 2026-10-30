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
    const C = makeCurve(resample(closed ? s.slice(0, -1) : s, L * 0.25, closed), closed, sharp, tag); C.strict = true; C.user = s.corners || []; return C;
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
  clone(){ const M = new Mesh(); M.x = this.x.slice(); M.y = this.y.slice(); M.z = this.z.slice(); M.vt = this.vt.map(a => a.slice()); M.dead = this.dead.slice();
    M.fc = this.fc.slice(); M.corner = this.corner.slice(); M.T = this.T.slice(); M.tdead = this.tdead.slice(); M.fe = new Map(this.fe); M.strictIds = this.strictIds; return M; }
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
// ---------------- the two sides of a sharp crease
// Lines drawn on either side of a crease (the two walls of a spine, the deck and the bank at a lip) must never be
// averaged together. Around each crease, the loose lines nearby fall into two fans (one per sheet that meets
// there); every sample near the crease is labelled with its fan, a whole stroke votes so the bits right at the
// crease follow the rest of their stroke, and while fitting each vertex only listens to samples on its own side.
function creaseSides(curves, samples, h, L){
  const rho = Math.max(h * 2.5, 0.9), ds = L * 0.5, pts = [], G = new Grid(Math.max(ds * 2, 0.2));
  curves.forEach((C, cid) => { if (!C.sharp) return; const P = resample(C.pts, ds, C.closed), n = P.length; if (n < 3) return;
    let e1 = null; const base = pts.length;
    for (let j = 0; j < n; j++){ const a = P[C.closed ? (j - 1 + n) % n : Math.max(0, j - 1)], b = P[C.closed ? (j + 1) % n : Math.min(n - 1, j + 1)], t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      if (!e1) e1 = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const k = dot(e1, t); e1 = norm([e1[0] - k * t[0], e1[1] - k * t[1], e1[2] - k * t[2]]);
      const e2 = [t[1] * e1[2] - t[2] * e1[1], t[2] * e1[0] - t[0] * e1[2], t[0] * e1[1] - t[1] * e1[0]];
      pts.push({ cid, j, p: P[j], t, e1, e2, psi: null, idx: base + j, n }); G.add(pts.length - 1, P[j][0], P[j][1], P[j][2]); } });
  if (!pts.length) return null;
  const near = q => { let bi = -1, bd = rho * rho; G.each(q[0], q[1], q[2], rho, i => { const d = d2(pts[i].p, q); if (d < bd){ bd = d; bi = i; } }); if (bi < 0) return null;
    const c = pts[bi], d = [q[0] - c.p[0], q[1] - c.p[1], q[2] - c.p[2]], k = dot(d, c.t), pd = [d[0] - k * c.t[0], d[1] - k * c.t[1], d[2] - k * c.t[2]], r = Math.hypot(...pd);
    return { c, r, phi: Math.atan2(dot(pd, c.e2), dot(pd, c.e1)) }; };
  // where each loose sample sits around its nearest crease
  const info = new Array(samples.length).fill(null);
  samples.forEach((sm, k) => { if (sm.curve || sm.guide) return; const m = near(sm.p); if (m && m.r > L * 0.15) info[k] = m; });
  // per crease point: split the nearby directions into two fans (only samples far enough out to have a clear direction)
  const byC = new Map(); info.forEach((m, k) => { if (!m || m.r < Math.min(0.25, h * 0.5)) return; const key = m.c.cid; (byC.get(key) || byC.set(key, []).get(key)).push(m); });
  const win = Math.max(3, Math.round(1.2 / ds));
  for (const [cid, list] of byC){
    const cp = pts.filter(c => c.cid === cid); let prev = null;
    for (const c of cp){
      const W = list.filter(m => Math.abs(m.c.j - c.j) <= win || (m.c.n === c.n && Math.abs(m.c.j - c.j) >= c.n - win && C_closed(curves[cid])));
      if (W.length < 12){ c.psi = prev; continue; }
      let best = null;
      for (let q = 0; q < 36; q++){ const psi = q * Math.PI / 18, r = [[0, 0, 0, 0], [0, 0, 0, 0]];
        for (const m of W){ const sd = Math.sin(m.phi - psi) >= 0 ? 0 : 1, w = Math.min(1, m.r / rho * 2); r[sd][0] += Math.cos(m.phi) * w; r[sd][1] += Math.sin(m.phi) * w; r[sd][2] += w; r[sd][3]++; }
        const sc = Math.hypot(r[0][0], r[0][1]) + Math.hypot(r[1][0], r[1][1]); if (!best || sc > best.sc) best = { psi, sc, r }; }
      // two real fans: both have weight, and they point clearly apart
      const [a, b] = best.r, wa = a[2], wb = b[2], ma = Math.atan2(a[1], a[0]), mb = Math.atan2(b[1], b[0]);
      const spread = (Math.hypot(a[0], a[1]) + Math.hypot(b[0], b[1])) / (wa + wb), apart = Math.acos(Math.max(-1, Math.min(1, Math.cos(ma - mb))));
      if (Math.min(wa, wb) < 0.15 * (wa + wb) || apart < 0.35 || spread < 0.8){ c.psi = null; continue; }
      // the split line runs between the two fans' middles; keep it continuous along the crease so sides don't swap
      let psi = Math.atan2(Math.sin(ma) + Math.sin(mb), Math.cos(ma) + Math.cos(mb));                     // the split line runs along the bisector
      if (Math.sin(ma - psi) < 0) psi += Math.PI;                                                         // side 0 = fan a
      if (prev !== null && Math.cos(psi - prev) < 0) psi += Math.PI;
      c.psi = psi; prev = psi;
    }
  }
  const sideOf = m => { if (!m || m.c.psi === null) return -1; return Math.sin(m.phi - m.c.psi) >= 0 ? 0 : 1; };
  // label the samples; a stroke votes for the bits of it right at the crease
  const votes = new Map();
  samples.forEach((sm, k) => { const m = info[k], sd = sideOf(m); if (sd < 0) return; sm.scid = m.c.cid; sm.side = sd;
    if (m.r > Math.min(0.25, h * 0.5)){ const key = sm.sid + ':' + m.c.cid, v = votes.get(key) || [0, 0]; v[sd]++; votes.set(key, v); } });
  samples.forEach((sm, k) => { const m = info[k]; if (sm.side === undefined || m.r > Math.min(0.25, h * 0.5)) return; const v = votes.get(sm.sid + ':' + sm.scid); if (!v) return;
    const tot = v[0] + v[1]; if (v[0] > 0.8 * tot) sm.side = 0; else if (v[1] > 0.8 * tot) sm.side = 1; });
  return { near, sideOf, rho };
}
const C_closed = C => !!(C && C.closed);
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
  // which side of a sharp crease each vertex is on (vertices right on a crease listen to both)
  const vsd = new Int8Array(nv).fill(-1), vsc = new Int32Array(nv).fill(-1);
  if (o.sides) for (let v = 0; v < nv; v++){ if (!M.vt[v].length || M.fc[v] >= 0) continue; const m = o.sides.near(M.P(v)); if (!m || m.r < o.L * 0.3) continue; const sd = o.sides.sideOf(m); if (sd >= 0){ vsd[v] = sd; vsc[v] = m.c.cid; } }
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
        if (s.side !== undefined && vsc[v] === s.scid && vsd[v] !== s.side) continue;      // the other side of a crease
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
    // a crease is a fold on purpose: normals aren't averaged across one, and faces touching one aren't judged
    const N = vertexNormals(M), nv = M.x.length, SN = N.map((n, v) => { const s = n.slice(); if (M.fc[v] < 0) for (const w of M.nbrs(v)){ if (M.fc[w] >= 0) continue; s[0] += N[w][0]; s[1] += N[w][1]; s[2] += N[w][2]; } return norm(s); });
    const bad = new Set();
    for (let t = 0; t < M.tdead.length; t++){ if (M.tdead[t]) continue; const n = norm(M.triN(t));
      if (M.fc[M.T[3 * t]] >= 0 || M.fc[M.T[3 * t + 1]] >= 0 || M.fc[M.T[3 * t + 2]] >= 0) continue;
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
function embedCurve(M, C, id, L, cross){
  const S = resample(C.pts, L * 0.35, C.closed); if (S.length < 2) return 0;
  // a strict crease the sheet hasn't reached yet (the thin top of a spine, rounded off by the first fit):
  // pull the nearest bit of sheet up to it first, gently, a few times, so the crease can be cut in along its length
  if (C.sharp && C.strict && !cross){
    const Q = resample(C.pts, L * 0.5, C.closed), R0 = Math.max(L * 1.6, L * 4);
    for (let pass = 0; pass < 6; pass++){
      const G0 = new Grid(L); for (let v = 0; v < M.x.length; v++) if (M.vt[v].length) G0.add(v, M.x[v], M.y[v], M.z[v]);
      let far = 0; const mv = new Map();
      for (const q of Q){ let bv = -1, bd = R0 * R0; G0.each(q[0], q[1], q[2], R0, v => { const dd = d2(M.P(v), q); if (dd < bd){ bd = dd; bv = v; } });
        if (bv < 0 || bd < sq(Math.max(L * 0.6, 0.12)) || M.fc[bv] >= 0) continue; far++;
        const ring1 = M.nbrs(bv), add = (v, w) => { const o = mv.get(v) || [0, 0, 0, 0]; o[0] += (q[0] - M.x[v]) * w; o[1] += (q[1] - M.y[v]) * w; o[2] += (q[2] - M.z[v]) * w; o[3] += w; mv.set(v, o); };
        add(bv, 1); for (const w of ring1) add(w, 0.45); }
      if (!far) break;
      for (const [v, o] of mv){ if (M.fc[v] >= 0) continue; const k = 0.55 / Math.max(1, o[3]); M.x[v] += o[0] * k; M.y[v] += o[1] * k; M.z[v] += o[2] * k; }
    }
  }
  const VG = new Grid(L); for (let v = 0; v < M.x.length; v++) if (M.vt[v].length) VG.add(v, M.x[v], M.y[v], M.z[v]);
  // a sharp crease reaches further for the sheet: where the surface rounded off below a thin top (a spine),
  // the crease still gets cut in and pulls the sheet up to it
  const RR = C.sharp && !cross ? L * 4 : L * 1.6;
  const near = p => { let best = -1, bd = sq(RR); VG.each(p[0], p[1], p[2], RR, v => { const dd = sq(M.x[v] - p[0]) + sq(M.y[v] - p[1]) + sq(M.z[v] - p[2]); if (dd < bd){ bd = dd; best = v; } }); return best; };
  // runs of curve samples that lie over the mesh
  const runs = []; let cur = [];
  for (const p of S){ const v = near(p); if (v < 0){ if (cur.length) runs.push(cur); cur = []; continue; } if (cur[cur.length - 1] !== v) cur.push(v); }
  if (cur.length) runs.push(cur);
  if (C.closed && runs.length === 1 && runs[0].length > 3) runs[0].push(runs[0][0]);
  let added = 0;
  for (const run of runs){
    if (run.length < 2) continue;
    const paths = []; let path = [run[0]];
    for (let i = 1; i < run.length; i++){
      const u = path[path.length - 1], w = run[i]; if (u === w) continue;
      const sp = shortestPath(M, u, w, L * (cross ? 10 : 4), cross);
      if (!sp){ if (path.length > 1) paths.push(path); path = [w]; continue; }   // a line that can't get through picks up again past the gap
      for (let k = 1; k < sp.length; k++) path.push(sp[k]);
    }
    paths.push(path);
    for (const path of paths){
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
        if (M.fc[v] >= 0 && M.fc[v] !== id){ if (cross) (M.cross || (M.cross = new Set())).add(v); else M.corner[v] = true; continue; }
        M.setP(v, q); M.fc[v] = id;
      }
      for (let i = 0; i < (closed ? n : n - 1); i++){ const a = clean[i], b = clean[(i + 1) % n]; if (!M.fe.has(M.ek(a, b))) M.fe.set(M.ek(a, b), id); }
      if (!closed){ M.corner[clean[0]] = true; M.corner[clean[n - 1]] = true; }
      // the line's own sharp corners pin the nearest chain vertex, exactly on the corner
      for (const cp of (C.corners || [])){ let bv = -1, bd = sq(L * 1.2); for (const v of clean){ const dd = d2(M.P(v), cp); if (dd < bd){ bd = dd; bv = v; } } if (bv >= 0){ M.setP(bv, cp); M.corner[bv] = true; } }
      added += n;
    }
  }
  return added;
}
// sharp corners of a line: where it turns more than ~40° within a short stretch
function curveCorners(C, L){
  const P = resample(C.pts, L * 0.08, C.closed), n = P.length, k = Math.max(2, Math.round(0.5 / 0.08 / 2)); if (n < 2 * k + 1) return [];
  const at = i => P[C.closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];
  const T = P.map((p, i) => { if (!C.closed && (i < k || i >= n - k)) return 0; const a = at(i - k), c = at(i + k); return Math.acos(Math.max(-1, Math.min(1, dot(norm([p[0] - a[0], p[1] - a[1], p[2] - a[2]]), norm([c[0] - p[0], c[1] - p[1], c[2] - p[2]]))))); });
  const out = []; for (let i = 0; i < n; i++){ if (T[i] < 0.7) continue; let mx = true; for (let j = -k; j <= k; j++){ const q = C.closed ? ((i + j) % n + n) % n : i + j; if (q >= 0 && q < n && T[q] > T[i]) mx = false; } if (mx) out.push(P[i]); }
  return out;
}
function markTurns(M, chain, closed, L){
  const n = chain.length; if (n < 3) return;
  const at = i => chain[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];
  const turn = i => { const a = M.P(at(i - 1)), b = M.P(at(i)), c = M.P(at(i + 1)); return Math.acos(Math.max(-1, Math.min(1, dot(norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), norm([c[0] - b[0], c[1] - b[1], c[2] - b[2]]))))); };
  const T = []; for (let i = 0; i < n; i++) T.push(!closed && (i === 0 || i === n - 1) ? 0 : turn(i));
  for (let i = 0; i < n; i++){ if (T[i] < 0.6) continue; const l = T[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], r = T[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]; if (T[i] >= l && T[i] >= r) M.corner[chain[i]] = true; }
}
function shortestPath(M, src, dst, maxLen, cross){
  const dist = new Map([[src, 0]]), prev = new Map(), open = [src], done = new Set();
  const goal = M.P(dst), h = v => Math.sqrt(sq(M.x[v] - goal[0]) + sq(M.y[v] - goal[1]) + sq(M.z[v] - goal[2]));
  let guard = 0;
  while (open.length && guard++ < (cross ? 4000 : 600)){
    let bi = 0; for (let i = 1; i < open.length; i++) if (dist.get(open[i]) + h(open[i]) < dist.get(open[bi]) + h(open[bi])) bi = i;
    const u = open[bi]; open.splice(bi, 1); if (u === dst) break; if (done.has(u)) continue; done.add(u);
    if (dist.get(u) > maxLen) continue;
    for (const w of M.nbrs(u)){
      if (M.fe.has(M.ek(u, w))) continue;          // don't run along another curve
      if (w !== dst && M.fc[w] >= 0 && !cross) continue;       // or through it (unless crossings are wanted)
      const nd = dist.get(u) + Math.sqrt(M.len2(u, w));
      if (!dist.has(w) || nd < dist.get(w)){ dist.set(w, nd); prev.set(w, u); open.push(w); }
    }
  }
  if (!prev.has(dst)) return null;
  const path = [dst]; while (path[path.length - 1] !== src) path.push(prev.get(path[path.length - 1]));
  return path.reverse();
}

// ---------------- edges (green lines): where the surface ends
// The sheet is cut along every edge line; pieces on the far side (where few loose lines are) are removed.
function cutAtEdges(M, curves, samples, h){
  const ids = new Set(); curves.forEach((C, i) => { if (C.edge) ids.add(i); }); if (!ids.size) return 0;
  M.compact();
  const nt = M.tdead.length, comp = new Int32Array(nt).fill(-1), T = M.T; let nc = 0;
  for (let t = 0; t < nt; t++){ if (comp[t] >= 0) continue; const st = [t]; comp[t] = nc;
    while (st.length){ const u = st.pop(); for (let k = 0; k < 3; k++){ const a = T[3 * u + k], b = T[3 * u + (k + 1) % 3]; if (ids.has(M.fe.get(M.ek(a, b)))) continue;
      for (const t2 of M.edgeTris(a, b)) if (comp[t2] < 0){ comp[t2] = nc; st.push(t2); } } }
    nc++; }
  if (nc < 2) return 0;
  // how many loose-line samples sit near each piece, per unit of area
  const G = new Grid(h); samples.forEach((q, i) => { if (!q.curve && !q.guide) G.add(i, q.p[0], q.p[1], q.p[2]); });
  const dens = new Float64Array(nc), area = new Float64Array(nc), edgeT = new Uint8Array(nc);
  for (let t = 0; t < nt; t++){
    const c = comp[t], a = Math.hypot(...M.triN(t)) / 2; area[c] += a;
    const ctr = [0, 1, 2].map(k => (M.x[T[3 * t]] * (k === 0) + M.y[T[3 * t]] * (k === 1) + M.z[T[3 * t]] * (k === 2) + M.x[T[3 * t + 1]] * (k === 0) + M.y[T[3 * t + 1]] * (k === 1) + M.z[T[3 * t + 1]] * (k === 2) + M.x[T[3 * t + 2]] * (k === 0) + M.y[T[3 * t + 2]] * (k === 1) + M.z[T[3 * t + 2]] * (k === 2)) / 3);
    let cnt = 0; G.each(ctr[0], ctr[1], ctr[2], h, i => { if (d2(samples[i].p, ctr) < h * h) cnt++; }); dens[c] += cnt * a;
    for (let k = 0; k < 3; k++) if (ids.has(M.fe.get(M.ek(T[3 * t + k], T[3 * t + (k + 1) % 3])))) edgeT[c] = 1;
  }
  // a piece is "enclosed" when it doesn't reach the sheet's outer border: that's the inside of a closed green loop
  const border = new Uint8Array(nc);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++){ const a = T[3 * t + k], b = T[3 * t + (k + 1) % 3]; if (M.edgeTris(a, b).length === 1 && !ids.has(M.fe.get(M.ek(a, b)))) border[comp[t]] = 1; }
  const cand = []; for (let c = 0; c < nc; c++) if (edgeT[c] && area[c] > 0) cand.push(c);
  const keep = new Uint8Array(nc).fill(1);
  if (cand.some(c => !border[c])) cand.forEach(c => { if (border[c]) keep[c] = 0; });       // closed loop: keep what's inside
  else if (cand.length > 1){                                                                   // open line: keep the side with more lines (or the bigger side)
    const d = c => dens[c] / area[c], best = cand.reduce((a, b) => d(b) > d(a) ? b : a), lo = Math.min(...cand.map(d));
    const byArea = d(best) < lo * 1.4, winner = byArea ? cand.reduce((a, b) => area[b] > area[a] ? b : a) : best;
    cand.forEach(c => { if (c !== winner) keep[c] = 0; });
  }
  let removed = 0;
  for (let t = 0; t < nt; t++){ if (keep[comp[t]]) continue; M.tdead[t] = true; for (let k = 0; k < 3; k++) rmv(M.vt[T[3 * t + k]], t); removed++; }
  for (const [k, id] of [...M.fe]) if (ids.has(id)){ const a = Math.floor(k / 2097152), b = k % 2097152; if (!M.edgeTris(a, b).length) M.fe.delete(k); }
  for (let v = 0; v < M.x.length; v++) if (!M.vt[v].length) M.fc[v] = -1;
  fixBowties(M); dropSmallParts(M, 8); M.compact();
  return removed;
}

// ---------------- simpler topology: remesh the fitted surface at a coarser size, staying on it
function triArea(M){ let a = 0; for (let t = 0; t < M.tdead.length; t++) if (!M.tdead[t]) a += Math.hypot(...M.triN(t)) / 2; return a; }
function projector(Mfit, L){
  const VG = new Grid(L); for (let v = 0; v < Mfit.x.length; v++) if (Mfit.vt[v].length) VG.add(v, Mfit.x[v], Mfit.y[v], Mfit.z[v]);
  return p => { for (const r of [L * 1.5, L * 4, L * 12]){ const c = closestOnMesh(Mfit, VG, p, r); if (c) return c.p; } return p; };
}
function coarsen(M, Mfit, curves, Lo, L, iters){
  const proj = projector(Mfit, L);
  for (let it = 0; it < iters; it++){
    remesh(M, Lo, 0.75);
    const N = vertexNormals(M), nx = M.x.slice(), ny = M.y.slice(), nz = M.z.slice();
    for (let v = 0; v < M.x.length; v++){
      if (!M.vt[v].length) continue;
      let p = M.P(v);
      if (M.fc[v] >= 0){ if (!M.corner[v]){ p = closestOnPoly(curves[M.fc[v]], p).p; } }
      else {
        if (!M.isBV(v)){ const ring = M.nbrs(v); let cx = 0, cy = 0, cz = 0; for (const w of ring){ cx += M.x[w]; cy += M.y[w]; cz += M.z[w]; }
          const d = [cx / ring.length - p[0], cy / ring.length - p[1], cz / ring.length - p[2]], dn = dot(d, N[v]); p = [p[0] + (d[0] - dn * N[v][0]) * 0.5, p[1] + (d[1] - dn * N[v][1]) * 0.5, p[2] + (d[2] - dn * N[v][2]) * 0.5]; }
        p = proj(p);
      }
      nx[v] = p[0]; ny[v] = p[1]; nz[v] = p[2];
    }
    M.x = nx; M.y = ny; M.z = nz;
  }
}
// make the smooth (subdivided) surface hug the fitted one: nudge each cage vertex by how far its limit point is off
function hugCage(cage, Mtopo, Mfit, curves, L, iters, leash){   // Mtopo: anything with .fc[v] and .corner[v] per cage vertex
  const { V, F, sharp } = cage, nv = V.length / 3, proj = projector(Mfit, L);
  const eF = new Map(); F.forEach((f, fi) => f.forEach((a, i) => { const k = ek(a, f[(i + 1) % f.length]); (eF.get(k) || eF.set(k, []).get(k)).push(fi); }));
  const nbr = Array.from({ length: nv }, () => []), diag = Array.from({ length: nv }, () => []), tri = new Uint8Array(nv), cre = Array.from({ length: nv }, () => []);
  for (const [k, fs] of eF){ const a = Math.floor(k / 2097152), b = k % 2097152; nbr[a].push(b); nbr[b].push(a); if (fs.length !== 2 || sharp.has(k)){ cre[a].push(b); cre[b].push(a); } }
  for (const f of F){ if (f.length !== 4){ f.forEach(v => tri[v] = 1); continue; } for (let i = 0; i < 4; i++) diag[f[i]].push(f[(i + 2) % 4]); }
  const P = v => [V[3 * v], V[3 * v + 1], V[3 * v + 2]];
  const limit = v => { const p = P(v), c = cre[v];
    if (c.length > 2) return p;
    if (c.length === 2){ if (cage.corner && cage.corner[v]) return p; const a = P(c[0]), b = P(c[1]); return [0, 1, 2].map(i => (4 * p[i] + a[i] + b[i]) / 6); }
    const n = nbr[v].length; if (!n) return p;
    if (tri[v]){ const s2 = [0, 0, 0]; for (const w of nbr[v]){ const q = P(w); for (let i = 0; i < 3; i++) s2[i] += q[i] / n; } return [0, 1, 2].map(i => (2 * p[i] + s2[i]) / 3); }
    const e = [0, 0, 0], d = [0, 0, 0]; for (const w of nbr[v]){ const q = P(w); for (let i = 0; i < 3; i++) e[i] += q[i]; } for (const w of diag[v]){ const q = P(w); for (let i = 0; i < 3; i++) d[i] += q[i]; }
    return [0, 1, 2].map(i => (n * n * p[i] + 4 * e[i] + d[i]) / (n * (n + 5))); };
  const V0 = leash ? V.slice() : null, cap = leash ? new Float64Array(nv) : null;
  if (leash){ const cnt = new Float64Array(nv); for (const [k] of eF){ const a = Math.floor(k / 2097152), b = k % 2097152, l = Math.sqrt(d2(P(a), P(b))); cap[a] += l; cap[b] += l; cnt[a]++; cnt[b]++; } for (let v = 0; v < nv; v++) cap[v] = leash * cap[v] / (cnt[v] || 1); }
  for (let it = 0; it < iters; it++){
    const moves = new Float64Array(nv * 3);
    for (let v = 0; v < nv; v++){
      if (Mtopo.corner[v]) continue;
      const lim = limit(v), id = Mtopo.fc[v], tgt = id >= 0 && curves[id] ? closestOnPoly(curves[id], lim).p : proj(lim);
      moves[3 * v] = (tgt[0] - lim[0]) * 0.8; moves[3 * v + 1] = (tgt[1] - lim[1]) * 0.8; moves[3 * v + 2] = (tgt[2] - lim[2]) * 0.8;
    }
    for (let i = 0; i < V.length; i++) V[i] += moves[i] * (leash ? 0.6 : 1);
    if (leash) for (let v = 0; v < nv; v++){ const dx = V[3 * v] - V0[3 * v], dy = V[3 * v + 1] - V0[3 * v + 1], dz = V[3 * v + 2] - V0[3 * v + 2], dl = Math.hypot(dx, dy, dz);
      if (dl > cap[v]){ const f = cap[v] / dl; V[3 * v] = V0[3 * v] + dx * f; V[3 * v + 1] = V0[3 * v + 1] + dy * f; V[3 * v + 2] = V0[3 * v + 2] + dz * f; } }
  }
}
// ---------------- a cage drawn by you: guides + creases + the border cut the surface into patches, one face each
// The surface is flattened onto a disc (Tutte), every line is mapped onto that disc, and the lines are intersected
// there, so crossings are exact and never depend on how the triangles happen to run.
function flattenDisc(M){
  const nv = M.x.length, T = M.T, nxt = new Map();
  for (let t = 0; t < M.tdead.length; t++){ if (M.tdead[t]) continue; for (let k = 0; k < 3; k++){ const a = T[3 * t + k], b = T[3 * t + (k + 1) % 3]; if (M.edgeTris(a, b).length === 1) nxt.set(a, b); } }
  if (!nxt.size) return null;
  let best = null, bl = 0; const seen = new Set();
  for (const s of nxt.keys()){ if (seen.has(s)) continue; const loop = []; let v = s, len = 0;
    while (!seen.has(v) && nxt.has(v)){ seen.add(v); loop.push(v); const w = nxt.get(v); len += Math.sqrt(M.len2(v, w)); v = w; }
    if (len > bl){ bl = len; best = loop; } }
  const uv = new Float64Array(2 * nv), fixed = new Uint8Array(nv);
  let s = 0; for (let i = 0; i < best.length; i++){ const v = best[i], a = 2 * Math.PI * s / bl; uv[2 * v] = Math.cos(a); uv[2 * v + 1] = Math.sin(a); fixed[v] = 1; s += Math.sqrt(M.len2(v, best[(i + 1) % best.length])); }
  const nb = Array.from({ length: nv }, (_, v) => M.vt[v].length ? M.nbrs(v) : []);
  // uniform Laplacian, solved by conjugate gradients for each coordinate
  const free = []; for (let v = 0; v < nv; v++) if (!fixed[v] && nb[v].length) free.push(v);
  const idx = new Int32Array(nv).fill(-1); free.forEach((v, i) => idx[v] = i); const n = free.length;
  for (let c = 0; c < 2; c++){
    const b = new Float64Array(n), x = new Float64Array(n);
    free.forEach((v, i) => { for (const w of nb[v]) if (fixed[w]) b[i] += uv[2 * w + c]; });
    const A = (p, out) => { for (let i = 0; i < n; i++){ const v = free[i]; let s2 = nb[v].length * p[i]; for (const w of nb[v]){ const j = idx[w]; if (j >= 0) s2 -= p[j]; } out[i] = s2; } };
    const r = b.slice(), p = r.slice(), Ap = new Float64Array(n); let rr = 0; for (let i = 0; i < n; i++) rr += r[i] * r[i];
    for (let it = 0; it < 2000 && rr > 1e-18; it++){ A(p, Ap); let pAp = 0; for (let i = 0; i < n; i++) pAp += p[i] * Ap[i]; const al = rr / pAp;
      let rr2 = 0; for (let i = 0; i < n; i++){ x[i] += al * p[i]; r[i] -= al * Ap[i]; rr2 += r[i] * r[i]; } const be = rr2 / rr; rr = rr2; for (let i = 0; i < n; i++) p[i] = r[i] + be * p[i]; }
    free.forEach((v, i) => uv[2 * v + c] = x[i]);
  }
  return { uv, border: best, borderLen: bl };
}
function guideCage(Mfit, curves, guides, L, level){
  const M = Mfit.clone(); M.compact();
  const D = flattenDisc(M); if (!D) return null;
  const { uv } = D, T = M.T, nv = M.x.length;
  const VG = new Grid(L); for (let v = 0; v < nv; v++) if (M.vt[v].length) VG.add(v, M.x[v], M.y[v], M.z[v]);
  // a point on the surface -> where it lands on the disc
  const toUV = p => {
    let bv = -1, bd = Infinity; VG.each(p[0], p[1], p[2], L * 2.5, v => { const dd = sq(M.x[v] - p[0]) + sq(M.y[v] - p[1]) + sq(M.z[v] - p[2]); if (dd < bd){ bd = dd; bv = v; } });
    if (bv < 0) return null;
    let best = null, qd = Infinity;
    for (const t of M.vt[bv]){ const a = M.P(T[3 * t]), b = M.P(T[3 * t + 1]), c = M.P(T[3 * t + 2]), q = closestOnTri(p, a, b, c), dd = d2(p, q); if (dd < qd){ qd = dd; best = { t, q, a, b, c }; } }
    const { t, q, a, b, c } = best, v0 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v2 = [q[0] - a[0], q[1] - a[1], q[2] - a[2]];
    const d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1), den = d00 * d11 - d01 * d01 || 1e-12;
    const wb = (d11 * d20 - d01 * d21) / den, wc = (d00 * d21 - d01 * d20) / den, wa = 1 - wb - wc, i0 = T[3 * t], i1 = T[3 * t + 1], i2 = T[3 * t + 2];
    return { uv: [wa * uv[2 * i0] + wb * uv[2 * i1] + wc * uv[2 * i2], wa * uv[2 * i0 + 1] + wb * uv[2 * i1 + 1] + wc * uv[2 * i2 + 1]], p: q, d: Math.sqrt(qd) };
  };
  // ---- the lines, as polylines on the disc (kind: 0 border, 1 crease, 2 guide)
  const lines = [];
  { const B = D.border; lines.push({ kind: 0, cid: -1, closed: true, P: B.map(v => M.P(v)), U: B.map(v => [uv[2 * v], uv[2 * v + 1]]) }); }
  const addLine = (C, kind, cid) => {
    const S = resample(C.pts, L * 0.3, C.closed); let P = [], U = [];
    const flush = () => { if (P.length >= 2) lines.push({ kind, cid, closed: false, P, U }); P = []; U = []; };
    let all = true;
    for (const p of S){ const m = toUV(p); if (!m || m.d > L * 1.5){ all = false; flush(); continue; } P.push(m.p); U.push(m.uv); }
    if (all && C.closed && P.length > 3){ lines.push({ kind, cid, closed: true, P, U }); return; }
    flush();
  };
  curves.forEach((C, i) => { if (!C.edge) addLine(C, 1, i); });
  guides.forEach(G => addLine(G, 2, -1));
  // ---- segment intersection on the disc
  const segX = (a, b, c, d) => { const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-14) return null;
    const qp = [c[0] - a[0], c[1] - a[1]], t = (qp[0] * s[1] - qp[1] * s[0]) / den, u = (qp[0] * r[1] - qp[1] * r[0]) / den; return [t, u]; };
  const nSeg = l => l.closed ? l.U.length : l.U.length - 1;
  const segU = (l, i) => [l.U[i], l.U[(i + 1) % l.U.length]];
  const at3 = (l, i, t) => lerp3(l.P[i], l.P[(i + 1) % l.P.length], t), atU = (l, i, t) => { const [a, b] = segU(l, i); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  // ---- loose ends reach over to the nearest line in the direction they were heading (or are trimmed off later)
  const reach = Math.max(0.35, L * 4);
  for (const l of lines){ if (l.closed || l.kind === 0) continue;
    for (const end of [0, 1]){
      const n = l.U.length, e = end ? n - 1 : 0, k = end ? Math.max(0, n - 4) : Math.min(n - 1, 3);
      const o = l.U[e], dU = [o[0] - l.U[k][0], o[1] - l.U[k][1]], dl = Math.hypot(dU[0], dU[1]); if (dl < 1e-9) continue;
      const far = [o[0] + dU[0] / dl * 3, o[1] + dU[1] / dl * 3];
      let hit = null, ht = Infinity;
      for (const m of lines){ for (let i = 0; i < nSeg(m); i++){ if (m === l && Math.abs(i - (end ? n - 2 : 0)) < 4) continue; const [c, d] = segU(m, i), x = segX(o, far, c, d);
        if (x && x[0] > 1e-9 && x[1] >= 0 && x[1] <= 1 && x[0] < ht){ ht = x[0]; hit = { m, i, u: x[1] }; } } }
      if (!hit) continue;
      const hp = at3(hit.m, hit.i, hit.u); if (Math.sqrt(d2(hp, l.P[e])) > reach) continue;
      const hu = atU(hit.m, hit.i, hit.u), over = [hu[0] + dU[0] / dl * 1e-5, hu[1] + dU[1] / dl * 1e-5];
      if (end){ l.U.push(over); l.P.push(hp); } else { l.U.unshift(over); l.P.unshift(hp); }
    }
  }
  // ---- all crossings
  const nodes = []; // {u:[x,y], p:[x,y,z], cids:Set, corner}
  const ev = lines.map(() => []);   // per line: [param, node]
  const cell = 0.03, gh = new Map(), gk = (x, y) => (x + 1000) * 4096 + (y + 1000);
  lines.forEach((l, li) => { for (let i = 0; i < nSeg(l); i++){ const [a, b] = segU(l, i);
    for (let x = Math.floor(Math.min(a[0], b[0]) / cell); x <= Math.floor(Math.max(a[0], b[0]) / cell); x++) for (let y = Math.floor(Math.min(a[1], b[1]) / cell); y <= Math.floor(Math.max(a[1], b[1]) / cell); y++){ const k = gk(x, y); (gh.get(k) || gh.set(k, []).get(k)).push(li, i); } } });
  const done = new Set();
  for (const arr of gh.values()) for (let p = 0; p < arr.length; p += 2) for (let q = p + 2; q < arr.length; q += 2){
    const la = arr[p], ia = arr[p + 1], lb = arr[q], ib = arr[q + 1]; if (la === lb) continue;
    const key = la < lb ? `${la},${ia},${lb},${ib}` : `${lb},${ib},${la},${ia}`; if (done.has(key)) continue; done.add(key);
    const A = lines[la], B = lines[lb], [a, b] = segU(A, ia), [c, d] = segU(B, ib), x = segX(a, b, c, d); if (!x || x[0] < 0 || x[0] > 1 || x[1] < 0 || x[1] > 1) continue;
    // where two lines cross, the crease (or the border) decides the exact spot
    const pa = at3(A, ia, x[0]), pb = at3(B, ib, x[1]), pr = A.kind === 0 ? pa : B.kind === 0 ? pb : A.kind === 1 ? pa : B.kind === 1 ? pb : lerp3(pa, pb, 0.5);
    const ni = nodes.length; nodes.push({ u: atU(A, ia, x[0]), p: pr, cids: new Set([A.cid, B.cid].filter(c2 => c2 >= 0)), border: A.kind === 0 || B.kind === 0, corner: false });
    ev[la].push([ia + x[0], ni]); ev[lb].push([ib + x[1], ni]);
  }
  // a crease's own sharp corners are cage corners too
  lines.forEach((l, li) => { if (l.kind !== 1) return; const C = curves[l.cid];
    for (const cp of (C.corners || [])){ let bi = -1, bt = 0, bd = sq(L); for (let i = 0; i < nSeg(l); i++){ const a = l.P[i], b = l.P[(i + 1) % l.P.length], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t = Math.max(0, Math.min(1, dot([cp[0] - a[0], cp[1] - a[1], cp[2] - a[2]], ab) / (dot(ab, ab) || 1))), dd = d2(lerp3(a, b, t), cp); if (dd < bd){ bd = dd; bi = i; bt = t; } }
      if (bi < 0) continue; const ni = nodes.length; nodes.push({ u: atU(l, bi, bt), p: at3(l, bi, bt), cids: new Set([l.cid]), corner: true }); ev[li].push([bi + bt, ni]); } });
  if (!ev[0].length){ nodes.push({ u: lines[0].U[0], p: lines[0].P[0], cids: new Set(), border: true, corner: false }); ev[0].push([0, nodes.length - 1]); }
  // ---- crossings that nearly coincide become one
  const mtol = Math.max(0.05, L * 0.7), par = nodes.map((_, i) => i), fd = i => par[i] === i ? i : (par[i] = fd(par[i]));
  { const NG = new Grid(mtol); nodes.forEach((n, i) => NG.add(i, n.p[0], n.p[1], n.p[2]));
    nodes.forEach((n, i) => NG.each(n.p[0], n.p[1], n.p[2], mtol, j => { if (j > i && d2(n.p, nodes[j].p) < mtol * mtol){ const a = fd(i), b = fd(j); if (a !== b) par[b] = a; } })); }
  nodes.forEach((n, i) => { const r = fd(i); if (r !== i){ const R = nodes[r]; n.cids.forEach(c => R.cids.add(c)); R.corner = R.corner || n.corner; R.border = R.border || n.border; } });
  // ---- graph edges: the pieces of each line between its crossings
  const edges = []; // {a, b, P, U, kind, cid}
  const piece = (l, s0, s1) => { const P = [at3(l, Math.floor(s0) % nSeg(l), s0 - Math.floor(s0))], U = [atU(l, Math.floor(s0) % nSeg(l), s0 - Math.floor(s0))];
    for (let i = Math.floor(s0) + 1; i <= Math.floor(s1 - 1e-12); i++){ const j = i % l.P.length; P.push(l.P[j]); U.push(l.U[j]); }
    const f = Math.floor(s1 - 1e-12) % nSeg(l); P.push(at3(l, f, s1 - Math.floor(s1 - 1e-12))); U.push(atU(l, f, s1 - Math.floor(s1 - 1e-12))); return { P, U }; };
  lines.forEach((l, li) => { const E = ev[li].sort((a, b) => a[0] - b[0]); if (!E.length) return;
    const ns = l.closed ? E.length : E.length - 1;
    for (let k = 0; k < ns; k++){ const [s0, a] = E[k], [s1r, b] = E[(k + 1) % E.length], s1 = k + 1 < E.length ? s1r : s1r + nSeg(l);
      const ra = fd(a), rb = fd(b); if (s1 - s0 < 1e-9 && E.length > 1) continue; const g = piece(l, s0, s1);
      let len = 0; for (let i = 1; i < g.P.length; i++) len += Math.sqrt(d2(g.P[i - 1], g.P[i]));
      if (ra === rb && len < mtol * 4) continue;               // a crumb between merged crossings
      edges.push({ a: ra, b: rb, P: g.P, U: g.U, kind: l.kind, cid: l.cid, len }); } });
  // ---- loose ends go
  let alive = edges.map(() => true);
  const degree = () => { const dg = new Int32Array(nodes.length); edges.forEach((e, i) => { if (alive[i]){ dg[e.a]++; dg[e.b]++; } }); return dg; };
  for (let ch = true; ch;){ ch = false; const dg = degree(); edges.forEach((e, i) => { if (alive[i] && (dg[e.a] === 1 || dg[e.b] === 1)){ alive[i] = false; ch = true; } }); }
  let E = edges.filter((_, i) => alive[i]);
  let lost = 0;
  // lines that touch nothing else (a crease loop no guide crosses) can't be part of the cage
  { const adj = new Map(); E.forEach(e => { (adj.get(e.a) || adj.set(e.a, []).get(e.a)).push(e.b); (adj.get(e.b) || adj.set(e.b, []).get(e.b)).push(e.a); });
    const start = E.find(e => e.kind === 0); if (!start) return null; const seen = new Set([start.a]), st = [start.a];
    while (st.length){ const v = st.pop(); for (const w of adj.get(v) || []) if (!seen.has(w)){ seen.add(w); st.push(w); } }
    lost = E.filter(e => !seen.has(e.a)).length; E = E.filter(e => seen.has(e.a)); }
  // ---- nodes where just two pieces meet, with no corner, join those pieces
  const join = () => { for (let ch = true; ch;){ ch = false; const inc = new Map(); E.forEach((e, i) => { for (const v of [e.a, e.b]) (inc.get(v) || inc.set(v, []).get(v)).push(i); });
    for (const [v, es] of inc){ if (es.length !== 2 || es[0] === es[1] || nodes[v].corner || nodes[v].split) continue; const e1 = E[es[0]], e2 = E[es[1]]; if (e1.kind !== e2.kind || e1.cid !== e2.cid) continue;
      const f1 = e1.b === v ? e1 : rev(e1), f2 = e2.a === v ? e2 : rev(e2);
      const ne = { a: f1.a, b: f2.b, P: [...f1.P, ...f2.P.slice(1)], U: [...f1.U, ...f2.U.slice(1)], kind: e1.kind, cid: e1.cid, len: e1.len + e2.len };
      E = E.filter((_, i) => i !== es[0] && i !== es[1]); E.push(ne); ch = true; break; } } };
  const rev = e => ({ ...e, a: e.b, b: e.a, P: e.P.slice().reverse(), U: e.U.slice().reverse() });
  join();
  // two pieces that run between the same crossings along the same path are one (a guide traced over a crease)
  { const hd = (e1, e2) => { let m = 0; for (const p of e1.P){ let b = Infinity; for (const q of e2.P) b = Math.min(b, d2(p, q)); m = Math.max(m, b); } return Math.sqrt(m); };
    const drop = new Set();
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++){ const a = E[i], b = E[j]; if (drop.has(i) || drop.has(j)) continue;
      if (!((a.a === b.a && a.b === b.b) || (a.a === b.b && a.b === b.a))) continue; if (hd(a, b) > mtol * 1.5) continue; drop.add(a.kind >= b.kind ? i : j); }
    if (drop.size){ E = E.filter((_, i) => !drop.has(i)); join(); } }
  // ---- faces: walk the planar graph on the disc
  const faces = () => {
    const out = new Map(); // node -> [{e, fwd, ang}]
    const ang = (e, fwd) => { const U = fwd ? e.U : e.U.slice().reverse(), P = fwd ? e.P : e.P.slice().reverse(); const o = nodes[fwd ? e.a : e.b].u;
      let s = 0, j = 1; for (; j < P.length - 1; j++){ s += Math.sqrt(d2(P[j - 1], P[j])); if (s > Math.min(mtol * 1.5, e.len * 0.4)) break; } const q = U[Math.min(j, U.length - 1)]; return Math.atan2(q[1] - o[1], q[0] - o[0]); };
    E.forEach((e, i) => { for (const fwd of [true, false]){ const v = fwd ? e.a : e.b; (out.get(v) || out.set(v, []).get(v)).push({ i, fwd, ang: ang(e, fwd) }); } });
    for (const l of out.values()) l.sort((a, b) => a.ang - b.ang);
    const used = new Set(), F = [];
    for (const [v0, l0] of out) for (const h0 of l0){ const hk = h0.i * 2 + (h0.fwd ? 0 : 1); if (used.has(hk)) continue;
      const cyc = []; let h = h0, guard = 0;
      while (guard++ < 10000){ const k = h.i * 2 + (h.fwd ? 0 : 1); if (used.has(k)) break; used.add(k); cyc.push(h);
        const e = E[h.i], v = h.fwd ? e.b : e.a, lst = out.get(v), ti = lst.findIndex(x => x.i === h.i && x.fwd !== h.fwd && (e.a !== e.b || x !== h));
        h = lst[(ti - 1 + lst.length) % lst.length]; }
      let area = 0; for (const hh of cyc){ const e = E[hh.i], U = hh.fwd ? e.U : e.U.slice().reverse(); for (let i = 1; i < U.length; i++) area += U[i - 1][0] * U[i][1] - U[i][0] * U[i - 1][1]; }
      if (area > 1e-9) F.push(cyc); }
    return F; };
  // ---- every patch wants 4 corners: split sides at their sharpest bend (borders and creases first), and split creases
  // that bend away from a straight side so the cage can still follow them
  const turnAt = (P, i, k) => { const a = P[Math.max(0, i - k)], b = P[i], c = P[Math.min(P.length - 1, i + k)]; return Math.acos(Math.max(-1, Math.min(1, dot(norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), norm([c[0] - b[0], c[1] - b[1], c[2] - b[2]]))))); };
  const bestSplit = e => { const k = Math.max(1, Math.round(L * 1.2 / (L * 0.3))); let bi = -1, bt = -1; for (let i = 2; i < e.P.length - 2; i++){ const t = turnAt(e.P, i, k); if (t > bt){ bt = t; bi = i; } } return { i: bi, turn: bt }; };
  const splitE = (ei, i, sharpTurn) => { const e = E[ei], ni = nodes.length; nodes.push({ u: e.U[i], p: e.P[i], cids: new Set(e.cid >= 0 ? [e.cid] : []), border: e.kind === 0, corner: false });
    let l1 = 0; for (let j = 1; j <= i; j++) l1 += Math.sqrt(d2(e.P[j - 1], e.P[j]));
    E.splice(ei, 1, { ...e, b: ni, P: e.P.slice(0, i + 1), U: e.U.slice(0, i + 1), len: l1 }, { ...e, a: ni, P: e.P.slice(i), U: e.U.slice(i), len: e.len - l1 }); nodes[ni].corner = !!sharpTurn; nodes[ni].split = true; };
  for (let pass = 0; pass < 6; pass++){
    let did = false;
    // creases that bow away from their chord
    for (let ei = 0; ei < E.length; ei++){ const e = E[ei]; if (e.kind !== 1 || e.P.length < 5) continue;
      const a = e.P[0], b = e.P[e.P.length - 1], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ch = Math.hypot(...ab) || 1e-9;
      let md = 0, mi = -1; for (let i = 1; i < e.P.length - 1; i++){ const t = Math.max(0, Math.min(1, dot([e.P[i][0] - a[0], e.P[i][1] - a[1], e.P[i][2] - a[2]], ab) / (ch * ch))), dd = Math.sqrt(d2(e.P[i], lerp3(a, b, t))); if (dd > md){ md = dd; mi = i; } }
      if (md > Math.max(0.06, ch * 0.18) && mi > 1 && mi < e.P.length - 2){ const s = bestSplit(e); splitE(ei, s.turn > 0.5 ? s.i : mi, s.turn > 1.0); did = true; ei++; } }
    const F = faces(), want = new Map();
    for (const cyc of F){ if (cyc.length >= 4) continue;
      const cand = cyc.map(h => { const s = bestSplit(E[h.i]); return { h, ...s, score: s.turn + (E[h.i].kind < 2 ? 0.6 : 0) + (cyc.length < 3 ? E[h.i].len : 0) }; }).filter(c => c.i > 0).sort((x, y) => y.score - x.score);
      const c = cand[0]; if (!c || (cyc.length === 3 && c.turn < 0.5 && E[c.h.i].kind === 2)) continue;
      if (!want.has(c.h.i)) want.set(c.h.i, c); }
    [...want.keys()].sort((a, b) => b - a).forEach(ei => { const c = want.get(ei); splitE(ei, c.i, c.turn > 1.0); did = true; });
    if (!did) break;
  }
  // ---- the cage
  const F0 = faces(); if (!F0.length) return null;
  // the disc, back onto the surface: find the triangle a disc point falls in
  const tg = new Map(), tc = 0.025, tk = (x, y) => (x + 1000) * 4096 + (y + 1000);
  for (let t = 0; t < M.tdead.length; t++){ if (M.tdead[t]) continue; const i = [T[3 * t], T[3 * t + 1], T[3 * t + 2]];
    const xs = i.map(v => uv[2 * v]), ys = i.map(v => uv[2 * v + 1]);
    for (let x = Math.floor(Math.min(...xs) / tc); x <= Math.floor(Math.max(...xs) / tc); x++) for (let y = Math.floor(Math.min(...ys) / tc); y <= Math.floor(Math.max(...ys) / tc); y++){ const k = tk(x, y); (tg.get(k) || tg.set(k, []).get(k)).push(t); } }
  const uvTo3D = u => { let bt = -1, bw = null, worst = -Infinity;
    for (const t of tg.get(tk(Math.floor(u[0] / tc), Math.floor(u[1] / tc))) || []){ const [a, b, c] = [T[3 * t], T[3 * t + 1], T[3 * t + 2]];
      const ax = uv[2 * a], ay = uv[2 * a + 1], bx = uv[2 * b], by = uv[2 * b + 1], cx = uv[2 * c], cy = uv[2 * c + 1], den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-18) continue;
      const wa = ((by - cy) * (u[0] - cx) + (cx - bx) * (u[1] - cy)) / den, wb = ((cy - ay) * (u[0] - cx) + (ax - cx) * (u[1] - cy)) / den, wc = 1 - wa - wb, mn = Math.min(wa, wb, wc);
      if (mn > worst){ worst = mn; bt = t; bw = [wa, wb, wc]; } if (mn >= 0) break; }
    if (bt < 0) return null; const w = bw.map(x => Math.max(0, x)), sw = w[0] + w[1] + w[2] || 1, p = [0, 0, 0];
    for (let k = 0; k < 3; k++){ const v = T[3 * bt + k]; p[0] += M.x[v] * w[k] / sw; p[1] += M.y[v] * w[k] / sw; p[2] += M.z[v] * w[k] / sw; } return p; };
  // which creases each corner really sits on (pieces trimmed away no longer count)
  { const inc = new Map(); E.forEach(e => { if (e.kind === 1) for (const v of [e.a, e.b]) (inc.get(v) || inc.set(v, new Set()).get(v)).add(e.cid); });
    nodes.forEach((N, i) => { N.cids = inc.get(i) || new Set(); }); }
  // cage vertices, faces, and what each side runs along
  const Vs = [], vmap = new Map(), G = new Map();
  const vOf = n => { if (!vmap.has(n)){ const N = nodes[n], cs = [...N.cids]; vmap.set(n, Vs.length); Vs.push({ u: N.u, p: N.p, fc: cs.length === 1 ? cs[0] : -1, corner: N.corner || cs.length > 1 }); } return vmap.get(n); };
  let Fs = [], bad = 0;
  for (const cyc of F0){ if (cyc.length < 3){ bad++; continue; }
    const f = cyc.map(h => vOf(h.fwd ? E[h.i].a : E[h.i].b));
    cyc.forEach((h, q) => { const e = E[h.i], a = f[q], b = f[(q + 1) % f.length], P = h.fwd ? e.P : e.P.slice().reverse(), U = h.fwd ? e.U : e.U.slice().reverse();
      if (!G.has(ek(a, b))) G.set(ek(a, b), { a, P, U, kind: e.kind, cid: e.cid, sharp: e.kind === 1 && !!curves[e.cid].sharp }); });
    Fs.push(f); }
  // more detail between the guides: split every patch like one step of subdivision, with the new points on the surface
  for (let lv = 0; lv < level; lv++){
    const mid = new Map(), NG = new Map(), NF = [];
    const getMid = (a, b) => { const k = ek(a, b); if (mid.has(k)) return mid.get(k); const g = G.get(k); let m;
      if (!g || g.straight){ const u = [(Vs[a].u[0] + Vs[b].u[0]) / 2, (Vs[a].u[1] + Vs[b].u[1]) / 2]; m = { u, p: uvTo3D(u) || lerp3(Vs[a].p, Vs[b].p, 0.5), fc: -1, corner: false }; }
      else { let tot = 0; for (let i = 1; i < g.P.length; i++) tot += Math.sqrt(d2(g.P[i - 1], g.P[i]));
        let acc = 0, i = 1; for (; i < g.P.length - 1; i++){ const l = Math.sqrt(d2(g.P[i - 1], g.P[i])); if (acc + l >= tot / 2) break; acc += l; }
        const l = Math.sqrt(d2(g.P[i - 1], g.P[i])) || 1e-9, t = Math.max(0, Math.min(1, (tot / 2 - acc) / l)), p = lerp3(g.P[i - 1], g.P[i], t), u = [g.U[i - 1][0] + (g.U[i][0] - g.U[i - 1][0]) * t, g.U[i - 1][1] + (g.U[i][1] - g.U[i - 1][1]) * t];
        m = { u, p, fc: g.kind === 1 ? g.cid : -1, corner: false }; }
      const mi = Vs.push(m) - 1; mid.set(k, mi);
      if (!g || g.straight){ NG.set(ek(a, mi), { straight: true }); NG.set(ek(mi, b), { straight: true }); }
      else { const first = g.a, other = first === a ? b : a; let acc = 0, i = 1;
        let tot = 0; for (let j = 1; j < g.P.length; j++) tot += Math.sqrt(d2(g.P[j - 1], g.P[j]));
        for (; i < g.P.length - 1; i++){ const l = Math.sqrt(d2(g.P[i - 1], g.P[i])); if (acc + l >= tot / 2) break; acc += l; }
        const base = { kind: g.kind, cid: g.cid, sharp: g.sharp };
        NG.set(ek(first, mi), { ...base, a: first, P: [...g.P.slice(0, i), m.p], U: [...g.U.slice(0, i), m.u] });
        NG.set(ek(mi, other), { ...base, a: mi, P: [m.p, ...g.P.slice(i)], U: [m.u, ...g.U.slice(i)] }); }
      return mi; };
    for (const f of Fs){ const n = f.length, u = [0, 0]; f.forEach(v => { u[0] += Vs[v].u[0] / n; u[1] += Vs[v].u[1] / n; });
      let p = uvTo3D(u); if (!p){ p = [0, 0, 0]; f.forEach(v => { for (let k = 0; k < 3; k++) p[k] += Vs[v].p[k] / n; }); }
      const ci = Vs.push({ u, p, fc: -1, corner: false }) - 1, ms = f.map((v, i) => getMid(v, f[(i + 1) % n]));
      for (let i = 0; i < n; i++){ NF.push([f[i], ms[i], ci, ms[(i - 1 + n) % n]]); NG.set(ek(ms[i], ci), { straight: true }); } }
    Fs = NF; G.clear(); for (const [k, g] of NG) G.set(k, g);
  }
  const V = [], fc = [], corner = []; Vs.forEach(v => { V.push(...v.p); fc.push(v.fc); corner.push(!!v.corner); });
  const sharp = new Set(); for (const [k, g] of G) if (g.sharp) sharp.add(k);
  const Fo = Fs;
  // the disc keeps the surface's winding, but make sure
  { let agree = 0;
    for (const f of Fo){ const P0 = [V[3 * f[0]], V[3 * f[0] + 1], V[3 * f[0] + 2]]; const n = [0, 0, 0];
      for (let i = 1; i + 1 < f.length; i++){ const c = cross3(P0, [V[3 * f[i]], V[3 * f[i] + 1], V[3 * f[i] + 2]], [V[3 * f[i + 1]], V[3 * f[i + 1] + 1], V[3 * f[i + 1] + 2]]); n[0] += c[0]; n[1] += c[1]; n[2] += c[2]; }
      let bv = -1, bd = Infinity; VG.each(P0[0], P0[1], P0[2], L * 3, v => { const dd = d2(M.P(v), P0); if (dd < bd){ bd = dd; bv = v; } }); if (bv < 0) continue;
      const m = [0, 0, 0]; for (const t of M.vt[bv]){ const c = M.triN(t); m[0] += c[0]; m[1] += c[1]; m[2] += c[2]; } agree += Math.sign(dot(n, m)); }
    if (agree < 0) Fo.forEach(f => f.reverse()); }
  return { cage: { V, F: Fo, sharp, feat: null, corner: Uint8Array.from(corner, c => c ? 1 : 0) }, info: { fc, corner }, bad, lost, patches: F0.length };
}
// hard edges found by angle: cage edges folded more than `deg` become sharp too
function autoCreases(cage, deg){
  const { V, F, sharp } = cage, fn = F.map(f => { const a = f[0], b = f[1], c = f[2], d = f[3] !== undefined ? f[3] : f[0];
    return norm(cross3([0, 0, 0], [V[3 * c] - V[3 * a], V[3 * c + 1] - V[3 * a + 1], V[3 * c + 2] - V[3 * a + 2]], [V[3 * d] - V[3 * b], V[3 * d + 1] - V[3 * b + 1], V[3 * d + 2] - V[3 * b + 2]])); });
  const eF = new Map(); F.forEach((f, fi) => f.forEach((a, i) => { const k = ek(a, f[(i + 1) % f.length]); (eF.get(k) || eF.set(k, []).get(k)).push(fi); }));
  const lim = Math.cos(deg * Math.PI / 180); let n = 0;
  for (const [k, fs] of eF) if (fs.length === 2 && !sharp.has(k) && dot(fn[fs[0]], fn[fs[1]]) < lim){ sharp.add(k); n++; }
  return n;
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
    conf[v] = Math.min(1, Math.hypot(zr, zi) / W) * Math.min(1, near / 2);
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
      cost += 4 * FL.conf[a] * m / 4; }
    cand.push([cost, t1, t2, q, worst]);
  }
  cand.sort((p, q) => p[0] - q[0]);
  const F = [];
  for (const [, t1, t2, q, w] of cand){ if (w > 0.75 || used[t1] || used[t2]) continue; used[t1] = used[t2] = 1; F.push(q); }
  for (let t = 0; t < nt; t++) if (!used[t]) F.push([T[3 * t], T[3 * t + 1], T[3 * t + 2]]);
  const V = []; for (let v = 0; v < M.x.length; v++) V.push(M.x[v], M.y[v], M.z[v]);
  const sharp = new Set(); for (const [k, id] of M.fe) if (curves[id] && curves[id].sharp) sharp.add(k);
  return { V, F, sharp, feat: new Map(M.fe), corner: Uint8Array.from(M.corner, c => c ? 1 : 0) };
}
function ek(a, b){ return a < b ? a * 2097152 + b : b * 2097152 + a; }
// Square up the quads: each quad pulls its corners toward the nearest square of the same size, turned to
// match the guide flow where there is one (or just its own best fit where there isn't). Vertices are then
// put back onto the fitted surface, so the shape doesn't change, only the layout of the quads on it.
function squareQuads(cage, M, flow, iters, L, Mfit){
  const { V, F } = cage, nv = V.length / 3, fixed = new Uint8Array(nv), proj = projector(Mfit || M, L);
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
      const q = proj(p); V[3 * v] = q[0]; V[3 * v + 1] = q[1]; V[3 * v + 2] = q[2];
    }
  }
}
function catmullClark({ V, F, sharp, feat, corner, soft, chain, tips, fade }, curves){
  const nv = V.length / 3, eid = new Map(), E = [];
  F.forEach((f, fi) => { for (let i = 0; i < f.length; i++){ const a = f[i], b = f[(i + 1) % f.length], k = ek(a, b); let e = eid.get(k); if (e === undefined){ e = E.length; eid.set(k, e); E.push({ a, b, f: [] }); } E[e].f.push(fi); } });
  const ne = E.length, nf = F.length, out = new Float64Array((nv + ne + nf) * 3);
  const FP = F.map(f => { const c = [0, 0, 0]; for (const v of f){ c[0] += V[3 * v]; c[1] += V[3 * v + 1]; c[2] += V[3 * v + 2]; } return c.map(x => x / f.length); });
  FP.forEach((c, i) => out.set(c, (nv + ne + i) * 3));
  // sharpness: sharp edges are fully sharp unless `soft` gives them a value; below 1 an edge is only partly sharp
  E.forEach((e, i) => { const k = ek(e.a, e.b), bd = e.f.length !== 2; e.s = bd ? Infinity : sharp.has(k) ? (soft && soft.has(k) ? soft.get(k) : Infinity) : 0;
    e.crease = bd || e.s >= 1; e.sharp = sharp.has(k) && e.s > 0;
    const m = [0, 1, 2].map(c => (V[3 * e.a + c] + V[3 * e.b + c]) / 2);
    let p = e.crease ? m : [0, 1, 2].map(c => (V[3 * e.a + c] + V[3 * e.b + c] + FP[e.f[0]][c] + FP[e.f[1]][c]) / 4);
    if (!e.crease && e.s > 0) p = p.map((x, c) => x + (m[c] - x) * e.s);
    out.set(p, (nv + i) * 3); });
  const vf = Array.from({ length: nv }, () => []), ve = Array.from({ length: nv }, () => []);
  F.forEach((f, fi) => f.forEach(v => vf[v].push(fi))); E.forEach((e, i) => { ve[e.a].push(i); ve[e.b].push(i); });
  for (let v = 0; v < nv; v++){
    const P = [V[3 * v], V[3 * v + 1], V[3 * v + 2]], cr = ve[v].filter(i => E[i].s > 0);
    let q = P;
    if (ve[v].length && cr.length < 2 || (cr.length >= 2 && cr.some(i => E[i].s < 1) && vf[v].length)){
      const n = ve[v].length, Fa = [0, 0, 0], Ra = [0, 0, 0];
      for (const fi of vf[v]) for (let c = 0; c < 3; c++) Fa[c] += FP[fi][c] / vf[v].length;
      for (const i of ve[v]){ const e = E[i]; for (let c = 0; c < 3; c++) Ra[c] += (V[3 * e.a + c] + V[3 * e.b + c]) / 2 / n; }
      q = [0, 1, 2].map(c => (Fa[c] + 2 * Ra[c] + (n - 3) * P[c]) / n); }
    if (cr.length >= 2){
      let hq = P;
      if (cr.length === 2){ const o = cr.map(i => E[i].a === v ? E[i].b : E[i].a); hq = corner && corner[v] ? P : [0, 1, 2].map(c => (6 * P[c] + V[3 * o[0] + c] + V[3 * o[1] + c]) / 8); }
      const vs = cr.reduce((a, i) => a + Math.min(E[i].s, 1), 0) / cr.length;   // partly sharp edges blend toward the smooth rule
      q = vs >= 1 ? hq : q.map((x, c) => x + (hq[c] - x) * vs);
    }
    out.set(q, v * 3);
  }
  const NF = [], NS = new Set();
  F.forEach((f, fi) => { const n = f.length; for (let i = 0; i < n; i++){ const a = f[i], b = f[(i + 1) % n], z = f[(i - 1 + n) % n];
    NF.push([a, nv + eid.get(ek(a, b)), nv + ne + fi, nv + eid.get(ek(z, a))]); } });
  const NSoft = new Map(), NCh = chain ? new Set() : null;
  E.forEach((e, i) => { const k1 = ek(e.a, nv + i), k2 = ek(nv + i, e.b);
    if (e.sharp && e.s - 1 > 0){ NS.add(k1); NS.add(k2); if (e.s !== Infinity){ NSoft.set(k1, e.s - 1); NSoft.set(k2, e.s - 1); } }
    if (NCh && chain.has(ek(e.a, e.b))){ NCh.add(k1); NCh.add(k2); } });
  // curve edges carry their curve down to the finer level; points on strict lines go back exactly onto them
  const NFt = new Map();
  if (feat) E.forEach((e, i) => { const id = feat.get(ek(e.a, e.b)); if (id === undefined) return; NFt.set(ek(e.a, nv + i), id); NFt.set(ek(nv + i, e.b), id);
    const C = curves && curves[id]; if (C && C.strict) for (const v of [e.a, nv + i, e.b]){ const q = closestOnPoly(C, [out[3 * v], out[3 * v + 1], out[3 * v + 2]]); if (q.d2 < 1) out.set(q.p, 3 * v); } });
  const NC = new Uint8Array(nv + ne + nf); if (corner) NC.set(corner.subarray(0, nv));
  return { V: Array.from(out), F: NF, sharp: NS, feat: NFt, corner: NC, soft: NSoft, chain: NCh, tips, fade };
}
// ---------------- soft crease ends: a sharp crease that stops in the open (not on another crease or the border)
// fades out over its last stretch instead of ending in a hard notch
function prepTips(cage, fade){
  if (!(fade > 0)) return;
  const { V, F, sharp } = cage, nv = V.length / 3, cnt = new Map();
  F.forEach(f => f.forEach((a, i) => { const k = ek(a, f[(i + 1) % f.length]); cnt.set(k, (cnt.get(k) || 0) + 1); }));
  const deg = new Int32Array(nv), inner = new Int32Array(nv), chain = new Set();
  for (const [k, c] of cnt){ const a = Math.floor(k / 2097152), b = k % 2097152; if (c !== 2 || sharp.has(k)){ deg[a]++; deg[b]++; } if (c === 2 && sharp.has(k)){ inner[a]++; inner[b]++; chain.add(k); } }
  const tips = []; for (let v = 0; v < nv; v++) if (deg[v] === 1 && inner[v] === 1) tips.push(v);
  if (!tips.length) return;
  cage.tips = tips; cage.chain = chain; cage.fade = fade;
}
// before each subdivision step: edges of the crease near a free end get a sharpness that grows with distance from it
function applyTips(m, rem){
  if (!m.tips || !m.chain) return;
  const V = m.V, adj = new Map(), len = (a, b) => Math.hypot(V[3 * a] - V[3 * b], V[3 * a + 1] - V[3 * b + 1], V[3 * a + 2] - V[3 * b + 2]);
  for (const k of m.chain){ const a = Math.floor(k / 2097152), b = k % 2097152; (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
  const soft = m.soft = new Map(m.soft || []);
  for (const t of m.tips){
    // the crease's own length caps the fade, so a short crease still keeps some sharpness in its middle
    let D = m.fade; { let tot = 0, prev = -1, v = t, guard = 0; while (guard++ < 100000){ const nx = (adj.get(v) || []).filter(w => w !== prev); if (nx.length !== 1 || tot > 2 * D) break; tot += len(v, nx[0]); prev = v; v = nx[0]; } D = Math.min(D, tot * 0.45); }
    if (!(D > 0)) continue;
    let prev = -1, v = t, d = 0, guard = 0;
    while (d < D && guard++ < 100000){ const nx = (adj.get(v) || []).filter(w => w !== prev); if (nx.length !== 1) break; const w = nx[0], l = len(v, w), mid = d + l / 2;
      if (mid < D){ const k = ek(v, w), sv = (rem + 0.5) * mid / D; m.sharp.add(k); soft.set(k, Math.min(soft.has(k) ? soft.get(k) : Infinity, sv)); }
      d += l; prev = v; v = w; }
  }
}
// what to draw as hard: partly sharp edges left at the end are drawn smooth
const hardView = m => (m.soft && m.soft.size ? { ...m, sharp: new Set([...m.sharp].filter(k => !m.soft.has(k) || m.soft.get(k) >= 1)) } : m);
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
//   5 edge (averaged, where the surface ends) · 6 strict edge (exact)
// prm: { target (quads in the result, 0 = by quad size), hard (auto crease angle, 0 = off), detail, avg, lines, fair (0..1), reach, group, subd, relax (0..10), dabs }
function solve(strokes, prm, progress = () => {}){
  if (prm.__crash && (prm.__crash === 'all' || prm.sides !== false)) throw new Error('test crash');   // for testing the fallbacks
  const L = Math.max(0.05, prm.detail), h = Math.max(prm.avg, L * 1.1), g = Math.max(prm.group, L * 0.5);
  const toPts = s => { const a = []; for (let i = 0; i + 2 < s.pts.length; i += 3) a.push([s.pts[i], s.pts[i + 1], s.pts[i + 2]]); return a; };
  const byTag = [[], [], [], [], [], [], []];
  for (const s of strokes){ const p = toPts(s), t = Math.min(6, s.tag || 0); if (p.length < 2) continue;
    if (t === 0) byTag[0].push(p); else for (const q of sliceLoops(p, g * 0.6, Math.max(g * 5, L * 4))){ q.corners = s.corners; byTag[t].push(q); } }
  progress(0.02, 'Finding the guide and crease lines');
  // Creases shape the surface (strict ones first, so they get cut in first and the averaged ones fit around them).
  // Guides don't compete with the loose lines: they're laid onto the surface afterwards and steer the quads.
  const curves = [...strictCurves(byTag[4], L, true, 4), ...strictCurves(byTag[6], L, false, 6), ...consensus(byTag[3], g, L * 0.5, true, 3), ...consensus(byTag[5], g, L * 0.5, false, 5)];
  curves.forEach(C => { if (C.tag >= 5) C.edge = true; C.corners = [...(C.user || []), ...curveCorners(C, L)]; });   // green: where the surface ends
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
  const sides = prm.sides === false ? null : creaseSides(curves, samples, h, L);
  const base = { sides, paint, fair: prm.fair, reach2: Math.max(h * 2, L * 3), step: 0.8, relax: 0.6, lines: Math.max(1, prm.lines | 0 || 4), grow: 2.4, robust: prm.robust !== false };
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
  let flow = guides.length ? flowField(M, [...guides.map(C => ({ C, w: 1 })), ...curves.map(C => ({ C, w: 0.35 }))], h) : null;
  M.strictIds = new Set(curves.map((C, i) => C.strict ? i : -1).filter(i => i >= 0));
  curves.forEach((C, i) => embedCurve(M, C, i, L));
  if (cutAtEdges(M, curves, samples, h)) progress(0.56, 'Trimming at the edges');
  untangle(M, 4);
  for (let it = 0; it < 8; it++){
    remesh(M, L, 0.8);
    if (it < 3) untangle(M, 2);
    if (guides.length) flow = flowField(M, [...guides.map(C => ({ C, w: 1 })), ...curves.map(C => ({ C, w: 0.35 }))], h);
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
  progress(0.88, 'Smoothing out folds');
  M.compact();
  // simpler topology: rebuild at the size that gives the quad count asked for, on the fitted surface
  let Mfit = M;
  let gc = null;
  if (prm.target < 0 && guides.length){ progress(0.9, 'Building the cage from your guides'); try { gc = guideCage(M, curves, guides, L, -1 - prm.target); } catch (e){ gc = null; } }
  if (gc){
    const { cage, info } = gc;
    if (prm.hard > 0) autoCreases(cage, prm.hard);
    progress(0.95, 'Hugging the surface');
    hugCage(cage, info, M, curves, L, 8, 0.3);
    const lv = Math.max(1, prm.subd | 0); prepTips(cage, prm.tipFade || 0); applyTips(cage, lv);
    let smooth = catmullClark(cage, curves); for (let i = 1; i < lv; i++){ applyTips(smooth, lv - i); smooth = catmullClark(smooth, curves); }
    smooth = hardView(smooth);
    progress(1, 'Done');
    return { surface: shade(smooth), quadWire: wire(cage), fineWire: wire(smooth), creases: creaseLines(smooth),
      quads: { V: new Float32Array(cage.V), F: new Int32Array(cage.F.flat()), C: new Int32Array(cage.F.map(f => f.length)) },
      curves: [...curves.map(C => ({ tag: C.tag, closed: C.closed, strict: !!C.strict, edge: !!C.edge, pts: C.pts.flat() })), ...guides.map(C => ({ tag: C.tag, closed: C.closed, guide: true, pts: C.pts.flat() }))],
      nQuads: cage.F.length, cageMode: true, note: gc.lost ? 'A line no guide crosses was left out: draw a guide across it' : gc.bad ? gc.bad + ' patch' + (gc.bad > 1 ? 'es' : '') + ' left open: close them with more guides' : '' };
  }
  
  if (prm.target > 0){
    const Lo = 2 * Math.sqrt(triArea(M) / prm.target);
    if (Lo > L * 1.2){ progress(0.89, 'Simplifying to about ' + prm.target + ' quads'); Mfit = M.clone(); coarsen(M, Mfit, curves, Lo, L, 14); M.compact(); }
  }
  if (guides.length){
    flow = flowField(M, [...guides.map(C => ({ C, w: 1 })), ...curves.map(C => ({ C, w: 0.35 }))], h);
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
    flow = flowField(M, [...guides.map(C => ({ C, w: 1 })), ...curves.map(C => ({ C, w: 0.35 }))], h);
  }
  if (prm.relax > 0){ progress(0.91, 'Relaxing'); relaxMesh(M, Math.round(prm.relax * prm.relax * 0.8 + prm.relax * 2), flow); }
  const folds = unfold(M, 25);
  progress(0.93, 'Making quads');
  const cage = quadify(M, curves, flow);
  progress(0.95, 'Squaring up the quads');
  squareQuads(cage, M, flow, prm.squareIters ?? 32, L, Mfit);
  if (prm.hard > 0) autoCreases(cage, prm.hard);
  progress(0.97, 'Hugging the surface');
  hugCage(cage, M, Mfit, curves, L, 6);
  const lv = 1 + (prm.subd | 0); prepTips(cage, prm.tipFade || 0); applyTips(cage, lv);
  const quads = catmullClark(cage, curves);
  let smooth = quads; for (let i = 0; i < (prm.subd | 0); i++){ applyTips(smooth, lv - 1 - i); smooth = catmullClark(smooth, curves); }
  smooth = hardView(smooth);
  const sh = shade(smooth);
  if (paint){ sh.paint = new Float32Array(sh.pos.length / 3); for (let i = 0; i < sh.paint.length; i++) sh.paint[i] = paint(sh.pos[3 * i], sh.pos[3 * i + 1], sh.pos[3 * i + 2]); }
  progress(1, 'Done');
  return {
    surface: sh, quadWire: wire(quads), fineWire: smooth === quads ? null : wire(smooth), creases: creaseLines(smooth),
    quads: { V: new Float32Array(quads.V), F: new Int32Array(quads.F.flat()), C: new Int32Array(quads.F.map(f => f.length)) },
    curves: [...curves.map(C => ({ tag: C.tag, closed: C.closed, strict: !!C.strict, edge: !!C.edge, pts: C.pts.flat() })),
      ...guides.map(C => ({ tag: C.tag, closed: C.closed, guide: true, pts: C.pts.flat() }))],
    nQuads: quads.F.length, folds,
    note: prm.target < 0 ? (guides.length ? 'Couldn\'t lay quads along your guides here, so Auto was used. Make sure guides cross each other or reach the border.' : 'Draw guides on the surface to lay out the quads (Auto until then)') : ''
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
      const prog = (p, msg) => { const now = Date.now(); if (now - last > 120 || p >= 1){ last = now; self.postMessage({ type: 'progress', id, p, msg }); } };
      // if a build breaks, try again more simply rather than showing nothing: first without the newer extras,
      // then with strict lines treated as averaged ones, then with every crease and edge treated as a loose line
      let r = null, why = '';
      const tries = [
        [strokes, prm, ''],
        [strokes, { ...prm, sides: false, tipFade: 0, target: prm.target < 0 ? 0 : prm.target, hard: 0 }, 'Built a simpler way: guide layout, crease ends and smart creases were skipped this time.'],
        [strokes.map(s => (s.tag === 2 || s.tag === 4 || s.tag === 6) ? { ...s, tag: s.tag - 1 } : s), { ...prm, sides: false, tipFade: 0, target: 0, hard: 0 }, 'Built a simpler way: strict lines were treated as averaged ones. One of them is likely the trouble.'],
        [strokes.map(s => s.tag >= 3 ? { ...s, tag: 0 } : s), { ...prm, sides: false, tipFade: 0, target: 0, hard: 0 }, 'Built without creases or edges: one of them is the trouble. Undo your last crease, or press Back to last good.']];
      for (const [st, pr, note] of tries){ try { r = solve(st, pr, prog); if (note && r && !r.empty) r.note = note + (why ? ' (' + why + ')' : ''); break; } catch (e){ if (!why) why = String((e && e.message) || e); } }
      if (!r) throw new Error(why || 'unknown problem');
      const tr = r.surface ? [...(r.quads.C ? [r.quads.C.buffer] : []), ...(r.surface.paint ? [r.surface.paint.buffer] : []), r.surface.pos.buffer, r.surface.nrm.buffer, r.quadWire.buffer, ...(r.fineWire ? [r.fineWire.buffer] : []), r.creases.buffer, r.quads.V.buffer, r.quads.F.buffer] : [];
      self.postMessage({ type: 'done', id, r }, tr);
    } catch (err){ self.postMessage({ type: 'error', id, msg: String((err && err.message) || err) }); }
  };
}
})(typeof self !== 'undefined' ? self : globalThis);
