// Certifications pratiques : examen sur des affaires inconnues (graine
// secrète), éléments à retrouver (les objectifs des affaires) et rapport
// structuré noté selon une grille. Les seuils, tentatives et délais sont
// définis ici ; l'état des tentatives est conservé dans le profil.
import { attribution } from '../engine/analysis'
import { traceFunds, type TraceMethod, type TraceResult } from '../engine/tracing'
import { usd } from '../engine/chains'
import type { World } from '../engine/world'
import type { ScenarioInstance } from '../scenarios/types'

export type CertDifficulty = 'facile' | 'moyen' | 'difficile' | 'extreme'

export const CERT_DIFFICULTY: Record<CertDifficulty, { label: string; color: string }> = {
  facile: { label: 'Facile', color: '#34d399' },
  moyen: { label: 'Moyen', color: '#facc15' },
  difficile: { label: 'Difficile', color: '#fb923c' },
  extreme: { label: 'Extrême', color: '#f43f5e' },
}

export interface CertVolet {
  title: string
  /** Missions parmi lesquelles le volet est tiré au sort. */
  pool: string[]
}

export interface PracticalCert {
  id: string
  /** Code court affiché sur le certificat. */
  code: string
  title: string
  tier: number
  difficulty: CertDifficulty
  description: string
  skills: string[]
  /** Examens de l'Académie à avoir réussis. */
  examPrereqs: string[]
  /** Certification pratique à détenir (en cours de validité). */
  certPrereq?: string
  volets: CertVolet[]
  coverage: 'full' | 'partial'
  durationMin: number
  passFlagsPct: number
  passReportPct: number
  attempts: number
  cooldownDays: number
  validityYears: number
  /** Certification annoncée mais pas encore ouverte. */
  soon?: boolean
}

export const PRACTICAL_CERTS: PracticalCert[] = [
  {
    id: 'pc-associe',
    code: 'SPX-ATA',
    title: 'Analyste traçage associé',
    tier: 1,
    difficulty: 'facile',
    description: 'Mener seul un traçage Bitcoin puis un traçage sur le modèle à comptes, jusqu\'au service à réquisitionner, et en rendre compte.',
    skills: ['Lecture de transaction', 'Rendu et clustering', 'Jetons et stablecoins', 'Identification d\'exchange', 'Réquisition'],
    examPrereqs: ['exam-n1', 'exam-n2'],
    volets: [
      { title: 'Volet Bitcoin', pool: ['peel-chain', 'sextortion-cluster', 'donation-funding', 'recovery-scam'] },
      { title: 'Volet modèle à comptes', pool: ['pig-butchering-tron', 'dex-swap', 'address-poisoning', 'eth-bec-president', 'sol-memecoin-rug'] },
    ],
    coverage: 'full',
    durationMin: 120,
    passFlagsPct: 70,
    passReportPct: 60,
    attempts: 3,
    cooldownDays: 7,
    validityYears: 2,
  },
  {
    id: 'pc-enqueteur',
    code: 'SPX-ECC',
    title: 'Enquêteur crypto certifié',
    tier: 2,
    difficulty: 'moyen',
    description: 'Trois affaires en attribution partielle : swaps, bridges, exchanges, mules ou mixeurs. Il faut retrouver soi-même les adresses de dépôt que l\'outil n\'étiquette pas.',
    skills: ['Inter-chaînes', 'Swaps et bridges', 'Adresses de dépôt non étiquetées', 'Méthodes d\'attribution', 'Rapport'],
    examPrereqs: ['exam-bitcoin', 'exam-comptes'],
    certPrereq: 'pc-associe',
    volets: [
      { title: 'Volet inter-chaînes', pool: ['chain-hopping', 'tron-kidnapping-ransom', 'tron-sanctions-garantex'] },
      { title: 'Volet blanchiment', pool: ['money-mules', 'centralized-mixer', 'rugpull-bsc'] },
      { title: 'Volet escroquerie', pool: ['ledger-phishing', 'eth-bec-president', 'recovery-scam'] },
    ],
    coverage: 'partial',
    durationMin: 240,
    passFlagsPct: 75,
    passReportPct: 70,
    attempts: 3,
    cooldownDays: 7,
    validityYears: 2,
  },
  {
    id: 'pc-specialiste',
    code: 'SPX-SIC',
    title: 'Spécialiste inter-chaînes et confidentialité',
    tier: 3,
    difficulty: 'difficile',
    description: 'Chain hopping, CoinJoin et pools de confidentialité, avec des leurres glissés dans l\'affaire.',
    skills: ['Démixage', 'Corrélation d\'échangeurs', 'Écarter les leurres'],
    examPrereqs: ['exam-interchaines', 'exam-confidentialite'],
    certPrereq: 'pc-enqueteur',
    volets: [],
    coverage: 'partial',
    durationMin: 480,
    passFlagsPct: 75,
    passReportPct: 70,
    attempts: 3,
    cooldownDays: 7,
    validityYears: 2,
    soon: true,
  },
  {
    id: 'pc-expert',
    code: 'SPX-EAB',
    title: 'Expert analyse blockchain',
    tier: 4,
    difficulty: 'extreme',
    description: 'Une grande affaire sur quatre chaînes, en temps réel : chaque gel obtenu avant que les fonds ne bougent rapporte des points.',
    skills: ['Temps réel et gel', 'Comparaison des méthodes', 'Rapport contradictoire'],
    examPrereqs: ['exam-procedure'],
    certPrereq: 'pc-specialiste',
    volets: [],
    coverage: 'partial',
    durationMin: 2880,
    passFlagsPct: 80,
    passReportPct: 80,
    attempts: 3,
    cooldownDays: 7,
    validityYears: 2,
    soon: true,
  },
]

