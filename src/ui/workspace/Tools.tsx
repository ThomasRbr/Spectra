import { useEffect, useMemo, useRef, useState } from 'react'
import type { Core } from 'cytoscape'
import { CHAINS, fmtAsset, fmtUsd, type ChainId, type AssetId } from '../../engine/chains'
import { CATEGORY } from '../../engine/entities'
import { attribution, correlate } from '../../engine/analysis'
import { TRACE_METHODS } from '../../engine/tracing'
import { shortAddr } from '../../engine/addressgen'
import { useGame, FLAG_META } from '../../store/game'
import type { World } from '../../engine/world'
import { useUi } from '../../store/ui'
import { useProfile, rankOf } from '../../store/profile'
import { DIFFICULTY } from '../../scenarios/types'
import { GRADE_COLOR, evaluate } from '../../lib/scoring'
import { CADRE_LABEL, requisitionText, type Cadre } from '../../lib/requisition'
import { LESSONS, TRACKS } from '../../academy'
import { ChainBadge, CopyButton, DifficultyBadge, Icon, Modal, ProgressBar, RichText, fmtDuration, fmtTime } from '../common'
import { AddrLine } from './Inspector'
import { flowDiagramSvg } from './Synthesis'

// ── Corrélateur montant / temps ──────────────────────────────────────────

