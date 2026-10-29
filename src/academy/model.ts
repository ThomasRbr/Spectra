// Modèle de l'Académie SPECTRA : niveaux, filières, leçons en blocs,
// parcours, examens et exercices générés.
import type { ChainId } from '../engine/chains'

// ── Niveaux et filières ────────────────────────────────────────────────────

export type Level = 0 | 1 | 2 | 3 | 4 | 5

export const LEVELS: Record<Level, { label: string; short: string; color: string; description: string }> = {
  0: { label: 'Débutant absolu', short: 'N0', color: '#94a3b8', description: 'Aucun prérequis : monnaie numérique, clés, blockchain, explorateurs.' },
  1: { label: 'Initié', short: 'N1', color: '#34d399', description: 'Lire une transaction Bitcoin ou Ethereum, comprendre exchanges et stablecoins.' },
  2: { label: 'Intermédiaire', short: 'N2', color: '#facc15', description: 'Heuristiques, clustering, attribution, typologies, premières réquisitions.' },
  3: { label: 'Confirmé', short: 'N3', color: '#fb923c', description: 'Bridges, chain hopping, mixeurs, fraudes DeFi, réglementation, gel et saisie, traçage outillé, rapport.' },
  4: { label: 'Avancé', short: 'N4', color: '#f43f5e', description: 'CoinJoin, pools de confidentialité, Monero, Lightning, L2, hacks DeFi.' },
  5: { label: 'Expert', short: 'N5', color: '#a78bfa', description: 'Analyse comportementale, démixage, acteurs étatiques, expertise judiciaire.' },
}

export type Track = 'bases' | 'bitcoin' | 'comptes' | 'stablecoins' | 'interchaines' | 'confidentialite' | 'typologies' | 'enquete' | 'methodo'

export const TRACKS: Record<Track, { label: string; icon: string; color: string }> = {
  bases: { label: 'Fondamentaux', icon: 'Blocks', color: '#94a3b8' },
  bitcoin: { label: 'Bitcoin & UTXO', icon: 'Bitcoin', color: '#f7931a' },
  comptes: { label: 'Ethereum & modèle à comptes', icon: 'Hexagon', color: '#8c9eff' },
  stablecoins: { label: 'Stablecoins & Tron', icon: 'BadgeDollarSign', color: '#26a17b' },
  interchaines: { label: 'Inter-chaînes', icon: 'Waypoints', color: '#a78bfa' },
  confidentialite: { label: 'Confidentialité', icon: 'EyeOff', color: '#f43f5e' },
  typologies: { label: 'Typologies criminelles', icon: 'Siren', color: '#f97316' },
  enquete: { label: 'Procédure & enquête', icon: 'Scale', color: '#22d3ee' },
  methodo: { label: 'Méthodologie d\'analyse', icon: 'Microscope', color: '#38bdf8' },
}

// ── Blocs de contenu ───────────────────────────────────────────────────────
//
// Texte « md » = markdown léger : paragraphes séparés par une ligne vide,
// listes « - » ou « 1. », **gras**, `code`. Pas de HTML.

/** Simulateurs interactifs intégrables dans une leçon (voir src/academy/widgets). */
export type WidgetId =
  | 'hash-playground' // taper un texte, voir l'empreinte SHA-256 et l'effet avalanche
  | 'chain-tamper' // chaîne de blocs : modifier un bloc casse tous les suivants
  | 'keys-derivation' // clé privée → clé publique → adresse (schéma interactif)
  | 'unit-converter' // sats ↔ BTC, wei/gwei ↔ ETH, décimales des jetons, USD
  | 'address-anatomy' // reconnaître chaîne et type d'adresse à partir du préfixe
  | 'utxo-builder' // choisir des UTXO pour payer : rendu et frais calculés
  | 'fee-mempool' // taux de frais, taille, priorité de confirmation
  | 'account-vs-utxo' // même paiement vu en UTXO et en modèle à comptes
  | 'change-detective' // activer/désactiver des heuristiques de rendu sur une transaction
  | 'cioh-cluster' // relier des adresses par entrées communes, effet d'un CoinJoin
  | 'peel-chain' // animation d'une peel chain, saut par saut
  | 'exchange-flow' // dépôt client → balayage → hot wallet → cold wallet
  | 'amm-swap' // swap sur un pool AMM : prix, slippage, legs de la transaction
  | 'bridge-flow' // départ, événement, arrivée sur l'autre chaîne (nonce)
  | 'coinjoin-visualizer' // entrées/sorties égales, rendu toxique, erreur post-mix
  | 'privacy-pool' // dépôts/retraits à dénomination fixe, anonymity set, timing
  | 'timing-correlation' // corréler montant et délai pour relier un swap opaque
  | 'risk-exposure' // calcul d'exposition directe / indirecte au prorata

