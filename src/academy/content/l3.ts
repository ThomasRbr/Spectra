import type { Lesson } from '../model'
import { L3_FLUX } from './l3-flux'
import { L3_FRAUDES } from './l3-fraudes'
import { L3_CRIMINALITE } from './l3-criminalite'
import { L3_PROCEDURE } from './l3-procedure'

// Niveau 3 — Confirmé : bridges, chain hopping, mixeurs, fraudes DeFi,
// rançongiciels, darknet, gel et saisie, rapport.
export const LESSONS_L3: Lesson[] = [...L3_FLUX, ...L3_FRAUDES, ...L3_CRIMINALITE, ...L3_PROCEDURE]
