import { useState } from 'react'
import type { Question } from '../../academy'
import { Icon, tint } from '../common'

export function isCorrect(q: Question, given: number[] | undefined): boolean {
  if (!given || !given.length) return false
  const ans = Array.isArray(q.answer) ? [...q.answer].sort() : [q.answer]
  const g = [...given].sort()
  return ans.length === g.length && ans.every((a, i) => a === g[i])
}

export function QuestionCard({ q, index, value, onChange, reveal }: { q: Question; index: number; value?: number[]; onChange?: (v: number[]) => void; reveal: boolean }) {
  const multi = q.kind === 'multi' || Array.isArray(q.answer)
  const answers = Array.isArray(q.answer) ? q.answer : [q.answer]
  const ok = reveal && isCorrect(q, value)
  return (
    <div className={`rounded-xl border bg-ink-900/60 p-4 transition ${reveal ? (ok ? 'border-emerald-400/40' : 'border-rose-400/40') : 'border-ink-700/70'}`}>
      <div className="flex items-start gap-2.5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ink-700 font-mono text-micro text-ink-200">{index + 1}</span>
        <div className="flex-1">
          <div className="text-body font-medium leading-snug text-white">{q.q}</div>
          {multi && <div className="mt-0.5 text-meta text-violet-300">Plusieurs réponses possibles</div>}
        </div>
        {reveal && <Icon name={ok ? 'CircleCheck' : 'CircleX'} size={18} className={ok ? 'text-emerald-400' : 'text-rose-400'} />}
      </div>
      <div className={`mt-3 grid gap-1.5 ${q.kind === 'truefalse' ? 'grid-cols-2' : ''}`}>
        {q.options.map((o, j) => {
          const chosen = value?.includes(j) ?? false
          const isAns = answers.includes(j)
          const cls = reveal
            ? isAns
              ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-50'
              : chosen
                ? 'border-rose-400/60 bg-rose-400/10 text-rose-50'
                : 'border-ink-700 text-ink-300'
            : chosen
              ? 'border-accent/60 bg-accent/10 text-white'
              : 'border-ink-700 text-ink-100 hover:border-ink-500 hover:bg-ink-800/60'
          return (
            <button
              key={j}
              disabled={reveal || !onChange}
              onClick={() => {
                if (!onChange) return
                if (multi) onChange(chosen ? (value ?? []).filter((x) => x !== j) : [...(value ?? []), j])
                else onChange([j])
              }}
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-body transition ${cls}`}
            >
              <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border ${multi ? 'rounded' : 'rounded-full'} ${chosen ? 'border-accent bg-accent/30' : 'border-ink-500'}`}>
                {chosen && <span className={`h-1.5 w-1.5 bg-accent ${multi ? 'rounded-sm' : 'rounded-full'}`} />}
              </span>
              <span className="flex-1">{o}</span>
            </button>
          )
        })}
      </div>
      {reveal && (
        <div className="mt-3 flex gap-2 rounded-xl bg-ink-850 p-3 text-dense leading-relaxed text-ink-200">
          <Icon name="Info" size={14} className="mt-0.5 shrink-0 text-accent" /> <span>{q.explain}</span>
        </div>
      )}
    </div>
  )
}

/** Quiz de fin de leçon : réponses, correction détaillée, nouvelle tentative. */
export function QuizRunner({ questions, onDone, best }: { questions: Question[]; onDone: (score: number, max: number) => void; best?: number }) {
  const [answers, setAnswers] = useState<Record<number, number[]>>({})
  const [checked, setChecked] = useState(false)
  const score = questions.reduce((s, q, i) => s + (isCorrect(q, answers[i]) ? 1 : 0), 0)
  const complete = questions.every((_, i) => answers[i]?.length)
  return (
    <div>
      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionCard key={i} q={q} index={i} value={answers[i]} reveal={checked} onChange={(v) => setAnswers((a) => ({ ...a, [i]: v }))} />
        ))}
      </div>
      {!checked ? (
        <button className="btn-primary mt-4 w-full !py-2.5" disabled={!complete} onClick={() => {
          setChecked(true)
          onDone(score, questions.length)
        }}>
          <Icon name="CircleCheck" size={16} /> Valider mes réponses {!complete && `(${Object.keys(answers).length}/${questions.length})`}
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-ink-700 bg-ink-900 p-4">
          <div className="text-page font-black" style={{ color: tint(score === questions.length ? '#34d399' : score / questions.length >= 0.6 ? '#facc15' : '#f43f5e') }}>{score}/{questions.length}</div>
          <div className="min-w-[200px] flex-1 text-dense text-ink-300">
            {score === questions.length ? 'Parfait : compétence acquise.' : score / questions.length >= 0.6 ? 'Leçon validée. Relisez les explications des erreurs.' : 'Moins de 60 % : relisez la leçon puis retentez le quiz.'}
            {best !== undefined && <div className="text-meta text-ink-400">Meilleur score précédent : {best}/{questions.length}</div>}
          </div>
          <button className="btn-outline" onClick={() => {
            setChecked(false)
            setAnswers({})
          }}>
            <Icon name="RotateCcw" size={14} /> Recommencer
          </button>
        </div>
      )}
    </div>
  )
}
