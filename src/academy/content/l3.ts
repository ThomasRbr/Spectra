import type { Lesson } from '../model'
import { L3_FLUX } from './l3-flux'
import { L3_FRAUDES } from './l3-fraudes'
import { L3_CRIMINALITE } from './l3-criminalite'
import { L3_PROCEDURE } from './l3-procedure'
import { L3_OUTILS } from './l3-outils'

// Niveau 3 — Confirmé : bridges, chain hopping, mixeurs, fraudes DeFi,
// rançongiciels, darknet, réglementation, gel et saisie, traçage outillé, rapport.
export const LESSONS_L3: Lesson[] = [...L3_FLUX, ...L3_FRAUDES, ...L3_CRIMINALITE, ...L3_PROCEDURE, ...L3_OUTILS]
