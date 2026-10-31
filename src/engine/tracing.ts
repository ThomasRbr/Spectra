// Traçage des fonds : propagation d'un montant « marqué » (les fonds de la
// victime) vers l'aval, selon une méthode d'attribution reconnue (FIFO, LIFO,
// prorata « haircut », contamination totale « poison »). Fournit aussi la
// recherche de chemin entre deux adresses et l'arbre de premier financement.
// Tout est calculé à partir de ce que l'outil voit (attribution), jamais de la
// vérité cachée du scénario.
import { CHAINS, usd, type AssetId } from './chains'
import type { Entity, EntityCategory } from './entities'
import type { Tx, World } from './world'
import { attribution } from './analysis'

export type TraceMethod = 'fifo' | 'lifo' | 'haircut' | 'poison'

export const TRACE_METHODS: Record<TraceMethod, { label: string; short: string; help: string }> = {
  fifo: {
    label: 'FIFO (premier entré, premier sorti)',
    short: 'FIFO',
    help: 'Les sorties consomment d\'abord les fonds arrivés en premier. Méthode la plus répandue en comptabilité et souvent retenue par les juridictions ; défavorable si l\'adresse détenait déjà des fonds propres.',
  },
  lifo: {
    label: 'LIFO (dernier entré, premier sorti)',
    short: 'LIFO',
    help: 'Les sorties consomment d\'abord les fonds arrivés en dernier. Suit au plus près des fonds qui transitent rapidement ; à justifier, car moins courante.',
  },
  haircut: {
    label: 'Prorata (haircut)',
    short: 'Prorata',
    help: 'Chaque sortie emporte la part marquée du solde au moment du paiement. Neutre et facile à expliquer ; dilue les fonds à chaque mélange.',
  },
  poison: {
    label: 'Contamination totale (poison)',
    short: 'Poison',
    help: 'Dès qu\'un fonds marqué entre, tout ce qui sort est considéré comme marqué. Sert à délimiter le périmètre maximal (signalement, gel conservatoire), jamais à chiffrer un préjudice.',
  },
}

export interface TraceSource {
  txId: string
  address: string
  /** Actif à tracer (par défaut : tout ce que l'adresse reçoit dans la transaction). */
  asset?: AssetId
  /** Modèle à comptes : ne tracer que ce qui vient de cette contrepartie. */
  from?: string
}

export interface TraceOptions {
  method: TraceMethod
  /** Nombre maximal de sauts suivis depuis la source. */
  maxHops?: number
  /** En dessous de ce montant (USD), une part marquée n'est plus suivie. */
  minUsd?: number
  /** S'arrêter sur les entités connues (exchanges, mixeurs…). */
  stopAtServices?: boolean
  /** Situation à cette date (horodatage), au lieu de tout l'historique. */
  until?: number
  /**
   * Prêts DeFi : un emprunt garanti par des fonds marqués est marqué à
   * proportion de la garantie marquée (lien économique, pas un flux direct).
   */
  followCollateral?: boolean
}

type Amounts = Partial<Record<AssetId, number>>

export interface TracedAddress {
  id: string
  hop: number
  received: Amounts
  receivedUsd: number
  held: Amounts
  heldUsd: number
}

export interface TraceEndpoint {
  entity: Entity
  usd: number
  amounts: Amounts
  /** Adresses du service par lesquelles les fonds sont entrés (adresses de dépôt…). */
  addresses: string[]
  txIds: string[]
}

export interface TraceResult {
  source: TraceSource
  method: TraceMethod
  sourceUsd: number
  sourceAmounts: Amounts
  byAddress: Map<string, TracedAddress>
  /** Valeur marquée (USD) qui transite par chaque transaction. */
  byTx: Map<string, number>
  endpoints: TraceEndpoint[]
  /** Adresses non attribuées qui détiennent encore des fonds marqués (pistes de gel). */
  stillHeld: TracedAddress[]
  heldUsd: number
  lost: { belowThresholdUsd: number; feesUsd: number; depthUsd: number; inTransitUsd: number }
  /** Transactions du flux marqué, à révéler dans le graphe. */
  path: string[]
  truncated: boolean
  /** Emprunts rattachés à une garantie marquée (lien indirect, à exposer comme tel). */
  collateral: { txId: string; borrower: string; usd: number }[]
}

