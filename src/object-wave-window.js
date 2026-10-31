import * as THREE from 'three';
import {toHalf} from './volume-data.js';

// Display crop at the actual sensor-facing surface, in replay coordinates.
// This does not alter the computed field or model material scattering.
export function objectFrontTexture(geometry,n=192,half=28){
 const p=geometry.attributes.position.array,indices=geometry.index.array,depth=new Float32Array(n*n).fill(Infinity);let nearest=Infinity;
 const point=i=>[(-p[i*3+2]/(2*half)+.5)*(n-1),(p[i*3+1]/(2*half)+.5)*(n-1),32+p[i*3]];
 for(let i=0;i<p.length;i+=3)nearest=Math.min(nearest,32+p[i]);
 for(let k=0;k<indices.length;k+=3){
  const a=point(indices[k]),b=point(indices[k+1]),c=point(indices[k+2]),d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-8)continue;
  for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])));y<=Math.min(n-1,Math.ceil(Math.max(a[1],b[1],c[1])));y++)for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])));x<=Math.min(n-1,Math.ceil(Math.max(a[0],b[0],c[0])));x++){
   const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d,w=1-u-v;if(Math.min(u,v,w)>=0)depth[y*n+x]=Math.min(depth[y*n+x],u*a[2]+v*b[2]+w*c[2]);
  }
 }
 const texture=new THREE.DataTexture(Uint16Array.from(depth,z=>toHalf(Number.isFinite(z)?z:nearest)),n,n,THREE.RedFormat,THREE.HalfFloatType);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
