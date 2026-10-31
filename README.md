<p align="center">
  <img src="docs/media/diffract.gif" alt="diffract — a calculated holographic wordmark passing through focus" width="900">
</p>

<p align="center"><strong>Electromagnetic diffraction, in three dimensions.</strong></p>
<p align="center">
  <a href="#explore">Explore</a> &nbsp;·&nbsp;
  <a href="#run-locally">Run locally</a> &nbsp;·&nbsp;
  <a href="#the-physics">The physics</a> &nbsp;·&nbsp;
  <a href="docs/technical-reference.md">Technical reference</a>
</p>

---

**diffract** lets you see the field between the optical element and the screen. Orbit an experiment, move its detector through space, and watch interference turn into rings, images, caustics, or knots.

Twenty-seven setups share the same vector propagation model. The three-dimensional field, electric and magnetic vectors, and detector all come from calculated complex fields. A small set of controls keeps the experiment in view; the deeper display settings stay tucked away.

## Explore

<table>
  <tr>
    <td width="33%"><img src="docs/media/knots.png" alt="A hologram and the calculated trefoil singularity curve" width="300"></td>
    <td width="33%"><img src="docs/media/metamorphosis.png" alt="Three different calculated images at three detector depths" width="300"></td>
    <td width="33%"><img src="docs/media/healing.png" alt="A Bessel beam interrupted by an opaque disc and recovering downstream" width="300"></td>
  </tr>
  <tr>
    <td><strong>Knotted phase</strong><br>Follow a trefoil or two linked rings through the zeros of a complex field.</td>
    <td><strong>Holographic metamorphosis</strong><br>One hologram. A jellyfish, a nautilus, and a butterfly at different depths.</td>
    <td><strong>Self-healing light</strong><br>Block the centre of a beam, then find the bright core further downstream.</td>
  </tr>
</table>

There are also three-dimensional bunny and Saturn reconstructions, abruptly autofocusing Airy rings, rotating interference patterns, vortex gratings, fractal and quasiperiodic apertures, and the familiar double slit.

- **Move through the field.** The detector samples on the GPU while you drag. It does not wait for a new propagation calculation.
- **Choose what you see.** Electric field, axial energy flux, or optical phase; independently switch electric and magnetic vectors on or off.
- **Look closer.** Inspect a point numerically, compare phase and amplitude, or change the relative phase of the two slits.
- **Keep a place.** Each setup has a shareable URL fragment, such as `/#trefoil`, `/#metamorphosis`, or `/#healing`.

Drag to orbit, scroll to zoom, and right-drag to pan. The preview slider moves the detector; touching it pauses the automatic scan. **Space** resumes or pauses scanning, **R** reframes the experiment, and **T** cycles the temporary lighting themes. Preferences reset on reload.

