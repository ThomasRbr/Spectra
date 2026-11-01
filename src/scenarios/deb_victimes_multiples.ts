import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { dusting } from '../engine/realism'
import type { ScenarioTemplate, Evidence } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fmtDate, forwardAll, receivedIn, type FakePerson } from './util'

// Une adresse, plusieurs victimes : trois plaintes citent chacune leur propre
// transaction vers la même adresse de collecte, mais d'autres portefeuilles
// l'ont aussi payée. L'adresse n'a pas qu'un rôle de collecte : elle verse de
// faux « intérêts » à une plaignante (pour la pousser à réinvestir) et paie
// l'hébergeur du faux site, avec un rendu qui revient sur elle-même. À la
// fermeture du site, tout est regroupé sur un « coffre » qui contient déjà le
// produit d'une campagne précédente, et qui n'a jamais rien dépensé : fin
// d'affaire sur des fonds encore détenus (pas d'exchange).

const SITES = ['livret-crypto-plus', 'epargne-btc-garantie', 'rendement-or-bitcoin', 'placement-futur-crypto'] as const
const OLD_SITES = ['bitcoin-patrimoine', 'rente-crypto-securisee', 'avenir-btc-invest'] as const

const r4 = (v: number) => Math.round(v * 1e4) / 1e4
const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const h1 = (sec: number) => Math.round((sec / 3600) * 10) / 10

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

interface Victim {
  addr: string
  person?: FakePerson
  city?: string
  pays: Tx[]
}

