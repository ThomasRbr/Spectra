// Vérifie la cohérence de l'Académie : leçons du curriculum, blocs, quiz,
// simulateurs, exercices générés.
// Usage : npx tsx scripts/check-academy.ts
import { CURRICULUM, type Lesson, type WidgetId } from '../src/academy/model'
import { LESSONS_L01 } from '../src/academy/content/l0l1'
import { LESSONS_L2 } from '../src/academy/content/l2'
import { LESSONS_L3 } from '../src/academy/content/l3'
import { LESSONS_L45 } from '../src/academy/content/l4l5'
import { LESSONS_EXT } from '../src/academy/content/ext'
import { DRILLS } from '../src/academy/drills/index'
import { SCENARIOS } from '../src/scenarios/index'

const WIDGET_IDS: WidgetId[] = ['hash-playground', 'chain-tamper', 'keys-derivation', 'unit-converter', 'address-anatomy', 'utxo-builder', 'fee-mempool', 'account-vs-utxo', 'change-detective', 'cioh-cluster', 'peel-chain', 'exchange-flow', 'amm-swap', 'bridge-flow', 'coinjoin-visualizer', 'privacy-pool', 'timing-correlation', 'risk-exposure']
const all: Lesson[] = [...LESSONS_L01, ...LESSONS_L2, ...LESSONS_L3, ...LESSONS_L45, ...LESSONS_EXT]
const problems: string[] = []
const ids = new Set<string>()
for (const l of all) {
  if (ids.has(l.id)) problems.push(`doublon ${l.id}`)
  ids.add(l.id)
  const c = CURRICULUM.find((x) => x.id === l.id)
  if (!c) problems.push(`${l.id} absent du curriculum`)
  else if (c.level !== l.level || c.track !== l.track) problems.push(`${l.id} niveau/filière différents du curriculum`)
  if (l.blocks.length < 6) problems.push(`${l.id} : seulement ${l.blocks.length} blocs`)
  if (l.quiz.length < 4) problems.push(`${l.id} : quiz trop court (${l.quiz.length})`)
  if (l.flashcards.length < 4) problems.push(`${l.id} : ${l.flashcards.length} fiches`)
  if (!l.objectives.length) problems.push(`${l.id} : pas d'objectifs`)
  for (const p of l.prerequisites ?? []) if (!CURRICULUM.some((x) => x.id === p)) problems.push(`${l.id} : prérequis inconnu ${p}`)
  for (const p of l.practice ?? []) if (!SCENARIOS.some((s) => s.id === p)) problems.push(`${l.id} : mission inconnue ${p}`)
  l.quiz.forEach((q, i) => {
    const ans = Array.isArray(q.answer) ? q.answer : [q.answer]
    if (ans.some((a) => a < 0 || a >= q.options.length)) problems.push(`${l.id} quiz ${i} : réponse hors bornes`)
    if (q.kind === 'multi' && !Array.isArray(q.answer)) problems.push(`${l.id} quiz ${i} : multi sans tableau`)
  })
  l.blocks.forEach((b, i) => {
    if (b.type === 'check' && (b.answer < 0 || b.answer >= b.options.length)) problems.push(`${l.id} bloc ${i} : check hors bornes`)
    if (b.type === 'widget' && !WIDGET_IDS.includes(b.id)) problems.push(`${l.id} bloc ${i} : widget inconnu ${b.id}`)
    if (b.type === 'flow') for (const e of b.edges) if (!b.nodes.some((n) => n.id === e.from) || !b.nodes.some((n) => n.id === e.to)) problems.push(`${l.id} bloc ${i} : arête ${e.from}→${e.to} invalide`)
    if (b.type === 'table' && b.rows.some((r) => r.length !== b.headers.length)) problems.push(`${l.id} bloc ${i} : ligne de tableau de mauvaise largeur`)
  })
}
const missing = CURRICULUM.filter((c) => !ids.has(c.id)).map((c) => c.id)
for (const d of DRILLS) {
  for (const seed of [1, 2, 3, 42, 999, 123456]) {
    try {
      const it = d.generate(seed)
      if (it.kind === 'choice' && (typeof it.answer !== 'number' || !it.options || it.answer < 0 || it.answer >= it.options.length)) problems.push(`drill ${d.id} seed ${seed} : réponse invalide`)
      if (it.kind === 'number' && typeof it.answer !== 'number') problems.push(`drill ${d.id} seed ${seed} : réponse non numérique`)
      if (it.kind === 'choice' && it.options && new Set(it.options).size !== it.options.length) problems.push(`drill ${d.id} seed ${seed} : options en double`)
    } catch (e) {
      problems.push(`drill ${d.id} seed ${seed} : plantage ${(e as Error).message}`)
    }
  }
}
console.log(`Leçons : ${all.length}/${CURRICULUM.length} · quiz : ${all.reduce((s, l) => s + l.quiz.length, 0)} · fiches : ${all.reduce((s, l) => s + l.flashcards.length, 0)} · exercices générés : ${DRILLS.length}`)
if (missing.length) console.log(`Manquantes : ${missing.join(', ')}`)
for (const p of problems) console.log(' - ' + p)
process.exit(problems.length ? 1 : 0)
