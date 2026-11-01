// Calques et barres d'outils du graphe : couloirs par chaîne, axe du temps,
// annotations (notes et cadres), tracé d'un cadre, mini-carte, rejeu animé,
// barre supérieure (outils, recherche, mise en page, options) et export.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Core } from 'cytoscape'
import { useGame } from '../../store/game'
import { ANNOTATION_COLORS, useGraph, type Annotation, type GraphOptions, type Lane, type LayoutMode } from '../../store/graph'
import { timeTicks, type Display } from '../../lib/graphview'
import { Icon } from '../common'
import { exportAnnex, exportSvg } from './graphExport'
import { groupSelection } from './graphActions'

export interface Viewport {
  zoom: number
  pan: { x: number; y: number }
  w: number
  h: number
}

const toScreen = (vp: Viewport, x: number, y: number) => ({ x: x * vp.zoom + vp.pan.x, y: y * vp.zoom + vp.pan.y })
const toModel = (vp: Viewport, x: number, y: number) => ({ x: (x - vp.pan.x) / vp.zoom, y: (y - vp.pan.y) / vp.zoom })

const fmtTick = (t: number, step: number) => {
  const d = new Date(t * 1000)
  return step < 86400
    ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'Europe/Paris' })
}

// ── Couloirs et axe ──────────────────────────────────────────────────────────

