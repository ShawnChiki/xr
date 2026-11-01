// A sample sketch: what a few minutes of loose gestural sketching of a small park in VR might look like.
// A rounded bowl (sharp coping lip), a pyramid with sharp hips and top edges, a mellow bank,
// each drawn as hundreds of wobbly overlapping lines, plus a few repeated passes over the creases.
(function (root) {
'use strict';
function demoSketch(seed = 7, mess = 1){   // mess: 0 = lines right on the surface, 1 = a normal VR hand, 2 = very loose
  let s = seed >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) * 1.2; };
  // bowl: rounded rectangle centred at (-3.5, 0), quarter-circle transition to a flat floor
  const BX = -3.5, BZ = 0, BW = 2.6, BH = 1.9, BR = 1.2, D = 1.6;
  const bowlSD = (x, z) => { const qx = Math.abs(x - BX) - (BW - BR), qz = Math.abs(z - BZ) - (BH - BR); return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - BR; };
  // pyramid centred at (3.2, -0.6)
  const PX = 3.2, PZ = -0.6, PA = 2.0, PB = 0.7, PH = 0.9;
  // bank along the back
  const height = (x, z) => {
    let y = 0;
    const d = bowlSD(x, z);
    if (d < 0){ const s2 = -d; y = s2 >= D ? -D : -D + (D - Math.sqrt(Math.max(0, D * D - (D - s2) * (D - s2)))); }
    const m = Math.max(Math.abs(x - PX), Math.abs(z - PZ));
    if (m < PA) y = Math.max(y, Math.min(1, (PA - m) / (PA - PB)) * PH);
    if (z > 3.2) y = Math.max(y, Math.min(1.2, (z - 3.2) * 0.75));
    return y;
  };
  const strokes = [];
  Object.defineProperty(strokes, 'truth', { value: height });
  const wob = (amp) => { const a = [], n = 3; for (let i = 0; i < n; i++) a.push([rnd() * 6.28, 0.6 + rnd() * 2.2, (0.3 + rnd() * 0.7) * amp / 1.6]); return t => a.reduce((acc, [ph, f, am]) => acc + Math.sin(ph + t * f) * am, 0); };
  const normalAt = (x, z) => { const e = 0.03, gx = (height(x + e, z) - height(x - e, z)) / (2 * e), gz = (height(x, z + e) - height(x, z - e)) / (2 * e); const l = Math.hypot(gx, 1, gz); return [-gx / l, 1 / l, -gz / l]; };
  // A hand in VR doesn't put lines on one surface: each line floats a little above or below where you
  // meant, drifts in depth as you draw, bows out in the middle, cuts corners through transitions and
  // overshoots its ends. Sizes here are park metres at 1:10, so 0.1 m is about 1 cm of hand movement.
  const H = mess;
  const walk = (x, z, ang, len) => {
    const P = [], N = [], ds = 0.05; let y = height(x, z);
    const dir = [Math.cos(ang), Math.sin(ang)];
    for (let k = 0; k < len / ds; k++){
      P.push([x, y, z]); N.push(normalAt(x, z));
      let lo = 0, hi = ds;   // a plan step whose real 3D length is ds, so lines climb walls properly
      for (let it = 0; it < 12; it++){ const m = (lo + hi) / 2, dy = height(x + dir[0] * m, z + dir[1] * m) - y; if (Math.hypot(m, dy) > ds) hi = m; else lo = m; }
      const st = Math.max(lo, 0.002); const ny = height(x + dir[0] * st, z + dir[1] * st);
      if (Math.abs(ny - y) > ds * 1.5) break;
      x += dir[0] * st; z += dir[1] * st; y = ny;
      dir[0] += gauss() * 0.012; dir[1] += gauss() * 0.012; const l = Math.hypot(dir[0], dir[1]); dir[0] /= l; dir[1] /= l;
      if (x < -7.5 || x > 7 || z < -4 || z > 5) break;
    }
    const n = P.length; if (n < 12) return;
    // cutting the corner: some lines go straighter than the ground they describe
    if (rnd() < 0.35 * Math.min(1, H)){ const c = rnd() * 0.45, a = P[0], b = P[n - 1]; for (let i = 0; i < n; i++){ const u = i / (n - 1); for (let q = 0; q < 3; q++) P[i][q] += (a[q] + (b[q] - a[q]) * u - P[i][q]) * c; } }
    // overshoot: carry on straight past the ends
    const over = (i0, i1) => { const a = P[i1], b = P[i0], t = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], l = Math.hypot(...t) || 1, k = Math.floor(rnd() * rnd() * 8 * H); const out = []; for (let j = 1; j <= k; j++) out.push([a[0] + t[0] / l * ds * j, a[1] + t[1] / l * ds * j, a[2] + t[2] / l * ds * j]); return out; };
    const head = over(Math.min(3, n - 1), 0).reverse(), tail = over(n - 4, n - 1);
    const off0 = gauss() * 0.16 * H, drift = gauss() * 0.22 * H, bow = gauss() * 0.14 * H, float = rnd() < 0.12 * H ? 0.25 + rnd() * 0.35 : 0;
    const wx = wob(0.09 * H + 0.02), wy = wob(0.09 * H + 0.02), wz = wob(0.09 * H + 0.02), pts = [];
    const all = [...head, ...P, ...tail], nn = [...head.map(() => N[0]), ...N, ...tail.map(() => N[n - 1])];
    all.forEach((p, i) => { const u = i / (all.length - 1), o = off0 + drift * u + bow * Math.sin(Math.PI * u) + float, q = nn[i];
      pts.push(p[0] + q[0] * o + wx(u * len), p[1] + q[1] * o + wy(u * len) * 0.7, p[2] + q[2] * o + wz(u * len)); });
    strokes.push({ tag: 0, pts });
  };
  for (let i = 0; i < 80; i++) walk(-3.5 + gauss() * 2.2, gauss() * 1.6, rnd() * Math.PI * 2, 2 + rnd() * 3);
  for (let i = 0; i < 60; i++) walk(3.2 + gauss() * 1.4, -0.6 + gauss() * 1.4, rnd() * Math.PI * 2, 1.5 + rnd() * 3);
  for (let i = 0; i < 55; i++) walk(-7 + rnd() * 13.5, -3.8 + rnd() * 8.5, rnd() * Math.PI * 2, 2 + rnd() * 3.5);
  for (let i = 0; i < 25; i++) walk(-6 + rnd() * 12, 3.0 + rnd() * 1.6, Math.PI / 2 + gauss() * 0.15, 1.5 + rnd() * 1.5);
  // crease passes: several messy goes over each sharp line
  const pass = (fn, tag, from = 0, to = 1, amp = 0.06) => {
    const a2 = amp * (0.6 + H), wx = wob(a2), wy = wob(a2), wz = wob(a2), pts = [], n = 120, ox = gauss() * a2, oy = gauss() * a2, oz = gauss() * a2, dx = gauss() * a2, dy = gauss() * a2, dz = gauss() * a2;
    for (let i = 0; i <= n; i++){ const u = from + (to - from) * i / n, v = i / n, p = fn(u); pts.push(p[0] + wx(u * 9) + ox + dx * v, p[1] + wy(u * 9) + oy + dy * v, p[2] + wz(u * 9) + oz + dz * v); }
    strokes.push({ tag, pts });
  };
  // coping: the bowl's top edge, drawn as a few partial loops
  const coping = u => { const a = u * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); const px = Math.sign(c) * Math.pow(Math.abs(c), 0.35) * BW, pz = Math.sign(sn) * Math.pow(Math.abs(sn), 0.35) * BH;
    // pull onto the true rounded-rectangle edge
    let x = BX + px, z = BZ + pz; for (let it = 0; it < 30; it++){ const d = bowlSD(x, z), e = 1e-3, gx = (bowlSD(x + e, z) - d) / e, gz = (bowlSD(x, z + e) - d) / e; x -= d * gx; z -= d * gz; }
    return [x, 0, z]; };
  for (let i = 0; i < 6; i++){ const a = rnd(); pass(coping, 3, a, a + 0.45 + rnd() * 0.4, 0.07); }
  // pyramid top edges and hips
  const sq = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let k = 0; k < 4; k++){
    const a = sq[k], b = sq[(k + 1) % 4];
    const top = u => [PX + (a[0] + (b[0] - a[0]) * u) * PB, PH, PZ + (a[1] + (b[1] - a[1]) * u) * PB];
    for (let i = 0; i < 3; i++) pass(top, 3, -0.05 + rnd() * 0.1, 0.95 + rnd() * 0.1, 0.05);
    const hip = u => { const r = PB + (PA - PB) * u; return [PX + a[0] * r, PH * (1 - u), PZ + a[1] * r]; };
    for (let i = 0; i < 3; i++) pass(hip, 3, rnd() * 0.08, 0.9 + rnd() * 0.1, 0.05);
  }
  // a guide down the middle of the bowl floor
  for (let i = 0; i < 3; i++) pass(u => [BX - 1.2 + 2.4 * u, -D, BZ], 1, 0, 1, 0.05);
  return strokes;
}
const api = { demoSketch };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.PentimentoDemo = api;
})(typeof self !== 'undefined' ? self : globalThis);