export function Correlator() {
  const st = useUi((s) => s.correlator)
  const inst = useGame((s) => s.inst)
  const w = inst?.world
  const chainsInWorld = useMemo(() => (w ? [...new Set([...w.addresses.values()].map((a) => a.chain))] : []), [w])
  const [usdV, setUsd] = useState(0)
  const [time, setTime] = useState(0)
  const [windowH, setWindowH] = useState(6)
  const [tol, setTol] = useState(5)
  const [chains, setChains] = useState<ChainId[]>([])
  const [entityId, setEntityId] = useState<string>('')
  const [ran, setRan] = useState(false)

  useEffect(() => {
    if (!st.open || !st.preset) return
    setUsd(Math.round(st.preset.usd * 100) / 100)
    setTime(st.preset.time)
    setChains(st.preset.chains ?? chainsInWorld)
    setEntityId(st.preset.entityId ?? '')
    setRan(false)
  }, [st.open, st.preset, chainsInWorld])

  const hits = useMemo(() => {
    if (!w || !ran) return []
    return correlate(w, { time, usd: usdV, chains, windowH, tolerancePct: tol / 100, entityId: entityId || undefined, excludeTx: st.preset?.excludeTx })
  }, [w, ran, time, usdV, chains, windowH, tol, entityId, st.preset])

  if (!w) return null
  const services = [...w.entities.values()].filter((e) => e.known && (e.id === entityId || ['instant_exchanger', 'mixer', 'exchange', 'bridge', 'otc', 'privacy_pool', 'coinjoin', 'sanctioned', 'p2p', 'dex'].includes(e.category)))
  const close = () => useUi.getState().set({ correlator: { open: false } })
  const toLocal = (t: number) => {
    const d = new Date(t * 1000)
    const off = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - off).toISOString().slice(0, 16)
  }

  return (
    <Modal open={st.open} onClose={close} title="Corrélateur montant / temps" icon="Radar" width="max-w-4xl">
      <div className="mb-3 rounded-xl border border-ink-700/60 bg-ink-850/50 p-3 text-[12px] leading-relaxed text-ink-300">
        Quand un service coupe le lien on-chain (échangeur instantané, mixeur, passage par Monero), on cherche les paiements sortants du même service dans une fenêtre de temps, pour un montant équivalent (moins les frais). Le résultat est <span className="text-white">probabiliste</span> : une corrélation doit être corroborée (réquisition au service, OSINT, comportement ultérieur).
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <label className="block">
          <span className="label">Montant de référence (USD)</span>
          <input className="input mt-1 font-mono" type="number" value={usdV} onChange={(e) => setUsd(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="label">Début de la fenêtre</span>
          <input className="input mt-1 font-mono" type="datetime-local" value={time ? toLocal(time) : ''} onChange={(e) => {
            const t = Math.floor(new Date(e.target.value).getTime() / 1000)
            if (Number.isFinite(t)) setTime(t)
          }} />
        </label>
        <label className="block">
          <span className="label">Service émetteur</span>
          <select className="input mt-1" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
            <option value="">Tout émetteur</option>
            {services.map((e) => <option key={e.id} value={e.id}>{e.name} · {CATEGORY[e.category].label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Fenêtre : {windowH} h</span>
          <input className="mt-2 w-full accent-cyan-400" type="range" min={1} max={240} value={windowH} onChange={(e) => setWindowH(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="label">Tolérance montant : ±{tol} %</span>
          <input className="mt-2 w-full accent-cyan-400" type="range" min={1} max={40} value={tol} onChange={(e) => setTol(Number(e.target.value))} />
        </label>
        <div>
          <span className="label">Chaînes de sortie</span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {chainsInWorld.map((c) => (
              <button key={c} onClick={() => setChains((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))} className={`chip border ${chains.includes(c) ? '' : 'opacity-35'}`} style={{ color: CHAINS[c].color, borderColor: `${CHAINS[c].color}55` }}>
                {CHAINS[c].short}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button className="btn-primary mt-4 w-full" onClick={() => {
        setRan(true)
        useGame.getState().addLog(`Corrélation : ${fmtUsd(usdV)} ±${tol} %, fenêtre ${windowH} h${entityId ? `, émetteur ${w.entities.get(entityId)?.name}` : ''}`, 'tool')
      }}>
        <Icon name="ScanSearch" size={15} /> Lancer la recherche
      </button>
      {ran && (
        <div className="mt-4">
          <div className="label mb-2">{hits.length} candidat(s)</div>
          {hits.length === 0 ? (
            <div className="rounded-lg border border-dashed border-ink-600 p-4 text-center text-[12px] text-ink-400">Aucun paiement compatible. Élargissez la fenêtre ou la tolérance, ou retirez le filtre d'émetteur.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-ink-700/60">
              <table className="w-full text-[11.5px]">
                <thead className="bg-ink-850 text-left text-ink-400">
                  <tr>
                    <th className="px-2.5 py-2 font-medium">Score</th>
                    <th className="px-2 py-2 font-medium">Chaîne</th>
                    <th className="px-2 py-2 font-medium">Δt</th>
                    <th className="px-2 py-2 font-medium">Montant</th>
                    <th className="px-2 py-2 font-medium">Bénéficiaire</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {hits.map((h) => (
                    <tr key={h.txId + h.to} className="border-t border-ink-700/50 hover:bg-ink-800/60">
                      <td className="px-2.5 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-accent" style={{ width: `${h.score * 100}%` }} /></div>
                          <span className="font-mono text-ink-300">{Math.round(h.score * 100)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5"><ChainBadge chain={h.chain} compact /></td>
                      <td className="px-2 py-1.5 font-mono text-ink-200">+{h.dtMin < 120 ? `${h.dtMin} min` : `${(h.dtMin / 60).toFixed(1)} h`}</td>
                      <td className="px-2 py-1.5 font-mono text-ink-100">{fmtAsset(h.value, h.asset as AssetId)} <span className="text-ink-400">({fmtUsd(h.usd)})</span></td>
                      <td className="max-w-[220px] px-2 py-1.5"><AddrLine w={w} id={h.to} compact /></td>
                      <td className="px-2 py-1.5">
                        <button className="btn-ghost !px-2 !py-1 text-[11px]" title="Ajouter au graphe avec un lien de corrélation" onClick={() => {
                          const g = useGame.getState()
                          g.revealTx(h.txId, true)
                          const src = referenceAddress(w, st.preset?.excludeTx, entityId || undefined)
                          if (src) {
                            g.addAddress(src)
                            g.addLink({ source: src, target: h.to, kind: 'correlation', label: `corrélation · ${Math.round(h.score * 100)}`, txId: h.txId })
                          }
                          g.select({ kind: 'address', id: h.to })
                        }}>
                          <Icon name="Link2" size={12} /> Lier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

/** Adresse de départ d'une corrélation : le dépôt vers le service dans la transaction de référence. */
function referenceAddress(w: World, txId: string | undefined, entityId: string | undefined): string | undefined {
  if (!txId || !w.txs.has(txId)) return undefined
  const tx = w.tx(txId)
  const outs = tx.model === 'utxo' ? tx.outputs.map((o) => o.address) : tx.transfers.map((t) => t.to)
  const byEntity = entityId ? outs.find((a) => w.get(a).entityId === entityId) : undefined
  const attributed = outs.find((a) => attribution(w, a).entity)
  return byEntity ?? attributed ?? outs[0]
}

// ── Recherche (Ctrl+K) ───────────────────────────────────────────────────

export function SearchPalette() {
  const open = useUi((s) => s.paletteOpen)
  const inst = useGame((s) => s.inst)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) {
      setQ('')
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])
  const w = inst?.world
  const results = useMemo(() => {
    if (!w || q.trim().length < 4) return { addrs: [] as string[], txs: [] as string[], ents: [] as { id: string; addrs: string[] }[] }
    const s = q.trim().toLowerCase()
    const addrs = [...w.addresses.values()].filter((a) => a.addr.toLowerCase().includes(s)).slice(0, 12).map((a) => a.id)
    const txs = w.visibleTxs().filter((t) => t.hash.toLowerCase().includes(s)).slice(0, 8).map((t) => t.id)
    const ents = [...w.entities.values()].filter((e) => e.known && e.name.toLowerCase().includes(s)).map((e) => ({
      id: e.id,
      addrs: [...w.addresses.values()].filter((a) => a.entityId === e.id && attribution(w, a.id).entity && (a.tags.includes('hot') || a.contract || a.tags.includes('liquid'))).slice(0, 6).map((a) => a.id),
    }))
    return { addrs, txs, ents }
  }, [w, q])
  if (!w) return null
  const close = () => useUi.getState().set({ paletteOpen: false })
  return (
    <Modal open={open} onClose={close} title="Recherche" icon="Search" width="max-w-xl">
      <input ref={inputRef} className="input font-mono" placeholder="Adresse, hash de transaction ou nom d'entité (4 caractères min.)" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 space-y-3">
        {results.addrs.length > 0 && (
          <div>
            <div className="label mb-1">Adresses</div>
            {results.addrs.map((id) => <div key={id} onClick={close}><AddrLine w={w} id={id} /></div>)}
          </div>
        )}
        {results.txs.length > 0 && (
          <div>
            <div className="label mb-1">Transactions</div>
            {results.txs.map((id) => (
              <button key={id} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ink-800" onClick={() => {
                useGame.getState().revealTx(id, true)
                useGame.getState().select({ kind: 'tx', id })
                close()
              }}>
                <ChainBadge chain={w.tx(id).chain} compact />
                <span className="font-mono text-[11.5px] text-ink-100">{shortAddr(w.tx(id).hash, 14)}</span>
                <span className="ml-auto text-[10.5px] text-ink-400">{fmtTime(w.tx(id).time)}</span>
              </button>
            ))}
          </div>
        )}
        {results.ents.length > 0 && (
          <div>
            <div className="label mb-1">Entités (adresses publiques connues)</div>
            {results.ents.map((e) => (
              <div key={e.id} className="mb-2">
                <div className="px-2 text-[12px] font-medium text-white">{w.entities.get(e.id)!.name}</div>
                {e.addrs.map((id) => <div key={id} onClick={close}><AddrLine w={w} id={id} /></div>)}
              </div>
            ))}
          </div>
        )}
        {q.trim().length >= 4 && !results.addrs.length && !results.txs.length && !results.ents.length && <div className="py-6 text-center text-[12px] text-ink-400">Aucun résultat dans le périmètre de l'affaire.</div>}
      </div>
    </Modal>
  )
}

// ── Réquisition ──────────────────────────────────────────────────────────

const NO_ADDRESSES: string[] = []

export function RequisitionModal() {
  const st = useUi((s) => s.requisition)
  const inst = useGame((s) => s.inst)
  const revealed = useGame((s) => s.revealed)
  const profile = useProfile()
  const [cadre, setCadre] = useState<Cadre>('preliminaire')
  const [procedure, setProcedure] = useState('')
  const [magistrate, setMagistrate] = useState('')
  const [freeze, setFreeze] = useState(true)
  const [txSel, setTxSel] = useState<string[]>([])
  const w = inst?.world
  const entity = st.entityId && w ? w.entities.get(st.entityId) : undefined
  const addresses = st.addresses ?? NO_ADDRESSES
  const relatedTx = useMemo(() => {
    if (!w || !st.open) return NO_ADDRESSES
    return addresses.flatMap((a) => w.txsOf(a).filter((t) => revealed[t.id] && w.flowIn(t, a).length).map((t) => t.id))
  }, [w, addresses, revealed, st.open])
  useEffect(() => {
    setTxSel(relatedTx.slice(0, 5))
  }, [relatedTx])
  if (!w || !entity) return null
  const times = txSel.map((t) => w.tx(t).time)
  const from = times.length ? new Date((Math.min(...times) - 30 * 86400) * 1000).toLocaleDateString('fr-FR') : ''
  const to = new Date().toLocaleDateString('fr-FR')
  const text = requisitionText({ w, entity, addresses, txIds: txSel, cadre, officer: profile.name, unit: profile.unit, procedure, magistrate, from, to, freeze })
  const close = () => useUi.getState().set({ requisition: { open: false } })
  return (
    <Modal open={st.open} onClose={close} title={`Réquisition — ${entity.name}`} icon="Gavel" width="max-w-5xl">
      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <label className="block">
            <span className="label">Cadre procédural</span>
            <select className="input mt-1" value={cadre} onChange={(e) => setCadre(e.target.value as Cadre)}>
              {(Object.keys(CADRE_LABEL) as Cadre[]).map((c) => <option key={c} value={c}>{CADRE_LABEL[c].label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">N° de procédure</span>
            <input className="input mt-1 font-mono" value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="2026/00000" />
          </label>
          {cadre !== 'flagrance' && (
            <label className="block">
              <span className="label">{cadre === 'preliminaire' ? 'Magistrat autorisant' : 'Juge mandant'}</span>
              <input className="input mt-1" value={magistrate} onChange={(e) => setMagistrate(e.target.value)} />
            </label>
          )}
          <label className="flex items-center gap-2 text-[12.5px] text-ink-100">
            <input type="checkbox" className="accent-cyan-400" checked={freeze} onChange={(e) => setFreeze(e.target.checked)} /> Demander un blocage conservatoire
          </label>
          <div>
            <span className="label">Transactions citées</span>
            <div className="mt-1 max-h-44 space-y-1 overflow-y-auto">
              {relatedTx.length === 0 && <div className="text-[11px] text-ink-400">Ajoutez au graphe les dépôts concernés pour les citer.</div>}
              {relatedTx.map((t) => (
                <label key={t} className="flex items-center gap-2 text-[11px]">
                  <input type="checkbox" className="accent-cyan-400" checked={txSel.includes(t)} onChange={(e) => setTxSel((s) => (e.target.checked ? [...s, t] : s.filter((x) => x !== t)))} />
                  <span className="font-mono text-ink-200">{shortAddr(w.tx(t).hash, 10)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-violet-400/30 bg-violet-400/5 p-2.5 text-[11px] leading-relaxed text-ink-200">
            <Icon name="Scale" size={12} className="mr-1 inline text-violet-glow" />
            Modèle pédagogique. Vérifiez toujours les textes en vigueur et utilisez les trames de votre service.
          </div>
        </div>
        <div className="relative">
          <div className="absolute right-2 top-2 flex gap-1">
            <button className="btn-outline !py-1 text-xs" onClick={() => navigator.clipboard?.writeText(text).catch(() => undefined)}>
              <Icon name="Copy" size={13} /> Copier
            </button>
          </div>
          <pre className="max-h-[62vh] overflow-auto whitespace-pre-wrap rounded-xl border border-ink-700 bg-[#f7f5ef] p-6 font-serif text-[12.5px] leading-relaxed text-[#1a1a1a]">{text}</pre>
        </div>
      </div>
    </Modal>
  )
}

// ── Indice général ───────────────────────────────────────────────────────

export function HintModal() {
  const open = useUi((s) => s.hintOpen)
  const inst = useGame((s) => s.inst)
  const hintsUsed = useGame((s) => s.hintsUsed)
  if (!inst) return null
  const close = () => useUi.getState().set({ hintOpen: false })
  const shown = inst.hints.slice(0, hintsUsed)
  return (
    <Modal open={open} onClose={close} title="Indices" icon="Lightbulb" width="max-w-lg">
      <div className="space-y-2">
        {shown.map((h, i) => (
          <div key={i} className="flex gap-2 rounded-lg border border-yellow-400/25 bg-yellow-400/5 p-3 text-[12.5px] text-yellow-50">
            <span className="font-mono text-yellow-300">{i + 1}.</span> {h}
          </div>
        ))}
        {hintsUsed < inst.hints.length ? (
          <button className="btn-outline w-full" onClick={() => useGame.getState().useHint()}>
            <Icon name="Lightbulb" size={14} className="text-yellow-300" /> Révéler l'indice suivant (−5 pts)
          </button>
        ) : (
          <div className="text-center text-[12px] text-ink-400">Tous les indices ont été consultés.</div>
        )}
      </div>
    </Modal>
  )
}

// ── Confirmation de remise ───────────────────────────────────────────────

export function ConfirmSubmit() {
  const open = useUi((s) => s.confirmSubmit)
  const inst = useGame((s) => s.inst)
  const answers = useGame((s) => s.answers)
  const inCert = useGame((s) => !!s.cert)
  if (!inst) return null
  const missing = inst.objectives.filter((o) => evaluate(o, answers[o.id]).status === 'empty')
  const close = () => useUi.getState().set({ confirmSubmit: false })
  return (
    <Modal open={open} onClose={close} title="Remettre le rapport ?" icon="Send" width="max-w-md">
      <p className="text-[13px] text-ink-200">Une fois remis, vos réponses sont corrigées et ne peuvent plus être modifiées.</p>
      {missing.length > 0 && (
        <div className="mt-3 rounded-lg border border-orange-400/30 bg-orange-400/5 p-3 text-[12px] text-orange-100">
          <Icon name="TriangleAlert" size={13} className="mr-1 inline text-orange-300" />
          {missing.length} objectif(s) sans réponse : {missing.map((o) => inst.objectives.indexOf(o) + 1).join(', ')}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={close}>Continuer l'enquête</button>
        <button className="btn-primary" onClick={() => {
          close()
          if (useGame.getState().cert) useUi.getState().set({ certReport: true })
          else useGame.getState().submit()
        }}>
          <Icon name="Send" size={14} /> {inCert ? 'Rédiger le rapport du volet' : 'Remettre'}
        </button>
      </div>
    </Modal>
  )
}

// ── Briefing ─────────────────────────────────────────────────────────────

export function Briefing() {
  const open = useUi((s) => s.briefingOpen)
  const inst = useGame((s) => s.inst)
  const template = useGame((s) => s.template)
  const mode = useGame((s) => s.mode)
  const coverage = useGame((s) => s.coverage)
  const seed = useGame((s) => s.seed)
  const cert = useGame((s) => s.cert)
  if (!inst || !template) return null
  const close = () => useUi.getState().set({ briefingOpen: false })
  return (
    <Modal open={open} onClose={close} title="Ordre de mission" icon="FileText" width="max-w-3xl">
      <div className="relative overflow-hidden rounded-2xl border border-ink-700 hero-gradient p-5">
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyBadge d={template.difficulty} />
          {template.chains.map((c) => <ChainBadge key={c} chain={c} />)}
          <span className="chip bg-ink-800 text-ink-200"><Icon name="Clock" size={11} /> ~{template.estMinutes} min</span>
          {mode === 'examen' && <span className="chip bg-rose-500/15 text-rose-300"><Icon name="Timer" size={11} /> Mode examen</span>}
          {coverage === 'partial' && <span className="chip bg-orange-500/15 text-orange-300"><Icon name="EyeOff" size={11} /> Attribution partielle</span>}
          {!cert && <span className="chip ml-auto bg-ink-800 font-mono text-ink-300">graine {seed}</span>}
        </div>
        <h2 className="mt-3 text-2xl font-bold text-white">{inst.title}</h2>
        <p className="mt-1 text-[13px] text-ink-300">{template.tagline}</p>
      </div>
      <div className="mt-4">
        <RichText text={inst.briefing} />
      </div>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-ink-700/60 bg-ink-850/50 p-3">
          <div className="label mb-2">Objectifs ({inst.objectives.length})</div>
          <ol className="space-y-1.5">
            {inst.objectives.map((o, i) => (
              <li key={o.id} className="flex gap-2 text-[12px] text-ink-200"><span className="font-mono text-accent">{i + 1}.</span> {o.prompt}</li>
            ))}
          </ol>
        </div>
        <div className="rounded-xl border border-ink-700/60 bg-ink-850/50 p-3">
          <div className="label mb-2">Méthode conseillée</div>
          <ul className="space-y-1.5 text-[12px] text-ink-200">
            <li className="flex gap-2"><Icon name="FolderOpen" size={13} className="mt-0.5 shrink-0 text-accent" /> Lisez les pièces : les adresses surlignées s'ajoutent au graphe d'un clic.</li>
            <li className="flex gap-2"><Icon name="MousePointer2" size={13} className="mt-0.5 shrink-0 text-accent" /> Double-clic sur un nœud = déplier ses sorties. Clic droit = menu complet.</li>
            <li className="flex gap-2"><Icon name="Flag" size={13} className="mt-0.5 shrink-0 text-accent" /> Marquez suspects, victimes et impasses au fil de l'eau.</li>
            <li className="flex gap-2"><Icon name="Radar" size={13} className="mt-0.5 shrink-0 text-accent" /> Utilisez le corrélateur quand le lien on-chain est rompu.</li>
            <li className="flex gap-2"><Icon name="Keyboard" size={13} className="mt-0.5 shrink-0 text-accent" /> <span className="kbd">Ctrl K</span> recherche · <span className="kbd">F</span> ajuster · <span className="kbd">L</span> réorganiser.</li>
          </ul>
        </div>
      </div>
      <button className="btn-primary mt-4 w-full !py-2.5 text-[14px]" onClick={close}>
        <Icon name="Play" size={16} /> Commencer l'enquête
      </button>
    </Modal>
  )
}

// ── Débriefing ───────────────────────────────────────────────────────────

export function Debrief({ onReplay, onExit }: { onReplay: () => void; onExit: () => void }) {
  const score = useGame((s) => s.score)
  const inst = useGame((s) => s.inst)
  const template = useGame((s) => s.template)
  const startedAt = useGame((s) => s.startedAt)
  const finishedAt = useGame((s) => s.finishedAt)
  const xpGained = useGame((s) => s.xpGained)
  const xpNote = useGame((s) => s.xpNote)
  const showTruth = useGame((s) => s.showTruth)
  const inCert = useGame((s) => !!s.cert)
  const xp = useProfile((s) => s.xp)
  const [open, setOpen] = useState(true)
  useEffect(() => {
    setOpen(true)
  }, [score])
  if (!score || !inst || !template || inCert) return null
  const rank = rankOf(xp)
  const color = GRADE_COLOR[score.grade]
  const lessons = (template.lessons ?? []).map((id) => LESSONS.find((l) => l.id === id)).filter(Boolean)
  if (!open) {
    return (
      <button className="btn-primary absolute bottom-4 left-1/2 z-30 -translate-x-1/2 shadow-glow" onClick={() => setOpen(true)}>
        <Icon name="Trophy" size={15} /> Débriefing · {score.total}/{score.max}
      </button>
    )
  }
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Débriefing" icon="Trophy" width="max-w-4xl">
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-center rounded-2xl border border-ink-700 hero-gradient p-5 text-center">
          <div className="relative grid h-32 w-32 place-items-center rounded-full border-4" style={{ borderColor: color, boxShadow: `0 0 40px ${color}55, inset 0 0 30px ${color}22` }}>
            <span className="text-6xl font-black" style={{ color }}>{score.grade}</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">{score.total}<span className="text-base text-ink-400">/{score.max}</span></div>
          <div className="text-[12px] text-ink-300">{Math.round(score.pct * 100)} % · {fmtDuration(Math.round(((finishedAt ?? Date.now()) - startedAt) / 1000))}</div>
          {score.penalties > 0 && <div className="mt-1 text-[11px] text-yellow-300">−{score.penalties} pts d'indices</div>}
          <div className="mt-4 w-full rounded-xl border border-accent/30 bg-accent/5 p-2.5">
            <div className="text-[18px] font-bold text-accent">+{xpGained} XP</div>
            {xpNote && <div className="mt-0.5 text-[10.5px] leading-snug text-ink-300">{xpNote}</div>}
            <div className="text-[11px] text-ink-300">{rank.name} · niveau {rank.level}</div>
            <ProgressBar value={rank.progress} className="mt-1.5" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="label mb-2">Résultats par objectif</div>
          <div className="space-y-1">
            {score.results.map((r, i) => {
              const c = r.status === 'correct' ? '#34d399' : r.status === 'partial' ? '#facc15' : '#f43f5e'
              return (
                <div key={r.id} className="flex items-center gap-2 rounded-lg border border-ink-700/60 px-2.5 py-1.5">
                  <Icon name={r.status === 'correct' ? 'CircleCheck' : r.status === 'partial' ? 'CircleDot' : 'CircleX'} size={14} color={c} />
                  <span className="flex-1 truncate text-[12px] text-ink-100">{i + 1}. {inst.objectives[i].prompt}</span>
                  <span className="font-mono text-[11.5px]" style={{ color: c }}>{r.earned}/{r.max}</span>
                </div>
              )
            })}
          </div>
          <div className="label mb-2 mt-4">Ce qui s'est réellement passé</div>
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3.5">
            <RichText text={inst.truth.debrief} className="!text-[12.5px]" />
          </div>
          <div className="mt-2 text-[11px] text-ink-400">Les corrections détaillées sont visibles dans l'onglet Objectifs du dossier.</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-outline" onClick={() => {
          if (!showTruth) useGame.getState().toggleTruth()
          setOpen(false)
        }}>
          <Icon name="Route" size={14} className="text-amber-300" /> Révéler le flux réel sur le graphe
        </button>
        <button className="btn-outline" onClick={() => useUi.getState().set({ reportOpen: true })}>
          <Icon name="Printer" size={14} /> Rapport d'analyse
        </button>
        <button className="btn-outline" onClick={onReplay}>
          <Icon name="RotateCcw" size={14} /> Nouvelle affaire (autre graine)
        </button>
        <button className="btn-primary ml-auto" onClick={onExit}>
          <Icon name="LayoutGrid" size={14} /> Retour aux missions
        </button>
      </div>
      {lessons.length > 0 && (
        <div className="mt-4 border-t border-ink-700/60 pt-3">
          <div className="label mb-2">Pour aller plus loin</div>
          <div className="flex flex-wrap gap-1.5">
            {lessons.map((l) => (
              <button key={l!.id} className="chip border border-ink-600 bg-ink-800 !py-1 text-ink-100 hover:border-accent" onClick={() => {
                useUi.getState().openLesson(l!.id)
              }}>
                <Icon name="GraduationCap" size={12} className="text-accent" /> {l!.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Rapport d'analyse imprimable ─────────────────────────────────────────

export function ReportModal() {
  const open = useUi((s) => s.reportOpen)
  const g = useGame()
  const profile = useProfile()
  if (!g.inst || !g.template) return null
  const w = g.inst.world
  const close = () => useUi.getState().set({ reportOpen: false })
  const build = () => {
    const cy = (window as unknown as { __spectraCy?: () => Core | null }).__spectraCy?.()
    const png = cy ? cy.png({ full: true, bg: '#ffffff', scale: 1.5 }) : ''
    const flagged = Object.entries(g.flags)
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const rows = flagged.map(([id, f]) => {
      const a = w.get(id)
      const at = attribution(w, id)
      return `<tr><td>${FLAG_META[f].label}</td><td class="mono">${a.addr}</td><td>${CHAINS[a.chain].name}</td><td>${at.label ?? '—'}</td><td>${esc(g.notes[id] ?? '')}</td></tr>`
    }).join('')
    const answers = g.inst!.objectives.map((o, i) => {
      const v = g.answers[o.id]
      let shown = '—'
      if (v !== undefined) {
        if (o.type === 'address') shown = `<span class="mono">${w.get(String(v)).addr}</span>`
        else if (o.type === 'addresses') shown = (v as string[]).map((x) => `<span class="mono">${w.get(x).addr}</span>`).join('<br>')
        else if (o.type === 'tx') shown = `<span class="mono">${w.tx(String(v)).hash}</span>`
        else if (o.type === 'entity') shown = w.entities.get(String(v))?.name ?? String(v)
        else if (o.type === 'choice') shown = esc(o.options[Number(v)] ?? '')
        else shown = String(v) + (o.type === 'amount' ? ` ${o.unit}` : '')
      }
      return `<tr><td>${i + 1}</td><td>${esc(o.prompt)}</td><td>${shown}</td></tr>`
    }).join('')
    const tr = g.trace
    const amounts = (m: Partial<Record<AssetId, number>>) => Object.entries(m).filter(([, v]) => (v ?? 0) > 0).map(([a, v]) => fmtAsset(v!, a as AssetId)).join(' + ')
    const share = (v: number) => (tr && tr.result.sourceUsd > 0 ? `${Math.round((v / tr.result.sourceUsd) * 100)} %` : '—')
    const traceHtml = tr
      ? `<div class="box">Source : fonds reçus par <span class="mono">${w.get(tr.source.address).addr}</span> dans la transaction <span class="mono">${w.tx(tr.source.txId).hash}</span>, soit ${amounts(tr.result.sourceAmounts)} (${fmtUsd(tr.result.sourceUsd)}).<br>
Méthode d'attribution : <b>${TRACE_METHODS[tr.opts.method].label}</b>. ${esc(TRACE_METHODS[tr.opts.method].help)}<br>
Paramètres : ${tr.opts.maxHops ?? 10} sauts au plus, seuil de suivi ${fmtUsd(tr.opts.minUsd ?? 10)}, arrêt sur les services identifiés : ${tr.opts.stopAtServices === false ? 'non' : 'oui'}${tr.opts.until ? `, situation au ${new Date(tr.opts.until * 1000).toLocaleString('fr-FR')}` : ''}. Les montants attribués dépendent de la méthode retenue et ne préjugent pas de l'appréciation du magistrat.</div>
<div class="box">${flowDiagramSvg(tr.result, { light: true, sourceLabel: attribution(w, tr.source.address).label ?? shortAddr(w.get(tr.source.address).addr, 6) })}</div>
<table><tr><th>Destination</th><th>Montant</th><th>Part</th><th>Adresses d'entrée</th></tr>${tr.result.endpoints.map((e) => `<tr><td>${esc(e.entity.name)}</td><td>${amounts(e.amounts)} (${fmtUsd(e.usd)})</td><td>${share(e.usd)}</td><td class="mono">${e.addresses.map((a) => w.get(a).addr).join('<br>')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Aucun service identifié atteint.</td></tr>'}</table>
${tr.result.stillHeld.length ? `<table><tr><th>Fonds encore détenus (non attribués)</th><th>Montant</th><th>Part</th></tr>${tr.result.stillHeld.slice(0, 20).map((n) => `<tr><td class="mono">${w.get(n.id).addr}</td><td>${amounts(n.held)} (${fmtUsd(n.heldUsd)})</td><td>${share(n.heldUsd)}</td></tr>`).join('')}</table>` : ''}`
      : '<div class="muted">Aucun traçage des fonds réalisé.</div>'
    const journal = g.log.map((l) => `<li><span class="muted">${new Date(l.t).toLocaleString('fr-FR')}</span> — ${esc(l.text)}</li>`).join('')
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport d'analyse — ${esc(g.inst!.title)}</title>
<style>
body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#111;margin:36px;font-size:12.5px;line-height:1.5}
h1{font-size:20px;margin:0}h2{font-size:14px;border-bottom:2px solid #0e7490;padding-bottom:3px;margin-top:26px;color:#0e7490;text-transform:uppercase;letter-spacing:.06em}
table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border:1px solid #ccc;padding:5px 7px;vertical-align:top;text-align:left}th{background:#f1f5f9}
.mono{font-family:Consolas,monospace;font-size:11px;word-break:break-all}.muted{color:#666}.head{display:flex;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:10px}
.box{border:1px solid #ccc;background:#fafafa;padding:10px 12px;margin-top:8px}img{max-width:100%;border:1px solid #ddd;margin-top:8px}
.print{position:fixed;top:12px;right:12px;padding:8px 14px;background:#0e7490;color:white;border:0;border-radius:6px;cursor:pointer}
@media print{.print{display:none}body{margin:12mm}}
</style></head><body>
<button class="print" onclick="window.print()">Imprimer / PDF</button>
<div class="head"><div><div class="muted">${esc(profile.unit)}</div><h1>Rapport d'analyse blockchain</h1><div>${esc(g.inst!.title)}</div></div>
<div style="text-align:right"><div>Rédacteur : ${esc(profile.name)}</div><div>Date : ${new Date().toLocaleDateString('fr-FR')}</div><div class="muted">Exercice SPECTRA · ${esc(g.template!.title)} · graine ${g.seed}</div></div></div>
<h2>1. Contexte</h2><div>${esc(g.inst!.briefing).replace(/\n\n/g, '<br><br>')}</div>
<h2>2. Méthodologie</h2><div class="box">Analyse réalisée à partir des données publiques des registres concernés (${g.template!.chains.map((c) => CHAINS[c].name).join(', ')}). Heuristiques employées : suivi des flux, détection du rendu (type d'adresse, montants ronds, adresses neuves), regroupement par entrées communes (hors CoinJoin), attribution par base de données, empreinte des logiciels de portefeuille, comportement des adresses de dépôt, corrélation montant/temps, analyse post-mix. Ces heuristiques sont probabilistes ; les rattachements présentés constituent des hypothèses d'enquête à corroborer (réquisitions, éléments techniques, auditions).${g.live ? `<br>Situation arrêtée au <b>${new Date(g.live.now * 1000).toLocaleString('fr-FR')}</b> : les mouvements postérieurs ne sont pas pris en compte.${g.watch.length ? ` Adresses placées sous surveillance : ${g.watch.map((a) => `<span class="mono">${w.get(a).addr}</span>`).join(', ')}.` : ''}` : ''}</div>
<h2>3. Conclusions</h2><table><tr><th>#</th><th>Question</th><th>Constatation</th></tr>${answers}</table>
<h2>4. Traçage des fonds</h2>${traceHtml}
<h2>5. Adresses d'intérêt</h2>${rows ? `<table><tr><th>Qualification</th><th>Adresse</th><th>Réseau</th><th>Attribution</th><th>Observations</th></tr>${rows}</table>` : '<div class="muted">Aucune adresse marquée.</div>'}
<h2>6. Graphe des flux</h2>${png ? `<img src="${png}">` : '<div class="muted">Graphe indisponible.</div>'}
<h2>7. Journal des opérations d'analyse</h2><ul>${journal}</ul>
</body></html>`
    // Nouvel onglet si possible, sinon téléchargement du fichier HTML
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      a.download = `rapport-${g.template!.id}-${g.seed}.html`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      useUi.getState().notify('Rapport enregistré dans vos téléchargements')
    }
    close()
  }
  return (
    <Modal open={open} onClose={close} title="Rapport d'analyse" icon="Printer" width="max-w-lg">
      <p className="text-[13px] text-ink-200">Le rapport reprend le contexte, la méthodologie, vos constatations, les adresses marquées avec vos notes, le graphe et le journal horodaté. Il s'ouvre dans un nouvel onglet, prêt à imprimer ou à enregistrer en PDF.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block"><span className="label">Rédacteur</span><input className="input mt-1" value={profile.name} onChange={(e) => profile.setIdentity(e.target.value, profile.unit)} /></label>
        <label className="block"><span className="label">Unité</span><input className="input mt-1" value={profile.unit} onChange={(e) => profile.setIdentity(profile.name, e.target.value)} /></label>
      </div>
      <button className="btn-primary mt-4 w-full" onClick={build}><Icon name="FileDown" size={15} /> Générer le rapport</button>
    </Modal>
  )
}

// ── Raccourcis clavier ───────────────────────────────────────────────────

const SHORTCUTS: [string, string][] = [
  ['Ctrl K', 'Rechercher une adresse, une transaction, une entité'],
  ['Double-clic', 'Déplier les sorties d\'une adresse / compléter une transaction'],
  ['Clic droit', 'Menu du nœud : entrées, sorties, cluster, marquage'],
  ['Maj + glisser', 'Sélection multiple (pour les objectifs à plusieurs adresses)'],
  ['O  /  I', 'Déplier les sorties (out) / entrées (in) de l\'adresse sélectionnée'],
  ['Ctrl Z', 'Annuler la dernière opération sur le graphe'],
  ['C', 'Corréler à partir de la transaction sélectionnée'],
  ['R', 'Tracer les fonds reçus par l\'adresse ou la transaction sélectionnée'],
  ['P', 'Chercher un chemin entre les deux adresses sélectionnées'],
  ['F', 'Ajuster la vue au graphe'],
  ['L', 'Réorganiser le graphe de gauche à droite'],
  ['T', 'Afficher / masquer la frise chronologique'],
  ['[  /  ]', 'Replier le dossier / le panneau d\'analyse'],
  ['Suppr', 'Retirer le ou les nœuds sélectionnés du graphe'],
  ['Échap', 'Fermer une fenêtre ou un menu'],
]

export function ShortcutsModal() {
  const open = useUi((s) => s.shortcutsOpen)
  return (
    <Modal open={open} onClose={() => useUi.getState().set({ shortcutsOpen: false })} title="Raccourcis clavier" icon="Keyboard" width="max-w-lg">
      <div className="divide-y divide-ink-700/60 overflow-hidden rounded-xl border border-ink-700/70">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k} className="flex items-center gap-3 px-3 py-2">
            <span className="kbd min-w-[92px] justify-center !py-0.5 !text-[11px]">{k}</span>
            <span className="text-[12.5px] text-ink-200">{d}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export { DIFFICULTY, CopyButton }
