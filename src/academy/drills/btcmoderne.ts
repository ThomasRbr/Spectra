// Exercices « Bitcoin moderne » : type de dépense d'après le témoin, poids et
// taille virtuelle (remise SegWit), sortie porteuse d'une inscription ou de
// runes, et regroupement d'adresses Cardano par partie staking. Les tailles
// suivent la sérialisation réelle (mêmes règles que src/engine/script.ts).
import { cardanoBase, cardanoStakeAddress, cardanoStakeTail, genAddress, type AddrKind } from '../../engine/addressgen'
import type { Rng } from '../../engine/rng'
import type { DrillDef, DrillVisual } from '../model'
import { fr, frList, frMax, mkChoice, rngFor } from './util'

const HEX = '0123456789abcdef'
const hexs = (rng: Rng, bytes: number) => {
  let s = ''
  for (let i = 0; i < bytes * 2; i++) s += HEX[rng.int(0, 15)]
  return s
}
const octets = (n: number) => `${fr(n)} octet${n > 1 ? 's' : ''}`

// ── 1. Type de dépense d'après le témoin ────────────────────────────────────

interface WItem {
  bytes: number
  hex: string
}

type SpendType = 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh' | 'p2wsh-ms' | 'p2tr-key' | 'p2tr-script'

interface Spend {
  type: SpendType
  scriptSig: WItem[]
  witness: WItem[]
  m: number
  n: number
  pubkeys: string[]
  signed: number[]
}

/** Signature ECDSA au format DER (71 ou 72 octets, r et s « bas ») suivie de l'octet de sighash 01. */
function der(rng: Rng): WItem {
  const long = rng.chance(0.5)
  const r = long ? '00' + HEX[rng.int(8, 15)] + hexs(rng, 32).slice(1) : HEX[rng.int(0, 7)] + hexs(rng, 32).slice(1)
  const s = HEX[rng.int(0, 7)] + hexs(rng, 32).slice(1)
  const hex = '30' + (long ? '45' : '44') + '02' + (long ? '21' : '20') + r + '0220' + s + '01'
  return { bytes: hex.length / 2, hex }
}
const pubkey = (rng: Rng) => (rng.chance(0.5) ? '02' : '03') + hexs(rng, 32)
const schnorr = (rng: Rng): WItem => (rng.chance(0.12) ? { bytes: 65, hex: hexs(rng, 64) + '01' } : { bytes: 64, hex: hexs(rng, 64) })

function buildSpend(rng: Rng, type: SpendType, m = 2, n = 3): Spend {
  const sp: Spend = { type, scriptSig: [], witness: [], m, n, pubkeys: [], signed: [] }
  const pk = (): WItem => ({ bytes: 33, hex: pubkey(rng) })
  switch (type) {
    case 'p2wpkh':
      sp.witness = [der(rng), pk()]
      break
    case 'p2sh-p2wpkh':
      sp.scriptSig = [{ bytes: 23, hex: '160014' + hexs(rng, 20) }]
      sp.witness = [der(rng), pk()]
      break
    case 'p2pkh':
      sp.scriptSig = [der(rng), pk()]
      break
    case 'p2tr-key':
      sp.witness = [schnorr(rng)]
      break
    case 'p2tr-script': {
      const key = hexs(rng, 32)
      const script = rng.chance(0.5) ? '20' + key + 'ac' : '03' + hexs(rng, 3) + 'b17520' + key + 'ac'
      const ctl = (rng.chance(0.5) ? 'c0' : 'c1') + hexs(rng, 32) + (rng.chance(0.5) ? hexs(rng, 32) : '')
      sp.witness = [schnorr(rng), { bytes: script.length / 2, hex: script }, { bytes: ctl.length / 2, hex: ctl }]
      break
    }
    case 'p2wsh-ms': {
      sp.pubkeys = Array.from({ length: n }, () => pubkey(rng))
      sp.signed = rng.shuffle(Array.from({ length: n }, (_, i) => i + 1)).slice(0, m).sort((a, b) => a - b)
      const script = (0x50 + m).toString(16) + sp.pubkeys.map((k) => '21' + k).join('') + (0x50 + n).toString(16) + 'ae'
      sp.witness = [{ bytes: 0, hex: '' }, ...sp.signed.map(() => der(rng)), { bytes: script.length / 2, hex: script }]
      break
    }
  }
  return sp
}

const preview = (hex: string) => (hex.length <= 28 ? hex : `${hex.slice(0, 18)}…${hex.slice(-8)}`)
const itemLine = (prefix: string, it: WItem) => `${prefix} : ${it.bytes ? `${octets(it.bytes)} — ${preview(it.hex)}` : '0 octet — (élément vide)'}`

function spendItems(sp: Spend): string[] {
  const lines: string[] = []
  if (!sp.scriptSig.length) lines.push('scriptSig : (vide)')
  else sp.scriptSig.forEach((it, i) => lines.push(itemLine(`scriptSig, poussée ${i + 1}`, it)))
  if (!sp.witness.length) lines.push('Témoin : (aucun)')
  else {
    lines.push(`Témoin : ${sp.witness.length} élément${sp.witness.length > 1 ? 's' : ''}`)
    sp.witness.forEach((it, i) => lines.push(itemLine(`Témoin, élément ${i}`, it)))
  }
  return lines
}

const msLabel = (m: number, n: number) => `P2WSH multisig ${m}-sur-${n}`
function typeLabel(t: SpendType, m = 2, n = 3): string {
  switch (t) {
    case 'p2wpkh': return 'P2WPKH (SegWit v0 natif, clé unique)'
    case 'p2sh-p2wpkh': return 'P2SH-P2WPKH (SegWit imbriqué dans une adresse 3…)'
    case 'p2pkh': return 'P2PKH (Legacy, sans témoin)'
    case 'p2wsh-ms': return msLabel(m, n)
    case 'p2tr-key': return 'P2TR, dépense par la clé (key path)'
    case 'p2tr-script': return 'P2TR, dépense par script (script path)'
  }
}

