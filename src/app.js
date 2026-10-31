import {absorbedFraction} from './live-physics.js';
import katex from '../vendor/katex/katex.mjs';
import { EXPERIMENTS,experiment } from './experiments.js';
import { loadVolume,sampleField,normalizedFlux,mixSlitPhase } from './volume-data.js';
import { FieldScene } from './scene3d.js';
import {appearanceFor} from './display-presets.js';
import {setupThemeCycle} from './themes.js';
import {setupSettings,showElement,paintRange} from './settings.js';
import {setupGalleryMotion} from './gallery-motion.js';
import {IMAGE_DEPTHS,IMAGE_NAMES,imageIcon} from './image-contours.js';
import {spectrumUrl} from './spectrum-assets.js';

const $=id=>document.getElementById(id),TAU=Math.PI*2,started=performance.now();
const requestedThumbnail=new URLSearchParams(location.search).get('thumbnail'),thumbnail=EXPERIMENTS.some(e=>e.id===requestedThumbnail)?requestedThumbnail:null,initial=thumbnail||setupFromUrl();document.body.classList.toggle('thumbnail-export',!!thumbnail);
function setupFromUrl(){const id=location.hash.slice(1);return EXPERIMENTS.some(e=>e.id===id)?id:EXPERIMENTS[0].id;}
function linkSetup(id,replace=false){if(thumbnail)return;const url=new URL(location.href);url.hash=id;if(url.href!==location.href)history[replace?'replaceState':'pushState'](null,'',url);}
linkSetup(initial,true);
const state={id:initial,z:experiment(initial).z,phase:0,playing:!thumbnail,mode:'both',probe:null,sweeping:!thumbnail,sweepDirection:1,slitPhase:0,parameter:0,comparison:0};
const previews=new Map(),full=new Map(),pending=new Map(),controllers=new Map();let requestedId=null,scene,volume,selection=0,preparationController,labelDirty=true,probeDirty=true,firstFrame=false,latestDrag=0,lastInteraction=0;
function tex(element,value,display=false){if(element.dataset.texValue===value)return;element.dataset.texValue=value;katex.render(value,element,{displayMode:display,throwOnError:false,strict:'ignore',trust:false});}
document.querySelectorAll('[data-tex]').forEach(el=>{if(!el.closest('#equations'))tex(el,el.dataset.tex,el.dataset.display==='true');});
const detailsMath=[...$('equations').querySelectorAll('[data-tex]')];let mathWarmup=0;
function warmDetails(){
 if(mathWarmup||!detailsMath.length&&!detailsDirty)return;
 const schedule=window.requestIdleCallback?fn=>requestIdleCallback(fn,{timeout:400}):fn=>setTimeout(fn,24);
 mathWarmup=schedule(()=>{mathWarmup=0;const el=detailsMath.shift();if(el)tex(el,el.dataset.tex,el.dataset.display==='true');else if(detailsDirty)updateDetails();warmDetails();});
}

const gallery=$('experiments');
for(const e of EXPERIMENTS){
 const button=document.createElement('button');button.className='experiment';button.dataset.experiment=e.id;button.setAttribute('aria-label',e.name);button.setAttribute('aria-pressed',e.id===state.id);button.innerHTML=`<img data-src="./assets/previews/${e.id}.svg" decoding="async" fetchpriority="low" alt="${e.name} optical setup" width="180" height="105"><span>${e.name}</span>`;
 button.addEventListener('click',()=>selectExperiment(e.id));gallery.appendChild(button);
}
const thumbnailObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const img=entry.target;img.src=img.dataset.src;img.decode().then(()=>img.classList.add('loaded')).catch(()=>{});thumbnailObserver.unobserve(img);}},{root:gallery,rootMargin:'0px 320px'});
for(const img of gallery.querySelectorAll('img'))thumbnailObserver.observe(img);
const centerSelection=setupGalleryMotion(gallery);
let focusSeek=null,scanHold=0;
function configureFocusStops(id){
 const strip=$('focus-stops'),microscope=id==='phase-microscope';strip.hidden=id!=='metamorphosis'&&!microscope;if(strip.dataset.setup===id)return;strip.dataset.setup=id;strip.setAttribute('aria-label',microscope?'Microscope observation planes':'Hologram image planes');strip.replaceChildren();if(strip.hidden)return;
 const depths=microscope?[.5,40,80]:IMAGE_DEPTHS,names=microscope?['Specimen','Fourier plane','Image']:IMAGE_NAMES;
 depths.forEach((z,i)=>{const b=document.createElement('button');b.type='button';b.dataset.focus=String(z);b.setAttribute('aria-label',names[i]+' focus');b.title=names[i];b.setAttribute('aria-pressed','false');b.innerHTML=microscope?'<span>'+names[i]+'</span>':imageIcon(i);b.addEventListener('click',()=>{state.sweeping=false;updateSweep();focusSeek={from:state.z,to:z,start:performance.now()};scene.cameraTween=null;scene.transitionStart=0;});strip.append(b);});
}

