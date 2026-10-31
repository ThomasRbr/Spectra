// Densité du graphe : ajoute de l'activité réaliste autour des services que
// traverse l'affaire (clients des mêmes plateformes, retraits, dépôts de
// montants proches aux mêmes heures). Rien n'est ajouté sur les adresses des
// auteurs ou des victimes : les réponses de la mission ne changent pas, mais
// les hot wallets, pools et adresses de dépôt deviennent plus difficiles à lire.
import { CHAINS, fromUsd, roundAsset, usd, type AssetId } from './chains'
import { attribution } from './analysis'
import type { EntityCategory } from './entities'
import type { Tx, World } from './world'
import type { ScenarioInstance } from '../scenarios/types'

export type NoiseLevel = 'normal' | 'dense' | 'extreme'

export const NOISE_LABEL: Record<NoiseLevel, { label: string; help: string }> = {
  normal: { label: 'Normal', help: 'L\'affaire telle qu\'écrite.' },
  dense: { label: 'Dense', help: 'Les plateformes traversées ont davantage de clients : retraits, dépôts et leurres de montant proche.' },
  extreme: { label: 'Extrême', help: 'Activité de fond massive autour des services et nombreux dépôts leurres aux mêmes heures : il faut filtrer, corréler et justifier.' },
}

const PASS = new Set<EntityCategory>(['individual', 'suspect', 'victim'])
const H = 3600

export function addNoise(inst: ScenarioInstance, level: NoiseLevel): void {
  if (level === 'normal') return
  const w = inst.world
  const r = w.rng
  const k = level === 'dense' ? 1 : 2.6
  const path = inst.truth.path.map((id) => w.txs.get(id)).filter((t): t is Tx => !!t)
  if (!path.length) return
  const times = path.map((t) => t.time)
  const t0 = Math.min(...times) - 2 * 86400
  const t1 = Math.max(...times) + 3 * 86400
  const when = () => Math.round(r.float(t0, t1))

  const touched = new Set<string>()
  for (const tx of path) {
    tx.inputs.forEach((x) => touched.add(x.address))
    tx.outputs.forEach((x) => touched.add(x.address))
    tx.transfers.forEach((x) => {
      touched.add(x.from)
      touched.add(x.to)
    })
  }
  const service = (id: string) => {
    const e = attribution(w, id).entity
    return e && !PASS.has(e.category) ? e : undefined
  }

  // 1. Activité de fond sur les portefeuilles de service et contrats publics traversés
  for (const id of touched) {
    const a = w.get(id)
    if (a.tags.includes('null') || a.tags.includes('deposit')) continue
    const busy = a.tags.includes('hot') || a.tags.includes('liquid') || (a.contract && ['pool', 'router', 'aggregator', 'lending', 'wrapper'].includes(a.contract.type))
    if (!busy || !service(id) && !a.contract) continue
    const native = CHAINS[a.chain].native
    const assets = assetsUsed(w, id)
    const n = Math.round(k * r.int(6, 14))
    for (let i = 0; i < n; i++) {
      const t = when()
      const cp = w.addr(a.chain)
      if (CHAINS[a.chain].model === 'utxo') {
        const v = roundAsset(native, fromUsd(native, r.float(60, 40000)))
        if (r.chance(0.5)) w.fund(id, v, t)
        else w.utxoTx({ time: t, from: [id], to: [{ address: cp, value: v }], change: id, tags: ['withdrawal'] })
      } else if (CHAINS[a.chain].model === 'account') {
        const asset = r.pick(assets.length ? assets : [native])
        const v = roundAsset(asset, fromUsd(asset, r.float(60, 40000)))
        if (r.chance(0.5)) w.transfer({ time: t, from: cp, to: id, value: v, asset })
        else w.transfer({ time: t, from: id, to: cp, value: v, asset, method: a.contract ? undefined : 'withdraw' })
      }
    }
  }

  // 2. Dépôts leurres : d'autres clients déposent des montants proches, aux mêmes heures, sur la même plateforme
  for (const tx of path) {
    const legs: { to: string; value: number; asset: AssetId }[] = tx.model === 'utxo'
      ? tx.outputs.map((o) => ({ to: o.address, value: o.value, asset: CHAINS[tx.chain].native }))
      : tx.transfers.map((t) => ({ to: t.to, value: t.value, asset: t.asset }))
    for (const leg of legs) {
      const dep = w.get(leg.to)
      if (!dep.tags.includes('deposit') || !dep.entityId) continue
      const hot = [...w.addresses.values()].find((x) => x.entityId === dep.entityId && x.chain === dep.chain && x.tags.includes('hot'))
      if (!hot) continue
      const decoys = Math.round(k * r.int(3, 6))
      for (let i = 0; i < decoys; i++) {
        const v = roundAsset(leg.asset, leg.value * r.float(0.85, 1.15))
        if (usd(leg.asset, v) < 1) continue
        const t = tx.time + r.int(-6 * H, 6 * H)
        const cust = w.addr(dep.chain)
        const newDep = w.addr(dep.chain, { entity: dep.entityId, label: dep.label, tags: ['deposit'], kind: dep.kind === 'contract' ? undefined : dep.kind })
        const sweepT = t + r.int(20 * 60, 8 * H)
        if (CHAINS[dep.chain].model === 'utxo') {
          w.fund(cust, v * r.float(1.05, 1.6), t - r.int(H, 5 * 86400))
          w.utxoTx({ time: t, from: [cust], to: [{ address: newDep, value: v }] })
          const fee = w.estimateFee(dep.chain, 1, 1)
          w.utxoTx({ time: sweepT, from: [newDep], to: [{ address: hot.id, value: w.unspentValue(newDep, sweepT) - fee }], fee, change: null, spendAll: true, tags: ['sweep'], method: 'consolidation' })
        } else {
          w.fundAccount(cust, v, leg.asset, t - r.int(H, 5 * 86400))
          w.transfer({ time: t, from: cust, to: newDep, value: v, asset: leg.asset, memo: tx.memo ? String(r.int(100000, 99999999)) : undefined })
          w.transfer({ time: sweepT, from: newDep, to: hot.id, value: v, asset: leg.asset, method: 'sweep', tags: ['sweep'] })
        }
      }
    }
  }
}

function assetsUsed(w: World, id: string): AssetId[] {
  const s = new Set<AssetId>()
  for (const tx of w.txsOf(id)) for (const t of tx.transfers) if (t.from === id || t.to === id) s.add(t.asset)
  return [...s].filter((a) => !['LP', 'aWETH', 'aUSDC'].includes(a))
}
