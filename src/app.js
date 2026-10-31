import katex from '../vendor/katex/katex.mjs';
import { EXPERIMENTS,experiment } from './experiments.js';
import { loadVolume,sampleField,normalizedFlux,mixSlitPhase } from './volume-data.js';
import { FieldScene } from './scene3d.js';
import {appearanceFor} from './display-presets.js';
import {setupThemeCycle} from './themes.js';
import {setupSettings,showElement,paintRange} from './settings.js';
import {setupGalleryMotion} from './gallery-motion.js';
import {IMAGE_DEPTHS,IMAGE_NAMES,imageIcon} from './image-contours.js';

const $=id=>document.getElementById(id),TAU=Math.PI*2,started=performance.now();
const requestedThumbnail=new URLSearchParams(location.search).get('thumbnail'),thumbnail=EXPERIMENTS.some(e=>e.id===requestedThumbnail)?requestedThumbnail:null,initial=thumbnail||setupFromUrl();document.body.classList.toggle('thumbnail-export',!!thumbnail);
function setupFromUrl(){const id=location.hash.slice(1);return EXPERIMENTS.some(e=>e.id===id)?id:EXPERIMENTS[0].id;}
function linkSetup(id,replace=false){if(thumbnail)return;const url=new URL(location.href);url.hash=id;if(url.href!==location.href)history[replace?'replaceState':'pushState'](null,'',url);}
linkSetup(initial,true);
const state={id:initial,z:experiment(initial).z,phase:0,playing:!thumbnail,mode:'both',probe:null,sweeping:!thumbnail,sweepDirection:1,slitPhase:0};
const previews=new Map(),full=new Map(),pending=new Map(),controllers=new Map();let scene,volume,selection=0,labelDirty=true,probeDirty=true,firstFrame=false,latestDrag=0,lastInteraction=0;
function tex(element,value,display=false){if(element.dataset.texValue===value)return;element.dataset.texValue=value;katex.render(value,element,{displayMode:display,throwOnError:false,strict:'ignore',trust:false});}
document.querySelectorAll('[data-tex]').forEach(el=>tex(el,el.dataset.tex,el.dataset.display==='true'));

const gallery=$('experiments');
for(const e of EXPERIMENTS){
 const button=document.createElement('button');button.className='experiment';button.dataset.experiment=e.id;button.setAttribute('aria-label',e.name);button.setAttribute('aria-pressed',e.id===state.id);button.innerHTML=`<img src="./assets/previews/${e.id}.svg" alt="${e.name} optical setup" width="180" height="105"><span>${e.name}</span>`;
 button.addEventListener('click',()=>selectExperiment(e.id));gallery.appendChild(button);
}
const centerSelection=setupGalleryMotion(gallery);
let focusSeek=null,scanHold=0;
function configureFocusStops(id){
 const strip=$('focus-stops');strip.hidden=id!=='metamorphosis';if(id!=='metamorphosis'||strip.children.length)return;
 IMAGE_DEPTHS.forEach((z,i)=>{const b=document.createElement('button');b.type='button';b.dataset.focus=String(z);b.setAttribute('aria-label',`${IMAGE_NAMES[i]} focus`);b.title=`${IMAGE_NAMES[i]} · ${z} wavelengths`;b.setAttribute('aria-pressed','false');b.innerHTML=imageIcon(i);b.addEventListener('click',()=>{state.sweeping=false;updateSweep();focusSeek={from:state.z,to:z,start:performance.now()};scene.cameraTween=null;scene.transitionStart=0;});strip.append(b);});
}

function loading(message,refining=false){$('loading').classList.toggle('ready',!message);$('loading').classList.toggle('refining',refining);$('loading-text').textContent=message||'';}
function fail(error){$('error').hidden=false;$('error').textContent=error instanceof Error?error.message:String(error);loading('');}
try{scene=new FieldScene($('stage'),z=>{state.sweeping=false;updateSweep();setDistance(z);},(x,y)=>setProbe({x,y}));scene.onError=fail;}catch(error){fail(`This visualization needs WebGL 2. ${error.message}`);}
const settings=scene?setupSettings(scene,tex,initial):{options:appearanceFor(initial)},appearance=settings.options;
if(scene)setupThemeCycle(scene,settings);
if(thumbnail){Object.assign(appearance,{labels:false,axes:false,vectors:'none'});scene?.applyAppearance(appearance);}

