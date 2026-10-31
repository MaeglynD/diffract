import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPERIMENTS,GRID,buildSpectrum} from '../src/experiments.js';
import {TAU,propagate,fluxZ,sampleComplex} from '../src/physics.js';

// Independently sum the complete phasor at arbitrary coordinates, retaining
// exp(ikz). In particular, this does not differentiate the FFT propagator or
// its basis algebra to produce the expected Maxwell derivatives.
function fieldAt(s,p){
  const offset=s.after&&p[2]>=s.interfaceZ?s.interfaceZ:0;
  if(offset)s=s.after;
  const f=new Float64Array(12),norm=s.config.n**2,L=s.config.length;
  for(const m of s.modes){
    const phase=TAU*(m.qx*(p[0]+L/2)+m.qy*(p[1]+L/2)+m.qz*(p[2]-offset)+offset),c=Math.cos(phase),t=Math.sin(phase),a=s.re[m.at],b=s.im[m.at],re=(a*c-b*t)/norm,im=(a*t+b*c)/norm;
    for(let j=0;j<5;j++){f[2+j*2]+=re*m.v[j];f[3+j*2]+=im*m.v[j];}
  }
  return f; // Ex, Ey, Ez, cBx, cBy, cBz, interleaved complex
}
test('all catalogue fields satisfy finite-difference vacuum Maxwell equations and the energy-flow bound',()=>{
  let worst=0;
  for(const e of EXPERIMENTS){
    const s=buildSpectrum(e.id),h=.001;
    for(const p of[[.713,1.137,3.217],[e.radius*.31,-e.radius*.27,e.z+.173]]){
      const f=fieldAt(s,p),d=[0,1,2].map(axis=>{const a=[...p],b=[...p];a[axis]+=h;b[axis]-=h;const fa=fieldAt(s,a),fb=fieldAt(s,b);return fa.map((v,i)=>(v-fb[i])/(2*h));});
      let residual=0,norm=0;
      for(const base of[0,6])for(let c=0;c<2;c++){
        const div=d[0][base+c]+d[1][base+2+c]+d[2][base+4+c];residual+=div*div;
        for(let axis=0;axis<3;axis++){
          const j=(axis+1)%3,k=(axis+2)%3,curl=d[j][base+2*k+c]-d[k][base+2*j+c],other=(6-base)+2*axis,sign=base===0?1:-1;
          const rhs=sign*TAU*(c===0?-f[other+1]:f[other]);residual+=(curl-rhs)**2;norm+=rhs*rhs;
        }
      }
      const error=Math.sqrt(residual/norm);worst=Math.max(worst,error);assert.ok(error<.000015,`${e.id}: Maxwell residual ${error}`);
      const dot=(a,b)=>f[a]*f[b]+f[a+1]*f[b+1];
      const flux=[dot(2,10)-dot(4,8),dot(4,6)-dot(0,10),dot(0,8)-dot(2,6)],energy=f.reduce((sum,v)=>sum+.5*v*v,0);
      assert.ok(Math.hypot(...flux)<=energy*(1+1e-12),`${e.id}: electromagnetic energy-flow bound`);
    }
  }
  console.log(`Worst finite-difference Maxwell residual: ${(worst*100).toFixed(6)}%`);
});

test('integrated axial power is conserved in each source-free propagation region',()=>{
  let worst=0;
  for(const e of EXPERIMENTS){
    const s=buildSpectrum(e.id),regions=e.interfaceZ?[[0,e.interfaceZ*.5,e.interfaceZ-1e-5],[e.interfaceZ,(e.interfaceZ+e.zMax)/2,e.zMax]]:[[0,e.zMax*.371,e.zMax]],powers=[];
    for(const region of regions){let reference;
    for(const z of region){
      const[ey,bx]=propagate(s,z,[0,2]);let sum=0;for(let i=0;i<GRID.n**2;i++)sum+=fluxZ(ey,bx,i);
      reference??=sum;const error=Math.abs(sum/reference-1);worst=Math.max(worst,error);assert.ok(error<2e-10,`${e.id}: axial power at ${z}`);
    }
    powers.push(reference);}
    if(e.interfaceZ)assert.ok(powers[1]<powers[0]*.98&&powers[1]>0,`${e.id}: obstacle must remove power`);
  }
  console.log(`Worst full-domain relative power drift: ${worst.toExponential(3)}`);
});

test('new experiments converge under doubled computational padding',()=>{
  const large={...GRID,n:1024,length:256};
  for(const id of['autofocus','fork','astigmatism','poisson','trefoil','hopf','saturn','metamorphosis','healing']){
    const e=EXPERIMENTS.find(e=>e.id===id),s=buildSpectrum(id),padded=buildSpectrum(id,large);let worst=0,peak=0;
    for(const z of[e.z,e.zMax]){
      const a=propagate(s,z,[0,2]),b=propagate(padded,z,[0,2]);
      const flux=(fields,x,y,grid)=>{const[e,t]=sampleComplex(fields[0],x,y,grid),[b,c]=sampleComplex(fields[1],x,y,grid);return-e*b-t*c;};
      for(let y=-e.half;y<=e.half;y+=1.73)for(let x=-e.half;x<=e.half;x+=1.97){const expected=flux(b,x,y,large);peak=Math.max(peak,expected);worst=Math.max(worst,Math.abs(flux(a,x,y,GRID)-expected));}
    }
    console.log(`${id}: padded-domain difference ${(worst/peak*100).toFixed(4)}% of peak`);assert.ok(worst/peak<.004);
  }
});
