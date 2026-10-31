import * as THREE from 'three';
import {arrowFragment} from './render-shaders.js';
import {saturnCurves} from './holographic-scenes.js';
const stored=new Map();
export async function makeTopology(id,uniforms){
 if(!stored.has(id))stored.set(id,fetch(`./assets/topology/${id}.json`).then(r=>{if(!r.ok)throw Error('Vortex data unavailable');return r.json();}));
 const data=await stored.get(id),root=new THREE.Group();root.userData.lines=data.lines;
 for(const [i,line]of data.lines.entries()){
  const points=line.points.filter((p,j)=>j%3===0).map(([x,y,z])=>new THREE.Vector3(z,y,-x));
  const curve=new THREE.CatmullRomCurve3(points,line.closed,'centripetal'),geometry=new THREE.TubeGeometry(curve,points.length*2,.065,8,line.closed);
  const material=new THREE.ShaderMaterial({uniforms:{...uniforms,color:{value:new THREE.Color(i?0xdab09e:0xa6d3dd).convertLinearToSRGB()}},vertexShader:`varying float shade,alpha;void main(){shade=.65+.35*abs(dot(normalize(normalMatrix*normal),normalize(vec3(-.3,.5,1.))));alpha=.52;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:arrowFragment,transparent:true,depthWrite:true,depthTest:true});
  const mesh=new THREE.Mesh(geometry,material);mesh.layers.set(2);mesh.renderOrder=4;root.add(mesh);
 }
 const markers=[];for(let i=0;i<12;i++){
  const material=new THREE.ShaderMaterial({uniforms:{...uniforms,color:{value:new THREE.Color(.81,.97,1)}},vertexShader:`varying float shade,alpha;void main(){shade=.58+.42*max(0.,dot(normalize(normalMatrix*normal),normalize(vec3(-.3,.5,1.))));alpha=1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:arrowFragment,transparent:true,depthWrite:true,depthTest:true});
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(.29,18,12),material);sphere.layers.set(2);sphere.renderOrder=6;sphere.visible=false;root.add(sphere);markers.push(sphere);
 }root.userData.markers=markers;return root;
}
export function updateIntersections(root,nodes,z,visible=true){for(const[i,marker]of(root.userData.markers||[]).entries()){marker.visible=visible&&i<nodes.length;if(marker.visible)marker.position.set(z,nodes[i][1],-nodes[i][0]);}}
export function planeIntersections(lines,z){
 const out=[];for(const line of lines||[])for(let i=0;i<line.points.length;i++){
  const a=line.points[i],b=line.points[(i+1)%line.points.length];if((a[2]<=z&&b[2]>z)||(b[2]<=z&&a[2]>z)){
   const t=(z-a[2])/(b[2]-a[2]),p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if(!out.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.03))out.push(p);
  }
 }return out;
}
export function makeDesignCurves(uniforms){
 const root=new THREE.Group();
 for(const curve of saturnCurves()){
  const points=[...curve,curve[0]].map(([x,y,z])=>new THREE.Vector3(z,y,-x)),g=new THREE.BufferGeometry().setFromPoints(points),distance=new Float32Array(points.length);
  for(let i=1;i<points.length;i++)distance[i]=distance[i-1]+points[i].distanceTo(points[i-1]);g.setAttribute('pathDistance',new THREE.BufferAttribute(distance,1));
  const material=new THREE.ShaderMaterial({uniforms:{...uniforms,color:{value:new THREE.Color(.70,.86,.89)}},vertexShader:`attribute float pathDistance;varying float path,shade,alpha;void main(){path=pathDistance;shade=1.;alpha=.75;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:'varying float path;'+arrowFragment.replace('void main(){','void main(){if(mod(path,1.0)>.55)discard;'),transparent:true,depthWrite:false});
  const line=new THREE.Line(g,material);line.layers.set(2);root.add(line);
 }return root;
}
