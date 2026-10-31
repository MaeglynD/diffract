import * as THREE from 'three';
import {laser} from './setup-hardware.js';
import {BRAGG,MICHELSON} from './bench-fields.js';
import {newApparatus} from './lab-apparatus.js';
import {CELLS,MICROSCOPE,ETALON} from './spectral-bench.js';

export function makeBenchApparatus(e,{pane,box,solid,metal,dark}){
 const root=new THREE.Group();root.userData.surfaces=[];root.userData.labels=[];root.userData.maskMap=new THREE.DataTexture(new Uint8Array(4),1,1);root.userData.maskMap.needsUpdate=true;
 const label=(text,p)=>root.userData.labels.push({text,p});
 const rim=(p,r,normal=new THREE.Vector3(1,0,0))=>{const m=solid(new THREE.TorusGeometry(r,.09,12,96));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);m.position.copy(p);root.add(m);return m;};
 const stand=(p,bottom,r=.14)=>{const m=solid(new THREE.CylinderGeometry(r,r,p.y-bottom,20));m.position.set(p.x,(p.y+bottom)/2,p.z);root.add(m);box(root,[1.4,.26,1.6],[p.x,bottom-.13,p.z]);};
 const disk=(p,r,normal,mirror=false)=>{rim(p,r,normal);const g=new THREE.CircleGeometry(r-.06,96);let face;if(mirror){face=solid(g,new THREE.MeshStandardMaterial({color:0xb4cbd4,metalness:.4,roughness:.23,emissive:0x19333e,emissiveIntensity:.35,side:THREE.DoubleSide}));face.position.copy(p);root.add(face);}else face=pane(root,g,p,0x98c5d0);face.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);return face;};
 if(['coronagraph','light-billiard','sound-cell'].includes(e.id)){
  newApparatus(e,root,{pane,box,solid,dark,rim,stand,label});
 }else if(e.id==='michelson'){
  const mirrorLabel=[MICHELSON.splitterZ-MICHELSON.armZ,2.6,0];
  const floor=-2.6;box(root,[12,.35,24],[7.5,floor-.2,0],dark());
  // Small counterbores make the common optical breadboard readable at a glance.
  const holes=new THREE.InstancedMesh(new THREE.CircleGeometry(.07,8),new THREE.MeshBasicMaterial({color:0x02090e}),9*19);const mat=new THREE.Matrix4(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);let n=0;for(let x=3;x<=11;x++)for(let z=-9;z<=9;z++){mat.compose(new THREE.Vector3(x,floor+.002,z),q,new THREE.Vector3(1,1,1));holes.setMatrixAt(n++,mat);}root.add(holes);
  laser(root,new THREE.Vector3(10,0,11),new THREE.Vector3(0,0,-1),.6);stand(new THREE.Vector3(10,-.6,12),floor);
  const splitter=new THREE.Vector3(10,0,0),cube=pane(root,new THREE.BoxGeometry(2.7,3.9,2.7),splitter,0x90bec9);
  const seam=new THREE.Mesh(new THREE.PlaneGeometry(3.75,3.9),new THREE.MeshStandardMaterial({color:0xacc7ce,metalness:.35,roughness:.22,emissive:0x173e48,emissiveIntensity:.45,transparent:true,opacity:.44,side:THREE.DoubleSide,depthWrite:false}));seam.position.copy(splitter);seam.rotation.y=-Math.PI/4;seam.layers.set(2);root.add(seam);box(root,[3.2,.22,3.2],[10,-2.07,0]);stand(new THREE.Vector3(10,-1.95,0),floor);
  for(const[p,normal]of[[new THREE.Vector3(10,0,-MICHELSON.armX),new THREE.Vector3(0,0,1)],[new THREE.Vector3(10-MICHELSON.armZ,0,0),new THREE.Vector3(1,0,0)]]){const first=root.children.length;disk(p,2.15,normal,true);stand(new THREE.Vector3(p.x,-2.15,p.z),floor);const mount=box(root,[1,.5,1.4],[p.x,floor+.2,p.z],dark());for(const v of[-.65,.65]){const knob=solid(new THREE.CylinderGeometry(.22,.22,.36,24));knob.rotation.z=Math.PI/2;knob.position.copy(p).add(new THREE.Vector3(-.4,-1.6,v));root.add(knob);}if(p.x<5){const carriage=new THREE.Group();carriage.add(...root.children.slice(first));root.add(carriage);box(root,[2.8,.18,2.1],[1.9,floor+.12,0]);const screw=solid(new THREE.CylinderGeometry(.18,.18,2.1,24));screw.rotation.z=Math.PI/2;screw.position.set(.3,floor+.6,0);root.add(screw);root.userData.setParameter=d=>{carriage.position.x=-d;mirrorLabel[0]=p.x-d;};root.userData.handle=d=>[p.x-d,-3.1,p.z];}}
  label('Laser',[10,1.4,11]);label('50:50 beam splitter',[10,2.6,0]);label('Reference mirror',[10,2.6,-9]);label('Delay mirror',mirrorLabel);
  root.userData.label=[10,3.7,0];
 }else if(e.id==='phase-microscope'){
  const floor=-12.6;box(root,[82,.4,2.8],[40,floor-.2,0],dark());
  const specimen=pane(root,new THREE.BoxGeometry(.08,17,17),new THREE.Vector3(.1,0,0),0x9ac2cc);
  for(const[x,y,a,b,t]of CELLS){const g=new THREE.SphereGeometry(1,40,24),cell=pane(root,g,new THREE.Vector3(.22,y,-x),0xa4ceca);cell.scale.set(.16,b,a);cell.rotation.x=t;}
  for(const z of[20,60]){const p=new THREE.Vector3(z,0,0);rim(p,MICROSCOPE.aperture);const lens=pane(root,new THREE.SphereGeometry(1,96,48),p,0x9ecad6);lens.scale.set(.7,MICROSCOPE.aperture,MICROSCOPE.aperture);stand(new THREE.Vector3(z,-10,0),floor);label(z===20?'Objective lens':'Imaging lens',[z,11.2,0]);}
  const plate=pane(root,new THREE.CircleGeometry(5.6,96),new THREE.Vector3(40,0,0),0x8db9c3);plate.rotation.y=Math.PI/2;rim(new THREE.Vector3(40,0,0),5.6);const dot=pane(root,new THREE.CircleGeometry(MICROSCOPE.dot,64),new THREE.Vector3(40.04,0,0),0xe6d0ac);dot.rotation.y=Math.PI/2;stand(new THREE.Vector3(40,-5.6,0),floor);label('Quarter-wave phase dot',[40,7,0]);label('Transparent specimen',[.1,9.6,0]);
  root.userData.phaseDot=dot;root.userData.label=[40,13,0];
 }else if(e.id==='fabry-perot'){
  box(root,[16,.4,4],[9,-6.3,0],dark());
  for(const z of[ETALON.a,ETALON.b]){const p=new THREE.Vector3(z,0,0);disk(p,5.2,new THREE.Vector3(1,0,0));stand(new THREE.Vector3(z,-5.2,0),-6.1);for(const a of[.4,2.5,4.6]){const knob=solid(new THREE.CylinderGeometry(.18,.18,.65,24));knob.rotation.z=Math.PI/2;knob.position.set(z,5.6*Math.cos(a),5.6*Math.sin(a));root.add(knob);}label(z===ETALON.a?'Input coupler':'Output coupler',[z,6.4,0]);}
  for(const sign of[-1,1]){const rod=solid(new THREE.CylinderGeometry(.06,.06,10,12));rod.rotation.z=Math.PI/2;rod.position.set(8,-4.8,sign*3.3);root.add(rod);}
  laser(root,new THREE.Vector3(0,0,0),new THREE.Vector3(1,0,0),.5);root.userData.label=[8,7,0];
 }else if(e.id==='grin'){
  const h=e.viewHeight;box(root,[e.zMax,.25,10],[e.zMax/2,-h-.25,0],dark());pane(root,new THREE.BoxGeometry(e.zMax,2*h,2*e.half),new THREE.Vector3(e.zMax/2,0,0),0x86bdc7);
  const launch=new THREE.Group();laser(launch,new THREE.Vector3(0,0,0),new THREE.Vector3(1,0,0),.45);root.add(launch);root.userData.setParameter=x=>{launch.position.z=-x;};root.userData.handle=x=>[0,-h-.7,-x];label('Graded-index glass',[47,h+1,0]);label('Movable launch',[0,2.7,0]);root.userData.label=[47,h+2.8,0];
 }else if(e.id==='absorber'){
  box(root,[19,.3,7.8],[10,-2.6,0],dark());laser(root,new THREE.Vector3(.4,0,0),new THREE.Vector3(1,0,0),.5);laser(root,new THREE.Vector3(19.6,0,0),new THREE.Vector3(-1,0,0),.5);
  rim(new THREE.Vector3(10,0,0),3);const film=new THREE.Mesh(new THREE.CircleGeometry(2.92,96),new THREE.MeshStandardMaterial({color:0x87979a,metalness:.85,roughness:.28,transparent:true,opacity:.38,side:THREE.DoubleSide,depthWrite:false}));film.rotation.y=Math.PI/2;film.position.x=10;film.layers.set(2);root.add(film);stand(new THREE.Vector3(10,-2.1,0),-2.5);label('Thin absorbing film',[10,3.8,0]);label('Coherent input',[.4,2.1,0]);label('Phase-controlled input',[19.6,2.1,0]);root.userData.label=[10,5,0];
 }else if(e.id==='bragg-cavity'){
  box(root,[BRAGG.end-BRAGG.start+.4,.12,6.2],[3.5,-e.viewHeight-.1,0],dark());
  for(const[l,i]of BRAGG.layers.map((l,i)=>[l,i])){const center=new THREE.Vector3((l.a+l.b)/2,0,0);pane(root,new THREE.BoxGeometry(l.d,2*e.viewHeight,5.8),center,l.n===BRAGG.H?0x8baed6:0x9bd0c4);if(i===7)label('Half-wave defect',[center.x,e.viewHeight+.6,0]);}
  label('Dielectric mirror',[BRAGG.start,e.viewHeight+.6,2]);label('Dielectric mirror',[BRAGG.end,e.viewHeight+.6,-2]);root.userData.label=[3.5,e.viewHeight+1.4,0];
 }
 const bounds=new THREE.Box3().setFromObject(root);root.userData.fit=[];for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z])root.userData.fit.push([x,y,z]);
 return root;
}
