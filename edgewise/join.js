// Edgewise join: what the shapes add up to.
// Your sketch stays as lines and flat faces you can keep editing; this only works out what to show (and export).
//
// Material is whatever a shell of faces walls in. Shells are applied in order: your own sketch first, then each
// pushed or pulled body as it was made. One that adds puts material where it is; one that cuts (a face pushed in)
// takes material away where it is. So overlapping solids show as one, a door pushed into a wall is a recess, a
// window pushed right through is a hole, and it doesn't matter how the shells run through each other.
//
// How: a point of some face is on the final surface when there is material just on one side of it and none just on
// the other. So for each face, every shell near it is cut by the face's plane (a hair to each side where it has to
// be), the cut lines are filled in ("everything walled in"), the fills are folded together in order (add / cut)
// into "where is material" on each side, and the face keeps the part where the two sides differ. (A part with
// material on both sides is buried; one with none on either has been cut away.) Faces that aren't part of anything
// closed (an open box, a flap) are loose surfaces and stay as they are.
// The 2D sums are done by polygon-clipping (pc).

import { planeOf, basis, V } from './core.js';
const { sub, add, mul, dot, cross, norm } = V;

const EPS = 5e-4;        // half a millimetre at 1:1: how far "touching" reaches

// Where a set of faces (faces: [{ loop, holes, n }]) crosses the plane n·x = d, looked at from just to one side of it
// (side = -1: just under, +1: just over): pieces of line, as pairs of 3D points. A corner lying on the plane (within
// tau) counts as on the far side, and the crossing is at that corner. So a face lying in the plane isn't crossed,
// a wall that stands on the plane is crossed (at its foot) only from the side it stands on, and a face that passes
// through at any angle, however shallow, is crossed exactly where it passes. own: corners that are on the plane
// whatever the numbers say (those of the face whose plane it is).
function cutSegs(faces, X, n, d, side, tau, own){
  const segs = [], memo = new Map();
  const at = id => { let v = memo.get(id); if (!v){ const s = dot(n, X[id]) - d, on = Math.abs(s) < tau || (own && own.has(id)); v = { s, on, pos: on ? side < 0 : s > 0 }; memo.set(id, v); } return v; };
  for (const f of faces){
    const cr = cross(n, f.n);
    if (Math.hypot(cr[0], cr[1], cr[2]) < 1e-9) continue;          // parallel to the plane: no crossing
    const L = norm(cr), hits = [];
    for (const lp of [f.loop, ...f.holes]){
      for (let i = 0; i < lp.length; i++){
        let a = lp[i], b = lp[(i + 1) % lp.length];
        if (a > b){ const t = a; a = b; b = t; }                  // always worked out the same way round, so the two faces on a line agree exactly
        const A = at(a), B = at(b);
        if (A.pos === B.pos) continue;
        const p = A.on ? X[a] : B.on ? X[b] : add(X[a], mul(sub(X[b], X[a]), A.s / (A.s - B.s)));
        hits.push({ p, s: dot(p, L) });
      }
    }
    hits.sort((x, y) => x.s - y.s);
    for (let i = 0; i + 1 < hits.length; i += 2) segs.push([hits[i].p, hits[i + 1].p]);
  }
  return segs;
}

