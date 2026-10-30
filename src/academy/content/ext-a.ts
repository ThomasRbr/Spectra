import type { Lesson } from '../model'
import { LESSON_PORTEFEUILLES_HD } from './ext-a-hd'
import { LESSON_DAB_CASH_P2P } from './ext-a-dab'
import { LESSON_ECHANGEURS_INSTANTANES } from './ext-a-echangeurs'
import { LESSON_GEL_STABLECOINS } from './ext-a-gel'
import { LESSON_FORENSIQUE_SUPPORTS } from './ext-a-forensique'
import { LESSON_VIOLENCES_SEED } from './ext-a-violences'

/** Leçons complémentaires A : portefeuilles HD, portes d'entrée cash, échangeurs, gel, forensique, violences. */
export const LESSONS_EXT_A: Lesson[] = [
  LESSON_PORTEFEUILLES_HD,
  LESSON_DAB_CASH_P2P,
  LESSON_ECHANGEURS_INSTANTANES,
  LESSON_GEL_STABLECOINS,
  LESSON_FORENSIQUE_SUPPORTS,
  LESSON_VIOLENCES_SEED,
]
