// TE network/stratified-medium models. Every beam is a sum of Helmholtz
// plane waves; cB is q cross E. Coordinates and lengths are in vacuum lambda.
const K=2*Math.PI;
const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]],add=(a,b)=>[a[0]+b[0],a[1]+b[1]],scale=(a,t)=>[a[0]*t,a[1]*t],cis=a=>[Math.cos(a),Math.sin(a)];
const div=(a,b)=>scale(mul(a,[b[0],-b[1]]),1/(b[0]*b[0]+b[1]*b[1]));
export function michelsonPorts(delta=0,phase1=0,phase2=0){const a=cis(phase1),b=cis(phase2+delta);return{output:scale(mul([0,-1],add(a,b)),.5),return:scale(add(scale(a,-1),b),.5)};}
export const MICHELSON={splitterZ:10,armX:9,armZ:8};
export const BRAGG=(()=>{const H=2.2,L=1.45,side=[H,L,H,L,H,L,H],indices=[...side,L,...side.toReversed()],layers=indices.map((n,i)=>({n,d:i===side.length?1/(2*n):1/(4*n)}));const total=layers.reduce((a,l)=>a+l.d,0);let z=3.5-total/2;for(const l of layers){l.a=z;l.b=z+=l.d;}return{layers,start:layers[0].a,end:z,H,L};})();
// Stable for this modest stack. Solve backwards from a unit outgoing wave,
// then normalize by the recovered incoming amplitude. No energy renormalization.
export function stackMode(qx=0,layers=BRAGG.layers,k=K){
 const q0=Math.sqrt(1-qx*qx),states=[];let E=[1,0],H=[q0,0];
 for(let j=layers.length-1;j>=0;j--){const l=layers[j],q=Math.sqrt(l.n*l.n-qx*qx),p=k*q*l.d,c=Math.cos(p),s=Math.sin(p),e=add(scale(E,c),mul([0,-s/q],H)),h=add(scale(H,c),mul([0,-q*s],E));E=e;H=h;states[j]={...l,q,A:scale(add(E,scale(H,1/q)),.5),B:scale(add(E,scale(H,-1/q)),.5)};}
 const inc=scale(add(E,scale(H,1/q0)),.5),ref=scale(add(E,scale(H,-1/q0)),.5),t=div([1,0],inc),r=div(ref,inc);
 for(const l of states){l.A=mul(l.A,t);l.B=mul(l.B,t);}return{k,q0,qx,t,r,layers:states,R:r[0]**2+r[1]**2,T:t[0]**2+t[1]**2};
}
export function stackAt(m,z){
 let A,B,q,s;const first=m.layers[0],last=m.layers.at(-1);
 if(z<first.a){q=m.q0;s=z-first.a;A=[1,0];B=m.r;}
 else if(z>=last.b){q=m.q0;s=z-last.b;A=m.t;B=[0,0];}
 else{const l=m.layers.find(l=>z<l.b);q=l.q;s=z-l.a;A=l.A;B=l.B;}
 const f=mul(A,cis(m.k*q*s)),b=mul(B,cis(-m.k*q*s));return{E:add(f,b),H:scale(add(f,scale(b,-1)),q)};
}
function modes(sigma=.05){const a=[];let sum=0;for(let j=-16;j<=16;j++){const q=j*sigma/5,w=Math.exp(-.5*(q/sigma)**2);a.push({q,w,p:Math.sqrt(1-q*q)});sum+=w;}for(const m of a)m.w/=sum;return a;}
export function benchModel(id){
 if(id==='bragg-cavity'){
  const angular=modes(.025).map(m=>({...m,...stackMode(m.q)}));let xsCache,lateral;
  const model={epsilon:(x,z)=>{const l=BRAGG.layers.find(l=>z>=l.a&&z<l.b);return l?l.n*l.n:1;},field(x,z,out=new Float64Array(10)){out.fill(0);for(const m of angular){const s=stackAt(m,z),c=scale(cis(K*m.q*x),m.w),e=mul(s.E,c),h=mul(s.H,c);out[0]+=e[0];out[1]+=e[1];out[4]-=h[0];out[5]-=h[1];out[8]+=m.q*e[0];out[9]+=m.q*e[1];}return out;}};
  model.row=(xs,z)=>{if(xsCache!==xs){xsCache=xs;lateral=angular.map(m=>{const a=new Float64Array(xs.length*2);xs.forEach((x,i)=>{a[2*i]=m.w*Math.cos(K*m.q*x);a[2*i+1]=m.w*Math.sin(K*m.q*x);});return a;});}const out=new Float64Array(xs.length*10);angular.forEach((m,j)=>{const {E,H}=stackAt(m,z),c=lateral[j];for(let i=0;i<xs.length;i++){const p=i*10,r=E[0]*c[2*i]-E[1]*c[2*i+1],s=E[0]*c[2*i+1]+E[1]*c[2*i];out[p]+=r;out[p+1]+=s;out[p+4]-=H[0]*c[2*i]-H[1]*c[2*i+1];out[p+5]-=H[0]*c[2*i+1]+H[1]*c[2*i];out[p+8]+=m.q*r;out[p+9]+=m.q*s;}});return out;};return model;
 }
 if(id==='michelson'||id==='michelson-right'){
  const angular=modes(.075),aux=id.endsWith('-right'),{splitterZ:Z,armX:Lx,armZ:Lz}=MICHELSON;
  function beam(out,x,z,dx,dz,amp,path=0){const s=x*dx+z*dz,t=-x*dz+z*dx;for(const m of angular){const a=K*(m.p*(s+path)+m.q*t),c=Math.cos(a)*m.w,r=Math.sin(a)*m.w,er=amp[0]*c-amp[1]*r,ei=amp[0]*r+amp[1]*c,qx=dx*m.p-dz*m.q,qz=dz*m.p+dx*m.q;out[0]+=er;out[1]+=ei;out[4]-=qz*er;out[5]-=qz*ei;out[8]+=qx*er;out[9]+=qx*ei;}}
  return{epsilon:()=>1,field(x,z,out=new Float64Array(10)){out.fill(0);const zz=z-Z,t=1/Math.sqrt(2);
   // Separate propagation regions meet at the ideal scattering junction.
   // Return-arm B is also supplied independently for coherent phase control.
   // The splitter lies on x + (z-Z) = 0. Half-space matching avoids clipping
   // each beam to a rectangular arm and preserves its diffracting tails.
   if(x+zz<0){if(!aux){beam(out,x,zz,1,0,[1,0]);beam(out,x-2*Lx,zz,-1,0,[-.5,0]);}beam(out,x,zz,-1,0,[.5,0],2*Lz);
    if(zz>=-Lz){if(!aux)beam(out,x,zz,0,-1,[0,t]);beam(out,x,zz+2*Lz,0,1,[0,-t]);}
   }else{
    if(x<=Lx&&!aux){beam(out,x,zz,1,0,[t,0]);beam(out,x-2*Lx,zz,-1,0,[-t,0]);}
    if(!aux)beam(out,x,zz,0,1,[0,-.5],2*Lx);beam(out,x,zz,0,1,[0,-.5],2*Lz);
   }
   return out;
  }};
 }
 throw Error('Unknown bench model '+id);
}
