import test from 'node:test';
import assert from 'node:assert/strict';
import {liveModel,absorbedFraction,K} from '../src/live-physics.js';
import {prepareSpectralBench,benchPlane} from '../src/spectral-bench.js';
import {generateNativeVolume} from '../src/native-volume.js';
import {decodeVolume} from '../src/volume-data.js';
test('All tunable instruments produce complete full-resolution assets',async()=>{
 for(const id of ['michelson','grin','absorber']){const result=await generateNativeVolume(id),v=decodeVolume(result.buffer);assert.equal(v.id,id);assert.equal(v.quality,'full');assert.ok(v.nz>300);assert.ok(v.peaks.every(Number.isFinite));assert.equal(result.permittivity.length,v.nx*v.nz);}
});
for(const [id,parameters,points]of[
 ['michelson',[-.4,0,.37],[[0,15],[-5,10],[0,5],[5,10]]],
 ['grin',[-2.2,0,2.2],[[0,2],[1.7,23],[-2.1,42],[3,73]]],
 ['absorber',[0,1,Math.PI],[[0,3],[2,9],[0,11],[1,17]]]
])test(id+' tunable fields obey Maxwell away from boundaries',()=>{
 for(const parameter of parameters){const m=liveModel(id,parameter),h=1e-4;for(const[x,z]of points){const f=m.field(x,z),xp=m.field(x+h,z),xm=m.field(x-h,z),zp=m.field(x,z+h),zm=m.field(x,z-h),dx=xp.map((v,i)=>(v-xm[i])/(2*h)),dz=zp.map((v,i)=>(v-zm[i])/(2*h)),eps=m.epsilon(x,z);const r=[-dz[0]+K*f[5],-dz[1]-K*f[4],dx[0]+K*f[9],dx[1]-K*f[8],dz[4]-dx[8]-K*eps*f[1],dz[5]-dx[9]+K*eps*f[0]];assert.ok(Math.max(...r.map(Math.abs))<1e-5);}}
});
test('Coherent absorber satisfies sheet boundary conditions and power balance',()=>{
 for(let d=0;d<2*Math.PI;d+=.17){const m=liveModel('absorber',d),a=m.field(0,10-1e-8),b=m.field(0,10+1e-8);for(let c=0;c<2;c++){assert.ok(Math.abs(a[c]-b[c])<1e-6);assert.ok(Math.abs(-a[4+c]+b[4+c]-2*a[c])<1e-6);}const output=(Math.cos(d)-1)**2/2+Math.sin(d)**2/2;assert.ok(Math.abs(output+2*absorbedFraction(d)-2)<1e-13);}
 assert.equal(absorbedFraction(0),1);assert.equal(absorbedFraction(Math.PI),0);
});
test('Graded-index modal propagation conserves longitudinal power as the beam bends',()=>{
 const m=liveModel('grin',2),powers=[0,12,24,47,80].map(z=>{let p=0;for(let x=-6.5;x<=6.5;x+=.015){const f=m.field(x,z);p-=.015*(f[0]*f[4]+f[1]*f[5]);}return p;});for(const p of powers)assert.ok(Math.abs(p/powers[0]-1)<2e-7);
});
test('A quarter-wavelength Michelson mirror shift darkens the output and a half-wave shift restores it',()=>{
 const intensity=d=>{const f=liveModel('michelson',d).field(0,19);return f[0]**2+f[1]**2;};
 assert.ok(intensity(.25)/intensity(0)<.001);
 assert.ok(Math.abs(intensity(.5)/intensity(0)-1)<.02);
});
test('Microscope comparison is a coherent change of the physical phase dot',()=>{
 const base=prepareSpectralBench('phase-microscope'),difference=prepareSpectralBench('phase-microscope-bright');
 const before=benchPlane(difference,20);assert.ok(Math.max(...before[0].re.map(Math.abs))<1e-12);
 const a=benchPlane(base,80),b=benchPlane(difference,80);let change=0,total=0;
 for(let p=0;p<a[0].re.length;p++){const contrast=a[0].re[p]**2+a[0].im[p]**2,bright=(a[0].re[p]+b[0].re[p])**2+(a[0].im[p]+b[0].im[p])**2;change+=(contrast-bright)**2;total+=contrast**2;}assert.ok(Math.sqrt(change/total)>.25);
});
