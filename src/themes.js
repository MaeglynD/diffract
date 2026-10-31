// Display lighting only. Floor colours are display RGB in the tabletop shader.
export const THEMES=[
 {name:'Silver studio',background:0x10151b,panel:'25 32 39',edge:'193 206 213',studio:1,
  sky:0xe7d8c5,ground:0x342f3d,fill:.82,key:0xffe4bf,keyPower:2.35,keyPosition:[-42,48,27],rim:0xb3d6ff,rimPower:3.55,rimPosition:[32,19,-52],
  exposure:.99,opticTint:0xf3e2cc,opticFill:1.18,floor:[0x161a1e,0x3b4248]},
 {name:'Daylight',light:true,background:0xe1e7e8,panel:'246 249 249',edge:'59 92 104',studio:1,
  sky:0xf4faff,ground:0x596a72,fill:1.28,key:0xfff4df,keyPower:1.95,keyPosition:[-36,56,23],rim:0xc8efff,rimPower:2.35,rimPosition:[38,17,-43],
  exposure:.88,opticTint:0xccedf5,opticFill:1.02,floor:[0xc3cfd3,0xe6eaea]},
 {name:'Verdigris',background:0x0b201e,panel:'18 45 40',edge:'159 207 181',studio:1,
  sky:0xcde7d8,ground:0x193a36,fill:.9,key:0xffecc6,keyPower:2.55,keyPosition:[-36,37,44],rim:0x91f1cc,rimPower:3.25,rimPosition:[24,14,-47],
  exposure:.91,opticTint:0xd6f5e4,opticFill:1.12,floor:[0x122b28,0x34534b]},
 {name:'Deepwater',background:0x071119,panel:'16 31 41',edge:'150 198 215',studio:0,
  sky:0xc8e9ff,ground:0x172431,fill:2.2,key:0xffead9,keyPower:3.3,keyPosition:[-30,45,35],rim:0x71c8ff,rimPower:2.2,rimPosition:[35,12,-32],
  exposure:.85,opticTint:0xffffff,opticFill:1}
];

export function setupThemeCycle(scene) {
  let index=0, revision=0, timer;
  const toast=document.getElementById('theme-toast');
  const choices=document.querySelector('.lighting-choices');
  for(const [i,theme] of THEMES.entries()){
    const button=document.createElement('button');
    button.type='button';
    button.textContent=theme.name;
    button.style.setProperty('--swatch','#'+theme.background.toString(16).padStart(6,'0'));
    button.addEventListener('click',()=>{if(index!==i){index=i;apply(true);}});
    choices.append(button);
  }
  async function apply(announce=false) {
    const theme=THEMES[index], ticket=++revision;
    const root=document.documentElement;
    const background='#'+theme.background.toString(16).padStart(6,'0');
    root.style.setProperty('--scene-bg',background);
    root.style.setProperty('--panel-rgb',theme.panel);
    root.style.setProperty('--edge-rgb',theme.edge);
    document.querySelector('meta[name="theme-color"]').content=background;
    const app=document.getElementById('app');
    app.dataset.theme=theme.name;
    app.toggleAttribute('data-studio',!!theme.studio);
    for(const button of choices.children) button.setAttribute('aria-pressed',String(button===choices.children[index]));
    root.style.colorScheme=theme.light?'light':'dark';
    if(theme.studio) await scene.prepareStudio();
    if(ticket!==revision) return;
    scene.applyTheme(theme,announce);
    if(announce) {
      toast.textContent=theme.name;
      toast.classList.add('visible');
      clearTimeout(timer);
      timer=setTimeout(()=>toast.classList.remove('visible'),1600);
    }
  }
  document.addEventListener('keydown',event=>{
    if(event.key.toLowerCase()!=='t'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||
       event.target.closest('[contenteditable=true],textarea,input:not([type=range]):not([type=checkbox])')) return;
    event.preventDefault();
    index=(index+(event.shiftKey?-1:1)+THEMES.length)%THEMES.length;
    apply(true);
  });
  apply();
}
