// RNG deterministik (mulberry32) supaya desa awal selalu sama.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = Math.random;
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
export const randRange = (a, b, r = Math.random) => a + (b - a) * r();
export const randInt = (a, b, r = Math.random) => Math.floor(a + (b - a + 1) * r());
