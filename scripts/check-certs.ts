// Vérifie les certifications pratiques : missions des volets, notation du
// rapport (vide → faible, complet → élevée) et code de vérification.
// Usage : npx tsx scripts/check-certs.ts
import { PRACTICAL_CERTS, EMPTY_REPORT, expectedEntities, gradeReport, heldReference, verificationCode, type CertReport } from '../src/lib/certs'
import { scenarioById } from '../src/scenarios/index'

const problems: string[] = []
let n = 0
const low: string[] = []
for (const cert of PRACTICAL_CERTS) {
  if (cert.soon) continue
  for (const v of cert.volets) {
    for (const id of v.pool) {
      const t = scenarioById(id)
      if (!t) {
        problems.push(`${cert.id} : mission inconnue ${id}`)
        continue
      }
      for (const seed of [1, 42, 1337, 2024]) {
        n++
        const inst = t.generate(seed)
        const w = inst.world
        const empty = gradeReport(inst, EMPTY_REPORT, {})
        if (empty.pct > 30) problems.push(`${id}#${seed} : rapport vide noté ${empty.pct} %`)
        const ents = expectedEntities(inst)
        const ent = ents[0]
        const deposit = ent ? [...w.addresses.values()].find((a) => a.entityId === ent && a.tags.includes('deposit') && inst.truth.path.some((tx) => w.txs.get(tx)!.transfers.some((x) => x.to === a.id) || w.txs.get(tx)!.outputs.some((o) => o.address === a.id))) : undefined
        const key = inst.truth.addresses[0]
        const held = heldReference(inst)
        const full: CertReport = {
          method: 'haircut',
          justification: 'Prorata retenu : neutre, explicable, comparé à FIFO et poison sans changement de conclusion.',
          findings: `La transaction du versement crédite ${w.get(key).addr}, puis les fonds rejoignent le service identifié.`,
          inferences: 'Le rendu est déduit du type d\'adresse et du comportement ultérieur ; attribution par cluster et par balayage.',
          attributions: [{ address: key, confidence: 'forte' }],
          requisitions: ent ? [{ entityId: ent, addresses: deposit ? [deposit.id] : [] }] : [],
          held, noHeld: held.length === 0,
        }
        const g = gradeReport(inst, full, { traceSourceTx: inst.truth.path[0] })
        if (g.pct < 90) low.push(`${id}#${seed} : rapport complet noté ${g.pct} % (${g.items.filter((i) => i.earned < i.max).map((i) => i.label).join(' ; ')})`)
      }
    }
  }
}
const code = verificationCode('Thomas Robert', 'pc-associe', 84, Date.parse('2026-10-29T15:00:00'))
if (code !== verificationCode('thomas robert ', 'pc-associe', 84, Date.parse('2026-10-29T09:00:00'))) problems.push('code : dépend de l\'heure ou de la casse')
if (code === verificationCode('Thomas Robert', 'pc-associe', 85, Date.parse('2026-10-29T15:00:00'))) problems.push('code : insensible au score')
console.log(`Volets vérifiés : ${n} · code exemple ${code}`)
for (const l of low) console.log(' ~ ' + l)
for (const p of problems) console.log(' - ' + p)
process.exit(problems.length || low.length > n * 0.1 ? 1 : 0)
