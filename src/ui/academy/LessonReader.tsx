import { useEffect, useMemo, useRef, useState } from 'react'
import { CURRICULUM, LEVELS, TRACKS, isAuthored, lessonById, pathById, type Lesson } from '../../academy'
import { scenarioById } from '../../scenarios'
import { useProfile } from '../../store/profile'
import { useUi } from '../../store/ui'
import { pathProgress, stepLabel } from '../../lib/academy'
import { DifficultyBadge, Icon, ProgressBar, tint } from '../common'
import { LaunchModal } from '../pages/Missions'
import { BlockView, headingId } from './Blocks'
import { QuizRunner } from './Quiz'
import { goToStep } from './nav'

export function LessonReader({ id, pathId }: { id: string; pathId?: string }) {
  const l = lessonById(id)
  const scroller = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [active, setActive] = useState<string | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const rec = useProfile((s) => s.lessons[id])
  const profile = useProfile()

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
    useProfile.getState().touchDay()
    // Première ouverture : la leçon est « commencée »
    const p = useProfile.getState()
    if (!p.lessons[id]?.read) useProfile.setState({ lessons: { ...p.lessons, [id]: { ...p.lessons[id], read: true } } })
  }, [id])

  const toc = useMemo(() => (l ? l.blocks.map((b, i) => (b.type === 'heading' ? { i, text: b.text } : null)).filter((x): x is { i: number; text: string } => !!x) : []), [l])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    setProgress(Math.min(1, el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)))
    let cur: string | null = null
    for (const t of toc) {
      const h = document.getElementById(headingId(t.i))
      if (h && h.getBoundingClientRect().top < 160) cur = headingId(t.i)
    }
    setActive(cur)
  }

  if (!l) return <div className="p-10 text-ink-300">Leçon introuvable.</div>
  const lv = LEVELS[l.level]
  const tr = TRACKS[l.track]
  const idx = CURRICULUM.findIndex((c) => c.id === l.id)
  const prev = CURRICULUM[idx - 1]
  const next = CURRICULUM[idx + 1]
  const path = pathId ? pathById(pathId) : undefined
  const prog = path ? pathProgress(profile, path) : null
  const stepIndex = path ? path.steps.findIndex((s) => s.kind === 'lesson' && s.id === l.id) : -1
  const nextStep = path && stepIndex >= 0 ? path.steps[stepIndex + 1] : undefined

  const finish = () => {
    useProfile.getState().completeLesson(l.id)
    useUi.getState().notify(`Leçon validée : ${l.title}`)
  }

  return (
    <div className="relative flex h-full">
      <div className="absolute inset-x-0 top-0 z-20 h-0.5 bg-ink-800">
        <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Sommaire */}
      <aside className="hidden w-[250px] shrink-0 overflow-y-auto border-r border-ink-700 bg-ink-900 p-4 xl:block">
        <button className="btn-ghost -ml-2 mb-3 !px-2 text-meta" onClick={() => useUi.getState().openAcademy(path ? { kind: 'path', id: path.id } : { kind: 'library' })}>
          <Icon name="ChevronLeft" size={14} /> {path ? path.title : 'Bibliothèque'}
        </button>
        <div className="label mb-2">Sommaire</div>
        <nav className="space-y-0.5">
          {toc.map((t) => (
            <a key={t.i} href={`#${headingId(t.i)}`} onClick={(e) => {
              e.preventDefault()
              document.getElementById(headingId(t.i))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }} className={`block rounded-md px-2 py-1.5 text-dense leading-snug transition ${active === headingId(t.i) ? 'bg-accent/10 text-white' : 'text-ink-300 hover:text-white'}`}>
              {t.text}
            </a>
          ))}
          {[['lesson-keypoints', 'À retenir'], ['lesson-quiz', 'Quiz'], ['lesson-cards', 'Fiches de révision']].map(([anchor, label]) => (
            <a key={anchor} href={`#${anchor}`} onClick={(e) => {
              e.preventDefault()
              document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' })
            }} className="block rounded-md px-2 py-1.5 text-dense text-ink-400 hover:text-white">
              {label}
            </a>
          ))}
        </nav>
        {path && prog && (
          <div className="mt-5 rounded-xl border border-ink-700/70 bg-ink-850/60 p-3">
            <div className="text-micro text-ink-400">Parcours</div>
            <div className="text-dense font-semibold text-white">{path.title}</div>
            <ProgressBar value={prog.pct} className="mt-2" color={path.color} />
            <div className="mt-1 text-micro text-ink-400">{prog.done}/{prog.total} étapes</div>
          </div>
        )}
      </aside>

      <div ref={scroller} onScroll={onScroll} className="min-w-0 flex-1 overflow-y-auto">
        <article className="mx-auto max-w-[760px] px-6 pb-24 pt-10 md:px-10">
          {/* En-tête */}
          <div className="flex flex-wrap items-center gap-2 text-meta">
            <span className="chip border" style={{ color: tint(lv.color), borderColor: `${lv.color}55`, background: `${lv.color}12` }}>{lv.short} · {lv.label}</span>
            <span className="chip" style={{ color: tint(tr.color), background: `${tr.color}16` }}><Icon name={tr.icon} size={11} /> {tr.label}</span>
            <span className="flex items-center gap-1 text-ink-400"><Icon name="Clock" size={12} /> {l.minutes} min</span>
            {rec?.done && <span className="chip bg-emerald-400/10 text-emerald-300"><Icon name="CircleCheck" size={11} /> Validée</span>}
            {!isAuthored(l.id) && <span className="chip bg-ink-800 text-ink-400" title="Leçon en cours de réécriture complète">Version abrégée</span>}
          </div>
          <h1 className="mt-4 font-serif text-[40px] font-semibold leading-[1.15] tracking-tight text-white">{l.title}</h1>
          <p className="mt-4 font-serif text-[19px] leading-[1.65] text-ink-200">{l.summary}</p>

          {(l.objectives.length > 0 || (l.prerequisites?.length ?? 0) > 0) && (
            <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
              {l.objectives.length > 0 && (
                <div className="rounded-xl border border-accent/25 bg-accent/[0.05] p-4">
                  <div className="label mb-2 !text-accent">À la fin de cette leçon, vous saurez</div>
                  <ul className="space-y-1.5">
                    {l.objectives.map((o, i) => (
                      <li key={i} className="flex gap-2 text-body text-ink-100"><Icon name="Target" size={14} className="mt-0.5 shrink-0 text-accent" /> {o}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(l.prerequisites?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-ink-700/70 bg-ink-900/50 p-4 md:w-60">
                  <div className="label mb-2">Prérequis</div>
                  <div className="space-y-1">
                    {l.prerequisites!.map((p) => {
                      const pl = lessonById(p)
                      const done = !!profile.lessons[p]?.done
                      return (
                        <button key={p} className="flex w-full items-center gap-1.5 text-left text-dense text-ink-200 hover:text-white" onClick={() => useUi.getState().openLesson(p)}>
                          <Icon name={done ? 'CircleCheck' : 'Circle'} size={12} className={done ? 'text-emerald-400' : 'text-ink-500'} />
                          <span className="truncate">{pl?.title ?? p}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contenu */}
          <div className="mt-8 space-y-5">
            {l.blocks.map((b, i) => <BlockView key={i} b={b} lessonId={l.id} index={i} />)}
          </div>

          {/* À retenir */}
          <section id="lesson-keypoints" className="mt-10 scroll-mt-20 rounded-xl border border-accent/25 bg-accent/[0.06] p-5">
            <div className="mb-3 flex items-center gap-2 text-title font-semibold text-white"><Icon name="Sparkles" size={16} className="text-accent" /> À retenir</div>
            <ul className="space-y-2">
              {l.keyPoints.map((k, i) => <li key={i} className="flex gap-2.5 text-body text-ink-100"><Icon name="Check" size={16} className="mt-0.5 shrink-0 text-accent" /> {k}</li>)}
            </ul>
          </section>

          {/* Quiz */}
          <section id="lesson-quiz" className="mt-10 scroll-mt-20">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="BrainCircuit" size={19} className="text-violet-300" />
              <h2 className="text-section font-bold text-white">Quiz de validation</h2>
              <span className="text-meta text-ink-400">60 % pour valider la leçon</span>
            </div>
            {l.quiz.length ? (
              <QuizRunner key={l.id} questions={l.quiz} best={rec?.quizBest} onDone={(score, max) => {
                useProfile.getState().markLesson(l.id, { score, max })
                if (score / max >= 0.6) finish()
              }} />
            ) : (
              <button className="btn-primary w-full" onClick={finish}>Marquer la leçon comme terminée</button>
            )}
          </section>

          {/* Fiches */}
          <section id="lesson-cards" className="mt-10 scroll-mt-20">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="Layers" size={18} className="text-amber-300" />
              <h2 className="text-section font-bold text-white">Fiches de révision</h2>
              <span className="text-meta text-ink-400">{l.flashcards.length} fiches · répétition espacée</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {l.flashcards.slice(0, 3).map((c, i) => <FlipCard key={i} front={c.front} back={c.back} />)}
            </div>
            <button className="btn-outline mt-3" onClick={() => useUi.getState().openAcademy({ kind: 'cards', lessonId: l.id })}>
              <Icon name="Layers" size={14} /> Réviser les {l.flashcards.length} fiches de cette leçon
            </button>
          </section>

          {/* Pratique */}
          {(l.practice?.length ?? 0) > 0 && (
            <section className="mt-10">
              <div className="label mb-2">Mettre en pratique</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {l.practice!.map((sid) => {
                  const s = scenarioById(sid)
                  if (!s) return null
                  return (
                    <button key={sid} onClick={() => setPick(sid)} className="flex items-center gap-3 rounded-xl border border-ink-700/70 bg-ink-900/60 p-3 text-left transition hover:border-accent/50">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Icon name="Crosshair" size={17} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-body font-medium text-white">{s.title}</div>
                        <DifficultyBadge d={s.difficulty} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Suite */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-ink-700/60 pt-6">
            {path && nextStep ? (
              <>
                <button className="btn-ghost" onClick={() => useUi.getState().openAcademy({ kind: 'path', id: path.id })}><Icon name="ChevronLeft" size={15} /> Retour au parcours</button>
                <button className="btn-primary" onClick={() => {
                  if (!rec?.done) finish()
                  goToStep(nextStep, path.id)
                }}>
                  Étape suivante : {stepLabel(nextStep)} <Icon name="ChevronRight" size={15} />
                </button>
              </>
            ) : (
              <>
                {prev ? <button className="btn-ghost" onClick={() => useUi.getState().openLesson(prev.id)}><Icon name="ChevronLeft" size={15} /> {prev.title}</button> : <span />}
                {next && <button className="btn-outline" onClick={() => useUi.getState().openLesson(next.id)}>{next.title} <Icon name="ChevronRight" size={15} /></button>}
              </>
            )}
          </div>
        </article>
      </div>
      <LaunchModal s={pick ? scenarioById(pick) ?? null : null} onClose={() => setPick(null)} />
    </div>
  )
}

export function FlipCard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <button onClick={() => setFlipped((f) => !f)} className="group h-36 [perspective:900px]" title="Cliquer pour retourner">
      <div className={`relative h-full w-full rounded-xl transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
        <div className="absolute inset-0 flex flex-col justify-center rounded-xl border border-ink-700 bg-ink-900 p-3.5 text-left [backface-visibility:hidden]">
          <div className="text-micro uppercase tracking-wider text-amber-300">Question</div>
          <div className="mt-1 line-clamp-4 text-dense font-medium text-white">{front}</div>
        </div>
        <div className="absolute inset-0 flex flex-col justify-center rounded-xl border border-amber-400/40 bg-amber-400/[0.06] p-3.5 text-left [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="text-micro uppercase tracking-wider text-amber-300">Réponse</div>
          <div className="mt-1 line-clamp-5 text-dense text-ink-100">{back}</div>
        </div>
      </div>
    </button>
  )
}

export type { Lesson }
