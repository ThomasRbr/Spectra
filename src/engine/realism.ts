// Habillage réaliste d'une affaire : une adresse de suspect a une vie avant,
// pendant et après les faits (historique, dépenses personnelles, autres
// victimes, poussière), et le flux réel se cache parmi des fausses pistes
// (branches sans issue, transferts jumeaux, flux sosies). Ces briques
// s'appellent DANS `generate()`, avant le calcul des réponses : les objectifs
// restent ainsi cohérents avec le monde produit.
import { ASSETS, CHAINS, fromUsd, roundAsset, usd, type AssetId, type ChainId } from './chains'
import type { Entity } from './entities'
import type { ExchangeKit } from './patterns'
import { lookalike } from './addressgen'
import type { Tx, World } from './world'

const H = 3600
// Frais fixes du retour d'une branche UTXO (sans tirage aléatoire : ne décale pas le reste du monde)
const RETURN_FEE = 0.00002
const D = 86400
const isUtxo = (w: World, id: string) => CHAINS[w.get(id).chain].model === 'utxo'
const nativeOf = (w: World, id: string): AssetId => CHAINS[w.get(id).chain].native

/** Ce qu'une brique d'habillage a produit : utile pour les pièces, les objectifs et le débrief. */
export interface Dressing {
  txs: Tx[]
  /** Adresses tierces créées (contreparties, branches, sosies). */
  addresses: string[]
}

function pickTime(w: World, start: number, end: number): number {
  return Math.round(w.rng.float(start, end))
}

/**
 * Historique antérieur aux faits : entrées (retraits d'exchange, virements de
 * proches) et sorties (paiements) réparties entre `start` et `end`. Les sorties
 * ne dépensent que ce que l'historique a fait entrer : le solde au moment des
 * faits reste à peu près celui qu'il était.
 */
export function priorHistory(w: World, addr: string, o: { start: number; end: number; nIn: number; nOut?: number; maxUsd?: number; sources?: string[]; sinks?: string[]; asset?: AssetId }): Dressing {
  const asset = o.asset ?? nativeOf(w, addr)
  const chain = w.get(addr).chain
  const txs: Tx[] = []
  const addresses: string[] = []
  let received = 0
  const ins = Array.from({ length: o.nIn }, () => pickTime(w, o.start, o.end)).sort((a, b) => a - b)
  for (const t of ins) {
    const v = roundAsset(asset, fromUsd(asset, w.rng.float(20, o.maxUsd ?? 1500)))
    const src = o.sources?.length ? w.rng.pick(o.sources) : w.addr(chain)
    if (!o.sources?.length) addresses.push(src)
    if (isUtxo(w, addr)) {
      if (!o.sources?.length) w.fund(src, v * w.rng.float(1.05, 1.8), t - w.rng.int(H, 20 * D))
      txs.push(w.utxoTx({ time: t, from: [src], to: [{ address: addr, value: v }] }))
    } else {
      txs.push(w.transfer({ time: t, from: src, to: addr, value: v, asset }))
    }
    received += v
  }
  const nOut = o.nOut ?? Math.max(0, o.nIn - 1)
  let budget = received * 0.92
  const outs = Array.from({ length: nOut }, () => pickTime(w, ins[0] ?? o.start, o.end)).sort((a, b) => a - b)
  for (let i = 0; i < nOut && budget > 0; i++) {
    const t = outs[i]
    const v = roundAsset(asset, Math.min(budget, budget * w.rng.float(0.15, 0.5)))
    if (v <= 0) break
    const dst = o.sinks?.length ? w.rng.pick(o.sinks) : w.addr(chain)
    if (!o.sinks?.length) addresses.push(dst)
    if (isUtxo(w, addr)) {
      if (w.unspentValue(addr, t) < v + w.estimateFee(chain, 1, 2)) continue
      txs.push(w.utxoTx({ time: t, from: [addr], to: [{ address: dst, value: v }], change: addr, autoFund: false }))
    } else {
      if (w.balanceOf(addr, asset) < v) continue
      txs.push(w.transfer({ time: t, from: addr, to: dst, value: v, asset, autoFund: false }))
    }
    budget -= v
  }
  return { txs, addresses }
}

