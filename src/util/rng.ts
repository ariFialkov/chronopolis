/** Deterministic random helpers. Everything in the city is derived from these so the
 *  map is identical on every visit, every device, every era. */

export function hash2(x: number, y: number, seed = 0): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1274126177;
  h = (h ^ (h >>> 13)) * 1103515245;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export function hash3(x: number, y: number, z: number, seed = 0): number {
  return hash2(x * 31 + z * 7, y * 17 - z * 3, seed + z * 101);
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small fast PRNG (mulberry32). */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  weighted<T extends { weight: number }>(arr: readonly T[]): T {
    let total = 0;
    for (const a of arr) total += a.weight;
    let r = this.next() * total;
    for (const a of arr) {
      r -= a.weight;
      if (r <= 0) return a;
    }
    return arr[arr.length - 1];
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 2D value noise in [0,1]. */
export function noise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = smooth(x - xi);
  const ty = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** Fractal noise in [0,1]. */
export function fbm(x: number, y: number, octaves = 3, seed = 0): number {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  let sum = 0;
  for (let i = 0; i < octaves; i++) {
    v += noise2(x * f, y * f, seed + i * 7) * amp;
    sum += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / sum;
}