export function certById(id: string): PracticalCert | undefined {
  return PRACTICAL_CERTS.find((c) => c.id === id)
}

// ── Rapport structuré ────────────────────────────────────────────────────

export type Confidence = 'forte' | 'moyenne' | 'faible'

export interface CertReport {
  method: TraceMethod | 'none'
  justification: string
  findings: string
  inferences: string
  attributions: { address: string; confidence: Confidence }[]
  requisitions: { entityId: string; addresses: string[] }[]
  held: string[]
  noHeld: boolean
}

export const EMPTY_REPORT: CertReport = { method: 'none', justification: '', findings: '', inferences: '', attributions: [], requisitions: [], held: [], noHeld: false }

export interface RubricItem {
  label: string
  earned: number
  max: number
  detail: string
}

export interface ReportGrade {
  items: RubricItem[]
  pct: number
}

/** Ce que l'enquêteur a fait dans l'affaire, utile à la notation. */
export interface CaseWork {
  traceSourceTx?: string
}

/** Source de référence de l'affaire : le plus gros versement vers une adresse clé, parmi les premières transactions du flux réel. */
function referenceTrace(inst: ScenarioInstance): TraceResult | null {
  const w = inst.world
  const keys = new Set(inst.truth.addresses)
  let best: { txId: string; address: string; usd: number } | null = null
  for (const id of inst.truth.path.slice(0, 6)) {
    const tx = w.txs.get(id)
    if (!tx || !w.visible(tx)) continue
    const to = tx.model === 'utxo' ? tx.outputs.map((o) => o.address) : tx.transfers.map((t) => t.to)
    for (const a of new Set(to.filter((x) => keys.has(x)))) {
      const v = w.flowIn(tx, a).reduce((s, f) => s + usd(f.asset, f.value), 0)
      if (!best || v > best.usd) best = { txId: id, address: a, usd: v }
    }
  }
  return best ? traceFunds(w, { txId: best.txId, address: best.address }, { method: 'haircut' }) : null
}

/** Adresses non attribuées qui détiennent encore une part significative (2 % au moins) des fonds de l'affaire. */
export function heldReference(inst: ScenarioInstance): string[] {
  const ref = referenceTrace(inst)
  return ref ? ref.stillHeld.filter((n) => n.heldUsd >= ref.sourceUsd * 0.02).map((n) => n.id) : []
}

/** Services que le rapport doit viser : réponses des objectifs « entité », sinon services atteints par le flux réel. */
export function expectedEntities(inst: ScenarioInstance): string[] {
  const fromObjectives = inst.objectives.flatMap((o) => (o.type === 'entity' ? o.answer : []))
  if (fromObjectives.length) return [...new Set(fromObjectives)]
  const w = inst.world
  const out = new Set<string>()
  for (const a of inst.truth.addresses) {
    const e = attribution(w, a).entity ?? (w.get(a).entityId ? w.entities.get(w.get(a).entityId!) : undefined)
    if (e && !['individual', 'suspect', 'victim'].includes(e.category) && e.compliance) out.add(e.id)
  }
  return [...out]
}

const mentions = (text: string, w: World, ids: string[]) => ids.some((id) => {
  const a = w.addresses.get(id)?.addr ?? w.txs.get(id)?.hash
  return !!a && text.includes(a.slice(0, 8))
})

