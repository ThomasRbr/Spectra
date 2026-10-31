import { Component, useEffect, useState, type ReactNode } from 'react'
import { useUi, type Page } from '../store/ui'
import { useGame, loadSavedCase } from '../store/game'
import { useProfile, rankOf } from '../store/profile'
import { Icon } from './common'
import { SpectraMark, SpectraWordmark } from './brand'
import { GlobalSearch } from './GlobalSearch'
import { Dashboard } from './pages/Dashboard'
import { Missions } from './pages/Missions'
import { Glossary, Profile } from './pages/Academy'
import { Toolbox } from './pages/Toolbox'
import { Sandbox } from './pages/Sandbox'
import { AcademyApp } from './academy/AcademyApp'
import { Workspace } from './workspace/Workspace'

// Quatre espaces : le Bureau, Enquêter (missions et bac à sable), Apprendre
// (Académie et glossaire) et Terrain. Le profil se trouve sous l'avatar.
const NAV: { id: Page; label: string; icon: string; sub?: { id: Page; label: string; icon: string }[] }[] = [
  { id: 'dashboard', label: 'Bureau', icon: 'House' },
  { id: 'missions', label: 'Enquêter', icon: 'Crosshair', sub: [{ id: 'sandbox', label: 'Bac à sable', icon: 'FlaskConical' }] },
  { id: 'academy', label: 'Apprendre', icon: 'GraduationCap', sub: [{ id: 'glossary', label: 'Glossaire', icon: 'BookA' }] },
  { id: 'toolbox', label: 'Terrain', icon: 'BriefcaseBusiness' },
]

/** Pages de lecture, affichées sur papier si le profil le veut. */
const READING: Page[] = ['academy', 'toolbox', 'glossary']

function go(id: Page) {
  if (id === 'academy') useUi.getState().set({ lessonId: null, academy: { kind: 'home' } })
  useUi.getState().setPage(id)
}

export function App() {
  const page = useUi((s) => s.page)
  const readingTheme = useUi((s) => s.readingTheme)
  const inst = useGame((s) => s.inst)
  const inCase = page === 'workspace' && !!inst

  // Après un rechargement, on rouvre l'enquête en cours là où on l'avait laissée.
  useEffect(() => {
    if (page === 'workspace' && !useGame.getState().inst) {
      const saved = loadSavedCase()
      if (!saved || !useGame.getState().resume(saved)) useUi.getState().setPage('missions')
    }
  }, [page])

  // Ctrl K : recherche globale partout, sauf en enquête où elle cherche dans l'affaire.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return
      if (useUi.getState().page === 'workspace' && useGame.getState().inst) return
      e.preventDefault()
      useUi.getState().set({ searchOpen: true })
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const paper = READING.includes(page) && readingTheme === 'paper'

  return (
    <div className="flex h-full">
      {inCase ? <CaseRail /> : <Sidebar page={page} />}
      <main className={`relative min-w-0 flex-1 bg-ink-950 ${paper ? 'theme-paper' : ''}`}>
        <Boundary key={page}>
          {page === 'dashboard' && <Dashboard />}
          {page === 'missions' && <Missions />}
          {page === 'sandbox' && <Sandbox />}
          {page === 'academy' && <AcademyApp />}
          {page === 'toolbox' && <Toolbox />}
          {page === 'glossary' && <Glossary />}
          {page === 'profile' && <Profile />}
          {page === 'workspace' && (inst ? <Workspace /> : <Missions />)}
        </Boundary>
        <Toast />
      </main>
      <GlobalSearch />
    </div>
  )
}

