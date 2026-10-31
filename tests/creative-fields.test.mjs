import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {decodeVolume,sampleField,normalizedFlux,axialIndex} from '../src/volume-data.js';
import {IMAGE_DEPTHS,imageTarget,saturnCurves} from '../src/holographic-scenes.js';
import {buildSpectrum,GRID} from '../src/experiments.js';
import {propagate,sampleComplex,fluxZ} from '../src/physics.js';

async function volume(id,preview=false){const b=gunzipSync(await readFile(new URL(`../assets/fields/${id}${preview?'.preview':''}.bin.gz`,import.meta.url)));return decodeVolume(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
function correlation(a,b){const ma=a.reduce((s,v)=>s+v,0)/a.length,mb=b.reduce((s,v)=>s+v,0)/b.length;let ab=0,aa=0,bb=0;for(let i=0;i<a.length;i++){ab+=(a[i]-ma)*(b[i]-mb);aa+=(a[i]-ma)**2;bb+=(b[i]-mb)**2;}return ab/Math.sqrt(aa*bb);}
// Independent oriented segment crossings of a generic planar projection.
function crossings(a,b,self=false){const out=[];for(let i=0;i<a.length;i++){const A=a[i],B=a[(i+1)%a.length],ax=B[0]-A[0],ay=B[1]-A[1];for(let j=self?i+2:0;j<b.length;j++){if(self&&i===0&&j===b.length-1)continue;const C=b[j],D=b[(j+1)%b.length],bx=D[0]-C[0],by=D[1]-C[1],d=ax*by-ay*bx;if(Math.abs(d)<1e-10)continue;const cx=C[0]-A[0],cy=C[1]-A[1],u=(cx*by-cy*bx)/d,t=(cx*ay-cy*ax)/d;if(u>0&&u<1&&t>0&&t<1){const za=A[2]+u*(B[2]-A[2]),zb=C[2]+t*(D[2]-C[2]);assert.ok(Math.abs(za-zb)>.1,'projection crossings must be separated in 3D');out.push(Math.sign(d)*Math.sign(za-zb));}}}return out;}

test('extracted electric-component zeros form a trefoil and a Hopf link, rather than imposed guide curves',async()=>{
 for(const id of['trefoil','hopf']){
  const {lines}=JSON.parse(await readFile(new URL(`../assets/topology/${id}.json`,import.meta.url))),v=await volume(id);assert.ok(lines.every(l=>l.closed));assert.equal(lines.length,id==='trefoil'?1:2);
  let energy=0,n=0;for(const l of lines)for(const[x,y,z]of l.points){const f=sampleField(v,x,y,z),residual=Math.hypot(f[0],f[1])/v.maxE;assert.ok(residual<.002,`${id}: annotation is not on a field zero`);energy+=residual**2;n++;}
  assert.ok(Math.sqrt(energy/n)<.0005);
  const paths=lines.map(l=>l.points.filter((p,j)=>j%4===0)),cross=id==='trefoil'?crossings(paths[0],paths[0],true):crossings(paths[0],paths[1]);
  if(id==='trefoil'){assert.equal(cross.length,3);assert.equal(Math.abs(cross.reduce((a,b)=>a+b,0)),3);}else assert.equal(Math.abs(cross.reduce((a,b)=>a+b,0)/2),1);
 }
});

test('one propagated hologram resolves three distinct images at their respective depths',async()=>{
 const v=await volume('metamorphosis'),targets=[[],[],[]],actual=[[],[],[]];
 for(let y=-8;y<=8;y+=.25)for(let x=-8;x<=8;x+=.25)for(let k=0;k<3;k++){targets[k].push(imageTarget(k,x,y)**2);actual[k].push(normalizedFlux(sampleField(v,x,y,IMAGE_DEPTHS[k])));}
 console.log('Image correlations',targets.map(t=>actual.map(a=>correlation(t,a))));
 for(let k=0;k<3;k++){const correct=correlation(targets[k],actual[k]);assert.ok(correct>.74,`image ${k}: correlation ${correct}`);for(let other=0;other<3;other++)if(other!==k)assert.ok(correct>correlation(targets[k],actual[other])+.25,'image must be specific to its intended depth');console.log(`Depth image ${IMAGE_DEPTHS[k]}λ: correlation ${correct.toFixed(4)}`);}
});

test('the light sculpture concentrates flux at its 3D curves rather than a flattened image',async()=>{
 const v=await volume('saturn'),points=saturnCurves().flat(),means=[0,-8,8].map(dz=>points.reduce((sum,[x,y,z])=>sum+normalizedFlux(sampleField(v,x,y,z+dz)),0)/points.length);
 assert.ok(means[0]>2*means[1]&&means[0]>2*means[2],`curve/control flux: ${means}`);
});

test('Bessel core is blocked at a real intermediate boundary and reconstructs downstream',async()=>{
 const s=buildSpectrum('healing'),clear={...s,after:undefined},index=GRID.n*(GRID.n/2)+GRID.n/2;
 const axial=(s,z)=>{const[e,b]=propagate(s,z,[0,2]);return fluxZ(e,b,index);};
 assert.ok(axial(s,14)/axial(clear,14)<.02);assert.ok(axial(s,28)/axial(clear,28)>.7);assert.ok(axial(s,28)>10*axial(s,14));
 const v=await volume('healing'),preview=await volume('healing',true);assert.equal(axialIndex(v,14),29);assert.equal(axialIndex(preview,14),15);
 // Two samples at the same physical plane retain the sharp absorbing jump.
 assert.ok(normalizedFlux(sampleField(v,0,0,14-1e-6))>.95);assert.ok(normalizedFlux(sampleField(v,0,0,14))<.02);
 for(const z of[13.999999,14,14.23,27.17]){
  const direct=propagate(s,z),a=sampleField(v,.173,.231,z),b=direct.flatMap(f=>sampleComplex(f,.173,.231,GRID));let error=0,norm=0;for(let c=0;c<10;c++){error+=(a[c]-b[c])**2;norm+=b[c]**2;}assert.ok(Math.sqrt(error/norm)<.035,`interface sampling at ${z}`);
 }
 for(const z of[13,14,15,27])for(const[x,y]of[[0,0],[2,1],[5,-2]]){const a=sampleField(v,x,y,z),b=sampleField(preview,x,y,z);for(let c=0;c<10;c++)assert.ok(Math.abs(a[c]-b[c])<1e-6,'preview/full grid alignment');}
});
