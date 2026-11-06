/* ================= Toy Box: drawing =================
   Builds the playground meshes in the level's own style, the toys, the toddler, the moving devices,
   and draws a snapshot (or a blend of two). Also little particles, sounds for events, and the VR overlays. */

const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  const T = {
    paving: () => canvasTex(256, (x, s) => { x.fillStyle = '#f2f0ea'; x.fillRect(0, 0, s, s); x.strokeStyle = '#d2cec4'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * s / 4, 0); x.lineTo(i * s / 4, s); x.moveTo(0, i * s / 4); x.lineTo(s, i * s / 4); x.stroke(); } noiseFill(x, s, 0.96, 1.02); }),
    sand: () => canvasTex(128, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); noiseFill(x, s, 0.86, 1.05, 0.95); }),
    checker: () => canvasTex(256, (x, s) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#15121a' : '#fffdf7'; x.fillRect(i * s / 2, j * s / 2, s / 2, s / 2); } }),
    dots: () => canvasTex(128, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); x.fillStyle = '#15121a'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * 32 + 16 + (j % 2) * 16, j * 32 + 16, 5, 0, TAU); x.fill(); } }),
    stripes: () => canvasTex(128, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); x.fillStyle = '#15121a'; for (let i = 0; i < 8; i += 2) x.fillRect(i * 16, 0, 16, s); x.globalAlpha = 0.25; x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); }),
    zig: () => canvasTex(128, (x, s) => { x.fillStyle = '#ffd400'; x.fillRect(0, 0, s, s); x.strokeStyle = '#15121a'; x.lineWidth = 10; x.beginPath(); for (let i = 0; i <= 8; i++) x.lineTo(i * 16, i % 2 ? 40 : 88); x.stroke(); }),
    terrazzo: () => canvasTex(256, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); const C = ['#ff3e8a', '#2f5cff', '#00c2b3', '#15121a', '#ffd400']; for (let i = 0; i < 70; i++) { x.fillStyle = C[i % 5]; x.beginPath(); const px = Math.random() * s, py = Math.random() * s, r = 2 + Math.random() * 7; x.moveTo(px + r, py); for (let k = 1; k < 5; k++) x.lineTo(px + Math.cos(k * 1.3) * r * (0.6 + Math.random() * 0.6), py + Math.sin(k * 1.3) * r); x.fill(); } }),
    dirt: () => canvasTex(512, (x, s) => { x.fillStyle = '#b89a72'; x.fillRect(0, 0, s, s); for (let i = 0; i < 60; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(120,150,70,.35)' : 'rgba(90,70,45,.25)'; x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, 10 + Math.random() * 40, 6 + Math.random() * 20, Math.random() * 3, 0, TAU); x.fill(); } noiseFill(x, s, 0.8, 1.08); }),
    wood: () => canvasTex(256, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(80,45,20,.28)'; for (let i = 0; i < 40; i++) { x.lineWidth = 1 + Math.random() * 2; x.beginPath(); const y = Math.random() * s; x.moveTo(0, y); x.bezierCurveTo(s * 0.3, y + Math.random() * 10 - 5, s * 0.6, y + Math.random() * 10 - 5, s, y); x.stroke(); } noiseFill(x, s, 0.88, 1.04); }),
    bark: () => canvasTex(128, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(40,25,10,.4)'; x.lineWidth = 3; for (let i = 0; i < 18; i++) { x.beginPath(); const px = Math.random() * s; x.moveTo(px, 0); x.lineTo(px + Math.random() * 10 - 5, s); x.stroke(); } noiseFill(x, s, 0.8, 1.05); }),
    leaves: () => canvasTex(128, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${30 + Math.random() * 40},${60 + Math.random() * 60},20,.35)`; x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, 6, 3, Math.random() * 3, 0, TAU); x.fill(); } }),
    rubber: () => canvasTex(64, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 8; i++) x.fillRect(i * 8, 0, 3, s); }),
    rust: () => canvasTex(128, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${120 + Math.random() * 60},${50 + Math.random() * 30},20,.3)`; x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 9, 0, TAU); x.fill(); } x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, s * 0.2, s, 4); x.fillRect(0, s * 0.8, s, 4); noiseFill(x, s, 0.9, 1.05); }),
    onesie: () => canvasTex(128, (x, s) => { x.fillStyle = '#5fb4ff'; x.fillRect(0, 0, s, s); x.fillStyle = '#fffdf7'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * 32 + 16 + (j % 2) * 16, j * 32 + 16, 6, 0, TAU); x.fill(); } }),
    blob: () => canvasTex(64, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(20,15,30,.55)'); g.addColorStop(1, 'rgba(20,15,30,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }),
  }[name]; TEX[name] = T(); return TEX[name];
}
const GRAD3 = (() => { const d = new Uint8Array([110, 110, 110, 255, 200, 200, 200, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
function makeMat(spec, extra) {
  if (typeof spec === 'string') spec = { t: spec };
  const o = Object.assign({ vertexColors: true }, extra || {}); if (spec.tex) o.map = tex(spec.tex);
  if (spec.t === 'toon') return new THREE.MeshToonMaterial(Object.assign(o, { gradientMap: GRAD3 }));
  if (spec.t === 'standard') return new THREE.MeshStandardMaterial(Object.assign(o, { roughness: spec.rough === undefined ? 0.7 : spec.rough, metalness: 0 }));
  if (spec.t === 'basic') return new THREE.MeshBasicMaterial(o);
  return new THREE.MeshLambertMaterial(o);
}

/* ---------- build the world for a level ---------- */
function buildWorld(scene, L, rost) {
  const W = { L, root: new THREE.Group(), st: L.style, bodies: [], devs: [], walls: [], fx: null, td: null, boxLabel: null, lastMl: -1, light: {} };
  scene.add(W.root);
  const st = L.style;
  // light
  W.light.hemi = new THREE.HemisphereLight(st.hemi[0], st.hemi[1], st.hemi[2]); W.root.add(W.light.hemi);
  W.light.sun = new THREE.DirectionalLight(st.sun[0], st.sun[1]); W.light.sun.position.copy(st.sun[2]).multiplyScalar(5); W.root.add(W.light.sun);
  W.light.amb = new THREE.AmbientLight(0xffffff, 0.15); W.root.add(W.light.amb);
  W.base = { bg: new THREE.Color(st.bg), fog: new THREE.Color(st.fog[0]), hemi: st.hemi[2], sun: st.sun[1], near: st.fog[1], far: st.fog[2] };
  scene.background = W.base.bg.clone(); scene.fog = new THREE.Fog(W.base.fog.clone(), st.fog[1], st.fog[2]);
  // ground
  const g = st.ground;
  if (g.terrain) {
    const S = HALF * 2 + 4, n = 90, geo = new THREE.PlaneGeometry(S, S, n, n); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), lo = new THREE.Color(g.lo), hi = new THREE.Color(g.hi), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), h = L.groundH(x, z); pos.setY(i, h); c.copy(lo).lerp(hi, clamp(h / 0.22, 0, 1)); cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    W.root.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  } else {
    const S = HALF * 2 + 4, t = tex(g.tex).clone(); t.needsUpdate = true; t.repeat.set(S / (g.tex === 'checker' ? 0.8 : g.tex === 'paving' ? 1.2 : 2.5), S / (g.tex === 'checker' ? 0.8 : g.tex === 'paving' ? 1.2 : 2.5));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshLambertMaterial({ map: t, color: g.col })); m.rotation.x = -Math.PI / 2; W.root.add(m);
  }
  const far = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: st.fog[0] })); far.rotation.x = -Math.PI / 2; far.position.y = -0.01; W.root.add(far);
  // static playground, merged by family
  for (const fam in L.vis) {
    if (fam[0] === '_' || !L.vis[fam].length) continue;
    const spec = st.fams[fam] || 'lambert', list = L.vis[fam], geo = mergeParts(list), mat = makeMat(spec);
    W.root.add(new THREE.Mesh(geo, mat));
    if (st.outline && !(spec && spec.noOutline)) W.root.add(new THREE.Mesh(geo, outlineMat(st.outline)));
    if (st.edges) { const eg = edgesOf(list.filter(p => p.g !== 'cyl6'), 35); W.root.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: st.edges }))); }
  }
  buildToyBox(W); for (const d of L.devices) W.devs.push(buildDevice(W, d));
  // bodies
  W.toyMat = st.fams.plain === 'toon' || st.outline ? new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD3 }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  W.toyOl = st.toyOutline ? outlineMat(st.toyOutline) : null;
  const shadowGeo = new THREE.PlaneGeometry(1, 1); shadowGeo.rotateX(-Math.PI / 2);
  W.shadows = new THREE.InstancedMesh(shadowGeo, new THREE.MeshBasicMaterial({ map: tex('blob'), transparent: true, depthWrite: false }), rost.length + 5); W.shadows.frustumCulled = false; W.root.add(W.shadows);
  rost.forEach((r, i) => W.bodies.push(buildBody(W, r, i)));
  W.td = buildToddler(W);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.05), W.toyMat.clone()); m.material.vertexColors = false; m.material.color.set(['#e23b2e', '#2f5cff', '#ffd400'][i % 3]); m.visible = false; W.root.add(m); W.walls.push(m); }
  W.fx = makeFx(W.root);
  if (st.dust) W.root.add(W.dust = makeDust());
  return W;
}
function disposeWorld(scene, W) { if (!W) return; scene.remove(W.root); W.root.traverse(o => { if (o.geometry && !Object.values(PRIM).includes(o.geometry)) o.geometry.dispose(); }); }

