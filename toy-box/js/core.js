/* ================= Toy Box: shared bits (math, random, shapes, collisions, merged meshes, sound) =================
   Units are real metres. The toddler is life size in the headset; the toys are about 10–14 cm tall,
   so the playground looks like a toy set to the toddler and like a real playground to the toys. */
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const Y_AX = V(0, 1, 0), X_AX = V(1, 0, 0), Z_AX = V(0, 0, 1);
const qYaw = (a, out) => (out || Q()).setFromAxisAngle(Y_AX, a);
const r3 = v => Math.round(v * 1000) / 1000;

/* ---------- the room and the toy chest ----------
   The play area is the floor space the toddler traced in mixed reality (or a default room).
   The toy world (toys and the little playset) is K times the v1 size; toy speeds grow by sqrt(K)
   so jumps and runs feel the same at the bigger size. */
const K = 1.5, VS = Math.sqrt(K);
const HALF = 2.0;                                   // only for fallbacks
const GRAV = 9.8, MATCH_TIME = 180, WALL_H = 2.5;
// mom pops in: at the start (while everyone gets ready), with two minutes and with one minute to go, and at nap time
const COUNT_T = 6.5, MOM_AT = [120, 60], MOM_VISIT = 5.6;
function momVisit(st, cd, nap) { if (st === 0) return { id: 's', t: COUNT_T - cd }; if (st === 1) for (const a of MOM_AT) { const t = a + 1.2 - nap; if (t >= 0 && t < MOM_VISIT) return { id: 'm' + a, t }; } return null; }
const momLooking = v => !!v && v.t > 1.0 && v.t < 4.6;   // the toys freeze while she's looking (like toys do)
const BOX = { c: V(), yaw: 0, q: Q(), inv: Q(), w: 1.35, d: 0.78, h: 0.5, t: 0.04 };   // open-top chest against a wall; local +z faces the room
const AREA = { poly: [], edges: [], minX: -2, maxX: 2, minZ: -2, maxZ: 2, cx: 0, cz: 0, size: 0, start: V() };
const DEFAULT_AREA = { poly: [[-2.1, -1.8], [2.1, -1.8], [2.1, 1.8], [-2.1, 1.8]], start: [0, -0.8] };
function inPoly(P, x, z) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) c = !c; } return c; }
function segDist(e, x, z, out) { const t = clamp(((x - e.a.x) * e.dx + (z - e.a.z) * e.dz), 0, e.len); const px = e.a.x + e.dx * t, pz = e.a.z + e.dz * t; if (out) { out.x = px; out.z = pz; out.t = t; } return Math.hypot(x - px, z - pz); }
function setupArea(a) {
  const P = a.poly.map(p => ({ x: p[0], z: p[1] })); AREA.poly = P; AREA.edges = [];
  let sa = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; sa += p.x * q.z - q.x * p.z; } AREA.size = Math.abs(sa) / 2;
  AREA.minX = Math.min(...P.map(p => p.x)); AREA.maxX = Math.max(...P.map(p => p.x)); AREA.minZ = Math.min(...P.map(p => p.z)); AREA.maxZ = Math.max(...P.map(p => p.z));
  AREA.cx = P.reduce((s, p) => s + p.x, 0) / P.length; AREA.cz = P.reduce((s, p) => s + p.z, 0) / P.length;
  for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length], len = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / len, dz = (B.z - A.z) / len;
    let nx = -dz, nz = dx; const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2; if (!inPoly(P, mx + nx * 0.02, mz + nz * 0.02)) { nx = -nx; nz = -nz; }
    AREA.edges.push({ i, a: A, b: B, len, dx, dz, nx, nz, mx, mz }); }
  AREA.start.set(a.start ? a.start[0] : AREA.cx, 0, a.start ? a.start[1] : AREA.cz);
  if (!a.box) a.box = placeBox(AREA.start);
  BOX.c.set(a.box[0], 0, a.box[1]); BOX.yaw = a.box[2]; BOX.q.setFromAxisAngle(Y_AX, BOX.yaw); BOX.inv.copy(BOX.q).invert();
  return a;
}
// the chest goes against the wall nearest where the toddler starts
function placeBox(s) {
  let best = null, bd = 1e9;
  for (const e of AREA.edges) { if (e.len < BOX.w + 0.3) continue; const d = segDist(e, s.x, s.z); if (d < bd) { bd = d; best = e; } }
  if (!best) best = AREA.edges.reduce((m, e) => e.len > m.len ? e : m, AREA.edges[0]);
  const o = {}; segDist(best, s.x, s.z, o); const m = Math.min(BOX.w / 2 + 0.02, best.len / 2); let t = clamp(o.t, m, best.len - m);
  if (t - m < 0.5) t = m; else if (best.len - m - t < 0.5) t = best.len - m;
  const x = best.a.x + best.dx * t + best.nx * (BOX.d / 2 + 0.03), z = best.a.z + best.dz * t + best.nz * (BOX.d / 2 + 0.03);
  return [r3(x), r3(z), r3(Math.atan2(best.nx, best.nz))];
}
AREA.dist = (x, z) => { let d = 1e9; for (const e of AREA.edges) d = Math.min(d, segDist(e, x, z)); return d; };
AREA.inside = (x, z, m) => inPoly(AREA.poly, x, z) && (!m || AREA.dist(x, z) >= m);
AREA.clampIn = (p, r) => { for (let k = 0; k < 3; k++) { if (AREA.inside(p.x, p.z, r)) return false; let best = null, bd = 1e9, o = {}, bo = {};
    for (const e of AREA.edges) { const d = segDist(e, p.x, p.z, o); if (d < bd) { bd = d; best = e; bo.x = o.x; bo.z = o.z; } }
    p.x = bo.x + best.nx * (r + 0.002); p.z = bo.z + best.nz * (r + 0.002); } return true; };