export function LanesLayer({ lanes, vp }: { lanes: Lane[]; vp: Viewport }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {lanes.map((l, i) => {
        const top = l.y0 * vp.zoom + vp.pan.y
        const h = (l.y1 - l.y0) * vp.zoom
        return (
          <div key={i} className="absolute left-0 right-0 border-y" style={{ top, height: h, background: `${l.color}0d`, borderColor: `${l.color}33` }}>
            <span className="absolute left-14 top-1.5 rounded px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wider" style={{ color: l.color, background: `${l.color}1a` }}>{l.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function TimeAxis({ axis, vp }: { axis: { t0: number; t1: number; x0: number; x1: number }; vp: Viewport }) {
  const ticks = timeTicks(axis.t0, axis.t1, 10)
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 86400
  const xOf = (t: number) => (axis.x0 + ((t - axis.t0) / (axis.t1 - axis.t0)) * (axis.x1 - axis.x0)) * vp.zoom + vp.pan.x
  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 h-6 overflow-hidden">
      {ticks.map((t) => {
        const x = xOf(t)
        if (x < 0 || x > vp.w) return null
        return (
          <div key={t} className="absolute top-0 flex h-full flex-col items-center" style={{ left: x }}>
            <span className="-translate-x-1/2 whitespace-nowrap rounded bg-ink-900/80 px-1 font-mono text-micro text-ink-300">{fmtTick(t, step)}</span>
            <span className="h-[200vh] w-px bg-ink-600/30" />
          </div>
        )
      })}
    </div>
  )
}

// ── Annotations ──────────────────────────────────────────────────────────────

export function AnnotationsLayer({ vp }: { vp: Viewport }) {
  const anns = useGraph((s) => s.byView[s.viewId]?.annotations ?? [])
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {anns.map((a) => <AnnotationView key={a.id} a={a} vp={vp} />)}
    </div>
  )
}

function AnnotationView({ a, vp }: { a: Annotation; vp: Viewport }) {
  const gr = useGraph.getState()
  const p = toScreen(vp, a.x, a.y)
  const [editing, setEditing] = useState(!a.text)
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; mode: 'move' | 'resize'; w: number; h: number } | null>(null)
  const onDown = (e: React.MouseEvent, mode: 'move' | 'resize') => {
    e.stopPropagation()
    e.preventDefault()
    drag.current = { sx: e.clientX, sy: e.clientY, x: a.x, y: a.y, mode, w: a.w, h: a.h }
    const move = (ev: MouseEvent) => {
      const dd = drag.current
      if (!dd) return
      const dx = (ev.clientX - dd.sx) / vp.zoom
      const dy = (ev.clientY - dd.sy) / vp.zoom
      if (dd.mode === 'move') gr.updateAnnotation(a.id, { x: dd.x + dx, y: dd.y + dy })
      else gr.updateAnnotation(a.id, { w: Math.max(80, dd.w + dx), h: Math.max(40, dd.h + dy) })
    }
    const up = () => {
      drag.current = null
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  const toolbar = (
    <div className="pointer-events-auto absolute -top-7 right-0 hidden items-center gap-0.5 rounded-md border border-ink-600 bg-ink-850 p-0.5 group-hover:flex">
      {ANNOTATION_COLORS.map((c) => (
        <button key={c} title="Couleur" className="h-4 w-4 rounded-full border border-ink-900" style={{ background: c }} onClick={() => gr.updateAnnotation(a.id, { color: c })} />
      ))}
      <button title="Modifier le texte" className="grid h-5 w-5 place-items-center text-ink-300 hover:text-white" onClick={() => setEditing(true)}><Icon name="PenLine" size={11} /></button>
      <button title="Supprimer" className="grid h-5 w-5 place-items-center text-ink-300 hover:text-rose-300" onClick={() => gr.removeAnnotation(a.id)}><Icon name="Trash2" size={11} /></button>
    </div>
  )
  if (a.kind === 'box') {
    return (
      <div className="group pointer-events-none absolute rounded-lg border-2 border-dashed" style={{ left: p.x, top: p.y, width: a.w * vp.zoom, height: a.h * vp.zoom, borderColor: a.color, background: `${a.color}0f` }}>
        <div className="pointer-events-auto absolute -top-6 left-0 flex max-w-full cursor-move items-center gap-1 rounded-t-md px-1.5 py-0.5 text-micro font-semibold" style={{ background: `${a.color}26`, color: a.color }} onMouseDown={(e) => onDown(e, 'move')} onDoubleClick={() => setEditing(true)}>
          <Icon name="GripVertical" size={10} />
          {editing ? (
            <input autoFocus className="w-48 bg-transparent outline-none" defaultValue={a.text} placeholder="Titre du cadre" onMouseDown={(e) => e.stopPropagation()} onBlur={(e) => { gr.updateAnnotation(a.id, { text: e.target.value }); setEditing(false) }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }} />
          ) : <span className="truncate">{a.text || 'Cadre sans titre'}</span>}
        </div>
        {toolbar}
        <div className="pointer-events-auto absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-sm" style={{ background: a.color }} onMouseDown={(e) => onDown(e, 'resize')} />
      </div>
    )
  }
  return (
    <div className="group pointer-events-auto absolute" style={{ left: p.x, top: p.y, width: a.w, transform: `scale(${Math.max(0.6, Math.min(1.2, vp.zoom))})`, transformOrigin: 'top left' }}>
      {toolbar}
      <div className="rounded-lg border shadow-panel" style={{ borderColor: `${a.color}66`, background: '#1b1f25' }}>
        <div className="flex cursor-move items-center gap-1 rounded-t-lg px-2 py-1 text-micro font-semibold" style={{ background: `${a.color}22`, color: a.color }} onMouseDown={(e) => onDown(e, 'move')}>
          <Icon name="StickyNote" size={11} /> Note
        </div>
        {editing ? (
          <textarea autoFocus className="block w-full resize-none bg-transparent px-2 py-1.5 text-dense leading-snug text-ink-100 outline-none" rows={3} defaultValue={a.text} placeholder="Votre constatation…" onBlur={(e) => { gr.updateAnnotation(a.id, { text: e.target.value }); setEditing(false); if (!e.target.value.trim()) gr.removeAnnotation(a.id) }} onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur() }} />
        ) : (
          <div className="whitespace-pre-wrap px-2 py-1.5 text-dense leading-snug text-ink-100" onDoubleClick={() => setEditing(true)}>{a.text}</div>
        )}
      </div>
    </div>
  )
}

/** Tracé d'un cadre au cliquer-glisser (outil « cadre »). */
export function BoxDrawer({ vp }: { vp: Viewport }) {
  const [r, setR] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const local = (e: React.MouseEvent) => {
    const b = box.current!.getBoundingClientRect()
    return { x: e.clientX - b.left, y: e.clientY - b.top }
  }
  return (
    <div
      ref={box}
      className="absolute inset-0 z-[5] cursor-crosshair"
      onMouseDown={(e) => {
        const p = local(e)
        setR({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
      }}
      onMouseMove={(e) => {
        if (!r) return
        const p = local(e)
        setR({ ...r, x1: p.x, y1: p.y })
      }}
      onMouseUp={() => {
        const gr = useGraph.getState()
        if (r && Math.abs(r.x1 - r.x0) > 20 && Math.abs(r.y1 - r.y0) > 20) {
          const a = toModel(vp, Math.min(r.x0, r.x1), Math.min(r.y0, r.y1))
          const b = toModel(vp, Math.max(r.x0, r.x1), Math.max(r.y0, r.y1))
          gr.addAnnotation({ kind: 'box', x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, text: '', color: '#7ea6ff' })
        }
        setR(null)
        gr.setTool('select')
      }}
    >
      <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-md bg-ink-850 px-2.5 py-1 text-micro text-ink-200 shadow-panel">Tracez un cadre autour des nœuds à regrouper visuellement · Échap pour annuler</div>
      {r && <div className="absolute rounded-lg border-2 border-dashed border-accent bg-accent/10" style={{ left: Math.min(r.x0, r.x1), top: Math.min(r.y0, r.y1), width: Math.abs(r.x1 - r.x0), height: Math.abs(r.y1 - r.y0) }} />}
    </div>
  )
}

// ── Mini-carte ───────────────────────────────────────────────────────────────

export function Minimap({ cyRef, tick, right }: { cyRef: React.RefObject<Core | null>; tick: number; right: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const W = 190
  const H = 120
  const geo = useRef<{ x1: number; y1: number; s: number; ox: number; oy: number } | null>(null)
  useEffect(() => {
    const cy = cyRef.current
    const cv = canvas.current
    if (!cy || !cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const nodes = cy.nodes().not('[kind="parent"]')
    if (nodes.empty()) return
    const bb = nodes.boundingBox()
    const pad = 8
    const s = Math.min((W - pad * 2) / Math.max(1, bb.w), (H - pad * 2) / Math.max(1, bb.h))
    const ox = pad + (W - pad * 2 - bb.w * s) / 2
    const oy = pad + (H - pad * 2 - bb.h * s) / 2
    geo.current = { x1: bb.x1, y1: bb.y1, s, ox, oy }
    const dpr = window.devicePixelRatio || 1
    cv.width = W * dpr
    cv.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = '#5d6572'
    ctx.lineWidth = 0.6
    cy.edges().forEach((e) => {
      const a = e.source().position()
      const b = e.target().position()
      ctx.beginPath()
      ctx.moveTo(ox + (a.x - bb.x1) * s, oy + (a.y - bb.y1) * s)
      ctx.lineTo(ox + (b.x - bb.x1) * s, oy + (b.y - bb.y1) * s)
      ctx.stroke()
    })
    ctx.globalAlpha = 1
    nodes.forEach((n) => {
      const p = n.position()
      const k = n.data('kind')
      ctx.fillStyle = n.hasClass('match') ? '#facc15' : n.selected() ? '#7ea6ff' : (n.data('flagColor') as string) ?? (n.data('color') as string) ?? '#5d6572'
      const r = k === 'tx' ? 1.2 : k === 'group' ? 3.6 : 2.2
      ctx.beginPath()
      ctx.arc(ox + (p.x - bb.x1) * s, oy + (p.y - bb.y1) * s, r, 0, Math.PI * 2)
      ctx.fill()
    })
    const ext = cy.extent()
    ctx.strokeStyle = '#7ea6ff'
    ctx.lineWidth = 1.2
    ctx.fillStyle = 'rgba(126,166,255,0.08)'
    const rx = ox + (ext.x1 - bb.x1) * s
    const ry = oy + (ext.y1 - bb.y1) * s
    ctx.fillRect(rx, ry, ext.w * s, ext.h * s)
    ctx.strokeRect(rx, ry, ext.w * s, ext.h * s)
  }, [cyRef, tick])
  const panTo = (e: React.MouseEvent) => {
    const cy = cyRef.current
    const g = geo.current
    if (!cy || !g) return
    const b = canvas.current!.getBoundingClientRect()
    const mx = (e.clientX - b.left - g.ox) / g.s + g.x1
    const my = (e.clientY - b.top - g.oy) / g.s + g.y1
    cy.pan({ x: cy.width() / 2 - mx * cy.zoom(), y: cy.height() / 2 - my * cy.zoom() })
  }
  return (
    <div className="absolute bottom-3 z-10 overflow-hidden rounded-lg border border-ink-600 bg-ink-900/90 shadow-panel" style={{ right }} title="Mini-carte : cliquez ou glissez pour vous déplacer">
      <canvas ref={canvas} style={{ width: W, height: H }} className="block cursor-pointer" onMouseDown={(e) => {
        panTo(e)
        const move = (ev: MouseEvent) => panTo(ev as unknown as React.MouseEvent)
        const up = () => {
          window.removeEventListener('mousemove', move)
          window.removeEventListener('mouseup', up)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
      }} />
    </div>
  )
}

// ── Rejeu animé ──────────────────────────────────────────────────────────────

export function ReplayBar({ cyRef, edgesTick, onClose, inspectorOpen }: { cyRef: React.RefObject<Core | null>; edgesTick: Display | null; onClose: () => void; inspectorOpen: boolean }) {
  const times = useMemo(() => {
    const cy = cyRef.current
    if (!cy) return [] as number[]
    return [...new Set(cy.edges().map((e) => Number(e.data('time') ?? 0)).filter((t) => t > 0))].sort((a, b) => a - b)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cyRef, edgesTick])
  const t0 = times[0] ?? 0
  const t1 = times[times.length - 1] ?? 0
  const [t, setT] = useState(t0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  // Avance : tout le flux en ~18 s à vitesse 1, par sauts d'événement en événement
  useEffect(() => {
    if (!playing || t1 <= t0) return
    const id = setInterval(() => {
      setT((cur) => {
        const step = ((t1 - t0) / 360) * speed
        const next = cur + step
        if (next >= t1) {
          setPlaying(false)
          return t1
        }
        return next
      })
    }, 50)
    return () => clearInterval(id)
  }, [playing, speed, t0, t1])
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      cy.elements().removeClass('future')
      cy.edges().forEach((e) => {
        if (Number(e.data('time') ?? 0) > t) e.addClass('future')
      })
      cy.nodes().not('[kind="parent"]').forEach((n) => {
        const nt = Number(n.data('time') ?? 0)
        if (nt > t) n.addClass('future')
      })
    })
  }, [t, cyRef, edgesTick])
  useEffect(() => () => {
    cyRef.current?.elements().removeClass('future')
  }, [cyRef])
  if (!times.length) return null
  const shown = times.filter((x) => x <= t).length
  return (
    <div className="absolute bottom-16 z-20 flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-accent/40 bg-ink-850 px-3 py-2 shadow-pop animate-fadein" style={{ left: inspectorOpen ? 'calc((100% - 392px) / 2)' : '50%', width: 'min(620px, 70%)' }}>
      <button className="grid h-8 w-8 place-items-center rounded-md bg-accent/15 text-accent hover:bg-accent/25" title={playing ? 'Pause' : 'Lecture'} onClick={() => {
        if (!playing && t >= t1) setT(t0)
        setPlaying(!playing)
      }}>
        <Icon name={playing ? 'Pause' : 'Play'} size={15} />
      </button>
      <div className="min-w-0 flex-1">
        <input type="range" min={t0} max={t1} step={Math.max(1, (t1 - t0) / 1000)} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)) }} className="w-full" />
        <div className="flex justify-between font-mono text-micro text-ink-300">
          <span>{new Date(t * 1000).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}</span>
          <span>{shown}/{times.length} étapes</span>
        </div>
      </div>
      <select className="rounded-md border border-ink-600 bg-ink-950 px-1 py-0.5 text-micro text-ink-100" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} title="Vitesse">
        {[0.5, 1, 2, 4].map((s) => <option key={s} value={s}>×{s}</option>)}
      </select>
      <button className="text-ink-300 hover:text-white" title="Fermer le rejeu" onClick={onClose}><Icon name="X" size={15} /></button>
    </div>
  )
}