function buildToyBox(W) {
  const { c, w, d, h, t } = BOX, id = W.L.id;
  const col = { vaneyck: '#e23b2e', noguchi: '#2e5bea', memphis: '#ff3e8a', junk: '#a0703f' }[id], rim = { vaneyck: '#ffd400', noguchi: '#ffd21f', memphis: '#15121a', junk: '#6e4f33' }[id];
  const parts = [P('box', V(c.x, h / 2, c.z - d / 2 + t / 2), V(w, h, t), col), P('box', V(c.x, h / 2, c.z + d / 2 - t / 2), V(w, h, t), col), P('box', V(c.x - w / 2 + t / 2, h / 2, c.z), V(t, h, d), col), P('box', V(c.x + w / 2 - t / 2, h / 2, c.z), V(t, h, d), col), P('box', V(c.x, 0.008, c.z), V(w, 0.016, d), '#5a3a2a')];
  for (const z of [-1, 1]) parts.push(P('box', V(c.x, h + 0.006, c.z + z * (d / 2 - t / 2)), V(w + 0.01, 0.014, t + 0.012), rim));
  for (const x of [-1, 1]) parts.push(P('box', V(c.x + x * (w / 2 - t / 2), h + 0.006, c.z), V(t + 0.012, 0.014, d + 0.01), rim));
  const lid = Q().setFromAxisAngle(X_AX, -1.95); parts.push(P('box', V(c.x, h + 0.16, c.z - d / 2 - 0.05).add(V(0, 0, 0)), V(w, 0.025, d), col, lid));
  const geo = mergeParts(parts.map(p => Object.assign(p, { uv: 2 }))), m = new THREE.Mesh(geo, makeMat(id === 'junk' ? { t: 'lambert', tex: 'wood' } : id === 'memphis' ? 'toon' : 'lambert'));
  W.root.add(m); if (W.st.outline || W.st.toyOutline) W.root.add(new THREE.Mesh(geo, outlineMat(0.005)));
  // the front label: "TOY BOX · 17 left"
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const tx = new THREE.CanvasTexture(cv);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, w * 0.86 * 192 / 512), new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
  lab.position.set(c.x, h * 0.55, c.z + d / 2 + 0.002); W.root.add(lab);
  W.boxLabel = { cv, tx, draw(n, tot) { const x = cv.getContext('2d'); x.clearRect(0, 0, 512, 192); x.fillStyle = '#fffdf7'; x.strokeStyle = '#15121a'; x.lineWidth = 10; rr(x, 8, 8, 496, 176, 30); x.fill(); x.stroke();
    x.fillStyle = '#15121a'; x.textAlign = 'center'; x.font = '400 64px Bungee, Rubik, sans-serif'; x.fillText('TOY BOX', 256, 88); x.font = '800 48px Rubik, sans-serif'; x.fillStyle = n === 0 ? '#00a651' : '#e23b2e'; x.fillText(n === 0 ? 'All clean!' : n + ' still out', 256, 152); tx.needsUpdate = true; } };
}
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

