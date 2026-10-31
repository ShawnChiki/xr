// Pentimento test bench: hard cases sketched loosely, the way a hand in VR draws them, scored against the true shape.
//   node tests/bench.js                 run everything, compare with tests/baseline.json
//   node tests/bench.js --save          ...and save these scores as the new baseline
//   node tests/bench.js spine ledge     run only cases whose name contains one of these words
//   SOLVER=../solver-classic.js node tests/bench.js     score another builder
// Problem reports (files saved from the app's Files tab) dropped in tests/reports/ are built too: they pass if they build.
const fs = require('fs'), path = require('path');
const SOLVER = path.resolve(__dirname, process.env.SOLVER || '../solver.js');
const S = require(SOLVER), D = require(path.resolve(__dirname, '../demo.js'));
const args = process.argv.slice(2), SAVE = args.includes('--save'), only = args.filter(a => !a.startsWith('--'));

const mk = seed => { let s0 = seed; const rnd = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; }; return { rnd, g: () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.2 }; };
const rms = a => a.length ? Math.sqrt(a.reduce((s, e) => s + e * e, 0) / a.length) : 0;
const P = { detail: 0.3, avg: 0.48, lines: 4, fair: 0.3, reach: 0.4, group: 0.35, subd: 1, relax: 2 };

