/* ================= Toy Box: four procedural playgrounds =================
   Each level is a recipe: a seed goes in, the same playground comes out on every device
   (colliders for the physics, parts for the drawing, devices that move, and spawn spots).
   Every level has its own drawing style; see STYLE in each recipe and view.js for the materials. */

const LEVELS = [
  { id: 'bedroom', name: 'Cloud Bedroom', tag: "Kid's room",
    blurb: "A kid's bedroom with sky-and-clouds wallpaper: a bed to hide under, letter-block towers, a cardboard fort and a car ramp off a stack of books.",
    swatch: ['#78c4ff', '#ffffff', '#d9a26b', '#e23b2e'] },
  { id: 'vaneyck', name: 'Van Eyck Square', tag: 'Drawing',
    blurb: "An ink-drawn living room with a playset of stepping stones, steel domes and a sandpit, after Aldo van Eyck's postwar Amsterdam playgrounds.",
    swatch: ['#f4f2ec', '#9aa3a8', '#e23b2e', '#15121a'] },
  { id: 'noguchi', name: 'Noguchi Playscape', tag: 'Soft sculpture',
    blurb: "Blanket hills, a spiral slide, a primary-colored cube and paper lanterns, after Isamu Noguchi's playgrounds you climb like sculpture.",
    swatch: ['#f6d7c3', '#cbb7ea', '#ffd400', '#2f5cff'] },
  { id: 'memphis', name: 'Memphis Park', tag: 'Flat pop',
    blurb: "Squiggle wallpaper, a checkerboard floor and cones on pedestals, after the Memphis Group's loud 1980s Milan furniture.",
    swatch: ['#ffe9a8', '#ff3e8a', '#00c2b3', '#15121a'] },
  { id: 'junk', name: 'Junk Playground', tag: 'Textured',
    blurb: 'A wood-panelled den full of pallet forts, tire stacks and oil drums, after the first junk playground at Emdrup, Copenhagen (1943).',
    swatch: ['#efe2c8', '#a0703f', '#2b2b2b', '#c8553d'] },
];

function Builder(seed) {
  const rng = mulberry(seed), R = (a, b) => a + rng() * (b - a), pick = a => a[Math.floor(rng() * a.length)];
  // design units: everything here is drawn at v1 toy size, then scaled by K into the real room (scaleBuilder)
  const b = { rng, R, pick, cols: [], vis: {}, devices: [], spots: PRE_CLAIMS.map(c => Object.assign({}, c)), extra: [] };
  b.claim = (x, z, r) => b.spots.push({ x, z, r });
  b.free = (x, z, r) => {
    if (!AREA.inside(x * K, z * K, r * K + 0.12)) return false;
    for (const s of b.spots) if (Math.hypot(s.x - x, s.z - z) < s.r + r) return false;
    return true;
  };
  // find a free spot; in a small room, squeeze a little (the piece keeps its size, its elbow room shrinks)
  b.spot = (r, tries = 220) => { for (const f of [1, 0.8, 0.65]) for (let i = 0; i < tries; i++) { const x = R(AREA.minX, AREA.maxX) / K, z = R(AREA.minZ, AREA.maxZ) / K; if (b.free(x, z, r * f)) { b.claim(x, z, r * f); return { x, z }; } } return null; };
  b.add = (fam, it) => { (b.vis[fam] || (b.vis[fam] = [])).push(it); return it; };
  // c = centre of the box; s = full size
  b.box = (c, s, q, col, fam, o = {}) => { q = typeof q === 'number' ? qYaw(q) : (q || Q()); b.add(fam, { g: 'box', p: c.clone(), q, s: s.clone(), col, uv: o.uv || Math.max(s.x, s.y, s.z) * 4 });
    if (!o.noCol) b.cols.push(cBox(c.clone(), s.clone().multiplyScalar(0.5), q, { climb: !!o.climb, bounce: o.bounce || 0 })); };
  // c = centre of the base
  b.cyl = (c, r, h, col, fam, o = {}) => { const cc = V(c.x, c.y + h / 2, c.z); b.add(fam, { g: o.lo ? 'cyl6' : 'cyl', p: cc, q: o.q || Q(), s: V(r, h, r), col, uv: o.uv || 2 });
    if (!o.noCol) b.cols.push(cCyl(cc, r, h / 2, { climb: !!o.climb, bounce: o.bounce || 0 })); };
  b.sph = (c, r, col, fam, o = {}) => { b.add(fam, { g: o.lo ? 'sphLo' : 'sph', p: c.clone(), q: Q(), s: V(r, r * (o.sy || 1), r), col, uv: 2 }); if (!o.noCol) b.cols.push(cSph(c.clone(), r, { bounce: o.bounce || 0 })); };
  b.bar = (a, c, t, col, fam, o = {}) => { const q = barQuat(a, c), m = V().addVectors(a, c).multiplyScalar(0.5), L = a.distanceTo(c);
    b.add(fam, { g: 'cyl6', p: m, q, s: V(t, L + t * 0.6, t), col, uv: L * 4 }); if (!o.noCol) b.cols.push(cBar(a.clone(), c.clone(), t * 1.15, { climb: o.climb !== false })); };
  b.cone = (c, r, h, col, fam, o = {}) => { b.add(fam, { g: 'cone', p: V(c.x, c.y + h / 2, c.z), q: Q(), s: V(r, h, r), col });
    if (!o.noCol) { b.cols.push(cCyl(V(c.x, c.y + h * 0.25, c.z), r * 0.72, h * 0.25)); b.cols.push(cCyl(V(c.x, c.y + h * 0.65, c.z), r * 0.32, h * 0.18)); } };
  b.disc = (c, r, h, col, fam) => b.add(fam, { g: 'cyl', p: V(c.x, c.y + h / 2, c.z), q: Q(), s: V(r, h, r), col, uv: r * 6 });
  b.device = d => { b.devices.push(d); return d; };
  return b;
}
const rotY = (v, a) => v.clone().applyAxisAngle(Y_AX, a);

