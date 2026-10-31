// Leçons complémentaires (lot C) : lire les smart contracts (données d'entrée,
// événements, transactions internes, contrats de dépôt, agrégateurs).
import type { Lesson } from '../model'
import { LESSON_INTERNES } from './ext-c-internes'
import { LESSON_CALLDATA } from './ext-c-calldata'
import { LESSON_CREATE2 } from './ext-c-create2'
import { LESSON_AGREGATEURS } from './ext-c-agregateurs'

export const LESSONS_EXT_C: Lesson[] = [LESSON_INTERNES, LESSON_CALLDATA, LESSON_CREATE2, LESSON_AGREGATEURS]
