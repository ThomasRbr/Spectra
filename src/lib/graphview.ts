// Modèle d'affichage du graphe d'enquête : à partir de ce qui est révélé,
// construit ce qu'on dessine vraiment. Groupes repliés (cluster, clé de
// staking, service, sélection), agrégats de contreparties « +N », swaps
// condensés en une arête de conversion, arêtes typées (valeur, interne, mint,
// burn, autorisation, bridge, corrélation). Fournit aussi les trois mises en
// page : couches, chronologique et couloirs par chaîne.
import { CHAINS, fmtAsset, usd, type AssetId, type ChainId } from '../engine/chains'
import type { EntityCategory } from '../engine/entities'
import type { Tx, World } from '../engine/world'
import { attribution } from '../engine/analysis'
import { callOf, isNull, legKind } from '../engine/evm'
import type { GraphOptions, Lane, LayoutMode, ViewGraph } from '../store/graph'
import { aKey, extraLinks, freeSpot, layeredLayout, tKey, type Pos } from './graph'

export type DNodeKind = 'addr' | 'tx' | 'group' | 'agg'

export interface DNode {
  key: string
  kind: DNodeKind
  /** Adresse ou transaction représentée (nœuds addr / tx). */
  id?: string
  /** Adresses réunies (groupe, agrégat). */
  members?: string[]
  /** Groupe : origine et identifiant (manuel `g…` ou automatique `auto:<entité>`). */
  groupId?: string
  groupKind?: 'cluster' | 'stake' | 'entity' | 'manual' | 'auto'
  groupLabel?: string
  /** Agrégat : adresse dont ce sont les contreparties, et sens. */
  aggOf?: string
  aggDir?: 'in' | 'out'
  /** Groupe déplié qui contient ce nœud (nœud composé). */
  parent?: string
  pos: Pos
  /** Premier instant où le nœud intervient dans ce qui est affiché. */
  time: number
  chain: ChainId
}

export type DEdgeKind = 'transfer' | 'io' | 'internal' | 'mint' | 'burn' | 'swap' | 'approval' | 'bridge' | 'corr'

export interface DEdge {
  id: string
  source: string
  target: string
  kind: DEdgeKind
  asset?: AssetId
  value: number
  usd: number
  count: number
  txIds: string[]
  time: number
  label?: string
  linkId?: string
}

export interface DParent {
  key: string
  label: string
  groupId: string
  members: string[]
}

export interface Display {
  nodes: DNode[]
  edges: DEdge[]
  parents: DParent[]
  /** Clé affichée de chaque adresse visible (elle-même, son groupe replié ou son agrégat). */
  shownAs: Map<string, string>
  hiddenConverters: number
  aggregated: number
}

export interface DisplayInput {
  w: World
  addrPos: Record<string, Pos>
  txPos: Record<string, Pos>
  revealed: Record<string, true>
  links: { id: string; source: string; target: string; label: string; txId?: string }[]
  view: ViewGraph
  opts: GraphOptions
  /** Adresses à ne jamais masquer ni agréger (marquées, sources, surveillées, sélection, traçage…). */
  keep: Set<string>
}

const CONVERTERS = new Set(['pool', 'router', 'aggregator', 'wrapper', 'lending'])
const PASS = new Set<EntityCategory>(['individual', 'suspect', 'victim'])
const AGG_MIN = 6

function compact(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e4) return `${(v / 1e3).toFixed(1)}k`
  if (v >= 100) return v.toFixed(0)
  if (v >= 1) return v.toFixed(2)
  return v.toPrecision(3)
}

export function isConverter(w: World, id: string): boolean {
  const a = w.get(id)
  return CONVERTERS.has(a.contract?.type ?? '') || isNull(w, id)
}

const APPROVAL_SIGS = new Set(['approve(address,uint256)', 'setApprovalForAll(address,bool)', 'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)'])

