/**
 * README artwork, calculated with the application's vector angular spectrum.
 * Requires ImageMagick + FFmpeg only to export resized PNG/GIF files.
 * wordmark.pgm is a committed raster design target, not a detector overlay.
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fft2,TAU,modeVector} from '../src/physics.js';
import {png} from './png.mjs';

const N=512,L=128,focus=72,frames=120,fps=15,width=960,height=400;
const work='artifacts/brand',out='docs/media';
await mkdir(`${work}/frames`,{recursive:true});await mkdir(out,{recursive:true});
const targetFile=await readFile(`${out}/wordmark.pgm`),head=/^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(targetFile.toString('ascii',0,60));
if(!head||+head[1]!==N||+head[2]!==N)throw Error('Expected 512 × 512, 8-bit PGM target');
const target=targetFile.subarray(head[0].length),re=Float64Array.from(target,v=>v/255),im=new Float64Array(N*N),modes=[];
fft2(re,im,N);
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
 const qx=(i<N/2?i:i-N)/L,qy=(j<N/2?j:j-N)/L,q=Math.hypot(qx,qy),at=j*N+i;
 if(q>=.58){re[at]=im[at]=0;continue;}
 const qz=Math.sqrt(1-q*q),window=q<.48?1:.5*(1+Math.cos(Math.PI*(q-.48)/.1));
 const angle=-TAU*(qz-1)*focus,c=Math.cos(angle)*window,s=Math.sin(angle)*window,a=re[at],b=im[at];
 re[at]=a*c-b*s;im[at]=a*s+b*c;modes.push({at,qz,bx:modeVector(qx,qy)[2]});
}
fft2(re,im,N,true);
const taper=(x,inner,outer)=>Math.abs(x)<inner?1:Math.abs(x)>=outer?0:.5*(1+Math.cos(Math.PI*(Math.abs(x)-inner)/(outer-inner)));
let launchMax=0;
for(let j=0;j<N;j++)for(let i=0;i<N;i++){const at=j*N+i,w=taper((i-N/2)*L/N,52,60)*taper((j-N/2)*L/N,40,52);re[at]*=w;im[at]*=w;launchMax=Math.max(launchMax,Math.hypot(re[at],im[at]));}
for(let at=0;at<re.length;at++){re[at]/=launchMax;im[at]/=launchMax;}
fft2(re,im,N);
const er=new Float64Array(N*N),ei=new Float64Array(N*N),br=new Float64Array(N*N),bi=new Float64Array(N*N);
function plane(z){
 er.fill(0);ei.fill(0);br.fill(0);bi.fill(0);
 for(const m of modes){const p=TAU*(m.qz-1)*z,c=Math.cos(p),s=Math.sin(p),at=m.at,a=re[at]*c-im[at]*s,b=re[at]*s+im[at]*c;er[at]=a;ei[at]=b;br[at]=a*m.bx;bi[at]=b*m.bx;}
 fft2(er,ei,N,true);fft2(br,bi,N,true);
 let peak=0,power=0;for(let i=0;i<er.length;i++){const flux=-(er[i]*br[i]+ei[i]*bi[i]);peak=Math.max(peak,flux);power+=flux;}return{peak,power};
}
const reference=plane(focus),targetMean=target.reduce((s,v)=>s+(v/255)**2,0)/target.length;
let observedMean=reference.power/target.length,cov=0,va=0,vb=0;
for(let i=0;i<target.length;i++){const a=(target[i]/255)**2-targetMean,b=-(er[i]*br[i]+ei[i]*bi[i])-observedMean;cov+=a*b;va+=a*a;vb+=b*b;}
const correlation=cov/Math.sqrt(va*vb);
const palette=Array.from({length:256},(_,i)=>{
 const x=i/255,stops=[[.0,[5,13,20]],[.18,[10,43,61]],[.5,[39,119,148]],[.78,[111,212,215]],[1,[224,255,237]]];
 let k=1;while(k<stops.length-1&&x>stops[k][0])k++;const [lo,a]=stops[k-1],[hi,b]=stops[k],t=(x-lo)/(hi-lo);return a.map((v,j)=>Math.round(v+(b[j]-v)*t));
});
const rgba=new Uint8Array(width*height*4),zValues=[];let drift=0;
// A detector excursion from focus and back. The optical field itself is fixed.
for(let frame=0;frame<frames;frame++){
 const z=focus+80*Math.sin(Math.PI*frame/frames)**2;zValues.push(z);
 const stats=plane(z);drift=Math.max(drift,Math.abs(stats.power/reference.power-1));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const gx=(x+.5)/width*N-.5,gy=N/2+(y+.5-height/2)*N/width-.5,ix=(Math.floor(gx)+N)%N,iy=Math.floor(gy),u=gx-Math.floor(gx),v=gy-iy;
  const a=iy*N+ix,b=a+N,c=iy*N+(ix+1)%N,d=c+N,sample=f=>((f[a]*(1-u)+f[c]*u)*(1-v)+(f[b]*(1-u)+f[d]*u)*v);
  const flux=Math.max(0,-(sample(er)*sample(br)+sample(ei)*sample(bi))/reference.peak),value=1-Math.exp(-3.4*Math.pow(flux,.56));
  const rgb=palette[Math.min(255,Math.round(value*255))],at=(y*width+x)*4;rgba[at]=rgb[0];rgba[at+1]=rgb[1];rgba[at+2]=rgb[2];rgba[at+3]=255;
 }
 await writeFile(`${work}/frames/${String(frame).padStart(3,'0')}.png`,png(width,height,rgba));
 if(frame===0)await writeFile(`${out}/diffract-poster.png`,png(width,height,rgba));
 if(frame%20===0)console.log(`Frame ${frame}/${frames}`);
}
function run(command,args){const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:10e6});if(r.error)throw Error(`${command} must be available on PATH.`,{cause:r.error});if(r.status!==0)throw Error(`${command}: ${r.stderr}`);}
run('ffmpeg',['-y','-hide_banner','-loglevel','error','-framerate',String(fps),'-i',`${work}/frames/%03d.png`,'-vf','fps=12,scale=720:300:flags=lanczos,palettegen=max_colors=64:stats_mode=full','-frames:v','1',`${work}/palette64.png`]);
run('ffmpeg',['-y','-hide_banner','-loglevel','error','-framerate',String(fps),'-i',`${work}/frames/%03d.png`,'-i',`${work}/palette64.png`,'-lavfi','[0:v]fps=12,scale=720:300:flags=lanczos[v];[v][1:v]paletteuse=dither=none:diff_mode=rectangle','-loop','0',`${out}/diffract.gif`]);
await import('./bake-brand-assets.mjs');
await writeFile(`${out}/generation.json`,JSON.stringify({method:'Vector angular spectrum; Ey and cBx determine axial flux because Ex = 0',n:N,lengthInWavelengths:L,softNA:.48,maxNA:.58,focusInWavelengths:focus,detectorRange:[focus,focus+80],source:{frames,fps,width,height},gif:{frames:96,fps:12,width:720,height:300,colors:64},fluxTargetCorrelation:correlation,maxRelativePowerDrift:drift,display:'Fixed exposure, cyan luminance map; no target image composited into frames'},null,2)+'\n');
if(correlation<.96||drift>1e-10)throw Error(`Artwork validation failed: correlation=${correlation}, drift=${drift}`);
console.log(`Banner: correlation=${correlation.toFixed(5)}, power drift=${drift.toExponential(2)}`);
