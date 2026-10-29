// Outils d'analyse « à la Reactor / TRM » : clustering, détection de rendu,
// CoinJoin, attribution, exposition au risque et corrélation inter-chaînes.
import { CHAINS, type ChainId, usd } from './chains'
import { CATEGORY, RISK_META, type Entity, type EntityCategory, type RiskLevel } from './entities'
import { WALLET_PROFILES, type Tx, type WalletProfile, type World } from './world'
import type { AddrKind } from './addressgen'

// ── CoinJoin ───────────────────────────────────────────────────────────────

export function detectCoinjoin(tx: Tx): { is: boolean; denom?: number; equalCount?: number } {
  if (tx.model !== 'utxo' || tx.inputs.length < 4 || tx.outputs.length < 4) return { is: false }
  const counts = new Map<string, number>()
  for (const o of tx.outputs) {
    const k = o.value.toFixed(8)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let best = ''
  let n = 0
  for (const [k, c] of counts) if (c > n) [best, n] = [k, c]
  const distinctIn = new Set(tx.inputs.map((i) => i.address)).size
  if (n >= 4 && distinctIn >= 4) return { is: true, denom: parseFloat(best), equalCount: n }
  return { is: false }
}

// ── Clustering (common-input-ownership) ─────────────────────────────────────

export interface ClusterIndex {
  of: Map<string, string>
  members: Map<string, string[]>
}

const clusterCache = new WeakMap<World, { epoch: number; idx: ClusterIndex }>()

export function clusters(w: World): ClusterIndex {
  const cached = clusterCache.get(w)
  if (cached && cached.epoch === w.epoch) return cached.idx
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let p = parent.get(x) ?? x
    if (p !== x) {
      p = find(p)
      parent.set(x, p)
    }
    return p
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const tx of w.visibleTxs()) {
    if (tx.model !== 'utxo' || tx.inputs.length < 2) continue
    if (detectCoinjoin(tx).is) continue // l'heuristique ne s'applique pas aux CoinJoin
    const first = tx.inputs[0].address
    for (const i of tx.inputs) union(first, i.address)
  }
  const of = new Map<string, string>()
  const members = new Map<string, string[]>()
  for (const id of w.addresses.keys()) {
    const r = find(id)
    of.set(id, r)
    const l = members.get(r) ?? []
    l.push(id)
    members.set(r, l)
  }
  const idx = { of, members }
  clusterCache.set(w, { epoch: w.epoch, idx })
  return idx
}

export function clusterOf(w: World, id: string): string[] {
  const c = clusters(w)
  return c.members.get(c.of.get(id) ?? id) ?? [id]
}

export function clusterLabel(w: World, id: string): string {
  const root = clusters(w).of.get(id) ?? id
  let h = 0
  for (let i = 0; i < root.length; i++) h = (h * 31 + root.charCodeAt(i)) >>> 0
  return `C-${(h % 0xfffff).toString(16).toUpperCase().padStart(5, '0')}`
}

// ── Attribution ─────────────────────────────────────────────────────────────

export interface Attribution {
  entity?: Entity
  source: 'direct' | 'cluster' | 'none'
  label?: string
}

/** Ce que l'outil « sait » d'une adresse (base d'attribution + clustering). */
export function attribution(w: World, id: string): Attribution {
  const a = w.get(id)
  const e = a.entityId ? w.entities.get(a.entityId) : undefined
  if (e?.known && !w.hiddenAttribution.has(id)) return { entity: e, source: 'direct', label: a.label ?? e.name }
  if (CHAINS[a.chain].model === 'utxo') {
    for (const m of clusterOf(w, id)) {
      if (m === id) continue
      const ma = w.get(m)
      const me = ma.entityId ? w.entities.get(ma.entityId) : undefined
      if (me?.known && !w.hiddenAttribution.has(m)) return { entity: me, source: 'cluster', label: `${me.name} (cluster)` }
    }
  }
  return { source: 'none' }
}

// ── Empreinte de portefeuille (UTXO) ────────────────────────────────────────

export type OutputOrder = 'bip69' | 'random' | 'unknown'

export interface Fingerprint {
  version: number
  locktime: number
  locktimeKind: 'height' | 'zero'
  rbf: boolean
  /** Ordre des sorties : trié BIP 69, manifestement aléatoire, ou indécidable (moins de 3 sorties triées). */
  order: OutputOrder
  /** Taux de frais estimé, en sat/vB. */
  feeRate: number
  inputKinds: AddrKind[]
  /** Familles de logiciels compatibles avec ces champs. */
  families: WalletProfile[]
}

