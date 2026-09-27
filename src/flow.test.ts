import test from 'node:test';
import assert from 'node:assert/strict';
import { textSlots, wrapParagraph } from './flow';
import { readGraphics, graphicPaths, type Graphic } from './graphics';
const graphic: Graphic = { id: 'one', kind: 'orbit', x: 250, y: 150, size: 220, lines: 5, weight: 1.2, gap: 18 };
const settings = { baseline: 72, lineHeight: 42, size: 28, left: 72, right: 648, graphics: [graphic] };
const glyphs = (text: string) => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), item => ({ text: item.segment }));
const measure = (items: { text: string }[]) => items.length * 12;

test('middle graphics leave text space on both sides and restore full width below', () => {
  assert.deepEqual(textSlots(250, 270, 72, 648, [graphic]), [{ left: 72, right: 232 }, { left: 488, right: 648 }]);
  assert.deepEqual(textSlots(420, 450, 72, 648, [graphic]), [{ left: 72, right: 648 }]);
  const upper = textSlots(130, 140, 72, 648, [graphic]);
  assert.ok(upper[0].right > 232);
});
test('overlapping graphics merge exclusions without overlapping text segments', () => {
  const slots = textSlots(250, 270, 72, 648, [graphic, { ...graphic, id: 'two', x: 380 }]);
  assert.deepEqual(slots, [{ left: 72, right: 232 }, { left: 618, right: 648 }]);
});
test('wrapping preserves graphemes, spaces, formatting references, and reading order', () => {
  const items = glyphs('Soft edges, living ink. Café 👨‍👩‍👧‍👦 — Keep every character. '.repeat(12));
  const result = wrapParagraph(items, measure, settings);
  assert.deepEqual(result.lines.flatMap(row => row.items), items);
  for (const row of result.lines) {
    assert.ok(measure(row.items) <= row.right - row.left);
    const slots = textSlots(row.baseline - settings.size - 3, row.baseline + settings.size * .3 + 3, 72, 648, [graphic]);
    assert.ok(slots.some(slot => row.left >= slot.left && row.right <= slot.right));
  }
  assert.ok(result.lines.some((row, i) => i > 0 && row.baseline === result.lines[i - 1].baseline));
});
test('whole words move past narrow spaces; unbreakable long words still progress', () => {
  const items = glyphs('astronomical '.repeat(10) + 'x'.repeat(200));
  const result = wrapParagraph(items, measure, settings);
  assert.equal(result.lines.flatMap(row => row.items).map(g => g.text).join(''), items.map(g => g.text).join(''));
  assert.ok(result.baseline < 2000);
  for (const row of result.lines) assert.ok(measure(row.items) <= row.right - row.left);
});
test('a row fully blocked by graphics advances below them; empty paragraphs retain spacing', () => {
  const graphics = [{ ...graphic, x: 72, size: 320 }, { ...graphic, x: 328, size: 320 }];
  const result = wrapParagraph(glyphs('Text remains visible.'), measure, { ...settings, baseline: 200, graphics });
  assert.equal(result.lines.flatMap(row => row.items).map(g => g.text).join(''), 'Text remains visible.');
  assert.ok(result.baseline > 400 && result.baseline < 650);
  assert.equal(wrapParagraph([], measure, settings).baseline, 114);
});
test('documents without graphics retain ordinary wrapping', () => {
  const result = wrapParagraph(glyphs('abc def ghi jkl mno'), measure, { ...settings, left: 0, right: 100, graphics: [] });
  assert.deepEqual(result.lines.map(row => row.items.map(g => g.text).join('')), ['abc def ', 'ghi jkl ', 'mno']);
});
test('legacy documents need no migration and saved graphics are bounded', () => {
  assert.deepEqual(readGraphics(undefined), []);
  const [g] = readGraphics([{ ...graphic, size: 900, x: 1000, lines: 100, y: -8 }, graphic, { ...graphic, kind: 'invalid' }]);
  assert.equal(g.size, 320); assert.equal(g.x, 328); assert.equal(g.y, 72); assert.equal(g.lines, 12);
  assert.equal(readGraphics([graphic, graphic]).length, 1);
});
test('all graphic paths are deterministic, finite, and contained by the wrapping circle', () => {
  for (const kind of ['orbit', 'waves', 'rosette'] as const) for (const lines of [3, 5, 12]) {
    const paths = graphicPaths({ kind, lines });
    assert.deepEqual(paths, graphicPaths({ kind, lines }));
    assert.ok(paths.length > 0);
    for (const path of paths) {
      assert.ok(!path.includes('NaN'));
      for (const match of path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)) assert.ok(Math.hypot(Number(match[1]) - 50, Number(match[2]) - 50) < 49);
    }
  }
});
