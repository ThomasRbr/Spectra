// Portefeuilles HD (hiérarchiques déterministes, BIP 32) : une clé publique
// étendue (xpub / ypub / zpub) permet de recalculer TOUTES les adresses d'un
// compte (réception et rendu), sans donner accès aux clés privées.
//
// Tout est simulé : la « dérivation » est un tirage pseudo-aléatoire
// déterministe à partir d'une graine interne, sans aucune cryptographie réelle.
// Aucune vraie phrase de récupération (BIP 39) n'est jamais générée.
import { Rng, hashSeed } from './rng'
import { isEvm, type ChainId } from './chains'
import { genAddress, type AddrKind } from './addressgen'
import type { Entity } from './entities'
import type { HdWalletData, World } from './world'

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export type HdAddrKind = 'p2wpkh' | 'p2sh' | 'p2pkh' | 'p2tr'

/** Schémas de dérivation standard : préfixe de la clé étendue et forme des adresses. */
export const HD_SCHEMES: Record<HdAddrKind, { purpose: 44 | 49 | 84 | 86; prefix: 'xpub' | 'ypub' | 'zpub'; bip: string; label: string; addrHint: Record<'btc' | 'ltc', string> }> = {
  p2pkh: { purpose: 44, prefix: 'xpub', bip: 'BIP 44', label: 'Legacy (P2PKH)', addrHint: { btc: '1…', ltc: 'L…' } },
  p2sh: { purpose: 49, prefix: 'ypub', bip: 'BIP 49', label: 'SegWit encapsulé (P2SH-P2WPKH)', addrHint: { btc: '3…', ltc: 'M…' } },
  p2wpkh: { purpose: 84, prefix: 'zpub', bip: 'BIP 84', label: 'SegWit natif (P2WPKH)', addrHint: { btc: 'bc1q…', ltc: 'ltc1q…' } },
  p2tr: { purpose: 86, prefix: 'xpub', bip: 'BIP 86', label: 'Taproot (P2TR)', addrHint: { btc: 'bc1p…', ltc: '—' } },
}

/** Type de coin SLIP-44 utilisé dans les chemins. */
const COIN: Partial<Record<ChainId, number>> = { btc: 0, ltc: 2 }

export interface HdWallet {
  id: string
  type: 'bip32' | 'evm-seed'
  chain: ChainId
  kind: AddrKind
  /** Clé publique étendue (xpub/ypub/zpub) ; phrase de démonstration pour une seed EVM. */
  xpub: string
  purpose: 44 | 49 | 84 | 86
  coin: number
  account: number
  entityId?: string
  label?: string
  /** Libellé du schéma, ex. « BIP 84 — SegWit natif (P2WPKH) ». */
  scheme: string
  /** Gabarit de chemin, ex. « m/84'/0'/0'/{0|1}/i ». */
  pathTemplate: string
  /** Adresse de réception n° i (branche externe 0), créée au besoin. */
  receive(i: number): string
  /** Adresse de rendu n° i (branche interne 1), créée au besoin. Pas de rendu sur une seed EVM. */
  change(i: number): string
  /** Chemin de dérivation complet d'un index. */
  path(branch: 0 | 1, i: number): string
  /** Adresses déjà dérivées qui ont au moins une transaction visible (réception puis rendu, par index). */
  used(): string[]
  /** Toutes les adresses dérivées à ce stade. */
  derived(): { branch: 0 | 1; index: number; id: string; path: string }[]
}

function pathOf(d: HdWalletData, branch: 0 | 1, i: number): string {
  return `m/${d.purpose}'/${d.coin}'/${d.account}'/${branch}/${i}`
}

function deriveOne(w: World, d: HdWalletData, branch: 0 | 1, i: number): string {
  if (d.type === 'evm-seed' && branch === 1) throw new Error('Une seed EVM n\'a pas de branche de rendu')
  const k = `${branch}/${i}`
  const existing = d.derived.get(k)
  if (existing) return existing
  // Tirage indépendant du générateur du monde : la même position donne
  // toujours la même adresse, quel que soit l'ordre de dérivation.
  const r = new Rng(hashSeed(`${d.seed}|${branch}|${i}`))
  const id = w.addr(d.chain, { addr: genAddress(r, d.chain, d.kind), kind: d.kind, entity: d.entityId, wallet: d.wallet })
  w.get(id).hd = { wallet: d.id, path: pathOf(d, branch, i) }
  d.derived.set(k, id)
  return id
}

