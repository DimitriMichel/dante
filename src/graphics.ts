export const graphicKinds = { orbit: 'Orbits', waves: 'Waves', rosette: 'Rosette' } as const;
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
  return { id: crypto.randomUUID(), kind, x: index % 2 ? 90 : 410, y: 265 + index * 60, size: 220, lines: 5, weight: 1.2, gap: 18 };
}
/** All artwork lives inside a circle, so the wrap contour remains predictable. */
export function graphicPaths(g: Pick<Graphic, 'kind' | 'lines'>): string[] {
  const tau = Math.PI * 2;
  const line = (sample: (t: number) => [number, number], turns = 1) => Array.from({ length: 241 }, (_, i) => {
    const [x, y] = sample(i / 240 * tau * turns);
    return `${i ? 'L' : 'M'}${(50 + x).toFixed(3)},${(50 + y).toFixed(3)}`;
  }).join(' ');
  const ellipse = (rx: number, ry: number, angle: number) => line(t => {
    const x = rx * Math.cos(t), y = ry * Math.sin(t);
    return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
  });
  if (g.kind === 'orbit') return [
    ...Array.from({ length: g.lines }, (_, i) => ellipse(44, 15 + i * 1.3, i * Math.PI / g.lines - .3)),
    ellipse(8, 8, 0),
    'M47 50 L53 50 M50 47 L50 53',
  ];
  if (g.kind === 'waves') return Array.from({ length: g.lines }, (_, i) => line(t => {
    const r = 13 + i * (29 / Math.max(1, g.lines - 1)) + 2.4 * Math.sin(5 * t + i * .75);
    return [r * Math.cos(t), r * Math.sin(t)];
  }));
  return [line(t => {
    const r = 30 + 13 * Math.cos(g.lines * t);
    return [r * Math.cos(t), r * Math.sin(t)];
  }), ellipse(10, 10, 0), ellipse(45, 45, 0)];
}
export function graphicSvg(g: Pick<Graphic, 'kind' | 'lines' | 'weight'>, color = 'currentColor') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 100 100');
  node.setAttribute('fill', 'none'); node.setAttribute('stroke', color);
  node.setAttribute('stroke-width', String(g.weight));
  node.setAttribute('stroke-linecap', 'round'); node.setAttribute('stroke-linejoin', 'round');
  node.setAttribute('aria-hidden', 'true');
  for (const d of graphicPaths(g)) {
    const path = document.createElementNS(node.namespaceURI, 'path'); path.setAttribute('d', d); node.append(path);
  }
  return node;
}
