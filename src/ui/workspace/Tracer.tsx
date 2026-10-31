import { Fragment, useEffect, useMemo, useState } from 'react'
import { CHAINS, fmtAsset, fmtUsd, usd, type AssetId } from '../../engine/chains'
import { CATEGORY } from '../../engine/entities'
import { shortAddr } from '../../engine/addressgen'
import { TRACE_METHODS, fundingTree, traceFunds, type TraceMethod, type TraceResult, type TraceSource } from '../../engine/tracing'
import type { World } from '../../engine/world'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { Empty, EntityChip, Icon, Modal, fmtTime } from '../common'
import { AddrLine } from './Inspector'
import { SwapMatchPanel, openPeel } from './Heuristics'
import { attribution } from '../../engine/analysis'
import { poolDeposits } from '../../engine/demix'
import { openDemix } from './Demix'
import { FlowDiagram } from './Synthesis'
import { shortAddr as short } from '../../engine/addressgen'
import { depositAnalysis } from '../../engine/heuristics'

const METHODS = Object.keys(TRACE_METHODS) as TraceMethod[]

/** Ouvre l'outil de traçage, pré-rempli sur une réception (ou la plus grosse réception d'une adresse). */
export function openTracer(preset: Partial<TraceSource> & { address: string }) {
  const w = useGame.getState().inst?.world
  if (!w) return
  let src: TraceSource | undefined = preset.txId ? (preset as TraceSource) : undefined
  if (!src) {
    const r = receipts(w, preset.address)[0]
    if (!r) {
      useUi.getState().notify('Cette adresse n\'a rien reçu : rien à tracer.')
      return
    }
    src = { txId: r.txId, address: preset.address, asset: r.asset, from: r.from }
  }
  useUi.getState().set({ tracer: { open: true, preset: src } })
}

interface Receipt {
  txId: string
  time: number
  asset: AssetId
  value: number
  usd: number
  from?: string
}

/** Réceptions d'une adresse, de la plus grosse à la plus petite. */
function receipts(w: World, id: string): Receipt[] {
  const out: Receipt[] = []
  for (const tx of w.txsOf(id)) {
    if (tx.model === 'utxo') {
      if (tx.inputs.some((i) => i.address === id)) continue
      const v = tx.outputs.filter((o) => o.address === id).reduce((s, o) => s + o.value, 0)
      if (v > 0) out.push({ txId: tx.id, time: tx.time, asset: w.flowIn(tx, id)[0].asset, value: v, usd: usd(w.flowIn(tx, id)[0].asset, v), from: tx.inputs[0]?.address })
    } else {
      for (const t of tx.transfers) {
        if (t.to !== id || t.from === id) continue
        out.push({ txId: tx.id, time: tx.time, asset: t.asset, value: t.value, usd: usd(t.asset, t.value), from: t.from })
      }
    }
  }
  return out.sort((a, b) => b.usd - a.usd).slice(0, 40)
}

const pct = (v: number, of: number) => {
  if (!(of > 0)) return '—'
  const p = (v / of) * 100
  return p > 0 && p < 1 ? '< 1 %' : `${Math.round(p)} %`
}
const amountsLine = (m: Partial<Record<AssetId, number>>) =>
  Object.entries(m).filter(([, v]) => (v ?? 0) > 0).map(([a, v]) => fmtAsset(v!, a as AssetId)).join(' + ') || '—'

// ── Outil « Traçage des fonds » ──────────────────────────────────────────