/* ---------- pieces every level shares ---------- */
let PRE_CLAIMS = [];
function commonBits() {}
function musicBox(b, c, yaw, col, look) {
  b.box(V(c.x, 0.05, c.z), V(0.15, 0.1, 0.11), yaw, col, '_skip', { noCol: false }); // collider only; drawn by view
  b.vis._skip.pop();
  return b.device({ type: 'mbox', c: V(c.x, 0, c.z), yaw, col, look, crank: V(c.x, 0.07, c.z).add(rotY(V(0.1, 0, 0), yaw)) });
}
function seesaw(b, c, yaw, col, look) {
  const len = 0.72;
  b.box(V(c.x, 0.04, c.z), V(0.06, 0.08, 0.1), yaw, look === 'drum' ? '#6f7f8c' : '#8a8f96', look === 'drum' ? 'rust' : 'steel');
  return b.device({ type: 'seesaw', c: V(c.x, 0.085, c.z), yaw, len, w: 0.11, th: 0.018, col, look, maxA: 0.27 });
}
function mgr(b, c, col) { return b.device({ type: 'mgr', c: V(c.x, 0, c.z), r: 0.32, h: 0.05, col }); }
function swing(b, top, yaw, len, col, look) { return b.device({ type: 'swing', pivot: top.clone(), yaw, len, col, look }); }
function groundSpots(b, n, H) {
  const out = [], bc = V(BOX.c.x / K, 0, BOX.c.z / K);
  for (let i = 0; i < n * 40 && out.length < n; i++) {
    const x = b.R(AREA.minX, AREA.maxX) / K, z = b.R(AREA.minZ, AREA.maxZ) / K;
    if (!AREA.inside(x * K, z * K, 0.2) || Math.hypot(x - bc.x, z - bc.z) < 0.75) continue;
    let ok = true; for (const s of b.spots) if (Math.hypot(s.x - x, s.z - z) < s.r * 0.75) { ok = false; break; }
    for (const o of out) if (Math.hypot(o.x - x, o.z - z) < 0.2) { ok = false; break; }
    if (ok) out.push(V(x, (H ? H(x, z) : 0) + 0.1, z));
  }
  while (out.length < n) { const p = AREA.rand(b.rng, 0.3).divideScalar(K); p.y = 0.3; out.push(p); }
  return out;
}

/* ================= 0. CLOUD BEDROOM: a kid's room full of toys ================= */
function genBedroom(seed) {
  const b = Builder(seed), { R, pick } = b;
  const PRI = ['#e23b2e', '#2f5cff', '#ffd400', '#3fbf6f', '#ff7a1a', '#9b5cff'], CARD = '#c9965a';
  { const c = b.spot(0.2); if (c) musicBox(b, c, R(0, TAU), '#c98a4b', 'cube'); }
  { const c = b.spot(0.42); if (c) seesaw(b, c, R(0, TAU), '#ffd400', 'plank'); }
  { const c = b.spot(0.4); if (c) mgr(b, c, '#e23b2e'); }
  const block = (p, s, yaw) => { const k = Math.floor(b.rng() * 16); b.box(p, V(s, s, s), yaw, pick(PRI), 'abc', { climb: true, uv: 0.25 }); const it = b.vis.abc[b.vis.abc.length - 1]; it.uo = (k % 4) * 0.25; it.vo = Math.floor(k / 4) * 0.25; };
  // letter-block towers and a little pyramid
  for (let k = 0; k < 4; k++) { const c = b.spot(0.15); if (!c) continue; const n = 2 + Math.floor(R(0, 4)), s = 0.085, yaw = R(0, TAU);
    for (let i = 0; i < n; i++) block(V(c.x + R(-0.01, 0.01), s / 2 + i * s, c.z + R(-0.01, 0.01)), s, yaw + R(-0.25, 0.25)); }
  { const c = b.spot(0.22); if (c) { const s = 0.085, yaw = R(0, TAU); [3, 2, 1].forEach((n, r) => { for (let i = 0; i < n; i++) block(V(c.x, s / 2 + r * s, c.z).add(rotY(V((i - (n - 1) / 2) * s, 0, 0), yaw)), s, yaw); }); } }
  // a cardboard box fort with a doorway (a good hiding spot)
  { const c = b.spot(0.3); if (c) { const yaw = R(0, TAU), w = 0.36, H = 0.28, t = 0.012, at = (x, y, z) => V(c.x, 0, c.z).add(rotY(V(x, y, z), yaw));
    b.box(at(0, H / 2, -w / 2), V(w, H, t), yaw, CARD, 'card', { climb: true }); b.box(at(-w / 2, H / 2, 0), V(t, H, w), yaw, CARD, 'card', { climb: true }); b.box(at(w / 2, H / 2, 0), V(t, H, w), yaw, CARD, 'card', { climb: true });
    b.box(at(-w / 2 + 0.07, H / 2, w / 2), V(0.14, H, t), yaw, CARD, 'card', { climb: true }); b.box(at(w / 2 - 0.07, H / 2, w / 2), V(0.14, H, t), yaw, CARD, 'card', { climb: true }); b.box(at(0, H - 0.04, w / 2), V(0.1, 0.08, t), yaw, CARD, 'card');
    b.box(at(0, H + 0.006, 0), V(w + 0.02, t, w + 0.02), yaw, '#b8844c', 'card');
    for (const sx of [-1, 1]) b.box(at(sx * (w / 2 + 0.05), H + 0.03, 0), V(0.1, t, w), Q().setFromEuler(new THREE.Euler(0, yaw, sx * -0.5, 'YXZ')), '#b8844c', 'card', { noCol: true }); } }
  // a car ramp off a stack of books
  { const c = b.spot(0.42); if (c) { const yaw = R(0, TAU), at = (x, y, z) => V(c.x, 0, c.z).add(rotY(V(x, y, z), yaw)); let y = 0;
    for (let i = 0; i < 6; i++) { const h = R(0.025, 0.04); b.box(at(-0.25, y + h / 2, 0), V(R(0.18, 0.22), h, R(0.13, 0.16)), yaw + R(-0.15, 0.15), pick(PRI.concat(['#fffdf7'])), 'paint', { climb: true }); y += h; }
    const a = at(-0.17, y - 0.004, 0), e = at(0.38, 0.008, 0), mid = V().addVectors(a, e).multiplyScalar(0.5), dir = V().subVectors(e, a), L = dir.length(); dir.normalize();
    const side = V().crossVectors(dir, Y_AX).normalize(), up = V().crossVectors(side, dir).normalize(), q = Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, dir));
    b.box(mid, V(0.12, 0.01, L), q, '#ff7a1a', 'paint'); for (const sx of [-1, 1]) b.box(mid.clone().addScaledVector(side, sx * 0.06).addScaledVector(up, 0.01), V(0.008, 0.02, L), q, '#ff7a1a', 'paint', { noCol: true }); } }
  // a dollhouse to climb
  { const c = b.spot(0.2); if (c) { const yaw = R(0, TAU), at = (x, y, z) => V(c.x, 0, c.z).add(rotY(V(x, y, z), yaw));
    b.box(at(0, 0.1, 0), V(0.24, 0.2, 0.18), yaw, '#ffe0cf', 'paint', { climb: true });
    for (const sx of [-1, 1]) b.box(at(sx * 0.065, 0.245, 0), V(0.15, 0.012, 0.2), Q().setFromEuler(new THREE.Euler(0, yaw, sx * -0.75, 'YXZ')), '#e23b2e', 'paint');
    b.box(at(0, 0.06, 0.091), V(0.05, 0.09, 0.004), yaw, '#2f5cff', 'paint', { noCol: true }); for (const sx of [-1, 1]) b.box(at(sx * 0.07, 0.13, 0.091), V(0.04, 0.04, 0.004), yaw, '#8fd3ff', 'paint', { noCol: true }); } }
  // a ring of floor cushions
  for (let k = 0; k < 2; k++) { const c = b.spot(0.12); if (c) b.cyl(V(c.x, 0, c.z), 0.1, 0.05, pick(PRI), 'paint'); }
  return {
    id: 'bedroom', seed, b, H: null,
    style: { bg: '#bfe6ff', fog: ['#bfe6ff', 6, 22], toyOutline: 0.003,
      fams: { abc: { t: 'lambert', tex: 'abc' }, card: { t: 'lambert', tex: 'cardboard' }, paint: 'lambert', steel: 'lambert' } },
    parts: [{ shape: 'box', r: 0.03, cols: ['#e23b2e', '#2f5cff', '#ffd400', '#3fbf6f'] }, { shape: 'sph', r: 0.034, cols: ['#e23b2e', '#2f5cff', '#3fbf6f'] }, { shape: 'can', r: 0.028, cols: ['#ff7a1a', '#9b5cff', '#ffd400'] }],
    spawns: groundSpots(b, 60),
  };
}

