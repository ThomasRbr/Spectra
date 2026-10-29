// Vérifie le moteur de traçage sur toutes les missions : conservation des
// montants, absence de valeurs aberrantes, cohérence entre méthodes, et
// présence de l'exchange attendu parmi les destinations.
// Usage : npx tsx scripts/check-tracing.ts [idScenario]
import { ALL_SCENARIOS as SCENARIOS } from '../src/scenarios/index'
import { findPath, fundingTree, traceFunds, type TraceMethod } from '../src/engine/tracing'
import type { World } from '../src/engine/world'
import { usd } from '../src/engine/chains'

const METHODS: TraceMethod[] = ['fifo', 'lifo', 'haircut', 'poison']
const only = process.argv[2]
let failed = 0
let entityHits = 0
let entityTotal = 0

/**
 * Source à tracer : parmi les premières transactions du flux réel, celle qui
 * crédite le plus (en USD) une adresse clé (le paiement de la victime plutôt
 * qu'un apport de gaz).
 */
function sourceOf(w: World, path: string[], keys: string[]): { txId: string; address: string } | null {
  const k = new Set(keys)
  let best: { txId: string; address: string; usd: number } | null = null
  for (const id of path.slice(0, 6)) {
    const tx = w.txs.get(id)
    if (!tx) continue
    const to = tx.model === 'utxo' ? tx.outputs.map((o) => o.address) : tx.transfers.map((t) => t.to)
    for (const a of new Set(to.filter((x) => k.has(x)))) {
      const v = w.flowIn(tx, a).reduce((s, f) => s + usd(f.asset, f.value), 0)
      if (!best || v > best.usd) best = { txId: id, address: a, usd: v }
    }
  }
  return best
}

for (const s of SCENARIOS) {
  if (only && s.id !== only) continue
  for (const seed of [1, 42, 1337]) {
    const problems: string[] = []
    const inst = s.generate(seed)
    const w = inst.world
    const src = sourceOf(w, inst.truth.path, inst.truth.addresses)
    if (!src) {
      console.log(`-     ${s.id.padEnd(26)} seed=${seed} (pas de source exploitable)`)
      continue
    }
    const t0 = Date.now()
    const res = Object.fromEntries(METHODS.map((m) => [m, traceFunds(w, src, { method: m })]))
    const ms = Date.now() - t0
    for (const m of METHODS) {
      const r = res[m]
      const ends = r.endpoints.reduce((a, e) => a + e.usd, 0)
      for (const v of [r.sourceUsd, ends, r.heldUsd, ...Object.values(r.lost)]) if (!Number.isFinite(v) || v < -1e-6) problems.push(`${m}: valeur invalide ${v}`)
      if (m !== 'poison' && r.sourceUsd > 0) {
        const sum = ends + r.heldUsd + r.lost.belowThresholdUsd + r.lost.feesUsd + r.lost.depthUsd + r.lost.inTransitUsd
        const gap = Math.abs(sum - r.sourceUsd) / r.sourceUsd
        if (gap > 0.01) problems.push(`${m}: conservation ${(gap * 100).toFixed(2)} % (source ${r.sourceUsd.toFixed(0)} $, retrouvé ${sum.toFixed(0)} $)`)
      }
    }
    const endsOf = (m: TraceMethod) => res[m].endpoints.reduce((a, e) => a + e.usd, 0) + res[m].heldUsd
    if (endsOf('poison') + 1 < endsOf('haircut')) problems.push('poison couvre moins que le prorata')

    const ent = inst.objectives.find((o) => o.type === 'entity')
    if (ent && ent.type === 'entity') {
      entityTotal++
      const found = METHODS.some((m) => res[m].endpoints.some((e) => ent.answer.includes(e.entity.id)))
      if (found) entityHits++
    }
    // Chemin vers chaque adresse clé atteinte par le traçage, et premier financement
    for (const a of inst.truth.addresses.slice(0, 3)) {
      if (a === src.address) continue
      const p = findPath(w, src.address, a, 10)
      if (p && p.txIds.some((t) => !w.txs.has(t))) problems.push('chemin : tx inconnue')
    }
    const f = fundingTree(w, src.address)
    if (f.some((x) => !w.txs.has(x.txId))) problems.push('financement : tx inconnue')

    const h = res.haircut
    const status = problems.length ? 'ÉCHEC' : 'ok'
    if (problems.length) failed++
    console.log(`${status.padEnd(5)} ${s.id.padEnd(26)} seed=${String(seed).padEnd(5)} source=${h.sourceUsd.toFixed(0).padStart(9)} $  services=${h.endpoints.length}  détenu=${h.stillHeld.length}  ${ms} ms`)
    for (const p of problems.slice(0, 4)) console.log('       - ' + p)
  }
}
console.log(`\nExchange de l'objectif « entité » retrouvé dans les destinations : ${entityHits}/${entityTotal}`)
process.exit(failed ? 1 : 0)
