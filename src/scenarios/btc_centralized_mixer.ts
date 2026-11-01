import { World, type Tx } from '../engine/world'
import { exchange, roundCoin, HOUR } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import { dusting, priorHistory } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, forwardAll, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const pct = (v: number) => v.toFixed(2).replace('.', ',')

const DISTRIBUTIONS: number[][] = [
  [50, 30, 20],
  [40, 35, 25],
  [45, 30, 25],
  [60, 25, 15],
  [35, 25, 20, 20],
  [40, 30, 20, 10],
]

export const btcCentralizedMixer: ScenarioTemplate = {
  id: 'centralized-mixer',
  title: 'À travers le mixeur',
  tagline: 'Le mixeur Nébuleuse brouille les pistes, une commande jumelle aussi… jusqu\'au casino.',
  description:
    'Des bitcoins volés par hameçonnage sont envoyés dans le mixeur centralisé Nébuleuse (fictif). Une autre commande de montant presque identique, passée quelques minutes plus tard, et des paiements jumeaux du mixeur rendent la corrélation montant/temps trompeuse : seuls les paramètres de la commande saisie, la dépense commune des sorties et le comportement ultérieur permettent de trancher. Le butin finit sur un casino en ligne offshore.',
  difficulty: 3,
  chains: ['btc'],
  skills: ['mixer', 'cioh', 'change', 'exchange_id', 'requisition'],
  estMinutes: 75,
  lessons: ['mixeurs', 'clustering', 'change-heuristics', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const city = fakeCity(r)
    const brand = r.pick(['Ledger', 'Trezor', 'BitBox'])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    // Mixeur centralisé fictif : Sinbad (le vrai) a été saisi en novembre 2023, avant les dates de l'affaire.
    const nebE = w.customEntity({
      name: 'Nébuleuse', category: 'mixer', known: true, risk: 'severe', country: 'Inconnu',
      description: 'Mixeur centralisé (custodial, fictif) : mélange les fonds de ses clients et les restitue après un délai, sur des adresses neuves, moins une commission aléatoire. Démantelé ; extraits de base de données transmis par Europol.',
      compliance: { contact: 'Service démantelé (base saisie)', cooperation: 'none', responseDays: [0, 0], canFreeze: false, kyc: 'aucun', notes: 'Aucune réquisition possible : seules les données saisies lors du démantèlement sont exploitables.' },
    })
    const neb = { entity: nebE, pool: Array.from({ length: 4 }, (_, i) => w.addr('btc', { entity: nebE, label: `${nebE.name} — Réserve ${i + 1}`, tags: ['liquid'] })) }
    // Commerçants fictifs du dossier (dépenses du voleur)
    const giftShop = w.customEntity({ name: r.pick(['GiftNova', 'Kadoo Cards', 'VoucherBay']), category: 'merchant', known: true, description: 'Revendeur de cartes cadeaux contre crypto (fictif), sans vérification d\'identité. Conserve l\'e-mail de livraison des codes.' })
    const vpn = w.customEntity({ name: r.pick(['HushLink VPN', 'Tunnelo VPN', 'NoTrace VPN']), category: 'merchant', known: true, description: 'Fournisseur VPN payable en bitcoin (fictif).' })
    const cv = exchange(w, 'coinhouse', 'btc')
    const xKey = r.pick(['kraken', 'bitstamp', 'okx', 'binance'] as const)
    const xEx = exchange(w, xKey, 'btc')
    const orbit = w.entity('orbit', {
      country: 'Curaçao',
      compliance: {
        contact: 'Service support et conformité d\'OrbitCasino', cooperation: 'mlat', responseDays: [60, 180], canFreeze: false, kyc: 'faible',
        regulator: 'Licence de jeu offshore (Curaçao)',
        notes: 'Pas de vérification d\'identité au dépôt ; conserve le compte joueur (pseudonyme, e-mail, IP de connexion), l\'historique des dépôts et des retraits et les adresses de retrait déclarées.',
      },
    })
    const orbitHot = w.addr('btc', { entity: orbit, label: 'OrbitCasino — Portefeuille chaud', tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const orbitDeposit = () => w.addr('btc', { entity: orbit, label: 'OrbitCasino — Adresse de dépôt', tags: ['deposit'] })
    const sinbadDeposit = () => w.addr('btc', { entity: neb.entity, label: `${neb.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const thief = w.customEntity({ name: 'Auteur du hameçonnage (inconnu)', category: 'suspect' })
    // Tous les portefeuilles du voleur sont tenus par le même logiciel (même empreinte).
    const tw = `${thief.id}:wallet`
    const thiefAddr = () => w.addr('btc', { entity: thief, kind: 'p2wpkh', wallet: tw })

    // ── La victime : une épargne ordinaire, achetée par tranches ─────────────
    const victim = w.addr('btc', { entity: victimE, kind: 'p2wpkh' })
    const nBuys = r.int(4, 6)
    for (let i = 0; i < nBuys; i++) cv.withdraw(victim, roundCoin(w, 0.15, 0.8, 0.001), w.at(-r.int(40, 500) * 24))
    w.fund(victim, roundCoin(w, 0.004, 0.02, 0.0001), w.at(-r.int(60, 400) * 24)) // cadeau d'un proche
    const tSell = w.at(-r.int(8, 30) * 24)
    cv.receive(victim, roundCoin(w, 0.02, 0.08, 0.001), tSell, { change: victim })
    const tFriend = w.at(-r.int(35, 120) * 24)
    w.utxoTx({ time: tFriend, from: [victim], to: [{ address: w.addr('btc', { kind: 'p2wpkh' }), value: roundCoin(w, 0.003, 0.012, 0.0001) }], change: victim })

    // ── Le vol ───────────────────────────────────────────────────────────────
    const t0addr = thiefAddr()
    const stolenGross = w.unspentValue(victim, w.at(0))
    const theftFee = w.estimateFee('btc', w.utxosOf(victim, w.at(0)).length, 1)
    const theft = w.utxoTx({ time: w.at(0), from: [victim], to: [{ address: t0addr, value: r8(stolenGross - theftFee) }], fee: theftFee, change: null, spendAll: true })
    const stolen = r8(stolenGross - theftFee)
    // Achat programmé de la victime, arrivé après le vol : il dort sur l'adresse vidée (pas volé).
    const dca = cv.withdraw(victim, roundCoin(w, 0.004, 0.015, 0.0001), theft.time + Math.round(r.float(18, 40) * HOUR))

    // ── Dépôt dans le mixeur (rendu vers une adresse déjà utilisée) ──────────
    const deposit = sinbadDeposit()
    const V = r8(Math.floor(w.unspentValue(t0addr) * r.float(0.93, 0.97) * 1000) / 1000)
    const keep = thiefAddr()
    const depTx = w.utxoTx({ time: Math.round(theft.time + r.float(1, 5) * HOUR), from: [t0addr], to: [{ address: deposit, value: V }], change: keep })
    const toPoolT = depTx.time + r.int(600, 3 * 3600)
    const keepValue = depTx.outputs.find((o) => o.address === keep)!.value

    // Paramètres de la commande du suspect
    const dist = r.pick(DISTRIBUTIONS)
    const feePct = r.float(0.012, 0.03)
    const net = V * (1 - feePct)
    const payoutAddrs = dist.map(() => thiefAddr())
    const plannedValues = dist.map((p) => roundAsset('BTC', (net * p) / 100))
    const payoutTimes = dist.map(() => Math.round(toPoolT + r.float(1.5, 26) * HOUR))

    // ── Commande jumelle : un autre client dépose presque le même montant ────
    const distX = r.pick(DISTRIBUTIONS.filter((d) => d.length !== dist.length))
    let VX = r8(Math.round(V * (1 + r.float(0.002, 0.006) * r.pick([1, -1])) * 10000) / 10000)
    if (VX === V) VX = r8(V + 0.0003)
    const tDepX = depTx.time + r.int(14, 65) * 60
    const clientX = w.addr('btc', { kind: 'p2wpkh', wallet: 'clientX' })
    w.fund(clientX, r8(VX * r.float(1.02, 1.3)), tDepX - r.int(3, 40) * HOUR)
    const depositX = sinbadDeposit()
    w.utxoTx({ time: tDepX, from: [clientX], to: [{ address: depositX, value: VX }] })
    const toPoolTX = tDepX + r.int(600, 3 * 3600)
    const netX = VX * (1 - r.float(0.012, 0.03))
    const payX = distX.map(() => w.addr('btc', { kind: 'p2wpkh', wallet: 'clientX' }))
    const plannedX = distX.map((p) => roundAsset('BTC', (netX * p) / 100))
    const timesX = distX.map(() => Math.round(toPoolTX + r.float(1.5, 26) * HOUR))

    // Toute l'activité des réserves du mixeur est exécutée dans l'ordre
    // chronologique (balayages de dépôts, sorties des deux commandes, jumeaux, autres clients).
    type Ev = { t: number; run: () => void }
    const events: Ev[] = []
    let toPool!: Tx
    events.push({ t: toPoolT, run: () => { toPool = forwardAll(w, deposit, r.pick(neb.pool), toPoolT, undefined, ['sweep']) } })
    events.push({ t: toPoolTX, run: () => { forwardAll(w, depositX, r.pick(neb.pool), toPoolTX, undefined, ['sweep']) } })
    const payouts: Tx[] = []
    dist.forEach((_, i) => {
      events.push({ t: payoutTimes[i], run: () => { payouts[i] = w.utxoTx({ time: payoutTimes[i], from: [r.pick(neb.pool)], to: [{ address: payoutAddrs[i], value: plannedValues[i] }], tags: ['mixer-payout'] }) } })
    })
    distX.forEach((_, i) => {
      events.push({ t: timesX[i], run: () => { w.utxoTx({ time: timesX[i], from: [r.pick(neb.pool)], to: [{ address: payX[i], value: plannedX[i] }], tags: ['mixer-payout'] }) } })
    })
    // Paiements jumeaux : pour chaque sortie du suspect, un autre client reçoit presque le même montant à quelques minutes près.
    const twinPayouts: { addr: string; time: number; value: number }[] = []
    dist.forEach((_, i) => {
      let v = roundAsset('BTC', plannedValues[i] * (1 + r.float(0.002, 0.008) * r.pick([1, -1])))
      if (v === plannedValues[i]) v = roundAsset('BTC', v + 0.00002)
      const tp = { addr: w.addr('btc', { kind: 'p2wpkh' }), time: payoutTimes[i] + r.int(8, 50) * 60 * r.pick([1, -1]), value: v }
      twinPayouts.push(tp)
      events.push({ t: tp.time, run: () => { w.utxoTx({ time: tp.time, from: [r.pick(neb.pool)], to: [{ address: tp.addr, value: tp.value }], tags: ['mixer-payout'] }) } })
    })
    for (let i = 0; i < r.int(16, 24); i++) {
      const close = r.chance(0.45)
      const v = close ? r.pick(plannedValues) * r.float(0.85, 1.15) : r.float(0.01, V * 0.8)
      const t = Math.round(depTx.time + r.float(-6, 40) * HOUR)
      events.push({ t, run: () => { w.utxoTx({ time: t, from: [r.pick(neb.pool)], to: [{ address: w.addr('btc'), value: roundAsset('BTC', v) }], tags: ['mixer-payout'] }) } })
    }
    for (let i = 0; i < r.int(6, 10); i++) {
      const t = Math.round(depTx.time + r.float(-30, 30) * HOUR)
      const t2 = t + r.int(600, 3 * 3600)
      const d = sinbadDeposit()
      const u = w.addr('btc')
      w.fund(u, roundCoin(w, 0.05, 2, 0.001), t - r.int(2, 48) * HOUR)
      w.utxoTx({ time: t, from: [u], to: [{ address: d, value: r8(w.unspentValue(u, t) * r.float(0.5, 0.95)) }] })
      events.push({ t: t2, run: () => { forwardAll(w, d, r.pick(neb.pool), t2, undefined, ['sweep']) } })
    }
    events.sort((a, b) => a.t - b.t)
    for (const ev of events) ev.run()
    const payoutValues = payouts.map((tx, i) => tx.outputs.find((o) => o.address === payoutAddrs[i])!.value)
    const paidOut = payoutValues.reduce((s, v) => s + v, 0)
    const realFeePct = (1 - paidOut / V) * 100
    const firstPayout = Math.min(...payouts.map((p) => p.time))
    const lastPayout = Math.max(...payouts.map((p) => p.time))
    const firstX = Math.min(...timesX)

    // ── L'erreur : regroupement des sorties mixées ───────────────────────────
    const consol = thiefAddr()
    const consFee = w.estimateFee('btc', payoutAddrs.length, 1)
    const consTx = w.utxoTx({ time: Math.round(lastPayout + r.float(5, 30) * HOUR), from: r.shuffle([...payoutAddrs]), to: [{ address: consol, value: r8(paidOut - consFee) }], fee: consFee, change: null, spendAll: true })
    const consolVal = r8(paidOut - consFee)

    // Le client jumeau regroupe lui aussi ses sorties… et les dépose sur un exchange régulé.
    const consX = w.addr('btc', { kind: 'p2wpkh', wallet: 'clientX' })
    const lastX = Math.max(...timesX)
    const consXTx = w.utxoTx({ time: Math.round(lastX + r.float(2, 20) * HOUR), from: [...payX], to: [{ address: consX, value: r8(plannedX.reduce((s, v) => s + v, 0) - 0.00004) }], fee: 0.00004, change: null, spendAll: true })
    const xDep = xEx.newDeposit()
    const xCash = forwardAll(w, consX, xDep, consXTx.time + Math.round(r.float(2, 12) * HOUR))
    xEx.sweep([xDep], xCash.time + Math.round(r.float(1, 5) * HOUR))

    // ── Éclatement depuis l'adresse de regroupement : une seule branche aboutit ─
    const relay = thiefAddr()
    const Rv = roundAsset('BTC', consolVal * r.float(0.28, 0.34))
    let twinV = roundAsset('BTC', Rv * (1 + r.float(0.001, 0.003) * r.pick([1, -1])))
    if (twinV === Rv) twinV = roundAsset('BTC', Rv + 0.00003)
    const tReal = Math.round(consTx.time + r.float(2, 9) * HOUR)
    const twinFirst = r.chance(0.5)
    const tTwin = twinFirst ? tReal - r.int(4, 16) * 60 : tReal + r.int(4, 16) * 60
    const brTwin = thiefAddr()
    const mkReal = () => w.utxoTx({ time: tReal, from: [consol], to: [{ address: relay, value: Rv }], change: consol })
    const mkTwin = () => w.utxoTx({ time: tTwin, from: [consol], to: [{ address: brTwin, value: twinV }], change: consol })
    let realTx: Tx
    let twinTx: Tx
    if (twinFirst) {
      twinTx = mkTwin()
      realTx = mkReal()
    } else {
      realTx = mkReal()
      twinTx = mkTwin()
    }
    // Trois autres branches : dépensée chez des commerçants, retour vers le portefeuille courant, ré-éclatée.
    const tBr = Math.max(tReal, tTwin) + r.int(10, 40) * 60
    const rest = w.unspentValue(consol, tBr)
    const brSpent = thiefAddr()
    const brBack = thiefAddr()
    const brSplit = thiefAddr()
    const brSpentTx = w.utxoTx({ time: tBr, from: [consol], to: [{ address: brSpent, value: roundAsset('BTC', rest * r.float(0.22, 0.3)) }], change: consol })
    const brBackTx = w.utxoTx({ time: tBr + r.int(5, 30) * 60, from: [consol], to: [{ address: brBack, value: roundAsset('BTC', rest * r.float(0.22, 0.3)) }], change: consol })
    const brSplitTx = w.utxoTx({ time: tBr + r.int(35, 70) * 60, from: [consol], to: [{ address: brSplit, value: roundAsset('BTC', rest * r.float(0.22, 0.3)) }], change: consol })

    // ── Sortie : le relais dépose chez OrbitCasino ───────────────────────────
    const orbitDep = orbitDeposit()
    const tOrb = Math.round(tReal + r.float(6, 30) * HOUR)
    const finalTx = forwardAll(w, relay, orbitDep, tOrb)
    const finalValue = finalTx.outputs[0].value
    const orbitSweep = forwardAll(w, orbitDep, orbitHot, tOrb + Math.round(r.float(1, 6) * HOUR), undefined, ['sweep'])
    // Retraits de « gains » du casino vers l'adresse de regroupement (hors flux)
    for (let k = 0; k < 3; k++) w.utxoTx({ time: tOrb + Math.round(r.float(3 + k * 10, 12 + k * 14) * HOUR), from: [orbitHot], to: [{ address: consol, value: roundAsset('BTC', finalValue * r.float(0.08, 0.25)) }], change: orbitHot, tags: ['withdrawal'] })

    // Suites des branches sans issue
    for (const [k, e] of [giftShop, vpn, giftShop].entries()) {
      const t = brSpentTx.time + Math.round(r.float(8 + k * 20, 20 + k * 30) * HOUR)
      const to = w.addr('btc', { entity: e, label: `${e.name} — Paiement` })
      w.utxoTx({ time: t, from: [brSpent], to: [{ address: to, value: roundAsset('BTC', w.unspentValue(brSpent, t) * r.float(0.2, 0.35)) }], change: brSpent })
    }
    const subs = Array.from({ length: r.int(2, 3) }, () => thiefAddr())
    const tSub = brSplitTx.time + Math.round(r.float(10, 30) * HOUR)
    subs.forEach((s, k) => {
      const t = tSub + k * 900
      w.utxoTx({ time: t, from: [brSplit], to: [{ address: s, value: roundAsset('BTC', w.unspentValue(brSplit, t) * 0.4) }], change: brSplit })
    })

    // ── Le rendu conservé hors du mixeur : cartes cadeaux, VPN, particulier ──
    const tCard = Math.round(Math.min(depTx.time + r.float(14, 40) * HOUR, tOrb - 3 * HOUR))
    const cardAddr = w.addr('btc', { entity: giftShop, label: `${giftShop.name} — Paiement` })
    const cardTx = w.utxoTx({ time: tCard, from: [keep], to: [{ address: cardAddr, value: roundAsset('BTC', keepValue * r.float(0.45, 0.6)) }], change: keep })
    const cardValue = cardTx.outputs.find((o) => o.address === cardAddr)!.value
    const mullvadAddr = w.addr('btc', { entity: vpn, label: `${vpn.name} — Paiement` })
    w.utxoTx({ time: tCard + Math.round(r.float(3, 20) * HOUR), from: [keep], to: [{ address: mullvadAddr, value: roundAsset('BTC', 0.0009 + r.float(0, 0.0004)) }], change: keep })
    w.utxoTx({ time: tCard + Math.round(r.float(5, 30) * HOUR), from: [keep], to: [{ address: w.addr('btc'), value: roundAsset('BTC', keepValue * r.float(0.08, 0.15)) }], change: keep })
    w.fund(keep, roundCoin(w, 0.002, 0.01, 0.0001), depTx.time + Math.round(r.float(6, 40) * HOUR)) // virement d'un particulier
    // La branche « retour » revient sur ce portefeuille courant un à quatre jours plus tard
    const tBack = brBackTx.time + Math.round(r.float(30, 90) * HOUR)
    w.utxoTx({ time: tBack, from: [brBack], to: [{ address: keep, value: r8(w.unspentValue(brBack, tBack) - 0.00002) }], fee: 0.00002, change: null, spendAll: true })

    // ── Habillage : vies antérieures des portefeuilles du voleur ─────────────
    // Portefeuille courant (adresse de rendu réutilisée) : virements reçus, petites dépenses.
    priorHistory(w, keep, { start: w.at(-95 * 24), end: w.at(-6 * 24), nIn: 4, nOut: 3, maxUsd: 900 })
    // Adresse de regroupement : un habitué d'OrbitCasino, bien avant les faits.
    let priorRounds = 0
    for (let k = 0; k < 3; k++) {
      const t = w.at(-r.float(10 + k * 18, 22 + k * 18) * 24)
      w.utxoTx({ time: t, from: [orbitHot], to: [{ address: consol, value: roundCoin(w, 0.004, 0.03, 0.0001) }], change: orbitHot, tags: ['withdrawal'] })
      const t2 = t + Math.round(r.float(6, 72) * HOUR)
      w.utxoTx({ time: t2, from: [consol], to: [{ address: orbitDeposit(), value: roundAsset('BTC', w.unspentValue(consol, t2) * r.float(0.5, 0.8)) }], change: consol })
      priorRounds++
    }
    dusting(w, consol, { time: consTx.time + 20 * HOUR, n: 2, spreadH: 20 })
    dusting(w, keep, { time: depTx.time + 30 * HOUR, n: 2, spreadH: 24 })
    dusting(w, t0addr, { time: theft.time + 10 * HOUR, n: 1, spreadH: 8 })

    // ── Bruit ────────────────────────────────────────────────────────────────
    xEx.noise(14, w.at(-2 * 24), w.at(8 * 24))
    cv.noise(8, w.at(-10 * 24), w.at(5 * 24))
    for (let i = 0; i < 8; i++) {
      const t = Math.round(w.at(r.float(-3, 7) * 24))
      const p = w.addr('btc')
      if (r.chance(0.55)) {
        w.fund(p, roundCoin(w, 0.003, 0.15, 0.0001), t - r.int(2, 60) * HOUR)
        w.utxoTx({ time: t, from: [p], to: [{ address: orbitDeposit(), value: roundAsset('BTC', w.unspentValue(p, t) * r.float(0.4, 0.9)) }] })
      } else w.utxoTx({ time: t, from: [orbitHot], to: [{ address: p, value: roundCoin(w, 0.002, 0.08, 0.0001) }], change: orbitHot, tags: ['withdrawal'] })
    }

    // ── Réponses (calculées sur le monde final) ──────────────────────────────
    const mixName = neb.entity.name
    const distTxt = dist.map((p) => `${p} %`).join(' / ')
    const distXTxt = distX.map((p) => `${p} %`).join(' / ')
    const holdH = Math.round(((consTx.time - depTx.time) / 3600) * 10) / 10
    const caseRef = `NB-${r.int(100000, 999999)}`
    const xName = xEx.entity.name
    const dXmin = Math.round((tDepX - depTx.time) / 60)
    const twinStill = w.unspentValue(brTwin)
    const consXValue = consXTx.outputs[0].value
    const backH = Math.round((tBack - brBackTx.time) / HOUR)

    return {
      world: w,
      title: `Opération Nébuleuse — ${city}`,
      briefing:
        `${victimName} (${city}) a reçu un courriel imitant le fabricant de son portefeuille matériel ${brand}, l'invitant à « resynchroniser » son appareil. ${victimP.g('Il', 'Elle')} a saisi sa phrase de récupération sur le faux site : quelques heures plus tard, ${amt(stolen, 'BTC')} étaient vidés de son portefeuille.\n\n` +
        `Le voleur a envoyé l'essentiel des fonds dans ${mixName}, un mixeur centralisé : les bitcoins sont mélangés à ceux d'autres clients et restitués plus tard, sur des adresses neuves, moins une commission. Le lien on-chain direct est rompu, et le mixeur paie chaque jour des dizaines de clients, parfois pour des montants presque identiques.\n\n` +
        `${mixName} a été démantelé et un extrait de sa base de données a été transmis. Il contient les paramètres de la commande… mais pas les adresses de sortie. À vous de les retrouver sans vous laisser égarer par les commandes des autres clients, de documenter ce que le voleur a gardé hors du mixeur, de trier les branches qu'il a ouvertes ensuite, et d'identifier le service où les fonds ont fini.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Plainte de la victime (extrait)', date: w.at(2 * 24), author: victimName,
          body:
            `« Mon adresse de réception habituelle : ${A(w, victim)}\n` +
            `La transaction qui a vidé mon portefeuille : ${theft.hash}\n` +
            `J'avais acheté ces bitcoins en ${nBuys} fois chez Coinhouse, sur plusieurs mois, et j'en avais revendu un peu le ${fmtDate(tSell, false)}. J'avais aussi un achat programmé : le dernier est arrivé le ${fmtDate(dca.time, false)}, après le vol, et il est toujours là. Je n'ai jamais autorisé ce transfert. »`,
        },
        {
          id: 'courriel', type: 'email', title: 'Courriel d\'hameçonnage reçu par la victime', date: w.at(-20), author: `Support ${brand} <security@${brand.toLowerCase()}-resync.com>`,
          body:
            `Objet : Incident de sécurité — resynchronisation obligatoire\n\n` +
            `Une vulnérabilité affecte le micrologiciel de votre appareil. Pour éviter la perte de vos fonds, resynchronisez votre portefeuille avant 48 h en saisissant votre phrase de récupération sur notre portail sécurisé.\n\n` +
            `[ Resynchroniser mon appareil ]`,
        },
        {
          id: 'europol', type: 'rapport', title: `Extrait de la base ${mixName} (saisie)`, date: w.at(20 * 24), author: 'Coopération internationale — Europol EC3',
          body:
            `Commande n° ${caseRef}\n` +
            `Adresse de dépôt attribuée : ${A(w, deposit)}\n` +
            `Montant reçu : ${amt(V, 'BTC')} — le ${fmtDate(depTx.time)}\n` +
            `Nombre d'adresses de sortie : ${dist.length}\n` +
            `Répartition demandée : ${distTxt}\n` +
            `Délai maximal demandé : 30 h\n` +
            `Commission : aléatoire (1 à 3 %) — valeur exacte non conservée\n` +
            `Adresses de sortie : [champ chiffré, non exploitable]\n` +
            `Journal technique : premier paiement de la commande exécuté le ${fmtDate(firstPayout)}\n\n` +
            `NB : la base compte plusieurs centaines de commandes sur la période ; seule celle-ci est visée par la demande.`,
        },
        {
          id: 'methode', type: 'note', title: 'Fiche méthode — corrélation', date: w.at(21 * 24), author: 'Cellule d\'appui',
          body:
            `Outil de corrélation : partir de l'heure du dépôt, fixer une fenêtre (ex. 36 h), un montant en USD et une tolérance, et filtrer sur l'entité émettrice (${mixName}).\n\n` +
            `Montant attendu d'une sortie ≈ montant déposé × (1 − commission) × part demandée.\n\n` +
            `Attention : un mixeur paie en permanence d'autres clients. Deux commandes de montants voisins produisent des sorties voisines, et la corrélation seule propose souvent plusieurs candidats par part. Elle n'est qu'une hypothèse : il faut la confirmer par un comportement on-chain (dépense commune, destination commune) et par les paramètres de la commande (nombre de sorties, répartition, horodatage du premier paiement).\n\n` +
            `Penser aussi à ce qui n'est PAS entré dans le mixeur : le rendu de la transaction de dépôt reste lié au voleur sans aucune rupture.`,
        },
        {
          id: 'magistrat', type: 'note', title: 'Instructions du magistrat (courriel)', date: w.at(22 * 24), author: 'Parquet — section J3',
          body:
            `Merci de me transmettre, avant toute demande à l'étranger :\n` +
            `— la transaction de dépôt dans le mixeur et le reliquat conservé par l'auteur ;\n` +
            `— la démonstration du rattachement des sorties du mixeur à l'auteur, en écartant explicitement les autres clients ;\n` +
            `— le délai entre le mixage et le regroupement des fonds (élément utile pour caractériser la préméditation du blanchiment) ;\n` +
            `— le point de sortie exact et ce qui reste éventuellement saisissable.\n` +
            `Les éléments seront visés selon le cadre procédural applicable.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o6', type: 'tx', points: 8,
          prompt: `Quelle transaction a déposé les fonds volés dans ${mixName} (hash) ?`,
          answer: [depTx.id],
          hint: `Suivez la sortie du vol jusqu'à l'adresse de dépôt citée dans l'extrait ${mixName}.`,
          explanation: `La transaction ${depTx.hash} (${fmtDate(depTx.time)}) dépense l'adresse du voleur ${A(w, t0addr)} et verse ${amt(V, 'BTC')} sur l'adresse de dépôt ${A(w, deposit)} attribuée par ${mixName} : montant et horodatage concordent avec la base saisie. Un autre dépôt de ${amt(VX, 'BTC')} arrive chez ${mixName} ${dXmin} minutes plus tard, sur une autre adresse de dépôt : il ne figure pas dans la commande ${caseRef} et ne provient pas du voleur.`,
        },
        {
          id: 'o7', type: 'address', points: 9,
          prompt: 'Lors de ce dépôt, le voleur a gardé une partie des fonds. Sur quelle adresse (rendu) ?',
          answer: [keep],
          hint: 'La transaction de dépôt a deux sorties : l\'une est le montant exact de la commande, l\'autre revient au voleur.',
          explanation: `La sortie de ${amt(keepValue, 'BTC')} vers ${A(w, keep)} est le rendu : le dépôt de ${amt(V, 'BTC')} correspond exactement à la commande, l'autre sortie n'est pas ronde, reprend le type d'adresse de l'entrée et n'entre jamais dans le mixeur. Surtout, cette adresse avait déjà une vie avant les faits (virements reçus, petites dépenses) : c'est le portefeuille courant du voleur, réutilisé comme adresse de rendu. Ces fonds restent liés au vol sans aucune rupture.`,
        },
        {
          id: 'o8', type: 'entity', points: 8,
          prompt: 'Après le dépôt dans le mixeur, l\'adresse de rendu paie deux commerçants identifiés. Auquel verse-t-elle le montant le plus élevé ?',
          answer: [giftShop.id],
          hint: 'Suivez les sorties de l\'adresse de rendu après le dépôt dans le mixeur : comparez les montants et les étiquettes.',
          explanation: `Le ${fmtDate(cardTx.time)}, ${A(w, keep)} paie ${amt(cardValue, 'BTC')} à ${giftShop.name} (cartes cadeaux contre crypto). Les autres sorties de la période sont un abonnement ${vpn.name} de quelques dizaines d'euros et un paiement à un particulier non identifié ; les sorties antérieures au vol relèvent de la vie courante de l'adresse. ${giftShop.name} ne vérifie pas l'identité, mais une commande de cartes cadeaux laisse une adresse e-mail et des codes utilisés ensuite chez des enseignes : une piste secondaire, à exploiter en parallèle.`,
        },
        {
          id: 'o2', type: 'addresses', points: 14,
          prompt: 'Sélectionnez les adresses de sortie du mixeur appartenant au suspect.',
          answer: [...payoutAddrs],
          hint: `Pour chaque part de la répartition, la corrélation propose plusieurs paiements de ${mixName} de montant très proche. Retenez ceux qui sont ensuite dépensés ensemble.`,
          explanation: `Les ${dist.length} sorties (${payoutValues.map((v) => amt(v, 'BTC')).join(', ')}) respectent la répartition ${distTxt} et sont toutes dépensées dans la même transaction : l'heuristique des entrées communes les rattache à un seul portefeuille. Pour chacune, ${mixName} a payé à moins d'une heure d'écart un autre client d'un montant presque identique (${twinPayouts.map((t) => amt(t.value, 'BTC')).join(', ')}) : ces paiements jumeaux ne sont jamais dépensés avec les sorties du suspect, ils restent étrangers au dossier. Les ${distX.length} sorties de la commande jumelle (${distXTxt}) forment un autre groupe, regroupé ailleurs.`,
        },
        {
          id: 'o4', type: 'number', points: 9, tolerance: 0.5, unit: '%',
          prompt: `Quelle commission (en % du montant déposé) ${mixName} a-t-il prélevée sur cette commande ?`,
          answer: Math.round(realFeePct * 100) / 100,
          hint: 'Commission = 1 − (somme des sorties du suspect ÷ montant déposé).',
          explanation: `Somme des sorties : ${amt(r8(paidOut), 'BTC')} pour ${amt(V, 'BTC')} déposés, soit une commission de ${pct(realFeePct)} %, dans la fourchette annoncée (1 à 3 %).`,
        },
        {
          id: 'o1', type: 'address', points: 13,
          prompt: `Deux regroupements de sorties de ${mixName} reconstituent chacun un peu moins de ${amt(V, 'BTC')}. Quelle est l'adresse de regroupement du suspect ?`,
          answer: [consol],
          hint: 'Comparez chaque regroupement aux paramètres de la commande saisie : nombre d\'entrées, répartition des montants, heure du premier paiement.',
          explanation: `${A(w, consol)} reçoit ${amt(consolVal, 'BTC')} en une transaction à ${dist.length} entrées, de montants dans la proportion ${distTxt}, dont la première a été payée le ${fmtDate(firstPayout)} : exactement ce que décrit la commande ${caseRef}. L'autre regroupement, ${A(w, consX)} (${amt(consXValue, 'BTC')}), réunit ${distX.length} sorties réparties ${distXTxt}, dont la première est payée le ${fmtDate(firstX)} : c'est la commande d'un autre client, déposée ${dXmin} minutes après celle du voleur, qui finit sur ${xName}. Cette fausse piste mène à un exchange régulé, tentant pour une réquisition, mais rien ne la relie à la victime.`,
        },
        {
          id: 'o5', type: 'choice', points: 9,
          prompt: 'Pourquoi le regroupement des sorties est-il l\'erreur décisive du suspect ?',
          ...choice(r,
            'Il relie toutes les sorties mixées (entrées communes) et reconstitue le montant de la commande, ce que la corrélation seule ne pouvait pas trancher',
            [
              'Il a payé des frais de réseau trop faibles, ce qui signale un utilisateur novice',
              'Le mixeur conserve dans ses journaux l\'adresse vers laquelle le client regroupe ses fonds',
              'Les adresses SegWit sont traçables, contrairement aux adresses Legacy plus anciennes',
            ]),
          hint: 'Demandez-vous ce que prouve, à lui seul, le fait de signer plusieurs entrées dans une même transaction.',
          explanation: 'Un mixeur ne protège que si les sorties restent séparées. Tant qu\'elles le sont, chaque part a plusieurs candidats crédibles (paiements jumeaux, commande voisine). En les dépensant ensemble, le suspect signe une preuve on-chain qu\'elles lui appartiennent toutes, et le total correspond à la commande (dépôt − commission) avec la bonne répartition. Corrélation montant/temps + paramètres de commande + entrées communes = rattachement solide.',
        },
        {
          id: 'o9', type: 'number', points: 8, tolerance: 1.5, unit: 'heures',
          prompt: `Combien d'heures se sont écoulées entre le dépôt dans ${mixName} et le regroupement des sorties ?`,
          answer: holdH,
          hint: 'Comparez l\'horodatage de la transaction de dépôt et celui de la transaction de regroupement (frise chronologique).',
          explanation: `Dépôt le ${fmtDate(depTx.time)}, regroupement le ${fmtDate(consTx.time)} : environ ${holdH.toFixed(1).replace('.', ',')} h. Le suspect a attendu que toutes les sorties soient payées (dernière le ${fmtDate(lastPayout)}) puis les a réunies : il surveillait la commande, et la chronologie (dépôt → paiements → regroupement) renforce la corrélation présentée au magistrat.`,
        },
        {
          id: 'o13', type: 'tx', points: 11,
          prompt: `Après le regroupement, deux paiements d'environ ${amt(Math.round(Rv * 1000) / 1000, 'BTC')} partent de l'adresse de regroupement à quelques minutes d'intervalle. Lequel mène au point de sortie ?`,
          answer: [realTx.id],
          hint: 'Ouvrez les deux destinations et suivez-les : l\'une dort, l\'autre est dépensée ensuite, en totalité, vers un service identifié.',
          explanation: `La transaction ${realTx.hash.slice(0, 18)}… verse ${amt(Rv, 'BTC')} à ${A(w, relay)}, qui transfère la totalité vers une adresse de dépôt OrbitCasino le ${fmtDate(finalTx.time)}. Son jumeau (${twinTx.hash.slice(0, 14)}…, ${amt(twinV, 'BTC')} vers ${A(w, brTwin)}) n'a jamais été dépensé : ${amt(twinStill, 'BTC')} y dorment encore, saisissables si la clé est retrouvée. Les trois autres branches, ouvertes dans les deux heures qui suivent, n'aboutissent nulle part : l'une paie ${giftShop.name} et ${vpn.name}, l'une revient ${backH} h plus tard sur le portefeuille courant du voleur (l'adresse de rendu), la dernière se ré-éclate en ${subs.length} adresses qui dorment.`,
        },
        {
          id: 'o3', type: 'entity', points: 9,
          prompt: 'Sur quel service les fonds mixés ont-ils fini ?',
          answer: ['orbit'],
          hint: 'Suivez la branche qui aboutit : son unique dépense part vers une adresse étiquetée.',
          explanation: `${A(w, relay)} dépose ${amt(finalValue, 'BTC')} chez OrbitCasino, casino en ligne offshore sans vérification d'identité. Ce n'est pas une surprise : bien avant les faits, l'adresse de regroupement recevait déjà des retraits d'OrbitCasino et y redéposait (${priorRounds} allers-retours), et le casino lui reverse encore trois retraits après le dépôt. Le voleur est un joueur habitué de ce casino.`,
        },
        {
          id: 'o10', type: 'address', points: 8,
          prompt: 'Quelle adresse de dépôt OrbitCasino faut-il citer dans la demande adressée au casino ?',
          answer: [orbitDep],
          hint: 'C\'est l\'adresse qui reçoit les fonds de la branche qui aboutit, avant d\'être balayée vers le portefeuille chaud du casino.',
          explanation: `${A(w, orbitDep)} reçoit ${amt(finalValue, 'BTC')} le ${fmtDate(finalTx.time)} (transaction ${finalTx.hash}), puis est balayée vers le portefeuille chaud d'OrbitCasino. Comme sur un exchange, l'adresse de dépôt est propre à un compte joueur : c'est elle, avec le hash, qui permet au casino de retrouver le compte. Les retraits reçus par l'adresse de regroupement désignent le même compte.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Quelle démarche est la plus pertinente à ce stade ?',
          ...choice(r,
            'Demander à OrbitCasino, par la voie d\'entraide, le compte joueur lié à l\'adresse de dépôt (e-mail, IP, adresses de retrait), et signaler les fonds qui dorment encore sur les branches du voleur',
            [
              `Requérir ${mixName} pour obtenir les adresses de sortie de la commande ${caseRef}`,
              `Requérir ${xName} sur l'adresse de dépôt alimentée par l'autre regroupement de sorties`,
              'Demander à OrbitCasino le gel des fonds déposés, qui restent bloqués sur l\'adresse de dépôt',
            ]),
          hint: 'Quel acteur détient un lien direct avec une adresse que vous avez rattachée au voleur ? Et que reste-t-il on-chain ?',
          explanation: `Le service démantelé ne fournira rien de plus (le champ des sorties est chiffré). Le dépôt chez ${xName} est celui d'un autre client : le requérir viserait un tiers sans lien. Le casino a balayé le dépôt vers son portefeuille chaud et ne pratique pas le gel ; en revanche il conserve le compte joueur (pseudonyme, e-mail, IP, adresses de retrait). ${procedureFor(orbit)} En parallèle, le jumeau dormant et les sous-adresses de la branche ré-éclatée restent des avoirs identifiés.`,
        },
      ],
      truth: {
        path: [theft.id, depTx.id, toPool.id, ...payouts.map((p) => p.id), consTx.id, cardTx.id, realTx.id, finalTx.id, orbitSweep.id],
        addresses: [t0addr, deposit, ...payoutAddrs, consol, relay, orbitDep, keep],
        debrief:
          `1. Le ${fmtDate(theft.time)}, le voleur vide le portefeuille de la victime (${nBuys} achats Coinhouse) vers ${A(w, t0addr)}.\n` +
          `2. Le ${fmtDate(depTx.time)}, il dépose ${amt(V, 'BTC')} sur l'adresse de dépôt ${mixName} ${A(w, deposit)} et garde ${amt(keepValue, 'BTC')} en rendu sur ${A(w, keep)}, son portefeuille courant (historique antérieur), qui paie ensuite ${giftShop.name} (${amt(cardValue, 'BTC')}), ${vpn.name} et un particulier.\n` +
          `3. ${dXmin} minutes plus tard, un autre client dépose ${amt(VX, 'BTC')} chez ${mixName} (commande jumelle, ${distX.length} sorties ${distXTxt}). Ses sorties sont regroupées sur ${A(w, consX)} puis déposées chez ${xName} : fausse piste.\n` +
          `4. ${mixName} paie les ${dist.length} sorties du voleur (${payoutValues.map((v) => amt(v, 'BTC')).join(', ')} ; répartition ${distTxt}, commission ${pct(realFeePct)} %), chacune doublée d'un paiement jumeau à un autre client, au milieu de dizaines d'autres paiements.\n` +
          `5. Erreur : environ ${holdH.toFixed(1).replace('.', ',')} h après le dépôt, le voleur regroupe ses sorties sur ${A(w, consol)}, une adresse qu'il utilisait déjà pour jouer chez OrbitCasino.\n` +
          `6. Il éclate ensuite les fonds : ${amt(Rv, 'BTC')} vers ${A(w, relay)} (la seule branche qui aboutit), un jumeau de ${amt(twinV, 'BTC')} qui dort, une branche dépensée chez ${giftShop.name} et ${vpn.name}, une branche qui revient sur son portefeuille courant et une branche ré-éclatée.\n` +
          `7. Le relais dépose ${amt(finalValue, 'BTC')} sur ${A(w, orbitDep)} (OrbitCasino), qui reverse ensuite trois retraits vers l'adresse de regroupement.\n\n` +
          `Méthode : (a) corrélation montant/temps sur les paiements du mixeur, à partir des paramètres de commande ; (b) élimination des jumeaux et de la commande voisine par la répartition, le nombre de sorties, l'horodatage du premier paiement et la dépense commune ; (c) exploitation du rendu conservé hors du mixeur ; (d) tri des branches par leur comportement ultérieur ; (e) demande au casino sur l'adresse de dépôt. Sans le regroupement, la corrélation seule n'aurait fourni que des hypothèses, et la plus séduisante (le regroupement qui finit sur un exchange régulé) était fausse.`,
      },
      hints: [
        `Suivez le vol jusqu'à l'adresse de dépôt ${mixName} : le traçage direct s'arrête là, mais la transaction de dépôt a une seconde sortie.`,
        `Utilisez l'outil de corrélation avec ${mixName} comme émetteur, à partir de l'heure du dépôt, pour chaque part de la répartition : attendez-vous à plusieurs candidats par part.`,
        'Parmi les candidats, retenez ceux qui sont dépensés ensemble, puis comparez le regroupement obtenu à la commande saisie (nombre de sorties, répartition, premier paiement).',
        'Après le regroupement, plusieurs branches partent en moins de deux heures : suivez chacune jusqu\'à ce qu\'elle dorme, revienne ou entre chez un service.',
      ],
    }
  },
}
