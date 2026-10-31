import { useEffect, useRef, useState } from 'react'
import type { Core } from 'cytoscape'
import { randomSeed } from '../../engine/rng'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { aKey } from '../../lib/graph'
import { ChainBadge, DifficultyBadge, Icon, fmtDuration } from '../common'
import { GraphCanvas, fitGraph } from './GraphCanvas'
import { Inspector } from './Inspector'
import { Dossier, useDossierTabs } from './Dossier'
import { GuidePanel } from './GuidePanel'
import { Timeline } from './Timeline'
import { TracerModal, findPathFromSelection, openTracerFromSelection } from './Tracer'
import { PeelModal } from './Heuristics'
import { LiveClockBar } from './Live'
import { DemixModal } from './Demix'
import { CaseBar } from './CaseBar'
import { HdToolModal, openHdTool } from './HdTool'
import { CertBanner, CertReportModal } from './CertExam'
import { Briefing, ConfirmSubmit, Correlator, Debrief, HintModal, ReportModal, RequisitionModal, SearchPalette, ShortcutsModal } from './Tools'

// L'espace d'enquête donne la place au graphe : le dossier est un tiroir
// ouvert depuis un rail, l'analyse flotte au-dessus du graphe et n'apparaît
// qu'avec une sélection, le guide est une carte « coach » repliable.

function useClock(startedAt: number, stopped?: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (stopped) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [stopped])
  return Math.max(0, Math.round(((stopped ?? now) - startedAt) / 1000))
}

function openCorrelator() {
  const inst = useGame.getState().inst
  if (!inst) return
  const sel = useGame.getState().selection
  const tx = sel?.kind === 'tx' ? inst.world.tx(sel.id) : undefined
  useUi.getState().set({ correlator: { open: true, preset: tx ? { time: tx.time, usd: Math.round(inst.world.txUsd(tx)), excludeTx: tx.id } : { time: inst.world.t0, usd: 1000 } } })
}

