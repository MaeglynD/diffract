import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXPERIMENTS,boundary} from '../src/experiments.js';
import {forkLensHeight} from '../src/element-relief.js';

test('continuous fork focusing profile gives the prescribed phase up to one global offset',()=>{
 for(let j=0;j<50;j++){const r=.15+j*.19,x=r*Math.cos(.3),y=r*Math.sin(.3),[re,im]=boundary('fork',x,y),a=Math.hypot(re,im),phase=Math.PI*(forkLensHeight(r)-forkLensHeight(0));
  assert.ok(Math.hypot(a*Math.cos(phase)-re,a*Math.sin(phase)-im)<1e-12);
 }
});

test('shipped phase reliefs reproduce the complex transmission through their optical path',async()=>{
 for(const e of EXPERIMENTS.filter(e=>e.kind==='phase')){
  const b=await readFile(new URL(`../assets/elements/${e.id}.relief`,import.meta.url));
  const meta=JSON.parse(b.subarray(0,1024).toString().replace(/\0.*$/s,''));
  const offset=b.byteOffset+1024;
  const positions=new Float32Array(b.buffer,offset,meta.vertices*3),amplitudes=new Float32Array(b.buffer,offset+meta.vertices*12,meta.vertices);
  let checked=0;
  for(let i=37;i<meta.vertices;i+=131){
   const z=positions[i*3],y=positions[i*3+1],x=-positions[i*3+2],a=amplitudes[i];
   if(a<.02)continue;
   const [re,im]=boundary(e.id,x,y),height=-z-.2;
   // A 0.5 refractive-index contrast gives phase π h. Remove the common π offset.
   const phase=Math.PI*height-Math.PI;
   assert.ok(height>=-1e-6&&height<=2.000001);
   assert.ok(Math.hypot(a*Math.cos(phase)-re,a*Math.sin(phase)-im)<.0001,`${e.id}: relief mismatch at ${x},${y}`);
   checked++;
  }
  assert.ok(checked>60,`${e.id}: insufficient transmitting surface samples`);
 }
});
