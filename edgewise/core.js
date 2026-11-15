// Edgewise core: sketched strokes → straight edges → corners → flat faces → a tidy solid.
// Pure math, no three.js, so it can be tested on its own. All sizes are in model units (metres at 1:1).
//
// The sketch is the source of truth (like Pentimento): every corner remembers each stroke end that landed on it,
// and its target is the average of those. The solver then finds flat faces in the graph of edges and nudges the
// corners until every face is truly flat (and, with Square up on, edges that are nearly vertical, level or on the
// grid become exactly so), staying as close as it can to what you drew.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dist = (a, b) => len(sub(a, b));
export const V = { sub, add, mul, dot, cross, len, norm, dist };

// ---------------------------------------------------------------- strokes
// Best straight line through a stroke: the long axis of its points, ends where the first and last points sit on it.
export function fitLine(pts){
  const n = pts.length;
  if (n < 2) return null;
  let c = [0, 0, 0];
  for (const p of pts) c = add(c, p);
  c = mul(c, 1 / n);
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (const p of pts){ const d = sub(p, c); xx += d[0] * d[0]; xy += d[0] * d[1]; xz += d[0] * d[2]; yy += d[1] * d[1]; yz += d[1] * d[2]; zz += d[2] * d[2]; }
  let d = norm(sub(pts[n - 1], pts[0]));
  if (!len(sub(pts[n - 1], pts[0]))) d = [1, 0, 0];
  for (let i = 0; i < 24; i++){ // power iteration from the chord direction
    const nd = [xx * d[0] + xy * d[1] + xz * d[2], xy * d[0] + yy * d[1] + yz * d[2], xz * d[0] + yz * d[1] + zz * d[2]];
    const l = len(nd); if (!l) break; d = mul(nd, 1 / l);
  }
  if (dot(d, sub(pts[n - 1], pts[0])) < 0) d = mul(d, -1);
  // ends: the extreme projections (a stroke that overshoots at the start still gives the full edge)
  let t0 = Infinity, t1 = -Infinity;
  for (const p of pts){ const t = dot(sub(p, c), d); if (t < t0) t0 = t; if (t > t1) t1 = t; }
  return { a: add(c, mul(d, t0)), b: add(c, mul(d, t1)), dir: d };
}

// closest point on segment ab to p, with its parameter
function closestOnSeg(p, a, b){
  const ab = sub(b, a), L2 = dot(ab, ab);
  const t = L2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / L2)) : 0;
  return { t, q: add(a, mul(ab, t)) };
}

// ---------------------------------------------------------------- the sketch
export function emptySketch(){ return { v: [], e: [], s: [], open: [], locks: [], skip: [], bodies: [], nid: 1 }; }

// Bodies: a face pushed or pulled becomes a body of its own, standing on that face. Its base is the face's loop of
// corners (shared with whatever it stands on, so it follows when that moves); its other corners carry the body's
// id (v.b). Pulled out it adds material, pushed in it cuts material away (join.js works out the result).
const bodyOf = (sk, id) => (sk.bodies || []).find(b => b.id === id);
// does this body cut? (its own corners lie on the inside of the face it stands on)
function bodyCuts(sk, B, pos){
  if (!B || B.base.length < 3 || B.base.some(id => !pos[id])) return false;
  const P = B.base.map(id => pos[id]);
  let n = [0, 0, 0], cb = [0, 0, 0], ct = [0, 0, 0], nt = 0;
  for (let i = 0; i < P.length; i++){ const a = P[i], b = P[(i + 1) % P.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); cb = add(cb, a); }
  for (const v of sk.v) if (v.b === B.id && pos[v.id]){ ct = add(ct, pos[v.id]); nt++; }
  return nt > 0 && dot(sub(mul(ct, 1 / nt), mul(cb, 1 / P.length)), mul(n, B.s || 1)) < 0;
}
// a corner was put on the line a–b: any body base running along that line takes it in
function basesSplit(sk, a, b, n){
  for (const B of sk.bodies || []){
    const L = B.base, i = L.indexOf(a), j = L.indexOf(b);
    if (i < 0 || j < 0) continue;
    if ((i + 1) % L.length === j) L.splice(i + 1, 0, n);
    else if ((j + 1) % L.length === i) L.splice(j + 1, 0, n);
  }
}
function basesDrop(sk, id){ for (const B of sk.bodies || []) B.base = B.base.filter(x => x !== id); }
function basesMerge(sk, keep, drop){
  for (const B of sk.bodies || []){
    B.base = B.base.map(x => x === drop ? keep : x).filter((x, i, L) => x !== L[(i + 1) % L.length] || L.length === 1);
  }
}
// take a whole body away (its own corners and their lines); what it stood on stays
export function removeBody(sk, id){
  const mine = new Set(sk.v.filter(v => v.b === id).map(v => v.id));
  sk.e = sk.e.filter(e => !mine.has(e.a) && !mine.has(e.b));
  sk.v = sk.v.filter(v => !mine.has(v.id));
  sk.bodies = (sk.bodies || []).filter(b => b.id !== id);
  cleanup(sk);
}

// Faces are named by their corners (a key like "3.8.12.15"). When a corner is added to an edge, or healed away,
// every saved face name (holes, locks) that runs along that edge is renamed to match.
function renameFaces(sk, fn){
  const re = k => { const ids = k.split('.').map(Number), r = fn(ids); return r ? faceKey(r) : k; };
  sk.open = (sk.open || []).map(re);
  sk.skip = (sk.skip || []).map(re);
  for (const L of sk.locks || []){ if (L.f) L.f = re(L.f); if (L.a) L.a = re(L.a); if (L.b) L.b = re(L.b); }
}
export const clone = sk => JSON.parse(JSON.stringify(sk));

export function anchorOf(v){
  if (v.pin) return v.pin;
  let c = [0, 0, 0];
  for (const p of v.ends) c = add(c, p);
  return mul(c, 1 / v.ends.length);
}
const vById = (sk, id) => sk.v.find(v => v.id === id);
const edgeBetween = (sk, a, b) => sk.e.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));

