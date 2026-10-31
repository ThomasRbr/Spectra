import { useMemo, useState } from 'react'
import { Icon } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { genAddress } from '../../engine/addressgen'
import { C, Explain, Instr, Toggle, short } from './kit'

const DENOM = 0.1
const FEE_SHARE = 0.0002
const PEOPLE = [
  { name: 'Alice', color: '#f472b6', input: 0.137 },
  { name: 'Bob', color: C.amber, input: 0.25 },
  { name: 'Carole', color: C.green, input: 0.104 },
  { name: 'David', color: C.violet, input: 0.18 },
  { name: 'Eve', color: C.orange, input: 0.312 },
]
const R = new Rng(1717)
const IN_ADDR = PEOPLE.map(() => genAddress(R, 'btc', 'p2wpkh'))
const MIX_ORDER = [2, 0, 4, 1, 3] // propriétaire de chaque sortie égale
const CHG_ORDER = [1, 4, 0, 3, 2] // propriétaire de chaque rendu
const r8 = (v: number) => Math.round(v * 1e8) / 1e8

interface Out {
  kind: 'mix' | 'change'
  owner: number
  value: number
  address: string
}
const OUTS: Out[] = [
  ...MIX_ORDER.map((o) => ({ kind: 'mix' as const, owner: o, value: DENOM, address: genAddress(R, 'btc', 'p2wpkh') })),
  ...CHG_ORDER.map((o) => ({ kind: 'change' as const, owner: o, value: r8(PEOPLE[o].input - DENOM - FEE_SHARE), address: genAddress(R, 'btc', 'p2wpkh') })),
]
const ALICE_MIX = OUTS.findIndex((o) => o.kind === 'mix' && o.owner === 0)
const ALICE_CHG = OUTS.findIndex((o) => o.kind === 'change' && o.owner === 0)
const CONSOLIDATED = genAddress(R, 'btc', 'p2wpkh')

const IY = (i: number) => 40 + i * 50
const OY = (i: number) => 22 + i * 26

