import {boundary,maskHalf} from './experiments.js';

// A wrapped relief of index contrast 0.5: k Δn h = arg(T) + π.
// The constant π offset has no effect on diffraction. Attenuation is separate.
export function phaseHeight(re,im){return (Math.atan2(im,re)+Math.PI)/Math.PI;}
export function buildRelief(e,n=257){
 if(e.id==='autofocus')return radialRelief(e);
 const h=maskHalf(e),positions=new Float32Array(n*n*3),amplitudes=new Float32Array(n*n),indices=[];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=(i/(n-1)*2-1)*h,y=(j/(n-1)*2-1)*h,[re,im]=boundary(e.id,x,y),p=j*n+i;
  positions.set([-.2-phaseHeight(re,im),y,-x],p*3);amplitudes[p]=Math.hypot(re,im);
 }
 for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){
  const a=j*n+i,b=a+1,c=a+n,d=c+1;
  if(Math.min(amplitudes[a],amplitudes[b],amplitudes[c],amplitudes[d])>.008)indices.push(a,c,b,b,c,d);
 }
 return{positions,amplitudes,indices:Uint32Array.from(indices)};
}
// Polar tessellation keeps the circular binary-phase steps circular, rather
// than exposing the Cartesian sampling grid as teeth around each annulus.
function radialRelief(e){
 const nr=640,nt=256,positions=new Float32Array((nr+1)*(nt+1)*3),amplitudes=new Float32Array((nr+1)*(nt+1)),indices=[],heights=[];
 for(let j=0;j<=nr;j++){const r=e.radius*j/nr,[re,im]=boundary(e.id,r,0),height=phaseHeight(re,im),a=Math.hypot(re,im);heights.push(height);for(let i=0;i<=nt;i++){const t=i/nt*Math.PI*2,p=j*(nt+1)+i;positions.set([-.2-height,r*Math.sin(t),-r*Math.cos(t)],p*3);amplitudes[p]=a;}}
 for(let j=0;j<nr;j++){if(Math.abs(heights[j+1]-heights[j])>.5)continue;for(let i=0;i<nt;i++){const a=j*(nt+1)+i,b=a+1,c=a+nt+1,d=c+1;if(Math.min(amplitudes[a],amplitudes[c])>.008)indices.push(a,c,b,b,c,d);}}
 return{positions,amplitudes,indices:Uint32Array.from(indices)};
}
// Equivalent unwrapped focusing profile (Δn=.5), up to a constant phase.
export function forkLensHeight(r){return .1+(100-r*r)/32;}