// Where would a stroke end at p land? On a corner, on an edge (splitting it), or free.
// pos: the positions you can see (solved), so you aim at what's on screen.
export function snapEnd(sk, p, pos, snapR, skipVert, faces, other){
  // a corner counts as close if you're near where it's shown OR where your strokes put it (tidying can move it a
  // few cm), and a loose end waiting for its partner reaches half as far again
  let best = null, bd = Infinity;
  const deg = new Map(); for (const e of sk.e){ deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
  for (const v of sk.v){
    if (v.id === skipVert) continue;
    const q = pos[v.id] || anchorOf(v), d = Math.min(dist(p, q), dist(p, anchorOf(v)));
    if (other && dist(q, other) < d) continue;          // that corner belongs to the stroke's other end
    const dg = deg.get(v.id) || 0, reach = dg <= 1 ? snapR * 1.5 : dg === 2 ? snapR * 1.25 : snapR;   // a corner still missing a line reaches further
    if (d < reach && d < bd){ bd = d; best = { kind: 'vert', id: v.id, at: q }; }
  }
  if (best) return best;
  bd = snapR * 0.8;
  for (const e of sk.e){
    if (e.a === skipVert || e.b === skipVert) continue;
    const A = pos[e.a] || anchorOf(vById(sk, e.a)), B = pos[e.b] || anchorOf(vById(sk, e.b));
    const { t, q } = closestOnSeg(p, A, B), d = dist(p, q), L = dist(A, B);
    if (other && dist(q, other) < d) continue;
    if (d < bd && t * L > snapR * 0.7 && (1 - t) * L > snapR * 0.7){ bd = d; best = { kind: 'edge', id: e.id, at: q, t }; }
  }
  if (best) return best;
  // a loose end close to a face lands on it (so a shape drawn on a big face lies flat in it)
  if (faces) for (const f of faces){
    const P = f.ids.map(id => pos[id]); if (P.some(x => !x)) continue;
    const pl = planeOf(P), h = dot(pl.n, sub(p, pl.c));
    if (Math.abs(h) > snapR) continue;
    const q = sub(p, mul(pl.n, h)), [u, w] = basis(pl.n), to2 = x => { const d = sub(x, pl.c); return [dot(d, u), dot(d, w)]; };
    const q2 = to2(q);
    if (!insidePoly2(q2, P.map(to2))) continue;
    if ((f.holes || []).some(H => insidePoly2(q2, H.map(id => to2(pos[id]))))) continue;
    if (!best || Math.abs(h) < best.h) best = { kind: 'free', at: q, h: Math.abs(h), face: f.key, L: f.L || 0 };
  }
  return best || { kind: 'free', at: p };
}

function splitEdge(sk, eid, at){
  const e = sk.e.find(x => x.id === eid);
  const n = { id: sk.nid++, ends: [at], split: true };
  // a point on a body's own line belongs to that body
  const va = vById(sk, e.a), vb = vById(sk, e.b), ta = va && va.b, tb = vb && vb.b;
  if (ta !== undefined && ta === tb) n.b = ta;
  else if (ta !== undefined && bodyOf(sk, ta)?.base.includes(e.b)) n.b = ta;
  else if (tb !== undefined && bodyOf(sk, tb)?.base.includes(e.a)) n.b = tb;
  basesSplit(sk, e.a, e.b, n.id);
  sk.v.push(n);
  sk.e.splice(sk.e.indexOf(e), 1);
  sk.e.push({ id: sk.nid++, a: e.a, b: n.id, s: e.s }, { id: sk.nid++, a: n.id, b: e.b, s: e.s });
  renameFaces(sk, ids => ids.includes(e.a) && ids.includes(e.b) ? [...ids, n.id] : null);
  return n.id;
}

// closest approach of segments p1–q1 and p2–q2: where along each (0..1), and how far apart
function segSeg(p1, q1, p2, q2){
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  if (a < 1e-12 || e < 1e-12) return null;
  const c = dot(d1, r), b = dot(d1, d2), den = a * e - b * b, cl = x => Math.max(0, Math.min(1, x));
  let s = den > 1e-12 ? cl((b * f - c * e) / den) : 0, t = (b * s + f) / e;
  if (t < 0){ t = 0; s = cl(-c / a); } else if (t > 1){ t = 1; s = cl((b - c) / a); }
  const c1 = add(p1, mul(d1, s)), c2 = add(p2, mul(d2, t));
  return { s, t, d: dist(c1, c2), c1, c2, cos: Math.abs(b) / Math.sqrt(a * e) };
}

// Add one stroke (array of [x,y,z]) as one straight line. Returns { ok, why, a, b, edge } and changes sk.
// Its ends click onto corners, lines and faces; where it crosses a line already there, both get a corner at the
// crossing (so drawing an X on a face cuts it in four, and two lines overshooting a corner make that corner).
export function addStroke(sk, pts, pos, o){
  const f = fitLine(pts);
  if (!f) return { ok: false, why: 'too short' };
  // shy: join only what the line really touches (see drawStroke)
  const shy = !!o.shy;
  if (shy) o = Object.assign({}, o, { faces: null });
  // a short stroke reaches less far (so small shapes don't collapse onto themselves)
  const full = o.snapR * (shy ? 0.35 : 1), snapR = Math.min(full, 0.5 * dist(f.a, f.b));
  let sa = snapEnd(sk, f.a, pos, snapR, undefined, o.faces, f.b);
  let sb = snapEnd(sk, f.b, pos, snapR, sa.kind === 'vert' ? sa.id : undefined, o.faces, f.a);
  // an end that lands on nothing but ran a little past a corner (close beside the line) was aiming for that corner
  const passed = (end, other, skip) => {
    const d = norm(sub(other, end)), Ls = dist(end, other);
    let best = null, bd = Infinity;
    for (const v of sk.v){
      if (v.id === skip) continue;
      const q = pos[v.id] || anchorOf(v), along = dot(sub(q, end), d);
      if (along < 0 || along > Math.min(full * 1.5, Ls * 0.4)) continue;
      const side = dist(q, add(end, mul(d, along)));
      if (side < Math.min(full * 0.6, Ls * 0.2) && along < bd){ bd = along; best = { kind: 'vert', id: v.id, at: q }; }
    }
    return best;
  };
  if (!shy && sa.kind === 'free' && !sa.face){ const v = passed(f.a, f.b, sb.kind === 'vert' ? sb.id : undefined); if (v) sa = v; }
  if (!shy && sb.kind === 'free' && !sb.face){ const v = passed(f.b, f.a, sa.kind === 'vert' ? sa.id : undefined); if (v) sb = v; }
  // a stroke that starts on a corner and runs along a line already there, stopping part way: its end is a new
  // corner on that line
  const along = (end, vid) => {
    if (vid === undefined || vid === null) return null;
    const pv = pos[vid] || anchorOf(vById(sk, vid));
    let best = null, bd = snapR * 0.8;
    for (const e of sk.e){
      if (e.a !== vid && e.b !== vid) continue;
      const o2 = e.a === vid ? e.b : e.a, po = pos[o2] || anchorOf(vById(sk, o2)), L = dist(pv, po);
      if (L < 1e-9 || Math.abs(dot(norm(sub(po, pv)), f.dir)) < 0.94) continue;
      const { t, q } = closestOnSeg(end, pv, po), d = dist(end, q);
      if (d < bd && t * L > snapR * 0.7 && (1 - t) * L > snapR * 0.7){ bd = d; best = { kind: 'edge', id: e.id, at: q, t }; }
    }
    return best;
  };
  if (!shy && sb.kind === 'free' && sa.kind === 'vert'){ const v = along(f.b, sa.id); if (v) sb = v; }
  if (!shy && sa.kind === 'free' && sb.kind === 'vert'){ const v = along(f.a, sb.id); if (v) sa = v; }
  // a stroke drawn close beside a line that's already there, the same way, for a good stretch, lies on that line:
  // an end of it that found nothing lands on the line (or on whatever is there on the line)
  if (!shy && (sa.kind === 'free' || sb.kind === 'free')){
    let best = null;
    const Ls = dist(f.a, f.b);
    for (const e of sk.e){
      const pa = pos[e.a] || anchorOf(vById(sk, e.a)), pb = pos[e.b] || anchorOf(vById(sk, e.b)), L = dist(pa, pb);
      if (L < 1e-9) continue;
      const d = norm(sub(pb, pa)); if (Math.abs(dot(d, f.dir)) < 0.985) continue;
      const off = p => { const r = sub(p, pa), t = dot(r, d); return { t, h: dist(r, mul(d, t)) }; };
      const oa = off(f.a), ob = off(f.b);
      if (oa.h > snapR * 0.8 || ob.h > snapR * 0.8) continue;
      const lo = Math.max(0, Math.min(oa.t, ob.t)), hi = Math.min(L, Math.max(oa.t, ob.t));
      if (hi - lo < Math.max(snapR, 0.25 * Ls)) continue;
      if (!best || oa.h + ob.h < best.score) best = { score: oa.h + ob.h, pa, d };
    }
    if (best){
      const proj = p => add(best.pa, mul(best.d, dot(sub(p, best.pa), best.d)));
      const land = (sn, end, other, skip) => { const q = proj(end), s2 = snapEnd(sk, q, pos, snapR, skip, null, proj(other)); return s2.kind === 'free' ? Object.assign({}, sn, { at: q }) : s2; };
      if (sa.kind === 'free') sa = land(sa, f.a, f.b, sb.kind === 'vert' ? sb.id : undefined);
      if (sb.kind === 'free') sb = land(sb, f.b, f.a, sa.kind === 'vert' ? sa.id : undefined);
      if (sa.kind === 'vert' && sb.kind === 'vert' && sa.id === sb.id) return { ok: false, why: 'too short' };
    }
  }
  let A = sa.at, B = sb.at;
  if (dist(A, B) < Math.max(full * 0.25, o.minLen || 0)) return { ok: false, why: 'too short' };
  // lines it crosses on the way
  const P = id => pos[id] || anchorOf(vById(sk, id));
  const skipV = new Set([sa.kind === 'vert' ? sa.id : -1, sb.kind === 'vert' ? sb.id : -1]);
  const skipE = new Set([sa.kind === 'edge' ? sa.id : -1, sb.kind === 'edge' ? sb.id : -1]);
  const Lab = dist(A, B), margin = Math.min(full * 0.25, Lab * 0.2), tolX = Math.min(full * 0.3, Lab * 0.15);
  // Which lines may it cut? A loose line (two lines overshooting make a corner), or a line inside a flat surface
  // that this stroke is drawn on (an X across a face, a line across a door). A line that merely passes over the
  // rim of some other solid's face, on its way somewhere else, leaves that solid alone.
  const faces = o.faces || [], tolP = full * 0.5;
  const onPlane = (G, p) => Math.abs(dot(G.n, sub(p, G.c))) < tolP;
  const inRegion = (G, p) => {
    for (const H of faces){
      if ((H.L || 0) !== (G.L || 0) || Math.abs(dot(H.n, G.n)) < 0.985 || Math.abs(dot(G.n, sub(H.c, G.c))) > tolP) continue;
      const Pp = H.ids.map(id => pos[id]); if (Pp.some(x => !x)) continue;
      const [u, w] = basis(H.n), to2 = x => { const d = sub(x, H.c); return [dot(d, u), dot(d, w)]; };
      const q = to2(p), poly = Pp.map(to2);
      if (insidePoly2(q, poly) || distToPoly2(q, poly) < full * 1.5) return true;
    }
    return false;
  };
  const mayCut = e => {
    const k = ekey2(e.a, e.b), adjF = faces.filter(G => G.es && G.es.includes(k));
    if (!adjF.length) return true;
    return adjF.some(G => onPlane(G, A) && onPlane(G, B) && inRegion(G, A) && inRegion(G, B));
  };
  let xs = [];
  if (!shy) for (const e of sk.e){
    if (skipE.has(e.id) || skipV.has(e.a) || skipV.has(e.b)) continue;
    const pa = P(e.a), pb = P(e.b), r = segSeg(A, B, pa, pb);
    if (!r || r.d > tolX || r.cos > 0.94) continue;
    if (!mayCut(e)) continue;
    const Le = dist(pa, pb);
    if (r.s * Lab < margin || (1 - r.s) * Lab < margin || r.t * Le < margin * 0.5 || (1 - r.t) * Le < margin * 0.5) continue;
    xs.push({ e: e.id, s: r.s, at: r.c2, a: e.a, b: e.b, da: r.t * Le, db: (1 - r.t) * Le, faced: faces.some(G => G.es && G.es.includes(ekey2(e.a, e.b))) });
  }
  // corners it runs through on the way (a line drawn along one already there and on past its end, or straight
  // through a corner): it joins them
  const thru = [];
  if (!shy) for (const v of sk.v){
    if (skipV.has(v.id)) continue;
    const q = P(v.id), s = dot(sub(q, A), sub(B, A)) / (Lab * Lab);
    if (s * Lab < margin || (1 - s) * Lab < margin) continue;
    if (dist(q, add(A, mul(sub(B, A), s))) < tolX) thru.push({ v: v.id, s, at: q });
  }
  xs = xs.filter(x => !thru.some(t => Math.abs(t.s - x.s) * Lab <= margin));
  xs.sort((x, y) => x.s - y.s);
  xs = xs.filter((x, i) => !i || (x.s - xs[i - 1].s) * Lab > margin);      // two lines crossed at one spot: once
  // an end that pokes a little past a crossing, landing on nothing, was an overshoot: the line ends at the crossing
  let dropA = false, dropB = false;
  // (past a loose line that can be a good way; past the rim of a face only as far as an end would have clicked onto
  // it anyway, because further than that it's the start of something that sticks out)
  const over = x => full * (x.faced ? 0.8 : 1.5);
  if (xs.length && sa.kind === 'free' && !sa.face && xs[0].s * Lab < over(xs[0])) dropA = true;
  if (xs.length && sb.kind === 'free' && !sb.face && (1 - xs[xs.length - 1].s) * Lab < over(xs[xs.length - 1]) && !(dropA && xs.length === 1)) dropB = true;
  const sid = sk.nid++;
  sk.s.push({ id: sid, p: pts.map(p => p.map(x => +x.toFixed(4))) });
  const fresh = new Set();
  const endTo = (sn, raw, far) => {
    if (sn.kind === 'vert'){
      const v = vById(sk, sn.id), q = pos[v.id] || anchorOf(v);
      const mine = sk.e.filter(e => e.a === v.id || e.b === v.id);
      // meeting the loose end of one other line: the corner is where the two lines cross (so lines that run past
      // each other, or stop short, still make the corner they were drawn toward)
      if (mine.length === 1 && !v.pin){
        const w = mine[0].a === v.id ? mine[0].b : mine[0].a, pw = P(w), d2 = norm(sub(q, pw)), d1 = f.dir;
        const c = dot(d1, d2), r0 = sub(f.a, pw), den = 1 - c * c;
        if (den > 0.12){
          const t1 = (c * dot(d2, r0) - dot(d1, r0)) / den, t2 = (dot(d2, r0) - c * dot(d1, r0)) / den;
          const x1 = add(f.a, mul(d1, t1)), x2 = add(pw, mul(d2, t2)), X0 = mul(add(x1, x2), 0.5);
          // (only when both really run past the crossing: then it's where they were meant to stop)
          const inMine = dot(sub(X0, raw), norm(sub(far, raw))), inTheirs = dot(sub(q, X0), d2);
          if (dist(x1, x2) < full * 0.4 && inMine > full * 0.2 && inTheirs > full * 0.2 && inMine < full * 1.5 && inTheirs < full * 1.5 && dist(X0, pw) > full * 0.5){ v.ends = [X0.map(x => +x.toFixed(4))]; delete v.split; return v.id; }
        }
      }
      // otherwise the corner takes the nearest point of this line (not its end, which may have run past or stopped short)
      // (when the stroke clearly ran on past the corner, its end says nothing about where the corner is)
      const cp = add(f.a, mul(f.dir, dot(sub(q, f.a), f.dir))), past = dot(sub(raw, cp), norm(sub(raw, far)));
      // (a corner that was made on a line stays on that line)
      if (!v.split) v.ends.push((past > full * 0.5 && dist(cp, q) < full ? cp : raw).map(x => +x.toFixed(4)));
      return v.id;
    }
    if (sn.kind === 'edge') return splitEdge(sk, sn.id, sn.at);
    const v = { id: sk.nid++, ends: [raw] };
    if (sn.L) v.b = sn.L; else if (!sn.face) fresh.add(v.id);
    sk.v.push(v); return v.id;
  };
  // a corner's target is the average of every stroke end that landed on it
  const a = dropA ? null : endTo(sa, sa.kind === 'vert' ? f.a.map(x => +x.toFixed(4)) : A, f.b);
  let sb2 = sb;
  if (!dropB && sb.kind === 'edge' && sa.kind === 'edge'){
    // the first split may have replaced the edge the far end was going to land on: find it again
    sb2 = snapEnd(sk, f.b, pos, snapR, a, o.faces, f.a);
    if (sb2.kind === 'free' && sa.id === sb.id){
      // both ends on the same line: the far end lands on the piece of it next to the first new corner
      for (const e of sk.e){
        if (e.a !== a && e.b !== a) continue;
        const pa = P(e.a), pb = P(e.b), c = closestOnSeg(B, pa, pb);
        if (dist(B, c.q) < 1e-4 && c.t > 1e-6 && c.t < 1 - 1e-6){ sb2 = { kind: 'edge', id: e.id, at: B }; break; }
      }
    }
  }
  const b = dropB ? null : endTo(sb2, sb2.kind === 'vert' ? f.b.map(x => +x.toFixed(4)) : B, f.a);
  // corners at the crossings (the line already there keeps its place)
  const chain = a === null ? [] : [a];
  const stops = [...xs, ...thru.filter(t => !(dropA && xs.length && t.s < xs[0].s) && !(dropB && xs.length && t.s > xs[xs.length - 1].s))].sort((x, y) => x.s - y.s);
  for (const x of stops){
    if (x.v !== undefined){ if (vById(sk, x.v) && x.v !== a && x.v !== b && chain[chain.length - 1] !== x.v) chain.push(x.v); continue; }
    // the crossed line may have been split by an earlier crossing or by an end: find the piece that's there now
    let best = null, bd = Infinity;
    for (const e of sk.e){
      if (e.a === a || e.b === a || e.a === b || e.b === b) continue;
      const pa = P(e.a), pb = P(e.b), c = closestOnSeg(x.at, pa, pb), d = dist(x.at, c.q);
      if (d < bd){ bd = d; best = e; }
    }
    if (!best || bd > 1e-4 + tolX * 0.01){ continue; }
    const ea = best.a, eb = best.b, da = dist(P(ea), x.at), db = dist(P(eb), x.at);
    let n;
    if (da < 1e-6) n = ea; else if (db < 1e-6) n = eb;
    else {
      n = splitEdge(sk, best.id, x.at.map(v => +v.toFixed(4)));
      // a short loose tail of the old line past the crossing was its overshoot: trim it
      const deg = id => sk.e.filter(e => e.a === id || e.b === id).length;
      for (const [end, d] of [[ea, da], [eb, db]]){
        if (d < full * 1.5 && deg(end) === 1){ sk.e = sk.e.filter(e => !((e.a === n && e.b === end) || (e.b === n && e.a === end))); sk.v = sk.v.filter(v => v.id !== end); }
      }
    }
    if (chain[chain.length - 1] !== n) chain.push(n);
  }
  if (b !== null && chain[chain.length - 1] !== b) chain.push(b);
  if (chain.length < 2){ sk.s.pop(); return { ok: false, why: 'too short' }; }
  // a new loose corner belongs with what the line's other end is part of (but never with a block that cuts: what
  // you draw is always something added)
  const first = chain[0], last = chain[chain.length - 1];
  for (const [me, other] of [[first, chain[1]], [last, chain[chain.length - 2]]]){
    const v = vById(sk, me), w = vById(sk, other);
    if (v && w && fresh.has(me) && v.b === undefined && w.b !== undefined && !fresh.has(other) && !bodyCuts(sk, bodyOf(sk, w.b), pos)) v.b = w.b;
  }
  let firstEdge = null;
  for (let i = 0; i + 1 < chain.length; i++){
    let e = edgeBetween(sk, chain[i], chain[i + 1]);
    if (!e){ e = { id: sk.nid++, a: chain[i], b: chain[i + 1], s: sid }; sk.e.push(e); }
    if (!firstEdge) firstEdge = e;
  }
  cleanupLoose(sk);
  return { ok: true, a: first, b: last, edge: firstEdge.id, snapA: sa.kind, snapB: sb.kind, crossed: xs.length };
}
// Add a stroke, but never at the cost of what's already there. If clicking the new line onto the sketch would drag
// corners that were already in place a long way (it ties things together that don't agree: faces that can't all be
// flat), it is put in again on its own terms, joining only what it really touches. bo: the options for build().
// Returns addStroke's result, plus built: { F, X } (the sketch rebuilt), and shy: true if it had to back off.
export function drawStroke(sk, pts, X, o, bo = {}){
  const saved = JSON.stringify(sk), back = () => { for (const k of Object.keys(sk)) delete sk[k]; Object.assign(sk, JSON.parse(saved)); };
  // (dragged = a line that was already there changing length a lot; turning or shifting a whole lump to square it
  // up changes no lengths, and flattening a wobbly face changes them only a little)
  let old = sk.e.filter(e => X[e.a] && X[e.b]).map(e => [e.a, e.b, dist(X[e.a], X[e.b])]), settled = false;
  // (the sketch may still have been settling by itself: measure against where it was going anyway)
  const settle = () => { if (settled) return; settled = true; const cur = JSON.stringify(sk); back(); const b0 = build(sk, Object.assign({}, bo, { warm: X })).X; old = old.map(([a, b]) => [a, b, b0[a] && b0[b] ? dist(b0[a], b0[b]) : -1]).filter(x => x[2] >= 0); for (const k of Object.keys(sk)) delete sk[k]; Object.assign(sk, JSON.parse(cur)); };
  const tryIt = oo => {
    const r = addStroke(sk, pts, X, oo);
    if (!r.ok) return r;
    r.built = build(sk, Object.assign({}, bo, { warm: X }));
    let m = 0;
    for (const [a, b, L] of old){ const p = r.built.X[a], q = r.built.X[b]; if (p && q) m = Math.max(m, Math.abs(dist(p, q) - L) / Math.max(o.snapR * 1.5, 0.12 * L)); }
    r.strain = m;
    if (m > 1 && !settled){ settle(); m = 0; for (const [a, b, L] of old){ const p = r.built.X[a], q = r.built.X[b]; if (p && q) m = Math.max(m, Math.abs(dist(p, q) - L) / Math.max(o.snapR * 1.5, 0.12 * L)); } r.strain = m; }
    return r;
  };
  let r = tryIt(o);
  if (r.ok && r.strain > 1){
    back();
    r = tryIt(Object.assign({}, o, { shy: true }));
    if (r.ok) r.shy = true;
    if (r.ok && r.strain > 1){ back(); return { ok: false, why: 'does not fit' }; }
  }
  return r;
}
// strokes whose lines are all gone are forgotten (a light version of cleanup, safe in the middle of drawing)
function cleanupLoose(sk){ const used = new Set(sk.e.map(e => e.s)); sk.s = sk.s.filter(s => used.has(s.id)); }

// Take edges out; corners left with nothing go, and a split point left in the middle of a straight run is healed.
export function removeEdges(sk, ids){
  const set = new Set(ids);
  sk.e = sk.e.filter(e => !set.has(e.id));
  cleanup(sk);
}
// Join two corners into one: every line to `drop` goes to `keep` (a line between them disappears, doubled lines become
// one), faces, holes and locks follow. `at` pins the joined corner there.
export function mergeVerts(sk, keepId, dropId, at){
  if (keepId === dropId) return;
  const keep = vById(sk, keepId), drop = vById(sk, dropId); if (!keep || !drop) return;
  for (const e of sk.e){ if (e.a === dropId) e.a = keepId; if (e.b === dropId) e.b = keepId; }
  const seen = new Set();
  sk.e = sk.e.filter(e => { if (e.a === e.b) return false; const k = e.a < e.b ? e.a + '-' + e.b : e.b + '-' + e.a; if (seen.has(k)) return false; seen.add(k); return true; });
  keep.ends = keep.ends.concat(drop.ends);
  if (at) keep.pin = at.map(x => +x.toFixed(4));
  else if (drop.pin && !keep.pin) keep.pin = anchorOf(keep).map(x => +x.toFixed(4));
  sk.v = sk.v.filter(v => v !== drop);
  renameFaces(sk, ids => ids.includes(dropId) ? [...new Set(ids.map(i => i === dropId ? keepId : i))] : null);
  basesMerge(sk, keepId, dropId);
  for (const L of sk.locks || []) for (const k of ['e', 'ea', 'eb']) if (L[k]) L[k] = L[k].map(i => i === dropId ? keepId : i);
  sk.locks = (sk.locks || []).filter(L => ['e', 'ea', 'eb'].every(k => !L[k] || L[k][0] !== L[k][1]));
  cleanup(sk);
}
// Corners closer than r (positions P) become one. Returns how many joined.
export function weld(sk, P, r){
  let n = 0, again = true;
  while (again){
    again = false;
    for (let i = 0; i < sk.v.length && !again; i++) for (let j = i + 1; j < sk.v.length && !again; j++){
      const a = sk.v[i], b = sk.v[j], pa = P[a.id], pb = P[b.id];
      if (!pa || !pb) continue;
      // two loose ends (each on a single line) this close were meant to be one corner: they reach three times as far
      const da = sk.e.filter(e => e.a === a.id || e.b === a.id), db = sk.e.filter(e => e.a === b.id || e.b === b.id);
      if (da.some(e => e.a === b.id || e.b === b.id)) continue;            // never fold a line onto itself
      let rr = r;
      if (da.length <= 1 && db.length <= 1){
        const eLen = e => dist(P[e.a] || pa, P[e.b] || pb);
        rr = Math.min(r * 3, 0.3 * Math.min(...da.map(eLen), ...db.map(eLen), Infinity));
      }
      if (dist(pa, pb) >= rr) continue;
      mergeVerts(sk, a.id, b.id); n++; again = true;
    }
  }
  return n;
}
export function splitEdgeAt(sk, eid, at){ return splitEdge(sk, eid, at); }

// Delete a corner. Lines running straight through it join back into one line (so a point in the middle of an
// edge goes and the edge stays whole); any other line at it goes with it. A corner with just two lines joins them.
export function removeVert(sk, id, pos){
  const es = sk.e.filter(e => e.a === id || e.b === id);
  const P = vid => (pos && pos[vid]) || anchorOf(vById(sk, vid));
  const other = e => e.a === id ? e.b : e.a;
  const keepPairs = [];
  if (es.length === 2) keepPairs.push([es[0], es[1]]);
  else if (es.length > 2){
    const c = P(id), dir = e => norm(sub(P(other(e)), c)), used = new Set();
    const pairs = [];
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++){ const d = dot(dir(es[i]), dir(es[j])); if (d < -0.95) pairs.push([d, es[i], es[j]]); }
    pairs.sort((a, b) => a[0] - b[0]);
    for (const [, a, b] of pairs) if (!used.has(a) && !used.has(b)){ used.add(a); used.add(b); keepPairs.push([a, b]); }
  }
  sk.e = sk.e.filter(e => e.a !== id && e.b !== id);
  for (const [a, b] of keepPairs){
    const o0 = other(a), o1 = other(b);
    if (o0 !== o1 && !edgeBetween(sk, o0, o1)) sk.e.push({ id: sk.nid++, a: o0, b: o1, s: a.s });
  }
  sk.v = sk.v.filter(v => v.id !== id);
  renameFaces(sk, ids => ids.includes(id) ? ids.filter(i => i !== id) : null);
  cleanup(sk);
}