/* ================= 1. VAN EYCK SQUARE: a drawing come alive ================= */
function genVanEyck(seed) {
  const b = Builder(seed), { R, pick } = b;
  const CON = '#e4e1da', CON2 = '#cfcbc2', STEEL = '#a3abb0', ACC = ['#e23b2e', '#2f5cff', '#ffd400'];
  commonBits(b, CON2, 'concrete');
  { const c = b.spot(0.2); if (c) musicBox(b, c, R(0, TAU), '#ffd400', 'kiosk'); }
  { const c = b.spot(0.42); if (c) seesaw(b, c, R(0, TAU), '#e23b2e', 'plank'); }
  // the igloo dome of steel tubes
  const dc = b.spot(0.52); if (dc) { const Rr = R(0.36, 0.44), M = 8, E = 6, pt = (e, f) => V(dc.x + Math.cos(e) * Math.cos(f) * Rr, Math.sin(e) * Rr, dc.z + Math.cos(e) * Math.sin(f) * Rr);
    for (let m = 0; m < M; m++) { const f = m / M * TAU; for (let e = 0; e < E; e++) b.bar(pt(e / E * Math.PI / 2, f), pt((e + 1) / E * Math.PI / 2, f), 0.008, STEEL, 'steel'); }
    for (const e of [0.02, 0.42, 0.85, 1.2]) { const n = 16; for (let i = 0; i < n; i++) b.bar(pt(e, i / n * TAU), pt(e, (i + 1) / n * TAU), 0.008, STEEL, 'steel'); }
  }
  // sandpit with a rim and stones inside
  const sp = b.spot(0.72); if (sp) {
    const Rr = R(0.5, 0.62), n = 26;
    for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2;
      b.box(V(sp.x + Math.cos(am) * Rr, 0.035, sp.z + Math.sin(am) * Rr), V(0.055, 0.07, 2 * Rr * Math.sin(Math.PI / n) + 0.01), -am, CON, 'concrete'); }
    b.disc(V(sp.x, 0, sp.z), Rr - 0.02, 0.006, '#eadfb3', 'sand');
    const k = 3 + Math.floor(R(0, 3));
    for (let i = 0; i < k; i++) { const a = i / k * TAU + R(0, 1), d = R(0.12, Rr - 0.15); b.cyl(V(sp.x + Math.cos(a) * d, 0, sp.z + Math.sin(a) * d), R(0.05, 0.07), R(0.04, 0.13), CON, 'concrete'); }
  }
  // stepping-stone clusters: a rising ring, or a little grid
  for (let k = 0; k < 3; k++) { const c = b.spot(0.42); if (!c) continue;
    if (k % 2 === 0) { const n = 8 + Math.floor(R(0, 3)), Rr = R(0.26, 0.32), a0 = R(0, TAU);
      for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU * 0.92; b.cyl(V(c.x + Math.cos(a) * Rr, 0, c.z + Math.sin(a) * Rr), R(0.05, 0.065), 0.03 + i / n * 0.17, i === n - 1 ? pick(ACC) : CON, 'concrete'); } }
    else for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) b.cyl(V(c.x + i * 0.15, 0, c.z + j * 0.15), 0.06, R(0.03, 0.14), CON, 'concrete');
  }
  // tumbling bars: three frames stepping up
  for (let k = 0; k < 2; k++) { const c = b.spot(0.34); if (!c) continue; const yaw = R(0, TAU), hs = [0.1, 0.16, 0.22];
    hs.forEach((h, i) => { const x = (i - 1) * 0.15, a = V(c.x, 0, c.z).add(rotY(V(x, 0, -0.17), yaw)), e = V(c.x, 0, c.z).add(rotY(V(x, 0, 0.17), yaw));
      b.bar(a, V(a.x, h, a.z), 0.008, STEEL, 'steel'); b.bar(e, V(e.x, h, e.z), 0.008, STEEL, 'steel'); b.bar(V(a.x, h, a.z), V(e.x, h, e.z), 0.008, STEEL, 'steel'); });
  }
  // arch climber: a row of half-hoops
  { const c = b.spot(0.36); if (c) { const yaw = R(0, TAU), col = pick(ACC), Rr = 0.17;
    for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.1; for (let s = 0; s < 8; s++) { const a0 = s / 8 * Math.PI, a1 = (s + 1) / 8 * Math.PI;
      const p0 = V(c.x, 0, c.z).add(rotY(V(x, Math.sin(a0) * Rr, Math.cos(a0) * Rr), yaw)), p1 = V(c.x, 0, c.z).add(rotY(V(x, Math.sin(a1) * Rr, Math.cos(a1) * Rr), yaw)); b.bar(p0, p1, 0.008, col, 'paint'); } }
    for (const zz of [-Rr, Rr]) b.bar(V(c.x, 0.002, c.z).add(rotY(V(-0.2, 0, zz), yaw)), V(c.x, 0.002, c.z).add(rotY(V(0.2, 0, zz), yaw)), 0.008, col, 'paint'); } }
  // trees, drawn as lollipops
  for (let k = 0; k < 4; k++) { const c = b.spot(0.22); if (!c) continue; const h = R(0.45, 0.6); b.cyl(V(c.x, 0, c.z), 0.022, h, '#8f8a80', 'trunk', { climb: true }); b.sph(V(c.x, h + 0.14, c.z), R(0.17, 0.23), '#fbfaf6', 'canopy'); }
  // low concrete tables and blocks
  for (let k = 0; k < 6; k++) { const c = b.spot(0.18); if (!c) continue; const s = V(R(0.12, 0.3), R(0.04, 0.12), R(0.12, 0.26)); b.box(V(c.x, s.y / 2, c.z), s, R(0, Math.PI), CON, 'concrete'); }
  return {
    id: 'vaneyck', seed, b, H: null,
    style: { bg: '#f4f2ec', fog: ['#f4f2ec', 6, 22], hemi: ['#ffffff', '#cfcabe', 0.82], sun: ['#ffffff', 0.5, V(-0.4, 1, 0.3)], edges: '#26232b',
      ground: { tex: 'paving', col: '#f1efe8' }, toyOutline: 0.0035,
      fams: { concrete: 'lambert', steel: 'lambert', paint: 'lambert', sand: { t: 'lambert', tex: 'sand' }, trunk: 'lambert', canopy: 'lambert' } },
    parts: [{ shape: 'sph', r: 0.034, cols: ['#e23b2e', '#2f5cff', '#ffd400'] }, { shape: 'box', r: 0.03, cols: ['#d9a066', '#e8c48a', '#c98f55'] }, { shape: 'bucket', r: 0.033, cols: ['#ff7a1a', '#00c2b3', '#e23b2e'] }],
    spawns: groundSpots(b, 60),
  };
}

