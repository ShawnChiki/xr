/* ================= Toy Box: drawing =================
   Builds the living room and the playset in the level's own style, the toys, the toddler (giant hands),
   the moving devices, the nap clock, the door and mom; draws a snapshot (or a blend of two);
   little particles, sounds for events, and the VR overlays. */

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
    blob: () => canvasTex(64, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(20,15,30,.5)'); g.addColorStop(1, 'rgba(20,15,30,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }),
    // the living room
    boards: () => canvasTex(512, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(90,55,25,${0.04 + Math.random() * 0.1})`; x.fillRect(0, i * 64, s, 64); x.fillStyle = 'rgba(60,35,15,.35)'; x.fillRect(0, i * 64, s, 3); const k = Math.random() * s; x.fillRect(k, i * 64, 3, 64); }
      x.strokeStyle = 'rgba(80,45,20,.15)'; for (let i = 0; i < 60; i++) { x.lineWidth = 1; x.beginPath(); const y = Math.random() * s; x.moveTo(0, y); x.bezierCurveTo(s * 0.3, y + 4, s * 0.6, y - 4, s, y); x.stroke(); } }),
    sketch: () => canvasTex(512, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(30,25,35,.22)'; x.lineWidth = 2; for (let i = 0; i < 14; i++) { const px = Math.random() * s, py = Math.random() * s, r = 10 + Math.random() * 26; x.beginPath(); if (i % 3 === 0) x.arc(px, py, r, 0, TAU); else if (i % 3 === 1) x.rect(px, py, r * 1.4, r); else { x.moveTo(px, py); x.lineTo(px + r, py - r); x.lineTo(px + 2 * r, py); } x.stroke(); }
      x.strokeStyle = 'rgba(226,59,46,.25)'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 8, 0, TAU); x.stroke(); } }),
    washi: () => canvasTex(256, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); noiseFill(x, s, 0.94, 1.0); x.strokeStyle = 'rgba(150,120,90,.18)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * s / 4, 0); x.lineTo(i * s / 4, s); x.stroke(); } x.beginPath(); x.moveTo(0, s / 2); x.lineTo(s, s / 2); x.stroke(); }),
    squiggle: () => canvasTex(256, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); const C = ['#15121a', '#2f5cff', '#00c2b3', '#ffd400']; x.lineWidth = 6; x.lineCap = 'round';
      for (let i = 0; i < 12; i++) { x.strokeStyle = C[i % 4]; const px = Math.random() * s, py = Math.random() * s; x.beginPath(); for (let k = 0; k < 5; k++) x.quadraticCurveTo(px + k * 14 + 7, py + (k % 2 ? -12 : 12), px + k * 14 + 14, py); x.stroke(); }
      for (let i = 0; i < 16; i++) { x.fillStyle = C[i % 4]; x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 4, 0, TAU); x.fill(); } }),
    panel: () => canvasTex(256, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(70,40,15,${0.05 + Math.random() * 0.12})`; x.fillRect(i * s / 6, 0, s / 6, s); x.fillStyle = 'rgba(40,20,5,.5)'; x.fillRect(i * s / 6, 0, 3, s); }
      x.strokeStyle = 'rgba(60,30,10,.15)'; for (let i = 0; i < 40; i++) { x.beginPath(); const px = Math.random() * s; x.moveTo(px, 0); x.bezierCurveTo(px + 5, s / 3, px - 5, s * 0.6, px, s); x.stroke(); } }),
    braid: () => canvasTex(256, (x, s) => { const C = ['#c8553d', '#e0b13a', '#3f7cac', '#5b8c5a', '#efe2c8']; for (let i = 0; i < 16; i++) { x.fillStyle = C[i % 5]; x.fillRect(0, i * 16, s, 16); x.fillStyle = 'rgba(0,0,0,.15)'; for (let k = 0; k < 16; k++) x.fillRect(k * 16 + (i % 2) * 8, i * 16, 8, 16); } }),
    fabric: () => canvasTex(128, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); x.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < s; i += 4) { x.fillRect(i, 0, 2, s); x.fillRect(0, i, s, 2); } }),
    clouds: () => canvasTex(512, (x, s) => { x.fillStyle = '#7cc6ff'; x.fillRect(0, 0, s, s); x.fillStyle = '#ffffff';
      const cloud = (cx, cy, k) => { for (const [dx, dy, r] of [[0, 0, 34], [36, -14, 40], [76, 0, 32], [30, 14, 30], [58, 16, 28], [-26, 10, 24], [100, 12, 22]]) { x.beginPath(); x.arc(cx + dx * k, cy + dy * k, r * k, 0, TAU); x.fill(); } };
      for (const [cx, cy, k] of [[60, 80, 1], [320, 60, 0.8], [190, 230, 1.1], [420, 300, 0.9], [80, 400, 0.85], [300, 450, 1]]) for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) cloud(cx + ox, cy + oy, k); }),
    abc: () => canvasTex(512, (x, s) => { const L = 'ABCDEFGHIJKLMNOP', q = s / 4; x.fillStyle = '#ffffff'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 16; i++) { const px = (i % 4) * q, py = s - (Math.floor(i / 4) + 1) * q; x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 12; x.strokeRect(px + 10, py + 10, q - 20, q - 20);
        x.fillStyle = 'rgba(21,18,26,.6)'; x.font = '900 86px Rubik, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(L[i], px + q / 2, py + q / 2 + 4); } }),
    cardboard: () => canvasTex(256, (x, s) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, s, s); x.fillStyle = 'rgba(120,80,30,.12)'; for (let i = 0; i < s; i += 8) x.fillRect(i, 0, 3, s); x.fillStyle = 'rgba(200,170,120,.7)'; x.fillRect(0, s * 0.45, s, 26); noiseFill(x, s, 0.92, 1.02); }),
    roadrug: () => canvasTex(512, (x, s) => { x.fillStyle = '#62b35c'; x.fillRect(0, 0, s, s); noiseFill(x, s, 0.92, 1.04); x.strokeStyle = '#5b5f66'; x.lineWidth = 46; x.lineJoin = 'round'; rr(x, 70, 70, s - 140, s - 140, 90); x.stroke();
      x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.setLineDash([18, 16]); rr(x, 70, 70, s - 140, s - 140, 90); x.stroke(); x.setLineDash([]);
      for (const [hx, hy, c] of [[s / 2 - 40, s / 2 - 30, '#e23b2e'], [s / 2 + 40, s / 2 + 20, '#2f5cff'], [s / 2 - 50, s / 2 + 60, '#ffd400']]) { x.fillStyle = c; x.fillRect(hx - 22, hy - 16, 44, 32); x.fillStyle = '#5a3a2a'; x.beginPath(); x.moveTo(hx - 26, hy - 16); x.lineTo(hx, hy - 38); x.lineTo(hx + 26, hy - 16); x.fill(); }
      x.fillStyle = '#7fd6ff'; x.beginPath(); x.ellipse(s * 0.72, s * 0.3, 40, 26, 0.3, 0, TAU); x.fill(); }),
    quilt: () => canvasTex(256, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(80,60,90,.3)'; x.setLineDash([6, 6]); x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * s / 4, 0); x.lineTo(i * s / 4, s); x.moveTo(0, i * s / 4); x.lineTo(s, i * s / 4); x.stroke(); } }),
  }[name]; TEX[name] = T(); return TEX[name];
}
const GRAD3 = (() => { const d = new Uint8Array([110, 110, 110, 255, 200, 200, 200, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
function makeMat(spec, extra) {
  if (typeof spec === 'string') spec = { t: spec };
  const o = Object.assign({ vertexColors: true }, extra || {}); if (spec.tex) o.map = tex(spec.tex);
  if (spec.t === 'toon') return new THREE.MeshToonMaterial(Object.assign(o, { gradientMap: GRAD3 }));
  if (spec.t === 'standard') return new THREE.MeshStandardMaterial(Object.assign(o, { roughness: spec.rough === undefined ? 0.7 : spec.rough, metalness: 0 }));
  if (spec.t === 'basic') return new THREE.MeshBasicMaterial(Object.assign(o, { fog: false }));
  return new THREE.MeshLambertMaterial(o);
}
function addMerged(W, vis, fams, opt) {
  for (const fam in vis) {
    if (fam[0] === '_' || !vis[fam].length) continue;
    const spec = fams[fam] || 'lambert', list = vis[fam], geo = mergeParts(list);
    const mesh = new THREE.Mesh(geo, makeMat(spec)); W.root.add(mesh); if (fam === 'r_glow') W.glowMat = mesh.material;
    if (opt.outline && !(spec && spec.noOutline) && fam !== 'r_wall') W.root.add(new THREE.Mesh(geo, outlineMat(opt.outline)));
    if (opt.edges && fam !== 'r_wall') { const eg = edgesOf(list.filter(p => p.g !== 'cyl6' && p.g !== 'sphLo'), 35); W.root.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: opt.edges }))); }
  }
}

