import { CHAINS } from '../engine/chains'
import type { ScenarioTemplate } from '../scenarios/types'
import { CHAIN_LOGOS } from './logos'

// Miniature du schéma de blanchiment d'une mission, dans le langage visuel du
// graphe : victime en cercle double, suspect en losange, service en carré,
// hypothèse en pointillé, épaisseur des flux selon le montant.

export type FlowPattern =
  | 'direct' | 'sweep' | 'fanin' | 'peel' | 'mixer' | 'coinjoin' | 'bridge' | 'swap'
  | 'freeze' | 'wall' | 'poison' | 'atm' | 'lightning' | 'contract' | 'tag' | 'split'

const BY_ID: Record<string, FlowPattern> = {
  'guide-exchange': 'sweep',
  'deb-victimes-multiples': 'fanin',
  'guide-rapport': 'fanin',
  'sextortion-cluster': 'fanin',
  'donation-funding': 'fanin',
  'ponzi-mlm': 'fanin',
  'money-mules': 'split',
  'splitter-internes': 'split',
  'dab-cash-p2p': 'atm',
  'lightning-cashout': 'lightning',
  'xrp-destination-tag': 'tag',
  'deb-ton-commentaire': 'tag',
  'depot-contrat': 'contract',
  'approve-drain': 'contract',
  'monero-wall': 'wall',
  'monero-atomic': 'wall',
}

/** Schéma dominant d'une mission, déduit de ses compétences. */
export function flowPattern(s: ScenarioTemplate): FlowPattern {
  const byId = BY_ID[s.id]
  if (byId) return byId
  const k = new Set(s.skills)
  if (k.has('coinjoin')) return 'coinjoin'
  if (k.has('mixer')) return 'mixer'
  if (k.has('privacy')) return 'wall'
  if (k.has('bridge') || k.has('crosschain')) return 'bridge'
  if (k.has('poisoning')) return 'poison'
  if (k.has('peel')) return 'peel'
  if (k.has('gel')) return 'freeze'
  if (k.has('dex')) return 'swap'
  if (k.has('defi')) return 'contract'
  if (k.has('memo')) return 'tag'
  if (k.has('cioh')) return 'fanin'
  if (k.has('exchange_id') && s.guided) return 'sweep'
  return 'direct'
}

const C = {
  victim: 'rgb(94 200 229)',
  victimFill: 'rgb(94 200 229 / .14)',
  suspect: 'rgb(255 138 76)',
  suspectFill: 'rgb(255 138 76 / .16)',
  line: 'rgb(var(--ink-400))',
  node: 'rgb(var(--ink-800))',
  strong: 'rgb(var(--ink-200))',
}

type N = [x: number, y: number, kind: 'v' | 's' | 'a' | 'x' | 'X' | 't' | 'h' | 'm' | 'w' | 'l' | 'c' | 'd' | 'k']
type E = [from: number, to: number, w: number, style?: 'faint' | 'alt' | 'dash']

