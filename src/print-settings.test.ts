import test from 'node:test';
import assert from 'node:assert/strict';
import { printDimensions, printSettings, printDefaults } from './print-settings';
test('existing documents retain the original ink renderer', () => {
  assert.equal(printSettings().finish, 'ink');
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