export function Workspace() {
  const inst = useGame((s) => s.inst)
  const template = useGame((s) => s.template)
  const startedAt = useGame((s) => s.startedAt)
  const finishedAt = useGame((s) => s.finishedAt)
  const mode = useGame((s) => s.mode)
  const coverage = useGame((s) => s.coverage)
  const noise = useGame((s) => s.noise)
  const live = useGame((s) => !!s.live)
  const score = useGame((s) => s.score)
  const selection = useGame((s) => s.selection)
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
      if (e.key === 'Escape' && useGame.getState().selection) useGame.getState().select(null)
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
    const inCert = !!useGame.getState().cert
    if (!score && !confirm(inCert ? 'Quitter l\'examen ? Le chronomètre continue de tourner ; vous pourrez reprendre depuis la page Certificats de l\'Académie.' : 'Quitter l\'enquête ? Votre progression est sauvegardée et pourra être reprise depuis le Bureau.')) return
    useGame.setState({ inst: null, template: null })
    if (score) useGame.getState().quit()
    if (inCert) useUi.getState().openAcademy({ kind: 'certs' })
    else useUi.getState().setPage('missions')
  }
  const replay = () => {
    useGame.getState().start(template.id, randomSeed(), { mode, coverage, live, noise })
    useUi.getState().set({ briefingOpen: true, timeRange: null, leftOpen: true, leftTab: template.guided ? 'objectives' : 'evidence' })
  }
  const guide = inst.guide?.length && !score ? inst.guide : null
  const showInspector = !!selection && rightOpen

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-900 px-3">
        <button className="icon-btn !h-9 !w-9" onClick={exit} title={score ? 'Fermer le dossier' : 'Quitter (progression sauvegardée)'} aria-label="Quitter l'enquête">
          <Icon name="ChevronLeft" size={18} />
        </button>
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="hidden shrink-0 text-dense text-ink-400 lg:inline">Missions</span>
          <span className="hidden text-ink-500 lg:inline">/</span>
          <span className="truncate text-body font-semibold text-white" title={`${inst.title} — ${template.title}`}>{inst.title}</span>
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 md:flex">
          <DifficultyBadge d={template.difficulty} />
          {template.chains.map((c) => <ChainBadge key={c} chain={c} compact />)}
          {mode === 'examen' && <span className="chip bg-rose-500/15 text-rose-300">Examen</span>}
          {coverage === 'partial' && <span className="chip bg-orange-500/15 text-orange-300" title="Une partie des adresses de dépôt n'est pas étiquetée">Attribution partielle</span>}
          {live && <span className="chip bg-rose-500/15 text-rose-300">Temps réel</span>}
          {noise !== 'normal' && <span className="chip bg-violet-500/15 text-violet-300" title="Activité de fond ajoutée autour des services">Graphe {noise === 'dense' ? 'dense' : 'extrême'}</span>}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CertBanner />
          <LiveClockBar />
          <span className={`flex items-center gap-1.5 font-mono text-dense ${finishedAt ? 'text-emerald-300' : 'text-ink-300'}`} title="Temps passé sur l'affaire">
            <Icon name="Timer" size={15} /> {fmtDuration(elapsed)}
          </span>
          <button
            className="hidden h-[34px] w-[240px] items-center gap-2 rounded-lg border border-ink-600 bg-ink-950 px-2.5 text-left text-dense text-ink-400 transition-colors hover:border-ink-500 hover:text-ink-200 xl:flex"
            onClick={() => useUi.getState().set({ paletteOpen: true })}
          >
            <Icon name="Search" size={15} />
            <span className="flex-1 truncate">Adresse, transaction, entité…</span>
            <span className="kbd">Ctrl K</span>
          </button>
          <button className="icon-btn !h-[34px] !w-[34px] xl:hidden" onClick={() => useUi.getState().set({ paletteOpen: true })} title="Rechercher (Ctrl K)" aria-label="Rechercher">
            <Icon name="Search" size={16} />
          </button>
          <button className="btn-outline !h-[34px]" onClick={openTracerFromSelection} title="Tracer les fonds depuis la sélection (R)">
            <Icon name="Route" size={15} /> Tracer <span className="font-mono text-meta text-ink-400">R</span>
          </button>
          <ToolsMenu />
          {!score && (
            <button className="btn-primary !h-[34px] !px-3.5 font-semibold" onClick={() => useUi.getState().set({ confirmSubmit: true })}>
              <Icon name="Send" size={15} /> Remettre<span className="hidden lg:inline">&nbsp;le rapport</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <DossierRail />
        {leftOpen && (
          <aside className="w-[340px] shrink-0 border-r border-ink-700 bg-ink-900 animate-fadein">
            <Dossier />
          </aside>
        )}
        <main className="flex min-w-0 flex-1 flex-col">
          <CaseBar />
          <div className="relative min-h-0 flex-1">
            <GraphCanvas inspectorOpen={showInspector} />
            {guide && (
              <div className="absolute left-3 top-3 z-20">
                <GuidePanel steps={guide} />
              </div>
            )}
            {showInspector && (
              <aside data-inspector aria-label="Analyse de la sélection" className="absolute bottom-3 right-3 top-3 z-20 flex w-[380px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-850 shadow-pop animate-slidein">
                <div className="flex h-10 shrink-0 items-center gap-2 border-b border-ink-700 pl-4 pr-1.5">
                  <span className="text-meta font-semibold text-ink-300">{selection?.kind === 'address' ? 'Adresse' : selection?.kind === 'tx' ? 'Transaction' : 'Flux'}</span>
                  <span className="ml-auto hidden text-micro text-ink-400 sm:inline">Échap pour fermer</span>
                  <button className="icon-btn" aria-label="Fermer l'analyse" title="Fermer (Échap)" onClick={() => useGame.getState().select(null)}>
                    <Icon name="X" size={16} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <Inspector />
                </div>
              </aside>
            )}
            <Debrief onReplay={replay} onExit={exit} />
          </div>
          {timelineOpen && (
            <div className="h-[104px] shrink-0 border-t border-ink-700 bg-ink-900">
              <Timeline />
            </div>
          )}
        </main>
      </div>

      <Briefing />
      <Correlator />
      <TracerModal />
      <PeelModal />
      <DemixModal />
      <HdToolModal />
      <CertReportModal />
      <SearchPalette />
      <RequisitionModal />
      <HintModal />
      <ConfirmSubmit />
      <ReportModal />
      <ShortcutsModal />
    </div>
  )
}

