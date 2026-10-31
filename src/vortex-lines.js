// The intersection Re(Ey)=Im(Ey)=0 within each linear tetrahedron. Shared
// triangular faces identify graph vertices exactly; no hand-drawn target
// curve enters this extraction.
export function extractVortexLines({re,im,nx,ny,nz,half,zMin=0,zMax}){
 const nodes=[],lookup=new Map(),tetra=[[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]],faces=[[0,1,2],[0,1,3],[0,2,3],[1,2,3]];
 const offsets=[0,1,nx,nx+1,nx*ny,nx*ny+1,nx*ny+nx,nx*ny+nx+1];
 const point=id=>{const x=id%nx,y=Math.floor(id/nx)%ny,z=Math.floor(id/(nx*ny));return[(x/(nx-1)*2-1)*half,(y/(ny-1)*2-1)*half,zMin+z/(nz-1)*(zMax-zMin)];};
 function hit(a,b,c){
  const ar=re[a],ai=im[a],br=re[b]-ar,bi=im[b]-ai,cr=re[c]-ar,ci=im[c]-ai,det=br*ci-cr*bi;if(Math.abs(det)<1e-24)return-1;
  const u=(-ar*ci+cr*ai)/det,v=(-br*ai+ar*bi)/det;if(u<0||v<0||u+v>1)return-1;
  const key=[a,b,c].sort((x,y)=>x-y).join(',');if(lookup.has(key))return lookup.get(key);
  const A=point(a),B=point(b),C=point(c),index=nodes.length;nodes.push({p:A.map((x,i)=>x*(1-u-v)+B[i]*u+C[i]*v),edges:[]});lookup.set(key,index);return index;
 }
 for(let k=0;k<nz-1;k++)for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
  const base=(k*ny+j)*nx+i,ids=offsets.map(o=>base+o);
  if(!ids.some(n=>re[n]>0)||!ids.some(n=>re[n]<0)||!ids.some(n=>im[n]>0)||!ids.some(n=>im[n]<0))continue;
  for(const t of tetra){const a=t.map(n=>ids[n]);if(!a.some(n=>re[n]>0)||!a.some(n=>re[n]<0)||!a.some(n=>im[n]>0)||!a.some(n=>im[n]<0))continue;const hits=[];for(const f of faces){const h=hit(a[f[0]],a[f[1]],a[f[2]]);if(h>=0)hits.push(h);}if(hits.length===2){nodes[hits[0]].edges.push(hits[1]);nodes[hits[1]].edges.push(hits[0]);}}
 }
 const visited=new Set(),lines=[];
 for(let seed=0;seed<nodes.length;seed++){
  if(visited.has(seed)||nodes[seed].edges.length===0)continue;
  // Prefer an endpoint if this component reaches the sampled boundary.
  const component=[],todo=[seed],seen=new Set([seed]);while(todo.length){const at=todo.pop();component.push(at);for(const n of nodes[at].edges)if(!seen.has(n)){seen.add(n);todo.push(n);}}
  const start=component.find(n=>nodes[n].edges.length===1)??seed,points=[];let at=start,prev=-1,closed=false;
  while(!visited.has(at)){visited.add(at);points.push(nodes[at].p);const next=nodes[at].edges.find(n=>n!==prev);if(next===undefined)break;if(next===start){closed=true;break;}prev=at;at=next;}
  if(points.length>12)lines.push({closed,points});
 }
 return lines.sort((a,b)=>b.points.length-a.points.length);
}
