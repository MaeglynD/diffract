import {fft2,TAU} from './physics.js';

const N=256,LENGTH=64,DX=LENGTH/N;
const masks=new Map();
let j0;
export function besselJ0(x){if(!j0){j0=new Float64Array(12001);for(let i=0;i<j0.length;i++){let sum=0;for(let k=0;k<128;k++)sum+=Math.cos(i*.0025*Math.sin(TAU*k/128));j0[i]=sum/128;}}const p=Math.min(j0.length-1.000001,Math.abs(x)/.0025),i=Math.floor(p),t=p-i;return j0[i]*(1-t)+j0[i+1]*t;}
export function healingLaunch(x,y){const r=Math.hypot(x,y);return[r<12?besselJ0(TAU*.30*r)*Math.exp(-((r/10)**8)):0,0];}
export function transfer(re,im,z,n=N,length=LENGTH){
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const qx=(i<n/2?i:i-n)/length,qy=(j<n/2?j:j-n)/length,q=Math.hypot(qx,qy),at=j*n+i;
  if(q>=.62){re[at]=im[at]=0;continue;}
  const w=q<=.5?1:.5*(1+Math.cos(Math.PI*(q-.5)/.12)),p=TAU*(Math.sqrt(1-q*q)-1)*z,c=Math.cos(p)*w,s=Math.sin(p)*w,a=re[at],b=im[at];re[at]=a*c-b*s;im[at]=a*s+b*c;
 }
}
export function normalize(re,im,radius=18){let maximum=0;for(let j=0;j<N;j++)for(let i=0;i<N;i++)if(Math.hypot((i-N/2)*DX,(j-N/2)*DX)<radius)maximum=Math.max(maximum,Math.hypot(re[j*N+i],im[j*N+i]));return{re,im,scale:1/maximum,radius};}
export function sampleMask(mask,x,y){
 const r=Math.hypot(x,y),{re,im,scale,radius}=mask;if(r>=radius)return[0,0];
 const px=x/DX+N/2,py=y/DX+N/2,i=Math.floor(px),j=Math.floor(py),u=px-i,v=py-j,at=j*N+i;
 const taper=r<radius-1.5?1:.5*(1+Math.cos(Math.PI*(r-radius+1.5)/1.5));
 const atPoint=d=>((d[at]*(1-u)+d[at+1]*u)*(1-v)+(d[at+N]*(1-u)+d[at+N+1]*u)*v)*scale*taper;
 return[atPoint(re),atPoint(im)];
}
export const KNOTS={
 trefoil:{waist:2.2,center:22,radial:[1.51,-5.06,7.23,-2.03],azimuth:-3.97,charge:3},
 hopf:{waist:2.0,center:22,radial:[2.63,-6.32,4.21],azimuth:-5.95,charge:2}
};
export function knotWaist(id,x,y){
 const {waist,radial,azimuth,charge}=KNOTS[id],X=x/waist,Y=y/waist,r2=X*X+Y*Y,g=Math.exp(-r2/2);
 const laguerre=[1,1-r2,1-2*r2+r2*r2/2,1-3*r2+1.5*r2*r2-r2*r2*r2/6];
 let re=0;for(let p=0;p<radial.length;p++)re+=radial[p]*laguerre[p];
 const a=azimuth*Math.pow(r2,charge/2)/Math.sqrt(charge===3?6:2),phase=charge*Math.atan2(Y,X);
 return[g*(re+a*Math.cos(phase)),g*a*Math.sin(phase)];
}
export function prepareKnot(id){
 if(masks.has(id))return masks.get(id);const re=new Float64Array(N*N),im=new Float64Array(N*N);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const f=knotWaist(id,(i-N/2)*DX,(j-N/2)*DX);re[j*N+i]=f[0];im[j*N+i]=f[1];}
 fft2(re,im,N);transfer(re,im,-KNOTS[id].center);fft2(re,im,N,true);const mask=normalize(re,im,14);masks.set(id,mask);return mask;
}
export function creativeTransmission(id,x,y){return sampleMask(prepareKnot(id),x,y);}
