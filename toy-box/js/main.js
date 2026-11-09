/* ================= Toy Box: the app (lobby, mixed-reality setup, cameras, controls, the loop) ================= */
const $ = id => document.getElementById(id);
const APP = { mode: 'lobby', kind: null, viewer: null, S: null, W: null, L: null, lv: 'bedroom', mess: 'medium', bot: 'normal', soloLv: 'bedroom', soloMess: 'medium', soloBot: 'normal',
  roster: null, snaps: [], off: null, me: { viewer: 'toy', body: -1, slotOf: {} }, myPid: 'local', sendT: 0, lastBody: -1, cur: null, lobbyPlayers: {}, endShown: false, area: null, momSaid: false };
const BOT_SPEED = { easy: 0.55, normal: 0.8, hard: 1.05 };
const NORENDER = /[?&]norender/.test(location.search);   // test hook

/* ---------- renderer, scene, cameras ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
try { renderer.xr.setFoveation(1); } catch (e) {}
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#fff3dc');
const camera = new THREE.PerspectiveCamera(70, 1, 0.012, 60);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; if (!renderer.xr.isPresenting) camera.fov = camera.aspect < 1 ? 84 : 70; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const xrOn = () => renderer.xr.isPresenting;
const fmtT = n => { n = Math.max(0, Math.ceil(n)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };

/* ---------- lobby ---------- */
function page(id) { document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'pg-' + id)); APP.page = id;
  if (id === 'host') hostPage(); if (id === 'home') { if (NET.on || NET.peer) netReset(); APP.lobbyPlayers = {}; } }
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { sfx.init(); primeVoice(); page(b.dataset.go); }));
const SHOWN = LEVELS.filter(l => !l.hidden);   // only the Cloud Bedroom for now; the other rooms are tucked away
function levelPicker(el, get, set) {
  el.hidden = SHOWN.length < 2; if (el.previousElementSibling && el.previousElementSibling.tagName === 'H2' && el.id === 'hostLevels') el.previousElementSibling.hidden = SHOWN.length < 2;
  el.innerHTML = ''; for (const L of SHOWN) { const b = document.createElement('button'); b.className = 'lv' + (get() === L.id ? ' on' : '');
    b.innerHTML = `<em>${L.tag}</em><span class="sw">${L.swatch.map(c => `<i style="background:${c}"></i>`).join('')}</span><b>${L.name}</b><small>${L.blurb}</small>`;
    b.onclick = () => { set(L.id); levelPicker(el, get, set); }; el.append(b); }
}
function seg(el, opts, get, set) { el.innerHTML = ''; for (const [k, label] of opts) { const b = document.createElement('button'); b.textContent = label; b.className = get() === k ? 'on' : ''; b.onclick = () => { set(k); seg(el, opts, get, set); }; el.append(b); } }
const MESS_OPTS = [['small', 'Small'], ['medium', 'Medium'], ['big', 'Big']], BOT_OPTS = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];
const hostLevels = () => levelPicker($('hostLevels'), () => APP.lv, v => { APP.lv = v; lobbyInfo(); });
hostLevels();
seg($('hostMess'), MESS_OPTS, () => APP.mess, v => { APP.mess = v; lobbyInfo(); });
seg($('hostBot'), BOT_OPTS, () => APP.bot, v => APP.bot = v);
levelPicker($('soloLevels'), () => APP.soloLv, v => APP.soloLv = v);
seg($('soloMess'), MESS_OPTS, () => APP.soloMess, v => APP.soloMess = v);
seg($('soloBot'), BOT_OPTS, () => APP.soloBot, v => APP.soloBot = v);
let xrMode = null;   // 'immersive-ar' (mixed reality: draw your space on the real floor) or 'immersive-vr'
if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-ar').then(ok => { if (ok) { xrMode = 'immersive-ar'; $('startVR').hidden = false; $('startVR').textContent = 'Start in mixed reality'; $('hostBotRow').hidden = true; } else return navigator.xr.isSessionSupported('immersive-vr').then(v => { if (v) { xrMode = 'immersive-vr'; $('startVR').hidden = false; $('hostBotRow').hidden = true; } }); }).catch(() => {});
}
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
$('startBot').onclick = () => { sfx.init(); primeVoice(); startMatch('bot'); };
$('startVR').onclick = async () => { sfx.init(); primeVoice();
  try { const s = await navigator.xr.requestSession(xrMode, { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'bounded-floor'] }); await renderer.xr.setSession(s); XRF.base = renderer.xr.getReferenceSpace(); XRF.bounded = XRF.guardian = null;
    s.requestReferenceSpace('bounded-floor').then(sp => { if (sp && sp.boundsGeometry && sp.boundsGeometry.length >= 3) XRF.bounded = sp; }).catch(() => {});
    startDraw(); }
  catch (e) { $('hostNote').textContent = "Couldn't start the headset: " + (e && e.message || e); } };
$('soloGo').onclick = () => { sfx.init(); primeVoice(); startMatch('solo'); };
$('joinBtn').onclick = () => { sfx.init(); primeVoice(); if (CAN_FS && matchMedia('(pointer:coarse)').matches && !document.fullscreenElement) try { document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {} netJoin($('joinCode').value, st => {
  if (st === 'ok') { $('joinStatus').textContent = 'Connected!'; $('joinWait').hidden = false; sfx.play('hop'); }
  else $('joinStatus').textContent = st; }); };
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });
APP.onClientData = m => {
  if (m.t === 'lobby') { const L = LEVELS.find(l => l.id === m.lv); $('joinLevel').textContent = L ? L.name : ''; $('joinCount').textContent = m.n + (m.n === 1 ? ' phone' : ' phones') + ' in';
    if (m.back && APP.mode === 'game') toLobby('join'); if (m.drawing) $('joinStatus').textContent = 'The toddler is tracing the play space…'; }
  else if (m.t === 'start') clientStart(m);
  else if (m.t === 's') clientSnap(m);
  else if (m.t === 'full') { $('joinStatus').textContent = 'That game already has two toys.'; netReset(); }
};
APP.onHostGone = () => { if (APP.page === 'join' || APP.mode === 'game') { toLobby('join'); $('joinStatus').textContent = 'The toddler left the game.'; $('joinWait').hidden = true; NET.conn = null; NET.on = false; } };

/* ---------- mom's voice ---------- */
let voice = null;
function primeVoice() { try { if (!window.speechSynthesis || primeVoice.done) return; primeVoice.done = true; const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u);
  const pickV = () => { const vs = speechSynthesis.getVoices(); voice = vs.find(v => /en/i.test(v.lang) && /female|samantha|victoria|karen|zira|aria|jenny|google us/i.test(v.name)) || vs.find(v => /en/i.test(v.lang)) || null; }; pickV(); speechSynthesis.onvoiceschanged = pickV; } catch (e) {} }
function speak(line) {
  try { if (window.speechSynthesis && !sfx.muted) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(line); if (voice) u.voice = voice; u.pitch = 1.15; u.rate = 1.02; u.volume = 1; speechSynthesis.speak(u); return; } } catch (e) {}
  sfx.play('babble', 1); setTimeout(() => sfx.play('babble', 1), 300);
}

/* ---------- phones: no stuck zoom, and full screen where the phone allows it ---------- */
const IS_IOS = /iP(hone|od)/.test(navigator.userAgent);
const STANDALONE = (navigator.standalone === true) || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
const CAN_FS = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) && !IS_IOS;
// Safari ignores "no zoom" in the page settings, so stop pinches and double-taps by hand
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1 || APP.mode !== 'lobby') e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => { const now = performance.now(); if (now - lastTouchEnd < 350 && e.target.tagName !== 'INPUT') e.preventDefault(); lastTouchEnd = now; }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
// if it zoomed in anyway, snap it back out
function unzoom() { const m = document.querySelector('meta[name=viewport]'), c = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  m.setAttribute('content', c + ',minimum-scale=1'); setTimeout(() => m.setAttribute('content', c), 60); }
if (window.visualViewport) visualViewport.addEventListener('resize', () => { if (visualViewport.scale > 1.02) unzoom(); });
addEventListener('orientationchange', () => setTimeout(unzoom, 300));
function goFull() {
  if (CAN_FS && !document.fullscreenElement) { const el = document.documentElement; const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r && r.catch) r.catch(() => {}); }
  else if (IS_IOS && !STANDALONE) $('homeSheet').classList.add('on');
  else if (document.fullscreenElement) document.exitFullscreen();
}
$('fs').onclick = goFull; $('homeTipBtn').onclick = () => $('homeSheet').classList.add('on'); $('homeClose').onclick = () => $('homeSheet').classList.remove('on');
$('fs').hidden = STANDALONE || !(CAN_FS || IS_IOS); $('homeTip').hidden = !(IS_IOS && !STANDALONE);
// opened from the Home Screen: go straight to joining
if (/[?&]app=1/.test(location.search)) setTimeout(() => page('join'), 0);

