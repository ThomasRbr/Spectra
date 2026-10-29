// Niveaux 4 (Avancé) et 5 (Expert) de l'Académie SPECTRA.
//
// Les questions à choix unique (quiz et blocs « check ») sont rédigées avec la
// bonne réponse souvent en deuxième position ; une rotation déterministe des
// options, calculée à partir du texte de la question, répartit les positions à
// l'export. Les questions « multi » et « truefalse » ne sont pas modifiées, ni
// les listes d'options courtes (valeurs ordonnées comme « 12 / 18 / 24 / 25 »).
import type { Block, Lesson, Question } from '../model'
import { L4_CONFIDENTIALITE } from './l4-confidentialite'
import { L4_CHAINES } from './l4-chaines'
import { L4_DEFI_COOP } from './l4-defi-coop'
import { L5_ANALYSE } from './l5-analyse'
import { L5_ENQUETE } from './l5-enquete'

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Fait tourner les options pour placer la bonne réponse à une position dérivée du texte. */
function rotate(q: string, options: string[], answer: number): { options: string[]; answer: number } {
  const n = options.length
  if (n < 3 || options.every((o) => o.length <= 6)) return { options, answer }
  const target = hash(q) % n
  const k = (answer - target + n) % n
  return { options: options.map((_, i) => options[(i + k) % n]), answer: target }
}

function spreadQuestion(q: Question): Question {
  if ((q.kind ?? 'single') !== 'single' || typeof q.answer !== 'number') return q
  return { ...q, ...rotate(q.q, q.options, q.answer) }
}

function spreadBlock(b: Block): Block {
  if (b.type !== 'check') return b
  return { ...b, ...rotate(b.q, b.options, b.answer) }
}

const RAW: Lesson[] = [...L4_CONFIDENTIALITE, ...L4_CHAINES, ...L4_DEFI_COOP, ...L5_ANALYSE, ...L5_ENQUETE]

export const LESSONS_L45: Lesson[] = RAW.map((l) => ({
  ...l,
  blocks: l.blocks.map(spreadBlock),
  quiz: l.quiz.map(spreadQuestion),
}))