/* ================= 2. NOGUCHI PLAYSCAPE: soft sculpted ground ================= */
function genNoguchi(seed) {
  const b = Builder(seed), { R, pick } = b;
  const PRI = ['#e8402f', '#ffd21f', '#2e5bea'], STONE = '#efe6da';
  commonBits(b, '#e9d9cf', 'stone');
  { const c = b.spot(0.2); if (c) musicBox(b, c, R(0, TAU), '#2e5bea', 'cube'); }
  // swing set
  let sw = b.spot(0.42); if (sw) { const yaw = R(0, TAU), H = 0.42, W = 0.36, col = PRI[2];
    for (const sx of [-1, 1]) { const top = V(sw.x, H, sw.z).add(rotY(V(sx * W, 0, 0), yaw));
      b.bar(V(sw.x, 0, sw.z).add(rotY(V(sx * W, 0, -0.14), yaw)), top, 0.009, col, 'paint'); b.bar(V(sw.x, 0, sw.z).add(rotY(V(sx * W, 0, 0.14), yaw)), top, 0.009, col, 'paint'); }
    b.bar(V(sw.x, H, sw.z).add(rotY(V(-W, 0, 0), yaw)), V(sw.x, H, sw.z).add(rotY(V(W, 0, 0), yaw)), 0.01, col, 'paint');
    for (const sx of [-0.15, 0.15]) swing(b, V(sw.x, H, sw.z).add(rotY(V(sx, 0, 0), yaw)), yaw, 0.32, sx < 0 ? PRI[0] : PRI[1], 'seat'); }
  // spiral slide round a pole, with a ladder up the back
  { const c = b.spot(0.34); if (c) { const top = 0.44, rr = 0.17, turns = 1.25, n = 18, a0 = R(0, TAU);
    b.cyl(V(c.x, 0, c.z), 0.026, top + 0.08, PRI[1], 'paint', { climb: true });
    const P = t => { const a = a0 + t * turns * TAU; return V(c.x + Math.cos(a) * rr, lerp(top, 0.03, t), c.z + Math.sin(a) * rr); };
    for (let i = 0; i < n; i++) { const p0 = P(i / n), p1 = P((i + 1) / n), mid = V().addVectors(p0, p1).multiplyScalar(0.5), t = V().subVectors(p1, p0), L = t.length(); t.normalize();
      const out = V(mid.x - c.x, 0, mid.z - c.z).normalize(), up = V().crossVectors(t, out).normalize(); if (up.y < 0) up.negate(); const ox = V().crossVectors(up, t).normalize();
      const q = Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ox, up, t)); b.box(mid, V(0.1, 0.012, L + 0.012), q, PRI[2], 'paint'); }
    const lp = P(0), ld = V(lp.x - c.x, 0, lp.z - c.z).normalize(), base = V(c.x, 0, c.z).addScaledVector(ld, rr + 0.12), side = V(-ld.z, 0, ld.x).multiplyScalar(0.045);
    const l1 = base.clone().add(side), l2 = base.clone().sub(side);
    b.bar(l1, V(l1.x, top, l1.z), 0.008, PRI[0], 'paint'); b.bar(l2, V(l2.x, top, l2.z), 0.008, PRI[0], 'paint');
    for (let h = 0.05; h < top; h += 0.06) b.bar(V(l1.x, h, l1.z), V(l2.x, h, l2.z), 0.007, PRI[0], 'paint');
    b.box(V(lp.x, top - 0.008, lp.z).lerp(V(base.x, top - 0.008, base.z), 0.5), V(0.12, 0.016, 0.14), Math.atan2(ld.x, ld.z), STONE, 'stone'); } }
  // cube jungle gym: a lattice, one primary colour per direction
  { const c = b.spot(0.32); if (c) { const n = 3, s = 0.11, o = V(c.x - n * s / 2, 0.004, c.z - n * s / 2), P = (i, j, k) => V(o.x + i * s, o.y + j * s, o.z + k * s);
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) {
      if (i < n) b.bar(P(i, j, k), P(i + 1, j, k), 0.0075, PRI[0], 'paint'); if (j < n) b.bar(P(i, j, k), P(i, j + 1, k), 0.0075, PRI[1], 'paint'); if (k < n) b.bar(P(i, j, k), P(i, j, k + 1), 0.0075, PRI[2], 'paint'); } } }
  // rolling mounds first; everything else is built in the flat ground between them
  const mounds = [];
  for (let k = 0; k < 8 && mounds.length < 3; k++) { const s = R(0.4, 0.6), c = b.spot(s * 0.7); if (!c) continue; mounds.push({ x: c.x, z: c.z, h: R(0.14, 0.3), s }); }
  // stepped play pyramid with a slide down one face
  { const c = b.spot(0.5); if (c) { const yaw = R(0, TAU), tiers = 4;
    for (let i = 0; i < tiers; i++) { const s = 0.72 - i * 0.15; b.box(V(c.x, 0.05 * i + 0.025, c.z), V(s, 0.05, s), yaw, i % 2 ? '#e6dccd' : STONE, 'stone'); }
    const top = 0.05 * tiers, a = V(c.x, top, c.z).add(rotY(V(0, 0, 0.14), yaw)), e = V(c.x, 0.012, c.z).add(rotY(V(0, 0, 0.62), yaw));
    const mid = V().addVectors(a, e).multiplyScalar(0.5), dir = V().subVectors(e, a), L = dir.length(); dir.normalize();
    const side = V().crossVectors(dir, Y_AX).normalize(), up = V().crossVectors(side, dir).normalize(), q = Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, dir));
    b.box(mid, V(0.12, 0.014, L), q, PRI[0], 'paint'); } }
  // a family of columns at different heights
  { const c = b.spot(0.3); if (c) { const n = 6; for (let i = 0; i < n; i++) { const a = i / n * TAU + R(0, 0.5), d = R(0.06, 0.2); b.cyl(V(c.x + Math.cos(a) * d, 0, c.z + Math.sin(a) * d), R(0.04, 0.065), R(0.06, 0.36), i % 2 ? pick(PRI) : '#f0b9c9', 'paint', { climb: true }); } } }
  const H = (x, z) => { let h = 0; for (const m of mounds) { const d2 = (x - m.x) ** 2 + (z - m.z) ** 2; h += m.h * Math.exp(-d2 / (m.s * m.s * 0.45)); } return h; };
  return {
    id: 'noguchi', seed, b, H, mounds,
    style: { bg: '#f3dfe6', fog: ['#f1dbe6', 6, 22], hemi: ['#fff3f6', '#b9a2df', 0.72], sun: ['#fff1dc', 0.6, V(0.5, 0.8, 0.35)],
      ground: { terrain: true, lo: '#f0b393', hi: '#9a7ddc' }, toyOutline: 0,
      fams: { paint: { t: 'standard', rough: 0.55 }, stone: { t: 'standard', rough: 0.95 } } },
    parts: [{ shape: 'ring', r: 0.034, cols: ['#e8402f', '#ffd21f', '#2e5bea', '#f0b9c9'] }, { shape: 'sph', r: 0.034, cols: ['#ffd21f', '#e8402f', '#7fd6c2'] }, { shape: 'cone', r: 0.033, cols: ['#ff9f43', '#cbb7ea'] }],
    spawns: groundSpots(b, 60, H),
  };
}

