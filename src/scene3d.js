import * as THREE from 'three';
import {verifyGpuVolume} from './gpu-validation.js';
import {detectorPeak} from './volume-data.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {sampleVectorVolume} from './vector-samples.js';
import {makeIllumination} from './setup-hardware.js';
import {makeOpticalElement,plateHalf,isProgrammable} from './optical-element.js';
import {makeBunnyModels,updateBunnySurface} from './bunny-model.js';
import {layoutLabels} from './label-layout.js';
import {makeTopology,planeIntersections,makeDesignCurves,updateIntersections} from './topology-view.js';
import {makeImageGuides,updateImageGuides} from './image-guides.js';
import {volumeVertex,volumeFragment,arrowVertex,arrowFragment,detectorVertex,detectorFragment} from './render-shaders.js';

import {DEFAULT_APPEARANCE} from './display-presets.js';
const PALETTES={cyan:[0x33dbf2,0x996eff,0x70e7f5,0xf5c778,0x145c78,0x80f0e3,0xffdb8a],amber:[0xf4aa64,0x7e90dc,0xffd18d,0x9bbcff,0x4a315c,0xeaab6e,0xffe4a8],silver:[0xb5cfe3,0x8c76b8,0xe5ecf5,0xcbb7f1,0x283854,0x92abc5,0xf2e4dc]};
const shaderColor=value=>new THREE.Color(value).convertLinearToSRGB();
function dispose(root){root.userData.disposed=true;root.userData.renderTarget?.dispose();root.traverse(o=>{for(const t of o.userData.textures||[])t.dispose();o.geometry?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!m?.map?.userData?.shared)m?.map?.dispose();m?.dispose();}});}
function line(points,color=0x829ca5,opacity=.25){return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));}
function arrowGeometry(){
 const shaft=new THREE.CylinderGeometry(.035,.035,.78,8).translate(0,.39,0).toNonIndexed(),tip=new THREE.ConeGeometry(.105,.22,10).translate(0,.89,0).toNonIndexed(),g=new THREE.InstancedBufferGeometry();
 for(const name of['position','normal']){const a=shaft.attributes[name].array,b=tip.attributes[name].array,data=new Float32Array(a.length+b.length);data.set(a);data.set(b,a.length);g.setAttribute(name,new THREE.BufferAttribute(data,3));}
 shaft.dispose();tip.dispose();
 for(const name of['origin','fieldReal','fieldImag','rightReal','rightImag','interference'])g.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(4096*3),3).setUsage(THREE.DynamicDrawUsage));
 g.setAttribute('envelope',new THREE.InstancedBufferAttribute(new Float32Array(4096),1).setUsage(THREE.DynamicDrawUsage));
 g.setAttribute('carrier',new THREE.InstancedBufferAttribute(new Float32Array(4096),1).setUsage(THREE.DynamicDrawUsage));g.instanceCount=0;return g;
}
function makeArrows(color){const mesh=new THREE.Mesh(arrowGeometry(),new THREE.ShaderMaterial({vertexShader:arrowVertex,fragmentShader:arrowFragment,uniforms:{color:{value:shaderColor(color)},timePhase:{value:0},gain:{value:1.65},opacity:{value:.9},zMax:{value:56},incidentLength:{value:10},readable:{value:true},reveal:{value:1},slitPhase:{value:0}},transparent:true,depthWrite:false}));mesh.frustumCulled=false;mesh.layers.set(2);mesh.renderOrder=2;return mesh;}
function energyTexture(data,nx,ny,nz){const t=texture3D(data,nx,ny,nz);t.format=THREE.RGBAFormat;return t;}
function texture3D(data,nx=1,ny=1,nz=1){const t=new THREE.Data3DTexture(data,nx,ny,nz);t.format=THREE.RGBAFormat;t.type=THREE.HalfFloatType;t.minFilter=t.magFilter=THREE.LinearFilter;t.unpackAlignment=1;t.needsUpdate=true;return t;}

