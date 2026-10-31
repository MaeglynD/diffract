import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {BUNNY_SURFACE,BUNNY_CENTER} from '../src/bunny-surface.js';
import {prepareBunnyHologram} from '../src/bunny-hologram.js';
import {decodeVolume,sampleField,normalizedFlux} from '../src/volume-data.js';

test('the hologram depends on the bunny surface depths, not only its silhouette',()=>{
 assert.ok(BUNNY_SURFACE.length>4000);const depths=BUNNY_SURFACE.map(p=>p[2]);assert.ok(Math.max(...depths)-Math.min(...depths)>18);
 const spatial=prepareBunnyHologram(),flat=prepareBunnyHologram(BUNNY_SURFACE.map(p=>[p[0],p[1],BUNNY_CENTER,p[3],p[4]]));let a2=0,b2=0,re=0,im=0;
 for(let j=64;j<192;j++)for(let i=64;i<192;i++){const k=j*256+i,ar=spatial.re[k],ai=spatial.im[k],br=flat.re[k],bi=flat.im[k];a2+=ar*ar+ai*ai;b2+=br*br+bi*bi;re+=ar*br+ai*bi;im+=ai*br-ar*bi;}
 const correlation=Math.hypot(re,im)/Math.sqrt(a2*b2);console.log('3D versus flattened complex hologram correlation:',correlation.toFixed(4));assert.ok(correlation<.85,'collapsing depth must materially change the optical field');
});

test('the calculated reconstruction concentrates energy near the actual 3D surface',async()=>{
 const binary=gunzipSync(await readFile(new URL('../assets/fields/bunny.bin.gz',import.meta.url))),v=decodeVolume(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength));
 const means=[0,-14,14].map(shift=>{let flux=0;for(const[x,y,z]of BUNNY_SURFACE)flux+=normalizedFlux(sampleField(v,x,y,z+shift));return flux/BUNNY_SURFACE.length;});
 console.log('Bunny surface flux and depth-shifted controls:',means.map(v=>v.toFixed(4)).join(', '));assert.ok(means[0]>(means[1]+means[2])*.65,'surface should exceed the mean of depth-shifted controls by at least 30%');
});
