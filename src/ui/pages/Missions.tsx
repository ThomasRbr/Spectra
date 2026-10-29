import { useMemo, useState } from 'react'
import { CHAINS, type ChainId } from '../../engine/chains'
import { hashSeed, randomSeed } from '../../engine/rng'
import { SCENARIOS } from '../../scenarios'
import { DIFFICULTY, SKILLS, type Difficulty, type ScenarioTemplate } from '../../scenarios/types'
import { useGame, loadSavedCase, type Coverage, type Mode } from '../../store/game'
import { scenarioById } from '../../scenarios'
import { useUi } from '../../store/ui'
import { bestByTemplate, useProfile } from '../../store/profile'
import { ChainBadge, DifficultyBadge, Icon, Modal, ProgressBar } from '../common'
import { LESSONS, TRACKS } from '../../academy'

export function launchCase(templateId: string, seed: number, mode: Mode = 'standard', coverage: Coverage = 'full') {
  const g = useGame.getState()
  const saved = loadSavedCase()
  const running = (g.inst && !g.score) || saved
  if (running) {
    const title = g.template?.title ?? (saved ? scenarioById(saved.templateId)?.title : undefined) ?? 'en cours'
    if (!confirm(`Une enquête est en cours (« ${title} »). L'abandonner pour ouvrir ce nouveau dossier ?`)) return
  }
  g.start(templateId, seed, { mode, coverage })
  useUi.getState().set({ page: 'workspace', briefingOpen: true, timeRange: null, leftTab: 'evidence' })
}

export function dailyChallenge(): { template: ScenarioTemplate; seed: number } | null {
  if (!SCENARIOS.length) return null
  const d = new Date()
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  const h = hashSeed(key)
  return { template: SCENARIOS[h % SCENARIOS.length], seed: hashSeed(`seed-${key}`) }
}

export function Missions() {
  const cases = useProfile((s) => s.cases)
  const best = useMemo(() => bestByTemplate(cases), [cases])
  const [diff, setDiff] = useState<Difficulty | 0>(0)
  const [chain, setChain] = useState<ChainId | ''>('')
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<ScenarioTemplate | null>(null)
  const chains = [...new Set(SCENARIOS.flatMap((s) => s.chains))]
  const list = SCENARIOS.filter((s) => (!diff || s.difficulty === diff) && (!chain || s.chains.includes(chain)) && (!q || `${s.title} ${s.tagline} ${s.skills.map((k) => SKILLS[k].label).join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  const groups = ([1, 2, 3, 4] as Difficulty[]).map((d) => ({ d, items: list.filter((s) => s.difficulty === d) })).filter((g) => g.items.length)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-8 py-8">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="label text-accent">Centre d'entraînement</div>
            <h1 className="mt-1 text-3xl font-bold text-white">Missions</h1>
            <p className="mt-1 text-[13.5px] text-ink-300">{SCENARIOS.length} scénarios générés de façon procédurale : chaque graine produit une affaire différente.</p>
          </div>
          <button className="btn-outline ml-auto" onClick={() => {
            const t = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)]
            if (t) setPick(t)
          }}>
            <Icon name="Dices" size={15} /> Affaire au hasard
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
            <input className="input w-64 !pl-8" placeholder="Rechercher une compétence, une typologie…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-1 rounded-lg border border-ink-700 bg-ink-900 p-0.5">
            <FilterBtn active={diff === 0} onClick={() => setDiff(0)}>Tous niveaux</FilterBtn>
            {([1, 2, 3, 4] as Difficulty[]).map((d) => (
              <FilterBtn key={d} active={diff === d} onClick={() => setDiff(d)} color={DIFFICULTY[d].color}>{DIFFICULTY[d].label}</FilterBtn>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <FilterBtn active={chain === ''} onClick={() => setChain('')}>Toutes chaînes</FilterBtn>
            {chains.map((c) => (
              <FilterBtn key={c} active={chain === c} onClick={() => setChain(c)} color={CHAINS[c].color}>{CHAINS[c].short}</FilterBtn>
            ))}
          </div>
        </div>

        {groups.map((g) => (
          <section key={g.d} className="mt-8">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full" style={{ background: DIFFICULTY[g.d].color, boxShadow: `0 0 10px ${DIFFICULTY[g.d].color}` }} />
              <h2 className="text-[15px] font-semibold text-white">{DIFFICULTY[g.d].label}</h2>
              <span className="text-[12px] text-ink-400">{g.items.length} mission(s) · {DIFFICULTY[g.d].xp} XP max</span>
              <div className="h-px flex-1 bg-gradient-to-r from-ink-700 to-transparent" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((s) => <MissionCard key={s.id} s={s} best={best[s.id]} onOpen={() => setPick(s)} />)}
            </div>
          </section>
        ))}
        {!groups.length && <div className="mt-16 text-center text-ink-400">Aucune mission ne correspond aux filtres.</div>}
      </div>
      <LaunchModal s={pick} onClose={() => setPick(null)} />
    </div>
  )
}

function FilterBtn({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button onClick={onClick} className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${active ? 'bg-ink-700 text-white' : 'text-ink-300 hover:text-white'}`} style={active && color ? { color, background: `${color}1c` } : undefined}>
      {children}
    </button>
  )
}