const CLUE: Record<SpendType, string> = {
  p2wpkh: 'P2WPKH : scriptSig vide, deux éléments de témoin (signature ECDSA de 71-72 octets, clé publique de 33 octets)',
  'p2sh-p2wpkh': 'P2SH-P2WPKH : le même témoin, mais un scriptSig de 23 octets commençant par 160014',
  p2pkh: 'P2PKH : aucun témoin, signature et clé publique dans le scriptSig',
  'p2wsh-ms': 'P2WSH multisig : un élément vide, m signatures, puis un script de 3 + 34 × n octets (5m…5nae)',
  'p2tr-key': 'P2TR par la clé : un seul élément de 64 octets (65 avec un octet de sighash explicite)',
  'p2tr-script': 'P2TR par script : signature, script, puis bloc de contrôle commençant par c0 ou c1',
}

function spendExplain(sp: Spend): string {
  const { m, n } = sp
  switch (sp.type) {
    case 'p2wpkh':
      return 'scriptSig vide et deux éléments de témoin : une signature ECDSA (encodage DER, 71-72 octets, terminée par l\'octet de sighash 01) puis une clé publique compressée (33 octets, préfixe 02 ou 03). C\'est la dépense SegWit v0 à clé unique : **P2WPKH**, adresse bc1q… de 42 caractères.'
    case 'p2sh-p2wpkh':
      return 'Le témoin est celui d\'un P2WPKH (signature + clé de 33 octets), mais le scriptSig n\'est pas vide : 23 octets commençant par 160014, soit la poussée du programme témoin OP_0 <20 octets>. C\'est du SegWit « imbriqué » : **P2SH-P2WPKH**, adresse commençant par 3, typique des portefeuilles de 2017-2020.'
    case 'p2pkh':
      return 'Aucun témoin : la signature et la clé publique sont poussées dans le scriptSig. C\'est une dépense **P2PKH** (Legacy, adresse 1…), qui ne bénéficie d\'aucune remise de poids.'
    case 'p2tr-key':
      return 'Un seul élément de témoin, de 64 octets (65 si un octet de sighash est ajouté) : une signature Schnorr. C\'est la **dépense Taproot par la clé**, la plus courante. Aucun script n\'est révélé : impossible de savoir si une branche alternative (multisig agrégé, délai) existait.'
    case 'p2tr-script':
      return `Trois éléments : une signature Schnorr, un script (${octets(sp.witness[1].bytes)}, se terminant par ac = OP_CHECKSIG${sp.witness[1].bytes === 40 ? ', précédé d\'un délai b1 75 = OP_CHECKLOCKTIMEVERIFY OP_DROP' : ''}), puis un bloc de contrôle de ${octets(sp.witness[2].bytes)} commençant par ${sp.witness[2].hex.slice(0, 2)} (version de feuille et parité), suivi de la clé interne${sp.witness[2].bytes > 33 ? ' et du chemin de Merkle' : ''}. Le bloc de contrôle signe une **dépense Taproot par script** : une branche de l'arbre de scripts est révélée.`
    case 'p2wsh-ms':
      return `Le témoin commence par un élément vide (exigé par un défaut historique d'OP_CHECKMULTISIG), suivi de ${m} signatures ECDSA, puis du script témoin : ${octets(3 + 34 * n)} = 3 + 34 × ${n}, qui commence par 5${m} (OP_${m}) et se termine par 5${n}ae (OP_${n} OP_CHECKMULTISIG). C'est un **multisig P2WSH ${m}-sur-${n}** : ${n} clés publiques dans le script, ${m} signatures exigées. Adresse bc1q… de 62 caractères.`
  }
}

const ADDR_FMT: Record<string, string> = {
  p2wpkh: 'bc1q… de 42 caractères (P2WPKH)',
  'p2sh-p2wpkh': '3… (P2SH)',
  p2pkh: '1… (P2PKH)',
  'p2wsh-ms': 'bc1q… de 62 caractères (P2WSH)',
  p2tr: 'bc1p… (P2TR)',
}
const fmtKey = (t: SpendType) => (t === 'p2tr-key' || t === 'p2tr-script' ? 'p2tr' : t)

function combos(n: number, m: number): number[][] {
  const out: number[][] = []
  const rec = (start: number, acc: number[]) => {
    if (acc.length === m) return void out.push([...acc])
    for (let i = start; i <= n; i++) rec(i + 1, [...acc, i])
  }
  rec(1, [])
  return out
}

