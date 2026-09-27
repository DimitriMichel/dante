import test from 'node:test';
import assert from 'node:assert/strict';
import { inkWalk, inkSetting } from './ink';
const letters = Array.from('A long line of impressions. Some letters remain clean. '.repeat(20), text => ({ text }));
test('an impression repeats exactly, and a fresh impression changes placement', () => {
  assert.deepEqual(inkWalk(letters, 55), inkWalk(letters, 55));
  assert.notDeepEqual(inkWalk(letters, 55), inkWalk(letters, 192));
});
test('random placement never amplifies spread; it leaves a mix of clean and inked letters', () => {
  const settings = inkWalk(letters, 55).map(walk => inkSetting(43, 94, walk));
  assert.ok(settings.every(x => x.amount === .43 && x.coverage >= 0 && x.coverage <= 1));
  assert.ok(settings.some(x => x.coverage === 0));
  assert.ok(settings.some(x => x.coverage > .5));
});
test('uniform coverage and explicit clean overrides are independent of the random walk', () => {
  for (const walk of inkWalk(letters, 55)) {
    assert.equal(inkSetting(43, 0, walk).coverage, 1);
    assert.deepEqual(inkSetting(90, 94, walk, 'clean'), { amount: 0, uneven: 0, coverage: 0 });
    assert.deepEqual(inkSetting(43, 94, walk, '22,52'), { amount: .22, uneven: .52, coverage: 1 });
  }
});