// ---------------- the cases. Each returns { st (strokes), prm, score(r) -> { name: value } } (lower is better unless noted)
function spine(seed, A){
  const { rnd, g } = mk(seed), R = 1.8, top = [R * Math.sin(A), R - R * Math.cos(A)], arcL = R * A, flat = 1.5;
  const prof = s => { const sg = Math.sign(s) || 1, u = Math.abs(s); let x, y; if (u <= arcL){ const a = A - u / R; x = top[0] - R * Math.sin(a); y = R - R * Math.cos(a); } else { x = top[0] + (u - arcL); y = 0; } return [sg * x, y]; };
  const nrm = s => { const sg = Math.sign(s) || 1, u = Math.abs(s); if (u > arcL) return [0, 1]; const a = A - u / R; return [sg * Math.sin(a), Math.cos(a)]; };
  const st = [];
  for (const side of [1, -1]){
    for (let i = 0; i < 45; i++){ const z0 = -2.2 + rnd() * 4.4, s0 = 0.02 + rnd() * 0.3, len = 1.6 + rnd() * 1.8, off = g() * 0.1, drift = g() * 0.08, pts = [];
      for (let k = 0; k <= 50; k++){ const u = k / 50, s = side * (s0 + len * u), p = prof(s), n = nrm(s), o = off + drift * u + 0.03 * Math.sin(u * 9 + i); pts.push(p[0] + n[0] * o, p[1] + n[1] * o, z0 + g() * 0.03); } st.push({ tag: 0, pts }); }
    for (let i = 0; i < 30; i++){ const s = side * (0.05 + rnd() * (arcL + 0.8)), z0 = -2.6 + rnd() * 1.2, len = 3 + rnd() * 2, off = g() * 0.1, drift = g() * 0.08, pts = [];
      for (let k = 0; k <= 50; k++){ const u = k / 50, p = prof(s), n = nrm(s), o = off + drift * u + 0.03 * Math.sin(u * 7 + i); pts.push(p[0] + n[0] * o, p[1] + n[1] * o, z0 + len * u); } st.push({ tag: 0, pts }); }
  }
  const cr = []; for (let k = 0; k <= 80; k++) cr.push(0, top[1], -2.4 + k * 0.06); st.push({ tag: 4, pts: cr });
  const PR = []; for (let s = -(arcL + flat); s <= arcL + flat; s += 0.01) PR.push(prof(s));
  const dist = (x, y) => { let b = 1e9; for (const q of PR) b = Math.min(b, (q[0] - x) ** 2 + (q[1] - y) ** 2); return Math.sqrt(b); };
  return { st, prm: P, score: r => { const V = r.surface.pos, near = [], all = []; let topY = -9;
    for (let i = 0; i < V.length; i += 3){ const x = V[i], y = V[i + 1], z = V[i + 2]; if (Math.abs(z) > 1.8 || Math.abs(x) > 2.4) continue; const d = dist(x, y); all.push(d); if (Math.abs(x) < 0.5 && y > top[1] - 0.8){ near.push(d); topY = Math.max(topY, y); } }
    return { top: rms(near), all: rms(all), reach: Math.max(0, top[1] - topY) }; } };
}
function planes(seed, H, n, box){ // loose strokes on a height field
  const { rnd, g } = mk(seed), st = [];
  for (let i = 0; i < n; i++){ const x = -box + rnd() * 2 * box, z = -box + rnd() * 2 * box, a = rnd() * 6.28, off = g() * 0.08, pts = [];
    for (let k = 0; k < 50; k++){ const xx = x + Math.cos(a) * k * 0.05, zz = z + Math.sin(a) * k * 0.05; if (Math.abs(xx) > box + 0.4 || Math.abs(zz) > box + 0.4) break; pts.push(xx + g() * 0.01, H(xx, zz) + off + g() * 0.02, zz + g() * 0.01); }
    if (pts.length > 15) st.push({ tag: 0, pts }); }
  return st;
}
const hfScore = (H, near, box) => r => { const V = r.surface.pos, a = [], b = []; for (let i = 0; i < V.length; i += 3){ const x = V[i], y = V[i + 1], z = V[i + 2]; if (Math.abs(x) > box || Math.abs(z) > box) continue; const d = Math.abs(y - H(x, z)) / 1.3; a.push(d); if (near(x, z)) b.push(d); } return { corner: rms(b), all: rms(a) }; };
const seg = (H, a, b) => { const p = []; for (let k = 0; k <= 50; k++){ const u = k / 50, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u; p.push(x, H(x, z), z); } return p; };
// how a hand joins lines: exactly (snapped), loosely (ends miss by a few cm, short or past), or as averaged passes
function joins(seed, lines, mode, onto){
  const { rnd, g } = mk(seed + 99), out = [];
  for (const [a, b] of lines){
    const passes = mode === 'avg' ? 3 : 1;
    for (let k = 0; k < passes; k++){
      const j = mode === 'exact' ? 0 : 0.09, d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d), u = d.map(x => x / L);
      const sa = (rnd() - 0.4) * j * 2, sb = (rnd() - 0.4) * j * 2, off = () => mode === 'exact' ? 0 : g() * 0.025;
      const A = [a[0] - u[0] * sa + off(), a[1] - u[1] * sa + off(), a[2] - u[2] * sa + off()], Bp = [b[0] + u[0] * sb + off(), b[1] + u[1] * sb + off(), b[2] + u[2] * sb + off()], p = [];
      for (let q = 0; q <= 40; q++){ const t = q / 40, x = A[0] + (Bp[0] - A[0]) * t, y = A[1] + (Bp[1] - A[1]) * t, z = A[2] + (Bp[2] - A[2]) * t, P = onto ? onto(x, y, z) : [x, y, z]; p.push(P[0] + (mode === 'avg' ? g() * 0.015 : 0), P[1], P[2] + (mode === 'avg' ? g() * 0.015 : 0)); }
      out.push({ tag: mode === 'avg' ? 3 : 4, pts: p });
    }
  }
  return out;
}
function corner(seed, mode = 'exact'){ const H = (x, z) => 1.5 - 0.6 * Math.max(0, x, z), st = planes(seed, H, 160, 2), on = (x, y, z) => [x, H(x, z), z];
  if (mode === 'turn'){ const p = [...seg(H, [0, -2.2], [0, 0]), ...seg(H, [0, 0], [-2.2, 0]).slice(3)]; st.push({ tag: 4, pts: p }, { tag: 4, pts: seg(H, [0, 0], [2, 2]) }); }
  else st.push(...joins(seed, [[[0, 0, 0], [0, 0, -2.2]], [[0, 0, 0], [-2.2, 0, 0]], [[0, 0, 0], [2, 0, 2]]], mode, on));
  return { st, prm: P, score: hfScore(H, (x, z) => Math.hypot(x, z) < 0.6, 2) }; }
