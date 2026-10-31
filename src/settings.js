import {appearanceFor} from './display-presets.js';
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
 let current=initial;const options=appearanceFor(initial),adjusted=new Set();
 // Remove only this application's legacy saved display preferences.
 try{for(const key of Object.keys(localStorage))if(/^optics-appearance-v\d+$/.test(key))localStorage.removeItem(key);}catch{}
 options.density=Math.round(options.density);
 const panel=document.getElementById('settings-panel'),button=document.getElementById('settings-toggle'),app=document.getElementById('app');
 function open(value){panel.inert=!value;panel.setAttribute('aria-hidden',String(!value));button.setAttribute('aria-expanded',String(value));app.classList.toggle('settings-open',value);}
 button.addEventListener('click',()=>open(button.getAttribute('aria-expanded')!=='true'));
 
 document.getElementById('close-settings').addEventListener('click',()=>{open(false);button.focus({preventScroll:true});});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.getElementById('equations').open&&button.getAttribute('aria-expanded')==='true'){open(false);button.focus({preventScroll:true});}});
 function reflect(changed){
  document.getElementById('phase-reference-setting').hidden=options.display!=='phase';
  document.getElementById('field-sampling-setting').hidden=options.display!=='field';
  document.querySelector('[data-option=display][data-value=phase]').title=options.phaseReference==='relative'?'Phase relative to the incident plane wave':'Instantaneous optical phase';
  for(const el of document.querySelectorAll('[data-option]'))if(!changed||changed===el.dataset.option)el.setAttribute('aria-pressed',String(options[el.dataset.option]===el.dataset.value));
  if(!changed||changed==='vectors')for(const el of document.querySelectorAll('[data-vector-toggle]'))el.setAttribute('aria-pressed',String(options.vectors==='both'||options.vectors===el.dataset.vectorToggle));
  for(const el of panel.querySelectorAll('[data-setting]')){const key=el.dataset.setting;if(changed&&key!==changed)continue;if(el.type==='checkbox')el.checked=options[key];else{if(Number(el.value)!==options[key])el.value=options[key];paintRange(el);}}
  for(const el of panel.querySelectorAll('[data-setting-value]')){if(changed&&el.dataset.settingValue!==changed)continue;const key=el.dataset.settingValue,v=options[key];tex(el,key==='gain'?`${v.toFixed(2)}\\lambda`:key==='speed'?`${(1/v).toFixed(1)}\\,\\mathrm{s/cycle}`:key==='density'?String(v):(key==='exposure'||key==='detectorZoom')?`${v.toFixed(2)}\\times`:v.toFixed(key==='threshold'?3:2));}
  document.getElementById('vector-scale-note').textContent=options.vectorScale==='readable'?'A shared local scale reveals weak fields. Directions and relative electric–magnetic lengths are preserved.':'Arrow lengths are proportional to instantaneous field amplitude, with the same scale everywhere.';
  tex(document.getElementById('detector-quantity'),{field:options.planeSampling==='average'?String.raw`E_{y,\mathrm{rms}}/E_0`:String.raw`E_y/E_0`,energy:String.raw`\langle S_z\rangle`,phase:options.phaseReference==='relative'?String.raw`\arg(\widetilde E_y e^{-ikz})`:String.raw`\arg\widetilde E_y-\omega t`}[options.display]);
  document.getElementById('detector-image').setAttribute('aria-label',`${{field:options.planeSampling==='average'?'RMS electric field':'Instantaneous electric field',energy:'Detector intensity',phase:'Optical phase'}[options.display]}. Click to inspect a point.`);
  app.dataset.palette=options.palette;app.dataset.settings=JSON.stringify(options);scene.applyAppearance(options);
 }
 let scheduled=0,pendingKey;
 const save=(changed,continuous=false)=>{if(changed)adjusted.add(changed);if(!continuous){const key=scheduled&&pendingKey!==changed?undefined:changed;cancelAnimationFrame(scheduled);scheduled=0;reflect(key);return;}pendingKey=scheduled&&pendingKey!==changed?undefined:changed;if(!scheduled)scheduled=requestAnimationFrame(()=>{scheduled=0;reflect(pendingKey);});};
 for(const el of document.querySelectorAll('[data-vector-toggle]'))el.addEventListener('click',()=>{let electric=options.vectors==='both'||options.vectors==='electric',magnetic=options.vectors==='both'||options.vectors==='magnetic';if(el.dataset.vectorToggle==='electric')electric=!electric;else magnetic=!magnetic;options.vectors=electric?(magnetic?'both':'electric'):(magnetic?'magnetic':'none');save('vectors');});
 for(const el of document.querySelectorAll('[data-option]'))el.addEventListener('click',()=>{options[el.dataset.option]=el.dataset.value;save(el.dataset.option);});
 for(const el of panel.querySelectorAll('[data-setting]'))el.addEventListener('input',()=>{const key=el.dataset.setting;options[key]=el.type==='checkbox'?el.checked:Number(el.value);save(key,el.type==='range');});
 for(const el of document.querySelectorAll('input[type=range]'))comfortableRange(el);
 document.getElementById('reset-appearance').addEventListener('click',()=>{adjusted.clear();Object.assign(options,appearanceFor(current));reflect();});
 for(const button of panel.querySelectorAll('[data-camera]'))button.addEventListener('click',()=>scene.resetView(false,button.dataset.camera));
 const tabs=[...panel.querySelectorAll('[role=tab]')];
 function selectTab(tab){if(tab.getAttribute('aria-selected')==='true')return;for(const item of tabs){const active=item===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;const content=document.getElementById(item.getAttribute('aria-controls'));content.hidden=!active;if(active){content.getAnimations().forEach(a=>a.cancel());content.animate([{opacity:.35},{opacity:1}],{duration:160,easing:'ease-out'});}}panel.querySelector('.settings-content').scrollTop=0;}
 for(const tab of tabs){tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[next]);tabs[next].focus();});}
 reflect();return{options,setDetectorZoom(value){options.detectorZoom=Math.round(Math.max(1,Math.min(5,value))*10)/10;save('detectorZoom');},useExperiment(id){current=id;for(const[key,value]of Object.entries(appearanceFor(id)))if(!adjusted.has(key))options[key]=value;reflect();},setPalette(palette){options.palette=palette;adjusted.add('palette');reflect();}};
}
export function showElement(e,tex){
 const canvas=document.getElementById('element-preview'),phasePlate=e.kind==='phase'||e.kind==='axicon',ctx=canvas.getContext('2d');canvas.dataset.experiment=e.id;ctx.fillStyle='#9dd8e3';ctx.fillRect(0,0,200,200);let image=maskImages.get(e.id);const draw=()=>{if(canvas.dataset.experiment===e.id)ctx.drawImage(image,0,0,200,200);};if(image?.complete)draw();else{image=new Image();maskImages.set(e.id,image);image.onload=draw;image.src='./assets/masks/'+e.id+'.png';}
 document.getElementById('element-kind').textContent=e.opticLabel||(e.kind==='beams'?'Three coherent beams':['bunny','rabbit','hologram'].includes(e.id)?'Ideal complex-amplitude display':phasePlate?'Phase relief + attenuator':'Transmission aperture');
 const legend=document.getElementById('element-legend');legend.replaceChildren();
 if(phasePlate){const key=document.createElement('div');key.className='phase-key';legend.append(key);const label=document.createElement('span');tex(label,String.raw`\arg T:\ -\pi\ \cdots\ \pi`);legend.append(label);}
 else legend.textContent='Bright openings transmit the incoming field.';
 document.getElementById('setup-note').textContent=e.description;
}