// Catégories qui ne constituent pas un « service » : on continue à suivre.
const PASS = new Set<EntityCategory>(['individual', 'suspect', 'victim'])
// Contrats de conversion : les fonds y entrent et en ressortent sous un autre
// actif dans la même transaction (DEX, agrégateur, WETH, protocole de prêt).
const POOL_TYPES = new Set(['router', 'pool', 'aggregator', 'wrapper', 'lending'])
const RECEIPTS: AssetId[] = ['aWETH', 'aUSDC']
const MAX_TAINTED_TX = 6000

const sortedCache = new WeakMap<World, { epoch: number; list: Tx[]; rank: Map<string, number> }>()
function sortedTxs(w: World): { list: Tx[]; rank: Map<string, number> } {
  let s = sortedCache.get(w)
  if (!s || s.epoch !== w.epoch) {
    const list = w.visibleTxs().sort((a, b) => a.time - b.time)
    s = { epoch: w.epoch, list, rank: new Map(list.map((t, i) => [t.id, i])) }
    sortedCache.set(w, s)
  }
  return s
}

const add = (m: Amounts, a: AssetId, v: number) => (m[a] = (m[a] ?? 0) + v)
const amountsUsd = (m: Amounts) => Object.entries(m).reduce((s, [a, v]) => s + usd(a as AssetId, v ?? 0), 0)

/** Grand livre d'une adresse pour un actif (modèle à comptes). */
class Ledger {
  lots: { amt: number; tainted: boolean }[] = []
  constructor(readonly method: TraceMethod, readonly hop: number) {}

  get balance() {
    return this.lots.reduce((s, l) => s + l.amt, 0)
  }
  get tainted() {
    const t = this.lots.reduce((s, l) => s + (l.tainted ? l.amt : 0), 0)
    return this.method === 'poison' && t > 0 ? this.balance : t
  }

  credit(amt: number, tainted: boolean) {
    if (amt > 0) this.lots.push({ amt, tainted })
  }

  /** Retire `amt` et renvoie la part marquée emportée. */
  debit(amt: number): number {
    if (this.method === 'poison') {
      const hit = this.lots.some((l) => l.tainted)
      this.take(amt, 'front')
      if (hit && this.lots.length) this.lots.forEach((l) => (l.tainted = true))
      return hit ? amt : 0
    }
    if (this.method === 'haircut') {
      const bal = this.balance
      if (bal <= 0) return 0
      const t = this.tainted
      const out = Math.min(amt, bal)
      const left = bal - out
      const frac = t / bal
      this.lots = []
      if (left > 0) {
        this.lots.push({ amt: left * (1 - frac), tainted: false })
        this.lots.push({ amt: left * frac, tainted: true })
      }
      return out * frac
    }
    return this.take(amt, this.method === 'fifo' ? 'front' : 'back')
  }

  private take(amt: number, from: 'front' | 'back'): number {
    let rest = amt
    let tainted = 0
    while (rest > 1e-12 && this.lots.length) {
      const i = from === 'front' ? 0 : this.lots.length - 1
      const lot = this.lots[i]
      const q = Math.min(rest, lot.amt)
      if (lot.tainted) tainted += q
      lot.amt -= q
      rest -= q
      if (lot.amt <= 1e-12) this.lots.splice(i, 1)
    }
    return tainted
  }
}

