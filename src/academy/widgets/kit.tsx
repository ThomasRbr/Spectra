// Briques communes aux simulateurs de l'Académie (consigne, explication,
// curseurs, interrupteurs, SHA-256 réel, encodage Base58Check).
import { type ReactNode, useEffect, useState } from 'react'
import { Icon } from '../../ui/common'

export const C = {
  cyan: '#7ea6ff',
  rose: '#f43f5e',
  green: '#34d399',
  amber: '#facc15',
  orange: '#fb923c',
  violet: '#a78bfa',
  slate: '#959da9',
}

/** Ligne de consigne (« Manipulez… »). */
export function Instr({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-dense text-ink-200">
      <Icon name="MousePointerClick" size={14} className="mt-0.5 shrink-0 text-accent" />
      <div>{children}</div>
    </div>
  )
}

/** Encadré « Ce que vous voyez » dont le contenu change avec l'état. */
export function Explain({ children, tone = 'info', title = 'Ce que vous voyez' }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok' | 'bad'; title?: string }) {
  const col = tone === 'warn' ? C.orange : tone === 'ok' ? C.green : tone === 'bad' ? C.rose : C.cyan
  const icon = tone === 'warn' ? 'TriangleAlert' : tone === 'ok' ? 'CircleCheck' : tone === 'bad' ? 'OctagonAlert' : 'Eye'
  return (
    <div className="flex gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors duration-300" style={{ borderColor: `${col}44`, background: `${col}0c` }}>
      <Icon name={icon} size={15} color={col} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-dense leading-relaxed text-ink-100">
        <div className="mb-0.5 text-micro font-semibold uppercase tracking-wider" style={{ color: col }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  )
}

export function Box({ children, className, title, right }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode }) {
  return (
    <div className={`rounded-xl border border-ink-700 bg-ink-850/80 p-3 ${className ?? ''}`}>
      {(title || right) && (
        <div className="mb-2 flex min-h-[24px] items-center justify-between gap-2">
          {title && <div className="label !text-micro">{title}</div>}
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

export function Slider({ label, value, min, max, step = 1, onChange, display, id }: { label: ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; display?: ReactNode; id?: string }) {
  return (
    <label className="block" htmlFor={id}>
      <div className="mb-1 flex items-center justify-between gap-2 text-meta">
        <span className="text-ink-300">{label}</span>
        <span className="font-mono text-accent">{display ?? value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full cursor-pointer accent-accent" />
    </label>
  )
}

export function Toggle({ label, checked, onChange, hint, color = C.cyan }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode; color?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${checked ? 'bg-ink-800' : 'border-ink-700 bg-ink-900/60 hover:border-ink-500'}`}
      style={checked ? { borderColor: `${color}66` } : undefined}
    >
      <span className="relative mt-0.5 inline-block h-4 w-7 shrink-0 rounded-full transition" style={{ background: checked ? color : '#3d444f' }}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${checked ? 'left-3.5' : 'left-0.5'}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-dense font-medium text-ink-100">{label}</span>
        {hint && <span className="block text-micro leading-snug text-ink-300">{hint}</span>}
      </span>
    </button>
  )
}

export function Seg<T extends string | number>({ options, value, onChange }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-ink-700/60 bg-ink-950/60 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-md px-2.5 py-1 text-meta font-medium transition ${value === o.id ? 'bg-ink-700 text-white shadow' : 'text-ink-300 hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function short(s: string, n = 6): string {
  if (s.length <= n * 2 + 1) return s
  return `${s.slice(0, n)}…${s.slice(-n + 1)}`
}

export function num(v: number, d = 2): string {
  return v.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: 0 })
}

export function btc(v: number, d = 8): string {
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} BTC`
}

// ── Cryptographie (réelle) ─────────────────────────────────────────────────

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0')
  return s
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(await sha256Bytes(new TextEncoder().encode(text)))
}

/** Empreinte SHA-256 calculée de manière asynchrone (null pendant le calcul initial). */
export function useSha256(text: string): string | null {
  const [h, setH] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    sha256Hex(text).then((r) => {
      if (alive) setH(r)
    })
    return () => {
      alive = false
    }
  }, [text])
  return h
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function base58(bytes: Uint8Array): string {
  let n = BigInt('0x' + (toHex(bytes) || '0'))
  let s = ''
  while (n > 0n) {
    s = B58[Number(n % 58n)] + s
    n /= 58n
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) s = '1' + s
  return s
}

/** Base58Check : version + charge utile + 4 octets de double SHA-256. */
export async function base58check(version: number, payload: Uint8Array): Promise<{ address: string; checksum: string }> {
  const body = new Uint8Array(payload.length + 1)
  body[0] = version
  body.set(payload, 1)
  const chk = (await sha256Bytes(await sha256Bytes(body))).slice(0, 4)
  const full = new Uint8Array(body.length + 4)
  full.set(body)
  full.set(chk, body.length)
  return { address: base58(full), checksum: toHex(chk) }
}

export function popcount8(x: number): number {
  let c = 0
  while (x) {
    c += x & 1
    x >>= 1
  }
  return c
}
