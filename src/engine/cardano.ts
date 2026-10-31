// Cardano (eUTXO) : portefeuilles à clé de staking partagée, adresses de
// script porteuses de données (datum). Toutes les adresses de base d'un même
// portefeuille partagent la partie « staking » : c'est une heuristique de
// regroupement plus forte que les entrées communes, et visible sans aucune
// transaction.
import { cardanoBase, cardanoStakeAddress, cardanoStakeTail } from './addressgen'
import type { Entity } from './entities'
import type { Tx, World } from './world'

export interface AdaWallet {
  /** Adresse de récompense (stake1u…) : identifiant de la clé de staking. */
  stake: string
  /** Partie staking commune, visible en fin d'adresse. */
  tail: string
  wallet: string
  addresses: string[]
  newAddress(label?: string): string
}

/** Portefeuille Cardano « HD » : chaque nouvelle adresse de base garde la même clé de staking. */
export function adaWallet(w: World, opts: { entity?: string | Entity; label?: string; wallet?: string } = {}): AdaWallet {
  const tail = cardanoStakeTail(w.rng)
  const stake = cardanoStakeAddress(tail)
  const wallet = opts.wallet ?? `ada:${stake}`
  const kit: AdaWallet = {
    stake,
    tail,
    wallet,
    addresses: [],
    newAddress(label) {
      const id = w.addr('ada', { kind: 'ada_base', addr: cardanoBase(w.rng, tail), entity: opts.entity, label: label ?? opts.label, stake, wallet })
      kit.addresses.push(id)
      return id
    },
  }
  return kit
}

/** Adresse « enterprise » (sans staking), courante pour les portefeuilles chauds des plateformes. */
export function adaEnterprise(w: World, opts: { entity?: string | Entity; label?: string; tags?: string[] } = {}): string {
  return w.addr('ada', { kind: 'ada_enterprise', entity: opts.entity, label: opts.label, tags: opts.tags })
}

/** Adresse de script Plutus (contrat), qui verrouille des UTXO accompagnées d'un datum. */
export function adaScript(w: World, opts: { entity?: string | Entity; label: string; name: string }): string {
  return w.addr('ada', { kind: 'ada_script', entity: opts.entity, label: opts.label, contract: { name: opts.name, type: 'escrow', verified: true } })
}

/** Verrouille des ADA sur une adresse de script avec un datum lisible (eUTXO). */
export function lockToScript(w: World, o: { from: string; script: string; value: number; time: number; datum: string; tags?: string[] }): Tx {
  const tx = w.utxoTx({ time: o.time, from: [o.from], to: [{ address: o.script, value: o.value }], tags: ['script-lock', ...(o.tags ?? [])] })
  const out = tx.outputs.find((x) => x.address === o.script)
  if (out) out.datum = o.datum
  return tx
}

/** Toutes les adresses connues partageant la clé de staking de `id` (y compris `id`). */
export function stakeSiblings(w: World, id: string): string[] {
  const s = w.get(id).stake
  if (!s) return [id]
  return [...w.addresses.values()].filter((a) => a.stake === s).map((a) => a.id)
}
