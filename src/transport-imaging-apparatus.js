import * as THREE from 'three';
import {CONVEYOR,trapPosition} from './optical-conveyor.js';
import {SCHLIEREN} from './schlieren.js';

const point=(z,y,x=0)=>new THREE.Vector3(z,y,x);
const satin=(color,metalness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.32});
export function makeTransportImagingApparatus(e,root,{pane,box,solid,dark,rim,stand,label}){
  function mount(geometry,material,position,group=root){
    const mesh=solid(geometry,material);mesh.position.copy(position);group.add(mesh);return mesh;
  }
  function sleeve(a,b,rA,rB,material){
    const axis=b.clone().sub(a);
    const mesh=mount(new THREE.CylinderGeometry(rB,rA,axis.length(),64),material,a.clone().lerp(b,.5));
    mesh.quaternion.setFromUnitVectors(point(0,1),axis.normalize());
    return mesh;
  }
  function wire(points,radius,material){
    return mount(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,radius,8,false),material,point(0,0));
  }
  const trim=satin(0xb39572),nickel=satin(0x8195a0),enamel=dark();

  if(e.id==='conveyor'){
    const {length,sites}=CONVEYOR,floor=-2.3;
    // Two fibre-fed launch heads, with opposing annular pupils. The field
    // starts at their exits. Everything hangs from one common alignment rail.
    box(root,[length+5.6,.19,1.05],[length/2,floor,0],enamel);
    for(const sign of [-1,1]){
      const exit=sign===-1?0:length,at=d=>point(exit+sign*d,0);
      sleeve(at(.18),at(.82),1.33,1.64,nickel);
      sleeve(at(.82),at(1.63),1.65,1.65,enamel);
      sleeve(at(1.63),at(2.16),1.65,.61,nickel);
      sleeve(at(2.16),at(2.5),.59,.42,enamel);
      for(const d of [.96,1.16,1.36,1.56])sleeve(at(d),at(d+.038),1.66,1.66,nickel);
      const glass=pane(root,new THREE.SphereGeometry(1,56,26),at(.13),0xabbfc7);glass.scale.set(.14,1.31,1.31);
      const pupil=mount(new THREE.RingGeometry(1.05,1.19,80),new THREE.MeshStandardMaterial({color:0xb4cccd,emissive:0x497c7b,side:THREE.DoubleSide}),at(.016));
      pupil.rotation.y=Math.PI/2;stand(point(exit+sign*1.25,-1.63),floor+.355,.11);
      // Both fibres meet at the splitter behind the rail.
      wire([at(2.5),point(exit+sign*2.83,0,-.5),point(exit+sign*2.76,-1.25,-1.7),
        point(exit+sign*1.7,floor+.25,-1.98),point(length/2+sign*.45,floor+.25,-2.0)],.056,enamel);
    }
    box(root,[.96,.38,.53],[length/2,floor+.25,-2.0],nickel);
    sleeve(point(length/2,floor+.25,-2.23),point(length/2,floor+.25,-3.05),.09,.09,enamel);
    const ceramic=new THREE.MeshStandardMaterial({color:0xffedc9,metalness:.22,roughness:.2,emissive:0xc48244,emissiveIntensity:.34});
    const beadGeometry=new THREE.SphereGeometry(.098,30,18);
    const beads=sites.map(site=>mount(beadGeometry,ceramic,point(trapPosition(site,0),0)));
    const anchor=[length/2,.42,0];
    root.userData.setParameter=(phase=0)=>{
      for(let i=0;i<sites.length;i++)beads[i].position.x=trapPosition(sites[i],phase);
      anchor[0]=beads[1].position.x;
    };
    label('Annular beam',[0,1.68,0]);label('Phase-controlled beam',[length,1.68,0]);
    label('Trapped bead',anchor);
    return;
  }

  const {f,beam,lens,heaterY,camera}=SCHLIEREN,floor=-15;
  for(const side of [-1,1])box(root,[camera+4,.55,.68],[camera/2,floor,side*4.2],enamel);
  // Expanded illuminator, looking into the heated air above the copper tip.
  sleeve(point(-2,0),point(-.55,0),beam*.83,beam,nickel);
  const face=pane(root,new THREE.CircleGeometry(beam,80),point(-.52,0),0xa5cdcb);face.rotation.y=Math.PI/2;
  stand(point(-1,-beam),floor+.27);label('Collimated light',[-1,beam+1,-3]);
  sleeve(point(0,heaterY-.9),point(0,heaterY-.24),.89,.52,trim);
  sleeve(point(0,heaterY-2.35),point(0,heaterY-.9),.92,.9,enamel);
  stand(point(0,heaterY-2.35),floor+.27);
  const loops=[];for(let j=0;j<=112;j++){
    const a=6*Math.PI*j/112;loops.push(point(.42*Math.cos(a),heaterY-.45+.047*a,.42*Math.sin(a)));
  }
  const nichrome=new THREE.MeshStandardMaterial({color:0xb57449,metalness:.55,roughness:.38,emissive:0xad491c,emissiveIntensity:.45});
  mount(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loops),112,.095,10,false),nichrome,point(0,0));
  label('Heater · warm air',[0,heaterY+.8,1.2]);
  for(const z of [f,3*f]){
    const glass=pane(root,new THREE.SphereGeometry(1,72,36),point(z,0),0xa3c3cb);glass.scale.set(.62,lens,lens);
    rim(point(z,0),lens+.06);stand(point(z,-lens),floor+.27);
  }
  const blade=new THREE.Group(),z=2*f;
  // A ground single-bevel edge faces the focus. The back of the blade is
  // clamped to a carriage that physically withdraws for the open observation.
  const bladeShape=new THREE.Shape();
  bladeShape.moveTo(0,-5.2);bladeShape.lineTo(6.8,-5.2);bladeShape.lineTo(7.3,-4.7);
  bladeShape.lineTo(7.3,4.7);bladeShape.lineTo(6.8,5.2);bladeShape.lineTo(0,5.2);bladeShape.closePath();
  for(const y of [-2.9,2.9]){
    const hole=new THREE.Path();hole.absellipse(5.8,y,.42,.42,0,2*Math.PI,true);bladeShape.holes.push(hole);
  }
  const sheet=mount(new THREE.ExtrudeGeometry(bladeShape,{depth:.09,bevelEnabled:false,curveSegments:24}),satin(0x8696a4),point(z,0),blade);
  sheet.rotation.y=-Math.PI/2;
  box(blade,[.14,10.4,.18],[z+.04,0,.09],nickel);
  box(blade,[.82,6.1,1.1],[z,0,7.15],enamel);
  box(blade,[.54,10,.64],[z,-7.8,7.15],nickel);
  box(blade,[2,.64,2.15],[z,-12.95,7.15],enamel);root.add(blade);
  box(root,[1.64,.45,22],[z,-13.5,12],enamel);
  stand(point(z,-13.7,7.5),floor+.27);
  const bladeLabel=[z,6.2,1];label('Knife edge',bladeLabel);
  root.userData.setComparison=open=>{blade.position.z=open?14:0;bladeLabel[2]=blade.position.z+1;};
  const h=e.cameraSensor.half;
  box(root,[1.02,2*h+.9,2*h+.9],[camera+.54,0,0],enamel);
  for(const s of [-1,1]){
    box(root,[.35,.38,2*h+.76],[camera,s*(h+.19),0],nickel);
    box(root,[.35,2*h,.38],[camera,0,s*(h+.19)],nickel);
  }
  stand(point(camera,-h-.45),floor+.27);label('Camera',[camera,h+1,0]);
}
