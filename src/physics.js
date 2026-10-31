/**
 * Vector angular-spectrum propagation in vacuum; lengths are in wavelengths.
 * Time convention: Re{E~ exp(-i omega t)}. No Fresnel propagator is used.
 * The prescribed tangential exit field is Ex=0, Ey=bandlimit(aperture).
 * Ez and ALL magnetic components follow from k.E=0 and cB=khat x E.
 * See README.md for boundary assumptions, discretization and convergence tests.
 */
export const TAU = 2 * Math.PI;
export const WAVELENGTH_UM = 0.532;
export const CONFIG = Object.freeze({ n: 1024, length: 192, zMin: 2, zMax: 120, dz: 0.5, naSoft: 0.48, naMax: 0.58 });
export const PRESETS = Object.freeze({
  double: { name: 'Double slit', subtitle: 'Two openings. One field.', width: 1.4, height: 4, separation: 3.4, radius: Math.hypot(2.4, 2), detail: '1.4λ × 4λ slits · 3.4λ separation' },
  single: { name: 'Single slit', subtitle: 'An edge changes everything.', width: 2.8, height: 4, radius: Math.hypot(1.4, 2), detail: '2.8λ × 4λ opening' },
  circle: { name: 'Circular aperture', subtitle: 'A circle becomes an Airy pattern.', radius: 2.4, detail: '4.8λ diameter' },
  ring: { name: 'Annular aperture', subtitle: 'A hollow pupil. Concentric interference.', radius: 2.8, inner: 1.9, detail: '5.6λ outer · 3.8λ inner diameter' },
  grating: { name: 'Three slits', subtitle: 'Three sources, sharper orders.', width: 0.8, height: 4, pitch: 2.4, count: 3, radius: Math.hypot(2.8, 2), detail: '0.8λ × 4λ slits · 2.4λ pitch' }
});

const fftPlans = new Map();
function plan(n) {
  if (fftPlans.has(n)) return fftPlans.get(n);
  if ((n & (n - 1)) || n < 2) throw new Error('FFT size must be a power of two.');
  const reverse = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) { let x = i, r = 0; for (let b = 0; b < bits; b++) { r = r * 2 + (x & 1); x >>>= 1; } reverse[i] = r; }
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(TAU * i / n); sin[i] = Math.sin(TAU * i / n); }
  const result = { reverse, cos, sin }; fftPlans.set(n, result); return result;
}

export function fft(re, im, inverse = false) {
  const n = re.length, { reverse, cos, sin } = plan(n);
  for (let i = 0; i < n; i++) { const j = reverse[i]; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2, step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let j = 0; j < half; j++) {
        const a = start + j, b = a + half, w = j * step;
        const s = inverse ? sin[w] : -sin[w];
        const r = re[b] * cos[w] - im[b] * s, t = re[b] * s + im[b] * cos[w];
        re[b] = re[a] - r; im[b] = im[a] - t; re[a] += r; im[a] += t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

export function fft2(re, im, n, inverse = false) {
  for (let y = 0; y < n; y++) fft(re.subarray(y * n, (y + 1) * n), im.subarray(y * n, (y + 1) * n), inverse);
  const r = new Float64Array(n), t = new Float64Array(n);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) { r[y] = re[y * n + x]; t[y] = im[y * n + x]; }
    fft(r, t, inverse);
    for (let y = 0; y < n; y++) { re[y * n + x] = r[y]; im[y * n + x] = t[y]; }
  }
}

export function apertureAt(id, x, y) {
  const p = PRESETS[id];
  if (!p) throw new Error(`Unknown aperture: ${id}`);
  if (id === 'circle') return x * x + y * y < p.radius ** 2 ? 1 : 0;
  if (id === 'ring') { const r2 = x * x + y * y; return r2 < p.radius ** 2 && r2 > p.inner ** 2 ? 1 : 0; }
  if (Math.abs(y) >= p.height / 2) return 0;
  if (id === 'single') return Math.abs(x) < p.width / 2 ? 1 : 0;
  if (id === 'double') return Math.abs(Math.abs(x) - p.separation / 2) < p.width / 2 ? 1 : 0;
  for (let i = 0; i < p.count; i++) if (Math.abs(x - (i - (p.count - 1) / 2) * p.pitch) < p.width / 2) return 1;
  return 0;
}