/* ================= 3. MEMPHIS PARK: flat pop with black outlines ================= */
function genMemphis(seed) {
  const b = Builder(seed), { R, pick } = b;
  const PAL = ['#ff3e8a', '#ffd400', '#00c2b3', '#2f5cff', '#9b5cff', '#ff7a1a', '#9ff0d0'];
  commonBits(b, '#15121a', 'zig');
  { const c = b.spot(0.2); if (c) musicBox(b, c, R(0, TAU), '#9b5cff', 'jukebox'); }
  { const c = b.spot(0.42); if (c) mgr(b, c, '#ff3e8a'); }
  { const c = b.spot(0.42); if (c) seesaw(b, c, R(0, TAU), '#00c2b3', 'plank'); }
  // lightning-bolt slide off a tower, stairs up the back
  { const c = b.spot(0.5); if (c) { const yaw = R(0, TAU), H = 0.36, T = V(c.x, 0, c.z);
    b.box(V(T.x, H / 2, T.z), V(0.18, H, 0.18), yaw, '#2f5cff', 'dots', { climb: true });
    const zig = [V(0, H, 0.09), V(0.22, H * 0.62, 0.22), V(-0.04, H * 0.3, 0.38), V(0.2, 0.012, 0.56)].map(p => T.clone().add(rotY(p, yaw)));
    for (let i = 0; i < 3; i++) { const a = zig[i], e = zig[i + 1], mid = V().addVectors(a, e).multiplyScalar(0.5), dir = V().subVectors(e, a), L = dir.length(); dir.normalize();
      const side = V().crossVectors(dir, Y_AX).normalize(), up = V().crossVectors(side, dir).normalize();
      b.box(mid, V(0.11, 0.016, L + 0.04), Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, dir)), '#ffd400', 'plain'); }
    for (let i = 0; i < 6; i++) { const h = (i + 1) * H / 6; b.box(T.clone().add(rotY(V(0, h / 2, -0.09 - 0.06 * (6 - i)), yaw)), V(0.14, h, 0.06), yaw, '#ff3e8a', 'plain'); } } }
  // squiggle walls
  for (let k = 0; k < 3; k++) { const c = b.spot(0.55); if (!c) continue; const yaw = R(0, TAU), L = R(0.9, 1.3), amp = R(0.1, 0.17), waves = R(1.2, 2), h = R(0.1, 0.2), n = 16, col = pick(PAL);
    const P = t => V(c.x, 0, c.z).add(rotY(V((t - 0.5) * L, 0, Math.sin(t * waves * TAU) * amp), yaw));
    for (let i = 0; i < n; i++) { const p0 = P(i / n), p1 = P((i + 1) / n), m = V().addVectors(p0, p1).multiplyScalar(0.5), d = V().subVectors(p1, p0);
      b.box(V(m.x, h / 2, m.z), V(d.length() + 0.03, h, 0.045), -Math.atan2(d.z, d.x), col, 'stripes', { climb: true }); } }
  // a striped arch to run through and over
  { const c = b.spot(0.36); if (c) { const yaw = R(0, TAU), Rr = 0.3, n = 12; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI, a1 = (i + 1) / n * Math.PI;
    b.bar(V(c.x, 0, c.z).add(rotY(V(Math.cos(a0) * Rr, Math.sin(a0) * Rr, 0), yaw)), V(c.x, 0, c.z).add(rotY(V(Math.cos(a1) * Rr, Math.sin(a1) * Rr, 0), yaw)), 0.028, i % 2 ? '#15121a' : '#fffdf7', 'plain'); } } }
  // pedestals with a ball, a cone or a drum on top
  for (let k = 0; k < 7; k++) { const c = b.spot(0.16); if (!c) continue; const s = R(0.12, 0.2), h = R(0.07, 0.3), col = pick(PAL), top = pick(['sph', 'cone', 'cyl']), tc = pick(PAL);
    b.box(V(c.x, h / 2, c.z), V(s, h, s), R(0, 1.5), col, k % 2 ? 'dots' : 'plain', { climb: true });
    if (top === 'sph') b.sph(V(c.x, h + 0.06, c.z), 0.065, tc, 'plain'); else if (top === 'cone') b.cone(V(c.x, h, c.z), 0.07, 0.15, tc, 'plain'); else b.cyl(V(c.x, h, c.z), 0.06, 0.06, tc, 'stripes'); }
  // terrazzo puddles on the checkerboard
  for (let k = 0; k < 7; k++) { const x = R(AREA.minX, AREA.maxX) / K, z = R(AREA.minZ, AREA.maxZ) / K; if (!AREA.inside(x * K, z * K, 0.3) || Math.hypot(x - BOX.c.x / K, z - BOX.c.z / K) < 0.8) continue; b.disc(V(x, 0, z), R(0.25, 0.55), 0.004, pick(['#fff3dc', '#ffd6e6', '#d6f5ff']), 'terrazzo'); }
  return {
    id: 'memphis', seed, b, H: null,
    style: { bg: '#ffe9a8', fog: ['#ffe9a8', 6, 22], hemi: ['#ffffff', '#ffffff', 1.0], sun: ['#ffffff', 0.6, V(-0.3, 1, 0.5)],
      ground: { tex: 'checker', col: '#ffffff' }, outline: 0.0045, toyOutline: 0.004,
      fams: { plain: 'toon', dots: { t: 'toon', tex: 'dots' }, stripes: { t: 'toon', tex: 'stripes' }, zig: { t: 'toon', tex: 'zig' }, terrazzo: { t: 'toon', tex: 'terrazzo', noOutline: true } } },
    parts: [{ shape: 'sph', r: 0.035, cols: ['#ff3e8a', '#00c2b3', '#ffd400'], tex: 'dots' }, { shape: 'box', r: 0.031, cols: ['#2f5cff', '#9b5cff', '#ff7a1a'] }, { shape: 'cone', r: 0.033, cols: ['#ffd400', '#ff3e8a'] }],
    spawns: groundSpots(b, 60),
  };
}

