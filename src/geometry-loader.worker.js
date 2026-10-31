import {BufferGeometry,BufferAttribute} from '../vendor/three.core.js';
import {binaryAsset} from './binary-assets.js';
const active=new Map(),cache=new Map();
self.onmessage=async({data})=>{
 if(data.abort){active.get(data.id)?.abort();return;}
 const controller=new AbortController();active.set(data.id,controller);
 try{
  let item=cache.get(data.path);
  if(!item){const asset=binaryAsset(data.path),response=await fetch(asset.url,{signal:controller.signal});if(!response.ok)throw Error('Optical geometry unavailable');const buffer=await new Response(asset.compressed?response.body.pipeThrough(new DecompressionStream('gzip')):response.body).arrayBuffer();controller.signal.throwIfAborted();
   const meta=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,0,1024)).split('\0')[0]),source=new Float32Array(buffer,1024,meta.vertices*3),positions=data.kind==='bunny'?new Float32Array(source.length):source;
   if(data.kind==='bunny')for(let i=0;i<source.length;i+=3){positions[i]=source[i+2];positions[i+1]=source[i+1];positions[i+2]=-source[i];}
   const indices=new Uint32Array(buffer,1024+meta.vertices*(data.kind==='bunny'?12:16),data.kind==='bunny'?meta.triangles*3:meta.indices),geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setIndex(new BufferAttribute(indices,1));geometry.computeVertexNormals();
   item={buffer,normals:geometry.attributes.normal.array,world:data.kind==='bunny'?positions:null};cache.set(data.path,item);if(cache.size>5)cache.delete(cache.keys().next().value);geometry.dispose();
  }
  controller.signal.throwIfAborted();const buffer=item.buffer.slice(0),normals=item.normals.slice(),world=item.world?.slice();self.postMessage({id:data.id,buffer,normals,world},[buffer,normals.buffer,...(world?[world.buffer]:[])]);
 }catch(error){self.postMessage({id:data.id,error:error.message});}finally{active.delete(data.id);}
};
