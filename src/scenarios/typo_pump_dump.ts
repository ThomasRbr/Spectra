import { World, type Tx } from '../engine/world'
import { dex, exchange, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { roundAsset, usd } from '../engine/chains'
import { genAddress } from '../engine/addressgen'
import { dusting, personalSpending } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Pump and dump d'un jeton lancé sur une plateforme de lancement (MoonPad,
// fictive) sur BNB Smart Chain. Le jeton n'est pas un actif du moteur : seuls
// les flux de BNB sont représentés (achat = BNB vers la courbe ou le pool,
// vente = BNB du pool vers le vendeur). Les initiés achètent dans le bloc de
// lancement via des portefeuilles financés par une même source, un canal
// d'« appels » rémunéré fait monter le cours, puis ils revendent en bloc.
// La même équipe avait déjà fait le coup quelques semaines plus tôt, et le
// produit sort par un courtier OTC après un éclatement en branches (casino,
// cartes cadeaux, parking) et trois transferts jumeaux.

const TOKENS = [
  { name: 'Grenouille Turbo', ticker: 'GRENOU' },
  { name: 'Croissant Rocket', ticker: 'CROISS' },
  { name: 'Mistral Inu', ticker: 'MISTRAL' },
  { name: 'Pétanque Pepe', ticker: 'PETANQ' },
  { name: 'Camembert AI', ticker: 'CAMAI' },
  { name: 'Coq Doré', ticker: 'COQDOR' },
] as const
const CHANNELS = ['Moonshot Calls FR', 'Gem Hunters Club', 'Alpha Calls 100x', 'Degen Radar'] as const

const bnb = (v: number) => roundAsset('BNB', v)
const usdt = (v: number) => roundAsset('USDT', v)
const usd0 = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`
const heure = (ts: number) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

/** Heure de bureau (≈ 9 h – 17 h à Paris) le jour de `t` : plaintes, réponses et notes ne sont pas datées de la nuit. */
const office = (t: number) => Math.floor(t / 86400) * 86400 + 8 * 3600 + (t % (7 * 3600))

export const pumpDump: ScenarioTemplate = {
  id: 'pump-dump',
  title: 'Pump and dump sur une plateforme de lancement',
  tagline: 'Des achats groupés dans le premier bloc, un « call » payé, une revente éclair… et une équipe qui récidive.',
  description:
    'Un jeton lancé sur MoonPad s\'envole après la publication d\'un « call » sur un canal Telegram, puis s\'effondre en quelques minutes. Identifiez la source qui a financé les portefeuilles d\'initiés sans les confondre avec ceux d\'un lancement précédent, mesurez leur gain, prouvez la rémunération du canal, puis triez l\'éclatement du butin (casino, cartes cadeaux, parking, transferts jumeaux) jusqu\'au courtier OTC.',
  difficulty: 3,
  chains: ['bsc'],
  skills: ['evm', 'dex', 'defi', 'typologies', 'exchange_id', 'osint', 'gel'],
  estMinutes: 75,
  lessons: ['manipulation-marche', 'rug-pulls', 'dex-defi', 'comptes-evm', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimP = fakePerson(r)
    const g = victimP.g
    const tok = r.pick(TOKENS)
    const prevTok = r.pick(TOKENS.filter((t) => t !== tok))
    const T = `$${tok.ticker}`
    const PT = `$${prevTok.ticker}`
    const channel = r.pick(CHANNELS)
    const callerHandle = fakeHandle(r)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const fundKey = r.pick(['binance', 'okx'] as const)
    const kits = new Map<string, ExchangeKit>()
    const ex = (k: string) => {
      let x = kits.get(k)
      if (!x) kits.set(k, (x = exchange(w, k, 'bsc')))
      return x
    }
    const fund = ex(fundKey)
    const ramps = ['binance', 'okx', 'kraken'].map(ex)
    const otc = exchange(w, 'satsdesk', 'bsc')
    const pcs = dex(w, 'pancakeswap', 'bsc')
    const moonpad = w.entity('moonpad')
    // Commerçants propres au dossier (fictifs) : le casino et le revendeur de cartes cadeaux du groupe, le VPN de l'administrateur
    const casinoE = w.customEntity({ name: r.pick(['BetLune Casino', 'Casino Comète', 'SpinBNB']), category: 'gambling', known: true, description: 'Casino en ligne (fictif) acceptant BNB et USDT, sans vérification d\'identité.' })
    const giftE = w.customEntity({ name: r.pick(['Giftora', 'CartaCado', 'BonBNB']), category: 'merchant', known: true, description: 'Revendeur en ligne (fictif) de cartes cadeaux payables en crypto ; le code est livré par courriel.' })
    const vpnE = w.customEntity({ name: r.pick(['Tunnel Nord VPN', 'Brume VPN']), category: 'merchant', known: true, description: 'Fournisseur VPN payable en crypto (fictif) ; conserve l\'adresse électronique du compte.' })

    const groupE = w.customEntity({ name: 'Groupe d\'initiés (inconnu)', category: 'suspect' })
    const callerE = w.customEntity({ name: `Canal « ${channel} » (inconnu)`, category: 'individual' })
    const victimE = w.customEntity({ name: victimP.name, category: 'victim' })
    const curve = w.addr('bsc', { entity: moonpad, label: `MoonPad : courbe de prix ${T}`, contract: { name: `MoonPad Bonding Curve ${T}`, type: 'pool' } })
    const prevCurve = w.addr('bsc', { entity: moonpad, label: `MoonPad : courbe de prix ${PT}`, contract: { name: `MoonPad Bonding Curve ${PT}`, type: 'pool' } })
    const mpFee = w.addr('bsc', { entity: moonpad, label: 'MoonPad : frais de plateforme', tags: ['liquid'] })
    const pool = w.addr('bsc', { entity: pcs.entity, label: `PancakeSwap: Pool ${T}/WBNB`, contract: { name: `PancakeSwap ${T}/WBNB Pool`, type: 'pool' } })
    // Adresse du contrat du jeton : citée dans les annonces, sans flux de BNB propre.
    const tokenCa = genAddress(r, 'bsc', 'contract')

    const buy = (trader: string, value: number, time: number, to: string, venue: string, tk = T): Tx =>
      w.multi({ time, signer: trader, legs: [{ from: trader, to, value, asset: 'BNB' }], method: venue === 'mp' ? `buy (${tk}) — MoonPad` : `swapExactETHForTokens (BNB → ${tk})`, tags: ['swap'] })
    const sell = (trader: string, value: number, time: number, from: string, venue: string, tk = T): Tx =>
      w.multi({ time, signer: trader, legs: [{ from, to: trader, value, asset: 'BNB' }], method: venue === 'mp' ? `sell (${tk}) — MoonPad` : `swapExactTokensForETH (${tk} → BNB)`, tags: ['swap'] })

    // ── Chronologie ──────────────────────────────────────────────────────────
    const tL = w.at(0)
    const source = w.addr('bsc', { entity: groupE })
    const hub = w.addr('bsc', { entity: groupE })

    // 0. Lancement précédent de la même équipe (trois à quatre semaines plus tôt)
    const tPrev = tL - Math.round(r.float(20, 30) * DAY)
    const prevFundTx = fund.withdraw(source, bnb(r.float(5, 9)), tPrev - Math.round(r.float(1.5, 4) * DAY), 'BNB')
    const prevWallets = Array.from({ length: r.int(4, 6) }, () => w.addr('bsc', { entity: groupE }))
    const prevCreate = w.multi({ time: tPrev, signer: prevWallets[0], legs: [{ from: prevWallets[0], to: mpFee, value: 0.02, asset: 'BNB' }], method: `createToken (${PT}) — MoonPad` })
    const prevFunding: Tx[] = []
    const prevReturns: Tx[] = []
    const prevBuys = prevWallets.map(() => bnb(r.float(0.5, 1.6)))
    prevWallets.forEach((a, i) => {
      const v = prevBuys[i]
      prevFunding.push(w.transfer({ time: tPrev - r.int(50, 140) * 60 + i * r.int(20, 120), from: source, to: a, value: bnb(v + r.float(0.01, 0.03) + (i === 0 ? 0.02 : 0)), asset: 'BNB' }))
      buy(a, v, tPrev + 3, prevCurve, 'mp', PT)
    })
    for (let i = 0; i < r.int(6, 9); i++) {
      const a = w.addr('bsc')
      const t = tPrev + Math.round(r.float(0.2, 3) * HOUR)
      const v = bnb(r.float(0.2, 2.5))
      w.fundAccount(a, bnb(v + r.float(0.02, 0.4)), 'BNB', t - Math.round(r.float(1, 40) * HOUR))
      buy(a, v, t, prevCurve, 'mp', PT)
    }
    prevWallets.forEach((a, i) => {
      sell(a, bnb(prevBuys[i] * r.float(1.5, 2.4)), tPrev + Math.round(r.float(3.2, 4) * HOUR) + i * r.int(10, 60), prevCurve, 'mp', PT)
      // Les gains du lancement précédent remontent déjà vers l'adresse de regroupement
      prevReturns.push(w.transfer({ time: tPrev + Math.round(r.float(6, 10) * HOUR) + i * r.int(60, 400), from: a, to: hub, value: bnb(w.balanceOf(a, 'BNB')), asset: 'BNB' }))
    })
    const prevHubIn = bnb(prevReturns.reduce((s, t) => s + t.transfers[0].value, 0))
    // Train de vie entre les deux lancements : casino et cartes cadeaux depuis la trésorerie
    const hubSpend = personalSpending(w, hub, { start: tPrev + DAY, end: tL - 2 * DAY, n: r.int(3, 4), merchants: [casinoE, giftE], maxUsd: 350, asset: 'BNB' })

    // 1. La source des initiés est alimentée par un exchange
    const K = r.int(7, 10)
    const buys = Array.from({ length: K }, () => bnb(r.float(0.6, 2.8)))
    const createFee = 0.02
    const funds = buys.map((b, i) => bnb(b + r.float(0.01, 0.04) + (i === 0 ? createFee : 0)))
    const callFee = bnb(Math.round(r.float(1.5, 4) * 10) / 10)
    const srcTotal = bnb(funds.reduce((s, v) => s + v, 0) + callFee + r.float(0.5, 2))
    const fundTx = fund.withdraw(source, srcTotal, tL - Math.round(r.float(2, 5) * DAY), 'BNB')

    // 2. Paiement du canal d'appels (la veille), parmi d'autres annonceurs
    const callerAddr = w.addr('bsc', { entity: callerE })
    const callPay = w.transfer({ time: tL - Math.round(r.float(14, 30) * HOUR), from: source, to: callerAddr, value: callFee, asset: 'BNB' })
    const otherPromos: Tx[] = []
    for (let i = 0; i < r.int(5, 8); i++) {
      const p = w.addr('bsc')
      const v = bnb(Math.round(r.float(1.5, 4) * 10) / 10)
      const t = tL + Math.round(r.float(-24, 10) * DAY)
      w.fundAccount(p, bnb(v + r.float(0.05, 1)), 'BNB', t - Math.round(r.float(2, 48) * HOUR))
      otherPromos.push(w.transfer({ time: t, from: p, to: callerAddr, value: v, asset: 'BNB' }))
    }

    // 3. Financement groupé des portefeuilles d'initiés
    const insiders = Array.from({ length: K }, () => w.addr('bsc', { entity: groupE }))
    const creator = insiders[0]
    const tF = tL - Math.round(r.float(1, 3) * HOUR)
    const fundTxs = insiders.map((a, i) => w.transfer({ time: tF + i * r.int(20, 140), from: source, to: a, value: funds[i], asset: 'BNB' }))
    const fundedTotal = bnb(funds.reduce((s, v) => s + v, 0))

    // 4. Création du jeton puis achats groupés dans le bloc suivant
    const createTx = w.multi({ time: tL, signer: creator, legs: [{ from: creator, to: mpFee, value: createFee, asset: 'BNB' }], method: `createToken (${T}) — MoonPad` })
    const tB = tL + 3
    const bundle = insiders.map((a, i) => buy(a, buys[i], tB, curve, 'mp'))

    // Robots de sniping indépendants (financés par des exchanges, actifs ailleurs)
    const bots = Array.from({ length: 2 }, (_, i) => {
      const b = w.addr('bsc')
      r.pick(ramps).withdraw(b, bnb(r.float(4, 15)), tL - Math.round(r.float(5, 40) * DAY), 'BNB')
      const v = bnb(r.float(0.3, 1.5))
      buy(b, v, tB + 3 * (i + 1), curve, 'mp')
      sell(b, bnb(v * r.float(1.3, 2.2)), tL + Math.round(r.float(0.3, 1.2) * HOUR), curve, 'mp')
      return b
    })

    // 5. Acheteurs organiques sur la courbe, jusqu'à la migration
    const tG = tL + Math.round(r.float(2, 4.5) * HOUR)
    for (let i = 0; i < r.int(8, 12); i++) {
      const a = w.addr('bsc')
      const t = tL + Math.round(r.float(0.2, (tG - tL) / HOUR - 0.2) * HOUR)
      const v = bnb(r.float(0.1, 2))
      w.fundAccount(a, bnb(v + r.float(0.02, 0.5)), 'BNB', t - Math.round(r.float(1, 30) * HOUR))
      buy(a, v, t, curve, 'mp')
    }
    const migFee = bnb(w.balanceOf(curve, 'BNB') * 0.02)
    const migV = bnb(w.balanceOf(curve, 'BNB') - migFee)
    const migTx = w.multi({ time: tG, signer: curve, legs: [{ from: curve, to: pool, value: migV, asset: 'BNB' }, { from: curve, to: mpFee, value: migFee, asset: 'BNB' }], method: `migrate (${T}) — liquidité vers PancakeSwap` })

    // 6. Le « call » puis l'afflux d'acheteurs sur PancakeSwap
    const tC = tG + Math.round(r.float(20, 60) * 60)
    const tD = tC + Math.round(r.float(35, 80) * 60)
    const victim = w.addr('bsc', { entity: victimE })
    const vRamp = r.pick(ramps)
    // Vie ordinaire de la victime : achats sur exchange, un swap de stablecoins
    vRamp.withdraw(victim, bnb(r.float(0.3, 1.2)), tC - Math.round(r.float(60, 160) * DAY), 'BNB')
    pcs.swap({ trader: victim, assetIn: 'BNB', amountIn: bnb(r.float(0.1, 0.3)), assetOut: 'USDT', time: tC - Math.round(r.float(30, 55) * DAY) })
    const vBuy1V = bnb(r.float(1, 4))
    const vBuy2V = bnb(r.float(0.5, 2.5))
    const vFund = vRamp.withdraw(victim, bnb(vBuy1V + vBuy2V + r.float(0.05, 0.5)), tC - Math.round(r.float(1, 20) * DAY), 'BNB')
    const vBuy1 = buy(victim, vBuy1V, tC + Math.round(r.float(3, 15) * 60), pool, 'pcs')
    const vBuy2 = buy(victim, vBuy2V, tD - Math.round(r.float(3, 15) * 60), pool, 'pcs')
    const nPub = r.int(16, 24)
    for (let i = 0; i < nPub; i++) {
      const a = w.addr('bsc')
      const t = tC + Math.round(r.float(1, (tD - tC) / 60 + 25) * 60)
      const v = bnb(r.float(0.2, 5))
      w.fundAccount(a, bnb(v + r.float(0.02, 0.6)), 'BNB', t - Math.round(r.float(1, 72) * HOUR))
      buy(a, v, t, pool, 'pcs')
    }

    // 7. Revente groupée des initiés
    const poolBefore = w.balanceOf(pool, 'BNB')
    const dumpTotal = poolBefore * r.float(0.55, 0.68)
    const buySum = buys.reduce((s, b) => s + b, 0)
    const sells = buys.map((b) => bnb((dumpTotal * b) / buySum))
    const dumpTxs = insiders.map((a, i) => sell(a, sells[i], tD + i * r.int(15, 90), pool, 'pcs'))
    // Quelques acheteurs paniquent et revendent à perte
    for (let i = 0; i < r.int(3, 5); i++) {
      const a = w.addr('bsc')
      w.fundAccount(a, bnb(r.float(0.3, 2)), 'BNB', tC + r.int(60, 1800))
      buy(a, bnb(w.balanceOf(a, 'BNB') * 0.95), tC + r.int(1900, 2400), pool, 'pcs')
      sell(a, bnb(r.float(0.05, 0.3)), tD + Math.round(r.float(0.3, 3) * HOUR), pool, 'pcs')
    }

    // 8. Regroupement des gains sur la trésorerie, conversion en USDT
    const tHub = tD + Math.round(r.float(1, 3) * HOUR)
    const hubTxs = insiders.map((a, i) => w.transfer({ time: tHub + i * r.int(30, 300), from: a, to: hub, value: bnb(w.balanceOf(a, 'BNB')), asset: 'BNB' }))
    const hubIn = bnb(hubTxs.reduce((s, t) => s + t.transfers[0].value, 0))
    const profit = bnb(hubIn - fundedTotal)
    const swapIn = bnb(hubIn * r.float(0.9, 0.97))
    const sw = pcs.swap({ trader: hub, assetIn: 'BNB', amountIn: swapIn, assetOut: 'USDT', time: Math.max(...hubTxs.map((t) => t.time)) + Math.round(r.float(1, 3) * HOUR) })
    const U = sw.amountOut

    // 9. Éclatement : trois branches sans issue (casino, cartes cadeaux, parking)
    const gas = (to: string, time: number) => w.transfer({ time, from: hub, to, value: bnb(r.float(0.004, 0.012)), asset: 'BNB', method: 'transfer' })
    const tBr = sw.tx.time + Math.round(r.float(1, 4) * HOUR)
    const bCasino = w.addr('bsc', { entity: groupE })
    const bCard = w.addr('bsc', { entity: groupE })
    const bPark = w.addr('bsc', { entity: groupE })
    const vCas = usdt(Math.round((U * r.float(0.08, 0.12)) / 10) * 10)
    const vCard = usdt(Math.round((U * r.float(0.04, 0.07)) / 10) * 10)
    const vPark = usdt(Math.round((U * r.float(0.15, 0.2)) / 10) * 10)
    const brOrder = r.shuffle([0, 1, 2])
    const brT = brOrder.map((k) => tBr + k * r.int(8, 45) * 60)
    gas(bCasino, brT[0] - r.int(3, 9) * 60)
    const brCasTx = w.transfer({ time: brT[0], from: hub, to: bCasino, value: vCas, asset: 'USDT' })
    gas(bCard, brT[1] - r.int(3, 9) * 60)
    const brCardTx = w.transfer({ time: brT[1], from: hub, to: bCard, value: vCard, asset: 'USDT' })
    gas(bPark, brT[2] - r.int(3, 9) * 60)
    const brParkTx = w.transfer({ time: brT[2], from: hub, to: bPark, value: vPark, asset: 'USDT' })
    // Casino : dépôts successifs jusqu'à épuisement
    const orbitDep = w.addr('bsc', { entity: casinoE, label: `${casinoE.name} — Adresse de dépôt`, tags: ['deposit'] })
    const nCas = r.int(2, 3)
    let leftCas = vCas
    for (let i = 0; i < nCas; i++) {
      const v = i === nCas - 1 ? leftCas : usdt(Math.round((vCas * r.float(0.25, 0.45)) / 10) * 10)
      leftCas = usdt(leftCas - v)
      w.transfer({ time: brT[0] + Math.round(r.float(2, 30) * HOUR) + i * Math.round(r.float(6, 20) * HOUR), from: bCasino, to: orbitDep, value: v, asset: 'USDT' })
    }
    // Cartes cadeaux : achats chez le revendeur jusqu'à épuisement
    const nCard = r.int(3, 4)
    let leftCard = vCard
    for (let i = 0; i < nCard; i++) {
      const v = i === nCard - 1 ? leftCard : usdt(r.pick([100, 150, 200, 250]) * (vCard > 1500 ? 2 : 1))
      if (v <= 0 || v > leftCard) continue
      leftCard = usdt(leftCard - v)
      const shop = w.addr('bsc', { entity: giftE, label: `${giftE.name} — Paiement` })
      w.transfer({ time: brT[1] + Math.round(r.float(3, 20) * HOUR) + i * Math.round(r.float(4, 30) * HOUR), from: bCard, to: shop, value: v, asset: 'USDT' })
    }
    // Parking : renvoyé intégralement à la trésorerie le lendemain
    const parkBack = w.transfer({ time: brT[2] + Math.round(r.float(20, 30) * HOUR), from: bPark, to: hub, value: vPark, asset: 'USDT' })

    // 10. L'administrateur du canal encaisse ses recettes (le lendemain du call)
    const callerKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const callerKit = ex(callerKey)
    const tCash = tD + Math.round(r.float(24, 40) * HOUR)
    const promosBefore = otherPromos.filter((p) => p.time < tCash)
    // Petites dépenses de l'administrateur, toujours couvertes par un paiement déjà reçu (≥ 1,5 BNB)
    const firstPromo = Math.min(callPay.time, ...otherPromos.map((p) => p.time))
    const callerSpend = personalSpending(w, callerAddr, { start: firstPromo + DAY, end: firstPromo + 30 * DAY, n: r.int(3, 4), merchants: [vpnE, giftE], maxUsd: 120, asset: 'BNB' })
    // Encaissement : 90 % du solde réellement détenu à cet instant
    const callerHeld = w.txsOf(callerAddr).filter((t) => t.time < tCash).reduce((s, t) => s + t.transfers.filter((x) => x.asset === 'BNB').reduce((a, x) => a + (x.to === callerAddr ? x.value : 0) - (x.from === callerAddr ? x.value : 0), 0), 0)
    const cashV = bnb(callerHeld * 0.9)
    const callerCash = callerKit.receive(callerAddr, cashV, tCash, { asset: 'BNB', sweepDelayH: r.float(0.5, 4) })

    // 11. Sortie : trois transferts jumeaux, un seul mène au courtier OTC
    const tS = tD + Math.round(r.float(2.6, 4) * DAY)
    const balS = w.balanceOf(hub, 'USDT')
    const V = usdt(Math.floor(balS * r.float(0.27, 0.3)))
    const M = w.addr('bsc', { entity: groupE })
    const gasM = gas(M, tS - r.int(6, 15) * 60)
    const mainTx = w.transfer({ time: tS, from: hub, to: M, value: V, asset: 'USDT' })
    const twinOffsets = [r.int(-24, -3), r.int(3, 24)]
    const twins = r.shuffle(twinOffsets).map((off, i) => {
      const to = w.addr('bsc', { entity: groupE })
      const v = usdt(Math.round(V * (1 + (i === 0 ? -1 : 1) * r.float(0.0008, 0.004))))
      return { to, tx: w.transfer({ time: tS + off * 60, from: hub, to, value: v, asset: 'USDT' }) }
    })
    const dep = otc.newDeposit()
    const u1 = usdt(Math.round((V * r.float(0.55, 0.7)) / 100) * 100)
    const d1 = otc.receive(M, u1, tS + r.int(30, 90) * 60, { asset: 'USDT', depositAddr: dep, sweepDelayH: r.float(0.3, 2) })
    const d2 = otc.receive(M, usdt(V - u1), d1.tx.time + Math.round(r.float(3, 10) * HOUR), { asset: 'USDT', depositAddr: dep, sweepDelayH: r.float(0.3, 2) })

    // Empoisonnement d'adresse sur la trésorerie (micro-envois d'USDT par des sosies)
    dusting(w, hub, { time: tHub + 2 * DAY, n: r.int(2, 3), spreadH: 40, token: 'USDT' })

    // ── Bruit ────────────────────────────────────────────────────────────────
    pcs.noise(24, tL - 2 * DAY, tL + 4 * DAY, [['BNB', 'USDT'], ['BNB', 'USDC']])
    otc.noise(10, tL - 3 * DAY, tS + 4 * DAY, 'USDT')
    fund.noise(10, prevFundTx.time - 3 * DAY, tL + 2 * DAY, 'BNB')
    callerKit.noise(6, tL - 2 * DAY, tL + 5 * DAY, 'BNB')

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const launchBlock = bundle[0].block
    const victimLoss = bnb(vBuy1V + vBuy2V)
    const callToDump = Math.round((dumpTxs[0].time - tC) / 60)
    const deposited = usdt(d1.tx.transfers[0].value + d2.tx.transfers[0].value)
    const promoCount = promosBefore.length + 1
    const twinHeld = usdt(twins.reduce((s, x) => s + w.balanceOf(x.to, 'USDT'), 0))
    const hubUsdtLeft = usdt(w.balanceOf(hub, 'USDT'))
    const otcName = otc.entity.name
    const casinoTotal = vCas
    const prevDaysBefore = Math.round((tL - tPrev) / DAY)
    const twinLines = [{ to: M, tx: mainTx }, ...twins].sort((a, b) => a.tx.time - b.tx.time)
    const twDay0 = fmtDate(twinLines[0].tx.time, false)
    const twDay1 = fmtDate(twinLines[2].tx.time, false)
    const twWhen = twDay0 === twDay1 ? `Le ${twDay0}` : `Entre le ${twDay0} et le ${twDay1}`
    // Ce que les dépenses ont réellement payé (lu dans le monde, pas supposé)
    const paidTo = (d: { addresses: string[] }) => {
      const names = [...new Set(d.addresses.map((a) => w.get(a).entityId).filter((x): x is string => !!x))].map((id) => w.entities.get(id)!.name)
      const people = d.addresses.filter((a) => !w.get(a).entityId).length
      const parts = [...names, ...(people ? [people > 1 ? 'des particuliers' : 'un particulier'] : [])]
      return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}` : parts[0]
    }
    const hubPaid = paidTo(hubSpend)
    const callerPaid = paidTo(callerSpend)

    return {
      world: w,
      title: `Pump and dump ${T} — ${city}`,
      briefing:
        `${victimP.name}, demeurant à ${city}, dépose plainte : ${g('il', 'elle')} a acheté le jeton « ${tok.name} » (${T}) après un « call » publié sur le canal Telegram « ${channel} », qui annonçait « le prochain x100 ». Peu après, le cours s'est effondré d'environ 80 % en quelques minutes.\n\n` +
        `Le jeton a été créé sur MoonPad, une plateforme de lancement où le prix suit une courbe automatique avant l'introduction sur PancakeSwap. Le jeton lui-même n'apparaît pas sur le graphe : seuls les BNB (et les USDT de la sortie) sont représentés. Un achat se lit comme un envoi de BNB vers la courbe ou le pool, une vente comme un versement de BNB du pool vers le vendeur.\n\n` +
        `Objectifs : établir si un groupe d'initiés a acheté dès le lancement et revendu en bloc après le call, remonter à la source de leur financement, mesurer leur gain, prouver le lien avec le canal d'appels, puis suivre le produit à travers ses ramifications jusqu'au point d'encaissement, en repérant ce qui peut encore être gelé.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: office(tD + 2 * DAY), author: victimP.name,
          body:
            `« Je suis abonné${g('', 'e')} au canal « ${channel} ». Quand le call ${T} est tombé, j'ai acheté tout de suite sur PancakeSwap, puis j'ai renforcé un peu plus tard. Quelques minutes après, le graphique s'est écroulé d'un coup.\n\n` +
            `Mon adresse : ${A(w, victim)}\n` +
            `Premier achat (${amt(vBuy1V, 'BNB')}) : ${vBuy1.hash}\n` +
            `Second achat (${amt(vBuy2V, 'BNB')}) : ${vBuy2.hash}\n\n` +
            `J'y ai mis environ ${usd0(usd('BNB', victimLoss))}, et mes jetons ne valent presque plus rien. Un membre du canal dit que le même scénario s'était produit il y a quelques semaines avec ${PT}. »`,
        },
        {
          id: 'telegram', type: 'telegram', title: `Canal « ${channel} » (message du ${fmtDate(tC)})`, author: `@${callerHandle}`, date: tC,
          body:
            `🚨🚨 CALL DU JOUR 🚨🚨\n` +
            `${T} — ${tok.name}\n` +
            `CA : ${tokenCa}\n` +
            `Pool PancakeSwap : ${A(w, pool)}\n` +
            `Vient de quitter MoonPad ✅ Communauté organique ✅ Dev safu ✅\n` +
            `Objectif x100, on ne rate pas celui-là 🚀🚀\n` +
            `(NFA, DYOR)`,
        },
        {
          id: 'capture', type: 'capture', title: `Page MoonPad du jeton ${T} (capture d'un acheteur)`, date: tG - 30 * 60,
          body:
            `${tok.name} (${T}) — Courbe : ${Math.round(r.float(88, 97))} % vers PancakeSwap\n` +
            `Créé par ${A(w, creator)} le ${fmtDate(tL)}\n` +
            `Courbe de prix : ${A(w, curve)}\n` +
            `Détenteurs : ${K + 2 + r.int(8, 12)} · « Dev a vendu : non »`,
        },
        {
          id: 'osint', type: 'osint', title: `Note OSINT sur le canal « ${channel} »`, date: office(tD + 3 * DAY), author: 'Cellule cyber',
          body:
            `Canal d'environ ${r.int(18, 60)} 000 abonnés, administré par @${callerHandle}. Une grille tarifaire circule en message privé : « call sponsorisé » entre 1,5 et 4 BNB, paiement préalable.\n` +
            `Adresse de paiement indiquée aux annonceurs : ${A(w, callerAddr)}\n` +
            `Les calls ne mentionnent jamais leur caractère sponsorisé. Le ${fmtDate(tPrev, false)}, le canal avait déjà publié un call sur ${PT} (MoonPad), lui aussi effondré dans l'heure.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : lancements, achats groupés et frais de réseau', date: office(tD + 3 * DAY), author: 'Cellule d\'appui',
          body:
            `• Sur une plateforme de lancement, le prix monte mécaniquement avec chaque achat le long de la courbe : acheter dans le tout premier bloc, c'est acheter au prix le plus bas.\n` +
            `• Un « bundle » est un ensemble d'achats soumis ensemble, souvent dans le bloc du lancement, depuis des portefeuilles neufs. Leur financement commun et récent est la signature d'un même opérateur. Un opérateur qui récidive réutilise souvent la même source ou la même trésorerie : datez chaque financement.\n` +
            `• Les robots de sniping indépendants achètent aussi très tôt ; ils se distinguent par leur historique (autres lancements, financement ancien et distinct).\n` +
            `• Un jeton BEP-20 (USDT) ne peut être déplacé que si l'adresse détient du BNB pour payer les frais. Une adresse qui reçoit des USDT sans jamais recevoir de BNB ne peut pas les dépenser : elle sert de réserve.\n` +
            `• BNB Smart Chain produit un bloc toutes les 3 secondes environ.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle adresse a financé les portefeuilles des initiés ?',
          answer: [source],
          hint: 'Partez du créateur affiché sur la page MoonPad : remontez son premier financement, puis regardez qui d\'autre cette adresse a financé juste avant le lancement.',
          explanation: `${A(w, source)}, alimentée par ${fund.entity.name}, envoie des BNB à ${K} portefeuilles neufs en quelques minutes, ${Math.round((tL - tF) / 60)} minutes environ avant la création du jeton. C'est la source commune des achats groupés. Son historique trahit une récidive : ${prevDaysBefore} jours plus tôt, elle avait déjà financé ${prevWallets.length} portefeuilles qui ont acheté ${PT} dans le bloc de son lancement. ${procedureFor(fund.entity)}`,
        },
        {
          id: 'o2', type: 'addresses', points: 12,
          prompt: `Quels portefeuilles ont acheté ${T} dans le bloc de lancement pour le compte du groupe ?`,
          answer: insiders,
          hint: `La source a financé deux séries de portefeuilles neufs : ne retenez que ceux qui achètent sur la courbe ${T}, dans le bloc qui suit la création.`,
          explanation: `Les ${K} portefeuilles (dont le créateur ${A(w, creator)}) achètent pour ${amt(bnb(buySum), 'BNB')} dans le bloc ${launchBlock.toLocaleString('fr-FR')}, trois secondes après la création. Les ${prevWallets.length} portefeuilles financés par la même source le ${fmtDate(prevFunding[0].time, false)} appartiennent au même groupe mais ont servi au lancement précédent (${PT}, autre courbe MoonPad) : ils documentent la récidive, pas ce lancement-ci. Les deux autres acheteurs très précoces de ${T} sont des robots indépendants : financés par des exchanges plusieurs jours, voire des semaines, avant le lancement, ils revendent bien avant le call et ne renvoient rien au groupe.`,
        },
        {
          id: 'o9', type: 'number', points: 10, tolerance: 2, unit: 'minutes',
          prompt: 'Combien de minutes séparent la publication du call de la première revente des initiés ?',
          answer: callToDump,
          hint: 'L\'heure du call figure sur le message Telegram ; la première revente est la plus ancienne des transactions où le pool PancakeSwap verse des BNB à l\'un des portefeuilles du groupe.',
          explanation: `Call publié le ${fmtDate(tC)} ; première revente des initiés le ${fmtDate(dumpTxs[0].time)}, soit environ ${callToDump} minutes plus tard, et les ${K} ventes s'enchaînent en quelques minutes sur le pool PancakeSwap ${A(w, pool)}. Ce délai court est typique : le call déclenche l'afflux d'acheteurs, les initiés vendent au sommet dans la foulée. Rapprochée du paiement du canal la veille, cette chronologie est l'un des éléments les plus parlants du dossier.`,
        },
        {
          id: 'o8', type: 'address', points: 10,
          prompt: 'Sur quelle adresse les initiés regroupent-ils le produit de leurs ventes ?',
          answer: [hub],
          hint: 'Après la revente, suivez la sortie de BNB de plusieurs portefeuilles du groupe : ils se vident tous vers la même adresse.',
          explanation: `Entre une et trois heures après le dump, les ${K} portefeuilles envoient tout leur solde à ${A(w, hub)} (${amt(hubIn, 'BNB')} au total). Ce n'est pas une adresse neuve : elle avait déjà reçu les gains des portefeuilles du lancement ${PT} (${amt(prevHubIn, 'BNB')}) et payé dans l'intervalle ${hubPaid}. C'est la trésorerie du groupe, d'où partent la conversion en USDT et l'éclatement du butin. Attention aux adresses sosies qui lui envoient des micro-montants d'USDT : elles imitent ses premiers et derniers caractères (empoisonnement) et n'ont aucun rôle.`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'BNB', tolerance: 0.03,
          prompt: 'Quel gain net (en BNB) les initiés ont-ils réalisé sur ce lancement ?',
          answer: profit,
          hint: 'Comparez ce que la source a versé aux initiés avec ce que les initiés ont reversé, après leurs ventes, à leur adresse de regroupement. Ne mélangez pas avec le lancement précédent.',
          explanation: `Les initiés reçoivent ${amt(fundedTotal, 'BNB')} de la source, achètent pour ${amt(bnb(buySum), 'BNB')}, revendent pour ${amt(bnb(sells.reduce((s, v) => s + v, 0)), 'BNB')}, puis reversent ${amt(hubIn, 'BNB')} à ${A(w, hub)}. Gain net : ${amt(profit, 'BNB')} (≈ ${usd0(usd('BNB', profit))}), sans compter les ${amt(callFee, 'BNB')} payés au canal. Les ${amt(prevHubIn, 'BNB')} reçus des semaines plus tôt relèvent du lancement ${PT} : à chiffrer séparément.`,
        },
        {
          id: 'o13', type: 'tx', points: 12,
          prompt: `${twWhen}, trois transferts d'environ ${amt(V, 'USDT')} quittent la trésorerie à quelques minutes d'intervalle. Lequel est la continuation vers le point d'encaissement ?`,
          answer: [mainTx.id],
          hint: 'Les montants ne départagent pas les trois transferts : regardez ce que reçoit chaque destinataire juste avant (frais de réseau) et ce qu\'il fait ensuite.',
          explanation:
            `${twinLines.map((x) => `${heure(x.tx.time)} → ${A(w, x.to).slice(0, 12)}… (${amt(x.tx.transfers[0].value, 'USDT')})`).join(' ; ')}. ` +
            `Seule ${A(w, M)} a reçu de la trésorerie ${amt(gasM.transfers[0].value, 'BNB')} de frais de réseau ${Math.round((tS - gasM.time) / 60)} minutes avant, et seule elle dépense ensuite : deux dépôts chez ${otcName}. Les deux autres destinataires n'ont jamais reçu de BNB : ils ne peuvent pas déplacer leurs USDT et ne bougent plus. Ce sont des réserves, pas la sortie. ` +
            `Plus tôt, la trésorerie avait déjà éclaté une partie du butin en trois branches sans issue : ${amt(vCas, 'USDT')} joués sur ${casinoE.name}, ${amt(vCard, 'USDT')} dépensés en cartes cadeaux ${giftE.name}, et ${amt(vPark, 'USDT')} garés environ un jour sur une adresse avant de revenir intégralement à la trésorerie.`,
        },
        {
          id: 'o5', type: 'entity', points: 10,
          prompt: 'Chez quel prestataire le produit principal de la manipulation est-il encaissé ?',
          answer: ['satsdesk'],
          hint: 'Suivez la continuation identifiée parmi les transferts jumeaux jusqu\'à une adresse étiquetée.',
          explanation: `${A(w, M)} dépose en deux fois sur ${A(w, dep)}, adresse de dépôt ${de(otcName)}, courtier de gré à gré (USDT contre espèces ou virements). Un OTC offshore n'est pas un exchange régulé : KYC faible, pas de gel possible, coopération par entraide uniquement. ${procedureFor(otc.entity)} Les autres pistes (casino, cartes cadeaux) restent secondaires : ${casinoE.name} n'applique pas de KYC, ${giftE.name} peut au mieux fournir l'adresse électronique de livraison des cartes.`,
        },
        {
          id: 'o10', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDT a été déposé chez ce courtier ?',
          answer: deposited,
          hint: 'Additionnez les deux dépôts faits sur la même adresse de dépôt du courtier.',
          explanation: `${amt(d1.tx.transfers[0].value, 'USDT')} le ${fmtDate(d1.tx.time)} puis ${amt(d2.tx.transfers[0].value, 'USDT')} le ${fmtDate(d2.tx.time)}, soit ${amt(deposited, 'USDT')} sur ${A(w, dep)} : exactement le montant transmis par la trésorerie. C'est le chiffre à porter dans la demande d'entraide visant ${otcName}, avec les deux hash de dépôt.`,
        },
        {
          id: 'o14', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT restent immobilisés sur les deux destinataires des transferts jumeaux qui ne mènent pas au courtier ?',
          answer: twinHeld,
          hint: 'Ouvrez les deux adresses écartées et lisez leur solde en USDT : elles n\'ont rien dépensé.',
          explanation: `${twins.map((x) => `${A(w, x.to)} : ${amt(w.balanceOf(x.to, 'USDT'), 'USDT')}`).join(' ; ')}, soit ${amt(twinHeld, 'USDT')}. Faute de BNB pour les frais, ces fonds n'ont pas pu bouger : ils sont encore sur des adresses auto-hébergées du groupe, donc gelables par l'émetteur de l'USDT. La trésorerie elle-même conserve ${amt(hubUsdtLeft, 'USDT')} au moment de l'analyse, à viser dans la même demande.`,
        },
        {
          id: 'o6', type: 'tx', points: 10,
          prompt: 'Quelle transaction prouve la rémunération du canal d\'appels par le groupe d\'initiés ?',
          answer: [callPay.id],
          hint: 'L\'adresse de paiement du canal reçoit de nombreux annonceurs : un seul paiement vient de la source commune.',
          explanation: `Le ${fmtDate(callPay.time)}, la source commune verse ${amt(callFee, 'BNB')} à l'adresse de paiement du canal, la veille du call. Les ${otherPromos.length} autres paiements reçus par cette adresse viennent d'annonceurs sans lien avec ${T}. Le call n'était donc pas une recommandation spontanée mais une promotion payée par ceux qui allaient revendre.`,
        },
        {
          id: 'o11', type: 'entity', points: 10,
          prompt: 'Sur quelle plateforme l\'administrateur du canal encaisse-t-il les paiements de ses annonceurs ?',
          answer: [callerKey],
          hint: 'Suivez la plus grosse sortie de l\'adresse de paiement du canal citée dans la note OSINT (les petites sorties sont des achats courants).',
          explanation: `Le ${fmtDate(callerCash.tx.time)}, l'adresse de paiement du canal envoie ${amt(callerCash.tx.transfers[0].value, 'BNB')}, soit l'essentiel du solde laissé par les ${promoCount} paiements reçus jusque-là, à ${A(w, callerCash.deposit)}, adresse de dépôt ${callerKit.entity.name}. Les autres sorties sont de petits paiements (${callerPaid}). Le compte client permettra d'identifier @${callerHandle}, dont la responsabilité (promotion payée non signalée comme telle, connaissance ou non du projet de revente) reste à apprécier. ${procedureFor(callerKit.entity)}`,
        },
        {
          id: 'o12', type: 'choice', points: 10,
          prompt: 'Quelle mesure conservatoire est la plus urgente pour préserver le produit de la manipulation ?',
          hint: 'Où se trouvent les fonds au moment où vous agissez, et qui peut techniquement les bloquer vite ?',
          ...choice(r,
            'Demander à Tether de geler les USDT encore détenus par les adresses du groupe (réserves jumelles, trésorerie), puis engager l\'entraide vers le courtier',
            [
              `Requérir ${otcName} de geler le compte client : le courtier est tenu de bloquer les fonds sous 24 heures`,
              'Demander à PancakeSwap de geler le pool et d\'annuler les ventes des initiés',
              'Demander à MoonPad de retirer le jeton, ce qui restituera automatiquement les BNB aux acheteurs',
            ]),
          explanation: `Les USDT encore sur des adresses auto-hébergées (${amt(twinHeld, 'USDT')} sur les réserves jumelles, ${amt(hubUsdtLeft, 'USDT')} sur la trésorerie) peuvent être bloqués par Tether, émetteur du jeton, en quelques jours : c'est la mesure la plus rapide et la plus sûre. ${otcName}, courtier offshore, ne pratique pas le gel et ne répond que par entraide internationale (plusieurs mois). PancakeSwap et MoonPad sont des contrats sans opérateur capable d'annuler une transaction ; retirer un jeton de l'interface ne rembourse personne. ${procedureFor(w.entity('tether'))}`,
        },
        {
          id: 'o7', type: 'choice', points: 10,
          prompt: 'Quels éléments établissent la coordination entre les initiés ?',
          ...choice(r,
            'Financement commun juste avant le lancement, achats dans un même bloc, revente groupée après le call, gains regroupés sur une trésorerie déjà utilisée',
            [
              'Le simple fait d\'avoir acheté tôt et revendu avec profit, qui suffit à rattacher chaque acheteur précoce à la manipulation',
              'La chute du cours après le call, qui démontre à elle seule que l\'administrateur du canal a organisé toute l\'opération',
              'Le recours à MoonPad, plateforme de lancement réservée aux projets frauduleux, qui suffit à caractériser l\'entente',
            ]),
          explanation: `Chaque indice pris seul est fragile ; c'est leur convergence qui fait la preuve : même source (${A(w, source).slice(0, 10)}…), même bloc d'achat, ventes dans la même fenêtre, gains regroupés sur une seule adresse, paiement du canal par la même source, et répétition du schéma sur ${PT}. Les robots qui ont aussi acheté tôt ne présentent aucun de ces liens. Selon que le jeton est ou non admis sur une plateforme régulée, les faits peuvent relever de la manipulation de marché prévue par le règlement MiCA ou de qualifications de droit commun (escroquerie, pratiques commerciales trompeuses) ; la qualification revient au parquet.`,
        },
      ],
      truth: {
        path: [
          vFund.id, vBuy1.id, vBuy2.id, fundTx.id, callPay.id, ...fundTxs.map((t) => t.id), createTx.id, ...bundle.map((t) => t.id), migTx.id,
          ...dumpTxs.map((t) => t.id), ...hubTxs.map((t) => t.id), sw.tx.id, callerCash.tx.id, gasM.id, mainTx.id,
          d1.tx.id, ...(d1.sweep ? [d1.sweep.id] : []), d2.tx.id, ...(d2.sweep ? [d2.sweep.id] : []),
        ],
        addresses: [pool, source, ...insiders, callerAddr, hub, M, dep, curve, callerCash.deposit, ...twins.map((x) => x.to)],
        debrief:
          `0. ${prevDaysBefore} jours avant les faits, la même source ${A(w, source)} finance ${prevWallets.length} portefeuilles qui achètent ${PT} dans son bloc de lancement ; leurs gains (${amt(prevHubIn, 'BNB')}) remontent vers ${A(w, hub)}, qui paie ensuite ${hubPaid}.\n` +
          `1. ${fund.entity.name} alimente de nouveau la source (${amt(srcTotal, 'BNB')}). La veille du lancement, elle paie ${amt(callFee, 'BNB')} au canal « ${channel} ».\n` +
          `2. Une à trois heures avant le lancement, elle finance ${K} portefeuilles neufs (${amt(fundedTotal, 'BNB')}).\n` +
          `3. Le ${fmtDate(tL)}, l'un d'eux crée ${T} sur MoonPad ; trois secondes plus tard, les ${K} portefeuilles achètent ensemble sur la courbe (${amt(bnb(buySum), 'BNB')}), au prix le plus bas. ${bots.length} robots indépendants achètent aussi tôt.\n` +
          `4. Des acheteurs organiques font progresser la courbe jusqu'à la migration vers PancakeSwap (${amt(migV, 'BNB')}).\n` +
          `5. Le call est publié le ${fmtDate(tC)} ; ${nPub + 1} acheteurs, dont ${victimP.name} (${amt(victimLoss, 'BNB')}), se ruent sur le pool. À partir du ${fmtDate(tD)}, les initiés revendent tout en quelques minutes.\n` +
          `6. Les gains sont regroupés sur la trésorerie (${amt(hubIn, 'BNB')}, gain net ${amt(profit, 'BNB')}) et convertis en ${amt(U, 'USDT')}.\n` +
          `7. Fausses pistes : trois branches partent de la trésorerie (${amt(casinoTotal, 'USDT')} joués sur ${casinoE.name}, ${amt(vCard, 'USDT')} en cartes cadeaux ${giftE.name}, ${amt(vPark, 'USDT')} garés puis rendus environ un jour plus tard). Puis trois transferts jumeaux d'environ ${amt(V, 'USDT')} : deux vers des réserves sans BNB, immobiles (${amt(twinHeld, 'USDT')}), un seul vers ${A(w, M)}, qui reçoit ses frais de réseau et dépose ${amt(deposited, 'USDT')} chez ${otcName}.\n` +
          `8. L'administrateur du canal transfère ses recettes publicitaires (${amt(callerCash.tx.transfers[0].value, 'BNB')}) vers son compte ${callerKit.entity.name}.\n\n` +
          `À retenir : dans un pump and dump, la blockchain conserve la chronologie complète. Le financement commun révèle le groupe (en datant chaque financement pour ne pas mélanger deux lancements), le bloc de lancement révèle l'avantage pris, la fenêtre de vente révèle la concertation, et le paiement du canal relie la promotion aux vendeurs. Face à des transferts jumeaux, les montants ne servent à rien : ce sont les frais de réseau reçus et le comportement ultérieur qui désignent la vraie continuation. Mesures : gel Tether des USDT encore auto-hébergés, réquisition ${fund.entity.name} (origine des fonds), entraide vers ${otcName}, réquisition ${callerKit.entity.name} (administrateur du canal).`,
      },
      hints: [
        'Depuis l\'achat de la victime, ouvrez le pool : sa première transaction est la migration depuis la courbe MoonPad, dont l\'historique montre les tout premiers achats.',
        'Les achats du bloc de lancement viennent de portefeuilles neufs : remontez le financement de chacun, et datez les financements de la source pour écarter ceux d\'un autre lancement.',
        'Le gain net se calcule entre deux adresses : ce que la source a versé aux initiés et ce que les initiés ont reversé ensuite.',
        'L\'adresse de paiement du canal figure dans la note OSINT : cherchez parmi ses entrées celle qui vient de la source, puis regardez où part sa plus grosse sortie.',
        'Après la conversion en USDT, la trésorerie éclate le butin : suivez chaque branche jusqu\'à son terme (dépensée, rendue, immobile, encaissée). Seule une adresse munie de BNB peut déplacer ses USDT.',
      ],
    }
  },
}
