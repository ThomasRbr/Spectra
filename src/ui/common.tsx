import { type ReactNode, useEffect, useRef, useState } from 'react'
import { icons, X, Copy, Check } from 'lucide-react'
import { CHAINS, type ChainId } from '../engine/chains'
import { CATEGORY, RISK_META, type Entity, type RiskLevel } from '../engine/entities'
import { DIFFICULTY, type Difficulty } from '../scenarios/types'
import { CHAIN_LOGOS, entityLogo } from './logos'

/**
 * Couleur de donnée lisible comme texte dans les deux thèmes : mélangée au
 * texte fort du thème (vers le blanc sur encre, vers le noir sur papier).
 */
export function tint(color: string): string {
  return `color-mix(in oklab, ${color} var(--tint), rgb(var(--ink-strong)))`
}

export function Icon({ name, size = 16, className, color, strokeWidth = 2 }: { name: string; size?: number; className?: string; color?: string; strokeWidth?: number }) {
  const C = (icons as Record<string, typeof X>)[name] ?? icons.Circle
  return <C size={size} className={className} color={color} strokeWidth={strokeWidth} />
}

/** Logo de marque, rogné en cercle comme les nœuds du graphe. */
export function Logo({ src, size = 16, className = '' }: { src: string; size?: number; className?: string }) {
  return <img src={src} alt="" width={size} height={size} draggable={false} className={`shrink-0 rounded-full ${className}`} />
}

/** Logo de l'entité s'il existe, sinon l'icône de sa catégorie. */
export function EntityIcon({ entity, size = 16, color }: { entity: Entity; size?: number; color?: string }) {
  const logo = entityLogo(entity.id)
  return logo ? <Logo src={logo} size={size} /> : <Icon name={CATEGORY[entity.category].icon} size={size} color={color} />
}

// Les badges restent neutres : la couleur de donnée vit dans le logo ou la
// pastille, le texte garde le contraste du thème (sombre comme papier).

export function ChainBadge({ chain, compact }: { chain: ChainId; compact?: boolean }) {
  const c = CHAINS[chain]
  return (
    <span className="chip border border-ink-600 text-ink-100" title={c.name}>
      <Logo src={CHAIN_LOGOS[chain]} size={13} />
      {compact ? c.short : c.name}
    </span>
  )
}

export function EntityChip({ entity, via }: { entity: Entity; via?: 'cluster' | 'direct' | 'none' }) {
  const m = CATEGORY[entity.category]
  return (
    <span className="chip border border-ink-600 text-ink-100" title={m.label}>
      {entityLogo(entity.id) ? <EntityIcon entity={entity} size={13} /> : <span className="h-2 w-2 rounded-sm" style={{ background: m.color }} />}
      {entity.name}
      {via === 'cluster' && <span className="text-ink-400">· via cluster</span>}
    </span>
  )
}

export function CategoryChip({ category }: { category: keyof typeof CATEGORY }) {
  const m = CATEGORY[category]
  return (
    <span className="chip bg-ink-800 text-ink-200">
      <Icon name={m.icon} size={12} color={m.color} /> {m.label}
    </span>
  )
}

export function RiskChip({ level, score }: { level: RiskLevel; score?: number }) {
  const r = RISK_META[level]
  return (
    <span className="chip border border-ink-600 text-ink-100">
      <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
      Risque {r.label.toLowerCase()}
      {score !== undefined && <span className="mono text-ink-300">· {score}</span>}
    </span>
  )
}

