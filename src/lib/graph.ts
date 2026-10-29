// Modèle du graphe d'enquête : quelles arêtes dessiner entre les nœuds
// visibles, placement incrémental et mise en page par couches.
import { CHAINS, type AssetId, usd } from '../engine/chains'
import type { World } from '../engine/world'

export interface Pos {
  x: number
  y: number
}

export const aKey = (id: string) => `a:${id}`
export const tKey = (id: string) => `t:${id}`
export const isAKey = (k: string) => k.startsWith('a:')
export const idOf = (k: string) => k.slice(2)

export interface GEdge {
  id: string
  source: string
  target: string
  asset: AssetId
  value: number
  usd: number
  count: number
  txIds: string[]
  /** Premier horodatage, pour la frise. */
  time: number
}

export function computeEdges(w: World, addrPos: Record<string, Pos>, txPos: Record<string, Pos>, revealed: Record<string, true>): GEdge[] {
  const edges = new Map<string, GEdge>()
  const push = (source: string, target: string, asset: AssetId, value: number, txId: string, time: number) => {
    const id = `${source}>${target}|${asset}`
    const e = edges.get(id)
    if (e) {
      e.value += value
      e.usd += usd(asset, value)
      if (!e.txIds.includes(txId)) {
        e.txIds.push(txId)
        e.count++
      }
      e.time = Math.min(e.time, time)
    } else {
      edges.set(id, { id, source, target, asset, value, usd: usd(asset, value), count: 1, txIds: [txId], time })
    }
  }
  for (const txId of Object.keys(revealed)) {
    const tx = w.txs.get(txId)
    if (!tx) continue
    if (tx.model === 'utxo') {
      if (!txPos[txId]) continue
      const native = CHAINS[tx.chain].native
      const tk = tKey(txId)
      for (const i of tx.inputs) if (addrPos[i.address]) push(aKey(i.address), tk, native, i.value, txId, tx.time)
      for (const o of tx.outputs) if (addrPos[o.address]) push(tk, aKey(o.address), native, o.value, txId, tx.time)
    } else {
      for (const t of tx.transfers) if (addrPos[t.from] && addrPos[t.to] && t.from !== t.to) push(aKey(t.from), aKey(t.to), t.asset, t.value, txId, tx.time)
    }
  }
  return [...edges.values()]
}

/** Trouve une position libre proche de `p` (décalage vertical). */
export function freeSpot(p: Pos, occupied: Pos[], minDist = 70): Pos {
  let cand = { ...p }
  for (let k = 0; k < 60; k++) {
    if (!occupied.some((o) => Math.abs(o.x - cand.x) < minDist * 1.6 && Math.abs(o.y - cand.y) < minDist)) return cand
    const step = Math.ceil((k + 1) / 2) * minDist * 1.05
    cand = { x: p.x, y: p.y + (k % 2 === 0 ? step : -step) }
  }
  return cand
}

/** Mise en page en couches de gauche à droite (sens des flux). */
export function layeredLayout(nodes: string[], edges: { source: string; target: string }[], time: (k: string) => number): Record<string, Pos> {
  const out = new Map<string, string[]>()
  const inn = new Map<string, string[]>()
  for (const n of nodes) {
    out.set(n, [])
    inn.set(n, [])
  }
  for (const e of edges) {
    if (!out.has(e.source) || !out.has(e.target)) continue
    out.get(e.source)!.push(e.target)
    inn.get(e.target)!.push(e.source)
  }
  // Rang = plus long chemin depuis une source (cycles ignorés)
  const rank = new Map<string, number>()
  const state = new Map<string, 0 | 1 | 2>()
  const visit = (n: string): number => {
    const st = state.get(n)
    if (st === 2) return rank.get(n)!
    if (st === 1) return 0
    state.set(n, 1)
    let r = 0
    for (const p of inn.get(n)!) r = Math.max(r, visit(p) + 1)
    state.set(n, 2)
    rank.set(n, r)
    return r
  }
  for (const n of nodes) visit(n)
  const layers = new Map<number, string[]>()
  for (const n of nodes) {
    const r = rank.get(n) ?? 0
    const l = layers.get(r) ?? []
    l.push(n)
    layers.set(r, l)
  }
  const pos: Record<string, Pos> = {}
  const keys = [...layers.keys()].sort((a, b) => a - b)
  let x = 0
  for (const r of keys) {
    const layer = layers.get(r)!
    const bary = (n: string) => {
      const ps = inn.get(n)!.filter((p) => pos[p])
      return ps.length ? ps.reduce((s, p) => s + pos[p].y, 0) / ps.length : time(n) / 1e5
    }
    layer.sort((a, b) => bary(a) - bary(b) || time(a) - time(b))
    const isTxLayer = layer.every((n) => n.startsWith('t:'))
    const gap = isTxLayer ? 70 : 96
    const h = (layer.length - 1) * gap
    layer.forEach((n, i) => (pos[n] = { x, y: i * gap - h / 2 }))
    x += isTxLayer ? 170 : 230
  }
  return pos
}

export interface XLink {
  id: string
  source: string
  target: string
  kind: 'bridge' | 'corr'
  label: string
  txIds: string[]
  linkId?: string
}

/**
 * Liens inter-chaînes : événements de bridge dont les deux transactions sont
 * affichées, et corrélations posées manuellement par l'enquêteur.
 */
export function extraLinks(w: World, addrPos: Record<string, Pos>, revealed: Record<string, true>, manual: { id: string; source: string; target: string; label: string; txId?: string }[]): XLink[] {
  const out: XLink[] = []
  for (const txId of Object.keys(revealed)) {
    const tx = w.txs.get(txId)
    if (!tx?.bridge || tx.bridge.direction !== 'out' || !tx.bridge.otherTx || !revealed[tx.bridge.otherTx]) continue
    const other = w.txs.get(tx.bridge.otherTx)
    // Côté UTXO (arrivée sur Bitcoin), la réserve du bridge est une entrée.
    const from = tx.transfers[0]?.to ?? tx.outputs[0]?.address
    const to = other?.transfers[0]?.from ?? other?.inputs[0]?.address
    if (!from || !to || !addrPos[from] || !addrPos[to]) continue
    out.push({ id: `x:${tx.id}`, source: aKey(from), target: aKey(to), kind: 'bridge', label: `bridge · nonce ${tx.bridge.nonce}`, txIds: [tx.id, other!.id] })
  }
  for (const l of manual) {
    if (!addrPos[l.source] || !addrPos[l.target]) continue
    out.push({ id: `c:${l.id}`, source: aKey(l.source), target: aKey(l.target), kind: 'corr', label: l.label, txIds: l.txId ? [l.txId] : [], linkId: l.id })
  }
  return out
}
