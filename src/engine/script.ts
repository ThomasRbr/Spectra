// Lecture « bas niveau » d'une transaction Bitcoin/Litecoin : script de
// verrouillage de chaque sortie, scriptSig et témoin (witness) de chaque
// entrée, taille, poids et taille virtuelle (remise SegWit). Les clés et
// signatures sont fictives mais ont la forme et la longueur réelles.
import { CHAINS } from './chains'
import { keccak256 } from './keccak'
import type { Address, Tx, World } from './world'

const hx = (seed: string, bytes: number) => {
  let s = ''
  let i = 0
  while (s.length < bytes * 2) s += keccak256(`${seed}:${i++}`)
  return s.slice(0, bytes * 2)
}

export function isBitcoinLike(tx: Tx): boolean {
  return tx.chain === 'btc' || tx.chain === 'ltc'
}

// ── Scripts de verrouillage ─────────────────────────────────────────────────

export interface LockScript {
  type: string
  asm: string
  /** Taille du scriptPubKey en octets. */
  size: number
  help: string
}

export function multisigPubkeys(a: Address): string[] {
  const n = a.multisig?.n ?? 2
  return Array.from({ length: n }, (_, i) => (parseInt(hx(`${a.addr}:pk${i}`, 1), 16) % 2 ? '03' : '02') + hx(`${a.addr}:pk${i}`, 32))
}

export function lockScript(w: World, id: string): LockScript {
  const a = w.get(id)
  const h20 = hx(`h160:${a.addr}`, 20)
  const h32 = hx(`h256:${a.addr}`, 32)
  switch (a.kind) {
    case 'p2pkh':
      return { type: 'P2PKH', asm: `OP_DUP OP_HASH160 ${h20} OP_EQUALVERIFY OP_CHECKSIG`, size: 25, help: 'Paiement au hash d\'une clé publique : la clé et une signature seront révélées dans le scriptSig de la dépense.' }
    case 'p2sh':
      return { type: 'P2SH', asm: `OP_HASH160 ${h20} OP_EQUAL`, size: 23, help: 'Paiement au hash d\'un script : le script réel (multisig, SegWit imbriqué…) n\'est révélé qu\'au moment de la dépense.' }
    case 'p2wpkh':
      return { type: 'P2WPKH (SegWit v0)', asm: `OP_0 ${h20}`, size: 22, help: 'SegWit natif : clé et signature passent dans le témoin, qui bénéficie d\'une remise de poids.' }
    case 'p2wsh':
      return { type: 'P2WSH (SegWit v0, script)', asm: `OP_0 ${h32}`, size: 34, help: 'Hash SHA-256 d\'un script (multisig, canal Lightning, timelock) révélé dans le témoin de la dépense.' }
    case 'p2tr':
      return { type: 'P2TR (Taproot, SegWit v1)', asm: `OP_1 ${h32}`, size: 34, help: 'Clé publique Taproot « ajustée » : dépense par la clé seule (une signature Schnorr) ou par un script caché dans un arbre (révélé seulement s\'il sert).' }
    default:
      return { type: a.kind, asm: '', size: 0, help: '' }
  }
}

// ── Déverrouillage : scriptSig et témoin ────────────────────────────────────

export interface WitnessItem {
  label: string
  hex: string
  bytes: number
}

export interface Unlock {
  /** Type de dépense reconnu. */
  type: string
  scriptSig: WitnessItem[]
  witness: WitnessItem[]
  /** Multisig : clés publiques du script et rang des clés qui ont signé. */
  multisig?: { m: number; n: number; pubkeys: string[]; signed: number[] }
  explain: string
}

const sigDer = (seed: string): WitnessItem => {
  const len = 71 + (parseInt(hx(seed, 1), 16) % 2)
  return { label: 'Signature ECDSA (DER + sighash ALL)', hex: '30' + (len - 3).toString(16) + hx(seed, len - 3) + '01', bytes: len }
}
const pubkey = (seed: string): WitnessItem => ({ label: 'Clé publique compressée', hex: (parseInt(hx(seed, 1), 16) % 2 ? '03' : '02') + hx(seed, 32), bytes: 33 })
const schnorr = (seed: string): WitnessItem => ({ label: 'Signature Schnorr (64 octets, sighash par défaut)', hex: hx(seed, 64), bytes: 64 })

function envelope(tx: Tx): WitnessItem {
  const ct = tx.ord?.contentType ?? 'text/plain;charset=utf-8'
  const size = tx.ord?.size ?? 64
  const asm = `<clé interne> OP_CHECKSIG OP_FALSE OP_IF "ord" 01 "${ct}" 00 <contenu : ${size.toLocaleString('fr-FR')} octets> OP_ENDIF`
  return { label: `Script révélé (enveloppe d'inscription) : ${asm}`, hex: '20' + hx(`env:${tx.hash}`, 32) + 'ac0063036f7264' + '01' + Buffer_hex(ct) + '00' + hx(`content:${tx.hash}`, Math.min(size, 40)) + '…68', bytes: 40 + ct.length + size }
}

