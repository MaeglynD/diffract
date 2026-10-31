import * as THREE from 'three';
import {solid,laser,beamEnvelope} from './setup-hardware.js';
import {volumeVertex,volumeFragment} from './render-shaders.js';
import {objectFrontTexture} from './object-wave-window.js';

// Idealized acquisition arm: a reciprocal object wave, a coherent reference,
// and a sensor linked to the separate complex-amplitude replay element.
export function makeObjectArm(geometry,fieldUniforms){
 const root=new THREE.Group();root.position.set(-38,-46,0);
 const source=solid(geometry,new THREE.MeshStandardMaterial({color:0xc8d1cc,roughness:.54,metalness:.03}));source.scale.x=-1;source.position.set(-36,46,0);root.add(source);
 const base=solid(new THREE.CylinderGeometry(10.8,11.5,1.1,64),new THREE.MeshStandardMaterial({color:0x3b5260,metalness:.6,roughness:.3}));base.position.set(-36,33.4,0);root.add(base);
 const post=solid(new THREE.CylinderGeometry(1.1,1.1,6.8,24));post.position.set(-36,29.5,0);root.add(post);
 const sensor=new THREE.Group();sensor.position.set(-4,46,0);root.add(sensor);
 const caseMesh=solid(new THREE.BoxGeometry(2,39.5,39.5),new THREE.MeshStandardMaterial({color:0x213b47,metalness:.5,roughness:.3}));caseMesh.position.x=.95;sensor.add(caseMesh);
 const sensorMaterial=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{electricMap:fieldUniforms.electricMap,dimensions:fieldUniforms.dimensions},vertexShader:'out vec2 uv2;void main(){uv2=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`precision highp float;precision highp sampler3D;uniform sampler3D electricMap;uniform vec3 dimensions;in vec2 uv2;out vec4 color;void main(){vec2 p=(uv2-.5)*38./56.+.5;vec3 uv=(vec3(p,0.)*(dimensions-1.)+.5)/dimensions;vec2 object=texture(electricMap,uv).rg;vec3 pixel=vec3(0.,(uv2.y-.5)*38.,-(uv2.x-.5)*38.);float phase=6.2831853*(length(pixel-vec3(-22.,23.,-7.))-length(vec3(-22.,23.,-7.)));float interferogram=(1.+dot(object,object)+2.*dot(object,vec2(cos(phase),-sin(phase))))*.25;float value=.12+.88*sqrt(max(0.,interferogram));float grid=step(.93,fract(uv2.x*192.))+step(.93,fract(uv2.y*192.));color=vec4(vec3(.25,.40,.45)*value+grid*.012,1.);}`,side:THREE.DoubleSide});
 const sensitive=solid(new THREE.PlaneGeometry(38,38),sensorMaterial);sensitive.rotation.y=Math.PI/2;sensitive.position.x=-.08;sensor.add(sensitive);
 const receiverBase=solid(new THREE.BoxGeometry(5,1.2,42));receiverBase.position.set(-4,25.8,0);root.add(receiverBase);
 const laserOrigin=new THREE.Vector3(-19,62,27),objectAim=new THREE.Vector3(-36,46,0),direction=objectAim.clone().sub(laserOrigin).normalize();laser(root,laserOrigin,direction,1.5);root.add(beamEnvelope(laserOrigin,objectAim,1,13.5));
 const spot=new THREE.SpotLight(0xd2efff,6500,85,.46,.55,2);spot.position.copy(laserOrigin);spot.target=source;root.add(spot);
 const reference=new THREE.Vector3(-26,69,-7),toSensor=new THREE.Vector3(-4,46,0).sub(reference).normalize();laser(root,reference,toSensor,1.5);root.add(beamEnvelope(reference,new THREE.Vector3(-4,46,0),1.2,18));
 laser(root,new THREE.Vector3(-59,65,12),new THREE.Vector3(1,0,0),1.8);const splitter=solid(new THREE.BoxGeometry(2.5,2.5,2.5));splitter.position.set(-54,65,12);root.add(splitter);root.add(beamEnvelope(new THREE.Vector3(-59,65,12),new THREE.Vector3(-55.3,65,12),.9,.9));
 const cable=(points,r=.16,color=0x7da5b4)=>{const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));root.add(solid(new THREE.TubeGeometry(c,40,r,8,false),new THREE.MeshStandardMaterial({color,metalness:.3,roughness:.4})));};
 cable([[-53,65,12],[-38,75,29],laserOrigin.clone().addScaledVector(direction,-4.2).toArray()]);cable([[-53,65,12],[-42,72,10],reference.clone().addScaledVector(toSensor,-4.2).toArray()]);
 const processor=solid(new THREE.BoxGeometry(7,4,8),new THREE.MeshStandardMaterial({color:0x315366,metalness:.6,roughness:.32}));processor.position.set(-3,20.8,23);root.add(processor);
 cable([[-2,27,16],[-2,25,23],[-3,22,23]],.28,0x536b79);cable([[-3,19,23],[12,18,23],[30,20,23],[37,26,10.6]],.28,0x536b79);
 for(let i=0;i<4;i++){const vent=solid(new THREE.BoxGeometry(.06,.24,4),new THREE.MeshStandardMaterial({color:0x0a1c24,roughness:.8}));vent.position.set(-6.54,19.7+i*.65,22.4);root.add(vent);}
 for(let j=0;j<3;j++){const led=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),new THREE.MeshBasicMaterial({color:0x7be0df}));led.position.set(-6.55,21.6-j*.8,25);root.add(led);}
 const front=objectFrontTexture(geometry),uniforms={...fieldUniforms,clipObject:{value:true},objectFront:{value:front},displayMode:{value:1},incidentLength:{value:0},opacity:{value:.24},fieldOrigin:{value:new THREE.Vector3(-42,0,0)},fieldSign:{value:new THREE.Vector3(-1,1,1)},travelMax:{value:43},showMask:{value:false},showDetector:{value:false},showGuide:{value:false}};
 const wave=new THREE.Mesh(new THREE.BoxGeometry(43,56,56).translate(-25.5,46,0),new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:volumeVertex,fragmentShader:volumeFragment,uniforms,transparent:true,side:THREE.BackSide,depthWrite:false,depthTest:false}));wave.layers.set(1);wave.frustumCulled=false;root.add(wave);
 root.userData={source,wave,textures:[front]};return root;
}