function buildDevice(W, d) {
  const mat = W.st.outline ? new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD3 }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  const ol = W.st.outline || W.st.toyOutline ? outlineMat(0.004) : null;
  const mesh = (parts) => { const geo = mergeParts(parts), m = new THREE.Mesh(geo, mat); if (ol) m.add(new THREE.Mesh(geo, ol)); return m; };
  const o = { d, g: new THREE.Group() }; W.root.add(o.g);
  if (d.type === 'seesaw') {
    o.g.position.copy(d.c); o.g.rotation.y = d.yaw; o.arm = new THREE.Group(); o.g.add(o.arm);
    const ps = [P('box', V(0, d.th / 2, 0), V(d.len, d.th, d.w), d.col)];
    for (const x of [-1, 1]) { ps.push(P('cyl6', V(x * (d.len / 2 - 0.08), 0.045, 0), V(0.008, 0.08, 0.008), '#15121a')); ps.push(P('cyl6', V(x * (d.len / 2 - 0.08), 0.085, 0), V(0.008, d.w * 0.8, 0.008), '#15121a', qx(Math.PI / 2))); }
    o.arm.add(mesh(ps));
  } else if (d.type === 'mgr') {
    o.g.position.copy(d.c); const ps = [P('cyl', V(0, d.h / 2 + 0.01, 0), V(d.r, d.h, d.r), d.col), P('cyl', V(0, d.h + 0.012, 0), V(d.r * 0.25, 0.006, d.r * 0.25), '#ffd400')];
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ps.push(P('box', V(Math.cos(a) * d.r * 0.55, d.h + 0.012, Math.sin(a) * d.r * 0.55), V(d.r * 0.9, 0.004, 0.03), i % 2 ? '#15121a' : '#fffdf7', qy(-a)));
      const p0 = V(Math.cos(a) * d.r * 0.75, d.h, Math.sin(a) * d.r * 0.75); ps.push(P('cyl6', V(p0.x, d.h + 0.06, p0.z), V(0.007, 0.12, 0.007), '#2f5cff')); }
    ps.push(P('ring', V(0, d.h + 0.12, 0), V(d.r * 0.75, d.r * 0.75, d.r * 0.75 * 0.6), '#2f5cff', qx(Math.PI / 2)), P('cyl6', V(0, 0.005, 0), V(0.04, 0.01, 0.04), '#15121a'));
    o.arm = mesh(ps); o.g.add(o.arm);
  } else if (d.type === 'swing') {
    o.g.position.copy(d.pivot); o.g.rotation.y = d.yaw; o.arm = new THREE.Group(); o.g.add(o.arm);
    const tire = d.look === 'tire', ps = [];
    if (tire) { ps.push(P('tor', V(0, -d.len, 0), V(0.07, 0.07, 0.08), '#2a2a2c', qx(Math.PI / 2))); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; ps.push(P('cyl6', V(Math.cos(a) * 0.035, -d.len / 2, Math.sin(a) * 0.035), V(0.003, d.len, 0.003), '#d9c49a')); } }
    else { ps.push(P('box', V(0, -d.len, 0), V(0.14, 0.016, 0.09), d.col)); for (const x of [-0.06, 0.06]) ps.push(P('cyl6', V(x, -d.len / 2, 0), V(0.003, d.len, 0.003), '#5b5f66')); }
    o.arm.add(mesh(ps));
  } else if (d.type === 'mbox') {
    o.g.position.copy(d.c); o.g.rotation.y = d.yaw; const ps = [], C = d.col;
    if (d.look === 'kiosk') { ps.push(P('box', V(0, 0.05, 0), V(0.15, 0.1, 0.11), '#fffdf7'), P('cone', V(0, 0.14, 0), V(0.11, 0.08, 0.11), C, qy(Math.PI / 4))); }
    else if (d.look === 'cube') { ps.push(P('box', V(0, 0.05, 0), V(0.15, 0.1, 0.11), C), P('cyl', V(0, 0.05, 0.056), V(0.035, 0.004, 0.035), '#ffd21f', qx(Math.PI / 2))); }
    else if (d.look === 'jukebox') { ps.push(P('box', V(0, 0.045, 0), V(0.15, 0.09, 0.11), C), P('cyl', V(0, 0.09, 0), V(0.075, 0.11, 0.075), '#ffd400', qx(Math.PI / 2)), P('box', V(0, 0.05, 0.056), V(0.1, 0.05, 0.004), '#00c2b3')); }
    else { ps.push(P('box', V(0, 0.05, 0), V(0.15, 0.1, 0.11), C), P('cyl', V(-0.03, 0.05, 0.056), V(0.03, 0.004, 0.03), '#2a2a2c', qx(Math.PI / 2)), P('cyl6', V(0.05, 0.15, 0), V(0.003, 0.12, 0.003), '#c0c4c8', qz(0.3))); }
    for (let i = 0; i < 3; i++) ps.push(P('sphLo', V(-0.04 + i * 0.04, 0.115 + (d.look === 'kiosk' ? 0.07 : 0), 0.0), V(0.006, 0.006, 0.006), '#15121a'));
    o.g.add(mesh(ps));
    o.crank = new THREE.Group(); o.crank.position.set(0.085, 0.07, 0); o.g.add(o.crank);
    o.crank.add(mesh([P('cyl6', V(0.012, 0, 0), V(0.006, 0.025, 0.006), '#c0c4c8', qz(Math.PI / 2)), P('box', V(0.025, 0.018, 0), V(0.006, 0.04, 0.006), '#c0c4c8'), P('cyl6', V(0.035, 0.036, 0), V(0.008, 0.02, 0.008), '#e23b2e', qz(Math.PI / 2))]));
    // the wind-up meter: notes that light up
    o.dots = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(PRIM.sphLo, new THREE.MeshBasicMaterial({ color: 0xcfc8d8 })); const a = i / 8 * TAU; m.position.set(Math.cos(a) * 0.07, 0.26, Math.sin(a) * 0.07); m.scale.setScalar(0.012); o.g.add(m); o.dots.push(m); }
  }
  return o;
}

