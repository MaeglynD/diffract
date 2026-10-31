import {fft2,modeVector,TAU as K} from './physics.js';
import {HEADER_BYTES,fromHalf,toHalf} from './volume-data.js';
import {SpectralVolume} from './spectral-volume.js';

export const MICROSCOPE={f:20,aperture:10,dot:.85};
export const ETALON={a:4,b:12,R:.88};
export const CELLS=[[-3.7,1.7,2.5,1.65,.35],[1.6,3,2.2,1.55,-.6],[3,-2.7,2.6,1.8,.6],[-2.6,-3,2.2,1.4,-.3]];
export function specimenPhase(x,y){let p=0;for(const[cx,cy,a,b,t]of CELLS){const u=(x-cx)*Math.cos(t)+(y-cy)*Math.sin(t),v=-(x-cx)*Math.sin(t)+(y-cy)*Math.cos(t),r=(u/a)**2+(v/b)**2;p+=.85*Math.exp(-(r**2))+.35*Math.exp(-((u-.35)**2+(v+.1)**2)/.35);}return p;}
export function etalonMode(qz,R=ETALON.R,L=ETALON.b-ETALON.a){const r=Math.sqrt(R),t=Math.sqrt(1-R),p=2*K*qz*L,dr=1-R*Math.cos(p),di=-R*Math.sin(p),d=dr*dr+di*di,a=[t*dr/d,-t*di/d],b=[r*(a[0]*Math.cos(p)-a[1]*Math.sin(p)),r*(a[0]*Math.sin(p)+a[1]*Math.cos(p))],c=K*qz*L,trans=[t*(a[0]*Math.cos(c)-a[1]*Math.sin(c)),t*(a[0]*Math.sin(c)+a[1]*Math.cos(c))],ref=[-r+t*b[0],t*b[1]];return{a,b,trans,ref,T:trans[0]**2+trans[1]**2,R:ref[0]**2+ref[1]**2};}
function bandlimit(re,im,n,length){for(let j=0;j<n;j++)for(let i=0;i<n;i++){const q=Math.hypot(i<n/2?i:i-n,j<n/2?j:j-n)/length,w=q<.52?1:q>.65?0:.5+.5*Math.cos(Math.PI*(q-.52)/.13),p=j*n+i;re[p]*=w;im[p]*=w;}}
function advance(re,im,n,length,dz){const r=re.slice(),t=im.slice();for(let j=0;j<n;j++)for(let i=0;i<n;i++){const p=j*n+i,q2=((i<n/2?i:i-n)**2+(j<n/2?j:j-n)**2)/length**2;if(q2>=1){r[p]=t[p]=0;continue;}const a=K*(Math.sqrt(1-q2)-1)*dz,c=Math.cos(a),s=Math.sin(a);r[p]=re[p]*c-im[p]*s;t[p]=re[p]*s+im[p]*c;}fft2(r,t,n,true);return[r,t];}
// The etalon's retained spectrum occupies only |m| < 21 in a 32λ window.
// A 128 transform represents those same modes exactly, at the output's 0.25λ
// spacing; a 256 transform only oversamples an identical band-limited field.
export function prepareSpectralBench(id,n=id==='fabry-perot'?128:256){
 const difference=id.endsWith('-bright');id=id.replace('-bright','');
 const length=id==='phase-microscope'?64:32,size=n*n,regions=[];
 let re=new Float64Array(size),im=new Float64Array(size);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=(i-n/2)*length/n,y=(j-n/2)*length/n,p=j*n+i,amplitude=Math.exp(-(x*x+y*y)/(id==='phase-microscope'?110:3.24)),phase=id==='phase-microscope'?specimenPhase(x,y):0;re[p]=amplitude*Math.cos(phase);im[p]=amplitude*Math.sin(phase);}
 fft2(re,im,n);bandlimit(re,im,n,length);
 const region=(z,r,t,backR=null,backI=null)=>{const data=new Float32Array(size*4);for(let p=0;p<size;p++){data[p*4]=r[p];data[p*4+1]=t[p];data[p*4+2]=backR?.[p]||0;data[p*4+3]=backI?.[p]||0;}regions.push({z,data});};
 if(id==='phase-microscope'){
  region(0,re,im);let previous=0;
  for(const z of[20,40,60]){[re,im]=advance(re,im,n,length,z-previous);for(let j=0;j<n;j++)for(let i=0;i<n;i++){const p=j*n+i,x=(i-n/2)*length/n,y=(j-n/2)*length/n,r=Math.hypot(x,y),phase=z===40?(!difference&&r<MICROSCOPE.dot?Math.PI/2:0):-K*r*r/(2*MICROSCOPE.f),amp=z===40?(!difference&&r<MICROSCOPE.dot?.55:1):(r<MICROSCOPE.aperture?1:0),a=re[p],b=im[p];re[p]=amp*(a*Math.cos(phase)-b*Math.sin(phase));im[p]=amp*(a*Math.sin(phase)+b*Math.cos(phase));}fft2(re,im,n);bandlimit(re,im,n,length);region(z,re,im);previous=z;}
 }else{
  for(const z of[0,ETALON.a,ETALON.b]){const fR=new Float64Array(size),fI=new Float64Array(size),bR=new Float64Array(size),bI=new Float64Array(size);
   for(let j=0;j<n;j++)for(let i=0;i<n;i++){const p=j*n+i,q2=((i<n/2?i:i-n)**2+(j<n/2?j:j-n)**2)/length**2;if(q2>=.65**2)continue;const q=Math.sqrt(1-q2),m=etalonMode(q),phase=K*((q-1)*z),c=Math.cos(phase),s=Math.sin(phase);let f,b;
    if(z===0){f=[1,0];const a=2*K*q*ETALON.a;b=[m.ref[0]*Math.cos(a)-m.ref[1]*Math.sin(a),m.ref[0]*Math.sin(a)+m.ref[1]*Math.cos(a)];}
    else if(z===ETALON.a){f=m.a;b=m.b;}
    else{const a=-K*q*(ETALON.b-ETALON.a);f=[m.trans[0]*Math.cos(a)-m.trans[1]*Math.sin(a),m.trans[0]*Math.sin(a)+m.trans[1]*Math.cos(a)];b=[0,0];}
    const ar=re[p]*c-im[p]*s,ai=re[p]*s+im[p]*c;fR[p]=f[0]*ar-f[1]*ai;fI[p]=f[0]*ai+f[1]*ar;bR[p]=b[0]*ar-b[1]*ai;bI[p]=b[0]*ai+b[1]*ar;
   }region(z,fR,fI,bR,bI);
  }
 }
 if(difference){const base=prepareSpectralBench(id,n);for(let r=0;r<regions.length;r++)for(let p=0;p<regions[r].data.length;p++)regions[r].data[p]-=base.regions[r].data[p];}
 return{n,length,regions};
}
// Same vector angular-spectrum relation as the original solver, extended to
// both directions. Backward Ez, Bx and By reverse; Ey and Bz retain their sign.
const initShader=`#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
layout(location=0)out vec4 o0;layout(location=1)out vec4 o1;layout(location=2)out vec4 o2;
uniform sampler2D source;uniform int n;uniform float length,z;
vec2 mul(vec2 a,vec2 b){return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
int reverse(int v){int r=0;for(int bits=n;bits>1;bits>>=1){r=(r<<1)|(v&1);v>>=1;}return r;}
void main(){ivec2 p=ivec2(gl_FragCoord.xy),f=ivec2(reverse(p.x),reverse(p.y));vec4 a=texelFetch(source,f,0);vec2 q=vec2(f.x<n/2?f.x:f.x-n,f.y<n/2?f.y:f.y-n)/length;float qz=sqrt(max(.0001,1.-dot(q,q))),ap=6.283185307179586*(qz-1.)*z,am=6.283185307179586*(-qz-1.)*z;vec2 plus=mul(a.xy,vec2(cos(ap),sin(ap))),minus=mul(a.zw,vec2(cos(am),sin(am))),sum=plus+minus,difference=plus-minus;o0=vec4(sum,difference*(-q.y/qz));o1=vec4(difference*(-(1.-q.x*q.x)/qz),difference*(q.x*q.y/qz));o2=vec4(sum*q.x,0.,0.);}`;
let gpu;const cache=new Map();
async function generateSpectralBenchGpu(e,signal,progress=()=>{}){
 let model=cache.get(e.id);if(!model){model=prepareSpectralBench(e.id);cache.set(e.id,model);}signal?.throwIfAborted();progress(.04);
 gpu??=new SpectralVolume({initShader});const {n,length,regions}=model,gl=gpu.gl;
 const nx=Math.round(2*e.half/.25)+1,ny=nx,nz=Math.round(e.zMax/(e.id==='fabry-perot'?.03:.5))+1,count=nx*ny*4,buffer=new ArrayBuffer(HEADER_BYTES+count*nz*6),out=[0,1,2].map(i=>new Uint16Array(buffer,HEADER_BYTES+i*count*nz*2,count*nz));
 if(gpu.n!==n){gpu.resources.forEach(t=>gpu.release(t));gpu.resources=[gpu.target(n,n),gpu.target(n,n)];gpu.n=n;}
 const sources=regions.map(r=>gpu.texture(n,n,r.data)),batch=16,rows=Math.ceil(ny/2),result=gpu.target(nx,rows*batch,true),pixels=new Uint32Array(nx*rows*batch*4),halves=new Uint16Array(pixels.buffer),stride=nx*rows*8;result.sliceHeight=rows;
 const pack=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);gl.bufferData(gl.PIXEL_PACK_BUFFER,pixels.byteLength*3,gl.STREAM_READ);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
 try{for(let start=0;start<nz;start+=batch){const layers=Math.min(batch,nz-start);for(let iz=start;iz<start+layers;iz++){signal?.throwIfAborted();const z=iz*e.zMax/(nz-1);let region=regions.findLastIndex(r=>z>=r.z-1e-8),current=0;gpu.use(0,gpu.resources[0],[sources[region]],{n,length,z:z-regions[region].z});for(let axis=0;axis<2;axis++)for(let span=1;span<n;span*=2){gpu.use(1,gpu.resources[1-current],gpu.resources[current].textures,{axis,span});current=1-current;}gpu.use(2,result,gpu.resources[current].textures,{n,length,halfWidth:e.half,dimensions:[nx,ny],rowOffset:(iz-start)*rows});}
   await gpu.readBatch(result,pixels,rows,layers,signal,pack);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);for(let c=0;c<3;c++){gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,c*pixels.byteLength,pixels);for(let l=0;l<layers;l++)out[c].set(halves.subarray(l*stride,l*stride+count),(start+l)*count);}gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);progress(.04+.88*(start+layers)/nz);await new Promise(r=>setTimeout(r,0));
  }
  if(gl.getError()!==gl.NO_ERROR)throw Error('Optical-bench GPU reconstruction failed');
  const lookup=Float32Array.from({length:65536},(_,i)=>fromHalf(i)),peaks=[];let maxE=0,maxFlux=0;
  for(let iz=0;iz<nz;iz++){let peak=0;for(let p=iz*count;p<(iz+1)*count;p+=4){let E=0,B=0;for(let c=0;c<4;c++){E+=lookup[out[0][p+c]]**2;B+=lookup[out[1][p+c]]**2;}B+=lookup[out[2][p]]**2+lookup[out[2][p+1]]**2;maxE=Math.max(maxE,Math.sqrt(E));const value=e.energyDensity?(E+B)*.5:-(lookup[out[0][p]]*lookup[out[1][p]]+lookup[out[0][p+1]]*lookup[out[1][p+1]]);peak=Math.max(peak,value);}peaks.push(Number(peak.toPrecision(5)));maxFlux=Math.max(maxFlux,peak);if(iz%12===0){signal?.throwIfAborted();await new Promise(r=>setTimeout(r,0));}}
  const meta={version:2,id:e.id,quality:'full',analytic:true,spectralBench:true,nx,ny,nz,half:e.half,zMax:e.zMax,maxE,maxFlux,peaks,viewHeight:e.half,energyDensity:!!e.energyDensity};const header=new TextEncoder().encode(JSON.stringify(meta));if(header.length>=HEADER_BYTES)throw Error('Bench header exceeds format');new Uint8Array(buffer,0,header.length).set(header);progress(1);return{buffer};
 }finally{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.deleteBuffer(pack);sources.forEach(t=>gl.deleteTexture(t));gpu.release(result);}
}

