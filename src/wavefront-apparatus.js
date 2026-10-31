import * as THREE from 'three';
import {SCATTER, LENSLETS, diffuserPhase} from './wavefront-benches.js';

// Surface coordinates are physical x,y. The optical axis is scene x.
function profiledSurface(half, divisions, depth) {
  const geometry = new THREE.PlaneGeometry(2*half, 2*half, divisions, divisions);
  const points = geometry.attributes.position;
  for (let i=0; i<points.count; i++) {
    const x = points.getX(i), y = points.getY(i);
    points.setXYZ(i, depth(x,y), y, -x);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function makeWavefrontApparatus(e,root,{pane,box,solid,dark,stand,label}) {
  const point = (z,y=0,x=0) => new THREE.Vector3(z,y,-x);
  const {half:cameraHalf,z:cameraZ} = e.cameraSensor;
  const floor = -cameraHalf-1.7;
  function frame(z,half,width,material) {
    for (const sign of [-1,1]) {
      box(root,[width,width,2*half+width],[z,sign*half,0],material);
      box(root,[width,2*half-width,width],[z,0,sign*half],material);
    }
  }
  // Sensor pixels are rendered by the same field sampler as the preview.
  frame(cameraZ,cameraHalf+.25,.5,dark());
  box(root,[.55,2*cameraHalf+.8,2*cameraHalf+.8],[cameraZ+.55,0,0],dark());
  stand(point(cameraZ,-cameraHalf-.5),floor);
  for (const sign of [-1,1])
    box(root,[cameraZ+3,.32,.52],[cameraZ/2,floor-.3,sign*cameraHalf*.66],dark());
  label('Camera',[cameraZ,cameraHalf+1,0]);

  if (e.id==='hartmann') {
    const {pitch,count,arrayZ,f,curvature} = LENSLETS, half = count*pitch/2;
    const depth = (x,y) => {
      const u=x-pitch*Math.round(x/pitch), v=y-pitch*Math.round(y/pitch);
      return 2*(Math.hypot(f,pitch/2,pitch/2)-Math.hypot(f,u,v));
    };
    pane(root,profiledSurface(half,count*12,depth),point(arrayZ),0xabcfdb);
    frame(arrayZ,half+.18,.39,dark());
    stand(point(arrayZ,-half-.5),floor);
    label('Microlens array',[arrayZ,half+1.7,0]);
    // Two sparse incident phase surfaces show the local tilt entering the sensor.
    const fronts = [false,true].map(warped => {
      const vertices=[];
      for (const z of [2,5]) for (let line=-2;line<=2;line++) {
        for (let t=0;t<28;t++) for(const swapped of [false,true]) for(const end of [t,t+1]) {
          const a=line*pitch, b=half*(end/14-1), x=swapped?b:a, y=swapped?a:b;
          vertices.push(z-(warped?curvature*(x*x-y*y)/2:0),y,-x);
        }
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      const guides=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x9cdad5,transparent:true,opacity:.32,depthWrite:false}));
      root.add(guides);guides.visible=!warped;return guides;
    });
    root.userData.setComparison=value=>fronts.forEach((front,i)=>{front.visible=i===value;});
    label('Incident wavefront',[2,half+1,half*.55]);
    return;
  }

  const {segments,pitch,modulator,screen} = SCATTER, half=segments*pitch/2;
  const collar=new THREE.RingGeometry(SCATTER.pupil,SCATTER.pupil+.55,96);
  const rim=solid(collar,new THREE.MeshStandardMaterial({color:0x45565f,metalness:.65,roughness:.32,side:THREE.DoubleSide}));
  rim.rotation.y=Math.PI/2;root.add(rim);
  const barrel=solid(new THREE.CylinderGeometry(SCATTER.pupil+.48,SCATTER.pupil+.48,2,80,1,true),dark());
  barrel.rotation.z=Math.PI/2;barrel.position.x=-1;root.add(barrel);
  const shoulder=solid(new THREE.CylinderGeometry(SCATTER.pupil+.48,SCATTER.pupil*.58,2.8,80),dark());
  shoulder.rotation.z=-Math.PI/2;shoulder.position.x=-3.4;root.add(shoulder);
  for(const z of [-1.55,-.95]){
    const band=solid(new THREE.TorusGeometry(SCATTER.pupil+.47,.07,8,80));
    band.rotation.y=Math.PI/2;band.position.x=z;root.add(band);
  }
  stand(point(-1,-SCATTER.pupil-.48),floor);
  label('Laser output',[0,SCATTER.pupil+1,-2]);
  // A transmissive modulator. The tile colour visualizes the actual phase command.
  frame(modulator-.21,half+.3,.6,dark());stand(point(modulator,-half-.6),floor);
  const tiles=new THREE.InstancedMesh(new THREE.BoxGeometry(.18,pitch-.045,pitch-.045),
    new THREE.MeshStandardMaterial({metalness:.42,roughness:.33}),segments**2);
  const transform=new THREE.Matrix4(), colour=new THREE.Color();
  for (let j=0;j<segments;j++)for(let i=0;i<segments;i++){
    const p=j*segments+i;
    tiles.setMatrixAt(p,transform.makeTranslation(modulator-.13,(j+.5-segments/2)*pitch,-(i+.5-segments/2)*pitch));
    tiles.setColorAt(p,colour.set(0x648a98));
  }
  tiles.layers.enable(4);root.add(tiles);
  pane(root,profiledSurface(10,72,(x,y)=>diffuserPhase(x,y)/Math.PI),point(screen),0xb4cac5);
  frame(screen,10.14,.32,dark());stand(point(screen,-10.4),floor);
  label('Phase modulator',[modulator,half+.9,half*.6]);
  label('Frosted glass',[screen,11,-3]);
  root.userData.setComparison=(value,commands)=>{
    if (!commands) return;
    for(let i=0;i<commands.length;i++){
      if(value)colour.setHSL(.5+.13*Math.sin(commands[i]),.28,.32+.18*Math.cos(commands[i]),THREE.SRGBColorSpace);
      else colour.set(0x648a98);
      tiles.setColorAt(i,colour);
    }
    tiles.instanceColor.needsUpdate=true;
  };
}
