import test from 'node:test';
import assert from 'node:assert/strict';
import { printDimensions, printSettings, printDefaults, recipeSettings, validPrintInput } from './print-settings';
test('new and saved documents use Printed without losing effect settings', () => {
  assert.equal(printSettings().finish, 'print');
  const saved = { ...printDefaults, finish: 'ink', texture: 72, wear: 37, rounding: 14, rotation: -3 };
  assert.deepEqual(printSettings(saved), { ...saved, finish: 'print' });
  assert.equal(validPrintInput({ finish: 'ink' }), false);
  assert.equal(validPrintInput({ wear: 37 }), true);
  assert.deepEqual(printSettings({ texture: NaN, wear: Infinity }), printDefaults);
  assert.equal(printSettings({ finish: 'print', texture: 110, wear: -2 }).texture, 100);
  assert.equal(printSettings({ finish: 'print', texture: 110, wear: -2 }).wear, 0);
});
test('normal proofs render at 2x and long proofs stay within the memory ceiling', () => {
  assert.deepEqual(printDimensions(720, 900), { width: 1440, height: 1800, scale: 2 });
  for (const height of [900, 1500, 9000, 100000]) {
    const size = printDimensions(720, height);
    assert.ok(size.width * size.height <= 3_000_000);
    assert.ok(size.height <= 8192);
    assert.ok(size.width > 0 && size.height > 0);
  }
});

test('new controls preserve old settings and validate signed ranges', () => {
  const old = printSettings({ texture: 75, wear: 100, finish: 'print' });
  assert.equal(old.recipe, 'custom'); assert.equal(old.texture, 75); assert.equal(old.wear, 100);
  assert.equal(old.fade, 0); assert.equal(old.pageScale, 100);
  assert.equal(printSettings({ rotation: -90, offsetX: 50, pageScale: NaN }).rotation, -10);
  assert.equal(printSettings({ pageTurn: 12 as 90 }).pageTurn, 0);
  assert.equal(validPrintInput({ finish: 'print', rotation: -8, pageTurn: 270 }), true);
  for (const value of [{ wear: 101 }, { rotation: -11 }, { fade: NaN }, { pageTurn: 45 }, { recipe: 'unknown' }, { surprise: 4 }]) assert.equal(validPrintInput(value), false);
});
test('library looks start without added effects and reset only print settings', () => {
  for (const recipe of ['book', 'fiber'] as const) {
    const s = recipeSettings(recipe);
    assert.equal(s.recipe, recipe); assert.equal(s.finish, 'print');
    assert.equal(s.wear, 0); assert.equal(s.fade, 0); assert.equal(s.rotation, 0); assert.equal(s.pageScale, 100);
    assert.equal('ops' in s, false); assert.equal('spread' in s, false);
  }
});
