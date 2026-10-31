import test from 'node:test';
import assert from 'node:assert/strict';
import {airyAi} from '../src/advanced-fields.js';
import {buildSpectrum,GRID} from '../src/experiments.js';
import {propagate,sampleComplex,fluxZ,TAU} from '../src/physics.js';
import {detectorPeak} from '../src/volume-data.js';

test('Airy evaluation matches tabulated values, zeros and the defining differential equation',()=>{
  // NIST DLMF 9.2, 9.9; values independently tabulated to double precision.
  for(const[x,y]of [[0,.3550280538878172],[-1,.5355608832923521],[1,.1352924163128814],[3,.006591139357460719],[5,.0001083444281360744],[-5,.3507610090241143],[-8,-.0527050503563862]])assert.ok(Math.abs(airyAi(x)-y)<2e-9,`${x}: ${airyAi(x)}`);
  for(const x of[-2.338107410459767,-4.08794944413097,-5.520559828095551])assert.ok(Math.abs(airyAi(x))<1e-10);
  const h=.002;for(let x=-12.127;x<5;x+=.73){const derivative=(airyAi(x+h)-2*airyAi(x)+airyAi(x-h))/(h*h);assert.ok(Math.abs(derivative-x*airyAi(x))<.000025);}
});

test('finite Airy ring autofocuses without an added lens and fixed exposure preserves its gain',()=>{
  const s=buildSpectrum('autofocus'),[launch,bLaunch]=propagate(s,0,[0,2]);let peak=0;
  for(let i=0;i<launch.re.length;i++)peak=Math.max(peak,fluxZ(launch,bLaunch,i));
  const axis=z=>{const[e,b]=propagate(s,z,[0,2]);return fluxZ(e,b,GRID.n*(GRID.n/2)+GRID.n/2);};
  const focus=axis(22),early=axis(10),late=axis(40);
  assert.ok(focus/peak>15&&focus/peak<20);assert.ok(focus>early*10&&focus>late*3);
  const v={zMax:40,maxFlux:focus,peaks:[peak,focus,late]};
  assert.equal(detectorPeak(v,0,'fixed'),detectorPeak(v,40,'fixed'));
  assert.equal(detectorPeak(v,0,'adaptive'),peak);assert.equal(detectorPeak(v,10,'adaptive'),(peak+focus)/2);
  console.log(`Airy peak enhancement ${(focus/peak).toFixed(2)}×; early/on-focus/late axial flux ${[early,focus,late].map(x=>x.toFixed(3)).join('/')}`);
});

test('fork grating creates first orders with opposite topological charge',()=>{
  const[field]=propagate(buildSpectrum('fork'),30,[0]);
  for(const[cx,expected]of[[-8,1],[8,-1]]){
    let phaseSum=0,last;let ring=0;
    for(let j=0;j<=256;j++){
      const a=TAU*j/256,[re,im]=sampleComplex(field,cx+Math.cos(a),Math.sin(a),GRID),p=Math.atan2(im,re);
      if(last!==undefined)phaseSum+=Math.atan2(Math.sin(p-last),Math.cos(p-last));last=p;ring+=re*re+im*im;
    }
    assert.ok(Math.abs(phaseSum/TAU-expected)<1e-10);
    // Locate the zero within a half-wavelength neighbourhood, independently of
    // the paraxial estimate used to choose the integration loop.
    let core=Infinity;for(let x=cx-.5;x<=cx+.5;x+=.125)for(let y=-.5;y<=.5;y+=.125){const f=sampleComplex(field,x,y,GRID);core=Math.min(core,f[0]**2+f[1]**2);}
    assert.ok(core<ring/257*.03);
  }
});

test('astigmatic field produces orthogonal line waists at separate depths',()=>{
  const s=buildSpectrum('astigmatism');
  const width=z=>{const[e,b]=propagate(s,z,[0,2]);let total=0,x2=0,y2=0;for(let j=0;j<GRID.n;j++)for(let i=0;i<GRID.n;i++){const x=(i-GRID.n/2)*.25,y=(j-GRID.n/2)*.25;if(Math.max(Math.abs(x),Math.abs(y))>=10)continue;const p=fluxZ(e,b,j*GRID.n+i);total+=p;x2+=x*x*p;y2+=y*y*p;}return[Math.sqrt(x2/total),Math.sqrt(y2/total)];};
  const a=width(18),b=width(34);assert.ok(a[0]<a[1]*.45);assert.ok(b[1]<b[0]*.6);assert.ok(a[0]<b[0]*.4&&b[1]<a[1]*.8);
  console.log(`Astigmatic RMS widths: z=18 (${a.map(v=>v.toFixed(3))}); z=34 (${b.map(v=>v.toFixed(3))}) λ`);
});

test('Poisson axial field agrees with independent Rayleigh–Sommerfeld annulus integration',()=>{
  const s=buildSpectrum('poisson');
  // On-axis RS-I kernel, directly integrated in real space. No FFT, angular
  // spectrum, mode basis or paraxial expansion is used in this reference.
  function reference(z){let re=0,im=0;const n=16000,h=8/n;for(let j=0;j<=n;j++){const r=4+j*h,d=Math.hypot(r,z),p=TAU*(d-z),a=z*r*Math.exp(-r*r/100)/(d*d*d),w=j===0||j===n?1:j%2?4:2;re+=w*a*(Math.cos(p)+TAU*d*Math.sin(p));im+=w*a*(Math.sin(p)-TAU*d*Math.cos(p));}return[re*h/3,im*h/3];}
  for(const z of[28,40,52]){const[e]=propagate(s,z,[0]),a=sampleComplex(e,0,0,GRID),b=reference(z),relative=Math.hypot(a[0]-b[0],a[1]-b[1])/Math.hypot(...b);console.log(`Poisson RS axial amplitude error at ${z}λ: ${(100*relative).toFixed(3)}%`);assert.ok(relative<.025);}
  const[e,b]=propagate(s,20,[0,2]),at=GRID.n*(GRID.n/2)+GRID.n/2,center=fluxZ(e,b,at);let minimum=Infinity;
  for(let i=2;i<=12;i++)minimum=Math.min(minimum,fluxZ(e,b,at+i));assert.ok(center>minimum*4&&center>.3);
});
