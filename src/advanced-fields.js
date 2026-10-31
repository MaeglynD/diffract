import {TAU} from './physics.js';

// Ai''(x)=x Ai(x), with the NIST DLMF 9.2 initial values. A small RK4
// table and cubic Hermite interpolation avoid cancellation in the oscillatory
// power series. The bounded domain covers every point of this experiment.
const H=.001, MIN=-16, MAX=6;
let airyTable;
function table(){
  if(airyTable)return airyTable;
  const value=new Float64Array((MAX-MIN)/H+1),derivative=new Float64Array(value.length),zero=-MIN/H;
  value[zero]=.35502805388781723926;derivative[zero]=-.25881940379280679841;
  for(const direction of [-1,1]){
    const h=direction*H,end=direction<0?0:value.length-1;
    for(let i=zero;i!==end;i+=direction){
      const x=MIN+i*H,y=value[i],v=derivative[i];
      const a1=v,b1=x*y,a2=v+h*b1/2,b2=(x+h/2)*(y+h*a1/2);
      const a3=v+h*b2/2,b3=(x+h/2)*(y+h*a2/2),a4=v+h*b3,b4=(x+h)*(y+h*a3);
      value[i+direction]=y+h*(a1+2*a2+2*a3+a4)/6;
      derivative[i+direction]=v+h*(b1+2*b2+2*b3+b4)/6;
    }
  }
  return airyTable={value,derivative};
}
export function airyAi(x){
  if(x<MIN||x>MAX)throw new RangeError('Airy table argument outside [-16, 6]');
  const {value,derivative}=table(),p=(x-MIN)/H,i=Math.min(value.length-2,Math.floor(p)),t=p-i;
  return (2*t**3-3*t*t+1)*value[i]+(t**3-2*t*t+t)*H*derivative[i]
    +(-2*t**3+3*t*t)*value[i+1]+(t**3-t*t)*H*derivative[i+1];
}

export function autofocusingRing(x,y){
  const r=Math.hypot(x,y);if(r>=12)return[0,0];
  const s=(4.5-r)/.9;
  return[2*airyAi(s)*Math.exp(.09*s),0];
}
export function forkGrating(x,y){
  const r=Math.hypot(x,y);
  if(r>=10||Math.cos(TAU*x/4-Math.atan2(y,x))<=0)return[0,0];
  const a=Math.exp(-r*r/49),p=-Math.PI*r*r/32;
  return[a*Math.cos(p),a*Math.sin(p)];
}
export function astigmaticLens(x,y){
  const r=Math.hypot(x,y);if(r>=9)return[0,0];
  const a=Math.exp(-r*r/5.5**2),p=-Math.PI*(x*x/20+y*y/42);
  return[a*Math.cos(p),a*Math.sin(p)];
}
export function poissonDisc(x,y){
  const r=Math.hypot(x,y);
  return[r>4&&r<12?Math.exp(-r*r/100):0,0];
}
