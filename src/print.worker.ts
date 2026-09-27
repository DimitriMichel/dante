import pipeline from './print-pipeline.py?raw';

const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
const OCRODEG_SOURCE = 'https://raw.githubusercontent.com/NVlabs/ocrodeg/21109cb4ea0ff90306658e904a3a7b36c1e4f6b7/ocrodeg/degrade.py';
const OCRODEG_HASH = '8599b658a9c92e82eee47460766f937210e7e04edb68088a0bcef95bd644f71d';
// The worker never receives document strings, user code, or a configurable source URL.
let runtime: Promise<any> | undefined;
const progress = (message: string) => self.postMessage({ type: 'progress', message });
async function loadEngine() {
  progress('Loading print engine…');
  const runtimeUrl = `${PYODIDE_BASE}pyodide.mjs`;
  const { loadPyodide } = await import(/* @vite-ignore */ runtimeUrl);
  const py = await loadPyodide({ indexURL: PYODIDE_BASE });
  progress('Loading ink & paper tools…');
  await py.loadPackage(['numpy', 'scipy']);
  const response = await fetch(OCRODEG_SOURCE);
  if (!response.ok) throw new Error('The print source could not be downloaded.');
  const source = await response.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', source)), x => x.toString(16).padStart(2, '0')).join('');
  if (hash !== OCRODEG_HASH) throw new Error('The print source failed its integrity check.');
  py.FS.writeFile('/home/pyodide/ocrodeg.py', new Uint8Array(source));
  py.runPython(pipeline);
  return py;
}
self.onmessage = async ({ data }) => {
  const { id, width, height, scale, seed, texture, paperGrain, wear, paperStyle, paperRgb, pixels, protectedPixels } = data;
  let output: any;
  const started = performance.now();
  try {
    runtime ||= loadEngine();
    const py = await runtime;
    progress('Printing your impression…');
    const render = py.globals.get('make_print');
    try { output = render(new Uint8Array(pixels), new Uint8Array(protectedPixels), width, height, scale, seed, texture, paperGrain, wear, paperStyle, paperRgb); }
    finally { render.destroy(); }
    const values = output.toJs();
    const buffer = new Uint8ClampedArray(values).buffer;
    self.postMessage({ type: 'result', id, width, height, elapsed: performance.now() - started, pixels: buffer }, { transfer: [buffer] });
  } catch (error) {
    self.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
  } finally { output?.destroy(); }
};
