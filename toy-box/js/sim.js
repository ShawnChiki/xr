/* ================= Toy Box: the match (runs only on the host: the Quest, or whoever plays the bot toddler) =================
   Everything that moves lives here: toys, loose parts, the toddler's head and hands, the seesaw, swings and
   merry-go-round, the music box, the nap clock. Phones send their stick and buttons; the host sends back
   a snapshot 30 times a second (see snap()). */
const MESS = { small: { toys: 12, parts: 6 }, medium: { toys: 18, parts: 10 }, big: { toys: 24, parts: 14 } };
const PHASES = [
  { name: 'Epic!', sub: 'The giant toddler wakes up' },
  { name: 'Silly', sub: 'Everything gets bouncy' },
  { name: 'Spooky', sub: 'Grumpy and tired: watch out' },
  { name: 'Sleepy', sub: 'Almost nap time…' },
];
const phaseOf = nap => nap > 135 ? 0 : nap > 90 ? 1 : nap > 45 ? 2 : 3;
const TOY_SPEED = 0.62, JUMP_V = 2.05;
const _o = { n: V(), pen: 0 }, _cv2 = V(), _rel = V(), _tq = Q(), _ax = V(), _nb = [];

function newMatch(levelId, seed, messKey, opts = {}) {
  const L = makeLevel(levelId, seed), rng = mulberry(seed ^ 0x5bd1e995), M = MESS[messKey] || MESS.medium;
  const S = { L, rng, t: 0, nap: MATCH_TIME, phase: 0, state: 'count', countT: 3.6, end: 0, bodies: [], players: {}, walls: [], ev: [], netEv: [],
    td: newToddler(), bot: opts.botToddler ? newBotToddler() : null, devs: L.devices.map(d => initDevice(d)), messTotal: 0, messLeft: 0, lullabies: 0 };
  // which toys: a shuffled pick of all 24
  const kinds = TOYS.map((_, i) => i); for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const spots = L.spawns.slice(); let si = 0; const nextSpot = () => spots[si++ % spots.length].clone();
  for (let i = 0; i < M.toys; i++) { const k = kinds[i % kinds.length], T = TOYS[k]; addBody(S, 'toy', k, T.r, nextSpot()); }
  for (let i = 0; i < M.parts; i++) { const pt = i % L.parts.length, P = L.parts[pt]; const b = addBody(S, 'part', pt, P.r, nextSpot()); b.col = i % P.cols.length; }
  for (let i = 0; i < 3; i++) { const b = addBody(S, 'decoy', TOYS.findIndex(t => t.key === 'duck'), 0.04, V(0, -1, 0)); b.away = true; }
  for (const b of S.bodies) { b.yaw = rng() * TAU; b.q.copy(qYaw(b.yaw)); if (b.type === 'toy') b.ctrl = 'bot'; }
  S.messTotal = S.bodies.filter(b => b.type !== 'decoy').length; S.messLeft = S.messTotal;
  return S;
}
function addBody(S, type, kind, r, p) {
  const b = { i: S.bodies.length, type, kind, r, r0: r, p, v: V(), q: Q(), w: V(), yaw: 0, m: type === 'toy' ? Math.pow(r / 0.05, 3) : 0.45,
    grounded: false, gT: 0, groundVel: V(), climbN: null, away: false, held: -1, holdQ: Q(), carry: -1, carriedBy: -1,
    stun: 0, sticky: 0, slip: 0, boost: 0, glide: 0, float: 0, rise: 0, pogo: 0, magnet: 0, shrink: 0, bouncy: 0, charge: 0, life: 0,
    cd: 0, ctrl: null, inp: null, bot: { tgt: V(), t: 0, stuck: 0, jumpCd: 0, spCd: 2 + Math.random() * 4 }, thrownBy: null, thrownT: -9, touchTd: -9, col: 0 };
  S.bodies.push(b); return b;
}
function emit(S, e) { S.ev.push(e); S.netEv.push(e); }   // e = [code, x, y, z, a]
const evAt = (S, code, p, a) => emit(S, [code, r3(p.x), r3(p.y), r3(p.z), a === undefined ? 0 : a]);

