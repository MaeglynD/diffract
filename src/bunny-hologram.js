import {fft2,TAU} from './physics.js';
import {BUNNY_SURFACE} from './bunny-surface.js';

// Layer-based, coherent, three-dimensional CGH. All depths come from the mesh.
// Sources have fixed deterministic phases; there is no temporal speckle averaging.
let prepared;
export function prepareBunnyHologram(points=BUNNY_SURFACE){
 if(points===BUNNY_SURFACE&&prepared)return prepared;
 const n=256,length=64,dx=length/n,size=n*n,dz=.5,layers=new Map(),sigma=.40;
 for(const[x,y,z,weight,phase]of points){
  const f=z/dz,iz=Math.floor(f),tz=f-iz;
  for(let oz=0;oz<2;oz++){const mix=oz?tz:1-tz;if(mix<1e-6)continue;const layer=iz+oz;if(!layers.has(layer))layers.set(layer,[new Float64Array(size),new Float64Array(size)]);const [re,im]=layers.get(layer),cx=x/dx+n/2,cy=y/dx+n/2;
   for(let j=Math.floor(cy)-5;j<=Math.ceil(cy)+5;j++)for(let i=Math.floor(cx)-5;i<=Math.ceil(cx)+5;i++){if(i<0||j<0||i>=n||j>=n)continue;const g=weight*mix*Math.exp(-((i-cx)**2+(j-cy)**2)*dx*dx/(2*sigma*sigma)),at=j*n+i;re[at]+=g*Math.cos(phase);im[at]+=g*Math.sin(phase);}
  }
 }
 const re=new Float64Array(size),im=new Float64Array(size);
 for(const[layer,[a,b]]of layers){
  fft2(a,b,n);const z=layer*dz;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const qx=(i<n/2?i:i-n)/length,qy=(j<n/2?j:j-n)/length,q=Math.hypot(qx,qy),at=j*n+i;if(q>=.62)continue;const w=q<=.5?1:.5*(1+Math.cos(Math.PI*(q-.5)/.12)),phase=-TAU*(Math.sqrt(1-q*q)-1)*z,c=Math.cos(phase)*w,s=Math.sin(phase)*w;re[at]+=a[at]*c-b[at]*s;im[at]+=a[at]*s+b[at]*c;}
 }
 fft2(re,im,n,true);let maximum=0;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++)if(Math.hypot((i-n/2)*dx,(j-n/2)*dx)<18)maximum=Math.max(maximum,Math.hypot(re[j*n+i],im[j*n+i]));
 const result={n,dx,re,im,scale:1/maximum,layers:layers.size};if(points===BUNNY_SURFACE)prepared=result;return result;
}
export function bunnyTransmission(x,y){
 const r=Math.hypot(x,y);if(r>=18)return[0,0];const {n,dx,re,im,scale}=prepareBunnyHologram(),px=x/dx+n/2,py=y/dx+n/2,ix=Math.floor(px),iy=Math.floor(py),u=px-ix,v=py-iy,at=iy*n+ix;
 const taper=r<16.5?1:.5*(1+Math.cos(Math.PI*(r-16.5)/1.5));
 const sample=data=>((data[at]*(1-u)+data[at+1]*u)*(1-v)+(data[at+n]*(1-u)+data[at+n+1]*u)*v)*scale*taper;
 return[sample(re),sample(im)];
}