// a tight round bowl sunk in a deck (lowest curve radius about 0.5 m), at the app's default 40 cm detail
function bowl(seed, R = 1.4, D = 1.0){ const H = (x, z) => { const r = Math.hypot(x, z); return r < R ? -D * (1 - (r / R) ** 2) ** 2 : 0; }, st = planes(seed, H, 230, 2.4);
  return { st, prm: { ...P, detail: 0.4, avg: 0.64 }, score: hfScore(H, (x, z) => Math.hypot(x, z) < R * 0.8, 2.4) }; }
// one crease drawn as two strokes that overlap where they meet, a few cm apart (a fin used to grow between them)
function overlap(seed, gap = 0.05){ const H = (x, z) => 1.2 - 0.7 * Math.max(0, x), st = planes(seed, H, 170, 2);
  st.push({ tag: 4, pts: seg(H, [0, -2.2], [0, 0.35]) }, { tag: 4, pts: seg((x, z) => H(x, z), [gap, -0.3], [gap * 0.6, 2.2]) });
  return { st, prm: P, score: hfScore(H, (x, z) => Math.abs(x) < 0.6 && Math.abs(z) < 0.8, 2) }; }
function apex(seed, nf){ const U = []; for (let i = 0; i < nf; i++){ const a = i * 2 * Math.PI / nf; U.push([Math.cos(a), Math.sin(a)]); }
  const H = (x, z) => Math.max(0.2, 1.6 - 0.8 * Math.max(...U.map(u => u[0] * x + u[1] * z))), st = planes(seed, H, 170, 2);
  for (let i = 0; i < nf; i++){ const a = (i + 0.5) * 2 * Math.PI / nf, L = 1.6 / Math.cos(Math.PI / nf) * 0.95; st.push({ tag: 4, pts: seg(H, [0, 0], [Math.cos(a) * L, Math.sin(a) * L]) }); }
  return { st, prm: P, score: hfScore(H, (x, z) => Math.hypot(x, z) < 0.6, 2) }; }