/* ---------- build the world for a level ---------- */
function buildWorld(scene, L, rost) {
  const W = { L, root: new THREE.Group(), st: L.style, th: L.room.theme, bodies: [], devs: [], walls: [], proj: [], fx: null, td: null, boxLabel: null, lastMl: -1, light: {}, clock: null, door: null, mom: null };
  scene.add(W.root);
  const st = L.style, th = W.th;
  W.light.hemi = new THREE.HemisphereLight(th.light[0], th.light[1], th.light[2]); W.root.add(W.light.hemi);
  W.light.sun = new THREE.DirectionalLight(0xfff4e0, th.light[3]); const wd = L.room.win ? V(0, 0, -1).applyAxisAngle(Y_AX, L.room.win.yaw) : V(-0.4, 0, 0.3); W.light.sun.position.set(wd.x * 4, 5, wd.z * 4); W.root.add(W.light.sun);
  W.light.amb = new THREE.AmbientLight(0xffffff, 0.12); W.root.add(W.light.amb);
  W.base = { bg: new THREE.Color(st.bg), fog: new THREE.Color(st.fog[0]), hemi: th.light[2], sun: th.light[3], near: st.fog[1], far: st.fog[2] };
  scene.background = W.base.bg.clone(); scene.fog = new THREE.Fog(W.base.fog.clone(), st.fog[1], st.fog[2]);
  // floor, rug or blanket hills, ceiling
  const bw = AREA.maxX - AREA.minX + 1.2, bd = AREA.maxZ - AREA.minZ + 1.2, cx = (AREA.minX + AREA.maxX) / 2, cz = (AREA.minZ + AREA.maxZ) / 2;
  { const t = tex(th.floorTex).clone(); t.needsUpdate = true; const tile = th.floorTex === 'checker' ? 1.0 : 2.4; t.repeat.set(bw / tile, bd / tile);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), new THREE.MeshLambertMaterial({ map: t, color: th.floorCol })); m.rotation.x = -Math.PI / 2; m.position.set(cx, 0, cz); W.root.add(m); }
  if (st.ground && st.ground.terrain) {
    const n = 90, geo = new THREE.PlaneGeometry(bw, bd, n, n); geo.rotateX(-Math.PI / 2); geo.translate(cx, 0, cz);
    const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), lo = new THREE.Color(st.ground.lo), hi = new THREE.Color(st.ground.hi), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), h = L.groundH(x, z); pos.setY(i, h + 0.004); c.copy(lo).lerp(hi, clamp(h / 0.3, 0, 1)); cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const qt = tex('quilt').clone(); qt.needsUpdate = true; qt.repeat.set(bw / 0.5, bd / 0.5);
    const blanket = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: qt, transparent: true }));
    // fade the blanket where there are no hills so the floor shows through
    blanket.material.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;').replace('void main() {', 'varying float vH;\nvoid main() {'); sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vH;\nvoid main() {').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(0.006, 0.03, vH);'); };
    W.root.add(blanket);
  } else if (L.room.rug) { const R = L.room.rug, t = tex(R.tex).clone(); t.needsUpdate = true; if (R.tex === 'roadrug') t.repeat.set(1, 1); else t.repeat.set(R.w / 0.9, R.d / 0.9);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(R.w, R.d), new THREE.MeshLambertMaterial({ map: t, color: th.rugCol || '#ffffff' })); m.rotation.set(-Math.PI / 2, 0, BOX.yaw); m.position.set(R.c.x, 0.004, R.c.z); W.root.add(m);
    const brd = new THREE.Mesh(new THREE.PlaneGeometry(R.w + 0.1, R.d + 0.1), new THREE.MeshLambertMaterial({ color: th.trim === '#ffffff' ? '#15121a' : th.trim })); brd.rotation.copy(m.rotation); brd.position.set(R.c.x, 0.002, R.c.z); W.root.add(brd); }
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), new THREE.MeshLambertMaterial({ color: th.ceil, side: THREE.DoubleSide })); m.rotation.x = Math.PI / 2; m.position.set(cx, WALL_H, cz); W.root.add(m);
    const lamp = new THREE.Mesh(PRIM.sph, new THREE.MeshBasicMaterial({ color: 0xfff6dd, fog: false })); lamp.scale.set(0.22, 0.1, 0.22); lamp.position.set(AREA.cx, WALL_H - 0.05, AREA.cz); W.root.add(lamp); W.ceil = [m, lamp]; }
  // the room's walls and furniture, then the playset
  addMerged(W, L.room.vis, L.room.fams, { edges: th.edges ? '#26232b' : null, outline: th.outline ? 0.012 : 0 });
  addMerged(W, L.vis, st.fams, { edges: st.edges, outline: st.outline ? st.outline * K : 0 });
  buildRoomBits(W);
  buildToyBox(W); for (const d of L.devices) W.devs.push(buildDevice(W, d));
  // bodies
  W.toyMat = st.fams.plain === 'toon' || st.outline ? new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD3 }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  W.toyOl = st.toyOutline ? outlineMat(st.toyOutline * K) : null;
  const shadowGeo = new THREE.PlaneGeometry(1, 1); shadowGeo.rotateX(-Math.PI / 2);
  W.shadows = new THREE.InstancedMesh(shadowGeo, new THREE.MeshBasicMaterial({ map: tex('blob'), transparent: true, depthWrite: false }), rost.length + 8); W.shadows.frustumCulled = false; W.root.add(W.shadows);
  rost.forEach((r, i) => W.bodies.push(buildBody(W, r, i)));
  W.td = buildToddler(W);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.24 * K, 0.15 * K, 0.05 * K), new THREE.MeshLambertMaterial({ color: ['#e23b2e', '#2f5cff', '#ffd400'][i % 3] })); m.visible = false; W.root.add(m); W.walls.push(m); }
  buildProj(W);
  W.fx = makeFx(W.root);
  if (st.dust) W.root.add(W.dust = makeDust());
  return W;
}
function disposeWorld(scene, W) { if (!W) return; scene.remove(W.root); W.root.traverse(o => { if (o.geometry && !Object.values(PRIM).includes(o.geometry)) o.geometry.dispose(); }); }

