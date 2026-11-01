import { World, type Tx } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import { inscribe, marketplace, runeMint, sendInscription, POSTAGE, RUNE_DUST, type Inscription } from '../engine/ordinals'
import { decoyBranches, dusting, personalSpending, priorHistory, twinTransfers, type Branch } from '../engine/realism'
import { keccak256 } from '../engine/keccak'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, forwardAll, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const sat = (n: number) => Math.round(n) / 1e8
const btc = (v: number) => amt(r8(v), 'BTC')
const sats = (v: number) => `${Math.round(v * 1e8).toLocaleString('fr-FR')} sats`
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const short = (w: World, id: string) => `${A(w, id).slice(0, 14)}…`
const hm = (ts: number) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
const day = (ts: number) => fmtDate(ts, false)
/** « le 3 mai 2025 entre 14:02 et 14:40 », ou deux dates si la fenêtre passe minuit. */
const span = (a: number, b: number) => (day(a) === day(b) ? `le ${day(a)} entre ${hm(a)} et ${hm(b)}` : `entre le ${day(a)} à ${hm(a)} et le ${day(b)} à ${hm(b)}`)
/** Même jour, heure de service (8 h–18 h, heure de Paris) : pour les pièces de procédure. */
const office = (ts: number) => Math.floor(ts / DAY) * DAY + 7 * HOUR + (Math.abs(Math.round(ts)) % (9 * HOUR))

