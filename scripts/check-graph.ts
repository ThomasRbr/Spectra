// Graphe affiché : modèle d'affichage (groupes, agrégats, swaps condensés,
// arêtes typées) et mises en page (couches, chronologique, couloirs) sur toutes
// les affaires, toutes options. Aucune exception, aucune position invalide,
// aucune arête vers un nœud absent. Lancer : npx tsx scripts/check-graph.ts
import { ALL_SCENARIOS } from '../src/scenarios'
import { buildDisplay, layoutDisplay, type Display } from '../src/lib/graphview'
import { clusterOf } from '../src/engine/analysis'
import type { GraphOptions, ViewGraph } from '../src/store/graph'
import type { Pos } from '../src/lib/graph'

const base: GraphOptions = { mode: 'layers', labels: 'auto', sizeBy: 'none', collapseSwaps: true, aggregate: true, autoGroupServices: true, badges: true, minimap: true }
const variants: Partial<GraphOptions>[] = [{}, { collapseSwaps: false, aggregate: false, autoGroupServices: false }, { aggregate: false }, { collapseSwaps: false }]
let failed = 0
let runs = 0
const stats = { swaps: 0, groups: 0, aggs: 0, approvals: 0, internals: 0, parents: 0 }

function check(d: Display, label: string): string[] {
  const keys = new Set(d.nodes.map((n) => n.key))
  const problems: string[] = []
  for (const e of d.edges) if (!keys.has(e.source) || !keys.has(e.target)) problems.push(`${label} : arête ${e.kind} vers un nœud absent`)
  for (const n of d.nodes) if (!Number.isFinite(n.pos.x) || !Number.isFinite(n.pos.y)) problems.push(`${label} : position invalide ${n.key}`)
  return problems
}

for (const s of ALL_SCENARIOS) {
  const inst = s.generate(42)
  const w = inst.world
  // Graphe « exploré » : le flux réel, ses extrémités et leurs voisins directs
  const addrPos: Record<string, Pos> = {}
  const txPos: Record<string, Pos> = {}
  const revealed: Record<string, true> = {}
  let i = 0
  const place = (id: string) => {
    if (!addrPos[id]) addrPos[id] = { x: (i % 12) * 150, y: Math.floor(i / 12) * 110 + (i++ % 3) }
  }
  const reveal = (txId: string) => {
    const tx = w.txs.get(txId)
    if (!tx) return
    revealed[txId] = true
    if (tx.model === 'utxo') {
      txPos[txId] = { x: i * 10, y: i * 7 }
      tx.inputs.forEach((x) => place(x.address))
      tx.outputs.forEach((x) => place(x.address))
    } else tx.transfers.forEach((t) => {
      place(t.from)
      place(t.to)
    })
  }
  inst.truth.path.forEach(reveal)
  // Bruit : quelques transactions des services touchés, pour exercer l'agrégation
  for (const id of Object.keys(addrPos).slice(0, 30)) for (const tx of w.txsOf(id).slice(0, 12)) reveal(tx.id)
  const someUtxo = Object.keys(addrPos).find((a) => clusterOf(w, a).filter((m) => addrPos[m]).length >= 2)
  const view: ViewGraph = {
    groups: someUtxo ? [{ id: 'gtest', label: 'Test', kind: 'cluster', members: clusterOf(w, someUtxo).filter((m) => addrPos[m]), collapsed: true }] : [],
    annotations: [], pinned: {}, groupPos: {}, expanded: {},
  }
  const keep = new Set([...inst.seeds, ...inst.truth.addresses])
  for (const v of variants) {
    for (const collapsed of [true, false]) {
      if (view.groups[0]) view.groups[0].collapsed = collapsed
      const opts = { ...base, ...v }
      runs++
      try {
        const d = buildDisplay({ w, addrPos, txPos, revealed, links: [], view, opts, keep })
        const problems = check(d, `${s.id} ${JSON.stringify(v)}`)
        for (const mode of ['layers', 'time', 'lanes'] as const) {
          const r = layoutDisplay(d, mode, {})
          for (const [k, p] of Object.entries(r.pos)) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) problems.push(`${s.id} ${mode} : position calculée invalide ${k}`)
          if (Object.keys(r.pos).length !== d.nodes.length) problems.push(`${s.id} ${mode} : ${Object.keys(r.pos).length}/${d.nodes.length} nœuds placés`)
          if (mode === 'lanes' && !r.lanes.length && d.nodes.length) problems.push(`${s.id} : aucun couloir`)
        }
        if (v === variants[0] && collapsed) {
          stats.swaps += d.edges.filter((e) => e.kind === 'swap').length
          stats.groups += d.nodes.filter((n) => n.kind === 'group').length
          stats.aggs += d.nodes.filter((n) => n.kind === 'agg').length
          stats.approvals += d.edges.filter((e) => e.kind === 'approval').length
          stats.internals += d.edges.filter((e) => e.kind === 'internal').length
        }
        if (!collapsed) stats.parents += d.parents.length
        if (problems.length) {
          failed++
          console.log(problems.slice(0, 3).join('\n'))
        }
      } catch (e) {
        failed++
        console.log(`CRASH ${s.id} ${JSON.stringify(v)} : ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`)
      }
    }
  }
}
console.log(`${runs - failed}/${runs} constructions sans erreur · swaps condensés ${stats.swaps} · groupes repliés ${stats.groups} · cadres dépliés ${stats.parents} · agrégats ${stats.aggs} · autorisations ${stats.approvals} · transactions internes ${stats.internals}`)
process.exit(failed ? 1 : 0)
