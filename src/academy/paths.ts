// Parcours guidés et examens de l'Académie.
import { CURRICULUM, type DrillId, type Exam, type Level, type LearningPath, type PathStep } from './model'

const L = (id: string): PathStep => ({ kind: 'lesson', id })
const M = (id: string, minPct = 60): PathStep => ({ kind: 'mission', id, minPct })
const D = (id: DrillId, target: number): PathStep => ({ kind: 'drill', id, target })
const E = (id: string): PathStep => ({ kind: 'exam', id })

const levelIds = (lv: Level) => CURRICULUM.filter((c) => c.level === lv).map((c) => c.id)

export const EXAMS: Exam[] = [
  { id: 'exam-n0', title: 'Examen — Niveau 0', description: 'Monnaie numérique, clés, blockchain, unités, acteurs et premiers réflexes.', level: 0, lessons: levelIds(0), drills: ['chain-from-address', 'hash-or-address', 'unit-convert'], questions: 15, minutes: 15, passPct: 75 },
  { id: 'exam-n1', title: 'Examen — Niveau 1', description: 'UTXO, frais, modèle à comptes, jetons, stablecoins, exchanges, méthode de suivi.', level: 1, lessons: levelIds(1), drills: ['address-type', 'utxo-fee', 'token-vs-native', 'deposit-vs-hot'], questions: 20, minutes: 20, passPct: 75 },
  { id: 'exam-n2', title: 'Examen — Niveau 2', description: 'Heuristiques, clustering, attribution, exposition, DEX, memos, typologies, OSINT, réquisitions.', level: 2, lessons: levelIds(2), drills: ['utxo-change', 'cioh-cluster', 'xrp-tag', 'risk-category', 'typology', 'taint-method', 'deposit-pattern', 'peel-read', 'hd-path', 'ton-comment', 'ponzi-flow'], questions: 26, minutes: 25, passPct: 75 },
  { id: 'exam-n3', title: 'Examen — Niveau 3', description: 'Bridges, chain hopping, mixeurs, fraudes, rançongiciels, darknet, gel, saisie, rapport, traçage outillé et réglementation.', level: 3, lessons: levelIds(3), drills: ['requisition-target', 'typology', 'coinjoin-spot', 'swap-match', 'taint-method', 'l2-withdrawal', 'wash-trade'], questions: 28, minutes: 25, passPct: 75 },
  { id: 'exam-n4', title: 'Examen — Niveau 4', description: 'CoinJoin, pools, Monero, Lightning, L2, Solana, smart contracts, hacks DeFi, coopération.', level: 4, lessons: levelIds(4), drills: ['coinjoin-spot', 'cioh-cluster', 'pool-demix', 'ln-channel', 'l2-withdrawal'], questions: 26, minutes: 30, passPct: 80 },
  { id: 'exam-n5', title: 'Examen — Niveau 5', description: 'Analyse comportementale, démixage, acteurs étatiques, blanchiment professionnel, expertise, saisie.', level: 5, lessons: levelIds(5), drills: ['requisition-target', 'risk-category', 'wallet-fingerprint', 'pool-demix'], questions: 25, minutes: 30, passPct: 80 },
  { id: 'exam-bitcoin', title: 'Certification — Analyste Bitcoin', description: 'Modèle UTXO, frais, rendu, clustering et peel chains.', level: 2, lessons: ['utxo', 'frais-mempool', 'portefeuilles-hd', 'change-heuristics', 'clustering', 'peel-chains'], drills: ['utxo-fee', 'utxo-change', 'cioh-cluster', 'address-type', 'peel-read', 'hd-path'], questions: 20, minutes: 20, passPct: 80 },
  { id: 'exam-comptes', title: 'Certification — Ethereum, jetons et stablecoins', description: 'Comptes EVM, ERC-20, stablecoins, Tron, DEX et memos.', level: 2, lessons: ['comptes-evm', 'tokens-erc20', 'stablecoins', 'tron-usdt', 'ton-telegram', 'dex-defi', 'xrp-memos', 'gel-stablecoins'], drills: ['token-vs-native', 'xrp-tag', 'deposit-vs-hot', 'deposit-pattern', 'ton-comment'], questions: 20, minutes: 20, passPct: 80 },
  { id: 'exam-interchaines', title: 'Certification — Inter-chaînes et services', description: 'Exchanges, bridges, chain hopping, mixeurs et traçage outillé.', level: 3, lessons: ['exchanges', 'bridges', 'chain-hopping', 'echangeurs-instantanes', 'mixeurs', 'layer2-rollups', 'tracage-outille'], drills: ['deposit-vs-hot', 'requisition-target', 'swap-match', 'deposit-pattern', 'taint-method', 'l2-withdrawal'], questions: 20, minutes: 20, passPct: 80 },
  { id: 'exam-confidentialite', title: 'Certification — Confidentialité avancée', description: 'CoinJoin, pools, Monero, Lightning, démixage et analyse comportementale.', level: 4, lessons: ['coinjoin', 'privacy-pools', 'monero', 'lightning', 'demixage-avance', 'analyse-comportementale'], drills: ['coinjoin-spot', 'cioh-cluster', 'pool-demix', 'wallet-fingerprint', 'ln-channel'], questions: 22, minutes: 25, passPct: 80 },
  { id: 'exam-typologies', title: 'Certification — Typologies criminelles', description: 'Escroqueries, poisoning, drainers, rug pulls, rançongiciels, darknet, hacks et blanchiment.', level: 3, lessons: ['typologies', 'stupefiants-crypto', 'ponzi-mlm', 'address-poisoning', 'drainers-approvals', 'rug-pulls', 'nft-fraudes', 'manipulation-marche', 'ransomware', 'darknet', 'defi-exploits', 'blanchiment-pro', 'acteurs-etatiques'], drills: ['typology', 'risk-category', 'ponzi-flow', 'wash-trade'], questions: 25, minutes: 25, passPct: 80 },
  { id: 'exam-procedure', title: 'Certification — Enquêteur judiciaire crypto', description: 'Réflexes, OSINT, OPSEC, réquisitions, réglementation, gel, saisie, rapport, coopération et expertise.', level: 3, lessons: ['premiers-reflexes', 'osint', 'opsec-enqueteur', 'dab-cash-p2p', 'requisitions', 'cadre-reglementaire', 'gel-saisie', 'gel-stablecoins', 'forensique-supports', 'violences-seed', 'tracage-outille', 'rapport', 'cooperation-internationale', 'expertise-judiciaire', 'saisie-avancee'], drills: ['requisition-target', 'taint-method', 'hd-path'], questions: 25, minutes: 25, passPct: 80 },
  { id: 'exam-affaires', title: 'Certification — Affaires décryptées', description: 'Colonial Pipeline, Silk Road, Hydra, Bitfinex, ChipMixer, Garantex et Bybit : faits, techniques et leçons.', level: 4, lessons: ['affaire-colonial', 'affaire-silk-road', 'affaire-hydra', 'affaire-bitfinex', 'affaire-chipmixer', 'affaire-garantex', 'affaire-bybit'], drills: [], questions: 20, minutes: 20, passPct: 80 },
]

