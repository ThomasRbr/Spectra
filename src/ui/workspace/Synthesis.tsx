import { useMemo, useState } from 'react'
import { fmtUsd, usd, type AssetId } from '../../engine/chains'
import { CATEGORY } from '../../engine/entities'
import type { TraceResult } from '../../engine/tracing'
import type { World } from '../../engine/world'
import { useGame } from '../../store/game'
import { Icon, fmtTime } from '../common'

// ── Diagramme de flux par entité (traçage) ───────────────────────────────

interface FlowBand {
  label: string
  sub: string
  usd: number
  color: string
}

function bands(res: TraceResult): FlowBand[] {
  const out: FlowBand[] = res.endpoints.map((e) => ({ label: e.entity.name, sub: CATEGORY[e.entity.category].label, usd: e.usd, color: CATEGORY[e.entity.category].color }))
  const held = res.stillHeld.reduce((s, n) => s + n.heldUsd, 0)
  if (held > 0) out.push({ label: 'Encore détenu', sub: `${res.stillHeld.length} adresse(s) non attribuée(s)`, usd: held, color: '#facc15' })
  const transit = res.lost.inTransitUsd
  if (transit > 0) out.push({ label: 'En transit', sub: 'bridge pas encore arrivé', usd: transit, color: '#a78bfa' })
  const lost = res.lost.belowThresholdUsd + res.lost.feesUsd + res.lost.depthUsd
  if (lost > 0) out.push({ label: 'Non suivi', sub: 'frais, seuil, profondeur', usd: lost, color: '#64748b' })
  return out.sort((a, b) => b.usd - a.usd)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Diagramme de flux (type Sankey) : la source à gauche, chaque destination à
 * droite, épaisseur proportionnelle au montant. Rendu en SVG texte pour servir
 * aussi bien dans l'interface que dans le rapport imprimable.
 */
export function flowDiagramSvg(res: TraceResult, opts: { light?: boolean; sourceLabel: string }): string {
  const list = bands(res).slice(0, 9)
  const total = Math.max(1, list.reduce((s, b) => s + b.usd, 0))
  const W = 720
  const gap = 8
  const H = Math.max(140, list.length * 34)
  const usable = H - gap * (list.length - 1)
  const fg = opts.light ? '#111' : '#e2e8f0'
  const muted = opts.light ? '#555' : '#94a3b8'
  const srcColor = opts.light ? '#0e7490' : '#22d3ee'
  const x0 = 150
  const x1 = 430
  let ySrc = 0
  let yDst = 0
  // Les étiquettes des petites bandes sont décalées pour ne pas se chevaucher
  let lastLy = -Infinity
  const parts: string[] = []
  parts.push(`<rect x="${x0 - 12}" y="0" width="12" height="${H - gap * (list.length - 1)}" rx="3" fill="${srcColor}"/>`)
  parts.push(`<text x="${x0 - 20}" y="${(H - gap * (list.length - 1)) / 2 - 6}" text-anchor="end" font-size="12" font-weight="600" fill="${fg}">${esc(opts.sourceLabel)}</text>`)
  parts.push(`<text x="${x0 - 20}" y="${(H - gap * (list.length - 1)) / 2 + 10}" text-anchor="end" font-size="11" fill="${muted}">${esc(fmtUsd(res.sourceUsd))}</text>`)
  for (const b of list) {
    const h = Math.max(2, (b.usd / total) * usable)
    const a0 = ySrc
    const a1 = ySrc + h
    const b0 = yDst
    const b1 = yDst + h
    const mx = (x0 + x1) / 2
    parts.push(`<path d="M${x0},${a0} C${mx},${a0} ${mx},${b0} ${x1},${b0} L${x1},${b1} C${mx},${b1} ${mx},${a1} ${x0},${a1} Z" fill="${b.color}" fill-opacity="${opts.light ? 0.35 : 0.28}"/>`)
    parts.push(`<rect x="${x1}" y="${b0}" width="10" height="${h}" rx="2" fill="${b.color}"/>`)
    const pct = res.sourceUsd > 0 ? Math.round((b.usd / res.sourceUsd) * 100) : 0
    const cy = b0 + h / 2
    const ly = Math.max(cy, lastLy + 30)
    lastLy = ly
    if (ly - cy > 2) parts.push(`<path d="M${x1 + 11},${cy} L${x1 + 15},${ly - 6}" stroke="${muted}" stroke-width="0.8" fill="none"/>`)
    parts.push(`<text x="${x1 + 18}" y="${ly - 2}" font-size="12" font-weight="600" fill="${fg}">${esc(b.label)} <tspan font-weight="400" fill="${muted}">· ${esc(fmtUsd(b.usd))} · ${pct < 1 && b.usd > 0 ? '&lt; 1' : pct} %</tspan></text>`)
    parts.push(`<text x="${x1 + 18}" y="${ly + 12}" font-size="10.5" fill="${muted}">${esc(b.sub)}</text>`)
    ySrc = a1
    yDst = b1 + gap
  }
  const VH = Math.max(H, lastLy + 18)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -4 ${W} ${VH + 8}" width="100%" role="img" aria-label="Diagramme de flux du traçage" font-family="Inter, Segoe UI, Arial, sans-serif">${parts.join('')}</svg>`
}

export function FlowDiagram({ res, sourceLabel }: { res: TraceResult; sourceLabel: string }) {
  const svg = useMemo(() => flowDiagramSvg(res, { sourceLabel }), [res, sourceLabel])
  return <div className="rounded-xl border border-ink-700/60 bg-ink-950/40 p-3" dangerouslySetInnerHTML={{ __html: svg }} />
}

// ── Courbe de solde d'une adresse ────────────────────────────────────────

interface Point {
  t: number
  usd: number
}

function balanceSeries(w: World, id: string): Point[] {
  const bal = new Map<AssetId, number>()
  const pts: Point[] = []
  for (const tx of w.txsOf(id)) {
    for (const f of w.flowIn(tx, id)) bal.set(f.asset, (bal.get(f.asset) ?? 0) + f.value)
    for (const f of w.flowOut(tx, id)) bal.set(f.asset, (bal.get(f.asset) ?? 0) - f.value)
    const v = [...bal.entries()].reduce((s, [a, x]) => s + usd(a, Math.max(0, x)), 0)
    pts.push({ t: tx.time, usd: v })
  }
  return pts
}

export function BalanceChart({ w, id }: { w: World; id: string }) {
  const [open, setOpen] = useState(true)
  const clock = useGame((s) => s.live?.now)
  const pts = useMemo(() => balanceSeries(w, id), [w, id, clock])
  const [hover, setHover] = useState<number | null>(null)
  if (pts.length < 2) return null
  const W = 340
  const H = 74
  const t0 = pts[0].t
  const t1 = Math.max(t0 + 1, clock ?? pts[pts.length - 1].t)
  const max = Math.max(1, ...pts.map((p) => p.usd))
  const x = (t: number) => ((t - t0) / (t1 - t0)) * (W - 4) + 2
  const y = (v: number) => H - 4 - (v / max) * (H - 10)
  // Courbe en escalier : le solde ne change qu'aux transactions
  let prev = 0
  let d = `M${x(t0)},${y(0)}`
  for (const p of pts) {
    d += ` L${x(p.t)},${y(prev)} L${x(p.t)},${y(p.usd)}`
    prev = p.usd
  }
  d += ` L${x(t1)},${y(prev)}`
  const h = hover !== null ? pts[hover] : null
  return (
    <div className="mb-2 rounded-lg border border-ink-700/60 bg-ink-850/40 p-2">
      <button className="flex w-full items-center justify-between text-[10.5px] uppercase tracking-wide text-ink-400 hover:text-white" onClick={() => setOpen((v) => !v)}>
        <span className="flex items-center gap-1.5"><Icon name="ChartLine" size={11} /> Solde dans le temps (USD)</span>
        <span className="font-mono normal-case tracking-normal text-ink-300">{h ? `${fmtTime(h.t)} · ${fmtUsd(h.usd)}` : `max ${fmtUsd(max)}`}</span>
      </button>
      {open && (
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" onMouseLeave={() => setHover(null)} onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const t = t0 + ((e.clientX - r.left) / r.width) * (t1 - t0)
          let k = 0
          for (let i = 0; i < pts.length; i++) if (pts[i].t <= t) k = i
          setHover(k)
        }}>
          <path d={`${d} L${x(t1)},${y(0)} Z`} fill="#22d3ee" fillOpacity={0.12} />
          <path d={d} fill="none" stroke="#22d3ee" strokeWidth={1.4} />
          {h && <circle cx={x(h.t)} cy={y(h.usd)} r={3} fill="#22d3ee" />}
          {clock && <line x1={x(t1)} x2={x(t1)} y1={0} y2={H} stroke="#fb7185" strokeDasharray="2 2" strokeWidth={1} />}
        </svg>
      )}
    </div>
  )
}
