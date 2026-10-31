import {benchModel} from './bench-fields.js';
export const K=2*Math.PI;
export const LIVE_IDS=['michelson','grin','absorber'];
export const GRIN={n:1.65,a:.22,modes:22};
export const LIVE_DEFAULT={michelson:.12,grin:1.8,absorber:0};
export function liveModel(id,parameter=LIVE_DEFAULT[id]){
 if(id==='michelson')return benchModel(id,parameter);
 if(id==='absorber'){
  const d=[Math.cos(parameter),Math.sin(parameter)],r=[(d[0]-1)/2,d[1]/2];
  return{epsilon:()=>1,field(x,z,out=new Float64Array(10)){out.fill(0);const s=K*(z-10),c=Math.cos(s),t=Math.sin(s),A=z<10?[1,0]:[-r[0],-r[1]],B=z<10?r:d;
   const fr=A[0]*c-A[1]*t,fi=A[0]*t+A[1]*c,br=B[0]*c+B[1]*t,bi=-B[0]*t+B[1]*c;out[0]=fr+br;out[1]=fi+bi;out[4]=br-fr;out[5]=bi-fi;return out;}};
 }
 if(id==='grin'){
  const gamma=K*GRIN.a,alpha=Math.sqrt(gamma/2)*parameter,coeff=[],betas=[];let c=Math.exp(-alpha*alpha/2);
  for(let m=0;m<GRIN.modes;m++){if(m)c*=alpha/Math.sqrt(m);coeff.push(c);betas.push(Math.sqrt(K*K*GRIN.n**2-gamma*(2*m+1)));}
  return{epsilon:x=>GRIN.n**2-GRIN.a**2*x*x,field(x,z,out=new Float64Array(10)){out.fill(0);let prev=0,f=Math.exp(-gamma*x*x/2);
   for(let m=0;m<GRIN.modes;m++){const derivative=Math.sqrt(2*gamma*m)*prev-gamma*x*f,a=betas[m]*z,c=coeff[m]*Math.cos(a),s=coeff[m]*Math.sin(a);out[0]+=f*c;out[1]+=f*s;out[4]-=betas[m]/K*f*c;out[5]-=betas[m]/K*f*s;out[8]+=derivative*s/K;out[9]-=derivative*c/K;const next=Math.sqrt(2/(m+1))*Math.sqrt(gamma)*x*f-Math.sqrt(m/(m+1))*prev;prev=f;f=next;}return out;}};
 }
 throw Error('Unknown live instrument '+id);
}
export function demodulated(model,x,z,out=new Float32Array(10)){model.field(x,z,out);const c=Math.cos(K*z),s=Math.sin(K*z);for(let i=0;i<10;i+=2){const a=out[i],b=out[i+1];out[i]=a*c+b*s;out[i+1]=b*c-a*s;}return out;}
export const absorbedFraction=phase=>(1+Math.cos(phase))/2;
