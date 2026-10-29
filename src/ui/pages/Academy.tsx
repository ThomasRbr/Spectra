import { useEffect, useMemo, useRef, useState } from 'react'
import { GLOSSARY } from '../../academy/glossary'
import { SCENARIOS } from '../../scenarios'
import { useProfile, rankOf } from '../../store/profile'
import { useUi } from '../../store/ui'
import { DIFFICULTY, SKILLS, type SkillId } from '../../scenarios/types'
import { DifficultyBadge, Empty, Icon, ProgressBar, RichText, fmtDuration } from '../common'
import { scenarioById } from '../../scenarios'
import { GRADE_COLOR } from '../../lib/scoring'
import { LaunchModal } from './Missions'
import { Radar, skillMastery } from './Dashboard'

export function Glossary() {
  const [q, setQ] = useState('')
  const list = GLOSSARY.filter((g) => !q || `${g.term} ${g.def}`.toLowerCase().includes(q.toLowerCase()))
  const letters = [...new Set(list.map((g) => g.term[0].toUpperCase()))]
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-8">
        <div className="label text-accent">Référence</div>
        <h1 className="mt-1 text-3xl font-bold text-white">Glossaire</h1>
        <div className="relative mt-5">
          <Icon name="Search" size={15} className="absolute left-3 top-2.5 text-ink-400" />
          <input className="input !pl-9 !py-2" placeholder={`Rechercher parmi ${GLOSSARY.length} termes…`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!GLOSSARY.length && <Empty icon="BookA" title="Glossaire en cours de rédaction" />}
        {letters.map((L) => (
          <div key={L} className="mt-6">
            <div className="mb-2 text-lg font-bold text-accent">{L}</div>
            <div className="divide-y divide-ink-700/60 overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/60">
              {list.filter((g) => g.term[0].toUpperCase() === L).map((g) => (
                <div key={g.term} className="px-4 py-3">
                  <div className="text-[14px] font-semibold text-white">{g.term}</div>
                  <div className="mt-0.5 text-[13px] leading-relaxed text-ink-300">{g.def}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Profile() {
  const p = useProfile()
  const rank = rankOf(p.xp)
  const mastery = skillMastery(p.cases)
  const skillStats = (Object.keys(SKILLS) as SkillId[]).map((k) => {
    const cs = p.cases.filter((c) => c.skills.includes(k))
    return { k, n: cs.length, avg: cs.length ? cs.reduce((s, c) => s + c.score / c.max, 0) / cs.length : 0 }
  })
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="label text-accent">Profil</div>
        <h1 className="mt-1 text-3xl font-bold text-white">Dossier de l'enquêteur</h1>
        <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-5">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-accent/40 bg-accent/10 text-2xl font-bold text-accent">{rank.level}</div>
                <div>
                  <div className="text-[16px] font-semibold text-white">{rank.name}</div>
                  <div className="text-[12px] text-ink-300">{p.xp.toLocaleString('fr-FR')} XP</div>
                </div>
              </div>
              <ProgressBar value={rank.progress} className="mt-4" />
              <label className="mt-4 block"><span className="label">Nom affiché</span><input className="input mt-1" value={p.name} onChange={(e) => p.setIdentity(e.target.value, p.unit)} /></label>
              <label className="mt-2 block"><span className="label">Unité</span><input className="input mt-1" value={p.unit} onChange={(e) => p.setIdentity(p.name, e.target.value)} /></label>
            </div>
            <div className="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-5">
              <div className="label">Domaines</div>
              <Radar values={mastery} />
            </div>
            <button className="btn-danger w-full" onClick={() => confirm('Effacer toute la progression (affaires, XP, leçons) ?') && p.reset()}>
              <Icon name="Trash2" size={14} /> Réinitialiser la progression
            </button>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-5">
              <div className="label mb-3">Compétences détaillées</div>
              <div className="grid gap-x-6 gap-y-2.5 md:grid-cols-2">
                {skillStats.map((s) => (
                  <div key={s.k}>
                    <div className="flex justify-between text-[12px]"><span className="text-ink-100">{SKILLS[s.k].label}</span><span className="font-mono text-ink-400">{s.n ? `${Math.round(s.avg * 100)} % · ${s.n}` : '—'}</span></div>
                    <ProgressBar value={s.avg} className="mt-1" color={s.avg >= 0.8 ? '#34d399' : s.avg >= 0.5 ? '#facc15' : '#22d3ee'} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-ink-700/70 bg-ink-900/60">
              <div className="label px-5 pt-4">Historique ({p.cases.length})</div>
              <div className="mt-2 max-h-[480px] overflow-y-auto">
                {p.cases.length === 0 && <div className="p-6 text-center text-[13px] text-ink-400">Aucune affaire terminée.</div>}
                {p.cases.map((c, i) => {
                  const t = scenarioById(c.templateId)
                  return (
                    <div key={i} className="flex items-center gap-3 border-t border-ink-700/50 px-5 py-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg font-bold" style={{ color: GRADE_COLOR[c.grade as 'S'], background: `${GRADE_COLOR[c.grade as 'S']}18` }}>{c.grade}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-white">{t?.title ?? c.templateId}</div>
                        <div className="text-[11px] text-ink-400">{new Date(c.date).toLocaleString('fr-FR')} · {fmtDuration(c.durationSec)} · graine {c.seed}</div>
                      </div>
                      <span className="chip" style={{ color: DIFFICULTY[c.difficulty].color, background: `${DIFFICULTY[c.difficulty].color}14` }}>{DIFFICULTY[c.difficulty].label}</span>
                      <span className="w-16 text-right font-mono text-[13px] text-white">{c.score}/{c.max}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
