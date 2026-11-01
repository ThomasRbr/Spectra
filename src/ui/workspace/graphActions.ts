// Actions sur le graphe affiché : construction du modèle d'affichage depuis les
// deux stores, réorganisation selon le mode choisi, groupes, agrégats,
// alignement et épingles.
import { useMemo } from 'react'
import { attribution, clusterOf } from '../../engine/analysis'
import { stakeSiblings } from '../../engine/cardano'
import { useGame, setRelayoutHook } from '../../store/game'
import { useGraph, type GraphGroup } from '../../store/graph'
import { useUi } from '../../store/ui'
import { buildDisplay, layoutDisplay, type Display } from '../../lib/graphview'
import { aKey, idOf, isAKey, type Pos } from '../../lib/graph'

type G = ReturnType<typeof useGame.getState>

/** Adresses qu'aucun regroupement automatique ne doit masquer. */
function keepSet(g: G): Set<string> {
  const keep = new Set<string>([...Object.keys(g.flags), ...(g.inst?.seeds ?? []), ...g.watch, ...g.multi])
  if (g.selection?.kind === 'address') keep.add(g.selection.id)
  if (g.trace) for (const [id, n] of g.trace.result.byAddress) if (n.receivedUsd > 0) keep.add(id)
  if (g.pathHighlight) for (const t of g.pathHighlight.txIds) {
    const tx = g.inst?.world.txs.get(t)
    tx?.transfers.forEach((x) => keep.add(x.to))
    tx?.outputs.forEach((x) => keep.add(x.address))
  }
  if (g.showTruth && g.inst) g.inst.truth.addresses.forEach((a) => keep.add(a))
  for (const f of g.freezes) keep.add(f.address)
  return keep
}

export function currentDisplay(): Display | null {
  const g = useGame.getState()
  const gr = useGraph.getState()
  if (!g.inst) return null
  return buildDisplay({ w: g.inst.world, addrPos: g.addrPos, txPos: g.txPos, revealed: g.revealed, links: g.links, view: gr.view(), opts: gr.opts, keep: keepSet(g) })
}

