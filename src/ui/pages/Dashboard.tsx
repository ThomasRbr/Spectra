import { useMemo, useState } from 'react'
import { SCENARIOS, scenarioById } from '../../scenarios'
import { DIFFICULTY, SKILLS, type ScenarioTemplate, type SkillId } from '../../scenarios/types'
import { useProfile, rankOf, bestByTemplate } from '../../store/profile'
import { useGame, loadSavedCase } from '../../store/game'
import { useUi } from '../../store/ui'
import { LESSONS, PATHS, TRACKS } from '../../academy'
import { dueCards, nextAction, pathProgress, stepLabel } from '../../lib/academy'
import { ChainBadge, DifficultyBadge, Icon, ProgressBar, fmtDuration } from '../common'
import { GRADE_COLOR } from '../../lib/scoring'
import { FlowGlyph } from '../FlowGlyph'
import { goToStep } from '../academy/nav'
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

const STEP_KIND: Record<string, { label: string; icon: string; cta: string }> = {
  lesson: { label: 'Leçon', icon: 'BookOpenText', cta: 'Lire la leçon' },
  drill: { label: 'Exercice', icon: 'Dumbbell', cta: 'S\'entraîner' },
  exam: { label: 'Examen', icon: 'ClipboardCheck', cta: 'Passer l\'examen' },
  mission: { label: 'Mission', icon: 'Crosshair', cta: 'Ouvrir le dossier' },
}