export function traceFunds(w: World, source: TraceSource, opts: TraceOptions): TraceResult {
  const method = opts.method
  const maxHops = opts.maxHops ?? 10
  const minUsd = opts.minUsd ?? 10
  const stopAtServices = opts.stopAtServices ?? true
  const until = opts.until ?? Infinity
  const followCollateral = opts.followCollateral ?? true
  const collateral: TraceResult['collateral'] = []

  const isPool = (id: string) => POOL_TYPES.has(w.get(id).contract?.type ?? '') || w.get(id).tags.includes('null')
  const attrCache = new Map<string, Entity | undefined>()
  // Un pool ou un routeur de DEX n'est pas une destination : les fonds y
  // transitent (swap) ou y restent en liquidité, puis peuvent en être retirés.
  const serviceOf = (id: string): Entity | undefined => {
    if (!attrCache.has(id)) {
      const e = attribution(w, id).entity
      attrCache.set(id, e && !PASS.has(e.category) && !isPool(id) ? e : undefined)
    }
    return attrCache.get(id)
  }

  const utxoTaint = new Map<string, { t: number; hop: number }>()
  const ledgers = new Map<string, Ledger>()
  const pendingBridge = new Map<string, { frac: number; usd: number; hop: number }>()
  const byAddress = new Map<string, TracedAddress>()
  const byTx = new Map<string, number>()
  const endpoints = new Map<string, TraceEndpoint>()
  const path = new Set<string>()
  const lost = { belowThresholdUsd: 0, feesUsd: 0, depthUsd: 0, inTransitUsd: 0 }
  const sourceAmounts: Amounts = {}

  const ok = (k: string, n: number) => `${k}:${n}`
  const lkey = (id: string, a: AssetId) => `${id}|${a}`

  const node = (id: string, hop: number): TracedAddress => {
    let n = byAddress.get(id)
    if (!n) {
      n = { id, hop, received: {}, receivedUsd: 0, held: {}, heldUsd: 0 }
      byAddress.set(id, n)
    }
    n.hop = Math.min(n.hop, hop)
    return n
  }

  const { list: all, rank } = sortedTxs(w)
  const balanceBefore = (id: string, asset: AssetId, tx: Tx): number => {
    let b = 0
    for (const t of w.txsOf(id)) {
      if (t.id === tx.id || t.time > tx.time) continue
      if (t.time === tx.time && rank.get(t.id)! > rank.get(tx.id)!) continue
      for (const f of w.flowIn(t, id)) if (f.asset === asset) b += f.value
      for (const f of w.flowOut(t, id)) if (f.asset === asset) b -= f.value
    }
    return Math.max(0, b)
  }

  const markTx = (tx: Tx, v: number) => {
    path.add(tx.id)
    byTx.set(tx.id, (byTx.get(tx.id) ?? 0) + v)
  }

  /** Arrivée d'une part marquée sur une adresse. */
  const arrive = (tx: Tx, to: string, asset: AssetId, amt: number, hop: number, utxoKey?: string) => {
    if (amt <= 0) return
    const v = usd(asset, amt)
    markTx(tx, v)
    if (v < minUsd) {
      lost.belowThresholdUsd += v
      return
    }
    const n = node(to, hop)
    add(n.received, asset, amt)
    n.receivedUsd += v
    const svc = stopAtServices ? serviceOf(to) : undefined
    if (svc) {
      let e = endpoints.get(svc.id)
      if (!e) {
        e = { entity: svc, usd: 0, amounts: {}, addresses: [], txIds: [] }
        endpoints.set(svc.id, e)
      }
      e.usd += v
      add(e.amounts, asset, amt)
      if (!e.addresses.includes(to)) e.addresses.push(to)
      if (!e.txIds.includes(tx.id)) e.txIds.push(tx.id)
      return
    }
    if (hop > maxHops) {
      lost.depthUsd += v
      return
    }
    if (utxoKey) utxoTaint.set(utxoKey, { t: amt, hop })
    else {
      const k = lkey(to, asset)
      let l = ledgers.get(k)
      if (!l) {
        l = new Ledger(method, hop)
        l.credit(balanceBefore(to, asset, tx), false)
        ledgers.set(k, l)
      }
      l.credit(amt, true)
    }
  }

  /** Les fonds marqués partent vers un bridge : on les retrouve sur la transaction d'arrivée. */
  const toBridge = (tx: Tx, contract: string, asset: AssetId, amt: number, hop: number): boolean => {
    if (!tx.bridge || tx.bridge.direction !== 'out' || !tx.bridge.otherTx) return false
    const sent = tx.model === 'utxo'
      ? tx.outputs.filter((o) => o.address === contract).reduce((s, o) => s + o.value, 0)
      : tx.transfers.filter((t) => t.to === contract && t.asset === asset).reduce((s, t) => s + t.value, 0)
    if (!sent) return false
    const v = usd(asset, amt)
    markTx(tx, v)
    node(contract, hop)
    const p = pendingBridge.get(tx.bridge.otherTx)
    pendingBridge.set(tx.bridge.otherTx, { frac: (p?.frac ?? 0) + amt / sent, usd: (p?.usd ?? 0) + v, hop })
    return true
  }

  const isBridgeContract = (tx: Tx, id: string) => tx.bridge?.direction === 'out' && w.get(id).contract?.type === 'bridge'

  // ── Source ────────────────────────────────────────────────────────────────
  const src = w.tx(source.txId)
  const isSourceLeg = (t: Tx['transfers'][number]) =>
    t.to === source.address && (!source.asset || t.asset === source.asset) && (!source.from || t.from === source.from)
  if (src.model === 'utxo') {
    for (const o of src.outputs) {
      if (o.address !== source.address) continue
      utxoTaint.set(ok(src.id, o.n), { t: o.value, hop: 0 })
      add(sourceAmounts, CHAINS[src.chain].native, o.value)
    }
  } else {
    for (const t of src.transfers) {
      if (!isSourceLeg(t)) continue
      const k = lkey(t.to, t.asset)
      let l = ledgers.get(k)
      if (!l) {
        l = new Ledger(method, 0)
        l.credit(balanceBefore(t.to, t.asset, src), false)
        ledgers.set(k, l)
      }
      l.credit(t.value, true)
      add(sourceAmounts, t.asset, t.value)
    }
  }
  node(source.address, 0)
  path.add(src.id)
  const sourceUsd = amountsUsd(sourceAmounts)

  // ── Propagation chronologique ─────────────────────────────────────────────
  let taintedTx = 0
  let truncated = false
  // La transaction source est rejouée elle aussi : ce que l'adresse renvoie dans
  // la même transaction (prêt flash remboursé, swap) doit être déduit.
  const isSourceCredit = (tx: Tx, t: Tx['transfers'][number]) => tx.id === src.id && isSourceLeg(t)
  for (let i = rank.get(src.id)!; i < all.length; i++) {
    const tx = all[i]
    if (tx.time > until) break
    if (taintedTx > MAX_TAINTED_TX) {
      truncated = true
      break
    }

    // Arrivée d'un bridge dont le départ était marqué
    const pb = tx.bridge?.direction === 'in' ? pendingBridge.get(tx.id) : undefined
    if (pb) {
      pendingBridge.delete(tx.id)
      taintedTx++
      const recipient = tx.bridge!.recipient
      let outUsd = 0
      if (tx.model === 'utxo') {
        for (const o of tx.outputs) {
          if (recipient && o.address !== recipient) continue
          const amt = o.value * Math.min(1, pb.frac)
          outUsd += usd(CHAINS[tx.chain].native, amt)
          arrive(tx, o.address, CHAINS[tx.chain].native, amt, pb.hop + 1, ok(tx.id, o.n))
        }
      } else {
        for (const t of tx.transfers) {
          if (recipient && t.to !== recipient) continue
          const amt = t.value * Math.min(1, pb.frac)
          outUsd += usd(t.asset, amt)
          arrive(tx, t.to, t.asset, amt, pb.hop + 1)
          if (t.value - amt > 0) ledgers.get(lkey(t.to, t.asset))?.credit(t.value - amt, false)
        }
      }
      if (method !== 'poison') lost.feesUsd += Math.max(0, pb.usd - outUsd)
      continue
    }

    if (tx.model === 'utxo') {
      let tIn = 0
      let hop = 0
      const segs: { v: number; t: number }[] = []
      for (const inp of tx.inputs) {
        const k = inp.prev ? ok(inp.prev.tx, inp.prev.n) : undefined
        const ta = k ? utxoTaint.get(k) : undefined
        if (ta && k) {
          utxoTaint.delete(k)
          tIn += ta.t
          hop = Math.max(hop, ta.hop)
        }
        segs.push({ v: inp.value, t: ta?.t ?? 0 })
      }
      if (tIn <= 0) continue
      taintedTx++
      const native = CHAINS[tx.chain].native
      const inTotal = tx.inputs.reduce((s, x) => s + x.value, 0) || 1
      const shares = utxoShares(method, segs, tx.outputs.map((o) => o.value), tIn, inTotal)
      let outT = 0
      tx.outputs.forEach((o, j) => {
        const s = shares[j]
        if (s <= 0) return
        outT += s
        if (isBridgeContract(tx, o.address) && toBridge(tx, o.address, native, s, hop)) return
        arrive(tx, o.address, native, s, hop + 1, ok(tx.id, o.n))
      })
      if (method !== 'poison') lost.feesUsd += Math.max(0, usd(native, tIn - outT))
      continue
    }

    // Modèle à comptes. Un swap se reconnaît à des fonds qui entrent dans un
    // pool/routeur de DEX et en ressortent dans la même transaction : la part
    // marquée de l'entrée est convertie, à valeur égale, dans l'actif de sortie.
    // Emprunt garanti par des aTokens marqués : l'actif emprunté hérite de la part marquée de la garantie.
    if (followCollateral && tx.signer && tx.tags.includes('lending-borrow')) {
      let tUsd = 0
      let totUsd = 0
      let hop = 0
      for (const a of RECEIPTS) {
        const l = ledgers.get(lkey(tx.signer, a))
        if (l) {
          tUsd += usd(a, l.tainted)
          totUsd += usd(a, l.balance)
          hop = Math.max(hop, l.hop)
        } else totUsd += usd(a, balanceBefore(tx.signer, a, tx))
      }
      if (tUsd > 0) {
        taintedTx++
        const frac = method === 'poison' ? 1 : Math.min(1, tUsd / Math.max(totUsd, 1e-9))
        let got = 0
        for (const t of tx.transfers) {
          const amt = t.value * frac
          got += usd(t.asset, amt)
          arrive(tx, t.to, t.asset, amt, hop + 1)
          if (t.value - amt > 0) ledgers.get(lkey(t.to, t.asset))?.credit(t.value - amt, false)
        }
        collateral.push({ txId: tx.id, borrower: tx.signer, usd: got })
        continue
      }
    }
    const swapOuts = tx.transfers.filter((t) => isPool(t.from) && !isPool(t.to) && !isSourceCredit(tx, t))
    const swapTx = swapOuts.length > 0 && tx.transfers.some((t) => isPool(t.to) && !isPool(t.from))
    let swapInUsd = 0
    let swapTaintUsd = 0
    let swapHop = 0
    let touched = false
    for (const t of tx.transfers) {
      if (swapTx && isPool(t.from)) continue
      if (isSourceCredit(tx, t)) continue
      const from = ledgers.get(lkey(t.from, t.asset))
      const s = from ? from.debit(t.value) : 0
      if (swapTx && isPool(t.to)) {
        swapInUsd += usd(t.asset, t.value)
        if (s > 0) {
          swapTaintUsd += usd(t.asset, s)
          swapHop = Math.max(swapHop, from!.hop)
          markTx(tx, usd(t.asset, s))
        }
        continue
      }
      if (s > 0) {
        touched = true
        if (isBridgeContract(tx, t.to) && toBridge(tx, t.to, t.asset, s, from!.hop)) continue
        arrive(tx, t.to, t.asset, s, from!.hop + 1)
        const clean = t.value - s
        if (clean > 0) ledgers.get(lkey(t.to, t.asset))?.credit(clean, false)
      } else {
        ledgers.get(lkey(t.to, t.asset))?.credit(t.value, false)
      }
    }
    if (swapTx) {
      if (swapTaintUsd > 0) {
        touched = true
        const frac = method === 'poison' ? 1 : Math.min(1, swapTaintUsd / Math.max(swapInUsd, 1e-9))
        let gotUsd = 0
        for (const t of swapOuts) {
          const amt = t.value * frac
          gotUsd += usd(t.asset, amt)
          arrive(tx, t.to, t.asset, amt, swapHop + 1)
          // La part propre de la sortie rejoint aussi le solde du destinataire
          if (t.value - amt > 0) ledgers.get(lkey(t.to, t.asset))?.credit(t.value - amt, false)
        }
        if (method !== 'poison') lost.feesUsd += Math.max(0, swapTaintUsd - gotUsd)
      } else {
        for (const t of swapOuts) ledgers.get(lkey(t.to, t.asset))?.credit(t.value, false)
      }
    }
    if (touched) taintedTx++
  }

  // ── Soldes marqués restants ───────────────────────────────────────────────
  for (const [k, ta] of utxoTaint) {
    const tx = w.tx(k.slice(0, k.lastIndexOf(':')))
    const o = tx.outputs[Number(k.slice(k.lastIndexOf(':') + 1))]
    if (!o) continue
    add(node(o.address, ta.hop).held, CHAINS[tx.chain].native, ta.t)
  }
  for (const [k, l] of ledgers) {
    const t = l.tainted
    if (t <= 0) continue
    const [id, asset] = k.split('|') as [string, AssetId]
    add(node(id, l.hop).held, asset, t)
  }
  for (const p of pendingBridge.values()) lost.inTransitUsd += p.usd
  let heldUsd = 0
  for (const n of byAddress.values()) {
    n.heldUsd = amountsUsd(n.held)
    heldUsd += n.heldUsd
  }

  const stillHeld = [...byAddress.values()]
    .filter((n) => n.heldUsd >= minUsd && !serviceOf(n.id) && !isPool(n.id))
    .sort((a, b) => b.heldUsd - a.heldUsd)

  return {
    source, method, sourceUsd, sourceAmounts, byAddress, byTx,
    endpoints: [...endpoints.values()].sort((a, b) => b.usd - a.usd),
    stillHeld, heldUsd, lost, path: [...path], truncated, collateral,
  }
}

