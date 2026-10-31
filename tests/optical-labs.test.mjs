import test from 'node:test';
import assert from 'node:assert/strict';
import {acousticModel,drumModel,soundWeights,DRUM,drumHeight,SOUND} from '../src/resonant-instruments.js';
import {benchPlane,prepareSpectralBench} from '../src/spectral-bench.js';
const k=2*Math.PI;

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
