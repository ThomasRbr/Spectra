import { useState } from 'react'
import { Icon, ChainBadge } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { genAddress, genTxHash } from '../../engine/addressgen'
import { C, Explain, Instr, Toggle, short } from './kit'

const R = new Rng(4848)
const USER = genAddress(R, 'eth', 'eoa')
const BRIDGE_SRC = genAddress(R, 'eth', 'contract')
const BRIDGE_DST = genAddress(R, 'bsc', 'contract')
const RECIPIENT = genAddress(R, 'bsc', 'eoa')
const SRC_TX = genTxHash(R, 'eth')
const NONCE = 48213
const AMOUNT = 25000
const BRIDGE_FEE = 0.0005

const CANDIDATES = [
  { nonce: 48211, amount: 24990, to: genAddress(R, 'bsc', 'eoa'), time: '14:31:09', src: 1 },
  { nonce: 48214, amount: AMOUNT * (1 - BRIDGE_FEE), to: genAddress(R, 'bsc', 'eoa'), time: '14:37:42', src: 1 },
  { nonce: 48212, amount: 9995, to: genAddress(R, 'bsc', 'eoa'), time: '14:33:55', src: 1 },
  { nonce: NONCE, amount: AMOUNT * (1 - BRIDGE_FEE), to: RECIPIENT, time: '14:36:18', src: 1 },
  { nonce: 39807, amount: 25000, to: genAddress(R, 'bsc', 'eoa'), time: '14:35:02', src: 137 },
].map((c) => ({ ...c, hash: genTxHash(R, 'bsc') }))

const STEPS = [
  { title: 'Dépôt sur la chaîne source', icon: 'ArrowDownToLine' },
  { title: 'Événement émis', icon: 'FileCode2' },
  { title: 'Relais / validateurs', icon: 'RadioTower' },
  { title: 'Arrivée : à vous de trouver', icon: 'Search' },
]

