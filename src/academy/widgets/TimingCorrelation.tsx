import { useMemo, useState } from 'react'
import { ChainBadge, Icon } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { genAddress } from '../../engine/addressgen'
import { ASSETS } from '../../engine/chains'
import { C, Explain, Instr, Slider, short } from './kit'

const DEPOSIT_BTC = 2.5
const GROSS_ETH = (DEPOSIT_BTC * ASSETS.BTC.usd) / ASSETS.ETH.usd
const R = new Rng(8080)
const DEP_ADDR = genAddress(R, 'btc', 'p2wpkh')
const PAYOUTS = [
  { delay: 4, eth: 18.2 },
  { delay: 11, eth: 52.311, truth: true },
  { delay: 19, eth: 51.95 },
  { delay: 27, eth: 52.4 },
  { delay: 38, eth: 3.75 },
  { delay: 52, eth: 52.79 },
  { delay: 75, eth: 104.1 },
  { delay: 95, eth: 52.3 },
  { delay: 140, eth: 26.4 },
].map((p) => ({ ...p, to: genAddress(R, 'eth', 'eoa') }))

const hhmm = (minAfter: number) => {
  const t = 14 * 60 + 2 + minAfter
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export default function TimingCorrelation() {
  const [win, setWin] = useState(60)
  const [tol, setTol] = useState(2)
  const [fee, setFee] = useState(1)
  const [reveal, setReveal] = useState(false)

  const expected = GROSS_ETH * (1 - fee / 100)

  const rows = useMemo(() => {
    return PAYOUTS.map((p, i) => {
      const dev = (p.eth - expected) / expected
      const amountScore = Math.max(0, 1 - Math.abs(dev) / (tol / 100))
      const timeScore = p.delay <= win ? 1 - 0.5 * (p.delay / win) : 0
      return { ...p, i, dev, amountScore, timeScore, score: amountScore * timeScore }
    }).sort((a, b) => b.score - a.score || a.delay - b.delay)
  }, [expected, tol, win])

  const kept = rows.filter((r) => r.score > 0)
  const best = kept[0]
  const second = kept[1]
  const margin = best && second ? best.score - second.score : best ? best.score : 0

  return (
    <div className="space-y-3">
      <Instr>Un suspect a déposé 2,5 BTC chez un échangeur instantané, qui l'a payé en ETH depuis son hot wallet. Réglez la fenêtre de temps, la tolérance sur le montant et la commission supposée pour classer les paiements candidats.</Instr>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-700 bg-ink-850/80 px-3 py-2 text-[12px]">
        <ChainBadge chain="btc" />
        <span className="font-mono text-white">{DEPOSIT_BTC.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} BTC</span>
        <span className="text-ink-300">déposés à 14:02 depuis</span>
        <span className="font-mono text-ink-200">{short(DEP_ADDR, 6)}</span>
        <Icon name="ArrowRight" size={13} className="text-ink-400" />
        <ChainBadge chain="eth" />
        <span className="text-ink-300">attendu ≈</span>
        <span className="font-mono text-accent">{expected.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ETH</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Slider label="Fenêtre après le dépôt" value={win} min={5} max={180} step={5} onChange={setWin} display={`${win} min`} />
        <Slider label="Tolérance sur le montant" value={tol} min={0.2} max={5} step={0.1} onChange={setTol} display={`± ${tol.toFixed(1).replace('.', ',')} %`} />
        <Slider label="Commission supposée" value={fee} min={0} max={3} step={0.1} onChange={setFee} display={`${fee.toFixed(1).replace('.', ',')} %`} />
      </div>

      <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-2">
        <div className="grid grid-cols-[52px_1fr_88px_64px_1.2fr] gap-2 border-b border-ink-700 px-1.5 pb-1 text-[10px] uppercase tracking-wider text-ink-400">
          <span>Heure</span>
          <span>Destinataire</span>
          <span className="text-right">Montant</span>
          <span className="text-right">Écart</span>
          <span>Score</span>
        </div>
        {rows.map((r, rank) => {
          const out = r.score === 0
          const isBest = best && r.i === best.i
          const isTruth = reveal && r.truth
          const col = isTruth ? C.green : isBest ? C.cyan : C.violet
          return (
            <div key={r.i} className={`grid grid-cols-[52px_1fr_88px_64px_1.2fr] items-center gap-2 rounded-md px-1.5 py-1 font-mono text-[11px] transition-all duration-300 ${out ? 'opacity-30' : ''} ${isBest ? 'bg-accent/10' : ''}`} style={isTruth ? { outline: `1px solid ${C.green}88` } : undefined}>
              <span className="text-ink-300">
                {hhmm(r.delay)}
                <span className="block text-[9.5px] text-ink-500">+{r.delay} min</span>
              </span>
              <span className="truncate text-ink-200">
                {!out && <span className="mr-1 text-ink-500">#{rank + 1}</span>}
                {short(r.to, 5)}
              </span>
              <span className="text-right text-white">{r.eth.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}</span>
              <span className={`text-right ${Math.abs(r.dev) * 100 <= tol ? 'text-emerald-300' : 'text-ink-400'}`}>
                {r.dev >= 0 ? '+' : ''}
                {(r.dev * 100).toFixed(1).replace('.', ',')} %
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <span className="block h-full rounded-full transition-all duration-500" style={{ width: `${r.score * 100}%`, background: col }} />
                </span>
                <span className="w-7 text-right text-[10px]" style={{ color: out ? '#4a5a80' : col }}>
                  {Math.round(r.score * 100)}
                </span>
              </span>
            </div>
          )
        })}
        <div className="mt-1 flex items-center justify-between px-1.5 text-[10.5px] text-ink-400">
          <span>score = proximité du montant × proximité temporelle</span>
          <button className="btn-ghost !px-2 !py-0.5 text-[11px]" onClick={() => setReveal((v) => !v)}>
            <Icon name={reveal ? 'EyeOff' : 'Eye'} size={12} /> {reveal ? 'Masquer' : 'Révéler la vérité'}
          </button>
        </div>
      </div>

      <Explain tone={kept.length === 0 ? 'bad' : kept.length === 1 || margin > 0.25 ? 'ok' : 'warn'}>
        {kept.length === 0 ? (
          <>Aucun paiement ne passe les filtres : fenêtre trop courte ou tolérance trop serrée, ou commission mal estimée.</>
        ) : (
          <>
            {kept.length} candidat(s) retenu(s). Le meilleur, à {hhmm(best.delay)}, reçoit {best.eth.toLocaleString('fr-FR', { maximumFractionDigits: 8 })} ETH (écart {(best.dev * 100).toFixed(2).replace('.', ',')} %) avec un score de {Math.round(best.score * 100)}
            {second ? `, devant ${Math.round(second.score * 100)} pour le suivant` : ''}.{' '}
            {kept.length > 1 && margin < 0.25
              ? 'L\'écart est faible : plusieurs paiements sont plausibles. Ne désignez pas un titulaire sur cette seule base.'
              : 'Le rapprochement se détache, mais reste une corrélation statistique.'}{' '}
            {reveal && best && (best.truth ? 'Ici, le meilleur candidat est bien le vrai paiement.' : 'Ici, le meilleur candidat n\'est PAS le vrai paiement : réglages trompeurs.')}{' '}
            Pour le confirmer : réquisition à l'échangeur avec le hash du dépôt pour obtenir l'ordre d'échange (adresse de paiement déclarée, IP, éventuel e-mail).
          </>
        )}
      </Explain>
    </div>
  )
}
