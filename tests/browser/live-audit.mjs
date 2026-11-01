import * as THREE from 'three';
import {KnifeFieldGpu} from '../../src/knife-gpu.js';
import {bladeInterval,bladeSampler} from '../../src/knife-response.js';
import {loadKnifeTable} from '../../src/knife-table.js';
import {decodeVolume,fromHalf} from '../../src/volume-data.js';
import {LiveFieldGpu} from '../../src/live-field-gpu.js';
import {liveModel,demodulated} from '../../src/live-physics.js';
import {NATIVE_EXPERIMENTS} from '../../src/native-experiments.js';
const renderer=new THREE.WebGLRenderer(),target=new THREE.WebGLRenderTarget(12,40,{depthBuffer:false}),camera=new THREE.Camera(),scene=new THREE.Scene();
const material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{a:{value:null},b:{value:null},c:{value:null}},vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;uniform sampler2D a,b,c;out vec4 color;void main(){int component=int(gl_FragCoord.x),j=int(gl_FragCoord.y);ivec2 p=ivec2(13+(j*47)%230,19+(j*113)%1060);vec4 v=component<4?texelFetch(a,p,0):component<8?texelFetch(b,p,0):texelFetch(c,p,0);uint bits=floatBitsToUint(v[component%4]);color=vec4(float(bits&255u),float((bits>>8)&255u),float((bits>>16)&255u),float((bits>>24)&255u))/255.;}`,depthTest:false,depthWrite:false});
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
try{
 const results=[];for(const[id,parameters]of[['michelson',[-.4,.12,.4]],['grin',[-2.2,0,2.2]],['absorber',[0,Math.PI/2,Math.PI]],['sound-cell',[0,1.72,2.4048256]],['light-billiard',[.13,Math.PI/4,Math.PI/2]]]){
  const e=NATIVE_EXPERIMENTS.find(e=>e.id===id),gpu=new LiveFieldGpu(e,{nx:257,nz:1101});
  for(const parameter of parameters){gpu.update(renderer,parameter);['a','b','c'].forEach((name,i)=>material.uniforms[name].value=gpu.target.textures[i]);renderer.setRenderTarget(target);renderer.render(scene,camera);const bytes=new Uint8Array(12*40*4);renderer.readRenderTargetPixels(target,0,0,12,40,bytes);const view=new DataView(bytes.buffer),model=liveModel(id,parameter);let error=0,norm=0,maximum=0,energyError=0,energyNorm=0;
   for(let j=0;j<40;j++){const x=((13+(j*47)%230)/256*2-1)*e.half,z=(19+(j*113)%1060)/1100*e.zMax,f=demodulated(model,x,z),epsilon=model.epsilon(x,z),energy=.5*(epsilon*(f[0]**2+f[1]**2)+f[4]**2+f[5]**2+f[8]**2+f[9]**2);for(let k=0;k<10;k++){const delta=view.getFloat32((j*12+k)*4,true)-f[k];error+=delta*delta;norm+=f[k]*f[k];maximum=Math.max(maximum,Math.abs(delta));}const de=view.getFloat32((j*12+10)*4,true)-energy;energyError+=de*de;energyNorm+=energy*energy;}
   results.push({id,parameter,relativeRms:Math.sqrt(error/Math.max(norm,1e-20)),energyRelativeRms:Math.sqrt(energyError/Math.max(energyNorm,1e-20)),maximum,samples:400});
  }gpu.dispose();
 }
 const atlas=decodeVolume((await loadKnifeTable()).buffer),base={nx:97,ny:97,nz:145,half:12,zMax:72};
 const sample=bladeSampler(base,atlas),uniforms={dimensions:{value:new THREE.Vector3(97,97,145)},bladeInterval:{value:new THREE.Vector3()}};
 for(const [i,name] of ['rightElectric','rightMagnetic','rightExtra'].entries()){
  const t=new THREE.Data3DTexture(atlas.textures[i],atlas.nx,atlas.ny,atlas.nz);
  t.type=THREE.HalfFloatType;t.format=THREE.RGBAFormat;t.minFilter=t.magFilter=THREE.LinearFilter;t.needsUpdate=true;uniforms[name]={value:t};
 }
 const blade=new KnifeFieldGpu(base,atlas,uniforms);
 for(const position of [-1.625,.17,1.625]){
  const range=bladeInterval(position);uniforms.bladeInterval.value.fromArray(range);blade.update(renderer,position);
  let error=0,norm=0,energyError=0,energyNorm=0;
  for(let i=0;i<32;i++){
   const layer=(i*29)%73,ix=11+(i*17)%75,iy=9+(i*11)%77,px=(layer%9)*97+ix,py=Math.floor(layer/9)*97+iy;
   const f=sample(range,(ix-48)/4,(iy-48)/4,36+layer/2),values=[];
   for(let c=0;c<3;c++){const u=new Uint16Array(4);renderer.readRenderTargetPixels(blade.target,px,py,1,1,u,undefined,c);values.push(...Array.from(u,fromHalf));}
   for(let c=0;c<10;c++){error+=(values[c]-f[c])**2;norm+=f[c]**2;}
   const energy=f.reduce((s,v)=>s+.5*v*v,0);energyError+=(values[10]-energy)**2;energyNorm+=energy**2;
  }
  results.push({id:'schlieren',position,relativeRms:Math.sqrt(error/norm),energyRelativeRms:Math.sqrt(energyError/energyNorm),samples:320});
 }
 blade.dispose();for(const key of ['rightElectric','rightMagnetic','rightExtra'])uniforms[key].value.dispose();
 const passed=results.every(r=>r.relativeRms<.002&&r.energyRelativeRms<.002);document.querySelector('#result').textContent=JSON.stringify({passed,results},null,2);document.body.dataset.passed=String(passed);
}catch(error){document.querySelector('#result').textContent=error.stack;document.body.dataset.passed='false';}
renderer.dispose();
