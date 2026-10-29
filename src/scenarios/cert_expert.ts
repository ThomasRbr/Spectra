import { World } from '../engine/world'
import { bridge, dex, exchange, peelChain, swapper, roundCoin, HOUR, type ExchangeKit } from '../engine/patterns'
import { roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeName, fmtDate, procedureFor } from './util'

/**
 * Affaire d'examen (certification « Expert », jouée en temps réel) : une
 * rançon traverse quatre chaînes. Les fonds restent quelques heures sur des
 * adresses où un gel est possible : il faut les repérer à temps.
 */
export const certExpert: ScenarioTemplate = {
  id: 'cert-expert',
  certOnly: true,
  title: 'Examen — Quatre chaînes',
  tagline: 'Une rançon, quatre chaînes, quelques heures pour geler.',
  description:
    'Une rançon en bitcoins est épluchée vers deux exchanges, convertie en USDT sur Tron par un échangeur instantané, répartie, bridgée vers Ethereum, échangée en ETH puis bridgée vers BNB Smart Chain. À plusieurs moments, les fonds s\'arrêtent sur des adresses où un gel est possible.',
  difficulty: 4,
  chains: ['btc', 'tron', 'eth', 'bsc'],
  skills: ['peel', 'crosschain', 'bridge', 'dex', 'tron', 'gel', 'requisition'],
  estMinutes: 120,
  lessons: ['peel-chains', 'chain-hopping', 'bridges', 'gel-saisie', 'tracage-outille'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const director = fakeName(r)

    const sw = swapper(w, 'changenow')
    const br = bridge(w, 'arcbridge')
    const uni = dex(w, 'uniswap', 'eth')
    const krak = exchange(w, 'kraken', 'btc')
    const cb = exchange(w, 'coinbase', 'btc')
    const okxT = exchange(w, 'okx', 'tron')
    const binB = exchange(w, 'binance', 'bsc')
    w.entity('tether')
    const suspect = w.customEntity({ name: 'Groupe « Hydre » (inconnu)', category: 'suspect' })
    const victimE = w.customEntity({ name: `Centre hospitalier de ${city}`, category: 'victim' })

    // ── Rançon ───────────────────────────────────────────────────────────────
    const P = roundCoin(w, 1.2, 2.4, 0.01)
    const s0 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const victimAddr = w.addr('btc', { entity: victimE })
    const ransomTx = w.fund(s0, P, w.at(0), { from: [victimAddr] })

    // ── Peel chain vers Kraken et Coinbase ───────────────────────────────────
    const peelDeposits: { kit: ExchangeKit; addr: string }[] = []
    const steps = peelChain(w, {
      start: s0, steps: r.int(4, 5), time: w.at(r.float(1, 2)), stepH: [0.4, 1.2], peelFraction: [0.05, 0.1],
      peelTarget: (i) => {
        const kit = i % 2 === 0 ? krak : cb
        const d = kit.newDeposit()
        peelDeposits.push({ kit, addr: d })
        return d
      },
    })
    const peelSweeps = steps.map((s, i) => peelDeposits[i].kit.sweep([peelDeposits[i].addr], s.tx.time + r.int(1800, 3 * 3600))[0])
    const toKraken = steps.filter((_, i) => peelDeposits[i].kit === krak).reduce((s, x) => s + x.peelValue, 0)
    const toCoinbase = steps.filter((_, i) => peelDeposits[i].kit === cb).reduce((s, x) => s + x.peelValue, 0)
    const mostPeels = toKraken >= toCoinbase ? 'kraken' : 'coinbase'
    const last = steps[steps.length - 1]
    const restAddr = last.next
    const restT = last.tx.time + r.int(1, 2) * HOUR

    // ── ChangeNOW : BTC → USDT (Tron) ────────────────────────────────────────
    const swDeposit = w.addr('btc', { entity: sw.entity, label: `${sw.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
    const orderBtc = roundAsset('BTC', w.unspentValue(restAddr) * 0.995)
    const orderTx = w.utxoTx({ time: restT, from: [restAddr], to: [{ address: swDeposit, value: orderBtc }] })
    const swFee = w.estimateFee('btc', 1, 1)
    const swSweep = w.utxoTx({ time: restT + r.int(300, 1200), from: [swDeposit], to: [{ address: sw.hot('btc'), value: w.unspentValue(swDeposit) - swFee }], fee: swFee, change: null, spendAll: true, tags: ['sweep'] })
    const t1 = w.addr('tron', { entity: suspect })
    const usdtOut = Math.round(usd('BTC', orderBtc) * (1 - r.float(0.008, 0.015)) * 100) / 100
    const payT = restT + r.int(10, 40) * 60
    const payoutTx = w.transfer({ time: payT, from: sw.hot('tron'), to: t1, value: usdtOut, asset: 'USDT', method: 'payout' })
    for (let i = 0; i < r.int(6, 9); i++) {
      const close = i < 3
      const v = close ? usdtOut * r.float(0.9, 1.1) : r.float(200, usdtOut * 2)
      w.transfer({ time: payT + r.int(-3 * 3600, 4 * 3600), from: sw.hot('tron'), to: w.addr('tron'), value: Math.round(v * 100) / 100, asset: 'USDT', method: 'payout' })
    }

    // ── Répartition sur Tron : une part attend, l'autre part vers Ethereum ──
    const t2 = w.addr('tron', { entity: suspect })
    const t3 = w.addr('tron', { entity: suspect })
    const splitT = payT + r.int(60, 120) * 60
    const partHold = Math.round(usdtOut * r.float(0.35, 0.45) * 100) / 100
    const toT2 = w.transfer({ time: splitT, from: t1, to: t2, value: partHold, asset: 'USDT' })
    const toT3 = w.transfer({ time: splitT + r.int(60, 600), from: t1, to: t3, value: Math.round((usdtOut - partHold) * 100) / 100, asset: 'USDT' })
    const holdH = r.float(10, 14)
    const okxDep = okxT.receive(t2, partHold, splitT + Math.round(holdH * HOUR), { asset: 'USDT' })

    // ── Tron → Ethereum (USDT), attente, swap en ETH ─────────────────────────
    const e1 = w.addr('eth', { entity: suspect })
    const br1 = br.send({ from: t3, value: w.balanceOf(t3, 'USDT'), asset: 'USDT', time: toT3.time + r.int(40, 90) * 60, toChain: 'eth', recipient: e1 })
    const swapT = br1.inTx.time + Math.round(r.float(5, 8) * HOUR)
    const swp = uni.swap({ trader: e1, assetIn: 'USDT', amountIn: br1.received, assetOut: 'ETH', time: swapT })

    // ── Ethereum → BNB Smart Chain, dépôt chez Binance ───────────────────────
    const b1 = w.addr('bsc', { entity: suspect })
    const br2 = br.send({ from: e1, value: roundAsset('ETH', swp.amountOut * 0.995), time: swapT + r.int(20, 90) * 60, toChain: 'bsc', recipient: b1 })
    const depBnb = roundAsset('BNB', br2.received * r.float(0.97, 0.99))
    const binDep = binB.receive(b1, depBnb, br2.inTx.time + r.int(30, 180) * 60, { asset: 'BNB' })

    // ── Bruit ──
    krak.noise(10, w.at(-24), w.at(48))
    cb.noise(10, w.at(-24), w.at(48))
    okxT.noise(14, w.at(-12), w.at(72), 'USDT')
    binB.noise(12, w.at(-12), w.at(96), 'BNB')
    uni.noise(25, w.at(0), w.at(72), [['ETH', 'USDT'], ['ETH', 'USDC']])
    for (let i = 0; i < r.int(5, 8); i++) {
      const u = w.addr('tron')
      const v = Math.round(r.float(500, 60000))
      const tb = w.at(r.float(-12, 60))
      w.fundAccount(u, v * 1.01, 'USDT', tb - r.int(1, 12) * HOUR)
      br.send({ from: u, value: v, asset: 'USDT', time: tb, toChain: 'eth', recipient: w.addr('eth') })
    }

    const freezableUsd = partHold + br1.received
    return {
      world: w,
      title: `Opération Hydre — ${city}`,
      briefing:
        `Le ${victimE.name} a payé une rançon de ${amt(P, 'BTC')} pour récupérer ses dossiers patients. Le groupe « Hydre » est connu pour disperser les fonds sur plusieurs chaînes en quelques heures.\n\n` +
        `L'enquête se déroule en temps réel : avancez l'horloge, surveillez les adresses qui détiennent des fonds et demandez les gels au bon moment. Un gel ne bloque que ce qui est encore là quand il prend effet, après le délai de traitement de l'émetteur ou du prestataire.\n\n` +
        `Il faut aussi reconstituer le parcours complet jusqu'à la sortie, et désigner les prestataires à réquisitionner.`,
      evidence: [
        {
          id: 'rancon', type: 'rancon', title: 'Note de rançon', date: w.at(-4),
          body: `Vos données sont chiffrées et copiées. Paiement : ${amt(P, 'BTC')} sur ${A(w, s0)} avant 48 heures.`,
        },
        {
          id: 'pv', type: 'pv', title: 'PV d\'audition du directeur (extrait)', date: w.at(1),
          body: `« ${director}, directeur. La rançon a été payée le ${fmtDate(ransomTx.time)}. Transaction : ${ransomTx.hash}. »`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui', date: w.at(1.5), author: 'Cellule d\'appui crypto',
          body: `Le groupe utilise des peel chains vers des exchanges, puis convertit en USDT sur Tron. Les USDT peuvent être gelés par Tether s'ils restent sur une adresse : délai de traitement constaté de quelques heures.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'entity', points: 10,
          prompt: 'Quel exchange reçoit le plus de bitcoins détachés par la peel chain ?',
          answer: [mostPeels],
          explanation: `La peel chain envoie ${amt(roundAsset('BTC', toKraken), 'BTC')} chez Kraken et ${amt(roundAsset('BTC', toCoinbase), 'BTC')} chez Coinbase, en ${steps.length} pelures.`,
        },
        {
          id: 'o2', type: 'address', points: 15,
          prompt: 'Quelle adresse Tron reçoit le paiement de ChangeNOW ?',
          answer: [t1],
          explanation: `Le reste de la chaîne (${amt(orderBtc, 'BTC')}) part chez ChangeNOW ; ${Math.round((payT - restT) / 60)} minutes plus tard, ${amt(usdtOut, 'USDT')} sont versés à ${A(w, t1)}, soit la valeur déposée moins environ 1 % de commission.`,
        },
        {
          id: 'o3', type: 'address', points: 15,
          prompt: 'Quelle adresse Tron conserve des USDT plusieurs heures, ce qui laissait le temps d\'un gel par Tether ?',
          answer: [t2],
          explanation: `${A(w, t2)} reçoit ${amt(partHold, 'USDT')} et ne les envoie chez OKX que ${holdH.toFixed(0)} heures plus tard : une demande à Tether dès le paiement de ChangeNOW les aurait bloqués.`,
        },
        {
          id: 'o4', type: 'address', points: 15,
          prompt: 'Quelle adresse Ethereum reçoit les USDT bridgés depuis Tron ?',
          answer: [e1],
          explanation: `ArcBridge verse ${amt(br1.received, 'USDT')} à ${A(w, e1)}, qui les garde ${Math.round((swapT - br1.inTx.time) / 3600)} heures avant de les échanger en ETH sur Uniswap : seconde fenêtre de gel par Tether.`,
        },
        {
          id: 'o5', type: 'entity', points: 15,
          prompt: 'Sur quel exchange les fonds sortent-ils sur BNB Smart Chain ?',
          answer: ['binance'],
          explanation: `Après le second bridge, ${A(w, b1)} dépose ${amt(depBnb, 'BNB')} sur une adresse de dépôt Binance. ${procedureFor(binB.entity)}`,
        },
        {
          id: 'o6', type: 'amount', points: 15, unit: 'BNB', tolerance: 0.02,
          prompt: 'Combien de BNB sont déposés chez Binance ?',
          answer: depBnb,
          explanation: `${amt(depBnb, 'BNB')}, sur l'adresse de dépôt Binance de ${A(w, b1)}.`,
        },
        {
          id: 'o7', type: 'choice', points: 15,
          prompt: 'Les USDT sont sur une adresse que le suspect contrôle seul. Qui peut les geler ?',
          ...choice(r,
            'Tether, l\'émetteur, qui peut bloquer l\'adresse dans le contrat du jeton',
            [
              'Personne : une adresse auto-hébergée ne peut jamais être gelée',
              'Les validateurs de Tron, sur réquisition',
              'ChangeNOW, qui a versé les USDT',
            ]),
          explanation: `L'USDT est un jeton centralisé : son contrat permet à Tether d'inscrire une adresse sur liste noire, même auto-hébergée. ChangeNOW n'a plus la main une fois le paiement effectué, et les validateurs ne censurent pas des adresses sur réquisition.`,
        },
      ],
      truth: {
        path: [
          ransomTx.id, ...steps.map((s) => s.tx.id), ...peelSweeps.map((s) => s.id), orderTx.id, swSweep.id, payoutTx.id, toT2.id, toT3.id,
          okxDep.tx.id, ...(okxDep.sweep ? [okxDep.sweep.id] : []), br1.outTx.id, br1.inTx.id, swp.tx.id, br2.outTx.id, br2.inTx.id,
          binDep.tx.id, ...(binDep.sweep ? [binDep.sweep.id] : []),
        ],
        addresses: [s0, ...peelDeposits.map((p) => p.addr), swDeposit, t1, t2, t3, e1, b1, okxDep.deposit, binDep.deposit],
        debrief:
          `1. La rançon (${amt(P, 'BTC')}) est épluchée en ${steps.length} pelures vers Kraken et Coinbase.\n` +
          `2. Le reste part chez ChangeNOW et ressort en ${amt(usdtOut, 'USDT')} sur ${A(w, t1)} (Tron).\n` +
          `3. ${amt(partHold, 'USDT')} attendent ${holdH.toFixed(0)} h sur ${A(w, t2)} avant d'aller chez OKX : fenêtre de gel par Tether.\n` +
          `4. Le reste est bridgé vers ${A(w, e1)} (Ethereum), y reste ${Math.round((swapT - br1.inTx.time) / 3600)} h en USDT (seconde fenêtre de gel), puis est échangé en ETH.\n` +
          `5. Les ETH sont bridgés vers BNB Smart Chain et ${amt(depBnb, 'BNB')} sont déposés chez Binance.\n\n` +
          `Fonds gelables pendant l'affaire : environ ${Math.round(freezableUsd).toLocaleString('fr-FR')} $ en USDT, plus les comptes clients des exchanges (Kraken, Coinbase, OKX, Binance) une fois les dépôts identifiés.`,
      },
      hints: [],
    }
  },
}

