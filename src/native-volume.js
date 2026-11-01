import {HEADER_BYTES,toHalf} from './volume-data.js';
import {nativeModel,energyDensity} from './native-fields.js';
import {NATIVE_EXPERIMENTS} from './native-experiments.js';
import {generateSpectralBench} from './spectral-bench.js';
import {conveyorVolume} from './optical-conveyor.js';

// y-invariance permits two identical rows, with no loss of field information.
// Backward waves need finer axial sampling than the forward angular spectra.
// All native scenes are generated at full quality immediately, with no downloads
// and no later resolution swap. The fields themselves remain monochromatic.
export async function generateNativeVolume(id,signal,progress=()=>{}){
 const e=NATIVE_EXPERIMENTS.find(e=>e.id===id.replace(/-(right|bright)$/,''));if(!e)throw Error('Unknown native volume');
 if(e.spectralBench)return generateSpectralBench({...e,id},signal,progress);
 if(e.id==='conveyor')return conveyorVolume(id,signal,progress);
 const dx=id==='sound-cell'?.125:id==='grin'?.06:id==='absorber'?.08:id==='tunnelling'?.02:id.startsWith('michelson')?.075:.04,dz=id==='sound-cell'?.125:id==='grin'?.06:id==='absorber'?.035:id==='tunnelling'?.018:id==='bragg-cavity'?.012:id.startsWith('michelson')?.055:.035;
 const nx=Math.ceil(2*e.half/dx)+1,ny=2,nz=Math.ceil(e.zMax/dz)+1,count=nx*ny*nz*4;
 const buffer=new ArrayBuffer(HEADER_BYTES+count*6),textures=[0,1,2].map(i=>new Uint16Array(buffer,HEADER_BYTES+i*count*2,count)),permittivity=new Float32Array(nx*nz),model=nativeModel(id),f=new Float64Array(10),peaks=[];
 const xs=Float64Array.from({length:nx},(_,i)=>(i/(nx-1)*2-1)*e.half);let maxE=0,maxFlux=0,last=performance.now();
 for(let iz=0;iz<nz;iz++){
  const z=iz/(nz-1)*e.zMax,c=Math.cos(2*Math.PI*z),s=Math.sin(2*Math.PI*z),row=model.row?.(xs,z);let peak=0;
  for(let ix=0;ix<nx;ix++){
   const x=xs[ix];if(row)f.set(row.subarray(ix*10,ix*10+10));else model.field(x,z,f);const epsilon=model.epsilon(x,z);permittivity[iz*nx+ix]=epsilon;
   const flux=-(f[0]*f[4]+f[1]*f[5]),energy=energyDensity(f,epsilon);peak=Math.max(peak,e.energyDensity?energy:flux);maxE=Math.max(maxE,Math.hypot(f[0],f[1],f[2],f[3]));
   for(let iy=0;iy<2;iy++){const p=((iz*ny+iy)*nx+ix)*4;for(let j=0;j<10;j+=2){const t=textures[Math.floor(j/4)],at=p+j%4;t[at]=toHalf(f[j]*c+f[j+1]*s);t[at+1]=toHalf(f[j+1]*c-f[j]*s);}textures[2][p+2]=toHalf(energy);textures[2][p+3]=toHalf(flux);}
  }
  peaks.push(Number(peak.toPrecision(5)));maxFlux=Math.max(maxFlux,peak);
  if(performance.now()-last>10){signal?.throwIfAborted();progress((iz+1)/nz);await new Promise(r=>setTimeout(r,0));last=performance.now();}
 }
 // Exposure metadata has its own axial resolution; the full complex field is
 // untouched. Long instruments otherwise overflow the fixed asset header.
 const exposurePeaks=peaks.length<=512?peaks:Array.from({length:512},(_,i)=>{const p=i/511*(peaks.length-1),a=Math.floor(p),f=p-a;return Number((peaks[a]*(1-f)+peaks[Math.min(a+1,peaks.length-1)]*f).toPrecision(5));});
 const meta={version:2,id,quality:'full',analytic:true,nx,ny,nz,half:e.half,zMax:e.zMax,maxE,maxFlux,peaks:exposurePeaks,viewHeight:e.viewHeight,energyDensity:!!e.energyDensity};
 const bytes=new TextEncoder().encode(JSON.stringify(meta));if(bytes.length>=HEADER_BYTES)throw Error('Native field metadata exceeds header');new Uint8Array(buffer,0,bytes.length).set(bytes);
 return {buffer,permittivity};
}