/**
 * Dépenses personnelles : paiements à des services connus (commerçants, jeux,
 * VPN, cartes cadeaux…) et à des particuliers. Trahit les habitudes du suspect
 * et donne des pistes de réquisition secondaires. Le commerçant est tiré au
 * hasard (30 % des paiements vont à un particulier) : un texte qui cite un
 * commerçant doit le lire dans `addresses`, pas le supposer.
 */
export function personalSpending(w: World, addr: string, o: { start: number; end: number; n: number; merchants?: (string | Entity)[]; maxUsd?: number; asset?: AssetId }): Dressing {
  const asset = o.asset ?? nativeOf(w, addr)
  const chain = w.get(addr).chain
  const txs: Tx[] = []
  const addresses: string[] = []
  const shops = (o.merchants ?? ['cardhub', 'mullvad', 'orbit']).map((m) => (typeof m === 'string' ? w.entity(m) : m))
  const times = Array.from({ length: o.n }, () => pickTime(w, o.start, o.end)).sort((a, b) => a - b)
  for (let i = 0; i < o.n; i++) {
    const t = times[i]
    const shop = w.rng.chance(0.7) ? w.rng.pick(shops) : undefined
    const dst = w.addr(chain, { entity: shop, label: shop ? `${shop.name} — Paiement` : undefined })
    addresses.push(dst)
    const v = roundAsset(asset, fromUsd(asset, w.rng.float(15, o.maxUsd ?? 600)))
    if (isUtxo(w, addr)) {
      if (w.unspentValue(addr, t) < v * 1.05) w.fund(addr, v * w.rng.float(1.1, 2), t - w.rng.int(H, 10 * D))
      txs.push(w.utxoTx({ time: t, from: [addr], to: [{ address: dst, value: v }], change: addr }))
    } else txs.push(w.transfer({ time: t, from: addr, to: dst, value: v, asset }))
  }
  return { txs, addresses }
}

/**
 * Poussière et sollicitations parasites : micro-montants (UTXO de 546 sats,
 * jetons de valeur infime envoyés par des adresses sosies) qui encombrent
 * l'historique sans rien signifier. `min`/`max` bornent les dates (par
 * exemple pour qu'aucune poussière n'arrive après l'instant d'une question de solde).
 */
export function dusting(w: World, addr: string, o: { time: number; n: number; spreadH?: number; token?: AssetId; min?: number; max?: number; mimic?: string }): Dressing {
  const a = w.get(addr)
  const txs: Tx[] = []
  const addresses: string[] = []
  for (let i = 0; i < o.n; i++) {
    const raw = o.time + w.rng.int(-(o.spreadH ?? 72) * H, (o.spreadH ?? 72) * H)
    const t = Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, raw))
    if (isUtxo(w, addr)) {
      const src = w.addr(a.chain)
      w.fund(src, 0.0002, t - w.rng.int(H, 5 * D))
      txs.push(w.utxoTx({ time: t, from: [src], to: [{ address: addr, value: 0.00000546 }], tags: ['dust'] }))
      addresses.push(src)
    } else {
      // Sosie (mêmes premiers et derniers caractères) de l'adresse visée ou, avec `mimic`, d'une
      // contrepartie habituelle : l'attaquant espère être recopié à sa place. Envoi d'un montant infime.
      const fake = w.addr(a.chain, { addr: lookalike(w.rng, a.chain, o.mimic ? w.get(o.mimic).addr : a.addr) })
      addresses.push(fake)
      const asset = o.token ?? (CHAINS[a.chain].tokens.includes('USDT') ? 'USDT' : CHAINS[a.chain].native)
      const v = Math.max(roundAsset(asset, fromUsd(asset, w.rng.float(0.0005, 0.02))), Math.pow(10, -Math.min(6, ASSETS[asset].decimals)))
      txs.push(w.multi({ time: t, signer: fake, legs: [{ from: fake, to: addr, value: v, asset }], method: asset === CHAINS[a.chain].native ? 'transfer' : 'transfer (token)', tags: ['dust', 'poisoning'] }))
    }
  }
  return { txs, addresses }
}

