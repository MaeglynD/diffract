import * as THREE from 'three';
import {imageContours,IMAGE_DEPTHS,IMAGE_NAMES} from './image-contours.js';
import {arrowFragment} from './render-shaders.js';
export function makeImageGuides(uniforms){
 const root=new THREE.Group();root.userData.imageGuides=[];
 for(let i=0;i<IMAGE_DEPTHS.length;i++){
  const z=IMAGE_DEPTHS[i],points=imageContours(i).flat().map(([x,y])=>new THREE.Vector3(z,y,-x));
  const material=new THREE.ShaderMaterial({uniforms:{...uniforms,color:{value:new THREE.Color(.77,.93,.96)},guideAlpha:{value:0}},vertexShader:`uniform float guideAlpha;varying float shade,alpha;void main(){shade=1.;alpha=guideAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:arrowFragment,transparent:true,depthWrite:false,depthTest:true});
  const lines=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),material);lines.layers.set(2);lines.renderOrder=5;root.add(lines);root.userData.imageGuides.push({z,name:IMAGE_NAMES[i],lines});
 }return root;
}
export function updateImageGuides(root,z){for(const item of root.userData.imageGuides||[]){const alpha=.76*Math.exp(-(((z-item.z)/2.2)**2));item.lines.visible=alpha>.015;item.lines.material.uniforms.guideAlpha.value=alpha;}}
