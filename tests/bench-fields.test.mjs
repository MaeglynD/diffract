import test from 'node:test';
import assert from 'node:assert/strict';
import {michelsonPorts,benchModel,stackMode,stackAt,BRAGG} from '../src/bench-fields.js';
import {etalonMode,prepareSpectralBench,benchPlane,specimenPhase} from '../src/spectral-bench.js';
import {generateNativeVolume} from '../src/native-volume.js';
import {decodeVolume,sampleField} from '../src/volume-data.js';
const k=2*Math.PI,power=a=>a[0]**2+a[1]**2;
test('Michelson is unitary and exchanges its complementary output powers',()=>{
 for(let d=-4;d<=4;d+=.07){const p=michelsonPorts(d,.3,-.7);assert.ok(Math.abs(power(p.output)+power(p.return)-1)<1e-13);}
 assert.ok(power(michelsonPorts(0).output)>1-1e-14);assert.ok(power(michelsonPorts(Math.PI).return)>1-1e-14);
 const total=benchModel('michelson'),arm=benchModel('michelson-right');for(const[x,z]of[[0,15],[1,20],[-1,24]]){const f=total.field(x,z),r=arm.field(x,z);assert.ok(Math.hypot(f[0]-2*r[0],f[1]-2*r[1])<.08,'Nearly equal arms cancel coherently in output at pi delay');}
});
test('Michelson TE beam fields satisfy Maxwell within each propagation port',()=>{
 const m=benchModel('michelson'),h=1e-4;for(const[x,z]of[[-7,10],[6,10],[0,5],[.7,20]]){const f=m.field(x,z),xp=m.field(x+h,z),xm=m.field(x-h,z),zp=m.field(x,z+h),zm=m.field(x,z-h),dx=xp.map((v,i)=>(v-xm[i])/(2*h)),dz=zp.map((v,i)=>(v-zm[i])/(2*h));const r=[-dz[0]+k*f[5],-dz[1]-k*f[4],dx[0]+k*f[9],dx[1]-k*f[8],dz[4]-dx[8]-k*f[1],dz[5]-dx[9]+k*f[0]];assert.ok(Math.max(...r.map(Math.abs))<2e-5);}
});
test('Bragg defect matches every interface and conserves incident power',()=>{
 for(const q of[0,.08,.3,.5]){const m=stackMode(q);assert.ok(Math.abs(m.R+m.T-1)<2e-13);for(const z of[BRAGG.start,...BRAGG.layers.map(l=>l.b)]){const a=stackAt(m,z-1e-9),b=stackAt(m,z+1e-9);for(const key of['E','H'])for(let c=0;c<2;c++)assert.ok(Math.abs(a[key][c]-b[key][c])<1e-6);}}
 assert.ok(stackMode(0).T>.999999);assert.ok(stackMode(0,BRAGG.layers,k*1.07).T<.25,'The half-wave defect is a narrow resonance');
 const m=stackMode(0),center=stackAt(m,3.5);assert.ok(power(center.E)+power(center.H)>4,'Stored field builds up in the defect');
});
test('Fabry–Pérot angular amplitudes obey the Airy law and conserve power',()=>{
 for(let q=.7;q<=1;q+=.003){const m=etalonMode(q),airy=(1-.88)**2/((1-.88)**2+4*.88*Math.sin(k*q*8)**2);assert.ok(Math.abs(m.T-airy)<3e-14);assert.ok(Math.abs(m.T+m.R-1)<3e-14);}
 assert.ok(etalonMode(1).T>1-1e-13);assert.ok(etalonMode(1).a[0]>2.8);
});
test('Etalon FFT optimization preserves the full retained optical spectrum',()=>{
 const a=prepareSpectralBench('fabry-perot'),b=prepareSpectralBench('fabry-perot',256);let error=0,norm=0;
 for(const z of[0,3,4.2,8.4,11.4,12.6,16.8]){const fa=benchPlane(a,z),fb=benchPlane(b,z);for(let y=-20;y<=20;y+=4)for(let x=-20;x<=20;x+=4){const pa=(a.n/2+y)*a.n+a.n/2+x,pb=(b.n/2+2*y)*b.n+b.n/2+2*x;for(let c=0;c<5;c++)for(const ri of['re','im']){const d=fa[c][ri][pa]-fb[c][ri][pb];error+=d*d;norm+=fb[c][ri][pb]**2;}}}
 assert.ok(Math.sqrt(error/norm)<1e-12);
});
test('Phase microscope converts a phase-only specimen into image contrast',()=>{
 const m=prepareSpectralBench('phase-microscope',256),initial=benchPlane(m,0),image=benchPlane(m,80),n=m.n,values=[];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=(i-n/2)*m.length/n,y=(j-n/2)*m.length/n;if(Math.hypot(x,y)>7)continue;const at=j*n+i,I=image[0].re[at]**2+image[0].im[at]**2,phase=specimenPhase(-x,-y);values.push([phase,I]);const expected=Math.exp(-2*(x*x+y*y)/110),actual=initial[0].re[at]**2+initial[0].im[at]**2;assert.ok(Math.abs(expected-actual)<.04,'Input is phase only, within the declared NA band limit');}
 const avg=(rows,c)=>rows.reduce((sum,row)=>sum+row[c],0)/rows.length,inside=values.filter(v=>v[0]>.65),outside=values.filter(v=>v[0]<.05);assert.ok(Math.abs(avg(inside,1)-avg(outside,1))>.25,'The physical phase dot creates visible specimen contrast');
});
test('Microscope thin lenses do not create power; the dot attenuates it',()=>{
 const m=prepareSpectralBench('phase-microscope',256),powers=m.regions.map(r=>{let sum=0;for(let i=0;i<r.data.length;i+=4)sum+=r.data[i]**2+r.data[i+1]**2;return sum;});for(let i=1;i<powers.length;i++)assert.ok(powers[i]<=powers[i-1]*(1+1e-7));assert.ok(powers[2]<powers[1]*.8);
});
for(const id of['michelson','bragg-cavity'])test(id+' displayed texture retains the analytical complex field',async()=>{
 const{buffer}=await generateNativeVolume(id),v=decodeVolume(buffer),m=benchModel(id);let error=0,norm=0;
 for(let j=1;j<80;j++){const x=(j*.61803398875%1*2-1)*v.half*.6,z=(j*.41421356237%1)*v.zMax;if(id==='michelson'&&(Math.abs(x+z-10)<.2||Math.abs(z-2)<.15||Math.abs(x-9)<.15))continue;const f=m.field(x,z),a=sampleField(v,x,0,z),c=Math.cos(k*z),s=Math.sin(k*z);for(let i=0;i<10;i+=2){error+=(a[i]*c-a[i+1]*s-f[i])**2+(a[i]*s+a[i+1]*c-f[i+1])**2;norm+=f[i]**2+f[i+1]**2;}}
 assert.ok(Math.sqrt(error/norm)<.025,`Relative interpolation RMS ${Math.sqrt(error/norm)}`);
});