function loading(message,refining=false){$('loading').classList.toggle('ready',!message);$('loading').classList.toggle('refining',refining);$('loading-text').textContent=message||'';}
function fail(error){$('error').hidden=false;$('error').textContent=error instanceof Error?error.message:String(error);loading('');}
try{scene=new FieldScene($('stage'),z=>{state.sweeping=false;updateSweep();setDistance(z);},(x,y)=>setProbe({x,y}));scene.onError=fail;}catch(error){fail(`This visualization needs WebGL 2. ${error.message}`);}
const settings=scene?setupSettings(scene,tex,initial):{options:appearanceFor(initial)},appearance=settings.options;
if(scene)setupThemeCycle(scene,settings);
if(thumbnail){Object.assign(appearance,{labels:false,axes:false,vectors:'none'});scene?.applyAppearance(appearance);}

function acquire(id,quality,onProgress=()=>{}){
 const cache=quality==='full'?full:previews,key=`${id}:${quality}`;
 if(cache.has(id)){const data=cache.get(id);cache.delete(id);cache.set(id,data);return Promise.resolve(data);}if(pending.has(key))return pending.get(key);
 const controller=new AbortController();controllers.set(key,controller);
 const clear=()=>{if(controllers.get(key)===controller){controllers.delete(key);pending.delete(key);}};
 const request=loadVolume(`./assets/fields/${id}${quality==='preview'?'.preview':''}.bin.gz`,controller.signal,onProgress).then(data=>{controller.signal.throwIfAborted();const target=data.quality==='full'?full:cache;target.set(id,data);const complete=target===full,limit=(complete?320:72)*1024**2;while(target.size>(complete?6:8)||[...target.values()].reduce((n,v)=>n+v.buffer.byteLength+(v.energy?.byteLength||0),0)>limit){const oldest=[...target.keys()].find(k=>k!==state.id&&k!==id);if(!oldest)break;target.delete(oldest);}clear();return data;},error=>{clear();throw error;});pending.set(key,request);return request;
}

