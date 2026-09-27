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

const fontOptions = {
  garamond: { label: 'EB Garamond', family: '"EB Garamond", Georgia, serif' },
  baskerville: { label: 'Libre Baskerville', family: '"Libre Baskerville", Georgia, serif' },
  playfair: { label: 'Playfair Display', family: '"Playfair Display", Georgia, serif' },
  georgia: { label: 'Georgia', family: 'Georgia, serif' },
};
type FontKey = keyof typeof fontOptions;
type State = { font: FontKey; size: number; leading: number; spread: number; variation: number; seed: number; paper: string; ops: Op[] };
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
const defaults: State = { font: 'garamond', size: 28, leading: 1.5, spread: 43, variation: 94, seed: 55, paper: '#f1ede4', ops: defaultOps };
const storageKey = 'impression.document.v1';
function readSaved(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!saved || !Array.isArray(saved.ops)) return structuredClone(defaults);
    return { ...defaults, ...saved, font: saved.font in fontOptions ? saved.font : 'garamond',
      size: Number.isFinite(saved.size) ? Math.min(48, Math.max(18, saved.size)) : 28,
      ops: saved.ops.filter((op: Op) => typeof op.insert === 'string') };
  } catch { return structuredClone(defaults); }
}
let state = readSaved();
let selection: { index: number; length: number } | null = null;
let cursorRange = { index: 0, length: 0 };
let selectionScope = false, original = false, zoom = 1, renderFrame = 0;
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
      <div class="proof-stage"><div class="paper-wrap"><div class="paper-topline"><span id="proof-font"></span><span id="proof-caption">AN ORIGINAL IMPRESSION</span></div><svg id="proof" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Live paper proof of your text"></svg><div class="paper-bottomline"><span id="proof-details"></span><span>MADE TO BE IMPERFECT.</span></div></div></div>
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
function schedule() {
  cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(() => {
    renderer.render(quill.getContents().ops as Op[], { ...state, family: fontOptions[state.font].family, original });
    renderer.highlight(selectionScope ? selection : null);
    $('#proof-font').textContent = fontOptions[state.font].label;
    $('#proof-details').textContent = `${state.size} PX / ${original ? 'ORIGINAL TYPE' : 'INK ON PAPER'}`;
    $('#proof-caption').textContent = original ? 'THE ORIGINAL TYPE' : 'AN ORIGINAL IMPRESSION';
  });
}
function sync() {
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
$('#font').addEventListener('change', () => { state.font = $<HTMLSelectElement>('#font').value as FontKey; sync(); save(); void document.fonts.ready.then(schedule); });
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
  try { const { exportPng } = await import('./export'); await exportPng(renderer.root, renderer.width, renderer.height, state.font, fontOptions[state.font].label); toast('Your impression is ready.'); }
  catch (error) { console.error(error); toast('Could not export. Please try again.'); }
  finally { button.disabled = false; button.querySelector('span')!.textContent = 'Export PNG'; }
});
window.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); toast('Saved on this device.'); } if (event.key === 'Escape') { selection = null; selectionScope = false; sync(); } });
sync();
void document.fonts.ready.then(schedule);
// Keep render fonts loaded before proofing, including italic and bold runs.
async function loadFonts() { await Promise.all(Object.values(fontOptions).flatMap(font => [document.fonts.load(`28px ${font.family}`), document.fonts.load(`italic 28px ${font.family}`), document.fonts.load(`700 28px ${font.family}`)])); schedule(); }
void loadFonts();
// Feature-detected WebMCP uses the same document and controls as the visible app.
const modelContext = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: unknown) => Promise<void> | void } }).modelContext;
if (modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const register = (tool: unknown) => { try { void Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(console.warn); } catch (error) { console.warn(error); } };
  register({ name: 'read_impression', description: 'Read the current text and document ink settings.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => ({ text: quill.getText(), font: state.font, spread: state.spread, unevenness: state.variation }) });
  register({ name: 'set_document_ink', description: 'Set document ink spread and unevenness while preserving selection overrides.', inputSchema: { type: 'object', properties: { spread: { type: 'integer', minimum: 0, maximum: 100 }, unevenness: { type: 'integer', minimum: 0, maximum: 100 } }, required: ['spread', 'unevenness'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async (input: unknown) => { const value = input as { spread: number; unevenness: number }; if (!value || ![value.spread, value.unevenness].every(x => Number.isInteger(x) && x >= 0 && x <= 100)) throw new Error('Ink values must be integers between 0 and 100.'); state.spread = value.spread; state.variation = value.unevenness; sync(); save(); await new Promise(requestAnimationFrame); return { spread: state.spread, unevenness: state.variation }; } });
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
