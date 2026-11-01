import test from 'node:test';
import assert from 'node:assert/strict';
import {acousticModel,drumModel,soundWeights,DRUM,drumHeight,SOUND} from '../src/resonant-instruments.js';
import {benchPlane,prepareSpectralBench} from '../src/spectral-bench.js';
import {SCATTER,LENSLETS} from '../src/wavefront-benches.js';
import {EXPERIMENTS} from '../src/experiments.js';
import {SETUP_REFERENCES} from '../src/setup-references.js';
import {CONVEYOR,trapPosition,coneSection,axialFactors,conveyorField,conveyorVolume} from '../src/optical-conveyor.js';
import {SCHLIEREN} from '../src/schlieren.js';
import {decodeVolume,sampleField,normalizedFlux} from '../src/volume-data.js';
const k=2*Math.PI;

function cameraObservations(id,z,n,length){
 const model=prepareSpectralBench(id,n,length),diff=prepareSpectralBench(id+'-bright',n,length);
 const initial=benchPlane(model,z),change=benchPlane(diff,z);
 return [0,1].map(mix=>(x,y)=>{
  const p=(model.n/2+Math.round(y*model.n/model.length))*model.n+model.n/2+Math.round(x*model.n/model.length);
  let flux=0;
  for(const key of ['re','im'])flux-=(initial[0][key][p]+mix*change[0][key][p])*(initial[2][key][p]+mix*change[2][key][p]);
  return flux;
 });
}

test('the conveyor moves three stable electric traps by one site per full phase turn',()=>{
 const E2=(x,y,z,phase)=>conveyorField(coneSection(x,y),axialFactors(z,phase)).slice(0,4).reduce((s,v)=>s+v*v,0);
 for(const phase of [-4*Math.PI,-.76,0,.91,4*Math.PI])for(const site of CONVEYOR.sites){
  const z=trapPosition(site,phase),f=conveyorField(coneSection(0,0),axialFactors(z,phase));
  assert.ok(z>0&&z<CONVEYOR.length);
  assert.ok(Math.abs(trapPosition(site,phase+k)-z-CONVEYOR.spacing)<1e-14);
  assert.ok(Math.abs(E2(0,0,z,phase)-4)<1e-12);
  for(const [x,y,dz] of [[.17,0,0],[0,.17,0],[0,0,.09],[0,0,-.09]])assert.ok(E2(x,y,z+dz,phase)<3.9);
  assert.ok(E2(0,0,z+CONVEYOR.spacing/2,phase)<1e-24);
  assert.ok(Math.abs(normalizedFlux(f))<1e-12);
 }
});

test('the conveyor satisfies both vector curl equations and its phase-controlled textures reproduce the field',async()=>{
 const base=decodeVolume((await conveyorVolume('conveyor')).buffer);
 const arm=decodeVolume((await conveyorVolume('conveyor-right')).buffer);
 let error=0,norm=0;
 for(const phase of [-2.36,0,1.91])for(const [x,y,z] of [[.23,-.41,2.63],[-.81,.27,4.71],[.16,.32,1.11]]){
  const envelope=(x,y,z)=>conveyorField(coneSection(x,y),axialFactors(z,phase));
  function physical(x,y,z){
   const v=envelope(x,y,z),c=Math.cos(k*z),s=Math.sin(k*z);
   for(let j=0;j<10;j+=2){const r=v[j],i=v[j+1];v[j]=r*c-i*s;v[j+1]=r*s+i*c;}
   return v;
  }
  const h=1e-5,F=physical(x,y,z),d=[[h,0,0],[0,h,0],[0,0,h]].map(([u,v,w])=>{
   const p=physical(x+u,y+v,z+w),m=physical(x-u,y-v,z-w);return p.map((a,j)=>(a-m[j])/(2*h));
  });
  // Curl E = ik cB, curl(cB) = -ik E. Ex is identically zero.
  for(let i=0;i<2;i++){
   const curlE=[d[1][2+i]-d[2][i],-d[0][2+i],d[0][i]];
   const curlB=[d[1][8+i]-d[2][6+i],d[2][4+i]-d[0][8+i],d[0][6+i]-d[1][4+i]];
   const s=i===0?-k:k,other=1-i;
   for(let j=0;j<3;j++){
    assert.ok(Math.abs(curlE[j]-s*F[4+2*j+other])<1e-7);
    const e=j===0?0:F[2*(j-1)+other];assert.ok(Math.abs(curlB[j]+s*e)<1e-7);
   }
  }
  const expected=envelope(x,y,z),a=sampleField(base,x,y,z),b=sampleField(arm,x,y,z),c=Math.cos(phase)-1,s=Math.sin(phase);
  for(let j=0;j<10;j+=2){
   error+=(a[j]+c*b[j]-s*b[j+1]-expected[j])**2+(a[j+1]+s*b[j]+c*b[j+1]-expected[j+1])**2;
   norm+=expected[j]**2+expected[j+1]**2;
  }
 }
 assert.ok(Math.sqrt(error/norm)<.025);
});

