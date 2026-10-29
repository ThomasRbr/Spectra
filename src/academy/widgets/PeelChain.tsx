import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { genAddress } from '../../engine/addressgen'
import { ASSETS, fmtUsd } from '../../engine/chains'
import { C, Explain, Instr, Slider, Toggle, short } from './kit'

const EXCHANGES = [
  { name: 'Binance', color: '#f3ba2f' },
  { name: 'Kraken', color: '#7b61ff' },
  { name: 'Coinbase', color: '#3b82f6' },
  { name: 'OKX', color: '#e2e8f0' },
  { name: 'Bitstamp', color: '#34d399' },
]
const START = 12.5
const FEE = 0.0002
const HOPS = 7

function build() {
  const r = new Rng(909)
  let rem = START
  let t = 0
  const hops = []
  for (let k = 1; k <= HOPS; k++) {
    const peel = Math.round(r.float(0.25, 1.4) * 1e4) / 1e4
    rem = Math.round((rem - peel - FEE) * 1e8) / 1e8
    t += r.int(18, 95)
    hops.push({ k, peel, rem, minutes: t, ex: EXCHANGES[r.int(0, EXCHANGES.length - 1)], addr: genAddress(r, 'btc', 'p2wpkh'), deposit: genAddress(r, 'btc', r.chance(0.5) ? 'p2sh' : 'p2wpkh') })
  }
  return { hops, origin: genAddress(r, 'btc', 'p2wpkh') }
}

const W = 720
const X0 = 46
const DX = (W - 2 * X0) / HOPS
const nx = (k: number) => X0 + k * DX

