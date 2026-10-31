import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fieldAssets} from '../dist/src/field-assets.js';
import {EXPERIMENTS} from '../src/experiments.js';

const expected = [...EXPERIMENTS.map(e => e.id), 'double-right'].flatMap(id => [`${id}.bin.gz`, `${id}.preview.bin.gz`]).sort();
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
