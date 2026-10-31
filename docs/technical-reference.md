# Technical reference

[← Back to diffract](../README.md)

A local Three.js visualization of the complex electric and magnetic fields throughout a three-dimensional volume. Thirty-six experiments are selected through previews of their apparatus, computed field structure and detector data. The detector samples the volume on the GPU as it moves; dragging does not invoke a propagation calculation or change the camera. Physical mirror, launch and input-phase adjustments update their analytical field on the GPU.

## Run

Install Git LFS before cloning, or retrieve its assets after cloning with `git lfs install` and `git lfs pull`. All `assets/fields/*.bin.gz` volumes, including previews, are stored in LFS. Fetch them before serving, testing, or building; a pointer file is not a usable field volume.

```powershell
node scripts/serve.mjs
```

Open http://127.0.0.1:5173/. Node 22 or later is required. No package installation, account, or external service is needed. Three.js and KaTeX are vendored with their licenses.

```powershell
node --test tests/*.test.mjs
node scripts/build.mjs
node scripts/serve.mjs --dist
```

The server binds only to loopback. Set `PORT` to change its port. The build prepares a complete static app in `dist/`, splitting the precomputed gzip volumes into content-addressed pieces no larger than 16 MiB. A generated manifest preserves their order, original length, and SHA-256. The browser streams the pieces together and decompresses the original bytes in its worker, with one part prefetched ahead. Source development continues to use the original Git LFS files. `node scripts/check-static.mjs` verifies all 56 reconstructed volumes against their source hashes. Cloudflare serves this build as static assets without server-side application code or R2. Hashed chunks are cached immutably; application modules revalidate. Settings are still never persisted.

## Interaction

Choose an experiment from the image strip. The URL records the selection, for example `/#trefoil` or `/#metamorphosis`; opening a link, reloading, and browser Back/Forward restore that setup. Unknown fragments fall back to the first experiment, the Michelson interferometer. Only the setup is encoded, not session display adjustments. Drag to orbit, right-drag to pan, or scroll to zoom. The distance slider and the handle below the detector both move its sampling plane continuously. The camera remains fixed during detector movement and full-resolution refinement.

Electric field, Energy and Phase are attached tabs at the top edge of the floating detector preview. Arrow keys move between tabs. The canvas spans the entire viewport, including behind the floating instruments. Scan, framing, information and settings controls sit in the lower-left corner of the viewport; settings open directly above their button without moving the preview or camera. On narrow screens the instruments occupy the area below the scene. Both the observation plane and preview follow the selected display: instantaneous signed electric component (RMS is optional), time-averaged axial flux, or optical phase. Palettes update the volume and both plane views. Brightness changes the display mapping, not the physical field. Optical phase defaults to the relative argument, $\arg(\widetilde E_y e^{-ikz})$, to expose diffraction structure without averaging many carrier cycles along a viewing ray. Instantaneous phase, $\arg(\widetilde E_y)-\omega t$, remains available. Changing palette rotates the cyclic phase hue reference.

The detector slider has exactly the preview's width and a 42–44 px interaction region, including dragging above and below the thin visible track. Diffraction distance scans start automatically. The Michelson instead moves its mirror at a fixed detector, the graded-index glass moves its launch, and the absorber changes input phase. Manual adjustment pauses the relevant motion. The microscope comparison starts paused. Cavities and total internal reflection expose optical-cycle motion; their observation position remains available in Scene settings. The floating play button controls the relevant motion. Optical-cycle animation is controlled separately in the Vectors settings. The framing control fits the optical setup with a camera transition. Most sculptural presets start with vectors off; the two field toggles remain available. Basic interference examples retain vectors where they help explain the field. Diffraction setups start with a ground grid and component labels. The instrument setups omit the grid; benches with several distinct parts start with their components labelled. The coordinate-axis widget has been removed. Labels avoid each other and the detector preview; less essential source labels are omitted on small screens. Scene labels and the detector handle remain hidden until the field and required geometry are ready. Pointer clicks have no focus outline; keyboard focus retains a background or brightness cue.

In the default palette, cyan arrows represent $\mathbf E/E_0$ and gold arrows represent $c\mathbf B/E_0$. Their fixed anchors follow the illuminated cross-section throughout the volume. Readable mode divides both instantaneous vectors at each anchor by the same complex-field envelope

$$a=\max\left(0.04,\sqrt{\frac{|\widetilde{\mathbf E}|^2+c^2|\widetilde{\mathbf B}|^2}{2E_0^2}}\right).$$

This preserves direction, time dependence and the local electric-to-magnetic amplitude ratio while making weak fields legible. Proportional mode uses one global scale, preserving amplitude comparisons between positions. Initial arrow size, density, volume density and cutoff are tuned per experiment in `src/display-presets.js`. Neither mode changes the calculated field or numerical probe. All three spatial axes have identical scale.

The translucent inspector extends from just below the catalogue to the controls and has three views: Light (palette, brightness, density, cutoff and relevant field-section controls), Vectors (independent electric/magnetic toggles, sampling, size, scaling and optical playback), and Scene (hardware, detector, component names, ground grid and camera). There is no nested fine-adjustments accordion. Every new setup and every reload restores its complete curated defaults; adjustments apply only to the currently displayed setup. Legacy saved preferences are removed. Reset this view restores the current setup’s defaults. For the double slit, a relative-phase control changes the physical superposition in real time; In phase and Opposed are reference states. The information dialog contains a compact transmission image, equations and model assumptions.

Click either detector view to inspect local instantaneous components and time-averaged axial flux. The preview supports arrow-key probe movement. Space pauses or resumes the main experiment motion, R resets the camera, and 1–9 select the first nine experiments. Temporary theme trials cycle with **T**, or **Shift+T** in reverse. They are Deepwater, Obsidian, Graphite, Nocturne and Lamplight. The current name appears briefly after cycling; the settings header contains no theme label. Themes change scene background, hardware/element lighting and display palette, with a smooth transition; physical fields and probe values are unchanged. They reset on reload. Optical playback starts enabled; interface transitions remain enabled under reduced motion, as requested.

