import {imageTarget,IMAGE_DEPTHS,IMAGE_NAMES} from './holographic-scenes.js';
export {IMAGE_DEPTHS,IMAGE_NAMES};
const cache=new Map();
// Contours are design annotations only; detector pixels still sample the field.
export function imageContours(index){
 if(cache.has(index))return cache.get(index);
 const n=97,half=9,step=2*half/(n-1),value=new Float64Array(n*n),segments=[];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++)value[j*n+i]=imageTarget(index,i*step-half,j*step-half)-.38;
 for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){
  const corners=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]],hits=[];
  for(let e=0;e<4;e++){const a=corners[e],b=corners[(e+1)%4],va=value[a[1]*n+a[0]],vb=value[b[1]*n+b[0]];if((va<0)===(vb<0))continue;const t=va/(va-vb);hits.push([(a[0]+t*(b[0]-a[0]))*step-half,(a[1]+t*(b[1]-a[1]))*step-half]);}
  for(let k=0;k+1<hits.length;k+=2)segments.push([hits[k],hits[k+1]]);
 }
 cache.set(index,segments);return segments;
}
export function imageIcon(index){const path=imageContours(index).map(([a,b])=>`M${a[0].toFixed(2)},${(-a[1]).toFixed(2)}L${b[0].toFixed(2)},${(-b[1]).toFixed(2)}`).join('');return `<svg viewBox="-9 -9 18 18" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width=".65" stroke-linecap="round"/></svg>`;}
