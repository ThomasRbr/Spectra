// Génère chaque scénario avec plusieurs graines et vérifie la cohérence.
// Usage : npx tsx scripts/check-scenarios.ts [idScenario | chemin/vers/scenario.ts]
// Un chemin de fichier vérifie les scénarios qu'il exporte, même non enregistrés.
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ALL_SCENARIOS as SCENARIOS } from '../src/scenarios/index'
import type { ScenarioTemplate } from '../src/scenarios/types'

const arg = process.argv[2]
const fromFile = arg?.endsWith('.ts')
  ? (Object.values(await import(pathToFileURL(path.resolve(arg)).href)) as ScenarioTemplate[]).filter((s) => typeof s?.generate === 'function')
  : null
const only = fromFile ? undefined : arg
let failed = 0
for (const s of fromFile ?? SCENARIOS) {
  if (only && s.id !== only) continue
  for (const seed of [1, 42, 1337, 98765, 4242424]) {
    try {
      const inst = s.generate(seed)
      const w = inst.world
      const problems: string[] = []
      for (const id of inst.seeds) if (!w.addresses.has(id)) problems.push(`seed inconnu ${id}`)
      for (const id of inst.truth.path) if (!w.txs.has(id)) problems.push(`tx de vérité inconnue ${id}`)
      for (const id of inst.truth.addresses) if (!w.addresses.has(id)) problems.push(`adresse de vérité inconnue ${id}`)
      for (const o of inst.objectives) {
        if (o.type === 'address' || o.type === 'addresses') for (const a of o.answer) if (!w.addresses.has(a)) problems.push(`${o.id}: adresse réponse inconnue ${a}`)
        if (o.type === 'tx') for (const a of o.answer) if (!w.txs.has(a)) problems.push(`${o.id}: tx réponse inconnue ${a}`)
        if (o.type === 'entity') for (const a of o.answer) if (!w.entities.has(a)) problems.push(`${o.id}: entité réponse inconnue ${a}`)
        if ((o.type === 'amount' || o.type === 'number') && !Number.isFinite(o.answer)) problems.push(`${o.id}: réponse non numérique`)
        if (o.type === 'choice' && (o.answer < 0 || o.answer >= o.options.length)) problems.push(`${o.id}: index de choix invalide`)
      }
      // Étapes des missions guidées : chaque référence doit exister
      if (s.guided && !inst.guide?.length) problems.push('mission guidée sans étapes de guide')
      for (const [i, st] of (inst.guide ?? []).entries()) {
        const c = st.check
        if ((c.kind === 'onGraph' || c.kind === 'flagged') && !w.addresses.has(c.address)) problems.push(`guide ${i + 1} : adresse inconnue`)
        if (c.kind === 'txRevealed' && !w.txs.has(c.tx)) problems.push(`guide ${i + 1} : transaction inconnue`)
        if (c.kind === 'selected' && !w.addresses.has(c.id) && !w.txs.has(c.id)) problems.push(`guide ${i + 1} : sélection inconnue`)
        if ((c.kind === 'answered' || c.kind === 'correct') && !inst.objectives.some((o) => o.id === c.objective)) problems.push(`guide ${i + 1} : objectif inconnu`)
      }
      // Valeurs négatives ou NaN
      for (const tx of w.txs.values()) {
        for (const io of [...tx.inputs, ...tx.outputs]) if (!(io.value > 0) || !Number.isFinite(io.value)) problems.push(`valeur invalide dans ${tx.id}: ${io.value}`)
        for (const t of tx.transfers) if (!(t.value > 0) || !Number.isFinite(t.value)) problems.push(`transfert invalide dans ${tx.id}: ${t.value}`)
        if (tx.fee < 0) problems.push(`frais négatifs ${tx.id}`)
        for (const i of tx.inputs) {
          if (!i.prev) continue
          const prev = w.txs.get(i.prev.tx)
          if (prev && prev.time > tx.time) problems.push(`chronologie : ${tx.id.slice(0, 16)} dépense une sortie future (${Math.round((prev.time - tx.time) / 60)} min)`)
        }
      }
      const status = problems.length ? 'ÉCHEC' : 'ok'
      if (problems.length) failed++
      console.log(`${status.padEnd(5)} ${s.id.padEnd(26)} seed=${String(seed).padEnd(8)} adresses=${w.addresses.size} tx=${w.txs.size}`)
      if (problems.length) console.log(`       ${problems.length} problème(s)`)
      for (const p of problems.slice(0, 3)) console.log('       - ' + p)
    } catch (e) {
      failed++
      console.log(`CRASH ${s.id} seed=${seed}: ${(e as Error).stack}`)
    }
  }
}
process.exit(failed ? 1 : 0)