/** Rail du dossier : un clic ouvre l'onglet dans le tiroir, un second clic le referme. */
function DossierRail() {
  const tabs = useDossierTabs()
  const leftOpen = useUi((s) => s.leftOpen)
  const leftTab = useUi((s) => s.leftTab)
  const toggle = (id: (typeof tabs)[number]['id']) => {
    const ui = useUi.getState()
    if (ui.leftOpen && ui.leftTab === id) ui.set({ leftOpen: false })
    else ui.set({ leftOpen: true, leftTab: id })
  }
  return (
    <nav aria-label="Dossier" className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-ink-700 bg-ink-900 py-2.5">
      {tabs.map((t) => {
        const active = leftOpen && leftTab === t.id
        return (
          <button
            key={t.id}
            onClick={() => toggle(t.id)}
            title={t.label}
            aria-label={t.badge ? `${t.label}, ${t.badge}` : t.label}
            aria-pressed={active}
            className={`relative grid h-10 w-10 place-items-center rounded-lg transition-colors ${active ? 'bg-ink-700 text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white'}`}
          >
            <Icon name={t.icon} size={19} strokeWidth={1.75} />
            {t.badge && <span className="absolute -right-1 top-0.5 rounded-md bg-ink-600 px-1 font-mono text-[10px] leading-[15px] text-ink-100">{t.badge}</span>}
          </button>
        )
      })}
      <div className="my-1.5 h-px w-6 bg-ink-700" />
      <button className="grid h-10 w-10 place-items-center rounded-lg text-ink-300 transition-colors hover:bg-ink-800 hover:text-white" title="Ordre de mission" aria-label="Ordre de mission" onClick={() => useUi.getState().set({ briefingOpen: true })}>
        <Icon name="ClipboardList" size={19} strokeWidth={1.75} />
      </button>
      <div className="flex-1" />
      <button className="grid h-10 w-10 place-items-center rounded-lg font-mono text-body text-ink-400 transition-colors hover:bg-ink-800 hover:text-white" title="Raccourcis clavier (?)" aria-label="Raccourcis clavier" onClick={() => useUi.getState().set({ shortcutsOpen: true })}>
        ?
      </button>
    </nav>
  )
}

/** Outils d'analyse et affichage, regroupés pour alléger la barre. */
function ToolsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timelineOpen = useUi((s) => s.timelineOpen)
  const rightOpen = useUi((s) => s.rightOpen)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])
  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }
  const ui = () => useUi.getState()
  return (
    <div ref={ref} className="relative">
      <button className="btn-outline !h-[34px] !pr-2" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        Outils <Icon name="ChevronDown" size={14} className="text-ink-400" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-40 w-72 rounded-xl border border-ink-600 bg-ink-850 p-1.5 shadow-pop animate-fadein">
          <MenuLabel>Analyse</MenuLabel>
          <MenuItem icon="Radar" label="Corrélateur montant / temps" kbd="C" onClick={run(openCorrelator)} />
          <MenuItem icon="Waypoints" label="Chemin entre deux adresses" kbd="P" onClick={run(findPathFromSelection)} />
          <MenuItem icon="KeyRound" label="Dérivation HD (xpub)" onClick={run(() => openHdTool())} />
          <div className="mx-2 my-1.5 h-px bg-ink-700" />
          <MenuLabel>Dossier</MenuLabel>
          <MenuItem icon="ClipboardList" label="Ordre de mission" onClick={run(() => ui().set({ briefingOpen: true }))} />
          <MenuItem icon="Printer" label="Rapport d'analyse imprimable" onClick={run(() => ui().set({ reportOpen: true }))} />
          <div className="mx-2 my-1.5 h-px bg-ink-700" />
          <MenuLabel>Affichage</MenuLabel>
          <MenuItem icon="ChartGantt" label="Frise chronologique" kbd="T" checked={timelineOpen} onClick={run(() => ui().set({ timelineOpen: !timelineOpen }))} />
          <MenuItem icon="PanelRight" label="Analyse de la sélection" kbd="]" checked={rightOpen} onClick={run(() => ui().set({ rightOpen: !rightOpen }))} />
          <MenuItem icon="Keyboard" label="Raccourcis clavier" kbd="?" onClick={run(() => ui().set({ shortcutsOpen: true }))} />
        </div>
      )}
    </div>
  )
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pb-1 pt-1.5 text-micro font-semibold text-ink-400">{children}</div>
}

function MenuItem({ icon, label, kbd, onClick, checked }: { icon: string; label: string; kbd?: string; onClick: () => void; checked?: boolean }) {
  return (
    <button role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={checked} onClick={onClick} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-dense text-ink-100 transition-colors hover:bg-ink-700">
      <Icon name={icon} size={15} className="text-ink-300" />
      <span className="flex-1">{label}</span>
      {checked !== undefined && <Icon name={checked ? 'Check' : 'Minus'} size={14} className={checked ? 'text-accent' : 'text-ink-500'} />}
      {kbd && <span className="kbd">{kbd}</span>}
    </button>
  )
}