/** Répartition de la part marquée des entrées sur les sorties d'une transaction UTXO. */
function utxoShares(method: TraceMethod, segs: { v: number; t: number }[], outs: number[], tIn: number, inTotal: number): number[] {
  if (method === 'poison') return outs.slice()
  if (method === 'haircut') return outs.map((v) => (v * tIn) / inTotal)
  // FIFO / LIFO intra-transaction : les entrées, dans l'ordre (ou l'ordre inverse),
  // alimentent les sorties dans l'ordre ; les frais sont pris en dernier.
  const order = method === 'fifo' ? segs : [...segs].reverse()
  const shares = outs.map(() => 0)
  let i = 0
  let left = order[0]?.v ?? 0
  for (let j = 0; j < outs.length; j++) {
    let need = outs[j]
    while (need > 1e-12 && i < order.length) {
      const q = Math.min(need, left)
      const seg = order[i]
      if (seg.v > 0) shares[j] += (q * seg.t) / seg.v
      need -= q
      left -= q
      if (left <= 1e-12) {
        i++
        left = order[i]?.v ?? 0
      }
    }
  }
  return shares
}

/** Transaction où le signataire envoie un actif et en reçoit un autre (swap). */
function isSwap(tx: Tx): boolean {
  if (!tx.signer || tx.transfers.length < 2) return false
  const sent = new Set(tx.transfers.filter((t) => t.from === tx.signer).map((t) => t.asset))
  return tx.transfers.some((t) => t.to === tx.signer && !sent.has(t.asset)) && sent.size > 0
}

