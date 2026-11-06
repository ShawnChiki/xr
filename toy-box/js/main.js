/* ================= Toy Box: the app (lobby, cameras, controls, the loop) ================= */
const $ = id => document.getElementById(id);
const APP = { mode: 'lobby', kind: null, viewer: null, S: null, W: null, L: null, lv: 'vaneyck', mess: 'medium', bot: 'normal', soloLv: 'memphis', soloMess: 'medium', soloBot: 'normal',
  roster: null, snaps: [], off: null, me: { viewer: 'toy', body: -1, slotOf: {} }, myPid: 'local', sendT: 0, lastPh: -1, lastSt: -1, lastBody: -1, cur: null, lobbyPlayers: {}, endShown: false };
const BOT_SPEED = { easy: 0.5, normal: 0.72, hard: 0.98 };

/* ---------- renderer, scene, cameras ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
try { renderer.xr.setFoveation(1); } catch (e) {}
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#fff3dc');
const camera = new THREE.PerspectiveCamera(70, 1, 0.012, 60);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig); rig.vel = V();
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const xrOn = () => renderer.xr.isPresenting;
const NORENDER = /[?&]norender/.test(location.search);   // test hook

/* ---------- lobby ---------- */
function page(id) { document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'pg-' + id)); APP.page = id;
  if (id === 'host') hostPage(); if (id === 'home') { if (NET.on || NET.peer) netReset(); APP.lobbyPlayers = {}; } }
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { sfx.init(); page(b.dataset.go); }));
function levelPicker(el, get, set) {
  el.innerHTML = ''; for (const L of LEVELS) { const b = document.createElement('button'); b.className = 'lv' + (get() === L.id ? ' on' : '');
    b.innerHTML = `<em>${L.tag}</em><span class="sw">${L.swatch.map(c => `<i style="background:${c}"></i>`).join('')}</span><b>${L.name}</b><small>${L.blurb}</small>`;
    b.onclick = () => { set(L.id); levelPicker(el, get, set); }; el.append(b); }
}
function seg(el, opts, get, set) { el.innerHTML = ''; for (const [k, label] of opts) { const b = document.createElement('button'); b.textContent = label; b.className = get() === k ? 'on' : ''; b.onclick = () => { set(k); seg(el, opts, get, set); }; el.append(b); } }
const MESS_OPTS = [['small', 'Small (18)'], ['medium', 'Medium (28)'], ['big', 'Big (38)']], BOT_OPTS = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];
levelPicker($('hostLevels'), () => APP.lv, v => { APP.lv = v; lobbyInfo(); });
seg($('hostMess'), MESS_OPTS, () => APP.mess, v => { APP.mess = v; lobbyInfo(); });
seg($('hostBot'), BOT_OPTS, () => APP.bot, v => APP.bot = v);
levelPicker($('soloLevels'), () => APP.soloLv, v => APP.soloLv = v);
seg($('soloMess'), MESS_OPTS, () => APP.soloMess, v => APP.soloMess = v);
seg($('soloBot'), BOT_OPTS, () => APP.soloBot, v => APP.soloBot = v);
let xrOK = false;
if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { xrOK = ok; $('startVR').hidden = !ok; $('hostBotRow').hidden = ok; }).catch(() => {});
$('hostBotRow').hidden = false;
function hostPage() {
  if (NET.host && NET.on) { drawPlayers(); return; }
  $('hostCode').textContent = '····'; $('hostNote').textContent = 'Getting a code…';
  netHost((msg, code) => { if (code) { $('hostCode').textContent = code; $('hostNote').textContent = 'Toys join from their phones (same Wi-Fi) with this code. Up to 2 phones; bot toys fill the rest.'; } else if (msg) $('hostNote').textContent = msg; });
  drawPlayers();
}
function drawPlayers() {
  const el = $('hostPlayers'); el.innerHTML = ''; const ids = Object.keys(APP.lobbyPlayers);
  if (!ids.length) { el.innerHTML = '<span class="pill">No phones yet: you can start anyway, bot toys play too</span>'; return; }
  for (const pid of ids) { const s = APP.lobbyPlayers[pid]; const p = document.createElement('span'); p.className = 'pill'; p.innerHTML = `<i style="background:${s ? '#00c2b3' : '#ff3e8a'}"></i>Toy ${s + 1} is in`; el.append(p); }
}
function lobbyInfo() { if (NET.host) sendAll({ t: 'lobby', lv: APP.lv, mess: APP.mess, n: Object.keys(APP.lobbyPlayers).length }); }
APP.onJoin = pid => { const used = Object.values(APP.lobbyPlayers); const slot = used.includes(0) ? 1 : 0; APP.lobbyPlayers[pid] = slot; drawPlayers(); lobbyInfo(); sfx.play('hop');
  if (APP.mode === 'game' && APP.S) { addPlayer(APP.S, pid, slot); sendTo(pid, startMsg(slot)); } };