// Pull a face out into a block: copies of its corners (where they are now, nudged out by `off` along n) joined back
// to the originals by side lines. The old loop is marked as the cap inside the extrusion. Returns the new face's corners.
export function extrude(sk, f, X, n, off, keepCap){
  const loops = [f.ids, ...(f.holes || [])], map = new Map();
  for (const L of loops) for (const id of L){
    const v = { id: sk.nid++, ends: [add(X[id], mul(n, off)).map(x => +x.toFixed(4))] };
    v.pin = v.ends[0]; sk.v.push(v); map.set(id, v.id);
    sk.e.push({ id: sk.nid++, a: id, b: v.id, s: null });
  }
  for (const L of loops) for (let i = 0; i < L.length; i++) sk.e.push({ id: sk.nid++, a: map.get(L[i]), b: map.get(L[(i + 1) % L.length]), s: null });
  // pulled out of a bigger face, the old loop stays as the new block's bottom (Join hides it); pulled out of a
  // solid's own face, the old loop is now inside that solid
  sk.skip = sk.skip || [];
  if (!keepCap && !sk.skip.includes(f.key)) sk.skip.push(f.key);
  // a lock or hole on the old face carries on to the new one
  const nk = faceKey(f.ids.map(id => map.get(id)));
  if (!keepCap) for (const L of sk.locks || []){ if (L.f === f.key) L.f = nk; if (L.a === f.key) L.a = nk; if (L.b === f.key) L.b = nk; }
  sk.open = (sk.open || []).map(k => k === f.key ? nk : k);
  return { key: nk, ids: [...map.values()], map };
}

