/* ================= Toy Box: the app (lobby, mixed-reality setup, cameras, controls, the loop) ================= */
const $ = id => document.getElementById(id);
const APP = { mode: 'lobby', kind: null, viewer: null, S: null, W: null, L: null, lv: 'bedroom', mess: 'medium', bot: 'normal', soloLv: 'bedroom', soloMess: 'medium', soloBot: 'normal',
  roster: null, snaps: [], off: null, me: { viewer: 'toy', body: -1, slotOf: {} }, myPid: 'local', sendT: 0, lastBody: -1, cur: null, lobbyPlayers: {}, endShown: false, area: null, momSaid: false };
const BOT_SPEED = { easy: 0.5, normal: 0.72, hard: 0.98 };
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
function levelPicker(el, get, set) {
  el.innerHTML = ''; for (const L of LEVELS) { const b = document.createElement('button'); b.className = 'lv' + (get() === L.id ? ' on' : '');
    b.innerHTML = `<em>${L.tag}</em><span class="sw">${L.swatch.map(c => `<i style="background:${c}"></i>`).join('')}</span><b>${L.name}</b><small>${L.blurb}</small>`;
    b.onclick = () => { set(L.id); levelPicker(el, get, set); }; el.append(b); }
}
function seg(el, opts, get, set) { el.innerHTML = ''; for (const [k, label] of opts) { const b = document.createElement('button'); b.textContent = label; b.className = get() === k ? 'on' : ''; b.onclick = () => { set(k); seg(el, opts, get, set); }; el.append(b); } }
const MESS_OPTS = [['small', 'Small (18)'], ['medium', 'Medium (28)'], ['big', 'Big (40)']], BOT_OPTS = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];
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
  try { const s = await navigator.xr.requestSession(xrMode, { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'bounded-floor'] }); await renderer.xr.setSession(s); startDraw(); }
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
  APP.S = S; APP.kind = kind; APP.messKey = mess; APP.mode = 'game'; APP.endShown = false; APP.endCard = false; APP.momSaid = false; APP.vrEnd = false;
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
  APP.mode = 'game'; APP.kind = 'client'; APP.viewer = 'toy'; APP.me = { viewer: 'toy', body: -1, slotOf: {} }; APP.myPid = NET.myId; APP.snaps = []; APP.off = null; APP.cur = null; APP.endShown = false; APP.endCard = false; APP.momSaid = false;
  CAM.have = false; APP.lastBody = -1;
  enterGameUI();
}
function enterGameUI() {
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
renderer.xr.addEventListener('sessionend', () => { if (APP.mode === 'draw' || (APP.mode === 'game' && APP.kind === 'xr')) toLobby('host'); });

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
  c.addEventListener('connected', e => { const side = e.data && e.data.handedness; const H = HANDS[side === 'left' ? 1 : 0]; H.grip = g; H.hand = hd; H.src = e.data; H.prev = {}; if (side === 'left' && !e.data.hand) g.add(WRIST.m); });
  c.addEventListener('disconnected', e => { for (const H of HANDS) if (H.grip === g) { H.src = null; H.ok = false; } });
}
const WRIST = canvasPanel(0.13, 0.075, 2400); WRIST.m.position.set(0, 0.03, 0.09); WRIST.m.rotation.x = -1.0;
const BANNER = canvasPanel(0.9, 0.34, 900); BANNER.m.position.set(0, 0.12, -0.85); camera.add(BANNER.m); BANNER.m.visible = false; BANNER.until = 0;
const SPLAT = canvasPanel(0.5, 0.3, 600); SPLAT.m.position.set(0, 0, -0.16); camera.add(SPLAT.m); SPLAT.m.material.opacity = 0;
const CONF = canvasPanel(0.5, 0.3, 600); CONF.m.position.set(0, 0, -0.17); camera.add(CONF.m); CONF.m.material.opacity = 0;
const BUB = canvasPanel(0.5, 0.3, 600); BUB.m.position.set(0, 0, -0.165); camera.add(BUB.m); BUB.m.material.opacity = 0;
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
const VRUI = { g: new THREE.Group(), btns: [], cool: 0,
  show(title, body, buttons) { this.hide(); const g = this.g; scene.add(g);
    const P = canvasPanel(0.62, 0.26, 1000), x = P.x, w = P.cv.width, h = P.cv.height; x.fillStyle = 'rgba(255,253,247,.96)'; x.strokeStyle = '#15121a'; x.lineWidth = 10; rr(x, 6, 6, w - 12, h - 12, 28); x.fill(); x.stroke();
    x.fillStyle = '#15121a'; x.textAlign = 'center'; x.font = '400 54px Bungee, Rubik, sans-serif'; x.fillText(title, w / 2, 80); x.font = '700 30px Rubik, sans-serif'; String(body).split('\n').forEach((l, i) => x.fillText(l, w / 2, 130 + i * 38)); P.t.needsUpdate = true;
    P.m.material.depthTest = true; g.add(P.m);
    const n = buttons.length, bw = 0.62 / n - 0.015;
    buttons.forEach((b, i) => { const B = canvasPanel(bw, 0.09, 1000), y = B.x; y.fillStyle = b.col || '#ffd400'; y.strokeStyle = '#15121a'; y.lineWidth = 10; rr(y, 6, 6, B.cv.width - 12, B.cv.height - 12, 20); y.fill(); y.stroke();
      y.fillStyle = '#15121a'; y.textAlign = 'center'; y.font = '800 36px Rubik, sans-serif'; y.fillText(b.label, B.cv.width / 2, B.cv.height / 2 + 13); B.t.needsUpdate = true; B.m.material.depthTest = true;
      B.m.position.set(-0.31 + bw / 2 + 0.0075 + i * (bw + 0.015), -0.2, 0.01); g.add(B.m); this.btns.push({ m: B.m, w: bw, h: 0.09, fn: b.fn, was: false }); });
    // stand it up in front of you, a little below your eyes, facing you
    const hw = headL.clone(), f = V(0, 0, -1).applyQuaternion(headLQ); f.y = 0; if (f.lengthSq() < 1e-3) f.set(0, 0, -1); f.normalize();
    g.position.copy(hw).addScaledVector(f, 0.5); g.position.y = Math.max(0.35, hw.y - 0.18); g.lookAt(hw.x, g.position.y, hw.z); this.cool = 0.5; },
  hide() { this.g.clear(); scene.remove(this.g); this.btns = []; },
  update(dt, tips) { this.cool -= dt; if (!this.btns.length) return; this.g.updateMatrixWorld(true);
    for (const b of this.btns) { let inside = false; for (const t of tips) { const l = b.m.worldToLocal(t.clone()); if (Math.abs(l.x) < b.w / 2 && Math.abs(l.y) < b.h / 2 && l.z < 0.04 && l.z > -0.06) inside = true; }
      b.m.position.z = inside ? -0.005 : 0.01; if (inside && !b.was && this.cool <= 0) { this.cool = 0.6; sfx.play('pop', 0.8); for (let i = 0; i < 2; i++) buzz(i, 0.4, 30); b.fn(); return; } b.was = inside; } },
};

