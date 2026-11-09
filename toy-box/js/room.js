/* ================= Toy Box: the living room =================
   Walls stand on the edges of the area the toddler traced, so the room ends where the real clear space ends.
   One wall gets the nap-time clock, one gets the door mom comes through, one gets a window.
   Furniture lines the walls; the playset (levels.js) fills the middle. Real-life sizes, in metres. */
const THEMES = {
  bedroom: { wall: '#ffffff', wallTex: 'clouds', floorTex: 'boards', floorCol: '#e6b27a', rug: 'roadrug', rugCol: '#ffffff', trim: '#ffffff', ceil: '#ffffff',
    sofa: '#2f5cff', cushion: '#e23b2e', wood: '#d79a5c', acc: ['#e23b2e', '#2f5cff', '#ffd400', '#3fbf6f', '#ff7a1a'], lamp: 'cone', door: '#c98a4b', light: ['#ffffff', '#e8d2b0', 0.95, 0.6] },
  vaneyck: { wall: '#f7f5ef', wallTex: 'sketch', floorTex: 'boards', floorCol: '#ead7b8', rug: 'paving', rugCol: '#ffffff', trim: '#ffffff', ceil: '#fbfaf6',
    sofa: '#d4cfc4', cushion: '#e23b2e', wood: '#d8b98e', acc: ['#e23b2e', '#2f5cff', '#ffd400'], lamp: 'cone', door: '#e23b2e', edges: true, light: ['#ffffff', '#d9d3c7', 0.85, 0.55] },
  noguchi: { wall: '#f6ede0', wallTex: 'washi', floorTex: 'boards', floorCol: '#e6c79c', rug: null, trim: '#e3d5c0', ceil: '#fff8ef',
    sofa: '#cbb7ea', cushion: '#f6b48f', wood: '#c08f5c', acc: ['#e8402f', '#ffd21f', '#2e5bea'], lamp: 'akari', door: '#2e5bea', light: ['#fff3f6', '#c9b5e6', 0.75, 0.6] },
  memphis: { wall: '#ffb8d3', wallTex: 'squiggle', floorTex: 'checker', floorCol: '#ffffff', rug: 'terrazzo', rugCol: '#ffffff', trim: '#15121a', ceil: '#fff3dc',
    sofa: '#00c2b3', cushion: '#ffd400', wood: '#2f5cff', acc: ['#ff3e8a', '#ffd400', '#00c2b3', '#2f5cff', '#9b5cff', '#ff7a1a'], lamp: 'cone', door: '#ffd400', outline: true, light: ['#ffffff', '#ffffff', 0.9, 0.6] },
  junk: { wall: '#b07c48', wallTex: 'panel', floorTex: 'boards', floorCol: '#a77c4c', rug: 'braid', rugCol: '#ffffff', trim: '#6e4f33', ceil: '#efe2c8',
    sofa: '#8a5a3a', cushion: '#c8553d', wood: '#7d5634', acc: ['#c8553d', '#3f7cac', '#e0b13a', '#5b8c5a'], lamp: 'cone', door: '#3f7cac', light: ['#fff0d6', '#8c7457', 0.8, 0.7] },
};
function genRoom(id, seed) {
  const T = THEMES[id], rng = mulberry(seed ^ 0x9e3779b9), R = (a, b) => a + rng() * (b - a), pick = a => a[Math.floor(rng() * a.length)];
  const r = { theme: T, cols: [], vis: {}, claims: [], clock: null, door: null, win: null, pics: [], lamps: [], screens: [], tidy: [], food: [], cups: [], devices: [] };   // tidy: spots for books the toys can knock off
  const add = (fam, it) => { (r.vis[fam] || (r.vis[fam] = [])).push(it); };
  const yawOf = e => Math.atan2(e.nx, e.nz);
  const at = (e, s, y, u) => V(e.a.x + e.dx * s + e.nx * u, y, e.a.z + e.dz * s + e.nz * u);
  // a box in an edge's frame: s along the wall, y up, u in from the wall; size = (along, up, in)
  const ebox = (fam, e, s, y, u, sx, sy, sz, col, o = {}) => { const c = at(e, s, y, u), q = qYaw(yawOf(e)); add(fam, { g: o.g || 'box', p: c, q, s: V(sx, sy, sz), col, uv: o.uv || Math.max(sx, sy) * 2, uvx: o.uvx });
    if (!o.noCol) r.cols.push(cBox(c.clone(), V(sx / 2, sy / 2, sz / 2), q.clone(), { climb: o.climb !== false })); return c; };
  const ecyl = (fam, e, s, y, u, rad, h, col, o = {}) => { const c = at(e, s, y + h / 2, u); add(fam, { g: 'cyl', p: c, q: Q(), s: V(rad, h, rad), col }); if (!o.noCol) r.cols.push(cCyl(c.clone(), rad, h / 2, { climb: true })); return c; };
  const E = AREA.edges;
  const boxE = E.reduce((m, e) => segDist(e, BOX.c.x, BOX.c.z) < segDist(m, BOX.c.x, BOX.c.z) ? e : m, E[0]);
  const occ = E.map(e => [[-1, 0], [e.len, e.len + 1]]), wallOcc = E.map(e => [[-1, 0.2], [e.len - 0.2, e.len + 1]]);
  { const o = {}; segDist(boxE, BOX.c.x, BOX.c.z, o); occ[boxE.i].push([o.t - BOX.w / 2 - 0.04, o.t + BOX.w / 2 + 0.04]); }
  const free = (L, i, len) => { const xs = L[i].slice().sort((a, b) => a[0] - b[0]); const gaps = []; for (let k = 0; k < xs.length - 1; k++) { const s0 = Math.max(...xs.slice(0, k + 1).map(x => x[1])), s1 = xs[k + 1][0]; if (s1 - s0 >= len) gaps.push([s0, s1]); } return gaps; };
  const take = (L, i, len, prefer) => { const g = free(L, i, len); if (!g.length) return null; const G = prefer === 'mid' ? g.reduce((m, x) => (x[1] - x[0] > m[1] - m[0] ? x : m)) : pick(g);
    let s = prefer === 'mid' ? (G[0] + G[1]) / 2 : lerp(G[0] + len / 2, G[1] - len / 2, rng());
    if (prefer !== 'mid') { if (s - len / 2 - G[0] < 0.45) s = G[0] + len / 2; else if (G[1] - s - len / 2 < 0.45) s = G[1] - len / 2; }
    L[i].push([s - len / 2, s + len / 2]); return s; };
  const others = E.filter(e => e !== boxE).sort((a, b) => b.len - a.len);
  // the door: on a long wall that isn't the toy chest's
  const doorE = others.find(e => e.len >= 1.5) || (boxE.len >= 2.4 ? boxE : others[0]);
  const sd = take(occ, doorE.i, 1.1, 'mid');
  if (sd !== null) { r.door = { e: doorE.i, s: sd, w: 0.9, h: 2.05, hinge: at(doorE, sd - 0.45, 0, 0), yaw: yawOf(doorE), mom: at(doorE, sd, 0, 0.25), out: V(-doorE.nx, 0, -doorE.nz), dir: V(doorE.dx, 0, doorE.dz) }; wallOcc[doorE.i].push([sd - 0.6, sd + 0.6]); }
  // the clock: the wall facing the chest, so you see it when you turn round to the room
  const far = others.slice().sort((a, b) => Math.hypot(b.mx - BOX.c.x, b.mz - BOX.c.z) - Math.hypot(a.mx - BOX.c.x, a.mz - BOX.c.z));
  const clockE = far.find(e => e.len >= 0.9 && free(wallOcc, e.i, 0.7).length) || boxE;
  { const s = take(wallOcc, clockE.i, 0.7, 'mid'); r.clock = { p: at(clockE, s === null ? clockE.len / 2 : s, 1.62, 0.04), yaw: yawOf(clockE), R: 0.3 }; }
  // a window
  const winE = others.find(e => e !== doorE && e !== clockE && free(wallOcc, e.i, 1.2).length) || others.find(e => free(wallOcc, e.i, 1.2).length);
  if (winE) { const s = take(wallOcc, winE.i, 1.2, 'mid'); r.win = { p: at(winE, s, 1.45, 0.012), yaw: yawOf(winE), w: 1.05, h: 0.95 };
    ebox('r_trim', winE, s, 1.45 - 0.5, 0.05, 1.2, 0.05, 0.1, T.trim, { noCol: true });
    for (const k of [-1, 1]) ebox('r_fab', winE, s + k * 0.66, 1.45, 0.06, 0.2, 1.3, 0.05, T.cushion, { noCol: true }); }
  // pictures
  for (let k = 0; k < 3; k++) { const e = pick(E); const s = take(wallOcc, e.i, 0.6); if (s === null) continue; const w = R(0.38, 0.55), h = R(0.3, 0.5); r.pics.push({ p: at(e, s, R(1.3, 1.6), 0.015), yaw: yawOf(e), w, h, seed: (rng() * 1e6) | 0 });
    ebox('r_paint', e, s, 0, 0.008, w + 0.05, h + 0.05, 0.012, T.trim === '#ffffff' ? '#15121a' : T.trim, { noCol: true }); r.vis.r_paint[r.vis.r_paint.length - 1].p.y = r.pics[r.pics.length - 1].p.y; }
  // walls, with a gap for the door
  const TH = 0.12;
  for (const e of E) {
    const cuts = r.door && r.door.e === e.i ? [[-TH, r.door.s - 0.47], [r.door.s + 0.47, e.len + TH]] : [[-TH, e.len + TH]];
    for (const [s0, s1] of cuts) { const L = s1 - s0; ebox('r_wall', e, (s0 + s1) / 2, WALL_H / 2, -TH / 2, L, WALL_H, TH, T.wall, { uv: WALL_H / 1.25, uvx: L / WALL_H, climb: false });
      const b0 = Math.max(s0, 0), b1 = Math.min(s1, e.len); if (b1 > b0) ebox('r_trim', e, (b0 + b1) / 2, 0.05, 0.008, b1 - b0, 0.1, 0.016, T.trim, { noCol: true }); }
    if (r.door && r.door.e === e.i) { ebox('r_wall', e, r.door.s, (WALL_H + 2.05) / 2, -TH / 2, 0.96, WALL_H - 2.05, TH, T.wall, { climb: false });
      for (const k of [-1, 1]) ebox('r_trim', e, r.door.s + k * 0.475, 1.03, 0.005, 0.05, 2.06, 0.03, T.trim, { noCol: true }); ebox('r_trim', e, r.door.s, 2.07, 0.005, 1.0, 0.05, 0.03, T.trim, { noCol: true }); }
  }
  // furniture along the walls
  const claimAlong = (e, s, len, depth) => { const n = Math.max(1, Math.ceil(len / depth)); for (let i = 0; i < n; i++) { const ss = s - len / 2 + (i + 0.5) * len / n, c = at(e, ss, 0, depth / 2); r.claims.push({ x: c.x, z: c.z, r: depth * 0.5 + 0.06 }); } };
  const place = (len, depth, fn) => { const es = E.slice().sort(() => rng() - 0.5); for (const e of es) { const s = take(occ, e.i, len + 0.08); if (s !== null) { claimAlong(e, s, len, depth); fn(e, s);
    const n = E.length, pv = E[(e.i + n - 1) % n], nx = E[(e.i + 1) % n];
    if (s - len / 2 < 1.05) occ[pv.i].push([pv.len - depth - 0.08, pv.len + 1]); if (s + len / 2 > e.len - 1.05) occ[nx.i].push([-1, depth + 0.08]); return true; } } return false; };
  const sofa = (e, s, L) => { const D = 0.66;
    ebox('r_fab', e, s, 0.2, D / 2, L, 0.4, D, T.sofa, { climb: true }); ebox('r_fab', e, s, 0.62, 0.1, L, 0.44, 0.2, T.sofa);
    for (const k of [-1, 1]) ebox('r_fab', e, s + k * (L / 2 - 0.08), 0.52, D / 2, 0.16, 0.24, D, T.sofa);
    const n = Math.max(2, Math.round(L / 0.6)); for (let i = 0; i < n; i++) ebox('r_fab', e, s - L / 2 + 0.2 + (i + 0.5) * (L - 0.4) / n, 0.45, D / 2 + 0.03, (L - 0.4) / n - 0.03, 0.1, D - 0.18, i % 2 ? T.cushion : T.sofa, { noCol: true });
    ebox('r_fab', e, s - L / 4, 0.62, 0.25, 0.36, 0.3, 0.12, T.cushion, { noCol: true });
    for (const k of [-1, 1]) ecyl('r_wood', e, s + k * (L / 2 - 0.1), 0, D - 0.1, 0.025, 0.06, T.wood, { noCol: true }); };
  const shelf = (e, s) => { const L = 0.82, D = 0.3, H = 1.35; books(e, s, 0.7, H - 0.02 + 0.015, D / 2); books(e, s, 0.7, 0.035, D / 2 + 0.02); books(e, s, 0.7, 0.02 + (H - 0.04) / 3 + 0.015, D / 2 + 0.02);
    for (const k of [-1, 1]) ebox('r_wood', e, s + k * (L / 2 - 0.015), H / 2, D / 2, 0.03, H, D, T.wood);
    for (let i = 0; i < 4; i++) { const y = 0.02 + i * (H - 0.04) / 3; ebox('r_wood', e, s, y, D / 2, L, 0.03, D, T.wood);
      if (i === 2) { let x = -L / 2 + 0.05; while (x < L / 2 - 0.08) { const w = R(0.03, 0.06), h = R(0.18, 0.3); ebox('r_paint', e, s + x + w / 2, y + 0.015 + h / 2, D / 2, w, h, D * 0.8, pick(T.acc.concat(['#fffdf7', '#15121a'])), { noCol: true }); x += w + 0.005; if (rng() < 0.12) x += 0.1; } } } };
  const books = (e, s, len, y, u) => { const n = Math.floor(len / 0.1); for (let i = 0; i < n; i++) r.tidy.push({ p: at(e, s - len / 2 + (i + 0.5) * len / n, y, u), yaw: yawOf(e) }); };
  const cubby = (e, s) => { const L = 0.95, D = 0.32, H = 0.62; books(e, s, 0.8, H + 0.0125, D / 2);
    for (let i = 0; i <= 3; i++) ebox('r_wood', e, s - L / 2 + i * L / 3, H / 2, D / 2, 0.025, H, D, T.wood);
    for (const y of [0.01, H / 2, H]) ebox('r_wood', e, s, y, D / 2, L, 0.025, D, T.wood);
    ebox('r_wood', e, s, H / 2, 0.01, L, H, 0.02, T.wood, { noCol: true });
    for (let i = 0; i < 3; i++) if (rng() < 0.6) ebox('r_fab', e, s - L / 3 + i * L / 3, H / 4 + 0.01, D / 2 + 0.02, L / 3 - 0.06, H / 2 - 0.04, D - 0.08, pick(T.acc)); };
  const plant = (e, s) => { const c = ecyl('r_paint', e, s, 0, 0.2, 0.14, 0.3, pick(T.acc)); for (let i = 0; i < 6; i++) add('r_leaf', { g: 'sphLo', p: V(c.x + R(-0.12, 0.12), 0.45 + R(0, 0.45), c.z + R(-0.12, 0.12)), q: Q(), s: V(R(0.1, 0.17), R(0.14, 0.24), R(0.1, 0.17)), col: pick(['#5d9a4a', '#4f8a3e', '#79b55a']) }); };
  const lamp = (e, s) => { const c = ecyl('r_paint', e, s, 0, 0.2, 0.14, 0.03, '#15121a', { noCol: true }); ecyl('r_paint', e, s, 0, 0.2, 0.012, 1.45, '#15121a');
    if (T.lamp === 'akari') { add('r_glow', { g: 'sph', p: V(c.x, 1.55, c.z), q: Q(), s: V(0.2, 0.3, 0.2), col: '#fff6dd' }); for (let i = 0; i < 6; i++) add('r_paint', { g: 'ring', p: V(c.x, 1.32 + i * 0.09, c.z), q: qx(Math.PI / 2), s: V(0.2 * Math.sin(0.35 + i * 0.47) + 0.02, 0.2 * Math.sin(0.35 + i * 0.47) + 0.02, 0.2), col: '#e9dcc6' }); }
    else add('r_glow', { g: 'cone', p: V(c.x, 1.5, c.z), q: Q(), s: V(0.2, 0.25, 0.2), col: pick(T.acc) });
    r.lamps.push(V(c.x, 1.5, c.z)); r.devices.push({ type: 'lamp', c: V(c.x, 0, c.z), yaw: yawOf(e), shade: V(c.x, 1.5, c.z), sw: at(e, s + 0.12, 0, 0.48) }); };
  const tv = (e, s) => { ebox('r_wood', e, s, 0.22, 0.2, 1.1, 0.44, 0.4, T.wood); books(e, s + 0.3, 0.4, 0.44, 0.3); ebox('r_paint', e, s, 0.75, 0.12, 0.92, 0.56, 0.06, '#15121a', { noCol: true });
    r.screens.push({ p: at(e, s, 0.75, 0.155), yaw: yawOf(e), w: 0.84, h: 0.48 }); };
  const crates = (e, s) => { for (let i = 0; i < 3; i++) ebox('r_wood', e, s + (i - 1) * 0.36, 0.17 + (i === 1 ? 0.34 : 0), 0.2, 0.34, 0.34, 0.36, T.wood); ebox('r_wood', e, s + 0.36, 0.17, 0.2, 0.34, 0.34, 0.36, T.wood); };
  const radiator = (e, s) => { for (let i = 0; i < 8; i++) ebox('r_paint', e, s - 0.3 + i * 0.085, 0.35, 0.07, 0.05, 0.55, 0.1, '#e9e4da'); };
  const table = (e, s) => { ebox('r_wood', e, s, 0.32, 0.35, 0.9, 0.04, 0.55, T.wood); for (const k of [-1, 1]) ebox('r_wood', e, s + k * 0.38, 0.15, 0.35, 0.05, 0.3, 0.45, T.wood); };
  // a kid's bed with a skirt to the floor (nothing gets lost under it)
  const bed = (e, s, L) => { const D = 0.95;
    ebox('r_fab', e, s, 0.13, D / 2, L - 0.02, 0.26, D - 0.02, T.cushion, { climb: true });
    ebox('r_wood', e, s, 0.3, D / 2, L, 0.1, D, T.wood); ebox('r_fab', e, s, 0.43, D / 2, L - 0.04, 0.16, D - 0.04, '#fffdf7');
    ebox('r_fab', e, s + L * 0.15, 0.53, D / 2, L * 0.68, 0.05, D + 0.02, T.sofa); ebox('r_fab', e, s - L / 2 + 0.24, 0.55, D / 2, 0.36, 0.1, D * 0.6, '#ffffff');
    ebox('r_wood', e, s - L / 2 - 0.02, 0.45, D / 2, 0.05, 0.9, D, T.wood); ebox('r_wood', e, s + L / 2 + 0.02, 0.35, D / 2, 0.05, 0.7, D, T.wood);
    for (let i = 0; i < 5; i++) ebox('r_paint', e, s + L * 0.15 - L * 0.3 + i * L * 0.15, 0.556, D / 2, 0.06, 0.004, D + 0.03, i % 2 ? '#ffd400' : T.cushion, { noCol: true }); };
  const desk = (e, s) => { ebox('r_wood', e, s, 0.68, 0.3, 1.0, 0.04, 0.55, T.wood); books(e, s + 0.15, 0.5, 0.7, 0.3); r.cups.push({ p: at(e, s - 0.1, 0.7, 0.32) });
    ebox('r_wood', e, s, 0.33, 0.27, 0.98, 0.66, 0.5, T.wood); for (const y of [0.12, 0.33, 0.54]) for (const x of [-0.25, 0.25]) { ebox('r_paint', e, s + x, y, 0.525, 0.44, 0.17, 0.012, T.acc[(x > 0 ? 1 : 0) + (y > 0.3 ? 2 : 0)] || T.acc[0], { noCol: true }); ecyl('r_paint', e, s + x, y - 0.01, 0.54, 0.018, 0.02, '#15121a', { noCol: true }); }
    ebox('r_paint', e, s + 0.1, 0.42, 0.62, 0.38, 0.04, 0.36, T.acc[0]); ebox('r_paint', e, s + 0.1, 0.62, 0.8, 0.38, 0.4, 0.04, T.acc[0]); for (const [x, u] of [[-0.15, 0.48], [0.35, 0.48], [-0.15, 0.76], [0.35, 0.76]]) ecyl('r_paint', e, s + x, 0, u, 0.015, 0.4, '#15121a', { noCol: true });
    add('r_glow', { g: 'cone', p: at(e, s - 0.35, 0.82, 0.2), q: Q(), s: V(0.08, 0.1, 0.08), col: T.acc[2] }); ecyl('r_paint', e, s - 0.35, 0.7, 0.2, 0.01, 0.12, '#15121a', { noCol: true }); };
  const snack = (e, s) => { const L = 0.9, D = 0.5, H = 0.38, u = 0.32;
    ebox('r_wood', e, s, H, u, L, 0.03, D, '#fffdf7'); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ecyl('r_paint', e, s + x * (L / 2 - 0.05), 0, u + z * (D / 2 - 0.05), 0.02, H - 0.015, T.acc[1], { noCol: true });
    for (const x of [-1, 1]) { ecyl('r_paint', e, s + x * (L / 2 + 0.17), 0, u, 0.11, 0.2, T.acc[x < 0 ? 0 : 3]); }
    for (let i = 0; i < 6; i++) r.food.push({ p: at(e, s - 0.3 + (i % 3) * 0.3, H + 0.015, u + (i < 3 ? -0.12 : 0.12)) });
    r.cups.push({ p: at(e, s, H + 0.015, u) }); };
  const record = (e, s) => { ebox('r_wood', e, s, 0.07, 0.2, 0.44, 0.14, 0.34, T.wood); r.devices.push({ type: 'record', c: at(e, s, 0, 0.2), yaw: yawOf(e) }); };
  const longest = E.reduce((m, e) => e.len > m.len ? e : m, E[0]);
  if (id === 'bedroom') { place(1.5, 0.6, snack); place(0.5, 0.4, record); const L = clamp(longest.len * 0.5, 1.4, 1.9); place(L, 0.95, (e, s) => bed(e, s, L)); place(1.0, 0.85, desk); }
  else { const L = clamp(longest.len * 0.45, 1.1, 1.9); place(L, 0.66, (e, s) => sofa(e, s, L)); }
  place(0.82, 0.3, shelf); place(0.95, 0.32, cubby); place(0.3, 0.3, plant); place(0.3, 0.3, lamp);
  if (id === 'vaneyck' || id === 'memphis') place(1.1, 0.4, tv);
  if (id === 'noguchi') { place(0.9, 0.55, table); place(0.3, 0.3, plant); place(0.3, 0.3, lamp); }
  if (id === 'junk') { place(1.1, 0.36, crates); place(0.7, 0.14, radiator); }
  // the rug, centred in the room
  const w = clamp((AREA.maxX - AREA.minX) * 0.62, 1, 3.4), d = clamp((AREA.maxZ - AREA.minZ) * 0.62, 1, 3.4);
  r.rug = T.rug ? { c: V(AREA.cx, 0, AREA.cz), w, d, tex: T.rug } : null;
  r.fams = { r_wall: { t: T.outline ? 'toon' : 'lambert', tex: T.wallTex }, r_trim: T.outline ? 'toon' : 'lambert', r_wood: { t: T.outline ? 'toon' : 'lambert', tex: 'wood' }, r_fab: { t: T.outline ? 'toon' : 'lambert', tex: 'fabric' },
    r_paint: T.outline ? 'toon' : 'lambert', r_leaf: 'lambert', r_glow: 'basic' };
  return r;
}
