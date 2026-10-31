import {writeFile} from 'node:fs/promises';
import {NATIVE_EXPERIMENTS} from '../src/native-experiments.js';
import {nativeModel,energyDensity} from '../src/native-fields.js';
import {liveModel,LIVE_IDS,LIVE_DEFAULT} from '../src/live-physics.js';
import {prepareSpectralBench,benchPlane} from '../src/spectral-bench.js';
import {GAP,GUIDE} from '../src/native-config.js';
import {BRAGG} from '../src/bench-fields.js';
import {color} from './preview-raster.mjs';
const line=(d,extra='')=>`<path d="${d}" fill="none" stroke="#a2c5cf" stroke-opacity=".6" ${extra.includes('stroke-width')?'':'stroke-width="1.4"'} ${extra}/>`;
for(const e of NATIVE_EXPERIMENTS){
 const spectral=e.spectralBench?prepareSpectralBench(e.id):null,model=spectral?null:LIVE_IDS.includes(e.id)?liveModel(e.id,LIVE_DEFAULT[e.id]):nativeModel(e.id),w=240,h=140,samples=new Float32Array(w*h),X=z=>z/e.zMax*w,Y=x=>(x/e.half/2+.5)*h;
 for(let i=0;i<w;i++){const z=i/(w-1)*e.zMax,p=spectral?benchPlane(spectral,z):null;for(let j=0;j<h;j++){const x=(j/(h-1)*2-1)*e.half;if(p){const at=spectral.n/2*spectral.n+Math.round(x*spectral.n/spectral.length+spectral.n/2);samples[j*w+i]=Math.hypot(p[0].re[at],p[0].im[at]);}else samples[j*w+i]=e.id==='absorber'?Math.abs(model.field(x,z)[0]):Math.sqrt(energyDensity(model.field(x,z),model.epsilon(x,z)));}}
 let hardware='';
 if(e.id==='michelson'){const x=X(10);hardware=`<rect x="${x-10}" y="60" width="20" height="20" fill="#b8d2dc" fill-opacity=".2" stroke="#bbd9de"/>`+line(`M${x-10} 60l20 20M${X(2)} 57v26M${x-13} ${Y(9)}h26`,'stroke-width="3"')+`<rect x="${x-5}" y="6" width="10" height="17" rx="2" fill="#467080"/>`;}
 else if(e.id==='bragg-cavity')for(const l of BRAGG.layers)hardware+=`<rect x="${X(l.a)}" y="6" width="${X(l.d)}" height="128" fill="#a7d4d4" fill-opacity=".12" stroke="#9cbccc" stroke-opacity=".55" stroke-width=".7"/>`;
 else if(e.id==='circulator')hardware=`<ellipse cx="120" cy="70" rx="102" ry="62" fill="none" stroke="#b7cbd8" stroke-opacity=".7" stroke-width="2"/>`;
 else if(e.id==='coupler')for(const x of[-GUIDE.gap/2-GUIDE.width,GUIDE.gap/2])hardware+=`<rect x="0" y="${Y(x)}" width="240" height="${GUIDE.width/(2*e.half)*h}" fill="#9dd6de" fill-opacity=".06" stroke="#9dd6de" stroke-opacity=".5"/>`;
 else if(e.id==='tunnelling')hardware=line(`M${X(GAP.at)} 0v140M${X(GAP.at+GAP.width)} 0v140`);
 else if(e.id==='grin')hardware=`<rect width="240" height="140" fill="#aadbe4" fill-opacity=".035" stroke="#a8c6d1" stroke-opacity=".4"/>`;
 else if(e.id==='absorber')hardware=line('M120 4v132','stroke-width="3"')+line('M5 70h45m-8-6 8 6-8 6M235 70h-45m8-6-8 6 8 6');
 else for(const z of(e.id==='phase-microscope'?[20,40,60]:[4,12]))hardware+=`<ellipse cx="${X(z)}" cy="70" rx="7" ry="${z===40?24:60}" fill="#b3d7dc" fill-opacity=".08" stroke="#a3c6d1" stroke-opacity=".65"/>`;
 const pw=90,ph=90,values=new Float32Array(pw*ph),plane=spectral?benchPlane(spectral,e.id==='phase-microscope'?80:e.z):null,extent=e.half/(e.id==='phase-microscope'?1.6:e.id==='michelson'?3:1);
 for(let j=0;j<ph;j++)for(let i=0;i<pw;i++){const x=(i/(pw-1)*2-1)*extent,y=(1-j/(ph-1)*2)*extent;let v=0;if(spectral){const ix=Math.round(x*spectral.n/spectral.length+spectral.n/2),iy=Math.round(y*spectral.n/spectral.length+spectral.n/2),p=iy*spectral.n+ix;v=Math.hypot(plane[0].re[p],plane[0].im[p]);}else if(Math.abs(y)<e.viewHeight)v=Math.sqrt(energyDensity(model.field(x,e.z),model.epsilon(x,e.z)));values[j*pw+i]=v;}
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="184" viewBox="0 0 320 184"><g transform="matrix(.73 -.12 .2 .58 5 58)"><image href="${color(samples,w,h)}" width="240" height="140"/>${hardware}${line('M0 140h240')}</g><path d="M211 65l14-23v102l-14-9z" fill="#74a7b6" fill-opacity=".08"/><image href="${color(values,pw,ph)}" x="225" y="42" width="90" height="102"/><path d="M225 42h90v102h-90z" fill="none" stroke="#94b4c2" stroke-opacity=".25"/></svg>`;
 await writeFile(`assets/previews/${e.id}.svg`,svg);console.log('Instrument preview',e.id);
}
