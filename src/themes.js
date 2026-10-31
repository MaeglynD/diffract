// Temporary art-direction trials. None of these values enter field propagation.
export const THEMES=[
 {name:'Deepwater',background:0x071119,panel:'16 31 41',edge:'150 198 215',palette:'cyan',sky:0xc8e9ff,ground:0x172431,fill:2.2,key:0xffead9,keyPower:3.3,keyPosition:[-30,45,35],rim:0x71c8ff,rimPower:2.2,rimPosition:[35,12,-32],exposure:.85,opticTint:0xffffff,opticFill:1},
 {name:'Obsidian',background:0x020303,panel:'14 18 20',edge:'190 205 208',palette:'cyan',sky:0xb8c5cb,ground:0x080b0c,fill:1.0,key:0xeaf5ff,keyPower:4.0,keyPosition:[-25,32,45],rim:0xb4dce8,rimPower:3.4,rimPosition:[15,25,-38],exposure:.8,opticTint:0xc6e0e7,opticFill:.82},
 {name:'Graphite',background:0x18191b,panel:'34 35 38',edge:'204 205 214',palette:'silver',sky:0xf1edf0,ground:0x303039,fill:2.1,key:0xfff5e8,keyPower:2.6,keyPosition:[-45,65,20],rim:0xb7c5d6,rimPower:1.6,rimPosition:[30,18,-32],exposure:.78,opticTint:0xe5dfe8,opticFill:1.1},
 {name:'Nocturne',background:0x060611,panel:'20 19 39',edge:'168 158 220',palette:'cyan',sky:0xc0bbef,ground:0x101027,fill:1.15,key:0xd7deff,keyPower:3.0,keyPosition:[-40,30,45],rim:0x9d78ff,rimPower:4.4,rimPosition:[35,22,-32],exposure:.8,opticTint:0xc7b6fa,opticFill:.92},
 {name:'Lamplight',background:0x0e0b08,panel:'34 27 22',edge:'216 182 145',palette:'amber',sky:0xe6d9c5,ground:0x231b14,fill:1.45,key:0xffd3a0,keyPower:3.4,keyPosition:[-35,45,40],rim:0x849cae,rimPower:2.3,rimPosition:[35,15,-35],exposure:.78,opticTint:0xffd8b0,opticFill:1.02}
];

export function setupThemeCycle(scene,settings){
 let index=0,timer,generation=0;const toast=document.getElementById('theme-toast');
 async function apply(announce=false){const theme=THEMES[index],root=document.documentElement,version=++generation;
  if(announce){await scene.captureTransition(440);if(version!==generation)return;}
  root.style.setProperty('--scene-bg','#'+theme.background.toString(16).padStart(6,'0'));
  root.style.setProperty('--panel-rgb',theme.panel);root.style.setProperty('--edge-rgb',theme.edge);
  document.getElementById('app').dataset.theme=theme.name;
  scene.applyTheme(theme,announce);if(announce)settings.setPalette(theme.palette);
  if(announce){toast.textContent=`${index+1} / ${THEMES.length} · ${theme.name}`;toast.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('visible'),2400);}
 }
 function cycle(back=false){index=(index+(back?-1:1)+THEMES.length)%THEMES.length;apply(true);}
 document.addEventListener('keydown',event=>{if(event.key.toLowerCase()!=='t'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('[contenteditable=true],textarea,input:not([type=range]):not([type=checkbox])'))return;event.preventDefault();cycle(event.shiftKey);});
 apply();
}
