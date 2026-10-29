// Démixage : exploitation des erreurs d'hygiène autour des pools de
// confidentialité (Tornado Cash) et des CoinJoin. Ces outils ne « cassent »
// pas le mélange : ils cherchent les comportements qui le contournent
// (regroupements, reliquats non mixés, rendus toxiques), et donnent une
// présomption à corroborer.
import { CHAINS, usd, type AssetId } from './chains'
import type { Tx, World } from './world'
import { detectCoinjoin } from './analysis'

const H = 3600

const isMixer = (w: World, id: string) => w.get(id).contract?.type === 'mixer'

// ── Pools de confidentialité (modèle à comptes) ─────────────────────────────

export interface PoolDeposit {
  txId: string
  pool: string
  denom: number
  asset: AssetId
  time: number
}

export interface PoolWithdrawal {
  txId: string
  pool: string
  to: string
  denom: number
  time: number
  viaRelayer: boolean
}

export interface WithdrawalGroup {
  /** Adresse où convergent les retraits (absente : retraits isolés). */
  collector?: string
  withdrawals: PoolWithdrawal[]
  usd: number
  score: number
  reasons: string[]
  /** Raisons rédhibitoires (retrait antérieur aux dépôts…). */
  excluded: string[]
  /** Le collecteur reçoit aussi des fonds non mixés du déposant. */
  linked: boolean
}

export interface PoolDemix {
  depositor: string
  deposits: PoolDeposit[]
  depositedUsd: number
  /** Par dénomination : dépôts du suspect, et dépôts de tiers dans le même pool sur la période (ensemble d'anonymat). */
  anonymity: { denom: number; asset: AssetId; mine: number; others: number }[]
  groups: WithdrawalGroup[]
  /** Adresses où part l'argent non mixé du déposant (2 sauts). */
  residue: string[]
  windowEnd: number
}

/** Dépôts d'une adresse dans des pools de confidentialité. */
export function poolDeposits(w: World, id: string): PoolDeposit[] {
  const out: PoolDeposit[] = []
  for (const tx of w.txsOf(id)) {
    if (tx.model !== 'account') continue
    for (const t of tx.transfers) if (t.from === id && isMixer(w, t.to)) out.push({ txId: tx.id, pool: t.to, denom: t.value, asset: t.asset, time: tx.time })
  }
  return out
}

function withdrawalsOf(w: World, pool: string): PoolWithdrawal[] {
  const out: PoolWithdrawal[] = []
  for (const tx of w.txsOf(pool)) {
    const legs = tx.transfers.filter((t) => t.from === pool)
    if (!legs.length) continue
    const main = [...legs].sort((a, b) => b.value - a.value)[0]
    const denom = legs.reduce((s, l) => s + l.value, 0)
    out.push({ txId: tx.id, pool, to: main.to, denom: Math.round(denom * 1e6) / 1e6, time: tx.time, viaRelayer: tx.signer !== main.to })
  }
  return out
}

