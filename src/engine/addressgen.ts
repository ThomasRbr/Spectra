import type { Rng } from './rng'
import type { ChainId } from './chains'

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BECH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const HEX = '0123456789abcdef'
const XRP_ALPHA = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz'
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export type AddrKind =
  | 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2tr' // Bitcoin / Litecoin
  | 'p2wsh' // Bitcoin / Litecoin : script SegWit (multisig, canal Lightning)
  | 'ton_wallet' // TON : contrat de portefeuille
  | 'eoa' | 'contract' // EVM / Tron / Solana
  | 'account' // XRP
  | 'stealth' // Monero

export const KIND_LABEL: Record<AddrKind, string> = {
  p2pkh: 'Legacy (P2PKH)',
  p2sh: 'Script (P2SH)',
  p2wpkh: 'SegWit natif (P2WPKH)',
  p2tr: 'Taproot (P2TR)',
  p2wsh: 'Script SegWit (P2WSH)',
  ton_wallet: 'Portefeuille TON (contrat wallet)',
  eoa: 'Compte externe (EOA)',
  contract: 'Smart contract',
  account: 'Compte XRPL',
  stealth: 'Adresse furtive',
}

function chars(rng: Rng, alphabet: string, n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += alphabet[Math.floor(rng.next() * alphabet.length)]
  return s
}

/** Casse mixte à la manière d'un checksum EIP-55 (purement visuel). */
function eip55ish(rng: Rng, hex: string): string {
  return hex
    .split('')
    .map((c) => (/[a-f]/.test(c) && rng.chance(0.5) ? c.toUpperCase() : c))
    .join('')
}

export function defaultKind(rng: Rng, chain: ChainId): AddrKind {
  switch (chain) {
    case 'btc':
      return rng.weighted([['p2wpkh', 0.58], ['p2pkh', 0.14], ['p2sh', 0.16], ['p2tr', 0.12]] as const)
    case 'ltc':
      return rng.weighted([['p2wpkh', 0.5], ['p2pkh', 0.3], ['p2sh', 0.2]] as const)
    case 'xrp':
      return 'account'
    case 'xmr':
      return 'stealth'
    case 'ton':
      return 'ton_wallet'
    default:
      return 'eoa'
  }
}

export function genAddress(rng: Rng, chain: ChainId, kind: AddrKind): string {
  switch (chain) {
    case 'btc':
      if (kind === 'p2pkh') return '1' + chars(rng, B58, rng.int(32, 33))
      if (kind === 'p2sh') return '3' + chars(rng, B58, 33)
      if (kind === 'p2tr') return 'bc1p' + chars(rng, BECH, 58)
      if (kind === 'p2wsh') return 'bc1q' + chars(rng, BECH, 58)
      return 'bc1q' + chars(rng, BECH, 38)
    case 'ltc':
      if (kind === 'p2pkh') return 'L' + chars(rng, B58, 33)
      if (kind === 'p2sh') return 'M' + chars(rng, B58, 33)
      if (kind === 'p2wsh') return 'ltc1q' + chars(rng, BECH, 58)
      return 'ltc1q' + chars(rng, BECH, 38)
    case 'eth':
    case 'bsc':
    case 'arb':
    case 'base':
      return '0x' + eip55ish(rng, chars(rng, HEX, 40))
    case 'ton':
      // Forme « user-friendly » : 36 octets en base64url = 48 caractères.
      // 1er octet : 0x11 bounceable (« EQ… », contrats et services) ou 0x51
      // non-bounceable (« UQ… », portefeuilles) ; 2e octet : workchain 0.
      return (kind === 'contract' ? 'EQ' : 'UQ') + chars(rng, 'ABCDEFGHIJKLMNOP', 1) + chars(rng, B64URL, 45)
    case 'tron':
      return 'T' + chars(rng, B58, 33)
    case 'xrp':
      return 'r' + chars(rng, XRP_ALPHA, rng.int(25, 33))
    case 'sol':
      return chars(rng, B58, rng.int(43, 44))
    case 'xmr':
      return '4' + chars(rng, B58, 94)
  }
}

/** Adresse « sosie » : mêmes premiers et derniers caractères (address poisoning). */
export function lookalike(rng: Rng, chain: ChainId, addr: string, pre = 5, suf = 4): string {
  const kind: AddrKind = chain === 'btc' || chain === 'ltc' ? 'p2wpkh' : chain === 'xrp' ? 'account' : chain === 'ton' ? 'ton_wallet' : 'eoa'
  const base = genAddress(rng, chain, kind)
  const prefixLen = chain === 'eth' || chain === 'bsc' || chain === 'arb' || chain === 'base' ? pre + 2 : chain === 'ton' ? pre + 2 : pre
  let mid = base.slice(prefixLen, base.length - suf)
  while (prefixLen + mid.length + suf < addr.length) mid += mid[mid.length % Math.max(1, mid.length)] ?? 'x'
  mid = mid.slice(0, addr.length - prefixLen - suf)
  return addr.slice(0, prefixLen) + mid + addr.slice(addr.length - suf)
}

export function genTxHash(rng: Rng, chain: ChainId): string {
  switch (chain) {
    case 'eth':
    case 'bsc':
    case 'arb':
    case 'base':
      return '0x' + chars(rng, HEX, 64)
    case 'xrp':
      return chars(rng, HEX, 64).toUpperCase()
    case 'sol':
      return chars(rng, B58, rng.int(86, 88))
    default:
      return chars(rng, HEX, 64)
  }
}

/** Hash TON au format base64 (44 caractères), tel qu'affiché par certains explorateurs et portefeuilles. */
export function tonHashBase64(hexHash: string): string {
  let bits = ''
  for (const c of hexHash.slice(0, 64)) bits += parseInt(c, 16).toString(2).padStart(4, '0')
  let out = ''
  for (let i = 0; i < bits.length; i += 6) out += B64[parseInt(bits.slice(i, i + 6).padEnd(6, '0'), 2)]
  return out + '='
}

export function shortAddr(addr: string, n = 6): string {
  if (addr.length <= n * 2 + 3) return addr
  return `${addr.slice(0, n)}…${addr.slice(-(n - 1))}`
}