export default function CoinjoinVisualizer() {
  const [truth, setTruth] = useState(false)
  const [mistake, setMistake] = useState(false)
  const [sel, setSel] = useState<number | null>(null)

  const totalIn = PEOPLE.reduce((s, p) => s + p.input, 0)
  const totalOut = OUTS.reduce((s, o) => s + o.value, 0)
  const anonSet = mistake ? 4 : 5

  const info = useMemo(() => {
    if (sel === null) return null
    const o = OUTS[sel]
    if (o.kind === 'change') {
      return { tone: 'bad' as const, text: `Rendu « toxique » de ${o.value.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC : une seule entrée vérifie entrée − ${DENOM.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} − frais = ${o.value.toLocaleString('fr-FR', { maximumFractionDigits: 8 })}. Il est donc relié de façon quasi certaine à l'entrée ${short(IN_ADDR[o.owner], 5)}${truth ? ` (${PEOPLE[o.owner].name})` : ''}. Le rendu n'a pas été mélangé : le dépenser avec des fonds mixés annule le CoinJoin.` }
    }
    if (mistake && sel === ALICE_MIX) {
      return { tone: 'bad' as const, text: `Cette sortie a été dépensée avec le rendu toxique d'Alice dans une même transaction : par la CIOH, elle lui est rattachée. Anonymat réduit à 1 — le mélange n'a servi à rien pour elle.` }
    }
    return { tone: 'ok' as const, text: `Sortie de ${DENOM.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC identique à ${anonSet - 1} autres sorties non liées : ${anonSet} propriétaires possibles, probabilité 1/${anonSet} chacun (${Math.round(100 / anonSet)} %).${truth ? ` (Vérité : ${PEOPLE[o.owner].name}.)` : ''}` }
  }, [sel, truth, mistake, anonSet])

  return (
    <div className="space-y-3">
      <Instr>Cinq participants mélangent leurs fonds. Cliquez sur une sortie pour voir ce qu'un analyste peut en déduire, révélez la vérité, puis simulez l'erreur post-mix d'Alice.</Instr>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle label="Révéler la vérité (qui est qui)" checked={truth} onChange={setTruth} hint="Ce que l'analyste ne voit pas" />
        <Toggle label="Erreur post-mix d'Alice" checked={mistake} onChange={setMistake} color={C.rose} hint="Elle regroupe sa sortie mixée avec son rendu" />
      </div>

      <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-2">
        <svg viewBox="0 0 720 280" className="h-auto w-full" role="img" aria-label="Transaction CoinJoin">
          <rect x={318} y={20} width={84} height={240} rx={12} fill="#1b1f25" stroke="#3d444f" />
          <text x={360} y={135} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">CoinJoin</text>
          <text x={360} y={150} textAnchor="middle" fill="#959da9" fontSize={9} fontFamily="Inter, system-ui, sans-serif">5 → 10</text>
          {PEOPLE.map((p, i) => (
            <path key={`in${i}`} d={`M 168 ${IY(i)} C 250 ${IY(i)} 260 140 318 140`} fill="none" stroke={truth ? p.color : '#5d6572'} strokeWidth={1.8} opacity={0.85} style={{ transition: 'stroke .4s' }} />
          ))}
          {OUTS.map((o, i) => {
            const col = truth ? PEOPLE[o.owner].color : o.kind === 'change' ? '#959da9' : C.cyan
            return <path key={`out${i}`} d={`M 402 140 C 460 140 470 ${OY(i)} 548 ${OY(i)}`} fill="none" stroke={col} strokeWidth={sel === i ? 3 : 1.6} opacity={sel === null || sel === i ? 0.9 : 0.35} style={{ transition: 'all .3s' }} />
          })}
          {PEOPLE.map((p, i) => (
            <g key={`ni${i}`}>
              <rect x={14} y={IY(i) - 16} width={154} height={32} rx={8} fill={truth ? `${p.color}18` : '#15181d'} stroke={truth ? p.color : '#3d444f'} style={{ transition: 'all .4s' }} />
              <text x={24} y={IY(i) - 2} fill="#fff" fontSize={11} fontFamily="JetBrains Mono, ui-monospace, monospace">{p.input.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC</text>
              <text x={24} y={IY(i) + 10} fill={truth ? p.color : '#959da9'} fontSize={9} fontFamily="JetBrains Mono, ui-monospace, monospace">{truth ? p.name : short(IN_ADDR[i], 6)}</text>
            </g>
          ))}
          {OUTS.map((o, i) => {
            const linked = mistake && (i === ALICE_MIX || i === ALICE_CHG)
            const col = truth ? PEOPLE[o.owner].color : o.kind === 'mix' ? C.cyan : '#959da9'
            return (
              <g key={`no${i}`} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }} role="button" aria-label={`Sortie ${i + 1}`}>
                <rect x={548} y={OY(i) - 11} width={160} height={22} rx={6} fill={sel === i ? `${col}30` : '#15181d'} stroke={linked ? C.rose : col} strokeWidth={linked || sel === i ? 2 : 1} strokeDasharray={o.kind === 'change' ? '3 2' : undefined} />
                <text x={556} y={OY(i) + 4} fill="#fff" fontSize={10.5} fontFamily="JetBrains Mono, ui-monospace, monospace">{o.value.toLocaleString('fr-FR', { minimumFractionDigits: 4 })}</text>
                <text x={702} y={OY(i) + 4} textAnchor="end" fill={o.kind === 'mix' ? C.cyan : '#b4bbc5'} fontSize={9} fontFamily="Inter, system-ui, sans-serif">
                  {truth ? PEOPLE[o.owner].name : o.kind === 'mix' ? 'égale' : 'rendu'}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {mistake && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/50 bg-rose-500/10 px-3 py-2 font-mono text-micro text-rose-100 animate-fadein">
          <Icon name="TriangleAlert" size={14} className="text-rose-300" />
          <span>Tx suivante :</span>
          <span className="text-white">{OUTS[ALICE_MIX].value.toLocaleString('fr-FR', { maximumFractionDigits: 8 })}</span> (sortie égale) +
          <span className="text-white">{OUTS[ALICE_CHG].value.toLocaleString('fr-FR', { maximumFractionDigits: 8 })}</span> (rendu)
          <Icon name="ArrowRight" size={12} />
          <span className="text-white">{r8(OUTS[ALICE_MIX].value + OUTS[ALICE_CHG].value - 0.0001).toLocaleString('fr-FR', { maximumFractionDigits: 8 })}</span> vers {short(CONSOLIDATED, 5)}
          <span className="font-sans text-rose-300">(frais 0,0001)</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 font-mono text-micro text-ink-300">
        <span>entrées {totalIn.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC</span>
        <span>sorties {r8(totalOut).toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC</span>
        <span>frais {r8(totalIn - totalOut).toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC</span>
        <span className="text-accent">anonymity set des sorties égales : {anonSet}</span>
      </div>

      {info ? (
        <Explain tone={info.tone}>{info.text}</Explain>
      ) : (
        <Explain tone={mistake ? 'bad' : 'info'}>
          {mistake ? (
            <>
              Alice a dépensé ensemble sa sortie mixée et son rendu toxique. Par la CIOH, l'analyste relie : son entrée → son rendu (par soustraction) → sa sortie mixée. Elle est démasquée, et l'anonymity set des 4 autres participants tombe de 5 à <strong>4</strong>. Les erreurs post-mix (consolidation, réutilisation d'adresse, envoi direct vers un exchange KYC) sont la principale prise de l'enquêteur.
            </>
          ) : (
            <>
              Signature d'un CoinJoin : plusieurs entrées de montants variés, <strong>5 sorties strictement égales</strong> ({DENOM.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC) et des rendus. Les sorties égales sont interchangeables (5 propriétaires possibles chacune) ; les rendus, eux, se rattachent à leur entrée par simple soustraction. Et la CIOH ne s'applique pas : les entrées appartiennent à des personnes différentes.
            </>
          )}
        </Explain>
      )}
    </div>
  )
}