AREA.rand = (rng, m) => { for (let i = 0; i < 400; i++) { const x = lerp(AREA.minX, AREA.maxX, rng()), z = lerp(AREA.minZ, AREA.maxZ, rng()); if (AREA.inside(x, z, m)) return V(x, 0, z); } return V(AREA.cx, 0, AREA.cz); };
const _bl = new THREE.Vector3();
function boxLocal(p, out) { return (out || _bl).set(p.x - BOX.c.x, p.y, p.z - BOX.c.z).applyQuaternion(BOX.inv); }
function boxFront(d) { return V(0, 0, BOX.d / 2 + d).applyQuaternion(BOX.q).add(BOX.c); }
setupArea(JSON.parse(JSON.stringify(DEFAULT_AREA)));

/* ---------- colliders ----------
   kinds: 0 oriented box, 1 upright cylinder, 2 sphere. Each has c (centre) and br (bounding radius).
   flags: climb (toys can climb its sides), bounce (extra springy), dyn (moves: has vAt(p) for its surface speed) */
function cBox(c, h, q, o) { q = q || Q(); return Object.assign({ k: 0, c, h, q, inv: q.clone().invert(), br: h.length() }, o || {}); }
function cCyl(c, r, hh, o) { return Object.assign({ k: 1, c, r, hh, br: Math.hypot(r, hh) }, o || {}); }
function cSph(c, r, o) { return Object.assign({ k: 2, c, r, br: r }, o || {}); }
function barQuat(a, b) { const d = V().subVectors(b, a).normalize(); return Q().setFromUnitVectors(Y_AX, d); }
function cBar(a, b, t, o) { const c = V().addVectors(a, b).multiplyScalar(0.5); return cBox(c, V(t, a.distanceTo(b) / 2, t), barQuat(a, b), o); }
function refreshBox(col) { col.inv.copy(col.q).invert(); }

