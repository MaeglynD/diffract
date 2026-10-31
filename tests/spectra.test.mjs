import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {EXPERIMENTS,buildSpectrum} from '../src/experiments.js';
import {decodeSpectrum} from '../src/spectral-volume.js';
import {energyVolume,energyVolumeAsync} from '../src/energy-volume.js';
import {toHalf} from '../src/volume-data.js';

test('compact assets preserve every retained Fourier coefficient, including both sides of the obstruction',async()=>{
 for(const id of [...EXPERIMENTS.map(e=>e.id),'double-right']){
  const bytes=gunzipSync(await readFile(new URL(`../assets/spectra/${id}.spectrum.gz`,import.meta.url))),s=decodeSpectrum(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),reference=buildSpectrum(id),sources=[reference,...(reference.after?[reference.after]:[])];
  assert.equal(s.id,id);assert.equal(s.sources,sources.length);assert.equal(s.data.length,s.side*s.side*2*s.sources);
  for(const quality of ['preview','full']){const meta=s[quality];assert.equal(meta.quality,quality);assert.equal(meta.id,id);assert.equal(meta.peaks.length,meta.nz);assert.ok(s.side<meta.grid.n/2,'preview FFT retains the entire spectral support');}
  const p=s.preview,spacing=2*p.half/(p.nx-1)*(p.grid.n/2)/p.grid.length;
  assert.ok(Math.abs(spacing-Math.round(spacing))<1e-10,`${id}: preview samples align with the reduced FFT grid`);
  for(let source=0;source<sources.length;source++)for(const mode of sources[source].modes){
   const n=reference.config.n,x=mode.i<n/2?mode.i:mode.i-n,y=mode.j<n/2?mode.j:mode.j-n,p=(source*s.side*s.side+(y+s.radius)*s.side+x+s.radius)*2;
   assert.equal(s.data[p],sources[source].re[mode.at],`${id}: real mode (${x},${y})`);assert.equal(s.data[p+1],sources[source].im[mode.at],`${id}: imaginary mode (${x},${y})`);
  }
 }
});

test('cooperative energy preparation preserves values and responds to cancellation',async()=>{
 const v={nx:13,ny:13,nz:25,zMax:12,interfaceZ:6,textures:[0,1,2].map((_,c)=>Uint16Array.from({length:13*13*25*4},(_,i)=>toHalf(Math.sin(i*.03+c))))};
 assert.deepEqual(await energyVolumeAsync(v),energyVolume(v));const controller=new AbortController();controller.abort();await assert.rejects(energyVolumeAsync(v,controller.signal),{name:'AbortError'});
});