/* ---------- bodies ---------- */
const TOY_GEO = {}, PART_GEO = {};
function toyGeo(kind, r) { const k = kind + ':' + r; return TOY_GEO[k] || (TOY_GEO[k] = mergeParts(TOYS[kind].build(r))); }
function partGeo(L, kind, colIdx) {
  const P0 = L.parts[kind], r = P0.r, col = P0.cols[colIdx % P0.cols.length], key = L.id + kind + ':' + colIdx; if (PART_GEO[key]) return PART_GEO[key];
  let ps;
  switch (P0.shape) {
    case 'sph': ps = [P('sph', V(), V(r, r, r), col), P('ring', V(), V(r * 1.0, r * 1.0, r * 1.4), '#fffdf7', qx(Math.PI / 2))]; break;
    case 'box': ps = [P('box', V(), V(r * 1.55, r * 1.55, r * 1.55), col)]; break;
    case 'bucket': ps = [P('cyl', V(0, -r * 0.1, 0), V(r * 0.85, r * 1.5, r * 0.85), col), P('ring', V(0, r * 0.4, 0), V(r * 0.85, r * 0.85, r * 0.85), '#fffdf7', qx(Math.PI / 2)), P('ring', V(0, r * 0.55, 0), V(r * 0.7, r * 0.7, r * 0.7), '#15121a')]; break;
    case 'ring': ps = [P('tor', V(), V(r * 0.75, r * 0.75, r * 0.9), col)]; break;
    case 'cone': ps = [P('cone', V(0, r * 0.1, 0), V(r * 0.85, r * 1.6, r * 0.85), col), P('box', V(0, -r * 0.75, 0), V(r * 1.6, r * 0.15, r * 1.6), '#fffdf7')]; break;
    case 'can': ps = [P('cyl', V(), V(r * 0.7, r * 1.7, r * 0.7), col), P('cyl', V(0, r * 0.86, 0), V(r * 0.72, r * 0.05, r * 0.72), '#9aa3a8'), P('cyl', V(0, 0, 0), V(r * 0.72, r * 0.5, r * 0.72), '#fffdf7')]; break;
    case 'tire': ps = [P('tor', V(), V(r * 0.75, r * 0.75, r * 0.95), col)]; break;
  }
  return PART_GEO[key] = mergeParts(ps);
}
function buildBody(W, r, i) {
  const [type, kind, rad, col] = r, o = { i, type, kind, r: rad, g: new THREE.Group() };
  let geo; if (type === 1) geo = partGeo(W.L, kind, col); else geo = toyGeo(kind, rad);
  const m = new THREE.Mesh(geo, W.L.parts[kind] && type === 1 && W.L.parts[kind].tex ? (W.partTexMat || (W.partTexMat = makeMat({ t: W.toyMat.isMeshToonMaterial ? 'toon' : 'lambert', tex: W.L.parts[kind].tex }))) : W.toyMat);
  o.g.add(m); o.body = m; if (W.toyOl) m.add(new THREE.Mesh(geo, W.toyOl));
  if (type === 2) { m.material = W.toyMat.clone(); m.material.transparent = true; m.material.opacity = 0.75; }
  if (type === 0) {
    // stunned stars, sticky drool, the player marker
    o.stars = new THREE.Group(); for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(rad * 0.18), new THREE.MeshBasicMaterial({ color: 0xffd400 })); const a = k / 3 * TAU; s.position.set(Math.cos(a) * rad * 0.8, 0, Math.sin(a) * rad * 0.8); o.stars.add(s); }
    o.stars.position.y = rad * 1.5; o.stars.visible = false; o.g.add(o.stars);
    o.drool = new THREE.Mesh(PRIM.sphLo, new THREE.MeshLambertMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.7, emissive: 0x204060 })); o.drool.scale.set(rad * 0.9, rad * 0.35, rad * 0.9); o.drool.position.y = -rad * 0.7; o.drool.visible = false; o.g.add(o.drool);
    o.mark = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.35, rad * 0.6, 4), new THREE.MeshBasicMaterial({ color: 0xff3e8a })); o.mark.rotation.x = Math.PI; o.mark.position.y = rad * 2.6; o.mark.visible = false; o.g.add(o.mark);
  }
  W.root.add(o.g); return o;
}

