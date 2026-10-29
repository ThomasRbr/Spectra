import type { Block, Lesson, Question } from '../model'
import { LESSONS_L0A } from './l0a'
import { LESSONS_L0B } from './l0b'
import { LESSONS_L1A } from './l1a'
import { LESSONS_L1B } from './l1b'

// Niveaux 0 (débutant absolu) et 1 (initié), dans l'ordre du curriculum.
//
// Les options des quiz et des blocs « check » sont rédigées avec la bonne
// réponse à une position quelconque, puis mélangées ici de façon
// déterministe (même résultat à chaque chargement) pour que la position de
// la bonne réponse ne soit pas prévisible. Ne sont pas mélangées : les
// questions Vrai/Faux et les listes d'options numériques (déjà ordonnées).

const SALT = 11 // graine choisie pour une répartition équilibrée des bonnes réponses

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Permutation déterministe : perm[nouvelle position] = ancienne position. */
function permutation(n: number, key: string): number[] {
  const r = rng(hash(key))
  const p = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  return p
}

const isNumeric = (options: string[]) => options.every((o) => /^[\d≈]/.test(o.trim()))

function shuffleOptions(options: string[], answer: number | number[], key: string): { options: string[]; answer: number | number[] } {
  if (isNumeric(options)) return { options, answer }
  const p = permutation(options.length, key)
  const newIndex = (old: number) => p.indexOf(old)
  return {
    options: p.map((old) => options[old]),
    answer: Array.isArray(answer) ? answer.map(newIndex).sort((a, b) => a - b) : newIndex(answer),
  }
}

function shuffleLesson(l: Lesson): Lesson {
  const quiz: Question[] = l.quiz.map((q, i) => {
    if (q.kind === 'truefalse') return q
    const s = shuffleOptions(q.options, q.answer, `${SALT}:${l.id}:quiz:${i}`)
    return { ...q, options: s.options, answer: s.answer }
  })
  const blocks: Block[] = l.blocks.map((b, i) => {
    if (b.type !== 'check') return b
    const s = shuffleOptions(b.options, b.answer, `${SALT}:${l.id}:check:${i}`)
    return { ...b, options: s.options, answer: s.answer as number }
  })
  return { ...l, quiz, blocks }
}

export const LESSONS_L01: Lesson[] = [...LESSONS_L0A, ...LESSONS_L0B, ...LESSONS_L1A, ...LESSONS_L1B].map(shuffleLesson)
