import { World, type Tx } from '../engine/world'
import { atm, exchange, HOUR, DAY } from '../engine/patterns'
import { createHdWallet } from '../engine/hd'
import { EUR_USD, fromUsd, roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fmtDate, forwardAll, procedureFor, receivedIn } from './util'

const r2 = (v: number) => Math.round(v * 100) / 100
const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const fmtUsdInt = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`
const PRICES = [20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250]
/** Menu du canal : chaque prix correspond à un article (montants « tarifés »). */
const MENU: Record<number, string> = { 20: 'Beuh 2 g', 40: 'Beuh 5 g', 80: 'Beuh 10 g', 200: 'Beuh 25 g', 30: 'Résine 5 g', 50: 'Résine 10 g', 100: 'Résine 25 g', 60: 'C 1 g', 120: 'C 2 g', 250: 'C 5 g', 150: 'Pack soirée' }
type Perso = 'mullvad' | 'orbit' | 'cardhub' | 'proche'
const PERSO: Perso[] = ['mullvad', 'orbit', 'cardhub', 'proche', 'orbit']
const CHANNELS = ['🍀 Le Trèfle Livraison', '❄️ Snow Express', '🌿 Green Delivery', '🚀 Fusée Drive', '🔥 Le Comptoir']
const CASINOS = ['BetZénith', 'SpinFlash', 'Royal Écu'] as const
const GIFTS = ['Kdo-Express', 'PrépayéShop', 'CadeauCash'] as const
const SHOPS = ['bureau de tabac de la place du Marché', 'bureau de tabac de l\'avenue de la Gare', 'centre commercial des Portes, niveau 0', 'tabac-presse du boulevard Victor-Hugo']

/** Début du jour calendaire (heure de Paris) contenant `ts`. */
function parisDayStart(ts: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts * 1000))
  const g = (k: string) => Number(parts.find((p) => p.type === k)?.value ?? 0)
  return ts - (g('hour') * 3600 + g('minute') * 60 + g('second'))
}

interface Payment {
  tx: Tx
  chain: 'btc' | 'tron'
  usd: number
  week: number
}

export const btcStupsTelegram: ScenarioTemplate = {
  id: 'stups-telegram',
  title: 'Le canal Telegram du quartier',
  tagline: 'Un menu tarifé sur Telegram, des dizaines de petits paiements, un livreur, un grossiste, un gérant qui vit sur la caisse… et un distributeur de billets.',
  description:
    'Un réseau local de trafic de stupéfiants vend par l\'intermédiaire d\'un canal Telegram. Les clients paient les prix du menu en bitcoins ou en USDT (Tron) sur des adresses renouvelées chaque semaine. Un achat a été réalisé dans le cadre d\'une enquête sous pseudonyme. Remontez jusqu\'aux collecteurs, chiffrez l\'activité, puis triez leurs sorties : tickets de distributeur, dépenses personnelles du gérant, paie du livreur, règlements au grossiste et au courtier OTC.',
  difficulty: 2,
  chains: ['btc', 'tron'],
  skills: ['utxo', 'cioh', 'tron', 'tokens', 'exchange_id', 'requisition'],
  estMinutes: 52,
  lessons: ['stupefiants-crypto', 'dab-cash-p2p', 'tron-usdt', 'portefeuilles-hd', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const channel = r.pick(CHANNELS)
    const admin = fakeHandle(r)
    const alias = r.pick(['Léo_92', 'Max.R', 'Nico B', 'Sam_K', 'Yanis.L'])
    const shop = r.pick(SHOPS)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const dab = atm(w, 'cryptoguichet', 'btc')
    const cv = exchange(w, 'coinhouse', 'btc')
    const exT = exchange(w, r.pick(['binance', 'okx'] as const), 'tron')
    const satsdesk = w.entity('satsdesk')
    const otc = w.addr('tron', { entity: satsdesk, label: 'SatsDesk OTC — Portefeuille de règlement', tags: ['liquid', 'hot'] })
    const net = w.customEntity({ name: `Réseau « ${channel.replace(/^\S+ /, '')} » (non identifié)`, category: 'suspect' })
    const ucE = w.customEntity({ name: 'Service enquêteur (achat sous pseudonyme)', category: 'individual' })
    const hd = createHdWallet(w, { chain: 'btc', kind: 'p2wpkh', entity: net, label: 'Caisse BTC du canal' })
    const K = w.addr('btc', { entity: net, kind: 'p2wpkh' })
    const KT = w.addr('tron', { entity: net })

    // ── Semaines de vente ────────────────────────────────────────────────────
    const nW = r.int(4, 5)
    const t0 = w.at(0)
    const wb = Array.from({ length: nW }, (_, k) => hd.receive(k))
    const wt = Array.from({ length: nW }, () => w.addr('tron', { entity: net }))
    const ucWeek = nW - 2
    const tCourier = t0 + (nW - 1) * 7 * DAY + Math.round(r.float(30, 120) * HOUR)
    const pays: Payment[] = []
    let ucTx: Tx | undefined
    let ucValue = 0
    let ucEur = 0
    const priceEur = () => r.pick(PRICES)
    const payBtc = (to: string, time: number, week: number, uc = false) => {
      const eur = priceEur()
      const value = roundAsset('BTC', fromUsd('BTC', eur * EUR_USD * r.float(0.98, 1.03)))
      let tx: Tx
      if (uc) {
        const svc = w.addr('btc', { entity: ucE, kind: 'p2wpkh' })
        tx = w.fund(to, value, time, { from: [svc] })
        ucTx = tx
        ucValue = value
        ucEur = eur
      } else if (r.chance(0.3)) {
        // Client qui achète ses bitcoins en espèces au distributeur avant de payer
        const cust = w.addr('btc', { kind: 'p2wpkh' })
        const buy = dab.cashIn({ cashEur: Math.ceil((eur * 1.25) / 10) * 10 + 10, to: cust, time: time - Math.round(r.float(0.3, 20) * HOUR) })
        tx = w.utxoTx({ time, from: [cust], to: [{ address: to, value: Math.min(value, r8(buy.value - 0.00005)) }] })
      } else {
        tx = w.fund(to, value, time)
      }
      pays.push({ tx, chain: 'btc', usd: usd('BTC', w.flowIn(tx, to)[0].value), week })
      return tx
    }
    const payTron = (to: string, time: number, week: number) => {
      const value = r2(priceEur() * EUR_USD)
      const cust = w.addr('tron')
      if (r.chance(0.6)) exT.withdraw(cust, r2(value + r.int(0, 25)), time - Math.round(r.float(0.2, 30) * HOUR), 'USDT')
      const tx = w.transfer({ time, from: cust, to, value, asset: 'USDT' })
      pays.push({ tx, chain: 'tron', usd: value, week })
      return tx
    }

    const sweeps: Tx[] = []
    const tronIn: { time: number; value: number }[] = []
    const tickets: { tx: Tx; cashEur: number; deposit: string }[] = []
    const otcTxs: Tx[] = []
    let latePaid = 0
    const sweepTimes: number[] = []
    const mid = Math.max(1, nW - 2)
    // Contreparties de la vie du réseau : livreur payé en USDT, grossiste,
    // dépenses personnelles du gérant (VPN, casino, cartes cadeaux, sa compagne).
    const courier = w.addr('tron')
    const supplier = w.addr('tron')
    const partner = w.addr('btc', { kind: 'p2wpkh' })
    const courierPays: Tx[] = []
    const supplierPays: Tx[] = []
    const supplierShare: number[] = []
    const personal: { tx: Tx; kind: Perso }[] = []
    const mix = Math.imul(w.seed, 2654435761) >>> 0
    const persoEnt = {
      mullvad: w.entity('mullvad'),
      orbit: w.customEntity({ name: CASINOS[(mix >>> 24) % CASINOS.length], category: 'gambling', known: true, description: 'Casino en ligne (fictif) acceptant le bitcoin, sans vérification d\'identité sous un certain plafond.' }),
      cardhub: w.customEntity({ name: GIFTS[(mix >>> 16) % GIFTS.length], category: 'merchant', known: true, description: 'Vente de cartes cadeaux et de recharges prépayées contre bitcoin (fictif) ; chaque commande est livrée à une adresse e-mail.' }),
    }
    const persoAddr = (kind: Perso) => (kind === 'proche' ? partner : w.addr('btc', { entity: persoEnt[kind], label: `${persoEnt[kind].name} — Paiement` }))
    for (let k = 0; k < nW; k++) {
      const ws = t0 + k * 7 * DAY
      const nb = r.int(3, 6)
      const nt = r.int(4, 7)
      const ucAt = k === ucWeek ? r.int(0, nb - 1) : -1
      const tb = Array.from({ length: nb }, () => ws + Math.round(r.float(2, 160) * HOUR))
      if (ucAt >= 0) tb[ucAt] = parisDayStart(ws + r.int(1, 5) * DAY) + Math.round(r.float(14.5, 20) * HOUR)
      const ucTime = ucAt >= 0 ? tb[ucAt] : -1
      tb.sort((a, b) => a - b)
      tb.forEach((tt) => payBtc(wb[k], tt, k, tt === ucTime))
      const tts = Array.from({ length: nt }, () => ws + Math.round(r.float(2, 160) * HOUR)).sort((a, b) => a - b)
      const tronVals = tts.map((tt) => payTron(wt[k], tt, k))
      // Regroupement hebdomadaire vers les collecteurs
      const tSweep = ws + 7 * DAY + Math.round(r.float(2, 14) * HOUR)
      sweepTimes.push(tSweep)
      sweeps.push(forwardAll(w, wb[k], K, tSweep))
      const sumT = r2(tronVals.reduce((s, x) => s + x.transfers[0].value, 0))
      const tronSweep = w.transfer({ time: tSweep + r.int(300, 3600), from: wt[k], to: KT, value: sumT, asset: 'USDT' })
      sweeps.push(tronSweep)
      tronIn.push({ time: tSweep, value: sumT })
      // Paie hebdomadaire du livreur : environ 15 % des encaissements USDT de la semaine.
      // La paie de la dernière semaine tomberait après son interpellation : elle n'a pas lieu.
      const courierV = Math.max(40, Math.round((sumT * r.float(0.12, 0.18)) / 10) * 10)
      const tCourierPay = tronSweep.time + Math.round(r.float(1, 8) * HOUR)
      if (tCourierPay < tCourier) courierPays.push(w.transfer({ time: tCourierPay, from: KT, to: courier, value: courierV, asset: 'USDT' }))
      // Règlement au grossiste (montants ronds) ou premier règlement OTC
      if (k === mid - 1) {
        otcTxs.push(w.transfer({ time: tronSweep.time + Math.round(r.float(10, 40) * HOUR), from: KT, to: otc, value: r2(w.balanceOf(KT, 'USDT') * r.float(0.6, 0.8)), asset: 'USDT' }))
      } else if (k < nW - 1) {
        const sv = Math.floor((w.balanceOf(KT, 'USDT') * r.float(0.55, 0.7)) / 50) * 50
        if (sv >= 150) supplierShare.push(sv / w.balanceOf(KT, 'USDT'))
        if (sv >= 150) supplierPays.push(w.transfer({ time: tronSweep.time + Math.round(r.float(10, 40) * HOUR), from: KT, to: supplier, value: sv, asset: 'USDT' }))
      }
      // Dépense personnelle du gérant, payée depuis le collecteur BTC
      {
        const tp = tSweep + Math.round(r.float(1.5, 5) * HOUR)
        const kind = PERSO[k % PERSO.length]
        const v = roundAsset('BTC', w.unspentValue(K, tp) * r.float(0.08, 0.16))
        if (v > 0.0002) personal.push({ tx: w.utxoTx({ time: tp, from: [K], to: [{ address: persoAddr(kind), value: v }], change: K, autoFund: false }), kind })
      }
      // Client retardataire : paie l'adresse de la semaine précédente après le regroupement
      if (k >= 1 && latePaid < 2 && r.chance(0.6)) {
        payBtc(wb[k - 1], sweepTimes[k - 1] + Math.round(r.float(2, 90) * HOUR), k - 1)
        latePaid++
      }
      // Conversion en espèces au distributeur, par tickets sous 1 000 €
      if (k >= 1) {
        let prevT = tSweep
        for (let j = 0; j < r.int(1, 2); j++) {
          // Retrait aux heures d'ouverture du commerce qui héberge le distributeur
          let tt = parisDayStart(prevT + Math.round(r.float(6, 40) * HOUR)) + Math.round(r.float(9.5, 19.5) * HOUR)
          while (tt <= prevT + HOUR) tt += DAY
          prevT = tt
          const balEur = usd('BTC', w.unspentValue(K, tt)) / EUR_USD
          const eur = Math.min(950, Math.floor((balEur * r.float(0.55, 0.8)) / 10) * 10)
          if (eur < 150) continue
          const value = roundAsset('BTC', fromUsd('BTC', eur * EUR_USD))
          const res = dab.cashOut({ from: K, value, time: tt, change: K })
          tickets.push({ tx: res.tx, cashEur: res.cashEur, deposit: res.deposit })
        }
      }
    }
    // USDT : second règlement de gré à gré (OTC) contre espèces, après tout le reste
    const tEnd = t0 + nW * 7 * DAY + Math.round(r.float(1, 3) * DAY)
    const tLastFlow = Math.max(tEnd, ...pays.map((p) => p.tx.time), ...sweeps.map((x) => x.time), ...tickets.map((x) => x.tx.time), ...otcTxs.map((x) => x.time), ...courierPays.map((x) => x.time), ...supplierPays.map((x) => x.time))
    otcTxs.push(w.transfer({ time: tLastFlow + Math.round(r.float(6, 30) * HOUR), from: KT, to: otc, value: r2(w.balanceOf(KT, 'USDT') - r.float(5, 60)), asset: 'USDT' }))
    // Le livreur encaisse ses paies sur un exchange ; le grossiste sert d'autres revendeurs
    const lastCourierPay = courierPays[courierPays.length - 1].time
    const courierCashout = exT.receive(courier, r2(courierPays.reduce((s, x) => s + x.transfers[0].value, 0) * r.float(0.85, 0.97)), Math.min(lastCourierPay + Math.round(r.float(4, 30) * HOUR), tCourier - 2 * HOUR), { asset: 'USDT' })
    const otherDealers = Array.from({ length: r.int(2, 4) }, () => w.addr('tron'))
    for (const d of otherDealers) {
      for (let i = 0; i < r.int(1, 3); i++) {
        const v = r.int(4, 40) * 50
        const td = t0 + Math.round(r.float(-10, nW * 7 + 2) * DAY)
        w.fundAccount(d, v + r.int(5, 200), 'USDT', td - Math.round(r.float(2, 72) * HOUR))
        w.transfer({ time: td, from: d, to: supplier, value: v, asset: 'USDT' })
      }
    }

    // ── Bruit ────────────────────────────────────────────────────────────────
    dab.noise(22, t0 - 5 * DAY, tEnd + 5 * DAY)
    cv.noise(8, t0 - 5 * DAY, tEnd)
    exT.noise(12, t0 - 5 * DAY, tEnd + 3 * DAY, 'USDT')
    // Autres clients du courtier (qui conservent ou dépensent aussi ailleurs)
    for (let i = 0; i < r.int(3, 5); i++) {
      const c = w.addr('tron')
      const tc = Math.round(r.float(t0, tEnd + 5 * DAY))
      const vo = r2(r.float(3000, 40000))
      w.transfer({ time: tc, from: c, to: otc, value: vo, asset: 'USDT' })
      w.transfer({ time: tc + Math.round(r.float(1, 72) * HOUR), from: c, to: w.addr('tron'), value: r2(vo * r.float(0.3, 0.8)), asset: 'USDT' })
    }

    // ── Valeurs ──────────────────────────────────────────────────────────────
    const nPays = pays.length
    const turnover = Math.round(pays.reduce((s, p) => s + p.usd, 0))
    const nBtc = pays.filter((p) => p.chain === 'btc').length
    const btcUsd = pays.filter((p) => p.chain === 'btc').reduce((s, p) => s + p.usd, 0)
    const cashTotal = tickets.reduce((s, x) => s + x.cashEur, 0)
    const otcTotal = r2(otcTxs.reduce((s, x) => s + x.transfers[0].value, 0))
    const lastTicket = tickets[tickets.length - 1]
    const tNow = Math.max(tEnd, ...otcTxs.map((x) => x.time), ...(lastTicket ? [lastTicket.tx.time] : [])) + Math.round(r.float(2, 6) * DAY)
    const daysSinceLast = lastTicket ? Math.round((tNow - lastTicket.tx.time) / DAY) : 0
    const ucT = ucTx!
    // Solde USDT laissé sur le collecteur après le second règlement OTC (gelable par l'émetteur)
    const ktLeft = r2(w.balanceOf(KT, 'USDT'))
    const nTicketsBig = tickets.filter((x) => x.cashEur >= 900).length
    const supplierTotal = supplierPays.reduce((s, x) => s + x.transfers[0].value, 0)
    const courierTotal = courierPays.reduce((s, x) => s + x.transfers[0].value, 0)
    const persoLabel: Record<Perso, string> = { mullvad: 'abonnement Mullvad VPN', orbit: `dépôt au casino en ligne ${persoEnt.orbit.name}`, cardhub: `cartes cadeaux ${persoEnt.cardhub.name}`, proche: 'virement à un particulier' }
    const persoTxt = personal.map((p) => `${persoLabel[p.kind]}, ${amt(receivedIn(w, p.tx, p.tx.outputs.find((o) => o.address !== K)!.address), 'BTC')} le ${fmtDate(p.tx.time, false)}`).join(' ; ')
    const usdtFmt = (v: number) => amt(v, 'USDT')

    const pinPrev = t0 + (nW - 2) * 7 * DAY + Math.round(r.float(1, 5) * HOUR)
    const pinLast = t0 + (nW - 1) * 7 * DAY + Math.round(r.float(1, 5) * HOUR)
    let tCapture = parisDayStart(pinLast + 12 * HOUR) + Math.round(r.float(9.5, 17) * HOUR)
    while (tCapture <= pinLast + HOUR) tCapture += DAY
    // Exploitation du téléphone : un jour ouvré, aux heures de service
    let tExtraction = parisDayStart(tCourier + r.int(1, 3) * DAY) + Math.round(r.float(9, 17.5) * HOUR)
    while (tExtraction <= tCourier + 6 * HOUR) tExtraction += DAY
    const pvPseudo = parisDayStart(ucT.time + DAY) + Math.round(r.float(9, 11.5) * HOUR)
    const oldestAge = tickets.length ? Math.round((tNow - tickets[0].tx.time) / DAY) : 0
    const shareMin = Math.round(Math.min(...supplierShare) * 100)
    const shareMax = Math.round(Math.max(...supplierShare) * 100)
    return {
      world: w,
      title: `Trafic de stupéfiants via Telegram — ${city}`,
      briefing:
        `À ${city}, un canal Telegram, « ${channel} », propose la livraison de stupéfiants à domicile. Les commandes se passent par messagerie ; le paiement se fait en bitcoins ou en USDT sur le réseau Tron, sur des adresses que le canal renouvelle chaque semaine. Un livreur interpellé en flagrant délit avait sur son téléphone une application de suivi des paiements.\n\n` +
        `Un achat a été réalisé par un enquêteur habilité agissant sous pseudonyme, sur autorisation du magistrat. Le paiement figure au procès-verbal.\n\n` +
        `Objectif : remonter des adresses de paiement aux portefeuilles qui regroupent les fonds, chiffrer l'activité du canal sur la période, distinguer ce que le réseau dépense (livreurs, grossiste, train de vie du gérant) de ce qu'il transforme en espèces, et engager sans tarder les réquisitions utiles.`,
      evidence: [
        {
          id: 'canal', type: 'telegram', title: `Canal Telegram « ${channel} » — messages visibles (capture)`, date: tCapture, author: `@${admin} (administrateur)`,
          body:
            `📋 MENU de la semaine — livraison 7j/7 de 14h à 2h, ${city} et alentours\n` +
            `🌿 Beuh : 2 g 20 € · 5 g 40 € · 10 g 80 € · 25 g 200 €\n🍫 Résine : 5 g 30 € · 10 g 50 € · 25 g 100 €\n❄️ C : 1 g 60 € · 2 g 120 € · 5 g 250 €\n🎉 Pack soirée : 150 €\n` +
            `Paiement crypto UNIQUEMENT, au cours du jour (convertis le prix en euros au moment de payer). Les adresses changent chaque semaine : vérifie toujours le dernier message épinglé ❗\n\n` +
            `[${fmtDate(pinPrev)}] 📌 Adresses de la semaine\nBTC : ${A(w, wb[nW - 2])}\nUSDT (TRC20 uniquement) : ${A(w, wt[nW - 2])}\n\n` +
            `[${fmtDate(pinLast)}] 📌 Adresses de la semaine\nBTC : ${A(w, wb[nW - 1])}\nUSDT (TRC20 uniquement) : ${A(w, wt[nW - 1])}\n\n` +
            `Les messages plus anciens ont été supprimés (messages éphémères).`,
        },
        {
          id: 'pseudo', type: 'pv', title: 'Procès-verbal d\'enquête sous pseudonyme (extrait)', date: pvPseudo, author: 'Enquêteur spécialement habilité — section de recherches',
          body:
            `Agissant en application de l'article 230-46 du code de procédure pénale, sous l'identité d'emprunt « ${alias} », en vertu de l'autorisation d'acquisition délivrée par le procureur de la République.\n\n` +
            `Avons répondu au menu publié sur le canal, sans formuler d'autre demande que la commande d'une quantité usuelle proposée au menu (« ${MENU[ucEur] ?? 'article du menu'} », ${ucEur} €). Avons réglé le prix annoncé, converti au cours du jour, soit ${amt(ucValue, 'BTC')}, depuis le portefeuille du service, sur l'adresse indiquée pour la semaine : ${A(w, wb[ucWeek])}.\n` +
            `Transaction : ${ucT.hash} (${fmtDate(ucT.time)}).\n` +
            `La livraison a été effectuée le ${fmtDate(ucT.time, false)} dans la soirée ; le produit a été placé sous scellé.`,
        },
        {
          id: 'livreur', type: 'extraction', title: 'Exploitation du téléphone du livreur — application de suivi', date: tExtraction, author: 'Cellule d\'appui numérique',
          body:
            `Téléphone isolé du réseau dès l'interpellation ; extraction sur copie, empreinte consignée.\n\n` +
            `Application de portefeuille en lecture seule nommée « Caisse », utilisée selon le livreur pour « vérifier que le client a payé avant de donner ». Clé importée :\n${hd.xpub}\n\n` +
            `Aucune clé privée. Aucune adresse Tron configurée : selon le livreur, « pour les USDT, c'est le chef qui vérifie ».\n\n` +
            `Extrait d'audition du livreur : « Je suis payé en USDT, en début de semaine, au pourcentage de ce qui est rentré la semaine d'avant, sur une adresse à moi. La marchandise, le chef la paie à un grossiste qu'on ne voit jamais, en USDT aussi, par grosses sommes rondes. Le reste, il le change en liquide. »`,
        },
        {
          id: 'surveillance', type: 'pv', title: 'Procès-verbal de surveillance (extrait)', date: lastTicket ? lastTicket.tx.time + Math.round(r.float(1, 3) * HOUR) : tNow, author: 'Section de recherches',
          body:
            `Le ${lastTicket ? fmtDate(lastTicket.tx.time) : fmtDate(tNow)}, un individu au profil correspondant au « chef » décrit par le livreur est observé au ${shop} de ${city}. Il utilise le distributeur automatique de crypto-actifs installé dans le commerce, puis repart avec des billets. Il n'a pas pu être suivi au-delà.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Sur quelle adresse le réseau regroupe-t-il les paiements Bitcoin des clients ?',
          answer: [K],
          hint: 'Partez du paiement de l\'achat sous pseudonyme et suivez la sortie de l\'adresse de la semaine.',
          explanation: `Chaque semaine, l'adresse BTC de la semaine écoulée est vidée vers ${A(w, K)}. Les ${nW} adresses hebdomadaires dérivent toutes de la clé publique étendue trouvée chez le livreur (m/84'/0'/0'/0/0 à ${nW - 1}) : un seul portefeuille derrière les rotations. Le collecteur, lui, est une adresse distincte, réutilisée à chaque regroupement.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Que permet la clé publique étendue trouvée dans le téléphone du livreur ?',
          ...choice(r,
            'Dériver et surveiller toutes les adresses de réception BTC du portefeuille, y compris les prochaines, sans pouvoir dépenser les fonds',
            [
              'Transférer les bitcoins du réseau vers une adresse de saisie du service',
              'Identifier les adresses USDT du canal, la même clé servant sur Tron',
              'Rien de plus que l\'adresse de la semaine en cours, chaque adresse ayant une clé indépendante',
            ]),
          hint: 'Une clé publique étendue (xpub/zpub) contient-elle une clé privée ? Sur quelle chaîne et quel chemin de dérivation porte-t-elle ?',
          explanation: `La zpub permet de recalculer toutes les adresses publiques du compte (m/84'/0'/0'/0/i), passées et futures : les adresses des semaines non conservées sur le canal réapparaissent, et celles des semaines à venir peuvent être surveillées dès maintenant. Elle ne contient aucune clé privée : impossible de dépenser ou de saisir les fonds avec elle. Elle ne vaut que pour ce portefeuille Bitcoin ; les adresses Tron du canal se retrouvent par leur collecteur commun.`,
        },
        {
          id: 'o2', type: 'number', points: 9, tolerance: 2, unit: 'paiements',
          prompt: 'Combien de paiements de clients (BTC et USDT, achat sous pseudonyme compris) les adresses hebdomadaires ont-elles reçus sur la période ?',
          answer: nPays,
          hint: 'Côté BTC, l\'outil « Dérivation HD » liste toutes les adresses hebdomadaires. Côté Tron, l\'onglet « Dépôt » d\'une adresse hebdomadaire connue liste les autres adresses qui reversent tout au même collecteur. Additionnez les transactions entrantes de chacune.',
          explanation: `${nPays} paiements : ${nBtc} en BTC sur ${nW} adresses (dont ${latePaid ? `${latePaid} versé${latePaid > 1 ? 's' : ''} en retard sur l'adresse d'une semaine déjà regroupée, et ` : ''}l'achat sous pseudonyme) et ${nPays - nBtc} en USDT sur ${nW} adresses Tron. Chaque paiement correspond vraisemblablement à une transaction de stupéfiants : ce chiffrage nourrit la qualification et le volume du trafic.`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'USD', tolerance: 0.03,
          prompt: 'Quel chiffre d\'affaires total (en dollars) ces paiements représentent-ils ?',
          answer: turnover,
          hint: 'Le « Total reçu » de chaque adresse hebdomadaire est affiché en dollars dans l\'inspecteur.',
          explanation: `≈ ${fmtUsdInt(turnover)} (≈ ${Math.round(turnover / EUR_USD).toLocaleString('fr-FR')} €) : ${fmtUsdInt(btcUsd)} en BTC et ${fmtUsdInt(turnover - btcUsd)} en USDT, pour un panier moyen de ${Math.round(turnover / nPays / EUR_USD)} €. Les montants reçus par les collecteurs sont légèrement inférieurs (frais de réseau, paiements retardataires non regroupés).`,
        },
        {
          id: 'o4', type: 'entity', points: 10,
          prompt: 'Quel exploitant faut-il requérir pour identifier la personne qui convertit en espèces les bitcoins regroupés ?',
          answer: ['cryptoguichet'],
          hint: 'Suivez les sorties du collecteur Bitcoin : petites sommes, adresses à usage unique, toutes attribuées au même service.',
          explanation: `Le collecteur envoie ${tickets.length} tickets de vente au distributeur (${cashTotal.toLocaleString('fr-FR')} € d'espèces au total), chacun sous 1 000 € : le seuil au-delà duquel l'exploitant exige une pièce d'identité. Ce fractionnement est un indicateur de blanchiment. Les données du ticket (téléphone vérifié par SMS, appareil, heure, image) permettent d'identifier le porteur. ${procedureFor(dab.entity)}`,
        },
        {
          id: 'o9', type: 'number', points: 9, tolerance: 0, unit: 'tickets',
          prompt: 'Combien de tickets de vente au distributeur le collecteur Bitcoin a-t-il émis ?',
          answer: tickets.length,
          hint: 'Dépliez les sorties du collecteur Bitcoin : chaque envoi vers une adresse de ticket de l\'exploitant (hors rendu) est une vente contre espèces.',
          explanation: `${tickets.length} tickets, du ${fmtDate(tickets[0].tx.time, false)} au ${fmtDate(lastTicket.tx.time, false)}, pour ${cashTotal.toLocaleString('fr-FR')} € remis en espèces${nTicketsBig ? `, dont ${nTicketsBig} juste sous le plafond de 1 000 €` : ''}. Chaque ticket a sa propre adresse de réception, et la monnaie revient sur le collecteur : le réseau fractionne volontairement pour rester sous le seuil d'identité de l'exploitant. Les autres sorties du collecteur ne sont pas des tickets : ce sont les dépenses personnelles du gérant, payées quelques heures après les regroupements (${persoTxt}). La réquisition doit lister chaque ticket (hash, horodatage, adresse de ticket).`,
        },
        {
          id: 'o10', type: 'tx', points: 9,
          prompt: 'Quelle transaction correspond au retrait d\'espèces observé lors de la surveillance ?',
          answer: [lastTicket.tx.id],
          hint: 'Le procès-verbal de surveillance date précisément la scène : cherchez le ticket de vente émis par le collecteur à ce moment-là.',
          explanation: `La transaction ${lastTicket.tx.hash.slice(0, 16)}… (${fmtDate(lastTicket.tx.time)}) envoie le prix d'un ticket de ${lastTicket.cashEur.toLocaleString('fr-FR')} € du collecteur vers ${A(w, lastTicket.deposit).slice(0, 14)}…, adresse de ticket CryptoGuichet. Le rapprochement entre l'observation physique et la transaction est un élément fort : la réquisition de l'exploitant sur ce ticket précis (téléphone vérifié, images de l'appareil) doit permettre d'identifier le « chef » observé, et de démontrer qu'il dispose des clés du collecteur.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Le dernier retrait d\'espèces date de quelques jours. Quelle démarche s\'impose ?',
          ...choice(r,
            'Requérir sans délai l\'exploitant : tickets, téléphone et images de l\'appareil, conservées peu de temps',
            [
              'Attendre l\'identification complète du réseau pour adresser une seule réquisition groupée',
              'Se fonder sur les seules données on-chain, l\'adresse de ticket suffisant à identifier le client',
              'Demander au buraliste de remettre les images, l\'exploitant ne conservant aucune donnée',
            ]),
          hint: 'Quelles données l\'exploitant détient-il sur un ticket, et combien de temps les conserve-t-il ? Regardez sa fiche conformité.',
          explanation: `La vidéosurveillance des distributeurs n'est conservée que quelques semaines (environ 30 jours selon la fiche de l'exploitant) : au ${fmtDate(tNow, false)}, le dernier ticket date de ${daysSinceLast} jour${daysSinceLast > 1 ? 's' : ''} et le plus ancien de ${oldestAge} jours${oldestAge >= 30 ? ' : ses images sont probablement déjà effacées, raison de plus pour ne pas perdre les suivants' : ', tout près de la limite'}. Réquisition immédiate pour tous les tickets identifiés (adresses de ticket, horodatages), avec demande expresse de préservation des images. L'adresse de ticket est propre à l'exploitant : on-chain, elle ne dit rien du client. Le commerçant hôte peut détenir ses propres images, en complément.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Sur quelle adresse Tron le réseau regroupe-t-il les paiements en USDT ?',
          answer: [KT],
          hint: 'Partez d\'une adresse USDT publiée sur le canal et suivez sa sortie en fin de semaine.',
          explanation: `Chaque adresse USDT hebdomadaire reverse en une fois, en fin de semaine, tout ce qu'elle a reçu à ${A(w, KT)}. Contrairement au Bitcoin, aucune clé étendue ne relie les adresses Tron entre elles : c'est le collecteur commun qui les rassemble. L'onglet « Dépôt » de l'inspecteur fait ressortir ce schéma (adresses à solde nul, reversement intégral vers une même destination), y compris pour les semaines dont l'adresse n'a pas été conservée sur le canal.`,
        },
        {
          id: 'o6', type: 'entity', points: 8,
          prompt: 'Vers quel prestataire les USDT regroupés sont-ils envoyés ?',
          answer: ['satsdesk'],
          hint: 'Identifiez d\'abord le portefeuille qui reçoit les reversements des adresses USDT hebdomadaires, puis suivez ses sorties.',
          explanation: `Les adresses USDT hebdomadaires reversent tout à ${A(w, KT)} (l'heuristique « dépôt / collecteur » de l'inspecteur le fait ressortir), qui envoie ${amt(otcTotal, 'USDT')} en deux fois à SatsDesk OTC, courtier de gré à gré qui règle en espèces : c'est le seul destinataire attribué de ses sorties, et le dernier règlement solde presque tout le collecteur. ${procedureFor(satsdesk)} Les autres sorties paient l'activité : chaque semaine, la paie du livreur jusqu'à son interpellation (${courierPays.length} versements, ${usdtFmt(courierTotal)}) et, certaines semaines, des sommes rondes au grossiste (${supplierPays.length} versements, ${usdtFmt(supplierTotal)}). En parallèle, l'émetteur de l'USDT peut être sollicité pour geler le solde résiduel du collecteur.`,
        },
        {
          id: 'o13', type: 'address', points: 10,
          prompt: 'Le collecteur Tron paie aussi la marchandise. Quelle adresse appartient vraisemblablement au grossiste ?',
          answer: [supplier],
          hint: 'Relisez l\'audition du livreur, puis comparez les destinataires non attribués du collecteur Tron : montant, régularité, arrondi, et ce que reçoit chaque destinataire d\'autres expéditeurs.',
          explanation: `${A(w, supplier)} reçoit du collecteur ${supplierPays.map((x) => usdtFmt(x.transfers[0].value)).join(', ')} : des multiples de 50 USDT, versés certaines semaines seulement, chaque fois ${shareMin === shareMax ? `${shareMin} %` : `de ${shareMin} à ${shareMax} %`} de ce que le collecteur détient alors. Elle reçoit aussi des sommes rondes de ${otherDealers.length} autres adresses sans lien avec le canal : c'est un fournisseur qui sert plusieurs revendeurs, conforme à l'audition (« un grossiste… par grosses sommes rondes »). L'autre destinataire régulier, ${A(w, courier).slice(0, 12)}…, reçoit chaque semaine, peu après le regroupement, une petite somme de l'ordre de 15 % des encaissements USDT de la semaine, et plus rien après l'interpellation du livreur (${fmtDate(tCourier, false)}) : c'est sa paie (« au pourcentage de ce qui est rentré »), qui la redépose ensuite sur un exchange (${exT.entity.name}), ce qui permettra de l'identifier. Remonter au grossiste ouvre un autre volet (importation, approvisionnement) : ses autres clients sont d'autres points de vente.`,
        },
        {
          id: 'o11', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDT le collecteur Tron a-t-il réglé au courtier de gré à gré ?',
          answer: otcTotal,
          hint: 'Additionnez les sorties d\'USDT du collecteur Tron vers le portefeuille de règlement du courtier.',
          explanation: `${otcTxs.map((x) => amt(x.transfers[0].value, 'USDT')).join(' + ')} = ${amt(otcTotal, 'USDT')}, réglés en deux fois (${otcTxs.map((x) => fmtDate(x.time, false)).join(' et ')}). En contrepartie, le courtier remet des espèces hors chaîne. Il ne reste que ${amt(ktLeft, 'USDT')} sur le collecteur, un reliquat que l'émetteur peut geler mais qui ne justifie pas à lui seul l'urgence. ${procedureFor(satsdesk)}`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
          prompt: 'À quelles conditions l\'achat réalisé sous pseudonyme est-il exploitable en procédure ?',
          ...choice(r,
            'Agent habilité, acquisition autorisée par le magistrat, aucune incitation, actes retranscrits en procédure',
            [
              'Tout enquêteur peut acheter sous pseudonyme sans autorisation, dès lors que le PV le mentionne',
              'L\'achat reste valable s\'il pousse le vendeur à proposer davantage que ce qu\'il vend d\'habitude',
              'Le paiement doit partir du compte personnel de l\'enquêteur pour rester crédible auprès du vendeur',
            ]),
          hint: 'Relisez le procès-verbal d\'enquête sous pseudonyme : qui agit, sur quelle autorisation, et dans quelles limites ?',
          explanation: `L'enquête sous pseudonyme (article 230-46 du CPP) est réservée à des agents affectés dans un service spécialisé et spécialement habilités. L'acquisition d'un produit illicite suppose l'autorisation préalable du procureur de la République ou du juge d'instruction, et les actes ne doivent pas inciter à commettre l'infraction, à peine de nullité. Le paiement part des moyens du service et chaque étape est retranscrite au procès-verbal : c'est ce qui permet d'exploiter le hash de transaction comme point de départ.`,
        },
      ],
      truth: {
        path: [...pays.map((p) => p.tx.id), ...sweeps.map((x) => x.id), ...tickets.map((x) => x.tx.id), ...otcTxs.map((x) => x.id)],
        addresses: [wb[ucWeek], K, KT, ...wb, ...wt, ...tickets.map((x) => x.deposit), otc],
        debrief:
          `1. Chaque semaine, le canal publie une adresse BTC (dérivée d'un même portefeuille HD) et une adresse USDT-TRC20. ${nPays} paiements de clients sont reçus en ${nW} semaines, pour ≈ ${fmtUsdInt(turnover)}.\n` +
          `2. L'enquêteur sous pseudonyme paie ${amt(ucValue, 'BTC')} sur l'adresse de la semaine ${ucWeek + 1} (${fmtDate(ucT.time)}).\n` +
          `3. En fin de semaine, les adresses de la semaine sont vidées : BTC vers ${A(w, K)}, USDT vers ${A(w, KT)}.\n` +
          `4. Le collecteur BTC est converti en espèces au distributeur CryptoGuichet du ${shop}, par ${tickets.length} tickets sous le seuil d'identité (${cashTotal.toLocaleString('fr-FR')} €).\n` +
          `   Le dernier ticket (${lastTicket.tx.hash.slice(0, 14)}…, ${fmtDate(lastTicket.tx.time)}) correspond au retrait observé en surveillance.\n` +
          `5. Le collecteur USDT paie chaque semaine le livreur jusqu'à son interpellation (${usdtFmt(courierTotal)} au total, en partie redéposés par lui chez ${exT.entity.name}) et le grossiste ${A(w, supplier)} (${usdtFmt(supplierTotal)} en sommes rondes), puis règle ${amt(otcTotal, 'USDT')} à SatsDesk OTC, contre espèces ; il n'y reste que ${amt(ktLeft, 'USDT')}.\n` +
          `6. Le gérant vit sur la caisse BTC : ${persoTxt}.\n\n` +
          `Pièges à écarter : les dépenses personnelles du collecteur BTC ne sont pas des tickets ; sur Tron, la paie du livreur et les règlements au grossiste ne sont pas la sortie en espèces, mais chacun ouvre une piste (un livreur identifiable par son exchange, un grossiste qui sert d'autres revendeurs).\n\n` +
          `À retenir : la rotation des adresses ne protège pas un réseau qui regroupe ensuite ses fonds ; un paiement sous pseudonyme suffit à entrer dans le circuit, et une clé publique étendue saisie chez un livreur relie toutes les adresses BTC. Côté sortie, les DAB crypto et le gré à gré sont les points d'identification : réquisition immédiate de l'exploitant, car les images ne sont conservées que quelques semaines.`,
      },
      hints: [
        'Ouvrez le paiement de l\'achat sous pseudonyme (procès-verbal) et suivez la sortie de l\'adresse de la semaine.',
        'La clé publique étendue du téléphone du livreur ouvre l\'outil « Dérivation HD » : toutes les adresses BTC hebdomadaires apparaissent d\'un coup.',
        'Côté Tron, l\'onglet « Dépôt » d\'une adresse USDT hebdomadaire repère le collecteur et les autres adresses qui lui reversent tout ce qu\'elles reçoivent.',
        'Les sorties du collecteur BTC vers des adresses à usage unique d\'un même exploitant sont des tickets de vente au distributeur ; les autres sont des dépenses personnelles.',
        'Sur le collecteur Tron, trois sortes de sorties : le courtier attribué, une petite somme chaque semaine, des sommes rondes certaines semaines. L\'audition du livreur dit qui reçoit quoi.',
      ],
    }
  },
}