export default function PeelChain() {
  const data = useMemo(build, [])
  const [hop, setHop] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1200)
  const [hints, setHints] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setHop((h) => Math.min(HOPS, h + 1)), speed)
    return () => window.clearInterval(id)
  }, [playing, speed])

  useEffect(() => {
    if (hop >= HOPS) setPlaying(false)
  }, [hop])

  const shown = data.hops.slice(0, hop)
  const peeled = shown.reduce((s, h) => s + h.peel, 0)
  const cur = hop > 0 ? data.hops[hop - 1] : null
  const remaining = cur ? cur.rem : START
  const byEx = shown.reduce<Record<string, number>>((acc, h) => ((acc[h.ex.name] = (acc[h.ex.name] ?? 0) + h.peel), acc), {})

  return (
    <div className="space-y-3">
      <Instr>Lancez l'animation ou avancez saut par saut. À chaque transaction, une petite somme est « pelée » vers un exchange et le gros reste part vers une adresse neuve.</Instr>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary !py-1 text-xs" onClick={() => {
            if (hop >= HOPS) setHop(0)
            setPlaying((p) => (hop >= HOPS ? true : !p))
          }}>
          <Icon name={playing ? 'Pause' : 'Play'} size={13} /> {playing ? 'Pause' : hop >= HOPS ? 'Rejouer' : 'Lecture'}
        </button>
        <button className="btn-outline !py-1 text-xs" onClick={() => setHop((h) => Math.min(HOPS, h + 1))} disabled={hop >= HOPS || playing}>
          <Icon name="StepForward" size={13} /> Étape suivante
        </button>
        <button
          className="btn-ghost !py-1 text-xs"
          onClick={() => {
            setPlaying(false)
            setHop(0)
          }}
        >
          <Icon name="RotateCcw" size={13} /> Remettre à zéro
        </button>
        <div className="ml-auto w-40">
          <Slider label="Vitesse" value={2200 - speed} min={200} max={1800} step={100} onChange={(v) => setSpeed(2200 - v)} display={`${(speed / 1000).toFixed(1)} s`} />
        </div>
      </div>

      <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-2">
        <svg viewBox={`0 0 ${W} 250`} className="h-auto w-full" role="img" aria-label="Peel chain">
          {data.hops.map((h) => {
            const vis = h.k <= hop
            const a = nx(h.k - 1)
            const b = nx(h.k)
            const mid = (a + b) / 2
            return (
              <g key={h.k} style={{ opacity: vis ? 1 : 0.08, transition: 'opacity .5s' }}>
                <line x1={a} y1={80} x2={b} y2={80} stroke={C.cyan} strokeWidth={Math.max(1.5, (h.rem / START) * 7)} strokeLinecap="round" />
                <path d={`M ${a} 80 Q ${mid - 6} 150 ${mid} 182`} fill="none" stroke={h.ex.color} strokeWidth={1.6} strokeDasharray="4 4" className={h.k === hop ? 'animate-dash' : ''} />
                <rect x={mid - 36} y={184} width={72} height={40} rx={8} fill={`${h.ex.color}18`} stroke={`${h.ex.color}88`} />
                <text x={mid} y={200} textAnchor="middle" fill={h.ex.color} fontSize={10.5} fontWeight={600} fontFamily="Inter, system-ui, sans-serif">
                  {h.ex.name}
                </text>
                <text x={mid} y={215} textAnchor="middle" fill="#fff" fontSize={10} fontFamily="JetBrains Mono, ui-monospace, monospace">
                  {h.peel.toLocaleString('fr-FR', { maximumFractionDigits: 8 })}
                </text>
                {hints && vis && (
                  <text x={mid} y={70} textAnchor="middle" fill="#7a88a8" fontSize={9} fontFamily="Inter, system-ui, sans-serif">
                    +{h.minutes - (data.hops[h.k - 2]?.minutes ?? 0)} min
                  </text>
                )}
              </g>
            )
          })}
          {Array.from({ length: HOPS + 1 }, (_, k) => {
            const vis = k <= hop
            const rem = k === 0 ? START : data.hops[k - 1].rem
            const active = k === hop
            return (
              <g key={k} style={{ opacity: vis ? 1 : 0.15, transition: 'opacity .5s' }}>
                <circle cx={nx(k)} cy={80} r={active ? 15 : 12} fill={active ? `${C.cyan}33` : '#10172a'} stroke={k === 0 ? C.rose : C.cyan} strokeWidth={2} style={{ transition: 'r .3s' }} />
                <text x={nx(k)} y={84} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
                  {k === 0 ? 'S' : k}
                </text>
                <text x={nx(k)} y={116} textAnchor="middle" fill={k === 0 ? C.rose : '#d6dcea'} fontSize={10} fontFamily="JetBrains Mono, ui-monospace, monospace">
                  {rem.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                </text>
              </g>
            )
          })}
          <text x={X0 - 10} y={40} fill={C.rose} fontSize={10} fontFamily="Inter, system-ui, sans-serif" fontWeight={600}>
            Source suspecte · {START.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-2">
          <div className="text-[10.5px] text-ink-300">Sauts</div>
          <div className="font-mono text-[13px] font-semibold text-white">
            {hop} / {HOPS}
          </div>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-2">
          <div className="text-[10.5px] text-ink-300">Pelé vers exchanges</div>
          <div className="font-mono text-[13px] font-semibold text-amber-300">{peeled.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} BTC</div>
          <div className="text-[10px] text-ink-400">{fmtUsd(peeled * ASSETS.BTC.usd)}</div>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-2">
          <div className="text-[10.5px] text-ink-300">Reste sur le fil</div>
          <div className="font-mono text-[13px] font-semibold text-accent">{remaining.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} BTC</div>
        </div>
      </div>

      <Toggle label="Afficher les indices de reconnaissance" checked={hints} onChange={setHints} hint="Délais entre sauts, adresses, répartition par exchange" />

      <Explain tone={hop >= HOPS ? 'ok' : 'info'}>
        {!cur ? (
          <>Les fonds suspects ({START.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC) sont sur l'adresse source <span className="font-mono text-ink-300">{short(data.origin, 6)}</span>. Une peel chain va les « éplucher » progressivement pour encaisser par petits montants, sous les seuils d'alerte des plateformes.</>
        ) : (
          <>
            Saut {cur.k} : <strong>{cur.peel.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC</strong> vers une adresse de dépôt {cur.ex.name} <span className="font-mono text-ink-300">{short(cur.deposit, 6)}</span> — chaque peel vers un exchange est une <strong>réquisition possible</strong> (identité du titulaire du compte). Le reste, {cur.rem.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC, part vers l'adresse neuve <span className="font-mono text-ink-300">{short(cur.addr, 6)}</span> : c'est le <strong>fil principal</strong>, reconnaissable à son montant largement supérieur au paiement.
            {hints && hop > 1 && (
              <>
                {' '}
                Indices : 2 sorties par transaction, une grosse et une petite, adresses à usage unique, rythme régulier (~{Math.round(cur.minutes / cur.k)} min par saut) → automatisation probable. Répartition : {Object.entries(byEx).map(([n, v]) => `${n} ${v.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}`).join(', ')}.
              </>
            )}
            {hop >= HOPS && ' Fin de l\'animation : en réalité une peel chain peut compter des centaines de sauts ; les outils les suivent automatiquement en prenant la plus grosse sortie.'}
          </>
        )}
      </Explain>
    </div>
  )
}
