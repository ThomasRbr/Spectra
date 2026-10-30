// Parcours guidés et examens de l'Académie.
import { CURRICULUM, type DrillId, type Exam, type Level, type LearningPath, type PathStep } from './model'
import { DRILL_ANCHORS, MIN_LEVEL_BY_DIFFICULTY, MISSION_PREREQS } from './prereqs'
import { SCENARIOS } from '../scenarios'

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

/**
 * Le grand cursus : toutes les leçons dans l'ordre. Chaque exercice suit sa
 * leçon d'ancrage, chaque mission suit le dernier de ses prérequis (sans
 * descendre sous le niveau minimal de sa difficulté) et un examen clôt
 * chaque niveau.
 */
function cursusSteps(): PathStep[] {
  const order = CURRICULUM.map((c) => c.id)
  const pos = (id: string) => order.indexOf(id)
  const firstOfLevel = (lv: Level) => CURRICULUM.findIndex((c) => c.level >= lv)
  // Missions rangées par ancrage : « a:i » après la leçon i, « s:i » en ouverture
  // du niveau qui commence à la leçon i (mission retenue par sa difficulté)
  const missionsAt = new Map<string, typeof SCENARIOS>()
  for (const s of SCENARIOS) {
    const after = Math.max(-1, ...(MISSION_PREREQS[s.id] ?? []).map(pos))
    const start = firstOfLevel(MIN_LEVEL_BY_DIFFICULTY[s.difficulty] ?? 0)
    const key = after >= start ? `a:${after}` : `s:${start}`
    missionsAt.set(key, [...(missionsAt.get(key) ?? []), s])
  }
  const rank = (s: (typeof SCENARIOS)[number]) => (s.guided ? 0 : 10) + s.difficulty
  const missions = (at: string) => [...(missionsAt.get(at) ?? [])].sort((a, b) => rank(a) - rank(b)).map((s) => M(s.id))
  const drills = (lesson: string) =>
    (Object.entries(DRILL_ANCHORS) as [DrillId, { lesson: string; target: number }][]).filter(([, a]) => a.lesson === lesson).map(([id, a]) => D(id, a.target))
  const steps: PathStep[] = []
  CURRICULUM.forEach((c, i) => {
    steps.push(...missions(`s:${i}`), L(c.id), ...drills(c.id), ...missions(`a:${i}`))
    const next = CURRICULUM[i + 1]
    if (!next || next.level !== c.level) steps.push(E(`exam-n${c.level}`))
  })
  return steps
}

