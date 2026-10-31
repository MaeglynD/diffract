import {INTERACTIONS} from './experiment-interactions.js';
import { fft2, modeVector, TAU,propagate } from './physics.js';
import {rabbitTransmission} from './image-hologram.js';
import {heliconTransmission,spiralOpening,starOpening} from './structured-fields.js';
import {bunnyTransmission} from './bunny-hologram.js';
import {autofocusingRing,forkGrating,astigmaticLens,poissonDisc} from './advanced-fields.js';
import {creativeTransmission,healingLaunch} from './creative-fields.js';
import {holographicTransmission} from './holographic-scenes.js';
import {NATIVE_EXPERIMENTS} from './native-experiments.js';

export const GRID = Object.freeze({ n: 512, length: 128, naSoft: 0.5, naMax: 0.62 });
const ORDER=['michelson','trefoil','coronagraph','grin','light-billiard','saturn','phase-microscope','metamorphosis','sound-cell','circulator','healing','quasi','bunny','tunnelling','absorber','helix','autofocus','bragg-cavity','spiral','fabry-perot','coupler','fractal','fork','petals','crossed','hopf','poisson','astigmatism','double','zone','caustic','talbot','hologram','axicon','vortex','hexagon','star','rabbit','airy'];
export const EXPERIMENTS = Object.freeze([
 ...NATIVE_EXPERIMENTS,
 {id:'healing',name:'Self-healing light',zMax:48,z:27,scan:[8,40],half:20,radius:12,kind:'phase',programmable:true,interfaceZ:14,obstacleRadius:2.3,thumbnailHalf:6,opticLabel:'Bessel beam shaper',formula:String.raw`U_0=J_0(0.30kr)e^{-(r/w)^8}\mathbf1_{r<12\lambda},\qquad U_{b^+}=\mathbf1_{r>a}\mathcal P_bU_0`,parameters:String.raw`b=14\lambda,\quad a=2.3\lambda,\quad w=10\lambda,\quad U(z>b)=\mathcal P_{z-b}U_{b^+}`,description:'A real opaque obstacle interrupts the bright core of a Bessel-like beam partway through its travel. The remaining conical wave components interfere downstream and reconstruct the central structure. The two propagation regions are calculated separately, with absorption at the obstacle. Power is conserved within each region and decreases at the disc. No rays are bent around it by hand. The mask is an ideal absorbing boundary; material scattering at its edge is excluded.'},
 {id:'trefoil',name:'Trefoil phase knot',zMax:44,z:22,scan:[10,34],half:16,radius:14,kind:'phase',programmable:true,vortex:true,thumbnailHalf:6,opticLabel:'Knot hologram',formula:String.raw`U_f=e^{-\rho^2/2}\!\left[\sum_{p=0}^{3}a_p L_p(\rho^2)-\frac{3.97}{\sqrt{6}}\rho^3e^{3i\phi}\right],\quad T=C P\mathcal P_{-f}U_f`,parameters:String.raw`\rho=r/(2.2\lambda),\quad f=22\lambda,\quad(a_0,a_1,a_2,a_3)=(1.51,-5.06,7.23,-2.03)`,description:'A closed trefoil is tied into the phase singularities of the electric-field component. The thin bright trace marks the numerically extracted zero of the complex transverse component, not a luminous wire: phase winds around it, and other electromagnetic components can remain nonzero there. The curve is extracted from the propagated field, without imposing a knot-shaped target. The bright points mark where the scanning detector intersects the stationary curve; they are not particles travelling along it. The optimized Laguerre–Gaussian waist superposition follows Dennis et al. (2010); propagation here uses the nonparaxial vector angular spectrum.'},
 {id:'hopf',name:'Linked phase rings',zMax:44,z:22,scan:[10,34],half:16,radius:14,kind:'phase',programmable:true,vortex:true,thumbnailHalf:6,opticLabel:'Linked-ring hologram',formula:String.raw`U_f=e^{-\rho^2/2}\!\left[2.63L_0(\rho^2)-6.32L_1(\rho^2)+4.21L_2(\rho^2)-\frac{5.95}{\sqrt{2}}\rho^2e^{2i\phi}\right]`,parameters:String.raw`\rho=r/(2\lambda),\quad f=22\lambda,\quad T=C P\mathcal P_{-f}U_f`,description:'Two separate closed phase-singularity loops pass through one another to form a Hopf link. Both are extracted from the same calculated complex electric component. Their colours distinguish the two traced loops; they are annotations of field zeros, not solid rings or light rays. The detector encounters different pairs of vortex cores as it passes through the linked structure. The total electric and magnetic fields need not vanish at a transverse-component zero.'},
 {id:'saturn',name:'Saturn in light',focusWindow:[24,56],zMax:80,z:40,scan:[26,54],half:29,radius:24,kind:'phase',programmable:true,thumbnailHalf:16,opticLabel:'Sculpture hologram',formula:String.raw`T=CPT_{55},\qquad T_{n+1}=P\!\left[T_n+\frac{1.3}{15}\sum_j\mathcal P_{-z_j}\{W(A_j-|U_j|)e^{i\arg U_j}\}\right]`,parameters:String.raw`\begin{gathered}U_j=\mathcal P_{z_j}T_n,\quad z_j=(26+2j)\lambda,\quad j=0,\ldots,14\\ A_j=\max_\ell\exp\!\left[-\frac{(x-X_\ell)^2+(y-Y_\ell)^2+0.22(z_j-Z_\ell)^2}{2(0.85\lambda)^2}\right]\\z_c=40\lambda,\quad R=(6.6,11,13)\lambda\end{gathered}`,description:'A hologram concentrates light around three intersecting great circles and two tilted orbital rings: a wire sculpture of Saturn with real depth. The faint dashed curves are the design reference; the luminous volume and detector are calculated fields. The bright trace is not expected to reproduce every part of this demanding 3D target. Coherent curve samples seed a finite complex-amplitude display, then 55 iterations constrain fifteen sections of the volume and suppress unwanted background. Diffraction and cross-talk limit how sharply the complete sculpture can be reconstructed. Focal-volume emphasis and nonlinear display contrast make the reconstruction region easier to inspect without changing any field samples.'},
 {id:'metamorphosis',name:'Holographic metamorphosis',zMax:80,z:16,scan:[12,68],half:29,radius:24,kind:'phase',programmable:true,thumbnailHalf:9,opticLabel:'Three-depth hologram',formula:String.raw`|\mathcal P_{z_j}T|\approx A_j,\qquad T_{n+1}=P\!\left[T_n+\frac{1.1}{3}\sum_j\mathcal P_{-z_j}\!\left\{W(A_j-|U_j|)e^{i\arg U_j}\right\}\right]`,parameters:String.raw`U_j=\mathcal P_{z_j}T_n,\quad z_j=(16,40,64)\lambda,\quad n=0,\ldots,199`,description:'One fixed hologram encodes three different images at three depths: a jellyfish, a nautilus and a butterfly. Moving the detector reveals each image as the other two defocus. Two hundred iterations optimize the complex boundary field across all three planes; every intermediate image is the interference of that single propagated field. The faint, switchable outlines at the three image planes are design guides. The volume and detector still show the calculated field, not the target silhouettes. The three miniature image controls select the exact reconstruction depths; automatic scanning pauses briefly at each one.'},
  {id:'autofocus',name:'Autofocusing Airy ring',zMax:48,z:22,thumbnailHalf:6,scan:[3,40],half:21,radius:12,kind:'phase',opticLabel:'Airy amplitude + phase plate',formula:String.raw`T(r)=2\operatorname{Ai}(s)e^{as}\mathbf1_{r<R},\qquad s=(r_0-r)/w`,parameters:String.raw`r_0=4.5\lambda,\quad w=0.9\lambda,\quad a=0.09,\quad R=12\lambda`,description:'Concentric Airy lobes with alternating phase curve inward and concentrate on the axis without an added focusing lens. The annular plate sets their amplitude and their zero-or-pi phase. A fixed detector exposure preserves the rise in intensity at the focus. This finite, band-limited radial Airy field is propagated with the vector angular spectrum; the familiar paraxial caustic is only a guide.'},
  {id:'fork',name:'Fork grating vortices',zMax:64,z:30,thumbnailHalf:12,scan:[10,48],half:25,radius:10,kind:'phase',opticLabel:'Fork grating + focusing lens',formula:String.raw`T=e^{-r^2/w^2}\mathbf1_{r<R}\mathbf1_{\cos(2\pi x/d-\phi)>0}\,e^{-i\pi r^2/(\lambda f)}`,parameters:String.raw`d=4\lambda,\quad w=7\lambda,\quad R=10\lambda,\quad f=32\lambda,\quad\phi=\arg(x+iy)`,description:'A fork dislocation in an opaque striped grating gives the two first diffraction orders opposite phase windings. A coincident focusing phase separates them into two hollow vortex spots beside a bright central order. The dark fork stripes are actual obstructions in the prescribed mask. The clear, continuous quadratic profile supplies the focusing phase; its optical path matches the original wrapped profile up to one constant phase. Both are treated as one thin boundary in the propagation model. Higher orders beyond the numerical aperture are excluded.'},
  {id:'astigmatism',name:'Astigmatic focus',zMax:56,z:18,thumbnailHalf:5,scan:[10,46],half:19,radius:9,kind:'phase',opticLabel:'Astigmatic phase plate',formula:String.raw`T=e^{-r^2/w^2}\mathbf1_{r<R}\exp\!\left[-\frac{i\pi}{\lambda}\left(\frac{x^2}{f_x}+\frac{y^2}{f_y}\right)\right]`,parameters:String.raw`f_x=20\lambda,\quad f_y=42\lambda,\quad w=5.5\lambda,\quad R=9\lambda`,description:'Different curvatures along the two transverse axes focus the beam at different depths. A narrow vertical line opens into a small ellipse, then becomes a horizontal line. These are sections of one continuous three-dimensional field, not a rotating image. Finite beam width and nonparaxial propagation shift the waists away from the nominal lens focal lengths.'},
  {id:'poisson',name:'Poisson spot',zMax:64,z:20,thumbnailHalf:10,scan:[2,48],half:25,radius:12,kind:'obstacle',opticLabel:'Opaque disc',formula:String.raw`T(r)=e^{-r^2/w^2}\mathbf1_{a<r<R}`,parameters:String.raw`a=4\lambda,\quad w=10\lambda,\quad R=12\lambda`,description:'An opaque disc blocks the centre of a broad Gaussian beam. Waves passing around its circular edge interfere constructively on the axis, producing a bright Poisson spot inside the geometrical shadow. The outer pupil is finite. The ideal boundary model prescribes the transmitted field; the stand is schematic, and reflections or scattering inside the material are not simulated.'},
  {id:'bunny',name:'3D bunny hologram',zMax:64,z:32,scan:[22,42],half:28,radius:18,kind:'phase',object:'bunny',formula:String.raw`T=C\,P\,\mathcal F^{-1}\!\left\{W\sum_m\mathcal F\{L_m\}\,e^{-i(k_z-k)z_m}\right\}`,parameters:String.raw`L_m(x,y)=\sum_j w_{jm}\sqrt{A_j}\,e^{i\phi_j}e^{-[(x-X_j)^2+(y-Y_j)^2]/(2\sigma^2)},\quad\sigma=0.40\lambda,\quad\Delta z_m=0.5\lambda`,description:'The full Stanford Bunny mesh supplies 4,426 area-weighted surface samples across a depth of 18.6 wavelengths. The computer-generated hologram back-propagates their coherent layer fields into one finite amplitude-and-phase mask. The recording arm contains the full source mesh, a reciprocal object wave and a reference-illuminated capture surface connected to the replay plate. This illustrates ideal complex-field capture and conjugate replay. The translucent reconstruction surface is an optional guide at the target coordinates. Only the calculated electromagnetic fields produce the volume and detector image. Surface sources have fixed phases; occlusion and material scattering are not modeled.'},
  {id:'helix',name:'Helical interference',zMax:48,z:20,half:18,radius:12,kind:'phase',formula:String.raw`T(r,\phi)=0.95e^{-(r/w)^8}\left[J_1(k\alpha_1r)e^{i\phi}+J_1(k\alpha_2r)e^{-i\phi}\right]\mathbf1_{r<a}`,parameters:String.raw`\alpha_1=0.16,\quad\alpha_2=0.30,\quad w=9.5\lambda,\quad a=12\lambda`,description:'Two finite Bessel-like vortex fields have opposite phase windings and different longitudinal wave numbers. Their bright interference lobes rotate with propagation distance, tracing a twisted field through space. The illustrated relief delays the phase by varying the optical path length, with separate amplitude weighting across the plate. This is a finite-aperture helicon approximation, propagated with the full vector angular spectrum.'},
  {id:'spiral',name:'Sunflower sieve',zMax:64,z:28,half:21,radius:11,kind:'mask',formula:String.raw`T(x,y)=\sum_{j=0}^{95}\mathbf1_{(x-X_j)^2+(y-Y_j)^2<b^2}`,parameters:String.raw`(X_j,Y_j)=1.05\lambda\sqrt{j+\tfrac12}(\cos j\gamma,\sin j\gamma),\quad\gamma=\pi(3-\sqrt5),\quad b=0.42\lambda`,description:'Ninety-six circular openings follow the golden-angle arrangement of sunflower seeds. The aperiodic aperture produces rotating fine structure and rings through coherent diffraction.'},
  {id:'star',name:'Star aperture',zMax:72,z:38,half:21,radius:8,kind:'mask',formula:String.raw`T(x,y)=\mathbf1_{(x,y)\in\mathcal P_{\star}}`,parameters:String.raw`\mathcal P_{\star}:\quad r_j=\begin{cases}7\lambda&j\text{ even}\\2.9\lambda&j\text{ odd}\end{cases},\quad\theta_j=\pi/2+j\pi/5,\quad j=0,\ldots,9`,description:'A literal five-pointed opening transforms from a recognizable near-field star into intersecting diffraction spikes. Its sharp corners and five pairs of edges contribute coherently to the entire field.'},
  {id:'rabbit',name:'Rabbit image',zMax:48,z:24,half:17,radius:12,kind:'phase',formula:String.raw`T(x,y)=C\,P(x,y)\,\mathcal F^{-1}\!\left\{W_h(q)\,\mathcal F\{R\}\,e^{-ik_z f}\right\}`,parameters:String.raw`f=24\lambda,\quad P=\text{square pupil with cosine edge},\quad |x|,|y|<12\lambda`,description:'An amplitude-and-phase mask reconstructs a flat rabbit image at one plane. This is a two-dimensional image hologram, not a three-dimensional rabbit or an illuminated physical rabbit. The picture is formed by interference of the propagated field; it is not an image texture on the detector. Move the detector through the focus to see it form and dissolve.'},
  { id:'hologram',name:'Five foci',zMax:56,z:29,half:17,radius:8.5,kind:'phase',formula:String.raw`T(x,y)=e^{-r^2/w^2}\exp\!\left[i\arg\sum_{j=0}^{4}e^{-ik(R_j-z_j)}\right]\mathbf1_{r<a}`,parameters:String.raw`\begin{gathered}R_j=\sqrt{(x-X_j)^2+(y-Y_j)^2+z_j^2},\quad z_j=(18+6j)\lambda\\(X_j,Y_j)=4\lambda(\cos\theta_j,\sin\theta_j),\quad\theta_j=2\pi j/5\\w=6\lambda,\quad a=8.5\lambda\end{gathered}`,description:'A holographic mask directs one incoming wave toward five locations arranged in a three-dimensional spiral. The foci lie at different depths; the detector cuts through their overlapping fields.' },
  { id:'caustic',name:'Cubic caustic',zMax:56,z:30,half:17,radius:9,kind:'phase',formula:String.raw`T(x,y)=e^{-r^2/w^2}e^{i\beta(x^3+y^3)-ikr^2/(2f)}\mathbf1_{r<a}`,parameters:String.raw`\beta=0.012\lambda^{-3},\quad f=30\lambda,\quad w=6\lambda,\quad a=9\lambda`,description:'A cubic phase combined with focusing produces curved caustics and an Airy-like focal structure. The phase plate redirects different parts of the incoming wave by different amounts.' },
  { id:'petals',name:'Rotating petals',zMax:48,z:24,half:15,radius:8,kind:'phase',formula:String.raw`T(r,\phi)=\tfrac12e^{-\rho^2}\left[\sqrt{2e}\,\rho e^{i\phi}+\left(\tfrac{2e}{3}\right)^{3/2}\rho^3 e^{-3i\phi}\right]\mathbf1_{r<a}`,parameters:String.raw`\rho=r/w,\quad w=2.4\lambda,\quad a=8\lambda,\quad(\ell_1,\ell_2)=(1,-3)`,description:'Two vortex modes with different radial profiles interfere into four petals. Their relative propagation phase changes with distance, turning the petal pattern through the volume.' },
  { id:'quasi',name:'Quasiperiodic lattice',zMax:72,z:44,half:21,radius:10,kind:'mask',formula:String.raw`T(x,y)=\mathbf1_{r<a}\,\mathbf1_{\sum_{j=0}^{4}\cos[2\pi(x\cos\theta_j+y\sin\theta_j)/p]>\eta}`,parameters:String.raw`\theta_j=2\pi j/5,\quad p=3\lambda,\quad\eta=1.8,\quad a=10\lambda`,description:'Five incommensurate grating directions define an aperiodic aperture. Its ten-fold diffraction structure evolves into an intricate network of bright nodes and dark channels.' },
  { id:'fractal',name:'Fractal aperture',zMax:96,z:58,half:23,radius:9.55,kind:'mask',formula:String.raw`T(x,y)=\mathbf1_{|x|,|y|<L/2}\prod_{s=1}^{2}\left[1-\mathbf1_{d_s(x)=1}\mathbf1_{d_s(y)=1}\right]`,parameters:String.raw`L=13.5\lambda,\qquad d_s(x)=\left\lfloor3^s(x/L+1/2)\right\rfloor\bmod3`,description:'A two-level Sierpiński carpet has square openings and obstructions at nested scales. Their overlapping diffraction produces a hierarchy of fringes rather than a single characteristic spacing.' },
  { id: 'crossed', name: 'Crossing beams', zMax: 48, z: 18, half: 14, radius: 7, kind: 'beams', color: '#498ee0', formula: String.raw`T(x,y)=\sum_{j=0}^{2}e^{-[(x-x_j)^2+(y-y_j)^2]/w^2}e^{ik(q_{xj}x+q_{yj}y)}`, description: 'Three coherent Gaussian beams meet in space, then separate. Their electric and magnetic fields add before the energy flux is calculated.', parameters: String.raw`\begin{gathered}\theta_j=2\pi j/3+\pi/2,\quad(q_{xj},q_{yj})=0.24(\cos\theta_j,\sin\theta_j)\\q_z=\sqrt{1-0.24^2},\quad(x_j,y_j)=-18\lambda(q_{xj},q_{yj})/q_z,\quad w=1.8\lambda\end{gathered}` },
  { id: 'vortex', name: 'Optical vortex', zMax: 48, z: 28, half: 14, radius: 6.5, kind: 'phase', color: '#8472ca', formula: String.raw`T(r,\phi)=e\left(\frac{r}{w}\right)^2e^{-r^2/w^2}e^{2i\phi}\,\mathbf1_{r<a}`, description: 'A phase winding produces a hollow beam with a dark axis. The moving helical phase fronts are sampled throughout its volume.', parameters: String.raw`\ell=2,\quad w=2.6\lambda,\quad a=6.5\lambda` },
  { id: 'axicon', name: 'Axicon', zMax: 48, z: 18, half: 15, radius: 8, kind: 'axicon', color: '#3d9fa2', formula: String.raw`T(r)=e^{-r^2/w^2}e^{-ik\alpha r}\,\mathbf1_{r<a}`, description: 'A conical phase turns a broad beam inward. The overlapping conical waves form a narrow central core and concentric rings over a finite distance.', parameters: String.raw`\alpha=0.28,\quad w=6\lambda,\quad a=8\lambda` },
  { id: 'zone', name: 'Fresnel zone plate', zMax: 48, z: 14, half: 15, radius: 8, kind: 'zones', color: '#c18f47', formula: String.raw`T(r)=\mathbf1_{r<a}\,\mathbf1_{\cos[k(\sqrt{f^2+r^2}-f)]>0}`, description: 'Alternating transparent and opaque rings make transmitted waves reinforce near a focus. Secondary foci and rings emerge from the same propagation calculation.', parameters: String.raw`f=14\lambda,\quad a=8\lambda` },
  { id: 'talbot', name: 'Talbot lattice', zMax: 42, z: 18, half: 15, radius: 9.3, kind: 'lattice', color: '#5e8fbb', formula: String.raw`T(x,y)=\sum_{m,n=-2}^{2}\mathbf1_{(x-mp)^2+(y-np)^2<b^2}`, description: 'A finite two-dimensional array creates repeated and fractional self-images. Its familiar Talbot distance is a paraxial guide; the field here uses the full angular-spectrum propagator.', parameters: String.raw`p=3\lambda,\quad b=0.65\lambda,\quad z_T\simeq 2p^2/\lambda=18\lambda` },
  { id: 'hexagon', name: 'Six coherent holes', zMax: 64, z: 32, half: 18, radius: 4.7, kind: 'holes', color: '#9d6e9a', formula: String.raw`T(x,y)=\sum_{j=0}^{5}\mathbf1_{(x-R\cos\theta_j)^2+(y-R\sin\theta_j)^2<b^2}`, description: 'Six openings arranged on a ring produce a hexagonal interference network. Bright nodes and dark channels occupy three-dimensional space.', parameters: String.raw`R=3.8\lambda,\quad b=0.8\lambda,\quad\theta_j=j\pi/3` },
  { id: 'double', name: 'Double slit', zMax: 96, z: 30, half: 22, radius: 3, kind: 'slits', color: '#6287aa', formula: String.raw`T(x,y)=\operatorname{rect}(y/h)\left[\operatorname{rect}\!\left(\frac{x+d/2}{b}\right)+e^{i\delta}\operatorname{rect}\!\left(\frac{x-d/2}{b}\right)\right]`, description: 'Two finite rectangular openings show the evolution from aperture structure to interference fringes within a diffraction envelope.', parameters: String.raw`b=1.2\lambda,\quad h=4\lambda,\quad d=3.2\lambda,\quad-\pi\leq\delta\leq\pi` },
  { id: 'airy', name: 'Circular aperture', zMax: 80, z: 40, half: 22, radius: 3, kind: 'circle', color: '#5b9b85', formula: String.raw`T(r)=\mathbf1_{r<3\lambda}`, description: 'A circular opening produces a central lobe and dark rings. These are cross-sections of a diffracting volume, not rings pasted onto a screen.', parameters: String.raw`a=3\lambda,\quad\sin\theta_1\simeq 1.2197\lambda/(2a)` }
].map(e=>({...e,interaction:INTERACTIONS[e.id]})).sort((a,b)=>ORDER.indexOf(a.id)-ORDER.indexOf(b.id)));

