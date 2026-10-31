import { useMemo, useState } from 'react'
import { CHAINS, fmtAsset, fmtUsd } from '../../engine/chains'
import { demixCoinjoin, demixPool, fmtDelay } from '../../engine/demix'
import type { World } from '../../engine/world'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { Empty, Icon, Modal, fmtTime } from '../common'
import { AddrLine } from './Inspector'
import { Card } from './Tracer'

export function openDemix(address: string) {
  useUi.getState().set({ demix: { open: true, address } })
}

// ── CoinJoin : carte de l'inspecteur de transaction ──────────────────────

export function CoinjoinDemixCard({ w, txId }: { w: World; txId: string }) {
  const r = useMemo(() => demixCoinjoin(w, txId), [w, txId])
  const [all, setAll] = useState(false)
  if (!r) return null
  const native = CHAINS[w.tx(txId).chain].native
  const linked = r.postMix.filter((p) => p.participant)
  const merges = r.postMix.filter((p) => !p.participant && !p.remix && p.mixedInputs.length > 1)
  const withChange = r.participants.filter((p) => p.change || p.premixChange.length)
  const reveal = (ids: string[], what: string) => useGame.getState().revealSet(ids, what, `${what} affichées dans le graphe`)
  return (
    <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/[0.04] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-dense font-semibold text-rose-200"><Icon name="ScanSearch" size={14} /> Analyse post-mix</div>
      <div className="mb-2 grid grid-cols-3 gap-1.5 text-center text-micro">
        <div className="rounded-lg bg-ink-900/60 p-1.5"><div className="font-mono text-dense text-white">{r.equalCount}</div>sorties mixées</div>
        <div className="rounded-lg bg-ink-900/60 p-1.5"><div className="font-mono text-dense text-white">{r.postMix.length - r.remixed}</div>dépensées hors mix</div>
        <div className="rounded-lg bg-ink-900/60 p-1.5"><div className="font-mono text-dense text-white">{r.remixed}</div>remixée(s)</div>
      </div>

      {linked.length > 0 ? (
        <div className="space-y-1.5">
          {linked.map((p) => (
            <div key={p.txId} className="rounded-lg border border-rose-400/40 bg-ink-900/60 p-2 text-meta">
              <div className="flex items-center gap-1.5 font-semibold text-rose-200"><Icon name="Link2" size={12} /> Regroupement rattaché · {fmtTime(p.time)}</div>
              <div className="mt-1 text-ink-200">{p.mixedInputs.length} sortie(s) mixée(s) dépensée(s) avec une adresse liée à un participant (rendu toxique ou adresse d'entrée) : par entrées communes, elles lui reviennent.</div>
              <div className="mt-1.5 label !text-micro">Participant</div>
              {p.participant && <AddrLine w={w} id={p.participant} compact />}
              <button className="btn-outline mt-1.5 w-full !py-1 text-micro" onClick={() => {
                useGame.getState().revealTx(p.txId, true)
                useGame.getState().select({ kind: 'tx', id: p.txId })
              }}><Icon name="CirclePlus" size={12} /> Ouvrir la dépense post-mix</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-meta text-ink-300">Aucune dépense post-mix ne réunit une sortie mixée et une adresse liée à un participant. Surveillez les sorties encore non dépensées ({r.unspent}).</div>
      )}

      {r.postMix.filter((p) => p.remix).map((p) => (
        <button key={p.txId} className="btn-outline mt-2 w-full !py-1 text-micro" onClick={() => {
          useGame.getState().revealTx(p.txId, true)
          useGame.getState().select({ kind: 'tx', id: p.txId })
        }}><Icon name="Shuffle" size={12} /> Suivre le remix ({p.mixedInputs.length} sortie(s) · {fmtTime(p.time)})</button>
      ))}

      {merges.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.05] p-2 text-micro text-amber-100">
          <Icon name="TriangleAlert" size={12} className="mr-1 inline" />
          {merges.length} regroupement(s) de sorties mixées sans lien avec un participant : ils prouvent seulement qu'un même acteur détient ces sorties, pas lequel. Faux positif classique.
        </div>
      )}

      {withChange.length > 0 && (
        <div className="mt-2">
          <button className="flex w-full items-center justify-between text-micro text-ink-300 hover:text-white" onClick={() => setAll((v) => !v)}>
            <span>Rendus rattachés aux entrées ({withChange.length})</span>
            <Icon name={all ? 'ChevronUp' : 'ChevronDown'} size={12} />
          </button>
          {all && (
            <div className="mt-1 space-y-1">
              {withChange.map((p) => (
                <div key={p.address} className="rounded-lg border border-ink-700/60 p-1">
                  <AddrLine w={w} id={p.address} compact right={<span className="font-mono text-micro text-ink-300">{fmtAsset(p.value, native)}</span>} />
                  {p.change && <div className="px-2 text-micro text-ink-400">↳ rendu dans le CoinJoin (apport − {r.denom} {native} − frais)</div>}
                  {p.change && <AddrLine w={w} id={p.change} compact />}
                  {p.premixChange.length > 0 && <div className="px-2 text-micro text-ink-400">↳ rendu toxique de la Tx0</div>}
                  {p.premixChange.slice(0, 2).map((a) => <AddrLine key={a} w={w} id={a} compact />)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {linked.length > 0 && (
        <button className="btn-ghost mt-2 w-full !py-1 text-micro" onClick={() => reveal(linked.map((p) => p.txId), 'Dépenses post-mix')}><Icon name="Waypoints" size={12} /> Afficher les regroupements rattachés</button>
      )}
    </div>
  )
}

// ── Pool de confidentialité : fenêtre de démixage ────────────────────────

export function DemixModal() {
  const st = useUi((s) => s.demix)
  const w = useGame((s) => s.inst?.world)
  const clock = useGame((s) => s.live?.now)
  const [days, setDays] = useState(30)
  const r = useMemo(() => (w && st.address ? demixPool(w, st.address, days) : null), [w, st.address, days, clock])
  if (!w) return null
  const close = () => useUi.getState().set({ demix: { open: false } })
  const asset = r?.deposits[0]?.asset ?? 'ETH'
  return (
    <Modal open={st.open} onClose={close} title="Démixage d'un pool de confidentialité" icon="ScanSearch" width="max-w-4xl">
      <div className="mb-3 rounded-xl border border-ink-700/60 bg-ink-850/50 p-3 text-meta leading-relaxed text-ink-300">
        Un pool à dénominations fixes (Tornado Cash) rompt le lien entre dépôt et retrait. Ce sont les <span className="text-white">erreurs de l'utilisateur</span> qui le rétablissent : retraits regroupés sur une même adresse, collecteur qui reçoit aussi le reliquat non mixé, réutilisation d'adresses. Un retrait antérieur au premier dépôt, ou plus de retraits que de dépôts à une dénomination, écarte un groupe.
      </div>
      {!r ? (
        <Empty icon="ScanSearch" title="Aucun dépôt dans un pool" sub="Cette adresse n'a déposé dans aucun pool de confidentialité visible." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Card label="Dépôts" value={String(r.deposits.length)} sub={`${fmtTime(r.deposits[0].time)} → ${fmtTime(r.deposits[r.deposits.length - 1].time)}`} />
            <Card label="Montant mixé" value={fmtUsd(r.depositedUsd)} sub={r.anonymity.map((a) => `${a.mine} × ${a.denom} ${a.asset}`).join(' · ')} accent="#fb7185" />
            <Card label="Ensemble d'anonymat" value={String(r.anonymity.reduce((s, a) => s + a.others, 0))} sub="dépôts de tiers aux mêmes dénominations sur la période" />
            <Card label="Groupes rattachés" value={String(r.groups.filter((g) => g.linked && !g.excluded.length).length)} sub={`sur ${r.groups.length} groupe(s) examiné(s)`} accent="#7ea6ff" />
          </div>
          <label className="flex items-center gap-3 text-meta text-ink-300">
            Fenêtre d'examen après le dernier dépôt : <span className="font-mono text-white">{days} j</span>
            <input type="range" min={3} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} className="flex-1 accent-accent" />
          </label>

          {r.groups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-ink-600 p-3 text-center text-meta text-ink-400">Aucun retrait ne présente d'erreur d'hygiène exploitable dans cette fenêtre.</div>
          ) : (
            <div className="space-y-2">
              {r.groups.map((g, i) => (
                <div key={(g.collector ?? g.withdrawals[0].txId) + i} className={`rounded-xl border p-3 ${g.excluded.length ? 'border-ink-700/60 opacity-70' : g.linked ? 'border-accent/50 bg-accent/[0.04]' : 'border-ink-700/60'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-dense font-semibold text-white">{g.collector ? `${g.withdrawals.length} retrait(s) regroupés` : 'Retrait isolé'}</span>
                    <span className="font-mono text-micro text-ink-300">{fmtAsset(g.withdrawals.reduce((s, x) => s + x.denom, 0), asset)} · {fmtUsd(g.usd)}</span>
                    <span className={`ml-auto chip ${g.excluded.length ? 'bg-ink-700 text-ink-300' : g.linked ? 'bg-accent/15 text-accent' : 'bg-amber-400/15 text-amber-200'}`}>{g.excluded.length ? 'écarté' : g.linked ? 'rattaché au déposant' : 'à corroborer'} · {Math.round(g.score * 100)}</span>
                  </div>
                  {g.collector && <div className="mt-1.5"><AddrLine w={w} id={g.collector} /></div>}
                  <ul className="mt-1.5 space-y-0.5 text-micro">
                    {g.reasons.map((x, k) => <li key={k} className="flex gap-1.5 text-ink-200"><Icon name="Check" size={11} className="mt-0.5 shrink-0 text-accent" /> {x}</li>)}
                    {g.excluded.map((x, k) => <li key={`x${k}`} className="flex gap-1.5 text-rose-200"><Icon name="X" size={11} className="mt-0.5 shrink-0" /> {x}</li>)}
                  </ul>
                  <div className="mt-1.5 flex flex-wrap gap-1 text-micro text-ink-400">
                    {g.withdrawals.map((x) => <span key={x.txId} className="rounded bg-ink-900/70 px-1.5 py-0.5 font-mono">{x.denom} {asset} · {x.time >= r.deposits[0].time ? `+${fmtDelay(x.time - r.deposits[0].time)}` : `${fmtDelay(r.deposits[0].time - x.time)} avant le 1er dépôt`}{x.viaRelayer ? '' : ' · sans relayer'}</span>)}
                  </div>
                  <button className="btn-ghost mt-1.5 !px-2 !py-1 text-micro" onClick={() => {
                    useGame.getState().revealSet(g.withdrawals.map((x) => x.txId), 'retraits du pool', `${g.withdrawals.length} retrait(s) du pool affichés`)
                    close()
                  }}><Icon name="Waypoints" size={12} /> Afficher dans le graphe</button>
                </div>
              ))}
            </div>
          )}
          <div className="text-micro leading-relaxed text-ink-400">Présomption, pas preuve : à corroborer par le comportement ultérieur du collecteur et par réquisition auprès du service où il dépose.</div>
        </div>
      )}
    </Modal>
  )
}
