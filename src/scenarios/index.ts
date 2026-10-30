import type { ScenarioTemplate } from './types'
import { s01FirstTrace } from './s01_first_trace'
import { s02PigButchering } from './s02_pig_butchering'
import { PACK_BTC } from './pack_btc'
import { PACK_ACCOUNT } from './pack_account'
import { PACK_OPS } from './pack_ops'
import { PACK_TERRAIN } from './pack_terrain'
import { PACK_TYPO } from './pack_typo'
import { PACK_GUIDES } from './pack_guides'
import { PACK_DEBUTANT } from './pack_debutant'
import { certSpecialiste } from './cert_specialiste'
import { certExpert } from './cert_expert'

/** Toutes les affaires, y compris celles réservées aux certifications. */
export const ALL_SCENARIOS: ScenarioTemplate[] = [s01FirstTrace, s02PigButchering, ...PACK_BTC, ...PACK_ACCOUNT, ...PACK_OPS, ...PACK_TERRAIN, ...PACK_TYPO, ...PACK_GUIDES, ...PACK_DEBUTANT, certSpecialiste, certExpert].sort(
  // Par difficulté, les missions guidées (tutoriels) en tête de leur niveau
  (a, b) => a.difficulty - b.difficulty || Number(!!b.guided) - Number(!!a.guided),
)

/** Missions proposées au joueur. */
export const SCENARIOS: ScenarioTemplate[] = ALL_SCENARIOS.filter((s) => !s.certOnly)

export function scenarioById(id: string): ScenarioTemplate | undefined {
  return ALL_SCENARIOS.find((s) => s.id === id)
}
