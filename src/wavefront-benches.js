import {fft2, TAU} from './physics.js';

// Geometry, the numerical boundary conditions and the preview baker share
// these dimensions. All lengths are in vacuum wavelengths.
export const LENSLETS = Object.freeze({pitch:6, count:5, arrayZ:7, f:12, curvature:.014});
export const SCATTER = Object.freeze({segments:8, pitch:2, pupil:8.8, modulator:5, screen:11, camera:33, targetX:1.5, targetY:-1});

// A reproducible smooth random surface. The illuminated area samples many
// correlation lengths, and the glass is identical for both observations.
const harmonics = [];
let seed = 0x354df912;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) + .5) / 4294967296;
for (let j = 0; j < 16; j++) {
  const angle = TAU * random(), frequency = .055 + .095 * random();
  harmonics.push([TAU * frequency * Math.cos(angle), TAU * frequency * Math.sin(angle), TAU * random()]);
}
export function diffuserPhase(x, y) {
  let phase = 0;
  for (const [kx,ky,offset] of harmonics) phase += .87 * Math.cos(kx*x + ky*y + offset);
  phase += .12 * Math.cos(3.7*x + 2.8*y) * Math.sin(2.2*y - .6*x);
  return phase;
}

export function lensletPhase(x, y, warped) {
  const {pitch, f, curvature} = LENSLETS;
  const u = x - pitch * Math.round(x / pitch), v = y - pitch * Math.round(y / pitch);
  const lens = -TAU * (Math.hypot(f, u, v) - f);
  return lens + (warped ? Math.PI * curvature * (x*x - y*y) : 0);
}

export function wavefrontRegions(id, alternate, grid) {
  const {n, length, advance, bandlimit} = grid, dx = length / n, size = n*n;
  const regions = [];
  function spectrum(real, imag) {
    fft2(real, imag, n);
    bandlimit(real, imag, n, length);
    return [real, imag];
  }
  function record(z, real, imag) {
    const data = new Float32Array(size * 4);
    for (let p = 0; p < size; p++) { data[4*p] = real[p]; data[4*p+1] = imag[p]; }
    regions.push({z, data});
  }
  const coordinates = Float64Array.from({length:n}, (_, i) => (i - n/2) * dx);
  function incident(z, fieldAtElement) {
    const r=new Float64Array(size), t=new Float64Array(size);
    for(const [j,y] of coordinates.entries())for(const [i,x] of coordinates.entries()){
      const [a,b]=fieldAtElement(x,y);r[j*n+i]=a;t[j*n+i]=b;
    }
    // Start the displayed incident beam upstream of the programmed boundary.
    // Back-propagate its prescribed incident phasor, including the same NA.
    const upstream=advance(...spectrum(r,t),n,length,-z);
    fft2(...upstream,n);
    record(0,...upstream);
  }
  const real = new Float64Array(size), imag = new Float64Array(size);
  if (id === 'hartmann') {
    const half = LENSLETS.count * LENSLETS.pitch / 2;
    incident(LENSLETS.arrayZ,(x,y)=>{
      const edge=Math.min(1,Math.max(0,(Math.max(Math.abs(x),Math.abs(y))-17)/5));
      const a=(1+Math.cos(Math.PI*edge))/2;
      const phase=alternate?Math.PI*LENSLETS.curvature*(x*x-y*y):0;
      return [a*Math.cos(phase),a*Math.sin(phase)];
    });
    const cover = t => Math.max(0, Math.min(1, (half - Math.abs(t)) / dx + .5));
    for (const [j,y] of coordinates.entries()) for (const [i,x] of coordinates.entries()) {
      // Fractional coverage on the four outer edges of the lenslet array.
      const amplitude = cover(x) * cover(y), phase = lensletPhase(x, y, alternate), p = j*n+i;
      real[p] = amplitude*Math.cos(phase); imag[p] = amplitude*Math.sin(phase);
    }
    record(LENSLETS.arrayZ, ...spectrum(real, imag));
    return regions;
  }

  const {segments, pitch, pupil, modulator, screen, camera, targetX, targetY} = SCATTER;
  const cells = new Int16Array(size).fill(-1), source = new Float64Array(size);
  const glassRe = new Float64Array(size), glassIm = new Float64Array(size);
  for (const [j,y] of coordinates.entries()) for (const [i,x] of coordinates.entries()) {
    const p = j*n+i, col = Math.floor(x/pitch + segments/2), row = Math.floor(y/pitch + segments/2);
    const coverage=Math.min(1,Math.max(0,(pupil-Math.hypot(x,y))/dx+.5));
    source[p] = coverage * Math.exp(-(x*x+y*y)/80);
    if (col >= 0 && col < segments && row >= 0 && row < segments) {
      cells[p] = row*segments + col;
    }
    if (Math.max(Math.abs(x), Math.abs(y)) < 10) {
      const phase = diffuserPhase(x,y);
      glassRe[p] = Math.cos(phase); glassIm[p] = Math.sin(phase);
    }
  }
  const laser = spectrum(source, new Float64Array(size));
  record(0,...laser);
  const [incidentRe,incidentIm] = advance(...laser,n,length,modulator);
  const commands = new Float64Array(segments*segments);
  if (alternate) {
    // Apply the adjoint of the actual finite-aperture propagation operator
    // to one camera pixel. Its phase on each SLM segment maximizes |Ey| there.
    const target = new Float64Array(size);
    target[(n/2 + Math.round(targetY/dx))*n + n/2 + Math.round(targetX/dx)] = 1;
    let [r,t] = advance(...spectrum(target, new Float64Array(size)), n, length, screen-camera);
    for (let p = 0; p < size; p++) {
      const a = r[p], b = t[p];
      r[p] = a*glassRe[p] + b*glassIm[p]; t[p] = b*glassRe[p] - a*glassIm[p];
    }
    [r,t] = advance(...spectrum(r,t), n, length, modulator-screen);
    const sumRe = new Float64Array(commands.length), sumIm = new Float64Array(commands.length);
    for (let p = 0; p < size; p++) if (cells[p] >= 0) {
      sumRe[cells[p]] += incidentRe[p]*r[p] + incidentIm[p]*t[p];
      sumIm[cells[p]] += incidentRe[p]*t[p] - incidentIm[p]*r[p];
    }
    for (let c = 0; c < commands.length; c++) commands[c] = Math.atan2(sumIm[c], sumRe[c]);
  }
  for (let p = 0; p < size; p++) if (cells[p] >= 0) {
    const phase = commands[cells[p]];
    const c=Math.cos(phase),s=Math.sin(phase);
    real[p]=incidentRe[p]*c-incidentIm[p]*s;imag[p]=incidentRe[p]*s+incidentIm[p]*c;
  }
  const launch = spectrum(real, imag);
  record(modulator, ...launch);
  if (alternate) regions[0].commands = Array.from(commands, phase => Number(phase.toFixed(5)));
  const [r,t] = advance(...launch, n, length, screen-modulator);
  for (let p = 0; p < size; p++) {
    const a = r[p], b = t[p];
    r[p] = a*glassRe[p] - b*glassIm[p]; t[p] = a*glassIm[p] + b*glassRe[p];
  }
  record(screen, ...spectrum(r,t));
  return regions;
}
