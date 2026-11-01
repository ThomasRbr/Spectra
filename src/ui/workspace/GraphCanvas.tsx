import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import cytoscape, { type Core, type EventObject, type NodeSingular } from 'cytoscape'
import { icons } from 'lucide-react'
import { CHAINS, ASSETS, fmtUsd, usd, type AssetId } from '../../engine/chains'
import { CATEGORY } from '../../engine/entities'
import { attribution, clusterOf, detectCoinjoin } from '../../engine/analysis'
import { shortAddr } from '../../engine/addressgen'
import { useGame, FLAG_META, type Flag } from '../../store/game'
import { useGraph } from '../../store/graph'
import { useUi } from '../../store/ui'
import { aKey, idOf, isAKey, tKey } from '../../lib/graph'
import { edgeLabel, type DNode } from '../../lib/graphview'
import { Icon } from '../common'
import { entityLogo } from '../logos'
import { findPathFromSelection, openTracer, openTracerFromSelection } from './Tracer'
import { openPeel } from './Heuristics'
import { openDemix } from './Demix'
import { poolDeposits } from '../../engine/demix'
import { TRACE_METHODS } from '../../engine/tracing'
import { alignNodes, collapseParent, dissolveGroup, groupCluster, groupEntity, groupSelection, relayoutGraph, toggleGroupNode, useDisplay } from './graphActions'
import { AnnotationsLayer, BoxDrawer, ExportMenu, GraphTopBar, LanesLayer, Minimap, ReplayBar, TimeAxis, type Viewport } from './GraphOverlays'

/** Cadre tout le graphe sans zoomer exagérément quand il y a peu de nœuds. */
export function fitGraph(cy: Core, duration = 300) {
  if (cy.elements().empty()) return
  const bb = cy.elements().boundingBox()
  const pad = 70
  // L'inspecteur flotte à droite : on cadre dans la zone restée libre.
  const right = (document.querySelector('[data-inspector]') as HTMLElement | null)?.offsetWidth ?? 0
  const inset = right ? right + 12 : 0
  const W = cy.width() - inset
  const zoom = Math.min(1.15, (W - pad * 2) / Math.max(1, bb.w), (cy.height() - pad * 2) / Math.max(1, bb.h))
  const z = Math.max(cy.minZoom(), zoom)
  const pan = { x: W / 2 - z * (bb.x1 + bb.w / 2), y: cy.height() / 2 - z * (bb.y1 + bb.h / 2) }
  cy.animate({ zoom: z, pan }, { duration })
}

const iconCache = new Map<string, string>()
function iconUri(name: string, color: string): string {
  const k = `${name}|${color}`
  let v = iconCache.get(k)
  if (!v) {
    const C = (icons as Record<string, (typeof icons)['Circle']>)[name] ?? icons.Circle
    const svg = renderToStaticMarkup(createElement(C, { color, size: 24, strokeWidth: 1.9 }))
    v = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    iconCache.set(k, v)
  }
  return v
}

/** Pastille ronde (fond sombre, icône colorée) posée sur un nœud. */
function badgeUri(name: string, color: string): string {
  const k = `badge|${name}|${color}`
  let v = iconCache.get(k)
  if (!v) {
    const C = (icons as Record<string, (typeof icons)['Circle']>)[name] ?? icons.Circle
    const inner = renderToStaticMarkup(createElement(C, { color, size: 14, strokeWidth: 2.4, x: 5, y: 5 }))
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0e1013" stroke="${color}" stroke-width="1.6"/>${inner}</svg>`
    v = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    iconCache.set(k, v)
  }
  return v
}

function sharePct(v: number, of: number): string {
  const p = (v / Math.max(1, of)) * 100
  return p > 0 && p < 1 ? '< 1 %' : `${Math.round(p)} %`
}

function compact(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e4) return `${(v / 1e3).toFixed(1)}k`
  if (v >= 100) return v.toFixed(0)
  if (v >= 1) return v.toFixed(2)
  return v.toPrecision(3)
}

// Langage visuel du graphe : la forme dit le rôle (victime en cercle double,
// suspect en losange, service en carré avec son logo, contrat en hexagone,
// groupe replié en grand carré, agrégat en pastille pointillée), la couleur de
// l'arête dit l'actif ou la nature (swap, interne, autorisation), son épaisseur
// le montant.
export const ROLE = { victim: '#5ec8e5', suspect: '#ff8a4c', select: '#7ea6ff', trace: '#3fc7a4', truth: '#f3f5f7', missed: '#f97316', swap: '#c084fc', approval: '#fb923c', internal: '#f5c451', mint: '#e879f9', collateral: '#e879f9', match: '#facc15' }

const GROUP_COLOR: Record<string, string> = { cluster: '#f59e0b', stake: '#3468d1', manual: '#7ea6ff', entity: '#22d3ee', auto: '#22d3ee' }
const GROUP_ICON: Record<string, string> = { cluster: 'Network', stake: 'KeyRound', manual: 'Group', entity: 'Building2', auto: 'Building2' }

const fn = <T,>(k: string) => (e: NodeSingular) => e.data(k) as T

