import { useMemo, useState } from 'react'
import { CURRICULUM, DRILLS, EXAMS, LESSONS, LEVELS, PATHS, TRACKS, isAuthored, pathById, type Level, type LearningPath, type PathStep, type Track } from '../../academy'
import { scenarioById } from '../../scenarios'
import { useProfile, dayStreak, bestByTemplate } from '../../store/profile'
import { useUi } from '../../store/ui'
import { dueCards, lessonStatus, levelProgress, levelReached, nextAction, pathProgress, stepLabel } from '../../lib/academy'
import { Icon, ProgressBar } from '../common'
import { goToStep } from './nav'

// ── Accueil ────────────────────────────────────────────────────────────────

export function AcademyHome() {
  const p = useProfile()
  const done = LESSONS.filter((l) => p.lessons[l.id]?.done).length
  const reached = levelReached(p)
  const next = nextAction(p)
  const due = dueCards(p).length
  const streak = dayStreak(p.days)
  const drillsOk = Object.values(p.drills).reduce((s, d) => s + d.correct, 0)

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="relative overflow-hidden rounded-3xl border border-ink-700/70 hero-gradient p-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="label text-accent">Académie SPECTRA</div>
            <h1 className="mt-2 text-[38px] font-extrabold leading-tight tracking-tight text-white">Du débutant absolu<br />à l'expert du traçage</h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-200">
              {LESSONS.length} leçons sur 6 niveaux, des simulateurs interactifs, {DRILLS.length} types d'exercices générés à l'infini, des fiches en répétition espacée, {EXAMS.length} examens et {PATHS.length} parcours certifiants. Suivez un parcours guidé ou piochez librement dans la bibliothèque.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {next ? (
                <button className="btn-primary !py-2" onClick={() => goToStep(next.step, next.pathId)}>
                  <Icon name="Play" size={15} /> {done ? 'Continuer' : 'Commencer'} : {stepLabel(next.step)}
                </button>
              ) : (
                <button className="btn-primary !py-2" onClick={() => useUi.getState().openAcademy({ kind: 'certs' })}><Icon name="Award" size={15} /> Voir mes certificats</button>
              )}
              <button className="btn-outline !py-2" onClick={() => useUi.getState().openAcademy({ kind: 'paths' })}><Icon name="Route" size={15} /> Parcours</button>
              <button className="btn-outline !py-2" onClick={() => useUi.getState().openAcademy({ kind: 'library' })}><Icon name="Library" size={15} /> Bibliothèque</button>
            </div>
            {next && <div className="mt-2 text-[11.5px] text-ink-400">Parcours « {pathById(next.pathId)?.title} » · étape {next.index + 1}/{pathById(next.pathId)?.steps.length}</div>}
          </div>
          <div className="rounded-2xl panel p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border text-lg font-black" style={{ borderColor: reached >= 0 ? LEVELS[reached as Level].color : '#2c3a5c', color: reached >= 0 ? LEVELS[reached as Level].color : '#7a88a8' }}>
                {reached >= 0 ? `N${reached}` : '—'}
              </div>
              <div>
                <div className="text-[11px] text-ink-400">Niveau validé</div>
                <div className="text-[15px] font-semibold text-white">{reached >= 0 ? LEVELS[reached as Level].label : 'Aucun pour l\'instant'}</div>
              </div>
            </div>
            <div className="mt-4 flex justify-between text-[11.5px] text-ink-300"><span>Leçons validées</span><span className="font-mono">{done}/{LESSONS.length}</span></div>
            <ProgressBar value={done / Math.max(1, LESSONS.length)} className="mt-1" />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Mini icon="Flame" color="#fb923c" value={streak} label="jours" />
              <Mini icon="Layers" color="#facc15" value={due} label="fiches dues" />
              <Mini icon="Award" color="#a78bfa" value={p.certificates.length} label="certificats" />
            </div>
          </div>
        </div>
      </div>

      {/* Actions du jour */}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <DayCard icon="Layers" color="#facc15" title="Révision du jour" text={due ? `${due} fiche(s) à revoir maintenant` : 'Rien à revoir : lisez une leçon pour débloquer des fiches'} cta="Réviser" disabled={!due} onClick={() => useUi.getState().openAcademy({ kind: 'cards' })} />
        <DayCard icon="Dumbbell" color="#22d3ee" title="Exercice du jour" text={DRILLS.length ? `${dailyDrill()?.title ?? ''} · ${drillsOk} bonnes réponses au total` : 'Exercices en préparation'} cta="S'entraîner" disabled={!DRILLS.length} onClick={() => {
          const d = dailyDrill()
          if (d) useUi.getState().openAcademy({ kind: 'drill', id: d.id })
        }} />
        <DayCard icon="FileCheck2" color="#34d399" title="Prochain examen" text={nextExamText(p)} cta="Examens" onClick={() => useUi.getState().openAcademy({ kind: 'exams' })} />
      </div>

      {/* Carte des niveaux */}
      <section className="mt-8">
        <h2 className="text-[17px] font-semibold text-white">Carte du cursus</h2>
        <p className="text-[12.5px] text-ink-400">Chaque pastille est une leçon. Cliquez pour l'ouvrir, en accès libre.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-6">
          {([0, 1, 2, 3, 4, 5] as Level[]).map((lv) => {
            const m = LEVELS[lv]
            const pr = levelProgress(p, lv)
            const items = CURRICULUM.filter((c) => c.level === lv)
            return (
              <div key={lv} className="rounded-2xl border bg-ink-900/60 p-3" style={{ borderColor: `${m.color}40` }}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-bold" style={{ color: m.color }}>{m.short}</span>
                  <span className="truncate text-[12.5px] font-semibold text-white">{m.label}</span>
                  {pr.examPassed && <Icon name="BadgeCheck" size={14} className="ml-auto text-emerald-400" />}
                </div>
                <ProgressBar value={pr.done / pr.total} className="mt-2" color={m.color} />
                <div className="mt-3 space-y-1">
                  {items.map((c) => {
                    const st = lessonStatus(p, c.id)
                    return (
                      <button key={c.id} onClick={() => useUi.getState().openLesson(c.id)} title={c.title} className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[11.5px] text-ink-200 hover:bg-ink-800 hover:text-white">
                        <span className="h-2 w-2 shrink-0 rounded-full border" style={{ borderColor: m.color, background: st === 'done' ? m.color : st === 'started' ? `${m.color}55` : 'transparent' }} />
                        <span className="truncate">{c.title}</span>
                      </button>
                    )
                  })}
                </div>
                <button className="mt-2 w-full rounded-lg border border-ink-700 py-1 text-[11px] text-ink-300 hover:border-accent/50 hover:text-white" onClick={() => useUi.getState().openAcademy({ kind: 'exam', id: `exam-n${lv}` })}>
                  Examen {m.short}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Parcours */}
      <section className="mt-8">
        <div className="flex items-end">
          <div>
            <h2 className="text-[17px] font-semibold text-white">Parcours guidés</h2>
            <p className="text-[12.5px] text-ink-400">Une progression ordonnée : leçons, exercices, missions et examen final certifiant.</p>
          </div>
          <button className="ml-auto text-[12.5px] text-accent hover:underline" onClick={() => useUi.getState().openAcademy({ kind: 'paths' })}>Tous les parcours</button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PATHS.slice(0, 4).map((path) => <PathCard key={path.id} path={path} />)}
        </div>
      </section>
    </div>
  )
}

function dailyDrill() {
  if (!DRILLS.length) return undefined
  const d = new Date()
  return DRILLS[(d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % DRILLS.length]
}

function nextExamText(p: ReturnType<typeof useProfile.getState>): string {
  const lv = ([0, 1, 2, 3, 4, 5] as Level[]).find((l) => !p.exams[`exam-n${l}`]?.passedAt)
  if (lv === undefined) return 'Tous les niveaux sont validés. Bravo !'
  const pr = levelProgress(p, lv)
  return `Niveau ${lv} — ${LEVELS[lv].label} · ${pr.done}/${pr.total} leçons lues`
}

function Mini({ icon, color, value, label }: { icon: string; color: string; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/70 py-2">
      <Icon name={icon} size={14} color={color} className="mx-auto" />
      <div className="mt-0.5 font-mono text-[15px] font-semibold text-white">{value}</div>
      <div className="text-[10px] text-ink-400">{label}</div>
    </div>
  )
}

function DayCard({ icon, color, title, text, cta, onClick, disabled }: { icon: string; color: string; title: string; text: string; cta: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${color}18`, color }}><Icon name={icon} size={20} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-white">{title}</div>
        <div className="line-clamp-2 text-[12px] text-ink-400">{text}</div>
      </div>
      <button className="btn-outline !px-2.5 !py-1 text-[12px]" disabled={disabled} onClick={onClick}>{cta}</button>
    </div>
  )
}

// ── Parcours ───────────────────────────────────────────────────────────────

export function PathCard({ path }: { path: LearningPath }) {
  const p = useProfile()
  const pr = pathProgress(p, path)
  const nL = path.steps.filter((s) => s.kind === 'lesson').length
  const nM = path.steps.filter((s) => s.kind === 'mission').length
  return (
    <button onClick={() => useUi.getState().openAcademy({ kind: 'path', id: path.id })} className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/60 p-5 text-left transition hover:-translate-y-0.5 hover:border-ink-500 hover:shadow-panel">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl" style={{ background: `${path.color}22` }} />
      <span className="grid h-12 w-12 place-items-center rounded-2xl border" style={{ borderColor: `${path.color}55`, background: `${path.color}12`, color: path.color }}><Icon name={path.icon} size={22} /></span>
      <div className="mt-3 text-[16px] font-bold text-white group-hover:text-accent">{path.title}</div>
      <div className="text-[12px]" style={{ color: path.color }}>{path.subtitle}</div>
      <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-ink-300">{path.description}</p>
      <div className="mt-auto pt-4">
        <div className="flex gap-3 text-[11px] text-ink-400">
          <span>{nL} leçons</span>
          <span>{nM} missions</span>
          <span>{LEVELS[path.levels[0]].short}{path.levels[1] !== path.levels[0] ? `–${LEVELS[path.levels[1]].short}` : ''}</span>
          <span className="ml-auto font-mono">{pr.done}/{pr.total}</span>
        </div>
        <ProgressBar value={pr.pct} className="mt-1.5" color={path.color} />
      </div>
    </button>
  )
}

export function PathsList() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="label text-accent">Parcours</div>
      <h1 className="mt-1 text-3xl font-bold text-white">Parcours guidés</h1>
      <p className="mt-1 max-w-2xl text-[13.5px] text-ink-300">Chaque parcours enchaîne leçons, exercices générés, missions d'enquête et un examen final. Terminez-le pour obtenir son certificat. Les étapes restent accessibles librement.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PATHS.map((path) => <PathCard key={path.id} path={path} />)}
      </div>
    </div>
  )
}

const STEP_META: Record<PathStep['kind'], { icon: string; label: string }> = {
  lesson: { icon: 'BookOpenText', label: 'Leçon' },
  drill: { icon: 'Dumbbell', label: 'Exercice' },
  mission: { icon: 'Crosshair', label: 'Mission' },
  exam: { icon: 'FileCheck2', label: 'Examen' },
}

export function PathView({ id }: { id: string }) {
  const path = pathById(id)
  const p = useProfile()
  if (!path) return null
  const pr = pathProgress(p, path)
  const best = bestByTemplate(p.cases)
  const cert = p.certificates.find((c) => c.kind === 'path' && c.id === path.id)
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <button className="btn-ghost -ml-2 mb-3 !px-2 text-[12px]" onClick={() => useUi.getState().openAcademy({ kind: 'paths' })}><Icon name="ChevronLeft" size={14} /> Parcours</button>
      <div className="relative overflow-hidden rounded-3xl border border-ink-700 p-6" style={{ background: `radial-gradient(ellipse at 0% 0%, ${path.color}22, transparent 60%), #090d18` }}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border" style={{ borderColor: `${path.color}66`, color: path.color, background: `${path.color}14` }}><Icon name={path.icon} size={30} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-extrabold text-white">{path.title}</h1>
            <div className="text-[13px]" style={{ color: path.color }}>{path.subtitle}</div>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-200">{path.description}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <ProgressBar value={pr.pct} color={path.color} className="!h-2" />
          <span className="whitespace-nowrap font-mono text-[13px] text-white">{pr.done}/{pr.total}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {pr.next !== null ? (
            <button className="btn-primary" onClick={() => goToStep(path.steps[pr.next!], path.id)}><Icon name="Play" size={14} /> {pr.done ? 'Reprendre' : 'Commencer'} : {stepLabel(path.steps[pr.next])}</button>
          ) : (
            <span className="chip bg-emerald-400/15 !py-1.5 text-[12.5px] text-emerald-300"><Icon name="BadgeCheck" size={14} /> Parcours terminé{cert ? ' — certificat obtenu' : ''}</span>
          )}
          <span className="chip bg-ink-800 !py-1.5 text-ink-300"><Icon name="Award" size={12} /> Certificat : {path.certificate}</span>
        </div>
      </div>

      <ol className="relative mt-6 space-y-2">
        <span className="absolute bottom-4 left-[19px] top-4 w-px bg-ink-700" />
        {path.steps.map((s, i) => {
          const done = pr.flags[i]
          const isNext = pr.next === i
          const m = STEP_META[s.kind]
          let sub = ''
          if (s.kind === 'lesson') {
            const l = LESSONS.find((x) => x.id === s.id)
            sub = l ? `${LEVELS[l.level].short} · ${l.minutes} min${isAuthored(l.id) ? '' : ' · version abrégée'}` : ''
          } else if (s.kind === 'drill') sub = `${Math.min(s.target, p.drills[s.id]?.correct ?? 0)}/${s.target} bonnes réponses`
          else if (s.kind === 'mission') sub = `${scenarioById(s.id)?.title ?? s.id} · ${Math.round((best[s.id] ?? 0) * 100)} % (requis ${s.minPct ?? 60} %)`
          else sub = `Seuil de réussite · meilleur score ${p.exams[s.id]?.best ?? 0} %`
          return (
            <li key={i} className="relative">
              <button onClick={() => goToStep(s, path.id)} className={`flex w-full items-center gap-3 rounded-xl border px-2 py-2 text-left transition ${isNext ? 'border-accent/50 bg-accent/[0.06]' : 'border-transparent hover:border-ink-700 hover:bg-ink-900/60'}`}>
                <span className={`z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 ${done ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300' : isNext ? 'border-accent bg-ink-900 text-accent' : 'border-ink-600 bg-ink-900 text-ink-400'}`}>
                  <Icon name={done ? 'Check' : m.icon} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-ink-500">{m.label} {i + 1}</span>
                    {isNext && <span className="chip bg-accent/15 !py-0 text-[10px] text-accent">Prochaine étape</span>}
                  </div>
                  <div className={`truncate text-[14px] font-medium ${done ? 'text-ink-300' : 'text-white'}`}>{s.kind === 'mission' ? scenarioById(s.id)?.title ?? s.id : stepLabel(s)}</div>
                  <div className="truncate text-[11.5px] text-ink-400">{sub}</div>
                </div>
                <Icon name="ChevronRight" size={16} className="text-ink-500" />
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ── Bibliothèque (accès libre) ─────────────────────────────────────────────

export function Library() {
  const p = useProfile()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState<Level | -1>(-1)
  const [track, setTrack] = useState<Track | ''>('')
  const [status, setStatus] = useState<'all' | 'new' | 'started' | 'done'>('all')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return LESSONS.filter((l) => (level === -1 || l.level === level) && (!track || l.track === track) && (status === 'all' || lessonStatus(p, l.id) === status) && (!s || `${l.title} ${l.summary} ${l.keyPoints.join(' ')}`.toLowerCase().includes(s)))
  }, [q, level, track, status, p])
  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="label text-accent">Accès libre</div>
      <h1 className="mt-1 text-3xl font-bold text-white">Bibliothèque</h1>
      <p className="mt-1 text-[13.5px] text-ink-300">Toutes les leçons, sans ordre imposé. Filtrez par niveau, filière ou progression.</p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon name="Search" size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
          <input className="input w-72 !pl-8" placeholder="Rechercher une notion (CoinJoin, réquisition, USDT…)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input !w-auto" value={level} onChange={(e) => setLevel(Number(e.target.value) as Level | -1)}>
          <option value={-1}>Tous niveaux</option>
          {([0, 1, 2, 3, 4, 5] as Level[]).map((lv) => <option key={lv} value={lv}>{LEVELS[lv].short} · {LEVELS[lv].label}</option>)}
        </select>
        <select className="input !w-auto" value={track} onChange={(e) => setTrack(e.target.value as Track | '')}>
          <option value="">Toutes filières</option>
          {(Object.keys(TRACKS) as Track[]).map((t) => <option key={t} value={t}>{TRACKS[t].label}</option>)}
        </select>
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Toutes</option>
          <option value="new">Non commencées</option>
          <option value="started">En cours</option>
          <option value="done">Validées</option>
        </select>
        <span className="ml-auto text-[12px] text-ink-400">{list.length} leçon(s)</span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((l) => {
          const st = lessonStatus(p, l.id)
          const lv = LEVELS[l.level]
          const tr = TRACKS[l.track]
          return (
            <button key={l.id} onClick={() => useUi.getState().openLesson(l.id)} className="group flex flex-col rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/50">
              <div className="flex items-center gap-1.5">
                <span className="chip border" style={{ color: lv.color, borderColor: `${lv.color}55` }}>{lv.short}</span>
                <span className="chip" style={{ color: tr.color, background: `${tr.color}14` }}><Icon name={tr.icon} size={10} /> {tr.label}</span>
                <span className="ml-auto">
                  {st === 'done' ? <Icon name="CircleCheck" size={16} className="text-emerald-400" /> : st === 'started' ? <Icon name="CircleDot" size={16} className="text-accent" /> : <Icon name="Circle" size={16} className="text-ink-600" />}
                </span>
              </div>
              <div className="mt-2 text-[15px] font-semibold leading-snug text-white group-hover:text-accent">{l.title}</div>
              <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-300">{l.summary}</p>
              <div className="mt-auto flex gap-3 pt-3 text-[11px] text-ink-400">
                <span><Icon name="Clock" size={11} className="mr-0.5 inline" />{l.minutes} min</span>
                <span>{l.quiz.length} questions</span>
                <span>{l.flashcards.length} fiches</span>
                {l.blocks.some((b) => b.type === 'widget') && <span className="text-accent"><Icon name="FlaskConical" size={11} className="mr-0.5 inline" />simulateur</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
