import { animalArt, isAnimal, type AnimalKind } from './animal-art';
import { diagramKinds, diagramCategories, diagramPaths, diagramLabels } from './diagrams';
export const graphicKinds = { ...diagramKinds, ...Object.fromEntries(Object.entries(animalArt).map(([key, value]) => [key, value.label])) as Record<AnimalKind, string> };
export const graphicCategories = { ...diagramCategories, ...Object.fromEntries(Object.keys(animalArt).map(key => [key, 'animals'])) as Record<AnimalKind, 'animals'> };
export type GraphicKind = keyof typeof graphicKinds;
export type Graphic = { id: string; kind: GraphicKind; x: number; y: number; size: number; lines: number; weight: number; gap: number };
export type GraphicBox = { x: number; y: number; width: number; height: number };
export type GraphicPlacement = GraphicBox & { id: string; inverse: number[] };
const clamp = (n: unknown, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, typeof n === 'number' && Number.isFinite(n) ? n : fallback));
export function readGraphics(value: unknown): Graphic[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.slice(0, 8).flatMap(item => {
    if (!item || typeof item !== 'object' || !Object.hasOwn(graphicKinds, item.kind) || typeof item.id !== 'string' || !/^[\w-]{1,64}$/.test(item.id) || ids.has(item.id)) return [];
    ids.add(item.id);
    const size = clamp(item.size, 220, 100, 320);
    return [{ id: item.id, kind: item.kind, size, x: clamp(item.x, 360, 72, 648 - size), y: clamp(item.y, 280, 72, 20000), lines: Math.round(clamp(item.lines, 5, 3, 12)), weight: clamp(item.weight, 1.2, .6, 3), gap: clamp(item.gap, 18, 8, 40) }];
  });
}
export function graphicBox(g: Graphic): GraphicBox { return { x: g.x, y: g.y, width: g.size, height: g.size }; }
export function moveGraphic(g: Graphic, x: number, y: number, height: number): void {
  g.x = Math.max(72, Math.min(648 - g.size, x));
  g.y = Math.max(72, Math.min(Math.max(72, height - 72 - g.size), y));
}
export function makeGraphic(kind: GraphicKind, index = 0): Graphic {
  const size = isAnimal(kind) ? 280 : 220;
  return { id: crypto.randomUUID(), kind, x: index % 2 ? 90 : 630 - size, y: 265 + index * 60, size, lines: 5, weight: 1.2, gap: 18 };
}
/** All artwork lives inside a circle, so the wrap contour remains predictable. */
export function graphicPaths(g: Pick<Graphic, 'kind' | 'lines'>): string[] { return isAnimal(g.kind) ? [] : diagramPaths({ ...g, kind: g.kind }); }
let artSequence = 0;
export function graphicSvg(g: Pick<Graphic, 'kind' | 'lines' | 'weight'>, color = 'currentColor') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 100 100');
  node.setAttribute('fill', 'none'); node.setAttribute('stroke', color);
  node.setAttribute('stroke-width', String(g.weight));
  node.setAttribute('stroke-linecap', 'round'); node.setAttribute('stroke-linejoin', 'round');
  node.setAttribute('aria-hidden', 'true');
  if (isAnimal(g.kind)) {
    const art = animalArt[g.kind], ratio = art.width / art.height;
    // Fit the entire rectangle inside the wrapping circle, including its corners.
    const height = 88 / Math.sqrt(ratio * ratio + 1), width = height * ratio;
    const id = `engraving-${++artSequence}`;
    const make = (tag: string, attrs: Record<string,string>) => { const el = document.createElementNS(node.namespaceURI, tag); for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,value); return el; };
    const defs = make('defs', {}), filter = make('filter', { id, x:'0', y:'0', width:'100%', height:'100%', 'color-interpolation-filters':'sRGB' });
    // Treat paper as transparency and retain the original engraving's ink density.
    filter.append(make('feColorMatrix', { type:'matrix', values:'0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 0 1' }));
    const contrast = make('feComponentTransfer', { result:'engraved-ink' });
    contrast.append(make('feFuncA', { type:'linear', slope:'1.25', intercept:'-.12' }));
    filter.append(contrast, make('feFlood', { 'flood-color':color }), make('feComposite', { in2:'engraved-ink', operator:'in' }));
    defs.append(filter);
    const image = make('image', { href:art.file, x:String(50-width/2), y:String(50-height/2), width:String(width), height:String(height), filter:`url(#${id})` });
    node.append(defs, image); return node;
  }
  for (const d of graphicPaths(g)) {
    const path = document.createElementNS(node.namespaceURI, 'path'); path.setAttribute('d', d); node.append(path);
  }
  for (const label of diagramLabels(g.kind)) {
    const text = document.createElementNS(node.namespaceURI, 'text');
    text.setAttribute('x',String(label.x)); text.setAttribute('y',String(label.y));
    text.setAttribute('stroke','none'); text.setAttribute('fill',color);
    text.setAttribute('font-family','Georgia, serif'); text.setAttribute('font-size','6'); text.setAttribute('font-style','italic'); text.setAttribute('text-anchor','middle');
    text.textContent=label.text; node.append(text);
  }
  return node;
}
