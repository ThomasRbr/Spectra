import type { Objective } from '../scenarios/types'

export type Answer = string | string[] | number | undefined

export interface ObjectiveResult {
  id: string
  earned: number
  max: number
  status: 'correct' | 'partial' | 'wrong' | 'empty'
  detail?: string
}

export const GENERAL_HINT_COST = 5
export const OBJECTIVE_HINT_RATIO = 0.3

export function evaluate(o: Objective, a: Answer): ObjectiveResult {
  const base = { id: o.id, max: o.points }
  if (a === undefined || a === '' || (Array.isArray(a) && a.length === 0)) return { ...base, earned: 0, status: 'empty' }
  switch (o.type) {
    case 'address':
    case 'tx':
    case 'entity': {
      const ok = o.answer.includes(String(a))
      return { ...base, earned: ok ? o.points : 0, status: ok ? 'correct' : 'wrong' }
    }
    case 'addresses': {
      const given = new Set(Array.isArray(a) ? a : [String(a)])
      const truth = new Set(o.answer)
      let tp = 0
      for (const g of given) if (truth.has(g)) tp++
      const precision = tp / given.size
      const recall = tp / truth.size
      const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
      const earned = Math.round(o.points * f1)
      return {
        ...base, earned,
        status: f1 >= 0.999 ? 'correct' : f1 > 0 ? 'partial' : 'wrong',
        detail: `${tp}/${truth.size} trouvées · ${given.size - tp} faux positif(s) · précision ${(precision * 100).toFixed(0)} % · rappel ${(recall * 100).toFixed(0)} %`,
      }
    }
    case 'amount': {
      const v = Number(a)
      const err = Math.abs(v - o.answer) / Math.max(1e-12, Math.abs(o.answer))
      if (err <= o.tolerance) return { ...base, earned: o.points, status: 'correct', detail: `écart ${(err * 100).toFixed(2)} %` }
      if (err <= o.tolerance * 3) return { ...base, earned: Math.round(o.points / 2), status: 'partial', detail: `écart ${(err * 100).toFixed(2)} %` }
      return { ...base, earned: 0, status: 'wrong', detail: `écart ${(err * 100).toFixed(1)} %` }
    }
    case 'number': {
      const v = Number(a)
      const tol = o.tolerance ?? 0
      const ok = Math.abs(v - o.answer) <= tol + 1e-9
      return { ...base, earned: ok ? o.points : 0, status: ok ? 'correct' : 'wrong' }
    }
    case 'choice': {
      const ok = Number(a) === o.answer
      return { ...base, earned: ok ? o.points : 0, status: ok ? 'correct' : 'wrong' }
    }
  }
}

export interface CaseScore {
  results: ObjectiveResult[]
  raw: number
  penalties: number
  total: number
  max: number
  pct: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
}

export function scoreCase(objectives: Objective[], answers: Record<string, Answer>, generalHints: number, objectiveHints: string[]): CaseScore {
  const results = objectives.map((o) => evaluate(o, answers[o.id]))
  const raw = results.reduce((s, r) => s + r.earned, 0)
  const max = objectives.reduce((s, o) => s + o.points, 0)
  let penalties = generalHints * GENERAL_HINT_COST
  for (const id of objectiveHints) {
    const o = objectives.find((x) => x.id === id)
    if (o) penalties += Math.round(o.points * OBJECTIVE_HINT_RATIO)
  }
  const total = Math.max(0, raw - penalties)
  const pct = max ? total / max : 0
  const grade = pct >= 0.95 ? 'S' : pct >= 0.8 ? 'A' : pct >= 0.65 ? 'B' : pct >= 0.45 ? 'C' : 'D'
  return { results, raw, penalties, total, max, pct, grade }
}

export const GRADE_COLOR: Record<CaseScore['grade'], string> = {
  S: '#22d3ee',
  A: '#34d399',
  B: '#a3e635',
  C: '#facc15',
  D: '#f43f5e',
}
