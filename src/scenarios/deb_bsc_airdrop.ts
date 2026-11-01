import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import { dusting } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor, receivedIn } from './util'

// Faux airdrop sur BNB Smart Chain : la victime paie des « frais » en BNB
// (natif) et en USDT (BEP-20). L'adresse 0x de l'escroc existe aussi sur
// Ethereum (même clé), presque vide : le piège est de chercher sur la mauvaise
// chaîne. Le compte de l'escroc a une vie propre : il a été approvisionné en
// BNB depuis le compte d'exchange de l'escroc, il a payé le « kit » d'airdrop
// à son vendeur (qui encaisse le même prix de plusieurs acheteurs), il reçoit
// les frais de plusieurs victimes et des micro-envois de sosies (address
// poisoning). Il met une partie des USDT de côté (gelables) et dépose le reste
// sur l'exchange même d'où venait son BNB.

const TOKENS = ['MOONX', 'BNBAI', 'PEPEGOLD', 'SAFEDOGE', 'METAPAW', 'QUANTA'] as const

const bnb = (v: number) => roundAsset('BNB', v)
const usdt = (v: number) => roundAsset('USDT', v)

// ── Heures et délais calculés (heure de Paris) ──────────────────────────────
const parisHM = (ts: number): [number, number] => {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts * 1000))
  return [Number(p.find((x) => x.type === 'hour')!.value), Number(p.find((x) => x.type === 'minute')!.value)]
}
/** Même jour (heure de Paris) que `ts`, à h:m. */
const sameDayAt = (ts: number, h: number, m = 0) => {
  const [hh, mm] = parisHM(ts)
  return ts - (hh * 60 + mm) * 60 - (ts % 60) + (h * 60 + m) * 60
}
/** Avance `ts` dans les heures de bureau (9 h – 18 h) si besoin. */
const office = (ts: number) => {
  const [h] = parisHM(ts)
  const m = 5 + (Math.floor(ts / 60) % 50)
  return h < 9 ? sameDayAt(ts, 9, m) : h >= 18 ? sameDayAt(ts + DAY, 9, m) : ts
}
const parisDay = (ts: number) => Date.parse(new Date(ts * 1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }))
/** « le même jour », « le lendemain », « le surlendemain », « 3 jours plus tard ». */
const later = (from: number, to: number) => {
  const n = Math.round((parisDay(to) - parisDay(from)) / 86400000)
  return n <= 0 ? 'le même jour' : n === 1 ? 'le lendemain' : n === 2 ? 'le surlendemain' : `${n} jours plus tard`
}
/** Durée lisible : « 45 min », « 3 h 05 », « 2 jours ». */
const dur = (sec: number) => {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h >= 48) return `${Math.round(h / 24)} jours`
  return `${h} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`
}