/** Ce qu'on lit dans les champs techniques d'une transaction UTXO (version, nLockTime, nSequence, ordre des sorties, frais). */
export function txFingerprint(w: World, tx: Tx): Fingerprint | null {
  if (tx.model !== 'utxo' || !tx.fp) return null
  const outs = tx.outputs
  let order: OutputOrder = 'unknown'
  if (outs.length >= 2) {
    const sorted = outs.every((o, i) => i === 0 || outs[i - 1].value < o.value || (outs[i - 1].value === o.value && w.get(outs[i - 1].address).addr <= w.get(o.address).addr))
    order = !sorted ? 'random' : outs.length >= 3 ? 'bip69' : 'unknown'
  }
  const locktimeKind = tx.fp.locktime > 0 ? 'height' : 'zero'
  const vbytes = 11 + tx.inputs.length * 68 + tx.outputs.length * 31
  const cj = detectCoinjoin(tx).is
  const families = WALLET_PROFILES.filter((p) => (p.id === 'coinjoin') === cj &&
    p.version === tx.fp!.version && p.locktime === locktimeKind && p.rbf === tx.fp!.rbf && (order === 'unknown' || p.bip69 === (order === 'bip69')))
  return {
    version: tx.fp.version,
    locktime: tx.fp.locktime,
    locktimeKind,
    rbf: tx.fp.rbf,
    order,
    feeRate: Math.round((tx.fee * 1e8) / vbytes),
    inputKinds: [...new Set(tx.inputs.map((i) => w.get(i.address).kind))],
    families,
  }
}

/** Différences d'empreinte entre deux transactions (vide = compatibles). */
export function fingerprintDiff(a: Fingerprint, b: Fingerprint): string[] {
  const d: string[] = []
  if (a.version !== b.version) d.push(`version ${a.version} / ${b.version}`)
  if (a.locktimeKind !== b.locktimeKind) d.push('nLockTime (hauteur de bloc / 0)')
  if (a.rbf !== b.rbf) d.push('signalement RBF')
  if ((a.order === 'bip69' && b.order === 'random') || (a.order === 'random' && b.order === 'bip69')) d.push('ordre des sorties (BIP 69)')
  return d
}

// ── Détection de l'adresse de rendu ─────────────────────────────────────────

export interface ChangeReason {
  text: string
  weight: number
}

export interface ChangeCandidate {
  n: number
  address: string
  value: number
  score: number
  prob: number
  reasons: ChangeReason[]
}

function decimals(v: number): number {
  const s = v.toFixed(8).replace(/0+$/, '')
  const i = s.indexOf('.')
  return i < 0 ? 0 : s.length - i - 1
}

