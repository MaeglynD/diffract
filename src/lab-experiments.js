import {DRUM,drumHeight} from './resonant-instruments.js';

export const CORONA = Object.freeze({f:14, pupil:4, lens:9.2, mask:7, stop:3.15, tilt:.215});
const lab={analytic:true,bench:true,customPreview:true,kind:'native'};
export const NEW_LABS=[
  {...lab,id:'coronagraph',name:'Eclipsing a star',spectralBench:true,zMax:72,z:55.5,half:10,viewHeight:10,radius:9.2,
    viewDirection:[-.42,.46,1],detectorReference:3.25,cameraSensor:{z:70,half:6},opticLabel:'Vortex coronagraph',
    formula:String.raw`V=\begin{cases}e^{2i\arg(x+iy)}&0<r<7\lambda\\1&r\ge7\lambda\end{cases},\qquad L(r)=\mathbf 1_{r<r_L},\qquad U_{\rm in}=\mathbf 1_{r<R}\,e^{ikx\sin\theta}`,
    parameters:String.raw`R=4\lambda,\quad r_L=3.15\lambda,\quad f=14\lambda,\quad \sin\theta\in\{0,\,0.215\},\quad z_{\rm camera}=5f`,
    description:'The first relay lens brings starlight to a two-ramp phase plate. The second lens forms a new image of the telescope pupil. For a centred star, the mask pushes most of the light outside that pupil. A metal stop intercepts the bright annulus. Change the alignment of the same star and a spot survives at the camera. The two positions have equal input brightness; they are separate observations, not coherent light from a star and a planet. The relay uses finite thin lenses, a scalar charge-two phase mask and vector angular-spectrum propagation in vacuum. The mask centre sample uses the angular average, zero. Finite pupils, sampling and the short focal lengths leave residual starlight.'},
  {...lab,id:'sound-cell',name:'A grating made of sound',live:true,zMax:45,z:43,half:22,viewHeight:2.6,radius:11,detectorReference:1,
    viewDirection:[-.28,1.32,1],opticLabel:'Raman–Nath sound cell',
    formula:String.raw`T(x)=e^{i d\cos(2\pi x/\Lambda)}=\sum_{m=-\infty}^\infty i^{|m|}J_{|m|}(d)e^{2\pi i mx/\Lambda}`,
    parameters:String.raw`\Lambda=5\lambda,\quad w=5.2\lambda,\quad 0\le d\le2.7,\quad k_z=\sqrt{k^2-k_x^2}`,
    description:'Sound periodically compresses a transparent cell and changes its refractive index. Turn up the acoustic drive: light leaves the central beam in symmetric orders. Near 2.405 radians the undiffracted order vanishes. The copper transducer drives across the laser sheet; the bands on the cell indicate the acoustic index modulation. This is a frozen acoustic phase in the thin Raman–Nath regime. The finite Gaussian launch is represented by 25 plane waves per order, retaining orders −4 through +4. Each propagating wave has its own magnetic field. Acoustic frequency shifts and reflections from the cell faces are neglected; the finite vertical extent is a viewing window.'},
  {...lab,id:'light-billiard',name:'Kaleidoscope cavity',live:true,planPreview:true,zMax:drumHeight+2*DRUM.base,z:DRUM.base+drumHeight/3,half:3.45,viewHeight:.32,radius:3,
    energyDensity:true,detectorReference:1.7,viewDirection:[-.38,1.9,.85],opticLabel:'Triangular mirror cavity',
    formula:String.raw`F=\sum_{j=0}^{2}e^{ikq_j X}\sin(kp_j Z),\qquad \widetilde E_y=\tfrac12(\cos\chi\,F+\sin\chi\,F^*)`,
    parameters:String.raw`(q_j,p_j)=R_{2\pi j/3}(q_0,p_0),\quad a=\tfrac{2\sqrt{79}}{3}\lambda,\quad (q_0,p_0)=\left(\tfrac{13\lambda}{3a},\tfrac{7\lambda}{\sqrt3a}\right)`,
    description:'The coordinates in the mode equation are measured from the left end of the triangle’s base. Three mirrors fold a wave back onto itself. The six travelling components fit all three walls exactly. Two independent modes share this resonance frequency: change their mixing angle to exchange two phase-conjugate patterns, passing through a standing wave halfway. Watch the phase windings reverse while the physical mirrors stay fixed. The preview looks down into the cavity at mid-height. This is a perfectly conducting triangular prism with vertical electric field and no vertical variation. The top is removed in the drawing. The control selects coherent excitation of the two modes, not a change in the mirror positions.'}
];
