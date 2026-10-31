import {sampleField} from './volume-data.js';

// A proper rotation: physical (x,y,z) -> scene (z,y,-x).
// The SAME rotation is applied to E and cB, so E x cB keeps its handedness.
export function vectorSample(f,x,y,z){
 const envelope=Math.sqrt(.5*f.reduce((sum,v)=>sum+v*v,0));
 return {origin:[z,y,-x],er:[f[2],f[0],0],ei:[f[3],f[1],0],br:[f[8],f[6],-f[4]],bi:[f[9],f[7],-f[5]],z,envelope};
}
function quantile(weights,q){const total=weights.reduce((a,b)=>a+b,0);let sum=0;for(let i=0;i<weights.length;i++){sum+=weights[i];if(sum>=total*q)return i;}return weights.length-1;}
export function prepareVectorBounds(volume){if(volume.vectorBounds)return volume.vectorBounds;
 const boundsList=[],f=new Float32Array(10),extent=volume.half*.86,scan=21,layers=32;
 for(let iz=0;iz<layers;iz++){
  const z=.37+iz/(layers-1)*(volume.zMax-1.87),wx=new Float64Array(scan),wy=new Float64Array(scan);let peak=0;
  for(let iy=0;iy<scan;iy++)for(let ix=0;ix<scan;ix++){
   sampleField(volume,(ix/(scan-1)*2-1)*extent,(iy/(scan-1)*2-1)*extent,z,f);const energy=f.reduce((sum,v)=>sum+v*v,0);wx[ix]+=energy;wy[iy]+=energy;peak=Math.max(peak,energy);
  }
  const bounds=w=>{const lo=(quantile(w,.035)/(scan-1)*2-1)*extent,hi=(quantile(w,.965)/(scan-1)*2-1)*extent,c=(lo+hi)/2,h=Math.max(volume.analytic?.3:1.5,(hi-lo)*.55);return[Math.max(-extent,c-h),Math.min(extent,c+h)];};
  const [xmin,xmax]=bounds(wx),[ymin,ymax]=volume.analytic?[-volume.viewHeight*.7,volume.viewHeight*.7]:bounds(wy);boundsList.push({z,xmin,xmax,ymin,ymax,peak});

 }return volume.vectorBounds=boundsList;
}
export function sampleVectorVolume(volume,density=5,auxiliary=null){
 const samples=[],f=new Float32Array(10),n=Math.round(density),bounds=prepareVectorBounds(volume),other=auxiliary&&prepareVectorBounds(auxiliary);
 for(let layer=0;layer<bounds.length;layer++){
  const b=bounds[layer],a=other?.[layer]||b,z=b.z,xmin=Math.min(a.xmin,b.xmin),xmax=Math.max(a.xmax,b.xmax),ymin=Math.min(a.ymin,b.ymin),ymax=Math.max(a.ymax,b.ymax);
  const anchors=[];for(let iy=0;iy<n;iy++)for(let ix=0;ix<n;ix++)anchors.push([xmin+(xmax-xmin)*ix/(n-1),ymin+(ymax-ymin)*iy/(n-1)]);
  // An even grid can entirely miss an on-axis focus. Keep an axis sample when
  // it is illuminated, without moving any anchors as the optical phase evolves.
  if(xmin<=0&&xmax>=0&&ymin<=0&&ymax>=0&&!anchors.some(([x,y])=>Math.hypot(x,y)<.2))anchors.push([0,0]);
  for(const[x,y]of anchors){
   sampleField(volume,x,y,z,f);
   const r=auxiliary?sampleField(auxiliary,x,y,z):null;
   if(f.reduce((sum,v)=>sum+v*v,0)<Math.max(1e-8,b.peak*.002)&&(!r||r.reduce((sum,v)=>sum+v*v,0)<Math.max(1e-8,a.peak*.002)))continue;
   const sample=vectorSample(f,x,y,z);
   if(r){const right=vectorSample(r,x,y,z);let crossRe=0,crossIm=0;for(let c=0;c<10;c+=2){crossRe+=(f[c]*r[c]+f[c+1]*r[c+1])*.5;crossIm+=(f[c+1]*r[c]-f[c]*r[c+1])*.5;}sample.right=right;sample.interference=[right.envelope**2,crossRe,crossIm];}
   samples.push(sample);
  }
 }
 return samples;
}