export default function BridgeFlow() {
  const [step, setStep] = useState(0)
  const [byAmount, setByAmount] = useState(false)
  const [byNonce, setByNonce] = useState(false)
  const [pick, setPick] = useState<number | null>(null)

  const matches = CANDIDATES.map((c) => {
    let ok = true
    if (byAmount) ok = ok && Math.abs(c.amount - AMOUNT) / AMOUNT <= 0.001
    if (byNonce) ok = ok && c.nonce === NONCE && c.src === 1
    return ok
  })
  const nMatch = matches.filter(Boolean).length
  const picked = pick !== null ? CANDIDATES[pick] : null
  const right = picked?.nonce === NONCE && picked.src === 1

  return (
    <div className="space-y-3">
      <Instr>Suivez 25 000 USDC passant d'Ethereum à BNB Chain via un bridge. Avancez étape par étape, puis retrouvez la transaction d'arrivée parmi les candidates.</Instr>
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <button key={s.title} onClick={() => setStep(i)} className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-1 py-1 text-micro transition ${i === step ? 'border-accent/70 bg-accent/10 text-white' : i < step ? 'border-ink-600 text-ink-200' : 'border-ink-700 text-ink-400'}`}>
            <Icon name={s.icon} size={11} /> <span className="truncate">{s.title}</span>
          </button>
        ))}
      </div>

      <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_70px_1fr]">
        <div className="rounded-xl border p-2.5" style={{ borderColor: '#8c9eff55', background: '#8c9eff0a' }}>
          <div className="mb-1.5 flex items-center justify-between">
            <ChainBadge chain="eth" />
            <span className="font-mono text-micro text-ink-400">tx {short(SRC_TX, 6)}</span>
          </div>
          <div className="space-y-0.5 font-mono text-micro">
            <div className="text-ink-300">
              from <span className="text-white">{short(USER, 5)}</span>
            </div>
            <div className="text-ink-300">
              to <span className="text-violet-300">{short(BRIDGE_SRC, 5)}</span> <span className="font-sans text-micro">(contrat bridge)</span>
            </div>
            <div className="text-ink-300">
              Transfer <span className="text-white">25 000 USDC</span> → contrat (verrouillés)
            </div>
          </div>
          {step >= 1 && (
            <div className="mt-2 rounded-lg border border-violet-400/40 bg-violet-500/10 p-2 font-mono text-micro leading-relaxed animate-fadein">
              <div className="text-violet-300">event Deposit(</div>
              <div className="pl-3 text-ink-200">
                destinationChainId: <span className="text-amber-300">56</span> <span className="font-sans text-ink-400">(BNB Chain)</span>
              </div>
              <div className="pl-3 text-ink-200">
                recipient: <span className="text-white">{short(RECIPIENT, 6)}</span>
              </div>
              <div className="pl-3 text-ink-200">amount: 25000000000 <span className="font-sans text-ink-400">(6 déc.)</span></div>
              <div className="pl-3 text-ink-200">
                depositNonce: <span className="font-semibold text-accent">{NONCE}</span>
              </div>
              <div className="text-violet-300">)</div>
            </div>
          )}
        </div>

        <div className="flex flex-row items-center justify-center gap-1 sm:flex-col">
          <Icon name="RadioTower" size={18} className={step >= 2 ? 'text-accent' : 'text-ink-600'} />
          <div className={`h-0.5 w-10 rounded sm:h-10 sm:w-0.5 ${step >= 2 ? 'bg-accent animate-pulse' : 'bg-ink-700'}`} />
          <span className="text-center text-micro leading-tight text-ink-400">{step >= 2 ? 'relais observent l\'événement' : 'en attente'}</span>
        </div>

        <div className="rounded-xl border p-2.5" style={{ borderColor: '#f3ba2f55', background: '#f3ba2f0a' }}>
          <div className="mb-1.5 flex items-center justify-between">
            <ChainBadge chain="bsc" />
            <span className="font-mono text-micro text-ink-400">contrat {short(BRIDGE_DST, 5)}</span>
          </div>
          {step < 3 ? (
            <div className="py-4 text-center text-meta text-ink-400">{step >= 2 ? 'Le contrat d\'arrivée va libérer les fonds au destinataire…' : 'Rien encore côté destination.'}</div>
          ) : (
            <div className="space-y-1">
              {CANDIDATES.map((c, i) => {
                const vis = matches[i]
                const sel = pick === i
                const good = c.nonce === NONCE && c.src === 1
                return (
                  <button
                    key={c.hash}
                    onClick={() => setPick(i)}
                    className={`w-full rounded-lg border px-2 py-1 text-left font-mono text-micro transition ${sel ? (good ? 'border-emerald-400/80 bg-emerald-500/10' : 'border-rose-500/80 bg-rose-500/10') : 'border-ink-700 bg-ink-900/70 hover:border-ink-500'} ${vis ? '' : 'opacity-25'}`}
                  >
                    <div className="flex justify-between gap-1">
                      <span className="text-ink-300">{c.time}</span>
                      <span className="text-white">{c.amount.toLocaleString('fr-FR')} USDC</span>
                    </div>
                    <div className="flex justify-between gap-1 text-ink-400">
                      <span>→ {short(c.to, 5)}</span>
                      <span>
                        nonce <span className={byNonce && vis ? 'text-accent' : 'text-ink-200'}>{c.nonce}</span> · src {c.src}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {step === 3 && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Filtrer par montant (±0,1 %)" hint="Montant attendu moins la commission du bridge" checked={byAmount} onChange={setByAmount} color={C.amber} />
          <Toggle label="Filtrer par nonce + chaîne source" hint={`depositNonce = ${NONCE}, source = 1 (Ethereum)`} checked={byNonce} onChange={setByNonce} />
        </div>
      )}

      {step === 3 && picked ? (
        <Explain tone={right ? 'ok' : 'bad'} title={right ? 'Correspondance établie' : 'Mauvaise correspondance'}>
          {right ? (
            <>
              Même nonce ({NONCE}), même chaîne source, même destinataire que celui déclaré dans l'événement, montant = 25 000 − 0,05 % de commission. Cette transaction <span className="font-mono">{short(picked.hash, 8)}</span> prolonge le flux sur BNB Chain : la piste continue à l'adresse <span className="font-mono">{short(RECIPIENT, 6)}</span>.
            </>
          ) : (
            <>
              {Math.abs(picked.amount - AMOUNT * (1 - BRIDGE_FEE)) < 0.01 ? 'Le montant est identique, ' : 'Le montant ne correspond pas, '}mais le nonce ({picked.nonce}, source {picked.src}) n'est pas celui du dépôt. Un montant ou un horaire proche ne prouve rien : sur un bridge actif, des dizaines de transferts similaires passent chaque minute.
            </>
          )}
        </Explain>
      ) : (
        <Explain tone={step === 3 && nMatch === 1 ? 'ok' : 'info'}>
          {step === 0 && 'L\'utilisateur envoie ses USDC au contrat du bridge sur Ethereum. Ils y restent verrouillés (ou sont brûlés) : sur Ethereum, la piste semble s\'arrêter sur un contrat.'}
          {step === 1 && <>Le contrat émet un <strong>événement</strong> (onglet « Logs » de l'explorateur) qui décrit la suite : chaîne de destination, destinataire, montant et surtout un <strong>nonce</strong> unique qui numérote ce dépôt.</>}
          {step === 2 && 'Des relais ou validateurs surveillent ces événements et soumettent une preuve au contrat jumeau sur la chaîne de destination, qui libère ou frappe l\'équivalent. Délai typique : de quelques secondes à quelques dizaines de minutes.'}
          {step === 3 && (
            <>
              {nMatch} candidate(s) restante(s).{' '}
              {byAmount && !byNonce && 'Le montant seul laisse plusieurs candidates (dont une leurre au montant identique) : insuffisant. '}
              {byNonce ? 'Le nonce (associé à la chaîne source) est un identifiant univoque : une seule transaction correspond. Cliquez dessus.' : 'Activez les filtres ou cliquez directement sur la transaction qui, selon vous, correspond au dépôt.'}
            </>
          )}
        </Explain>
      )}

      <div className="flex gap-2">
        <button className="btn-ghost !py-1 text-meta" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <Icon name="ArrowLeft" size={13} /> Précédent
        </button>
        <button
          className="btn-primary !py-1 text-meta"
          onClick={() => {
            if (step === 3) {
              setStep(0)
              setPick(null)
              setByAmount(false)
              setByNonce(false)
            } else setStep(step + 1)
          }}
        >
          {step === 3 ? 'Recommencer' : 'Étape suivante'} <Icon name={step === 3 ? 'RotateCcw' : 'ArrowRight'} size={13} />
        </button>
      </div>
    </div>
  )
}
