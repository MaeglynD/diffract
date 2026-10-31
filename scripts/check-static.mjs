import {createReadStream} from 'node:fs';
import {stat,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fieldAssets} from '../dist/src/field-assets.js';
import {EXPERIMENTS} from '../src/experiments.js';
import {spectrumAssets} from '../dist/src/spectrum-assets.js';
import {binaryAssets} from '../dist/src/binary-assets.js';
import {gunzipSync} from 'node:zlib';

const expected = [...EXPERIMENTS.filter(e=>!e.analytic).map(e => e.id), 'double-right'].flatMap(id => [`${id}.bin.gz`, `${id}.preview.bin.gz`]).sort();
if (JSON.stringify(Object.keys(fieldAssets).sort()) !== JSON.stringify(expected)) throw new Error('The deployed catalogue is missing field volumes.');
for (const [name, entry] of Object.entries(fieldAssets)) {
  const hash = createHash('sha256');
  let bytes = 0;
  for (const part of entry.parts) {
    const path = new URL(`../dist/assets/fields/chunks/${part.file}`, import.meta.url);
    if ((await stat(path)).size !== part.bytes) throw new Error(`${name}: invalid chunk length`);
    for await (const buffer of createReadStream(path)) { hash.update(buffer); bytes += buffer.length; }
  }
  if (hash.digest('hex') !== entry.sha256 || bytes !== entry.bytes) throw new Error(`${name}: reconstructed bytes do not match the source`);
}
console.log(`Verified all ${expected.length} deployed volumes: every reconstructed SHA-256 matches the source.`);
for(const id of [...EXPERIMENTS.filter(e=>!e.analytic).map(e=>e.id),'double-right']){
 const entry=spectrumAssets[id];if(!entry)throw Error(`Missing compact spectrum: ${id}`);
 const bytes=await readFile(new URL(`../dist/assets/spectra/${entry.file}`,import.meta.url));
 if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error(`Invalid compact spectrum: ${id}`);
}
console.log(`Verified all ${Object.keys(spectrumAssets).length} content-addressed angular spectra.`);
for(const [source,entry]of Object.entries(binaryAssets)){
 const compressed=await readFile(new URL(`../dist/assets/binary/${entry.file}`,import.meta.url)),raw=gunzipSync(compressed),original=await readFile(new URL('../'+source,import.meta.url));
 if(compressed.length!==entry.bytes||!raw.equals(original)||createHash('sha256').update(raw).digest('hex')!==entry.sha256)throw Error(`Geometry changed during packaging: ${source}`);
}
console.log(`Verified ${Object.keys(binaryAssets).length} compressed geometry assets: byte-for-byte identical.`);