export const witnessType: DrillDef = {
  id: 'witness-type',
  title: 'Lire un témoin SegWit',
  description: 'scriptSig et témoin d\'une entrée : reconnaître une dépense P2WPKH, SegWit imbriqué, multisig P2WSH, Taproot par la clé ou par script, et retrouver les clés qui ont signé.',
  level: 3,
  track: 'bitcoin',
  icon: 'Fingerprint',
  generate(seed) {
    const rng = rngFor(seed, 'witness-type')
    const variant = rng.weighted([['type', 4], ['prevout', 2], ['signers', 2.5]] as const)

    if (variant === 'signers') {
      const [m, n] = rng.pick([[2, 3], [2, 3], [2, 4], [3, 4], [3, 5], [2, 5]] as const)
      const sp = buildSpend(rng, 'p2wsh-ms', m, n)
      const short = (k: string) => `${k.slice(0, 14)}…`
      const keyLines = sp.pubkeys.map((k, i) => `Script témoin, clé n° ${i + 1} : ${short(k)}`)
      const verif = sp.signed.map((k, i) => `Signature ${i + 1} → valide pour la clé ${short(sp.pubkeys[k - 1])}`)
      const lab = (s: number[]) => `Clés n° ${frList(s.map(String))}`
      const correct = lab(sp.signed)
      const IMPOSSIBLE = 'Impossible à dire : un témoin multisig ne permet pas de savoir quelles clés ont signé'
      const others = combos(n, m).filter((c) => lab(c) !== correct).map(lab)
      const { options, answer } = mkChoice(rng, correct, rng.shuffle([IMPOSSIBLE, ...rng.shuffle(others).slice(0, 3)]), 4)
      const unsigned = Array.from({ length: n }, (_, i) => i + 1).filter((k) => !sp.signed.includes(k))
      return {
        prompt: 'Quelles clés du coffre multisignature ont signé cette dépense ?',
        context: `Résultat de la vérification des signatures par l'outil d'analyse (chaque signature est contrôlée contre les clés du script) :\n${verif.join('\n')}`,
        visual: { type: 'list', title: 'Entrée n° 0 — scriptSig, témoin et clés du script', items: [...spendItems(sp), ...keyLines] },
        kind: 'choice',
        options,
        answer,
        explain: `${spendExplain(sp)}\n\nEn rapprochant chaque signature de la clé pour laquelle elle est valide (${verif.map((v) => v.replace('Signature ', 'signature ').replace(' → valide pour la clé', ' ↔')).join(' ; ')}) et en repérant ces clés dans le script, on obtient les **${correct.toLowerCase()}**. OP_CHECKMULTISIG impose d'ailleurs que les signatures figurent dans l'ordre des clés du script.\n\nContrairement à une idée reçue, un multisig P2WSH révèle tout : les ${n} clés publiques et lesquelles ont signé. La clé n° ${frList(unsigned.map(String))} figure dans le script mais n'a pas signé. Intérêt d'enquête : dans un séquestre 2-sur-3 (acheteur, vendeur, arbitre), savoir si l'arbitre a signé ; dans un coffre d'entreprise, savoir quels détenteurs de clés ont participé. À l'inverse, une dépense Taproot par la clé (MuSig) ne révélerait rien de tel.`,
      }
    }

    const type: SpendType = rng.weighted([['p2wpkh', 3], ['p2sh-p2wpkh', 2], ['p2pkh', 1.5], ['p2wsh-ms', 2], ['p2tr-key', 2.5], ['p2tr-script', 2]] as const)
    const [m, n] = rng.pick([[2, 3], [2, 2], [3, 5], [2, 4], [1, 2], [3, 4]] as const)
    const sp = buildSpend(rng, type, m, n)
    const visual: DrillVisual = { type: 'list', title: 'Entrée n° 0 — scriptSig et témoin', items: spendItems(sp) }

    if (variant === 'prevout') {
      const key = fmtKey(type)
      const correct = ADDR_FMT[key]
      const d = rng.shuffle(Object.keys(ADDR_FMT).filter((k) => k !== key).map((k) => ADDR_FMT[k]))
      const { options, answer } = mkChoice(rng, correct, d, 4)
      return {
        prompt: 'Quel type d\'adresse cette entrée dépensait-elle ?',
        context: 'Seuls le scriptSig et le témoin de l\'entrée sont connus (l\'adresse de la sortie dépensée n\'est pas affichée).',
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${spendExplain(sp)}\n\nL'adresse dépensée était donc de la forme ${correct}. Les autres formats laisseraient une autre trace :\n\n${(Object.keys(ADDR_FMT) as string[]).filter((k) => k !== key).map((k) => `- ${ADDR_FMT[k]} : ${CLUE[(k === 'p2tr' ? 'p2tr-key' : k) as SpendType].split(' : ').slice(1).join(' : ')}${k === 'p2tr' ? ' (ou signature, script et bloc de contrôle pour une dépense par script)' : ''}`).join('\n')}\n\nUn multisig P2SH ancien commencerait aussi par 3, mais son scriptSig contiendrait les signatures et le script de rachat complet.`,
      }
    }

    const correct = typeLabel(type, m, n)
    const conf: Record<SpendType, SpendType[]> = {
      p2wpkh: ['p2sh-p2wpkh', 'p2pkh', 'p2tr-key', 'p2wsh-ms'],
      'p2sh-p2wpkh': ['p2wpkh', 'p2pkh', 'p2wsh-ms', 'p2tr-key'],
      p2pkh: ['p2wpkh', 'p2sh-p2wpkh', 'p2tr-key'],
      'p2tr-key': ['p2tr-script', 'p2wpkh', 'p2wsh-ms'],
      'p2tr-script': ['p2tr-key', 'p2wsh-ms', 'p2wpkh'],
      'p2wsh-ms': ['p2tr-script', 'p2sh-p2wpkh'],
    }
    const d: string[] = type === 'p2wsh-ms'
      ? [msLabel(m < n ? m + 1 : m - 1, n), msLabel(m, n + 1), ...conf[type].map((t) => typeLabel(t))]
      : rng.shuffle(conf[type]).map((t) => typeLabel(t, 2, 3))
    const { options, answer } = mkChoice(rng, correct, d, 4)
    const shownTypes = (Object.keys(CLUE) as SpendType[]).filter((t) => t !== type)
    return {
      prompt: 'Quel type de dépense cette entrée réalise-t-elle ?',
      context: 'Données brutes de l\'entrée, telles que les affiche un explorateur en mode avancé (taille de chaque élément, puis début et fin de son contenu hexadécimal).',
      visual,
      kind: 'choice',
      options,
      answer,
      explain: `${spendExplain(sp)}\n\nRepères pour les autres types :\n\n${shownTypes.map((t) => `- ${CLUE[t]}`).join('\n')}`,
    }
  },
}

// ── 2. Poids, taille virtuelle et taux de frais ─────────────────────────────

type InT = 'p2wpkh' | 'p2tr' | 'p2pkh' | 'p2sh-p2wpkh'
type OutT = 'p2wpkh' | 'p2tr' | 'p2pkh' | 'p2sh' | 'p2wsh'
const SPK: Record<OutT, number> = { p2wpkh: 22, p2tr: 34, p2pkh: 25, p2sh: 23, p2wsh: 34 }
const IN_NAME: Record<InT, string> = { p2wpkh: 'P2WPKH', p2tr: 'P2TR (clé)', p2pkh: 'P2PKH', 'p2sh-p2wpkh': 'P2SH-P2WPKH' }
const OUT_NAME: Record<OutT, string> = { p2wpkh: 'P2WPKH', p2tr: 'P2TR', p2pkh: 'P2PKH', p2sh: 'P2SH', p2wsh: 'P2WSH' }
const addrKind = (t: InT | OutT): AddrKind => (t === 'p2sh-p2wpkh' ? 'p2sh' : t)