function kitOf(w: World, d: HdWalletData): HdWallet {
  const scheme = d.type === 'evm-seed'
    ? 'BIP 44 — comptes Ethereum (seed de démonstration)'
    : `${HD_SCHEMES[d.kind as HdAddrKind].bip} — ${HD_SCHEMES[d.kind as HdAddrKind].label}`
  const derivedList = () =>
    [...d.derived.entries()]
      .map(([k, id]) => {
        const [b, i] = k.split('/').map(Number)
        return { branch: b as 0 | 1, index: i, id, path: pathOf(d, b as 0 | 1, i) }
      })
      .sort((a, b) => a.branch - b.branch || a.index - b.index)
  return {
    id: d.id,
    type: d.type,
    chain: d.chain,
    kind: d.kind,
    xpub: d.xpub,
    purpose: d.purpose,
    coin: d.coin,
    account: d.account,
    entityId: d.entityId,
    label: d.label,
    scheme,
    pathTemplate: d.type === 'evm-seed' ? `m/44'/60'/${d.account}'/0/i` : `m/${d.purpose}'/${d.coin}'/${d.account}'/{0|1}/i`,
    receive: (i) => deriveOne(w, d, 0, i),
    change: (i) => deriveOne(w, d, 1, i),
    path: (branch, i) => pathOf(d, branch, i),
    used: () => derivedList().filter((x) => w.txsOf(x.id).length > 0).map((x) => x.id),
    derived: derivedList,
  }
}

/**
 * Crée un portefeuille HD Bitcoin / Litecoin (un compte BIP 44/49/84/86).
 * Un seul tirage dans le générateur du monde, au moment de la création.
 *
 * ```ts
 * const hd = createHdWallet(w, { chain: 'btc', kind: 'p2wpkh', entity: suspect })
 * w.fund(hd.receive(0), 0.4, t)              // m/84'/0'/0'/0/0
 * w.utxoTx({ time: t2, from: [hd.receive(0)], to: [...], change: hd.change(0) })
 * evidence: `zpub saisie : ${hd.xpub}`
 * ```
 */
export function createHdWallet(
  w: World,
  o: { chain: 'btc' | 'ltc'; kind: HdAddrKind; entity?: string | Entity; label?: string; account?: number; wallet?: string },
): HdWallet {
  if (o.chain === 'ltc' && o.kind === 'p2tr') throw new Error('Taproot (BIP 86) non pris en charge sur Litecoin')
  const seed = w.rng.int(1, 0x7ffffffe)
  const r = new Rng((seed ^ hashSeed(`${o.chain}|${o.kind}`)) >>> 0)
  const sc = HD_SCHEMES[o.kind]
  const xpub = sc.prefix + '6' + Array.from({ length: 106 }, () => B58[Math.floor(r.next() * B58.length)]).join('')
  const id = `hd${w.hd.size + 1}`
  const entityId = typeof o.entity === 'string' ? o.entity : o.entity?.id
  const d: HdWalletData = {
    id, type: 'bip32', chain: o.chain, kind: o.kind, xpub, purpose: sc.purpose, coin: COIN[o.chain]!, account: o.account ?? 0,
    seed, entityId, label: o.label, wallet: o.wallet ?? id, derived: new Map(),
  }
  w.hd.set(id, d)
  return kitOf(w, d)
}

export interface EvmSeed {
  wallet: HdWallet
  /** Phrase de DÉMONSTRATION (mots fictifs), à citer telle quelle dans une pièce. */
  phrase: string
  /** Code court de la seed (permet aussi de la retrouver avec `findHdWallet`). */
  code: string
  chain: ChainId
  /** Comptes m/44'/60'/0'/0/i déjà créés. */
  accounts: string[]
  account(i: number): string
  path(i: number): string
}

/**
 * Seed EVM de démonstration : une liste de comptes m/44'/60'/0'/0/i sur une
 * chaîne EVM. La « phrase » est faite de mots fictifs explicitement marqués
 * comme tels ; elle ne correspond à aucune clé réelle.
 *
 * ```ts
 * const seed = createEvmSeedAccounts(w, { count: 3, entity: suspect })
 * seed.accounts[0]            // eth:0x… (m/44'/60'/0'/0/0)
 * w.addrSameEoa(seed.accounts[0], 'arb')   // même compte sur Arbitrum
 * ```
 */