function acquire(id,quality){
 const cache=quality==='full'?full:previews,key=`${id}:${quality}`;
 if(cache.has(id)){const data=cache.get(id);cache.delete(id);cache.set(id,data);return Promise.resolve(data);}if(pending.has(key))return pending.get(key);
 const controller=new AbortController();controllers.set(key,controller);
 const clear=()=>{if(controllers.get(key)===controller){controllers.delete(key);pending.delete(key);}};
 const request=loadVolume(`./assets/fields/${id}${quality==='preview'?'.preview':''}.bin.gz`,controller.signal).then(data=>{cache.set(id,data);while(cache.size>(quality==='full'?3:6)){const oldest=[...cache.keys()].find(k=>k!==state.id&&k!==id);if(!oldest)break;cache.delete(oldest);}clear();return data;},error=>{clear();throw error;});pending.set(key,request);return request;
}

async function selectExperiment(id,fromHistory=false){
 if(state.id===id&&volume?.quality==='full')return;
 focusSeek=null;scanHold=id==='metamorphosis'?1.8:0;configureFocusStops(id);
 if(!fromHistory)linkSetup(id);settings.useExperiment?.(id);
 $('error').hidden=true;$('error').textContent='';
 const generation=++selection,e=experiment(id);state.id=id;state.z=e.z;state.sweepDirection=1;state.probe=null;state.sweeping=!thumbnail;updateSweep();state.slitPhase=0;$('slit-interference').hidden=id!=='double';$('slit-phase').value=0;paintRange($('slit-phase'));$('slit-phase').disabled=true;for(const b of document.querySelectorAll('[data-slit-phase]'))b.disabled=true;tex($('slit-phase-value'),String.raw`\delta=0`);volume=null;firstFrame=false;
 for(const[key,controller]of controllers)if(key.endsWith(':full')&&key!==`${id}:full`){controller.abort();controllers.delete(key);pending.delete(key);}
 $('app').dataset.quality='loading';$('app').dataset.ready='false';$('app').dataset.selectedAt=String(performance.now());$('app').dataset.experiment=id;
 $('surface-guide-setting').hidden=!e.object&&!['saturn','metamorphosis'].includes(e.id);$('surface-guide-label').textContent=e.id==='saturn'?'Design curves':e.id==='metamorphosis'?'Image guides':'Reconstruction surface';$('element-opacity-setting').hidden=e.kind==='beams';$('vortex-setting').hidden=!e.vortex;$('focus-emphasis-setting').hidden=!e.focusWindow;
 document.querySelectorAll('.experiment').forEach(b=>{const active=b.dataset.experiment===id;b.setAttribute('aria-pressed',active);b.setAttribute('aria-busy',active);});
 centerSelection(document.querySelector('button[data-experiment="'+id+'"]'));$('distance').max=e.zMax;$('distance').value=e.z;paintRange($('distance'));labelDirty=true;setProbe(null);detailsDirty=true;document.title=`${e.name} · diffract`;
 loading(scene?.volume?'Loading field':'Loading field',!!scene?.volume);
 try{
  const cached=full.get(id);const data=cached||await acquire(id,'preview');if(generation!==selection)return;const initialGpu=await scene.uploadVolume(data,()=>generation===selection);if(generation!==selection){initialGpu?.forEach(t=>t.dispose());return;}
  await scene.captureTransition();if(generation!==selection){initialGpu?.forEach(t=>t.dispose());return;}showVolume(e,data,initialGpu);loading(data.quality==='full'?'':'Refining field',true);
  if(data.quality!=='full'){await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(generation!==selection)return;const detailed=await acquire(id,'full');while(generation===selection&&performance.now()-lastInteraction<220)await new Promise(resolve=>setTimeout(resolve,50));if(generation!==selection)return;const gpu=await scene.uploadVolume(detailed,()=>generation===selection);if(generation!==selection){gpu?.forEach(t=>t.dispose());return;}await scene.captureTransition(650);if(generation!==selection){gpu?.forEach(t=>t.dispose());return;}showVolume(e,detailed,gpu);}
  loading('');document.querySelector(`button[data-experiment="${id}"]`).setAttribute('aria-busy','false');if(id==='double')loadSlitPartner(generation);else warmPreviews(id,generation);
 }catch(error){if(generation===selection)fail(error);}
}
async function loadSlitPartner(generation){try{const data=await acquire('double-right','full');if(generation!==selection)return;const gpu=await scene.uploadVolume(data,()=>generation===selection);if(generation!==selection)return;scene.setAuxiliary(data,gpu);$('slit-phase').disabled=false;for(const b of document.querySelectorAll('[data-slit-phase]'))b.disabled=false;}catch(error){if(generation===selection)fail(error);}}
function setSlitPhase(value){state.slitPhase=Number(value)/1000*Math.PI;$('slit-phase').value=value;paintRange($('slit-phase'));tex($('slit-phase-value'),String.raw`\delta=${(state.slitPhase/Math.PI).toFixed(2)}\pi`);scene.setSlitPhase(state.slitPhase);probeDirty=true;}
function showVolume(e,data,gpu){volume=data;scene.setExperiment(e,data,gpu);scene.setDistance(state.z);scene.setSlitPhase(state.slitPhase);scene.setProbe(state.probe);probeDirty=true;}
async function warmPreviews(id,generation){const index=EXPERIMENTS.findIndex(e=>e.id===id);for(const e of EXPERIMENTS.slice(index+1,index+3)){if(generation!==selection)return;try{await acquire(e.id,'preview');}catch{}}}

