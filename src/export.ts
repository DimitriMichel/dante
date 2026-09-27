import { fontOptions, type FontKey } from './fonts';
const fontFiles = import.meta.glob('../node_modules/@fontsource/*/files/*-latin-{400,700}-{normal,italic}.woff2', { query: '?url', import: 'default' });
async function dataUrl(blob: Blob): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); }); }
const embeddedFonts = new Map<string, Promise<string>>();
export async function rasterizeProof(root: SVGSVGElement, width: number, height: number, font: string, label: string, scale = Math.min(2, 8192 / height), mask = false) {
  const clone = root.cloneNode(true) as SVGSVGElement;
  clone.querySelector('[data-selection]')?.remove();
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const folder = fontOptions[font as FontKey]?.folder;
  if (folder) {
    if (!embeddedFonts.has(font)) embeddedFonts.set(font, Promise.all(Object.entries(fontFiles).filter(([path]) => path.includes(`/${folder}/`) && /-latin-(400|700)-(normal|italic)\.woff2$/.test(path)).map(async ([path, loader]) => {
      const url = await loader() as string, match = path.match(/-latin-(400|700)-(normal|italic)\.woff2$/)!;
      const response = await fetch(url); if (!response.ok) throw new Error('Font could not load');
      return `@font-face{font-family:'${label}';font-weight:${match[1]};font-style:${match[2]};src:url('${await dataUrl(await response.blob())}') format('woff2');}`;
    })).then(css => css.join('\n')).catch(error => { embeddedFonts.delete(font); throw error; }));
    const css = await embeddedFonts.get(font)!;
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style'); style.textContent = css; clone.prepend(style);
  }
  if (mask) {
    clone.querySelector(':scope > rect')?.setAttribute('fill', 'white');
    clone.querySelector('#ink-source')?.setAttribute('fill', 'black');
    clone.querySelectorAll('feFlood').forEach(el => el.setAttribute('flood-color', 'black'));
  }
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * scale)); canvas.height = Math.max(1, Math.floor(height * scale));
    const ctx = canvas.getContext('2d')!; ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

export async function downloadCanvas(canvas: HTMLCanvasElement) {
  const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'));
  const downloadUrl = URL.createObjectURL(png), anchor = document.createElement('a'); anchor.href = downloadUrl; anchor.download = 'impression.png'; anchor.click(); setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
}
export async function exportPng(root: SVGSVGElement, width: number, height: number, font: string, label: string) {
  await downloadCanvas(await rasterizeProof(root, width, height, font, label));
}
