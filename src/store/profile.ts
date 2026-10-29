import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Difficulty, SkillId } from '../scenarios/types'
import type { Answer } from '../lib/scoring'
import type { CertReport, ReportGrade } from '../lib/certs'

export interface CaseRecord {
  templateId: string
  seed: number
  score: number
  max: number
  grade: string
  date: number
  durationSec: number
  difficulty: Difficulty
  skills: SkillId[]
  xp: number
  /** XP qu'aurait rapporté l'essai sans la règle anti-rejeu. */
  xpPotential?: number
  mode: 'standard' | 'examen'
}

export interface LessonRecord {
  read: boolean
  quizBest?: number
  quizMax?: number
  /** Date de validation (leçon lue jusqu'au bout et quiz réussi ou terminé). */
  done?: number
  /** Réponses aux vérifications intégrées (index du bloc → juste/faux). */
  checks?: Record<string, boolean>
}

export interface DrillRecord {
  attempts: number
  correct: number
  streak: number
  bestStreak: number
}

export interface CardRecord {
  box: number
  due: number
  reviews: number
}

export interface ExamRecord {
  best: number
  attempts: number
  passedAt?: number
}

export interface Certificate {
  id: string
  kind: 'path' | 'exam' | 'practical'
  title: string
  date: number
  score?: number
  /** Certifications pratiques : code de vérification et fin de validité. */
  code?: string
  expires?: number
}

/** Résultat d'un volet d'examen de certification pratique. */
export interface VoletResult {
  templateId: string
  seed: number
  title: string
  earned: number
  max: number
  answers: Record<string, Answer>
  report: CertReport
  grade: ReportGrade
  durationSec: number
  /** Remis automatiquement à l'expiration du temps. */
  timedOut?: boolean
}

export interface CertAttempt {
  id: string
  certId: string
  startedAt: number
  deadline: number
  /** Affaires tirées au sort, graines secrètes. */
  volets: { templateId: string; seed: number }[]
  results: VoletResult[]
  status: 'running' | 'passed' | 'failed'
  /** Examen de renouvellement (un seul volet, durée réduite). */
  renewal?: boolean
  finishedAt?: number
  flagsPct?: number
  reportPct?: number
}

export type CardGrade = 'again' | 'hard' | 'good' | 'easy'

/** Intervalles de révision par boîte (système de Leitner), en jours. */
export const CARD_INTERVALS = [0, 1, 3, 7, 16, 35]

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface ProfileState {
  name: string
  unit: string
  cases: CaseRecord[]
  lessons: Record<string, LessonRecord>
  drills: Record<string, DrillRecord>
  cards: Record<string, CardRecord>
  exams: Record<string, ExamRecord>
  certificates: Certificate[]
  certAttempts: CertAttempt[]
  days: string[]
  xp: number
  setIdentity(name: string, unit: string): void
  addCase(r: CaseRecord): void
  markLesson(id: string, quiz?: { score: number; max: number }): void
  recordCheck(lessonId: string, block: number, ok: boolean): void
  completeLesson(id: string): void
  recordDrill(id: string, ok: boolean): number
  reviewCard(key: string, grade: CardGrade): void
  recordExam(id: string, pct: number, passed: boolean, xp: number): void
  addCertificate(c: Omit<Certificate, 'date'> & { date?: number }): boolean
  startCertAttempt(a: CertAttempt): void
  recordVolet(attemptId: string, r: VoletResult): void
  closeCertAttempt(attemptId: string, outcome: { status: 'passed' | 'failed'; flagsPct: number; reportPct: number }): void
  touchDay(): void
  reset(): void
}