export function createEvmSeedAccounts(
  w: World,
  o: { chain?: ChainId; count: number; entity?: string | Entity; label?: string; words?: 12 | 24; wallet?: string },
): EvmSeed {
  const chain = o.chain ?? 'eth'
  if (!isEvm(chain)) throw new Error(`createEvmSeedAccounts : ${chain} n'est pas une chaîne EVM`)
  const seed = w.rng.int(1, 0x7ffffffe)
  const code = (seed % 0xffff).toString(16).toUpperCase().padStart(4, '0')
  const n = o.words ?? 12
  const phrase = `[seed de démonstration ${code}] ` + Array.from({ length: n }, (_, i) => `mot${String(i + 1).padStart(2, '0')}`).join(' ')
  const id = `hd${w.hd.size + 1}`
  const entityId = typeof o.entity === 'string' ? o.entity : o.entity?.id
  const d: HdWalletData = {
    id, type: 'evm-seed', chain, kind: 'eoa', xpub: phrase, purpose: 44, coin: 60, account: 0,
    seed, entityId, label: o.label, wallet: o.wallet ?? id, derived: new Map(),
  }
  w.hd.set(id, d)
  const wallet = kitOf(w, d)
  const accounts = Array.from({ length: Math.max(0, o.count) }, (_, i) => wallet.receive(i))
  return { wallet, phrase, code, chain, accounts, account: (i) => wallet.receive(i), path: (i) => wallet.path(0, i) }
}

/** Retrouve un portefeuille HD par sa clé étendue (ou, pour une seed EVM, sa phrase ou son code). */
export function findHdWallet(w: World, xpub: string): HdWallet | undefined {
  const q = xpub.trim()
  if (!q) return undefined
  for (const d of w.hd.values()) {
    if (d.xpub === q) return kitOf(w, d)
    if (d.type === 'evm-seed' && (q === d.xpub.slice(1, d.xpub.indexOf(']')) || q.toUpperCase() === (d.seed % 0xffff).toString(16).toUpperCase().padStart(4, '0'))) return kitOf(w, d)
  }
  return undefined
}

/** Portefeuille HD dont dérive une adresse (vérité terrain). */
export function hdWalletOf(w: World, addrId: string): HdWallet | undefined {
  const h = w.addresses.get(addrId)?.hd
  const d = h ? w.hd.get(h.wallet) : undefined
  return d ? kitOf(w, d) : undefined
}

export function hdWalletById(w: World, id: string): HdWallet | undefined {
  const d = w.hd.get(id)
  return d ? kitOf(w, d) : undefined
}

/**
 * Dérive (et crée au besoin, de façon déterministe) les `receive` premières
 * adresses de réception et les `change` premières adresses de rendu.
 * Ne crée aucune transaction.
 */
export function deriveAddresses(w: World, xpub: string, n: { receive?: number; change?: number }): { wallet: HdWallet; receive: string[]; change: string[] } | undefined {
  const wallet = findHdWallet(w, xpub)
  if (!wallet) return undefined
  const receive = Array.from({ length: Math.max(0, n.receive ?? 0) }, (_, i) => wallet.receive(i))
  const change = wallet.type === 'evm-seed' ? [] : Array.from({ length: Math.max(0, n.change ?? 0) }, (_, i) => wallet.change(i))
  return { wallet, receive, change }
}

export interface HdScanRow {
  branch: 0 | 1
  index: number
  id: string
  path: string
  used: boolean
}

/**
 * Balayage comme un logiciel de portefeuille : sur chaque branche, on dérive
 * jusqu'à trouver `gap` adresses consécutives sans transaction (gap limit,
 * 20 par défaut). Une adresse utilisée au-delà de cet écart reste invisible.
 */
export function scanHdWallet(w: World, xpub: string, o: { gap?: number; max?: number } = {}): { wallet: HdWallet; receive: HdScanRow[]; change: HdScanRow[] } | undefined {
  const wallet = findHdWallet(w, xpub)
  if (!wallet) return undefined
  const gap = Math.max(1, o.gap ?? 20)
  const max = o.max ?? 1000
  const scan = (branch: 0 | 1): HdScanRow[] => {
    if (branch === 1 && wallet.type === 'evm-seed') return []
    const rows: HdScanRow[] = []
    let idle = 0
    for (let i = 0; i < max && idle < gap; i++) {
      const id = branch === 0 ? wallet.receive(i) : wallet.change(i)
      const used = w.txsOf(id).length > 0
      rows.push({ branch, index: i, id, path: wallet.path(branch, i), used })
      idle = used ? 0 : idle + 1
    }
    return rows
  }
  return { wallet, receive: scan(0), change: scan(1) }
}

/** Reconnaît une clé publique étendue (forme seulement). */
export function looksLikeXpub(s: string): boolean {
  return /^[xyzXYZ]pub[1-9A-HJ-NP-Za-km-z]{100,112}$/.test(s)
}