function Sidebar({ page }: { page: Page }) {
  const inst = useGame((s) => s.inst)
  const template = useGame((s) => s.template)
  const score = useGame((s) => s.score)
  const xp = useProfile((s) => s.xp)
  const name = useProfile((s) => s.name)
  const rank = rankOf(xp)
  const isActive = (id: Page) => page === id || (id === 'missions' && page === 'workspace')

  return (
    <nav aria-label="Navigation principale" className="theme-ink flex w-[232px] shrink-0 flex-col border-r border-ink-700 bg-ink-900 px-3 pb-3 pt-[18px]">
      <button className="mb-5 rounded-lg px-2 py-1 text-left" onClick={() => go('dashboard')} aria-label="Bureau">
        <SpectraWordmark />
      </button>

      <div className="flex flex-col gap-0.5">
        {NAV.map((n) => (
          <div key={n.id}>
            <button className={`nav-item ${isActive(n.id) ? 'nav-item-active' : ''}`} aria-current={isActive(n.id) ? 'page' : undefined} onClick={() => go(n.id)}>
              <Icon name={n.icon} size={17} strokeWidth={1.75} className={isActive(n.id) ? 'text-white' : ''} />
              {n.label}
            </button>
            {n.sub?.map((s) => (
              <button key={s.id} className={`nav-item !h-8 pl-[38px] !text-dense ${page === s.id ? 'nav-item-active' : ''}`} aria-current={page === s.id ? 'page' : undefined} onClick={() => go(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {inst && template && !score && page !== 'workspace' && (
        <button onClick={() => useUi.getState().setPage('workspace')} className="mt-5 rounded-lg border border-ink-600 bg-ink-850 p-3 text-left transition-colors hover:border-ink-500">
          <div className="flex items-center gap-2 text-micro font-semibold text-ink-300">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Enquête en cours
          </div>
          <div className="mt-1 line-clamp-2 text-dense font-medium text-white">{template.title}</div>
        </button>
      )}

      <div className="flex-1" />

      <button
        className="flex h-10 items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-950 px-2.5 text-left text-dense text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
        onClick={() => useUi.getState().set({ searchOpen: true })}
      >
        <Icon name="Search" size={15} />
        <span className="flex-1">Rechercher</span>
        <span className="kbd">Ctrl K</span>
      </button>

      <button
        className={`mt-2 flex items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-ink-800 ${page === 'profile' ? 'bg-ink-800' : ''}`}
        onClick={() => go('profile')}
        aria-label={`Profil de ${name}`}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-700 text-dense font-semibold text-white">{(name.trim()[0] ?? '?').toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-dense font-semibold text-white">{name}</span>
          <span className="block truncate text-meta text-ink-400">Niveau {rank.level} · {xp.toLocaleString('fr-FR')} XP</span>
        </span>
      </button>
    </nav>
  )
}

/** En enquête, la navigation se réduit à un rail : le graphe garde la place. */
function CaseRail() {
  return (
    <nav aria-label="Navigation principale" className="theme-ink flex w-[56px] shrink-0 flex-col items-center gap-1 border-r border-ink-700 bg-ink-900 py-3">
      <button className="mb-3 grid h-10 w-10 place-items-center rounded-lg text-white hover:bg-ink-800" onClick={() => go('dashboard')} title="Bureau" aria-label="Bureau">
        <SpectraMark size={26} />
      </button>
      {NAV.map((n) => (
        <button key={n.id} title={n.label} aria-label={n.label} onClick={() => go(n.id)} className={`grid h-10 w-10 place-items-center rounded-lg transition-colors ${n.id === 'missions' ? 'bg-ink-800 text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white'}`}>
          <Icon name={n.icon} size={18} strokeWidth={1.75} />
        </button>
      ))}
      <div className="flex-1" />
      <button title="Profil" aria-label="Profil" onClick={() => go('profile')} className="grid h-10 w-10 place-items-center rounded-lg text-ink-300 hover:bg-ink-800 hover:text-white">
        <Icon name="UserRound" size={18} strokeWidth={1.75} />
      </button>
    </nav>
  )
}

function Toast() {
  const toast = useUi((s) => s.toast)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!toast) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 2600)
    return () => clearTimeout(t)
  }, [toast])
  if (!toast || !show) return null
  return (
    <div role="status" className="theme-ink absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-dense text-white shadow-pop animate-fadein">
      {toast.text}
    </div>
  )
}

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="card max-w-lg p-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-rose-500/15 text-rose-300"><Icon name="TriangleAlert" size={22} /></div>
          <div className="text-title font-semibold text-white">Une erreur est survenue</div>
          <div className="mt-2 break-words font-mono text-meta text-ink-300">{this.state.error.message}</div>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-outline" onClick={() => this.setState({ error: null })}>Réessayer</button>
            <button className="btn-primary" onClick={() => {
              this.setState({ error: null })
              useUi.getState().setPage('dashboard')
            }}>Bureau</button>
          </div>
        </div>
      </div>
    )
  }
}
