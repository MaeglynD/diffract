import {fft2,TAU} from './physics.js';
import {transfer,normalize,sampleMask} from './creative-fields.js';

const N=256,L=64,DX=.25,SIZE=N*N,cache=new Map();
const gauss=(d,w)=>Math.exp(-d*d/(2*w*w));
const segment=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
export const IMAGE_DEPTHS=[16,40,64];
export const IMAGE_NAMES=['Jellyfish','Nautilus','Butterfly'];
export function imageTarget(index,x,y){
 index=2-index;
 if(index===0){
  const X=Math.abs(x),u=X-3.7,v=y-2.5;
  // Separate the four wings by more than a diffraction-limited spot. A broad
  // diagonal upper pair and tapered lower pair survive propagation at 64λ.
  const upper=Math.hypot((u*.78+v*.625)/3.5,(-u*.625+v*.78)/1.65);
  const lower=Math.hypot((X-2.85)/1.8,(y+3.15)/2.25);
  let a=.83*Math.exp(-(Math.min(upper,lower)**8)*.8);
  a=Math.max(a,gauss(x,.48)*Math.exp(-((y/3.8)**8)));
  for(const side of[-1,1])a=Math.max(a,.8*gauss(segment(x,y,[side*.25,2.8],[side*1.6,5.8]),.28));return a;
 }
 if(index===1){
  const xx=x+.6,yy=y-.1,r=Math.hypot(xx,yy),angle=Math.atan2(yy,xx);let d=100;
  // A resolved logarithmic shell, with broad spiral arms at this wavelength.
  for(let turn=-1;turn<3;turn++){const t=angle+TAU*turn;if(t<0||t>TAU*1.35)continue;const R=.95*Math.exp(.245*t);d=Math.min(d,Math.abs(r-R));}
  return gauss(d,.55);
 }
 const cap=Math.hypot(x/4.9,(y-1.3)/3.2),edge=gauss(cap-1,.12)/(1+Math.exp(-(y-1.1)*8));
 let a=Math.max(edge,.65*Math.exp(-(cap**8))/(1+Math.exp(-(y-1.1)*8)),.8*gauss(y-1.3,.35)*Math.exp(-((x/4.85)**12)));
 for(let j=-1;j<=1;j++){const t=(1.3-y)/7;if(t>=0&&t<=1){const X=j*2.5+.55*Math.sin(t*7+j);a=Math.max(a,.9*gauss(x-X,.48)*(1-.3*t));}}
 return a;
}
export function prepareDepthHologram(iterations=200){
 if(cache.has('metamorphosis'))return cache.get('metamorphosis');
 const targets=IMAGE_DEPTHS.map(()=>new Float64Array(SIZE)),window=new Float64Array(SIZE);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=(i-N/2)*DX,y=(j-N/2)*DX,at=j*N+i,r=Math.max(Math.abs(x),Math.abs(y));window[at]=r<8.5?1:r<10?.5*(1+Math.cos(Math.PI*(r-8.5)/1.5)):0;for(let k=0;k<3;k++)targets[k][at]=imageTarget(k,x,y);}
 // Equal target powers prevent the broad butterfly from dominating the lines.
 const powers=targets.map(t=>t.reduce((s,a)=>s+a*a,0));for(let k=0;k<3;k++){const scale=Math.sqrt(powers[0]/powers[k]);for(let i=0;i<SIZE;i++)targets[k][i]*=scale;}
 let re=new Float64Array(SIZE),im=new Float64Array(SIZE);
 for(let k=0;k<3;k++){const a=targets[k].slice(),b=new Float64Array(SIZE);for(let j=0;j<N;j++)for(let i=0;i<N;i++){const at=j*N+i,x=(i-N/2)*DX,y=(j-N/2)*DX,p=.7*Math.sin(x*1.4+k)+.7*Math.cos(y*1.3-k);b[at]=a[at]*Math.sin(p);a[at]*=Math.cos(p);}fft2(a,b,N);transfer(a,b,-IMAGE_DEPTHS[k]);fft2(a,b,N,true);for(let i=0;i<SIZE;i++){re[i]+=a[i]/3;im[i]+=b[i]/3;}}
 for(let it=0;it<iterations;it++){
  const spectrumRe=re.slice(),spectrumIm=im.slice();fft2(spectrumRe,spectrumIm,N);const correctionRe=new Float64Array(SIZE),correctionIm=new Float64Array(SIZE);
  for(let k=0;k<3;k++){
   const a=spectrumRe.slice(),b=spectrumIm.slice();transfer(a,b,IMAGE_DEPTHS[k]);fft2(a,b,N,true);
   for(let i=0;i<SIZE;i++){const amp=Math.hypot(a[i],b[i]),factor=window[i]*(targets[k][i]/Math.max(amp,1e-9)-1);a[i]*=factor;b[i]*=factor;}
   fft2(a,b,N);transfer(a,b,-IMAGE_DEPTHS[k]);fft2(a,b,N,true);for(let i=0;i<SIZE;i++){correctionRe[i]+=a[i]/3;correctionIm[i]+=b[i]/3;}
  }
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const at=j*N+i,r=Math.hypot((i-N/2)*DX,(j-N/2)*DX),pupil=r<22.5?1:r<24?.5*(1+Math.cos(Math.PI*(r-22.5)/1.5)):0;re[at]=(re[at]+1.1*correctionRe[at])*pupil;im[at]=(im[at]+1.1*correctionIm[at])*pupil;}
 }
 const result=normalize(re,im,24);cache.set('metamorphosis',result);return result;
}
export function saturnCurves(){
 const curves=[];
 for(let axis=0;axis<3;axis++){const p=[];for(let i=0;i<240;i++){const t=TAU*i/240,a=6.6*Math.cos(t),b=6.6*Math.sin(t);p.push(axis===0?[a,b,40]:axis===1?[a,0,40+b]:[0,a,40+b]);}curves.push(p);}
 for(const r of[11,13]){const p=[];for(let i=0;i<360;i++){const t=TAU*i/360;p.push([r*Math.cos(t),r*.45*Math.sin(t),40+r*.893*Math.sin(t)]);}curves.push(p);}
 return curves;
}
export function prepareSaturn(){
 if(cache.has('saturn'))return cache.get('saturn');const layers=new Map(),sigma=.6;
 for(const[curveIndex,curve]of saturnCurves().entries())for(let j=0;j<curve.length;j++){
  const[x,y,z]=curve[j],next=curve[(j+1)%curve.length],weight=Math.hypot(next[0]-x,next[1]-y,next[2]-z),phase=TAU*6*j/curve.length+curveIndex*.8,iz=Math.floor(z*2),tz=z*2-iz;
  for(let dz=0;dz<2;dz++){const k=iz+dz,mix=dz?tz:1-tz;if(!layers.has(k))layers.set(k,[new Float64Array(SIZE),new Float64Array(SIZE)]);const[a,b]=layers.get(k),cx=x/DX+N/2,cy=y/DX+N/2;for(let v=Math.floor(cy)-6;v<=Math.ceil(cy)+6;v++)for(let u=Math.floor(cx)-6;u<=Math.ceil(cx)+6;u++){const at=v*N+u,g=weight*mix*Math.exp(-((u-cx)**2+(v-cy)**2)*DX*DX/(2*sigma*sigma));a[at]+=g*Math.cos(phase);b[at]+=g*Math.sin(phase);}}
 }
 const re=new Float64Array(SIZE),im=new Float64Array(SIZE);
 for(const[k,[a,b]]of layers){fft2(a,b,N);transfer(a,b,-k/2);for(let i=0;i<SIZE;i++){re[i]+=a[i];im[i]+=b[i];}}
 fft2(re,im,N,true);
 // Constrain sections of the complete volume, rather than only adding point
 // foci. This suppresses the coherent background between the desired curves.
 const depths=Array.from({length:15},(_,i)=>26+i*2),curves=saturnCurves().flat(),targets=depths.map(z=>{
  const a=new Float64Array(SIZE);for(const[x,y,Z]of curves){const dz=z-Z;if(Math.abs(dz)>2.8)continue;const cx=x/DX+N/2,cy=y/DX+N/2;for(let j=Math.floor(cy)-7;j<=cy+7;j++)for(let i=Math.floor(cx)-7;i<=cx+7;i++){const at=j*N+i,g=Math.exp(-(((i-cx)*DX)**2+((j-cy)*DX)**2+dz*dz*.22)/(2*.85**2));a[at]=Math.max(a[at],g);}}return a;
 });
 let maximum=0;for(let i=0;i<SIZE;i++)maximum=Math.max(maximum,Math.hypot(re[i],im[i]));for(let i=0;i<SIZE;i++){re[i]/=maximum;im[i]/=maximum;}
 for(let iteration=0;iteration<55;iteration++){
  const sr=re.slice(),si=im.slice();fft2(sr,si,N);const cr=new Float64Array(SIZE),ci=new Float64Array(SIZE);
  for(let k=0;k<depths.length;k++){
   const a=sr.slice(),b=si.slice();transfer(a,b,depths[k]);fft2(a,b,N,true);
   for(let j=0;j<N;j++)for(let i=0;i<N;i++){const at=j*N+i,r=Math.hypot((i-N/2)*DX,(j-N/2)*DX),w=r<15?1:r<17?(17-r)/2:0,amp=Math.hypot(a[at],b[at]),factor=w*(targets[k][at]/Math.max(amp,1e-9)-1);a[at]*=factor;b[at]*=factor;}
   fft2(a,b,N);transfer(a,b,-depths[k]);fft2(a,b,N,true);for(let i=0;i<SIZE;i++){cr[i]+=a[i]/depths.length;ci[i]+=b[i]/depths.length;}
  }
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const at=j*N+i,r=Math.hypot((i-N/2)*DX,(j-N/2)*DX),p=r<22.5?1:r<24?.5*(1+Math.cos(Math.PI*(r-22.5)/1.5)):0;re[at]=(re[at]+1.3*cr[at])*p;im[at]=(im[at]+1.3*ci[at])*p;}
 }
 const result=normalize(re,im,24);cache.set('saturn',result);return result;
}
export function holographicTransmission(id,x,y){return sampleMask(id==='saturn'?prepareSaturn():prepareDepthHologram(),x,y);}
