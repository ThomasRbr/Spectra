import { World, type Tx } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import { inscribe, marketplace, POSTAGE, RUNE_DUST, type Inscription } from '../engine/ordinals'
import { keccak256 } from '../engine/keccak'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const sat = (n: number) => Math.round(n) / 1e8
const btc = (v: number) => amt(r8(v), 'BTC')
const sats = (v: number) => `${Math.round(v * 1e8).toLocaleString('fr-FR')} sats`

const RUNES = ['PHARE•DE•MINUIT', 'HIBOU•DES•DUNES', 'CORSAIRE•ORANGE', 'GOELAND•DORE']
const COLLECTIONS = [
  { name: 'Hiboux du Néant', kind: 'pixel art de 24 × 24 pixels', type: 'image/webp' },
  { name: 'Marées Numériques', kind: 'illustration générative', type: 'image/webp' },
  { name: 'Les Petits Automates', kind: 'pixel art animé', type: 'image/gif' },
]

/**
 * Date de l'affaire : après le lancement des Runes (avril 2024), calculée
 * depuis la graine (déterministe).
 */
function caseStart(seed: number): number {
  const s = Math.abs(Math.trunc(seed))
  return 1704067200 + (150 + (s % 560)) * 86400 + (8 + (s % 12)) * 3600 + (s % 3000)
}

