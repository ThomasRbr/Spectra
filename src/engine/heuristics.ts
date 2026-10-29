// Heuristiques comportementales : adresses de dépôt sur les modèles à comptes,
// rapprochement automatique des échangeurs instantanés, suivi des peel chains.
// Comme le reste des outils, elles ne lisent que ce que l'enquêteur voit
// (montants, dates, attribution publique), jamais la vérité du scénario.
import { CHAINS, usd, type AssetId, type ChainId } from './chains'
import type { Entity, EntityCategory } from './entities'
import type { Tx, World } from './world'
import { attribution, changeAnalysis, detectCoinjoin, usdTo } from './analysis'

const H = 3600
const PASS = new Set<EntityCategory>(['individual', 'suspect', 'victim'])

function knownService(w: World, id: string): Entity | undefined {
  const e = attribution(w, id).entity
  return e && !PASS.has(e.category) ? e : undefined
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ── Adresses de dépôt (Ethereum, Tron, BSC, Solana) ─────────────────────────

export interface DepositVerdict {
  /** `deposit` : l'adresse reverse ce qu'elle reçoit vers un portefeuille collecteur ; `collector` : elle regroupe plusieurs adresses de ce type. */
  role: 'deposit' | 'collector' | 'none'
  /** Collecteur (pour `deposit`) ou l'adresse elle-même (pour `collector`). */
  target?: string
  targetEntity?: Entity
  score: number
  reasons: string[]
  /** Transactions de reversement vers le collecteur. */
  sweeps: string[]
  /** Autres adresses qui reversent au même collecteur. */
  siblings: string[]
  medianDelayH?: number
}

interface Outflow {
  totalUsd: number
  byDest: Map<string, { usd: number; txIds: string[] }>
}

function outflows(w: World, id: string): Outflow {
  const byDest = new Map<string, { usd: number; txIds: string[] }>()
  let totalUsd = 0
  for (const tx of w.txsOf(id)) {
    if (tx.model !== 'account') continue
    for (const t of tx.transfers) {
      if (t.from !== id || t.to === id) continue
      const v = usd(t.asset, t.value)
      totalUsd += v
      const d = byDest.get(t.to) ?? { usd: 0, txIds: [] }
      d.usd += v
      if (!d.txIds.includes(tx.id)) d.txIds.push(tx.id)
      byDest.set(t.to, d)
    }
  }
  return { totalUsd, byDest }
}

/** L'adresse reverse-t-elle (presque) tout vers `target`, sans rien garder ? */
function sweepsTo(w: World, id: string, target: string): boolean {
  const a = w.addresses.get(id)
  if (!a || a.contract) return false
  const o = outflows(w, id)
  const d = o.byDest.get(target)
  return !!d && o.totalUsd > 0 && d.usd / o.totalUsd >= 0.9
}

function sendersOf(w: World, id: string, limit = 80): string[] {
  const out = new Set<string>()
  for (const tx of w.txsOf(id)) {
    if (tx.model !== 'account') continue
    for (const t of tx.transfers) if (t.to === id && t.from !== id) out.add(t.from)
    if (out.size >= limit) break
  }
  return [...out]
}

export function depositAnalysis(w: World, id: string): DepositVerdict {
  const a = w.get(id)
  const none: DepositVerdict = { role: 'none', score: 0, reasons: [], sweeps: [], siblings: [] }
  // XRP : les plateformes partagent une adresse et distinguent les clients par destination tag.
  if (CHAINS[a.chain].model !== 'account' || a.contract || a.chain === 'xrp') return none

  // 1. L'adresse elle-même reverse-t-elle tout vers un collecteur ?
  const o = outflows(w, id)
  const top = [...o.byDest.entries()].sort((x, y) => y[1].usd - x[1].usd)[0]
  if (top && o.totalUsd > 0) {
    const [target, d] = top
    const share = d.usd / o.totalUsd
    const t = w.get(target)
    if (share >= 0.9 && !t.contract) {
      const reasons: string[] = []
      let score = 0.35
      reasons.push(`${Math.round(share * 100)} % des sorties partent vers la même adresse`)
      const sum = w.summary(id)
      const keptUsd = Object.entries(sum.balance).reduce((s, [as, v]) => s + usd(as as AssetId, v ?? 0), 0)
      if (sum.inUsd > 0 && keptUsd / sum.inUsd < 0.05) {
        score += 0.2
        reasons.push('Le solde est vidé à chaque fois : l\'adresse ne garde rien')
      }
      // Délai entre chaque réception et le reversement qui la suit
      const delays: number[] = []
      let lastIn: number | undefined
      for (const tx of w.txsOf(id)) {
        if (w.flowIn(tx, id).length && !w.flowOut(tx, id).length) lastIn ??= tx.time
        if (d.txIds.includes(tx.id) && lastIn !== undefined) {
          delays.push((tx.time - lastIn) / H)
          lastIn = undefined
        }
      }
      const md = median(delays)
      if (md !== undefined && md <= 12) {
        score += 0.15
        reasons.push(`Reversement rapide (délai médian ${md < 1 ? `${Math.max(1, Math.round(md * 60))} min` : `${md.toFixed(1).replace('.', ',')} h`})`)
      }
      const siblings = sendersOf(w, target).filter((s) => s !== id && sweepsTo(w, s, target)).slice(0, 40)
      if (siblings.length >= 2) {
        score += 0.25
        reasons.push(`${siblings.length} autres adresses ont le même comportement vers ce collecteur`)
      } else {
        reasons.push('Aucune autre adresse ne reverse vers ce collecteur : simple transfert possible')
        score -= 0.15
      }
      const svc = knownService(w, target)
      if (svc) {
        score += 0.1
        reasons.push(`Le collecteur est attribué à ${svc.name}`)
      }
      score = Math.max(0, Math.min(1, score))
      if (score >= 0.6 && siblings.length >= 2) return { role: 'deposit', target, targetEntity: svc, score, reasons, sweeps: d.txIds, siblings, medianDelayH: md }
    }
  }

  // 2. Sinon, l'adresse collecte-t-elle des reversements ?
  const feeders = sendersOf(w, id).filter((s) => sweepsTo(w, s, id))
  if (feeders.length >= 3) {
    const svc = knownService(w, id)
    return {
      role: 'collector',
      target: id,
      targetEntity: svc,
      score: Math.min(1, 0.5 + feeders.length * 0.05),
      reasons: [`${feeders.length} adresses lui reversent la totalité de ce qu'elles reçoivent`, svc ? `Attribuée à ${svc.name} : ces adresses sont vraisemblablement ses adresses de dépôt clients` : 'Collecteur non attribué : portefeuille de service inconnu ou réseau de mules'],
      sweeps: [],
      siblings: feeders.slice(0, 40),
    }
  }
  return none
}

// ── Échangeurs instantanés : rapprochement dépôt → paiement ─────────────────

export interface SwapCandidate {
  txId: string
  chain: ChainId
  from: string
  to: string
  asset: AssetId
  value: number
  usd: number
  /** Valeur payée / valeur déposée. */
  ratio: number
  dtMin: number
  prob: number
  reasons: string[]
}

export interface SwapMatch {
  entity?: Entity
  depositUsd: number
  time: number
  candidates: SwapCandidate[]
  /** Explication quand il n'y a rien à proposer. */
  note?: string
}

const SWAP_FEE: [number, number] = [0.97, 0.998]
const SWAP_WINDOW_H = 4

/**
 * Pour un dépôt chez un échangeur instantané, propose les paiements sortants
 * du même service dont le montant (frais déduits) et le délai concordent.
 */
export function matchInstantSwap(w: World, txId: string, address: string): SwapMatch {
  const tx = w.tx(txId)
  const depositUsd = usdTo(w, tx, address)
  let entity = attribution(w, address).entity
  if (!entity) {
    // Adresse de dépôt non attribuée : on regarde où elle reverse.
    const next = w.txsOf(address).find((t) => t.time >= tx.time && w.flowOut(t, address).length)
    const dest = next && (next.model === 'utxo' ? next.outputs[0]?.address : next.transfers.find((x) => x.from === address)?.to)
    entity = dest ? attribution(w, dest).entity : undefined
  }
  const base = { entity, depositUsd, time: tx.time }
  if (!entity) return { ...base, candidates: [], note: 'Service non identifié : utilisez le corrélateur sans filtre d\'entité.' }

  const own = (id: string) => attribution(w, id).entity?.id === entity!.id
  const scored: (Omit<SwapCandidate, 'prob'> & { s: number })[] = []
  const t1 = tx.time + SWAP_WINDOW_H * H
  for (const p of w.visibleTxs()) {
    if (p.time <= tx.time || p.time > t1 || p.id === tx.id) continue
    const legs: { from: string; to: string; asset: AssetId; value: number }[] = []
    if (p.model === 'utxo') {
      const ins = new Set(p.inputs.map((i) => i.address))
      const from = p.inputs[0]?.address
      if (!from || !own(from)) continue
      for (const o of p.outputs) if (!ins.has(o.address)) legs.push({ from, to: o.address, asset: CHAINS[p.chain].native, value: o.value })
    } else {
      for (const t of p.transfers) if (own(t.from)) legs.push(t)
    }
    for (const l of legs) {
      if (own(l.to)) continue // mouvement interne (balayage, rééquilibrage)
      const v = usd(l.asset, l.value)
      const ratio = v / Math.max(1, depositUsd)
      const gap = ratio < SWAP_FEE[0] ? SWAP_FEE[0] - ratio : ratio > SWAP_FEE[1] ? ratio - SWAP_FEE[1] : 0
      const amt = Math.max(0, 1 - gap / 0.05)
      if (amt <= 0) continue
      const dtMin = (p.time - tx.time) / 60
      const time = dtMin >= 3 && dtMin <= 60 ? 1 : dtMin < 3 ? 0.6 : Math.max(0, 1 - (dtMin - 60) / 180)
      const reasons = [
        `Montant : ${(ratio * 100).toFixed(1).replace('.', ',')} % du dépôt${gap === 0 ? ' (frais de service habituels)' : ''}`,
        `Délai : ${Math.round(dtMin)} min après le dépôt`,
        p.chain !== tx.chain ? `Paiement sur ${CHAINS[p.chain].name}` : 'Paiement sur la même chaîne',
      ]
      scored.push({ txId: p.id, chain: p.chain, from: l.from, to: l.to, asset: l.asset, value: l.value, usd: v, ratio, dtMin: Math.round(dtMin), reasons, s: 0.75 * amt + 0.25 * time })
    }
  }
  const weights = scored.map((c) => c.s ** 6)
  const total = weights.reduce((a, b) => a + b, 0) || 1
  const candidates = scored
    .map(({ s: _s, ...c }, i) => ({ ...c, prob: weights[i] / total }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 6)
  return {
    ...base,
    candidates,
    note: candidates.length ? undefined : `Aucun paiement de ${entity.name} compatible dans les ${SWAP_WINDOW_H} h : sortie possible vers une chaîne opaque (Monero) ou hors périmètre.`,
  }
}

/** Le dépôt d'une transaction chez un échangeur instantané, s'il y en a un. */
export function instantSwapDeposit(w: World, tx: Tx): string | undefined {
  const dests = tx.model === 'utxo' ? tx.outputs.map((o) => o.address) : tx.transfers.map((t) => t.to)
  return dests.find((d) => attribution(w, d).entity?.category === 'instant_exchanger')
}

// ── Peel chain ──────────────────────────────────────────────────────────────

export interface PeelHop {
  txId: string
  time: number
  hop: string
  next?: string
  peels: { address: string; value: number; usd: number; entity?: Entity }[]
  /** Montant qui continue sur la chaîne après ce saut. */
  remaining: number
  /** Probabilité que la sortie suivie soit bien le rendu (analyse de rendu). */
  changeProb: number
  dtH?: number
}

export type PeelEnd = 'unspent' | 'service' | 'coinjoin' | 'split' | 'limit'

export const PEEL_END_LABEL: Record<PeelEnd, string> = {
  unspent: 'Les fonds restants dorment sur la dernière adresse (non dépensée).',
  service: 'Le reste de la chaîne entre chez un service identifié.',
  coinjoin: 'Le reste passe dans un CoinJoin : suivi interrompu.',
  split: 'La transaction suivante répartit les fonds en parts comparables : ce n\'est plus une peel chain.',
  limit: 'Limite de 80 sauts atteinte.',
}

export interface PeelResult {
  start: string
  steps: PeelHop[]
  peeledUsd: number
  byEntity: { entity: Entity; usd: number; count: number }[]
  unattributedPeels: number
  end: { reason: PeelEnd; address: string; entity?: Entity; value: number }
  medianIntervalH?: number
  txIds: string[]
}

/** Suit une peel chain : à chaque saut, la plus grosse sortie continue, les petites sont des « pelures ». */
export function followPeelChain(w: World, start: string, maxSteps = 80): PeelResult {
  const native = CHAINS[w.get(start).chain].native
  const steps: PeelHop[] = []
  let cur = start
  let t = -Infinity
  let end: PeelResult['end'] | undefined
  const seen = new Set<string>()
  for (let i = 0; i < maxSteps; i++) {
    const tx = w.txsOf(cur).find((x) => x.model === 'utxo' && x.time >= t && !seen.has(x.id) && x.inputs.some((inp) => inp.address === cur))
    if (!tx) {
      end = { reason: 'unspent', address: cur, value: w.unspentValue(cur) }
      break
    }
    if (detectCoinjoin(tx).is) {
      end = { reason: 'coinjoin', address: cur, value: w.unspentValue(cur) }
      break
    }
    const outs = [...tx.outputs].sort((a, b) => b.value - a.value)
    const total = outs.reduce((s, o) => s + o.value, 0)
    const main = outs[0]
    const rest = outs.slice(1)
    const restTotal = rest.reduce((s, o) => s + o.value, 0)
    if (!main || outs.length > 4 || restTotal > total * 0.4) {
      end = { reason: 'split', address: cur, value: 0 }
      break
    }
    seen.add(tx.id)
    const ch = changeAnalysis(w, tx).find((c) => c.n === main.n)
    const prev = steps[steps.length - 1]
    const step: PeelHop = {
      txId: tx.id,
      time: tx.time,
      hop: cur,
      next: main.address,
      peels: rest.map((o) => ({ address: o.address, value: o.value, usd: usd(native, o.value), entity: knownService(w, o.address) })),
      remaining: main.value,
      changeProb: ch?.prob ?? 1,
      dtH: prev ? (tx.time - prev.time) / H : undefined,
    }
    steps.push(step)
    const svc = knownService(w, main.address)
    if (svc) {
      end = { reason: 'service', address: main.address, entity: svc, value: main.value }
      break
    }
    cur = main.address
    t = tx.time
  }
  end ??= { reason: 'limit', address: cur, value: w.unspentValue(cur) }

  const byEntity = new Map<string, { entity: Entity; usd: number; count: number }>()
  let unattributedPeels = 0
  let peeledUsd = 0
  for (const s of steps)
    for (const p of s.peels) {
      peeledUsd += p.usd
      if (!p.entity) {
        unattributedPeels++
        continue
      }
      const e = byEntity.get(p.entity.id) ?? { entity: p.entity, usd: 0, count: 0 }
      e.usd += p.usd
      e.count++
      byEntity.set(p.entity.id, e)
    }
  return {
    start,
    steps,
    peeledUsd,
    byEntity: [...byEntity.values()].sort((a, b) => b.usd - a.usd),
    unattributedPeels,
    end,
    medianIntervalH: median(steps.map((s) => s.dtH).filter((x): x is number => x !== undefined)),
    txIds: steps.map((s) => s.txId),
  }
}