/** Modèle d'affichage réactif pour le canevas. */
export function useDisplay(): Display | null {
  const inst = useGame((s) => s.inst)
  const addrPos = useGame((s) => s.addrPos)
  const txPos = useGame((s) => s.txPos)
  const revealed = useGame((s) => s.revealed)
  const links = useGame((s) => s.links)
  const flags = useGame((s) => s.flags)
  const watch = useGame((s) => s.watch)
  const selection = useGame((s) => s.selection)
  const multi = useGame((s) => s.multi)
  const trace = useGame((s) => s.trace)
  const pathHl = useGame((s) => s.pathHighlight)
  const showTruth = useGame((s) => s.showTruth)
  const freezes = useGame((s) => s.freezes)
  const byView = useGraph((s) => s.byView)
  const viewId = useGraph((s) => s.viewId)
  const opts = useGraph((s) => s.opts)
  // La sélection n'entre dans le calcul que pour ne pas agréger l'adresse sélectionnée
  const selKey = selection?.kind === 'address' ? selection.id : ''
  return useMemo(() => {
    if (!inst) return null
    const g = useGame.getState()
    return buildDisplay({ w: inst.world, addrPos, txPos, revealed, links, view: useGraph.getState().view(), opts, keep: keepSet(g) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst, addrPos, txPos, revealed, links, flags, watch, selKey, multi, trace, pathHl, showTruth, freezes, byView, viewId, opts])
}

/** Réorganise le graphe affiché (tout, ou seulement `only`) selon le mode choisi. */
export function relayoutGraph(only?: Set<string>) {
  const d = currentDisplay()
  if (!d) return
  const gr = useGraph.getState()
  const res = layoutDisplay(d, gr.opts.mode, gr.view().pinned, only)
  const addrTx: Record<string, Pos> = {}
  const groups: Record<string, Pos> = {}
  for (const [k, p] of Object.entries(res.pos)) {
    if (k.startsWith('g:') || k.startsWith('n:')) groups[k] = p
    else addrTx[k] = p
  }
  // Membres d'un groupe replié ou d'un agrégat : rangés autour de leur nœud, pour un dépliage propre
  for (const n of d.nodes) {
    if ((n.kind === 'group' || n.kind === 'agg') && n.members && groups[n.key]) Object.assign(addrTx, ring(groups[n.key], n.members))
  }
  useGame.getState().setPositions(addrTx)
  if (Object.keys(groups).length) gr.setGroupPos(groups)
  if (!only) gr.setLayoutMeta(res.lanes, res.timeAxis)
  useGame.setState((s) => ({ layoutTick: s.layoutTick + 1 }))
}

setRelayoutHook(() => relayoutGraph())

/** Positions en couronne (ou en colonnes au-delà de 14) autour d'un centre. */
export function ring(c: Pos, members: string[]): Record<string, Pos> {
  const out: Record<string, Pos> = {}
  const n = members.length
  if (n <= 14) {
    const r = 70 + n * 9
    members.forEach((m, i) => {
      const a = (2 * Math.PI * i) / n - Math.PI / 2
      out[aKey(m)] = { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }
    })
  } else {
    const cols = Math.ceil(Math.sqrt(n))
    members.forEach((m, i) => {
      out[aKey(m)] = { x: c.x + ((i % cols) - (cols - 1) / 2) * 120, y: c.y + (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * 80 }
    })
  }
  return out
}

// ── Groupes ──────────────────────────────────────────────────────────────────

function onGraph(ids: string[]): string[] {
  const pos = useGame.getState().addrPos
  return ids.filter((id) => pos[id])
}

export function groupAddresses(members: string[], label: string, kind: GraphGroup['kind']): boolean {
  const mem = onGraph([...new Set(members)])
  if (mem.length < 2) {
    useUi.getState().notify('Il faut au moins deux adresses du graphe pour former un groupe.')
    return false
  }
  useGraph.getState().addGroup({ label, kind, members: mem, collapsed: true })
  useGame.getState().addLog(`Groupe « ${label} » : ${mem.length} adresses réunies`, 'graph')
  return true
}

export function groupCluster(id: string) {
  const g = useGame.getState()
  const w = g.inst?.world
  if (!w) return
  const a = w.get(id)
  const members = a.stake ? stakeSiblings(w, id) : clusterOf(w, id)
  const label = attribution(w, id).entity?.name ?? (a.stake ? `Clé de staking ${a.stake.slice(0, 12)}…` : 'Cluster (entrées communes)')
  groupAddresses(members, label, a.stake ? 'stake' : 'cluster')
}

export function groupEntity(id: string) {
  const g = useGame.getState()
  const w = g.inst?.world
  if (!w) return
  const e = attribution(w, id).entity
  if (!e) return
  const members = Object.keys(g.addrPos).filter((m) => attribution(w, m).entity?.id === e.id)
  groupAddresses(members, e.name, 'entity')
}

export function groupSelection() {
  const g = useGame.getState()
  const label = prompt('Nom du groupe', `Groupe de ${g.multi.length} adresses`)
  if (label === null) return
  groupAddresses(g.multi, label.trim() || `Groupe de ${g.multi.length} adresses`, 'manual')
}

/** Déplie ou replie un groupe (manuel ou automatique) ou un agrégat, en rangeant ses membres autour de lui. */
export function toggleGroupNode(key: string, members: string[], pos: Pos) {
  const gr = useGraph.getState()
  if (key.startsWith('n:') || key.startsWith('g:auto:')) gr.toggleExpanded(key)
  else {
    const gid = key.slice(2)
    const grp = gr.view().groups.find((x) => x.id === gid)
    if (grp) gr.updateGroup(gid, { collapsed: !grp.collapsed })
  }
  useGame.getState().setPositions(ring(pos, members))
}

/** Replie un groupe déplié (cadre composé `p:…`). */
export function collapseParent(parentKey: string) {
  const gid = parentKey.slice(2)
  const gr = useGraph.getState()
  if (gid.startsWith('auto:')) gr.toggleExpanded(`g:${gid}`, false)
  else gr.updateGroup(gid, { collapsed: true })
}

export function dissolveGroup(key: string) {
  const gid = key.replace(/^[gp]:/, '')
  const gr = useGraph.getState()
  if (gid.startsWith('auto:')) {
    gr.toggleExpanded(`g:${gid}`, true)
    useGraph.getState().setOpt('autoGroupServices', false)
    useUi.getState().notify('Regroupement automatique des services désactivé.')
    return
  }
  gr.removeGroup(gid)
}

// ── Alignement ───────────────────────────────────────────────────────────────

export function alignNodes(keys: string[], how: 'h' | 'v' | 'dh' | 'dv', positions: Record<string, Pos>) {
  const ps = keys.map((k) => ({ k, p: positions[k] })).filter((x) => !!x.p)
  if (ps.length < 2) return
  const out: Record<string, Pos> = {}
  if (how === 'h') {
    const y = ps.reduce((s, x) => s + x.p.y, 0) / ps.length
    ps.forEach((x) => (out[x.k] = { x: x.p.x, y }))
  } else if (how === 'v') {
    const x0 = ps.reduce((s, x) => s + x.p.x, 0) / ps.length
    ps.forEach((x) => (out[x.k] = { x: x0, y: x.p.y }))
  } else {
    const axis = how === 'dh' ? 'x' : 'y'
    const sorted = [...ps].sort((a, b) => a.p[axis] - b.p[axis])
    const lo = sorted[0].p[axis]
    const hi = sorted[sorted.length - 1].p[axis]
    const step = (hi - lo) / (sorted.length - 1 || 1)
    sorted.forEach((x, i) => (out[x.k] = axis === 'x' ? { x: lo + step * i, y: x.p.y } : { x: x.p.x, y: lo + step * i }))
  }
  const addrTx: Record<string, Pos> = {}
  const groups: Record<string, Pos> = {}
  for (const [k, p] of Object.entries(out)) (k.startsWith('g:') || k.startsWith('n:') ? groups : addrTx)[k] = p
  useGame.getState().setPositions(addrTx)
  if (Object.keys(groups).length) useGraph.getState().setGroupPos(groups)
}

export { isAKey, idOf }
