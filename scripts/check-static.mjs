import {open,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fieldAssets,fieldBase} from '../dist/src/field-assets.js';
import {currentRelease,digest,fieldOrigin} from './field-library.mjs';
import {EXPERIMENTS} from '../src/experiments.js';
import {spectrumAssets} from '../dist/src/spectrum-assets.js';
import {binaryAssets} from '../dist/src/binary-assets.js';
import {gunzipSync} from 'node:zlib';

// The large blobs were checked on publication. Check the pinned remote receipt
// and the checkout's LFS pointers without transferring or hashing the library.
const release=await currentRelease();
if(fieldBase!==fieldOrigin||JSON.stringify(fieldAssets)!==JSON.stringify(release.fields))throw Error('Wrong field release in the website output.');
for(const [name,entry] of Object.entries(release.fields)){
  const file=await open(new URL('../assets/fields/'+name,import.meta.url),'r');
  try{
    const {size}=await file.stat();
    if(size<256){
      const pointer=(await file.readFile('utf8')).split(/\r?\n/);
      if(!pointer.includes('oid sha256:'+entry.sha256)||!pointer.includes('size '+entry.bytes))
        throw Error(name+' has changed. Publish the matching field release first.');
    }else if(size!==entry.bytes)throw Error(name+' does not match the published release.');
  }finally{await file.close();}
}
const url=fieldOrigin+'releases/'+release.id+'.json';
const remote=await fetch(url,{signal:AbortSignal.timeout(30000)});
if(!remote.ok||remote.headers.get('access-control-allow-origin')!=='*'||digest(Buffer.from(await remote.arrayBuffer()))!==release.id)
  throw Error('Field release unavailable or invalid at '+url);
console.log('Verified '+Object.keys(fieldAssets).length+' fields against the published index ('+release.id+').');
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
