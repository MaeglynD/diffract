import {readFile,writeFile} from 'node:fs/promises';
import {png} from './png.mjs';
// Rasterize the actual mesh for the scientific gallery thumbnail, not an icon.
const buffer=await readFile('assets/models/bunny.mesh'),meta=JSON.parse(buffer.subarray(0,1024).toString().split('\0')[0]),v=new Float32Array(buffer.buffer,buffer.byteOffset+1024,meta.vertices*3),indices=new Uint32Array(buffer.buffer,buffer.byteOffset+1024+meta.vertices*12,meta.triangles*3);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const m=Math.hypot(...a)||1;return a.map(x=>x/m);},direction=norm([-.58,.43,1]),right=norm(cross([0,1,0],direction)),up=cross(direction,right),light=norm([-.4,.8,1]);
const positions=[],normals=Array.from({length:meta.vertices},()=>[0,0,0]);
for(let i=0;i<v.length;i+=3)positions.push([v[i+2],v[i+1],-v[i]]);
for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]],[a,b,c]=ids.map(j=>positions[j]),n=cross(b.map((x,j)=>x-a[j]),c.map((x,j)=>x-a[j]));for(const id of ids)for(let j=0;j<3;j++)normals[id][j]+=n[j];}
const smooth=normals.map(norm),projected=positions.map(p=>[dot(p,right),dot(p,up),dot(p,direction)]),extent=Math.max(...projected.map(p=>Math.max(Math.abs(p[0]),Math.abs(p[1])))),N=400,rgba=new Uint8Array(N*N*4),depth=new Float64Array(N*N).fill(-Infinity),scale=(N-24)/(2*extent),points=projected.map(p=>[N/2+p[0]*scale,N/2-p[1]*scale,p[2]]);
for(let i=0;i<N*N;i++)rgba.set([7,17,25,255],i*4);
for(let f=0;f<indices.length;f+=3){const ids=[indices[f],indices[f+1],indices[f+2]],[a,b,c]=ids.map(i=>points[i]),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)continue;
 for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])));y<=Math.min(N-1,Math.ceil(Math.max(a[1],b[1],c[1])));y++)for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])));x<=Math.min(N-1,Math.ceil(Math.max(a[0],b[0],c[0])));x++){
  const w0=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den,w1=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den,w2=1-w0-w1;if(w0<0||w1<0||w2<0)continue;const z=w0*a[2]+w1*b[2]+w2*c[2],at=y*N+x;if(z<=depth[at])continue;depth[at]=z;
  const n=norm([0,1,2].map(j=>w0*smooth[ids[0]][j]+w1*smooth[ids[1]][j]+w2*smooth[ids[2]][j])),view=norm([dot(n,right),dot(n,up),dot(n,direction)]),shade=.35+.65*Math.max(0,dot(view,light));rgba.set([185*shade,213*shade,222*shade,255],at*4);
 }
}
const small=new Uint8Array(200*200*4);for(let y=0;y<200;y++)for(let x=0;x<200;x++)for(let c=0;c<4;c++){let sum=0;for(let j=0;j<2;j++)for(let i=0;i<2;i++)sum+=rgba[((2*y+j)*400+2*x+i)*4+c];small[(y*200+x)*4+c]=sum/4;}
await writeFile('assets/previews/bunny-model.png',png(200,200,small));console.log('Bunny thumbnail rendered from 69,451 mesh triangles.');