test('the Schlieren blade changes the camera contrast and leaves the incident and pre-blade fields intact',()=>{
 const {f,camera}=SCHLIEREN,model=prepareSpectralBench('schlieren'),difference=prepareSpectralBench('schlieren-bright');
 assert.deepEqual(model.regions.map(r=>r.z),[0,f,2*f,3*f]);
 for(const region of difference.regions.filter(r=>r.z<2*f))assert.ok(region.data.every(v=>v===0));
 const [cut,open]=cameraObservations('schlieren',camera);
 // Compare opposite flanks in the inverted image at the same exposure.
 for(const y of [0,3,5]){
  const contrast=read=>(read(-2,y)-read(2,y))/(read(-2,y)+read(2,y));
  assert.ok(contrast(cut)>.8);assert.ok(contrast(cut)>4*Math.abs(contrast(open)));
 }
 const transmitted=state=>model.regions[2].data.reduce((sum,v,i)=>sum+(v+state*difference.regions[2].data[i])**2,0);
 const fraction=transmitted(0)/transmitted(1);assert.ok(fraction>.32&&fraction<.64);
});

test('phase-only control focuses speckle at the designated pixel, including in a wider computational window',()=>{
 const {camera,targetX,targetY}=SCATTER;
 const cameras=cameraObservations('speckle-focus',camera),wide=cameraObservations('speckle-focus',camera,256,64);
 const [flat,focused]=cameras.map(read=>read(targetX,targetY));
 assert.ok(focused>20*flat);
 for(let j=-36;j<=36;j++)for(let i=-36;i<=36;i++)assert.ok(cameras[1](i/4,j/4)<=focused);
 for(let state=0;state<2;state++)assert.ok(Math.abs(wide[state](targetX,targetY)/cameras[state](targetX,targetY)-1)<.035);
});

test('Shack–Hartmann spot displacements resolve the sign and size of the incident wavefront slope',()=>{
 const [flat,astigmatic]=cameraObservations('hartmann',LENSLETS.arrayZ+LENSLETS.f);
 function localPeak(read,x,y){
  let max=-Infinity,at;
  for(let dy=-2.75;dy<=2.75;dy+=.25)for(let dx=-2.75;dx<=2.75;dx+=.25){
   const v=read(x+dx,y+dy);if(v>max){max=v;at=[dx,dy];}
  }return at;
 }
 for(const x of [-12,-6,0,6,12])for(const y of [-12,-6,0,6,12]){
  const [u,v]=localPeak(flat,x,y),[s,t]=localPeak(astigmatic,x,y);
  assert.ok(Math.abs(u)<=.25 && Math.abs(v)<=.25);
  assert.ok(Math.abs(s-u-LENSLETS.f*LENSLETS.curvature*x)<.55);
  assert.ok(Math.abs(t-v+LENSLETS.f*LENSLETS.curvature*y)<.55);
 }
});

test('every selectable setup has a physical comparison with a labelled source',()=>{
 assert.deepEqual(Object.keys(SETUP_REFERENCES).sort(),EXPERIMENTS.map(e=>e.id).sort());
 for(const {note,links} of Object.values(SETUP_REFERENCES)){
  assert.ok(note && links.length);
  for(const [label,url] of links)assert.ok(label && new URL(url).protocol==='https:');
 }
});

