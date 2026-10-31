import {fromHalf,toHalf,axialIndex} from './volume-data.js';
const half=Float32Array.from({length:65536},(_,i)=>fromHalf(i));
const squares=Float64Array.from({length:65536},(_,i)=>fromHalf(i)**2);
export function energyVolume({nx,ny,nz,zMax,interfaceZ,textures:[e,b,z]}){
 const cut=interfaceZ?Math.round(interfaceZ/zMax*(nz-2)):-1;
 const count=nx*ny*nz,value=new Float32Array(count),data=new Uint16Array(count*4);
 for(let i=0,p=0;i<count;i++,p+=4)value[i]=.5*(squares[e[p]]+squares[e[p+1]]+squares[e[p+2]]+squares[e[p+3]]+squares[b[p]]+squares[b[p+1]]+squares[b[p+2]]+squares[b[p+3]]+squares[z[p]]+squares[z[p+1]]);
 for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const p=(k*ny+j)*nx+i,u=value[p];data[p*4]=toHalf(u);const bounds=[[i,nx,1],[j,ny,nx],[k,nz,nx*ny]];
  for(let axis=0;axis<3;axis++){const [at,size,stride]=bounds[axis],lo=(at&&!(axis===2&&k===cut+1&&cut>=0)?p-stride:p)*4,hi=(at<size-1&&!(axis===2&&k===cut)?p+stride:p)*4;let g=0;
   for(let c=0;c<10;c++){const t=c<4?e:c<8?b:z,index=c%4,mid=half[t[p*4+index]],d1=half[t[lo+index]]-mid,d2=half[t[hi+index]]-mid;g+=(d1*d1+d2*d2)*.5;}data[p*4+axis+1]=toHalf(g);
  }
 }

 return data;
}

export function sampleEnergy(volume,data,x,y,z){
 const {nx,ny,nz,half,zMax}=volume,px=Math.max(0,Math.min(nx-1.00001,(x/(2*half)+.5)*(nx-1))),py=Math.max(0,Math.min(ny-1.00001,(y/(2*half)+.5)*(ny-1))),pz=Math.max(0,Math.min(nz-1.00001,axialIndex(volume,z))),ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz),fx=px-ix,fy=py-iy,fz=pz-iz;let value=[0,0,0,0];
 for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const at=(((iz+dz)*ny+iy+dy)*nx+ix+dx)*4,w=(dx?fx:1-fx)*(dy?fy:1-fy)*(dz?fz:1-fz);for(let c=0;c<4;c++)value[c]+=fromHalf(data[at+c])*w;}
 return Math.max(0,value[0]-.5*(fx*(1-fx)*value[1]+fy*(1-fy)*value[2]+fz*(1-fz)*value[3]));
}
