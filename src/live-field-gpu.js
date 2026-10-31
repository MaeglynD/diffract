import * as THREE from 'three';
import {drumFragment,soundFragment,SoundBasis} from './resonant-gpu.js';
// A two-dimensional TE field is calculated into three floating-point textures.
// This is a field solver pass, not a change to the ray-marching display quality.
const fragment=`precision highp float;
uniform int model;uniform float parameter,halfWidth,zMax;uniform vec2 dimensions;
layout(location=0)out vec4 electric;layout(location=1)out vec4 magnetic;layout(location=2)out vec4 extra;
const float K=6.283185307179586;
vec2 cmul(vec2 a,vec2 b){return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}
vec2 cis(float p){return vec2(cos(p),sin(p));}
vec2 E=vec2(0.),Bx=vec2(0.),Bz=vec2(0.);
void beam(float x,float z,float dx,float dz,vec2 amplitude,float path){float s=x*dx+z*dz,t=-x*dz+z*dx,sum=0.;
 for(int j=-16;j<=16;j++)sum+=exp(-.5*pow(float(j)/5.,2.));
 for(int j=-16;j<=16;j++){float q=float(j)*.075/5.,p=sqrt(1.-q*q),w=exp(-.5*pow(float(j)/5.,2.))/sum;vec2 e=cmul(amplitude,cis(K*(p*(s+path)+q*t)))*w;E+=e;Bx-=(dz*p+dx*q)*e;Bz+=(dx*p-dz*q)*e;}
}
void main(){vec2 uv=(gl_FragCoord.xy-.5)/(dimensions-1.);float x=(uv.x*2.-1.)*halfWidth,z=uv.y*zMax,epsilon=1.;
 if(model==1){float zz=z-10.,L=8.+parameter,t=.7071067811865476;
  if(x+zz<0.){beam(x,zz,1.,0.,vec2(1.,0.),0.);beam(x-18.,zz,-1.,0.,vec2(-.5,0.),0.);beam(x,zz,-1.,0.,vec2(.5,0.),2.*L);if(zz>=-L){beam(x,zz,0.,-1.,vec2(0.,t),0.);beam(x,zz+2.*L,0.,1.,vec2(0.,-t),0.);}}
  else{if(x<=9.){beam(x,zz,1.,0.,vec2(t,0.),0.);beam(x-18.,zz,-1.,0.,vec2(-t,0.),0.);}beam(x,zz,0.,1.,vec2(0.,-.5),18.);beam(x,zz,0.,1.,vec2(0.,-.5),2.*L);}
 }else if(model==2){float gamma=K*.22,alpha=sqrt(gamma/2.)*parameter,c=exp(-alpha*alpha/2.),previous=0.,f=exp(-gamma*x*x/2.);epsilon=1.65*1.65-.22*.22*x*x;
  for(int m=0;m<22;m++){float n=float(m),beta=sqrt(K*K*1.65*1.65-gamma*(2.*n+1.)),derivative=sqrt(2.*gamma*n)*previous-gamma*x*f;vec2 wave=c*cis(beta*z);E+=f*wave;Bx-=beta/K*f*wave;Bz+=derivative/K*vec2(wave.y,-wave.x);float next=sqrt(2./(n+1.))*sqrt(gamma)*x*f-sqrt(n/(n+1.))*previous;previous=f;f=next;c*=alpha/sqrt(n+1.);}
 }else{vec2 d=cis(parameter),r=(d-vec2(1.,0.))*.5,A=z<10.?vec2(1.,0.):-r,B=z<10.?r:d,f=cmul(A,cis(K*(z-10.))),b=cmul(B,cis(-K*(z-10.)));E=f+b;Bx=b-f;}
 float energy=.5*(epsilon*dot(E,E)+dot(Bx,Bx)+dot(Bz,Bz));vec2 carrier=cis(-K*z);electric=vec4(cmul(E,carrier),0.,0.);magnetic=vec4(cmul(Bx,carrier),0.,0.);extra=vec4(cmul(Bz,carrier),energy,epsilon);
}`;
export class LiveFieldGpu{
 constructor(e,volume){this.e=e;this.target=new THREE.WebGLRenderTarget(volume.nx,volume.nz,{count:3,type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false});
  this.uniforms={model:{value:{michelson:1,grin:2,absorber:3}[e.id]},parameter:{value:0},halfWidth:{value:e.half},zMax:{value:e.zMax},dimensions:{value:new THREE.Vector2(volume.nx,volume.nz)}};
  const vertexShader='void main(){gl_Position=vec4(position.xy,0.,1.);}';
  if(e.id==='sound-cell')this.basis=new SoundBasis(volume,this.uniforms,vertexShader);
  this.material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms:this.uniforms,vertexShader,fragmentShader:e.id==='sound-cell'?soundFragment:e.id==='light-billiard'?drumFragment:fragment,depthTest:false,depthWrite:false});this.scene=new THREE.Scene();this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);this.scene.add(this.mesh);this.camera=new THREE.Camera();
 }
 update(renderer,parameter){if(this.parameter===parameter)return;this.parameter=parameter;this.uniforms.parameter.value=parameter;const target=renderer.getRenderTarget();this.basis?.update(renderer,this.camera,parameter);renderer.setRenderTarget(this.target);renderer.render(this.scene,this.camera);renderer.setRenderTarget(target);}
 dispose(){this.basis?.dispose();this.target.dispose();this.material.dispose();this.mesh.geometry.dispose();}
}
