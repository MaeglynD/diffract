import {KNIFE} from './knife-response.js';
import {SCHLIEREN} from './schlieren.js';
import {HEADER_BYTES,toHalf} from './volume-data.js';

// Four-dimensional interpolating wavelets. Even samples are kept; each odd
// sample stores the difference from a four-point cubic prediction. A lens
// changes the field discontinuously, so its two sides have separate tables.
export const sections=[36,37],precision=.0008;
export function transformLines(data,shape,inverse){
  const line=new Float32Array(Math.max(...shape)),work=line.slice();
  let stride=inverse?data.length:1;
  for(let d=0;d<shape.length;d++){
    const n=shape[inverse?d:shape.length-1-d],levels=[];
    for(let size=n;size>=4;size=Math.ceil(size/2))levels.push(size);
    if(inverse){stride/=n;levels.reverse();}
    for(let block=0;block<data.length;block+=n*stride)for(let s=0;s<stride;s++){
      const start=block+s;
      for(let k=0;k<n;k++)line[k]=data[start+k*stride];
      for(const size of levels){
        const evens=Math.ceil(size/2),last=evens-1;
        if(inverse){for(let i=0;i<evens;i++)work[2*i]=line[i];}
        else{for(let i=0;i<evens;i++)work[i]=line[2*i];}
        const even=inverse?line:work;
        for(let i=0;i<size-evens;i++){
          const prediction=(9*(even[i]+even[Math.min(i+1,last)])-even[Math.max(0,i-1)]-even[Math.min(i+2,last)])/16;
          if(inverse)work[2*i+1]=line[evens+i]+prediction;
          else work[evens+i]=line[2*i+1]-prediction;
        }
        line.set(work.subarray(0,size));
      }
      for(let k=0;k<n;k++)data[start+k*stride]=line[k];
    }
    if(!inverse)stride*=n;
  }
}
export async function unpackKnifeTable(bytes,signal,progress=()=>{}){
  const {knots,width,tiles}=KNIFE,nx=width*tiles,nz=sections[0]+sections[1],count=4*nx*nx*nz;
  if(bytes.length!==20*knots*width*width*nz)throw Error('Incomplete Schlieren response table');
  const buffer=new ArrayBuffer(HEADER_BYTES+6*count);
  const out=[0,1,2].map(i=>new Uint16Array(buffer,HEADER_BYTES+i*2*count,count));
  let pos=0;
  for(let c=0;c<10;c++){
    let first=0;
    for(const depth of sections){
      signal?.throwIfAborted();
      const shape=[knots,depth,width,width],size=knots*depth*width*width,v=new Float32Array(size);
      for(let i=0;i<size;i++){
        const code=bytes[pos+i]+256*bytes[pos+size+i];
        v[i]=((code>>>1)^-(code&1))*precision;
      }
      pos+=2*size;transformLines(v,shape,true);
      let i=0;
      for(let k=0;k<knots;k++)for(let z=0;z<depth;z++)for(let y=0;y<width;y++){
        const dst=4*(((first+z)*nx+Math.floor(k/tiles)*width+y)*nx+(k%tiles)*width)+(c%4),t=out[c>>2];
        for(let x=0;x<width;x++)t[dst+4*x]=toHalf(v[i++]);
      }
      first+=depth;progress(pos/bytes.length);await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  const meta={version:2,id:'schlieren-blade',knifeBank:true,quality:'full',half:12,zMax:SCHLIEREN.camera-2*SCHLIEREN.f,nx,ny:nx,nz};
  new Uint8Array(buffer,0,HEADER_BYTES).set(new TextEncoder().encode(JSON.stringify(meta)));
  return {buffer,method:'knife-response-table'};
}
export async function loadKnifeTable(signal,progress){
  const response=await fetch(new URL('../assets/optics/schlieren-v1.table',import.meta.url),{signal});
  if(!response.ok)throw Error('Schlieren response table unavailable');
  const raw=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return unpackKnifeTable(new Uint8Array(raw),signal,progress);
}
