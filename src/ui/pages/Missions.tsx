import { useEffect, useMemo, useState } from 'react'
import { CHAINS, type ChainId } from '../../engine/chains'
import { hashSeed, randomSeed } from '../../engine/rng'
import { GENERATED_SCENARIOS, SCENARIOS } from '../../scenarios'
import { DIFFICULTY, SKILLS, type Difficulty, type ScenarioTemplate } from '../../scenarios/types'
import { useGame, loadSavedCase, type Coverage, type Mode } from '../../store/game'
import { scenarioById } from '../../scenarios'
import { useUi } from '../../store/ui'
import { bestByTemplate, useProfile } from '../../store/profile'
import { ChainBadge, DifficultyBadge, Icon, Modal, ProgressBar } from '../common'
import { LESSONS } from '../../academy'
import { missionPrereqs } from '../../academy/prereqs'
import type { NoiseLevel } from '../../engine/noise'
import { FlowGlyph } from '../FlowGlyph'
import { CHAIN_LOGOS } from '../logos'

export function launchCase(templateId: string, seed: number, mode: Mode = 'standard', coverage: Coverage = 'full', live = false, noise: NoiseLevel = 'normal') {
  const g = useGame.getState()
  const saved = loadSavedCase()
  const running = (g.inst && !g.score) || saved
  if (running) {
    const title = g.template?.title ?? (saved ? scenarioById(saved.templateId)?.title : undefined) ?? 'en cours'
    if (!confirm(`Une enquête est en cours (« ${title} »). L'abandonner pour ouvrir ce nouveau dossier ?`)) return
  }
  g.start(templateId, seed, { mode, coverage, live, noise })
  useUi.getState().set({ page: 'workspace', briefingOpen: true, timeRange: null, leftOpen: true, leftTab: useGame.getState().template?.guided ? 'objectives' : 'evidence' })
}

export function dailyChallenge(): { template: ScenarioTemplate; seed: number } | null {
  if (!SCENARIOS.length) return null
  const d = new Date()
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  const h = hashSeed(key)
  return { template: SCENARIOS[h % SCENARIOS.length], seed: hashSeed(`seed-${key}`) }
}

type Status = 'all' | 'todo' | 'running' | 'done'

/** Affaire en cours (sauvegardée ou ouverte), pour marquer sa carte. */
function runningCase(): { id: string; done: number; total: number } | null {
  const g = useGame.getState()
  if (g.inst && g.template && !g.score) {
    const total = g.inst.objectives.length
    const done = g.inst.objectives.filter((o) => g.answers[o.id] !== undefined).length
    return { id: g.template.id, done, total }
  }
  const saved = loadSavedCase()
  return saved ? { id: saved.templateId, done: 0, total: 0 } : null
}

