import { World } from '../engine/world'
import { bridge, dex, exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, fakeCity, fakeHandle, fakeName, fmtDate, procedureFor } from './util'

export const accRugpullBsc: ScenarioTemplate = {
  id: 'rugpull-bsc',
  title: 'Rug pull sur BNB Smart Chain',
  tagline: 'Une prévente de jeton, des dizaines d\'investisseurs, un développeur qui part avec la caisse.',
  description:
    'Le projet « Zephyrion ($ZPHR) » a levé des BNB et des USDT lors d\'une prévente. Le jour du lancement, le développeur a vidé le contrat de prévente, réparti les fonds sur plusieurs portefeuilles, bridgé une partie vers Ethereum et envoyé le reste sur un exchange. Mesurez le préjudice et suivez la sortie.',
  difficulty: 3,
  chains: ['bsc', 'eth'],
  skills: ['evm', 'tokens', 'defi', 'bridge', 'typologies', 'exchange_id'],
  estMinutes: 30,
  lessons: ['comptes-evm', 'tokens-erc20', 'dex-defi', 'bridges', 'typologies', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimName = fakeName(r)
    const devHandle = fakeHandle(r)

    const br = bridge(w, 'arcbridge')
    const syrup = dex(w, 'pancakeswap', 'bsc')
    const destKey = r.pick(['huobex', 'okx', 'binance'] as const)
    const dest = exchange(w, destKey, 'bsc')
    const onramps = [exchange(w, 'binance', 'bsc'), exchange(w, 'okx', 'bsc'), exchange(w, 'coinhouse', 'bsc')]

    const projectE = w.customEntity({ name: 'Zephyrion ($ZPHR)', category: 'scam' })
    const devE = w.customEntity({ name: `Développeur « ${devHandle} » (inconnu)`, category: 'suspect' })
    const dev = w.addr('bsc', { entity: devE })
    const presale = w.addr('bsc', { entity: projectE, contract: { name: 'ZPHR Presale', type: 'vault' } })

    // Le développeur se finance via le bridge depuis Ethereum, puis déploie la prévente
    const devEth = w.addr('eth', { entity: devE })
    w.fundAccount(devEth, roundAsset('ETH', r.float(0.6, 1.5)), 'ETH', w.at(-r.float(25, 35) * 24))
    const seedBr = br.send({ from: devEth, value: roundAsset('ETH', r.float(0.3, 0.5)), time: w.at(-r.float(20, 24) * 24), toChain: 'bsc', recipient: dev })
    const deploy = w.multi({ time: w.at(-r.float(18, 19) * 24), signer: dev, legs: [{ from: dev, to: presale, value: 0.01, asset: 'BNB' }], method: 'Contract Creation' })

    // Prévente : investisseurs financés par des exchanges
    const nInv = r.int(14, 26)
    let raisedBnb = 0
    let raisedUsdt = 0
    let nContrib = 0
    const contribs: string[] = []
    let complainant = ''
    let complainantTx = ''
    for (let i = 0; i < nInv; i++) {
      const inv = w.addr('bsc', { entity: i === 0 ? w.customEntity({ name: victimName, category: 'victim' }) : undefined })
      const ramp = r.pick(onramps)
      // Au plus 36 participations : le graphe affiche 40 transactions par dépliage.
      const times = r.chance(0.25) && nContrib + (nInv - i) + 1 <= 36 ? 2 : 1
      for (let k = 0; k < times; k++) {
        const t = w.at(-r.float(1, 16) * 24)
        if (r.chance(0.6)) {
          const v = roundAsset('BNB', r.float(0.3, 8))
          ramp.withdraw(inv, roundAsset('BNB', v + r.float(0.01, 0.05)), t - r.int(1, 48) * HOUR, 'BNB')
          const tx = w.multi({ time: t, signer: inv, legs: [{ from: inv, to: presale, value: v, asset: 'BNB' }], method: 'buyTokens' })
          raisedBnb += v
          contribs.push(tx.id)
          if (i === 0 && !complainantTx) complainantTx = tx.hash
        } else {
          const v = Math.round(r.float(200, 5000) / 10) * 10
          ramp.withdraw(inv, roundAsset('BNB', r.float(0.01, 0.04)), t - r.int(2, 60) * HOUR, 'BNB')
          ramp.withdraw(inv, v, t - r.int(1, 48) * HOUR, 'USDT')
          const tx = w.multi({ time: t, signer: inv, legs: [{ from: inv, to: presale, value: v, asset: 'USDT' }], method: 'buyWithUSDT' })
          raisedUsdt += v
          contribs.push(tx.id)
          if (i === 0 && !complainantTx) complainantTx = tx.hash
        }
        nContrib++
      }
      if (i === 0) complainant = inv
    }
    raisedBnb = roundAsset('BNB', raisedBnb)
    const raisedUsd = usd('BNB', raisedBnb) + raisedUsdt

    // Le rug : vidage du contrat le jour du lancement
    const rugT = w.at(r.float(0, 6))
    const rugBnb = roundAsset('BNB', raisedBnb + 0.01)
    const rug = w.multi({
      time: rugT, signer: dev, method: 'emergencyWithdraw',
      legs: [{ from: presale, to: dev, value: rugBnb, asset: 'BNB' }, ...(raisedUsdt > 0 ? [{ from: presale, to: dev, value: raisedUsdt, asset: 'USDT' as const }] : [])],
    })

    // Répartition sur plusieurs portefeuilles
    const w1 = w.addr('bsc', { entity: devE })
    const w2 = w.addr('bsc', { entity: devE })
    const w3 = w.addr('bsc', { entity: devE })
    const bnbAll = w.balanceOf(dev, 'BNB')
    const toW1 = roundAsset('BNB', bnbAll * r.float(0.4, 0.55))
    const toW3 = roundAsset('BNB', (bnbAll - toW1) * r.float(0.75, 0.9))
    const s1 = w.transfer({ time: rugT + r.int(5, 30) * 60, from: dev, to: w1, value: toW1, asset: 'BNB' })
    const s3 = w.transfer({ time: rugT + r.int(31, 60) * 60, from: dev, to: w3, value: toW3, asset: 'BNB' })
    const splits = [s1.id, s3.id]
    // W2 reçoit les USDT (et du BNB pour le gas)
    splits.push(w.transfer({ time: rugT + r.int(61, 90) * 60, from: dev, to: w2, value: roundAsset('BNB', 0.02), asset: 'BNB' }).id)
    let usdtToExchange = 0
    const exitTxs: string[] = []
    if (raisedUsdt > 0) {
      splits.push(w.transfer({ time: rugT + r.int(91, 120) * 60, from: dev, to: w2, value: raisedUsdt, asset: 'USDT' }).id)
      const d2 = dest.receive(w2, raisedUsdt, rugT + r.float(4, 10) * HOUR, { asset: 'USDT' })
      usdtToExchange += raisedUsdt
      exitTxs.push(d2.tx.id)
    }

    // W1 : bridge vers Ethereum
    const ethDest = w.addr('eth', { entity: devE })
    const brOut = br.send({ from: w1, value: roundAsset('BNB', toW1 * 0.995), time: rugT + r.float(1.5, 4) * HOUR, toChain: 'eth', recipient: ethDest })

    // W3 : swap BNB → USDT sur PancakeSwap puis exchange
    const sw = syrup.swap({ trader: w3, assetIn: 'BNB', amountIn: roundAsset('BNB', toW3 * 0.99), assetOut: 'USDT', time: rugT + r.float(3, 8) * HOUR })
    const d3 = dest.receive(w3, sw.amountOut, rugT + r.float(9, 20) * HOUR, { asset: 'USDT' })
    usdtToExchange += sw.amountOut
    exitTxs.push(d3.tx.id)

    // Bruit
    syrup.noise(30, w.at(-3 * 24), w.at(3 * 24), [['BNB', 'USDT'], ['BNB', 'USDC']])
    dest.noise(16, w.at(-3 * 24), w.at(4 * 24), 'USDT')
    for (const o of onramps) o.noise(6, w.at(-16 * 24), w.at(2 * 24), 'BNB')
    for (let i = 0; i < r.int(5, 8); i++) {
      const u = w.addr('bsc')
      const tb = w.at(r.float(-3, 4) * 24)
      const v = roundAsset('BNB', r.float(0.5, 40))
      w.fundAccount(u, roundAsset('BNB', v * 1.01), 'BNB', tb - r.float(0.2, 2) * DAY)
      br.send({ from: u, value: v, time: tb, toChain: 'eth', recipient: w.addr('eth') })
    }

    return {
      world: w,
      title: `Rug pull Zephyrion — ${city}`,
      briefing:
        `${victimName} (${city}) a participé à la prévente du jeton « Zephyrion ($ZPHR) », promu sur Telegram et par des influenceurs comme « le prochain x100 de BNB Chain ». Les investisseurs envoyaient des BNB ou des USDT au contrat de prévente en échange de jetons à recevoir au lancement.\n\n` +
        `Le jour du lancement, le site et le canal Telegram ont disparu. Plusieurs autres investisseurs se sont manifestés.\n\n` +
        `Objectifs : identifier le portefeuille du développeur, mesurer l'ampleur de la levée (nombre d'investisseurs, total en USD) et suivre la sortie des fonds, y compris sur Ethereum.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(3 * 24), author: victimName,
          body:
            `« J'ai participé à la prévente depuis mon portefeuille : ${A(w, complainant)}.\n` +
            `Transaction de participation : ${complainantTx}\n` +
            `On devait recevoir les jetons au lancement, le ${fmtDate(rugT, false)}. Rien n'est arrivé. »`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Annonce épinglée du canal Telegram Zephyrion', author: `@${devHandle}`, date: w.at(-18 * 24),
          body:
            `🚀 ZEPHYRION PRESALE IS LIVE 🚀\n` +
            `Contrat officiel de prévente (BSC) : ${A(w, presale)}\n` +
            `Acceptés : BNB et USDT (BEP-20)\n` +
            `✅ Liquidité verrouillée 12 mois  ✅ Équipe doxxée  ✅ Audit en cours\n` +
            `Lancement sur PancakeSwap dans 18 jours !`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture du site (archive)', date: w.at(-5 * 24),
          body: `Zephyrion — The future of DeFi yield\nPresale : 87 % rempli 🔥\nHard cap : 150 BNB\nListing PancakeSwap : ${fmtDate(rugT, false)}`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 20,
          prompt: 'Quelle est l\'adresse du développeur qui a vidé le contrat de prévente ?',
          answer: [dev],
          hint: 'Dépliez les flux sortants du contrat de prévente : une seule transaction en retire tout.',
          explanation: `${A(w, dev)} a déployé le contrat de prévente puis appelé « emergencyWithdraw » le ${fmtDate(rugT)}, récupérant ${amt(rugBnb, 'BNB')}${raisedUsdt > 0 ? ` et ${amt(raisedUsdt, 'USDT')}` : ''}.`,
        },
        {
          id: 'o2', type: 'number', points: 20, tolerance: 1, unit: 'investisseurs',
          prompt: 'Combien d\'investisseurs distincts (adresses, hors développeur) ont participé à la prévente ?',
          answer: nInv,
          hint: 'Comptez les adresses, pas les transactions : certains investisseurs ont participé deux fois. Le versement de déploiement du développeur ne compte pas.',
          explanation: `${nInv} adresses distinctes pour ${nContrib} participations. Chacune est une victime potentielle à identifier, notamment via les exchanges qui les ont financées.`,
        },
        {
          id: 'o3', type: 'amount', points: 20, unit: 'USD', tolerance: 0.03,
          prompt: 'Quel montant total (en USD) les investisseurs ont-ils versé à la prévente ?',
          answer: raisedUsd,
          hint: 'Additionnez les BNB (convertis en USD) et les USDT reçus par le contrat de prévente.',
          explanation: `${amt(raisedBnb, 'BNB')} (≈ ${Math.round(usd('BNB', raisedBnb)).toLocaleString('fr-FR')} $) + ${amt(raisedUsdt, 'USDT')} = ${Math.round(raisedUsd).toLocaleString('fr-FR')} $.`,
        },
        {
          id: 'o4', type: 'entity', points: 20,
          prompt: 'Sur quel exchange une partie des fonds a-t-elle été déposée ?',
          answer: [destKey],
          explanation: `${amt(roundAsset('USDT', usdtToExchange), 'USDT')} arrivent sur ${dest.entity.name}${raisedUsdt > 0 ? ' : les USDT de la prévente directement, et des BNB convertis en USDT sur PancakeSwap' : ', après conversion des BNB en USDT sur PancakeSwap'}. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o5', type: 'address', points: 20,
          prompt: 'Quelle adresse Ethereum a reçu les fonds bridgés depuis BNB Smart Chain ?',
          answer: [ethDest],
          hint: 'La transaction bridgeOut indique la transaction correspondante sur Ethereum et son destinataire.',
          explanation: `${A(w, w1)} envoie ${amt(roundAsset('BNB', toW1 * 0.995), 'BNB')} dans ArcBridge ; ${amt(brOut.received, 'ETH')} sont versés à ${A(w, ethDest)} sur Ethereum. Bonus : le développeur avait déjà utilisé ArcBridge depuis Ethereum pour financer son adresse BSC (${A(w, devEth)}).`,
        },
      ],
      truth: {
        path: [seedBr.outTx.id, seedBr.inTx.id, deploy.id, ...contribs, rug.id, ...splits, brOut.outTx.id, brOut.inTx.id, sw.tx.id, ...exitTxs],
        addresses: [dev, presale, w1, w2, w3, ethDest, devEth],
        debrief:
          `1. Le développeur ${A(w, dev)}, financé via ArcBridge depuis ${A(w, devEth)} (Ethereum), déploie le contrat de prévente ${A(w, presale)}.\n` +
          `2. ${nInv} investisseurs y versent ${amt(raisedBnb, 'BNB')} et ${amt(raisedUsdt, 'USDT')} en ${nContrib} participations, soit ≈ ${Math.round(raisedUsd).toLocaleString('fr-FR')} $.\n` +
          `3. Le jour du lancement, « emergencyWithdraw » renvoie tout au développeur, qui répartit sur trois portefeuilles.\n` +
          `4. ${A(w, w1)} bridge ses BNB vers Ethereum (${amt(brOut.received, 'ETH')} pour ${A(w, ethDest)}) ; ${A(w, w3)} convertit ses BNB en USDT sur PancakeSwap ; les USDT finissent sur ${dest.entity.name}.\n\n` +
          `À retenir : dans un rug pull, le contrat (prévente, pool de liquidité) centralise la preuve du préjudice : chaque transaction entrante est une victime. La fonction de retrait réservée au propriétaire (« emergencyWithdraw », « removeLiquidity ») désigne le développeur. Les promesses (« liquidité verrouillée », « équipe doxxée ») se vérifient on-chain. Penser à réquisitionner les exchanges qui ont financé les investisseurs pour les identifier et les informer.`,
      },
      hints: [
        'Le contrat de prévente est dans l\'annonce Telegram : dépliez ses flux entrants (investisseurs) et sortants.',
        'Pour compter les investisseurs, regroupez les participations par adresse émettrice.',
        'Le développeur ne garde pas les fonds au même endroit : suivez chacun de ses portefeuilles, actif par actif.',
        'Le détail d\'une transaction bridgeOut mène directement à la transaction bridgeIn sur l\'autre chaîne.',
      ],
    }
  },
}
