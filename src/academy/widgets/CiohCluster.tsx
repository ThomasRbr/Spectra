import { useMemo, useState } from 'react'
import { Icon } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { genAddress } from '../../engine/addressgen'
import { C, Explain, Instr, short } from './kit'

const R = new Rng(3131)
const NODES = [
  { id: 'A', x: 60, y: 55 },
  { id: 'B', x: 160, y: 55 },
  { id: 'C', x: 260, y: 55 },
  { id: 'D', x: 360, y: 55 },
  { id: 'E', x: 60, y: 165 },
  { id: 'F', x: 160, y: 165 },
  { id: 'G', x: 260, y: 165 },
  { id: 'H', x: 480, y: 55 },
  { id: 'I', x: 600, y: 55 },
  { id: 'J', x: 540, y: 165 },
].map((n) => ({ ...n, address: genAddress(R, 'btc', 'p2wpkh') }))

interface Tx {
  id: string
  ins: { a: string; v: number }[]
  outs: { label: string; v: number }[]
  coinjoin?: boolean
  note: string
}

const TXS: Tx[] = [
  { id: 'T1', ins: [{ a: 'A', v: 0.8 }, { a: 'B', v: 0.35 }], outs: [{ label: 'paiement', v: 1 }, { label: 'rendu → C', v: 0.1497 }], note: 'Paiement de 1 BTC ; le rendu part vers C.' },
  { id: 'T2', ins: [{ a: 'C', v: 0.1497 }, { a: 'D', v: 0.42 }], outs: [{ label: 'paiement', v: 0.5 }, { label: 'rendu', v: 0.0694 }], note: 'C (le rendu de T1) est dépensé avec D.' },
  { id: 'T3', ins: [{ a: 'E', v: 0.21 }, { a: 'F', v: 0.09 }], outs: [{ label: 'paiement', v: 0.2997 }], note: 'Deux pièces fusionnées pour un paiement.' },
  { id: 'T4', ins: [{ a: 'F', v: 0.05 }, { a: 'G', v: 0.66 }], outs: [{ label: 'paiement', v: 0.7 }, { label: 'rendu', v: 0.0097 }], note: 'F réutilisée avec G.' },
  {
    id: 'T5',
    ins: [{ a: 'D', v: 0.1204 }, { a: 'H', v: 0.15 }, { a: 'I', v: 0.1031 }, { a: 'J', v: 0.2 }],
    outs: [{ label: '4 × égales', v: 0.4 }, { label: 'rendu D', v: 0.0203 }, { label: 'rendu H', v: 0.0499 }, { label: 'rendu I', v: 0.003 }, { label: 'rendu J', v: 0.0999 }],
    coinjoin: true,
    note: '4 entrées de montants variés, 4 sorties identiques de 0,1 BTC + rendus : signature d\'un CoinJoin.',
  },
]

const PALETTE = [C.cyan, C.violet, C.green, C.amber, '#f472b6', C.orange]
const fee = (t: Tx) => t.ins.reduce((s, i) => s + i.v, 0) - t.outs.reduce((s, o) => s + o.v, 0)