const _l = V(), _cl = V(), _d = V();
// sphere (p, r) against a collider: fills out.n (push-out direction), out.pen (how deep). false if apart.
function hit(col, p, r, out) {
  if (col.off) return false;
  const dx0 = p.x - col.c.x, dy0 = p.y - col.c.y, dz0 = p.z - col.c.z, br = col.br + r;
  if (dx0 * dx0 + dy0 * dy0 + dz0 * dz0 > br * br) return false;
  if (col.k === 2) {
    const l = Math.sqrt(dx0 * dx0 + dy0 * dy0 + dz0 * dz0); if (l >= col.r + r) return false;
    if (l < 1e-6) out.n.set(0, 1, 0); else out.n.set(dx0 / l, dy0 / l, dz0 / l);
    out.pen = col.r + r - l; return true;
  }
  if (col.k === 1) {
    const rad = Math.hypot(dx0, dz0), cy = clamp(dy0, -col.hh, col.hh);
    const inR = rad < col.r, inY = Math.abs(dy0) < col.hh;
    if (inR && inY) {                                  // centre inside: leave by the nearer side or cap
      const side = col.r - rad, cap = col.hh - Math.abs(dy0);
      if (cap < side) { out.n.set(0, Math.sign(dy0) || 1, 0); out.pen = cap + r; }
      else { if (rad < 1e-6) out.n.set(1, 0, 0); else out.n.set(dx0 / rad, 0, dz0 / rad); out.pen = side + r; }
      return true;
    }
    const cr = Math.min(rad, col.r), ex = rad > 1e-6 ? dx0 / rad * cr : 0, ez = rad > 1e-6 ? dz0 / rad * cr : 0;
    const ddx = dx0 - ex, ddy = dy0 - cy, ddz = dz0 - ez, l = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
    if (l >= r) return false;
    if (l < 1e-6) { out.n.set(0, 1, 0); out.pen = r; return true; }
    out.n.set(ddx / l, ddy / l, ddz / l); out.pen = r - l; return true;
  }
  // oriented box
  _l.set(dx0, dy0, dz0).applyQuaternion(col.inv);
  const h = col.h;
  _cl.set(clamp(_l.x, -h.x, h.x), clamp(_l.y, -h.y, h.y), clamp(_l.z, -h.z, h.z));
  _d.subVectors(_l, _cl); const d2 = _d.lengthSq();
  if (d2 > r * r) return false;
  if (d2 > 1e-12) { const d = Math.sqrt(d2); out.n.copy(_d).divideScalar(d).applyQuaternion(col.q); out.pen = r - d; return true; }
  const ex = h.x - Math.abs(_l.x), ey = h.y - Math.abs(_l.y), ez = h.z - Math.abs(_l.z);
  if (ey <= ex && ey <= ez) { out.n.set(0, Math.sign(_l.y) || 1, 0); out.pen = ey + r; }
  else if (ex <= ez) { out.n.set(Math.sign(_l.x) || 1, 0, 0); out.pen = ex + r; }
  else { out.n.set(0, 0, Math.sign(_l.z) || 1); out.pen = ez + r; }
  out.n.applyQuaternion(col.q); return true;
}
// a simple uniform grid so each body only tests nearby colliders
function makeGrid(cols, cell) {
  const g = { cell, map: new Map(), big: [] };
  const key = (i, j) => i * 4096 + j;
  for (const c of cols) {
    if (c.br > cell * 3) { g.big.push(c); continue; }
    const i0 = Math.floor((c.c.x - c.br) / cell), i1 = Math.floor((c.c.x + c.br) / cell), j0 = Math.floor((c.c.z - c.br) / cell), j1 = Math.floor((c.c.z + c.br) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); let a = g.map.get(k); if (!a) g.map.set(k, a = []); a.push(c); }
  }
  g.near = (p, out) => { out.length = 0; const a = g.map.get(key(Math.floor(p.x / cell), Math.floor(p.z / cell))); if (a) for (const c of a) out.push(c); for (const c of g.big) out.push(c); return out; };
  return g;
}

