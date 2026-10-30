import { useMemo, useState } from 'react'
import {
  FICHES,
  MODELES,
  TOOLBOX_CATEGORIES,
  TOOLBOX_CATEGORY_ORDER,
  ficheById,
  ficheHaystack,
  ficheItemCount,
  modeleById,
  modeleHaystack,
  type Fiche,
  type Modele,
  type ToolboxCategory,
} from '../../academy/toolbox'
import { Icon, ProgressBar, Tabs } from '../common'
import { FicheView } from '../toolbox/FicheView'
import { ModeleView } from '../toolbox/ModeleView'
import { loadChecks } from '../toolbox/checks'

type Tab = 'fiches' | 'modeles'
type View = { kind: 'list' } | { kind: 'fiche'; id: string } | { kind: 'modele'; id: string }

// Mémorise la navigation le temps de la session (retour depuis une leçon liée).
let lastState: { tab: Tab; view: View; q: string; cat: ToolboxCategory | '' } = { tab: 'fiches', view: { kind: 'list' }, q: '', cat: '' }

export function Toolbox() {
  const [tab, setTabState] = useState<Tab>(lastState.tab)
  const [view, setViewState] = useState<View>(lastState.view)
  const [q, setQState] = useState(lastState.q)
  const [cat, setCatState] = useState<ToolboxCategory | ''>(lastState.cat)

  const remember = (p: Partial<typeof lastState>) => {
    lastState = { ...lastState, ...p }
  }
  const setTab = (t: Tab) => (remember({ tab: t }), setTabState(t))
  const setQ = (s: string) => (remember({ q: s }), setQState(s))
  const setCat = (c: ToolboxCategory | '') => (remember({ cat: c }), setCatState(c))
  const setView = (v: View) => {
    remember({ view: v, ...(v.kind === 'fiche' ? { tab: 'fiches' as Tab } : v.kind === 'modele' ? { tab: 'modeles' as Tab } : {}) })
    setViewState(v)
    if (v.kind !== 'list') setTabState(v.kind === 'fiche' ? 'fiches' : 'modeles')
    document.getElementById('toolbox-scroll')?.scrollTo({ top: 0 })
  }

  const fiche = view.kind === 'fiche' ? ficheById(view.id) : undefined
  const modele = view.kind === 'modele' ? modeleById(view.id) : undefined

  return (
    <div id="toolbox-scroll" className="h-full overflow-y-auto">
      {fiche ? (
        <FicheView key={fiche.id} fiche={fiche} onBack={() => setView({ kind: 'list' })} onOpenModele={(id) => setView({ kind: 'modele', id })} onOpenFiche={(id) => setView({ kind: 'fiche', id })} />
      ) : modele ? (
        <ModeleView key={modele.id} modele={modele} onBack={() => setView({ kind: 'list' })} />
      ) : (
        <ToolboxHome tab={tab} setTab={setTab} q={q} setQ={setQ} cat={cat} setCat={setCat} open={setView} />
      )}
    </div>
  )
}

function ToolboxHome({ tab, setTab, q, setQ, cat, setCat, open }: { tab: Tab; setTab: (t: Tab) => void; q: string; setQ: (s: string) => void; cat: ToolboxCategory | ''; setCat: (c: ToolboxCategory | '') => void; open: (v: View) => void }) {
  const checks = useMemo(() => loadChecks(), [])
  const needle = q.trim().toLowerCase()
  const fiches = useMemo(() => FICHES.filter((f) => (!cat || f.category === cat) && (!needle || ficheHaystack(f).includes(needle))), [cat, needle])
  const modeles = useMemo(() => MODELES.filter((m) => (!cat || m.category === cat) && (!needle || modeleHaystack(m).includes(needle))), [cat, needle])
  const items: (Fiche | Modele)[] = tab === 'fiches' ? fiches : modeles
  const counts = useMemo(() => {
    const src: { category: ToolboxCategory }[] = tab === 'fiches' ? FICHES : MODELES
    const out: Partial<Record<ToolboxCategory, number>> = {}
    for (const x of src) out[x.category] = (out[x.category] ?? 0) + 1
    return out
  }, [tab])

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="relative overflow-hidden rounded-3xl border border-ink-700/70 hero-gradient p-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="label text-accent">Boîte à outils terrain</div>
            <h1 className="mt-2 text-[34px] font-extrabold leading-tight tracking-tight text-white">Les bons réflexes,<br />au bon moment</h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-200">
              {FICHES.length} fiches réflexes à dérouler sur le terrain — accueil de victime, gel en urgence, perquisition, réquisitions, analyse, rédaction — et {MODELES.length} modèles de documents pré-remplis à imprimer ou à copier.
            </p>
            <div className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-ink-300">
              <Icon name="Scale" size={14} className="mt-0.5 shrink-0 text-violet-300" />
              <span>Contenu pédagogique : il ne remplace ni les instructions de votre service, ni l'avis du magistrat. Les modèles sont à adapter aux trames en vigueur.</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 self-center">
            <HeroStat icon="ListChecks" color="#22d3ee" value={FICHES.length} label="fiches réflexes" />
            <HeroStat icon="FileText" color="#a78bfa" value={MODELES.length} label="modèles" />
            <HeroStat icon="TriangleAlert" color="#f43f5e" value={FICHES.reduce((n, f) => n + f.sections.reduce((m, s) => m + s.items.filter((i) => i.critique).length, 0), 0)} label="points critiques" />
            <HeroStat icon="Printer" color="#34d399" value="A4" label="impression sobre" />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="w-[340px] max-w-full">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'fiches', label: 'Fiches réflexes', icon: 'ListChecks', count: fiches.length },
              { id: 'modeles', label: 'Modèles de documents', icon: 'FileText', count: modeles.length },
            ]}
          />
        </div>
        <div className="relative ml-auto">
          <Icon name="Search" size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
          <input className="input w-72 !pl-8" placeholder={tab === 'fiches' ? 'Rechercher : seed, gel, DAB, bridge…' : 'Rechercher un modèle…'} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <CatBtn active={cat === ''} onClick={() => setCat('')}>
          Toutes catégories
        </CatBtn>
        {TOOLBOX_CATEGORY_ORDER.filter((c) => counts[c]).map((c) => (
          <CatBtn key={c} active={cat === c} color={TOOLBOX_CATEGORIES[c].color} onClick={() => setCat(cat === c ? '' : c)}>
            <Icon name={TOOLBOX_CATEGORIES[c].icon} size={12} /> {TOOLBOX_CATEGORIES[c].label}
            <span className="opacity-60">{counts[c]}</span>
          </CatBtn>
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tab === 'fiches'
          ? fiches.map((f) => <FicheCard key={f.id} f={f} done={checks[f.id]?.length ?? 0} onOpen={() => open({ kind: 'fiche', id: f.id })} />)
          : modeles.map((m) => <ModeleCard key={m.id} m={m} onOpen={() => open({ kind: 'modele', id: m.id })} />)}
      </div>
      {!items.length && (
        <div className="mt-14 text-center text-[13px] text-ink-400">
          Aucun résultat.{' '}
          <button
            className="text-accent hover:underline"
            onClick={() => {
              setQ('')
              setCat('')
            }}
          >
            Effacer les filtres
          </button>
        </div>
      )}
    </div>
  )
}