/* ---------- the giant toddler ---------- */
function buildToddler(W) {
  const SK = '#ffd2b8', T = { g: new THREE.Group() };
  const skin = new THREE.MeshLambertMaterial({ color: SK }), dark = new THREE.MeshBasicMaterial({ color: 0x2a1a22 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const onesie = new THREE.MeshLambertMaterial({ map: tex('onesie') });
  T.head = new THREE.Group(); T.g.add(T.head);
  const hm = new THREE.Mesh(PRIM.sph, skin); hm.scale.set(0.14, 0.135, 0.135); T.head.add(hm);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(PRIM.sphLo, skin); ear.scale.set(0.025, 0.04, 0.03); ear.position.set(sx * 0.137, -0.005, 0.01); T.head.add(ear);
    const ew = new THREE.Mesh(PRIM.sph, white); ew.scale.set(0.03, 0.036, 0.02); ew.position.set(sx * 0.05, 0.02, -0.122); T.head.add(ew);
    const ep = new THREE.Mesh(PRIM.sph, dark); ep.scale.set(0.019, 0.024, 0.012); ep.position.set(sx * 0.05, 0.016, -0.137); T.head.add(ep); (T.pupils || (T.pupils = [])).push(ep);
    const hl = new THREE.Mesh(PRIM.sphLo, white); hl.scale.setScalar(0.006); hl.position.set(sx * 0.05 + 0.007, 0.026, -0.148); T.head.add(hl);
    const lid = new THREE.Mesh(PRIM.hemi, skin); lid.scale.set(0.034, 0.04, 0.026); lid.position.set(sx * 0.05, 0.02, -0.12); lid.rotation.x = -0.2; T.head.add(lid); (T.lids || (T.lids = [])).push(lid);
    const ck = new THREE.Mesh(PRIM.sphLo, new THREE.MeshBasicMaterial({ color: 0xff9db0, transparent: true, opacity: 0.6 })); ck.scale.set(0.024, 0.016, 0.01); ck.position.set(sx * 0.085, -0.03, -0.11); T.head.add(ck);
    const brow = new THREE.Mesh(PRIM.box, dark); brow.scale.set(0.035, 0.006, 0.006); brow.position.set(sx * 0.05, 0.07, -0.124); T.head.add(brow); (T.brows || (T.brows = [])).push(brow);
  }
  T.mouth = new THREE.Mesh(PRIM.sph, new THREE.MeshBasicMaterial({ color: 0x7a1f35 })); T.mouth.position.set(0, -0.06, -0.118); T.mouth.scale.set(0.03, 0.008, 0.012); T.head.add(T.mouth);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 14, Math.PI * 1.6), new THREE.MeshLambertMaterial({ color: 0x8a5a3a })); curl.position.set(0, 0.14, -0.02); T.head.add(curl);
  T.chest = new THREE.Mesh(PRIM.sph, onesie); T.chest.scale.set(0.17, 0.15, 0.17); T.g.add(T.chest);
  T.butt = new THREE.Mesh(PRIM.sph, onesie); T.butt.scale.set(0.16, 0.15, 0.17); T.g.add(T.butt);
  T.arms = [0, 1].map(() => { const m = new THREE.Mesh(PRIM.cyl, onesie); T.g.add(m); return m; });
  T.legs = [0, 1].map(() => { const m = new THREE.Mesh(PRIM.sph, onesie); m.scale.set(0.06, 0.06, 0.12); T.g.add(m); return m; });
  T.feet = [0, 1].map(() => { const m = new THREE.Mesh(PRIM.sph, skin); m.scale.set(0.04, 0.035, 0.05); T.g.add(m); return m; });
  T.hands = [0, 1].map(i => {
    const g = new THREE.Group(), palm = new THREE.Mesh(PRIM.sph, skin); palm.scale.set(0.042, 0.026, 0.05); g.add(palm); g.fingers = [];
    for (let k = 0; k < 4; k++) { const f = new THREE.Group(); f.position.set((k - 1.5) * 0.018, 0.0, -0.045); const fm = new THREE.Mesh(PRIM.sphLo, skin); fm.scale.set(0.009, 0.009, 0.022); fm.position.z = -0.016; f.add(fm); g.add(f); g.fingers.push(f); }
    const th = new THREE.Group(); th.position.set((i === 0 ? -1 : 1) * 0.04, 0, -0.01); const tm = new THREE.Mesh(PRIM.sphLo, skin); tm.scale.set(0.01, 0.01, 0.02); tm.position.set((i === 0 ? -1 : 1) * 0.008, 0, -0.012); th.add(tm); g.add(th); g.thumb = th;
    T.g.add(g); return g;
  });
  W.root.add(T.g); return T;
}
const _qa = Q(), _qb = Q(), _va = V(), _vb = V();
function setArm(m, a, b, r) { const d = _vb.subVectors(b, a), L = d.length(); m.position.addVectors(a, b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(Y_AX, d.divideScalar(L || 1)); m.scale.set(r, L, r); }

/* ---------- draw a snapshot (s1 blended toward s2 by k, if given) ---------- */
function lp(a, b, i, k) { return b ? a[i] + (b[i] - a[i]) * k : a[i]; }
function drawSnap(W, s, s2, k, me) {
  const B = s.b, B2 = s2 && s2.b, viewer = me.viewer;
  let sh = 0; const dummy = drawSnap.d || (drawSnap.d = new THREE.Object3D());
  for (let i = 0; i < W.bodies.length; i++) {
    const o = W.bodies[i], j = i * 8, f = B[j + 7];
    if (f & 1) { o.g.visible = false; continue; } o.g.visible = true;
    const jump = B2 && (B2[j + 7] & 1) !== (f & 1);
    const kk = jump ? 0 : k;
    o.g.position.set(lp(B, B2, j, kk), lp(B, B2, j + 1, kk), lp(B, B2, j + 2, kk));
    _qa.set(B[j + 3], B[j + 4], B[j + 5], B[j + 6]); if (B2 && !jump) { _qb.set(B2[j + 3], B2[j + 4], B2[j + 5], B2[j + 6]); _qa.slerp(_qb, kk); } o.g.quaternion.copy(_qa.normalize());
    o.g.scale.setScalar(f & 128 ? 0.55 : 1);
    if (o.stars) {
      o.stars.visible = !!(f & 2); if (f & 2) { o.stars.rotation.y += 0.15; o.stars.quaternion.premultiply(_qb.copy(o.g.quaternion).invert()); o.stars.rotation.y = performance.now() / 150; }
      o.drool.visible = !!(f & 4);
      const mine = me.body === i, mate = !mine && (f & 64) && viewer === 'toy';
      o.mark.visible = !!(mine || mate); if (o.mark.visible) { o.mark.material.color.set(mine ? '#ffd400' : (me.slotOf && me.slotOf[i] === 1 ? '#00c2b3' : '#ff3e8a')); o.mark.position.y = o.r * 2.6 + Math.sin(performance.now() / 200) * o.r * 0.2; o.mark.quaternion.copy(o.g.quaternion).invert(); o.mark.rotateX(Math.PI); }
      if (f & 16 && Math.random() < 0.3) fxPuff(W.fx, o.g.position, '#ffffff', 1, 0.3, 0.004);
    }
    // blob shadow on the ground under it
    const p = o.g.position, gh = W.L.groundH(p.x, p.z), hgt = Math.max(0, p.y - o.r - gh), sz = o.r * 2.4 * (1 + hgt * 1.5);
    dummy.position.set(p.x, gh + 0.003, p.z); dummy.scale.set(sz, 1, sz); dummy.updateMatrix(); W.shadows.setMatrixAt(sh++, dummy.matrix);
  }
  // toddler
  const T = s.td, T2 = s2 && s2.td, td = W.td, L = n => lp(T, T2, n, k);
  td.head.position.set(L(0), L(1), L(2)); _qa.set(T[3], T[4], T[5], T[6]); if (T2) { _qb.set(T2[3], T2[4], T2[5], T2[6]); _qa.slerp(_qb, k); } td.head.quaternion.copy(_qa);
  for (let h = 0; h < 2; h++) { const o = 7 + h * 8, g = td.hands[h], fl = T[o + 7];
    g.position.set(L(o), L(o + 1), L(o + 2)); _qa.set(T[o + 3], T[o + 4], T[o + 5], T[o + 6]); if (T2) { _qb.set(T2[o + 3], T2[o + 4], T2[o + 5], T2[o + 6]); _qa.slerp(_qb, k); } g.quaternion.copy(_qa);
    g.visible = !!(fl & 2); const curl = fl & 1 ? 1.25 : 0.15; for (const f of g.fingers) f.rotation.x = lerp(f.rotation.x, curl, 0.4); g.thumb.rotation.y = lerp(g.thumb.rotation.y, fl & 1 ? (h === 0 ? -0.9 : 0.9) : 0, 0.4);
    if (fl & 4 && Math.random() < 0.15) fxPuff(W.fx, g.position, '#ffd400', 1, 0.5, 0.006); }
  td.chest.position.set(L(23), L(24), L(25)); td.butt.position.set(L(26), L(27), L(28));
  const mouth = T[29], sleepy = T[33], giggle = T[34];
  td.mouth.scale.set(0.03 + mouth * 0.012 + giggle * 0.01, 0.008 + mouth * 0.04 + (giggle > 0 ? 0.02 + Math.sin(performance.now() / 50) * 0.01 : 0), 0.012);
  for (const l of td.lids) l.scale.y = 0.04 * (sleepy > 0.2 ? sleepy : 0.05); for (const l of td.lids) l.visible = sleepy > 0.2;
  const spooky = s.ph === 2 && s.st === 1; for (const p of td.pupils) { p.scale.set(spooky ? 0.024 : 0.019, spooky ? 0.03 : 0.024, 0.012); }
  td.brows.forEach((b, i) => { b.rotation.z = spooky ? (i ? 0.45 : -0.45) : 0; });
  // shoulders hang off the chest; arms reach to the hands; legs trail behind
  const hq = td.head.quaternion, side = _va.set(1, 0, 0).applyQuaternion(hq); side.y = 0; side.normalize();
  for (let h = 0; h < 2; h++) { const sx = h === 0 ? 1 : -1, sh0 = td.chest.position.clone().addScaledVector(side, sx * 0.12); sh0.y += 0.04; setArm(td.arms[h], sh0, td.hands[h].position, 0.035); td.arms[h].visible = td.hands[h].visible; }
  const back = V().subVectors(td.butt.position, td.chest.position); back.y = 0; back.normalize();
  for (let h = 0; h < 2; h++) { const sx = h === 0 ? 1 : -1, lg = td.legs[h], ft = td.feet[h]; lg.position.copy(td.butt.position).addScaledVector(side, sx * 0.08).addScaledVector(back, 0.12); lg.position.y = Math.max(0.06, td.butt.position.y - 0.08);
    lg.quaternion.setFromUnitVectors(Z_AX, back); ft.position.copy(lg.position).addScaledVector(back, 0.12); ft.position.y = Math.max(0.035, lg.position.y - 0.02); ft.quaternion.copy(lg.quaternion); }
  // the toddler can't see their own giant body in the headset, only their hands
  const self = viewer === 'toddler'; td.head.visible = td.chest.visible = td.butt.visible = !self; for (const m of [...td.arms, ...td.legs, ...td.feet]) m.visible = m.visible && !self;
  if (self) for (const m of td.arms) m.visible = false;
  for (const p of [td.chest.position, td.butt.position]) { const gh = W.L.groundH(p.x, p.z); dummy.position.set(p.x, gh + 0.004, p.z); dummy.scale.set(0.5, 1, 0.5); dummy.updateMatrix(); W.shadows.setMatrixAt(sh++, dummy.matrix); }
  for (let h = 0; h < 2; h++) { const p = td.hands[h].position, gh = W.L.groundH(p.x, p.z), hg = Math.max(0, p.y - gh); dummy.position.set(p.x, gh + 0.004, p.z); dummy.scale.setScalar(0.12 * (1 + hg)); dummy.updateMatrix(); W.shadows.setMatrixAt(sh++, dummy.matrix); }
  W.shadows.count = sh; W.shadows.instanceMatrix.needsUpdate = true;
  // devices
  s.dv.forEach((v, i) => { const o = W.devs[i]; if (!o) return; const v2 = s2 && s2.dv[i];
    if (o.d.type === 'seesaw') o.arm.rotation.z = v2 !== undefined ? lerp(v, v2, k) : v;
    else if (o.d.type === 'mgr') { let a = v; if (v2 !== undefined) { let d = v2 - v; a = v + d * k; } o.arm.rotation.y = -a; }
    else if (o.d.type === 'swing') o.arm.rotation.x = v2 !== undefined ? lerp(v, v2, k) : v;
    else if (o.d.type === 'mbox') { o.crank.rotation.x = v[1]; o.dots.forEach((m, j) => m.material.color.set(v[2] ? '#cfc8d8' : j < Math.round(v[0] * 8) ? '#ffd400' : '#6a6470')); } });
  // block walls
  W.walls.forEach((m, i) => { const w = s.tw[i]; m.visible = !!w; if (w) { m.position.set(w[0], w[1], w[2]); m.rotation.y = w[3]; m.scale.y = Math.min(1, w[4] * 3); } });
  if (s.ml !== W.lastMl) { W.lastMl = s.ml; W.boxLabel.draw(s.ml, s.mt); }
}

/* ---------- phase lighting: epic, silly, spooky, sleepy ---------- */
const PH_TINT = [
  { hemi: 0.9, sun: 1.35, fog: '#ffcf9e', mix: 0.12, near: 1, far: 1 },
  { hemi: 1.12, sun: 1.0, fog: '#ffffff', mix: 0.0, near: 1, far: 1 },
  { hemi: 0.42, sun: 0.3, fog: '#2a2340', mix: 0.62, near: 0.55, far: 0.6 },
  { hemi: 0.95, sun: 0.6, fog: '#cdbaf2', mix: 0.45, near: 0.85, far: 0.9 },
];
function phaseLight(W, scene, ph, playing, dt) {
  const t = PH_TINT[playing ? ph : 1], k = Math.min(1, dt * 1.2), c = new THREE.Color(), b = W.base;
  W.light.hemi.intensity = lerp(W.light.hemi.intensity, b.hemi * t.hemi, k); W.light.sun.intensity = lerp(W.light.sun.intensity, b.sun * t.sun, k);
  c.copy(b.fog).lerp(new THREE.Color(t.fog), t.mix); scene.fog.color.lerp(c, k); c.copy(b.bg).lerp(new THREE.Color(t.fog), t.mix); scene.background.lerp(c, k);
  scene.fog.near = lerp(scene.fog.near, b.near * t.near, k); scene.fog.far = lerp(scene.fog.far, b.far * t.far, k);
  if (W.dust) { W.dust.rotation.y += dt * 0.02; W.dust.position.y = Math.sin(performance.now() / 4000) * 0.05; }
  if (playing && ph === 3 && Math.random() < dt * 6) fxPuff(W.fx, V((Math.random() * 2 - 1) * HALF, 0.1 + Math.random() * 0.6, (Math.random() * 2 - 1) * HALF), '#fff6c8', 1, 0.05, 0.012, 2.5);
}
function makeDust() {
  const n = 400, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() * 2 - 1) * HALF; p[i * 3 + 1] = Math.random() * 1.2; p[i * 3 + 2] = (Math.random() * 2 - 1) * HALF; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff3d0, size: 0.006, transparent: true, opacity: 0.6, depthWrite: false }));
}

