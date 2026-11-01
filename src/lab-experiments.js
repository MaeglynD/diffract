import {DRUM,drumHeight} from './resonant-instruments.js';
import {CONVEYOR} from './optical-conveyor.js';
import {SCHLIEREN} from './schlieren.js';

export const CORONA = Object.freeze({f:14, pupil:4, lens:9.2, mask:7, stop:3.15, tilt:.215});
const lab={analytic:true,bench:true,customPreview:true,kind:'native'};
export const NEW_LABS=[
  {...lab,id:'conveyor',name:'An optical conveyor belt',zMax:CONVEYOR.length,z:CONVEYOR.length/2,half:CONVEYOR.half,viewHeight:CONVEYOR.half,radius:2.2,
    energyDensity:true,planPreview:true,fitApparatus:true,viewDirection:[-.2,.47,1],detectorReference:4,opticLabel:'Counterpropagating Bessel beams',
    formula:String.raw`\widetilde E_y\propto J_0(k_\perp r)\!\left[e^{i\beta(z-z_c)}+e^{i\delta}e^{-i\beta(z-z_c)}\right],\qquad U_{\rm dip}=-\tfrac14\operatorname{Re}(\alpha)|\widetilde{\mathbf E}|^2`,
    parameters:String.raw`k_\perp=0.45k,\quad \beta=\sqrt{k^2-k_\perp^2},\qquad z_m=z_c+\frac{2\pi m+\delta}{2\beta}`,
    description:'Two facing objectives send coherent beams into the same gap. Their electric fields reinforce at a row of sites. Tiny dielectric beads are drawn towards these maxima. Change the phase in one arm and the whole row moves, carrying the three beads with it. The preview looks along a slice through the beam axis. The model sums plane waves on two opposing cones in vacuum and places Rayleigh particles at their stable equilibria. Beads are enlarged for visibility. The model assumes slow transport and neglects particle scattering, drag and thermal motion.'},
  {...lab,id:'schlieren',name:'Seeing warm air',spectralBench:true,zMax:SCHLIEREN.camera,z:SCHLIEREN.camera,half:12,viewHeight:12,radius:SCHLIEREN.lens,
    cameraSensor:{z:SCHLIEREN.camera,half:10.8},viewDirection:[-.34,.41,1],detectorReference:1.25,opticLabel:'Knife-edge Schlieren bench',
    formula:String.raw`U_0=A\,e^{i\phi},\qquad \phi(x,y)=k\!\int\!\big[n(x,y,z)-n_{\rm air}\big]\,dz,\qquad T_{\rm blade}(x_f)=\mathbf1_{x_f>0}`,
    parameters:String.raw`f=18\lambda,\quad z_{\rm blade}=2f,\quad z_{\rm camera}=4f,\quad R_{\rm lens}=12\lambda`,
    description:'Warm air rising from a heater delays light less than the surrounding air. A lens brings the undeflected beam to the edge of a razor. Light bent to one side passes the blade while light bent to the other side is blocked. A second lens images the plume onto the camera. Withdraw the blade to compare the same air at the same exposure. The optical path through the plume is prescribed at one instant. This coherent relay models diffraction through finite thin lenses and the blade. The image is inverted by the relay.'},
  {...lab,id:'speckle-focus',name:'Focusing through frosted glass',spectralBench:true,zMax:33,z:33,half:12,viewHeight:12,radius:10,
    cameraSensor:{z:33,half:10},viewDirection:[-.46,.38,1],detectorReference:8,opticLabel:'Wavefront shaper and diffuser',
    formula:String.raw`\widetilde E_y(\mathbf r_t)=\sum_j t_j e^{i\phi_j},\qquad \phi_j=-\arg t_j`,
    parameters:String.raw`8\times8\ \text{segments},\quad z_{\rm glass}=11\lambda,\quad \mathbf r_t=(1.5,-1,33)\lambda`,
    description:'A laser illuminates 64 programmable tiles. A rough glass sheet scrambles their light into speckle. Choose Focused to set each tile’s delay so its contribution arrives in phase at one camera pixel. The camera brackets mark the target. Both the glass and the incident illumination stay fixed. The tile shading shows the phase command. Here the glass is a single thin phase screen. The correction uses its calculated complex transmission to the target pixel.'},
  {...lab,id:'hartmann',name:'Reading a wavefront',spectralBench:true,zMax:19,z:19,half:17,viewHeight:17,radius:15,
    cameraSensor:{z:19,half:16},focusWindow:[8.5,19],viewDirection:[-.57,.45,1],detectorReference:9,opticLabel:'Shack–Hartmann wavefront sensor',
    formula:String.raw`\Delta\mathbf r_j\simeq f\,\nabla W(\mathbf r_j),\qquad W(x,y)=\tfrac{\kappa}{2}(x^2-y^2)`,
    parameters:String.raw`5\times5\ \text{lenslets},\quad p=6\lambda,\quad f=12\lambda,\quad \kappa\in\{0,0.014/\lambda\}`,
    description:'Each small lens focuses its patch of the incoming wave onto the camera. A flat wave makes a square grid of spots. Switch to Astigmatic and the spots spread horizontally and squeeze together vertically. Each displacement measures the local tilt of the incoming wave. The calculation propagates the coherent field through all 25 square lenslets, including interference between neighbours. The slope formula gives the small-angle interpretation of the measurement.'},
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
    energyDensity:true,detectorReference:1.7,viewDirection:[-.38,1.9,.85],opticLabel:'Triangular microwave resonator',
    formula:String.raw`F=\sum_{j=0}^{2}e^{ikq_j X}\sin(kp_j Z),\qquad \widetilde E_y=\tfrac12(\cos\chi\,F+\sin\chi\,F^*)`,
    parameters:String.raw`(q_j,p_j)=R_{2\pi j/3}(q_0,p_0),\quad a=\tfrac{2\sqrt{79}}{3}\lambda,\quad (q_0,p_0)=\left(\tfrac{13\lambda}{3a},\tfrac{7\lambda}{\sqrt3a}\right)`,
    description:'A shallow metal chamber has an equilateral triangular rim between two conducting plates. An antenna can excite microwave resonances inside. The lid is cut away so you can look down into the field. Two patterns fit the same three walls at the same frequency. Mix them to see the phase winding reverse through a standing wave at 45°. The preview is a section halfway between the plates. The calculation uses lossless metal, a vertical electric field and ideal excitation of the two modes.'}
];