export type FlowKind = 'victim' | 'suspect' | 'wallet' | 'exchange' | 'deposit' | 'hot' | 'mixer' | 'bridge' | 'dex' | 'contract' | 'service' | 'unknown' | 'tx'

export interface FlowNode {
  id: string
  label: string
  kind: FlowKind
  sub?: string
}

export interface FlowEdge {
  from: string
  to: string
  label?: string
  dashed?: boolean
}

export type Block =
  | { type: 'heading'; text: string }
  | { type: 'text'; md: string }
  | { type: 'callout'; kind: 'tip' | 'warn' | 'law' | 'field' | 'example'; title?: string; md: string }
  | { type: 'flow'; nodes: FlowNode[]; edges: FlowEdge[]; caption?: string }
  | { type: 'table'; headers: string[]; rows: string[][]; caption?: string }
  | { type: 'steps'; items: { title: string; md: string }[] }
  | { type: 'terms'; items: { term: string; def: string }[] }
  | { type: 'compare'; left: { title: string; md: string }; right: { title: string; md: string } }
  | { type: 'check'; q: string; options: string[]; answer: number; explain: string }
  | { type: 'widget'; id: WidgetId; caption?: string }
  | { type: 'case'; title: string; md: string }
  | { type: 'quote'; md: string; source: string }

export interface Question {
  /** single (défaut) : une bonne réponse ; multi : plusieurs ; truefalse : options ['Vrai','Faux']. */
  kind?: 'single' | 'multi' | 'truefalse'
  q: string
  options: string[]
  answer: number | number[]
  explain: string
}

export interface Flashcard {
  front: string
  back: string
}

export interface Lesson {
  id: string
  title: string
  level: Level
  track: Track
  minutes: number
  summary: string
  /** « À la fin de cette leçon, vous saurez… » */
  objectives: string[]
  prerequisites?: string[]
  blocks: Block[]
  keyPoints: string[]
  quiz: Question[]
  flashcards: Flashcard[]
  /** Scénarios (ids de missions) qui mettent la leçon en pratique. */
  practice?: string[]
}

// ── Parcours, examens ──────────────────────────────────────────────────────

export type PathStep =
  | { kind: 'lesson'; id: string }
  | { kind: 'mission'; id: string; minPct?: number }
  | { kind: 'drill'; id: DrillId; target: number }
  | { kind: 'exam'; id: string }

export interface LearningPath {
  id: string
  title: string
  subtitle: string
  description: string
  icon: string
  color: string
  levels: [Level, Level]
  steps: PathStep[]
  certificate: string
}

export interface Exam {
  id: string
  title: string
  description: string
  level: Level
  /** Leçons dont les quiz alimentent la banque de questions. */
  lessons: string[]
  drills: DrillId[]
  questions: number
  minutes: number
  passPct: number
}

// ── Exercices générés (drills) ─────────────────────────────────────────────

export type DrillId =
  | 'chain-from-address' // quelle blockchain pour cette adresse ?
  | 'address-type' // P2PKH / P2SH / P2WPKH / P2TR / EOA / contrat…
  | 'hash-or-address' // ceci est-il un hash de transaction ou une adresse ?
  | 'unit-convert' // sats ↔ BTC, gwei, décimales
  | 'utxo-fee' // calculer les frais d'une transaction UTXO
  | 'utxo-change' // quelle sortie est le rendu ?
  | 'token-vs-native' // l'actif transféré est-il natif ou un jeton ?
  | 'deposit-vs-hot' // quelle adresse réquisitionner : dépôt ou hot wallet ?
  | 'xrp-tag' // retrouver le destination tag d'un dépôt
  | 'cioh-cluster' // quelles adresses appartiennent au même portefeuille ?
  | 'coinjoin-spot' // cette transaction est-elle un CoinJoin ?
  | 'risk-category' // catégorie de risque d'une contrepartie
  | 'typology' // reconnaître une typologie à partir d'un récit
  | 'requisition-target' // qui réquisitionner, par quelle voie ?
  | 'taint-method' // part marquée selon FIFO, LIFO, prorata ou poison
  | 'deposit-pattern' // adresse de dépôt reconnue à son comportement (modèle à comptes)
  | 'swap-match' // paiement d'un échangeur instantané correspondant à un dépôt
  | 'peel-read' // totaliser les pelures d'une peel chain
  | 'pool-demix' // retraits d'un pool rattachables au déposant
  | 'wallet-fingerprint' // rendu départagé par l'empreinte du logiciel

