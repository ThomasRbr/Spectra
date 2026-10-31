import { useMemo, useState } from 'react'
import { Icon } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { genAddress, KIND_LABEL, type AddrKind } from '../../engine/addressgen'
import { C, Explain, Instr, Seg, Toggle, short } from './kit'

type H = 'type' | 'round' | 'history' | 'reuse' | 'optimal'

interface Out {
  address: string
  kind: AddrKind
  value: number
  txCount: number // apparitions antérieures de l'adresse
}
interface Scenario {
  label: string
  inputs: { address: string; kind: AddrKind; value: number }[]
  outputs: Out[]
  change: number
  story: string
}

const R = new Rng(5150)
const IN_A1 = genAddress(R, 'btc', 'p2wpkh')
const IN_A2 = genAddress(R, 'btc', 'p2wpkh')
const IN_B = genAddress(R, 'btc', 'p2wpkh')

const SCENARIOS: Scenario[] = [
  {
    label: 'Paiement à 3 sorties',
    inputs: [
      { address: IN_A1, kind: 'p2wpkh', value: 0.06 },
      { address: IN_A2, kind: 'p2wpkh', value: 0.0442 },
    ],
    outputs: [
      { address: genAddress(R, 'btc', 'p2sh'), kind: 'p2sh', value: 0.05, txCount: 12 },
      { address: genAddress(R, 'btc', 'p2wpkh'), kind: 'p2wpkh', value: 0.03418762, txCount: 0 },
      { address: genAddress(R, 'btc', 'p2wpkh'), kind: 'p2wpkh', value: 0.02, txCount: 5 },
    ],
    change: 1,
    story: 'Le portefeuille paie deux destinataires (un dépôt d\'exchange en P2SH et un particulier) et se rend la monnaie sur une adresse neuve.',
  },
  {
    label: 'Rendu vers l\'entrée',
    inputs: [{ address: IN_B, kind: 'p2wpkh', value: 0.5 }],
    outputs: [
      { address: genAddress(R, 'btc', 'p2tr'), kind: 'p2tr', value: 0.12, txCount: 0 },
      { address: IN_B, kind: 'p2wpkh', value: 0.37985, txCount: 3 },
    ],
    change: 1,
    story: 'Un portefeuille mal configuré renvoie le rendu sur l\'adresse qu\'il vient de dépenser : erreur fréquente chez les débutants et certains services.',
  },
]

const HEUR: { id: H; label: string; hint: string }[] = [
  { id: 'type', label: 'Même type de script', hint: 'Le rendu a souvent le même format que les entrées (+1,6 / −1,2)' },
  { id: 'round', label: 'Montant rond', hint: 'Un paiement est souvent rond, le rendu rarement (−1,4 / +1,6)' },
  { id: 'history', label: 'Adresse neuve', hint: 'Le rendu va vers une adresse jamais vue (+0,6 / −1,5 si déjà utilisée)' },
  { id: 'reuse', label: 'Réutilisation d\'une adresse d\'entrée', hint: 'Une sortie qui retourne à l\'adresse d\'entrée est le rendu (+6)' },
  { id: 'optimal', label: 'Rendu optimal', hint: 'Le rendu est inférieur à la plus petite entrée (+0,5)' },
]

const isRound = (v: number) => {
  const s = v.toFixed(8).replace(/0+$/, '')
  const i = s.indexOf('.')
  return (i < 0 ? 0 : s.length - i - 1) <= 4
}