export function changeAnalysis(w: World, tx: Tx): ChangeCandidate[] {
  if (tx.model !== 'utxo' || tx.outputs.length < 2 || detectCoinjoin(tx).is) return []
  const inAddrs = new Set(tx.inputs.map((i) => i.address))
  const inKinds = new Set(tx.inputs.map((i) => w.get(i.address).kind))
  const minIn = Math.min(...tx.inputs.map((i) => i.value))
  const cl = clusters(w)
  const inCluster = cl.of.get(tx.inputs[0].address)
  const roundOut = tx.outputs.map((o) => decimals(o.value) <= 4)
  const fp = txFingerprint(w, tx)
  const out = tx.outputs.map((o, idx) => {
    const reasons: ChangeReason[] = []
    const a = w.get(o.address)
    if (inAddrs.has(o.address)) reasons.push({ text: 'Retourne vers une adresse d\'entrée (réutilisation)', weight: 6 })
    if (inKinds.has(a.kind) && inKinds.size === 1) reasons.push({ text: 'Même type d\'adresse que les entrées', weight: 1.6 })
    else if (inKinds.has(a.kind)) reasons.push({ text: 'Même type qu\'une partie des entrées (entrées de types mélangés)', weight: 0.5 })
    else reasons.push({ text: 'Type d\'adresse différent des entrées', weight: -1.2 })
    const othersRound = roundOut.some((r, j) => j !== idx && r)
    if (!roundOut[idx] && othersRound) reasons.push({ text: 'Montant non rond (les autres sorties sont rondes)', weight: 1.6 })
    if (roundOut[idx]) reasons.push({ text: 'Montant rond (typique d\'un paiement)', weight: -1.4 })
    const hist = w.txsOf(o.address)
    if (hist[0]?.id === tx.id) reasons.push({ text: 'Adresse neuve (première apparition)', weight: 0.6 })
    else if (!inAddrs.has(o.address)) reasons.push({ text: 'Adresse déjà utilisée auparavant', weight: -1.5 })
    if (o.value < minIn && tx.inputs.length > 1) reasons.push({ text: 'Inférieure à la plus petite entrée (entrée superflue sinon)', weight: 0.5 })
    const spender = w.spender(tx.id, o.n)
    if (spender && cl.of.get(o.address) === inCluster && !inAddrs.has(o.address)) reasons.push({ text: 'Dépensée plus tard avec des adresses du même cluster', weight: 2.5 })
    const sfp = spender && fp ? txFingerprint(w, w.tx(spender)) : null
    if (fp && sfp && !inAddrs.has(o.address)) {
      const diff = fingerprintDiff(fp, sfp)
      if (!diff.length) reasons.push({ text: 'Dépensée ensuite par un logiciel de même empreinte', weight: 1.8 })
      else reasons.push({ text: `Dépensée ensuite par un autre logiciel (${diff.join(', ')})`, weight: -2 })
    }
    const attr = attribution(w, o.address)
    if (attr.entity && attr.entity.category === 'exchange') reasons.push({ text: `Adresse attribuée à ${attr.entity.name}`, weight: -3 })
    const score = reasons.reduce((s, r) => s + r.weight, 0)
    return { n: o.n, address: o.address, value: o.value, score, prob: 0, reasons }
  })
  const max = Math.max(...out.map((o) => o.score))
  const exps = out.map((o) => Math.exp(o.score - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  out.forEach((o, i) => (o.prob = exps[i] / sum))
  return out
}

// ── Exposition au risque (sources / destinations) ──────────────────────────

export type Exposure = Partial<Record<EntityCategory, number>>

export interface ExposureResult {
  direct: Exposure
  indirect: Exposure
  totalUsd: number
}

/** Remonte (in) ou descend (out) les flux jusqu'à 3 sauts, au prorata des montants. */
export function exposure(w: World, id: string, dir: 'in' | 'out', maxHops = 3): ExposureResult {
  const direct: Exposure = {}
  const indirect: Exposure = {}
  let totalUsd = 0
  let frontier: { id: string; usd: number }[] = [{ id, usd: -1 }]
  const seen = new Set<string>([id])
  let budget = 600
  for (let hop = 1; hop <= maxHops && frontier.length && budget > 0; hop++) {
    const next: { id: string; usd: number }[] = []
    for (const node of frontier) {
      const flows = counterpartFlows(w, node.id, dir)
      const sum = flows.reduce((s, f) => s + f.usd, 0)
      if (!sum) continue
      const scale = node.usd < 0 ? 1 : node.usd / sum
      if (hop === 1) totalUsd = sum
      for (const f of flows) {
        if (--budget <= 0) break
        const v = f.usd * scale
        if (v < 1) continue
        const at = attribution(w, f.id)
        const cat = at.entity?.category
        if (cat && cat !== 'individual') {
          const bucket = hop === 1 ? direct : indirect
          bucket[cat] = (bucket[cat] ?? 0) + v
        } else if (!seen.has(f.id)) {
          seen.add(f.id)
          next.push({ id: f.id, usd: v })
        }
      }
    }
    frontier = next
  }
  return { direct, indirect, totalUsd }
}

/** Contreparties d'une adresse avec la valeur USD échangée. */
export function counterpartFlows(w: World, id: string, dir: 'in' | 'out'): { id: string; usd: number }[] {
  const acc = new Map<string, number>()
  for (const tx of w.txsOf(id)) {
    if (tx.model === 'utxo') {
      const native = CHAINS[tx.chain].native
      const inTotal = tx.inputs.reduce((s, i) => s + i.value, 0) || 1
      if (dir === 'out') {
        const mine = tx.inputs.filter((i) => i.address === id).reduce((s, i) => s + i.value, 0)
        if (!mine) continue
        for (const o of tx.outputs) {
          if (o.address === id) continue
          acc.set(o.address, (acc.get(o.address) ?? 0) + usd(native, (o.value * mine) / inTotal))
        }
      } else {
        const mine = tx.outputs.filter((o) => o.address === id).reduce((s, o) => s + o.value, 0)
        if (!mine) continue
        for (const i of tx.inputs) {
          if (i.address === id) continue
          acc.set(i.address, (acc.get(i.address) ?? 0) + usd(native, (i.value / inTotal) * mine))
        }
      }
    } else {
      for (const t of tx.transfers) {
        if (dir === 'out' && t.from === id && t.to !== id) acc.set(t.to, (acc.get(t.to) ?? 0) + usd(t.asset, t.value))
        if (dir === 'in' && t.to === id && t.from !== id) acc.set(t.from, (acc.get(t.from) ?? 0) + usd(t.asset, t.value))
      }
    }
  }
  return [...acc.entries()].map(([k, v]) => ({ id: k, usd: v }))
}

// ── Score de risque ─────────────────────────────────────────────────────────

export interface RiskResult {
  score: number
  level: RiskLevel
  reasons: string[]
}

const W: Record<RiskLevel, number> = { low: 0, medium: 0.25, high: 0.6, severe: 1 }

export function riskScore(w: World, id: string): RiskResult {
  const at = attribution(w, id)
  const reasons: string[] = []
  let score = 0
  if (at.entity) {
    score = RISK_META[at.entity.risk].score
    reasons.push(`Attribuée à ${at.entity.name} (${CATEGORY[at.entity.category].label})`)
  }
  for (const dir of ['in', 'out'] as const) {
    const ex = exposure(w, id, dir, 3)
    const tot = Object.values(ex.direct).reduce((a, b) => a + (b ?? 0), 0) + Object.values(ex.indirect).reduce((a, b) => a + (b ?? 0), 0)
    if (!tot) continue
    let s = 0
    for (const [cat, v] of Object.entries(ex.direct)) s += (v ?? 0) * W[CATEGORY[cat as EntityCategory].risk]
    for (const [cat, v] of Object.entries(ex.indirect)) s += (v ?? 0) * W[CATEGORY[cat as EntityCategory].risk] * 0.6
    const ratio = s / tot
    score = Math.max(score, Math.round(ratio * 100))
    const worst = [...Object.entries(ex.direct), ...Object.entries(ex.indirect)]
      .filter(([cat]) => W[CATEGORY[cat as EntityCategory].risk] >= 0.6)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]
    if (worst) reasons.push(`Exposition ${dir === 'in' ? 'entrante' : 'sortante'} : ${CATEGORY[worst[0] as EntityCategory].label}`)
  }
  const level: RiskLevel = score >= 85 ? 'severe' : score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low'
  return { score: Math.min(100, score), level, reasons }
}

// ── Corrélation montant / temps (swaps, mixeurs, bridges opaques) ──────────

export interface CorrelationQuery {
  time: number
  usd: number
  chains: ChainId[]
  windowH: number
  tolerancePct: number
  /** Ne retenir que les paiements émis par cette entité (si connue de l'outil). */
  entityId?: string
  excludeTx?: string
}

export interface CorrelationHit {
  txId: string
  chain: ChainId
  to: string
  from: string
  usd: number
  value: number
  asset: string
  dtMin: number
  score: number
}

export function correlate(w: World, q: CorrelationQuery): CorrelationHit[] {
  const hits: CorrelationHit[] = []
  const t1 = q.time + q.windowH * 3600
  for (const tx of w.visibleTxs()) {
    if (!q.chains.includes(tx.chain) || tx.time < q.time || tx.time > t1 || tx.id === q.excludeTx) continue
    const legs: { from: string; to: string; value: number; asset: string; usd: number }[] = []
    if (tx.model === 'utxo') {
      const native = CHAINS[tx.chain].native
      const from = tx.inputs[0]?.address
      const fromSet = new Set(tx.inputs.map((i) => i.address))
      if (!from) continue
      for (const o of tx.outputs) if (!fromSet.has(o.address)) legs.push({ from, to: o.address, value: o.value, asset: native, usd: usd(native, o.value) })
    } else {
      for (const t of tx.transfers) legs.push({ from: t.from, to: t.to, value: t.value, asset: t.asset, usd: usd(t.asset, t.value) })
    }
    for (const l of legs) {
      if (q.entityId) {
        // Filtre fondé sur ce que l'enquêteur voit (attribution), pas sur la vérité cachée
        if (attribution(w, l.from).entity?.id !== q.entityId) continue
        if (attribution(w, l.to).entity?.id === q.entityId) continue
      }
      const dv = Math.abs(l.usd - q.usd) / Math.max(1, q.usd)
      if (dv > q.tolerancePct) continue
      const dt = (tx.time - q.time) / 60
      const score = (1 - dv / q.tolerancePct) * 0.7 + (1 - dt / (q.windowH * 60)) * 0.3
      hits.push({ txId: tx.id, chain: tx.chain, to: l.to, from: l.from, usd: l.usd, value: l.value, asset: l.asset, dtMin: Math.round(dt), score })
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 30)
}

/** Usage pédagogique : la valeur USD reçue par `id` dans `tx`. */
export function usdTo(w: World, tx: Tx, id: string): number {
  return w.flowIn(tx, id).reduce((s, f) => s + usd(f.asset, f.value), 0)
}
