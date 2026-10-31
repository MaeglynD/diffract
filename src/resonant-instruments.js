// Lengths in vacuum wavelengths. TE phasors use exp(-iωt); entries follow
// the viewer's (Ey, Ez, cBx, cBy, cBz) complex packing.
const K = 2 * Math.PI;
export const SOUND = Object.freeze({period:5, waist:5.2, cell:3, maxOrder:4, sidebands:12, dq:1/96});
export const DRUM = Object.freeze({side:2*Math.sqrt(79)/3, base:.56, m:10, n:3});
export const drumHeight = DRUM.side * Math.sqrt(3)/2;

// Fourier coefficients of exp(i d cos(Gx)). At the largest drive, the
// omitted high orders carry less than 0.2% of the thin screen's |E|².
export function soundWeights(d) {
  const weights=[];
  for(let m=0;m<=SOUND.maxOrder;m++){
    let term=1;for(let k=1;k<=m;k++)term*=d/(2*k);
    let sum=term;for(let k=1;k<=18;k++){term*=-(d*d)/(4*k*(m+k));sum+=term;}
    weights.push(sum);
  }
  return weights;
}
const spectrum=Array.from({length:2*SOUND.sidebands+1},(_,i)=>{
  const q=(i-SOUND.sidebands)*SOUND.dq;return [q,Math.exp(-((Math.PI*SOUND.waist*q)**2))];
});
const norm=spectrum.reduce((s,t)=>s+t[1],0);
export function acousticModel(d){
  const weights=soundWeights(d);
  function waves(incident){
    const modes=[];
    for(let m=-SOUND.maxOrder;m<=SOUND.maxOrder;m++){
      if(incident&&m!==0)continue;
      const j=Math.abs(m),phase=j*Math.PI/2,w=incident?1:weights[j];
      for(const [q0,a] of spectrum){
        const q=q0+m/SOUND.period;
        modes.push({q,p:Math.sqrt(1-q*q),w:w*a/norm,phase});
      }
    }
    return modes;
  }
  const input=waves(true),output=waves(false);
  const field=(x,z,out=new Float64Array(10))=>{
    out.fill(0);
    for(const {q,p,w,phase} of z<SOUND.cell?input:output){
      const t=K*(q*x+p*(z-SOUND.cell))+phase,r=w*Math.cos(t),s=w*Math.sin(t);
      out[0]+=r;out[1]+=s;out[4]-=p*r;out[5]-=p*s;out[8]+=q*r;out[9]+=q*s;
    }return out;
  };
  // On a regular row, advance each plane wave with a complex rotation.
  function row(xs,z){
    const out=new Float64Array(xs.length*10),dx=xs[1]-xs[0];
    for(const {q,p,w,phase} of z<SOUND.cell?input:output){
      const a=K*(q*xs[0]+p*(z-SOUND.cell))+phase,dc=Math.cos(K*q*dx),ds=Math.sin(K*q*dx);
      let r=w*Math.cos(a),s=w*Math.sin(a);
      for(let i=0;i<out.length;i+=10){out[i]+=r;out[i+1]+=s;out[i+4]-=p*r;out[i+5]-=p*s;out[i+8]+=q*r;out[i+9]+=q*s;const next=r*dc-s*ds;s=r*ds+s*dc;r=next;}
    }return out;
  }
  return {epsilon:()=>1,field,row};
}

// Antisymmetrize a plane wave over the reflections of the equilateral
// triangle. The allowed wavevector also closes the third mirror exactly.
export const drumDirections=Array.from({length:3},(_,j)=>{
  const a=DRUM.side,q=(DRUM.m+DRUM.n)/(3*a),p=(DRUM.m-DRUM.n)/(Math.sqrt(3)*a),t=2*Math.PI*j/3;
  return [q*Math.cos(t)-p*Math.sin(t),q*Math.sin(t)+p*Math.cos(t)];
});
export function drumModel(angle){
  const re=(Math.cos(angle)+Math.sin(angle))/2,im=(Math.cos(angle)-Math.sin(angle))/2;
  return {epsilon:()=>1,field(x,z,out=new Float64Array(10)){
    out.fill(0);const Z=z-DRUM.base,X=x+DRUM.side/2;
    if(Z<0||Math.abs(x)+Z/Math.sqrt(3)>DRUM.side/2+1e-12)return out;
    for(const[q,p]of drumDirections){
      const c=Math.cos(K*q*X),s=Math.sin(K*q*X),f=Math.sin(K*p*Z),g=Math.cos(K*p*Z);
      out[0]+=re*c*f;out[1]+=im*s*f;
      out[4]-=im*s*p*g;out[5]+=re*c*p*g;
      out[8]+=im*q*c*f;out[9]+=re*q*s*f;
    }return out;
  }};
}