APP.onLeave = pid => { delete APP.lobbyPlayers[pid]; drawPlayers(); lobbyInfo(); if (APP.S) removePlayer(APP.S, pid); };
APP.onHostData = (pid, m) => { if (m.t === 'in' && APP.S && APP.S.players[pid]) Object.assign(APP.S.players[pid].inp, m); };
$('startBot').onclick = () => { sfx.init(); startMatch('bot'); };
$('startVR').onclick = async () => { sfx.init();
  try { const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }); await renderer.xr.setSession(s); startMatch('xr'); }
  catch (e) { $('hostNote').textContent = "Couldn't start VR: " + (e && e.message || e); } };
$('soloGo').onclick = () => { sfx.init(); startMatch('solo'); };
// phone joining
$('joinBtn').onclick = () => { sfx.init(); netJoin($('joinCode').value, st => {
  if (st === 'ok') { $('joinStatus').textContent = 'Connected!'; $('joinWait').hidden = false; sfx.play('hop'); }
  else $('joinStatus').textContent = st; }); };
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });
APP.onClientData = m => {
  if (m.t === 'lobby') { const L = LEVELS.find(l => l.id === m.lv); $('joinLevel').textContent = L ? L.name : ''; $('joinCount').textContent = m.n + (m.n === 1 ? ' phone' : ' phones') + ' in';
    if (m.back && APP.mode === 'game') toLobby('join'); }
  else if (m.t === 'start') clientStart(m);
  else if (m.t === 's') clientSnap(m);
  else if (m.t === 'full') { $('joinStatus').textContent = 'That game already has two toys.'; netReset(); }
};
APP.onHostGone = () => { if (APP.page === 'join' || APP.mode === 'game') { const was = APP.mode === 'game'; toLobby('join'); $('joinStatus').textContent = 'The toddler left the game.'; $('joinWait').hidden = true; NET.conn = null; NET.on = false; if (was) toast(''); } };

/* ---------- starting and ending a match ---------- */
function startMsg(slot) { return { t: 'start', lv: APP.S.L.id, seed: APP.S.L.seed, mess: APP.messKey, roster: APP.roster, slot }; }
function buildFor(L, rost) { disposeWorld(scene, APP.W); APP.W = buildWorld(scene, L, rost); APP.L = L; APP.roster = rost; }
function startMatch(kind) {
  const solo = kind === 'solo', lv = solo ? APP.soloLv : APP.lv, mess = solo ? APP.soloMess : APP.mess;
  const seed = (Math.random() * 1e9) | 0;
  const S = newMatch(lv, seed, mess, { botToddler: kind !== 'xr' }); S.botSpeed = BOT_SPEED[solo ? APP.soloBot : APP.bot];
  APP.S = S; APP.kind = kind; APP.messKey = mess; APP.mode = 'game'; APP.endShown = false;
  buildFor(S.L, roster(S));
  if (solo) addPlayer(S, 'local', 0);
  for (const pid in APP.lobbyPlayers) addPlayer(S, pid, APP.lobbyPlayers[pid]);
  if (NET.host) for (const pid in NET.conns) sendTo(pid, startMsg(APP.lobbyPlayers[pid] || 0));
  APP.viewer = kind === 'xr' ? 'toddler' : solo ? 'toy' : 'watch'; APP.me = { viewer: APP.viewer, body: -1, slotOf: {} }; APP.myPid = 'local';
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.vel.set(0, 0, 0);
  if (kind === 'xr') { rig.position.copy(TODDLER_START.p); rig.rotation.y = TODDLER_START.yaw; }
  CAMW.yaw = Math.PI; CAM.have = false; APP.lastBody = -1; APP.lastPh = -1; BANNER.until = 0;
  enterGameUI();
}
function clientStart(m) {
  const L = makeLevel(m.lv, m.seed); buildFor(L, m.roster); APP.messKey = m.mess;
  APP.mode = 'game'; APP.kind = 'client'; APP.viewer = 'toy'; APP.me = { viewer: 'toy', body: -1, slotOf: {} }; APP.myPid = NET.myId; APP.snaps = []; APP.off = null; APP.cur = null; APP.endShown = false;
  CAM.have = false; APP.lastBody = -1; APP.lastPh = -1; rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  enterGameUI();
}
function enterGameUI() {
  $('ui').style.display = 'none'; $('hud').classList.add('on'); $('end').classList.remove('on'); document.body.classList.add('playing');
  const toy = APP.viewer === 'toy'; $('pad').hidden = !toy; $('who').hidden = !toy;
  $('keys').hidden = !(toy && !matchMedia('(pointer:coarse)').matches);
  $('again').hidden = APP.kind === 'client'; $('toLobby').textContent = APP.kind === 'client' ? 'Leave' : 'Lobby';
  try { if (toy && matchMedia('(pointer:coarse)').matches && screen.orientation && screen.orientation.lock) { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().then(() => screen.orientation.lock('landscape')).catch(() => {}); } } catch (e) {}
}
function toLobby(pg) {
  APP.mode = 'lobby'; APP.S = null; musicStop(); disposeWorld(scene, APP.W); APP.W = null;
  $('hud').classList.remove('on'); $('end').classList.remove('on'); $('ui').style.display = ''; document.body.classList.remove('playing');
  scene.background = new THREE.Color('#fff3dc'); scene.fog = null;
  if (xrOn()) try { renderer.xr.getSession().end(); } catch (e) {}
  if (NET.host) sendAll({ t: 'lobby', lv: APP.lv, mess: APP.mess, n: Object.keys(APP.lobbyPlayers).length, back: true });
  page(pg || (APP.kind === 'solo' ? 'solo' : APP.kind === 'client' ? 'join' : 'host'));
}
$('again').onclick = () => { sfx.init(); if (APP.kind === 'client') return; startMatch(APP.kind === 'xr' && !xrOn() ? 'bot' : APP.kind); };
$('toLobby').onclick = () => { if (APP.kind === 'client') { netReset(); toLobby('join'); $('joinWait').hidden = true; $('joinStatus').textContent = ''; } else toLobby(); };
$('quit').onclick = () => $('toLobby').click();
$('mute').onclick = () => { sfx.init(); sfx.mute(!sfx.muted); $('mute').textContent = sfx.muted ? '🔇' : '🔊'; };
renderer.xr.addEventListener('sessionend', () => { if (APP.mode === 'game' && APP.kind === 'xr') toLobby('host'); });

