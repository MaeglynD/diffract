// Display lighting only. Floor colours are display RGB in the tabletop shader.
export const THEMES=[
 {name:'Silver studio',background:0x10151b,panel:'25 32 39',edge:'193 206 213',studio:1,
  sky:0xe7d8c5,ground:0x342f3d,fill:.82,key:0xffe4bf,keyPower:2.35,keyPosition:[-42,48,27],rim:0xb3d6ff,rimPower:3.55,rimPosition:[32,19,-52],
  exposure:.99,opticTint:0xf3e2cc,opticFill:1.18,floor:[0x161a1e,0x3b4248]},
 {name:'Daylight',light:true,palette:'amber',background:0xbac3c5,backlight:0xe0e4df,panel:'220 227 226',edge:'59 83 91',studio:1,
  sky:0xe7eeed,ground:0x28363e,fill:.78,key:0xfff0df,keyPower:2.6,keyPosition:[-46,40,21],rim:0xd9f3ff,rimPower:2.05,rimPosition:[30,16,-42],
  exposure:.84,reflections:3.3,contact:.46,opticTint:0xe1e8de,opticFill:.95,floor:[0xa5b2b7,0xd0d8d8]},
 {name:'Carbon',palette:'silver',background:0x07090c,backlight:0x141a20,panel:'15 18 23',edge:'173 186 201',studio:1,
  sky:0xbdc9dd,ground:0x10161c,fill:.48,key:0xe1e7f3,keyPower:2.3,keyPosition:[-27,44,48],rim:0xfbe4d2,rimPower:3.9,rimPosition:[32,18,-46],
  exposure:.86,reflections:3.7,opticTint:0xd3deea,opticFill:1.03,floor:[0x0b0e12,0x242b33]},
 {name:'Verdigris',background:0x0b201e,panel:'18 45 40',edge:'159 207 181',studio:1,
  sky:0xcde7d8,ground:0x193a36,fill:.9,key:0xffecc6,keyPower:2.55,keyPosition:[-36,37,44],rim:0x91f1cc,rimPower:3.25,rimPosition:[24,14,-47],
  exposure:.91,opticTint:0xd6f5e4,opticFill:1.12,floor:[0x122b28,0x34534b]},
 {name:'Deepwater',background:0x071119,panel:'16 31 41',edge:'150 198 215',studio:0,
  sky:0xc8e9ff,ground:0x172431,fill:2.2,key:0xffead9,keyPower:3.3,keyPosition:[-30,45,35],rim:0x71c8ff,rimPower:2.2,rimPosition:[35,12,-32],
  exposure:.85,opticTint:0xffffff,opticFill:1}
];

export function setupThemeCycle(scene,settings) {
  let index=0, revision=0;
  const choices=document.querySelector('.lighting-choices');
  for(const [i,theme] of THEMES.entries()){
    const button=document.createElement('button');
    button.type='button';
    button.textContent=theme.name;
    button.style.setProperty('--swatch','#'+theme.background.toString(16).padStart(6,'0'));
    button.addEventListener('click',()=>{if(index!==i){index=i;apply(true);}});
    choices.append(button);
  }
  async function apply(animate=false) {
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
    settings.setLightingPalette(theme.palette??'cyan');
    scene.applyTheme(theme,animate);
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