// The same grid and spectrum remain available when worker WebGL is absent.
// This fallback is slower, but it does not substitute a lower-quality model.
export async function generateSpectralBench(e,signal,progress=()=>{}){
 try{return{...await generateSpectralBenchGpu(e,signal,progress),method:'gpu-optical-bench'};}catch(error){signal?.throwIfAborted();return{...await generateSpectralBenchCpu(e,signal,progress),method:'cpu-optical-bench',fallbackReason:error.message};}
}
export async function generateSpectralBenchCpu(e,signal,progress=()=>{}){
 const model=cache.get(e.id)||prepareSpectralBench(e.id);cache.set(e.id,model);const nx=Math.round(2*e.half/.25)+1,ny=nx,nz=Math.round(e.zMax/(e.id==='fabry-perot'?.03:.5))+1,count=nx*ny*4,buffer=new ArrayBuffer(HEADER_BYTES+count*nz*6),out=[0,1,2].map(i=>new Uint16Array(buffer,HEADER_BYTES+i*count*nz*2,count*nz)),peaks=[];let maxE=0,maxFlux=0;
 for(let iz=0;iz<nz;iz++){signal?.throwIfAborted();const z=iz*e.zMax/(nz-1),f=benchPlane(model,z);let peak=0;for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
  const x=(ix/(nx-1)*2-1)*e.half,y=(iy/(ny-1)*2-1)*e.half,p=Math.round(y*model.n/model.length+model.n/2)*model.n+Math.round(x*model.n/model.length+model.n/2),at=((iz*ny+iy)*nx+ix)*4;let E=0,B=0;
  for(let c=0;c<5;c++){const r=f[c].re[p],s=f[c].im[p],component=c*2;out[Math.floor(component/4)][at+component%4]=toHalf(r);out[Math.floor(component/4)][at+component%4+1]=toHalf(s);if(c<2)E+=r*r+s*s;else B+=r*r+s*s;}
  const flux=-(f[0].re[p]*f[2].re[p]+f[0].im[p]*f[2].im[p]);out[2][at+2]=toHalf(E);out[2][at+3]=toHalf(flux);maxE=Math.max(maxE,Math.sqrt(E));peak=Math.max(peak,e.energyDensity?(E+B)*.5:flux);
 }peaks.push(Number(peak.toPrecision(5)));maxFlux=Math.max(maxFlux,peak);progress((iz+1)/nz);await new Promise(r=>setTimeout(r,0));}
 const meta={version:2,id:e.id,quality:'full',analytic:true,spectralBench:true,nx,ny,nz,half:e.half,zMax:e.zMax,maxE,maxFlux,peaks,viewHeight:e.half,energyDensity:!!e.energyDensity};const bytes=new TextEncoder().encode(JSON.stringify(meta));if(bytes.length>=HEADER_BYTES)throw Error('Bench header exceeds format');new Uint8Array(buffer,0,bytes.length).set(bytes);return{buffer};
}