export function MissionCard({ s, best, onOpen }: { s: ScenarioTemplate; best?: number; onOpen: () => void }) {
  const dc = DIFFICULTY[s.difficulty].color
  return (
    <button onClick={onOpen} className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/70 text-left transition hover:-translate-y-0.5 hover:border-ink-500 hover:shadow-panel">
      <div className="relative h-24 overflow-hidden border-b border-ink-700/60" style={{ background: `radial-gradient(ellipse at 15% 0%, ${dc}26, transparent 60%), radial-gradient(ellipse at 100% 100%, ${CHAINS[s.chains[0]].color}22, transparent 60%), #090d18` }}>
        <MiniGraph seed={s.id} color={dc} />
        <div className="absolute left-4 top-3 flex gap-1">{s.chains.map((c) => <ChainBadge key={c} chain={c} compact />)}</div>
        {best !== undefined && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-ink-950/80 px-2 py-0.5 text-[11px] font-semibold" style={{ color: best >= 0.8 ? '#34d399' : best >= 0.5 ? '#facc15' : '#f43f5e' }}>
            <Icon name="Trophy" size={11} /> {Math.round(best * 100)} %
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-white group-hover:text-accent">{s.title}</h3>
        </div>
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-300">{s.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {s.skills.slice(0, 4).map((k) => <span key={k} className="chip bg-ink-800 text-ink-200">{SKILLS[k].label}</span>)}
          {s.skills.length > 4 && <span className="chip bg-ink-800 text-ink-400">+{s.skills.length - 4}</span>}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-4">
          <DifficultyBadge d={s.difficulty} />
          <span className="ml-auto flex items-center gap-1 text-[11.5px] text-ink-400"><Icon name="Clock" size={12} /> {s.estMinutes} min</span>
        </div>
      </div>
    </button>
  )
}

/** Petit graphe décoratif déterministe pour les cartes. */
function MiniGraph({ seed, color }: { seed: string; color: string }) {
  let h = hashSeed(seed)
  const r = () => ((h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 4294967296)
  const nodes = Array.from({ length: 9 }, (_, i) => ({ x: 40 + i * 38 + r() * 18, y: 22 + r() * 60 }))
  return (
    <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 400 96" preserveAspectRatio="xMidYMid slice">
      {nodes.slice(1).map((n, i) => {
        const p = nodes[Math.max(0, i - Math.floor(r() * 2))]
        return <line key={i} x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke={color} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 3" className="animate-dash" />
      })}
      {nodes.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={i === 0 ? 5 : 3 + r() * 2} fill="#090d18" stroke={i === 0 ? '#f472b6' : color} strokeWidth={1.5} />)}
    </svg>
  )
}

export function LaunchModal(props: { s: ScenarioTemplate | null; onClose: () => void; seed?: number }) {
  // Options remises à zéro à chaque mission ouverte
  return <LaunchModalInner key={`${props.s?.id ?? 'none'}-${props.seed ?? ''}`} {...props} />
}

function LaunchModalInner({ s, onClose, seed: fixedSeed }: { s: ScenarioTemplate | null; onClose: () => void; seed?: number }) {
  const [mode, setMode] = useState<Mode>('standard')
  const [coverage, setCoverage] = useState<Coverage>('full')
  const [seedText, setSeedText] = useState('')
  if (!s) return null
  const lessons = (s.lessons ?? []).map((id) => LESSONS.find((l) => l.id === id)).filter(Boolean)
  const lessonsDone = useProfile.getState().lessons
  return (
    <Modal open={!!s} onClose={onClose} title={s.title} icon="Crosshair" width="max-w-2xl">
      <div className="flex flex-wrap gap-1.5">
        <DifficultyBadge d={s.difficulty} />
        {s.chains.map((c) => <ChainBadge key={c} chain={c} />)}
        <span className="chip bg-ink-800 text-ink-200"><Icon name="Clock" size={11} /> ~{s.estMinutes} min</span>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-ink-200">{s.description}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {s.skills.map((k) => <span key={k} className="chip border border-ink-600 bg-ink-800 text-ink-100">{SKILLS[k].label}</span>)}
      </div>
      {lessons.length > 0 && (
        <div className="mt-4 rounded-xl border border-ink-700/60 bg-ink-850/50 p-3">
          <div className="label mb-2">Leçons recommandées</div>
          <div className="flex flex-wrap gap-1.5">
            {lessons.map((l) => (
              <button key={l!.id} className="chip border border-ink-600 bg-ink-800 !py-1 text-ink-100 hover:border-accent" onClick={() => {
                onClose()
                useUi.getState().openLesson(l!.id)
              }}>
                <Icon name={lessonsDone[l!.id]?.read ? 'CircleCheck' : 'GraduationCap'} size={12} className={lessonsDone[l!.id]?.read ? 'text-emerald-400' : 'text-accent'} /> {l!.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <OptionGroup label="Mode" value={mode} onChange={setMode} options={[
          { v: 'standard', t: 'Entraînement', d: 'Indices disponibles' },
          { v: 'examen', t: 'Examen', d: 'Sans indice · XP ×1,5' },
        ]} />
        <OptionGroup label="Base d'attribution" value={coverage} onChange={setCoverage} options={[
          { v: 'full', t: 'Complète', d: 'Toutes les étiquettes connues' },
          { v: 'partial', t: 'Partielle', d: '60 % des dépôts non étiquetés · XP ×1,25' },
        ]} />
      </div>
      {fixedSeed === undefined && (
        <label className="mt-3 block">
          <span className="label">Graine (optionnel)</span>
          <input className="input mt-1 font-mono" placeholder="Aléatoire — saisissez un nombre pour rejouer la même affaire qu'un collègue" value={seedText} onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, ''))} />
        </label>
      )}
      <button className="btn-primary mt-5 w-full !py-2.5 text-[14px]" onClick={() => {
        const seed = fixedSeed ?? (seedText ? Number(seedText) : randomSeed())
        onClose()
        launchCase(s.id, seed, mode, coverage)
      }}>
        <Icon name="Play" size={16} /> Ouvrir le dossier
      </button>
    </Modal>
  )
}

function OptionGroup<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { v: T; t: string; d: string }[] }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((o) => (
          <button key={o.v} onClick={() => onChange(o.v)} className={`rounded-xl border p-2.5 text-left transition ${value === o.v ? 'border-accent/60 bg-accent/10' : 'border-ink-700 hover:border-ink-500'}`}>
            <div className={`text-[12.5px] font-semibold ${value === o.v ? 'text-white' : 'text-ink-100'}`}>{o.t}</div>
            <div className="text-[10.5px] text-ink-400">{o.d}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export { ProgressBar }
