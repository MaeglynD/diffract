import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {modeVector,propagate,sampleComplex} from '../src/physics.js';
import {buildSpectrum,GRID} from '../src/experiments.js';
import {rabbitTarget} from '../src/image-hologram.js';
import {vectorSample,sampleVectorVolume} from '../src/vector-samples.js';
import {decodeVolume,sampleField,normalizedFlux,mixSlitPhase} from '../src/volume-data.js';
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
async function volume(id){const b=gunzipSync(await readFile(new URL(`../assets/fields/${id}.bin.gz`,import.meta.url)));return decodeVolume(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}

test('displayed electric and magnetic vectors preserve Maxwell handedness and physical axes',()=>{
 for(const[qx,qy]of[[0,0],[.23,-.31],[-.42,.19]]){
  const v=modeVector(qx,qy),f=Float32Array.from(v.flatMap(x=>[x,0])),s=vectorSample(f,2,3,4),k=[Math.sqrt(1-qx*qx-qy*qy),qy,-qx],flux=cross(s.er,s.br),e2=dot(s.er,s.er);
  assert.deepEqual(s.origin,[4,3,-2]);assert.ok(Math.abs(dot(s.er,k))<1e-7);assert.ok(Math.abs(dot(s.br,k))<1e-7);
  for(let i=0;i<3;i++)assert.ok(Math.abs(flux[i]-e2*k[i])<1e-7);
 }
});

test('rabbit image forms from propagation and loses definition away from its image plane',()=>{
 const spectrum=buildSpectrum('rabbit'),correlations=[];
 for(const z of[0,24,48]){
  const fields=propagate(spectrum,z,[0,2]);let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
  for(let y=-7;y<=9;y+=.4)for(let x=-9;x<=8;x+=.4){const e=sampleComplex(fields[0],x,y,GRID),b=sampleComplex(fields[1],x,y,GRID),a=-(e[0]*b[0]+e[1]*b[1]),t=rabbitTarget(x,y)**2;n++;sx+=a;sy+=t;sxx+=a*a;syy+=t*t;sxy+=a*t;}
  correlations.push((n*sxy-sx*sy)/Math.sqrt((n*sxx-sx*sx)*(n*syy-sy*sy)));
 }
 console.log('Rabbit target correlations:',correlations.map(x=>x.toFixed(4)).join(', '));assert.ok(correlations[1]>.9);assert.ok(correlations[1]-Math.max(correlations[0],correlations[2])>.15);
});

test('the shipped right-slit field gives coherent extinction and agrees with direct propagation',async()=>{
 const [both,right]=await Promise.all([volume('double'),volume('double-right')]),direct=propagate(buildSpectrum('double-right'),30.23);
 let error=0,energy=0;
 for(const[x,y]of[[0,0],[1.4,.7],[-3.1,2.3],[6.2,-1.7]]){const r=sampleField(right,x,y,30.23),ref=direct.flatMap(f=>sampleComplex(f,x,y,GRID));for(let i=0;i<10;i++){error+=(r[i]-ref[i])**2;energy+=ref[i]**2;}}
 assert.ok(Math.sqrt(error/energy)<.01);
 for(const z of[12,30,60]){const a=sampleField(both,0,0,z),r=sampleField(right,0,0,z),bright=normalizedFlux(a);mixSlitPhase(a,r,Math.PI);assert.ok(bright>1e-5);assert.ok(Math.abs(normalizedFlux(a))/bright<1e-6);}
});

test('readable vectors use one common envelope for both fields even with a relative slit phase',async()=>{
 const [both,right]=await Promise.all([volume('double'),volume('double-right')]),samples=sampleVectorVolume(both,5,right);
 assert.ok(samples.length>550,'the transmitted field should have useful coverage throughout the beam');
 for(const s of samples.filter((_,i)=>i%71===0))for(const delta of[0,.7,Math.PI]){
  const c=Math.cos(delta)-1,t=Math.sin(delta),metric=Math.sqrt(Math.max(0,s.envelope**2+(c*c+t*t)*s.interference[0]+2*(c*s.interference[1]+t*s.interference[2])));
  let energy=0;for(const[re,im]of[['er','ei'],['br','bi']])for(let i=0;i<3;i++){const a=s[re][i]+c*s.right[re][i]-t*s.right[im][i],b=s[im][i]+t*s.right[re][i]+c*s.right[im][i];energy+=(a*a+b*b)*.5;}
  assert.ok(Math.abs(metric-Math.sqrt(energy))<1e-7,'GPU glyph scaling must match the complete coherent E and cB envelope');
 }
});

test('even-density glyph sampling retains the actual on-axis autofocusing field',async()=>{
 const v=await volume('autofocus'),samples=sampleVectorVolume(v,4),axis=samples.filter(s=>Math.abs(s.origin[1])+Math.abs(s.origin[2])<1e-8&&Math.abs(s.z-22)<2);
 assert.ok(axis.length>=2,'a dense grid around the beam must not omit its brightest axial focus');
 for(const s of axis){const f=sampleField(v,0,0,s.z);assert.ok(Math.hypot(s.er[1]-f[0],s.ei[1]-f[1])<1e-7);assert.ok(s.envelope>2);}
});