/* ---------- clock, door + mom, window, pictures, TV ---------- */
function buildRoomBits(W) {
  const R = W.L.room, th = W.th;
  // the nap-time clock
  if (R.clock) { const c = R.clock, g = new THREE.Group(); g.position.copy(c.p); g.rotation.y = c.yaw; W.root.add(g);
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const t = new THREE.CanvasTexture(cv);
    const face = new THREE.Mesh(new THREE.CircleGeometry(c.R, 48), new THREE.MeshBasicMaterial({ map: t, fog: false })); face.position.z = 0.012; g.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(c.R, 0.03, 10, 48), new THREE.MeshLambertMaterial({ color: th.acc[0] })); rim.position.z = 0.015; g.add(rim);
    const hand = (len, w, col, z) => { const pv = new THREE.Group(); pv.position.z = z; const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.008), new THREE.MeshBasicMaterial({ color: col })); m.position.y = len / 2 - 0.02; pv.add(m); g.add(pv); return pv; };
    const big = hand(c.R * 0.8, 0.035, '#15121a', 0.03), sec = hand(c.R * 0.9, 0.01, '#e23b2e', 0.036);
    const pin = new THREE.Mesh(PRIM.sphLo, new THREE.MeshBasicMaterial({ color: th.acc[1] || '#ffd400' })); pin.scale.setScalar(0.025); pin.position.z = 0.04; g.add(pin);
    W.clock = { g, cv, t, big, sec, last: -1, draw(nap) { const x = cv.getContext('2d'), s = 512, m = s / 2; x.clearRect(0, 0, s, s); x.fillStyle = '#fffdf7'; x.beginPath(); x.arc(m, m, m, 0, TAU); x.fill();
      const f = clamp(nap / MATCH_TIME, 0, 1); x.fillStyle = f < 0.25 ? '#cbb7ea' : f < 0.5 ? '#9b5cff' : f < 0.75 ? '#00c2b3' : '#ffb07a'; x.globalAlpha = 0.45; x.beginPath(); x.moveTo(m, m); x.arc(m, m, m * 0.92, -Math.PI / 2 + (1 - f) * TAU, -Math.PI / 2 + TAU); x.closePath(); x.fill(); x.globalAlpha = 1;
      x.fillStyle = '#15121a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 44px Rubik, sans-serif';
      for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU - Math.PI / 2; if (i === 12) continue; x.fillText(String(i), m + Math.cos(a) * m * 0.78, m + Math.sin(a) * m * 0.78); }
      x.font = '400 50px Bungee, Rubik, sans-serif'; x.fillStyle = '#e23b2e'; x.fillText('NAP', m, m * 0.24); x.font = '800 54px Rubik, sans-serif'; x.fillStyle = '#15121a'; x.fillText(fmtClock(nap), m, m * 1.45); t.needsUpdate = true; } };
    W.clock.draw(MATCH_TIME); }
  // the door, the bright hall behind it, and mom
  if (R.door) { const D = R.door, e = AREA.edges[D.e], g = new THREE.Group(); g.position.copy(D.hinge); g.rotation.y = Math.atan2(-e.dz, e.dx); W.root.add(g);
    const zs = Math.sign(e.nx * -e.dz + e.nz * e.dx) || 1;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.03, 0.045), new THREE.MeshLambertMaterial({ color: th.door })); panel.position.set(0.45, 1.02, -0.06 * zs); g.add(panel);
    for (const y of [0.55, 1.45]) { const inset = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.01), new THREE.MeshLambertMaterial({ color: new THREE.Color(th.door).multiplyScalar(0.85) })); inset.position.set(0.45, y, -0.06 * zs + 0.026 * zs); g.add(inset); }
    const knob = new THREE.Mesh(PRIM.sphLo, new THREE.MeshLambertMaterial({ color: '#ffd400' })); knob.scale.setScalar(0.035); knob.position.set(0.8, 1.0, -0.06 * zs + 0.04 * zs); g.add(knob);
    const hall = new THREE.Group(); hall.position.copy(at3(e, D.s, 0, -0.12)); hall.rotation.y = Math.atan2(-e.dz, e.dx); W.root.add(hall);
    const hm = new THREE.MeshBasicMaterial({ color: '#fff1c9', side: THREE.BackSide, fog: false }), hb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 1.6), hm); hb.position.set(0, 1.15, -0.8 * zs); hall.add(hb);
    W.door = { g, zs, open: 0 };
    W.mom = buildMom(W, D); }
  // window
  if (R.win) { const w = R.win, cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#dddddd'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 4; i++) { const cx = 30 + Math.random() * 190, cy = 40 + Math.random() * 90; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(cx + k * 16, cy + (k % 2) * 6, 16, 0, TAU); x.fill(); } }
    const t = new THREE.CanvasTexture(cv), sky = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h), new THREE.MeshBasicMaterial({ map: t, color: '#9fd4ff', fog: false })); sky.position.copy(w.p); sky.rotation.y = w.yaw; W.root.add(sky);
    const fr = new THREE.Group(); fr.position.copy(w.p); fr.rotation.y = w.yaw; W.root.add(fr); const fm = new THREE.MeshLambertMaterial({ color: th.trim });
    for (const [px, py, sx, sy] of [[0, w.h / 2, w.w + 0.08, 0.05], [0, -w.h / 2, w.w + 0.08, 0.05], [-w.w / 2, 0, 0.05, w.h], [w.w / 2, 0, 0.05, w.h], [0, 0, 0.03, w.h], [0, 0, w.w, 0.03]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.04), fm); b.position.set(px, py, 0.02); fr.add(b); }
    W.sky = sky; }
  // pictures on the walls
  for (const p of R.pics) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.round(256 * p.h / p.w); const x = cv.getContext('2d'), rng = mulberry(p.seed), C = th.acc.concat(['#fffdf7', '#15121a']);
    x.fillStyle = C[Math.floor(rng() * C.length)]; x.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < 6; i++) { x.fillStyle = C[Math.floor(rng() * C.length)]; x.beginPath(); const px = rng() * cv.width, py = rng() * cv.height, r = 15 + rng() * 50; if (i % 3 === 0) x.arc(px, py, r, 0, TAU); else if (i % 3 === 1) x.rect(px - r / 2, py - r / 2, r, r * 0.7); else { x.moveTo(px, py - r); x.lineTo(px + r, py + r); x.lineTo(px - r, py + r); } x.fill(); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(cv) })); m.position.copy(p.p); m.rotation.y = p.yaw; W.root.add(m); }
  // TV screens: a cartoon test pattern that flickers
  if (R.screens.length) { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 72; const t = new THREE.CanvasTexture(cv); W.tv = { cv, t, k: 0 };
    for (const s of R.screens) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({ map: t, fog: false })); m.position.copy(s.p); m.rotation.y = s.yaw; W.root.add(m); } }
}
function at3(e, s, y, u) { return V(e.a.x + e.dx * s + e.nx * u, y, e.a.z + e.dz * s + e.nz * u); }
const fmtClock = n => { n = Math.max(0, Math.ceil(n)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };
function buildMom(W, D) {
  const g = new THREE.Group(), SK = new THREE.MeshLambertMaterial({ color: '#e9b48f' }), dress = new THREE.MeshLambertMaterial({ color: '#9b5cff' }), apron = new THREE.MeshLambertMaterial({ color: '#fffdf7' }), hair = new THREE.MeshLambertMaterial({ color: '#5a3424' }), dark = new THREE.MeshBasicMaterial({ color: '#2a1a22' });
  const m = (geo, mat, x, y, z, sx, sy, sz, rx) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); if (rx) o.rotation.x = rx; g.add(o); return o; };
  m(PRIM.cyl, SK, -0.08, 0.2, 0, 0.045, 0.4, 0.045); m(PRIM.cyl, SK, 0.08, 0.2, 0, 0.045, 0.4, 0.045);
  m(PRIM.box, dark, -0.08, 0.03, 0.04, 0.08, 0.06, 0.16); m(PRIM.box, dark, 0.08, 0.03, 0.04, 0.08, 0.06, 0.16);
  m(PRIM.cone, dress, 0, 0.72, 0, 0.36, 0.75, 0.3); m(PRIM.cyl, dress, 0, 1.18, 0, 0.17, 0.36, 0.13);
  m(PRIM.box, apron, 0, 0.82, 0.13, 0.26, 0.5, 0.02);
  m(PRIM.sph, SK, 0, 1.54, 0.01, 0.11, 0.13, 0.11); m(PRIM.sph, hair, 0, 1.6, -0.03, 0.12, 0.12, 0.12); m(PRIM.sph, hair, 0, 1.72, -0.06, 0.07, 0.07, 0.07);
  for (const sx of [-1, 1]) m(PRIM.sphLo, dark, sx * 0.04, 1.56, 0.1, 0.015, 0.02, 0.01);
  const mouth = m(PRIM.sph, new THREE.MeshBasicMaterial({ color: '#7a1f35' }), 0, 1.49, 0.105, 0.03, 0.008, 0.01);
  // one hand on her hip, the other arm points at you
  const armL = new THREE.Group(); armL.position.set(-0.2, 1.32, 0); g.add(armL); const al = new THREE.Mesh(PRIM.cyl, dress); al.scale.set(0.04, 0.32, 0.04); al.position.y = -0.16; armL.add(al); armL.rotation.z = -0.9;
  const armR = new THREE.Group(); armR.position.set(0.2, 1.32, 0); g.add(armR); const ar = new THREE.Mesh(PRIM.cyl, dress); ar.scale.set(0.04, 0.34, 0.04); ar.position.y = -0.17; armR.add(ar); const hd = new THREE.Mesh(PRIM.sphLo, SK); hd.scale.setScalar(0.05); hd.position.y = -0.36; armR.add(hd);
  const e = AREA.edges[D.e]; g.rotation.y = Math.atan2(e.nx, e.nz); g.visible = false; W.root.add(g);
  const cv = document.createElement('canvas'); cv.width = 900; cv.height = 300; const t = new THREE.CanvasTexture(cv);
  const bubble = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, fog: false })); bubble.renderOrder = 9; bubble.position.set(0, 1.95, 0.3); bubble.visible = false; g.add(bubble);
  return { g, armR, mouth, bubble, cv, t, said: '', from: at3(e, D.s, 0, -0.7), to: D.mom };
}
const MOM_LINES = {
  2: ["Oh! You put them ALL away! Good kid! Nap time, sweetie.", "Look at this room! So clean! Who's a good helper? Nap time.", "You cleaned up all by yourself? Good kid! Now, nap."],
  1: ["I told you to clean up your toys! You're grounded! Now, nap.", "What is this mess?! I said clean up! You're grounded, mister!", "Toys everywhere! You're grounded! Nap. Now."],
};
function momLine(W, end) { const L = MOM_LINES[end] || MOM_LINES[1]; return L[W.L.seed % L.length]; }
function drawBubble(M, text) {
  if (M.said === text) return; M.said = text; const x = M.cv.getContext('2d'), w = M.cv.width, h = M.cv.height; x.clearRect(0, 0, w, h);
  x.fillStyle = '#fffdf7'; x.strokeStyle = '#15121a'; x.lineWidth = 10; rr(x, 8, 8, w - 16, h - 60, 40); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(w / 2 - 30, h - 54); x.lineTo(w / 2, h - 8); x.lineTo(w / 2 + 30, h - 54); x.fill(); x.stroke();
  x.fillStyle = '#15121a'; x.textAlign = 'center'; x.font = '800 46px Rubik, sans-serif'; const words = text.split(' '), lines = ['']; for (const wd of words) { const tst = lines[lines.length - 1] + (lines[lines.length - 1] ? ' ' : '') + wd; if (x.measureText(tst).width > w - 80) lines.push(wd); else lines[lines.length - 1] = tst; }
  lines.slice(0, 3).forEach((l, i, a) => x.fillText(l, w / 2, (h - 52) / 2 + (i - (a.length - 1) / 2) * 54 + 16)); M.t.needsUpdate = true;
}
// mom's visits: at the start she tells you to clean up, at two minutes and one minute she checks in,
// and at nap time she steps in and says her piece
const MOM_VISIT_LINES = {
  s: ["You better clean ALL these toys up before nap time!", "Look at this room! Clean it up before nap time, mister!", "Every toy in the toy box before nap time. I mean it!"],
  m120: { tidy: ["Two more minutes! Good job, keep cleaning!", "Two minutes till nap time! It's looking better!"], messy: ["Two minutes! This room is getting WORSE!", "Two minutes till nap! What happened in here?!"] },
  m60: { tidy: ["One minute! Almost nap time, sweetie!", "One more minute! Nearly there!"], messy: ["One minute! I'm coming up to check!", "ONE minute! Those toys better be put away!"] },
};
function momVisitLine(W, id, s) { W.momLines = W.momLines || {}; if (W.momLines[id]) return W.momLines[id]; let L = MOM_VISIT_LINES[id] || MOM_VISIT_LINES.s;
  if (!Array.isArray(L)) L = s.m0 !== undefined && s.ml > s.m0 ? L.messy : L.tidy; return W.momLines[id] = L[W.L.seed % L.length]; }
function drawMom(W, s, dt) {
  if (!W.door) return; const e = AREA.edges[W.L.room.door.e], M = W.mom;
  let open = 0, show = false, k = 0, talk = false, line = null, t = 0;
  if (s.st === 2) { t = s.et; open = clamp((t - 0.8) / 1.0, 0, 1); show = t > 1.3; const q = clamp((t - 1.3) / 1.1, 0, 1); k = q * (2 - q); talk = t > 2.4 && t < 6.5; if (t > 2.4) line = momLine(W, s.end); }
  else { const v = momVisit(s.st, s.cd, s.nap); if (v) { t = v.t; open = t < 0.8 ? t / 0.8 : t < 4.8 ? 1 : Math.max(0, 1 - (t - 4.8) / 0.8);
    const ki = clamp((t - 0.5) / 0.6, 0, 1), ko = clamp((t - 4.0) / 0.7, 0, 1); k = 0.75 * ki * (2 - ki) * (1 - ko); show = t > 0.45 && t < 4.8; talk = t > 1.1 && t < 3.9; if (t > 1.05 && t < 4.3) line = momVisitLine(W, v.id, s); } }
  W.door.open = lerp(W.door.open, open, 1 - Math.exp(-6 * dt)); W.door.g.rotation.y = Math.atan2(-e.dz, e.dx) + W.door.open * 1.7 * W.door.zs;
  if (!M) return; M.g.visible = show; if (!show) { M.bubble.visible = false; return; }
  M.g.position.lerpVectors(M.from, M.to, k); M.g.position.y = Math.abs(Math.sin(t * 7)) * 0.02 * (k > 0.02 && !talk ? 1 : 0);
  M.armR.rotation.x = talk ? -1.4 + Math.sin(t * 6) * 0.15 : -0.2;
  M.mouth.scale.y = talk ? 0.008 + Math.abs(Math.sin(t * 18)) * 0.02 : 0.008;
  M.bubble.visible = !!line; if (line) drawBubble(M, line);
}