function markRequest(id,busy){
 for(const button of gallery.children){button.setAttribute('aria-pressed',String(button.dataset.experiment===id));button.setAttribute('aria-busy',String(busy&&button.dataset.experiment===id));button.classList.toggle('pending',busy&&button.dataset.experiment===id);}
 $('app').dataset.requested=id;$('app').dataset.pending=String(busy&&(!volume||id!==state.id));
}
function loadProgress(id,value){if(requestedId!==id)return;const button=gallery.querySelector('[data-experiment="'+id+'"]');button?.style.setProperty('--load-progress',String(value));$('loading').style.setProperty('--load-progress',String(value));}
function commitExperiment(e,data,gpu,prepared){
 const commitStarted=performance.now();
 const id=e.id;focusSeek=null;scanHold=id==='metamorphosis'?1.8:0;configureFocusStops(id);
 state.id=id;state.z=e.z;state.phase=0;state.sweepDirection=1;state.probe=null;state.sweeping=!thumbnail&&!['cycle','comparison'].includes(e.interaction?.kind);state.playing=!thumbnail;state.slitPhase=0;state.comparison=0;updateSweep();updatePlay();
 $('app').dataset.experiment=id;$('app').dataset.pending='false';settings.useExperiment?.(id);
 $('slit-interference').hidden=id!=='double';$('slit-phase-title').textContent=id==='michelson'?'Return-arm optical delay':'Between the two slits';$('slit-phase').setAttribute('aria-label',id==='michelson'?'Relative arm phase':'Relative slit phase');$('slit-phase').value=0;paintRange($('slit-phase'));$('slit-phase').disabled=true;for(const b of document.querySelectorAll('[data-slit-phase]'))b.disabled=true;tex($('slit-phase-value'),String.raw`\delta=0`);
 $('surface-guide-setting').hidden=!e.object&&!['saturn','metamorphosis'].includes(id);$('surface-guide-label').textContent=id==='saturn'?'Design curves':id==='metamorphosis'?'Image guides':'Reconstruction surface';$('element-opacity-setting').hidden=e.kind==='beams';$('show-incident').closest('label').hidden=!!e.analytic;$('vortex-setting').hidden=!e.vortex;$('focus-emphasis-setting').hidden=!e.focusWindow;
 $('optic-label').querySelector('[data-tex]').hidden=!!e.analytic;$('distance').max=e.zMax;$('distance').value=e.z;paintRange($('distance'));labelDirty=true;setProbe(null);detailsDirty=true;document.title=e.name+' · diffract';
 firstFrame=false;showVolume(e,data,gpu,prepared);configureInteraction(e);setDistance(state.z,false);loadProgress(id,1);markRequest(id,false);
 warmDetails();
 for(const element of [document.querySelector('.view-modes'),$('distance-value'),$('focus-stops')]){element.getAnimations().forEach(a=>a.cancel());element.animate([{opacity:.25},{opacity:1}],{duration:340,easing:'cubic-bezier(.22,1,.36,1)'});}
 $('app').dataset.commitMs=(performance.now()-commitStarted).toFixed(1);
}
async function selectExperiment(id,fromHistory=false){
 if(requestedId===id)return;
 const generation=++selection,e=experiment(id);requestedId=id;
 preparationController?.abort();preparationController=new AbortController();const preparationSignal=preparationController.signal;
 if(!fromHistory)linkSetup(id);
 for(const[key,controller]of controllers)if(!key.startsWith(id+':')){controller.abort();controllers.delete(key);pending.delete(key);}
 $('error').hidden=true;$('error').textContent='';markRequest(id,true);loadProgress(id,0);
 centerSelection(gallery.querySelector('[data-experiment="'+id+'"]'));
 if(state.id===id&&volume?.quality==='full'){scene.computing=false;markRequest(id,false);loading('');return;}
 $('app').dataset.selectedAt=String(performance.now());delete $('app').dataset.fullFieldMs;loading('Preparing field',!!volume);scene.computing=true;
 // Let the pressed state paint before any apparatus construction starts.
 await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));if(generation!==selection)return;
 let prepared=null,gpu=null;const active=()=>generation===selection;
 const preparing=scene.prepareExperiment(e,preparationSignal).then(bundle=>{if(!active()){scene.discardPrepared(bundle);return null;}prepared=bundle;return bundle;});
 preparing.catch(()=>{});
 try{
  const data=full.get(id)||await acquire(id,'preview',p=>loadProgress(id,p*.82));
  if(!active()){scene.discardPrepared(await preparing);return;}
  gpu=await scene.uploadVolume(data,active,p=>loadProgress(id,.82+p*.16));prepared=await preparing;
  if(!active()){gpu?.forEach(t=>t.dispose());scene.discardPrepared(prepared);return;}
  await scene.captureTransition(420);if(!active()){gpu?.forEach(t=>t.dispose());scene.discardPrepared(prepared);return;}
  commitExperiment(e,data,gpu,prepared);gpu=prepared=null;loading('');
  if(data.quality!=='full'){
   const detailed=await acquire(id,'full');if(!active())return;
   while(active()&&performance.now()-lastInteraction<140)await new Promise(resolve=>setTimeout(resolve,40));if(!active())return;
   gpu=await scene.uploadVolume(detailed,active);if(!active()){gpu?.forEach(t=>t.dispose());return;}
   await scene.captureTransition(420);if(!active()){gpu?.forEach(t=>t.dispose());return;}showVolume(e,detailed,gpu);gpu=null;
  }
  scene.computing=false;$('app').dataset.fullFieldMs=(performance.now()-Number($('app').dataset.selectedAt)).toFixed(1);
  if(['double','phase-microscope'].includes(id))loadSlitPartner(generation);else warmSpectra(id,generation);
 }catch(error){gpu?.forEach(t=>t.dispose());scene.discardPrepared(prepared);if(active()){scene.computing=false;requestedId=null;markRequest(state.id,false);fail(error);}}
}
async function loadSlitPartner(generation){try{const data=await acquire(state.id==='phase-microscope'?'phase-microscope-bright':'double-right','full');if(generation!==selection)return;const gpu=await scene.uploadVolume(data,()=>generation===selection);if(generation!==selection){gpu?.forEach(t=>t.dispose());return;}scene.setAuxiliary(data,gpu);if(state.id==='phase-microscope'){scene.setComparison(state.comparison);for(const b of document.querySelectorAll('[data-contrast]'))b.disabled=false;}$('slit-phase').disabled=false;for(const b of document.querySelectorAll('[data-slit-phase]'))b.disabled=false;}catch(error){if(generation===selection)fail(error);}}
function setSlitPhase(value){state.slitPhase=Number(value)/1000*Math.PI;$('slit-phase').value=value;paintRange($('slit-phase'));tex($('slit-phase-value'),String.raw`\delta=${(state.slitPhase/Math.PI).toFixed(2)}\pi`);scene.setSlitPhase(state.slitPhase);probeDirty=true;}
function showVolume(e,data,gpu,prepared){volume=data;scene.setExperiment(e,data,gpu,prepared);$('app').dataset.loadMetrics=JSON.stringify(data.loadMetrics);scene.setDistance(state.z);scene.setSlitPhase(state.slitPhase);scene.setProbe(state.probe);probeDirty=true;}
const warmed=new Set();
function warmSpectrum(id){if(experiment(id).analytic||warmed.has(id))return;warmed.add(id);fetch(spectrumUrl(id),{priority:'low'}).then(r=>{if(r.ok)return r.arrayBuffer();warmed.delete(id);}).catch(()=>warmed.delete(id));}
function warmSpectra(id,generation){if(generation!==selection)return;const index=EXPERIMENTS.findIndex(e=>e.id===id);for(const e of EXPERIMENTS.slice(Math.max(0,index-1),index+3))warmSpectrum(e.id);}
gallery.addEventListener('pointerover',event=>{const button=event.target.closest('[data-experiment]');if(button)warmSpectrum(button.dataset.experiment);},{passive:true});
gallery.addEventListener('focusin',event=>{const button=event.target.closest('[data-experiment]');if(button)warmSpectrum(button.dataset.experiment);});


