// Inscriptions ordinales, BRC-20 et Runes sur Bitcoin. Une inscription est
// créée en deux transactions (commit vers une adresse Taproot, puis reveal qui
// dépense cette adresse par script en publiant le contenu dans le témoin).
// Elle « vit » sur le premier satoshi de la sortie qui la porte (postage,
// souvent 10 000 ou 546 sats) et suit ce satoshi selon l'ordre des entrées et
// des sorties (premier entré, premier sorti). Les Runes sont des soldes de
// jetons attachés aux UTXO, déplacés par un message OP_RETURN (« runestone »).
import type { Entity } from './entities'
import { keccak256 } from './keccak'
import type { Tx, World } from './world'

export const POSTAGE = 0.0001 // 10 000 sats
export const RUNE_DUST = 0.00000546 // 546 sats

export interface Inscription {
  id: string
  number: number
  /** Adresse qui détient l'inscription après la révélation. */
  holder: string
  commit: Tx
  reveal: Tx
}

/**
 * Crée une inscription : `owner` finance une adresse Taproot de commit, puis
 * le reveal dépense ce commit et dépose l'inscription (premier sat de la
 * sortie 0, `POSTAGE`) sur `recipient` (par défaut une nouvelle adresse P2TR du
 * même portefeuille).
 */
export function inscribe(w: World, o: { owner: string; content: string; contentType: string; size?: number; time: number; recipient?: string; feeRate?: number }): Inscription {
  const src = w.get(o.owner)
  const size = o.size ?? new TextEncoder().encode(o.content).length
  const revealVb = 150 + Math.ceil(size / 4)
  const revealFee = Math.round(revealVb * (o.feeRate ?? w.rng.int(6, 30))) * 1e-8
  const commitAddr = w.addr(src.chain, { kind: 'p2tr', entity: src.entityId, wallet: src.wallet, tags: ['ord-commit'] })
  const commit = w.utxoTx({ time: o.time, from: [o.owner], to: [{ address: commitAddr, value: +(POSTAGE + revealFee).toFixed(8) }], tags: ['ord-commit'] })
  commit.ord = { kind: 'commit' }
  const recipient = o.recipient ?? w.addr(src.chain, { kind: 'p2tr', entity: src.entityId, wallet: src.wallet })
  const reveal = w.rawUtxoTx({ time: o.time + w.rng.int(60, 1800), spend: [{ address: commitAddr }], outputs: [{ address: recipient, value: POSTAGE }], tags: ['inscription'], keepOrder: true })
  const number = 70_000_000 + (parseInt(keccak256(reveal.hash).slice(0, 6), 16) % 9_000_000)
  const id = `${reveal.hash}i0`
  reveal.ord = { kind: 'reveal', id, number, contentType: o.contentType, content: o.content, size, carrier: 0 }
  reveal.fp = { version: 2, locktime: 0, rbf: true }
  return { id, number, holder: recipient, commit, reveal }
}

/**
 * Envoie une inscription : l'UTXO qui la porte est la PREMIÈRE entrée, la
 * sortie 0 (même valeur de postage) la reçoit ; les frais sont payés par une
 * seconde entrée de `feePayer` dont le reste revient en rendu.
 */
export function sendInscription(w: World, o: { ins: Inscription; from: string; to: string; feePayer: string; time: number }): Tx {
  const fee = w.estimateFee('btc', 2, 2)
  const pay = w.unspentValue(o.feePayer, o.time)
  if (pay < fee * 2) w.fund(o.feePayer, fee * 4, o.time - w.rng.int(3600, 86400 * 3))
  const avail = w.unspentValue(o.feePayer, o.time)
  const changeAddr = w.addr('btc', { kind: w.get(o.feePayer).kind, entity: w.get(o.feePayer).entityId, wallet: w.get(o.feePayer).wallet })
  const tx = w.rawUtxoTx({ time: o.time, spend: [{ address: o.from }, { address: o.feePayer }], outputs: [{ address: o.to, value: POSTAGE }, { address: changeAddr, value: +(avail - fee).toFixed(8) }], tags: ['inscription-transfer'], keepOrder: true })
  tx.ord = { kind: 'transfer', id: o.ins.id, number: o.ins.number, carrier: 0 }
  o.ins.holder = o.to
  return tx
}

export interface MarketKit {
  entity: Entity
  /** Adresse qui encaisse les commissions de la place de marché. */
  feeAddr: string
  /**
   * Vente par PSBT : entrées [petite UTXO « tampon » de l'acheteur, inscription
   * du vendeur, paiement de l'acheteur] → sorties [tampon, inscription vers
   * l'acheteur, prix vers le vendeur, commission, rendu de l'acheteur]. Le
   * tampon de 600 sats décale l'inscription en sortie 1.
   */
  sell(o: { ins: Inscription; seller: string; sellerPayout?: string; buyer: string; buyerReceive?: string; price: number; time: number; feePct?: number }): { tx: Tx; payout: string; receive: string; fee: number }
}