export function experiment(id) { const e = EXPERIMENTS.find(x => x.id === id); if (!e) throw new Error(`Unknown experiment ${id}`); return e; }
export function maskHalf(e){return e.id==='fractal'?8.2:e.kind==='slits'||e.kind==='circle'?5:e.radius+1.4;}

/** The complex tangential exit field, in units of the reference electric amplitude. */
export function boundary(id, x, y) {
  if(NATIVE_EXPERIMENTS.some(e=>e.id===id))throw Error('Material-boundary experiments use nativeModel(), not an aperture transmission.');
  const r = Math.hypot(x, y);
  let amplitude = 0, phase = 0;
  switch (id) {
    case 'healing': return healingLaunch(x,y);
    case 'trefoil': case 'hopf': return creativeTransmission(id,x,y);
    case 'saturn': case 'metamorphosis': return holographicTransmission(id,x,y);
    case 'autofocus': return autofocusingRing(x,y);
    case 'fork': return forkGrating(x,y);
    case 'astigmatism': return astigmaticLens(x,y);
    case 'poisson': return poissonDisc(x,y);
    case 'bunny': return bunnyTransmission(x,y);
    case 'helix': return heliconTransmission(x,y);
    case 'spiral': return[spiralOpening(x,y),0];
    case 'star': return[starOpening(x,y),0];
    case 'rabbit': return rabbitTransmission(x,y);
    case 'hologram': {
      if(r>=8.5)return[0,0];let re=0,im=0;
      for(let j=0;j<5;j++){const theta=TAU*j/5,z=18+6*j,p=-TAU*(Math.hypot(x-4*Math.cos(theta),y-4*Math.sin(theta),z)-z);re+=Math.cos(p);im+=Math.sin(p);}
      amplitude=Math.exp(-r*r/36);phase=Math.atan2(im,re);break;
    }
    case 'caustic': amplitude=r<9?Math.exp(-r*r/36):0;phase=.012*(x*x*x+y*y*y)-Math.PI*r*r/30;break;
    case 'petals': {
      if(r>=8)return[0,0];const rho=r/2.4,phi=Math.atan2(y,x),g=.5*Math.exp(-rho*rho),a=Math.sqrt(2*Math.E)*rho,b=(2*Math.E/3)**1.5*rho**3;
      return[g*(a*Math.cos(phi)+b*Math.cos(-3*phi)),g*(a*Math.sin(phi)+b*Math.sin(-3*phi))];
    }
    case 'quasi': {let sum=0;for(let j=0;j<5;j++)sum+=Math.cos(TAU/3*(x*Math.cos(TAU*j/5)+y*Math.sin(TAU*j/5)));amplitude=r<10&&sum>1.8?1:0;break;}
    case 'fractal': {
      amplitude=Math.abs(x)<6.75&&Math.abs(y)<6.75?1:0;
      for(let s=1;s<=2;s++)if(Math.floor(3**s*(x/13.5+.5))%3===1&&Math.floor(3**s*(y/13.5+.5))%3===1)amplitude=0;
      break;
    }
    case 'crossed': {
      let re = 0, im = 0;
      for (let j = 0; j < 3; j++) {
        const theta = TAU * j / 3 + Math.PI / 2, qx = .24 * Math.cos(theta), qy = .24 * Math.sin(theta), qz = Math.sqrt(1 - .24 ** 2);
        const cx = -18 * qx / qz, cy = -18 * qy / qz;
        const a = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 1.8 ** 2), p = TAU * (qx * x + qy * y);
        re += a * Math.cos(p); im += a * Math.sin(p);
      }
      return [re, im];
    }
    case 'vortex': amplitude = r < 6.5 ? Math.E * (r / 2.6) ** 2 * Math.exp(-((r / 2.6) ** 2)) : 0; phase = 2 * Math.atan2(y, x); break;
    case 'axicon': amplitude = r < 8 ? Math.exp(-((r / 6) ** 2)) : 0; phase = -TAU * .28 * r; break;
    case 'zone': amplitude = r < 8 && Math.cos(TAU * (Math.hypot(14, r) - 14)) > 0 ? 1 : 0; break;
    case 'talbot': for (let m = -2; m <= 2; m++) for (let n = -2; n <= 2; n++) if (Math.hypot(x - 3 * m, y - 3 * n) < .65) amplitude = 1; break;
    case 'hexagon': for (let j = 0; j < 6; j++) if (Math.hypot(x - 3.8 * Math.cos(TAU * j / 6), y - 3.8 * Math.sin(TAU * j / 6)) < .8) amplitude = 1; break;
    case 'double-right': amplitude = Math.abs(y) < 2 && Math.abs(x - 1.6) < .6 ? 1 : 0; break;
    case 'double': amplitude = Math.abs(y) < 2 && Math.abs(Math.abs(x) - 1.6) < .6 ? 1 : 0; break;
    case 'airy': amplitude = r < 3 ? 1 : 0; break;
    default: throw new Error(`Unknown boundary ${id}`);
  }
  return [amplitude * Math.cos(phase), amplitude * Math.sin(phase)];
}

