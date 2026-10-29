// Calculs de progression de l'Académie (parcours, niveaux, révisions).
import { CURRICULUM, DRILLS, EXAMS, LESSONS, PATHS, type Flashcard, type Level, type LearningPath, type PathStep } from '../academy'
import type { useProfile } from '../store/profile'
import { bestByTemplate } from '../store/profile'
import { scenarioById } from '../scenarios'

type Profile = ReturnType<typeof useProfile.getState>

export function stepDone(p: Profile, step: PathStep, best?: Record<string, number>): boolean {
  switch (step.kind) {
    case 'lesson':
      return !!p.lessons[step.id]?.done
    case 'mission':
      return ((best ?? bestByTemplate(p.cases))[step.id] ?? 0) * 100 >= (step.minPct ?? 60)
    case 'drill':
      return (p.drills[step.id]?.correct ?? 0) >= step.target
    case 'exam':
      return !!p.exams[step.id]?.passedAt
  }
}

export function pathProgress(p: Profile, path: LearningPath) {
  const best = bestByTemplate(p.cases)
  const flags = path.steps.map((s) => stepDone(p, s, best))
  const done = flags.filter(Boolean).length
  const next = flags.findIndex((f) => !f)
  return { done, total: path.steps.length, pct: path.steps.length ? done / path.steps.length : 0, next: next === -1 ? null : next, flags, complete: next === -1 }
}

/** Niveau validé le plus haut (examen de niveau réussi), -1 si aucun. */
export function levelReached(p: Profile): number {
  let lv = -1
  for (const l of [0, 1, 2, 3, 4, 5] as Level[]) if (p.exams[`exam-n${l}`]?.passedAt) lv = l
  return lv
}

export function levelProgress(p: Profile, level: Level) {
  const ids = CURRICULUM.filter((c) => c.level === level).map((c) => c.id)
  const done = ids.filter((id) => p.lessons[id]?.done).length
  return { done, total: ids.length, examPassed: !!p.exams[`exam-n${level}`]?.passedAt }
}

export interface CardRef {
  key: string
  lessonId: string
  lessonTitle: string
  card: Flashcard
}

export function allCards(): CardRef[] {
  return LESSONS.flatMap((l) => l.flashcards.map((card, i) => ({ key: `${l.id}#${i}`, lessonId: l.id, lessonTitle: l.title, card })))
}

/** Fiches à réviser maintenant : échues, puis nouvelles des leçons terminées. */
export function dueCards(p: Profile, opts: { lessonId?: string; newLimit?: number } = {}): CardRef[] {
  const now = Date.now()
  const cards = allCards().filter((c) => !opts.lessonId || c.lessonId === opts.lessonId)
  const due = cards.filter((c) => p.cards[c.key] && p.cards[c.key].due <= now).sort((a, b) => p.cards[a.key].due - p.cards[b.key].due)
  const fresh = cards.filter((c) => !p.cards[c.key] && (opts.lessonId || p.lessons[c.lessonId]?.read))
  return [...due, ...fresh.slice(0, opts.newLimit ?? 20)]
}

export function lessonStatus(p: Profile, id: string): 'done' | 'started' | 'new' {
  const r = p.lessons[id]
  if (r?.done) return 'done'
  if (r?.read || (r?.checks && Object.keys(r.checks).length)) return 'started'
  return 'new'
}

/** Prochaine action recommandée pour « Continuer ». */
export function nextAction(p: Profile): { pathId: string; step: PathStep; index: number } | null {
  const order = ['cursus', ...PATHS.map((x) => x.id).filter((id) => id !== 'cursus')]
  // Parcours déjà entamé en priorité, sinon le grand cursus
  const started = PATHS.filter((path) => pathProgress(p, path).done > 0 && !pathProgress(p, path).complete)
  const path = started.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))[0] ?? PATHS.find((x) => x.id === 'cursus')
  if (!path) return null
  const prog = pathProgress(p, path)
  if (prog.next === null) return null
  return { pathId: path.id, step: path.steps[prog.next], index: prog.next }
}

export function stepLabel(step: PathStep): string {
  switch (step.kind) {
    case 'lesson':
      return LESSONS.find((l) => l.id === step.id)?.title ?? CURRICULUM.find((c) => c.id === step.id)?.title ?? step.id
    case 'mission':
      return `Mission : ${scenarioById(step.id)?.title ?? step.id}`
    case 'drill':
      return DRILLS.find((d) => d.id === step.id)?.title ?? step.id
    case 'exam':
      return EXAMS.find((e) => e.id === step.id)?.title ?? step.id
  }
}
