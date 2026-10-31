// Prérequis pédagogiques des missions et ancrage des exercices.
// Le champ `lessons` d'un scénario mêle ce qu'il faut savoir et les lectures
// complémentaires ; cette table ne garde que l'indispensable : la mission se
// place dans les parcours juste après le dernier de ses prérequis.
import type { DrillId, Level } from './model'

/** Leçons à avoir lues avant de lancer la mission (ordre indifférent). */
export const MISSION_PREREQS: Record<string, string[]> = {
  // Missions guidées
  'guide-premiers-pas': ['bases-blockchain', 'explorateur-blocs'],
  'guide-exchange': ['comptes-evm', 'exchanges'],
  'guide-usdt-tron': ['tron-usdt'],
  'guide-rapport': ['suivre-flux'],
  // Débutant
  'deb-capture-adresse': ['explorateur-blocs', 'premiers-reflexes'],
  'first-trace': ['utxo', 'exchanges'],
  'eth-first': ['comptes-evm', 'tokens-erc20', 'exchanges'],
  'deb-tron-usdt': ['tron-usdt', 'exchanges'],
  'deb-bsc-airdrop': ['tokens-erc20', 'stablecoins', 'exchanges'],
  'deb-victimes-multiples': ['utxo', 'suivre-flux'],
  'change-anatomy': ['utxo', 'change-heuristics'],
  'deb-litecoin': ['utxo', 'change-heuristics'],
  'deb-premier-swap': ['tokens-erc20', 'dex-defi'],
  'xrp-destination-tag': ['xrp-memos'],
  'deb-solana-support': ['solana'],
  'deb-ton-commentaire': ['ton-telegram'],
  // Intermédiaire
  'sextortion-cluster': ['clustering'],
  'peel-chain': ['peel-chains'],
  'dex-swap': ['dex-defi'],
  'pig-butchering-tron': ['tron-usdt', 'typologies'],
  'eth-bec-president': ['stablecoins', 'typologies'],
  'ledger-phishing': ['cles-portefeuilles', 'typologies'],
  'recovery-scam': ['clustering', 'typologies'],
  'donation-funding': ['attribution-sources', 'osint'],
  'ton-telegram-scam': ['ton-telegram', 'typologies'],
  'dab-cash-p2p': ['dab-cash-p2p'],
  'stups-telegram': ['dab-cash-p2p', 'stupefiants-crypto'],
  'address-poisoning': ['address-poisoning'],
  'sol-memecoin-rug': ['solana', 'rug-pulls'],
  'sol-drainer': ['solana', 'drainers-approvals'],
  // Confirmé
  'money-mules': ['clustering', 'requisitions', 'dab-cash-p2p'],
  'ponzi-mlm': ['ponzi-mlm'],
  'chain-hopping': ['bridges', 'chain-hopping'],
  'centralized-mixer': ['mixeurs'],
  'rugpull-bsc': ['bridges', 'rug-pulls'],
  'tron-sanctions-garantex': ['exposition-risque', 'cadre-reglementaire'],
  'eth-account-takeover': ['dex-defi', 'echangeurs-instantanes'],
  'monero-wall': ['chain-hopping', 'echangeurs-instantanes'],
  'tron-kidnapping-ransom': ['gel-stablecoins', 'violences-seed'],
  'hd-perquisition': ['portefeuilles-hd', 'forensique-supports'],
  'forensique-telephone': ['forensique-supports', 'echangeurs-instantanes'],
  'nft-wash': ['nft-fraudes'],
  'pump-dump': ['manipulation-marche'],
  'coinjoin-demix': ['coinjoin'],
  'l2-arbitrum-base': ['layer2-rollups'],
  // Avancé
  'darknet-vendor': ['clustering', 'darknet', 'chain-hopping'],
  'ransomware-raas': ['ransomware', 'mixeurs'],
  'defi-exploit': ['privacy-pools', 'defi-exploits'],
  'lightning-cashout': ['lightning'],
  'monero-atomic': ['monero', 'echangeurs-instantanes', 'lightning'],
  'coinjoin-remix': ['coinjoin', 'demixage-avance'],
  'exchange-hack': ['bridges', 'coinjoin', 'acteurs-etatiques'],
  // Smart contracts et DeFi
  'depot-contrat': ['contrats-depot-create2'],
  'splitter-internes': ['transactions-internes', 'calldata-selecteurs'],
  'approve-drain': ['calldata-selecteurs', 'drainers-approvals', 'agregateurs-routeurs'],
  'lending-garantie': ['pret-garantie'],
  'lp-blanchiment': ['pools-liquidite'],
  // Bitcoin moderne et autres UTXO
  'multisig-taproot': ['bitcoin-moderne'],
  'cardano-staking': ['cardano-eutxo'],
  'ordinals-vol': ['ordinals-runes'],
  'bridge-validateurs': ['affaire-ronin', 'privacy-pools', 'blanchiment-defi'],
}