function buildToyBox(W) {
  const { w, d, h, t } = BOX, id = W.L.id;
  const col = { bedroom: '#c98a4b', vaneyck: '#e23b2e', noguchi: '#2e5bea', memphis: '#ff3e8a', junk: '#a0703f' }[id], rim = { bedroom: '#e23b2e', vaneyck: '#ffd400', noguchi: '#ffd21f', memphis: '#15121a', junk: '#6e4f33' }[id];
  const parts = [P('box', V(0, h / 2, -d / 2 + t / 2), V(w, h, t), col), P('box', V(0, h / 2, d / 2 - t / 2), V(w, h, t), col), P('box', V(-w / 2 + t / 2, h / 2, 0), V(t, h, d), col), P('box', V(w / 2 - t / 2, h / 2, 0), V(t, h, d), col), P('box', V(0, 0.01, 0), V(w, 0.02, d), '#5a3a2a')];
  for (const z of [-1, 1]) parts.push(P('box', V(0, h + 0.008, z * (d / 2 - t / 2)), V(w + 0.014, 0.018, t + 0.016), rim));
  for (const x of [-1, 1]) parts.push(P('box', V(x * (w / 2 - t / 2), h + 0.008, 0), V(t + 0.016, 0.018, d + 0.014), rim));
  for (const x of [-1, 1]) parts.push(P('box', V(x * (w / 2 + 0.005), h * 0.6, 0), V(0.02, 0.05, 0.14), rim));
  parts.push(P('box', V(0, h + 0.2, -d / 2 - 0.06), V(w, 0.035, d), col, Q().setFromAxisAngle(X_AX, -1.95)));
  const g = new THREE.Group(); g.position.copy(BOX.c); g.rotation.y = BOX.yaw; W.root.add(g);
  const geo = mergeParts(parts.map(p => Object.assign(p, { uv: 2 }))), m = new THREE.Mesh(geo, makeMat(id === 'junk' || id === 'bedroom' ? { t: 'lambert', tex: 'wood' } : id === 'memphis' ? 'toon' : 'lambert'));
  g.add(m); if (W.st.outline || W.st.toyOutline) g.add(new THREE.Mesh(geo, outlineMat(0.007)));
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const tx = new THREE.CanvasTexture(cv);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, w * 0.7 * 192 / 512), new THREE.MeshBasicMaterial({ map: tx, transparent: true })); lab.position.set(0, h * 0.5, d / 2 + 0.003); g.add(lab);
  // a glowing ring over the chest that pulses when you're holding something
  W.boxGlow = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 40), new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false })); W.boxGlow.rotation.x = -Math.PI / 2; W.boxGlow.position.y = h + 0.03; W.boxGlow.scale.set(w * 4.4, d * 4.4, 1); g.add(W.boxGlow);
  W.boxLabel = { cv, tx, draw(n, m0) { const x = cv.getContext('2d'); x.clearRect(0, 0, 512, 192); x.fillStyle = '#fffdf7'; x.strokeStyle = '#15121a'; x.lineWidth = 10; rr(x, 8, 8, 496, 176, 30); x.fill(); x.stroke();
    x.fillStyle = '#15121a'; x.textAlign = 'center'; x.font = '400 56px Bungee, Rubik, sans-serif'; x.fillText('MESS ' + n, 256, 80);
    const d = n - m0; x.font = '800 40px Rubik, sans-serif'; x.fillStyle = n === 0 ? '#00a651' : d >= 0 ? '#e23b2e' : '#00a651'; x.fillText(n === 0 ? 'All clean!' : d >= 0 ? `${d} messier than the start` : `${-d} tidier than the start`, 256, 146); tx.needsUpdate = true; } };
}
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

// devices are drawn at design size inside a group scaled up by K
function buildRoomDevice(W, d0) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true }), o = { d: d0, g: new THREE.Group() }; W.root.add(o.g);
  const mesh = ps => new THREE.Mesh(mergeParts(ps), mat);
  if (d0.type === 'record') {
    o.g.position.copy(d0.c); o.g.rotation.y = d0.yaw;
    o.g.add(mesh([P('box', V(0, 0.142, 0), V(0.42, 0.006, 0.32), '#15121a'), P('cyl6', V(0.16, 0.155, -0.1), V(0.018, 0.02, 0.018), '#c0c4c8'),
      P('box', V(0.12, 0.165, -0.02), V(0.012, 0.01, 0.17), '#c0c4c8', qy(0.35)), P('box', V(0.09, 0.165, 0.065), V(0.025, 0.012, 0.03), '#15121a', qy(0.35))]));
    o.disc = new THREE.Group(); o.disc.position.set(-0.05, 0.15, 0); o.g.add(o.disc);
    o.disc.add(mesh([P('cyl', V(0, 0, 0), V(0.13, 0.008, 0.13), '#1d1a22'), P('ring', V(0, 0.005, 0), V(0.1, 0.1, 0.05), '#2c2832', qx(Math.PI / 2)), P('ring', V(0, 0.005, 0), V(0.07, 0.07, 0.05), '#2c2832', qx(Math.PI / 2)),
      P('cyl', V(0, 0.006, 0), V(0.045, 0.004, 0.045), '#ff3e8a'), P('box', V(0.02, 0.009, 0), V(0.03, 0.002, 0.008), '#ffd400')]));
    o.btn = new THREE.Mesh(PRIM.cyl, new THREE.MeshBasicMaterial({ color: 0x3fbf6f })); o.btn.scale.set(0.028, 0.02, 0.028); o.btn.position.set(0.17, 0.15, 0.12); o.g.add(o.btn);
    o.notes = []; for (let i = 0; i < 4; i++) { const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex(), transparent: true, depthWrite: false, color: ['#ff3e8a', '#ffd400', '#00c2b3', '#9b5cff'][i] })); n.scale.setScalar(0.09); n.visible = false; W.root.add(n); o.notes.push(n); }
  } else {   // the lamp's floor switch, on its cord
    const c = d0.c, sw = d0.sw, mid = V().addVectors(c, sw).multiplyScalar(0.5), len = Math.hypot(sw.x - c.x, sw.z - c.z);
    const cord = mesh([P('box', V(0, 0.006, 0), V(0.012, 0.012, len), '#15121a')]); cord.position.set(mid.x, 0, mid.z); cord.rotation.y = Math.atan2(sw.x - c.x, sw.z - c.z); W.root.add(cord);
    o.g.position.set(sw.x, 0, sw.z); o.g.add(mesh([P('cyl', V(0, 0.014, 0), V(0.06, 0.028, 0.06), '#15121a'), P('cyl', V(0, 0.029, 0), V(0.064, 0.004, 0.064), '#fffdf7')]));
    o.btn = new THREE.Mesh(PRIM.cyl, new THREE.MeshBasicMaterial({ color: 0xff3e8a })); o.btn.scale.set(0.04, 0.02, 0.04); o.btn.position.y = 0.04; o.g.add(o.btn);
  }
  return o;
}
let _noteTex = null;
function noteTex() { return _noteTex || (_noteTex = canvasTex(64, (x, s) => { x.clearRect(0, 0, s, s); x.fillStyle = '#ffffff'; x.font = '900 52px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♪', s / 2, s / 2); })); }
function buildDevice(W, d0) {
  if (d0.type === 'record' || d0.type === 'lamp') return buildRoomDevice(W, d0);
  const d = Object.assign({}, d0); for (const k of ['len', 'w', 'th', 'r', 'h']) if (d[k]) d[k] /= K;
  const mat = W.st.outline ? new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD3 }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  const ol = W.st.outline || W.st.toyOutline ? outlineMat(0.004) : null;
  const mesh = (parts) => { const geo = mergeParts(parts), m = new THREE.Mesh(geo, mat); if (ol) m.add(new THREE.Mesh(geo, ol)); return m; };
  const o = { d: d0, g: new THREE.Group() }; o.g.scale.setScalar(K); W.root.add(o.g);
  if (d.type === 'seesaw') {
    o.g.position.copy(d0.c); o.g.rotation.y = d.yaw; o.arm = new THREE.Group(); o.g.add(o.arm);
    const ps = [P('box', V(0, d.th / 2, 0), V(d.len, d.th, d.w), d.col)];
    for (const x of [-1, 1]) { ps.push(P('cyl6', V(x * (d.len / 2 - 0.08), 0.045, 0), V(0.008, 0.08, 0.008), '#15121a')); ps.push(P('cyl6', V(x * (d.len / 2 - 0.08), 0.085, 0), V(0.008, d.w * 0.8, 0.008), '#15121a', qx(Math.PI / 2))); }
    o.arm.add(mesh(ps));
  } else if (d.type === 'mgr') {
    o.g.position.copy(d0.c); const ps = [P('cyl', V(0, d.h / 2 + 0.01, 0), V(d.r, d.h, d.r), d.col), P('cyl', V(0, d.h + 0.012, 0), V(d.r * 0.25, 0.006, d.r * 0.25), '#ffd400')];
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ps.push(P('box', V(Math.cos(a) * d.r * 0.55, d.h + 0.012, Math.sin(a) * d.r * 0.55), V(d.r * 0.9, 0.004, 0.03), i % 2 ? '#15121a' : '#fffdf7', qy(-a)));
      const p0 = V(Math.cos(a) * d.r * 0.75, d.h, Math.sin(a) * d.r * 0.75); ps.push(P('cyl6', V(p0.x, d.h + 0.06, p0.z), V(0.007, 0.12, 0.007), '#2f5cff')); }
    ps.push(P('ring', V(0, d.h + 0.12, 0), V(d.r * 0.75, d.r * 0.75, d.r * 0.75 * 0.6), '#2f5cff', qx(Math.PI / 2)), P('cyl6', V(0, 0.005, 0), V(0.04, 0.01, 0.04), '#15121a'));
    o.arm = mesh(ps); o.g.add(o.arm);
  } else if (d.type === 'swing') {
    o.g.position.copy(d0.pivot); o.g.rotation.y = d.yaw; o.arm = new THREE.Group(); o.g.add(o.arm);
    const tire = d.look === 'tire', ps = [], len = d.len;
    if (tire) { ps.push(P('tor', V(0, -len, 0), V(0.07, 0.07, 0.08), '#2a2a2c', qx(Math.PI / 2))); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; ps.push(P('cyl6', V(Math.cos(a) * 0.035, -len / 2, Math.sin(a) * 0.035), V(0.003, len, 0.003), '#d9c49a')); } }
    else { ps.push(P('box', V(0, -len, 0), V(0.14, 0.016, 0.09), d.col)); for (const x of [-0.06, 0.06]) ps.push(P('cyl6', V(x, -len / 2, 0), V(0.003, len, 0.003), '#5b5f66')); }
    o.arm.add(mesh(ps));
  } else if (d.type === 'mbox') {
    o.g.position.copy(d0.c); o.g.rotation.y = d.yaw; const ps = [], C = d.col;
    if (d.look === 'kiosk') ps.push(P('box', V(0, 0.05, 0), V(0.15, 0.1, 0.11), '#fffdf7'), P('cone', V(0, 0.14, 0), V(0.11, 0.08, 0.11), C, qy(Math.PI / 4)));
    else if (d.look === 'cube') ps.push(P('box', V(0, 0.05, 0), V(0.15, 0.1, 0.11), C), P('cyl', V(0, 0.05, 0.056), V(0.035, 0.004, 0.035), '#ffd21f', qx(Math.PI / 2)));
    else if (d.look === 'jukebox') ps.push(P('box', V(0, 0.045, 0), V(0.15, 0.09, 0.11), C), P('cyl', V(0, 0.09, 0), V(0.075, 0.11, 0.075), '#ffd400', qx(Math.PI / 2)), P('box', V(0, 0.05, 0.056), V(0.1, 0.05, 0.004), '#00c2b3'));
    else ps.push(P('box', V(0, 0.05, 0), V(0.15, 0.1, 0.11), C), P('cyl', V(-0.03, 0.05, 0.056), V(0.03, 0.004, 0.03), '#2a2a2c', qx(Math.PI / 2)), P('cyl6', V(0.05, 0.15, 0), V(0.003, 0.12, 0.003), '#c0c4c8', qz(0.3)));
    for (let i = 0; i < 3; i++) ps.push(P('sphLo', V(-0.04 + i * 0.04, 0.115 + (d.look === 'kiosk' ? 0.07 : 0), 0.0), V(0.006, 0.006, 0.006), '#15121a'));
    o.g.add(mesh(ps));
    o.crank = new THREE.Group(); o.crank.position.set(0.085, 0.07, 0); o.g.add(o.crank);
    o.crank.add(mesh([P('cyl6', V(0.012, 0, 0), V(0.006, 0.025, 0.006), '#c0c4c8', qz(Math.PI / 2)), P('box', V(0.025, 0.018, 0), V(0.006, 0.04, 0.006), '#c0c4c8'), P('cyl6', V(0.035, 0.036, 0), V(0.008, 0.02, 0.008), '#e23b2e', qz(Math.PI / 2))]));
    o.dots = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(PRIM.sphLo, new THREE.MeshBasicMaterial({ color: 0xcfc8d8 })); const a = i / 8 * TAU; m.position.set(Math.cos(a) * 0.07, 0.26, Math.sin(a) * 0.07); m.scale.setScalar(0.012); o.g.add(m); o.dots.push(m); }
  }
  return o;
}

