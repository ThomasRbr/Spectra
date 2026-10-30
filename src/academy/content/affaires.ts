// Affaires décryptées : affaires réelles et publiques, analysées sous l'angle
// du traçage des fonds. Faits vérifiés sur sources publiques (voir le bloc
// « Sources » en fin de chaque leçon).
import type { Lesson } from '../model'
import { LESSONS_AFFAIRES_N3 } from './affaires-n3'
import { LESSONS_AFFAIRES_N4 } from './affaires-n4'
import { LESSONS_AFFAIRES_N5 } from './affaires-n5'

export const LESSONS_AFFAIRES: Lesson[] = [...LESSONS_AFFAIRES_N3, ...LESSONS_AFFAIRES_N4, ...LESSONS_AFFAIRES_N5]