/* ---------- particles ---------- */
function makeFx(root) {
  const N = 500, g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexColors: true,
    vertexShader: 'attribute float size; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 900.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard; gl_FragColor = vec4(vC, 1.0 - smoothstep(0.15,0.25,r)); }' });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; root.add(pts);
  return { pts, pos, col, size, N, p: Array.from({ length: N }, () => ({ life: 0 })), i: 0 };
}
function fxPuff(F, at, color, n, spd, sz, life, grav) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) { const q = F.p[F.i = (F.i + 1) % F.N]; q.x = at.x; q.y = at.y; q.z = at.z; const a = Math.random() * TAU, u = Math.random() * 2 - 1, s = spd * (0.4 + Math.random() * 0.6);
    q.vx = Math.cos(a) * Math.sqrt(1 - u * u) * s; q.vy = Math.abs(u) * s + spd * 0.3; q.vz = Math.sin(a) * Math.sqrt(1 - u * u) * s; q.life = q.max = (life || 0.6) * (0.6 + Math.random() * 0.6); q.c = c; q.s = sz; q.g = grav === undefined ? 1 : grav; }
}
function fxConfetti(F, at, n) { const C = ['#ff3e8a', '#ffd400', '#00c2b3', '#2f5cff', '#9b5cff', '#ff7a1a']; for (let i = 0; i < n; i++) fxPuff(F, at, C[i % 6], 1, 1.6, 0.008, 1.4, 0.4); }
function fxStep(F, dt) {
  for (let i = 0; i < F.N; i++) { const q = F.p[i];
    if (q.life > 0) { q.life -= dt; q.vy -= 3 * q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vx *= 0.98; q.vz *= 0.98; if (q.y < 0) { q.y = 0; q.vy *= -0.3; }
      F.pos[i * 3] = q.x; F.pos[i * 3 + 1] = q.y; F.pos[i * 3 + 2] = q.z; F.col[i * 3] = q.c.r; F.col[i * 3 + 1] = q.c.g; F.col[i * 3 + 2] = q.c.b; F.size[i] = q.s * Math.min(1, q.life / q.max * 2); }
    else F.size[i] = 0; }
  F.pts.geometry.attributes.position.needsUpdate = true; F.pts.geometry.attributes.color.needsUpdate = true; F.pts.geometry.attributes.size.needsUpdate = true;
}