/* ---------- bodies ---------- */
const TOY_GEO = {}, PART_GEO = {};
function toyGeo(kind, r) { const k = kind + ':' + r; return TOY_GEO[k] || (TOY_GEO[k] = mergeParts(TOYS[kind].build(r))); }
function partGeo(L, kind, colIdx) {
  const P0 = L.parts[kind], r = P0.r, col = P0.cols[colIdx % P0.cols.length], key = L.id + kind + ':' + colIdx + ':' + r; if (PART_GEO[key]) return PART_GEO[key];
  let ps;
  switch (P0.shape) {
    case 'sph': ps = [P('sph', V(), V(r, r, r), col), P('ring', V(), V(r * 1.0, r * 1.0, r * 1.4), '#fffdf7', qx(Math.PI / 2))]; break;
    case 'box': ps = [P('box', V(), V(r * 1.55, r * 1.55, r * 1.55), col)]; break;
    case 'bucket': ps = [P('cyl', V(0, -r * 0.1, 0), V(r * 0.85, r * 1.5, r * 0.85), col), P('ring', V(0, r * 0.4, 0), V(r * 0.85, r * 0.85, r * 0.85), '#fffdf7', qx(Math.PI / 2)), P('ring', V(0, r * 0.55, 0), V(r * 0.7, r * 0.7, r * 0.7), '#15121a')]; break;
    case 'ring': ps = [P('tor', V(), V(r * 0.75, r * 0.75, r * 0.9), col)]; break;
    case 'cone': ps = [P('cone', V(0, r * 0.1, 0), V(r * 0.85, r * 1.6, r * 0.85), col), P('box', V(0, -r * 0.75, 0), V(r * 1.6, r * 0.15, r * 1.6), '#fffdf7')]; break;
    case 'can': ps = [P('cyl', V(), V(r * 0.7, r * 1.7, r * 0.7), col), P('cyl', V(0, r * 0.86, 0), V(r * 0.72, r * 0.05, r * 0.72), '#9aa3a8'), P('cyl', V(0, 0, 0), V(r * 0.72, r * 0.5, r * 0.72), '#fffdf7')]; break;
    case 'tire': ps = [P('tor', V(), V(r * 0.75, r * 0.75, r * 0.95), col)]; break;
    case 'abc': { const L = colIdx % 16, q = qy(0); ps = [Object.assign(P('box', V(), V(r * 1.9, r * 1.9, r * 1.9), col, q), { uv: 0.25, uo: (L % 4) * 0.25, vo: Math.floor(L / 4) * 0.25 })]; break; }
    case 'food': switch (colIdx % 6) {
      case 0: ps = [P('cyl', V(0, -r * 0.5, 0), V(r * 1.0, r * 0.3, r * 1.0), '#c98a4b')]; for (let i = 0; i < 5; i++) { const a = i * 2.4; ps.push(P('sphLo', V(Math.cos(a) * r * 0.55, -r * 0.33, Math.sin(a) * r * 0.55), V(r * 0.13, r * 0.08, r * 0.13), '#4a2a14')); } break;   // cookie
      case 1: ps = [P('sph', V(0, -r * 0.1, 0), V(r * 0.85, r * 0.8, r * 0.85), '#e23b2e'), P('cyl6', V(0, r * 0.75, 0), V(r * 0.06, r * 0.3, r * 0.06), '#5a3a1a'), P('sphLo', V(r * 0.2, r * 0.75, 0), V(r * 0.25, r * 0.08, r * 0.14), '#3fbf6f', qz(0.4))]; break;   // apple
      case 2: ps = [P('sph', V(0, -r * 0.3, 0), V(r * 1.1, r * 0.35, r * 0.4), '#ffd400', qy(0.3)), P('cyl6', V(r * 1.0, -r * 0.2, r * 0.3), V(r * 0.08, r * 0.15, r * 0.08), '#5a3a1a', qz(1.2))]; break;   // banana
      case 3: ps = [P('box', V(0, -r * 0.62, 0), V(r * 1.4, r * 0.18, r * 1.0), '#f3d39a'), P('box', V(0, -r * 0.48, 0), V(r * 1.45, r * 0.1, r * 1.05), '#3fbf6f'), P('box', V(0, -r * 0.4, 0), V(r * 1.4, r * 0.08, r * 1.0), '#e23b2e'), P('box', V(0, -r * 0.28, 0), V(r * 1.4, r * 0.18, r * 1.0), '#f3d39a')]; break;   // sandwich
      case 4: ps = [P('cyl', V(0, -r * 0.45, 0), V(r * 0.6, r * 0.55, r * 0.6), '#7fd6ff'), P('sph', V(0, r * 0.0, 0), V(r * 0.72, r * 0.5, r * 0.72), '#ff8fc7'), P('sphLo', V(0, r * 0.5, 0), V(r * 0.16, r * 0.16, r * 0.16), '#e23b2e')]; break;   // cupcake
      default: ps = []; for (let i = 0; i < 7; i++) { const a = i * 1.7, y = -r * 0.6 + (i > 3 ? r * 0.35 : 0) + (i === 6 ? r * 0.35 : 0); ps.push(P('sphLo', V(Math.cos(a) * r * (i === 6 ? 0 : 0.35), y, Math.sin(a) * r * (i === 6 ? 0 : 0.35)), V(r * 0.3, r * 0.3, r * 0.3), '#9b5cff')); }   // grapes
    } break;
    case 'cup': ps = [P('cyl', V(0, -r * 0.1, 0), V(r * 0.75, r * 1.8, r * 0.75), col), P('cyl', V(0, r * 0.79, 0), V(r * 0.66, r * 0.02, r * 0.66), '#15121a'), P('ring', V(0, r * 0.8, 0), V(r * 0.75, r * 0.75, r * 0.75), '#fffdf7', qx(Math.PI / 2))]; break;
    case 'crayon': ps = [P('cyl6', V(), V(r * 0.38, r * 3.2, r * 0.38), col), P('cone', V(0, r * 1.9, 0), V(r * 0.38, r * 0.6, r * 0.38), col), P('cyl6', V(0, -r * 0.2, 0), V(r * 0.4, r * 1.6, r * 0.4), '#fffdf7')]; break;
    case 'book': ps = [P('box', V(), V(r * 0.6, r * 1.9, r * 1.4), col), P('box', V(0, 0, r * 0.06), V(r * 0.5, r * 1.8, r * 1.3), '#fffdf7'), P('box', V(0, r * 0.5, 0), V(r * 0.62, r * 0.12, r * 1.42), '#ffd400')]; break;
  }
  return PART_GEO[key] = mergeParts(ps);
}
function buildBody(W, r, i) {
  const [type, kind, rad, col] = r, o = { i, type, kind, r: rad, g: new THREE.Group() };
  const geo = type === 1 ? partGeo(W.L, kind, col) : toyGeo(kind, rad);
  const m = new THREE.Mesh(geo, W.L.parts[kind] && type === 1 && W.L.parts[kind].tex ? (W.partTexMat || (W.partTexMat = makeMat({ t: 'lambert', tex: W.L.parts[kind].tex }))) : W.toyMat);
  o.g.add(m); o.body = m; if (W.toyOl) m.add(new THREE.Mesh(geo, W.toyOl));
  if (type === 2) { m.material = W.toyMat.clone(); m.material.transparent = true; m.material.opacity = 0.75; }
  if (type === 0) {
    o.stars = new THREE.Group(); for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(rad * 0.18), new THREE.MeshBasicMaterial({ color: 0xffd400 })); const a = k / 3 * TAU; s.position.set(Math.cos(a) * rad * 0.8, 0, Math.sin(a) * rad * 0.8); o.stars.add(s); }
    o.stars.position.y = rad * 1.5; o.stars.visible = false; o.g.add(o.stars);
    o.drool = new THREE.Mesh(PRIM.sphLo, new THREE.MeshLambertMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.7, emissive: 0x204060 })); o.drool.scale.set(rad * 0.9, rad * 0.35, rad * 0.9); o.drool.position.y = -rad * 0.7; o.drool.visible = false; o.g.add(o.drool);
    o.mark = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.35, rad * 0.6, 4), new THREE.MeshBasicMaterial({ color: 0xff3e8a })); o.mark.position.y = rad * 2.6; o.mark.visible = false; o.g.add(o.mark);
    const key = TOYS[kind].key;
    if (key === 'heli' || key === 'plane') { o.prop = new THREE.Mesh(new THREE.BoxGeometry(key === 'heli' ? rad * 2.4 : rad * 0.08, rad * 0.03, key === 'heli' ? rad * 0.14 : rad * 0.9), new THREE.MeshBasicMaterial({ color: 0x15121a })); o.prop.position.set(0, key === 'heli' ? rad * 0.86 : 0, key === 'heli' ? 0 : rad * 1.15); o.g.add(o.prop); }
    if (key === 'rocket') { o.flame = new THREE.Mesh(PRIM.cone, new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.85 })); o.flame.scale.set(rad * 0.3, rad * 0.8, rad * 0.3); o.flame.rotation.x = Math.PI; o.flame.position.y = -rad * 1.4; o.flame.visible = false; o.g.add(o.flame); }
  }
  W.root.add(o.g); return o;
}
function buildProj(W) {
  const mk = (k) => { const g = new THREE.Group();
    if (k === 'missile') { const b = new THREE.Mesh(PRIM.cyl, new THREE.MeshLambertMaterial({ color: '#ff7a1a' })); b.scale.set(0.018, 0.09, 0.018); b.rotation.x = Math.PI / 2; g.add(b); const n = new THREE.Mesh(PRIM.sph, new THREE.MeshLambertMaterial({ color: '#e23b2e' })); n.scale.setScalar(0.02); n.position.z = 0.045; g.add(n); }
    else if (k === 'ball') { const b = new THREE.Mesh(PRIM.sph, new THREE.MeshLambertMaterial({ color: '#2a2a2c' })); b.scale.setScalar(0.04); g.add(b); }
    else if (k === 'bubble') { const b = new THREE.Mesh(PRIM.sph, new THREE.MeshLambertMaterial({ color: '#d6f5ff', transparent: true, opacity: 0.35, emissive: '#5a7fff', emissiveIntensity: 0.3 })); b.scale.setScalar(0.035); g.add(b); }
    else { const b = new THREE.Mesh(PRIM.cyl, new THREE.MeshLambertMaterial({ color: '#ff7a1a' })); b.scale.set(0.008, 0.06, 0.008); b.rotation.x = Math.PI / 2; g.add(b); const n = new THREE.Mesh(PRIM.sphLo, new THREE.MeshLambertMaterial({ color: '#2f5cff' })); n.scale.setScalar(0.011); n.position.z = 0.03; g.add(n); }
    g.visible = false; W.root.add(g); return g; };
  W.proj = { pools: PROJ.map(k => Array.from({ length: 10 }, () => mk(k))) };
}

