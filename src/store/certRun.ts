// Déroulement d'un examen de certification pratique : tirage des affaires,
// enchaînement des volets, remise automatique à l'expiration du temps,
// clôture, notation et délivrance du certificat.
import { scenarioById } from '../scenarios'
import { PRACTICAL_CERTS, STRICT_ITEM, certById, gradeReport, verificationCode, EMPTY_REPORT, type CertReport, type PracticalCert } from '../lib/certs'
import { useGame, loadSavedCase } from './game'
import { useProfile, type CertAttempt } from './profile'
import { useUi } from './ui'

const DAY = 86400000

function randomSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0]
  } catch {
    return Math.floor(Math.random() * 2 ** 32)
  }
}

/** Certificat pratique détenu et encore valide. */
export function validCertificate(certId: string, now = Date.now()) {
  return useProfile.getState().certificates.find((c) => c.kind === 'practical' && c.id === certId && (c.expires ?? Infinity) > now)
}

export interface CertStatus {
  cert: PracticalCert
  running?: CertAttempt
  held?: ReturnType<typeof validCertificate>
  used: number
  left: number
  /** Raisons qui empêchent de commencer (prérequis, délai, tentatives). */
  blockers: string[]
  prereqs: { label: string; ok: boolean }[]
  cooldownUntil?: number
  last?: CertAttempt
  /** Renouvellement possible : certification expirée, ou expirant dans moins de 90 jours. */
  canRenew: boolean
  renewBlockers: string[]
}

export function certStatus(cert: PracticalCert, now = Date.now()): CertStatus {
  const p = useProfile.getState()
  const mine = p.certAttempts.filter((a) => a.certId === cert.id)
  const running = mine.find((a) => a.status === 'running')
  const held = validCertificate(cert.id, now)
  // Les tentatives se décomptent depuis la dernière réussite (renouvellement)
  const lastPass = Math.max(0, ...mine.filter((a) => a.status === 'passed').map((a) => a.finishedAt ?? 0))
  const used = mine.filter((a) => a.status === 'failed' && (a.finishedAt ?? 0) > lastPass).length
  const last = [...mine].sort((a, b) => b.startedAt - a.startedAt)[0]
  const lastFail = mine.filter((a) => a.status === 'failed').sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0]
  const cooldownUntil = lastFail?.finishedAt ? lastFail.finishedAt + cert.cooldownDays * DAY : undefined
  const prereqs = [
    ...cert.examPrereqs.map((id) => ({ label: examLabel(id), ok: !!p.exams[id]?.passedAt })),
    ...(cert.certPrereq ? [{ label: `Certification « ${certById(cert.certPrereq)?.title} »`, ok: !!validCertificate(cert.certPrereq, now) }] : []),
  ]
  const blockers: string[] = []
  if (cert.soon) blockers.push('Certification en préparation')
  if (prereqs.some((x) => !x.ok)) blockers.push('Prérequis non remplis')
  if (held) blockers.push('Certification déjà obtenue et en cours de validité')
  if (used >= cert.attempts) blockers.push(`Les ${cert.attempts} tentatives ont été utilisées`)
  const cooling = !!cooldownUntil && cooldownUntil > now
  if (cooling && !held) blockers.push(`Nouvelle tentative possible le ${new Date(cooldownUntil!).toLocaleDateString('fr-FR')}`)
  // Renouvellement : une certification déjà obtenue, expirée ou proche de l'expiration
  const ever = p.certificates.find((c) => c.kind === 'practical' && c.id === cert.id)
  const canRenew = !!ever && (ever.expires ?? Infinity) - now < 90 * DAY
  const renewBlockers: string[] = []
  if (running) renewBlockers.push('Un examen est déjà en cours')
  if (cooling) renewBlockers.push(`Nouvelle tentative possible le ${new Date(cooldownUntil!).toLocaleDateString('fr-FR')}`)
  if (used >= cert.attempts) renewBlockers.push(`Les ${cert.attempts} tentatives ont été utilisées`)
  if (ever && !held) blockers.push('Certification expirée : passez l\'examen de renouvellement')
  return { cert, running, held, used, left: Math.max(0, cert.attempts - used), blockers, prereqs, cooldownUntil: cooling ? cooldownUntil : undefined, last, canRenew, renewBlockers }
}

const EXAM_LABELS: Record<string, string> = {
  'exam-n1': 'Examen du niveau 1',
  'exam-n2': 'Examen du niveau 2',
  'exam-n3': 'Examen du niveau 3',
  'exam-bitcoin': 'Certification QCM « Analyste Bitcoin »',
  'exam-comptes': 'Certification QCM « Ethereum, jetons et stablecoins »',
  'exam-interchaines': 'Certification QCM « Inter-chaînes et services »',
  'exam-confidentialite': 'Certification QCM « Confidentialité avancée »',
  'exam-procedure': 'Certification QCM « Enquêteur judiciaire crypto »',
  'exam-contrats': 'Certification QCM « Smart contracts et DeFi »',
  'exam-utxo-moderne': 'Certification QCM « Bitcoin moderne et UTXO »',
}
const examLabel = (id: string) => EXAM_LABELS[id] ?? id

