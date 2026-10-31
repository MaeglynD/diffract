import * as THREE from 'three';
import {makeObjectArm} from './bunny-recording.js';
import {sampleField} from './volume-data.js';
import {loadGeometry} from './geometry-data.js';

export async function makeBunnyModels(fieldUniforms,signal){
 const {buffer,world,normals}=await loadGeometry('assets/models/bunny.mesh','bunny',signal),meta=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,0,1024)).split('\0')[0]),positions=new Float32Array(buffer,1024,meta.vertices*3),indices=new Uint32Array(buffer,1024+meta.vertices*12,meta.triangles*3),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(world,3));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
 const root=new THREE.Group(),recording=makeObjectArm(geometry,fieldUniforms),source=recording.userData.source;root.add(recording);
 const targetGeometry=geometry.clone();targetGeometry.setAttribute('strength',new THREE.BufferAttribute(new Float32Array(meta.vertices).fill(.5),1));
 const target=new THREE.Mesh(targetGeometry,new THREE.ShaderMaterial({transparent:false,depthWrite:true,depthTest:true,side:THREE.FrontSide,uniforms:{cutZ:{value:32},opacity:{value:.78},color:{value:new THREE.Color(.42,.9,1.)}},vertexShader:`attribute float strength;varying vec3 vNormal,vView;varying float power,depth;void main(){depth=(modelMatrix*vec4(position,1.)).x;vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);power=strength;gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform float opacity,cutZ;uniform vec3 color;varying vec3 vNormal,vView;varying float power,depth;void main(){vec3 n=normalize(vNormal);float edge=pow(1.-abs(dot(n,normalize(vView))),2.);float shade=.28+.72*max(0.,dot(n,normalize(vec3(-.35,.65,1.))));float a=opacity*(.35+.55*sqrt(max(power,0.))+.25*edge);float contour=1.-smoothstep(.06,.24,abs(depth-cutZ));vec3 tint=color*(.4+.6*shade)*(1.+.15*sqrt(max(power,0.)));gl_FragColor=vec4(mix(tint,vec3(.92,.97,1.),contour*.85),min(a+contour*.3,.94));}`}));target.position.x=meta.centerZ;target.layers.set(3);root.add(target);
 root.userData={source,target,positions,meta,recording};return root;
}
export function updateBunnySurface(root,volume){
 const {target,positions,meta}=root.userData;if(!target||!volume)return;const attribute=target.geometry.attributes.strength;if(volume.bunnyStrength){attribute.array.set(volume.bunnyStrength);attribute.needsUpdate=true;return;}const f=new Float32Array(10),values=attribute.array;let maximum=0;
 for(let i=0;i<meta.vertices;i++){sampleField(volume,positions[i*3],positions[i*3+1],meta.centerZ+positions[i*3+2],f);let energy=0;for(const c of f)energy+=c*c*.5;values[i]=energy;maximum=Math.max(maximum,energy);}
 // Display mapping on an explicitly optional surface guide, never detector data.
 for(let i=0;i<values.length;i++)values[i]/=Math.max(maximum*.4,1e-6);attribute.needsUpdate=true;
}
