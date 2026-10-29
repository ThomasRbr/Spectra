import { type ReactNode, useEffect, useRef, useState } from 'react'
import { icons, X, Copy, Check } from 'lucide-react'
import { CHAINS, type ChainId } from '../engine/chains'
import { CATEGORY, RISK_META, type Entity, type RiskLevel } from '../engine/entities'
import { DIFFICULTY, type Difficulty } from '../scenarios/types'

export function Icon({ name, size = 16, className, color, strokeWidth = 2 }: { name: string; size?: number; className?: string; color?: string; strokeWidth?: number }) {
  const C = (icons as Record<string, typeof X>)[name] ?? icons.Circle
  return <C size={size} className={className} color={color} strokeWidth={strokeWidth} />
}

export function ChainBadge({ chain, compact }: { chain: ChainId; compact?: boolean }) {
  const c = CHAINS[chain]
  return (
    <span className="chip border" style={{ color: c.color, borderColor: `${c.color}55`, background: `${c.color}14` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
      {compact ? c.short : c.name}
    </span>
  )
}

export function EntityChip({ entity, via }: { entity: Entity; via?: 'cluster' | 'direct' | 'none' }) {
  const m = CATEGORY[entity.category]
  return (
    <span className="chip border" style={{ color: m.color, borderColor: `${m.color}55`, background: `${m.color}12` }}>
      <Icon name={m.icon} size={12} />
      {entity.name}
      {via === 'cluster' && <span className="opacity-70">· via cluster</span>}
    </span>
  )
}

export function CategoryChip({ category }: { category: keyof typeof CATEGORY }) {
  const m = CATEGORY[category]
  return (
    <span className="chip" style={{ color: m.color, background: `${m.color}18` }}>
      <Icon name={m.icon} size={11} /> {m.label}
    </span>
  )
}

export function RiskChip({ level, score }: { level: RiskLevel; score?: number }) {
  const r = RISK_META[level]
  return (
    <span className="chip border" style={{ color: r.color, borderColor: `${r.color}55`, background: `${r.color}14` }}>
      Risque {r.label}
      {score !== undefined && <span className="mono">· {score}</span>}
    </span>
  )
}

export function DifficultyBadge({ d }: { d: Difficulty }) {
  const m = DIFFICULTY[d]
  return (
    <span className="chip border" style={{ color: m.color, borderColor: `${m.color}55`, background: `${m.color}12` }}>
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < d ? m.color : `${m.color}33` }} />
      ))}
      {m.label}
    </span>
  )
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      className={`text-ink-300 hover:text-accent transition ${className ?? ''}`}
      title="Copier"
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard?.writeText(text).catch(() => undefined)
        setOk(true)
        setTimeout(() => setOk(false), 1200)
      }}
    >
      {ok ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[12px] ${className ?? ''}`}>{children}</span>
}

const modalStack: number[] = []
let modalSeq = 0

export function Modal({ open, onClose, title, children, width = 'max-w-2xl', icon }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string; icon?: string }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const id = ++modalSeq
    modalStack.push(id)
    // Échap ne ferme que la fenêtre la plus haute
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) closeRef.current()
    }
    window.addEventListener('keydown', h)
    return () => {
      window.removeEventListener('keydown', h)
      const i = modalStack.indexOf(id)
      if (i >= 0) modalStack.splice(i, 1)
    }
  }, [open])
  if (!open) return null
  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/75 backdrop-blur-sm p-4 animate-fadein" onMouseDown={onClose}>
      <div className={`panel-solid rounded-2xl shadow-panel w-full ${width} max-h-[90vh] flex flex-col`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-ink-700/70 px-5 py-3.5">
          {icon && (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
              <Icon name={icon} size={16} />
            </span>
          )}
          <div className="flex-1 text-[15px] font-semibold text-white">{title}</div>
          <button className="btn-ghost !p-1.5" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, size = 'sm' }: { tabs: { id: T; label: string; icon?: string; count?: number }[]; value: T; onChange: (t: T) => void; size?: 'sm' | 'xs' }) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-ink-950/60 p-0.5 border border-ink-700/60">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md ${size === 'xs' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'} font-medium transition ${
            value === t.id ? 'bg-ink-700 text-white shadow' : 'text-ink-300 hover:text-white'
          }`}
        >
          {t.icon && size !== 'xs' && <Icon name={t.icon} size={13} />}
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="rounded bg-accent/20 px-1 text-[10px] text-accent">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-ink-700/60 bg-ink-850/70 px-3 py-2.5">
      <div className="label !text-[10px]">{label}</div>
      <div className="mt-1 text-[15px] font-semibold text-white" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-300">{sub}</div>}
    </div>
  )
}

