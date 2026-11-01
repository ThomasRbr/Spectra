// Réalisme des affaires : les adresses du flux doivent avoir une vie propre
// (historique, dépenses, poussière), les niveaux 3 et 4 doivent proposer de
// vraies fausses pistes (branches sans issue, transferts jumeaux), les QCM
// restent minoritaires et les fins d'affaire varient d'une mission à l'autre.
// Lancer : npx tsx scripts/check-realism.ts [--verbose] [id…]
import { ALL_SCENARIOS } from '../src/scenarios'
import { attribution } from '../src/engine/analysis'
import { CHAINS, usd } from '../src/engine/chains'
import type { Tx, World } from '../src/engine/world'

const SEEDS = [1, 42, 777]
const H = 3600
/** Seuils par difficulté : leurres autour du flux, tx par adresse non attribuée, QCM max, branches, jumeaux. */
// « Habillées » : adresses non attribuées du flux qui ont une vraie vie (au moins DRESSED_TX tx).
// Les adresses de passage à usage unique (sauts d'une peel chain, sorties de CoinJoin) restent légitimes.
const DRESSED_TX = 8
const MIN = {
  1: { decoys: 3, dressed: 1, qcm: 4, branches: 0, twins: 0 },
  2: { decoys: 8, dressed: 2, qcm: 4, branches: 1, twins: 0 },
  3: { decoys: 15, dressed: 3, qcm: 3, branches: 2, twins: 1 },
  4: { decoys: 20, dressed: 3, qcm: 3, branches: 3, twins: 2 },
} as const
/** Part maximale des missions qui finissent chez un exchange régulé. */
const MAX_EXCHANGE_ENDINGS = 0.55

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const only = args.filter((a) => !a.startsWith('--'))

function valuesOf(tx: Tx): number[] {
  const asset = CHAINS[tx.chain].native
  const vals = tx.model === 'utxo' ? tx.outputs.map((o) => usd(asset, o.value)) : tx.transfers.map((t) => usd(t.asset, t.value))
  return vals.filter((v) => Number.isFinite(v))
}
function mainValue(tx: Tx): number {
  return Math.max(0, ...valuesOf(tx))
}
function partiesOf(tx: Tx): string[] {
  return [...tx.inputs.map((x) => x.address), ...tx.outputs.map((x) => x.address), ...tx.transfers.flatMap((x) => [x.from, x.to])]
}
function receiversOf(tx: Tx): string[] {
  return tx.model === 'utxo' ? tx.outputs.map((o) => o.address) : tx.transfers.map((t) => t.to)
}
function sendersOf(tx: Tx): string[] {
  return tx.model === 'utxo' ? tx.inputs.map((i) => i.address) : tx.transfers.map((t) => t.from)
}
const known = (w: World, a: string) => !!attribution(w, a).entity

interface Metrics { decoys: number; perAddr: number; dressed: number; qcm: number; branches: number; twins: number; ending: string; objectives: number }

