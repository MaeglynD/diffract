import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {JET,jetModel} from '../src/nanojet.js';
import {unpackKnifeTable} from '../src/knife-table.js';
import {bladeSampler,bladeInterval} from '../src/knife-response.js';
import {benchPlane,prepareSpectralBench} from '../src/spectral-bench.js';
import {decodeVolume} from '../src/volume-data.js';

const k=2*Math.PI;
test('the cylinder matches the incident wave at index one and the tangential fields at a glass boundary',()=>{
  const transparent=jetModel(1),glass=jetModel();
  for(const [x,z] of [[0,JET.center],[.6,7.3],[2.7,4.3],[-1.7,10]]){
    const f=transparent.field(x,z),phase=k*(z-JET.center);
    assert.ok(Math.hypot(f[0]-Math.cos(phase),f[1]-Math.sin(phase),f[4]+Math.cos(phase),f[5]+Math.sin(phase),f[8],f[9])<1e-9);
  }
  for(let j=0;j<32;j++){
    const a=k*j/32,point=r=>glass.field(r*Math.sin(a),JET.center+r*Math.cos(a));
    const left=point(JET.radius-1e-8),right=point(JET.radius+1e-8);
    // μ is identical on both sides: both magnetic components are continuous.
    assert.ok(Math.max(...left.map((v,i)=>Math.abs(v-right[i])))<2e-6);
  }
});

test('the nanojet satisfies both curl equations and carries zero net power into the lossless rod',()=>{
  const m=jetModel(),h=1e-5;
  for(const [x,z] of [[0,JET.center],[.71,4.8],[-2.8,7.4],[.17,JET.scanZ]]){
    const f=m.field(x,z),xp=m.field(x+h,z),xm=m.field(x-h,z),zp=m.field(x,z+h),zm=m.field(x,z-h);
    const dx=c=>(xp[c]-xm[c])/(2*h),dz=c=>(zp[c]-zm[c])/(2*h),eps=m.epsilon(x,z);
    const residual=[-dz(0)+k*f[5],-dz(1)-k*f[4],dx(0)+k*f[9],dx(1)-k*f[8],dz(4)-dx(8)-k*eps*f[1],dz(5)-dx(9)+k*eps*f[0]];
    assert.ok(Math.max(...residual.map(Math.abs))<1e-6);
  }
  let net=0,gross=0;
  for(let j=0;j<512;j++){
    const phi=k*j/512,s=Math.sin(phi),c=Math.cos(phi),r=3.6,f=m.field(r*s,JET.center+r*c);
    const radial=(f[0]*f[8]+f[1]*f[9])*s-(f[0]*f[4]+f[1]*f[5])*c;
    net+=radial;gross+=Math.abs(radial);
  }
  assert.ok(Math.abs(net)/gross<1e-9);
  const intensity=(x,z)=>{const f=m.field(x,z);return f[0]**2+f[1]**2;};
  const peak=intensity(0,JET.scanZ);
  assert.ok(peak>9.2 && peak<9.3);
  for(const dz of [-.05,.05])assert.ok(intensity(0,JET.scanZ+dz)<peak);
  assert.ok(intensity(.22,JET.scanZ)>peak/2 && intensity(.23,JET.scanZ)<peak/2);
});

test('the distributed blade response agrees with fresh full-grid propagation over its stroke',async()=>{
  const bytes=await readFile(new URL('../assets/optics/schlieren-v1.table',import.meta.url));
  const atlas=decodeVolume((await unpackKnifeTable(gunzipSync(bytes))).buffer);
  const blank={nx:2,ny:2,nz:2,half:12,zMax:72,textures:Array.from({length:3},()=>new Uint16Array(32))};
  const sample=bladeSampler(blank,atlas);
  let previous=Infinity;
  for(const edge of [-1.625,-.7,0,.17,.7,1.625]){
    const interval=bladeInterval(edge),model=prepareSpectralBench('schlieren',256,32,edge);
    const power=model.regions[2].data.reduce((sum,v)=>sum+v*v,0);assert.ok(power<previous);previous=power;
    assert.deepEqual(Array.from(sample(interval,.25,0,35.5)),Array(10).fill(0));
    for(const z of [36,45.5,53.5,54,66.5,72]){
      const plane=benchPlane(model,z);let error=0,power=0;
      for(let j=-29;j<=29;j+=3)for(let i=-29;i<=29;i+=3){
        const p=(128+j)*256+128+i,field=sample(interval,i*.25,j*.25,z);
        for(let ch=0;ch<10;ch++){
          const ref=plane[ch>>1][ch%2?'im':'re'][p];
          error+=(field[ch]-ref)**2;power+=ref*ref;
        }
      }
      assert.ok(Math.sqrt(error/power)<.019,'blade '+edge+' at z='+z+' · RMS '+Math.sqrt(error/power));
    }
  }
});
