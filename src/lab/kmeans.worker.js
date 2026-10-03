/* eslint-disable no-restricted-globals */
// K-Means colour quantisation, run off the main thread.
// Messages in:  load | run | elbow      Messages out: loaded | progress | result | elbow | error

let FULL = null;   // { width, height, data: Uint8ClampedArray } display-resolution image
let SMALL = null;  // downscaled copy (<= ~400px) used for clustering
let assignCache = null; // Uint8Array(2^24) colour -> cluster index cache (255 = unset)

// ---------- random ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- colour space ----------
const srgbToLinear = new Float32Array(256);
for (let i = 0; i < 256; i += 1) {
  const c = i / 255;
  srgbToLinear[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const fLab = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
function rgbToLab(r, g, b, out, o) {
  const R = srgbToLinear[r]; const G = srgbToLinear[g]; const B = srgbToLinear[b];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = fLab(x); const fy = fLab(y); const fz = fLab(z);
  out[o] = 116 * fy - 16; out[o + 1] = 500 * (fx - fy); out[o + 2] = 200 * (fy - fz);
}
function labToRgb(L, A, Bv) {
  const fy = (L + 16) / 116; const fx = fy + A / 500; const fz = fy - Bv / 200;
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const x = inv(fx) * 0.95047; const y = inv(fy); const z = inv(fz) * 1.08883;
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let b = x * 0.0557 + y * -0.204 + z * 1.057;
  const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  r = gam(r); g = gam(g); b = gam(b);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return [cl(r), cl(g), cl(b)];
}

// ---------- helpers ----------
function samplePoints(img, space, maxN, rand) {
  const { data } = img;
  const n = data.length / 4;
  const idx = [];
  for (let i = 0; i < n; i += 1) if (data[i * 4 + 3] >= 8) idx.push(i);
  if (idx.length === 0) for (let i = 0; i < n; i += 1) idx.push(i); // fully transparent image
  let chosen = idx;
  if (maxN && idx.length > maxN) {
    chosen = new Array(maxN);
    for (let i = 0; i < maxN; i += 1) chosen[i] = idx[Math.floor(rand() * idx.length)];
  }
  const X = new Float32Array(chosen.length * 3);
  chosen.forEach((p, j) => {
    const r = data[p * 4]; const g = data[p * 4 + 1]; const b = data[p * 4 + 2];
    if (space === 'lab') rgbToLab(r, g, b, X, j * 3);
    else { X[j * 3] = r; X[j * 3 + 1] = g; X[j * 3 + 2] = b; }
  });
  return X;
}

function kmeans(X, k, rand, maxIter = 20) {
  const n = X.length / 3;
  k = Math.max(1, Math.min(k, n));
  const C = new Float32Array(k * 3);
  // k-means++ initialisation
  const d2 = new Float64Array(n).fill(Infinity);
  let first = Math.floor(rand() * n);
  C[0] = X[first * 3]; C[1] = X[first * 3 + 1]; C[2] = X[first * 3 + 2];
  for (let c = 1; c < k; c += 1) {
    let sum = 0;
    const px = C[(c - 1) * 3]; const py = C[(c - 1) * 3 + 1]; const pz = C[(c - 1) * 3 + 2];
    for (let i = 0; i < n; i += 1) {
      const dx = X[i * 3] - px; const dy = X[i * 3 + 1] - py; const dz = X[i * 3 + 2] - pz;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < d2[i]) d2[i] = d;
      sum += d2[i];
    }
    let pickIdx = 0;
    if (sum > 0) {
      let t = rand() * sum;
      for (let i = 0; i < n; i += 1) { t -= d2[i]; if (t <= 0) { pickIdx = i; break; } }
    } else pickIdx = Math.floor(rand() * n);
    C[c * 3] = X[pickIdx * 3]; C[c * 3 + 1] = X[pickIdx * 3 + 1]; C[c * 3 + 2] = X[pickIdx * 3 + 2];
  }

  const assign = new Int32Array(n).fill(-1);
  const sums = new Float64Array(k * 3);
  const counts = new Int32Array(k);
  let iterations = 0; let inertia = 0;
  for (let it = 0; it < maxIter; it += 1) {
    iterations = it + 1;
    let changed = 0; inertia = 0;
    sums.fill(0); counts.fill(0);
    for (let i = 0; i < n; i += 1) {
      const x = X[i * 3]; const y = X[i * 3 + 1]; const z = X[i * 3 + 2];
      let best = 0; let bd = Infinity;
      for (let c = 0; c < k; c += 1) {
        const dx = x - C[c * 3]; const dy = y - C[c * 3 + 1]; const dz = z - C[c * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = c; }
      }
      if (assign[i] !== best) { changed += 1; assign[i] = best; }
      inertia += bd;
      sums[best * 3] += x; sums[best * 3 + 1] += y; sums[best * 3 + 2] += z; counts[best] += 1;
    }
    let shift = 0;
    for (let c = 0; c < k; c += 1) {
      if (counts[c] === 0) {
        // empty cluster: re-seed at a random point
        const p = Math.floor(rand() * n);
        C[c * 3] = X[p * 3]; C[c * 3 + 1] = X[p * 3 + 1]; C[c * 3 + 2] = X[p * 3 + 2];
        shift += 1e6;
        continue;
      }
      const nx = sums[c * 3] / counts[c]; const ny = sums[c * 3 + 1] / counts[c]; const nz = sums[c * 3 + 2] / counts[c];
      shift = Math.max(shift, Math.abs(nx - C[c * 3]) + Math.abs(ny - C[c * 3 + 1]) + Math.abs(nz - C[c * 3 + 2]));
      C[c * 3] = nx; C[c * 3 + 1] = ny; C[c * 3 + 2] = nz;
    }
    if (it > 0 && (changed / n < 0.001 || shift < 0.05)) break;
  }
  return { C, k, iterations, inertia };
}

function centroidsToRgb(C, k, space) {
  const out = [];
  for (let c = 0; c < k; c += 1) {
    if (space === 'lab') out.push(labToRgb(C[c * 3], C[c * 3 + 1], C[c * 3 + 2]));
    else out.push([Math.round(C[c * 3]), Math.round(C[c * 3 + 1]), Math.round(C[c * 3 + 2])]);
  }
  return out;
}

// Map every display pixel to its nearest centroid (in the clustering space), with a colour cache.
function applyPalette(img, C, k, space, rgbPalette) {
  if (!assignCache) assignCache = new Uint8Array(1 << 24);
  assignCache.fill(255);
  const { data } = img;
  const out = new Uint8ClampedArray(data.length);
  const counts = new Float64Array(k);
  const lab = new Float32Array(3);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
    const key = (r << 16) | (g << 8) | b;
    let best = assignCache[key];
    if (best === 255) {
      let x = r; let y = g; let z = b;
      if (space === 'lab') { rgbToLab(r, g, b, lab, 0); x = lab[0]; y = lab[1]; z = lab[2]; }
      let bd = Infinity; best = 0;
      for (let c = 0; c < k; c += 1) {
        const dx = x - C[c * 3]; const dy = y - C[c * 3 + 1]; const dz = z - C[c * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = c; }
      }
      assignCache[key] = best;
    }
    const p = rgbPalette[best];
    out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2]; out[i + 3] = data[i + 3];
    if (data[i + 3] >= 8) counts[best] += 1;
  }
  return { out, counts };
}

