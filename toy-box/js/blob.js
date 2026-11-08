/* ================= Toy Box: squishy blob meshes (the toddler's body and giant hands) =================
   A handful of balls melt into one smooth meatball surface (metaballs, meshed with "surface nets").
   Each ball adds a soft bump (1 - d²/R²)³ with R = 2r; the surface sits where the sum crosses the level
   a lone ball would have at its own radius. Colours blend between balls the same way. */
function makeBlob(N, mat, bump) {
  const G = N * N * N, maxV = (N - 1) ** 3, F = new Float32Array(G), W = new Float32Array(G * 3), cellV = new Int32Array(maxV);
  const pos = new Float32Array(maxV * 3), nor = new Float32Array(maxV * 3), col = new Float32Array(maxV * 3), idx = new Uint32Array(maxV * 18);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage)); geo.setIndex(new THREE.BufferAttribute(idx, 1).setUsage(THREE.DynamicDrawUsage)); geo.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  const T = Math.pow(1 - 0.25, 3);   // the level of a lone ball at its own radius (R = 2r)
  const B = { mesh, N, update(balls) {
    if (!balls.length) { geo.setDrawRange(0, 0); return; }
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (const b of balls) { const R = b.r * 2; x0 = Math.min(x0, b.x - R); y0 = Math.min(y0, b.y - R); z0 = Math.min(z0, b.z - R); x1 = Math.max(x1, b.x + R); y1 = Math.max(y1, b.y + R); z1 = Math.max(z1, b.z + R); }
    const sx = (x1 - x0) / (N - 1), sy = (y1 - y0) / (N - 1), sz = (z1 - z0) / (N - 1), N2 = N * N;
    F.fill(-T); W.fill(0);
    // each ball only touches the grid points inside its reach
    for (const b of balls) { const R = b.r * 2, R2 = R * R, c = b.c;
      const i0 = Math.max(0, Math.floor((b.x - R - x0) / sx)), i1 = Math.min(N - 1, Math.ceil((b.x + R - x0) / sx)), j0 = Math.max(0, Math.floor((b.y - R - y0) / sy)), j1 = Math.min(N - 1, Math.ceil((b.y + R - y0) / sy)), k0 = Math.max(0, Math.floor((b.z - R - z0) / sz)), k1 = Math.min(N - 1, Math.ceil((b.z + R - z0) / sz));
      for (let k = k0; k <= k1; k++) { const dz = z0 + k * sz - b.z; for (let j = j0; j <= j1; j++) { const dy = y0 + j * sy - b.y, dyz = dy * dy + dz * dz; if (dyz >= R2) continue;
        for (let i = i0; i <= i1; i++) { const dx = x0 + i * sx - b.x, q = (dx * dx + dyz) / R2; if (q >= 1) continue; const w = (1 - q) * (1 - q) * (1 - q), g = i + j * N + k * N2; F[g] += w; W[g * 3] += w * c.r; W[g * 3 + 1] += w * c.g; W[g * 3 + 2] += w * c.b; } } } }
    if (bump) for (let g = 0; g < G; g++) { const i = g % N, j = ((g / N) | 0) % N, k = (g / N2) | 0; const x = x0 + i * sx, y = y0 + j * sy, z = z0 + k * sz; F[g] += bump * (Math.sin(x * 61 + y * 13) * Math.sin(y * 57 + z * 19) * Math.sin(z * 53 + x * 11)); }
    // one vertex per cell the surface passes through
    let nv = 0; const M = N - 1;
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], co = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], v = new Float32Array(8);
    for (let k = 0; k < M; k++) for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const base = i + j * N + k * N2; let mask = 0;
      for (let c = 0; c < 8; c++) { const g = base + co[c][0] + co[c][1] * N + co[c][2] * N2; v[c] = F[g]; if (v[c] > 0) mask |= 1 << c; }
      const ci = i + j * M + k * M * M; if (mask === 0 || mask === 255) { cellV[ci] = -1; continue; }
      let px = 0, py = 0, pz = 0, n = 0;
      for (const [a, b] of E) { if ((v[a] > 0) === (v[b] > 0)) continue; const t = v[a] / (v[a] - v[b]); px += co[a][0] + (co[b][0] - co[a][0]) * t; py += co[a][1] + (co[b][1] - co[a][1]) * t; pz += co[a][2] + (co[b][2] - co[a][2]) * t; n++; }
      const X = x0 + (i + px / n) * sx, Y = y0 + (j + py / n) * sy, Z = z0 + (k + pz / n) * sz;
      pos[nv * 3] = X; pos[nv * 3 + 1] = Y; pos[nv * 3 + 2] = Z;
      // normal = downhill of the field; colour = the balls' weighted mix
      let gx = 0, gy = 0, gz = 0, wr = 0, wg = 0, wb = 0, ws = 0;
      for (const b of balls) { const R2 = 4 * b.r * b.r, dx = X - b.x, dy = Y - b.y, dz = Z - b.z, q = (dx * dx + dy * dy + dz * dz) / R2; if (q >= 1) continue; const s = (1 - q) * (1 - q), w = s * (1 - q); gx += s * dx / R2; gy += s * dy / R2; gz += s * dz / R2; const ww = w * w; wr += ww * b.c.r; wg += ww * b.c.g; wb += ww * b.c.b; ws += ww; }
      const gl = Math.hypot(gx, gy, gz) || 1; nor[nv * 3] = gx / gl; nor[nv * 3 + 1] = gy / gl; nor[nv * 3 + 2] = gz / gl;
      if (ws > 0) { col[nv * 3] = wr / ws; col[nv * 3 + 1] = wg / ws; col[nv * 3 + 2] = wb / ws; }
      cellV[ci] = nv++;
    }
    // quads across every grid edge the surface crosses
    let ni = 0; const cv = (i, j, k) => cellV[i + j * M + k * M * M];
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) { idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; idx[ni++] = a; idx[ni++] = d; idx[ni++] = c; } else { idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; } };
    for (let k = 1; k < M; k++) for (let j = 1; j < M; j++) for (let i = 0; i < M; i++) { const g = i + j * N + k * N2, a = F[g] > 0, b = F[g + 1] > 0; if (a !== b) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), a); }
    for (let k = 1; k < M; k++) for (let j = 0; j < M; j++) for (let i = 1; i < M; i++) { const g = i + j * N + k * N2, a = F[g] > 0, b = F[g + N] > 0; if (a !== b) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), a); }
    for (let k = 0; k < M; k++) for (let j = 1; j < M; j++) for (let i = 1; i < M; i++) { const g = i + j * N + k * N2, a = F[g] > 0, b = F[g + N2] > 0; if (a !== b) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), a); }
    geo.setDrawRange(0, ni);
    for (const k of ['position', 'normal', 'color']) { const at = geo.attributes[k]; at.updateRange.count = nv * 3; at.needsUpdate = true; }
    geo.index.updateRange.count = ni; geo.index.needsUpdate = true;
  } };
  return B;
}