/**
 * Transferts jumeaux : à quelques minutes du transfert réel, d'autres
 * transferts de montant quasi identique partent du même portefeuille vers
 * d'autres adresses. Une seule destination est la bonne ; les autres sont
 * payées sur les fonds du suspect ; un apport extérieur n'est ajouté juste
 * avant que si le portefeuille ne peut pas les couvrir.
 */
export function twinTransfers(w: World, from: string, o: { value: number; time: number; n: number; asset?: AssetId; spreadMin?: number; jitter?: number; to?: string[] }): Dressing {
  const asset = o.asset ?? nativeOf(w, from)
  const chain = w.get(from).chain
  const txs: Tx[] = []
  const addresses: string[] = []
  for (let i = 0; i < o.n; i++) {
    const v = roundAsset(asset, o.value * (1 + w.rng.float(-(o.jitter ?? 0.004), o.jitter ?? 0.004)))
    const t = o.time + w.rng.int(-(o.spreadMin ?? 25) * 60, (o.spreadMin ?? 25) * 60)
    const dst = o.to?.[i] ?? w.addr(chain)
    addresses.push(dst)
    if (isUtxo(w, from)) {
      if (w.unspentValue(from, t) < v * 1.02) w.fund(from, v * 1.02, t - w.rng.int(10 * 60, 3 * H))
      txs.push(w.utxoTx({ time: t, from: [from], to: [{ address: dst, value: v }], change: from }))
    } else {
      if (w.balanceOf(from, asset) < v) w.fundAccount(from, v, asset, t - w.rng.int(10 * 60, 3 * H))
      txs.push(w.transfer({ time: t, from, to: dst, value: v, asset }))
    }
  }
  return { txs, addresses }
}

/**
 * Flux sosies : d'autres expéditeurs, sans lien avec l'affaire, envoient des
 * montants très proches au même moment (piège pour le corrélateur et pour qui
 * suit les montants au lieu des adresses).
 */
export function lookalikeFlows(w: World, o: { chain: ChainId; value: number; time: number; n: number; asset?: AssetId; spreadMin?: number; jitter?: number; to?: string }): Dressing {
  const asset = o.asset ?? CHAINS[o.chain].native
  const txs: Tx[] = []
  const addresses: string[] = []
  for (let i = 0; i < o.n; i++) {
    const v = roundAsset(asset, o.value * (1 + w.rng.float(-(o.jitter ?? 0.02), o.jitter ?? 0.02)))
    const t = o.time + w.rng.int(-(o.spreadMin ?? 40) * 60, (o.spreadMin ?? 40) * 60)
    const src = w.addr(o.chain)
    const dst = o.to ?? w.addr(o.chain)
    addresses.push(src, dst)
    if (CHAINS[o.chain].model === 'utxo') {
      w.fund(src, v * w.rng.float(1.05, 1.5), t - w.rng.int(H, 4 * D))
      txs.push(w.utxoTx({ time: t, from: [src], to: [{ address: dst, value: v }] }))
    } else txs.push(w.transfer({ time: t, from: src, to: dst, value: v, asset }))
  }
  return { txs, addresses }
}

export interface Branch {
  address: string
  tx: Tx
  value: number
  /** Ce que devient la branche (pour le débrief). */
  fate: 'dort' | 'dépensée' | 'retour' | 'éclatée'
  follow: Tx[]
}

/**
 * Éclatement en branches : depuis `from`, une partie des fonds part vers
 * plusieurs adresses neuves du suspect. Chaque branche connaît un sort
 * différent (dort, petites dépenses, retour vers une autre adresse du suspect,
 * nouvel éclatement) ; aucune n'est la piste principale, que la mission
 * construit elle-même avec le reste des fonds. `until` borne la date des
 * suites (aucune tx après l'instant présent de la mission) ; `merchants` choisit
 * les commerçants des branches dépensées (même rôle que dans `personalSpending`).
 */
