// Densité du graphe : le bruit ajouté ne doit modifier ni l'historique des
// adresses non attribuées du flux (auteurs, victimes, intermédiaires) ni les
// réponses des objectifs. Lancer : npx tsx scripts/check-noise.ts
import { ALL_SCENARIOS } from '../src/scenarios'
import { addNoise } from '../src/engine/noise'
import { attribution } from '../src/engine/analysis'

let failed = 0
let checked = 0
for (const s of ALL_SCENARIOS) {
  for (const seed of [1, 42]) {
    const inst = s.generate(seed)
    const w = inst.world
    const before = w.txs.size
    const watch = new Set<string>()
    for (const id of inst.truth.path) {
      const tx = w.txs.get(id)
      if (!tx) continue
      for (const a of [...tx.inputs.map((x) => x.address), ...tx.outputs.map((x) => x.address), ...tx.transfers.flatMap((x) => [x.from, x.to])]) {
        if (!attribution(w, a).entity) watch.add(a)
      }
    }
    for (const a of inst.truth.addresses) watch.add(a)
    const snap = new Map([...watch].filter((a) => w.addresses.has(a)).map((a) => [a, w.txsOf(a).length]))
    addNoise(inst, 'extreme')
    const changed = [...snap].filter(([a, n]) => w.txsOf(a).length !== n && !attribution(w, a).entity && !w.get(a).tags.includes('deposit') && !w.get(a).tags.includes('hot') && !w.get(a).contract)
    checked++
    if (changed.length) {
      failed++
      console.log(`ÉCHEC ${s.id} seed=${seed} : ${changed.length} adresse(s) du flux modifiée(s) (${changed.slice(0, 3).map(([a]) => w.get(a).addr.slice(0, 12)).join(', ')})`)
    } else console.log(`ok    ${s.id.padEnd(26)} seed=${String(seed).padEnd(3)} +${w.txs.size - before} tx de bruit`)
  }
}
console.log(`\n${checked - failed}/${checked} affaires sans effet du bruit sur le flux`)
process.exit(failed ? 1 : 0)
