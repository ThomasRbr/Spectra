// Catalogue unifié de l'Académie : les leçons du curriculum, dans l'ordre.
import { CURRICULUM, type Lesson, type Level } from './model'
import { LESSONS_L01 } from './content/l0l1'
import { LESSONS_L2 } from './content/l2'
import { LESSONS_L3 } from './content/l3'
import { LESSONS_L45 } from './content/l4l5'
import { LESSONS_EXT } from './content/ext'

export * from './model'
export { PATHS, EXAMS, pathById, examById } from './paths'
export { DRILLS } from './drills'
export { WIDGETS } from './widgets'

const authored = new Map<string, Lesson>()
for (const l of [...LESSONS_L01, ...LESSONS_L2, ...LESSONS_L3, ...LESSONS_L45, ...LESSONS_EXT]) authored.set(l.id, l)

/** Missions ajoutées après la rédaction des leçons, rattachées à leur rubrique « Mettre en pratique ». */
const EXTRA_PRACTICE: Record<string, string[]> = {
  'portefeuilles-hd': ['hd-perquisition', 'stups-telegram'],
  'forensique-supports': ['forensique-telephone', 'hd-perquisition'],
  'echangeurs-instantanes': ['monero-atomic', 'forensique-telephone'],
  'gel-stablecoins': ['guide-usdt-tron', 'ton-telegram-scam', 'l2-arbitrum-base'],
  'dab-cash-p2p': ['dab-cash-p2p', 'stups-telegram'],
  'ton-telegram': ['deb-ton-commentaire', 'ton-telegram-scam'],
  'stupefiants-crypto': ['stups-telegram'],
  'ponzi-mlm': ['ponzi-mlm'],
  'nft-fraudes': ['nft-wash'],
  'manipulation-marche': ['pump-dump'],
  lightning: ['lightning-cashout'],
  monero: ['monero-atomic'],
  coinjoin: ['coinjoin-remix'],
  'demixage-avance': ['coinjoin-remix'],
  'analyse-comportementale': ['coinjoin-remix', 'monero-atomic'],
  'layer2-rollups': ['l2-arbitrum-base'],
  bridges: ['l2-arbitrum-base'],
  solana: ['deb-solana-support', 'sol-drainer', 'pump-dump'],
  'drainers-approvals': ['sol-drainer'],
  'saisie-avancee': ['hd-perquisition'],
  'gel-saisie': ['hd-perquisition'],
  // Missions débutant et tutoriels guidés
  'bases-blockchain': ['guide-premiers-pas'],
  'explorateur-blocs': ['guide-premiers-pas', 'deb-capture-adresse'],
  'premiers-reflexes': ['guide-premiers-pas', 'deb-victimes-multiples', 'deb-capture-adresse'],
  utxo: ['deb-litecoin'],
  exchanges: ['guide-exchange'],
  'comptes-evm': ['guide-exchange', 'deb-bsc-airdrop'],
  'tokens-erc20': ['guide-exchange', 'deb-bsc-airdrop'],
  stablecoins: ['guide-usdt-tron', 'deb-tron-usdt'],
  'tron-usdt': ['guide-usdt-tron', 'deb-tron-usdt'],
  'suivre-flux': ['guide-premiers-pas', 'deb-victimes-multiples'],
  'dex-defi': ['deb-premier-swap'],
  rapport: ['guide-rapport'],
  requisitions: ['guide-exchange'],
}

export const LESSONS: Lesson[] = CURRICULUM.map((c) => authored.get(c.id))
  .filter((l): l is Lesson => !!l)
  .map((l) => (EXTRA_PRACTICE[l.id] ? { ...l, practice: [...new Set([...(l.practice ?? []), ...EXTRA_PRACTICE[l.id]])] } : l))

const byId = new Map(LESSONS.map((l) => [l.id, l]))

export function lessonById(id: string): Lesson | undefined {
  return byId.get(id)
}

/** Leçon disponible dans sa version complète. */
export function isAuthored(id: string): boolean {
  return authored.has(id)
}

export function lessonsOfLevel(level: Level): Lesson[] {
  return LESSONS.filter((l) => l.level === level)
}
