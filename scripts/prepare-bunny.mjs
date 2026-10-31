import {readFile,writeFile,mkdir} from 'node:fs/promises';

// Stanford Bunny, original zipper reconstruction; downloaded from Open3D's mirror.
// Preserve the full mesh for display and derive a surface sample for holography.
const text=await readFile('assets/models/bunny.ply','utf8'),end=text.indexOf('end_header')+10,header=text.slice(0,end),lines=text.slice(end).trim().split(/\r?\n/),nv=Number(header.match(/element vertex (\d+)/)[1]),nf=Number(header.match(/element face (\d+)/)[1]);
const raw=lines.slice(0,nv).map(l=>l.trim().split(/\s+/).slice(0,3).map(Number)),faces=lines.slice(nv,nv+nf).map(l=>l.trim().split(/\s+/).slice(1,4).map(Number));
const lo=[0,1,2].map(c=>Math.min(...raw.map(p=>p[c]))),hi=[0,1,2].map(c=>Math.max(...raw.map(p=>p[c]))),scale=24/(hi[1]-lo[1]),center=lo.map((x,i)=>(x+hi[i])/2);
// Physical coordinates: front faces the hologram at z=0; full height is 24 lambda.
const positions=raw.map(p=>[(p[0]-center[0])*scale,(p[1]-center[1])*scale,-(p[2]-center[2])*scale]);
const vertices=Float32Array.from(positions.flat()),indices=Uint32Array.from(faces.flatMap(f=>[f[0],f[2],f[1]])),meta={vertices:nv,triangles:nf,source:'Stanford University Computer Graphics Laboratory',height:24,centerZ:32};
const block=Buffer.alloc(1024);block.write(JSON.stringify(meta));await mkdir('assets/models',{recursive:true});await writeFile('assets/models/bunny.mesh',Buffer.concat([block,Buffer.from(vertices.buffer),Buffer.from(indices.buffer)]));
// Area-weighted triangular samples, merged in 0.65-lambda surface cells.
const cells=new Map(),cell=.65;
for(const f of faces){const [a,b,c]=f.map(i=>positions[i]),ab=b.map((x,i)=>x-a[i]),ac=c.map((x,i)=>x-a[i]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],area=Math.hypot(...cross)/2;if(area<1e-10)continue;const p=a.map((x,i)=>(x+b[i]+c[i])/3),key=p.map(v=>Math.floor(v/cell)).join(',');let v=cells.get(key);if(!v){v=[0,0,0,0];cells.set(key,v);}for(let i=0;i<3;i++)v[i]+=p[i]*area;v[3]+=area;}
let seed=71943;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const points=[...cells.values()].map(v=>[v[0]/v[3],v[1]/v[3],32+v[2]/v[3],Math.sqrt(v[3]),random()*2*Math.PI].map(n=>Number(n.toFixed(5))));
await writeFile('src/bunny-surface.js',`// Derived from the credited Stanford Bunny mesh by scripts/prepare-bunny.mjs.\nexport const BUNNY_SURFACE=${JSON.stringify(points)};\nexport const BUNNY_CENTER=32;\n`);
console.log({...meta,surfaceSamples:points.length,depth:[Math.min(...points.map(p=>p[2])),Math.max(...points.map(p=>p[2]))],width:hi.map((x,i)=>(x-lo[i])*scale)});
