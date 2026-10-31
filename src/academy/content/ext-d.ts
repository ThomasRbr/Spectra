// Leçons complémentaires (lot D) : DeFi et traçage (jetons enveloppés et de
// reçu, prêts avec garantie, pools de liquidité, blanchiment par la DeFi).
import type { Lesson } from '../model'
import { LESSON_JETONS_ENVELOPPES } from './ext-d-enveloppes'
import { LESSON_PRET_GARANTIE } from './ext-d-pret'
import { LESSON_POOLS_LIQUIDITE } from './ext-d-pools'
import { LESSON_BLANCHIMENT_DEFI } from './ext-d-blanchiment'

export const LESSONS_EXT_D: Lesson[] = [LESSON_JETONS_ENVELOPPES, LESSON_PRET_GARANTIE, LESSON_POOLS_LIQUIDITE, LESSON_BLANCHIMENT_DEFI]