// Push or pull a face: a new body stands on it. dirN: the way it goes (unit), off: how far; outN: which way is
// out of the solid the face belongs to (if known). The body adds when it ends up on the out side, cuts on the in side.
export function pushPull(sk, f, X, dirN, off, outN){
  sk.bodies = sk.bodies || [];
  const id = sk.nid++, base = f.ids.slice(), map = new Map();
  for (const vid of base){
    const p = add(X[vid], mul(dirN, off)).map(x => +x.toFixed(4));
    const v = { id: sk.nid++, ends: [p], pin: p, b: id }; sk.v.push(v); map.set(vid, v.id);
    sk.e.push({ id: sk.nid++, a: vid, b: v.id, s: null });
  }
  for (let i = 0; i < base.length; i++) sk.e.push({ id: sk.nid++, a: map.get(base[i]), b: map.get(base[(i + 1) % base.length]), s: null });
  const nb = planeOf(base.map(i => X[i])).n;
  sk.bodies.push({ id, base, s: dot(nb, outN || dirN) < 0 ? -1 : 1 });
  return { id, key: faceKey([...map.values()]), ids: [...map.values()], map };
}

export function cleanup(sk){
  for (let pass = 0; pass < 4; pass++){
    const deg = new Map();
    for (const e of sk.e){ deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
    sk.v = sk.v.filter(v => deg.get(v.id));
    let changed = false;
    for (const v of sk.v){
      if (!v.split || deg.get(v.id) !== 2) continue;
      const es = sk.e.filter(e => e.a === v.id || e.b === v.id);
      const o0 = es[0].a === v.id ? es[0].b : es[0].a, o1 = es[1].a === v.id ? es[1].b : es[1].a;
      const P = anchorOf(v), A = anchorOf(vById(sk, o0)), B = anchorOf(vById(sk, o1));
      if (dot(norm(sub(A, P)), norm(sub(B, P))) < -0.985 && !edgeBetween(sk, o0, o1)){
        sk.e = sk.e.filter(e => e !== es[0] && e !== es[1]);
        sk.e.push({ id: sk.nid++, a: o0, b: o1, s: es[0].s });
        sk.v = sk.v.filter(x => x !== v);
        renameFaces(sk, ids => ids.includes(v.id) ? ids.filter(i => i !== v.id) : null);
        basesDrop(sk, v.id);
        changed = true; break;
      }
    }
    if (!changed) break;
  }
  const used = new Set(sk.e.map(e => e.s));
  sk.s = sk.s.filter(s => used.has(s.id));
  const alive = new Set(sk.v.map(v => v.id));
  sk.skip = (sk.skip || []).filter(k => k.split('.').every(id => alive.has(+id)));
  sk.locks = (sk.locks || []).filter(L => [L.e, L.ea, L.eb].every(e => !e || e.every(id => alive.has(id))));
  // bodies: a base keeps only corners that still exist; a body with no base or no corners of its own is gone
  if (sk.bodies && sk.bodies.length){
    for (const B of sk.bodies) B.base = B.base.filter(id => alive.has(id));
    const has = new Set(sk.v.filter(v => v.b !== undefined).map(v => v.b));
    sk.bodies = sk.bodies.filter(B => B.base.length >= 3 && has.has(B.id));
    const live = new Set(sk.bodies.map(B => B.id));
    for (const v of sk.v) if (v.b !== undefined && !live.has(v.b)) delete v.b;
  }
}

// ---------------------------------------------------------------- faces
const faceKey = ids => [...ids].sort((a, b) => a - b).join('.');
export { faceKey };

// Newell normal + centroid of a polygon
function planeOf(P){
  let n = [0, 0, 0], c = [0, 0, 0];
  for (let i = 0; i < P.length; i++){
    const a = P[i], b = P[(i + 1) % P.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    c = add(c, a);
  }
  const area = len(n) / 2;
  return { n: norm(n), c: mul(c, 1 / P.length), area };
}
function basis(n){
  const t = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(t, n)), w = cross(n, u);
  return [u, w];
}
function segsCross2(a, b, c, d){
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 && d2 && d3 && d4;
}
function insidePoly2(p, poly){
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function distToPoly2(p, poly){
  let d = Infinity;
  for (let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length], ab = [b[0] - a[0], b[1] - a[1]], L2 = ab[0] * ab[0] + ab[1] * ab[1];
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2)) : 0;
    d = Math.min(d, Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t));
  }
  return d;
}