/** Le grand cursus : toutes les leçons dans l'ordre, ponctuées de pratique et d'examens. */
function cursusSteps(): PathStep[] {
  const practice: Partial<Record<Level, PathStep[]>> = {
    0: [M('guide-premiers-pas'), D('chain-from-address', 5), D('hash-or-address', 5), D('unit-convert', 5), M('first-trace'), M('deb-capture-adresse'), M('deb-victimes-multiples')],
    1: [M('guide-exchange'), M('guide-usdt-tron'), D('address-type', 5), D('utxo-fee', 5), D('token-vs-native', 5), M('eth-first'), M('deb-tron-usdt'), M('deb-litecoin'), M('deb-bsc-airdrop'), M('deb-solana-support'), M('deb-ton-commentaire'), M('deb-premier-swap'), M('xrp-destination-tag'), M('guide-rapport')],
    2: [D('utxo-change', 6), D('cioh-cluster', 5), D('peel-read', 4), D('deposit-pattern', 4), D('taint-method', 5), D('hd-path', 4), D('ton-comment', 4), D('ponzi-flow', 4), M('change-anatomy'), M('peel-chain'), M('pig-butchering-tron'), M('stups-telegram'), M('ton-telegram-scam'), M('dab-cash-p2p'), M('sol-drainer'), M('ledger-phishing'), M('recovery-scam'), M('sol-memecoin-rug')],
    3: [D('requisition-target', 5), D('swap-match', 5), D('l2-withdrawal', 4), D('wash-trade', 4), M('chain-hopping'), M('centralized-mixer'), M('address-poisoning'), M('hd-perquisition'), M('forensique-telephone'), M('l2-arbitrum-base'), M('ponzi-mlm'), M('pump-dump'), M('nft-wash'), M('eth-bec-president'), M('eth-account-takeover'), M('donation-funding'), M('money-mules')],
    4: [D('coinjoin-spot', 6), D('pool-demix', 4), D('ln-channel', 4), M('coinjoin-demix'), M('monero-wall'), M('defi-exploit'), M('lightning-cashout'), M('monero-atomic'), M('coinjoin-remix')],
    5: [D('wallet-fingerprint', 5), M('darknet-vendor'), M('ransomware-raas')],
  }
  const steps: PathStep[] = []
  for (const lv of [0, 1, 2, 3, 4, 5] as Level[]) {
    steps.push(...levelIds(lv).map(L), ...(practice[lv] ?? []), E(`exam-n${lv}`))
  }
  return steps
}