/* ---------- starting and ending a match ---------- */
function startMsg(slot) { return { t: 'start', lv: APP.S.L.id, seed: APP.S.L.seed, mess: APP.messKey, area: APP.S.L.area, roster: APP.roster, slot }; }
function buildFor(L, rost) { disposeWorld(scene, APP.W); APP.W = buildWorld(scene, L, rost); APP.L = L; APP.roster = rost; }
function startMatch(kind, area) {
  endDraw();
  const solo = kind === 'solo', lv = solo ? APP.soloLv : APP.lv, mess = solo ? APP.soloMess : APP.mess;
  const seed = (Math.random() * 1e9) | 0;
  if (kind === 'xr') { area = area || APP.area; APP.area = area; } else area = JSON.parse(JSON.stringify(DEFAULT_AREA));
  const S = newMatch(lv, seed, mess, { botToddler: kind !== 'xr' }, JSON.parse(JSON.stringify(area))); S.botSpeed = BOT_SPEED[solo ? APP.soloBot : APP.bot];
  APP.S = S; APP.kind = kind; APP.messKey = mess; APP.mode = 'game'; APP.endShown = false; APP.endCard = false; APP.momSaid = false; APP.momSpoke = {}; APP.vrEnd = false;
  buildFor(S.L, roster(S));
  if (solo) addPlayer(S, 'local', 0);
  for (const pid in APP.lobbyPlayers) addPlayer(S, pid, APP.lobbyPlayers[pid]);
  if (NET.host) for (const pid in NET.conns) sendTo(pid, startMsg(APP.lobbyPlayers[pid] || 0));
  APP.viewer = kind === 'xr' ? 'toddler' : solo ? 'toy' : 'watch'; APP.me = { viewer: APP.viewer, body: -1, slotOf: {}, giant: [false, false] }; APP.myPid = 'local';
  CAMW.yaw = BOX.yaw + Math.PI; CAMW.tgt.set(AREA.cx, 0, AREA.cz); CAMW.dist = Math.hypot(AREA.maxX - AREA.minX, AREA.maxZ - AREA.minZ) * 0.55; CAMW.pitch = 0.85; CAM.have = false; APP.lastBody = -1; BANNER.until = 0; VRUI.hide();
  enterGameUI();
}
function clientStart(m) {
  const L = makeLevel(m.lv, m.seed, m.area); buildFor(L, m.roster); APP.messKey = m.mess;
  APP.mode = 'game'; APP.kind = 'client'; APP.viewer = 'toy'; APP.me = { viewer: 'toy', body: -1, slotOf: {} }; APP.myPid = NET.myId; APP.snaps = []; APP.off = null; APP.cur = null; APP.endShown = false; APP.endCard = false; APP.momSaid = false; APP.momSpoke = {};
  CAM.have = false; APP.lastBody = -1;
  enterGameUI();
}
function enterGameUI() {
  $('toyCard').classList.remove('on');
  $('ui').style.display = 'none'; $('hud').classList.add('on'); $('end').classList.remove('on'); document.body.classList.add('playing');
  const toy = APP.viewer === 'toy'; $('pad').hidden = !toy; $('who').hidden = !toy;
  $('keys').hidden = !(toy && !matchMedia('(pointer:coarse)').matches);
  $('again').hidden = APP.kind === 'client'; $('toLobby').textContent = APP.kind === 'client' ? 'Leave' : 'Lobby';
  unzoom(); $('fs').hidden = !toy || STANDALONE || !(CAN_FS || IS_IOS);
}
function toLobby(pg) {
  APP.mode = 'lobby'; APP.S = null; musicStop(); disposeWorld(scene, APP.W); APP.W = null; endDraw(); VRUI.hide();
  try { speechSynthesis.cancel(); } catch (e) {}
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
renderer.xr.addEventListener('sessionend', () => { XRF.base = XRF.bounded = XRF.guardian = null; if (APP.mode === 'draw' || (APP.mode === 'game' && APP.kind === 'xr')) toLobby('host'); });

/* ---------- phone controls ---------- */
const INP = { jx: 0, jy: 0, jc: 0, gc: 0, sc: 0, wc: 0, gh: false, jh: false };
const CAM = { heading: 0, yawS: 0, pitch: 0.3, dist: 0.62, tgt: V(), have: false, fly: 0, t: 0 };   // heading: where your toy faces; the camera swings round behind it
const CAMW = { yaw: Math.PI, pitch: 0.62, dist: 5.2, tgt: V(0, 0, 0) };
(function touch() {
  const joy = $('joy'), stick = $('stick'), nub = stick.querySelector('i'); let jid = null, jx0 = 0, jy0 = 0;
  joy.addEventListener('pointerdown', e => { sfx.init(); jid = e.pointerId; jx0 = e.clientX; jy0 = e.clientY; stick.style.display = 'block'; stick.style.left = jx0 + 'px'; stick.style.top = jy0 + 'px'; try { joy.setPointerCapture(e.pointerId); } catch (_) {} });
  joy.addEventListener('pointermove', e => { if (e.pointerId !== jid) return; let dx = (e.clientX - jx0) / 50, dy = (e.clientY - jy0) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } INP.jx = dx; INP.jy = -dy; nub.style.transform = `translate(${dx * 34}px,${dy * 34}px)`; });
  const jend = e => { if (e.pointerId !== jid) return; jid = null; INP.jx = INP.jy = 0; stick.style.display = 'none'; nub.style.transform = ''; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  const look = $('look'); let lid = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', e => { sfx.init(); lid = e.pointerId; lx = e.clientX; ly = e.clientY; try { look.setPointerCapture(e.pointerId); } catch (_) {} });
  look.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; CAM.heading -= (e.clientX - lx) * 0.009; CAM.pitch = clamp(CAM.pitch + (e.clientY - ly) * 0.006, -0.25, 1.2); lx = e.clientX; ly = e.clientY; });
  const lend = e => { if (e.pointerId === lid) lid = null; }; look.addEventListener('pointerup', lend); look.addEventListener('pointercancel', lend);
  const btn = (id, down, up) => { const el = $(id); el.addEventListener('pointerdown', e => { sfx.init(); e.preventDefault(); el.classList.add('down'); down(); try { el.setPointerCapture(e.pointerId); } catch (_) {} });
    const u = () => { el.classList.remove('down'); up && up(); }; el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('lostpointercapture', u); };
  btn('bJump', () => { INP.jc++; INP.jh = true; }, () => INP.jh = false); btn('bGrab', () => { INP.gc++; INP.gh = true; }, () => INP.gh = false);
  btn('bSp', () => INP.sc++); btn('bSwap', () => INP.wc++);
  const keys = {}; addEventListener('keydown', e => { if (APP.mode !== 'game' || e.target.tagName === 'INPUT') return; sfx.init(); if (keys[e.code]) { if (e.code === 'Tab') e.preventDefault(); return; } keys[e.code] = true;
    if (e.code === 'Space') { INP.jc++; INP.jh = true; e.preventDefault(); } if (e.code === 'KeyE' || e.code === 'KeyJ') { INP.gc++; INP.gh = true; } if (e.code === 'KeyQ' || e.code === 'KeyK') INP.sc++; if (e.code === 'Tab') { INP.wc++; e.preventDefault(); } });
  addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') INP.jh = false; if (e.code === 'KeyE' || e.code === 'KeyJ') INP.gh = false; });
  APP.keys = keys;
  const cv = renderer.domElement; let md = false, mx = 0, my = 0;
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; md = true; mx = e.clientX; my = e.clientY; });
  addEventListener('pointerup', () => md = false);
  addEventListener('pointermove', e => { if (!md || APP.mode !== 'game') return; const dx = e.clientX - mx, dy = e.clientY - my; mx = e.clientX; my = e.clientY;
    if (APP.viewer === 'watch') { CAMW.yaw -= dx * 0.006; CAMW.pitch = clamp(CAMW.pitch + dy * 0.004, 0.3, 1.5); } else { CAM.heading -= dx * 0.007; CAM.pitch = clamp(CAM.pitch + dy * 0.005, -0.25, 1.2); } });
  addEventListener('wheel', e => { if (APP.viewer === 'watch') CAMW.dist = clamp(CAMW.dist * (1 + e.deltaY * 0.001), 0.8, 5); else CAM.dist = clamp(CAM.dist * (1 + e.deltaY * 0.001), 0.3, 1.5); }, { passive: true });
})();
// steering, like driving or flying: left/right turns your toy (and the camera with it), up/down goes forward/back
function toyMove() {
  const now = performance.now(), dt = Math.min(0.1, (now - (CAM.t || now)) / 1000); CAM.t = now;
  let jx = INP.jx, jy = INP.jy; const k = APP.keys || {};
  const kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), ky = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
  if (kx || ky) { jx = kx; jy = ky; }
  const turn = Math.sign(jx) * Math.max(0, Math.abs(jx) - 0.12) / 0.88;
  CAM.heading -= turn * (jy < -0.2 ? -1 : 1) * 2.7 * dt;
  const s = Math.sin(CAM.heading), c = Math.cos(CAM.heading), fwdIn = Math.abs(jy) < 0.15 ? 0 : jy;
  return { mx: s * fwdIn, mz: c * fwdIn, ax: s, az: c, hy: CAM.heading, jc: INP.jc, gc: INP.gc, sc: INP.sc, wc: INP.wc, gh: INP.gh, jh: INP.jh };
}

