import { readFile,writeFile,mkdir } from 'node:fs/promises';
import './bake-model-preview.mjs';
import { gunzipSync,deflateSync } from 'node:zlib';
import { EXPERIMENTS,boundary,maskHalf } from '../src/experiments.js';
import {transmissionPixels,surfacePixels} from '../src/transmission.js';
import { decodeVolume,fromHalf,sampleField,normalizedFlux,detectorPeak } from '../src/volume-data.js';
import {IMAGE_DEPTHS} from '../src/holographic-scenes.js';

// Scientific previews are rendered from the same complex field assets as the scene.
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const name=Buffer.from(type),bytes=Buffer.concat([name,data]);let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);const h=Buffer.alloc(4),t=Buffer.alloc(4);h.writeUInt32BE(data.length);t.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([h,bytes,t]);}
function png(w,h,rgba){const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const rows=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)Buffer.from(rgba.buffer,rgba.byteOffset+y*w*4,w*4).copy(rows,y*(w*4+1)+1);return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]).toString('base64');}
await mkdir('assets/previews',{recursive:true});await mkdir('assets/masks',{recursive:true});

for(const e of EXPERIMENTS.filter(e=>!e.analytic&&(!process.argv.slice(2).length||process.argv.slice(2).includes(e.id)))){
 const maskImage=transmissionPixels(e,384);await writeFile('assets/masks/'+e.id+'.png',Buffer.from(png(384,384,maskImage.data).split(',')[1],'base64'));
 const surface=surfacePixels(e,384);await writeFile('assets/masks/'+e.id+'.surface.png',Buffer.from(png(384,384,surface.data).split(',')[1],'base64'));
 const bytes=gunzipSync(await readFile('assets/fields/'+e.id+'.bin.gz')),v=decodeVolume(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),P=160,h=maskHalf(e),optic=new Uint8Array(P*P*4),detector=new Uint8Array(P*P*4),f=new Float32Array(10),peak=detectorPeak(v,e.z);
 const phasePlate=e.kind==='phase'||e.kind==='axicon',extent=e.thumbnailHalf??(e.id==='rabbit'?10:e.id==='hologram'||e.id==='petals'?10:e.half);
 for(let j=0;j<P;j++)for(let i=0;i<P;i++){
  const x=(i/(P-1)*2-1),y=(1-j/(P-1)*2),at=(j*P+i)*4;
  sampleField(v,x*extent,y*extent,e.z,f);const value=Math.pow(Math.max(0,Math.min(1,normalizedFlux(f)/peak)),.43);
  const low=[20,92,120],mid=[128,240,227],high=[255,219,138],smooth=(a,b,t)=>{const k=Math.max(0,Math.min(1,(t-a)/(b-a)));return k*k*(3-2*k);};
  const mix=(a,b,t)=>a.map((n,k)=>n+(b[k]-n)*t);let rgb=mix(low,mid,value);rgb=mix(rgb,high,Math.max(0,Math.min(.7,(value-.55)*1.4)));rgb=mix([2.04,5.355,8.415],rgb,smooth(0,.7,value));detector.set([...rgb,255],at);
  const t=boundary(e.id,x*h,y*h),a=Math.hypot(...t),p=Math.atan2(t[1],t[0]);
  if(phasePlate&&a>.008){const c=[0,2.094395,4.18879].map(o=>(.55+.43*Math.cos(p+o))*255*(.3+.7*Math.min(1,Math.sqrt(a))));optic.set([...c,255],at);}
  else optic.set(a>.13?[163,224,235,255]:[19,35,47,255],at);
 }
 let svg='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="184" viewBox="0 0 320 184"><defs><linearGradient id="beam"><stop stop-color="#68b5cf" stop-opacity=".03"/><stop offset=".6" stop-color="#7cdce7" stop-opacity=".16"/><stop offset="1" stop-color="#8bd2d6" stop-opacity=".06"/></linearGradient></defs><path d="M88 48 166 12v160L88 132Z" fill="url(#beam)"/><path d="M0 61h16m-16 18h16M0 97h16m-16 18h16" stroke="#71c6d0" stroke-width="1.3" opacity=".4"/><image href="'+png(P,P,optic)+'" x="18" y="46" width="77" height="90" preserveAspectRatio="none"/><rect x="18" y="46" width="77" height="90" rx="1" fill="none" stroke="#9fc0cf" stroke-opacity=".55"/><image href="'+png(P,P,detector)+'" x="162" y="12" width="146" height="160" preserveAspectRatio="none"/><path d="M162 12h146v160H162Z" fill="none" stroke="#91bac7" stroke-opacity=".35"/><path d="M98 148h55m-5-4 5 4-5 4" fill="none" stroke="#8daab9" stroke-opacity=".35"/></svg>';
 if(e.object==='bunny'){const model=(await readFile('assets/previews/bunny-model.png')).toString('base64');svg='<svg xmlns="http://www.w3.org/2000/svg" width="320" height="184" viewBox="0 0 320 184"><image href="data:image/png;base64,'+model+'" x="0" y="5" width="150" height="174"/><image href="'+png(P,P,optic)+'" x="154" y="48" width="38" height="88" preserveAspectRatio="none"/><path d="M146 92h7m40 0h13" stroke="#9dbfc8" stroke-opacity=".6"/><image href="'+png(P,P,detector)+'" x="210" y="34" width="110" height="116"/><rect x="154" y="48" width="38" height="88" fill="none" stroke="#a4cbd2" stroke-opacity=".5"/></svg>';}
 if(e.vortex){
  const {lines}=JSON.parse(await readFile(`assets/topology/${e.id}.json`)),segments=[];
  for(const[k,line]of lines.entries())for(let j=0;j<line.points.length;j+=3){const a=line.points[j],b=line.points[(j+3)%line.points.length],project=p=>[211+(p[0]+.07*(p[2]-22))*20,94-(p[1]+.025*(p[2]-22))*20];segments.push({a:project(a),b:project(b),depth:(a[2]+b[2])/2,k});}
  segments.sort((a,b)=>a.depth-b.depth);
  const paths=segments.map(s=>`<path d="M${s.a.join(' ')}L${s.b.join(' ')}" fill="none" stroke="${s.k?'#efb49c':'#c8f3f5'}" stroke-width="3.4" stroke-linecap="round" opacity="${.48+.5*Math.max(0,Math.min(1,(s.depth-10)/24))}"/>`).join('');
  svg=`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="184" viewBox="0 0 320 184"><style>@media(prefers-color-scheme:light){path[stroke="#c8f3f5"]{stroke:#245865}path[stroke="#efb49c"]{stroke:#925334}}</style><defs><radialGradient id="halo"><stop stop-color="#255367" stop-opacity=".35"/><stop offset="1" stop-color="#071119" stop-opacity="0"/></radialGradient></defs><ellipse cx="211" cy="94" rx="105" ry="86" fill="url(#halo)"/><path d="M76 51 176 18 184 163 76 133Z" fill="#58849c" opacity=".07"/><image href="${png(P,P,optic)}" x="13" y="51" width="65" height="82"/><rect x="13" y="51" width="65" height="82" fill="none" stroke="#719ba8" opacity=".5"/>${paths}</svg>`;
 }
 if(e.id==='metamorphosis'){
  let panels='';for(let k=0;k<3;k++){const image=new Uint8Array(P*P*4),values=new Float32Array(P*P);let max=0;for(let j=0;j<P;j++)for(let i=0;i<P;i++){const value=Math.max(0,normalizedFlux(sampleField(v,(i/(P-1)*2-1)*9,(1-j/(P-1)*2)*9,IMAGE_DEPTHS[k])));values[j*P+i]=value;max=Math.max(max,value);}for(let i=0;i<values.length;i++){const q=(values[i]/max)**.5;image.set([4+155*q,12+218*q,18+213*q,255],i*4);}panels+=`<image href="${png(P,P,image)}" x="${68+k*81}" y="${52-k*17}" width="89" height="111" preserveAspectRatio="none"/><rect x="${68+k*81}" y="${52-k*17}" width="89" height="111" fill="none" stroke="#8eb7c3" opacity=".4"/>`;}
  svg=`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="184" viewBox="0 0 320 184"><image href="${png(P,P,optic)}" x="2" y="68" width="44" height="63"/><path d="M49 100h15" stroke="#8eb7c3" opacity=".5"/>${panels}</svg>`;
 }
 if(e.id==='healing'){
  const slice=new Uint8Array(P*P*4);for(let j=0;j<P;j++)for(let i=0;i<P;i++){const q=Math.max(0,Math.min(1,normalizedFlux(sampleField(v,0,(1-j/(P-1)*2)*8,i/(P-1)*e.zMax))/v.maxFlux))**.42;slice.set([3+152*q,10+218*q,16+210*q,255],(j*P+i)*4);}
  svg=`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="184" viewBox="0 0 320 184"><image href="${png(P,P,optic)}" x="7" y="50" width="57" height="84"/><image href="${png(P,P,slice)}" x="76" y="19" width="236" height="146" preserveAspectRatio="none"/><rect x="143" y="71" width="5" height="42" rx="1" fill="#08121b" stroke="#acc8cf" stroke-width=".7"/><path d="M145 113v51m-7 1h14" fill="none" stroke="#748d99" stroke-width="1.2"/><path d="M76 19H312V165H76Z" fill="none" stroke="#668c9e" opacity=".25"/></svg>`;
 }
 await writeFile('assets/previews/'+e.id+'.svg',svg);console.log(e.name+': mask and calculated detector preview rendered');
}

// Diagram thumbnails keep the aperture and its diffraction pattern legible.
