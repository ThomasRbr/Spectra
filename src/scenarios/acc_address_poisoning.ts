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
    'Une indépendante transfère chaque mois ses USDT vers son compte d\'exchange. Cette fois, le virement est parti vers une adresse qui ressemble trait pour trait à la bonne. Identifiez l\'adresse sosie, la transaction d\'empoisonnement, l\'infrastructure qui finance les sosies et la destination des fonds, dont la part encore gelable.',
  difficulty: 2,
  chains: ['tron'],
  skills: ['tron', 'tokens', 'poisoning', 'typologies', 'exchange_id'],
  estMinutes: 40,
  lessons: ['tron-usdt', 'address-poisoning', 'typologies', 'exchanges', 'gel-saisie'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimName = fakePerson(r, 'f').name
    const city = fakeCity(r)

    const own = exchange(w, 'coinhouse', 'tron')
    const destKey = r.pick(['huobex', 'okx', 'binance'] as const)
    const dest = exchange(w, destKey, 'tron')
    // Plateforme d'où proviennent les TRX du hub (pivot d'identification du réseau)
    const hubSrcKey = r.pick((['binance', 'okx', 'huobex', 'kraken'] as const).filter((k) => k !== destKey))
    const hubSrc = exchange(w, hubSrcKey, 'tron')

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
    const hubFundTx = hubSrc.withdraw(hub, r.int(40000, 90000), w.at(-40 * 24), 'TRX')
    w.fundAccount(hub, r.int(200, 800), 'USDT', w.at(-38 * 24))
    const poison = w.addr('tron', { entity: attackerE, addr: lookalike(r, 'tron', A(w, deposit), 6, 5) })
    const poisonGas = w.transfer({ time: lastDepT - r.int(2, 10) * HOUR, from: hub, to: poison, value: r.int(20, 60), asset: 'TRX' })
    w.transfer({ time: lastDepT - r.int(1, 90) * 60, from: hub, to: poison, value: r.pick([1, 2, 5]), asset: 'USDT', autoFund: false })
    const dust = r.pick([0.01, 0.01, 0.05, 0.1, 1])
    const tPoison = w.transfer({ time: lastDepT + r.int(3, 25) * 60, from: poison, to: victim, value: dust, asset: 'USDT', autoFund: false })

    // Le même hub empoisonne d'autres cibles
    const nFakes = r.int(5, 8)
    for (let i = 0; i < nFakes; i++) {
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
    hubSrc.noise(8, w.at(-45 * 24), w.at(3 * 24), 'TRX')

    const hubSrcName = hubSrc.entity.name
    const fwdMin = Math.round((tFwd.time - tLost.time) / 60)

    return {
      world: w,
      title: `Copier-coller fatal — ${city}`,
      briefing:
        `${victimName} (${city}), développeuse indépendante, est payée en USDT (réseau Tron) par un client étranger. Chaque mois, elle transfère ses USDT vers son adresse de dépôt Coinhouse pour les convertir en euros.\n\n` +
        `Le ${fmtDate(tLost.time)}, elle copie l'adresse depuis son historique, comme d'habitude, et envoie ${amt(lost, 'USDT')}. Les fonds ne sont jamais arrivés chez Coinhouse.\n\n` +
        `Objectifs : établir le mode opératoire (address poisoning), identifier l'adresse sosie et la transaction qui l'a introduite dans l'historique, remonter l'infrastructure qui finance les sosies, et localiser les fonds, dont la part encore gelable.`,
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
        {
          id: 'note2', type: 'note', title: 'Note de l\'analyste : industrialisation du poisoning', date: w.at(3 * 24), author: 'Cellule d\'appui',
          body:
            `• Les sosies sont générés par logiciel (recherche d'adresses « vanity » partageant le début et la fin de l'adresse imitée) et pré-positionnés en masse.\n` +
            `• Sur Tron, une adresse neuve ne peut rien émettre sans TRX (activation, énergie, bande passante) : un même portefeuille « hub » finance généralement des dizaines de sosies.\n` +
            `• Remonter le hub et son propre approvisionnement permet de regrouper les victimes d'une même équipe et, parfois, d'atteindre un compte d'exchange.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse sosie qui a reçu le paiement détourné ?',
          answer: [poison],
          hint: 'Ouvrez la transaction du virement perdu et comparez caractère par caractère son destinataire avec la vraie adresse de dépôt.',
          explanation: `${A(w, poison)} partage les 6 premiers et les 5 derniers caractères de l'adresse de dépôt légitime ${A(w, deposit)}, mais le milieu est totalement différent.`,
        },
        {
          id: 'o2', type: 'tx', points: 10,
          prompt: 'Quelle transaction a « empoisonné » l\'historique de la victime ?',
          answer: [tPoison.id],
          hint: 'Regardez les flux entrants de la victime : un transfert minuscule, quelques minutes après un de ses dépôts habituels.',
          explanation: `Le ${fmtDate(tPoison.time)}, quelques minutes après son dernier dépôt légitime, l'adresse sosie lui envoie ${amt(dust, 'USDT')}. Ce transfert de poussière place l'adresse sosie en tête de son historique. Attention au leurre : un autre sosie (imitant l'adresse de son client) l'a aussi visée, mais n'a jamais reçu de paiement de sa part.`,
        },
        {
          id: 'o11', type: 'address', points: 8,
          prompt: 'Une autre adresse sosie a aussi visé la victime, sans succès. Laquelle ?',
          answer: [decoyFake],
          hint: 'Parmi les poussières reçues par la victime, l\'une imite une autre adresse que le dépôt Coinhouse : comparez avec les adresses de ses correspondants habituels.',
          explanation: `${A(w, decoyFake)} imite l'adresse du client (${A(w, client)}, mêmes 6 premiers et 5 derniers caractères) et a envoyé ${amt(tDecoy.transfers[0].value, 'USDT')} à la victime le ${fmtDate(tDecoy.time, false)}. La victime ne lui a jamais rien envoyé, et ce sosie n'est pas financé par le hub : c'est vraisemblablement une autre équipe. Il ne fait pas partie du préjudice, mais il illustre l'ampleur du phénomène et doit être documenté sans être confondu avec l'auteur.`,
        },
        {
          id: 'o5', type: 'address', points: 8,
          prompt: 'Quelle adresse a financé en TRX l\'adresse sosie avant l\'empoisonnement ?',
          answer: [hub],
          hint: 'Ouvrez les tout premiers flux entrants de l\'adresse sosie, colonne Actif = TRX : quelques dizaines de TRX, quelques heures avant la poussière.',
          explanation: `${A(w, hub)} envoie ${amt(poisonGas.transfers[0].value, 'TRX')} puis quelques USDT au sosie, juste avant la poussière. C'est le « hub » du réseau : il finance tous ses sosies et paie même les frais du collecteur. Une adresse qui finance en série des adresses neuves, chacune ensuite utilisée pour une seule poussière, est la signature d'une infrastructure de poisoning.`,
        },
        {
          id: 'o6', type: 'number', points: 8, unit: 'sosies',
          prompt: 'Combien d\'adresses sosies (adresses qui envoient ensuite de la poussière à une cible) ce hub a-t-il financées, celle de l\'affaire comprise ?',
          answer: nFakes + 1,
          hint: 'Dépliez les sorties de TRX du hub : chaque destinataire qui envoie ensuite une poussière d\'USDT à une autre adresse est un sosie. Attention, le hub finance aussi une adresse qui n\'envoie aucune poussière.',
          explanation: `Le hub finance ${nFakes + 1} sosies (dont celui de l'affaire), chacun imitant le correspondant habituel d'une cible différente, plus le collecteur, qui n'envoie pas de poussière mais reçoit le produit du vol. Chaque cible empoisonnée est une victime potentielle : celles qui ont fini par payer un sosie relèvent de la même procédure.`,
        },
        {
          id: 'o7', type: 'entity', points: 8,
          prompt: 'De quelle plateforme proviennent les TRX du hub ?',
          answer: [hubSrcKey],
          hint: 'Remontez les flux entrants du hub jusqu\'au plus ancien versement de TRX : il provient d\'un hot wallet étiqueté.',
          explanation: `Le ${fmtDate(hubFundTx.time, false)}, ${hubSrcName} verse ${amt(hubFundTx.transfers[0].value, 'TRX')} au hub depuis son hot wallet. Ce retrait est rattaché à un compte client : la réquisition (hash ${hubFundTx.hash.slice(0, 16)}…) peut désigner l'équipe qui opère les sosies, indépendamment du produit du vol. ${procedureFor(hubSrc.entity)}`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Vers quelle adresse le sosie a-t-il transféré les fonds détournés ?',
          answer: [collector],
          hint: 'L\'adresse sosie ne garde rien : regardez sa sortie d\'USDT quelques minutes après le virement perdu.',
          explanation: `${fwdMin} minutes après le virement, le sosie transfère ${amt(lost, 'USDT')} vers ${A(w, collector)}. Ce collecteur a reçu ses TRX du même hub quelques jours plus tôt : il appartient au même réseau. Le transfert immédiat vise à sortir les fonds de l'adresse sosie, la première à être signalée.`,
        },
        {
          id: 'o3', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme l\'essentiel des fonds détournés a-t-il été déposé ?',
          answer: [destKey],
          hint: 'L\'adresse sosie ne garde rien : suivez le collecteur.',
          explanation: `Le sosie transfère ${amt(lost, 'USDT')} vers un collecteur ${A(w, collector)}, qui dépose ${amt(outV, 'USDT')} sur ${dest.entity.name}. Il reste ${amt(remaining, 'USDT')} sur le collecteur, gelables par l'émetteur de l'USDT.`,
        },
        {
          id: 'o9', type: 'address', points: 8,
          prompt: 'Quelle adresse de dépôt faut-il citer dans la réquisition adressée à la plateforme de sortie ?',
          answer: [dep.deposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit les USDT du collecteur, avant d\'être balayée.',
          explanation: `Le ${fmtDate(dep.tx.time)}, le collecteur envoie ${amt(outV, 'USDT')} sur ${A(w, dep.deposit)}, adresse de dépôt propre à un client de ${dest.entity.name}, balayée ensuite vers le hot wallet. C'est elle qui désigne le titulaire du compte.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT issus du vol restent sur le collecteur, et peuvent encore faire l\'objet d\'un gel ?',
          answer: remaining,
          hint: 'Faites la différence entre les USDT reçus du sosie et ceux déposés sur la plateforme (solde actuel du collecteur).',
          explanation: `${amt(lost, 'USDT')} reçus, ${amt(outV, 'USDT')} déposés sur ${dest.entity.name} : il reste ${amt(remaining, 'USDT')} sur ${A(w, collector)}. Sur une adresse auto-hébergée, seul l'émetteur de l'USDT peut les bloquer : la demande de gel doit partir en urgence, avant leur prochain mouvement.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Pourquoi le sosie reçoit-il du hub quelques TRX puis quelques USDT juste avant l\'empoisonnement ?',
          hint: 'Que faut-il à une adresse Tron neuve pour émettre un transfert d\'USDT ?',
          ...choice(r,
            'Les TRX paient l\'activation et les ressources (énergie, bande passante) du sosie ; les USDT lui permettent d\'envoyer la poussière en USDT',
            [
              'C\'est un test de l\'adresse de la victime, pour vérifier qu\'elle est active avant le vol',
              'Ce sont des frais d\'activation exigés par l\'émetteur de l\'USDT pour toute nouvelle adresse',
              'Ces montants servent à rembourser la victime en cas de réclamation, pour éviter une plainte',
            ]),
          explanation: `Une adresse Tron neuve ne peut rien émettre sans TRX, et elle ne peut envoyer de l'USDT qu'elle ne détient pas : le hub lui fournit les deux, puis elle envoie la poussière (${amt(dust, 'USDT')}). Ce schéma (TRX, puis USDT, puis poussière, puis plus rien) se répète pour chaque sosie et permet de les repérer en série depuis le hub.`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Quelle recommandation et quel réflexe d\'enquête retenir face à ce mode opératoire ?',
          hint: 'Comment la victime aurait-elle pu éviter le piège, et quelle trace on-chain le réseau laisse-t-il forcément avant le vol ?',
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
        path: [...legit, tPoison.id, tBigIn.id, tLost.id, tFwd.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : []), tDecoy.id, hubFundTx.id],
        addresses: [poison, collector, hub, deposit, dep.deposit, decoyFake],
        debrief:
          `1. La victime dépose régulièrement ses USDT sur ${A(w, deposit)} (Coinhouse).\n` +
          `2. Le réseau surveille les gros flux USDT : il génère une adresse sosie ${A(w, poison)} (mêmes 6 premiers et 5 derniers caractères), la finance en TRX depuis le hub ${A(w, hub)}, puis envoie ${amt(dust, 'USDT')} à la victime juste après un de ses dépôts. Le hub, approvisionné par un retrait ${hubSrcName}, finance ${nFakes + 1} sosies au total.\n` +
          `3. Au virement suivant, la victime copie l'adresse sosie depuis son historique et envoie ${amt(lost, 'USDT')}.\n` +
          `4. Les fonds partent ${fwdMin} minutes plus tard vers le collecteur ${A(w, collector)}, puis ${amt(outV, 'USDT')} sont déposés sur ${dest.entity.name} (adresse de dépôt ${A(w, dep.deposit)}). ${amt(remaining, 'USDT')} restent sur le collecteur.\n` +
          `5. Un second sosie, imitant l'adresse du client et étranger au hub, a aussi visé la victime sans obtenir de paiement.\n\n` +
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
