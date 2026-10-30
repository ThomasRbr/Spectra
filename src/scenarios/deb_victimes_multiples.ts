import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import type { ScenarioTemplate, Evidence } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, forwardAll, procedureFor, receivedIn, type FakePerson } from './util'

// Une adresse, plusieurs victimes : trois plaintes citent chacune leur propre
// transaction vers la même adresse, mais d'autres portefeuilles l'ont aussi
// payée. On déplie les entrées, on compte les émetteurs distincts, on totalise,
// puis on suit le regroupement jusqu'à l'exchange, et le rendu de l'escroc
// jusqu'à un second exchange quelques jours plus tard.

const SITES = ['livret-crypto-plus', 'epargne-btc-garantie', 'rendement-or-bitcoin', 'placement-futur-crypto'] as const

const r4 = (v: number) => Math.round(v * 1e4) / 1e4
const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const h1 = (sec: number) => Math.round((sec / 3600) * 10) / 10

interface Victim {
  addr: string
  person?: FakePerson
  city?: string
  pays: Tx[]
}

export const debVictimesMultiples: ScenarioTemplate = {
  id: 'deb-victimes-multiples',
  title: 'Une adresse, plusieurs victimes',
  tagline: 'Trois plaintes, une même adresse… et combien de victimes en réalité ?',
  description:
    'Trois plaintes déposées dans des villes différentes citent des paiements en bitcoins vers la même adresse. Dépliez ses entrées pour recenser tous les portefeuilles qui l\'ont payée et repérer les victimes qui n\'ont pas porté plainte, chiffrez le total encaissé, puis suivez le regroupement des fonds jusqu\'à l\'exchange, et le rendu de l\'escroc jusqu\'à un second point de sortie.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'exchange_id', 'requisition'],
  estMinutes: 30,
  lessons: ['suivre-flux', 'utxo', 'premiers-reflexes', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const site = r.pick(SITES)

    const destKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const dest = exchange(w, destKey, 'btc')
    const buyKits: ExchangeKit[] = [exchange(w, 'coinhouse', 'btc'), exchange(w, r.pick((['coinbase', 'bitstamp', 'swissborg'] as const)), 'btc')]
    const dest2Key = r.pick((['binance', 'okx', 'kraken'] as const).filter((k) => k !== destKey))
    const dest2 = exchange(w, dest2Key, 'btc')

    const suspect = w.customEntity({ name: `Site « ${site} » (inconnu)`, category: 'suspect' })
    const s1 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })

    // ── Victimes : 3 plaignants + 1 à 3 victimes non identifiées ────────────
    const nVictims = r.int(4, 6)
    const victims: Victim[] = []
    const allPays: Tx[] = []
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
      const nPay = i === 0 ? 2 : 1
      let t = w.at(r.float(0, 6 * 24))
      for (let j = 0; j < nPay; j++) {
        const value = r4(r.float(0.008, 0.12))
        const kit = r.pick(buyKits)
        kit.withdraw(addr, r8(value + r.float(0.0005, 0.004)), t - Math.round(r.float(2, 30) * HOUR))
        // La première victime réutilise son adresse comme adresse de rendu
        const tx = w.utxoTx({ time: t, from: [addr], to: [{ address: s1, value }], change: i === 0 ? addr : undefined })
        v.pays.push(tx)
        allPays.push(tx)
        t += Math.round(r.float(2, 4) * DAY)
      }
      victims.push(v)
    }
    allPays.sort((a, b) => a.time - b.time)
    const lastPay = allPays[allPays.length - 1].time
    const totalIn = r8(allPays.reduce((s, tx) => s + receivedIn(w, tx, s1), 0))

    // ── Regroupement puis dépôt ─────────────────────────────────────────────
    const s2 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const cons = forwardAll(w, s1, s2, lastPay + Math.round(r.float(6, 30) * HOUR))
    const consDelayH = h1(cons.time - lastPay)
    const depValue = r4(w.unspentValue(s2) * r.float(0.8, 0.92))
    const deposit = dest.newDeposit()
    const out = w.utxoTx({ time: cons.time + Math.round(r.float(2, 12) * HOUR), from: [s2], to: [{ address: deposit, value: depValue }] })
    const sweep = dest.sweep([deposit], out.time + Math.round(r.float(1, 6) * HOUR))[0]
    const chgOut = out.outputs.find((o) => o.address !== deposit)!
    const changeAddr = chgOut.address

    // ── Quelques jours plus tard, le rendu part vers un second exchange ─────
    const deposit2 = dest2.newDeposit()
    const out2 = forwardAll(w, changeAddr, deposit2, out.time + Math.round(r.float(50, 120) * HOUR))
    const sweep2 = dest2.sweep([deposit2], out2.time + Math.round(r.float(1, 6) * HOUR))[0]
    const credited2 = receivedIn(w, out2, deposit2)

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-3 * 24), w.at(14 * 24))
    dest2.noise(10, w.at(-3 * 24), w.at(16 * 24))
    for (const k of buyKits) k.noise(6, w.at(-5 * 24), w.at(10 * 24))

    const destName = dest.entity.name
    const dest2Name = dest2.entity.name
    const complainants = victims.slice(0, 3)
    const unknownVictims = victims.slice(3)
    const unknown = nVictims - 3
    const nPayments = allPays.length
    const complainantsTotal = r8(complainants.flatMap((v) => v.pays).reduce((s, tx) => s + receivedIn(w, tx, s1), 0))

    const evidence: Evidence[] = complainants.map((v, i) => {
      const p = v.person!
      const lines = v.pays.map((tx) => `- ${amt(receivedIn(w, tx, s1), 'BTC')} le ${fmtDate(tx.time)} — transaction ${tx.hash}`).join('\n')
      return {
        id: `plainte${i + 1}`, type: 'plainte', title: `Plainte n° ${i + 1} — ${p.name} (${v.city})`, date: out.time + (i + 1) * DAY, author: p.name,
        body:
          `« J'ai découvert le site ${site} par une publicité. Un conseiller m'a ${p.g('rappelé', 'rappelée')} et m'a ${p.g('guidé', 'guidée')} pour acheter des bitcoins et les envoyer sur "mon compte de placement".\n\n` +
          `${v.pays.length > 1 ? 'Mes paiements' : 'Mon paiement'} :\n${lines}\n\n` +
          `Depuis, le site est inaccessible. »`,
      }
    })
    evidence.push({
      id: 'note', type: 'note', title: 'Note du parquet', date: out.time + 4 * DAY, author: 'Substitut du procureur',
      body:
        `Trois plaintes, trois services enquêteurs, une même adresse de destination. Merci d'établir, en vue d'un éventuel regroupement des procédures :\n` +
        `- le nombre total de victimes apparentes et leurs adresses, en distinguant celles qui n'ont pas porté plainte ;\n` +
        `- le montant global encaissé ;\n` +
        `- l'ensemble des points de sortie des fonds, y compris ce que l'auteur a conservé.`,
    })

    return {
      world: w,
      title: `Faux site « ${site} »`,
      briefing:
        `Trois plaintes pour escroquerie, déposées à ${complainants[0].city}, ${complainants[1].city} et ${complainants[2].city}, visent le même faux site de placement « ${site} ». Chaque plaignant a payé en bitcoins, depuis son propre portefeuille, vers une adresse fournie par un « conseiller ».\n\n` +
        `En rapprochant les transactions citées, le parquet constate qu'elles aboutissent toutes à la même adresse. Une adresse d'escroc reçoit souvent les fonds de bien plus de victimes que celles qui ont porté plainte.\n\n` +
        `Votre mission : recenser tous les portefeuilles qui ont payé cette adresse, chiffrer le total encaissé, puis suivre les fonds jusqu'à chaque plateforme de sortie, rendu compris.`,
      evidence,
      seeds: [s1],
      objectives: [
        {
          id: 'o1', type: 'number', points: 10, tolerance: 0, unit: 'victimes',
          prompt: 'Combien de portefeuilles émetteurs distincts (victimes apparentes) ont payé l\'adresse de l\'escroc ?',
          answer: nVictims,
          hint: 'Dans le panneau de l\'adresse, ouvrez la liste des transactions entrantes (Entrées) et notez l\'adresse émettrice de chacune. Une même victime peut avoir payé deux fois.',
          explanation: `${nPayments} paiements entrants, mais ${nVictims} portefeuilles émetteurs distincts : ${complainants[0].person!.name} a payé deux fois depuis la même adresse. Seuls 3 ont porté plainte : ${unknown} victime${unknown > 1 ? 's' : ''} reste${unknown > 1 ? 'nt' : ''} à identifier.`,
        },
        {
          id: 'o2', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant total (en BTC) l\'adresse de l\'escroc a-t-elle reçu ?',
          answer: totalIn,
          hint: 'Additionnez tous les paiements entrants, pas seulement ceux des plaignants. Le résumé de l\'adresse indique aussi le total reçu.',
          explanation: `${amt(totalIn, 'BTC')} au total, en ${nPayments} paiements. Les trois plaignants n'en représentent que ${amt(complainantsTotal, 'BTC')} : le préjudice global est plus élevé que la somme des plaintes.`,
        },
        {
          id: 'o5', type: 'addresses', points: 10,
          prompt: 'Quelles adresses émettrices ne correspondent à aucun des trois plaignants (victimes non identifiées) ?',
          answer: unknownVictims.map((v) => v.addr),
          hint: 'Ouvrez chaque transaction citée dans les plaintes pour repérer l\'adresse de chaque plaignant ; les autres émetteurs de l\'adresse de l\'escroc sont les victimes non identifiées.',
          explanation: `${unknownVictims.map((v) => A(w, v.addr)).join(', ')} : ${unknown > 1 ? 'ces adresses ont' : 'cette adresse a'} payé l'escroc sans qu'aucune plainte ne cite ${unknown > 1 ? 'leurs' : 'ses'} transactions. Pour chacune, on remonte l'origine des bitcoins (retrait d'une plateforme d'achat), on requiert cette plateforme pour identifier le titulaire, puis on le contacte pour recueillir sa plainte. Les adresses des plaignants, elles, se lisent en entrée des transactions qu'ils citent.`,
        },
        {
          id: 'o6', type: 'address', points: 9,
          prompt: 'Vers quelle adresse l\'escroc regroupe-t-il tous les paiements reçus ?',
          answer: [s2],
          hint: 'Dépliez les sorties de l\'adresse de l\'escroc : une transaction à nombreuses entrées et une seule sortie la vide entièrement.',
          explanation: `La transaction ${cons.hash.slice(0, 12)}… dépense en une fois les ${nPayments} paiements reçus (${nPayments} entrées, une par UTXO) et envoie tout, moins les frais, vers ${A(w, s2)}. Une seule sortie, aucun rendu : c'est un regroupement par le même propriétaire, qui rassemble ses fonds avant de les déplacer.`,
        },
        {
          id: 'o9', type: 'number', points: 8, tolerance: 1, unit: 'heures',
          prompt: 'Combien d\'heures se sont écoulées entre le dernier paiement reçu et le regroupement ?',
          answer: consDelayH,
          hint: 'Repérez le paiement entrant le plus récent de l\'adresse de l\'escroc, puis comparez son horodatage à celui de la transaction de regroupement.',
          explanation: `Environ ${consDelayH} h. L'escroc vide l'adresse peu après le dernier paiement : il « relève » sa collecte, souvent juste avant de fermer le site. Ce rythme renseigne sur son organisation et rappelle que l'adresse de collecte ne garde pas les fonds longtemps.`,
        },
        {
          id: 'o3', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme les fonds regroupés ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Depuis l\'adresse de regroupement, dépliez les sorties : l\'une part vers une adresse ensuite balayée vers un hot wallet étiqueté.',
          explanation: `Depuis ${A(w, s2)}, l'escroc envoie ${amt(depValue, 'BTC')} vers une adresse de dépôt ${destName}, balayée vers le hot wallet. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o7', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.01,
          prompt: 'Combien de BTC ont été crédités sur l\'adresse de dépôt de cette plateforme ?',
          answer: depValue,
          hint: 'Ouvrez la transaction partie de l\'adresse de regroupement : deux sorties, ne retenez que celle qui va vers l\'adresse de dépôt.',
          explanation: `${amt(depValue, 'BTC')}, soit l'essentiel des fonds regroupés. La réquisition à ${destName} citera l'adresse de dépôt ${A(w, deposit)}, le hash ${out.hash.slice(0, 12)}…, la date et ce montant.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Dans cette transaction de dépôt, quelle sortie est le rendu de l\'escroc ?',
          answer: [changeAddr],
          hint: 'L\'autre sortie que l\'adresse de dépôt : même type d\'adresse que l\'entrée, montant non rond, adresse neuve.',
          explanation: `${A(w, changeAddr)} reçoit ${amt(chgOut.value, 'BTC')} : même format que l'adresse de regroupement, montant quelconque, adresse neuve, non balayée vers un hot wallet au moment du dépôt. C'est le rendu, conservé par l'escroc. Il faut le suivre : un rendu est souvent dépensé plus tard, ailleurs.`,
        },
        {
          id: 'o10', type: 'entity', points: 9,
          prompt: 'Quelques jours plus tard, le rendu de l\'escroc est à son tour déposé sur une plateforme. Laquelle ?',
          answer: [dest2Key],
          hint: 'Sélectionnez l\'adresse de rendu et dépliez ses sorties : elles mènent à une adresse balayée vers un autre hot wallet étiqueté.',
          explanation: `Le ${fmtDate(out2.time)}, le rendu est vidé vers une adresse de dépôt ${dest2Name} (${amt(credited2, 'BTC')}), balayée vers son hot wallet. Second point de sortie, second compte (peut-être au nom d'une autre personne) : une seconde réquisition est nécessaire. ${procedureFor(dest2.entity)}`,
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
          explanation: `Les paiements des victimes non identifiées sont des éléments de l'enquête : ils mesurent l'ampleur de l'escroquerie. On peut remonter leurs adresses jusqu'aux plateformes où elles ont acheté leurs bitcoins et les requérir pour obtenir l'identité des titulaires, puis les contacter pour recueillir leur plainte. Le parquet, informé, peut regrouper les procédures (jonction ou dessaisissement au profit d'un seul service) : un seul dossier, un préjudice global, des réquisitions communes. Publier des adresses exposerait des victimes et pourrait alerter l'escroc.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Comment présenter au parquet le préjudice global de l\'escroquerie ?',
          hint: 'Quelle adresse reçoit l\'argent de toutes les victimes, avant tout regroupement ou dépôt ?',
          ...choice(r,
            'Le total reçu par l\'adresse de l\'escroc, en distinguant la part des plaignants et celle des victimes non identifiées',
            [
              'Le montant déposé sur le premier exchange, seul montant qui sera confirmé par une réquisition',
              'La somme des trois plaintes, les autres paiements n\'étant pas encore établis',
              'Le solde actuel de l\'adresse de l\'escroc, qui représente ce qui peut encore être saisi',
            ]),
          explanation: `Le préjudice apparent est ce que les victimes ont versé : ${amt(totalIn, 'BTC')} reçus par ${A(w, s1)}, dont ${amt(complainantsTotal, 'BTC')} pour les trois plaignants. Le montant déposé sur ${destName} n'en est qu'une partie (le rendu est parti chez ${dest2Name}) ; la somme des plaintes sous-estime l'ampleur ; et le solde de l'adresse, désormais vide, mesure ce qui reste à saisir, pas ce qui a été escroqué. On précise toujours la méthode et la part non encore confirmée par une plainte.`,
        },
      ],
      truth: {
        path: [...allPays.map((t) => t.id), cons.id, out.id, sweep.id, out2.id, sweep2.id],
        addresses: [s1, s2, deposit, changeAddr, deposit2, ...unknownVictims.map((v) => v.addr)],
        debrief:
          `1. ${nVictims} portefeuilles distincts paient ${A(w, s1)} en ${nPayments} transactions, pour ${amt(totalIn, 'BTC')}. Trois seulement correspondent aux plaignants (${amt(complainantsTotal, 'BTC')}) ; ${complainants[0].person!.name} a payé deux fois ; ${unknown} victime${unknown > 1 ? 's' : ''} non identifiée${unknown > 1 ? 's' : ''}.\n` +
          `2. Environ ${consDelayH} h après le dernier paiement, l'escroc regroupe tous ces paiements en une transaction (${nPayments} entrées, une sortie) vers ${A(w, s2)}.\n` +
          `3. Il envoie ${amt(depValue, 'BTC')} vers l'adresse de dépôt ${destName} ${A(w, deposit)} et garde ${amt(chgOut.value, 'BTC')} en rendu sur ${A(w, changeAddr)}.\n` +
          `4. ${destName} balaie le dépôt vers son hot wallet.\n` +
          `5. Quelques jours plus tard, le rendu est déposé chez ${dest2Name} (${amt(credited2, 'BTC')}), puis balayé : second point de sortie.\n\n` +
          `À retenir : on compte les victimes par portefeuilles émetteurs distincts, pas par transactions. L'onglet des entrées d'une adresse d'escroc est une liste de victimes potentielles ; ses sorties, rendu compris, désignent tous les points de sortie.\n\n` +
          `Réflexes de l'enquêteur : signaler au parquet le nombre de victimes apparentes et le préjudice global ; identifier les victimes inconnues via leurs plateformes d'achat ; requérir ${destName} et ${dest2Name} sur leurs adresses de dépôt avec demande de gel ; rapprocher le dossier d'autres plaintes (fichiers, plateformes de signalement) visant le même site ou la même adresse.`,
      },
      hints: [
        'L\'adresse de l\'escroc est épinglée : sélectionnez-la et consultez ses transactions entrantes.',
        'Comptez les adresses émettrices différentes, pas les transactions : une victime a payé deux fois.',
        'Pour la sortie, dépliez les sorties de l\'adresse : la transaction de regroupement a autant d\'entrées que de paiements reçus.',
        'Ne vous arrêtez pas au premier exchange : la transaction de dépôt a un rendu, qui part ailleurs quelques jours plus tard.',
      ],
    }
  },
}
