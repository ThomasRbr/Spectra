// Affaires générées : robustesse sur de nombreuses graines (pas d'exception,
// 11 à 12 objectifs cohérents, réponses présentes dans le monde, traçage qui
// retrouve la plateforme finale). Lancer : npx tsx scripts/check-generated.ts
import { GENERATED_SCENARIOS } from '../src/scenarios'
import { traceFunds } from '../src/engine/tracing'

const N = Number(process.argv[2] ?? 200)
let failed = 0
for (const s of GENERATED_SCENARIOS) {
  const kinds = new Map<string, number>()
  let objTotal = 0
  let endpointOk = 0
  for (let seed = 1; seed <= N; seed++) {
    try {
      const inst = s.generate(seed * 7919)
      const w = inst.world
      const problems: string[] = []
      if (inst.objectives.length < 10 || inst.objectives.length > 12) problems.push(`${inst.objectives.length} objectifs`)
      objTotal += inst.objectives.length
      for (const o of inst.objectives) {
        if ((o.type === 'address' || o.type === 'addresses') && !o.answer.every((a) => w.addresses.has(a))) problems.push(`${o.id} adresse inconnue`)
        if (o.type === 'tx' && !o.answer.every((t) => w.txs.has(t))) problems.push(`${o.id} tx inconnue`)
        if (o.type === 'entity' && !o.answer.every((e) => w.entities.has(e))) problems.push(`${o.id} entité inconnue`)
        if ((o.type === 'amount' || o.type === 'number') && (!Number.isFinite(o.answer) || o.answer <= 0)) problems.push(`${o.id} montant ${o.answer}`)
        if (o.type === 'choice' && (o.answer < 0 || o.answer >= o.options.length || new Set(o.options).size !== o.options.length)) problems.push(`${o.id} QCM`)
      }
      if (!inst.truth.path.every((t) => w.txs.has(t))) problems.push('chemin réel incomplet')
      const steps = inst.truth.debrief.match(/Techniques enchaînées : (.*?)\. Chaque/)?.[1] ?? ''
      for (const k of steps.split(' → ')) kinds.set(k, (kinds.get(k) ?? 0) + 1)
      // Le traçage depuis le premier paiement de la victime atteint-il la plateforme finale ?
      const ent = inst.objectives.find((o) => o.type === 'entity')
      const first = w.tx(inst.truth.path[0])
      const p1 = inst.objectives[0].type === 'address' ? inst.objectives[0].answer[0] : undefined
      if (ent && p1) {
        const tr = traceFunds(w, { txId: first.id, address: p1 }, { method: 'haircut', maxHops: 30 })
        if (tr.endpoints.some((e) => ent.type === 'entity' && ent.answer.includes(e.entity.id))) endpointOk++
      }
      if (problems.length) {
        failed++
        console.log(`ÉCHEC ${s.id} seed=${seed * 7919} : ${problems.join(', ')}`)
      }
    } catch (e) {
      failed++
      console.log(`CRASH ${s.id} seed=${seed * 7919} : ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`)
    }
  }
  console.log(`${s.id} : ${N} graines, ${(objTotal / N).toFixed(1)} objectifs en moyenne, plateforme retrouvée par le traçage ${endpointOk}/${N}`)
  console.log('   techniques :', [...kinds].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · '))
}
process.exit(failed ? 1 : 0)
