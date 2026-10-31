// Finite-aperture helicon and Vogel-array launch fields, in wavelength units.
// J1 is tabulated from its periodic angular integral, avoiding unstable large-x series.
const step=.0025, table=new Float64Array(12001);
let ready=false;
export function besselJ1(x){
 if(!ready){for(let i=0;i<table.length;i++){let sum=0;for(let j=0;j<128;j++){const t=2*Math.PI*j/128;sum+=Math.cos(t-i*step*Math.sin(t));}table[i]=sum/128;}ready=true;}
 const sign=x<0?-1:1,p=Math.min(table.length-1.000001,Math.abs(x)/step),i=Math.floor(p),t=p-i;return sign*(table[i]*(1-t)+table[i+1]*t);
}
export function heliconTransmission(x,y){
 const r=Math.hypot(x,y);if(r>=12)return[0,0];const phi=Math.atan2(y,x),a=besselJ1(2*Math.PI*.16*r),b=besselJ1(2*Math.PI*.30*r),window=Math.exp(-((r/9.5)**8));
 return[.95*window*(a+b)*Math.cos(phi),.95*window*(a-b)*Math.sin(phi)];
}
export const SPIRAL_HOLES=Object.freeze(Array.from({length:96},(_,j)=>{const r=1.05*Math.sqrt(j+.5),p=j*Math.PI*(3-Math.sqrt(5));return[r*Math.cos(p),r*Math.sin(p)];}));
const buckets=new Map();
for(const p of SPIRAL_HOLES){const key=`${Math.floor(p[0])},${Math.floor(p[1])}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);}
export function spiralOpening(x,y){for(let iy=Math.floor(y)-1;iy<=Math.floor(y)+1;iy++)for(let ix=Math.floor(x)-1;ix<=Math.floor(x)+1;ix++)for(const p of buckets.get(`${ix},${iy}`)||[])if((x-p[0])**2+(y-p[1])**2<.42**2)return 1;return 0;}
export const STAR_VERTICES=Object.freeze(Array.from({length:10},(_,j)=>{const r=j%2?2.9:7,p=Math.PI/2+j*Math.PI/5;return[r*Math.cos(p),r*Math.sin(p)];}));
export function starOpening(x,y){let inside=false;for(let i=0,j=9;i<10;j=i++){const a=STAR_VERTICES[i],b=STAR_VERTICES[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside?1:0;}
