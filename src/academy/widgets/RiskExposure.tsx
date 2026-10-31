import { useMemo, useState } from 'react'
import { RiskGauge } from '../../ui/common'
import { CATEGORY, RISK_META, type EntityCategory } from '../../engine/entities'
import { fmtUsd } from '../../engine/chains'
import { Explain, Instr, Slider, Toggle } from './kit'

interface Cp {
  id: string
  name: string
  cat: EntityCategory
  amount: number
  sources?: { name: string; cat: EntityCategory; share: number }[]
}

const INITIAL: Cp[] = [
  { id: 'ex', name: 'Exchange A', cat: 'exchange', amount: 40000 },
  { id: 'x', name: 'Portefeuille X', cat: 'individual', amount: 30000, sources: [] },
  { id: 'mx', name: 'Mixeur M', cat: 'mixer', amount: 8000 },
  { id: 'gb', name: 'Casino en ligne', cat: 'gambling', amount: 12000 },
  {
    id: 'y',
    name: 'Portefeuille Y',
    cat: 'individual',
    amount: 10000,
    sources: [
      { name: 'Commerçant', cat: 'merchant', share: 0.5 },
      { name: 'Plateforme P2P', cat: 'p2p', share: 0.5 },
    ],
  },
]

const riskScore = (c: EntityCategory) => RISK_META[CATEGORY[c].risk].score