// Ey, Ez, cBx, cBy, cBz. Ex is identically zero for this boundary model.
export function modeVector(qx, qy) {
  const qz = Math.sqrt(1 - qx * qx - qy * qy);
  return [1, -qy / qz, -(1 - qx * qx) / qz, qx * qy / qz, qx];
}

export function createSpectrum(id = 'double', phaseShift = false, config = CONFIG) {
  const { n, length, naSoft, naMax } = config, size = n * n, dx = length / n;
  const re = new Float64Array(size), im = new Float64Array(size), lr = new Float64Array(size), li = new Float64Array(size);
  const samples = 8, extent = Math.ceil((PRESETS[id].radius + dx) / dx);
  for (let j = n / 2 - extent; j <= n / 2 + extent; j++) {
    for (let i = n / 2 - extent; i <= n / 2 + extent; i++) {
      let left = 0, right = 0;
      for (let v = 0; v < samples; v++) for (let u = 0; u < samples; u++) {
        const x = (i - n / 2 + (u + 0.5) / samples - 0.5) * dx;
        const y = (j - n / 2 + (v + 0.5) / samples - 0.5) * dx;
        const value = apertureAt(id, x, y) / (samples * samples);
        if (x < 0) left += value; else right += value;
      }
      const at = j * n + i;
      lr[at] = left; re[at] = left + right * (phaseShift ? -1 : 1);
    }
  }
  fft2(re, im, n); fft2(lr, li, n);
  const modes = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const qx = (i < n / 2 ? i : i - n) / length, qy = (j < n / 2 ? j : j - n) / length;
    const q = Math.hypot(qx, qy), at = j * n + i;
    if (q >= naMax) { re[at] = im[at] = lr[at] = li[at] = 0; continue; }
    const taper = q <= naSoft ? 1 : 0.5 * (1 + Math.cos(Math.PI * (q - naSoft) / (naMax - naSoft)));
    re[at] *= taper; im[at] *= taper; lr[at] *= taper; li[at] *= taper;
    modes.push({ at, i, j, qx, qy, qz: Math.sqrt(1 - q * q), v: modeVector(qx, qy) });
  }
  return { id, phaseShift, config, re, im, lr, li, modes };
}

export function propagate(spectrum, z, components = [0, 1, 2, 3, 4], left = false) {
  if(spectrum.after&&z>=spectrum.interfaceZ)return propagate(spectrum.after,z-spectrum.interfaceZ,components,left);
  const { config: { n }, modes } = spectrum, size = n * n;
  const sourceRe = left ? spectrum.lr : spectrum.re, sourceIm = left ? spectrum.li : spectrum.im;
  const result = components.map(() => ({ re: new Float64Array(size), im: new Float64Array(size) }));
  for (const m of modes) {
    // Remove the common carrier exp(ikz); restore only for instantaneous fields.
    const angle = TAU * (m.qz - 1) * z, c = Math.cos(angle), s = Math.sin(angle), i = m.at;
    const r = sourceRe[i] * c - sourceIm[i] * s, t = sourceRe[i] * s + sourceIm[i] * c;
    for (let a = 0; a < components.length; a++) { const v = m.v[components[a]]; result[a].re[i] = r * v; result[a].im[i] = t * v; }
  }
  for (const r of result) fft2(r.re, r.im, n, true);
  return result;
}

export function fluxZ(ey, bx, i) { return -(ey.re[i] * bx.re[i] + ey.im[i] * bx.im[i]); }
export function halfSpan(z) { return 5.5 + 0.2 * z + 0.0021 * z * z; }
export function fresnelNumber(id, z) { return PRESETS[id].radius ** 2 / z; }
export function sampleComplex(field, x, y, config = CONFIG) {
  const { n, length } = config;
  const px = Math.max(0, Math.min(n - 1.001, x * n / length + n / 2));
  const py = Math.max(0, Math.min(n - 1.001, y * n / length + n / 2));
  const ix = Math.floor(px), iy = Math.floor(py), u = px - ix, v = py - iy;
  const a = iy * n + ix, b = a + n;
  const interp = d => (d[a] * (1 - u) + d[a + 1] * u) * (1 - v) + (d[b] * (1 - u) + d[b + 1] * u) * v;
  return [interp(field.re), interp(field.im)];
}

