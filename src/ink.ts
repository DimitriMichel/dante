/** Stable ink placement. The random walk changes coverage, never kernel strength. */
export type Walk = { pressure: number };
export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export function generator(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function inkWalk(items: { text: string }[], seed: number): Walk[] {
  const random = generator(seed);
  let pressure = (random() - .5) * .5;
  return items.map(item => {
    pressure = clamp(.73 * pressure + (random() - .5) * .85, -1, 1);
    if (/\s/u.test(item.text)) pressure *= .8;
    const level = clamp((pressure + (random() - .5) * .45 + .37) / .85);
    // Consume the former dropout draw so saved seeds keep the same pressure sequence.
    random();
    return { pressure: level * level * (3 - 2 * level) };
  });
}
export function inkSetting(spread: number, variation: number, walk: Walk, override?: string) {
  if (override === 'clean') return { amount: 0, uneven: 0, coverage: 0 };
  if (override && /^\d{1,3},\d{1,3}$/.test(override)) {
    const [a, b] = override.split(',').map(Number);
    return { amount: clamp(a / 100), uneven: clamp(b / 100), coverage: 1 };
  }
  const uneven = clamp(variation / 100);
  // Even the lightest automatic impression retains 30% of the bleed overlay.
  // Interpolate the whole range as unevenness rises; never switch letters off.
  const variedCoverage = .3 + .7 * clamp(walk.pressure);
  const coverage = 1 - uneven * (1 - variedCoverage);
  return { amount: clamp(spread / 100), uneven, coverage };
}