function setDistance(z,manual=true){
 if(manual)focusSeek=null;
 state.z=Math.max(.5,Math.min(experiment(state.id).zMax,z));$('distance').value=state.z;paintRange($('distance'));$('inspection-distance').value=state.z;paintRange($('inspection-distance'));
 if(manual){scene.cameraTween=null;scene.transitionStart=0;}scene.setDistance(state.z);labelDirty=probeDirty=true;if(manual)latestDrag=lastInteraction=performance.now();
 $('app').dataset.distance=state.z.toFixed(4);if(manual)$('app').dataset.cameraAtInput=scene.camera.position.toArray().join(',');
 if(['metamorphosis','phase-microscope'].includes(state.id))for(const button of $('focus-stops').children){const active=Math.abs(state.z-Number(button.dataset.focus))<1.8;if(button.getAttribute('aria-pressed')!==String(active))button.setAttribute('aria-pressed',String(active));}
}
function configureInteraction(e){const c=e.interaction,kind=c?.kind;$('experiment-control').hidden=!['parameter','cycle'].includes(kind);$('comparison-control').hidden=kind!=='comparison';$('absorption-meter').hidden=e.id!=='absorber';document.querySelector('.distance-control').dataset.secondary=String(!!kind&&kind!=='distance');$('inspection-setting').hidden=!kind||kind==='distance';$('inspection-distance').max=e.zMax;$('inspection-distance').value=state.z;paintRange($('inspection-distance'));
 const input=$('experiment-parameter');if(kind==='parameter'){const sign=c.sliderSign??1;input.min=sign>0?c.min:-c.max;input.max=sign>0?c.max:-c.min;input.step=c.step;$('experiment-control-label').textContent=c.label;input.setAttribute('aria-label',c.label);setParameter(c.initial,false);}else if(kind==='cycle'){input.min=0;input.max=2*Math.PI;input.step=.005;$('experiment-control-label').textContent='Optical cycle';input.setAttribute('aria-label','Optical cycle');}
 for(const b of document.querySelectorAll('[data-contrast]')){b.disabled=true;b.setAttribute('aria-pressed',String(b.dataset.contrast==='0'));}
 $('detector-handle').title=e.id==='michelson'?'Move delay mirror':e.id==='grin'?'Move launch position':'Move detector';$('detector-handle').setAttribute('aria-label',e.id==='michelson'?'Move delay mirror':e.id==='grin'?'Move launch position':'Drag detector');scene.updatePreviewRect();
}
function setParameter(value,manual=true){const c=experiment(state.id).interaction;if(c?.kind!=='parameter')return;state.parameter=Math.max(c.min,Math.min(c.max,Number(value)));scene.setExperimentParameter(state.parameter);$('experiment-parameter').value=state.parameter*(c.sliderSign??1);paintRange($('experiment-parameter'));if(manual){state.sweeping=false;updateSweep();lastInteraction=performance.now();}labelDirty=probeDirty=true;if(state.id==='absorber'){const a=absorbedFraction(state.parameter);$('absorption-meter').style.setProperty('--absorption',a);$('absorbed-value').textContent=Math.round(a*100)+'%';}}
function setComparison(value,manual=true){if(!scene.auxiliary)return;state.comparison=Number(value);scene.queueComparison(state.comparison);for(const b of document.querySelectorAll('[data-contrast]'))b.setAttribute('aria-pressed',String(Number(b.dataset.contrast)===state.comparison));if(manual){state.sweeping=false;updateSweep();}probeDirty=true;}
$('experiment-parameter').addEventListener('input',event=>{if(experiment(state.id).interaction?.kind==='cycle'){state.phase=Number(event.target.value);state.playing=false;updatePlay();updateSweep();labelDirty=probeDirty=true;}else setParameter(Number(event.target.value)*(experiment(state.id).interaction?.sliderSign??1));});
$('inspection-distance').addEventListener('input',event=>{state.sweeping=false;updateSweep();setDistance(Number(event.target.value));});
for(const b of document.querySelectorAll('[data-contrast]'))b.addEventListener('click',()=>setComparison(b.dataset.contrast));
if(scene)scene.onParameter=value=>setParameter(value);
function updateDistanceLabel(){
 const kind=experiment(state.id).interaction?.kind;if(kind==='parameter')tex($('experiment-value'),state.id==='absorber'?String.raw`\delta=${(state.parameter/Math.PI).toFixed(2)}\pi`:String.raw`${state.id==='michelson'?String.raw`\Delta z_{\rm m}`:'x_0'}=${(state.parameter*(experiment(state.id).interaction.sliderSign??1)).toFixed(2)}\lambda`);else if(kind==='cycle')tex($('experiment-value'),String.raw`\omega t=${(state.phase/Math.PI).toFixed(2)}\pi`);
tex($('distance-value'),String.raw`z=${state.z.toFixed(1)}\lambda`);tex($('physical-distance'),String.raw`${(state.z*.532).toFixed(2)}\,\mu\mathrm m`);$('distance').setAttribute('aria-valuetext',`${state.z.toFixed(1)} wavelengths`);labelDirty=false;}
function setProbe(point){if(point&&state.id==='circulator'&&Math.abs(point.y)>experiment(state.id).viewHeight)point=null;state.probe=point;scene?.setProbe(point);$('probe-readout').hidden=!point;$('clear-probe').hidden=!point;scene?.updatePreviewRect();probeDirty=true;}
const probeSample=new Float32Array(10);
function number(n){if(Math.abs(n)<1e-7)return '0';if(Math.abs(n)<.001){const [a,b]=n.toExponential(1).split('e');return `${a}\\!\\times\\!10^{${Number(b)}}`;}return n.toFixed(3);}
function updateProbe(){
 if(!state.probe||!volume)return;
 sampleField(volume,state.probe.x,state.probe.y,state.z,probeSample);if(scene.auxiliary&&state.id==='phase-microscope'){const aux=sampleField(scene.auxiliary,state.probe.x,state.probe.y,state.z);for(let c=0;c<10;c++)probeSample[c]+=state.comparison*aux[c];}if(scene.auxiliary&&state.id==='double')mixSlitPhase(probeSample,sampleField(scene.auxiliary,state.probe.x,state.probe.y,state.z),state.slitPhase);const phase=TAU*state.z-state.phase,c=Math.cos(phase),s=Math.sin(phase),real=i=>probeSample[i]*c-probeSample[i+1]*s;
 tex($('probe-coordinates'),String.raw`(x,y)=(${state.probe.x.toFixed(1)},${state.probe.y.toFixed(1)})\lambda`);
 tex($('probe-electric'),String.raw`\frac{\mathbf E}{E_0}=\bigl(0,\,${number(real(0))},\,${number(real(2))}\bigr)`);
 tex($('probe-magnetic'),String.raw`\frac{c\mathbf B}{E_0}=\bigl(${number(real(4))},\,${number(real(6))},\,${number(real(8))}\bigr)`);
 tex($('probe-flux'),String.raw`\langle S_z\rangle/I_0=${number(normalizedFlux(probeSample))}`);probeDirty=false;
}
let detailsDirty=true;function updateDetails(){detailsDirty=false;const e=experiment(state.id);showElement(e,tex);$('equation-title').textContent=e.name;$('experiment-description').textContent=e.description;tex($('boundary-equation'),e.formula,true);tex($('parameter-equation'),e.parameters,true);$('spectral-model-info').hidden=!!e.analytic;$('native-model-info').hidden=!e.analytic||!!e.bench;$('bench-model-info').hidden=!e.bench;}
function updatePlay(){const label=state.playing?'Pause optical cycle':'Play optical cycle';$('play').setAttribute('aria-label',label);$('play').title=label;$('play-path').setAttribute('d',state.playing?'M7 4v12m6-12v12':'M6 3l10 7-10 7z');}
function togglePlay(){state.playing=!state.playing;updatePlay();updateSweep();}
$('play').addEventListener('click',togglePlay);$('reset').addEventListener('click',()=>scene?.resetView(false));
$('distance').addEventListener('input',e=>{state.sweeping=false;updateSweep();setDistance(Number(e.target.value));});
$('slit-phase').addEventListener('input',e=>setSlitPhase(e.target.value));for(const b of document.querySelectorAll('[data-slit-phase]'))b.addEventListener('click',()=>setSlitPhase(b.dataset.slitPhase));
function updateSweep(){const kind=experiment(state.id).interaction?.kind,active=kind==='cycle'?state.playing:state.sweeping,action=kind==='parameter'?'experiment motion':kind==='cycle'?'optical cycle':kind==='comparison'?'contrast comparison':'detector scan',label=(active?'Pause ':'Play ')+action;$('sweep').setAttribute('aria-pressed',String(active));$('sweep').setAttribute('aria-label',label);$('sweep').title=label;$('sweep-path').setAttribute('d',active?'M7 4v12m6-12v12':'M6 3l10 7-10 7z');}
function toggleSweep(){focusSeek=null;if(experiment(state.id).interaction?.kind==='cycle'){state.playing=!state.playing;updatePlay();}else state.sweeping=!state.sweeping;updateSweep();}
$('sweep').addEventListener('click',toggleSweep);
$('stage').addEventListener('pointermove',e=>{if(e.buttons)lastInteraction=performance.now();});
$('clear-probe').addEventListener('click',()=>setProbe(null));
let probing=false;
$('detector-image').addEventListener('wheel',event=>{event.preventDefault();settings.setDetectorZoom(appearance.detectorZoom*Math.exp(-event.deltaY*.002));},{passive:false});
$('detector-image').addEventListener('dblclick',()=>settings.setDetectorZoom(1));
function probeFromPointer(e){const r=$('detector-image').getBoundingClientRect(),half=experiment(state.id).half/appearance.detectorZoom;setProbe({x:Math.max(-half,Math.min(half,((e.clientX-r.left)/r.width*2-1)*half)),y:Math.max(-half,Math.min(half,(1-(e.clientY-r.top)/r.height*2)*half))});}
$('detector-image').addEventListener('pointerdown',e=>{probing=true;e.currentTarget.setPointerCapture(e.pointerId);probeFromPointer(e);});$('detector-image').addEventListener('pointermove',e=>{if(probing)probeFromPointer(e);});$('detector-image').addEventListener('pointerup',()=>probing=false);$('detector-image').addEventListener('pointercancel',()=>probing=false);
$('detector-image').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const half=experiment(state.id).half/appearance.detectorZoom,p=state.probe||{x:0,y:0},step=half/30;setProbe({x:Math.max(-half,Math.min(half,p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0))),y:Math.max(-half,Math.min(half,p.y+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0)))});});
function openDetails(){warmDetails();if(detailsDirty)updateDetails();const dialog=$('equations');dialog.getAnimations().forEach(a=>a.cancel());dialog.showModal();dialog.animate([{opacity:0},{opacity:1}],{duration:220,easing:'ease-out'});}function closeDetails(){const dialog=$('equations');dialog.getAnimations().forEach(a=>a.cancel());dialog.animate([{opacity:1},{opacity:0}],{duration:160,easing:'ease-out'}).finished.then(()=>dialog.close()).catch(()=>{});}$('details').addEventListener('click',openDetails);$('optic-label').addEventListener('click',openDetails);$('close-details').addEventListener('click',closeDetails);$('equations').addEventListener('cancel',event=>{event.preventDefault();closeDetails();});
$('equations').addEventListener('click',e=>{if(e.target!==$('equations'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDetails();});
$('phase').addEventListener('input',e=>{state.phase=Number(e.target.value)/1000*TAU;state.playing=false;updatePlay();updateSweep();probeDirty=true;});
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select,button,[tabindex]')||$('equations').open)return;if(e.code==='Space'){e.preventDefault();toggleSweep();}if(e.key.toLowerCase()==='r')scene?.resetView(false);const item=EXPERIMENTS[Number(e.key)-1];if(item)selectExperiment(item.id);});
document.addEventListener('keydown',e=>{if(!thumbnail||!['ArrowRight','ArrowLeft'].includes(e.key))return;e.preventDefault();const index=EXPERIMENTS.findIndex(x=>x.id===state.id),next=(index+(e.key==='ArrowRight'?1:-1)+EXPERIMENTS.length)%EXPERIMENTS.length;selectExperiment(EXPERIMENTS[next].id);});
window.addEventListener('hashchange',()=>{const id=setupFromUrl();linkSetup(id,true);if(id!==requestedId)selectExperiment(id,true);});
let last=performance.now(),lastRender=0,lastProbe=0,lastMetric=0,lastPhaseLabel=0,lastDistanceLabel=0,frameTimes=[];
function animate(now){
 requestAnimationFrame(animate);
 const elapsed=now-last,dt=Math.min(.08,elapsed/1000);last=now;
 if(!document.hidden&&scene){
  if(focusSeek&&volume){const t=Math.min(1,(now-focusSeek.start)/550),ease=t*t*(3-2*t);setDistance(focusSeek.from+(focusSeek.to-focusSeek.from)*ease,false);if(t===1)focusSeek=null;}
  const interaction=experiment(state.id).interaction;
  if(state.sweeping&&volume&&interaction?.kind==='parameter'){const c=interaction;let value=state.parameter+dt*(c.max-c.min)/c.period*state.sweepDirection;if(value>=c.max||value<=c.min)state.sweepDirection*=-1;setParameter(value,false);}
  if(state.sweeping&&volume&&interaction?.kind==='comparison'){scanHold+=dt;if(scanHold>5){scanHold=0;setComparison(1-state.comparison,false);}}
  if(state.sweeping&&volume&&(!interaction||interaction.kind==='distance')){const e=experiment(state.id),[near,far]=e.scan||[.5,e.zMax],here=Math.max(near,Math.min(far,state.z));if(scanHold>0)scanHold=Math.max(0,scanHold-dt);else{
   const stops=e.id==='metamorphosis'?IMAGE_DEPTHS:e.id==='phase-microscope'?[2,20,40,60,80]:[];const stop=state.sweepDirection>0?stops.find(z=>z>here+.01):[...stops].reverse().find(z=>z<here-.01);
   const speed=stop===undefined?1:.3+.7*Math.min(1,Math.abs(stop-here)/4);let z=here+dt*(far-near)/(e.id==='phase-microscope'?32:12)*speed*state.sweepDirection;
   if(stop!==undefined&&(z-stop)*state.sweepDirection>=0){z=stop;scanHold=1.8;}
   if(z>=far||z<=near)state.sweepDirection*=-1;setDistance(Math.max(near,Math.min(far,z)),false);
  }}
  if(state.playing)state.phase=(state.phase+TAU*dt*appearance.speed)%TAU;if(interaction?.kind==='cycle'){labelDirty=true;$('experiment-parameter').value=state.phase;paintRange($('experiment-parameter'));}
  if(labelDirty&&now-lastDistanceLabel>90){updateDistanceLabel();lastDistanceLabel=now;}if(state.probe&&(probeDirty||now-lastProbe>130)){updateProbe();lastProbe=now;}
  if($('settings-toggle').getAttribute('aria-expanded')==='true'&&!$('vector-settings').hidden){$('phase').value=Math.round(state.phase/TAU*1000);paintRange($('phase'));if(now-lastPhaseLabel>125){tex($('phase-value'),String.raw`\omega t=${(state.phase/Math.PI).toFixed(2)}\pi`);lastPhaseLabel=now;}}
  // Leave GPU headroom for input/compositing, without reducing spatial quality.
  const frameBudget=Math.max(scene.computing?15.5:7.5,(scene.gpuFrameMs||0)*1.25);
  if(now-lastRender<frameBudget)return;const renderInterval=now-lastRender;lastRender=now;scene.render(state.phase,now);
  if(volume&&!firstFrame){firstFrame=true;$('app').dataset.firstFieldMs=(performance.now()-Number($('app').dataset.selectedAt||started)).toFixed(1);}
  if(latestDrag){$('app').dataset.detectorLatencyMs=(performance.now()-latestDrag).toFixed(2);$('app').dataset.cameraAfterInput=scene.camera.position.toArray().join(',');latestDrag=0;}
  frameTimes.push(renderInterval);if(frameTimes.length>60)frameTimes.shift();
  if(now-lastMetric>1000){const sorted=[...frameTimes].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];$('app').dataset.frameMs=median.toFixed(1);lastMetric=now;}
 }
}

if(new URLSearchParams(location.search).has('profile')){const stalls=[];new PerformanceObserver(list=>{for(const item of list.getEntries())stalls.push({at:Math.round(item.startTime),ms:Math.round(item.duration)});$('app').dataset.longTasks=JSON.stringify(stalls.slice(-50));}).observe({type:'longtask',buffered:true});}
document.addEventListener('visibilitychange',()=>{last=performance.now();});
updatePlay();updateDistanceLabel();tex($('phase-value'),String.raw`\omega t=0`);if(scene){selectExperiment(initial);requestAnimationFrame(animate);}

