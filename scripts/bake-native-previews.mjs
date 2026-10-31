import {writeFile,mkdir} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {NATIVE_EXPERIMENTS} from '../src/native-experiments.js';
import {nativeModel,energyDensity,CAVITY,GUIDE,GAP} from '../src/native-fields.js';
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const name=Buffer.from(type),bytes=Buffer.concat([name,data]);let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);const h=Buffer.alloc(4),t=Buffer.alloc(4);h.writeUInt32BE(data.length);t.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([h,bytes,t]);}
function png(w,h,rgba){const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const rows=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)Buffer.from(rgba.buffer,rgba.byteOffset+y*w*4,w*4).copy(rows,y*(w*4+1)+1);return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]).toString('base64');}
await mkdir('assets/previews',{recursive:true});
for(const e of NATIVE_EXPERIMENTS.filter(e=>!e.bench)){
 const w=320,h=200,model=nativeModel(e.id),samples=new Float32Array(w*h),pixels=new Uint8Array(w*h*4),extent=e.id==='coupler'?1.4:e.half;let peak=0;
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const x=(j/(h-1)*2-1)*extent,z=i/(w-1)*e.zMax,f=model.field(x,z),s=e.id==='circulator'?f[0]:Math.sqrt(energyDensity(f,model.epsilon(x,z)));samples[j*w+i]=s;peak=Math.max(peak,Math.abs(s));}
 for(let p=0;p<samples.length;p++){const v=Math.pow(Math.abs(samples[p])/peak,.8),positive=samples[p]>=0;for(let c=0;c<3;c++)pixels[p*4+c]=[5,15,22][c]+v*(positive?[132,222,216]:[151,126,219])[c];pixels[p*4+3]=255;}
 let geometry='';
 if(e.id==='coupler'){for(const sign of[-1,1]){const mid=(.5+sign*(GUIDE.gap+GUIDE.width)/2/(2*extent))*h,dh=GUIDE.width/(2*extent)*h;geometry+=`<rect x="0" y="${mid-dh/2}" width="320" height="${dh}" fill="#b8e4ee" fill-opacity=".04" stroke="#a1d1dc" stroke-opacity=".55" stroke-width="1.2"/>`;}}
 if(e.id==='circulator'){const cx=CAVITY.center/e.zMax*w,rx=CAVITY.radius/e.zMax*w,ry=CAVITY.radius/(2*extent)*h;geometry+=`<ellipse cx="${cx}" cy="100" rx="${rx}" ry="${ry}" fill="none" stroke="#b9d6de" stroke-opacity=".7" stroke-width="2"/><ellipse cx="${cx}" cy="73" rx="${rx}" ry="${ry}" fill="none" stroke="#9abcc9" stroke-opacity=".35" stroke-width="1.5"/>`;}
 if(e.id==='tunnelling'){for(const z of[GAP.at,GAP.at+GAP.width]){const x=z/e.zMax*w;geometry+=`<path d="M${x} 0V200m0-200v-22" stroke="#b1dce4" stroke-opacity=".8" stroke-width="1.5"/>`;}}
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="184" viewBox="0 0 320 184"><g transform="matrix(.78 -.11 .25 .49 10 65)"><path d="M0 0H320V200H0Z" fill="#0c1b24" stroke="#9eb9c8" stroke-opacity=".25"/><image href="${png(w,h,pixels)}" width="320" height="200"/>${geometry}<path d="M0 200v8h320v-8" fill="#09131b" stroke="#6d96a4" stroke-opacity=".3"/></g></svg>`;
 await writeFile(`assets/previews/${e.id}.svg`,svg);
}
