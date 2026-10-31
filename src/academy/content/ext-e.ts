// Leçons complémentaires (lot E) : Bitcoin moderne (SegWit, Taproot, témoins),
// Ordinals et Runes, Cardano (eUTXO), affaire du bridge Ronin.
import type { Lesson } from '../model'
import { LESSON_BITCOIN_MODERNE } from './ext-e-bitcoin'
import { LESSON_ORDINALS_RUNES } from './ext-e-ordinals'
import { LESSON_CARDANO_EUTXO } from './ext-e-cardano'
import { LESSON_AFFAIRE_RONIN } from './ext-e-ronin'

export const LESSONS_EXT_E: Lesson[] = [LESSON_BITCOIN_MODERNE, LESSON_ORDINALS_RUNES, LESSON_CARDANO_EUTXO, LESSON_AFFAIRE_RONIN]
