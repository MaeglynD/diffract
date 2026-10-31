import {BENCH_EXPERIMENTS} from '../../src/bench-experiments.js';
import {generateSpectralBench,prepareSpectralBench,benchPlane} from '../../src/spectral-bench.js';
import {decodeVolume,sampleField} from '../../src/volume-data.js';
self.onmessage=async()=>{const results=[];for(const e of BENCH_EXPERIMENTS.filter(e=>e.spectralBench))try{
 const start=performance.now(),{buffer,method}=await generateSpectralBench(e,new AbortController().signal),v=decodeVolume(buffer),reference=prepareSpectralBench(e.id),zs=e.id==='phase-microscope'?[0,19,21,39,41,59,61,80]:[0,3,4.2,8.4,11.4,12.6,16.8];let error=0,norm=0,max=0;
 for(const z of zs){const plane=benchPlane(reference,z);for(let iy=-16;iy<=16;iy+=4)for(let ix=-16;ix<=16;ix+=4){const x=ix*.25,y=iy*.25,p=(reference.n/2+Math.round(y*reference.n/reference.length))*reference.n+reference.n/2+Math.round(x*reference.n/reference.length),a=sampleField(v,x,y,z);for(let c=0;c<5;c++)for(let ri=0;ri<2;ri++){const b=plane[c][ri?'im':'re'][p],d=a[c*2+ri]-b;error+=d*d;norm+=b*b;max=Math.max(max,Math.abs(d));}}}
 results.push({id:e.id,method,ms:Math.round(performance.now()-start),relativeRms:Math.sqrt(error/norm),maxError:max,passed:method==='gpu-optical-bench'&&Math.sqrt(error/norm)<.001});
 }catch(error){results.push({id:e.id,error:error.stack,passed:false});}self.postMessage({done:true,passed:results.every(r=>r.passed),results});};