/* ---------- shapes for drawing: unit primitives, merged by material so the Quest draws few meshes ---------- */
const PRIM = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14, 1),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 7, 1),
  sph: new THREE.SphereGeometry(1, 14, 10),
  sphLo: new THREE.SphereGeometry(1, 9, 6),
  cone: new THREE.ConeGeometry(1, 1, 14, 1),
  tor: new THREE.TorusGeometry(1, 0.36, 8, 18),
  ring: new THREE.TorusGeometry(1, 0.12, 6, 20),
  hemi: new THREE.SphereGeometry(1, 14, 7, 0, TAU, 0, Math.PI / 2),
};
for (const k in PRIM) if (PRIM[k].index) PRIM[k] = PRIM[k].toNonIndexed();
const _m4 = new THREE.Matrix4(), _n3 = new THREE.Matrix3(), _pv = V(), _nv = V(), _cv = V();
// parts: [{g:'box', p:V, q:Quat, s:V, col:'#hex', uv: scale}] -> one BufferGeometry with colours and "odir" (outline push direction)
function mergeParts(parts) {
  let n = 0; for (const it of parts) n += PRIM[it.g].attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), U = new Float32Array(n * 2), O = new Float32Array(n * 3);
  let o = 0; const col = new THREE.Color();
  for (const it of parts) {
    const src = PRIM[it.g], sp = src.attributes.position, sn = src.attributes.normal, su = src.attributes.uv;
    _m4.compose(it.p, it.q || Q(), it.s); _n3.getNormalMatrix(_m4); col.set(it.col || '#ffffff');
    const uvs = it.uv || 1, us = it.uvx || 1;
    for (let i = 0; i < sp.count; i++, o++) {
      _pv.fromBufferAttribute(sp, i).applyMatrix4(_m4); _nv.fromBufferAttribute(sn, i).applyMatrix3(_n3).normalize();
      P[o * 3] = _pv.x; P[o * 3 + 1] = _pv.y; P[o * 3 + 2] = _pv.z; N[o * 3] = _nv.x; N[o * 3 + 1] = _nv.y; N[o * 3 + 2] = _nv.z;
      C[o * 3] = col.r; C[o * 3 + 1] = col.g; C[o * 3 + 2] = col.b;
      U[o * 2] = su.getX(i) * uvs * us + (it.uo || 0); U[o * 2 + 1] = su.getY(i) * uvs + (it.vo || 0);
      _cv.subVectors(_pv, it.p); const l = _cv.length(); if (l > 1e-6) _cv.divideScalar(l); else _cv.copy(_nv);
      _cv.add(_nv).normalize(); O[o * 3] = _cv.x; O[o * 3 + 1] = _cv.y; O[o * 3 + 2] = _cv.z;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('odir', new THREE.BufferAttribute(O, 3));
  g.computeBoundingSphere(); return g;
}
// thick black outline: the same mesh pushed out along "odir", drawn inside-out
function outlineMat(w, color) {
  const m = new THREE.MeshBasicMaterial({ color: color || 0x15121a, side: THREE.BackSide });
  m.onBeforeCompile = sh => { sh.vertexShader = 'attribute vec3 odir;\n' + sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + odir * ${w.toFixed(4)};`); };
  m.customProgramCacheKey = () => 'ol' + w; return m;
}
function edgesOf(parts, angle) {      // drawing-style lines (Van Eyck level)
  const segs = [];
  for (const it of parts) {
    const eg = EDGE_CACHE[it.g] || (EDGE_CACHE[it.g] = new THREE.EdgesGeometry(PRIM[it.g], angle || 30));
    _m4.compose(it.p, it.q || Q(), it.s); const a = eg.attributes.position;
    for (let i = 0; i < a.count; i++) { _pv.fromBufferAttribute(a, i).applyMatrix4(_m4); segs.push(_pv.x, _pv.y, _pv.z); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); return g;
}
const EDGE_CACHE = {};

/* ---------- little canvas textures ---------- */
function canvasTex(size, draw, rep) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); draw(x, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep, rep);
  t.anisotropy = 4; return t;
}
function noiseFill(x, s, lo, hi, tint) {
  const img = x.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = lo + Math.random() * (hi - lo); d[i] = d[i] * v; d[i + 1] = d[i + 1] * v; d[i + 2] = d[i + 2] * v * (tint || 1); }
  x.putImageData(img, 0, 0);
}

/* ---------- sound: small synth, no files ---------- */
const sfx = {
  ctx: null, master: null, musicG: null, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
    this.musicG = this.ctx.createGain(); this.musicG.gain.value = 0.22; this.musicG.connect(this.master);
    const n = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, n, n); const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  },
  mute(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.8; },
  tone(type, f0, f1, dur, vol, when, dest) {
    const c = this.ctx; if (!c) return; const t = when || c.currentTime;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + dur + 0.05); return o;
  },
  hiss(dur, vol, fc, q, when, dest, f1) {
    const c = this.ctx; if (!c) return; const t = when || c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(fc, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  // a baby-ish voice: sawtooth through a vowel filter, with wobble
  voice(f, dur, vol, vowel, wob) {
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = wob || 7; lg.gain.value = f * 0.06; lfo.connect(lg); lg.connect(o.frequency);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = vowel || 900; f1.Q.value = 4;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f1); f1.connect(g); g.connect(this.master); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  },
  play(name, vol = 1, pitch = 1) {
    if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime, P = pitch, v = vol;
    switch (name) {
      case 'jump': this.tone('square', 300 * P, 620 * P, 0.12, 0.05 * v); break;
      case 'land': this.tone('sine', 140 * P, 60 * P, 0.08, 0.08 * v); break;
      case 'boing': this.tone('triangle', 220 * P, 880 * P, 0.25, 0.12 * v); this.tone('sine', 110 * P, 440 * P, 0.3, 0.08 * v); break;
      case 'squeak': this.tone('square', 1500 * P, 2400 * P, 0.09, 0.07 * v); this.tone('square', 2300 * P, 1400 * P, 0.12, 0.06 * v, t + 0.09); break;
      case 'grab': this.tone('sine', 520 * P, 260 * P, 0.1, 0.12 * v); this.hiss(0.06, 0.05 * v, 3000); break;
      case 'throw': this.hiss(0.22, 0.09 * v, 1200, 2, 0, null, 400); break;
      case 'away': this.tone('sine', 660 * P, 990 * P, 0.1, 0.12 * v); this.tone('sine', 990 * P, 1320 * P, 0.14, 0.1 * v, t + 0.08); this.tone('triangle', 120, 60, 0.15, 0.15 * v); break;
      case 'stun': for (let i = 0; i < 3; i++) this.tone('sine', 1800 + i * 300, 1200, 0.12, 0.04 * v, t + i * 0.07); break;
      case 'slam': this.tone('sine', 90, 30, 0.5, 0.45 * v); this.hiss(0.4, 0.25 * v, 300, 0.8); break;
      case 'waah': this.voice(420 * P, 0.9, 0.16 * v, 1100, 9); break;
      case 'chomp': this.hiss(0.08, 0.15 * v, 900, 3); this.tone('sine', 200, 120, 0.12, 0.15 * v, t + 0.05); this.voice(300, 0.3, 0.08 * v, 600, 5); break;
      case 'giggle': for (let i = 0; i < 5; i++) { const tt = t + i * 0.13; const o = this.tone('sawtooth', (520 + i * 30) * P, (440 + i * 30) * P, 0.1, 0.06 * v, tt); } this.hiss(0.6, 0.02 * v, 2000, 1); break;
      case 'tickle': this.tone('sine', 900 * P, 1300 * P, 0.07, 0.06 * v); break;
      case 'bonk': this.tone('square', 180, 90, 0.12, 0.12 * v); this.tone('sine', 700, 500, 0.15, 0.06 * v); break;
      case 'splash': this.hiss(0.35, 0.18 * v, 2500, 0.7, 0, null, 800); break;
      case 'pop': this.tone('sine', 900, 200, 0.08, 0.2 * v); this.hiss(0.05, 0.15 * v, 2000); break;
      case 'confetti': for (let i = 0; i < 6; i++) this.hiss(0.05, 0.1 * v, 2000 + Math.random() * 3000, 2, t + i * 0.03); this.tone('square', 600, 1200, 0.1, 0.06 * v); break;
      case 'drum': this.tone('sine', 120, 50, 0.4, 0.4 * v); this.hiss(0.15, 0.12 * v, 200); break;
      case 'roar': this.voice(150, 0.6, 0.12 * v, 500, 15); this.hiss(0.5, 0.06 * v, 600, 1); break;
      case 'whistle': this.tone('sine', 1200, 1250, 0.4, 0.06 * v); this.tone('sine', 1500, 1520, 0.4, 0.05 * v); break;
      case 'zip': this.tone('sawtooth', 300, 1600, 0.2, 0.05 * v); break;
      case 'slip': this.tone('sine', 800, 300, 0.2, 0.08 * v); break;
      case 'spin': this.tone('triangle', 500, 900, 0.5, 0.05 * v); break;
      case 'creak': this.tone('sawtooth', 90 * P, 70 * P, 0.25, 0.03 * v); break;
      case 'crank': this.tone('square', 2000 + Math.random() * 400, 1800, 0.03, 0.03 * v); break;
      case 'lullaby': [0, 4, 7, 12, 7, 4].forEach((s, i) => this.tone('sine', 880 * Math.pow(2, s / 12), 0, 0.5, 0.07 * v, t + i * 0.18)); break;
      case 'hop': this.tone('triangle', 400, 800, 0.15, 0.08 * v); this.tone('triangle', 600, 1200, 0.15, 0.06 * v, t + 0.08); break;
      case 'tick': this.tone('square', 1200, 1200, 0.04, 0.05 * v); break;
      case 'go': this.tone('square', 523, 523, 0.15, 0.08 * v); this.tone('square', 784, 784, 0.3, 0.08 * v, t + 0.15); break;
      case 'win': [0, 4, 7, 12].forEach((s, i) => this.tone('triangle', 523 * Math.pow(2, s / 12), 0, 0.35, 0.1 * v, t + i * 0.12)); break;
      case 'yawn': this.voice(380, 1.4, 0.1 * v, 700, 3); break;
      case 'boom': this.hiss(0.35, 0.3 * v, 500, 0.7, 0, null, 120); this.tone('sine', 140, 50, 0.3, 0.3 * v); break;
      case 'launch': this.hiss(0.6, 0.15 * v, 800, 1, 0, null, 3000); this.tone('sawtooth', 120, 400, 0.4, 0.04 * v); break;
      case 'cannon': this.tone('sine', 110, 40, 0.25, 0.4 * v); this.hiss(0.15, 0.2 * v, 400); break;
      case 'pew': for (let i = 0; i < 3; i++) this.tone('square', 1400, 500, 0.08, 0.05 * v, t + i * 0.07); break;
      case 'bubble': for (let i = 0; i < 4; i++) this.tone('sine', 600 + Math.random() * 600, 1500, 0.06, 0.05 * v, t + i * 0.06); break;
      case 'heli': for (let i = 0; i < 8; i++) this.hiss(0.04, 0.1 * v, 300, 2, t + i * 0.06); break;
      case 'chatter': for (let i = 0; i < 6; i++) this.tone('square', 900, 700, 0.03, 0.05 * v, t + i * 0.05); break;
      case 'clatter': for (let i = 0; i < 5; i++) this.tone('square', 300 + Math.random() * 500, 150, 0.05, 0.06 * v, t + i * 0.045 + Math.random() * 0.03); break;
      case 'clock': this.tone('square', 2400 * P, 2200 * P, 0.025, 0.05 * v); break;
      case 'door': this.tone('sawtooth', 120, 90, 0.6, 0.04 * v); this.hiss(0.5, 0.05 * v, 300, 1); break;
      case 'click': this.tone('square', 1800 * P, 1600 * P, 0.03, 0.09 * v); this.tone('square', 900 * P, 800 * P, 0.04, 0.07 * v, t + 0.05); break;
      case 'scratch': this.hiss(0.35, 0.2 * v, 2500, 3, 0, null, 400); this.tone('sawtooth', 300, 80, 0.3, 0.05 * v); break;
      case 'needle': for (let i = 0; i < 8; i++) this.hiss(0.02, 0.06 * v, 3000 + Math.random() * 2000, 4, t + Math.random() * 0.5); break;
      case 'shove': this.hiss(0.12, 0.08 * v, 900, 1.5, 0, null, 300); if (P > 1) this.tone('sine', 160, 70, 0.12, 0.18 * v, t + 0.05); break;
      case 'thud': this.tone('sine', 100 * P, 38, 0.32, 0.4 * v); this.hiss(0.2, 0.14 * v, 260, 0.8); break;
      case 'eat': for (let i = 0; i < 3; i++) { this.hiss(0.06, 0.14 * v, 800, 3, t + i * 0.16); this.tone('sine', 220, 140, 0.08, 0.1 * v, t + i * 0.16 + 0.03); } this.voice(520, 0.4, 0.08 * v, 900, 4); break;
      case 'babble': this.voice(380 + Math.random() * 120, 0.25, 0.07 * v, 800 + Math.random() * 600, 6); this.voice(420 + Math.random() * 120, 0.22, 0.06 * v, 1000, 6); break;
    }
  },
};

/* ---------- music: one little loop per phase of the match ---------- */
const MUSIC = { phase: -1, step: 0, next: 0, timer: null };
const NOTE = s => 220 * Math.pow(2, s / 12);
// patterns: 16 steps; each entry: [step, voice, semitone]
const TWINKLE = [0, 0, 7, 7, 9, 9, 7, -99, 5, 5, 4, 4, 2, 2, 0, -99];
const SONGS = [
  { bpm: 104, play(i, t) { // EPIC: drums and brass stabs in minor
      if (i % 4 === 0) sfx.tone('sine', 110, 40, 0.35, 0.5, t, sfx.musicG);
      if (i % 8 === 4) sfx.hiss(0.18, 0.25, 900, 0.7, t, sfx.musicG);
      const ch = [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5]][(i >> 2) & 3];
      if (i % 4 === 0 || i % 16 === 14) for (const s of ch) sfx.tone('sawtooth', NOTE(s), NOTE(s) * 0.99, 0.3, 0.05, t, sfx.musicG);
    } },
  { bpm: 140, play(i, t) { // SILLY: oom-pah and xylophone
      const bass = [0, 7, 5, 7][(i >> 1) & 3] - 12;
      if (i % 2 === 0) sfx.tone('triangle', NOTE(bass), 0, 0.15, 0.25, t, sfx.musicG);
      const mel = [12, 16, 19, 16, 14, 17, 21, 17, 12, 16, 19, 24, 21, 19, 16, 14][i];
      if (i % 2 === 1 || i % 4 === 0) sfx.tone('sine', NOTE(mel) * 2, 0, 0.12, 0.09, t, sfx.musicG);
      if (i === 15) sfx.tone('triangle', 200, 700, 0.2, 0.07, t, sfx.musicG);
    } },
  { bpm: 76, play(i, t) { // SPOOKY BUT PLAYFUL: heartbeat and a wonky music box
      if (i % 8 === 0 || i % 8 === 2) sfx.tone('sine', 60, 40, 0.25, 0.5, t, sfx.musicG);
      const mel = [12, 15, 19, 18, 15, 12, 11, 12][i >> 1];
      if (i % 2 === 0) { sfx.tone('sine', NOTE(mel) * 2, 0, 0.5, 0.06, t, sfx.musicG); sfx.tone('sine', NOTE(mel) * 2.02, 0, 0.5, 0.03, t, sfx.musicG); }
      if (i === 12) sfx.hiss(1.2, 0.03, 500, 2, t, sfx.musicG, 1500);
    } },
  { bpm: 84, play(i, t) { // SLEEPY: twinkle on a music box over soft pads
      const s = TWINKLE[i]; if (s > -99) sfx.tone('sine', NOTE(s + 12) * 2, 0, 0.6, 0.07, t, sfx.musicG);
      if (i % 8 === 0) for (const k of [0, 4, 7]) sfx.tone('triangle', NOTE(k - 12), 0, 1.4, 0.04, t, sfx.musicG);
    } },
  { bpm: 60, play(i, t) { // the RECORD PLAYER's lullaby (Brahms): slow music box, warm and woozy
      const m = [4, 4, 7, -99, 4, 4, 7, -99, 4, 7, 12, 11, 9, 9, 7, -99][i]; if (m > -99) { sfx.tone('sine', NOTE(m + 12) * 2, 0, 0.9, 0.08, t, sfx.musicG); sfx.tone('sine', NOTE(m + 12) * 2.01, 0, 0.9, 0.03, t, sfx.musicG); }
      if (i % 4 === 0) sfx.tone('triangle', NOTE([0, 0, 5, 7][i >> 2] - 12), 0, 1.6, 0.05, t, sfx.musicG);
      if (i % 3 === 0) sfx.hiss(0.03, 0.012, 3000, 3, t, sfx.musicG);
    } },
];
function musicPhase(ph) {
  if (!sfx.ctx) return;
  if (ph === MUSIC.phase) return; MUSIC.phase = ph; MUSIC.step = 0; MUSIC.next = sfx.ctx.currentTime + 0.05;
  if (!MUSIC.timer) MUSIC.timer = setInterval(() => {
    if (MUSIC.phase < 0 || !sfx.ctx) return; const song = SONGS[MUSIC.phase], dt = 60 / song.bpm / 4;
    while (MUSIC.next < sfx.ctx.currentTime + 0.15) { if (!sfx.muted) song.play(MUSIC.step, MUSIC.next); MUSIC.step = (MUSIC.step + 1) % 16; MUSIC.next += dt; }
  }, 30);
}
function musicStop() { MUSIC.phase = -1; }