function uniformQuantise(img, K) {
  // Split ~log2(K) bits over the channels (green first, then red, then blue), product of levels <= K.
  const levels = [1, 1, 1]; // r, g, b
  const order = [1, 0, 2];
  let grew = true;
  while (grew) {
    grew = false;
    for (const ch of order) {
      const next = levels.slice(); next[ch] *= 2;
      if (next[0] * next[1] * next[2] <= K) { levels[ch] = next[ch]; grew = true; }
    }
  }
  const { data } = img;
  const out = new Uint8ClampedArray(data.length);
  const q = (v, L) => (L === 1 ? 128 : Math.min(255, Math.round((Math.min(L - 1, Math.floor((v * L) / 256)) + 0.5) * (256 / L))));
  for (let i = 0; i < data.length; i += 4) {
    out[i] = q(data[i], levels[0]); out[i + 1] = q(data[i + 1], levels[1]); out[i + 2] = q(data[i + 2], levels[2]);
    out[i + 3] = data[i + 3];
  }
  return { out, levels };
}

function uniqueColours(data) {
  const bits = new Uint8Array(1 << 21);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    const byte = key >>> 3; const mask = 1 << (key & 7);
    if (!(bits[byte] & mask)) { bits[byte] |= mask; count += 1; }
  }
  return count;
}