[Browse the experiments and their mathematics →](docs/technical-reference.md#experiments)

## Run locally

You need **Node.js 22+**, **Git LFS**, and a browser with **WebGL 2**. Runtime dependencies are vendored; precomputed field data is stored with Git LFS. No npm install or API key is needed.

After cloning, retrieve the field data before starting:

```sh
git lfs install
git lfs pull
node scripts/serve.mjs
```

Use a Git clone with LFS rather than GitHub's source ZIP, which may contain pointers in place of the field data. For deployments, fetch LFS assets before building so that `dist/` contains the actual simulation data.

Open **[127.0.0.1:5173](http://127.0.0.1:5173/)**.

```sh
# Check the numerical model and shipped data
node --test tests/*.test.mjs

# Build and preview the static application
node scripts/build.mjs
node scripts/serve.mjs --dist
```

The server binds to loopback. Set the `PORT` environment variable to use a different port. The build output in `dist/` can be served as static files.

The complete field collection, including previews, is about **2 GiB compressed**. The browser loads the selected experiment, with smaller previews and a bounded cache; it does not download the entire collection on arrival. First-load time depends on the host and connection.

### Deploy to Cloudflare

The production build is entirely static. It packages the original compressed fields into content-addressed files of at most 16 MiB, below Cloudflare's per-file limit. The browser streams these pieces together before decompression; no field samples or precision are changed. There is no server-side Worker code, database, or R2 bucket.

```sh
npm ci
git lfs pull
npm run build
node scripts/check-static.mjs
npx wrangler login
npx wrangler deploy
```

[`wrangler.jsonc`](wrangler.jsonc) attaches the site to **diffract.org**. For later updates, `npm run deploy` rebuilds and deploys. The full-size source volumes remain in Git LFS; generated chunks stay in the ignored `dist/` directory. [Cloudflare's static-asset pricing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) lists free, unlimited asset requests and no storage charge. Domain renewal and any GitHub LFS usage are separate.

## The physics

Each optical element prescribes a finite, band-limited complex exit field. An angular-spectrum calculation propagates it through vacuum. Every retained plane-wave mode obeys

$$
\mathbf{k}\cdot\widetilde{\mathbf{E}}=0,
\qquad
\widetilde{\mathbf{B}}=\frac{\mathbf{k}\times\widetilde{\mathbf{E}}}{\omega}.
$$

The longitudinal electric field and magnetic components are derived from these relations. Fresnel and far-field behaviour emerge from the same propagation, using the full longitudinal wave number. The detector's energy view shows the time-averaged axial Poynting flux.

**What the picture means matters.** The coloured volume makes an otherwise invisible field observable; its brightness and opacity are display mappings. Hologram outlines and singularity traces are identified guides. The model does not solve reflection, material scattering, aperture-edge charges, or evanescent fields. It is a monochromatic steady state, rather than a simulation of a source switching on.

The test suite covers Maxwell consistency, power conservation, independent diffraction references, numerical convergence, coherent interference, vortex topology, and the actual shipped field volumes.

[Model, assumptions, and equations](docs/technical-reference.md#electromagnetic-model) &nbsp;·&nbsp; [Numerical resolution](docs/technical-reference.md#numerical-resolution-and-performance) &nbsp;·&nbsp; [Validation](docs/technical-reference.md#validation)

## Inside the project

| Part | Responsibility |
| :--- | :--- |
| [`src/experiments.js`](src/experiments.js) | Optical transmissions, dimensions, and catalogue |
| [`src/physics.js`](src/physics.js) | Vector angular-spectrum propagation |
| [`src/scene3d.js`](src/scene3d.js) · [`src/render-shaders.js`](src/render-shaders.js) | Three-dimensional rendering and detector sampling |
| [`src/display-presets.js`](src/display-presets.js) | Curated display defaults |
| [`scripts/`](scripts/) | Reproducible field, geometry, and preview generation |
| [`tests/`](tests/) | Numerical and stored-data checks |

To change an experiment, update its boundary definition and regenerate the affected assets. The [development commands](docs/technical-reference.md#numerical-resolution-and-performance) and [source map](docs/technical-reference.md#source-layout) describe that workflow. Rendering changes should be checked both numerically and in the browser, including detector motion and narrow viewports.

<details>
<summary><strong>About the animated wordmark</strong></summary>

The opening animation is a small optical experiment of its own. A complex-amplitude hologram is formed by back-propagating the word **diffract**, applying a finite pupil, and propagating forward again with the application's vector angular spectrum. A detector travels away from the image plane and returns. The frames show calculated axial energy flux at fixed exposure; no text layer is pasted over the result.

[`scripts/bake-readme.mjs`](scripts/bake-readme.mjs) regenerates the animation and icon exports. It needs ImageMagick and FFmpeg, only for preparing the documentation assets. The committed raster target makes regeneration independent of installed fonts. [Generation parameters and numerical checks](docs/media/generation.json) accompany the artwork. A [still image](docs/media/diffract-poster.png) is also available.

</details>

## Acknowledgements

Built with [Three.js](https://threejs.org/) and [KaTeX](https://katex.org/). The bunny geometry comes from the [Stanford 3D Scanning Repository](https://graphics.stanford.edu/data/3Dscanrep/), via Open3D. Bundled dependencies retain their licences in [`vendor/`](vendor/); model attribution and redistribution terms are in [`assets/models/NOTICE.txt`](assets/models/NOTICE.txt). Research references are collected beside the corresponding [experiments](docs/technical-reference.md#experiments).
