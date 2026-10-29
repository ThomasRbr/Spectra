// Pack Bitcoin (modèle UTXO) : lecture de transaction, rendu, clustering,
// peel chains, mixeurs, CoinJoin, darknet et rançongiciels.
import type { ScenarioTemplate } from './types'
import { btcChangeAnatomy } from './btc_change_anatomy'
import { btcPeelChain } from './btc_peel_chain'
import { btcSextortionCluster } from './btc_sextortion_cluster'
import { btcCentralizedMixer } from './btc_centralized_mixer'
import { btcCoinjoinDemix } from './btc_coinjoin_demix'
import { btcDarknetVendor } from './btc_darknet_vendor'
import { btcRansomwareRaas } from './btc_ransomware_raas'

export const PACK_BTC: ScenarioTemplate[] = [
  btcChangeAnatomy,
  btcPeelChain,
  btcSextortionCluster,
  btcCentralizedMixer,
  btcCoinjoinDemix,
  btcDarknetVendor,
  btcRansomwareRaas,
]