export const vsizeFee: DrillDef = {
  id: 'vsize-fee',
  title: 'Poids, vsize et taux de frais',
  description: 'Appliquer la remise SegWit : poids = octets hors témoin × 4 + octets du témoin, taille virtuelle = poids ÷ 4, taux de frais en sat/vB.',
  level: 3,
  track: 'bitcoin',
  icon: 'Scale',
  generate(seed) {
    const rng = rngFor(seed, 'vsize-fee')
    const variant = rng.weighted([['weight', 2], ['vsize', 2.5], ['rate', 3], ['discount', 1.5]] as const)
    const nIn = rng.int(1, 4)
    const nOut = rng.int(1, 3)
    const ins: InT[] = Array.from({ length: nIn }, () => rng.weighted([['p2wpkh', 5], ['p2tr', 2], ['p2pkh', 1.5], ['p2sh-p2wpkh', 1.5]] as const))
    if (variant === 'discount' && !ins.some((t) => t !== 'p2pkh')) ins[0] = 'p2wpkh'
    const outs: OutT[] = Array.from({ length: nOut }, () => rng.weighted([['p2wpkh', 5], ['p2tr', 2], ['p2pkh', 1], ['p2sh', 1.5], ['p2wsh', 0.5]] as const))
    const segwit = ins.some((t) => t !== 'p2pkh')
    let B = 10
    let W = segwit ? 2 : 0
    const detail: string[] = [`- en-tête (version, compteurs, locktime) : 10 octets hors témoin${segwit ? ' + 2 octets de témoin (marqueur et drapeau SegWit)' : ''}`]
    ins.forEach((t, i) => {
      const sig = rng.chance(0.5) ? 72 : 71
      const ss = t === 'p2pkh' ? 1 + sig + 1 + 33 : t === 'p2sh-p2wpkh' ? 23 : 0
      const b = 41 + ss
      const w = !segwit ? 0 : t === 'p2pkh' ? 1 : t === 'p2tr' ? 66 : 1 + 1 + sig + 1 + 33
      B += b
      W += w
      detail.push(`- entrée ${i + 1} (${IN_NAME[t]}) : ${b} octets hors témoin${w ? ` + ${w} octet${w > 1 ? 's' : ''} de témoin` : ''}`)
    })
    outs.forEach((t, i) => {
      const b = 9 + SPK[t]
      B += b
      detail.push(`- sortie ${i + 1} (${OUT_NAME[t]}) : ${b} octets`)
    })
    const weight = 4 * B + W
    const vsize = Math.ceil(weight / 4)
    const rate = rng.int(15, 600) / 10
    const fee = Math.round(rate * vsize)
    const feeRate = Math.round((fee / vsize) * 100) / 100
    const inVals = Array.from({ length: nIn }, () => rng.int(20, 5000) * 1000 + rng.int(0, 999))
    const total = inVals.reduce((a, b) => a + b, 0)
    const avail = total - fee
    const outVals: number[] = []
    let left = avail
    for (let i = 0; i < nOut - 1; i++) {
      const v = Math.max(1000, Math.round((left * rng.float(0.2, 0.6)) / 1000) * 1000)
      outVals.push(v)
      left -= v
    }
    outVals.push(left)
    const visual: DrillVisual = {
      type: 'tx',
      chain: 'btc',
      asset: 'sats',
      inputs: ins.map((t, i) => ({ address: genAddress(rng, 'btc', addrKind(t)), value: inVals[i] })),
      outputs: outs.map((t, i) => ({ address: genAddress(rng, 'btc', addrKind(t)), value: outVals[i] })),
      fee,
    }
    const ctx = `Décomposition fournie par l'explorateur : ${fr(B)} octets hors témoin et ${fr(W)} octets de témoin (taille brute ${fr(B + W)} octets).`
    const calc = `Poids = octets hors témoin × 4 + octets du témoin = ${fr(B)} × 4 + ${fr(W)} = **${fr(weight)} WU**. Taille virtuelle = poids ÷ 4, arrondi à l'entier supérieur = **${fr(vsize)} vB**.`
    const breakdown = `D'où viennent ces octets :\n\n${detail.join('\n')}`
    const why = segwit
      ? `Le témoin ne compte que pour un quart : c'est la remise SegWit, qui rend les entrées SegWit et Taproot moins chères que les entrées Legacy.`
      : `Aucune entrée SegWit : la transaction n'a pas de témoin, son poids vaut exactement 4 × sa taille et sa vsize est égale à sa taille brute.`

    if (variant === 'weight') {
      return {
        prompt: 'Quel est le poids de cette transaction, en unités de poids ?',
        context: ctx,
        visual,
        kind: 'number',
        answer: weight,
        tolerance: 0,
        unit: 'WU',
        explain: `${calc}\n\n${why} Erreur fréquente : multiplier la taille brute par 4 (${fr((B + W) * 4)} WU), ce qui revient à ignorer la remise.\n\n${breakdown}`,
      }
    }
    if (variant === 'vsize') {
      return {
        prompt: 'Quelle est la taille virtuelle (vsize) de cette transaction ?',
        context: ctx,
        visual,
        kind: 'number',
        answer: vsize,
        tolerance: 1.0001 / vsize,
        unit: 'vB',
        explain: `${calc}\n\n${why} C'est la vsize, et non la taille brute (${fr(B + W)} octets), qui compte pour la place dans un bloc et pour le calcul des frais.\n\n${breakdown}`,
      }
    }
    if (variant === 'rate') {
      const naive = Math.round((fee / (B + W)) * 100) / 100
      return {
        prompt: 'Quel taux de frais cette transaction a-t-elle payé ?',
        context: `${ctx} Frais : ${fr(fee)} sats (entrées − sorties).`,
        visual,
        kind: 'number',
        answer: feeRate,
        tolerance: 0.02,
        unit: 'sat/vB',
        explain: `${calc}\n\nTaux de frais = frais ÷ vsize = ${fr(fee)} ÷ ${fr(vsize)} ≈ **${frMax(feeRate, 2)} sat/vB**.${segwit ? ` Diviser par la taille brute donnerait ${frMax(naive, 2)} sat/vB, une sous-estimation : le marché des frais raisonne en vB.` : ''}\n\nLe taux de frais renseigne sur l'urgence et sur le logiciel : un taux rond (1, 2, 5, 10 sat/vB) ou très précis trahit souvent un réglage manuel ou un estimateur particulier, indice d'empreinte de portefeuille.\n\n${breakdown}`,
      }
    }
    const saved = B + W - vsize
    return {
      prompt: 'Combien d\'octets virtuels la remise SegWit fait-elle gagner à cette transaction, par rapport à un comptage où tous ses octets compteraient plein ?',
      context: ctx,
      visual,
      kind: 'number',
      answer: saved,
      tolerance: Math.max(1.0001 / Math.max(saved, 1), 0.001),
      unit: 'vB',
      explain: `${calc}\n\nSans remise, la transaction compterait pour sa taille brute, ${fr(B + W)} vB. Gain : ${fr(B + W)} − ${fr(vsize)} = **${fr(saved)} vB**, soit environ les trois quarts des ${fr(W)} octets de témoin. Au taux de ${frMax(rate, 1)} sat/vB, cela représente près de ${fr(Math.round(saved * rate))} sats d'économie.\n\n${breakdown}`,
    }
  },
}

