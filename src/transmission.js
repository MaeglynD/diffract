import {boundary,maskHalf as plateHalf} from './experiments.js';
export const phaseColour=p=>[.55+.43*Math.cos(p),.55+.43*Math.cos(p+2.094395),.55+.43*Math.cos(p+4.18879)];
export function transmissionPixels(e,n=256){
 const h=plateHalf(e),data=new Uint8ClampedArray(n*n*4),mask=new Uint8Array(n*n),phasePlate=e.kind==='phase'||e.kind==='axicon';
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=(i/(n-1)*2-1)*h,y=(1-j/(n-1)*2)*h,f=boundary(e.id,x,y),amp=Math.hypot(...f),phase=Math.atan2(f[1],f[0]),at=(j*n+i)*4;mask[j*n+i]=amp>.13?1:0;
  if(phasePlate&&amp>.008){const c=phaseColour(phase),brightness=.3+.7*Math.min(1,Math.sqrt(amp));data.set(c.map(v=>Math.round(v*255*brightness)).concat(245),at);}
  else data.set(amp>.13?[205,245,248,0]:[26,43,55,245],at);
 }
 return{data,mask,phasePlate,h};
}
// A neutral engraved appearance for the scene. The information view retains the
// cyclic false-colour phase legend; neither texture supplies the propagated field.
export function surfacePixels(e,n=384){
 const sampled=transmissionPixels(e,n);if(!sampled.phasePlate){
  for(let j=0;j<n;j++)for(let i=0;i<n;i++)if(!sampled.mask[j*n+i]){
   const edge=(i&&sampled.mask[j*n+i-1])||(i<n-1&&sampled.mask[j*n+i+1])||(j&&sampled.mask[(j-1)*n+i])||(j<n-1&&sampled.mask[(j+1)*n+i]);
   sampled.data.set(edge?[218,231,235,255]:[126,148,160,255],(j*n+i)*4);
  }return sampled;
 }
 const h=plateHalf(e),data=sampled.data;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const f=boundary(e.id,(i/(n-1)*2-1)*h,(1-j/(n-1)*2)*h),a=Math.hypot(...f),p=Math.atan2(f[1],f[0]),at=(j*n+i)*4;
  const cycle=((p/(2*Math.PI)+.5)*7)%1,trace=Math.exp(-(((cycle-.5)/.07)**2)),amplitude=Math.min(1,Math.sqrt(a));
  if(a<.008)data.set([21,38,49,235],at);else data.set([72+57*trace,128+61*trace,151+62*trace,18+58*(1-amplitude)+122*trace],at);
 }return sampled;
}
