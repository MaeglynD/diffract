import {appearanceFor} from './display-presets.js';
import {experiment} from './experiments.js';
const maskImages=new Map();
export function paintRange(el){const n=(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min));el.style.setProperty('--fill',`${Math.max(0,Math.min(1,n))*100}%`);}
function comfortableRange(el){
 let dragging=false,rect;
 const update=event=>{const r=rect||el.getBoundingClientRect(),lo=Number(el.min),hi=Number(el.max),step=Number(el.step)||1,t=Math.max(0,Math.min(1,(event.clientX-r.left-7)/(r.width-14)));el.value=String(Math.max(lo,Math.min(hi,lo+Math.round(t*(hi-lo)/step)*step)));el.dispatchEvent(new Event('input',{bubbles:true}));};
 el.addEventListener('pointerdown',event=>{if(event.button!==0||el.disabled)return;event.preventDefault();rect=el.getBoundingClientRect();el.setPointerCapture(event.pointerId);dragging=true;update(event);});
 el.addEventListener('pointermove',event=>{if(dragging)update(event);});
 for(const name of['pointerup','pointercancel','lostpointercapture'])el.addEventListener(name,()=>{dragging=false;});
 el.addEventListener('input',()=>paintRange(el));paintRange(el);
}
export function setupSettings(scene,tex,initial='bunny'){
 let current=initial, lightingPalette='cyan', palettePicked=false;
 const options=appearanceFor(initial);
 function restoreDefaults(){
  palettePicked=false;
  Object.assign(options,appearanceFor(current),{palette:lightingPalette});
 }
 // Remove only this application's legacy saved display preferences.
 try{for(const key of Object.keys(localStorage))if(/^optics-appearance-v\d+$/.test(key))localStorage.removeItem(key);}catch{}
 options.density=Math.round(options.density);
 const panel=document.getElementById('settings-panel'),button=document.getElementById('settings-toggle'),app=document.getElementById('app');
 function open(value){panel.inert=!value;panel.setAttribute('aria-hidden',String(!value));button.setAttribute('aria-expanded',String(value));app.classList.toggle('settings-open',value);}
 button.addEventListener('click',()=>open(button.getAttribute('aria-expanded')!=='true'));
 
 document.getElementById('close-settings').addEventListener('click',()=>{open(false);button.focus({preventScroll:true});});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.getElementById('equations').open&&button.getAttribute('aria-expanded')==='true'){open(false);button.focus({preventScroll:true});}});
 function reflect(changed,apply=true){
  document.getElementById('phase-reference-setting').hidden=options.display!=='phase';
  document.getElementById('field-sampling-setting').hidden=options.display!=='field';
  document.querySelector('[data-option=display][data-value=phase]').title=options.phaseReference==='relative'?'Phase relative to a vacuum plane wave':'Instantaneous optical phase';
  for(const el of document.querySelectorAll('[data-option]'))if(!changed||changed===el.dataset.option){const active=options[el.dataset.option]===el.dataset.value;el.setAttribute('aria-pressed',String(active));if(el.getAttribute('role')==='tab'){el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;if(active)document.getElementById('detector-view').setAttribute('aria-labelledby',el.id);}}
  if(!changed||changed==='vectors')for(const el of document.querySelectorAll('[data-vector-toggle]'))el.setAttribute('aria-pressed',String(options.vectors==='both'||options.vectors===el.dataset.vectorToggle));
  for(const el of panel.querySelectorAll('[data-setting]')){const key=el.dataset.setting;if(changed&&key!==changed)continue;if(el.type==='checkbox')el.checked=options[key];else{if(Number(el.value)!==options[key])el.value=options[key];paintRange(el);}}
  for(const el of panel.querySelectorAll('[data-setting-value]')){if(changed&&el.dataset.settingValue!==changed)continue;const key=el.dataset.settingValue,v=options[key];tex(el,key==='gain'?`${v.toFixed(2)}\\lambda`:key==='speed'?`${(1/v).toFixed(1)}\\,\\mathrm{s/cycle}`:key==='density'?String(v):(key==='exposure'||key==='detectorZoom')?`${v.toFixed(2)}\\times`:v.toFixed(key==='threshold'?3:2));}
  document.getElementById('vector-scale-note').textContent=options.vectorScale==='readable'?'A shared local scale reveals weak fields. Directions and relative electric–magnetic lengths are preserved.':'Arrow lengths are proportional to instantaneous field amplitude, with the same scale everywhere.';
  tex(document.getElementById('detector-quantity'),{field:options.planeSampling==='average'?String.raw`E_{y,\mathrm{rms}}/E_0`:String.raw`E_y/E_0`,energy:experiment(current).energyDensity?String.raw`\langle u\rangle/u_0`:String.raw`\langle S_z\rangle`,phase:options.phaseReference==='relative'?String.raw`\arg(\widetilde E_y e^{-ikz})`:String.raw`\arg\widetilde E_y-\omega t`}[options.display]);
  document.getElementById('detector-image').setAttribute('aria-label',`${{field:options.planeSampling==='average'?'RMS electric field':'Instantaneous electric field',energy:experiment(current).energyDensity?'Mean energy density':'Detector intensity',phase:'Optical phase'}[options.display]}. Click to inspect a point.`);
  app.dataset.palette=options.palette;app.dataset.settings=JSON.stringify(options);if(apply)scene.applyAppearance(options);
 }
 let scheduled=0,pendingKey;
 const save=(changed,continuous=false)=>{if(!continuous){const key=scheduled&&pendingKey!==changed?undefined:changed;cancelAnimationFrame(scheduled);scheduled=0;reflect(key,false);if(['display','palette','planeSampling','phaseReference'].includes(changed))scene.transitionAppearance(options);else scene.applyAppearance(options);return;}pendingKey=scheduled&&pendingKey!==changed?undefined:changed;if(!scheduled)scheduled=requestAnimationFrame(()=>{scheduled=0;reflect(pendingKey);});};
 for(const el of document.querySelectorAll('[data-vector-toggle]'))el.addEventListener('click',()=>{let electric=options.vectors==='both'||options.vectors==='electric',magnetic=options.vectors==='both'||options.vectors==='magnetic';if(el.dataset.vectorToggle==='electric')electric=!electric;else magnetic=!magnetic;options.vectors=electric?(magnetic?'both':'electric'):(magnetic?'magnetic':'none');save('vectors');});
 for(const el of document.querySelectorAll('[data-option]'))el.addEventListener('click',()=>{
  if(el.dataset.option==='palette') palettePicked=true;
  options[el.dataset.option]=el.dataset.value;
  save(el.dataset.option);
 });
 const viewTabs=[...document.querySelectorAll('.view-modes [role=tab]')];for(const tab of viewTabs)tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=viewTabs.indexOf(tab),j=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;viewTabs[j].click();viewTabs[j].focus({preventScroll:true});});
 for(const el of panel.querySelectorAll('[data-setting]'))el.addEventListener('input',()=>{const key=el.dataset.setting;options[key]=el.type==='checkbox'?el.checked:Number(el.value);save(key,el.type==='range');});
 for(const el of document.querySelectorAll('input[type=range]'))comfortableRange(el);
 document.getElementById('reset-appearance').addEventListener('click',()=>{cancelAnimationFrame(scheduled);scheduled=0;restoreDefaults();reflect(undefined,false);scene.transitionAppearance(options);});
 for(const button of panel.querySelectorAll('[data-camera]'))button.addEventListener('click',()=>scene.resetView(false,button.dataset.camera));
 const tabs=[...panel.querySelectorAll('[role=tab]')];
 let tabChange=0;
 async function selectTab(tab){
  if(tab.getAttribute('aria-selected')==='true')return;const version=++tabChange;
  for(const item of tabs){const active=item===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;}
  const panes=tabs.map(item=>document.getElementById(item.getAttribute('aria-controls'))),previous=panes.find(p=>!p.hidden);
  for(const pane of panes)pane.getAnimations().forEach(a=>a.cancel());
  if(previous){try{await previous.animate([{opacity:1},{opacity:0}],{duration:80,easing:'ease-in',fill:'forwards'}).finished;}catch{}if(version!==tabChange)return;}
  for(const pane of panes){pane.hidden=pane.id!==tab.getAttribute('aria-controls');pane.getAnimations().forEach(a=>a.cancel());}
  const next=document.getElementById(tab.getAttribute('aria-controls'));next.animate([{opacity:0},{opacity:1}],{duration:180,easing:'ease-out'});panel.querySelector('.settings-content').scrollTop=0;
 }

 for(const tab of tabs){tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[next]);tabs[next].focus();});}
 reflect();
 return {
  options,
  setLightingPalette(palette){
   lightingPalette=palette;
   if(!palettePicked && options.palette!==palette){options.palette=palette;save('palette');}
  },
  setDetectorZoom(value){options.detectorZoom=Math.round(Math.max(1,Math.min(5,value))*10)/10;save('detectorZoom');},
  useExperiment(id){current=id;cancelAnimationFrame(scheduled);scheduled=0;restoreDefaults();reflect(undefined,false);scene.options={...options};}
 };
}
export function showElement(e,tex){
 const canvas=document.getElementById('element-preview'),phasePlate=e.kind==='phase'||e.kind==='axicon',ctx=canvas.getContext('2d');canvas.dataset.experiment=e.id;ctx.fillStyle=e.analytic?'#0b1821':'#9dd8e3';ctx.fillRect(0,0,200,200);let image=maskImages.get(e.id);const draw=()=>{if(canvas.dataset.experiment===e.id)ctx.drawImage(image,0,e.analytic?42.5:0,200,e.analytic?115:200);};if(image?.complete)draw();else{image=new Image();maskImages.set(e.id,image);image.onload=draw;image.src=e.analytic?'./assets/previews/'+e.id+'.svg':'./assets/masks/'+e.id+'.png';}
 document.getElementById('element-kind').textContent=e.opticLabel||(e.kind==='beams'?'Three coherent beams':['bunny','rabbit','hologram'].includes(e.id)?'Ideal complex-amplitude display':phasePlate?'Phase relief + attenuator':'Transmission aperture');
 const legend=document.getElementById('element-legend');legend.replaceChildren();
 if(phasePlate){const key=document.createElement('div');key.className='phase-key';legend.append(key);const label=document.createElement('span');tex(label,String.raw`\arg T:\ -\pi\ \cdots\ \pi`);legend.append(label);}
 else legend.textContent=e.id==='grin'?'The glass is a viewing cutaway of a continuous index gradient.':e.analytic?'The surfaces mark the boundaries used in the field calculation.':'Bright openings transmit the incoming field.';
 document.getElementById('setup-note').textContent=e.description;
}
