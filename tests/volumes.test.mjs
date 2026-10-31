import test from 'node:test';
import {energyVolume,sampleEnergy} from '../src/energy-volume.js';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {EXPERIMENTS,GRID,buildSpectrum} from '../src/experiments.js';
import {propagate,sampleComplex,fluxZ} from '../src/physics.js';
import {decodeVolume,toHalf,fromHalf,sampleField,normalizedFlux} from '../src/volume-data.js';
async function readVolume(id){const b=gunzipSync(await readFile(new URL(`../assets/fields/${id}.bin.gz`,import.meta.url)));return decodeVolume(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}

test('binary16 preserves sign, tiny fields, and mantissa carry at powers of two',()=>{
 for(const v of[0,-0,1,-1,1.9999,3.9997,1e-7,-2e-5,.0012,4.225,65504]){const a=fromHalf(toHalf(v));assert.ok(Math.abs(a-v)<=Math.max(3e-8,Math.abs(v)*.0005),`${v} → ${a}`);}
 assert.equal(fromHalf(toHalf(Infinity)),Infinity);assert.equal(fromHalf(toHalf(-Infinity)),-Infinity);assert.ok(Number.isNaN(fromHalf(toHalf(NaN))));
});

test('shipped 3D fields agree with independently propagated fields off every sampling plane',async()=>{
 for(const e of EXPERIMENTS.filter(e=>!e.analytic)){
  const v=await readVolume(e.id),s=buildSpectrum(e.id);assert.ok(v.nx===Math.round(2*e.half/0.25)+1&&v.ny===v.nx&&v.nz>80);let error=0,energy=0,fluxError=0,fluxEnergy=0,scalarError=0,scalarNorm=0;const scalar=energyVolume(v);
  for(const z of[1.17,e.z+.23,e.zMax-.31]){
   const direct=propagate(s,z);
   for(let yi=-4;yi<=4;yi++)for(let xi=-4;xi<=4;xi++){
    const spacing=Math.min(e.radius/3,(e.half-.5)/4),x=xi*spacing+.173,y=yi*spacing+.231;assert.ok(Math.abs(x)<v.half&&Math.abs(y)<v.half,'validation samples must lie inside the stored volume');const a=sampleField(v,x,y,z),b=direct.flatMap(f=>sampleComplex(f,x,y,GRID));
    for(let c=0;c<10;c++){error+=(a[c]-b[c])**2;energy+=b[c]**2;}
    const fa=normalizedFlux(a),fb=normalizedFlux(b);fluxError+=(fa-fb)**2;fluxEnergy+=fb**2;const ub=b.reduce((sum,c)=>sum+c*c*.5,0),ua=sampleEnergy(v,scalar,x,y,z);scalarError+=(ua-ub)**2;scalarNorm+=ub**2;
   }
  }
  const rms=Math.sqrt(error/energy),fluxRms=Math.sqrt(fluxError/fluxEnergy);console.log(`${e.id}: complex-field RMS ${(100*rms).toFixed(2)}%; axial-flux RMS ${(100*fluxRms).toFixed(2)}%; sampled-density RMS ${(100*Math.sqrt(scalarError/scalarNorm)).toFixed(2)}%`);
  assert.ok(Math.sqrt(scalarError/scalarNorm)<.03,`${e.id} excessive density interpolation error`);assert.ok(rms<.03,`${e.id} excessive field interpolation error ${rms}`);assert.ok(fluxRms<.05,`${e.id} excessive flux interpolation error ${fluxRms}`);
 }
});

test('volume includes longitudinal and off-axis magnetic fields and continuous detector motion',async()=>{
 const v=await readVolume('crossed'),f=sampleField(v,1.1,2.3,17.38);assert.ok(Math.hypot(f[2],f[3])>.001);assert.ok(Math.hypot(f[6],f[7])>.0001);
 const left=sampleField(v,1.1,2.3,17.5-1e-5),right=sampleField(v,1.1,2.3,17.5+1e-5);for(let i=0;i<10;i++)assert.ok(Math.abs(left[i]-right[i])<.0001);
 assert.ok(Math.abs(normalizedFlux(left)-normalizedFlux(right))<.0001);
});

test('zone plate focuses, vortex retains its transverse dark core, and power is conserved',()=>{
 for(const id of['zone','vortex','crossed']){
  const s=buildSpectrum(id);let initial;
  for(const z of[0,14,48]){const fields=propagate(s,z,[0,2]);let power=0;for(let i=0;i<GRID.n**2;i++)power+=fluxZ(fields[0],fields[1],i);if(initial===undefined)initial=power;assert.ok(Math.abs(power/initial-1)<1e-10);}
  if(id==='zone'){const a=propagate(s,14,[0,2]),f=-(sampleComplex(a[0],0,0,GRID)[0]*sampleComplex(a[1],0,0,GRID)[0]+sampleComplex(a[0],0,0,GRID)[1]*sampleComplex(a[1],0,0,GRID)[1]);assert.ok(f>10);}
  if(id==='vortex'){const a=propagate(s,28,[0]);assert.ok(Math.hypot(...sampleComplex(a[0],0,0,GRID))<1e-10);assert.ok(Math.hypot(...sampleComplex(a[0],4,0,GRID))>.1);}
 }
});

test('new maximum-distance detector agrees with a twice-padded angular spectrum',()=>{
 const e=EXPERIMENTS.find(e=>e.id==='double'),large={...GRID,n:1024,length:256},a=propagate(buildSpectrum(e.id),e.zMax,[0,2]),b=propagate(buildSpectrum(e.id,large),e.zMax,[0,2]);let worst=0,peak=0;
 const flux=(fields,x,y,grid)=>{const e=sampleComplex(fields[0],x,y,grid),b=sampleComplex(fields[1],x,y,grid);return -(e[0]*b[0]+e[1]*b[1]);};
 for(let y=-e.half;y<=e.half;y+=2.7)for(let x=-e.half;x<=e.half;x+=2.9){const ref=flux(b,x,y,large);peak=Math.max(peak,ref);worst=Math.max(worst,Math.abs(flux(a,x,y,GRID)-ref));}
 console.log(`Active-grid padding discrepancy: ${(100*worst/peak).toFixed(4)}% of peak`);assert.ok(worst/peak<.002);
});

test('hologram concentrates light at separated target depths',()=>{
 const s=buildSpectrum('hologram');let enhanced=0;
 for(let j=0;j<5;j++){
  const z=18+6*j,x=4*Math.cos(2*Math.PI*j/5),y=4*Math.sin(2*Math.PI*j/5),fields=propagate(s,z,[0,2]);
  const flux=(x,y)=>{const e=sampleComplex(fields[0],x,y,GRID),b=sampleComplex(fields[1],x,y,GRID);return -(e[0]*b[0]+e[1]*b[1]);};
  const atTarget=flux(x,y),background=(flux(x+3,y)+flux(x-3,y)+flux(x,y+3)+flux(x,y-3))/4;
  console.log(`Hologram target ${j}: flux ${atTarget.toFixed(3)}, neighboring mean ${background.toFixed(3)}`);
  if(atTarget>background*2&&atTarget>.5)enhanced++;
 }
 assert.equal(enhanced,5,'all five target depths should show localized concentration');
});

test('the four-petal interference pattern rotates during propagation',()=>{
 const s=buildSpectrum('petals'),angles=[];
 for(const z of[4,36]){
  const fields=propagate(s,z,[0,2]);let re=0,im=0;
  for(let y=-12;y<=12;y+=.35)for(let x=-12;x<=12;x+=.35){const r=Math.hypot(x,y);if(r<.5||r>12)continue;const a=sampleComplex(fields[0],x,y,GRID),b=sampleComplex(fields[1],x,y,GRID),flux=-(a[0]*b[0]+a[1]*b[1]),theta=4*Math.atan2(y,x);re+=flux*Math.cos(theta);im+=flux*Math.sin(theta);}
  angles.push(Math.atan2(im,re)/4);
 }
 const turn=Math.abs(angles[1]-angles[0]);console.log(`Petal rotation between planes: ${(turn*180/Math.PI).toFixed(2)} degrees`);assert.ok(turn>.15&&turn<Math.PI/4);
});