function ledge(seed, mode = 'exact', h = 0.6){
  const { rnd, g } = mk(seed), st = [];
  const faces = [
    { n: 140, pick: () => { for (;;){ const x = -2 + rnd() * 4, z = -2 + rnd() * 4; if (x < 0 || z < 0) return [x, h, z]; } }, inF: p => (p[0] < 0 || p[2] < 0) && Math.abs(p[0]) < 2.2 && Math.abs(p[2]) < 2.2, ax: [0, 2], n3: [0, 1, 0] },
    { n: 50, pick: () => [0.05 + rnd() * 1.9, 0, 0.05 + rnd() * 1.9], inF: p => p[0] > 0 && p[2] > 0 && p[0] < 2.2 && p[2] < 2.2, ax: [0, 2], n3: [0, 1, 0] },
    { n: 30, pick: () => [0, rnd() * h, rnd() * 2], inF: p => p[1] >= 0 && p[1] <= h && p[2] > 0 && p[2] < 2.2, ax: [1, 2], n3: [1, 0, 0] },
    { n: 30, pick: () => [rnd() * 2, rnd() * h, 0], inF: p => p[1] >= 0 && p[1] <= h && p[0] > 0 && p[0] < 2.2, ax: [0, 1], n3: [0, 0, 1] }];
  for (const F of faces) for (let i = 0; i < F.n; i++){ const p0 = F.pick(), a = rnd() * 6.28, off = g() * 0.05, pts = [];
    for (let k = 0; k < 40; k++){ const q = p0.slice(); q[F.ax[0]] += Math.cos(a) * k * 0.04; q[F.ax[1]] += Math.sin(a) * k * 0.04; if (!F.inF(q)) break; pts.push(q[0] + F.n3[0] * off + g() * 0.01, q[1] + F.n3[1] * off + g() * 0.01, q[2] + F.n3[2] * off + g() * 0.01); }
    if (pts.length > 10) st.push({ tag: 0, pts }); }
  const line = (a, b) => { const p = []; for (let k = 0; k <= 40; k++){ const u = k / 40; p.push(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u); } return p; };
  st.push(...joins(seed, [[[0, h, 0], [0, h, 2]], [[0, h, 0], [2, h, 0]], [[0, h, 0], [0, 0, 0]], [[0, 0, 0], [0, 0, 2]], [[0, 0, 0], [2, 0, 0]]], mode));
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (x, y, z) => Math.min((x < 0 || z < 0) ? Math.abs(y - h) : Math.hypot(y - h, Math.min(x, z)), Math.hypot(y, x < 0 ? -x : 0, z < 0 ? -z : 0), Math.hypot(x, y - cl(y, 0, h), z - cl(z, 0, 9)), Math.hypot(z, y - cl(y, 0, h), x - cl(x, 0, 9)));
  return { st, prm: P, score: r => { const V = r.surface.pos, a = [], b = []; for (let i = 0; i < V.length; i += 3){ const x = V[i], y = V[i + 1], z = V[i + 2]; if (Math.abs(x) > 1.8 || Math.abs(z) > 1.8) continue; const d = dist(x, y, z); a.push(d); if (Math.hypot(x, z) < 0.5) b.push(d); } return { corner: rms(b), all: rms(a) }; } };
}
function halfpipe(seed){ // a quarter-circle transition, radius 3, from flat up to about 80°
  const { rnd, g } = mk(seed), RC = 3, surf = x => x <= 0 ? [x, 0] : (() => { const a = Math.min(x / RC, 1.4); return [RC * Math.sin(a), RC - RC * Math.cos(a)]; })(), nrm = x => x <= 0 ? [0, 1] : [-Math.sin(Math.min(x / RC, 1.4)), Math.cos(Math.min(x / RC, 1.4))];
  const st = [];
  for (let i = 0; i < 70; i++){ const z0 = -2.5 + rnd() * 5, s0 = -1.5 + rnd() * 1.5, len = 2 + rnd() * 2, off = g() * 0.14, drift = g() * 0.1, pts = []; for (let k = 0; k <= 60; k++){ const u = k / 60, sx = s0 + len * u, p = surf(sx), n = nrm(sx), o = off + drift * u + 0.04 * Math.sin(u * 9 + i); pts.push(p[0] + n[0] * o, p[1] + n[1] * o, z0 + g() * 0.02); } st.push({ tag: 0, pts }); }
  for (let i = 0; i < 50; i++){ const sx = -1 + rnd() * 3.8, z0 = -3 + rnd() * 1.5, len = 3 + rnd() * 2, off = g() * 0.14, drift = g() * 0.1, pts = []; for (let k = 0; k <= 60; k++){ const u = k / 60, p = surf(sx), n = nrm(sx), o = off + drift * u + 0.04 * Math.sin(u * 7 + i); pts.push(p[0] + n[0] * o, p[1] + n[1] * o, z0 + len * u); } st.push({ tag: 0, pts }); }
  const PR = []; for (let s = -2; s <= 4.3; s += 0.01) PR.push(surf(s));
  return { st, prm: P, score: r => { const V = r.surface.pos, a = []; for (let i = 0; i < V.length; i += 3){ const x = V[i], y = V[i + 1], z = V[i + 2]; if (Math.abs(z) > 1.8 || x < -1 || y > 2.6) continue; let b = 1e9; for (const q of PR) b = Math.min(b, (q[0] - x) ** 2 + (q[1] - y) ** 2); a.push(Math.sqrt(b)); } return { all: rms(a) }; } };
}
function ridge(seed){ // a sharp ridge with one strict crease along its top: how sharp the fold stays
  const H = (x, z) => Math.max(0, 1.0 - 0.9 * Math.abs(x)), st = planes(seed, H, 160, 2.5);
  const cr = []; for (let k = 0; k <= 100; k++) cr.push(0, 1.0, -2.2 + k * 0.044); st.push({ tag: 4, pts: cr });
  return { st, prm: P, score: r => { const V = r.surface.pos, a = [], fold = []; for (let i = 0; i < V.length; i += 3){ const x = V[i], y = V[i + 1], z = V[i + 2]; if (Math.abs(z) > 1.5 || Math.abs(x) > 0.5) continue; a.push(Math.abs(y - H(x, z))); } return { crest: rms(a) }; } };
}
function demo(seed){ const st = D.demoSketch(seed, 1), H = st.truth;
  return { st: st.map(o => ({ tag: o.tag, pts: o.pts })), prm: { detail: 0.4, avg: 0.64, lines: 4, fair: 0.3, reach: 0.6, group: 0.35, subd: 1 }, score: r => { const V = r.quads.V, a = []; for (let i = 0; i < V.length; i += 3){ const x = V[i], y = V[i + 1], z = V[i + 2], e = 0.05, gr = Math.hypot((H(x + e, z) - H(x - e, z)) / (2 * e), (H(x, z + e) - H(x, z - e)) / (2 * e)); if (gr < 0.8) a.push(Math.abs(y - H(x, z)) / Math.hypot(1, gr)); } return { all: rms(a) }; } }; }
