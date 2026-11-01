import {LiveFieldGpu} from './live-field-gpu.js';
import {LIVE_IDS,LIVE_DEFAULT,liveModel,demodulated} from './live-physics.js';
import * as THREE from 'three';
import {LENSLETS,SCATTER} from './wavefront-benches.js';
import {CONVEYOR} from './optical-conveyor.js';
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

import {StudioTable,loadStudioMap,coatingUniforms} from './studio-light.js';
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
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x10151b);this.camera=new THREE.PerspectiveCamera(36,1,.1,2000);
  this.catalogShade=document.querySelector('.top-shade');
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setClearColor(0x071119,1);this.renderer.setPixelRatio(document.body.classList.contains('thumbnail-export')?.5:Math.min(devicePixelRatio||1,1.5));this.renderer.autoClear=false;this.gpuTimer=this.renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2');this.renderer.outputColorSpace=THREE.SRGBColorSpace;container.appendChild(this.renderer.domElement);
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.85;
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.09;this.controls.minDistance=5;this.controls.maxDistance=900;this.controls.screenSpacePanning=true;
  this.optic=new THREE.Group();this.track=new THREE.Group();this.topology=new THREE.Group();this.scene.add(this.optic,this.track,this.topology);
  this.illumination=new THREE.Group();this.scene.add(this.illumination);this.models=new THREE.Group();this.scene.add(this.models);const fill=new THREE.HemisphereLight(0xc8e9ff,0x172431,2.2);this.scene.add(fill);const key=new THREE.DirectionalLight(0xffead9,3.3);key.position.set(-30,45,35);this.scene.add(key);const rim=new THREE.DirectionalLight(0x71c8ff,2.2);rim.position.set(35,12,-32);this.scene.add(rim);this.lightRig={fill,key,rim};this.studioUniforms={...coatingUniforms(),studioTint:{value:new THREE.Color(1,1,1)},studioFill:{value:1},studioDirection:{value:new THREE.Vector3(-.4,.8,1).normalize()}};
  this.emptyTexture=texture3D(new Uint16Array(4));
  this.uniforms={energyMap:{value:this.emptyTexture},electricMap:{value:this.emptyTexture},magneticMap:{value:this.emptyTexture},extraMap:{value:this.emptyTexture},dimensions:{value:new THREE.Vector3(1,1,1)},halfWidth:{value:17},zMax:{value:56},incidentLength:{value:10},plateHalf:{value:10},timePhase:{value:0},opacity:{value:.65},threshold:{value:.035},exposure:{value:1.1},steps:{value:512},fieldMode:{value:0},displayMode:{value:0},phaseReference:{value:0},planeSampling:{value:0},positiveColor:{value:shaderColor(PALETTES.cyan[0])},negativeColor:{value:shaderColor(PALETTES.cyan[1])},lowColor:{value:shaderColor(PALETTES.cyan[4])},midColor:{value:shaderColor(PALETTES.cyan[5])},highColor:{value:shaderColor(PALETTES.cyan[6])},reveal:{value:1}};
  Object.assign(this.uniforms,{daylightMix:{value:0},linearMix:{value:false},auxiliaryMix:{value:0},phaseHue:{value:0},rightElectric:{value:this.emptyTexture},rightMagnetic:{value:this.emptyTexture},rightExtra:{value:this.emptyTexture},rightDimensions:{value:new THREE.Vector3(1,1,1)},slitPhase:{value:0},interferenceEnabled:{value:false}});
  Object.assign(this.uniforms,{nodalCount:{value:0},nodalPoints:{value:Array.from({length:12},()=>new THREE.Vector2())}});
  Object.assign(this.uniforms,{viewHeight:{value:17},densityDetector:{value:false},nativeField:{value:false},fineSampling:{value:false},focusWindow:{value:new THREE.Vector2(-1,-1)},interfaceZ:{value:0},volumeContrast:{value:1},fieldReference:{value:1}});
  Object.assign(this.uniforms,{liveField:{value:false},liveElectric:{value:new THREE.Texture()},liveMagnetic:{value:new THREE.Texture()},liveExtra:{value:new THREE.Texture()},detectorExtent:{value:new THREE.Vector2(17,17)}});
  this.volumeMaterial=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:volumeVertex,fragmentShader:volumeFragment,uniforms:this.uniforms,transparent:true,side:THREE.BackSide,depthWrite:false,depthTest:false});
  this.volumeMesh=new THREE.Mesh(new THREE.BoxGeometry(66,34,34).translate(23,0,0),this.volumeMaterial);this.volumeMesh.layers.set(1);this.volumeMesh.visible=false;this.volumeMesh.frustumCulled=false;this.volumeMesh.renderOrder=0;this.scene.add(this.volumeMesh);
  this.eArrows=makeArrows(PALETTES.cyan[2]);this.bArrows=makeArrows(PALETTES.cyan[3]);this.scene.add(this.eArrows,this.bArrows);
  this.detectorUniforms={...this.uniforms,detectorZ:{value:32},peak:{value:1},detectorOpacity:{value:.92},probe:{value:new THREE.Vector2(.5,.5)},showProbe:{value:false},isPreview:{value:false},previewAlpha:{value:1}};
  this.detectorUniforms.detectorZoom={value:1};this.detectorUniforms.planPreview={value:false};this.detectorUniforms.previewAspect={value:1};this.detectorUniforms.planProbe={value:new THREE.Vector2(-1,-1)};
  Object.assign(this.uniforms,{detectorZ:this.detectorUniforms.detectorZ,peak:this.detectorUniforms.peak,detectorOpacity:this.detectorUniforms.detectorOpacity,probe:this.detectorUniforms.probe,showProbe:this.detectorUniforms.showProbe,showMask:{value:true},showDetector:{value:true},showGuide:{value:false},maskOpacity:{value:.44},maskMap:{value:new THREE.Texture()},viewportSize:{value:new THREE.Vector2()},viewportOrigin:{value:new THREE.Vector2()},inverseProjection:{value:this.camera.projectionMatrixInverse},inverseView:{value:this.camera.matrixWorld}});
  this.elementTarget=new THREE.WebGLRenderTarget(1,1,{depthTexture:new THREE.DepthTexture(1,1)});this.elementTarget.texture.generateMipmaps=false;
  this.depthTarget=new THREE.WebGLRenderTarget(1,1,{depthTexture:new THREE.DepthTexture(1,1)});this.depthTarget.texture.generateMipmaps=false;
  this.guideTarget=new THREE.WebGLRenderTarget(1,1,{depthTexture:new THREE.DepthTexture(1,1)});this.guideTarget.texture.generateMipmaps=false;
  Object.assign(this.uniforms,{elementDepth:{value:this.elementTarget.depthTexture},elementColor:{value:this.elementTarget.texture},clipObject:{value:false},objectFront:{value:new THREE.Texture()},fieldOrigin:{value:new THREE.Vector3()},fieldSign:{value:new THREE.Vector3(1,1,1)},travelMax:{value:56},sceneDepth:{value:this.depthTarget.depthTexture},guideDepth:{value:this.guideTarget.depthTexture},guideColor:{value:this.guideTarget.texture}});
  for(const arrows of[this.eArrows,this.bArrows])for(const key of['daylightMix','linearMix','auxiliaryMix','elementDepth','elementColor','guideDepth','guideColor','viewportSize','viewportOrigin','showMask','showGuide'])arrows.material.uniforms[key]=this.uniforms[key];
  this.detectorMaterial=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:detectorVertex,fragmentShader:detectorFragment,uniforms:this.detectorUniforms,side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:true});
  this.detector=new THREE.Group();this.screen=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.detectorMaterial);this.screen.rotation.y=Math.PI/2;this.screen.visible=false;this.screen.renderOrder=3;this.detector.add(this.screen);this.frame=new THREE.Group();this.frame.layers.set(2);this.detector.add(this.frame);this.scene.add(this.detector);
  this.previewScene=new THREE.Scene();this.previewCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);this.previewCamera.position.z=1;this.previewMaterial=this.detectorMaterial.clone();this.previewMaterial.uniforms={...this.detectorUniforms,isPreview:{value:true}};this.previewMaterial.transparent=true;this.previewScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.previewMaterial));
  this.transitionScene=new THREE.Scene();this.transitionMaterial=new THREE.ShaderMaterial({uniforms:{map:{value:null},alpha:{value:0}},vertexShader:'varying vec2 uv2;void main(){uv2=uv;gl_Position=vec4(position,1.);}',fragmentShader:'uniform sampler2D map;uniform float alpha;varying vec2 uv2;void main(){gl_FragColor=vec4(texture2D(map,uv2).rgb,alpha);}',transparent:true,depthTest:false,depthWrite:false});this.transitionScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.transitionMaterial));this.previewElement=document.getElementById('detector-image');
  this.probeMesh=new THREE.Mesh(new THREE.SphereGeometry(.1,12,8),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false}));this.probeMesh.visible=false;this.probeMesh.layers.set(2);this.probeMesh.renderOrder=6;this.scene.add(this.probeMesh);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resizeObserver.observe(this.previewElement);this.resizeObserver.observe(document.getElementById('scene-space'));this.bindInteraction();this.resize();
  this.renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();this.onError?.('The graphics context was interrupted. Reload to restore it.');});
 }
 lightOptic(){this.optic.traverse(o=>{if(o.material?.uniforms?.studioFill)Object.assign(o.material.uniforms,this.studioUniforms);});}
 async prepareStudio(){
  if(!this.studioLoad){
   this.studioLoad=loadStudioMap().then(map=>{this.studioUniforms.studioMap.value=map;}).catch(error=>{
    console.warn('Studio reflection map unavailable',error);
    this.studioLoad=null;
   });
  }
  await this.studioLoad;
  if(!this.studioTable){
   this.studioTable=new StudioTable();
   this.scene.add(this.studioTable.surface,this.studioTable.backdrop);
   const shadow=this.lightRig.key.shadow;
   shadow.mapSize.set(1024,1024);
   shadow.autoUpdate=false;
   shadow.bias=-.00015;
   this.renderer.shadowMap.type=THREE.PCFShadowMap;
  }
 }
 applyTheme(theme,animate=false){
  if(theme.studio){
   this.scene.environment=this.studioUniforms.studioMap.value;
   this.renderer.shadowMap.enabled=true;
   this.lightRig.key.castShadow=true;
  }
  const {fill,key,rim}=this.lightRig;
  const floor=this.studioTable?.surface.material.uniforms;
  this.themeTransition={start:animate?performance.now():-1000,theme,daylight:this.uniforms.daylightMix.value,studio:this.studioUniforms.studioMix.value,background:this.scene.background.clone(),sky:fill.color.clone(),ground:fill.groundColor.clone(),fill:fill.intensity,key:key.color.clone(),keyPower:key.intensity,keyPosition:key.position.clone(),rim:rim.color.clone(),rimPower:rim.intensity,rimPosition:rim.position.clone(),exposure:this.renderer.toneMappingExposure,tint:this.studioUniforms.studioTint.value.clone(),opticFill:this.studioUniforms.studioFill.value};
  this.themeTransition.target={background:new THREE.Color(theme.background),sky:new THREE.Color(theme.sky),ground:new THREE.Color(theme.ground),key:new THREE.Color(theme.key),rim:new THREE.Color(theme.rim),tint:shaderColor(theme.opticTint),keyPosition:new THREE.Vector3(...theme.keyPosition),rimPosition:new THREE.Vector3(...theme.rimPosition)};
  if(theme.floor && floor){
   this.themeTransition.floor={
    shade:floor.floorShade.value.clone(),lit:floor.floorLight.value.clone(),contact:floor.contactStrength.value,
    targetShade:shaderColor(theme.floor[0]),targetLit:shaderColor(theme.floor[1])
   };
  }
  this.themeTransition.reflections=this.scene.environmentIntensity;
  if(this.studioTable){
   const uniforms=this.studioTable.backdrop.material.uniforms;
   this.themeTransition.sweep={amount:uniforms.amount.value,lit:uniforms.lit.value.clone(),target:shaderColor(theme.backlight??theme.background)};
  }
  this.updateTheme(performance.now());
 }
 updateTheme(now){
  const t=this.themeTransition;if(!t)return;const p=Math.min(1,(now-t.start)/440),f=p*p*(3-2*p),a=t.theme,b=t.target,{fill,key,rim}=this.lightRig,mix=(x,y)=>x+(y-x)*f;
  this.scene.background.copy(t.background).lerp(b.background,f);fill.color.copy(t.sky).lerp(b.sky,f);fill.groundColor.copy(t.ground).lerp(b.ground,f);fill.intensity=mix(t.fill,a.fill);
  if(p<1) this.catalogShade.style.setProperty('--scene-bg','#'+this.scene.background.getHexString());
  else this.catalogShade.style.removeProperty('--scene-bg');
  key.color.copy(t.key).lerp(b.key,f);key.intensity=mix(t.keyPower,a.keyPower);key.position.copy(t.keyPosition).lerp(b.keyPosition,f);rim.color.copy(t.rim).lerp(b.rim,f);rim.intensity=mix(t.rimPower,a.rimPower);rim.position.copy(t.rimPosition).lerp(b.rimPosition,f);
  if(t.floor){
   const floor=this.studioTable.surface.material.uniforms;
   floor.floorShade.value.copy(t.floor.shade).lerp(t.floor.targetShade,f);
   floor.floorLight.value.copy(t.floor.lit).lerp(t.floor.targetLit,f);
   floor.contactStrength.value=mix(t.floor.contact,a.contact??.82);
  }
  if(t.sweep){
   const backdrop=this.studioTable.backdrop,u=backdrop.material.uniforms;
   u.amount.value=mix(t.sweep.amount,a.backlight ? 1 : 0);
   u.base.value.copy(this.scene.background).convertLinearToSRGB();
   u.lit.value.copy(t.sweep.lit).lerp(t.sweep.target,f);
   backdrop.visible=u.amount.value>.001;
  }
  this.uniforms.daylightMix.value=mix(t.daylight,a.light ? 1 : 0);
  const studio=mix(t.studio,a.studio);
  this.studioUniforms.studioMix.value=studio;
  this.scene.environmentIntensity=mix(t.reflections,a.studio*(a.reflections??4.2));
  key.shadow.intensity=studio*.85;
  if(key.castShadow) key.shadow.needsUpdate=true;
  if(p===1 && !a.studio){
   this.scene.environment=null;
   this.renderer.shadowMap.enabled=false;
   key.castShadow=false;
  }
  this.renderer.toneMappingExposure=mix(t.exposure,a.exposure);this.studioUniforms.studioTint.value.copy(t.tint).lerp(b.tint,f);this.studioUniforms.studioFill.value=mix(t.opticFill,a.opticFill);this.studioUniforms.studioDirection.value.copy(key.position).normalize();if(p===1)this.themeTransition=null;
 }
 async prepareExperiment(e,signal){
  if(this.experiment?.id===e.id)return null;
  const bundle={optic:makeOpticalElement(e,signal),illumination:makeIllumination(e),models:new THREE.Group(),topology:new THREE.Group()};
  try{
   const ready=await Promise.allSettled([bundle.optic.userData.ready,bundle.optic.userData.maskMap?.userData.ready,
    e.object==='bunny'?makeBunnyModels(this.uniforms,signal).then(root=>bundle.models=root):null,
    e.vortex?makeTopology(e.id,this.uniforms).then(root=>bundle.topology=root):null]);
   const failure=ready.find(item=>item.status==='rejected');if(failure)throw failure.reason;
   if(e.id==='metamorphosis')bundle.topology=makeImageGuides(this.uniforms);
   if(e.id==='saturn')bundle.topology.add(makeDesignCurves(this.uniforms));
   signal?.throwIfAborted();
   const staging=new THREE.Scene(),camera=this.camera.clone();camera.layers.set(0);
   staging.add(...Object.values(bundle));
   await this.renderer.compileAsync(staging,camera,this.scene);
   camera.layers.set(2);await this.renderer.compileAsync(staging,camera,this.scene);
   // Offscreen prepasses use linear output and no tone mapping. Preparing only
   // the canvas variants still triggers shader compilation on the first frame.
   const previousTarget=this.renderer.getRenderTarget();
   for(const [layer,target]of[[4,this.depthTarget],[5,this.elementTarget],[3,this.guideTarget]]){
    camera.layers.set(layer);this.renderer.setRenderTarget(target);
    const prepass=this.renderer.compileAsync(staging,camera,this.scene);
    this.renderer.setRenderTarget(previousTarget);await prepass;
   }
   this.shaderPreparation??=(async()=>{const sharedCamera=this.camera.clone();sharedCamera.layers.set(0);await this.renderer.compileAsync(this.scene,sharedCamera);sharedCamera.layers.set(2);await this.renderer.compileAsync(this.scene,sharedCamera);await this.renderer.compileAsync(this.previewScene,this.previewCamera);await this.renderer.compileAsync(this.transitionScene,this.previewCamera);})();
   await this.shaderPreparation;
   const maps=new Set();staging.traverse(object=>{for(const material of(Array.isArray(object.material)?object.material:[object.material])){if(material?.map)maps.add(material.map);for(const uniform of Object.values(material?.uniforms||{}))if(uniform.value?.isTexture&&uniform.value.image)maps.add(uniform.value);}});
   for(const map of maps){signal?.throwIfAborted();this.renderer.initTexture(map);await new Promise(resolve=>setTimeout(resolve,0));}
   // Three defers uniform/attribute reflection until first use. Warm those
   // linked-program tables cooperatively, rather than all inside one frame.
   if(LIVE_IDS.includes(e.id)){
    const family=['sound-cell','light-billiard'].includes(e.id)?e.id:'standard';this.liveWarmers??=new Map();
    if(!this.liveWarmers.has(family)){
     const warmer=new LiveFieldGpu(e,{nx:2,nz:2}),before=this.renderer.getRenderTarget(),jobs=[];
     this.renderer.setRenderTarget(warmer.target);jobs.push(this.renderer.compileAsync(warmer.scene,warmer.camera));
     if(warmer.basis){this.renderer.setRenderTarget(warmer.basis.target);jobs.push(this.renderer.compileAsync(warmer.basis.scene,warmer.camera));}
     this.renderer.setRenderTarget(before);this.liveWarmers.set(family,Promise.all(jobs).then(()=>warmer));
    }
    await this.liveWarmers.get(family);
   }
   this.preparedPrograms??=new WeakSet();
   for(const program of this.renderer.info.programs){
    if(this.preparedPrograms.has(program))continue;
    while(!program.isReady()){signal?.throwIfAborted();await new Promise(resolve=>setTimeout(resolve,8));}
    signal?.throwIfAborted();program.getUniforms();program.getAttributes();this.preparedPrograms.add(program);
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   signal?.throwIfAborted();
   return bundle;
  }catch(error){this.discardPrepared(bundle);throw error;}
 }
 discardPrepared(bundle){if(bundle)for(const root of Object.values(bundle))dispose(root);}
 setExperiment(e,volume,gpu,prepared){

  const changed=this.experiment?.id!==e.id;if(changed){this.pendingAppearance=null;this.pendingComparison=undefined;this.clearAuxiliary();this.setSlitPhase(0);this.presentationStart=0;const app=document.getElementById('app');app.dataset.ready='false';app.dataset.presented='false';for(const el of document.querySelectorAll('.world-label,#detector-handle')){el.hidden=true;delete el.dataset.positioned;}}this.experiment=e;this.volume=volume;
  if(changed){this.live?.dispose();this.live=null;}if(LIVE_IDS.includes(e.id)&&!this.live){this.live=new LiveFieldGpu(e,volume);this.liveParameter=LIVE_DEFAULT[e.id];}this.uniforms.liveField.value=!!this.live;this.detectorUniforms.planPreview.value=!!e.planPreview;this.detectorUniforms.previewAspect.value=e.id==='sound-cell'?2.8:1;
  if(this.live){['liveElectric','liveMagnetic','liveExtra'].forEach((key,i)=>this.uniforms[key].value=this.live.target.textures[i]);this.setExperimentParameter(this.liveParameter);}
 this.half=e.half;this.zMax=e.zMax;this.incidentLength=e.analytic||e.kind==='beams'?0:10;this.viewHeight=e.viewHeight||e.half;this.uniforms.viewHeight.value=this.viewHeight;this.uniforms.densityDetector.value=!!e.energyDensity;this.uniforms.nativeField.value=!!e.analytic;this.uniforms.fineSampling.value=!!e.analytic&&(!e.spectralBench||e.id==='fabry-perot');
  for(const name of['electricMap','magneticMap','extraMap','energyMap'])if(this.uniforms[name].value!==this.emptyTexture)this.uniforms[name].value.dispose();
  [this.uniforms.electricMap.value,this.uniforms.magneticMap.value,this.uniforms.extraMap.value,this.uniforms.energyMap.value]=gpu||[...volume.textures.map(t=>texture3D(t,volume.nx,volume.ny,volume.nz)),energyTexture(volume.energy,volume.nx,volume.ny,volume.nz)];
  this.uniforms.dimensions.value.set(volume.nx,volume.ny,volume.nz);this.uniforms.zMax.value=e.zMax;this.uniforms.travelMax.value=e.zMax;this.uniforms.halfWidth.value=e.half;this.uniforms.plateHalf.value=plateHalf(e);
  this.uniforms.interfaceZ.value=volume.interfaceZ||0;this.uniforms.fieldReference.value=volume.maxE;
  this.volumeMesh.geometry.dispose();this.volumeMesh.geometry=new THREE.BoxGeometry(e.zMax+this.incidentLength,2*e.half,2*e.half).translate((e.zMax-this.incidentLength)/2,0,0);this.volumeMesh.visible=true;
  this.uniforms.detectorExtent.value.set(e.detectorHalf||e.half,this.viewHeight);this.screen.scale.set((e.detectorHalf||e.half)*2,this.viewHeight*2,1);this.updateFrame();this.prepareVectorSamples();
  if(changed){
   if(!prepared)throw Error('Optical setup was not prepared');
   this.setupVersion=(this.setupVersion||0)+1;this.revealStart=performance.now();
   for(const name of ['optic','illumination','models','topology']){dispose(this[name]);this.scene.remove(this[name]);this[name]=prepared[name];this.scene.add(this[name]);}
   for(const el of document.querySelectorAll('[data-bench-label]'))el.remove();
   (this.optic.userData.labels||[]).forEach((label,i)=>{const el=document.createElement('div');el.id='bench-label-'+i;el.className='world-label component-label';el.dataset.benchLabel='true';el.textContent=label.text;el.hidden=true;document.getElementById('app').append(el);});
   this.surfaceReady=this.topologyReady=true;this.lightOptic();this.uniforms.maskMap.value=this.optic.userData.maskMap;this.uniforms.nodalCount.value=0;
   if(e.cameraSensor){
    // This camera stays lit by its own calculated plane while the user
    // inspects the vortex or the rejected annulus farther upstream.
    const {z,half}=e.cameraSensor,m=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:detectorVertex,fragmentShader:detectorFragment,side:THREE.DoubleSide});
    m.uniforms={...this.detectorUniforms,detectorZ:{value:z},peak:{value:e.detectorReference},showProbe:{value:false},isPreview:{value:true},previewAlpha:{value:1},detectorZoom:{value:e.half/half},previewAspect:{value:1},planPreview:{value:false}};
    m.transparent=false;m.depthWrite=true;const sensor=new THREE.Mesh(new THREE.PlaneGeometry(half*2,half*2),m);
    sensor.rotation.y=Math.PI/2;sensor.position.x=z;sensor.layers.enable(4);this.optic.add(sensor);
   }
   if(this.models.userData.target){this.models.userData.target.material.uniforms.cutZ.value=this.z;document.getElementById('app').dataset.modelVertices=String(this.models.userData.meta.vertices);}
   this.optic.userData.setParameter?.(this.liveParameter);this.buildTrack();this.setDistance(e.z);this.setProbe(null);this.resetView(true);
  }else this.setDistance(this.z);
  if(this.models.userData.target)updateBunnySurface(this.models,volume);
  this.applyAppearance(this.options,true);
  const app=document.getElementById('app');app.dataset.volumeDimensions=`${volume.nx},${volume.ny},${volume.nz}`;app.dataset.quality=volume.quality;if(volume.quality==='full'&&new URLSearchParams(location.search).has('verify'))app.dataset.gpuValidation=JSON.stringify(verifyGpuVolume(this.renderer,{...volume,liveSampler:null},[this.uniforms.electricMap.value,this.uniforms.magneticMap.value,this.uniforms.extraMap.value,this.uniforms.energyMap.value]));
  document.getElementById('optic-name').textContent=e.opticLabel||(isProgrammable(e)?'Hologram display':e.kind==='beams'?'Coherent beam launchers':e.kind==='axicon'?'Axicon':e.kind==='phase'?'Phase relief + attenuation':'Aperture');
 }
 applyAppearance(options,force=false){
  // A refinement can land between a click and the next rendered frame.
  // Preserve the latest queued view rather than reinstating the old view.
  if(force&&this.pendingAppearance)options={...options,...this.pendingAppearance};
  this.pendingAppearance=null;
  const old=this.options;this.options={...old,...options};const o=this.options,u=this.uniforms,p=PALETTES[o.palette]||PALETTES.cyan;
  u.planeSampling.value=o.planeSampling==='instantaneous'?1:0;u.phaseReference.value=o.phaseReference==='instantaneous'?1:0;u.phaseHue.value={cyan:0,amber:1.05,silver:2.1}[o.palette];u.opacity.value=o.opacity;u.threshold.value=o.threshold;u.exposure.value=o.exposure;u.displayMode.value={field:0,energy:1,phase:2}[o.display];u.incidentLength.value=o.incident?this.incidentLength||0:0;
  u.positiveColor.value.copy(shaderColor(p[0]));u.negativeColor.value.copy(shaderColor(p[1]));u.lowColor.value.copy(shaderColor(p[4]));u.midColor.value.copy(shaderColor(p[5]));u.highColor.value.copy(shaderColor(p[6]));
  for(const[mesh,color]of[[this.eArrows,p[2]],[this.bArrows,p[3]]]){mesh.material.uniforms.color.value.copy(shaderColor(color));mesh.material.uniforms.opacity.value=o.display==='field'?.9:.58;mesh.material.uniforms.gain.value=o.gain;mesh.material.uniforms.readable.value=o.vectorScale==='readable';mesh.material.uniforms.zMax.value=this.zMax;mesh.material.uniforms.incidentLength.value=u.incidentLength.value;}
  this.detectorUniforms.detectorOpacity.value=o.detectorOpacity;u.maskOpacity.value=o.maskOpacity;u.showMask.value=this.experiment?.kind!=='beams';for(const material of this.optic.userData.surfaces||[])material.uniforms.opacity.value=o.maskOpacity;if(this.optic.userData.glassMaterial)this.optic.userData.glassMaterial.uniforms.opacity.value=o.maskOpacity;u.showDetector.value=o.detector&&(!this.experiment?.cameraSensor||Math.abs(this.z-this.experiment.cameraSensor.z)>.02);u.showGuide.value=!!this.models.userData.target&&o.surfaceGuide;this.illumination.visible=o.incident;this.detector.visible=u.showDetector.value;this.track.visible=o.axes;
  if(this.models.userData.target){this.models.userData.target.visible=o.surfaceGuide;this.models.userData.target.material.uniforms.color.value.copy(shaderColor(p[2]));this.models.userData.recording.userData.wave.material.uniforms.opacity.value=o.opacity*.44;}
  this.topology.visible=this.experiment?.vortex?o.vortexLines:o.surfaceGuide;
  u.volumeContrast.value=o.volumeContrast;u.focusWindow.value.set(...(o.focusEmphasis&&this.experiment?.focusWindow||[-1,-1]));
  for(const id of ['optic-label','incident-label','source-label','target-label','sensor-label','processor-label','object-light-label','reference-light-label','vortex-label'])if(!o.labels)document.getElementById(id).hidden=true;
  if(force||old.density!==o.density){if(!force)this.prepareVectorSamples();this.updateArrows();}this.setMode(o.vectors);
  document.getElementById('app').dataset.display=o.display;document.getElementById('app').dataset.vectorGain=String(o.gain);
  if(this.volume&&(force||old.detectorExposure!==o.detectorExposure||old.vortexLines!==o.vortexLines||old.detector!==o.detector||old.surfaceGuide!==o.surfaceGuide))this.setDistance(this.z);
  this.detectorUniforms.detectorZoom.value=o.detectorZoom;this.updateCameraMarks();
  if(force||old.detectorZoom!==o.detectorZoom)this.updateFrame();
 }
 clearAuxiliary(){this.uniforms.linearMix.value=false;this.uniforms.auxiliaryMix.value=0;this.auxiliary=null;this.uniforms.interferenceEnabled.value=false;for(const key of ['rightElectric','rightMagnetic','rightExtra']){if(this.uniforms[key].value!==this.emptyTexture)this.uniforms[key].value.dispose();this.uniforms[key].value=this.emptyTexture;}}
 setAuxiliary(volume,gpu){this.clearAuxiliary();this.auxiliary=volume;['rightElectric','rightMagnetic','rightExtra'].forEach((key,i)=>{this.uniforms[key].value=gpu?.[i]||texture3D(volume.textures[i],volume.nx,volume.ny,volume.nz);});this.uniforms.rightDimensions.value.set(volume.nx,volume.ny,volume.nz);this.uniforms.interferenceEnabled.value=true;this.prepareVectorSamples();this.updateArrows();}
 setComparison(value){this.uniforms.linearMix.value=true;this.uniforms.auxiliaryMix.value=value;this.optic.userData.setComparison?.(value,this.auxiliary?.commands);if(this.optic.userData.phaseDot)this.optic.userData.phaseDot.visible=value<.5;document.getElementById('app').dataset.comparison=String(value);this.updateCameraMarks();}
 setSlitPhase(phase){this.uniforms.slitPhase.value=phase;this.eArrows.material.uniforms.slitPhase.value=this.bArrows.material.uniforms.slitPhase.value=phase;document.getElementById('app').dataset.slitPhase=String(phase);}
 setMode(mode){if(this.live&&this.mode!==mode)this.liveVectorsDirty=true;this.mode=mode;this.eArrows.visible=mode==='electric'||mode==='both';this.bArrows.visible=mode==='magnetic'||mode==='both';this.uniforms.fieldMode.value=0;}
 buildTrack(){
  dispose(this.track);this.track.clear();const y=0,start=-this.incidentLength;
  this.track.position.y=-this.viewHeight-1.2;
  for(let x=-this.half;x<=this.half;x+=5)this.track.add(line([[start,y,x],[this.zMax,y,x]],0x536e7b,.065));
  for(let z=start;z<=this.zMax;z+=5)this.track.add(line([[z,y,-this.half],[z,y,this.half]],0x536e7b,.065));
  this.track.add(line([[start,y,0],[this.zMax,y,0]],0x8ba5ad,.24));
 }
 updateFrame(){
  dispose(this.frame);this.frame.clear();const h=this.experiment?.detectorHalf||this.half,v=this.viewHeight||h;const rim=line([[0,-v,-h],[0,v,-h],[0,v,h],[0,-v,h],[0,-v,-h]],0x9ab8c3,.25);rim.layers.set(2);this.frame.add(rim);
  if(this.options.detectorZoom>1.01){const a=h/this.options.detectorZoom,b=v/this.options.detectorZoom,l=Math.min(a,b)*.18;for(const sy of[-1,1])for(const sz of[-1,1]){const corner=line([[.03,sy*(b-l),sz*a],[.03,sy*b,sz*a],[.03,sy*b,sz*(a-l)]],0xc1e4e9,.48);corner.layers.set(2);this.frame.add(corner);}}
 }
 setDistance(z){
  this.z=Math.max(.5,Math.min(this.zMax,z));this.detector.position.x=this.z;this.detectorUniforms.detectorZ.value=this.z;if(this.models.userData.target)this.models.userData.target.material.uniforms.cutZ.value=this.z;
  this.updateCameraMarks();
  if(this.experiment?.cameraSensor)this.uniforms.showDetector.value=this.detector.visible=this.options.detector&&Math.abs(this.z-this.experiment.cameraSensor.z)>.02;
  if(this.volume)this.detectorUniforms.peak.value=this.options.detectorExposure==='fixed'&&this.experiment.detectorReference?this.experiment.detectorReference:detectorPeak(this.volume,this.z,this.options.detectorExposure);
  const nodes=this.options.vortexLines?planeIntersections(this.topology.userData.lines,this.z).slice(0,12):[];this.uniforms.nodalCount.value=nodes.length;nodes.forEach((p,i)=>this.uniforms.nodalPoints.value[i].set(p[0]/(2*this.half)+.5,p[1]/(2*this.half)+.5));
  updateIntersections(this.topology,nodes,this.z,this.options.detector);
  updateImageGuides(this.topology,this.z);
  if(this.probePoint)this.probeMesh.position.set((this.probePoint.z??this.z)+.005,this.probePoint.y,-this.probePoint.x);
 }
 setProbe(point){this.probePoint=point;this.probeMesh.visible=!!point;this.detectorUniforms.showProbe.value=!!point;if(point){this.detectorUniforms.probe.value.set(point.x/(2*this.half)+.5,point.y/(2*this.half)+.5);this.probeMesh.position.set((point.z??this.z)+.005,point.y,-point.x);this.detectorUniforms.planProbe.value.set(point.x/(2*this.half)+.5,((point.z??this.z)-this.zMax/2)/(2*this.half)+.5);}}
 setExperimentParameter(value){
  if(this.experiment?.interaction?.phaseArm){
   this.setSlitPhase(value);this.optic.userData.setParameter(value);this.updateCameraMarks();
   document.getElementById('app').dataset.parameter=String(value);return;
  }
  if(!this.live)return;this.liveParameter=value;this.liveModel=liveModel(this.experiment.id,value);const model=this.liveModel;this.volume.liveSampler=(x,y,z,out)=>demodulated(model,x,z,out);this.liveVectorsDirty=true;
  if(this.experiment.id==='grin')this.volume.vectorBounds=Array.from({length:32},(_,i)=>({z:.4+i/31*(this.experiment.zMax-1),xmin:-3.8,xmax:3.8,ymin:-.9,ymax:.9,peak:1}));
  document.getElementById('app').dataset.parameter=String(value);
 }
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
  const bunny=this.experiment?.object==='bunny',start=this.experiment?.analytic?0:bunny?-104:this.experiment?.kind==='beams'?-14:-28,target=new THREE.Vector3((this.zMax+start)*.5,0,0),direction=new THREE.Vector3(...({side:[0,.07,1],end:[1,.04,.001],field:[-.58,.43,1],'3d':this.experiment?.viewDirection||[-.58,.43,1]}[view]||[-.58,.43,1])).normalize();
  const capture=document.body.classList.contains('thumbnail-export'),mobile=this.width<1100&&this.height>this.width,galleryBottom=document.getElementById('experiments').getBoundingClientRect().bottom,bottomReserve=mobile?this.previewRect.height+100:60,usableW=this.mainWidth-(capture?65:mobile?30:this.previewRect.width+72),usableH=capture?this.mainHeight-45:this.mainHeight-galleryBottom-bottomReserve-25;
  // Give the floating preview some room while keeping the apparatus near the viewport centre.
  const horizontalOffset=capture||mobile?0:(this.previewRect.width+40)*.22;
  const verticalOffset=capture?0:(bottomReserve-galleryBottom)*(mobile ? .5 : .32);
  this.camera.setViewOffset(this.mainWidth,this.mainHeight,horizontalOffset,verticalOffset,this.mainWidth,this.mainHeight);this.camera.updateProjectionMatrix();
  if(capture)target.set(bunny?-70:-6,0,0);
  const right=new THREE.Vector3().crossVectors(this.camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right),tan=Math.tan(THREE.MathUtils.degToRad(18));let distance=this.experiment?.analytic?5:30;
  const points=capture||this.experiment?.fitApparatus?[]:(this.vectorSamples||[]).map(s=>s.origin),h=this.experiment?plateHalf(this.experiment):this.half;
  if(!capture)points.push(...(this.optic.userData.fit||[]));
  if(bunny)for(const x of[-103,-40])for(const y of[-29,28])for(const z of[-19,25])points.push([x,y,z]);if(!capture||!bunny)for(const point of this.illumination.userData.fit||[])points.push(point);
  if((!capture||!bunny)&&!this.experiment?.analytic)for(const y of[-h,h+1.8])for(const z of[-h,h])for(const x of[start,0])points.push([x,y,z]);
  if(this.experiment?.analytic&&!this.experiment.fitApparatus)for(const x of[0,this.zMax])for(const y of[-this.viewHeight-.4,this.viewHeight+.4])for(const z of[-this.half,this.half])points.push([x,y,z]);
  if(!capture)for(const y of[-this.viewHeight-1.5,this.viewHeight])for(const z of[-(this.experiment?.detectorHalf||this.half),this.experiment?.detectorHalf||this.half])points.push([this.z,y,z]);
  if(view==='field'){target.set(this.experiment?.vortex?22:this.experiment?.id==='saturn'?40:this.z,0,0);points.length=0;const extent=this.experiment?.vortex?7:this.experiment?.id==='saturn'?15:Math.min(this.half,12);for(const x of[-extent,extent])for(const y of[-extent,extent])for(const z of[-extent,extent])points.push([target.x+x,y,z]);}
  if(!points.length)points.push([0,-this.half,-this.half],[this.zMax,this.half,this.half]);
  for(const point of points){const p=new THREE.Vector3(...point).sub(target);distance=Math.max(distance,Math.abs(p.dot(right))/(tan*this.camera.aspect*Math.max(.24,usableW/this.mainWidth))+p.dot(direction),Math.abs(p.dot(up))/(tan*Math.max(.24,usableH/this.mainHeight))+p.dot(direction));}
  const position=target.clone().addScaledVector(direction,distance*1.04*(mobile?1:this.experiment?.viewScale||1));
  if(immediate||!this.camera.position.length()){this.controls.target.copy(target);this.camera.position.copy(position);this.controls.update();this.cameraTween=null;}
  else this.cameraTween={from:this.camera.position.clone(),to:position,fromTarget:this.controls.target.clone(),target,start:performance.now()};
 }
 bindInteraction(){
  const ray=new THREE.Raycaster();let down;
  this.renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};this.cameraTween=null;this.transitionStart=0;});
  this.renderer.domElement.addEventListener('pointerup',e=>{if(!down||e.clientX>this.mainWidth||e.clientY>this.mainHeight||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4||!this.volume||!this.options.detector)return;ray.setFromCamera(new THREE.Vector2(e.clientX/this.mainWidth*2-1,1-e.clientY/this.mainHeight*2),this.camera);const hit=ray.intersectObject(this.screen)[0];if(hit)this.onProbe(-hit.point.z,hit.point.y);});
  const handle=document.getElementById('detector-handle');
  handle.addEventListener('pointerdown',e=>{
   if(e.button!==0||this.drag)return;
   e.preventDefault();handle.setPointerCapture(e.pointerId);this.controls.enabled=false;this.cameraTween=null;
   const grip={pointer:e.pointerId,x:e.clientX,y:e.clientY,setup:this.setupVersion};
   if(this.live&&this.optic.userData.handle){
    const point=this.optic.userData.handle,{min,max}=this.experiment.interaction;
    const project=v=>{
     const p=new THREE.Vector4(...point(v),1).applyMatrix4(this.camera.matrixWorldInverse).applyMatrix4(this.camera.projectionMatrix);
     return {x:(1+p.x/p.w)*this.mainWidth/2,y:(1-p.y/p.w)*this.mainHeight/2,w:p.w};
    };
    this.drag={...grip,rail:{min,max,a:project(min),b:project(max),start:project(this.liveParameter)}};
    this.onParameter?.(this.liveParameter); // Hold the carriage even before the pointer moves.
   }else{
    const a=this.project([this.z,-this.viewHeight-1.2,0]),b=this.project([this.z+1,-this.viewHeight-1.2,0]);
    this.drag={...grip,z:this.z,dx:b.x-a.x,dy:b.y-a.y};
    this.onDistance(this.z);
   }
  });
  handle.addEventListener('pointermove',e=>{
   const d=this.drag;if(!d||e.pointerId!==d.pointer||d.setup!==this.setupVersion)return;
   const mx=e.clientX-d.x,my=e.clientY-d.y;
   if(d.rail){
    const {min,max,a,b,start}=d.rail,dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
    if(len2<1||Math.min(a.w,b.w)<=0)return; // End-on: there is no usable screen-space rail.
    const s=THREE.MathUtils.clamp(((start.x-a.x+mx)*dx+(start.y-a.y+my)*dy)/len2,0,1);
    // Undo perspective foreshortening to recover the physical position along the rail.
    const t=s*a.w/((1-s)*b.w+s*a.w);
    this.onParameter?.(min+(max-min)*t);
   }else{
    const delta=(mx*d.dx+my*d.dy)/Math.max(.05,d.dx*d.dx+d.dy*d.dy);
    this.onDistance(Math.max(.5,Math.min(this.zMax,d.z+delta)));
   }
  });
  const stop=e=>{if(e.pointerId===this.drag?.pointer){this.drag=null;this.controls.enabled=true;}};for(const name of['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(name,stop);
 }
 project(point){const p=new THREE.Vector3(...point).project(this.camera);return{x:(p.x*.5+.5)*this.mainWidth,y:(.5-p.y*.5)*this.mainHeight,visible:p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};}
 updateCameraMarks(){
  const overlay=document.getElementById('camera-marks'),e=this.experiment,o=this.options;
  const type=e?.id==='hartmann'?'spots':e?.id==='speckle-focus'?'target':e?.id==='conveyor'?'beads':null;
  const show=type&&o.labels&&(type==='beads'||(o.display==='energy'&&Math.abs(this.z-e.cameraSensor.z)<.02&&(type==='target'||this.uniforms.auxiliaryMix.value===1)));
  overlay.style.display=show?'block':'none';
  if(!show)return;
  const half=e.half/o.detectorZoom;
  overlay.setAttribute('viewBox',[-half,-half,2*half,2*half].join(' '));
  const marks=overlay.firstElementChild;
  if(type==='beads')marks.setAttribute('transform','translate(0 '+(-this.uniforms.slitPhase.value/(2*CONVEYOR.beta))+')');
  else marks.removeAttribute('transform');
  if(overlay.dataset.marks===type)return;
  overlay.dataset.marks=type;
  let path='';
  if(type==='spots'){
   const {pitch,count}=LENSLETS;
   for(let j=0;j<count;j++)for(let i=0;i<count;i++){
    const x=(i-(count-1)/2)*pitch,y=(j-(count-1)/2)*pitch;
    path+='M '+(x-.43)+' '+y+' h .86 M '+x+' '+(y-.43)+' v .86 ';
   }
  }else if(type==='beads'){
   // In the axial preview +z points up. A small open ring locates each
   // physical bead without hiding the field sample at its equilibrium.
   for(const site of CONVEYOR.sites){
    const y=-site*CONVEYOR.spacing;
    path+='M -.105 '+y+' a .105 .105 0 1 0 .21 0 a .105 .105 0 1 0 -.21 0 ';
   }
  }else{
   const x=SCATTER.targetX,y=-SCATTER.targetY;
   for(const dx of [-1,1])for(const dy of [-1,1])
    path+='M '+(x+dx*.78)+' '+(y+dy*1.3)+' h '+dx*.52+' v '+(-dy*.52)+' ';
  }
  marks.setAttribute('d',path);
 }
 updateReady(){document.getElementById('app').dataset.ready=String(document.getElementById('app').dataset.experiment===this.experiment?.id&&!!this.volume&&this.surfaceReady&&this.topologyReady!==false&&(this.experiment?.object!=='bunny'||!!this.models.userData.target));}
 positionLabel(id,point,visible=true){const p=this.project(point),el=document.getElementById(id);if(!el)return;el.hidden=!this.volume||!visible||!p.visible||!Number.isFinite(p.x+p.y);if(el.classList.contains('world-label')){if(!el.hidden)this.labelItems.push({el,p});}else if(!el.hidden){el.style.transform=`translate(${p.x}px,${p.y}px)`;el.dataset.positioned='true';}}
 async uploadVolume(volume,active=()=>true,onProgress=()=>{}){
  const count=volume.energy?4:3,textures=[],next=()=>new Promise(resolve=>requestAnimationFrame(resolve)),gl=this.renderer.getContext();
  const drain=async()=>{const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();try{while(active()){const status=gl.clientWaitSync(fence,0,0);if(status===gl.WAIT_FAILED)throw Error('Field texture upload failed');if(status!==gl.TIMEOUT_EXPIRED)return;await new Promise(resolve=>setTimeout(resolve,0));}}finally{gl.deleteSync(fence);}};
  try{let deadline=performance.now()+5;
  const track=(stage,start)=>{const ms=performance.now()-start;if(ms>20){this.uploadStalls??=[];this.uploadStalls.push({stage,at:Math.round(start),ms:Math.round(ms)});if(this.uploadStalls.length>8)this.uploadStalls.shift();document.getElementById('app').dataset.uploadStalls=JSON.stringify(this.uploadStalls);}};
  for(let c=0;c<count;c++){if(!active()){textures.forEach(t=>t.dispose());return null;}const start=performance.now(),t=(c===3?energyTexture:texture3D)(null,volume.nx,volume.ny,volume.nz);t.source.dataReady=false;this.renderer.initTexture(t);textures.push(t);track('allocate '+c,start);if(performance.now()>deadline){await next();deadline=performance.now()+5;}}
  await drain();
  const stride=volume.nx*volume.ny*4,batch=Math.max(1,Math.min(16,Math.floor(4*1024**2/(stride*2*count))));
  for(let z=0;z<volume.nz;z+=batch){if(!active()){textures.forEach(t=>t.dispose());return null;}const depth=Math.min(batch,volume.nz-z);
   // Three's general copy helper queries five GL unpack parameters per slice.
   // Those synchronous queries can wait for queued volume draws. These tightly
   // packed CPU slices need no readback; reset Three's state cache afterwards.
   const start=performance.now();gl.activeTexture(gl.TEXTURE0);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
   for(const parameter of[gl.UNPACK_ROW_LENGTH,gl.UNPACK_IMAGE_HEIGHT,gl.UNPACK_SKIP_PIXELS,gl.UNPACK_SKIP_ROWS,gl.UNPACK_SKIP_IMAGES])gl.pixelStorei(parameter,0);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
   for(let c=0;c<count;c++){const data=c===3?volume.energy:volume.textures[c];gl.bindTexture(gl.TEXTURE_3D,this.renderer.properties.get(textures[c]).__webglTexture);gl.texSubImage3D(gl.TEXTURE_3D,0,0,0,z,volume.nx,volume.ny,depth,gl.RGBA,gl.HALF_FLOAT,data.subarray(z*stride,(z+depth)*stride));}
   gl.bindTexture(gl.TEXTURE_3D,null);this.renderer.resetState();track('slice '+z,start);
   // Bound queued transfer memory. Waiting on a fence is asynchronous; filling
   // the driver's upload queue until texSubImage3D blocks is not.
   await drain();
   onProgress(Math.min(1,(z+depth)/volume.nz));if(performance.now()>deadline){await next();deadline=performance.now()+5;}
  }return textures;}catch(error){textures.forEach(t=>t.dispose());throw error;}
 }
 queueComparison(value){this.pendingComparison=value;}
 captureTransition(duration=360){if(!this.volume)return Promise.resolve();this.transitionDuration=duration;return new Promise(resolve=>{(this.capturePending??=[]).push(resolve);});}
 transitionAppearance(options){if(!this.volume){this.applyAppearance(options);return;}this.pendingAppearance={...options};}
 render(phase,now){
  const renderStarted=performance.now();
  const renderer=this.renderer,gl=renderer.getContext(),timer=this.gpuTimer;
  if(timer&&this.gpuQuery&&gl.getQueryParameter(this.gpuQuery,gl.QUERY_RESULT_AVAILABLE)){
   if(!gl.getParameter(timer.GPU_DISJOINT_EXT)){const ms=gl.getQueryParameter(this.gpuQuery,gl.QUERY_RESULT)/1e6;this.gpuFrameMs=this.gpuFrameMs?this.gpuFrameMs*.8+ms*.2:ms;document.getElementById('app').dataset.gpuMs=ms.toFixed(2);}
   gl.deleteQuery(this.gpuQuery);this.gpuQuery=null;
  }
  const measure=timer&&!this.gpuQuery;if(measure){this.gpuQuery=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,this.gpuQuery);}
  this.updateTheme(now);
  if(this.live){this.live.update(this.renderer,this.liveParameter);this.optic.userData.setParameter?.(this.liveParameter);if(this.liveVectorsDirty&&this.options.vectors!=='none'){this.prepareVectorSamples();this.updateArrows();this.liveVectorsDirty=false;}}

  const table=this.studioTable,studioStrength=this.studioUniforms.studioMix.value;
  if(table && this.experiment){
   if(studioStrength>.001 && (table.setup!==this.setupVersion || table.incident!==this.options.incident)){
    table.fit([this.optic,this.illumination,this.models],this.zMax,this.lightRig.key);
    table.setup=this.setupVersion;
    table.incident=this.options.incident;
   }
   const gridHeight=-this.viewHeight-1.2;
   this.track.position.y=table.hasSupport?THREE.MathUtils.lerp(gridHeight,table.surface.position.y+.012,studioStrength):gridHeight;
   table.renderContact(this.renderer,this.scene,studioStrength,this.optic.userData.handle?this.liveParameter:null,this.lightRig.key);
  }
  if(this.cameraTween){const t=this.cameraTween,f=Math.min(1,(now-t.start)/380),s=1-(1-f)**3;this.camera.position.lerpVectors(t.from,t.to,s);this.controls.target.lerpVectors(t.fromTarget,t.target,s);if(f===1)this.cameraTween=null;}
  this.uniforms.reveal.value=1;this.eArrows.material.uniforms.reveal.value=this.bArrows.material.uniforms.reveal.value=1;
  if(!this.drag)this.controls.update();this.camera.updateMatrixWorld();this.studioUniforms.studioDirection.value.copy(this.lightRig.key.position).transformDirection(this.camera.matrixWorldInverse);this.uniforms.timePhase.value=phase;this.eArrows.material.uniforms.timePhase.value=this.bArrows.material.uniforms.timePhase.value=phase;
  this.labelItems=[];this.positionLabel('detector-handle',this.live&&this.optic.userData.handle?this.optic.userData.handle(this.liveParameter):[this.z,-this.viewHeight-1.2,0],this.live&&!!this.optic.userData.handle||this.options.detector&&(!this.experiment?.interaction||this.experiment.interaction.kind==='distance'));
  (this.optic.userData.labels||[]).forEach((label,i)=>this.positionLabel('bench-label-'+i,label.p,this.options.labels));
  if(this.options.labels){if(this.experiment){const h=plateHalf(this.experiment);this.positionLabel('optic-label',this.optic.userData.label||[0,h+1.1,0],!this.optic.userData.labels?.length);this.positionLabel('incident-label',[-10,h*.94+2,0],this.options.incident&&!this.experiment.analytic&&this.experiment.kind!=='beams');}const bunny=this.experiment?.object==='bunny';this.positionLabel('source-label',[-75,-18,0],bunny);this.positionLabel('sensor-label',[-42,22,0],bunny);this.positionLabel('processor-label',[-41,-30,23],bunny);this.positionLabel('object-light-label',[-57,20,27],bunny);this.positionLabel('reference-light-label',[-64,27,-7],bunny);this.positionLabel('target-label',[32,23,0],this.experiment?.object==='bunny'&&this.options.surfaceGuide);}
  this.positionLabel('vortex-label',[this.experiment?.vortex?22:32,6.5,0],!!(this.options.labels&&this.experiment?.vortex&&this.options.vortexLines));
  const imageGuide=this.experiment?.id==='metamorphosis'?(this.topology.userData.imageGuides||[]).find(g=>Math.abs(g.z-this.z)<3):null;const designLabel=document.getElementById('design-label'),designText=imageGuide?imageGuide.name+' · guide':'Design curves';if(designLabel.textContent!==designText)designLabel.textContent=designText;this.positionLabel('design-label',[imageGuide?.z||40,10,0],!!(this.options.labels&&this.options.surfaceGuide&&(this.experiment?.id==='saturn'||imageGuide)));
  this.positionLabel('obstacle-label',[this.experiment?.interfaceZ||0,5,0],!!(this.options.labels&&this.experiment?.interfaceZ));
  layoutLabels(this.labelItems,this.width,this.height,this.previewRect);
  const bg=this.scene.background;renderer.setScissorTest(false);this.scene.background=null;
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
  if(this.capturePending||this.pendingAppearance||this.pendingComparison!==undefined){renderer.copyFramebufferToTexture(this.transitionTexture,new THREE.Vector2(0,0));this.transitionStart=now;const done=this.capturePending||[];this.capturePending=null;if(this.pendingAppearance){const next=this.pendingAppearance;this.pendingAppearance=null;this.transitionDuration=220;this.applyAppearance(next);}if(this.pendingComparison!==undefined){this.transitionDuration=220;this.setComparison(this.pendingComparison);this.pendingComparison=undefined;}for(const resolve of done)resolve();}
  if(measure)gl.endQuery(timer.TIME_ELAPSED_EXT);const transition=this.transitionStart?'active':'idle',app=document.getElementById('app');if(app.dataset.transition!==transition)app.dataset.transition=transition;
  if(this.volume){this.updateReady();app.dataset.hasScene='true';this.presentationStart||=now;if(now-this.presentationStart>320&&!this.transitionStart)app.dataset.presented='true';}
  const cost=performance.now()-renderStarted;if(cost>30){this.slowRenders??=[];this.slowRenders.push({at:Math.round(renderStarted),ms:Math.round(cost)});if(this.slowRenders.length>8)this.slowRenders.shift();app.dataset.slowRender=JSON.stringify(this.slowRenders);}
 }
}
