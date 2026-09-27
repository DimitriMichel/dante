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
export type FlowLine<T> = { items: T[]; left: number; right: number; baseline: number };
export function wrapParagraph<T extends { text: string }>(items: T[], measure: (items: T[]) => number, options: { baseline: number; lineHeight: number; size: number; left: number; right: number; graphics: Graphic[] }) {
  const { lineHeight, size, left, right, graphics } = options;
  const lines: FlowLine<T>[] = [];
  let first = 0, baseline = options.baseline;
  if (!items.length) return { lines, baseline: baseline + lineHeight };
  while (first < items.length) {
    baseline += lineHeight;
    const slots = textSlots(baseline - size - 3, baseline + size * .3 + 3, left, right, graphics);
    for (const slot of slots) {
      if (first >= items.length) break;
      const available = slot.right - slot.left;
      // Move a whole word to a roomier segment or row instead of splitting it
      // into single letters beside an illustration. Very long words still wrap.
      let wordEnd = first;
      while (wordEnd < items.length && !/\s/u.test(items[wordEnd].text)) wordEnd++;
      const wordWidth = measure(items.slice(first, wordEnd));
      if (available < size * 1.5 || (wordWidth > available && wordWidth <= right - left)) continue;
      let end = first, breakAfter = -1;
      while (end < items.length) {
        if (end > first && measure(items.slice(first, end + 1)) > available) break;
        if (/\s/u.test(items[end].text)) breakAfter = end + 1;
        end++;
      }
      if (end < items.length && breakAfter > first) end = breakAfter;
      lines.push({ items: items.slice(first, end), ...slot, baseline });
      first = end;
    }
  }
  return { lines, baseline };
}
