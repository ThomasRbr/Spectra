// Inspecteur d'un groupe replié ou d'un agrégat de contreparties : membres,
// volumes, origine du regroupement et actions (déplier, renommer, dissoudre).
import { useMemo } from 'react'
import type { Core } from 'cytoscape'
import { fmtUsd } from '../../engine/chains'
import { attribution } from '../../engine/analysis'
import type { World } from '../../engine/world'
import { useGame } from '../../store/game'
import { useGraph } from '../../store/graph'
import { Icon, Stat } from '../common'
import { AddrLine } from './Inspector'
import { dissolveGroup, toggleGroupNode } from './graphActions'

const KIND_TEXT: Record<string, { label: string; help: string }> = {
  cluster: { label: 'Cluster (entrées communes)', help: 'Adresses dépensées ensemble dans une même transaction : selon l\'heuristique des entrées communes, un même portefeuille les contrôle.' },
  stake: { label: 'Clé de staking commune', help: 'Adresses Cardano partageant la même partie staking : un même portefeuille les a générées.' },
  entity: { label: 'Service attribué', help: 'Adresses attribuées au même service par la base de l\'outil.' },
  auto: { label: 'Service (regroupement automatique)', help: 'Regroupement automatique des adresses d\'un même service (option d\'affichage).' },
  manual: { label: 'Groupe défini par l\'enquêteur', help: 'Regroupement libre, sans valeur probante en soi : il sert la lisibilité du graphe.' },
}

export function GroupInspector({ w, gkey }: { w: World; gkey: string }) {
  const cy = (window as unknown as { __spectraCy?: () => Core | null }).__spectraCy?.()
  const el = cy?.getElementById(gkey)
  const members: string[] = useMemo(() => (el && !el.empty() ? (el.data('members') as string[]) ?? [] : []), [el])
  const groups = useGraph((s) => s.byView[s.viewId]?.groups ?? [])
  const isAgg = gkey.startsWith('n:')
  const grp = groups.find((g) => `g:${g.id}` === gkey)
  const kind = isAgg ? 'agg' : grp?.kind ?? (gkey.startsWith('g:auto:') ? 'auto' : 'manual')
  const totals = useMemo(() => {
    let inUsd = 0
    let outUsd = 0
    let txs = 0
    for (const m of members) {
      const s = w.summary(m)
      inUsd += s.inUsd
      outUsd += s.outUsd
      txs += s.txCount
    }
    return { inUsd, outUsd, txs }
  }, [w, members])
  if (!el || el.empty()) return <div className="p-4 text-dense text-ink-300">Ce groupe n'est plus affiché.</div>
  const pos = { ...el.position() }
  const label = String(el.data('label') ?? '').split('\n')[0]
  const pivot = isAgg ? gkey.split(':').slice(1, -1).join(':') : ''
  const entities = [...new Set(members.map((m) => attribution(w, m).entity?.name).filter(Boolean))]
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-700/60 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-double border-accent bg-accent/10">
            <Icon name={isAgg ? 'Ellipsis' : kind === 'cluster' ? 'Network' : kind === 'stake' ? 'KeyRound' : 'Boxes'} size={19} className="text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-white">{label}</div>
            <div className="mt-1 text-micro text-ink-300">{isAgg ? `Contreparties ${gkey.endsWith(':in') ? 'qui envoient à' : 'qui reçoivent de'} une même adresse` : KIND_TEXT[kind]?.label}</div>
          </div>
        </div>
        <div className="mt-2 text-micro leading-relaxed text-ink-400">{isAgg ? 'Adresses sans attribution ni marquage, reliées à une seule adresse du graphe : réunies pour la lisibilité. Une contrepartie qui devient intéressante se déplie et se marque.' : KIND_TEXT[kind]?.help}</div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button className="btn-outline !px-2 !py-1 text-xs" onClick={() => toggleGroupNode(gkey, members, pos)}><Icon name="Maximize2" size={13} /> Déplier</button>
          {!isAgg ? (
            <button className="btn-outline !px-2 !py-1 text-xs" onClick={() => {
              const name = prompt('Nom du groupe', label)
              if (!name) return
              if (grp) useGraph.getState().updateGroup(grp.id, { label: name.trim() })
            }} disabled={!grp}><Icon name="PenLine" size={13} /> Renommer</button>
          ) : (
            <button className="btn-outline !px-2 !py-1 text-xs" onClick={() => useGame.getState().select({ kind: 'address', id: pivot.slice(2) })} disabled={!pivot.startsWith('a:')}><Icon name="LocateFixed" size={13} /> Adresse pivot</button>
          )}
          {!isAgg && <button className="btn-outline col-span-2 !px-2 !py-1 text-xs" onClick={() => {
            dissolveGroup(gkey)
            useGame.getState().select(null)
          }}><Icon name="Ungroup" size={13} /> Dissoudre le groupe</button>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-3">
        <Stat label="Adresses" value={members.length} />
        <Stat label="Reçu" value={fmtUsd(totals.inUsd)} accent="#34d399" />
        <Stat label="Envoyé" value={fmtUsd(totals.outUsd)} accent="#fb7185" />
      </div>
      {entities.length > 0 && <div className="px-3 text-micro text-ink-400">Attribution : {entities.join(', ')}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pt-2">
        <div className="label mb-1.5">Membres</div>
        <div className="space-y-0.5 rounded-lg border border-ink-700/60 p-1">
          {members.map((m) => <AddrLine key={m} w={w} id={m} right={<span className="font-mono text-micro text-ink-400">{fmtUsd(w.summary(m).inUsd)}</span>} />)}
        </div>
      </div>
    </div>
  )
}
