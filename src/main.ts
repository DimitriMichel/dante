import Quill from 'quill';
import { Attributor, Scope } from 'parchment';
import { createIcons, ArrowDownToLine, ChevronDown, Shuffle, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, Plus, Minus, Check, RotateCcw, SlidersHorizontal, ArrowUpRight, X } from 'lucide';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-700.css';
import '@fontsource/eb-garamond/latin-700-italic.css';
import '@fontsource/libre-baskerville/latin-400.css';
import '@fontsource/libre-baskerville/latin-400-italic.css';
import '@fontsource/libre-baskerville/latin-700.css';
import '@fontsource/libre-baskerville/latin-700-italic.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-700-italic.css';
import 'quill/dist/quill.core.css';
import './style.css';
import { InkRenderer, type Op } from './render';
import { PrintEngine, type PrintJob } from './print-engine';
import { printDefaults, printSettings, type PrintSettings } from './print-settings';

const fontOptions = {
  garamond: { label: 'EB Garamond', family: '"EB Garamond", Georgia, serif' },
  baskerville: { label: 'Libre Baskerville', family: '"Libre Baskerville", Georgia, serif' },
  playfair: { label: 'Playfair Display', family: '"Playfair Display", Georgia, serif' },
  georgia: { label: 'Georgia', family: 'Georgia, serif' },
};
type FontKey = keyof typeof fontOptions;
type State = PrintSettings & { font: FontKey; size: number; leading: number; spread: number; variation: number; seed: number; paper: string; ops: Op[] };
const defaultOps: Op[] = [
  { insert: 'A little more\nhuman.', attributes: {} },
];
// Each heading has its own block attributes; the editor owns all text and formatting.
defaultOps.splice(0, defaultOps.length,
  { insert: 'A little more human.' }, { insert: '\n', attributes: { header: 1 } }, { insert: '\n' },
  { insert: 'There is a certain beauty in the things that refuse to be perfect. A softened edge. An uneven impression. The small trace of a hand at work.\n\n' },
  { insert: 'Let the ink wander.', attributes: { italic: true } },
  { insert: ' Let some letters hold their shape. Give others a little room to become something of their own.\n\n' },
  { insert: 'Not every mark needs to be the same.\n' },
);
const defaults: State = { ...printDefaults, font: 'garamond', size: 28, leading: 1.5, spread: 43, variation: 94, seed: 55, paper: '#f1ede4', ops: defaultOps };
const storageKey = 'impression.document.v1';
function readSaved(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!saved || !Array.isArray(saved.ops)) return structuredClone(defaults);
    return { ...defaults, ...saved, ...printSettings(saved), font: saved.font in fontOptions ? saved.font : 'garamond',
      size: Number.isFinite(saved.size) ? Math.min(48, Math.max(18, saved.size)) : 28,
      ops: saved.ops.filter((op: Op) => typeof op.insert === 'string') };
  } catch { return structuredClone(defaults); }
}
let state = readSaved();
let selection: { index: number; length: number } | null = null;
let cursorRange = { index: 0, length: 0 };
let selectionScope = false, original = false, zoom = 1, renderFrame = 0;
let fontRevision = 0;
let localSpread = state.spread, localVariation = state.variation;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const icon = (name: string) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
$('#app').innerHTML = `
  <header class="app-header">
    <a class="brand" href="./" aria-label="Impression home"><span class="monogram">i</span><span>impression<span class="brand-dot">.</span></span></a>
    <span class="header-divider"></span><span class="app-description">A little more human.</span>
    <div class="header-actions"><span id="save-status" class="save-status" role="status"><span class="status-dot"></span>Saved on this device</span><button id="export" class="primary">${icon('arrow-down-to-line')}<span>Export PNG</span></button></div>
  </header>
  <main class="workspace">
    <section class="compose-panel" aria-label="Text editor">
      <div class="panel-heading"><div><span class="step">01</span><h1>Compose</h1></div><div class="history"><button id="undo" class="icon-button" aria-label="Undo" title="Undo (⌘Z)">${icon('undo-2')}</button><button id="redo" class="icon-button" aria-label="Redo" title="Redo (⌘⇧Z)">${icon('redo-2')}</button></div></div>
      <div class="toolbar" role="toolbar" aria-label="Text formatting">
        <div class="font-select"><select id="font" aria-label="Serif font">${Object.entries(fontOptions).map(([key, f]) => `<option value="${key}">${f.label}</option>`).join('')}</select>${icon('chevron-down')}</div>
        <label class="size-field"><input id="font-size" aria-label="Font size" type="number" min="18" max="48" step="1"/><span>px</span></label>
        <span class="toolbar-divider"></span>
        <button id="bold" class="icon-button type-button" aria-label="Bold" title="Bold (⌘B)" aria-pressed="false"><b>B</b></button><button id="italic" class="icon-button type-button italic" aria-label="Italic" title="Italic (⌘I)" aria-pressed="false">I</button>
        <select id="heading" aria-label="Paragraph style"><option value="0">Text</option><option value="1">Heading</option><option value="2">Subheading</option></select>
      </div>
      <div class="editor-area"><div id="editor"></div></div>
      <div class="editor-meta"><span id="word-count"></span><span>Select text to give it its own impression.</span></div>
      <section class="ink-controls" aria-labelledby="ink-title">
        <div class="controls-heading"><h2 id="ink-title">${icon('sliders-horizontal')}Ink & character</h2><div class="scope-switch" aria-label="Ink scope"><button id="document-scope" class="active" aria-pressed="true">Document</button><button id="selection-scope" disabled aria-pressed="false">Selection</button></div></div>
        <div id="selection-caption" class="selection-caption" hidden><span id="selected-text"></span><button id="clear-selection" class="icon-button" title="Clear selection" aria-label="Clear selection">${icon('x')}</button></div>
        <div class="slider-row"><label for="spread">Ink spread</label><output id="spread-value" for="spread"></output><input id="spread" aria-label="Ink spread" type="range" min="0" max="100"/><div class="range-captions"><span>Fine</span><span>Saturated</span></div></div>
        <div class="slider-row"><label for="variation">Unevenness</label><output id="variation-value" for="variation"></output><input id="variation" aria-label="Unevenness" type="range" min="0" max="100"/><div class="range-captions"><span>Uniform</span><span>Wandering</span></div></div>
        <div class="ink-actions"><button id="reroll" class="subtle">${icon('shuffle')}New impression</button><div id="selection-actions" hidden><button id="keep-clean" class="text-button">Keep clean</button><button id="use-document" class="text-button" title="Remove custom ink from the selection">Reset ink</button></div><span id="seed-label" class="seed-label"></span></div>
      </section>
    </section>
    <section class="proof-panel" aria-label="Live ink preview">
      <div class="panel-heading"><div><span class="step">02</span><h2>Impression</h2><span class="live"><span></span>Live</span></div><div class="view-switch" aria-label="Preview mode"><button id="view-ink" class="active" aria-pressed="true">Ink bleed</button><button id="view-original" aria-pressed="false">Original</button></div></div>
      <div class="print-toolbar">
        <label class="finish-label" for="finish">Process <select id="finish" aria-label="Rendering process"><option value="ink">Ink bleed</option><option value="print">Printed · ocrodeg</option></select></label>
        <span id="print-status" role="status">Instant ink preview</span><button id="print-retry" class="text-button" hidden>Retry</button>
      </div>
      <div id="print-settings" class="print-settings" hidden>
        <label for="paper-style">Texture <select id="paper-style" aria-label="Print paper texture"><option value="fibrous">Fibrous paper</option><option value="multiscale">Fine grain</option></select></label>
        <label class="print-range" for="texture">Ink texture <input id="texture" type="range" min="0" max="100" aria-label="Ink texture strength"/><output id="texture-value"></output></label>
        <label class="print-range" for="paperGrain">Paper grain <input id="paperGrain" type="range" min="0" max="100" aria-label="Paper grain strength"/><output id="paperGrain-value"></output></label>
        <label class="print-range" for="wear">Wear <input id="wear" type="range" min="0" max="100" aria-label="Print wear"/><output id="wear-value"></output></label>
      </div>
      <div class="proof-stage"><div class="paper-wrap"><div class="paper-topline"><span id="proof-font"></span><span id="proof-caption">AN ORIGINAL IMPRESSION</span></div><div class="proof-sheet"><svg id="proof" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Live paper proof of your text"></svg><canvas id="printed-proof" role="img" aria-label="ocrodeg printed proof" hidden></canvas><svg id="print-selection" aria-hidden="true"></svg></div><div class="paper-bottomline"><span id="proof-details"></span><span>MADE TO BE IMPERFECT.</span></div></div></div>
      <footer class="proof-footer"><div class="paper-picker" aria-label="Paper color"><span>Paper</span><button data-paper="#f1ede4" class="swatch warm" aria-label="Warm paper" title="Warm paper" aria-pressed="true"></button><button data-paper="#fbfaf7" class="swatch white" aria-label="White paper" title="White paper" aria-pressed="false"></button><button data-paper="#e5dac3" class="swatch oat" aria-label="Oat paper" title="Oat paper" aria-pressed="false"></button></div><div class="layout-controls"><button id="align" class="icon-button" aria-label="Text alignment: left" title="Cycle text alignment">${icon('align-left')}</button><select id="leading" aria-label="Line spacing"><option value="1.3">1.3×</option><option value="1.5">1.5×</option><option value="1.7">1.7×</option></select><span class="toolbar-divider"></span><button id="zoom-out" class="icon-button" aria-label="Zoom out">${icon('minus')}</button><button id="zoom-fit" class="text-button" title="Fit paper to view">Fit</button><button id="zoom-in" class="icon-button" aria-label="Zoom in">${icon('plus')}</button></div></footer>
    </section>
  </main><div id="toast" role="status" class="toast"></div>`;
