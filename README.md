# Impression

A dark writing studio for serif type with natural, uneven ink bleed. Built with Vite, TypeScript, and Quill 2.

## Run locally

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates the static app in `dist/`. `npm test` checks deterministic ink placement and the spread limit.

## Use

- Write and format text in **Compose**. Choose EB Garamond, Libre Baskerville, Playfair Display, or Georgia.
- Adjust **Ink spread** and **Unevenness** for the document.
- Select letters or words in the editor to give them their own ink settings. **Keep clean** preserves their original outlines. **Reset ink** returns them to the document settings.
- **New impression** changes ink placement while preserving custom selections. **Original** compares against the clean type.
- Select **Process → Printed** and choose a starting look: **Custom print**, **Book print**, or **Rough paper**. Book print and Rough paper run ocrodeg's complete original print presets; their built-in textures stay part of the starting look.
- **Ink & paper** controls dark ink texture, fading, missing ink, stray specks, and paper grain. Fading and wear are independent of ink texture. In Custom print, choose Paper fibers or Fine grain.
- **Letter edges** controls rough, rounded, broken, and soft outlines.
- **Page shape** controls wavy lines, crooked placement, tilt, width, size, position, and quarter turns. Page movement carries clean selections and their preview highlights along with the lettering.
- **Reset effects** returns the chosen starting look to its defaults, preserving text, formatting, spread, and selection overrides. **Ink bleed** keeps the original renderer.
- Change the paper, spacing, alignment, or preview zoom. Export the current proof as a PNG at up to 2× resolution.
- The document saves in this browser on this device. There is no cloud document sync. Clearing browser storage removes the saved document.

## Rendering

The renderer preserves shaped text runs, then overlays localized SVG ink diffusion. A seeded, mean-reverting random walk controls coverage across letters. At maximum unevenness, automatic bleed coverage varies continuously from 30% to 100%; lower unevenness brings letters closer to the same coverage. Only an explicit clean selection or zero spread removes bleed. Spread stays bounded by the slider value; random placement does not amplify the filter kernel. Texture seeds are fixed, while rerolling only changes placement.

Selection overrides live inside Quill's Delta as an inline `ink` attribute, so Quill maintains their position through edits and undo/redo. The clean text remains underneath the ink; soft alpha masks avoid hard clipping of letter edges.

The PNG export embeds the selected bundled font before rasterizing. Georgia uses the system's installed serif font. The initial proof is 720 × 900 units and grows vertically with the text. Ink editing and export run in the browser. Latin font subsets are bundled; other scripts use the browser's serif fallback. This first version uses left-to-right line layout.

## Sources

- [Quill documentation](https://quilljs.com/docs/quickstart)
- [Quill API](https://quilljs.com/docs/api)
- [SVG filter effects](https://www.w3.org/TR/filter-effects-1/)
- [Fontsource](https://fontsource.org/) — locally bundled open-source serif typefaces

Fonts retain their upstream licenses in their packages. Quill uses the BSD-3-Clause license.

## Browser print engine

Printed mode executes the actual [NVlabs/ocrodeg](https://github.com/NVlabs/ocrodeg) Python module inside [Pyodide](https://pyodide.org/en/stable/) in a module Web Worker. No GPU or server processing is required. First use downloads the pinned runtime, NumPy, SciPy, and upstream source; an internet connection is needed for that load. Text and image pixels stay in the browser. Ordinary ink mode does not load the Python runtime.

The worker connects the complete `printlike_multiscale` and `printlike_fibrous` helpers using their original default arguments. Custom print separately composes the upstream primitives with the existing shaped text mask. Book print and Rough paper match the upstream grayscale output before paper-color tinting, protection of explicit clean selections, and any extra effects the user enables. These presets already contain texture and blotches; use Custom print to control those individually.

| Visible setting | Implementation |
| --- | --- |
| Book print / Rough paper | `printlike_multiscale` / `printlike_fibrous`, original defaults |
| Ink texture / Paper grain | `make_multiscale_noise`, `make_multiscale_noise_uniform`, `make_fibrous_image` |
| Faded ink | Independent blend of ink toward the selected paper color |
| Missing ink / Stray ink | `random_blobs`, separately erasing / adding ink; full presets also use `random_blotches` |
| Rough edges | `bounded_gaussian_noise` + `distort_with_noise` |
| Rounded edges / Broken edges | `binary_blur`, with independent blur-radius and noise controls |
| Soft edges | SciPy Gaussian blur, as in the upstream examples |
| Wavy lines | `noise_distort1d` + `distort_with_noise` |
| Crooked impression | Seeded `random_transform` + `transform_image` |
| Tilt / Letter width / Size / Position | Explicit `transform_image` parameters |
| Turn text | Quarter-turn rotation, fitted to the existing page |

Custom texture keeps most ink dark. Missing ink has a strong visible maximum and does not depend on the texture slider. Each effect has its own deterministic random stream, so adjusting one effect does not reshuffle unrelated fields. A small `pylab` compatibility module maps the two NumPy random functions ocrodeg uses, avoiding a plotting-library download.

Clean selections preserve their glyph mask and solid ink after page movement. Paper texture continues behind them, including the library presets. Selection highlights follow page movement and are excluded from export. Renders use seeded Python and NumPy generators. Editing stays responsive, and pending changes are coalesced so a stale print cannot replace a newer document. Errors leave the SVG proof usable and show a Retry action. The current successful printed bitmap is also the PNG export, excluding editor selection highlights.

Printed proofs render at up to 2× resolution, capped at three million pixels and 8,192 pixels in height to bound browser memory. Long documents can therefore export at a lower scale. Preview and exported PNG use the same bitmap.

Pinned dependencies:

- Pyodide `314.0.7`, loaded from its documented jsDelivr distribution.
- ocrodeg commit `21109cb4ea0ff90306658e904a3a7b36c1e4f6b7`, loaded directly from the upstream source repository at first use.
- Source integrity: SHA-256 `8599b658a9c92e82eee47460766f937210e7e04edb68088a0bcef95bd644f71d`.

Upstream credit: ocrodeg by Thomas Breuel / NVIDIA. The upstream source is not bundled into this repository.


## Verification

`npm test` covers seeded ink, saved-setting compatibility, control limits, preset resets, and output dimensions. `npm run build` type-checks and builds the browser worker.

`tests/test_print_pipeline.py` checks every effect, visible maximum wear, dark texture versus fading, exact upstream preset output, deterministic seeds, clean selections, transformed selection overlays, offset directions, and empty input. It needs Python with NumPy and SciPy and the pinned upstream `degrade.py` saved as `ocrodeg.py` in a separate directory:

```sh
OCRODEG_SOURCE_DIR=/path/to/pinned-ocrodeg python3 tests/test_print_pipeline.py
```

The upstream source remains external to this repository. Use the commit and integrity hash listed above. Browser checks cover WebAssembly execution, visible controls, selection editing, PNG export, and the original rendering mode.
