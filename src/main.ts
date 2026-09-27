import Quill from 'quill';
import { Attributor, Scope } from 'parchment';
import { createIcons, ArrowDownToLine, ChevronDown, Shuffle, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, Plus, Minus, Check, RotateCcw, SlidersHorizontal, ArrowUpRight, X, PanelLeftClose, PanelLeftOpen, Type } from 'lucide';
import 'quill/dist/quill.core.css';
import './style.css';
import { InkRenderer, type Op } from './render';
import { fontOptions, type FontKey } from './fonts';
import { PrintEngine, type PrintJob } from './print-engine';
import { printDefaults, printSettings, printControls, recipeSettings, validPrintInput, type PrintSettings, type PrintControl } from './print-settings';

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
let zoomMode: 'page' | 'width' | 'manual' = 'page';
let activeSidebar: 'write' | 'effects' = 'write';
let fontRevision = 0;
let localSpread = state.spread, localVariation = state.variation;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const icon = (name: string) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const printControlMarkup = (group: string) => Object.entries(printControls).filter(([, spec]) => spec.group === group).map(([key, spec]) => `
  <div class="effect-control" data-control="${key}"><label for="${key}">${spec.label}</label><output id="${key}-value" for="${key}"></output>
  <input id="${key}" aria-label="${spec.label}" aria-describedby="${key}-help" type="range" min="${spec.min}" max="${spec.max}" step="1"/>
  <p id="${key}-help">${spec.help}</p></div>`).join('');