/** Stockage tolérant : l'application reste utilisable si localStorage est indisponible. */
const safeStorage = createJSONStorage(() => {
  try {
    const k = '__spectra_probe__'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    }
  }
})

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      name: 'Enquêteur',
      unit: 'Section de recherches',
      cases: [],
      lessons: {},
      drills: {},
      cards: {},
      exams: {},
      certificates: [],
      certAttempts: [],
      days: [],
      xp: 0,
      setIdentity: (name, unit) => set({ name, unit }),
      addCase: (r) => set((s) => ({ cases: [r, ...s.cases].slice(0, 500), xp: s.xp + r.xp })),
      markLesson: (id, quiz) =>
        set((s) => {
          const prev = s.lessons[id] ?? { read: false }
          const firstRead = !prev.read
          const best = quiz ? Math.max(prev.quizBest ?? 0, quiz.score) : prev.quizBest
          const quizXp = quiz && quiz.score > (prev.quizBest ?? -1) ? (quiz.score - (prev.quizBest ?? 0)) * 10 : 0
          return {
            lessons: { ...s.lessons, [id]: { read: true, quizBest: best, quizMax: quiz?.max ?? prev.quizMax } },
            xp: s.xp + (firstRead ? 25 : 0) + Math.max(0, quizXp),
          }
        }),
      recordCheck: (lessonId, block, ok) =>
        set((s) => {
          const prev = s.lessons[lessonId] ?? { read: false }
          if (prev.checks && String(block) in prev.checks) return {}
          return { lessons: { ...s.lessons, [lessonId]: { ...prev, checks: { ...prev.checks, [block]: ok } } }, xp: s.xp + (ok ? 5 : 0) }
        }),
      completeLesson: (id) =>
        set((s) => {
          const prev = s.lessons[id] ?? { read: false }
          if (prev.done) return {}
          return { lessons: { ...s.lessons, [id]: { ...prev, read: true, done: Date.now() } }, xp: s.xp + (prev.read ? 25 : 50) }
        }),
      recordDrill: (id, ok) => {
        let streak = 0
        set((s) => {
          const prev = s.drills[id] ?? { attempts: 0, correct: 0, streak: 0, bestStreak: 0 }
          streak = ok ? prev.streak + 1 : 0
          const next = { attempts: prev.attempts + 1, correct: prev.correct + (ok ? 1 : 0), streak, bestStreak: Math.max(prev.bestStreak, streak) }
          return { drills: { ...s.drills, [id]: next }, xp: s.xp + (ok ? 3 + Math.min(streak, 5) : 0) }
        })
        return streak
      },
      reviewCard: (key, grade) =>
        set((s) => {
          const prev = s.cards[key] ?? { box: 0, due: 0, reviews: 0 }
          const box = grade === 'again' ? 1 : grade === 'hard' ? Math.max(1, prev.box) : grade === 'good' ? Math.min(5, prev.box + 1) : Math.min(5, prev.box + 2)
          const days = grade === 'again' ? 0 : grade === 'hard' ? Math.max(0.5, CARD_INTERVALS[box] / 2) : CARD_INTERVALS[box]
          const due = Date.now() + (grade === 'again' ? 10 * 60_000 : days * 86_400_000)
          return { cards: { ...s.cards, [key]: { box, due, reviews: prev.reviews + 1 } }, xp: s.xp + 1 }
        }),
      recordExam: (id, pct, passed, xp) =>
        set((s) => {
          const prev = s.exams[id] ?? { best: 0, attempts: 0 }
          const firstPass = passed && !prev.passedAt
          return {
            exams: { ...s.exams, [id]: { best: Math.max(prev.best, pct), attempts: prev.attempts + 1, passedAt: prev.passedAt ?? (passed ? Date.now() : undefined) } },
            xp: s.xp + (firstPass ? xp : 0),
          }
        }),
      addCertificate: (c) => {
        let added = false
        set((s) => {
          // Une certification pratique renouvelée remplace l'ancienne ; les autres ne se délivrent qu'une fois
          const prev = s.certificates.find((x) => x.id === c.id && x.kind === c.kind)
          if (prev && c.kind !== 'practical') return {}
          added = true
          const rest = prev ? s.certificates.filter((x) => x !== prev) : s.certificates
          return { certificates: [...rest, { ...c, date: c.date ?? Date.now() }], xp: s.xp + (c.kind === 'path' ? 250 : c.kind === 'practical' && !prev ? 500 : 0) }
        })
        return added
      },
      touchDay: () =>
        set((s) => {
          const t = today()
          return s.days.includes(t) ? {} : { days: [...s.days, t].slice(-400) }
        }),
      startCertAttempt: (a) => set((s) => ({ certAttempts: [...s.certAttempts, a].slice(-60) })),
      recordVolet: (id, r) => set((s) => ({ certAttempts: s.certAttempts.map((a) => (a.id === id && a.status === 'running' ? { ...a, results: [...a.results, r] } : a)) })),
      closeCertAttempt: (id, o) => set((s) => ({ certAttempts: s.certAttempts.map((a) => (a.id === id ? { ...a, ...o, finishedAt: Date.now() } : a)) })),
      reset: () => set({ cases: [], lessons: {}, drills: {}, cards: {}, exams: {}, certificates: [], certAttempts: [], days: [], xp: 0 }),
    }),
    { name: 'spectra-profile', storage: safeStorage, version: 1 },
  ),
)

export const RANKS = [
  { xp: 0, name: 'Analyste stagiaire' },
  { xp: 300, name: 'Analyste' },
  { xp: 900, name: 'Analyste confirmé' },
  { xp: 2000, name: 'Enquêteur crypto' },
  { xp: 3800, name: 'Enquêteur senior' },
  { xp: 6500, name: 'Expert traçage' },
  { xp: 10000, name: 'Référent national' },
]

export function rankOf(xp: number) {
  let i = 0
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++
  const cur = RANKS[i]
  const next = RANKS[i + 1]
  return { level: i + 1, name: cur.name, progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1, next }
}

/** Meilleur score (0-1) par scénario. */
export function bestByTemplate(cases: CaseRecord[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of cases) out[c.templateId] = Math.max(out[c.templateId] ?? 0, c.max ? c.score / c.max : 0)
  return out
}

/** Nombre de jours consécutifs d'activité, jusqu'à aujourd'hui (ou hier). */
export function dayStreak(days: string[]): number {
  const set = new Set(days)
  const d = new Date()
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  if (!set.has(key(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (set.has(key(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}
