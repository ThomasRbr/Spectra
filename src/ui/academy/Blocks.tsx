import { useEffect, useMemo, useRef, useState } from 'react'
import { WIDGETS, type Block, type FlowEdge, type FlowKind, type FlowNode, type WidgetId } from '../../academy'
import { useProfile } from '../../store/profile'
import { Icon, RichText } from '../common'

// ── Texte ──────────────────────────────────────────────────────────────────

export function Md({ md, className }: { md: string; className?: string }) {
  return <RichText text={md} className={`!text-[14.5px] leading-[1.75] ${className ?? ''}`} />
}

// ── Schéma de flux ─────────────────────────────────────────────────────────

export const FLOW_META: Record<FlowKind, { color: string; icon: string; label: string }> = {
  victim: { color: '#4ade80', icon: 'HeartHandshake', label: 'Victime' },
  suspect: { color: '#f472b6', icon: 'UserX', label: 'Suspect' },
  wallet: { color: '#94a3b8', icon: 'Wallet', label: 'Portefeuille' },
  exchange: { color: '#22d3ee', icon: 'Landmark', label: 'Exchange' },
  deposit: { color: '#22d3ee', icon: 'ArrowDownToLine', label: 'Adresse de dépôt' },
  hot: { color: '#38bdf8', icon: 'Flame', label: 'Hot wallet' },
  mixer: { color: '#f43f5e', icon: 'Blend', label: 'Mixeur' },
  bridge: { color: '#a78bfa', icon: 'Waypoints', label: 'Bridge' },
  dex: { color: '#818cf8', icon: 'ArrowLeftRight', label: 'DEX' },
  contract: { color: '#818cf8', icon: 'FileCode2', label: 'Contrat' },
  service: { color: '#0ea5e9', icon: 'Building2', label: 'Service' },
  unknown: { color: '#64748b', icon: 'CircleHelp', label: 'Inconnu' },
  tx: { color: '#7a88a8', icon: 'Diamond', label: 'Transaction' },
}

const NW = 168
const NH = 58
const GY = 22
const GYV = 58

