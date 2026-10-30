import { World, type Tx } from '../engine/world'
import { exchange, mixer, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { fromUsd } from '../engine/chains'
import type { Entity } from '../engine/entities'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeName, fmtDate, forwardAll, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const r4 = (v: number) => Math.round(v * 1e4) / 1e4

const COMPANIES = ['Clinique du Parc', 'Mairie de Saint-Aubin', 'Transports Leroy', 'Groupe Hexafor', 'Cabinet Morel Avocats', 'Plasturgie de l\'Ouest', 'Laboratoires Vidal-Garnier', 'Coopérative Agrinord', 'Logistique Rhône-Alpes', 'Hôtel Belvédère']

export const btcRansomwareRaas: ScenarioTemplate = {
  id: 'ransomware-raas',
  title: 'LockBit : anatomie d\'un RaaS',
  tagline: 'Une rançon, un partage affilié / opérateur, et le portefeuille qui relie toutes les attaques.',
  description:
    'Une entreprise française a payé une rançon au groupe LockBit, qui fonctionne en « Ransomware-as-a-Service ». Chaque rançon est partagée entre l\'affilié qui a mené l\'attaque et les opérateurs du rançongiciel. Retrouvez la clé de partage, le portefeuille des opérateurs, l\'ensemble des victimes et la sortie de l\'affilié.',
  difficulty: 4,
  chains: ['btc'],
  skills: ['ransomware', 'change', 'mixer', 'exchange_id', 'requisition', 'typologies'],
  estMinutes: 80,
  lessons: ['ransomware', 'utxo', 'change-heuristics', 'mixeurs', 'exchanges', 'requisitions', 'typologies'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const rssi = fakeName(r)

    const lf = w.entity('lockbit', { known: false })
    const affE: Entity[] = Array.from({ length: r.int(2, 3) }, (_, i) => w.customEntity({ name: `Affilié LockBit n°${i + 1}`, category: 'ransomware' }))
    const neb = mixer(w, 'sinbad', 'btc')
    const cv = exchange(w, 'coinhouse', 'btc')
    const brokers: ExchangeKit[] = [cv, exchange(w, 'swissborg', 'btc'), exchange(w, 'bitstamp', 'btc')]
    const xKey = r.pick(['huobex', 'okx', 'binance'] as const)
    const X = exchange(w, xKey, 'btc')
    const yKey = r.pick((['huobex', 'okx', 'binance'] as const).filter((k) => k !== xKey))
    const Y = exchange(w, yKey, 'btc')
    const garantex = exchange(w, 'garantex', 'btc')

    const opPct = r.pick([20, 25, 30] as const)
    const p = opPct / 100
    const operator = w.addr('btc', { entity: lf, kind: 'p2wpkh' })

    // ── Victimes (ordre chronologique) ───────────────────────────────────────
    const m = r.int(3, 5)
    const names = r.pickN(COMPANIES, m)
    const plaintIdx = r.int(0, m - 1)
    const times = Array.from({ length: m }, () => w.at(-r.float(5, 110) * 24)).sort((a, b) => a - b)
    for (let i = 1; i < m; i++) times[i] = Math.max(times[i], times[i - 1] + Math.round(r.float(2, 6) * DAY))
    interface Victim { name: string; ransomAddr: string; payments: Tx[]; paid: number; split: Tx; affAddr: string; aff: Entity; affShare: number; opShare: number }
    const victims: Victim[] = []
    const usedDemands = new Set<number>()
    for (let i = 0; i < m; i++) {
      const isPlaint = i === plaintIdx
      const aff = isPlaint ? affE[0] : affE[1 + ((i + r.int(0, 5)) % (affE.length - 1))]
      const ransomAddr = w.addr('btc', { entity: lf, kind: 'p2wpkh' })
      let usdDemand = r.int(60, 900) * 1000
      while (usedDemands.has(usdDemand)) usdDemand = r.int(60, 900) * 1000
      usedDemands.add(usdDemand)
      const ransom = r4(fromUsd('BTC', usdDemand))
      const broker = isPlaint ? cv : r.pick(brokers)
      const payments: Tx[] = []
      const t = times[i]
      if (isPlaint || r.chance(0.4)) {
        const test = r4(r.float(0.002, 0.01))
        payments.push(broker.withdraw(ransomAddr, test, t - r.float(3, 20) * HOUR))
        payments.push(broker.withdraw(ransomAddr, r4(ransom - test), t))
      } else payments.push(broker.withdraw(ransomAddr, ransom, t))
      const paid = w.unspentValue(ransomAddr)
      // Partage automatique : affilié / opérateurs
      const affAddr = w.addr('btc', { entity: aff, kind: r.pick(['p2wpkh', 'p2sh'] as const) })
      const fee = w.estimateFee('btc', payments.length, 2)
      const opShare = r8((paid - fee) * p)
      const affShare = r8(paid - fee - opShare)
      const split = w.utxoTx({ time: t + r.float(1, 6) * HOUR, from: [ransomAddr], to: [{ address: affAddr, value: affShare }, { address: operator, value: opShare }], fee, change: null, spendAll: true, method: 'partage RaaS' })
      victims.push({ name: names[i], ransomAddr, payments, paid, split, affAddr, aff, affShare, opShare })
    }
    const plaint = victims[plaintIdx]
    const totalPaid = r8(victims.reduce((s, v) => s + v.paid, 0))
    const lastSplit = Math.max(...victims.map((v) => v.split.time))

    // ── Blanchiment par l'affilié de la plaignante ───────────────────────────
    const a0 = affE[0]
    const h1 = w.addr('btc', { entity: a0 })
    const hop1 = forwardAll(w, plaint.affAddr, h1, plaint.split.time + r.float(10, 60) * HOUR)
    const h2 = w.addr('btc', { entity: a0, kind: w.get(h1).kind })
    const mixValue = r8(Math.floor(w.unspentValue(h1) * r.float(0.3, 0.45) * 1000) / 1000)
    const mixRes = neb.mix({ from: h1, value: mixValue, time: hop1.time + r.float(3, 30) * HOUR, recipients: [w.addr('btc', { entity: a0 }), w.addr('btc', { entity: a0 })], change: h2 })
    const h3 = w.addr('btc', { entity: a0, kind: w.get(h2).kind })
    const xValue = r8(Math.floor(w.unspentValue(h2) * r.float(0.82, 0.94) * 1000) / 1000)
    const xT = mixRes.depositTx.time + r.float(12, 60) * HOUR
    const xDeposit = X.newDeposit()
    const xTx = w.utxoTx({ time: xT, from: [h2], to: [{ address: xDeposit, value: xValue }], change: h3, spendAll: true })
    const xSweep = X.sweep([xDeposit], xT + r.float(1, 6) * HOUR)[0]

    // ── Autres affiliés ──────────────────────────────────────────────────────
    for (const v of victims) {
      if (v === plaint) continue
      const t = v.split.time + r.float(1, 5) * DAY
      if (v.aff === affE[1]) {
        const dep = Y.newDeposit()
        forwardAll(w, v.affAddr, dep, t)
        Y.sweep([dep], t + r.float(1, 8) * HOUR)
      } else {
        neb.mix({ from: v.affAddr, value: r8(w.unspentValue(v.affAddr) * 0.97), time: t, recipients: [w.addr('btc'), w.addr('btc'), w.addr('btc')] })
      }
    }

    // ── Opérateurs : sortie partielle vers un exchange sanctionné ───────────
    const opTotal = w.unspentValue(operator)
    const opRest = w.addr('btc', { entity: lf, kind: 'p2wpkh' })
    const gDeposit = garantex.newDeposit()
    const gValue = r8(Math.floor(opTotal * r.float(0.4, 0.6) * 1000) / 1000)
    const gTx = w.utxoTx({ time: lastSplit + r.float(2, 6) * DAY, from: [operator], to: [{ address: gDeposit, value: gValue }], change: opRest, spendAll: true })
    garantex.sweep([gDeposit], gTx.time + r.float(2, 12) * HOUR)

    // ── Bruit ────────────────────────────────────────────────────────────────
    X.noise(14, w.at(-10 * 24), w.at(20 * 24))
    Y.noise(8, w.at(-60 * 24), w.at(20 * 24))
    cv.noise(10, w.at(-60 * 24), w.at(10 * 24))
    garantex.noise(6, w.at(-30 * 24), w.at(20 * 24))

    const portalId = Array.from({ length: 16 }, () => '0123456789ABCDEF'[r.int(0, 15)]).join('')
    const plaintFinal = plaint.payments[plaint.payments.length - 1]
    const xName = X.entity.name
    const recapVictims = victims.map((v) => `   • ${v.name} — ${fmtDate(v.payments[v.payments.length - 1].time, false)} — ${amt(v.paid, 'BTC')}`).join('\n')

    return {
      world: w,
      title: `Rançongiciel LockBit — ${plaint.name}`,
      briefing:
        `${plaint.name} (${city}) a été victime du rançongiciel LockBit : serveurs chiffrés, données exfiltrées, menace de publication sur le site vitrine du groupe. Après négociation, la direction a payé la rançon en bitcoins achetés sur Coinhouse.\n\n` +
        `LockBit fonctionne en RaaS (Ransomware-as-a-Service) : des « affiliés » mènent les intrusions avec l'outil fourni par les opérateurs, et chaque rançon est automatiquement partagée entre l'affilié et les opérateurs selon une clé fixe.\n\n` +
        `Objectifs : déterminer la clé de partage, identifier l'adresse d'agrégation des opérateurs, recenser les autres victimes et le total des rançons, et suivre la part de l'affilié jusqu'à sa plateforme d'encaissement.`,
      evidence: [
        {
          id: 'rancon', type: 'rancon', title: 'Note de rançon (README_LOCKFANG.txt)', date: plaint.payments[0].time - r.float(5, 9) * DAY,
          body:
            `~~~ LockBit ~~~\n` +
            `Vos fichiers sont chiffrés et nous avons copié ${r.int(180, 900)} Go de vos données.\n` +
            `N'essayez pas de restaurer vous-mêmes, vous perdriez tout.\n\n` +
            `Connectez-vous à notre portail de négociation (Tor) avec l'identifiant : ${portalId}\n` +
            `Sans contact sous 72 heures, vos données seront publiées sur notre blog.\n` +
            `Paiement uniquement en Bitcoin, sur l'adresse unique communiquée dans le portail.`,
        },
        {
          id: 'chat', type: 'capture', title: 'Extrait du portail de négociation', date: plaintFinal.time - r.float(1, 3) * DAY, author: 'Support LockBit / négociateur de la victime',
          body:
            `LockBit : Votre prix est ${amt(r4(plaint.paid * r.float(1.6, 2.4)), 'BTC')}. C'est 1 % de votre chiffre d'affaires, nous avons lu vos bilans.\n` +
            `Victime : Nous ne pouvons pas payer ce montant. Nous proposons ${amt(r4(plaint.paid * 0.6), 'BTC')}.\n` +
            `LockBit : Notre partenaire qui s'occupe de votre dossier accepte ${amt(r4(plaint.paid), 'BTC')}, dernier mot. L'équipe ne descendra pas plus bas.\n` +
            `LockBit : Adresse de paiement (unique pour vous) : ${A(w, plaint.ransomAddr)}\n` +
            `LockBit : Envoyez d'abord un petit montant test si vous voulez.`,
        },
        {
          id: 'pv', type: 'pv', title: 'Audition du RSSI (extrait)', date: plaintFinal.time + 2 * DAY, author: rssi,
          body:
            `« Nous avons d'abord envoyé un paiement test, puis le solde le ${fmtDate(plaintFinal.time)}.\n` +
            `Transaction du solde : ${plaintFinal.hash}\n` +
            `Le déchiffreur fourni ensuite fonctionnait partiellement. »`,
        },
        {
          id: 'cert', type: 'note', title: 'Fiche menace CERT — LockBit', date: w.at(-120 * 24), author: 'CERT partenaire',
          body:
            `LockBit : RaaS actif depuis 2023. Programme d'affiliation : l'affilié reçoit la majorité de chaque rançon, l'équipe centrale une part fixe prélevée automatiquement à chaque paiement.\n` +
            `Adresses de rançon uniques par victime. Les affiliés utilisent fréquemment des mixeurs et des exchanges à KYC faible ; l'équipe centrale a été observée en lien avec des plateformes sanctionnées.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'number', points: 12, tolerance: 2, unit: '%',
          prompt: 'Quelle part (en %) de chaque rançon revient aux opérateurs de LockBit ?',
          answer: opPct,
          hint: 'Examinez la transaction qui dépense l\'adresse de rançon : deux sorties, dans un rapport constant d\'une victime à l\'autre.',
          explanation: `Chaque transaction de partage envoie ${opPct} % (après frais) aux opérateurs et ${100 - opPct} % à l'affilié. Pour ${plaint.name} : ${amt(plaint.opShare, 'BTC')} contre ${amt(plaint.affShare, 'BTC')}.`,
        },
        {
          id: 'o2', type: 'address', points: 14,
          prompt: 'Quelle est l\'adresse d\'agrégation des opérateurs ?',
          answer: [operator],
          hint: 'Quelle sortie du partage revient à la même adresse pour plusieurs victimes ?',
          explanation: `${A(w, operator)} reçoit la part « opérateurs » de ${m} transactions de partage. C'est le point commun de toutes les attaques, quel que soit l'affilié.`,
        },
        {
          id: 'o6', type: 'addresses', points: 12,
          prompt: 'Sélectionnez toutes les adresses de rançon (une par victime) dont la part « opérateurs » aboutit à cette adresse d\'agrégation, y compris celle de l\'entreprise plaignante.',
          answer: victims.map((v) => v.ransomAddr),
          hint: 'Chaque entrée de l\'adresse d\'agrégation est une transaction de partage ; l\'entrée de chacune de ces transactions est une adresse de rançon.',
          explanation: `${m} adresses de rançon, une par victime :\n${victims.map((v) => `   • ${A(w, v.ransomAddr)} — ${v.name}`).join('\n')}\nL'adresse unique par victime cloisonne les paiements, mais la transaction de partage les reconduit toutes vers la même adresse « opérateurs ». Chaque adresse de rançon permet ensuite de remonter au courtier qui a vendu les bitcoins à la victime, donc d'identifier et de contacter des victimes qui n'ont pas porté plainte.`,
        },
        {
          id: 'o3', type: 'amount', points: 12, unit: 'BTC', tolerance: 0.02,
          prompt: 'Montant total (en BTC) des rançons payées par l\'ensemble des victimes reliées à cette adresse ?',
          answer: totalPaid,
          hint: 'Remontez chaque partage jusqu\'à son adresse de rançon, et additionnez tous les paiements reçus (tests compris).',
          explanation: `${m} victimes :\n${recapVictims}\nTotal : ${amt(totalPaid, 'BTC')}.`,
        },
        {
          id: 'o7', type: 'number', points: 8, tolerance: 5, unit: 'minutes',
          prompt: 'Combien de minutes s\'écoulent entre le paiement du solde par l\'entreprise plaignante et la transaction de partage de sa rançon ?',
          answer: Math.round((plaint.split.time - plaintFinal.time) / 60),
          hint: 'Le RSSI donne l\'heure et le hash de la transaction du solde ; comparez avec l\'horodatage de la transaction qui dépense l\'adresse de rançon.',
          explanation: `Le solde est payé le ${fmtDate(plaintFinal.time)} et le partage intervient le ${fmtDate(plaint.split.time)}, soit ${Math.round((plaint.split.time - plaintFinal.time) / 60)} minutes plus tard. Le partage suit chaque paiement de quelques heures au plus, avec la même clé : c'est le comportement d'un panneau d'affiliation automatisé, pas d'une répartition manuelle. Ce délai court signifie aussi qu'une demande de gel visant l'adresse de rançon arrive presque toujours trop tard : on vise les points de sortie.`,
        },
        {
          id: 'o9', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.01,
          prompt: 'Après un premier saut, quel montant (en BTC) de la part de l\'affilié est envoyé dans un mixeur ?',
          answer: mixValue,
          hint: 'Suivez la part affilié du partage de la plaignante : un transfert intégral vers une adresse neuve, puis une transaction dont une sortie va vers une adresse de dépôt attribuée à un mixeur.',
          explanation: `${A(w, h1)} envoie ${amt(mixValue, 'BTC')} (montant arrondi au millième) vers une adresse de dépôt ${neb.entity.name}, soit ${Math.round((mixValue / plaint.affShare) * 100)} % de la part affilié. Le mixeur ne reçoit qu'une fraction des fonds : le reste ne passe pas par lui et se suit directement.`,
        },
        {
          id: 'o8', type: 'address', points: 10,
          prompt: 'Sur quelle adresse revient le reste de la part affilié lors de ce dépôt dans le mixeur (rendu) ?',
          answer: [h2],
          hint: 'La transaction de dépôt au mixeur a deux sorties : l\'une est attribuée au mixeur, l\'autre est une adresse neuve du même type que l\'adresse dépensée.',
          explanation: `${A(w, h2)} reçoit le rendu de la transaction de dépôt chez ${neb.entity.name} : même type d'adresse que ${A(w, h1).slice(0, 14)}…, montant non arrondi, et c'est elle qui alimente ensuite le dépôt sur l'exchange. Repérer ce rendu permet de « contourner » le mixeur : la majorité de la part affilié n'y est jamais entrée.`,
        },
        {
          id: 'o10', type: 'tx', points: 10,
          prompt: 'Quelle transaction dépose la part affilié sur sa plateforme d\'encaissement (hash à joindre à la réquisition) ?',
          answer: [xTx.id],
          hint: 'Suivez la dépense du rendu : la sortie principale va vers une adresse de dépôt, balayée ensuite vers le portefeuille chaud d\'un exchange.',
          explanation: `${xTx.hash.slice(0, 16)}… envoie ${amt(xValue, 'BTC')} depuis ${A(w, h2).slice(0, 14)}… vers l'adresse de dépôt ${A(w, xDeposit)} de ${xName}, le ${fmtDate(xTx.time)} ; le rendu part sur ${A(w, h3).slice(0, 14)}…. Le hash, l'adresse de dépôt, la date et le montant sont les quatre éléments qui permettent à la plateforme de retrouver le compte crédité sans ambiguïté.`,
        },
        {
          id: 'o4', type: 'entity', points: 12,
          prompt: 'Sur quelle plateforme l\'affilié ayant attaqué l\'entreprise plaignante a-t-il encaissé sa part ?',
          answer: [xKey],
          hint: 'Suivez la part affilié : un saut, un passage partiel par un mixeur, puis la grosse sortie.',
          explanation: `La part affilié (${amt(plaint.affShare, 'BTC')}) passe par ${A(w, h1).slice(0, 14)}…, envoie ${amt(mixValue, 'BTC')} dans ${neb.entity.name}, puis ${amt(xValue, 'BTC')} vers une adresse de dépôt ${xName}. Le passage par le mixeur ne concerne qu'une partie des fonds : le reste se suit directement.`,
        },
        {
          id: 'o11', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant (en BTC) les opérateurs ont-ils envoyé depuis leur adresse d\'agrégation vers une plateforme sanctionnée ?',
          answer: gValue,
          hint: 'Ouvrez la seule dépense de l\'adresse d\'agrégation : une sortie va vers une adresse de dépôt attribuée, l\'autre est le rendu.',
          explanation: `Après la dernière rançon, ${A(w, operator)} envoie ${amt(gValue, 'BTC')} vers une adresse de dépôt Garantex, exchange visé par des sanctions internationales ; le reste (${amt(r8(w.unspentValue(opRest)), 'BTC')}) dort sur ${A(w, opRest)}. Garantex ne répondra pas : cette exposition se documente et se signale (partenaires, TRACFIN), et l'adresse de rendu des opérateurs se place sous surveillance en vue d'une saisie si les fonds réapparaissent chez un prestataire coopératif.`,
        },
        {
          id: 'o5', type: 'choice', points: 10,
          prompt: 'Quelle suite donner en priorité ?',
          ...choice(r,
            'Requérir l\'exchange de l\'affilié et partager l\'adresse des opérateurs avec les partenaires',
            [
              'Requérir Garantex, plateforme qui a reçu une partie des fonds des opérateurs',
              'Clore le volet financier : le passage par un mixeur rend tout traçage impossible',
              'Demander à Sinbad l\'identité du client qui a mixé une partie de la part affilié',
            ]),
          hint: 'Parmi les services rencontrés, lesquels répondent aux réquisitions et lesquels non ? Et à qui l\'adresse des opérateurs est-elle utile ?',
          explanation: `L'exchange de l'affilié (${xName}) est la seule porte d'identification réaliste : identité, IP, gel. ${procedureFor(X.entity)} L'adresse des opérateurs relie toutes les attaques : c'est un renseignement précieux pour les partenaires (Europol, CERT-FR, autres services saisis) et pour rapprocher les procédures. Garantex, sanctionnée, ne coopère pas : l'exposition doit être documentée et signalée. Un mixeur ne répond pas aux réquisitions, et le mixage partiel n'empêche pas de suivre le reste.`,
        },
      ],
      truth: {
        path: [...victims.flatMap((v) => [...v.payments.map((x) => x.id), v.split.id]), hop1.id, mixRes.depositTx.id, xTx.id, xSweep.id, gTx.id],
        addresses: [operator, ...victims.map((v) => v.ransomAddr), plaint.affAddr, h1, h2, h3, xDeposit, mixRes.deposit, opRest],
        debrief:
          `1. ${plaint.name} paie ${amt(plaint.paid, 'BTC')} (test compris) sur l'adresse unique ${A(w, plaint.ransomAddr)}.\n` +
          `2. ${Math.round((plaint.split.time - plaintFinal.time) / 60)} minutes après le solde, une transaction de partage envoie ${100 - opPct} % à l'affilié et ${opPct} % à ${A(w, operator)}.\n` +
          `3. Cette adresse reçoit la part opérateurs de ${m} rançons :\n${recapVictims}\n   Total : ${amt(totalPaid, 'BTC')}.\n` +
          `4. L'affilié ayant attaqué ${plaint.name} fait un saut, mixe ${amt(mixValue, 'BTC')} chez ${neb.entity.name} (rendu sur ${A(w, h2)}), puis dépose ${amt(xValue, 'BTC')} chez ${xName} (${xTx.hash.slice(0, 12)}…).\n` +
          `5. Les opérateurs envoient ${amt(gValue, 'BTC')} vers Garantex (exchange sanctionné) et conservent le reste sur ${A(w, opRest)}.\n\n` +
          `Leçon : dans un RaaS, la transaction de partage est la signature du modèle économique. Le rapport constant entre les deux sorties révèle la clé de partage, et l'adresse qui reçoit la « petite » part à chaque attaque désigne l'équipe centrale. Elle permet de relier des victimes qui n'ont jamais porté plainte ensemble et de mesurer l'ampleur de l'activité. Côté identification, on cible la sortie de l'affilié vers un exchange coopératif, en suivant le rendu plutôt que la fraction mixée.`,
      },
      hints: [
        'L\'adresse de rançon figure dans l\'extrait du portail de négociation.',
        'La transaction qui dépense l\'adresse de rançon n\'a que deux sorties : calculez leur rapport.',
        'Dépliez les entrées de l\'adresse qui reçoit la plus petite part : chaque entrée est une autre victime.',
        'Pour l\'affilié, suivez la grosse sortie à chaque saut ; le mixeur ne reçoit qu\'une partie.',
        'Les opérateurs ne dépensent leur adresse d\'agrégation qu\'une fois : une sortie vers un service, un rendu.',
      ],
    }
  },
}