export function marketplace(w: World, key = 'ordinalia'): MarketKit {
  const entity = w.entity(key)
  const feeAddr = w.addr('btc', { entity, label: `${entity.name} — Commissions`, kind: 'p2tr', tags: ['liquid'] })
  return {
    entity,
    feeAddr,
    sell(o) {
      const b = w.get(o.buyer)
      const dummy = w.addr('btc', { kind: b.kind, entity: b.entityId, wallet: b.wallet })
      const DUMMY = 0.000006
      w.fund(dummy, DUMMY, o.time - w.rng.int(3600, 86400 * 5))
      const fee = Math.round((o.feePct ?? 0.02) * o.price * 1e8) * 1e-8
      const netFee = w.estimateFee('btc', 3, 5)
      const need = o.price + fee + netFee + 0.00002
      if (w.unspentValue(o.buyer, o.time) < need) w.fund(o.buyer, need * w.rng.float(1.05, 1.6), o.time - w.rng.int(3600, 86400 * 4))
      const payIn = w.unspentValue(o.buyer, o.time)
      const payout = o.sellerPayout ?? o.seller
      const receive = o.buyerReceive ?? w.addr('btc', { kind: 'p2tr', entity: b.entityId, wallet: b.wallet })
      const change = w.addr('btc', { kind: b.kind, entity: b.entityId, wallet: b.wallet })
      const tx = w.rawUtxoTx({
        time: o.time,
        spend: [{ address: dummy }, { address: o.ins.holder }, { address: o.buyer }],
        outputs: [
          { address: dummy, value: DUMMY },
          { address: receive, value: POSTAGE },
          { address: payout, value: +o.price.toFixed(8) },
          { address: feeAddr, value: +fee.toFixed(8) },
          { address: change, value: +(payIn - o.price - fee - netFee).toFixed(8) },
        ],
        tags: ['inscription-sale'], keepOrder: true,
      })
      tx.ord = { kind: 'sale', id: o.ins.id, number: o.ins.number, carrier: 1, price: o.price, marketplace: entity.name }
      tx.fp = { version: 2, locktime: 0, rbf: true }
      o.ins.holder = receive
      return { tx, payout, receive, fee }
    },
  }
}

/** Encodage (simplifié) d'un runestone : OP_RETURN OP_13 suivi des champs en LEB128. */
function runestoneHex(seed: string): string {
  return '6a5d' + keccak256(`runestone:${seed}`).slice(0, 24)
}

/**
 * Transfert de runes : `amount` unités de `rune` vont à `to` (sortie de
 * 546 sats), le reste du solde de runes revient au rendu. Le message
 * OP_RETURN (runestone) porte l'instruction (« edict »).
 */
export function runeTransfer(w: World, o: { from: string; to: string; rune: string; amount: number; time: number }): Tx {
  const tx = w.utxoTx({ time: o.time, from: [o.from], to: [{ address: o.to, value: RUNE_DUST }], tags: ['runes'] })
  const carrier = tx.outputs.find((x) => x.address === o.to)?.n ?? 0
  tx.opReturn = { protocol: 'runes', hex: runestoneHex(tx.hash), text: `Runestone : edict ${o.rune} × ${o.amount.toLocaleString('fr-FR')} → sortie ${carrier}` }
  tx.ord = { kind: 'rune-transfer', rune: o.rune, runeAmount: o.amount, carrier }
  return tx
}

/** Frappe (mint) ouverte d'une rune : l'utilisateur paie les frais et reçoit `amount` unités sur une sortie de 546 sats. */
export function runeMint(w: World, o: { from: string; rune: string; amount: number; time: number; to?: string }): Tx {
  const src = w.get(o.from)
  const to = o.to ?? w.addr(src.chain, { kind: 'p2tr', entity: src.entityId, wallet: src.wallet })
  const tx = w.utxoTx({ time: o.time, from: [o.from], to: [{ address: to, value: RUNE_DUST }], tags: ['runes'] })
  const carrier = tx.outputs.find((x) => x.address === to)?.n ?? 0
  tx.opReturn = { protocol: 'runes', hex: runestoneHex(tx.hash), text: `Runestone : mint ${o.rune} (${o.amount.toLocaleString('fr-FR')} unités) → sortie ${carrier}` }
  tx.ord = { kind: 'rune-mint', rune: o.rune, runeAmount: o.amount, carrier }
  return tx
}

/** Contenu JSON d'une inscription BRC-20 (deploy, mint ou transfer). */
export function brc20(op: 'deploy' | 'mint' | 'transfer', tick: string, amt: number): string {
  return op === 'deploy' ? `{"p":"brc-20","op":"deploy","tick":"${tick}","max":"21000000","lim":"1000"}` : `{"p":"brc-20","op":"${op}","tick":"${tick}","amt":"${amt}"}`
}