/* ================= 4. JUNK PLAYGROUND: wood, rubber, rust, rope ================= */
function genJunk(seed) {
  const b = Builder(seed), { R, pick } = b;
  const WOOD = ['#b98552', '#a0703f', '#c99a64', '#8e6239'], PAINT = ['#c8553d', '#3f7cac', '#e0b13a', '#5b8c5a'], RUB = '#2a2a2c';
  commonBits(b, '#8e6239', 'wood');
  { const c = b.spot(0.2); if (c) musicBox(b, c, R(0, TAU), '#c8553d', 'radio'); }
  // tire swing on an A-frame
  { const c = b.spot(0.42); if (c) { const yaw = R(0, TAU), H = 0.46, W = 0.3;
    for (const sx of [-1, 1]) { const top = V(c.x, H, c.z).add(rotY(V(sx * W, 0, 0), yaw));
      b.bar(V(c.x, 0, c.z).add(rotY(V(sx * W, 0, -0.16), yaw)), top, 0.012, '#7d5634', 'wood'); b.bar(V(c.x, 0, c.z).add(rotY(V(sx * W, 0, 0.16), yaw)), top, 0.012, '#7d5634', 'wood'); }
    b.bar(V(c.x, H, c.z).add(rotY(V(-W, 0, 0), yaw)), V(c.x, H, c.z).add(rotY(V(W, 0, 0), yaw)), 0.014, '#6e4f33', 'wood');
    swing(b, V(c.x, H, c.z), yaw, 0.34, RUB, 'tire'); } }
  { const c = b.spot(0.42); if (c) seesaw(b, c, R(0, TAU), '#c99a64', 'drum'); }
  // pallet forts: deck on posts, plank walls, a ramp and a ladder
  for (let k = 0; k < 2; k++) { const c = b.spot(0.5); if (!c) continue; const yaw = R(0, TAU), h = R(0.2, 0.3), W = 0.42, D = 0.34, T = V(c.x, 0, c.z), at = (x, y, z) => T.clone().add(rotY(V(x, y, z), yaw));
    b.box(at(0, h, 0), V(W, 0.022, D), yaw, pick(WOOD), 'wood');
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(at(x * (W / 2 - 0.02), h / 2, z * (D / 2 - 0.02)), V(0.03, h, 0.03), yaw, '#7d5634', 'wood', { climb: true });
    for (let i = 0; i < 5; i++) { b.box(at(-W / 2 + 0.04 + i * (W - 0.08) / 4, h + 0.07, -D / 2 + 0.01), V(0.05, 0.14, 0.015), yaw, i === 2 ? pick(PAINT) : pick(WOOD), 'wood', { climb: true }); }
    // ramp
    const a = at(W / 2 - 0.02, h, 0.05), e = at(W / 2 + 0.42, 0.01, 0.05), mid = V().addVectors(a, e).multiplyScalar(0.5), dir = V().subVectors(e, a), L = dir.length(); dir.normalize();
    const side = V().crossVectors(dir, Y_AX).normalize(), up = V().crossVectors(side, dir).normalize();
    b.box(mid, V(0.12, 0.018, L), Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, dir)), pick(PAINT), 'paintwood');
    // ladder
    const l1 = at(-W / 2 - 0.02, 0, -0.06), l2 = at(-W / 2 - 0.02, 0, 0.06);
    b.bar(l1, V(l1.x, h + 0.05, l1.z), 0.008, '#7d5634', 'wood'); b.bar(l2, V(l2.x, h + 0.05, l2.z), 0.008, '#7d5634', 'wood');
    for (let y = 0.05; y < h; y += 0.055) b.bar(V(l1.x, y, l1.z), V(l2.x, y, l2.z), 0.007, '#9c7548', 'wood');
  }
  // treehouse round a big trunk
  { const c = b.spot(0.4); if (c) { const h = 0.34; b.cyl(V(c.x, 0, c.z), 0.055, 0.95, '#6e4f33', 'bark', { climb: true });
    b.box(V(c.x + 0.12, h, c.z), V(0.3, 0.02, 0.36), 0, pick(WOOD), 'wood'); b.box(V(c.x - 0.12, h + 0.02, c.z), V(0.18, 0.02, 0.3), 0, pick(WOOD), 'wood');
    for (const z of [-0.16, 0.16]) b.box(V(c.x + 0.24, h / 2, c.z + z), V(0.025, h, 0.025), 0, '#7d5634', 'wood', { climb: true });
    b.sph(V(c.x, 0.98, c.z), 0.3, '#6f9a4a', 'leaves', { sy: 0.8 }); b.sph(V(c.x + 0.2, 0.85, c.z + 0.1), 0.2, '#5d8a3e', 'leaves');
    // rope net from the deck down to the ground
    const top = V(c.x + 0.27, h, c.z), bot = V(c.x + 0.55, 0.0, c.z), mid = V().addVectors(top, bot).multiplyScalar(0.5), dir = V().subVectors(bot, top), L = dir.length(); dir.normalize();
    const side = V(0, 0, 1), up = V().crossVectors(side, dir).normalize();
    b.cols.push(cBox(mid, V(0.008, L / 2, 0.16), Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(up, dir, side)), { climb: true }));
    for (let i = 0; i <= 6; i++) { const t = i / 6; const p = top.clone().lerp(bot, t); b.bar(V(p.x, p.y, p.z - 0.16), V(p.x, p.y, p.z + 0.16), 0.004, '#d9c49a', 'rope', { noCol: true }); }
    for (let j = 0; j <= 6; j++) { const z = -0.16 + j * 0.32 / 6; b.bar(V(top.x, top.y, top.z + z), V(bot.x, bot.y, bot.z + z), 0.004, '#d9c49a', 'rope', { noCol: true }); } } }
  // tire stacks and a tire wall
  for (let k = 0; k < 4; k++) { const c = b.spot(0.12); if (!c) continue; const n = 1 + Math.floor(R(1, 4));
    for (let i = 0; i < n; i++) { const y = 0.025 + i * 0.05; b.add('rubber', { g: 'tor', p: V(c.x, y, c.z), q: Q().setFromAxisAngle(X_AX, Math.PI / 2), s: V(0.062, 0.062, 0.07), col: RUB });
      b.cols.push(cCyl(V(c.x, y, c.z), 0.085, 0.025)); } }
  // oil drums, some standing, some lying
  for (let k = 0; k < 6; k++) { const c = b.spot(0.09); if (!c) continue; const col = pick(PAINT);
    if (rng() < 0.6) b.cyl(V(c.x, 0, c.z), 0.05, 0.135, col, 'rust');
    else { const yaw = R(0, TAU), q = qYaw(yaw).multiply(Q().setFromAxisAngle(Z_AX, Math.PI / 2)); b.add('rust', { g: 'cyl', p: V(c.x, 0.05, c.z), q, s: V(0.05, 0.135, 0.05), col, uv: 2 }); b.cols.push(cBox(V(c.x, 0.05, c.z), V(0.0675, 0.045, 0.045), qYaw(yaw))); } }
  function rng() { return b.rng(); }
  { const c = b.spot(0.4); if (c) { const yaw = R(0, TAU); for (let i = 0; i < 4; i++) { const p = V(c.x, 0.045, c.z).add(rotY(V((i - 1.5) * 0.15, 0, 0), yaw));
    b.add('rubber', { g: 'tor', p, q: qYaw(yaw), s: V(0.065, 0.065, 0.08), col: i % 2 ? RUB : pick(PAINT) }); b.cols.push(cBox(p, V(0.085, 0.07, 0.03), qYaw(yaw))); } } }
  // cable spool tables
  for (let k = 0; k < 2; k++) { const c = b.spot(0.18); if (!c) continue; b.cyl(V(c.x, 0, c.z), 0.16, 0.022, '#b98552', 'wood'); b.cyl(V(c.x, 0.022, c.z), 0.07, 0.15, '#a0703f', 'wood'); b.cyl(V(c.x, 0.172, c.z), 0.16, 0.022, '#c99a64', 'wood'); }
  // loose planks lying around and leaning
  for (let k = 0; k < 5; k++) { const c = b.spot(0.16); if (!c) continue; b.box(V(c.x, 0.01, c.z), V(0.3, 0.018, 0.07), R(0, TAU), pick(WOOD), 'wood'); }
  return {
    id: 'junk', seed, b, H: null,
    style: { bg: '#efe2c8', fog: ['#efe2c8', 6, 22], hemi: ['#fff3dc', '#8c7457', 0.85], sun: ['#ffd9a0', 0.75, V(-0.7, 0.8, 0.4)], dust: true,
      ground: { tex: 'dirt', col: '#ffffff' }, toyOutline: 0.003,
      fams: { wood: { t: 'lambert', tex: 'wood' }, paintwood: { t: 'lambert', tex: 'wood' }, bark: { t: 'lambert', tex: 'bark' }, leaves: { t: 'lambert', tex: 'leaves' }, rubber: { t: 'lambert', tex: 'rubber' }, rust: { t: 'lambert', tex: 'rust' }, rope: 'lambert' } },
    parts: [{ shape: 'can', r: 0.03, cols: ['#c0c4c8', '#c8553d', '#3f7cac'] }, { shape: 'tire', r: 0.034, cols: ['#2a2a2c'] }, { shape: 'box', r: 0.03, cols: ['#b98552', '#c99a64', '#8e6239'], tex: 'wood' }],
    spawns: groundSpots(b, 60),
  };
}

