import test from 'node:test';
import assert from 'node:assert/strict';
import { inkWalk, inkSetting } from './ink';
const letters = Array.from('A long line of impressions. Light ink blends into heavier ink. '.repeat(20), text => ({ text }));
test('an impression repeats exactly, and a fresh impression changes placement', () => {
  assert.deepEqual(inkWalk(letters, 55), inkWalk(letters, 55));
  assert.notDeepEqual(inkWalk(letters, 55), inkWalk(letters, 192));
});
test('automatic variation always keeps ink and never amplifies the selected spread', () => {
  for (const seed of [0, 17, 55, 192, 9999]) {
    const walk = inkWalk(letters, seed);
    for (const variation of [0, 25, 26, 52, 94, 100]) {
      const settings = walk.map(strike => inkSetting(43, variation, strike));
      assert.ok(settings.every(x => x.amount === .43 && x.coverage >= .3 && x.coverage <= 1));
      if (variation) {
        assert.ok(settings.some(x => x.coverage < 1 - .4 * variation / 100));
        assert.ok(settings.some(x => x.coverage > .9));
      }
    }
  }
});
test('coverage scales continuously across pressures and unevenness', () => {
  for (let pressure = 0; pressure <= 1; pressure += .05) {
    let previous = 1;
    for (let variation = 0; variation <= 100; variation++) {
      const current = inkSetting(43, variation, { pressure }).coverage;
      assert.ok(current <= previous + 1e-12);
      assert.ok(previous - current <= .007 + 1e-12);
      previous = current;
    }
  }
  const light = inkSetting(43, 100, { pressure: 0 }).coverage;
  const medium = inkSetting(43, 100, { pressure: .5 }).coverage;
  const heavy = inkSetting(43, 100, { pressure: 1 }).coverage;
  assert.ok(Math.abs(light - .3) < 1e-12);
  assert.ok(Math.abs(medium - .65) < 1e-12);
  assert.equal(heavy, 1);
});
test('uniform ink, zero spread, and explicit selection overrides retain their meanings', () => {
  for (const walk of inkWalk(letters, 55)) {
    assert.equal(inkSetting(43, 0, walk).coverage, 1);
    assert.equal(inkSetting(0, 100, walk).amount, 0);
    assert.deepEqual(inkSetting(90, 94, walk, 'clean'), { amount: 0, uneven: 0, coverage: 0 });
    assert.deepEqual(inkSetting(43, 94, walk, '22,52'), { amount: .22, uneven: .52, coverage: 1 });
  }
});
