import { useEffect, useState } from 'react'
import type { Core } from 'cytoscape'
import { randomSeed } from '../../engine/rng'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { aKey } from '../../lib/graph'
import { ChainBadge, DifficultyBadge, Icon, fmtDuration } from '../common'
import { GraphCanvas, fitGraph } from './GraphCanvas'
import { Inspector } from './Inspector'
import { Dossier } from './Dossier'
import { Timeline } from './Timeline'
import { TracerModal, findPathFromSelection, openTracerFromSelection } from './Tracer'
import { PeelModal } from './Heuristics'
import { LiveClockBar } from './Live'
import { DemixModal } from './Demix'
import { CaseBar } from './CaseBar'
import { Briefing, ConfirmSubmit, Correlator, Debrief, HintModal, ReportModal, RequisitionModal, SearchPalette, ShortcutsModal } from './Tools'

function useClock(startedAt: number, stopped?: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (stopped) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [stopped])
  return Math.max(0, Math.round(((stopped ?? now) - startedAt) / 1000))
}

export function Workspace() {
  const inst = useGame((s) => s.inst)
  const template = useGame((s) => s.template)
  const startedAt = useGame((s) => s.startedAt)
  const finishedAt = useGame((s) => s.finishedAt)
  const mode = useGame((s) => s.mode)
  const coverage = useGame((s) => s.coverage)
  const live = useGame((s) => !!s.live)
  const score = useGame((s) => s.score)
  const timelineOpen = useUi((s) => s.timelineOpen)
  const leftOpen = useUi((s) => s.leftOpen)
  const rightOpen = useUi((s) => s.rightOpen)
  const elapsed = useClock(startedAt, finishedAt)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useUi.getState().set({ paletteOpen: true })
        return
      }
      // Aucun raccourci du graphe quand une fenêtre est ouverte
      if (document.querySelector('[data-modal]')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        useGame.getState().undo()
        return
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return
      const cy = (window as unknown as { __spectraCy?: () => Core | null }).__spectraCy?.()
      if ((e.key === 'f' || e.key === 'F') && cy) fitGraph(cy)
      if (e.key === 'l' || e.key === 'L') useGame.getState().relayout()
      if (e.key === 'Delete') {
        const g = useGame.getState()
        const sel = g.selection
        if (g.multi.length > 1) g.removeNodes(g.multi.map(aKey))
        else if (sel?.kind === 'address') g.removeNode(aKey(sel.id))
      }
      const ui = useUi.getState()
      if (e.key === 't' || e.key === 'T') ui.set({ timelineOpen: !ui.timelineOpen })
      if (e.key === '[') ui.set({ leftOpen: !ui.leftOpen })
      if (e.key === ']') ui.set({ rightOpen: !ui.rightOpen })
      if (e.key === '?') ui.set({ shortcutsOpen: true })
      if (e.key === 'r' || e.key === 'R') openTracerFromSelection()
      if (e.key === 'p' || e.key === 'P') findPathFromSelection()
      if (e.key === 'c' || e.key === 'C') {
        const sel = useGame.getState().selection
        const w = useGame.getState().inst?.world
        const tx = sel?.kind === 'tx' && w ? w.tx(sel.id) : undefined
        if (tx && w) ui.set({ correlator: { open: true, preset: { time: tx.time, usd: Math.round(w.txUsd(tx)), excludeTx: tx.id } } })
      }
      const g = useGame.getState()
      const sel = g.selection
      if (sel?.kind === 'address' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.shiftKey) {
        e.preventDefault()
        g.expand(sel.id, e.key === 'ArrowRight' ? 'out' : 'in')
      }
      if (sel?.kind === 'address' && (e.key === 'o' || e.key === 'O')) g.expand(sel.id, 'out')
      if (sel?.kind === 'address' && (e.key === 'i' || e.key === 'I')) g.expand(sel.id, 'in')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  if (!inst || !template) return null

  const exit = () => {
    if (!score && !confirm('Quitter l\'enquête ? Votre progression est sauvegardée et pourra être reprise depuis le tableau de bord.')) return
    useGame.setState({ inst: null, template: null })
    if (score) useGame.getState().quit()
    useUi.getState().setPage('missions')
  }
  const replay = () => {
    useGame.getState().start(template.id, randomSeed(), { mode, coverage, live })
    useUi.getState().set({ briefingOpen: true, timeRange: null, leftTab: 'evidence' })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Barre supérieure */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-ink-700/70 bg-ink-900/90 px-3 backdrop-blur-xl">
        <button className="btn-ghost !px-2" onClick={exit} title="Quitter">
          <Icon name="ChevronLeft" size={16} />
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/10 text-accent"><Icon name="FolderSearch" size={15} /></span>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-white">{inst.title}</div>
            <div className="truncate text-[10.5px] text-ink-400">{template.title}</div>
          </div>
          <DifficultyBadge d={template.difficulty} />
          <div className="hidden gap-1 xl:flex">{template.chains.map((c) => <ChainBadge key={c} chain={c} compact />)}</div>
          {mode === 'examen' && <span className="chip bg-rose-500/15 text-rose-300">Examen</span>}
          {coverage === 'partial' && <span className="chip bg-orange-500/15 text-orange-300">Attribution partielle</span>}
          {live && <span className="chip bg-rose-500/15 text-rose-300">Temps réel</span>}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <LiveClockBar />
          <div className={`mr-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[12.5px] ${finishedAt ? 'border-emerald-400/30 text-emerald-300' : 'border-ink-600 text-ink-100'}`}>
            <Icon name="Timer" size={13} className={finishedAt ? '' : 'text-accent'} /> {fmtDuration(elapsed)}
          </div>
          <TopBtn icon="Search" label="Rechercher" kbd="Ctrl K" onClick={() => useUi.getState().set({ paletteOpen: true })} />
          <TopBtn icon="Radar" label="Corrélateur" onClick={() => {
            const sel = useGame.getState().selection
            const tx = sel?.kind === 'tx' ? inst.world.tx(sel.id) : undefined
            useUi.getState().set({ correlator: { open: true, preset: tx ? { time: tx.time, usd: Math.round(inst.world.txUsd(tx)), excludeTx: tx.id } : { time: inst.world.t0, usd: 1000 } } })
          }} />
          <TopBtn icon="Route" label="Traçage" kbd="R" onClick={openTracerFromSelection} />
          <TopBtn icon="FileText" label="Ordre de mission" onClick={() => useUi.getState().set({ briefingOpen: true })} />
          <TopBtn icon="PanelLeft" label="Dossier" kbd="[" active={leftOpen} onClick={() => useUi.getState().set({ leftOpen: !leftOpen })} />
          <TopBtn icon="PanelBottom" label="Frise" kbd="T" active={timelineOpen} onClick={() => useUi.getState().set({ timelineOpen: !timelineOpen })} />
          <TopBtn icon="PanelRight" label="Analyse" kbd="]" active={rightOpen} onClick={() => useUi.getState().set({ rightOpen: !rightOpen })} />
          <TopBtn icon="Keyboard" label="Raccourcis" kbd="?" onClick={() => useUi.getState().set({ shortcutsOpen: true })} />
          <TopBtn icon="Printer" label="Rapport" onClick={() => useUi.getState().set({ reportOpen: true })} />
          {!score && (
            <button className="btn-primary ml-1 !py-1.5 text-[12.5px]" onClick={() => useUi.getState().set({ confirmSubmit: true })}>
              <Icon name="Send" size={14} /> Remettre
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`w-[360px] shrink-0 border-r border-ink-700/70 bg-ink-900/70 ${leftOpen ? '' : 'hidden'}`}>
          <Dossier />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <CaseBar />
          <div className="relative min-h-0 flex-1">
            <GraphCanvas />
            <Debrief onReplay={replay} onExit={exit} />
          </div>
          {timelineOpen && (
            <div className="h-[118px] shrink-0 border-t border-ink-700/70 bg-ink-900/80">
              <Timeline />
            </div>
          )}
        </main>
        <aside className={`w-[390px] shrink-0 border-l border-ink-700/70 bg-ink-900/70 ${rightOpen ? '' : 'hidden'}`}>
          <Inspector />
        </aside>
      </div>

      <Briefing />
      <Correlator />
      <TracerModal />
      <PeelModal />
      <DemixModal />
      <SearchPalette />
      <RequisitionModal />
      <HintModal />
      <ConfirmSubmit />
      <ReportModal />
      <ShortcutsModal />
    </div>
  )
}

function TopBtn({ icon, label, onClick, kbd, active }: { icon: string; label: string; onClick: () => void; kbd?: string; active?: boolean }) {
  return (
    <button onClick={onClick} title={kbd ? `${label} (${kbd})` : label} className={`btn !px-2.5 !py-1.5 text-[12px] ${active ? 'bg-accent/10 text-accent' : 'text-ink-200 hover:bg-ink-700/70 hover:text-white'}`}>
      <Icon name={icon} size={14} />
      <span className="hidden 2xl:inline">{label}</span>
    </button>
  )
}