const ekey2 = (a, b) => a < b ? a + '-' + b : b + '-' + a;
// Every closed loop of lines that lies (nearly) flat and has nothing cutting across it is a face.
// Loops are kept smallest first, and a line belongs to at most two faces (within one layer, see findFaces).
// vids: the corners to look among, edges: [{a, b}] between them. opt.skip: honour sk.skip, opt.keep: only these loops.
function layerFaces(sk, pos, o, vids, edges, opt = {}){
  const rel = o.rel ?? 0.22, minTol = o.minTol ?? 0.015, maxSides = o.maxSides ?? 32;
  const P = id => pos[id];
  const adj = new Map();
  for (const id of vids) adj.set(id, []);
  for (const e of edges){ if (!adj.has(e.a) || !adj.has(e.b) || adj.get(e.a).includes(e.b)) continue; adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); }
  const hasEdge = (a, b) => adj.get(a)?.includes(b);
  const cands = new Map();
  const skipSet = new Set(opt.skip ? sk.skip || [] : []);
  let work = 0;
  for (const [s0, nbs] of adj) for (const t0 of nbs){
    if (t0 < s0) continue;
    // loops through this line, found from the loop's smallest corner (so the search stays small)
    const s = s0, t = t0;
    const path = [s, t], onPath = new Set(path), pl = { n: null, c: null };
    let maxL = dist(P(s), P(t));
    const go = () => {
      if (++work > 3000000) return;
      const last = path[path.length - 1];
      for (const w of adj.get(last)){
        if (w === s && path.length >= 3){ const k = faceKey(path); if (!cands.has(k)) cands.set(k, path.slice()); continue; }
        if (onPath.has(w) || path.length >= maxSides || w < s) continue;
        const pw = P(w), L = Math.max(maxL, dist(P(last), pw)), tol = Math.max(minTol, rel * L) * 1.6;
        const sn = pl.n, sc = pl.c;
        if (pl.n){ if (Math.abs(dot(pl.n, sub(pw, pl.c))) > tol) continue; }
        else {
          // the first time three corners make a real angle, that's the plane to test the rest against
          const p0 = P(path[0]), p1 = P(last);
          for (let i = 0; i < path.length - 1 && !pl.n; i++){
            const a = norm(sub(P(path[i + 1]), P(path[i]))), b = norm(sub(pw, p1)), c = cross(sub(p1, p0), sub(pw, p0));
            if (len(cross(a, b)) > 0.25 && len(c) > 1e-9){ pl.n = norm(c); pl.c = p0; }
          }
        }
        const sL = maxL; maxL = L; path.push(w); onPath.add(w);
        go();
        path.pop(); onPath.delete(w); pl.n = sn; pl.c = sc; maxL = sL;
      }
    };
    go();
  }

  // test each loop properly
  const good = [];
  for (const [k, ids] of cands){
    if (opt.keep && !opt.keep(ids)) continue;
    const pts = ids.map(P);
    const pl = planeOf(pts);
    if (pl.area < 1e-8) continue;
    let sumL = 0;
    for (let i = 0; i < pts.length; i++) sumL += dist(pts[i], pts[(i + 1) % pts.length]);
    const tol = Math.max(minTol, rel * sumL / pts.length);
    let err = 0;
    for (const p of pts) err = Math.max(err, Math.abs(dot(pl.n, sub(p, pl.c))));
    if (err > tol) continue;
    // and every line of it has to lie along the plane (a short line standing up out of a loop of long ones is the
    // sign of a loop that wanders over several faces)
    let steep = false;
    for (let i = 0; i < pts.length && !steep; i++){ const d = sub(pts[(i + 1) % pts.length], pts[i]); if (Math.abs(dot(pl.n, d)) > Math.max(minTol * 3, 0.4 * len(d))) steep = true; }
    if (steep) continue;
    const [u, w] = basis(pl.n), to2 = p => { const d = sub(p, pl.c); return [dot(d, u), dot(d, w)]; };
    const poly = pts.map(to2);
    // a chord: a line joining two corners of the loop that aren't next to each other, running across the inside,
    // cuts it in two. (One running outside it, across the mouth of a notch, like the bottom of a box standing in
    // the notch, doesn't.)
    let chord = false;
    for (let i = 0; i < ids.length && !chord; i++)
      for (let j = i + 2; j < ids.length && !chord; j++){
        if (i === 0 && j === ids.length - 1) continue;
        if (!hasEdge(ids[i], ids[j])) continue;
        // inside means inside on both sides of it (a line along the mouth of a notch has the notch on one side
        // and the outside on the other); tested a little either side so a line lying along the rim can't fool it
        const a = poly[i], b = poly[j], dx = b[0] - a[0], dy = b[1] - a[1], Lc = Math.hypot(dx, dy) || 1, e = 0.02 * Lc;
        const nx = -dy / Lc * e, ny = dx / Lc * e;
        let both = 0;
        for (const t of [0.3, 0.5, 0.7]){
          const m = [a[0] + dx * t, a[1] + dy * t];
          if (insidePoly2([m[0] + nx, m[1] + ny], poly) && insidePoly2([m[0] - nx, m[1] - ny], poly)) both++;
        }
        if (both >= 2) chord = true;
      }
    if (chord) continue;
    // must not cross itself
    let selfX = false;
    for (let i = 0; i < poly.length && !selfX; i++)
      for (let j = i + 2; j < poly.length && !selfX; j++){
        if (i === 0 && j === poly.length - 1) continue;
        if (segsCross2(poly[i], poly[(i + 1) % poly.length], poly[j], poly[(j + 1) % poly.length])) selfX = true;
      }
    if (selfX) continue;
    // a loop that's the cap left inside an extrusion isn't a face (while something still stands on it)
    if (skipSet.has(k) && ids.every(id => adj.get(id).length >= 3)) continue;
    // corners sitting inside it, on its plane: a closed loop of them (touching nothing on the rim) is a hole,
    // like a rectangle drawn in the middle of a big face; lines that cut across from rim to rim mean it isn't one face
    // (lying on it means close to its plane by the measure of a hand's wobble, much tighter than the loop's own test)
    const inSet = new Set(ids), inner = new Set(), tolIn = Math.max(minTol * 2, Math.min(tol, 0.06 * sumL / pts.length));
    for (const vid of vids){
      if (inSet.has(vid)) continue;
      const p = P(vid);
      if (Math.abs(dot(pl.n, sub(p, pl.c))) > tolIn) continue;
      const q = to2(p);
      if (insidePoly2(q, poly) && distToPoly2(q, poly) > tol * 0.5) inner.add(vid);
    }
    let blocked = false;
    const islands = [];
    for (const start of inner){
      if (islands.some(I => I.set.has(start))) continue;
      const set = new Set([start]), st = [start];
      let contacts = 0;
      while (st.length){ const x = st.pop(); for (const y of adj.get(x)){ if (inner.has(y) && !set.has(y)){ set.add(y); st.push(y); } else if (inSet.has(y)) contacts++; } }
      if (contacts >= 2){ blocked = true; break; }
      islands.push({ set, contacts });
    }
    if (blocked) continue;
    const holes = [];
    for (const I of islands){
      if (I.contacts) continue;                     // a single spur off the rim: just a loose line on the face
      // only a shape drawn flat in the face is a hole in it; something standing on the face (lines leaving the
      // plane) is a solid of its own, and Join sorts out where they meet
      if ([...I.set].some(id => adj.get(id).some(y => !I.set.has(y)))) continue;
      const loop = islandLoop(I.set, adj, cands, P);
      if (loop) holes.push(loop);
    }
    // only the outermost islands are holes in this face (one inside another belongs to that one)
    const hp = holes.map(h => h.map(id => to2(P(id))));
    const top = holes.filter((h, i) => !hp.some((q, j) => j !== i && insidePoly2(to2(P(h[0])), q)));
    let area = pl.area;
    for (const h of top) area -= planeOf(h.map(P)).area;
    good.push({ key: k, ids, holes: top, all: top.length ? [...ids, ...top.flat()] : ids, n: pl.n, c: pl.c, area, err: err / tol, poly });
  }
  // a wall between two solids drawn sharing a face is inside them: along every one of its lines, two other faces
  // carry straight on across it (flat, one each side), like the two tops of boxes drawn side by side. Drop it.
  {
    const byE = new Map(), ek = (a, b) => a < b ? a + '-' + b : b + '-' + a;
    for (const f of good) for (let i = 0; i < f.ids.length; i++){ const k = ek(f.ids[i], f.ids[(i + 1) % f.ids.length]); if (!byE.has(k)) byE.set(k, []); byE.get(k).push(f); }
    const crossesAt = (W, a, b) => {
      const others = (byE.get(ek(a, b)) || []).filter(g => g !== W);
      const A = P(a), ed = norm(sub(P(b), A));
      const side = g => { const d = sub(g.c, A); return sub(d, mul(ed, dot(d, ed))); };
      for (let i = 0; i < others.length; i++) for (let j = i + 1; j < others.length; j++){
        const g = others[i], h = others[j];
        if (Math.abs(dot(g.n, h.n)) > 0.995 && dot(side(g), side(h)) < 0) return true;
      }
      return false;
    };
    for (let i = good.length - 1; i >= 0; i--){
      const f = good[i];
      if (!f.holes.length && f.ids.every((id, j) => crossesAt(f, id, f.ids[(j + 1) % f.ids.length]))) good.splice(i, 1);
    }
  }
  good.sort((a, b) => (a.area * (1 + a.err)) - (b.area * (1 + b.err)));
  const use = new Map(), faces = [], byEdge = new Map(), bySet = new Set();
  const openSet = new Set(sk.open || []);
  // which way a face heads off from one of its lines (in its plane, into the face)
  const headings = f => {
    const m = new Map();
    [f.ids, ...f.holes].forEach((L, li) => {
      const sgn = li && dot(planeOf(L.map(P)).n, f.n) > 0 ? -1 : 1;      // a hole wound like the rim has the face on its other side
      L.forEach((id, i) => { const o = L[(i + 1) % L.length]; m.set(ekey2(id, o), mul(cross(f.n, norm(sub(P(o), P(id)))), sgn)); });
    });
    return m;
  };
  const setKey = es => es.slice().sort().join('|');
  const xor = (A, Bset, B, Aset) => A.filter(x => !Bset.has(x)).concat(B.filter(x => !Aset.has(x)));
  // is the loop with lines es just face g plus one or two other faces already found (their shared lines cancelling)?
  const foldOf = (es, g) => {
    const D = xor(es, g.esSet, g.es, new Set(es));
    if (D.length < 3) return false;
    if (bySet.has(setKey(D))) return true;
    const Dset = new Set(D), seen = new Set();
    for (const k of D) for (const h of byEdge.get(k) || []){
      if (h === g || seen.has(h)) continue; seen.add(h);
      const D2 = xor(D, h.esSet, h.es, Dset);
      if (D2.length >= 3 && bySet.has(setKey(D2))) return true;
    }
    return false;
  };
  for (const f of good){
    const loopEdges = L => L.map((id, i) => ekey2(id, L[(i + 1) % L.length]));
    const es = [f.ids, ...f.holes].flatMap(loopEdges);
    if (es.some(k => (use.get(k) || 0) >= 6)) continue;
    // More than two faces can meet along a line (a box drawn against another shares lines with it), but each has
    // to head off its own way: a loop lying over a face that's already there (same side of the line) isn't a face.
    // Where two faces already meet, a third has to be well clear of both.
    const hd = headings(f), mineIds = new Set(f.all), [fu, fw] = basis(f.n);
    // a corner (of another face) well outside this loop, seen in this loop's plane
    const sticksOut = id => { if (mineIds.has(id)) return false; const d = sub(P(id), f.c), q = [dot(d, fu), dot(d, fw)]; return !insidePoly2(q, f.poly) && distToPoly2(q, f.poly) > minTol * 2; };
    let overlap = false;
    for (const k of es){
      const mine = hd.get(k), there = byEdge.get(k) || [];
      for (const g of there){
        const theirs = g.hd.get(k), c = dot(mine, theirs);
        // (two faces in one plane that merely overlap, each reaching out past the other, are both real: two boxes
        // drawn flush have walls like that, and Join shows the overlap once)
        // (while a loop that takes in all of the face that's there, or is that face with one or two of its
        // neighbours folded flat onto it, like the walls of a very thin slab, isn't a face)
        if (c > 0.97 ? !g.all.some(sticksOut) || foldOf(es, g) : c > 0.8 && there.length >= 2){ overlap = true; break; }
      }
      if (overlap) break;
    }
    if (overlap) continue;
    // a loop that runs round two faces folded along the line between them (near enough flat to pass) isn't a face
    if (!f.holes.length){
      let fold = false;
      const mineSet = new Set(es), seen = new Set();
      for (const k of es){
        for (const g of byEdge.get(k) || []){
          if (seen.has(g)) continue; seen.add(g);
          const rest = es.filter(x => !g.esSet.has(x)).concat(g.es.filter(x => !mineSet.has(x)));
          if (rest.length >= 3 && bySet.has(setKey(rest))){ fold = true; break; }
        }
        if (fold) break;
      }
      if (fold) continue;
    }
    f.open = openSet.has(f.key);
    f.es = es; f.esSet = new Set(es); f.hd = hd;
    faces.push(f); bySet.add(setKey(es));
    for (const k of es){ use.set(k, (use.get(k) || 0) + 1); if (!byEdge.has(k)) byEdge.set(k, []); byEdge.get(k).push(f); }
  }
  return faces;
}
// Faces, layer by layer. The sketch you drew is layer 0. Each body (a pushed or pulled face) is a layer of its
// own: its own corners plus the base loop it stands on, so a body and what it stands on can both be whole even
// though they share lines. Faces that share a line (within a layer) make a shell; a shell with every line shared
// by exactly two of its faces is a solid. Lines that tie different layers together can still make loose faces.
// Returns { faces, pieces (the shells), comp (corner → connected lump, for tidying), loose, edgeUse, bodies }.
export function findFaces(sk, pos, o = {}){
  const bodies = (sk.bodies || []).filter(B => B.base.length >= 3 && B.base.every(id => pos[id]));
  const bSet = new Map(bodies.map(B => [B.id, new Set(B.base)]));
  const tag = new Map(sk.v.map(v => [v.id, v.b !== undefined && bSet.has(v.b) ? v.b : 0]));
  // which layer a line is in: 0, a body's id, or -1 for a line tying two layers together
  const layerOf = e => {
    const ta = tag.get(e.a), tb = tag.get(e.b);
    if (ta === tb) return ta;
    if (ta && bSet.get(ta).has(e.b)) return ta;
    if (tb && bSet.get(tb).has(e.a)) return tb;
    return -1;
  };
  const eL = new Map(sk.e.map(e => [e.id, layerOf(e)]));
  const faces = [], shellsOf = [];
  const layers = [{ L: 0, vids: sk.v.filter(v => tag.get(v.id) === 0).map(v => v.id), edges: sk.e.filter(e => eL.get(e.id) === 0) }];
  for (const B of bodies){
    const vids = [...new Set([...sk.v.filter(v => tag.get(v.id) === B.id).map(v => v.id), ...B.base])];
    const edges = sk.e.filter(e => eL.get(e.id) === B.id).map(e => ({ a: e.a, b: e.b }));
    for (let i = 0; i < B.base.length; i++) edges.push({ a: B.base[i], b: B.base[(i + 1) % B.base.length] });   // the base loop, whether or not its lines are still drawn
    layers.push({ L: B.id, vids, edges, B });
  }
  const pieces = [], shells = [], bodyInfo = new Map(), found = [];
  for (const ly of layers){
    const fs = layerFaces(sk, pos, o, ly.vids, ly.edges, { skip: ly.L === 0 });
    let cut = false;
    if (ly.B){
      // a body cuts when its own corners lie on the inside of the face it stands on
      const nb = mul(planeOf(ly.B.base.map(id => pos[id])).n, ly.B.s || 1);
      let cb = [0, 0, 0], ct = [0, 0, 0], nt = 0;
      for (const id of ly.B.base) cb = add(cb, pos[id]);
      for (const id of ly.vids) if (tag.get(id) === ly.L){ ct = add(ct, pos[id]); nt++; }
      if (nt) cut = dot(sub(mul(ct, 1 / nt), mul(cb, 1 / ly.B.base.length)), nb) < 0;
      bodyInfo.set(ly.L, { cut, base: ly.B.base });
    }
    found.push({ ly, fs, cut });
  }
  // faces across layers: loops that use at least one line tying your sketch to a body (a box drawn up against a
  // pulled-out block, a line from a block's corner back to the wall). They belong with your sketch.
  const cross = new Set(sk.e.filter(e => eL.get(e.id) === -1).map(e => ekey2(e.a, e.b)));
  if (cross.size){
    const edges = sk.e.map(e => ({ a: e.a, b: e.b }));
    const fs = layerFaces(sk, pos, o, sk.v.map(v => v.id), edges, { keep: ids => ids.some((id, i) => cross.has(ekey2(id, ids[(i + 1) % ids.length]))) });
    for (const f of fs){ f.glue = true; found[0].fs.push(f); }
  }
  for (const { ly, fs, cut } of found){
    addShells(fs, ly.L, cut, pieces, pos, shells);
    for (const f of fs) faces.push(f);
  }
  // corners joined by lines (any layer): used for tidying a lump of sketch together
  const adjAll = new Map(sk.v.map(v => [v.id, []]));
  for (const e of sk.e){ adjAll.get(e.a)?.push(e.b); adjAll.get(e.b)?.push(e.a); }
  const comp = new Map();
  let nc = 0;
  for (const v of sk.v){
    if (comp.has(v.id)) continue;
    const st = [v.id]; comp.set(v.id, nc);
    while (st.length){ const x = st.pop(); for (const y of adjAll.get(x)) if (!comp.has(y)){ comp.set(y, nc); st.push(y); } }
    nc++;
  }
  const useAll = new Map();
  for (const f of faces) for (const k of f.es) useAll.set(k, (useAll.get(k) || 0) + 1);
  const loose = [], edgeUse = new Map();
  for (const e of sk.e){ const u = useAll.get(ekey2(e.a, e.b)) || 0; edgeUse.set(e.id, u); if (!u) loose.push(e.id); }
  return { faces, pieces, shells, comp, loose, edgeUse, bodies: bodyInfo };
}
// group a layer's faces into shells (faces joined through shared lines), and find the solids in each: the closed
// rooms its faces wall off. A plain box is one room; two boxes drawn sharing a line, a corner or part of a face are
// two rooms with (maybe) a wall between; a flap hanging off a box is the box's room plus one loose face.
function addShells(fs, L, cut, pieces, pos, shells){
  const par = fs.map((_, i) => i), root = i => par[i] === i ? i : (par[i] = root(par[i]));
  const owner = new Map();
  fs.forEach((f, i) => { for (const k of f.es){ if (owner.has(k)) par[root(i)] = root(owner.get(k)); else owner.set(k, i); } });
  const byRoot = new Map();
  fs.forEach((f, i) => { const r = root(i); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(f); });
  for (const [, group] of byRoot){
    const minOf = list => { let m = Infinity; for (const f of list) for (const id of f.all) if (id < m) m = id; return m; };
    const rooms = roomsOf(group, pos);
    const inRoom = new Set();
    for (const R of rooms){
      const pc = { id: pieces.length, L, cut: !!cut, solid: true, closed: !cut && !R.some(x => x.f.open), faces: R.length, minId: minOf(R.map(x => x.f)), fl: R };
      pieces.push(pc);
      for (const { f, loop } of R){
        if (inRoom.has(f)){ f.wall = true; continue; }          // between two rooms: inside the solid, never on show
        inRoom.add(f); f.piece = pc.id; f.L = L; f.loop = loop; f.out = planeOf(loop.map(id => pos[id])).n;
      }
    }
    // the shell itself (for Join): clean when it's one plain closed room and nothing else
    if (shells){
      const sh = { id: shells.length, L, cut: !!cut, clean: rooms.length === 1 && rooms[0].length === group.length, faces: group, minId: minOf(group) };
      shells.push(sh);
      for (const f of group) f.shell = sh.id;
    }
    const rest = group.filter(f => !inRoom.has(f));
    if (rest.length){
      const pc = { id: pieces.length, L, cut: false, solid: false, closed: false, faces: rest.length, minId: minOf(rest) };
      pieces.push(pc);
      for (const f of rest){ f.piece = pc.id; f.L = L; }
    }
  }
}
// The closed rooms among a set of faces. Every face has two sides; going round each line, the side of one face looks
// across at the side of the next face round, and sides that see each other are in the same space. A space with
// volume walled all round is a room. Returns [[{ f, loop (wound so its normal points out of the room) }]].
function roomsOf(group, pos){
  const n = group.length, par = Array.from({ length: 2 * n }, (_, i) => i);
  const root = i => par[i] === i ? i : (par[i] = root(par[i]));
  const P = id => pos[id];
  const at = new Map();
  group.forEach((f, i) => { for (const [k, w] of f.hd){ if (!at.has(k)) at.set(k, []); at.get(k).push({ i, w, f }); } });
  for (const [k, list] of at){
    const [a, b] = k.split('-').map(Number), d = norm(sub(P(b), P(a)));
    let e1 = sub(list[0].w, mul(d, dot(list[0].w, d))); e1 = norm(e1); const e2 = cross(d, e1);
    for (const it of list){
      it.th = Math.atan2(dot(it.w, e2), dot(it.w, e1));
      const plus = dot(it.f.n, cross(d, it.w)) > 0;        // side 0 of a face is the side its normal points to
      it.ccw = 2 * it.i + (plus ? 0 : 1); it.cw = 2 * it.i + (plus ? 1 : 0);
    }
    list.sort((x, y) => x.th - y.th);
    for (let j = 0; j < list.length; j++){ const ra = root(list[j].ccw), rb = root(list[(j + 1) % list.length].cw); if (ra !== rb) par[ra] = rb; }
  }
  const spaces = new Map();
  for (let h = 0; h < 2 * n; h++){ const r = root(h); if (!spaces.has(r)) spaces.set(r, []); spaces.get(r).push(h); }
  const rooms = [];
  for (const [, hs] of spaces){
    const cnt = new Map(); for (const h of hs) cnt.set(h >> 1, (cnt.get(h >> 1) || 0) + 1);
    const walls = hs.filter(h => cnt.get(h >> 1) === 1);          // a face with both sides in here is just hanging in it
    if (walls.length < 4) continue;
    let vol = 0;
    const R = walls.map(h => {
      const f = group[h >> 1], loop = (h & 1) ? f.ids.slice() : f.ids.slice().reverse();     // the room is on side 0: flip so the normal points away
      vol += dot((h & 1) ? f.n : mul(f.n, -1), P(f.ids[0])) * f.area / 3;
      return { f, loop };
    });
    if (vol > 1e-7) rooms.push(R);
  }
  return rooms;
}