/* ---------- mixed-reality setup: trace your clear floor space ---------- */
const DRAW = { pts: [], closed: false, line: null, fill: null, dots: [], grid: null };
function startDraw() {
  APP.mode = 'draw'; APP.viewer = 'toddler'; DRAW.pts = []; DRAW.closed = false;
  $('ui').style.display = 'none';
  if (xrMode === 'immersive-ar') { scene.background = null; renderer.setClearColor(0x000000, 0); } else { scene.background = new THREE.Color('#2a2340'); DRAW.grid = new THREE.GridHelper(10, 20, 0x9b5cff, 0x55507a); scene.add(DRAW.grid); }
  scene.fog = null;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 3000), 3)); geo.setDrawRange(0, 0);
  DRAW.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd400 })); DRAW.line.frustumCulled = false; scene.add(DRAW.line);
  for (let i = 0; i < 2; i++) { const d = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.035, 24), new THREE.MeshBasicMaterial({ color: 0xff3e8a, side: THREE.DoubleSide })); d.rotation.x = -Math.PI / 2; d.visible = false; scene.add(d); DRAW.dots.push(d); }
  if (NET.host) sendAll({ t: 'lobby', lv: APP.lv, mess: APP.mess, n: Object.keys(APP.lobbyPlayers).length, drawing: true });
  setTimeout(drawPanel, 400);
}
function drawPanel() {
  if (APP.mode !== 'draw') return;
  if (!DRAW.closed) VRUI.show('Trace your play space', 'Touch the floor with a fingertip (or controller)\nand crawl around the edge of your clear space.\nCome back to where you started to close it.',
    [{ label: '2×2 m square here', fn: () => useSquare(), col: '#00c2b3' }, { label: 'Clear', fn: () => { DRAW.pts = []; DRAW.closed = false; drawLine(); drawPanel(); }, col: '#fffdf7' }]);
  else { const poly = simplifyArea(DRAW.pts), a = polyArea(poly); if (a < 1.2) { VRUI.show('A bit small', `That's ${a.toFixed(1)} m². Trace at least about 1.2 m across\nso there's room to crawl.`, [{ label: 'Redraw', fn: () => { DRAW.pts = []; DRAW.closed = false; drawLine(); drawPanel(); } }]); return; }
    VRUI.show('Play here?', `${a.toFixed(1)} m² of floor. The living room's walls\nwill stand on your line. Stay inside it while you play.`,
      [{ label: 'Play here!', fn: () => confirmArea(poly), col: '#ff3e8a' }, { label: 'Redraw', fn: () => { DRAW.pts = []; DRAW.closed = false; drawLine(); drawPanel(); }, col: '#fffdf7' }]); }
}
function drawLine() { const P = DRAW.pts, a = DRAW.line.geometry.attributes.position; for (let i = 0; i < P.length && i < 2999; i++) a.setXYZ(i, P[i].x, 0.006, P[i].z); let n = Math.min(P.length, 2999); if (DRAW.closed && n > 2) { a.setXYZ(n, P[0].x, 0.006, P[0].z); n++; } a.needsUpdate = true; DRAW.line.geometry.setDrawRange(0, n);
  if (DRAW.fill) { scene.remove(DRAW.fill); DRAW.fill = null; }
  if (DRAW.closed) { const poly = simplifyArea(P), sh = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], -p[1]))); DRAW.fill = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })); DRAW.fill.rotation.x = -Math.PI / 2; DRAW.fill.position.y = 0.004; scene.add(DRAW.fill); } }
