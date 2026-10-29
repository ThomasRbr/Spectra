// Vérifie le démixage et le mode temps réel sur toutes les missions.
// Démixage : le collecteur de retraits Tornado et la dépense post-mix attendus
// par les objectifs doivent ressortir. Temps réel : rien de postérieur à
// l'horloge n'est visible, et le traçage reste conservatif à mi-parcours.
// Usage : npx tsx scripts/check-lot3.ts [idScenario]
import { SCENARIOS } from '../src/scenarios/index'
import { demixCoinjoin, demixPool, poolDeposits } from '../src/engine/demix'
import { detectCoinjoin } from '../src/engine/analysis'
import { traceFunds } from '../src/engine/tracing'

const only = process.argv[2]
let failed = 0
const c = { poolHit: 0, poolTotal: 0, cjHit: 0, cjTotal: 0, live: 0 }
for (const s of SCENARIOS) {
  if (only && s.id !== only) continue
  for (const seed of [1, 42, 1337]) {
    const inst = s.generate(seed)
    const w = inst.world
    const answers = new Set(inst.objectives.flatMap((o) => ('answer' in o && Array.isArray(o.answer) ? o.answer.map(String) : [])))
    const problems: string[] = []

    // Tornado : un dépositaire du flux réel, un collecteur attendu parmi les réponses
    const depositors = [...new Set(inst.truth.addresses)].filter((a) => w.addresses.has(a) && poolDeposits(w, a).length >= 2)
    for (const d of depositors) {
      const r = demixPool(w, d)!
      const expected = r.groups.length && [...answers].some((a) => r.groups.some((g) => g.collector === a) || r.residue.includes(a))
      if (!expected) continue
      c.poolTotal++
      const top = r.groups[0]
      if (top?.collector && answers.has(top.collector) && top.linked) c.poolHit++
      else problems.push(`Tornado : collecteur attendu non classé premier (${r.groups.length} groupes)`)
    }

    // CoinJoin : une dépense post-mix rattachée qui figure dans les réponses
    for (const id of inst.truth.path) {
      const tx = w.txs.get(id)
      if (!tx || !detectCoinjoin(tx).is) continue
      const r = demixCoinjoin(w, id)!
      const ansTx = r.postMix.filter((p) => !p.remix && answers.has(p.txId))
      if (!ansTx.length) continue
      c.cjTotal++
      if (ansTx.some((p) => p.participant)) c.cjHit++
      else problems.push(`CoinJoin : dépense post-mix attendue non rattachée`)
    }

    // Temps réel : horloge à mi-chemin entre le premier fait et la fin
    const times = [...w.txs.values()].map((t) => t.time)
    const mid = Math.round((Math.min(...times) + Math.max(...times)) / 2)
    w.setHorizon(mid)
    for (const a of inst.seeds) if (w.txsOf(a).some((t) => t.time > mid)) problems.push('temps réel : transaction future visible')
    const srcTx = inst.truth.path.map((t) => w.txs.get(t)!).find((t) => t && t.time <= mid)
    if (srcTx) {
      const to = srcTx.model === 'utxo' ? srcTx.outputs[0].address : srcTx.transfers[0].to
      const r = traceFunds(w, { txId: srcTx.id, address: to, asset: srcTx.model === 'utxo' ? undefined : srcTx.transfers[0].asset, from: srcTx.model === 'utxo' ? undefined : srcTx.transfers[0].from }, { method: 'haircut' })
      const sum = r.endpoints.reduce((a, e) => a + e.usd, 0) + r.heldUsd + r.lost.belowThresholdUsd + r.lost.feesUsd + r.lost.depthUsd + r.lost.inTransitUsd
      if (r.sourceUsd > 0 && Math.abs(sum - r.sourceUsd) / r.sourceUsd > 0.01) problems.push(`temps réel : conservation ${(((sum - r.sourceUsd) / r.sourceUsd) * 100).toFixed(1)} %`)
      if (r.path.some((t) => w.tx(t).time > mid)) problems.push('temps réel : le traçage utilise une transaction future')
    }
    w.setHorizon(Infinity)
    c.live++

    if (problems.length) {
      failed++
      console.log(`ÉCHEC ${s.id.padEnd(26)} seed=${seed} ${problems.join(' ; ')}`)
    }
  }
}
console.log(`Tornado : collecteur attendu en tête ${c.poolHit}/${c.poolTotal}`)
console.log(`CoinJoin : dépense post-mix attendue rattachée ${c.cjHit}/${c.cjTotal}`)
console.log(`Temps réel : ${c.live - failed}/${c.live} générations sans fuite ni écart`)
process.exit(failed ? 1 : 0)