function edgeLoop(seed){ const { rnd, g } = mk(seed), H = (x, z) => 0.3 * Math.sin(x * 0.5) * Math.cos(z * 0.4), st = [];
  for (let i = 0; i < 200; i++){ let x = -5 + rnd() * 10, z = -5 + rnd() * 10; const a = rnd() * 6.28, off = g() * 0.06, pts = []; for (let k = 0; k < 60; k++){ const xx = x + Math.cos(a) * k * 0.05, zz = z + Math.sin(a) * k * 0.05; pts.push(xx, H(xx, zz) + off, zz); } st.push({ tag: 0, pts }); }
  const loop = []; for (let a = 0; a <= Math.PI * 2 + 0.001; a += 0.02){ const r = 3 + 0.6 * Math.cos(2 * a), x = r * Math.cos(a), z = r * Math.sin(a) * 0.8; loop.push(x + g() * 0.03, H(x, z) + g() * 0.03, z); } st.push({ tag: 5, pts: loop });
  return { st, prm: { detail: 0.35, avg: 0.56, lines: 4, fair: 0.3, reach: 0.6, group: 0.3, subd: 1, relax: 2 }, score: r => { const V = r.quads.V; let out = 0; for (let i = 0; i < V.length; i += 3){ const x = V[i], z = V[i + 2] / 0.8, a = Math.atan2(z, x), R = 3 + 0.6 * Math.cos(2 * a); if (Math.hypot(x, z) - R > 0.05) out++; } return { outside: out / 100 }; } }; }
function guideLayout(seed){ const st = D.demoSketch(7, 1), H = st.truth, s2 = st.map(o => ({ tag: o.tag, pts: o.pts }));
  const line = f => { const p = []; for (let i = 0; i <= 120; i++) p.push(...f(i / 120)); return { tag: 1, pts: p }; };
  for (const z of [-3.2, -1, 1, 3.2]) s2.push(line(u => [-7.6 + 15 * u, H(-7.6 + 15 * u, z) + 0.02, z])); for (const x of [-6.6, -0.3, 1.4, 5.3]) s2.push(line(u => [x, H(x, -4.3 + 9.2 * u) + 0.02, -4.3 + 9.2 * u]));
  return { st: s2, prm: { detail: 0.4, avg: 0.64, lines: 4, fair: 0.3, reach: 0.6, group: 0.35, subd: 2, relax: 2, target: -2 }, score: r => { const C = r.quads.C ? Array.from(r.quads.C) : []; return { notQuads: C.length ? C.filter(c => c !== 4).length / C.length * 100 : 100 }; } }; }

