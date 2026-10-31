import {writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {BENCH_EXPERIMENTS} from '../src/bench-experiments.js';
import {benchModel,BRAGG} from '../src/bench-fields.js';
import {prepareSpectralBench,benchPlane} from '../src/spectral-bench.js';
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const name=Buffer.from(type),bytes=Buffer.concat([name,data]);let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);const h=Buffer.alloc(4),t=Buffer.alloc(4);h.writeUInt32BE(data.length);t.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([h,bytes,t]);}
function png(w,h,rgba){const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const rows=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)Buffer.from(rgba.buffer,rgba.byteOffset+y*w*4,w*4).copy(rows,y*(w*4+1)+1);return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]).toString('base64');}
function color(samples,w,h){const pixels=new Uint8Array(w*h*4),peak=Math.max(...samples);for(let p=0;p<samples.length;p++){const v=Math.pow(samples[p]/Math.max(peak,1e-6),.65);for(let c=0;c<3;c++)pixels[p*4+c]=[4,12,18][c]+v*[124,211,210][c];pixels[p*4+3]=255;}return png(w,h,pixels);}
for(const e of BENCH_EXPERIMENTS){
 let inner='';
 if(e.id==='michelson'||e.id==='bragg-cavity'){
  const w=256,h=180,m=benchModel(e.id),samples=new Float32Array(w*h);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const x=(j/(h-1)*2-1)*e.half,z=i/(w-1)*e.zMax,f=m.field(x,z);let energy=0;for(let c=0;c<10;c++)energy+=f[c]**2;samples[j*w+i]=Math.sqrt(energy*.5);}
  const image=color(samples,w,h);let g='';if(e.id==='michelson'){const s=10/e.zMax*w,y=h/2;g=`<rect x="${s-10}" y="${y-10}" width="20" height="20" fill="#8ab9cd" fill-opacity=".12" stroke="#aed8de"/><path d="M${s-10} ${y-10}l20 20M${2/e.zMax*w} ${y-16}v32M${s-16} ${y+9/e.half*h/2}h32" stroke="#d0e4e7" stroke-width="4"/><rect x="${s-8}" y="8" width="16" height="25" rx="4" fill="#344f5b" stroke="#78b8c5"/>`;}
  else for(const l of BRAGG.layers){const x=l.a/e.zMax*w;g+=`<rect x="${x}" y="8" width="${l.d/e.zMax*w}" height="164" fill="${l.n===BRAGG.H?'#83a8d4':'#addbcc'}" fill-opacity=".12" stroke="#b6d1df" stroke-opacity=".45" stroke-width=".7"/>`;}
  inner=`<g transform="matrix(.96 -.13 .24 .65 12 44)"><image href="${image}" width="${w}" height="${h}"/>${g}</g>`;
 }else{
  const m=prepareSpectralBench(e.id,128),w=224,h=124,samples=new Float32Array(w*h);for(let i=0;i<w;i++){const p=benchPlane(m,i/(w-1)*e.zMax);for(let j=0;j<h;j++){const ix=Math.max(0,Math.min(m.n-1,Math.round(((j/(h-1)*2-1)*e.half)/m.length*m.n+m.n/2))),at=m.n/2*m.n+ix;samples[j*w+i]=Math.hypot(p[0].re[at],p[0].im[at]);}}
  let g='';for(const z of(e.id==='phase-microscope'?[20,40,60]:[4,12])){const x=24+z/e.zMax*w;g+=`<ellipse cx="${x}" cy="92" rx="9" ry="${z===40?27:48}" fill="#9cc9d8" fill-opacity=".09" stroke="#9cc9d8" stroke-opacity=".65"/>`;if(z===40)g+=`<ellipse cx="${x}" cy="92" rx="2" ry="5" fill="#f6d9a2"/>`;}
  const at=e.id==='phase-microscope'?80:17,plane=benchPlane(m,at),pw=80,ph=80,values=new Float32Array(pw*ph),span=e.id==='phase-microscope'?9:5;
  for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){const i=Math.round((x/(pw-1)*2-1)*span*m.n/m.length+m.n/2),j=Math.round((1-y/(ph-1)*2)*span*m.n/m.length+m.n/2),p=j*m.n+i;values[y*pw+x]=Math.hypot(plane[0].re[p],plane[0].im[p]);}
  inner=`<g transform="translate(0 0)"><image href="${color(samples,w,h)}" x="24" y="30" width="224" height="124" opacity=".88"/>${g}<path d="M24 150h224" stroke="#718e9b" stroke-opacity=".4"/></g><image href="${color(values,pw,ph)}" x="250" y="53" width="64" height="80"/><path d="M250 53h64v80h-64z" fill="none" stroke="#91b5c3" stroke-opacity=".25"/>`;
 }
 await writeFile(`assets/previews/${e.id}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="184" viewBox="0 0 320 184">${inner}</svg>`);console.log('Preview',e.id);
}