/* ---------- the headset: hands (tracked or controllers), buttons you poke ---------- */
const HANDS = [{ side: 'right' }, { side: 'left' }].map(h => Object.assign(h, { grip: null, hand: null, src: null, prev: {}, gripping: false, J: Array.from({ length: 25 }, () => V()), Jg: Array.from({ length: 25 }, () => V()), tip: V(), realTip: V(), ok: false }));
for (let i = 0; i < 2; i++) {
  const g = renderer.xr.getControllerGrip(i), c = renderer.xr.getController(i), hd = renderer.xr.getHand(i); rig.add(g, c, hd);
  c.addEventListener('connected', e => { const side = e.data && e.data.handedness; const H = HANDS[side === 'left' ? 1 : 0]; H.grip = g; H.hand = hd; H.ray = c; H.src = e.data; H.prev = {}; H.sel = false; if (side === 'left' && !e.data.hand) g.add(WRIST.m); });
  c.addEventListener('disconnected', e => { for (const H of HANDS) if (H.grip === g) { H.src = null; H.ok = false; H.sel = false; } });
  c.addEventListener('selectstart', () => { for (const H of HANDS) if (H.ray === c) H.sel = true; });
  c.addEventListener('selectend', () => { for (const H of HANDS) if (H.ray === c) H.sel = false; });
}
const WRIST = canvasPanel(0.13, 0.075, 2400); WRIST.m.position.set(0, 0.03, 0.09); WRIST.m.rotation.x = -1.0;
const BANNER = canvasPanel(0.9, 0.34, 900); BANNER.m.position.set(0, 0.12, -0.85); camera.add(BANNER.m); BANNER.m.visible = false; BANNER.until = 0;
const SPLAT = canvasPanel(0.5, 0.3, 600); SPLAT.m.position.set(0, 0, -0.16); camera.add(SPLAT.m); SPLAT.m.material.opacity = 0;
const CONF = canvasPanel(0.5, 0.3, 600); CONF.m.position.set(0, 0, -0.17); camera.add(CONF.m); CONF.m.material.opacity = 0;
const BUB = canvasPanel(0.5, 0.3, 600); BUB.m.position.set(0, 0, -0.165); camera.add(BUB.m); BUB.m.material.opacity = 0;
// drowsy eyelids (the record player's lullaby): close from the top and bottom down to a slit
const LIDS = [0, 1].map(i => { const P = canvasPanel(0.8, 0.4, 300), x = P.x, w = P.cv.width, h = P.cv.height, g = x.createLinearGradient(0, i ? h : 0, 0, i ? 0 : h);
  g.addColorStop(0, 'rgba(26,14,22,1)'); g.addColorStop(0.86, 'rgba(46,20,34,.98)'); g.addColorStop(1, 'rgba(90,40,60,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); P.t.needsUpdate = true;
  P.m.position.set(0, i ? -0.5 : 0.5, -0.15); P.m.renderOrder = 12; camera.add(P.m); P.m.visible = false; return P.m; });
function lids(d) { const t = performance.now() / 1000, f = d > 0.05 ? clamp(d * 0.9 + Math.sin(t * 1.4) * 0.05 * d, 0, 0.93) : 0;
  const half = renderer.xr.isPresenting ? 0.17 : 0.15 * Math.tan(camera.fov * Math.PI / 360), edge = half * (1 - f), c = edge + 0.2 - 0.4 * 0.07;   // where the lid's soft edge sits, from the middle of your view
  LIDS[0].visible = LIDS[1].visible = f > 0; LIDS[0].position.y = c; LIDS[1].position.y = -c; }
(() => { const w = SPLAT.cv.width, h = SPLAT.cv.height, x = SPLAT.x; for (let i = 0; i < 40; i++) { const px = Math.random() * w, py = Math.random() * h, r = 8 + Math.random() * 40; const g = x.createRadialGradient(px - r * 0.3, py - r * 0.3, 1, px, py, r); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.4, 'rgba(160,215,255,.55)'); g.addColorStop(1, 'rgba(90,170,255,.15)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); } SPLAT.t.needsUpdate = true;
  const y = CONF.x, C = ['#ff3e8a', '#ffd400', '#00c2b3', '#2f5cff', '#9b5cff']; for (let i = 0; i < 160; i++) { y.save(); y.translate(Math.random() * w, Math.random() * h); y.rotate(Math.random() * 3); y.fillStyle = C[i % 5]; y.fillRect(-6, -3, 12, 6); y.restore(); } CONF.t.needsUpdate = true;
  const z = BUB.x; for (let i = 0; i < 22; i++) { const px = Math.random() * w, py = Math.random() * h, r = 20 + Math.random() * 60; z.strokeStyle = 'rgba(200,230,255,.8)'; z.lineWidth = 4; z.fillStyle = 'rgba(190,140,255,.18)'; z.beginPath(); z.arc(px, py, r, 0, TAU); z.fill(); z.stroke(); z.fillStyle = 'rgba(255,255,255,.8)'; z.beginPath(); z.arc(px - r * 0.4, py - r * 0.4, r * 0.15, 0, TAU); z.fill(); } BUB.t.needsUpdate = true; })();
function banner(big, small, secs) {
  if (APP.viewer === 'toddler' || APP.mode === 'draw') { const P = BANNER, x = P.x, w = P.cv.width, h = P.cv.height; x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,253,247,.94)'; x.strokeStyle = '#15121a'; x.lineWidth = 8; rr(x, 6, 6, w - 12, h - 12, 26); x.fill(); x.stroke();
    x.textAlign = 'center'; x.fillStyle = '#15121a'; x.font = `400 ${small ? 92 : 120}px Bungee, Rubik, sans-serif`; x.fillText(big, w / 2, small ? 128 : 190);
    if (small) { x.font = '800 34px Rubik, sans-serif'; String(small).split('\n').forEach((l, i) => x.fillText(l, w / 2, 196 + i * 46)); }
    P.t.needsUpdate = true; P.m.visible = true; P.until = performance.now() + (secs || 2) * 1000; return; }
  const el = $('banner'); el.innerHTML = big + (small ? `<br><small>${small}</small>` : ''); el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), (secs || 2) * 1000);
}
function toast(t, secs) { const el = $('toast'); if (!t) { el.classList.remove('on'); return; } el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), (secs || 2.2) * 1000); }
function buzz(i, amp, ms) { const s = HANDS[i].src, a = s && s.gamepad && s.gamepad.hapticActuators && s.gamepad.hapticActuators[0]; if (a && a.pulse) try { a.pulse(amp, ms); } catch (e) {} }
const headL = V(0, 1.2, 0), headLQ = Q();
const CURL_IDX = [[1, 2, 3, 4], [5, 6, 8, 9], [10, 11, 13, 14], [15, 16, 18, 19], [20, 21, 23, 24]];
// read both hands: tracked fingers become giant fingers, scaled out from the palm so your palm stays where it really is
function readHands(frame) {
  const pose = frame && frame.getViewerPose(renderer.xr.getReferenceSpace());
  if (pose) { const t = pose.transform; headL.set(t.position.x, t.position.y, t.position.z); headLQ.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w); }
  const out = [];
  for (let i = 0; i < 2; i++) {
    const H = HANDS[i], src = H.src; H.ok = false;
    if (src && src.hand && H.hand && H.hand.joints && H.hand.joints.wrist && H.hand.joints.wrist.visible !== false) {
      const Jn = H.hand.joints; let all = true; for (let k = 0; k < 25; k++) { const j = Jn[HJ[k]]; if (!j) { all = false; break; } H.J[k].copy(j.position); } if (!all) { out.push({ on: false }); continue; }
      const pc = H.J[0].clone().lerp(H.J[11], 0.6); for (let k = 0; k < 25; k++) H.Jg[k].copy(H.J[k]).sub(pc).multiplyScalar(HAND_SCALE).add(pc);
      const curl = CURL_IDX.map((f, fi) => { const a = V().subVectors(H.J[f[1]], H.J[f[0]]).normalize(), b = V().subVectors(H.J[f[3]], H.J[f[2]]).normalize(); return clamp(Math.acos(clamp(a.dot(b), -1, 1)) / (fi === 0 ? 1.2 : 2.3), 0, 1); });
      const mean = (curl[1] + curl[2] + curl[3] + curl[4]) / 4, pinch = H.J[4].distanceTo(H.J[9]);
      if (!H.gripping && (mean > 0.55 || pinch < 0.022)) H.gripping = true; else if (H.gripping && mean < 0.36 && pinch > 0.045) H.gripping = false;
      H.tip.copy(H.Jg[9]); H.realTip.copy(H.J[9]); H.ok = true;
      out.push({ on: true, tracked: true, p: pc, q: Jn.wrist.quaternion.clone(), grip: H.gripping, trig: false, curl, j: H.Jg });
    } else if (src && H.grip && src.gamepad) {
      const gp = src.gamepad, bt = k => !!(gp.buttons[k] && (gp.buttons[k].pressed || gp.buttons[k].value > 0.5)), edge = (k, v) => { const e = v && !H.prev[k]; H.prev[k] = v; return e; };
      const grip = bt(1), trig = bt(0); H.btn = { a: edge('a', bt(4)), b: edge('b', bt(5)), t: edge('t', trig) };
      H.tip.copy(V(0, -0.02, -0.12 * HAND_SCALE).applyQuaternion(H.grip.quaternion).add(H.grip.position)); H.realTip.copy(V(0, 0, -0.05).applyQuaternion(H.grip.quaternion).add(H.grip.position)); H.ok = true;
      out.push({ on: true, tracked: false, p: H.grip.position.clone(), q: H.grip.quaternion.clone(), grip, trig });
    } else out.push({ on: false });
  }
  return out;
}

