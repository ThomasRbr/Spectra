// Keccak-256 (la variante d'Ethereum, antérieure au padding SHA-3) : sert à
// calculer les vrais sélecteurs de fonctions (4 premiers octets du hash de la
// signature) et les sujets d'événements (topic0), comme le font les explorateurs.

const RC: [number, number][] = [
  [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
  [0x0000808b, 0x00000000], [0x80000001, 0x00000000], [0x80008081, 0x80000000], [0x00008009, 0x80000000],
  [0x0000008a, 0x00000000], [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
  [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000], [0x00008003, 0x80000000],
  [0x00008002, 0x80000000], [0x00000080, 0x80000000], [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
  [0x80008081, 0x80000000], [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000],
]

const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14]

/** Permutation Keccak-f[1600] sur 25 lignes de 64 bits (paires lo/hi de 32 bits). */
function permute(lo: Uint32Array, hi: Uint32Array) {
  const cLo = new Uint32Array(5)
  const cHi = new Uint32Array(5)
  const bLo = new Uint32Array(25)
  const bHi = new Uint32Array(25)
  for (let round = 0; round < 24; round++) {
    // θ
    for (let x = 0; x < 5; x++) {
      cLo[x] = lo[x] ^ lo[x + 5] ^ lo[x + 10] ^ lo[x + 15] ^ lo[x + 20]
      cHi[x] = hi[x] ^ hi[x + 5] ^ hi[x + 10] ^ hi[x + 15] ^ hi[x + 20]
    }
    for (let x = 0; x < 5; x++) {
      const nLo = cLo[(x + 1) % 5]
      const nHi = cHi[(x + 1) % 5]
      const dLo = cLo[(x + 4) % 5] ^ ((nLo << 1) | (nHi >>> 31))
      const dHi = cHi[(x + 4) % 5] ^ ((nHi << 1) | (nLo >>> 31))
      for (let y = 0; y < 25; y += 5) {
        lo[x + y] ^= dLo
        hi[x + y] ^= dHi
      }
    }
    // ρ et π
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const i = x + 5 * y
        const r = ROT[i]
        let l = lo[i]
        let h = hi[i]
        if (r >= 32) {
          const t = l
          l = h
          h = t
        }
        const s = r % 32
        const rl = s ? (l << s) | (h >>> (32 - s)) : l
        const rh = s ? (h << s) | (l >>> (32 - s)) : h
        const j = y + 5 * ((2 * x + 3 * y) % 5)
        bLo[j] = rl
        bHi[j] = rh
      }
    }
    // χ
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) {
        lo[x + y] = bLo[x + y] ^ (~bLo[((x + 1) % 5) + y] & bLo[((x + 2) % 5) + y])
        hi[x + y] = bHi[x + y] ^ (~bHi[((x + 1) % 5) + y] & bHi[((x + 2) % 5) + y])
      }
    }
    // ι
    lo[0] ^= RC[round][0]
    hi[0] ^= RC[round][1]
  }
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

/** Keccak-256 d'un texte (UTF-8) ou d'octets, en hexadécimal sans préfixe. */
export function keccak256(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? utf8(input) : input
  const rate = 136
  const padded = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate)
  padded.set(bytes)
  padded[bytes.length] ^= 0x01
  padded[padded.length - 1] ^= 0x80
  const lo = new Uint32Array(25)
  const hi = new Uint32Array(25)
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      const p = off + i * 8
      lo[i] ^= padded[p] | (padded[p + 1] << 8) | (padded[p + 2] << 16) | (padded[p + 3] << 24)
      hi[i] ^= padded[p + 4] | (padded[p + 5] << 8) | (padded[p + 6] << 16) | (padded[p + 7] << 24)
    }
    permute(lo, hi)
  }
  let out = ''
  for (let i = 0; i < 4; i++) {
    for (const w of [lo[i], hi[i]]) {
      for (let b = 0; b < 4; b++) out += ((w >>> (8 * b)) & 0xff).toString(16).padStart(2, '0')
    }
  }
  return out
}

/** Sélecteur de fonction : `0x` + 4 premiers octets du Keccak-256 de la signature canonique. */
export function selectorOf(signature: string): string {
  return '0x' + keccak256(signature).slice(0, 8)
}

/** Sujet d'un événement (topic0) : Keccak-256 de la signature canonique. */
export function topicOf(signature: string): string {
  return '0x' + keccak256(signature)
}