/* ---------- phone controls ---------- */
const INP = { jx: 0, jy: 0, jc: 0, gc: 0, sc: 0, wc: 0, gh: false, jh: false };
const CAM = { yaw: 0, pitch: 0.36, dist: 0.46, tgt: V(), have: false, fly: 0 };
const CAMW = { yaw: Math.PI, pitch: 0.62, dist: 5.2, tgt: V(0, 0, 0.2) };
(function touch() {
  const joy = $('joy'), stick = $('stick'), nub = stick.querySelector('i'); let jid = null, jx0 = 0, jy0 = 0;
  joy.addEventListener('pointerdown', e => { sfx.init(); jid = e.pointerId; jx0 = e.clientX; jy0 = e.clientY; stick.style.display = 'block'; stick.style.left = jx0 + 'px'; stick.style.top = jy0 + 'px'; try { joy.setPointerCapture(e.pointerId); } catch (_) {} });
  joy.addEventListener('pointermove', e => { if (e.pointerId !== jid) return; let dx = (e.clientX - jx0) / 50, dy = (e.clientY - jy0) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } INP.jx = dx; INP.jy = -dy; nub.style.transform = `translate(${dx * 34}px,${dy * 34}px)`; });
  const jend = e => { if (e.pointerId !== jid) return; jid = null; INP.jx = INP.jy = 0; stick.style.display = 'none'; nub.style.transform = ''; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  const look = $('look'); let lid = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', e => { sfx.init(); lid = e.pointerId; lx = e.clientX; ly = e.clientY; try { look.setPointerCapture(e.pointerId); } catch (_) {} });
  look.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; CAM.yaw -= (e.clientX - lx) * 0.009; CAM.pitch = clamp(CAM.pitch + (e.clientY - ly) * 0.006, -0.15, 1.25); lx = e.clientX; ly = e.clientY; });
  const lend = e => { if (e.pointerId === lid) lid = null; }; look.addEventListener('pointerup', lend); look.addEventListener('pointercancel', lend);
  const btn = (id, down, up) => { const el = $(id); el.addEventListener('pointerdown', e => { sfx.init(); e.preventDefault(); el.classList.add('down'); down(); try { el.setPointerCapture(e.pointerId); } catch (_) {} });
    const u = () => { el.classList.remove('down'); up && up(); }; el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('lostpointercapture', u); };
  btn('bJump', () => { INP.jc++; INP.jh = true; }, () => INP.jh = false); btn('bGrab', () => { INP.gc++; INP.gh = true; }, () => INP.gh = false);
  btn('bSp', () => INP.sc++); btn('bSwap', () => INP.wc++);
  // desktop: keyboard and mouse
  const keys = {}; addEventListener('keydown', e => { if (APP.mode !== 'game' || e.target.tagName === 'INPUT') return; sfx.init(); if (keys[e.code]) { if (e.code === 'Tab') e.preventDefault(); return; } keys[e.code] = true;
    if (e.code === 'Space') { INP.jc++; INP.jh = true; e.preventDefault(); } if (e.code === 'KeyE' || e.code === 'KeyJ') { INP.gc++; INP.gh = true; } if (e.code === 'KeyQ' || e.code === 'KeyK') INP.sc++; if (e.code === 'Tab') { INP.wc++; e.preventDefault(); } });
  addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') INP.jh = false; if (e.code === 'KeyE' || e.code === 'KeyJ') INP.gh = false; });
  APP.keys = keys;
  const cv = renderer.domElement; let md = false, mx = 0, my = 0;
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; md = true; mx = e.clientX; my = e.clientY; });
  addEventListener('pointerup', () => md = false);
  addEventListener('pointermove', e => { if (!md || APP.mode !== 'game') return; const dx = e.clientX - mx, dy = e.clientY - my; mx = e.clientX; my = e.clientY;
    if (APP.viewer === 'watch') { CAMW.yaw -= dx * 0.006; CAMW.pitch = clamp(CAMW.pitch + dy * 0.004, 0.12, 1.4); } else { CAM.yaw -= dx * 0.007; CAM.pitch = clamp(CAM.pitch + dy * 0.005, -0.15, 1.25); } });
  addEventListener('wheel', e => { if (APP.viewer === 'watch') CAMW.dist = clamp(CAMW.dist * (1 + e.deltaY * 0.001), 1.2, 9); else CAM.dist = clamp(CAM.dist * (1 + e.deltaY * 0.001), 0.25, 1.1); }, { passive: true });
})();
function toyMove() {
  let jx = INP.jx, jy = INP.jy; const k = APP.keys || {};
  const kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), ky = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
  if (kx || ky) { jx = kx; jy = ky; const l = Math.hypot(jx, jy); jx /= l; jy /= l; }
  const s = Math.sin(CAM.yaw), c = Math.cos(CAM.yaw); // camera sits at +(s, c) from the toy, looking back along -(s, c)
  return { mx: -s * jy + c * jx, mz: -c * jy - s * jx, ax: -s, az: -c, jc: INP.jc, gc: INP.gc, sc: INP.sc, wc: INP.wc, gh: INP.gh, jh: INP.jh };
}

