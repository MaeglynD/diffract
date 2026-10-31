import {liveModel} from './live-physics.js';
// Independent, monochromatic Maxwell solutions. Lengths are in vacuum wavelengths;
// E is in E0 and the stored magnetic field is c B / E0. Phasors use exp(-i wt).
// These TE models are invariant in y. Their finite display height is a viewing
// window, not an extra aperture or a claim to simulate finite-height scattering.
import {CAVITY,GUIDE,GAP} from './native-config.js';
import {benchModel} from './bench-fields.js';
export {CAVITY,GUIDE,GAP};
const K=2*Math.PI;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]],scale=(a,s)=>[a[0]*s,a[1]*s];
const div=(a,b)=>scale(mul(a,[b[0],-b[1]]),1/(b[0]**2+b[1]**2));
const cis=p=>[Math.cos(p),Math.sin(p)];
function bisect(f,a,b){let fa=f(a);for(let i=0;i<60;i++){const m=(a+b)/2,fm=f(m);if(fa*fm<=0)b=m;else{a=m;fa=fm;}}return(a+b)/2;}

// The integer-order Fourier integral is exponentially convergent here (x < 30).
export function bessel(m,x){let s=0;const n=128;for(let j=0;j<n;j++){const t=Math.PI*(j+.5)/n;s+=Math.cos(m*t-x*Math.sin(t));}return s/n;}

// Match E_y and dE_y/dx at both faces of each dielectric slab. Parity at x=0
// reduces the two-core eigenproblem to one half-domain. No weak-coupling or
// slowly-varying-envelope approximation is used.
function guideState(beta,parity,x){
 const a=Math.sqrt(beta*beta-K*K),h=Math.sqrt((K*GUIDE.index)**2-beta*beta),g=GUIDE.gap/2,w=GUIDE.width,xx=Math.abs(x);
 let u0=parity===1?1:0,d0=parity===1?0:a,u,d;
 if(xx<=g){u=u0*Math.cosh(a*xx)+d0/a*Math.sinh(a*xx);d=a*u0*Math.sinh(a*xx)+d0*Math.cosh(a*xx);}
 else{const ug=u0*Math.cosh(a*g)+d0/a*Math.sinh(a*g),dg=a*u0*Math.sinh(a*g)+d0*Math.cosh(a*g),t=Math.min(w,xx-g);u=ug*Math.cos(h*t)+dg/h*Math.sin(h*t);d=-h*ug*Math.sin(h*t)+dg*Math.cos(h*t);if(xx>g+w){const f=Math.exp(-a*(xx-g-w));u*=f;d=-a*u;}}
 if(x<0){u*=parity;d*=-parity;}return[u,d];
}
function guideRoot(parity){const residual=b=>{const a=Math.sqrt(b*b-K*K),h=Math.sqrt((K*GUIDE.index)**2-b*b),g=GUIDE.gap/2,w=GUIDE.width,u=parity===1?Math.cosh(a*g):Math.sinh(a*g),d=a*(parity===1?Math.sinh(a*g):Math.cosh(a*g));return(-h*u*Math.sin(h*w)+d*Math.cos(h*w))+a*(u*Math.cos(h*w)+d/h*Math.sin(h*w));};let x=K+1e-7,f=residual(x),roots=[];for(let j=1;j<=2000;j++){const y=K+1e-7+(K*(GUIDE.index-1)-2e-7)*j/2000,g=residual(y);if(f*g<0)roots.push(bisect(residual,x,y));x=y;f=g;}return roots.at(-1);}
const betaEven=guideRoot(1),betaOdd=guideRoot(-1);
function normalizedGuide(beta,parity){let power=0;const dx=.001;for(let x=-8;x<8;x+=dx)power+=guideState(beta,parity,x+dx/2)[0]**2*dx;return{beta,parity,norm:Math.sqrt(beta/K*power)};}
const even=normalizedGuide(betaEven,1),odd=normalizedGuide(betaOdd,-1);
export const COUPLER={...GUIDE,betaEven,betaOdd,transferLength:Math.PI/(betaEven-betaOdd)};

// Solve a lossless symmetric glass/air/glass stack backwards from unit outgoing
// transmission. Both growing and decaying gap solutions are retained: their
// cross term carries the nonzero energy flux through the evanescent region.
export function gapMode(qx,width=GAP.width){
 const q=Math.sqrt(GAP.index**2-qx*qx),a=Math.sqrt(qx*qx-1),d=K*a*width;
 const plus=[.5,-q/(2*a)],minus=[.5,q/(2*a)];
 const A=scale(plus,Math.exp(d)),B=scale(minus,Math.exp(-d)),E=add(A,B),D=mul([0,a],[A[0]-B[0],A[1]-B[1]]);
 const inc=scale(add(E,scale(D,1/q)),.5),ref=scale(add(E,scale(D,-1/q)),.5),t=div([1,0],inc),r=div(ref,inc);
 return {qx,q,a,A:mul(A,t),B:mul(B,t),t,r,R:r[0]**2+r[1]**2,T:t[0]**2+t[1]**2};
}

