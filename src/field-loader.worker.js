import {decodeVolume,sampleField} from './volume-data.js';
import {energyVolume} from './energy-volume.js';
import {prepareVectorBounds} from './vector-samples.js';
import {openFieldStream} from './field-stream.js';
const active=new Map();let mesh;
self.onmessage=async({data})=>{
 if(data.abort){active.get(data.id)?.abort();return;}
 const controller=new AbortController();active.set(data.id,controller);
 try{
  const stream=await openFieldStream(data.url,controller.signal);
  const buffer=await new Response(stream.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();controller.signal.throwIfAborted();
  const v=decodeVolume(buffer),vectorBounds=prepareVectorBounds(v),energy=data.url.includes('double-right')?null:energyVolume(v);let bunnyStrength;
  if(/\/bunny(?:\.preview)?\.bin\.gz/.test(data.url)){
   mesh??=fetch(new URL('../assets/models/bunny.mesh',import.meta.url)).then(r=>r.arrayBuffer());const bytes=await mesh,meta=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,0,1024)).split('\0')[0]),p=new Float32Array(bytes,1024,meta.vertices*3),f=new Float32Array(10);bunnyStrength=new Float32Array(meta.vertices);let maximum=0;
   for(let i=0;i<meta.vertices;i++){sampleField(v,p[i*3],p[i*3+1],meta.centerZ+p[i*3+2],f);let energy=0;for(const c of f)energy+=c*c*.5;bunnyStrength[i]=energy;maximum=Math.max(maximum,energy);}for(let i=0;i<bunnyStrength.length;i++)bunnyStrength[i]/=Math.max(maximum*.4,1e-6);
  }
  controller.signal.throwIfAborted();self.postMessage({id:data.id,buffer,vectorBounds,bunnyStrength,energy},bunnyStrength?[buffer,bunnyStrength.buffer,energy.buffer]:energy?[buffer,energy.buffer]:[buffer]);
 }catch(error){self.postMessage({id:data.id,error:error.message});}finally{active.delete(data.id);}
};
