import {LIVE_EXPERIMENTS} from './live-experiments.js';
import {NEW_LABS} from './lab-experiments.js';
import {BENCH_EXPERIMENTS} from './bench-experiments.js';
// These presets reconstruct locally, without fetching stored field volumes.
export const NATIVE_EXPERIMENTS=[
 ...BENCH_EXPERIMENTS,...LIVE_EXPERIMENTS,...NEW_LABS,
 {id:'coupler',analytic:true,name:'Evanescent exchange',kind:'native',zMax:18.2,z:9.1,scan:[.5,17.7],half:2,radius:1.5,viewHeight:.2,viewDirection:[-.16,3,.65],opticLabel:'Coupled dielectric guides',
  formula:String.raw`\widetilde E_y=\frac{u_+(x)e^{i\beta_+z}}{N_+}-\frac{u_-(x)e^{i\beta_-z}}{N_-},\qquad u_\pm''+[n^2(x)k^2-\beta_\pm^2]u_\pm=0`,
  parameters:String.raw`n_{\rm core}=1.30,\quad w=0.50\lambda,\quad g=0.25\lambda,\quad L_{\rm transfer}=\frac{\pi}{\beta_+-\beta_-}\simeq9.096\lambda`,
  description:'Two parallel dielectric guides exchange light through their overlapping evanescent fields. The exact even and odd TE supermodes accumulate different phases; their sum transfers energy from one core into the other and back again. Electric field and its normal derivative are matched at every dielectric interface, and both modes are normalized to the same axial power. The transparent rails show the actual refractive-index boundaries. This ideal slab model is invariant vertically; only a finite-height viewing window is drawn. Ends, launch coupling, absorption and substrate effects are not simulated.'},
 {id:'circulator',analytic:true,name:'Whispering-gallery cavity',kind:'native',zMax:10.4,z:5.2,scan:[1.5,8.9],half:5,radius:3.701430874326641,viewHeight:2.4,energyDensity:true,opticLabel:'Cylindrical mirror cavity',
  formula:String.raw`\widetilde E_y=CJ_{18}(kr)e^{18i\phi},\qquad J_{18}(kR)=0,\quad r^2=x^2+(z-z_c)^2`,
  parameters:String.raw`R=3.70143\lambda,\quad z_c=5.2\lambda,\quad\phi=\operatorname{atan2}(z-z_c,x)`,
  description:'A travelling cylindrical cavity mode circulates around a perfectly reflecting wall. Its high angular order concentrates the field near the perimeter: a whispering-gallery pattern. Electric-field crests rotate while the time-averaged energy distribution stays stationary. The magnetic field is calculated from the curl of the electric field. The open top and faint cylindrical wall are a display cutaway of an ideal closed, perfectly conducting cavity, not an open resonator or a dielectric-ring approximation. The detector is a virtual section through the cavity; Energy shows mean energy density here because the energy circulates rather than flowing only forward.'},
 {id:'tunnelling',analytic:true,name:'Light across a forbidden gap',kind:'native',zMax:8.5,z:4.14,scan:[.5,8],half:10,radius:7,viewHeight:.8,viewDirection:[-.5,1.5,1],opticLabel:'Glass · air gap · glass',
  formula:String.raw`\widetilde E_y=\int A(q_x)e^{ikq_xx}\begin{cases}e^{ikq_z(z-a)}+r e^{-ikq_z(z-a)}&z<a\\c_+e^{-k\kappa(z-a)}+c_-e^{k\kappa(z-a)}&a\le z\le a+d\\t e^{ikq_z(z-a-d)}&z>a+d\end{cases}\,dq_x`,
  parameters:String.raw`n=1.70,\quad\theta=53^\circ,\quad d=0.28\lambda,\quad q_z=\sqrt{n^2-q_x^2},\quad\kappa=\sqrt{q_x^2-1}`,
  description:'An oblique beam meets a glass–air boundary above the critical angle. An isolated boundary would totally reflect it, yet a second glass block less than a wavelength away lets part of the field tunnel across the gap. Incident and reflected waves interfere in the first block; a weaker transmitted beam emerges in the second. Forty-nine coherent angular components are matched exactly at both interfaces, including both evanescent terms inside the air gap. The central component transmits about 14.5% of its incident power. The blocks are a finite display window into semi-infinite, lossless dielectrics; their outer edges are not additional simulated interfaces.'}
];
