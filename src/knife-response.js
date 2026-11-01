import {sampleField} from './volume-data.js';
import {SCHLIEREN} from './schlieren.js';

// The slider knots are the boundaries of the mask pixels on the 256-point
// optical grid. Between two knots only one column changes its open fraction.
// All subsequent field operations are linear in that fraction.
export const KNIFE={tiles:4,width:49,knots:14};
export const splineShader=`
vec4 bladeTile(highp sampler3D atlas,float tile,vec2 a,vec2 b,vec2 w,float z){
 vec2 base=vec2(mod(tile,4.),floor(tile/4.))*.25;
 a+=base;b+=base;
 return mix(mix(texture(atlas,vec3(a,z)),texture(atlas,vec3(b.x,a.y,z)),w.x),
            mix(texture(atlas,vec3(a.x,b.y,z)),texture(atlas,vec3(b,z)),w.x),w.y);
}
vec4 bladeField(highp sampler3D atlas,vec3 uv){
 vec3 p=(uv*dimensions-.5)/(dimensions-1.);
 vec3 size=vec3(textureSize(atlas,0));vec2 tile=size.xy/4.;
 vec2 pos=clamp(p.xy,0.,1.)*(tile-1.),i=floor(pos),f=fract(pos),s=1.-f;
 vec2 w0=s*s*s/6.,w1=(4.-6.*f*f+3.*f*f*f)/6.,w2=(1.+3.*f+3.*f*f-3.*f*f*f)/6.,w3=f*f*f/6.;
 vec2 a=(max(vec2(0.),i-1.+w1/(w0+w1))+.5)/size.xy,b=(min(tile-1.,i+1.+w3/(w2+w3))+.5)/size.xy;
 float z=((2.*p.z-1.)*(size.z-1.)+.5)/size.z;
 return mix(bladeTile(atlas,bladeInterval.x,a,b,w2+w3,z),bladeTile(atlas,bladeInterval.y,a,b,w2+w3,z),bladeInterval.z);
}`;
export function bladeInterval(edge){
  const position=Math.max(0,Math.min(KNIFE.knots-1,(edge+SCHLIEREN.bladeLimit)/SCHLIEREN.bladeStep));
  const lo=Math.min(KNIFE.knots-2,Math.floor(position));
  return [lo,lo+1,position-lo];
}
export function bladeSampler(volume,atlas){
  const base={...volume,liveSampler:null},a=new Float32Array(10),b=new Float32Array(10),tap=new Float32Array(10);
  function cubicAxis(v){
    const p=Math.max(0,Math.min(KNIFE.width-1,(v/(2*atlas.half)+.5)*(KNIFE.width-1)));
    const i=Math.floor(p),f=p-i,s=1-f,w0=s**3/6,w1=(4-6*f*f+3*f**3)/6,w2=(1+3*f+3*f*f-3*f**3)/6,w3=f**3/6;
    return [Math.max(0,i-1+w1/(w0+w1)),Math.min(KNIFE.width-1,i+1+w3/(w2+w3)),w2+w3];
  }
  function sampleTile(tile,x,y,z,out){
    const {width,tiles}=KNIFE,n=width*tiles-1;
    const mapped=(v,i)=>2*atlas.half*((i*width+v)/n-.5);
    out.fill(0);
    for(let j=0;j<2;j++)for(let i=0;i<2;i++){
      const weight=(i?x[2]:1-x[2])*(j?y[2]:1-y[2]);
      sampleField(atlas,mapped(x[i],tile%tiles),mapped(y[j],Math.floor(tile/tiles)),z-2*SCHLIEREN.f,tap);
      for(let c=0;c<10;c++)out[c]+=weight*tap[c];
    }
  }
  return (interval,x,y,z,out=new Float32Array(10))=>{
    if(z<2*SCHLIEREN.f)return sampleField(base,x,y,z,out);
    const [lo,hi,t]=interval;
    const px=cubicAxis(x),py=cubicAxis(y);
    sampleTile(lo,px,py,z,a);sampleTile(hi,px,py,z,b);
    for(let j=0;j<10;j++)out[j]=a[j]+t*(b[j]-a[j]);
    return out;
  };
}
