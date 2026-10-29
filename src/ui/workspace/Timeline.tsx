import { useEffect, useMemo, useRef, useState } from 'react'
import { CHAINS, fmtUsd } from '../../engine/chains'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { Icon, fmtTime } from '../common'

/** Frise chronologique des transactions présentes sur le graphe, avec sélection d'une plage. */
export function Timeline() {
  const inst = useGame((s) => s.inst)
  const revealed = useGame((s) => s.revealed)
  const selection = useGame((s) => s.selection)
  const range = useUi((s) => s.timeRange)
  const ref = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number; id: string } | null>(null)
  const w = inst?.world

  const txs = useMemo(() => (w ? Object.keys(revealed).map((id) => w.txs.get(id)!).filter(Boolean).sort((a, b) => a.time - b.time) : []), [w, revealed])
  const [W, setW] = useState(1000)
  const hasTx = txs.length > 0
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(200, el.clientWidth)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasTx])
  const H = 64
  if (!w || !txs.length) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[11.5px] text-ink-400">
        <Icon name="CalendarClock" size={14} /> La frise chronologique se remplit au fur et à mesure que vous dépliez des transactions.
      </div>
    )
  }
  const t0 = txs[0].time
  const t1 = Math.max(txs[txs.length - 1].time, t0 + 3600)
  const pad = (t1 - t0) * 0.03
  const a = t0 - pad
  const b = t1 + pad
  const x = (t: number) => ((t - a) / (b - a)) * W
  const tAt = (px: number) => a + (px / W) * (b - a)
  const maxUsd = Math.max(...txs.map((t) => w.txUsd(t)))
  const ticks = 6
  const toLocal = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    return Math.max(0, Math.min(W, ((clientX - r.left) / r.width) * W))
  }
  const selTx = selection?.kind === 'tx' ? selection.id : null

  return (
    <div className="relative flex h-full flex-col px-4 pb-1 pt-2">
      <div className="mb-1 flex items-center gap-3 text-[11px]">
        <span className="label !text-[10px]">Chronologie</span>
        <span className="text-ink-400">{txs.length} transactions · {fmtTime(t0)} → {fmtTime(t1)}</span>
        {range ? (
          <button className="chip ml-auto bg-accent/15 text-accent hover:bg-accent/25" onClick={() => useUi.getState().setTimeRange(null)}>
            <Icon name="X" size={10} /> Filtre : {fmtTime(range[0])} → {fmtTime(range[1])}
          </button>
        ) : (
          <span className="ml-auto text-ink-500">Glissez pour filtrer une période</span>
        )}
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H + 16}`}
        preserveAspectRatio="none"
        className="h-[80px] w-full cursor-crosshair select-none"
        onMouseDown={(e) => {
          const p = toLocal(e.clientX)
          setDrag({ x0: p, x1: p })
        }}
        onMouseMove={(e) => drag && setDrag({ ...drag, x1: toLocal(e.clientX) })}
        onMouseUp={() => {
          if (drag && Math.abs(drag.x1 - drag.x0) > 4) {
            const lo = Math.min(drag.x0, drag.x1)
            const hi = Math.max(drag.x0, drag.x1)
            useUi.getState().setTimeRange([tAt(lo), tAt(hi)])
          }
          setDrag(null)
        }}
        onMouseLeave={() => {
          setDrag(null)
          setHover(null)
        }}
      >
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const px = (i / ticks) * W
          return (
            <g key={i}>
              <line x1={px} x2={px} y1={0} y2={H} stroke="#172036" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={Math.min(W - 70, Math.max(2, px + 3))} y={H + 12} fill="#4a5a80" fontSize={9.5} fontFamily="JetBrains Mono">
                {new Date(tAt(px) * 1000).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </text>
            </g>
          )
        })}
        <line x1={0} x2={W} y1={H} y2={H} stroke="#2c3a5c" vectorEffect="non-scaling-stroke" />
        {range && <rect x={x(range[0])} width={Math.max(1, x(range[1]) - x(range[0]))} y={0} height={H} fill="rgba(34,211,238,0.08)" stroke="rgba(34,211,238,0.5)" vectorEffect="non-scaling-stroke" />}
        {txs.map((t) => {
          const v = w.txUsd(t)
          const h = 6 + (Math.log10(v + 1) / Math.log10(maxUsd + 1)) * (H - 10)
          const c = CHAINS[t.chain].color
          const inRange = !range || (t.time >= range[0] && t.time <= range[1])
          const sel = t.id === selTx
          return (
            <g
              key={t.id}
              opacity={inRange ? 1 : 0.2}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover({ x: x(t.time), y: H - h, id: t.id })}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => useGame.getState().select({ kind: 'tx', id: t.id })}
            >
              <line x1={x(t.time)} x2={x(t.time)} y1={H} y2={H - h} stroke={c} strokeWidth={sel ? 3 : 1.6} vectorEffect="non-scaling-stroke" opacity={0.85} />
              <circle cx={x(t.time)} cy={H - h} r={sel ? 4 : 2.6} fill={sel ? '#fff' : c} />
            </g>
          )
        })}
        {drag && <rect x={Math.min(drag.x0, drag.x1)} width={Math.abs(drag.x1 - drag.x0)} y={0} height={H} fill="rgba(34,211,238,0.12)" />}
      </svg>
      {hover && (() => {
        const t = w.tx(hover.id)
        return (
          <div className="pointer-events-none absolute z-20 rounded-lg panel-solid px-2.5 py-1.5 text-[11px] shadow-panel" style={{ left: `calc(${(hover.x / W) * 100}% + 8px)`, bottom: 56 }}>
            <div className="font-mono text-ink-100">{t.hash.slice(0, 14)}…</div>
            <div className="text-ink-300">{fmtTime(t.time)} · {CHAINS[t.chain].short} · {fmtUsd(w.txUsd(t))}</div>
          </div>
        )
      })()}
    </div>
  )
}
