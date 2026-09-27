export type PrintStyle = 'multiscale' | 'fibrous';
export type PrintSettings = { finish: 'ink' | 'print'; texture: number; paperGrain: number; wear: number; paperStyle: PrintStyle };
export const printDefaults: PrintSettings = { finish: 'ink', texture: 55, paperGrain: 30, wear: 20, paperStyle: 'fibrous' };
export function printSettings(value: Partial<PrintSettings> = {}): PrintSettings {
  const percentage = (x: unknown, fallback: number) => typeof x === 'number' && Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : fallback;
  return { finish: value.finish === 'print' ? 'print' : 'ink', texture: percentage(value.texture, printDefaults.texture), paperGrain: percentage(value.paperGrain, printDefaults.paperGrain), wear: percentage(value.wear, printDefaults.wear), paperStyle: value.paperStyle === 'multiscale' ? 'multiscale' : 'fibrous' };
}
export function printDimensions(width: number, height: number) {
  // Render at up to 2×, with a fixed memory ceiling for long documents.
  const scale = Math.min(2, Math.sqrt(3_000_000 / (width * height)), 8192 / height);
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
}