export default function RiskExposure() {
  const [amounts, setAmounts] = useState<Record<string, number>>(Object.fromEntries(INITIAL.map((c) => [c.id, c.amount])))
  const [scamShare, setScamShare] = useState(60)
  const [indirect, setIndirect] = useState(false)

  const cps = useMemo<Cp[]>(
    () =>
      INITIAL.map((c) => ({
        ...c,
        amount: amounts[c.id],
        sources:
          c.id === 'x'
            ? [
                { name: 'Escroquerie', cat: 'scam' as EntityCategory, share: scamShare / 100 },
                { name: 'Marché darknet', cat: 'darknet' as EntityCategory, share: Math.min(0.1, 1 - scamShare / 100) },
                { name: 'Exchange B', cat: 'exchange' as EntityCategory, share: Math.max(0, 1 - scamShare / 100 - 0.1) },
              ]
            : c.sources,
      })),
    [amounts, scamShare],
  )

  const res = useMemo(() => {
    const total = cps.reduce((s, c) => s + c.amount, 0)
    const comp: Partial<Record<EntityCategory, number>> = {}
    const add = (cat: EntityCategory, v: number) => (comp[cat] = (comp[cat] ?? 0) + v)
    for (const c of cps) {
      if (indirect && c.sources?.length) c.sources.forEach((s) => add(s.cat, c.amount * s.share))
      else add(c.cat, c.amount)
    }
    const rows = (Object.entries(comp) as [EntityCategory, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    const score = total ? Math.round(rows.reduce((s, [cat, v]) => s + (v / total) * riskScore(cat), 0)) : 0
    const severe = rows.filter(([cat]) => CATEGORY[cat].risk === 'severe').reduce((s, [, v]) => s + v, 0)
    return { total, rows, score, severe }
  }, [cps, indirect])

  // Disposition du graphe
  const TX = 650
  const H1 = 400
  const H2 = 120
  const y1 = (i: number) => 30 + i * 50
  const maxA = Math.max(...cps.map((c) => c.amount), 1)
  const x = cps.find((c) => c.id === 'x')!

  return (
    <div className="space-y-3">
      <Instr>Une adresse a reçu des fonds de cinq contreparties. Ajustez les montants, puis activez l'exposition indirecte pour « regarder à travers » les portefeuilles intermédiaires, au prorata de leurs propres sources.</Instr>

      <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-2">
        <svg viewBox="0 0 720 282" className="h-auto w-full" role="img" aria-label="Graphe d'exposition">
          {cps.map((c, i) => {
            const col = CATEGORY[c.cat].color
            const w = 1 + (c.amount / maxA) * 9
            return (
              <g key={c.id}>
                <path d={`M ${H1 + 62} ${y1(i)} C ${H1 + 140} ${y1(i)} ${TX - 90} 130 ${TX - 44} 130`} stroke={col} strokeWidth={w} fill="none" opacity={0.55} style={{ transition: 'stroke-width .3s' }} />
                {c.sources?.map((s, k) => {
                  const ys = y1(i) + (k - (c.sources!.length - 1) / 2) * 30
                  return (
                    <g key={s.name} style={{ opacity: indirect ? 1 : 0.18, transition: 'opacity .4s' }}>
                      <path d={`M ${H2 + 56} ${ys} C ${H2 + 130} ${ys} ${H1 - 130} ${y1(i)} ${H1 - 62} ${y1(i)}`} stroke={CATEGORY[s.cat].color} strokeWidth={1 + s.share * 6} fill="none" opacity={0.55} />
                      <rect x={H2 - 56} y={ys - 12} width={112} height={24} rx={6} fill="#15181d" stroke={CATEGORY[s.cat].color} />
                      <text x={H2} y={ys + 4} textAnchor="middle" fill="#fff" fontSize={9.5} fontFamily="Inter, system-ui, sans-serif">
                        {s.name} · {Math.round(s.share * 100)} %
                      </text>
                    </g>
                  )
                })}
                <rect x={H1 - 62} y={y1(i) - 16} width={124} height={32} rx={8} fill={`${col}18`} stroke={col} />
                <text x={H1} y={y1(i) - 2} textAnchor="middle" fill="#fff" fontSize={10.5} fontWeight={600} fontFamily="Inter, system-ui, sans-serif">
                  {c.name}
                </text>
                <text x={H1} y={y1(i) + 10} textAnchor="middle" fill="#b4bbc5" fontSize={9} fontFamily="JetBrains Mono, ui-monospace, monospace">
                  {fmtUsd(c.amount)}
                </text>
              </g>
            )
          })}
          <rect x={TX - 44} y={106} width={88} height={48} rx={10} fill="#22d3ee1a" stroke="#7ea6ff" strokeWidth={2} />
          <text x={TX} y={127} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">Adresse</text>
          <text x={TX} y={141} textAnchor="middle" fill="#7ea6ff" fontSize={9} fontFamily="Inter, system-ui, sans-serif">analysée</text>
          <text x={H2} y={276} textAnchor="middle" fill="#5d6572" fontSize={9} fontFamily="Inter, system-ui, sans-serif">SAUT 2 (indirect)</text>
          <text x={H1} y={276} textAnchor="middle" fill="#5d6572" fontSize={9} fontFamily="Inter, system-ui, sans-serif">SAUT 1 (direct)</text>
        </svg>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
        <div className="space-y-2">
          <Toggle label="Exposition indirecte (2 sauts, au prorata)" hint="Les portefeuilles X et Y sont remplacés par la composition de leurs propres sources" checked={indirect} onChange={setIndirect} />
          {cps.map((c) => (
            <Slider key={c.id} label={<span style={{ color: CATEGORY[c.cat].color }}>{c.name}</span>} value={c.amount} min={0} max={80000} step={1000} onChange={(v) => setAmounts((a) => ({ ...a, [c.id]: v }))} display={fmtUsd(c.amount)} />
          ))}
          <Slider label="Part « escroquerie » dans les sources de X" value={scamShare} min={0} max={90} step={5} onChange={setScamShare} display={`${scamShare} %`} />
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-3">
          <div className="flex items-center gap-3">
            <RiskGauge score={res.score} size={76} />
            <div className="text-meta text-ink-300">
              <div className="label !text-micro">Score de risque</div>
              <div>{indirect ? 'direct + indirect' : 'direct uniquement'}</div>
              <div className="mt-1 text-rose-300">Sévère : {res.total ? Math.round((res.severe / res.total) * 100) : 0} %</div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {res.rows.map(([cat, v]) => {
              const m = CATEGORY[cat]
              const pct = res.total ? v / res.total : 0
              return (
                <div key={cat}>
                  <div className="flex justify-between text-micro">
                    <span style={{ color: m.color }}>{m.label}</span>
                    <span className="font-mono text-ink-200">
                      {fmtUsd(v)} · {(pct * 100).toFixed(1).replace('.', ',')} %
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: m.color }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-2 text-micro leading-snug text-ink-400">Score = Σ (part de chaque catégorie × poids de risque : faible 10, moyen 45, élevé 75, sévère 95).</div>
        </div>
      </div>

      <Explain tone={res.score >= 60 ? 'bad' : res.score >= 30 ? 'warn' : 'ok'}>
        Sur {fmtUsd(res.total)} reçus, l'exposition {indirect ? 'directe et indirecte' : 'directe'} donne un score de <strong>{res.score}/100</strong>.{' '}
        {indirect
          ? `Au 2e saut, les ${fmtUsd(x.amount)} venus du portefeuille X se décomposent au prorata : ${Math.round(scamShare)} % d'escroquerie, soit ${fmtUsd(x.amount * (scamShare / 100))} imputés à cette catégorie. L'exposition indirecte révèle un risque que la vue directe masquait.`
          : 'En vue directe, les portefeuilles X et Y apparaissent comme de simples particuliers à faible risque : c\'est exactement ce que cherche un blanchisseur en intercalant des adresses relais. Activez l\'exposition indirecte.'}{' '}
        Le calcul au prorata est une convention (d'autres méthodes existent : FIFO, « haircut », « poison ») ; précisez toujours la méthode et la profondeur dans votre rapport.
      </Explain>
    </div>
  )
}
