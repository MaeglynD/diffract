import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {EXPERIMENTS} from '../src/experiments.js';
import {decodeVolume,HEADER_BYTES} from '../src/volume-data.js';
for(const e of [...EXPERIMENTS,{id:'double-right'}].filter(e=>!process.argv.slice(2).length||process.argv.slice(2).includes(e.id))){
 const bytes=gunzipSync(await readFile(`assets/fields/${e.id}.bin.gz`)),v=decodeVolume(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const nx=(v.nx+1)/2,ny=(v.ny+1)/2,cut=v.interfaceZ?Math.round(v.interfaceZ/v.zMax*(v.nz-2)):-1,nz=cut<0?(v.nz+1)/2:v.nz/2+1,textures=[0,1,2].map(()=>new Uint16Array(nx*ny*nz*4)),indices=Array.from({length:nz},(_,z)=>cut<0?2*z:z<=cut/2?2*z:2*(z-1)+1);
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const a=((indices[z]*v.ny+2*y)*v.nx+2*x)*4,b=((z*ny+y)*nx+x)*4;
  for(let t=0;t<3;t++)for(let c=0;c<4;c++)textures[t][b+c]=v.textures[t][a+c];
 }
 const {buffer,textures:ignored,...meta}=v;Object.assign(meta,{nx,ny,nz,peaks:indices.map(i=>v.peaks[i]),quality:'preview'});
 const header=Buffer.alloc(HEADER_BYTES);header.write(JSON.stringify(meta));const gz=gzipSync(Buffer.concat([header,...textures.map(t=>Buffer.from(t.buffer))]),{level:6});
 await writeFile(`assets/fields/${e.id}.preview.bin.gz`,gz);console.log(`${e.id}: ${nx} × ${ny} × ${nz}, ${(gz.length/1048576).toFixed(1)} MiB`);
}