export const btcOrdinalsVol: ScenarioTemplate = {
  id: 'ordinals-vol',
  title: 'L\'inscription volée',
  tagline: 'Une fausse demande de signature, deux inscriptions et des runes envolées, revendues sur une place de marché.',
  description:
    'Une collectionneuse signe ce qu\'elle croit être une vérification d\'annonce : deux inscriptions ordinales et son solde de runes partent vers le voleur, qui revend les inscriptions par PSBT sur la place de marché Ordinalia avant de déposer le produit sur une plateforme. Suivez les satoshis qui portent les inscriptions, lisez les ventes (sortie tampon, prix, commission) et ne confondez pas les petites sorties avec des rendus.',
  difficulty: 4,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'change', 'cioh', 'exchange_id', 'typologies'],
  estMinutes: 50,
  lessons: ['ordinals-runes', 'bitcoin-moderne', 'change-heuristics'],
  generate(seed) {
    const w = new World(seed, caseStart(seed))
    const r = w.rng
    const T = w.at(0)
    const vic = fakePerson(r, 'f')
    const city = fakeCity(r)
    const handle = fakeHandle(r)
    const RUNE = r.pick(RUNES)
    const COL = r.pick(COLLECTIONS)
    const exKey = r.pick(['binance', 'kraken', 'okx', 'coinbase'] as const)

    const victimE = w.customEntity({ name: vic.name, category: 'victim' })
    const artistE = w.customEntity({ name: `Artiste de la collection « ${COL.name} »`, category: 'individual' })
    const thiefE = w.customEntity({ name: 'Voleur d\'inscriptions (non identifié)', category: 'suspect' })
    const buyerAE = w.customEntity({ name: 'Acheteur de bonne foi (inscription A)', category: 'individual' })
    const buyerBE = w.customEntity({ name: 'Acheteur de bonne foi (inscription B)', category: 'individual' })
    const mk = marketplace(w, 'ordinalia')
    const ex = exchange(w, exKey, 'btc')

    // ── Portefeuille de la collectionneuse : adresse ordinals + adresse de paiement ──
    const VW = 'wallet:collectionneuse'
    const vOrd = w.addr('btc', { kind: 'p2tr', entity: victimE, wallet: VW })
    const vPay = w.addr('btc', { kind: 'p2sh', entity: victimE, wallet: VW })

    // Inscription A : créée par un artiste, achetée par la victime sur Ordinalia
    const artistPay = w.addr('btc', { kind: 'p2wpkh', entity: artistE, wallet: 'wallet:artiste' })
    const artistOrd = w.addr('btc', { kind: 'p2tr', entity: artistE, wallet: 'wallet:artiste' })
    const numA = r.int(10, 999)
    const insA = inscribe(w, { owner: artistPay, content: `Image (${COL.type}) : « ${COL.name} » n° ${numA}, ${COL.kind}`, contentType: COL.type, size: r.int(9000, 48000), time: T - r.int(200, 380) * DAY, recipient: artistOrd })
    const pA0 = r8(roundCoin(w, 0.04, 0.2, 0.001))
    const buyA0 = mk.sell({ ins: insA, seller: artistOrd, sellerPayout: artistPay, buyer: vPay, buyerReceive: vOrd, price: pA0, time: T - r.int(60, 150) * DAY })

    // Inscription B : créée par la victime elle-même (ses propres œuvres)
    const numB = r.int(1, 64)
    const insB = inscribe(w, { owner: vPay, content: `Image (image/png) : « Phares d'Armor » n° ${numB}, photographie retouchée de ${vic.name}`, contentType: 'image/png', size: r.int(30000, 120000), time: T - r.int(20, 45) * DAY, recipient: vOrd })

    // Runes : achetées à un particulier, déposées sur l'adresse ordinals
    const runeAmt = r.int(40, 480) * 1000
    const runeSeller = w.addr('btc', { kind: 'p2tr' })
    const runeIn = w.utxoTx({ time: T - r.int(5, 15) * DAY, from: [runeSeller], to: [{ address: vOrd, value: RUNE_DUST }], tags: ['runes'] })
    const runeInCarrier = runeIn.outputs.find((o) => o.address === vOrd)!.n
    runeIn.opReturn = { protocol: 'runes', hex: '6a5d' + keccak256(`runestone:${runeIn.hash}`).slice(0, 24), text: `Runestone : edict ${RUNE} × ${runeAmt.toLocaleString('fr-FR')} → sortie ${runeInCarrier}` }
    runeIn.ord = { kind: 'rune-transfer', rune: RUNE, runeAmount: runeAmt, carrier: runeInCarrier }
    w.fund(vPay, roundCoin(w, 0.003, 0.012, 0.0005), T - r.int(1, 4) * DAY)

    // ── Le vol : trois transactions signées depuis le faux site « Ordinalia » ─
    const TW1 = 'wallet:voleur-1'
    const TW2 = 'wallet:voleur-2'
    const tA = w.addr('btc', { kind: 'p2tr', entity: thiefE, wallet: TW1 })
    const tB = w.addr('btc', { kind: 'p2tr', entity: thiefE, wallet: TW2 })
    const tR = w.addr('btc', { kind: 'p2tr', entity: thiefE, wallet: TW1 })
    const P1 = w.addr('btc', { kind: 'p2wpkh', entity: thiefE, wallet: TW1 })
    const P2 = w.addr('btc', { kind: 'p2wpkh', entity: thiefE, wallet: TW2 })

    /** Transaction piégée : l'UTXO de l'inscription (ou des runes) en entrée 0, frais payés par l'adresse de paiement de la victime. */
    const drain = (time: number, to: string, value: number, carrierValue?: number): Tx => {
      const payIn = w.unspentValue(vPay, time)
      const fee = sat(r.int(8, 25) * 215)
      const tx = w.rawUtxoTx({ time, spend: [{ address: vOrd, value: carrierValue }, { address: vPay }], outputs: [{ address: to, value }, { address: vPay, value: r8(payIn - fee) }], keepOrder: true })
      tx.fp = { version: 2, locktime: 0, rbf: true }
      return tx
    }
    const steal = (ins: Inscription, time: number, to: string): Tx => {
      const tx = drain(time, to, POSTAGE, POSTAGE)
      tx.tags.push('inscription-transfer')
      tx.ord = { kind: 'transfer', id: ins.id, number: ins.number, carrier: 0 }
      ins.holder = to
      return tx
    }
    const theftA = steal(insA, T, tA)
    const theftB = steal(insB, T + r.int(2, 6) * 60, tB)
    if (theftA.inputs[0].prev?.tx !== buyA0.tx.id || theftB.inputs[0].prev?.tx !== insB.reveal.id) throw new Error('ordinals-vol : mauvaise UTXO dépensée')
    const runeT = theftB.time + r.int(2, 6) * 60
    const runeTx = drain(runeT, tR, RUNE_DUST)
    runeTx.tags.push('runes')
    runeTx.opReturn = { protocol: 'runes', hex: '6a5d' + keccak256(`runestone:${runeTx.hash}`).slice(0, 24), text: `Runestone : edict ${RUNE} × ${runeAmt.toLocaleString('fr-FR')} → sortie 0` }
    runeTx.ord = { kind: 'rune-transfer', rune: RUNE, runeAmount: runeAmt, carrier: 0 }

    // ── Reventes sur Ordinalia (deux comptes, deux portefeuilles) ────────────
    const buyerA = w.addr('btc', { kind: 'p2wpkh', entity: buyerAE, wallet: 'wallet:acheteurA' })
    const buyerB = w.addr('btc', { kind: 'p2wpkh', entity: buyerBE, wallet: 'wallet:acheteurB' })
    const pA = r8(roundCoin(w, 0.08, 0.32, 0.001))
    const pB = r8(roundCoin(w, 0.02, 0.07, 0.001))
    const saleA = mk.sell({ ins: insA, seller: tA, sellerPayout: P1, buyer: buyerA, price: pA, time: T + Math.round(r.float(5, 30) * HOUR) })
    const saleB = mk.sell({ ins: insB, seller: tB, sellerPayout: P2, buyer: buyerB, price: pB, time: T + Math.round(r.float(1.5, 4) * DAY) })

    // ── Consolidation des deux produits de vente et dépôt sur la plateforme ──
    const consT = saleB.tx.time + Math.round(r.float(0.8, 3) * DAY)
    const exDep = w.addr('btc', { entity: ex.entity, label: `${ex.entity.name} — Adresse de dépôt`, tags: ['deposit'], kind: 'p2wpkh' })
    const consFee = sat(r.int(6, 22) * (11 + 68 * 2 + 31 * 2))
    const consIn = r8(pA + pB)
    const deposit = r8(Math.floor((consIn - consFee) * r.float(0.82, 0.93) * 200) / 200)
    const P3 = w.addr('btc', { kind: 'p2wpkh', entity: thiefE, wallet: TW1 })
    const cons = w.utxoTx({ time: consT, from: [P1, P2], to: [{ address: exDep, value: deposit }], change: P3, fee: consFee, spendAll: true })
    cons.fp = { version: 2, locktime: 0, rbf: true }
    const sweep = ex.sweep([exDep], consT + Math.round(r.float(1, 8) * HOUR))[0]
    const kept = cons.outputs.find((o) => o.address === P3)?.value ?? 0

    // ── Bruit : autres ventes sur Ordinalia, activité de la plateforme ───────
    for (let i = 0; i < r.int(3, 5); i++) {
      const own = w.addr('btc', { kind: 'p2wpkh' })
      const ordA = w.addr('btc', { kind: 'p2tr', wallet: w.get(own).wallet })
      const t0 = T - r.int(10, 90) * DAY
      const ins = inscribe(w, { owner: own, content: `Image (image/webp) : « ${r.pick(COLLECTIONS).name} » n° ${r.int(1000, 4999)}`, contentType: 'image/webp', size: r.int(5000, 40000), time: t0, recipient: ordA })
      mk.sell({ ins, seller: ordA, sellerPayout: own, buyer: w.addr('btc', { kind: 'p2wpkh' }), price: roundCoin(w, 0.01, 0.2, 0.001), time: T + Math.round(r.float(-2, 5) * DAY) })
    }
    ex.noise(12, T - 3 * DAY, consT + 5 * DAY)

    // ── Textes ───────────────────────────────────────────────────────────────
    const saleAOut = saleA.tx.outputs
    const name = ex.entity.name
    const fA = saleA.fee
    const otherSaleRef = saleB.tx.hash.slice(0, 12)

    return {
      world: w,
      title: `Inscriptions volées — ${city}`,
      briefing:
        `${vic.name}, collectionneuse d'inscriptions ordinales demeurant à ${city}, a été contactée sur Discord par un prétendu « support Ordinalia » : ses annonces devaient être « re-vérifiées » après une mise à jour de la place de marché. Sur le site indiqué, elle a signé trois demandes que son portefeuille présentait comme des transactions partiellement signées (PSBT). Quelques minutes plus tard, deux inscriptions et tout son solde de runes avaient quitté son adresse.\n\n` +
        `Une inscription vit sur un satoshi précis : le premier satoshi de la sortie qui la porte, souvent une petite sortie de 10 000 sats. Elle suit ce satoshi d'entrée en sortie (premier entré, premier sorti). Les runes, elles, sont des soldes attachés aux UTXO et déplacés par un message OP_RETURN (« runestone »). Pour l'enquêteur, ces petites sorties sont des envois d'actifs, jamais des rendus.\n\n` +
        `Votre mission : identifier les transactions du vol, suivre les inscriptions jusqu'à leur revente sur Ordinalia, lire chaque vente (acheteur, prix, adresse qui encaisse, commission), quantifier les runes volées, puis remonter le produit des ventes jusqu'à la plateforme où il est déposé.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: T + r.int(1, 2) * DAY, author: vic.name,
          body:
            `« Mon adresse ordinals (Taproot) est ${A(w, vOrd)}. J'y détenais :\n` +
            `- une inscription de la collection « ${COL.name} » (n° ${numA}), achetée sur Ordinalia. Son identifiant est ${insA.id} (la partie avant « i0 » est le hash de la transaction de révélation : ${insA.reveal.hash}) ;\n` +
            `- une de mes propres œuvres, « Phares d'Armor » n° ${numB}, inscription n° ${insB.number.toLocaleString('fr-FR')} ;\n` +
            `- un solde de runes ${RUNE}, je ne sais plus exactement combien.\n\n` +
            `Le ${fmtDate(T)}, j'ai signé les trois demandes du faux support. Mes frais ont été prélevés sur mon adresse de paiement ${A(w, vPay)}. Depuis, l'adresse ordinals est vide. »`,
        },
        {
          id: 'discord', type: 'capture', title: 'Capture de la conversation Discord', date: T - r.int(1, 3) * HOUR,
          body:
            `@ordinalia_support_${handle} (compte créé la veille) :\n` +
            `« Bonjour ! Suite à la migration de nos contrats d'annonce, vos inscriptions risquent d'être délistées. Merci de valider vos annonces sur ordinalia-verify (lien) : votre portefeuille vous demandera 3 signatures, c'est normal, aucun frais ne sera débité 🙏 »\n\n` +
            `[${vic.name}] « C'est fait, j'ai signé les trois. »\n` +
            `[@ordinalia_support_${handle}] « Parfait, merci ! »  (compte supprimé une heure plus tard)`,
        },
        {
          id: 'ordinalia', type: 'email', title: 'Réponse d\'Ordinalia à la réquisition (extrait)', date: T + r.int(8, 15) * DAY, author: 'Service conformité d\'Ordinalia',
          body:
            `Les deux inscriptions signalées ont été mises en vente puis vendues par deux comptes distincts, créés le ${fmtDate(T, false)} avec des adresses e-mail jetables et des connexions via un VPN commercial. Chaque compte avait connecté un portefeuille différent.\n\n` +
            `Ordinalia ne détient aucun fonds : les ventes sont réglées dans une transaction unique, signée en partie par le vendeur puis complétée par l'acheteur. La commission de la plateforme (2 % du prix) y figure. Nous ne pouvons ni geler ni annuler une vente.`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe — inscriptions et runes', date: T + r.int(2, 4) * DAY, author: 'Chef de groupe — Section de recherches',
          body:
            `• La carte « Inscription » d'une transaction donne l'identifiant, le numéro, le type de contenu et la sortie qui porte l'inscription.\n` +
            `• Une vente par PSBT réunit dans une seule transaction l'acheteur, le vendeur et la place de marché. Les petites sorties (600, 546 ou 10 000 sats) ne sont ni des prix ni des rendus : lisez la carte avant d'appliquer une heuristique de rendu.\n` +
            `• Les runes n'apparaissent que dans le runestone (sortie OP_RETURN) : c'est lui qui dit combien d'unités vont à quelle sortie.\n` +
            `• Un voleur qui utilise deux portefeuilles finit souvent par les réunir pour encaisser : surveillez les entrées communes.`,
        },
      ],
      seeds: [vOrd],
      objectives: [
        {
          id: 'o1', type: 'tx', points: 8,
          prompt: `Quelle transaction a fait sortir l'inscription « ${COL.name} » n° ${numA} de l'adresse de la victime ?`,
          answer: [theftA.id],
          hint: 'Parmi les dépenses de l\'adresse ordinals du ' + fmtDate(T, false) + ', cherchez la carte « Transfert d\'inscription » qui porte l\'identifiant cité dans la plainte.',
          explanation: `${theftA.hash.slice(0, 16)}… dépense en entrée 0 l'UTXO de 10 000 sats qui porte l'inscription, et en entrée 1 l'adresse de paiement de la victime pour les frais. L'inscription suit son satoshi vers la sortie 0 (${sats(POSTAGE)}) : ${A(w, tA)}. La sortie 1, vers l'adresse de paiement, est le rendu des frais de la victime. C'est la structure d'un transfert d'inscription « propre », obtenu ici par une signature extorquée.`,
        },
        {
          id: 'o2', type: 'number', points: 6,
          prompt: 'Quel est le numéro de cette inscription ?',
          answer: insA.number,
          hint: 'La carte « Inscription » de la transaction de vol (ou de sa révélation) affiche l\'identifiant suivi du numéro.',
          explanation: `Inscription n° ${insA.number.toLocaleString('fr-FR')}, identifiant ${insA.id.slice(0, 16)}…i0. Le numéro donne l'ordre de création de l'inscription ; l'identifiant, lui, renvoie à la transaction de révélation qui l'a créée. Les deux servent à la désigner sans ambiguïté dans une réquisition ou un signalement aux places de marché.`,
        },
        {
          id: 'o3', type: 'tx', points: 10,
          prompt: `La plaignante ne connaît que le numéro de sa propre œuvre (n° ${insB.number.toLocaleString('fr-FR')}). Quelle transaction a créé (révélé) cette inscription ?`,
          answer: [insB.reveal.id],
          hint: 'Trouvez le transfert d\'inscription dont la carte porte ce numéro. Son entrée 0 est l\'UTXO de l\'inscription : remontez à la transaction d\'origine de cette entrée, qui doit afficher la carte « Révélation ».',
          explanation: `L'identifiant de l'inscription n° ${insB.number.toLocaleString('fr-FR')} est ${insB.id.slice(0, 16)}…i0 : elle a été révélée par ${insB.reveal.hash.slice(0, 16)}…, qui dépense par script une adresse Taproot de commit (témoin : enveloppe « OP_FALSE OP_IF "ord" … » contenant l'image) et dépose l'inscription sur la sortie 0, l'adresse ordinals de la victime. C'est la preuve on-chain que la plaignante en est la créatrice et la détentrice d'origine.`,
        },
        {
          id: 'o4', type: 'address', points: 8,
          prompt: `Sur Ordinalia, à quelle adresse l'acheteur reçoit-il l'inscription « ${COL.name} » n° ${numA} ?`,
          answer: [saleA.receive],
          hint: 'Suivez la sortie 0 du vol : elle est dépensée par une vente (carte « Vente d\'inscription »). L\'inscription y est portée par la sortie 1.',
          explanation: `Dans la vente ${saleA.tx.hash.slice(0, 12)}…, la petite entrée « tampon » de l'acheteur (600 sats) passe en premier : elle ressort en sortie 0, et le satoshi de l'inscription, deuxième entrée, atterrit au début de la sortie 1 (${sats(saleAOut[1].value)}) : ${A(w, saleA.receive)}. Cet acheteur est a priori de bonne foi ; il est néanmoins détenteur d'un bien volé, ce qui intéresse la restitution.`,
        },
        {
          id: 'o5', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.0005,
          prompt: 'À quel prix (en BTC, versé au vendeur) l\'inscription a-t-elle été revendue ?',
          answer: pA,
          hint: 'La carte de la vente indique le « prix payé au vendeur » ; il correspond à l\'une des sorties.',
          explanation: `${btc(pA)} sont versés au vendeur (sortie 2). La commission d'Ordinalia, ${btc(fA)} (2 %), part vers l'adresse de commissions de la place de marché (sortie 3), et la dernière sortie est le rendu de l'acheteur. L'acheteur a donc payé ${btc(r8(pA + fA))} hors frais de réseau.`,
        },
        {
          id: 'o6', type: 'address', points: 10,
          prompt: 'Quelle adresse encaisse le prix de cette vente ?',
          answer: [P1],
          hint: 'C\'est la sortie dont le montant est égal au prix affiché par la carte.',
          explanation: `${A(w, P1)} (SegWit natif) reçoit ${btc(pA)}. Ce n'est pas l'adresse Taproot qui détenait l'inscription : comme la plupart des portefeuilles d'ordinals, celui du voleur sépare l'adresse qui garde les inscriptions de l'adresse de paiement. L'annonce d'Ordinalia associe pourtant les deux, ce qui les rattache au même compte.`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
          prompt: 'Dans cette vente, que représente la sortie 1 de 10 000 sats ?',
          ...choice(r,
            'Elle porte l\'inscription vers l\'acheteur : ce n\'est ni le prix ni un rendu, malgré son montant non rond et son adresse neuve',
            [
              'C\'est le rendu du vendeur, puisque son montant est petit et que l\'adresse est neuve',
              'C\'est la commission d\'Ordinalia, toujours fixée à 10 000 sats',
              'C\'est la sortie tampon de l\'acheteur, qui sert seulement à payer les frais',
            ]),
          hint: 'La carte de la vente indique quelle sortie porte l\'inscription. Comparez avec l\'analyse de rendu affichée sous cette sortie.',
          explanation: `La sortie 1 reçoit le premier satoshi de l'inscription : elle transporte l'actif vendu. Les heuristiques de rendu classiques (montant non rond, adresse neuve, petite valeur) pourraient la désigner à tort ; l'outil la pénalise justement parce qu'elle porte l'inscription. La sortie 0 (600 sats) est la sortie tampon de l'acheteur, qui revient à son portefeuille et sert à placer l'inscription en sortie 1. Lire une transaction d'ordinals sans ces repères, c'est suivre une fausse piste.`,
        },
        {
          id: 'o8', type: 'number', points: 10, unit: RUNE,
          prompt: `Combien d'unités de la rune ${RUNE} ont été volées ?`,
          answer: runeAmt,
          hint: 'La troisième transaction signée par la victime porte un runestone (sortie OP_RETURN) : lisez son « edict ».',
          explanation: `Le runestone de ${runeTx.hash.slice(0, 12)}… attribue ${runeAmt.toLocaleString('fr-FR')} ${RUNE} à la sortie 0, ${A(w, tR)}. Aucun montant de rune n'apparaît dans les valeurs en bitcoins : seule la sortie OP_RETURN (0 BTC) porte l'instruction. Le chiffre concorde avec le runestone de la transaction par laquelle la victime avait reçu ses runes (${runeIn.hash.slice(0, 12)}…).`,
        },
        {
          id: 'o9', type: 'choice', points: 8,
          prompt: 'Dans le vol des runes, quel est le rôle de la sortie de 546 sats ?',
          ...choice(r,
            'Elle porte les runes vers le voleur (désignée par le runestone) : un envoi d\'actif, pas un rendu ni de la « poussière » sans intérêt',
            [
              'C\'est de la poussière (dust) laissée par le portefeuille : on peut l\'ignorer',
              'C\'est le rendu de la victime, la sortie la plus petite étant toujours le rendu',
              'C\'est la commission du faux site de vérification',
            ]),
          hint: 'Rapprochez le numéro de sortie cité par le runestone de la sortie de 546 sats.',
          explanation: `546 sats est le seuil de poussière d'une sortie SegWit : c'est la valeur minimale qu'on donne à une sortie dont l'intérêt n'est pas son montant en bitcoins mais ce qu'elle porte. Ici, ${runeAmt.toLocaleString('fr-FR')} unités de ${RUNE}. Les runes y sont toujours : ${A(w, tR).slice(0, 14)}… n'a pas été dépensée, ce qui permet de signaler l'UTXO aux places de marché.`,
        },
        {
          id: 'o10', type: 'tx', points: 10,
          prompt: 'Quelle transaction réunit le produit des deux ventes ?',
          answer: [cons.id],
          hint: 'Suivez l\'adresse qui encaisse le prix de la première vente : elle est dépensée avec une autre adresse.',
          explanation: `${cons.hash.slice(0, 16)}… dépense ensemble ${A(w, P1).slice(0, 14)}… (prix de la vente A) et ${A(w, P2).slice(0, 14)}… (prix de la vente B, ${btc(pB)}, transaction ${otherSaleRef}…). Les deux comptes Ordinalia « distincts », avec leurs portefeuilles différents, sont ainsi rattachés au même opérateur par l'heuristique des entrées communes : la précaution du voleur est annulée au moment d'encaisser.`,
        },
        {
          id: 'o11', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme le produit des ventes est-il déposé ?',
          answer: [exKey],
          hint: 'Une sortie de la transaction qui réunit les deux ventes est étiquetée « Adresse de dépôt ».',
          explanation: `${btc(deposit)} partent vers une adresse de dépôt ${name}, balayée ensuite vers son hot wallet ; ${btc(kept)} restent en rendu sur ${A(w, P3).slice(0, 14)}…. ${procedureFor(ex.entity)}`,
        },
        {
          id: 'o12', type: 'address', points: 6,
          prompt: 'Quelle adresse de dépôt citerez-vous dans la réquisition adressée à cette plateforme ?',
          answer: [exDep],
          hint: 'C\'est la sortie au montant rond de la transaction de consolidation.',
          explanation: `${A(w, exDep)} reçoit ${btc(deposit)} le ${fmtDate(consT)} (transaction ${cons.hash.slice(0, 12)}…). Une adresse de dépôt est propre à un client : avec le hash et le montant, elle suffit à la plateforme pour identifier le compte, son KYC, ses adresses IP et ses retraits.`,
        },
      ],
      truth: {
        path: [theftA.id, theftB.id, runeTx.id, saleA.tx.id, saleB.tx.id, cons.id, sweep.id, insA.reveal.id, buyA0.tx.id, insB.commit.id, insB.reveal.id, runeIn.id],
        addresses: [P1, P2, tA, tB, tR, P3, exDep, saleA.receive, saleB.receive],
        debrief:
          `1. Contexte : l'inscription « ${COL.name} » n° ${numA} (n° d'inscription ${insA.number.toLocaleString('fr-FR')}) avait été achetée par la victime sur Ordinalia pour ${btc(pA0)} ; sa propre œuvre (n° ${insB.number.toLocaleString('fr-FR')}) avait été révélée par ${insB.reveal.hash.slice(0, 12)}… ; ${runeAmt.toLocaleString('fr-FR')} ${RUNE} reposaient sur une sortie de 546 sats.\n` +
          `2. Le ${fmtDate(T)}, trois transactions signées sur le faux site déplacent chaque UTXO en entrée 0 vers une sortie 0 du voleur : ${A(w, tA).slice(0, 14)}…, ${A(w, tB).slice(0, 14)}… (inscriptions, 10 000 sats) et ${A(w, tR).slice(0, 14)}… (runes, 546 sats). La victime paie les frais ; son rendu revient vers son adresse de paiement.\n` +
          `3. Deux comptes Ordinalia revendent les inscriptions par PSBT : ${btc(pA)} encaissés sur ${A(w, P1).slice(0, 14)}… et ${btc(pB)} sur ${A(w, P2).slice(0, 14)}…, commission de 2 % à la place de marché ; les inscriptions partent chez deux acheteurs.\n` +
          `4. ${cons.hash.slice(0, 12)}… réunit les deux produits (entrées communes), dépose ${btc(deposit)} chez ${name} sur ${A(w, exDep).slice(0, 14)}… et garde ${btc(kept)}.\n\n` +
          `À retenir : une inscription ou une rune se suit à la sortie qui la porte, pas au montant. Les petites sorties (10 000, 600, 546 sats) sont des envois d'actifs ou des sorties techniques : appliquer à l'aveugle les heuristiques de rendu mène à de fausses pistes. Les places de marché non custodiales ne peuvent rien geler, mais elles relient l'adresse qui détient l'inscription à celle qui encaisse ; et le voleur qui multiplie les comptes se trahit dès qu'il consolide pour passer par une plateforme régulée.`,
      },
      hints: [
        'Partez de l\'adresse ordinals de la plainte : trois dépenses le même jour, chacune avec une carte (transfert d\'inscription ou de runes).',
        'Dans un transfert d\'inscription, l\'UTXO qui porte l\'inscription est l\'entrée 0 et la sortie 0 la reçoit.',
        'Suivez la sortie 0 du vol (bouton « transaction de dépense ») : la vente Ordinalia la dépense. Lisez la carte de vente avant les montants.',
        'Les runes ne se lisent que dans la sortie OP_RETURN (runestone).',
        'L\'adresse qui encaisse le prix de la première vente mène à une transaction qui réunit les deux ventes, puis à une adresse de dépôt.',
      ],
    }
  },
}
