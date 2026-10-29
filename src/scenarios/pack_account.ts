// Pack « modèles à comptes & inter-chaînes » : Ethereum, XRP, Tron, BSC,
// DEX, bridges, échangeurs instantanés, Monero et pools de confidentialité.
import type { ScenarioTemplate } from './types'
import { accEthFirst } from './acc_eth_first'
import { accXrpDestinationTag } from './acc_xrp_destination_tag'
import { accDexSwap } from './acc_dex_swap'
import { accAddressPoisoning } from './acc_address_poisoning'
import { accChainHopping } from './acc_chain_hopping'
import { accMoneroWall } from './acc_monero_wall'
import { accDefiExploit } from './acc_defi_exploit'
import { accRugpullBsc } from './acc_rugpull_bsc'

export const PACK_ACCOUNT: ScenarioTemplate[] = [
  accEthFirst,
  accXrpDestinationTag,
  accDexSwap,
  accAddressPoisoning,
  accChainHopping,
  accMoneroWall,
  accDefiExploit,
  accRugpullBsc,
]
