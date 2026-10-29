import { useMemo, useState } from 'react'
import { SCENARIOS, scenarioById } from '../../scenarios'
import { DIFFICULTY, SKILLS, type ScenarioTemplate, type SkillId } from '../../scenarios/types'
import { useProfile, rankOf, bestByTemplate } from '../../store/profile'
import { useGame, loadSavedCase } from '../../store/game'
import { useUi } from '../../store/ui'
import { LESSONS, TRACKS } from '../../academy'
import { DifficultyBadge, Icon, ProgressBar, fmtDuration } from '../common'
import { GRADE_COLOR } from '../../lib/scoring'
import { LaunchModal, MissionCard, dailyChallenge } from './Missions'

export function skillMastery(cases: ReturnType<typeof useProfile.getState>['cases']): Record<string, number> {
  const best = bestByTemplate(cases)
  const groups: Record<string, number[]> = {}
  for (const s of SCENARIOS) {
    for (const k of s.skills) {
      const g = SKILLS[k].group
      ;(groups[g] ??= []).push(best[s.id] ?? 0)
    }
  }
  return Object.fromEntries(Object.entries(groups).map(([g, v]) => [g, v.reduce((a, b) => a + b, 0) / v.length]))
}

export function Dashboard() {
  const profile = useProfile()
  const rank = rankOf(profile.xp)
  const [pick, setPick] = useState<{ s: ScenarioTemplate; seed?: number } | null>(null)
  const saved = useMemo(() => loadSavedCase(), [])
  const savedTpl = saved ? scenarioById(saved.templateId) : undefined
  const best = bestByTemplate(profile.cases)
  const mastery = skillMastery(profile.cases)
  const daily = dailyChallenge()
  const done = Object.keys(best).length
  const avg = profile.cases.length ? profile.cases.reduce((s, c) => s + c.score / c.max, 0) / profile.cases.length : 0
  const totalTime = profile.cases.reduce((s, c) => s + c.durationSec, 0)
  const lessonsRead = Object.values(profile.lessons).filter((l) => l.read).length
  const recommended = SCENARIOS.filter((s) => (best[s.id] ?? 0) < 0.8).sort((a, b) => a.difficulty - b.difficulty || (best[a.id] ?? 0) - (best[b.id] ?? 0)).slice(0, 3)
  const nextLesson = LESSONS.find((l) => !profile.lessons[l.id]?.read)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-8 py-8">
        {/* En-tête */}
        <div className="relative overflow-hidden rounded-3xl border border-ink-700/70 hero-gradient p-8">
          <HeroGraph />
          <div className="relative z-10 max-w-2xl">
            <div className="label text-accent">Plateforme d'entraînement au traçage de crypto-actifs</div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">Bonjour, <span className="glow-text text-accent">{profile.name}</span></h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-200">Suivez les fonds à travers Bitcoin, Ethereum, Tron, XRP et les bridges. Déjouez les peel chains, les mixeurs et les CoinJoin. Chaque affaire est unique et corrigée automatiquement.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {savedTpl && saved ? (
                <button className="btn-primary !py-2" onClick={() => {
                  if (useGame.getState().resume(saved)) useUi.getState().set({ page: 'workspace', leftTab: 'objectives' })
                }}>
                  <Icon name="Play" size={15} /> Reprendre « {savedTpl.title} »
                </button>
              ) : (
                <button className="btn-primary !py-2" onClick={() => recommended[0] && setPick({ s: recommended[0] })}>
                  <Icon name="Crosshair" size={15} /> Nouvelle enquête
                </button>
              )}
              <button className="btn-outline !py-2" onClick={() => useUi.getState().setPage('missions')}>
                <Icon name="LayoutGrid" size={15} /> Toutes les missions
              </button>
              <button className="btn-outline !py-2" onClick={() => useUi.getState().setPage('academy')}>
                <Icon name="GraduationCap" size={15} /> Académie
              </button>
            </div>
          </div>
          <div className="absolute right-8 top-8 z-10 hidden w-64 rounded-2xl panel p-4 lg:block">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-lg font-bold text-accent">{rank.level}</div>
              <div>
                <div className="text-[13px] font-semibold text-white">{rank.name}</div>
                <div className="text-[11px] text-ink-300">{profile.xp.toLocaleString('fr-FR')} XP</div>
              </div>
            </div>
            <ProgressBar value={rank.progress} className="mt-3" />
            <div className="mt-1 text-[10.5px] text-ink-400">{rank.next ? `${(rank.next.xp - profile.xp).toLocaleString('fr-FR')} XP avant « ${rank.next.name} »` : 'Rang maximal atteint'}</div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <BigStat icon="FolderCheck" label="Affaires résolues" value={`${profile.cases.length}`} sub={`${done}/${SCENARIOS.length} scénarios distincts`} color="#22d3ee" />
          <BigStat icon="Target" label="Précision moyenne" value={`${Math.round(avg * 100)} %`} sub="sur toutes les affaires" color="#34d399" />
          <BigStat icon="Timer" label="Temps d'analyse" value={fmtDuration(totalTime)} sub="cumulé" color="#a78bfa" />
          <BigStat icon="GraduationCap" label="Leçons" value={`${lessonsRead}/${LESSONS.length || '—'}`} sub="lues dans l'Académie" color="#facc15" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {daily && (
              <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-ink-900 to-ink-900 p-5">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300"><Icon name="Flame" size={22} /></div>
                  <div className="flex-1">
                    <div className="label !text-amber-300">Défi du jour</div>
                    <div className="mt-0.5 text-lg font-semibold text-white">{daily.template.title}</div>
                    <div className="text-[12.5px] text-ink-300">{daily.template.tagline}</div>
                    <div className="mt-2 flex items-center gap-2"><DifficultyBadge d={daily.template.difficulty} /><span className="font-mono text-[11px] text-ink-400">graine {daily.seed}</span></div>
                  </div>
                  <button className="btn-primary !bg-amber-400 hover:!bg-amber-300" style={{ boxShadow: '0 0 24px -4px rgba(251,191,36,.5)' }} onClick={() => setPick({ s: daily.template, seed: daily.seed })}>
                    <Icon name="Play" size={14} /> Relever
                  </button>
                </div>
                <div className="mt-3 text-[11px] text-ink-400">Même affaire pour tous les enquêteurs aujourd'hui : comparez vos scores avec vos collègues.</div>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-white">Recommandées pour vous</h2>
                <button className="ml-auto text-[12px] text-accent hover:underline" onClick={() => useUi.getState().setPage('missions')}>Tout voir</button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {recommended.map((s) => <MissionCard key={s.id} s={s} best={best[s.id]} onOpen={() => setPick({ s })} />)}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-[15px] font-semibold text-white">Dernières affaires</h2>
              {profile.cases.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-ink-600 p-8 text-center text-[13px] text-ink-400">Aucune affaire terminée pour l'instant. Commencez par « Faux conseiller bancaire ».</div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-ink-700/70">
                  {profile.cases.slice(0, 8).map((c, i) => {
                    const t = scenarioById(c.templateId)
                    return (
                      <div key={i} className="flex items-center gap-3 border-b border-ink-700/50 bg-ink-900/60 px-4 py-2.5 last:border-0">
                        <span className="grid h-8 w-8 place-items-center rounded-lg font-bold" style={{ color: GRADE_COLOR[c.grade as 'S'], background: `${GRADE_COLOR[c.grade as 'S']}18` }}>{c.grade}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] text-white">{t?.title ?? c.templateId}</div>
                          <div className="text-[11px] text-ink-400">{new Date(c.date).toLocaleString('fr-FR')} · {fmtDuration(c.durationSec)} · graine {c.seed}{c.mode === 'examen' ? ' · examen' : ''}</div>
                        </div>
                        <span className="chip" style={{ color: DIFFICULTY[c.difficulty].color, background: `${DIFFICULTY[c.difficulty].color}14` }}>{DIFFICULTY[c.difficulty].label}</span>
                        <span className="w-16 text-right font-mono text-[13px] text-white">{c.score}/{c.max}</span>
                        <span className="w-14 text-right font-mono text-[11.5px] text-accent">+{c.xp}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-5">
              <h2 className="text-[15px] font-semibold text-white">Profil de compétences</h2>
              <p className="text-[11.5px] text-ink-400">Meilleur score par domaine</p>
              <Radar values={mastery} />
            </div>
            {nextLesson && (
              <button className="w-full rounded-2xl border border-ink-700/70 bg-ink-900/60 p-5 text-left transition hover:border-accent/50" onClick={() => useUi.getState().openLesson(nextLesson.id)}>
                <div className="label">Prochaine leçon</div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-glow"><Icon name="BookOpenText" size={18} /></span>
                  <div>
                    <div className="text-[14px] font-semibold text-white">{nextLesson.title}</div>
                    <div className="text-[11.5px] text-ink-400">{TRACKS[nextLesson.track].label} · {nextLesson.minutes} min</div>
                  </div>
                  <Icon name="ChevronRight" size={16} className="ml-auto text-ink-400" />
                </div>
              </button>
            )}
            <div className="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-5">
              <h2 className="mb-3 text-[15px] font-semibold text-white">Compétences travaillées</h2>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(SKILLS) as SkillId[]).map((k) => {
                  const covered = profile.cases.some((c) => c.skills.includes(k) && c.score / c.max >= 0.65)
                  return (
                    <span key={k} className={`chip border ${covered ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-ink-700 bg-ink-850 text-ink-400'}`}>
                      {covered && <Icon name="Check" size={10} />} {SKILLS[k].label}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <LaunchModal s={pick?.s ?? null} seed={pick?.seed} onClose={() => setPick(null)} />
    </div>
  )
}

function BigStat({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl" style={{ background: `${color}22` }} />
      <div className="flex items-center gap-2 text-[11.5px] text-ink-300"><Icon name={icon} size={14} color={color} /> {label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      <div className="text-[11px] text-ink-400">{sub}</div>
    </div>
  )
}

export function Radar({ values }: { values: Record<string, number> }) {
  const keys = Object.keys(values)
  if (keys.length < 3) return null
  const S = 260
  const c = S / 2
  const R = 88
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2
    return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v]
  }
  const poly = keys.map((k, i) => pt(i, Math.max(0.04, values[k])).join(',')).join(' ')
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto mt-2 w-full max-w-[300px]">
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={keys.map((_, i) => pt(i, r).join(',')).join(' ')} fill="none" stroke="#1f2b47" strokeWidth={1} />
      ))}
      {keys.map((_, i) => {
        const [x, y] = pt(i, 1)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#1f2b47" />
      })}
      <polygon points={poly} fill="rgba(34,211,238,0.18)" stroke="#22d3ee" strokeWidth={1.8} style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,.5))' }} />
      {keys.map((k, i) => {
        const [x, y] = pt(i, 1.24)
        const [px, py] = pt(i, Math.max(0.04, values[k]))
        return (
          <g key={k}>
            <circle cx={px} cy={py} r={3} fill="#22d3ee" />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#a9b4cc" fontSize={9.5} fontFamily="Inter">{k}</text>
            <text x={x} y={y + 11} textAnchor="middle" fill="#4a5a80" fontSize={8.5} fontFamily="JetBrains Mono">{Math.round(values[k] * 100)}%</text>
          </g>
        )
      })}
    </svg>
  )
}

function HeroGraph() {
  const nodes = [
    [620, 70, '#4ade80'], [720, 40, '#4a5a80'], [730, 120, '#f472b6'], [840, 80, '#f472b6'], [860, 170, '#4a5a80'],
    [960, 60, '#a78bfa'], [980, 150, '#22d3ee'], [1080, 100, '#22d3ee'], [1060, 210, '#f43f5e'], [1160, 170, '#22d3ee'],
  ] as const
  const links = [[0, 1], [0, 2], [2, 3], [2, 4], [3, 5], [3, 6], [6, 7], [4, 8], [8, 9], [5, 7]]
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-60" viewBox="0 0 1200 260" preserveAspectRatio="xMaxYMid slice">
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="#22d3ee" strokeOpacity={0.35} strokeWidth={1.2} strokeDasharray="4 4" className="animate-dash" />
      ))}
      {nodes.map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={14} fill={c} opacity={0.12} />
          <circle cx={x} cy={y} r={7} fill="#05070d" stroke={c} strokeWidth={2} />
        </g>
      ))}
    </svg>
  )
}