export function buildDisplay(inp: DisplayInput): Display {
  const { w, addrPos, txPos, revealed, view, opts, keep } = inp
  const A = new Set(Object.keys(addrPos).filter((id) => w.addresses.has(id)))
  const raw: DEdge[] = []
  const firstTime = new Map<string, number>()
  const seen = (id: string, t: number) => firstTime.set(id, Math.min(firstTime.get(id) ?? Infinity, t))
  const removedTx = new Set<string>()
  const hidden = new Set<string>()

  // ── Arêtes brutes ────────────────────────────────────────────────────────
  for (const txId of Object.keys(revealed)) {
    const tx = w.txs.get(txId)
    if (!tx || !w.visible(tx)) continue
    if (tx.model === 'utxo') {
      if (!txPos[txId]) continue
      const native = CHAINS[tx.chain].native
      const tk = tKey(txId)
      for (const i of tx.inputs) if (A.has(i.address)) {
        raw.push(edge(aKey(i.address), tk, 'io', native, i.value, tx))
        seen(i.address, tx.time)
      }
      for (const o of tx.outputs) if (A.has(o.address)) {
        raw.push(edge(tk, aKey(o.address), 'io', native, o.value, tx))
        seen(o.address, tx.time)
      }
      continue
    }
    // Swap condensé : l'actif entre dans des contrats de conversion et en ressort
    if (opts.collapseSwaps && tx.signer) {
      const ins = tx.transfers.filter((t) => !isConverter(w, t.from) && isConverter(w, t.to))
      const outs = tx.transfers.filter((t) => isConverter(w, t.from) && !isConverter(w, t.to))
      if (ins.length && outs.length) {
        const trader = ins[0].from
        const inUsd = ins.reduce((s, t) => s + usd(t.asset, t.value), 0)
        for (const o of outs) {
          if (!A.has(trader) || !A.has(o.to)) continue
          // Tout ce qui entre (ajout de liquidité : les deux actifs) → ce qui ressort vers ce destinataire
          const label = `${ins.slice(0, 3).map((x) => `${compact(x.value)} ${x.asset}`).join(' + ')} → ${compact(o.value)} ${o.asset}`
          raw.push({ ...edge(aKey(trader), aKey(o.to), 'swap', o.asset, o.value, tx), usd: Math.max(usd(o.asset, o.value), outs.length === 1 ? inUsd : 0), label })
          seen(trader, tx.time)
          seen(o.to, tx.time)
        }
        removedTx.add(tx.id)
        continue
      }
    }
    for (const t of tx.transfers) {
      if (!A.has(t.from) || !A.has(t.to) || t.from === t.to) continue
      const k = legKind(w, tx, t)
      const kind: DEdgeKind = k === 'internal' ? 'internal' : k === 'mint' ? 'mint' : k === 'burn' ? 'burn' : 'transfer'
      raw.push(edge(aKey(t.from), aKey(t.to), kind, t.asset, t.value, tx))
      seen(t.from, tx.time)
      seen(t.to, tx.time)
    }
  }

  // Autorisations (approve, permit, setApprovalForAll) entre deux adresses affichées
  for (const id of A) {
    for (const tx of w.txsOf(id)) {
      const c = tx.call
      if (!c || !APPROVAL_SIGS.has(c.sig)) continue
      const owner = c.sig.startsWith('permit(') ? ('addr' in c.args[0] ? c.args[0].addr : '') : tx.signer
      const spender = c.sig.startsWith('permit(') ? ('addr' in c.args[1] ? c.args[1].addr : '') : 'addr' in c.args[0] ? c.args[0].addr : ''
      if (!owner || owner !== id || !A.has(spender)) continue
      const amount = c.args[c.sig.startsWith('permit(') ? 2 : 1]
      const unlimited = !!amount && 'uint' in amount && String(amount.uint).length > 60
      const token = w.get(c.to).label?.split(' ')[0] ?? 'jeton'
      raw.push({ ...edge(aKey(owner), aKey(spender), 'approval', undefined, 0, tx), label: c.sig.startsWith('setApprovalForAll') ? 'autorisation : toute la collection' : `autorisation ${token}${unlimited ? ' illimitée' : ''}` })
    }
  }

  // Bridges et corrélations manuelles
  for (const x of extraLinks(w, addrPos, revealed, inp.links)) {
    const t0 = Math.min(...x.txIds.map((t) => w.txs.get(t)?.time ?? Infinity))
    raw.push({ id: x.id, source: x.source, target: x.target, kind: x.kind, value: 0, usd: 0, count: 1, txIds: x.txIds, time: Number.isFinite(t0) ? t0 : 0, label: x.label, linkId: x.linkId })
  }

  // Contrats de conversion qui ne servaient qu'aux swaps condensés : masqués
  if (opts.collapseSwaps) {
    const used = new Set(raw.flatMap((e) => [e.source, e.target]))
    for (const id of A) {
      if (!isConverter(w, id) || keep.has(id) || used.has(aKey(id))) continue
      const onlySwaps = w.txsOf(id).every((t) => !revealed[t.id] || removedTx.has(t.id))
      if (onlySwaps || isNull(w, id)) hidden.add(id)
    }
  }

  // ── Groupes ──────────────────────────────────────────────────────────────
  const shownAs = new Map<string, string>()
  for (const id of A) if (!hidden.has(id)) shownAs.set(id, aKey(id))
  const groupNodes: DNode[] = []
  const parents: DParent[] = []
  const parentOf = new Map<string, string>()
  const inGroup = new Set<string>()
  const addGroup = (gid: string, kind: DNode['groupKind'], label: string, members: string[], collapsed: boolean) => {
    const mem = members.filter((m) => shownAs.has(m) && !inGroup.has(m))
    if (mem.length < 2) return
    mem.forEach((m) => inGroup.add(m))
    if (collapsed) {
      const key = `g:${gid}`
      const pos = view.groupPos[key] ?? centroid(mem.map((m) => addrPos[m]))
      groupNodes.push({ key, kind: 'group', members: mem, groupId: gid, groupKind: kind, groupLabel: label, pos, time: Math.min(...mem.map((m) => firstTime.get(m) ?? Infinity)), chain: w.get(mem[0]).chain })
      mem.forEach((m) => shownAs.set(m, key))
    } else {
      const key = `p:${gid}`
      parents.push({ key, label, groupId: gid, members: mem })
      mem.forEach((m) => parentOf.set(m, key))
    }
  }
  for (const g of view.groups) addGroup(g.id, g.kind, g.label, g.members, g.collapsed)
  if (opts.autoGroupServices) {
    const byEntity = new Map<string, string[]>()
    for (const id of shownAs.keys()) {
      if (keep.has(id) || inGroup.has(id)) continue
      const e = attribution(w, id).entity
      if (!e || PASS.has(e.category)) continue
      byEntity.set(e.id, [...(byEntity.get(e.id) ?? []), id])
    }
    for (const [eid, ids] of byEntity) {
      if (ids.length < 3) continue
      const gid = `auto:${eid}`
      addGroup(gid, 'auto', w.entities.get(eid)?.name ?? eid, ids, !view.expanded[`g:${gid}`])
    }
  }

  // ── Remappage des arêtes ─────────────────────────────────────────────────
  const mapKey = (k: string) => (k.startsWith('a:') ? shownAs.get(k.slice(2)) ?? null : k)
  let edges = mergeEdges(raw.map((e) => {
    const s = mapKey(e.source)
    const t = mapKey(e.target)
    if (!s || !t) return null
    if (s === t && e.kind !== 'swap') return null
    return { ...e, source: s, target: t }
  }).filter((e): e is DEdge => !!e))

  // ── Agrégats de contreparties « +N » ─────────────────────────────────────
  let aggregated = 0
  const aggNodes: DNode[] = []
  if (opts.aggregate) {
    const adj = new Map<string, DEdge[]>()
    for (const e of edges) {
      adj.set(e.source, [...(adj.get(e.source) ?? []), e])
      if (e.target !== e.source) adj.set(e.target, [...(adj.get(e.target) ?? []), e])
    }
    const leafy = (key: string) => {
      if (!key.startsWith('a:')) return false
      const id = key.slice(2)
      const a = w.get(id)
      return !keep.has(id) && !a.contract && !attribution(w, id).entity && !parentOf.has(id)
    }
    // Feuille : une seule arête, vers le pivot directement ou via une transaction qui ne touche que le pivot
    const buckets = new Map<string, { pivot: string; dir: 'in' | 'out'; leaves: string[]; txs: Set<string> }>()
    for (const [key, es] of adj) {
      if (!leafy(key) || es.length !== 1) continue
      const e = es[0]
      const other = e.source === key ? e.target : e.source
      const dir: 'in' | 'out' = e.source === key ? 'in' : 'out'
      let pivot = other
      let viaTx: string | undefined
      if (other.startsWith('t:')) {
        const ends = (adj.get(other) ?? []).map((x) => (x.source === other ? x.target : x.source)).filter((k) => k !== key)
        const pivots = [...new Set(ends.filter((k) => !leafy(k) || (adj.get(k)?.length ?? 0) > 1))]
        if (pivots.length !== 1) continue
        pivot = pivots[0]
        viaTx = other
      }
      if (pivot.startsWith('t:')) continue
      const bk = `${pivot}|${dir}`
      const b = buckets.get(bk) ?? { pivot, dir, leaves: [], txs: new Set<string>() }
      b.leaves.push(key)
      if (viaTx) b.txs.add(viaTx)
      buckets.set(bk, b)
    }
    const remap = new Map<string, string>()
    const dropTx = new Set<string>()
    for (const b of buckets.values()) {
      const key = `n:${b.pivot}:${b.dir}`
      if (b.leaves.length < AGG_MIN || view.expanded[key]) continue
      const members = b.leaves.map((l) => l.slice(2))
      aggregated += members.length
      const pos = view.groupPos[key] ?? centroid(members.map((m) => addrPos[m]))
      aggNodes.push({ key, kind: 'agg', members, aggOf: b.pivot, aggDir: b.dir, pos, time: Math.min(...members.map((m) => firstTime.get(m) ?? Infinity)), chain: w.get(members[0]).chain })
      for (const l of b.leaves) {
        remap.set(l, key)
        shownAs.set(l.slice(2), key)
      }
      // Transactions UTXO qui ne relient plus que le pivot et l'agrégat : remplacées par une arête directe
      for (const t of b.txs) {
        const ends = (adj.get(t) ?? []).map((x) => (x.source === t ? x.target : x.source))
        if (ends.every((k) => k === b.pivot || remap.get(k) === key || b.leaves.includes(k))) dropTx.add(t)
      }
    }
    if (remap.size) {
      const next: DEdge[] = []
      for (const e of edges) {
        const s = remap.get(e.source) ?? e.source
        const t = remap.get(e.target) ?? e.target
        if (dropTx.has(s) || dropTx.has(t)) {
          // Arête pivot ↔ transaction supprimée ↔ agrégat : on garde le côté agrégat, rattaché au pivot
          const txKey = dropTx.has(s) ? s : t
          const far = dropTx.has(s) ? t : s
          if (far.startsWith('n:')) {
            const piv = aggNodes.find((n) => n.key === far)!.aggOf!
            next.push({ ...e, id: `${e.id}~`, source: e.source === txKey ? piv : far, target: e.source === txKey ? far : piv, kind: 'transfer' })
          }
          continue
        }
        next.push({ ...e, source: s, target: t })
      }
      edges = mergeEdges(next)
    }
  }

  // Plusieurs conversions sur la même adresse : une seule boucle, une ligne par conversion
  const loops = new Map<string, DEdge[]>()
  for (const e of edges) if (e.kind === 'swap' && e.source === e.target) loops.set(e.source, [...(loops.get(e.source) ?? []), e])
  for (const [k, ls] of loops) {
    if (ls.length < 2) continue
    const merged: DEdge = {
      ...ls[0], id: `${k}>loop|swap`, usd: ls.reduce((s, e) => s + e.usd, 0), txIds: [...new Set(ls.flatMap((e) => e.txIds))], time: Math.min(...ls.map((e) => e.time)),
      label: [...ls].sort((a, b) => a.time - b.time).slice(0, 4).map((e) => e.label + (e.count > 1 ? ` ×${e.count}` : '')).join('\n') + (ls.length > 4 ? `\n+${ls.length - 4} autres` : ''),
    }
    merged.count = merged.txIds.length
    edges = [...edges.filter((e) => !ls.includes(e)), merged]
  }

  // ── Nœuds ────────────────────────────────────────────────────────────────
  const nodes: DNode[] = []
  for (const id of A) {
    if (shownAs.get(id) !== aKey(id)) continue
    nodes.push({ key: aKey(id), kind: 'addr', id, pos: addrPos[id], time: firstTime.get(id) ?? (w.txsOf(id)[0]?.time ?? 0), chain: w.get(id).chain, parent: parentOf.get(id) })
  }
  const linked = new Set(edges.flatMap((e) => [e.source, e.target]))
  for (const [txId, p] of Object.entries(txPos)) {
    const key = tKey(txId)
    const tx = w.txs.get(txId)
    if (!tx || !linked.has(key)) continue
    nodes.push({ key, kind: 'tx', id: txId, pos: p, time: tx.time, chain: tx.chain })
  }
  nodes.push(...groupNodes, ...aggNodes)
  for (const n of nodes) if (!Number.isFinite(n.time)) n.time = 0
  return { nodes, edges, parents, shownAs, hiddenConverters: hidden.size, aggregated }
}