function HeroStat({ icon, color, value, label }: { icon: string; color: string; value: number | string; label: string }) {
  return (
    <div className="rounded-xl panel px-3 py-2.5">
      <Icon name={icon} size={15} color={color} />
      <div className="mt-1 text-[20px] font-bold leading-none text-white">{value}</div>
      <div className="mt-1 text-[11px] text-ink-300">{label}</div>
    </div>
  )
}

function CatBtn({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${active ? 'border-ink-500 bg-ink-700 text-white' : 'border-ink-700 bg-ink-900/70 text-ink-300 hover:text-white'}`}
      style={active && color ? { color, background: `${color}1c`, borderColor: `${color}66` } : undefined}
    >
      {children}
    </button>
  )
}

function FicheCard({ f, done, onOpen }: { f: Fiche; done: number; onOpen: () => void }) {
  const c = TOOLBOX_CATEGORIES[f.category]
  const total = ficheItemCount(f)
  const crit = f.sections.reduce((n, s) => n + s.items.filter((i) => i.critique).length, 0)
  return (
    <button onClick={onOpen} className="group flex flex-col rounded-2xl border border-ink-700/70 bg-ink-900/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-ink-500 hover:shadow-panel">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border" style={{ color: c.color, borderColor: `${c.color}55`, background: `${c.color}14` }}>
          <Icon name={f.icon} size={19} />
        </span>
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: c.color }}>
            {c.label}
          </div>
          <h3 className="mt-0.5 text-[14.5px] font-semibold leading-snug text-white group-hover:text-accent">{f.title}</h3>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-3 text-[12.5px] leading-relaxed text-ink-300">{f.summary}</p>
      <div className="mt-auto pt-3">
        <div className="flex items-center gap-2 text-[11.5px] text-ink-400">
          <span className="flex items-center gap-1">
            <Icon name="ListChecks" size={12} /> {total} étapes
          </span>
          <span className="flex items-center gap-1 text-rose-300/90">
            <Icon name="TriangleAlert" size={11} /> {crit} critiques
          </span>
          {done > 0 && <span className="ml-auto font-mono text-[11px] text-accent">{Math.min(done, total)}/{total}</span>}
        </div>
        {done > 0 && <ProgressBar value={Math.min(done, total) / total} className="mt-2" />}
      </div>
    </button>
  )
}

function ModeleCard({ m, onOpen }: { m: Modele; onOpen: () => void }) {
  const c = TOOLBOX_CATEGORIES[m.category]
  return (
    <button onClick={onOpen} className="group flex flex-col rounded-2xl border border-ink-700/70 bg-ink-900/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-ink-500 hover:shadow-panel">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-400/40 bg-violet-400/10 text-violet-300">
          <Icon name={m.icon} size={19} />
        </span>
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: c.color }}>
            {c.label}
          </div>
          <h3 className="mt-0.5 text-[14.5px] font-semibold leading-snug text-white group-hover:text-accent">{m.title}</h3>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-3 text-[12.5px] leading-relaxed text-ink-300">{m.description}</p>
      <div className="mt-auto flex items-center gap-3 pt-3 text-[11.5px] text-ink-400">
        <span className="flex items-center gap-1">
          <Icon name="TextCursorInput" size={12} /> {m.fields.length} champs
        </span>
        <span className="flex items-center gap-1">
          <Icon name="Printer" size={12} /> A4
        </span>
        <span className="flex items-center gap-1">
          <Icon name="Copy" size={12} /> texte
        </span>
      </div>
    </button>
  )
}