/** Destination principale des fonds sortis d'une adresse (hors pool). */
function forwardOf(w: World, id: string): string | undefined {
  const acc = new Map<string, number>()
  for (const tx of w.txsOf(id))
    for (const t of tx.transfers) if (t.from === id && t.to !== id && !isMixer(w, t.to)) acc.set(t.to, (acc.get(t.to) ?? 0) + usd(t.asset, t.value))
  return [...acc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

/** Adresses atteintes par les fonds non mixés du déposant, sur `depth` sauts. */
function residueOf(w: World, id: string, depth = 2): Set<string> {
  const seen = new Set<string>()
  let frontier = [id]
  for (let d = 0; d < depth; d++) {
    const next: string[] = []
    for (const a of frontier)
      for (const tx of w.txsOf(a))
        for (const t of tx.transfers) {
          if (t.from !== a || t.to === a || isMixer(w, t.to) || w.get(t.to).contract || seen.has(t.to)) continue
          seen.add(t.to)
          next.push(t.to)
        }
    frontier = next.slice(0, 40)
  }
  return seen
}

export function demixPool(w: World, depositor: string, windowDays = 30): PoolDemix | null {
  const deposits = poolDeposits(w, depositor)
  if (!deposits.length) return null
  const first = Math.min(...deposits.map((d) => d.time))
  const last = Math.max(...deposits.map((d) => d.time))
  const windowEnd = Math.min(w.horizon, last + windowDays * 86400)
  const pools = [...new Set(deposits.map((d) => d.pool))]
  const residue = residueOf(w, depositor)
  const asset = deposits[0].asset

  // Retraits des mêmes pools sur la fenêtre (et un peu avant, pour écarter les leurres)
  const all = pools.flatMap((p) => withdrawalsOf(w, p)).filter((x) => x.time >= first - 7 * 86400 && x.time <= windowEnd)
  const byCollector = new Map<string, PoolWithdrawal[]>()
  for (const x of all) {
    const k = forwardOf(w, x.to) ?? x.to
    const l = byCollector.get(k) ?? []
    l.push(x)
    byCollector.set(k, l)
  }

  const groups: WithdrawalGroup[] = []
  for (const [k, list] of byCollector) {
    const reasons: string[] = []
    const excluded: string[] = []
    let score = 0
    const direct = list.length === 1 && k === list[0].to
    const collector = direct ? undefined : k
    const linked = residue.has(k) || list.some((x) => residue.has(x.to) || x.to === depositor) ||
      (!!collector && w.txsOf(collector).some((tx) => tx.transfers.some((t) => t.to === collector && residue.has(t.from))))
    if (list.some((x) => x.to === depositor || residue.has(x.to))) {
      score += 0.6
      reasons.push('Retrait vers une adresse déjà alimentée par le déposant (réutilisation)')
    }
    if (collector && list.length >= 2) {
      score += 0.3
      reasons.push(`${list.length} retraits regroupés sur la même adresse`)
    }
    if (linked && collector) {
      score += 0.45
      reasons.push('Le collecteur reçoit aussi des fonds non mixés du déposant (reliquat)')
    }
    const early = list.filter((x) => x.time < first)
    if (early.length) excluded.push(`${early.length} retrait(s) antérieur(s) au premier dépôt : fonds d'un autre utilisateur`)
    const mine = new Map<number, number>()
    for (const d of deposits) mine.set(d.denom, (mine.get(d.denom) ?? 0) + 1)
    for (const [denom, n] of countBy(list.map((x) => roundDenom(x.denom)))) {
      if (n > (mine.get(denom) ?? 0)) excluded.push(`${n} retraits de ${denom} ${asset} pour ${mine.get(denom) ?? 0} dépôt(s) du suspect à cette dénomination`)
    }
    const directW = list.filter((x) => !x.viaRelayer)
    if (directW.length) reasons.push(`${directW.length} retrait(s) sans relayer : le bénéficiaire a payé le gaz, son financeur est à vérifier`)
    // Un retrait isolé sans erreur d'hygiène n'apprend rien : on ne garde que les groupes parlants
    if (score <= 0 && (!excluded.length || !collector)) continue
    if (excluded.length) score = Math.min(score, 0.15)
    groups.push({ collector, withdrawals: list.sort((a, b) => a.time - b.time), usd: list.reduce((s, x) => s + usd(asset, x.denom), 0), score: Math.min(1, score), reasons, excluded, linked })
  }
  groups.sort((a, b) => b.score - a.score || b.withdrawals.length - a.withdrawals.length)

  // Ensemble d'anonymat : dépôts de tiers aux mêmes dénominations pendant la période
  const anonymity = [...countBy(deposits.map((d) => d.denom))].map(([denom, n]) => {
    let others = 0
    for (const p of pools)
      for (const tx of w.txsOf(p))
        for (const t of tx.transfers) if (t.to === p && t.from !== depositor && Math.abs(t.value - denom) < 1e-6 && tx.time >= first && tx.time <= windowEnd) others++
    return { denom, asset, mine: n, others }
  })

  return { depositor, deposits, depositedUsd: deposits.reduce((s, d) => s + usd(d.asset, d.denom), 0), anonymity, groups: groups.slice(0, 12), residue: [...residue], windowEnd }
}

/** Rendu toxique d'une Tx0 : sorties qui ne partent pas dans un CoinJoin, quand d'autres y partent. */
function toxicOf(w: World, txId: string): string[] {
  const p = w.txs.get(txId)
  if (!p || p.model !== 'utxo' || detectCoinjoin(p).is || p.outputs.length < 2) return []
  const intoCj = (n: number) => {
    const s = w.spender(p.id, n)
    return !!s && detectCoinjoin(w.tx(s)).is
  }
  if (!p.outputs.some((o) => intoCj(o.n))) return []
  return p.outputs.filter((o) => !intoCj(o.n)).map((o) => o.address)
}

/** Rendus toxiques des Tx0 en amont des CoinJoin précédents (remix), avec l'adresse qui a signé la Tx0. */
function earlierPremix(w: World, tx: Tx, depth: number): Map<string, string> {
  const out = new Map<string, string>()
  const seen = new Set<string>()
  let frontier = [tx]
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: Tx[] = []
    for (const t of frontier)
      for (const i of t.inputs) {
        if (!i.prev || seen.has(i.prev.tx)) continue
        seen.add(i.prev.tx)
        const p = w.txs.get(i.prev.tx)
        if (!p) continue
        if (detectCoinjoin(p).is) next.push(p)
        else if (d > 0) for (const a of toxicOf(w, p.id)) out.set(a, p.inputs[0]?.address ?? a)
      }
    frontier = next.slice(0, 20)
  }
  return out
}

function countBy<T>(xs: T[]): Map<T, number> {
  const m = new Map<T, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return m
}

/** Un retrait via relayer arrive amputé des frais : on le ramène à sa dénomination. */
function roundDenom(v: number): number {
  for (const d of [0.1, 1, 10, 100, 1000]) if (v <= d && v >= d * 0.99) return d
  return v
}

// ── CoinJoin ────────────────────────────────────────────────────────────────

export interface CoinjoinParticipant {
  address: string
  value: number
  /** Rendu de ce participant dans le CoinJoin (montant = apport − dénomination − frais). */
  change?: string
  /** Rendu toxique de sa transaction de pré-mix (Tx0). */
  premixChange: string[]
}

export interface PostMixSpend {
  txId: string
  time: number
  mixedInputs: string[]
  /** Entrées qui rattachent la dépense à un participant (rendu toxique, adresse d'entrée). */
  linkInputs: string[]
  participant?: string
  remix: boolean
}

export interface CoinjoinDemix {
  txId: string
  denom: number
  equalCount: number
  participants: CoinjoinParticipant[]
  postMix: PostMixSpend[]
  unspent: number
  remixed: number
}

export function demixCoinjoin(w: World, txId: string): CoinjoinDemix | null {
  const tx = w.tx(txId)
  const cj = detectCoinjoin(tx)
  if (!cj.is || cj.denom === undefined) return null
  const denom = cj.denom
  const isDenom = (v: number) => Math.abs(v - denom) < 1e-8
  const mixed = tx.outputs.filter((o) => isDenom(o.value))
  const changes = tx.outputs.filter((o) => !isDenom(o.value))

  // Apports par adresse, puis rapprochement arithmétique avec les rendus
  const contrib = new Map<string, number>()
  for (const i of tx.inputs) contrib.set(i.address, (contrib.get(i.address) ?? 0) + i.value)
  const free = new Set(changes.map((c) => c.address))
  const participants: CoinjoinParticipant[] = [...contrib.entries()].map(([address, value]) => {
    const expected = value - denom
    let best: { a: string; d: number } | undefined
    for (const c of changes) {
      if (!free.has(c.address)) continue
      const d = expected - c.value
      if (d >= 0 && d < Math.max(0.0005, denom * 0.02) && (!best || d < best.d)) best = { a: c.address, d }
    }
    if (best) free.delete(best.a)
    const premixChange = [...new Set(tx.inputs.filter((i) => i.address === address).flatMap((i) => (i.prev ? toxicOf(w, i.prev.tx) : [])))]
    return { address, value, change: best?.a, premixChange }
  })
  // Remix : les rendus toxiques des Tx0 des tours précédents restent exploitables
  const earlier = earlierPremix(w, tx, 3)

  // Dépenses post-mix des sorties mixées
  const ownerOf = new Map<string, string>()
  for (const p of participants) {
    ownerOf.set(p.address, p.address)
    if (p.change) ownerOf.set(p.change, p.address)
    for (const c of p.premixChange) ownerOf.set(c, p.address)
  }
  for (const [toxic, owner] of earlier) if (!ownerOf.has(toxic)) ownerOf.set(toxic, owner)
  const mixedSet = new Set(mixed.map((o) => o.address))
  const spends = new Map<string, PostMixSpend>()
  let unspent = 0
  for (const o of mixed) {
    const s = w.spender(tx.id, o.n)
    if (!s) {
      unspent++
      continue
    }
    if (spends.has(s)) continue
    const st = w.tx(s)
    const ins = st.inputs.map((i) => i.address)
    const linkInputs = ins.filter((a) => ownerOf.has(a) && !mixedSet.has(a))
    spends.set(s, {
      txId: s,
      time: st.time,
      mixedInputs: ins.filter((a) => mixedSet.has(a)),
      linkInputs,
      participant: linkInputs.length ? ownerOf.get(linkInputs[0]) : undefined,
      remix: detectCoinjoin(st).is,
    })
  }
  const postMix = [...spends.values()].sort((a, b) => Number(!!b.participant) - Number(!!a.participant) || b.mixedInputs.length - a.mixedInputs.length || a.time - b.time)
  return {
    txId,
    denom,
    equalCount: cj.equalCount ?? mixed.length,
    participants,
    postMix,
    unspent,
    remixed: postMix.filter((p) => p.remix).length,
  }
}

/** Délai lisible entre deux horodatages. */
export function fmtDelay(sec: number): string {
  const h = sec / H
  return h < 1 ? `${Math.round(sec / 60)} min` : h < 48 ? `${h.toFixed(1).replace('.', ',')} h` : `${Math.round(h / 24)} j`
}

export const nativeOf = (tx: Tx) => CHAINS[tx.chain].native