$('#app').innerHTML = `
  <main class="workspace">
    <aside id="studio-sidebar" class="studio-sidebar" aria-label="Text and effect controls">
      <header class="studio-header">
        <a class="brand" href="./" aria-label="Impression home"><span class="monogram">i</span><span>impression<span class="brand-dot">.</span></span></a>
      </header>
      <div class="sidebar-tabs" role="tablist" aria-label="Editor tools">
        <button id="write-tab" role="tab" aria-selected="true" aria-controls="write-panel">${icon('type')}Write</button>
        <button id="effects-tab" role="tab" aria-selected="false" aria-controls="effects-panel" tabindex="-1">${icon('sliders-horizontal')}Effects</button>
      </div>
      <section id="write-panel" class="compose-panel" role="tabpanel" aria-labelledby="write-tab">
      <div class="toolbar" role="toolbar" aria-label="Text formatting">
        <div class="font-select"><select id="font" aria-label="Serif font">${Object.entries(fontOptions).map(([key, f]) => `<option value="${key}">${f.label}</option>`).join('')}</select>${icon('chevron-down')}</div>
        <label class="size-field"><input id="font-size" aria-label="Font size" type="number" min="18" max="48" step="1"/><span>px</span></label>
        <span class="toolbar-divider"></span>
        <button id="bold" class="icon-button type-button" aria-label="Bold" title="Bold (⌘B)" aria-pressed="false"><b>B</b></button><button id="italic" class="icon-button type-button italic" aria-label="Italic" title="Italic (⌘I)" aria-pressed="false">I</button>
        <select id="heading" aria-label="Paragraph style"><option value="0">Text</option><option value="1">Heading</option><option value="2">Subheading</option></select>
        <div class="text-layout"><button id="align" class="icon-button" aria-label="Text alignment: left" title="Cycle text alignment">${icon('align-left')}</button><label for="leading">Line spacing</label><select id="leading" aria-label="Line spacing"><option value="1.3">1.3×</option><option value="1.5">1.5×</option><option value="1.7">1.7×</option></select></div>
      </div>

        <div class="editor-area"><div id="editor"></div></div>
        <div class="editor-meta"><span id="word-count"></span><div class="history"><button id="undo" class="icon-button" aria-label="Undo" title="Undo (⌘Z)">${icon('undo-2')}</button><button id="redo" class="icon-button" aria-label="Redo" title="Redo (⌘⇧Z)">${icon('redo-2')}</button></div></div>
      </section>
      <section id="effects-panel" class="effects-panel" role="tabpanel" aria-labelledby="effects-tab" hidden>
      <section class="ink-controls" aria-labelledby="ink-title">
        <div class="controls-heading"><h2 id="ink-title">Ink & character</h2><div class="scope-switch" aria-label="Ink scope"><button id="document-scope" class="active" aria-pressed="true">Document</button><span id="selection-control" class="selection-control" tabindex="0" role="group" aria-label="Selection" aria-describedby="selection-tooltip"><button id="selection-scope" disabled aria-pressed="false">Selection</button><span id="selection-tooltip" role="tooltip">highlight text in the edit window to enable selection</span></span></div></div>
        <div id="selection-caption" class="selection-caption" hidden><span id="selected-text"></span><button id="clear-selection" class="icon-button" title="Clear selection" aria-label="Clear selection">${icon('x')}</button></div>
        <div class="slider-row"><label for="spread">Ink spread</label><output id="spread-value" for="spread"></output><input id="spread" aria-label="Ink spread" type="range" min="0" max="100"/><div class="range-captions"><span>Fine</span><span>Saturated</span></div></div>
        <div class="slider-row"><label for="variation">Unevenness</label><output id="variation-value" for="variation"></output><input id="variation" aria-label="Unevenness" type="range" min="0" max="100"/><div class="range-captions"><span>Uniform</span><span>Wandering</span></div></div>
        <div class="ink-actions"><button id="reroll" class="subtle">${icon('shuffle')}New impression</button><div id="selection-actions" hidden><button id="keep-clean" class="text-button">Keep clean</button><button id="use-document" class="text-button" title="Remove custom ink from the selection">Reset ink</button></div><span id="seed-label" class="seed-label"></span></div>
      </section>
      <div id="print-settings" class="print-settings">
        <div class="print-look"><label for="recipe">Starting look</label><select id="recipe" aria-label="Starting look"><option value="custom">Custom print</option><option value="book">Book print</option><option value="fiber">Rough paper</option></select><button id="reset-print" class="text-button">Reset effects</button></div>
        <p id="recipe-note" class="recipe-note">Build your own print, one effect at a time.</p>
        <details class="effect-group" name="print-effects" open><summary><span>Ink & paper</span>${icon('chevron-down')}</summary><div class="effects-grid">
          <div class="paper-style-control" data-custom-only><label for="paper-style">Paper texture</label><select id="paper-style" aria-label="Paper texture"><option value="fibrous">Paper fibers</option><option value="multiscale">Fine grain</option></select></div>
          ${printControlMarkup('ink')}
        </div></details>
        <details class="effect-group" name="print-effects"><summary><span>Letter edges</span>${icon('chevron-down')}</summary><div class="effects-grid">${printControlMarkup('edges')}</div></details>
        <details class="effect-group" name="print-effects"><summary><span>Page shape</span>${icon('chevron-down')}</summary><div class="effects-grid"><div class="paper-style-control"><label for="page-turn">Turn text</label><select id="page-turn" aria-label="Turn text"><option value="0">Upright</option><option value="90">Quarter turn right</option><option value="180">Upside down</option><option value="270">Quarter turn left</option></select><p>Turn the whole impression and fit it on the page.</p></div>${printControlMarkup('page')}</div></details>
      </div>

      </section>
      <footer class="sidebar-footer">
        <div class="paper-picker" aria-label="Paper color"><span>Paper</span>
          <button data-paper="#f1ede4" class="swatch warm" aria-label="Warm paper" title="Warm paper" aria-pressed="true"><span aria-hidden="true"></span></button>
          <button data-paper="#fbfaf7" class="swatch white" aria-label="White paper" title="White paper" aria-pressed="false"><span aria-hidden="true"></span></button>
          <button data-paper="#e5dac3" class="swatch oat" aria-label="Oat paper" title="Oat paper" aria-pressed="false"><span aria-hidden="true"></span></button>
          <button data-paper="none" class="swatch no-paper" aria-label="No paper (transparent)" title="No paper · transparent PNG" aria-pressed="false"><span aria-hidden="true">${icon('x')}</span></button>
          <button data-paper="#ffffff" class="swatch bright-white" aria-label="Bright white paper" title="Bright white paper" aria-pressed="false"><span aria-hidden="true"></span></button>
          <button data-paper="#e3e5e8" class="swatch cool-gray" aria-label="Cool gray paper" title="Cool gray paper" aria-pressed="false"><span aria-hidden="true"></span></button>
        </div>
        <span id="save-status" class="save-status" role="status">Saved on this device</span>
      </footer>
    </aside>
    <section class="proof-panel" aria-label="Live ink preview">
      <div class="proof-toolbar" aria-label="Preview tools">
        <div class="proof-title"><button id="toggle-sidebar" class="icon-button" aria-label="Hide editor" title="Hide editor" aria-controls="studio-sidebar" aria-expanded="true">${icon('panel-left-close')}</button><h1 class="visually-hidden">Preview</h1></div>
        <div class="view-switch" aria-label="Preview mode"><button id="view-ink" class="active" aria-pressed="true">Printed</button><button id="view-original" aria-pressed="false">Original</button></div>
        <div class="zoom-controls" aria-label="Preview zoom"><button id="zoom-out" class="icon-button" aria-label="Zoom out">${icon('minus')}</button><button id="zoom-value" title="Reset to actual size" aria-label="Reset zoom to 100 percent">100%</button><button id="zoom-in" class="icon-button" aria-label="Zoom in">${icon('plus')}</button><span class="toolbar-divider"></span><button id="zoom-fit" class="text-button" aria-pressed="true">Fit page</button><button id="zoom-width" class="text-button" aria-pressed="false">Fit width</button><button id="zoom-actual" class="text-button" aria-pressed="false">100%</button></div>
        <button id="export" class="primary" aria-label="Export PNG" title="Export PNG">${icon('arrow-down-to-line')}<span>Export PNG</span></button>
      </div>
      <div class="proof-stage" tabindex="0" aria-label="Paper preview. Use the zoom controls to inspect the print."><div class="paper-wrap"><div class="proof-sheet"><svg id="proof" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Live paper proof of your text"></svg><canvas id="printed-proof" role="img" aria-label="Printed proof of your text" hidden></canvas><canvas id="print-selection" aria-hidden="true"></canvas></div></div></div>
      <div class="proof-status"><span id="print-status" role="status">Preparing print…</span><button id="print-retry" class="text-button" hidden>Retry</button></div>
    </section>
  </main><div id="toast" role="status" class="toast"></div>`;
