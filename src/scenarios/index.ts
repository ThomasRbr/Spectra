import type { ScenarioTemplate } from './types'
import { s01FirstTrace } from './s01_first_trace'
import { s02PigButchering } from './s02_pig_butchering'
import { PACK_BTC } from './pack_btc'
import { PACK_ACCOUNT } from './pack_account'

export const SCENARIOS: ScenarioTemplate[] = [s01FirstTrace, s02PigButchering, ...PACK_BTC, ...PACK_ACCOUNT].sort(
  (a, b) => a.difficulty - b.difficulty,
)

export function scenarioById(id: string): ScenarioTemplate | undefined {
  return SCENARIOS.find((s) => s.id === id)
}
