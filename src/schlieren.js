import {fft2,TAU} from './physics.js';

export const SCHLIEREN=Object.freeze({f:18,lens:12,beam:10,heaterY:-10.6,camera:72});

// Integrated refractive-index deficit of a warm plume at one instant.
// A meandering stem feeds the curled edges of a rising cap. The optics
// consumes only this optical path, with uniform incident phase elsewhere.
export function plumePhase(x,y){
  const height=y-SCHLIEREN.heaterY;
  if(height<0)return 0;
  const centre=.15+.15*height*Math.sin(.5*height-.8),width=.82+.095*height;
  const foot=1-Math.exp(-height*height/.38);
  const stem=foot*Math.exp(-(((x-centre)/width)**2))/(1+Math.exp(1.5*(height-12.8)));
  const capRadius=((x-.4)/3.65)**2+((y-3)/2.8)**2,cap=Math.exp(-capRadius*capRadius);
  let scrolls=0;
  for(const side of [-1,1]){
    const u=side*(x-.4)-2.45,v=y-3,r=Math.hypot(u,v);
    const angle=Math.atan2(v,u);
    scrolls+=Math.exp(-(((r-1.45)/.85)**2))*(.5+.5*Math.cos(angle-2.8*r));
  }
  return -2.55*stem-1.65*cap+.98*cap*scrolls;
}

export function schlierenRegions(difference,{n,length,advance,bandlimit}){
  const {f,lens,beam}=SCHLIEREN,dx=length/n,regions=[];
  let re=new Float64Array(n*n),im=new Float64Array(n*n);
  const coords=Float64Array.from({length:n},(_,i)=>(i-n/2)*dx);
  for(const [j,y] of coords.entries())for(const [i,x] of coords.entries()){
    const p=j*n+i,r2=(x*x+y*y)/(beam*beam),a=Math.exp(-(r2**4)),phase=plumePhase(x,y);
    re[p]=a*Math.cos(phase);im[p]=a*Math.sin(phase);
  }
  function record(z){
    fft2(re,im,n);bandlimit(re,im,n,length);
    const data=new Float32Array(4*n*n);
    if(!difference||z>=2*f){
      for(let p=0;p<re.length;p++){data[4*p]=re[p];data[4*p+1]=im[p];}
    }
    regions.push({z,data});
  }
  record(0);
  for(let station=1;station<=3;station++){
    [re,im]=advance(re,im,n,length,f);
    for(const [j,y] of coords.entries())for(const [i,x] of coords.entries()){
      const p=j*n+i;
      if(station===2){
        // Area-averaged transmission of the half-plane at the central pixel.
        const pass=Math.min(1,Math.max(0,.5+x/dx));
        // Withdrawing the blade restores precisely the blocked field. The
        // second lens acts linearly on this difference, at the same exposure.
        const transmission=difference?1-pass:pass;
        re[p]*=transmission;im[p]*=transmission;
      }else{
        const r=Math.hypot(x,y),a=Math.min(1,Math.max(0,(lens-r)/dx+.5));
        const phase=-TAU*(Math.hypot(f,r)-f),c=a*Math.cos(phase),s=a*Math.sin(phase),real=re[p];
        re[p]=c*real-s*im[p];im[p]=s*real+c*im[p];
      }
    }
    record(station*f);
  }
  return regions;
}
