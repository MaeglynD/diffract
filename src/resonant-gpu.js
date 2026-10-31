import * as THREE from 'three';
import {DRUM,drumDirections,SOUND,soundWeights} from './resonant-instruments.js';
const f=n=>Number(n).toFixed(12);
const header=`precision highp float; precision highp int;
uniform float parameter,halfWidth,zMax;uniform vec2 dimensions;
layout(location=0)out vec4 electric;layout(location=1)out vec4 magnetic;layout(location=2)out vec4 extra;
const float K=6.283185307179586;
vec2 cis(float a){return vec2(cos(a),sin(a));}
vec2 mul(vec2 a,vec2 b){return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
void packField(vec2 e,vec2 bx,vec2 bz,float z){
 vec2 c=cis(-K*z);electric=vec4(mul(e,c),0.,0.);magnetic=vec4(mul(bx,c),0.,0.);
 extra=vec4(mul(bz,c),.5*(dot(e,e)+dot(bx,bx)+dot(bz,bz)),1.);
}`;
export const drumFragment=header+`
void main(){
 vec2 uv=(gl_FragCoord.xy-.5)/(dimensions-1.);
 float x=(2.*uv.x-1.)*halfWidth,z=uv.y*zMax,X=x+${f(DRUM.side/2)},Z=z-${f(DRUM.base)};
 vec2 e=vec2(0.),bx=e,bz=e;
 if(Z>=0. && abs(x)+Z/sqrt(3.)<=${f(DRUM.side/2)}){
  vec2 w=.5*vec2(cos(parameter)+sin(parameter),cos(parameter)-sin(parameter));
  const vec2 v[3]=vec2[3](${drumDirections.map(([q,p])=>'vec2('+f(q)+','+f(p)+')').join(',')});
  for(int j=0;j<3;j++){float q=v[j].x,p=v[j].y;vec2 a=cis(K*q*X),b=cis(K*p*Z);
   e+=w*a*b.y;bx+=vec2(-w.y*a.y,w.x*a.x)*p*b.x;bz+=vec2(w.y*a.x,w.x*a.y)*q*b.y;}
 }
 packField(e,bx,bz,z);
}`;
// Each tile is one propagated diffraction order. Only the five Bessel
// weights change during a gesture; no FFT or data upload is needed.
export const soundFragment=header+`
uniform sampler2D atlasEB,atlasZ;uniform float weights[5];
void main(){
 ivec2 ij=ivec2(gl_FragCoord.xy),size=ivec2(dimensions);
 float z=float(ij.y)/(dimensions.y-1.)*zMax;vec4 eb=vec4(0.);vec2 bz=vec2(0.);
 for(int i=0;i<9;i++){int m=i-4;float w=z<${f(SOUND.cell)}?(m==0?1.:0.):weights[abs(m)];
  ivec2 at=ij+ivec2(i%3,i/3)*size;eb+=w*texelFetch(atlasEB,at,0);bz+=w*texelFetch(atlasZ,at,0).xy;}
 // The basis already has the axial carrier removed.
 electric=vec4(eb.xy,0.,0.);magnetic=vec4(eb.zw,0.,0.);extra=vec4(bz,.5*(dot(eb,eb)+dot(bz,bz)),1.);
}`;
const basisFragment=`precision highp float; precision highp int;
 uniform vec2 dimensions;uniform float halfWidth,zMax;
 layout(location=0)out vec4 EB;layout(location=1)out vec4 BZ;
 void main(){
  ivec2 ij=ivec2(gl_FragCoord.xy),size=ivec2(dimensions),tile=ij/size;
  int m=tile.x+3*tile.y-4;vec2 uv=vec2(ij%size)/(dimensions-1.);
  float x=(2.*uv.x-1.)*halfWidth,z=uv.y*zMax,norm=0.;vec2 e=vec2(0.),bx=e,bz=e;
  for(int j=-${SOUND.sidebands};j<=${SOUND.sidebands};j++){
   float s=float(j)*${f(SOUND.dq)},q=s+float(m)/${f(SOUND.period)},p=sqrt(1.-q*q);
   float u=3.14159265359*${f(SOUND.waist)}*s,w=exp(-u*u);
   float t=6.28318530718*(q*x+(p-1.)*z-p*${f(SOUND.cell)}+float(abs(m))*.25);
   vec2 a=w*vec2(cos(t),sin(t));e+=a;bx-=p*a;bz+=q*a;norm+=w;
  }
  EB=vec4(e,bx)/norm;BZ=vec4(bz/norm,0.,0.);
 }`;
export class SoundBasis{
 constructor(volume,uniforms,vertexShader){
  this.target=new THREE.WebGLRenderTarget(3*volume.nx,3*volume.nz,{count:2,type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  this.material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader,fragmentShader:basisFragment,uniforms,depthTest:false,depthWrite:false});
  this.scene=new THREE.Scene();this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);this.scene.add(this.mesh);
  uniforms.atlasEB={value:this.target.textures[0]};uniforms.atlasZ={value:this.target.textures[1]};uniforms.weights={value:soundWeights(0)};
 }
 update(renderer,camera,d){
  if(!this.ready){renderer.setRenderTarget(this.target);renderer.render(this.scene,camera);this.ready=true;}
  this.material.uniforms.weights.value=soundWeights(d);
 }
 dispose(){this.mesh.geometry.dispose();this.material.dispose();this.target.dispose();}
}