/* poke-able floating buttons, for setup and between rounds */
const VRUI = { g: new THREE.Group(), btns: [], cool: 0, panel: null,
  show(title, body, buttons, keep) { const pos = this.g.position.clone(), q = this.g.quaternion.clone(), had = !!this.g.parent; this.hide(); const g = this.g; scene.add(g);
    const PW = 0.74, lines = String(body).split('\n'), ph = Math.max(0.26, 0.15 + lines.length * 0.038);
    const P = canvasPanel(PW, ph, 1000), x = P.x, w = P.cv.width, h = P.cv.height; x.fillStyle = 'rgba(255,253,247,.96)'; x.strokeStyle = '#15121a'; x.lineWidth = 10; rr(x, 6, 6, w - 12, h - 12, 28); x.fill(); x.stroke();
    x.fillStyle = '#15121a'; x.textAlign = 'center'; const fit = (font, sz, min, txt) => { do { x.font = font.replace('#', sz); sz -= 2; } while (Math.max(...txt.map(t => x.measureText(t).width)) > w - 56 && sz > min); };
    fit('400 #px Bungee, Rubik, sans-serif', 54, 30, [title]); x.fillText(title, w / 2, 80); fit('700 #px Rubik, sans-serif', 30, 18, lines); lines.forEach((l, i) => x.fillText(l, w / 2, 130 + i * 38)); P.t.needsUpdate = true;
    P.m.material.depthTest = true; P.m.position.y = 0.13 - ph / 2; g.add(P.m); this.panel = { m: P.m, w: PW, h: ph };
    const n = buttons.length, per = n > 4 ? 3 : n, bw = PW / per - 0.015, top = 0.13 - ph - 0.065;
    buttons.forEach((b, i) => { const B = canvasPanel(bw, 0.09, 1000), y = B.x, row = Math.floor(i / per), inRow = Math.min(per, n - row * per), col = i % per;
      y.fillStyle = b.col || '#ffd400'; y.strokeStyle = '#15121a'; y.lineWidth = 10; rr(y, 6, 6, B.cv.width - 12, B.cv.height - 12, 20); y.fill(); y.stroke();
      y.fillStyle = '#15121a'; y.textAlign = 'center'; let fs = 36; do { y.font = `800 ${fs}px Rubik, sans-serif`; fs -= 2; } while (y.measureText(b.label).width > B.cv.width - 34 && fs > 16);
      y.fillText(b.label, B.cv.width / 2, B.cv.height / 2 + 13); B.t.needsUpdate = true; B.m.material.depthTest = true;
      B.m.position.set(-(inRow * (bw + 0.015)) / 2 + (bw + 0.015) / 2 + col * (bw + 0.015), top - row * 0.105, 0.01); g.add(B.m); this.btns.push({ m: B.m, w: bw, h: 0.09, fn: b.fn, was: false }); });
    if (keep && had) { g.position.copy(pos); g.quaternion.copy(q); this.cool = 0.25; return; }
    // stand it up in front of you, a little below your eyes, facing you
    const hw = headL.clone(), f = V(0, 0, -1).applyQuaternion(headLQ); f.y = 0; if (f.lengthSq() < 1e-3) f.set(0, 0, -1); f.normalize();
    g.position.copy(hw).addScaledVector(f, 0.55); g.position.y = Math.max(0.35, hw.y - 0.12); g.lookAt(hw.x, g.position.y, hw.z); this.cool = 0.5; },
  hide() { this.g.clear(); scene.remove(this.g); this.btns = []; this.panel = null; },
  // where a pointing ray hits the panel or a button (or null)
  rayOn(m, w, h, o, d) { const l0 = m.worldToLocal(o.clone()), l1 = m.worldToLocal(o.clone().add(d)), dz = l1.z - l0.z; if (Math.abs(dz) < 1e-6) return null; const t = -l0.z / dz; if (t <= 0) return null;
    const p = l0.addScaledVector(l1.sub(l0), t); return Math.abs(p.x) < w / 2 && Math.abs(p.y) < h / 2 ? m.localToWorld(p) : null; },
  hits(o, d) { if (!this.g.parent) return null; this.g.updateMatrixWorld(true); for (const b of this.btns) { const p = this.rayOn(b.m, b.w, b.h, o, d); if (p) return p; } return this.panel ? this.rayOn(this.panel.m, this.panel.w, this.panel.h, o, d) : null; },
  update(dt, tips, rays) { this.cool -= dt; if (!this.btns.length) return; this.g.updateMatrixWorld(true);
    for (const b of this.btns) { let inside = false, aimed = false, click = false;
      for (const t of tips) { const l = b.m.worldToLocal(t.clone()); if (Math.abs(l.x) < b.w / 2 && Math.abs(l.y) < b.h / 2 && l.z < 0.04 && l.z > -0.06) inside = true; }
      for (const r of rays || []) if (this.rayOn(b.m, b.w, b.h, r.o, r.d)) { aimed = true; if (r.sel) click = true; }
      b.m.position.z = inside ? -0.005 : 0.01; b.m.scale.setScalar(aimed ? 1.07 : 1);
      if (((inside && !b.was) || click) && this.cool <= 0) { this.cool = 0.4; sfx.play('pop', 0.8); for (let i = 0; i < 2; i++) buzz(i, 0.4, 30); b.fn(); return; } b.was = inside; } },
};

/* ---------- mixed-reality setup, like the Quest's own boundary setup ----------
   1. Set the floor. The grid is the game's floor: confirm it, nudge it, or pinch / pull the trigger to move it to your hand
      (raise it to a table or chest height to play standing up). The whole game then sits on that floor.
   2. Outline your space. Point at the floor and hold the trigger (or pinch) to paint round your clear space.
      Nothing closes on its own: press Done. */
const XRF = { base: null, bounded: null, guardian: null };   // the headset's own floor space, and its boundary if it shares one
try { APP.floorH = +(localStorage.getItem('toybox-floor') || 0) || 0; } catch (e) { APP.floorH = 0; }
function setFloor(h) {
  APP.floorH = Math.round(clamp(h, -0.1, 1.7) * 100) / 100; try { localStorage.setItem('toybox-floor', APP.floorH); } catch (e) {}
  if (XRF.base && typeof XRRigidTransform !== 'undefined') try { renderer.xr.setReferenceSpace(XRF.base.getOffsetReferenceSpace(new XRRigidTransform({ x: 0, y: APP.floorH, z: 0 }))); } catch (e) {}
}
// move the floor without the panel or your hands jumping (they're measured from the floor)
function moveFloor(h) { const old = APP.floorH || 0; setFloor(h); const d = APP.floorH - old; VRUI.g.position.y -= d; headL.y -= d; for (const H of HANDS) { H.realTip.y -= d; H.tip.y -= d; } if (DRAW.grid) DRAW.grid.children[0].material.opacity = 0.9; }
// pointing: each controller's (or tracked hand's) aim ray, and whether you just pulled the trigger / pinched
function xrRays() {
  const out = [];
  for (const H of HANDS) { const c = H.ray; if (!H.src || !c || c.visible === false) { H.selPrev = false; continue; } c.updateMatrixWorld(true);
    const o = V().setFromMatrixPosition(c.matrixWorld), d = V(0, 0, -1).transformDirection(c.matrixWorld), held = !!H.sel, edge = held && !H.selPrev; H.selPrev = held;
    out.push({ H, o, d, held, sel: edge }); }
  return out;
}
// the visible laser + floor dot for each hand
const RAYS = [0, 1].map(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })); line.frustumCulled = false; line.visible = false; scene.add(line);
  const dot = new THREE.Mesh(new THREE.RingGeometry(0.025, 0.045, 24), new THREE.MeshBasicMaterial({ color: 0xff3e8a, side: THREE.DoubleSide })); dot.rotation.x = -Math.PI / 2; dot.visible = false; scene.add(dot); return { line, dot }; });
function showRay(i, o, to, col, floorHit) { const R = RAYS[i], a = R.line.geometry.attributes.position; a.setXYZ(0, o.x, o.y, o.z); a.setXYZ(1, to.x, to.y, to.z); a.needsUpdate = true; R.line.material.color.set(col); R.line.visible = true;
  R.dot.visible = !!floorHit; if (floorHit) { R.dot.position.set(floorHit.x, 0.008, floorHit.z); R.dot.material.color.set(col === '#ffd400' ? '#ffd400' : '#ff3e8a'); } }
function hideRays() { for (const R of RAYS) R.line.visible = R.dot.visible = false; }
const floorHit = (o, d) => { if (d.y > -0.03) return null; const t = -o.y / d.y; return t > 0 && t < 10 ? o.clone().addScaledVector(d, t) : null; };