function drawStep(dt, frame) {
  const hands = readHands(frame), tips = [];
  for (let i = 0; i < 2; i++) { const H = HANDS[i], d = DRAW.dots[i]; d.visible = !!H.ok; if (!H.ok) continue; const t = H.realTip; tips.push(t.clone()); const on = t.y < 0.07; d.position.set(t.x, 0.008, t.z); d.material.color.set(on ? 0x00c2b3 : 0xff3e8a);
    if (on && !DRAW.closed) { const P = DRAW.pts, last = P[P.length - 1]; if (!last || Math.hypot(last.x - t.x, last.z - t.z) > 0.04) { P.push({ x: t.x, z: t.z }); drawLine();
      let len = 0; for (let k = 1; k < P.length; k++) len += Math.hypot(P[k].x - P[k - 1].x, P[k].z - P[k - 1].z);
      if (P.length > 25 && len > 2.6 && Math.hypot(P[0].x - t.x, P[0].z - t.z) < 0.3) { DRAW.closed = true; drawLine(); sfx.play('win', 0.8); buzz(0, 0.6, 120); buzz(1, 0.6, 120); drawPanel(); } } } }
  VRUI.update(dt, tips);
}
function endDraw() { if (DRAW.line) scene.remove(DRAW.line); if (DRAW.fill) scene.remove(DRAW.fill); if (DRAW.grid) scene.remove(DRAW.grid); for (const d of DRAW.dots) scene.remove(d); DRAW.line = DRAW.fill = DRAW.grid = null; DRAW.dots = []; }
function useSquare() { const f = V(0, 0, -1).applyQuaternion(headLQ); f.y = 0; f.normalize(); const r = V(-f.z, 0, f.x), c = headL.clone(); c.y = 0; const s = 1.1;
  const poly = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const p = c.clone().addScaledVector(r, a * s).addScaledVector(f, b * s); return [r3(p.x), r3(p.z)]; }); confirmArea(poly); }
