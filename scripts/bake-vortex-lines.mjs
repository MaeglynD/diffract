import {writeFile,mkdir} from 'node:fs/promises';
import {buildSpectrum} from '../src/experiments.js';
import {propagate,sampleComplex} from '../src/physics.js';
import {extractVortexLines} from '../src/vortex-lines.js';
await mkdir('assets/topology',{recursive:true});
for(const id of['trefoil','hopf']){
 const s=buildSpectrum(id),nx=97,ny=97,nz=193,half=6,zMin=2,zMax=42,re=new Float32Array(nx*ny*nz),im=new Float32Array(re.length);
 for(let k=0;k<nz;k++){const[f]=propagate(s,zMin+(zMax-zMin)*k/(nz-1),[0]);for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=sampleComplex(f,(2*i/(nx-1)-1)*half,(2*j/(ny-1)-1)*half,s.config),at=(k*ny+j)*nx+i;re[at]=a[0];im[at]=a[1];}}
 const lines=extractVortexLines({re,im,nx,ny,nz,half,zMin,zMax});
 if(lines.some(l=>!l.closed)||lines.length!==(id==='trefoil'?1:2))throw Error(`${id}: unexpected vortex topology`);
 await writeFile(`assets/topology/${id}.json`,JSON.stringify({component:'Ey',grid:{nx,ny,nz,half,zMin,zMax},lines}));
 console.log(id,lines.map(l=>({closed:l.closed,points:l.points.length})));
}