/* ---------- the giant toddler ---------- */
const HAND_SCALE = 2.0;   // the toddler's hands, drawn twice life size
function buildToddler(W) {
  const SK = '#ffd2b8', T = { g: new THREE.Group() };
  const skin = new THREE.MeshLambertMaterial({ color: SK }), dark = new THREE.MeshBasicMaterial({ color: 0x2a1a22 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const onesie = new THREE.MeshLambertMaterial({ map: tex('onesie') });
  T.skin = skin;
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
  // chubby mitts: palm down (-y), fingers forward (-z); each finger has 2 joints that curl toward the palm
  T.hands = [0, 1].map(i => {
    const g = new THREE.Group(), s = new THREE.Group(); s.scale.setScalar(HAND_SCALE); g.add(s); const palm = new THREE.Mesh(PRIM.sph, skin); palm.scale.set(0.042, 0.026, 0.05); s.add(palm); g.fingers = [];
    for (let k = 0; k < 4; k++) { const f = new THREE.Group(); f.position.set((k - 1.5) * 0.018, 0.0, -0.045); const f1 = new THREE.Mesh(PRIM.sphLo, skin); f1.scale.set(0.009, 0.009, 0.014); f1.position.z = -0.01; f.add(f1);
      const j2 = new THREE.Group(); j2.position.z = -0.02; const f2 = new THREE.Mesh(PRIM.sphLo, skin); f2.scale.set(0.0085, 0.0085, 0.013); f2.position.z = -0.009; j2.add(f2); f.add(j2); f.j2 = j2; s.add(f); g.fingers.push(f); }
    const th = new THREE.Group(); th.position.set((i === 0 ? -1 : 1) * 0.04, -0.004, -0.012); const tm = new THREE.Mesh(PRIM.sphLo, skin); tm.scale.set(0.011, 0.011, 0.022); tm.position.set((i === 0 ? -1 : 1) * 0.006, 0, -0.013); th.add(tm); s.add(th); g.thumb = th; g.side = i === 0 ? -1 : 1;
    T.g.add(g); return g;
  });
  // the balls above only place things now; what you see is one squishy blob body and two blob hands
  for (const m of [T.chest, T.butt, ...T.arms, ...T.legs, ...T.feet]) m.visible = false;
  for (const g of T.hands) g.traverse(o => { if (o.isMesh) o.visible = false; });
  T.head.scale.setScalar(1.08);
  const bm = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  T.blob = makeBlob(30, bm, 0.025); T.g.add(T.blob.mesh);
  // the chubby hands (Taffy Strata's): index 0 is the right hand, 1 the left
  const hmat = new THREE.MeshLambertMaterial({ color: SK }); T.sk = [makeHandMesh(1, hmat, W.root), makeHandMesh(-1, hmat, W.root)]; T.wrist = [V(), V()]; T.curls = [0, 0, 0, 0, 0];
  T.cSkin = new THREE.Color(SK); T.cOne = new THREE.Color('#5fb4ff'); T.cOne2 = new THREE.Color('#bfe3ff'); T.k = 0;
  W.root.add(T.g); return T;
}
// in the headset: giant hands that follow your real fingers (hand tracking)
const HJ = ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip', 'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip', 'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'];
const HBONES = []; for (const f of [[1, 2, 3, 4], [6, 7, 8, 9], [11, 12, 13, 14], [16, 17, 18, 19], [21, 22, 23, 24]]) for (let i = 0; i < f.length - 1; i++) HBONES.push([f[i], f[i + 1]]);
// blob balls for one hand: from tracked joints (headset) or from the posed mitt (controllers, phones)
const _hb = V();
function handBalls(T, h, joints, out) {
  const S = T.cSkin;
  if (joints) { const J = joints.j;
    for (const k of [3, 4, 7, 9, 12, 14, 17, 19, 22, 24]) out.push({ x: J[k].x, y: J[k].y, z: J[k].z, r: 0.026 * HAND_SCALE / 2, c: S });
    for (const t of [0.2, 0.5, 0.8]) for (const m of [6, 16]) { _hb.copy(J[0]).lerp(J[m], t); out.push({ x: _hb.x, y: _hb.y, z: _hb.z, r: 0.034 * HAND_SCALE / 2, c: S }); }
    out.push({ x: J[0].x, y: J[0].y, z: J[0].z, r: 0.03 * HAND_SCALE / 2, c: S }); return out; }
  const g = T.hands[h]; g.updateMatrixWorld(true); const W = (x, y, z, r) => { g.localToWorld(_hb.set(x, y, z)); out.push({ x: _hb.x, y: _hb.y, z: _hb.z, r, c: S }); };
  const hs = HAND_SCALE; W(0, 0, 0.005 * hs, 0.034 * hs); W(0, 0, -0.022 * hs, 0.03 * hs); W(0, 0, 0.045 * hs, 0.026 * hs);
  for (const f of g.fingers) { f.j2.children[0].getWorldPosition(_hb); out.push({ x: _hb.x, y: _hb.y, z: _hb.z, r: 0.013 * hs, c: S }); }
  g.thumb.children[0].getWorldPosition(_hb); out.push({ x: _hb.x, y: _hb.y, z: _hb.z, r: 0.012 * hs, c: S });
  return out;
}
const _qa = Q(), _qb = Q(), _va = V(), _vb = V();
function setArm(m, a, b, r) { const d = _vb.subVectors(b, a), L = d.length(); m.position.addVectors(a, b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(Y_AX, d.divideScalar(L || 1)); m.scale.set(r, L, r); }

/* ---------- draw a snapshot (s1 blended toward s2 by k, if given) ---------- */
function lp(a, b, i, k) { return b ? a[i] + (b[i] - a[i]) * k : a[i]; }
function drawSnap(W, s, s2, k, me, dt) {
  const B = s.b, B2 = s2 && s2.b, viewer = me.viewer, now = performance.now();
  W.darkOn = s.dk > 0 && s.st === 1; W.darkMin = viewer === 'toddler' ? 0.1 : 0.4; W.darkFog = viewer === 'toddler' ? [0.2, 3.0] : [1, 8];
  let sh = 0; const dummy = drawSnap.d || (drawSnap.d = new THREE.Object3D());
  for (let i = 0; i < W.bodies.length; i++) {
    const o = W.bodies[i], j = i * 8, f = B[j + 7];
    if (f & 1) { o.g.visible = false; continue; } o.g.visible = true;
    const kk = B2 && (B2[j + 7] & 1) !== (f & 1) ? 0 : k;
    o.g.position.set(lp(B, B2, j, kk), lp(B, B2, j + 1, kk), lp(B, B2, j + 2, kk));
    _qa.set(B[j + 3], B[j + 4], B[j + 5], B[j + 6]); if (B2 && kk) { _qb.set(B2[j + 3], B2[j + 4], B2[j + 5], B2[j + 6]); _qa.slerp(_qb, kk); } o.g.quaternion.copy(_qa.normalize());
    o.g.scale.setScalar(f & 128 ? 0.55 : 1);
    if (o.stars) {
      o.stars.visible = !!(f & 2); if (f & 2) o.stars.rotation.y = now / 150;
      o.drool.visible = !!(f & 4);
      const mine = me.body === i, mate = !mine && !!(f & 64) && viewer === 'toy';
      o.mark.visible = mine || mate; if (o.mark.visible) { o.mark.material.color.set(mine ? '#ffd400' : (me.slotOf && me.slotOf[i] === 1 ? '#00c2b3' : '#ff3e8a')); o.mark.position.y = o.r * 2.6 + Math.sin(now / 200) * o.r * 0.2; o.mark.quaternion.copy(o.g.quaternion).invert(); o.mark.rotateX(Math.PI); }
      if (o.prop) o.prop.rotation[TOYS[o.kind].key === 'heli' ? 'y' : 'z'] += (f & 32 ? 0.9 : 0.15);
      if (o.flame) { o.flame.visible = !!(f & 32); o.flame.scale.y = o.r * (0.6 + Math.random() * 0.5); if (o.flame.visible && Math.random() < 0.5) fxPuff(W.fx, o.g.position, '#d9d3cc', 1, 0.2, 0.02, 0.8, -0.2); }
      if (f & 16 && Math.random() < 0.3) fxPuff(W.fx, o.g.position, '#ffffff', 1, 0.3, 0.006);
    }
    const p = o.g.position, gh = W.L.groundH(p.x, p.z), hgt = Math.max(0, p.y - o.r - gh), sz = o.r * 2.4 * (1 + hgt * 1.5);
    dummy.position.set(p.x, gh + 0.006, p.z); dummy.quaternion.identity(); dummy.scale.set(sz, 1, sz); dummy.updateMatrix(); W.shadows.setMatrixAt(sh++, dummy.matrix);
  }
  // toddler
  const T = s.td, T2 = s2 && s2.td, td = W.td, L = n => lp(T, T2, n, k);
  td.head.position.set(L(0), L(1), L(2)); _qa.set(T[3], T[4], T[5], T[6]); if (T2) { _qb.set(T2[3], T2[4], T2[5], T2[6]); _qa.slerp(_qb, k); } td.head.quaternion.copy(_qa);
  for (let h = 0; h < 2; h++) { const o = TD.H0 + h * TD.HS, g = td.hands[h], fl = T[o + 7];
    g.position.set(L(o), L(o + 1), L(o + 2)); _qa.set(T[o + 3], T[o + 4], T[o + 5], T[o + 6]); if (T2) { _qb.set(T2[o + 3], T2[o + 4], T2[o + 5], T2[o + 6]); _qa.slerp(_qb, k); } g.quaternion.copy(_qa);
    g.visible = !!(fl & 2); const HM = td.sk[h]; HM.mesh.visible = g.visible;
    if (g.visible) { const J = viewer === 'toddler' && me.joints && me.joints[h];   // your own tracked fingers, or the five finger curls everyone else gets
      if (J) { poseHandMesh(HM, J.j, HAND_SCALE * 1.1); td.wrist[h].copy(J.j[0]); }
      else { for (let f = 0; f < 5; f++) td.curls[f] = T[o + 8 + f]; td.wrist[h].copy(poseCurledHand(HM, g.position, g.quaternion, td.curls, HAND_SCALE, HAND_SCALE * 1.1)); } }
    if (fl & 4 && Math.random() < 0.15) fxPuff(W.fx, g.position, '#ffd400', 1, 0.5, 0.01); }
  td.chest.position.set(L(TD.CHEST), L(TD.CHEST + 1), L(TD.CHEST + 2)); td.butt.position.set(L(TD.BUTT), L(TD.BUTT + 1), L(TD.BUTT + 2));
  const mouth = T[TD.MOUTH], sleepy = T[TD.SLEEPY], giggle = T[TD.GIGGLE];
  td.mouth.scale.set(0.03 + mouth * 0.012 + giggle * 0.01, 0.008 + mouth * 0.04 + (giggle > 0 ? 0.02 + Math.sin(now / 50) * 0.01 : 0), 0.012);
  const lid = Math.max(sleepy, T[TD.DROWSY] || 0); for (const l of td.lids) { l.scale.y = 0.04 * (lid > 0.2 ? lid : 0.05); l.visible = lid > 0.2; }
  const spooky = s.ph === 2 && s.st === 1; for (const p of td.pupils) p.scale.set(spooky ? 0.024 : 0.019, spooky ? 0.03 : 0.024, 0.012);
  td.brows.forEach((b, i) => { b.rotation.z = spooky ? (i ? 0.45 : -0.45) : 0; });
  const hq = td.head.quaternion, side = _va.set(1, 0, 0).applyQuaternion(hq); side.y = 0; side.normalize();
  for (let h = 0; h < 2; h++) { const sx = h === 0 ? 1 : -1, sh0 = td.chest.position.clone().addScaledVector(side, sx * 0.12); sh0.y += 0.04; setArm(td.arms[h], sh0, td.hands[h].visible ? td.wrist[h] : td.hands[h].position, 0.045); }
  const back = V().subVectors(td.butt.position, td.chest.position); back.y = 0; back.normalize();
  for (let h = 0; h < 2; h++) { const sx = h === 0 ? 1 : -1, lg = td.legs[h], ft = td.feet[h]; lg.position.copy(td.butt.position).addScaledVector(side, sx * 0.08).addScaledVector(back, 0.12); lg.position.y = Math.max(0.06, td.butt.position.y - 0.08);
    lg.quaternion.setFromUnitVectors(Z_AX, back); ft.position.copy(lg.position).addScaledVector(back, 0.12); ft.position.y = Math.max(0.035, lg.position.y - 0.02); ft.quaternion.copy(lg.quaternion); }
  const self = viewer === 'toddler'; td.head.visible = !self;
  // one meatball body: head, chest, belly, bum, arms, legs, feet melt together
  if (!self && (td.k = (td.k + 1) % 2) === 0) { const balls = [], push = (p, r, c) => balls.push({ x: p.x, y: p.y, z: p.z, r, c });
    push(_vb.lerpVectors(td.head.position, td.chest.position, 0.6), 0.1, td.cOne); push(td.chest.position, 0.19, td.cOne); push(td.butt.position, 0.18, td.cOne); push(_vb.lerpVectors(td.chest.position, td.butt.position, 0.5), 0.18, td.cOne2);
    for (let h = 0; h < 2; h++) { const lg = td.legs[h].position, ft = td.feet[h].position; push(lg, 0.085, td.cOne); push(_vb.lerpVectors(lg, ft, 0.5), 0.07, td.cOne); push(ft, 0.065, td.cSkin);
      if (!td.hands[h].visible) continue; const a = td.arms[h], top = V(0, 0.5, 0).applyQuaternion(a.quaternion).multiplyScalar(a.scale.y).add(a.position), bot = V(0, -0.5, 0).applyQuaternion(a.quaternion).multiplyScalar(a.scale.y).add(a.position);
      for (const t of [0, 0.3, 0.6, 0.85]) push(_vb.lerpVectors(bot, top, t), lerp(0.075, 0.055, t), t > 0.8 ? td.cSkin : td.cOne); }
    td.blob.update(balls); }
  td.blob.mesh.visible = !self;
  for (const p of [td.chest.position, td.butt.position]) { const gh = W.L.groundH(p.x, p.z); dummy.position.set(p.x, gh + 0.006, p.z); dummy.scale.set(0.5, 1, 0.5); dummy.updateMatrix(); W.shadows.setMatrixAt(sh++, dummy.matrix); }
  for (let h = 0; h < 2; h++) { const p = td.hands[h].position, gh = W.L.groundH(p.x, p.z), hg = Math.max(0, p.y - gh); dummy.position.set(p.x, gh + 0.006, p.z); dummy.scale.setScalar(0.22 * (1 + hg)); dummy.updateMatrix(); W.shadows.setMatrixAt(sh++, dummy.matrix); }
  W.shadows.count = sh; W.shadows.instanceMatrix.needsUpdate = true;
  // projectiles
  const use = PROJ.map(() => 0);
  for (let i = 0; i < (s.pr || []).length; i += 7) { const kI = s.pr[i], pool = W.proj.pools[kI], g = pool[use[kI]++ % pool.length]; g.visible = true; g.position.set(s.pr[i + 1], s.pr[i + 2], s.pr[i + 3]);
    _va.set(s.pr[i + 4], s.pr[i + 5], s.pr[i + 6]); if (_va.lengthSq() > 1e-4) g.quaternion.setFromUnitVectors(Z_AX, _va.normalize()); }
  W.proj.pools.forEach((pool, kI) => { for (let i = use[kI]; i < pool.length; i++) pool[i].visible = false; });
  // devices
  s.dv.forEach((v, i) => { const o = W.devs[i]; if (!o) return; const v2 = s2 && s2.dv[i];
    if (o.d.type === 'seesaw') o.arm.rotation.z = v2 !== undefined ? lerp(v, v2, k) : v;
    else if (o.d.type === 'mgr') o.arm.rotation.y = -(v2 !== undefined ? v + (v2 - v) * k : v);
    else if (o.d.type === 'swing') o.arm.rotation.x = v2 !== undefined ? lerp(v, v2, k) : v;
    else if (o.d.type === 'record') { o.disc.rotation.y = -v[1]; const t = now / 1000; o.btn.material.color.set(v[0] ? '#ffd400' : v[2] ? '#6a6470' : (Math.sin(t * 6) > 0 ? '#3fbf6f' : '#bff5d6'));
      o.notes.forEach((n, j) => { n.visible = !!v[0]; if (!v[0]) return; const ph = (t * 0.5 + j / 4) % 1; n.position.copy(o.d.c).add(_va.set(Math.sin(t * 2 + j * 1.7) * 0.12, 0.25 + ph * 0.6, Math.cos(t * 1.6 + j) * 0.12)); n.material.opacity = Math.sin(ph * Math.PI); }); }
    else if (o.d.type === 'lamp') { const t = now / 1000; o.btn.material.color.set(!v[0] ? '#15121a' : v[1] ? '#6a6470' : (Math.sin(t * 6) > 0 ? '#ff3e8a' : '#ffc2d6')); o.btn.position.y = v[0] ? 0.04 : 0.032; }
    else if (o.d.type === 'mbox') { o.crank.rotation.x = v[1]; o.dots.forEach((m, j) => m.material.color.set(v[2] ? '#cfc8d8' : j < Math.round(v[0] * 8) ? '#ffd400' : '#6a6470')); } });
  W.walls.forEach((m, i) => { const w = s.tw[i]; m.visible = !!w; if (w) { m.position.set(w[0], w[1], w[2]); m.rotation.y = w[3]; m.scale.y = Math.min(1, w[4] * 3); } });
  if (s.ml !== W.lastMl || s.m0 !== W.lastM0) { W.lastMl = s.ml; W.lastM0 = s.m0; W.boxLabel.draw(s.ml, s.m0 === undefined ? s.ml : s.m0); }
  // the chest glows when the toddler is carrying something
  const carrying = (T[TD.H0 + 7] & 8) || (T[TD.H0 + TD.HS + 7] & 8); W.boxGlow.material.opacity = carrying && s.st === 1 ? 0.45 + Math.sin(now / 160) * 0.3 : 0;
  // clock face, TV
  if (W.clock) { const n = s.st === 0 ? MATCH_TIME : s.nap, sec = Math.ceil(n); if (sec !== W.clock.last) { W.clock.last = sec; W.clock.draw(n); }
    W.clock.big.rotation.z = -(1 - clamp(n / MATCH_TIME, 0, 1)) * TAU; W.clock.sec.rotation.z = -((MATCH_TIME - sec) % 60) / 60 * TAU; }
  if (W.tv && (W.tv.k = (W.tv.k + 1) % 6) === 0) { const x = W.tv.cv.getContext('2d'), C = W.th.acc; for (let i = 0; i < 8; i++) { x.fillStyle = C[(i + Math.floor(now / 300)) % C.length]; x.fillRect(i * 16, 0, 16, 72); } x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.arc(64 + Math.sin(now / 400) * 40, 36 + Math.cos(now / 300) * 14, 10, 0, TAU); x.fill(); W.tv.t.needsUpdate = true; }
  drawMom(W, s, dt || 0.016);
}

/* ---------- phase lighting: epic, silly, spooky, sleepy ---------- */
const PH_TINT = [
  { hemi: 0.95, sun: 1.3, fog: '#ffcf9e', mix: 0.1, sky: '#9fd4ff' },
  { hemi: 1.1, sun: 1.0, fog: '#ffffff', mix: 0.0, sky: '#8fe0ff' },
  { hemi: 0.45, sun: 0.25, fog: '#2a2340', mix: 0.55, sky: '#2a2350' },
  { hemi: 0.9, sun: 0.6, fog: '#cdbaf2', mix: 0.35, sky: '#ffa9c8' },
];
function phaseLight(W, scene, ph, playing, dt) {
  const t = PH_TINT[playing ? ph : 1], k = Math.min(1, dt * 1.2), c = new THREE.Color(), b = W.base;
  // lights out (a toy hit the lamp switch): the toddler can barely see, the phones see a little
  W.darkAmt = lerp(W.darkAmt || 0, W.darkOn ? 1 : 0, Math.min(1, dt * 4)); const da = W.darkAmt, dk = lerp(1, W.darkMin || 0.35, da);
  W.phI = W.phI || { hemi: W.light.hemi.intensity, sun: W.light.sun.intensity }; W.phI.hemi = lerp(W.phI.hemi, b.hemi * t.hemi, k); W.phI.sun = lerp(W.phI.sun, b.sun * t.sun, k);
  W.light.hemi.intensity = W.phI.hemi * dk; W.light.sun.intensity = W.phI.sun * dk; W.light.amb.intensity = 0.12 * (0.5 + 0.5 * dk);
  W.fogC = W.fogC || scene.fog.color.clone(); W.bgC = W.bgC || scene.background.clone();
  c.copy(b.fog).lerp(new THREE.Color(t.fog), t.mix); W.fogC.lerp(c, k); c.copy(b.bg).lerp(new THREE.Color(t.fog), t.mix); W.bgC.lerp(c, k);
  const night = new THREE.Color('#0b0a1c'), df = W.darkFog || [1, 7]; scene.fog.color.copy(W.fogC).lerp(night, da * 0.9); scene.background.copy(W.bgC).lerp(night, da * 0.9);
  scene.fog.near = lerp(b.near, df[0], da); scene.fog.far = lerp(b.far, df[1], da);
  if (W.glowMat) W.glowMat.color.setScalar(lerp(1, 0.15, da)); if (W.ceil) W.ceil[1].material.color.setScalar(lerp(1, 0.15, da));
  if (W.sky) W.sky.material.color.lerp(new THREE.Color(t.sky), k);
  if (W.dust) { W.dust.rotation.y += dt * 0.02; W.dust.position.y = Math.sin(performance.now() / 4000) * 0.05; }
  if (playing && ph === 3 && Math.random() < dt * 6) fxPuff(W.fx, AREA.rand(Math.random, 0.2).setY(0.1 + Math.random() * 0.8), '#fff6c8', 1, 0.05, 0.018, 2.5);
}
function makeDust() {
  const n = 400, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[i * 3] = lerp(AREA.minX, AREA.maxX, Math.random()); p[i * 3 + 1] = Math.random() * 1.6; p[i * 3 + 2] = lerp(AREA.minZ, AREA.maxZ, Math.random()); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff3d0, size: 0.008, transparent: true, opacity: 0.6, depthWrite: false }));
}

