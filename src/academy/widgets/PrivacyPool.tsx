import { useMemo, useState } from 'react'
import { Icon } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { genAddress } from '../../engine/addressgen'
import { C, Explain, Instr, Slider, Toggle, short } from './kit'

const R = new Rng(1010)
const X1 = genAddress(R, 'eth', 'eoa')
const X2 = genAddress(R, 'eth', 'eoa')
const DEPOSITS = [
  { id: 'D1', t: 2, gas: 18 },
  { id: 'D2', t: 5, gas: 22 },
  { id: 'D3', t: 9, gas: 20, addr: X1 },
  { id: 'D4', t: 14, gas: 25 },
  { id: 'D5', t: 20, gas: 31.42 },
  { id: 'D6', t: 26, gas: 21, addr: X2 },
  { id: 'D7', t: 33, gas: 19 },
  { id: 'D8', t: 41, gas: 31.42 },
  { id: 'D9', t: 47, gas: 24 },
  { id: 'D10', t: 56, gas: 21 },
].map((d) => ({ ...d, addr: d.addr ?? genAddress(R, 'eth', 'eoa') }))
const WITHDRAWALS = [
  { id: 'W1', t: 30, to: X1, gas: 20 },
  { id: 'W2', t: 38, to: X2, gas: 23 },
  { id: 'W3', t: 44, to: genAddress(R, 'eth', 'eoa'), gas: 17 },
  { id: 'W4', t: 52, to: genAddress(R, 'eth', 'eoa'), gas: 31.42, target: true },
  { id: 'W5', t: 61, to: genAddress(R, 'eth', 'eoa'), gas: 26 },
]
const TARGET = WITHDRAWALS.find((w) => w.target)!
const TRUTH = 'D8'
const TMAX = 64
const px = (t: number) => 20 + (t / TMAX) * 680

