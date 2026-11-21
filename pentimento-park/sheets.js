// Pentimento Park · ramp sheets: the riding skin cut the way a wooden park is sheeted.
//
// A sheet of plywood bends one way at a time. So each sheet here is a block of the surface's own quads, grown along the
// quad lines for as long as one sheet, bending one way and straight the other, still covers it within the gap you
// allow, and it still fits the stock:
//   FLAT   decks, flat bottoms, banks           big sheets, no bending
//   BEND   transitions that curve one way       big sheets bent over the curve (grown up the slope first)
//   GORE   bowl corners, anything curved two    blocks that had to stay narrow: tapered strips running up the curve
//          ways at once
// Creases (coping, hips, deck edges) are always seams, and every other seam is one of the surface's quad lines. Each
// block is then unrolled flat for cutting.
//
// make({ pos, creases, cells, tol, sheet: [long, short], minR, up }) → { pieces, zones, note }
//   pos      triangle soup of the smooth surface (park metres), quads as fans (0,1,2)(0,2,3) in subdivision order
//   creases  line segments along the surface's creases (matched to the mesh by position)
//   cells    how many quads the surface was subdivided from (their children come in order); a list of guesses is fine
//   tol      how far a sheet may stand off the surface (park metres)
//   sheet    the biggest piece, long and short side (park metres)
//   minR     the tightest radius the sheet bends to (park metres)
(function (root, factory){ const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.PentimentoSheets = api; })(typeof self !== 'undefined' ? self : this, function (){
'use strict';
const FLAT = 0, BEND = 1, GORE = 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const pct = (arr, q) => { if (!arr.length) return 0; const s = Float64Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

function make(inp){
  const pos = inp.pos, tol = inp.tol, LONG = Math.max(inp.sheet[0], inp.sheet[1]), SHORT = Math.min(inp.sheet[0], inp.sheet[1]), minR = inp.minR || 0;
  // ---------- the mesh: welded points, quads back from their two triangles
  const nS = pos.length / 3, key = new Map(), vid = new Int32Array(nS), X = [], pk = (x, y, z) => Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
  for (let i = 0; i < nS; i++){ const k = pk(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]); let v = key.get(k); if (v === undefined){ v = X.length / 3; key.set(k, v); X.push(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]); } vid[i] = v; }
  const P = v => [X[3 * v], X[3 * v + 1], X[3 * v + 2]], F = []; let allQuads = true;
  for (let t = 0; t < nS / 3;){ const a = vid[3 * t], b = vid[3 * t + 1], c = vid[3 * t + 2];
    if (t + 1 < nS / 3 && vid[3 * t + 3] === a && vid[3 * t + 4] === c){ F.push([a, b, c, vid[3 * t + 5]]); t += 2; } else { F.push([a, b, c]); allQuads = false; t++; } }
  const nF = F.length, EK = 4194304, ek = (a, b) => a < b ? a * EK + b : b * EK + a;
  const ef = new Map(); F.forEach((f, fi) => { for (let i = 0; i < f.length; i++){ const a = f[i], b = f[(i + 1) % f.length]; if (a === b) continue; const k = ek(a, b); (ef.get(k) || ef.set(k, []).get(k)).push(fi); } });
  const crease = new Set(); if (inp.creases) for (let i = 0; i + 5 < inp.creases.length; i += 6){ const a = key.get(pk(inp.creases[i], inp.creases[i + 1], inp.creases[i + 2])), b = key.get(pk(inp.creases[i + 3], inp.creases[i + 4], inp.creases[i + 5])); if (a !== undefined && b !== undefined && a !== b) crease.add(ek(a, b)); }
  const fN = new Array(nF), fC = new Array(nF), fA = new Float64Array(nF);
  for (let fi = 0; fi < nF; fi++){ const f = F[fi], p = f.map(P), n = f.length === 4 ? cross(sub(p[2], p[0]), sub(p[3], p[1])) : cross(sub(p[1], p[0]), sub(p[2], p[0]));
    fA[fi] = len(n) / 2; fN[fi] = unit(n); const c = [0, 0, 0]; for (const q of p){ c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; } fC[fi] = c.map(x => x / f.length); }
  const fNb = F.map((f, fi) => { const o = []; for (let i = 0; i < f.length; i++){ const k = ek(f[i], f[(i + 1) % f.length]); if (crease.has(k)) continue; for (const g of ef.get(k) || []) if (g !== fi) o.push(g); } return o; });
  const up = inp.up || [0, 1, 0];
  // ---------- cells: the control-level quads the surface was subdivided from (zones meet along their lines)
  let per = 0; if (allQuads) for (const n of [].concat(inp.cells || [])){ if (!(n > 0) || nF % n) continue; let p = nF / n; while (p > 1 && p % 4 === 0) p /= 4; if (p === 1){ per = nF / n; break; } }
  // cells small enough to build sheets from: a few across a sheet's short side (finer levels of the same quad lines)
  if (per){ let tot = 0; for (let i = 0; i < nF; i++) tot += fA[i]; while (per > 1 && Math.sqrt(tot / (nF / per)) > SHORT / 5) per /= 4; }
  const nC = per ? nF / per : nF, cellOf = fi => per ? Math.floor(fi / per) : fi;
  const cQ = new Array(nC); for (let ci = 0; ci < nC; ci++){ if (!per){ cQ[ci] = F[ci]; continue; } cQ[ci] = per === 1 ? F[ci] : [0, 1, 2, 3].map(j => F[ci * per + j * (per / 4)][0]); }
  const cFaces = ci => { if (!per) return [ci]; const o = []; for (let i = 0; i < per; i++) o.push(ci * per + i); return o; };
  const cArea = new Float64Array(nC), cCen = new Array(nC), cN = new Array(nC);
  for (let ci = 0; ci < nC; ci++){ const fs = cFaces(ci), c = [0, 0, 0], n = [0, 0, 0]; let A = 0;
    for (const fi of fs){ const w = fA[fi]; A += w; for (let k = 0; k < 3; k++){ c[k] += fC[fi][k] * w; n[k] += fN[fi][k] * w; } }
    cArea[ci] = A; cCen[ci] = c.map(x => x / (A || 1)); cN[ci] = unit(n); }
  // cell neighbours across each side (never across a crease)
  const cEdge = new Map(); for (let ci = 0; ci < nC; ci++){ const q = cQ[ci]; for (let i = 0; i < q.length; i++){ if (q[i] === q[(i + 1) % q.length]) continue; const k = ek(q[i], q[(i + 1) % q.length]); (cEdge.get(k) || cEdge.set(k, []).get(k)).push(ci); } }
  // a cell side is a crease if the surface's edges along it are: test the first small edge leaving its corner
  const sideCrease = (ci, i) => { const q = cQ[ci], a = q[i], b = q[(i + 1) % q.length]; if (!per || per === 1) return crease.has(ek(a, b));
    const f = F[ci * per + i * (per / 4)]; return crease.has(ek(f[0], f[1])); };
  const cAcross = (ci, i) => { const q = cQ[ci], l = cEdge.get(ek(q[i], q[(i + 1) % q.length])) || []; if (l.length !== 2 || sideCrease(ci, i)) return -1; return l[0] === ci ? l[1] : l[0]; };
  const cNb = new Array(nC); for (let ci = 0; ci < nC; ci++){ const o = []; for (let i = 0; i < cQ[ci].length; i++){ const g = cAcross(ci, i); if (g >= 0) o.push(g); } cNb[ci] = o; }
  const sideOf = (c, g) => { for (let i = 0; i < cQ[c].length; i++) if (cAcross(c, i) === g) return i; return -1; };
  // regions: what creases and the border wall off from each other (pieces are named by region)
  const zone = new Int32Array(nC).fill(-1); let nZone = 0;
  for (let ci = 0; ci < nC; ci++){ if (zone[ci] >= 0) continue; const st = [ci]; zone[ci] = nZone; while (st.length){ const c = st.pop(); for (const g of cNb[c]) if (zone[g] < 0){ zone[g] = nZone; st.push(g); } } nZone++; }
  // ---------- sheets: blocks of cells, grown along the quad lines for as long as one sheet bending one way still covers
  // them within the gap and they still fit the sheet. A block is a little grid: each cell with the turn that puts its
  // sides in the block's order (south, east, north, west).
  const taken = new Uint8Array(nC), patches = [];
  const corner = (cell, k) => { const q = cQ[cell[0]]; return q[(cell[1] + k) % 4]; };
  const dist = (a, b) => Math.hypot(X[3 * a] - X[3 * b], X[3 * a + 1] - X[3 * b + 1], X[3 * a + 2] - X[3 * b + 2]);
  // the block's grid of corner points: G[j][i], j up the rows, i along them
  const gridOf = B => { const m = B.length, n = B[0].length, G = []; for (let j = 0; j <= m; j++){ const row = []; for (let i = 0; i <= n; i++){ const cj = Math.min(j, m - 1), ci = Math.min(i, n - 1), k = (j === m ? (i === n ? 2 : 3) : (i === n ? 1 : 0)); row.push(corner(B[cj][ci], k)); } G.push(row); } return G; };
  // how far a line of points strays from the straight line between its ends
  // (measured square to the surface: a line may curve within the sheet as much as it likes)
  const vN = new Float64Array(X.length); for (let fi = 0; fi < nF; fi++) for (const v of F[fi]){ vN[3 * v] += fN[fi][0] * fA[fi]; vN[3 * v + 1] += fN[fi][1] * fA[fi]; vN[3 * v + 2] += fN[fi][2] * fA[fi]; }
  const sag = L => { const a = P(L[0]), b = P(L[L.length - 1]), ab = sub(b, a), l2 = dot(ab, ab) || 1e-18; let d = 0; for (let i = 1; i + 1 < L.length; i++){ const v = L[i], p = sub(P(v), a), t = dot(p, ab) / l2, n = unit([vN[3 * v], vN[3 * v + 1], vN[3 * v + 2]]); d = Math.max(d, Math.abs(dot(sub(p, ab.map(x => x * t)), n))); } return d; };
  const arc = L => { let s = 0; for (let i = 0; i + 1 < L.length; i++) s += dist(L[i], L[i + 1]); return s; };
  // a sheet bends one way and stays straight the other: with its straight lines along the rows (or along the columns),
  // how far would it stand off? Straight lines that bow, and neighbouring straight lines that twist against each other
  const fit = B => { const G = gridOf(B), m = G.length - 1, n = G[0].length - 1, rows = G, cols = []; for (let i = 0; i <= n; i++) cols.push(G.map(r => r[i]));
    const off = (lines) => { let e = 0; for (const L of lines) e = Math.max(e, sag(L));
      for (let k = 0; k + 1 < lines.length; k++){ const a = P(lines[k][0]), b = P(lines[k][lines[k].length - 1]), c = P(lines[k + 1][lines[k + 1].length - 1]), d = P(lines[k + 1][0]), nn = cross(sub(c, a), sub(d, b)), l = len(nn); if (l > 1e-12) e = Math.max(e, Math.abs(dot(sub(b, a), nn)) / l * 0.5); } return e; };
    const eR = off(rows), eC = off(cols); let wR = 0, wC = 0; for (const L of rows) wR = Math.max(wR, arc(L)); for (const L of cols) wC = Math.max(wC, arc(L));
    return { eR, eC, e: Math.min(eR, eC), wR, wC, fits: (wR <= LONG && wC <= SHORT) || (wC <= LONG && wR <= SHORT) }; };
  // one more row or column of cells on a side, if they're all there, free, and line up
  const extend = (B, dir) => { const m = B.length, n = B[0].length, edge = dir === 1 ? B.map(r => r[n - 1]) : dir === 3 ? B.map(r => r[0]) : dir === 2 ? B[m - 1] : B[0], out = [];
    for (const [c, r] of edge){ const g = cAcross(c, (r + dir) % 4); if (g < 0 || taken[g] || cQ[g].length !== 4) return null; const jb = sideOf(g, c); if (jb < 0) return null; out.push([g, (jb + 4 - ((dir + 2) % 4)) % 4]); }
    for (let k = 0; k + 1 < out.length; k++){ const along = dir % 2 ? 2 : 1; if (cAcross(out[k][0], (out[k][1] + along) % 4) !== out[k + 1][0]) return null; }
    if (new Set(out.map(o => o[0])).size !== out.length) return null;
    return dir === 1 ? B.map((r, k) => [...r, out[k]]) : dir === 3 ? B.map((r, k) => [out[k], ...r]) : dir === 2 ? [...B, out] : [out, ...B]; };
  const blocked = c => { let b = 0; for (let i = 0; i < cQ[c].length; i++){ const g = cAcross(c, i); if (g < 0 || taken[g]) b++; } return b; };
  // start each sheet in a corner (the free cell most hemmed in), so sheets pack out from the edges and from each other
  const bucket = [[], [], [], [], []], bl = new Int8Array(nC); for (let c = 0; c < nC; c++){ bl[c] = Math.min(4, blocked(c)); bucket[bl[c]].push(c); }
  const bump = c => { if (taken[c]) return; const b = Math.min(4, blocked(c)); if (b !== bl[c]){ bl[c] = b; bucket[b].push(c); } };
  for (;;){ let seed = -1; for (let b = 4; b >= 0 && seed < 0; b--){ const L = bucket[b]; while (L.length){ const c = L.pop(); if (!taken[c] && bl[c] === b){ seed = c; break; } } } if (seed < 0) break;
    let B = [[[seed, 0]]], f = cQ[seed].length === 4 ? fit(B) : { e: 0, eR: 0, eC: 0, wR: 0, wC: 0 }; taken[seed] = 1;
    if (cQ[seed].length === 4){
      const tryDir = dir => { const nb = extend(B, dir); if (!nb) return false; const nf = fit(nb); if (!nf.fits || nf.e > tol) return false; const add = dir === 1 ? nb.map(r => r[r.length - 1]) : dir === 3 ? nb.map(r => r[0]) : dir === 2 ? nb[nb.length - 1] : nb[0]; for (const [c] of add) taken[c] = 1; B = nb; f = nf; return true; };
      // on a slope a sheet runs up it first (the whole height of a transition, like a gore), then widens; on the level it
      // grows evenly all round
      const n = cN[seed], g = sub(up, n.map(x => x * dot(up, n))); let first = null;
      if (len(g) > 0.15){ const q = cQ[seed].map(P), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], dSN = unit(sub(mid(q[2], q[3]), mid(q[0], q[1]))), dWE = unit(sub(mid(q[1], q[2]), mid(q[3], q[0]))), gu = unit(g); first = Math.abs(dot(dSN, gu)) >= Math.abs(dot(dWE, gu)) ? [0, 2] : [1, 3]; }
      if (first){ const other = first[0] === 0 ? [1, 3] : [0, 2]; for (let round = 0; round < 3; round++){ let any = false; for (const pair of [first, other]){ let a = true, b = true; while (a || b){ if (a) a = tryDir(pair[0]); if (b) b = tryDir(pair[1]); any = any || a || b; } } if (!any) break; } }
      else { let stuck = 0, dir = 0; while (stuck < 4){ if (tryDir(dir)) stuck = 0; else stuck++; dir = (dir + 1) % 4; } } }
    const cells = B.flat().map(x => x[0]); for (const c of cells) for (const g of cNb[c]) bump(g);
    // what it is: flat within the gap both ways, or bending (a gore when it had to stay narrow along its straight way)
    const flat = Math.max(f.eR, f.eC) <= tol, alongRows = f.eR <= f.eC, wStraight = alongRows ? f.wR : f.wC, wBend = alongRows ? f.wC : f.wR;
    let minRad = Infinity; if (!flat && cQ[seed].length === 4){ const G = gridOf(B), lines = alongRows ? G[0].map((_, i) => G.map(r => r[i])) : G, rs = [];
      // how tight it bends: across three cells at a time (finer than that is hand wobble), the tighter end of what's found
      for (const L of lines) for (let k = 2; k + 2 < L.length; k++){ const a = P(L[k - 2]), b = P(L[k]), c = P(L[k + 2]), A = len(sub(b, a)), Bq = len(sub(c, b)), C = len(sub(c, a)), ar = len(cross(sub(b, a), sub(c, a))) / 2; rs.push(ar > 1e-12 ? A * Bq * C / (4 * ar) : 1e9); }
      if (rs.length) minRad = pct(rs, 0.15); }
    patches.push({ kind: flat ? FLAT : (wStraight < SHORT * 0.5 && wBend > wStraight * 1.5) ? GORE : BEND, cells, zone: zone[seed], err: f.e, minRad }); }
  // ---------- unroll each patch flat, lay the sheet grid on it, cut
  const pieces = []; let torn = 0;
  const work = patches.map(p => Object.assign({ depth: 0 }, p)); let nZoneUsed = 0; void nZoneUsed;
  while (work.length){ const pt = work.shift(), res = unroll(pt);
    if (res.split){ torn++; for (const cs of res.split) work.push(Object.assign({}, pt, { cells: cs, depth: pt.depth + 1 })); continue; }
    cutPatch(pt, res); }
  // pieces of one cell set that don't touch each other are their own patches
  function unroll(pt){
    const tris = [], tf = []; for (const c of pt.cells) for (const fi of cFaces(c)){ const f = F[fi]; if (f[0] !== f[1] && f[1] !== f[2] && f[0] !== f[2]){ tris.push([f[0], f[1], f[2]]); tf.push(fi); } if (f.length === 4 && f[0] !== f[2] && f[2] !== f[3] && f[0] !== f[3]){ tris.push([f[0], f[2], f[3]]); tf.push(fi); } }
    const te = new Map(); tris.forEach((t, ti) => { for (let i = 0; i < 3; i++){ const k = ek(t[i], t[(i + 1) % 3]); (te.get(k) || te.set(k, []).get(k)).push(ti); } });
    // joined pieces only (through uncreased edges)
    const comp = new Int32Array(tris.length).fill(-1); let nComp = 0;
    for (let s = 0; s < tris.length; s++){ if (comp[s] >= 0) continue; const st = [s]; comp[s] = nComp; while (st.length){ const t = st.pop(); for (let i = 0; i < 3; i++){ const k = ek(tris[t][i], tris[t][(i + 1) % 3]); if (crease.has(k)) continue; for (const o of te.get(k)) if (comp[o] < 0){ comp[o] = nComp; st.push(o); } } } nComp++; }
    if (nComp > 1){ const byC = Array.from({ length: nComp }, () => new Set()); tris.forEach((t, ti) => byC[comp[ti]].add(cellOf(tf[ti]))); return { split: byC.map(s => [...s]) }; }
    const cen = [0, 0, 0]; let At = 0; for (const c of pt.cells){ At += cArea[c]; for (let k = 0; k < 3; k++) cen[k] += cCen[c][k] * cArea[c]; } for (let k = 0; k < 3; k++) cen[k] /= At || 1;
    const U = new Map();                                // vertex → [x, y]
    if (pt.kind === FLAT){ // flat: straight onto its own plane
      const n = [0, 0, 0]; for (const c of pt.cells) for (let k = 0; k < 3; k++) n[k] += cN[c][k] * cArea[c]; const nn = unit(n), e1 = unit(cross(nn, Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), e2 = cross(nn, e1);
      for (const t of tris) for (const v of t) if (!U.has(v)){ const d = sub(P(v), cen); U.set(v, [dot(d, e1), dot(d, e2)]); } }
    else {
      let seed = 0, bd = Infinity; tris.forEach((t, ti) => { const d = len(sub(fC[tf[ti]], cen)); if (d < bd){ bd = d; seed = ti; } });
      const D = (a, b) => len(sub(P(a), P(b))), place = (a, b, v) => { const A = U.get(a), B = U.get(b), dA = D(a, v), dB = D(b, v), dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1e-12, x = (dA * dA - dB * dB + d * d) / (2 * d), h = Math.sqrt(Math.max(0, dA * dA - x * x)), ux = dx / d, uy = dy / d; return [A[0] + ux * x - uy * h, A[1] + uy * x + ux * h]; };
      { const [a, b, c] = tris[seed]; U.set(a, [0, 0]); U.set(b, [D(a, b), 0]); U.set(c, place(a, b, c)); }
      const seen = new Uint8Array(tris.length), qu = [seed]; seen[seed] = 1; let bad = [];
      for (let h = 0; h < qu.length; h++){ const t = tris[qu[h]]; for (let i = 0; i < 3; i++){ const a = t[i], b = t[(i + 1) % 3], c = t[(i + 2) % 3];
          if (!U.has(c) && U.has(a) && U.has(b)) U.set(c, place(a, b, c)); }
        // a triangle whose corners were all placed from elsewhere: does it fit? (it won't where a ring closes on itself)
        { const [a, b, c] = t, A = U.get(a), B = U.get(b), C = U.get(c); if (A && B && C){ const ar = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); let st = 0; for (const [p, q, pp, qq] of [[a, b, A, B], [b, c, B, C], [c, a, C, A]]){ const l3 = D(p, q) || 1e-12; st = Math.max(st, Math.abs(Math.hypot(pp[0] - qq[0], pp[1] - qq[1]) / l3 - 1)); } if (ar <= 0 || st > 0.2) bad.push(qu[h]); } }
        for (let i = 0; i < 3; i++){ const k = ek(t[i], t[(i + 1) % 3]); if (crease.has(k)) continue; for (const o of te.get(k)) if (!seen[o]){ seen[o] = 1; qu.push(o); } } }
      if (bad.length && pt.depth < 4 && pt.cells.length > 1){ // cut it in two through its middle and where it failed to close, and unroll each half
        const bc = [0, 0, 0]; for (const ti of bad){ const c = fC[tf[ti]]; for (let k = 0; k < 3; k++) bc[k] += c[k] / bad.length; }
        let d = sub(bc, cen); d[1] = 0; if (len(d) < 1e-6) d = [1, 0, 0]; d = unit(d); const nrm = [-d[2], 0, d[0]], A = [], B = [];
        for (const c of pt.cells) (dot(sub(cCen[c], cen), nrm) >= 0 ? A : B).push(c); if (A.length && B.length) return { split: [A, B] }; }
      // ease what stretch is left evenly through the patch (edges pulled back to their true lengths)
      const edges = []; for (const k of te.keys()){ const a = Math.floor(k / EK), b = k % EK; edges.push([a, b, D(a, b)]); }
      for (let it = 0; it < 40; it++){ const acc = new Map(); for (const [a, b, l] of edges){ const A = U.get(a), B = U.get(b); if (!A || !B) continue; const dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1e-12, s = 0.5 * (d - l) / d;
          const pa = acc.get(a) || acc.set(a, [0, 0, 0]).get(a), pb = acc.get(b) || acc.set(b, [0, 0, 0]).get(b); pa[0] += dx * s; pa[1] += dy * s; pa[2]++; pb[0] -= dx * s; pb[1] -= dy * s; pb[2]++; }
        for (const [v, m] of acc){ const p = U.get(v); p[0] += 0.8 * m[0] / m[2]; p[1] += 0.8 * m[1] / m[2]; } } }
    return { tris, tf, U, cen };
  }
  function cutPatch(pt, R){
    const { tris, tf, U } = R; if (!tris.length) return;
    const D = (a, b) => len(sub(P(a), P(b)));
    // how much the unrolling had to stretch (none on a surface that bends one way)
    const strains = []; for (const t of tris) for (let i = 0; i < 3; i++){ const a = t[i], b = t[(i + 1) % 3], A = U.get(a), B = U.get(b); strains.push(Math.abs(Math.hypot(A[0] - B[0], A[1] - B[1]) / (D(a, b) || 1e-12) - 1)); }
    const strain = pct(strains, 0.95);
    // turn it the way it takes up the least sheet
    let th = 0; { let best = Infinity; for (let k = 0; k < 90; k++){ const a = k * Math.PI / 90, c = Math.cos(a), sn = Math.sin(a); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of U.values()){ const x = p[0] * c + p[1] * sn, y = -p[0] * sn + p[1] * c; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } const ar = (x1 - x0) * (y1 - y0); if (ar < best - 1e-12){ best = ar; th = a; } } }
    let cT = Math.cos(th), sT = Math.sin(th); const rot = () => { const o = new Map(); for (const [v, p] of U) o.set(v, [p[0] * cT + p[1] * sT, -p[0] * sT + p[1] * cT]); return o; };
    let V2 = rot(); const box = m => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of m.values()){ x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return [x0, y0, x1, y1]; };
    let bb = box(V2); if (bb[3] - bb[1] > bb[2] - bb[0]){ th += Math.PI / 2; cT = Math.cos(th); sT = Math.sin(th); V2 = rot(); bb = box(V2); }
    // rows start from the top (the coping side): turn the patch so higher is +y
    { let sy = 0, sh = 0, syy = 0, n = 0, my = 0, mh = 0; for (const [v, p] of V2){ my += p[1]; mh += X[3 * v + 1]; n++; } my /= n; mh /= n; for (const [v, p] of V2){ sy += (p[1] - my) * (X[3 * v + 1] - mh); syy += (p[1] - my) ** 2; sh += (X[3 * v + 1] - mh) ** 2; }
      if (sy < 0){ for (const p of V2.values()){ p[0] = -p[0]; p[1] = -p[1]; } bb = box(V2); } }
    const pieceL = LONG, rowH = SHORT, eps = 1e-7;
    const cuts = (lo, hi, step, off) => { const o = [lo]; let x = lo + (off || step); while (x < hi - eps){ o.push(x); x += step; } o.push(hi); const n = o.length; if (n > 2 && o[n - 1] - o[n - 2] < 0.2 * step){ if (o[n - 2] - o[n - 3] > 0.6 * step) o[n - 2] = (o[n - 3] + o[n - 1]) / 2; else o.splice(n - 2, 1); } if (o.length > 2 && o[1] - o[0] < 0.2 * step) o.splice(1, 1); return o; };
    const H = bb[3] - bb[1], Wd = bb[2] - bb[0];
    // rows down from the top; a patch that fits one sheet (turned either way) is one piece
    let ys, single = (Wd <= LONG + eps && H <= SHORT + eps);
    ys = single ? [bb[1], bb[3]] : cuts(-bb[3], -bb[1], rowH).map(y => -y).reverse();
    const xsFor = j => single ? [bb[0], bb[2]] : cuts(bb[0], bb[2], pieceL, (ys.length - 2 - j) % 2 ? pieceL / 2 : 0);
    const rowsX = []; for (let j = 0; j + 1 < ys.length; j++) rowsX.push(xsFor(j));
    // clip every triangle to the grid. Points carry [x, y, X, Y, Z]; a cut point is worked out the same way from either
    // side of an edge, so neighbours' cut points are the same numbers
    const lerp = (p, q, ax, v) => { let a = p, b = q; if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])){ a = q; b = p; } const t = (v - a[ax]) / (b[ax] - a[ax]), o = [0, 0, 0, 0, 0]; for (let k = 0; k < 5; k++) o[k] = a[k] + (b[k] - a[k]) * t; o[ax] = v; return o; };
    const clip = (poly, ax, v, keepHi) => { const out = []; for (let i = 0; i < poly.length; i++){ const p = poly[i], q = poly[(i + 1) % poly.length], ip = keepHi ? p[ax] >= v : p[ax] <= v, iq = keepHi ? q[ax] >= v : q[ax] <= v; if (ip) out.push(p); if (ip !== iq) out.push(lerp(p, q, ax, v)); } return out; };
    const frags = [], bins = new Map();                 // frag: { poly, fi, cell key }
    const find = (arr, v) => { let lo = 0, hi = arr.length - 2; while (lo < hi){ const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; } return lo; };
    tris.forEach((t, ti) => { const pts = t.map(v => { const p = V2.get(v); return [p[0], p[1], X[3 * v], X[3 * v + 1], X[3 * v + 2]]; });
      const ar = (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]); if (ar < 0) pts.reverse();
      const y0 = Math.min(pts[0][1], pts[1][1], pts[2][1]), y1 = Math.max(pts[0][1], pts[1][1], pts[2][1]), j0 = find(ys, y0), j1 = find(ys, y1);
      for (let j = j0; j <= j1; j++){ let py = pts; if (j0 !== j1){ py = clip(py, 1, ys[j], true); py = clip(py, 1, ys[j + 1], false); if (py.length < 3) continue; }
        const xs = rowsX[j]; let x0 = Infinity, x1 = -Infinity; for (const p of py){ x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); } const i0 = find(xs, x0), i1 = find(xs, x1);
        for (let i = i0; i <= i1; i++){ let px = py; if (i0 !== i1){ px = clip(px, 0, xs[i], true); px = clip(px, 0, xs[i + 1], false); if (px.length < 3) continue; }
          let a2 = 0; for (let k = 0; k < px.length; k++){ const p = px[k], q = px[(k + 1) % px.length]; a2 += p[0] * q[1] - q[0] * p[1]; } if (a2 < 1e-14) continue;
          const key2 = j * 100000 + i, id = frags.length; frags.push({ poly: px, fi: tf[ti], key: key2, area: a2 / 2 }); (bins.get(key2) || bins.set(key2, []).get(key2)).push(id); } } });
    // points and edges by where they are, to find what touches what
    const pid = new Map(), pxy = [], idOf = p => { const k = Math.round(p[0] * 1e6) + ',' + Math.round(p[1] * 1e6); let v = pid.get(k); if (v === undefined){ v = pxy.length; pid.set(k, v); pxy.push(p); } return v; };
    const PE = 67108864, fe = new Map();
    frags.forEach((f, id) => { f.ids = f.poly.map(idOf); for (let k = 0; k < f.ids.length; k++){ const a = f.ids[k], b = f.ids[(k + 1) % f.ids.length]; if (a === b) continue; const kk = a < b ? a * PE + b : b * PE + a; (fe.get(kk) || fe.set(kk, []).get(kk)).push(id); } });
    // pieces: the joined fragments in each grid cell
    const pOf = new Int32Array(frags.length).fill(-1), list = [];
    for (let s = 0; s < frags.length; s++){ if (pOf[s] >= 0) continue; const id = list.length, st = [s], mine = []; pOf[s] = id;
      while (st.length){ const f = st.pop(); mine.push(f); const g = frags[f]; for (let k = 0; k < g.ids.length; k++){ const a = g.ids[k], b = g.ids[(k + 1) % g.ids.length]; if (a === b) continue; for (const o of fe.get(a < b ? a * PE + b : b * PE + a)) if (pOf[o] < 0 && frags[o].key === g.key){ pOf[o] = id; st.push(o); } } }
      list.push({ frags: mine, alive: true }); }
    const measure = pc => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, A = 0; for (const f of pc.frags){ A += frags[f].area; for (const p of frags[f].poly){ x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } } pc.bb = [x0, y0, x1, y1]; pc.area = A; };
    list.forEach(measure);
    // offcut-sized bits join the piece next to them when the two still fit one sheet
    { const smallA = LONG * SHORT * 0.06, order = list.map((_, i) => i).sort((a, b) => list[a].area - list[b].area);
      for (const i of order){ const pc = list[i]; if (!pc.alive || pc.area >= smallA) continue; const share = new Map();
        for (const f of pc.frags){ const g = frags[f]; for (let k = 0; k < g.ids.length; k++){ const a = g.ids[k], b = g.ids[(k + 1) % g.ids.length]; if (a === b) continue; for (const o of fe.get(a < b ? a * PE + b : b * PE + a)){ const q = pOf[o]; if (q !== i) share.set(q, (share.get(q) || 0) + Math.hypot(pxy[a][0] - pxy[b][0], pxy[a][1] - pxy[b][1])); } } }
        let best = -1, bl = 0; for (const [q, l] of share){ const o = list[q], w = Math.max(pc.bb[2], o.bb[2]) - Math.min(pc.bb[0], o.bb[0]), h = Math.max(pc.bb[3], o.bb[3]) - Math.min(pc.bb[1], o.bb[1]); if (!((w <= LONG + eps && h <= SHORT + eps) || (h <= LONG + eps && w <= SHORT + eps))) continue; if (l > bl){ bl = l; best = q; } }
        if (best < 0) continue; const o = list[best]; for (const f of pc.frags){ pOf[f] = best; o.frags.push(f); } pc.alive = false; pc.frags = []; measure(o); } }
    for (const pc of list){ if (!pc.alive) continue; const me = pOf[pc.frags[0]];
      // outline: the fragment edges nothing else in the piece shares
      const nxt = new Map(); for (const f of pc.frags){ const g = frags[f]; for (let k = 0; k < g.ids.length; k++){ const a = g.ids[k], b = g.ids[(k + 1) % g.ids.length]; if (a === b) continue; const l = fe.get(a < b ? a * PE + b : b * PE + a); let inner = false; for (const o of l) if (o !== f && pOf[o] === me) inner = true; if (!inner) (nxt.get(a) || nxt.set(a, []).get(a)).push(b); } }
      const loops = []; for (const [s0] of nxt){ while ((nxt.get(s0) || []).length){ const lp = [s0]; let cur = nxt.get(s0).pop(); let guard = 0; while (cur !== s0 && guard++ < 1e6){ lp.push(cur); const o = nxt.get(cur); if (!o || !o.length) break; cur = o.pop(); } if (lp.length >= 3) loops.push(lp); } }
      // drop the points that sit on a straight run
      const tidy = lp => { const o = []; const n = lp.length; for (let i = 0; i < n; i++){ const a = pxy[lp[(i - 1 + n) % n]], b = pxy[lp[i]], c = pxy[lp[(i + 1) % n]], cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1e-12; if (Math.abs(cr) / l > 2e-5) o.push(lp[i]); } return o.length >= 3 ? o : lp; };
      const L2 = loops.map(tidy), areaOf = lp => { let a = 0; for (let i = 0; i < lp.length; i++){ const p = pxy[lp[i]], q = pxy[lp[(i + 1) % lp.length]]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
      L2.sort((a, b) => Math.abs(areaOf(b)) - Math.abs(areaOf(a)));
            const w = pc.bb[2] - pc.bb[0], h = pc.bb[3] - pc.bb[1], across = pt.kind === GORE ? h : w;       // its size along the straight way
      const c = [0, 0, 0], n = [0, 0, 0]; let nt = 0; for (const f of pc.frags) nt += frags[f].poly.length - 2;
      const tri = new Float32Array(nt * 9), nr = new Float32Array(nt * 9); let o = 0;
      for (const f of pc.frags){ const g = frags[f], fn = fN[g.fi], a = g.area; for (let k = 0; k < 3; k++) n[k] += fn[k] * a; for (let k = 1; k + 1 < g.poly.length; k++) for (const p of [g.poly[0], g.poly[k], g.poly[k + 1]]){ tri[o] = p[2]; tri[o + 1] = p[3]; tri[o + 2] = p[4]; nr[o] = fn[0]; nr[o + 1] = fn[1]; nr[o + 2] = fn[2]; o += 3; }
        const q = g.poly[0]; for (let k = 0; k < 3; k++) c[k] += (g.poly.reduce((s, p) => s + p[2 + k], 0) / g.poly.length) * a; void q; }
      const seam = []; for (const lp of L2) for (let i = 0; i < lp.length; i++){ const p = pxy[lp[i]], q = pxy[lp[(i + 1) % lp.length]]; seam.push(p[2], p[3], p[4], q[2], q[3], q[4]); }
      // which way is up on the flat piece (for the arrow on the cut sheet)
      let ux = 0, uy = 0; for (const f of pc.frags){ const g = frags[f].poly; for (let k = 0; k < g.length; k++){ const p = g[k], q = g[(k + 1) % g.length], dh = q[3] - p[3]; ux += (q[0] - p[0]) * dh; uy += (q[1] - p[1]) * dh; } }
      const ul = Math.hypot(ux, uy);
      pieces.push({ kind: pt.kind, zone: pt.zone, row: Math.floor(frags[pc.frags[0]].key / 100000), col: frags[pc.frags[0]].key % 100000, tri, tn: nr, seam: new Float32Array(seam),
        loops: L2.map(lp => lp.map(i => [pxy[i][0] - pc.bb[0], pxy[i][1] - pc.bb[1]])), w, h, area: pc.area, c: c.map(x => x / (pc.area || 1)), n: unit(n),
        minR: pt.minRad ?? Infinity, gap: pt.err || 0, tight: minR > 0 && (pt.minRad ?? Infinity) < minR, up: ul > 1e-9 ? [ux / ul, uy / ul] : null, strain }); } }
  // ---------- names: zones numbered across the park, their pieces lettered in order (7C)
  const zc = new Map(); for (const p of pieces){ const z = zc.get(p.zone) || zc.set(p.zone, { x: 0, z: 0, a: 0, kind: p.kind }).get(p.zone); z.x += p.c[0] * p.area; z.z += p.c[2] * p.area; z.a += p.area; }
  const zOrder = [...zc.entries()].sort((a, b) => (a[1].x / a[1].a + a[1].z / a[1].a) - (b[1].x / b[1].a + b[1].z / b[1].a)).map(e => e[0]), zNum = new Map(zOrder.map((z, i) => [z, i + 1]));
  const letter = i => { let s = ''; i++; while (i > 0){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  pieces.sort((a, b) => zNum.get(a.zone) - zNum.get(b.zone) || a.kind - b.kind || (a.c[0] + a.c[2]) - (b.c[0] + b.c[2]));
  { let cur = -1, k = 0; for (const p of pieces){ if (p.zone !== cur){ cur = p.zone; k = 0; } p.zoneNo = zNum.get(p.zone); p.label = p.zoneNo + letter(k++); } }
  const count = [0, 0, 0]; for (const p of pieces) count[p.kind]++;
  return { pieces, count, zones: zOrder.length, torn, cellsKnown: !!per, tight: pieces.filter(p => p.tight).length, over: pieces.filter(p => p.strain > 0.004).length };
}
return { make, FLAT, BEND, GORE };
});