/* ---------- the toddler ---------- */
function newToddler() {
  const hand = () => ({ p: V(0, 0.2, 0), q: Q(), v: V(), grip: false, gripPrev: false, trig: false, trigPrev: false, trigT: -9, held: -1, numb: 0, down: false, slamT: -9, mouthT: 0, chomped: false, hist: [], on: true });
  return { head: V(0, 0.55, -1.6), hq: Q(), hands: [hand(), hand()], chest: V(), butt: V(), cv: V(), prevChest: V(), tickle: 0, giggle: 0, splat: 0, confetti: 0, slamCd: 0, mouth: 0, sleepy: 0, cols: [], dizzy: 0 };
}
function toddlerCols(S) {
  const td = S.td;
  if (!td.cols.length) {
    const mk = (part, r) => { const c = cSph(V(), r, { td: part, climb: true }); c.v = V(); c.vAt = () => c.v; return c; };
    td.cols = [mk('head', 0.13), mk('chest', 0.16), mk('butt', 0.15), mk(0, 0.045), mk(1, 0.045)];
  }
  const [h, c, b, h0, h1] = td.cols;
  h.c.copy(td.head); c.c.copy(td.chest); b.c.copy(td.butt); h0.c.copy(td.hands[0].p); h1.c.copy(td.hands[1].p);
  h0.off = !td.hands[0].on; h1.off = !td.hands[1].on;
  h.v.copy(td.cv); c.v.copy(td.cv); b.v.copy(td.cv); h0.v.copy(td.hands[0].v); h1.v.copy(td.hands[1].v);
}
// where the body hangs under your head: a crawling baby, chest and bum behind your face
function toddlerBody(S, dt) {
  const td = S.td, f = V(0, 0, -1).applyQuaternion(td.hq); f.y = 0; if (f.lengthSq() < 1e-4) f.set(0, 0, 1); f.normalize();
  const gh = S.L.groundH(td.head.x, td.head.z);
  td.chest.copy(td.head).addScaledVector(f, -0.17); td.chest.y = Math.max(gh + 0.17, td.head.y - 0.27);
  td.butt.copy(td.chest).addScaledVector(f, -0.27); td.butt.y = Math.max(S.L.groundH(td.butt.x, td.butt.z) + 0.15, td.chest.y - 0.12);
  if (dt > 0) { td.cv.subVectors(td.chest, td.prevChest).divideScalar(dt); if (td.cv.length() > 6) td.cv.setLength(6); }
  td.prevChest.copy(td.chest);
}
// pose comes in from the headset (main.js) or the bot: head p/q, hands p/q, grip, trigger
function setToddlerPose(S, pose) {
  const td = S.td; td.head.copy(pose.head); td.hq.copy(pose.hq);
  for (let i = 0; i < 2; i++) { const h = td.hands[i], ph = pose.hands[i]; h.on = ph.on !== false; h.p.copy(ph.p); h.q.copy(ph.q); h.grip = !!ph.grip; h.trig = !!ph.trig; }
}
function handVel(S, h) {
  h.hist.push({ t: S.t, x: h.p.x, y: h.p.y, z: h.p.z }); while (h.hist.length > 2 && S.t - h.hist[1].t > 0.06) h.hist.shift();
  const o = h.hist[0], dt = S.t - o.t; if (dt > 0.005) h.v.set((h.p.x - o.x) / dt, (h.p.y - o.y) / dt, (h.p.z - o.z) / dt); if (h.v.length() > 8) h.v.setLength(8);
}
const holdOffset = V(0, -0.015, -0.045);
function holdPos(h, out) { return out.copy(holdOffset).applyQuaternion(h.q).add(h.p); }
function mouthPos(td, out) { return out.set(0, -0.075, -0.09).applyQuaternion(td.hq).add(td.head); }
function release(S, h, b, gentle) {
  h.held = -1; b.held = -1; if (!b) return;
  b.v.copy(h.v).multiplyScalar(gentle ? 0.2 : 1.15); if (b.v.length() > 6.5) b.v.setLength(6.5);
  b.w.set(S.rng() - 0.5, S.rng() - 0.5, S.rng() - 0.5).multiplyScalar(18);
  b.thrownBy = 'toddler'; b.thrownT = S.t; b.stun = Math.max(b.stun, 0.4);
  if (b.v.length() > 1.3) evAt(S, 'throw', b.p);
  h.mouthT = 0; h.chomped = false;
}
function numbHand(S, i, t) { const h = S.td.hands[i]; h.numb = Math.max(h.numb, t); if (h.held >= 0) release(S, h, S.bodies[h.held], true); }
function tantrum(S, at) {
  const td = S.td; if (td.slamCd > 0) return; td.slamCd = S.phase === 2 ? 4 : 7;
  const gh = S.L.groundH(at.x, at.z); at = V(at.x, gh, at.z); evAt(S, 'slam', at); td.mouth = 1;
  for (const b of S.bodies) { if (b.away || b.held >= 0) continue; const d = V().subVectors(b.p, at); d.y = 0; const l = d.length(); if (l > 1.05) continue;
    const k = 1 - l / 1.05; if (l > 1e-3) d.divideScalar(l); else d.set(1, 0, 0);
    b.v.addScaledVector(d, 1.7 * k).y += 2.4 * k + 0.4; b.stun = Math.max(b.stun, 0.6 + k * 1.2); b.thrownBy = 'toddler'; b.thrownT = S.t - 1;
    if (b.carriedBy >= 0) drop(S, b); b.w.set(S.rng() - 0.5, 0, S.rng() - 0.5).multiplyScalar(20); }
}
function drop(S, part) { const c = S.bodies[part.carriedBy]; if (c) c.carry = -1; part.carriedBy = -1; }
function toddlerPre(S, dt) {
  const td = S.td, playing = S.state === 'play';
  toddlerBody(S, dt);
  td.slamCd = Math.max(0, td.slamCd - dt); td.splat = Math.max(0, td.splat - dt); td.confetti = Math.max(0, td.confetti - dt);
  td.giggle = Math.max(0, td.giggle - dt); td.tickle = Math.max(0, td.tickle - dt * 0.06); td.mouth = Math.max(0, td.mouth - dt * 2.5); td.dizzy = Math.max(0, td.dizzy - dt);
  td.sleepy = S.state === 'end' && S.end ? Math.min(1, td.sleepy + dt * 0.5) : S.phase === 3 ? 0.35 : 0;
  const mp = mouthPos(td, V());
  for (let i = 0; i < 2; i++) {
    const h = td.hands[i]; handVel(S, h); h.numb = Math.max(0, h.numb - dt);
    const press = h.grip && !h.gripPrev, rel = !h.grip && h.gripPrev; h.gripPrev = h.grip;
    if (h.trig && !h.trigPrev) h.trigT = S.t; h.trigPrev = h.trig;
    if (!playing) { if (h.held >= 0) release(S, h, S.bodies[h.held], true); continue; }
    if (press && h.held < 0 && h.numb <= 0) {
      let best = null, bd = 1e9; const hp = holdPos(h, V());
      for (const b of S.bodies) { if (b.away || b.held >= 0) continue; const d = Math.min(b.p.distanceTo(h.p), b.p.distanceTo(hp)) - b.r; if (d < 0.07 && d < bd) { bd = d; best = b; } }
      if (best) {
        if (best.slip > 0) { evAt(S, 'slip', best.p); best.v.add(V(S.rng() - 0.5, 0.8, S.rng() - 0.5).multiplyScalar(1.6)); }
        else if (best.type === 'decoy') { evAt(S, 'pop', best.p); best.away = true; best.p.set(0, -1, 0); }
        else { h.held = best.i; best.held = i; best.holdQ.copy(h.q).invert().multiply(best.q); if (best.carriedBy >= 0) drop(S, best); if (best.carry >= 0) { const c = S.bodies[best.carry]; c.carriedBy = -1; best.carry = -1; }
          best.stun = 0; evAt(S, 'grab', best.p, best.type === 'toy' ? best.kind : -1); h.mouthT = 0; h.chomped = false; }
      }
    }
    if (rel && h.held >= 0) release(S, h, S.bodies[h.held]);
    // a toy near your mouth gets mouthed: sticky and slow for a while
    if (h.held >= 0) { const b = S.bodies[h.held]; if (!h.chomped && holdPos(h, V()).distanceTo(mp) < 0.11) { h.mouthT += dt; if (h.mouthT > 0.3) { h.chomped = true; b.sticky = 8; td.mouth = 1; evAt(S, 'chomp', mp); } } }
    // a quick slap down to the floor
    const gh = S.L.groundH(h.p.x, h.p.z);
    if (h.p.y < gh + 0.07) { if (!h.down) { h.down = true; if (h.v.y < -1.25) h.slamT = S.t; } } else if (h.p.y > gh + 0.11) h.down = false;
  }
  if (playing) {
    const [a, b] = td.hands;
    if (Math.abs(a.slamT - b.slamT) < 0.3 && S.t - Math.max(a.slamT, b.slamT) < 0.05) { a.slamT = b.slamT = -9; tantrum(S, V().addVectors(a.p, b.p).multiplyScalar(0.5)); }
    if (Math.abs(a.trigT - b.trigT) < 0.35 && a.trig && b.trig && S.t - Math.max(a.trigT, b.trigT) < 0.05) { a.trigT = b.trigT = -9; const f = V(0, 0, -1).applyQuaternion(td.hq); f.y = 0; f.normalize(); tantrum(S, td.head.clone().addScaledVector(f, 0.32)); }
  }
  toddlerCols(S);
}

