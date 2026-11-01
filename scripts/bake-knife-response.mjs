import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {prepareSpectralBench,benchPlane} from '../src/spectral-bench.js';
import {KNIFE} from '../src/knife-response.js';
import {precision,sections,transformLines} from '../src/knife-table.js';
import {SCHLIEREN} from '../src/schlieren.js';

// The 128-point transform retains every mode passed by the 256-point relay
// (NA ≤ 0.65). Its half-wavelength samples are the spline coefficient grid.
const {knots,width}=KNIFE,planes=sections.reduce((a,b)=>a+b);
const values=Array.from({length:10},()=>new Float32Array(knots*planes*width*width));
for(let k=0;k<knots;k++){
  const edge=-SCHLIEREN.bladeLimit+k*SCHLIEREN.bladeStep;
  const full=prepareSpectralBench('schlieren',256,32,edge),n=128;
  const gain=Array.from({length:n},(_,i)=>3/(2+Math.cos(2*Math.PI*i/n)));
  const regions=full.regions.slice(2).map(region=>{
    const data=new Float32Array(4*n*n);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const src=4*((y<n/2?y:y+n)*full.n+(x<n/2?x:x+n)),at=4*(y*n+x);
      for(let c=0;c<2;c++)data[at+c]=region.data[src+c]*.25*gain[x]*gain[y];
    }
    return {z:region.z,data};
  });
  for(let l=0;l<planes;l++){
    const field=benchPlane({n,length:full.length,regions},2*SCHLIEREN.f+.5*l);
    for(let y=0;y<width;y++)for(let x=0;x<width;x++){
      const p=(n/2+y-(width-1)/2)*n+n/2+x-(width-1)/2,at=((k*planes+l)*width+y)*width+x;
      for(let c=0;c<5;c++){values[2*c][at]=field[c].re[p];values[2*c+1][at]=field[c].im[p];}
    }
  }
}
const chunks=[];
for(const channel of values){
  let first=0;
  for(const depth of sections){
    const size=knots*depth*width*width,data=new Float32Array(size);
    for(let k=0;k<knots;k++){
      const start=(k*planes+first)*width*width;
      data.set(channel.subarray(start,start+depth*width*width),k*depth*width*width);
    }
    transformLines(data,[knots,depth,width,width],false);
    const bytes=Buffer.alloc(2*size);
    for(let i=0;i<size;i++){
      const q=Math.round(data[i]/precision);if(Math.abs(q)>32767)throw Error('Coefficient out of range');
      const code=(q<<1)^(q>>31);bytes[i]=code&255;bytes[size+i]=code>>8;
    }
    chunks.push(bytes);first+=depth;
  }
}
const dir=new URL('../assets/optics/',import.meta.url);await mkdir(dir,{recursive:true});
const file=gzipSync(Buffer.concat(chunks),{level:9});await writeFile(new URL('schlieren-v1.table',dir),file);
console.log('Schlieren response table · '+(file.length/1048576).toFixed(2)+' MiB');
