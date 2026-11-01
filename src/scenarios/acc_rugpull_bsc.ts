import { World, type Tx } from '../engine/world'
import { bridge, dex, exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset, usd } from '../engine/chains'
import { dusting, personalSpending } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, fakeCity, fakeHandle, fakeName, fmtDate, procedureFor } from './util'

const bnb = (v: number) => roundAsset('BNB', v)
const heure = (ts: number) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

export const accRugpullBsc: ScenarioTemplate = {
  id: 'rugpull-bsc',
  title: 'Rug pull sur BNB Smart Chain',
  tagline: 'Une prévente répétée en secret, des influenceurs payés, un développeur qui part avec la caisse.',
  description:
    'Le projet « Zephyrion ($ZPHR) » a levé des BNB et des USDT lors d\'une prévente. Le jour du lancement, le développeur a vidé le contrat, éparpillé les fonds sur plusieurs portefeuilles (dont des leurres de même montant), bridgé une partie vers Ethereum et envoyé le reste sur un exchange. Mesurez le préjudice, prouvez la préméditation, triez les branches et remontez au financement initial.',
  difficulty: 3,
  chains: ['bsc', 'eth'],
  skills: ['evm', 'tokens', 'defi', 'bridge', 'typologies', 'exchange_id'],
  estMinutes: 70,
  lessons: ['comptes-evm', 'tokens-erc20', 'dex-defi', 'bridges', 'typologies', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimName = fakeName(r)
    const devHandle = fakeHandle(r)
    // Pseudonymes tous distincts (développeur et influenceurs)
    const handles = new Set<string>([devHandle])
    const kols = Array.from({ length: r.int(3, 4) }, () => {
      let h = fakeHandle(r)
      while (handles.has(h)) h = fakeHandle(r)
      handles.add(h)
      return h
    })

    const br = bridge(w, 'arcbridge')
    const syrup = dex(w, 'pancakeswap', 'bsc')
    const uni = dex(w, 'uniswap', 'eth')
    const destKey = r.pick(['huobex', 'okx', 'binance'] as const)
    const dest = exchange(w, destKey, 'bsc')
    const onramps = [exchange(w, 'binance', 'bsc'), exchange(w, 'okx', 'bsc'), exchange(w, 'coinhouse', 'bsc')]

    const projectE = w.customEntity({ name: 'Zephyrion ($ZPHR)', category: 'scam' })
    const devE = w.customEntity({ name: `Développeur « ${devHandle} » (inconnu)`, category: 'suspect' })
    const dev = w.addr('bsc', { entity: devE })
    const presale = w.addr('bsc', { entity: projectE, contract: { name: 'ZPHR Presale', type: 'vault' } })
    const testPresale = w.addr('bsc', { entity: devE, contract: { name: 'ZPHR Presale (test)', type: 'vault' } })

    // ── Le portefeuille Ethereum du développeur : une vie avant le projet ────
    const devEth = w.addr('eth', { entity: devE })
    const fundKey = r.pick(['kraken', 'coinbase', 'bitstamp'] as const)
    const funder = exchange(w, fundKey, 'eth')
    const oldFund = funder.withdraw(devEth, roundAsset('ETH', r.float(0.4, 0.9)), w.at(-r.float(90, 140) * 24), 'ETH')
    uni.swap({ trader: devEth, assetIn: 'ETH', amountIn: roundAsset('ETH', r.float(0.05, 0.15)), assetOut: 'USDC', time: w.at(-r.float(60, 85) * 24) })
    // Ses achats d'avant le projet : un hébergeur web (le futur site ?) et un nom de domaine
    const hostE = w.customEntity({ name: r.pick(['Nébula Hosting', 'Hostavia']), category: 'merchant', known: true, description: 'Hébergeur web payable en crypto (fictif) ; conserve l\'adresse électronique du compte, les domaines hébergés et les IP de connexion.' })
    const domE = w.customEntity({ name: r.pick(['NomDomaine.io', 'Registrio']), category: 'merchant', known: true, description: 'Bureau d\'enregistrement de noms de domaine payable en crypto (fictif) ; conserve les coordonnées déclarées par le titulaire.' })
    const ethSpend = personalSpending(w, devEth, { start: w.at(-80 * 24), end: w.at(-30 * 24), n: r.int(3, 4), merchants: [hostE, domE], maxUsd: 150, asset: 'ETH' })
    const fundTx = funder.withdraw(devEth, roundAsset('ETH', r.float(1.4, 2.2)), w.at(-r.float(25, 30) * 24), 'ETH')
    // Le développeur se finance via le bridge depuis Ethereum, puis déploie la prévente
    const seedBr = br.send({ from: devEth, value: roundAsset('ETH', r.float(0.8, 1.2)), time: w.at(-r.float(22, 24) * 24), toChain: 'bsc', recipient: dev })

    // ── Répétition : un contrat de test vidé par la même fonction ────────────
    const tTest = w.at(-r.float(20.5, 21.5) * 24)
    const testDeploy = w.multi({ time: tTest, signer: dev, legs: [{ from: dev, to: testPresale, value: 0.005, asset: 'BNB' }], method: 'Contract Creation' })
    const testBuyV = bnb(r.pick([0.05, 0.1, 0.2]))
    w.multi({ time: tTest + r.int(10, 30) * 60, signer: dev, legs: [{ from: dev, to: testPresale, value: testBuyV, asset: 'BNB' }], method: 'buyTokens' })
    const testFail = w.multi({ time: tTest + r.int(40, 70) * 60, signer: dev, legs: [{ from: testPresale, to: dev, value: bnb(testBuyV + 0.005), asset: 'BNB' }], method: 'emergencyWithdraw', reverted: 'Presale: sale still active' })
    const testOk = w.multi({ time: tTest + r.int(90, 150) * 60, signer: dev, legs: [{ from: testPresale, to: dev, value: bnb(testBuyV + 0.005), asset: 'BNB' }], method: 'emergencyWithdraw' })

    const deploy = w.multi({ time: w.at(-r.float(18, 19) * 24), signer: dev, legs: [{ from: dev, to: presale, value: 0.01, asset: 'BNB' }], method: 'Contract Creation' })

    // Influenceurs rémunérés pour « promouvoir » la prévente
    const kolAddrs = kols.map(() => w.addr('bsc'))
    const kolPays: Tx[] = kolAddrs.map((a, i) => w.transfer({ time: w.at(-r.float(17, 12) * 24) + i * r.int(1, 8) * HOUR, from: dev, to: a, value: bnb(r.pick([0.3, 0.4, 0.5, 0.6])), asset: 'BNB' }))

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
      if (i === 0) {
        // Vie ordinaire du plaignant : achats réguliers et quelques échanges sur PancakeSwap
        for (let k = 0; k < r.int(4, 5); k++) ramp.withdraw(inv, bnb(r.float(0.2, 1.2)), w.at(-r.float(40, 200) * 24), 'BNB')
        for (let k = 0; k < 2; k++) syrup.swap({ trader: inv, assetIn: 'BNB', amountIn: bnb(r.float(0.05, 0.2)), assetOut: 'USDT', time: w.at(-r.float(25, 150) * 24) })
      }
      // Au plus 36 participations : le graphe affiche 40 transactions par dépliage.
      const times = r.chance(0.25) && nContrib + (nInv - i) + 1 <= 36 ? 2 : 1
      for (let k = 0; k < times; k++) {
        const t = w.at(-r.float(1, 16) * 24)
        // (la dernière participation se fait en USDT si personne n'en a encore versé : le portefeuille des USDT existe toujours)
        if (r.chance(0.6) && !(i === nInv - 1 && k === times - 1 && raisedUsdt === 0)) {
          const v = bnb(r.float(0.3, 8))
          ramp.withdraw(inv, bnb(v + r.float(0.01, 0.05)), t - r.int(1, 48) * HOUR, 'BNB')
          const tx = w.multi({ time: t, signer: inv, legs: [{ from: inv, to: presale, value: v, asset: 'BNB' }], method: 'buyTokens' })
          raisedBnb += v
          contribs.push(tx.id)
          if (i === 0 && !complainantTx) complainantTx = tx.hash
        } else {
          const v = Math.round(r.float(200, 5000) / 10) * 10
          ramp.withdraw(inv, bnb(r.float(0.01, 0.04)), t - r.int(2, 60) * HOUR, 'BNB')
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
    raisedBnb = bnb(raisedBnb)
    const raisedUsd = usd('BNB', raisedBnb) + raisedUsdt

    // Le rug : vidage du contrat le jour du lancement
    const rugT = w.at(r.float(0, 6))
    const rugBnb = bnb(raisedBnb + 0.01)
    const rug = w.multi({
      time: rugT, signer: dev, method: 'emergencyWithdraw',
      legs: [{ from: presale, to: dev, value: rugBnb, asset: 'BNB' }, ...(raisedUsdt > 0 ? [{ from: presale, to: dev, value: raisedUsdt, asset: 'USDT' as const }] : [])],
    })

    // Éclatement : trois portefeuilles de sortie, un jumeau et une branche ré-éclatée
    const w1 = w.addr('bsc', { entity: devE })
    const w2 = w.addr('bsc', { entity: devE })
    const w3 = w.addr('bsc', { entity: devE })
    const wT = w.addr('bsc', { entity: devE }) // jumeau de w1 : dort
    const wD = w.addr('bsc', { entity: devE }) // branche ré-éclatée
    const bnbAll = w.balanceOf(dev, 'BNB')
    const toW1 = bnb(bnbAll * r.float(0.24, 0.28))
    const toWT = bnb(toW1 * (1 + r.pick([-1, 1]) * r.float(0.001, 0.004)))
    const toW3 = bnb(bnbAll * r.float(0.22, 0.26))
    const toWD = bnb(bnbAll * r.float(0.05, 0.08))
    const tS1 = rugT + r.int(8, 30) * 60
    const s1 = w.transfer({ time: tS1, from: dev, to: w1, value: toW1, asset: 'BNB' })
    const sT = w.transfer({ time: Math.max(rugT + r.int(2, 6) * 60, tS1 + r.pick([-1, 1]) * r.int(3, 18) * 60), from: dev, to: wT, value: toWT, asset: 'BNB' })
    const s3 = w.transfer({ time: rugT + r.int(35, 60) * 60, from: dev, to: w3, value: toW3, asset: 'BNB' })
    const sD = w.transfer({ time: rugT + r.int(61, 80) * 60, from: dev, to: wD, value: toWD, asset: 'BNB' })
    const splits = [s1.id, s3.id]
    // W2 reçoit les USDT (et du BNB pour le gas)
    splits.push(w.transfer({ time: rugT + r.int(81, 100) * 60, from: dev, to: w2, value: bnb(0.02), asset: 'BNB' }).id)
    let usdtToExchange = 0
    const exitTxs: string[] = []
    if (raisedUsdt > 0) {
      splits.push(w.transfer({ time: rugT + r.int(101, 120) * 60, from: dev, to: w2, value: raisedUsdt, asset: 'USDT' }).id)
      const d2 = dest.receive(w2, raisedUsdt, rugT + r.float(4, 10) * HOUR, { asset: 'USDT' })
      usdtToExchange += raisedUsdt
      exitTxs.push(d2.tx.id)
    }
    // wD : ré-éclaté le lendemain sur trois à quatre adresses qui dorment
    const wdSubs = Array.from({ length: r.int(3, 4) }, () => w.addr('bsc', { entity: devE }))
    const wdSubTxs = wdSubs.map((a, i) => w.transfer({ time: sD.time + Math.round(r.float(18, 30) * HOUR) + i * r.int(4, 20) * 60, from: wD, to: a, value: bnb((toWD / wdSubs.length) * 0.98), asset: 'BNB' }))

    // W1 : bridge vers Ethereum
    const ethDest = w.addr('eth', { entity: devE })
    const brOut = br.send({ from: w1, value: bnb(toW1 * 0.995), time: rugT + r.float(1.5, 4) * HOUR, toChain: 'eth', recipient: ethDest })

    // W3 : swap BNB → USDT sur PancakeSwap puis exchange
    const sw = syrup.swap({ trader: w3, assetIn: 'BNB', amountIn: bnb(toW3 * 0.99), assetOut: 'USDT', time: rugT + r.float(3, 8) * HOUR })
    const d3 = dest.receive(w3, sw.amountOut, rugT + r.float(9, 20) * HOUR, { asset: 'USDT' })
    usdtToExchange += sw.amountOut
    exitTxs.push(d3.tx.id)

    // Empoisonnement d'adresse et poussière sur les portefeuilles du développeur
    // (après le vidage : un robot d'empoisonnement réagit aux gros mouvements)
    dusting(w, dev, { time: rugT + 10 * HOUR, n: r.int(2, 3), spreadH: 30, min: rugT + 30 * 60 })
    dusting(w, devEth, { time: fundTx.time + 2 * DAY, n: 2, spreadH: 24 })

    // Bruit
    syrup.noise(30, w.at(-3 * 24), w.at(3 * 24), [['BNB', 'USDT'], ['BNB', 'USDC']])
    dest.noise(16, w.at(-3 * 24), w.at(4 * 24), 'USDT')
    for (const o of onramps) o.noise(9, w.at(-16 * 24), w.at(2 * 24), 'BNB')
    funder.noise(14, w.at(-40 * 24), w.at(-15 * 24), 'ETH')
    for (let i = 0; i < r.int(5, 8); i++) {
      const u = w.addr('bsc')
      const tb = w.at(r.float(-3, 4) * 24)
      const v = bnb(r.float(0.5, 40))
      w.fundAccount(u, bnb(v * 1.01), 'BNB', tb - r.float(0.2, 2) * DAY)
      br.send({ from: u, value: v, time: tb, toChain: 'eth', recipient: w.addr('eth') })
    }
    // Les influenceurs reçoivent aussi d'autres projets
    for (const a of kolAddrs) {
      for (let k = 0; k < r.int(1, 3); k++) {
        const p = w.addr('bsc')
        const t = w.at(-r.float(5, 60) * 24)
        const v = bnb(r.pick([0.2, 0.3, 0.5, 0.8]))
        w.fundAccount(p, bnb(v + 0.05), 'BNB', t - r.int(2, 30) * HOUR)
        w.transfer({ time: t, from: p, to: a, value: v, asset: 'BNB' })
      }
    }

    const destName = dest.entity.name
    const funderName = funder.entity.name
    // BNB laissés sur l'adresse du développeur après l'éclatement
    const devLeft = bnb(w.balanceOf(dev, 'BNB'))
    const usdtOut = roundAsset('USDT', usdtToExchange)
    const firstExit = Math.min(...exitTxs.map((id) => w.tx(id).time))
    const exitH = Math.round(((firstExit - rugT) / 3600) * 10) / 10
    const testDaysBefore = Math.round((deploy.time - testOk.time) / DAY * 10) / 10
    const kolTotal = bnb(kolPays.reduce((s, t) => s + t.transfers[0].value, 0))
    const twinRows = [{ to: w1, tx: s1 }, { to: wT, tx: sT }].sort((a, b) => a.tx.time - b.tx.time)
    const wdWhen = `à partir du ${fmtDate(wdSubTxs[0].time)}`
    const ethShops = [...new Set(ethSpend.addresses.map((a) => w.get(a).entityId).filter((x): x is string => !!x))].map((id) => w.entities.get(id)!.name)
    const ethPeople = ethSpend.addresses.filter((a) => !w.get(a).entityId).length
    const ethPaid = [...ethShops, ...(ethPeople ? [ethPeople > 1 ? 'des particuliers' : 'un particulier'] : [])].join(' et ')

    return {
      world: w,
      title: `Rug pull Zephyrion — ${city}`,
      briefing:
        `${victimName} (${city}) a participé à la prévente du jeton « Zephyrion ($ZPHR) », promu sur Telegram et par des influenceurs comme « le prochain x100 de BNB Chain ». Les investisseurs envoyaient des BNB ou des USDT au contrat de prévente en échange de jetons à recevoir au lancement.\n\n` +
        `Le jour du lancement, le site et le canal Telegram ont disparu. Plusieurs autres investisseurs se sont manifestés. Le développeur, joint par un investisseur avant la disparition du canal, a parlé d'un « piratage du contrat ».\n\n` +
        `Objectifs : identifier le portefeuille du développeur, mesurer l'ampleur de la levée (nombre d'investisseurs, total en USD), établir si le vidage était prémédité, trier les portefeuilles de sortie parmi ceux que le développeur a alimentés, suivre les fonds jusqu'au bridge et à l'exchange, chiffrer ce qui peut encore être gelé et remonter au financement initial du développeur.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(3 * 24), author: victimName,
          body:
            `« J'ai participé à la prévente depuis mon portefeuille : ${A(w, complainant)}.\n` +
            `Transaction de participation : ${complainantTx}\n` +
            `On devait recevoir les jetons au lancement, le ${fmtDate(rugT, false)}. Rien n'est arrivé. Sur Telegram, @${devHandle} a d'abord parlé d'un piratage, puis le canal a été supprimé. »`,
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
          id: 'osint', type: 'osint', title: 'Note OSINT : la promotion de Zephyrion', date: w.at(4 * 24), author: 'Cellule cyber',
          body:
            `${kols.length} comptes d'influenceurs crypto ont publié des vidéos sur Zephyrion pendant la prévente, toutes présentées comme « non sponsorisées » : ${kols.map((k, i) => `@${k} (adresse de pourboire affichée en bio : ${A(w, kolAddrs[i])})`).join(' ; ')}.\n` +
            `Le développeur se présentait sous le pseudonyme @${devHandle} ; l'« équipe doxxée » du site utilise des photos de banques d'images.`,
        },
        {
          id: 'note', type: 'note', title: 'Demande du magistrat', date: w.at(4 * 24), author: 'Parquet — pôle cybercriminalité',
          body:
            `Avant d'adresser les réquisitions, merci de préciser :\n` +
            `— la liste des portefeuilles du développeur par lesquels les fonds ont quitté BSC ou rejoint une plateforme ;\n` +
            `— tout élément contredisant la thèse du « piratage » avancée par le développeur ;\n` +
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
          explanation: `${A(w, dev)} a déployé le contrat de prévente puis appelé « emergencyWithdraw » le ${fmtDate(rugT)}, récupérant ${amt(rugBnb, 'BNB')}${raisedUsdt > 0 ? ` et ${amt(raisedUsdt, 'USDT')}` : ''}. Cette adresse a une histoire : financée par bridge depuis Ethereum, elle a payé des influenceurs pendant la prévente et reçoit après les faits des micro-envois d'adresses sosies (empoisonnement), sans rôle dans l'affaire.`,
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
          explanation: `${amt(raisedBnb, 'BNB')} (≈ ${Math.round(usd('BNB', raisedBnb)).toLocaleString('fr-FR')} $) + ${amt(raisedUsdt, 'USDT')} = ${Math.round(raisedUsd).toLocaleString('fr-FR')} $. Seuls les flux entrants des investisseurs comptent (pas le versement de déploiement du développeur) : ce total, établi on-chain, fonde l'évaluation du préjudice global.`,
        },
        {
          id: 'o14', type: 'tx', points: 11,
          prompt: 'Quelle transaction montre que le développeur avait répété le vidage avant même de déployer la prévente ?',
          answer: [testOk.id, testFail.id],
          hint: 'Remontez l\'historique de l\'adresse du développeur avant le déploiement : un autre contrat, une petite mise, et la même fonction que le jour du lancement.',
          explanation: `Le ${fmtDate(testDeploy.time)}, le développeur déploie un premier contrat (${A(w, testPresale)}), y verse ${amt(testBuyV, 'BNB')}, tente « emergencyWithdraw » (échec : « Presale: sale still active »), puis réussit le même appel ${Math.round((testOk.time - testFail.time) / 60)} minutes plus tard, ${testDaysBefore.toLocaleString('fr-FR')} jours avant le déploiement de la vraie prévente. Une fonction de retrait réservée au propriétaire, testée à l'avance : la promesse « liquidité verrouillée 12 mois » était fausse dès l'origine, et la thèse du « piratage » ne tient pas (seul le propriétaire peut appeler cette fonction, et c'est son adresse qui l'appelle).`,
        },
        {
          id: 'o6', type: 'addresses', points: 11,
          prompt: 'Sélectionnez les portefeuilles BSC du développeur par lesquels les fonds rejoignent le bridge ou l\'exchange.',
          answer: [w1, w2, w3],
          hint: 'Dépliez toutes les sorties de l\'adresse du développeur après « emergencyWithdraw », puis ouvrez chaque destinataire : ne gardez que ceux qui envoient vers le bridge ou vers une adresse de dépôt.',
          explanation: `Le développeur alimente cinq portefeuilles neufs. Trois servent à la sortie : ${A(w, w1)} (${amt(toW1, 'BNB')}, bridge vers Ethereum), ${A(w, w3)} (${amt(toW3, 'BNB')}, swap puis exchange) et ${A(w, w2)} (${raisedUsdt > 0 ? 'les USDT de la prévente et ' : ''}un peu de BNB pour le gas). Les deux autres sont des branches sans issue : ${A(w, wT).slice(0, 12)}… (${amt(toWT, 'BNB')}) ne bouge plus, ${A(w, wD).slice(0, 12)}… (${amt(toWD, 'BNB')}) se ré-éclate ${wdWhen} sur ${wdSubs.length} adresses qui dorment. Chaque transfert part de la même adresse : le rattachement au développeur est direct.`,
        },
        {
          id: 'o13', type: 'tx', points: 11,
          prompt: `Peu après le vidage, deux transferts d'environ ${amt(toW1, 'BNB')} quittent l'adresse du développeur à quelques minutes d'intervalle. Lequel alimente le bridge ?`,
          answer: [s1.id],
          hint: 'Les montants ne départagent pas : ouvrez les deux destinataires et regardez ce qu\'ils font ensuite.',
          explanation: `${twinRows.map((x) => `${heure(x.tx.time)} → ${A(w, x.to).slice(0, 12)}… (${amt(x.tx.transfers[0].value, 'BNB')})`).join(' ; ')}. ${A(w, w1).slice(0, 12)}… envoie ${amt(bnb(toW1 * 0.995), 'BNB')} dans ArcBridge le ${fmtDate(brOut.outTx.time)} ; ${A(w, wT).slice(0, 12)}… n'a plus aucune sortie : ses ${amt(toWT, 'BNB')} sont une réserve, à placer sous surveillance (le BNB natif n'est gelable par personne). Deux montants quasi identiques au même moment ne disent rien ; seul le comportement ultérieur désigne la continuation.`,
        },
        {
          id: 'o5', type: 'address', points: 10,
          prompt: 'Quelle adresse Ethereum a reçu les fonds bridgés depuis BNB Smart Chain ?',
          answer: [ethDest],
          hint: 'La transaction bridgeOut indique la transaction correspondante sur Ethereum et son destinataire.',
          explanation: `${A(w, w1)} envoie ${amt(bnb(toW1 * 0.995), 'BNB')} dans ArcBridge ; ${amt(brOut.received, 'ETH')} sont versés à ${A(w, ethDest)} sur Ethereum. Ce n'est pas le portefeuille Ethereum qui avait financé le développeur : une adresse neuve, sans historique.`,
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
          explanation: `Vidage le ${fmtDate(rugT)}, premier dépôt le ${fmtDate(firstExit)} : environ ${exitH.toFixed(1).replace('.', ',')} h. Une sortie aussi rapide, préparée à l'avance (portefeuilles créés, leurres, bridge et swap enchaînés), contredit toute thèse de « piratage » ou de « problème technique ».`,
        },
        {
          id: 'o9', type: 'amount', points: 8, unit: 'BNB', tolerance: 0.02,
          prompt: 'Quel solde de BNB est resté sur l\'adresse du développeur après l\'éclatement ?',
          answer: devLeft,
          hint: 'Lisez le solde BNB actuel de l\'adresse du développeur (ou faites le bilan : bridge, test, emergencyWithdraw en entrée ; déploiements, influenceurs, cinq portefeuilles en sortie).',
          explanation: `L'adresse ${A(w, dev)} conserve ${amt(devLeft, 'BNB')} (≈ ${Math.round(usd('BNB', devLeft)).toLocaleString('fr-FR')} $). Avec la réserve jumelle (${amt(toWT, 'BNB')}) et les adresses de la branche ré-éclatée, ces fonds sont sous le seul contrôle du développeur : aucun tiers ne peut geler du BNB natif, mais ils deviendraient saisissables si ses clés étaient retrouvées lors d'une perquisition.`,
        },
        {
          id: 'o10', type: 'address', points: 9,
          prompt: 'Le développeur s\'était financé depuis Ethereum avant de déployer la prévente. Quelle adresse Ethereum a envoyé ces fonds dans le bridge ?',
          answer: [devEth],
          hint: 'Remontez les premiers fonds reçus par l\'adresse du développeur sur BSC : une transaction bridgeIn renvoie à sa jumelle sur Ethereum.',
          explanation: `Le ${fmtDate(seedBr.outTx.time)}, ${A(w, devEth)} envoie ${amt(seedBr.outTx.transfers[0].value, 'ETH')} dans ArcBridge ; la transaction bridgeIn verse ${amt(seedBr.received, 'BNB')} à l'adresse du développeur sur BSC, quelques jours avant le test et le déploiement. Contrairement aux portefeuilles de sortie, cette adresse a un passé (retraits d'exchange depuis le ${fmtDate(oldFund.time, false)}, swap, paiements à ${ethPaid}${ethShops.length ? `, des prestataires qui conservent l'adresse électronique de leurs clients` : ''}) : c'est un portefeuille personnel, la phase de préparation étant souvent moins prudente que la sortie.`,
        },
        {
          id: 'o12', type: 'entity', points: 9,
          prompt: 'Quelle plateforme a fourni les ETH de cette adresse Ethereum ?',
          answer: [fundKey],
          hint: 'Regardez les transactions entrantes de l\'adresse Ethereum du développeur.',
          explanation: `Le ${fmtDate(oldFund.time)} puis le ${fmtDate(fundTx.time)}, l'adresse Ethereum du développeur reçoit ${amt(oldFund.transfers[0].value, 'ETH')} et ${amt(fundTx.transfers[0].value, 'ETH')} d'un portefeuille chaud ${funderName} : ce sont des retraits depuis un compte client. La réquisition à ${funderName} sur ces retraits (identité, IP, moyens de paiement) peut identifier le développeur, indépendamment de la sortie des fonds. ${procedureFor(funder.entity)}`,
        },
      ],
      truth: {
        path: [fundTx.id, seedBr.outTx.id, seedBr.inTx.id, testDeploy.id, testOk.id, deploy.id, ...contribs, rug.id, ...splits, brOut.outTx.id, brOut.inTx.id, sw.tx.id, ...exitTxs],
        addresses: [dev, presale, w1, w2, w3, ethDest, devEth],
        debrief:
          `1. Le développeur se finance par des retraits ${funderName} vers ${A(w, devEth)} (Ethereum), passe par ArcBridge vers ${A(w, dev)} (BSC).\n` +
          `2. Répétition : le ${fmtDate(testDeploy.time, false)}, il déploie un contrat de test, y verse ${amt(testBuyV, 'BNB')} et le vide par « emergencyWithdraw » (un premier essai échoue). Il déploie ensuite la vraie prévente ${A(w, presale)} et paie ${kols.length} influenceurs (${amt(kolTotal, 'BNB')}), qui présentent leurs vidéos comme « non sponsorisées ».\n` +
          `3. ${nInv} investisseurs y versent ${amt(raisedBnb, 'BNB')} et ${amt(raisedUsdt, 'USDT')} en ${nContrib} participations, soit ≈ ${Math.round(raisedUsd).toLocaleString('fr-FR')} $.\n` +
          `4. Le jour du lancement, « emergencyWithdraw » renvoie tout au développeur, qui alimente cinq portefeuilles : trois de sortie, un jumeau de même montant qui dort (${amt(toWT, 'BNB')}), une branche ré-éclatée sur ${wdSubs.length} adresses. Il garde ${amt(devLeft, 'BNB')}.\n` +
          `5. ${A(w, w1)} bridge ses BNB vers Ethereum (${amt(brOut.received, 'ETH')} pour ${A(w, ethDest)}) ; ${A(w, w3)} convertit ses BNB en USDT sur PancakeSwap ; ${amt(usdtOut, 'USDT')} finissent sur ${destName}, le premier dépôt environ ${exitH.toFixed(1).replace('.', ',')} h après le vidage.\n\n` +
          `À retenir : dans un rug pull, le contrat (prévente, pool de liquidité) centralise la preuve du préjudice : chaque transaction entrante est une victime. La fonction de retrait réservée au propriétaire (« emergencyWithdraw », « removeLiquidity ») désigne le développeur, et son historique peut montrer qu'il l'a répétée à l'avance. Les promesses (« liquidité verrouillée », « équipe doxxée ») se vérifient on-chain. Face à des transferts de même montant, seul le devenir de chaque destinataire tranche. Deux réquisitions se complètent : ${destName} (sortie, gel) et ${funderName} (financement initial). Penser aussi aux exchanges qui ont financé les investisseurs, pour les identifier et les informer, et aux influenceurs payés par le développeur, témoins utiles (ou complices selon ce qu'ils savaient).`,
      },
      hints: [
        'Le contrat de prévente est dans l\'annonce Telegram : dépliez ses flux entrants (investisseurs) et sortants.',
        'Pour compter les investisseurs, regroupez les participations par adresse émettrice.',
        'L\'historique de l\'adresse du développeur commence avant la prévente : regardez quels contrats elle a créés et quelles fonctions elle a appelées.',
        'Après le vidage, ouvrez chaque portefeuille alimenté par le développeur : certains mènent quelque part, d\'autres non. Les montants voisins ne prouvent rien.',
        'Le détail d\'une transaction bridgeIn ou bridgeOut mène directement à sa jumelle sur l\'autre chaîne, y compris pour le financement initial du développeur.',
      ],
    }
  },
}