const DRAW = { step: 'floor', pts: [], strokes: [], line: null, close: null, fill: null, grid: null, end: null };
function startDraw() {
  APP.mode = 'draw'; APP.viewer = 'toddler'; endDraw(); DRAW.pts = []; DRAW.strokes = []; DRAW.step = 'floor'; DRAW.msg = ''; DRAW.room = null;
  $('ui').style.display = 'none';
  if (xrMode === 'immersive-ar') { scene.background = null; renderer.setClearColor(0x000000, 0); } else scene.background = new THREE.Color('#2a2340');
  scene.fog = null; setFloor(APP.floorH || 0);
  // the floor grid, round where you stand
  DRAW.grid = new THREE.Group(); const gh = new THREE.GridHelper(6, 24, 0xffd400, 0x00c2b3); gh.material.transparent = true; gh.material.opacity = 0.75; DRAW.grid.add(gh);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshBasicMaterial({ color: 0x00c2b3, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); disc.rotation.x = -Math.PI / 2; DRAW.grid.add(disc);
  DRAW.grid.position.set(headL.x, 0.002, headL.z); scene.add(DRAW.grid);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 3000), 3)); geo.setDrawRange(0, 0);
  DRAW.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd400 })); DRAW.line.frustumCulled = false; scene.add(DRAW.line);
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  DRAW.close = new THREE.Line(cg, new THREE.LineBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.35 })); DRAW.close.frustumCulled = false; DRAW.close.visible = false; scene.add(DRAW.close);
  DRAW.end = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.09, 32), new THREE.MeshBasicMaterial({ color: 0xffd400, side: THREE.DoubleSide, transparent: true })); DRAW.end.rotation.x = -Math.PI / 2; DRAW.end.visible = false; scene.add(DRAW.end);
  if (NET.host) sendAll({ t: 'lobby', lv: APP.lv, mess: APP.mess, n: Object.keys(APP.lobbyPlayers).length, drawing: true });
  setTimeout(drawPanel, 300);
}
function drawPanel(keep) {
  if (APP.mode !== 'draw') return; const cm = Math.round((APP.floorH || 0) * 100);
  if (DRAW.step === 'floor') VRUI.show('1 · Set the floor', `The grid is the game's floor: ${cm === 0 ? 'on your real floor' : cm + ' cm ' + (cm > 0 ? 'above' : 'below') + ' your real floor'}.\nPinch or pull the trigger to move it to your hand.\nRaise it to a table or chest height to play standing.`,
    [{ label: '▲ Up', fn: () => { moveFloor(APP.floorH + 0.05); drawPanel(true); }, col: '#fffdf7' }, { label: '▼ Down', fn: () => { moveFloor(APP.floorH - 0.05); drawPanel(true); }, col: '#fffdf7' }, { label: 'Real floor', fn: () => { moveFloor(0); drawPanel(true); }, col: '#00c2b3' },
     { label: 'Confirm ✓', fn: () => { DRAW.step = 'outline'; sfx.play('go', 0.6); drawPanel(); }, col: '#ff3e8a' }], keep);
  else { const a = roomArea();
    VRUI.show('2 · Outline your space', (DRAW.msg ? '⚠ ' + DRAW.msg + '\n' : '') + `Point at the floor and hold the trigger (or pinch) to draw\nround your clear space. ${a ? 'The room that fits (pink) is ' + a.toFixed(1) + ' m².' : 'Lines join up on their own.'}\nPress Done when you're happy. It won't close till you do.`,
      [{ label: 'Done ✓', fn: doneOutline, col: '#ff3e8a' }, { label: 'Undo', fn: () => { if (DRAW.strokes.length) { DRAW.pts.length = DRAW.strokes.pop(); drawLine(); drawFill(); drawPanel(true); } }, col: '#fffdf7' },
       { label: 'Clear', fn: () => { DRAW.pts = []; DRAW.strokes = []; drawLine(); drawFill(); drawPanel(true); }, col: '#fffdf7' },
       { label: '2×2 m here', fn: useSquare, col: '#00c2b3' }].concat(XRF.guardian ? [{ label: 'Quest boundary', fn: () => confirmArea(orthoRoom(XRF.guardian) || simplifyArea(XRF.guardian.map(([x, z]) => ({ x, z })))), col: '#ffd400' }] : [],
       [{ label: '← Floor', fn: () => { DRAW.step = 'floor'; drawPanel(); }, col: '#fffdf7' }]), keep); }
}
function doneOutline() {
  if (DRAW.pts.length < 3) { DRAW.msg = 'Draw first: point at the floor and hold the trigger (or pinch).'; sfx.play('tick', 1); drawPanel(true); return; }
  const poly = DRAW.room || orthoRoom(DRAW.pts), a = poly ? polyArea(poly) : 0;
  if (a < 1.0) { DRAW.msg = `A bit small (${a.toFixed(1)} m²): keep drawing round a bigger space, or use 2×2 m.`; sfx.play('tick', 1); drawPanel(true); return; }
  sfx.play('win', 0.8); buzz(0, 0.6, 120); buzz(1, 0.6, 120); confirmArea(poly);
}
function drawLine() { const P = DRAW.pts, a = DRAW.line.geometry.attributes.position; let n = Math.min(P.length, 2999); for (let i = 0; i < n; i++) a.setXYZ(i, P[i].x, 0.006, P[i].z); a.needsUpdate = true; DRAW.line.geometry.setDrawRange(0, n);
  DRAW.close.visible = P.length > 2; if (P.length > 2) { const c = DRAW.close.geometry.attributes.position, l = P[P.length - 1]; c.setXYZ(0, l.x, 0.006, l.z); c.setXYZ(1, P[0].x, 0.006, P[0].z); c.needsUpdate = true; } }
// the room that fits inside your outline (straight walls, square corners): filled pink with its walls drawn on the floor
function drawFill() { if (DRAW.fill) { scene.remove(DRAW.fill); DRAW.fill = null; } DRAW.room = DRAW.pts.length >= 3 ? orthoRoom(DRAW.pts) : null; if (!DRAW.room) return;
  const poly = DRAW.room, sh = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], -p[1]))), g = new THREE.Group();
  const f = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xff3e8a, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })); f.rotation.x = -Math.PI / 2; f.position.y = 0.004; g.add(f);
  const lg = new THREE.BufferGeometry().setFromPoints(poly.concat([poly[0]]).map(p => V(p[0], 0.012, p[1]))); g.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xff3e8a })));
  DRAW.fill = g; scene.add(g); }
const roomArea = () => DRAW.room ? polyArea(DRAW.room) : 0;
// the headset's own boundary (if the browser shares it), turned into our floor's coordinates
function guardianPoly(frame) { try { const pose = frame.getPose(XRF.bounded, XRF.base); if (!pose) return; const m = new THREE.Matrix4().fromArray(pose.transform.matrix);
  XRF.guardian = Array.from(XRF.bounded.boundsGeometry).map(p => { const v = V(p.x, 0, p.z).applyMatrix4(m); return [r3(v.x), r3(v.z)]; }); if (APP.mode === 'draw' && DRAW.step === 'outline') drawPanel(true); } catch (e) { XRF.bounded = null; } }
function drawStep(dt, frame) {
  readHands(frame); rig.updateMatrixWorld(true);
  if (frame && XRF.bounded && !XRF.guardian) guardianPoly(frame);
  if (DRAW.grid) { const k = Math.min(1, dt * 1.5); DRAW.grid.position.x += (headL.x - DRAW.grid.position.x) * k; DRAW.grid.position.z += (headL.z - DRAW.grid.position.z) * k; const m = DRAW.grid.children[0].material; m.opacity += (0.75 - m.opacity) * Math.min(1, dt * 2); }
  const tips = HANDS.filter(H => H.ok).map(H => H.realTip.clone()), rays = xrRays(); let moved = false;
  hideRays();
  rays.forEach((r, i) => { const H = r.H, onUI = VRUI.hits(r.o, r.d), hit = floorHit(r.o, r.d);
    showRay(i, r.o, onUI || hit || r.o.clone().addScaledVector(r.d, 2), r.held ? '#ffd400' : '#ffffff', onUI ? null : hit);
    if (DRAW.step === 'floor') {   // pinch / trigger away from the panel: the floor comes to your hand
      if (r.sel && !onUI) { const y = H.src.hand ? H.realTip.y : H.grip.position.y - 0.04; moveFloor(APP.floorH + y); sfx.play('pop', 0.8); buzz(HANDS.indexOf(H), 0.5, 60); drawPanel(true); }
      return; }
    // outline: paint while held (a press that starts on the panel is a button press, not paint)
    if (r.sel) { H.painting = !onUI && !!hit; if (H.painting) { DRAW.strokes.push(DRAW.pts.length); DRAW.msg = ''; } }
    if (r.held && H.painting && hit) { const last = DRAW.pts[DRAW.pts.length - 1]; if (DRAW.pts.length < 2999 && (!last || Math.hypot(last.x - hit.x, last.z - hit.z) > 0.05)) { DRAW.pts.push({ x: hit.x, z: hit.z }); moved = true; } }
    if (!r.held && H.painting) { H.painting = false; drawFill(); drawPanel(true); } });
  if (moved) drawLine();
  const end = DRAW.pts[DRAW.pts.length - 1]; if (DRAW.end) { DRAW.end.visible = !!end && DRAW.step === 'outline'; if (end) { DRAW.end.position.set(end.x, 0.007, end.z); DRAW.end.material.opacity = 0.55 + Math.sin(performance.now() / 180) * 0.35; } }
  if (DRAW.line) DRAW.line.visible = DRAW.close.visible = DRAW.step === 'outline' && DRAW.pts.length > 1; if (DRAW.fill) DRAW.fill.visible = DRAW.step === 'outline';
  VRUI.update(dt, tips, rays);
}
function endDraw() { for (const k of ['end', 'line', 'close', 'fill', 'grid']) { if (DRAW[k]) scene.remove(DRAW[k]); DRAW[k] = null; } hideRays(); for (const H of HANDS) H.painting = false; }
function useSquare() { const f = V(0, 0, -1).applyQuaternion(headLQ); f.y = 0; f.normalize(); const r = V(-f.z, 0, f.x), c = headL.clone(); c.y = 0; const s = 1.1;
  const poly = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const p = c.clone().addScaledVector(r, a * s).addScaledVector(f, b * s); return [r3(p.x), r3(p.z)]; }); confirmArea(poly); }