// ── 3. Sortie porteuse d'une inscription ou de runes ────────────────────────

const RUNES = ['DOG•GO•TO•THE•MOON', 'PUPS•WORLD•PEACE', 'UNCOMMON•GOODS', 'SATOSHI•NAKAMOTO', 'RSIC•GENESIS•RUNE']
const FEES = 'Aucune : le sat inscrit tombe dans les frais et revient au mineur'

/** Sortie qui reçoit le premier sat de l'entrée `k` (ordre premier entré, premier sorti), ou -1 s'il part en frais. */
export function ordinalCarrier(inVals: number[], k: number, outVals: number[]): number {
  const off = inVals.slice(0, k).reduce((a, b) => a + b, 0)
  let acc = 0
  for (let i = 0; i < outVals.length; i++) {
    if (off < acc + outVals[i]) return i
    acc += outVals[i]
  }
  return -1
}

function fifoExplain(inVals: number[], k: number, outVals: number[]): string {
  const off = inVals.slice(0, k).reduce((a, b) => a + b, 0)
  const c = ordinalCarrier(inVals, k, outVals)
  let acc = 0
  const ranges = outVals.map((v, i) => {
    const s = `n° ${i + 1} [${fr(acc)} ; ${fr(acc + v)}[`
    acc += v
    return s
  })
  return `Théorie ordinale : les sats sortent dans l'ordre où ils sont entrés (premier entré, premier sorti). Le sat inscrit est le premier de l'entrée n° ${k + 1} ; il occupe la position ${fr(off)}${k ? ` (somme des valeurs des entrées qui le précèdent)` : ''}. Plages des sorties : ${ranges.join(', ')}. ${c < 0 ? `La position ${fr(off)} dépasse le total des sorties (${fr(acc)} sats) : le sat tombe dans les frais et part chez le mineur avec l'inscription.` : `La position ${fr(off)} tombe dans la sortie **n° ${c + 1}**.`}`
}

