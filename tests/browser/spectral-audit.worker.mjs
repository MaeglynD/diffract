import {EXPERIMENTS} from '../../src/experiments.js';
import {SpectralVolume,decodeSpectrum} from '../../src/spectral-volume.js';
import {decodeVolume,fromHalf} from '../../src/volume-data.js';
const read=async url=>new Response((await fetch(url)).body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
self.onmessage=async({data:{id:requested}})=>{const results=[],solver=new SpectralVolume();for(const id of requested==='all'?[...EXPERIMENTS.map(e=>e.id),'double-right']:[requested])for(const quality of ['preview','full'])try{
 const started=performance.now(),s=decodeSpectrum(await read(`../../assets/spectra/${id}.spectrum.gz`)),downloadMs=performance.now()-started;
 const generated=await solver.generate(s,quality,null,progress=>self.postMessage({id,quality,completed:results.length,progress,seconds:(performance.now()-started)/1000})),computeMs=performance.now()-started-downloadMs;
 self.postMessage({id,quality,computeMs,checking:true});
 const v=decodeVolume(generated),reference=decodeVolume(await read(`../../assets/fields/${id}${quality==='preview'?'.preview':''}.bin.gz`));let error=0,power=0,maxError=0,equal=0,total=0,fluxError=0,fluxPower=0;
 for(let c=0;c<3;c++)for(let i=0;i<v.textures[c].length;i++){const a=fromHalf(v.textures[c][i]),b=fromHalf(reference.textures[c][i]),d=a-b;if(c<2||i%4<2){error+=d*d;power+=b*b;maxError=Math.max(maxError,Math.abs(d));total++;if(v.textures[c][i]===reference.textures[c][i])equal++;}else if(i%4===3){fluxError+=d*d;fluxPower+=b*b;}}
 results.push({id,quality,downloadMs,computeMs,fieldRelativeRms:Math.sqrt(error/power),fluxRelativeRms:Math.sqrt(fluxError/fluxPower),maxError,identical:equal/total,dimensions:[v.nx,v.ny,v.nz],done:true});
 }catch(error){results.push({id,quality,error:error.stack});}self.postMessage({results,done:true,passed:results.every(r=>!r.error&&r.fieldRelativeRms<.0001&&r.fluxRelativeRms<.00025)});};