function confirmArea(poly) { VRUI.hide(); hideRays(); const P = poly.map(([x, z]) => ({ x, z })); let st = [r3(headL.x), r3(headL.z)];
  if (!inPoly(P, st[0], st[1])) st = [r3(P.reduce((t, p) => t + p.x, 0) / P.length), r3(P.reduce((t, p) => t + p.z, 0) / P.length)];   // you're standing outside it: start in the middle
  startMatch('xr', { poly, start: st }); }
function polyArea(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
// tidy a traced loop into a few straight walls
function simplifyArea(pts) {
  const P = pts.map(p => [p.x, p.z]);
  const dp = (a, e) => { if (a.length < 3) return a; let dm = 0, im = 0; const [x1, z1] = a[0], [x2, z2] = a[a.length - 1], L = Math.hypot(x2 - x1, z2 - z1) || 1e-6;
    for (let i = 1; i < a.length - 1; i++) { const d = Math.abs((z2 - z1) * a[i][0] - (x2 - x1) * a[i][1] + x2 * z1 - z2 * x1) / L; if (d > dm) { dm = d; im = i; } }
    return dm > e ? dp(a.slice(0, im + 1), e).slice(0, -1).concat(dp(a.slice(im), e)) : [a[0], a[a.length - 1]]; };
  // split the loop at its farthest point so both halves simplify well
  let far = 0, fd = 0; for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[0][0], P[i][1] - P[0][1]); if (d > fd) { fd = d; far = i; } }
  let S = dp(P.slice(0, far + 1), 0.12).slice(0, -1).concat(dp(P.slice(far).concat([P[0]]), 0.12).slice(0, -1));
  for (let k = 0; k < 3; k++) S = S.filter((p, i) => { const q = S[(i + 1) % S.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.3 || S.length <= 3; });
  const crosses = () => { const n = S.length, X = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (X(S[i], S[(i + 1) % n], S[j], S[(j + 1) % n])) return true; } return false; };
  if (S.length < 3 || crosses()) S = hull(P);
  return S.map(p => [r3(p[0]), r3(p[1])]);
}
// the room is orthogonal: the biggest rectangle that fits inside your outline (tried at many angles), plus up to two
// wings (an L or a T) where the outline has room for them. Returns [[x, z], ...] corners, or null if nothing fits.
function orthoRoom(pts) {
  let P = pts.map(p => Array.isArray(p) ? { x: p[0], z: p[1] } : { x: p.x, z: p.z }); if (P.length < 3) return null;
  if (P.length > 240) { const st = P.length / 240; P = Array.from({ length: 240 }, (_, i) => P[Math.floor(i * st)]); }
  const C = 0.08, Q2 = Math.PI / 2, angles = []; for (let a = 0; a < 90; a += 3) angles.push(a * Math.PI / 180);
  const S = simplifyArea(P); for (let i = 0; i < S.length; i++) { const a = S[i], b = S[(i + 1) % S.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.8) angles.push(((Math.atan2(b[1] - a[1], b[0] - a[0]) % Q2) + Q2) % Q2); }
  const minW = Math.ceil(0.9 / C), minD = Math.ceil(0.5 / C), minA = 0.6 / (C * C);
  let best = null;
  for (const th of angles) {
    const c = Math.cos(th), s = Math.sin(th), R = P.map(p => ({ x: p.x * c + p.z * s, z: -p.x * s + p.z * c }));
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of R) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const nx = Math.ceil((x1 - x0) / C), nz = Math.ceil((z1 - z0) / C); if (nx < 3 || nz < 3 || nx * nz > 40000) continue;
    // cells wholly inside the outline (row by row: where the row crosses the outline)
    const In = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (const zz of [z0 + j * C + 0.01, z0 + (j + 1) * C - 0.01]) {
      const xs = []; for (let i = 0, k = R.length - 1; i < R.length; k = i++) { const a = R[i], b = R[k]; if ((a.z > zz) !== (b.z > zz)) xs.push(a.x + (zz - a.z) / (b.z - a.z) * (b.x - a.x)); } xs.sort((a, b) => a - b);
      const row = new Uint8Array(nx); for (let q = 0; q + 1 < xs.length; q += 2) for (let i = Math.max(0, Math.ceil((xs[q] - x0) / C)); i <= Math.min(nx - 1, Math.floor((xs[q + 1] - x0) / C) - 1); i++) row[i] = 1;
      for (let i = 0; i < nx; i++) In[i + j * nx] = (zz === z0 + j * C + 0.01 ? row[i] : In[i + j * nx] & row[i]); }
    // the biggest rectangle of inside cells
    const h = new Int32Array(nx); let r1 = { a: 0 };
    for (let j = 0; j < nz; j++) { for (let i = 0; i < nx; i++) h[i] = In[i + j * nx] ? h[i] + 1 : 0;
      const st = []; for (let i = 0; i <= nx; i++) { const hi = i < nx ? h[i] : 0; let start = i; while (st.length && st[st.length - 1][1] >= hi) { const [si, sh] = st.pop(), a = sh * (i - si); if (a > r1.a) r1 = { a, i0: si, i1: i - 1, j0: j - sh + 1, j1: j }; start = si; } st.push([start, hi]); } }
    if (!r1.a) continue;
    const at = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && In[i + j * nx];
    // a wing off one side: the best rectangle standing on that side, at least 0.9 m wide and 0.5 m deep
    const wing = side => { const along = side < 2 ? [r1.i0, r1.i1] : [r1.j0, r1.j1], dep = [];
      for (let u = along[0]; u <= along[1]; u++) { let d = 0; for (;;) { const i = side === 0 || side === 1 ? u : side === 2 ? r1.i0 - 1 - d : r1.i1 + 1 + d, j = side === 0 ? r1.j0 - 1 - d : side === 1 ? r1.j1 + 1 + d : u; if (!at(i, j)) break; d++; } dep.push(d); }
      let w = null; for (let a = 0; a < dep.length; a++) { let m = 1e9; for (let b = a; b < dep.length; b++) { m = Math.min(m, dep[b]); if (m < minD) break; const ar = (b - a + 1) * m; if (b - a + 1 >= minW && ar >= minA && (!w || ar > w.a)) w = { a: ar, u0: along[0] + a, u1: along[0] + b, d: m, side }; } } return w; };
    const wings = [0, 1, 2, 3].map(wing).filter(Boolean).sort((a, b) => b.a - a.a).slice(0, 2);
    const score = r1.a + wings.reduce((t, w) => t + w.a, 0);
    if (!best || score > best.score + 0.5) best = { score, th, x0, z0, nx, nz, r1, wings };
  }
  if (!best) return null;
  // the room as cells, then its outline
  const { th, x0, z0, nx, nz, r1, wings } = best, M = new Uint8Array(nx * nz), set = (i, j) => { if (i >= 0 && j >= 0 && i < nx && j < nz) M[i + j * nx] = 1; };
  for (let j = r1.j0; j <= r1.j1; j++) for (let i = r1.i0; i <= r1.i1; i++) set(i, j);
  for (const w of wings) for (let u = w.u0; u <= w.u1; u++) for (let d = 0; d < w.d; d++) { if (w.side === 0) set(u, r1.j0 - 1 - d); else if (w.side === 1) set(u, r1.j1 + 1 + d); else if (w.side === 2) set(r1.i0 - 1 - d, u); else set(r1.i1 + 1 + d, u); }
  const m = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && M[i + j * nx], next = new Map(), key = (i, j) => i + ',' + j;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { if (!m(i, j)) continue;
    if (!m(i, j - 1)) next.set(key(i, j), [i + 1, j]); if (!m(i + 1, j)) next.set(key(i + 1, j), [i + 1, j + 1]); if (!m(i, j + 1)) next.set(key(i + 1, j + 1), [i, j + 1]); if (!m(i - 1, j)) next.set(key(i, j + 1), [i, j]); }
  const start = [r1.i0, r1.j0], loop = [start]; let cur = next.get(key(...start)); for (let n = 0; cur && n < 4000 && (cur[0] !== start[0] || cur[1] !== start[1]); n++) { loop.push(cur); cur = next.get(key(...cur)); }
  const corners = loop.filter((p, i) => { const a = loop[(i + loop.length - 1) % loop.length], b = loop[(i + 1) % loop.length]; return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0; });
  const c = Math.cos(th), s = Math.sin(th);
  return corners.map(([i, j]) => { const X = x0 + i * C, Z = z0 + j * C; return [r3(X * c - Z * s), r3(X * s + Z * c)]; });
}
function hull(P) { const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  const h = lo.slice(0, -1).concat(up.slice(0, -1)); return h.length >= 3 ? h : [[-1, -1], [1, -1], [1, 1], [-1, 1]]; }

