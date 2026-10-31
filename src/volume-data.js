// Assets contain a JSON header followed by three RGBA binary16 3D textures.
// The common exp(ikz) carrier is omitted and reconstructed analytically.
export const HEADER_BYTES = 8192;
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
export function toHalf(value) {
  f32[0] = value; const bits = u32[0], sign = (bits >>> 16) & 0x8000, exponent = ((bits >>> 23) & 0xff) - 127 + 15, mantissa = bits & 0x7fffff;
  if (exponent >= 31) return sign | 0x7c00 | ((((bits >>> 23) & 255) === 255 && mantissa) ? 0x200 : 0);
  if (exponent <= 0) {
    if (exponent < -10) return sign;
    const m = (mantissa | 0x800000) >>> (1 - exponent);
    return sign | ((m + 0x1000) >>> 13);
  }
  const rounded = mantissa + 0x1000;
  return sign | ((exponent << 10) + (rounded >>> 13));
}
export function fromHalf(bits) {
  const sign = bits & 0x8000 ? -1 : 1, exponent = (bits >>> 10) & 31, m = bits & 1023;
  if(exponent===31)return m?NaN:sign*Infinity;
  return sign * (exponent ? 2 ** (exponent - 15) * (1 + m / 1024) : 2 ** -14 * m / 1024);
}
const halfValues=Float32Array.from({length:65536},(_,i)=>fromHalf(i));
export function decodeVolume(buffer) {
  const header = new Uint8Array(buffer, 0, HEADER_BYTES), end = header.indexOf(0);
  const meta = JSON.parse(new TextDecoder().decode(header.subarray(0, end < 0 ? header.length : end)));
  if (meta.version !== 2) throw new Error('Unsupported field volume. Regenerate assets.');
  const count = meta.nx * meta.ny * meta.nz * 4;
  const textures = [0, 1, 2].map(i => new Uint16Array(buffer, HEADER_BYTES + i * count * 2, count));
  return { ...meta, textures, buffer };
}
let loader,nextRequest=0;const requests=new Map();
export function loadVolume(url,signal,onProgress=()=>{}){
 if(!loader){loader=new Worker(new URL('./field-loader.worker.js',import.meta.url),{type:'module'});loader.onmessage=({data})=>{const pending=requests.get(data.id);if(!pending)return;if(data.progress!==undefined){pending.onProgress(data.progress);return;}requests.delete(data.id);pending.cleanup();if(data.error)pending.reject(new Error(data.error));else pending.resolve(Object.assign(decodeVolume(data.buffer),{vectorBounds:data.vectorBounds,bunnyStrength:data.bunnyStrength,energy:data.energy,loadMetrics:data.metrics}));};loader.onerror=event=>{for(const p of requests.values()){p.cleanup();p.reject(new Error(event.message||'Field loader interrupted.'));}requests.clear();loader.terminate();loader=null;};}
 const id=++nextRequest;return new Promise((resolve,reject)=>{const abort=()=>{loader.postMessage({id,abort:true});requests.delete(id);reject(new DOMException('Aborted','AbortError'));};if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});requests.set(id,{resolve,reject,onProgress,cleanup:()=>signal?.removeEventListener('abort',abort)});loader.postMessage({id,url:new URL(url,document.baseURI).href});});
}

export function sampleField(volume, x, y, z, out = new Float32Array(10)) {
  const { nx, ny, nz, half, zMax, textures } = volume;
  const px = Math.min(nx - 1.00001, Math.max(0, (x / (2 * half) + .5) * (nx - 1)));
  const py = Math.min(ny - 1.00001, Math.max(0, (y / (2 * half) + .5) * (ny - 1)));
  const pz = Math.min(nz - 1.00001, Math.max(0, axialIndex(volume,z)));
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz), fx = px - ix, fy = py - iy, fz = pz - iz;
  out.fill(0);
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const index = (((iz + dz) * ny + iy + dy) * nx + ix + dx) * 4;
    const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
    for (let c = 0; c < 10; c++) out[c] += halfValues[textures[Math.floor(c / 4)][index + c % 4]] * w;
  }
  return out;
}
export function normalizedFlux(f) { return -(f[0] * f[4] + f[1] * f[5]); }
export function axialIndex(volume,z){return volume.interfaceZ?z/volume.zMax*(volume.nz-2)+(z>=volume.interfaceZ?1:0):z/volume.zMax*(volume.nz-1);}

// An adaptive display reveals weak fringes; fixed exposure preserves changes
// in absolute brightness as the observation plane crosses a focus.
export function detectorPeak(volume,z,exposure='adaptive'){
  if(exposure==='fixed')return volume.maxFlux;
  const p=Math.max(0,Math.min(volume.peaks.length-1,axialIndex({...volume,nz:volume.peaks.length},z))),i=Math.min(volume.peaks.length-2,Math.floor(p)),f=p-i;
  return volume.peaks[i]*(1-f)+volume.peaks[i+1]*f;
}

/** Change the phase of the right opening, after coherent propagation. */
export function mixSlitPhase(field,right,phase){
 const c=Math.cos(phase)-1,s=Math.sin(phase);
 for(let i=0;i<10;i+=2){field[i]+=c*right[i]-s*right[i+1];field[i+1]+=s*right[i]+c*right[i+1];}
 return field;
}
