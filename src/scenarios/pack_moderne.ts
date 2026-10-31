// Pack « Bitcoin moderne et autres UTXO » : coffre multisig et Taproot,
// inscriptions ordinales et runes, Cardano (clés de staking), piratage de bridge.
import type { ScenarioTemplate } from './types'
import { btcMultisigTaproot } from './btc_multisig_taproot'
import { btcOrdinalsVol } from './btc_ordinals_vol'
import { adaCardanoStaking } from './ada_cardano_staking'
import { ethBridgeValidateurs } from './eth_bridge_validateurs'

export const PACK_MODERNE: ScenarioTemplate[] = [btcMultisigTaproot, btcOrdinalsVol, adaCardanoStaking, ethBridgeValidateurs]
