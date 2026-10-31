// Bac à sable : construire ses propres transactions et voir ce que l'analyste
// en déduit ; atelier ABI ; défis vérifiés automatiquement.
import { useMemo, useRef, useState } from 'react'
import { KIND_LABEL, shortAddr, type AddrKind } from '../../engine/addressgen'
import { WALLET_PROFILES, World, type Tx, type CallArg } from '../../engine/world'
import { changeAnalysis, clusterLabel, detectCoinjoin, txFingerprint } from '../../engine/analysis'
import { txSize, unlockOf } from '../../engine/script'
import { FUNCTIONS, calldata, fnName, paramTypes } from '../../engine/evm'
import { CHALLENGES, Lab, decodeCalldata, selectorSteps, type BuildOpts, type ChangePolicy, type Destination, type OutputOrder } from '../../lib/sandbox'
import { useUi } from '../../store/ui'
import { CopyButton, Icon, Tabs } from '../common'

type Tab = 'bitcoin' | 'abi' | 'defis'
const KINDS: AddrKind[] = ['p2wpkh', 'p2tr', 'p2sh', 'p2pkh']

export function Sandbox() {
  const [tab, setTab] = useState<Tab>('bitcoin')
  const labRef = useRef<Lab | null>(null)
  if (!labRef.current) labRef.current = new Lab()
  const [version, setVersion] = useState(0)
  const lab = labRef.current
  const bump = () => setVersion((v) => v + 1)
  const done = useMemo(() => CHALLENGES.filter((c) => c.check(lab).done).length, [lab, version])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-8 py-8">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="label text-accent">Laboratoire</div>
            <h1 className="mt-1 text-3xl font-bold text-white">Bac à sable</h1>
            <p className="mt-1 max-w-3xl text-[13.5px] text-ink-300">Fabriquez vos propres transactions et regardez ce que l'outil en déduit : rendu, regroupement d'adresses, empreinte du logiciel, poids. Le meilleur moyen de comprendre pourquoi une heuristique marche… ou échoue.</p>
          </div>
          <button className="btn-outline ml-auto" onClick={() => {
            labRef.current = new Lab(Math.floor(Math.random() * 1e9))
            bump()
          }}>
            <Icon name="RotateCcw" size={14} /> Repartir de zéro
          </button>
        </div>
        <div className="mt-5">
          <Tabs<Tab> value={tab} onChange={setTab} tabs={[
            { id: 'bitcoin', label: 'Bitcoin : construire et analyser', icon: 'Bitcoin' },
            { id: 'abi', label: 'Ethereum : atelier ABI', icon: 'FileCode2' },
            { id: 'defis', label: 'Défis', icon: 'Trophy', count: done },
          ]} />
        </div>
        {tab === 'bitcoin' && <BitcoinLab lab={lab} version={version} bump={bump} />}
        {tab === 'abi' && <AbiWorkshop />}
        {tab === 'defis' && <Challenges lab={lab} version={version} goLab={() => setTab('bitcoin')} />}
      </div>
    </div>
  )
}

// ── Bitcoin ─────────────────────────────────────────────────────────────────

