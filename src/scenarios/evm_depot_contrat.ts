import { World } from '../engine/world'
import { exchange, DAY, HOUR } from '../engine/patterns'
import { forwarderExchange } from '../engine/defi'
import { decoyBranches, dusting } from '../engine/realism'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeName, fakePerson, fmtDate, procedureFor } from './util'

/** Arrondi à la centaine inférieure (montants « ronds » choisis par l'escroc). */
const floor100 = (v: number) => Math.floor(v / 100) * 100

const BRANDS = ['Nexora Capital', 'Valmont Patrimoine', 'Orféa Invest', 'Altiplan Gestion', 'Sylvane Finance', 'Calvéa Asset', 'Hermine Wealth']

export const evmDepotContrat: ScenarioTemplate = {
  id: 'depot-contrat',
  title: 'Le contrat de dépôt',
  tagline: 'L\'adresse de dépôt de l\'escroc est un contrat : l\'ETH repart aussitôt en transaction interne, les USDT attendent le reversement. Et le gas vient d\'un portefeuille qui alimente toute une filière.',
  description:
    'Une victime a versé des USDT puis de l\'ETH à un faux conseiller en placement. L\'escroc a déposé l\'essentiel sur un exchange dont les adresses de dépôt sont des contrats « forwarders » déployés par CREATE2, payé ses télévendeurs et reçu au passage des micro-transferts d\'empoisonnement. Triez les flux de son adresse, distinguez le contrat de dépôt du hot wallet, de la fabrique et du portefeuille opérationnel, lisez la transaction interne et les reversements, remontez au portefeuille qui fournit le gas à la filière, puis préparez une réquisition qui vise la bonne adresse.',
  difficulty: 2,
  chains: ['eth'],
  skills: ['evm', 'tokens', 'exchange_id', 'requisition', 'typologies', 'poisoning', 'gel'],
  estMinutes: 45,
  lessons: ['contrats-depot-create2', 'transactions-internes', 'address-poisoning', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victim = fakePerson(r)
    const g = victim.g
    const lp = { la: g('le plaignant', 'la plaignante'), de: g('du plaignant', 'de la plaignante'), a: g('au plaignant', 'à la plaignante'), comprise: g('plaignant compris', 'plaignante comprise') }
    const city = fakeCity(r)
    const [brand, ...otherBrands] = r.shuffle([...BRANDS])
    const advisor = r.pick(['Thomas', 'Alexandre', 'Julia', 'Sarah', 'Maxime', 'Laura'])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const exKey = r.pick(['kraken', 'coinbase', 'bitstamp', 'okx'] as const)
    const fx = forwarderExchange(w, exKey, 'eth')
    const ch = exchange(w, 'coinhouse', 'eth')
    const other = exchange(w, exKey === 'kraken' ? 'binance' : 'kraken', 'eth')
    const cnow = w.entity('changenow')
    const cnowHot = w.addr('eth', { entity: cnow, label: 'ChangeNOW — Hot Wallet ETH', tags: ['liquid', 'hot'] })

    const scamE = w.customEntity({ name: `${brand} (faux placement)`, category: 'scam' })
    const netE = w.customEntity({ name: 'Filière de faux placements (inconnue)', category: 'suspect' })
    const S = w.addr('eth', { entity: scamE })
    const O = w.addr('eth', { entity: netE })
    const victimE = w.customEntity({ name: victim.name, category: 'victim' })
    const V = w.addr('eth', { entity: victimE })

    // ── Avant les faits : le portefeuille de gas de la filière ───────────────
    // Alimenté par des paiements ChangeNOW (échangeur sans compte), il fournit
    // l'ETH de gas à plusieurs adresses de collecte, dont celle de l'escroc.
    const nIn = r.int(3, 4)
    for (let i = 0; i < nIn; i++) {
      w.transfer({ time: w.at(-(i === 0 ? r.float(29, 34) : r.float(3, 22)) * 24), from: cnowHot, to: O, value: roundAsset('ETH', r.float(0.35, 0.9)), asset: 'ETH', method: 'payout' })
    }
    const g0 = roundAsset('ETH', r.float(0.06, 0.16))
    const gasTx = w.transfer({ time: w.at(-r.float(12, 20) * 24), from: O, to: S, value: g0, asset: 'ETH' })
    // Autres adresses de collecte de la filière (autres marques)
    const sisters = otherBrands.slice(0, r.int(2, 3)).map((b) => {
      const a = w.addr('eth', { entity: w.customEntity({ name: `${b} (faux placement présumé)`, category: 'scam' }) })
      w.transfer({ time: w.at(-r.float(2, 26) * 24), from: O, to: a, value: roundAsset('ETH', r.float(0.05, 0.15)), asset: 'ETH' })
      // Des particuliers y versent des USDT juste après un retrait d'exchange
      for (let j = 0; j < r.int(1, 3); j++) {
        const p = w.addr('eth')
        const v = roundAsset('USDT', Math.round(r.float(10, 80)) * 100)
        const t = w.at(r.float(-1, 9) * 24)
        other.withdraw(p, roundAsset('USDT', v + r.int(10, 150)), t - r.int(2, 30) * HOUR, 'USDT')
        w.transfer({ time: t, from: p, to: a, value: v, asset: 'USDT' })
      }
      return { addr: a, brand: b }
    })
    // Dépense courante du portefeuille de gas : les lignes téléphoniques virtuelles des télévendeurs
    const voipE = w.customEntity({ name: 'NumeriCall (numéros virtuels et VoIP)', category: 'merchant', known: true, description: 'Fournisseur (fictif) de numéros de téléphone virtuels et de standards VoIP, payable en cryptomonnaies. Prisé des centres d\'appels frauduleux : il conserve l\'e-mail du compte, les numéros attribués et les adresses IP de connexion.' })
    const giftCard = w.addr('eth', { entity: voipE, label: 'NumeriCall — Paiement' })
    w.transfer({ time: w.at(-r.float(1, 10) * 24), from: O, to: giftCard, value: roundAsset('ETH', r.float(0.03, 0.12)), asset: 'ETH' })
    ch.withdraw(V, roundAsset('ETH', r.float(0.03, 0.08)), w.at(-r.float(10, 25) * 24))

    // Autres victimes, avant la plaignante
    const othersBefore: { addr: string; value: number; tx: string; time: number }[] = []
    const otherName = fakeName(r)
    const otherCity = fakeCity(r)
    const nBefore = r.int(2, 3)
    for (let i = 0; i < nBefore; i++) {
      const o = w.addr('eth', { entity: w.customEntity({ name: i === 0 ? otherName : 'Victime non identifiée', category: 'victim' }) })
      const v = roundAsset('USDT', Math.round(r.float(15, 90)) * 100)
      const t = w.at(-r.float(1.5, 7) * 24)
      other.withdraw(o, roundAsset('USDT', v + r.int(10, 200)), t - r.int(2, 30) * HOUR, 'USDT')
      const tx = w.transfer({ time: t, from: o, to: S, value: v, asset: 'USDT' })
      othersBefore.push({ addr: o, value: v, tx: tx.hash, time: t })
    }

    // ── Les versements de la victime et les dépôts de l'escroc ────────────────
    const u1 = roundAsset('USDT', Math.round(r.float(6, 14)) * 1000)
    const u2 = roundAsset('USDT', Math.round(r.float(15, 45)) * 100)
    const e1 = roundAsset('ETH', r.float(1.2, 3.5))
    ch.withdraw(V, roundAsset('USDT', u1 + r.int(20, 300)), w.at(-r.float(1, 3) * 24), 'USDT')
    const p1 = w.transfer({ time: w.at(0), from: V, to: S, value: u1, asset: 'USDT' })

    // Première tranche d'USDT : l'adresse de dépôt n'est pas encore déployée.
    const dA = floor100(w.balanceOf(S, 'USDT'))
    const depA = fx.receive(S, dA, w.at(r.float(16, 26)), { asset: 'USDT', flushDelayH: r.float(1, 7) })
    const deposit = depA.deposit
    const flushA = depA.flush!
    // Second apport de gas du même portefeuille
    const g1 = roundAsset('ETH', r.float(0.03, 0.07))
    const gasTx2 = w.transfer({ time: w.at(r.float(38, 50)), from: O, to: S, value: g1, asset: 'ETH' })

    ch.withdraw(V, roundAsset('USDT', u2 + r.int(5, 60)), w.at(r.float(55, 60)), 'USDT')
    const p2 = w.transfer({ time: w.at(r.float(61, 66)), from: V, to: S, value: u2, asset: 'USDT' })

    // Une victime de plus entre-temps
    const late = w.addr('eth', { entity: w.customEntity({ name: 'Victime non identifiée', category: 'victim' }) })
    const lateV = roundAsset('USDT', Math.round(r.float(10, 60)) * 100)
    other.withdraw(late, roundAsset('USDT', lateV + r.int(10, 90)), w.at(r.float(70, 76)), 'USDT')
    const lateTx = w.transfer({ time: w.at(r.float(80, 86)), from: late, to: S, value: lateV, asset: 'USDT' })

    ch.withdraw(V, roundAsset('ETH', e1 + r.float(0.005, 0.03)), w.at(r.float(88, 92)))
    const p3 = w.transfer({ time: w.at(r.float(94, 98)), from: V, to: S, value: e1, asset: 'ETH' })

    // ETH vers le contrat de dépôt (déjà déployé) : reversé au hot wallet dans la même transaction.
    const eDep = roundAsset('ETH', e1 + g0 * r.float(0.4, 0.7))
    const ethDep = fx.receive(S, eDep, w.at(r.float(99, 104)), { depositAddr: deposit })

    // Seconde tranche d'USDT : le contrat existe, le reversement appelle flushTokens.
    const dB = floor100(w.balanceOf(S, 'USDT') * r.float(0.5, 0.7))
    const depB = fx.receive(S, dB, w.at(r.float(110, 120)), { asset: 'USDT', depositAddr: deposit, flushDelayH: r.float(1, 9) })
    const flushB = depB.flush!
    const totalDeposited = roundAsset('USDT', dA + dB)

    // ── Habillage de l'adresse de l'escroc (après le flux réel) ─────────────
    // Commissions des télévendeurs : des USDT partent vers des adresses neuves, sans issue
    const comms = decoyBranches(w, S, { time: w.at(r.float(124, 140)), share: r.float(0.45, 0.65), branches: r.int(2, 3), entity: netE, asset: 'USDT' })
    // Empoisonnement d'adresse : des sosies envoient des micro-montants d'USDT
    const dust = dusting(w, S, { time: w.at(r.float(30, 90)), n: r.int(3, 4), spreadH: 60, token: 'USDT' })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    fx.noise(26, w.at(-6 * 24), w.at(8 * 24), 'USDT')
    fx.noise(18, w.at(-6 * 24), w.at(8 * 24), 'ETH')
    fx.noise(8, w.at(-6 * 24), w.at(8 * 24), 'USDC')
    ch.noise(10, w.at(-5 * 24), w.at(6 * 24), 'USDT')
    other.noise(10, w.at(-8 * 24), w.at(6 * 24), 'USDT')
    for (let i = 0; i < r.int(5, 8); i++) w.transfer({ time: w.at(r.float(-25, 10) * 24), from: cnowHot, to: w.addr('eth'), value: roundAsset('ETH', r.float(0.05, 3)), asset: 'ETH', method: 'payout' })

    // ── Réponses (monde final) ───────────────────────────────────────────────
    const usdtSenders = new Map<string, number>()
    for (const t of w.txsOf(S)) for (const f of t.transfers) if (f.to === S && f.asset === 'USDT') usdtSenders.set(f.from, (usdtSenders.get(f.from) ?? 0) + f.value)
    const nVictims = [...usdtSenders.values()].filter((v) => v >= 50).length
    const nDust = dust.txs.length
    const leftUsdt = roundAsset('USDT', w.balanceOf(S, 'USDT'))
    const commTotal = roundAsset('USDT', comms.reduce((s, b) => s + b.value, 0))
    const exName = fx.entity.name
    const ob = othersBefore[0]
    const wrongs = [
      `Le hot wallet ${exName} (${A(w, fx.hot).slice(0, 10)}…), qui reçoit les fonds de tous les clients`,
      `La fabrique de contrats (${A(w, fx.factory).slice(0, 10)}…), appelée lors du premier reversement`,
      `Le portefeuille opérationnel (${A(w, fx.operator).slice(0, 10)}…), qui signe les reversements`,
    ]
    const nOthers = nVictims - 2
    const othersTxt = nOthers === 0 ? '' : nOthers === 1 ? ' et une autre personne non identifiée' : ` et ${nOthers} autres personnes non identifiées`
    const fateTxt =(f: string) => (f === 'dort' ? 'jamais dépensés' : f === 'dépensée' ? 'dépensés en petits achats' : f === 'retour' ? 'renvoyés' : 'ré-éclatés en petits montants')

    return {
      world: w,
      title: `Faux placement « ${brand} » — ${city}`,
      briefing:
        `${victim.name}, ${g('domicilié', 'domiciliée')} à ${city}, a été ${g('contacté', 'contactée')} par un « conseiller » ${de(brand)} qui lui promettait un rendement de 4 % par mois. ${g('Il', 'Elle')} a acheté des USDT et de l'ETH sur Coinhouse et les a envoyés, en trois fois, à l'adresse indiquée par son interlocuteur. Le compte de « trading » affichait des gains ; aucun retrait n'a jamais été possible.\n\n` +
        `L'escroc a déposé l'essentiel des fonds sur un exchange dont les adresses de dépôt sont des contrats « forwarders » : chaque client reçoit une adresse calculée d'avance (CREATE2). L'ETH envoyé à ce contrat repart aussitôt vers le hot wallet, en transaction interne ; les jetons y restent jusqu'à ce que la plateforme déclenche leur reversement.\n\n` +
        `L'adresse de l'escroc n'est pas propre : versements d'autres victimes, commissions sortantes, micro-transferts d'adresses sosies. Triez avant de compter.\n\n` +
        `Objectifs : identifier l'adresse de l'escroc et l'ampleur de la collecte, isoler le contrat de dépôt (ni le hot wallet, ni la fabrique, ni le portefeuille opérationnel), lire le reversement des USDT et la transaction interne de l'ETH, remonter au portefeuille qui fournit le gas, puis chiffrer ce qui a été crédité au compte client et ce qui reste gelable.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(9 * 24), author: victim.name,
          body:
            `« Le conseiller, ${advisor}, m'appelait presque tous les jours. Il m'a fait ouvrir un compte chez Coinhouse pour acheter des cryptomonnaies, puis il m'a donné l'adresse de mon "compte de trading sécurisé". J'ai fait trois envois depuis mon portefeuille :\n\n` +
            `— le ${fmtDate(p1.time)} : ${amt(u1, 'USDT')}, transaction ${p1.hash} ;\n` +
            `— le ${fmtDate(p2.time)} : ${amt(u2, 'USDT')} de "frais de déblocage", transaction ${p2.hash} ;\n` +
            `— le ${fmtDate(p3.time)} : ${amt(e1, 'ETH')} pour une "taxe de sortie" qu'il fallait payer en ETH, transaction ${p3.hash}.\n\n` +
            `Mon adresse : ${A(w, V)}. Depuis, plus personne ne répond. »`,
        },
        {
          id: 'chat', type: 'capture', title: 'Captures de la messagerie avec le « conseiller »', date: w.at(60), author: `${advisor} — ${brand}`,
          body:
            `[${advisor}] Votre compte est créé. Pour l'alimenter, envoyez vos USDT (réseau Ethereum, ERC-20 uniquement) à l'adresse de votre portefeuille de trading :\n${A(w, S)}\n\n` +
            `[${advisor}] Attention : copiez toujours l'adresse depuis ce message, jamais depuis votre historique. Des fraudeurs imitent nos adresses.\n` +
            `[${advisor}] Félicitations, votre portefeuille affiche +18 % ce mois-ci 📈\n` +
            `[${advisor}] Pour débloquer le retrait, notre service conformité exige ${amt(u2, 'USDT')} de frais, puis une taxe de sortie réglée en ETH (pas en USDT, c'est la règle de la blockchain).\n` +
            `[${advisor}] Une fois la taxe payée, les fonds sont sur votre compte sous 24 h.`,
        },
        {
          id: 'pharos', type: 'email', title: 'Rapprochement : signalement PHAROS', date: w.at(10 * 24), author: 'OCLCTIC — plateforme PHAROS',
          body:
            `Bonjour,\n\nL'adresse ${A(w, S)} figure dans un signalement ${de(otherName)} (${otherCity}), qui déclare avoir versé ${amt(ob.value, 'USDT')} le ${fmtDate(ob.time, false)} (transaction ${ob.tx}) à un conseiller se présentant au nom ${de(brand)}.\n\n` +
            `D'autres versements semblent provenir de personnes non encore identifiées. Par ailleurs, des signalements récents visent des sociétés au mode opératoire identique (${sisters.map((s) => `« ${s.brand} »`).join(', ')}), sans adresse de paiement communiquée à ce stade.\n\nCordialement`,
        },
        {
          id: 'conformite', type: 'pv', title: 'PV de renseignement : échange avec la conformité de la plateforme', date: w.at(11 * 24), author: 'Enquêteur en charge',
          body:
            `Contact téléphonique avec le service des réquisitions ${de(exName)}. Notre interlocuteur précise :\n` +
            `• les adresses de dépôt de la plateforme sur Ethereum sont des contrats propres à chaque client, déployés par une fabrique ;\n` +
            `• pour identifier un compte, la plateforme a besoin de l'adresse de dépôt exacte, du hash et de la date de la transaction de dépôt ;\n` +
            `• les adresses du hot wallet, de la fabrique et des portefeuilles opérationnels sont communes à tous les clients : une réquisition qui ne cite qu'elles ne permet aucune identification.\n` +
            `${procedureFor(fx.entity)}`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui : lire un contrat de dépôt', date: w.at(11 * 24), author: 'Cellule d\'appui',
          body:
            `• Un envoi d'ETH à un contrat forwarder se lit dans le détail de la transaction : la valeur entre dans le contrat, qui la renvoie dans la foulée (rubrique « Transactions internes »). Le bénéficiaire de la transaction interne ne voit pas ce mouvement dans sa liste de transactions « normales ».\n` +
            `• Les jetons ERC-20 n'appellent pas le contrat : ils restent sur l'adresse de dépôt jusqu'à un appel de reversement signé par la plateforme.\n` +
            `• Une adresse CREATE2 peut recevoir des fonds avant que le contrat n'existe ; le déploiement survient souvent lors du premier reversement.\n` +
            `• Une adresse d'escroc active reçoit souvent des transferts de quelques centimes depuis des adresses « sosies » (mêmes premiers et derniers caractères) : c'est de l'empoisonnement d'adresse, qui vise ses correspondants. Ces expéditeurs ne sont pas des victimes.\n` +
            `• L'ETH qui paie le gas d'une adresse neuve vient de quelque part : ce premier financement relie souvent plusieurs adresses d'une même filière.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 8,
          prompt: 'Quelle adresse a encaissé les trois versements de la victime ?',
          answer: [S],
          hint: 'Ouvrez les transactions citées dans la plainte : elles ont toutes le même destinataire, que l\'on retrouve dans la capture de la messagerie.',
          explanation: `Les trois transactions de la plainte créditent ${A(w, S)}, l'adresse communiquée par le faux conseiller. C'est un compte externe (EOA), pas un contrat : l'escroc en détient la clé privée et signe lui-même les envois suivants. Les adresses qui lui ressemblent (mêmes premiers et derniers caractères) et lui envoient des centimes sont des sosies d'empoisonnement, pas l'escroc.`,
        },
        {
          id: 'o2', type: 'number', points: 9, unit: 'victimes', tolerance: 0,
          prompt: `Combien de victimes différentes (${lp.comprise}) ont versé des USDT à cette adresse ?`,
          answer: nVictims,
          hint: 'Listez les flux entrants d\'USDT de l\'adresse de l\'escroc et comptez les expéditeurs distincts. Écartez les transferts de quelques centimes : regardez qui les envoie.',
          explanation: `${nVictims} expéditeurs distincts versent des sommes réelles en USDT à ${A(w, S).slice(0, 12)}… : ${lp.la}, ${otherName} (signalement PHAROS)${othersTxt}, chacun approvisionné par un exchange peu avant son versement, schéma typique d'une victime guidée. Les ${nDust} transferts de moins d'un USDT viennent d'adresses sosies de l'escroc (empoisonnement d'adresse) : ce ne sont pas des victimes, les compter gonflerait le dossier d'expéditeurs fictifs. Le premier ETH reçu, lui, sert seulement à payer le gas.`,
        },
        {
          id: 'o13', type: 'address', points: 9,
          prompt: 'Quel portefeuille a fourni à l\'escroc l\'ETH nécessaire pour payer le gas ?',
          answer: [O],
          hint: 'Remontez le tout premier flux entrant de l\'adresse de l\'escroc : un petit montant d\'ETH, avant toute victime.',
          explanation: `Le ${fmtDate(gasTx.time, false)}, ${A(w, O)} verse ${amt(g0, 'ETH')} à l'escroc, avant le premier versement de victime : sans ETH, l'adresse ne pourrait rien envoyer. Il la réapprovisionne le ${fmtDate(gasTx2.time, false)} (${amt(g1, 'ETH')}), entre deux dépôts. Ce portefeuille est lui-même alimenté par des paiements de ChangeNOW (échangeur instantané sans compte) : il sert de « pompe à gas » à la filière.`,
        },
        {
          id: 'o14', type: 'addresses', points: 9,
          prompt: 'Hormis l\'adresse de l\'escroc, quelles adresses ce portefeuille a-t-il approvisionnées en gas (collectes probables d\'autres marques) ?',
          answer: sisters.map((s) => s.addr),
          hint: 'Dépliez les sorties du portefeuille de gas. Écartez ce qui part vers un commerçant étiqueté, puis vérifiez ce que reçoivent les autres destinataires.',
          explanation: `${sisters.length} autres adresses reçoivent chacune un petit montant d'ETH de gas, puis des USDT de particuliers fraîchement approvisionnés par un exchange : le même schéma que celui de l'escroc, ce qui en fait des adresses de collecte probables pour les autres marques signalées (${sisters.map((s) => s.brand).join(', ')}). La sortie vers NumeriCall (numéros virtuels) est une dépense du gestionnaire, pas une collecte : elle paie vraisemblablement les lignes des télévendeurs, et ce fournisseur peut être requis à son tour. Ces adresses ouvrent des pistes vers d'autres victimes et justifient un rapprochement avec les procédures en cours.`,
        },
        {
          id: 'o3', type: 'address', points: 9,
          prompt: 'Vers quelle adresse l\'escroc envoie-t-il la première tranche d\'USDT collectés ?',
          answer: [deposit],
          hint: 'Suivez la première sortie d\'USDT de l\'escroc. L\'adresse de destination est un contrat ; vérifiez qu\'elle ne reçoit pas les fonds d\'autres clients.',
          explanation: `Le ${fmtDate(depA.tx.time)}, l'escroc envoie ${amt(dA, 'USDT')} à ${A(w, deposit)}. L'inspecteur la présente comme un contrat « Forwarder » : c'est l'adresse de dépôt propre à un client ${de(exName)}. Elle ne reçoit que les envois de l'escroc, contrairement au hot wallet qui centralise les fonds de toute la clientèle.`,
        },
        {
          id: 'o4', type: 'entity', points: 7,
          prompt: 'À quelle plateforme appartient ce contrat de dépôt ?',
          answer: [exKey],
          hint: 'Regardez l\'étiquette du contrat, ou celle de l\'adresse vers laquelle il reverse les fonds.',
          explanation: `Le contrat est attribué à ${exName} et reverse ses fonds au hot wallet de la plateforme. ${procedureFor(fx.entity)}`,
        },
        {
          id: 'o5', type: 'tx', points: 9,
          prompt: 'Quelle transaction fait sortir la première tranche d\'USDT du contrat de dépôt ?',
          answer: [flushA.id],
          hint: 'Ouvrez la liste des transactions du contrat de dépôt : après la réception des USDT, une transaction déplace les jetons vers le hot wallet. Elle n\'est pas signée par l\'escroc.',
          explanation: `La transaction ${flushA.hash.slice(0, 18)}… (${fmtDate(flushA.time)}) appelle createForwarder(address,bytes32) sur la fabrique : elle déploie le contrat de dépôt à l'adresse calculée d'avance (rubrique « Contrat(s) déployé(s) ») et, dans la même exécution, reverse les ${amt(dA, 'USDT')} au hot wallet (événement Transfer). Le second reversement, plus tard, appelle directement flushTokens(address) sur le contrat, désormais déployé.`,
        },
        {
          id: 'o6', type: 'address', points: 8,
          prompt: 'Quel compte a signé cette transaction de reversement ?',
          answer: [fx.operator],
          hint: 'Dans le détail de la transaction, distinguez le signataire (« De ») du contrat appelé et des adresses qui reçoivent les jetons.',
          explanation: `Le reversement est signé par ${A(w, fx.operator)}, portefeuille opérationnel ${de(exName)} qui déclenche les reversements de milliers de contrats de dépôt. Ni l'escroc ni le contrat ne signent : un contrat ne peut pas initier une transaction. Ce compte, comme la fabrique, est commun à tous les clients : il ne désigne personne.`,
        },
        {
          id: 'o7', type: 'choice', points: 7,
          prompt: 'Le contrat de dépôt a reçu les USDT avant toute transaction de déploiement. Comment est-ce possible ?',
          hint: 'Relisez la rubrique « Contrat(s) déployé(s) » du premier reversement et l\'aide de la fonction createForwarder.',
          ...choice(r,
            'Son adresse est calculée d\'avance (CREATE2 : fabrique, sel, code) : elle peut recevoir des jetons avant que le contrat ne soit déployé',
            [
              'L\'escroc a déployé le contrat lui-même dans la transaction de dépôt des USDT',
              'Les USDT ont transité par le hot wallet avant d\'arriver sur le contrat',
              'Un contrat de dépôt n\'est jamais déployé : il reste une adresse ordinaire',
            ]),
          explanation: `Avec CREATE2, l'adresse d'un contrat dépend de la fabrique, d'un sel et du code : la plateforme la communique au client sans dépenser de gas. Un transfert de jetons n'exécute pas de code chez le destinataire, il ne fait que modifier le registre du contrat USDT : les jetons « attendent » donc à cette adresse. Le déploiement intervient ici lors du premier reversement (${fmtDate(flushA.time)}).`,
        },
        {
          id: 'o8', type: 'amount', points: 9, unit: 'ETH', tolerance: 0.01,
          prompt: 'Quel montant d\'ETH le contrat de dépôt reverse-t-il au hot wallet, en transaction interne, lors du dépôt d\'ETH de l\'escroc ?',
          answer: eDep,
          hint: 'Ouvrez la transaction par laquelle l\'escroc envoie de l\'ETH au contrat de dépôt et lisez la rubrique « Transactions internes ».',
          explanation: `La transaction ${ethDep.tx.hash.slice(0, 18)}… envoie ${amt(eDep, 'ETH')} au contrat, qui les renvoie aussitôt (CALL interne) au hot wallet ${A(w, fx.hot).slice(0, 12)}…. Le montant dépasse l'ETH versé par la victime (${amt(e1, 'ETH')}) : l'escroc y ajoute une partie de son ETH de gas. Sur un explorateur, ce mouvement n'apparaît que dans l'onglet des transactions internes, jamais dans la liste « normale » du hot wallet : qui ne lit que les transferts conclurait à tort que l'ETH dort sur le contrat.`,
        },
        {
          id: 'o10', type: 'choice', points: 8,
          prompt: 'Quelle adresse citer dans la réquisition pour identifier le titulaire du compte ?',
          hint: 'Parmi les adresses rencontrées, laquelle est propre à un seul client ?',
          ...choice(r, `Le contrat de dépôt ${A(w, deposit).slice(0, 10)}…, propre à un client, avec les hash et dates des dépôts`, wrongs),
          explanation: `Seul le contrat de dépôt ${A(w, deposit)} est attribué à un client unique. La réquisition cite cette adresse et les transactions de dépôt (${depA.tx.hash.slice(0, 12)}…, ${ethDep.tx.hash.slice(0, 12)}…, ${depB.tx.hash.slice(0, 12)}…) et sollicite l'identité du titulaire (KYC), les adresses IP de connexion, l'historique du compte (dépôts, conversions, retraits vers un IBAN) et un gel conservatoire du solde.`,
        },
        {
          id: 'o11', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDT l\'escroc a-t-il crédité sur son compte via ce contrat de dépôt ?',
          answer: totalDeposited,
          hint: 'Il y a deux envois d\'USDT de l\'escroc vers le contrat de dépôt, chacun suivi d\'un reversement. Les autres sorties d\'USDT ne vont pas vers le contrat.',
          explanation: `${amt(dA, 'USDT')} (reversés par createForwarder) + ${amt(dB, 'USDT')} (reversés le ${fmtDate(flushB.time)} par flushTokens, signé par le même portefeuille opérationnel) = ${amt(totalDeposited, 'USDT')}, auxquels s'ajoutent ${amt(eDep, 'ETH')}. Les ${comms.length} sorties d'USDT vers des adresses neuves (${amt(commTotal, 'USDT')} au total) ne touchent pas le contrat : elles ne sont pas créditées sur le compte client.`,
        },
        {
          id: 'o12', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT restent aujourd\'hui sur l\'adresse de l\'escroc (montant dont le gel peut être demandé à Tether) ?',
          answer: leftUsdt,
          hint: 'Faites le bilan des USDT de l\'adresse : tout ce qui est entré (victimes et centimes compris), moins les deux dépôts et les autres sorties.',
          explanation: `Après ses deux dépôts, l'escroc a encore versé ${amt(commTotal, 'USDT')} en ${comms.length} envois vers des adresses neuves (${comms.map((b) => `${A(w, b.address).slice(0, 8)}… : ${amt(b.value, 'USDT')}, ${fateTxt(b.fate)}`).join(' ; ')}), vraisemblablement les commissions de ses télévendeurs. Il reste ${amt(leftUsdt, 'USDT')} sur ${A(w, S).slice(0, 12)}…. Tether peut placer une adresse sur liste noire à la demande motivée des autorités : le gel bloque ce reliquat sur place. Les adresses des commissions qui n'ont pas bougé peuvent être visées dans la même demande.`,
        },
      ],
      truth: {
        path: [gasTx.id, ...othersBefore.map((o) => `eth:${o.tx}`), p1.id, depA.tx.id, flushA.id, p2.id, lateTx.id, p3.id, ethDep.tx.id, depB.tx.id, flushB.id],
        addresses: [S, deposit, O, ...sisters.map((s) => s.addr)],
        debrief:
          `1. Le portefeuille ${A(w, O).slice(0, 12)}…, alimenté par ChangeNOW, fournit l'ETH de gas à l'adresse de l'escroc (${amt(g0, 'ETH')}) et à ${sisters.length} autres adresses de collecte de la filière.\n` +
          `2. ${victim.name} verse ${amt(u1, 'USDT')}, puis ${amt(u2, 'USDT')} de « frais » et ${amt(e1, 'ETH')} de « taxe » à ${A(w, S)}, adresse du faux conseiller, qui collecte aussi les fonds de ${nVictims - 1} autres victimes.\n` +
          `3. L'escroc envoie ${amt(dA, 'USDT')} au contrat de dépôt ${A(w, deposit)} (${exName}), alors que ce contrat n'est pas encore déployé. Le portefeuille opérationnel de la plateforme signe ensuite createForwarder sur la fabrique : le contrat est déployé et les USDT reversés au hot wallet dans la même transaction.\n` +
          `4. L'ETH (${amt(eDep, 'ETH')}) envoyé au même contrat repart vers le hot wallet en transaction interne, sans aucun délai.\n` +
          `5. Une seconde tranche de ${amt(dB, 'USDT')} est reversée par flushTokens. L'escroc verse ensuite ${amt(commTotal, 'USDT')} de commissions ; ${amt(leftUsdt, 'USDT')} restent sur son adresse.\n` +
          `6. Fausses pistes : ${nDust} micro-transferts d'USDT depuis des adresses sosies (empoisonnement), sans lien avec les victimes ; les commissions, qui ne rejoignent aucun exchange ni le contrat de dépôt ; le paiement NumeriCall du portefeuille de gas, piste secondaire mais pas une collecte.\n\n` +
          `À retenir : quand l'adresse de dépôt est un contrat, l'heuristique « réception puis balayage » reste valable, mais le balayage prend la forme d'un appel de contrat signé par la plateforme, et l'ETH circule en transactions internes. Le hot wallet, la fabrique et le portefeuille opérationnel sont des infrastructures communes : seule l'adresse du contrat de dépôt, avec les hash des dépôts, identifie le client dans une réquisition. Enfin, l'origine du gas d'une adresse neuve est un pivot sous-estimé : elle relie ici plusieurs marques d'une même filière.`,
      },
      hints: [
        'Partez des trois transactions de la plainte : elles mènent toutes à la même adresse.',
        'Pour compter les victimes, ne retenez que les versements réels : les centimes viennent d\'adresses qui imitent celle de l\'escroc.',
        'Suivez les sorties de l\'escroc : la destination des dépôts est un contrat. Ouvrez sa fiche et sa liste de transactions.',
        'Un reversement de jetons est une transaction signée par un portefeuille de la plateforme : regardez qui signe et quel contrat est appelé.',
        'Pour l\'ETH, le mouvement vers le hot wallet ne figure qu\'en « Transactions internes » dans le détail de la transaction de dépôt.',
        'Remontez le tout premier ETH reçu par l\'escroc, puis dépliez les autres sorties de ce portefeuille.',
      ],
    }
  },
}