export const ordinalCarrierDrill: DrillDef = {
  id: 'ordinal-carrier',
  title: 'Sortie porteuse d\'inscription',
  description: 'Transfert d\'inscription, vente par PSBT, transfert de runes : identifier la sortie qui porte l\'actif (souvent une petite sortie qui ressemble à un rendu) et le vrai rendu.',
  level: 4,
  track: 'bitcoin',
  icon: 'Gem',
  generate(seed) {
    const rng = rngFor(seed, 'ordinal-carrier')
    const template = rng.weighted([['transfer', 3], ['fifo', 2], ['sale', 3], ['runes', 3]] as const)
    const num = rng.int(60_000_000, 79_000_000)
    const rate = rng.int(4, 40)
    const outOpt = (vals: number[], extra: (i: number) => string = () => '') => vals.map((v, i) => `Sortie n° ${i + 1} — ${fr(v)} sats${extra(i)}`)

    if (template === 'runes') {
      const rune = rng.pick(RUNES)
      const held = rng.int(5, 900) * 1000
      const amt = Math.round(held * rng.float(0.1, 0.8))
      const V = rng.int(20, 800) * 1000 + rng.int(0, 999)
      const fee = rate * rng.int(200, 260)
      const payerKind = rng.pick(['p2wpkh', 'p2tr'] as const)
      // Sorties : destinataire, reste des runes, rendu BTC ; l'OP_RETURN en tête ou en queue.
      const roles = rng.shuffle(['dest', 'rest', 'btc'] as const)
      const opFirst = rng.chance(0.4)
      const order = opFirst ? (['op', ...roles] as const) : ([...roles, 'op'] as const)
      const valOf = (r: string) => (r === 'op' ? 0 : r === 'btc' ? 546 + V - fee - 1092 : 546)
      const outVals = order.map(valOf)
      const idx = (r: string) => (order as readonly string[]).indexOf(r)
      const hexOp = '6a5d' + hexs(rng, 12)
      const runeLabel = `Runestone : edict ${rune} × ${fr(amt)} → sortie n° ${idx('dest') + 1} (vout ${idx('dest')}) ; reste (pointer) → sortie n° ${idx('rest') + 1} (vout ${idx('rest')})`
      const visual: DrillVisual = {
        type: 'tx',
        chain: 'btc',
        asset: 'sats',
        inputs: [
          { address: genAddress(rng, 'btc', 'p2tr'), value: 546, label: `${fr(held)} ${rune} (runes)` },
          { address: genAddress(rng, 'btc', payerKind), value: V },
        ],
        outputs: order.map((r) => (r === 'op' ? { address: `OP_RETURN ${hexOp}`, value: 0, label: runeLabel } : { address: genAddress(rng, 'btc', r === 'btc' ? payerKind : 'p2tr'), value: valOf(r) })),
        fee,
      }
      const q = rng.pick(['dest', 'rest', 'btc'] as const)
      const opts = outOpt(outVals, (i) => (order[i] === 'op' ? ' (OP_RETURN)' : ''))
      const correct = opts[idx(q)]
      const { options, answer } = mkChoice(rng, correct, rng.shuffle(opts.filter((o) => o !== correct)), 4)
      const prompts = {
        dest: `Quelle sortie reçoit les ${fr(amt)} ${rune} transférés ?`,
        rest: `Quelle sortie porte le reste des runes (${fr(held - amt)} ${rune}) ?`,
        btc: 'Quelle sortie est le rendu en bitcoins de l\'expéditeur ?',
      }
      return {
        prompt: prompts[q],
        context: 'Transfert de runes. Le message OP_RETURN (runestone) contient les instructions ; les explorateurs numérotent les sorties à partir de 0 (vout), le tableau à partir de 1.',
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `Les runes ne sont pas des sats : ce sont des soldes attachés aux UTXO, déplacés par le runestone (OP_RETURN OP_13…). Ici, l'edict attribue ${fr(amt)} ${rune} à la sortie n° ${idx('dest') + 1} (vout ${idx('dest')}) ; le reste du solde non attribué (${fr(held - amt)} ${rune}) va à la sortie désignée par le pointer, n° ${idx('rest') + 1}. Ces deux sorties de 546 sats — le minimum non « poussière » — sont des **porteuses**, pas des paiements ni du rendu. Le vrai rendu en bitcoins est la sortie n° ${idx('btc') + 1} (${fr(valOf('btc'))} sats), qui revient au type d'adresse ${payerKind === 'p2tr' ? 'Taproot' : 'SegWit'} du payeur.\n\nL'OP_RETURN (0 sat) ne porte rien : il ne fait que transmettre les instructions. Pour l'analyse : une heuristique de rendu naïve prendrait une sortie de 546 sats pour une poussière ou un rendu ; dans une transaction de runes, c'est elle qui porte la valeur. Sans pointer, le reste irait à la première sortie qui n'est pas un OP_RETURN.`,
      }
    }

    if (template === 'sale') {
      const P = rng.chance(0.75) ? 10000 : 546
      const price = rng.int(150, 50000) * 1000
      const mfee = Math.round(price * 0.02)
      const fee = rate * rng.int(420, 520)
      const V = price + mfee + fee + rng.int(20, 3000) * 1000
      const inVals = [600, P, V]
      const change = V - price - mfee - fee
      const outVals = [600, P, price, mfee, change]
      const buyerKind = rng.pick(['p2wpkh', 'p2tr'] as const)
      const visual: DrillVisual = {
        type: 'tx',
        chain: 'btc',
        asset: 'sats',
        inputs: [
          { address: genAddress(rng, 'btc', buyerKind), value: 600 },
          { address: genAddress(rng, 'btc', 'p2tr'), value: P, label: `Inscription n° ${fr(num)} (vendeur)` },
          { address: genAddress(rng, 'btc', buyerKind), value: V },
        ],
        outputs: [
          { address: genAddress(rng, 'btc', buyerKind), value: 600 },
          { address: genAddress(rng, 'btc', 'p2tr'), value: P },
          { address: genAddress(rng, 'btc', rng.pick(['p2wpkh', 'p2tr'] as const)), value: price },
          { address: genAddress(rng, 'btc', 'p2tr'), value: mfee },
          { address: genAddress(rng, 'btc', buyerKind), value: change },
        ],
        fee,
      }
      const q = rng.weighted([['carrier', 3], ['change', 2], ['payout', 1.5]] as const)
      const target = q === 'carrier' ? ordinalCarrier(inVals, 1, outVals) : q === 'change' ? 4 : 2
      const opts = outOpt(outVals)
      const { options, answer } = mkChoice(rng, opts[target], rng.shuffle(opts.filter((_, i) => i !== target)), 4)
      const prompts = {
        carrier: 'Quelle sortie reçoit l\'inscription ?',
        change: 'Quelle sortie est le vrai rendu de l\'acheteur ?',
        payout: 'Quelle sortie paie le vendeur de l\'inscription ?',
      }
      return {
        prompt: prompts[q],
        context: `Vente d'une inscription sur une place de marché, par PSBT signé à deux (le vendeur signe son entrée, l'acheteur complète). Commission de la place de marché : 2 % du prix.`,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `Structure classique d'une vente par PSBT : entrée n° 1 = petite UTXO « tampon » de l'acheteur (600 sats), entrée n° 2 = inscription du vendeur, entrée n° 3 = paiement de l'acheteur ; sorties = tampon rendu à l'acheteur, inscription vers l'acheteur, prix vers le vendeur, commission, rendu de l'acheteur.\n\n${fifoExplain(inVals, 1, outVals)} Le tampon de 600 sats sert précisément à décaler l'inscription en sortie n° 2.\n\nAinsi : sortie n° 2 = **inscription** (${fr(P)} sats, ce n'est pas un rendu) ; sortie n° 3 = **paiement du vendeur** (${fr(price)} sats) ; sortie n° 4 = commission (2 % = ${fr(mfee)} sats) ; sortie n° 5 = **vrai rendu de l'acheteur** (${fr(change)} sats), sur le même type d'adresse que ses entrées n° 1 et 3 ; sortie n° 1 = tampon recréé pour un prochain achat. Une heuristique de rendu classique (petite sortie, type d'adresse) se tromperait ici.`,
      }
    }

    const P = rng.weighted([[10000, 6], [546, 2.5], [330, 1.5]] as const)
    const payerKind = rng.pick(['p2wpkh', 'p2tr'] as const)
    const V = rng.int(15, 600) * 1000 + rng.int(0, 999)

    if (template === 'fifo') {
      const fee = rate * rng.int(180, 240)
      const Y = Math.max(5000, Math.round((V * rng.float(0.3, 0.8)) / 100) * 100)
      const inVals = [V, P]
      const outVals = [Y, V + P - Y - fee]
      const c = ordinalCarrier(inVals, 1, outVals)
      const visual: DrillVisual = {
        type: 'tx',
        chain: 'btc',
        asset: 'sats',
        inputs: [
          { address: genAddress(rng, 'btc', payerKind), value: V },
          { address: genAddress(rng, 'btc', 'p2tr'), value: P, label: `Inscription n° ${fr(num)}` },
        ],
        outputs: [
          { address: genAddress(rng, 'btc', 'p2wpkh'), value: Y },
          { address: genAddress(rng, 'btc', payerKind), value: outVals[1] },
        ],
        fee,
      }
      const opts = [...outOpt(outVals), FEES, 'Elle reste attachée à l\'adresse d\'origine : un portefeuille ordinaire ne peut pas dépenser une inscription']
      const correct = c < 0 ? FEES : opts[c]
      const { options, answer } = mkChoice(rng, correct, rng.shuffle(opts.filter((o) => o !== correct)), 4)
      return {
        prompt: 'Le portefeuille du suspect, qui ne gère pas les inscriptions, a construit ce paiement en piochant dans toutes ses UTXO. Où se trouve l\'inscription après la transaction ?',
        context: `Paiement de ${fr(Y)} sats à un tiers. Frais : ${fr(fee)} sats.`,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${fifoExplain(inVals, 1, outVals)}\n\n${c < 0 ? `Comme les frais (${fr(fee)} sats) dépassent la valeur de l'UTXO inscrite (${fr(P)} sats), le sat inscrit se retrouve au-delà des sorties : l'inscription est perdue au profit du mineur. C'est l'accident classique des portefeuilles « non ordinals-aware » avec de petites UTXO de 546 ou 330 sats.` : `L'inscription n'est plus sur le premier sat d'une sortie : elle a glissé dans le rendu, au milieu de ${fr(outVals[1])} sats. Elle appartient toujours au suspect, mais le prochain paiement depuis cette UTXO risque de la céder par mégarde.`} Une inscription n'a rien de bloquant : pour Bitcoin, l'UTXO qui la porte est une UTXO comme une autre.`,
      }
    }

    // transfer
    const fee = rate * rng.int(160, 220)
    const inVals = [P, V]
    const outVals = [P, V - fee]
    const visual: DrillVisual = {
      type: 'tx',
      chain: 'btc',
      asset: 'sats',
      inputs: [
        { address: genAddress(rng, 'btc', 'p2tr'), value: P, label: `Inscription n° ${fr(num)}` },
        { address: genAddress(rng, 'btc', payerKind), value: V },
      ],
      outputs: [
        { address: genAddress(rng, 'btc', 'p2tr'), value: P },
        { address: genAddress(rng, 'btc', payerKind), value: V - fee },
      ],
      fee,
    }
    const q = rng.chance(0.55) ? 'carrier' : 'change'
    const target = q === 'carrier' ? ordinalCarrier(inVals, 0, outVals) : 1
    const opts = [...outOpt(outVals), FEES, 'Aucune : une transaction qui transfère une inscription n\'a pas de rendu']
    const correct = opts[target]
    const { options, answer } = mkChoice(rng, correct, rng.shuffle(opts.filter((o) => o !== correct)), 4)
    return {
      prompt: q === 'carrier' ? 'Quelle sortie porte l\'inscription après la transaction ?' : 'Quelle sortie est le vrai rendu ?',
      context: `Envoi d'une inscription par un portefeuille compatible ordinals. Frais : ${fr(fee)} sats.`,
      visual,
      kind: 'choice',
      options,
      answer,
      explain: `${fifoExplain(inVals, 0, outVals)}\n\nLe portefeuille place donc l'UTXO inscrite en première entrée et crée une première sortie de même valeur (${fr(P)} sats, le « postage ») : c'est la **sortie n° 1 qui porte l'inscription** et l'envoie au destinataire. Une seconde entrée paie les frais ; son reste revient en **sortie n° 2, le vrai rendu** (${fr(V - fee)} sats), sur le même type d'adresse que l'entrée payeuse.\n\nPiège : une heuristique de rendu naïve verrait dans la petite sortie ronde (${fr(P)} sats) un rendu ou une poussière, alors qu'elle porte l'actif transféré.`,
    }
  },
}

// ── 4. Cardano : regroupement par clé de staking ────────────────────────────

type Grp = 'A' | 'B' | 'C' | 'ent' | 'script'

export const stakeCluster: DrillDef = {
  id: 'stake-cluster',
  title: 'Clés de staking Cardano',
  description: 'Une adresse de base Cardano (addr1q…) contient une partie paiement et une partie staking : regrouper les adresses d\'un même portefeuille, sans se laisser piéger par les adresses enterprise et de script.',
  level: 3,
  track: 'bitcoin',
  icon: 'Network',
  generate(seed) {
    const rng = rngFor(seed, 'stake-cluster')
    const variant = rng.weighted([['set', 3], ['count', 2.5], ['enterprise', 2], ['stake', 1.5]] as const)
    const n = rng.int(4, 6)
    const tails: Record<'A' | 'B' | 'C', string> = { A: cardanoStakeTail(rng), B: cardanoStakeTail(rng), C: cardanoStakeTail(rng) }
    const groups: Grp[] = []
    const same = rng.int(1, Math.min(3, n - (variant === 'enterprise' ? 3 : 2)))
    for (let i = 0; i < same; i++) groups.push('A')
    let room = n - 1 - same
    if ((variant === 'enterprise' || rng.chance(0.5)) && room > 1) {
      groups.push('ent')
      room--
    }
    if (rng.chance(0.35) && room > 1) {
      groups.push('script')
      room--
    }
    groups.push('B')
    room--
    while (room-- > 0) groups.push(rng.chance(0.6) ? 'B' : 'C')
    const list: Grp[] = ['A', ...rng.shuffle(groups)]
    const addrs = list.map((g) => (g === 'ent' ? genAddress(rng, 'ada', 'ada_enterprise') : g === 'script' ? genAddress(rng, 'ada', 'ada_script') : cardanoBase(rng, tails[g])))
    const idxOf = (g: Grp) => list.map((x, i) => (x === g ? i + 1 : 0)).filter(Boolean)
    const A = idxOf('A')
    const ent = idxOf('ent')
    const scr = idxOf('script')
    const bases = list.map((x, i) => (x === 'A' || x === 'B' || x === 'C' ? i + 1 : 0)).filter(Boolean)
    const visual: DrillVisual = { type: 'list', title: 'Adresses Cardano relevées dans le dossier', items: addrs.map((a, i) => `${i + 1}. ${a}`) }
    const stakeA = cardanoStakeAddress(tails.A)
    const ctx = 'Une adresse de base (addr1q…) encode la partie paiement puis la partie staking ; les 6 derniers caractères sont une somme de contrôle.'
    const structure = `Une adresse de base Cardano (addr1q…) contient deux empreintes : la partie **paiement** (qui contrôle la dépense, propre à chaque adresse) puis la partie **staking** (la clé de délégation, commune à toutes les adresses du portefeuille). Encodée en fin d'adresse, la partie staking se retrouve à l'identique juste avant la somme de contrôle de 6 caractères : les adresses ${frList(A.map(String))} partagent ce bloc final, donc la même clé de staking (adresse de récompense ${stakeA.slice(0, 18)}…). Sur des adresses réelles, le premier caractère de ce bloc peut différer, car il mêle des bits des deux parties : on compare la fin, ou mieux l'adresse de récompense stake1… affichée par l'explorateur.`
    const traps = [
      ...ent.map((i) => `l'adresse ${i} (addr1v…) est une adresse « enterprise » : sans partie staking, elle ne se rattache à aucun portefeuille par sa forme`),
      ...scr.map((i) => `l'adresse ${i} (addr1w…) est une adresse de script (contrat Plutus, par exemple un DEX) : elle n'appartient à aucun portefeuille individuel`),
      ...(bases.length > A.length ? [`l'adresse ou les adresses ${frList(bases.filter((i) => !A.includes(i)).map(String))} ont une autre partie staking : autre portefeuille (ou autre compte du même logiciel)`] : []),
    ]
    const caveat = 'Limite : n\'importe qui peut fabriquer une adresse combinant sa propre partie paiement avec la partie staking d\'un tiers (« adresse Frankenstein »). Une partie staking commune est un indice fort, à confirmer par les flux.'

    if (variant === 'count') {
      return {
        prompt: 'Combien de ces adresses appartiennent au même portefeuille que l\'adresse 1 (adresse 1 comprise) ?',
        context: ctx,
        visual,
        kind: 'number',
        answer: A.length,
        tolerance: 0,
        unit: 'adresse(s)',
        explain: `${structure} Réponse : **${A.length}**.\n\nLes autres : ${traps.join(' ; ')}.\n\n${caveat}`,
      }
    }
    if (variant === 'enterprise' && ent.length) {
      const e = ent[0]
      const correct = 'Pas d\'après sa forme : une adresse enterprise n\'a pas de partie staking ; seul un lien transactionnel (entrées communes, flux) pourrait la rattacher'
      const { options, answer } = mkChoice(rng, correct, [
        'Oui : toutes les adresses addr1 relevées chez un même suspect appartiennent au même portefeuille',
        'Non, jamais : un portefeuille ne peut pas utiliser d\'adresse enterprise',
        'Oui : sa fin coïncide avec celle de l\'adresse 1, avant la somme de contrôle',
      ], 4)
      return {
        prompt: `L'adresse ${e} (addr1v…) appartient-elle au même portefeuille que l'adresse 1 ?`,
        context: ctx,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `Le « v » qui suit addr1 désigne une adresse **enterprise** : elle ne contient qu'une partie paiement, sans partie staking. Elle ne peut donc pas être regroupée par clé de staking — et sa fin ne coïncide d'ailleurs pas avec celle de l'adresse 1. Ce n'est pas pour autant une preuve d'absence de lien : exchanges et certains logiciels utilisent des adresses enterprise, et un portefeuille peut en dériver. Il faut alors chercher un lien transactionnel : UTXO dépensées ensemble, aller-retour de fonds, horaires.\n\n${structure}\n\n${caveat}`,
      }
    }
    if (variant === 'stake') {
      const correct = `L'adresse de récompense commune (${stakeA.slice(0, 16)}…), dérivée de la partie staking : l'explorateur liste toutes les adresses de base qui la partagent`
      const { options, answer } = mkChoice(rng, correct, [
        'Le préfixe addr1q, commun à toutes les adresses du portefeuille',
        'La somme de contrôle (6 derniers caractères), identique pour toutes les adresses du portefeuille',
        'La partie paiement de l\'adresse 1, réutilisée à l\'identique par chaque nouvelle adresse',
      ], 4)
      return {
        prompt: 'Pour retrouver toutes les adresses du portefeuille de l\'adresse 1, y compris celles qui ne figurent pas dans cette liste, que faut-il rechercher dans l\'explorateur ?',
        context: ctx,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${structure}\n\nRechercher l'adresse de récompense (stake1…) sur un explorateur comme Cardanoscan donne d'un coup toutes les adresses de base liées, le solde global, l'historique de délégation (pool choisi) et les retraits de récompenses : c'est l'équivalent, sur Cardano, d'un regroupement par xpub.\n\nLe préfixe addr1q est commun à toutes les adresses de base du réseau ; la somme de contrôle change à chaque adresse ; la partie paiement est propre à chaque adresse (c'est ce qui la distingue des autres).\n\n${caveat}`,
      }
    }
    // set
    const lab = (s: number[]) => (s.length === 1 ? 'L\'adresse 1 seule' : `Adresses ${frList([...s].sort((a, b) => a - b).map(String))}`)
    const B = idxOf('B')
    const d = rng.shuffle([
      ...(ent.length ? [lab([...A, ent[0]])] : []),
      ...(scr.length ? [lab([...A, scr[0]])] : []),
      ...(A.length > 1 ? [lab(A.slice(0, -1))] : []),
      lab(bases),
      lab([1, ...B]),
    ])
    // Compléter, si besoin, par d'autres sous-ensembles contenant l'adresse 1.
    const correctLab = lab(A)
    while (new Set(d.filter((x) => x !== correctLab)).size < 3) {
      const sub = [1, ...list.map((_, i) => i + 1).slice(1).filter(() => rng.chance(0.5))]
      d.push(lab(sub))
    }
    const { options, answer } = mkChoice(rng, correctLab, d, 4)
    return {
      prompt: 'Lesquelles de ces adresses appartiennent au même portefeuille que l\'adresse 1 ?',
      context: ctx,
      visual,
      kind: 'choice',
      options,
      answer,
      explain: `${structure} Réponse : **${lab(A).toLowerCase()}**.\n\nPièges : ${traps.join(' ; ')}.\n\n${caveat}`,
    }
  },
}