export default function ChangeDetective() {
  const [sc, setSc] = useState(0)
  const [on, setOn] = useState<Record<H, boolean>>({ type: true, round: false, history: false, reuse: false, optimal: false })
  const [reveal, setReveal] = useState(false)
  const s = SCENARIOS[sc]

  const res = useMemo(() => {
    const inAddrs = new Set(s.inputs.map((i) => i.address))
    const inKinds = new Set(s.inputs.map((i) => i.kind))
    const minIn = Math.min(...s.inputs.map((i) => i.value))
    const rounds = s.outputs.map((o) => isRound(o.value))
    const outs = s.outputs.map((o, idx) => {
      const reasons: { text: string; w: number }[] = []
      if (on.reuse && inAddrs.has(o.address)) reasons.push({ text: 'Retourne vers une adresse d\'entrée', w: 6 })
      if (on.type) {
        if (inKinds.has(o.kind)) reasons.push({ text: 'Même type que les entrées', w: 1.6 })
        else reasons.push({ text: 'Type différent des entrées', w: -1.2 })
      }
      if (on.round) {
        if (rounds[idx]) reasons.push({ text: 'Montant rond', w: -1.4 })
        else if (rounds.some((r, j) => j !== idx && r)) reasons.push({ text: 'Non rond (les autres le sont)', w: 1.6 })
      }
      if (on.history && !inAddrs.has(o.address)) {
        if (o.txCount === 0) reasons.push({ text: 'Adresse neuve', w: 0.6 })
        else reasons.push({ text: `Déjà vue (${o.txCount} tx)`, w: -1.5 })
      }
      if (on.optimal && s.inputs.length > 1 && o.value < minIn) reasons.push({ text: 'Inférieure à la plus petite entrée', w: 0.5 })
      return { ...o, reasons, score: reasons.reduce((a, r) => a + r.w, 0), prob: 0 }
    })
    const max = Math.max(...outs.map((o) => o.score))
    const ex = outs.map((o) => Math.exp(o.score - max))
    const sum = ex.reduce((a, b) => a + b, 0)
    outs.forEach((o, i) => (o.prob = ex[i] / sum))
    const best = outs.reduce((bi, o, i) => (o.prob > outs[bi].prob ? i : bi), 0)
    const totalIn = s.inputs.reduce((a, i) => a + i.value, 0)
    const totalOut = s.outputs.reduce((a, o) => a + o.value, 0)
    return { outs, best, fee: totalIn - totalOut, totalIn }
  }, [s, on])

  const active = Object.values(on).filter(Boolean).length
  const topP = res.outs[res.best].prob
  const conclusive = topP >= 0.7

  return (
    <div className="space-y-3">
      <Instr>Activez ou désactivez les heuristiques de détection du rendu : la probabilité que chaque sortie soit le rendu se recalcule (somme des poids, normalisée).</Instr>
      <Seg<number>
        value={sc}
        onChange={(v) => {
          setSc(v)
          setReveal(false)
        }}
        options={SCENARIOS.map((x, i) => ({ id: i, label: x.label }))}
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
        <div className="space-y-1.5">
          {HEUR.map((h) => (
            <Toggle key={h.id} label={h.label} hint={h.hint} checked={on[h.id]} onChange={(v) => setOn((o) => ({ ...o, [h.id]: v }))} />
          ))}
        </div>

        <div className="space-y-2">
          <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-2.5">
            <div className="label mb-1 !text-micro">Entrées · {res.totalIn.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC</div>
            {s.inputs.map((i) => (
              <div key={i.address} className="flex justify-between font-mono text-micro">
                <span className="text-ink-300">
                  {short(i.address, 7)} <span className="font-sans text-micro text-ink-400">{KIND_LABEL[i.kind]}</span>
                </span>
                <span className="text-white">{i.value.toFixed(8)}</span>
              </div>
            ))}
          </div>
          {res.outs.map((o, idx) => {
            const isBest = idx === res.best && active > 0
            const truth = reveal && idx === s.change
            const col = truth ? C.green : isBest ? C.cyan : '#5d6572'
            return (
              <div key={idx} className="rounded-xl border p-2.5 transition-colors duration-300" style={{ borderColor: `${col}88`, background: isBest || truth ? `${col}0c` : '#0c1120cc' }}>
                <div className="flex items-center justify-between gap-2 font-mono text-micro">
                  <span className="text-ink-200">
                    #{idx} {short(o.address, 7)} <span className="font-sans text-micro text-ink-400">{KIND_LABEL[o.kind]}</span>
                  </span>
                  <span className="text-white">{o.value.toFixed(8)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${o.prob * 100}%`, background: col }} />
                  </div>
                  <span className="w-10 text-right font-mono text-micro" style={{ color: col }}>
                    {Math.round(o.prob * 100)} %
                  </span>
                </div>
                {o.reasons.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {o.reasons.map((r, k) => (
                      <span key={k} className={`chip ${r.w > 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                        {r.text} {r.w > 0 ? '+' : ''}
                        {r.w.toLocaleString('fr-FR')}
                      </span>
                    ))}
                  </div>
                )}
                {truth && (
                  <div className="mt-1 flex items-center gap-1 text-micro font-semibold text-emerald-300">
                    <Icon name="BadgeCheck" size={12} /> Vrai rendu
                  </div>
                )}
              </div>
            )
          })}
          <div className="flex items-center justify-between font-mono text-micro text-ink-400">
            <span>frais : {res.fee.toFixed(8)} BTC</span>
            <button className="btn-ghost !px-2 !py-0.5 text-micro" onClick={() => setReveal((r) => !r)}>
              <Icon name={reveal ? 'EyeOff' : 'Eye'} size={12} /> {reveal ? 'Masquer' : 'Révéler la vérité'}
            </button>
          </div>
        </div>
      </div>

      <Explain tone={active === 0 ? 'info' : conclusive ? 'ok' : 'warn'}>
        {active === 0 ? (
          <>Sans heuristique, toutes les sorties sont équiprobables ({Math.round(100 / s.outputs.length)} % chacune). Activez des indices un par un. {s.story}</>
        ) : (
          <>
            Avec {active} heuristique(s), la sortie <strong>#{res.best}</strong> est le rendu le plus probable (<strong>{Math.round(topP * 100)} %</strong>).{' '}
            {conclusive ? 'Les indices convergent : vous pouvez suivre cette sortie comme la suite du portefeuille, en le mentionnant comme une inférence.' : 'Les indices sont faibles ou contradictoires : ne concluez pas, cherchez d\'autres éléments (dépense ultérieure avec des adresses du cluster, attribution, comportement).'}
            {reveal && (res.best === s.change ? ' Ici, la déduction est juste.' : ' Ici, la déduction serait fausse : une heuristique isolée peut tromper.')}{' '}
            Rappel : ce sont des probabilités, pas des preuves ; certains portefeuilles randomisent le rendu, et le PayJoin les met volontairement en défaut.
          </>
        )}
      </Explain>
    </div>
  )
}