/** Niveau d'Académie minimal selon la difficulté : une affaire difficile ne tombe pas trop tôt. */
export const MIN_LEVEL_BY_DIFFICULTY: Record<number, Level> = { 1: 0, 2: 1, 3: 3, 4: 4 }

/** Leçon après laquelle chaque exercice généré prend place, et objectif de bonnes réponses. */
export const DRILL_ANCHORS: Record<DrillId, { lesson: string; target: number }> = {
  'chain-from-address': { lesson: 'bases-blockchain', target: 5 },
  'unit-convert': { lesson: 'unites-ordres', target: 5 },
  'hash-or-address': { lesson: 'explorateur-blocs', target: 5 },
  'address-type': { lesson: 'utxo', target: 5 },
  'utxo-fee': { lesson: 'frais-mempool', target: 5 },
  'token-vs-native': { lesson: 'tokens-erc20', target: 5 },
  'deposit-vs-hot': { lesson: 'exchanges', target: 5 },
  'utxo-change': { lesson: 'change-heuristics', target: 6 },
  'cioh-cluster': { lesson: 'clustering', target: 5 },
  'peel-read': { lesson: 'peel-chains', target: 4 },
  'deposit-pattern': { lesson: 'attribution-sources', target: 4 },
  'taint-method': { lesson: 'exposition-risque', target: 5 },
  'risk-category': { lesson: 'exposition-risque', target: 5 },
  'xrp-tag': { lesson: 'xrp-memos', target: 4 },
  typology: { lesson: 'typologies', target: 6 },
  'requisition-target': { lesson: 'requisitions', target: 5 },
  'hd-path': { lesson: 'portefeuilles-hd', target: 4 },
  'ton-comment': { lesson: 'ton-telegram', target: 4 },
  'ponzi-flow': { lesson: 'ponzi-mlm', target: 4 },
  'swap-match': { lesson: 'echangeurs-instantanes', target: 5 },
  'wash-trade': { lesson: 'nft-fraudes', target: 4 },
  'coinjoin-spot': { lesson: 'coinjoin', target: 6 },
  'pool-demix': { lesson: 'privacy-pools', target: 4 },
  'ln-channel': { lesson: 'lightning', target: 4 },
  'l2-withdrawal': { lesson: 'layer2-rollups', target: 4 },
  'wallet-fingerprint': { lesson: 'analyse-comportementale', target: 5 },
  'leg-kind': { lesson: 'transactions-internes', target: 5 },
  'event-read': { lesson: 'transactions-internes', target: 4 },
  'selector-decode': { lesson: 'calldata-selecteurs', target: 5 },
  'forwarder-spot': { lesson: 'contrats-depot-create2', target: 4 },
  'aggregator-route': { lesson: 'agregateurs-routeurs', target: 4 },
  'receipt-token': { lesson: 'jetons-enveloppes', target: 5 },
  'witness-type': { lesson: 'bitcoin-moderne', target: 5 },
  'vsize-fee': { lesson: 'bitcoin-moderne', target: 4 },
  'stake-cluster': { lesson: 'cardano-eutxo', target: 4 },
  'collateral-link': { lesson: 'pret-garantie', target: 4 },
  'lp-trace': { lesson: 'pools-liquidite', target: 4 },
  'ordinal-carrier': { lesson: 'ordinals-runes', target: 4 },
}

/** Prérequis d'une mission (vide si inconnue). */
export function missionPrereqs(id: string): string[] {
  return MISSION_PREREQS[id] ?? []
}
