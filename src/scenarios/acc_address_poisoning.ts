import { World } from '../engine/world'
import { exchange, HOUR } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import { lookalike } from '../engine/addressgen'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

/** Affichage tronqué tel qu'il apparaît dans une application portefeuille. */
function trunc(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-5)}`
}

export const accAddressPoisoning: ScenarioTemplate = {
  id: 'address-poisoning',
  title: 'Address poisoning sur Tron',
  tagline: 'Une adresse sosie glissée dans l\'historique, un copier-coller de trop : un paiement détourné.',
  description:
    'Une indépendante transfère chaque mois ses USDT vers son compte d\'exchange. Cette fois, le virement est parti vers une adresse qui ressemble trait pour trait à la bonne. Identifiez l\'adresse sosie, la transaction d\'empoisonnement et la destination des fonds.',
  difficulty: 2,
  chains: ['tron'],
  skills: ['tron', 'tokens', 'poisoning', 'typologies', 'exchange_id'],
  estMinutes: 15,
  lessons: ['tron-usdt', 'address-poisoning', 'typologies', 'exchanges', 'gel-saisie'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimName = fakePerson(r, 'f').name
    const city = fakeCity(r)

    const own = exchange(w, 'coinhouse', 'tron')
    const destKey = r.pick(['huobex', 'okx', 'binance'] as const)
    const dest = exchange(w, destKey, 'tron')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('tron', { entity: victimE })
    const clientE = w.customEntity({ name: 'Client de la victime (société étrangère)', category: 'individual' })
    const client = w.addr('tron', { entity: clientE })
    const attackerE = w.customEntity({ name: 'Réseau d\'address poisoning (inconnu)', category: 'suspect' })

    // TRX pour l'énergie / la bande passante
    own.withdraw(victim, r.int(150, 400), w.at(-r.int(100, 120) * 24), 'TRX')

    // L'adresse de dépôt personnelle de la victime sur Coinhouse
    const deposit = own.newDeposit()

    // Historique : le client paie, la victime transfère vers son dépôt Coinhouse
    const nMonths = r.int(4, 6)
    const legit: string[] = []
    let lastDepT = 0
    for (let i = 0; i < nMonths; i++) {
      const tIn = w.at(-(nMonths - i) * 18 * 24 - r.float(60, 110))
      const invoice = Math.round(r.float(2500, 9000) / 50) * 50
      w.transfer({ time: tIn, from: client, to: victim, value: invoice, asset: 'USDT' })
      const v = Math.round((invoice * r.float(0.85, 0.98)) / 50) * 50
      lastDepT = tIn + r.int(4, 30) * HOUR
      legit.push(own.receive(victim, v, lastDepT, { asset: 'USDT', depositAddr: deposit }).tx.id)
    }

    // Le réseau : une adresse « hub » qui finance des centaines de sosies en TRX
    const hub = w.addr('tron', { entity: attackerE })
    w.fundAccount(hub, r.int(40000, 90000), 'TRX', w.at(-40 * 24))
    w.fundAccount(hub, r.int(200, 800), 'USDT', w.at(-38 * 24))
    const poison = w.addr('tron', { entity: attackerE, addr: lookalike(r, 'tron', A(w, deposit), 6, 5) })
    w.transfer({ time: lastDepT - r.int(2, 10) * HOUR, from: hub, to: poison, value: r.int(20, 60), asset: 'TRX' })
    w.transfer({ time: lastDepT - r.int(1, 90) * 60, from: hub, to: poison, value: r.pick([1, 2, 5]), asset: 'USDT', autoFund: false })
    const dust = r.pick([0.01, 0.01, 0.05, 0.1, 1])
    const tPoison = w.transfer({ time: lastDepT + r.int(3, 25) * 60, from: poison, to: victim, value: dust, asset: 'USDT', autoFund: false })

    // Le même hub empoisonne d'autres cibles
    for (let i = 0; i < r.int(5, 8); i++) {
      const target = w.addr('tron')
      const counterpart = w.addr('tron')
      const tPay = w.at(-r.float(3, 30) * 24)
      const payV = Math.round(r.float(300, 15000))
      w.fundAccount(target, payV + Math.round(r.float(50, 5000)), 'USDT', tPay - r.int(2, 96) * HOUR)
      w.transfer({ time: tPay, from: target, to: counterpart, value: payV, asset: 'USDT' })
      const fake = w.addr('tron', { entity: attackerE, addr: lookalike(r, 'tron', A(w, counterpart), 6, 5) })
      const tf = tPay + r.int(3, 40) * 60
      w.transfer({ time: tf - r.int(1, 6) * HOUR, from: hub, to: fake, value: r.int(20, 60), asset: 'TRX' })
      w.transfer({ time: tf - r.int(1, 50) * 60, from: hub, to: fake, value: r.pick([1, 2, 5]), asset: 'USDT', autoFund: false })
      w.transfer({ time: tf, from: fake, to: target, value: r.pick([0.01, 0.05, 0.1, 1]), asset: 'USDT', autoFund: false })
    }

    // Leurre : un autre sosie (du client cette fois) a aussi visé la victime
    const decoyE = w.customEntity({ name: 'Autre empoisonneur (inconnu)', category: 'suspect' })
    const decoyFake = w.addr('tron', { entity: decoyE, addr: lookalike(r, 'tron', A(w, client), 6, 5) })
    const tDecoyIn = w.at(-r.float(20, 40) * 24)
    w.fundAccount(decoyFake, r.int(15, 40), 'TRX', tDecoyIn - r.int(1, 8) * HOUR)
    w.fundAccount(decoyFake, r.pick([1, 2, 5]), 'USDT', tDecoyIn - r.int(10, 50) * 60)
    const tDecoy = w.transfer({ time: tDecoyIn, from: decoyFake, to: victim, value: r.pick([0.01, 0.1, 1]), asset: 'USDT', autoFund: false })

    // Grosse facture puis paiement détourné
    const bigInvoice = Math.round(r.float(18000, 60000) / 100) * 100
    const tBigIn = w.transfer({ time: w.at(-r.float(20, 40)), from: client, to: victim, value: bigInvoice, asset: 'USDT' })
    const lost = Math.round((bigInvoice * r.float(0.9, 0.98)) / 100) * 100
    const tLost = w.transfer({ time: w.at(0), from: victim, to: poison, value: lost, asset: 'USDT' })

    // Le sosie vide aussitôt vers un collecteur, puis l'exchange
    const collector = w.addr('tron', { entity: attackerE })
    w.transfer({ time: w.at(-5 * 24), from: hub, to: collector, value: r.int(100, 300), asset: 'TRX' })
    const tFwd = w.transfer({ time: tLost.time + r.int(4, 30) * 60, from: poison, to: collector, value: lost, asset: 'USDT' })
    const outV = Math.round((lost * r.float(0.85, 0.95)) / 10) * 10
    const dep = dest.receive(collector, outV, tFwd.time + r.int(2, 10) * HOUR, { asset: 'USDT' })
    const remaining = roundAsset('USDT', w.balanceOf(collector, 'USDT'))

    // Bruit de fond
    dest.noise(16, w.at(-4 * 24), w.at(4 * 24), 'USDT')
    own.noise(12, w.at(-30 * 24), w.at(3 * 24), 'USDT')

    return {
      world: w,
      title: `Copier-coller fatal — ${city}`,
      briefing:
        `${victimName} (${city}), développeuse indépendante, est payée en USDT (réseau Tron) par un client étranger. Chaque mois, elle transfère ses USDT vers son adresse de dépôt Coinhouse pour les convertir en euros.\n\n` +
        `Le ${fmtDate(tLost.time)}, elle copie l'adresse depuis son historique, comme d'habitude, et envoie ${amt(lost, 'USDT')}. Les fonds ne sont jamais arrivés chez Coinhouse.\n\n` +
        `Objectifs : établir le mode opératoire (address poisoning), identifier l'adresse sosie et la transaction qui l'a introduite dans l'historique, et localiser les fonds.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(26), author: victimName,
          body:
            `« Je fais ce virement tous les mois, je copie toujours la dernière adresse utilisée dans l'historique de mon application. Je vérifie le début et la fin, ils étaient identiques.\n\n` +
            `Mon adresse Tron : ${A(w, victim)}\n` +
            `Le virement perdu : ${tLost.hash}\n` +
            `Mon adresse de dépôt Coinhouse (copiée depuis le site) : ${A(w, deposit)} »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture — historique de l\'application portefeuille', date: tLost.time - 300,
          body:
            `Historique USDT (TRC-20)\n` +
            `↓ Reçu     ${trunc(A(w, client))}   +${amt(bigInvoice, 'USDT')}\n` +
            `↓ Reçu     ${trunc(A(w, poison))}   +${amt(dust, 'USDT')}\n` +
            `↑ Envoyé   ${trunc(A(w, deposit))}   -${amt(w.tx(legit[legit.length - 1]).transfers[0].value, 'USDT')}\n` +
            `(adresses tronquées par l'application)`,
        },
        {
          id: 'note', type: 'note', title: 'Note — réponse de Coinhouse', date: w.at(3 * 24), author: 'Coinhouse — Service conformité',
          body: `Aucun dépôt de ${amt(lost, 'USDT')} n'a été reçu sur l'adresse de dépôt de notre cliente à la date indiquée. Les derniers dépôts reçus sur ${A(w, deposit)} correspondent à ses virements habituels.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 25,
          prompt: 'Quelle est l\'adresse sosie qui a reçu le paiement détourné ?',
          answer: [poison],
          hint: 'Ouvrez la transaction du virement perdu et comparez caractère par caractère son destinataire avec la vraie adresse de dépôt.',
          explanation: `${A(w, poison)} partage les 6 premiers et les 5 derniers caractères de l'adresse de dépôt légitime ${A(w, deposit)}, mais le milieu est totalement différent.`,
        },
        {
          id: 'o2', type: 'tx', points: 25,
          prompt: 'Quelle transaction a « empoisonné » l\'historique de la victime ?',
          answer: [tPoison.id],
          hint: 'Regardez les flux entrants de la victime : un transfert minuscule, quelques minutes après un de ses dépôts habituels.',
          explanation: `Le ${fmtDate(tPoison.time)}, quelques minutes après son dernier dépôt légitime, l'adresse sosie lui envoie ${amt(dust, 'USDT')}. Ce transfert de poussière place l'adresse sosie en tête de son historique. Attention au leurre : un autre sosie (imitant l'adresse de son client) l'a aussi visée, mais n'a jamais reçu de paiement de sa part.`,
        },
        {
          id: 'o3', type: 'entity', points: 25,
          prompt: 'Sur quelle plateforme l\'essentiel des fonds détournés a-t-il été déposé ?',
          answer: [destKey],
          hint: 'L\'adresse sosie ne garde rien : suivez le collecteur.',
          explanation: `Le sosie transfère ${amt(lost, 'USDT')} vers un collecteur ${A(w, collector)}, qui dépose ${amt(outV, 'USDT')} sur ${dest.entity.name}. Il reste ${amt(remaining, 'USDT')} sur le collecteur, gelables par l'émetteur de l'USDT.`,
        },
        {
          id: 'o4', type: 'choice', points: 25,
          prompt: 'Quelle recommandation et quel réflexe d\'enquête retenir face à ce mode opératoire ?',
          ...choice(r,
            'Copier l\'adresse à la source (liste blanche, envoi test) ; enquêter sur la poussière et le hub',
            [
              'Ne plus utiliser Tron, réseau réservé aux escrocs ; aucune piste d\'enquête exploitable',
              'Vérifier les 4 premiers caractères suffit ; la victime a commis une simple erreur',
              'Classer : le paiement relève d\'une erreur de la victime, sans infraction pénale',
            ]),
          explanation: `L'address poisoning exploite l'habitude de copier depuis l'historique et l'affichage tronqué des portefeuilles. Les sosies sont générés en masse et financés en TRX par un même hub (${A(w, hub)}) : le remonter révèle d'autres victimes. Côté judiciaire, c'est une escroquerie (manœuvre frauduleuse) ; on demande en urgence le gel des USDT restants à l'émetteur et on requiert ${dest.entity.name}. ${procedureFor(dest.entity)}`,
        },
      ],
      truth: {
        path: [...legit, tPoison.id, tBigIn.id, tLost.id, tFwd.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : []), tDecoy.id],
        addresses: [poison, collector, hub, deposit, dep.deposit],
        debrief:
          `1. La victime dépose régulièrement ses USDT sur ${A(w, deposit)} (Coinhouse).\n` +
          `2. Le réseau surveille les gros flux USDT : il génère une adresse sosie ${A(w, poison)} (mêmes 6 premiers et 5 derniers caractères), la finance en TRX depuis le hub ${A(w, hub)}, puis envoie ${amt(dust, 'USDT')} à la victime juste après un de ses dépôts.\n` +
          `3. Au virement suivant, la victime copie l'adresse sosie depuis son historique et envoie ${amt(lost, 'USDT')}.\n` +
          `4. Les fonds partent en quelques minutes vers le collecteur ${A(w, collector)}, puis ${amt(outV, 'USDT')} sont déposés sur ${dest.entity.name}. ${amt(remaining, 'USDT')} restent sur le collecteur.\n\n` +
          `À retenir : en address poisoning, la « transaction d'empoisonnement » (poussière ou transfert de valeur nulle) précède nécessairement le détournement. Le hub de financement relie souvent des dizaines de sosies : c'est une piste pour identifier d'autres victimes et regrouper les procédures.`,
      },
      hints: [
        'Comparez l\'adresse de dépôt Coinhouse (plainte) avec le destinataire du virement perdu : pas seulement le début et la fin.',
        'Dépliez les flux entrants de la victime et triez par date : cherchez un montant ridiculement faible.',
        'Deux sosies ont visé la victime : seul celui qui imite l\'adresse de dépôt Coinhouse a reçu le virement.',
        'Remontez les TRX reçus par le sosie : qui finance ses frais ?',
      ],
    }
  },
}