/* ---------- the toddler during a match: no sticks, just your body ---------- */
function xrToddler(dt, frame) {
  const S = APP.S, hands = readHands(frame);
  rig.updateMatrixWorld(true);
  const head = headL.clone(), hq = headLQ.clone();
  setToddlerPose(S, { head, hq, hands: hands.map(h => h.on ? h : { on: false, p: V(0, -1, 0), q: Q() }) });
  APP.me.joints = hands.map(h => h.on && h.tracked ? { j: h.j, q: h.q } : null);
  const tips = HANDS.filter(H => H.ok).map(H => H.tip.clone()), rays = xrRays();
  hideRays(); if (APP.vrEnd) rays.forEach((r, i) => { const on = VRUI.hits(r.o, r.d); showRay(i, r.o, on || r.o.clone().addScaledVector(r.d, 1.5), on ? '#ffd400' : '#ffffff', null); });
  VRUI.update(dt, tips, rays); if (APP.mode !== 'game' || APP.S !== S) return;
  // controllers: A = again, B = leave, between rounds (or point at a button and pull the trigger)
  if (S.state === 'end' && APP.vrEnd) for (const H of HANDS) { const b = H.btn; if (!b || H.src && H.src.hand) continue; if (b.a) return vrAgain(); if (b.b) return toLobby('host'); }
}
function vrAgain() { startMatch('xr'); }
function vrNext() { const i = SHOWN.findIndex(l => l.id === APP.lv); APP.lv = SHOWN[(i + 1) % SHOWN.length].id; hostLevels(); lobbyInfo(); startMatch('xr'); }
function vrRedraw() { disposeWorld(scene, APP.W); APP.W = null; APP.S = null; musicStop(); if (NET.host) sendAll({ t: 'lobby', lv: APP.lv, mess: APP.mess, n: Object.keys(APP.lobbyPlayers).length, back: true }); startDraw(); }
function wristDraw(s) {
  const P = WRIST, x = P.x, w = P.cv.width, h = P.cv.height, key = [Math.ceil(s.nap), s.ml, s.ph, s.st].join(); if (key === P.last) return; P.last = key;
  x.clearRect(0, 0, w, h); x.fillStyle = '#fffdf7'; x.strokeStyle = '#15121a'; x.lineWidth = 10; rr(x, 6, 6, w - 12, h - 12, 24); x.fill(); x.stroke();
  x.fillStyle = '#15121a'; x.textAlign = 'left'; x.font = '800 30px Rubik, sans-serif'; x.fillText('NAP IN', 26, 46);
  x.font = '400 70px Bungee, Rubik, sans-serif'; x.fillText(fmtT(s.nap), 22, 120);
  x.textAlign = 'right'; x.fillStyle = s.ml ? '#e23b2e' : '#00a651'; x.font = '400 64px Bungee, Rubik, sans-serif'; x.fillText(String(s.ml), w - 26, 104); x.font = '800 26px Rubik, sans-serif'; x.fillStyle = '#15121a'; x.fillText('MESS', w - 26, 136);
  P.t.needsUpdate = true;
}

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

/* ---------- events the app cares about (beyond sounds) ---------- */
function handleEvent(e) {
  const W = APP.W, ear = APP.viewer === 'toddler' ? headL : APP.viewer === 'toy' ? CAM.tgt : camera.getWorldPosition(V());
  onEvent(W, e, ear, APP.viewer);
  const [code, x, y, z, a] = e, toddler = APP.viewer === 'toddler';
  if (code === 'count') banner(String(a), toddler ? 'Crawl around for real · make a fist (or pinch) to grab\nthrow things in the TOY BOX · careful, your hands knock stuff over' : APP.viewer === 'toy' ? 'Make a mess before nap time!' : '', 1.05);
  if (code === 'go') banner(toddler ? 'CLEAN UP!' : 'MAKE A MESS!', toddler ? 'Get the room tidier than this before the clock says NAP' : 'Knock things over, raid the toy box, mess it up', 2.2);
  if (code === 'phase' && a > 0) banner(PHASES[a].name, PHASES[a].sub, 2.2);
  if (toddler) { const p = V(x, y, z), td = APP.S.td;
    for (let i = 0; i < 2; i++) { const d = td.hands[i].p.distanceTo(p); if (d < 0.25) { if (code === 'grab') buzz(i, 0.5, 40); if (code === 'bonk') buzz(i, 1, 160); } }
    if (code === 'slam') { buzz(0, 1, 220); buzz(1, 1, 220); } if (code === 'away') { buzz(0, 0.3, 50); buzz(1, 0.3, 50); } if (code === 'giggle') { buzz(0, 0.6, 600); buzz(1, 0.6, 600); } }
  if (code === 'mess' && APP.viewer === 'toy' && Math.floor(a / 100) === APP.mySlot) popMess(a % 100);
  if (code === 'record' && a) { if (toddler) banner('Lullaby…', 'Your eyes are closing · slap the record player to stop it', 2.4); else toast('🎵 Lullaby! The toddler is getting sleepy', 2.4); }
  if (code === 'click' && !a) { if (toddler) banner('Lights out!', 'Touch the lamp to switch it back on', 2.4); else toast('💡 Lights out! The toddler can barely see', 2.4); }
  if (code === 'eat' && !toddler) toast('😋 The toddler ate a snack', 1.6);
  if (code === 'end') sfx.play('door', 1);
}
function popMess(n) { const el = document.createElement('div'); el.className = 'pop'; el.textContent = '+' + n + ' mess!'; el.style.left = (Math.random() * 60 - 30) + 'px'; $('pops').append(el); setTimeout(() => el.remove(), 1300); sfx.play('tick', 0.5, 1.4 + Math.min(n, 6) * 0.1); }
function showToyCard(T) { if (!T) return; $('tcIcon').textContent = ROLE_ICON[T.role] || '🧸'; $('tcName').textContent = T.name; $('tcSp').textContent = 'Special: ' + T.sp; $('tcDesc').textContent = (T.desc || '') + ' Grab shoves stuff over.';
  const el = $('toyCard'); el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 5000); }
$('who').addEventListener('click', () => { const r = APP.roster && APP.roster[APP.me.body]; if (r) showToyCard(TOYS[r[1]]); });

/* ---------- HUD on phones and the watching screen ---------- */
const PHASE_COL = ['#ff7a1a', '#00c2b3', '#9b5cff', '#ff8fc7'];
function hud(s) {
  if (APP.viewer !== 'toddler') {
    $('clock').lastChild.textContent = s.st === 0 ? fmtT(MATCH_TIME) : fmtT(s.nap);
    const ph = $('phase'); ph.textContent = s.st === 0 ? 'Get ready' : s.st === 2 ? 'Nap time' : PHASES[s.ph].name; ph.style.background = PHASE_COL[s.ph]; ph.style.color = '#15121a';
    const m0 = s.m0 === undefined ? s.ml : s.m0, d = s.ml - m0, me = $('mess'); me.textContent = `Mess ${s.ml} · start ${m0}`; me.style.background = d >= 0 ? '#ffd0dc' : '#c9f5e2';
  }
  if (APP.viewer === 'toy') {
    const c = s.ctl[APP.myPid];
    if (c) { const bi = c[0], r = APP.roster[bi]; APP.me.body = bi;
      if (bi !== APP.lastBody) { if (bi >= 0 && r) { const T = TOYS[r[1]]; $('who').innerHTML = `${ROLE_ICON[T.role] || ''} ${T.name}<small>Special: ${T.sp}</small><span class="mine" id="mine">💥 You made 0 mess</span>`; $('mine')._n = -1; $('spName').textContent = T.sp.replace(/ \(.*\)/, ''); showToyCard(T); if (APP.lastBody >= 0) { toast("Put away! You're the " + T.name + ' now'); sfx.play('hop'); } CAM.fly = 0.5; CAM.have = false; } APP.lastBody = bi; }
      $('spCd').style.height = Math.round(c[2] * 100) + '%'; $('bGrab').textContent = c[3] || 'Shove'; APP.mySlot = c[1];
      const mine = $('mine'); if (mine && mine._n !== c[5]) { mine._n = c[5]; mine.textContent = '💥 You made ' + (c[5] || 0) + ' mess'; } }
    APP.me.slotOf = {}; for (const pid in s.ctl) APP.me.slotOf[s.ctl[pid][0]] = s.ctl[pid][1];
  }
  // mom's visits: she says her line out loud (and the toys freeze)
  const mv = s.st !== 2 && APP.W && momVisit(s.st, s.cd, s.nap); APP.momSpoke = APP.momSpoke || {};
  if (mv && mv.t > 1.1 && mv.t < 3 && !APP.momSpoke[mv.id]) { APP.momSpoke[mv.id] = true; speak(momVisitLine(APP.W, mv.id, s)); if (APP.viewer !== 'toddler' && mv.id !== 's') banner('Mom!', 'Freeze, toys!', 2.4); }
  if (s.st === 2) {
    if (!APP.endShown) { APP.endShown = true; banner(s.end === 1 ? 'What a mess!' : 'Tidy!', s.end === 1 ? 'Uh oh… here comes mom' : 'Here comes mom!', 2.2); }
    if (s.et > 2.4 && !APP.momSaid) { APP.momSaid = true; speak(momLine(APP.W, s.end)); }
    if (s.et > 6.5 && !APP.endCard) { APP.endCard = true; const toysWon = s.end === 1;
      if (APP.viewer === 'toddler') { APP.vrEnd = true; VRUI.show(toysWon ? 'Toys win' : 'You win!', toysWon ? `Grounded! The room is messier than when mom left (${s.ml} vs ${s.m0}). The toys made ${s.tm || 0} mess.` : s.ml === 0 ? 'Everything is in the toy box.' : `Tidier than when mom left (${s.ml} vs ${s.m0}).`,
        [{ label: 'Again', fn: vrAgain, col: '#ff3e8a' }].concat(SHOWN.length > 1 ? [{ label: 'Next room', fn: vrNext, col: '#ffd400' }] : [], [{ label: 'Redraw space', fn: vrRedraw, col: '#00c2b3' }, { label: 'Leave', fn: () => toLobby('host'), col: '#fffdf7' }])); }
      else { $('endT').textContent = toysWon ? 'What a mess! Toys win' : 'Tidy! Toddler wins';
        $('endP').textContent = toysWon ? `Messier than when mom left (${s.ml} vs ${s.m0}). The toddler's grounded.` : s.ml === 0 ? 'Everything\'s in the toy box. Mom says: good kid.' : `Tidier than when mom left (${s.ml} vs ${s.m0}). Mom says: good kid.`;
        const c = APP.viewer === 'toy' && s.ctl[APP.myPid]; if (c) $('endP').textContent += ` You made ${c[5] || 0} mess${s.tm ? ' (all the toys: ' + s.tm + ')' : ''}.`;
        if (APP.kind === 'client') $('endP').textContent += ' Waiting for the toddler to start the next round…'; $('end').classList.add('on'); } }
  } else if (APP.endShown) { APP.endShown = false; APP.endCard = false; APP.momSaid = false; $('end').classList.remove('on'); }
}

