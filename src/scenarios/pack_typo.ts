// Pack « typologies » : TON et bots Telegram, rollups (Arbitrum, Base), DAB
// crypto et P2P, Ponzi, pump and dump, wash trading NFT, drainer Solana.
import type { ScenarioTemplate } from './types'
import { tonTelegramScam } from './typo_ton_telegram'
import { l2ArbitrumBase } from './typo_l2_arbitrum_base'
import { dabCashP2p } from './typo_dab_cash'
import { ponziMlm } from './typo_ponzi_mlm'
import { pumpDump } from './typo_pump_dump'
import { nftWash } from './typo_nft_wash'
import { solDrainer } from './typo_sol_drainer'

export const PACK_TYPO: ScenarioTemplate[] = [
  tonTelegramScam,
  l2ArbitrumBase,
  dabCashP2p,
  ponziMlm,
  pumpDump,
  nftWash,
  solDrainer,
]
