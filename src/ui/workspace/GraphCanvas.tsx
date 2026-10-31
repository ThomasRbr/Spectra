import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import cytoscape, { type Core, type EventObject } from 'cytoscape'
import { icons } from 'lucide-react'
import { CHAINS, ASSETS, fmtUsd } from '../../engine/chains'
import { CATEGORY } from '../../engine/entities'
import { attribution, clusterOf, detectCoinjoin } from '../../engine/analysis'
import { shortAddr } from '../../engine/addressgen'
import { useGame, FLAG_META, type Flag } from '../../store/game'
import { useUi } from '../../store/ui'
import { aKey, computeEdges, extraLinks, idOf, isAKey, tKey } from '../../lib/graph'
import { Icon } from '../common'
import { entityLogo } from '../logos'
import { findPathFromSelection, openTracer, openTracerFromSelection } from './Tracer'
import { openPeel } from './Heuristics'
import { openDemix } from './Demix'
import { poolDeposits } from '../../engine/demix'
import { TRACE_METHODS } from '../../engine/tracing'

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
// suspect en losange, service en carré avec son logo, contrat en hexagone),
// la couleur de l'arête dit l'actif, son épaisseur le montant.
const ROLE = { victim: '#5ec8e5', suspect: '#ff8a4c', select: '#7ea6ff', trace: '#3fc7a4', truth: '#f3f5f7', missed: '#f97316' }