export interface DrillItem {
  prompt: string
  context?: string
  visual?: DrillVisual
  kind: 'choice' | 'number' | 'text'
  options?: string[]
  /** Index pour « choice », nombre pour « number », chaîne pour « text » (comparaison insensible à la casse). */
  answer: number | string
  /** Tolérance relative pour « number » (0.01 = 1 %). */
  tolerance?: number
  unit?: string
  explain: string
}

export type DrillVisual =
  | {
      type: 'tx'
      chain: ChainId
      asset: string
      hash?: string
      time?: number
      inputs: { address: string; value: number; label?: string }[]
      outputs: { address: string; value: number; label?: string }[]
      fee?: number
    }
  | {
      type: 'transfers'
      chain: ChainId
      rows: { from: string; to: string; value: number; asset: string; memo?: string; time?: number; method?: string; fromLabel?: string; toLabel?: string }[]
    }
  | { type: 'address'; value: string }
  | { type: 'list'; title?: string; items: string[] }
  | { type: 'flow'; nodes: FlowNode[]; edges: FlowEdge[] }

export interface DrillDef {
  id: DrillId
  title: string
  description: string
  level: Level
  track: Track
  icon: string
  generate(seed: number): DrillItem
}

// ── Curriculum : plan officiel des leçons ─────────────────────────────────

export interface CurriculumEntry {
  id: string
  title: string
  level: Level
  track: Track
}