function confirmArea(poly) { VRUI.hide(); const area = { poly, start: [r3(headL.x), r3(headL.z)] }; startMatch('xr', area); }
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
  const tips = HANDS.filter(H => H.ok).map(H => H.tip.clone());
  VRUI.update(dt, tips);
  // controllers: trigger/A/B also work between rounds
  if (S.state === 'end' && APP.vrEnd) for (const H of HANDS) { const b = H.btn; if (!b || H.src && H.src.hand) continue; if (b.t) return vrAgain(); if (b.a) return vrNext(); if (b.b) return toLobby('host'); }
}
function vrAgain() { startMatch('xr'); }
function vrNext() { const i = LEVELS.findIndex(l => l.id === APP.lv); APP.lv = LEVELS[(i + 1) % LEVELS.length].id; hostLevels(); lobbyInfo(); startMatch('xr'); }
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
  if (code === 'end') sfx.play('door', 1);
}

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
      if (bi !== APP.lastBody) { if (bi >= 0 && r) { const T = TOYS[r[1]]; $('who').innerHTML = `${T.name}<small>Special: ${T.sp}</small>`; $('spName').textContent = T.sp.replace(/ \(.*\)/, ''); if (APP.lastBody >= 0) { toast("Put away! You're the " + T.name + ' now'); sfx.play('hop'); } CAM.fly = 0.5; CAM.have = false; } APP.lastBody = bi; }
      $('spCd').style.height = Math.round(c[2] * 100) + '%'; $('bGrab').textContent = c[3] || 'Grab'; }
    APP.me.slotOf = {}; for (const pid in s.ctl) APP.me.slotOf[s.ctl[pid][0]] = s.ctl[pid][1];
  }
  if (s.st === 2) {
    if (!APP.endShown) { APP.endShown = true; banner(s.end === 1 ? 'What a mess!' : 'Tidy!', s.end === 1 ? 'Uh oh… here comes mom' : 'Here comes mom!', 2.2); }
    if (s.et > 2.4 && !APP.momSaid) { APP.momSaid = true; speak(momLine(APP.W, s.end)); }
    if (s.et > 6.5 && !APP.endCard) { APP.endCard = true; const toysWon = s.end === 1;
      if (APP.viewer === 'toddler') { APP.vrEnd = true; VRUI.show(toysWon ? 'Toys win' : 'You win!', toysWon ? `Grounded! The room is messier than when mom left (${s.ml} vs ${s.m0}).` : s.ml === 0 ? 'Everything is in the toy box.' : `Tidier than when mom left (${s.ml} vs ${s.m0}).`,
        [{ label: 'Again', fn: vrAgain, col: '#ff3e8a' }, { label: 'Next room', fn: vrNext, col: '#ffd400' }, { label: 'Redraw space', fn: vrRedraw, col: '#00c2b3' }, { label: 'Leave', fn: () => toLobby('host'), col: '#fffdf7' }]); }
      else { $('endT').textContent = toysWon ? 'What a mess! Toys win' : 'Tidy! Toddler wins';
        $('endP').textContent = toysWon ? `Messier than when mom left (${s.ml} vs ${s.m0}). The toddler's grounded.` : s.ml === 0 ? 'Everything\'s in the toy box. Mom says: good kid.' : `Tidier than when mom left (${s.ml} vs ${s.m0}). Mom says: good kid.`;
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
  const playing = s.st === 1; if (s.st === 0) musicStop(); else musicPhase(s.st === 2 ? 3 : s.ph);
  hud(s); if (APP.viewer === 'toddler') wristDraw(s);
  drawSnap(W, s, s2, k, APP.me, dt);
  if (APP.kind === 'client' && APP.me.body >= 0 && APP.snaps.length > 1) { const n = APP.snaps.length, A = APP.snaps[n - 2].b, B = APP.snaps[n - 1].b, j = APP.me.body * 8, g = W.bodies[APP.me.body].g, dT = Math.max(0.016, APP.snaps[n - 1].T - APP.snaps[n - 2].T);
    if (!(B[j + 7] & 1) && !(A[j + 7] & 1)) { const ahead = 0.04; g.position.set(B[j] + (B[j] - A[j]) / dT * ahead, B[j + 1] + (B[j + 1] - A[j + 1]) / dT * ahead, B[j + 2] + (B[j + 2] - A[j + 2]) / dT * ahead); } }
  phaseLight(W, scene, s.st === 2 ? 3 : s.ph, playing || s.st === 2, dt);
  fxStep(W.fx, dt);
  if (APP.viewer === 'toy') toyCam(dt, s); else if (APP.viewer === 'watch') watchCam(dt);
  if (APP.viewer === 'toddler') { const T = s.td; SPLAT.m.material.opacity = clamp(T[TD.SPLAT], 0, 1) * 0.9; CONF.m.material.opacity = clamp(T[TD.CONF], 0, 1); BUB.m.material.opacity = clamp(T[TD.BUB], 0, 1) * 0.9; BANNER.m.visible = performance.now() < BANNER.until; }
  if (!document.hidden && !NORENDER) renderer.render(scene, camera);
}
function toyCam(dt, s) {
  const bi = APP.me.body; if (bi < 0 || !APP.W.bodies[bi]) return; const o = APP.W.bodies[bi], p = o.g.position.clone(), r = o.r;
  if (!CAM.have) { const f = V(0, 0, 1).applyQuaternion(o.g.quaternion); CAM.heading = Math.atan2(f.x, f.z); CAM.yawS = CAM.heading + Math.PI; CAM.tgt.copy(p); CAM.have = true; }
  CAM.fly = Math.max(0, CAM.fly - dt);
  CAM.tgt.lerp(p, 1 - Math.exp(-(CAM.fly > 0 ? 5 : 16) * dt));
  let d = CAM.heading + Math.PI - CAM.yawS; d = Math.atan2(Math.sin(d), Math.cos(d)); CAM.yawS += d * (1 - Math.exp(-7 * dt));
  const cp = Math.cos(CAM.pitch), up = r * 0.7, pos = V(CAM.tgt.x + Math.sin(CAM.yawS) * cp * CAM.dist, CAM.tgt.y + up + Math.sin(CAM.pitch) * CAM.dist, CAM.tgt.z + Math.cos(CAM.yawS) * cp * CAM.dist);
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