export function DifficultyBadge({ d }: { d: Difficulty }) {
  const m = DIFFICULTY[d]
  return (
    <span className="chip border border-ink-600 text-ink-100">
      <span className="flex items-end gap-[2px]" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className={`w-[3px] rounded-[1px] ${i < d ? 'bg-white' : 'bg-ink-500'}`} style={{ height: 5 + i * 2 }} />
        ))}
      </span>
      {m.label}
    </span>
  )
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      className={`text-ink-300 transition-colors hover:text-white ${className ?? ''}`}
      title="Copier"
      aria-label="Copier"
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
  return <span className={`font-mono text-meta ${className ?? ''}`}>{children}</span>
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
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 animate-fadein" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={`flex max-h-[90vh] w-full flex-col rounded-xl border border-ink-600 bg-ink-850 shadow-pop ${width}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-ink-700 px-5 py-3.5">
          {icon && (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-800 text-ink-200">
              <Icon name={icon} size={16} />
            </span>
          )}
          <div className="flex-1 text-title font-semibold text-white">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
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
    <div role="tablist" className={`flex gap-0.5 rounded-lg border border-ink-700 bg-ink-900 p-[3px] ${size === 'xs' ? 'flex-wrap' : ''}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md ${size === 'xs' ? 'px-2 py-1 text-meta' : 'px-2.5 py-1.5 text-dense'} font-medium transition-colors ${
            value === t.id ? 'bg-ink-700 text-white' : 'text-ink-300 hover:text-white'
          }`}
        >
          {t.icon && size !== 'xs' && <Icon name={t.icon} size={14} />}
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="rounded bg-ink-600 px-1 font-mono text-micro text-ink-100">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5">
      <div className="text-meta text-ink-300">{label}</div>
      <div className="mt-0.5 font-mono text-title font-medium text-white" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-micro text-ink-300">{sub}</div>}
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
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--ink-700))" strokeWidth={5} strokeDasharray={`${arc} ${c}`} transform={`rotate(135 ${size / 2} ${size / 2})`} strokeLinecap="round" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${(arc * score) / 100} ${c}`} transform={`rotate(135 ${size / 2} ${size / 2})`} strokeLinecap="round" />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fill="rgb(var(--ink-strong))" fontSize={size / 3.6} fontWeight={600} fontFamily="Inter">
        {score}
      </text>
      <text x="50%" y="78%" textAnchor="middle" fill={color} fontSize={8} fontWeight={600} fontFamily="Inter">
        {RISK_META[level].label.toUpperCase()}
      </text>
    </svg>
  )
}

export function ProgressBar({ value, color = 'rgb(var(--accent))', className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-ink-700 ${className ?? ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(1, value)) * 100)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  )
}

/** Rendu du markdown léger utilisé par l'Académie et les briefings. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/)
  return (
    <div className={`prose-spectra text-body ${className ?? ''}`}>
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        const first = lines[0].trimStart()
        if (first.startsWith('>') || first.startsWith('!>') || first.startsWith('⚖>')) {
          const kind = first.startsWith('!>') ? 'warn' : first.startsWith('⚖>') ? 'law' : 'tip'
          const content = lines.map((l) => l.replace(/^\s*(!>|⚖>|>)\s?/, '')).join(' ')
          const st =
            kind === 'warn'
              ? { box: 'bg-orange-400/[0.08]', fg: 'text-orange-300', i: 'TriangleAlert', t: 'Attention' }
              : kind === 'law'
                ? { box: 'bg-violet-400/[0.08]', fg: 'text-violet-300', i: 'Scale', t: 'Point juridique' }
                : { box: 'bg-accent/[0.08]', fg: 'text-accent', i: 'Lightbulb', t: 'Astuce' }
          return (
            <div key={i} className={`not-prose mb-4 flex gap-3 rounded-lg px-4 py-3 ${st.box}`}>
              <Icon name={st.i} size={16} className={`mt-0.5 shrink-0 ${st.fg}`} />
              <div className="font-sans text-body leading-relaxed text-ink-100">
                <div className={`mb-0.5 text-meta font-semibold ${st.fg}`}>
                  {st.t}
                </div>
                {inline(content)}
              </div>
            </div>
          )
        }
        if (lines.every((l) => /^\s*[-•]\s/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•]\s/, ''))}</li>)}</ul>
        if (lines.every((l) => /^\s*\d+[.)]\s/.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s/, ''))}</li>)}</ol>
        if (/^#{1,3}\s/.test(first)) return <h4 key={i} className="mb-2 mt-4 text-body font-semibold text-white">{first.replace(/^#+\s/, '')}</h4>
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
      <div className="text-body font-medium text-ink-100">{title}</div>
      {sub && <div className="max-w-xs text-meta text-ink-300">{sub}</div>}
    </div>
  )
}
