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
import { PACK_CONTRATS } from './pack_contrats'
import { PACK_MODERNE } from './pack_moderne'
import { certSpecialiste } from './cert_specialiste'
import { certExpert } from './cert_expert'
import { GENERATED } from './gen_affaire'
import { hashSeed } from '../engine/rng'

/**
 * La graine du joueur est mêlée à l'id de la mission : deux affaires jouées avec
 * la même graine ne tirent ni les mêmes noms, ni les mêmes villes, ni des adresses
 * quasi identiques. Toute génération passe par ces listes (jeu, sauvegardes,
 * certifications, scripts), donc une graine désigne toujours le même monde.
 */
function salted(t: ScenarioTemplate): ScenarioTemplate {
  const salt = hashSeed(t.id)
  return { ...t, generate: (seed) => t.generate((seed ^ salt) >>> 0) }
}

/** Toutes les affaires, y compris celles réservées aux certifications. */
export const ALL_SCENARIOS: ScenarioTemplate[] = [s01FirstTrace, s02PigButchering, ...PACK_BTC, ...PACK_ACCOUNT, ...PACK_OPS, ...PACK_TERRAIN, ...PACK_TYPO, ...PACK_GUIDES, ...PACK_DEBUTANT, ...PACK_CONTRATS, ...PACK_MODERNE, certSpecialiste, certExpert, ...GENERATED].map(salted).sort(
  // Par difficulté, les missions guidées (tutoriels) en tête de leur niveau
  (a, b) => a.difficulty - b.difficulty || Number(!!b.guided) - Number(!!a.guided),
)

/** Missions proposées au joueur. */
export const SCENARIOS: ScenarioTemplate[] = ALL_SCENARIOS.filter((s) => !s.certOnly && !s.generated)

/** Affaires générées (difficultés 2 à 4). */
export const GENERATED_SCENARIOS: ScenarioTemplate[] = ALL_SCENARIOS.filter((s) => s.generated)

export function scenarioById(id: string): ScenarioTemplate | undefined {
  return ALL_SCENARIOS.find((s) => s.id === id)
}