const P: Record<FlowPattern, { n: N[]; e: E[] }> = {
  direct: { n: [[50, 56, 'v'], [112, 56, 't'], [176, 56, 's'], [246, 56, 'x']], e: [[0, 1, 3], [1, 2, 3], [2, 3, 3]] },
  sweep: {
    n: [[50, 56, 'v'], [140, 56, 'x'], [236, 56, 'X'], [176, 18, 'a'], [176, 94, 'a']],
    e: [[0, 1, 3], [1, 2, 3], [3, 2, 1.4, 'faint'], [4, 2, 1.4, 'faint']],
  },
  fanin: {
    n: [[50, 22, 'v'], [50, 56, 'v'], [50, 90, 'v'], [170, 56, 's'], [246, 56, 'x']],
    e: [[0, 3, 1.8], [1, 3, 2.4], [2, 3, 1.4], [3, 4, 3.4]],
  },
  peel: {
    n: [[40, 26, 's'], [100, 42, 'a'], [160, 58, 'a'], [220, 74, 'a'], [270, 90, 'h'], [118, 92, 'x'], [178, 98, 'x']],
    e: [[0, 1, 3.4], [1, 2, 2.8], [2, 3, 2.2], [3, 4, 1.6], [1, 5, 1, 'faint'], [2, 6, 1, 'faint']],
  },
  mixer: {
    n: [[40, 56, 's'], [150, 56, 'm'], [256, 24, 'h'], [256, 56, 'h'], [256, 88, 'h'], [96, 18, 'a'], [96, 94, 'a']],
    e: [[0, 1, 3], [5, 1, 1.2, 'faint'], [6, 1, 1.2, 'faint'], [1, 2, 1.4, 'dash'], [1, 3, 1.4, 'dash'], [1, 4, 1.4, 'dash']],
  },
  coinjoin: {
    n: [[44, 20, 's'], [44, 44, 'a'], [44, 68, 'a'], [44, 92, 'a'], [150, 56, 'c'], [256, 20, 'h'], [256, 44, 'a'], [256, 68, 'a'], [256, 92, 'a']],
    e: [[0, 4, 2], [1, 4, 2, 'faint'], [2, 4, 2, 'faint'], [3, 4, 2, 'faint'], [4, 5, 2, 'dash'], [4, 6, 2, 'faint'], [4, 7, 2, 'faint'], [4, 8, 2, 'faint']],
  },
  bridge: {
    n: [[44, 34, 's'], [150, 34, 'x'], [150, 82, 'x'], [256, 82, 's']],
    e: [[0, 1, 3], [1, 2, 2, 'dash'], [2, 3, 3, 'alt']],
  },
  swap: { n: [[50, 56, 'v'], [148, 56, 'd'], [246, 56, 'h']], e: [[0, 1, 3], [1, 2, 3, 'alt']] },
  freeze: { n: [[40, 56, 'v'], [108, 56, 's'], [176, 56, 's'], [248, 56, 'l']], e: [[0, 1, 3], [1, 2, 3], [2, 3, 3]] },
  wall: { n: [[44, 56, 's'], [130, 56, 'x'], [216, 56, 'w'], [276, 56, 'h']], e: [[0, 1, 3], [1, 2, 3, 'alt'], [2, 3, 1.4, 'dash']] },
  poison: {
    n: [[50, 56, 'v'], [246, 24, 'a'], [246, 88, 's']],
    e: [[0, 1, 1.4, 'faint'], [0, 2, 3]],
  },
  atm: { n: [[44, 56, 'v'], [126, 56, 's'], [206, 56, 't'], [262, 56, 'k']], e: [[0, 1, 3], [1, 2, 3], [2, 3, 3]] },
  lightning: { n: [[44, 56, 's'], [120, 56, 't'], [208, 56, 't'], [262, 56, 'x']], e: [[0, 1, 3], [1, 2, 2, 'dash'], [2, 3, 2.4]] },
  contract: {
    n: [[50, 56, 'v'], [146, 56, 'd'], [246, 24, 's'], [246, 88, 's']],
    e: [[0, 1, 3], [1, 2, 2.2], [1, 3, 1.6]],
  },
  tag: {
    n: [[50, 26, 'v'], [50, 86, 'v'], [176, 56, 'X'], [264, 56, 'x']],
    e: [[0, 2, 2.2], [1, 2, 2.2], [2, 3, 1.4, 'faint']],
  },
  split: {
    n: [[44, 56, 's'], [138, 22, 'a'], [138, 56, 'a'], [138, 90, 'a'], [246, 56, 'x']],
    e: [[0, 1, 1.8], [0, 2, 1.8], [0, 3, 1.8], [1, 4, 1.8], [2, 4, 1.8], [3, 4, 1.8]],
  },
}