export function FlowDiagram({ nodes, edges, caption }: { nodes: FlowNode[]; edges: FlowEdge[]; caption?: string }) {
  // Écart entre colonnes adapté au plus long libellé de flèche
  const GX = Math.min(230, Math.max(74, Math.max(0, ...edges.map((e) => (e.label ?? '').length)) * 6.4 + 30))
  const box = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(0)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setAvail(el.clientWidth - 8))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const groups = useMemo(() => {
    const rank = new Map<string, number>()
    const visiting = new Set<string>()
    const incoming = (id: string) => edges.filter((e) => e.to === id && e.from !== id)
    const rankOf = (id: string): number => {
      if (rank.has(id)) return rank.get(id)!
      if (visiting.has(id)) return 0
      visiting.add(id)
      const r = Math.max(0, ...incoming(id).map((e) => rankOf(e.from) + 1))
      visiting.delete(id)
      rank.set(id, r)
      return r
    }
    nodes.forEach((n) => rankOf(n.id))
    const g = new Map<number, FlowNode[]>()
    for (const n of nodes) {
      const r = rank.get(n.id) ?? 0
      g.set(r, [...(g.get(r) ?? []), n])
    }
    return g
  }, [nodes, edges])

  const pad = 14
  const nRanks = Math.max(0, ...groups.keys()) + 1
  const maxPer = Math.max(1, ...[...groups.values()].map((c) => c.length))
  const horizW = nRanks * (NW + GX) - GX + pad * 2
  // Trop large pour la colonne : disposition verticale, de haut en bas
  const vertical = avail > 0 && horizW > avail * 1.05 && nRanks > 2

  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>()
    if (!vertical) {
      const height = maxPer * NH + (maxPer - 1) * GY
      for (const [r, col] of groups) {
        const colH = col.length * NH + (col.length - 1) * GY
        col.forEach((n, i) => pos.set(n.id, { x: r * (NW + GX), y: (height - colH) / 2 + i * (NH + GY) }))
      }
      return { pos, width: nRanks * (NW + GX) - GX, height }
    }
    const width = maxPer * NW + (maxPer - 1) * 28
    for (const [r, row] of groups) {
      const rowW = row.length * NW + (row.length - 1) * 28
      row.forEach((n, i) => pos.set(n.id, { x: (width - rowW) / 2 + i * (NW + 28), y: r * (NH + GYV) }))
    }
    return { pos, width, height: nRanks * (NH + GYV) - GYV }
  }, [groups, vertical, GX, maxPer, nRanks])

  const hasBack = edges.some((e) => {
    const a = layout.pos.get(e.from)
    const b = layout.pos.get(e.to)
    return a && b && (vertical ? b.y <= a.y : b.x <= a.x)
  })
  const W = layout.width + pad * 2 + (vertical && hasBack ? 60 : 0)
  const H = layout.height + pad * 2 + 8 + (!vertical && hasBack ? 44 : 0)
  const scale = avail > 0 ? Math.min(1, vertical ? avail / W : Math.max(0.6, avail / W)) : 1

  return (
    <figure className="my-2">
      <div ref={box} className="overflow-x-auto rounded-2xl border border-ink-700/70 bg-ink-950/70 p-1" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(122,136,168,.12) 1px, transparent 0)', backgroundSize: '22px 22px' }}>
        <div className="mx-auto" style={{ width: W * scale, height: H * scale }}>
          <div className="relative origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
            <svg className="absolute inset-0" width={W} height={H}>
              <defs>
                <marker id="fa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#7a88a8" />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const a = layout.pos.get(e.from)
                const b = layout.pos.get(e.to)
                if (!a || !b) return null
                let d: string
                let mx: number
                let my: number
                if (vertical) {
                  const x1 = a.x + NW / 2 + pad
                  const y1 = a.y + NH + pad
                  const x2 = b.x + NW / 2 + pad
                  const y2 = b.y + pad - 2
                  if (y2 <= y1) {
                    const rx = Math.max(a.x, b.x) + NW + pad
                    d = `M${a.x + NW + pad},${a.y + NH / 2 + pad} C${rx + 50},${a.y + NH / 2 + pad} ${rx + 50},${b.y + NH / 2 + pad} ${b.x + NW + pad + 2},${b.y + NH / 2 + pad}`
                    mx = rx + 38
                    my = (a.y + b.y) / 2 + NH / 2 + pad
                  } else {
                    d = `M${x1},${y1} C${x1},${y1 + GYV / 2} ${x2},${y2 - GYV / 2} ${x2},${y2}`
                    mx = (x1 + x2) / 2
                    my = (y1 + y2) / 2
                  }
                } else {
                  const x1 = a.x + NW + pad
                  const y1 = a.y + NH / 2 + pad
                  const x2 = b.x + pad - 2
                  const y2 = b.y + NH / 2 + pad
                  if (x2 <= x1) {
                    d = `M${a.x + NW / 2 + pad},${a.y + NH + pad} C${a.x + NW / 2 + pad},${a.y + NH + 40 + pad} ${b.x + NW / 2 + pad},${b.y + NH + 40 + pad} ${b.x + NW / 2 + pad},${b.y + NH + pad + 2}`
                    mx = (a.x + b.x) / 2 + NW / 2 + pad
                    my = Math.max(a.y, b.y) + NH + 30 + pad
                  } else {
                    d = `M${x1},${y1} C${x1 + GX / 2},${y1} ${x2 - GX / 2},${y2} ${x2},${y2}`
                    mx = (x1 + x2) / 2
                    my = (y1 + y2) / 2
                  }
                }
                const color = e.dashed ? '#fbbf24' : '#7a88a8'
                return (
                  <g key={i}>
                    <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeDasharray={e.dashed ? '5 4' : undefined} markerEnd="url(#fa)" opacity={0.9} />
                    {e.label && (
                      <g transform={`translate(${mx},${my})`}>
                        <rect x={-e.label.length * 3.1 - 6} y={-9} width={e.label.length * 6.2 + 12} height={17} rx={5} fill="#05070d" stroke="#1f2b47" />
                        <text textAnchor="middle" dominantBaseline="middle" y={0.5} fill={e.dashed ? '#fde68a' : '#d6dcea'} fontSize={10.5} fontFamily="JetBrains Mono">{e.label}</text>
                      </g>
                    )}
                  </g>
                )
              })}
            </svg>
            {nodes.map((n) => {
              const p = layout.pos.get(n.id)
              if (!p) return null
              const m = FLOW_META[n.kind] ?? FLOW_META.unknown
              return (
                <div key={n.id} className="absolute flex items-center gap-2 rounded-xl border bg-ink-900 px-2.5 shadow-panel" style={{ left: p.x + pad, top: p.y + pad, width: NW, height: NH, borderColor: `${m.color}66`, boxShadow: `0 0 18px -6px ${m.color}66` }}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: m.color, background: `${m.color}14` }}>
                    <Icon name={m.icon} size={14} color={m.color} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold leading-tight text-white" title={n.label}>{n.label}</div>
                    <div className="truncate text-[10.5px] leading-tight text-ink-300" title={n.sub}>{n.sub ?? m.label}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {caption && <figcaption className="mt-1.5 text-center text-[12px] italic text-ink-400">{caption}</figcaption>}
    </figure>
  )
}

