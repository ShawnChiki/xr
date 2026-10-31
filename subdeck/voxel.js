// Subdeck: voxel clay. A signed-distance field (negative = inside) sculpted with sphere brushes.
// Stored sparsely in 16³ chunks, so the canvas has no edges: memory is only used where there is clay.
// Each chunk is meshed with surface nets so it comes out smooth.

export class VoxelField {
  constructor(h = 0.02){
    this.h = h; this.C = 16; this.max = 4 * h;
    this.chunks = new Map();            // "cx,cy,cz" -> Float32Array(C³)
    this.dirty = new Set(); this.used = false;
  }
  key(cx, cy, cz){ return cx + ',' + cy + ',' + cz; }
  get(i, j, k){
    const C = this.C, cx = Math.floor(i / C), cy = Math.floor(j / C), cz = Math.floor(k / C), c = this.chunks.get(this.key(cx, cy, cz));
    return c ? c[(i - cx * C) + C * ((j - cy * C) + C * (k - cz * C))] : this.max;
  }
  set(i, j, k, v){
    const C = this.C, cx = Math.floor(i / C), cy = Math.floor(j / C), cz = Math.floor(k / C), key = this.key(cx, cy, cz);
    let c = this.chunks.get(key); if (!c){ if (v >= this.max) return; c = new Float32Array(C * C * C).fill(this.max); this.chunks.set(key, c); }
    c[(i - cx * C) + C * ((j - cy * C) + C * (k - cz * C))] = v;
  }
  clear(){ for (const k of this.chunks.keys()) this.dirty.add(k); this.chunks.clear(); this.used = false; }
  // a voxel change shows up in the cells on both sides of it
  markRange(i0, j0, k0, i1, j1, k1){
    const C = this.C, f = v => Math.floor(v / C);
    for (let cz = f(k0 - 1); cz <= f(k1); cz++) for (let cy = f(j0 - 1); cy <= f(j1); cy++) for (let cx = f(i0 - 1); cx <= f(i1); cx++) this.dirty.add(this.key(cx, cy, cz));
  }
  // kind: 'add' | 'carve' | 'smooth'. c = centre (park metres), r = radius, k = strength 0..1 (smooth)
  brush(kind, c, r, k = 1){
    const { h, max, C } = this, pad = 2;
    const i0 = Math.floor((c[0] - r) / h) - pad, i1 = Math.ceil((c[0] + r) / h) + pad;
    const j0 = Math.floor((c[1] - r) / h) - pad, j1 = Math.ceil((c[1] + r) / h) + pad;
    const k0 = Math.floor((c[2] - r) / h) - pad, k1 = Math.ceil((c[2] + r) / h) + pad;
    if (kind === 'smooth'){
      if (!this.chunks.size) return false;
      const nx = i1 - i0 + 3, ny = j1 - j0 + 3, nz = k1 - k0 + 3, src = new Float32Array(nx * ny * nz);
      const at = (i, j, kk) => (i - i0 + 1) + nx * ((j - j0 + 1) + ny * (kk - k0 + 1));
      for (let kk = k0 - 1; kk <= k1 + 1; kk++) for (let j = j0 - 1; j <= j1 + 1; j++) for (let i = i0 - 1; i <= i1 + 1; i++) src[at(i, j, kk)] = this.get(i, j, kk);
      let any = false;
      for (let kk = k0; kk <= k1; kk++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){
        const x = i * h - c[0], y = j * h - c[1], z = kk * h - c[2], dist = Math.sqrt(x * x + y * y + z * z); if (dist > r) continue;
        const here = src[at(i, j, kk)];
        const avg = (src[at(i + 1, j, kk)] + src[at(i - 1, j, kk)] + src[at(i, j + 1, kk)] + src[at(i, j - 1, kk)] + src[at(i, j, kk + 1)] + src[at(i, j, kk - 1)]) / 6;
        if (avg === here) continue;
        const v = here + (avg - here) * k * 0.6 * Math.sqrt(1 - dist / r); this.set(i, j, kk, v); any = true;
      }
      if (any) this.markRange(i0, j0, k0, i1, j1, k1);
      return any;
    }
    // add / carve, a chunk at a time
    const f = v => Math.floor(v / C);
    for (let cz = f(k0); cz <= f(k1); cz++) for (let cy = f(j0); cy <= f(j1); cy++) for (let cx = f(i0); cx <= f(i1); cx++){
      const key = this.key(cx, cy, cz); let d = this.chunks.get(key);
      if (!d){ if (kind !== 'add') continue; d = new Float32Array(C * C * C).fill(max); this.chunks.set(key, d); }
      const a0 = Math.max(i0, cx * C), a1 = Math.min(i1, cx * C + C - 1), b0 = Math.max(j0, cy * C), b1 = Math.min(j1, cy * C + C - 1), e0 = Math.max(k0, cz * C), e1 = Math.min(k1, cz * C + C - 1);
      for (let kk = e0; kk <= e1; kk++) for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++){
        const x = i * h - c[0], y = j * h - c[1], z = kk * h - c[2], s = Math.sqrt(x * x + y * y + z * z) - r, t = (i - cx * C) + C * ((j - cy * C) + C * (kk - cz * C));
        const v = kind === 'add' ? Math.min(d[t], s) : Math.max(d[t], -s);
        d[t] = v < -max ? -max : v > max ? max : v;
      }
    }
    if (kind === 'add') this.used = true;
    this.markRange(i0, j0, k0, i1, j1, k1);
    return true;
  }
  // fill a box with clay (rounded edges), merged with whatever is there. lo / hi = corners in park metres.
  fillBox(lo, hi, round = 0.03){
    const { h, max, C } = this, pad = 3, c = [0, 1, 2].map(a => (lo[a] + hi[a]) / 2), hw = [0, 1, 2].map(a => (hi[a] - lo[a]) / 2 - round);
    const i0 = Math.floor(lo[0] / h) - pad, i1 = Math.ceil(hi[0] / h) + pad, j0 = Math.floor(lo[1] / h) - pad, j1 = Math.ceil(hi[1] / h) + pad, k0 = Math.floor(lo[2] / h) - pad, k1 = Math.ceil(hi[2] / h) + pad;
    const f = v => Math.floor(v / C);
    for (let cz = f(k0); cz <= f(k1); cz++) for (let cy = f(j0); cy <= f(j1); cy++) for (let cx = f(i0); cx <= f(i1); cx++){
      const key = this.key(cx, cy, cz); let d = this.chunks.get(key);
      if (!d){ d = new Float32Array(C * C * C).fill(max); this.chunks.set(key, d); }
      for (let kk = cz * C; kk < cz * C + C; kk++) for (let j = cy * C; j < cy * C + C; j++) for (let i = cx * C; i < cx * C + C; i++){
        const qx = Math.abs(i * h - c[0]) - hw[0], qy = Math.abs(j * h - c[1]) - hw[1], qz = Math.abs(kk * h - c[2]) - hw[2];
        const s = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - round, t = (i - cx * C) + C * ((j - cy * C) + C * (kk - cz * C));
        const v = Math.min(d[t], s); d[t] = v < -max ? -max : v > max ? max : v;
      }
    }
    this.used = true; this.markRange(i0, j0, k0, i1, j1, k1);
  }
  // surface nets for one chunk -> { pos, nor, idx } in park metres (null if empty)
  meshChunk(key){
    const [cx, cy, cz] = key.split(',').map(Number), C = this.C, h = this.h, P = C + 3;
    const g0 = [cx * C - 1, cy * C - 1, cz * C - 1];          // global voxel at local 0
    // copy this chunk and its neighbours' edges into one padded block
    const L = new Float32Array(P * P * P).fill(this.max); let anyIn = false;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
      const c = this.chunks.get(this.key(cx + dx, cy + dy, cz + dz)); if (!c) continue;
      for (let k = 0; k < C; k++){ const lz = (cz + dz) * C + k - g0[2]; if (lz < 0 || lz >= P) continue;
        for (let j = 0; j < C; j++){ const ly = (cy + dy) * C + j - g0[1]; if (ly < 0 || ly >= P) continue;
          for (let i = 0; i < C; i++){ const lx = (cx + dx) * C + i - g0[0]; if (lx < 0 || lx >= P) continue;
            const v = c[i + C * (j + C * k)]; L[lx + P * (ly + P * lz)] = v; if (v < 0) anyIn = true; } } }
    }
    if (!anyIn) return null;
    const at = (i, j, k) => i + P * (j + P * k), g = (i, j, k) => L[at(Math.max(0, Math.min(P - 1, i)), Math.max(0, Math.min(P - 1, j)), Math.max(0, Math.min(P - 1, k)))];
    const vmap = new Int32Array(P * P * P).fill(-1), pos = [], nor = [], idx = [];
    const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const val = new Float32Array(8);
    const tri = (x, y, z) => { const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), tx = x - x0, ty = y - y0, tz = z - z0, l = (a, b, t) => a + (b - a) * t;
      return l(l(l(g(x0, y0, z0), g(x0 + 1, y0, z0), tx), l(g(x0, y0 + 1, z0), g(x0 + 1, y0 + 1, z0), tx), ty), l(l(g(x0, y0, z0 + 1), g(x0 + 1, y0, z0 + 1), tx), l(g(x0, y0 + 1, z0 + 1), g(x0 + 1, y0 + 1, z0 + 1), tx), ty), tz); };
    // cells (low corner) from local 0 to C: the chunk's own cells plus one ring below, for the quads
    for (let k = 0; k <= C; k++) for (let j = 0; j <= C; j++) for (let i = 0; i <= C; i++){
      let inside = 0;
      for (let c = 0; c < 8; c++){ const v = L[at(i + corner[c][0], j + corner[c][1], k + corner[c][2])]; val[c] = v; if (v < 0) inside++; }
      if (inside === 0 || inside === 8) continue;
      let px = 0, py = 0, pz = 0, m = 0;
      for (const [e0, e1] of edges){ const v0 = val[e0], v1 = val[e1]; if ((v0 < 0) === (v1 < 0)) continue; const t = v0 / (v0 - v1);
        px += corner[e0][0] + (corner[e1][0] - corner[e0][0]) * t; py += corner[e0][1] + (corner[e1][1] - corner[e0][1]) * t; pz += corner[e0][2] + (corner[e1][2] - corner[e0][2]) * t; m++; }
      const fx = i + px / m, fy = j + py / m, fz = k + pz / m;
      vmap[at(i, j, k)] = pos.length / 3;
      pos.push((g0[0] + fx) * h, (g0[1] + fy) * h, (g0[2] + fz) * h);
      const gx = tri(fx + 0.7, fy, fz) - tri(fx - 0.7, fy, fz), gy = tri(fx, fy + 0.7, fz) - tri(fx, fy - 0.7, fz), gz = tri(fx, fy, fz + 0.7) - tri(fx, fy, fz - 0.7), gl = Math.hypot(gx, gy, gz) || 1;
      nor.push(gx / gl, gy / gl, gz / gl);
    }
    // one quad per voxel edge owned by this chunk (start voxel inside it) where inside/outside flips
    const quad = (A, B, Cc, D, flip) => { if (A < 0 || B < 0 || Cc < 0 || D < 0) return; if (flip) idx.push(A, D, Cc, A, Cc, B); else idx.push(A, B, Cc, A, Cc, D); };
    for (let k = 1; k <= C; k++) for (let j = 1; j <= C; j++) for (let i = 1; i <= C; i++){
      const v0 = L[at(i, j, k)], o = v0 >= 0;
      if ((L[at(i + 1, j, k)] < 0) !== (v0 < 0)) quad(vmap[at(i, j - 1, k - 1)], vmap[at(i, j, k - 1)], vmap[at(i, j, k)], vmap[at(i, j - 1, k)], o);
      if ((L[at(i, j + 1, k)] < 0) !== (v0 < 0)) quad(vmap[at(i - 1, j, k - 1)], vmap[at(i - 1, j, k)], vmap[at(i, j, k)], vmap[at(i, j, k - 1)], o);
      if ((L[at(i, j, k + 1)] < 0) !== (v0 < 0)) quad(vmap[at(i - 1, j - 1, k)], vmap[at(i, j - 1, k)], vmap[at(i, j, k)], vmap[at(i - 1, j, k)], o);
    }
    if (!idx.length) return null;
    return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx };
  }
  // compact text form: each chunk with clay in it, quantised to 1/31 of a voxel and run-length encoded. null when empty.
  encode(){
    const h = this.h, parts = [];
    for (const [key, d] of this.chunks){
      const out = []; let prev = null, run = 0, anyIn = false;
      for (let a = 0; a < d.length; a++){ const q = Math.round(Math.max(-4, Math.min(4, d[a] / h)) * 31); if (q < 0) anyIn = true;
        if (q === prev && run < 65535) run++; else { if (prev !== null) out.push(prev, run); prev = q; run = 1; } }
      out.push(prev, run); if (!anyIn) continue;
      const buf = new Uint8Array(out.length / 2 * 3);
      for (let i = 0, b = 0; i < out.length; i += 2, b += 3){ buf[b] = out[i] & 255; buf[b + 1] = out[i + 1] & 255; buf[b + 2] = out[i + 1] >> 8; }
      let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
      parts.push(key + ':' + btoa(s));
    }
    return parts.length ? 'v2|' + h + '|' + parts.join(';') : null;
  }
  decode(str){
    this.clear();
    if (!str || !str.startsWith('v2|')) return;        // older saves used a fixed box; those start fresh
    const [, , body] = str.split('|'), C = this.C, h = this.h;
    for (const part of body.split(';')){
      const [key, b64] = part.split(':'), bin = atob(b64), d = new Float32Array(C * C * C).fill(this.max); let a = 0;
      for (let b = 0; b + 2 < bin.length; b += 3){ let q = bin.charCodeAt(b); if (q > 127) q -= 256; const run = bin.charCodeAt(b + 1) | (bin.charCodeAt(b + 2) << 8); d.fill(q / 31 * h, a, Math.min(d.length, a + run)); a += run; }
      this.chunks.set(key, d); this.used = true;
      const [cx, cy, cz] = key.split(',').map(Number); this.markRange(cx * C, cy * C, cz * C, cx * C + C - 1, cy * C + C - 1, cz * C + C - 1);
    }
  }
}
