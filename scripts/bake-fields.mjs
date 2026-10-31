import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { EXPERIMENTS, buildSpectrum } from '../src/experiments.js';
import { propagate, sampleComplex } from '../src/physics.js';
import { HEADER_BYTES, toHalf, fromHalf } from '../src/volume-data.js';

await mkdir('assets/fields', { recursive: true });
const requested = process.argv.slice(2);
const selected = requested.length ? EXPERIMENTS.filter(e => requested.includes(e.id)) : [...EXPERIMENTS];
if(!requested.length||requested.includes('double-right'))selected.push({...EXPERIMENTS.find(e=>e.id==='double'),id:'double-right'});
for (const e of selected) {
  const started = performance.now(), spectrum = buildSpectrum(e.id), nx = Math.round(2 * e.half * spectrum.config.n / spectrum.config.length) + 1, ny = nx, regularNz=Math.round(e.zMax*2)+1,cut=e.interfaceZ?Math.round(e.interfaceZ*2):-1,nz=regularNz+(cut>=0?1:0);
  const count = nx * ny * nz * 4, textures = [0, 1, 2].map(() => new Uint16Array(count));
  const peaks = new Float32Array(nz); let maxE = 0, maxFlux = 0;
  for (let iz = 0; iz < nz; iz++) {
    const z=cut<0?iz*e.zMax/(nz-1):(iz<=cut?iz:iz-1)/2,fields = propagate(spectrum, iz===cut?z-1e-7:z);
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      const x = (ix / (nx - 1) * 2 - 1) * e.half, y = (iy / (ny - 1) * 2 - 1) * e.half;
      const f = fields.flatMap(field => sampleComplex(field, x, y, spectrum.config));
      const at = ((iz * ny + iy) * nx + ix) * 4;
      for (let c = 0; c < 10; c++) textures[Math.floor(c / 4)][at + c % 4] = toHalf(f[c]);
      const flux = -(f[0] * f[4] + f[1] * f[5]), energy = f.slice(0, 4).reduce((a, b) => a + b * b, 0);
      textures[2][at + 2] = toHalf(energy); textures[2][at + 3] = toHalf(flux);
      maxE = Math.max(maxE, Math.sqrt(energy)); maxFlux = Math.max(maxFlux, flux); peaks[iz] = Math.max(peaks[iz], flux);
    }
    if (iz % 32 === 0) console.log(`${e.id}: ${iz}/${nz - 1}`);
  }
  const meta = { version: 2, id: e.id, nx, ny, nz, half: e.half, zMax: e.zMax, maxE, maxFlux, peaks: [...peaks], quality: 'full', grid: spectrum.config,interfaceZ:e.interfaceZ };
  await save(`assets/fields/${e.id}.bin.gz`, meta, textures);
  const px = (nx + 1) / 2, py = px, pz = (regularNz + 1) / 2+(cut>=0?1:0), small = [0, 1, 2].map(() => new Uint16Array(px * py * pz * 4)), smallPeaks = [];
  for (let z = 0; z < pz; z++) {
    const iz=cut<0?Math.round(z/(pz-1)*(nz-1)):z<=cut/2?z*2:(z-1)*2+1; smallPeaks.push(peaks[iz]);
    for (let y = 0; y < py; y++) for (let x = 0; x < px; x++) {
      const ix = Math.round(x / (px - 1) * (nx - 1)), iy = Math.round(y / (py - 1) * (ny - 1));
      const a = ((iz * ny + iy) * nx + ix) * 4, b = ((z * py + y) * px + x) * 4;
      for (let t = 0; t < 3; t++) for (let c = 0; c < 4; c++) small[t][b + c] = textures[t][a + c];
    }
  }
  await save(`assets/fields/${e.id}.preview.bin.gz`, { ...meta, nx: px, ny: py, nz: pz, peaks: smallPeaks, quality: 'preview' }, small);
  console.log(`${e.id} complete in ${((performance.now() - started) / 1000).toFixed(1)}s; max |E| ${maxE.toFixed(3)}`);
}

async function save(path, meta, textures) {
  const header = Buffer.alloc(HEADER_BYTES); header.write(JSON.stringify(meta));
  const binary = Buffer.concat([header, ...textures.map(a => Buffer.from(a.buffer))]);
  const gz = gzipSync(binary, { level: 6 }); await writeFile(path, gz);
  console.log(`  ${path}: ${(gz.length / 1048576).toFixed(2)} MiB`);
}