const GEN = { bedroom: genBedroom, vaneyck: genVanEyck, noguchi: genNoguchi, memphis: genMemphis, junk: genJunk };
function scaleBuilder(L) {
  const k = K, b = L.b;
  for (const c of b.cols) { c.c.multiplyScalar(k); c.br *= k; if (c.k === 0) c.h.multiplyScalar(k); else { c.r *= k; if (c.k === 1) c.hh *= k; } }
  for (const f in b.vis) for (const it of b.vis[f]) { it.p.multiplyScalar(k); it.s.multiplyScalar(k); }
  for (const d of b.devices) { for (const key of ['c', 'pivot', 'crank']) if (d[key]) d[key].multiplyScalar(k); for (const key of ['len', 'w', 'th', 'r', 'h']) if (d[key]) d[key] *= k; }
  for (const p of L.spawns) p.multiplyScalar(k);
  L.parts = L.parts.map(p => Object.assign({}, p, { r: p.r * k }));
  if (L.H) { const H = L.H; L.H = (x, z) => H(x / k, z / k) * k; }
}
// one call, same answer everywhere: the room and playset for (level, seed, area)
function makeLevel(id, seed, area) {
  area = setupArea(area || JSON.parse(JSON.stringify(DEFAULT_AREA)));
  const room = genRoom(id, seed);
  PRE_CLAIMS = room.claims.map(c => ({ x: c.x / K, z: c.z / K, r: c.r / K }));
  PRE_CLAIMS.push({ x: BOX.c.x / K, z: BOX.c.z / K, r: (BOX.w / 2 + 0.35) / K });
  const L = GEN[id](seed);
  scaleBuilder(L);
  L.area = area; L.room = room;
  // things the toys can knock over: stacked blocks (towers) and books on the furniture
  L.nParts = L.parts.length; L.tidyBlock = L.parts.length; L.parts.push({ shape: 'box', r: 0.032 * K, cols: ['#e23b2e', '#2f5cff', '#ffd400', '#3fbf6f', '#ff7a1a', '#9b5cff'] });
  L.tidyBook = L.parts.length; L.parts.push({ shape: 'book', r: 0.05, cols: ['#e23b2e', '#2f5cff', '#3fbf6f', '#ffd400', '#9b5cff', '#ff7a1a'] });
  L.groundH = L.H || (() => 0);
  // the chest: four walls and a floor
  const { w, d, h, t } = BOX, bw = (x, z, hx, hz) => cBox(V(x, h / 2, z).applyQuaternion(BOX.q).add(V(BOX.c.x, 0, BOX.c.z)).setY(h / 2), V(hx, h / 2, hz), BOX.q.clone());
  const boxCols = [bw(0, -d / 2 + t / 2, w / 2, t / 2), bw(0, d / 2 - t / 2, w / 2, t / 2), bw(-w / 2 + t / 2, 0, t / 2, d / 2), bw(w / 2 - t / 2, 0, t / 2, d / 2)];
  for (const c of boxCols) c.c.y = h / 2;
  L.cols = L.b.cols.concat(room.cols, boxCols); L.vis = L.b.vis; L.devices = L.b.devices;
  L.devices.forEach((d, i) => d.i = i);
  L.grid = makeGrid(L.cols, 0.6);
  L.name = LEVELS.find(l => l.id === id).name;
  return L;
}
