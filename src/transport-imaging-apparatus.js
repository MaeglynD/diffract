import * as THREE from 'three';
import {CONVEYOR,conveyorPhase,trapPosition} from './optical-conveyor.js';
import {JET} from './nanojet.js';
import {SCHLIEREN} from './schlieren.js';

const point=(z,y,x=0)=>new THREE.Vector3(z,y,x);
const satin=(color,metalness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.32});
export function makeTransportImagingApparatus(e,root,{pane,box,solid,dark,rim,stand,label}){
  function mount(geometry,material,position,group=root){
    const mesh=solid(geometry,material);mesh.position.copy(position);group.add(mesh);return mesh;
  }
  function sleeve(a,b,rA,rB,material,group=root){
    const axis=b.clone().sub(a);
    const mesh=mount(new THREE.CylinderGeometry(rB,rA,axis.length(),64),material,a.clone().lerp(b,.5),group);
    mesh.quaternion.setFromUnitVectors(point(0,1),axis.normalize());
    return mesh;
  }
  const trim=satin(0xb39572),nickel=satin(0x8195a0),enamel=dark();

  if(e.id==='nanojet'){
    const {center,radius}=JET,floor=-2.35;
    box(root,[16.1,.22,11.5],[5.9,floor,0],enamel);
    pane(root,new THREE.CylinderGeometry(radius,radius,3.9,128),point(center,-.13),0xaeced1);
    const collar=mount(new THREE.RingGeometry(radius-.03,radius+.14,96),nickel,point(center,floor+.2));
    collar.rotation.x=-Math.PI/2;
    // The illuminated field of view is wider than the rod. Show the exit
    // window of a sheet illuminator at the edge of that field of view.
    const w=12.9,h=2.45;
    box(root,[.65,.18,w],[-.43,-h*.5,0],enamel);box(root,[.65,.18,w],[-.43,h*.5,0],enamel);
    for(const sign of [-1,1])box(root,[.65,h,.15],[-.43,0,sign*w*.5],nickel);
    const face=pane(root,new THREE.PlaneGeometry(w,h),point(-.38,0),0xaccacf);face.rotation.y=Math.PI/2;
    stand(point(-.43,-h*.5),floor+.3,.13);
    // The objective overlooks the cylinder AND its shadow-side jet. Its body
    // is a schematic observation aid, not a boundary in the 2D field solver.
    const z=(center+JET.scanZ)/2,lift=.8;
    sleeve(point(z,3.25+lift),point(z,4.14+lift),.68,1.22,nickel);
    sleeve(point(z,4.14+lift),point(z,5.65+lift),1.22,1.22,enamel);
    for(const y of [4.38,4.66,4.94])sleeve(point(z,y+lift),point(z,y+.06+lift),1.24,1.24,nickel);
    const lens=pane(root,new THREE.SphereGeometry(1,48,20),point(z,3.28+lift),0xadc6cc);lens.scale.set(.59,.14,.59);
    box(root,[.42,7.74+lift,.43],[z,1.66+lift/2,-3.22],nickel);
    box(root,[.71,.34,3.3],[z,5.3+lift,-1.6],enamel);
    // The section is fixed; only a mathematical point probe travels across it.
    const scan=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      point(JET.scanZ,.025,-JET.scanHalf),point(JET.scanZ,.025,JET.scanHalf)
    ]),new THREE.LineDashedMaterial({color:0xffdfa8,transparent:true,opacity:.5,dashSize:.1,gapSize:.1,depthWrite:false}));
    scan.computeLineDistances();root.add(scan);
    const reticle=mount(new THREE.TorusGeometry(.12,.014,8,40),new THREE.MeshBasicMaterial({color:0xffdfa8}),point(JET.scanZ,.025));
    reticle.rotation.x=Math.PI/2;
    root.userData.setParameter=(x=0)=>{reticle.position.z=-x;};
    label('Collimated illumination',[-.43,1.65,3.1]);label('Glass microcylinder',[center,2.,.4]);
    label('Imaging objective',[z,5.92+lift,0]);
    return;
  }
  if(e.id==='conveyor'){
    const {length,sites}=CONVEYOR,floor=-2.3;
    box(root,[length+9.6,.19,6.1],[length/2+.65,floor,-2.0],enamel);
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
    }
    // A common laser and splitter feed both heads. The folded delay has two
    // parallel legs, so moving its mirror pair by d adds 2d to the right arm.
    const splitter=-3.16,fold=length+3.02,turn=length+4.76,back=-3.8,returnLine=-2.42;
    const moving=new THREE.Group();root.add(moving);
    const feed=new THREE.MeshBasicMaterial({color:0x75e4d5,transparent:true,opacity:.64,depthWrite:false});
    const mirrorFace=satin(0xc8d7df,.75);
    const spot=new THREE.MeshBasicMaterial({color:0xb8fff1,side:THREE.DoubleSide});
    function mirror(x,t,angle,face,group=root){
      const m=mount(new THREE.BoxGeometry(.68,.68,.095),mirrorFace,point(x,0,t),group);m.rotation.y=angle;
      const glint=mount(new THREE.CircleGeometry(.069,24),spot,point(x+.052*face*Math.sin(angle),0,t+.052*face*Math.cos(angle)),group);
      glint.rotation.y=angle;
      box(group,[.17,1.72,.18],[x,-1.12,t],nickel);
    }
    function link(a,b,group=root){return sleeve(a,b,.031,.031,feed,group);}
    sleeve(point(splitter,0,back-1.75),point(splitter,0,back-.66),.29,.29,enamel);
    sleeve(point(splitter,0,back-.66),point(splitter,0,back-.54),.245,.245,nickel);
    link(point(splitter,0,back-.54),point(splitter,0,back));
    pane(root,new THREE.BoxGeometry(.6,.6,.6),point(splitter,0,back),0xaacdd2);
    const coat=pane(root,new THREE.PlaneGeometry(.82,.58),point(splitter,0,back),0x86c5c7);coat.rotation.y=-Math.PI/4;
    link(point(splitter,0,back),point(splitter,0,0));mirror(splitter,0,-Math.PI/4,-1);
    link(point(splitter,0,0),point(-2.5,0));
    const outward=link(point(splitter,0,back),point(turn,0,back));
    mirror(turn,back,-Math.PI/4,1,moving);link(point(turn,0,back),point(turn,0,returnLine),moving);mirror(turn,returnLine,Math.PI/4,-1,moving);
    const returning=link(point(fold,0,returnLine),point(turn,0,returnLine));
    mirror(fold,returnLine,Math.PI/4,1);link(point(fold,0,returnLine),point(fold,0,0));mirror(fold,0,Math.PI/4,-1);
    link(point(fold,0,0),point(length+2.5,0));
    box(moving,[.91,.24,2.15],[turn,-2.03,(back+returnLine)/2],nickel);
    box(root,[3.4,.17,1.75],[turn,-2.25,(back+returnLine)/2],enamel);
    const stage=[turn,.69,returnLine];
    label('Laser & splitter',[splitter,.66,back]);label('Optical delay',stage);
    const ceramic=new THREE.MeshStandardMaterial({color:0xffedc9,metalness:.22,roughness:.2,emissive:0xc48244,emissiveIntensity:.34});
    const beadGeometry=new THREE.SphereGeometry(.098,30,18);
    const beads=sites.map(site=>mount(beadGeometry,ceramic,point(trapPosition(site,0),0)));
    const anchor=[length/2,.42,0];
    root.userData.setParameter=(d=0)=>{
      const phase=conveyorPhase(d);
      for(let i=0;i<sites.length;i++)beads[i].position.x=trapPosition(sites[i],phase);
      anchor[0]=beads[1].position.x;
      moving.position.x=d;stage[0]=turn+d;
      outward.position.x=(splitter+turn+d)/2;outward.scale.y=1+d/(turn-splitter);
      returning.position.x=(fold+turn+d)/2;returning.scale.y=1+d/(turn-fold);
    };
    root.userData.handle=d=>[turn+d,-1.99,returnLine];
    label('Opposing objectives',[length,1.68,0]);
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
  // clamped to a carriage that translates laterally through the focus.
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
  box(root,[1.64,.45,8.2],[z,-13.5,7.15],enamel);
  stand(point(z,-13.7,7.5),floor+.27);
  const bladeLabel=[z,6.2,1];label('Knife edge',bladeLabel);
  root.userData.setParameter=(edge=0)=>{blade.position.z=-edge;bladeLabel[2]=1-edge;};
  root.userData.handle=edge=>[z,-12.5,7.15-edge];
  const h=e.cameraSensor.half;
  box(root,[1.02,2*h+.9,2*h+.9],[camera+.54,0,0],enamel);
  for(const s of [-1,1]){
    box(root,[.35,.38,2*h+.76],[camera,s*(h+.19),0],nickel);
    box(root,[.35,2*h,.38],[camera,0,s*(h+.19)],nickel);
  }
  stand(point(camera,-h-.45),floor+.27);label('Camera',[camera,h+1,0]);
}