export function Missions() {
  const cases = useProfile((s) => s.cases)
  const best = useMemo(() => bestByTemplate(cases), [cases])
  const [diff, setDiff] = useState<Difficulty | 0>(0)
  const [chain, setChain] = useState<ChainId | ''>('')
  const [status, setStatus] = useState<Status>('all')
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<ScenarioTemplate | null>(null)
  const running = useMemo(runningCase, [])
  const daily = useMemo(dailyChallenge, [])

  // Mission demandée depuis la recherche globale : on ouvre sa fiche de lancement.
  useEffect(() => {
    const it = useUi.getState().intent
    if (it?.kind !== 'mission') return
    useUi.getState().set({ intent: null })
    const s = scenarioById(it.id)
    if (s) setPick(s)
  }, [])

  const chains = [...new Set(SCENARIOS.flatMap((s) => s.chains))]
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const list = SCENARIOS.filter((s) => {
    if (diff && s.difficulty !== diff) return false
    if (chain && !s.chains.includes(chain)) return false
    if (status === 'done' && best[s.id] === undefined) return false
    if (status === 'todo' && (best[s.id] !== undefined || running?.id === s.id)) return false
    if (status === 'running' && running?.id !== s.id) return false
    return !q || norm(`${s.title} ${s.tagline} ${s.skills.map((k) => SKILLS[k].label).join(' ')}`).includes(norm(q))
  })
  const groups = ([1, 2, 3, 4] as Difficulty[]).map((d) => ({ d, items: list.filter((s) => s.difficulty === d) })).filter((g) => g.items.length)
  const solved = SCENARIOS.filter((s) => best[s.id] !== undefined).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-10 py-10">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-dense text-ink-400">Enquêter</div>
            <h1 className="mt-1 text-page font-semibold tracking-tight text-white">Missions</h1>
            <p className="mt-1.5 text-body text-ink-300">
              {SCENARIOS.length} affaires générées à partir d'une graine : la même graine donne la même affaire. <span className="text-ink-400">{solved} résolue{solved > 1 ? 's' : ''}.</span>
            </p>
          </div>
          <button className="btn-outline ml-auto !h-[38px]" onClick={() => {
            const t = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)]
            if (t) setPick(t)
          }}>
            <Icon name="Dices" size={15} /> Affaire au hasard
          </button>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <label className="relative min-w-[240px] flex-1">
            <span className="sr-only">Rechercher une mission</span>
            <Icon name="Search" size={15} className="absolute left-3 top-[11px] text-ink-400" />
            <input className="input !h-[38px] !pl-9" placeholder="Compétence, typologie, chaîne…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="seg" role="group" aria-label="Niveau">
            <button className={`seg-item ${diff === 0 ? 'seg-item-active' : ''}`} aria-pressed={diff === 0} onClick={() => setDiff(0)}>Tous</button>
            {([1, 2, 3, 4] as Difficulty[]).map((d) => (
              <button key={d} className={`seg-item ${diff === d ? 'seg-item-active' : ''}`} aria-pressed={diff === d} onClick={() => setDiff(d)}>{DIFFICULTY[d].label}</button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">Statut</span>
            <select className="input !h-[38px] cursor-pointer !pr-8 appearance-none" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="all">Statut : toutes</option>
              <option value="todo">À faire</option>
              <option value="running">En cours</option>
              <option value="done">Résolues</option>
            </select>
            <Icon name="ChevronDown" size={14} className="pointer-events-none absolute right-2.5 top-3 text-ink-400" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Chaîne">
          <button className={`chip h-7 border !px-2.5 !text-meta ${chain === '' ? 'border-ink-400 bg-ink-700 text-white' : 'border-ink-700 text-ink-300 hover:text-white'}`} aria-pressed={chain === ''} onClick={() => setChain('')}>Toutes les chaînes</button>
          {chains.map((c) => (
            <button key={c} className={`chip h-7 gap-1.5 border !px-2 !text-meta ${chain === c ? 'border-ink-400 bg-ink-700 text-white' : 'border-ink-700 text-ink-300 hover:text-white'}`} aria-pressed={chain === c} onClick={() => setChain(chain === c ? '' : c)} title={CHAINS[c].name}>
              <img src={CHAIN_LOGOS[c]} alt="" width={14} height={14} className="rounded-full" /> {CHAINS[c].short}
            </button>
          ))}
        </div>

        <GeneratedCases best={best} onOpen={setPick} />

        {groups.map((g) => (
          <section key={g.d} className="mt-10">
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-title font-semibold text-white">{DIFFICULTY[g.d].label}</h2>
              <span className="text-dense text-ink-400">
                {g.items.length} mission{g.items.length > 1 ? 's' : ''}
                {g.items.some((s) => s.guided) && ` · dont ${g.items.filter((s) => s.guided).length} tutoriels guidés`} · jusqu'à {DIFFICULTY[g.d].xp} XP
              </span>
            </div>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
              {g.items.map((s) => (
                <MissionCard key={s.id} s={s} best={best[s.id]} running={running?.id === s.id ? running : undefined} daily={daily?.template.id === s.id} onOpen={() => setPick(s)} />
              ))}
            </div>
          </section>
        ))}
        {!groups.length && <div className="mt-16 text-center text-body text-ink-400">Aucune mission ne correspond aux filtres.</div>}
      </div>
      <LaunchModal s={pick} onClose={() => setPick(null)} />
    </div>
  )
}

/** Accès aux affaires composées par le générateur : une affaire inédite par graine. */
function GeneratedCases({ best, onOpen }: { best: Record<string, number>; onOpen: (s: ScenarioTemplate) => void }) {
  const today = (() => {
    const d = new Date()
    return hashSeed(`gen-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)
  })()
  const [daily, setDaily] = useState<{ s: ScenarioTemplate; seed: number } | null>(null)
  if (!GENERATED_SCENARIOS.length) return null
  return (
    <section className="card mt-8 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-ink-800 text-ink-100"><Icon name="Sparkles" size={18} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-title font-semibold text-white">Affaires générées</h2>
          <p className="mt-0.5 max-w-3xl text-dense leading-relaxed text-ink-300">Une affaire inédite à chaque partie : typologie, chaînes, techniques de blanchiment enchaînées, objectifs et débrief. Pour s'entraîner sans fin.</p>
        </div>
        <button className="btn-outline" onClick={() => setDaily({ s: GENERATED_SCENARIOS[1] ?? GENERATED_SCENARIOS[0], seed: today })}>
          <Icon name="CalendarDays" size={14} /> Affaire générée du jour
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {GENERATED_SCENARIOS.map((s) => (
          <button key={s.id} className="group rounded-lg border border-ink-700 bg-ink-900 p-3.5 text-left transition-colors hover:border-ink-500" onClick={() => onOpen(s)}>
            <div className="flex items-center gap-2">
              <DifficultyBadge d={s.difficulty} />
              <span className="font-mono text-meta text-ink-400">~{s.estMinutes} min</span>
              {best[s.id] !== undefined && <span className="ml-auto font-mono text-meta text-emerald-300">{Math.round(best[s.id] * 100)} %</span>}
            </div>
            <div className="mt-2 text-body font-semibold text-white">{s.title.replace('Affaire générée — ', '')}</div>
            <div className="mt-0.5 text-meta leading-snug text-ink-300">{s.difficulty === 2 ? 'Rebonds, peel chains, regroupements, swaps : une seule chaîne.' : s.difficulty === 3 ? 'Plus d\'étapes, agrégateurs, WETH, et un changement de chaîne (bridge ou échangeur).' : 'Jusqu\'à six techniques, deux changements de chaîne, mixeur, prêt avec garantie.'}</div>
          </button>
        ))}
      </div>
      <LaunchModal s={daily?.s ?? null} seed={daily?.seed} onClose={() => setDaily(null)} />
    </section>
  )
}

export function MissionCard({ s, best, onOpen, running, daily }: { s: ScenarioTemplate; best?: number; onOpen: () => void; running?: { done: number; total: number }; daily?: boolean }) {
  const lessons = useProfile((p) => p.lessons)
  const unread = missionPrereqs(s.id).filter((id) => !lessons[id]?.read).length
  return (
    <button onClick={onOpen} className={`group flex flex-col overflow-hidden rounded-xl border bg-ink-850 text-left transition-colors hover:border-ink-500 ${running ? 'border-accent/50' : 'border-ink-700'}`}>
      <FlowGlyph s={s} className="border-b border-ink-700" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2 text-meta text-ink-300">
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {s.chains.map((c) => CHAINS[c].name).join(' · ')}
            {s.guided && <span className="text-ink-400">· guidée</span>}
          </span>
          <span className="shrink-0 font-mono">{s.estMinutes} min</span>
        </div>
        <h3 className="text-title font-semibold leading-snug text-white">{s.title}</h3>
        <p className="line-clamp-2 text-dense leading-relaxed text-ink-300">{s.tagline}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {running ? (
            <>
              <span className="chip h-6 bg-accent/15 !px-2 !text-meta text-accent">En cours{running.total ? ` · ${running.done} / ${running.total}` : ''}</span>
              {running.total > 0 && <ProgressBar value={running.done / running.total} className="!w-auto flex-1" />}
            </>
          ) : best !== undefined ? (
            <span className={`chip h-6 !px-2 !text-meta ${best >= 0.8 ? 'bg-emerald-400/15 text-emerald-300' : best >= 0.5 ? 'bg-amber-400/15 text-amber-300' : 'bg-rose-400/15 text-rose-300'}`}>
              <Icon name="Check" size={12} /> Résolue · {Math.round(best * 100)} %
            </span>
          ) : (
            <span className="chip h-6 bg-ink-800 !px-2 !text-meta text-ink-300">Non commencée</span>
          )}
          {daily && <span className="chip h-6 border border-amber-400/40 !px-2 !text-meta text-amber-300">Défi du jour</span>}
          {!running && best === undefined && unread > 0 && (
            <span className="ml-auto flex items-center gap-1 text-meta text-ink-400" title="Leçons prérequises pas encore lues">
              <Icon name="BookOpen" size={13} /> {unread} à lire avant
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export function LaunchModal(props: { s: ScenarioTemplate | null; onClose: () => void; seed?: number }) {
  // Options remises à zéro à chaque mission ouverte
  return <LaunchModalInner key={`${props.s?.id ?? 'none'}-${props.seed ?? ''}`} {...props} />
}

function LaunchModalInner({ s, onClose, seed: fixedSeed }: { s: ScenarioTemplate | null; onClose: () => void; seed?: number }) {
  const [mode, setMode] = useState<Mode>('standard')
  const [coverage, setCoverage] = useState<Coverage>('full')
  const [timing, setTiming] = useState<'past' | 'live'>('past')
  const [noise, setNoise] = useState<NoiseLevel>('normal')
  const [seedText, setSeedText] = useState('')
  if (!s) return null
  const byId = (id: string) => LESSONS.find((l) => l.id === id)
  const prereqIds = missionPrereqs(s.id)
  const before = prereqIds.map(byId).filter((l) => !!l)
  const further = (s.lessons ?? []).filter((id) => !prereqIds.includes(id)).map(byId).filter((l) => !!l)
  const lessonsDone = useProfile.getState().lessons
  const unread = before.filter((l) => !lessonsDone[l.id]?.read).length
  const lessonChip = (l: NonNullable<ReturnType<typeof byId>>) => (
    <button key={l.id} className="chip h-7 gap-1.5 border border-ink-600 !px-2 !text-meta text-ink-100 hover:border-ink-400" onClick={() => {
      onClose()
      useUi.getState().openLesson(l.id)
    }}>
      <Icon name={lessonsDone[l.id]?.read ? 'CircleCheck' : 'BookOpen'} size={13} className={lessonsDone[l.id]?.read ? 'text-emerald-400' : 'text-ink-300'} /> {l.title}
    </button>
  )
  return (
    <Modal open={!!s} onClose={onClose} title={s.title} icon="Crosshair" width="max-w-[720px]">
      <div className="-mx-5 -mt-5 mb-5 border-b border-ink-700">
        <FlowGlyph s={s} className="!h-[132px]" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <DifficultyBadge d={s.difficulty} />
        {s.chains.map((c) => <ChainBadge key={c} chain={c} />)}
        <span className="chip border border-ink-600 text-ink-100"><Icon name="Clock" size={12} /> ~{s.estMinutes} min</span>
        {s.guided && <span className="chip bg-accent/15 text-accent"><Icon name="Compass" size={12} /> Mission guidée · indices gratuits</span>}
      </div>
      <p className="mt-4 text-body leading-relaxed text-ink-200">{s.description}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {s.skills.map((k) => <span key={k} className="chip bg-ink-800 text-ink-200">{SKILLS[k].label}</span>)}
      </div>
      {(before.length > 0 || further.length > 0) && (
        <div className="mt-5 space-y-4 rounded-lg border border-ink-700 bg-ink-900 p-4">
          {before.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="label">À lire avant</span>
                {unread > 0
                  ? <span className="text-meta text-amber-300">{unread === 1 ? '1 leçon pas encore lue' : `${unread} leçons pas encore lues`}</span>
                  : <span className="text-meta text-emerald-300">prérequis lus</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">{before.map(lessonChip)}</div>
            </div>
          )}
          {further.length > 0 && (
            <div>
              <div className="label mb-2">Pour aller plus loin</div>
              <div className="flex flex-wrap gap-1.5">{further.map(lessonChip)}</div>
            </div>
          )}
        </div>
      )}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <OptionGroup label="Mode" value={mode} onChange={setMode} options={[
          { v: 'standard', t: 'Entraînement', d: 'Indices disponibles' },
          { v: 'examen', t: 'Examen', d: 'Sans indice · XP ×1,5' },
        ]} />
        <OptionGroup label="Base d'attribution" value={coverage} onChange={setCoverage} options={[
          { v: 'full', t: 'Complète', d: 'Toutes les étiquettes connues' },
          { v: 'partial', t: 'Partielle', d: '60 % des dépôts non étiquetés · XP ×1,25' },
        ]} />
        <OptionGroup label="Déroulement" value={timing} onChange={setTiming} options={[
          { v: 'past', t: 'Rétrospectif', d: 'Toute l\'histoire est déjà sur la chaîne' },
          { v: 'live', t: 'Temps réel', d: 'Horloge simulée : les fonds bougent pendant l\'enquête' },
        ]} />
        <OptionGroup label="Densité du graphe" value={noise} onChange={setNoise} options={[
          { v: 'normal', t: 'Normale', d: 'L\'affaire telle qu\'écrite' },
          { v: 'dense', t: 'Dense', d: 'Plus de clients et de leurres autour des services' },
          { v: 'extreme', t: 'Extrême', d: 'Activité massive : filtrer et corréler' },
        ]} />
      </div>
      {fixedSeed === undefined ? (
        <label className="mt-4 block">
          <span className="label">Graine (optionnel)</span>
          <input className="input mt-1.5 font-mono" inputMode="numeric" placeholder="Aléatoire — saisissez un nombre pour rejouer la même affaire qu'un collègue" value={seedText} onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, ''))} />
        </label>
      ) : (
        <div className="mt-4 text-meta text-ink-300">Graine imposée : <span className="font-mono text-ink-100">{fixedSeed}</span></div>
      )}
      <button className="btn-primary mt-5 h-11 w-full text-body font-semibold" onClick={() => {
        const seed = fixedSeed ?? (seedText ? Number(seedText) : randomSeed())
        onClose()
        launchCase(s.id, seed, mode, coverage, timing === 'live', noise)
      }}>
        <Icon name="FolderOpen" size={16} /> Ouvrir le dossier
      </button>
    </Modal>
  )
}

function OptionGroup<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { v: T; t: string; d: string }[] }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <div className="label mb-1.5">{label}</div>
      <div className={`grid gap-1.5 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {options.map((o) => (
          <button key={o.v} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} className={`rounded-lg border p-2.5 text-left transition-colors ${value === o.v ? 'border-accent bg-accent/10' : 'border-ink-700 hover:border-ink-500'}`}>
            <div className="text-dense font-semibold text-white">{o.t}</div>
            <div className="mt-0.5 text-micro leading-snug text-ink-300">{o.d}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export { ProgressBar }