function measure(w: World, inst: ReturnType<(typeof ALL_SCENARIOS)[number]['generate']>): Metrics {
  const truthIds = new Set(inst.truth.path)
  const truth = inst.truth.path.map((id) => w.txs.get(id)).filter((t): t is Tx => !!t)
  const pathAddrs = new Set(truth.flatMap(partiesOf))
  const plain = [...pathAddrs].filter((a) => w.addresses.has(a) && !known(w, a) && !w.get(a).contract)
  const victims = new Set(inst.seeds)
  let decoys = 0
  let txSum = 0
  let branches = 0
  for (const a of plain) {
    const txs = w.txsOf(a)
    txSum += txs.length
    for (const t of txs) {
      if (truthIds.has(t.id)) continue
      if (truth.some((x) => Math.abs(x.time - t.time) < 48 * H)) decoys++
      // Branche : sortie hors flux, d'une adresse du flux (hors victime) vers une adresse non attribuée hors flux
      if (!victims.has(a) && sendersOf(t).includes(a) && receiversOf(t).some((r) => r !== a && !pathAddrs.has(r) && w.addresses.has(r) && !known(w, r)) && mainValue(t) >= 50) branches++
    }
  }
  // Jumeaux : tx hors flux à ±60 min d'une tx du flux, dont une sortie vaut à ±1,5 % une sortie
  // de la tx du flux (toutes les sorties sont comparées : en UTXO, le rendu ne masque pas le paiement)
  let twins = 0
  const all = [...w.txs.values()].filter((t) => !truthIds.has(t.id))
  for (const x of truth) {
    const vx = valuesOf(x).filter((v) => v >= 100)
    if (!vx.length) continue
    twins += all.filter((t) => t.chain === x.chain && Math.abs(t.time - x.time) <= H && valuesOf(t).some((v) => vx.some((u) => Math.abs(v - u) / u <= 0.015))).length
  }
  // Fin : catégorie de l'entité connue qui reçoit la dernière tx du flux (à défaut : fonds détenus)
  let ending = 'détenus'
  const ordered = [...truth].sort((a, b) => b.time - a.time)
  for (const t of ordered) {
    const cats = receiversOf(t).map((r) => attribution(w, r).entity?.category).filter((c): c is NonNullable<typeof c> => !!c && !['dex', 'bridge'].includes(c))
    if (cats.length) { ending = cats[0]; break }
    if (receiversOf(t).some((r) => w.get(r).contract)) continue
    break
  }
  return {
    decoys,
    perAddr: plain.length ? txSum / plain.length : 0,
    dressed: plain.filter((a) => w.txsOf(a).length >= DRESSED_TX).length,
    qcm: inst.objectives.filter((o) => o.type === 'choice').length,
    branches,
    twins,
    ending,
    objectives: inst.objectives.length,
  }
}

let failed = 0
const endings: Record<string, number> = {}
const playable = ALL_SCENARIOS.filter((s) => !s.generated && (!only.length || only.includes(s.id)))
for (const s of playable) {
  const issues: string[] = []
  const ms: Metrics[] = []
  for (const seed of SEEDS) {
    const inst = s.generate(seed)
    ms.push(measure(inst.world, inst))
  }
  const avg = (f: (m: Metrics) => number) => ms.reduce((a, m) => a + f(m), 0) / ms.length
  const min = MIN[s.difficulty as 1 | 2 | 3 | 4]
  const m = { decoys: avg((x) => x.decoys), perAddr: avg((x) => x.perAddr), dressed: Math.min(...ms.map((x) => x.dressed)), qcm: Math.max(...ms.map((x) => x.qcm)), branches: Math.min(...ms.map((x) => x.branches)), twins: Math.min(...ms.map((x) => x.twins)) }
  if (m.decoys < min.decoys) issues.push(`leurres ${m.decoys.toFixed(1)} < ${min.decoys}`)
  if (m.dressed < min.dressed) issues.push(`adresses habillées ${m.dressed} < ${min.dressed}`)
  if (m.qcm > min.qcm) issues.push(`QCM ${m.qcm} > ${min.qcm}`)
  if (!s.guided && m.branches < min.branches) issues.push(`branches ${m.branches} < ${min.branches}`)
  if (!s.guided && m.twins < min.twins) issues.push(`jumeaux ${m.twins} < ${min.twins}`)
  const ending = ms[1].ending
  endings[ending] = (endings[ending] ?? 0) + 1
  if (issues.length) failed++
  const line = `${s.id.padEnd(26)} n${s.difficulty} leurres ${m.decoys.toFixed(0).padStart(3)} · tx/adr ${m.perAddr.toFixed(1).padStart(4)} · habillées ${m.dressed} · QCM ${m.qcm} · branches ${String(m.branches).padStart(2)} · jumeaux ${String(m.twins).padStart(2)} · fin ${ending}`
  if (issues.length) console.log(`ÉCHEC ${line}\n      → ${issues.join(' ; ')}`)
  else if (verbose || only.length) console.log(`ok    ${line}`)
}
const total = playable.length
const exch = endings.exchange ?? 0
console.log(`\nFins d'affaire : ${Object.entries(endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
let endingFail = false
if (!only.length && exch / total > MAX_EXCHANGE_ENDINGS) {
  endingFail = true
  console.log(`ÉCHEC fins : ${exch}/${total} affaires finissent chez un exchange (max ${Math.round(MAX_EXCHANGE_ENDINGS * 100)} %)`)
}
console.log(`${total - failed}/${total} affaires au niveau de réalisme attendu`)
process.exit(failed || endingFail ? 1 : 0)