export default function PrivacyPool() {
  const [linked, setLinked] = useState(false)
  const [gas, setGas] = useState(false)
  const [win, setWin] = useState(60)
  const [reveal, setReveal] = useState(false)

  const res = useMemo(() => {
    const before = DEPOSITS.filter((d) => d.t < TARGET.t)
    const spentByAddr = new Set(WITHDRAWALS.filter((w) => !w.target && DEPOSITS.some((d) => d.addr === w.to)).map((w) => DEPOSITS.find((d) => d.addr === w.to)!.id))
    const cand = before.filter((d) => {
      if (linked && spentByAddr.has(d.id)) return false
      if (gas && d.gas !== TARGET.gas) return false
      if (TARGET.t - d.t > win) return false
      return true
    })
    return { base: before.length, cand: new Set(cand.map((d) => d.id)), spentByAddr }
  }, [linked, gas, win])

  const n = res.cand.size
  const truthIn = res.cand.has(TRUTH)

  return (
    <div className="space-y-3">
      <Instr>Un pool à dénomination fixe (10 ETH) : tous les dépôts et retraits se ressemblent. Vous enquêtez sur le retrait W4. Appliquez les heuristiques pour réduire l'ensemble des dépôts candidats.</Instr>

      <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-2">
        <svg viewBox="0 0 720 200" className="h-auto w-full" role="img" aria-label="Chronologie des dépôts et retraits">
          <line x1={20} y1={100} x2={700} y2={100} stroke="#2c3a5c" strokeWidth={2} />
          {[0, 12, 24, 36, 48, 60].map((h) => (
            <g key={h}>
              <line x1={px(h)} y1={96} x2={px(h)} y2={104} stroke="#4a5a80" />
              <text x={px(h)} y={116} textAnchor="middle" fill="#4a5a80" fontSize={9} fontFamily="Inter, system-ui, sans-serif">{h} h</text>
            </g>
          ))}
          <rect x={px(Math.max(0, TARGET.t - win))} y={30} width={px(TARGET.t) - px(Math.max(0, TARGET.t - win))} height={70} fill={`${C.cyan}0d`} style={{ transition: 'all .3s' }} />
          <text x={22} y={18} fill="#7a88a8" fontSize={9.5} fontFamily="Inter, system-ui, sans-serif" fontWeight={600}>DÉPÔTS 10 ETH</text>
          <text x={22} y={192} fill="#7a88a8" fontSize={9.5} fontFamily="Inter, system-ui, sans-serif" fontWeight={600}>RETRAITS 10 ETH</text>
          {linked &&
            WITHDRAWALS.filter((w) => DEPOSITS.some((d) => d.addr === w.to)).map((w) => {
              const d = DEPOSITS.find((x) => x.addr === w.to)!
              return <path key={w.id} d={`M ${px(d.t)} 62 C ${px(d.t)} 120 ${px(w.t)} 90 ${px(w.t)} 140`} stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
            })}
          {DEPOSITS.map((d) => {
            const c = res.cand.has(d.id)
            const isT = reveal && d.id === TRUTH
            const col = isT ? C.green : c ? C.cyan : '#2c3a5c'
            return (
              <g key={d.id} style={{ transition: 'opacity .3s' }} opacity={d.t >= TARGET.t ? 0.35 : 1}>
                <line x1={px(d.t)} y1={62} x2={px(d.t)} y2={100} stroke={col} strokeWidth={1.5} />
                <circle cx={px(d.t)} cy={52} r={11} fill={c || isT ? `${col}30` : '#0c1120'} stroke={col} strokeWidth={2} style={{ transition: 'all .3s' }} />
                <text x={px(d.t)} y={55.5} textAnchor="middle" fill="#fff" fontSize={8.5} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">{d.id}</text>
                {gas && <text x={px(d.t)} y={34} textAnchor="middle" fill={d.gas === TARGET.gas ? C.amber : '#4a5a80'} fontSize={8} fontFamily="JetBrains Mono, ui-monospace, monospace">{String(d.gas).replace('.', ',')}</text>}
              </g>
            )
          })}
          {WITHDRAWALS.map((w) => {
            const col = w.target ? C.rose : '#4a5a80'
            return (
              <g key={w.id}>
                <line x1={px(w.t)} y1={100} x2={px(w.t)} y2={138} stroke={col} strokeWidth={1.5} />
                <rect x={px(w.t) - 13} y={138} width={26} height={22} rx={5} fill={w.target ? `${C.rose}30` : '#0c1120'} stroke={col} strokeWidth={w.target ? 2 : 1.2} />
                <text x={px(w.t)} y={153} textAnchor="middle" fill="#fff" fontSize={8.5} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">{w.id}</text>
                {gas && <text x={px(w.t)} y={172} textAnchor="middle" fill={w.gas === TARGET.gas ? C.amber : '#4a5a80'} fontSize={8} fontFamily="JetBrains Mono, ui-monospace, monospace">{String(w.gas).replace('.', ',')}</text>}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-300">
        <span className="chip bg-rose-500/15 text-rose-300">Cible W4</span>
        <span>retrait de 10 ETH vers {short(TARGET.to, 6)}</span>
        <span>· à t + {TARGET.t} h</span>
        <span>· gas {String(TARGET.gas).replace('.', ',')} gwei</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
        <div className="space-y-1.5">
          <Toggle label="Exclure les dépôts déjà liés (même adresse)" hint="D3 et D6 ont déposé puis retiré vers la même adresse (W1, W2) : leurs notes sont dépensées" checked={linked} onChange={setLinked} color={C.amber} />
          <Toggle label="Empreinte de prix du gas (31,42 gwei)" hint="W4 a été soumis sans relayeur avec un prix du gas personnalisé, inhabituel" checked={gas} onChange={setGas} color={C.amber} />
          <Slider label="Fenêtre temporelle avant W4" value={win} min={2} max={60} onChange={setWin} display={`${win} h`} />
        </div>
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-ink-700 bg-ink-850/80 p-3">
          <div>
            <div className="label !text-[10px]">Anonymity set de W4</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold transition-colors" style={{ color: n <= 1 ? C.rose : n <= 3 ? C.amber : C.cyan }}>{n}</span>
              <span className="text-[12px] text-ink-300">/ {res.base} dépôts antérieurs</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${(n / res.base) * 100}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-ink-400">Probabilité naïve par candidat : {n ? `1/${n} (${Math.round(100 / n)} %)` : '—'}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[...res.cand].map((id) => (
                <span key={id} className="chip bg-cyan-500/10 font-mono text-cyan-300">{id}</span>
              ))}
            </div>
          </div>
          <button className="btn-ghost !justify-start !px-0 !py-0.5 text-[11px]" onClick={() => setReveal((r) => !r)}>
            <Icon name={reveal ? 'EyeOff' : 'Eye'} size={12} /> {reveal ? 'Masquer la vérité' : 'Révéler le vrai dépôt'}
          </button>
        </div>
      </div>

      <Explain tone={n === 0 ? 'bad' : !truthIn ? 'bad' : n <= 2 ? 'ok' : 'info'}>
        {n === 0 ? (
          <>Plus aucun candidat : vos filtres sont trop stricts. Un filtre trop serré élimine le vrai dépôt — élargissez la fenêtre.</>
        ) : (
          <>
            Sans heuristique, W4 peut provenir de n'importe lequel des <strong>{res.base} dépôts</strong> antérieurs : le contrat ne révèle pas le lien (preuve à divulgation nulle de connaissance). {linked && 'Les dépôts déjà « consommés » par un retrait vers la même adresse sortent de l\'ensemble. '}
            {gas && 'Le prix du gas inhabituel, identique au dépôt et au retrait, trahit le même utilisateur ou le même logiciel. '}
            {win < 40 && `Restreindre aux ${win} h précédentes suppose un utilisateur pressé : hypothèse comportementale, pas une certitude. `}
            Il reste <strong>{n} candidat(s)</strong>.
            {reveal && (truthIn ? ` Le vrai dépôt (${TRUTH}) est bien dans l'ensemble.` : ` Attention : le vrai dépôt (${TRUTH}) a été exclu à tort !`)}{' '}
            Ces rapprochements sont des <strong>indices probabilistes</strong> à corroborer (montants, horaires, adresses de financement du gas, OSINT) avant toute conclusion.
          </>
        )}
      </Explain>
    </div>
  )
}