export function Dashboard() {
  const profile = useProfile()
  const rank = rankOf(profile.xp)
  const [pick, setPick] = useState<{ s: ScenarioTemplate; seed?: number } | null>(null)
  const saved = useMemo(() => loadSavedCase(), [])
  const g = useGame.getState()
  const liveTpl = g.inst && !g.score ? g.template : null
  const resumeTpl = liveTpl ?? (saved ? scenarioById(saved.templateId) : undefined)
  const best = bestByTemplate(profile.cases)
  const daily = dailyChallenge()
  const due = dueCards(profile).length
  const next = nextAction(profile)
  const path = next ? PATHS.find((p) => p.id === next.pathId) : undefined
  const prog = path ? pathProgress(profile, path) : undefined
  const recommended = SCENARIOS.filter((s) => (best[s.id] ?? 0) < 0.8 && s.id !== resumeTpl?.id).sort((a, b) => a.difficulty - b.difficulty || (best[a.id] ?? 0) - (best[b.id] ?? 0)).slice(0, 3)
  const nextLessonId = next?.step.kind === 'lesson' ? next.step.id : undefined
  const nextLesson = nextLessonId ? LESSONS.find((l) => l.id === nextLessonId) : undefined
  const unlocks = next && path ? path.steps.slice(next.index + 1).find((s) => s.kind === 'mission') : undefined

  const skills = (Object.keys(SKILLS) as SkillId[]).map((k) => {
    const cs = profile.cases.filter((c) => c.skills.includes(k))
    return { k, n: cs.length, avg: cs.length ? Math.max(...cs.map((c) => c.score / c.max)) : 0 }
  })
  const worked = skills.filter((s) => s.n).sort((a, b) => b.avg - a.avg)
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const resume = () => {
    if (liveTpl) return useUi.getState().set({ page: 'workspace' })
    if (saved && useGame.getState().resume(saved)) useUi.getState().set({ page: 'workspace', leftTab: 'objectives' })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-10 py-10">
        <div>
          <div className="text-dense capitalize text-ink-400">{today}</div>
          <h1 className="mt-1 text-page font-semibold tracking-tight text-white">Bonjour, {profile.name}</h1>
        </div>

        <div className="mt-7 flex flex-wrap gap-4">
          {/* Reprendre ou commencer */}
          <section className="card flex min-w-0 flex-[2_1_560px] flex-wrap gap-6 p-6">
            {resumeTpl ? (
              <div className="flex min-w-0 flex-[1_1_280px] flex-col">
                <div className="label">Enquête en cours</div>
                <h2 className="mt-2 text-section font-semibold leading-snug text-white">{resumeTpl.title}</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <DifficultyBadge d={resumeTpl.difficulty} />
                  {resumeTpl.chains.map((c) => <ChainBadge key={c} chain={c} />)}
                  {resumeTpl.guided && <span className="chip border border-ink-600 text-ink-100">Guidée</span>}
                </div>
                {liveTpl && g.inst && (
                  <div className="mt-5">
                    <div className="flex justify-between text-dense"><span className="text-ink-300">Objectifs renseignés</span><span className="font-mono text-white">{g.inst.objectives.filter((o) => g.answers[o.id] !== undefined).length} / {g.inst.objectives.length}</span></div>
                    <ProgressBar className="mt-2" value={g.inst.objectives.filter((o) => g.answers[o.id] !== undefined).length / Math.max(1, g.inst.objectives.length)} />
                  </div>
                )}
                {liveTpl && g.log.length > 0 && <p className="mt-4 line-clamp-2 text-dense leading-relaxed text-ink-300">Dernière action : {g.log[g.log.length - 1].text}</p>}
                <div className="flex-1" />
                <div className="mt-5">
                  <button className="btn-primary h-10 px-4 text-body font-semibold" onClick={resume}><Icon name="Play" size={15} /> Reprendre l'enquête</button>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-[1_1_280px] flex-col">
                <div className="label">Pour commencer</div>
                <h2 className="mt-2 text-section font-semibold leading-snug text-white">{recommended[0]?.title ?? 'Choisissez une mission'}</h2>
                {recommended[0] && <p className="mt-2 text-body leading-relaxed text-ink-300">{recommended[0].tagline}</p>}
                <div className="flex-1" />
                <div className="mt-5 flex gap-2">
                  {recommended[0] && <button className="btn-primary h-10 px-4 text-body font-semibold" onClick={() => setPick({ s: recommended[0] })}><Icon name="FolderOpen" size={15} /> Ouvrir la fiche</button>}
                  <button className="btn-outline h-10" onClick={() => useUi.getState().setPage('missions')}>Toutes les missions</button>
                </div>
              </div>
            )}
            {(resumeTpl ?? recommended[0]) && (
              <div className="min-w-[260px] flex-[1_1_280px] overflow-hidden rounded-lg border border-ink-700">
                <FlowGlyph s={(resumeTpl ?? recommended[0])!} className="!h-full min-h-[190px]" />
              </div>
            )}
          </section>

          {/* Cursus */}
          <section className="card flex min-w-0 flex-[1_1_300px] flex-col p-6">
            {next && path && prog ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="label">{path.title}</span>
                  <span className="font-mono text-meta text-ink-400">{prog.done} / {prog.total}</span>
                </div>
                <ProgressBar className="mt-2" value={prog.pct} color="rgb(var(--emerald-400))" />
                <div className="mt-5 flex items-center gap-1.5 text-meta text-ink-300">
                  <Icon name={STEP_KIND[next.step.kind].icon} size={13} /> Prochaine étape · {STEP_KIND[next.step.kind].label.toLowerCase()}
                  {nextLesson && <> · {nextLesson.minutes} min</>}
                </div>
                <h2 className="mt-1.5 text-title font-semibold leading-snug text-white">{stepLabel(next.step)}</h2>
                {nextLesson && <p className="mt-1.5 line-clamp-3 text-dense leading-relaxed text-ink-300">{nextLesson.summary}</p>}
                {unlocks && (
                  <div className="mt-4 border-t border-ink-700 pt-3 text-meta leading-relaxed text-ink-400">
                    Ensuite : <span className="text-ink-200">{scenarioById(unlocks.id)?.title ?? stepLabel(unlocks)}</span>
                  </div>
                )}
                <div className="flex-1" />
                <div className="mt-5">
                  <button className="btn-outline h-10" onClick={() => goToStep(next.step, next.pathId)}>{STEP_KIND[next.step.kind].cta}</button>
                </div>
              </>
            ) : (
              <>
                <div className="label">Académie</div>
                <h2 className="mt-2 text-title font-semibold text-white">Tous les parcours sont terminés</h2>
                <p className="mt-1.5 text-dense text-ink-300">Révisez vos fiches ou passez une certification pratique.</p>
                <div className="flex-1" />
                <button className="btn-outline mt-5 h-10 self-start" onClick={() => useUi.getState().openAcademy({ kind: 'certs' })}>Certifications</button>
              </>
            )}
          </section>
        </div>

        <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
          {daily && (
            <section className="card flex flex-col p-5">
              <div className="label">Défi du jour</div>
              <div className="mt-2 text-title font-semibold leading-snug text-white">{daily.template.title}</div>
              <div className="mt-1 text-meta text-ink-400">Même affaire pour tous aujourd'hui · graine <span className="font-mono text-ink-200">{daily.seed}</span></div>
              <div className="flex-1" />
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex gap-1.5">{daily.template.chains.map((c) => <ChainBadge key={c} chain={c} compact />)}<DifficultyBadge d={daily.template.difficulty} /></div>
                <button className="btn-outline" onClick={() => setPick({ s: daily.template, seed: daily.seed })}>Relever</button>
              </div>
            </section>
          )}
          <section className="card flex flex-col p-5">
            <div className="label">Révisions</div>
            <div className="mt-2 text-title font-semibold text-white">{due ? `${due} fiche${due > 1 ? 's' : ''} à revoir` : 'Rien à revoir aujourd\'hui'}</div>
            <div className="mt-1 text-meta text-ink-400">{due ? `Environ ${Math.max(1, Math.round(due / 2.5))} min · répétition espacée` : 'Les fiches reviennent au bon moment pour s\'ancrer.'}</div>
            <div className="flex-1" />
            <div className="mt-4 flex justify-end">
              <button className="btn-outline" disabled={!due} onClick={() => useUi.getState().openAcademy({ kind: 'cards' })}>Réviser</button>
            </div>
          </section>
          <section className="card flex flex-col p-5">
            <div className="label">Niveau {rank.level}</div>
            <div className="mt-2 text-title font-semibold text-white">{rank.name}</div>
            <div className="mt-1 text-meta text-ink-400">{rank.next ? `${(rank.next.xp - profile.xp).toLocaleString('fr-FR')} XP avant « ${rank.next.name} »` : 'Rang maximal atteint'}</div>
            <div className="flex-1" />
            <ProgressBar className="mt-5" value={rank.progress} color="rgb(var(--ink-strong))" />
            <div className="mt-1.5 flex justify-between font-mono text-meta text-ink-400"><span>{profile.xp.toLocaleString('fr-FR')} XP</span>{rank.next && <span>{rank.next.xp.toLocaleString('fr-FR')} XP</span>}</div>
          </section>
        </div>

        {recommended.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-title font-semibold text-white">Recommandées pour vous</h2>
              <button className="ml-auto text-dense text-ink-300 hover:text-white" onClick={() => useUi.getState().setPage('missions')}>Toutes les missions →</button>
            </div>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
              {recommended.map((s) => <MissionCard key={s.id} s={s} best={best[s.id]} onOpen={() => setPick({ s })} />)}
            </div>
          </section>
        )}

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-title font-semibold text-white">Compétences travaillées</h2>
              <span className="text-meta text-ink-400">{skills.length - worked.length} pas encore abordée{skills.length - worked.length > 1 ? 's' : ''}</span>
            </div>
            {!worked.length && <p className="mt-3 text-dense leading-relaxed text-ink-300">Chaque affaire terminée fait apparaître ici les compétences mobilisées et votre meilleur score.</p>}
            <div className="mt-4 space-y-3.5">
              {worked.slice(0, 7).map((s) => (
                <div key={s.k}>
                  <div className="flex justify-between text-dense"><span className="text-ink-100">{SKILLS[s.k].label}</span><span className="font-mono text-ink-300">{Math.round(s.avg * 100)} %</span></div>
                  <ProgressBar className="mt-1.5" value={s.avg} color="rgb(var(--ink-200))" />
                </div>
              ))}
            </div>
          </section>

          <section className="card overflow-hidden">
            <h2 className="px-5 pt-5 text-title font-semibold text-white">Dernières affaires</h2>
            {profile.cases.length === 0 ? (
              <p className="px-5 pb-5 pt-3 text-dense leading-relaxed text-ink-300">Aucune affaire terminée pour l'instant. Le tutoriel 1 est le meilleur point de départ.</p>
            ) : (
              <div className="mt-3">
                {profile.cases.slice(0, 6).map((c, i) => {
                  const t = scenarioById(c.templateId)
                  const gc = GRADE_COLOR[c.grade as 'S']
                  return (
                    <div key={i} className="flex items-center gap-3 border-t border-ink-700 px-5 py-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-dense font-bold" style={{ color: gc, background: `${gc}1f` }}>{c.grade}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-dense font-medium text-white">{t?.title ?? c.templateId}</div>
                        <div className="text-meta text-ink-400">{new Date(c.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {fmtDuration(c.durationSec)} · {DIFFICULTY[c.difficulty].label}{c.mode === 'examen' ? ' · examen' : ''}</div>
                      </div>
                      <span className="font-mono text-dense text-white">{c.score}/{c.max}</span>
                      <span className="w-12 text-right font-mono text-meta text-emerald-300">+{c.xp}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {nextLesson && (
          <p className="mt-8 text-meta text-ink-400">
            Piste : {TRACKS[nextLesson.track].label} — {LESSONS.filter((l) => profile.lessons[l.id]?.read).length} leçons lues sur {LESSONS.length}.
          </p>
        )}
      </div>
      <LaunchModal s={pick?.s ?? null} seed={pick?.seed} onClose={() => setPick(null)} />
    </div>
  )
}

export function Radar({ values }: { values: Record<string, number> }) {
  const keys = Object.keys(values)
  if (keys.length < 3) return null
  const S = 260
  const c = S / 2
  const R = 84
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2
    return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v]
  }
  const poly = keys.map((k, i) => pt(i, Math.max(0.04, values[k])).join(',')).join(' ')
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto mt-2 w-full max-w-[300px]" role="img" aria-label="Profil de compétences par domaine">
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={keys.map((_, i) => pt(i, r).join(',')).join(' ')} fill="none" stroke="rgb(var(--ink-700))" strokeWidth={1} />
      ))}
      {keys.map((_, i) => {
        const [x, y] = pt(i, 1)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgb(var(--ink-700))" />
      })}
      <polygon points={poly} fill="rgb(var(--accent) / .16)" stroke="rgb(var(--accent))" strokeWidth={1.6} strokeLinejoin="round" />
      {keys.map((k, i) => {
        const [x, y] = pt(i, 1.25)
        const [px, py] = pt(i, Math.max(0.04, values[k]))
        return (
          <g key={k}>
            <circle cx={px} cy={py} r={2.8} fill="rgb(var(--accent))" />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="rgb(var(--ink-200))" fontSize={10} fontFamily="Inter">{k}</text>
            <text x={x} y={y + 12} textAnchor="middle" fill="rgb(var(--ink-400))" fontSize={9} fontFamily="JetBrains Mono">{Math.round(values[k] * 100)} %</text>
          </g>
        )
      })}
    </svg>
  )
}