// the boundary of an island of corners: walk it if it's a plain ring, otherwise the biggest flat loop through
// its corners that has all the rest inside
function islandLoop(set, adj, cands, P){
  const nb = id => adj.get(id).filter(y => set.has(y));
  if ([...set].every(id => nb(id).length === 2)){
    const s0 = [...set][0], L = [s0];
    let prev = s0, cur = nb(s0)[0];
    while (cur !== s0 && L.length <= set.size){ L.push(cur); const nx = nb(cur).find(y => y !== prev); prev = cur; cur = nx; }
    return L.length === set.size ? L : null;
  }
  let best = null, ba = 0;
  for (const [, ids] of cands){
    if (!ids.every(id => set.has(id))) continue;
    const a = planeOf(ids.map(P)).area;
    if (a > ba){ ba = a; best = ids; }
  }
  return best;
}

// ---------------------------------------------------------------- solver
// o: { iters, flat (0..1), square (bool), squareDeg, floor (bool), floorR, warm: positions to start from, drag: {id: [x,y,z]} }
export function solve(sk, F, o = {}){
  const iters = o.iters ?? 60, wFlat = (o.flat ?? 1) * 2, wSq = o.square ? 1.2 : 0, cosT = Math.cos((o.squareDeg ?? 10) * Math.PI / 180);
  const sinT = Math.sin((o.squareDeg ?? 10) * Math.PI / 180);
  const ids = sk.v.map(v => v.id), A = {}, X = {}, wA = {};
  for (const v of sk.v){
    A[v.id] = (o.drag && o.drag[v.id]) || anchorOf(v);
    wA[v.id] = (o.drag && o.drag[v.id]) ? 40 : v.pin ? 4 : 0.6;
    X[v.id] = (o.warm && o.warm[v.id] && !(o.drag && o.drag[v.id])) ? o.warm[v.id].slice() : A[v.id].slice();
  }
  // each piece's grid direction in plan: the length-weighted average of its level edges' directions (mod 90°)
  const yaw = new Map();
  if (wSq){
    const acc = new Map();
    for (const e of sk.e){
      const d = sub(A[e.b], A[e.a]), h = Math.hypot(d[0], d[2]);
      if (h < 0.3 * len(d)) continue;
      const ph = Math.atan2(d[2], d[0]) * 4, c = F.comp.get(e.a), a = acc.get(c) || [0, 0];
      a[0] += h * Math.cos(ph); a[1] += h * Math.sin(ph); acc.set(c, a);
    }
    for (const [c, a] of acc) yaw.set(c, Math.atan2(a[1], a[0]) / 4);
  }
  const faces = F.faces.filter(f => !f.open);
  const byKey = new Map(F.faces.map(f => [f.key, f])), locks = (sk.locks || []).filter(L => lockAlive(L, byKey, X));
  const lockedV = new Set();
  for (const L of locks){
    // a lock that sets a face's or line's direction takes its lines out of Square up (they follow the lock);
    // one plane / parallel faces and level or floor faces leave Square up to keep them square
    if (L.mode === 'coplanar' || L.mode === 'parallel' && !L.ea || L.mode === 'level' || L.mode === 'floor') continue;
    for (const k of [L.f, L.a, L.b]) if (k) for (const id of byKey.get(k).all) lockedV.add(id);
    for (const e of [L.e, L.ea, L.eb]) if (e) for (const id of e) lockedV.add(id);
  }
  const G = {}, W = {};
  for (let it = 0; it < iters; it++){
    for (const id of ids){ G[id] = mul(A[id], wA[id]); W[id] = wA[id]; }
    if (wFlat){
      for (const f of faces){
        const pl = planeOf(f.ids.map(id => X[id]));
        for (const id of f.all){
          const p = X[id], q = sub(p, mul(pl.n, dot(pl.n, sub(p, pl.c))));
          G[id] = add(G[id], mul(q, wFlat)); W[id] += wFlat;
        }
      }
    }
    if (wSq){
      for (const e of sk.e){
        if (lockedV.has(e.a) && lockedV.has(e.b)) continue;   // a locked face's own lines follow its lock
        const a = X[e.a], b = X[e.b], d = sub(b, a), L = len(d);
        if (!L) continue;
        const u = mul(d, 1 / L);
        let t = null;
        if (Math.abs(u[1]) > cosT) t = [0, Math.sign(u[1]) * L, 0];            // plumb
        else {
          let dy = d[1], hx = d[0], hz = d[2], h = Math.hypot(hx, hz), snapped = false;
          if (Math.abs(u[1]) < sinT){ dy = 0; snapped = true; }                 // level
          const y0 = yaw.get(F.comp.get(e.a));
          if (y0 !== undefined && h > 0.2 * L){
            const ang = Math.atan2(hz, hx), q = Math.PI / 2, k = Math.round((ang - y0) / q), ta = y0 + k * q;
            if (Math.abs(ang - ta) < (o.squareDeg ?? 10) * Math.PI / 180){ hx = Math.cos(ta) * h; hz = Math.sin(ta) * h; snapped = true; } // on the grid
          }
          if (snapped){ const s = L / Math.hypot(hx, dy, hz); t = [hx * s, dy * s, hz * s]; }
        }
        if (!t) continue;
        const m = mul(add(a, b), 0.5);
        G[e.a] = add(G[e.a], mul(sub(m, mul(t, 0.5)), wSq)); W[e.a] += wSq;
        G[e.b] = add(G[e.b], mul(add(m, mul(t, 0.5)), wSq)); W[e.b] += wSq;
      }
    }
    if (locks.length) applyLocks(sk, locks, byKey, X, G, W, 30, wSq ? (o.squareDeg ?? 10) : 0);
    if (o.floor){
      for (const id of ids){
        if (A[id][1] < (o.floorR ?? 0.05) && A[id][1] > -(o.floorR ?? 0.05)){ G[id] = add(G[id], mul([X[id][0], 0, X[id][2]], 2)); W[id] += 2; }
      }
    }
    for (const id of ids) X[id] = mul(G[id], 1 / W[id]);
  }
  hardFlat(faces, X, wA, o.hardIters ?? 400);
  // locks are firm too: take turns holding them exactly and flattening again, until both settle
  if (locks.length){
    for (let r = 0; r < 30; r++){
      const G2 = {}, W2 = {};
      for (const id of ids){ G2[id] = [0, 0, 0]; W2[id] = 0; }
      applyLocks(sk, locks, byKey, X, G2, W2, 1, wSq ? (o.squareDeg ?? 10) : 0);
      let moved = 0;
      for (const id of ids) if (W2[id]){ const q = mul(G2[id], 1 / W2[id]); moved = Math.max(moved, dist(q, X[id])); X[id] = q; }
      hardFlat(faces, X, wA, 60);
      if (moved < 1e-5) break;
    }
  }
  // corners that sit on the floor sit exactly on it (so bottoms of different solids share one plane)
  if (o.floor){
    const R = o.floorR ?? 0.05, fl = ids.filter(id => Math.abs(A[id][1]) < R && Math.abs(X[id][1]) < R * 2);
    if (fl.length) for (let r = 0; r < 12; r++){
      let moved = 0;
      for (const id of fl){ moved = Math.max(moved, Math.abs(X[id][1])); X[id][1] = 0; }
      if (moved < 1e-7) break;
      if (hardFlat(faces, X, wA, 40) < 1e-5 && r > 0){ for (const id of fl) X[id][1] = 0; break; }
    }
  }
  return X;
}

