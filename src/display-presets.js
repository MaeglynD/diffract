export const DEFAULT_APPEARANCE=Object.freeze({display:'energy',planeSampling:'average',phaseReference:'relative',detectorExposure:'adaptive',detectorZoom:1,palette:'cyan',opacity:.55,threshold:.035,exposure:1,vectors:'none',vectorScale:'readable',density:4,gain:1.05,incident:true,maskOpacity:.62,detectorOpacity:.92,detector:true,axes:true,labels:true,speed:.2,surfaceGuide:true,vortexLines:true,volumeContrast:1,focusEmphasis:false});

// Display-only starting points. Field amplitudes, propagation and probe values
// are unchanged. Explicit user adjustments survive switching experiments.
const LOOKS={
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
