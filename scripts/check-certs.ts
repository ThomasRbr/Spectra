// Vérifie les certifications pratiques : missions des volets, notation du
// rapport (vide → faible, complet → élevée) et code de vérification.
// Usage : npx tsx scripts/check-certs.ts
import { PRACTICAL_CERTS, EMPTY_REPORT, expectedEntities, gradeReport, heldReference, referenceSourceUsd, verificationCode, type CertReport } from '../src/lib/certs'
import { scenarioById } from '../src/scenarios/index'
import { freezeOption, resolveFreeze, type FreezeRequest } from '../src/engine/freeze'

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
        const opts = { live: !!cert.live, strict: !!cert.strict }
        const empty = gradeReport(inst, EMPTY_REPORT, {}, opts)
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
          requisitions: ent ? [{ entityId: ent, addresses: w.entities.get(ent)?.category === 'token_issuer' ? inst.truth.addresses.slice(-3) : deposit ? [deposit.id] : [] }] : [],
          held, noHeld: held.length === 0,
        }
        const g = gradeReport(inst, full, { traceSourceTx: inst.truth.path[0], frozenUsd: cert.live ? referenceSourceUsd(inst) * 0.3 + 1 : 0 }, opts)
        if (cert.strict) {
          const decoy = [...w.addresses.keys()].find((a) => !inst.truth.addresses.includes(a))!
          const bad = gradeReport(inst, { ...full, attributions: [...full.attributions, { address: decoy, confidence: 'forte' }] }, { traceSourceTx: inst.truth.path[0] }, opts)
          if (bad.items.find((i) => i.label.startsWith('Leurres'))?.earned !== 0) problems.push(`${id}#${seed} : leurre retenu non sanctionné`)
        }
        if (g.pct < 90) low.push(`${id}#${seed} : rapport complet noté ${g.pct} % (${g.items.filter((i) => i.earned < i.max).map((i) => i.label).join(' ; ')})`)
      }
    }
  }
}
// Gel en temps réel sur l'affaire Expert : demandé tôt il bloque des USDT, demandé trop tard il échoue
for (const seed of [1, 42, 1337]) {
  const inst = scenarioById('cert-expert')!.generate(seed)
  const w = inst.world
  const o3 = inst.objectives.find((o) => o.id === 'o3')!
  const t2 = (o3 as { answer: string[] }).answer[0]
  const recv = w.txsOf(t2).find((t) => w.flowIn(t, t2).length)!
  const leave = w.txsOf(t2).find((t) => w.flowOut(t, t2).length)!
  const ask = (at: number): FreezeRequest => {
    w.setHorizon(at)
    const opt = freezeOption(w, t2)
    if ('reason' in opt) throw new Error('gel impossible : ' + opt.reason)
    const req: FreezeRequest = { id: 'x', address: t2, via: opt.via, authority: opt.authority, assets: opt.assets, requestedAt: at, effectiveAt: Math.round(at + opt.delayH * 3600), status: 'pending', frozen: {}, frozenUsd: 0 }
    w.setHorizon(req.effectiveAt)
    return resolveFreeze(w, req)
  }
  const early = ask(recv.time + 600)
  const late = ask(leave.time + 600)
  w.setHorizon(Infinity)
  if (early.status !== 'effective' || early.frozenUsd < 1) problems.push(`gel précoce cert-expert#${seed} : ${early.status}`)
  if (late.status !== 'late') problems.push(`gel tardif cert-expert#${seed} : ${late.status}`)
  n++
}

const code = verificationCode('Thomas Robert', 'pc-associe', 84, Date.parse('2026-10-29T15:00:00'))
if (code !== verificationCode('thomas robert ', 'pc-associe', 84, Date.parse('2026-10-29T09:00:00'))) problems.push('code : dépend de l\'heure ou de la casse')
if (code === verificationCode('Thomas Robert', 'pc-associe', 85, Date.parse('2026-10-29T15:00:00'))) problems.push('code : insensible au score')
console.log(`Volets vérifiés : ${n} · code exemple ${code}`)
for (const l of low) console.log(' ~ ' + l)
for (const p of problems) console.log(' - ' + p)
process.exit(problems.length || low.length > n * 0.1 ? 1 : 0)