export const debBscAirdrop: ScenarioTemplate = {
  id: 'deb-bsc-airdrop',
  title: 'BNB Chain : le faux airdrop',
  tagline: 'Même format d\'adresse qu\'Ethereum, mais une autre blockchain, et un compte d\'escroc qui a une histoire.',
  description:
    'Pour « débloquer » un airdrop imaginaire, une victime a payé des frais en BNB puis en USDT sur BNB Smart Chain. Retrouvez le compte de l\'escroc sur la bonne chaîne, triez ses entrées (victimes, approvisionnement personnel, micro-envois de sosies) et ses sorties (achat du kit d\'arnaque, mise de côté, exchange), chiffrez la collecte et repérez les USDT encore gelables.',
  difficulty: 1,
  chains: ['bsc'],
  skills: ['lecture_tx', 'evm', 'tokens', 'exchange_id', 'typologies', 'gel'],
  estMinutes: 35,
  lessons: ['comptes-evm', 'tokens-erc20', 'stablecoins', 'exchanges', 'typologies'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const token = r.pick(TOKENS)
    const promised = r.pick([1500, 2500, 3000, 4200, 5000])
    const seller = fakeHandle(r)

    // L'escroc retire son BNB de l'exchange où il déposera ensuite ; la victime achète ailleurs.
    const destKey = r.pick(['binance', 'okx'] as const)
    const fundKey = destKey === 'binance' ? 'okx' : 'binance'
    const dest = exchange(w, destKey, 'bsc')
    const fund = exchange(w, fundKey, 'bsc')

    const scamE = w.customEntity({ name: `Faux airdrop ${token} (inconnu)`, category: 'scam', description: 'Faux site de distribution gratuite de jetons réclamant des « frais de déblocage ».' })
    const kitE = w.customEntity({ name: 'Vendeur de kits d\'arnaque (inconnu)', category: 'suspect', description: 'Vend sur Telegram des faux sites d\'airdrop clés en main.' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('bsc', { entity: victimE })
    // Même compte sur Ethereum (même clé privée) : créé d'abord, la forme BSC ensuite
    const s1eth = w.addr('eth', { entity: scamE })
    const s1 = w.addrSameEoa(s1eth, 'bsc')
    const reserve = w.addr('bsc', { entity: scamE })
    const kitSeller = w.addr('bsc', { entity: kitE })
    const path: Tx[] = []

    // Activité ancienne et minime du même compte sur Ethereum
    const ethOld = w.fundAccount(s1eth, roundAsset('ETH', r.float(0.004, 0.02)), 'ETH', w.at(-r.int(90, 400) * 24))

    // ── Préparation : approvisionnement en BNB et achat du kit ──────────────
    const T0 = w.at(0)
    const kitPrice = usdt(r.pick([150, 200, 250, 300]))
    const prepT = T0 - Math.round(r.float(3, 6) * DAY)
    const gasIn = dest.withdraw(s1, bnb(r.float(0.06, 0.14)), prepT, 'BNB')
    const kitIn = dest.withdraw(s1, usdt(kitPrice + r.int(1, 3) * 5), prepT + r.int(15, 90) * 60, 'USDT')
    const kitPay = w.transfer({ time: kitIn.time + Math.round(r.float(1, 8) * HOUR), from: s1, to: kitSeller, value: kitPrice, asset: 'USDT' })

    // Le vendeur encaisse le même prix d'autres acheteurs et vide régulièrement son adresse
    const nBuyers = r.int(3, 5)
    for (let i = 0; i < nBuyers; i++) {
      const b = w.addr('bsc')
      const t = T0 + Math.round(r.float(-20, 6) * DAY)
      w.fundAccount(b, bnb(r.float(0.005, 0.02)), 'BNB', t - Math.round(r.float(5, 60) * HOUR))
      w.fundAccount(b, usdt(kitPrice + r.int(0, 4) * 5), 'USDT', t - Math.round(r.float(1, 30) * HOUR))
      w.transfer({ time: t, from: b, to: kitSeller, value: kitPrice, asset: 'USDT' })
    }
    const sellerOut = w.addr('bsc')
    w.transfer({ time: T0 + Math.round(r.float(7, 9) * DAY), from: kitSeller, to: sellerOut, value: usdt(w.balanceOf(kitSeller, 'USDT')), asset: 'USDT' })

    // ── La victime ────────────────────────────────────────────────────────────
    const b1 = bnb(r.pick([0.03, 0.05, 0.08, 0.1, 0.12]))
    const u1 = usdt(r.int(15, 50) * 10)
    const u2 = usdt(r.int(30, 120) * 10)
    fund.withdraw(victim, bnb(b1 + r.float(0.02, 0.1)), T0 - Math.round(r.float(5, 30) * HOUR), 'BNB')
    fund.withdraw(victim, usdt(u1 + r.int(0, 3) * 10), T0 - Math.round(r.float(1, 4) * HOUR), 'USDT')
    const pay1 = w.transfer({ time: T0, from: victim, to: s1, value: b1, asset: 'BNB' })
    const pay2 = w.transfer({ time: T0 + r.int(10, 50) * 60, from: victim, to: s1, value: u1, asset: 'USDT' })
    // Relance du site le lendemain ou le surlendemain, en journée
    const u2T = sameDayAt(pay2.time + r.int(1, 2) * DAY, r.int(9, 20), r.int(0, 59))
    fund.withdraw(victim, usdt(u2 + r.int(0, 3) * 10), u2T - Math.round(r.float(1, 3) * HOUR), 'USDT')
    const pay3 = w.transfer({ time: u2T, from: victim, to: s1, value: u2, asset: 'USDT' })
    path.push(pay1, pay2, pay3)

    // ── Autres victimes ──────────────────────────────────────────────────────
    const nOthers = r.int(2, 4)
    let othersUsdt = 0
    for (let i = 0; i < nOthers; i++) {
      const a = w.addr('bsc')
      const t = w.at(r.float(-30, 15))
      const bv = bnb(r.pick([0.03, 0.05, 0.08, 0.1]))
      const uv = usdt(r.int(10, 80) * 10)
      w.fundAccount(a, bnb(bv + r.float(0.01, 0.05)), 'BNB', t - Math.round(r.float(2, 48) * HOUR))
      w.fundAccount(a, usdt(uv + r.int(0, 5) * 10), 'USDT', t - Math.round(r.float(1, 24) * HOUR))
      w.transfer({ time: t, from: a, to: s1, value: bv, asset: 'BNB' })
      w.transfer({ time: t + r.int(5, 60) * 60, from: a, to: s1, value: uv, asset: 'USDT' })
      othersUsdt += uv
    }
    const nVictims = nOthers + 1
    const paidUsdt = usdt(u1 + u2)
    const totalUsdt = usdt(paidUsdt + othersUsdt)

    // ── Mise de côté sur un compte de réserve ───────────────────────────────
    const reserveV = usdt(Math.round((totalUsdt * r.float(0.15, 0.25)) / 10) * 10)
    const reserveTx = w.transfer({ time: u2T + Math.round(r.float(0.5, 2.5) * HOUR), from: s1, to: reserve, value: reserveV, asset: 'USDT' })
    path.push(reserveTx)

    // ── Dépôt sur l'exchange ─────────────────────────────────────────────────
    const depT = u2T + Math.round(r.float(3, 16) * HOUR)
    const usdtDep = usdt(Math.floor((w.balanceOf(s1, 'USDT') * r.float(0.9, 1)) / 10) * 10)
    const d1 = dest.receive(s1, usdtDep, depT, { asset: 'USDT' })
    const deposit = d1.deposit
    const bnbDep = bnb(w.balanceOf(s1, 'BNB') * r.float(0.7, 0.85))
    const d2 = dest.receive(s1, bnbDep, depT + r.int(5, 40) * 60, { asset: 'BNB', depositAddr: deposit })
    path.push(d1.tx, ...(d1.sweep ? [d1.sweep] : []), d2.tx, ...(d2.sweep ? [d2.sweep] : []))

    // ── Micro-envois de sosies (address poisoning) ──────────────────────────
    // Des adresses qui commencent et finissent comme le compte de l'escroc lui
    // envoient des montants infimes, espérant qu'il recopie un jour la mauvaise.
    const poison = dusting(w, s1, { time: reserveTx.time + Math.round(r.float(2, 6) * HOUR), n: r.int(2, 3), spreadH: 10, token: 'USDT' })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-6 * 24), w.at(6 * 24), 'USDT')
    dest.noise(8, w.at(-6 * 24), w.at(6 * 24), 'BNB')
    fund.noise(8, w.at(-4 * 24), w.at(4 * 24), 'BNB')

    const destName = dest.entity.name
    const views = r.int(18, 60) * 1000
    const domainDays = r.int(2, 6)
    const nPoison = poison.txs.length
    const gasV = receivedIn(w, gasIn, s1)
    const kitInV = receivedIn(w, kitIn, s1)
    const ethOldV = receivedIn(w, ethOld, s1eth)
    const poisonMax = Math.max(...poison.txs.map((t) => receivedIn(w, t, s1)))
    const poisonTxt = `des montants infimes d'USDT, ${poisonMax < 0.01 ? 'moins d\'un centime' : `au plus ${amt(poisonMax, 'USDT')}`} chacune`
    const plainteT = office(depT + DAY)
    const relance = later(pay2.time, u2T)
    const victimShare = g('à lui seul', 'à elle seule')
    const depSweepT = d1.sweep ? d1.sweep.time : d1.tx.time

    return {
      world: w,
      title: `Faux airdrop ${token} — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. Sur un réseau social, une publicité annonçait un « airdrop » du jeton ${token} : ${promised.toLocaleString('fr-FR')} $ offerts aux premiers inscrits. Pour « réclamer » ses jetons, ${g('il', 'elle')} a dû payer des frais de gas en BNB, puis des « frais de déblocage » en USDT, en deux fois. Les jetons ne sont jamais arrivés.\n\n` +
        `Les paiements ont été faits sur BNB Smart Chain (BSC), une blockchain compatible avec Ethereum (EVM) : mêmes adresses en 0x…, même fonctionnement par comptes, mais un registre distinct, avec sa propre monnaie native (le BNB) et ses jetons au standard BEP-20.\n\n` +
        `Le compte de l'escroc ne sert pas qu'à cette victime : il a été préparé avant la campagne et reçoit des fonds de plusieurs origines. Votre mission : l'identifier sur la bonne chaîne, trier ses entrées et ses sorties, mesurer le nombre de victimes et la collecte, puis suivre l'argent jusqu'à l'exchange, sans oublier ce qui peut encore être gelé.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: victimName,
          body:
            `« J'ai payé ${amt(b1, 'BNB')} de frais de gas le ${fmtDate(pay1.time)}, puis ${amt(u1, 'USDT')} de frais de déblocage. ${relance[0].toUpperCase()}${relance.slice(1)}, le site m'a réclamé ${amt(u2, 'USDT')} de plus pour une "vérification anti-robot". J'ai payé. Mon portefeuille était réglé sur "BNB Smart Chain".\n\n` +
            `Mon adresse : ${A(w, victim)}\n` +
            `Transaction des ${amt(u2, 'USDT')} : ${pay3.hash} »`,
        },
        {
          id: 'capture', type: 'capture', title: `Capture du site « ${token} Airdrop »`, date: T0 - 2 * HOUR,
          body:
            `🎁 ${token} AIRDROP — PHASE FINALE 🎁\n` +
            `Votre allocation : ${promised.toLocaleString('fr-FR')} $ en ${token}\n` +
            `Pour réclamer : réglez les frais de réseau sur l'adresse officielle du contrat de distribution :\n${A(w, s1)}\n` +
            `Réseau : BNB Smart Chain (BEP-20) uniquement.\n` +
            `⏳ Offre valable 24 h.`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Annonce relevée sur un canal Telegram de vente de « kits »', date: prepT - DAY, author: `@${seller}`,
          body:
            `🔥 KIT AIRDROP CLÉ EN MAIN 🔥\n` +
            `Site + faux formulaire de réclamation + visuels pub, prêt en 10 min.\n` +
            `Prix : ${kitPrice} USDT (BEP-20), paiement à l'adresse donnée en privé.\n` +
            `Déjà ${r.int(40, 120)} clients satisfaits. Mise à jour du jeton gratuite.\n\n` +
            `[Note de la cellule d'appui : le modèle du faux site saisi dans ce dossier correspond à ce kit. L'adresse de paiement du vendeur n'est pas publique.]`,
        },
        {
          id: 'note', type: 'note', title: 'Message d\'un collègue', date: plainteT + 2 * HOUR, author: 'Collègue de la brigade',
          body: `J'ai collé l'adresse du site dans Etherscan : quasiment rien dessus, à peine ${amt(ethOldV, 'ETH')} reçus le ${fmtDate(ethOld.time, false)}, et plus rien depuis. Fausse piste ? Je te laisse vérifier.`,
        },
        {
          id: 'osint', type: 'osint', title: 'Recherche en sources ouvertes — site et publicité', date: office(plainteT + DAY), author: 'Cellule d\'appui',
          body:
            `Nom de domaine du faux site enregistré ${domainDays} jours avant les faits, via un bureau d'enregistrement étranger, coordonnées du titulaire masquées.\n` +
            `La publicité a été diffusée environ ${views.toLocaleString('fr-FR')} fois avant son retrait par le réseau social.\n` +
            `Plusieurs commentaires sous la publicité signalent une arnaque après paiement des « frais ».\n\n` +
            `Rappels : sur ce type d'arnaque, l'escroc ne dépose pas toujours tout sur un exchange, et les comptes visés reçoivent souvent des micro-envois d'adresses « sosies » (même début, même fin) : ce ne sont pas des victimes.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quel compte de l\'escroc, sur BNB Smart Chain, a reçu les paiements de la victime ?',
          answer: [s1],
          hint: 'Dépliez les sorties du portefeuille de la victime (qui est sur BSC). La recherche (Ctrl K) peut proposer la même adresse sur deux chaînes : vérifiez l\'étiquette de chaîne.',
          explanation: `${A(w, s1)} sur BNB Smart Chain. Le site présente une adresse de « contrat de distribution », mais c'est un simple compte externe (EOA) contrôlé par l'escroc. La même adresse existe sur Ethereum, avec une activité ancienne et minime : ce n'est pas là que les fonds ont circulé.`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Que répondre au collègue qui ne trouve presque rien sur Etherscan ?',
          hint: 'Sur quelle chaîne le portefeuille de la victime et la capture du site sont-ils réglés ?',
          ...choice(r,
            'La même adresse 0x existe sur plusieurs chaînes EVM : il faut l\'examiner sur BSC',
            [
              'L\'adresse est fausse : une adresse en 0x ne peut exister que sur le réseau Ethereum',
              'Les fonds ont été effacés de la blockchain après le dépôt de la plainte',
              'L\'escroc est passé par un mixeur, qui masque l\'adresse sur Etherscan',
            ]),
          explanation: 'Ethereum, BNB Smart Chain, Arbitrum, Base… partagent le même format d\'adresse : une même clé privée contrôle la même adresse 0x sur chacune, mais chaque chaîne a son propre registre et ses propres soldes. Etherscan ne montre qu\'Ethereum ; pour BSC, il faut un explorateur de BSC (ou un outil multi-chaînes). Avant de conclure qu\'une adresse est vide, vérifiez toujours la chaîne indiquée par la victime, son portefeuille ou la capture (« BEP-20 »).',
        },
        {
          id: 'o6', type: 'number', points: 10, tolerance: 0, unit: 'victimes',
          prompt: 'Combien de portefeuilles de victimes distincts (celui de la personne plaignante compris) ont payé des « frais » au compte de l\'escroc ?',
          answer: nVictims,
          hint: 'Listez les émetteurs des transferts entrants. Écartez le hot wallet d\'exchange (approvisionnement de l\'escroc lui-même) et les envois de montants infimes (quelques centimes au plus). Chaque victime paie en BNB puis en USDT : ne la comptez qu\'une fois.',
          explanation: `${nVictims} portefeuilles : ${victimName} et ${nOthers} autres, qui suivent tous le même schéma (un petit montant de BNB « pour le gas », puis des USDT « de déblocage »). Ne sont pas des victimes : le hot wallet ${de(destName)}, qui a approvisionné le compte avant la campagne (c'est l'escroc qui retire de son propre compte), et les ${nPoison} adresses sosies qui envoient ${poisonTxt} (address poisoning). On compte des portefeuilles, pas des transactions : c'est une estimation minimale du nombre de victimes, à transmettre au parquet.`,
        },
        {
          id: 'o7', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDT le compte de l\'escroc a-t-il reçu des victimes ?',
          answer: totalUsdt,
          hint: 'Additionnez les transferts entrants d\'USDT venant des victimes. Le total brut du résumé inclut aussi les USDT que l\'escroc s\'est envoyés depuis son exchange pour acheter le kit.',
          explanation: `${amt(totalUsdt, 'USDT')}, dont ${amt(paidUsdt, 'USDT')} versés par ${victimName}. Le total reçu affiché par le résumé du compte est plus élevé : il comprend le retrait de ${amt(kitInV, 'USDT')} depuis ${destName} (fonds propres de l'escroc) et les micro-envois des sosies, qui ne sont pas un préjudice. Les petits montants de BNB s'ajoutent au préjudice, mais se chiffrent séparément (autre actif).`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'La victime a payé en BNB puis en USDT. Quelle est la différence entre les deux ?',
          hint: 'Ouvrez une transaction d\'USDT : dans quelle monnaie les frais (gas) sont-ils payés ?',
          ...choice(r,
            'Le BNB est la monnaie native qui paie le gas ; l\'USDT est un jeton BEP-20',
            [
              'Le BNB est un jeton BEP-20 émis par Tether ; l\'USDT est la monnaie native',
              'Aucune : sur BNB Smart Chain, tous les actifs sont des monnaies natives',
              'L\'USDT BEP-20 devient de l\'USDT Ethereum dès qu\'il arrive chez l\'escroc',
            ]),
          explanation: 'Comme l\'ETH sur Ethereum, le BNB est l\'actif natif de BSC : il paie les frais (gas) de toutes les transactions, y compris les transferts de jetons. C\'est pourquoi l\'escroc a dû approvisionner son compte en BNB avant de pouvoir déplacer des USDT. L\'USDT BEP-20 est un jeton géré par un smart contract (équivalent de l\'ERC-20). Les deux se suivent séparément ; l\'USDT a un émetteur (Tether) capable de geler des jetons encore présents sur une adresse.',
        },
        {
          id: 'o13', type: 'tx', points: 9,
          prompt: 'Avant la campagne, le compte de l\'escroc a reçu ses premiers BNB pour payer le gas. Quelle transaction l\'a approvisionné ?',
          answer: [gasIn.id],
          hint: 'Remontez l\'historique du compte jusqu\'à sa toute première entrée, plusieurs jours avant le paiement de la victime : de quelle adresse étiquetée vient-elle ?',
          explanation: `Le ${fmtDate(gasIn.time)}, ${amt(gasV, 'BNB')} arrivent du hot wallet ${de(destName)} (${gasIn.hash.slice(0, 14)}…) : c'est un retrait d'un compte client de cette plateforme vers le compte de l'escroc, suivi d'un retrait de ${amt(kitInV, 'USDT')}. Ce n'est pas une victime : c'est l'escroc qui s'approvisionne lui-même. Ce retrait est une piste d'identification à part entière, qui ne dépend pas du dépôt final : la plateforme sait quel client a demandé un retrait vers cette adresse, à cette date. Les victimes, elles, paient toutes après la mise en ligne du site.`,
        },
        {
          id: 'o14', type: 'address', points: 9,
          prompt: 'L\'escroc a payé son « kit » d\'airdrop avant les faits. À quelle adresse ?',
          answer: [kitSeller],
          hint: 'Cherchez une sortie d\'USDT antérieure au paiement de la victime, dont le montant correspond au prix de l\'annonce Telegram. Regardez ensuite qui d\'autre paie cette adresse.',
          explanation: `Le ${fmtDate(kitPay.time)}, ${amt(kitPrice, 'USDT')} partent vers ${A(w, kitSeller)} : exactement le prix de l'annonce, ${dur(kitPay.time - kitIn.time)} après le retrait d'USDT depuis ${destName}, et avant toute victime. Cette adresse reçoit le même montant de ${nBuyers} autres portefeuilles : c'est l'adresse d'encaissement du vendeur du kit, pas une victime ni une réserve. Elle ouvre une piste vers d'autres acheteurs du même kit (autres escroqueries) et vers le vendeur lui-même.`,
        },
        {
          id: 'o10', type: 'address', points: 10,
          prompt: 'Après les paiements de la victime, l\'escroc met des USDT de côté sur un autre compte non étiqueté. Lequel ?',
          answer: [reserve],
          hint: 'Classez les sorties d\'USDT postérieures au dernier paiement de la victime : la première ne va pas vers une adresse qui reverse tout à un hot wallet.',
          explanation: `Le ${fmtDate(reserveTx.time)}, ${amt(reserveV, 'USDT')} partent vers ${A(w, reserve)}, qui ne les déplace plus : ce n'est pas une adresse de dépôt d'exchange (elle ne reverse rien à un hot wallet), mais un compte de réserve contrôlé par l'escroc. Ne pas confondre avec l'adresse du vendeur du kit, payée avant les faits et qui reçoit de nombreux acheteurs. C'est une cible prioritaire : les USDT y sont encore, donc gelables.`,
        },
        {
          id: 'o11', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT dorment sur ce compte de réserve ?',
          answer: reserveV,
          hint: 'Lisez le solde USDT du compte de réserve dans son résumé, ou le montant du transfert qui l\'a alimenté.',
          explanation: `${amt(reserveV, 'USDT')}, soit environ ${Math.round((reserveV / totalUsdt) * 100)} % des USDT collectés auprès des victimes. C'est le montant à citer dans la demande de gel adressée à l'émetteur, avec l'adresse et le hash du transfert.`,
        },
        {
          id: 'o2', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme l\'escroc a-t-il déposé le reste des fonds ?',
          answer: [destKey],
          hint: 'Suivez les sorties du compte de l\'escroc sur BSC : l\'USDT et le BNB partent vers la même adresse, qui reverse tout à un hot wallet étiqueté.',
          explanation: `L'USDT puis le BNB arrivent sur l'adresse de dépôt ${A(w, deposit)}, balayée ${dur(depSweepT - d1.tx.time)} plus tard vers le hot wallet ${de(destName)}, la plateforme même d'où venait l'approvisionnement en BNB : le retrait et le dépôt désignent très probablement le même client. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o9', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt de cette plateforme faut-il citer dans la réquisition ?',
          answer: [deposit],
          hint: 'C\'est l\'adresse qui reçoit les fonds du compte de l\'escroc, pas le hot wallet vers lequel elle les reverse (ni celui d\'où venait le BNB du départ).',
          explanation: `${A(w, deposit)} : sur les chaînes à comptes, chaque client d'un exchange reçoit sa propre adresse de dépôt, que la plateforme rattache à son compte. Citer le hot wallet ne servirait à rien : il regroupe les fonds de tous les clients. La réquisition mentionne l'adresse de dépôt, les hash des deux dépôts (USDT et BNB), et aussi les deux retraits du départ vers ${A(w, s1).slice(0, 10)}…, qui rattachent le même client.`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT (BEP-20) l\'escroc a-t-il déposés sur cette plateforme ?',
          answer: usdtDep,
          hint: 'Ouvrez le transfert d\'USDT vers l\'adresse de dépôt. Ne confondez pas avec le transfert de BNB, qui suit de peu.',
          explanation: `${amt(usdtDep, 'USDT')} : ${usdtDep > paidUsdt
            ? `plus que les ${amt(paidUsdt, 'USDT')} versés par ${victimName}, car ${nOthers} autres victimes ont payé le même compte.`
            : `moins que les ${amt(paidUsdt, 'USDT')} versés par ${victimName} ${victimShare}, parce qu'une partie de la collecte est partie sur le compte de réserve avant le dépôt. Le compte mêle pourtant les USDT de ${nVictims} victimes : le dépôt ne se rattache pas aux seuls fonds ${g('du plaignant', 'de la plaignante')}.`} S'y ajoute un dépôt séparé de ${amt(bnbDep, 'BNB')} vers la même adresse.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Quel est le bon réflexe pour les USDT encore présents sur le compte de réserve ?',
          hint: 'Ce compte n\'appartient à aucune plateforme : qui a la main sur le jeton lui-même ?',
          ...choice(r,
            'Demander sans attendre à Tether, l\'émetteur de l\'USDT, le gel des jetons présents sur ce compte',
            [
              `Demander à ${destName} de geler le compte de réserve, puisque l'escroc y a aussi un compte client`,
              'Demander aux validateurs de BNB Smart Chain d\'annuler le transfert vers le compte de réserve',
              'Attendre la réponse de l\'exchange : le gel n\'est possible qu\'une fois l\'auteur identifié',
            ]),
          explanation: `Le compte de réserve ${A(w, reserve)} est un portefeuille contrôlé par l'escroc, pas un compte d'exchange : ${destName} n'a aucune prise dessus. L'émetteur de l'USDT peut en revanche bloquer les jetons présents sur une adresse, sur demande motivée via son portail dédié aux forces de l'ordre (adresse, solde, hash, contexte). C'est une mesure conservatoire volontaire de l'émetteur, qui n'attend pas l'identification ; la saisie suit ensuite les règles applicables. Une transaction confirmée ne s'annule pas.`,
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [s1, deposit, reserve, kitSeller, s1eth],
        debrief:
          `1. Plusieurs jours avant les faits, l'escroc retire ${amt(gasV, 'BNB')} puis ${amt(kitInV, 'USDT')} de son compte ${destName} vers ${A(w, s1)}, et paie ${amt(kitPrice, 'USDT')} au vendeur du kit (${A(w, kitSeller)}), adresse qui encaisse le même prix de ${nBuyers} autres acheteurs.\n` +
          `2. ${victimName} paie ${amt(b1, 'BNB')} (monnaie native, « frais de gas ») puis ${amt(u1, 'USDT')} et ${amt(u2, 'USDT')} (jeton BEP-20) au compte ${A(w, s1)} sur BNB Smart Chain.\n` +
          `3. ${nOthers} autres victimes paient le même compte, selon le même schéma : ${nVictims} portefeuilles, ${amt(totalUsdt, 'USDT')} collectés.\n` +
          `4. Peu après le dernier paiement de la victime, l'escroc met ${amt(reserveV, 'USDT')} de côté sur un compte de réserve ${A(w, reserve)}, où ils sont toujours.\n` +
          `5. Il dépose ensuite ${amt(usdtDep, 'USDT')} puis ${amt(bnbDep, 'BNB')} sur l'adresse de dépôt ${destName} ${A(w, deposit)}, balayée ensuite vers le hot wallet de la plateforme.\n` +
          `6. Fausses pistes : ${nPoison} adresses sosies envoient au compte ${poisonTxt} (address poisoning) ; sur Ethereum, la même adresse n'a reçu qu'un petit montant d'ETH il y a longtemps (${ethOld.hash.slice(0, 10)}…) : même clé, autre registre.\n\n` +
          `À retenir : une adresse 0x ne dit pas sur quelle chaîne se trouvent les fonds. Identifiez toujours la chaîne (portefeuille de la victime, mention BEP-20/ERC-20, explorateur) avant de tracer. Ensuite, triez : un compte d'escroc reçoit ses propres fonds (approvisionnement en gas), ceux des victimes et du bruit (poussière, sosies), et il paie ses fournisseurs. Seuls les paiements des victimes forment le préjudice.\n\n` +
          `Réflexes de l'enquêteur : demander à Tether le gel des USDT du compte de réserve ; requérir ${destName} sur l'adresse de dépôt et sur les retraits du départ, avec demande de gel ; signaler l'adresse du vendeur du kit (piste vers d'autres escroqueries) ; noter que le même compte existe sur Ethereum ; signaler le faux site et la publicité à la plateforme qui l'a diffusée.`,
      },
      hints: [
        'Partez du portefeuille de la victime, déjà sur BNB Smart Chain : dépliez ses sorties.',
        'Le même texte d\'adresse peut correspondre à deux nœuds (Ethereum et BSC) : regardez la chaîne affichée dans le panneau de droite.',
        'Classez les transferts du compte de l\'escroc par date : avant la campagne (approvisionnement, achat du kit), pendant (victimes), après (réserve, exchange).',
        'Les montants infimes venant d\'adresses qui ressemblent au compte de l\'escroc sont des sosies : ni victimes, ni complices.',
      ],
    }
  },
}
