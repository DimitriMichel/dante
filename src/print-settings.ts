export const printControls = {
  texture: { label: 'Ink texture', help: 'Small variations within dark ink.', min: 0, max: 100, initial: 55, group: 'ink' },
  fade: { label: 'Faded ink', help: 'Lighten the lettering, like an old ribbon.', min: 0, max: 100, initial: 0, group: 'ink' },
  wear: { label: 'Missing ink', help: 'Break up letters with small worn patches.', min: 0, max: 100, initial: 20, group: 'ink' },
  speckles: { label: 'Stray ink', help: 'Add ink flecks around the lettering.', min: 0, max: 100, initial: 0, group: 'ink' },
  paperGrain: { label: 'Paper grain', help: 'Bring out the texture of the paper.', min: 0, max: 100, initial: 30, group: 'ink' },
  roughness: { label: 'Rough edges', help: 'Make the outlines of letters less even.', min: 0, max: 100, initial: 0, group: 'edges' },
  rounding: { label: 'Rounded edges', help: 'Round off sharp corners while keeping dark ink.', min: 0, max: 100, initial: 0, group: 'edges' },
  edgeNoise: { label: 'Broken edges', help: 'Give letter edges a scratchy, photocopied finish.', min: 0, max: 100, initial: 0, group: 'edges' },
  softness: { label: 'Soft edges', help: 'Soften the focus of the lettering.', min: 0, max: 100, initial: 0, group: 'edges' },
  wave: { label: 'Wavy lines', help: 'Bend lines as if the paper were gently curled.', min: 0, max: 100, initial: 0, group: 'page' },
  placement: { label: 'Crooked impression', help: 'Vary the angle, size, and position. New impression reshuffles it.', min: 0, max: 100, initial: 0, group: 'page' },
  rotation: { label: 'Tilt', help: 'Turn the text slightly left or right.', min: -10, max: 10, initial: 0, group: 'page', unit: '°' },
  stretch: { label: 'Letter width', help: 'Make the impression narrower or wider.', min: -40, max: 40, initial: 0, group: 'page', unit: '%' },
  pageScale: { label: 'Size on page', help: 'Enlarge or reduce the impression. Large sizes can crop the edges.', min: 70, max: 120, initial: 100, group: 'page', unit: '%' },
  offsetX: { label: 'Move left / right', help: 'Shift the impression across the page.', min: -15, max: 15, initial: 0, group: 'page', unit: '%' },
  offsetY: { label: 'Move up / down', help: 'Shift the impression along the page.', min: -15, max: 15, initial: 0, group: 'page', unit: '%' },
} as const;
export type PrintControl = keyof typeof printControls;
export type PrintStyle = 'multiscale' | 'fibrous';
export type PrintSettings = Record<PrintControl, number> & { finish: 'ink' | 'print'; paperStyle: PrintStyle; recipe: 'custom' | 'book' | 'fiber'; pageTurn: 0 | 90 | 180 | 270 };
export const printDefaults: PrintSettings = { ...Object.fromEntries(Object.entries(printControls).map(([key, spec]) => [key, spec.initial])) as Record<PrintControl, number>, finish: 'ink', paperStyle: 'fibrous', recipe: 'custom', pageTurn: 0 };
export function printSettings(value: Partial<PrintSettings> = {}): PrintSettings {
  const result = { ...printDefaults };
  for (const key of Object.keys(printControls) as PrintControl[]) {
    const x = value[key], spec = printControls[key];
    result[key] = typeof x === 'number' && Number.isFinite(x) ? Math.round(Math.min(spec.max, Math.max(spec.min, x))) : spec.initial;
  }
  result.finish = value.finish === 'print' ? 'print' : 'ink';
  result.paperStyle = value.paperStyle === 'multiscale' ? 'multiscale' : 'fibrous';
  result.recipe = value.recipe === 'book' || value.recipe === 'fiber' ? value.recipe : 'custom';
  result.pageTurn = [90, 180, 270].includes(value.pageTurn || 0) ? value.pageTurn! : 0;
  return result;
}
export function recipeSettings(recipe: PrintSettings['recipe']): PrintSettings {
  const settings = { ...printDefaults, finish: 'print' as const, recipe };
  // Library examples begin without extra damage or geometric adjustments.
  if (recipe !== 'custom') for (const key of Object.keys(printControls) as PrintControl[]) settings[key] = key === 'pageScale' ? 100 : 0;
  return settings;
}
export function validPrintInput(input: unknown): input is Partial<PrintSettings> {
  if (!input || typeof input !== 'object') return false;
  const value = input as Record<string, unknown>;
  return Object.entries(value).every(([key, x]) => {
    if (key in printControls) { const spec = printControls[key as PrintControl]; return typeof x === 'number' && Number.isInteger(x) && x >= spec.min && x <= spec.max; }
    if (key === 'finish') return x === 'ink' || x === 'print';
    if (key === 'recipe') return ['custom', 'book', 'fiber'].includes(String(x));
    if (key === 'paperStyle') return x === 'multiscale' || x === 'fibrous';
    if (key === 'pageTurn') return [0, 90, 180, 270].includes(x as number);
    return false;
  });
}
export function printDimensions(width: number, height: number) {
  const scale = Math.min(2, Math.sqrt(3_000_000 / (width * height)), 8192 / height);
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
}