// guides drawn by hand (wobbly, stopping short of the border, some drawn twice) on the sample sketch, laid out as ×4 / ×16
function handGuides(seed, target){
  const { rnd, g } = mk(seed * 7 + 3), base = D.demoSketch(7, 1), H = base.truth, st = base.map(o => ({ tag: o.tag, pts: o.pts }));
  const line = (a, b, wob) => { const p = [], ph = rnd() * 6; for (let i = 0; i <= 80; i++){ const u = i / 80, x = a[0] + (b[0] - a[0]) * u + Math.sin(u * 5 + ph) * wob + g() * 0.02, z = a[1] + (b[1] - a[1]) * u + Math.cos(u * 4 + ph) * wob + g() * 0.02; p.push(x, H(x, z) + 0.03 + g() * 0.04, z); } return p; };
  for (const z of [-3, -1.2, 0.8, 2.9]){ const x0 = -7 + rnd() * 1.2, x1 = 6.5 - rnd() * 1.5; st.push({ tag: 1, pts: line([x0, z], [x1, z + g() * 0.3], 0.12) }); if (rnd() < 0.4) st.push({ tag: 1, pts: line([x0 + 1, z + 0.1], [x1 - 2, z + 0.15], 0.1) }); }
  for (const x of [-6, -2.5, 0.5, 3.5, 5.8]){ const z0 = -4 + rnd() * 0.8, z1 = 4.2 - rnd() * 1.2; st.push({ tag: 1, pts: line([x, z0], [x + g() * 0.3, z1], 0.1) }); }
  return { st, prm: { detail: 0.4, avg: 0.64, lines: 4, fair: 0.3, reach: 0.6, group: 0.35, subd: 1, relax: 2, target }, score: r => {
    const F = r.quads.F, C = r.quads.C, cnt = new Map(); let o = 0; for (let f = 0; f < C.length; f++){ const n = C[f]; for (let i = 0; i < n; i++){ const a = F[o + i], b = F[o + (i + 1) % n], k = a < b ? a * 1e7 + b : b * 1e7 + a; cnt.set(k, (cnt.get(k) || 0) + 1); } o += n; }
    const adj = new Map(); for (const [k, c] of cnt) if (c === 1){ const a = Math.floor(k / 1e7), b = k % 1e7; (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
    const seen = new Set(); let loops = 0; for (const v of adj.keys()){ if (seen.has(v)) continue; loops++; const q = [v]; seen.add(v); while (q.length){ const x = q.pop(); for (const w of adj.get(x)) if (!seen.has(w)){ seen.add(w); q.push(w); } } }
    return { holes: Math.max(0, loops - 1) }; } };
}
const CASES = [];
for (const sd of [1, 2]){
  CASES.push(['spine 78° #' + sd, () => spine(sd, 78 * Math.PI / 180)], ['spine 88° #' + sd, () => spine(sd, 88 * Math.PI / 180)]);
  CASES.push(['deck corner #' + sd, () => corner(sd)], ['3-way apex #' + sd, () => apex(sd, 3)], ['4-way apex #' + sd, () => apex(sd, 4)], ['L-ledge inside corner #' + sd, () => ledge(sd)]);
}
for (const m of ['loose', 'avg']) CASES.push(['deck corner, ' + m + ' joins', () => corner(1, m)], ['L-ledge, ' + m + ' joins', () => ledge(1, m)]);
CASES.push(['sample sketch #3, 20 cm', () => { const c = demo(3); c.prm = { ...c.prm, detail: 0.2, avg: 0.32 }; return c; }], ['sample sketch #7, 25 cm', () => { const c = demo(7); c.prm = { ...c.prm, detail: 0.25, avg: 0.4 }; return c; }]);
CASES.push(['tight bowl #1', () => bowl(1)], ['tight bowl #2', () => bowl(2, 1.1, 0.8)], ['crease overlap 5cm', () => overlap(1, 0.05)], ['crease overlap 12cm', () => overlap(2, 0.12)]);
CASES.push(['deck corner, line turns', () => corner(2, 'turn')]);
for (const sd of [1, 3, 4]) CASES.push(['hand guides ×4 #' + sd, () => handGuides(sd, -2)], ['hand guides ×16 #' + sd, () => handGuides(sd, -1)]);
CASES.push(['half pipe', () => halfpipe(3)], ['ridge', () => ridge(5)], ['sample sketch #7', () => demo(7)], ['sample sketch #3', () => demo(3)], ['edge loop', () => edgeLoop(4)], ['guide layout', () => guideLayout(7)]);
const repDir = path.join(__dirname, 'reports');
if (fs.existsSync(repDir)) for (const f of fs.readdirSync(repDir).filter(f => f.endsWith('.json'))){
  CASES.push(['report ' + f, () => { const o = JSON.parse(fs.readFileSync(path.join(repDir, f), 'utf8')); return { st: reportStrokes(o), prm: reportPrm(o.S), score: () => ({}) }; }]);
}
// a problem report from the app: rebuild its strokes and settings the way the app sends them
function reportStrokes(o){ return o.strokes.map(s => ({ tag: s.t === 2 ? 1 : s.t, pts: s.r ? s.r.map(v => v / 1000) : splinePts(s.c.map(v => v / 1000), !!s.cl) })); }
function splinePts(c, closed){ const n = c.length / 3, out = [], P3 = i => [c[3 * i], c[3 * i + 1], c[3 * i + 2]];
  for (let i = 0; i < (closed ? n : n - 1); i++){ const p0 = P3(closed ? (i - 1 + n) % n : Math.max(0, i - 1)), p1 = P3(i), p2 = P3((i + 1) % n), p3 = P3(closed ? (i + 2) % n : Math.min(n - 1, i + 2));
    for (let k = 0; k < 8; k++){ const t = k / 8, t2 = t * t, t3 = t2 * t; for (let q = 0; q < 3; q++) out.push(0.5 * (2 * p1[q] + (-p0[q] + p2[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t2 + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * t3)); } }
  out.push(...P3(closed ? 0 : n - 1)); return out; }
function reportPrm(s){ const QUAD = [0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0], REACH = [0.2, 0.4, 0.6, 0.8, 1.0, 1.5, 2.0], GROUP = [0.1, 0.15, 0.25, 0.35, 0.5, 0.75, 1.0], TARGETS = [0, 50, 100, 200, 400, 800, 1600, 3200], HARD = [0, 30, 45, 60];
  const q = QUAD[s.quad ?? 4], t = s.target || 0; return { detail: q, avg: q * 1.6, lines: s.avg ?? 4, fair: (s.fair ?? 3) / 10, reach: REACH[s.reach ?? 2], group: GROUP[s.group ?? 3], subd: s.subd ?? 1, relax: s.relax || 0, target: t < 0 ? -1 - (t + 3) : TARGETS[t], hard: HARD[s.hard || 0], tipFade: [0, 0.5, 1.2][s.tipSoft ?? 1] }; }

// ---------------- run
const basePath = path.join(__dirname, 'baseline.json'), base = fs.existsSync(basePath) ? JSON.parse(fs.readFileSync(basePath, 'utf8')) : {};
const out = {}; let worse = 0, broke = 0, t0 = Date.now();
const fmt = (k, v) => k === 'glitch' || k === 'holes' ? String(v) : k === 'notQuads' || k === 'odd' ? v.toFixed(1) + '%' : k === 'outside' ? (v * 100).toFixed(0) : (v * 100).toFixed(1) + 'cm';
for (const [name, make] of CASES){
  if (only.length && !only.some(w => name.toLowerCase().includes(w.toLowerCase()))) continue;
  const c = make(), t = Date.now(); let r, sc;
  try { r = S.solve(c.st, Object.assign({}, c.prm, JSON.parse(process.env.PRM || '{}'))); sc = r && r.surface ? c.score(r) : null; } catch (e){ sc = null; r = { err: e.message }; }
  const ms = Date.now() - t;
  if (!sc){ broke++; console.log(name.padEnd(26), 'FAILED', r && r.err || 'no surface'); out[name] = null; continue; }
  // how tidy the quad layout is: the share of inner vertices that don't have exactly four edges
  { const F = r.quads.F, C = r.quads.C, val = new Map(), cnt = new Map(); let o = 0; for (let f = 0; f < C.length; f++){ const n = C[f]; for (let i = 0; i < n; i++){ const a = F[o + i], b = F[o + (i + 1) % n], k = a < b ? a * 1e7 + b : b * 1e7 + a; cnt.set(k, (cnt.get(k) || 0) + 1); } o += n; }
    const bv = new Set(); for (const [k, c] of cnt){ const a = Math.floor(k / 1e7), b = k % 1e7; val.set(a, (val.get(a) || 0) + 1); val.set(b, (val.get(b) || 0) + 1); if (c === 1){ bv.add(a); bv.add(b); } }
    let inner = 0, odd = 0; for (const [v, d] of val){ if (bv.has(v)) continue; inner++; if (d !== 4) odd++; } sc.odd = inner ? odd / inner * 100 : 0; }
  // glitches: faces folded back against a neighbour, slivers far smaller than their neighbours, edges shared by 3+ faces
  { const F = r.quads.F, C = r.quads.C, V = r.quads.V, fn = [], fa = [], ef = new Map(); let o = 0;
    for (let f = 0; f < C.length; f++){ const n = C[f], ids = []; for (let i = 0; i < n; i++) ids.push(F[o + i]); o += n; const P = i => [V[3 * ids[i]], V[3 * ids[i] + 1], V[3 * ids[i] + 2]], nn = [0, 0, 0];
      for (let i = 0; i < n; i++){ const p = P(i), q = P((i + 1) % n); nn[0] += (p[1] - q[1]) * (p[2] + q[2]); nn[1] += (p[2] - q[2]) * (p[0] + q[0]); nn[2] += (p[0] - q[0]) * (p[1] + q[1]); }
      const l = Math.hypot(...nn); fa.push(l / 2); fn.push(nn.map(x => x / (l || 1)));
      for (let i = 0; i < n; i++){ const a = ids[i], b = ids[(i + 1) % n], k = a < b ? a * 1e7 + b : b * 1e7 + a; (ef.get(k) || ef.set(k, []).get(k)).push(f); } }
    const med = fa.slice().sort((a, b) => a - b)[fa.length >> 1] || 1; let g = 0;
    for (const fs of ef.values()){ if (fs.length > 2) g++; else if (fs.length === 2 && fn[fs[0]][0] * fn[fs[1]][0] + fn[fs[0]][1] * fn[fs[1]][1] + fn[fs[0]][2] * fn[fs[1]][2] < -0.2) g++; }
    for (const a of fa) if (a < med * 0.08) g++;
    sc.glitch = g; }
  out[name] = sc; const b = base[name], notes = [];
  for (const [k, v] of Object.entries(sc)){ let s = k + ' ' + fmt(k, v); if (b && b[k] !== undefined){ const d = v - b[k], lim = Math.max(b[k] * 0.25, k === 'glitch' ? 2 : k === 'holes' ? 0.5 : k === 'notQuads' || k === 'odd' ? 2 : k === 'outside' ? 0.02 : 0.004); if (d > lim){ s += ' ▲ worse (was ' + fmt(k, b[k]) + ')'; worse++; } else if (-d > lim) s += ' ▼ better (was ' + fmt(k, b[k]) + ')'; } notes.push(s); }
  console.log(name.padEnd(26), notes.join('   '), ' ' + (ms / 1000).toFixed(1) + 's');
}
console.log(`\n${Object.keys(out).length} cases in ${((Date.now() - t0) / 1000).toFixed(0)}s · ${broke} failed · ${worse} scores worse than the baseline`);
if (SAVE){ fs.writeFileSync(basePath, JSON.stringify(Object.assign(base, out), null, 1)); console.log('saved as the new baseline'); }
process.exitCode = broke || worse ? 1 : 0;
