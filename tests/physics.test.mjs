import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, PRESETS, TAU, fft, fft2, createSpectrum, modeVector, propagate, fluxZ, sampleComplex, createVolume, sampleVolume, halfSpan, fresnelNumber } from '../src/physics.js';

const near = (a,b,tol=1e-10) => assert.ok(Math.abs(a-b)<tol, `${a} differs from ${b} (tolerance ${tol})`);
const dot = (a,b) => a.reduce((sum,x,i)=>sum+x*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const fluxAt = (fields,x,y=0,config=CONFIG) => -dot(sampleComplex(fields[0],x,y,config),sampleComplex(fields[1],x,y,config));
let doubleSpectrum;
function double(){ return doubleSpectrum ||= createSpectrum('double'); }

test('FFT round-trips a complex field and gives the known transform of a plane wave',()=>{
  const n=64,re=Float64Array.from({length:n},(_,i)=>Math.cos(TAU*7*i/n)),im=Float64Array.from({length:n},(_,i)=>Math.sin(TAU*7*i/n));
  const origRe=re.slice(),origIm=im.slice();fft(re,im);near(re[7],n,1e-10);near(im[7],0,1e-10);
  for(let i=0;i<n;i++)if(i!==7)near(Math.hypot(re[i],im[i]),0,1e-10);
  fft(re,im,true);for(let i=0;i<n;i++){near(re[i],origRe[i]);near(im[i],origIm[i]);}
  const r=Float64Array.from({length:256},(_,i)=>Math.sin(i*.71)),t=Float64Array.from({length:256},(_,i)=>Math.cos(i*.37)),r0=r.slice(),t0=t.slice();fft2(r,t,16);fft2(r,t,16,true);for(let i=0;i<r.length;i++){near(r[i],r0[i]);near(t[i],t0[i]);}
});

test('every angular mode is transverse and obeys both curl equations of vacuum Maxwell theory',()=>{
  for(let x=-.5;x<=.5;x+=.07)for(let y=-.5;y<=.5;y+=.07){
    if(Math.hypot(x,y)>.58)continue;
    const q=[x,y,Math.sqrt(1-x*x-y*y)],v=modeVector(x,y),e=[0,v[0],v[1]],b=[v[2],v[3],v[4]];
    near(dot(q,e),0);near(dot(q,b),0);
    cross(q,e).forEach((a,i)=>near(a,b[i]));cross(q,b).forEach((a,i)=>near(a,-e[i]));
  }
});

test('3D field samples agree with an independent 2D inverse FFT, including longitudinal components',()=>{
  const s=double(),volume=createVolume(s),z=17.5,fields=propagate(s,z);
  for(const [plane,y] of volume.ys.entries())for(const x of [-2.25,0,1.5,4.125]){
    const v=sampleVolume(volume,x,z,plane);
    for(let c=0;c<5;c++){const expected=sampleComplex(fields[c],x,y);near(v[2*c],expected[0],2e-7);near(v[2*c+1],expected[1],2e-7);}
  }
  const offAxis=sampleVolume(volume,1.5,z,2);assert.ok(Math.hypot(offAxis[2],offAxis[3])>.001,'nonzero Ez away from the symmetry plane');assert.ok(Math.hypot(offAxis[6],offAxis[7])>.0001,'nonzero By away from the symmetry plane');
});

test('integrated axial electromagnetic power is conserved during propagation',()=>{
  const s=double();let initial;
  for(const z of [0,22,120]){
    const fields=propagate(s,z,[0,2]);let power=0;for(let i=0;i<CONFIG.n**2;i++)power+=fluxZ(fields[0],fields[1],i);
    if(initial===undefined)initial=power;near(power/initial,1,5e-12);
  }
});

test('two slit fields add coherently and a pi shift extinguishes central forward flux',()=>{
  const s=double(),all=propagate(s,40,[0,2]),left=propagate(s,40,[0,2],true),shift=propagate(createSpectrum('double',true),40,[0,2]);
  for(const x of [-8,0,4])for(let c=0;c<2;c++){
    const total=sampleComplex(all[c],x,0),l=sampleComplex(left[c],x,0),changed=sampleComplex(shift[c],x,0);
    near(changed[0],2*l[0]-total[0],1e-10);near(changed[1],2*l[1]-total[1],1e-10);
  }
  assert.ok(fluxAt(all,0)>.05);assert.ok(Math.abs(fluxAt(shift,0))<1e-20);
  const e=sampleComplex(all[0],0,0),b=sampleComplex(all[1],0,0),le=sampleComplex(left[0],0,0),lb=sampleComplex(left[1],0,0);
  near(-dot(e,b),4*-dot(le,lb),1e-12);
});

test('single slit far-field minimum agrees with sin(theta)=lambda / width',()=>{
  const z=120,fields=propagate(createSpectrum('single'),z,[0,2]),expected=z/Math.sqrt(PRESETS.single.width**2-1);
  let minimum={x:0,flux:Infinity};for(let x=expected-3;x<=expected+3;x+=.05){const f=fluxAt(fields,x);if(f<minimum.flux)minimum={x,flux:f};}
  assert.ok(Math.abs(minimum.x/expected-1)<.015,`minimum at ${minimum.x}, expected ${expected}`);
  assert.ok(minimum.flux/fluxAt(fields,0)<.001);
  console.log(`Single slit: minimum ${minimum.x.toFixed(2)}λ; far-field prediction ${expected.toFixed(2)}λ.`);
});

test('circular aperture first dark ring agrees with the first zero of J1',()=>{
  const z=120,fields=propagate(createSpectrum('circle'),z,[0,2]);
  const sinTheta=3.8317059702075125/(TAU*PRESETS.circle.radius),expected=z*sinTheta/Math.sqrt(1-sinTheta*sinTheta);
  let minimum={x:0,flux:Infinity};for(let x=expected-2;x<=expected+2;x+=.05){const f=fluxAt(fields,x);if(f<minimum.flux)minimum={x,flux:f};}
  assert.ok(Math.abs(minimum.x/expected-1)<.015,`ring at ${minimum.x}, expected ${expected}`);assert.ok(minimum.flux/fluxAt(fields,0)<.001);
  console.log(`Circle: first ring ${minimum.x.toFixed(2)}λ; Airy prediction ${expected.toFixed(2)}λ.`);
});

test('detector window agrees with a twice-padded reference at the largest propagation distance',()=>{
  const z=CONFIG.zMax,referenceConfig={...CONFIG,n:CONFIG.n*2,length:CONFIG.length*2};
  const fields=propagate(double(),z,[0,2]),reference=propagate(createSpectrum('double',false,referenceConfig),z,[0,2]);
  const peak=fluxAt(reference,0,0,referenceConfig);let worst=0;
  for(let y=-halfSpan(z);y<=halfSpan(z);y+=4.5)for(let x=-halfSpan(z);x<=halfSpan(z);x+=3.5){
    const err=Math.abs(fluxAt(fields,x,y)-fluxAt(reference,x,y,referenceConfig))/peak;worst=Math.max(worst,err);
  }
  assert.ok(worst<.002,`maximum discrepancy is ${worst} of center intensity`);
  console.log(`Padding check: maximum sampled intensity error ${(worst*100).toFixed(5)}% of center intensity.`);
});

test('reference aperture fixtures span Fresnel and Fraunhofer regimes within their detector travel',()=>{
  for(const id of Object.keys(PRESETS)){assert.ok(fresnelNumber(id,CONFIG.zMin)>1);assert.ok(fresnelNumber(id,CONFIG.zMax)<.1);}
});
