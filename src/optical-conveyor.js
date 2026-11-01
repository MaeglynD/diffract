import {modeVector,TAU} from './physics.js';
import {HEADER_BYTES,toHalf} from './volume-data.js';

// Both annular pupils have the same cone angle. All waves on one cone
// therefore share an axial phase factor, even for the longitudinal fields.
const sine=.45, cosine=Math.sqrt(1-sine*sine);
export const CONVEYOR=Object.freeze({length:6.5,half:3.25,beta:TAU*cosine,spacing:1/(2*cosine),sites:[-3,0,2]});
// Two legs of the delay lengthen in air. The carriage travel is in vacuum wavelengths.
export const conveyorPhase=travel=>2*TAU*travel;
export const trapPosition=(site,phase)=>CONVEYOR.length/2+site*CONVEYOR.spacing+phase/(2*CONVEYOR.beta);
const ring=Array.from({length:48},(_,i)=>{
  const a=TAU*i/48,qx=sine*Math.cos(a),qy=sine*Math.sin(a);
  return {kx:TAU*qx,ky:TAU*qy,vector:modeVector(qx,qy)};
});
// Reversing kz at fixed kx,ky reverses Ez, Bx and By. Each
// component has the transverse parity of its polarization coefficient.
const backwardSign=[1,-1,-1,-1,1];
export function coneSection(x,y){
  const section=new Float64Array(10);
  for(const {kx,ky,vector} of ring){
    const a=kx*x+ky*y,c=Math.cos(a)/ring.length,s=Math.sin(a)/ring.length;
    for(let j=0;j<5;j++){section[2*j]+=vector[j]*c;section[2*j+1]+=vector[j]*s;}
  }
  return section;
}
export function axialFactors(z,phase=0,rightOnly=false){
  const a=CONVEYOR.beta*(z-CONVEYOR.length/2),b=phase-a;
  // Textures omit the same free-space carrier as the rest of the viewer.
  return [rightOnly?0:Math.cos(a-TAU*z),rightOnly?0:Math.sin(a-TAU*z),Math.cos(b-TAU*z),Math.sin(b-TAU*z)];
}
export function conveyorField(section,[fr,fi,br,bi],out=new Float64Array(10)){
  for(let j=0;j<5;j++){
    const r=fr+backwardSign[j]*br,i=fi+backwardSign[j]*bi,a=section[2*j],b=section[2*j+1];
    out[2*j]=a*r-b*i;out[2*j+1]=a*i+b*r;
  }
  return out;
}
export async function conveyorVolume(id,signal,progress=()=>{}){
  const {half,length:zMax}=CONVEYOR,nx=53,ny=nx,nz=255,row=nx*ny*4,count=row*nz;
  const buffer=new ArrayBuffer(HEADER_BYTES+6*count);
  const textures=[0,1,2].map(i=>new Uint16Array(buffer,HEADER_BYTES+2*i*count,count));
  const sections=Array.from({length:nx*ny},(_,p)=>coneSection(half*(2*(p%nx)/(nx-1)-1),half*(2*Math.floor(p/nx)/(ny-1)-1)));
  const rightOnly=id.endsWith('-right'),f=new Float64Array(10),peaks=[];let maxE=0,maxFlux=0;
  for(let l=0;l<nz;l++){
    const factors=axialFactors(zMax*l/(nz-1),0,rightOnly);let peak=0;
    for(let p=0;p<sections.length;p++){
      conveyorField(sections[p],factors,f);const offset=l*row+4*p;
      let electric=0,magnetic=0;
      for(let i=0;i<10;i++){
        textures[i>>2][offset+(i%4)]=toHalf(f[i]);
        if(i<4)electric+=f[i]*f[i];else magnetic+=f[i]*f[i];
      }
      const density=.5*(electric+magnetic);
      textures[2][offset+2]=toHalf(electric);textures[2][offset+3]=toHalf(-(f[0]*f[4]+f[1]*f[5]));
      peak=Math.max(peak,density);maxE=Math.max(maxE,Math.sqrt(electric));
    }
    peaks.push(+peak.toFixed(5));maxFlux=Math.max(maxFlux,peak);
    if(l%16===0){signal?.throwIfAborted();progress(l/(nz-1));await new Promise(resolve=>setTimeout(resolve,0));}
  }
  const meta={version:2,id,quality:'full',analytic:true,nx,ny,nz,half,zMax,viewHeight:half,energyDensity:true,maxE,maxFlux,peaks};
  new Uint8Array(buffer,0,HEADER_BYTES).set(new TextEncoder().encode(JSON.stringify(meta)));progress(1);
  return {buffer,method:'conical-wave-sum'};
}
