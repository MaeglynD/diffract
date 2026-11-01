import * as THREE from 'three';
import {splineShader} from './knife-response.js';

// Evaluate the cubic reconstruction once per voxel on a blade move. The
// ray marcher and both camera views then share the same full-resolution field.
export class KnifeFieldGpu{
  constructor(volume,atlas,uniforms){
    const w=volume.nx,depth=atlas.nz,across=Math.ceil(Math.sqrt(depth));
    this.target=new THREE.WebGLRenderTarget(across*w,Math.ceil(depth/across)*w,{count:3,type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false});
    this.layout=new THREE.Vector3(w,across,depth);
    const fragmentShader=`precision highp float;precision highp sampler3D;
uniform sampler3D rightElectric,rightMagnetic,rightExtra;
uniform vec3 bladeInterval,dimensions,knifeLayout;
layout(location=0)out vec4 electric;layout(location=1)out vec4 magnetic;layout(location=2)out vec4 extra;
${splineShader}
void main(){
 vec2 pixel=floor(gl_FragCoord.xy),tile=floor(pixel/knifeLayout.x);
 float layer=tile.x+tile.y*knifeLayout.y;if(layer>=knifeLayout.z)discard;
 vec3 p=vec3(mod(pixel,knifeLayout.x)/(knifeLayout.x-1.),.5+.5*layer/(knifeLayout.z-1.));
 vec3 uv=(p*(dimensions-1.)+.5)/dimensions;
 electric=bladeField(rightElectric,uv);magnetic=bladeField(rightMagnetic,uv);
 vec2 bz=bladeField(rightExtra,uv).rg;
 extra=vec4(bz,.5*(dot(electric,electric)+dot(magnetic,magnetic)+dot(bz,bz)),-dot(electric.rg,magnetic.rg));
}`;
    this.material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{...uniforms,knifeLayout:{value:this.layout}},fragmentShader,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',depthTest:false,depthWrite:false});
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);this.scene=new THREE.Scene();this.scene.add(this.mesh);this.camera=new THREE.Camera();
  }
  update(renderer,position){
    if(this.position===position)return;this.position=position;
    const previous=renderer.getRenderTarget();renderer.setRenderTarget(this.target);
    renderer.render(this.scene,this.camera);renderer.setRenderTarget(previous);
  }
  dispose(){this.target.dispose();this.mesh.geometry.dispose();this.material.dispose();}
}