/* ---------- devices: seesaw, merry-go-round, swing, music box ---------- */
function initDevice(d) {
  const s = { d, type: d.type, ang: 0, av: 0, wind: 0, cd: 0, crankA: 0, cols: [], contacts: [] };
  if (d.type === 'seesaw') { s.ang = (d.i % 2 ? 1 : -1) * d.maxA; s.yq = qYaw(d.yaw); s.col = cBox(V(), V(d.len / 2, d.th / 2, d.w / 2), Q(), { dev: s }); s.cols = [s.col]; }
  if (d.type === 'mgr') { s.col = cCyl(V(d.c.x, d.h / 2 + 0.01, d.c.z), d.r, d.h / 2, { dev: s }); s.cols = [s.col]; }
  if (d.type === 'swing') { s.yq = qYaw(d.yaw); const tire = d.look === 'tire'; s.col = cBox(V(), tire ? V(0.075, 0.025, 0.075) : V(0.07, 0.008, 0.045), Q(), { dev: s }); s.cols = [s.col]; }
  for (const c of s.cols) { c.v = V(); c.dyn = true; c.vAt = p => devVel(s, p, c.v); }
  placeDevice(s); return s;
}
const _pa = V();
function devVel(s, p, out) {
  const d = s.d;
  if (s.type === 'seesaw') { _ax.set(0, 0, 1).applyQuaternion(s.yq).multiplyScalar(s.av); return out.crossVectors(_ax, _pa.subVectors(p, d.c)); }
  if (s.type === 'mgr') return out.set(s.av * (p.z - d.c.z), 0, -s.av * (p.x - d.c.x));
  if (s.type === 'swing') { _ax.set(1, 0, 0).applyQuaternion(s.yq).multiplyScalar(s.av); return out.crossVectors(_ax, _pa.subVectors(p, d.pivot)); }
  return out.set(0, 0, 0);
}
function placeDevice(s) {
  const d = s.d;
  if (s.type === 'seesaw') { s.col.q.copy(s.yq).multiply(_tq.setFromAxisAngle(Z_AX, s.ang)); refreshBox(s.col); s.col.c.set(0, d.th / 2, 0).applyQuaternion(s.col.q).add(d.c); }
  if (s.type === 'swing') { s.col.q.copy(s.yq).multiply(_tq.setFromAxisAngle(X_AX, s.ang)); refreshBox(s.col); s.col.c.set(0, -d.len, 0).applyQuaternion(s.col.q).add(d.pivot); }
}
function devices(S, dt) {
  const td = S.td;
  for (const s of S.devs) {
    const d = s.d;
    if (s.type === 'seesaw') {
      let tq = 0; for (const c of s.contacts) tq -= c.m * GRAV * c.x; s.contacts.length = 0;
      s.av += tq / 0.17 * dt; s.av *= Math.exp(-1.2 * dt);
      for (const h of td.hands) { if (!h.on || !hit(s.col, h.p, 0.045, _o)) continue;      // your hand slaps the plank
        const lx = V().subVectors(h.p, d.c).applyQuaternion(qYaw(-d.yaw)).x; if (Math.abs(lx) < 0.05) continue;
        if (h.v.y < -0.3) s.av = lerp(s.av, clamp(h.v.y / lx, -30, 30), 0.6); }
      s.ang += s.av * dt;
      if (s.ang > d.maxA) { s.ang = d.maxA; if (s.av > 0) { if (s.av > 2.5) evAt(S, 'creak', d.c, 0.7); s.av = -s.av * 0.15; } }
      if (s.ang < -d.maxA) { s.ang = -d.maxA; if (s.av < 0) { if (s.av < -2.5) evAt(S, 'creak', d.c, 0.7); s.av = -s.av * 0.15; } }
      placeDevice(s);
    } else if (s.type === 'mgr') {
      for (const h of td.hands) { if (!h.on) continue; const dx = h.p.x - d.c.x, dz = h.p.z - d.c.z, rr = Math.hypot(dx, dz);
        if (rr < d.r + 0.05 && rr > 0.05 && h.p.y < d.h + 0.08) { const tang = (h.v.x * dz - h.v.z * dx) / rr; s.av = lerp(s.av, tang / rr, 0.25); if (Math.abs(s.av) > 3.5 && h.p.y < d.h + 0.05 && S.rng() < 0.02) numbHand(S, td.hands.indexOf(h), 0.6); } }
      s.av = clamp(s.av * Math.exp(-0.3 * dt), -7, 7); s.ang += s.av * dt;
    } else if (s.type === 'swing') {
      s.av += (-(GRAV / d.len) * Math.sin(s.ang) - 0.12 * s.av) * dt;
      for (const h of td.hands) { if (!h.on || !hit(s.col, h.p, 0.05, _o)) continue; const t = V(0, 0, 1).applyQuaternion(s.col.q); s.av = lerp(s.av, h.v.dot(t) / d.len, 0.5); }
      s.ang = clamp(s.ang + s.av * dt, -1.35, 1.35); placeDevice(s);
      // the seat bonks your hand or face on the way past
      const sp = Math.abs(s.av) * d.len;
      if (sp > 1.1 && S.state === 'play') { for (let i = 0; i < 2; i++) if (td.hands[i].on && td.hands[i].numb <= 0 && s.col.c.distanceTo(td.hands[i].p) < 0.09) { numbHand(S, i, 0.8); evAt(S, 'bonk', td.hands[i].p); }
        if (td.dizzy <= 0 && s.col.c.distanceTo(td.head) < 0.16) { td.dizzy = 1.2; td.splat = Math.max(td.splat, 0.7); evAt(S, 'bonk', td.head); } }
    } else if (s.type === 'mbox') {
      s.cd = Math.max(0, s.cd - dt);
      for (const h of td.hands) if (h.on && h.p.distanceTo(d.crank) < 0.14) s.wind = Math.max(0, s.wind - dt * 0.9);
    }
  }
}

