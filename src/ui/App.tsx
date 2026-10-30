import { Component, useEffect, useState, type ReactNode } from 'react'
import { useUi, type Page } from '../store/ui'
import { useGame, loadSavedCase } from '../store/game'
import { useProfile, rankOf } from '../store/profile'
import { Icon, ProgressBar } from './common'
import { Dashboard } from './pages/Dashboard'
import { Missions } from './pages/Missions'
import { Glossary, Profile } from './pages/Academy'
import { Toolbox } from './pages/Toolbox'
import { AcademyApp } from './academy/AcademyApp'
import { Workspace } from './workspace/Workspace'

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard' },
  { id: 'missions', label: 'Missions', icon: 'Crosshair' },
  { id: 'academy', label: 'Académie', icon: 'GraduationCap' },
  { id: 'toolbox', label: 'Terrain', icon: 'BriefcaseBusiness' },
  { id: 'glossary', label: 'Glossaire', icon: 'BookA' },
  { id: 'profile', label: 'Profil', icon: 'UserRound' },
]

export function App() {
  const page = useUi((s) => s.page)
  const inst = useGame((s) => s.inst)
  const template = useGame((s) => s.template)
  const xp = useProfile((s) => s.xp)
  const name = useProfile((s) => s.name)
  const rank = rankOf(xp)
  const inCase = page === 'workspace' && inst

  // Après un rechargement, on rouvre l'enquête en cours là où on l'avait laissée.
  useEffect(() => {
    if (page === 'workspace' && !useGame.getState().inst) {
      const saved = loadSavedCase()
      if (!saved || !useGame.getState().resume(saved)) useUi.getState().setPage('missions')
    }
  }, [page])

  return (
    <div className="flex h-full">
      <nav className={`flex shrink-0 flex-col border-r border-ink-700/70 bg-ink-900/90 transition-all ${inCase ? 'w-[60px]' : 'w-[230px]'}`}>
        <div className={`flex items-center gap-2.5 ${inCase ? 'justify-center px-0' : 'px-5'} h-16`}>
          <Logo />
          {!inCase && (
            <div>
              <div className="text-[16px] font-extrabold tracking-[0.2em] text-white">SPECTRA</div>
              <div className="-mt-0.5 text-[9.5px] uppercase tracking-[0.18em] text-ink-400">Crypto Tracing Lab</div>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-0.5 px-2.5 py-2">
          {NAV.map((n) => {
            const active = page === n.id || (n.id === 'academy' && page === 'academy')
            return (
              <button
                key={n.id}
                title={n.label}
                onClick={() => {
                  if (n.id === 'academy') useUi.getState().set({ lessonId: null, academy: { kind: 'home' } })
                  useUi.getState().setPage(n.id)
                }}
                className={`group relative flex items-center gap-3 rounded-lg ${inCase ? 'justify-center px-0' : 'px-3'} py-2 text-[13px] font-medium transition ${active ? 'bg-accent/10 text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white'}`}
              >
                {active && <span className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-[3px] rounded-r bg-accent shadow-glow" />}
                <Icon name={n.icon} size={17} className={active ? 'text-accent' : ''} />
                {!inCase && n.label}
              </button>
            )
          })}
          {inst && template && page !== 'workspace' && (
            <button onClick={() => useUi.getState().setPage('workspace')} className="mt-3 flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-left text-[12.5px] text-white animate-pulseRing">
              <Icon name="FolderSearch" size={16} className="text-accent" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-accent">Enquête en cours</div>
                <div className="truncate">{template.title}</div>
              </div>
            </button>
          )}
        </div>
        {!inCase && (
          <div className="m-3 rounded-xl border border-ink-700/70 bg-ink-850/70 p-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-accent/30 to-violet-500/30 text-[13px] font-bold text-white">{rank.level}</div>
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-semibold text-white">{name}</div>
                <div className="truncate text-[10.5px] text-ink-300">{rank.name}</div>
              </div>
            </div>
            <ProgressBar value={rank.progress} className="mt-2.5" />
            <div className="mt-1 text-right font-mono text-[10px] text-ink-400">{xp.toLocaleString('fr-FR')} XP</div>
          </div>
        )}
      </nav>
      <main className="relative min-w-0 flex-1 grid-bg">
        <Boundary key={page}>
          {page === 'dashboard' && <Dashboard />}
          {page === 'missions' && <Missions />}
          {page === 'academy' && <AcademyApp />}
          {page === 'toolbox' && <Toolbox />}
          {page === 'glossary' && <Glossary />}
          {page === 'profile' && <Profile />}
          {page === 'workspace' && (inst ? <Workspace /> : <Missions />)}
        </Boundary>
        <Toast />
      </main>
    </div>
  )
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" className="shrink-0 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
      <rect width="32" height="32" rx="9" fill="#0c1120" stroke="#22d3ee" strokeOpacity="0.5" />
      <path d="M11 15.5l7-6M11 17l7 6M19 9.5l2 13" stroke="#22d3ee" strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="10" cy="16" r="3.5" fill="#22d3ee" />
      <circle cx="20" cy="9" r="2.6" fill="#a78bfa" />
      <circle cx="21.5" cy="23" r="2.6" fill="#f472b6" />
    </svg>
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
  return <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl panel-solid px-4 py-2 text-[13px] text-white shadow-panel animate-fadein">{toast.text}</div>
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
        <div className="max-w-lg rounded-2xl panel-solid p-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-rose-500/15 text-rose-300"><Icon name="TriangleAlert" size={22} /></div>
          <div className="text-lg font-semibold text-white">Une erreur est survenue</div>
          <div className="mt-2 break-words font-mono text-[11.5px] text-ink-300">{this.state.error.message}</div>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-outline" onClick={() => this.setState({ error: null })}>Réessayer</button>
            <button className="btn-primary" onClick={() => {
              this.setState({ error: null })
              useUi.getState().setPage('dashboard')
            }}>Tableau de bord</button>
          </div>
        </div>
      </div>
    )
  }
}