export const PATHS: LearningPath[] = [
  {
    id: 'cursus', title: 'Le grand cursus', subtitle: 'De débutant absolu à expert',
    description: 'Le parcours complet : les 54 leçons dans l\'ordre, des exercices et des missions à chaque étape, et un examen pour valider chacun des six niveaux.',
    icon: 'GraduationCap', color: '#22d3ee', levels: [0, 5], steps: cursusSteps(), certificate: 'Cursus complet SPECTRA — Enquêteur crypto-actifs',
  },
  {
    id: 'decouverte', title: 'Découverte', subtitle: 'Je pars de zéro',
    description: 'Comprendre ce qu\'est une crypto-monnaie, une blockchain, une clé et un exchange, lire un explorateur, puis réaliser son premier traçage.',
    icon: 'Sprout', color: '#94a3b8', levels: [0, 0],
    steps: [M('guide-premiers-pas'), ...levelIds(0).map(L), D('chain-from-address', 5), D('hash-or-address', 5), D('unit-convert', 5), M('guide-exchange'), M('first-trace'), M('deb-capture-adresse'), M('deb-victimes-multiples'), M('guide-rapport'), E('exam-n0')],
    certificate: 'Fondamentaux des crypto-actifs',
  },
  {
    id: 'analyste-bitcoin', title: 'Analyste Bitcoin', subtitle: 'Maîtriser le modèle UTXO',
    description: 'Transactions, frais, rendu, clustering et peel chains : toutes les heuristiques d\'analyse Bitcoin, avec leurs limites.',
    icon: 'Bitcoin', color: '#f7931a', levels: [1, 2],
    steps: [L('utxo'), M('deb-litecoin'), D('address-type', 5), L('frais-mempool'), D('utxo-fee', 6), L('portefeuilles-hd'), D('hd-path', 5), M('hd-perquisition'), L('change-heuristics'), D('utxo-change', 8), M('change-anatomy', 70), L('clustering'), D('cioh-cluster', 6), M('sextortion-cluster'), L('peel-chains'), D('peel-read', 5), M('peel-chain'), E('exam-bitcoin')],
    certificate: 'Analyste Bitcoin',
  },
  {
    id: 'ethereum-stablecoins', title: 'Ethereum, jetons & stablecoins', subtitle: 'Le modèle à comptes',
    description: 'Comptes EVM, jetons ERC-20 et TRC-20, stablecoins et leurs émetteurs, Tron, swaps sur DEX et destination tags.',
    icon: 'Hexagon', color: '#8c9eff', levels: [1, 2],
    steps: [L('comptes-evm'), M('guide-exchange'), L('tokens-erc20'), D('token-vs-native', 6), M('eth-first'), M('deb-bsc-airdrop'), M('deb-solana-support'), L('stablecoins'), L('tron-usdt'), M('guide-usdt-tron'), M('deb-tron-usdt'), D('deposit-pattern', 5), M('pig-butchering-tron'), L('dex-defi'), M('deb-premier-swap'), M('dex-swap'), L('xrp-memos'), D('xrp-tag', 5), M('xrp-destination-tag'), L('ton-telegram'), D('ton-comment', 5), M('deb-ton-commentaire'), M('ton-telegram-scam'), L('gel-stablecoins'), E('exam-comptes')],
    certificate: 'Ethereum, jetons et stablecoins',
  },
  {
    id: 'interchaines', title: 'Inter-chaînes & services', subtitle: 'Quand les fonds changent de chaîne',
    description: 'Exchanges, bridges, échangeurs instantanés et mixeurs : suivre les fonds quand le lien on-chain se brise, et corréler.',
    icon: 'Waypoints', color: '#a78bfa', levels: [1, 3],
    steps: [L('exchanges'), D('deposit-vs-hot', 6), L('bridges'), L('chain-hopping'), L('echangeurs-instantanes'), D('swap-match', 6), M('chain-hopping'), L('layer2-rollups'), D('l2-withdrawal', 5), M('l2-arbitrum-base'), L('mixeurs'), M('centralized-mixer'), L('tracage-outille'), D('taint-method', 6), E('exam-interchaines')],
    certificate: 'Inter-chaînes et services',
  },
  {
    id: 'confidentialite', title: 'Confidentialité avancée', subtitle: 'CoinJoin, pools, Monero',
    description: 'Les techniques d\'anonymisation, ce qu\'elles cachent vraiment, les erreurs qui trahissent leurs utilisateurs et les limites du démixage.',
    icon: 'EyeOff', color: '#f43f5e', levels: [4, 5],
    steps: [L('coinjoin'), D('coinjoin-spot', 8), M('coinjoin-demix'), L('privacy-pools'), D('pool-demix', 5), M('defi-exploit'), L('monero'), M('monero-wall'), M('monero-atomic'), L('lightning'), D('ln-channel', 5), M('lightning-cashout'), L('analyse-comportementale'), D('wallet-fingerprint', 5), M('coinjoin-remix'), L('demixage-avance'), E('exam-confidentialite')],
    certificate: 'Confidentialité avancée',
  },
  {
    id: 'typologies', title: 'Typologies criminelles', subtitle: 'Reconnaître les schémas',
    description: 'Escroqueries, address poisoning, drainers, rug pulls, rançongiciels, darknet, hacks DeFi, blanchiment professionnel et acteurs étatiques.',
    icon: 'Siren', color: '#f97316', levels: [2, 5],
    steps: [L('typologies'), D('typology', 10), L('stupefiants-crypto'), M('stups-telegram'), L('ponzi-mlm'), D('ponzi-flow', 5), M('ponzi-mlm'), L('address-poisoning'), M('address-poisoning'), L('drainers-approvals'), L('rug-pulls'), M('rugpull-bsc'), M('sol-drainer'), L('nft-fraudes'), D('wash-trade', 5), M('nft-wash'), L('manipulation-marche'), M('pump-dump'), M('sol-memecoin-rug'), L('ransomware'), M('ransomware-raas'), L('darknet'), M('darknet-vendor'), L('defi-exploits'), D('risk-category', 8), M('ledger-phishing'), M('recovery-scam'), M('eth-bec-president'), M('eth-account-takeover'), M('donation-funding'), L('blanchiment-pro'), M('money-mules'), L('acteurs-etatiques'), E('exam-typologies')],
    certificate: 'Typologies criminelles',
  },
  {
    id: 'enqueteur', title: 'Enquêteur judiciaire', subtitle: 'De la plainte à l\'audience',
    description: 'Réflexes, OSINT, OPSEC, réquisitions, réglementation, gel et saisie, traçage outillé, rapport, coopération internationale, expertise et contradictoire.',
    icon: 'Scale', color: '#22d3ee', levels: [0, 5],
    steps: [L('premiers-reflexes'), L('osint'), L('opsec-enqueteur'), L('dab-cash-p2p'), M('dab-cash-p2p'), L('requisitions'), D('requisition-target', 10), M('first-trace'), M('guide-rapport'), L('cadre-reglementaire'), L('gel-saisie'), L('gel-stablecoins'), M('pig-butchering-tron'), L('forensique-supports'), M('forensique-telephone'), L('violences-seed'), M('tron-kidnapping-ransom'), L('tracage-outille'), D('taint-method', 5), L('rapport'), L('cooperation-internationale'), L('expertise-judiciaire'), L('saisie-avancee'), M('hd-perquisition'), E('exam-procedure')],
    certificate: 'Enquêteur judiciaire crypto-actifs',
  },
]

export const PATH_AFFAIRES = {
  id: 'affaires', title: 'Affaires décryptées', subtitle: 'Apprendre des grands dossiers',
  description: 'Sept dossiers publics disséqués à partir des documents officiels : ce qui a permis de remonter les fonds, les erreurs des auteurs et ce qu\'un enquêteur français peut en transposer.',
  icon: 'Newspaper', color: '#eab308', levels: [3, 5] as [Level, Level],
  steps: [L('affaire-colonial'), M('ransomware-raas'), L('affaire-silk-road'), M('peel-chain'), L('affaire-hydra'), M('darknet-vendor'), L('affaire-bitfinex'), M('chain-hopping'), L('affaire-chipmixer'), M('centralized-mixer'), L('affaire-garantex'), M('tron-sanctions-garantex'), L('affaire-bybit'), M('exchange-hack'), E('exam-affaires')],
  certificate: 'Affaires décryptées',
}
PATHS.push(PATH_AFFAIRES)

export function pathById(id: string): LearningPath | undefined {
  return PATHS.find((p) => p.id === id)
}

export function examById(id: string): Exam | undefined {
  return EXAMS.find((e) => e.id === id)
}
