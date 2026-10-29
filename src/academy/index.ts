// Catalogue unifié de l'Académie : les leçons du curriculum, dans l'ordre.
import { CURRICULUM, type Lesson, type Level } from './model'
import { LESSONS_L01 } from './content/l0l1'
import { LESSONS_L2 } from './content/l2'
import { LESSONS_L3 } from './content/l3'
import { LESSONS_L45 } from './content/l4l5'

export * from './model'
export { PATHS, EXAMS, pathById, examById } from './paths'
export { DRILLS } from './drills'
export { WIDGETS } from './widgets'

const authored = new Map<string, Lesson>()
for (const l of [...LESSONS_L01, ...LESSONS_L2, ...LESSONS_L3, ...LESSONS_L45]) authored.set(l.id, l)

export const LESSONS: Lesson[] = CURRICULUM.map((c) => authored.get(c.id)).filter((l): l is Lesson => !!l)

const byId = new Map(LESSONS.map((l) => [l.id, l]))

export function lessonById(id: string): Lesson | undefined {
  return byId.get(id)
}

/** Leçon disponible dans sa version complète. */
export function isAuthored(id: string): boolean {
  return authored.has(id)
}

export function lessonsOfLevel(level: Level): Lesson[] {
  return LESSONS.filter((l) => l.level === level)
}