export function gradeReport(inst: ScenarioInstance, report: CertReport, work: CaseWork): ReportGrade {
  const w = inst.world
  const items: RubricItem[] = []
  const truthTx = new Set(inst.truth.path)
  const truthAddr = new Set(inst.truth.addresses)

  // 1. Méthode annoncée et justifiée
  const just = report.justification.trim().length
  items.push({
    label: 'Méthode d\'attribution annoncée et justifiée',
    max: 20,
    earned: report.method === 'none' ? 0 : just >= 40 ? 20 : 10,
    detail: report.method === 'none' ? 'Aucune méthode annoncée.' : just >= 40 ? 'Méthode annoncée et justifiée.' : 'Méthode annoncée, justification trop brève (40 caractères au moins).',
  })

  // 2. Traçage depuis une source du flux réel
  const traced = !!work.traceSourceTx
  const goodSource = traced && truthTx.has(work.traceSourceTx!)
  items.push({
    label: 'Traçage des fonds depuis la bonne source',
    max: 15,
    earned: goodSource ? 15 : traced ? 5 : 0,
    detail: goodSource ? 'Traçage lancé depuis une transaction du flux réel.' : traced ? 'Traçage lancé, mais depuis une transaction étrangère au flux de l\'affaire.' : 'Aucun traçage des fonds réalisé.',
  })

  // 3. Constatations et déductions séparées
  const fOk = report.findings.trim().length >= 40
  const fRef = mentions(report.findings, w, [...truthAddr, ...truthTx])
  const iOk = report.inferences.trim().length >= 40
  items.push({
    label: 'Constatations et déductions séparées',
    max: 15,
    earned: (fOk ? (fRef ? 8 : 4) : 0) + (iOk ? 7 : 0),
    detail: `${fOk ? (fRef ? 'Constatations rédigées, avec des références vérifiables.' : 'Constatations rédigées, sans adresse ni hash de l\'affaire.') : 'Constatations absentes ou trop brèves.'} ${iOk ? 'Déductions rédigées à part.' : 'Déductions absentes ou trop brèves.'}`,
  })

  // 4. Niveau de confiance des attributions
  const attrTruth = report.attributions.filter((a) => truthAddr.has(a.address))
  items.push({
    label: 'Attributions avec un niveau de confiance',
    max: 15,
    earned: attrTruth.length ? 15 : report.attributions.length ? 5 : 0,
    detail: attrTruth.length ? `${attrTruth.length} attribution(s) qualifiée(s) portant sur des adresses clés.` : report.attributions.length ? 'Attributions qualifiées, mais sur des adresses secondaires.' : 'Aucune attribution qualifiée.',
  })

  // 5. Réquisitions
  const expected = expectedEntities(inst)
  const hit = report.requisitions.find((r) => expected.includes(r.entityId))
  const depositHit = hit?.addresses.some((a) => w.get(a).entityId === hit.entityId && w.get(a).tags.includes('deposit'))
  const anyOwn = hit?.addresses.some((a) => w.get(a).entityId === hit.entityId)
  items.push({
    label: 'Réquisition au bon service, sur la bonne adresse',
    max: 20,
    earned: hit ? 10 + (depositHit ? 10 : anyOwn ? 4 : 0) : 0,
    detail: !expected.length
      ? 'Aucun service attendu dans cette affaire.'
      : hit
        ? depositHit ? 'Bon service, adresse de dépôt du client citée.' : anyOwn ? 'Bon service, mais l\'adresse citée n\'est pas l\'adresse de dépôt du client.' : 'Bon service, sans adresse lui appartenant.'
        : `Service attendu non réquisitionné (${expected.map((e) => w.entities.get(e)?.name ?? e).join(', ')}).`,
  })
  if (!expected.length) items[items.length - 1].earned = report.requisitions.length ? 10 : 20

  // 6. Fonds encore détenus
  const heldTruth = new Set(heldReference(inst))
  const heldGiven = report.held.filter((a) => heldTruth.has(a))
  items.push({
    label: 'Fonds encore détenus signalés',
    max: 15,
    earned: heldTruth.size ? (heldGiven.length ? 15 : report.held.length ? 5 : 0) : report.noHeld ? 15 : report.held.length ? 5 : 0,
    detail: heldTruth.size
      ? heldGiven.length ? `${heldGiven.length} adresse(s) détenant encore des fonds signalée(s).` : `Des fonds restaient sur ${heldTruth.size} adresse(s) non signalée(s).`
      : report.noHeld ? 'Absence de fonds encore détenus correctement indiquée.' : 'Aucun fonds significatif ne restait : il fallait l\'indiquer.',
  })

  const earned = items.reduce((s, i) => s + i.earned, 0)
  const max = items.reduce((s, i) => s + i.max, 0)
  return { items, pct: Math.round((earned / max) * 100) }
}

// ── Code de vérification ─────────────────────────────────────────────────

const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Code de contrôle d'un certificat, recalculable à partir du nom, de la
 * certification, du score et de la date. Il détecte une altération du
 * certificat imprimé ; ce n'est pas une signature cryptographique.
 */
export function verificationCode(name: string, certId: string, score: number, date: number): string {
  // Date locale (celle imprimée sur le certificat)
  const dt = new Date(date)
  const day = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  const s = `${name.trim().toLowerCase()}|${certId}|${Math.round(score)}|${day}|spectra-cert-v1`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 + c, 2246822519) >>> 0
  }
  let out = ''
  let a = h1
  let b = h2
  for (let i = 0; i < 12; i++) {
    const v = (i % 2 ? a : b) & 31
    out += B32[v]
    if (i % 2) a = (a >>> 5) | ((b & 31) << 27)
    else b = b >>> 5
  }
  return `${certById(certId)?.code ?? 'SPX'}-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`
}
