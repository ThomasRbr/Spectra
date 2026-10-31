// Pack « smart contracts et DeFi » : approvals piégées, transactions internes,
// contrats de dépôt CREATE2, agrégateurs, prêts avec garantie, pools de liquidité.
import type { ScenarioTemplate } from './types'
import { evmDepotContrat } from './evm_depot_contrat'
import { evmApproveDrain } from './evm_approve_drain'
import { evmSplitterInternes } from './evm_splitter_internes'
import { defiLendingGarantie } from './defi_lending_garantie'
import { defiLpBlanchiment } from './defi_lp_blanchiment'

export const PACK_CONTRATS: ScenarioTemplate[] = [evmDepotContrat, evmApproveDrain, evmSplitterInternes, defiLendingGarantie, defiLpBlanchiment]