Catalogue selection leaves visible cards in place. A clipped choice is revealed with a short, interruptible eased scroll; elapsed animation steps are bounded so a delayed frame does not snap the rail to its destination. Edge fades withdraw at the ends. Settings tabs fade in place, and continuous control updates are coalesced to one update per animation frame. Preview mode buttons update their selected state immediately, independently of the rendered crossfade. Labels and the detector handle require valid projected positions and a presented scene before becoming visible.

## Experiments

The catalogue alternates instruments, spatial field structures and material phenomena. These complete instruments have their own boundary calculations:

| Setup | Calculation and interaction | URL |
| --- | --- | --- |
| Michelson interferometer | A lossless 50:50 junction, coherent TE angular-spectrum beams, two returning mirror arms and complementary outputs. A translation stage moves the delay-mirror boundary and changes every angular component’s round-trip phase. | `/#michelson` |
| Phase-contrast microscope | A coherent 4f microscope converts an illustrative transparent phase specimen into intensity contrast using a quarter-wave, attenuating dot in the Fourier plane. The comparison removes or inserts the phase dot. | `/#phase-microscope` |
| Between two mirrors | Every retained plane-wave angle has its own infinite reflection sum. Both travel directions contribute to all five complex field components. | `/#fabry-perot` |
| Light between dielectric mirrors | Dielectric films form two Bragg mirrors around a half-wave defect. The same thicknesses and indices drive the geometry and calculation. | `/#bragg-cavity` |

The microscope is a coherent Zernike **phase-dot** demonstration, not a commercial annular-illumination microscope. Its two ideal thin lenses have focal length 20 wavelengths and a 10-wavelength pupil radius; the 0.85-wavelength phase dot multiplies the central field by $0.55i$. A 256-square angular spectrum on a 64-wavelength computational domain propagates between boundaries, with a smooth numerical-aperture cutoff from 0.52 to 0.65. The finite band limit slightly smooths the prescribed specimen. Its image arises from propagation and interference, without a target-image overlay. The specimen geometry is an illustrative membrane guide, not a microscopic dielectric-scattering calculation. Bright field removes the dot by coherently adding an independently propagated difference field. The image uses fixed incident-field exposure, so the comparison does not renormalize brightness. Shortcuts move the detector to the specimen, Fourier plane and image.

The Fabry–Pérot mirrors lie at 4 and 12 wavelengths, with power reflectivity 0.88. Their scattering matrices conserve energy, and their per-angle transmission obeys the Airy formula. The two-dimensional spectrum uses a 128-square transform on a 32-wavelength domain. This retains the same spectral support as a 256-square transform; their CPU fields agree to numerical precision at aligned samples. Stored axial spacing is 0.03 wavelengths to resolve counterpropagating fields after carrier removal. The microscope uses 0.5-wavelength axial spacing and both use 0.25-wavelength transverse samples. The GPU inverse FFT retains every mode of the prepared spectrum. Thin optical boundaries have finite display resolution.

The Michelson is vertically invariant and its ideal splitter lies on a diagonal plane through the arm axes. Its ports contain coherent angular spectra, not drawn ray cones. The adjustable mirror changes the second arm length, the reflection boundary and the phase of each angular component by its own longitudinal wave number. Finite splitter-edge diffraction, coating response and launch coupling are excluded. The multilayer is likewise vertically invariant and uses a lossless TE transfer matrix at every interface. Energy on the observation plane means mean density for both cavities and the Michelson, and forward axial flux for the microscope.

`tests/bench-fields.test.mjs` checks Michelson unitarity and vacuum curl equations within each port, multilayer interface continuity and power, the Fabry–Pérot Airy law, and phase-to-intensity conversion and non-increasing power through the microscope. `tests/browser/bench-audit.html` independently compares GPU fields against CPU inverse FFTs on both sides of optical elements. Measured relative field RMS errors were 0.021% (microscope) and 0.019% (Fabry–Pérot), consistent with binary16 storage. Run `node scripts/bake-instrument-previews.mjs` to regenerate all nine instrument and material-boundary thumbnails from calculated fields.

Two continuously adjustable additions solve different material problems:

