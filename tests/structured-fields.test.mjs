import test from 'node:test';
import assert from 'node:assert/strict';
import {besselJ1} from '../src/structured-fields.js';
import {buildSpectrum,GRID} from '../src/experiments.js';
import {propagate,sampleComplex} from '../src/physics.js';

test('Bessel launch functions match independent tabulated values and a known zero',()=>{
 for(const[x,value]of[[0,0],[1,.4400505857449335],[5,-.3275791375914652],[10,.0434727461688614],[3.8317059702075125,0]])assert.ok(Math.abs(besselJ1(x)-value)<4e-7,`J1(${x})`);
 assert.ok(Math.abs(besselJ1(-5)+besselJ1(5))<1e-12);
});

test('the finite helicon rotates at the rate set by its distinct longitudinal wave numbers',()=>{
 const spectrum=buildSpectrum('helix'),angles=[];
 for(const z of[0,8]){
  const fields=propagate(spectrum,z,[0,2]);let real=0,imaginary=0,total=0;
  for(let r=.5;r<=2.5;r+=.25)for(let j=0;j<128;j++){
   const phi=2*Math.PI*j/128,e=sampleComplex(fields[0],r*Math.cos(phi),r*Math.sin(phi),GRID),b=sampleComplex(fields[1],r*Math.cos(phi),r*Math.sin(phi),GRID),flux=-r*(e[0]*b[0]+e[1]*b[1]);
   real+=flux*Math.cos(2*phi);imaginary+=flux*Math.sin(2*phi);total+=flux;
  }
  assert.ok(Math.hypot(real,imaginary)/total>.14,'two-lobed angular structure must remain resolved');angles.push(Math.atan2(imaginary,real)/2);
 }
 const expected=-Math.PI*(Math.sqrt(1-.16**2)-Math.sqrt(1-.30**2))*8;
 console.log(`Helicon rotation: ${((angles[1]-angles[0])*180/Math.PI).toFixed(2)}°, ideal cone prediction ${(expected*180/Math.PI).toFixed(2)}°`);
 assert.ok(Math.abs(angles[1]-angles[0]-expected)<.025,'early propagation agrees with the ideal Bessel-cone phase difference');
});