const area2 = r => { let a = 0; for (let i = 0; i < r.length; i++){ const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
const sarea2 = r => { let a = 0; for (let i = 0; i < r.length; i++){ const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const mpArea = mp => mp.reduce((s, poly) => s + area2(poly[0]) - poly.slice(1).reduce((t, r) => t + area2(r), 0), 0);
const perim = r => { let L = 0; for (let i = 0; i < r.length; i++){ const p = r[i], q = r[(i + 1) % r.length]; L += Math.hypot(p[0] - q[0], p[1] - q[1]); } return L; };
const sliver = r => { const a = area2(r); return a < 1e-6 || a < perim(r) * 4e-4; };   // thinner than about a millimetre
const unclose = r => { const rr = r.slice(); const a = rr[0], z = rr[rr.length - 1]; if (rr.length > 1 && a[0] === z[0] && a[1] === z[1]) rr.pop(); return rr; };

// 2D shapes are put on a fine grid before they're summed: edges that are nearly on top of each other (which the
// sums can choke on) become exactly on top of each other. If a sum still gives up, a coarser grid is tried.
const GRIDS = [1e-5, 1e-4, 3e-4, 1e-3];
const snapRing = (r, g) => { const out = []; for (const p of r){ const q = [Math.round(p[0] / g) * g, Math.round(p[1] / g) * g], z = out[out.length - 1]; if (!z || z[0] !== q[0] || z[1] !== q[1]) out.push(q); } if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop(); return out; };
const snapPoly = (poly, g) => { const rs = poly.map(r => snapRing(r, g)).filter((r, i) => r.length >= 3 && area2(r) > g * g); return rs.length && poly[0].length >= 3 && area2(snapRing(poly[0], g)) > g * g ? rs : null; };
const snapMP = (mp, g) => mp.map(poly => snapPoly(poly, g)).filter(Boolean);

// Everything walled in by a set of line pieces in a plane ([[p, q], ...] in 2D): the closed cells they make, as
// rings. Pieces may cross, overlap or dangle; where they cross they are cut, and ends that lead nowhere are dropped.
function cells(segs, g){
  const R = x => Math.round(x / g), S = [];
  for (const [a, b] of segs){ const p = [R(a[0]), R(a[1])], q = [R(b[0]), R(b[1])]; if (p[0] !== q[0] || p[1] !== q[1]) S.push([p, q]); }
  if (S.length < 3) return [];
  // cut every piece where another crosses or touches it (grid units from here on, so the tests are exact enough)
  const stops = S.map(([p, q]) => [{ t: 0, p }, { t: 1, p: q }]);
  for (let i = 0; i < S.length; i++){
    const [p, q] = S[i], d1x = q[0] - p[0], d1y = q[1] - p[1];
    const lo1x = Math.min(p[0], q[0]), hi1x = Math.max(p[0], q[0]), lo1y = Math.min(p[1], q[1]), hi1y = Math.max(p[1], q[1]);
    for (let j = i + 1; j < S.length; j++){
      const [r, s] = S[j];
      if (Math.max(r[0], s[0]) < lo1x - 1 || Math.min(r[0], s[0]) > hi1x + 1 || Math.max(r[1], s[1]) < lo1y - 1 || Math.min(r[1], s[1]) > hi1y + 1) continue;
      const d2x = s[0] - r[0], d2y = s[1] - r[1], den = d1x * d2y - d1y * d2x, wx = r[0] - p[0], wy = r[1] - p[1];
      const L1 = Math.hypot(d1x, d1y), L2 = Math.hypot(d2x, d2y);
      if (Math.abs(den) > 1e-9 * L1 * L2 && Math.abs(den) > 0.5){
        const t = (wx * d2y - wy * d2x) / den, u = (wx * d1y - wy * d1x) / den, e1 = 0.75 / L1, e2 = 0.75 / L2;
        if (t < -e1 || t > 1 + e1 || u < -e2 || u > 1 + e2) continue;
        // the crossing: at an end if it's within a grid step of one (so ends that meet stay met)
        let x;
        if (t < e1) x = p; else if (t > 1 - e1) x = q; else if (u < e2) x = r; else if (u > 1 - e2) x = s;
        else x = [Math.round(p[0] + d1x * t), Math.round(p[1] + d1y * t)];
        stops[i].push({ t, p: x }); stops[j].push({ t: u, p: x });
      } else {
        // along the same line? then each one's ends cut the other
        if (Math.abs(wx * d1y - wy * d1x) / L1 > 0.75) continue;
        for (const [k, a, b, ends] of [[i, p, q, [r, s]], [j, r, s, [p, q]]]){
          const dx = b[0] - a[0], dy = b[1] - a[1], LL = dx * dx + dy * dy;
          for (const e of ends){ const t = ((e[0] - a[0]) * dx + (e[1] - a[1]) * dy) / LL; if (t > 0 && t < 1 && Math.abs((e[0] - a[0]) * dy - (e[1] - a[1]) * dx) / Math.sqrt(LL) <= 0.75) stops[k].push({ t, p: e }); }
        }
      }
    }
  }
  // the graph: corners and the pieces between them (each once)
  const nodes = new Map(), key = p => p[0] + ',' + p[1], seen = new Set();
  const node = p => { const k = key(p); let n = nodes.get(k); if (!n){ n = { p, k, nb: [] }; nodes.set(k, n); } return n; };
  for (const st of stops){
    st.sort((x, y) => x.t - y.t);
    for (let i = 0; i + 1 < st.length; i++){
      const a = st[i].p, b = st[i + 1].p; if (a[0] === b[0] && a[1] === b[1]) continue;
      const ka = key(a), kb = key(b), ek = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      if (seen.has(ek)) continue; seen.add(ek);
      const na = node(a), nb = node(b); na.nb.push(nb); nb.nb.push(na);
    }
  }
  const drop = (a, b) => { a.nb.splice(a.nb.indexOf(b), 1); b.nb.splice(b.nb.indexOf(a), 1); };
  for (let round = 0; round < 8; round++){
    // ends that lead nowhere
    const q = [...nodes.values()].filter(n => n.nb.length === 1);
    while (q.length){ const n = q.pop(); if (n.nb.length !== 1) continue; const m = n.nb[0]; drop(n, m); if (m.nb.length === 1) q.push(m); }
    // walk round every cell (keeping it on the left)
    for (const n of nodes.values()) if (n.nb.length) n.nb.sort((a, b) => Math.atan2(a.p[1] - n.p[1], a.p[0] - n.p[0]) - Math.atan2(b.p[1] - n.p[1], b.p[0] - n.p[0]));
    const used = new Set(), rings = [], bridges = [];
    for (const n of nodes.values()) for (const m of n.nb){
      if (used.has(n.k + '>' + m.k)) continue;
      const ring = [], mine = new Set(); let a = n, b = m, guard = 0;
      while (!used.has(a.k + '>' + b.k) && guard++ < 100000){
        used.add(a.k + '>' + b.k); mine.add(a.k + '>' + b.k); ring.push(a.p);
        const i = b.nb.indexOf(a), c = b.nb[(i - 1 + b.nb.length) % b.nb.length];
        a = b; b = c;
      }
      // a piece walked both ways by one cell only joins two parts of the drawing: it walls nothing in
      for (const k of mine){ const [x, y] = k.split('>'); if (x < y && mine.has(y + '>' + x)) bridges.push([x, y]); }
      if (sarea2(ring) > 0.5) rings.push(ring);
    }
    if (!bridges.length) return rings.map(r => r.map(p => [p[0] * g, p[1] * g]));
    for (const [x, y] of bridges) drop(nodes.get(x), nodes.get(y));
  }
  return [];
}
// the filled-in shape: all the cells together
function fill(segs, g, pc){
  const rings = cells(segs, g);
  if (!rings.length) return [];
  if (rings.length === 1) return [[rings[0]]];
  return snapMP(pc.union(...rings.map(r => [r])), g);
}

// the shells, in the order they apply (your own sketch first, then pushed / pulled bodies as they were made)
function membersOf(F, X){
  const out = [];
  for (const sh of F.shells || []){
    if (sh.faces.length < 4) continue;
    if (sh.faces.some(f => f.all.some(id => !X[id]))) continue;
    // only the closed part of a shell walls anything in: faces with a line no other face shares (the rim of an
    // open box, a flap hanging off a solid) are peeled away, again and again, until what's left has none
    let core = sh.faces, lent = [];
    if (!sh.clean){
      const use = new Map(); for (const f of core) for (const k of f.es) use.set(k, (use.get(k) || 0) + 1);
      // a shell of your sketch that is tied to a pushed or pulled body (it uses that body's lines) is closed off by
      // the body's faces too: they are lent to it as walls. (Lending a cutting body's walls does no harm: what they
      // wall in is added here and taken away again when the cut is applied, after.)
      if (sh.faces.some(f => f.glue)){
        for (const b of F.shells){
          if (b.L <= 0 || !b.faces.some(f => f.es.some(k => use.has(k)))) continue;
          for (const f of b.faces){ lent.push(f); for (const k of f.es) use.set(k, (use.get(k) || 0) + 1); }
        }
      }
      for (let again = true; again;){
        again = false;
        core = core.filter(f => { if (!f.es.some(k => use.get(k) < 2)) return true; for (const k of f.es) use.set(k, use.get(k) - 1); again = true; return false; });
      }
      if (core.length < 4) continue;
    }
    const wall = f => ({ f, loop: f.ids, holes: f.holes, n: planeOf(f.ids.map(id => X[id])).n, open: f.open });
    const faces = core.map(f => { const loop = sh.clean && f.loop ? f.loop : f.ids; return { f, loop, holes: f.holes, n: planeOf(loop.map(id => X[id])).n, open: f.open }; });
    const ids = [...new Set(core.flatMap(f => f.all))];
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const id of ids) for (let k = 0; k < 3; k++){ lo[k] = Math.min(lo[k], X[id][k]); hi[k] = Math.max(hi[k], X[id][k]); }
    out.push({ pid: sh.id, cut: !!sh.cut, clean: !!sh.clean, faces, walls: lent.length ? faces.concat(lent.filter(f => f.all.every(id => X[id])).map(wall)) : faces, lo, hi, ids, core: new Set(core) });
  }
  return out;
}
// how far a shell's box reaches either side of the plane n·x = d
function reach(S, n, d){
  let mn = Infinity, mx = -Infinity;
  for (const x of [S.lo[0], S.hi[0]]) for (const y of [S.lo[1], S.hi[1]]) for (const z of [S.lo[2], S.hi[2]]){ const s = dot(n, [x, y, z]) - d; mn = Math.min(mn, s); mx = Math.max(mx, s); }
  return [mn, mx];
}
// where there is material just to one side (side = -1 or +1) of the plane n·x = d, as 2D shapes (to2 maps 3D → the
// plane's 2D): every shell's crossing with the plane, filled in, and folded together in order (add / cut)
function regionAt(members, X, n, d, side, to2, pc, g = GRIDS[0], own = null){
  let R = [];
  for (const S of members){
    const [mn, mx] = reach(S, n, d);
    if (mn > EPS || mx < -EPS) continue;
    if (S.cut && !R.length) continue;
    const segs = cutSegs(S.walls, X, n, d, side, EPS, own);
    if (segs.length < 3) continue;
    const reg = fill(segs.map(([p, q]) => [to2(p), to2(q)]), g, pc);
    if (!reg.length) continue;
    R = snapMP(S.cut ? pc.difference(R, reg) : (R.length ? pc.union(R, reg) : reg), g);
  }
  return R;
}

// Faces of different shells that are a hair apart (pulled "until flush" by eye, or drawn on a face and then nudged
// by tidying) are made to really touch: when every corner of a face is within a few millimetres of the plane of an
// earlier shell's face that it overlaps, the whole face moves onto that plane. Works on a copy of the positions (X),
// for showing and export only; the sketch itself is left as drawn. moved: the corners that were shifted.
function snapTogether(ms, X, moved, SNAP){
  const info = f => {
    const P = f.loop.map(id => X[id]), pl = planeOf(P);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of P) for (let k = 0; k < 3; k++){ lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    return { n: pl.n, c: pl.c, lo, hi };
  };
  const pad = 0.01;
  for (let b = 1; b < ms.length; b++){
    const B = ms[b];
    for (const g of B.faces){
      let done = false;
      for (let a = 0; a < b && !done; a++){
        const A = ms[a]; A.idset = A.idset || new Set(A.ids);
        if (g.f.all.every(id => A.idset.has(id))) continue;                 // a face they share already
        if (![0, 1, 2].every(k => A.lo[k] <= B.hi[k] + pad && B.lo[k] <= A.hi[k] + pad)) continue;
        const G = info(g);
        for (const f of A.faces){
          const Fp = info(f);
          if (Math.abs(dot(Fp.n, G.n)) < 0.9995) continue;
          if (![0, 1, 2].every(k => G.lo[k] <= Fp.hi[k] + pad && Fp.lo[k] <= G.hi[k] + pad)) continue;
          const hs = g.f.all.map(id => dot(Fp.n, sub(X[id], Fp.c)));
          if (hs.some(h => Math.abs(h) > SNAP) || hs.every(h => Math.abs(h) < 1e-7)) continue;
          g.f.all.forEach((id, i) => { if (A.idset.has(id) || Math.abs(hs[i]) < 1e-9) return; X[id] = sub(X[id], mul(Fp.n, hs[i])); moved.add(id); });
          done = true; break;
        }
      }
    }
  }
}

// F: findFaces result, X: corner positions. opt.snap: how close counts as flush (default 4 mm).
// Returns { group: Map shell → group id (shells that touch), faces: [{ shell, group, n, rings: [outer, ...holes]
//           (3D) }], replaced: Set of faces (objects from F.faces) not to draw as they are, shown: those of them
//           that still show in part, out: Map face → which way is out of the material, loose: Set of faces that
//           aren't part of anything closed, solids: how many separate solid lumps, groups, X: the positions used }
export function joinSolids(sk, F, X0, pc, opt = {}){
  const members = membersOf(F, X0);
  let X = X0;
  const group = new Map(), out = [], replaced = new Set(), groups = [], outOf = new Map(), loose = new Set(), shown = new Set();
  const J = { group, faces: out, replaced, groups, out: outOf, loose, shown, solids: 0, X };
  // faces of shells too small to wall anything in are loose surfaces
  { const ok = new Map(members.map(m => [m.pid, m.core])); for (const f of F.faces) if (!ok.has(f.shell) || !ok.get(f.shell).has(f)) loose.add(f); }
  if (!members.length) return J;
  // groups: shells whose boxes overlap or touch
  const par = members.map((_, i) => i), root = i => par[i] === i ? i : (par[i] = root(par[i]));
  for (let a = 0; a < members.length; a++) for (let b = a + 1; b < members.length; b++){
    const A = members[a], B = members[b];
    if ([0, 1, 2].every(k => A.lo[k] <= B.hi[k] + EPS && B.lo[k] <= A.hi[k] + EPS)){ const ra = root(a), rb = root(b); if (ra !== rb) par[Math.max(ra, rb)] = Math.min(ra, rb); }
  }
  const byRoot = new Map();
  members.forEach((S, i) => { const r = root(i); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(S); });
  const moved = new Set();
  for (const [, ms] of byRoot){
    if (ms.length < 2) continue;
    if (X === X0) X = J.X = Object.assign({}, X0);
    snapTogether(ms, X, moved, opt.snap ?? 4e-3);
  }
  if (moved.size) for (const S of members){
    if (!S.ids.some(id => moved.has(id))) continue;
    for (const f of S.walls) f.n = planeOf(f.loop.map(id => X[id])).n;
    S.lo = [Infinity, Infinity, Infinity]; S.hi = [-Infinity, -Infinity, -Infinity];
    for (const id of S.ids) for (let k = 0; k < 3; k++){ S.lo[k] = Math.min(S.lo[k], X[id][k]); S.hi[k] = Math.max(S.hi[k], X[id][k]); }
  }
  for (const [, ms] of byRoot){
    const gid = (ms.find(S => !S.cut) || ms[0]).pid;
    for (const S of ms) group.set(S.pid, gid);
    groups.push(ms);
    let solid = false;
    // a cut is never drawn as it is: only what it leaves of the others
    for (const S of ms) if (S.cut) for (const f of S.faces) replaced.add(f.f);
    // a plain closed solid on its own shows as it is
    if (ms.length === 1 && ms[0].clean){ if (!ms[0].cut){ J.solids++; for (const f of ms[0].faces) if (f.f.out) outOf.set(f.f, f.f.out); } continue; }
    const done = [];           // what's already been given out, per plane (so two faces lying on each other show once)
    for (const A of ms){
      for (const f of A.faces){
        const n = f.n, c = X[f.loop[0]], d0 = dot(n, c), [u, w] = basis(n);
        const to2 = p => { const q = sub(p, c); return [dot(q, u), dot(q, w)]; };
        const to3 = q => add(c, add(mul(u, q[0]), mul(w, q[1])));
        const me0 = [f.loop.map(id => to2(X[id])), ...f.holes.map(H => H.map(id => to2(X[id])))];
        // does anything else come near this face's plane?
        const near = ms.some(B => { if (B === A) return false; const [mn, mx] = reach(B, n, d0); return mn <= EPS * 1.5 && mx >= -EPS * 1.5; });
        const touched = f.f.all.some(id => moved.has(id)), own = new Set(f.f.all);
        if (A.clean && !near && !touched){
          if (!A.cut){ done.push({ n, at: c, polys: [me0.map(r => r.map(to3))] }); solid = true; if (f.f.out) outOf.set(f.f, f.f.out); }
          continue;
        }
        const attempt = g => {
          const me = snapPoly(me0, g); if (!me) return null;
          const Rin = regionAt(ms, X, n, d0, -1, to2, pc, g, own), Rout = regionAt(ms, X, n, d0, 1, to2, pc, g, own);
          const a = Rin.length ? (Rout.length ? snapMP(pc.difference(Rin, Rout), g) : Rin) : [];
          const b = Rout.length ? (Rin.length ? snapMP(pc.difference(Rout, Rin), g) : Rout) : [];
          let outPart = a.length ? snapMP(pc.intersection([me], a), g) : [];
          let inPart = b.length ? snapMP(pc.intersection([me], b), g) : [];
          const full = area2(me[0]) - me.slice(1).reduce((s, r) => s + area2(r), 0), tolS = Math.max(1e-7, full * 1e-4, perim(me[0]) * 2e-4);
          // minus what an earlier face on the same plane, facing the same way, already covers
          let shared = false;
          const less = (part, nn) => {
            for (const e of done){
              if (dot(e.n, nn) < 0.9999 || Math.abs(dot(e.n, sub(c, e.at))) > EPS * 2 || !part.length) continue;
              const before = mpArea(part), cutters = snapMP(e.polys.map(poly => poly.map(r => r.map(to2))), g);
              if (!cutters.length) continue;
              part = snapMP(pc.difference(part, ...cutters), g);
              if (Math.abs(mpArea(part) - before) > 1e-7) shared = true;
            }
            return part;
          };
          const ao = mpArea(outPart), ai = mpArea(inPart);
          outPart = less(outPart, n);
          inPart = less(inPart, mul(n, -1));
          const same = A.clean && !A.cut && !shared && !touched && !ai && Math.abs(ao - full) < tolS;
          return { same, side: ao >= ai ? (ao > 0 ? 1 : 0) : -1, parts: [[outPart, n], [inPart, mul(n, -1)]] };
        };
        let res, err;
        for (const g of GRIDS){ try { res = attempt(g); err = null; break; } catch (e) { err = e; } }
        if (err){
          // the 2D sums gave up on this face (shapes too nearly on top of each other): show it as it is
          if (opt.debug) console.log('join gave up on a face:', err.message);
          if (f.f.out) outOf.set(f.f, f.f.out);
          continue;
        }
        if (!res) continue;
        if (res.side) outOf.set(f.f, mul(n, res.side));
        if (res.same){ done.push({ n, at: c, polys: [me0.map(r => r.map(to3))] }); solid = true; continue; }
        replaced.add(f.f);
        for (const [part, nn] of res.parts){
          const polys = part.filter(poly => !sliver(poly[0])).map(poly => poly.map(r => unclose(r).map(to3)));
          if (!polys.length) continue;
          done.push({ n: nn, at: c, polys });
          solid = true;
          if (!f.open){ shown.add(f.f); for (const rings of polys) out.push({ shell: A.pid, group: gid, n: nn, rings }); }
        }
      }
    }
    if (solid) J.solids++;
  }
  return J;
}

// ---------------------------------------------------------------- trim below the floor
// Everything under the floor (y < 0) is cut away. Faces crossing the floor are cut along it; solids that go
// through the floor get a flat cap there (solids that join share one cap), so they stay closed.
// J: a joinSolids result. Returns the same shape.
export function trimFloor(sk, F, X, pc, J){
  const out = [], replaced = new Set(J.replaced), XJ = J.X || X;
  // cut one face (rings in 3D, normal n) to the part at or above the floor; null = untouched, [] = all below
  const cut = (rings, n) => {
    let lo = Infinity, hi = -Infinity;
    for (const r of rings) for (const p of r){ lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
    if (lo >= -EPS) return null;
    if (hi <= EPS) return [];
    const o = rings[0][0], [u, w] = basis(n);
    const to2 = p => { const q = sub(p, o); return [dot(q, u), dot(q, w)]; }, to3 = q => add(o, add(mul(u, q[0]), mul(w, q[1])));
    const poly = rings.map(r => r.map(to2));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of poly[0]){ x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    // the part of the face's plane above the floor: a big box clipped by the floor line
    const above = q => o[1] + u[1] * q[0] + w[1] * q[1];
    const box = [[x0 - 1, y0 - 1], [x1 + 1, y0 - 1], [x1 + 1, y1 + 1], [x0 - 1, y1 + 1]], half = [];
    for (let i = 0; i < 4; i++){
      const a = box[i], b = box[(i + 1) % 4], ha = above(a), hb = above(b);
      if (ha >= 0) half.push(a);
      if ((ha >= 0) !== (hb >= 0)){ const t = ha / (ha - hb); half.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    if (half.length < 3) return [];
    let res = null;
    for (const g of GRIDS){ try { const a = snapPoly(poly, g), b = snapPoly([half], g); if (!a || !b) return []; res = pc.intersection(a, b); break; } catch (e) {} }
    if (!res) return null;
    return res.filter(p => !sliver(p[0])).map(p => p.map(r => unclose(r).map(to3).map(q => [q[0], Math.max(0, q[1]), q[2]])));
  };
  let any = false;
  // faces already reshaped by Join
  for (const f of J.faces){
    const c = cut(f.rings, f.n);
    if (c === null){ out.push(f); continue; }
    any = true; for (const rings of c) out.push(Object.assign({}, f, { rings }));
  }
  // the rest of the faces
  for (const f of F.faces){
    if (f.open || replaced.has(f) || f.all.some(id => !X[id])) continue;
    const loop = f.loop || f.ids, n = planeOf(loop.map(id => X[id])).n;
    const c = cut([loop.map(id => X[id]), ...f.holes.map(h => h.map(id => X[id]))], n);
    if (c === null) continue;
    any = true; replaced.add(f);
    const g = J.group.get(f.shell) ?? f.shell;
    for (const rings of c) out.push({ shell: f.shell, group: g, n, rings, loose: !f.loop || J.loose.has(f) });
  }
  // caps where solids pass through the floor, one per joined group
  const down = [0, -1, 0], [cu, cw] = basis(down), c2 = p => [dot(p, cu), dot(p, cw)];
  for (const ms of J.groups){
    if (!ms.some(S => !S.cut && S.lo[1] < -EPS && S.hi[1] > EPS)) continue;
    let reg = null;
    for (const g of GRIDS){ try { reg = regionAt(ms, XJ, [0, 1, 0], 0, 1, c2, pc, g); break; } catch (e) {} }
    if (!reg) continue;
    const first = ms.find(S => !S.cut);
    for (const poly of reg){
      if (!poly || area2(poly[0]) < 1e-6) continue;
      any = true;
      out.push({ shell: first.pid, group: J.group.get(first.pid) ?? first.pid, n: down, rings: poly.map(r => unclose(r).map(q => add(mul(cu, q[0]), mul(cw, q[1])))) });
    }
  }
  if (!any) return J;
  return Object.assign({}, J, { faces: out, replaced });
}

// volume and surface area of what's shown as solid: the joined faces plus the untouched faces of solids (for checking)
export function measure(F, X, J){
  let vol = 0, area = 0, bal = [0, 0, 0];
  const ring3 = r => { let a = [0, 0, 0]; for (let i = 0; i < r.length; i++) a = add(a, cross(r[i], r[(i + 1) % r.length])); return Math.hypot(...a) / 2; };
  const put = (n, rings) => { const A = ring3(rings[0]) - rings.slice(1).reduce((s, r) => s + ring3(r), 0); area += A; vol += dot(n, rings[0][0]) * A / 3; bal = add(bal, mul(n, A)); };
  for (const f of F.faces){
    if (f.open || !f.loop || !F.pieces[f.piece].solid || J.replaced.has(f) || J.loose.has(f)) continue;
    put(planeOf(f.loop.map(id => X[id])).n, [f.loop.map(id => X[id]), ...f.holes.map(h => h.map(id => X[id]))]);
  }
  for (const f of J.faces) if (!f.loose) put(f.n, f.rings);
  return { vol, area, leak: Math.hypot(...bal) };
}