// ── Vérification intégrée ──────────────────────────────────────────────────

function InlineCheck({ b, lessonId, index }: { b: Extract<Block, { type: 'check' }>; lessonId: string; index: number }) {
  const recorded = useProfile((s) => s.lessons[lessonId]?.checks?.[index])
  const [chosen, setChosen] = useState<number | null>(null)
  const done = chosen !== null
  return (
    <div className="rounded-2xl border border-violet-400/30 bg-violet-400/[0.05] p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-violet-300">
        <Icon name="BrainCircuit" size={13} /> Vérifiez votre compréhension
        {recorded !== undefined && !done && <span className="ml-auto normal-case tracking-normal text-ink-400">déjà répondu ({recorded ? 'juste' : 'faux'})</span>}
      </div>
      <div className="text-[14px] font-medium text-white">{b.q}</div>
      <div className="mt-3 grid gap-1.5">
        {b.options.map((o, i) => {
          const good = done && i === b.answer
          const bad = done && i === chosen && i !== b.answer
          return (
            <button
              key={i}
              disabled={done}
              onClick={() => {
                setChosen(i)
                useProfile.getState().recordCheck(lessonId, index, i === b.answer)
              }}
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-[13.5px] transition ${good ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-50' : bad ? 'border-rose-400/60 bg-rose-400/10 text-rose-50' : 'border-ink-700 text-ink-100 hover:border-violet-400/50 hover:bg-ink-800'}`}
            >
              <span className="mt-0.5 font-mono text-[11px] text-ink-400">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1">{o}</span>
              {good && <Icon name="CircleCheck" size={16} className="text-emerald-400" />}
              {bad && <Icon name="CircleX" size={16} className="text-rose-400" />}
            </button>
          )
        })}
      </div>
      {done && (
        <div className="mt-3 flex gap-2 rounded-xl bg-ink-900/80 p-3 text-[13px] leading-relaxed text-ink-200 animate-fadein">
          <Icon name={chosen === b.answer ? 'PartyPopper' : 'Lightbulb'} size={15} className={`mt-0.5 shrink-0 ${chosen === b.answer ? 'text-emerald-400' : 'text-yellow-300'}`} />
          <span>{b.explain}</span>
        </div>
      )}
    </div>
  )
}

// ── Simulateur ─────────────────────────────────────────────────────────────

function WidgetHost({ id, caption }: { id: WidgetId; caption?: string }) {
  const w = WIDGETS[id]
  return (
    <div className="overflow-hidden rounded-2xl border border-accent/30 bg-ink-900/80 shadow-glow">
      <div className="flex items-center gap-2 border-b border-ink-700/70 bg-accent/[0.06] px-4 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent"><Icon name="FlaskConical" size={14} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-accent">Simulateur interactif</div>
          <div className="truncate text-[13.5px] font-semibold text-white">{w?.title ?? id}</div>
        </div>
      </div>
      <div className="p-4">{w ? <w.component /> : <div className="py-6 text-center text-[12.5px] text-ink-400">Simulateur en cours de préparation.</div>}</div>
      {caption && <div className="border-t border-ink-700/70 px-4 py-2 text-[12px] italic text-ink-400">{caption}</div>}
    </div>
  )
}

// ── Rendu d'un bloc ────────────────────────────────────────────────────────

const CALLOUT: Record<string, { color: string; icon: string; title: string }> = {
  tip: { color: '#22d3ee', icon: 'Lightbulb', title: 'Astuce' },
  warn: { color: '#fb923c', icon: 'TriangleAlert', title: 'Attention' },
  law: { color: '#a78bfa', icon: 'Scale', title: 'Point juridique' },
  field: { color: '#34d399', icon: 'Binoculars', title: 'Sur le terrain' },
  example: { color: '#facc15', icon: 'BookMarked', title: 'Exemple' },
}

export function headingId(i: number) {
  return `blk-${i}`
}

export function BlockView({ b, lessonId, index }: { b: Block; lessonId: string; index: number }) {
  switch (b.type) {
    case 'heading':
      return (
        <h2 id={headingId(index)} className="scroll-mt-24 pt-4 text-[21px] font-bold tracking-tight text-white">
          {b.text}
        </h2>
      )
    case 'text':
      return <Md md={b.md} />
    case 'callout': {
      const c = CALLOUT[b.kind] ?? CALLOUT.tip
      return (
        <div className="flex gap-3 rounded-2xl border px-4 py-3.5" style={{ borderColor: `${c.color}40`, background: `${c.color}0b` }}>
          <Icon name={c.icon} size={18} color={c.color} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: c.color }}>{b.title ?? c.title}</div>
            <Md md={b.md} className="!text-[13.5px] [&_p:last-child]:mb-0" />
          </div>
        </div>
      )
    }
    case 'flow':
      return <FlowDiagram nodes={b.nodes} edges={b.edges} caption={b.caption} />
    case 'table':
      return (
        <figure>
          <div className="overflow-x-auto rounded-2xl border border-ink-700/70">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-ink-850 text-[11.5px] uppercase tracking-wider text-ink-300">
                <tr>{b.headers.map((h, i) => <th key={i} className="px-3.5 py-2.5 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i} className="border-t border-ink-700/60 odd:bg-ink-900/40">
                    {r.map((c, j) => <td key={j} className={`px-3.5 py-2.5 align-top text-ink-100 ${j === 0 ? 'font-medium text-white' : ''}`}><InlineMd text={c} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {b.caption && <figcaption className="mt-1.5 text-center text-[12px] italic text-ink-400">{b.caption}</figcaption>}
        </figure>
      )
    case 'steps':
      return (
        <ol className="relative space-y-3 pl-1">
          {b.items.map((it, i) => (
            <li key={i} className="relative flex gap-3.5">
              {i < b.items.length - 1 && <span className="absolute left-[15px] top-9 h-[calc(100%-18px)] w-px bg-ink-600" />}
              <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent/50 bg-ink-900 font-mono text-[13px] font-semibold text-accent">{i + 1}</span>
              <div className="min-w-0 flex-1 rounded-xl border border-ink-700/60 bg-ink-900/50 px-3.5 py-2.5">
                <div className="text-[14px] font-semibold text-white">{it.title}</div>
                <Md md={it.md} className="!text-[13.5px] mt-1 [&_p:last-child]:mb-0" />
              </div>
            </li>
          ))}
        </ol>
      )
    case 'terms':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {b.items.map((t, i) => (
            <div key={i} className="rounded-xl border border-ink-700/60 bg-ink-900/50 px-3.5 py-2.5">
              <div className="font-mono text-[13px] font-semibold text-cyan-200">{t.term}</div>
              <div className="mt-0.5 text-[13px] leading-relaxed text-ink-200"><InlineMd text={t.def} /></div>
            </div>
          ))}
        </div>
      )
    case 'compare':
      return (
        <div className="grid gap-3 md:grid-cols-2">
          {[b.left, b.right].map((side, i) => (
            <div key={i} className="rounded-2xl border bg-ink-900/50 p-4" style={{ borderColor: i ? '#a78bfa55' : '#22d3ee55' }}>
              <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold" style={{ color: i ? '#c4b5fd' : '#67e8f9' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: i ? '#a78bfa' : '#22d3ee' }} /> {side.title}
              </div>
              <Md md={side.md} className="!text-[13.5px] [&_p:last-child]:mb-0" />
            </div>
          ))}
        </div>
      )
    case 'check':
      return <InlineCheck b={b} lessonId={lessonId} index={index} />
    case 'widget':
      return <WidgetHost id={b.id} caption={b.caption} />
    case 'case':
      return (
        <div className="overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.07] to-transparent">
          <div className="flex items-center gap-2 border-b border-amber-400/20 px-4 py-2.5">
            <Icon name="FolderSearch" size={15} className="text-amber-300" />
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-300">Étude de cas</span>
            <span className="truncate text-[13.5px] font-semibold text-white">{b.title}</span>
          </div>
          <div className="px-4 py-3"><Md md={b.md} className="!text-[13.5px] [&_p:last-child]:mb-0" /></div>
        </div>
      )
    case 'quote':
      return (
        <blockquote className="rounded-r-2xl border-l-4 border-accent/60 bg-ink-900/50 px-5 py-3">
          <Md md={b.md} className="!text-[14px] italic [&_p:last-child]:mb-0" />
          <div className="mt-1 text-[12px] text-ink-400">— {b.source}</div>
        </blockquote>
      )
  }
}

/** Markdown en ligne (gras, code) pour les cellules et définitions. */
function InlineMd({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong> : p.startsWith('`') && p.endsWith('`') ? <code key={i} className="rounded border border-ink-600 bg-ink-800 px-1 font-mono text-[0.88em] text-cyan-200">{p.slice(1, -1)}</code> : <span key={i}>{p}</span>,
      )}
    </>
  )
}
