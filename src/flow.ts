import { clearCache, prepareWithSegments } from '@chenglou/pretext';
import { prepareRichInline, layoutNextRichInlineLineRange, type PreparedRichInline, type RichInlineCursor } from '@chenglou/pretext/rich-inline';
import { type Graphic } from './graphics';
export type Slot = { left: number; right: number };
/** Exclude the widest part of each circular contour touched by this text row. */
export function textSlots(top: number, bottom: number, left: number, right: number, graphics: Graphic[]): Slot[] {
  let slots = [{ left, right }];
  for (const g of graphics) {
    const radius = g.size / 2 + g.gap;
    const cx = g.x + g.size / 2, cy = g.y + g.size / 2;
    const nearestY = Math.max(top, Math.min(bottom, cy));
    const dy = Math.abs(nearestY - cy);
    if (dy >= radius) continue;
    const dx = Math.sqrt(radius * radius - dy * dy);
    const a = cx - dx, b = cx + dx;
    slots = slots.flatMap(slot => {
      if (a >= slot.right || b <= slot.left) return [slot];
      return [{ left: slot.left, right: Math.min(slot.right, a) }, { left: Math.max(slot.left, b), right: slot.right }].filter(s => s.right > s.left);
    });
  }
  return slots;
}
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
type CursorMap = { offsets: number[][]; source: number[] };
export type PreparedParagraph = { flow: PreparedRichInline; maps: CursorMap[]; length: number };
const cache = new Map<string, PreparedParagraph>();
export function clearFlowCache() { cache.clear(); clearCache(); }
/** A measurement-only copy: NBSP preserves authored spaces; ZWSP restores breaks.
 * Source glyphs, UTF-16 offsets, and Quill formatting are never rewritten.
 * Tabs have an explicit four-space advance in both layout and SVG painting.
 */
export function displayGlyph(text: string) { return text === '\t' ? '    ' : text; }
export function prepareParagraph<T extends { text: string }>(items: T[], fontFor: (item: T) => string): PreparedParagraph {
  const runs: { text: string; font: string; source: number[] }[] = [];
  items.forEach((item, index) => {
    const font = fontFor(item);
    let run = runs.at(-1);
    if (!run || run.font !== font) { run = { text: '', font, source: [index] }; runs.push(run); }
    const encoded = item.text === '\t' ? '\u00a0\u00a0\u00a0\u00a0\u200b' : /^[ \r\n\f]+$/.test(item.text) ? '\u00a0\u200b' : item.text;
    run.text += encoded;
    for (let i = 0; i < encoded.length; i++) run.source.push(i === encoded.length - 1 ? index + 1 : index);
    // The inserted break is outside the source grapheme.
    if (encoded.endsWith('\u200b') && encoded.length > 1) run.source[run.source.length - 2] = index + 1;
  });
  const key = JSON.stringify(runs.map(run => [run.font, run.text, run.source]));
  const existing = cache.get(key);
  if (existing) { cache.delete(key); cache.set(key, existing); return existing; }
  const maps = runs.map(run => {
    const prepared = prepareWithSegments(run.text, run.font);
    let offset = 0;
    const offsets = prepared.segments.map(segment => {
      const start = offset; offset += segment.length;
      return [...Array.from(graphemes.segment(segment), g => start + g.index), offset];
    });
    offsets.push([offset]);
    return { offsets, source: run.source };
  });
  const prepared = { flow: prepareRichInline(runs), maps, length: items.length };
  cache.set(key, prepared);
  if (cache.size > 128) cache.delete(cache.keys().next().value!);
  return prepared;
}
export function sourceCursor(prepared: PreparedParagraph, cursor: RichInlineCursor) {
  const map = prepared.maps[cursor.itemIndex];
  if (!map) return prepared.length;
  const offset = map.offsets[cursor.segmentIndex]?.[cursor.graphemeIndex];
  if (offset === undefined || map.source[offset] === undefined) throw new Error('Invalid Pretext source cursor.');
  return map.source[offset];
}
export type FlowLine<T> = { items: T[]; left: number; right: number; baseline: number; width: number };
export function wrapParagraph<T extends { text: string }>(items: T[], prepared: PreparedParagraph, options: { baseline: number; lineHeight: number; size: number; left: number; right: number; graphics: Graphic[] }) {
  const { lineHeight, size, left, right, graphics } = options;
  const lines: FlowLine<T>[] = [];
  let first = 0, baseline = options.baseline;
  let cursor: RichInlineCursor = { itemIndex: 0, segmentIndex: 0, graphemeIndex: 0 };
  if (!items.length) return { lines, baseline: baseline + lineHeight };
  while (first < items.length) {
    baseline += lineHeight;
    for (const slot of textSlots(baseline - size - 3, baseline + size * .3 + 3, left, right, graphics)) {
      if (first >= items.length) break;
      const available = slot.right - slot.left;
      if (available < size * 1.5) continue;
      const line = layoutNextRichInlineLineRange(prepared.flow, available, cursor);
      if (!line) {
        // Pretext can consume an all-control suffix without a painted line.
        lines.push({ items: items.slice(first), width: 0, ...slot, baseline });
        first = items.length; break;
      }
      const end = sourceCursor(prepared, line.end);
      // A whole word that fits the page should move below a narrow contour.
      if (end < items.length && end > first && !/\s/u.test(items[end - 1].text) && !/\s/u.test(items[end].text) && available < right - left) {
        const whole = layoutNextRichInlineLineRange(prepared.flow, right - left, cursor);
        const nextBreak = items.findIndex((g, i) => i >= end && /\s/u.test(g.text));
        if (whole && sourceCursor(prepared, whole.end) >= (nextBreak < 0 ? items.length : nextBreak)) continue;
      }
      if (end <= first) throw new Error('Pretext did not advance through the source text.');
      lines.push({ items: items.slice(first, end), width: line.width, ...slot, baseline });
      first = end; cursor = line.end;
    }
  }
  return { lines, baseline };
}