/* ---------- particles ---------- */
function makeFx(root) {
  const N = 600, g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
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
function fxConfetti(F, at, n) { const C = ['#ff3e8a', '#ffd400', '#00c2b3', '#2f5cff', '#9b5cff', '#ff7a1a']; for (let i = 0; i < n; i++) fxPuff(F, at, C[i % 6], 1, 1.8, 0.012, 1.4, 0.4); }
function fxStep(F, dt) {
  for (let i = 0; i < F.N; i++) { const q = F.p[i];
    if (q.life > 0) { q.life -= dt; q.vy -= 3 * q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vx *= 0.98; q.vz *= 0.98; if (q.y < 0) { q.y = 0; q.vy *= -0.3; }
      F.pos[i * 3] = q.x; F.pos[i * 3 + 1] = q.y; F.pos[i * 3 + 2] = q.z; F.col[i * 3] = q.c.r; F.col[i * 3 + 1] = q.c.g; F.col[i * 3 + 2] = q.c.b; F.size[i] = q.s * Math.min(1, q.life / q.max * 2); }
    else F.size[i] = 0; }
  F.pts.geometry.attributes.position.needsUpdate = true; F.pts.geometry.attributes.color.needsUpdate = true; F.pts.geometry.attributes.size.needsUpdate = true;
}

/* ---------- events: sounds and puffs, heard from where you are ---------- */
function onEvent(W, e, ear, viewer) {
  const [code, x, y, z, a] = e, p = V(x, y, z), d = ear ? ear.distanceTo(p) : 1, vol = viewer === 'toddler' ? clamp(1.4 / (1 + d * d * 1.5), 0.15, 1) : clamp(1 / (1 + (d / 1.2) ** 2), 0.08, 1);
  const P = (c, n, s, sz, l, g) => fxPuff(W.fx, p, c, n, s, sz, l, g);
  switch (code) {
    case 'jump': sfx.play('jump', vol * 0.6, 0.8 + Math.random() * 0.5); break;
    case 'land': sfx.play('land', vol * a); P('#d9cfc0', 4, 0.3, 0.012, 0.4); break;
    case 'grab': sfx.play('grab', vol, a === -2 ? 1.6 : 1); if (a >= 0 && viewer !== 'toddler') sfx.play('squeak', vol * 0.5, 0.8); break;
    case 'throw': sfx.play('throw', vol * (a || 1)); break;
    case 'away': sfx.play('away', 1); P('#ffd400', 18, 1.2, 0.018, 0.8); fxConfetti(W.fx, p, 14); break;
    case 'stun': sfx.play('stun', vol); P('#ffd400', 6, 0.5, 0.014, 0.6); break;
    case 'slam': sfx.play('slam', 1); sfx.play('waah', 0.8, 1 + Math.random() * 0.2); P('#d9cfc0', 40, 1.6, 0.03, 0.9); break;
    case 'chomp': sfx.play('chomp', vol); P('#bfe9ff', 8, 0.5, 0.014, 0.8); break;
    case 'giggle': sfx.play('giggle', 1); P('#ff9db0', 20, 0.9, 0.02, 1.0, 0.2); break;
    case 'tickle': sfx.play('tickle', vol, 0.9 + Math.random() * 0.4); P('#ff9db0', 3, 0.5, 0.014, 0.5, 0.2); if (Math.random() < 0.4) sfx.play('babble', 0.5); break;
    case 'bonk': sfx.play('bonk', vol); P('#ffd400', 8, 0.8, 0.016, 0.5); break;
    case 'splash': sfx.play('splash', vol); P('#7fd6ff', 24, 1.3, 0.016, 0.7); break;
    case 'pop': sfx.play('pop', vol); P('#ffffff', 10, 0.8, 0.014, 0.5); break;
    case 'boom': sfx.play('boom', vol); P('#ff7a1a', 14, 1.2, 0.02, 0.5); P('#d9d3cc', 10, 0.6, 0.03, 0.9, -0.2); break;
    case 'trail': P('#e8e2da', 1, 0.05, 0.018, 0.5, -0.1); break;
    case 'confetti': sfx.play('confetti', vol); fxConfetti(W.fx, p, 40); break;
    case 'drum': sfx.play('drum', vol); P('#e23b2e', 18, 1.4, 0.016, 0.5, 0.1); break;
    case 'roar': sfx.play('roar', vol); break;
    case 'lullaby': sfx.play('lullaby', 1); for (let i = 0; i < 12; i++) P(['#ffd400', '#cbb7ea', '#ff8fc7'][i % 3], 1, 0.4, 0.022, 2, -0.15); break;
    case 'launch': case 'cannon': case 'pew': case 'bubble': case 'heli': case 'chatter': sfx.play(code, vol); if (code === 'launch' || code === 'cannon') P('#d9d3cc', 10, 0.6, 0.025, 0.8, -0.2); break;
    case 'topple': sfx.play('clatter', vol * Math.min(1.4, 0.6 + (a || 1) * 0.15)); P('#fff6c8', 4 + Math.min(12, (a || 1) * 2), 0.6, 0.014, 0.5); break;
    case 'raid': sfx.play('boing', vol, 1.4); sfx.play('pop', vol); P('#ff3e8a', 10, 1.0, 0.018, 0.6); break;
    case 'mess': break;   // the phone shows its own '+N mess!' (main.js)
    case 'shove': sfx.play('shove', vol, a ? 1.5 : 1); if (a) P('#ffffff', 5, 0.6, 0.012, 0.4); break;
    case 'thud': sfx.play('thud', vol * (0.5 + (a || 0.5) * 0.5)); P('#d9cfc0', 16, 1.2, 0.022, 0.6); break;
    case 'eat': sfx.play('eat', viewer === 'toddler' ? 1 : vol); P('#f3d39a', 10, 0.5, 0.012, 0.6); break;
    case 'click': sfx.play('click', viewer === 'toddler' ? 1 : vol); break;
    case 'scratch': sfx.play('scratch', viewer === 'toddler' ? 1 : vol); break;
    case 'record': if (a) { sfx.play('needle', vol); for (let i = 0; i < 8; i++) P(['#ff3e8a', '#ffd400', '#00c2b3'][i % 3], 1, 0.5, 0.02, 1.5, -0.2); } break;
    case 'crank': sfx.play('crank', vol); break;
    case 'creak': sfx.play('creak', vol); break;
    case 'spin': case 'zip': case 'whistle': case 'boing': case 'squeak': case 'slip': case 'hop': sfx.play(code, vol, code === 'boing' && a ? 1.3 : 1); if (code === 'boing' || code === 'hop') P('#ffffff', 4, 0.4, 0.012, 0.4); break;
    case 'yawn': sfx.play('yawn', 0.8); break;
    case 'count': sfx.play('tick', 1); break;
    case 'go': sfx.play('go', 1); break;
    case 'tick': { const cp = W.clock ? W.clock.g.position : p, dd = ear ? ear.distanceTo(cp) : 2; sfx.play('clock', clamp((a <= 10 ? 1.4 : 0.5) / (1 + dd * 0.4), 0.05, 1), a % 2 ? 1 : 0.85); break; }
  }
}

/* ---------- canvas panels (VR wrist, banners, buttons) ---------- */
function canvasPanel(w, h, pxPerM) {
  const cv = document.createElement('canvas'); cv.width = Math.round(w * pxPerM); cv.height = Math.round(h * pxPerM);
  const t = new THREE.CanvasTexture(cv); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  m.renderOrder = 10; return { m, cv, x: cv.getContext('2d'), t, last: '' };
}