function Buffer_hex(s: string): string {
  return Array.from(new TextEncoder().encode(s)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Comment l'entrée `n` de la transaction déverrouille la sortie qu'elle dépense. */
export function unlockOf(w: World, tx: Tx, n: number): Unlock {
  const inp = tx.inputs[n]
  const a = w.get(inp.address)
  const seed = `${tx.hash}:${n}`
  switch (a.kind) {
    case 'p2pkh':
      return { type: 'P2PKH', scriptSig: [sigDer(seed), pubkey(a.addr)], witness: [], explain: 'Ancien format : signature et clé publique dans le scriptSig, sans remise de poids. La clé publique révélée est la même à chaque dépense depuis cette adresse.' }
    case 'p2sh': {
      if (a.multisig) {
        const ms = multisigView(tx, n, a)
        const redeem = `OP_${ms.m} ${ms.pubkeys.map((k) => k.slice(0, 10) + '…').join(' ')} OP_${ms.n} OP_CHECKMULTISIG`
        return {
          type: `P2SH multisig ${ms.m}-sur-${ms.n}`, multisig: ms, witness: [],
          scriptSig: [{ label: 'OP_0 (octet vide exigé par OP_CHECKMULTISIG)', hex: '00', bytes: 1 }, ...ms.signed.map((k) => ({ ...sigDer(`${seed}:${k}`), label: `Signature de la clé n° ${k}` })), { label: `Script de rachat (redeem script) : ${redeem}`, hex: '5' + ms.m + ms.pubkeys.map((k) => '21' + k).join('') + '5' + ms.n + 'ae', bytes: 3 + 34 * ms.n }],
          explain: `Multisignature ancienne génération : le script complet (${ms.n} clés publiques) est révélé à la dépense, avec ${ms.m} signatures.`,
        }
      }
      return { type: 'P2SH-P2WPKH (SegWit imbriqué)', scriptSig: [{ label: 'Programme témoin (OP_0 <hash de la clé>)', hex: '160014' + hx(`h160:${a.addr}`, 20), bytes: 23 }], witness: [sigDer(seed), pubkey(a.addr)], explain: 'SegWit « imbriqué » dans une adresse en 3… : le scriptSig ne contient que le programme témoin ; signature et clé sont dans le témoin. Typique des portefeuilles de 2017-2020.' }
    }
    case 'p2wpkh':
      return { type: 'P2WPKH', scriptSig: [], witness: [sigDer(seed), pubkey(a.addr)], explain: 'SegWit natif : deux éléments dans le témoin (signature ECDSA de 71-72 octets, clé publique de 33 octets). scriptSig vide.' }
    case 'p2wsh': {
      if (a.tags.includes('ln-channel')) {
        const ms = multisigView(tx, n, { ...a, multisig: { m: 2, n: 2 } })
        return { type: 'P2WSH 2-sur-2 (canal Lightning)', multisig: ms, scriptSig: [], witness: [{ label: 'Élément vide (OP_CHECKMULTISIG)', hex: '', bytes: 0 }, sigDer(`${seed}:a`), sigDer(`${seed}:b`), { label: 'Script témoin : OP_2 <clé A> <clé B> OP_2 OP_CHECKMULTISIG', hex: '5221' + ms.pubkeys[0] + '21' + ms.pubkeys[1] + '52ae', bytes: 71 }], explain: 'Dépense de la sortie de financement d\'un canal : les deux pairs signent (fermeture coopérative ou transaction d\'engagement).' }
      }
      if (a.tags.includes('ln-delayed')) {
        return { type: 'P2WSH à délai (sortie to_local)', scriptSig: [], witness: [sigDer(seed), { label: 'Élément vide : branche « délai » du script', hex: '', bytes: 0 }, { label: 'Script : OP_IF <clé de révocation> OP_ELSE <délai> OP_CHECKSEQUENCEVERIFY OP_DROP <clé retardée> OP_ENDIF OP_CHECKSIG', hex: '63' + hx(`rev:${a.addr}`, 33) + '6702' + '9000b275' + hx(`del:${a.addr}`, 33) + '68ac', bytes: 77 }], explain: 'Récupération après fermeture forcée : la branche ELSE du script n\'est utilisable qu\'après le délai relatif (CSV). Signature typique de Lightning.' }
      }
      const ms = multisigView(tx, n, a)
      return {
        type: `P2WSH multisig ${ms.m}-sur-${ms.n}`, multisig: ms, scriptSig: [],
        witness: [{ label: 'Élément vide (exigé par OP_CHECKMULTISIG)', hex: '', bytes: 0 }, ...ms.signed.map((k) => ({ ...sigDer(`${seed}:${k}`), label: `Signature de la clé n° ${k}` })), { label: `Script témoin : OP_${ms.m} ${ms.pubkeys.map((_, i) => `<clé ${i + 1}>`).join(' ')} OP_${ms.n} OP_CHECKMULTISIG`, hex: '5' + ms.m + ms.pubkeys.map((k) => '21' + k).join('') + '5' + ms.n + 'ae', bytes: 3 + 34 * ms.n }],
        explain: `Coffre multisignature : le témoin révèle les ${ms.n} clés publiques et ${ms.m} signatures. En vérifiant chaque signature contre chaque clé, l'outil sait quelles clés ont signé : ${ms.signed.map((k) => `n° ${k}`).join(' et ')}.`,
      }
    }
    case 'p2tr': {
      if (tx.ord?.kind === 'reveal' && n === 0) {
        return { type: 'P2TR, dépense par script (révélation d\'inscription)', scriptSig: [], witness: [schnorr(seed), envelope(tx), { label: 'Bloc de contrôle (version de feuille + clé interne)', hex: 'c1' + hx(`ctl:${a.addr}`, 32), bytes: 33 }], explain: 'Dépense Taproot par la branche script : le témoin contient la signature, le script (ici une enveloppe OP_FALSE OP_IF… qui ne s\'exécute jamais et sert à stocker des données) et le bloc de contrôle. C\'est ainsi que naît une inscription ordinale.' }
      }
      return { type: 'P2TR, dépense par la clé', scriptSig: [], witness: [schnorr(seed)], explain: 'Dépense Taproot la plus courante : une seule signature Schnorr de 64 octets. Impossible de savoir si un script alternatif existait (multisig MuSig, timelock) : il reste caché.' }
    }
    default:
      return { type: a.kind, scriptSig: [], witness: [], explain: '' }
  }
}

function multisigView(tx: Tx, n: number, a: Address): NonNullable<Unlock['multisig']> {
  const m = a.multisig?.m ?? 2
  const total = a.multisig?.n ?? 3
  const pubkeys = multisigPubkeys({ ...a, multisig: { m, n: total } })
  let signed = tx.multisigSigners?.[n]
  if (!signed) {
    // Choix déterministe des signataires quand le scénario ne l'impose pas
    const pool = Array.from({ length: total }, (_, i) => i + 1)
    const h = parseInt(hx(`signers:${tx.hash}:${n}`, 2), 16)
    signed = pool.sort((x, y) => ((h >> x) & 1) - ((h >> y) & 1) || x - y).slice(0, m).sort((x, y) => x - y)
  }
  return { m, n: total, pubkeys, signed }
}

// ── Taille, poids, taille virtuelle ─────────────────────────────────────────

export interface TxSize {
  /** Taille sérialisée complète (octets). */
  size: number
  /** Poids (unités de poids) : octets hors témoin × 4 + octets du témoin. */
  weight: number
  /** Taille virtuelle : poids / 4 (arrondi supérieur). */
  vsize: number
  witnessBytes: number
  /** Taux de frais (sat/vB). */
  feeRate: number
  /** Taille qu'aurait la même transaction sans la remise SegWit (tout en octets « pleins »). */
  vsizeWithoutDiscount: number
}

const itemsBytes = (xs: WitnessItem[]) => xs.reduce((s, x) => s + 1 + x.bytes, 0)

export function txSize(w: World, tx: Tx): TxSize | null {
  if (!isBitcoinLike(tx)) return null
  let base = 4 + 4 + 1 + 1
  let wit = 0
  tx.inputs.forEach((_, n) => {
    const u = unlockOf(w, tx, n)
    const ss = itemsBytes(u.scriptSig)
    base += 36 + 1 + ss + 4
    if (u.witness.length) wit += 1 + itemsBytes(u.witness)
  })
  for (const o of tx.outputs) base += 8 + 1 + (lockScript(w, o.address).size || 22)
  if (tx.opReturn) base += 8 + 1 + 2 + tx.opReturn.hex.length / 2
  const segwit = wit > 0
  if (segwit) {
    wit += 2
    // Entrées non SegWit d'une transaction SegWit : témoin vide (1 octet chacune)
    tx.inputs.forEach((_, n) => {
      if (!unlockOf(w, tx, n).witness.length) wit += 1
    })
  }
  const weight = base * 4 + wit
  const vsize = Math.ceil(weight / 4)
  const unit = tx.chain === 'btc' ? 1e8 : 1e8
  return { size: base + wit, weight, vsize, witnessBytes: wit, feeRate: Math.round(((tx.fee * unit) / vsize) * 10) / 10, vsizeWithoutDiscount: base + wit }
}

/** Unité des frais : sat/vB pour Bitcoin et Litecoin. */
export function feeUnit(tx: Tx): string {
  return CHAINS[tx.chain].model === 'utxo' ? 'sat/vB' : ''
}
