// Générateur pseudo-aléatoire déterministe (mulberry32) : une même graine
// produit toujours la même affaire, ce qui permet de rejouer un scénario.
export class Rng {
  private s: number

  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9
  }

  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  float(min = 0, max = 1): number {
    return min + this.next() * (max - min)
  }

  /** Entier dans [min, max] inclus. */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  pickN<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle([...arr]).slice(0, Math.min(n, arr.length))
  }

  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((s, [, w]) => s + w, 0)
    let r = this.next() * total
    for (const [v, w] of items) {
      r -= w
      if (r <= 0) return v
    }
    return items[items.length - 1][0]
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }

  normal(mean = 0, sd = 1): number {
    const u = 1 - this.next()
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  /** Découpe `total` en `n` parts aléatoires (somme exacte). */
  split(total: number, n: number, jitter = 0.6): number[] {
    const w = Array.from({ length: n }, () => 1 - jitter / 2 + this.next() * jitter)
    const s = w.reduce((a, b) => a + b, 0)
    return w.map((x) => (total * x) / s)
  }

  /** Sous-générateur indépendant et déterministe. */
  fork(label: string): Rng {
    return new Rng((hashSeed(label) ^ Math.floor(this.next() * 0xffffffff)) >>> 0)
  }
}

/** Hash FNV-1a 32 bits d'une chaîne. */
export function hashSeed(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}