export const PATHS: LearningPath[] = [
  {
    id: 'cursus', title: 'Le grand cursus', subtitle: 'De débutant absolu à expert',
    description: `Le parcours complet : les ${CURRICULUM.length} leçons dans l'ordre, chaque exercice juste après sa leçon, chaque mission dès que ses prérequis sont lus, et un examen pour valider chacun des six niveaux.`,
    icon: 'GraduationCap', color: '#22d3ee', levels: [0, 5], steps: cursusSteps(), certificate: 'Cursus complet SPECTRA — Enquêteur crypto-actifs',
  },
  {
    id: 'decouverte', title: 'Découverte', subtitle: 'Je pars de zéro',
    description: 'Comprendre ce qu\'est une crypto-monnaie, une blockchain, une clé et un exchange, lire un explorateur, puis réaliser son premier traçage.',
    icon: 'Sprout', color: '#94a3b8', levels: [0, 0],
    steps: [L('argent-numerique'), L('crypto-sans-maths'), L('bases-blockchain'), D('chain-from-address', 5), L('cles-portefeuilles'), L('unites-ordres'), D('unit-convert', 5), L('ecosysteme-acteurs'), L('explorateur-blocs'), D('hash-or-address', 5), M('guide-premiers-pas'), L('premiers-reflexes'), M('deb-capture-adresse'), E('exam-n0'), L('utxo'), L('exchanges'), M('first-trace'), L('suivre-flux'), M('deb-victimes-multiples'), M('guide-rapport')],
    certificate: 'Fondamentaux des crypto-actifs',
  },
  {
    id: 'analyste-bitcoin', title: 'Analyste Bitcoin', subtitle: 'Maîtriser le modèle UTXO',
    description: 'Transactions, frais, rendu, clustering et peel chains : toutes les heuristiques d\'analyse Bitcoin, avec leurs limites.',
    icon: 'Bitcoin', color: '#f7931a', levels: [1, 2],
    steps: [L('utxo'), D('address-type', 5), L('frais-mempool'), D('utxo-fee', 6), L('change-heuristics'), D('utxo-change', 8), M('change-anatomy', 70), M('deb-litecoin'), L('clustering'), D('cioh-cluster', 6), M('sextortion-cluster'), L('peel-chains'), D('peel-read', 5), M('peel-chain'), L('portefeuilles-hd'), D('hd-path', 5), E('exam-bitcoin')],
    certificate: 'Analyste Bitcoin',
  },
  {
    id: 'ethereum-stablecoins', title: 'Ethereum, jetons & stablecoins', subtitle: 'Le modèle à comptes',
    description: 'Comptes EVM, jetons ERC-20 et TRC-20, stablecoins et leurs émetteurs, Tron, swaps sur DEX, destination tags, Solana et TON.',
    icon: 'Hexagon', color: '#8c9eff', levels: [1, 2],
    steps: [L('comptes-evm'), L('tokens-erc20'), D('token-vs-native', 6), L('exchanges'), D('deposit-vs-hot', 5), M('guide-exchange'), M('eth-first'), L('stablecoins'), M('deb-bsc-airdrop'), L('tron-usdt'), M('guide-usdt-tron'), M('deb-tron-usdt'), D('deposit-pattern', 5), L('dex-defi'), M('deb-premier-swap'), M('dex-swap'), L('xrp-memos'), D('xrp-tag', 5), M('xrp-destination-tag'), L('solana'), M('deb-solana-support'), L('ton-telegram'), D('ton-comment', 5), M('deb-ton-commentaire'), L('gel-stablecoins'), E('exam-comptes')],
    certificate: 'Ethereum, jetons et stablecoins',
  },
  {
    id: 'interchaines', title: 'Inter-chaînes & services', subtitle: 'Quand les fonds changent de chaîne',
    description: 'Exchanges, bridges, échangeurs instantanés et mixeurs : suivre les fonds quand le lien on-chain se brise, et corréler.',
    icon: 'Waypoints', color: '#a78bfa', levels: [1, 3],
    requires: 'Prérequis : niveau 1 (UTXO, modèle à comptes, jetons) et la leçon DEX et DeFi.',
    steps: [L('exchanges'), D('deposit-vs-hot', 6), L('bridges'), L('chain-hopping'), M('chain-hopping'), L('echangeurs-instantanes'), D('swap-match', 6), M('monero-wall'), L('mixeurs'), M('centralized-mixer'), L('layer2-rollups'), D('l2-withdrawal', 5), M('l2-arbitrum-base'), L('tracage-outille'), D('taint-method', 6), E('exam-interchaines')],
    certificate: 'Inter-chaînes et services',
  },
  {
    id: 'confidentialite', title: 'Confidentialité avancée', subtitle: 'CoinJoin, pools, Monero',
    description: 'Les techniques d\'anonymisation, ce qu\'elles cachent vraiment, les erreurs qui trahissent leurs utilisateurs et les limites du démixage.',
    icon: 'EyeOff', color: '#f43f5e', levels: [4, 5],
    requires: 'Prérequis : le parcours Analyste Bitcoin (UTXO, rendu, clustering) et la leçon Échangeurs instantanés.',
    steps: [L('coinjoin'), D('coinjoin-spot', 8), M('coinjoin-demix'), L('privacy-pools'), D('pool-demix', 5), L('monero'), L('lightning'), D('ln-channel', 5), M('lightning-cashout'), M('monero-atomic'), L('analyse-comportementale'), D('wallet-fingerprint', 5), L('demixage-avance'), M('coinjoin-remix'), E('exam-confidentialite')],
    certificate: 'Confidentialité avancée',
  },
  {
    id: 'typologies', title: 'Typologies criminelles', subtitle: 'Reconnaître les schémas',
    description: 'Escroqueries, address poisoning, drainers, rug pulls, rançongiciels, darknet, hacks DeFi, blanchiment professionnel et acteurs étatiques.',
    icon: 'Siren', color: '#f97316', levels: [2, 5],
    requires: 'Prérequis : niveaux 0 et 1, plus Clustering, Bridges, Chain hopping et Mixeurs pour les affaires de fin de parcours.',
    steps: [L('typologies'), D('typology', 10), M('eth-bec-president'), M('ledger-phishing'), M('recovery-scam'), L('dab-cash-p2p'), L('stupefiants-crypto'), M('stups-telegram'), L('ponzi-mlm'), D('ponzi-flow', 5), M('ponzi-mlm'), L('address-poisoning'), M('address-poisoning'), L('drainers-approvals'), M('sol-drainer'), L('rug-pulls'), M('rugpull-bsc'), M('sol-memecoin-rug'), L('nft-fraudes'), D('wash-trade', 5), M('nft-wash'), L('manipulation-marche'), M('pump-dump'), M('eth-account-takeover'), L('ransomware'), M('ransomware-raas'), L('darknet'), M('darknet-vendor'), L('defi-exploits'), D('risk-category', 8), L('blanchiment-pro'), M('money-mules'), M('donation-funding'), L('acteurs-etatiques'), E('exam-typologies')],
    certificate: 'Typologies criminelles',
  },
  {
    id: 'enqueteur', title: 'Enquêteur judiciaire', subtitle: 'De la plainte à l\'audience',
    description: 'Réflexes, OSINT, OPSEC, réquisitions, réglementation, gel et saisie, traçage outillé, rapport, coopération internationale, expertise et contradictoire.',
    icon: 'Scale', color: '#22d3ee', levels: [0, 5],
    requires: 'Les missions de ce parcours supposent le niveau 1 (UTXO, exchanges, stablecoins, Tron) : suivez-le d\'abord si besoin.',
    steps: [L('premiers-reflexes'), L('suivre-flux'), M('guide-rapport'), L('osint'), L('opsec-enqueteur'), L('dab-cash-p2p'), M('dab-cash-p2p'), L('requisitions'), D('requisition-target', 10), L('cadre-reglementaire'), L('gel-saisie'), L('gel-stablecoins'), M('pig-butchering-tron'), L('forensique-supports'), M('forensique-telephone'), L('portefeuilles-hd'), M('hd-perquisition'), L('violences-seed'), M('tron-kidnapping-ransom'), L('tracage-outille'), D('taint-method', 5), L('rapport'), L('cooperation-internationale'), L('expertise-judiciaire'), L('saisie-avancee'), E('exam-procedure')],
    certificate: 'Enquêteur judiciaire crypto-actifs',
  },
]

export const PATH_AFFAIRES: LearningPath = {
  id: 'affaires', title: 'Affaires décryptées', subtitle: 'Apprendre des grands dossiers',
  description: 'Sept dossiers publics disséqués à partir des documents officiels : ce qui a permis de remonter les fonds, les erreurs des auteurs et ce qu\'un enquêteur français peut en transposer.',
  icon: 'Newspaper', color: '#eab308', levels: [3, 5],
  requires: 'Prérequis : niveaux 0 à 2 du grand cursus, puis Rançongiciels, Darknet, Mixeurs, Bridges, Chain hopping et Échangeurs instantanés. Chaque leçon d\'affaire se lit seule ; les missions associées sont exigeantes.',
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
