import * as THREE from 'three';
import {CAVITY,GUIDE,GAP} from './native-config.js';
import {makeBenchApparatus} from './bench-apparatus.js';

// Geometry depicts the boundaries used by native-fields.js. Open or finite
// edges are viewing cutaways; they are not additional optical interfaces.
const metal=()=>new THREE.MeshStandardMaterial({color:0x536d79,metalness:.45,roughness:.27,emissive:0x101f28,emissiveIntensity:.25});
const dark=()=>new THREE.MeshStandardMaterial({color:0x091a23,metalness:.35,roughness:.42});
function solid(g,m=metal()){const mesh=new THREE.Mesh(g,m);mesh.layers.enable(4);return mesh;}
function glass(tint){return new THREE.ShaderMaterial({side:THREE.DoubleSide,depthWrite:true,uniforms:{opacity:{value:.35},tint:{value:new THREE.Color(tint)},studioFill:{value:1},studioTint:{value:new THREE.Color(1,1,1)},studioDirection:{value:new THREE.Vector3(-.4,.8,1).normalize()}},vertexShader:`varying vec3 n,v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform float opacity,studioFill;uniform vec3 tint,studioTint,studioDirection;varying vec3 n,v;void main(){vec3 N=normalize(n),V=normalize(v);float f=pow(1.-abs(dot(N,V)),3.),s=pow(abs(dot(N,normalize(studioDirection+V))),70.);vec3 c=tint*(.25+.18*abs(dot(N,studioDirection)))+vec3(.78,.92,1.)*(s*.35+f*.28);gl_FragColor=vec4(c*studioTint*studioFill,opacity*(.22+.32*f));}`});}
function edges(root,geometry,position,color=0x88b9c6,opacity=.28){const line=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,28),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));line.position.copy(position);line.layers.set(2);root.add(line);}
function pane(root,geometry,position,tint=0x83bfd0){const material=glass(tint),mesh=new THREE.Mesh(geometry,material);mesh.position.copy(position);mesh.layers.set(5);root.add(mesh);root.userData.surfaces.push(material);edges(mesh,geometry,new THREE.Vector3());return mesh;}
function box(root,size,at,material){const mesh=solid(new THREE.BoxGeometry(...size),material);mesh.position.set(...at);root.add(mesh);return mesh;}
export function makeNativeApparatus(e){
 if(e.bench)return makeBenchApparatus(e,{pane,box,solid,metal,dark});
 const root=new THREE.Group();root.userData.surfaces=[];root.userData.maskMap=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);root.userData.maskMap.needsUpdate=true;
 if(e.id==='coupler'){
  const {width,gap}=GUIDE;
  box(root,[e.zMax+.7,.22,4.2],[e.zMax/2,-e.viewHeight-.21,0],dark());
  for(const sign of[-1,1]){const z=sign*(gap+width)/2;pane(root,new THREE.BoxGeometry(e.zMax,2*e.viewHeight,width),new THREE.Vector3(e.zMax/2,0,z),sign<0?0x84cbd4:0x9db8d8);}
  // Polished chip edges and two input facets show the rails continuing along z.
  for(const z of[-2.1,2.1])box(root,[e.zMax+.7,.06,.045],[e.zMax/2,-e.viewHeight-.06,z]);
  root.userData.label=[e.zMax*.5,e.viewHeight+1,0];
 }else if(e.id==='circulator'){
  const {radius,center,height}=CAVITY;
  const floor=solid(new THREE.CylinderGeometry(radius+.2,radius+.2,.14,128),dark());floor.position.set(center,-height-.1,0);root.add(floor);
  const wall=pane(root,new THREE.CylinderGeometry(radius,radius,2*height,192,1,true),new THREE.Vector3(center,0,0),0x9bc0ca);
  for(const y of[-height,height]){const rim=solid(new THREE.TorusGeometry(radius,.045,10,192));rim.rotation.x=Math.PI/2;rim.position.set(center,y,0);root.add(rim);}
  // The upper face is intentionally omitted to expose the interior mode.
  root.userData.label=[center,height+1,0];
 }else if(e.id==='tunnelling'){
  for(const [a,b]of[[0,GAP.at],[GAP.at+GAP.width,e.zMax]]){pane(root,new THREE.BoxGeometry(b-a,2*e.viewHeight,2*e.half),new THREE.Vector3((a+b)/2,0,0),0x8dbbc9);box(root,[b-a,.18,2*e.half+.2],[(a+b)/2,-e.viewHeight-.16,0],dark());}
  root.userData.label=[GAP.at+GAP.width/2,e.viewHeight+1,0];
 }
 return root;
}
