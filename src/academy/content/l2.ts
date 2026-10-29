// Niveau 2 — Intermédiaire : heuristiques, clustering, attribution,
// typologies, premières réquisitions. Leçons réparties par filière.
import type { Lesson } from '../model'
import { L2_BITCOIN } from './l2-bitcoin'
import { L2_METHODO } from './l2-methodo'
import { L2_COMPTES } from './l2-comptes'
import { L2_ENQUETE_A } from './l2-enquete-a'
import { L2_ENQUETE_B } from './l2-enquete-b'

const ORDER = [
  'change-heuristics',
  'clustering',
  'peel-chains',
  'attribution-sources',
  'exposition-risque',
  'dex-defi',
  'xrp-memos',
  'typologies',
  'osint',
  'requisitions',
  'opsec-enqueteur',
]

export const LESSONS_L2: Lesson[] = [...L2_BITCOIN, ...L2_METHODO, ...L2_COMPTES, ...L2_ENQUETE_A, ...L2_ENQUETE_B].sort(
  (a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id),
)