const RUNES = ['PHARE•DE•MINUIT', 'HIBOU•DES•DUNES', 'CORSAIRE•ORANGE', 'GOELAND•DORE']
const MINT_RUNES = ['TRESOR•DES•ABYSSES', 'CHAT•QUANTIQUE', 'LUNE•DE•CUIVRE']
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
  tagline: 'Un drainer d\'ordinals, des ventes PSBT jumelles, des branches de diversion et des transferts en miroir.',
  description:
    'Une collectionneuse signe ce qu\'elle croit être une vérification d\'annonce : deux inscriptions ordinales et son solde de runes partent vers un voleur récidiviste, qui revend les inscriptions par PSBT sur Ordinalia au milieu d\'autres ventes de la même collection. Suivez les satoshis qui portent les inscriptions, isolez la bonne vente, recensez les autres victimes encaissées sur la même adresse, puis triez les branches de diversion et les transferts jumeaux jusqu\'à la plateforme où le produit est déposé.',
  difficulty: 4,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'change', 'cioh', 'exchange_id', 'typologies'],
  estMinutes: 80,
  lessons: ['ordinals-runes', 'bitcoin-moderne', 'change-heuristics'],
  generate(seed) {
    const w = new World(seed, caseStart(seed))
    const r = w.rng
    const T = w.at(0)
    const vic = fakePerson(r, 'f')
    const city = fakeCity(r)
    const handle = fakeHandle(r)
    const RUNE = r.pick(RUNES)
    const MINT = r.pick(MINT_RUNES)
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
    const insB = inscribe(w, { owner: vPay, content: `Image (image/png) : « Phares d'Armor » n° ${numB}, photographie retouchée ${de(vic.name)}`, contentType: 'image/png', size: r.int(30000, 120000), time: T - r.int(20, 45) * DAY, recipient: vOrd })

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
    const TW3 = 'wallet:voleur-bureau'
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

    // ── Regroupement des deux ventes sur une adresse d'un troisième portefeuille ──
    // Flux réel construit AVANT tout habillage : les UTXO ajoutées ensuite aux
    // adresses du voleur ne sont pas emportées par les dépenses « totales ».
    const consT = saleB.tx.time + Math.round(r.float(0.8, 3) * DAY)
    const H = w.addr('btc', { kind: 'p2wpkh', entity: thiefE, wallet: TW3 })
    const consFee = sat(r.int(6, 22) * (11 + 68 * 2 + 31))
    const consIn = r8(w.unspentValue(P1, consT) + w.unspentValue(P2, consT))
    const cons = w.utxoTx({ time: consT, from: [P1, P2], to: [{ address: H, value: r8(consIn - consFee) }], fee: consFee, change: null, spendAll: true })
    cons.fp = { version: 2, locktime: 0, rbf: true }
    const consOut = r8(consIn - consFee)

    // Branches de diversion depuis H (avant la vraie continuation)
    const tBr = consT + Math.round(r.float(2, 8) * HOUR)
    // (une branche par appel, à horodatages croissants : chaque branche dépense le rendu de la précédente)
    const branches: Branch[] = []
    let bt = tBr
    for (let i = 0; i < 3; i++) {
      branches.push(...decoyBranches(w, H, { time: bt, share: r.float(0.1, 0.16), branches: 1, entity: thiefE, returnTo: P1 }))
      bt += r.int(8, 45) * 60
    }
    const lastBranchT = Math.max(...branches.map((b) => b.tx.time))
    // Vraie continuation : H est vidée vers K (une seule sortie)
    const K = w.addr('btc', { kind: 'p2wpkh', entity: thiefE, wallet: TW3 })
    const tK = lastBranchT + Math.round(r.float(3, 9) * HOUR)
    const realTx = forwardAll(w, H, K, tK)
    const vK = realTx.outputs[0].value
    // Dépôt sur la plateforme depuis K, rendu sur P3
    const depT = tK + Math.round(r.float(6, 30) * HOUR)
    const exDep = w.addr('btc', { entity: ex.entity, label: `${ex.entity.name} — Adresse de dépôt`, tags: ['deposit'], kind: 'p2wpkh' })
    const P3 = w.addr('btc', { kind: 'p2wpkh', entity: thiefE, wallet: TW3 })
    const deposit = r8(Math.floor(vK * r.float(0.8, 0.92) * 200) / 200)
    const depTx = w.utxoTx({ time: depT, from: [K], to: [{ address: exDep, value: deposit }], change: P3 })
    const sweep = ex.sweep([exDep], depT + Math.round(r.float(1, 8) * HOUR))[0]
    const kept = depTx.outputs.find((o) => o.address === P3)?.value ?? 0

    // ══ Habillage (après le flux réel) ═══════════════════════════════════════
    // Transferts jumeaux : deux envois du même montant quittent H à quelques minutes du vrai
    const twins = twinTransfers(w, H, { value: vK, time: tK, n: 2, spreadMin: 22 })
    const twinTxs = twins.txs
    const twinDst = twins.addresses

    // Autres victimes du drainer : inscriptions volées avant les faits, revendues avec encaissement sur P1
    const otherVictims: { ins: Inscription; theft: Tx; sale?: Tx; price?: number; holder: string; col: string; num: number }[] = []
    const stealFromOther = (time: number, col: (typeof COLLECTIONS)[number], num: number) => {
      const vo = w.addr('btc', { kind: 'p2tr' })
      const vp = w.addr('btc', { kind: r.pick(['p2wpkh', 'p2sh'] as const), wallet: w.get(vo).wallet })
      const ins = inscribe(w, { owner: vp, content: `Image (${col.type}) : « ${col.name} » n° ${num}, ${col.kind}`, contentType: col.type, size: r.int(6000, 40000), time: time - r.int(40, 300) * DAY, recipient: vo })
      const holder = w.addr('btc', { kind: 'p2tr', entity: thiefE, wallet: TW1 })
      const theft = sendInscription(w, { ins, from: vo, to: holder, feePayer: vp, time })
      theft.fp = { version: 2, locktime: 0, rbf: true }
      return { ins, theft, holder }
    }
    const nPrior = r.int(3, 4)
    for (let i = 0; i < nPrior; i++) {
      const col = r.pick(COLLECTIONS)
      const num = r.int(1000, 4999)
      const tt = T - r.int(8, 70) * DAY - r.int(0, 20) * HOUR
      const o = stealFromOther(tt, col, num)
      const price = r8(roundCoin(w, 0.015, 0.12, 0.001))
      const buyer = w.addr('btc', { kind: 'p2wpkh' })
      const s = mk.sell({ ins: o.ins, seller: o.holder, sellerPayout: P1, buyer, price, time: tt + Math.round(r.float(3, 40) * HOUR) })
      otherVictims.push({ ...o, sale: s.tx, price, col: col.name, num })
    }
    // Inscription leurre : un autre exemplaire « COL » volé quelques jours avant, revendu dans l'heure de la vente A, à un prix voisin, encaissé sur P1
    const numX = r.int(1000, 4999)
    const theftXT = T - r.int(3, 6) * DAY - r.int(1, 20) * HOUR
    const oX = stealFromOther(theftXT, COL, numX)
    const priceX = r8(Math.round(pA * (1 + (r.chance(0.5) ? 1 : -1) * r.float(0.004, 0.012)) * 1e5) / 1e5)
    const saleX = mk.sell({ ins: oX.ins, seller: oX.holder, sellerPayout: P1, buyer: w.addr('btc', { kind: 'p2wpkh' }), price: priceX, time: saleA.tx.time + (r.chance(0.5) ? 1 : -1) * r.int(12, 45) * 60 })
    otherVictims.push({ ...oX, sale: saleX.tx, price: priceX, col: COL.name, num: numX })
    // Une inscription volée encore invendue (dort sur une adresse Taproot du voleur)
    const colU = r.pick(COLLECTIONS)
    const numU = r.int(1000, 4999)
    const oU = stealFromOther(T - r.int(15, 40) * DAY, colU, numU)
    otherVictims.push({ ...oU, col: colU.name, num: numU })
    // Le fil public : la première victime revendue, qui publie après le troisième vol connu
    const byTheft = [...otherVictims].sort((a, b) => a.theft.time - b.theft.time)
    const firstPrior = byTheft.find((o) => o.sale)!
    const tPost = Math.max(byTheft[2].theft.time, firstPrior.sale!.time) + r.int(1, 3) * DAY

    // Ventes jumelles d'autres collectionneurs : même collection, même heure, prix voisins
    const lookSales: { tx: Tx; num: number; price: number }[] = []
    for (let i = 0; i < r.int(3, 4); i++) {
      const own = w.addr('btc', { kind: 'p2wpkh' })
      const ordA = w.addr('btc', { kind: 'p2tr', wallet: w.get(own).wallet })
      const num = r.int(1000, 4999)
      const ins = inscribe(w, { owner: own, content: `Image (${COL.type}) : « ${COL.name} » n° ${num}, ${COL.kind}`, contentType: COL.type, size: r.int(9000, 48000), time: T - r.int(30, 300) * DAY, recipient: ordA })
      const price = r8(Math.round(pA * (1 + r.float(-0.014, 0.014)) * 1e5) / 1e5)
      const s = mk.sell({ ins, seller: ordA, sellerPayout: own, buyer: w.addr('btc', { kind: 'p2wpkh' }), price, time: saleA.tx.time + r.int(-55, 55) * 60 })
      lookSales.push({ tx: s.tx, num, price })
    }
    // Ventes de fond (autres collections, autres jours)
    for (let i = 0; i < r.int(3, 5); i++) {
      const own = w.addr('btc', { kind: 'p2wpkh' })
      const ordA = w.addr('btc', { kind: 'p2tr', wallet: w.get(own).wallet })
      const t0 = T - r.int(10, 90) * DAY
      const ins = inscribe(w, { owner: own, content: `Image (image/webp) : « ${r.pick(COLLECTIONS.filter((c) => c !== COL)).name} » n° ${r.int(1000, 4999)}`, contentType: 'image/webp', size: r.int(5000, 40000), time: t0, recipient: ordA })
      mk.sell({ ins, seller: ordA, sellerPayout: own, buyer: w.addr('btc', { kind: 'p2wpkh' }), price: roundCoin(w, 0.01, 0.2, 0.001), time: T + Math.round(r.float(-2, 5) * DAY) })
    }

    // P1 : dépenses personnelles (hébergement du faux site, cartes cadeaux, casino) et poussière
    const hostiva = w.customEntity({ name: 'Hostiva', category: 'merchant', known: true, risk: 'high', country: 'Moldavie', description: 'Hébergeur web et registraire « offshore » (fictif), payable en bitcoin, prisé des sites d\'hameçonnage. Conserve l\'adresse électronique du compte et les journaux de connexion.' })
    const giftnova = w.customEntity({ name: 'GiftNova', category: 'merchant', known: true, risk: 'medium', description: 'Revendeur de cartes cadeaux contre crypto-actifs (fictif) ; livre les codes par courriel.' })
    const crashpot = w.customEntity({ name: 'Crashpot', category: 'gambling', known: true, risk: 'medium', description: 'Casino en ligne crypto (fictif), jeux « crash » et dés, inscription par simple adresse électronique.' })
    personalSpending(w, P1, { start: T - 45 * DAY, end: depT + 12 * DAY, n: r.int(4, 6), merchants: [hostiva, giftnova, crashpot, hostiva], maxUsd: 450 })
    dusting(w, P1, { time: T, n: 2, spreadH: 96 })
    // P2 : vie antérieure (approvisionnements, paiements) et frappes de runes
    priorHistory(w, P2, { start: T - 50 * DAY, end: T - 2 * DAY, nIn: r.int(3, 5), nOut: r.int(2, 3), maxUsd: 900 })
    const nMints = r.int(2, 3)
    for (let i = 0; i < nMints; i++) runeMint(w, { from: P2, rune: MINT, amount: r.int(1, 20) * 1000, time: T - r.int(3, 30) * DAY - r.int(0, 20) * HOUR })
    dusting(w, H, { time: tK + DAY, n: 1, spreadH: 20 })
    dusting(w, K, { time: depT + 2 * DAY, n: 1, spreadH: 30 })

    ex.noise(12, T - 3 * DAY, depT + 5 * DAY)

    // ── Réponses calculées sur le monde final ─────────────────────────────────
    const saleAOut = saleA.tx.outputs
    const name = ex.entity.name
    const fA = saleA.fee
    const p1Sales = w.txsOf(P1).filter((t) => t.tags.includes('inscription-sale') && t.outputs.some((o) => o.address === P1) && t.id !== saleA.tx.id)
    const nOtherSales = p1Sales.length
    const sameHour = [saleA.tx, saleX.tx, ...lookSales.map((x) => x.tx)].sort((a, b) => a.time - b.time)
    const twinTimes = [realTx, ...twinTxs].sort((a, b) => a.time - b.time)
    const twinsDormant = twinDst.every((d) => w.txsOf(d).length === 1)
    const branchFate = (b: (typeof branches)[number]) =>
      b.fate === 'dort' ? 'reste immobile' : b.fate === 'dépensée' ? 'sert à de petites dépenses (commerçants ou particuliers)' : b.fate === 'retour' ? `revient quelques heures ou jours plus tard sur ${short(w, P1)}` : 'est elle-même ré-éclatée en petits montants'
    const branchText = branches.map((b) => `${btc(b.value)} vers ${short(w, b.address)} (${hm(b.tx.time)}), qui ${branchFate(b)}`).join(' ; ')
    const SHOP: Record<string, string> = { [hostiva.id]: "l'hébergeur web Hostiva", [giftnova.id]: 'des cartes cadeaux GiftNova', [crashpot.id]: 'le casino en ligne Crashpot' }
    const shops = [...new Set(w.txsOf(P1).filter((t) => t.inputs.some((i) => i.address === P1)).flatMap((t) => t.outputs.map((o) => w.get(o.address).entityId ?? '')).filter((e) => SHOP[e]))].map((e) => SHOP[e])
    const p1Spend = shops.length ? shops.join(', ') : 'des paiements à des particuliers'
    const tPlainte = office(Math.max(T + r.int(1, 2) * DAY, saleA.tx.time + DAY))
    const lookText = [...lookSales].sort((a, b) => a.tx.time - b.tx.time).map((x) => `n° ${x.num} à ${btc(x.price)} (${hm(x.tx.time)})`).join(', ')

    return {
      world: w,
      title: `Inscriptions volées — ${city}`,
      briefing:
        `${vic.name}, collectionneuse d'inscriptions ordinales demeurant à ${city}, a été contactée sur Discord par un prétendu « support Ordinalia » : ses annonces devaient être « re-vérifiées » après une mise à jour de la place de marché. Sur le site indiqué, elle a signé trois demandes que son portefeuille présentait comme des transactions partiellement signées (PSBT). Quelques minutes plus tard, deux inscriptions et tout son solde de runes avaient quitté son adresse.\n\n` +
        `Une inscription vit sur un satoshi précis : le premier satoshi de la sortie qui la porte, souvent une petite sortie de 10 000 sats. Elle suit ce satoshi d'entrée en sortie (premier entré, premier sorti). Les runes, elles, sont des soldes attachés aux UTXO et déplacés par un message OP_RETURN (« runestone »). Pour l'enquêteur, ces petites sorties sont des envois d'actifs, jamais des rendus.\n\n` +
        `Le voleur n'en est pas à son coup d'essai : d'autres collectionneurs se sont plaints publiquement d'un « drainer » similaire. Ses adresses ont une vie propre (autres reventes, dépenses, poussière), la collection volée se vend tous les jours sur Ordinalia, et le produit des ventes est éclaté avant d'être encaissé. À chaque étape, il faudra trier.\n\n` +
        `Votre mission : identifier les transactions du vol, retrouver la bonne vente parmi les ventes de la même collection, lire cette vente (acheteur, prix, adresse qui encaisse, commission), quantifier les runes volées, recenser les autres victimes encaissées par le voleur, puis suivre le produit des ventes, à travers ses leurres, jusqu'à la plateforme où il est déposé.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: tPlainte, author: vic.name,
          body:
            `« Mon adresse ordinals (Taproot) est ${A(w, vOrd)}. J'y détenais :\n` +
            `- une inscription de la collection « ${COL.name} » (n° ${numA}), achetée sur Ordinalia. Son identifiant est ${insA.id} (la partie avant « i0 » est le hash de la transaction de révélation : ${insA.reveal.hash}) ;\n` +
            `- une de mes propres œuvres, « Phares d'Armor » n° ${numB}, inscription n° ${insB.number.toLocaleString('fr-FR')} ;\n` +
            `- un solde de runes ${RUNE}, je ne sais plus exactement combien.\n\n` +
            `Le ${fmtDate(T)}, j'ai signé les trois demandes du faux support. Mes frais ont été prélevés sur mon adresse de paiement ${A(w, vPay)}. Depuis, l'adresse ordinals est vide. Ensuite, j'ai vu passer sur Ordinalia plusieurs « ${COL.name} » vendus le ${day(saleA.tx.time)}, je ne sais pas lequel est le mien. »`,
        },
        {
          id: 'discord', type: 'capture', title: 'Capture de la conversation Discord', date: runeT + r.int(2, 6) * HOUR, author: 'Capture remise par la plaignante',
          body:
            `@ordinalia_support_${handle} (compte créé la veille) :\n` +
            `« Bonjour ! Suite à la migration de nos contrats d'annonce, vos inscriptions risquent d'être délistées. Merci de valider vos annonces sur ordinalia-verify (lien) : votre portefeuille vous demandera 3 signatures, c'est normal, aucun frais ne sera débité 🙏 »\n\n` +
            `[${vic.name}] « C'est fait, j'ai signé les trois. »\n` +
            `[@ordinalia_support_${handle}] « Parfait, merci ! »  (compte supprimé une heure plus tard)`,
        },
        {
          id: 'osint', type: 'osint', title: 'Fil public d\'une autre victime (réseau social, capture du ' + fmtDate(T + 3 * DAY, false) + ')', date: tPost, author: 'Compte public d\'un collectionneur (non identifié)',
          body:
            `« ⚠️ Arnaque au faux support Ordinalia en cours. J'ai signé une "vérification d'annonce" et mon « ${firstPrior.col} » n° ${firstPrior.num} est parti en deux minutes vers ${A(w, firstPrior.holder)}.\n` +
            `Le scammer revend tout de suite sur Ordinalia. Au moins deux autres personnes sur le Discord ont perdu des pièces de la même façon. Si vous avez un "support" qui vous écrit en MP : bloquez. »\n\n` +
            `(Réponses : « pareil pour moi, même faux support », « même mode opératoire, 3 signatures demandées ».)`,
        },
        {
          id: 'ordinalia', type: 'email', title: 'Réponse d\'Ordinalia à la réquisition (extrait)', date: office(T + r.int(8, 15) * DAY), author: 'Service conformité d\'Ordinalia',
          body:
            `Les deux inscriptions signalées ont été mises en vente puis vendues par deux comptes distincts, ouverts avec des adresses e-mail jetables et des connexions via un VPN commercial. Chaque compte avait connecté un portefeuille différent. Le premier compte, plus ancien, a vendu plusieurs autres inscriptions ces dernières semaines ; plusieurs ont fait l'objet de signalements de vol.\n\n` +
            `Ordinalia ne détient aucun fonds : les ventes sont réglées dans une transaction unique, signée en partie par le vendeur puis complétée par l'acheteur. La commission de la plateforme (2 % du prix) y figure. Nous ne pouvons ni geler ni annuler une vente.`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe — inscriptions, runes et leurres', date: office(tPlainte + r.int(1, 3) * DAY), author: 'Chef de groupe — Section de recherches',
          body:
            `• La carte « Inscription » d'une transaction donne l'identifiant, le numéro, le type de contenu et la sortie qui porte l'inscription. Une collection se vend à des prix voisins : on n'identifie pas une vente à son prix, mais au satoshi qu'elle dépense.\n` +
            `• Une vente par PSBT réunit dans une seule transaction l'acheteur, le vendeur et la place de marché. Les petites sorties (600, 546 ou 10 000 sats) ne sont ni des prix ni des rendus : lisez la carte avant d'appliquer une heuristique de rendu.\n` +
            `• Les runes n'apparaissent que dans le runestone (sortie OP_RETURN) : c'est lui qui dit combien d'unités vont à quelle sortie.\n` +
            `• Un voleur qui utilise deux portefeuilles finit souvent par les réunir pour encaisser : surveillez les entrées communes. Ensuite, attendez-vous à des envois de diversion : à montant égal, c'est la provenance des fonds et la suite qui tranchent.`,
        },
      ],
      seeds: [vOrd],
      objectives: [
        {
          id: 'o1', type: 'tx', points: 8,
          prompt: `Quelle transaction a fait sortir l'inscription « ${COL.name} » n° ${numA} de l'adresse de la victime ?`,
          answer: [theftA.id],
          hint: 'Parmi les dépenses de l\'adresse ordinals du ' + fmtDate(T, false) + ', cherchez la carte « Transfert d\'inscription » qui porte l\'identifiant cité dans la plainte.',
          explanation: `${theftA.hash.slice(0, 16)}… dépense en entrée 0 l'UTXO de 10 000 sats qui porte l'inscription, et en entrée 1 l'adresse de paiement de la victime pour les frais. L'inscription suit son satoshi vers la sortie 0 (${sats(POSTAGE)}) : ${A(w, tA)}. La sortie 1, vers l'adresse de paiement, est le rendu des frais de la victime. Les deux autres dépenses du même jour transportent l'œuvre de la victime (carte au numéro ${insB.number.toLocaleString('fr-FR')}) et les runes (runestone, sortie de 546 sats) : ce ne sont pas des transferts de l'inscription n° ${numA}.`,
        },
        {
          id: 'o3', type: 'tx', points: 8,
          prompt: `La plaignante ne connaît que le numéro de sa propre œuvre (n° ${insB.number.toLocaleString('fr-FR')}). Quelle transaction a créé (révélé) cette inscription ?`,
          answer: [insB.reveal.id],
          hint: 'Trouvez le transfert d\'inscription dont la carte porte ce numéro. Son entrée 0 est l\'UTXO de l\'inscription : remontez à la transaction d\'origine de cette entrée, qui doit afficher la carte « Révélation ».',
          explanation: `L'identifiant de l'inscription n° ${insB.number.toLocaleString('fr-FR')} est ${insB.id.slice(0, 16)}…i0 : elle a été révélée par ${insB.reveal.hash.slice(0, 16)}…, qui dépense par script une adresse Taproot de commit (témoin : enveloppe « OP_FALSE OP_IF "ord" … » contenant l'image) et dépose l'inscription sur la sortie 0, l'adresse ordinals de la victime. C'est la preuve on-chain que la plaignante en est la créatrice et la détentrice d'origine.`,
        },
        {
          id: 'o13', type: 'tx', points: 12,
          prompt: `${cap(span(sameHour[0].time, sameHour[sameHour.length - 1].time))}, ${sameHour.length} ventes d'inscriptions « ${COL.name} » sont réglées sur Ordinalia, à des prix très proches. Laquelle est la revente de l'inscription n° ${numA} de la plaignante ?`,
          answer: [saleA.tx.id],
          hint: 'Ne comparez pas les prix : suivez le satoshi. La sortie 0 de la transaction de vol est dépensée par une seule de ces ventes (bouton « transaction de dépense »), et la carte de vente affiche l\'identifiant de l\'inscription.',
          explanation: `${saleA.tx.hash.slice(0, 16)}… (${hm(saleA.tx.time)}, ${btc(pA)}) dépense en entrée 1 la sortie 0 du vol (${theftA.hash.slice(0, 12)}…) et sa carte porte l'identifiant ${insA.id.slice(0, 12)}…i0 cité dans la plainte. Les autres ventes de cette fenêtre sont des leurres : ${lookText} sont vendus par d'autres collectionneurs, qui détenaient ces inscriptions depuis leur révélation, sans lien avec le vol ; et le n° ${numX} (${btc(priceX)}, ${hm(saleX.tx.time)}) est bien vendu par le voleur, avec encaissement sur la même adresse que la vente A, mais c'est une autre pièce volée quelques jours plus tôt à une autre victime (${oX.theft.hash.slice(0, 12)}…). Le prix et l'heure ne départagent rien ; seul le satoshi suivi depuis la transaction de vol le fait.`,
        },
        {
          id: 'o4', type: 'address', points: 8,
          prompt: `Sur Ordinalia, à quelle adresse l'acheteur reçoit-il l'inscription « ${COL.name} » n° ${numA} ?`,
          answer: [saleA.receive],
          hint: 'Dans la vente retenue, l\'inscription n\'est pas portée par la sortie 0 : lisez la carte « Vente d\'inscription ».',
          explanation: `Dans la vente ${saleA.tx.hash.slice(0, 12)}…, la petite entrée « tampon » de l'acheteur (600 sats) passe en premier : elle ressort en sortie 0, et le satoshi de l'inscription, deuxième entrée, atterrit au début de la sortie 1 (${sats(saleAOut[1].value)}) : ${A(w, saleA.receive)}. Cet acheteur est a priori de bonne foi ; il est néanmoins détenteur d'un bien volé, ce qui intéresse la restitution.`,
        },
        {
          id: 'o5', type: 'amount', points: 6, unit: 'BTC', tolerance: 0.0005,
          prompt: 'À quel prix (en BTC, versé au vendeur) l\'inscription a-t-elle été revendue ?',
          answer: pA,
          hint: 'La carte de la vente indique le « prix payé au vendeur » ; il correspond à l\'une des sorties.',
          explanation: `${btc(pA)} sont versés au vendeur (sortie 2). La commission d'Ordinalia, ${btc(fA)} (2 %), part vers l'adresse de commissions de la place de marché (sortie 3), et la dernière sortie est le rendu de l'acheteur. L'acheteur a donc payé ${btc(r8(pA + fA))} hors frais de réseau.`,
        },
        {
          id: 'o6', type: 'address', points: 8,
          prompt: 'Quelle adresse encaisse le prix de cette vente ?',
          answer: [P1],
          hint: 'C\'est la sortie dont le montant est égal au prix affiché par la carte.',
          explanation: `${A(w, P1)} (SegWit natif) reçoit ${btc(pA)}. Ce n'est pas l'adresse Taproot qui détenait l'inscription : comme la plupart des portefeuilles d'ordinals, celui du voleur sépare les adresses qui gardent les inscriptions de l'adresse de paiement, réutilisée à chaque vente. C'est ce qui rend ${short(w, P1)} si parlante : elle a encaissé d'autres ventes, payé ${p1Spend}, et reçu de la poussière.${shops.includes(SHOP[hostiva.id]) ? ' Le paiement à Hostiva est une piste secondaire : un hébergeur payé par le voleur peut héberger le faux site « ordinalia-verify » (réquisition sur le compte client et les journaux de connexion).' : ''}`,
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
          id: 'o8', type: 'number', points: 8, unit: RUNE,
          prompt: `Combien d'unités de la rune ${RUNE} ont été volées ?`,
          answer: runeAmt,
          hint: 'La troisième transaction signée par la victime porte un runestone (sortie OP_RETURN) : lisez son « edict ». Ne la confondez pas avec les frappes de runes visibles ailleurs dans le portefeuille du voleur.',
          explanation: `Le runestone de ${runeTx.hash.slice(0, 12)}… attribue ${runeAmt.toLocaleString('fr-FR')} ${RUNE} à la sortie 0 (546 sats), ${A(w, tR)}. Aucun montant de rune n'apparaît dans les valeurs en bitcoins : seule la sortie OP_RETURN (0 BTC) porte l'instruction. Le chiffre concorde avec le runestone de la transaction par laquelle la victime avait reçu ses runes (${runeIn.hash.slice(0, 12)}…). Les runes ${MINT} que l'on croise sur le second portefeuille du voleur sont des frappes (« mint ») qu'il a payées lui-même : elles n'ont rien à voir avec le vol. L'UTXO de 546 sats n'a pas été dépensée : elle peut être signalée aux places de marché.`,
        },
        {
          id: 'o16', type: 'number', points: 10, tolerance: 0,
          prompt: `En dehors de la vente de l'inscription n° ${numA}, combien d'autres ventes Ordinalia ont été encaissées sur l'adresse qui reçoit le prix de cette vente ?`,
          answer: nOtherSales,
          hint: 'Ouvrez l\'historique complet de l\'adresse de paiement du voleur et ne retenez que les entrées portant la carte « Vente d\'inscription » (sortie « prix payé au vendeur »). Les autres entrées (poussière, rendus, retours de fonds) ne comptent pas.',
          explanation: `${nOtherSales} autres ventes encaissées sur ${short(w, P1)} : ${p1Sales.map((t) => `${fmtDate(t.time, false)} (${btc(t.outputs.find((o) => o.address === P1)!.value)})`).join(', ')}. Pour chacune, l'inscription vendue était arrivée quelques heures à quelques jours avant sur une adresse Taproot du voleur par un transfert dont les frais étaient payés… par l'ancien détenteur : la signature du même « drainer ». Ce sont autant de victimes à identifier (la carte de chaque vente donne l'inscription, donc son ancien propriétaire). Une autre pièce volée (« ${colU.name} » n° ${numU}) dort encore, invendue, sur ${short(w, oU.holder)}. Les entrées de poussière (546 sats), les rendus et l'éventuel retour d'une branche ne sont pas des ventes.`,
        },
        {
          id: 'o10', type: 'tx', points: 10,
          prompt: 'Quelle transaction réunit le produit des deux ventes de la plaignante ?',
          answer: [cons.id],
          hint: 'L\'adresse de paiement du voleur a beaucoup de dépenses : cherchez celle qui la co-dépense avec l\'adresse qui encaisse la vente de l\'œuvre « Phares d\'Armor ».',
          explanation: `${cons.hash.slice(0, 16)}… dépense ensemble la sortie de la vente A sur ${short(w, P1)} (${btc(pA)}) et celle de la vente B sur ${short(w, P2)} (${btc(pB)}, vente ${saleB.tx.hash.slice(0, 12)}…), vers une seule sortie : ${A(w, H)} (${btc(consOut)}). Les deux comptes Ordinalia « distincts » sont ainsi rattachés au même opérateur par l'heuristique des entrées communes. Les autres dépenses de ${short(w, P1)} (${p1Spend}) partent d'autres pièces de l'adresse et ne touchent pas au produit des ventes de la plaignante.`,
        },
        {
          id: 'o14', type: 'tx', points: 14,
          prompt: `${cap(span(twinTimes[0].time, twinTimes[twinTimes.length - 1].time))}, trois transferts d'environ ${btc(vK)} quittent ${short(w, H)}. Lequel emporte réellement le produit des ventes ?`,
          answer: [realTx.id],
          hint: 'Pour chacun des trois : d\'où viennent les pièces dépensées (le regroupement des ventes, ou une entrée arrivée juste avant) ? Y a-t-il un rendu ? Et que devient la destination ensuite ?',
          explanation: `${realTx.hash.slice(0, 16)}… (${hm(realTx.time)}) dépense ce qui reste du regroupement des ventes après les branches de diversion, en une seule sortie, sans rendu : ${A(w, K)} reçoit ${btc(vK)} et dépose ${btc(deposit)} chez ${name} ${Math.round((depT - tK) / HOUR)} h plus tard. Les deux autres (${[...twinTxs].sort((a, b) => a.time - b.time).map((t) => `${hm(t.time)}, ${btc(t.outputs.find((o) => o.address !== H)!.value)}`).join(' ; ')}) sont des jumeaux : chacun est financé par une entrée extérieure arrivée sur ${short(w, H)} peu avant, rend la monnaie à ${short(w, H)}, et sa destination ${twinsDormant ? 'ne bouge plus' : 'ne mène à aucun service'}. Même montant, même heure : seule la provenance des pièces et la suite départagent. Avant cela, ${short(w, H)} avait déjà émis ${branches.length} branches de diversion : ${branchText}. Aucune ne rejoint la plateforme où le produit est finalement déposé.`,
        },
        {
          id: 'o11', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme le produit des ventes est-il déposé ?',
          answer: [exKey],
          hint: 'Suivez la vraie continuation depuis l\'adresse de regroupement : l\'adresse qui la reçoit dépense ensuite vers une adresse étiquetée « Adresse de dépôt ».',
          explanation: `${btc(deposit)} partent de ${short(w, K)} vers une adresse de dépôt ${name}, balayée ensuite vers son hot wallet ; ${btc(kept)} restent en rendu sur ${short(w, P3)}. ${procedureFor(ex.entity)}`,
        },
        {
          id: 'o12', type: 'address', points: 6,
          prompt: 'Quelle adresse de dépôt citerez-vous dans la réquisition adressée à cette plateforme ?',
          answer: [exDep],
          hint: 'C\'est la sortie au montant rond de la transaction de dépôt.',
          explanation: `${A(w, exDep)} reçoit ${btc(deposit)} le ${fmtDate(depT)} (transaction ${depTx.hash.slice(0, 12)}…). Une adresse de dépôt est propre à un client : avec le hash et le montant, elle suffit à la plateforme pour identifier le compte, son KYC, ses adresses IP et ses retraits. La réquisition gagnera à citer aussi l'adresse de paiement ${short(w, P1)} et les autres ventes recensées : elles établissent l'habitude et les autres victimes.`,
        },
      ],
      truth: {
        path: [theftA.id, theftB.id, runeTx.id, saleA.tx.id, saleB.tx.id, cons.id, realTx.id, depTx.id, sweep.id, insA.reveal.id, buyA0.tx.id, insB.commit.id, insB.reveal.id, runeIn.id],
        addresses: [P1, P2, H, K, tA, tB, tR, P3, exDep, saleA.receive, saleB.receive],
        debrief:
          `1. Contexte : l'inscription « ${COL.name} » n° ${numA} (n° d'inscription ${insA.number.toLocaleString('fr-FR')}) avait été achetée par la victime sur Ordinalia pour ${btc(pA0)} ; sa propre œuvre (n° ${insB.number.toLocaleString('fr-FR')}) avait été révélée par ${insB.reveal.hash.slice(0, 12)}… ; ${runeAmt.toLocaleString('fr-FR')} ${RUNE} reposaient sur une sortie de 546 sats.\n` +
          `2. Le ${fmtDate(T)}, trois transactions signées sur le faux site déplacent chaque UTXO en entrée 0 vers une sortie 0 du voleur : ${short(w, tA)}, ${short(w, tB)} (inscriptions, 10 000 sats) et ${short(w, tR)} (runes, 546 sats). La victime paie les frais ; son rendu revient vers son adresse de paiement.\n` +
          `3. Deux comptes Ordinalia revendent les inscriptions par PSBT : ${btc(pA)} encaissés sur ${short(w, P1)} et ${btc(pB)} sur ${short(w, P2)}, commission de 2 % à la place de marché. Leurre : dans l'heure qui entoure la vente A, ${lookSales.length} autres « ${COL.name} » sont vendus par d'autres collectionneurs à des prix voisins, et le voleur lui-même vend le n° ${numX}, volé à une autre victime. Seul le satoshi suivi depuis le vol désigne la bonne vente.\n` +
          `4. L'adresse de paiement ${short(w, P1)} est un portefeuille vivant : ${nOtherSales} autres ventes d'inscriptions volées (autres victimes du même drainer, dont celle du fil public), des dépenses personnelles (${p1Spend}) et de la poussière. Le second portefeuille (${short(w, P2)}) a sa propre vie : approvisionnements, paiements, frappes de runes ${MINT}.\n` +
          `5. ${cons.hash.slice(0, 12)}… réunit les deux ventes (entrées communes) sur ${short(w, H)}. Le voleur y éclate une partie des fonds en ${branches.length} branches de diversion (${branches.map((b) => b.fate).join(', ')}), puis envoie tout le reste du regroupement vers ${short(w, K)} (${btc(vK)}) ; deux transferts jumeaux du même montant partent à moins d'une demi-heure du vrai transfert, financés par des apports frais arrivés juste avant, vers des adresses qui ${twinsDormant ? 'ne bougent plus' : 'ne mènent à aucun service'}.\n` +
          `6. ${short(w, K)} dépose ${btc(deposit)} chez ${name} sur ${short(w, exDep)} et garde ${btc(kept)} sur ${short(w, P3)}.\n\n` +
          `À retenir : une inscription ou une rune se suit à la sortie qui la porte, pas au montant ni au prix. Les petites sorties (10 000, 600, 546 sats) sont des envois d'actifs ou des sorties techniques. Une adresse de suspect se trie entrée par entrée : la carte de chaque transaction (vente, frappe, poussière) dit ce qu'elle est. Face aux branches et aux jumeaux, ce sont la provenance des pièces, la présence d'un rendu et le comportement ultérieur de la destination qui désignent la vraie continuation. Les places de marché non custodiales ne peuvent rien geler, mais elles relient l'adresse qui détient l'inscription à celle qui encaisse ; et le voleur qui multiplie les comptes se trahit dès qu'il consolide pour passer par une plateforme régulée.`,
      },
      hints: [
        'Partez de l\'adresse ordinals de la plainte : trois dépenses le même jour, chacune avec une carte (transfert d\'inscription ou de runes).',
        'Dans un transfert d\'inscription, l\'UTXO qui porte l\'inscription est l\'entrée 0 et la sortie 0 la reçoit. Pour trouver la vente, suivez cette sortie, pas le prix.',
        'L\'adresse qui encaisse la vente est réutilisée : triez son historique par type de carte (vente, poussière, dépense).',
        'Les runes ne se lisent que dans la sortie OP_RETURN (runestone) ; une frappe (« mint ») n\'est pas un transfert.',
        'Après le regroupement des deux ventes, plusieurs envois partent : comparez provenance des pièces, rendu et suite de chaque destination.',
      ],
    }
  },
}