const icons = { ArrowDownToLine, ChevronDown, Shuffle, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, Plus, Minus, Check, RotateCcw, SlidersHorizontal, ArrowUpRight, X, PanelLeftClose, PanelLeftOpen, Type };
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
  try { localStorage.setItem(storageKey, JSON.stringify(state)); $('#save-status').textContent = 'Saved on this device'; }
  catch { $('#save-status').textContent = 'Device storage unavailable'; }
}
const printCanvas = $<HTMLCanvasElement>('#printed-proof');
const printSheet = $('.proof-sheet');
const printSelection = $<HTMLCanvasElement>('#print-selection');
let desiredPrint: PrintJob | null = null, printedKey = '', failedPrintKey = '';
let printedSize: { width: number; height: number } | null = null;
let printTask: Promise<void> | null = null, printTimer = 0;
const engine = new PrintEngine(message => { if (!original && printSheet.getAttribute('aria-busy') === 'true') $('#print-status').textContent = printedKey ? 'Updating print…' : message; });
function showPrinted(show: boolean) {
  printCanvas.hidden = !show; printSheet.classList.toggle('has-print', show);
  printSelection.style.display = show ? 'block' : 'none';
}
function showPrintSelection() {
  printSelection.style.display = !printCanvas.hidden && selectionScope && selection ? 'block' : 'none';
}
function paintPrintSelection(mask: Uint8Array, width: number, height: number) {
  printSelection.width = width; printSelection.height = height;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < mask.length; i++) { rgba[i * 4] = 171; rgba[i * 4 + 1] = 132; rgba[i * 4 + 2] = 65; rgba[i * 4 + 3] = Math.round(mask[i] * .3); }
  printSelection.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0);
}
function printReadyStatus() {
  printSheet.setAttribute('aria-busy', 'false');
  $('#print-retry').hidden = true;
  $('#print-status').title = '';
  $('#print-status').textContent = `Printed locally · ${printCanvas.width} × ${printCanvas.height}`;
}
function printFailedStatus() {
  showPrinted(!!printedKey); showPrintSelection();
  printSheet.setAttribute('aria-busy', 'false');
  $('#print-status').textContent = printedKey ? 'Could not update · previous print shown' : 'Print unavailable · ink preview shown';
  $('#print-retry').hidden = false;
}
async function ensurePrinted(): Promise<void> {
  clearTimeout(printTimer);
  if (printTask) return printTask;
  printTask = (async () => {
    while (desiredPrint && printedKey !== desiredPrint.key && !original) {
      const job = desiredPrint;
      if (failedPrintKey === job.key) break;
      try {
        const proof = await engine.render(job);
        if (desiredPrint?.key !== job.key) continue;
        printCanvas.width = proof.width; printCanvas.height = proof.height;
        printCanvas.getContext('2d')!.putImageData(new ImageData(proof.pixels as Uint8ClampedArray<ArrayBuffer>, proof.width, proof.height), 0, 0);
        paintPrintSelection(proof.selection, proof.width, proof.height);
        printedKey = job.key; printedSize = { width: job.width, height: job.height };
        if (!original) { showPrinted(true); showPrintSelection(); printReadyStatus(); updatePreviewScale(); }
      } catch (error) {
        failedPrintKey = job.key;
        if (desiredPrint?.key !== job.key) continue;
        if (!original) {
          printFailedStatus();
          $('#print-status').title = error instanceof Error ? error.message : String(error);
        }
        break;
      }
    }
  })().finally(() => { printTask = null; });
  return printTask;
}
function queuePrinted(ops: Op[]) {
  showPrintSelection();
  if (original) { showPrinted(false); printSheet.setAttribute('aria-busy', 'false'); $('#print-retry').hidden = true; $('#print-status').textContent = 'Original type'; return; }
  const key = JSON.stringify([ops, state.font, state.size, state.leading, state.spread, state.variation, state.seed, state.paper, printSettings(state), selectionScope ? selection : null, fontRevision]);
  const alreadyQueued = desiredPrint?.key === key;
  if (!alreadyQueued) desiredPrint = { ...state, selection: selectionScope && selection ? { ...selection } : null, key, root: renderer.root.cloneNode(true) as SVGSVGElement, width: renderer.width, height: renderer.height, cells: renderer.cells.map(cell => ({ ...cell, attrs: { ...cell.attrs } })), label: fontOptions[state.font].label };
  if (printedKey === key) {
    // Returning to the visible print cancels any newer result still in flight.
    clearTimeout(printTimer);
    showPrinted(true); showPrintSelection(); printReadyStatus(); return;
  }
  // Keep the last completed bitmap on screen throughout debounce and rendering.
  showPrinted(!!printedKey); showPrintSelection();
  printSheet.setAttribute('aria-busy', 'true');
  if (alreadyQueued) {
    if (failedPrintKey === key) printFailedStatus();
    else if (!printTask) { clearTimeout(printTimer); printTimer = window.setTimeout(() => void ensurePrinted(), 220); }
    return;
  }
  failedPrintKey = ''; $('#print-retry').hidden = true; $('#print-status').title = '';
  $('#print-status').textContent = printedKey ? 'Updating print…' : 'Preparing print…';
  clearTimeout(printTimer); printTimer = window.setTimeout(() => void ensurePrinted(), 220);
}
$('#print-retry').addEventListener('click', () => { failedPrintKey = ''; $('#print-retry').hidden = true; printSheet.setAttribute('aria-busy', 'true'); void ensurePrinted(); });
window.addEventListener('pagehide', () => engine.stop(), { once: true });
function schedule() {
  cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(() => {
    const ops = quill.getContents().ops as Op[];
    renderer.render(ops, { ...state, family: fontOptions[state.font].family, original });
    renderer.highlight(selectionScope ? selection : null);
    queuePrinted(ops);
    updatePreviewScale();
  });
}
function sync() {
  $<HTMLSelectElement>('#paper-style').value = state.paperStyle;
  $<HTMLSelectElement>('#recipe').value = state.recipe;
  $<HTMLSelectElement>('#page-turn').value = String(state.pageTurn);
  $('#recipe-note').textContent = state.recipe === 'custom' ? 'Build your own print, one effect at a time.' : 'This starting look includes ink and paper texture. The other controls add to it. Choose Custom print to adjust each texture separately.';
  for (const name of Object.keys(printControls) as PrintControl[]) {
    const spec = printControls[name];
    $<HTMLInputElement>(`#${name}`).value = String(state[name]);
    $<HTMLInputElement>(`#${name}`).style.setProperty('--range', `${100 * (state[name] - spec.min) / (spec.max - spec.min)}%`);
    $(`#${name}-value`).textContent = `${state[name]}${'unit' in spec ? spec.unit : ''}`;
    $(`[data-control="${name}"]`).hidden = state.recipe !== 'custom' && ['texture', 'paperGrain'].includes(name);
  }
  $('[data-custom-only]').hidden = state.recipe !== 'custom';
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
  $('#selection-control').tabIndex = hasSelection ? -1 : 0;
  if (hasSelection) $('#selection-control').removeAttribute('aria-describedby');
  else $('#selection-control').setAttribute('aria-describedby', 'selection-tooltip');
  $('#selection-caption').hidden = !selectionScope || !hasSelection; $('#selection-actions').hidden = !selectionScope;
  $('#selected-text').textContent = selection ? `“${quill.getText(selection.index, selection.length).replace(/\n/g, ' ').slice(0, 48)}”` : '';
  for (const [id, active] of [['document-scope', !selectionScope], ['selection-scope', selectionScope], ['view-ink', !original], ['view-original', original]] as const) { $(`#${id}`).classList.toggle('active', active); $(`#${id}`).setAttribute('aria-pressed', String(active)); }
  document.querySelectorAll<HTMLButtonElement>('[data-paper]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.paper === state.paper)); });
  const words = quill.getText().trim().split(/\s+/).filter(Boolean).length;
  $('#word-count').textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
  $('#effects-tab').classList.toggle('has-selection', hasSelection);
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
$('#paper-style').addEventListener('change', () => setPrintSettings({ paperStyle: $<HTMLSelectElement>('#paper-style').value as PrintSettings['paperStyle'] }));
$('#recipe').addEventListener('change', () => setPrintSettings(recipeSettings($<HTMLSelectElement>('#recipe').value as PrintSettings['recipe'])));
$('#page-turn').addEventListener('change', () => setPrintSettings({ pageTurn: Number($<HTMLSelectElement>('#page-turn').value) as PrintSettings['pageTurn'] }));
$('#reset-print').addEventListener('click', () => { setPrintSettings(recipeSettings(state.recipe)); toast('Print effects reset. Your text and ink settings are unchanged.'); });
for (const name of Object.keys(printControls) as PrintControl[]) $(`#${name}`).addEventListener('input', () => setPrintSettings({ [name]: Number($<HTMLInputElement>(`#${name}`).value) }));
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
for (const event of ['pointerenter', 'focus']) $('#selection-control').addEventListener(event, () => $('#selection-control').removeAttribute('data-tooltip-dismissed'));
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
function showSidebarTab(tab: 'write' | 'effects') {
  activeSidebar = tab;
  for (const name of ['write', 'effects'] as const) {
    const active = tab === name;
    $(`#${name}-panel`).hidden = !active;
    $(`#${name}-tab`).setAttribute('aria-selected', String(active));
    $(`#${name}-tab`).tabIndex = active ? 0 : -1;
  }
}
for (const name of ['write', 'effects'] as const) {
  $(`#${name}-tab`).addEventListener('click', () => showSidebarTab(name));
  $(`#${name}-tab`).addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'write' : event.key === 'End' ? 'effects' : activeSidebar === 'write' ? 'effects' : 'write';
    showSidebarTab(next); $(`#${next}-tab`).focus();
  });
}
$('#toggle-sidebar').addEventListener('click', () => {
  const hidden = $('.workspace').classList.toggle('preview-only');
  $('.studio-sidebar').hidden = hidden;
  const button = $('#toggle-sidebar');
  button.setAttribute('aria-expanded', String(!hidden));
  button.setAttribute('aria-label', hidden ? 'Show editor' : 'Hide editor');
  button.title = hidden ? 'Show editor' : 'Hide editor';
  button.innerHTML = icon(hidden ? 'panel-left-open' : 'panel-left-close');
  createIcons({ icons });
});
function updatePreviewScale() {
  const stage = $('.proof-stage');
  const style = getComputedStyle(stage);
  const availableWidth = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const availableHeight = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  if (!availableWidth || !availableHeight) return;
  const page = !printCanvas.hidden && printedSize ? printedSize : renderer;
  if (zoomMode === 'page') zoom = Math.min(availableWidth / page.width, availableHeight / page.height);
  if (zoomMode === 'width') zoom = availableWidth / page.width;
  $('.paper-wrap').style.width = `${Math.max(1, page.width * zoom)}px`;
  $('#zoom-value').textContent = `${Math.round(zoom * 100)}%`;
  $('#zoom-fit').setAttribute('aria-pressed', String(zoomMode === 'page'));
  $('#zoom-width').setAttribute('aria-pressed', String(zoomMode === 'width'));
  $('#zoom-actual').setAttribute('aria-pressed', String(zoomMode === 'manual' && zoom === 1));
  $<HTMLButtonElement>('#zoom-in').disabled = zoom >= 3;
  $<HTMLButtonElement>('#zoom-out').disabled = zoom <= .15;
}
function changeZoom(value: number) {
  zoomMode = 'manual'; zoom = Math.min(3, Math.max(.15, value)); updatePreviewScale();
}
function fitPreview(mode: 'page' | 'width') {
  zoomMode = mode; updatePreviewScale(); $('.proof-stage').scrollTo(0, 0);
}
$('#zoom-in').addEventListener('click', () => changeZoom(zoom + .15));
$('#zoom-out').addEventListener('click', () => changeZoom(zoom - .15));
$('#zoom-fit').addEventListener('click', () => fitPreview('page'));
$('#zoom-width').addEventListener('click', () => fitPreview('width'));
$('#zoom-actual').addEventListener('click', () => changeZoom(1));
$('#zoom-value').addEventListener('click', () => changeZoom(1));
new ResizeObserver(updatePreviewScale).observe($('.proof-stage'));
$('#export').addEventListener('click', async () => {
  const button = $<HTMLButtonElement>('#export'); button.disabled = true; button.querySelector('span')!.textContent = 'Exporting…';
  try {
    const { exportPng, downloadCanvas } = await import('./export');
    if (!original) {
      await new Promise(requestAnimationFrame); await ensurePrinted();
      if (!desiredPrint || printedKey !== desiredPrint.key) throw new Error('The print proof is not ready.');
      await downloadCanvas(printCanvas);
    } else await exportPng(renderer.root, renderer.width, renderer.height, state.font, fontOptions[state.font].label);
    toast('Your impression is ready.');
  }
  catch (error) { console.error(error); toast('Could not export. Please try again.'); }
  finally { button.disabled = false; button.querySelector('span')!.textContent = 'Export PNG'; }
});
window.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); toast('Saved on this device.'); } if (event.key === 'Escape') { $('#selection-control').setAttribute('data-tooltip-dismissed', ''); selection = null; selectionScope = false; sync(); } });
sync();
void document.fonts.ready.then(() => { fontRevision++; schedule(); });
// Keep render fonts loaded before proofing, including italic and bold runs.
async function loadFonts() { await Promise.all(Object.values(fontOptions).flatMap(font => [document.fonts.load(`28px ${font.family}`), document.fonts.load(`italic 28px ${font.family}`), document.fonts.load(`700 28px ${font.family}`), document.fonts.load(`italic 700 28px ${font.family}`)])); fontRevision++; schedule(); }
void loadFonts();
// Feature-detected WebMCP uses the same document and controls as the visible app.
const modelContext = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: unknown) => Promise<void> | void } }).modelContext;
if (modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const register = (tool: unknown) => { try { void Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(console.warn); } catch (error) { console.warn(error); } };
  register({ name: 'read_impression', description: 'Read the current text and document ink settings.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => ({ text: quill.getText(), font: state.font, spread: state.spread, unevenness: state.variation, ...printSettings(state), printStatus: $('#print-status').textContent }) });
  register({ name: 'set_document_ink', description: 'Set document ink spread and unevenness while preserving selection overrides.', inputSchema: { type: 'object', properties: { spread: { type: 'integer', minimum: 0, maximum: 100 }, unevenness: { type: 'integer', minimum: 0, maximum: 100 } }, required: ['spread', 'unevenness'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async (input: unknown) => { const value = input as { spread: number; unevenness: number }; if (!value || ![value.spread, value.unevenness].every(x => Number.isInteger(x) && x >= 0 && x <= 100)) throw new Error('Ink values must be integers between 0 and 100.'); state.spread = value.spread; state.variation = value.unevenness; sync(); save(); await new Promise(requestAnimationFrame); return { spread: state.spread, unevenness: state.variation }; } });
  register({ name: 'set_print_finish', description: 'Set print effects using the visible controls. Setting recipe chooses a starting look and resets added effects before applying other supplied values. Rendering runs locally in the background; read_impression reports status.', inputSchema: { type: 'object', properties: { finish: { type: 'string', enum: ['print'] }, recipe: { type: 'string', enum: ['custom', 'book', 'fiber'] }, paperStyle: { type: 'string', enum: ['fibrous', 'multiscale'] }, pageTurn: { type: 'integer', enum: [0, 90, 180, 270] }, ...Object.fromEntries(Object.entries(printControls).map(([name, spec]) => [name, { type: 'integer', minimum: spec.min, maximum: spec.max, description: `${spec.label}. ${spec.help}` }])) }, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input: unknown) => {
    if (!validPrintInput(input)) throw new Error('Choose a valid print setting within its slider range.');
    setPrintSettings({ ...(input.recipe ? recipeSettings(input.recipe) : {}), ...input });
    return printSettings(state);
  } });
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