// ── Chemin entre deux adresses ───────────────────────────────────────────────

export interface FoundPath {
  addresses: string[]
  txIds: string[]
}

/** Plus court chemin (en sauts) de `from` vers `to`, en respectant la chronologie. */
export function findPath(w: World, from: string, to: string, maxDepth = 8): FoundPath | null {
  if (from === to) return { addresses: [from], txIds: [] }
  const isService = (id: string) => {
    const e = attribution(w, id).entity
    return !!e && !PASS.has(e.category)
  }
  const prev = new Map<string, { addr: string; txIds: string[] }>()
  const seen = new Map<string, number>([[from, -Infinity]])
  let frontier: { addr: string; time: number }[] = [{ addr: from, time: -Infinity }]
  let budget = 30000
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: { addr: string; time: number }[] = []
    for (const cur of frontier) {
      if (cur.addr !== from && isService(cur.addr)) continue
      for (const tx of w.txsOf(cur.addr)) {
        if (tx.time < cur.time || --budget < 0) continue
        for (const hop of successors(w, tx, cur.addr)) {
          const s = seen.get(hop.addr)
          if (s !== undefined && s <= hop.time) continue
          seen.set(hop.addr, hop.time)
          prev.set(hop.addr, { addr: cur.addr, txIds: hop.txIds })
          if (hop.addr === to) return rebuild(prev, from, to)
          next.push({ addr: hop.addr, time: hop.time })
        }
      }
    }
    frontier = next
  }
  return null
}