function edge(source: string, target: string, kind: DEdgeKind, asset: AssetId | undefined, value: number, tx: Tx): DEdge {
  return { id: `${source}>${target}|${asset ?? ''}|${kind}`, source, target, kind, asset, value, usd: asset ? usd(asset, value) : 0, count: 1, txIds: [tx.id], time: tx.time }
}

function mergeEdges(list: DEdge[]): DEdge[] {
  const m = new Map<string, DEdge>()
  for (const e of list) {
    const id = e.kind === 'bridge' || e.kind === 'corr' ? e.id : `${e.source}>${e.target}|${e.asset ?? ''}|${e.kind}${e.kind === 'swap' ? `|${e.label}` : ''}`
    const cur = m.get(id)
    if (!cur) {
      m.set(id, { ...e, id, txIds: [...e.txIds] })
      continue
    }
    cur.value += e.value
    cur.usd += e.usd
    for (const t of e.txIds) if (!cur.txIds.includes(t)) cur.txIds.push(t)
    cur.count = cur.txIds.length
    cur.time = Math.min(cur.time, e.time)
  }
  return [...m.values()]
}

function centroid(ps: (Pos | undefined)[]): Pos {
  const xs = ps.filter((p): p is Pos => !!p)
  if (!xs.length) return { x: 0, y: 0 }
  return { x: xs.reduce((s, p) => s + p.x, 0) / xs.length, y: xs.reduce((s, p) => s + p.y, 0) / xs.length }
}