- **Light bending through glass** (`/#grin`): $n^2(x)=n_0^2-a^2x^2$, with $n_0=1.65$ and $a=0.22/\lambda$. A displaced Gaussian launch is expanded into 22 Hermite–Gaussian TE modes with $\beta_m^2=k^2n_0^2-ka(2m+1)$. Their exact Helmholtz propagation constants produce curved motion and imperfect revivals. The input is prescribed inside the medium; entrance reflections and distant transverse boundaries are excluded. The occupied beam stays inside the positive-permittivity region. The visible block is a cutaway, not a hard-wall waveguide. [Graded-index propagation](https://opg.optica.org/ao/abstract.cfm?uri=ao-42-3-550).
- **Light controlling absorption** (`/#absorber`): two normally incident coherent plane waves meet a resistive sheet with $Z_0\sigma_s=2$. Its amplitudes are $r=-1/2$, $t=1/2$, so absorbed power is $A=\cos^2(\delta/2)$. The tangential electric field is continuous and the magnetic-field jump supplies the sheet current. The 0–100% meter reports dissipated power; it is not thermal radiation. The preview shows the local total field, including the incoming beam on that side. Finite width and height are viewing windows. [Coherent absorption in thin films](https://www.nature.com/articles/ncomms8031).

These two models and the Michelson update three floating-point GPU textures as their physical parameter changes. The display samples those fields without lowering its ray-marching quality. CPU reference probes use the same physical solution independently. `tests/live-instruments.test.mjs` checks Maxwell curls, film boundary conditions and power balance, modal power conservation, full-resolution asset construction, and microscope comparison. `tests/browser/live-audit.html` reads back the actual GPU solver outputs at nine parameter choices: field RMS discrepancies at grid samples from the independent CPU reference were 0.022–0.048%, consistent with binary16 storage. Longitudinal exposure metadata may use fewer samples than the full field; the complex field resolution is unchanged.

Three additional entries have their own material-boundary solvers. They are not aperture transmissions:

| Setup | Calculated behaviour | URL |
| --- | --- | --- |
| Whispering-gallery cavity | An azimuthally travelling TM mode inside a perfectly conducting cylindrical cavity | `/#circulator` |
| Light across a forbidden gap | TE beam reflection, evanescent penetration and transmission across a glass–air–glass gap | `/#tunnelling` |
| Evanescent exchange | Beating of exact even/odd TE supermodes in two parallel dielectric slab guides | `/#coupler` |

These fields are invariant vertically. The geometry exposes a finite-height cutaway, with every spatial axis at the same scale. This is a full vector field in a symmetric geometry, not a simulation of the scattering of finite-height blocks or guide ends. The cavity’s Energy detector samples mean energy density; the other two sample forward axial power flux. Their initial views and palettes reset independently of the previously selected experiment.

Highlighted setups explore topology, multi-plane holography and propagation past an obstruction:

- **Trefoil phase knot** (`/#trefoil`): a finite Laguerre–Gaussian superposition whose complex electric component has a closed, knotted zero. The pale trace is extracted from the propagated field by intersecting its real and imaginary zero surfaces; it is not an imposed geometric knot. It has three same-sign crossings in a regular projection. The detector marks intersections with the same extracted curve. This is a zero of $\widetilde E_y$, not necessarily of the complete vector field or energy density. Context and optimized modal coefficients: [Dennis et al., Isolated optical vortex knots](https://doi.org/10.1038/nphys1504). This implementation uses full angular-spectrum propagation and verifies that the topology survives the finite pupil and bandlimit.
- **Holographic metamorphosis** (`/#metamorphosis`): one complex-amplitude hologram creates a jellyfish at $16\lambda$, a logarithmic shell at $40\lambda$, and a butterfly at $64\lambda$. A 200-step, three-plane amplitude-error projection generates the boundary field. All three pictures emerge from propagation of that single boundary; neither the volume nor detector contains a pasted target image. Targets are deliberately broad enough for the finite numerical aperture. Context: [multi-plane hologram optimization](https://doi.org/10.1364/OE.27.008958); the implementation is its own complex-amplitude projection, not a reproduction of that paper's dynamic-compensation method.
- **Self-healing light** (`/#healing`): a finite Bessel field encounters an opaque disc of radius $2.3\lambda$ at $z=14\lambda$. The transmitted field is calculated at that second boundary, then propagated downstream. On-axis flux immediately behind the disc is about 1.0% of the unobstructed value; at $28\lambda$ it recovers to about 73%. Fixed exposure makes the loss and recovery visible. The disc absorbs power; recovery redistributes the surviving field and does not restore the lost total power. Context: [self-healing of structured light](https://doi.org/10.1364/OE.25.019147).
- **Linked phase rings** (`/#hopf`): two closed electric-component zero curves form a Hopf link. Independently counted oriented crossings give linking number $-1$. Each trace has a distinct colour, while the surrounding volume shows the calculated optical phase. Like the trefoil, this is a singularity annotation over a field, not a bright material wire or total-field null.
- **Saturn in light** (`/#saturn`): a complex hologram optimized over 15 axial sections concentrates light around three spherical great circles and two tilted orbital rings. It is a diffraction-broadened approximation: the calculated field does not reproduce a perfectly isolated wire sculpture. Switchable dashed **Design curves** distinguish the intended geometry from the computed volume. **Emphasize reconstruction** applies a smooth display window around the reconstruction depth; it changes neither stored fields nor detector/probe values. Mean flux on the design curves is over twice that at copies translated by $\pm8\lambda$. Context: [shaping light along three-dimensional curves](https://doi.org/10.1364/OE.21.020544); this implementation uses multi-plane complex-amplitude optimization rather than that paper's curve integral.

The knot and link thumbnails use their extracted curves; the metamorphosis thumbnail uses all three calculated image planes; the self-healing thumbnail uses a longitudinal field section. **Field detail** in Scene settings moves the camera close to the selected field structure. **Volume contrast** changes only the rendering transfer function. The full optical setup remains available through the framing button. The stationary knot traces are fine and translucent, while opaque markers identify detector intersections. Their marker opacity is independent of the zero field amplitude. The metamorphosis has three image-shaped focus buttons; scanning slows and dwells at the exact image depths. Optional contour guides show the design silhouette only near its respective plane, and do not alter the computed detector.

Further focus and diffraction setups include:

- **Autofocusing Airy ring** (`/#autofocus`): a finite radial Airy amplitude with alternating zero/pi phase. Its rings bend inward without an added focusing lens. The computed peak axial flux near $z=22\lambda$ is 17.55 times the maximum launch-plane flux. Fixed detector exposure is the default here, so that gain remains visible. The implementation integrates the Airy equation with cubic Hermite interpolation, checked against tabulated values and zeros. The binary-phase annuli use polar tessellation so their edges are circular rather than grid-shaped. Context: [Efremidis and Christodoulides, Abruptly autofocusing waves](https://opg.optica.org/ol/abstract.cfm?uri=ol-35-23-4045); [NIST Airy functions](https://dlmf.nist.gov/9.2).
- **Fork grating vortices** (`/#fork`): actual opaque fork stripes combined with a focusing phase. The two first orders have measured phase winding $+1$ and $-1$, with a bright zero order between them. Its rendered opaque fork coating and continuous quadratic focusing profile implement the same amplitude and phase as the original wrapped transmission, up to one global phase. Context: [Stoyanov et al., fork-grating diffraction](https://quantum.phys.uni-sofia.bg/dreischuh/A70.pdf).
- **Astigmatic focus** (`/#astigmatism`): unequal focusing phase in the two transverse directions. Vertical and horizontal line waists appear at different depths, with measured RMS widths $(0.611,1.627)\lambda$ at $z=18\lambda$ and $(2.250,1.147)\lambda$ at $z=34\lambda$. Nominal focal lengths do not equal the actual finite-beam waist positions. Context: [astigmatic Gaussian beam shaping](https://arxiv.org/abs/2506.22308).
- **Poisson spot** (`/#poisson`): a solid disc blocks the middle of a finite Gaussian beam. A central bright spot appears in its shadow. The disc has real thickness and an opaque depth silhouette in the renderer; its thin support is schematic and excluded from the transmission calculation. The on-axis electric field agrees within 1.18% with an independently integrated, nonparaxial Rayleigh–Sommerfeld annulus at the three tested distances. Context: [disk diffraction and Babinet's principle](https://doi.org/10.1051/0004-6361/201937208).

The detector has **Fixed** and **Adaptive** exposure. Fixed uses one reference peak over the complete propagation volume; adaptive interpolates the reference peak of the current plane. Neither changes the computed fields or probe values. Preview magnification is available in Light settings, or by scrolling over the preview; double-click restores the full window. Four corner marks on the 3D observation plane show exactly which area is enlarged. Pointer and keyboard probes use the enlarged coordinates. The focus experiments start with a useful magnification, and their thumbnails are cropped from the actual calculated field to make the structure legible. Even-density arrow grids retain an illuminated on-axis sample, so they cannot omit the centre of a focus.

The existing catalogue also includes a sunflower sieve, helical interference, a star aperture, a quasiperiodic aperture and a fractal aperture. Other setups include crossing Gaussian beams, rotating petals, an axicon, a cubic caustic, five spatial foci, an optical vortex, a Fresnel zone plate, a Talbot lattice, six coherent holes, a double slit, a circular aperture and a flat rabbit image. Thumbnails use the earlier diagram style: a legible transmission preview beside the calculated detector pattern, with the actual mesh thumbnail for the bunny. `scripts/bake-previews.mjs` regenerates these directly from the experiment data. Rendered-apparatus captures remain available separately under `assets/previews/rendered/`; the optional `?thumbnail=<experiment-id>` capture route and `scripts/compose-rendered-previews.mjs` can be used for a rendering audit, but are not the default gallery style.

The 3D bunny uses the Stanford scan: 35,947 vertices and 69,451 triangles. The full mesh sits in an illuminated recording arm beside the replay arm. A shared source feeds object and reference illumination; the object wave reaches a capture surface, which is connected through a processor to the replay plate. A separate laser and collimating lens illuminate that plate. The object-wave volume uses the spatially reflected, phase-conjugate counterpart of the computed replay field, so its mean energy retraces the same source-to-plate paths. The capture surface illustrates interference with the spherical reference from the drawn source position. Object illumination arrives from the sensor-facing side. A surface-depth texture crops the object-wave display at the actual sensor-facing bunny surface, so it does not continue behind the object. This crop affects display only. This is an idealized complex-field recording/conjugate-replay diagram, not a material-scattering calculation or a model of a particular camera acquisition algorithm. Area-weighted sampling gives 4,426 coherent surface sources at their actual 3D coordinates, spanning $18.6\lambda$ in depth around $z=32\lambda$. Gaussian source footprints of width $\sigma=0.40\lambda$ are distributed between $0.5\lambda$ depth layers. Each layer is back-propagated with the full angular-spectrum phase; their complex fields are added and normalized inside an $18\lambda$ radius pupil. The same vector propagator as every other setup then generates the electromagnetic fields. Fixed deterministic source phases retain coherent speckle. There is no flat target image pasted onto a detector.

The translucent bunny at the reconstruction is a switchable **surface guide**, identified in settings and optionally by world labels. Its brightness is sampled from the computed field, with a thin contour marking its intersection with the detector plane. It is an annotation, not the volumetric field itself. Turning it off leaves the fields and detector unchanged. The source mesh defines coherent surface sources; its reflectance and response to the drawn illumination are not solved. Surface occlusion, reflection and opaque-object scattering are excluded. Finite numerical aperture and coherent cross terms mean the reconstructed field is not a perfectly isolated luminous surface. The scanner's automatic range crosses its surface depths; the manual slider retains the full propagation range.

The sunflower sieve has 96 openings on a golden-angle spiral. Helical interference superposes finite $J_1$ vortex fields with opposite azimuthal charge and different longitudinal wave numbers; their bright lobes rotate with propagation. The star is a literal five-point polygonal opening. All three use the same vector propagation rather than animated geometric rays.

Exact transmissions and dimensions are defined in `src/experiments.js`. The rabbit mask is computed by back-propagating a smooth analytic rabbit-shaped target amplitude, band-limiting it, multiplying by a finite pupil and normalizing its transmission. Its target is a union of soft ellipses with an eye cutout, defined explicitly in `src/image-hologram.js`. The mask is complex amplitude-and-phase transmission, not phase-only. The target-plane bandlimit is one below $q=0.42$, tapers by a raised cosine to zero at $q=0.50$, and the square pupil is one through a half-width of $10.8\lambda$, tapering to zero at $12\lambda$. The image plane is $z=24\lambda$. The visible rabbit is calculated from propagated electromagnetic fields; no target image is pasted onto the detector.

Five foci encodes converging spherical waves aimed at five different depths. The caustic combines cubic and focusing phase on a finite Gaussian amplitude; it is not an infinite ideal Airy beam. The petal field superposes oppositely charged vortices with unequal absolute charges: its intensity pattern rotates with propagation distance, rather than with the monochromatic optical cycle. The quasiperiodic mask thresholds five oriented gratings; the fractal mask is a two-level Sierpinski carpet.

The helicon, rotating-petal, caustic and vortex elements have an equivalent geometrical relief derived from their actual wrapped transmission phase: $h=(\arg T+\pi)/\pi$ wavelengths at index contrast $0.5$. This is one thin-element realization of the prescribed phase, with material scattering excluded. The constant phase offset is immaterial. Separate attenuation represents the amplitude factor, and an opaque pupil stop surrounds the transmitting area. Their information-view previews encode phase by hue and amplitude by brightness. The bunny, five-focus and flat-image holograms instead use thin patterned wavefront displays representing ideal complex-amplitude modulation; their phase is not rendered as a glass sculpture. These are idealized implementations, not claims about a unique manufactured device. Binary openings are holes in a mounted absorbing screen, with laser illumination arriving through an upstream collimator. The screen has a muted slate finish and modest display transparency. Element display opacity changes compositing only, never physical transmission or computed diffraction. The lens has a convex profile and its support ends below the clear opening. The axicon has a conical profile illustrating the equivalent thin-phase element at an index contrast of 0.5. Crossing beams use three angled launch heads connected to a shared source and splitter, without a fictitious plate. Source bodies, fibres, lenses and their upstream beam envelopes are schematic optical hardware; propagation inside these components is not solved.

## Electromagnetic model

This section describes the 27 aperture-spectrum experiments. The three material-boundary models are described separately below.

Distances are measured in wavelengths, with $\lambda=532\,\mathrm{nm}$ in vacuum. The time convention is

$$\mathbf E(\mathbf r,t)=\Re\{\widetilde{\mathbf E}(\mathbf r)e^{-i\omega t}\},\qquad \omega=ck.$$

For the prescribed complex launch field $T(x,y)$, set $A=E_0 W\mathcal F\{T\}$. With $q_x=k_x/k$, $q_y=k_y/k$, and $q_z=\sqrt{1-q_x^2-q_y^2}$, each angular-spectrum mode has

$$\widetilde{\mathbf E}_{\mathbf k}=A(0,1,-q_y/q_z),\qquad c\widetilde{\mathbf B}_{\mathbf k}=A(-(1-q_x^2)/q_z,q_xq_y/q_z,q_x).$$

These satisfy both divergence constraints and the vacuum curl equations. Propagation uses the full $e^{ik_z z}$ phase, without a paraxial approximation. Fresnel and far-field behavior emerge from this same propagation. The tangential launch condition fixes $E_x=0$; the longitudinal electric field and all magnetic components are derived, not independently animated.

The angular window is one through $q_\perp=0.50$, a raised cosine between $0.50$ and $0.62$, and zero above $0.62$. The fields add coherently before detection:

$$\langle S_z\rangle=\frac{1}{2\mu_0}\Re(\widetilde{\mathbf E}\times\widetilde{\mathbf B}^{*})\cdot\hat{\mathbf z},\qquad I_0=\frac{\epsilon_0 c E_0^2}{2}.$$

Because $E_x=0$,

$$\langle S_z\rangle/I_0=-\Re[(\widetilde E_y/E_0)(c\widetilde B_x/E_0)^*].$$

The detector is a virtual sampling plane and does not scatter or absorb the drawn field. In Energy mode its image displays nonnegative forward flux, normalized by either the fixed global reference peak or an interpolated per-plane reference peak, multiplied by display brightness and given a 0.43 power curve to reveal faint features. Electric field and Phase instead show the corresponding field observable on that plane; they are not images a conventional intensity detector directly records. Numerical probe values stay linear. The electric-field section defaults to the cycle RMS, $E_{y,\mathrm{rms}}=|\widetilde E_y|/\sqrt{2}$, so detector translation does not mix in optical-cycle flashing. Light settings can restore instantaneous sampling. The volume and arrows still show instantaneous fields in Electric field mode. The main plane is translucent; the inset shows the isolated pattern. Both use the same sampling and colour function.

The self-healing setup adds a second prescribed absorbing boundary. It multiplies the propagated tangential electric component by the disc's transmission at $z=14\lambda$, reapplies the numerical-aperture window, derives the longitudinal and magnetic components again, and propagates that outgoing field. Vacuum equations and power conservation hold separately on each side. Reflection, induced currents and edge scattering inside the obstacle are not solved. Two distinct stored samples at the same axial coordinate retain the discontinuity without interpolating across it; CPU sampling, GPU sampling, preview decimation and the density cache share this piecewise indexing.

The default energy view uses

$$\langle u\rangle/u_0=(|\widetilde{\mathbf E}|^2+c^2|\widetilde{\mathbf B}|^2)/(2E_0^2),\qquad u_0=\epsilon_0E_0^2/2,$$

with square-root weighting before the display mapping. The phase view uses either the relative or instantaneous argument of the electric component, with amplitude weighting. After gain and cutoff, volume strength remains linear at contrast one, with exponential opacity accumulation. At other contrast values, strength is raised to the selected exponent relative to a fixed field reference. Deep cyan and mint shade the energy field; amber appears only in stronger regions. The supplied reference renderer's palette and exposure of 1 are retained. Baseline cutoff 0.035 and density 0.55 are adjusted modestly per experiment for visual clarity. Its opacity coefficient converts to 0.9044 per wavelength here; a factor $28/\max(z_{\max},28)$ compensates visually for these longer propagation volumes. These controls affect rendering only. The outgoing volume fades softly at its finite storage boundaries; this fade never changes detector or probe values.

For faster energy ray marching, a fourth half-float texture caches the scalar density and three local field-variation measures at the original spatial resolution. Interpolated density is corrected by $\frac12\sum_i f_i(1-f_i)G_i$, where $f_i$ is the interpolation fraction and $G_i$ averages squared complex-field differences to the two adjacent samples along axis $i$. This approximates the norm of the interpolated complex field more closely than interpolating scalar density alone. It is a display approximation, independently checked below. Detector flux and numerical probes still form their observables from the full interpolated complex fields. For a nonzero relative slit phase, volume energy uses the full coherent complex sum.

Opaque optical hardware writes a depth prepass. The ray marcher then composites the mask, detector and optional reconstruction guide at their actual depths, including volume segments in front of and behind each surface. Vector glyphs also use the element and guide depth and opacity, so a nearer plate attenuates arrows behind it. This avoids transparent planes being drawn over nearer objects solely because of scene submission order. Setting element display opacity to zero removes the sheet and relief from compositing while retaining the physical mount.

The relative slit phase uses exact coherent linearity: $F(\delta)=F(0)+(e^{i\delta}-1)F_R$, applied to every complex electric and magnetic component. The full right-opening field is precomputed separately. One phase uniform updates the volume, glyphs and both detectors; no propagation job is queued. Probe values apply the same superposition. Detector normalization uses the in-phase reference peak at each distance, so phase changes are not hidden by renormalizing each image.

The incoming field is an analytic plane wave, $\mathbf E/E_0=\hat{\mathbf y}\cos(kz-\omega t)$ and $c\mathbf B/E_0=-\hat{\mathbf x}\cos(kz-\omega t)$, visually cropped to the plate. Its join to the prescribed outgoing field is schematic. This is a band-limited prescribed-field model, not a material boundary-value solution: reflected and evanescent fields, aperture thickness, edge charges and material scattering are excluded. Individual outgoing modes satisfy Maxwell's equations; finite storage and interpolation introduce numerical error in displayed samples.

## Numerical resolution and performance

### Material-boundary models

`src/native-fields.js` evaluates monochromatic TE fields with the convention $e^{-i\omega t}$:

$$\widetilde{\mathbf E}=(0,\widetilde E_y,0),\qquad c\widetilde{\mathbf B}=\frac{1}{ik}(-\partial_z\widetilde E_y,0,\partial_x\widetilde E_y).$$

The cavity uses $\widetilde E_y=CJ_{18}(kr)e^{18i\phi}$, with $R=j_{18,1}/k$. The radial wall has zero tangential electric and normal magnetic field. End caps are perfectly conducting; the top is omitted graphically to reveal the interior. It is not a dielectric microresonator model.

The two guides have index $1.3$, width $0.5\lambda$ each, and gap $0.25\lambda$. Parity reduces the eigenproblem to a half-domain. Hyperbolic functions in the central gap, sine/cosine functions in the core and exponential tails outside are matched by continuity of $u$ and $u'$. The highest even and odd bound eigenvalues determine the fundamental supermodes. Equal-power normalization gives a transfer length of $9.0960\lambda$. Approximately 97% of the axial power alternates between half-spaces; the small remaining fraction is part of the exact solution.

Tunnelling uses two index-$1.7$ half-spaces, separated by $0.28\lambda$ of air. Forty-nine angular components surround $53^\circ$ incidence, all above the air critical angle. Matching both field and derivative retains the growing and decaying gap terms. The central component has $R=0.85518797$ and $T=0.14481203$, with $R+T=1$. At zero gap the transmission tends to unity; at large gap it tends to zero. The lateral angular factors are cached, so the accelerated row evaluation performs the same coherent sum without repeated trigonometric work.

The worker generates these fields directly at full resolution. Their transverse/axial spacings are at most $0.04\lambda/0.035\lambda$; tunnelling uses $0.02\lambda/0.018\lambda$ to resolve backward-wave interference. Two identical vertical rows represent exact vertical invariance. Binary16 textures use the existing complex interpolation path and restored carrier. Dielectric energy density includes $n^2|E|^2$, rather than incorrectly using the vacuum weighting inside glass. Discontinuous material densities and conducting-wall fields have a one-cell display boundary. The analytical tests check Maxwell residuals below $3\times10^{-4}$ in normalized units, interface continuity, power balance, core transfer, and off-grid reconstruction.

References: [cylindrical cavity modes, University of Texas](https://farside.ph.utexas.edu/teaching/jk1/lectures/node116.html); [frustrated total internal reflection, Physical Review A](https://journals.aps.org/pra/abstract/10.1103/PhysRevA.62.012112).

### Aperture-spectrum volumes

- Boundary fields use a $512^2$ FFT over $128\lambda\times128\lambda$, with $4^2$ area samples per launch pixel.
- Full volumes store all five nonzero complex components at transverse spacing $0.25\lambda$, aligned exactly with the propagation grid to avoid an extra interpolation. Transverse grids range from $113^2$ to $233^2$ samples; axial spacing is $0.5\lambda$, with experiment-specific travel of $42$–$96\lambda$.
- The common $e^{ikz}$ carrier is removed before binary16 storage and trilinear interpolation, then restored analytically. The implementation interpolates complex fields and forms flux afterward, preserving interference.
- Three half-float 3D textures retain the complex fields; a fourth accelerates the energy display at the same resolution. A detector input changes shader uniforms and the plane position, with no queued Fourier calculation.
- Each setup downloads a content-addressed angular spectrum of approximately 190–392 KiB, preserving every retained complex Fourier coefficient in Float64. A WebGL 2 worker applies the same longitudinal propagation phase and Maxwell component factors, then performs Float32 inverse FFTs. The preview uses a smaller transform only because the entire retained spectral support fits inside it; it samples the same field at the aligned preview-grid coordinates. Full resolution retains the original transform size, spatial grid, component layout and binary16 output. The two-sided obstruction includes both angular spectra and preserves the discontinuity.
- An aligned half-resolution preview ($\Delta x=\Delta y=0.5\lambda$, $\Delta z=1\lambda$) appears first, then crossfades to full resolution over 420 ms. The visible scene, detector controls and display defaults commit together only after the next field and hardware are ready. Superseded preview and full jobs are cancelled. Texture uploads use a frame-time budget. Full fields are cached up to three entries / 320 MiB, previews up to eight entries / 72 MiB (the active field is retained). Nearby compact spectra are prefetched without computing background volumes. Unsupported floating-point worker contexts use the original losslessly packaged volumes. Field resolution is never automatically reduced to improve frame rate.
- Preset changes crossfade a captured rendered frame into the new setup's framing. Camera reset keeps its own eased transition. Dragging avoids repeated layout reads, and unchanged LaTeX is not rendered again. Information equations are prepared in small idle tasks after scene presentation, avoiding a large typesetting task when opening the dialog.
- Geometry assets use lossless, content-addressed gzip packaging. A separate worker decompresses them and calculates the same Three.js vertex normals; all source vertices and faces are unchanged. Shader programs for both canvas and offscreen passes, including lit/unlit variants, are linked and their uniform/attribute tables prepared before presentation. Mask textures are uploaded in advance. This avoids deferred shader compilation during the scene crossfade.
- GPU field readback uses pixel-pack buffers and asynchronous fences, letting the GPU complete work without a synchronous `readPixels` stall. Texture uploads are split into at most 4 MiB batches, with asynchronous fences bounding the driver's transfer queue. Rendering is paced near 60 fps while preparing fields and up to 120 fps afterward, with additional headroom when measured GPU time requires it. Spatial resolution and ray-march quality remain unchanged. DOM label placement avoids interleaved layout reads and writes.
- Playback defaults to one optical cycle (about $1.775\,\mathrm{fs}$) per five seconds. This is a continuous-wave steady state. A source turning on requires a broadband, time-dependent calculation; the app does not fake that by progressively revealing an already-computed field. No particle motion is implied by the arrows.

To regenerate numerical data and thumbnails after changing an experiment:

```powershell
node scripts/prepare-bunny.mjs
node scripts/bake-fields.mjs
node scripts/bake-vortex-lines.mjs
node scripts/bake-elements.mjs
node scripts/bake-previews.mjs
node scripts/bake-spectra.mjs
```

Existing full volumes can supply fresh aligned previews with `node scripts/refine-previews.mjs`. Run `node scripts/bake-spectra.mjs` after changing full fields or previews. The element baker derives the relief meshes from the prescribed transmissions.

The preparation command derives the binary mesh and coherent source sample from the original PLY. The field baker accepts experiment IDs to rebuild a subset. The preview baker updates transmission masks, calculated detector patterns and neutral phase surfaces, then generates the diagram thumbnails. These calculations stay out of setup-switch interactions.

## Validation

The compact loading path has a separate all-sample comparison against all 56 stored preview/full volumes. On the tested WebGL implementation, the largest complex-field relative RMS difference was **0.0072%**, and the largest axial-flux relative RMS difference was **0.0165%**. These small Float32 FFT and binary16-rounding differences do not change the propagation model or grid. Run the local server and open `tests/browser/spectral-audit.html` to repeat the GPU audit; it reads the full reference library and reports pass/fail. The Node suite also checks every retained coefficient, both sides of the obstruction, aligned preview sampling, and cancellation.

Thirty-nine tests check FFT normalization, modal and finite-difference Maxwell equations, independent propagation, conservation of integrated power, coherent interference and extinction, analytic far-field minima, three-dimensional longitudinal components, storage precision, continuous interpolation, focusing, vortex charge and nulls, padding convergence, all five holographic targets, petal rotation, the rendered vector coordinate mapping, coherent right-slit phase mixing, shared vector normalization, on-axis glyph coverage, rabbit image formation, tabulated Airy and Bessel values, helicon rotation, actual bunny depth dependence and concentration at its surface, and the optical-path phase of every shipped relief mesh. The rabbit target/flux correlation is 0.933 at the image plane, versus 0.724 and 0.741 at the ends of the volume.

The complete 27-setup audit finds full-domain axial-power drift below $8\times10^{-13}$ and finite-difference Maxwell residuals below $0.001\%$ at the tested points. Those checks apply to the band-limited prescribed field, not to unsimulated material interfaces. The Poisson reference integrates the real-space Rayleigh–Sommerfeld kernel directly, independently of the FFT and modal basis. The nine added experiments also converge under doubled computational padding. `scripts/audit-new-fields.mjs` records axial intensity and transverse widths through the new volumes in `artifacts/physics-audit/new-fields.json`.

The earlier browser audit covers 22 experiments at near, selected and far distances, including uploaded GPU samples, rendered equations and camera invariance during detector movement. Screenshots and machine-readable diagnostics are in `artifacts/full-audit/`. During this Energy-view sweep at a 1280×720 CSS viewport, sampled detector input-to-render-submission latency stayed below 26 ms, GPU render time below 9 ms, and all 66 slider checks kept the camera unchanged. These are local observations, not device-independent performance guarantees. GPU/CPU sampling RMS differences stayed below 0.12% for complex fields and 0.18% for the density cache.

For the shipped volumes, comparison at 243 off-grid points per experiment across three distances gives complex-field RMS differences of 0.02–1.38%, axial-flux RMS differences of 0.03–2.11%, and cached-density RMS differences of 0.05–2.75% relative to direct propagation. These are sampled comparisons, not bounds at every point; relative errors near zeros can be larger. The maximum-distance double-slit detector differs from a twice-padded domain by 0.0107% of peak on the tested grid.

Flattening the bunny's surface depths changes its complex hologram (correlation 0.521). Mean calculated axial flux at the original surface is 0.256, versus 0.193 and 0.142 at copies translated by −14 and +14 wavelengths. These are reconstruction checks, not a claim of a speckle-free surface image. The finite helicon rotates −48.68° over 8 wavelengths, versus −47.78° for the ideal two-cone prediction.

DOM diagnostics on `#app` expose first-field time, recent frame time and input-to-render-submission latency. These are not display-scanout measurements. When supported, a GPU timer query reports rendering time separately. Browser performance depends on the GPU and viewport. Opening `?verify=1` additionally reads 120 uploaded complex-field components and 12 density samples back from the GPU, comparing them with CPU interpolation; normal viewing does not perform this readback. Near/far interaction screenshots and per-preset diagnostics are in `artifacts/interaction-audit/`; earlier numerical comparisons remain in `artifacts/setup-audit/`.

The creative-field audit adds numerical checks for the extracted trefoil and Hopf topology, concentration around the three-dimensional Saturn curves, image specificity at three depths, and core recovery after an intermediate absorber. The final three image/target intensity correlations are 0.926, 0.919 and 0.838; each is at least 0.25 higher than that target's correlation at the other two planes. Extracted nodal traces have component-amplitude RMS residuals below 0.05% of the volume reference amplitude. These tests use the shipped volume files, rather than just the design targets.

The subsequent browser sweep covers all **27 experiments**, with screenshots under `artifacts/creative-lab/browser/`. All 54 near/far detector checks kept the camera fixed. At a 1280×720 CSS viewport the sampled input-to-render-submission latency was at most 15.2 ms and GPU time at most 10.75 ms; GPU/CPU RMS differences were below 0.12% for complex fields and 0.18% for cached density. New information views were checked for KaTeX errors; phone (390×844) and tablet (768×1024) layouts were inspected. The final metamorphosis refinement was re-baked, visually inspected and included in a passing full 38-test rerun. Local timings are observations, not guarantees for other devices.

The presentation refinement has a passing **39-test** run in `artifacts/refinement/tests.log`, including the continuous fork profile's phase equivalence. All 27 setups were rendered and visually inspected with the new defaults; screenshots and sampled settings are in `artifacts/refinement/`. The exact three metamorphosis planes, first/last catalogue borders, phone (390×844), tablet (768×1024), and landscape (844×390) controls were also checked. The largest sampled GPU time in this sweep was 11.66 ms. Singularity annotations remain visible at zero amplitude; they do not alter the simulated field. No material scattering model or new field propagation approximation was introduced by these presentation changes.

## Source layout

| File | Purpose |
| --- | --- |
| `src/experiments.js` | Curated complex launch fields and angular spectra |
| `src/physics.js` | FFT and vector propagation core; retained reference fixtures |
| `src/volume-data.js` | Binary16 storage, loading and CPU trilinear sampling |
| `src/field-loader.worker.js` | Background decompression and display-data preparation |
| `src/geometry-loader.worker.js` | Lossless mesh decoding and surface-normal preparation off the UI thread |
| `src/spectral-volume.js` | Worker GPU inverse FFT retaining the complete angular spectrum |
| `src/energy-volume.js` | Scalar-density cache with interpolation correction |
| `src/gpu-validation.js` | Opt-in texture-upload and GPU-sampling validation |
| `src/render-shaders.js` | Volumetric fields, instantaneous vectors and detector flux |
| `src/scene3d.js` | Camera, GPU rendering and detector interaction |
| `src/optical-element.js` | Mounted apertures and phase elements |
| `src/setup-hardware.js` | Source, collimator and shared-beam hardware |
| `src/transmission.js` | Shared amplitude and phase encoding for mask textures |
| `src/settings.js` | Session-only grouped controls and large pointer targets |
| `src/display-presets.js` | Curated presentation defaults per setup |
| `src/themes.js` | Temporary background, lighting and palette trials |
| `src/presentation.css` | Glass settings panel, compact information and theme styling |
| `src/vector-samples.js` | Adaptive fixed anchors and physical-to-scene vector rotation |
| `src/bunny-hologram.js` | Layer-based CGH from the actual 3D surface |
| `src/bunny-model.js` | Source mesh and optional reconstruction guide |
| `src/bunny-recording.js` | Idealized object/reference recording arm and reciprocal field |
| `src/object-wave-window.js` | Display boundary at the sensor-facing object surface |
| `src/label-layout.js` | Component names and collision avoidance |
| `src/element-relief.js` | Transmission phase to physical relief geometry |
| `src/structured-fields.js` | Bessel, sunflower and star transmissions |
| `src/advanced-fields.js` | Airy ring, fork grating, astigmatic focus and Poisson-disc transmissions |
| `src/creative-fields.js` | Knotted and linked LG fields, finite Bessel launch and angular transfer |
| `src/holographic-scenes.js` | Three-image and 3D curve hologram optimization |
| `src/vortex-lines.js` | Simultaneous real/imaginary zero extraction through tetrahedra |
| `src/topology-view.js` | Computed singularity traces, section crossings and optional design guides |
| `src/workspace.css` | Floating desktop and narrow-screen instruments |
| `scripts/prepare-bunny.mjs` | Reproducible mesh and coherent surface sampling |
| `src/image-hologram.js` | Explicit target image and computed complex hologram |
| `src/app.js` | Minimal UI, field cache, LaTeX and probe values |
| `scripts/bake-fields.mjs` | Reproducible offline field calculation |
| `scripts/bake-vortex-lines.mjs` | Extract and verify the closed nodal curves from propagated fields |
| `scripts/bake-previews.mjs` | Scientific experiment previews |
| `tests/volumes.test.mjs` | Validation of the actual shipped 3D data |
| `tests/spectra.test.mjs` | Complete coefficient preservation and cooperative energy preparation |
| `tests/geometry-worker.test.mjs` | Exact source-mesh and normal equivalence through the geometry worker |
| `tests/browser/spectral-audit.html` | Every-sample GPU reconstruction comparison against all reference volumes |
| `tests/creative-fields.test.mjs` | Topology, distinct depth images, 3D target concentration and self-healing |

The propagation follows the [angular-spectrum method](https://phys.libretexts.org/Bookshelves/Optics/BSc_Optics_(Konijnenberg_Adam_and_Urbach)/06%3A_Scalar_diffraction_optics/6.04%3A_Angular_Spectrum_Method). Experiment context: [three-dimensional holography](https://www.physics.nyu.edu/grierlab/publication/curtis02/) and [rotating optical petals](https://pure.strath.ac.uk/ws/portalfiles/portal/6008098/OpExFerrisWheel.pdf). Three.js and KaTeX are MIT licensed; their licenses are in `vendor/`. Runtime scripts, mathematical fonts and field data are served locally.


The bunny scan is credited to the [Stanford University Computer Graphics Laboratory](https://graphics.stanford.edu/data/3Dscanrep/), obtained through [Open3D's BunnyMesh distribution](https://www.open3d.org/docs/release/python_api/open3d.data.BunnyMesh.html). Its redistribution terms are recorded in `assets/models/NOTICE.txt`. Additional context: [Helicon waves](https://www.sciencedirect.com/science/article/pii/0030401895006362), [Vogel aperture diffraction](https://opg.optica.org/ol/abstract.cfm?uri=ol-43-24-5969), and [point/layer computer-generated holography methods](https://trepo.tuni.fi/bitstream/handle/10024/216848/ACM_CSUR_Sahin_revised_submitted.pdf?isAllowed=y&sequence=1).

Recording/replay context: [TU Delft, holography](https://qiweb.tudelft.nl/aoi/holography/holography/). The displayed source-arm energy is reciprocal to the calculated replay field; the illumination hardware and reference-beam envelopes are schematic.