function successors(w: World, tx: Tx, id: string): { addr: string; time: number; txIds: string[] }[] {
  const out: { addr: string; time: number; txIds: string[] }[] = []
  if (tx.model === 'utxo') {
    if (!tx.inputs.some((i) => i.address === id)) return out
    for (const o of tx.outputs) if (o.address !== id) out.push({ addr: o.address, time: tx.time, txIds: [tx.id] })
  } else if (tx.signer === id && isSwap(tx)) {
    for (const t of tx.transfers) {
      if (t.from !== id && !POOL_TYPES.has(w.get(t.to).contract?.type ?? '')) out.push({ addr: t.to, time: tx.time, txIds: [tx.id] })
    }
  } else {
    for (const t of tx.transfers) if (t.from === id && t.to !== id) out.push({ addr: t.to, time: tx.time, txIds: [tx.id] })
  }
  if (tx.bridge?.direction === 'out' && tx.bridge.otherTx && (tx.signer === id || tx.inputs.some((i) => i.address === id) || tx.transfers.some((t) => t.from === id))) {
    const other = w.txs.get(tx.bridge.otherTx)
    const r = tx.bridge.recipient
    if (other && r && w.visible(other)) out.push({ addr: r, time: other.time, txIds: [tx.id, other.id] })
  }
  return out
}

