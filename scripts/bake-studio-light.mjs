// A small reflection atlas for the tabletop lighting study. Each rectangle
// represents a studio diffuser; rough surfaces see wider, dimmer reflections.
import {mkdir, writeFile} from 'node:fs/promises';
import {png} from './png.mjs';

const unit = v => v.map(x => x / Math.hypot(...v));
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function card(aim, width, height, light) {
  const normal = unit(aim), right = unit(cross(normal,[0,1,0]));
  return {normal, right, up:cross(right,normal), width, height, light};
}
const cards = [
  card([-.72,.82,.46], .90,.49, [6.6,5.5,4.0]),  // overhead silk
  card([.54,.32,-.87], .095,1.05, [3.8,5.7,8.4]), // narrow cool edge
  card([-.9,.12,-.32], .08,.72, [6.2,3.6,1.8]),   // warm strip behind the metalwork
  card([.72,.68,.45], .56,.18, [3.4,3.9,4.2]),
  // Low bounce cards are reflected in upright optics seen from above.
  card([-.42,-.47,-.80], .68,.12, [3.9,4.6,5.2]),
  card([ .38,-.48,.80], .59,.09, [3.2,2.8,2.1])
];
function radiance(d) {
  const sky = Math.max(0,d[1]);
  const rgb = [.07+.26*sky,.08+.30*sky,.10+.36*sky];
  for(const c of cards) {
    const front=dot(d,c.normal);
    if(front<=0) continue;
    const u=Math.abs(dot(d,c.right))/(front*c.width), v=Math.abs(dot(d,c.up))/(front*c.height);
    const t=Math.max(0,Math.min(1,(1.07-Math.max(u,v))/.14));
    const power=t*t*(3-2*t);
    for(let i=0;i<3;i++) rgb[i]+=c.light[i]*power;
  }
  return rgb;
}
// Three's CubeUV layout includes a one-texel gutter on each face and six
// progressively rougher 16px levels along the last row.
const size=64, width=3*16*7, height=4*size, pixels=new Uint8Array(width*height*4);
const roughness=[1,.8,.67,.53,.4,.305,.21,.15,0]; // mip -2 through 6
const toByte=x=>Math.round(255*(x<=.0031308 ? 12.92*x : 1.055*x**(1/2.4)-.055));
for(let mip=-2;mip<=6;mip++) {
  const n=Math.max(16,2**mip), alpha=roughness[mip+2]**2, count=alpha===0?1:128;
  const samples=Array.from({length:count},(_,i)=>{
    const t=(i+.5)/count, phi=i*2.399963229728653;
    const cosH=Math.sqrt((1-t)/(1+(alpha*alpha-1)*t)), z=2*cosH*cosH-1;
    const r=Math.sqrt(Math.max(0,1-z*z));
    return [r*Math.cos(phi),r*Math.sin(phi),z];
  }).filter(s=>s[2]>0);
  for(let face=0;face<6;face++) for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
    const u=2*((x-.5)/(n-2))-1, v=2*((y-.5)/(n-2))-1;
    const d=unit([[1,v,u],[-u,1,-v],[-u,v,1],[-1,v,-u],[-u,-1,v],[u,v,-1]][face]);
    const right=unit(cross(d,Math.abs(d[1])<.98?[0,1,0]:[0,0,1])), up=cross(right,d);
    const rgb=[0,0,0]; let weight=0;
    for(const [a,b,c] of samples) {
      const light=radiance(d.map((value,i)=>a*right[i]+b*up[i]+c*value));
      for(let i=0;i<3;i++) rgb[i]+=light[i]*c;
      weight+=c;
    }
    const col=Math.max(0,4-mip)*48+(face%3)*n+x;
    const row=4*(size-n)+(face>=3?n:0)+y;
    const offset=4*((height-1-row)*width+col);
    for(let i=0;i<3;i++) pixels[offset+i]=toByte(rgb[i]/(10*weight));
    pixels[offset+3]=255;
  }
}
const directory=new URL('../assets/lighting/',import.meta.url);
await mkdir(directory,{recursive:true});
await writeFile(new URL('silver-studio.png',directory),png(width,height,pixels));