export function TracerModal() {
  const st = useUi((s) => s.tracer)
  const inst = useGame((s) => s.inst)
  const trace = useGame((s) => s.trace)
  const clock = useGame((s) => s.live?.now)
  const w = inst?.world
  const [src, setSrc] = useState<TraceSource | null>(null)
  const [method, setMethod] = useState<TraceMethod>('fifo')
  const [maxHops, setMaxHops] = useState(10)
  const [minUsd, setMinUsd] = useState(10)
  const [stopAtServices, setStop] = useState(true)
  const [until, setUntil] = useState<number | undefined>(undefined)
  const [compare, setCompare] = useState(false)

  useEffect(() => {
    if (!st.open) return
    if (st.preset) setSrc(st.preset)
    else if (trace) {
      setSrc(trace.source)
      setMethod(trace.opts.method)
    }
    setCompare(false)
  }, [st.open, st.preset, trace])

  const list = useMemo(() => (w && src ? receipts(w, src.address) : []), [w, src?.address, clock])
  const comparison = useMemo(() => {
    if (!w || !src || !compare) return null
    return Object.fromEntries(METHODS.map((m) => [m, traceFunds(w, src, { method: m, maxHops, minUsd, stopAtServices, until })])) as Record<TraceMethod, TraceResult>
  }, [w, src, compare, maxHops, minUsd, stopAtServices, until, clock])

  if (!w) return null
  const close = () => useUi.getState().set({ tracer: { open: false } })
  const sameSource = trace && src && trace.source.txId === src.txId && trace.source.address === src.address && trace.source.asset === src.asset
  const res = sameSource ? trace.result : null
  const run = () => src && useGame.getState().runTrace(src, { method, maxHops, minUsd, stopAtServices, until })
  const toLocal = (t: number) => {
    const d = new Date(t * 1000)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  return (
    <Modal open={st.open} onClose={close} title="Traçage des fonds" icon="Route" width="max-w-5xl">
      <div className="mb-3 rounded-xl border border-ink-700/60 bg-ink-850/50 p-3 text-meta leading-relaxed text-ink-300">
        Suit des fonds précis (par exemple le versement d'une victime) d'adresse en adresse, à travers les swaps et les bridges, jusqu'aux services identifiés. Quand des fonds se mélangent, la <span className="text-white">méthode d'attribution</span> décide quelle part leur est imputée : le résultat dépend de ce choix, qui doit figurer dans le rapport.
      </div>

      {!src ? (
        <Empty icon="Route" title="Aucune source" sub="Lancez le traçage depuis une adresse du graphe (clic droit ▸ Tracer les fonds reçus) ou depuis une transaction dans l'inspecteur." />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
            <div>
              <span className="label">Fonds à tracer</span>
              <div className="mt-1 rounded-lg border border-ink-700/60 p-1"><AddrLine w={w} id={src.address} compact /></div>
              <select
                className="input mt-1.5 font-mono text-meta"
                value={`${src.txId}|${src.asset ?? ''}|${src.from ?? ''}`}
                onChange={(e) => {
                  const [txId, asset, from] = e.target.value.split('|')
                  setSrc({ txId, address: src.address, asset: (asset || undefined) as AssetId | undefined, from: from || undefined })
                }}
              >
                {!list.some((r) => r.txId === src.txId) && <option value={`${src.txId}|${src.asset ?? ''}|${src.from ?? ''}`}>Réception sélectionnée</option>}
                {list.map((r) => (
                  <option key={`${r.txId}${r.from}${r.asset}`} value={`${r.txId}|${w.tx(r.txId).model === 'utxo' ? '' : r.asset}|${w.tx(r.txId).model === 'utxo' ? '' : r.from ?? ''}`}>
                    {fmtTime(r.time)} · {fmtAsset(r.value, r.asset)} ({fmtUsd(r.usd)}){r.from ? ` · de ${shortAddr(w.get(r.from).addr, 5)}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="label">Méthode d'attribution</span>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {METHODS.map((m) => (
                  <button key={m} onClick={() => setMethod(m)} className={`rounded-lg border px-2 py-1.5 text-left text-meta ${method === m ? 'border-accent bg-accent/10 text-white' : 'border-ink-700 text-ink-300 hover:border-ink-500'}`}>
                    {TRACE_METHODS[m].label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-micro leading-relaxed text-ink-400">{TRACE_METHODS[method].help}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="block">
              <span className="label">Profondeur : {maxHops} sauts</span>
              <input className="mt-2 w-full accent-accent" type="range" min={1} max={25} value={maxHops} onChange={(e) => setMaxHops(Number(e.target.value))} />
            </label>
            <label className="block">
              <span className="label">Seuil de suivi (USD)</span>
              <input className="input mt-1 font-mono" type="number" min={0} value={minUsd} onChange={(e) => setMinUsd(Math.max(0, Number(e.target.value)))} />
            </label>
            <label className="block">
              <span className="label">Situation au (optionnel)</span>
              <input className="input mt-1 font-mono" type="datetime-local" value={until ? toLocal(until) : ''} onChange={(e) => {
                const t = Math.floor(new Date(e.target.value).getTime() / 1000)
                setUntil(Number.isFinite(t) ? t : undefined)
              }} />
            </label>
            <label className="mt-5 flex items-center gap-2 text-meta text-ink-200">
              <input type="checkbox" className="accent-accent" checked={stopAtServices} onChange={(e) => setStop(e.target.checked)} />
              S'arrêter aux services identifiés
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary flex-1" onClick={run}><Icon name="Route" size={15} /> Lancer le traçage</button>
            <button className={`btn-ghost ${compare ? 'text-accent' : ''}`} onClick={() => setCompare((c) => !c)}><Icon name="Columns3" size={14} /> Comparer les méthodes</button>
          </div>

          {comparison && <Comparison results={comparison} />}
          {res && <TraceResultView w={w} res={res} onShow={() => {
            useGame.getState().revealTrace()
            close()
          }} />}
        </>
      )}
    </Modal>
  )
}

function TraceResultView({ w, res, onShow }: { w: World; res: TraceResult; onShow: () => void }) {
  const endsUsd = res.endpoints.reduce((s, e) => s + e.usd, 0)
  const lostUsd = res.lost.belowThresholdUsd + res.lost.feesUsd + res.lost.depthUsd + res.lost.inTransitUsd
  const req = (entityId: string, addresses: string[]) => useUi.getState().set({ tracer: { open: false }, requisition: { open: true, entityId, addresses } })
  const [swapOpen, setSwapOpen] = useState<string | null>(null)
  // Adresses non attribuées du flux qui se comportent comme des adresses de dépôt du service atteint
  const viaDeposit = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const e of res.endpoints) {
      const entry = new Set(e.addresses)
      const found = [...res.byAddress.keys()].filter((a) => {
        if (attribution(w, a).entity || !w.txsOf(a).some((t) => t.transfers.some((x) => x.from === a && entry.has(x.to)))) return false
        const v = depositAnalysis(w, a)
        return v.role === 'deposit' && !!v.target && entry.has(v.target)
      })
      if (found.length) m.set(e.entity.id, found)
    }
    return m
  }, [w, res])
  /** Dépôts (transaction, adresse) d'une destination, pour le rapprochement des échangeurs instantanés. */
  const deposits = (e: TraceResult['endpoints'][number]) =>
    e.addresses.flatMap((a) => e.txIds.filter((t) => w.flowIn(w.tx(t), a).length).slice(0, 1).map((t) => ({ txId: t, address: a }))).slice(0, 4)
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Card label="Fonds tracés" value={fmtUsd(res.sourceUsd)} sub={amountsLine(res.sourceAmounts)} />
        <Card label="Arrivés chez des services" value={fmtUsd(endsUsd)} sub={pct(endsUsd, res.sourceUsd)} accent="#7ea6ff" />
        <Card label="Encore détenus" value={fmtUsd(res.stillHeld.reduce((s, n) => s + n.heldUsd, 0))} sub={`${res.stillHeld.length} adresse(s) non attribuée(s)`} accent="#facc15" />
        <Card label="Non suivis" value={fmtUsd(lostUsd)} sub={`frais ${fmtUsd(res.lost.feesUsd)} · seuil ${fmtUsd(res.lost.belowThresholdUsd)}${res.lost.depthUsd ? ` · profondeur ${fmtUsd(res.lost.depthUsd)}` : ''}`} accent="#94a3b8" />
      </div>

      <FlowDiagram res={res} sourceLabel={attribution(w, res.source.address).label ?? short(w.get(res.source.address).addr, 6)} />

      <div>
        <div className="label mb-1.5">Destinations ({res.endpoints.length})</div>
        {res.endpoints.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-600 p-3 text-center text-meta text-ink-400">Aucun service identifié atteint dans ces limites.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-ink-700/60">
            <table className="w-full text-meta">
              <thead className="bg-ink-850 text-left text-ink-400">
                <tr><th className="px-2.5 py-2 font-medium">Service</th><th className="px-2 py-2 font-medium">Montant</th><th className="px-2 py-2 font-medium">Part</th><th className="px-2 py-2 font-medium">Adresses d'entrée</th><th className="px-2 py-2" /></tr>
              </thead>
              <tbody>
                {res.endpoints.map((e) => (
                  <Fragment key={e.entity.id}>
                  <tr className="border-t border-ink-700/50 align-top hover:bg-ink-800/60">
                    <td className="px-2.5 py-1.5"><EntityChip entity={e.entity} /><div className="mt-0.5 text-micro text-ink-400">{CATEGORY[e.entity.category].label}</div></td>
                    <td className="px-2 py-1.5 font-mono text-ink-100">{fmtUsd(e.usd)}<div className="text-micro text-ink-400">{amountsLine(e.amounts)}</div></td>
                    <td className="px-2 py-1.5 font-mono text-ink-200">{pct(e.usd, res.sourceUsd)}</td>
                    <td className="max-w-[260px] px-2 py-1">
                      {e.addresses.slice(0, 3).map((a) => <AddrLine key={a} w={w} id={a} compact />)}{e.addresses.length > 3 && <div className="px-2 text-micro text-ink-400">+ {e.addresses.length - 3} autre(s)</div>}
                      {viaDeposit.get(e.entity.id)?.map((a) => <AddrLine key={a} w={w} id={a} compact right={<span className="chip bg-accent/10 !text-micro text-accent" title="Adresse non attribuée qui reverse tout vers ce service (onglet Dépôt de l'inspecteur)">dépôt probable</span>} />)}
                    </td>
                    <td className="px-2 py-1.5">
                      {e.entity.compliance && (
                        <button className="btn-ghost !px-2 !py-1 text-micro" onClick={() => req(e.entity.id, [...(viaDeposit.get(e.entity.id) ?? []), ...e.addresses])}><Icon name="FileText" size={12} /> Réquisition</button>
                      )}
                      {e.entity.category === 'instant_exchanger' && (
                        <button className={`btn-ghost !px-2 !py-1 text-micro ${swapOpen === e.entity.id ? 'text-orange-200' : ''}`} onClick={() => setSwapOpen(swapOpen === e.entity.id ? null : e.entity.id)}><Icon name="Repeat" size={12} /> Sorties probables</button>
                      )}
                    </td>
                  </tr>
                  {swapOpen === e.entity.id && (
                    <tr className="bg-orange-400/[0.04]">
                      <td colSpan={5} className="space-y-2 px-2.5 py-2">
                        <div className="text-micro text-ink-300">Le lien on-chain s'arrête ici : rapprochement de chaque dépôt avec les paiements de {e.entity.name} (montant frais déduits, délai).</div>
                        {deposits(e).map((d) => <SwapMatchPanel key={d.txId + d.address} w={w} txId={d.txId} address={d.address} compact />)}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {res.stillHeld.length > 0 && (
        <div>
          <div className="label mb-1.5">Fonds encore détenus : pistes de gel ou de saisie</div>
          <div className="overflow-hidden rounded-xl border border-ink-700/60">
            {res.stillHeld.slice(0, 12).map((n) => (
              <AddrLine key={n.id} w={w} id={n.id} compact right={<span className="font-mono text-micro text-yellow-200">{amountsLine(n.held)} <span className="text-ink-400">({fmtUsd(n.heldUsd)} · {n.hop} saut{n.hop > 1 ? 's' : ''})</span></span>} />
            ))}
          </div>
        </div>
      )}

      {res.collateral.length > 0 && (
        <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/[0.05] p-3">
          <div className="flex items-center gap-1.5 text-dense font-semibold text-fuchsia-100"><Icon name="Landmark" size={13} /> Emprunts garantis par des fonds marqués (lien indirect)</div>
          <div className="mt-1 text-meta leading-relaxed text-ink-300">Ces fonds sortent du pool de prêt, pas des fonds de la victime : ils sont rattachés à proportion de la garantie marquée. Garantie et emprunt coexistent, d'où un total qui peut dépasser la source. À présenter comme un lien économique, distinct d'un flux.</div>
          <div className="mt-1.5 space-y-0.5">
            {res.collateral.map((c) => (
              <button key={c.txId} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-meta text-ink-100 hover:bg-ink-800" onClick={() => useGame.getState().select({ kind: 'tx', id: c.txId })}>
                <Icon name="ArrowRightLeft" size={11} className="text-fuchsia-300" />
                <span className="flex-1 truncate font-mono text-micro">{w.tx(c.txId).hash.slice(0, 18)}…</span>
                <span className="font-mono text-fuchsia-100">{fmtUsd(c.usd)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {res.truncated && <div className="text-micro text-amber-300"><Icon name="TriangleAlert" size={11} className="mr-1 inline" /> Calcul interrompu : le flux est trop étendu. Réduisez la profondeur ou relevez le seuil.</div>}

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={onShow}><Icon name="Waypoints" size={14} /> Afficher le flux dans le graphe ({res.path.length} tx)</button>
        <button className="btn-ghost" onClick={() => useGame.getState().clearTrace()}><Icon name="Eraser" size={14} /> Effacer le traçage</button>
      </div>
    </div>
  )
}

function Comparison({ results }: { results: Record<TraceMethod, TraceResult> }) {
  const ents = new Map<string, string>()
  for (const m of METHODS) for (const e of results[m].endpoints) ents.set(e.entity.id, e.entity.name)
  const src = results.fifo.sourceUsd
  const cell = (k: string, v: number) => <td key={k} className="px-2 py-1.5 text-right font-mono text-ink-100">{fmtUsd(v)} <span className="text-ink-400">{pct(v, src)}</span></td>
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-ink-700/60">
      <table className="w-full text-meta">
        <thead className="bg-ink-850 text-left text-ink-400">
          <tr><th className="px-2.5 py-2 font-medium">Comparaison des méthodes</th>{METHODS.map((m) => <th key={m} className="px-2 py-2 text-right font-medium">{TRACE_METHODS[m].short}</th>)}</tr>
        </thead>
        <tbody>
          {[...ents].map(([id, name]) => (
            <tr key={id} className="border-t border-ink-700/50">
              <td className="px-2.5 py-1.5 text-ink-200">{name}</td>
              {METHODS.map((m) => cell(m, results[m].endpoints.find((e) => e.entity.id === id)?.usd ?? 0))}
            </tr>
          ))}
          <tr className="border-t border-ink-700/50">
            <td className="px-2.5 py-1.5 text-yellow-200">Encore détenu (non attribué)</td>
            {METHODS.map((m) => cell(m, results[m].stillHeld.reduce((s, n) => s + n.heldUsd, 0)))}
          </tr>
        </tbody>
      </table>
      <div className="border-t border-ink-700/50 bg-ink-850/50 p-2 text-micro leading-relaxed text-ink-400">
        La méthode « poison » compte en entier tout montant touché par les fonds : ses totaux peuvent dépasser 100 % et délimitent un périmètre, pas un préjudice.
      </div>
    </div>
  )
}

export function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-ink-700/60 bg-ink-850/50 p-2.5">
      <div className="text-micro uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-0.5 font-mono text-title font-semibold" style={{ color: accent ?? '#fff' }}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-micro text-ink-400" title={sub}>{sub}</div>}
    </div>
  )
}

// ── Onglets de l'inspecteur d'adresse ────────────────────────────────────

export function TracePanel({ w, id }: { w: World; id: string }) {
  const trace = useGame((s) => s.trace)
  const n = trace?.result.byAddress.get(id)
  return (
    <div className="space-y-3">
      {!trace ? (
        <Empty icon="Route" title="Aucun traçage en cours" sub="Tracez les fonds reçus par cette adresse, ou lancez un traçage depuis l'adresse de la victime pour voir ici la part qui transite." />
      ) : !n ? (
        <Empty icon="Route" title="Hors du flux tracé" sub={`Le traçage ${TRACE_METHODS[trace.opts.method].short} en cours n'atteint pas cette adresse.`} />
      ) : (
        <div className="rounded-xl border border-ink-700/60 bg-ink-850/50 p-3 text-meta">
          <div className="label mb-1.5">Traçage {TRACE_METHODS[trace.opts.method].short} en cours</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-ink-400">Distance</dt><dd className="text-ink-100">{n.hop} saut{n.hop > 1 ? 's' : ''} depuis la source</dd>
            <dt className="text-ink-400">Reçu (marqué)</dt><dd className="font-mono text-ink-100">{amountsLine(n.received)} <span className="text-ink-400">({fmtUsd(n.receivedUsd)} · {pct(n.receivedUsd, trace.result.sourceUsd)})</span></dd>
            <dt className="text-ink-400">Encore détenu</dt><dd className="font-mono text-yellow-200">{amountsLine(n.held)} <span className="text-ink-400">({fmtUsd(n.heldUsd)})</span></dd>
          </dl>
        </div>
      )}
      <button className="btn-ghost w-full" onClick={() => openTracer({ address: id })}><Icon name="Route" size={14} /> Tracer les fonds reçus par cette adresse</button>
      {CHAINS[w.get(id).chain].model === 'utxo' && <button className="btn-ghost w-full" onClick={() => openPeel(id)}><Icon name="ListTree" size={14} /> Suivre comme peel chain</button>}
      {poolDeposits(w, id).length > 0 && <button className="btn-ghost w-full text-rose-200" onClick={() => openDemix(id)}><Icon name="ScanSearch" size={14} /> Démixer ses dépôts dans un pool</button>}
    </div>
  )
}

export function FundingPanel({ w, id }: { w: World; id: string }) {
  const steps = useMemo(() => fundingTree(w, id, 6), [w, id])
  if (!steps.length) return <Empty icon="Sprout" title="Aucun financement trouvé" sub="Cette adresse n'a reçu aucun fonds dans le périmètre de l'exercice." />
  const last = steps[steps.length - 1]
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 p-2 text-micro leading-relaxed text-ink-300">
        Remonte le <span className="text-white">premier financement</span> de chaque adresse (sur Ethereum, Tron ou Solana, c'est souvent l'apport de gaz), jusqu'à un service identifié. Un premier financeur issu d'un exchange est une piste d'identification par réquisition.
      </div>
      {steps.map((s, i) => (
        <div key={s.txId} className="rounded-lg border border-ink-700/60 p-1.5">
          <div className="flex items-center gap-1.5 px-2 text-micro text-ink-400">
            <span className="font-mono text-ink-300">{i + 1}.</span> {fmtTime(s.time)} · {fmtAsset(s.value, s.asset)}{s.viaBridge ? ' · via un bridge' : ''}
            <button className="ml-auto text-ink-400 hover:text-accent" title="Ajouter la transaction au graphe" onClick={() => useGame.getState().revealTx(s.txId, true)}><Icon name="Plus" size={12} /></button>
          </div>
          <AddrLine w={w} id={s.funder} compact />
        </div>
      ))}
      <div className="px-1 text-micro text-ink-400">
        {!last.entity
          ? 'Aucun service identifié dans la chaîne de financement.'
          : last.entity.compliance
            ? <>Remontée arrêtée sur <span className="text-ink-100">{last.entity.name}</span> : demander le titulaire du compte à l'origine du retrait.</>
            : <>Remontée arrêtée sur <span className="text-ink-100">{last.entity.name}</span> ({CATEGORY[last.entity.category].label.toLowerCase()}) : pas d'interlocuteur, l'origine des fonds est volontairement masquée.</>}
      </div>
    </div>
  )
}

/** Ouvre le traçage sur la sélection courante (adresse, ou bénéficiaire principal d'une transaction). */
export function openTracerFromSelection() {
  const g = useGame.getState()
  const w = g.inst?.world
  const sel = g.selection
  if (!w) return
  if (sel?.kind === 'address') return openTracer({ address: sel.id })
  if (sel?.kind === 'tx') {
    const tx = w.tx(sel.id)
    const to = tx.model === 'utxo'
      ? [...tx.outputs].sort((a, b) => b.value - a.value)[0]?.address
      : [...tx.transfers].sort((a, b) => usd(b.asset, b.value) - usd(a.asset, a.value))[0]?.to
    if (to) return openTracer({ address: to, txId: tx.id })
  }
  if (g.trace) return useUi.getState().set({ tracer: { open: true } })
  useUi.getState().notify('Sélectionnez d\'abord une adresse ou une transaction à tracer.')
}

/** Cherche un chemin entre les deux adresses sélectionnées (Maj + clic). */
export function findPathFromSelection() {
  const g = useGame.getState()
  if (g.multi.length !== 2) {
    useUi.getState().notify('Sélectionnez exactement deux adresses (Maj + clic) pour chercher un chemin entre elles.')
    return
  }
  const [a, b] = g.multi
  if (!g.runPath(a, b)) g.runPath(b, a)
}