const STYLE: cytoscape.Stylesheet[] = [
  {
    selector: 'node[kind="addr"], node[kind="group"], node[kind="agg"]',
    style: {
      width: 'data(size)', height: 'data(size)', shape: 'ellipse',
      'background-color': '#1b1f25', 'border-width': 2, 'border-color': 'data(color)',
      'background-image': fn('imgs'), 'background-width': fn('bw'), 'background-height': fn('bw'),
      'background-position-x': fn('bx'), 'background-position-y': fn('by'), 'background-clip': fn('bclip'),
      'background-image-containment': 'over', 'background-fit': 'none',
      label: 'data(label)', color: '#dfe3e8', 'font-size': 10.5, 'font-family': 'Inter', 'font-weight': 500,
      'text-valign': 'bottom', 'text-margin-y': 7, 'text-wrap': 'wrap', 'text-max-width': '170px', 'line-height': 1.35,
      'text-background-color': '#0e1013', 'text-background-opacity': 0.88, 'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle',
      'transition-property': 'border-width, border-color, opacity', 'transition-duration': 0.15,
      'min-zoomed-font-size': 7,
    } as never,
  },
  // Service attribué : carré arrondi ; le logo de marque remplit la forme.
  { selector: 'node[role="entity"]', style: { shape: 'round-rectangle' } as never },
  { selector: 'node[?logo]', style: { 'border-width': 2.5 } as never },
  { selector: 'node[role="contract"]', style: { shape: 'round-hexagon' } as never },
  { selector: 'node[role="converter"]', style: { shape: 'round-octagon', 'border-style': 'double', 'border-width': 3.5 } as never },
  { selector: 'node[role="null"]', style: { shape: 'round-diamond', 'border-color': ROLE.mint, 'border-style': 'dashed' } as never },
  // Marquages : forme et couleur de rôle, en plus du libellé.
  { selector: 'node[flag="suspect"]', style: { shape: 'round-diamond', 'border-color': ROLE.suspect, 'border-width': 2.5, 'background-color': '#33200f' } as never },
  { selector: 'node[flag="victim"]', style: { 'border-color': ROLE.victim, 'border-style': 'double', 'border-width': 6, 'background-color': '#10262d' } as never },
  { selector: 'node[flag="interest"]', style: { 'border-color': '#facc15', 'border-width': 2.5 } as never },
  { selector: 'node[flag="service"]', style: { shape: 'round-rectangle', 'border-color': '#b4bbc5' } as never },
  { selector: 'node[flag="dead-end"]', style: { 'border-style': 'dashed', 'border-color': '#7a8290', opacity: 0.75 } as never },
  { selector: 'node[?seed]', style: { 'outline-color': '#5d6572', 'outline-width': 1.5, 'outline-offset': 4, 'outline-style': 'solid' } as never },
  // Groupe replié : grand carré à double bordure ; agrégat « +N » : pastille pointillée
  { selector: 'node[kind="group"]', style: { shape: 'round-rectangle', 'border-style': 'double', 'border-width': 5, 'background-color': '#161a20', 'font-weight': 600 } as never },
  { selector: 'node[kind="agg"]', style: { 'border-style': 'dashed', 'border-width': 1.8, 'background-color': '#14171c', color: '#b4bbc5', 'font-size': 9.5 } as never },
  // Groupe déplié : cadre composé autour de ses membres
  {
    selector: 'node[kind="parent"]',
    style: {
      shape: 'round-rectangle', 'background-color': 'data(color)', 'background-opacity': 0.05, 'border-width': 1.5, 'border-style': 'dashed', 'border-color': 'data(color)',
      label: 'data(label)', 'text-valign': 'top', 'text-halign': 'center', 'text-margin-y': -6, color: 'data(color)', 'font-size': 10.5, 'font-weight': 600, 'font-family': 'Inter',
      padding: '24px', 'compound-sizing-wrt-labels': 'include',
    } as never,
  },
  {
    selector: 'node[kind="tx"]',
    style: {
      width: 14, height: 14, shape: 'round-rectangle', 'background-color': '#23272e', 'border-width': 1.5, 'border-color': '#5d6572',
      label: 'data(label)', color: '#959da9', 'font-size': 8.5, 'font-family': 'JetBrains Mono', 'text-valign': 'top', 'text-margin-y': -5,
      'min-zoomed-font-size': 8,
    } as never,
  },
  { selector: 'node[kind="tx"][?coinjoin]', style: { 'border-color': '#fb7185', 'background-color': '#3b1520', width: 20, height: 20 } },
  { selector: 'node[kind="tx"][?ord]', style: { 'border-color': ROLE.mint, 'background-color': '#2a1530' } },
  { selector: 'node:selected', style: { 'outline-color': ROLE.select, 'outline-width': 2, 'outline-offset': 5, 'outline-style': 'solid', color: '#ffffff' } as never },
  {
    selector: 'edge',
    style: {
      'curve-style': 'bezier', width: 'data(w)', 'line-color': 'data(color)', 'target-arrow-shape': 'triangle',
      'target-arrow-color': 'data(color)', 'arrow-scale': 0.7, opacity: 0.72, 'line-cap': 'round',
      label: 'data(label)', 'font-size': 9, 'font-family': 'JetBrains Mono', color: '#b4bbc5', 'text-wrap': 'wrap', 'line-height': 1.3,
      'text-rotation': 'autorotate', 'text-background-color': '#15181d', 'text-background-opacity': 0.95,
      'text-background-padding': '2px', 'text-background-shape': 'roundrectangle',
      'text-border-width': 1, 'text-border-color': '#2f353e', 'text-border-opacity': 1,
      'min-zoomed-font-size': 8,
      'loop-direction': '-45deg', 'loop-sweep': '-40deg', 'control-point-step-size': 46,
    } as never,
  },
  { selector: 'edge[kind="io"]', style: { 'curve-style': 'straight', label: '' } },
  { selector: 'edge[kind="internal"]', style: { 'line-style': 'dashed', 'line-dash-pattern': [5, 3], 'text-border-color': ROLE.internal } as never },
  { selector: 'edge[kind="mint"], edge[kind="burn"]', style: { 'line-style': 'dotted', 'line-color': ROLE.mint, 'target-arrow-color': ROLE.mint } as never },
  { selector: 'edge[kind="swap"]', style: { 'line-color': ROLE.swap, 'target-arrow-color': ROLE.swap, 'target-arrow-shape': 'triangle-backcurve', color: '#e9d5ff', 'text-border-color': ROLE.swap, opacity: 0.9 } as never },
  { selector: 'edge[kind="approval"]', style: { 'line-style': 'dashed', 'line-dash-pattern': [2, 4], 'line-color': ROLE.approval, 'target-arrow-color': ROLE.approval, 'target-arrow-shape': 'tee', width: 1.6, color: '#fed7aa', 'text-border-color': ROLE.approval, opacity: 0.95 } as never },
  {
    selector: 'edge[kind="bridge"]',
    style: { 'line-style': 'dashed', 'line-dash-pattern': [7, 4], 'line-color': '#a78bfa', 'target-arrow-color': '#a78bfa', width: 2.2, color: '#c4b5fd', opacity: 0.95 } as never,
  },
  {
    selector: 'edge[kind="corr"]',
    style: { 'line-style': 'dashed', 'line-dash-pattern': [3, 4], 'line-color': '#fbbf24', 'target-arrow-color': '#fbbf24', width: 2.2, color: '#fde68a', opacity: 0.95 } as never,
  },
  { selector: 'edge:selected', style: { 'line-color': ROLE.select, 'target-arrow-color': ROLE.select, opacity: 1, color: '#ffffff', 'text-border-color': ROLE.select } as never },
  { selector: 'edge.traced', style: { 'line-color': ROLE.trace, 'target-arrow-color': ROLE.trace, opacity: 1, 'line-style': 'solid', 'z-index': 9, width: 'data(wt)' } as never },
  { selector: 'edge.collateral', style: { 'line-color': ROLE.collateral, 'target-arrow-color': ROLE.collateral, 'line-style': 'dashed', 'line-dash-pattern': [8, 3, 2, 3], opacity: 1, 'z-index': 9, width: 'data(wt)' } as never },
  { selector: 'node.tracednode', style: { 'outline-color': ROLE.trace, 'outline-width': 2, 'outline-offset': 4, 'outline-style': 'solid' } as never },
  { selector: 'node.watched', style: { 'outline-color': '#fb7185', 'outline-width': 2, 'outline-offset': 4, 'outline-style': 'dashed' } as never },
  { selector: 'edge.truth', style: { 'line-color': ROLE.truth, 'target-arrow-color': ROLE.truth, opacity: 1, 'line-style': 'solid', 'z-index': 10, width: 'data(wt)' } as never },
  { selector: 'node.truthnode', style: { 'outline-color': ROLE.truth, 'outline-width': 2, 'outline-offset': 5, 'outline-style': 'solid' } as never },
  // Débrief : étapes du flux réel que l'enquêteur n'avait pas trouvées
  { selector: 'edge.truthmissed', style: { 'line-color': ROLE.missed, 'target-arrow-color': ROLE.missed, opacity: 1, 'line-style': 'dashed', 'line-dash-pattern': [6, 4], 'z-index': 10, width: 'data(wt)' } as never },
  { selector: 'node.truthmissed', style: { 'outline-color': ROLE.missed, 'outline-width': 2.5, 'outline-offset': 5, 'outline-style': 'dashed' } as never },
  // Étiquettes discrètes sur les gros graphes, rétablies au survol
  { selector: 'node.quiet', style: { label: '' } as never },
  { selector: 'node.quiet.hl', style: { label: 'data(label)' } as never },
  { selector: 'edge.quiet', style: { label: '' } as never },
  { selector: 'edge.quiet.hl', style: { label: 'data(label)' } as never },
  // Recherche, survol, focus, rejeu
  { selector: 'node.match', style: { 'outline-color': ROLE.match, 'outline-width': 3, 'outline-offset': 6, 'outline-style': 'solid', 'z-index': 20 } as never },
  { selector: '.faint', style: { opacity: 0.28 } },
  { selector: '.faded', style: { opacity: 0.08 } },
  { selector: '.future', style: { opacity: 0.04 } },
  { selector: '.dim', style: { opacity: 0.12 } },
]

interface Menu {
  x: number
  y: number
  key: string
}