test('the acoustic drive extinguishes the zero order without extinguishing the incident sheet',()=>{
 const root=2.4048255577,w=soundWeights(root);
 assert.ok(Math.abs(w[0])<1e-9);assert.ok(w[1]>.51);
 for(const d of [0,.4,1.7,root,2.7]){
  const s=soundWeights(d),total=s.reduce((p,v,m)=>p+(m?2:1)*v*v,0);
  assert.ok(total>.998&&total<1+1e-12);
  const model=acousticModel(d);
  for(const x of [-6,-2.4,0,1.2,3.5]){
   const f=model.field(x,SOUND.cell-1e-8),g=model.field(x,SOUND.cell);
   const phase=d*Math.cos(k*x/SOUND.period);
   // Truncation error of the retained orders against the actual thin mask.
   assert.ok(Math.hypot(g[0]-f[0]*Math.cos(phase),g[1]-f[0]*Math.sin(phase))<.065);
  }
 }
});
test('the triangle closes on all three conducting walls, for both conjugate modes',()=>{
 for(const angle of[0,.37,Math.PI/4,Math.PI/2])for(let i=1;i<100;i++){
  const t=i/100,m=drumModel(angle),a=DRUM.side,b=DRUM.base;
  for(const[x,z,nx,nz]of[[a*(t-.5),b,0,1],[a*(1-t)/2,b+t*drumHeight,Math.sqrt(3)/2,.5],[-a*(1-t)/2,b+t*drumHeight,-Math.sqrt(3)/2,.5]]){
   const f=m.field(x,z);assert.ok(Math.hypot(f[0],f[1])<1e-12);assert.ok(Math.hypot(f[4]*nx+f[8]*nz,f[5]*nx+f[9]*nz)<1e-12);
  }
 }
 const pt=[.45,1.25],a=drumModel(0).field(...pt),b=drumModel(Math.PI/2).field(...pt),s=drumModel(Math.PI/4).field(...pt);
 assert.ok(Math.abs(a[1])>.01&&Math.abs(a[1]+b[1])<1e-12&&Math.abs(s[1])<1e-12);
});
test('electric and magnetic fields satisfy both Maxwell curl equations inside the new instruments',()=>{
 const h=1e-5;
 for(const [m,points]of[[drumModel(.28),[[0,1.35],[.37,1.74],[-.12,3.4]]],[acousticModel(2.4),[[1,1.2],[4,14],[8,40],[-8,40]]]]){
  for(const[x,z]of points){
   const f=m.field(x,z),xp=m.field(x+h,z),xm=m.field(x-h,z),zp=m.field(x,z+h),zm=m.field(x,z-h);
   const dx=i=>(xp[i]-xm[i])/(2*h),dz=i=>(zp[i]-zm[i])/(2*h);
   const residual=[-dz(0)+k*f[5],-dz(1)-k*f[4],dx(0)+k*f[9],dx(1)-k*f[8],dz(4)-dx(8)-k*f[1],dz(5)-dx(9)+k*f[0]];
   assert.ok(Math.max(...residual.map(Math.abs))<2e-7);
  }
 }
});
test('the Lyot stop rejects the on-axis star, while the displaced star survives at the camera',()=>{
 const on=prepareSpectralBench('coronagraph'),diff=prepareSpectralBench('coronagraph-bright');
 function powers(z){
  const a=benchPlane(on,z),b=benchPlane(diff,z),total=[0,0],peak=[0,0],where=[0,0];
  for(let p=0;p<on.n**2;p++)for(let s=0;s<=1;s++){
   const flux=-(a[0].re[p]+s*b[0].re[p])*(a[2].re[p]+s*b[2].re[p])-(a[0].im[p]+s*b[0].im[p])*(a[2].im[p]+s*b[2].im[p]);
   total[s]+=flux;if(flux>peak[s]){peak[s]=flux;where[s]=(p%on.n-on.n/2)*on.length/on.n;}
  }return {total,peak,where};
 }
 const input=powers(0),before=powers(55.5),after=powers(56),camera=powers(70);
 assert.ok(after.total[0]/before.total[0]<.005);
 assert.ok(after.total[1]/input.total[1]>.45);
 assert.ok(camera.peak[0]<camera.peak[1]*.001&&Math.abs(camera.where[1]+3)<.5);
 for(let s=0;s<2;s++)assert.ok(Math.abs(camera.total[s]/after.total[s]-1)<1e-10);
});