// Flat is a rule, not a wish: after the soft pass, every face is projected onto its own plane, one face at a time,
// over and over, until no corner is more than a hundredth of a millimetre off any of its faces. Each plane passes
// through its corners' weighted middle, so a corner you're holding (or have placed) barely moves and the others give.
export function hardFlat(faces, X, wt, maxIt){
  if (!faces.length) return 0;
  let worst = 0;
  for (let it = 0; it < maxIt; it++){
    worst = 0;
    for (const f of faces){
      const all = f.all || f.ids, pl = planeOf(f.ids.map(id => X[id]));
      let c = [0, 0, 0], sw = 0;
      for (const id of all){ const w = wt ? wt[id] || 1 : 1; c = add(c, mul(X[id], w)); sw += w; }
      c = mul(c, 1 / sw);
      for (const id of all){
        const d = dot(pl.n, sub(X[id], c));
        if (Math.abs(d) > worst) worst = Math.abs(d);
        X[id] = sub(X[id], mul(pl.n, d));
      }
    }
    if (worst < 1e-5) break;
  }
  return worst;
}

// How far from flat each face still is (for a little readout), as a share of its size
export function flatness(F, X){
  let worst = 0;
  for (const f of F.faces){
    if (f.open) continue;
    const pts = f.ids.map(id => X[id]), pl = planeOf(pts);
    let s = 0; for (let i = 0; i < pts.length; i++) s = Math.max(s, dist(pts[i], pts[(i + 1) % pts.length]));
    for (const p of f.all.map(id => X[id])) worst = Math.max(worst, Math.abs(dot(pl.n, sub(p, pl.c))) / (s || 1));
  }
  return worst;
}
export { planeOf, basis };

// ---------------------------------------------------------------- locks
// A face can be locked Level, Upright, or Held at its tilt; two faces sharing an edge can be locked at an angle
// (a fixed one, or the nearest of a step like 15°). The angle between two faces is measured inside, across their
// shared edge: 90° at a box corner, 180° where they carry on flat.

// turn point x about the line through p along unit k by angle a
export function rotAbout(x, p, k, a){
  const v = sub(x, p), c = Math.cos(a), sn = Math.sin(a);
  return add(p, add(add(mul(v, c), mul(cross(k, v), sn)), mul(k, dot(k, v) * (1 - c))));
}
export function sharedEdge(A, B){
  for (let i = 0; i < A.length; i++){
    const u = A[i], v = A[(i + 1) % A.length], j = B.indexOf(u);
    if (j < 0) continue;
    if (B[(j + 1) % B.length] === v || B[(j - 1 + B.length) % B.length] === v) return [u, v];
  }
  return null;
}
// the faces' inside directions away from their shared edge, and the angle between them
export function faceAngle(A, B, X){
  const se = sharedEdge(A, B); if (!se) return null;
  const p = X[se[0]], q = X[se[1]], e = norm(sub(q, p));
  const inward = ids => {
    const pl = planeOf(ids.map(id => X[id])), i = ids.indexOf(se[0]), fwd = ids[(i + 1) % ids.length] === se[1];
    return norm(cross(pl.n, fwd ? e : mul(e, -1)));   // the inside of a loop is on its left
  };
  const dA = inward(A), dB = inward(B);
  const deg = Math.acos(Math.max(-1, Math.min(1, dot(dA, dB)))) * 180 / Math.PI;
  const s = Math.sign(dot(e, cross(dA, dB))) || 1;
  return { deg, se, p, k: mul(e, s), dA, dB };
}
export function lockTarget(L, deg){
  if (L.mode === 'step') return Math.max(L.step, Math.min(180, Math.round(deg / L.step) * L.step));
  return L.deg;
}
function orientTarget(L, n){
  if (L.mode === 'level' || L.mode === 'floor') return [0, n[1] < 0 ? -1 : 1, 0];
  if (L.mode === 'upright'){ const h = Math.hypot(n[0], n[2]); return h > 1e-6 ? [n[0] / h, 0, n[2] / h] : null; }
  if (L.mode === 'hold' && L.n) return dot(L.n, n) < 0 ? mul(L.n, -1) : L.n;
  return null;
}
// a lock still applies while what it holds is still there (faces by their corners, lines by their two ends)
export function lockAlive(L, byKey, X){
  if (L.f) return byKey.has(L.f);
  if (L.a) return byKey.has(L.a) && byKey.has(L.b);
  if (L.e) return !!(X[L.e[0]] && X[L.e[1]]);
  if (L.ea) return !!(X[L.ea[0]] && X[L.ea[1]] && X[L.eb[0]] && X[L.eb[1]]);
  return false;
}
// turn face points P (ids) about centroid c so normal n becomes t
function turnTo(ids, X, c, n, t, goal){
  const ax = cross(n, t), sl = len(ax), a = Math.atan2(sl, dot(n, t));
  for (const id of ids) goal(id, sl > 1e-9 ? rotAbout(X[id], c, mul(ax, 1 / sl), a) : X[id]);
}
// a line's two ends set so it runs along t (a unit direction), same length, same middle
function lineTo(e, X, t, goal){
  const a = X[e[0]], b = X[e[1]], d = sub(b, a), L = len(d), m = mul(add(a, b), 0.5), tt = dot(t, d) < 0 ? mul(t, -1) : t;
  goal(e[0], sub(m, mul(tt, L / 2))); goal(e[1], add(m, mul(tt, L / 2)));
}
function applyLocks(sk, locks, byKey, X, G, W, w, sqDeg){
  const goal = (id, p) => { G[id] = add(G[id], mul(p, w)); W[id] += w; };
  for (const L of locks){
    if (L.f){
      const f = byKey.get(L.f), pl = planeOf(f.ids.map(id => X[id])), t = orientTarget(L, pl.n);
      if (L.mode === 'floor'){ for (const id of f.all) goal(id, [X[id][0], 0, X[id][2]]); continue; }   // lying on the floor
      if (!t) continue;
      turnTo(f.all, X, pl.c, pl.n, t, goal);
    } else if (L.e){
      // a line held upright or level
      const d = norm(sub(X[L.e[1]], X[L.e[0]]));
      if (L.mode === 'upright') lineTo(L.e, X, [0, 1, 0], goal);
      else { const h = Math.hypot(d[0], d[2]); if (h > 1e-6) lineTo(L.e, X, [d[0] / h, 0, d[2] / h], goal); }
    } else if (L.ea){
      // two lines held parallel or square to each other
      let dA = norm(sub(X[L.ea[1]], X[L.ea[0]])), dB = norm(sub(X[L.eb[1]], X[L.eb[0]]));
      if (L.mode === 'parallel'){ if (dot(dA, dB) < 0) dB = mul(dB, -1); const t = norm(add(dA, dB)); lineTo(L.ea, X, t, goal); lineTo(L.eb, X, t, goal); }
      else { const c = dot(dA, dB); lineTo(L.ea, X, norm(sub(dA, mul(dB, c * 0.5))), goal); lineTo(L.eb, X, norm(sub(dB, mul(dA, c * 0.5))), goal); }
    } else if (L.mode === 'coplanar' || L.mode === 'parallel'){
      // two faces on one plane, or facing the same way
      const FA = byKey.get(L.a), FB = byKey.get(L.b), pA = planeOf(FA.ids.map(id => X[id])), pB = planeOf(FB.ids.map(id => X[id]));
      const nB = dot(pA.n, pB.n) < 0 ? mul(pB.n, -1) : pB.n;
      let n = norm(add(pA.n, nB));
      // with Square up on, a shared plane that's nearly level or upright becomes exactly so
      if (sqDeg){ const sn = Math.sin(sqDeg * Math.PI / 180), h = Math.hypot(n[0], n[2]);
        if (h < sn) n = [0, Math.sign(n[1]) || 1, 0]; else if (Math.abs(n[1]) < sn) n = [n[0] / h, 0, n[2] / h]; }
      if (L.mode === 'parallel'){ turnTo(FA.all, X, pA.c, pA.n, n, goal); turnTo(FB.all, X, pB.c, nB, n, goal); continue; }
      const ids = [...new Set([...FA.all, ...FB.all])];
      let c = [0, 0, 0]; for (const id of ids) c = add(c, X[id]); c = mul(c, 1 / ids.length);
      for (const id of ids) goal(id, sub(X[id], mul(n, dot(n, sub(X[id], c)))));
    } else {
      const FA = byKey.get(L.a), FB = byKey.get(L.b), g = faceAngle(FA.ids, FB.ids, X);
      if (!g) continue;
      const d = (lockTarget(L, g.deg) - g.deg) * Math.PI / 180;
      // turn both faces about their shared edge, half each, toward the locked angle
      for (const id of FB.all) goal(id, g.se.includes(id) ? X[id] : rotAbout(X[id], g.p, g.k, d / 2));
      for (const id of FA.all) goal(id, g.se.includes(id) ? X[id] : rotAbout(X[id], g.p, g.k, -d / 2));
    }
  }
}
// Snap a moved face (targets for its corners) to its locks before the solver sees it, so a locked face clicks
// into place while you hold it: orientation locks keep its tilt, angle locks swing it about the shared edge.
export function snapHeld(sk, F, key, T, X){
  const byKey = new Map(F.faces.map(f => [f.key, f])), f = byKey.get(key); if (!f) return T;
  const P = Object.assign({}, X, T);
  for (const L of sk.locks || []){
    if (L.f === key){
      const pl = planeOf(f.ids.map(id => P[id])), t = orientTarget(L, pl.n); if (!t) continue;
      const ax = cross(pl.n, t), sl = len(ax);
      if (sl > 1e-9) for (const id of f.all) if (P[id]) P[id] = rotAbout(P[id], pl.c, mul(ax, 1 / sl), Math.atan2(sl, dot(pl.n, t)));
      if (L.mode === 'floor') for (const id of f.all) if (P[id]) P[id] = [P[id][0], 0, P[id][2]];   // it slides along the floor
    } else if ((L.a === key || L.b === key) && byKey.has(L.a) && byKey.has(L.b) && (L.mode === 'fixed' || L.mode === 'step')){
      const other = byKey.get(L.a === key ? L.b : L.a).ids, g = faceAngle(f.ids, other, P); if (!g) continue;
      // g is measured from the held face to the other one: turning the held face by -d widens the angle by d
      const d = (lockTarget(L, g.deg) - g.deg) * Math.PI / 180;
      for (const id of f.all) if (!g.se.includes(id)) P[id] = rotAbout(P[id], g.p, g.k, -d);
    }
  }
  const out = {}; for (const id in T) out[id] = P[id];
  return out;
}