// Independent CPU reference used by numerical tests and thumbnail generation.
export function benchPlane(model,z){const{n,length,regions}=model,region=regions.findLast(r=>r.z<=z+1e-8),dz=z-region.z,size=n*n,result=Array.from({length:5},()=>({re:new Float64Array(size),im:new Float64Array(size)}));
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const p=j*n+i,qx=(i<n/2?i:i-n)/length,qy=(j<n/2?j:j-n)/length;if(qx*qx+qy*qy>=.65**2)continue;const qz=Math.sqrt(1-qx*qx-qy*qy),v=modeVector(qx,qy),a=K*(qz-1)*dz,b=K*(-qz-1)*dz,fr=region.data[p*4]*Math.cos(a)-region.data[p*4+1]*Math.sin(a),fi=region.data[p*4]*Math.sin(a)+region.data[p*4+1]*Math.cos(a),br=region.data[p*4+2]*Math.cos(b)-region.data[p*4+3]*Math.sin(b),bi=region.data[p*4+2]*Math.sin(b)+region.data[p*4+3]*Math.cos(b);for(let c=0;c<5;c++){const sign=c===0||c===4?1:-1;result[c].re[p]=(fr+sign*br)*v[c];result[c].im[p]=(fi+sign*bi)*v[c];}}
 for(const f of result)fft2(f.re,f.im,n,true);return result;
}
