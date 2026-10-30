import { World } from '../engine/world'
import { bridge, dex, exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakeName, fmtDate, procedureFor } from './util'

export const accRugpullBsc: ScenarioTemplate = {
  id: 'rugpull-bsc',
  title: 'Rug pull sur BNB Smart Chain',
  tagline: 'Une prévente de jeton, des dizaines d\'investisseurs, un développeur qui part avec la caisse.',
  description:
    'Le projet « Zephyrion ($ZPHR) » a levé des BNB et des USDT lors d\'une prévente. Le jour du lancement, le développeur a vidé le contrat de prévente, réparti les fonds sur plusieurs portefeuilles, bridgé une partie vers Ethereum et envoyé le reste sur un exchange. Mesurez le préjudice et suivez la sortie.',
  difficulty: 3,
  chains: ['bsc', 'eth'],
  skills: ['evm', 'tokens', 'defi', 'bridge', 'typologies', 'exchange_id'],
  estMinutes: 60,
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
    // Financement initial par un retrait d'exchange (piste d'identification)
    const fundKey = r.pick(['kraken', 'coinbase', 'bitstamp'] as const)
    const funder = exchange(w, fundKey, 'eth')
    const fundTx = funder.withdraw(devEth, roundAsset('ETH', r.float(0.6, 1.5)), w.at(-r.float(25, 35) * 24), 'ETH')
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
    for (const o of onramps) o.noise(9, w.at(-16 * 24), w.at(2 * 24), 'BNB')
    funder.noise(14, w.at(-40 * 24), w.at(-15 * 24), 'ETH')
    for (let i = 0; i < r.int(5, 8); i++) {
      const u = w.addr('bsc')
      const tb = w.at(r.float(-3, 4) * 24)
      const v = roundAsset('BNB', r.float(0.5, 40))
      w.fundAccount(u, roundAsset('BNB', v * 1.01), 'BNB', tb - r.float(0.2, 2) * DAY)
      br.send({ from: u, value: v, time: tb, toChain: 'eth', recipient: w.addr('eth') })
    }

    const destName = dest.entity.name
    const funderName = funder.entity.name
    // BNB laissés sur l'adresse du développeur après la répartition
    const devLeft = roundAsset('BNB', w.balanceOf(dev, 'BNB'))
    const usdtOut = roundAsset('USDT', usdtToExchange)
    const firstExit = Math.min(...exitTxs.map((id) => w.tx(id).time))
    const exitH = Math.round(((firstExit - rugT) / 3600) * 10) / 10

    return {
      world: w,
      title: `Rug pull Zephyrion — ${city}`,
      briefing:
        `${victimName} (${city}) a participé à la prévente du jeton « Zephyrion ($ZPHR) », promu sur Telegram et par des influenceurs comme « le prochain x100 de BNB Chain ». Les investisseurs envoyaient des BNB ou des USDT au contrat de prévente en échange de jetons à recevoir au lancement.\n\n` +
        `Le jour du lancement, le site et le canal Telegram ont disparu. Plusieurs autres investisseurs se sont manifestés.\n\n` +
        `Objectifs : identifier le portefeuille du développeur, mesurer l'ampleur de la levée (nombre d'investisseurs, total en USD), suivre la répartition et la sortie des fonds, y compris sur Ethereum, chiffrer ce qui peut encore être gelé et remonter au financement initial du développeur.`,
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
        {
          id: 'note', type: 'note', title: 'Demande du magistrat', date: w.at(4 * 24), author: 'Parquet — pôle cybercriminalité',
          body:
            `Avant d'adresser les réquisitions, merci de préciser :\n` +
            `— la liste des portefeuilles du développeur ayant reçu les fonds ;\n` +
            `— le montant arrivé sur une plateforme centralisée (susceptible de gel) et ce qui reste sur les adresses du développeur ;\n` +
            `— la rapidité de la sortie après le vidage du contrat ;\n` +
            `— l'origine des premiers fonds du développeur, souvent plus exposée que la sortie.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse du développeur qui a vidé le contrat de prévente ?',
          answer: [dev],
          hint: 'Dépliez les flux sortants du contrat de prévente : une seule transaction en retire tout.',
          explanation: `${A(w, dev)} a déployé le contrat de prévente puis appelé « emergencyWithdraw » le ${fmtDate(rugT)}, récupérant ${amt(rugBnb, 'BNB')}${raisedUsdt > 0 ? ` et ${amt(raisedUsdt, 'USDT')}` : ''}.`,
        },
        {
          id: 'o2', type: 'number', points: 10, tolerance: 1, unit: 'investisseurs',
          prompt: 'Combien d\'investisseurs distincts (adresses, hors développeur) ont participé à la prévente ?',
          answer: nInv,
          hint: 'Comptez les adresses, pas les transactions : certains investisseurs ont participé deux fois. Le versement de déploiement du développeur ne compte pas.',
          explanation: `${nInv} adresses distinctes pour ${nContrib} participations. Chacune est une victime potentielle à identifier, notamment via les exchanges qui les ont financées.`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'USD', tolerance: 0.03,
          prompt: 'Quel montant total (en USD) les investisseurs ont-ils versé à la prévente ?',
          answer: raisedUsd,
          hint: 'Additionnez les BNB (convertis en USD) et les USDT reçus par le contrat de prévente.',
          explanation: `${amt(raisedBnb, 'BNB')} (≈ ${Math.round(usd('BNB', raisedBnb)).toLocaleString('fr-FR')} $) + ${amt(raisedUsdt, 'USDT')} = ${Math.round(raisedUsd).toLocaleString('fr-FR')} $. Seuls les flux entrants des investisseurs comptent (pas le versement de déploiement du développeur) : ce total, établi on-chain contrat par contrat, fonde l'évaluation du préjudice global.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Quel élément on-chain démontre que la promesse « liquidité verrouillée 12 mois » était fausse ?',
          ...choice(r,
            'Le développeur a retiré la totalité des fonds du contrat en un seul appel (« emergencyWithdraw »), sans aucun verrou',
            [
              'Les investisseurs ont pu payer indifféremment en BNB et en USDT',
              'Le développeur a financé son adresse BSC via un bridge depuis Ethereum',
              'Le contrat de prévente a reçu plus de 30 participations en quelques jours',
            ]),
          hint: 'Un verrou de liquidité empêche précisément une certaine opération : laquelle a eu lieu ?',
          explanation: `Une liquidité réellement verrouillée ne peut pas être retirée par le propriétaire avant l'échéance. Ici, la transaction « emergencyWithdraw » du ${fmtDate(rugT)} vide le contrat au profit du développeur : la fonction de retrait réservée au propriétaire est la signature du rug pull et l'élément matériel de la tromperie, à exposer dans le rapport.`,
        },
        {
          id: 'o6', type: 'addresses', points: 10,
          prompt: 'Sélectionnez les portefeuilles BSC vers lesquels le développeur a réparti les fonds après le vidage.',
          answer: [w1, w2, w3],
          hint: 'Dépliez les transferts sortants de l\'adresse du développeur dans les heures qui suivent « emergencyWithdraw » (BNB et USDT).',
          explanation: `Le développeur répartit en trois portefeuilles neufs : ${A(w, w1)} (${amt(toW1, 'BNB')}, destiné au bridge), ${A(w, w3)} (${amt(toW3, 'BNB')}, destiné au swap) et ${A(w, w2)} (${raisedUsdt > 0 ? 'les USDT de la prévente et ' : ''}un peu de BNB pour le gas). Le fractionnement vise à brouiller le traçage, mais chaque transfert part de la même adresse : le rattachement au développeur est direct.`,
        },
        {
          id: 'o5', type: 'address', points: 10,
          prompt: 'Quelle adresse Ethereum a reçu les fonds bridgés depuis BNB Smart Chain ?',
          answer: [ethDest],
          hint: 'La transaction bridgeOut indique la transaction correspondante sur Ethereum et son destinataire.',
          explanation: `${A(w, w1)} envoie ${amt(roundAsset('BNB', toW1 * 0.995), 'BNB')} dans ArcBridge ; ${amt(brOut.received, 'ETH')} sont versés à ${A(w, ethDest)} sur Ethereum.`,
        },
        {
          id: 'o4', type: 'entity', points: 10,
          prompt: 'Sur quel exchange une partie des fonds a-t-elle été déposée ?',
          answer: [destKey],
          hint: 'Suivez les USDT : ceux de la prévente et ceux issus du swap PancakeSwap finissent au même endroit.',
          explanation: `Les USDT arrivent sur ${destName}${raisedUsdt > 0 ? ' : les USDT de la prévente directement, et des BNB convertis en USDT sur PancakeSwap' : ', après conversion des BNB en USDT sur PancakeSwap'}. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o7', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: `Quel montant total d'USDT a été déposé sur cet exchange (susceptible de gel) ?`,
          answer: usdtOut,
          hint: `Additionnez les dépôts USDT reçus par les adresses de dépôt ${destName} depuis les portefeuilles du développeur.`,
          explanation: `${raisedUsdt > 0 ? `${amt(raisedUsdt, 'USDT')} (USDT de la prévente, via ${A(w, w2)}) + ${amt(sw.amountOut, 'USDT')} (swap, via ${A(w, w3)})` : `${amt(sw.amountOut, 'USDT')} issus du swap, via ${A(w, w3)}`} = ${amt(usdtOut, 'USDT')}. C'est le montant à mentionner dans la demande de gel adressée à ${destName} : l'exchange peut bloquer le compte tant que les fonds n'ont pas été retirés.`,
        },
        {
          id: 'o8', type: 'number', points: 8, tolerance: 1, unit: 'heures',
          prompt: 'Combien d\'heures après le vidage du contrat le premier dépôt sur l\'exchange intervient-il ?',
          answer: exitH,
          hint: 'Comparez l\'heure de « emergencyWithdraw » et celle du premier transfert vers une adresse de dépôt de l\'exchange.',
          explanation: `Vidage le ${fmtDate(rugT)}, premier dépôt le ${fmtDate(firstExit)} : environ ${exitH.toFixed(1).replace('.', ',')} h. Une sortie aussi rapide, préparée à l'avance (portefeuilles créés, bridge et swap enchaînés), contredit toute thèse de « piratage » ou de « problème technique » que le développeur pourrait invoquer.`,
        },
        {
          id: 'o9', type: 'amount', points: 8, unit: 'BNB', tolerance: 0.02,
          prompt: 'Quel solde de BNB est resté sur l\'adresse du développeur après la répartition ?',
          answer: devLeft,
          hint: 'Faites le bilan de l\'adresse du développeur : BNB reçus (bridge, emergencyWithdraw) moins BNB envoyés (déploiement, trois portefeuilles).',
          explanation: `L'adresse ${A(w, dev)} conserve ${amt(devLeft, 'BNB')} (≈ ${Math.round(usd('BNB', devLeft)).toLocaleString('fr-FR')} $). Ces fonds sont sous le seul contrôle du développeur (portefeuille non custodial) : aucun tiers ne peut les geler, mais ils deviendraient saisissables si ses clés étaient retrouvées lors d'une perquisition.`,
        },
        {
          id: 'o10', type: 'address', points: 9,
          prompt: 'Le développeur s\'était financé depuis Ethereum avant de déployer la prévente. Quelle adresse Ethereum a envoyé ces fonds dans le bridge ?',
          answer: [devEth],
          hint: 'Remontez les premiers fonds reçus par l\'adresse du développeur sur BSC : une transaction bridgeIn renvoie à sa jumelle sur Ethereum.',
          explanation: `Le ${fmtDate(seedBr.outTx.time)}, ${A(w, devEth)} envoie ${amt(seedBr.outTx.transfers[0].value, 'ETH')} dans ArcBridge ; la transaction bridgeIn verse ${amt(seedBr.received, 'BNB')} à l'adresse du développeur sur BSC, quelques jours avant le déploiement. Le même acteur contrôle donc les deux adresses : la phase de préparation est souvent moins prudente que la sortie.`,
        },
        {
          id: 'o12', type: 'entity', points: 9,
          prompt: 'Quelle plateforme a fourni les premiers ETH de cette adresse Ethereum ?',
          answer: [fundKey],
          hint: 'Regardez la toute première transaction entrante de l\'adresse Ethereum du développeur.',
          explanation: `Le ${fmtDate(fundTx.time)}, l'adresse Ethereum du développeur reçoit ${amt(fundTx.transfers[0].value, 'ETH')} d'un portefeuille chaud ${funderName} : c'est un retrait depuis un compte client. La réquisition à ${funderName} sur ce retrait (identité, IP, moyens de paiement) peut identifier le développeur, indépendamment de la sortie des fonds. ${procedureFor(funder.entity)}`,
        },
      ],
      truth: {
        path: [fundTx.id, seedBr.outTx.id, seedBr.inTx.id, deploy.id, ...contribs, rug.id, ...splits, brOut.outTx.id, brOut.inTx.id, sw.tx.id, ...exitTxs],
        addresses: [dev, presale, w1, w2, w3, ethDest, devEth],
        debrief:
          `1. Le développeur se finance par un retrait ${funderName} vers ${A(w, devEth)} (Ethereum), passe par ArcBridge vers ${A(w, dev)} (BSC) et déploie le contrat de prévente ${A(w, presale)}.\n` +
          `2. ${nInv} investisseurs y versent ${amt(raisedBnb, 'BNB')} et ${amt(raisedUsdt, 'USDT')} en ${nContrib} participations, soit ≈ ${Math.round(raisedUsd).toLocaleString('fr-FR')} $.\n` +
          `3. Le jour du lancement, « emergencyWithdraw » renvoie tout au développeur, qui répartit sur trois portefeuilles et garde ${amt(devLeft, 'BNB')} sur son adresse.\n` +
          `4. ${A(w, w1)} bridge ses BNB vers Ethereum (${amt(brOut.received, 'ETH')} pour ${A(w, ethDest)}) ; ${A(w, w3)} convertit ses BNB en USDT sur PancakeSwap ; ${amt(usdtOut, 'USDT')} finissent sur ${destName}, le premier dépôt environ ${exitH.toFixed(1).replace('.', ',')} h après le vidage.\n\n` +
          `À retenir : dans un rug pull, le contrat (prévente, pool de liquidité) centralise la preuve du préjudice : chaque transaction entrante est une victime. La fonction de retrait réservée au propriétaire (« emergencyWithdraw », « removeLiquidity ») désigne le développeur. Les promesses (« liquidité verrouillée », « équipe doxxée ») se vérifient on-chain. Deux réquisitions se complètent : ${destName} (sortie, gel) et ${funderName} (financement initial). Penser aussi à réquisitionner les exchanges qui ont financé les investisseurs pour les identifier et les informer.`,
      },
      hints: [
        'Le contrat de prévente est dans l\'annonce Telegram : dépliez ses flux entrants (investisseurs) et sortants.',
        'Pour compter les investisseurs, regroupez les participations par adresse émettrice.',
        'Le développeur ne garde pas les fonds au même endroit : suivez chacun de ses portefeuilles, actif par actif.',
        'Le détail d\'une transaction bridgeIn ou bridgeOut mène directement à sa jumelle sur l\'autre chaîne, y compris pour le financement initial du développeur.',
      ],
    }
  },
}
