// Pack « affaires opérationnelles » : typologies rencontrées en service
// (urgence et gel, fraude au président, mules, piratage d'exchange,
// sanctions, SIM swap, phishing de seed, Solana, collecte illicite).
import type { ScenarioTemplate } from './types'
import { solMemecoinRug } from './sol_memecoin_rug'
import { btcLedgerPhishing } from './btc_ledger_phishing'
import { btcRecoveryScam } from './btc_recovery_scam'
import { btcDonationFunding } from './btc_donation_funding'
import { ethBecPresident } from './eth_bec_president'
import { tronKidnappingRansom } from './tron_kidnapping_ransom'
import { tronSanctionsGarantex } from './tron_sanctions_garantex'
import { ethAccountTakeover } from './eth_account_takeover'
import { btcMoneyMules } from './btc_money_mules'
import { ethExchangeHack } from './eth_exchange_hack'

export const PACK_OPS: ScenarioTemplate[] = [
  solMemecoinRug,
  btcLedgerPhishing,
  btcRecoveryScam,
  btcDonationFunding,
  ethBecPresident,
  tronKidnappingRansom,
  tronSanctionsGarantex,
  ethAccountTakeover,
  btcMoneyMules,
  ethExchangeHack,
]
