import test from 'node:test';
import assert from 'node:assert/strict';
import { textSlots } from './flow';
import { readGraphics, graphicPaths, type Graphic } from './graphics';
const graphic: Graphic = { id: 'one', kind: 'orbit', x: 250, y: 150, size: 220, lines: 5, weight: 1.2, gap: 18 };
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