/** Libellé lisible d'une arête (montant, nature). */
export function edgeLabel(e: DEdge): string {
  if (e.kind === 'io') return ''
  if (e.label && (e.kind === 'swap' || e.kind === 'approval' || e.kind === 'bridge' || e.kind === 'corr')) return e.label + (e.kind === 'swap' && e.count > 1 && !e.label.includes('\n') ? ` ×${e.count}` : '')
  const amount = e.asset ? `${compact(e.value)} ${e.asset}` : ''
  const prefix = e.kind === 'internal' ? 'interne · ' : e.kind === 'mint' ? 'mint · ' : e.kind === 'burn' ? 'burn · ' : ''
  return `${prefix}${amount}${e.count > 1 ? ` ×${e.count}` : ''}`
}

export function edgeTitle(e: DEdge): string {
  return e.asset ? fmtAsset(e.value, e.asset) : e.label ?? ''
}

// ── Mises en page ─────────────────────────────────────────────────────────────

export interface LayoutResult {
  pos: Record<string, Pos>
  lanes: Lane[]
  timeAxis: { t0: number; t1: number; x0: number; x1: number } | null
}

/** Nœuds placés par la mise en page (les groupes dépliés sont des cadres calculés). */
export function layoutDisplay(d: Display, mode: LayoutMode, pinned: Record<string, true>, only?: Set<string>): LayoutResult {
  const nodes = d.nodes.filter((n) => !only || only.has(n.key))
  const keys = nodes.map((n) => n.key)
  const byKey = new Map(nodes.map((n) => [n.key, n]))
  const edges = d.edges.filter((e) => e.source !== e.target && byKey.has(e.source) && byKey.has(e.target))
  let res: LayoutResult
  if (mode === 'layers') {
    res = { pos: layeredLayout(keys, edges, (k) => byKey.get(k)!.time), lanes: [], timeAxis: null }
  } else {
    res = timeLayout(nodes, edges, mode === 'lanes')
  }
  // Une sous-sélection garde son centre de gravité ; les nœuds épinglés ne bougent pas
  if (only) {
    const before = centroid(nodes.map((n) => n.pos))
    const after = centroid(Object.values(res.pos))
    for (const k of Object.keys(res.pos)) res.pos[k] = { x: res.pos[k].x - after.x + before.x, y: res.pos[k].y - after.y + before.y }
    res.lanes = []
    res.timeAxis = null
  }
  for (const n of nodes) if (pinned[n.key]) res.pos[n.key] = n.pos
  return res
}