/** A central longitudinal section plus two off-axis vector sampling planes.
 * Sum over ky, then IFFT in kx. The exact same spectrum drives the detector.
 * Storing the slowly varying complex envelope prevents carrier aliasing.
 */
export function createVolume(spectrum) {
  const { config: { n, length, dz, zMax }, modes } = spectrum;
  const rows = Math.round(zMax / dz) + 1, ys = [-1.5, 0, 1.5], fields = new Float32Array(rows * n * 3 * 10);
  const slice = new Float32Array(rows * n * 4);
  const phaseRe = new Float64Array(modes.length), phaseIm = new Float64Array(modes.length);
  const stepRe = new Float64Array(modes.length), stepIm = new Float64Array(modes.length);
  const yRe = new Float64Array(modes.length * 3), yIm = new Float64Array(modes.length * 3);
  modes.forEach((m, j) => {
    phaseRe[j] = spectrum.re[m.at]; phaseIm[j] = spectrum.im[m.at];
    const angle = TAU * (m.qz - 1) * dz; stepRe[j] = Math.cos(angle); stepIm[j] = Math.sin(angle);
    ys.forEach((y, p) => { const a = TAU * m.qy * (y + length / 2); yRe[j * 3 + p] = Math.cos(a) / n; yIm[j * 3 + p] = Math.sin(a) / n; });
  });
  const sums = Array.from({ length: 15 }, () => ({ re: new Float64Array(n), im: new Float64Array(n) }));
  for (let z = 0; z < rows; z++) {
    for (const a of sums) { a.re.fill(0); a.im.fill(0); }
    for (let j = 0; j < modes.length; j++) {
      const m = modes[j], r = phaseRe[j], t = phaseIm[j];
      for (let p = 0; p < 3; p++) {
        const a = j * 3 + p, real = r * yRe[a] - t * yIm[a], imag = r * yIm[a] + t * yRe[a];
        for (let c = 0; c < 5; c++) { const f = sums[p * 5 + c], v = m.v[c]; f.re[m.i] += real * v; f.im[m.i] += imag * v; }
      }
      phaseRe[j] = r * stepRe[j] - t * stepIm[j]; phaseIm[j] = r * stepIm[j] + t * stepRe[j];
    }
    for (let p = 0; p < 3; p++) for (let c = 0; c < 5; c++) {
      const f = sums[p * 5 + c]; fft(f.re, f.im, true);
      for (let x = 0; x < n; x++) {
        const at = ((p * rows + z) * n + x) * 10 + c * 2;
        fields[at] = f.re[x]; fields[at + 1] = f.im[x];
        if (p === 1 && (c === 0 || c === 2)) { const s = (z * n + x) * 4 + (c === 0 ? 0 : 2); slice[s] = f.re[x]; slice[s + 1] = f.im[x]; }
      }
    }
  }
  return { fields, slice, rows, n, length, dz, ys };
}

export function sampleVolume(volume, x, z, plane = 1, out = new Float32Array(10)) {
  const { n, length, dz, rows, fields } = volume;
  const px = Math.max(0, Math.min(n - 1.001, x * n / length + n / 2));
  const pz = Math.max(0, Math.min(rows - 1.001, z / dz));
  const ix = Math.floor(px), iz = Math.floor(pz), u = px - ix, v = pz - iz;
  const a = ((plane * rows + iz) * n + ix) * 10, b = a + n * 10;
  for (let c = 0; c < 10; c++) out[c] = (fields[a + c] * (1 - u) + fields[a + 10 + c] * u) * (1 - v) + (fields[b + c] * (1 - u) + fields[b + 10 + c] * u) * v;
  return out;
}