// ── Barre supérieure ─────────────────────────────────────────────────────────

const MODES: { id: LayoutMode; label: string; icon: string; help: string }[] = [
  { id: 'layers', label: 'Couches', icon: 'Network', help: 'Gauche → droite selon le sens des flux' },
  { id: 'time', label: 'Chrono', icon: 'CalendarClock', help: 'L\'axe horizontal est le temps' },
  { id: 'lanes', label: 'Couloirs', icon: 'Rows3', help: 'Une bande par chaîne, le temps en abscisse' },
]

export function GraphTopBar({ matches, onNextMatch, hidden }: { matches: number; onNextMatch: () => void; hidden?: { converters: number; aggregated: number } }) {
  const tool = useGraph((s) => s.tool)
  const opts = useGraph((s) => s.opts)
  const search = useGraph((s) => s.search)
  const [optsOpen, setOptsOpen] = useState(false)
  const gr = useGraph.getState()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (document.querySelector('[data-modal]')) return
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        input.current?.focus()
      }
      if (e.key === 'Escape') {
        gr.setTool('select')
        gr.setFocus(null)
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'n' || e.key === 'N') gr.setTool(gr.tool === 'note' ? 'select' : 'note')
      if (e.key === 'b' || e.key === 'B') gr.setTool(gr.tool === 'box' ? 'select' : 'box')
      if ((e.key === 'g' || e.key === 'G') && useGame.getState().multi.length >= 2) groupSelection()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [gr])
  const setMode = (m: LayoutMode) => {
    gr.setOpt('mode', m)
    useGame.getState().relayout()
  }
  return (
    <div className="absolute left-14 top-3 z-10 flex flex-wrap items-center gap-2">
      <div className="flex gap-0.5 rounded-lg border border-ink-600 bg-ink-850 p-1 shadow-panel">
        <TopBtn icon="MousePointer2" title="Sélection" active={tool === 'select'} onClick={() => gr.setTool('select')} />
        <TopBtn icon="StickyNote" title="Note : cliquez sur le graphe pour la poser — N" active={tool === 'note'} onClick={() => gr.setTool(tool === 'note' ? 'select' : 'note')} />
        <TopBtn icon="SquareDashed" title="Cadre : tracez-le autour de nœuds — B" active={tool === 'box'} onClick={() => gr.setTool(tool === 'box' ? 'select' : 'box')} />
      </div>
      <div className="flex h-[42px] items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-850 px-2.5 shadow-panel">
        <Icon name="Search" size={14} className="text-ink-400" />
        <input
          ref={input}
          className="w-32 bg-transparent text-meta text-ink-100 outline-none placeholder:text-ink-500 xl:w-44"
          placeholder="Chercher dans le graphe ( / )"
          value={search}
          onChange={(e) => gr.setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onNextMatch()
            if (e.key === 'Escape') {
              gr.setSearch('')
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
        {search && <span className="font-mono text-micro text-ink-300">{matches}</span>}
        {search && <button className="text-ink-400 hover:text-white" title="Effacer" onClick={() => gr.setSearch('')}><Icon name="X" size={12} /></button>}
      </div>
      <div className="flex gap-0.5 rounded-lg border border-ink-600 bg-ink-850 p-1 shadow-panel">
        {MODES.map((m) => (
          <button key={m.id} title={m.help} onClick={() => setMode(m.id)} className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-meta transition-colors ${opts.mode === m.id ? 'bg-ink-700 text-white' : 'text-ink-300 hover:bg-ink-700 hover:text-white'}`}>
            <Icon name={m.icon} size={14} /> <span className="hidden xl:inline">{m.label}</span>
          </button>
        ))}
      </div>
      <div className="relative">
        <TopBtn icon="SlidersHorizontal" title="Options d'affichage" active={optsOpen} onClick={() => setOptsOpen((v) => !v)} boxed />
        {optsOpen && <OptionsPanel opts={opts} hidden={hidden} onClose={() => setOptsOpen(false)} />}
      </div>
      {hidden && (hidden.converters > 0 || hidden.aggregated > 0) && (
        <span className="hidden rounded-md bg-ink-850/90 px-2 py-1 text-micro text-ink-400 2xl:inline" title="Réglable dans les options d'affichage">
          {hidden.converters > 0 && `${hidden.converters} contrat(s) de conversion masqué(s)`}{hidden.converters > 0 && hidden.aggregated > 0 && ' · '}{hidden.aggregated > 0 && `${hidden.aggregated} contrepartie(s) réunie(s)`}
        </span>
      )}
    </div>
  )
}

function TopBtn({ icon, title, active, onClick, boxed }: { icon: string; title: string; active?: boolean; onClick: () => void; boxed?: boolean }) {
  return (
    <button title={title} aria-label={title} aria-pressed={active} onClick={onClick} className={`grid place-items-center rounded-md transition-colors ${boxed ? 'h-[42px] w-[42px] border border-ink-600 bg-ink-850 shadow-panel' : 'h-8 w-8'} ${active ? 'bg-ink-700 text-white' : 'text-ink-300 hover:bg-ink-700 hover:text-white'}`}>
      <Icon name={icon} size={16} strokeWidth={1.75} />
    </button>
  )
}

function OptionsPanel({ opts, hidden, onClose }: { opts: GraphOptions; hidden?: { converters: number; aggregated: number }; onClose: () => void }) {
  const gr = useGraph.getState()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [onClose])
  const toggle = (k: keyof GraphOptions, label: string, help: string) => (
    <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-ink-800">
      <input type="checkbox" className="mt-0.5" checked={!!opts[k]} onChange={(e) => gr.setOpt(k, e.target.checked as never)} />
      <span>
        <span className="block text-dense text-ink-100">{label}</span>
        <span className="block text-micro leading-snug text-ink-400">{help}</span>
      </span>
    </label>
  )
  const seg = <K extends 'labels' | 'sizeBy'>(k: K, label: string, choices: { v: GraphOptions[K]; t: string }[]) => (
    <div className="px-2 py-1.5">
      <div className="mb-1 text-micro uppercase tracking-wider text-ink-400">{label}</div>
      <div className="flex gap-0.5 rounded-md bg-ink-950 p-0.5">
        {choices.map((c) => (
          <button key={String(c.v)} onClick={() => gr.setOpt(k, c.v)} className={`flex-1 rounded px-1.5 py-1 text-micro ${opts[k] === c.v ? 'bg-ink-700 text-white' : 'text-ink-300 hover:text-white'}`}>{c.t}</button>
        ))}
      </div>
    </div>
  )
  return (
    <div ref={ref} className="absolute left-0 top-12 z-30 w-80 rounded-xl border border-ink-600 bg-ink-850 p-1.5 shadow-pop animate-fadein">
      <div className="px-2 pb-1 pt-1 text-meta font-semibold text-white">Affichage du graphe</div>
      {toggle('collapseSwaps', 'Condenser les swaps', `Un swap devient une seule arête de conversion ; routeurs, pools et adresse nulle sont masqués${hidden?.converters ? ` (${hidden.converters} actuellement)` : ''}.`)}
      {toggle('aggregate', 'Réunir les contreparties', 'Au-delà de 6 contreparties sans intérêt d\'une même adresse, un nœud « +N » les remplace (double-clic pour déplier).')}
      {toggle('autoGroupServices', 'Regrouper les services', 'Les adresses d\'un même service (3 ou plus) forment un seul nœud repliable.')}
      {toggle('badges', 'Pastilles sur les nœuds', 'Surveillé, gel demandé, épinglé, portefeuille HD, multisig, note.')}
      {toggle('minimap', 'Mini-carte', 'Vue d\'ensemble cliquable en bas à droite.')}
      {seg('labels', 'Étiquettes', [{ v: 'auto', t: 'Auto' }, { v: 'all', t: 'Toutes' }, { v: 'minimal', t: 'Essentielles' }])}
      {seg('sizeBy', 'Taille des nœuds', [{ v: 'none', t: 'Fixe' }, { v: 'volume', t: 'Volume' }, { v: 'balance', t: 'Solde' }])}
      <div className="mx-2 mt-1 border-t border-ink-700 pt-1.5 text-micro leading-snug text-ink-400">Ces réglages ne changent que la présentation : les constatations, réponses et traçages restent identiques.</div>
    </div>
  )
}

// ── Export ───────────────────────────────────────────────────────────────────

export function ExportMenu({ cyRef }: { cyRef: React.RefObject<Core | null> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open])
  const png = () => {
    const c = cyRef.current
    if (!c) return
    const uri = c.png({ full: true, bg: '#0e1013', scale: 2 })
    const a = document.createElement('a')
    a.href = uri
    a.download = `spectra-graphe-${Date.now()}.png`
    a.click()
  }
  const item = (icon: string, title: string, sub: string, run: () => void) => (
    <button className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-ink-700" onClick={() => {
      run()
      setOpen(false)
    }}>
      <Icon name={icon} size={15} className="mt-0.5 text-ink-300" />
      <span>
        <span className="block text-dense text-ink-100">{title}</span>
        <span className="block text-micro text-ink-400">{sub}</span>
      </span>
    </button>
  )
  return (
    <div ref={ref} className="relative">
      <button title="Exporter le graphe" aria-label="Exporter le graphe" onClick={() => setOpen((v) => !v)} className={`grid h-8 w-8 place-items-center rounded-md transition-colors ${open ? 'bg-ink-700 text-white' : 'text-ink-300 hover:bg-ink-700 hover:text-white'}`}>
        <Icon name="Download" size={16} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="absolute bottom-11 left-0 z-30 w-80 rounded-xl border border-ink-600 bg-ink-850 p-1.5 shadow-pop animate-fadein">
          {item('Image', 'Image PNG', 'Capture haute définition du graphe tel qu\'affiché', png)}
          {item('FileImage', 'Image vectorielle SVG (sombre)', 'Nette à toutes les tailles, avec légende et annotations', () => cyRef.current && exportSvg(cyRef.current, 'dark'))}
          {item('FileImage', 'Image vectorielle SVG (claire)', 'Pour un document imprimé', () => cyRef.current && exportSvg(cyRef.current, 'light'))}
          {item('FileText', 'Annexe judiciaire', 'Graphe numéroté, tableau des adresses et des transactions, annotations : prêt à imprimer', () => cyRef.current && exportAnnex(cyRef.current))}
        </div>
      )}
    </div>
  )
}
