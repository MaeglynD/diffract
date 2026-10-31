import {fft2,TAU} from './physics.js';

// A smooth, explicitly defined image amplitude. No image is pasted on the detector.
const ellipse=(x,y,cx,cy,a,b,angle=0)=>{const c=Math.cos(angle),s=Math.sin(angle),dx=x-cx,dy=y-cy;return Math.hypot((c*dx+s*dy)/a,(-s*dx+c*dy)/b)-1;};
export function rabbitTarget(x,y){
 const d=Math.min(ellipse(x,y,-1.2,-1.7,3.6,2.6),ellipse(x,y,-3,-2.7,2.6,2.1),ellipse(x,y,1.8,.9,2.05,1.9),ellipse(x,y,3.3,.45,1.15,.8),ellipse(x,y,.8,4.1,.76,2.9,.16),ellipse(x,y,2.8,4.25,.70,2.8,-.16),ellipse(x,y,-5,-.6,1.12,1.12),ellipse(x,y,1.4,-3.8,2.3,.72));
 const edge=1/(1+Math.exp(Math.max(-40,Math.min(40,d*25)))),eye=1-Math.exp(-((x-2.55)**2+(y-1.35)**2)/.39);
 return edge*eye;
}
let mask;
function prepare(){
 if(mask)return mask;
 const n=256,length=64,dx=length/n,re=new Float64Array(n*n),im=new Float64Array(n*n);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++)re[j*n+i]=rabbitTarget((i-n/2)*dx,(j-n/2)*dx);
 fft2(re,im,n);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const qx=(i<n/2?i:i-n)/length,qy=(j<n/2?j:j-n)/length,q=Math.hypot(qx,qy),at=j*n+i;
  if(q>=.5){re[at]=im[at]=0;continue;}
  const w=q<.42?1:.5*(1+Math.cos(Math.PI*(q-.42)/.08)),p=-TAU*(Math.sqrt(1-q*q)-1)*24,c=Math.cos(p)*w,s=Math.sin(p)*w,r=re[at],t=im[at];re[at]=r*c-t*s;im[at]=r*s+t*c;
 }
 fft2(re,im,n,true);let maximum=0;
 for(let j=80;j<=176;j++)for(let i=80;i<=176;i++)maximum=Math.max(maximum,Math.hypot(re[j*n+i],im[j*n+i]));
 mask={n,dx,re,im,scale:1/maximum};return mask;
}
export function rabbitTransmission(x,y){
 const edge=Math.max(Math.abs(x),Math.abs(y));if(edge>=12)return[0,0];
 const {n,dx,re,im,scale}=prepare(),px=x/dx+n/2,py=y/dx+n/2,ix=Math.floor(px),iy=Math.floor(py),u=px-ix,v=py-iy,a=iy*n+ix,b=a+n;
 const taper=edge<10.8?1:.5*(1+Math.cos(Math.PI*(edge-10.8)/1.2));
 const sample=d=>((d[a]*(1-u)+d[a+1]*u)*(1-v)+(d[b]*(1-u)+d[b+1]*u)*v)*scale*taper;
 return[sample(re),sample(im)];
}
