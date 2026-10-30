import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import type { ScenarioTemplate, Evidence } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, forwardAll, procedureFor, receivedIn, type FakePerson } from './util'

// Une adresse, plusieurs victimes : trois plaintes citent chacune leur propre
// transaction vers la même adresse, mais d'autres portefeuilles l'ont aussi
// payée. On déplie les entrées, on compte les émetteurs distincts, on totalise,
// puis on suit le regroupement jusqu'à l'exchange.

const SITES = ['livret-crypto-plus', 'epargne-btc-garantie', 'rendement-or-bitcoin', 'placement-futur-crypto'] as const

const r4 = (v: number) => Math.round(v * 1e4) / 1e4
const r8 = (v: number) => Math.round(v * 1e8) / 1e8

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
    'Trois plaintes déposées dans des villes différentes citent des paiements en bitcoins vers la même adresse. Dépliez ses entrées pour recenser tous les portefeuilles qui l\'ont payée, chiffrez le total encaissé, puis suivez le regroupement des fonds jusqu\'à l\'exchange.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'exchange_id', 'requisition'],
  estMinutes: 15,
  lessons: ['suivre-flux', 'utxo', 'premiers-reflexes', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const site = r.pick(SITES)

    const destKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const dest = exchange(w, destKey, 'btc')
    const buyKits: ExchangeKit[] = [exchange(w, 'coinhouse', 'btc'), exchange(w, r.pick((['coinbase', 'bitstamp', 'swissborg'] as const)), 'btc')]

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
    const depValue = r4(w.unspentValue(s2) * r.float(0.8, 0.92))
    const deposit = dest.newDeposit()
    const out = w.utxoTx({ time: cons.time + Math.round(r.float(2, 12) * HOUR), from: [s2], to: [{ address: deposit, value: depValue }] })
    const sweep = dest.sweep([deposit], out.time + Math.round(r.float(1, 6) * HOUR))[0]

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-3 * 24), w.at(14 * 24))
    for (const k of buyKits) k.noise(6, w.at(-5 * 24), w.at(10 * 24))

    const destName = dest.entity.name
    const complainants = victims.slice(0, 3)
    const unknown = nVictims - 3
    const nPayments = allPays.length

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
      body: `Trois plaintes, trois services enquêteurs, une même adresse de destination. Merci d'établir le nombre total de victimes apparentes et le montant global encaissé, en vue d'un éventuel regroupement des procédures.`,
    })

    return {
      world: w,
      title: `Faux site « ${site} »`,
      briefing:
        `Trois plaintes pour escroquerie, déposées à ${complainants[0].city}, ${complainants[1].city} et ${complainants[2].city}, visent le même faux site de placement « ${site} ». Chaque plaignant a payé en bitcoins, depuis son propre portefeuille, vers une adresse fournie par un « conseiller ».\n\n` +
        `En rapprochant les transactions citées, le parquet constate qu'elles aboutissent toutes à la même adresse. Une adresse d'escroc reçoit souvent les fonds de bien plus de victimes que celles qui ont porté plainte.\n\n` +
        `Votre mission : recenser tous les portefeuilles qui ont payé cette adresse, chiffrer le total encaissé, et suivre les fonds jusqu'à la plateforme de sortie.`,
      evidence,
      seeds: [s1],
      objectives: [
        {
          id: 'o1', type: 'number', points: 25, tolerance: 0, unit: 'victimes',
          prompt: 'Combien de portefeuilles émetteurs distincts (victimes apparentes) ont payé l\'adresse de l\'escroc ?',
          answer: nVictims,
          hint: 'Dans le panneau de l\'adresse, ouvrez la liste des transactions entrantes (Entrées) et notez l\'adresse émettrice de chacune. Une même victime peut avoir payé deux fois.',
          explanation: `${nPayments} paiements entrants, mais ${nVictims} portefeuilles émetteurs distincts : ${complainants[0].person!.name} a payé deux fois depuis la même adresse. Seuls 3 ont porté plainte : ${unknown} victime${unknown > 1 ? 's' : ''} reste${unknown > 1 ? 'nt' : ''} à identifier.`,
        },
        {
          id: 'o2', type: 'amount', points: 25, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant total (en BTC) l\'adresse de l\'escroc a-t-elle reçu ?',
          answer: totalIn,
          hint: 'Additionnez tous les paiements entrants, pas seulement ceux des plaignants. Le résumé de l\'adresse indique aussi le total reçu.',
          explanation: `${amt(totalIn, 'BTC')} au total, en ${nPayments} paiements. Les trois plaignants n'en représentent qu'une partie : le préjudice global est plus élevé que la somme des plaintes.`,
        },
        {
          id: 'o3', type: 'entity', points: 25,
          prompt: 'Sur quelle plateforme les fonds regroupés ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Dépliez les sorties de l\'adresse : une transaction à nombreuses entrées regroupe tous les paiements, puis la nouvelle adresse envoie vers un dépôt d\'exchange.',
          explanation: `L'escroc dépense en une seule transaction les ${nPayments} paiements reçus (regroupement vers ${A(w, s2)}), puis envoie ${amt(depValue, 'BTC')} vers une adresse de dépôt ${destName}, balayée vers le hot wallet. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o4', type: 'choice', points: 25,
          prompt: 'Que faire des victimes apparentes qui n\'ont pas porté plainte ?',
          ...choice(r,
            'Les identifier, leur proposer de porter plainte et en informer le parquet',
            [
              'Rien : sans plainte de leur part, leurs paiements ne peuvent pas figurer au dossier',
              'Publier leurs adresses sur les réseaux sociaux pour qu\'elles se manifestent',
              'Les considérer comme complices, puisqu\'elles ont alimenté l\'adresse de l\'escroc',
            ]),
          explanation: `Les paiements des victimes non identifiées sont des éléments de l'enquête : ils mesurent l'ampleur de l'escroquerie. On peut remonter leurs adresses jusqu'aux plateformes où elles ont acheté leurs bitcoins et les requérir pour obtenir l'identité des titulaires, puis les contacter pour recueillir leur plainte. Le parquet, informé, peut regrouper les procédures (jonction ou dessaisissement au profit d'un seul service) : un seul dossier, un préjudice global, des réquisitions communes. Publier des adresses exposerait des victimes et pourrait alerter l'escroc.`,
        },
      ],
      truth: {
        path: [...allPays.map((t) => t.id), cons.id, out.id, sweep.id],
        addresses: [s1, s2, deposit],
        debrief:
          `1. ${nVictims} portefeuilles distincts paient ${A(w, s1)} en ${nPayments} transactions, pour ${amt(totalIn, 'BTC')}. Trois seulement correspondent aux plaignants ; ${complainants[0].person!.name} a payé deux fois.\n` +
          `2. L'escroc regroupe tous ces paiements en une transaction (${nPayments} entrées, une sortie) vers ${A(w, s2)}.\n` +
          `3. Il envoie ${amt(depValue, 'BTC')} vers l'adresse de dépôt ${destName} ${A(w, deposit)} et garde le reste en rendu.\n` +
          `4. ${destName} balaie le dépôt vers son hot wallet.\n\n` +
          `À retenir : on compte les victimes par portefeuilles émetteurs distincts, pas par transactions. L'onglet des entrées d'une adresse d'escroc est une liste de victimes potentielles.\n\n` +
          `Réflexes de l'enquêteur : signaler au parquet le nombre de victimes apparentes et le préjudice global ; identifier les victimes inconnues via leurs plateformes d'achat ; requérir ${destName} sur l'adresse de dépôt avec demande de gel ; rapprocher le dossier d'autres plaintes (fichiers, plateformes de signalement) visant le même site ou la même adresse.`,
      },
      hints: [
        'L\'adresse de l\'escroc est épinglée : sélectionnez-la et consultez ses transactions entrantes.',
        'Comptez les adresses émettrices différentes, pas les transactions : une victime a payé deux fois.',
        'Pour la sortie, dépliez les sorties de l\'adresse : la transaction de regroupement a autant d\'entrées que de paiements reçus.',
      ],
    }
  },
}