const LANE_COLORS: Partial<Record<ChainId, string>> = {}

function timeLayout(nodes: DNode[], edges: DEdge[], lanes: boolean): LayoutResult {
  const times = nodes.map((n) => n.time).filter((t) => t > 0)
  const t0 = times.length ? Math.min(...times) : 0
  const t1 = times.length ? Math.max(...times) : t0 + 3600
  const span = Math.max(3600, t1 - t0)
  const width = Math.max(900, Math.min(7000, nodes.length * 70))
  const x0 = 0
  const xOf = (t: number) => x0 + ((Math.max(t, t0) - t0) / span) * width
  const preds = new Map<string, string[]>()
  for (const e of edges) preds.set(e.target, [...(preds.get(e.target) ?? []), e.source])
  const order = [...nodes].sort((a, b) => a.time - b.time || (a.kind === 'tx' ? -1 : 1))
  const pos: Record<string, Pos> = {}
  const laneOf = (n: DNode) => (lanes ? n.chain : 'all')
  const laneKeys = [...new Set(order.map(laneOf))]
  const local: Record<string, Record<string, Pos>> = {}
  for (const lk of laneKeys) local[lk] = {}
  for (const n of order) {
    const lk = laneOf(n)
    const placed = local[lk]
    const ps = (preds.get(n.key) ?? []).map((p) => placed[p] ?? pos[p]).filter((p): p is Pos => !!p)
    const desiredY = ps.length ? ps.reduce((s, p) => s + p.y, 0) / ps.length : 0
    const spot = freeSpot({ x: xOf(n.time), y: desiredY }, Object.values(placed), n.kind === 'tx' ? 52 : 74)
    placed[n.key] = spot
    pos[n.key] = spot
  }
  const resultLanes: Lane[] = []
  if (lanes) {
    let offset = 0
    for (const lk of laneKeys) {
      const ps = Object.values(local[lk])
      const minY = Math.min(...ps.map((p) => p.y))
      const maxY = Math.max(...ps.map((p) => p.y))
      const shift = offset - minY + 70
      for (const [k, p] of Object.entries(local[lk])) pos[k] = { x: p.x, y: p.y + shift }
      const chain = lk as ChainId
      resultLanes.push({ label: CHAINS[chain].name, color: LANE_COLORS[chain] ?? CHAINS[chain].color, y0: offset, y1: offset + (maxY - minY) + 140 })
      offset += maxY - minY + 140 + 40
    }
  } else {
    // Recentrage vertical autour de 0
    const ys = Object.values(pos).map((p) => p.y)
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2
    for (const k of Object.keys(pos)) pos[k] = { x: pos[k].x, y: pos[k].y - mid }
  }
  return { pos, lanes: resultLanes, timeAxis: { t0, t1: t0 + span, x0, x1: x0 + width } }
}

/** Graduations « lisibles » d'un axe de temps (heures, jours, semaines). */
export function timeTicks(t0: number, t1: number, max = 8): number[] {
  const span = t1 - t0
  const steps = [600, 1800, 3600, 3 * 3600, 6 * 3600, 12 * 3600, 86400, 2 * 86400, 7 * 86400, 14 * 86400, 30 * 86400, 90 * 86400]
  const step = steps.find((s) => span / s <= max) ?? steps[steps.length - 1]
  const out: number[] = []
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) out.push(t)
  return out
}