const STYLE: cytoscape.Stylesheet[] = [
  {
    selector: 'node[kind="addr"]',
    style: {
      width: 'data(size)', height: 'data(size)', shape: 'ellipse',
      'background-color': '#1b1f25', 'border-width': 2, 'border-color': 'data(color)',
      'background-image': 'data(icon)', 'background-width': '46%', 'background-height': '46%',
      label: 'data(label)', color: '#dfe3e8', 'font-size': 10.5, 'font-family': 'Inter', 'font-weight': 500,
      'text-valign': 'bottom', 'text-margin-y': 7, 'text-wrap': 'wrap', 'text-max-width': '160px', 'line-height': 1.35,
      'text-background-color': '#0e1013', 'text-background-opacity': 0.88, 'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle',
      'transition-property': 'border-width, border-color, opacity', 'transition-duration': 0.15,
      'min-zoomed-font-size': 7,
    } as never,
  },
  // Service attribué : carré arrondi ; le logo de marque remplit la forme.
  { selector: 'node[role="entity"]', style: { shape: 'round-rectangle' } as never },
  { selector: 'node[kind="addr"][?logo]', style: { 'background-width': '100%', 'background-height': '100%', 'background-clip': 'node', 'border-width': 2.5 } as never },
  { selector: 'node[role="contract"]', style: { shape: 'round-hexagon' } as never },
  // Marquages : forme et couleur de rôle, en plus du libellé.
  { selector: 'node[flag="suspect"]', style: { shape: 'round-diamond', 'border-color': ROLE.suspect, 'border-width': 2.5, 'background-color': '#33200f' } as never },
  { selector: 'node[flag="victim"]', style: { 'border-color': ROLE.victim, 'border-style': 'double', 'border-width': 6, 'background-color': '#10262d' } as never },
  { selector: 'node[flag="interest"]', style: { 'border-color': '#facc15', 'border-width': 2.5 } as never },
  { selector: 'node[flag="service"]', style: { shape: 'round-rectangle', 'border-color': '#b4bbc5' } as never },
  { selector: 'node[flag="dead-end"]', style: { 'border-style': 'dashed', 'border-color': '#7a8290', opacity: 0.75 } as never },
  { selector: 'node[?seed]', style: { 'outline-color': '#5d6572', 'outline-width': 1.5, 'outline-offset': 4, 'outline-style': 'solid' } as never },
  {
    selector: 'node[kind="tx"]',
    style: {
      width: 14, height: 14, shape: 'round-rectangle', 'background-color': '#23272e', 'border-width': 1.5, 'border-color': '#5d6572',
      label: 'data(label)', color: '#959da9', 'font-size': 8.5, 'font-family': 'JetBrains Mono', 'text-valign': 'top', 'text-margin-y': -5,
      'min-zoomed-font-size': 8,
    } as never,
  },
  { selector: 'node[kind="tx"][?coinjoin]', style: { 'border-color': '#fb7185', 'background-color': '#3b1520', width: 20, height: 20 } },
  { selector: 'node:selected', style: { 'outline-color': ROLE.select, 'outline-width': 2, 'outline-offset': 5, 'outline-style': 'solid', color: '#ffffff' } as never },
  {
    selector: 'edge',
    style: {
      'curve-style': 'bezier', width: 'data(w)', 'line-color': 'data(color)', 'target-arrow-shape': 'triangle',
      'target-arrow-color': 'data(color)', 'arrow-scale': 0.7, opacity: 0.72, 'line-cap': 'round',
      label: 'data(label)', 'font-size': 9, 'font-family': 'JetBrains Mono', color: '#b4bbc5',
      'text-rotation': 'autorotate', 'text-background-color': '#15181d', 'text-background-opacity': 0.95,
      'text-background-padding': '2px', 'text-background-shape': 'roundrectangle',
      'text-border-width': 1, 'text-border-color': '#2f353e', 'text-border-opacity': 1,
      'min-zoomed-font-size': 8,
    } as never,
  },
  { selector: 'edge[kind="io"]', style: { 'curve-style': 'straight', label: '' } },
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
  { selector: 'node.tracednode', style: { 'outline-color': ROLE.trace, 'outline-width': 2, 'outline-offset': 4, 'outline-style': 'solid' } as never },
  { selector: 'node.watched', style: { 'outline-color': '#fb7185', 'outline-width': 2, 'outline-offset': 4, 'outline-style': 'dashed' } as never },
  { selector: 'edge.truth', style: { 'line-color': ROLE.truth, 'target-arrow-color': ROLE.truth, opacity: 1, 'line-style': 'solid', 'z-index': 10, width: 'data(wt)' } as never },
  { selector: 'node.truthnode', style: { 'outline-color': ROLE.truth, 'outline-width': 2, 'outline-offset': 5, 'outline-style': 'solid' } as never },
  // Débrief : étapes du flux réel que l'enquêteur n'avait pas trouvées
  { selector: 'edge.truthmissed', style: { 'line-color': ROLE.missed, 'target-arrow-color': ROLE.missed, opacity: 1, 'line-style': 'dashed', 'line-dash-pattern': [6, 4], 'z-index': 10, width: 'data(wt)' } as never },
  { selector: 'node.truthmissed', style: { 'outline-color': ROLE.missed, 'outline-width': 2.5, 'outline-offset': 5, 'outline-style': 'dashed' } as never },
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
  const links = useGame((s) => s.links)
  const canUndo = useGame((s) => s.history.length > 0)
  const coverage = useGame((s) => s.coverage)
  const inst = useGame((s) => s.inst)
  const addrPos = useGame((s) => s.addrPos)
  const txPos = useGame((s) => s.txPos)
  const revealed = useGame((s) => s.revealed)
  const flags = useGame((s) => s.flags)
  const showTruth = useGame((s) => s.showTruth)
  const explored = useGame((s) => s.explored)
  const trace = useGame((s) => s.trace)
  const pathHl = useGame((s) => s.pathHighlight)
  const watch = useGame((s) => s.watch)
  const focus = useGame((s) => s.focus)
  const selection = useGame((s) => s.selection)
  const layoutTick = useGame((s) => s.layoutTick)
  const minUsd = useGame((s) => s.minUsd)
  const timeRange = useUi((s) => s.timeRange)
  const w = inst?.world

  const edges = useMemo(() => (w ? computeEdges(w, addrPos, txPos, revealed) : []), [w, addrPos, txPos, revealed])
  const xlinks = useMemo(() => (w ? extraLinks(w, addrPos, revealed, links) : []), [w, addrPos, revealed, links])

  // Initialisation
  useEffect(() => {
    if (!ref.current) return
    const cy = cytoscape({
      container: ref.current, style: STYLE, wheelSensitivity: 0.3, minZoom: 0.08, maxZoom: 3.5,
      boxSelectionEnabled: true, selectionType: 'single',
    })
    cyRef.current = cy
    const g = useGame.getState
    cy.on('tap', 'node', (e: EventObject) => {
      const key = e.target.id() as string
      setMenu(null)
      if (isAKey(key)) g().select({ kind: 'address', id: idOf(key) })
      else g().select({ kind: 'tx', id: idOf(key) })
    })
    cy.on('tap', 'edge', (e: EventObject) => {
      setMenu(null)
      const d = e.target.data()
      g().select({ kind: 'edge', source: d.source, target: d.target, txIds: d.txIds })
    })
    cy.on('tap', (e: EventObject) => {
      if (e.target === cy) {
        setMenu(null)
        g().select(null)
      }
    })
    cy.on('dbltap', 'node', (e: EventObject) => {
      const key = e.target.id() as string
      if (isAKey(key)) g().expand(idOf(key), 'out')
      else g().revealTx(idOf(key), true)
    })
    cy.on('cxttap', 'node', (e: EventObject) => {
      const p = e.renderedPosition ?? e.target.renderedPosition()
      setMenu({ x: p.x, y: p.y, key: e.target.id() })
    })
    cy.on('dragfree', 'node', () => {
      const pos: Record<string, { x: number; y: number }> = {}
      cy.nodes().forEach((n) => {
        pos[n.id()] = { ...n.position() }
      })
      g().setPositions(pos)
    })
    const syncMulti = () => {
      const ids = cy.nodes(':selected').map((n) => n.id()).filter(isAKey).map(idOf)
      g().setMulti(ids)
    }
    cy.on('select unselect', 'node', syncMulti)
    cy.on('pan zoom', () => {
      setMenu(null)
      setHover(null)
    })
    cy.on('mouseover', 'node', (e: EventObject) => {
      const p = e.target.renderedPosition()
      setHover({ x: p.x, y: p.y, key: e.target.id() })
    })
    cy.on('mouseout', 'node', () => setHover(null))
    cy.on('drag', 'node', () => setHover(null))
    // Le conteneur change de taille (frise, panneaux) : Cytoscape doit le savoir
    // sinon les clics sont décalés.
    const ro = new ResizeObserver(() => {
      cy.resize()
      // Petit graphe : on le garde centré quand les panneaux s'ouvrent ou se ferment
      if (cy.nodes().length && cy.nodes().length <= 4) fitGraph(cy, 0)
    })
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      cy.destroy()
    }
  }, [])

  // Synchronisation des éléments
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !w || !inst) return
    const truthTx = new Set(showTruth ? inst.truth.path : [])
    const truthAddr = new Set(showTruth ? inst.truth.addresses : [])
    // Surimpression du traçage en cours et du chemin trouvé
    const traced = trace?.result
    const tracedTx = new Set([...(traced ? [...traced.byTx].filter(([, v]) => v > 0).map(([k]) => k) : []), ...(pathHl?.txIds ?? [])])
    const tracedAddr = (id: string) => (traced?.byAddress.get(id)?.receivedUsd ?? 0) > 0
    const seeds = new Set(inst.seeds)
    const wanted = new Set<string>()
    const wasEmpty = cy.nodes().empty()
    const prevIds = new Set(cy.nodes().map((n) => n.id()))
    cy.batch(() => {
      for (const [id, p] of Object.entries(addrPos)) {
        const key = aKey(id)
        wanted.add(key)
        const a = w.get(id)
        const at = attribution(w, id)
        const cat = at.entity ? CATEGORY[at.entity.category] : null
        const color = cat?.color ?? (a.contract ? '#818cf8' : '#7a8290')
        const iconName = cat?.icon ?? (a.contract ? 'FileCode2' : 'Wallet')
        const logo = entityLogo(at.entity?.id)
        const flag = flags[id] as Flag | undefined
        const name = at.label ?? (a.contract ? a.label ?? a.contract.name : null)
        const tn = traced?.byAddress.get(id)
        const taint = tn && tn.receivedUsd > 0
          ? `\n▸ ${tn.heldUsd > 0 ? 'détient' : 'reçu'} ${fmtUsd(tn.heldUsd > 0 ? tn.heldUsd : tn.receivedUsd)} · ${sharePct(tn.heldUsd > 0 ? tn.heldUsd : tn.receivedUsd, traced!.sourceUsd)}`
          : ''
        const label = (name ? `${name}\n${shortAddr(a.addr, 5)}` : shortAddr(a.addr, 6)) + taint
        const data = {
          id: key, kind: 'addr', role: at.entity ? 'entity' : a.contract ? 'contract' : 'plain', label, color, icon: logo ?? iconUri(iconName, color), logo: !!logo || undefined, size: at.entity ? 46 : 38,
          flag: flag ?? undefined, flagColor: flag ? FLAG_META[flag].color : undefined, seed: seeds.has(id) || undefined,
          chain: CHAINS[a.chain].color,
        }
        const el = cy.getElementById(key)
        if (el.empty()) cy.add({ group: 'nodes', data, position: { ...p } })
        else {
          el.data(data)
          const cur = el.position()
          if (Math.abs(cur.x - p.x) > 0.5 || Math.abs(cur.y - p.y) > 0.5) el.position({ ...p })
        }
        const missedNode = !!explored && truthAddr.has(id) && !explored.addrs[id]
        cy.getElementById(key).toggleClass('truthnode', truthAddr.has(id) && !missedNode)
        cy.getElementById(key).toggleClass('truthmissed', missedNode)
        cy.getElementById(key).toggleClass('tracednode', tracedAddr(id))
        cy.getElementById(key).toggleClass('watched', watch.includes(id))
      }
      for (const [id, p] of Object.entries(txPos)) {
        const key = tKey(id)
        wanted.add(key)
        const tx = w.tx(id)
        const cj = detectCoinjoin(tx).is
        const total = tx.outputs.reduce((s, o) => s + o.value, 0)
        const data = { id: key, kind: 'tx', label: `${compact(total)} ${CHAINS[tx.chain].short}`, coinjoin: cj || undefined }
        const el = cy.getElementById(key)
        if (el.empty()) cy.add({ group: 'nodes', data, position: { ...p } })
        else {
          el.data(data)
          const cur = el.position()
          if (Math.abs(cur.x - p.x) > 0.5 || Math.abs(cur.y - p.y) > 0.5) el.position({ ...p })
        }
        cy.getElementById(key).toggleClass('tracednode', tracedTx.has(id))
      }
      for (const e of edges) {
        wanted.add(e.id)
        const isIo = e.source.startsWith('t:') || e.target.startsWith('t:')
        const color = ASSETS[e.asset].color
        const width = Math.max(1.2, Math.min(8, 0.8 + Math.log10(e.usd + 1) * 0.95))
        const label = isIo ? '' : `${compact(e.value)} ${e.asset}${e.count > 1 ? ` ×${e.count}` : ''}`
        const data = { id: e.id, source: e.source, target: e.target, color, w: width, wt: width + 1.5, label, txIds: e.txIds, kind: isIo ? 'io' : 'transfer', usd: e.usd }
        const el = cy.getElementById(e.id)
        if (el.empty()) cy.add({ group: 'edges', data })
        else el.data(data)
        const onTruth = e.txIds.some((t) => truthTx.has(t))
        const missedEdge = onTruth && !!explored && !e.txIds.some((t) => truthTx.has(t) && explored.txs[t])
        cy.getElementById(e.id).toggleClass('truth', onTruth && !missedEdge)
        cy.getElementById(e.id).toggleClass('truthmissed', missedEdge)
        cy.getElementById(e.id).toggleClass('traced', e.txIds.some((t) => tracedTx.has(t)))
      }
      for (const x of xlinks) {
        wanted.add(x.id)
        const data = { id: x.id, source: x.source, target: x.target, label: x.label, txIds: x.txIds, kind: x.kind, w: 2.2, color: x.kind === 'bridge' ? '#a78bfa' : '#fbbf24' }
        const el = cy.getElementById(x.id)
        if (el.empty()) cy.add({ group: 'edges', data })
        else el.data(data)
        cy.getElementById(x.id).toggleClass('traced', x.txIds.some((t) => tracedTx.has(t)))
      }
      cy.elements().forEach((el) => {
        if (!wanted.has(el.id())) el.remove()
      })
    })
    // Nouveaux nœuds hors champ : on recadre pour les montrer
    const added = cy.nodes().filter((n) => !prevIds.has(n.id()))
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
  }, [w, inst, addrPos, txPos, edges, xlinks, flags, showTruth, explored, trace, pathHl, watch])

  // Animation après réorganisation
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !layoutTick) return
    fitGraph(cy, 450)
  }, [layoutTick])

  // Centrage demandé
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !focus) return
    const el = cy.getElementById(focus.key)
    if (el.empty()) return
    cy.animate({ center: { eles: el }, zoom: Math.max(cy.zoom(), 0.85) }, { duration: 350 })
  }, [focus])

  // Sélection externe → graphe
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !selection) return
    const key = selection.kind === 'address' ? aKey(selection.id) : selection.kind === 'tx' ? tKey(selection.id) : null
    if (!key) return
    const el = cy.getElementById(key)
    if (!el.empty() && !el.selected()) {
      cy.nodes(':selected').unselect()
      el.select()
    }
  }, [selection])

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
        const big = !minUsd || e.data('kind') === 'io' || (e.data('usd') ?? 0) >= minUsd
        if (!inRange || !big) e.addClass('dim')
      })
      if (timeRange) {
        cy.nodes('[kind="tx"]').forEach((n) => {
          const tm = w.txs.get(idOf(n.id()))?.time ?? 0
          if (tm < timeRange[0] || tm > timeRange[1]) n.addClass('dim')
        })
      }
    })
  }, [timeRange, minUsd, w, edges])

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

  const cy = () => cyRef.current
  const exportPng = () => {
    const c = cy()
    if (!c) return
    const uri = c.png({ full: true, bg: '#0e1013', scale: 2 })
    const a = document.createElement('a')
    a.href = uri
    a.download = `spectra-graphe-${Date.now()}.png`
    a.click()
  }
  ;(window as unknown as { __spectraCy?: () => Core | null }).__spectraCy = cy

  return (
    <div className="relative h-full w-full grid-bg" onContextMenu={(e) => e.preventDefault()}>
      <div ref={ref} className="absolute inset-0" />

      {(timeRange || minUsd > 0 || coverage === 'partial' || trace || pathHl) && (
        <div className="absolute top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-850 px-2 py-1.5 text-meta shadow-panel" style={{ left: inspectorOpen ? 'calc((100% - 392px) / 2 + 180px)' : 'calc(50% + 180px)' }}>
          <Icon name="ListFilter" size={12} className="text-accent" />
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
          <div className="flex max-w-[640px] flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-meta text-ink-200 shadow-panel animate-fadein">
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
            <span className="flex items-center gap-1.5 text-ink-300"><span className="h-[3px] w-5 rounded-full bg-ink-300" /> épaisseur = montant</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border border-ink-600 bg-ink-850 p-1 shadow-panel">
            <ToolBtn icon="Maximize" title="Ajuster la vue — F" onClick={() => cy() && fitGraph(cy()!)} />
            <ToolBtn icon="ZoomIn" title="Zoom avant" onClick={() => cy()?.animate({ zoom: { level: cy()!.zoom() * 1.3, renderedPosition: { x: ref.current!.clientWidth / 2, y: ref.current!.clientHeight / 2 } } }, { duration: 150 })} />
            <ToolBtn icon="ZoomOut" title="Zoom arrière" onClick={() => cy()?.animate({ zoom: { level: cy()!.zoom() / 1.3, renderedPosition: { x: ref.current!.clientWidth / 2, y: ref.current!.clientHeight / 2 } } }, { duration: 150 })} />
            <ToolBtn icon="Network" title="Réorganiser (couches gauche → droite) — L" onClick={() => useGame.getState().relayout()} />
            <ToolBtn icon="Undo2" title={canUndo ? 'Annuler la dernière opération — Ctrl Z' : 'Rien à annuler'} disabled={!canUndo} onClick={() => useGame.getState().undo()} />
            <span className="mx-0.5 my-1 w-px bg-ink-600" />
            <ToolBtn icon="Shapes" title="Légende" active={legend} onClick={() => setLegend((v) => !v)} />
            <ToolBtn icon="Camera" title="Exporter le graphe (PNG)" onClick={exportPng} />
            <ToolBtn icon="Eraser" title="Réinitialiser le graphe" onClick={() => confirm('Réinitialiser le graphe ? (les marquages et réponses sont conservés)') && useGame.getState().clearGraph()} />
          </div>
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

      {menu && <NodeMenu menu={menu} onClose={() => setMenu(null)} />}
      {hover && !menu && w && <NodeTooltip hover={hover} />}
    </div>
  )
}

function ToolBtn({ icon, title, onClick, active, disabled }: { icon: string; title: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button title={title} aria-label={title} aria-pressed={active} disabled={disabled} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-md transition-colors disabled:opacity-35 ${active ? 'bg-ink-700 text-white' : 'text-ink-300 hover:bg-ink-700 hover:text-white'}`}>
      <Icon name={icon} size={16} strokeWidth={1.75} />
    </button>
  )
}

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

function NodeMenu({ menu, onClose }: { menu: Menu; onClose: () => void }) {
  const g = useGame.getState()
  const inst = useGame((s) => s.inst)
  const flags = useGame((s) => s.flags)
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
  const isAddr = isAKey(menu.key)
  const id = idOf(menu.key)
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
  return (
    <div ref={boxRef} role="menu" className="absolute z-30 w-64 rounded-xl border border-ink-600 bg-ink-850 p-1.5 shadow-pop animate-fadein" style={{ left: pos.x, top: pos.y }} onMouseDown={(e) => e.stopPropagation()}>
      {isAddr ? (
        <>
          <div className="truncate px-2.5 pb-1.5 pt-1 font-mono text-micro text-ink-300">{shortAddr(w.get(id).addr, 10)}</div>
          {item('ArrowUpRight', 'Déplier les sorties', () => g.expand(id, 'out'))}
          {item('ArrowDownLeft', 'Déplier les entrées', () => g.expand(id, 'in'))}
          {item('Route', 'Tracer les fonds reçus', () => openTracer({ address: id }), '#2dd4bf')}
          {g.multi.length === 2 && g.multi.includes(id) && item('Waypoints', 'Chemin entre les 2 adresses sélectionnées', findPathFromSelection, '#2dd4bf')}
          {CHAINS[w.get(id).chain].model === 'utxo' && item('ListTree', 'Suivre la peel chain', () => openPeel(id), '#2dd4bf')}
          {poolDeposits(w, id).length > 0 && item('ScanSearch', 'Démixer ses dépôts dans un pool', () => openDemix(id), '#fb7185')}
          {CHAINS[w.get(id).chain].model === 'utxo' && item('Network', 'Ajouter le cluster', () => {
            const members = clusterOf(w, id).filter((m) => m !== id).slice(0, 25)
            members.forEach((m) => useGame.getState().addAddress(m, menu.key, 1))
          })}
          <div className="mx-2 my-1 h-px bg-ink-700" />
          {(Object.keys(FLAG_META) as Flag[]).map((f) => (
            <div key={f}>{item(flags[id] === f ? 'CircleCheck' : 'Flag', `${flags[id] === f ? 'Retirer' : 'Marquer'} : ${FLAG_META[f].label}`, () => g.flag(id, flags[id] === f ? null : f), FLAG_META[f].color)}</div>
          ))}
          <div className="mx-2 my-1 h-px bg-ink-700" />
          {item(g.watch.includes(id) ? 'EyeOff' : 'Eye', g.watch.includes(id) ? 'Ne plus surveiller' : 'Surveiller l\'adresse', () => g.toggleWatch(id), '#fb7185')}
          {item('Copy', 'Copier l\'adresse', () => navigator.clipboard?.writeText(w.get(id).addr).catch(() => undefined))}
          {item('Trash2', 'Retirer du graphe', () => g.removeNode(menu.key))}
        </>
      ) : (
        <>
          <div className="truncate px-2.5 pb-1.5 pt-1 font-mono text-micro text-ink-300">{shortAddr(w.tx(id).hash, 10)}</div>
          {item('Maximize2', 'Afficher toutes les entrées/sorties', () => g.revealTx(id, true))}
          {item('Route', 'Tracer depuis cette transaction', () => {
            g.select({ kind: 'tx', id })
            openTracerFromSelection()
          }, '#2dd4bf')}
          {item('Copy', 'Copier le hash', () => navigator.clipboard?.writeText(w.tx(id).hash).catch(() => undefined))}
          {item('Trash2', 'Retirer du graphe', () => g.removeNode(menu.key))}
        </>
      )}
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
  if (isAKey(hover.key)) {
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
