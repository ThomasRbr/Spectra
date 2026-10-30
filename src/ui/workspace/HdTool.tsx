// Outil « Dérivation HD » : à partir d'une clé publique étendue (xpub / ypub /
// zpub) saisie ou trouvée dans une pièce, recalcule les adresses de réception
// et de rendu du portefeuille, comme le ferait un logiciel de portefeuille.
import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { CHAINS, fmtAsset, fmtUsd, usd, type AssetId } from '../../engine/chains'
import { KIND_LABEL, shortAddr } from '../../engine/addressgen'
import { HD_SCHEMES, findHdWallet, scanHdWallet, type HdAddrKind, type HdScanRow } from '../../engine/hd'
import type { World } from '../../engine/world'
import { useGame } from '../../store/game'
import { aKey } from '../../lib/graph'
import { ChainBadge, Empty, Icon, Modal, fmtTime } from '../common'

interface HdToolState {
  open: boolean
  query: string
  set(p: Partial<Omit<HdToolState, 'set'>>): void
}

export const useHdTool = create<HdToolState>()((set) => ({ open: false, query: '', set: (p) => set(p) }))

/** Ouvre l'outil, éventuellement sur une clé étendue précise. */
export function openHdTool(query?: string) {
  useHdTool.getState().set({ open: true, ...(query !== undefined ? { query } : {}) })
}

const GAPS = [5, 10, 20, 30, 50, 100]

