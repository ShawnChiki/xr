// Subdeck: voxel clay. A signed-distance grid (negative = inside) sculpted with sphere brushes,
// meshed in 16-voxel chunks with surface nets so it comes out smooth.

export class VoxelField {
  constructor(origin = [-1.2, -0.03, -1.2], h = 0.015, dims = [160, 64, 160]){
    this.o = origin; this.h = h; this.n = dims; this.C = 16;
    this.max = 4 * h;
    this.d = new Float32Array(dims[0] * dims[1] * dims[2]).fill(this.max);
    this.cn = dims.map(v => Math.ceil((v - 1) / this.C));
    this.dirty = new Set(); this.used = false;
  }
  idx(i, j, k){ return (k * this.n[1] + j) * this.n[0] + i; }
  clear(){ this.d.fill(this.max); this.used = false; for (let a = 0; a < this.chunkCount(); a++) this.dirty.add(a); }
  chunkCount(){ return this.cn[0] * this.cn[1] * this.cn[2]; }
  chunkId(cx, cy, cz){ return (cz * this.cn[1] + cy) * this.cn[0] + cx; }
  chunkXYZ(id){ const cx = id % this.cn[0], r = (id - cx) / this.cn[0], cy = r % this.cn[1]; return [cx, cy, (r - cy) / this.cn[1]]; }
  markRange(i0, j0, k0, i1, j1, k1){
    const C = this.C, c = (v, a) => Math.max(0, Math.min(this.cn[a] - 1, Math.floor(v / C)));
    // a voxel change affects the cells on both sides of it
    for (let cz = c(k0 - 1, 2); cz <= c(k1, 2); cz++) for (let cy = c(j0 - 1, 1); cy <= c(j1, 1); cy++) for (let cx = c(i0 - 1, 0); cx <= c(i1, 0); cx++) this.dirty.add(this.chunkId(cx, cy, cz));
  }
  // kind: 'add' | 'carve' | 'smooth'. c = centre (park metres), r = radius, k = strength 0..1 (smooth)
  brush(kind, c, r, k = 1){
    const { o, h, n, d, max } = this, pad = 2;
    const i0 = Math.max(0, Math.floor((c[0] - r - o[0]) / h) - pad), i1 = Math.min(n[0] - 1, Math.ceil((c[0] + r - o[0]) / h) + pad);
    const j0 = Math.max(0, Math.floor((c[1] - r - o[1]) / h) - pad), j1 = Math.min(n[1] - 1, Math.ceil((c[1] + r - o[1]) / h) + pad);
    const k0 = Math.max(0, Math.floor((c[2] - r - o[2]) / h) - pad), k1 = Math.min(n[2] - 1, Math.ceil((c[2] + r - o[2]) / h) + pad);
    if (i0 > i1 || j0 > j1 || k0 > k1) return false;
    if (kind === 'smooth'){
      const nx = i1 - i0 + 1, ny = j1 - j0 + 1, nz = k1 - k0 + 1, tmp = new Float32Array(nx * ny * nz);
      for (let kk = k0; kk <= k1; kk++) for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++){
        const x = o[0] + ii * h - c[0], y = o[1] + jj * h - c[1], z = o[2] + kk * h - c[2], dist = Math.sqrt(x * x + y * y + z * z), t = (ii - i0) + nx * ((jj - j0) + ny * (kk - k0));
        const here = d[this.idx(ii, jj, kk)];
        if (dist > r || ii === 0 || jj === 0 || kk === 0 || ii === n[0] - 1 || jj === n[1] - 1 || kk === n[2] - 1){ tmp[t] = here; continue; }
        let s = 0; for (const [a, b, e] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) s += d[this.idx(ii + a, jj + b, kk + e)];
        const f = k * 0.6 * (1 - dist / r) ** 0.5; tmp[t] = here + (s / 6 - here) * f;
      }
      for (let kk = k0; kk <= k1; kk++) for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) d[this.idx(ii, jj, kk)] = tmp[(ii - i0) + nx * ((jj - j0) + ny * (kk - k0))];
    } else {
      for (let kk = k0; kk <= k1; kk++) for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++){
        const x = o[0] + ii * h - c[0], y = o[1] + jj * h - c[1], z = o[2] + kk * h - c[2], s = Math.sqrt(x * x + y * y + z * z) - r, at = this.idx(ii, jj, kk);
        let v = kind === 'add' ? Math.min(d[at], s) : Math.max(d[at], -s);
        d[at] = v < -max ? -max : v > max ? max : v;
      }
      if (kind === 'add') this.used = true;
    }
    this.markRange(i0, j0, k0, i1, j1, k1);
    return true;
  }
  // surface nets for one chunk -> { pos, nor, idx } in park metres (null if empty)
  meshChunk(id){
    const [cx, cy, cz] = this.chunkXYZ(id), C = this.C, { n, d, o, h } = this;
    const a0 = [cx * C, cy * C, cz * C], a1 = [Math.min(n[0] - 1, a0[0] + C), Math.min(n[1] - 1, a0[1] + C), Math.min(n[2] - 1, a0[2] + C)];
    // quick reject: no inside voxels near this chunk
    let any = false;
    for (let k = Math.max(0, a0[2] - 1); k <= a1[2] && !any; k++) for (let j = Math.max(0, a0[1] - 1); j <= a1[1] && !any; j++){ const base = this.idx(0, j, k); for (let i = Math.max(0, a0[0] - 1); i <= a1[0]; i++) if (d[base + i] < 0){ any = true; break; } }
    if (!any) return null;
    // cells from a0-1 to a1-1 (a cell is the cube whose low corner is that voxel)
    const b0 = a0.map(v => Math.max(0, v - 1)), w = [a1[0] - b0[0], a1[1] - b0[1], a1[2] - b0[2]];
    const vmap = new Int32Array(w[0] * w[1] * w[2]).fill(-1), pos = [], nor = [], idx = [];
    const cellAt = (i, j, k) => (i - b0[0]) + w[0] * ((j - b0[1]) + w[1] * (k - b0[2]));
    const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const val = new Float32Array(8), g = (i, j, k) => d[this.idx(Math.max(0, Math.min(n[0] - 1, i)), Math.max(0, Math.min(n[1] - 1, j)), Math.max(0, Math.min(n[2] - 1, k)))];
    for (let k = b0[2]; k < a1[2]; k++) for (let j = b0[1]; j < a1[1]; j++) for (let i = b0[0]; i < a1[0]; i++){
      let inside = 0;
      for (let c = 0; c < 8; c++){ const v = d[this.idx(i + corner[c][0], j + corner[c][1], k + corner[c][2])]; val[c] = v; if (v < 0) inside++; }
      if (inside === 0 || inside === 8) continue;
      let px = 0, py = 0, pz = 0, m = 0;
      for (const [e0, e1] of edges){ const v0 = val[e0], v1 = val[e1]; if ((v0 < 0) === (v1 < 0)) continue; const t = v0 / (v0 - v1);
        px += corner[e0][0] + (corner[e1][0] - corner[e0][0]) * t; py += corner[e0][1] + (corner[e1][1] - corner[e0][1]) * t; pz += corner[e0][2] + (corner[e1][2] - corner[e0][2]) * t; m++; }
      const fx = i + px / m, fy = j + py / m, fz = k + pz / m;
      vmap[cellAt(i, j, k)] = pos.length / 3;
      pos.push(o[0] + fx * h, o[1] + fy * h, o[2] + fz * h);
      // normal from the distance field's slope
      const tri = (x, y, z) => { const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), tx = x - x0, ty = y - y0, tz = z - z0;
        const l = (a, b, t) => a + (b - a) * t;
        return l(l(l(g(x0, y0, z0), g(x0 + 1, y0, z0), tx), l(g(x0, y0 + 1, z0), g(x0 + 1, y0 + 1, z0), tx), ty), l(l(g(x0, y0, z0 + 1), g(x0 + 1, y0, z0 + 1), tx), l(g(x0, y0 + 1, z0 + 1), g(x0 + 1, y0 + 1, z0 + 1), tx), ty), tz); };
      let gx = tri(fx + 0.7, fy, fz) - tri(fx - 0.7, fy, fz), gy = tri(fx, fy + 0.7, fz) - tri(fx, fy - 0.7, fz), gz = tri(fx, fy, fz + 0.7) - tri(fx, fy, fz - 0.7);
      const gl = Math.hypot(gx, gy, gz) || 1; nor.push(gx / gl, gy / gl, gz / gl);
    }
    // one quad per voxel edge (owned by this chunk) where the inside/outside flips
    const quad = (A, B, Cc, D, flip) => { if (A < 0 || B < 0 || Cc < 0 || D < 0) return; if (flip) idx.push(A, D, Cc, A, Cc, B); else idx.push(A, B, Cc, A, Cc, D); };
    for (let k = a0[2]; k < a1[2]; k++) for (let j = a0[1]; j < a1[1]; j++) for (let i = a0[0]; i < a1[0]; i++){
      const v0 = d[this.idx(i, j, k)];
      if (j > 0 && k > 0 && i + 1 < n[0]){ const v1 = d[this.idx(i + 1, j, k)]; if ((v0 < 0) !== (v1 < 0)) quad(vmap[cellAt(i, j - 1, k - 1)], vmap[cellAt(i, j, k - 1)], vmap[cellAt(i, j, k)], vmap[cellAt(i, j - 1, k)], v0 >= 0); }
      if (i > 0 && k > 0 && j + 1 < n[1]){ const v1 = d[this.idx(i, j + 1, k)]; if ((v0 < 0) !== (v1 < 0)) quad(vmap[cellAt(i - 1, j, k - 1)], vmap[cellAt(i - 1, j, k)], vmap[cellAt(i, j, k)], vmap[cellAt(i, j, k - 1)], v0 >= 0); }
      if (i > 0 && j > 0 && k + 1 < n[2]){ const v1 = d[this.idx(i, j, k + 1)]; if ((v0 < 0) !== (v1 < 0)) quad(vmap[cellAt(i - 1, j - 1, k)], vmap[cellAt(i, j - 1, k)], vmap[cellAt(i, j, k)], vmap[cellAt(i - 1, j, k)], v0 >= 0); }
    }
    if (!idx.length) return null;
    return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx };
  }
  // compact text form: quantise to 1/31 of a voxel, then run-length encode. null when empty.
  encode(){
    const { d, h } = this; let anyIn = false; const out = []; let prev = null, run = 0;
    for (let a = 0; a < d.length; a++){
      const q = Math.round(Math.max(-4, Math.min(4, d[a] / h)) * 31); if (q < 124) anyIn = true;
      if (q === prev && run < 65535) run++; else { if (prev !== null) out.push(prev, run); prev = q; run = 1; }
    }
    out.push(prev, run);
    if (!anyIn) return null;
    // pack as Int8 value + Uint16 run, base64
    const buf = new Uint8Array(out.length / 2 * 3);
    for (let i = 0, b = 0; i < out.length; i += 2, b += 3){ buf[b] = out[i] & 255; buf[b + 1] = out[i + 1] & 255; buf[b + 2] = out[i + 1] >> 8; }
    let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
    return btoa(s);
  }
  decode(str){
    this.d.fill(this.max); this.used = false;
    if (str){
      const bin = atob(str), h = this.h; let a = 0;
      for (let b = 0; b + 2 < bin.length; b += 3){
        let q = bin.charCodeAt(b); if (q > 127) q -= 256; const run = bin.charCodeAt(b + 1) | (bin.charCodeAt(b + 2) << 8), v = q / 31 * h;
        if (q < 0) this.used = true;
        this.d.fill(v, a, Math.min(this.d.length, a + run)); a += run;
      }
    }
    for (let id = 0; id < this.chunkCount(); id++) this.dirty.add(id);
  }
}