function BitcoinLab({ lab, version, bump }: { lab: Lab; version: number; bump: () => void }) {
  const w = lab.w
  const holdings = useMemo(() => lab.holdings(), [lab, version])
  const [inputs, setInputs] = useState<string[]>([])
  const [payments, setPayments] = useState<{ to: Destination; value: string; kind: AddrKind }[]>([{ to: 'tiers', value: '0.05', kind: 'p2wpkh' }])
  const [change, setChange] = useState<ChangePolicy>('same')
  const [software, setSoftware] = useState<BuildOpts['software']>('desktop')
  const [order, setOrder] = useState<OutputOrder>('random')
  const [feeRate, setFeeRate] = useState(12)
  const [sel, setSel] = useState<string | null>(null)
  const [recv, setRecv] = useState({ value: '0.1', kind: 'p2wpkh' as AddrKind })
  const [msg, setMsg] = useState<string | null>(null)
  const [cjDenom, setCjDenom] = useState('0.05')
  const [peelSteps, setPeelSteps] = useState(4)
  const valid = inputs.filter((a) => holdings.some((h) => h.address === a))
  const opts: BuildOpts = { inputs: valid, payments: payments.map((p) => ({ to: p.to, value: Number(p.value.replace(',', '.')), kind: p.kind })), change, software, order, feeRate }
  const fee = valid.length ? lab.estimateFee(opts) : 0
  const inTotal = valid.reduce((s, a) => s + w.unspentValue(a), 0)
  const payTotal = opts.payments.reduce((s, p) => s + (p.value || 0), 0)
  const after = (r: Tx | Tx[] | string, label: string) => {
    if (typeof r === 'string') return setMsg(r)
    setMsg(null)
    setInputs([])
    const last = Array.isArray(r) ? r[r.length - 1] : r
    setSel(last.id)
    bump()
    useUi.getState().notify(label)
  }
  const selTx = sel && w.txs.has(sel) ? w.tx(sel) : null

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[300px_1fr_420px]">
      {/* Portefeuille */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-3">
          <div className="label mb-2">Mon portefeuille</div>
          <div className="space-y-1">
            {holdings.map((h) => {
              const on = valid.includes(h.address)
              return (
                <label key={h.address} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 ${on ? 'border-accent/60 bg-accent/10' : 'border-ink-700/60 hover:bg-ink-800'}`}>
                  <input type="checkbox" checked={on} onChange={() => setInputs(on ? valid.filter((x) => x !== h.address) : [...valid, h.address])} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[11px] text-ink-100">{shortAddr(w.get(h.address).addr, 8)}</div>
                    <div className="flex flex-wrap gap-1 text-[10px] text-ink-400">
                      <span>{h.kind.toUpperCase()}</span>
                      <span>· {clusterLabel(w, h.address)}</span>
                      {h.mixed && <span className="text-emerald-300">· mixée</span>}
                      {h.toxic && <span className="text-rose-300">· rendu toxique</span>}
                    </div>
                  </div>
                  <span className="font-mono text-[11.5px] text-white">{h.value.toFixed(5)}</span>
                </label>
              )
            })}
            {!holdings.length && <div className="text-[12px] text-ink-400">Portefeuille vide : recevez un paiement.</div>}
          </div>
        </div>
        <div className="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-3">
          <div className="label mb-2">Recevoir un paiement</div>
          <div className="flex gap-1.5">
            <input className="input w-24 font-mono" value={recv.value} onChange={(e) => setRecv({ ...recv, value: e.target.value })} />
            <select className="input flex-1" value={recv.kind} onChange={(e) => setRecv({ ...recv, kind: e.target.value as AddrKind })}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <button className="btn-outline mt-2 w-full !py-1.5 text-xs" onClick={() => {
            const v = Number(recv.value.replace(',', '.'))
            if (!(v > 0)) return setMsg('Montant invalide.')
            after(lab.receive(v, recv.kind), 'Paiement reçu sur une nouvelle adresse')
          }}><Icon name="ArrowDownLeft" size={13} /> Recevoir sur une nouvelle adresse</button>
        </div>
        <div className="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-3">
          <div className="label mb-2">Mes adresses regroupées (entrées communes)</div>
          {lab.myClusters().length ? lab.myClusters().map((g, i) => (
            <div key={i} className="mb-1 rounded-lg bg-ink-950/50 p-1.5 text-[11px] text-ink-200">
              <span className="text-amber-200">{clusterLabel(w, g[0])}</span> : {g.length} adresses reliées
            </div>
          )) : <div className="text-[11.5px] text-ink-400">Aucune : vos adresses ne sont pas encore reliées entre elles.</div>}
        </div>
      </div>

      {/* Constructeur */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-4">
          <div className="flex items-center gap-2">
            <div className="label">Constructeur de transaction</div>
            <span className="ml-auto text-[11.5px] text-ink-400">{valid.length} entrée(s) · {inTotal.toFixed(8)} BTC</span>
          </div>
          <div className="mt-3 space-y-2">
            {payments.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <select className="input w-40" value={p.to} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, to: e.target.value as Destination } : x)))}>
                  <option value="tiers">Vers un tiers</option>
                  <option value="exchange">Vers un exchange (dépôt)</option>
                  <option value="moi">Vers moi-même</option>
                </select>
                <input className="input w-28 font-mono" value={p.value} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <span className="text-[12px] text-ink-400">BTC</span>
                <select className="input flex-1" value={p.kind} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, kind: e.target.value as AddrKind } : x)))}>
                  {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </select>
                {payments.length > 1 && <button className="btn-ghost !px-1.5" onClick={() => setPayments(payments.filter((_, j) => j !== i))}><Icon name="X" size={13} /></button>}
              </div>
            ))}
            <button className="text-[12px] text-accent" onClick={() => setPayments([...payments, { to: 'tiers', value: '0.01', kind: 'p2wpkh' }])}><Icon name="Plus" size={12} className="mr-0.5 inline" /> Ajouter une sortie</button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Field label="Rendu">
              <select className="input w-full" value={change} onChange={(e) => setChange(e.target.value as ChangePolicy)}>
                <option value="same">Nouvelle adresse, même type que l'entrée</option>
                <option value="p2tr">Nouvelle adresse Taproot</option>
                <option value="p2pkh">Nouvelle adresse Legacy</option>
                <option value="reuse">Réutiliser l'adresse d'entrée</option>
                <option value="none">Pas de rendu (le reste part en frais)</option>
              </select>
            </Field>
            <Field label="Logiciel de portefeuille">
              <select className="input w-full" value={software} onChange={(e) => setSoftware(e.target.value as BuildOpts['software'])}>
                {WALLET_PROFILES.filter((p) => p.id !== 'coinjoin' && p.id !== 'service').map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Ordre des sorties">
              <select className="input w-full" value={order} onChange={(e) => setOrder(e.target.value as OutputOrder)}>
                <option value="random">Aléatoire</option>
                <option value="change-last">Rendu toujours en dernier</option>
                <option value="bip69">Trié (BIP 69)</option>
              </select>
            </Field>
            <Field label={`Taux de frais : ${feeRate} sat/vB`}>
              <input type="range" min={1} max={80} value={feeRate} onChange={(e) => setFeeRate(Number(e.target.value))} className="w-full" />
            </Field>
          </div>
          <div className="mt-3 rounded-lg bg-ink-950/50 p-2 text-[11.5px] text-ink-300">
            Paiements {payTotal.toFixed(8)} · frais estimés {fee.toFixed(8)} · rendu {Math.max(0, inTotal - payTotal - fee).toFixed(8)} BTC
          </div>
          {msg && <div className="mt-2 rounded-lg border border-rose-400/40 bg-rose-500/10 p-2 text-[12px] text-rose-100">{msg}</div>}
          <button className="btn-primary mt-3 w-full" disabled={!valid.length} onClick={() => after(lab.build({ ...opts, label: `Paiement de ${payTotal} BTC` }), 'Transaction diffusée')}>
            <Icon name="Send" size={14} /> Diffuser la transaction
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/[0.04] p-3">
            <div className="label mb-1">CoinJoin</div>
            <div className="text-[11.5px] text-ink-300">L'entrée cochée (une seule) rejoint un CoinJoin : une sortie mixée de montant égal et un rendu « toxique ».</div>
            <div className="mt-2 flex gap-1.5">
              <input className="input w-24 font-mono" value={cjDenom} onChange={(e) => setCjDenom(e.target.value)} />
              <button className="btn-outline flex-1 !py-1 text-xs" disabled={valid.length !== 1} onClick={() => after(lab.coinjoin(valid[0], Number(cjDenom.replace(',', '.'))), 'CoinJoin effectué')}><Icon name="Shuffle" size={13} /> Participer</button>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.04] p-3">
            <div className="label mb-1">Peel chain</div>
            <div className="text-[11.5px] text-ink-300">Depuis l'entrée cochée (une seule) : à chaque saut, une petite pelure part vers un tiers, le reste continue.</div>
            <div className="mt-2 flex gap-1.5">
              <input type="number" min={2} max={12} className="input w-20" value={peelSteps} onChange={(e) => setPeelSteps(Number(e.target.value))} />
              <button className="btn-outline flex-1 !py-1 text-xs" disabled={valid.length !== 1} onClick={() => after(lab.peel(valid[0], Math.max(2, Math.min(12, peelSteps))), 'Peel chain réalisée')}><Icon name="Layers" size={13} /> Lancer</button>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-3">
          <div className="label mb-2">Historique</div>
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {[...lab.entries].reverse().map((e) => (
              <button key={e.txId} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11.5px] ${sel === e.txId ? 'bg-accent/10 text-white' : 'text-ink-200 hover:bg-ink-800'}`} onClick={() => setSel(e.txId)}>
                <Icon name={detectCoinjoin(w.tx(e.txId)).is ? 'Shuffle' : 'ArrowRightLeft'} size={12} className="text-ink-400" />
                <span className="flex-1 truncate">{e.label}</span>
                <span className="font-mono text-[10px] text-ink-500">{shortAddr(w.tx(e.txId).hash, 5)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Analyse */}
      <div className="rounded-2xl border border-accent/25 bg-ink-900/70 p-4">
        <div className="label mb-2 text-accent">Ce que voit l'analyste</div>
        {selTx ? <TxAnalysis lab={lab} tx={selTx} /> : <div className="text-[12.5px] text-ink-400">Diffusez ou sélectionnez une transaction dans l'historique.</div>}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-ink-400">{label}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  )
}

function TxAnalysis({ lab, tx }: { lab: Lab; tx: Tx }) {
  const w = lab.w
  const entry = lab.entries.find((e) => e.txId === tx.id)
  const ch = changeAnalysis(w, tx)
  const fp = txFingerprint(w, tx)
  const size = txSize(w, tx)
  const cj = detectCoinjoin(tx)
  const [open, setOpen] = useState<number | null>(null)
  const guess = ch.length ? [...ch].sort((a, b) => b.prob - a.prob)[0] : undefined
  return (
    <div className="space-y-3 text-[12px]">
      <div className="font-mono text-[10.5px] text-ink-400">{tx.hash}</div>
      {cj.is && <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-2 text-rose-100">CoinJoin reconnu : {cj.equalCount} sorties de {cj.denom} BTC. Les heuristiques de rendu et d'entrées communes sont suspendues pour cette transaction.</div>}
      <div>
        <div className="mb-1 text-[11px] text-ink-400">Entrées</div>
        {tx.inputs.map((i) => (
          <div key={i.n} className="flex items-center gap-2 rounded px-1.5 py-0.5">
            <span className={`h-2 w-2 rounded-full ${lab.isMine(i.address) ? 'bg-accent' : 'bg-ink-500'}`} />
            <span className="flex-1 truncate font-mono text-[11px] text-ink-200">{shortAddr(w.get(i.address).addr, 8)}</span>
            <span className="text-[10px] text-ink-500">{unlockOf(w, tx, i.n).type}</span>
            <span className="font-mono text-[11px] text-ink-100">{i.value.toFixed(5)}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1 text-[11px] text-ink-400">Sorties : probabilité d'être le rendu selon l'outil</div>
        {tx.outputs.map((o) => {
          const c = ch.find((x) => x.n === o.n)
          const truth = entry?.changeN === o.n
          return (
            <div key={o.n} className="rounded px-1.5 py-1">
              <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(open === o.n ? null : o.n)}>
                <span className={`h-2 w-2 rounded-full ${lab.isMine(o.address) ? 'bg-accent' : 'bg-ink-500'}`} />
                <span className="flex-1 truncate font-mono text-[11px] text-ink-200">{shortAddr(w.get(o.address).addr, 8)}{truth && <span className="ml-1 rounded bg-accent/15 px-1 font-sans text-[10px] text-accent">votre rendu</span>}</span>
                <span className="font-mono text-[11px] text-ink-100">{o.value.toFixed(5)}</span>
                {c && <span className={`w-10 text-right font-mono text-[11px] ${c.prob > 0.6 ? 'text-yellow-300' : 'text-ink-400'}`}>{Math.round(c.prob * 100)} %</span>}
              </button>
              {c && <div className="ml-4 mt-0.5 h-1 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full" style={{ width: `${c.prob * 100}%`, background: c.prob > 0.6 ? '#facc15' : '#4a5a80' }} /></div>}
              {c && open === o.n && (
                <ul className="ml-4 mt-1 space-y-0.5 rounded bg-ink-950/60 p-1.5">
                  {c.reasons.map((r, k) => <li key={k} className="text-[10.5px]"><span className={`mr-1 font-mono ${r.weight > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.weight > 0 ? '+' : ''}{r.weight}</span>{r.text}</li>)}
                </ul>
              )}
            </div>
          )
        })}
        {guess && entry?.changeN !== undefined && (
          <div className={`mt-1 rounded-lg p-2 text-[11.5px] ${guess.n === entry.changeN ? 'border border-yellow-400/30 bg-yellow-400/10 text-yellow-100' : 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-100'}`}>
            {guess.n === entry.changeN ? `L'outil désigne bien votre rendu (${Math.round(guess.prob * 100)} %) : un analyste suivrait vos fonds.` : `L'outil se trompe : il désigne la sortie ${guess.n} (${Math.round(guess.prob * 100)} %) au lieu de votre rendu.`}
          </div>
        )}
      </div>
      {fp && (
        <div className="rounded-lg border border-ink-700/60 p-2">
          <div className="text-[11px] text-ink-400">Empreinte du logiciel</div>
          <div className="text-ink-200">version {fp.version} · nLockTime {fp.locktimeKind === 'height' ? 'à la hauteur du bloc' : 'à 0'} · RBF {fp.rbf ? 'oui' : 'non'} · ordre {fp.order === 'bip69' ? 'BIP 69' : fp.order === 'random' ? 'non trié' : 'indécidable'}</div>
          <div className="mt-0.5 text-[11px] text-ink-400">Logiciels compatibles : {fp.families.map((f) => f.label).join(' ; ') || 'aucun profil connu'}</div>
        </div>
      )}
      {size && (
        <div className="rounded-lg border border-ink-700/60 p-2 text-ink-200">
          <span className="text-[11px] text-ink-400">Taille </span>{size.size} o · poids {size.weight} WU · <b>{size.vsize} vB</b> · {size.feeRate.toLocaleString('fr-FR')} sat/vB{size.witnessBytes > 0 && <span className="text-ink-400"> · remise SegWit {Math.round((1 - size.vsize / size.vsizeWithoutDiscount) * 100)} %</span>}
        </div>
      )}
    </div>
  )
}

// ── Défis ───────────────────────────────────────────────────────────────────

function Challenges({ lab, version, goLab }: { lab: Lab; version: number; goLab: () => void }) {
  const res = useMemo(() => CHALLENGES.map((c) => ({ c, r: c.check(lab) })), [lab, version])
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {res.map(({ c, r }) => (
        <div key={c.id} className={`rounded-2xl border p-4 ${r.done ? 'border-emerald-400/40 bg-emerald-400/[0.05]' : 'border-ink-700/70 bg-ink-900/70'}`}>
          <div className="flex items-center gap-2">
            <Icon name={r.done ? 'CircleCheck' : 'Circle'} size={17} className={r.done ? 'text-emerald-400' : 'text-ink-500'} />
            <div className="text-[14px] font-semibold text-white">{c.title}</div>
          </div>
          <div className="mt-1.5 text-[12.5px] leading-relaxed text-ink-200">{c.goal}</div>
          <div className="mt-1.5 text-[11.5px] text-ink-400"><Icon name="Lightbulb" size={11} className="mr-1 inline text-amber-300" />{c.hint}</div>
          <div className={`mt-2 text-[11.5px] ${r.done ? 'text-emerald-200' : 'text-ink-300'}`}>{r.detail}</div>
        </div>
      ))}
      <button className="btn-outline md:col-span-2" onClick={goLab}><Icon name="Hammer" size={14} /> Aller au constructeur</button>
    </div>
  )
}

// ── Atelier ABI ─────────────────────────────────────────────────────────────

const DEMO_ADDR: { label: string; addr: string }[] = [
  { label: 'Vous', addr: '0x5e1a2c0ffee5b3d1c4b7a9e2d3f40c6b8a7e9f01' },
  { label: 'Escroc (spender)', addr: '0xbad0bad0c0de4e5f6a7b8c9d0e1f2a3b4c5d6e7f' },
  { label: 'Routeur Uniswap V2', addr: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
  { label: 'Contrat USDT', addr: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  { label: 'Contrat USDC', addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { label: 'Contrat WETH', addr: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
]
const ABI_SIGS = ['transfer(address,uint256)', 'approve(address,uint256)', 'transferFrom(address,address,uint256)', 'swapExactETHForTokens(uint256,address[],address,uint256)', 'withdraw(uint256)', 'setApprovalForAll(address,bool)', 'supply(address,uint256,address,uint16)', 'flushTokens(address)']

function AbiWorkshop() {
  const [sig, setSig] = useState(ABI_SIGS[1])
  const types = paramTypes(sig)
  const names = FUNCTIONS[sig]?.names ?? []
  const [vals, setVals] = useState<Record<string, string>>({})
  const [decIn, setDecIn] = useState('')
  const w = useMemo(() => new World(1), [])
  const key = (i: number) => `${sig}:${i}`
  const argOf = (t: string, i: number): CallArg => {
    const v = vals[key(i)]
    if (t === 'address') return { addr: v ?? DEMO_ADDR[i % DEMO_ADDR.length].addr }
    if (t === 'address[]') return { list: (v ?? `${DEMO_ADDR[5].addr},${DEMO_ADDR[3].addr}`).split(',').map((a) => ({ addr: a.trim() })) }
    if (t === 'bool') return { bool: (v ?? 'true') === 'true' }
    return { uint: (v ?? (names[i] === 'deadline' ? '1767230000' : '1000000')).replace(/\D/g, '') || '0' }
  }
  const call = { to: DEMO_ADDR[3].addr, sig, args: types.map(argOf) }
  const input = calldata(w, 'eth', call)
  const steps = selectorSteps(sig)
  const dec = decIn.trim() ? decodeCalldata(decIn) : null
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-violet-400/25 bg-ink-900/70 p-4">
        <div className="label mb-2 text-violet-200">Encoder un appel</div>
        <select className="input w-full font-mono" value={sig} onChange={(e) => setSig(e.target.value)}>
          {ABI_SIGS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="mt-1.5 text-[11.5px] text-ink-300">{FUNCTIONS[sig]?.help.replace(/`/g, '')}</div>
        <div className="mt-3 space-y-1.5">
          {types.map((t, i) => (
            <label key={key(i)} className="block">
              <span className="text-[11px] text-ink-400">{names[i]} <span className="text-ink-500">({t})</span></span>
              {t === 'address' ? (
                <select className="input mt-0.5 w-full font-mono text-[11.5px]" value={vals[key(i)] ?? DEMO_ADDR[i % DEMO_ADDR.length].addr} onChange={(e) => setVals({ ...vals, [key(i)]: e.target.value })}>
                  {DEMO_ADDR.map((d) => <option key={d.addr} value={d.addr}>{d.label} — {d.addr.slice(0, 10)}…</option>)}
                </select>
              ) : t === 'bool' ? (
                <select className="input mt-0.5 w-full" value={vals[key(i)] ?? 'true'} onChange={(e) => setVals({ ...vals, [key(i)]: e.target.value })}><option value="true">true</option><option value="false">false</option></select>
              ) : (
                <input className="input mt-0.5 w-full font-mono text-[11.5px]" placeholder={t === 'address[]' ? 'adresses séparées par des virgules' : 'entier en unités de base (1 USDT = 1000000)'} value={vals[key(i)] ?? ''} onChange={(e) => setVals({ ...vals, [key(i)]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-ink-950/60 p-2 font-mono text-[10.5px] leading-4 text-ink-200">
          <div className="text-ink-400">keccak256("{sig}")</div>
          <div className="break-all">= {steps.hash}</div>
          <div className="mt-1 text-ink-400">sélecteur = 4 premiers octets</div>
          <div className="text-violet-300">{steps.selector}</div>
        </div>
        <div className="mt-2 rounded-lg bg-ink-950/60 p-2">
          <div className="flex items-center justify-between"><span className="text-[11px] text-ink-400">Données d'entrée ({(input.length - 2) / 2} octets)</span><CopyButton text={input} /></div>
          <div className="mt-1 font-mono text-[10.5px] leading-4 text-ink-200">
            <div className="text-violet-300">{input.slice(0, 10)}</div>
            {(input.slice(10).match(/.{1,64}/g) ?? []).map((wd, i) => <div key={i} className="break-all"><span className="text-ink-500">[{i}]</span> {wd}</div>)}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-cyan-400/25 bg-ink-900/70 p-4">
        <div className="label mb-2 text-cyan-200">Décoder des données d'entrée</div>
        <textarea className="input h-28 w-full font-mono text-[11px]" placeholder="Collez des données d'entrée (0x…), par exemple celles produites à gauche ou copiées depuis l'inspecteur d'une mission." value={decIn} onChange={(e) => setDecIn(e.target.value)} />
        <button className="mt-1 text-[11.5px] text-cyan-200" onClick={() => setDecIn(input)}>Utiliser l'appel encodé à gauche</button>
        {dec && (
          <div className="mt-2 space-y-2 text-[12px]">
            <div><span className="text-ink-400">Sélecteur</span> <span className="font-mono text-violet-300">{dec.selector}</span> {dec.signature ? <span className="font-mono text-ink-100">→ {fnName(dec.signature)}({paramTypes(dec.signature).join(', ')})</span> : null}</div>
            {dec.error && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-amber-100">{dec.error}</div>}
            {dec.params.length > 0 && (
              <div className="rounded-lg bg-ink-950/60 p-2">
                {dec.params.map((p) => <div key={p.name} className="text-[11.5px]"><span className="text-ink-400">{p.name}</span> <span className="text-ink-500">({p.type})</span> <span className="break-all font-mono text-ink-100">{p.value}</span></div>)}
              </div>
            )}
            {dec.words.length > 0 && (
              <div className="rounded-lg bg-ink-950/60 p-2 font-mono text-[10.5px] leading-4">
                {dec.words.map((wd) => <div key={wd.index}><span className="text-ink-500">[{wd.index}]</span> <span className="break-all text-ink-200">{wd.hex}</span>{wd.meaning && <span className="font-sans text-cyan-200"> ← {wd.meaning}</span>}</div>)}
              </div>
            )}
          </div>
        )}
        <div className="mt-3 rounded-lg border border-ink-700/60 p-2 text-[11px] leading-relaxed text-ink-400">Chaque argument occupe un mot de 32 octets : une adresse est complétée par des zéros à gauche, un montant est un entier en unités de base (1 USDT = 10⁶ sur Ethereum, 1 ETH = 10¹⁸ wei). Les tableaux et données variables sont placés à la fin ; leur mot de tête contient seulement leur position (offset).</div>
      </div>
    </div>
  )
}

