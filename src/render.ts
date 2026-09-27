import { inkWalk, inkSetting } from './ink';
export type Attributes = { bold?: boolean; italic?: boolean; header?: number; align?: string; ink?: string };
export type Op = { insert?: unknown; attributes?: Attributes };
export type RenderOptions = { family: string; size: number; leading: number; spread: number; variation: number; seed: number; paper: string; original: boolean };
export type Cell = { text: string; start: number; end: number; attrs: Attributes; x: number; right: number; y: number; h: number };
const ns = 'http://www.w3.org/2000/svg';
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
type Glyph = { text: string; start: number; end: number; attrs: Attributes };
type Paragraph = { glyphs: Glyph[]; attrs: Attributes };
function paragraphs(ops: Op[]) {
  const result: Paragraph[] = []; let glyphs: Glyph[] = [], start = 0;
  for (const op of ops) {
    if (typeof op.insert !== 'string') continue;
    for (const { segment: text } of segmenter.segment(op.insert)) {
      const end = start + text.length;
      if (text === '\n') { result.push({ glyphs, attrs: op.attributes || {} }); glyphs = []; }
      else glyphs.push({ text, start, end, attrs: op.attributes || {} });
      start = end;
    }
  }
  if (glyphs.length) result.push({ glyphs, attrs: {} });
  return result;
}
function runs(glyphs: Glyph[]) {
  const out: { items: Glyph[]; attrs: Attributes }[] = [];
  glyphs.forEach(glyph => {
    const prev = out.at(-1);
    if (prev && !!prev.attrs.bold === !!glyph.attrs.bold && !!prev.attrs.italic === !!glyph.attrs.italic) prev.items.push(glyph);
    else out.push({ items: [glyph], attrs: glyph.attrs });
  });
  return out;
}
function filterFor(key: string, amount: number, uneven: number, width: number, height: number) {
  const filter = svg('filter', { id: `ink-filter-${key}`, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', x: 0, y: 0, width, height, 'color-interpolation-filters': 'sRGB' });
  filter.append(svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '.021 .065', numOctaves: 2, seed: 17, result: 'patches' }));
  filter.append(svg('feColorMatrix', { in: 'patches', type: 'matrix', values: `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${uneven * 9} 0 0 0 ${1 - uneven * 5.2}`, result: 'patchMask' }));
  filter.append(svg('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: amount * 2.8, result: 'diffusion' }));
  const threshold = svg('feComponentTransfer', { in: 'diffusion', result: 'spread' });
  threshold.append(svg('feFuncA', { type: 'linear', slope: 4, intercept: -.45 })); filter.append(threshold);
  filter.append(svg('feComposite', { in: 'spread', in2: 'patchMask', operator: 'in', result: 'localSpread' }));
  filter.append(svg('feComposite', { in: 'SourceAlpha', in2: 'localSpread', operator: 'over', result: 'inkShape' }));
  filter.append(svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '.24 .32', numOctaves: 3, seed: 31, result: 'edges' }));
  filter.append(svg('feDisplacementMap', { in: 'inkShape', in2: 'edges', scale: amount * uneven * 1.8, xChannelSelector: 'R', yChannelSelector: 'G', result: 'roughSpread' }));
  filter.append(svg('feGaussianBlur', { in: 'roughSpread', stdDeviation: .18, result: 'softEdge' }));
  const firm = svg('feComponentTransfer', { in: 'softEdge', result: 'firmSpread' });
  firm.append(svg('feFuncA', { type: 'linear', slope: 1.5, intercept: -.18 })); filter.append(firm);
  filter.append(svg('feFlood', { 'flood-color': '#24211d', result: 'ink' }));
  filter.append(svg('feComposite', { in: 'ink', in2: 'firmSpread', operator: 'in' }));
  return filter;
}
export class InkRenderer {
  cells: Cell[] = [];
  width = 720;
  height = 900;
  readonly canvas = document.createElement('canvas');
  readonly context = this.canvas.getContext('2d')!;
  private highlights = svg('g', { 'data-selection': 'true' });
  constructor(readonly root: SVGSVGElement) {}
  render(ops: Op[], options: RenderOptions) {
    const width = this.width, padding = 72, usable = width - padding * 2;
    const source = svg('g', { id: 'ink-source', fill: '#24211d', 'font-family': options.family, 'font-kerning': 'normal' });
    const defs = svg('defs'), layers = svg('g', { 'data-ink-layers': 'true' });
    const background = svg('rect', { width: '100%', height: '100%', fill: options.paper });
    this.root.replaceChildren(defs, background, source, layers, this.highlights);
    this.cells = []; let baseline = padding;
    const measured = (items: Glyph[], size: number) => runs(items).reduce((width, run) => {
      this.context.font = `${run.attrs.italic ? 'italic' : 'normal'} ${run.attrs.bold ? 700 : 400} ${size}px ${options.family}`;
      return width + this.context.measureText(run.items.map(g => g.text).join('')).width;
    }, 0);
    for (const paragraph of paragraphs(ops)) {
      const size = options.size * (paragraph.attrs.header === 1 ? 1.9 : paragraph.attrs.header === 2 ? 1.4 : 1);
      const lineHeight = size * (paragraph.attrs.header ? 1.18 : options.leading);
      const items = paragraph.glyphs;
      let first = 0; const lines: Glyph[][] = [];
      while (first < items.length) {
        let end = first, breakAfter = -1;
        while (end < items.length) {
          if (end > first && measured(items.slice(first, end + 1), size) > usable) break;
          if (/\s/u.test(items[end].text)) breakAfter = end + 1;
          end++;
        }
        if (end < items.length && breakAfter > first) end = breakAfter;
        lines.push(items.slice(first, end)); first = end;
      }
      if (!lines.length) lines.push([]);
      for (const line of lines) {
        baseline += lineHeight;
        const lineWidth = measured(line, size);
        let x = padding + (paragraph.attrs.align === 'center' ? (usable - lineWidth) / 2 : paragraph.attrs.align === 'right' ? usable - lineWidth : 0);
        const node = svg('text', { x, y: baseline, 'font-size': size, 'xml:space': 'preserve', 'white-space': 'pre' });
        source.append(node);
        for (const run of runs(line)) {
          const span = svg('tspan', { 'font-weight': run.attrs.bold ? 700 : 400, 'font-style': run.attrs.italic ? 'italic' : 'normal' });
          span.textContent = run.items.map(g => g.text).join(''); node.append(span);
          let charIndex = 0;
          this.context.font = `${run.attrs.italic ? 'italic' : 'normal'} ${run.attrs.bold ? 700 : 400} ${size}px ${options.family}`;
          let prefix = '';
          run.items.forEach(glyph => {
            const count = Array.from(glyph.text).length; let left = x, right = x;
            try {
              const positions: number[] = [];
              for (let j = 0; j < count; j++) positions.push(span.getStartPositionOfChar(charIndex + j).x, span.getEndPositionOfChar(charIndex + j).x);
              left = Math.min(...positions); right = Math.max(...positions);
            } catch {
              left = x + this.context.measureText(prefix).width;
              right = x + this.context.measureText(prefix + glyph.text).width;
            }
            this.cells.push({ ...glyph, x: left, right, y: baseline - size, h: lineHeight });
            prefix += glyph.text; charIndex += count;
          });
          x += this.context.measureText(span.textContent).width;
        }
      }
      if (paragraph.attrs.header) baseline += options.size * .35;
    }
    this.height = Math.max(900, baseline + padding + options.size * .4);
    const height = this.height;
    this.root.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.root.setAttribute('width', String(width)); this.root.setAttribute('height', String(height));
    const walk = inkWalk(this.cells, options.seed);
    const groups = new Map<string, { amount: number; uneven: number; cells: (Cell & { coverage: number })[] }>();
    this.cells.forEach((cell, i) => {
      const setting = inkSetting(options.spread, options.variation, walk[i], cell.attrs.ink);
      if (options.original || /\s/u.test(cell.text) || !setting.amount || !setting.coverage) return;
      const key = `${Math.round(setting.amount * 100)}-${Math.round(setting.uneven * 100)}`;
      if (!groups.has(key)) groups.set(key, { ...setting, cells: [] });
      groups.get(key)!.cells.push({ ...cell, coverage: setting.coverage });
    });
    const soften = svg('filter', { id: 'mask-softness', filterUnits: 'userSpaceOnUse', x: 0, y: 0, width, height });
    soften.append(svg('feGaussianBlur', { stdDeviation: .6 })); defs.append(soften);
    for (const [key, group] of groups) {
      defs.append(filterFor(key, group.amount, group.uneven, width, height));
      const mask = svg('mask', { id: `ink-mask-${key}`, maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse', x: 0, y: 0, width, height, 'mask-type': 'alpha' });
      const coverage = svg('g', { filter: 'url(#mask-softness)' });
      for (const cell of group.cells) coverage.append(svg('rect', { x: cell.x, y: cell.y - 7, width: Math.max(.2, cell.right - cell.x), height: cell.h + 2, fill: 'white', opacity: cell.coverage }));
      mask.append(coverage); defs.append(mask);
      const layer = svg('g', { mask: `url(#ink-mask-${key})` });
      layer.append(svg('use', { href: '#ink-source', filter: `url(#ink-filter-${key})` })); layers.append(layer);
    }
  }
  highlight(range: { index: number; length: number } | null) {
    this.highlights.replaceChildren();
    if (!range) return;
    for (const cell of this.cells) {
      if (cell.end <= range.index || cell.start >= range.index + range.length) continue;
      this.highlights.append(svg('rect', { x: cell.x, y: cell.y, width: cell.right - cell.x, height: cell.h, fill: '#a08454', opacity: .2, rx: 1 }));
    }
  }
}