function rebuild(prev: Map<string, { addr: string; txIds: string[] }>, from: string, to: string): FoundPath {
  const addresses = [to]
  const txIds: string[] = []
  let cur = to
  while (cur !== from) {
    const p = prev.get(cur)!
    txIds.unshift(...p.txIds)
    addresses.unshift(p.addr)
    cur = p.addr
  }
  return { addresses, txIds }
}

// ── Premier financement ──────────────────────────────────────────────────────

export interface FundingStep {
  /** Adresse financée. */
  address: string
  /** Adresse qui l'a financée. */
  funder: string
  txId: string
  asset: AssetId
  value: number
  time: number
  /** Le financement est arrivé par un bridge (le financeur est l'émetteur côté source). */
  viaBridge?: boolean
  /** Entité connue du financeur : la remontée s'arrête là. */
  entity?: Entity
}

/** Remonte la chaîne des premiers financements jusqu'à une entité connue. */
export function fundingTree(w: World, id: string, depth = 5): FundingStep[] {
  const steps: FundingStep[] = []
  const seen = new Set<string>([id])
  let cur = id
  for (let i = 0; i < depth; i++) {
    const first = w.txsOf(cur).find((tx) => w.flowIn(tx, cur).length && !w.flowOut(tx, cur).length)
    if (!first) break
    let funder = first.model === 'utxo' ? first.inputs[0]?.address : first.transfers.find((t) => t.to === cur)?.from
    let viaBridge = false
    if (first.bridge?.direction === 'in' && first.bridge.otherTx) {
      const other = w.txs.get(first.bridge.otherTx)
      const origin = other && w.visible(other) ? (other.model === 'utxo' ? other.inputs[0]?.address : other.signer ?? other.transfers[0]?.from) : undefined
      if (origin) {
        funder = origin
        viaBridge = true
      }
    }
    if (!funder || seen.has(funder)) break
    seen.add(funder)
    const f = w.flowIn(first, cur)[0]
    const e = attribution(w, funder).entity
    const entity = e && !PASS.has(e.category) ? e : undefined
    steps.push({ address: cur, funder, txId: first.id, asset: f.asset, value: f.value, time: first.time, viaBridge, entity })
    if (entity) break
    cur = funder
  }
  return steps
}
