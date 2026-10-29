import { useMemo, useState } from 'react'
import { CHAINS, fmtAsset, fmtUsd } from '../../engine/chains'
import { KIND_LABEL } from '../../engine/addressgen'
import { fingerprintDiff, txFingerprint, type Fingerprint } from '../../engine/analysis'
import { PEEL_END_LABEL, depositAnalysis, followPeelChain, matchInstantSwap } from '../../engine/heuristics'
import type { Tx, World } from '../../engine/world'
import { useGame } from '../../store/game'
import { useUi } from '../../store/ui'
import { ChainBadge, Empty, EntityChip, Icon, Modal, fmtTime } from '../common'
import { AddrLine } from './Inspector'
import { Card, openTracer } from './Tracer'

const ORDER_LABEL: Record<Fingerprint['order'], string> = {
  bip69: 'triées (BIP 69)',
  random: 'ordre aléatoire',
  unknown: 'indécidable',
}

const fmtH = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(1).replace('.', ',')} h` : `${Math.round(h / 24)} j`)

// ── Empreinte de portefeuille (transaction UTXO) ─────────────────────────

export function FingerprintCard({ w, tx }: { w: World; tx: Tx }) {
  const fp = useMemo(() => txFingerprint(w, tx), [w, tx])
  // Comparaison avec la transaction qui a financé la première entrée
  const parent = useMemo(() => {
    const prev = tx.inputs.find((i) => i.prev)?.prev
    const p = prev && w.txs.get(prev.tx)
    return p ? txFingerprint(w, p) : null
  }, [w, tx])
  if (!fp) return null
  const rows: [string, string, string?][] = [
    ['Version', String(fp.version)],
    ['nLockTime', fp.locktime ? `${fp.locktime.toLocaleString('fr-FR')} (hauteur de bloc)` : '0', fp.locktime ? 'Protection « anti-fee-sniping »' : undefined],
    ['RBF', fp.rbf ? 'signalé' : 'non signalé'],
    ['Sorties', ORDER_LABEL[fp.order]],
    ['Frais', `${fp.feeRate} sat/vB`],
    ['Entrées', fp.inputKinds.map((k) => KIND_LABEL[k]).join(', ')],
  ]
  return (
    <div className="mt-3 rounded-xl border border-ink-700/60 bg-ink-850/50 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-white"><Icon name="Fingerprint" size={14} className="text-violet-glow" /> Empreinte du portefeuille</div>
      <dl className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-1 text-[11.5px]">
        {rows.map(([k, v, hint]) => (
          <div key={k} className="contents">
            <dt className="text-ink-400">{k}</dt>
            <dd className="font-mono text-ink-100" title={hint}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 border-t border-ink-700/60 pt-2 text-[11px] leading-relaxed text-ink-300">
        {fp.families.length === 0
          ? 'Combinaison atypique : aucune famille de logiciel courante ne produit ces champs.'
          : fp.families.length === 1
            ? <>Compatible avec : <span className="text-ink-100">{fp.families[0].label}</span>.</>
            : <>Compatible avec {fp.families.length} familles : {fp.families.map((f) => f.label).join(' ; ')}.</>}
        {parent && (
          <div className="mt-1">
            {fingerprintDiff(fp, parent).length === 0
              ? 'Même empreinte que la transaction qui a financé l\'entrée : cohérent avec un seul portefeuille.'
              : `Empreinte différente de la transaction qui a financé l'entrée (${fingerprintDiff(fp, parent).join(', ')}) : changement de main ou de logiciel.`}
          </div>
        )}
      </div>
    </div>
  )
}

