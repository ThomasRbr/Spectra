import { useMemo, useState } from 'react'
import { Icon } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { genAddress, genTxHash } from '../../engine/addressgen'
import { ASSETS, fmtUsd } from '../../engine/chains'
import { C, Explain, Instr, Seg, Slider, Toggle, num, short } from './kit'

type Dir = 'sell' | 'buy' // sell = WETH → USDC ; buy = USDC → WETH
type Pool = 50 | 1000 | 20000

const FEE = 0.003
const PRICE = ASSETS.ETH.usd
const R = new Rng(2024)
const TRADER = genAddress(R, 'eth', 'eoa')
const POOL = genAddress(R, 'eth', 'contract')
const TX = genTxHash(R, 'eth')

function quote(xIn: number, yOut: number, dx: number) {
  const eff = dx * (1 - FEE)
  return (yOut * eff) / (xIn + eff)
}

export default function AmmSwap() {
  const [pool, setPool] = useState<Pool>(1000)
  const [dir, setDir] = useState<Dir>('sell')
  const [t, setT] = useState(45)
  const [tol, setTol] = useState(1)
  const [mev, setMev] = useState(false)

  const s = useMemo(() => {
    const x0 = pool // réserve WETH
    const y0 = pool * PRICE // réserve USDC
    const [minA, maxA] = dir === 'sell' ? [0.1, pool * 0.6] : [300, pool * PRICE * 0.6]
    const dx = minA * Math.pow(maxA / minA, t / 100)
    const rin = dir === 'sell' ? x0 : y0
    const rout = dir === 'sell' ? y0 : x0
    const out = quote(rin, rout, dx)
    const spot = rout / rin
    const exec = out / dx
    const impact = (dx * (1 - FEE)) / (rin + dx * (1 - FEE))
    const after = (rout - out) / (rin + dx)
    // swap concurrent (même sens, 3 % de la réserve) exécuté avant le vôtre
    const fr = rin * 0.03
    const frOut = quote(rin, rout, fr)
    const realOut = mev ? quote(rin + fr, rout - frOut, dx) : out
    const minOut = out * (1 - tol / 100)
    const reverted = realOut < minOut
    const xs = dir === 'sell' ? [x0, x0 + dx] : [x0, x0 - out]
    return { x0, y0, dx, out, spot, exec, impact, after, realOut, minOut, reverted, xs, k: x0 * y0 }
  }, [pool, dir, t, tol, mev])

  const inSym = dir === 'sell' ? 'WETH' : 'USDC'
  const outSym = dir === 'sell' ? 'USDC' : 'WETH'
  const fmtIn = (v: number) => `${num(v, dir === 'sell' ? 4 : 2)} ${inSym}`
  const fmtOut = (v: number) => `${num(v, dir === 'sell' ? 2 : 4)} ${outSym}`
  const usdIn = dir === 'sell' ? s.dx * PRICE : s.dx

  // Courbe x·y = k (x = réserve WETH)
  const W = 300
  const H = 190
  const xmin = s.x0 * 0.35
  const xmax = s.x0 * 2.4
  const ymax = s.k / xmin
  const px = (x: number) => 30 + ((x - xmin) / (xmax - xmin)) * (W - 40)
  const py = (y: number) => H - 22 - (y / ymax) * (H - 36)
  const pts = Array.from({ length: 60 }, (_, i) => {
    const x = xmin + ((xmax - xmin) * i) / 59
    return `${px(x).toFixed(1)},${py(s.k / x).toFixed(1)}`
  }).join(' ')
  const [xa, xb] = s.xs
  const clampX = (x: number) => Math.min(xmax, Math.max(xmin, x))

  const impactCol = s.impact < 0.01 ? C.green : s.impact < 0.05 ? C.amber : C.rose

  return (
    <div className="space-y-3">
      <Instr>Réglez la taille du swap et la profondeur du pool : le prix obtenu suit la courbe x·y = k. Activez le swap concurrent pour voir le rôle de la tolérance de slippage.</Instr>
      <div className="flex flex-wrap items-center gap-3">
        <Seg<Dir> value={dir} onChange={setDir} options={[{ id: 'sell', label: 'Vendre WETH → USDC' }, { id: 'buy', label: 'Acheter WETH ← USDC' }]} />
        <div className="flex items-center gap-2 text-[12px] text-ink-300">
          Pool
          <Seg<Pool> value={pool} onChange={setPool} options={[{ id: 50, label: '50 WETH' }, { id: 1000, label: '1 000' }, { id: 20000, label: '20 000' }]} />
        </div>
      </div>
      <Slider label={`Montant vendu (${inSym})`} value={t} min={0} max={100} onChange={setT} display={`${fmtIn(s.dx)} · ${fmtUsd(usdIn)}`} />

      <div className="grid gap-3 sm:grid-cols-[300px_1fr]">
        <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-1.5">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Courbe à produit constant">
            <line x1={30} y1={H - 22} x2={W - 6} y2={H - 22} stroke="#2c3a5c" />
            <line x1={30} y1={8} x2={30} y2={H - 22} stroke="#2c3a5c" />
            <text x={W - 8} y={H - 8} textAnchor="end" fill="#7a88a8" fontSize={9} fontFamily="Inter, system-ui, sans-serif">réserve WETH (x)</text>
            <text x={34} y={14} fill="#7a88a8" fontSize={9} fontFamily="Inter, system-ui, sans-serif">réserve USDC (y)</text>
            <polyline points={pts} fill="none" stroke={C.violet} strokeWidth={2} />
            <line x1={px(clampX(xa))} y1={py(s.k / clampX(xa))} x2={px(clampX(xb))} y2={py(s.k / clampX(xb))} stroke={C.cyan} strokeWidth={1.5} strokeDasharray="4 3" />
            <circle cx={px(clampX(xa))} cy={py(s.k / clampX(xa))} r={5} fill="#10172a" stroke="#a9b4cc" strokeWidth={2} />
            <circle cx={px(clampX(xb))} cy={py(s.k / clampX(xb))} r={6} fill={C.cyan} style={{ transition: 'all .25s' }} />
            <text x={px(clampX(xb)) + 8} y={py(s.k / clampX(xb)) - 6} fill={C.cyan} fontSize={9.5} fontFamily="Inter, system-ui, sans-serif">après</text>
          </svg>
        </div>
        <div className="space-y-1.5 text-[12px]">
          {[
            ['Prix spot avant', `1 WETH = ${num(dir === 'sell' ? s.spot : 1 / s.spot, 2)} USDC`],
            ['Prix d\'exécution moyen', `1 WETH = ${num(dir === 'sell' ? s.exec : 1 / s.exec, 2)} USDC`],
            ['Prix spot après', `1 WETH = ${num(dir === 'sell' ? s.after : 1 / s.after, 2)} USDC`],
            ['Reçu (devis)', fmtOut(s.out)],
            [`Minimum garanti (tolérance ${tol} %)`, fmtOut(s.minOut)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-ink-700/60 pb-1">
              <span className="text-ink-300">{k}</span>
              <span className="font-mono text-white">{v}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-300">Impact de prix</span>
            <span className="font-mono font-semibold" style={{ color: impactCol }}>
              {(s.impact * 100).toFixed(2).replace('.', ',')} %
            </span>
          </div>
          <div className="text-[10.5px] text-ink-400">+ frais du pool 0,3 % reversés aux fournisseurs de liquidité</div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Toggle label="Un swap concurrent (3 % du pool, même sens) passe juste avant" hint="Front-running / sandwich MEV ou simple concurrence dans le bloc" checked={mev} onChange={setMev} color={C.orange} />
        <div className="flex items-center gap-2 text-[12px] text-ink-300">
          Tolérance
          <Seg<number> value={tol} onChange={setTol} options={[0.5, 1, 3, 10].map((v) => ({ id: v, label: `${String(v).replace('.', ',')} %` }))} />
        </div>
      </div>

      <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label !text-[9.5px]">Transaction vue dans l'explorateur</span>
          <span className={`chip ${s.reverted ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{s.reverted ? 'Échec (revert)' : 'Succès'}</span>
        </div>
        <div className="mb-1.5 font-mono text-[10.5px] text-ink-400">tx {short(TX, 10)} · méthode swapExactTokensForTokens</div>
        {s.reverted ? (
          <div className="text-[11.5px] text-rose-300">Aucun transfert : le montant réel ({fmtOut(s.realOut)}) est inférieur au minimum garanti, la transaction est annulée (seuls les frais de gas sont perdus).</div>
        ) : (
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="chip bg-ink-700 text-ink-200">Transfer</span>
              <span className="text-ink-300">{short(TRADER, 5)}</span>
              <Icon name="ArrowRight" size={11} className="text-ink-400" />
              <span className="text-violet-300">{short(POOL, 5)} (pool)</span>
              <span className="ml-auto text-white">{fmtIn(s.dx)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="chip bg-ink-700 text-ink-200">Transfer</span>
              <span className="text-violet-300">{short(POOL, 5)} (pool)</span>
              <Icon name="ArrowRight" size={11} className="text-ink-400" />
              <span className="text-ink-300">{short(TRADER, 5)}</span>
              <span className="ml-auto text-accent">{fmtOut(s.realOut)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-ink-400">
              <span className="chip bg-violet-500/15 text-violet-300">Swap</span> événement émis par le pool (montants entrée/sortie, destinataire)
            </div>
          </div>
        )}
      </div>

      <Explain tone={s.reverted ? 'bad' : s.impact > 0.05 ? 'warn' : 'info'}>
        Le pool garde le produit des réserves constant : vendre {fmtIn(s.dx)} déplace le point le long de la courbe et le prix se dégrade à mesure — <strong>impact de {(s.impact * 100).toFixed(2).replace('.', ',')} %</strong>{s.impact > 0.05 ? ', énorme : ce swap est trop gros pour ce pool' : ''}.{' '}
        {mev && !s.reverted && `Le swap concurrent vous coûte ${fmtOut(s.out - s.realOut)} par rapport au devis, mais reste dans votre tolérance. `}
        {s.reverted && 'Le swap concurrent a dégradé le prix au-delà de votre tolérance : protection réussie, mais transaction échouée. '}
        Pour l'enquêteur, un swap ne « casse » pas la piste : dans le même hash, un leg <strong>{inSym}</strong> part du trader vers le pool, un leg <strong>{outSym}</strong> revient au <strong>même</strong> trader. On continue le suivi sur le nouvel actif, à la même adresse.
      </Explain>
    </div>
  )
}