export const CURRICULUM: CurriculumEntry[] = [
  // Niveau 0 — Débutant absolu
  { id: 'argent-numerique', title: 'La monnaie numérique, en partant de zéro', level: 0, track: 'bases' },
  { id: 'crypto-sans-maths', title: 'La cryptographie expliquée sans mathématiques', level: 0, track: 'bases' },
  { id: 'bases-blockchain', title: 'Blockchain, adresses et transactions', level: 0, track: 'bases' },
  { id: 'cles-portefeuilles', title: 'Clés, phrase de récupération et portefeuilles', level: 0, track: 'bases' },
  { id: 'unites-ordres', title: 'Unités, décimales et ordres de grandeur', level: 0, track: 'bases' },
  { id: 'ecosysteme-acteurs', title: 'L\'écosystème : qui fait quoi ?', level: 0, track: 'bases' },
  { id: 'explorateur-blocs', title: 'Lire un explorateur de blocs', level: 0, track: 'methodo' },
  { id: 'premiers-reflexes', title: 'L\'enquête crypto en dix réflexes', level: 0, track: 'enquete' },
  // Niveau 1 — Initié
  { id: 'utxo', title: 'Le modèle UTXO et les types de scripts', level: 1, track: 'bitcoin' },
  { id: 'frais-mempool', title: 'Frais, mempool et confirmations', level: 1, track: 'bitcoin' },
  { id: 'comptes-evm', title: 'Le modèle à comptes : Ethereum et chaînes EVM', level: 1, track: 'comptes' },
  { id: 'tokens-erc20', title: 'Jetons ERC-20, approvals et événements', level: 1, track: 'comptes' },
  { id: 'stablecoins', title: 'Les stablecoins et leurs émetteurs', level: 1, track: 'stablecoins' },
  { id: 'tron-usdt', title: 'Tron et l\'USDT-TRC20', level: 1, track: 'stablecoins' },
  { id: 'exchanges', title: 'Exchanges : dépôts, hot wallets et cold wallets', level: 1, track: 'bases' },
  { id: 'suivre-flux', title: 'Suivre un flux de A à Z : la méthode', level: 1, track: 'methodo' },
  // Niveau 2 — Intermédiaire
  { id: 'change-heuristics', title: 'Détecter l\'adresse de rendu', level: 2, track: 'bitcoin' },
  { id: 'clustering', title: 'Clustering : l\'heuristique des entrées communes', level: 2, track: 'bitcoin' },
  { id: 'peel-chains', title: 'Les peel chains', level: 2, track: 'bitcoin' },
  { id: 'attribution-sources', title: 'Attribution : d\'où viennent les étiquettes ?', level: 2, track: 'methodo' },
  { id: 'exposition-risque', title: 'Exposition, taint et score de risque', level: 2, track: 'methodo' },
  { id: 'dex-defi', title: 'DEX, AMM et DeFi : suivre les swaps', level: 2, track: 'comptes' },
  { id: 'xrp-memos', title: 'XRP, Stellar, EOS : memos et destination tags', level: 2, track: 'comptes' },
  { id: 'typologies', title: 'Typologies d\'escroqueries aux crypto-actifs', level: 2, track: 'typologies' },
  { id: 'osint', title: 'OSINT : relier une adresse à une personne', level: 2, track: 'enquete' },
  { id: 'requisitions', title: 'Réquisitions aux prestataires', level: 2, track: 'enquete' },
  { id: 'opsec-enqueteur', title: 'OPSEC de l\'enquêteur crypto', level: 2, track: 'enquete' },
  // Niveau 3 — Confirmé
  { id: 'bridges', title: 'Bridges : suivre les fonds d\'une chaîne à l\'autre', level: 3, track: 'interchaines' },
  { id: 'chain-hopping', title: 'Chain hopping et échangeurs instantanés', level: 3, track: 'interchaines' },
  { id: 'mixeurs', title: 'Mixeurs centralisés', level: 3, track: 'confidentialite' },
  { id: 'address-poisoning', title: 'Address poisoning', level: 3, track: 'typologies' },
  { id: 'drainers-approvals', title: 'Phishing, drainers et approvals', level: 3, track: 'typologies' },
  { id: 'rug-pulls', title: 'Rug pulls et fraudes aux jetons', level: 3, track: 'typologies' },
  { id: 'ransomware', title: 'Rançongiciels et modèle RaaS', level: 3, track: 'typologies' },
  { id: 'darknet', title: 'Marchés du darknet', level: 3, track: 'typologies' },
  { id: 'cadre-reglementaire', title: 'Le cadre réglementaire : MiCA, TFR, GAFI, sanctions', level: 3, track: 'enquete' },
  { id: 'gel-saisie', title: 'Gel et saisie des crypto-actifs', level: 3, track: 'enquete' },
  { id: 'tracage-outille', title: 'Traçage assisté : utiliser et contester un outil d\'analyse', level: 3, track: 'methodo' },
  { id: 'rapport', title: 'Rédiger un rapport d\'analyse blockchain', level: 3, track: 'enquete' },
  // Niveau 4 — Avancé
  { id: 'coinjoin', title: 'CoinJoin : reconnaître et analyser', level: 4, track: 'confidentialite' },
  { id: 'privacy-pools', title: 'Pools de confidentialité (type Tornado)', level: 4, track: 'confidentialite' },
  { id: 'monero', title: 'Monero et cryptos à confidentialité renforcée', level: 4, track: 'confidentialite' },
  { id: 'lightning', title: 'Le Lightning Network', level: 4, track: 'bitcoin' },
  { id: 'layer2-rollups', title: 'Layer 2 et rollups', level: 4, track: 'comptes' },
  { id: 'solana', title: 'Solana et ses spécificités', level: 4, track: 'comptes' },
  { id: 'smart-contracts-lecture', title: 'Lire un smart contract : logs, input data, événements', level: 4, track: 'comptes' },
  { id: 'defi-exploits', title: 'Hacks DeFi : flash loans, oracles, MEV', level: 4, track: 'typologies' },
  { id: 'cooperation-internationale', title: 'Coopération internationale et entraide', level: 4, track: 'enquete' },
  // Niveau 5 — Expert
  { id: 'analyse-comportementale', title: 'Empreintes de portefeuilles et analyse comportementale', level: 5, track: 'methodo' },
  { id: 'demixage-avance', title: 'Démixage : méthodes statistiques et limites', level: 5, track: 'confidentialite' },
  { id: 'acteurs-etatiques', title: 'Acteurs étatiques et groupes APT', level: 5, track: 'typologies' },
  { id: 'blanchiment-pro', title: 'Blanchiment professionnel : OTC, mules, cash-out', level: 5, track: 'typologies' },
  { id: 'expertise-judiciaire', title: 'L\'expertise judiciaire : fiabilité et contradictoire', level: 5, track: 'enquete' },
  { id: 'saisie-avancee', title: 'Perquisition et saisie avancées', level: 5, track: 'enquete' },
]