export function startCertification(certId: string, renewal = false): boolean {
  const cert = certById(certId)
  if (!cert) return false
  const st = certStatus(cert)
  if (renewal ? !st.canRenew || st.renewBlockers.length : st.blockers.length) return false
  let volets = cert.volets.map((v) => ({ templateId: v.pool[randomSeed() % v.pool.length], seed: randomSeed() }))
  // Renouvellement : un seul volet, tiré parmi ceux de la certification, en deux fois moins de temps
  if (renewal) volets = [volets[randomSeed() % volets.length]]
  const now = Date.now()
  const minutes = renewal ? Math.round(cert.durationMin / 2) : cert.durationMin
  const attempt: CertAttempt = { id: `ca${now.toString(36)}`, certId, startedAt: now, deadline: now + minutes * 60000, volets, results: [], status: 'running', renewal }
  useProfile.getState().startCertAttempt(attempt)
  launchVolet(attempt, 0)
  return true
}

function launchVolet(a: CertAttempt, index: number) {
  const cert = certById(a.certId)!
  const v = a.volets[index]
  useGame.getState().start(v.templateId, v.seed, { mode: 'examen', coverage: cert.coverage, live: !!cert.live, cert: { attemptId: a.id, certId: a.certId, index } })
  useUi.getState().set({ page: 'workspace', briefingOpen: true, timeRange: null, leftTab: 'evidence', certReport: false })
}

/** Reprend un examen en cours : l'affaire sauvegardée si c'est le bon volet, sinon le volet suivant. */
export function resumeCertification(attemptId: string) {
  const a = useProfile.getState().certAttempts.find((x) => x.id === attemptId)
  if (!a || a.status !== 'running') return
  if (Date.now() > a.deadline) {
    closeAttempt(a.id)
    return
  }
  const g = useGame.getState()
  const index = a.results.length
  if (g.cert?.attemptId === a.id && g.cert.index === index && g.inst) {
    useUi.getState().set({ page: 'workspace' })
    return
  }
  const saved = loadSavedCase()
  if (saved?.cert?.attemptId === a.id && saved.cert.index === index && g.resume(saved)) {
    useUi.getState().set({ page: 'workspace' })
    return
  }
  launchVolet(a, index)
}

/** Remet le volet en cours avec son rapport, puis enchaîne ou clôt l'examen. */
export function submitVolet(report: CertReport, timedOut = false) {
  const g = useGame.getState()
  const run = g.cert
  if (!run || !g.inst || !g.template) return
  const cert = certById(run.certId)
  const frozenUsd = g.freezes.filter((f) => f.status === 'effective').reduce((s, f) => s + f.frozenUsd, 0)
  const grade = gradeReport(g.inst, report, { traceSourceTx: g.trace?.source.txId, frozenUsd }, { live: !!cert?.live, strict: !!cert?.strict })
  const answers = g.answers
  g.submit()
  const score = useGame.getState().score!
  const a = useProfile.getState().certAttempts.find((x) => x.id === run.attemptId)
  if (!a) return
  useProfile.getState().recordVolet(a.id, {
    templateId: g.template.id, seed: g.seed, title: g.inst.title, earned: score.total, max: score.max, answers, report, grade,
    durationSec: Math.round((Date.now() - g.startedAt) / 1000), timedOut,
  })
  const next = run.index + 1
  if (!timedOut && next < a.volets.length && Date.now() < a.deadline) {
    useUi.getState().notify(`Volet ${run.index + 1} remis. Volet ${next + 1} sur ${a.volets.length} : nouvelle affaire.`)
    launchVolet(a, next)
  } else closeAttempt(a.id)
}

/** Temps écoulé : le volet en cours est remis tel quel, les suivants comptent pour zéro. */
export function expireAttempt() {
  const g = useGame.getState()
  if (!g.cert) return
  useUi.getState().notify('Temps écoulé : le volet en cours est remis en l\'état.')
  submitVolet(EMPTY_REPORT, true)
}

export function closeAttempt(attemptId: string) {
  const p = useProfile.getState()
  const a = p.certAttempts.find((x) => x.id === attemptId)
  if (!a || a.status !== 'running') return
  const cert = certById(a.certId)!
  let earned = 0
  let max = 0
  let report = 0
  a.volets.forEach((v, i) => {
    const r = a.results[i]
    if (r) {
      earned += r.earned
      max += r.max
      report += r.grade.pct
    } else {
      // Volet non traité : ses points comptent, à zéro
      const inst = scenarioById(v.templateId)?.generate(v.seed)
      max += inst?.objectives.reduce((s, o) => s + o.points, 0) ?? 0
    }
  })
  const flagsPct = max ? Math.round((earned / max) * 100) : 0
  const reportPct = Math.round(report / a.volets.length)
  // Spécialiste et Expert : chaque volet remis doit avoir écarté tous les leurres
  const decoysOk = !cert.strict || (a.results.length > 0 && a.results.every((r) => r.grade.items.every((i) => i.label !== STRICT_ITEM || i.earned === i.max)))
  const passed = flagsPct >= cert.passFlagsPct && reportPct >= cert.passReportPct && decoysOk
  p.closeCertAttempt(a.id, { status: passed ? 'passed' : 'failed', flagsPct, reportPct })
  if (passed) {
    const date = Date.now()
    const score = Math.round((flagsPct + reportPct) / 2)
    useProfile.getState().addCertificate({
      id: cert.id, kind: 'practical', title: cert.title, score, date,
      code: verificationCode(p.name, cert.id, score, date),
      expires: date + cert.validityYears * 365 * DAY,
    })
  }
  const g = useGame.getState()
  if (g.cert?.attemptId === a.id) g.quit()
  useUi.getState().set({ page: 'academy', certReport: false })
  useUi.getState().openAcademy({ kind: 'certResult', id: a.id })
}

export { PRACTICAL_CERTS }
