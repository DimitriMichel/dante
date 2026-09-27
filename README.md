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
- Select **Process → Printed · ocrodeg** for ink texture, paper grain, and print wear. Choose **Fibrous paper** or **Fine grain**, then adjust ink texture and paper grain independently. **Ink bleed** keeps the original renderer.
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

The worker uses ocrodeg's multiscale noise, fibrous paper, and random blotch functions. Impression composes those fields with the existing shaped text mask, chosen paper color, and protected selections. This is a selection-aware integration of the upstream primitives, rather than an unchanged call to its full-page `printlike_*` helpers. A small `pylab` compatibility module maps the two NumPy random functions ocrodeg uses, avoiding an unnecessary plotting-library download.

Clean selections preserve their glyph mask and solid ink; the paper texture continues behind them. Renders use seeded Python and NumPy generators. Editing stays responsive, and pending changes are coalesced so a stale print cannot replace a newer document. Errors leave the SVG proof usable and show a Retry action. The current successful printed bitmap is also the PNG export, excluding editor selection highlights.

Printed proofs render at up to 2× resolution, capped at three million pixels and 8,192 pixels in height to bound browser memory. Long documents can therefore export at a lower scale. Preview and exported PNG use the same bitmap.

Pinned dependencies:

- Pyodide `314.0.7`, loaded from its documented jsDelivr distribution.
- ocrodeg commit `21109cb4ea0ff90306658e904a3a7b36c1e4f6b7`, loaded directly from the upstream source repository at first use.
- Source integrity: SHA-256 `8599b658a9c92e82eee47460766f937210e7e04edb68088a0bcef95bd644f71d`.

Upstream credit: ocrodeg by Thomas Breuel / NVIDIA. The upstream source is not bundled into this repository.