export function GraphCanvas({ inspectorOpen = false }: { inspectorOpen?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [legend, setLegend] = useState(true)
  const [hover, setHover] = useState<{ x: number; y: number; key: string } | null>(null)
  const [vp, setVp] = useState<Viewport>({ zoom: 1, pan: { x: 0, y: 0 }, w: 0, h: 0 })
  const [replay, setReplay] = useState(false)
  const [renderTick, setRenderTick] = useState(0)
  const canUndo = useGame((s) => s.history.length > 0)
  const coverage = useGame((s) => s.coverage)
  const inst = useGame((s) => s.inst)
  const template = useGame((s) => s.template)
  const seed = useGame((s) => s.seed)
  const viewId = useGame((s) => s.viewId)
  const addrPos = useGame((s) => s.addrPos)
  const flags = useGame((s) => s.flags)
  const notes = useGame((s) => s.notes)
  const showTruth = useGame((s) => s.showTruth)
  const explored = useGame((s) => s.explored)
  const trace = useGame((s) => s.trace)
  const pathHl = useGame((s) => s.pathHighlight)
  const watch = useGame((s) => s.watch)
  const freezes = useGame((s) => s.freezes)
  const hdRevealed = useGame((s) => s.hdRevealed)
  const focusCenter = useGame((s) => s.focus)
  const selection = useGame((s) => s.selection)
  const multi = useGame((s) => s.multi)
  const layoutTick = useGame((s) => s.layoutTick)
  const minUsd = useGame((s) => s.minUsd)
  const timeRange = useUi((s) => s.timeRange)
  const opts = useGraph((s) => s.opts)
  const focus = useGraph((s) => s.focus)
  const search = useGraph((s) => s.search)
  const tool = useGraph((s) => s.tool)
  const lanes = useGraph((s) => s.lanes)
  const timeAxis = useGraph((s) => s.timeAxis)
  const pinned = useGraph((s) => s.byView[s.viewId]?.pinned)
  const w = inst?.world
  const d = useDisplay()

  // Présentation propre à chaque affaire et à chaque graphe du dossier
  useEffect(() => {
    useGraph.getState().bind(inst && template ? `${template.id}:${seed}` : null, viewId)
  }, [inst, template, seed, viewId])

  // Initialisation
  useEffect(() => {
    if (!ref.current) return
    const cy = cytoscape({
      container: ref.current, style: STYLE, wheelSensitivity: 0.3, minZoom: 0.06, maxZoom: 3.5,
      boxSelectionEnabled: true, selectionType: 'single',
    })
    cyRef.current = cy
    const g = useGame.getState
    cy.on('tap', 'node', (e: EventObject) => {
      const key = e.target.id() as string
      setMenu(null)
      if (key.startsWith('p:')) return
      if (key.startsWith('g:') || key.startsWith('n:')) g().select({ kind: 'group', key })
      else if (isAKey(key)) g().select({ kind: 'address', id: idOf(key) })
      else g().select({ kind: 'tx', id: idOf(key) })
    })
    cy.on('tap', 'edge', (e: EventObject) => {
      setMenu(null)
      const d = e.target.data()
      g().select({ kind: 'edge', source: d.source, target: d.target, txIds: d.txIds })
    })
    cy.on('tap', (e: EventObject) => {
      if (e.target !== cy) return
      setMenu(null)
      const gr = useGraph.getState()
      if (gr.tool === 'note' && e.position) {
        const p = e.position
        gr.addAnnotation({ kind: 'note', x: p.x, y: p.y, w: 200, h: 90, text: '', color: '#facc15' })
        gr.setTool('select')
        return
      }
      g().select(null)
    })
    cy.on('dbltap', 'node', (e: EventObject) => {
      const key = e.target.id() as string
      const n = e.target
      if (key.startsWith('p:')) return collapseParent(key)
      if (key.startsWith('g:') || key.startsWith('n:')) return toggleGroupNode(key, n.data('members') ?? [], { ...n.position() })
      if (isAKey(key)) g().expand(idOf(key), 'out')
      else g().revealTx(idOf(key), true)
    })
    cy.on('cxttap', 'node', (e: EventObject) => {
      const p = e.renderedPosition ?? e.target.renderedPosition()
      setMenu({ x: p.x, y: p.y, key: e.target.id() })
    })
    cy.on('dragfree', 'node', () => {
      const pos: Record<string, { x: number; y: number }> = {}
      const groups: Record<string, { x: number; y: number }> = {}
      cy.nodes().forEach((n) => {
        const k = n.id()
        if (k.startsWith('p:')) return
        if (k.startsWith('g:') || k.startsWith('n:')) groups[k] = { ...n.position() }
        else pos[k] = { ...n.position() }
      })
      g().setPositions(pos)
      if (Object.keys(groups).length) useGraph.getState().setGroupPos(groups)
    })
    const syncMulti = () => {
      const ids = cy.nodes(':selected').map((n) => n.id()).filter(isAKey).map(idOf)
      g().setMulti(ids)
    }
    cy.on('select unselect', 'node', syncMulti)
    // Fenêtre visible : les calques (annotations, couloirs, axe, mini-carte) suivent le zoom et le déplacement
    let raf = 0
    const syncVp = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (cy.destroyed()) return
        setVp({ zoom: cy.zoom(), pan: { ...cy.pan() }, w: cy.width(), h: cy.height() })
        setRenderTick((t) => t + 1)
      })
    }
    cy.on('viewport', syncVp)
    cy.on('position', 'node', syncVp)
    cy.on('add remove', syncVp)
    cy.on('pan zoom', () => {
      setMenu(null)
      setHover(null)
    })
    cy.on('mouseover', 'node', (e: EventObject) => {
      const n = e.target as NodeSingular
      const p = n.renderedPosition()
      if (n.id().startsWith('p:')) return
      setHover({ x: p.x, y: p.y, key: n.id() })
      // Surbrillance du voisinage
      const hood = n.closedNeighborhood()
      hood.addClass('hl')
      if (cy.nodes().length > 12) cy.elements().not(hood).not('node[kind="parent"]').addClass('faint')
    })
    cy.on('mouseout', 'node', () => {
      setHover(null)
      cy.elements().removeClass('hl faint')
    })
    cy.on('drag', 'node', () => setHover(null))
    // Le conteneur change de taille (frise, panneaux) : Cytoscape doit le savoir
    // sinon les clics sont décalés.
    const ro = new ResizeObserver(() => {
      cy.resize()
      syncVp()
      // Petit graphe : on le garde centré quand les panneaux s'ouvrent ou se ferment
      if (cy.nodes().length && cy.nodes().length <= 4) fitGraph(cy, 0)
    })
    ro.observe(ref.current)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      cy.destroy()
    }
  }, [])

  // Outils d'annotation : pas de sélection par cadre ni de déplacement de la vue pendant le tracé
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.boxSelectionEnabled(tool === 'select')
    cy.userPanningEnabled(tool !== 'box')
    if (ref.current) ref.current.style.cursor = tool === 'note' ? 'copy' : tool === 'box' ? 'crosshair' : ''
  }, [tool])

  // Synchronisation des éléments
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !w || !inst || !d) return
    const truthTx = new Set(showTruth ? inst.truth.path : [])
    const truthAddr = new Set(showTruth ? inst.truth.addresses : [])
    // Surimpression du traçage en cours et du chemin trouvé
    const traced = trace?.result
    const tracedTx = new Set([...(traced ? [...traced.byTx].filter(([, v]) => v > 0).map(([k]) => k) : []), ...(pathHl?.txIds ?? [])])
    const collateralTx = new Set(traced?.collateral.map((c) => c.txId) ?? [])
    const tracedAddr = (id: string) => (traced?.byAddress.get(id)?.receivedUsd ?? 0) > 0
    const seeds = new Set(inst.seeds)
    const frozen = new Set(freezes.map((f) => f.address))
    const wanted = new Set<string>()
    const wasEmpty = cy.nodes().empty()
    const prevIds = new Set(cy.nodes().map((n) => n.id()))
    const big = d.nodes.length > 60
    const sizeOf = (ids: string[], base: number) => {
      if (opts.sizeBy === 'none') return base
      let v = 0
      for (const id of ids) {
        const s = w.summary(id)
        v += opts.sizeBy === 'volume' ? s.inUsd + s.outUsd : Object.entries(s.balance).reduce((a, [as, x]) => a + usd(as as AssetId, x ?? 0), 0)
      }
      if (v <= 0) return Math.round(base * 0.78)
      return Math.round(Math.max(base * 0.8, Math.min(base * 2, base * 0.75 + Math.log10(1 + v / 50) * 7)))
    }
    const decorate = (data: Record<string, unknown>, icon: string, logo: boolean, badges: string[]) => {
      const bs = opts.badges ? badges.slice(0, 3) : []
      const pos = [['100%', '0%'], ['0%', '0%'], ['100%', '100%']]
      data.imgs = [icon, ...bs]
      data.bw = [logo ? '100%' : '46%', ...bs.map(() => '36%')]
      data.bx = ['50%', ...bs.map((_, i) => pos[i][0])]
      data.by = ['50%', ...bs.map((_, i) => pos[i][1])]
      data.bclip = [logo ? 'node' : 'none', ...bs.map(() => 'none')]
    }
    const parentColor = (gid: string) => {
      const g = useGraph.getState().view().groups.find((x) => x.id === gid)
      return g?.color ?? GROUP_COLOR[g?.kind ?? (gid.startsWith('auto:') ? 'auto' : 'manual')]
    }
    cy.batch(() => {
      // Cadres des groupes dépliés (avant leurs membres)
      for (const p of d.parents) {
        wanted.add(p.key)
        const data = { id: p.key, kind: 'parent', label: `${p.label} · ${p.members.length} adresses`, color: parentColor(p.groupId) }
        const el = cy.getElementById(p.key)
        if (el.empty()) cy.add({ group: 'nodes', data })
        else el.data(data)
      }
      for (const n of d.nodes) {
        wanted.add(n.key)
        const data = nodeData(n)
        const el = cy.getElementById(n.key)
        if (el.empty()) cy.add({ group: 'nodes', data, position: { ...n.pos } })
        else {
          if ((el.data('parent') ?? undefined) !== (data.parent ?? undefined)) el.move({ parent: (data.parent as string | undefined) ?? null })
          el.data(data)
          const cur = el.position()
          if (Math.abs(cur.x - n.pos.x) > 0.5 || Math.abs(cur.y - n.pos.y) > 0.5) el.position({ ...n.pos })
        }
        const node = cy.getElementById(n.key)
        if (n.kind === 'addr') {
          const id = n.id!
          const missedNode = !!explored && truthAddr.has(id) && !explored.addrs[id]
          node.toggleClass('truthnode', truthAddr.has(id) && !missedNode)
          node.toggleClass('truthmissed', missedNode)
          node.toggleClass('tracednode', tracedAddr(id))
          node.toggleClass('watched', watch.includes(id))
          node.toggleClass('quiet', opts.labels === 'minimal' ? !flags[id] && !attribution(w, id).entity : opts.labels === 'auto' && big && !flags[id] && !seeds.has(id) && !attribution(w, id).entity && !tracedAddr(id))
        } else if (n.kind === 'tx') node.toggleClass('tracednode', tracedTx.has(n.id!))
        else node.toggleClass('tracednode', !!n.members?.some(tracedAddr))
      }
      for (const e of d.edges) {
        wanted.add(e.id)
        const color = e.asset ? ASSETS[e.asset].color : '#b4bbc5'
        const width = e.kind === 'approval' ? 1.6 : Math.max(1.2, Math.min(8, 0.8 + Math.log10(e.usd + 1) * 0.95))
        const data = { id: e.id, source: e.source, target: e.target, color, w: width, wt: width + 1.5, label: edgeLabel(e), txIds: e.txIds, kind: e.kind, usd: e.usd, time: e.time, linkId: e.linkId }
        const el = cy.getElementById(e.id)
        if (el.empty()) cy.add({ group: 'edges', data })
        else el.data(data)
        const ed = cy.getElementById(e.id)
        const onTruth = e.txIds.some((t) => truthTx.has(t))
        const missedEdge = onTruth && !!explored && !e.txIds.some((t) => truthTx.has(t) && explored.txs[t])
        ed.toggleClass('truth', onTruth && !missedEdge)
        ed.toggleClass('truthmissed', missedEdge)
        ed.toggleClass('traced', e.txIds.some((t) => tracedTx.has(t)))
        ed.toggleClass('collateral', e.txIds.some((t) => collateralTx.has(t)))
        ed.toggleClass('quiet', opts.labels !== 'all' && big && e.kind !== 'swap' && e.kind !== 'bridge' && !e.txIds.some((t) => tracedTx.has(t)))
      }
      cy.elements().forEach((el) => {
        if (!wanted.has(el.id())) el.remove()
      })
    })

    function nodeData(n: DNode): Record<string, unknown> {
      if (n.kind === 'tx') {
        const tx = w!.tx(n.id!)
        const cj = detectCoinjoin(tx).is
        const total = tx.outputs.reduce((s, o) => s + o.value, 0)
        return { id: n.key, kind: 'tx', label: `${compact(total)} ${CHAINS[tx.chain].short}`, coinjoin: cj || undefined, ord: tx.ord ? true : undefined, time: n.time }
      }
      if (n.kind === 'group' || n.kind === 'agg') {
        const mem = n.members ?? []
        const vol = mem.reduce((s, m) => s + w!.summary(m).inUsd, 0)
        const isAgg = n.kind === 'agg'
        const gk = n.groupKind ?? 'manual'
        const entity = gk === 'auto' || gk === 'entity' ? attribution(w!, mem[0]).entity : undefined
        const color = isAgg ? '#7a8290' : n.groupId && !n.groupId.startsWith('auto:') ? parentColor(n.groupId) : entity ? CATEGORY[entity.category].color : GROUP_COLOR[gk]
        const mark = entity ? entityLogo(entity.id) : undefined
        const flagged = mem.filter((m) => flags[m]).length
        const data: Record<string, unknown> = {
          id: n.key, kind: n.kind, members: mem, time: n.time, color,
          size: isAgg ? 34 : sizeOf(mem, 60), logo: mark ? true : undefined,
          label: isAgg ? `+${mem.length} contreparties${vol ? `\n${fmtUsd(vol)}` : ''}` : `${n.groupLabel}\n${mem.length} adresses${vol ? ` · ${fmtUsd(vol)}` : ''}${flagged ? ` · ⚑ ${flagged}` : ''}`,
        }
        const badges: string[] = []
        if (pinned?.[n.key]) badges.push(badgeUri('Pin', '#b4bbc5'))
        if (mem.some((m) => watch.includes(m))) badges.push(badgeUri('Eye', '#fb7185'))
        decorate(data, mark ?? iconUri(isAgg ? 'Ellipsis' : GROUP_ICON[gk], color), !!mark, badges)
        return data
      }
      const id = n.id!
      const a = w!.get(id)
      const at = attribution(w!, id)
      const cat = at.entity ? CATEGORY[at.entity.category] : null
      const role = at.entity ? 'entity' : a.tags.includes('null') ? 'null' : a.contract ? (['pool', 'router', 'aggregator', 'wrapper', 'lending'].includes(a.contract.type) ? 'converter' : 'contract') : 'plain'
      const color = cat?.color ?? (role === 'null' ? ROLE.mint : a.contract ? '#818cf8' : '#7a8290')
      const iconName = cat?.icon ?? (role === 'null' ? 'CircleSlash' : a.contract ? CONTRACT_ICON[a.contract.type] ?? 'FileCode2' : 'Wallet')
      const mark = at.entity ? entityLogo(at.entity.id) : undefined
      const flag = flags[id] as Flag | undefined
      const name = at.label ?? (a.contract ? a.label ?? a.contract.name : null)
      const tn = traced?.byAddress.get(id)
      const taint = tn && tn.receivedUsd > 0
        ? `\n▸ ${tn.heldUsd > 0 ? 'détient' : 'reçu'} ${fmtUsd(tn.heldUsd > 0 ? tn.heldUsd : tn.receivedUsd)} · ${sharePct(tn.heldUsd > 0 ? tn.heldUsd : tn.receivedUsd, traced!.sourceUsd)}`
        : ''
      const label = (name ? `${name}\n${shortAddr(a.addr, 5)}` : shortAddr(a.addr, 6)) + taint
      const data: Record<string, unknown> = {
        id: n.key, kind: 'addr', role, label, color, logo: mark ? true : undefined, size: sizeOf([id], at.entity ? 46 : 38),
        flag: flag ?? undefined, flagColor: flag ? FLAG_META[flag].color : undefined, seed: seeds.has(id) || undefined,
        chain: CHAINS[a.chain].color, parent: n.parent, time: n.time,
      }
      const badges: string[] = []
      if (frozen.has(id)) badges.push(badgeUri('Snowflake', '#67e8f9'))
      if (watch.includes(id)) badges.push(badgeUri('Eye', '#fb7185'))
      if (pinned?.[n.key]) badges.push(badgeUri('Pin', '#b4bbc5'))
      if (a.hd && hdRevealed[a.hd.wallet]) badges.push(badgeUri('KeyRound', '#f5c451'))
      if (a.multisig) badges.push(badgeUri('ShieldCheck', '#f5c451'))
      if (notes[id]) badges.push(badgeUri('StickyNote', '#facc15'))
      decorate(data, mark ?? iconUri(iconName, color), !!mark, badges)
      return data
    }

    // Nouveaux nœuds hors champ : on recadre pour les montrer
    const added = cy.nodes().filter((n) => !prevIds.has(n.id()) && !n.id().startsWith('p:'))
    if (!wasEmpty && added.nonempty()) {
      const ext = cy.extent()
      const bb = added.boundingBox()
      if (bb.x1 < ext.x1 || bb.x2 > ext.x2 || bb.y1 < ext.y1 || bb.y2 > ext.y2) {
        const z = cy.zoom()
        cy.animate({ fit: { eles: added.union(cy.nodes(':selected')), padding: 90 } }, {
          duration: 380,
          complete: () => {
            if (!cy.destroyed() && cy.zoom() > Math.max(z, 1)) cy.animate({ zoom: { level: Math.max(z, 1), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } } }, { duration: 150 })
          },
        })
      }
    }
    if (wasEmpty && cy.nodes().nonempty()) {
      // Attendre la mise en page des panneaux avant de cadrer
      requestAnimationFrame(() => {
        if (cy.destroyed()) return
        cy.resize()
        cy.fit(cy.nodes(), 120)
        if (cy.zoom() > 1.1) cy.zoom({ level: 1.1, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
        cy.center(cy.nodes())
      })
    }
  }, [w, inst, d, flags, notes, showTruth, explored, trace, pathHl, watch, freezes, hdRevealed, opts, pinned])

  // Animation après réorganisation
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !layoutTick) return
    fitGraph(cy, 450)
  }, [layoutTick])

  // Centrage demandé
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !focusCenter) return
    const el = cy.getElementById(focusCenter.key)
    if (el.empty()) return
    cy.animate({ center: { eles: el }, zoom: Math.max(cy.zoom(), 0.85) }, { duration: 350 })
  }, [focusCenter])

  // Sélection externe → graphe
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !selection) return
    const key = selection.kind === 'address' ? d?.shownAs.get(selection.id) ?? aKey(selection.id) : selection.kind === 'tx' ? tKey(selection.id) : selection.kind === 'group' ? selection.key : null
    if (!key) return
    const el = cy.getElementById(key)
    if (!el.empty() && !el.selected()) {
      cy.nodes(':selected').unselect()
      el.select()
    }
  }, [selection, d])

  // Filtre temporel (frise) et montant minimal
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !w) return
    cy.batch(() => {
      cy.elements().removeClass('dim')
      if (!timeRange && !minUsd) return
      cy.edges().forEach((e) => {
        const ids: string[] = e.data('txIds') ?? []
        const inRange = !timeRange || ids.some((t) => {
          const tm = w.txs.get(t)?.time ?? 0
          return tm >= timeRange[0] && tm <= timeRange[1]
        })
        const bigEnough = !minUsd || e.data('kind') === 'io' || e.data('kind') === 'approval' || (e.data('usd') ?? 0) >= minUsd
        if (!inRange || !bigEnough) e.addClass('dim')
      })
      if (timeRange) {
        cy.nodes('[kind="tx"]').forEach((n) => {
          const tm = w.txs.get(idOf(n.id()))?.time ?? 0
          if (tm < timeRange[0] || tm > timeRange[1]) n.addClass('dim')
        })
      }
    })
  }, [timeRange, minUsd, w, d])

  // Mode focus : voisinage à N sauts
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.elements().removeClass('faded')
      if (!focus) return
      const start = cy.getElementById(focus.key)
      if (start.empty()) return
      let set = start.union(start.parent())
      let frontier = start
      for (let i = 0; i < focus.hops; i++) {
        // Une transaction UTXO ne compte pas comme un saut : on la traverse
        let next = frontier.neighborhood('node')
        next = next.union(next.filter('[kind="tx"]').neighborhood('node'))
        frontier = next.difference(set) as typeof frontier
        set = set.union(next)
      }
      const nodes = set.union(set.parent())
      cy.nodes().not(nodes).addClass('faded')
      cy.edges().forEach((e) => {
        if (!nodes.contains(e.source()) || !nodes.contains(e.target())) e.addClass('faded')
      })
    })
  }, [focus, d])

  // Recherche dans le graphe
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || !w || !d) return [] as string[]
    const num = Number(q.replace(',', '.').replace(/\s/g, ''))
    const out: string[] = []
    for (const n of d.nodes) {
      if (n.kind === 'addr') {
        const a = w.get(n.id!)
        if (a.addr.toLowerCase().includes(q) || (attribution(w, n.id!).label ?? a.label ?? '').toLowerCase().includes(q)) out.push(n.key)
      } else if (n.kind === 'tx') {
        if (w.tx(n.id!).hash.toLowerCase().includes(q)) out.push(n.key)
      } else if ((n.groupLabel ?? '').toLowerCase().includes(q) || n.members?.some((m) => w.get(m).addr.toLowerCase().includes(q))) out.push(n.key)
    }
    if (Number.isFinite(num) && num > 0 && /^[\d\s.,]+$/.test(q)) {
      for (const e of d.edges) if (e.value > 0 && Math.abs(e.value - num) / num < 0.01) out.push(e.source, e.target)
    }
    return [...new Set(out)]
  }, [search, w, d])
  const matchIdx = useRef(0)
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.nodes().removeClass('match')
      for (const k of matches) cy.getElementById(k).addClass('match')
    })
    matchIdx.current = 0
  }, [matches, d])
  const nextMatch = useCallback(() => {
    const cy = cyRef.current
    if (!cy || !matches.length) return
    const el = cy.getElementById(matches[matchIdx.current % matches.length])
    matchIdx.current++
    if (!el.empty()) cy.animate({ center: { eles: el }, zoom: Math.max(cy.zoom(), 0.9) }, { duration: 300 })
  }, [matches])

  const legendCats = useMemo(() => {
    if (!w) return []
    const s = new Map<string, number>()
    for (const id of Object.keys(addrPos)) {
      const at = attribution(w, id)
      const k = at.entity?.category ?? (w.get(id).contract ? '__contract' : '__unknown')
      s.set(k, (s.get(k) ?? 0) + 1)
    }
    return [...s.entries()]
  }, [w, addrPos])
  const edgeKinds = useMemo(() => new Set(d?.edges.map((e) => e.kind) ?? []), [d])

  const cy = () => cyRef.current
  ;(window as unknown as { __spectraCy?: () => Core | null }).__spectraCy = cy
  const selKeys = () => (cy()?.nodes(':selected').map((n) => n.id()) ?? []).filter((k) => !k.startsWith('p:'))
  const positionsOf = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, { ...cy()!.getElementById(k).position() }]))
  const multiCount = Math.max(multi.length, selection?.kind === 'group' ? 1 : 0)

  return (
    <div className="relative h-full w-full grid-bg" onContextMenu={(e) => e.preventDefault()}>
      {opts.mode === 'lanes' && lanes.length > 0 && <LanesLayer lanes={lanes} vp={vp} />}
      <div ref={ref} className="absolute inset-0" />
      {(opts.mode === 'time' || opts.mode === 'lanes') && timeAxis && <TimeAxis axis={timeAxis} vp={vp} />}
      <AnnotationsLayer vp={vp} />
      {tool === 'box' && <BoxDrawer vp={vp} />}

      <GraphTopBar matches={matches.length} onNextMatch={nextMatch} hidden={d ? { converters: d.hiddenConverters, aggregated: d.aggregated } : undefined} />

      {(timeRange || minUsd > 0 || coverage === 'partial' || trace || pathHl || focus) && (
        <div className="absolute top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-850 px-2 py-1.5 text-meta shadow-panel" style={{ left: inspectorOpen ? 'calc((100% - 392px) / 2 + 180px)' : 'calc(50% + 180px)' }}>
          <Icon name="ListFilter" size={12} className="text-accent" />
          {focus && (
            <span className="chip bg-accent/15 text-accent">
              <Icon name="Focus" size={10} className="mr-0.5 inline" /> Focus
              <button className="px-1 hover:text-white" title="Un saut de moins" onClick={() => useGraph.getState().setFocus({ ...focus, hops: Math.max(1, focus.hops - 1) })}>−</button>
              {focus.hops} saut{focus.hops > 1 ? 's' : ''}
              <button className="px-1 hover:text-white" title="Un saut de plus" onClick={() => useGraph.getState().setFocus({ ...focus, hops: Math.min(6, focus.hops + 1) })}>+</button>
              <button title="Quitter le focus" onClick={() => useGraph.getState().setFocus(null)}><Icon name="X" size={10} /></button>
            </span>
          )}
          {timeRange && (
            <button className="chip bg-accent/15 text-accent hover:bg-accent/25" title="Retirer le filtre de période" onClick={() => useUi.getState().setTimeRange(null)}>
              Période filtrée <Icon name="X" size={10} />
            </button>
          )}
          {minUsd > 0 && (
            <button className="chip bg-accent/15 text-accent hover:bg-accent/25" title="Retirer le filtre de montant" onClick={() => useGame.getState().setMinUsd(0)}>
              ≥ {fmtUsd(minUsd)} <Icon name="X" size={10} />
            </button>
          )}
          {trace && (
            <span className="chip bg-teal-400/15 text-teal-200">
              <button className="hover:text-white" title="Ouvrir le traçage" onClick={() => useUi.getState().set({ tracer: { open: true } })}>
                <Icon name="Route" size={10} className="mr-1 inline" />Traçage {TRACE_METHODS[trace.opts.method].short} · {fmtUsd(trace.result.sourceUsd)}
              </button>
              <button title="Effacer le traçage" onClick={() => useGame.getState().clearTrace()}><Icon name="X" size={10} /></button>
            </span>
          )}
          {pathHl && !trace && (
            <button className="chip bg-teal-400/15 text-teal-200 hover:bg-teal-400/25" title="Effacer le chemin surligné" onClick={() => useGame.getState().clearTrace()}>
              Chemin surligné <Icon name="X" size={10} />
            </button>
          )}
          {coverage === 'partial' && <span className="chip bg-orange-500/15 text-orange-300" title="Une partie des adresses de dépôt n'est pas étiquetée dans ce mode">Attribution partielle</span>}
        </div>
      )}

      {/* Commandes du graphe, en bas à gauche */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col items-start gap-2" style={{ maxWidth: inspectorOpen ? 'calc(100% - 410px)' : 'calc(100% - 24px)' }}>
        {legend && legendCats.length > 0 && (
          <div className="flex max-w-[720px] flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-meta text-ink-200 shadow-panel animate-fadein">
            <LegendShape kind="victim" label="Victime" />
            <LegendShape kind="suspect" label="Suspect" />
            <LegendShape kind="tx" label="Transaction" />
            {legendCats.map(([k, n]) => {
              const m = k === '__unknown' ? { label: 'Non attribuée', color: '#7a8290', icon: 'Wallet' } : k === '__contract' ? { label: 'Smart contract', color: '#818cf8', icon: 'FileCode2' } : CATEGORY[k as keyof typeof CATEGORY]
              return (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={`grid h-4 w-4 place-items-center border-[1.5px] ${k === '__unknown' ? 'rounded-full' : 'rounded'}`} style={{ borderColor: m.color }}>
                    <Icon name={m.icon} size={9} color={m.color} />
                  </span>
                  {m.label} <span className="font-mono text-ink-400">{n}</span>
                </span>
              )
            })}
            {d && d.nodes.some((n) => n.kind === 'group') && <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-[3px] border-[3px] border-double border-accent" /> Groupe replié</span>}
            {d && d.nodes.some((n) => n.kind === 'agg') && <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full border border-dashed border-ink-400" /> Contreparties réunies</span>}
            <span className="flex items-center gap-1.5 text-ink-300"><span className="h-[3px] w-5 rounded-full bg-ink-300" /> épaisseur = montant</span>
            {edgeKinds.has('swap') && <LegendLine color={ROLE.swap} label="Conversion (swap)" />}
            {edgeKinds.has('internal') && <LegendLine color={ROLE.internal} label="Transaction interne" dash="4 3" />}
            {(edgeKinds.has('mint') || edgeKinds.has('burn')) && <LegendLine color={ROLE.mint} label="Mint / burn" dash="1 3" />}
            {edgeKinds.has('approval') && <LegendLine color={ROLE.approval} label="Autorisation" dash="2 3" />}
            {edgeKinds.has('bridge') && <LegendLine color="#a78bfa" label="Bridge" dash="6 3" />}
            {(trace?.result.collateral.length ?? 0) > 0 && <LegendLine color={ROLE.collateral} label="Lien de garantie" dash="7 2 2 2" />}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border border-ink-600 bg-ink-850 p-1 shadow-panel">
            <ToolBtn icon="Maximize" title="Ajuster la vue — F" onClick={() => cy() && fitGraph(cy()!)} />
            <ToolBtn icon="ZoomIn" title="Zoom avant" onClick={() => cy()?.animate({ zoom: { level: cy()!.zoom() * 1.3, renderedPosition: { x: ref.current!.clientWidth / 2, y: ref.current!.clientHeight / 2 } } }, { duration: 150 })} />
            <ToolBtn icon="ZoomOut" title="Zoom arrière" onClick={() => cy()?.animate({ zoom: { level: cy()!.zoom() / 1.3, renderedPosition: { x: ref.current!.clientWidth / 2, y: ref.current!.clientHeight / 2 } } }, { duration: 150 })} />
            <ToolBtn icon="Network" title={`Réorganiser (${opts.mode === 'layers' ? 'couches gauche → droite' : opts.mode === 'time' ? 'chronologique' : 'couloirs par chaîne'}) — L`} onClick={() => useGame.getState().relayout()} />
            <ToolBtn icon="Undo2" title={canUndo ? 'Annuler la dernière opération — Ctrl Z' : 'Rien à annuler'} disabled={!canUndo} onClick={() => useGame.getState().undo()} />
            <span className="mx-0.5 my-1 w-px bg-ink-600" />
            <ToolBtn icon="Play" title="Rejouer le flux dans le temps" active={replay} onClick={() => setReplay((v) => !v)} />
            <ToolBtn icon="Shapes" title="Légende" active={legend} onClick={() => setLegend((v) => !v)} />
            <ExportMenu cyRef={cyRef} />
            <ToolBtn icon="Eraser" title="Réinitialiser le graphe" onClick={() => confirm('Réinitialiser le graphe ? (les marquages et réponses sont conservés)') && useGame.getState().clearGraph()} />
          </div>
          {multiCount >= 2 && (
            <div className="flex gap-0.5 rounded-lg border border-accent/40 bg-ink-850 p-1 shadow-panel animate-fadein">
              <ToolBtn icon="Group" title="Grouper la sélection — G" onClick={groupSelection} />
              <ToolBtn icon="AlignHorizontalJustifyCenter" title="Aligner horizontalement" onClick={() => alignNodes(selKeys(), 'h', positionsOf(selKeys()))} />
              <ToolBtn icon="AlignVerticalJustifyCenter" title="Aligner verticalement" onClick={() => alignNodes(selKeys(), 'v', positionsOf(selKeys()))} />
              <ToolBtn icon="AlignHorizontalSpaceAround" title="Répartir horizontalement" onClick={() => alignNodes(selKeys(), 'dh', positionsOf(selKeys()))} />
              <ToolBtn icon="AlignVerticalSpaceAround" title="Répartir verticalement" onClick={() => alignNodes(selKeys(), 'dv', positionsOf(selKeys()))} />
              <ToolBtn icon="LayoutDashboard" title="Réorganiser la sélection seulement" onClick={() => relayoutGraph(new Set(selKeys()))} />
            </div>
          )}
          <label className="flex h-[42px] items-center gap-2 rounded-lg border border-ink-600 bg-ink-850 px-3 text-meta text-ink-300 shadow-panel">
            <Icon name="Filter" size={14} />
            Montant min.
            <select className="rounded-md border border-ink-600 bg-ink-950 px-1.5 py-1 font-mono text-meta text-ink-100 outline-none focus:border-accent" value={minUsd} onChange={(e) => useGame.getState().setMinUsd(Number(e.target.value))}>
              {[0, 10, 100, 500, 1000, 5000, 20000].map((v) => (
                <option key={v} value={v}>{v === 0 ? 'aucun' : `≥ ${fmtUsd(v)}`}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {opts.minimap && d && d.nodes.length > 8 && vp.w - (inspectorOpen ? 404 : 0) > 760 && <Minimap cyRef={cyRef} tick={renderTick} right={inspectorOpen ? 404 : 12} />}
      {replay && <ReplayBar cyRef={cyRef} edgesTick={d} onClose={() => setReplay(false)} inspectorOpen={inspectorOpen} />}

      {Object.keys(addrPos).length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-xl border border-ink-600 bg-ink-850 text-ink-200">
              <Icon name="Crosshair" size={24} strokeWidth={1.75} />
            </div>
            <div className="text-title font-semibold text-white">Graphe vide</div>
            <div className="mx-auto mt-1.5 max-w-xs text-dense leading-relaxed text-ink-300">Cliquez une adresse dans les pièces du dossier, ou recherchez-la avec <span className="kbd">Ctrl K</span>.</div>
          </div>
        </div>
      )}

      {menu && <NodeMenu menu={menu} onClose={() => setMenu(null)} cyRef={cyRef} />}
      {hover && !menu && w && <NodeTooltip hover={hover} />}
    </div>
  )
}

const CONTRACT_ICON: Record<string, string> = {
  router: 'Route', pool: 'Droplets', aggregator: 'Shuffle', wrapper: 'Package', lending: 'Landmark', forwarder: 'Inbox', factory: 'Factory',
  splitter: 'Split', token: 'Coins', bridge: 'Waypoints', mixer: 'Blend', multisig: 'ShieldCheck', exploit: 'Bug', escrow: 'Lock', vault: 'Vault', nft: 'Image',
}

function ToolBtn({ icon, title, onClick, active, disabled }: { icon: string; title: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button title={title} aria-label={title} aria-pressed={active} disabled={disabled} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-md transition-colors disabled:opacity-35 ${active ? 'bg-ink-700 text-white' : 'text-ink-300 hover:bg-ink-700 hover:text-white'}`}>
      <Icon name={icon} size={16} strokeWidth={1.75} />
    </button>
  )
}
export { ToolBtn }

function LegendShape({ kind, label }: { kind: 'victim' | 'suspect' | 'tx'; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {kind === 'victim' && <span className="grid h-4 w-4 place-items-center rounded-full border-[1.5px]" style={{ borderColor: ROLE.victim }}><span className="h-2 w-2 rounded-full border" style={{ borderColor: ROLE.victim }} /></span>}
      {kind === 'suspect' && <span className="mx-0.5 h-3 w-3 rotate-45 rounded-[2px] border-[1.5px]" style={{ borderColor: ROLE.suspect, background: '#33200f' }} />}
      {kind === 'tx' && <span className="mx-0.5 h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-ink-400 bg-ink-700" />}
      {label}
    </span>
  )
}

function LegendLine({ color, label, dash }: { color: string; label: string; dash?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="22" height="6"><line x1="1" y1="3" x2="21" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" /></svg>
      {label}
    </span>
  )
}

function NodeMenu({ menu, onClose, cyRef }: { menu: Menu; onClose: () => void; cyRef: React.RefObject<Core | null> }) {
  const g = useGame.getState()
  const inst = useGame((s) => s.inst)
  const flags = useGame((s) => s.flags)
  const pinned = useGraph((s) => s.byView[s.viewId]?.pinned ?? {})
  const boxRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: menu.x + 12, y: menu.y - 10 })
  // Garde le menu dans la zone visible et le ferme au clic extérieur
  useEffect(() => {
    const box = boxRef.current
    const parent = box?.parentElement
    if (box && parent) {
      const maxX = parent.clientWidth - box.offsetWidth - 8
      const maxY = parent.clientHeight - box.offsetHeight - 8
      setPos({ x: Math.max(8, Math.min(menu.x + 12, maxX)), y: Math.max(8, Math.min(menu.y - 10, maxY)) })
    }
    const close = () => onClose()
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [menu, onClose])
  if (!inst) return null
  const w = inst.world
  const key = menu.key
  const gr = useGraph.getState()
  const item = (icon: string, text: string, fn: () => void, color?: string) => (
    <button
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-dense text-ink-100 hover:bg-ink-700"
      onClick={() => {
        fn()
        onClose()
      }}
    >
      <Icon name={icon} size={14} color={color} className={color ? '' : 'text-ink-300'} />
      {text}
    </button>
  )
  const sep = <div className="mx-2 my-1 h-px bg-ink-700" />
  const common = (
    <>
      {item('Focus', 'Focus sur le voisinage', () => gr.setFocus({ key, hops: 2 }), '#7ea6ff')}
      {item(pinned[key] ? 'PinOff' : 'Pin', pinned[key] ? 'Désépingler' : 'Épingler (garde sa place)', () => gr.togglePin(key))}
    </>
  )
  let body: React.ReactNode
  if (key.startsWith('p:')) {
    body = (
      <>
        <div className="truncate px-2.5 pb-1.5 pt-1 text-micro text-ink-300">Groupe déplié</div>
        {item('Minimize2', 'Replier le groupe', () => collapseParent(key))}
        {item('Ungroup', 'Dissoudre le groupe', () => dissolveGroup(key), '#fb7185')}
      </>
    )
  } else if (key.startsWith('g:') || key.startsWith('n:')) {
    const el = cyRef.current?.getElementById(key)
    const members: string[] = el?.data('members') ?? []
    const p = el && !el.empty() ? { ...el.position() } : { x: 0, y: 0 }
    body = (
      <>
        <div className="truncate px-2.5 pb-1.5 pt-1 text-micro text-ink-300">{key.startsWith('n:') ? `${members.length} contreparties réunies` : `Groupe · ${members.length} adresses`}</div>
        {item('Maximize2', 'Déplier', () => toggleGroupNode(key, members, p))}
        {common}
        {key.startsWith('g:') && item('PenLine', 'Renommer', () => {
          const gid = key.slice(2)
          const cur = gr.view().groups.find((x) => x.id === gid)
          const name = prompt('Nouveau nom du groupe', cur?.label ?? '')
          if (name && cur) gr.updateGroup(gid, { label: name.trim() })
        })}
        {key.startsWith('g:') && item('Ungroup', 'Dissoudre le groupe', () => dissolveGroup(key), '#fb7185')}
        {sep}
        {item('Trash2', 'Retirer ces adresses du graphe', () => g.removeNodes(members.map(aKey)))}
      </>
    )
  } else if (isAKey(key)) {
    const id = idOf(key)
    const a = w.get(id)
    const at = attribution(w, id)
    const clusterSize = clusterOf(w, id).filter((m) => g.addrPos[m]).length
    body = (
      <>
        <div className="truncate px-2.5 pb-1.5 pt-1 font-mono text-micro text-ink-300">{shortAddr(a.addr, 10)}</div>
        {item('ArrowUpRight', 'Déplier les sorties', () => g.expand(id, 'out'))}
        {item('ArrowDownLeft', 'Déplier les entrées', () => g.expand(id, 'in'))}
        {item('Route', 'Tracer les fonds reçus', () => openTracer({ address: id }), '#2dd4bf')}
        {g.multi.length === 2 && g.multi.includes(id) && item('Waypoints', 'Chemin entre les 2 adresses sélectionnées', findPathFromSelection, '#2dd4bf')}
        {CHAINS[a.chain].model === 'utxo' && item('ListTree', 'Suivre la peel chain', () => openPeel(id), '#2dd4bf')}
        {poolDeposits(w, id).length > 0 && item('ScanSearch', 'Démixer ses dépôts dans un pool', () => openDemix(id), '#fb7185')}
        {CHAINS[a.chain].model === 'utxo' && item('Network', 'Ajouter le cluster', () => {
          const members = clusterOf(w, id).filter((m) => m !== id).slice(0, 25)
          members.forEach((m) => useGame.getState().addAddress(m, menu.key, 1))
        })}
        {sep}
        {common}
        {CHAINS[a.chain].model === 'utxo' && clusterSize >= 2 && item('Boxes', a.stake ? 'Grouper par clé de staking' : 'Grouper le cluster', () => groupCluster(id), '#f59e0b')}
        {at.entity && item('Building2', `Grouper les adresses ${at.entity.name}`, () => groupEntity(id), '#22d3ee')}
        {g.multi.length >= 2 && g.multi.includes(id) && item('Group', `Grouper les ${g.multi.length} adresses sélectionnées`, groupSelection, '#7ea6ff')}
        {sep}
        {(Object.keys(FLAG_META) as Flag[]).map((f) => (
          <div key={f}>{item(flags[id] === f ? 'CircleCheck' : 'Flag', `${flags[id] === f ? 'Retirer' : 'Marquer'} : ${FLAG_META[f].label}`, () => g.flag(id, flags[id] === f ? null : f), FLAG_META[f].color)}</div>
        ))}
        {sep}
        {item(g.watch.includes(id) ? 'EyeOff' : 'Eye', g.watch.includes(id) ? 'Ne plus surveiller' : 'Surveiller l\'adresse', () => g.toggleWatch(id), '#fb7185')}
        {item('Copy', 'Copier l\'adresse', () => navigator.clipboard?.writeText(a.addr).catch(() => undefined))}
        {item('Trash2', 'Retirer du graphe', () => g.removeNode(key))}
      </>
    )
  } else {
    const id = idOf(key)
    body = (
      <>
        <div className="truncate px-2.5 pb-1.5 pt-1 font-mono text-micro text-ink-300">{shortAddr(w.tx(id).hash, 10)}</div>
        {item('Maximize2', 'Afficher toutes les entrées/sorties', () => g.revealTx(id, true))}
        {item('Route', 'Tracer depuis cette transaction', () => {
          g.select({ kind: 'tx', id })
          openTracerFromSelection()
        }, '#2dd4bf')}
        {common}
        {item('Copy', 'Copier le hash', () => navigator.clipboard?.writeText(w.tx(id).hash).catch(() => undefined))}
        {item('Trash2', 'Retirer du graphe', () => g.removeNode(key))}
      </>
    )
  }
  return (
    <div ref={boxRef} role="menu" className="absolute z-30 max-h-[80%] w-72 overflow-y-auto rounded-xl border border-ink-600 bg-ink-850 p-1.5 shadow-pop animate-fadein" style={{ left: pos.x, top: pos.y }} onMouseDown={(e) => e.stopPropagation()}>
      {body}
    </div>
  )
}

function NodeTooltip({ hover }: { hover: { x: number; y: number; key: string } }) {
  const inst = useGame((s) => s.inst)
  const flag = useGame((s) => (isAKey(hover.key) ? s.flags[idOf(hover.key)] : undefined))
  const note = useGame((s) => s.notes[idOf(hover.key)])
  if (!inst) return null
  const w = inst.world
  const id = idOf(hover.key)
  let body: React.ReactNode
  if (hover.key.startsWith('g:') || hover.key.startsWith('n:')) {
    const el = (window as unknown as { __spectraCy?: () => Core | null }).__spectraCy?.()?.getElementById(hover.key)
    const members: string[] = el?.data('members') ?? []
    const inUsd = members.reduce((s, m) => s + w.summary(m).inUsd, 0)
    const outUsd = members.reduce((s, m) => s + w.summary(m).outUsd, 0)
    body = (
      <>
        <div className="text-meta font-semibold text-white">{String(el?.data('label') ?? '').split('\n')[0]}</div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 text-micro">
          <span className="text-ink-400">Adresses</span>
          <span className="text-right font-mono text-ink-100">{members.length}</span>
          <span className="text-ink-400">Reçu</span>
          <span className="text-right font-mono text-emerald-300">{fmtUsd(inUsd)}</span>
          <span className="text-ink-400">Envoyé</span>
          <span className="text-right font-mono text-rose-300">{fmtUsd(outUsd)}</span>
        </div>
        <div className="mt-1 text-micro text-ink-400">Double-clic pour déplier</div>
      </>
    )
  } else if (isAKey(hover.key)) {
    if (!w.addresses.has(id)) return null
    const a = w.get(id)
    const at = attribution(w, id)
    const sum = w.summary(id)
    body = (
      <>
        <div className="text-meta font-semibold text-white">{at.label ?? (a.contract ? a.label ?? a.contract.name : 'Adresse non attribuée')}</div>
        <div className="mt-0.5 break-all font-mono text-micro text-ink-300">{a.addr}</div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 text-micro">
          <span className="text-ink-400">Reçu</span>
          <span className="text-right font-mono text-emerald-300">{fmtUsd(sum.inUsd)}</span>
          <span className="text-ink-400">Envoyé</span>
          <span className="text-right font-mono text-rose-300">{fmtUsd(sum.outUsd)}</span>
          <span className="text-ink-400">Transactions</span>
          <span className="text-right font-mono text-ink-100">{sum.txCount}</span>
        </div>
        {flag && <div className="mt-1 text-micro" style={{ color: FLAG_META[flag].color }}>⚑ {FLAG_META[flag].label}</div>}
        {note && <div className="mt-1 line-clamp-2 text-micro italic text-ink-300">{note}</div>}
      </>
    )
  } else {
    if (!w.txs.has(id)) return null
    const tx = w.tx(id)
    body = (
      <>
        <div className="text-meta font-semibold text-white">Transaction {CHAINS[tx.chain].short}</div>
        <div className="mt-0.5 font-mono text-micro text-ink-300">{shortAddr(tx.hash, 12)}</div>
        <div className="mt-1 text-micro text-ink-300">{tx.inputs.length} entrée(s) → {tx.outputs.length} sortie(s) · {fmtUsd(w.txUsd(tx))}</div>
        <div className="text-micro text-ink-400">{new Date(tx.time * 1000).toLocaleString('fr-FR')}</div>
      </>
    )
  }
  return (
    <div className="pointer-events-none absolute z-20 max-w-[260px] rounded-lg panel-solid px-2.5 py-2 shadow-panel" style={{ left: hover.x + 22, top: hover.y + 12 }}>
      {body}
    </div>
  )
}