export function RiskGauge({ score, size = 64 }: { score: number; size?: number }) {
  const level: RiskLevel = score >= 85 ? 'severe' : score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low'
  const color = RISK_META[level].color
  const r = size / 2 - 6
  const c = 2 * Math.PI * r
  const arc = c * 0.75
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2b47" strokeWidth={6} strokeDasharray={`${arc} ${c}`} transform={`rotate(135 ${size / 2} ${size / 2})`} strokeLinecap="round" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={`${(arc * score) / 100} ${c}`} transform={`rotate(135 ${size / 2} ${size / 2})`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={size / 3.6} fontWeight={700} fontFamily="Inter">
        {score}
      </text>
      <text x="50%" y="78%" textAnchor="middle" fill={color} fontSize={8} fontWeight={600} fontFamily="Inter">
        {RISK_META[level].label.toUpperCase()}
      </text>
    </svg>
  )
}

export function ProgressBar({ value, color = '#22d3ee', className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-ink-700/70 ${className ?? ''}`}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color, boxShadow: `0 0 10px ${color}66` }} />
    </div>
  )
}

/** Rendu du markdown léger utilisé par l'Académie et les briefings. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/)
  return (
    <div className={`prose-spectra text-[13.5px] ${className ?? ''}`}>
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        const first = lines[0].trimStart()
        if (first.startsWith('>') || first.startsWith('!>') || first.startsWith('⚖>')) {
          const kind = first.startsWith('!>') ? 'warn' : first.startsWith('⚖>') ? 'law' : 'tip'
          const content = lines.map((l) => l.replace(/^\s*(!>|⚖>|>)\s?/, '')).join(' ')
          const st = kind === 'warn' ? { c: '#fb923c', i: 'TriangleAlert', t: 'Attention' } : kind === 'law' ? { c: '#a78bfa', i: 'Scale', t: 'Point juridique' } : { c: '#22d3ee', i: 'Lightbulb', t: 'Astuce' }
          return (
            <div key={i} className="mb-3 flex gap-3 rounded-xl border px-3.5 py-3" style={{ borderColor: `${st.c}44`, background: `${st.c}0d` }}>
              <Icon name={st.i} size={16} color={st.c} className="mt-0.5 shrink-0" />
              <div className="text-[13px] leading-relaxed text-ink-100">
                <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: st.c }}>
                  {st.t}
                </div>
                {inline(content)}
              </div>
            </div>
          )
        }
        if (lines.every((l) => /^\s*[-•]\s/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•]\s/, ''))}</li>)}</ul>
        if (lines.every((l) => /^\s*\d+[.)]\s/.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s/, ''))}</li>)}</ol>
        if (/^#{1,3}\s/.test(first)) return <h4 key={i} className="mb-2 mt-4 text-sm font-semibold text-white">{first.replace(/^#+\s/, '')}</h4>
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {inline(l)}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function inline(s: string): ReactNode[] {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
    return <span key={i}>{p}</span>
  })
}

export function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function Empty({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-ink-600 bg-ink-800 text-ink-300">
        <Icon name={icon} size={20} />
      </span>
      <div className="text-sm font-medium text-ink-100">{title}</div>
      {sub && <div className="max-w-xs text-xs text-ink-300">{sub}</div>}
    </div>
  )
}
