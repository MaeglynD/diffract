import * as THREE from 'three';
import {maskHalf} from './experiments.js';

const metal=()=>new THREE.MeshStandardMaterial({color:0x304650,metalness:.65,roughness:.34});
const dark=()=>new THREE.MeshStandardMaterial({color:0x10232e,metalness:.35,roughness:.5});
export function solid(geometry,material=metal()){const mesh=new THREE.Mesh(geometry,material);mesh.layers.enable(4);return mesh;}
function cylinder(radius,length,material){const m=solid(new THREE.CylinderGeometry(radius,radius,length,56),material);m.rotation.z=-Math.PI/2;return m;}
function ring(radius,tube=.16){const m=solid(new THREE.TorusGeometry(radius,tube,10,80));m.rotation.y=Math.PI/2;return m;}
export function beamEnvelope(start,end,r0,r1){const d=new THREE.Vector3().subVectors(end,start),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,d.length(),64,1,true),new THREE.MeshBasicMaterial({color:0x69c8dd,transparent:true,opacity:.035,depthWrite:false,side:THREE.DoubleSide}));mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return mesh;}
export function laser(group,position,direction,radius=1.1){const barrel=cylinder(radius,4.2);barrel.position.copy(position).addScaledVector(direction,-2.1);barrel.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);group.add(barrel);const end=new THREE.Mesh(new THREE.CircleGeometry(radius*.72,48),new THREE.MeshBasicMaterial({color:0x77dcea}));end.position.copy(position).addScaledVector(direction,.03);end.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);end.layers.enable(4);group.add(end);}
export function makeIllumination(e){
 const root=new THREE.Group();root.userData.fit=[];
 if(e.analytic)return root;
 if(e.kind==='beams'){
  const qz=Math.sqrt(1-.24**2);laser(root,new THREE.Vector3(-21,0,0),new THREE.Vector3(1,0,0),1.15);const splitter=solid(new THREE.BoxGeometry(2,2,2));splitter.position.x=-16;root.add(splitter);root.add(beamEnvelope(new THREE.Vector3(-21,0,0),new THREE.Vector3(-17,0,0),.72,.72));
  for(let j=0;j<3;j++){const theta=2*Math.PI*j/3+Math.PI/2,qx=.24*Math.cos(theta),qy=.24*Math.sin(theta),d=new THREE.Vector3(qz,qy,-qx),at=new THREE.Vector3(-8,-26*qy/qz,26*qx/qz),exit=new THREE.Vector3(0,-18*qy/qz,18*qx/qz);laser(root,at,d,1.9);root.add(beamEnvelope(at,exit,1.8,1.8));const path=new THREE.CatmullRomCurve3([new THREE.Vector3(-17,0,0),new THREE.Vector3(-13,at.y*.35,at.z*.35),at.clone().addScaledVector(d,-4.2)]);root.add(solid(new THREE.TubeGeometry(path,24,.12,8,false),new THREE.MeshStandardMaterial({color:0x5e8899,roughness:.4,metalness:.3})));root.userData.fit.push(at.toArray());}root.userData.fit.push([-26,-8,-8]);return root;
 }
 const h=maskHalf(e),radius=h*.94,position=new THREE.Vector3(-23,0,0);laser(root,position,new THREE.Vector3(1,0,0),1.35);
 root.add(beamEnvelope(position,new THREE.Vector3(-10,0,0),.92,radius));
 const mount=ring(radius,.25);mount.position.x=-10;root.add(mount);
 const lens=new THREE.Mesh(new THREE.SphereGeometry(1,64,32),new THREE.MeshPhysicalMaterial({color:0x8fc6d0,metalness:0,roughness:.12,transparent:true,opacity:.17,depthWrite:false,side:THREE.FrontSide}));lens.scale.set(1.1,radius,radius);lens.position.x=-10;root.add(lens);
 for(const x of[-25,-10]){const foot=solid(new THREE.BoxGeometry(3,.65,4),dark());foot.position.set(x,-h-2.3,0);root.add(foot);const top=x===-10?-radius-.25:-1.35,bottom=-h-2.0,rod=cylinder(.19,top-bottom);rod.rotation.set(0,0,0);rod.position.set(x,(top+bottom)/2,0);root.add(rod);}
 for(const angle of[-.7,.7,2.45]){const y=radius*.7*Math.sin(angle),z=radius*.7*Math.cos(angle),g=new THREE.BufferGeometry().setFromPoints([position,new THREE.Vector3(-10,y,z),new THREE.Vector3(-.4,y,z)]);root.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0x7cdbed,transparent:true,opacity:.15,depthWrite:false})));}
 root.userData.fit.push([-28,-h-3,-h],[-10,h,h]);return root;
}
export function addPlateMount(root,h,programmable=false){
 const body=solid(new THREE.BoxGeometry(2.1,1.4,2*h+2),dark());body.position.set(-.35,-h-.9,0);root.add(body);
 for(const side of[-1,1]){const rail=solid(new THREE.BoxGeometry(.65,2*h+.5,.36));rail.position.set(-.25,0,side*(h+.2));root.add(rail);const cap=solid(new THREE.BoxGeometry(.65,.36,2*h+.75));cap.position.set(-.25,side*(h+.2),0);root.add(cap);}
 if(programmable){const connector=solid(new THREE.BoxGeometry(1.7,.7,2.8));connector.position.set(-1.3,-h-.6,h*.55);root.add(connector);}
}
