import type { World } from '../engine/world'
import type { AssetId, ChainId } from '../engine/chains'

export type Difficulty = 1 | 2 | 3 | 4

export const DIFFICULTY: Record<Difficulty, { label: string; color: string; xp: number }> = {
  1: { label: 'Débutant', color: '#34d399', xp: 100 },
  2: { label: 'Intermédiaire', color: '#facc15', xp: 200 },
  3: { label: 'Avancé', color: '#fb923c', xp: 350 },
  4: { label: 'Expert', color: '#f43f5e', xp: 600 },
}

export type SkillId =
  | 'lecture_tx' | 'utxo' | 'change' | 'cioh' | 'peel' | 'evm' | 'tokens'
  | 'dex' | 'tron' | 'memo' | 'crosschain' | 'bridge' | 'mixer' | 'coinjoin'
  | 'privacy' | 'exchange_id' | 'requisition' | 'osint' | 'ransomware'
  | 'defi' | 'typologies' | 'poisoning' | 'gel'

export const SKILLS: Record<SkillId, { label: string; group: string }> = {
  lecture_tx: { label: 'Lecture de transaction', group: 'Fondamentaux' },
  utxo: { label: 'Modèle UTXO', group: 'Fondamentaux' },
  exchange_id: { label: 'Identification d\'exchange', group: 'Fondamentaux' },
  change: { label: 'Détection du rendu', group: 'Bitcoin' },
  cioh: { label: 'Clustering (entrées communes)', group: 'Bitcoin' },
  peel: { label: 'Peel chains', group: 'Bitcoin' },
  evm: { label: 'Modèle à comptes (EVM)', group: 'Ethereum & co' },
  tokens: { label: 'Jetons ERC-20 / TRC-20', group: 'Ethereum & co' },
  dex: { label: 'Swaps DEX', group: 'Ethereum & co' },
  defi: { label: 'DeFi & smart contracts', group: 'Ethereum & co' },
  tron: { label: 'Tron & USDT', group: 'Ethereum & co' },
  memo: { label: 'Memos / destination tags', group: 'Ethereum & co' },
  crosschain: { label: 'Chain hopping', group: 'Inter-chaînes' },
  bridge: { label: 'Bridges', group: 'Inter-chaînes' },
  mixer: { label: 'Mixeurs', group: 'Confidentialité' },
  coinjoin: { label: 'CoinJoin', group: 'Confidentialité' },
  privacy: { label: 'Cryptos anonymes', group: 'Confidentialité' },
  poisoning: { label: 'Address poisoning', group: 'Typologies' },
  typologies: { label: 'Typologies d\'escroqueries', group: 'Typologies' },
  ransomware: { label: 'Rançongiciels', group: 'Typologies' },
  osint: { label: 'Pivot OSINT', group: 'Enquête' },
  requisition: { label: 'Réquisitions', group: 'Enquête' },
  gel: { label: 'Gel & saisie', group: 'Enquête' },
}

export type EvidenceType = 'plainte' | 'capture' | 'telegram' | 'forum' | 'email' | 'note' | 'pv' | 'rancon' | 'osint' | 'rapport' | 'sms' | 'extraction' | 'perquisition' | 'releve'

export interface Evidence {
  id: string
  type: EvidenceType
  title: string
  date?: number
  author?: string
  /** Texte brut. Les adresses et hash présents dans le monde deviennent cliquables. */
  body: string
}

export interface ObjectiveBase {
  id: string
  prompt: string
  points: number
  explanation: string
  hint?: string
}

export type Objective = ObjectiveBase &
  (
    | { type: 'address'; answer: string[] }
    | { type: 'addresses'; answer: string[] }
    | { type: 'tx'; answer: string[] }
    | { type: 'entity'; answer: string[] }
    | { type: 'amount'; answer: number; unit: AssetId | 'USD'; tolerance: number }
    | { type: 'number'; answer: number; tolerance?: number; unit?: string }
    | { type: 'choice'; options: string[]; answer: number }
  )

export interface ScenarioInstance {
  world: World
  title: string
  /** Contexte de l'affaire, en texte (paragraphes séparés par une ligne vide). */
  briefing: string
  evidence: Evidence[]
  /** Adresses (ids) épinglées sur le graphe au démarrage. */
  seeds: string[]
  objectives: Objective[]
  truth: {
    /** Transactions du flux réel (pour la surimpression au débrief). */
    path: string[]
    /** Adresses clés (suspect, dépôts…). */
    addresses: string[]
    /** Récit complet de ce qui s'est passé, affiché au débrief. */
    debrief: string
  }
  /** Indices progressifs (chaque indice coûte des points). */
  hints: string[]
}

export interface ScenarioTemplate {
  id: string
  /** Affaire réservée aux examens de certification (absente de la liste des missions). */
  certOnly?: boolean
  title: string
  tagline: string
  description: string
  difficulty: Difficulty
  chains: ChainId[]
  skills: SkillId[]
  estMinutes: number
  /** Identifiants de leçons de l'Académie liées. */
  lessons?: string[]
  generate(seed: number): ScenarioInstance
}