const models=new Map();
export function nativeModel(id){
 if(['grin','absorber','sound-cell','light-billiard'].includes(id))return liveModel(id);
 if(models.has(id))return models.get(id);
 if(['michelson','michelson-right','bragg-cavity'].includes(id)){const m=benchModel(id);models.set(id,m);return m;}
 let model;
 if(id==='circulator'){
  const {radius,center,m}=CAVITY,n=8192,j=new Float64Array(n+1),d=new Float64Array(n+1);let peak=0;
  for(let i=0;i<=n;i++){const r=radius*i/n;j[i]=bessel(m,K*r);d[i]=K*(bessel(m-1,K*r)-bessel(m+1,K*r))/2;peak=Math.max(peak,Math.abs(j[i]));}
  model={epsilon:()=>1,field(x,z,out=new Float64Array(10)){out.fill(0);const zz=z-center,r=Math.hypot(x,zz);if(r>=radius||r<1e-9)return out;const t=r/radius*n,i=Math.min(n-1,Math.floor(t)),f=t-i,u=(j[i]*(1-f)+j[i+1]*f)/peak,dr=(d[i]*(1-f)+d[i+1]*f)/peak,phi=Math.atan2(zz,x),c=Math.cos(m*phi),s=Math.sin(m*phi),dxr=dr*x/r,dxi=-m*u*zz/(r*r),dzr=dr*zz/r,dzi=m*u*x/(r*r);out[0]=u*c;out[1]=u*s;
   // cB_x = +i d_z E_y/k; cB_z = -i d_x E_y/k.
   out[4]=-(dzr*s+dzi*c)/K;out[5]=(dzr*c-dzi*s)/K;out[8]=(dxr*s+dxi*c)/K;out[9]=-(dxr*c-dxi*s)/K;return out;}};
 }else if(id==='coupler'){
  model={epsilon:x=>Math.abs(x)>=GUIDE.gap/2&&Math.abs(x)<=GUIDE.gap/2+GUIDE.width?GUIDE.index**2:1,field(x,z,out=new Float64Array(10)){out.fill(0);for(const mode of[even,odd]){const [u,d]=guideState(mode.beta,mode.parity,x),amp=(mode.parity===1?1:-1)/mode.norm,c=Math.cos(mode.beta*z)*amp,s=Math.sin(mode.beta*z)*amp;out[0]+=u*c;out[1]+=u*s;out[4]-=mode.beta/K*u*c;out[5]-=mode.beta/K*u*s;out[8]+=d*s/K;out[9]-=d*c/K;}return out;}};
 }else if(id==='tunnelling'){
  const modes=[];let sum=0;for(let j=-24;j<=24;j++){const dq=j*.007,weight=Math.exp(-.5*(dq/.052)**2);modes.push({...gapMode(GAP.index*Math.sin(GAP.angle)+dq),weight});sum+=weight;}
  let lateral,gridX;
  model={epsilon:(x,z)=>z<GAP.at||z>GAP.at+GAP.width?GAP.index**2:1,field(x,z,out=new Float64Array(10)){out.fill(0);for(const m of modes){const {q,qx,a}=m;let u,v;if(z<GAP.at){const p=cis(K*q*(z-GAP.at)),r=mul(m.r,cis(-K*q*(z-GAP.at)));u=add(p,r);v=scale([p[0]-r[0],p[1]-r[1]],q);}else if(z<=GAP.at+GAP.width){const p=scale(m.A,Math.exp(-K*a*(z-GAP.at))),r=scale(m.B,Math.exp(K*a*(z-GAP.at)));u=add(p,r);v=mul([0,a],[p[0]-r[0],p[1]-r[1]]);}else{u=mul(m.t,cis(K*q*(z-GAP.at-GAP.width)));v=scale(u,q);}const carrier=scale(cis(K*qx*(x-GAP.centerX)),m.weight/sum),e=mul(u,carrier),b=mul(v,carrier);out[0]+=e[0];out[1]+=e[1];out[4]-=b[0];out[5]-=b[1];out[8]+=qx*e[0];out[9]+=qx*e[1];}return out;}};
  // Separate the x and z factors once per row. This is the same angular sum as
  // field(), but avoids millions of repeated trigonometric calls/allocations.
  model.row=(xs,z)=>{
   if(gridX!==xs){gridX=xs;lateral=modes.map(m=>{const a=new Float64Array(xs.length*2);for(let i=0;i<xs.length;i++){const p=K*m.qx*(xs[i]-GAP.centerX),w=m.weight/sum;a[i*2]=Math.cos(p)*w;a[i*2+1]=Math.sin(p)*w;}return a;});}
   const out=new Float64Array(xs.length*10);
   for(let j=0;j<modes.length;j++){const m=modes[j],{q,qx,a}=m;let u,v;
    if(z<GAP.at){const p=cis(K*q*(z-GAP.at)),r=mul(m.r,cis(-K*q*(z-GAP.at)));u=add(p,r);v=scale([p[0]-r[0],p[1]-r[1]],q);}
    else if(z<=GAP.at+GAP.width){const p=scale(m.A,Math.exp(-K*a*(z-GAP.at))),r=scale(m.B,Math.exp(K*a*(z-GAP.at)));u=add(p,r);v=mul([0,a],[p[0]-r[0],p[1]-r[1]]);}
    else{u=mul(m.t,cis(K*q*(z-GAP.at-GAP.width)));v=scale(u,q);}
    const lateralMode=lateral[j];for(let i=0;i<xs.length;i++){const c=lateralMode[i*2],s=lateralMode[i*2+1],r=u[0]*c-u[1]*s,t=u[0]*s+u[1]*c,p=i*10;out[p]+=r;out[p+1]+=t;out[p+4]-=v[0]*c-v[1]*s;out[p+5]-=v[0]*s+v[1]*c;out[p+8]+=qx*r;out[p+9]+=qx*t;}
   }return out;
  };
 }else throw Error('Unknown native optical experiment: '+id);
 models.set(id,model);return model;
}

export function energyDensity(f,epsilon=1){let e=0,b=0;for(let i=0;i<4;i++)e+=f[i]**2;for(let i=4;i<10;i++)b+=f[i]**2;return .5*(epsilon*e+b);}