/* ---------- specials: one move per toy ---------- */
function fwd(b) { return V(Math.sin(b.yaw), 0, Math.cos(b.yaw)); }
function special(S, b) {
  if (b.cd > 0 || b.stun > 0 || S.state !== 'play') return;
  const T = TOYS[b.kind], f = fwd(b), td = S.td; b.cd = T.cd; let say = T.key;
  switch (T.key) {
    case 'ball': b.v.y = 3.3; b.bouncy = 3; say = 'boing'; break;
    case 'car': b.boost = 1.4; say = 'zip'; break;
    case 'duck': { const d = S.bodies.find(x => x.type === 'decoy' && x.away); if (d) { d.away = false; d.p.copy(b.p).addScaledVector(V(-f.z, 0, f.x), 0.09); d.p.y += 0.03; d.v.set(0, 1, 0); d.life = 5; d.yaw = b.yaw + (S.rng() - 0.5) * 2; d.q.copy(qYaw(d.yaw)); d.ctrl = 'decoy'; } say = 'squeak'; break; }
    case 'jack': b.v.y = 3.7; say = 'boing'; break;
    case 'slinky': b.v.copy(f).multiplyScalar(1.9).y = 2.3; say = 'boing'; break;
    case 'top': b.slip = 2.8; for (const o of S.bodies) if (o !== b && !o.away && o.held < 0 && o.p.distanceTo(b.p) < 0.18) o.v.add(V().subVectors(o.p, b.p).setY(0).normalize().multiplyScalar(1.4)); say = 'spin'; break;
    case 'teddy': b.float = 3.2; b.v.y = Math.max(b.v.y, 1.7); say = 'hop'; break;
    case 'robot': b.boost = 1.1; say = 'zip'; break;
    case 'train': b.charge = 1.8; say = 'whistle'; break;
    case 'yoyo': { if (b.carry >= 0) { b.cd = 0.5; return; } let best = null, bd = 1.35; for (const o of S.bodies) if (o.type === 'part' && !o.away && o.held < 0 && o.carriedBy < 0) { const d = o.p.distanceTo(b.p); if (d < bd) { bd = d; best = o; } }
      if (best) { best.carriedBy = b.i; b.carry = best.i; } say = 'zip'; break; }
    case 'kite': b.glide = 3.5; b.v.y = Math.max(b.v.y, 1.6); say = 'zip'; break;
    case 'drum': for (const o of S.bodies) { if (o === b || o.away || o.held >= 0) continue; const d = V().subVectors(o.p, b.p); d.y = 0; const l = d.length(); if (l > 0.7 || l < 1e-4) continue; const k = 1 - l / 0.7; o.v.addScaledVector(d.divideScalar(l), 2.2 * k).y += 1.3 * k; if (o.carriedBy >= 0) drop(S, o); }
      for (let i = 0; i < 2; i++) if (td.hands[i].on && td.hands[i].p.distanceTo(b.p) < 0.5) numbHand(S, i, 1.0); say = 'drum'; break;
    case 'balloon': b.rise = 2.3; say = 'hop'; break;
    case 'dino': { let bit = false; for (let i = 0; i < 2; i++) if (td.hands[i].on && td.hands[i].p.distanceTo(b.p) < 0.26) { numbHand(S, i, 1.6); bit = true; evAt(S, 'bonk', td.hands[i].p); } say = 'roar'; if (bit) td.mouth = 1; break; }
    case 'magnet': b.magnet = 2.5; say = 'zip'; break;
    case 'squirt': { const to = V().subVectors(td.head, b.p), l = to.length(); to.normalize(); const fl = V(f.x, 0.5, f.z).normalize();
      if (l < 1.9 && to.dot(fl) > 0.55) { td.splat = 2.3; evAt(S, 'splash', td.head, 1); } else evAt(S, 'splash', b.p.clone().addScaledVector(fl, 0.5), 0); say = ''; break; }
    case 'plane': b.v.copy(f).multiplyScalar(2.4).y = 1.5; b.glide = 2.2; say = 'zip'; break;
    case 'pogo': b.pogo = 4; say = 'boing'; break;
    case 'chicken': b.slip = 3.2; say = 'squeak'; break;
    case 'blocks': { if (S.walls.length >= 6) S.walls.shift(); const c = b.p.clone().addScaledVector(f, 0.13); const g = S.L.groundH(c.x, c.z); c.y = g + 0.075;
      const w = cBox(c, V(0.12, 0.075, 0.025), qYaw(b.yaw), { climb: true }); w.life = 7; w.yaw = b.yaw; S.walls.push(w); say = 'pop'; break; }
    case 'marble': b.shrink = 4.5; say = 'zip'; break;
    case 'ballerina': S.nap = Math.max(0.5, S.nap - 4); S.lullabies++; td.sleepy = 1; say = 'lullaby'; break;
    case 'popper': { if (td.head.distanceTo(b.p) < 1.35) td.confetti = 2.2; for (const o of S.bodies) if (o !== b && !o.away && o.held < 0 && o.p.distanceTo(b.p) < 0.3) o.v.y += 1.2; say = 'confetti'; break; }
    case 'frog': b.v.copy(f).multiplyScalar(1.5).y = 2.85; say = 'boing'; break;
  }
  if (b.carriedBy >= 0) drop(S, b);
  evAt(S, 'sp', b.p, b.kind); if (say) evAt(S, say, b.p);
}

/* ---------- toys thinking for themselves (bots) ---------- */
function botInput(S, b, dt) {
  const td = S.td, o = b.bot, inp = b.inp || (b.inp = { mx: 0, mz: 0, jump: false, grab: false, sp: false, gh: false });
  inp.jump = inp.grab = inp.sp = false; o.t -= dt; o.jumpCd -= dt; o.spCd -= dt;
  let mx = 0, mz = 0, threat = 1e9, tp = null;
  for (const h of td.hands) { if (!h.on) continue; const d = Math.hypot(h.p.x - b.p.x, h.p.z - b.p.z); if (d < threat) { threat = d; tp = h.p; } }
  const dh = Math.hypot(td.head.x - b.p.x, td.head.z - b.p.z); if (dh < threat) { threat = dh; tp = td.head; }
  if (S.state === 'play' && tp && threat < 0.6) {
    mx = b.p.x - tp.x; mz = b.p.z - tp.z; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
    const j = (o.seedJ || (o.seedJ = S.rng() * 2 - 1)); const c = Math.cos(j), s = Math.sin(j); [mx, mz] = [mx * c - mz * s, mx * s + mz * c];
    if (threat < 0.28 && o.jumpCd <= 0) { inp.jump = true; o.jumpCd = 0.5 + S.rng(); }
    if (threat < 0.32 && o.spCd <= 0 && S.rng() < 0.5) { inp.sp = true; o.spCd = 3 + S.rng() * 4; }
    o.t = 0;
  } else {
    if (o.t <= 0 || Math.hypot(o.tgt.x - b.p.x, o.tgt.z - b.p.z) < 0.12) { o.tgt.set((S.rng() * 2 - 1) * (HALF - 0.3), 0, (S.rng() * 2 - 1) * (HALF - 0.3)); o.t = 2 + S.rng() * 4; o.idle = S.rng() < 0.25 ? 1 + S.rng() * 2 : 0; }
    if (o.idle > 0) o.idle -= dt; else { mx = o.tgt.x - b.p.x; mz = o.tgt.z - b.p.z; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; }
    if (o.spCd <= 0 && S.rng() < 0.004) { inp.sp = true; o.spCd = 5 + S.rng() * 6; }
  }
  // keep away from the toy box
  const bx = b.p.x - BOX.c.x, bz = b.p.z - BOX.c.z, bd = Math.hypot(bx, bz); if (bd < 0.7) { mx += bx / bd * 1.2; mz += bz / bd * 1.2; }
  // stuck? hop
  const sp = Math.hypot(b.v.x, b.v.z); if ((mx || mz) && sp < 0.08 && b.grounded) { o.stuck += dt; if (o.stuck > 0.5 && o.jumpCd <= 0) { inp.jump = true; o.jumpCd = 0.6; o.stuck = 0; } } else o.stuck = 0;
  const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  inp.mx = mx * 0.85; inp.mz = mz * 0.85;
}

