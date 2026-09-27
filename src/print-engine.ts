import { rasterizeProof } from './export';
import { printDimensions, printSettings, type PrintSettings } from './print-settings';
import type { Cell } from './render';
export type PrintJob = PrintSettings & { key: string; root: SVGSVGElement; width: number; height: number; cells: Cell[]; font: string; label: string; seed: number; paper: string; selection: { index: number; length: number } | null };
export type PrintedProof = { width: number; height: number; pixels: Uint8ClampedArray; selection: Uint8Array; elapsed: number };
export class PrintEngine {
  private worker?: Worker;
  private sequence = 0;
  private pending?: { id: number; resolve: (proof: PrintedProof) => void; reject: (error: Error) => void; timer: number };
  constructor(private progress: (message: string) => void) {}
  private start() {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./print.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') { this.progress(data.message); return; }
      const pending = this.pending;
      if (!pending || pending.id !== data.id) return;
      clearTimeout(pending.timer); this.pending = undefined;
      if (data.type === 'error') { this.stop(); pending.reject(new Error(data.message)); }
      else pending.resolve({ width: data.width, height: data.height, pixels: new Uint8ClampedArray(data.pixels), selection: new Uint8Array(data.selection), elapsed: data.elapsed });
    };
    worker.onerror = () => { const pending = this.pending; this.stop(); pending?.reject(new Error('The print engine could not start. Check your connection and retry.')); };
    this.worker = worker; return worker;
  }
  stop() { if (this.pending) clearTimeout(this.pending.timer); this.pending = undefined; this.worker?.terminate(); this.worker = undefined; }
  async render(job: PrintJob): Promise<PrintedProof> {
    const { width, height, scale } = printDimensions(job.width, job.height);
    this.progress('Preparing your type…');
    const canvas = await rasterizeProof(job.root, job.width, job.height, job.font, job.label, scale, true);
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
    const cellMask = (include: (cell: Cell) => boolean) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d')!; context.scale(scale, scale); context.fillStyle = 'white';
      for (const cell of job.cells) if (include(cell)) context.fillRect(cell.x, cell.y - 7, Math.max(.2, cell.right - cell.x), cell.h + 2);
      const rgba = context.getImageData(0, 0, width, height).data;
      const mask = new Uint8Array(width * height);
      for (let i = 0; i < mask.length; i++) mask[i] = rgba[i * 4 + 3];
      return mask;
    };
    const protectedPixels = cellMask(cell => cell.attrs.ink === 'clean' || /^0,/.test(cell.attrs.ink || ''));
    const selectedPixels = cellMask(cell => !!job.selection && cell.end > job.selection.index && cell.start < job.selection.index + job.selection.length);
    const transparent = job.paper === 'none';
    const paperRgb = transparent ? [255, 255, 255] : [1, 3, 5].map(start => parseInt(job.paper.slice(start, start + 2), 16));
    const id = ++this.sequence, worker = this.start();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => { this.stop(); reject(new Error('Loading the print engine took too long. Please retry.')); }, 120000);
      this.pending = { id, resolve, reject, timer };
      worker.postMessage({ id, width, height, scale, seed: job.seed, settings: { ...printSettings(job), transparent }, paperRgb, pixels: pixels.buffer, protectedPixels: protectedPixels.buffer, selectedPixels: selectedPixels.buffer }, [pixels.buffer, protectedPixels.buffer, selectedPixels.buffer]);
    });
  }
}