function setDistance(z,manual=true){
 if(manual)focusSeek=null;
 state.z=Math.max(.5,Math.min(experiment(state.id).zMax,z));$('distance').value=state.z;paintRange($('distance'));
 if(manual){scene.cameraTween=null;scene.transitionStart=0;}scene.setDistance(state.z);labelDirty=probeDirty=true;if(manual)latestDrag=lastInteraction=performance.now();
 $('app').dataset.distance=state.z.toFixed(4);if(manual)$('app').dataset.cameraAtInput=scene.camera.position.toArray().join(',');
 if(state.id==='metamorphosis')for(const button of $('focus-stops').children){const active=Math.abs(state.z-Number(button.dataset.focus))<1.8;if(button.getAttribute('aria-pressed')!==String(active))button.setAttribute('aria-pressed',String(active));}
}
function updateDistanceLabel(){tex($('distance-value'),String.raw`z=${state.z.toFixed(1)}\lambda`);tex($('physical-distance'),String.raw`${(state.z*.532).toFixed(2)}\,\mu\mathrm m`);$('distance').setAttribute('aria-valuetext',`${state.z.toFixed(1)} wavelengths`);labelDirty=false;}
function setProbe(point){state.probe=point;scene?.setProbe(point);$('probe-readout').hidden=!point;$('clear-probe').hidden=!point;scene?.updatePreviewRect();probeDirty=true;}
const probeSample=new Float32Array(10);
function number(n){if(Math.abs(n)<1e-7)return '0';if(Math.abs(n)<.001){const [a,b]=n.toExponential(1).split('e');return `${a}\\!\\times\\!10^{${Number(b)}}`;}return n.toFixed(3);}
function updateProbe(){
 if(!state.probe||!volume)return;
 sampleField(volume,state.probe.x,state.probe.y,state.z,probeSample);if(scene.auxiliary&&state.id==='double')mixSlitPhase(probeSample,sampleField(scene.auxiliary,state.probe.x,state.probe.y,state.z),state.slitPhase);const phase=TAU*state.z-state.phase,c=Math.cos(phase),s=Math.sin(phase),real=i=>probeSample[i]*c-probeSample[i+1]*s;
 tex($('probe-coordinates'),String.raw`(x,y)=(${state.probe.x.toFixed(1)},${state.probe.y.toFixed(1)})\lambda`);
 tex($('probe-electric'),String.raw`\frac{\mathbf E}{E_0}=\bigl(0,\,${number(real(0))},\,${number(real(2))}\bigr)`);
 tex($('probe-magnetic'),String.raw`\frac{c\mathbf B}{E_0}=\bigl(${number(real(4))},\,${number(real(6))},\,${number(real(8))}\bigr)`);
 tex($('probe-flux'),String.raw`\langle S_z\rangle/I_0=${number(normalizedFlux(probeSample))}`);probeDirty=false;
}
let detailsDirty=true;function updateDetails(){detailsDirty=false;const e=experiment(state.id);showElement(e,tex);$('equation-title').textContent=e.name;$('experiment-description').textContent=e.description;tex($('boundary-equation'),e.formula,true);tex($('parameter-equation'),e.parameters,true);}
function updatePlay(){const label=state.playing?'Pause optical cycle':'Play optical cycle';$('play').setAttribute('aria-label',label);$('play').title=label;$('play-path').setAttribute('d',state.playing?'M7 4v12m6-12v12':'M6 3l10 7-10 7z');}
function togglePlay(){state.playing=!state.playing;updatePlay();}
$('play').addEventListener('click',togglePlay);$('reset').addEventListener('click',()=>scene?.resetView(false));
$('distance').addEventListener('input',e=>{state.sweeping=false;updateSweep();setDistance(Number(e.target.value));});
$('slit-phase').addEventListener('input',e=>setSlitPhase(e.target.value));for(const b of document.querySelectorAll('[data-slit-phase]'))b.addEventListener('click',()=>setSlitPhase(b.dataset.slitPhase));
function updateSweep(){const label=state.sweeping?'Pause detector scan':'Play detector scan';$('sweep').setAttribute('aria-pressed',String(state.sweeping));$('sweep').setAttribute('aria-label',label);$('sweep').title=label;$('sweep-path').setAttribute('d',state.sweeping?'M7 4v12m6-12v12':'M6 3l10 7-10 7z');}
function toggleSweep(){focusSeek=null;state.sweeping=!state.sweeping;updateSweep();}
$('sweep').addEventListener('click',toggleSweep);
$('stage').addEventListener('pointermove',e=>{if(e.buttons)lastInteraction=performance.now();});
$('clear-probe').addEventListener('click',()=>setProbe(null));
let probing=false;
$('detector-image').addEventListener('wheel',event=>{event.preventDefault();settings.setDetectorZoom(appearance.detectorZoom*Math.exp(-event.deltaY*.002));},{passive:false});
$('detector-image').addEventListener('dblclick',()=>settings.setDetectorZoom(1));
function probeFromPointer(e){const r=$('detector-image').getBoundingClientRect(),half=experiment(state.id).half/appearance.detectorZoom;setProbe({x:Math.max(-half,Math.min(half,((e.clientX-r.left)/r.width*2-1)*half)),y:Math.max(-half,Math.min(half,(1-(e.clientY-r.top)/r.height*2)*half))});}
$('detector-image').addEventListener('pointerdown',e=>{probing=true;e.currentTarget.setPointerCapture(e.pointerId);probeFromPointer(e);});$('detector-image').addEventListener('pointermove',e=>{if(probing)probeFromPointer(e);});$('detector-image').addEventListener('pointerup',()=>probing=false);$('detector-image').addEventListener('pointercancel',()=>probing=false);
$('detector-image').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const half=experiment(state.id).half/appearance.detectorZoom,p=state.probe||{x:0,y:0},step=half/30;setProbe({x:Math.max(-half,Math.min(half,p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0))),y:Math.max(-half,Math.min(half,p.y+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0)))});});
function openDetails(){if(detailsDirty)updateDetails();$('equations').showModal();}$('details').addEventListener('click',openDetails);$('optic-label').addEventListener('click',openDetails);$('close-details').addEventListener('click',()=>$('equations').close());
$('equations').addEventListener('click',e=>{if(e.target!==$('equations'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();});
$('phase').addEventListener('input',e=>{state.phase=Number(e.target.value)/1000*TAU;state.playing=false;updatePlay();probeDirty=true;});
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select,button,[tabindex]')||$('equations').open)return;if(e.code==='Space'){e.preventDefault();toggleSweep();}if(e.key.toLowerCase()==='r')scene?.resetView(false);const item=EXPERIMENTS[Number(e.key)-1];if(item)selectExperiment(item.id);});
document.addEventListener('keydown',e=>{if(!thumbnail||!['ArrowRight','ArrowLeft'].includes(e.key))return;e.preventDefault();const index=EXPERIMENTS.findIndex(x=>x.id===state.id),next=(index+(e.key==='ArrowRight'?1:-1)+EXPERIMENTS.length)%EXPERIMENTS.length;selectExperiment(EXPERIMENTS[next].id);});
window.addEventListener('hashchange',()=>{const id=setupFromUrl();linkSetup(id,true);if(id!==state.id)selectExperiment(id,true);});
let last=performance.now(),lastProbe=0,lastMetric=0,lastPhaseLabel=0,lastDistanceLabel=0,frameTimes=[];
function animate(now){
 const elapsed=now-last,dt=Math.min(.08,elapsed/1000);last=now;
 if(!document.hidden&&scene){
  if(focusSeek&&volume){const t=Math.min(1,(now-focusSeek.start)/550),ease=t*t*(3-2*t);setDistance(focusSeek.from+(focusSeek.to-focusSeek.from)*ease,false);if(t===1)focusSeek=null;}
  if(state.sweeping&&volume){const e=experiment(state.id),[near,far]=e.scan||[.5,e.zMax],here=Math.max(near,Math.min(far,state.z));if(scanHold>0)scanHold=Math.max(0,scanHold-dt);else{
   const stop=e.id==='metamorphosis'?(state.sweepDirection>0?IMAGE_DEPTHS.find(z=>z>here+.01):[...IMAGE_DEPTHS].reverse().find(z=>z<here-.01)):undefined;
   const speed=stop===undefined?1:.3+.7*Math.min(1,Math.abs(stop-here)/4);let z=here+dt*(far-near)/12*speed*state.sweepDirection;
   if(stop!==undefined&&(z-stop)*state.sweepDirection>=0){z=stop;scanHold=1.8;}
   if(z>=far||z<=near)state.sweepDirection*=-1;setDistance(Math.max(near,Math.min(far,z)),false);
  }}
  if(state.playing)state.phase=(state.phase+TAU*dt*appearance.speed)%TAU;
  if(labelDirty&&now-lastDistanceLabel>90){updateDistanceLabel();lastDistanceLabel=now;}if(state.probe&&(probeDirty||now-lastProbe>130)){updateProbe();lastProbe=now;}
  if($('settings-toggle').getAttribute('aria-expanded')==='true'&&!$('vector-settings').hidden){$('phase').value=Math.round(state.phase/TAU*1000);paintRange($('phase'));if(now-lastPhaseLabel>125){tex($('phase-value'),String.raw`\omega t=${(state.phase/Math.PI).toFixed(2)}\pi`);lastPhaseLabel=now;}}
  scene.render(state.phase,now);
  if(volume&&!firstFrame){firstFrame=true;$('app').dataset.firstFieldMs=(performance.now()-Number($('app').dataset.selectedAt||started)).toFixed(1);}
  if(latestDrag){$('app').dataset.detectorLatencyMs=(performance.now()-latestDrag).toFixed(2);$('app').dataset.cameraAfterInput=scene.camera.position.toArray().join(',');latestDrag=0;}
  frameTimes.push(elapsed);if(frameTimes.length>60)frameTimes.shift();
  if(now-lastMetric>1000){const sorted=[...frameTimes].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];$('app').dataset.frameMs=median.toFixed(1);lastMetric=now;}
 }
 requestAnimationFrame(animate);
}
document.addEventListener('visibilitychange',()=>{last=performance.now();});
updatePlay();updateDistanceLabel();tex($('phase-value'),String.raw`\omega t=0`);if(scene){selectExperiment(initial);requestAnimationFrame(animate);}