export function buildSpectrum(id, config = GRID) {
  const { n, length, naSoft, naMax } = config, dx = length / n, size = n * n;
  // Keep the old 12λ support for Gaussian tails, and extend it for larger masks.
  const support=Math.max(12,EXPERIMENTS.find(e=>e.id===id)?.radius??0);
  const re = new Float64Array(size), im = new Float64Array(size), extent = Math.min(n/2-1,Math.ceil(support / dx)), aa = 4;
  for (let j = n / 2 - extent; j <= n / 2 + extent; j++) for (let i = n / 2 - extent; i <= n / 2 + extent; i++) {
    const at = j * n + i;
    for (let v = 0; v < aa; v++) for (let u = 0; u < aa; u++) {
      const [r, t] = boundary(id, (i - n / 2 + (u + .5) / aa - .5) * dx, (j - n / 2 + (v + .5) / aa - .5) * dx);
      re[at] += r / aa ** 2; im[at] += t / aa ** 2;
    }
  }
  const spectrum=spectrumFromSamples(id,re,im,config),e=EXPERIMENTS.find(e=>e.id===id);
  if(e?.interfaceZ){
    const[f]=propagate(spectrum,e.interfaceZ,[0]);
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      let open=0;for(let v=0;v<4;v++)for(let u=0;u<4;u++){const x=(i-n/2+(u+.5)/4-.5)*dx,y=(j-n/2+(v+.5)/4-.5)*dx;if(Math.hypot(x,y)>e.obstacleRadius)open+=1/16;}
      f.re[j*n+i]*=open;f.im[j*n+i]*=open;
    }
    spectrum.interfaceZ=e.interfaceZ;spectrum.after=spectrumFromSamples(id+'-after',f.re,f.im,config);
  }
  return spectrum;
}
function spectrumFromSamples(id,re,im,config){
  const{n,length,naSoft,naMax}=config;fft2(re, im, n);
  const modes = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const qx = (i < n / 2 ? i : i - n) / length, qy = (j < n / 2 ? j : j - n) / length, q = Math.hypot(qx, qy), at = j * n + i;
    if (q >= naMax) { re[at] = im[at] = 0; continue; }
    const w = q <= naSoft ? 1 : .5 * (1 + Math.cos(Math.PI * (q - naSoft) / (naMax - naSoft)));
    re[at] *= w; im[at] *= w;
    modes.push({ at, i, j, qx, qy, qz: Math.sqrt(1 - q * q), v: modeVector(qx, qy) });
  }
  return { id, config, re, im, modes };
}