export function HdToolModal() {
  const st = useHdTool()
  const w = useGame((s) => s.inst?.world)
  const clock = useGame((s) => s.live?.now ?? 0)
  const [input, setInput] = useState(st.query)
  const [gap, setGap] = useState(20)
  const [showUnused, setShowUnused] = useState(false)
  useEffect(() => {
    if (st.open) setInput(st.query)
  }, [st.open, st.query])

  const scan = useMemo(() => (w && st.open && st.query ? scanHdWallet(w, st.query, { gap }) : undefined), [w, st.open, st.query, gap, clock])
  const notFound = !!st.query && !scan

  useEffect(() => {
    if (scan) useGame.getState().revealHd(scan.wallet.id, { receive: scan.receive.length, change: scan.change.length })
  }, [scan])

  if (!w) return null
  const close = () => st.set({ open: false })
  const run = () => st.set({ query: input.trim() })
  const usedRows = scan ? [...scan.receive, ...scan.change].filter((r) => r.used) : []

  const addAll = () => {
    if (!usedRows.length) return
    const g = useGame.getState()
    const first = usedRows[0].id
    g.addAddress(first)
    for (const r of usedRows.slice(1)) g.addAddress(r.id, aKey(first), 1)
    g.addLog(`Dérivation HD : ${usedRows.length} adresse(s) utilisée(s) ajoutée(s) au graphe`, 'tool')
  }

  const hw = scan?.wallet
  const evm = hw?.type === 'evm-seed'
  const sc = hw && !evm ? HD_SCHEMES[hw.kind as HdAddrKind] : undefined

  return (
    <Modal open={st.open} onClose={close} title="Dérivation HD (xpub / ypub / zpub)" icon="KeyRound" width="max-w-5xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[280px] flex-1">
            <span className="label mb-1 block">Clé publique étendue (ou code d'une seed de démonstration)</span>
            <input
              className="input font-mono text-[11.5px]"
              placeholder="zpub6…, ypub6…, xpub6…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              spellCheck={false}
            />
          </label>
          <label>
            <span className="label mb-1 block" title="Nombre d'adresses consécutives sans transaction après lequel le logiciel arrête de chercher">Gap limit</span>
            <select className="input !w-24" value={gap} onChange={(e) => setGap(Number(e.target.value))}>
              {GAPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <button className="btn-primary !py-2 text-[12.5px]" onClick={run} disabled={!input.trim()}>
            <Icon name="GitFork" size={14} /> Dériver
          </button>
        </div>

        <div className="rounded-xl border border-ink-700/60 bg-ink-850/50 p-3 text-[11.5px] leading-relaxed text-ink-300">
          <Icon name="Info" size={12} className="mr-1 inline text-accent" />
          Une clé publique étendue (BIP 32) permet de recalculer <span className="text-ink-100">toutes les adresses</span> d'un compte de portefeuille : adresses de réception (branche 0) et de rendu (branche 1), passées et futures. Elle ne donne <span className="text-ink-100">aucun accès aux clés privées</span> : impossible de dépenser ou de geler avec. Le préfixe indique le schéma : <span className="font-mono text-ink-100">xpub</span> (BIP 44 Legacy, ou BIP 86 Taproot), <span className="font-mono text-ink-100">ypub</span> (BIP 49, SegWit encapsulé « 3… »), <span className="font-mono text-ink-100">zpub</span> (BIP 84, SegWit natif « bc1q… »). Le logiciel s'arrête après un nombre d'adresses consécutives inutilisées (gap limit, 20 par défaut) : une adresse utilisée plus loin reste invisible tant qu'on n'augmente pas cette limite.
        </div>

        {!st.query && <Empty icon="KeyRound" title="Aucune clé à dériver" sub="Collez une xpub / ypub / zpub, ou cliquez sur une clé étendue surlignée dans une pièce du dossier." />}
        {notFound && <Empty icon="SearchX" title="Clé inconnue" sub="Cette clé ne correspond à aucun portefeuille de l'affaire. Vérifiez qu'elle a été recopiée en entier (environ 111 caractères)." />}

        {scan && hw && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Info label="Réseau" value={<ChainBadge chain={hw.chain} />} />
              <Info label="Schéma" value={<span className="text-[12px] text-white">{hw.scheme}</span>} sub={evm ? 'Comptes Ethereum dérivés d\'une seed' : `Adresses ${sc?.addrHint[hw.chain as 'btc' | 'ltc'] ?? ''} · ${KIND_LABEL[hw.kind]}`} />
              <Info label="Chemin" value={<span className="font-mono text-[12px] text-cyan-200">{hw.pathTemplate}</span>} sub={evm ? 'purpose 44 · coin 60 (ETH)' : `purpose ${hw.purpose} · coin ${hw.coin} (${CHAINS[hw.chain].short}) · compte ${hw.account}`} />
              <Info label="Adresses utilisées" value={<span className="text-[15px] font-semibold text-white">{usedRows.length}</span>} sub={`${scan.receive.length + scan.change.length} dérivées (gap ${gap})`} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary !py-1.5 text-[12px]" onClick={addAll} disabled={!usedRows.length}>
                <Icon name="CirclePlus" size={14} /> Ajouter toutes les adresses utilisées ({usedRows.length})
              </button>
              <label className="ml-auto flex items-center gap-1.5 text-[11.5px] text-ink-300">
                <input type="checkbox" checked={showUnused} onChange={(e) => setShowUnused(e.target.checked)} /> Afficher les adresses inutilisées
              </label>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <Branch w={w} title="Réception (branche 0)" rows={scan.receive} showUnused={showUnused} />
              {!evm && <Branch w={w} title="Rendu (branche 1)" rows={scan.change} showUnused={showUnused} />}
            </div>
            <div className="text-[10.5px] leading-relaxed text-ink-400">
              Le regroupement par clé étendue est une preuve d'appartenance bien plus forte que les heuristiques (entrées communes, rendu) : toutes ces adresses sont contrôlées par le même portefeuille. Une même graine peut toutefois contenir d'autres comptes (compte 1, 2…) ou d'autres schémas, invisibles depuis cette seule clé.
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

function Info({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-ink-700/60 bg-ink-850/50 p-2.5">
      <div className="label !text-[10px]">{label}</div>
      <div className="mt-1">{value}</div>
      {sub && <div className="mt-0.5 text-[10.5px] text-ink-400">{sub}</div>}
    </div>
  )
}

function Branch({ w, title, rows, showUnused }: { w: World; title: string; rows: HdScanRow[]; showUnused: boolean }) {
  const addrPos = useGame((s) => s.addrPos)
  const shown = showUnused ? rows : rows.filter((r) => r.used)
  return (
    <div className="overflow-hidden rounded-xl border border-ink-700/60">
      <div className="flex items-center justify-between bg-ink-850 px-3 py-2 text-[12px] font-semibold text-white">
        <span>{title}</span>
        <span className="font-normal text-ink-400">{rows.filter((r) => r.used).length} utilisée(s) / {rows.length}</span>
      </div>
      <div className="max-h-[40vh] overflow-auto">
        {shown.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11.5px] text-ink-400">Aucune adresse utilisée sur cette branche.</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-ink-900 text-left text-ink-400">
              <tr>
                <th className="px-2 py-1.5 font-medium">Chemin</th>
                <th className="px-2 py-1.5 font-medium">Adresse</th>
                <th className="px-2 py-1.5 text-right font-medium">Tx</th>
                <th className="px-2 py-1.5 text-right font-medium">Solde</th>
                <th className="px-2 py-1.5 font-medium">Activité</th>
                <th className="px-1 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => <Row key={r.id} w={w} r={r} onGraph={!!addrPos[r.id]} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Row({ w, r, onGraph }: { w: World; r: HdScanRow; onGraph: boolean }) {
  const sum = useMemo(() => w.summary(r.id), [w, r.id])
  const bal = Object.entries(sum.balance) as [AssetId, number][]
  const balUsd = bal.reduce((s, [a, v]) => s + usd(a, v), 0)
  const a = w.get(r.id)
  return (
    <tr className={`border-t border-ink-700/50 ${r.used ? '' : 'opacity-45'}`}>
      <td className="whitespace-nowrap px-2 py-1 font-mono text-cyan-200">…/{r.branch}/{r.index}</td>
      <td className="px-2 py-1 font-mono text-ink-100" title={a.addr}>{shortAddr(a.addr, 8)}</td>
      <td className="px-2 py-1 text-right font-mono text-ink-200">{sum.txCount}</td>
      <td className="whitespace-nowrap px-2 py-1 text-right font-mono text-ink-200" title={balUsd ? fmtUsd(balUsd) : undefined}>{bal.length ? bal.map(([as, v]) => fmtAsset(v, as)).join(' · ') : '0'}</td>
      <td className="whitespace-nowrap px-2 py-1 text-[10.5px] text-ink-400">{sum.first ? `${fmtTime(sum.first)}${sum.last && sum.last !== sum.first ? ` → ${fmtTime(sum.last)}` : ''}` : '—'}</td>
      <td className="px-1 py-1">
        <button
          title={onGraph ? 'Sur le graphe' : 'Ajouter au graphe'}
          className={onGraph ? 'text-accent' : 'text-ink-400 hover:text-accent'}
          onClick={() => {
            const g = useGame.getState()
            g.addAddress(r.id)
            g.select({ kind: 'address', id: r.id })
          }}
        >
          <Icon name={onGraph ? 'CircleDot' : 'CirclePlus'} size={13} />
        </button>
      </td>
    </tr>
  )
}

/** La clé est-elle celle d'un portefeuille HD de l'affaire ? (détection dans les pièces) */
export function isKnownHdKey(w: World, s: string): boolean {
  return !!findHdWallet(w, s)
}
