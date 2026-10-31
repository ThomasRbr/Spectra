import { useEffect, useMemo, useState } from 'react'
import { GLOSSARY } from '../../academy/glossary'
import { useProfile, rankOf } from '../../store/profile'
import { useUi } from '../../store/ui'
import { DIFFICULTY, SKILLS, type SkillId } from '../../scenarios/types'
import { Empty, Icon, ProgressBar, fmtDuration } from '../common'
import { scenarioById } from '../../scenarios'
import { GRADE_COLOR } from '../../lib/scoring'
import { Radar, skillMastery } from './Dashboard'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Glossary() {
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState<string | null>(null)

  // Terme demandé depuis la recherche globale : on le met en évidence.
  useEffect(() => {
    const it = useUi.getState().intent
    if (it?.kind !== 'glossary') return
    useUi.getState().set({ intent: null })
    setFocus(it.term)
    requestAnimationFrame(() => document.getElementById(`gl-${it.term}`)?.scrollIntoView({ block: 'center' }))
  }, [])

  const list = useMemo(() => GLOSSARY.filter((g) => !q || norm(`${g.term} ${g.def}`).includes(norm(q))), [q])
  const letterOf = (t: string) => norm(t[0]).toUpperCase()
  const letters = [...new Set(list.map((g) => letterOf(g.term)))]

  return (
    <div id="glossary-scroll" className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-10 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-dense text-ink-400">Apprendre</div>
            <h1 className="mt-1 text-page font-semibold tracking-tight text-white">Glossaire</h1>
            <p className="mt-1.5 text-body text-ink-300">{GLOSSARY.length} termes, du vocabulaire de base aux notions d'enquête.</p>
          </div>
          <label className="relative w-full max-w-sm">
            <span className="sr-only">Rechercher un terme</span>
            <Icon name="Search" size={15} className="absolute left-3 top-3 text-ink-400" />
            <input className="input !h-10 !pl-9" placeholder="Rechercher un terme ou une définition…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>

        <div className="mt-8 flex gap-10">
          <nav aria-label="Lettres" className="sticky top-0 hidden h-fit flex-col gap-0.5 md:flex">
            {letters.map((L) => (
              <button key={L} className="h-7 w-7 rounded-md font-mono text-meta text-ink-300 hover:bg-ink-800 hover:text-white" onClick={() => document.getElementById(`gl-letter-${L}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
                {L}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1">
            {!list.length && <Empty icon="BookA" title={GLOSSARY.length ? `Aucun terme pour « ${q} »` : 'Glossaire en cours de rédaction'} />}
            {letters.map((L) => (
              <section key={L} id={`gl-letter-${L}`} className="mb-8 scroll-mt-6">
                <h2 className="mb-2 border-b border-ink-700 pb-2 font-serif text-section font-semibold text-white">{L}</h2>
                <dl>
                  {list.filter((g) => letterOf(g.term) === L).map((g) => (
                    <div key={g.term} id={`gl-${g.term}`} className={`grid gap-1 rounded-lg px-3 py-3 md:grid-cols-[220px_1fr] md:gap-6 ${focus === g.term ? 'bg-accent/10 ring-1 ring-accent/40' : ''}`}>
                      <dt className="text-body font-semibold text-white">{g.term}</dt>
                      <dd className="text-body leading-relaxed text-ink-200">{g.def}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Profile() {
  const p = useProfile()
  const readingTheme = useUi((s) => s.readingTheme)
  const rank = rankOf(p.xp)
  const mastery = skillMastery(p.cases)
  const skillStats = (Object.keys(SKILLS) as SkillId[]).map((k) => {
    const cs = p.cases.filter((c) => c.skills.includes(k))
    return { k, n: cs.length, avg: cs.length ? cs.reduce((s, c) => s + c.score / c.max, 0) / cs.length : 0 }
  })
  const worked = skillStats.filter((s) => s.n).sort((a, b) => b.avg - a.avg)
  const untouched = skillStats.filter((s) => !s.n)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-10 py-10">
        <div className="text-dense text-ink-400">Profil</div>
        <h1 className="mt-1 text-page font-semibold tracking-tight text-white">Dossier de l'enquêteur</h1>

        <div className="mt-8 grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-4">
            <section className="card p-5">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-ink-700 text-section font-semibold text-white">{(p.name.trim()[0] ?? '?').toUpperCase()}</span>
                <div>
                  <div className="text-title font-semibold text-white">{rank.name}</div>
                  <div className="text-meta text-ink-300">Niveau {rank.level} · {p.xp.toLocaleString('fr-FR')} XP</div>
                </div>
              </div>
              <ProgressBar value={rank.progress} className="mt-4" color="rgb(var(--ink-strong))" />
              <label className="mt-5 block"><span className="label">Nom affiché</span><input className="input mt-1.5" value={p.name} onChange={(e) => p.setIdentity(e.target.value, p.unit)} /></label>
              <label className="mt-3 block"><span className="label">Unité</span><input className="input mt-1.5" value={p.unit} onChange={(e) => p.setIdentity(p.name, e.target.value)} /></label>
            </section>

            <section className="card p-5">
              <div className="label">Pages de lecture</div>
              <p className="mt-1 text-meta leading-relaxed text-ink-300">Académie, Terrain et Glossaire. Le papier repose les yeux sur les lectures longues ; l'encre garde tout en sombre.</p>
              <div className="seg mt-3" role="group" aria-label="Thème des pages de lecture">
                <button className={`seg-item flex-1 ${readingTheme === 'paper' ? 'seg-item-active' : ''}`} aria-pressed={readingTheme === 'paper'} onClick={() => useUi.getState().setReadingTheme('paper')}>
                  <Icon name="Sun" size={14} /> Papier
                </button>
                <button className={`seg-item flex-1 ${readingTheme === 'ink' ? 'seg-item-active' : ''}`} aria-pressed={readingTheme === 'ink'} onClick={() => useUi.getState().setReadingTheme('ink')}>
                  <Icon name="Moon" size={14} /> Encre
                </button>
              </div>
            </section>

            <section className="card p-5">
              <div className="label">Domaines</div>
              <Radar values={mastery} />
            </section>

            <button className="btn w-full border border-rose-500/40 text-rose-300 hover:bg-rose-500/10" onClick={() => confirm('Effacer toute la progression (affaires, XP, leçons) ?') && p.reset()}>
              <Icon name="Trash2" size={14} /> Réinitialiser la progression
            </button>
          </div>

          <div className="space-y-6">
            <section className="card p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-title font-semibold text-white">Compétences</h2>
                {untouched.length > 0 && <span className="text-meta text-ink-400">{untouched.length} pas encore travaillée{untouched.length > 1 ? 's' : ''}</span>}
              </div>
              {!worked.length && <p className="mt-3 text-dense text-ink-300">Terminez une première affaire pour voir vos compétences se dessiner.</p>}
              <div className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
                {worked.map((s) => (
                  <div key={s.k}>
                    <div className="flex justify-between text-dense"><span className="text-ink-100">{SKILLS[s.k].label}</span><span className="font-mono text-ink-300">{Math.round(s.avg * 100)} % · {s.n}</span></div>
                    <ProgressBar value={s.avg} className="mt-1.5" color={s.avg >= 0.8 ? 'rgb(var(--emerald-400))' : s.avg >= 0.5 ? 'rgb(var(--amber-400))' : 'rgb(var(--accent))'} />
                  </div>
                ))}
              </div>
              {untouched.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5 border-t border-ink-700 pt-4">
                  {untouched.map((s) => <span key={s.k} className="chip bg-ink-800 text-ink-300">{SKILLS[s.k].label}</span>)}
                </div>
              )}
            </section>

            <section className="card overflow-hidden">
              <h2 className="px-5 pt-4 text-title font-semibold text-white">Historique <span className="font-normal text-ink-400">· {p.cases.length}</span></h2>
              <div className="mt-3 max-h-[480px] overflow-y-auto">
                {p.cases.length === 0 && <div className="p-6 text-center text-dense text-ink-400">Aucune affaire terminée.</div>}
                {p.cases.map((c, i) => {
                  const t = scenarioById(c.templateId)
                  const gc = GRADE_COLOR[c.grade as 'S']
                  return (
                    <div key={i} className="flex items-center gap-3 border-t border-ink-700 px-5 py-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg text-dense font-bold" style={{ color: gc, background: `${gc}1f` }}>{c.grade}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-dense font-medium text-white">{t?.title ?? c.templateId}</div>
                        <div className="text-meta text-ink-400">{new Date(c.date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })} · {fmtDuration(c.durationSec)} · graine <span className="font-mono">{c.seed}</span></div>
                      </div>
                      <span className="text-meta text-ink-300">{DIFFICULTY[c.difficulty].label}</span>
                      <span className="w-16 text-right font-mono text-dense text-white">{c.score}/{c.max}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