/* ---------- the bot toddler (no headset: practice, or a laptop host) ---------- */
function newBotToddler() { return { p: TODDLER_START.p.clone(), yaw: 0, tgt: -1, reT: 0, handT: [V(), V()], grip: [false, false], gripT: 0, crawl: 0, look: V() }; }
function botToddler(S, dt) {
  const B = S.bot, td = S.td; if (!B) return;
  B.reT -= dt; B.gripT -= dt; B.crawl += dt;
  const speed = S.botSpeed || 0.7;
  const holding = td.hands[0].held >= 0;
  let goal = null, look = null;
  if (S.state !== 'play') { goal = B.p.clone(); look = V(0, 0.1, 0); }
  else if (holding) {
    goal = V(BOX.c.x, 0, BOX.c.z + 0.5); look = BOX.c.clone();
  } else {
    if (B.reT <= 0 || B.tgt < 0 || S.bodies[B.tgt].away || S.bodies[B.tgt].held >= 0) {
      B.reT = 0.6; let best = -1, bd = 1e9;
      for (const b of S.bodies) { if (b.away || b.held >= 0 || b.type === 'decoy' && S.rng() < 0.5) continue; let d = Math.hypot(b.p.x - B.p.x, b.p.z - B.p.z) + b.p.y * 1.5; if (b.stun > 0) d *= 0.6; if (d < bd) { bd = d; best = b.i; } }
      B.tgt = best;
    }
    if (B.tgt >= 0) { const b = S.bodies[B.tgt]; const dir = V(b.p.x - B.p.x, 0, b.p.z - B.p.z), l = dir.length(); goal = l > 0.4 ? V(b.p.x, 0, b.p.z).addScaledVector(dir.normalize(), -0.36) : B.p.clone(); look = b.p.clone(); }
  }
  if (goal) { const d = V(goal.x - B.p.x, 0, goal.z - B.p.z), l = d.length(); if (l > 0.02) B.p.addScaledVector(d.normalize(), Math.min(l, speed * dt)); }
  B.p.x = clamp(B.p.x, -HALF + 0.2, HALF - 0.2); B.p.z = clamp(B.p.z, -HALF + 0.2, HALF - 0.2);
  if (look) { const want = Math.atan2(look.x - B.p.x, look.z - B.p.z); let dy = want - B.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); B.yaw += dy * Math.min(1, dt * 4); B.look.lerp(look, Math.min(1, dt * 5)); }
  const f = V(Math.sin(B.yaw), 0, Math.cos(B.yaw)), side = V(f.z, 0, -f.x), gh = S.L.groundH(B.p.x, B.p.z);
  const head = V(B.p.x, gh + 0.52 + Math.sin(B.crawl * 7) * 0.01, B.p.z).addScaledVector(f, 0.06);
  const ld = V().subVectors(B.look, head); const pitch = Math.atan2(-ld.y, Math.hypot(ld.x, ld.z));
  const hq = Q().setFromEuler(new THREE.Euler(-pitch, B.yaw + Math.PI, 0, 'YXZ'));
  // hands: right hand reaches, left hand crawls
  const crawlOff = k => Math.max(0, Math.sin(B.crawl * 7 + k)) * 0.05;
  const rest0 = V(B.p.x, 0, B.p.z).addScaledVector(f, 0.28).addScaledVector(side, -0.14), rest1 = V(B.p.x, 0, B.p.z).addScaledVector(f, 0.28).addScaledVector(side, 0.14);
  rest0.y = S.L.groundH(rest0.x, rest0.z) + 0.04 + crawlOff(0); rest1.y = S.L.groundH(rest1.x, rest1.z) + 0.04 + crawlOff(Math.PI);
  let t0 = rest0, grip0 = B.grip[0];
  if (S.state === 'play') {
    if (holding) { const over = V(BOX.c.x, BOX.h + 0.14, BOX.c.z); if (Math.hypot(B.p.x - BOX.c.x, B.p.z - BOX.c.z) < 0.62) { t0 = over; if (td.hands[0].p.distanceTo(over) < 0.06) grip0 = false; } else t0 = head.clone().addScaledVector(f, 0.15).add(V(0, -0.15, 0)); }
    else if (B.tgt >= 0) { const b = S.bodies[B.tgt]; if (Math.hypot(b.p.x - B.p.x, b.p.z - B.p.z) < 0.62) { t0 = b.p.clone(); if (td.hands[0].p.distanceTo(b.p) < 0.05 + b.r && B.gripT <= 0) { grip0 = true; B.gripT = 0.5; } } }
    if (!holding && grip0 && B.gripT < 0.2) grip0 = false;
    // tantrum when crowded
    if (td.slamCd <= 0) { let n = 0; for (const b of S.bodies) if (b.type === 'toy' && !b.away && Math.hypot(b.p.x - head.x, b.p.z - head.z) < 0.7) n++; if (n >= 4 && S.rng() < 0.01) tantrum(S, head.clone().addScaledVector(f, 0.3)); }
  }
  B.grip[0] = grip0;
  for (let i = 0; i < 2; i++) { const t = i === 0 ? t0 : rest1; B.handT[i].lerp(t, Math.min(1, dt * (i === 0 ? 5 : 8))); }
  const hp0 = td.hands[0].p.clone(), hp1 = td.hands[1].p.clone();
  const step = (from, to) => { const d = V().subVectors(to, from), l = d.length(), m = 2.2 * dt; return l > m ? from.addScaledVector(d, m / l) : to.clone(); };
  const hq0 = Q().setFromEuler(new THREE.Euler(-0.6, B.yaw + Math.PI, 0, 'YXZ'));
  setToddlerPose(S, { head, hq, hands: [{ p: step(hp0, B.handT[0]), q: hq0, grip: grip0 }, { p: step(hp1, B.handT[1]), q: hq0, grip: false }] });
}

/* ---------- players ---------- */
function freeToys(S) { return S.bodies.filter(b => b.type === 'toy' && !b.away && b.held < 0 && !isPlayer(S, b)); }
function isPlayer(S, b) { return typeof b.ctrl === 'string' && b.ctrl.startsWith('p:'); }
function farthestFree(S, not) {
  let best = null, bd = -1; for (const b of freeToys(S)) { if (b === not) continue; const d = b.p.distanceTo(S.td.head) + S.rng() * 0.6; if (d > bd) { bd = d; best = b; } } return best;
}
function addPlayer(S, pid, slot) {
  if (S.players[pid]) return S.players[pid];
  const pl = { pid, slot, body: -1, inp: { mx: 0, mz: 0, ax: 0, az: 1, jc: 0, gc: 0, sc: 0, wc: 0, gh: false }, last: { jc: 0, gc: 0, sc: 0, wc: 0 }, swapCd: 0, hops: 0 };
  S.players[pid] = pl; possess(S, pl, farthestFree(S)); return pl;
}
function possess(S, pl, b) {
  if (pl.body >= 0) { const o = S.bodies[pl.body]; if (o && o.ctrl === 'p:' + pl.pid) { o.ctrl = 'bot'; o.inp = null; } }
  pl.body = b ? b.i : -1; if (b) { b.ctrl = 'p:' + pl.pid; b.inp = null; pl.last = Object.assign({}, pl.inp); pl.hops++; }
}
function removePlayer(S, pid) { const pl = S.players[pid]; if (!pl) return; possess(S, pl, null); delete S.players[pid]; }
function playerInput(S, pl, b) {
  const i = pl.inp, l = pl.last, inp = b.inp || (b.inp = {});
  inp.mx = clamp(i.mx, -1, 1); inp.mz = clamp(i.mz, -1, 1); inp.jumpHeld = !!i.jh;
  inp.jump = i.jc !== l.jc; inp.grab = i.gc !== l.gc; inp.sp = i.sc !== l.sc; inp.gh = !!i.gh; inp.ax = i.ax; inp.az = i.az;
  const swap = i.wc !== l.wc; l.jc = i.jc; l.gc = i.gc; l.sc = i.sc; l.wc = i.wc;
  if (swap && pl.swapCd <= 0) { let best = null, bd = 1e9; for (const o of freeToys(S)) { const d = o.p.distanceTo(b.p); if (d < bd) { bd = d; best = o; } }
    if (best) { possess(S, pl, best); pl.swapCd = 2.5; evAt(S, 'hop', best.p, pl.slot); } }
}

