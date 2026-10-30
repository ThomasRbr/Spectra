// Pack « terrain » : affaires construites autour d'actes d'enquête
// (perquisition, exploitation de supports, réquisitions) et de techniques
// avancées (portefeuilles HD, Lightning, Monero, CoinJoin, stupéfiants).
import type { ScenarioTemplate } from './types'
import { btcHdPerquisition } from './btc_hd_perquisition'
import { ethForensiqueTelephone } from './eth_forensique_telephone'
import { btcLightningCashout } from './btc_lightning_cashout'
import { btcMoneroAtomic } from './btc_monero_atomic'
import { btcCoinjoinRemix } from './btc_coinjoin_remix'
import { btcStupsTelegram } from './btc_stups_telegram'

export const PACK_TERRAIN: ScenarioTemplate[] = [btcHdPerquisition, ethForensiqueTelephone, btcLightningCashout, btcMoneroAtomic, btcCoinjoinRemix, btcStupsTelegram]