// Metrics compare what you would see: each pixel composited over white using its alpha.
const over = (d, i, c) => (d[i + 3] === 255 ? d[i + c] : (d[i + c] * d[i + 3] + 255 * (255 - d[i + 3])) / 255);

function psnr(a, b) {
  let se = 0; let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 3; c += 1) { const d = over(a, i, c) - over(b, i, c); se += d * d; }
    n += 3;
  }
  const mse = se / n;
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

// SSIM on luma, mean over non-overlapping 8x8 windows.
function ssim(a, b, w, h) {
  const C1 = (0.01 * 255) ** 2; const C2 = (0.03 * 255) ** 2;
  const Y = (d, i) => 0.299 * over(d, i, 0) + 0.587 * over(d, i, 1) + 0.114 * over(d, i, 2);
  let total = 0; let windows = 0;
  for (let by = 0; by + 8 <= h; by += 8) {
    for (let bx = 0; bx + 8 <= w; bx += 8) {
      let ma = 0; let mb = 0;
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) { const i = ((by + y) * w + bx + x) * 4; ma += Y(a, i); mb += Y(b, i); }
      ma /= 64; mb /= 64;
      let va = 0; let vb = 0; let cov = 0;
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
        const i = ((by + y) * w + bx + x) * 4; const da = Y(a, i) - ma; const db = Y(b, i) - mb;
        va += da * da; vb += db * db; cov += da * db;
      }
      va /= 63; vb /= 63; cov /= 63;
      total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      windows += 1;
    }
  }
  return windows ? total / windows : 1;
}

const post = (msg, transfer) => self.postMessage(msg, transfer || []);

self.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') {
      FULL = { width: msg.full.width, height: msg.full.height, data: new Uint8ClampedArray(msg.full.data) };
      SMALL = { width: msg.small.width, height: msg.small.height, data: new Uint8ClampedArray(msg.small.data) };
      post({ type: 'loaded', id: msg.id, uniqueColors: uniqueColours(FULL.data) });
      return;
    }
    if (!FULL) throw new Error('No image loaded.');

    if (msg.type === 'run') {
      const t0 = performance.now();
      const rand = mulberry32(msg.seed ?? Math.floor(Math.random() * 2 ** 31));
      post({ type: 'progress', id: msg.id, stage: 'Clustering colours…' });
      const X = samplePoints(SMALL, msg.space, 0, rand);
      const km = kmeans(X, msg.k, rand);
      const rgbPal = centroidsToRgb(km.C, km.k, msg.space);
      post({ type: 'progress', id: msg.id, stage: 'Repainting the image…' });
      const { out, counts } = applyPalette(FULL, km.C, km.k, msg.space, rgbPal);
      const ms = performance.now() - t0;
      const totalPx = counts.reduce((a, b) => a + b, 0) || 1;
      const palette = rgbPal.map((c, i) => ({ r: c[0], g: c[1], b: c[2], share: counts[i] / totalPx }))
        .filter((p) => p.share > 0)
        .sort((x, y) => y.share - x.share);
      const uni = uniformQuantise(FULL, msg.k);
      const result = {
        type: 'result', id: msg.id, k: msg.k, space: msg.space, ms, iterations: km.iterations,
        width: FULL.width, height: FULL.height,
        kmeans: { pixels: out.buffer, palette, unique: uniqueColours(out), psnr: psnr(FULL.data, out), ssim: ssim(FULL.data, out, FULL.width, FULL.height) },
        uniform: { pixels: uni.out.buffer, levels: uni.levels, unique: uniqueColours(uni.out), psnr: psnr(FULL.data, uni.out), ssim: ssim(FULL.data, uni.out, FULL.width, FULL.height) },
      };
      post(result, [out.buffer, uni.out.buffer]);
      return;
    }

    if (msg.type === 'elbow') {
      const ks = msg.ks || [2, 4, 8, 16, 32, 64];
      const points = [];
      const rand0 = mulberry32(msg.seed ?? 42);
      const X = samplePoints(SMALL, msg.space, 20000, rand0);
      const n = X.length / 3;
      ks.forEach((k) => {
        const km = kmeans(X, k, mulberry32((msg.seed ?? 42) + k));
        points.push({ k, inertia: km.inertia / n });
        post({ type: 'elbow-progress', id: msg.id, done: points.length, total: ks.length });
      });
      post({ type: 'elbow', id: msg.id, space: msg.space, points });
    }
  } catch (err) {
    post({ type: 'error', id: msg.id, message: err.message || String(err) });
  }
};
