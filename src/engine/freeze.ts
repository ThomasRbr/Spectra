// Demandes de gel en temps réel : un émetteur de stablecoin bloque les jetons
// d'une adresse, un prestataire bloque le compte client derrière une adresse
// de dépôt. Le gel prend effet après un délai de traitement ; il ne bloque que
// ce qui est encore là à ce moment-là.
import { CHAINS, usd, type AssetId } from './chains'
import { attribution } from './analysis'
import { depositAnalysis } from './heuristics'
import type { World } from './world'

export type FreezeVia = 'issuer' | 'service'

export interface FreezeOption {
  via: FreezeVia
  authority: string
  /** Délai de traitement, en heures de l'horloge simulée. */
  delayH: number
  assets: AssetId[]
}

export interface FreezeRequest {
  id: string
  address: string
  via: FreezeVia
  authority: string
  assets: AssetId[]
  requestedAt: number
  effectiveAt: number
  status: 'pending' | 'effective' | 'late'
  frozen: Partial<Record<AssetId, number>>
  frozenUsd: number
}

const ISSUER: Partial<Record<AssetId, string>> = { USDT: 'Tether', USDC: 'Circle' }

function delay(id: string, min: number, max: number): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0
  return min + ((h % 1000) / 1000) * (max - min)
}

/** Solde d'une adresse à l'instant `t` (d'après les transactions visibles). */
export function balanceAt(w: World, id: string, t: number): Partial<Record<AssetId, number>> {
  const b: Partial<Record<AssetId, number>> = {}
  for (const tx of w.txsOf(id)) {
    if (tx.time > t) break
    for (const f of w.flowIn(tx, id)) b[f.asset] = (b[f.asset] ?? 0) + f.value
    for (const f of w.flowOut(tx, id)) b[f.asset] = (b[f.asset] ?? 0) - f.value
  }
  for (const k of Object.keys(b) as AssetId[]) if ((b[k] ?? 0) < 1e-9) delete b[k]
  return b
}

/** Montant déposé par le client via une adresse de dépôt, jusqu'à `t`. */
function depositedVia(w: World, id: string, t: number): Partial<Record<AssetId, number>> {
  const out: Partial<Record<AssetId, number>> = {}
  const own = attribution(w, id).entity?.id ?? w.get(id).entityId
  for (const tx of w.txsOf(id)) {
    if (tx.time > t) break
    if (tx.model === 'utxo') {
      if (tx.inputs.some((i) => w.get(i.address).entityId === own)) continue
      for (const f of w.flowIn(tx, id)) out[f.asset] = (out[f.asset] ?? 0) + f.value
    } else {
      for (const x of tx.transfers) if (x.to === id && w.get(x.from).entityId !== own) out[x.asset] = (out[x.asset] ?? 0) + x.value
    }
  }
  return out
}

/** Qui peut geler cette adresse, et comment ; ou pourquoi personne. */
export function freezeOption(w: World, id: string): FreezeOption | { reason: string } {
  const a = w.get(id)
  const e = attribution(w, id).entity
  if (e?.compliance?.canFreeze && e.category !== 'token_issuer') {
    if (a.tags.includes('hot') || a.tags.includes('liquid')) return { reason: `Portefeuille chaud de ${e.name} : il mélange les fonds de tous ses clients. Visez l'adresse de dépôt du client.` }
    return { via: 'service', authority: e.name, delayH: delay(id, 2, 6), assets: [] }
  }
  if (e) return { reason: `${e.name} ne gèle pas sur demande (ou n'a pas d'interlocuteur).` }
  // Adresse de dépôt non étiquetée, reconnue à son comportement
  const dep = CHAINS[a.chain].model === 'account' ? depositAnalysis(w, id) : undefined
  if (dep?.role === 'deposit' && dep.targetEntity?.compliance?.canFreeze) return { via: 'service', authority: dep.targetEntity.name, delayH: delay(id, 2, 6), assets: [] }
  if (CHAINS[a.chain].model !== 'account') return { reason: 'Bitcoin sur une adresse auto-hébergée : personne ne peut le geler on-chain. Il faut attendre qu\'il atteigne un prestataire.' }
  const held = balanceAt(w, id, w.horizon)
  const tokens = (Object.keys(ISSUER) as AssetId[]).filter((t) => (held[t] ?? 0) > 0 || w.txsOf(id).some((tx) => tx.transfers.some((x) => x.to === id && x.asset === t)))
  if (!tokens.length) return { reason: `Actif natif (${CHAINS[a.chain].native}) sur une adresse auto-hébergée : aucun émetteur ne peut le geler.` }
  return { via: 'issuer', authority: tokens.map((t) => ISSUER[t]).join(' et '), delayH: delay(id, 3, 8), assets: tokens }
}

/** Effet d'une demande arrivée à échéance : ce qui reste bloqué au moment du gel. */
export function resolveFreeze(w: World, r: FreezeRequest): FreezeRequest {
  const frozen: Partial<Record<AssetId, number>> = {}
  if (r.via === 'issuer') {
    const b = balanceAt(w, r.address, r.effectiveAt)
    for (const t of r.assets) if ((b[t] ?? 0) > 0) frozen[t] = b[t]
  } else {
    Object.assign(frozen, depositedVia(w, r.address, r.effectiveAt))
  }
  const frozenUsd = Object.entries(frozen).reduce((s, [a, v]) => s + usd(a as AssetId, v ?? 0), 0)
  return { ...r, frozen, frozenUsd, status: frozenUsd >= 1 ? 'effective' : 'late' }
}
