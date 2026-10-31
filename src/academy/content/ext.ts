import type { Lesson } from '../model'
import { LESSONS_EXT_A } from './ext-a'
import { LESSONS_EXT_B } from './ext-b'
import { LESSONS_AFFAIRES } from './affaires'
import { LESSONS_EXT_C } from './ext-c'
import { LESSONS_EXT_D } from './ext-d'
import { LESSONS_EXT_E } from './ext-e'

/** Leçons complémentaires (terrain, typologies récentes, affaires décryptées). */
export const LESSONS_EXT: Lesson[] = [...LESSONS_EXT_A, ...LESSONS_EXT_B, ...LESSONS_AFFAIRES, ...LESSONS_EXT_C, ...LESSONS_EXT_D, ...LESSONS_EXT_E]
