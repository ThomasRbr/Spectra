import { World, type Tx } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { dusting, personalSpending, priorHistory } from '../engine/realism'
import { roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakeName, fakePerson, fmtDate, forwardAll, procedureFor } from './util'

/**
 * Bruit d'exchange UTXO dans l'ordre chronologique : `ExchangeKit.noise` tire
 * des horaires aléatoires dans le désordre, ce qui peut faire dépenser au hot
 * wallet un rendu créé « plus tard ». Ici on constitue une réserve initiale
 * puis on génère retraits et dépôts triés par date.
 */
function chronoNoise(w: World, kit: ExchangeKit, n: number, from: number, to: number): void {
  w.sweepInto(kit.hot, roundCoin(w, 40, 60, 0.0001), from - DAY)
  const times = Array.from({ length: n }, () => Math.round(w.rng.float(from, to))).sort((a, b) => a - b)
  for (const t of times) {
    const v = roundAsset('BTC', w.rng.float(50, 25000) / usd('BTC', 1))
    if (w.rng.chance(0.55)) kit.withdraw(w.addr('btc'), v, t)
    else kit.receive(w.addr('btc'), v, t)
  }
}

const hm = (t: number) => new Date(t * 1000).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

export const accMoneroWall: ScenarioTemplate = {
  id: 'monero-wall',
  title: 'Le mur Monero',
  tagline: 'BTC → XMR → BTC → XMR : quand la blockchain se tait, seuls le temps, les montants et l\'OSINT parlent, et l\'affaire finit dans le noir.',
  description:
    'Les gains d\'un centre d\'appels de faux support technique sont éclatés sur plusieurs adresses, dont une seule mène à un échangeur instantané où ils deviennent des Monero. Quelques jours plus tard, une partie ressort en bitcoins : un bout part sur un exchange, le reste retourne en Monero par ChangeNOW. Triez les branches et les transferts jumeaux, retrouvez l\'entrée, le candidat de sortie le plus probable, et mesurez ce que l\'on peut honnêtement conclure.',
  difficulty: 3,
  chains: ['btc', 'xmr'],
  skills: ['privacy', 'crosschain', 'osint', 'exchange_id', 'requisition', 'change'],
  estMinutes: 75,
  lessons: ['monero', 'chain-hopping', 'echangeurs-instantanes', 'osint', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimName = fakeName(r)
    const handle = fakeHandle(r)

    // eXch a fermé fin avril 2025 : pour une affaire postérieure, l'échangeur sans KYC est fictif.
    const fx = w.t0 < Date.UTC(2025, 2, 15) / 1000
      ? w.entity('exch')
      : w.customEntity({ name: 'SwapNuit', category: 'instant_exchanger', known: true, risk: 'high', country: 'Inconnu', description: `Échangeur instantané (fictif) sans compte ni KYC, acceptant notamment le XMR : l'utilisateur crée une commande, envoie ses fonds sur une adresse de dépôt et reçoit l'actif demandé. Aucune coopération connue avec les autorités.`, compliance: { contact: '—', cooperation: 'none', responseDays: [0, 0], canFreeze: false, kyc: 'aucun' } })
    const FX = fx.name
    const fxDep = w.addr('btc', { entity: fx, label: `${FX} — Adresse de dépôt`, tags: ['deposit'] })
    const fxHot = w.addr('btc', { entity: fx, label: `${FX} — Hot Wallet BTC`, tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const cn = w.entity('changenow')
    const cnDep = w.addr('btc', { entity: cn, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'] })
    const cnHot = w.addr('btc', { entity: cn, label: 'ChangeNOW — Hot Wallet BTC', tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const destKey = r.pick(['coinhouse', 'bitstamp', 'binance'] as const)
    const dest = exchange(w, destKey, 'btc')
    const orbit = w.customEntity({ name: 'Kasbah Casino', category: 'gambling', known: true, description: `Casino en ligne (fictif) acceptant le bitcoin, sous licence offshore ; exige une pièce d'identité au-delà d'un certain montant de retrait.` })
    const orbitAddr = w.addr('btc', { entity: orbit, label: `${orbit.name} — Dépôts`, tags: ['liquid'] })
    const topup = w.customEntity({ name: 'Rechargez.mobi (recharges prépayées)', category: 'merchant', known: true, description: `Revendeur (fictif) de recharges téléphoniques et de cartes prépayées, payables en cryptomonnaies ; conserve le numéro rechargé.` })

    const suspect = w.customEntity({ name: `@${handle} (auteur présumé)`, category: 'suspect' })
    const s = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const entryT = w.at(r.float(30, 60))

    // ── Téléopérateurs : payés chaque semaine depuis l'adresse de collecte ──
    const nOps = r.int(3, 5)
    const opP = fakePerson(r)
    const opName = opP.name

    const opAddrs = Array.from({ length: nOps }, (_, i) => w.addr('btc', { entity: w.customEntity({ name: i === 0 ? opName : `Téléopérateur ${i + 1} (non identifié)`, category: 'individual' }) }))

    // Faux support technique : nombreux paiements de « frais de dépannage », sur deux semaines
    const nPrev = r.int(3, 5)
    const nPay = r.int(10, 14)
    const payTimes = [
      ...Array.from({ length: nPrev }, () => w.at(-r.float(16, 22) * 24)),
      ...Array.from({ length: nPay }, () => w.at(-r.float(1, 10) * 24)),
    ].sort((a, b) => a - b)
    const pays: Tx[] = []
    // La plaignante paie en journée (consignes suivies au téléphone avec le faux technicien)
    const namedIdx = nPrev + 2
    payTimes[namedIdx] = Math.floor(payTimes[namedIdx] / DAY) * DAY + r.int(8, 16) * HOUR + r.int(0, 3599)
    let complainantTx = ''
    let complainantValue = 0
    let complainantAddr = ''
    let complainantT = 0
    let prevComm: Tx | undefined
    const prevCommT = w.at(-r.float(12, 14) * 24)
    payTimes.forEach((t, i) => {
      // Commissions de la semaine précédente, une fois ses paiements encaissés
      if (!prevComm && t > prevCommT) prevComm = payroll(prevCommT, 0.06)
      const named = i === namedIdx
      const va = named ? w.addr('btc', { entity: w.customEntity({ name: victimName, category: 'victim' }) }) : w.addr('btc')
      const value = roundAsset('BTC', r.float(900, 2600) / usd('BTC', 1))
      const tx = w.fund(s, value, t, { from: [va] })
      pays.push(tx)
      if (named) {
        complainantTx = tx.hash
        complainantValue = value
        complainantAddr = va
        complainantT = tx.time
      }
    })
    function payroll(t: number, pct: number): Tx {
      const base = w.unspentValue(s, t)
      return w.utxoTx({ time: t, from: [s], to: opAddrs.map((a) => ({ address: a, value: roundAsset('BTC', base * pct * r.float(0.6, 1.2)) })), change: s, tags: ['payroll'] })
    }
    if (!prevComm) prevComm = payroll(prevCommT, 0.06)
    const collectedBtc = roundAsset('BTC', pays.reduce((t, x) => t + w.flowIn(x, s)[0].value, 0))
    const nAll = pays.length

    // Frais de fonctionnement du centre d'appels, réglés depuis l'adresse de collecte
    const ads = w.customEntity({ name: 'AdNexa (régie publicitaire)', category: 'merchant', known: true, description: 'Régie publicitaire en ligne (fictive) acceptant le bitcoin, sans vérification des annonceurs : vecteur classique des fausses fenêtres d\'alerte (« malvertising »).' })
    const adsAddr = w.addr('btc', { entity: ads, label: 'AdNexa — Paiements', tags: ['liquid'] })
    const opsSpend = [w.at(-r.float(8, 9.5) * 24), w.at(-r.float(3, 5) * 24), entryT - Math.round(r.float(24, 40) * HOUR)].sort((a, b) => a - b)
    opsSpend.forEach((t, i) => {
      const to = i === 1 ? w.addr('btc', { entity: w.entity('mullvad'), label: 'Mullvad VPN — Paiement' }) : adsAddr
      if (w.unspentValue(s, t) > 0.002) w.utxoTx({ time: t, from: [s], to: [{ address: to, value: roundAsset('BTC', w.unspentValue(s, t) * r.float(0.02, 0.05)) }], change: s })
    })
    // Commissions de la semaine, peu avant le passage en Monero
    const commTx = w.utxoTx({ time: entryT - Math.round(r.float(5, 20) * HOUR), from: [s], to: opAddrs.map((a) => ({ address: a, value: roundAsset('BTC', collectedBtc * r.float(0.025, 0.05)) })), change: s, tags: ['payroll'] })
    const opValues = opAddrs.map((a) => commTx.outputs.find((o) => o.address === a)!.value)
    const commTotal = roundAsset('BTC', opValues.reduce((t, v) => t + v, 0))

    // ── Éclatement : quatre adresses neuves dans l'heure, deux de même montant ──
    const splitT = entryT - Math.round(r.float(1.2, 2.5) * HOUR)
    const avail = w.unspentValue(s, splitT)
    const E = roundAsset('BTC', avail * r.float(0.33, 0.37))
    const bReal = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const bTwin = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const bCasino = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const bSplit = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const branchPlan = r.shuffle([
      { to: bReal, value: E },
      { to: bTwin, value: roundAsset('BTC', E * (1 + r.pick([-1, 1]) * r.float(0.001, 0.003))) },
      { to: bCasino, value: roundAsset('BTC', avail * r.float(0.07, 0.1)) },
      { to: bSplit, value: roundAsset('BTC', avail * r.float(0.06, 0.09)) },
    ])
    const branchTx = new Map<string, Tx>()
    branchPlan.forEach((b, i) => branchTx.set(b.to, w.utxoTx({ time: splitT + i * r.int(8, 16) * 60, from: [s], to: [{ address: b.to, value: b.value }], change: s })))

    // Entrée : la branche « réelle » part chez eXch (BTC → XMR) ; sa jumelle part dormir ailleurs
    const entryTx = forwardAll(w, bReal, fxDep, entryT)
    const entryBtc = w.flowIn(entryTx, fxDep)[0].value
    const sweepTx = forwardAll(w, fxDep, fxHot, entryT + r.int(10, 60) * 60, undefined, ['sweep'])
    const Q = w.addr('btc', { kind: 'p2wpkh' })
    const twinTx = forwardAll(w, bTwin, Q, entryT + r.pick([-1, 1]) * r.int(6, 25) * 60)
    const casinoTx = w.utxoTx({ time: splitT + Math.round(r.float(3, 20) * HOUR), from: [bCasino], to: [{ address: orbitAddr, value: roundAsset('BTC', w.unspentValue(bCasino) * r.float(0.5, 0.8)) }], change: bCasino })
    const nSub = r.int(2, 3)
    const tSub = splitT + Math.round(r.float(5, 30) * HOUR)
    // Heures strictement croissantes : chaque envoi dépense le rendu du précédent
    const subStep = r.int(10, 40) * 60
    for (let i = 0; i < nSub; i++) w.utxoTx({ time: tSub + i * subStep, from: [bSplit], to: [{ address: w.addr('btc'), value: roundAsset('BTC', w.unspentValue(bSplit) / (nSub + 1 - i) * 0.9) }], change: bSplit })

    // ── Le portefeuille de sortie a déjà servi : allers-retours précédents ──
    const exitT = entryT + Math.round(r.float(4, 8) * DAY)
    const x1 = w.addr('btc', { entity: suspect, kind: r.pick(['p2wpkh', 'p2tr'] as const) })
    for (let k = 0; k < 2; k++) {
      const tp = w.at(-r.float(k === 0 ? 17 : 9, k === 0 ? 21 : 12) * 24)
      w.utxoTx({ time: tp, from: [fxHot], to: [{ address: x1, value: roundAsset('BTC', roundCoin(w, 0.02, 0.08, 0.00001)) }], change: fxHot, tags: ['payout'] })
      dest.receive(x1, roundAsset('BTC', w.unspentValue(x1, tp + 3 * HOUR) * r.float(0.6, 0.8)), tp + Math.round(r.float(1, 3) * HOUR), { change: x1 })
    }
    personalSpending(w, x1, { start: w.at(-24 * 24), end: w.at(-3 * 24), n: 2, merchants: ['mullvad', topup], maxUsd: 150 })

    // Sortie : quelques jours plus tard, XMR → BTC vers ce portefeuille
    const exitBtc = roundAsset('BTC', entryBtc * r.float(0.55, 0.8))
    const msgT = exitT + Math.round(r.float(1, 3) * HOUR)
    const quoted = Math.round(exitBtc * 1000) / 1000

    // Paiements du hot wallet eXch, générés dans l'ordre chronologique
    w.sweepInto(fxHot, roundCoin(w, 55, 70, 0.0001), entryT - 2 * DAY)
    const plan: { to: string; value: number; time: number }[] = [{ to: x1, value: exitBtc, time: exitT }]
    const dA = w.addr('btc')
    plan.push({ to: dA, value: exitBtc * (1 + r.pick([-1, 1]) * r.float(0.02, 0.04)), time: msgT - r.float(4, 20) * HOUR })
    plan.push({ to: w.addr('btc'), value: exitBtc * (1 + r.pick([-1, 1]) * r.float(0.02, 0.04)), time: msgT - r.float(4, 22) * HOUR })
    plan.push({ to: w.addr('btc'), value: exitBtc * (1 + r.pick([-1, 1]) * r.float(0.003, 0.012)), time: msgT + r.float(8, 30) * HOUR })
    plan.push({ to: w.addr('btc'), value: exitBtc * (1 + r.pick([-1, 1]) * r.float(0.003, 0.012)), time: msgT - r.float(30, 60) * HOUR })
    for (let i = 0; i < r.int(22, 30); i++) {
      let v = roundCoin(w, 0.005, 1.5, 0.00001)
      if (Math.abs(v / exitBtc - 1) < 0.07) v *= 1.25
      plan.push({ to: w.addr('btc'), value: v, time: exitT + r.float(-3, 3) * DAY })
    }
    plan.sort((a, b) => a.time - b.time)
    const paid = new Map<string, Tx>()
    for (const p of plan) {
      paid.set(p.to, w.utxoTx({ time: Math.round(p.time), from: [fxHot], to: [{ address: p.to, value: roundAsset('BTC', p.value) }], change: fxHot, tags: ['payout'] }))
    }
    const exitTx = paid.get(x1)!
    const decoyA = paid.get(dA)!
    w.utxoTx({ time: decoyA.time + r.int(1, 6) * HOUR, from: [dA], to: [{ address: orbitAddr, value: roundAsset('BTC', w.unspentValue(dA) * 0.6) }] })

    // Un bout « direct sur mon compte », le reste retourne en Monero par ChangeNOW
    const depAddr = dest.newDeposit()
    const depTx = w.utxoTx({ time: Math.round(exitT + r.float(1.5, 5) * HOUR), from: [x1], to: [{ address: depAddr, value: roundAsset('BTC', exitBtc * r.float(0.3, 0.45)) }], change: x1 })
    const depValue = w.flowIn(depTx, depAddr)[0].value
    const depSweep = dest.sweep([depAddr], depTx.time + r.int(1, 8) * HOUR)[0]
    const cnT = depTx.time + Math.round(r.float(8, 30) * HOUR)
    const cnTx = forwardAll(w, x1, cnDep, cnT)
    const cnValue = w.flowIn(cnTx, cnDep)[0].value
    const cnSweep = forwardAll(w, cnDep, cnHot, cnT + r.int(5, 25) * 60, undefined, ['sweep'])
    const xmrDest = w.addr('xmr')

    // ── Habillage (après le flux réel) ──────────────────────────────────────
    // Poussière sur l'adresse de collecte, publiée dans les fenêtres d'alerte (jamais dépensée)
    const dust = dusting(w, s, { time: entryT + 3 * DAY, n: r.int(2, 3), spreadH: 48 })
    // Le téléopérateur interpellé : une vie ordinaire autour de ses commissions
    priorHistory(w, opAddrs[0], { start: w.at(-50 * 24), end: w.at(-3 * 24), nIn: r.int(3, 4), nOut: r.int(2, 3), maxUsd: 400 })
    personalSpending(w, opAddrs[0], { start: commTx.time + 6 * HOUR, end: commTx.time + 10 * DAY, n: 2, merchants: [topup, orbit], maxUsd: 120 })

    // Autres clients qui déposent chez eXch
    for (let i = 0; i < r.int(5, 9); i++) {
      const c = w.addr('btc')
      const d = w.addr('btc', { entity: fx, label: `${FX} — Adresse de dépôt`, tags: ['deposit'] })
      const t = entryT + r.float(-2, 7) * DAY
      w.fund(c, roundCoin(w, 0.01, 0.9, 0.0001), t - r.int(2, 30) * HOUR)
      forwardAll(w, c, d, t)
      forwardAll(w, d, fxHot, t + r.int(10, 60) * 60, undefined, ['sweep'])
    }
    // Autres clients de ChangeNOW
    for (let i = 0; i < r.int(3, 5); i++) {
      const c = w.addr('btc')
      const d = w.addr('btc', { entity: cn, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'] })
      const t = cnT + r.float(-2, 2) * DAY
      w.fund(c, roundCoin(w, 0.005, 0.5, 0.0001), t - r.int(2, 30) * HOUR)
      forwardAll(w, c, d, t)
      forwardAll(w, d, cnHot, t + r.int(5, 30) * 60, undefined, ['sweep'])
    }
    chronoNoise(w, dest, 14, exitT - 2 * DAY, exitT + 2 * DAY)

    // ── Réponses (monde final) ──────────────────────────────────────────────
    const sRest = w.utxosOf(s).filter((u) => u.value > 0.00001).reduce((t, u) => t + u.value, 0)
    const entryUsd = usd('BTC', entryBtc)
    const quoteGapPct = (Math.abs(quoted - exitBtc) / exitBtc) * 100
    const quoteGapTxt = quoteGapPct < 0.05 ? 'moins de 0,05 %' : `${quoteGapPct.toFixed(2).replace('.', ',')} %`
    const xmrH = Math.round(((exitTx.time - entryTx.time) / 3600) * 10) / 10
    const destName = dest.entity.name
    const twinVal = w.flowIn(twinTx, Q)[0].value
    const branchLines = [...branchTx.values()].sort((a, b) => a.time - b.time).map((t) => {
      const o = t.outputs.find((x) => x.address !== s)!
      const fate = o.address === bReal ? `${FX} (${entryTx.hash.slice(0, 10)}…)` : o.address === bTwin ? `${A(w, Q).slice(0, 12)}…, jamais dépensés` : o.address === bCasino ? `${orbit.name} (${casinoTx.hash.slice(0, 10)}…)` : `${nSub} petits envois vers des adresses neuves`
      return `${hm(t.time)} · ${amt(o.value, 'BTC')} → ${A(w, o.address).slice(0, 12)}… → ${fate}`
    })
    const opPrev = prevComm!.outputs.find((o) => o.address === opAddrs[0])!.value
    const payDays = Math.round((Math.max(...pays.map((p) => p.time)) - Math.min(...pays.map((p) => p.time))) / DAY)
    const payGapDays = Math.round((commTx.time - prevComm!.time) / DAY)
    // Pièces rédigées en journée (heure de Paris ≈ UTC + 1 ou 2)
    const dayTime = (t: number) => Math.floor(t / DAY) * DAY + r.int(7, 15) * HOUR + r.int(0, 59) * 60
    const plainteT = dayTime(w.at(24))
    const extractionT = dayTime(msgT + r.int(1, 3) * DAY)

    return {
      world: w,
      title: `Faux support technique et Monero — ${city}`,
      briefing:
        `Depuis plusieurs semaines, une fausse fenêtre d'alerte (« Votre ordinateur est infecté, appelez immédiatement le support ») bloque le navigateur d'internautes francophones, souvent âgés. Au téléphone, un pseudo-technicien prend la main à distance sur l'ordinateur puis exige des « frais de dépannage » payables uniquement en bitcoins. ${victimName} (${city}) a payé et porté plainte ; ${nAll} paiements ont été identifiés sur l'adresse BTC indiquée aux victimes.\n\n` +
        `L'exploitation du téléphone ${opP.g("d'un téléopérateur interpellé", "d'une téléopératrice interpellée")}, ${opName}, a révélé une conversation Telegram avec le responsable présumé du centre d'appels, @${handle}. Il s'y vante d'avoir « tout passé en Monero ».\n\n` +
        `Monero masque l'émetteur, le destinataire et le montant : on ne peut pas suivre les fonds à l'intérieur. Il reste les bords observables, côté Bitcoin : l'entrée vers l'échangeur et, peut-être, une sortie quelques jours plus tard. Avant le passage en Monero, l'organisation a rémunéré ses téléopérateurs et éclaté ses fonds sur plusieurs adresses : triez. Utilisez l'outil de corrélation et les éléments OSINT, et mesurez la force de vos conclusions.`,
      evidence: [
        {
          id: 'consignes', type: 'capture', title: 'Capture — consignes de paiement laissées sur l\'ordinateur de la victime', date: complainantT - r.int(1, 3) * HOUR, author: '« Service technique agréé »',
          body:
            `SUPPORT TECHNIQUE — DOSSIER N° ${r.int(10000, 99999)}\n\n` +
            `Intervention : suppression de virus bancaire + licence de protection 3 ans\n` +
            `Montant à régler : ${amt(complainantValue, 'BTC')}\n` +
            `Paiement UNIQUEMENT en Bitcoin, vers l'adresse sécurisée du service :\n${A(w, s)}\n\n` +
            `Ne raccrochez pas pendant l'opération. Ne prévenez pas votre banque, cela bloquerait la réparation.`,
        },
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: victimName,
          body: `« Le technicien avait la main sur mon ordinateur. Il m'a fait installer une application et acheter des bitcoins, puis j'ai payé ${amt(complainantValue, 'BTC')} en suivant ses instructions. Adresse d'envoi : ${A(w, complainantAddr)}. Transaction : ${complainantTx} »`,
        },
        {
          id: 'telegram', type: 'telegram', title: `Telegram — extraction du téléphone ${de(opName)}`, author: `@${handle}`, date: msgT,
          body:
            `[${fmtDate(commTx.time + 20 * 60)}] @${handle} : commissions de la semaine envoyées à toute l'équipe, vérifiez vos wallets\n` +
            `[${fmtDate(entryT + 50 * 60)}] @${handle} : le reste est passé en XMR chez ${FX} 🔒 qu'ils viennent me chercher 😂\n` +
            `[${fmtDate(entryT + 70 * 60)}] ${opName.split(' ')[0]} : et tu ressors quand ? on attend la prime de fin de mois\n` +
            `[${fmtDate(entryT + 75 * 60)}] @${handle} : je laisse dormir quelques jours, comme d'hab\n` +
            `[${fmtDate(msgT)}] @${handle} : c'est ressorti en BTC, ${quoted.toLocaleString('fr-FR')} tout propre 🧼 j'en mets un bout direct sur mon compte, le reste retourne au chaud 🔒`,
        },
        {
          id: 'extraction', type: 'extraction', title: `Extraction — application portefeuille du téléphone ${de(opName)}`, date: extractionT, author: 'Service régional d\'investigation numérique',
          body:
            `Application : portefeuille Bitcoin mobile (non custodial)\n` +
            `Réceptions retenues par l'enquêteur (libellé saisi par l'utilisateur : « taf ») :\n` +
            `— le ${fmtDate(prevComm!.time)} : + ${amt(opPrev, 'BTC')} (statut : confirmé)\n` +
            `— le ${fmtDate(commTx.time)} : + ${amt(opValues[0], 'BTC')} (statut : confirmé)\n` +
            `Autres opérations : achats et virements personnels, non détaillés.\n` +
            `Adresse de réception : non affichée par l'application (affichage tronqué lors de l'extraction).\n` +
            `Phrase de récupération : non retrouvée.`,
        },
        {
          id: 'changenow', type: 'email', title: 'Réponse de ChangeNOW (coopération volontaire)', date: cnT + 20 * DAY, author: 'Service conformité de ChangeNOW',
          body:
            `Suite à votre demande portant sur le dépôt ${cnTx.hash} :\n` +
            `— commande BTC → XMR créée ${Math.round(r.float(3, 20))} minutes avant le dépôt, sans compte client ;\n` +
            `— montant reçu : ${amt(cnValue, 'BTC')} ; XMR envoyés à l'adresse ${A(w, xmrDest)} ;\n` +
            `— adresse IP de création de la commande : sortie d'un fournisseur VPN commercial.\n` +
            `Nous ne disposons d'aucune autre donnée d'identification.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o5', type: 'amount', points: 7, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant total (BTC) l\'adresse de collecte a-t-elle reçu des victimes ?',
          answer: collectedBtc,
          hint: `Additionnez les ${nAll} paiements entrants de l'adresse de collecte (fiche de l'adresse), sans les micro-montants de 546 sats.`,
          explanation: `Les ${nAll} paiements, étalés sur ${payDays} jours, cumulent ${amt(collectedBtc, 'BTC')} (≈ ${Math.round(usd('BTC', collectedBtc)).toLocaleString('fr-FR')} $). Les ${dust.txs.length} entrées de 546 sats, arrivées après la publication de l'adresse, sont de la poussière, pas des paiements. C'est le produit brut de l'escroquerie visible on-chain : il fonde l'évaluation du préjudice.`,
        },
        {
          id: 'o10', type: 'addresses', points: 9,
          prompt: `L'organisation paie ses téléopérateurs depuis l'adresse de collecte, à chaque période de paie. Sélectionnez les adresses rémunérées.`,
          answer: [...opAddrs],
          hint: 'Cherchez les transactions à plusieurs sorties de l\'adresse de collecte : les mêmes destinataires reviennent d\'une paie à l\'autre, et le rendu revient sur l\'adresse de collecte elle-même.',
          explanation: `Deux transactions de paie, à ${payGapDays} jours d'intervalle (${prevComm!.hash.slice(0, 12)}… le ${fmtDate(prevComm!.time, false)}, puis ${commTx.hash.slice(0, 12)}… le ${fmtDate(commTx.time)}) versent de petits montants aux ${nOps} mêmes adresses et renvoient le reste sur l'adresse de collecte (réutilisation d'adresse : ce retour est le rendu). La seconde verse ${amt(commTotal, 'BTC')} au total ; le message « commissions de la semaine » confirme la lecture. Les envois à une seule sortie ne sont pas des paies : vers AdNexa (régie publicitaire) et Mullvad, ce sont les frais du centre d'appels (publicités piégées, VPN) ; vers des adresses neuves juste avant l'entrée chez ${FX}, c'est l'éclatement des fonds.`,
        },
        {
          id: 'o11', type: 'address', points: 8,
          prompt: `Laquelle de ces adresses appartient ${opP.g('au téléopérateur interpellé', 'à la téléopératrice interpellée')}, ${opName} ?`,
          answer: [opAddrs[0]],
          hint: 'L\'extraction de son téléphone indique les montants exacts reçus et leurs dates : comparez avec les sorties des deux transactions de paie.',
          explanation: `Seule ${A(w, opAddrs[0])} reçoit ${amt(opPrev, 'BTC')} puis ${amt(opValues[0], 'BTC')} aux dates affichées par l'application du téléphone saisi. Ce rapprochement relie formellement ${opName} au circuit de l'escroquerie (deux paiements reçus de l'adresse de collecte des victimes), élément utile pour son audition. Ses autres opérations (achats, virements) sont sa vie personnelle.`,
        },
        {
          id: 'o12', type: 'address', points: 11,
          prompt: 'Juste avant le passage en Monero, l\'adresse de collecte envoie des fonds vers quatre adresses neuves. Laquelle mène à l\'échangeur ?',
          answer: [bReal],
          hint: `Deux de ces envois ont presque le même montant, dans la même heure. Suivez chacune des quatre adresses jusqu'au bout, et confrontez avec l'heure du message « passé en XMR chez ${FX} ».`,
          explanation:
            `Les quatre envois :\n${branchLines.join('\n')}\n` +
            `${A(w, bReal).slice(0, 12)}… vide son solde sur une adresse de dépôt ${FX}, aussitôt balayée vers le hot wallet de l'échangeur, environ 50 minutes avant le message « passé en XMR chez ${FX} ». Sa jumelle, de même montant à ${Math.abs(Math.round(((twinVal - entryBtc) / entryBtc) * 1000) / 10).toString().replace('.', ',')} % près et partie dans la même heure, aboutit sur une adresse qui n'a plus jamais bougé : ni service, ni dépôt. Les deux autres finissent dans un casino ou s'éparpillent en petits montants. Il reste ${amt(sRest, 'BTC')} sur l'adresse de collecte (hors poussière).`,
        },
        {
          id: 'o1', type: 'address', points: 9,
          prompt: `Point d'entrée : sur quelle adresse de dépôt ${FX} les bitcoins ont-ils été envoyés ?`,
          answer: [fxDep],
          hint: 'Suivez la branche qui mène à l\'échangeur : la destination est une adresse de dépôt, balayée peu après vers son hot wallet.',
          explanation: `Le ${fmtDate(entryT)}, ${amt(entryBtc, 'BTC')} (≈ ${Math.round(entryUsd).toLocaleString('fr-FR')} $) partent sur ${A(w, fxDep)}, aussitôt balayée vers le hot wallet BTC ${de(FX)}. Côté Monero, plus rien n'est visible. ${procedureFor(fx)}`,
        },
        {
          id: 'o2', type: 'address', points: 12,
          prompt: `Quelle adresse BTC est le candidat de sortie le plus probable (paiement ${FX} au suspect) ?`,
          answer: [x1],
          hint: `Corrélez à partir du message Telegram, pas du dépôt d'entrée : émetteur ${FX}, chaîne Bitcoin, fenêtre de 24 h précédant le message, montant ≈ ${quoted.toLocaleString('fr-FR')} BTC, tolérance élargie (~5 %). Examinez ensuite ce que fait chaque candidat, et son passé.`,
          explanation: `${A(w, x1)} reçoit ${amt(exitBtc, 'BTC')} ${de(FX)} ${Math.round((msgT - exitTx.time) / 60)} minutes avant le message, montant compatible avec « ${quoted.toLocaleString('fr-FR')} » (c'est le seul paiement de la fenêtre qui s'arrondit à cette valeur au millième), puis envoie un bout sur ${destName} (« direct sur mon compte ») et le reste chez ChangeNOW (« au chaud »). Son passé corrobore : deux paiements ${FX} les semaines précédentes, chacun suivi d'un dépôt sur ${destName} (« comme d'hab »). Les autres candidats ont un montant moins proche ou un horaire incompatible, ou finissent dans un casino.`,
        },
        {
          id: 'o8', type: 'address', points: 7,
          prompt: 'Parmi les candidats écartés dans la fenêtre de 24 h, lequel envoie ensuite une partie de ses fonds vers un casino ?',
          answer: [dA],
          hint: 'Reprenez les candidats de la corrélation et dépliez la dépense de chacun.',
          explanation: `${A(w, dA)} reçoit ${de(FX)} ${amt(decoyA.outputs.find((o) => o.address === dA)!.value, 'BTC')}, à quelques % du montant annoncé, puis envoie une partie de ses fonds à ${orbit.name} : rien ne correspond au message, le montant est moins proche que celui du candidat retenu, et l'adresse n'a aucun passé. Le documenter montre que les hypothèses concurrentes ont été examinées et écartées pour des raisons objectives.`,
        },
        {
          id: 'o6', type: 'number', points: 7, tolerance: 2, unit: 'heures',
          prompt: `Combien d'heures séparent le dépôt d'entrée chez ${FX} du paiement de sortie au suspect ?`,
          answer: xmrH,
          hint: `Comparez l'horodatage de la transaction vers l'adresse de dépôt ${FX} et celui du paiement reçu par le candidat de sortie.`,
          explanation: `Entrée le ${fmtDate(entryTx.time)}, sortie le ${fmtDate(exitTx.time)} : environ ${Math.round(xmrH)} h (${(xmrH / 24).toFixed(1).replace('.', ',')} jours). Ce délai, cohérent avec « je laisse dormir quelques jours », explique pourquoi une corrélation lancée depuis le dépôt d'entrée, avec une fenêtre courte, ne pouvait rien donner.`,
        },
        {
          id: 'o9', type: 'address', points: 8,
          prompt: 'Sur quelle adresse de dépôt d\'exchange le candidat de sortie verse-t-il une partie de ses bitcoins après la sortie ?',
          answer: [depAddr],
          hint: 'Suivez la première dépense du candidat après le paiement de l\'échangeur : l\'adresse reçue est ensuite regroupée avec d\'autres vers un portefeuille chaud étiqueté. Les dépôts des semaines précédentes sont d\'autres adresses.',
          explanation: `${A(w, depAddr)} reçoit ${amt(depValue, 'BTC')} le ${fmtDate(depTx.time)}, puis est balayée vers le portefeuille chaud de ${destName} avec d'autres dépôts : c'est l'adresse de dépôt à viser précisément dans la réquisition (les dépôts des semaines précédentes, sur d'autres adresses ${destName}, renverront vraisemblablement au même compte).`,
        },
        {
          id: 'o3', type: 'entity', points: 9,
          prompt: 'Sur quel exchange ce bout des fonds de sortie a-t-il été déposé ?',
          answer: [destKey],
          hint: 'Identifiez le propriétaire du portefeuille chaud qui balaie l\'adresse de dépôt.',
          explanation: `${amt(depValue, 'BTC')} sont déposés sur une adresse de dépôt ${destName}. C'est la réquisition clé : identité du titulaire, IP de connexion, comparaison avec les éléments connus du suspect. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o13', type: 'entity', points: 9,
          prompt: 'Où part le solde du candidat de sortie, après le dépôt sur l\'exchange ?',
          answer: ['changenow'],
          hint: 'Suivez la dernière dépense du candidat : une adresse de dépôt d\'un service sans compte, balayée vers son hot wallet.',
          explanation: `Le ${fmtDate(cnTx.time)}, le candidat vide son solde (${amt(cnValue, 'BTC')}) sur une adresse de dépôt ChangeNOW. La réponse de l'échangeur confirme une commande BTC → XMR : les fonds retournent en Monero, vers une adresse inexploitable, depuis une IP de VPN. L'affaire se termine dans le noir pour cette part : ${procedureFor(cn)}`,
        },
        {
          id: 'o7', type: 'choice', points: 7,
          prompt: 'Lors d\'une perquisition chez @' + handle + ', quel élément permettrait de reconstituer ses transactions Monero ?',
          ...choice(r,
            'Le fichier de portefeuille Monero ou sa phrase de récupération (clés de vue et de dépense)',
            [
              'Son adresse publique Monero seule, qui suffit à lister ses transactions sur un explorateur',
              'Les journaux de n\'importe quel nœud Monero public, qui enregistrent les montants échangés',
              'Le reçu de commande ChangeNOW, qui contient la liste des transactions Monero internes',
            ]),
          hint: 'Sur Monero, les informations sont chiffrées pour le destinataire : qu\'est-ce qui permet de les déchiffrer ?',
          explanation: `Sur Monero, l'adresse publique (comme celle communiquée par ChangeNOW) ne permet pas de retrouver les transactions sur un explorateur : il faut la clé de vue (entrées) et, pour les sorties, les données du portefeuille (clé de dépense, fichier). Les nœuds publics ne voient que des données chiffrées. D'où l'importance de rechercher le matériel (téléphone, ordinateur, papier de sauvegarde) et de le saisir selon le cadre procédural applicable.`,
        },
        {
          id: 'o4', type: 'choice', points: 9,
          prompt: 'Que peut-on honnêtement conclure de cette analyse ?',
          ...choice(r,
            'Attribution probable mais probabiliste de la sortie : à corroborer par réquisition (KYC, IP) et l\'enquête ; la part repassée en Monero reste hors d\'atteinte en l\'état',
            [
              'Lien certain : la corrélation montant/temps prouve à elle seule l\'identité du titulaire',
              'Aucune conclusion possible : Monero rend toute analyse inutile, l\'affaire doit être classée',
              `Lien certain dès que ${FX} ou ChangeNOW auront « déchiffré » la blockchain Monero sur réquisition`,
            ]),
          hint: 'Distinguez ce que prouve la blockchain (de chaque côté du mur) de ce que suggère la corrélation (à travers le mur).',
          explanation: `Le passage par Monero rompt la preuve on-chain. La sortie est une hypothèse étayée par un faisceau d'indices (écart de ${quoteGapTxt} avec le montant annoncé, horaire, schéma « ${FX} puis ${destName} » déjà observé les semaines précédentes) ; elle devient solide si la réquisition à ${destName} renvoie vers @${handle} (identité, IP, appareil). On ne retrouve que ${Math.round((exitBtc / entryBtc) * 100)} % du montant d'entrée, et ${amt(cnValue, 'BTC')} repartent en Monero par ChangeNOW : aucune réquisition ne les suivra au-delà. Seule la saisie du portefeuille Monero du suspect le permettrait.`,
        },
      ],
      truth: {
        path: [...pays.map((t) => t.id), commTx.id, branchTx.get(bReal)!.id, entryTx.id, sweepTx.id, exitTx.id, depTx.id, ...(depSweep ? [depSweep.id] : []), cnTx.id, cnSweep.id],
        addresses: [s, fxDep, x1, depAddr, bReal, cnDep, ...opAddrs],
        debrief:
          `1. ${nAll} victimes du faux support technique versent ${amt(collectedBtc, 'BTC')} sur ${A(w, s)}, en ${payDays} jours.\n` +
          `2. À chaque paie (deux, à ${payGapDays} jours d'intervalle), l'adresse de collecte rémunère les ${nOps} mêmes téléopérateurs (${amt(commTotal, 'BTC')} à la seconde), dont ${opName} (${A(w, opAddrs[0])}, montants retrouvés dans son téléphone).\n` +
          `3. Avant Monero, elle éclate ses fonds sur quatre adresses neuves en moins d'une heure : une vers ${FX}, sa jumelle de même montant vers une adresse dormante, une vers ${orbit.name}, une éparpillée en petits montants.\n` +
          `4. Le ${fmtDate(entryT)}, ${amt(entryBtc, 'BTC')} entrent chez ${FX} (BTC → XMR). Les XMR disparaissent de toute analyse publique : adresses furtives, signatures en anneau, montants masqués (RingCT).\n` +
          `5. Environ ${Math.round(xmrH)} h plus tard, ${FX} paie ${amt(exitBtc, 'BTC')} à ${A(w, x1)}, au milieu de dizaines d'autres paiements ; un candidat proche (${A(w, dA)}) est écarté (casino, montant moins proche, aucun passé). Le portefeuille de sortie avait déjà reçu deux paiements ${FX}, chacun redéposé sur ${destName}.\n` +
          `6. Il dépose ${amt(depValue, 'BTC')} sur ${destName} (${A(w, depAddr)}), puis renvoie le solde, ${amt(cnValue, 'BTC')}, chez ChangeNOW : commande BTC → XMR, retour dans le noir.\n\n` +
          `À retenir : face à Monero, on travaille sur les bords (entrée/sortie), avec des fenêtres et tolérances larges, on croise avec l'OSINT et on regarde le passé des candidats. Avant le mur, on trie : seule une des branches mène à l'échangeur, et des transferts jumeaux de même montant à la même heure ne prouvent rien tant qu'on ne les a pas suivis. Le résultat est une attribution probabiliste à présenter comme telle et à corroborer ; et quand les fonds repartent en Monero, l'affaire peut légitimement s'arrêter là côté blockchain. Les paiements aux téléopérateurs, eux, restent entièrement on-chain.`,
      },
      hints: [
        'L\'adresse de collecte figure dans les consignes de paiement : dépliez ses entrées (victimes, poussière) puis ses sorties (paies, éclatement).',
        'L\'éclatement compte quatre envois dans l\'heure, dont deux de même montant : suivez-les tous avant de conclure.',
        'Corréler à partir du dépôt d\'entrée ne donne rien : les montants et le délai ne correspondent pas. Partez du dernier message Telegram (émetteur : l\'échangeur, Bitcoin, 24 h avant le message, tolérance ~5 %).',
        'Parmi les candidats, cherchez celui qui dépose « direct » sur un compte d\'exchange, et qui l\'a déjà fait.',
        'Après le dépôt, le candidat a encore un solde : où part-il ?',
      ],
    }
  },
}
