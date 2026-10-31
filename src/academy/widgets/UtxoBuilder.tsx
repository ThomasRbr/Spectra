import { useMemo, useState } from 'react'
import { Icon } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { genAddress } from '../../engine/addressgen'
import { ASSETS, fmtUsd } from '../../engine/chains'
import { Box, C, Explain, Instr, Slider, short } from './kit'

const DUST = 546
const VB_OVERHEAD = 10.5
const VB_IN = 68 // P2WPKH
const VB_OUT = 31

interface Utxo {
  id: string
  sats: number
  address: string
  origin: string
  kyc?: boolean
}

const RNG = new Rng(7781)
const WALLET: Utxo[] = [
  { sats: 1_250_000, origin: 'Salaire freelance' },
  { sats: 420_000, origin: 'Remboursement ami' },
  { sats: 8_700_000, origin: 'Vente en P2P' },
  { sats: 900, origin: 'Micro-paiement (poussière)' },
  { sats: 2_190_000, origin: 'Rendu d\'un ancien paiement' },
  { sats: 15_000_000, origin: 'Retrait exchange (KYC)', kyc: true },
  { sats: 610_000, origin: 'Don reçu' },
].map((u, i) => ({ ...u, id: `u${i}`, address: genAddress(RNG, 'btc', 'p2wpkh') }))
const DEST = genAddress(RNG, 'btc', 'p2wpkh')
const CHANGE = genAddress(RNG, 'btc', 'p2wpkh')

const vsize = (nIn: number, nOut: number) => Math.ceil(VB_OVERHEAD + VB_IN * nIn + VB_OUT * nOut)
const fmt = (s: number) => `${(s / 1e8).toLocaleString('fr-FR', { minimumFractionDigits: 8, maximumFractionDigits: 8 })} BTC`
const usd = (s: number) => fmtUsd((s / 1e8) * ASSETS.BTC.usd)

