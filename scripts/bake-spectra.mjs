import {mkdir, writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createGunzip, gzipSync} from 'node:zlib';
import {EXPERIMENTS, buildSpectrum} from '../src/experiments.js';
import {HEADER_BYTES} from '../src/volume-data.js';

async function metadata(id,preview=false){
 const source=createReadStream(`assets/fields/${id}${preview?'.preview':''}.bin.gz`),stream=source.pipe(createGunzip());
 try{for await(const bytes of stream){if(bytes.length<HEADER_BYTES)throw Error('Incomplete volume header');return JSON.parse(bytes.subarray(0,HEADER_BYTES).toString().split('\0')[0]);}}finally{source.destroy();stream.destroy();}
}
await mkdir('assets/spectra',{recursive:true});
const ids=process.argv.slice(2),selected=[...EXPERIMENTS.map(e=>e.id),'double-right'].filter(id=>!ids.length||ids.includes(id));
for(const id of selected){
 const spectrum=buildSpectrum(id),full=await metadata(id),preview=await metadata(id,true);
 const radius=Math.ceil(spectrum.config.length*spectrum.config.naMax),side=radius*2+1;
 const sources=[spectrum,...(spectrum.after?[spectrum.after]:[])],data=new Float64Array(side*side*2*sources.length);
 for(let s=0;s<sources.length;s++)for(let y=-radius;y<=radius;y++)for(let x=-radius;x<=radius;x++){
  const at=((y+spectrum.config.n)%spectrum.config.n)*spectrum.config.n+(x+spectrum.config.n)%spectrum.config.n,p=(s*side*side+(y+radius)*side+x+radius)*2;
  data[p]=sources[s].re[at];data[p+1]=sources[s].im[at];
 }
 const header=Buffer.alloc(HEADER_BYTES);header.write(JSON.stringify({version:1,id,radius,side,sources:sources.length,full,preview}));
 const bytes=gzipSync(Buffer.concat([header,Buffer.from(data.buffer)]),{level:9});
 await writeFile(`assets/spectra/${id}.spectrum.gz`,bytes);
 console.log(`${id}: ${(bytes.length/1024).toFixed(1)} KiB`);
}