/* ---------- one physics step for a body ---------- */
function stepBody(S, b, dt) {
  const L = S.L, slap = S.phase === 1;
  b.stun = Math.max(0, b.stun - dt); b.sticky = Math.max(0, b.sticky - dt); b.slip = Math.max(0, b.slip - dt); b.cd = Math.max(0, b.cd - dt);
  for (const k of ['boost', 'glide', 'float', 'rise', 'pogo', 'magnet', 'bouncy', 'charge']) if (b[k] > 0) b[k] = Math.max(0, b[k] - dt);
  if (b.shrink > 0) { b.shrink = Math.max(0, b.shrink - dt); b.r = b.r0 * 0.55; } else b.r = b.r0;
  if (b.type === 'decoy') { b.life -= dt; if (b.life <= 0) { b.away = true; b.p.set(0, -1, 0); evAt(S, 'pop', b.p); return; } }
  const inp = b.inp, canMove = (b.type === 'toy' || b.type === 'decoy') && b.stun <= 0;
  let g = GRAV; if (b.glide > 0) g *= 0.14; if (b.float > 0) g *= 0.25; if (b.rise > 0) g = -1.4;
  let mx = 0, mz = 0;
  if (canMove && inp) { mx = inp.mx || 0; mz = inp.mz || 0; }
  if (b.type === 'decoy') { const f = fwd(b); mx = f.x; mz = f.z; }
  if (b.charge > 0) { const f = fwd(b); mx = f.x; mz = f.z; }
  if (mx || mz) { const want = Math.atan2(mx, mz); let d = want - b.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); b.yaw += d * Math.min(1, dt * 14); }
  if (canMove) {
    let sp = TOY_SPEED; if (b.boost > 0) sp *= TOYS[b.kind].key === 'robot' ? 3 : 2.6; if (b.charge > 0) sp *= 2.1; if (b.sticky > 0) sp *= 0.4; if (b.shrink > 0) sp *= 1.3; if (S.td.sleepy > 0.9 && S.state === 'end') sp = 0;
    const gx = b.groundVel.x, gz = b.groundVel.z, k = 1 - Math.exp(-(b.grounded ? 14 : 4) * dt);
    if (b.grounded || mx || mz) { b.v.x = lerp(b.v.x, gx + mx * sp, k); b.v.z = lerp(b.v.z, gz + mz * sp, k); }
    if (inp && inp.jump && b.gT < 0.12) { b.v.y = JUMP_V * (b.sticky > 0 ? 0.6 : 1) + Math.max(0, b.groundVel.y); b.gT = 1; evAt(S, 'jump', b.p, b.kind); }
    if (b.pogo > 0 && b.grounded && b.v.y < 1) { b.v.y = 2.5; evAt(S, 'boing', b.p, 0.5); }
    if (b.climbN && (mx || mz) && (mx * -b.climbN.x + mz * -b.climbN.z) > 0.3) { b.v.y = Math.max(b.v.y, b.sticky > 0 ? 0.2 : 0.5); g *= 0.2; }
    if (inp && inp.sp && b.type === 'toy') special(S, b);
  } else if (b.grounded) { const k = Math.exp(-(b.type === 'part' ? 2.5 : 7) * dt); b.v.x = lerp(b.groundVel.x, b.v.x, k); b.v.z = lerp(b.groundVel.z, b.v.z, k); }
  if (b.magnet > 0) for (const o of S.bodies) if (o.type === 'part' && !o.away && o.held < 0 && o.carriedBy < 0) { const d = V().subVectors(b.p, o.p), l = d.length(); if (l < 1.2 && l > b.r + o.r) o.v.addScaledVector(d.divideScalar(l), 5 * dt); }
  b.v.y -= g * dt;
  if (b.v.length() > 9) b.v.setLength(9);
  b.p.addScaledVector(b.v, dt);
  // collide
  const e = b.bouncy > 0 ? 0.85 : b.type === 'part' ? (slap ? 0.62 : 0.38) : (slap ? 0.5 : 0.16);
  b.grounded = false; b.climbN = null; b.groundVel.set(0, 0, 0); b.gT += dt;
  const near = L.grid.near(b.p, _nb);
  for (const s of S.devs) for (const c of s.cols) near.push(c);
  for (const c of S.walls) near.push(c);
  if (S.state !== 'count') for (const c of S.td.cols) near.push(c);
  for (const c of near) {
    if (!hit(c, b.p, b.r, _o)) continue;
    const n = _o.n; b.p.addScaledVector(n, _o.pen);
    const cv = c.vAt ? c.vAt(b.p) : _cv2.set(0, 0, 0);
    _rel.subVectors(b.v, cv); const vn = _rel.dot(n);
    if (vn < 0) {
      _rel.addScaledVector(n, -(1 + e) * vn);
      if (c.dev && c.dev.type === 'seesaw') { const lx = V().subVectors(b.p, c.dev.d.c).applyQuaternion(qYaw(-c.dev.d.yaw)).x; c.dev.av += b.m * vn * n.y * lx / 0.17 * 0.9; }
      if (-vn > 1.4 && b.type === 'toy') evAt(S, 'land', b.p, Math.min(1, -vn / 4));
      if (c.td !== undefined) hitToddler(S, b, c, -vn);
      b.v.addVectors(_rel, cv);
    }
    if (n.y > 0.55) { b.grounded = true; b.gT = 0; if (c.vAt) b.groundVel.copy(cv); if (c.dev && c.dev.type === 'seesaw') { const lx = V().subVectors(b.p, c.dev.d.c).applyQuaternion(qYaw(-c.dev.d.yaw)).x; c.dev.contacts.push({ m: b.m, x: lx }); } }
    else if (c.climb && Math.abs(n.y) < 0.5) b.climbN = n.clone();
    if (c.td !== undefined) b.touchTd = S.t;
  }
  // ground
  const gh = L.groundH(b.p.x, b.p.z);
  if (b.p.y - b.r < gh) {
    let n = Y_AX; if (L.H) { const ex = 0.02, hx = L.groundH(b.p.x + ex, b.p.z) - L.groundH(b.p.x - ex, b.p.z), hz = L.groundH(b.p.x, b.p.z + ex) - L.groundH(b.p.x, b.p.z - ex); n = V(-hx / (2 * ex), 1, -hz / (2 * ex)).normalize(); }
    b.p.y = gh + b.r; const vn = b.v.dot(n); if (vn < 0) { b.v.addScaledVector(n, -(1 + e) * vn); if (-vn > 1.4 && b.type === 'toy') evAt(S, 'land', b.p, Math.min(1, -vn / 4)); }
    b.grounded = true; b.gT = 0;
    if (L.H && b.type === 'part') { b.v.x += -n.x * 0 + (n.x) * GRAV * dt * 0.8; b.v.z += n.z * GRAV * dt * 0.8; }
  }
  // the kerb all round (backup if something flies over it)
  const lim = HALF - b.r; if (b.p.x > lim) { b.p.x = lim; b.v.x = -Math.abs(b.v.x) * 0.4; } if (b.p.x < -lim) { b.p.x = -lim; b.v.x = Math.abs(b.v.x) * 0.4; }
  if (b.p.z > lim) { b.p.z = lim; b.v.z = -Math.abs(b.v.z) * 0.4; } if (b.p.z < -lim) { b.p.z = -lim; b.v.z = Math.abs(b.v.z) * 0.4; }
  if (b.p.y > 4) { b.p.y = 4; b.v.y = Math.min(0, b.v.y); }
  // turn: toys stand up and face where they go; loose parts roll
  if ((b.type === 'toy' || b.type === 'decoy') && b.grounded && b.stun <= 0) { b.q.slerp(qYaw(b.yaw, _tq), 1 - Math.exp(-12 * dt)); b.w.set(0, 0, 0); }
  else {
    if (b.grounded && b.type === 'part') { b.w.set(b.v.z, 0, -b.v.x).divideScalar(b.r); }
    const wl = b.w.length(); if (wl > 1e-3) { _tq.setFromAxisAngle(_ax.copy(b.w).divideScalar(wl), wl * dt); b.q.premultiply(_tq).normalize(); }
    if (b.type === 'toy' && b.slip > 0 && TOYS[b.kind].key === 'top') b.q.premultiply(_tq.setFromAxisAngle(Y_AX, 25 * dt));
    b.w.multiplyScalar(Math.exp(-1.5 * dt));
  }
  if (b.type === 'toy' && b.slip > 0 && TOYS[b.kind].key === 'top' && b.grounded) { b.q.copy(qYaw(b.yaw += 25 * dt)); }
}
function hitToddler(S, b, c, speed) {
  const td = S.td, fromToy = b.thrownBy === 'toy' && S.t - b.thrownT < 2;
  if (!fromToy || speed < 1.0 || S.state !== 'play') return;
  if (c.td === 0 || c.td === 1) { if (td.hands[c.td].numb <= 0) { numbHand(S, c.td, 0.9); evAt(S, 'bonk', c.c); } }
  else if (c.td === 'head') { td.splat = Math.max(td.splat, 0.9); td.tickle += 0.2; evAt(S, 'bonk', c.c); }
  else { td.tickle += 0.12; evAt(S, 'tickle', c.c); }
  b.thrownBy = null; checkGiggle(S);
}
function checkGiggle(S) { const td = S.td; if (td.tickle >= 1) { td.tickle = 0; td.giggle = 2; numbHand(S, 0, 1.6); numbHand(S, 1, 1.6); evAt(S, 'giggle', td.head); } }