export default function UtxoBuilder() {
  const [sel, setSel] = useState<string[]>([])
  const [pay, setPay] = useState(3_000_000)
  const [rate, setRate] = useState(12)

  const r = useMemo(() => {
    const ins = WALLET.filter((u) => sel.includes(u.id))
    const total = ins.reduce((s, u) => s + u.sats, 0)
    const fee1 = vsize(ins.length, 1) * rate
    const fee2 = vsize(ins.length, 2) * rate
    let change = 0
    let fee = fee2
    let nOut = 2
    let absorbed = 0
    const enough = ins.length > 0 && total >= pay + fee1
    if (enough) {
      const c = total - pay - fee2
      if (c >= DUST) change = c
      else {
        nOut = 1
        fee = total - pay
        absorbed = fee - fee1
      }
    }
    const size = vsize(ins.length, nOut)
    const uneconomic = ins.filter((u) => u.sats <= VB_IN * rate)
    const superfluous = enough ? ins.filter((u) => total - u.sats >= pay + vsize(ins.length - 1, 2) * rate) : []
    const kycMix = ins.some((u) => u.kyc) && ins.length > 1
    return { ins, total, change, fee, nOut, size, enough, absorbed, uneconomic, superfluous, kycMix, missing: pay + fee1 - total }
  }, [sel, pay, rate])

  function toggle(id: string) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  function auto() {
    // plus petite pièce unique suffisante, sinon accumulation des plus grosses
    const sorted = [...WALLET].sort((a, b) => a.sats - b.sats)
    const single = sorted.find((u) => u.sats >= pay + vsize(1, 2) * rate)
    if (single) return setSel([single.id])
    const picked: string[] = []
    let tot = 0
    for (const u of [...sorted].reverse()) {
      picked.push(u.id)
      tot += u.sats
      if (tot >= pay + vsize(picked.length, 2) * rate) break
    }
    setSel(picked)
  }

  const warnings: { tone: 'bad' | 'warn'; text: string }[] = []
  if (r.ins.length > 0 && !r.enough) warnings.push({ tone: 'bad', text: `Fonds insuffisants : il manque ${fmt(r.missing)} (montant + frais).` })
  if (r.uneconomic.length) warnings.push({ tone: 'warn', text: `Pièce non rentable : dépenser ${r.uneconomic.map((u) => fmt(u.sats)).join(', ')} coûte ${VB_IN * rate} sats de frais, plus que sa valeur.` })
  if (r.absorbed > 0) warnings.push({ tone: 'warn', text: `Rendu inférieur au seuil de poussière (${DUST} sats) : pas de sortie de rendu, ${r.absorbed} sats partent en frais supplémentaires.` })
  if (r.superfluous.length) warnings.push({ tone: 'warn', text: `Entrée superflue (${r.superfluous.map((u) => fmt(u.sats)).join(', ')}) : le paiement était possible sans elle. Frais inutiles${r.change > Math.min(...r.ins.map((u) => u.sats)) ? ", et le rendu dépasse la plus petite entrée : l'heuristique du « rendu optimal » le désignera à tort comme le paiement" : ''}.` })
  if (r.enough && r.fee > pay * 0.05) warnings.push({ tone: 'warn', text: `Frais élevés : ${((r.fee / pay) * 100).toFixed(1)} % du paiement.` })
  if (r.ins.length > 1) warnings.push({ tone: r.kycMix ? 'bad' : 'warn', text: `Confidentialité : ${r.ins.length} adresses dépensées ensemble. Selon l'heuristique des entrées communes (CIOH), un analyste les attribuera au même propriétaire${r.kycMix ? ' — et la pièce issue de l\'exchange KYC relie votre identité à toutes les autres' : ''}.` })

  return (
    <div className="space-y-3">
      <Instr>Vous devez payer le destinataire. Cochez les pièces (UTXO) à dépenser, ajustez le montant et le taux de frais : la transaction se construit en direct.</Instr>

      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Montant à payer" value={pay} min={100_000} max={20_000_000} step={10_000} onChange={setPay} display={fmt(pay)} />
        <Slider label="Taux de frais" value={rate} min={1} max={100} onChange={setRate} display={`${rate} sat/vB`} />
      </div>

      <Box title={`Portefeuille — ${WALLET.length} UTXO`} right={<button className="btn-outline !px-2 !py-0.5 text-micro" onClick={auto}><Icon name="WandSparkles" size={12} /> Sélection auto</button>}>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {WALLET.map((u) => {
            const on = sel.includes(u.id)
            return (
              <button key={u.id} onClick={() => toggle(u.id)} aria-pressed={on} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${on ? 'border-accent/70 bg-accent/10' : 'border-ink-700 bg-ink-900/60 hover:border-ink-500'}`}>
                <Icon name={on ? 'SquareCheck' : 'Square'} size={15} className={on ? 'text-accent' : 'text-ink-400'} />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-meta text-white">{fmt(u.sats)}</div>
                  <div className="truncate text-micro text-ink-400">
                    <span className="font-mono">{short(u.address, 7)}</span> · {u.origin}
                  </div>
                </div>
                {u.kyc && <span className="chip bg-cyan-500/10 text-cyan-300">KYC</span>}
              </button>
            )
          })}
        </div>
      </Box>

      <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <Box title={`Entrées (${r.ins.length})`}>
          {r.ins.length === 0 && <div className="text-meta text-ink-400">Aucune pièce sélectionnée.</div>}
          {r.ins.map((u) => (
            <div key={u.id} className="flex justify-between gap-2 font-mono text-meta">
              <span className="text-ink-300">{short(u.address, 6)}</span>
              <span className="text-white">{fmt(u.sats)}</span>
            </div>
          ))}
          {r.ins.length > 0 && <div className="mt-1 border-t border-ink-700 pt-1 text-right font-mono text-meta text-accent">{fmt(r.total)}</div>}
        </Box>
        <div className="flex flex-col items-center justify-center gap-1 px-1 text-center">
          <Icon name="ArrowRight" size={18} className="hidden text-accent sm:block" />
          <Icon name="ArrowDown" size={18} className="text-accent sm:hidden" />
          <div className="font-mono text-micro text-ink-300">{r.size} vB</div>
        </div>
        <Box title={`Sorties (${r.enough ? r.nOut : 0})`}>
          {!r.enough ? (
            <div className="text-meta text-ink-400">{r.ins.length ? 'Transaction impossible.' : '—'}</div>
          ) : (
            <>
              <div className="flex justify-between gap-2 font-mono text-meta">
                <span className="text-ink-300">{short(DEST, 6)} <span className="font-sans text-micro text-ink-400">paiement</span></span>
                <span className="text-white">{fmt(pay)}</span>
              </div>
              {r.change > 0 && (
                <div className="flex justify-between gap-2 font-mono text-meta">
                  <span className="text-ink-300">{short(CHANGE, 6)} <span className="font-sans text-micro" style={{ color: C.violet }}>rendu</span></span>
                  <span style={{ color: C.violet }}>{fmt(r.change)}</span>
                </div>
              )}
              <div className="flex justify-between gap-2 font-mono text-meta">
                <span className="font-sans text-micro text-ink-400">frais mineur ({r.size} vB × {rate})</span>
                <span style={{ color: C.amber }}>{fmt(r.fee)}</span>
              </div>
              <div className="mt-1 border-t border-ink-700 pt-1 text-right font-mono text-meta text-accent">{fmt(pay + r.change + r.fee)}</div>
            </>
          )}
        </Box>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className={`flex gap-2 text-meta leading-snug ${w.tone === 'bad' ? 'text-rose-300' : 'text-orange-300'}`}>
              <Icon name="TriangleAlert" size={13} className="mt-0.5 shrink-0" /> {w.text}
            </div>
          ))}
        </div>
      )}

      <Explain tone={r.enough ? 'info' : 'warn'}>
        {!r.enough ? (
          <>Un UTXO se dépense <strong>en entier</strong>, comme un billet. Sélectionnez des pièces dont le total couvre le paiement <strong>et</strong> les frais.</>
        ) : (
          <>
            Entrées {fmt(r.total)} = paiement {fmt(pay)} + {r.change > 0 ? <>rendu {fmt(r.change)} + </> : null}frais {fmt(r.fee)} ({usd(r.fee)}). Les frais ne sont pas une sortie : c'est la <strong>différence</strong> entre entrées et sorties, et ils dépendent de la <strong>taille</strong> ({r.size} vB, surtout le nombre d'entrées) et non du montant envoyé.{' '}
            {r.change > 0 ? 'Le rendu revient au payeur sur une adresse neuve : c\'est cette sortie que l\'enquêteur cherche à identifier pour suivre le fil.' : 'Sans rendu, tout le solde part au destinataire et au mineur.'}
          </>
        )}
      </Explain>
    </div>
  )
}
