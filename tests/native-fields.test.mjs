import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeModel,CAVITY,COUPLER,GUIDE,GAP,gapMode,bessel,energyDensity} from '../src/native-fields.js';
import {generateNativeVolume} from '../src/native-volume.js';
import {decodeVolume,sampleField} from '../src/volume-data.js';
import {energyVolume,sampleEnergy} from '../src/energy-volume.js';
const k=2*Math.PI;
function derivative(model,x,z,axis,h=2e-4){const a=model.field(x+(axis==='x'?h:0),z+(axis==='z'?h:0)),b=model.field(x-(axis==='x'?h:0),z-(axis==='z'?h:0));return a.map((v,i)=>(v-b[i])/(2*h));}
for(const [id,points]of Object.entries({circulator:[[3.1,5.3],[2.5,7],[1.3,2.5]],coupler:[[-.4,3],[.4,10],[0,5],[1.2,7]],tunnelling:[[-4,2],[-2,4.14],[1,6]]}))test(id+' satisfies both curl equations and div B',()=>{
 const model=nativeModel(id);for(const[x,z]of points){const f=model.field(x,z),dx=derivative(model,x,z,'x'),dz=derivative(model,x,z,'z'),n2=model.epsilon(x,z),residual=[-dz[0]+k*f[5],-dz[1]-k*f[4],dx[0]+k*f[9],dx[1]-k*f[8],dz[4]-dx[8]-k*n2*f[1],dz[5]-dx[9]+k*n2*f[0],dx[4]+dz[8],dx[5]+dz[9]];assert.ok(Math.max(...residual.map(Math.abs))<3e-4,`${id}: residual ${residual}`);}
});
test('coupler matches all four interfaces, conserves power and swaps cores',()=>{
 const m=nativeModel('coupler');for(const x of[-GUIDE.gap/2-GUIDE.width,-GUIDE.gap/2,GUIDE.gap/2,GUIDE.gap/2+GUIDE.width]){const a=m.field(x-1e-8,3),b=m.field(x+1e-8,3);for(const c of[0,1,4,5,8,9])assert.ok(Math.abs(a[c]-b[c])<1e-6);}
 const power=z=>{let l=0,r=0;for(let x=-5;x<5;x+=.002){const f=m.field(x+.001,z),v=-(f[0]*f[4]+f[1]*f[5])*.002;if(x<0)l+=v;else r+=v;}return[l,r];},a=power(0),b=power(COUPLER.transferLength),c=power(2*COUPLER.transferLength);
 assert.ok(a[0]>a[1]*30);assert.ok(b[1]>b[0]*30);assert.ok(c[0]>c[1]*30);assert.ok(Math.abs(a[0]+a[1]-2)<1e-5);assert.ok(Math.abs(a[0]+a[1]-b[0]-b[1])<1e-8);
});
test('tunnelling conserves power and obeys limiting gaps and interface matching',()=>{
 for(const q of[1.19,1.36,1.52]){const mode=gapMode(q);assert.ok(Math.abs(mode.R+mode.T-1)<1e-12);assert.ok(gapMode(q,0).T>1-1e-12);assert.ok(gapMode(q,3).T<1e-9);}
 const m=nativeModel('tunnelling');for(const z of[GAP.at,GAP.at+GAP.width])for(const x of[-3,0,3]){const a=m.field(x,z-1e-8),b=m.field(x,z+1e-8);for(const c of[0,1,4,5,8,9])assert.ok(Math.abs(a[c]-b[c])<1e-6);}
});
test('accelerated tunnelling rows preserve every complex field component',()=>{
 const model=nativeModel('tunnelling'),xs=Float64Array.from({length:91},(_,i)=>-9+i*.2);
 for(const z of[.1,3.9,4,4.08,4.28,4.4,8.4]){const row=model.row(xs,z);for(let i=0;i<xs.length;i++){const reference=model.field(xs[i],z);for(let c=0;c<10;c++)assert.ok(Math.abs(row[i*10+c]-reference[c])<2e-14);}}
});
test('cavity wall has zero tangential E and zero normal B',()=>{
 assert.ok(Math.abs(bessel(CAVITY.m,k*CAVITY.radius))<1e-13);const m=nativeModel('circulator');for(let t=0;t<6;t+=.3){const r=CAVITY.radius-1e-7,f=m.field(r*Math.cos(t),CAVITY.center+r*Math.sin(t));assert.ok(Math.hypot(f[0],f[1])<1e-6);assert.ok(Math.hypot(f[4]*Math.cos(t)+f[8]*Math.sin(t),f[5]*Math.cos(t)+f[9]*Math.sin(t))<1e-6);}
});
for(const id of['circulator','coupler','tunnelling'])test(id+' full-resolution texture agrees with analytical phasors and dielectric energy',async()=>{
 const {buffer,permittivity}=await generateNativeVolume(id),v=Object.assign(decodeVolume(buffer),{permittivity}),model=nativeModel(id),density=energyVolume(v);let maxError=0,maxEnergyError=0;
 for(let j=1;j<=35;j++){const x=(j*.61803398875%1*2-1)*v.half*.75,z=(j*.41421356%1)*v.zMax,f=model.field(x,z),s=sampleField(v,x,.2,z),c=Math.cos(k*z),t=Math.sin(k*z);if(id==='circulator'&&Math.abs(Math.hypot(x,z-CAVITY.center)-CAVITY.radius)<.06)continue;for(let i=0;i<10;i+=2)maxError=Math.max(maxError,Math.abs(f[i]-(s[i]*c-s[i+1]*t)),Math.abs(f[i+1]-(s[i]*t+s[i+1]*c)));const expected=energyDensity(f,model.epsilon(x,z));if((id!=='tunnelling'||Math.min(Math.abs(z-GAP.at),Math.abs(z-GAP.at-GAP.width))>.06)&&(id!=='coupler'||Math.min(...[.125,.625].map(a=>Math.abs(Math.abs(x)-a)))>.05))maxEnergyError=Math.max(maxEnergyError,Math.abs(sampleEnergy(v,density,x,.2,z)-expected));}
 assert.ok(maxError<.065,`${id} interpolation max ${maxError}`);assert.ok(maxEnergyError<.075,`${id} energy max ${maxEnergyError}`);
});