/* ---------- the toy's GRAB button: throw what you hold, tickle, push a device, or pick something up ---------- */
function toyGrab(S, b) {
  const td = S.td;
  if (b.carry >= 0) { const p = S.bodies[b.carry]; b.carry = -1; p.carriedBy = -1;
    const ax = b.inp && b.inp.ax !== undefined ? V(b.inp.ax, 0, b.inp.az) : fwd(b); if (ax.lengthSq() < 0.01) ax.copy(fwd(b)); ax.normalize();
    p.v.copy(ax).multiplyScalar(3.0).add(V(0, 1.45, 0)).addScaledVector(b.v, 0.5); p.p.copy(b.p).addScaledVector(ax, b.r + p.r + 0.01); p.p.y += b.r * 0.6;
    p.thrownBy = 'toy'; p.thrownT = S.t; p.w.set(S.rng() * 20 - 10, 0, S.rng() * 20 - 10); evAt(S, 'throw', b.p, 0.6); return 'throw'; }
  if (S.t - b.touchTd < 0.25 || td.cols.some(c => !c.off && c.c.distanceTo(b.p) < c.r + b.r + 0.03)) {
    td.tickle += 0.1; evAt(S, 'tickle', b.p); checkGiggle(S); return 'tickle'; }
  for (const s of S.devs) { const d = s.d;
    if (s.type === 'mgr') { const dx = b.p.x - d.c.x, dz = b.p.z - d.c.z, rr = Math.hypot(dx, dz); if (rr < d.r + 0.08 && b.p.y < d.h + 0.15) { const f = fwd(b), sgn = Math.sign(dz * f.x - dx * f.z) || 1; s.av = clamp(s.av + sgn * 1.6, -7, 7); evAt(S, 'spin', d.c, 0.5); return 'push'; } }
    if (s.type === 'swing' && s.col.c.distanceTo(b.p) < 0.16) { s.av += 1.7 * (Math.sign(s.av) || 1); evAt(S, 'creak', s.col.c, 1); return 'push'; }
    if (s.type === 'seesaw' && s.col.c.distanceTo(b.p) < d.len / 2 + 0.05 && b.p.y < 0.25) { const lx = V().subVectors(b.p, d.c).applyQuaternion(qYaw(-d.yaw)).x; s.av += (lx > 0 ? -1 : 1) * 3; return 'push'; }
  }
  let best = null, bd = 1e9; for (const o of S.bodies) { if (o.type !== 'part' || o.away || o.held >= 0 || o.carriedBy >= 0) continue; const d = o.p.distanceTo(b.p) - o.r - b.r; if (d < 0.07 && d < bd) { bd = d; best = o; } }
  if (best) { best.carriedBy = b.i; b.carry = best.i; evAt(S, 'grab', b.p, -2); return 'pick'; }
  return '';
}
// what the GRAB button would do right now (for the button label on the phone)
function grabHint(S, b) {
  if (!b) return 'Grab'; if (b.carry >= 0) return 'Throw';
  if (S.t - b.touchTd < 0.3) return 'Tickle';
  for (const s of S.devs) { const d = s.d;
    if (s.type === 'mbox' && b.p.distanceTo(d.crank) < 0.16) return 'Wind';
    if (s.type === 'mgr' && Math.hypot(b.p.x - d.c.x, b.p.z - d.c.z) < d.r + 0.08) return 'Spin';
    if (s.type === 'swing' && s.col.c.distanceTo(b.p) < 0.16) return 'Push'; }
  for (const o of S.bodies) if (o.type === 'part' && !o.away && o.held < 0 && o.carriedBy < 0 && o.p.distanceTo(b.p) - o.r - b.r < 0.07) return 'Pick up';
  return 'Grab';
}

