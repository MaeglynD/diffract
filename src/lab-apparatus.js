import * as THREE from 'three';
import {CORONA} from './lab-experiments.js';
import {DRUM,drumHeight,SOUND} from './resonant-instruments.js';

// Physical coordinates (x,y,z) map to scene (z,y,-x).
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const brass=()=>new THREE.MeshStandardMaterial({color:0xb68d67,metalness:.7,roughness:.29});
export function newApparatus(e,root,{pane,box,solid,dark,rim,stand,label}){
 const add=(geo,mat,p)=>{const m=solid(geo,mat);m.position.copy(p);root.add(m);return m;};
 const ring=(z,r0,r1,mat,y=0)=>{const m=add(new THREE.RingGeometry(r0,r1,96),mat,V(z,y,0));m.rotation.y=Math.PI/2;return m;};
 const rod=(a,b,r,mat)=>{const d=b.clone().sub(a),m=add(new THREE.CylinderGeometry(r,r,d.length(),20),mat,a.clone().lerp(b,.5));m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return m;};
 if(e.id==='coronagraph'){
  const {f,pupil,stop,lens}=CORONA,axis=V(1,0,0),floor=-10.1;
  box(root,[5*f,.4,3.4],[2.5*f,floor-.25,0],dark());
  const blued=new THREE.MeshStandardMaterial({color:0x24303c,metalness:.55,roughness:.32,side:THREE.DoubleSide});
  ring(0,pupil,pupil+1.1,blued);rim(V(0,0,0),pupil+1.1);stand(V(0,-pupil-1.1,0),floor);
  for(const z of[f,3*f,4*f]){
   const r=z===4*f?stop:lens;
   const glass=pane(root,new THREE.SphereGeometry(1,72,36),V(z,0,0),0xaacfd3);glass.scale.set(z===4*f?.22:.42,r,r);
   rim(V(z,0,0),r+.08);if(z!==4*f)stand(V(z,-r,0),floor);
  }
  // A charge-two phase plate has two azimuthal ramps, with one phase
  // wrap per half turn. The optical calculation is their thin-screen limit.
  const r=CORONA.mask;
  for(let turn=0;turn<2;turn++){
   const pos=[],idx=[];for(let i=0;i<=72;i++){
    const t=i/72,a=(turn+t)*Math.PI,depth=.53*t-.265;
    for(const radius of[.035,r])pos.push(depth,radius*Math.sin(a),-radius*Math.cos(a));
    if(i){const b=2*i;idx.push(b-2,b-1,b,b,b-1,b+1);}
   }
   const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geom.setIndex(idx);geom.computeVertexNormals();pane(root,geom,V(2*f,0,0),0xaaa9c8);
  }
  rim(V(2*f,0,0),r+.06);stand(V(2*f,-r,0),floor);
  ring(4*f-.04,stop,9.5,blued);rim(V(4*f-.04,0,0),9.52,axis);stand(V(4*f,-9.5,0),floor);
  label('Entrance pupil',[0,6,0]);label('Vortex mask',[2*f,r+1,0]);label('Lyot stop',[4*f,10.7,0]);label('Camera',[5*f,7.1,0]);
  // A sensor frame remains at the camera when the inspection plane is moved.
  for(const s of[-1,1]){box(root,[.46,.23,12.4],[5*f,s*6.1,0]);box(root,[.46,12,.23],[5*f,0,s*6.1]);}
  stand(V(5*f,-6.2,0),floor);
 }else if(e.id==='sound-cell'){
  const h=e.viewHeight,z=SOUND.cell,floor=-h-.9;
  box(root,[6,.4,24],[z-.6,floor,0],dark());
  // A ribbon launcher is the cross-section of the prescribed sheet beam.
  box(root,[1.25,2*h+.6,14.8],[-.72,0,0],dark());
  const slot=new THREE.MeshBasicMaterial({color:0x78b2bf});
  box(root,[.03,2*h,12.5],[-.08,0,0],slot);
  pane(root,new THREE.BoxGeometry(.62,2*h,23.5),V(z,0,0),0x91bac4);
  const lines=new THREE.Group();for(let m=-2;m<=2;m++)box(lines,[.025,2*h,.12],[z+.322,0,m*SOUND.period],new THREE.MeshBasicMaterial({color:0xa7d8dc,transparent:true,opacity:.22,depthWrite:false}));
  root.add(lines);const transducer=brass();box(root,[1.32,2*h+.2,.66],[z,0,12.1],transducer);
  for(let j=-2;j<=2;j++)box(root,[1.5,.1,.86],[z,j,12.14],dark());
  box(root,[1.1,2*h,.7],[z,0,-12.15],dark());
  const cable=new THREE.CatmullRomCurve3([V(z,0,12.5),V(z,.3,14),V(z+1.8,floor+.2,15.4),V(z+4,floor+.16,15.1)]);
  add(new THREE.TubeGeometry(cable,32,.09,12,false),dark(),V(0,0,0));
  root.userData.setParameter=d=>{for(const m of lines.children)m.material.opacity=d/2.7*.42;};
  label('Ultrasound transducer',[z,h+.5,12]);label('Sound cell',[z,h+.8,-6]);label('Diffracted orders',[e.z,h+1,0]);
 }else if(e.id==='light-billiard'){
  const a=DRUM.side,b=DRUM.base,h=e.viewHeight;
  const corners=[V(b,0,-a/2),V(b+drumHeight,0,0),V(b,0,a/2)];
  const profile=new THREE.Shape();corners.forEach((p,i)=>profile[i?'lineTo':'moveTo'](p.x,-p.z));profile.closePath();
  const foot=add(new THREE.ExtrudeGeometry(profile,{depth:.19,bevelEnabled:true,bevelSize:.075,bevelThickness:.045,bevelSegments:3}),dark(),V(0,-h-.235,0));foot.rotation.x=-Math.PI/2;
  const trim=brass();
  for(let i=0;i<3;i++){
   const p=corners[i],q=corners[(i+1)%3],mid=p.clone().lerp(q,.5),dir=q.clone().sub(p);
   // The polished upper edges locate the walls; the walls are cut away for inspection.
   const wall=add(new THREE.BoxGeometry(a,2*h,.065),trim,mid);wall.rotation.y=-Math.atan2(dir.z,dir.x);
   for(const y of[-h,h])rod(p.clone().setY(y),q.clone().setY(y),.035,trim);
   rod(p.clone().setY(-h-.26),p.clone().setY(h+.065),.092,trim);
   const cap=add(new THREE.CylinderGeometry(.073,.073,.026,18),dark(),p.clone().setY(h+.08));
   box(root,[.1,.008,.018],cap.position.clone().add(V(0,.016,0)).toArray(),trim);
  }
  // The chamber is normally closed. A coaxial port under the conducting floor
  // shows how a microwave probe reaches the enclosed field in the lab.
  const feed=corners[0].clone().lerp(corners[1],.35);feed.z*=.72;
  rod(feed.clone().setY(-h-.42),feed.clone().setY(-h+.09),.035,trim);
  rod(feed.clone().setY(-h-.42),feed.clone().setY(-h-.29),.095,dark());
  label('Microwave cavity · lid removed',[b+.4,h+.34,-a*.36]);
 }
}
