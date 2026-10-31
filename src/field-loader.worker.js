import {decodeVolume,sampleField} from './volume-data.js';
import {energyVolumeAsync} from './energy-volume.js';
import {prepareVectorBounds} from './vector-samples.js';
import {openFieldStream} from './field-stream.js';
import {SpectralVolume,decodeSpectrum} from './spectral-volume.js';
import {spectrumUrl} from './spectrum-assets.js';

const active=new Map(),spectra=new Map();let mesh,solver,queue=Promise.resolve();
async function compactField(url,signal,progress){
 const name=new URL(url).pathname.split('/').pop(),id=name.replace(/(?:\.preview)?\.bin\.gz$/,''),quality=name.includes('.preview.')?'preview':'full';
 let spectrum=spectra.get(id);
 if(!spectrum){const response=await fetch(spectrumUrl(id),{signal});if(!response.ok)throw Error('Angular spectrum unavailable');spectrum=decodeSpectrum(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());signal.throwIfAborted();spectra.set(id,spectrum);}
 progress(.08);solver??=new SpectralVolume();return solver.generate(spectrum,quality,signal,p=>progress(.08+p*.67));
}
async function run(data,controller){
 const started=performance.now(),signal=controller.signal,progress=value=>self.postMessage({id:data.id,progress:value});
 try{
  signal.throwIfAborted();let buffer,method='spectrum',fallbackReason;
  try{buffer=await compactField(data.url,signal,progress);}catch(error){signal.throwIfAborted();method='stored-volume';fallbackReason=error.message;const stream=await openFieldStream(data.url,signal);buffer=await new Response(stream.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
  signal.throwIfAborted();const reconstructed=performance.now(),v=decodeVolume(buffer),vectorBounds=prepareVectorBounds(v),energy=data.url.includes('double-right')?null:await energyVolumeAsync(v,signal,p=>progress(.75+p*.23));let bunnyStrength;
  if(/\/bunny(?:\.preview)?\.bin\.gz/.test(data.url)){
   mesh??=fetch(new URL('../assets/models/bunny.mesh',import.meta.url)).then(r=>r.arrayBuffer());const bytes=await mesh,meta=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,0,1024)).split('\0')[0]),p=new Float32Array(bytes,1024,meta.vertices*3),f=new Float32Array(10);bunnyStrength=new Float32Array(meta.vertices);let maximum=0;
   for(let i=0;i<meta.vertices;i++){sampleField(v,p[i*3],p[i*3+1],meta.centerZ+p[i*3+2],f);let energy=0;for(const c of f)energy+=c*c*.5;bunnyStrength[i]=energy;maximum=Math.max(maximum,energy);}for(let i=0;i<bunnyStrength.length;i++)bunnyStrength[i]/=Math.max(maximum*.4,1e-6);
  }
  signal.throwIfAborted();const metrics={method,fallbackReason,reconstructMs:reconstructed-started,prepareMs:performance.now()-reconstructed};self.postMessage({id:data.id,buffer,vectorBounds,bunnyStrength,energy,metrics},[buffer,...(bunnyStrength?[bunnyStrength.buffer]:[]),...(energy?[energy.buffer]:[])]);
 }catch(error){self.postMessage({id:data.id,error:error.message});}finally{active.delete(data.id);}
}
self.onmessage=({data})=>{
 if(data.abort){active.get(data.id)?.abort();return;}
 const controller=new AbortController();active.set(data.id,controller);
 // Serialize reconstruction: superseded jobs yield frequently and abort before
 // the next job reuses the FFT targets.
 queue=queue.then(()=>run(data,controller));
};