// Should pushing or pulling this face make a body (true), or just move the face (false)? A face that is part of a
// bigger flat surface (a door drawn on a wall, a shape drawn inside a face, half of a face cut by a line) makes a body.
export function isSubFace(F, f){
  for (const g of F.faces){
    if (g === f || g.L !== f.L) continue;
    if (Math.abs(dot(g.n, f.n)) < 0.985) continue;
    if (f.es.some(k => g.es.includes(k))) return true;
  }
  return false;
}
// If a body already stands on this face: that body and its far face (the one to grab to push it further)
export function bodyOn(sk, F, f, X){
  const set = new Set(f.ids);
  for (const B of sk.bodies || []){
    if (B.base.length !== set.size || !B.base.every(id => set.has(id))) continue;
    const nb = planeOf(B.base.map(id => X[id])).n;
    let best = null, bs = 0;
    for (const g of F.faces){
      if (g.L !== B.id || g.ids.some(id => set.has(id))) continue;
      const sc = Math.abs(dot(g.n, nb)) * g.area;
      if (sc > bs){ bs = sc; best = g; }
    }
    if (best) return { body: B, top: best };
  }
  return null;
}

// While something is being dragged: has any body gone from adding to cutting (or back)? (Then look at the faces afresh.)
export function cutsChanged(sk, F, X){
  for (const [id, info] of F.bodies || []){
    const B = bodyOf(sk, id); if (!B || B.base.some(v => !X[v])) continue;
    const nb = mul(planeOf(B.base.map(v => X[v])).n, B.s || 1);
    let cb = [0, 0, 0], ct = [0, 0, 0], nt = 0;
    for (const v of B.base) cb = add(cb, X[v]);
    for (const v of sk.v) if (v.b === id && X[v.id]){ ct = add(ct, X[v.id]); nt++; }
    if (nt && (dot(sub(mul(ct, 1 / nt), mul(cb, 1 / B.base.length)), nb) < 0) !== info.cut) return true;
  }
  return false;
}

// One call for the app: find faces on the sketch, solve, then look again on the solved shape (catches loops that
// only came flat once squared up) and solve once more from there.
export function build(sk, o = {}){
  const anchors = {};
  for (const v of sk.v) anchors[v.id] = (o.drag && o.drag[v.id]) || anchorOf(v);
  const fo = { rel: o.rel, minTol: o.minTol };
  let F = findFaces(sk, o.warm ? Object.assign({}, anchors, pick(o.warm, anchors)) : anchors, fo);
  let X = solve(sk, F, o);
  if (o.second !== false){
    const F2 = findFaces(sk, X, fo);
    const changed = F2.faces.length !== F.faces.length || F2.faces.some((f, i) => f.key !== F.faces[i]?.key);
    F = F2;                               // always the faces as they are at the solved corners (which way is out, what cuts)
    if (changed){ X = solve(sk, F, Object.assign({}, o, { warm: X })); F = findFaces(sk, X, fo); }
  }
  return { F, X };
}
// Consistent winding for a set of faces; outward when they close up (by signed volume)
export function orient(fs, X){
  const loops = fs.map(f => f.ids.slice()), done = new Array(fs.length).fill(false);
  const dirEdges = L => L.map((id, i) => id + '>' + L[(i + 1) % L.length]);
  const owners = new Map();
  fs.forEach((f, i) => f.ids.forEach((id, k) => { const o = f.ids[(k + 1) % f.ids.length], key = id < o ? id + '-' + o : o + '-' + id; if (!owners.has(key)) owners.set(key, []); owners.get(key).push(i); }));
  for (let s0 = 0; s0 < fs.length; s0++){
    if (done[s0]) continue;
    done[s0] = true; const q = [s0];
    while (q.length){
      const i = q.shift(), mine = new Set(dirEdges(loops[i]));
      for (const [key, os] of owners){
        if (!os.includes(i)) continue;
        for (const j of os){
          if (j === i || done[j]) continue;
          // if j runs the shared edge the same way as i, flip j
          if (dirEdges(loops[j]).some(d => mine.has(d))) loops[j].reverse();
          done[j] = true; q.push(j);
        }
      }
    }
  }
  // a face lying in a hole of another (a shape drawn flat inside it) faces the same way as the one around it
  {
    const cid = new Array(fs.length).fill(-1); let nc = 0;
    for (let s0 = 0; s0 < fs.length; s0++){
      if (cid[s0] >= 0) continue;
      cid[s0] = nc; const q = [s0];
      while (q.length){ const i = q.shift(); for (const [, os] of owners) if (os.includes(i)) for (const j of os) if (cid[j] < 0){ cid[j] = nc; q.push(j); } }
      nc++;
    }
    if (nc > 1){
      const byKey = new Map(fs.map((f, i) => [f.key, i])), fixed = new Set([cid[0]]);
      for (let pass = 0; pass < nc; pass++) fs.forEach((g, gi) => (g.holes || []).forEach(h => {
        const ii = byKey.get(faceKey(h)); if (ii === undefined || cid[ii] === cid[gi]) return;
        const [from, to] = fixed.has(cid[gi]) && !fixed.has(cid[ii]) ? [gi, ii] : fixed.has(cid[ii]) && !fixed.has(cid[gi]) ? [ii, gi] : [-1, -1];
        if (from < 0) return;
        const nf = planeOf(loops[from].map(id => X[id])).n, nt = planeOf(loops[to].map(id => X[id])).n;
        if (dot(nf, nt) < 0) loops.forEach((L, k) => { if (cid[k] === cid[to]) L.reverse(); });
        fixed.add(cid[to]);
      }));
    }
  }
  let vol = 0;
  for (const L of loops){ const p0 = X[L[0]]; for (let i = 1; i < L.length - 1; i++) vol += dot(p0, cross(X[L[i]], X[L[i + 1]])); }
  if (vol < 0) loops.forEach(L => L.reverse());
  return loops;
}
function pick(warm, anchors){ const r = {}; for (const k in anchors) if (warm[k]) r[k] = warm[k]; return r; }

export function toOBJ(sk, F, X, scale = 1, tri){
  const ids = sk.v.map(v => v.id), idx = new Map(ids.map((id, i) => [id, i + 1]));
  let s = '# Edgewise XR\n';
  for (const id of ids){ const p = X[id]; s += `v ${(p[0] * scale).toFixed(5)} ${(-p[2] * scale).toFixed(5)} ${(p[1] * scale).toFixed(5)}\n`; }
  const byPiece = new Map();
  for (const f of F.faces){ if (f.open || F.pieces[f.piece].cut) continue; if (!byPiece.has(f.piece)) byPiece.set(f.piece, []); byPiece.get(f.piece).push(f); }
  let n = 0;
  for (const [pc, fs] of byPiece){
    // wind every face the same way round (neighbours run a shared edge in opposite directions), facing out
    const loops = orient(fs, X);
    fs.forEach((f, i) => f._loop = loops[i]);
    s += `o ${F.pieces[pc].closed ? 'Solid' : 'Surface'}_${++n}\n`;
    for (const f of fs){
      if (f.holes && f.holes.length && tri){
        // a face with a hole goes out as triangles (OBJ faces can't have holes), wound like its rim
        const n = planeOf(f._loop.map(id => X[id])).n;
        for (const t of tri(f)){ const c = cross(sub(X[t[1]], X[t[0]]), sub(X[t[2]], X[t[0]])); const tt = dot(c, n) < 0 ? [t[0], t[2], t[1]] : t; s += 'f ' + tt.map(id => idx.get(id)).join(' ') + '\n'; }
      } else s += 'f ' + f._loop.map(id => idx.get(id)).join(' ') + '\n';
    }
  }
  return s;
}