/** Empreintes des transactions où l'adresse dépense (portefeuille qui la contrôle). */
export function WalletUsage({ w, id }: { w: World; id: string }) {
  const groups = useMemo(() => {
    const m = new Map<string, { fp: Fingerprint; n: number }>()
    for (const tx of w.txsOf(id)) {
      if (!tx.inputs.some((i) => i.address === id)) continue
      const fp = txFingerprint(w, tx)
      if (!fp) continue
      const k = `${fp.version}|${fp.locktimeKind}|${fp.rbf}`
      const g = m.get(k) ?? { fp, n: 0 }
      g.n++
      if (g.fp.order === 'unknown') g.fp = fp
      m.set(k, g)
    }
    return [...m.values()]
  }, [w, id])
  if (!groups.length) return null
  return (
    <div className="mt-3 rounded-lg border border-ink-700/60 bg-ink-850/40 p-2.5">
      <div className="label mb-1.5 flex items-center gap-1.5"><Icon name="Fingerprint" size={12} /> Empreinte des dépenses</div>
      {groups.map((g, i) => (
        <div key={i} className="text-[11.5px] text-ink-200">
          <span className="font-mono text-ink-100">v{g.fp.version} · nLockTime {g.fp.locktimeKind === 'height' ? 'hauteur' : '0'} · RBF {g.fp.rbf ? 'oui' : 'non'}</span>
          <span className="text-ink-400"> · {g.n} tx</span>
          <div className="text-[10.5px] text-ink-400">{g.fp.families.map((f) => f.label).join(' ; ') || 'Combinaison atypique'}</div>
        </div>
      ))}
      {groups.length > 1 && <div className="mt-1 text-[10.5px] text-amber-300">Plusieurs empreintes : l'adresse a été dépensée par des logiciels différents (clé partagée, importée ou cédée).</div>}
    </div>
  )
}

// ── Adresse de dépôt (modèles à comptes) ─────────────────────────────────

export function DepositPanel({ w, id }: { w: World; id: string }) {
  const v = useMemo(() => depositAnalysis(w, id), [w, id])
  const [limit, setLimit] = useState(8)
  const reveal = (txIds: string[], what: string) => useGame.getState().revealSet(txIds, what, `${what} affichés dans le graphe`)
  return (
    <div className="space-y-3">
      {v.role === 'none' ? (
        <Empty icon="Network" title="Pas de clustering par entrées communes" sub="Sur le modèle à comptes, chaque adresse est un compte. Aucun comportement d'adresse de dépôt détecté. Autres pistes : financeur du gaz (onglet Financement), interactions répétées, horaires." />
      ) : (
        <div className="rounded-xl border p-3" style={{ borderColor: '#22d3ee40', background: '#22d3ee0a' }}>
          <div className="flex items-center gap-2">
            <Icon name={v.role === 'deposit' ? 'Inbox' : 'Combine'} size={16} className="text-accent" />
            <div className="text-[13px] font-semibold text-white">
              {v.role === 'deposit'
                ? v.targetEntity ? `Adresse de dépôt probable de ${v.targetEntity.name}` : 'Adresse de dépôt ou de collecte probable'
                : v.targetEntity ? `Portefeuille collecteur de ${v.targetEntity.name}` : 'Portefeuille collecteur non attribué'}
            </div>
            <span className="ml-auto font-mono text-[11px] text-ink-300">{Math.round(v.score * 100)} / 100</span>
          </div>
          <ul className="mt-2 space-y-0.5">
            {v.reasons.map((r, i) => <li key={i} className="flex gap-1.5 text-[11.5px] text-ink-200"><Icon name="Check" size={12} className="mt-0.5 shrink-0 text-accent" /> {r}</li>)}
          </ul>
          {v.role === 'deposit' && v.target && (
            <>
              <div className="label mb-1 mt-3">Collecteur</div>
              <AddrLine w={w} id={v.target} />
              <button className="btn-outline mt-2 w-full !py-1 text-xs" onClick={() => reveal(v.sweeps, 'Reversements')}><Icon name="Waypoints" size={13} /> Afficher les reversements ({v.sweeps.length})</button>
            </>
          )}
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
            Une plateforme attribue à chaque client une adresse de dépôt unique, vidée régulièrement vers son portefeuille chaud. Si le collecteur est attribué, une réquisition sur l'adresse de dépôt permet d'identifier le titulaire du compte.
          </p>
        </div>
      )}
      {v.siblings.length > 0 && (
        <div>
          <div className="label mb-1.5">{v.role === 'deposit' ? 'Autres adresses de dépôt du même collecteur' : 'Adresses qui lui reversent tout'} ({v.siblings.length})</div>
          <div className="space-y-0.5">
            {v.siblings.slice(0, limit).map((s) => <AddrLine key={s} w={w} id={s} compact />)}
          </div>
          {v.siblings.length > limit && <button className="btn-ghost mt-1 w-full text-xs" onClick={() => setLimit((l) => l + 20)}>Afficher plus</button>}
        </div>
      )}
    </div>
  )
}

// ── Échangeur instantané : sorties probables ─────────────────────────────

export function SwapMatchPanel({ w, txId, address, compact }: { w: World; txId: string; address: string; compact?: boolean }) {
  const m = useMemo(() => matchInstantSwap(w, txId, address), [w, txId, address])
  const link = (c: (typeof m.candidates)[number]) => {
    const g = useGame.getState()
    g.revealTx(c.txId, true)
    g.addAddress(address)
    g.addLink({ source: address, target: c.to, kind: 'correlation', label: `échangeur · ${Math.round(c.prob * 100)} %`, txId: c.txId })
    g.select({ kind: 'address', id: c.to })
  }
  return (
    <div className={compact ? '' : 'mt-3 rounded-xl border border-orange-400/30 bg-orange-400/5 p-3'}>
      {!compact && (
        <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-orange-200">
          <Icon name="Repeat" size={13} /> Échangeur instantané{m.entity ? ` : ${m.entity.name}` : ''}
        </div>
      )}
      {!compact && (
        <div className="mb-2 text-[11px] leading-relaxed text-ink-300">
          Le service paie le client depuis son propre portefeuille, souvent sur une autre chaîne : aucun lien on-chain. Les candidats sont classés sur le montant ({fmtUsd(m.depositUsd)} déposés, frais de 0,2 à 3 %) et le délai.
        </div>
      )}
      {m.candidates.length === 0 ? (
        <div className="text-[11.5px] text-ink-400">{m.note}</div>
      ) : (
        <div className="space-y-1">
          {m.candidates.map((c) => (
            <div key={c.txId + c.to} className="rounded-lg border border-ink-700/60 bg-ink-900/50 p-1.5">
              <div className="flex items-center gap-2 px-1.5 text-[11px]">
                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-orange-300" style={{ width: `${c.prob * 100}%` }} /></div>
                <span className="w-9 font-mono text-orange-200">{Math.round(c.prob * 100)} %</span>
                <ChainBadge chain={c.chain} compact />
                <span className="font-mono text-ink-100">{fmtAsset(c.value, c.asset)}</span>
                <span className="text-ink-400">+{c.dtMin} min</span>
                <span className="ml-auto flex gap-1">
                  <button className="btn-ghost !px-1.5 !py-0.5 text-[11px]" title="Ajouter au graphe avec un lien de corrélation" onClick={() => link(c)}><Icon name="Link2" size={12} /> Lier</button>
                  <button className="btn-ghost !px-1.5 !py-0.5 text-[11px]" title="Poursuivre le traçage depuis ce paiement" onClick={() => openTracer({ address: c.to, txId: c.txId, asset: CHAINS[c.chain].model === 'utxo' ? undefined : c.asset, from: CHAINS[c.chain].model === 'utxo' ? undefined : c.from })}><Icon name="Route" size={12} /></button>
                </span>
              </div>
              <AddrLine w={w} id={c.to} compact />
              <div className="px-2 text-[10.5px] text-ink-400">{c.reasons.join(' · ')}</div>
            </div>
          ))}
          <div className="px-1 text-[10.5px] text-ink-400">Rapprochement probabiliste : à confirmer par réquisition auprès du service (identifiant de commande, adresse de paiement).</div>
        </div>
      )}
    </div>
  )
}

// ── Peel chain ───────────────────────────────────────────────────────────

export function openPeel(address: string) {
  const w = useGame.getState().inst?.world
  if (!w) return
  if (CHAINS[w.get(address).chain].model !== 'utxo') {
    useUi.getState().notify('Le détecteur de peel chain s\'applique aux chaînes UTXO (Bitcoin, Litecoin).')
    return
  }
  useUi.getState().set({ peel: { open: true, address } })
}

export function PeelModal() {
  const st = useUi((s) => s.peel)
  const w = useGame((s) => s.inst?.world)
  const res = useMemo(() => (w && st.address ? followPeelChain(w, st.address) : null), [w, st.address])
  if (!w) return null
  const close = () => useUi.getState().set({ peel: { open: false } })
  const native = st.address ? CHAINS[w.get(st.address).chain].native : 'BTC'
  return (
    <Modal open={st.open} onClose={close} title="Détecteur de peel chain" icon="ListTree" width="max-w-4xl">
      <div className="mb-3 rounded-xl border border-ink-700/60 bg-ink-850/50 p-3 text-[12px] leading-relaxed text-ink-300">
        Dans une peel chain, chaque transaction détache une petite somme (la « pelure », souvent vers un service) et renvoie le reste vers une adresse neuve du même portefeuille. L'outil suit la plus grosse sortie à chaque saut, tant que le motif se répète.
      </div>
      {!res || res.steps.length === 0 ? (
        <Empty icon="ListTree" title="Pas de peel chain depuis cette adresse" sub={res ? PEEL_END_LABEL[res.end.reason] : undefined} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Card label="Sauts" value={String(res.steps.length)} sub={res.medianIntervalH !== undefined ? `intervalle médian ${fmtH(res.medianIntervalH)}` : undefined} />
            <Card label="Montant détaché" value={fmtUsd(res.peeledUsd)} sub={`${res.steps.reduce((s, x) => s + x.peels.length, 0)} pelure(s)`} accent="#22d3ee" />
            <Card label="Vers des services" value={fmtUsd(res.byEntity.reduce((s, e) => s + e.usd, 0))} sub={`${res.byEntity.length} service(s) · ${res.unattributedPeels} pelure(s) non attribuée(s)`} accent="#a78bfa" />
            <Card label="Reste en bout de chaîne" value={fmtAsset(res.end.value, native)} sub={res.end.entity ? `chez ${res.end.entity.name}` : res.end.reason === 'unspent' ? 'non dépensé : piste de gel' : undefined} accent="#facc15" />
          </div>

          {res.byEntity.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {res.byEntity.map((e) => (
                <span key={e.entity.id} className="flex items-center gap-1.5 rounded-lg border border-ink-700/60 px-2 py-1 text-[11.5px]">
                  <EntityChip entity={e.entity} /> <span className="font-mono text-ink-100">{fmtUsd(e.usd)}</span> <span className="text-ink-400">({e.count} pelure{e.count > 1 ? 's' : ''})</span>
                </span>
              ))}
            </div>
          )}

          <div className="max-h-[46vh] overflow-auto rounded-xl border border-ink-700/60">
            <table className="w-full text-[11.5px]">
              <thead className="sticky top-0 bg-ink-850 text-left text-ink-400">
                <tr><th className="px-2.5 py-2 font-medium">#</th><th className="px-2 py-2 font-medium">Date</th><th className="px-2 py-2 font-medium">Pelure</th><th className="px-2 py-2 font-medium">Destination</th><th className="px-2 py-2 font-medium">Reste</th><th className="px-2 py-2 font-medium" title="Probabilité que la sortie suivie soit le rendu">Rendu</th></tr>
              </thead>
              <tbody>
                {res.steps.map((s, i) => (
                  <tr key={s.txId} className="cursor-pointer border-t border-ink-700/50 align-top hover:bg-ink-800/60" onClick={() => useGame.getState().select({ kind: 'tx', id: s.txId })}>
                    <td className="px-2.5 py-1.5 font-mono text-ink-400">{i + 1}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-ink-200">{fmtTime(s.time)}{s.dtH !== undefined && <div className="text-[10.5px] text-ink-400">+{fmtH(s.dtH)}</div>}</td>
                    <td className="px-2 py-1.5 font-mono text-ink-100">{s.peels.length ? s.peels.map((p) => <div key={p.address}>{fmtAsset(p.value, native)}</div>) : <span className="text-ink-400">—</span>}</td>
                    <td className="max-w-[260px] px-2 py-1">{s.peels.map((p) => <AddrLine key={p.address} w={w} id={p.address} compact />)}</td>
                    <td className="px-2 py-1.5 font-mono text-ink-200">{fmtAsset(s.remaining, native)}</td>
                    <td className={`px-2 py-1.5 font-mono ${s.changeProb >= 0.6 ? 'text-ink-200' : 'text-amber-300'}`} title={s.changeProb < 0.6 ? 'Rendu incertain : vérifier ce saut' : undefined}>{Math.round(s.changeProb * 100)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-ink-700/60 bg-ink-850/40 p-2.5 text-[11.5px] text-ink-300">
            <Icon name="Flag" size={13} className="mt-0.5 shrink-0" />
            <div>
              {PEEL_END_LABEL[res.end.reason]}
              <div className="mt-1"><AddrLine w={w} id={res.end.address} compact /></div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => {
              useGame.getState().revealSet(res.txIds, 'peel chain', `Peel chain affichée : ${res.steps.length} sauts, ${fmtUsd(res.peeledUsd)} détachés`)
              close()
            }}><Icon name="Waypoints" size={14} /> Afficher la chaîne dans le graphe ({res.txIds.length} tx)</button>
            <button className="btn-ghost" onClick={() => {
              close()
              openTracer({ address: res.start })
            }}><Icon name="Route" size={14} /> Tracer depuis le départ</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
