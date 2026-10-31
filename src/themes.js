// Temporary art-direction trials. None of these values enter field propagation.
export const THEMES=[
 {name:'Deepwater',background:0x071119,panel:'16 31 41',edge:'150 198 215',studio:0,sky:0xc8e9ff,ground:0x172431,fill:2.2,key:0xffead9,keyPower:3.3,keyPosition:[-30,45,35],rim:0x71c8ff,rimPower:2.2,rimPosition:[35,12,-32],exposure:.85,opticTint:0xffffff,opticFill:1},
 {name:'Silver studio',background:0x10151b,panel:'25 32 39',edge:'193 206 213',studio:1,sky:0xe7d8c5,ground:0x342f3d,fill:.82,key:0xffe4bf,keyPower:2.35,keyPosition:[-42,48,27],rim:0xb3d6ff,rimPower:3.55,rimPosition:[32,19,-52],exposure:.99,opticTint:0xf3e2cc,opticFill:1.18}
];

export function setupThemeCycle(scene) {
  let index=0, revision=0, timer;
  const toast=document.getElementById('theme-toast');
  async function apply(announce=false) {
    const theme=THEMES[index], ticket=++revision;
    if(theme.studio) await scene.prepareStudio();
    if(ticket!==revision) return;
    const root=document.documentElement;
    const background='#'+theme.background.toString(16).padStart(6,'0');
    root.style.setProperty('--scene-bg',background);
    root.style.setProperty('--panel-rgb',theme.panel);
    root.style.setProperty('--edge-rgb',theme.edge);
    document.querySelector('meta[name="theme-color"]').content=background;
    document.getElementById('app').dataset.theme=theme.name;
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
    index=1-index;
    apply(true);
  });
  apply();
}
