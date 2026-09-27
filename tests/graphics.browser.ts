import { fontOptions } from '../src/fonts';
import { InkRenderer } from '../src/render';
import { engravingArt, type EngravingKind } from '../src/engraving-art';
import { PrintEngine } from '../src/print-engine';
import { printDefaults } from '../src/print-settings';
import { rasterizeProof } from '../src/export';
import type { Graphic } from '../src/graphics';

const output = document.querySelector('#results')!;
const results: { name: string; detail?: unknown }[] = [];
const renderer = new InkRenderer(document.querySelector('#proof')!);
const engine = new PrintEngine(status => { output.textContent = JSON.stringify({ results, status }, null, 2); });
function check(ok: unknown, message: string) { if (!ok) throw new Error(message); }
const graphic: Graphic = { id: 'engraving-qa', kind: 'elephant', x: 220, y: 220, size: 280, lines: 5, weight: 1.2, gap: 18 };
const options = { family: fontOptions.garamond.family, size: 28, leading: 1.5, spread: 0, variation: 30, seed: 55, paper: 'none', original: true, graphics: [graphic] };
try {
  await document.fonts.load('28px \"EB Garamond\"');
  for (const kind of Object.keys(engravingArt) as EngravingKind[]) {
    graphic.kind = kind;
    renderer.render([{ insert: '\n' }], options);
    const rgba = await rasterizeProof(renderer.root, renderer.width, renderer.height, 'garamond', 'EB Garamond', 1);
    const pixels = rgba.getContext('2d')!.getImageData(0, 0, rgba.width, rgba.height).data;
    let ink = 0, visible = 0, alphaMass = 0;
    for (let i = 0; i < pixels.length; i += 4) { if (pixels[i + 3] > 128) ink++; if (pixels[i + 3] > 0) visible++; alphaMass += pixels[i + 3] / 255; }
    // Measure coverage, including fine gray lines, instead of requiring solid black areas.
    check(alphaMass > 80, `${kind} missing from rasterized export`);
    check(visible < graphic.size * graphic.size * .55, `${kind} has an opaque scan background`);
    check(pixels[3] === 0, `${kind} lost transparent page`);
    const mask = await rasterizeProof(renderer.root, renderer.width, renderer.height, 'garamond', 'EB Garamond', 1, true);
    const maskPixels = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height).data;
    let dark = 0, maskMass = 0;
    for (let i = 0; i < maskPixels.length; i += 4) { if (maskPixels[i] < 128 && maskPixels[i + 3] === 255) dark++; maskMass += (255 - maskPixels[i]) / 255; }
    check(maskMass > 80 && Math.abs(maskMass - alphaMass) < Math.max(20, alphaMass * .03), `${kind} missing or changed in print mask: alpha=${alphaMass}, mask=${maskMass}`);
    results.push({ name: `${engravingArt[kind].label}: embedded image, transparent scan paper, print mask`, detail: { ink, visible, dark, alphaMass, maskMass } });
  }
  graphic.kind = 'elephant';
  const mixed: Graphic[] = [{...graphic, id: 'orbit', kind: 'ai-neural-network', x: 256, y: 177, size: 220}, {...graphic, id: 'waves', kind: 'money-guilloche', x: 90, y: 325, size: 220}, {...graphic, x: 350, y: 385}, {...graphic, id: 'chip', kind: 'tech-microprocessor', x: 90, y: 720}];
  renderer.render([{ insert: 'A little more human.' }, { insert: '\n', attributes: { header: 1 } }, { insert: '\nThere is a certain beauty in the things that refuse to be perfect. A softened edge. An uneven impression. The small trace of a hand at work.\n\nLet the ink wander. Let some letters hold their shape. Give others a little room to become something of their own.\n\nNot every mark needs to be the same.\n' }], { ...options, original: false, spread: 43, variation: 94, graphics: mixed });
  const detached = renderer.root.cloneNode(true) as SVGSVGElement;
  const liveMask = await rasterizeProof(renderer.root, renderer.width, renderer.height, 'garamond', 'EB Garamond', 1, true);
  const detachedMask = await rasterizeProof(detached, renderer.width, renderer.height, 'garamond', 'EB Garamond', 1, true);
  const livePixels = liveMask.getContext('2d')!.getImageData(0, 0, liveMask.width, liveMask.height).data;
  const detachedPixels = detachedMask.getContext('2d')!.getImageData(0, 0, detachedMask.width, detachedMask.height).data;
  let cornerInk = 0;
  for (let y = 457; y < 467; y++) for (let x = 405; x < 415; x++) if (livePixels[(y * liveMask.width + x) * 4] < 128) cornerInk++;
  results.push({ name: 'Mixed artwork corner ink', detail: cornerInk });
  check(cornerInk < 25, 'Engraving became an opaque rectangle in a mixed text/graphic print');
  check(livePixels.every((value, i) => value === detachedPixels[i]), 'Detached print job changed image filters');
  const job = { ...printDefaults, ...options, graphics: mixed, key: 'qa', font: 'garamond', label: 'EB Garamond', root: detached, width: renderer.width, height: renderer.height, cells: renderer.cells, selection: null, texture: 55, paperGrain: 30, wear: 20, roughness: 0 };
  const clean = await engine.render(job);
  const worn = await engine.render({ ...job, key: 'worn', roughness: 35, wear: 80, texture: 65 });
  const inkCount = (pixels: Uint8ClampedArray) => pixels.reduce((n, value, i) => n + Number(i % 4 === 3 && value > 128), 0);
  const cleanInk = inkCount(clean.pixels), wornInk = inkCount(worn.pixels);
  check(cleanInk > 4000 && wornInk > 1000 && wornInk < cleanInk, 'Print wear did not affect engraving');
  check(worn.pixels[3] === 0 && worn.graphics.length === mixed.length, 'Transparent print or graphic placement missing');
  const canvas = document.createElement('canvas'); canvas.width = worn.width; canvas.height = worn.height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(worn.pixels), worn.width, worn.height), 0, 0);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'));
  const image = await createImageBitmap(blob);
  const copy = document.createElement('canvas'); copy.width = image.width; copy.height = image.height;
  copy.getContext('2d')!.drawImage(image, 0, 0); image.close();
  const decoded = copy.getContext('2d')!.getImageData(0, 0, copy.width, copy.height).data;
  check(inkCount(decoded) === wornInk && decoded[3] === 0, 'PNG encoding lost engraving or alpha');
  results.push({ name: 'Full print effects and transparent PNG round trip', detail: { cleanInk, wornInk, pngBytes: blob.size } });
  output.textContent = JSON.stringify({ passed: true, results }, null, 2);
} catch (error) { output.textContent = JSON.stringify({ passed: false, results, error: String(error), stack: (error as Error).stack }, null, 2); }
finally { engine.stop(); }