/* ---------- the whole step ---------- */
function stepMatch(S, dt) {
  dt = Math.min(dt, 0.05);
  S.ev.length = 0;
  if (S.state === 'count') { const before = Math.ceil(S.countT); S.countT -= dt; if (Math.ceil(S.countT) !== before && S.countT > 0) evAt(S, 'count', V(), Math.ceil(S.countT)); if (S.countT <= 0) { S.state = 'play'; evAt(S, 'go', V()); evAt(S, 'phase', V(), 0); } }
  else if (S.state === 'play') { S.nap -= dt; const ph = phaseOf(S.nap); if (ph !== S.phase) { S.phase = ph; evAt(S, 'phase', V(), ph); if (ph === 3) evAt(S, 'yawn', S.td.head); }
    if (S.nap <= 0) { S.nap = 0; S.state = 'end'; S.end = 1; evAt(S, 'end', V(), 1); evAt(S, 'yawn', S.td.head); } }
  S.t += dt;
  if (S.bot) botToddler(S, dt);
  toddlerPre(S, dt);
  for (const pid in S.players) { const pl = S.players[pid]; pl.swapCd = Math.max(0, pl.swapCd - dt); let b = S.bodies[pl.body];
    if (!b || b.away) { const nb = farthestFree(S); if (nb) { possess(S, pl, nb); evAt(S, 'hop', nb.p, pl.slot); } b = nb; }
    if (b) playerInput(S, pl, S.bodies[pl.body]); }
  for (const b of S.bodies) if (!b.away && b.held < 0 && (b.ctrl === 'bot')) botInput(S, b, dt);
  // grab-button actions once per frame
  for (const b of S.bodies) { if (b.away || b.type !== 'toy' || !b.inp) continue;
    if (b.inp.grab && b.stun <= 0 && b.held < 0 && S.state === 'play') toyGrab(S, b);
    if (b.inp.gh && S.state === 'play') for (const s of S.devs) if (s.type === 'mbox' && s.cd <= 0 && b.p.distanceTo(s.d.crank) < 0.16) { s.wind += dt / 3; s.crankA += dt * 8; if (S.rng() < 0.3) evAt(S, 'crank', s.d.crank);
      if (s.wind >= 1) { s.wind = 0; s.cd = 18; S.nap = Math.max(0.5, S.nap - 12); S.lullabies++; S.td.sleepy = 1; evAt(S, 'lullaby', s.d.crank, 1); } } }
  // physics in small steps
  const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
  for (let k = 0; k < n; k++) {
    devices(S, h);
    for (const b of S.bodies) {
      if (b.away) continue;
      if (b.held >= 0) { const hd = S.td.hands[b.held]; holdPos(hd, b.p); b.v.copy(hd.v); b.q.copy(hd.q).multiply(b.holdQ); continue; }
      if (b.carriedBy >= 0) { const c = S.bodies[b.carriedBy]; if (!c || c.away || c.held >= 0) { b.carriedBy = -1; if (c) c.carry = -1; } else { b.p.copy(c.p); b.p.y += c.r + b.r * 0.9; b.v.copy(c.v); b.q.copy(c.q); continue; } }
      stepBody(S, b, h);
    }
    // bodies bump each other
    const B = S.bodies;
    for (let i = 0; i < B.length; i++) { const a = B[i]; if (a.away || a.carriedBy >= 0) continue;
      for (let j = i + 1; j < B.length; j++) { const c = B[j]; if (c.away || c.carriedBy >= 0) continue;
        const dx = c.p.x - a.p.x, dy = c.p.y - a.p.y, dz = c.p.z - a.p.z, rr = a.r + c.r, d2 = dx * dx + dy * dy + dz * dz; if (d2 >= rr * rr || d2 < 1e-10) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, pen = rr - d;
        const ia = a.held >= 0 ? 0 : 1 / a.m, ic = c.held >= 0 ? 0 : 1 / c.m, it = ia + ic; if (it === 0) continue;
        a.p.x -= nx * pen * ia / it; a.p.y -= ny * pen * ia / it; a.p.z -= nz * pen * ia / it; c.p.x += nx * pen * ic / it; c.p.y += ny * pen * ic / it; c.p.z += nz * pen * ic / it;
        const rv = (c.v.x - a.v.x) * nx + (c.v.y - a.v.y) * ny + (c.v.z - a.v.z) * nz;
        if (rv < 0) { const jimp = -(1.3) * rv / it; a.v.x -= jimp * ia * nx; a.v.y -= jimp * ia * ny; a.v.z -= jimp * ia * nz; c.v.x += jimp * ic * nx; c.v.y += jimp * ic * ny; c.v.z += jimp * ic * nz;
          // something the toddler threw knocks a toy silly
          for (const [x, y] of [[a, c], [c, a]]) if (x.thrownBy === 'toddler' && S.t - x.thrownT < 1.6 && -rv > 1.3 && y.type === 'toy' && y.held < 0 && y.stun <= 0) { y.stun = 2.6; evAt(S, 'stun', y.p); }
          if ((a.boost > 0 || a.charge > 0) && c.type !== 'toy') { c.v.y += 0.8; } if ((c.boost > 0 || c.charge > 0) && a.type !== 'toy') { a.v.y += 0.8; } }
      } }
  }
  // temporary walls fade
  for (let i = S.walls.length - 1; i >= 0; i--) { S.walls[i].life -= dt; if (S.walls[i].life <= 0) S.walls.splice(i, 1); }
  // the toy box: anything that lands inside is put away
  const { c, w, d, h: bh, t } = BOX;
  for (const b of S.bodies) {
    if (b.away || b.held >= 0 || b.carriedBy >= 0) continue;
    if (Math.abs(b.p.x - c.x) < w / 2 - t && Math.abs(b.p.z - c.z) < d / 2 - t && b.p.y < bh + 0.01 && b.p.y > 0) {
      if (b.type === 'decoy') { b.away = true; evAt(S, 'pop', b.p); b.p.set(0, -1, 0); continue; }
      if (S.state !== 'play') { b.v.set(0, 3, 2); continue; }
      b.away = true; if (b.carry >= 0) { const p = S.bodies[b.carry]; p.carriedBy = -1; b.carry = -1; }
      evAt(S, 'away', b.p, b.type === 'toy' ? b.kind : -1); b.p.set(c.x, 0.05, c.z); b.v.set(0, 0, 0);
    }
  }
  S.messLeft = S.bodies.reduce((n, b) => n + (b.type !== 'decoy' && !b.away ? 1 : 0), 0);
  if (S.state === 'play' && S.messLeft === 0) { S.state = 'end'; S.end = 2; evAt(S, 'end', V(), 2); }
}

/* ---------- the snapshot everyone draws from ---------- */
function snap(S, withEvents) {
  const B = [];
  for (const b of S.bodies) {
    let f = 0; if (b.away) f |= 1; if (b.stun > 0) f |= 2; if (b.sticky > 0) f |= 4; if (b.held >= 0) f |= 8; if (b.slip > 0) f |= 16;
    if (b.boost > 0 || b.glide > 0 || b.charge > 0 || b.rise > 0 || b.float > 0) f |= 32; if (isPlayer(S, b)) f |= 64; if (b.shrink > 0) f |= 128;
    B.push(r3(b.p.x), r3(b.p.y), r3(b.p.z), r3(b.q.x), r3(b.q.y), r3(b.q.z), r3(b.q.w), f);
  }
  const td = S.td, P3 = v => [r3(v.x), r3(v.y), r3(v.z)], Q4 = q => [r3(q.x), r3(q.y), r3(q.z), r3(q.w)];
  const T = [...P3(td.head), ...Q4(td.hq)];
  for (const h of td.hands) T.push(...P3(h.p), ...Q4(h.q), (h.grip ? 1 : 0) + (h.on ? 2 : 0) + (h.numb > 0 ? 4 : 0) + (h.held >= 0 ? 8 : 0));
  T.push(...P3(td.chest), ...P3(td.butt), r3(td.mouth), r3(Math.min(1, td.tickle)), r3(td.splat), r3(td.confetti), r3(td.sleepy), r3(td.giggle));
  const DV = S.devs.map(s => s.type === 'mbox' ? [r3(s.wind), r3(s.crankA), s.cd > 0 ? 1 : 0] : r3(s.ang));
  const ctl = {}; for (const pid in S.players) { const pl = S.players[pid], b = S.bodies[pl.body];
    ctl[pid] = [pl.body, pl.slot, b && b.type === 'toy' ? r3(b.cd / TOYS[b.kind].cd) : 0, withEvents !== 'lite' ? grabHint(S, b) : '', b && b.carry >= 0 ? 1 : 0]; }
  const o = { t: 's', T: r3(S.t), st: S.state === 'count' ? 0 : S.state === 'play' ? 1 : 2, cd: r3(S.countT), nap: Math.round(S.nap * 10) / 10, ph: S.phase,
    ml: S.messLeft, mt: S.messTotal, end: S.end, b: B, td: T, dv: DV, tw: S.walls.map(w => [r3(w.c.x), r3(w.c.y), r3(w.c.z), r3(w.yaw), r3(w.life)]), ctl };
  if (withEvents) { o.ev = S.netEv.slice(); S.netEv.length = 0; }
  return o;
}
function roster(S) { return S.bodies.map(b => [b.type === 'toy' ? 0 : b.type === 'part' ? 1 : 2, b.kind, b.r0, b.col]); }
