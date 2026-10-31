import { useMemo, useState } from 'react'
import { Icon } from '../../ui/common'
import { CHAINS } from '../../engine/chains'
import { C, Explain, Instr, Slider } from './kit'

const ALICE_COINS = [20_000_000, 25_000_000, 8_000_000] // sats
const BOB_COIN = 10_000_000
const SAT_VB = 10
const ETH_ALICE = 1.5
const ETH_BOB = 0.4
const GAS_FEE = (21000 * 20) / 1e9 // 21 000 gas × 20 gwei

const STEPS = ['État initial', 'Construction', 'Validation dans un bloc', 'Lecture par l\'enquêteur']

const b = (s: number) => (s / 1e8).toLocaleString('fr-FR', { maximumFractionDigits: 8 })
const e = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 5 })

function Coin({ sats, owner, state, tag }: { sats: number; owner: string; state: 'idle' | 'selected' | 'spent' | 'new'; tag?: string }) {
  const col = owner === 'Bob' ? C.green : C.orange
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-meta transition-all duration-500 ${state === 'spent' ? 'opacity-35 line-through' : ''} ${state === 'new' ? 'animate-fadein' : ''}`}
      style={{ borderColor: state === 'selected' ? C.cyan : `${col}55`, background: state === 'selected' ? `${C.cyan}18` : `${col}10` }}
    >
      <span className="grid h-4 w-4 place-items-center rounded-full text-micro font-bold text-ink-950" style={{ background: col }}>
        ₿
      </span>
      <span className="font-mono text-white">{b(sats)}</span>
      <span className="text-ink-300">{owner}</span>
      {tag && <span className="chip bg-ink-700 !py-0 text-micro text-ink-200">{tag}</span>}
    </div>
  )
}

export default function AccountVsUtxo() {
  const [step, setStep] = useState(0)
  const [amount, setAmount] = useState(0.3)

  const u = useMemo(() => {
    const pay = Math.round(amount * 1e8)
    const order = ALICE_COINS.map((v, i) => ({ v, i })).sort((x, y) => y.v - x.v)
    const sel: number[] = []
    let tot = 0
    for (const c of order) {
      if (tot >= pay + Math.ceil(10.5 + 68 * sel.length + 62) * SAT_VB) break
      sel.push(c.i)
      tot += c.v
    }
    const fee = Math.ceil(10.5 + 68 * sel.length + 62) * SAT_VB
    const change = tot - pay - fee
    return { pay, sel, tot, fee, change, ok: change >= 0 }
  }, [amount])

  const aliceAfter = ETH_ALICE - amount - GAS_FEE
  const built = step >= 1
  const done = step >= 2

  return (
    <div className="space-y-3">
      <Instr>Alice paie Bob. Choisissez le montant puis avancez étape par étape : à gauche le modèle UTXO (Bitcoin), à droite le modèle à comptes (Ethereum).</Instr>
      <Slider label="Montant envoyé à Bob" value={amount} min={0.05} max={0.5} step={0.01} onChange={(v) => setAmount(v)} display={`${amount.toFixed(2).replace('.', ',')} BTC / ETH`} />

      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => setStep(i)} className={`flex-1 rounded-md border px-1 py-1 text-micro transition ${i === step ? 'border-accent/70 bg-accent/10 text-white' : i < step ? 'border-ink-600 text-ink-200' : 'border-ink-700 text-ink-400'}`}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* UTXO */}
        <div className="rounded-xl border p-3" style={{ borderColor: `${CHAINS.btc.color}44`, background: `${CHAINS.btc.color}08` }}>
          <div className="mb-2 flex items-center gap-2 text-dense font-semibold" style={{ color: CHAINS.btc.color }}>
            <Icon name="Coins" size={14} /> UTXO — des pièces
          </div>
          <div className="label mb-1 !text-micro">Pièces existantes</div>
          <div className="flex flex-col items-start gap-1">
            {ALICE_COINS.map((v, i) => (
              <Coin key={i} sats={v} owner="Alice" state={done && u.sel.includes(i) ? 'spent' : built && u.sel.includes(i) ? 'selected' : 'idle'} tag={`adr. A${i + 1}`} />
            ))}
            <Coin sats={BOB_COIN} owner="Bob" state="idle" tag="adr. B1" />
          </div>
          {built && (
            <>
              <div className="label mb-1 mt-2.5 !text-micro">{done ? 'Nouvelles pièces créées' : 'Sorties prévues'}</div>
              {u.ok ? (
                <div className={`flex flex-col items-start gap-1 ${done ? '' : 'opacity-60'}`}>
                  <Coin sats={u.pay} owner="Bob" state="new" tag="adr. B2" />
                  {u.change > 0 && <Coin sats={u.change} owner="Alice" state="new" tag="rendu, adr. A4" />}
                  <div className="pl-1 font-mono text-micro" style={{ color: C.amber }}>
                    frais : {b(u.fee)} BTC (non attribués : entrées − sorties)
                  </div>
                </div>
              ) : (
                <div className="text-meta text-rose-300">Fonds insuffisants.</div>
              )}
            </>
          )}
        </div>

        {/* Comptes */}
        <div className="rounded-xl border p-3" style={{ borderColor: `${CHAINS.eth.color}44`, background: `${CHAINS.eth.color}08` }}>
          <div className="mb-2 flex items-center gap-2 text-dense font-semibold" style={{ color: CHAINS.eth.color }}>
            <Icon name="BookUser" size={14} /> Comptes — des soldes
          </div>
          <div className="space-y-1.5">
            {[
              { who: 'Alice', addr: '0xA11c…e4F2', before: ETH_ALICE, after: aliceAfter, nonce: done ? 42 : 41 },
              { who: 'Bob', addr: '0xB0b5…91aC', before: ETH_BOB, after: ETH_BOB + amount },
            ].map((r) => (
              <div key={r.who} className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/70 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="text-meta text-white">{r.who}</div>
                  <div className="font-mono text-micro text-ink-400">{r.addr}</div>
                </div>
                <div className="text-right">
                  <div className={`font-mono text-dense transition-colors duration-500 ${done ? (r.who === 'Bob' ? 'text-emerald-300' : 'text-orange-300') : 'text-white'}`}>{e(done ? r.after : r.before)} ETH</div>
                  {r.nonce !== undefined && <div className="font-mono text-micro text-ink-400">nonce {r.nonce}</div>}
                </div>
              </div>
            ))}
          </div>
          {built && (
            <div className="mt-2.5 rounded-lg border border-ink-700 bg-ink-950/60 p-2 font-mono text-micro leading-relaxed text-ink-200 animate-fadein">
              <div>
                from: <span className="text-white">0xA11c…e4F2</span> → to: <span className="text-white">0xB0b5…91aC</span>
              </div>
              <div>
                value: <span className="text-white">{e(amount)} ETH</span> · nonce: 41
              </div>
              <div style={{ color: C.amber }}>gas : 21 000 × 20 gwei = {e(GAS_FEE)} ETH</div>
            </div>
          )}
        </div>
      </div>

      <Explain>
        {step === 0 && (
          <>
            Sur Bitcoin, Alice ne possède pas « un solde » mais <strong>{ALICE_COINS.length} pièces</strong> distinctes, chacune sur sa propre adresse. Sur Ethereum, elle a <strong>un compte</strong> avec un solde unique et un compteur de transactions (nonce).
          </>
        )}
        {step === 1 && (
          <>
            UTXO : le portefeuille choisit {u.sel.length} pièce(s) totalisant {b(u.tot)} BTC, dépensées <strong>en entier</strong> ; il faut donc prévoir une sortie de <strong>rendu</strong>. Comptes : une simple instruction « débiter Alice de {e(amount)} ETH, créditer Bob », numérotée par le nonce 41 (qui empêche de rejouer la transaction).
          </>
        )}
        {step === 2 && (
          <>
            UTXO : les pièces dépensées sont <strong>détruites</strong> et de nouvelles naissent (Bob {b(u.pay)}{u.change > 0 ? `, rendu Alice ${b(u.change)}` : ''}). Comptes : les soldes sont simplement mis à jour, Alice passe à {e(aliceAfter)} ETH (montant + frais de gas) et son nonce à 42.
          </>
        )}
        {step === 3 && (
          <>
            Pour l'enquêteur : en UTXO, il faut deviner <strong>quelle sortie est le rendu</strong> (heuristiques) et les fonds circulent sur des adresses neuves ; mais les entrées communes trahissent les adresses d'un même portefeuille. En modèle à comptes, le flux est explicite (from → to) et l'adresse est réutilisée — l'historique complet d'Alice tient sur une page d'explorateur, mais il n'y a pas de rendu à identifier ni de CIOH.
          </>
        )}
        <div className="mt-2 flex gap-2">
          <button className="btn-ghost !py-1 text-meta" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <Icon name="ArrowLeft" size={13} /> Précédent
          </button>
          <button className="btn-primary !py-1 text-meta" onClick={() => setStep((s) => (s + 1) % STEPS.length)}>
            {step === STEPS.length - 1 ? 'Recommencer' : 'Étape suivante'} <Icon name={step === STEPS.length - 1 ? 'RotateCcw' : 'ArrowRight'} size={13} />
          </button>
        </div>
      </Explain>
    </div>
  )
}
