export const DEFAULT_APPEARANCE=Object.freeze({display:'energy',planeSampling:'instantaneous',phaseReference:'relative',detectorExposure:'adaptive',detectorZoom:1,palette:'cyan',opacity:.55,threshold:.035,exposure:1,vectors:'none',vectorScale:'readable',density:4,gain:1.05,incident:true,maskOpacity:.62,detectorOpacity:.92,detector:true,axes:true,labels:true,speed:.2,surfaceGuide:true,vortexLines:true,volumeContrast:1,focusEmphasis:false});

// Display-only starting points. Field amplitudes, propagation and probe values
// are unchanged. Every new experiment restores its complete curated defaults.
const LOOKS={
 conveyor:{display:'field',planeSampling:'average',speed:.1,opacity:1.22,volumeContrast:2.3,threshold:.085,exposure:1.12,maskOpacity:.36,detector:false,axes:false,incident:false,detectorExposure:'fixed',gain:.18},
 schlieren:{display:'energy',opacity:.32,volumeContrast:1.38,threshold:.027,exposure:1.04,maskOpacity:.48,detector:false,axes:false,incident:false,detectorZoom:1.25,detectorExposure:'fixed'},
 'speckle-focus':{display:'energy',opacity:.34,threshold:.023,volumeContrast:1.4,exposure:1.16,detectorExposure:'fixed',detectorZoom:1.2,maskOpacity:.62,axes:false,incident:false},
 hartmann:{focusEmphasis:true,display:'energy',opacity:.38,threshold:.023,volumeContrast:1.55,exposure:1.12,detectorExposure:'fixed',detectorZoom:1.06,maskOpacity:.56,axes:false,incident:false},
 coronagraph:{display:'energy',opacity:.42,threshold:.008,detectorExposure:'fixed',detectorZoom:1.28,maskOpacity:.36,detectorOpacity:.72,incident:false,axes:false,exposure:1.2},
 'sound-cell':{display:'energy',opacity:.52,threshold:.02,volumeContrast:1.35,detectorExposure:'fixed',maskOpacity:.48,detectorOpacity:.5,incident:false,axes:false,exposure:1.22,gain:.45},
 'light-billiard':{display:'phase',phaseReference:'instantaneous',opacity:2.3,threshold:.018,volumeContrast:1.1,detectorExposure:'fixed',maskOpacity:.42,detector:false,incident:false,axes:false,exposure:1.32,speed:.13,gain:.14},
 grin:{axes:false,display:'energy',opacity:1.1,volumeContrast:1.6,exposure:1.2,maskOpacity:.48,detector:false,detectorExposure:'fixed',incident:false,gain:.18},
 absorber:{axes:false,display:'field',opacity:.65,threshold:.02,maskOpacity:.4,detector:false,detectorExposure:'fixed',incident:false,speed:.1,gain:.25},
 michelson:{display:'energy',planeSampling:'instantaneous',opacity:.28,threshold:.025,exposure:1.5,maskOpacity:.7,detectorOpacity:.55,detectorExposure:'fixed',axes:false,incident:false,gain:.25,detectorZoom:3},
 'phase-microscope':{detectorExposure:'fixed',display:'phase',planeSampling:'instantaneous',opacity:.32,threshold:.025,exposure:1.4,maskOpacity:.4,detectorOpacity:.65,axes:false,incident:false,detectorZoom:1.7},
 'fabry-perot':{detector:false,display:'field',planeSampling:'instantaneous',opacity:.35,threshold:.025,exposure:1,maskOpacity:.25,detectorOpacity:.45,axes:false,incident:false,speed:.12,detectorZoom:2},
 'bragg-cavity':{detector:false,display:'field',planeSampling:'instantaneous',opacity:.25,volumeContrast:1.6,threshold:.02,exposure:1,maskOpacity:.25,detectorOpacity:.45,axes:false,incident:false,speed:.1,gain:.15},
 coupler:{display:'energy',planeSampling:'instantaneous',opacity:1.5,threshold:.015,volumeContrast:2,exposure:1,maskOpacity:.42,detectorExposure:'fixed',axes:false,labels:false,gain:.15,density:5,incident:false},
 circulator:{detector:false,display:'field',planeSampling:'instantaneous',phaseReference:'instantaneous',opacity:1,threshold:.03,volumeContrast:1.3,maskOpacity:.28,detectorOpacity:.5,detectorExposure:'fixed',axes:false,labels:false,gain:.35,density:3,incident:false,speed:.12},
 tunnelling:{detector:false,display:'field',planeSampling:'instantaneous',opacity:1.2,threshold:.015,volumeContrast:1,exposure:1.4,maskOpacity:.35,detectorExposure:'fixed',axes:false,labels:false,gain:.3,density:3,incident:false,speed:.1},
 healing:{opacity:1.4,threshold:.04,volumeContrast:2,exposure:1.5,density:3,gain:.9,detectorZoom:2.5,detectorExposure:'fixed'},
 trefoil:{display:'phase',opacity:.065,threshold:.08,density:3,gain:.6,detectorZoom:3.5,maskOpacity:.32,detectorOpacity:.6},
 hopf:{display:'phase',opacity:.065,threshold:.08,density:3,gain:.6,detectorZoom:3.5,maskOpacity:.32,detectorOpacity:.6},
 saturn:{focusEmphasis:true,opacity:1.1,threshold:.04,volumeContrast:2.5,exposure:1.7,detectorOpacity:.25,detectorZoom:1.8,density:3},metamorphosis:{opacity:.46,threshold:.05,detectorZoom:3.2},
 autofocus:{opacity:.40,threshold:.025,detectorExposure:'fixed',detectorZoom:2.5},
 fork:{opacity:.52,threshold:.025,detectorZoom:1.5},astigmatism:{opacity:.46,threshold:.025,detectorZoom:2.5},
 poisson:{opacity:.40,threshold:.025,detectorZoom:1.5},
 bunny:{opacity:.48,gain:.95}, spiral:{opacity:.44,gain:.95},
 helix:{opacity:.50,threshold:.025}, star:{opacity:.52},
 quasi:{opacity:.43,threshold:.04}, fractal:{opacity:.44,threshold:.04},
 crossed:{opacity:.58,gain:1.15,vectors:'both'}, petals:{opacity:.58,threshold:.025},
 axicon:{opacity:.46,threshold:.025,detectorZoom:1.5}, caustic:{opacity:.58,threshold:.025},
 hologram:{opacity:.58,threshold:.025}, vortex:{opacity:.55,threshold:.025},
 zone:{opacity:.46,detectorZoom:2,vectors:'electric'}, talbot:{opacity:.44}, hexagon:{opacity:.48,vectors:'electric'},
 double:{opacity:.95,threshold:.015,density:5,gain:1.1,vectors:'both'}, airy:{opacity:.55,vectors:'both'},
 rabbit:{opacity:.55,threshold:.025}
};
export const appearanceFor=id=>({...DEFAULT_APPEARANCE,...LOOKS[id]});
