import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFile,readdir} from 'node:fs/promises';
import {BufferGeometry,BufferAttribute} from '../vendor/three.core.js';

test('geometry worker preserves every source mesh and reproduces the original surface normals',{timeout:20000},async t=>{
 const module=new URL('../src/geometry-loader.worker.js',import.meta.url).href;
 const worker=new Worker(`
  const {parentPort}=require('node:worker_threads');
  const {readFile}=require('node:fs/promises');
  global.self=global;
  global.fetch=async(url,options={})=>new Response(await readFile(new URL(url),{signal:options.signal}));
  global.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);
  import(${JSON.stringify(module)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});
 `,{eval:true});
 t.after(()=>worker.terminate());
 const receive=()=>new Promise((resolve,reject)=>{const done=data=>{worker.off('error',fail);resolve(data);},fail=error=>{worker.off('message',done);reject(error);};worker.once('message',done);worker.once('error',fail);});
 await receive();
 const names=(await readdir(new URL('../assets/elements/',import.meta.url))).filter(n=>n.endsWith('.relief')).map(n=>'assets/elements/'+n);
 names.push('assets/models/bunny.mesh');
 for(const path of names){
  const bunny=path.endsWith('.mesh'),pending=receive();worker.postMessage({id:path,path,kind:bunny?'bunny':'relief'});const result=await pending;
  assert.equal(result.error,undefined,path);
  const source=await readFile(new URL('../'+path,import.meta.url));assert.deepEqual(Buffer.from(result.buffer),source,path+' source bytes');
  const buffer=source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),meta=JSON.parse(source.subarray(0,1024).toString().split('\0')[0]);
  const positions=new Float32Array(buffer,1024,meta.vertices*3),world=bunny?new Float32Array(positions.length):positions;
  if(bunny)for(let i=0;i<positions.length;i+=3)world.set([positions[i+2],positions[i+1],-positions[i]],i);
  if(bunny)assert.deepEqual(result.world,world,'physical-to-scene coordinate rotation');
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(world,3));geometry.setIndex(new BufferAttribute(new Uint32Array(buffer,1024+meta.vertices*(bunny?12:16),bunny?meta.triangles*3:meta.indices),1));geometry.computeVertexNormals();
  assert.deepEqual(result.normals,geometry.attributes.normal.array,path+' surface normals');geometry.dispose();
 }
});