export const debVictimesMultiples: ScenarioTemplate = {
  id: 'deb-victimes-multiples',
  title: 'Une adresse, plusieurs victimes',
  tagline: 'Trois plaintes, une même adresse… combien de victimes, et où dort l\'argent ?',
  description:
    'Trois plaintes déposées dans des villes différentes citent des paiements en bitcoins vers la même adresse. Dépliez ses entrées pour recenser tous les portefeuilles qui l\'ont payée, en écartant les rendus de l\'escroc lui-même ; triez ses sorties (faux intérêts reversés, hébergeur du site, regroupement final) et suivez les fonds jusqu\'au portefeuille où ils dorment encore, avec le produit d\'une campagne précédente.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'change', 'typologies', 'requisition', 'gel'],
  estMinutes: 35,
  lessons: ['suivre-flux', 'utxo', 'premiers-reflexes', 'typologies', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const site = r.pick(SITES)
    const oldSite = r.pick(OLD_SITES)
    const ratePct = r.pick([5, 6, 8, 10])

    const buyKits: ExchangeKit[] = [exchange(w, 'coinhouse', 'btc'), exchange(w, r.pick((['coinbase', 'bitstamp', 'swissborg'] as const)), 'btc')]
    const hoster = w.customEntity({
      name: 'NebulaHost (fictif)', category: 'merchant', risk: 'medium', known: true, country: 'Panama',
      description: 'Hébergeur web offshore (fictif) payable en bitcoin, sans vérification d\'identité, apprécié des sites frauduleux.',
      compliance: { contact: 'abuse@nebulahost.example', cooperation: 'mlat', responseDays: [60, 180], canFreeze: false, kyc: 'faible', notes: 'Conserve l\'adresse e-mail du compte client, les adresses IP de connexion au panneau d\'administration et la liste des domaines hébergés.' },
    })
    const hostInvoice = () => w.addr('btc', { entity: hoster, label: `${hoster.name} — Paiement`, tags: ['invoice'] })

    const suspect = w.customEntity({ name: `Site « ${site} » (inconnu)`, category: 'suspect' })
    const s1 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    // Coffre : autre logiciel (portefeuille matériel), autre type d'adresse
    const vault = w.addr('btc', { entity: suspect, kind: 'p2tr' })

    // ── Victimes : 3 plaignants + 1 à 3 victimes non identifiées ────────────
    const nVictims = r.int(4, 6)
    const victims: Victim[] = []
    const allPays: Tx[] = []
    const T1 = w.at(r.float(0, 24))
    const paybackT = T1 + Math.round(r.float(6.5, 7.5) * DAY)
    for (let i = 0; i < nVictims; i++) {
      const complainant = i < 3
      const person = complainant ? fakePerson(r) : undefined
      const ent = w.customEntity({ name: person ? person.name : 'Victime non identifiée', category: 'victim' })
      const addr = w.addr('btc', { entity: ent, kind: r.pick(['p2wpkh', 'p2wpkh', 'p2sh', 'p2pkh'] as const) })
      let city: string | undefined
      if (complainant) {
        city = fakeCity(r)
        while (victims.some((x) => x.city === city)) city = fakeCity(r)
      }
      const v: Victim = { addr, person, city, pays: [] }
      // La première plaignante paie deux fois : avant et après les faux « intérêts »
      const times = i === 0 ? [T1, paybackT + Math.round(r.float(12, 36) * HOUR)] : [w.at(r.float(10, 6 * 24))]
      for (const t0 of times) {
        // Les particuliers paient à des heures de veille (8 h – 23 h)
        const hh = parisHM(t0)[0]
        const t = hh < 8 ? sameDayAt(t0, r.int(8, 10), r.int(0, 59)) : hh >= 23 ? sameDayAt(t0 + DAY, r.int(8, 10), r.int(0, 59)) : t0
        const value = r4(r.float(0.008, 0.12))
        const kit = r.pick(buyKits)
        kit.withdraw(addr, r8(value + r.float(0.0005, 0.004)), t - Math.round(r.float(2, 30) * HOUR))
        // La première victime réutilise son adresse comme adresse de rendu
        const tx = w.utxoTx({ time: t, from: [addr], to: [{ address: s1, value }], change: i === 0 ? addr : undefined })
        v.pays.push(tx)
        allPays.push(tx)
      }
      victims.push(v)
    }
    allPays.sort((a, b) => a.time - b.time)
    const lastPay = allPays[allPays.length - 1].time
    const totalIn = r8(allPays.reduce((s, tx) => s + receivedIn(w, tx, s1), 0))
    const first = victims[0]

    // ── Faux « intérêts » reversés à la première plaignante (rendu sur s1) ──
    const firstPay = receivedIn(w, first.pays[0], s1)
    const paybackV = r8(Math.round(firstPay * (ratePct / 100) * 1e5) / 1e5)
    const payback = w.utxoTx({ time: paybackT, from: [s1], to: [{ address: first.addr, value: paybackV }], change: s1, autoFund: false })

    // ── Paiement de l'hébergeur du faux site (rendu sur s1) ─────────────────
    const hostT = allPays[1].time + Math.round(r.float(2, 10) * HOUR)
    const hostInv = hostInvoice()
    const hostV = r8(Math.round(r.float(0.0012, 0.0035) * 1e5) / 1e5)
    const hostTx = w.utxoTx({ time: hostT, from: [s1], to: [{ address: hostInv, value: hostV }], change: s1, autoFund: false })

    // ── Fermeture : tout est regroupé sur le coffre ─────────────────────────
    const cons = forwardAll(w, s1, vault, lastPay + Math.round(r.float(6, 30) * HOUR))
    const consDelayH = h1(cons.time - lastPay)
    const consV = receivedIn(w, cons, vault)
    const nConsIn = cons.inputs.length
    const nOwnChange = cons.inputs.filter((i) => i.prev && (i.prev.tx === payback.id || i.prev.tx === hostTx.id)).length
    const nVictimIn = cons.inputs.filter((i) => i.prev && allPays.some((t) => t.id === i.prev!.tx)).length

    // ── Campagne précédente, regroupée sur le même coffre deux mois plus tôt ─
    const sOld = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const oldStart = T1 - Math.round(r.float(57, 66) * DAY)
    const nOld = r.int(3, 4)
    for (let i = 0; i < nOld; i++) {
      const t = oldStart + Math.round(r.float(0, i === 0 ? 1 : 8) * DAY)
      const src = w.addr('btc', { kind: r.pick(['p2wpkh', 'p2sh'] as const) })
      const v = r4(r.float(0.01, 0.09))
      w.fund(src, v * r.float(1.05, 1.5), t - Math.round(r.float(3, 48) * HOUR))
      w.utxoTx({ time: t, from: [src], to: [{ address: sOld, value: v }] })
    }
    const oldHostTx = w.utxoTx({ time: oldStart + Math.round(r.float(3, 6) * DAY), from: [sOld], to: [{ address: hostInvoice(), value: r8(Math.round(r.float(0.0012, 0.0035) * 1e5) / 1e5) }], change: sOld, autoFund: false })
    const oldCons = forwardAll(w, sOld, vault, oldStart + Math.round(r.float(10, 14) * DAY))
    const oldConsV = receivedIn(w, oldCons, vault)
    const vaultBalance = r8(w.unspentValue(vault))

    // Poussière arrivée sur l'adresse de collecte après son vidage (jamais dépensée)
    const dust = dusting(w, s1, { time: cons.time + Math.round(r.float(2, 4) * DAY), n: 1, spreadH: 12 })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    for (const k of buyKits) k.noise(7, w.at(-5 * 24), w.at(10 * 24))
    for (let i = 0; i < 4; i++) {
      const inv = hostInvoice()
      w.fund(inv, r8(Math.round(r.float(0.0008, 0.004) * 1e5) / 1e5), w.at(r.float(-80 * 24, 10 * 24)))
    }

    const complainants = victims.slice(0, 3)
    const unknownVictims = victims.slice(3)
    const unknown = nVictims - 3
    const nPayments = allPays.length
    const complainantsTotal = r8(complainants.flatMap((v) => v.pays).reduce((s, tx) => s + receivedIn(w, tx, s1), 0))
    const p1 = first.person!
    const paybackDays = Math.round((parisDay(payback.time) - parisDay(first.pays[0].time)) / 86400000)
    const oldDays = Math.round((cons.time - oldCons.time) / DAY)

    const evidence: Evidence[] = complainants.map((v, i) => {
      const p = v.person!
      const lines = v.pays.map((tx) => `- ${amt(receivedIn(w, tx, s1), 'BTC')} le ${fmtDate(tx.time)} — transaction ${tx.hash}`).join('\n')
      const extra = i === 0
        ? `${paybackDays === 7 ? 'Au bout d\'une semaine' : `Au bout de ${paybackDays} jours`}, j'ai reçu ${amt(paybackV, 'BTC')} d'"intérêts" sur mon portefeuille. Comme ça marchait, j'ai remis de l'argent.\n\n`
        : ''
      return {
        id: `plainte${i + 1}`, type: 'plainte', title: `Plainte n° ${i + 1} — ${p.name} (${v.city})`, date: office(cons.time + (i + 1) * DAY), author: p.name,
        body:
          `« J'ai découvert le site ${site} par une publicité promettant ${ratePct} % de rendement par semaine. Un conseiller m'a ${p.g('rappelé', 'rappelée')} et m'a ${p.g('guidé', 'guidée')} pour acheter des bitcoins et les envoyer sur "mon compte de placement".\n\n` +
          extra +
          `${v.pays.length > 1 ? 'Mes paiements' : 'Mon paiement'} :\n${lines}\n\n` +
          `Depuis, le site est inaccessible. »`,
      }
    })
    evidence.push(
      {
        id: 'osint', type: 'osint', title: `Recherche en sources ouvertes — domaine « ${site} »`, date: office(cons.time + 3 * DAY), author: 'Cellule d\'appui',
        body:
          `Le domaine ${site} pointait vers un serveur de NebulaHost (fictif), hébergeur offshore payable en bitcoin. Le site a été mis hors ligne peu après le dernier paiement connu.\n` +
          `Archive web : la même charte graphique et les mêmes textes figuraient, il y a environ deux mois, sur le site « ${oldSite} », lui aussi hébergé chez NebulaHost, aujourd'hui fermé.`,
      },
      {
        id: 'note', type: 'note', title: 'Note du parquet', date: office(cons.time + 4 * DAY), author: 'Substitut du procureur',
        body:
          `Trois plaintes, trois services enquêteurs, une même adresse de destination. Merci d'établir, en vue d'un éventuel regroupement des procédures :\n` +
          `- le nombre total de victimes apparentes et leurs adresses, en distinguant celles qui n'ont pas porté plainte ;\n` +
          `- le montant global encaissé ;\n` +
          `- l'ensemble des sorties de l'adresse, et ce que l'auteur détient encore, en vue d'une saisie.`,
      },
    )

    return {
      world: w,
      title: `Faux site « ${site} »`,
      briefing:
        `Trois plaintes pour escroquerie, déposées à ${complainants[0].city}, ${complainants[1].city} et ${complainants[2].city}, visent le même faux site de placement « ${site} ». Chaque plaignant a payé en bitcoins, depuis son propre portefeuille, vers une adresse fournie par un « conseiller ».\n\n` +
        `En rapprochant les transactions citées, le parquet constate qu'elles aboutissent toutes à la même adresse. Une adresse d'escroc reçoit souvent les fonds de bien plus de victimes que celles qui ont porté plainte, et ne se contente pas de collecter : elle paie aussi les frais de l'escroquerie.\n\n` +
        `Votre mission : recenser tous les portefeuilles qui ont payé cette adresse, chiffrer le total encaissé, trier ses sorties, puis suivre les fonds jusqu'à l'endroit où ils se trouvent aujourd'hui.`,
      evidence,
      seeds: [s1],
      objectives: [
        {
          id: 'o1', type: 'number', points: 10, tolerance: 0, unit: 'victimes',
          prompt: 'Combien de portefeuilles de victimes distincts ont payé l\'adresse de l\'escroc ?',
          answer: nVictims,
          hint: 'Ouvrez la liste des transactions entrantes et notez l\'adresse émettrice de chacune. Une même victime peut avoir payé deux fois ; les sorties qui reviennent sur l\'adresse elle-même sont des rendus de l\'escroc, et 546 satoshis ne sont que de la poussière.',
          explanation: `${nPayments} paiements de victimes, mais ${nVictims} portefeuilles émetteurs distincts : ${p1.name} a payé deux fois depuis la même adresse. Ne sont pas des victimes : les deux transactions dont l'émetteur est l'adresse de l'escroc elle-même (le rendu de ses propres paiements, qui revient sur la même adresse) et la poussière de 546 satoshis reçue après le vidage. Seuls 3 portefeuilles correspondent à des plaignants : ${unknown} victime${unknown > 1 ? 's' : ''} reste${unknown > 1 ? 'nt' : ''} à identifier.`,
        },
        {
          id: 'o2', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant total (en BTC) les victimes ont-elles versé à cette adresse ?',
          answer: totalIn,
          hint: 'Additionnez les paiements des victimes, pas seulement ceux des plaignants. Le total reçu du résumé est plus élevé : il compte aussi les rendus de l\'escroc revenus sur l\'adresse.',
          explanation: `${amt(totalIn, 'BTC')} au total, en ${nPayments} paiements. Les trois plaignants n'en représentent que ${amt(complainantsTotal, 'BTC')} : le préjudice global est plus élevé que la somme des plaintes. Le « total reçu » brut de l'adresse est trompeur : il additionne aussi les rendus de ses propres dépenses (l'argent des victimes compté deux fois) et la poussière.`,
        },
        {
          id: 'o5', type: 'addresses', points: 10,
          prompt: 'Quelles adresses émettrices ne correspondent à aucun des trois plaignants (victimes non identifiées) ?',
          answer: unknownVictims.map((v) => v.addr),
          hint: 'Ouvrez chaque transaction citée dans les plaintes pour repérer l\'adresse de chaque plaignant ; les autres émetteurs (hors l\'adresse elle-même et la poussière) sont les victimes non identifiées.',
          explanation: `${unknownVictims.map((v) => A(w, v.addr)).join(', ')} : ${unknown > 1 ? 'ces adresses ont' : 'cette adresse a'} payé l'escroc sans qu'aucune plainte ne cite ${unknown > 1 ? 'leurs' : 'ses'} transactions. Pour chacune, on remonte l'origine des bitcoins (retrait d'une plateforme d'achat), on requiert cette plateforme pour identifier le titulaire, puis on le contacte pour recueillir sa plainte.`,
        },
        {
          id: 'o12', type: 'tx', points: 9,
          prompt: 'L\'une des sorties de l\'adresse de l\'escroc revient vers un plaignant. Quelle transaction ?',
          answer: [payback.id],
          hint: 'Comparez les destinataires des sorties de l\'adresse avec les adresses des plaignants (en entrée des transactions citées dans les plaintes).',
          explanation: `Le ${fmtDate(payback.time)}, ${amt(paybackV, 'BTC')} partent vers ${A(w, first.addr)}, l'adresse ${de(p1.name)} : environ ${ratePct} % de son premier versement, exactement le rendement hebdomadaire promis par le site. Ce sont les faux « intérêts » évoqués dans sa plainte, payés avec l'argent des victimes pour ${p1.g('le', 'la')} pousser à réinvestir, ce qu'${p1.g('il', 'elle')} a fait (${amt(receivedIn(w, first.pays[1], s1), 'BTC')} le ${fmtDate(first.pays[1].time, false)}). Ce n'est pas un point de sortie : l'argent revient à une victime. On le déduit de son préjudice net.`,
        },
        {
          id: 'o13', type: 'entity', points: 9,
          prompt: 'Quel prestataire l\'escroc paie-t-il avec l\'argent des victimes pendant la campagne ?',
          answer: [hoster.id],
          hint: 'Une sortie de faible montant part vers une adresse étiquetée. Rapprochez-la de la recherche en sources ouvertes sur le domaine.',
          explanation: `Le ${fmtDate(hostTx.time)}, ${amt(hostV, 'BTC')} partent vers une adresse de paiement de ${hoster.name}, l'hébergeur du faux site selon la recherche en sources ouvertes. Ce paiement relie l'adresse de collecte au compte client qui loue le serveur : e-mail, adresses IP de connexion, autres domaines. Prestataire offshore, peu coopératif : demande d'entraide pénale internationale, aux délais longs, mais la piste vaut d'être documentée.`,
        },
        {
          id: 'o6', type: 'address', points: 9,
          prompt: 'Vers quelle adresse l\'escroc regroupe-t-il les fonds à la fermeture du site ?',
          answer: [vault],
          hint: 'Dépliez les sorties de l\'adresse : une transaction à nombreuses entrées et une seule sortie la vide entièrement.',
          explanation: `La transaction ${cons.hash.slice(0, 12)}… dépense en une fois toutes les pièces restantes de l'adresse (${nConsIn} entrées : ${nVictimIn} paiement${nVictimIn > 1 ? 's' : ''} de victimes encore disponible${nVictimIn > 1 ? 's' : ''}${nOwnChange ? ` et ${nOwnChange} rendu${nOwnChange > 1 ? 's' : ''} de l'escroc` : ''}) et envoie tout, moins les frais, vers ${A(w, vault)}. Une seule sortie, aucun rendu : c'est un regroupement par le même propriétaire. L'adresse est d'un autre type (bc1p…, Taproot), signe d'un autre logiciel, typiquement un portefeuille matériel : le « coffre ».`,
        },
        {
          id: 'o9', type: 'number', points: 8, tolerance: 1, unit: 'heures',
          prompt: 'Combien d\'heures se sont écoulées entre le dernier paiement reçu et le regroupement ?',
          answer: consDelayH,
          hint: 'Repérez le paiement de victime le plus récent, puis comparez son horodatage à celui de la transaction de regroupement.',
          explanation: `Environ ${consDelayH.toLocaleString('fr-FR')} h. L'escroc vide l'adresse peu après le dernier paiement : il « relève » sa collecte, juste avant de fermer le site. Ce rythme renseigne sur son organisation et rappelle que l'adresse de collecte ne garde pas les fonds longtemps.`,
        },
        {
          id: 'o14', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.01,
          prompt: 'Combien de BTC ce regroupement a-t-il versés sur le coffre ?',
          answer: consV,
          hint: 'Ouvrez la transaction de regroupement : une seule sortie.',
          explanation: `${amt(consV, 'BTC')} : le total versé par les victimes (${amt(totalIn, 'BTC')}), moins les faux intérêts reversés (${amt(paybackV, 'BTC')}), le paiement de l'hébergeur (${amt(hostV, 'BTC')}) et les frais de réseau. Ce rapprochement entrées/sorties montre qu'aucune autre sortie n'a été oubliée.`,
        },
        {
          id: 'o16', type: 'address', points: 9,
          prompt: 'Le coffre avait déjà reçu des fonds avant ce regroupement. De quelle adresse ?',
          answer: [sOld],
          hint: 'Dépliez les entrées du coffre : une transaction bien antérieure aux faits le crédite. Regardez ce que faisait son adresse d\'origine.',
          explanation: `Le ${fmtDate(oldCons.time)}, ${A(w, sOld)} verse ${amt(oldConsV, 'BTC')} au coffre. Cette adresse a le même profil que l'adresse de collecte : plusieurs versements de particuliers, un paiement à ${hoster.name} (${oldHostTx.hash.slice(0, 10)}…), puis un vidage complet. C'est la collecte de la campagne précédente (« ${oldSite} », selon l'archive web) : d'autres victimes, sans doute d'autres plaintes, à rapprocher de ce dossier.`,
        },
        {
          id: 'o15', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel solde le coffre détient-il aujourd\'hui ?',
          answer: vaultBalance,
          hint: 'Lisez le solde non dépensé du coffre : il n\'a jamais rien envoyé.',
          explanation: `${amt(vaultBalance, 'BTC')} : ${amt(oldConsV, 'BTC')} de la campagne précédente et ${amt(consV, 'BTC')} de celle-ci. Le coffre n'a effectué aucune dépense : les fonds sont toujours sous le contrôle de l'auteur. Ce n'est pas le préjudice (qui se mesure sur ce que les victimes ont versé), c'est ce qui peut encore être saisi.`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Que faire des victimes apparentes qui n\'ont pas porté plainte ?',
          hint: 'Leurs paiements font partie des faits : que faut-il pour qu\'elles soient entendues ?',
          ...choice(r,
            'Les identifier, leur proposer de porter plainte et en informer le parquet',
            [
              'Rien : sans plainte de leur part, leurs paiements ne peuvent pas figurer au dossier',
              'Publier leurs adresses sur les réseaux sociaux pour qu\'elles se manifestent',
              'Les considérer comme complices, puisqu\'elles ont alimenté l\'adresse de l\'escroc',
            ]),
          explanation: `Les paiements des victimes non identifiées sont des éléments de l'enquête : ils mesurent l'ampleur de l'escroquerie. On peut remonter leurs adresses jusqu'aux plateformes où elles ont acheté leurs bitcoins et les requérir pour obtenir l'identité des titulaires, puis les contacter pour recueillir leur plainte. Le parquet, informé, peut regrouper les procédures : un seul dossier, un préjudice global, des réquisitions communes. Publier des adresses exposerait des victimes et pourrait alerter l'escroc.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Comment présenter au parquet le préjudice global de l\'escroquerie ?',
          hint: 'Quelle adresse reçoit l\'argent de toutes les victimes, avant tout regroupement ?',
          ...choice(r,
            'Ce que les victimes ont versé à l\'adresse de collecte, part des plaignants et des non-identifiés distinguée, faux intérêts déduits',
            [
              'Le solde du coffre, qui représente ce que l\'escroc a gagné',
              'La somme des trois plaintes, les autres paiements n\'étant pas encore établis',
              'Le total reçu affiché par le résumé de l\'adresse de collecte, sans retraitement',
            ]),
          explanation: `Le préjudice apparent est ce que les victimes ont versé : ${amt(totalIn, 'BTC')}, dont ${amt(complainantsTotal, 'BTC')} pour les trois plaignants, moins les ${amt(paybackV, 'BTC')} de faux intérêts reversés à ${p1.name}. Le solde du coffre mélange deux campagnes et mesure ce qui reste à saisir, pas ce qui a été escroqué ; la somme des plaintes sous-estime l'ampleur ; et le total brut du résumé compte deux fois les rendus de l'escroc. On précise toujours la méthode et la part non encore confirmée par une plainte.`,
        },
        {
          id: 'o17', type: 'choice', points: 8,
          prompt: 'Les bitcoins dorment sur le coffre. Quelle est la bonne démarche ?',
          hint: 'Qui, à part le détenteur des clés, peut bouger des bitcoins ?',
          ...choice(r,
            'Surveiller l\'adresse et préparer la saisie des clés (perquisition, sauvegardes de la phrase de récupération) lors de l\'interpellation',
            [
              'Demander à l\'émetteur du bitcoin de bloquer l\'adresse, comme on le fait pour l\'USDT',
              'Demander aux mineurs de refuser toute transaction partant du coffre',
              `Requérir ${hoster.name} pour qu'il restitue les bitcoins aux victimes`,
            ]),
          explanation: `Le bitcoin n'a pas d'émetteur capable de geler une adresse (à la différence de l'USDT ou de l'USDC), et personne ne peut bloquer une transaction signée par le détenteur des clés. Les fonds ne seront saisis que si l'on obtient les clés : support matériel, phrase de récupération notée, sauvegarde. D'ici là, on met l'adresse sous surveillance (alerte au premier mouvement) : si l'auteur l'envoie un jour vers une plateforme, une réquisition avec demande de gel devient possible. L'hébergeur a été payé : il n'a aucun bitcoin des victimes à restituer.`,
        },
      ],
      truth: {
        path: [...allPays.map((t) => t.id), cons.id],
        addresses: [s1, vault, sOld, ...unknownVictims.map((v) => v.addr)],
        debrief:
          `1. ${nVictims} portefeuilles distincts paient ${A(w, s1)} en ${nPayments} transactions, pour ${amt(totalIn, 'BTC')}. Trois seulement correspondent aux plaignants (${amt(complainantsTotal, 'BTC')}) ; ${p1.name} a payé deux fois ; ${unknown} victime${unknown > 1 ? 's' : ''} non identifiée${unknown > 1 ? 's' : ''}.\n` +
          `2. Entre-temps, l'adresse reverse ${amt(paybackV, 'BTC')} de faux « intérêts » à ${p1.name} (qui réinvestit ${later(payback.time, first.pays[1].time)}) et paie ${amt(hostV, 'BTC')} à l'hébergeur du site, ${hoster.name}. Les rendus de ces deux paiements reviennent sur l'adresse elle-même : ce ne sont pas de nouvelles victimes.\n` +
          `3. Environ ${consDelayH.toLocaleString('fr-FR')} h après le dernier paiement, l'escroc regroupe tout (${nConsIn} entrées, une sortie) vers ${A(w, vault)}, un portefeuille d'un autre type : ${amt(consV, 'BTC')}.\n` +
          `4. Ce coffre avait déjà reçu ${amt(oldConsV, 'BTC')}, ${oldDays} jours plus tôt, de ${A(w, sOld)}, collecte d'une campagne précédente (« ${oldSite} ») qui payait le même hébergeur. Il n'a jamais rien dépensé : ${amt(vaultBalance, 'BTC')} y dorment.\n` +
          `5. Fausse piste : la poussière de 546 satoshis reçue par l'adresse de collecte après son vidage.\n\n` +
          `À retenir : on compte les victimes par portefeuilles émetteurs distincts, en écartant les rendus de l'auteur et la poussière. On trie les sorties : un remboursement partiel à une victime n'est pas un point de sortie, un paiement à un prestataire est une piste d'identification. Et un flux ne finit pas toujours chez un exchange : ici, les fonds sont encore détenus par l'auteur.\n\n` +
          `Réflexes de l'enquêteur : signaler au parquet le nombre de victimes apparentes et le préjudice global ; identifier les victimes inconnues via leurs plateformes d'achat ; requérir l'hébergeur (entraide) ; rapprocher la campagne « ${oldSite} » ; placer le coffre sous surveillance et préparer la saisie des clés lors de l'interpellation.`,
      },
      hints: [
        'L\'adresse de l\'escroc est épinglée : sélectionnez-la et consultez ses transactions entrantes.',
        'Comptez les adresses émettrices différentes, pas les transactions : une victime a payé deux fois, et l\'adresse se renvoie ses propres rendus.',
        'Toutes les sorties ne sont pas des points de sortie : une revient vers une victime plaignante, une autre paie un prestataire étiqueté.',
        'Le regroupement final mène à un portefeuille qui n\'a jamais rien dépensé : regardez aussi ses entrées plus anciennes.',
      ],
    }
  },
}