const icons = { ArrowDownToLine, ChevronDown, Shuffle, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, Plus, Minus, Check, RotateCcw, SlidersHorizontal, ArrowUpRight, X };
createIcons({ icons });
class InkAttribute extends Attributor {
  canAdd(node: HTMLElement, value: string) { return /^(clean|\d{1,3},\d{1,3})$/.test(value) && super.canAdd(node, value); }
}
Quill.register(new InkAttribute('ink', 'data-ink', { scope: Scope.INLINE }), true);
const quill = new Quill('#editor', { placeholder: 'Leave your impression…', formats: ['bold', 'italic', 'header', 'align', 'ink'], modules: { toolbar: false, history: { userOnly: false } } });
quill.root.setAttribute('aria-label', 'Write your text'); quill.root.setAttribute('role', 'textbox'); quill.root.setAttribute('aria-multiline', 'true'); quill.root.spellcheck = false;
quill.setContents(state.ops as never, 'silent'); quill.history.clear();
const renderer = new InkRenderer(document.querySelector<SVGSVGElement>('#proof')!);
function toast(message: string) { $('#toast').textContent = message; $('#toast').classList.add('visible'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => $('#toast').classList.remove('visible'), 2600); }
let toastTimer = 0;
function save() {
  state.ops = quill.getContents().ops as Op[];
  try { localStorage.setItem(storageKey, JSON.stringify(state)); $('#save-status').innerHTML = '<span class="status-dot"></span>Saved on this device'; }
  catch { $('#save-status').textContent = 'Device storage unavailable'; }
}
const printCanvas = $<HTMLCanvasElement>('#printed-proof');
const printSheet = $('.proof-sheet');
const printSelection = document.querySelector<SVGSVGElement>('#print-selection')!;
let desiredPrint: PrintJob | null = null, printedKey = '', failedPrintKey = '';
let printTask: Promise<void> | null = null, printTimer = 0;
const engine = new PrintEngine(message => { if (state.finish === 'print' && !original) $('#print-status').textContent = message; });
function showPrinted(show: boolean) {
  printCanvas.hidden = !show; printSheet.classList.toggle('has-print', show);
  printSelection.style.display = show ? 'block' : 'none';
}
function showPrintSelection() {
  printSelection.setAttribute('viewBox', renderer.root.getAttribute('viewBox')!);
  const highlight = renderer.root.querySelector('[data-selection]');
  printSelection.replaceChildren(...(highlight ? [highlight.cloneNode(true)] : []));
}
function printReadyStatus() { $('#print-status').textContent = `Printed locally · ${printCanvas.width} × ${printCanvas.height}`; }
async function ensurePrinted(): Promise<void> {
  clearTimeout(printTimer);
  if (printTask) return printTask;
  printTask = (async () => {
    while (desiredPrint && printedKey !== desiredPrint.key && state.finish === 'print' && !original) {
      const job = desiredPrint;
      if (failedPrintKey === job.key) break;
      try {
        const proof = await engine.render(job);
        if (desiredPrint?.key !== job.key) continue;
        printCanvas.width = proof.width; printCanvas.height = proof.height;
        printCanvas.getContext('2d')!.putImageData(new ImageData(proof.pixels as Uint8ClampedArray<ArrayBuffer>, proof.width, proof.height), 0, 0);
        printedKey = job.key;
        if (state.finish === 'print' && !original) { showPrinted(true); showPrintSelection(); printReadyStatus(); }
      } catch (error) {
        failedPrintKey = job.key;
        if (desiredPrint?.key !== job.key) continue;
        showPrinted(false); $('#print-status').textContent = 'Print unavailable · ink preview shown';
        $('#print-status').title = error instanceof Error ? error.message : String(error);
        $('#print-retry').hidden = false;
        break;
      }
    }
  })().finally(() => { printTask = null; });
  return printTask;
}
function queuePrinted(ops: Op[]) {
  showPrintSelection();
  if (state.finish !== 'print' || original) { showPrinted(false); $('#print-retry').hidden = true; $('#print-status').textContent = original ? 'Original type' : 'Instant ink preview'; return; }
  const key = JSON.stringify([ops, state.font, state.size, state.leading, state.spread, state.variation, state.seed, state.paper, state.texture, state.paperGrain, state.wear, state.paperStyle, fontRevision]);
  if (printedKey === key) { showPrinted(true); printReadyStatus(); return; }
  showPrinted(false);
  if (desiredPrint?.key === key) {
    if (failedPrintKey === key) { $('#print-status').textContent = 'Print unavailable · ink preview shown'; $('#print-retry').hidden = false; }
    else if (!printTask) { clearTimeout(printTimer); printTimer = window.setTimeout(() => void ensurePrinted(), 220); }
    return;
  }
  desiredPrint = { ...state, key, root: renderer.root.cloneNode(true) as SVGSVGElement, width: renderer.width, height: renderer.height, cells: renderer.cells.map(cell => ({ ...cell, attrs: { ...cell.attrs } })), label: fontOptions[state.font].label };
  failedPrintKey = ''; $('#print-retry').hidden = true; $('#print-status').title = '';
  $('#print-status').textContent = 'Preparing print…';
  clearTimeout(printTimer); printTimer = window.setTimeout(() => void ensurePrinted(), 220);
}
$('#print-retry').addEventListener('click', () => { failedPrintKey = ''; $('#print-retry').hidden = true; void ensurePrinted(); });
window.addEventListener('pagehide', () => engine.stop(), { once: true });
function schedule() {
  cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(() => {
    const ops = quill.getContents().ops as Op[];
    renderer.render(ops, { ...state, family: fontOptions[state.font].family, original });
    renderer.highlight(selectionScope ? selection : null);
    queuePrinted(ops);
    $('#proof-font').textContent = fontOptions[state.font].label;
    $('#proof-details').textContent = `${state.size} PX / ${original ? 'ORIGINAL TYPE' : state.finish === 'print' ? 'PRINTED WITH OCRODEG' : 'INK ON PAPER'}`;
    $('#proof-caption').textContent = original ? 'THE ORIGINAL TYPE' : 'AN ORIGINAL IMPRESSION';
  });
}
function sync() {
  $<HTMLSelectElement>('#finish').value = state.finish;
  $('#print-settings').hidden = state.finish !== 'print';
  $<HTMLSelectElement>('#paper-style').value = state.paperStyle;
  for (const name of ['texture', 'paperGrain', 'wear'] as const) { $<HTMLInputElement>(`#${name}`).value = String(state[name]); $(`#${name}-value`).textContent = String(state[name]); }
  $('#view-ink').textContent = state.finish === 'print' ? 'Printed' : 'Ink bleed';
  $('#editor').style.setProperty('--editor-font', fontOptions[state.font].family);
  $('#editor').style.setProperty('--editor-size', `${Math.max(21, state.size * .86)}px`);
  $('#editor').style.setProperty('--editor-leading', String(state.leading));
  $<HTMLSelectElement>('#font').value = state.font; $<HTMLInputElement>('#font-size').value = String(state.size); $<HTMLSelectElement>('#leading').value = String(state.leading);
  const spread = selectionScope ? localSpread : state.spread, variation = selectionScope ? localVariation : state.variation;
  for (const [id, value] of [['spread', spread], ['variation', variation]] as const) {
    const input = $<HTMLInputElement>(`#${id}`); input.value = String(value); input.style.setProperty('--range', `${value}%`); $(`#${id}-value`).textContent = String(value).padStart(2, '0');
  }
  const hasSelection = !!selection?.length;
  $<HTMLButtonElement>('#selection-scope').disabled = !hasSelection;
  $('#selection-caption').hidden = !selectionScope || !hasSelection; $('#selection-actions').hidden = !selectionScope;
  $('#selected-text').textContent = selection ? `“${quill.getText(selection.index, selection.length).replace(/\n/g, ' ').slice(0, 48)}”` : '';
  for (const [id, active] of [['document-scope', !selectionScope], ['selection-scope', selectionScope], ['view-ink', !original], ['view-original', original]] as const) { $(`#${id}`).classList.toggle('active', active); $(`#${id}`).setAttribute('aria-pressed', String(active)); }
  document.querySelectorAll<HTMLButtonElement>('[data-paper]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.paper === state.paper)); });
  const words = quill.getText().trim().split(/\s+/).filter(Boolean).length;
  $('#word-count').textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
  $('#seed-label').textContent = `No. ${String(state.seed % 10000).padStart(4, '0')}`;
  const formats = selection ? quill.getFormat(selection.index, selection.length) : quill.getFormat(cursorRange.index, cursorRange.length);
  $('#bold').setAttribute('aria-pressed', String(formats.bold === true)); $('#italic').setAttribute('aria-pressed', String(formats.italic === true));
  $<HTMLSelectElement>('#heading').value = String(formats.header || 0);
  schedule();
}
function selectionChanged(range: { index: number; length: number } | null) {
  if (!range) return; // Keep the chosen range while working in the inspector.
  cursorRange = { ...range };
  selection = range.length ? range : null; selectionScope = !!selection;
  if (selection) {
    const format = quill.getFormat(range.index, range.length).ink;
    const custom = typeof format === 'string' && /^\d+,\d+$/.test(format) ? format.split(',').map(Number) : null;
    localSpread = format === 'clean' ? 0 : custom?.[0] ?? state.spread;
    localVariation = custom?.[1] ?? state.variation;
  }
  sync();
}
quill.on('selection-change', selectionChanged);
quill.on('text-change', () => {
  if (selection && selection.index + selection.length > quill.getLength()) { selection = null; selectionScope = false; }
  save(); sync();
});
function setPrintSettings(value: Partial<PrintSettings>) { Object.assign(state, printSettings({ ...state, ...value })); sync(); save(); }
$('#finish').addEventListener('change', () => setPrintSettings({ finish: $<HTMLSelectElement>('#finish').value as PrintSettings['finish'] }));
$('#paper-style').addEventListener('change', () => setPrintSettings({ paperStyle: $<HTMLSelectElement>('#paper-style').value as PrintSettings['paperStyle'] }));
for (const name of ['texture', 'paperGrain', 'wear'] as const) $(`#${name}`).addEventListener('input', () => setPrintSettings({ [name]: Number($<HTMLInputElement>(`#${name}`).value) }));
$('#font').addEventListener('change', () => { state.font = $<HTMLSelectElement>('#font').value as FontKey; sync(); save(); void document.fonts.ready.then(() => { fontRevision++; schedule(); }); });
$('#font-size').addEventListener('change', () => { state.size = Math.min(48, Math.max(18, Number($<HTMLInputElement>('#font-size').value) || 28)); sync(); save(); });
$('#leading').addEventListener('change', () => { state.leading = Number($<HTMLSelectElement>('#leading').value); sync(); save(); });
function format(name: string, value: unknown) {
  if (selection) quill.formatText(selection.index, selection.length, name, value, 'user'); else { quill.setSelection(cursorRange.index, 0, 'silent'); quill.format(name, value, 'user'); }
  sync();
}
for (const name of ['bold', 'italic']) {
  $(`#${name}`).addEventListener('mousedown', event => event.preventDefault());
  $(`#${name}`).addEventListener('click', () => format(name, $(`#${name}`).getAttribute('aria-pressed') !== 'true'));
}
$('#heading').addEventListener('change', () => {
  const range = selection || cursorRange;
  quill.formatLine(range.index, range.length, 'header', Number($<HTMLSelectElement>('#heading').value) || false, 'user'); sync();
});
$('#undo').addEventListener('click', () => quill.history.undo()); $('#redo').addEventListener('click', () => quill.history.redo());
function updateInk() {
  const spread = Number($<HTMLInputElement>('#spread').value), variation = Number($<HTMLInputElement>('#variation').value);
  if (selectionScope && selection) { localSpread = spread; localVariation = variation; quill.formatText(selection.index, selection.length, 'ink', `${spread},${variation}`, 'user'); }
  else { state.spread = spread; state.variation = variation; }
  sync(); save();
}
$('#spread').addEventListener('input', updateInk); $('#variation').addEventListener('input', updateInk);
$('#document-scope').addEventListener('click', () => { selectionScope = false; sync(); });
$('#selection-scope').addEventListener('click', () => { if (selection) { selectionScope = true; sync(); } });
$('#clear-selection').addEventListener('click', () => { selection = null; selectionScope = false; sync(); });
$('#keep-clean').addEventListener('click', () => { if (!selection) return; quill.formatText(selection.index, selection.length, 'ink', 'clean', 'user'); localSpread = 0; sync(); toast('Selected letters will stay clean.'); });
$('#use-document').addEventListener('click', () => { if (!selection) return; quill.formatText(selection.index, selection.length, 'ink', false, 'user'); localSpread = state.spread; localVariation = state.variation; sync(); toast('Selection follows the document ink.'); });
$('#reroll').addEventListener('click', () => { state.seed = (state.seed + 137) % 2147483647; sync(); save(); toast('A fresh impression. Same letterforms.'); });
$('#view-original').addEventListener('click', () => { original = true; sync(); }); $('#view-ink').addEventListener('click', () => { original = false; sync(); });
document.querySelectorAll<HTMLButtonElement>('[data-paper]').forEach(button => button.addEventListener('click', () => { state.paper = button.dataset.paper!; sync(); save(); }));
$('#align').addEventListener('click', () => {
  const current = quill.getFormat(0, quill.getLength()).align;
  const align = current === 'center' ? 'right' : current === 'right' ? false : 'center';
  quill.formatLine(0, quill.getLength(), 'align', align, 'user');
  $('#align').innerHTML = icon(align === 'center' ? 'align-center' : align === 'right' ? 'align-right' : 'align-left');
  $('#align').setAttribute('aria-label', `Text alignment: ${align || 'left'}`); createIcons({ icons });
});
function changeZoom(value: number) { zoom = Math.min(1.7, Math.max(.65, value)); $('.paper-wrap').style.setProperty('--zoom', String(zoom)); $('#zoom-fit').textContent = Math.abs(zoom - 1) < .01 ? 'Fit' : `${Math.round(zoom * 100)}%`; }
$('#zoom-in').addEventListener('click', () => changeZoom(zoom + .15)); $('#zoom-out').addEventListener('click', () => changeZoom(zoom - .15)); $('#zoom-fit').addEventListener('click', () => changeZoom(1));
$('#export').addEventListener('click', async () => {
  const button = $<HTMLButtonElement>('#export'); button.disabled = true; button.querySelector('span')!.textContent = 'Exporting…';
  try {
    const { exportPng, downloadCanvas } = await import('./export');
    if (state.finish === 'print' && !original) {
      await new Promise(requestAnimationFrame); await ensurePrinted();
      if (!desiredPrint || printedKey !== desiredPrint.key) throw new Error('The print proof is not ready.');
      await downloadCanvas(printCanvas);
    } else await exportPng(renderer.root, renderer.width, renderer.height, state.font, fontOptions[state.font].label);
    toast('Your impression is ready.');
  }
  catch (error) { console.error(error); toast('Could not export. Please try again.'); }
  finally { button.disabled = false; button.querySelector('span')!.textContent = 'Export PNG'; }
});
window.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); toast('Saved on this device.'); } if (event.key === 'Escape') { selection = null; selectionScope = false; sync(); } });
sync();
void document.fonts.ready.then(() => { fontRevision++; schedule(); });
// Keep render fonts loaded before proofing, including italic and bold runs.
async function loadFonts() { await Promise.all(Object.values(fontOptions).flatMap(font => [document.fonts.load(`28px ${font.family}`), document.fonts.load(`italic 28px ${font.family}`), document.fonts.load(`700 28px ${font.family}`)])); fontRevision++; schedule(); }
void loadFonts();
// Feature-detected WebMCP uses the same document and controls as the visible app.
const modelContext = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: unknown) => Promise<void> | void } }).modelContext;
if (modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const register = (tool: unknown) => { try { void Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(console.warn); } catch (error) { console.warn(error); } };
  register({ name: 'read_impression', description: 'Read the current text and document ink settings.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => ({ text: quill.getText(), font: state.font, spread: state.spread, unevenness: state.variation, finish: state.finish, texture: state.texture, paperGrain: state.paperGrain, wear: state.wear, paperStyle: state.paperStyle, printStatus: $('#print-status').textContent }) });
  register({ name: 'set_document_ink', description: 'Set document ink spread and unevenness while preserving selection overrides.', inputSchema: { type: 'object', properties: { spread: { type: 'integer', minimum: 0, maximum: 100 }, unevenness: { type: 'integer', minimum: 0, maximum: 100 } }, required: ['spread', 'unevenness'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async (input: unknown) => { const value = input as { spread: number; unevenness: number }; if (!value || ![value.spread, value.unevenness].every(x => Number.isInteger(x) && x >= 0 && x <= 100)) throw new Error('Ink values must be integers between 0 and 100.'); state.spread = value.spread; state.variation = value.unevenness; sync(); save(); await new Promise(requestAnimationFrame); return { spread: state.spread, unevenness: state.variation }; } });
  register({ name: 'set_print_finish', description: 'Configure the rendering process and print texture. Printed mode starts a local background render; read_impression reports its status.', inputSchema: { type: 'object', properties: { finish: { type: 'string', enum: ['ink', 'print'] }, texture: { type: 'integer', minimum: 0, maximum: 100 }, paperGrain: { type: 'integer', minimum: 0, maximum: 100 }, wear: { type: 'integer', minimum: 0, maximum: 100 }, paperStyle: { type: 'string', enum: ['fibrous', 'multiscale'] } }, required: ['finish'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input: unknown) => { const value = input as Partial<PrintSettings>; if (!value || !['ink', 'print'].includes(value.finish || '') || [value.texture, value.paperGrain, value.wear].some(x => x !== undefined && (!Number.isInteger(x) || x < 0 || x > 100)) || value.paperStyle !== undefined && !['fibrous', 'multiscale'].includes(value.paperStyle)) throw new Error('Choose a valid print process, texture, and percentages from 0 to 100.'); setPrintSettings(value); return printSettings(state); } });
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
