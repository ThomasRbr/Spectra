import type { ScenarioTemplate } from './types'
import { guidePremiersPas } from './guide_premiers_pas'
import { guideExchange } from './guide_exchange'
import { guideUsdtTron } from './guide_usdt_tron'
import { guideRapport } from './guide_rapport'

/** Missions guidées pas à pas (tutoriels pour grands débutants), dans l'ordre conseillé. */
export const PACK_GUIDES: ScenarioTemplate[] = [guidePremiersPas, guideExchange, guideUsdtTron, guideRapport]
