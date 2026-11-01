// Axial electric polarization, infinite nonmagnetic dielectric cylinder.
// Lengths are in vacuum wavelengths. The external solution contains the
// incident plane wave and outgoing Hankel waves, with the e^(-iωt) convention.
const K=2*Math.PI;
export const JET=Object.freeze({radius:2.4,index:1.46,center:5.25,half:6.5,length:14.5,scanZ:8.01,scanHalf:1.25});
const orders=32;
function regular(x,j){
  if(x<1e-12){j.fill(0);j[0]=1;return;}
  let next=0,current=1,normalization=0;
  const start=Math.max(j.length+24,Math.ceil(x+34));
  for(let m=start;m>=0;m--){
    if(m<j.length)j[m]=current;
    if(m%2===0)normalization+=(m===0?1:2)*current;
    const prev=2*m/x*current-next;next=current;current=prev;
    if(Math.abs(current)>1e120){current*=1e-120;next*=1e-120;normalization*=1e-120;for(let q=m;q<j.length;q++)j[q]*=1e-120;}
  }
  for(let m=0;m<j.length;m++)j[m]/=normalization;
}
function secondKind(m,x){
  // Only evaluated outside the cylinder, where kr ≥ 15. The first terms
  // of the large-argument expansion seed the upward Y recurrence.
  let term=1,p=1,q=0;
  for(let j=1;j<=18;j++){
    term*=(4*m*m-(2*j-1)**2)/(8*j*x);
    const signed=j%4<2?term:-term;
    if(j%2)q+=signed;else p+=signed;
  }
  const chi=x-(m/2+.25)*Math.PI;
  return Math.sqrt(2/(Math.PI*x))*(Math.sin(chi)*p+Math.cos(chi)*q);
}
function irregular(x,y){
  y[0]=secondKind(0,x);y[1]=secondKind(1,x);
  for(let m=1;m<y.length-1;m++)y[m+1]=2*m/x*y[m]-y[m-1];
}
const derivative=(j,m)=>m===0?-j[1]:(j[m-1]-j[m+1])/2;
export function jetModel(index=JET.index){
  const {radius,center}=JET,a=K*radius;
  const J=new Float64Array(orders+2),Y=J.slice(),I=J.slice();
  regular(a,J);irregular(a,Y);regular(index*a,I);
  const outside=[],inside=[];
  for(let m=0;m<=orders;m++){
    const j=J[m],y=Y[m],d=derivative(J,m),h=derivative(Y,m),v=I[m],w=index*derivative(I,m);
    const dr=v*d-w*j,di=v*h-w*y,den=dr*dr+di*di;
    const norm=m===0?1:2;
    const c=norm*[1,0,-1,0][m%4],s=norm*[0,1,0,-1][m%4];
    function coefficient(r,i){return [c*r-s*i,s*r+c*i];}
    outside.push(coefficient(-dr*dr/den,dr*di/den));
    const wr=j*h-d*y;inside.push(coefficient(wr*di/den,wr*dr/den));
  }
  return {epsilon:(x,z)=>Math.hypot(x,z-center)<radius?index*index:1,
    field(x,z,out=new Float64Array(10)){
      const zz=z-center,r=Math.hypot(x,zz),internal=r<radius,n=internal?index:1;
      const cos=r?zz/r:1,sin=r?x/r:0,kr=K*n*r;
      regular(kr,J);if(!internal)irregular(kr,Y);
      let er=0,ei=0,rr=0,ri=0,tr=0,ti=0,cm=1,sm=0;
      const coeff=internal?inside:outside;
      for(let m=0;m<=orders;m++){
        const [ar,ai]=coeff[m],j=J[m],y=internal?0:Y[m],dj=derivative(J,m),dy=internal?0:derivative(Y,m);
        const re=ar*j-ai*y,im=ai*j+ar*y;
        er+=cm*re;ei+=cm*im;rr+=cm*n*(ar*dj-ai*dy);ri+=cm*n*(ai*dj+ar*dy);
        if(r){tr-=m*sm*re/(K*r);ti-=m*sm*im/(K*r);}
        const nextCos=cm*cos-sm*sin;sm=sm*cos+cm*sin;cm=nextCos;
      }
      out.fill(0);out[0]=er;out[1]=ei;out[4]=-(cos*ri-sin*ti);out[5]=cos*rr-sin*tr;
      out[8]=sin*ri+cos*ti;out[9]=-(sin*rr+cos*tr);
      if(!internal){
        const c=Math.cos(K*zz),s=Math.sin(K*zz);
        out[0]+=c;out[1]+=s;out[4]-=c;out[5]-=s;
      }
      return out;
    }};
}
