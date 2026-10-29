import type { ComponentType } from 'react'
import type { WidgetId } from '../model'
import HashPlayground from './HashPlayground'
import ChainTamper from './ChainTamper'
import KeysDerivation from './KeysDerivation'
import UnitConverter from './UnitConverter'
import AddressAnatomy from './AddressAnatomy'
import UtxoBuilder from './UtxoBuilder'
import FeeMempool from './FeeMempool'
import AccountVsUtxo from './AccountVsUtxo'
import ChangeDetective from './ChangeDetective'
import CiohCluster from './CiohCluster'
import PeelChain from './PeelChain'
import ExchangeFlow from './ExchangeFlow'
import AmmSwap from './AmmSwap'
import BridgeFlow from './BridgeFlow'
import CoinjoinVisualizer from './CoinjoinVisualizer'
import PrivacyPool from './PrivacyPool'
import TimingCorrelation from './TimingCorrelation'
import RiskExposure from './RiskExposure'

/** Registre des simulateurs interactifs utilisables dans les leçons. */
export const WIDGETS: Partial<Record<WidgetId, { title: string; component: ComponentType }>> = {
  'hash-playground': { title: 'Empreinte numérique (SHA-256)', component: HashPlayground },
  'chain-tamper': { title: 'Falsifier une blockchain ?', component: ChainTamper },
  'keys-derivation': { title: 'De la clé privée à l\'adresse', component: KeysDerivation },
  'unit-converter': { title: 'Convertisseur d\'unités et de décimales', component: UnitConverter },
  'address-anatomy': { title: 'Anatomie d\'une adresse', component: AddressAnatomy },
  'utxo-builder': { title: 'Construire une transaction UTXO', component: UtxoBuilder },
  'fee-mempool': { title: 'Frais et mempool', component: FeeMempool },
  'account-vs-utxo': { title: 'UTXO ou modèle à comptes', component: AccountVsUtxo },
  'change-detective': { title: 'Détecter l\'adresse de rendu', component: ChangeDetective },
  'cioh-cluster': { title: 'Clustering par entrées communes', component: CiohCluster },
  'peel-chain': { title: 'Anatomie d\'une peel chain', component: PeelChain },
  'exchange-flow': { title: 'Le parcours d\'un dépôt en exchange', component: ExchangeFlow },
  'amm-swap': { title: 'Swap sur un pool AMM', component: AmmSwap },
  'bridge-flow': { title: 'Suivre un bridge par le nonce', component: BridgeFlow },
  'coinjoin-visualizer': { title: 'Dans un CoinJoin', component: CoinjoinVisualizer },
  'privacy-pool': { title: 'Pool de confidentialité et anonymity set', component: PrivacyPool },
  'timing-correlation': { title: 'Corrélation montant / délai', component: TimingCorrelation },
  'risk-exposure': { title: 'Exposition directe et indirecte', component: RiskExposure },
}
