/* ================= Toy Box: the toddler's chubby hands (the same hand as Taffy Strata) =================
   One smooth, fat-fingered hand surface (soft-blended capsules and pads), built once at load and skinned to
   19 finger bones. Every frame the bones are set from 25 joint positions: your real tracked joints in the
   headset, or a hand curled by 5 finger values (controllers, the bot toddler, and everyone watching on phones). */

// rest pose, right hand, metres: palm down (-Y), fingers along +Z, thumb out to +X
const HREST = [[0, 0, 0],
  [.020, -.012, .024], [.040, -.019, .049], [.054, -.021, .072], [.063, -.021, .090],
  [.016, 0, .016], [.029, .001, .085], [.032, 0, .113], [.033, -.001, .132], [.034, -.002, .148],
  [.002, 0, .017], [.006, .001, .088], [.007, 0, .119], [.008, -.001, .140], [.008, -.002, .157],
  [-.011, 0, .016], [-.016, .001, .083], [-.018, 0, .110], [-.019, -.001, .129], [-.020, -.002, .144],
  [-.022, 0, .014], [-.034, 0, .074], [-.038, -.001, .096], [-.040, -.002, .110], [-.041, -.003, .123]];
const HBN = [[1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [8, 9], [10, 11], [11, 12], [12, 13], [13, 14], [15, 16], [16, 17], [17, 18], [18, 19], [20, 21], [21, 22], [22, 23], [23, 24]];
// how fat the hand is at each joint (fatter than an adult's)
const HRJ = [0, .0165, .0145, .0132, .0118, .0165, .0128, .0119, .0112, .0102, .017, .0132, .0123, .0115, .0105, .0165, .0126, .0117, .011, .0100, .0155, .0115, .0106, .0099, .0090];
// soft pads: palm, thumb pad, pinky-side pad, rounded heel, the ridge under the knuckles
const PADS = [[[.004, -.003, .046], [.046, .0195, .050]], [[.024, -.010, .030], [.021, .017, .026]], [[-.027, -.006, .040], [.016, .015, .030]],
  [[0, -.002, .010], [.034, .019, .026]], [[.001, -.004, .075], [.040, .015, .018]]];
function handSDF(x, y, z) {
  let d = 1e9; const sm = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  for (const [a, b] of HBN) { const A = HREST[a], B = HREST[b], bx = B[0] - A[0], by = B[1] - A[1], bz = B[2] - A[2], px = x - A[0], py = y - A[1], pz = z - A[2];
    const t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz))), r = HRJ[a] + (HRJ[b] - HRJ[a]) * t;
    d = sm(d, Math.hypot(px - bx * t, py - by * t, pz - bz * t) - r, 0.009); }
  for (const [c, r] of PADS) { const qx = (x - c[0]) / r[0], qy = (y - c[1]) / r[1], qz = (z - c[2]) / r[2]; d = sm(d, (Math.hypot(qx, qy, qz) - 1) * Math.min(r[0], r[1], r[2]), 0.014); }
  return d;
}
// the palm's frame (side, palm normal, forward) from 25 joints
const _hfS = new THREE.Vector3(), _hfN = new THREE.Vector3(), _hfF = new THREE.Vector3();
function handFrame(J, out) {
  _hfF.subVectors(J[11], J[0]).normalize(); _hfS.subVectors(J[6], J[21]); _hfS.addScaledVector(_hfF, -_hfS.dot(_hfF)).normalize(); _hfN.crossVectors(_hfF, _hfS);
  return out.makeBasis(_hfS, _hfN, _hfF);
}
// a smooth surface where a signed-distance function crosses zero ("surface nets": one vertex per cell, quads across crossing edges)
function sdfSurface(fn, b, N) {
  const [x0, x1, y0, y1, z0, z1] = b, sx = (x1 - x0) / (N - 1), sy = (y1 - y0) / (N - 1), sz = (z1 - z0) / (N - 1), N2 = N * N, M = N - 1, F = new Float32Array(N * N2);
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) F[i + j * N + k * N2] = (i === 0 || j === 0 || k === 0 || i === M || j === M || k === M) ? -1 : -fn(x0 + i * sx, y0 + j * sy, z0 + k * sz);
  const cellV = new Int32Array(M * M * M).fill(-1), pos = [], nor = [], idx = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], co = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], v = new Float32Array(8), e = 4e-4;
  for (let k = 0; k < M; k++) for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const base = i + j * N + k * N2; let mask = 0;
    for (let c = 0; c < 8; c++) { v[c] = F[base + co[c][0] + co[c][1] * N + co[c][2] * N2]; if (v[c] > 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let px = 0, py = 0, pz = 0, n = 0;
    for (const [a, c] of E) { if ((v[a] > 0) === (v[c] > 0)) continue; const t = v[a] / (v[a] - v[c]); px += co[a][0] + (co[c][0] - co[a][0]) * t; py += co[a][1] + (co[c][1] - co[a][1]) * t; pz += co[a][2] + (co[c][2] - co[a][2]) * t; n++; }
    const X = x0 + (i + px / n) * sx, Y = y0 + (j + py / n) * sy, Z = z0 + (k + pz / n) * sz;
    const gx = fn(X + e, Y, Z) - fn(X - e, Y, Z), gy = fn(X, Y + e, Z) - fn(X, Y - e, Z), gz = fn(X, Y, Z + e) - fn(X, Y, Z - e), gl = Math.hypot(gx, gy, gz) || 1;
    cellV[i + j * M + k * M * M] = pos.length / 3; pos.push(X, Y, Z); nor.push(gx / gl, gy / gl, gz / gl);
  }
  const cv = (i, j, k) => cellV[i + j * M + k * M * M];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < M; k++) for (let j = 1; j < M; j++) for (let i = 0; i < M; i++) { const g = i + j * N + k * N2, a = F[g] > 0; if (a !== F[g + 1] > 0) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), a); }
  for (let k = 1; k < M; k++) for (let j = 0; j < M; j++) for (let i = 1; i < M; i++) { const g = i + j * N + k * N2, a = F[g] > 0; if (a !== F[g + N] > 0) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), a); }
  for (let k = 0; k < M; k++) for (let j = 1; j < M; j++) for (let i = 1; i < M; i++) { const g = i + j * N + k * N2, a = F[g] > 0; if (a !== F[g + N2] > 0) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), a); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setIndex(idx);
  return geo;
}
let handRest = null;
function buildHandRest() {
  const g = sdfSurface(handSDF, [-.075, .1, -.052, .04, -.032, .195], 62);
  const mk = mirror => {
    const geo = g.clone(), pa = geo.attributes.position.array, na = geo.attributes.normal.array;
    const rest = HREST.map(p => new THREE.Vector3(mirror ? -p[0] : p[0], p[1], p[2]));
    if (mirror) { for (let i = 0; i < pa.length; i += 3) { pa[i] = -pa[i]; na[i] = -na[i]; } const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
    // skin weights: each bit of skin follows its nearest bones, blended smoothly across the knuckles
    const nv = pa.length / 3, si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), best = HBN.map(() => [0, 0]);
    for (let v = 0; v < nv; v++) {
      const x = pa[3 * v], y = pa[3 * v + 1], z = pa[3 * v + 2];
      HBN.forEach(([a, b], bi) => { const A = rest[a], B = rest[b], bx = B.x - A.x, by = B.y - A.y, bz = B.z - A.z, px = x - A.x, py = y - A.y, pz = z - A.z;
        const t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz))); best[bi][0] = Math.pow(Math.hypot(px - bx * t, py - by * t, pz - bz * t) + 0.003, -6); best[bi][1] = bi; });
      const top = best.slice().sort((p, q) => q[0] - p[0]), s = top[0][0] + top[1][0] + top[2][0] + top[3][0];
      for (let k = 0; k < 4; k++) { si[4 * v + k] = top[k][1]; sw[4 * v + k] = top[k][0] / s; } }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    // each bone's rest frame: Y runs along the bone, X toward the thumb side of the palm
    const fr = handFrame(rest, new THREE.Matrix4()), side = new THREE.Vector3().setFromMatrixColumn(fr, 0), rb = [], inv = [], len = [];
    for (const [a, b] of HBN) {
      const y = new THREE.Vector3().subVectors(rest[b], rest[a]), L = y.length(); y.divideScalar(L);
      const x = side.clone().addScaledVector(y, -side.dot(y)).normalize(), z = new THREE.Vector3().crossVectors(x, y);
      const R = new THREE.Matrix4().makeBasis(x, y, z); rb.push(R); len.push(L);
      inv.push(R.clone().setPosition(rest[a]).invert()); }
    return { geo, fr, rb, inv, len };
  };
  handRest = { R: mk(false), L: mk(true) };
}
function makeHandMesh(side, mat, parent) {   // side: 1 right hand, -1 left
  if (!handRest) buildHandRest(); const R = side > 0 ? handRest.R : handRest.L;
  const rig = new THREE.Group(); parent.add(rig);
  const bones = HBN.map(() => { const b = new THREE.Bone(); b.matrixAutoUpdate = false; rig.add(b); return b; });
  const m = new THREE.SkinnedMesh(R.geo, mat); m.frustumCulled = false; rig.add(m);
  m.bind(new THREE.Skeleton(bones, R.inv.map(x => x.clone())), new THREE.Matrix4());
  return { rig, mesh: m, bones, rest: R, side, J: HREST.map(() => new THREE.Vector3()) };
}
// set the bones from 25 joint positions (world). k: how many world units one metre of hand is (its thickness)
const _hpQ = new THREE.Matrix4(), _hpT = new THREE.Matrix4(), _hpR = new THREE.Matrix4(), _hpV = new THREE.Vector3(), _hpD = new THREE.Vector3(), _hpq = new THREE.Quaternion(), _hpS = new THREE.Vector3();
function poseHandMesh(HM, J, k) {
  const R = HM.rest; handFrame(J, _hpR); _hpQ.copy(_hpR).multiply(_hpT.copy(R.fr).transpose());   // how the palm has turned since rest
  for (let i = 0; i < HBN.length; i++) {
    const [a, b] = HBN[i], m = HM.bones[i].matrix;
    m.copy(_hpQ).multiply(R.rb[i]); _hpV.setFromMatrixColumn(m, 1);                         // rest bone, turned with the palm
    _hpD.subVectors(J[b], J[a]); const L = _hpD.length() || 1e-6; _hpD.divideScalar(L);
    if (_hpV.dot(_hpD) > -0.999) { _hpq.setFromUnitVectors(_hpV, _hpD); m.premultiply(_hpT.makeRotationFromQuaternion(_hpq)); }   // bent onto the real finger
    m.scale(_hpS.set(k, L / R.len[i], k)); m.setPosition(J[a]); HM.bones[i].matrixWorldNeedsUpdate = true;
  }
}
// a hand curled by five finger values (thumb, index, middle, ring, pinky; 0 open .. 1 fist), in rest space
const _hPiv = new THREE.Vector3(), _hAx = new THREE.Vector3(), _hRq = new THREE.Quaternion(), _hX = new THREE.Vector3(1, 0, 0);
function curlJoints(side, curls, out) {
  for (let i = 0; i < 25; i++) out[i].set(side > 0 ? HREST[i][0] : -HREST[i][0], HREST[i][1], HREST[i][2]);
  const bend = (chain, angles, axis) => { for (let c = 0; c < angles.length; c++) { _hPiv.copy(out[chain[c]]); _hRq.setFromAxisAngle(axis, angles[c]);
    for (let k = c + 1; k < chain.length; k++) out[chain[k]].sub(_hPiv).applyQuaternion(_hRq).add(_hPiv); } };
  [5, 10, 15, 20].forEach((f, n) => { const a = 0.12 + clamp(curls[n + 1] || 0, 0, 1) * 0.88; bend([f + 1, f + 2, f + 3, f + 4], [a * 1.35, a * 1.6, a * 0.9], _hX); });
  const a = 0.12 + clamp(curls[0] || 0, 0, 1) * 0.88;
  _hpD.subVectors(out[2], out[1]).normalize(); _hAx.set(_hpD.z, 0, -_hpD.x).normalize();   // the thumb folds in over the palm (the same way for a mirrored left hand)
  bend([1, 2, 3, 4], [a * 0.45, a * 0.55, a * 0.5], _hAx);
  return out;
}
// the game's hand frame: palm centre at p, turned by q (fingers along -Z, palm down -Y, like a WebXR wrist), `scale` times life size
const _hM = new THREE.Matrix4(), _hM2 = new THREE.Matrix4(), _hPC = new THREE.Vector3(), _hY180 = new THREE.Matrix4().makeRotationY(Math.PI);
function poseCurledHand(HM, p, q, curls, scale, thick) {
  curlJoints(HM.side, curls, HM.J);
  _hPC.set(HREST[0][0], HREST[0][1], HREST[0][2]).lerp(_hPC.clone().set(HREST[11][0], HREST[11][1], HREST[11][2]), 0.6); if (HM.side < 0) _hPC.x = -_hPC.x;
  _hM.compose(p, q, _hpS.set(scale, scale, scale)).multiply(_hY180).multiply(_hM2.makeTranslation(-_hPC.x, -_hPC.y, -_hPC.z));
  for (const v of HM.J) v.applyMatrix4(_hM);
  poseHandMesh(HM, HM.J, thick);
  return HM.J[0];
}
