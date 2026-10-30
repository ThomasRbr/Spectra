import type { Lesson } from '../model'
import { LESSONS_EXT_A } from './ext-a'
import { LESSONS_EXT_B } from './ext-b'
import { LESSONS_AFFAIRES } from './affaires'

/** Leçons complémentaires (terrain, typologies récentes, affaires décryptées). */
export const LESSONS_EXT: Lesson[] = [...LESSONS_EXT_A, ...LESSONS_EXT_B, ...LESSONS_AFFAIRES]