export default function CiohCluster() {
  const [applied, setApplied] = useState<string[]>([])
  const [cjWarn, setCjWarn] = useState(false)
  const forced = applied.includes('T5')

  const clusters = useMemo(() => {
    const parent: Record<string, string> = Object.fromEntries(NODES.map((n) => [n.id, n.id]))
    const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])))
    for (const t of TXS) if (applied.includes(t.id)) t.ins.forEach((i) => (parent[find(i.a)] = find(t.ins[0].a)))
    const groups: Record<string, string[]> = {}
    NODES.forEach((n) => (groups[find(n.id)] ??= []).push(n.id))
    const list = Object.values(groups).sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))
    const color: Record<string, string> = {}
    let k = 0
    list.forEach((g) => {
      const tainted = forced && g.includes('H')
      const col = g.length === 1 ? '#4a5a80' : tainted ? C.rose : PALETTE[k++ % PALETTE.length]
      g.forEach((id) => (color[id] = col))
    })
    return { list, color }
  }, [applied, forced])

  function apply(t: Tx) {
    if (applied.includes(t.id)) return setApplied((a) => a.filter((x) => x !== t.id))
    if (t.coinjoin) return setCjWarn(true)
    setApplied((a) => [...a, t.id])
  }

  const multi = clusters.list.filter((g) => g.length > 1)
  const pos = Object.fromEntries(NODES.map((n) => [n.id, n]))

  return (
    <div className="space-y-3">
      <Instr>Cliquez sur une transaction pour appliquer l'heuristique des entrées communes (CIOH) : toutes ses adresses d'entrée sont attribuées au même portefeuille. Attention à la dernière.</Instr>

      <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-2">
        <svg viewBox="0 0 680 220" className="h-auto w-full" role="img" aria-label="Graphe des adresses et clusters">
          {TXS.filter((t) => applied.includes(t.id)).map((t) =>
            t.ins.slice(1).map((i, k) => {
              const a = pos[t.ins[0].a]
              const b = pos[i.a]
              return <line key={`${t.id}-${k}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={t.coinjoin ? C.rose : clusters.color[i.a]} strokeWidth={2.5} strokeDasharray={t.coinjoin ? '6 5' : undefined} className={t.coinjoin ? 'animate-dash' : ''} opacity={0.8} />
            }),
          )}
          {NODES.map((n) => {
            const col = clusters.color[n.id]
            return (
              <g key={n.id} style={{ transition: 'all .3s' }}>
                <circle cx={n.x} cy={n.y} r={22} fill={`${col}22`} stroke={col} strokeWidth={2} style={{ transition: 'all .4s' }} />
                <text x={n.x} y={n.y + 5} textAnchor="middle" fill="#fff" fontSize={15} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
                  {n.id}
                </text>
                <text x={n.x} y={n.y + 38} textAnchor="middle" fill="#7a88a8" fontSize={9.5} fontFamily="JetBrains Mono, ui-monospace, monospace">
                  {short(n.address, 5)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {TXS.map((t) => {
          const on = applied.includes(t.id)
          return (
            <button key={t.id} onClick={() => apply(t)} aria-pressed={on} className={`rounded-lg border px-2.5 py-2 text-left transition ${on ? (t.coinjoin ? 'border-rose-500/70 bg-rose-500/10' : 'border-accent/70 bg-accent/10') : 'border-ink-700 bg-ink-850 hover:border-ink-500'}`}>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="font-mono font-semibold text-white">{t.id}</span>
                <span className="text-ink-300">
                  entrées : <span className="font-mono text-ink-100">{t.ins.map((i) => i.a).join(' + ')}</span>
                </span>
                {t.coinjoin && <span className="chip bg-rose-500/15 text-rose-300">CoinJoin ?</span>}
                <span className="flex-1" />
                <Icon name={on ? 'Link' : 'Unlink'} size={13} className={on ? 'text-accent' : 'text-ink-500'} />
              </div>
              <div className="mt-0.5 text-[10.5px] text-ink-400">
                {t.note} <span className="font-mono">frais {fee(t).toFixed(4)}</span>
              </div>
            </button>
          )
        })}
      </div>

      {cjWarn && !forced && (
        <div className="rounded-xl border border-orange-400/50 bg-orange-500/10 p-3 text-[12px] text-orange-100 animate-fadein">
          <div className="mb-1 flex items-center gap-2 font-semibold text-orange-300">
            <Icon name="ShieldAlert" size={14} /> T5 ressemble à un CoinJoin : CIOH non applicable
          </div>
          Sorties de montant identique (4 × 0,1 BTC), autant de participants que de sorties égales, un rendu par participant : ces entrées appartiennent à <strong>{T5_COUNT} personnes différentes</strong> qui ont signé ensemble. Fusionner rattacherait des inconnus (H, I, J) au portefeuille de D.
          <div className="mt-2 flex gap-2">
            <button className="btn-outline !py-1 text-xs" onClick={() => setCjWarn(false)}>
              Ne pas fusionner
            </button>
            <button
              className="btn-danger !py-1 text-xs"
              onClick={() => {
                setApplied((a) => [...a, 'T5'])
                setCjWarn(false)
              }}
            >
              Fusionner quand même (erreur)
            </button>
          </div>
        </div>
      )}

      <Explain tone={forced ? 'bad' : multi.length ? 'ok' : 'info'}>
        {forced ? (
          <>
            Erreur d'analyse : le CoinJoin a fusionné {clusters.list.find((g) => g.includes('H'))?.length ?? 0} adresses en un faux cluster (en rouge). Une attribution ou une réquisition fondée dessus viserait des personnes étrangères aux faits. Cliquez à nouveau sur T5 pour annuler.
          </>
        ) : multi.length === 0 ? (
          <>Chaque adresse est isolée. Une transaction Bitcoin ne peut être signée que par les détenteurs des clés de <strong>toutes</strong> ses entrées : en règle générale, c'est un seul portefeuille.</>
        ) : (
          <>
            {multi.length} cluster(s) : {multi.map((g) => `{${g.join(', ')}}`).join(' · ')}.{' '}
            {applied.includes('T1') && applied.includes('T2') ? 'Notez la transitivité : C, rendu de T1, dépensé avec D dans T2, relie A, B, C et D. ' : ''}
            {applied.includes('T3') && applied.includes('T4') ? 'F, réutilisée dans T3 et T4, fait le pont entre E et G. ' : ''}
            Un cluster permet d'agréger soldes et historique, et d'étendre une attribution (exchange, service) à toutes ses adresses.
          </>
        )}
      </Explain>
    </div>
  )
}

const T5_COUNT = 4
