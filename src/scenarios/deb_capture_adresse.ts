import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { EUR_USD, fromUsd, usd } from '../engine/chains'
import { genAddress } from '../engine/addressgen'
import { dusting } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fmtDate, receivedIn } from './util'

// Seul indice : une capture d'écran d'application mobile où l'adresse de
// destination est tronquée (début…fin). L'enquêteur retrouve l'adresse complète
// avec la recherche (fragment de 4 caractères minimum) ou par le montant et
// l'heure, en écartant deux adresses qui ne partagent que le début ou la fin.
// L'adresse du faux conseiller sert depuis des semaines : autres victimes
// (versements ronds en euros), cartes cadeaux, numéros virtuels, poussière. Il
// faut suivre la pièce précise de la victime (l'UTXO) : elle part en cartes
// cadeaux chez CardHub, en deux commandes (la seconde payée avec le rendu).
// Fin d'affaire : un commerçant, pas un exchange.

const PRE = 8
const SUF = 5
const r5 = (v: number) => Math.round(v * 1e5) / 1e5
const eur = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const btcOfEur = (e: number) => r5(fromUsd('BTC', e * EUR_USD))
const eurOfBtc = (v: number) => usd('BTC', v) / EUR_USD

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

export const debCaptureAdresse: ScenarioTemplate = {
  id: 'deb-capture-adresse',
  title: 'L\'adresse tronquée',
  tagline: 'Une capture d\'écran, une adresse coupée en deux, et des bitcoins changés en cartes cadeaux.',
  description:
    'Le téléphone de la victime a été réinitialisé : il ne reste qu\'une capture d\'écran de son paiement, sur laquelle l\'application n\'affiche que le début et la fin de l\'adresse de destination. Retrouvez l\'adresse complète sans rien deviner, en écartant les leurres, remontez au portefeuille de la victime, puis triez l\'historique chargé du faux conseiller pour suivre la pièce précise de la victime jusqu\'à des achats de cartes cadeaux.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'change', 'osint', 'requisition'],
  estMinutes: 35,
  lessons: ['explorateur-blocs', 'premiers-reflexes', 'bases-blockchain', 'utxo'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    // L'enfant de la victime : genre tiré à part, même nom de famille
    const relP = fakePerson(r)
    const relative = { ...relP, name: `${relP.name.split(' ')[0]} ${victimName.split(' ').slice(1).join(' ')}` }
    const city = fakeCity(r)
    const advisor = r.pick(['Thomas', 'Alexandre', 'Nicolas', 'Maxime', 'Sébastien', 'David'])

    const cv = exchange(w, 'coinhouse', 'btc')
    const cardhub = w.entity('cardhub')
    const chHot = w.addr('btc', { entity: cardhub, label: 'CardHub — Portefeuille de règlement', tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const newInvoice = () => w.addr('btc', { entity: cardhub, label: 'CardHub — Facture', tags: ['invoice'] })
    // Règlement : CardHub regroupe les factures payées (les nôtres et celles d'autres clients) vers son portefeuille.
    const settle = (invs: string[], t: number): Tx => {
      const others = Array.from({ length: r.int(2, 4) }, () => {
        const inv = newInvoice()
        w.fund(inv, btcOfEur(r.int(2, 30) * 25), t - r.int(1, 20) * HOUR)
        return inv
      })
      const all = r.shuffle([...invs, ...others])
      const total = all.reduce((s, a) => s + w.unspentValue(a, t), 0)
      const fee = w.estimateFee('btc', all.length, 1)
      return w.utxoTx({ time: t, from: all, to: [{ address: chHot, value: total - fee }], fee, change: null, spendAll: true, tags: ['sweep'], method: 'consolidation' })
    }

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const suspect = w.customEntity({ name: 'Faux conseiller en placement (inconnu)', category: 'suspect' })
    const victim = w.addr('btc', { entity: victimE, kind: 'p2wpkh' })
    const s1 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const suspectAddr = () => w.addr('btc', { entity: suspect, kind: 'p2wpkh', wallet: w.get(s1).wallet })
    const full = A(w, s1)
    const pre = full.slice(0, PRE)
    const suf = full.slice(-SUF)

    // Leurres : même début (fin différente) et même fin (début différent)
    let dp = pre + genAddress(r, 'btc', 'p2wpkh').slice(PRE)
    while (dp.slice(-SUF) === suf || dp === full) dp = pre + genAddress(r, 'btc', 'p2wpkh').slice(PRE)
    let ds = genAddress(r, 'btc', 'p2wpkh').slice(0, -SUF) + suf
    while (ds.slice(0, PRE) === pre || ds === full) ds = genAddress(r, 'btc', 'p2wpkh').slice(0, -SUF) + suf
    const decoyP = w.addr('btc', { addr: dp, kind: 'p2wpkh' })
    const decoyS = w.addr('btc', { addr: ds, kind: 'p2wpkh' })

    // ── Paiement de la victime ──────────────────────────────────────────────
    const priceEur = r.int(15, 60) * 100
    const value = btcOfEur(priceEur)
    const T0 = w.at(0)
    // Achat la veille, en journée
    const buyTx = cv.withdraw(victim, r5(value + r.float(0.002, 0.012)), sameDayAt(T0 - DAY, r.int(9, 19), r.int(0, 59)))
    const pay = w.utxoTx({ time: T0, from: [victim], to: [{ address: s1, value }] })

    // ── La pièce de la victime part en cartes cadeaux (deux commandes) ─────
    // Construit avant l'habillage : la première commande ne dépense que l'UTXO de la victime.
    const inv1 = newInvoice()
    const card1Eur = Math.floor((priceEur * r.float(0.55, 0.7)) / 50) * 50
    const btc1 = btcOfEur(card1Eur)
    const c1 = suspectAddr()
    const buy1 = w.utxoTx({ time: T0 + Math.round(r.float(3, 9) * HOUR), from: [s1], to: [{ address: inv1, value: btc1 }], change: c1 })
    const c1Value = receivedIn(w, buy1, c1)
    const sweep1 = settle([inv1], buy1.time + Math.round(r.float(0.5, 4) * HOUR))
    const inv2 = newInvoice()
    const card2Eur = Math.floor((eurOfBtc(c1Value) * r.float(0.88, 0.95)) / 50) * 50
    const btc2 = btcOfEur(card2Eur)
    const c2 = suspectAddr()
    const buy2 = w.utxoTx({ time: buy1.time + Math.round(r.float(20, 40) * HOUR), from: [c1], to: [{ address: inv2, value: btc2 }], change: c2 })
    const sweep2 = settle([inv2], buy2.time + Math.round(r.float(0.5, 4) * HOUR))
    const leftover = receivedIn(w, buy2, c2)

    // Leurres de recherche, datés et chiffrés différemment
    cv.withdraw(decoyP, r5(value * r.pick([r.float(0.45, 0.7), r.float(1.3, 1.6)])), T0 + Math.round(r.float(2, 6) * HOUR) * (r.chance(0.5) ? 1 : -1))
    w.fund(decoyS, r5(value * r.float(1.03, 1.08)), T0 + Math.round(r.float(2, 5) * DAY) * (r.chance(0.5) ? 1 : -1))

    // ── Habillage de l'adresse du faux conseiller ────────────────────────────
    // Autres victimes : versements ronds en euros, trois avant, une après.
    const otherVictim = (t: number) => {
      const e = r.int(8, 40) * 100
      const v = btcOfEur(e)
      const src = w.addr('btc', { kind: r.pick(['p2wpkh', 'p2sh', 'p2pkh'] as const) })
      w.fund(src, v * r.float(1.02, 1.3), t - Math.round(r.float(3, 40) * HOUR))
      return { tx: w.utxoTx({ time: t, from: [src], to: [{ address: s1, value: v }] }), eur: e, value: v }
    }
    const pv1 = otherVictim(T0 - Math.round(r.float(20, 26) * DAY))
    const pv2 = otherVictim(T0 - Math.round(r.float(12, 16) * DAY))
    const pv3 = otherVictim(T0 - Math.round(r.float(3, 7) * DAY))
    const after = otherVictim(T0 + Math.round(r.float(26, 44) * HOUR))
    // Dépenses antérieures du conseiller : une commande de cartes cadeaux, des numéros de téléphone virtuels (pour appeler les victimes).
    const inv0 = newInvoice()
    const buy0 = w.utxoTx({ time: pv1.tx.time + Math.round(r.float(2, 4) * DAY), from: [s1], to: [{ address: inv0, value: btcOfEur(Math.floor((pv1.eur * r.float(0.6, 0.85)) / 50) * 50) }], change: suspectAddr(), autoFund: false })
    settle([inv0], buy0.time + Math.round(r.float(1, 5) * HOUR))
    const voipE = w.customEntity({
      name: 'NumiCall (fictif)', category: 'merchant', risk: 'medium', known: true, country: 'Estonie',
      description: 'Revendeur de numéros de téléphone virtuels et de crédit d\'appels VoIP, payable en bitcoin (fictif).',
      compliance: { contact: 'Service juridique de NumiCall', cooperation: 'eio', responseDays: [20, 90], canFreeze: false, kyc: 'faible', notes: 'Conserve l\'adresse e-mail du compte, les numéros attribués, les journaux d\'appels et les adresses IP de connexion.' },
    })
    const voip = w.addr('btc', { entity: voipE, label: 'NumiCall — Paiement' })
    const voipEur = r.pick([12, 20, 35, 50])
    const vpnTx = w.utxoTx({ time: pv2.tx.time + Math.round(r.float(1, 3) * DAY), from: [s1], to: [{ address: voip, value: btcOfEur(voipEur) }], change: suspectAddr(), autoFund: false })
    // Poussière (546 sats) reçue la veille des faits, jamais dépensée.
    const dust = dusting(w, s1, { time: T0 - 22 * HOUR, n: 1, spreadH: 6 })
    // Après les faits : l'argent de l'autre victime part lui aussi chez CardHub.
    const inv3 = newInvoice()
    const buy3 = w.utxoTx({ time: after.tx.time + Math.round(r.float(30, 60) * HOUR), from: [s1], to: [{ address: inv3, value: btcOfEur(Math.floor((after.eur * r.float(0.6, 0.85)) / 50) * 50) }], change: suspectAddr(), autoFund: false })
    settle([inv3], buy3.time + Math.round(r.float(1, 5) * HOUR))

    // ── Bruit de fond ────────────────────────────────────────────────────────
    cv.noise(12, w.at(-6 * 24), w.at(6 * 24))
    for (let i = 0; i < 5; i++) {
      const inv = newInvoice()
      const t = w.at(r.float(-20 * 24, 8 * 24))
      w.fund(inv, btcOfEur(r.int(2, 40) * 25), t)
      settle([inv], t + Math.round(r.float(1, 6) * HOUR))
    }

    const shown = `${pre}…${suf}`
    const valueEur = eurOfBtc(value)
    const child = relP.g('son fils', 'sa fille')
    const myChild = relP.g('mon fils', 'ma fille')
    const docT = office(buy2.time + DAY)
    const nOtherPays = 4
    const totalCardhub = r5(btc1 + btc2)
    const buy0Eur = Math.round(eurOfBtc(buy0.outputs.find((o) => o.address === inv0)!.value) / 50) * 50

    return {
      world: w,
      title: `L'adresse tronquée — ${city}`,
      briefing:
        `${victimName}, ${r.int(68, 82)} ans, demeurant à ${city}, dépose plainte pour escroquerie. Un « conseiller en placement », « ${advisor} », lui a fait installer un logiciel de prise en main à distance, puis une application de portefeuille bitcoin, et lui a fait acheter des bitcoins pour un « placement garanti ». ${g('Il', 'Elle')} a validé un envoi depuis son téléphone.\n\n` +
        `Depuis, le téléphone a été réinitialisé par un réparateur. Il ne reste qu'une capture d'écran du paiement, envoyée à ${child}. Comme beaucoup d'applications, le portefeuille n'y affiche que le début et la fin de l'adresse de destination.\n\n` +
        `Votre mission : retrouver l'adresse complète sans rien deviner, en écartant les fausses pistes ; remonter au portefeuille de la victime et à sa plateforme d'achat ; puis, dans l'historique chargé de l'adresse du conseiller, suivre précisément les bitcoins de la victime jusqu'à leur destination. Aucune adresse n'est épinglée au départ : la recherche (Ctrl K) accepte un fragment d'adresse.`,
      evidence: [
        {
          id: 'capture', type: 'capture', title: 'Capture d\'écran du paiement (application mobile)', date: T0, author: relative.name,
          body:
            `✓ Envoyé\n` +
            `−${amt(value, 'BTC')}\n` +
            `≈ ${eur(valueEur)}\n\n` +
            `À : ${shown}\n` +
            `Date : ${fmtDate(pay.time)}\n` +
            `Frais réseau : ${amt(pay.fee, 'BTC')}\n` +
            `Statut : Confirmé`,
        },
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: docT, author: victimName,
          body:
            `« Le conseiller voyait mon écran. Il m'a dit de coller l'adresse qu'il m'avait envoyée par message et de valider. Il m'a promis que mon placement de ${priceEur.toLocaleString('fr-FR')} € rapporterait 8 % par mois. Ses messages ont disparu avec la réinitialisation du téléphone.\n\n` +
            `Je ne connais pas l'adresse de mon portefeuille. J'avais fait une capture pour la montrer à ${myChild}, c'est tout ce qui me reste. »`,
        },
        {
          id: 'audition', type: 'pv', title: `Procès-verbal d'audition — ${relative.name}`, date: office(docT + DAY), author: 'Enquêteur',
          body:
            `${relative.name}, ${relP.g('fils', 'fille')} ${g('du plaignant', 'de la plaignante')}, déclare :\n\n` +
            `« ${g('Mon père', 'Ma mère')} m'a envoyé la capture par messagerie le jour même, quelques minutes après l'envoi. Son téléphone était réglé à l'heure de Paris.\n` +
            `${g('Il', 'Elle')} m'a dit avoir acheté les bitcoins peu avant, sur une plateforme française, avec sa carte bancaire, sur les conseils du "conseiller". ${g('Il', 'Elle')} ne se souvient plus du nom.\n` +
            `Je n'ai jamais eu l'adresse complète. »`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe', date: office(docT + 2 * HOUR), author: 'Chef de groupe',
          body:
            `Interdiction de « compléter » l'adresse de mémoire ou au hasard.\n` +
            `Plusieurs adresses du périmètre peuvent commencer ou finir pareil : on ne retient que celle qui correspond aux deux extrémités ET à la transaction de la capture (montant, date). Les autres sont à documenter comme écartées.\n\n` +
            `Ensuite : l'adresse retrouvée a sans doute servi à d'autres. On ne suit pas « l'adresse », on suit la pièce de la victime : quelle transaction dépense précisément son paiement ?`,
        },
        {
          id: 'osint', type: 'osint', title: 'Fiche de la cellule d\'appui — CardHub', date: office(docT + DAY + 2 * HOUR), author: 'Cellule d\'appui',
          body:
            `CardHub (site de vente de cartes cadeaux contre crypto-actifs) : chaque commande génère une adresse de paiement unique (« facture »), regroupée ensuite avec les autres commandes vers le portefeuille de règlement du site.\n` +
            `Le client reçoit des codes de cartes cadeaux d'enseignes grand public, utilisables en ligne ou en magasin. Le site conserve l'adresse e-mail de la commande, l'adresse IP, l'enseigne et les numéros des cartes émises.\n\n` +
            `Plusieurs signalements de la plateforme de signalement en ligne évoquent un « conseiller ${advisor} » et des virements de montants ronds (1 000 €, 2 500 €…) convertis en bitcoins.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse complète vers laquelle la victime a payé ?',
          answer: [s1],
          hint: 'Tapez dans la recherche les caractères visibles du début (au moins 4), puis ceux de la fin. Comparez les résultats et ouvrez la transaction entrante de chaque candidate.',
          explanation: `${full} est la seule adresse qui commence par ${pre} ET finit par ${suf}, et elle reçoit exactement ${amt(value, 'BTC')} le ${fmtDate(pay.time)}. Deux autres adresses du périmètre ne partagent qu'une extrémité.`,
        },
        {
          id: 'o5', type: 'addresses', points: 10,
          prompt: 'Quelles adresses du périmètre ne partagent qu\'une extrémité avec la capture et doivent être écartées ?',
          answer: [decoyP, decoyS],
          hint: 'Les recherches sur le début et sur la fin renvoient chacune plusieurs résultats : retenez ceux qui n\'apparaissent que dans une seule des deux listes.',
          explanation: `${A(w, decoyP)} a le même début (${pre}) mais une autre fin, et reçoit un montant différent à une autre heure. ${A(w, decoyS)} a la même fin (${suf}) mais un autre début, et reçoit des fonds un autre jour. Les consigner comme écartées, avec la raison, protège la procédure : on montre que l'adresse retenue n'a pas été choisie au hasard parmi plusieurs candidates.`,
        },
        {
          id: 'o6', type: 'address', points: 9,
          prompt: 'La victime ignore l\'adresse de son propre portefeuille. Laquelle est-ce ?',
          answer: [victim],
          hint: 'Ouvrez la transaction de paiement retrouvée : l\'adresse dépensée en entrée appartient au portefeuille de la victime.',
          explanation: `${A(w, victim)} est l'unique entrée de la transaction de paiement : c'est l'adresse du portefeuille ${de(victimName)}, qui avait reçu ses bitcoins la veille (${fmtDate(buyTx.time)}). L'autre sortie de la transaction (hors paiement) est son rendu, une adresse neuve du même portefeuille. Connaître l'adresse de la victime permet de remonter à son achat et de vérifier qu'elle n'a pas fait d'autres paiements.`,
        },
        {
          id: 'o12', type: 'number', points: 9, tolerance: 0, unit: 'versements',
          prompt: 'En dehors du paiement de la victime et de la poussière, combien d\'autres versements l\'adresse du conseiller a-t-elle reçus ?',
          answer: nOtherPays,
          hint: 'Listez toutes les transactions entrantes de l\'adresse retrouvée. Une entrée de 546 satoshis n\'est que de la poussière : elle ne compte pas.',
          explanation: `${nOtherPays} versements : trois avant les faits (environ ${pv1.eur.toLocaleString('fr-FR')} €, ${pv2.eur.toLocaleString('fr-FR')} € et ${pv3.eur.toLocaleString('fr-FR')} €, les ${fmtDate(pv1.tx.time, false)}, ${fmtDate(pv2.tx.time, false)} et ${fmtDate(pv3.tx.time, false)}) et un après (environ ${after.eur.toLocaleString('fr-FR')} €, le ${fmtDate(after.tx.time, false)}). Des montants ronds en euros, comme les « placements » des signalements : autant de victimes probables à identifier en remontant leurs adresses. L'entrée de 546 satoshis (${dust.txs[0].hash.slice(0, 10)}…) est une poussière envoyée par un tiers : elle ne dit rien du conseiller.`,
        },
        {
          id: 'o13', type: 'tx', points: 10,
          prompt: 'Quelle transaction dépense précisément les bitcoins versés par la victime ?',
          answer: [buy1.id],
          hint: 'L\'adresse a plusieurs transactions sortantes. Ouvrez-les une à une : laquelle prend en entrée la sortie créée par le paiement de la capture ?',
          explanation: `${buy1.hash.slice(0, 16)}… (${fmtDate(buy1.time)}), ${dur(buy1.time - pay.time)} après le paiement : son unique entrée est la sortie de ${amt(value, 'BTC')} créée par la transaction de la victime. Les autres sorties de l'adresse dépensent d'autres pièces : la commande du ${fmtDate(buy0.time, false)} et le paiement à NumiCall (numéros virtuels) du ${fmtDate(vpnTx.time, false)} sont antérieurs aux faits, et la commande du ${fmtDate(buy3.time, false)} dépense l'argent d'une autre victime. En Bitcoin, on ne suit pas une adresse « en vrac » : on suit la pièce (l'UTXO) d'entrée en sortie.`,
        },
        {
          id: 'o2', type: 'entity', points: 9,
          prompt: 'Chez quel prestataire les bitcoins de la victime ont-ils été dépensés ?',
          answer: ['cardhub'],
          hint: 'Dans la transaction qui dépense la pièce de la victime, une sortie part vers une adresse étiquetée « Facture », ensuite regroupée vers un portefeuille de règlement.',
          explanation: `La sortie principale de ${buy1.hash.slice(0, 12)}… va vers ${A(w, inv1)}, une adresse de facture CardHub, regroupée ensuite avec d'autres commandes vers le portefeuille de règlement du site. Le conseiller n'encaisse pas sur un exchange : il change les bitcoins en cartes cadeaux, revendues ou utilisées en magasin. Ce n'est pas un exchange régulé : CardHub (fictif) n'a pas de fiche de coopération connue, il faut identifier son siège et son prestataire pour choisir la voie (réquisition, décision d'enquête européenne ou entraide).`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.01,
          prompt: 'Combien de BTC la première commande a-t-elle payés à CardHub ?',
          answer: btc1,
          hint: 'Dans la transaction qui dépense la pièce de la victime, ne retenez que la sortie vers la facture CardHub ; l\'autre sortie est le rendu.',
          explanation: `${amt(btc1, 'BTC')}, soit ${card1Eur.toLocaleString('fr-FR')} € de cartes cadeaux au cours du jour. Le reste de la pièce de la victime, moins les frais, part en rendu.`,
        },
        {
          id: 'o10', type: 'address', points: 9,
          prompt: 'Dans cette transaction, quelle sortie est le rendu du conseiller ?',
          answer: [c1],
          hint: 'Des deux sorties, l\'une va vers la facture CardHub ; l\'autre, de même type que l\'entrée et au montant non rond, est une adresse neuve.',
          explanation: `${A(w, c1)} reçoit ${amt(c1Value, 'BTC')} : même format bc1q… que l'entrée, montant quelconque, adresse neuve et non étiquetée. C'est le rendu, qui reste au conseiller. Ne vous arrêtez pas là : un rendu se suit comme le reste.`,
        },
        {
          id: 'o14', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.01,
          prompt: 'Au total, combien de BTC issus du paiement de la victime ont été versés à CardHub ?',
          answer: totalCardhub,
          hint: 'Suivez le rendu : il paie une seconde facture CardHub dans les deux jours qui suivent. Additionnez les deux factures, sans les rendus.',
          explanation: `${amt(btc1, 'BTC')} (première commande) + ${amt(btc2, 'BTC')} (seconde commande, payée le ${fmtDate(buy2.time)} avec le rendu ${A(w, c1).slice(0, 12)}…) = ${amt(totalCardhub, 'BTC')}, soit environ ${(card1Eur + card2Eur).toLocaleString('fr-FR')} € de cartes cadeaux. Il ne reste au conseiller que ${amt(leftover, 'BTC')} sur un dernier rendu. Ne comptez pas la commande du ${fmtDate(buy3.time, false)} (environ ${Math.round(eurOfBtc(buy3.outputs.find((o) => o.address === inv3)!.value)).toLocaleString('fr-FR')} €) ni celle d'avant les faits (environ ${buy0Eur.toLocaleString('fr-FR')} €) : elles dépensent d'autres pièces.`,
        },
        {
          id: 'o7', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme la victime a-t-elle acheté ses bitcoins ?',
          answer: ['coinhouse'],
          hint: 'Dépliez les entrées de l\'adresse de la victime : elle a été alimentée par une adresse étiquetée.',
          explanation: `Le ${fmtDate(buyTx.time)}, l'adresse de la victime reçoit des bitcoins du hot wallet de Coinhouse : c'est son retrait après achat, conforme à l'audition (« une plateforme française »). Une réquisition à Coinhouse confirmera l'achat (date, montant payé par carte, adresse de retrait) et documentera le préjudice.`,
        },
        {
          id: 'o15', type: 'choice', points: 8,
          prompt: 'Que faut-il demander en priorité au vendeur de cartes cadeaux ?',
          hint: 'Que sait un commerçant d\'une commande payée en bitcoins ? Que deviennent des cartes cadeaux ?',
          ...choice(r,
            'Le détail des deux commandes (e-mail, IP, enseignes et numéros des cartes) pour remonter au compte qui les a utilisées',
            [
              'Le gel des bitcoins de la victime, que le vendeur conserve pour le compte du conseiller',
              'L\'annulation des deux transactions Bitcoin, puisque le vendeur en est le destinataire',
              'Rien : un commerçant qui accepte le bitcoin n\'enregistre aucune donnée sur ses clients',
            ]),
          explanation: `CardHub a été payé : les bitcoins sont les siens, il n'a rien à « geler » pour le compte du conseiller et une transaction confirmée ne s'annule pas. En revanche, il connaît chaque commande : adresse e-mail, IP, horodatage, enseigne et numéros des cartes émises. Ces numéros mènent à l'enseigne, qui sait où et par quel compte les cartes ont été utilisées (achat en ligne livré à une adresse, utilisation en magasin filmée). Les factures ${A(w, inv1).slice(0, 12)}… et ${A(w, inv2).slice(0, 12)}…, avec les hash et montants, désignent les deux commandes sans ambiguïté.`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Pourquoi ne faut-il jamais recopier une adresse à la main ni la compléter d\'après une capture ?',
          hint: 'Pensez aux leurres que vous venez d\'écarter.',
          ...choice(r,
            'Une erreur ou un caractère deviné peut désigner l\'adresse d\'un tiers : on copie-colle et on vérifie',
            [
              'Les adresses changent de forme chaque jour : une copie manuelle serait déjà périmée au moment de la réquisition',
              'La recopie manuelle d\'une adresse est interdite par le code de procédure pénale',
              'Les explorateurs de blocs refusent les adresses tapées au clavier, par sécurité',
            ]),
          explanation: 'Une adresse désigne un compte précis : un caractère faux ou deviné peut pointer vers une autre personne, et une réquisition visant la mauvaise adresse ferait interroger un innocent. Les formats récents (bc1…) intègrent une somme de contrôle qui détecte la plupart des fautes de frappe, mais pas un « complément » plausible, et certains formats n\'en ont pas. De nombreuses adresses partagent le même début ou la même fin (c\'est le ressort de l\'address poisoning). Méthode : copier-coller depuis la source, vérifier début, milieu et fin, et rattacher l\'adresse à une transaction (montant, date).',
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Avant de rapprocher l\'heure de la capture de celle d\'une transaction, que faut-il vérifier ?',
          hint: 'Le téléphone, l\'explorateur et l\'outil d\'analyse n\'affichent pas forcément l\'heure de la même façon.',
          ...choice(r,
            'Le fuseau horaire de chaque source (téléphone, explorateur, outil), pour comparer des heures exprimées de la même façon',
            [
              'Rien : l\'heure d\'une transaction est la même partout, quel que soit l\'affichage',
              'Seulement le montant : l\'heure affichée par une application mobile n\'a aucune valeur probante',
              'Le numéro de bloc : la capture doit l\'indiquer, sinon elle est inexploitable',
            ]),
          explanation: `Une blockchain horodate les blocs en temps universel ; chaque application convertit ensuite selon ses réglages. Le téléphone était réglé à l'heure de Paris (une ou deux heures d'écart avec l'UTC selon la saison) : sans cette précaution, on peut écarter la bonne transaction ou retenir un leurre. On note dans le procès-verbal le fuseau de chaque source, et l'on croise toujours l'heure avec le montant (${amt(value, 'BTC')}) et les extrémités de l'adresse.`,
        },
      ],
      truth: {
        path: [pay.id, buy1.id, sweep1.id, buy2.id, sweep2.id],
        addresses: [s1, victim, c1, inv1, inv2, c2],
        debrief:
          `1. La capture ne montre que ${shown}. La recherche sur le début (${pre}) fait aussi apparaître ${A(w, decoyP)} ; celle sur la fin (${suf}) fait apparaître ${A(w, decoyS)}. Une seule adresse figure dans les deux listes : ${full}.\n` +
          `2. Contrôle croisé : cette adresse reçoit ${amt(value, 'BTC')} le ${fmtDate(pay.time)}, exactement comme sur la capture (heure de Paris). Les deux leurres ont des montants et des dates différents.\n` +
          `3. L'entrée de la transaction de paiement est l'adresse de la victime, ${A(w, victim)}, alimentée peu avant par un retrait Coinhouse : c'est son achat.\n` +
          `4. L'adresse du conseiller sert depuis des semaines : ${nOtherPays} autres versements ronds en euros (trois avant, un après), une commande CardHub et un achat de numéros de téléphone virtuels chez NumiCall (environ ${voipEur} €) antérieurs aux faits, une poussière de 546 satoshis.\n` +
          `5. La pièce de la victime est dépensée ${dur(buy1.time - pay.time)} plus tard (${buy1.hash.slice(0, 12)}…) : ${amt(btc1, 'BTC')} vers une facture CardHub, ${amt(c1Value, 'BTC')} en rendu sur ${A(w, c1)}. ${later(buy1.time, buy2.time).replace(/^l/, 'L')}, ce rendu paie une seconde facture CardHub (${amt(btc2, 'BTC')}) ; il ne reste que ${amt(leftover, 'BTC')} sur ${A(w, c2)}.\n` +
          `6. Après les faits, une autre commande CardHub (le ${fmtDate(buy3.time, false)}) dépense une autre pièce de l'adresse, l'argent d'une autre victime : même habitude, autre argent.\n\n` +
          `À retenir : une adresse tronquée n'est pas une adresse. On la retrouve par recoupement (début + fin + montant + date, dans le bon fuseau horaire), jamais par déduction, et l'on documente les candidates écartées. Sur une adresse chargée, on suit la pièce de la victime, d'entrée en sortie, rendu compris. Et la fin d'un flux n'est pas toujours un exchange : ici, un vendeur de cartes cadeaux.\n\n` +
          `Réflexes de l'enquêteur : requérir CardHub sur les deux factures (e-mail, IP, cartes émises) puis les enseignes concernées ; requérir Coinhouse, qui connaît l'achat de la victime ; requérir NumiCall (décision d'enquête européenne) sur le compte qui a acheté des numéros virtuels, peut-être ceux qui ont servi à appeler les victimes ; rechercher les autres victimes à partir des quatre versements ; rapprocher les signalements visant « ${advisor} » ; conserver la capture originale (fichier, métadonnées) comme pièce.`,
      },
      hints: [
        'Ouvrez la recherche (Ctrl K) et collez les caractères visibles au début de l\'adresse (au moins 4).',
        'Plusieurs adresses peuvent commencer ou finir pareil : recherchez aussi la fin, puis vérifiez montant et date de la transaction entrante.',
        'L\'adresse retrouvée a beaucoup d\'historique : pour suivre la victime, ouvrez la transaction qui dépense la sortie créée par son paiement.',
        'Les adresses étiquetées « CardHub — Facture » sont des commandes de cartes cadeaux. Le rendu de la première commande en paie une seconde.',
      ],
    }
  },
}
