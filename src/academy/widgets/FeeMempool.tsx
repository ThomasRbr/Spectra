import { useMemo, useState } from 'react'
import { Icon } from '../../ui/common'
import { ASSETS, fmtUsd } from '../../engine/chains'
import { C, Explain, Instr, Seg, Slider } from './kit'

type Level = 'calm' | 'normal' | 'busy'

// Profil de mempool : [taux plancher (sat/vB), volume en vMB]
const BANDS: [number, number][] = [
  [150, 0.2],
  [80, 0.4],
  [50, 0.8],
  [30, 1.4],
  [20, 2.0],
  [12, 3.0],
  [8, 4.0],
  [4, 6.0],
  [2, 8.0],
  [1, 10.0],
]
const LEVELS: Record<Level, { label: string; depth: number; rate: number }> = {
  calm: { label: 'Calme', depth: 0.15, rate: 0.5 },
  normal: { label: 'Normale', depth: 0.5, rate: 1 },
  busy: { label: 'Congestion', depth: 1.6, rate: 2.2 },
}
const SIZES = [
  { id: 141, label: '1 entrée → 2 sorties', vb: 141 },
  { id: 277, label: '3 entrées → 2 sorties', vb: 277 },
  { id: 722, label: 'Consolidation 10 → 1', vb: 722 },
]

function makeAhead(level: Level) {
  const L = LEVELS[level]
  const bands = BANDS.map(([lo, v], i) => ({ lo: lo * L.rate, hi: i === 0 ? lo * L.rate * 2 : BANDS[i - 1][0] * L.rate, v: v * L.depth }))
  // vMB de transactions payant strictement plus que `r`
  return (r: number) =>
    bands.reduce((s, b) => {
      if (r >= b.hi) return s
      if (r < b.lo) return s + b.v
      return s + (b.v * (b.hi - r)) / (b.hi - b.lo)
    }, 0)
}

export default function FeeMempool() {
  const [level, setLevel] = useState<Level>('normal')
  const [rate, setRate] = useState(10)
  const [size, setSize] = useState(141)

  const m = useMemo(() => {
    const ahead = makeAhead(level)
    const a = ahead(rate)
    const total = ahead(0)
    const blocks = Math.floor(a) + 1
    // taux minimal pour entrer dans le k-ième bloc projeté (recherche dichotomique)
    const rateAt = (k: number) => {
      let lo = 0
      let hi = 1000
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2
        if (ahead(mid) > k) lo = mid
        else hi = mid
      }
      return hi
    }
    const proj = Array.from({ length: 6 }, (_, k) => ({ min: rateAt(k + 1), max: rateAt(k), empty: total <= k }))
    return { a, total, blocks, proj, next: rateAt(1) }
  }, [level, rate])

  const feeSats = Math.ceil(rate * size)
  const feeUsd = (feeSats / 1e8) * ASSETS.BTC.usd
  const eta = m.blocks * 10
  const tone = m.blocks <= 1 ? 'ok' : m.blocks <= 3 ? 'info' : 'warn'

  return (
    <div className="space-y-3">
      <Instr>Choisissez l'état du réseau, la taille de la transaction et le taux de frais proposé. Les mineurs remplissent chaque bloc (≈ 1 vMB) avec les transactions les mieux payées.</Instr>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-meta text-ink-300">
          Mempool
          <Seg<Level> value={level} onChange={setLevel} options={(Object.keys(LEVELS) as Level[]).map((l) => ({ id: l, label: LEVELS[l].label }))} />
        </div>
        <div className="flex items-center gap-2 text-meta text-ink-300">
          Taille
          <Seg<number> value={size} onChange={setSize} options={SIZES.map((s) => ({ id: s.id, label: s.label }))} />
        </div>
      </div>
      <Slider label="Taux de frais proposé" value={rate} min={1} max={200} onChange={setRate} display={`${rate} sat/vB`} />

      <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-3">
        <div className="mb-2 flex items-center justify-between text-micro text-ink-300">
          <span className="label !text-micro">Blocs projetés (prochain bloc à gauche)</span>
          <span className="font-mono">{m.total.toFixed(1)} vMB en attente</span>
        </div>
        <div className="flex gap-2 overflow-hidden">
          {m.proj.map((b, k) => {
            const mine = k === m.blocks - 1
            return (
              <div key={k} className="relative min-w-0 flex-1">
                <div
                  className="flex aspect-square flex-col items-center justify-center rounded-lg border text-center transition-all duration-300"
                  style={{
                    borderColor: mine ? C.cyan : '#2f353e',
                    background: b.empty ? '#121418' : `linear-gradient(180deg, ${C.violet}${k === 0 ? '55' : '30'}, ${C.violet}10)`,
                    boxShadow: mine ? `0 0 18px -4px ${C.cyan}` : undefined,
                  }}
                >
                  <div className="text-micro text-ink-300">+{(k + 1) * 10} min</div>
                  <div className="font-mono text-micro font-semibold text-white">{b.empty ? '—' : `~${Math.max(1, Math.round(b.min))}`}</div>
                  <div className="text-micro text-ink-400">{b.empty ? 'vide' : `à ${Math.round(b.max)} sat/vB`}</div>
                </div>
                {mine && (
                  <div className="mt-1 flex items-center justify-center gap-1 text-micro font-semibold text-accent">
                    <Icon name="ArrowUp" size={11} /> vous
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {m.blocks > 6 && (
          <div className="mt-2 text-meta text-orange-300">
            Votre transaction est au-delà des 6 prochains blocs (bloc n° {m.blocks}).
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-2">
          <div className="text-micro text-ink-300">Frais payés</div>
          <div className="font-mono text-dense font-semibold text-white">{feeSats.toLocaleString('fr-FR')} sats</div>
          <div className="text-micro text-ink-400">{fmtUsd(feeUsd)}</div>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-2">
          <div className="text-micro text-ink-300">Devant vous</div>
          <div className="font-mono text-dense font-semibold text-white">{m.a.toFixed(2)} vMB</div>
          <div className="text-micro text-ink-400">mieux payés</div>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-2">
          <div className="text-micro text-ink-300">Confirmation estimée</div>
          <div className="font-mono text-dense font-semibold" style={{ color: m.blocks <= 1 ? C.green : m.blocks <= 3 ? C.cyan : C.orange }}>
            {eta < 60 ? `~${eta} min` : `~${(eta / 60).toFixed(1).replace('.', ',')} h`}
          </div>
          <div className="text-micro text-ink-400">bloc n° {m.blocks}</div>
        </div>
      </div>

      <Explain tone={tone}>
        À {rate} sat/vB, environ <strong>{m.a.toFixed(2)} vMB</strong> de transactions mieux payées passent avant vous : confirmation probable dans le <strong>bloc n° {m.blocks}</strong> (~{eta} min, si aucune transaction plus généreuse n'arrive entre-temps). Le prochain bloc exige actuellement ~{Math.max(1, Math.round(m.next))} sat/vB. Les frais ({feeSats.toLocaleString('fr-FR')} sats) dépendent de la taille en vbytes, pas du montant envoyé : une consolidation de 10 entrées coûte 5 fois plus qu'un simple paiement.{' '}
        {m.blocks > 6
          ? 'Une transaction sous-payée peut rester bloquée des jours, voire être purgée : son émetteur peut la remplacer (RBF) ou la débloquer en dépensant sa sortie avec de gros frais (CPFP).'
          : 'Côté enquête : un taux de frais inhabituel, répété d\'une transaction à l\'autre, est une empreinte comportementale du logiciel ou de l\'opérateur.'}
      </Explain>
    </div>
  )
}