/* ---------- events: sounds and puffs, heard from where you are ---------- */
function onEvent(W, e, ear, viewer) {
  const [code, x, y, z, a] = e, p = V(x, y, z), d = ear ? ear.distanceTo(p) : 1, vol = viewer === 'toddler' ? clamp(1.4 / (1 + d * d * 1.5), 0.15, 1) : clamp(1 / (1 + (d / 0.9) ** 2), 0.08, 1);
  const P = (c, n, s, sz, l, g) => fxPuff(W.fx, p, c, n, s, sz, l, g);
  switch (code) {
    case 'jump': sfx.play('jump', vol * 0.6, 0.8 + Math.random() * 0.5); break;
    case 'land': sfx.play('land', vol * a); P('#d9cfc0', 4, 0.3, 0.008, 0.4); break;
    case 'grab': sfx.play('grab', vol, a === -2 ? 1.6 : 1); if (a >= 0 && viewer !== 'toddler') sfx.play('squeak', vol * 0.5, 0.8); break;
    case 'throw': sfx.play('throw', vol * (a || 1)); break;
    case 'away': sfx.play('away', 1); P('#ffd400', 14, 1.0, 0.012, 0.8); fxConfetti(W.fx, p, 10); break;
    case 'stun': sfx.play('stun', vol); P('#ffd400', 6, 0.5, 0.01, 0.6); break;
    case 'slam': sfx.play('slam', 1); sfx.play('waah', 0.8, 1 + Math.random() * 0.2); P('#d9cfc0', 40, 1.4, 0.02, 0.9); break;
    case 'chomp': sfx.play('chomp', vol); P('#bfe9ff', 8, 0.5, 0.01, 0.8); break;
    case 'giggle': sfx.play('giggle', 1); P('#ff9db0', 20, 0.9, 0.015, 1.0, 0.2); break;
    case 'tickle': sfx.play('tickle', vol, 0.9 + Math.random() * 0.4); P('#ff9db0', 3, 0.5, 0.01, 0.5, 0.2); if (Math.random() < 0.4) sfx.play('babble', 0.5); break;
    case 'bonk': sfx.play('bonk', vol); P('#ffd400', 8, 0.8, 0.012, 0.5); break;
    case 'splash': sfx.play('splash', vol); P('#7fd6ff', 24, 1.2, 0.012, 0.7); break;
    case 'pop': sfx.play('pop', vol); P('#ffffff', 10, 0.8, 0.01, 0.5); break;
    case 'confetti': sfx.play('confetti', vol); fxConfetti(W.fx, p, 40); break;
    case 'drum': sfx.play('drum', vol); P('#e23b2e', 18, 1.4, 0.012, 0.5, 0.1); break;
    case 'roar': sfx.play('roar', vol); break;
    case 'lullaby': sfx.play('lullaby', 1); for (let i = 0; i < 12; i++) P(['#ffd400', '#cbb7ea', '#ff8fc7'][i % 3], 1, 0.4, 0.016, 2, -0.15); break;
    case 'crank': sfx.play('crank', vol); break;
    case 'creak': sfx.play('creak', vol); break;
    case 'spin': case 'zip': case 'whistle': case 'boing': case 'squeak': case 'slip': case 'hop': sfx.play(code, vol, code === 'boing' && a ? 1.3 : 1); if (code === 'boing' || code === 'hop') P('#ffffff', 4, 0.4, 0.008, 0.4); break;
    case 'yawn': sfx.play('yawn', 0.8); break;
    case 'count': sfx.play('tick', 1); break;
    case 'go': sfx.play('go', 1); break;
  }
}

/* ---------- canvas panels (VR wrist, banners) ---------- */
function canvasPanel(w, h, pxPerM) {
  const cv = document.createElement('canvas'); cv.width = Math.round(w * pxPerM); cv.height = Math.round(h * pxPerM);
  const t = new THREE.CanvasTexture(cv); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  m.renderOrder = 10; return { m, cv, x: cv.getContext('2d'), t, last: '' };
}