export function decoyBranches(w: World, from: string, o: { time: number; share: number; branches: number; entity?: string | Entity; returnTo?: string; asset?: AssetId; until?: number; merchants?: (string | Entity)[] }): Branch[] {
  const asset = o.asset ?? nativeOf(w, from)
  const src = w.get(from)
  const chain = src.chain
  const total = (isUtxo(w, from) ? w.unspentValue(from, o.time) : w.balanceOf(from, asset)) * o.share
  const parts = w.rng.split(total, o.branches, 0.8)
  const fates: Branch['fate'][] = ['dort', 'dépensée', 'retour', 'éclatée']
  const out: Branch[] = []
  let t = o.time
  parts.forEach((p, i) => {
    const v = roundAsset(asset, p)
    if (v <= 0) return
    // Heures strictement croissantes : chaque branche voit le rendu de la précédente
    if (i > 0) t += w.rng.int(5 * 60, 50 * 60)
    const addr = w.addr(chain, { entity: o.entity ?? src.entityId, kind: src.kind === 'contract' ? undefined : src.kind, wallet: src.wallet })
    const tx = isUtxo(w, from)
      ? w.utxoTx({ time: t, from: [from], to: [{ address: addr, value: v }], change: from })
      : w.transfer({ time: t, from, to: addr, value: v, asset })
    const fate = fates[(i + w.rng.int(0, 3)) % fates.length]
    const follow: Tx[] = []
    const cap = o.until ?? Infinity
    const later = Math.min(t + w.rng.int(6 * H, 5 * D), Math.max(t + H, cap - 2 * H))
    if (fate === 'dépensée') follow.push(...personalSpending(w, addr, { start: later, end: Math.max(later + H, Math.min(later + 6 * D, cap)), merchants: o.merchants, n: w.rng.int(2, 4), maxUsd: usd(asset, v) * 0.3, asset }).txs)
    if (fate === 'retour' && o.returnTo) {
      follow.push(isUtxo(w, addr)
        ? w.utxoTx({ time: later, from: [addr], to: [{ address: o.returnTo, value: Math.floor((w.unspentValue(addr, later) - RETURN_FEE) * 1e8) / 1e8 }], fee: RETURN_FEE, change: null, spendAll: true })
        : w.transfer({ time: later, from: addr, to: o.returnTo, value: roundAsset(asset, w.balanceOf(addr, asset)), asset }))
    }
    if (fate === 'éclatée') {
      const n = w.rng.int(2, 4)
      for (let k = 0; k < n; k++) {
        const sub = w.addr(chain)
        const sv = roundAsset(asset, v / (n + 1))
        follow.push(isUtxo(w, addr)
          ? w.utxoTx({ time: later + k * 900, from: [addr], to: [{ address: sub, value: sv }], change: addr })
          : w.transfer({ time: later + k * 900, from: addr, to: sub, value: sv, asset }))
      }
    }
    out.push({ address: addr, tx, value: v, fate: fate === 'retour' && !o.returnTo ? 'dort' : fate, follow })
  })
  return out
}

/**
 * Autres paiements entrants de victimes non identifiées, étalés dans le temps
 * (une adresse d'escroc reçoit rarement l'argent d'une seule personne).
 */
export function otherVictimPayments(w: World, addr: string, o: { start: number; end: number; n: number; minUsd: number; maxUsd: number; asset?: AssetId; viaExchange?: ExchangeKit }): Dressing {
  const asset = o.asset ?? nativeOf(w, addr)
  const chain = w.get(addr).chain
  const txs: Tx[] = []
  const addresses: string[] = []
  for (let i = 0; i < o.n; i++) {
    const t = pickTime(w, o.start, o.end)
    const v = roundAsset(asset, fromUsd(asset, Math.round(w.rng.float(o.minUsd, o.maxUsd) / 10) * 10))
    if (o.viaExchange) {
      txs.push(o.viaExchange.withdraw(addr, v, t, asset))
      continue
    }
    const victim = w.addr(chain)
    addresses.push(victim)
    if (isUtxo(w, addr)) {
      w.fund(victim, v * w.rng.float(1.05, 1.6), t - w.rng.int(H, 15 * D))
      txs.push(w.utxoTx({ time: t, from: [victim], to: [{ address: addr, value: v }] }))
    } else txs.push(w.fundAccount(victim, v, asset, t - w.rng.int(H, 10 * D)), w.transfer({ time: t, from: victim, to: addr, value: v, asset }))
  }
  return { txs, addresses }
}

export const REALISM_H = H
export const REALISM_D = D