function Node({ n }: { n: N }) {
  const [x, y, k] = n
  switch (k) {
    case 'v':
      return (
        <g>
          <circle cx={x} cy={y} r={10} fill={C.victimFill} stroke={C.victim} strokeWidth={1.6} />
          <circle cx={x} cy={y} r={5.5} fill="none" stroke={C.victim} strokeWidth={1.2} />
        </g>
      )
    case 's':
      return <rect x={x - 9} y={y - 9} width={18} height={18} rx={2.5} transform={`rotate(45 ${x} ${y})`} fill={C.suspectFill} stroke={C.suspect} strokeWidth={1.6} />
    case 'a':
      return <circle cx={x} cy={y} r={7} fill={C.node} stroke={C.line} strokeWidth={1.3} />
    case 'h':
      return <circle cx={x} cy={y} r={8} fill="none" stroke={C.line} strokeWidth={1.4} strokeDasharray="2.5 2.5" />
    case 't':
      return <rect x={x - 5} y={y - 5} width={10} height={10} rx={2} fill={C.node} stroke={C.line} strokeWidth={1.2} />
    case 'x':
      return <rect x={x - 12} y={y - 12} width={24} height={24} rx={5} fill={C.node} stroke={C.line} strokeWidth={1.3} />
    case 'X':
      return <rect x={x - 16} y={y - 16} width={32} height={32} rx={7} fill={C.node} stroke={C.strong} strokeWidth={1.3} />
    case 'm':
      return (
        <g>
          <rect x={x - 15} y={y - 15} width={30} height={30} rx={7} fill={C.node} stroke={C.strong} strokeWidth={1.3} />
          <path d={`M${x - 7} ${y - 5}h4l6 10h4M${x - 7} ${y + 5}h4l6-10h4`} fill="none" stroke={C.strong} strokeWidth={1.4} strokeLinecap="round" />
        </g>
      )
    case 'c':
      return (
        <g>
          <rect x={x - 14} y={y - 30} width={28} height={60} rx={6} fill={C.node} stroke={C.strong} strokeWidth={1.3} />
          <path d={`M${x - 6} ${y - 14}h12M${x - 6} ${y - 4}h12M${x - 6} ${y + 6}h12M${x - 6} ${y + 16}h12`} stroke={C.line} strokeWidth={1.2} strokeLinecap="round" />
        </g>
      )
    case 'd':
      return (
        <g>
          <circle cx={x} cy={y} r={15} fill={C.node} stroke={C.strong} strokeWidth={1.3} />
          <path d={`M${x - 7} ${y - 3}h13l-3-3M${x + 7} ${y + 3}h-13l3 3`} fill="none" stroke={C.strong} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    case 'w':
      return (
        <g>
          <rect x={x - 6} y={y - 24} width={12} height={48} rx={3} fill={C.node} stroke={C.strong} strokeWidth={1.3} />
          <path d={`M${x - 6} ${y - 12}l12-8M${x - 6} ${y}l12-8M${x - 6} ${y + 12}l12-8M${x - 6} ${y + 24}l12-8`} stroke={C.line} strokeWidth={1} />
        </g>
      )
    case 'l':
      return (
        <g>
          <rect x={x - 13} y={y - 13} width={26} height={26} rx={5} fill={C.node} stroke={C.strong} strokeWidth={1.3} />
          <rect x={x - 5.5} y={y - 1} width={11} height={8} rx={1.5} fill="none" stroke="rgb(var(--accent))" strokeWidth={1.4} />
          <path d={`M${x - 3} ${y - 1}v-2.5a3 3 0 0 1 6 0V${y - 1}`} fill="none" stroke="rgb(var(--accent))" strokeWidth={1.4} />
        </g>
      )
    case 'k':
      return (
        <g>
          <rect x={x - 11} y={y - 15} width={22} height={30} rx={4} fill={C.node} stroke={C.strong} strokeWidth={1.3} />
          <rect x={x - 6} y={y - 9} width={12} height={7} rx={1} fill="none" stroke={C.line} strokeWidth={1.1} />
          <path d={`M${x - 6} ${y + 6}h12`} stroke={C.line} strokeWidth={1.4} strokeLinecap="round" />
        </g>
      )
  }
}

/** Point d'accroche d'une arête sur le bord d'un nœud (approximation circulaire). */
function edge(a: N, b: N, ra: number, rb: number) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const d = Math.hypot(dx, dy) || 1
  return { x1: a[0] + (dx / d) * ra, y1: a[1] + (dy / d) * ra, x2: b[0] - (dx / d) * rb, y2: b[1] - (dy / d) * rb }
}
const RADIUS: Record<N[2], number> = { v: 11, s: 13, a: 8, h: 9, t: 6, x: 13, X: 17, m: 16, c: 15, d: 16, w: 7, l: 14, k: 12 }

export function FlowGlyph({ s, className }: { s: ScenarioTemplate; className?: string }) {
  const p = P[flowPattern(s)]
  const main = CHAINS[s.chains[0]]?.color ?? '#f2a541'
  const alt = CHAINS[s.chains[1] ?? s.chains[0]]?.color ?? main
  const altColor = s.chains[1] ? alt : flowPattern(s) === 'swap' ? '#3fc7a4' : main
  return (
    <div className={`relative h-[112px] overflow-hidden grid-bg ${className ?? ''}`} style={{ backgroundSize: '16px 16px' }}>
      <svg viewBox="0 0 300 112" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
        {p.e.map(([f, t, w, st], i) => {
          const g = edge(p.n[f], p.n[t], RADIUS[p.n[f][2]], RADIUS[p.n[t][2]])
          return (
            <line
              key={i}
              {...g}
              stroke={st === 'alt' ? altColor : st === 'faint' ? C.line : main}
              strokeOpacity={st === 'faint' ? 0.45 : 0.9}
              strokeWidth={w}
              strokeDasharray={st === 'dash' ? '3 4' : undefined}
              strokeLinecap="round"
            />
          )
        })}
        {p.n.map((n, i) => <Node key={i} n={n} />)}
      </svg>
      <div className="absolute bottom-2 right-2 flex -space-x-1">
        {s.chains.map((c) => <img key={c} src={CHAIN_LOGOS[c]} alt="" width={16} height={16} className="rounded-full ring-2 ring-ink-950" />)}
      </div>
    </div>
  )
}