export class FieldScene{
 constructor(container,onDistance,onProbe){
  this.container=container;this.onDistance=onDistance;this.onProbe=onProbe;this.mode='both';this.z=29;this.half=17;this.zMax=56;this.options={...DEFAULT_APPEARANCE};
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x071119);this.camera=new THREE.PerspectiveCamera(36,1,.1,2000);
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setClearColor(0x071119,1);this.renderer.setPixelRatio(document.body.classList.contains('thumbnail-export')?.5:Math.min(devicePixelRatio||1,1.5));this.renderer.autoClear=false;this.gpuTimer=this.renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2');this.renderer.outputColorSpace=THREE.SRGBColorSpace;container.appendChild(this.renderer.domElement);
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.85;
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.09;this.controls.minDistance=5;this.controls.maxDistance=900;this.controls.screenSpacePanning=true;
  this.optic=new THREE.Group();this.track=new THREE.Group();this.topology=new THREE.Group();this.scene.add(this.optic,this.track,this.topology);
  this.illumination=new THREE.Group();this.scene.add(this.illumination);this.models=new THREE.Group();this.scene.add(this.models);const fill=new THREE.HemisphereLight(0xc8e9ff,0x172431,2.2);this.scene.add(fill);const key=new THREE.DirectionalLight(0xffead9,3.3);key.position.set(-30,45,35);this.scene.add(key);const rim=new THREE.DirectionalLight(0x71c8ff,2.2);rim.position.set(35,12,-32);this.scene.add(rim);this.lightRig={fill,key,rim};this.studioUniforms={studioTint:{value:new THREE.Color(1,1,1)},studioFill:{value:1},studioDirection:{value:new THREE.Vector3(-.4,.8,1).normalize()}};
  this.emptyTexture=texture3D(new Uint16Array(4));
  this.uniforms={energyMap:{value:this.emptyTexture},electricMap:{value:this.emptyTexture},magneticMap:{value:this.emptyTexture},extraMap:{value:this.emptyTexture},dimensions:{value:new THREE.Vector3(1,1,1)},halfWidth:{value:17},zMax:{value:56},incidentLength:{value:10},plateHalf:{value:10},timePhase:{value:0},opacity:{value:.65},threshold:{value:.035},exposure:{value:1.1},steps:{value:512},fieldMode:{value:0},displayMode:{value:0},phaseReference:{value:0},planeSampling:{value:0},positiveColor:{value:shaderColor(PALETTES.cyan[0])},negativeColor:{value:shaderColor(PALETTES.cyan[1])},lowColor:{value:shaderColor(PALETTES.cyan[4])},midColor:{value:shaderColor(PALETTES.cyan[5])},highColor:{value:shaderColor(PALETTES.cyan[6])},reveal:{value:1}};
  Object.assign(this.uniforms,{phaseHue:{value:0},rightElectric:{value:this.emptyTexture},rightMagnetic:{value:this.emptyTexture},rightExtra:{value:this.emptyTexture},rightDimensions:{value:new THREE.Vector3(1,1,1)},slitPhase:{value:0},interferenceEnabled:{value:false}});
  Object.assign(this.uniforms,{nodalCount:{value:0},nodalPoints:{value:Array.from({length:12},()=>new THREE.Vector2())}});
  Object.assign(this.uniforms,{focusWindow:{value:new THREE.Vector2(-1,-1)},interfaceZ:{value:0},volumeContrast:{value:1},fieldReference:{value:1}});
  this.volumeMaterial=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:volumeVertex,fragmentShader:volumeFragment,uniforms:this.uniforms,transparent:true,side:THREE.BackSide,depthWrite:false,depthTest:false});
  this.volumeMesh=new THREE.Mesh(new THREE.BoxGeometry(66,34,34).translate(23,0,0),this.volumeMaterial);this.volumeMesh.layers.set(1);this.volumeMesh.visible=false;this.volumeMesh.frustumCulled=false;this.volumeMesh.renderOrder=0;this.scene.add(this.volumeMesh);
  this.eArrows=makeArrows(PALETTES.cyan[2]);this.bArrows=makeArrows(PALETTES.cyan[3]);this.scene.add(this.eArrows,this.bArrows);
  this.detectorUniforms={...this.uniforms,detectorZ:{value:32},peak:{value:1},detectorOpacity:{value:.92},probe:{value:new THREE.Vector2(.5,.5)},showProbe:{value:false},isPreview:{value:false},previewAlpha:{value:1}};
  this.detectorUniforms.detectorZoom={value:1};
  Object.assign(this.uniforms,{detectorZ:this.detectorUniforms.detectorZ,peak:this.detectorUniforms.peak,detectorOpacity:this.detectorUniforms.detectorOpacity,probe:this.detectorUniforms.probe,showProbe:this.detectorUniforms.showProbe,showMask:{value:true},showDetector:{value:true},showGuide:{value:false},maskOpacity:{value:.44},maskMap:{value:new THREE.Texture()},viewportSize:{value:new THREE.Vector2()},viewportOrigin:{value:new THREE.Vector2()},inverseProjection:{value:this.camera.projectionMatrixInverse},inverseView:{value:this.camera.matrixWorld}});
  this.elementTarget=new THREE.WebGLRenderTarget(1,1,{depthTexture:new THREE.DepthTexture(1,1)});this.elementTarget.texture.generateMipmaps=false;
  this.depthTarget=new THREE.WebGLRenderTarget(1,1,{depthTexture:new THREE.DepthTexture(1,1)});this.depthTarget.texture.generateMipmaps=false;
  this.guideTarget=new THREE.WebGLRenderTarget(1,1,{depthTexture:new THREE.DepthTexture(1,1)});this.guideTarget.texture.generateMipmaps=false;
  Object.assign(this.uniforms,{elementDepth:{value:this.elementTarget.depthTexture},elementColor:{value:this.elementTarget.texture},clipObject:{value:false},objectFront:{value:new THREE.Texture()},fieldOrigin:{value:new THREE.Vector3()},fieldSign:{value:new THREE.Vector3(1,1,1)},travelMax:{value:56},sceneDepth:{value:this.depthTarget.depthTexture},guideDepth:{value:this.guideTarget.depthTexture},guideColor:{value:this.guideTarget.texture}});
  for(const arrows of[this.eArrows,this.bArrows])for(const key of['elementDepth','elementColor','guideDepth','guideColor','viewportSize','viewportOrigin','showMask','showGuide'])arrows.material.uniforms[key]=this.uniforms[key];
  this.detectorMaterial=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:detectorVertex,fragmentShader:detectorFragment,uniforms:this.detectorUniforms,side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:true});
  this.detector=new THREE.Group();this.screen=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.detectorMaterial);this.screen.rotation.y=Math.PI/2;this.screen.visible=false;this.screen.renderOrder=3;this.detector.add(this.screen);this.frame=new THREE.Group();this.frame.layers.set(2);this.detector.add(this.frame);this.scene.add(this.detector);
  this.previewScene=new THREE.Scene();this.previewCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);this.previewCamera.position.z=1;this.previewMaterial=this.detectorMaterial.clone();this.previewMaterial.uniforms={...this.detectorUniforms,isPreview:{value:true}};this.previewMaterial.transparent=true;this.previewScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.previewMaterial));
  this.transitionScene=new THREE.Scene();this.transitionMaterial=new THREE.ShaderMaterial({uniforms:{map:{value:null},alpha:{value:0}},vertexShader:'varying vec2 uv2;void main(){uv2=uv;gl_Position=vec4(position,1.);}',fragmentShader:'uniform sampler2D map;uniform float alpha;varying vec2 uv2;void main(){gl_FragColor=vec4(texture2D(map,uv2).rgb,alpha);}',transparent:true,depthTest:false,depthWrite:false});this.transitionScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.transitionMaterial));this.previewElement=document.getElementById('detector-image');
  this.probeMesh=new THREE.Mesh(new THREE.SphereGeometry(.1,12,8),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false}));this.probeMesh.visible=false;this.probeMesh.layers.set(2);this.probeMesh.renderOrder=6;this.scene.add(this.probeMesh);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resizeObserver.observe(this.previewElement);this.resizeObserver.observe(document.getElementById('scene-space'));this.bindInteraction();this.resize();
  this.renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();this.onError?.('The graphics context was interrupted. Reload to restore it.');});
 }
 lightOptic(){this.optic.traverse(o=>{if(o.material?.uniforms?.studioFill)Object.assign(o.material.uniforms,this.studioUniforms);});}
 applyTheme(theme,animate=false){
  const {fill,key,rim}=this.lightRig;
  this.themeTransition={start:animate?performance.now():-1000,theme,background:this.scene.background.clone(),sky:fill.color.clone(),ground:fill.groundColor.clone(),fill:fill.intensity,key:key.color.clone(),keyPower:key.intensity,keyPosition:key.position.clone(),rim:rim.color.clone(),rimPower:rim.intensity,rimPosition:rim.position.clone(),exposure:this.renderer.toneMappingExposure,tint:this.studioUniforms.studioTint.value.clone(),opticFill:this.studioUniforms.studioFill.value};
  this.themeTransition.target={background:new THREE.Color(theme.background),sky:new THREE.Color(theme.sky),ground:new THREE.Color(theme.ground),key:new THREE.Color(theme.key),rim:new THREE.Color(theme.rim),tint:shaderColor(theme.opticTint),keyPosition:new THREE.Vector3(...theme.keyPosition),rimPosition:new THREE.Vector3(...theme.rimPosition)};this.updateTheme(performance.now());
 }
 updateTheme(now){
  const t=this.themeTransition;if(!t)return;const p=Math.min(1,(now-t.start)/440),f=p*p*(3-2*p),a=t.theme,b=t.target,{fill,key,rim}=this.lightRig,mix=(x,y)=>x+(y-x)*f;
  this.scene.background.copy(t.background).lerp(b.background,f);fill.color.copy(t.sky).lerp(b.sky,f);fill.groundColor.copy(t.ground).lerp(b.ground,f);fill.intensity=mix(t.fill,a.fill);
  key.color.copy(t.key).lerp(b.key,f);key.intensity=mix(t.keyPower,a.keyPower);key.position.copy(t.keyPosition).lerp(b.keyPosition,f);rim.color.copy(t.rim).lerp(b.rim,f);rim.intensity=mix(t.rimPower,a.rimPower);rim.position.copy(t.rimPosition).lerp(b.rimPosition,f);
  this.renderer.toneMappingExposure=mix(t.exposure,a.exposure);this.studioUniforms.studioTint.value.copy(t.tint).lerp(b.tint,f);this.studioUniforms.studioFill.value=mix(t.opticFill,a.opticFill);this.studioUniforms.studioDirection.value.copy(key.position).normalize();if(p===1)this.themeTransition=null;
 }
 async prepareExperiment(e){
  if(this.experiment?.id===e.id)return null;
  const bundle={optic:makeOpticalElement(e),illumination:makeIllumination(e),models:new THREE.Group(),topology:new THREE.Group()};
  try{
   const ready=await Promise.allSettled([bundle.optic.userData.ready,bundle.optic.userData.maskMap?.userData.ready,
    e.object==='bunny'?makeBunnyModels(this.uniforms).then(root=>bundle.models=root):null,
    e.vortex?makeTopology(e.id,this.uniforms).then(root=>bundle.topology=root):null]);
   const failure=ready.find(item=>item.status==='rejected');if(failure)throw failure.reason;
   if(e.id==='metamorphosis')bundle.topology=makeImageGuides(this.uniforms);
   if(e.id==='saturn')bundle.topology.add(makeDesignCurves(this.uniforms));
   return bundle;
  }catch(error){this.discardPrepared(bundle);throw error;}
 }
 discardPrepared(bundle){if(bundle)for(const root of Object.values(bundle))dispose(root);}
 setExperiment(e,volume,gpu,prepared){

  const changed=this.experiment?.id!==e.id;if(changed){this.clearAuxiliary();this.setSlitPhase(0);}this.experiment=e;this.volume=volume;this.half=e.half;this.zMax=e.zMax;this.incidentLength=e.kind==='beams'?0:10;
  for(const name of['electricMap','magneticMap','extraMap','energyMap'])if(this.uniforms[name].value!==this.emptyTexture)this.uniforms[name].value.dispose();
  [this.uniforms.electricMap.value,this.uniforms.magneticMap.value,this.uniforms.extraMap.value,this.uniforms.energyMap.value]=gpu||[...volume.textures.map(t=>texture3D(t,volume.nx,volume.ny,volume.nz)),energyTexture(volume.energy,volume.nx,volume.ny,volume.nz)];
  this.uniforms.dimensions.value.set(volume.nx,volume.ny,volume.nz);this.uniforms.zMax.value=e.zMax;this.uniforms.travelMax.value=e.zMax;this.uniforms.halfWidth.value=e.half;this.uniforms.plateHalf.value=plateHalf(e);
  this.uniforms.interfaceZ.value=volume.interfaceZ||0;this.uniforms.fieldReference.value=volume.maxE;
  this.volumeMesh.geometry.dispose();this.volumeMesh.geometry=new THREE.BoxGeometry(e.zMax+this.incidentLength,2*e.half,2*e.half).translate((e.zMax-this.incidentLength)/2,0,0);this.volumeMesh.visible=true;
  this.screen.scale.set(e.half*2,e.half*2,1);this.updateFrame();this.prepareVectorSamples();
  if(changed){
   if(!prepared)throw Error('Optical setup was not prepared');
   this.setupVersion=(this.setupVersion||0)+1;this.revealStart=performance.now();
   for(const name of ['optic','illumination','models','topology']){dispose(this[name]);this.scene.remove(this[name]);this[name]=prepared[name];this.scene.add(this[name]);}
   this.surfaceReady=this.topologyReady=true;this.lightOptic();this.uniforms.maskMap.value=this.optic.userData.maskMap;this.uniforms.nodalCount.value=0;
   if(this.models.userData.target){this.models.userData.target.material.uniforms.cutZ.value=this.z;document.getElementById('app').dataset.modelVertices=String(this.models.userData.meta.vertices);}
   this.buildTrack();this.setDistance(e.z);this.setProbe(null);this.resetView(true);
  }else this.setDistance(this.z);
  if(this.models.userData.target)updateBunnySurface(this.models,volume);
  this.applyAppearance(this.options,true);
  const app=document.getElementById('app');app.dataset.volumeDimensions=`${volume.nx},${volume.ny},${volume.nz}`;app.dataset.quality=volume.quality;if(volume.quality==='full'&&new URLSearchParams(location.search).has('verify'))app.dataset.gpuValidation=JSON.stringify(verifyGpuVolume(this.renderer,volume,[this.uniforms.electricMap.value,this.uniforms.magneticMap.value,this.uniforms.extraMap.value,this.uniforms.energyMap.value]));
  document.getElementById('optic-name').textContent=e.opticLabel||(isProgrammable(e)?'Hologram display':e.kind==='beams'?'Coherent beam launchers':e.kind==='axicon'?'Axicon':e.kind==='phase'?'Phase relief + attenuation':'Aperture');this.updateReady();
 }
 applyAppearance(options,force=false){
  const old=this.options;this.options={...old,...options};const o=this.options,u=this.uniforms,p=PALETTES[o.palette]||PALETTES.cyan;
  u.planeSampling.value=o.planeSampling==='instantaneous'?1:0;u.phaseReference.value=o.phaseReference==='instantaneous'?1:0;u.phaseHue.value={cyan:0,amber:1.05,silver:2.1}[o.palette];u.opacity.value=o.opacity;u.threshold.value=o.threshold;u.exposure.value=o.exposure;u.displayMode.value={field:0,energy:1,phase:2}[o.display];u.incidentLength.value=o.incident?this.incidentLength||0:0;
  u.positiveColor.value.copy(shaderColor(p[0]));u.negativeColor.value.copy(shaderColor(p[1]));u.lowColor.value.copy(shaderColor(p[4]));u.midColor.value.copy(shaderColor(p[5]));u.highColor.value.copy(shaderColor(p[6]));
  for(const[mesh,color]of[[this.eArrows,p[2]],[this.bArrows,p[3]]]){mesh.material.uniforms.color.value.copy(shaderColor(color));mesh.material.uniforms.opacity.value=o.display==='field'?.9:.58;mesh.material.uniforms.gain.value=o.gain;mesh.material.uniforms.readable.value=o.vectorScale==='readable';mesh.material.uniforms.zMax.value=this.zMax;mesh.material.uniforms.incidentLength.value=u.incidentLength.value;}
  this.detectorUniforms.detectorOpacity.value=o.detectorOpacity;u.maskOpacity.value=o.maskOpacity;u.showMask.value=this.experiment?.kind!=='beams';for(const material of this.optic.userData.surfaces||[])material.uniforms.opacity.value=o.maskOpacity;if(this.optic.userData.glassMaterial)this.optic.userData.glassMaterial.uniforms.opacity.value=o.maskOpacity;u.showDetector.value=o.detector;u.showGuide.value=!!this.models.userData.target&&o.surfaceGuide;this.illumination.visible=o.incident;this.detector.visible=o.detector;this.track.visible=o.axes;
  if(this.models.userData.target){this.models.userData.target.visible=o.surfaceGuide;this.models.userData.target.material.uniforms.color.value.copy(shaderColor(p[2]));this.models.userData.recording.userData.wave.material.uniforms.opacity.value=o.opacity*.44;}
  this.topology.visible=this.experiment?.vortex?o.vortexLines:o.surfaceGuide;
  u.volumeContrast.value=o.volumeContrast;u.focusWindow.value.set(...(o.focusEmphasis&&this.experiment?.focusWindow||[-1,-1]));
  for(const id of ['optic-label','incident-label','source-label','target-label','sensor-label','processor-label','object-light-label','reference-light-label','vortex-label'])if(!o.labels)document.getElementById(id).hidden=true;
  if(force||old.density!==o.density){if(!force)this.prepareVectorSamples();this.updateArrows();}this.setMode(o.vectors);
  document.getElementById('app').dataset.display=o.display;document.getElementById('app').dataset.vectorGain=String(o.gain);
  if(this.volume&&(force||old.detectorExposure!==o.detectorExposure||old.vortexLines!==o.vortexLines||old.detector!==o.detector||old.surfaceGuide!==o.surfaceGuide))this.setDistance(this.z);
  this.detectorUniforms.detectorZoom.value=o.detectorZoom;
  if(force||old.detectorZoom!==o.detectorZoom)this.updateFrame();
 }
 clearAuxiliary(){this.auxiliary=null;this.uniforms.interferenceEnabled.value=false;for(const key of ['rightElectric','rightMagnetic','rightExtra']){if(this.uniforms[key].value!==this.emptyTexture)this.uniforms[key].value.dispose();this.uniforms[key].value=this.emptyTexture;}}
 setAuxiliary(volume,gpu){this.clearAuxiliary();this.auxiliary=volume;['rightElectric','rightMagnetic','rightExtra'].forEach((key,i)=>{this.uniforms[key].value=gpu?.[i]||texture3D(volume.textures[i],volume.nx,volume.ny,volume.nz);});this.uniforms.rightDimensions.value.set(volume.nx,volume.ny,volume.nz);this.uniforms.interferenceEnabled.value=true;this.prepareVectorSamples();this.updateArrows();}
 setSlitPhase(phase){this.uniforms.slitPhase.value=phase;this.eArrows.material.uniforms.slitPhase.value=this.bArrows.material.uniforms.slitPhase.value=phase;document.getElementById('app').dataset.slitPhase=String(phase);}
 setMode(mode){this.mode=mode;this.eArrows.visible=mode==='electric'||mode==='both';this.bArrows.visible=mode==='magnetic'||mode==='both';this.uniforms.fieldMode.value=0;}
 buildTrack(){
  dispose(this.track);this.track.clear();const y=-this.half-1.2,start=-this.incidentLength;
  for(let x=-this.half;x<=this.half;x+=5)this.track.add(line([[start,y,x],[this.zMax,y,x]],0x536e7b,.065));
  for(let z=start;z<=this.zMax;z+=5)this.track.add(line([[z,y,-this.half],[z,y,this.half]],0x536e7b,.065));
  this.track.add(line([[start,y,0],[this.zMax,y,0]],0x8ba5ad,.24));
 }
 updateFrame(){
  dispose(this.frame);this.frame.clear();const h=this.half;const rim=line([[0,-h,-h],[0,h,-h],[0,h,h],[0,-h,h],[0,-h,-h]],0x9ab8c3,.25);rim.layers.set(2);this.frame.add(rim);
  if(this.options.detectorZoom>1.01){const a=h/this.options.detectorZoom,l=a*.18;for(const sy of[-1,1])for(const sz of[-1,1]){const corner=line([[.03,sy*(a-l),sz*a],[.03,sy*a,sz*a],[.03,sy*a,sz*(a-l)]],0xc1e4e9,.48);corner.layers.set(2);this.frame.add(corner);}}
 }
 setDistance(z){
  this.z=Math.max(.5,Math.min(this.zMax,z));this.detector.position.x=this.z;this.detectorUniforms.detectorZ.value=this.z;if(this.models.userData.target)this.models.userData.target.material.uniforms.cutZ.value=this.z;
  if(this.volume)this.detectorUniforms.peak.value=detectorPeak(this.volume,this.z,this.options.detectorExposure);
  const nodes=this.options.vortexLines?planeIntersections(this.topology.userData.lines,this.z).slice(0,12):[];this.uniforms.nodalCount.value=nodes.length;nodes.forEach((p,i)=>this.uniforms.nodalPoints.value[i].set(p[0]/(2*this.half)+.5,p[1]/(2*this.half)+.5));
  updateIntersections(this.topology,nodes,this.z,this.options.detector);
  updateImageGuides(this.topology,this.z);
  if(this.probePoint)this.probeMesh.position.set(this.z+.08,this.probePoint.y,-this.probePoint.x);
 }
 setProbe(point){this.probePoint=point;this.probeMesh.visible=!!point;this.detectorUniforms.showProbe.value=!!point;if(point){this.detectorUniforms.probe.value.set(point.x/(2*this.half)+.5,point.y/(2*this.half)+.5);this.probeMesh.position.set(this.z+.08,point.y,-point.x);}}
 prepareVectorSamples(){if(this.volume)this.vectorSamples=sampleVectorVolume(this.volume,this.options.density,this.auxiliary);}
 updateArrows(){
  if(!this.vectorSamples)return;const samples=[...this.vectorSamples];
  if(this.incidentLength){const h=plateHalf(this.experiment)*.42;for(const z of[-7.7,-4.4,-1.2])for(let iy=-1;iy<=1;iy++)for(let ix=-1;ix<=1;ix++)samples.push({origin:[z,iy*h,-ix*h],er:[0,1,0],ei:[0,0,0],br:[0,0,1],bi:[0,0,0],z,envelope:1});}
  for(const[mesh,re,im]of[[this.eArrows,'er','ei'],[this.bArrows,'br','bi']]){
   for(let i=0;i<samples.length;i++){const s=samples[i];mesh.geometry.attributes.origin.array.set(s.origin,i*3);mesh.geometry.attributes.fieldReal.array.set(s[re],i*3);mesh.geometry.attributes.fieldImag.array.set(s[im],i*3);mesh.geometry.attributes.carrier.array[i]=s.z;mesh.geometry.attributes.envelope.array[i]=s.envelope;mesh.geometry.attributes.rightReal.array.set(s.right?s.right[re]:[0,0,0],i*3);mesh.geometry.attributes.rightImag.array.set(s.right?s.right[im]:[0,0,0],i*3);mesh.geometry.attributes.interference.array.set(s.interference||[0,0,0],i*3);}
   for(const a of Object.values(mesh.geometry.attributes))if(a.isInstancedBufferAttribute)a.needsUpdate=true;mesh.geometry.instanceCount=samples.length;
  }
  document.getElementById('app').dataset.vectorSamples=String(samples.length);
 }
 resize(){const width=this.container.clientWidth,height=this.container.clientHeight,r=document.getElementById('scene-space').getBoundingClientRect();if(!width||!height)return;const change=this.width!==width||this.height!==height||this.mainWidth!==r.width||this.mainHeight!==r.height;this.width=width;this.height=height;this.mainWidth=r.width;this.mainHeight=r.height;this.renderer.setSize(width,height);const ratio=this.renderer.getPixelRatio(),rw=Math.round(r.width*ratio),rh=Math.round(r.height*ratio);this.depthTarget.setSize(rw,rh);this.elementTarget.setSize(rw,rh);this.guideTarget.setSize(rw,rh);this.uniforms.viewportSize.value.set(rw,rh);this.uniforms.viewportOrigin.value.set(0,Math.round((height-r.height)*ratio));this.transitionTexture?.dispose();this.transitionTexture=new THREE.FramebufferTexture(rw,rh);this.transitionMaterial.uniforms.map.value=this.transitionTexture;this.camera.aspect=r.width/r.height;this.updatePreviewRect();this.camera.updateProjectionMatrix();if(change)this.resetView(true);}
 updatePreviewRect(){const r=this.previewElement.getBoundingClientRect();this.previewRect={x:r.left,y:this.height-r.bottom,width:r.width,height:r.height};}
 resetView(immediate=false,view='3d'){
  const bunny=this.experiment?.object==='bunny',start=bunny?-104:this.experiment?.kind==='beams'?-14:-28,target=new THREE.Vector3((this.zMax+start)*.5,0,0),direction=new THREE.Vector3(...({side:[0,.07,1],end:[1,.04,.001],field:[-.58,.43,1],'3d':[-.58,.43,1]}[view]||[-.58,.43,1])).normalize();
  const capture=document.body.classList.contains('thumbnail-export'),mobile=this.width<1100&&this.height>this.width,galleryBottom=document.getElementById('experiments').getBoundingClientRect().bottom,bottomReserve=mobile?this.previewRect.height+100:60,usableW=this.mainWidth-(capture?65:mobile?30:this.previewRect.width+72),usableH=capture?this.mainHeight-45:this.mainHeight-galleryBottom-bottomReserve-25;
  this.camera.setViewOffset(this.mainWidth,this.mainHeight,capture||mobile?0:(this.previewRect.width+40)/2,capture?0:(bottomReserve-galleryBottom)/2,this.mainWidth,this.mainHeight);this.camera.updateProjectionMatrix();
  if(capture)target.set(bunny?-70:-6,0,0);
  const right=new THREE.Vector3().crossVectors(this.camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right),tan=Math.tan(THREE.MathUtils.degToRad(18));let distance=30;
  const points=capture?[]:(this.vectorSamples||[]).map(s=>s.origin),h=this.experiment?plateHalf(this.experiment):this.half;
  if(bunny)for(const x of[-103,-40])for(const y of[-29,28])for(const z of[-19,25])points.push([x,y,z]);if(!capture||!bunny)for(const point of this.illumination.userData.fit||[])points.push(point);
  if(!capture||!bunny)for(const y of[-h,h+1.8])for(const z of[-h,h])for(const x of[start,0])points.push([x,y,z]);
  if(!capture)for(const y of[-this.half-1.5,this.half])for(const z of[-this.half,this.half])points.push([this.z,y,z]);
  if(view==='field'){target.set(this.experiment?.vortex?22:this.experiment?.id==='saturn'?40:this.z,0,0);points.length=0;const extent=this.experiment?.vortex?7:this.experiment?.id==='saturn'?15:Math.min(this.half,12);for(const x of[-extent,extent])for(const y of[-extent,extent])for(const z of[-extent,extent])points.push([target.x+x,y,z]);}
  if(!points.length)points.push([0,-this.half,-this.half],[this.zMax,this.half,this.half]);
  for(const point of points){const p=new THREE.Vector3(...point).sub(target);distance=Math.max(distance,Math.abs(p.dot(right))/(tan*this.camera.aspect*Math.max(.24,usableW/this.mainWidth))+p.dot(direction),Math.abs(p.dot(up))/(tan*Math.max(.24,usableH/this.mainHeight))+p.dot(direction));}
  const position=target.clone().addScaledVector(direction,distance*1.04);
  if(immediate||!this.camera.position.length()){this.controls.target.copy(target);this.camera.position.copy(position);this.controls.update();this.cameraTween=null;}
  else this.cameraTween={from:this.camera.position.clone(),to:position,fromTarget:this.controls.target.clone(),target,start:performance.now()};
 }
 bindInteraction(){
  const ray=new THREE.Raycaster();let down;
  this.renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};this.cameraTween=null;this.transitionStart=0;});
  this.renderer.domElement.addEventListener('pointerup',e=>{if(!down||e.clientX>this.mainWidth||e.clientY>this.mainHeight||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4||!this.volume||!this.options.detector)return;ray.setFromCamera(new THREE.Vector2(e.clientX/this.mainWidth*2-1,1-e.clientY/this.mainHeight*2),this.camera);const hit=ray.intersectObject(this.screen)[0];if(hit)this.onProbe(-hit.point.z,hit.point.y);});
  const handle=document.getElementById('detector-handle');
  handle.addEventListener('pointerdown',e=>{e.preventDefault();handle.setPointerCapture(e.pointerId);this.controls.enabled=false;this.cameraTween=null;const a=this.project([this.z,-this.half-1.2,0]),b=this.project([this.z+1,-this.half-1.2,0]);this.drag={x:e.clientX,y:e.clientY,z:this.z,dx:b.x-a.x,dy:b.y-a.y};});
  handle.addEventListener('pointermove',e=>{if(!this.drag)return;const d=this.drag,den=Math.max(.05,d.dx*d.dx+d.dy*d.dy),delta=((e.clientX-d.x)*d.dx+(e.clientY-d.y)*d.dy)/den;this.onDistance(Math.max(.5,Math.min(this.zMax,d.z+delta)));});
  const stop=()=>{this.drag=null;this.controls.enabled=true;};for(const name of['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(name,stop);
 }
 project(point){const p=new THREE.Vector3(...point).project(this.camera);return{x:(p.x*.5+.5)*this.mainWidth,y:(.5-p.y*.5)*this.mainHeight,visible:p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};}
 updateReady(){document.getElementById('app').dataset.ready=String(document.getElementById('app').dataset.experiment===this.experiment?.id&&!!this.volume&&this.surfaceReady&&this.topologyReady!==false&&(this.experiment?.object!=='bunny'||!!this.models.userData.target));}
 positionLabel(id,point,visible=true){const p=this.project(point),el=document.getElementById(id);if(!el)return;el.hidden=!visible||!p.visible;if(el.classList.contains('world-label')){if(!el.hidden)this.labelItems.push({el,p});}else el.style.transform=`translate(${p.x}px,${p.y}px)`;}
 async uploadVolume(volume,active=()=>true,onProgress=()=>{}){
  const count=volume.energy?4:3,textures=[],next=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  let deadline=performance.now()+5;
  for(let c=0;c<count;c++){if(!active()){textures.forEach(t=>t.dispose());return null;}const t=(c===3?energyTexture:texture3D)(null,volume.nx,volume.ny,volume.nz);t.source.dataReady=false;this.renderer.initTexture(t);textures.push(t);if(performance.now()>deadline){await next();deadline=performance.now()+5;}}
  const stride=volume.nx*volume.ny*4;
  for(let z=0;z<volume.nz;z+=8){if(!active()){textures.forEach(t=>t.dispose());return null;}const depth=Math.min(8,volume.nz-z);
   for(let c=0;c<count;c++){const data=c===3?volume.energy:volume.textures[c],part=(c===3?energyTexture:texture3D)(data.subarray(z*stride,(z+depth)*stride),volume.nx,volume.ny,depth);this.renderer.copyTextureToTexture(part,textures[c],null,new THREE.Vector3(0,0,z));part.dispose();}
   onProgress(Math.min(1,(z+depth)/volume.nz));if(performance.now()>deadline){await next();deadline=performance.now()+5;}
  }return textures;
 }
 captureTransition(duration=360){if(!this.volume)return Promise.resolve();this.transitionDuration=duration;return new Promise(resolve=>{(this.capturePending??=[]).push(resolve);});}
 render(phase,now){
  this.updateTheme(now);
  if(this.cameraTween){const t=this.cameraTween,f=Math.min(1,(now-t.start)/380),s=1-(1-f)**3;this.camera.position.lerpVectors(t.from,t.to,s);this.controls.target.lerpVectors(t.fromTarget,t.target,s);if(f===1)this.cameraTween=null;}
  this.uniforms.reveal.value=1;this.eArrows.material.uniforms.reveal.value=this.bArrows.material.uniforms.reveal.value=1;
  this.controls.update();this.camera.updateMatrixWorld();this.studioUniforms.studioDirection.value.copy(this.lightRig.key.position).transformDirection(this.camera.matrixWorldInverse);this.uniforms.timePhase.value=phase;this.eArrows.material.uniforms.timePhase.value=this.bArrows.material.uniforms.timePhase.value=phase;
  this.labelItems=[];this.positionLabel('detector-handle',[this.z,-this.half-1.2,0],this.options.detector);
  if(this.options.labels){if(this.experiment){const h=plateHalf(this.experiment);this.positionLabel('optic-label',[0,h+1.1,0]);this.positionLabel('incident-label',[-10,h*.94+2,0],this.options.incident&&this.experiment.kind!=='beams');}const bunny=this.experiment?.object==='bunny';this.positionLabel('source-label',[-75,-18,0],bunny);this.positionLabel('sensor-label',[-42,22,0],bunny);this.positionLabel('processor-label',[-41,-30,23],bunny);this.positionLabel('object-light-label',[-57,20,27],bunny);this.positionLabel('reference-light-label',[-64,27,-7],bunny);this.positionLabel('target-label',[32,23,0],this.experiment?.object==='bunny'&&this.options.surfaceGuide);}
  this.positionLabel('vortex-label',[this.experiment?.vortex?22:32,6.5,0],!!(this.options.labels&&this.experiment?.vortex&&this.options.vortexLines));
  const imageGuide=this.experiment?.id==='metamorphosis'?(this.topology.userData.imageGuides||[]).find(g=>Math.abs(g.z-this.z)<3):null;const designLabel=document.getElementById('design-label'),designText=imageGuide?imageGuide.name+' · guide':'Design curves';if(designLabel.textContent!==designText)designLabel.textContent=designText;this.positionLabel('design-label',[imageGuide?.z||40,10,0],!!(this.options.labels&&this.options.surfaceGuide&&(this.experiment?.id==='saturn'||imageGuide)));
  this.positionLabel('obstacle-label',[this.experiment?.interfaceZ||0,5,0],!!(this.options.labels&&this.experiment?.interfaceZ));
  layoutLabels(this.labelItems,this.width,this.height,this.previewRect);
  const renderer=this.renderer,gl=renderer.getContext(),timer=this.gpuTimer;if(timer&&this.gpuQuery&&gl.getQueryParameter(this.gpuQuery,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(timer.GPU_DISJOINT_EXT))document.getElementById('app').dataset.gpuMs=(gl.getQueryParameter(this.gpuQuery,gl.QUERY_RESULT)/1e6).toFixed(2);gl.deleteQuery(this.gpuQuery);this.gpuQuery=null;}const measure=timer&&!this.gpuQuery;if(measure){this.gpuQuery=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,this.gpuQuery);}const bg=this.scene.background;renderer.setScissorTest(false);this.scene.background=null;
  // Mesh depth prepass: the ray integral stops at the first solid surface.
  this.camera.layers.set(4);renderer.setRenderTarget(this.depthTarget);renderer.setClearColor(0,0);renderer.clear();renderer.render(this.scene,this.camera);
  this.camera.layers.set(5);renderer.setRenderTarget(this.elementTarget);renderer.clear();renderer.render(this.scene,this.camera);
  // The optional reconstruction guide has its own nearest-surface colour/depth.
  renderer.setRenderTarget(this.guideTarget);renderer.clear();if(this.uniforms.showGuide.value){this.camera.layers.set(3);renderer.render(this.scene,this.camera);}
  renderer.setRenderTarget(null);renderer.setClearColor(bg,1);renderer.setViewport(0,0,this.width,this.height);renderer.clear();renderer.setViewport(0,this.height-this.mainHeight,this.mainWidth,this.mainHeight);renderer.setScissor(0,this.height-this.mainHeight,this.mainWidth,this.mainHeight);renderer.setScissorTest(true);
  this.scene.background=bg;this.camera.layers.set(0);renderer.render(this.scene,this.camera);this.scene.background=null;this.camera.layers.set(1);renderer.render(this.scene,this.camera);this.camera.layers.set(2);renderer.render(this.scene,this.camera);this.scene.background=bg;this.camera.layers.set(0);
  const p=this.previewRect;if(p&&this.volume&&p.width>0&&p.height>0){renderer.clearDepth();renderer.setScissor(p.x,p.y,p.width,p.height);renderer.setViewport(p.x,p.y,p.width,p.height);renderer.render(this.previewScene,this.previewCamera);}
  renderer.setScissorTest(false);renderer.setViewport(0,0,this.width,this.height);
  if(this.transitionStart){const t=Math.min(1,(now-this.transitionStart)/(this.transitionDuration||360));this.transitionMaterial.uniforms.alpha.value=1-t*t*(3-2*t);renderer.render(this.transitionScene,this.previewCamera);if(t===1)this.transitionStart=0;}
  if(this.capturePending){renderer.copyFramebufferToTexture(this.transitionTexture,new THREE.Vector2(0,0));this.transitionStart=now;const done=this.capturePending;this.capturePending=null;for(const resolve of done)resolve();}
  if(measure)gl.endQuery(timer.TIME_ELAPSED_EXT);const transition=this.transitionStart?'active':'idle',app=document.getElementById('app');if(app.dataset.transition!==transition)app.dataset.transition=transition;
 }
}