/* ---------- the loop ---------- */
let lastT = performance.now();
function loop(t, frame) {
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (APP.mode === 'draw') { drawStep(dt, frame); BANNER.m.visible = performance.now() < BANNER.until; renderer.render(scene, camera); return; }
  if (APP.mode !== 'game' || !APP.W) { if (!NORENDER) renderer.render(scene, camera); return; }
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
    const last = APP.snaps[APP.snaps.length - 1]; s = Object.assign({}, s, { ctl: last.ctl, nap: last.nap, st: last.st, ml: last.ml, end: last.end, ph: last.ph, et: last.et });
  }
  APP.cur = s;
  const playing = s.st === 1, rec = playing && APP.L && APP.L.devices.some((d, i) => d.type === 'record' && s.dv[i] && s.dv[i][0]); if (s.st === 0) musicStop(); else musicPhase(rec ? 4 : s.st === 2 ? 3 : s.ph);
  hud(s); if (APP.viewer === 'toddler') wristDraw(s);
  drawSnap(W, s, s2, k, APP.me, dt);
  if (APP.kind === 'client' && APP.me.body >= 0 && APP.snaps.length > 1) { const n = APP.snaps.length, A = APP.snaps[n - 2].b, B = APP.snaps[n - 1].b, j = APP.me.body * 8, g = W.bodies[APP.me.body].g, dT = Math.max(0.016, APP.snaps[n - 1].T - APP.snaps[n - 2].T);
    if (!(B[j + 7] & 1) && !(A[j + 7] & 1)) { const ahead = 0.04; g.position.set(B[j] + (B[j] - A[j]) / dT * ahead, B[j + 1] + (B[j + 1] - A[j + 1]) / dT * ahead, B[j + 2] + (B[j + 2] - A[j + 2]) / dT * ahead); } }
  phaseLight(W, scene, s.st === 2 ? 3 : s.ph, playing || s.st === 2, dt);
  fxStep(W.fx, dt);
  if (APP.viewer === 'toy') toyCam(dt, s); else if (APP.viewer === 'watch') watchCam(dt);
  if (APP.viewer === 'toddler') { const T = s.td; SPLAT.m.material.opacity = clamp(T[TD.SPLAT], 0, 1) * 0.9; CONF.m.material.opacity = clamp(T[TD.CONF], 0, 1); BUB.m.material.opacity = clamp(T[TD.BUB], 0, 1) * 0.9; lids(s.st === 1 ? T[TD.DROWSY] || 0 : 0); BANNER.m.visible = performance.now() < BANNER.until; }
  if (!document.hidden && !NORENDER) renderer.render(scene, camera);
}
function toyCam(dt, s) {
  const bi = APP.me.body; if (bi < 0 || !APP.W.bodies[bi]) return; const o = APP.W.bodies[bi], p = o.g.position.clone(), r = o.r;
  if (!CAM.have) { const f = V(0, 0, 1).applyQuaternion(o.g.quaternion); CAM.heading = Math.atan2(f.x, f.z); CAM.yawS = CAM.heading + Math.PI; CAM.tgt.copy(p); CAM.have = true; }
  CAM.fly = Math.max(0, CAM.fly - dt);
  CAM.tgt.lerp(p, 1 - Math.exp(-(CAM.fly > 0 ? 5 : 16) * dt));
  let d = CAM.heading + Math.PI - CAM.yawS; d = Math.atan2(Math.sin(d), Math.cos(d)); CAM.yawS += d * (1 - Math.exp(-7 * dt));
  const cp = Math.cos(CAM.pitch), up = r * 0.7, pos = V(CAM.tgt.x + Math.sin(CAM.yawS) * cp * CAM.dist, CAM.tgt.y + up + Math.sin(CAM.pitch) * CAM.dist, CAM.tgt.z + Math.cos(CAM.yawS) * cp * CAM.dist);
  // don't let a tower (or anything else) sit between the camera and your toy: pull in in front of it
  { const tg = V(CAM.tgt.x, CAM.tgt.y + up, CAM.tgt.z), seg = V().subVectors(pos, tg), L2 = seg.lengthSq(); let tmin = 1;
    if (L2 > 1e-4) for (const o of APP.W.bodies) { if (o.i === bi || !o.g.visible) continue; const t = clamp(V().subVectors(o.g.position, tg).dot(seg) / L2, 0, 1); if (t < 0.15 || t >= tmin) continue;
      if (o.g.position.distanceTo(V().copy(tg).addScaledVector(seg, t)) < o.r * 1.1 + 0.03) tmin = t; }
    if (tmin < 1) pos.copy(tg).addScaledVector(seg, Math.max(0.2, tmin - 0.12)); }
  if (!AREA.inside(pos.x, pos.z, 0.08)) { const tg = V(CAM.tgt.x, pos.y, CAM.tgt.z); for (let t = 0.95; t > 0.15; t -= 0.05) { const q = tg.clone().lerp(pos, t); if (AREA.inside(q.x, q.z, 0.08)) { pos.copy(q); break; } } AREA.clampIn(pos, 0.05); }
  const gh = APP.L.groundH(pos.x, pos.z); if (pos.y < gh + 0.04) pos.y = gh + 0.04; if (pos.y > WALL_H - 0.08) pos.y = WALL_H - 0.08;
  camera.position.copy(pos); camera.lookAt(CAM.tgt.x, CAM.tgt.y + up, CAM.tgt.z);
}
// the laptop's view: up in a corner of the room under the (hidden) ceiling
function watchCam(dt) {
  const cp = Math.cos(CAMW.pitch); camera.position.set(CAMW.tgt.x + Math.sin(CAMW.yaw) * cp * CAMW.dist, CAMW.tgt.y + Math.sin(CAMW.pitch) * CAMW.dist, CAMW.tgt.z + Math.cos(CAMW.yaw) * cp * CAMW.dist);
  AREA.clampIn(camera.position, 0.15); camera.position.y = Math.min(camera.position.y, WALL_H + 0.6);
  camera.lookAt(CAMW.tgt); if (APP.W && APP.W.ceil) for (const m of APP.W.ceil) m.visible = false;
}
renderer.setAnimationLoop(loop);
setInterval(() => { if (document.hidden && APP.mode === 'game' && APP.kind !== 'client' && !xrOn()) loop(performance.now(), null); }, 33);
window.APP = APP;
setTimeout(() => { try { if (!handRest) buildHandRest(); } catch (e) {} }, 1500);   // build the chubby hands while you're in the lobby, not when the game starts

/* ---------- a newer version on GitHub? offer a reload ----------
   Checks the game's own files now and then (and whenever you come back to the app), compares them to what's running. */
(function updates() {
  const files = [location.pathname.replace(/[^/]*$/, '') + 'index.html'].concat(Array.from(document.scripts).map(s => s.src).filter(u => u && u.startsWith(location.origin) && /\/js\//.test(u)));
  const hash = t => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const read = () => Promise.all(files.map(u => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.text() : '').catch(() => ''))).then(ts => ts.every(t => !t) ? null : hash(ts.join('\u0001')));
  let base = null, busy = false;
  read().then(h => base = h);
  const check = () => { if (busy || base === null || document.hidden || /[?&](auto|nettest)/.test(location.search)) return; busy = true;
    read().then(h => { busy = false; if (h !== null && h !== base) $('newVer').classList.add('on'); }); };
  $('newVer').onclick = () => location.reload();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(check, 500); });
  setInterval(check, 120000);
  window.__checkUpdate = check; window.__updBase = v => base = v;
})();

/* ---------- test hooks: ?auto=solo&lv=junk, ?auto=host (bot toddler), ?auto=join&code=1234 ---------- */
(function auto() {
  const q = new URLSearchParams(location.search), a = q.get('auto'); if (q.get('lv')) APP.lv = APP.soloLv = q.get('lv');
  if (a === 'solo') setTimeout(() => startMatch('solo'), 300);
  if (a === 'host') { page('host'); setTimeout(() => startMatch('bot'), +(q.get('wait') || 2500)); }
  if (a === 'join') { page('join'); setTimeout(() => { $('joinCode').value = q.get('code'); $('joinBtn').click(); }, 600); }
})();