/* ---------- the toddler in VR: hands, crawling, sticks ---------- */
const HANDS = [{ side: 'right' }, { side: 'left' }].map(h => Object.assign(h, { grip: null, src: null, lp: V(), lq: Q(), prevLp: V(), contact: false, prev: {} }));
for (let i = 0; i < 2; i++) {
  const g = renderer.xr.getControllerGrip(i), c = renderer.xr.getController(i); rig.add(g, c);
  c.addEventListener('connected', e => { const hd = e.data && e.data.handedness; const H = HANDS[hd === 'left' ? 1 : 0]; H.grip = g; H.src = e.data; H.prev = {}; if (hd === 'left') g.add(WRIST.m); });
  c.addEventListener('disconnected', () => { for (const H of HANDS) if (H.grip === g) H.src = null; });
}
const WRIST = canvasPanel(0.13, 0.075, 2400); WRIST.m.position.set(0, 0.03, 0.09); WRIST.m.rotation.x = -1.0;
const BANNER = canvasPanel(0.9, 0.34, 900); BANNER.m.position.set(0, 0.12, -0.85); camera.add(BANNER.m); BANNER.m.visible = false; BANNER.until = 0;
const SPLAT = canvasPanel(0.5, 0.3, 600); SPLAT.m.position.set(0, 0, -0.16); camera.add(SPLAT.m); SPLAT.m.material.opacity = 0;
const CONF = canvasPanel(0.5, 0.3, 600); CONF.m.position.set(0, 0, -0.17); camera.add(CONF.m); CONF.m.material.opacity = 0;
(() => { const x = SPLAT.x, w = SPLAT.cv.width, h = SPLAT.cv.height; for (let i = 0; i < 40; i++) { const px = Math.random() * w, py = Math.random() * h, r = 8 + Math.random() * 40; const g = x.createRadialGradient(px - r * 0.3, py - r * 0.3, 1, px, py, r); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.4, 'rgba(160,215,255,.55)'); g.addColorStop(1, 'rgba(90,170,255,.15)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); } SPLAT.t.needsUpdate = true;
  const y = CONF.x, C = ['#ff3e8a', '#ffd400', '#00c2b3', '#2f5cff', '#9b5cff']; for (let i = 0; i < 160; i++) { y.save(); y.translate(Math.random() * w, Math.random() * h); y.rotate(Math.random() * 3); y.fillStyle = C[i % 5]; y.fillRect(-6, -3, 12, 6); y.restore(); } CONF.t.needsUpdate = true; })();
function banner(big, small, secs) {
  if (APP.viewer === 'toddler') { const P = BANNER, x = P.x, w = P.cv.width, h = P.cv.height; x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,253,247,.94)'; x.strokeStyle = '#15121a'; x.lineWidth = 8; rr(x, 6, 6, w - 12, h - 12, 26); x.fill(); x.stroke();
    x.textAlign = 'center'; x.fillStyle = '#15121a'; x.font = `400 ${small ? 92 : 120}px Bungee, Rubik, sans-serif`; x.fillText(big, w / 2, small ? 128 : 190);
    if (small) { x.font = '800 34px Rubik, sans-serif'; const lines = String(small).split('\n'); lines.forEach((l, i) => x.fillText(l, w / 2, 196 + i * 46)); }
    P.t.needsUpdate = true; P.m.visible = true; P.until = performance.now() + (secs || 2) * 1000; return; }
  const el = $('banner'); el.innerHTML = big + (small ? `<br><small>${small}</small>` : ''); el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), (secs || 2) * 1000);
}
function toast(t, secs) { const el = $('toast'); if (!t) { el.classList.remove('on'); return; } el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), (secs || 2.2) * 1000); }
function buzz(i, amp, ms) { const s = HANDS[i].src, a = s && s.gamepad && s.gamepad.hapticActuators && s.gamepad.hapticActuators[0]; if (a && a.pulse) try { a.pulse(amp, ms); } catch (e) {} }
const dz = v => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
let turnHeld = false;
const headL = V(0, 1.2, 0), headLQ = Q();
function xrToddler(dt, frame) {
  const S = APP.S, L = S.L;
  const pose = frame && frame.getViewerPose(renderer.xr.getReferenceSpace());
  if (pose) { const t = pose.transform; headL.set(t.position.x, t.position.y, t.position.z); headLQ.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w); }
  let sx = 0, sy = 0, turn = 0; const btn = [];
  for (let i = 0; i < 2; i++) { const H = HANDS[i], gp = H.src && H.src.gamepad; if (!H.grip) continue; H.lp.copy(H.grip.position); H.lq.copy(H.grip.quaternion);
    if (!gp) continue; const bt = k => !!(gp.buttons[k] && gp.buttons[k].pressed), ax = k => (gp.axes.length > 3 ? gp.axes[k] : gp.axes[k - 2]) || 0;
    H.gripB = bt(1) || !!(gp.buttons[1] && gp.buttons[1].value > 0.5); H.trigB = bt(0) || !!(gp.buttons[0] && gp.buttons[0].value > 0.5);
    const edge = (k, v) => { const e = v && !H.prev[k]; H.prev[k] = v; return e; };
    btn[i] = { a: edge('a', bt(4)), b: edge('b', bt(5)), t: edge('t', H.trigB) };
    if (i === 1) { sx = dz(ax(2)); sy = dz(ax(3)); } else turn = dz(ax(2)); }
  // crawl: a hand on the floor pushes you along
  const yaw = rig.rotation.y, cy = Math.cos(yaw), syw = Math.sin(yaw); let mvx = 0, mvz = 0, touching = 0;
  for (const H of HANDS) { if (!H.src) { H.contact = false; continue; }
    const wx = rig.position.x + H.lp.x * cy + H.lp.z * syw, wz = rig.position.z - H.lp.x * syw + H.lp.z * cy, wy = H.lp.y;
    const on = wy < L.groundH(wx, wz) + 0.085;
    if (on && H.contact) { const dx = H.lp.x - H.prevLp.x, dzz = H.lp.z - H.prevLp.z; mvx -= dx * cy + dzz * syw; mvz -= -dx * syw + dzz * cy; touching++; }
    H.contact = on; H.prevLp.copy(H.lp); }
  if (touching) { rig.position.x += mvx / touching; rig.position.z += mvz / touching; rig.vel.set(mvx / touching / Math.max(dt, 1e-3), 0, mvz / touching / Math.max(dt, 1e-3)).clampLength(0, 2.6); }
  else { rig.position.addScaledVector(rig.vel, dt); rig.vel.multiplyScalar(Math.exp(-3.5 * dt)); }
  // left stick walks you, right stick turns you
  const hf = V(0, 0, -1).applyQuaternion(headLQ).applyAxisAngle(Y_AX, yaw); hf.y = 0; hf.normalize(); const hr = V(-hf.z, 0, hf.x);
  if (sx || sy) rig.position.addScaledVector(hf, -sy * 1.1 * dt).addScaledVector(hr, sx * 1.1 * dt);
  if (Math.abs(turn) > 0.7 && !turnHeld) { turnHeld = true; const hw = headL.clone().applyAxisAngle(Y_AX, yaw).add(rig.position); rig.rotation.y -= Math.sign(turn) * Math.PI / 6; const hw2 = headL.clone().applyAxisAngle(Y_AX, rig.rotation.y).add(rig.position); rig.position.add(hw.sub(hw2)); }
  else if (Math.abs(turn) < 0.3) turnHeld = false;
  // stay on the playground
  const hw = headL.clone().applyAxisAngle(Y_AX, rig.rotation.y).add(rig.position), lim = HALF + 0.4;
  if (hw.x > lim) rig.position.x -= hw.x - lim; if (hw.x < -lim) rig.position.x -= hw.x + lim; if (hw.z > lim) rig.position.z -= hw.z - lim; if (hw.z < -lim) rig.position.z -= hw.z + lim;
  rig.updateMatrixWorld(true);
  const head = headL.clone().applyMatrix4(rig.matrixWorld), hq = rig.quaternion.clone().multiply(headLQ);
  const hands = HANDS.map(H => ({ on: !!H.src, p: H.lp.clone().applyMatrix4(rig.matrixWorld), q: rig.quaternion.clone().multiply(H.lq), grip: !!H.gripB, trig: !!H.trigB }));
  setToddlerPose(S, { head, hq, hands });
  // between rounds: trigger = again, A/X = next playground, B/Y = leave
  if (S.state === 'end' && performance.now() - APP.endAt > 1500) for (const b of btn) { if (!b) continue;
    if (b.t) { startMatch('xr'); return; } if (b.a) { const i = LEVELS.findIndex(l => l.id === APP.lv); APP.lv = LEVELS[(i + 1) % LEVELS.length].id; levelPicker($('hostLevels'), () => APP.lv, v => { APP.lv = v; lobbyInfo(); }); lobbyInfo(); startMatch('xr'); return; } if (b.b) { toLobby('host'); return; } }
}
function wristDraw(s) {
  const P = WRIST, x = P.x, w = P.cv.width, h = P.cv.height, key = [Math.ceil(s.nap), s.ml, s.ph, s.st].join(); if (key === P.last) return; P.last = key;
  x.clearRect(0, 0, w, h); x.fillStyle = '#fffdf7'; x.strokeStyle = '#15121a'; x.lineWidth = 10; rr(x, 6, 6, w - 12, h - 12, 24); x.fill(); x.stroke();
  x.fillStyle = '#15121a'; x.textAlign = 'left'; x.font = '800 30px Rubik, sans-serif'; x.fillText('NAP IN', 26, 46);
  x.font = '400 70px Bungee, Rubik, sans-serif'; x.fillText(fmtT(s.nap), 22, 120);
  x.textAlign = 'right'; x.fillStyle = s.ml ? '#e23b2e' : '#00a651'; x.font = '400 64px Bungee, Rubik, sans-serif'; x.fillText(String(s.ml), w - 26, 104); x.font = '800 26px Rubik, sans-serif'; x.fillStyle = '#15121a'; x.fillText('STILL OUT', w - 26, 136);
  x.textAlign = 'left'; x.fillStyle = ['#ff7a1a', '#00c2b3', '#9b5cff', '#ff8fc7'][s.ph]; x.fillRect(22, 140, 180, 26); x.fillStyle = '#15121a'; x.font = '800 22px Rubik, sans-serif'; x.fillText(s.st === 0 ? 'GET READY' : PHASES[s.ph].name.toUpperCase(), 30, 161);
  P.t.needsUpdate = true;
}
const fmtT = n => { n = Math.max(0, Math.ceil(n)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };

/* ---------- phones: snapshots from the toddler ---------- */
function clientSnap(m) {
  const now = performance.now(), o = now - m.T * 1000; if (APP.off === null || o < APP.off) APP.off = o; else APP.off += (o - APP.off) * 0.02;
  APP.snaps.push(m); while (APP.snaps.length > 30) APP.snaps.shift();
  if (APP.W && m.ev) for (const e of m.ev) handleEvent(e);
}
function pickSnaps() {
  const B = APP.snaps; if (!B.length) return null; const rt = (performance.now() - APP.off - 85) / 1000;
  for (let i = B.length - 1; i > 0; i--) if (B[i - 1].T <= rt) { const a = B[i - 1], b = B[i]; if (rt >= b.T) return [b, null, 0]; return [a, b, (rt - a.T) / Math.max(1e-4, b.T - a.T)]; }
  return [B[0], null, 0];
}

/* ---------- events that the app cares about (beyond sounds) ---------- */
function handleEvent(e) {
  const W = APP.W, ear = APP.viewer === 'toddler' ? (APP.S ? APP.S.td.head : camera.position) : APP.viewer === 'toy' ? CAM.tgt : camera.getWorldPosition(V());
  onEvent(W, e, ear, APP.viewer);
  const [code, x, y, z, a] = e, toddler = APP.viewer === 'toddler';
  if (code === 'count') banner(String(a), toddler ? 'GRIP grabs · push the floor to crawl\nboth TRIGGERS: tantrum · fill the TOY BOX' : APP.viewer === 'toy' ? "Don't get put in the toy box!" : '', 1.05);
  if (code === 'go') banner(toddler ? 'CLEAN UP!' : 'RUN!', toddler ? 'Every toy in the box before nap time' : 'Stay out of the box till nap time', 1.8);
  if (code === 'phase' && a > 0) banner(PHASES[a].name, PHASES[a].sub, 2.2);
  if (toddler) { const p = V(x, y, z), td = APP.S.td;
    for (let i = 0; i < 2; i++) { const d = td.hands[i].p.distanceTo(p); if (d < 0.2) { if (code === 'grab') buzz(i, 0.5, 40); if (code === 'bonk') buzz(i, 1, 160); } }
    if (code === 'slam') { buzz(0, 1, 220); buzz(1, 1, 220); } if (code === 'away') { buzz(0, 0.3, 50); buzz(1, 0.3, 50); } if (code === 'giggle') { buzz(0, 0.6, 600); buzz(1, 0.6, 600); } }
  if (code === 'end') { APP.endAt = performance.now(); }
}

/* ---------- the HUD on phones and the watching screen ---------- */
const PHASE_COL = ['#ff7a1a', '#00c2b3', '#9b5cff', '#ff8fc7'];
function hud(s) {
  $('clock').lastChild.textContent = s.st === 0 ? fmtT(MATCH_TIME) : fmtT(s.nap);
  const ph = $('phase'); ph.textContent = s.st === 0 ? 'Get ready' : s.st === 2 ? 'Nap time' : PHASES[s.ph].name; ph.style.background = PHASE_COL[s.ph]; ph.style.color = '#15121a';
  $('mess').textContent = s.ml + ' still out';
  if (APP.viewer === 'toy') {
    const c = s.ctl[APP.myPid];
    if (c) { const bi = c[0], r = APP.roster[bi]; APP.me.body = bi;
      if (bi !== APP.lastBody) { if (bi >= 0 && r) { const T = TOYS[r[1]]; $('who').innerHTML = `${T.name}<small>Special: ${T.sp}</small>`; $('spName').textContent = T.sp; if (APP.lastBody >= 0) { toast("Put away! You're the " + T.name + ' now'); sfx.play('hop'); } CAM.fly = 0.5; } APP.lastBody = bi; }
      $('spCd').style.height = Math.round(c[2] * 100) + '%'; $('bGrab').textContent = c[3] || 'Grab'; }
    APP.me.slotOf = {}; for (const pid in s.ctl) APP.me.slotOf[s.ctl[pid][0]] = s.ctl[pid][1];
  }
  if (s.st === 2 && !APP.endShown) { APP.endShown = true; APP.endAt = performance.now();
    setTimeout(() => { if (APP.mode !== 'game') return;
      const toysWon = s.end === 1;
      $('endT').textContent = toysWon ? 'Nap time! Toys win' : 'All clean! Toddler wins';
      $('endP').textContent = toysWon ? `The toddler fell asleep with ${s.ml} still out of the box.` : "Everything's in the toy box. Now, nap time.";
      $('end').classList.add('on'); if (APP.kind === 'client') $('endP').textContent += ' Waiting for the toddler to start the next round…';
      if (APP.viewer === 'toddler') banner(toysWon ? 'Toys win' : 'You win!', 'TRIGGER: play again · A/X: next playground\nB/Y: leave VR', 9999); }, 2200);
    banner(s.end === 1 ? 'Zzz…' : 'All clean!', s.end === 1 ? 'Toys win' : 'Toddler wins', 2.2); sfx.play(s.end === 1 ? 'lullaby' : 'win'); }
  if (s.st !== 2 && APP.endShown) { APP.endShown = false; $('end').classList.remove('on'); }
}

/* ---------- the loop ---------- */
let lastT = performance.now();
function loop(t, frame) {
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (APP.mode !== 'game' || !APP.W) { renderer.render(scene, camera); return; }
  const W = APP.W; let s, s2 = null, k = 0;
  if (APP.kind !== 'client') {
    const S = APP.S;
    if (APP.viewer === 'toddler' && xrOn()) xrToddler(dt, frame); if (APP.mode !== 'game' || APP.S !== S) return;
    if (APP.kind === 'solo' && S.players.local) Object.assign(S.players.local.inp, toyMove());
    stepMatch(S, dt);
    for (const e of S.ev) handleEvent(e);
    s = snap(S, false);
    APP.sendT -= dt; if (APP.sendT <= 0 && NET.host && Object.keys(NET.conns).length) { APP.sendT = 1 / 30; sendAll(snap(S, true)); } else if (!NET.host) S.netEv.length = 0;
  } else {
    const p = pickSnaps(); if (!p) { renderer.render(scene, camera); return; } [s, s2, k] = p;
    APP.sendT -= dt; if (APP.sendT <= 0) { APP.sendT = 1 / 30; sendHost(Object.assign({ t: 'in' }, toyMove())); }
    s = Object.assign({}, s, { ctl: APP.snaps[APP.snaps.length - 1].ctl, nap: APP.snaps[APP.snaps.length - 1].nap, st: APP.snaps[APP.snaps.length - 1].st, ml: APP.snaps[APP.snaps.length - 1].ml, end: APP.snaps[APP.snaps.length - 1].end, ph: APP.snaps[APP.snaps.length - 1].ph });
  }
  APP.cur = s;
  const playing = s.st === 1; musicPhase(s.st === 2 ? 3 : s.st === 0 ? -1 : s.ph); if (s.st === 0) musicStop();
  if (APP.viewer !== 'toddler') hud(s); else { wristDraw(s); hud(s); }
  drawSnap(W, s, s2, k, APP.me);
  if (APP.kind === 'client' && APP.me.body >= 0 && APP.snaps.length > 1) { const n = APP.snaps.length, A = APP.snaps[n - 2].b, B = APP.snaps[n - 1].b, j = APP.me.body * 8, g = W.bodies[APP.me.body].g, dT = Math.max(0.016, APP.snaps[n - 1].T - APP.snaps[n - 2].T);
    if (!(B[j + 7] & 1) && !(A[j + 7] & 1)) { const ahead = 0.04; g.position.set(B[j] + (B[j] - A[j]) / dT * ahead, B[j + 1] + (B[j + 1] - A[j + 1]) / dT * ahead, B[j + 2] + (B[j + 2] - A[j + 2]) / dT * ahead); } }
  phaseLight(W, scene, s.ph, playing || s.st === 2, dt); if (s.st === 2) phaseLight(W, scene, 3, true, dt);
  fxStep(W.fx, dt);
  // cameras
  if (APP.viewer === 'toy') toyCam(dt, s); else if (APP.viewer === 'watch') watchCam(dt);
  if (APP.viewer === 'toddler') { const T = s.td; SPLAT.m.material.opacity = clamp(T[31], 0, 1) * 0.9; CONF.m.material.opacity = clamp(T[32], 0, 1); BANNER.m.visible = performance.now() < BANNER.until; }
  if (!document.hidden && !NORENDER) renderer.render(scene, camera);
}
function toyCam(dt, s) {
  const bi = APP.me.body; if (bi < 0 || !APP.W.bodies[bi]) return; const p = APP.W.bodies[bi].g.position.clone();
  if (!CAM.have) { const d = V(p.x - s.td[0], 0, p.z - s.td[2]); CAM.yaw = Math.atan2(d.x, d.z); CAM.tgt.copy(p); CAM.have = true; }
  CAM.fly = Math.max(0, CAM.fly - dt);
  CAM.tgt.lerp(p, 1 - Math.exp(-(CAM.fly > 0 ? 5 : 16) * dt));
  const cp = Math.cos(CAM.pitch), pos = V(CAM.tgt.x + Math.sin(CAM.yaw) * cp * CAM.dist, CAM.tgt.y + 0.03 + Math.sin(CAM.pitch) * CAM.dist, CAM.tgt.z + Math.cos(CAM.yaw) * cp * CAM.dist);
  const gh = APP.L.groundH(pos.x, pos.z); if (pos.y < gh + 0.025) pos.y = gh + 0.025;
  camera.position.copy(pos); camera.lookAt(CAM.tgt.x, CAM.tgt.y + 0.03, CAM.tgt.z);
}
function watchCam(dt) {
  const cp = Math.cos(CAMW.pitch); camera.position.set(CAMW.tgt.x + Math.sin(CAMW.yaw) * cp * CAMW.dist, CAMW.tgt.y + Math.sin(CAMW.pitch) * CAMW.dist, CAMW.tgt.z + Math.cos(CAMW.yaw) * cp * CAMW.dist);
  camera.lookAt(CAMW.tgt);
}
renderer.setAnimationLoop(loop);
// a host tab in the background still runs the match, so the phones don't freeze
setInterval(() => { if (document.hidden && APP.mode === 'game' && APP.kind !== 'client' && !xrOn()) loop(performance.now(), null); }, 33);
window.APP = APP;

/* ---------- test hooks: ?auto=solo&lv=junk, ?auto=host (bot toddler), ?auto=join&code=1234 ---------- */
(function auto() {
  const q = new URLSearchParams(location.search), a = q.get('auto'); if (q.get('lv')) APP.lv = APP.soloLv = q.get('lv');
  if (a === 'solo') setTimeout(() => startMatch('solo'), 300);
  if (a === 'host') { page('host'); setTimeout(() => startMatch('bot'), +(q.get('wait') || 2500)); }
  if (a === 'join') { page('join'); setTimeout(() => { $('joinCode').value = q.get('code'); $('joinBtn').click(); }, 600); }
})();
