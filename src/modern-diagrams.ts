/** Original illustrative diagrams. They are not live data or physical simulations. */
export const modernDiagramKinds = {
  'tech-circuit-traces': 'Circuit traces',
  'tech-transistor': 'Transistor circuit',
  'tech-logic-gates': 'Logic gates',
  'tech-network': 'Network topology',
  'ai-neural-network': 'Neural network',
  'ai-attention': 'Attention map',
  'ai-decision-tree': 'Decision tree',
  'ai-embeddings': 'Embedding space',
  'ai-learning': 'Learning landscape',
  'ai-autoencoder': 'Autoencoder',
  'money-guilloche': 'Banknote guilloche',
  'money-candles': 'Market candles',
  'money-growth': 'Compound growth',
  'money-supply-demand': 'Supply & demand',
} as const;
export type ModernDiagramKind = keyof typeof modernDiagramKinds;
export type ModernCategory = 'technology' | 'ai' | 'money';
export const modernDiagramCategories = Object.fromEntries(Object.keys(modernDiagramKinds).map(kind => [kind, kind.startsWith('tech-') ? 'technology' : kind.startsWith('ai-') ? 'ai' : 'money'])) as Record<ModernDiagramKind, ModernCategory>;
type Point = [number, number];
const tau = 2 * Math.PI;
const line = (...points: Point[]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
const trace = (sample: (t: number) => Point, steps = 240) => line(...Array.from({ length: steps + 1 }, (_, i) => sample(i / steps)));
const ellipse = (x: number, y: number, rx: number, ry = rx) => trace(t => [x + rx * Math.cos(t * tau), y + ry * Math.sin(t * tau)], 96);
const rect = (x: number, y: number, w: number, h: number) => line([x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]);
const segmentDots = (a: Point, b: Point) => Array.from({ length: 7 }, (_, i) => line(
  [a[0] + (b[0] - a[0]) * i / 7, a[1] + (b[1] - a[1]) * i / 7],
  [a[0] + (b[0] - a[0]) * (i + .35) / 7, a[1] + (b[1] - a[1]) * (i + .35) / 7],
));

function layers(counts: number[]): string[] {
  const nodes = counts.map((count, layer) => Array.from({ length: count }, (_, i): Point => [18 + 64 * layer / (counts.length - 1), count === 1 ? 50 : 50 + (i / (count - 1) - .5) * Math.min(48, count * 11)]));
  const paths: string[] = [];
  for (let layer = 0; layer < nodes.length - 1; layer++) for (const from of nodes[layer]) for (const to of nodes[layer + 1]) {
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
    paths.push(line([from[0] + 2.6 * Math.cos(angle), from[1] + 2.6 * Math.sin(angle)], [to[0] - 2.6 * Math.cos(angle), to[1] - 2.6 * Math.sin(angle)]));
  }
  return [...paths, ...nodes.flatMap(column => column.map(([x, y]) => ellipse(x, y, 2.6)))];
}

export function modernDiagramPaths(kind: ModernDiagramKind, detail: number): string[] {
  const n = Math.round(Math.max(3, Math.min(12, detail)));
  switch (kind) {
    case 'tech-circuit-traces': {
      const count = Math.min(7, n), paths = [rect(34, 34, 32, 32), rect(41, 41, 18, 18)];
      for (let side = 0; side < 4; side++) for (let i = 0; i < count; i++) {
        const x = 38 + i * 24 / (count - 1), end = 13 + (i % 3) * 4;
        const rotate = ([px, py]: Point): Point => { const a = side * Math.PI / 2; return [50 + (px - 50) * Math.cos(a) - (py - 50) * Math.sin(a), 50 + (px - 50) * Math.sin(a) + (py - 50) * Math.cos(a)]; };
        paths.push(line(...[[x, 34], [x, 27], [x + (x - 50) * .5, 22], [x + (x - 50) * .5, end]].map(p => rotate(p as Point))));
        const terminal = rotate([x + (x - 50) * .5, end]); paths.push(ellipse(...terminal, 1.1));
      }
      return paths;
    }
    case 'tech-transistor': {
      const teeth = Math.max(3, Math.round(n / 2));
      const resistor = line([24, 50], ...Array.from({ length: teeth * 2 }, (_, i): Point => [25 + i * 15 / (teeth * 2 - 1), 50 + (i % 2 ? -2.2 : 2.2)]), [41, 50]);
      return [ellipse(52, 50, 12), line([47, 42], [47, 58]), line([47, 47], [59, 39], [59, 22], [73, 22]), line([47, 53], [59, 62], [59, 76]), line([54, 58], [59, 62], [57, 56]), line([14, 50], [24, 50]), resistor, line([41, 50], [47, 50]), line([51, 76], [67, 76]), line([54, 80], [64, 80]), line([57, 83], [61, 83]), ellipse(14, 50, 1.3), ellipse(73, 22, 1.3)];
    }
    case 'tech-logic-gates': {
      const paths = ['M34 24 L43 24 C60 24 60 44 43 44 L34 44 L34 24', 'M34 56 L43 56 C60 56 60 76 43 76 L34 76 L34 56', ellipse(57, 66, 2), line([56, 34], [64, 34], [64, 46], [71, 46]), line([59, 66], [64, 66], [64, 54], [71, 54]), 'M69 42 Q77 42 84 50 Q77 58 69 58 Q74 50 69 42', line([84, 50], [88, 50]), ellipse(89, 50, 1.2)];
      for (const y of [29, 39, 61, 71]) paths.push(line([20, y], [34, y]), ellipse(18, y, 1.2));
      if (n > 5) paths.push('M66 43 Q70 50 66 57');
      return paths;
    }
    case 'tech-network': {
      const count = Math.min(10, n + 2), points = Array.from({ length: count }, (_, i): Point => [50 + 35 * Math.cos(tau * i / count), 50 + 35 * Math.sin(tau * i / count)]);
      return [ellipse(50, 50, 6), ...points.flatMap(([x, y], i) => [ellipse(x, y, 3), line([50 + (x - 50) * 6 / 35, 50 + (y - 50) * 6 / 35], [x - (x - 50) * 3 / 35, y - (y - 50) * 3 / 35]), ...segmentDots([x, y], points[(i + 1) % count])])];
    }
    case 'ai-neural-network': return layers([3, Math.min(6, n), Math.min(5, Math.max(3, n - 1)), 2]);
    case 'ai-autoencoder': return layers([Math.min(7, n + 1), 3, 1, 3, Math.min(7, n + 1)]);
    case 'ai-attention': {
      const cells = Math.min(8, n + 1), step = 52 / cells, paths = [rect(24, 24, 52, 52)];
      for (let i = 1; i < cells; i++) paths.push(line([24, 24 + i * step], [76, 24 + i * step]), line([24 + i * step, 24], [24 + i * step, 76]));
      for (let row = 0; row < cells; row++) for (let col = 0; col <= row; col++) {
        const radius = step * (row === col ? .34 : .09 + ((row * 7 + col * 3) % 5) * .045);
        paths.push(ellipse(24 + (col + .5) * step, 24 + (row + .5) * step, radius));
      }
      return paths;
    }
    case 'ai-decision-tree': {
      const paths = [ellipse(50, 18, 3), rect(24, 35, 8, 8), rect(68, 35, 8, 8), line([50, 21], [50, 27], [28, 27], [28, 35]), line([50, 27], [72, 27], [72, 35])];
      for (const [parent, children] of [[28, [18, 38]], [72, [62, 82]]] as [number, number[]][]) for (const x of children) {
        paths.push(line([parent, 43], [parent, 51], [x, 51], [x, 65]), ellipse(x, 68, 3));
        if (n > 5) paths.push(line([x, 71], [x, 77]), line([x - 3, 80], [x, 77], [x + 3, 80]));
      }
      return paths;
    }
    case 'ai-embeddings': {
      const paths = [line([18, 20], [18, 78], [82, 78])];
      for (const [index, center] of ([[35, 35], [66, 42], [48, 64]] as Point[]).entries()) {
        paths.push(ellipse(...center, 12, 9));
        for (let i = 0; i < n + 3; i++) { const a = i * 2.399 + index, r = 1.7 + 6.7 * Math.sqrt(i / (n + 2)); paths.push(ellipse(center[0] + r * Math.cos(a), center[1] + r * .7 * Math.sin(a), .8)); }
      }
      return paths;
    }
    case 'ai-learning': {
      const count = Math.min(9, n + 2), paths: string[] = [];
      for (let i = 0; i < count; i++) paths.push(trace(t => { const a = t * tau, r = 7 + i * 4 + 1.8 * Math.sin(3 * a + i * .22); return [51 + r * Math.cos(a), 53 + r * .72 * Math.sin(a)]; }));
      const descent: Point[] = [[22, 29], [69, 31], [36, 45], [61, 48], [46, 55], [54, 58]];
      return [...paths, line(...descent), ...descent.map(([x, y]) => ellipse(x, y, 1.3))];
    }
    case 'money-guilloche': {
      const loops = n + 9;
      return [ellipse(50, 50, 44, 31), ellipse(50, 50, 42, 29), ...[0, Math.PI].map(phase => trace(t => { const a = t * tau; return [50 + 36 * Math.cos(a) + 5 * Math.cos(loops * a + phase), 50 + 22 * Math.sin(a) + 6 * Math.sin(loops * a + phase)]; }, 1200))];
    }
    case 'money-candles': {
      const count = Math.min(10, n + 2), paths = [line([16, 23], [16, 78], [83, 78])];
      for (let i = 0; i < count; i++) {
        const x = 25 + i * 52 / (count - 1), y = 64 - i * 3.5 + 6 * Math.sin(i * 1.8), h = 5 + (i % 3) * 3, w = Math.min(5, 34 / count);
        paths.push(line([x, y - h / 2 - 6], [x, y - h / 2]), rect(x - w / 2, y - h / 2, w, h), line([x, y + h / 2], [x, y + h / 2 + 5]));
        if (i % 3 === 1) for (let y0 = y - h / 2 + 2; y0 < y + h / 2; y0 += 2) paths.push(line([x - w / 2, y0], [x + w / 2, y0]));
      }
      return paths;
    }
    case 'money-growth': return [line([17, 22], [17, 77], [83, 77]), line([23, 70], [80, 50]), ...Array.from({ length: Math.min(4, Math.max(2, Math.round(n / 3))) }, (_, i) => trace(t => [23 + 57 * t, 70 - (40 + i * 3) * (Math.exp((1.5 + i * .7) * t) - 1) / (Math.exp(1.5 + i * .7) - 1)]))];
    case 'money-supply-demand': {
      const x = 23 + 56 * 46 / 94, y = 73 - 50 * 46 / 94;
      return [line([20, 20], [20, 78], [82, 78]), line([23, 73], [79, 23]), line([23, 27], [79, 71]), ellipse(x, y, 2.1), ...segmentDots([20, y], [x, y]), ...segmentDots([x, y], [x, 78])];
    }
  }
}

export function modernDiagramLabels(kind: string): { text: string; x: number; y: number }[] {
  if (kind === 'tech-transistor') return [{ text: 'B', x: 19, y: 44 }, { text: 'C', x: 65, y: 34 }, { text: 'E', x: 67, y: 67 }];
  if (kind === 'ai-autoencoder') return [{ text: 'z', x: 50, y: 63 }];
  if (kind === 'ai-attention') return [{ text: 'Q', x: 18, y: 52 }, { text: 'K', x: 50, y: 18 }];
  if (kind === 'money-supply-demand') return [{ text: 'P', x: 17, y: 20 }, { text: 'Q', x: 76, y: 85 }, { text: 'S', x: 78, y: 19 }, { text: 'D', x: 83, y: 70 }];
  return [];
}
