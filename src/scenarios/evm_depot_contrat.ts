import { World } from '../engine/world'
import { exchange, DAY, HOUR } from '../engine/patterns'
import { forwarderExchange } from '../engine/defi'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeName, fakePerson, fmtDate, procedureFor } from './util'

/** Arrondi à la centaine inférieure (montants « ronds » choisis par l'escroc). */
const floor100 = (v: number) => Math.floor(v / 100) * 100

export const evmDepotContrat: ScenarioTemplate = {
  id: 'depot-contrat',
  title: 'Le contrat de dépôt',
  tagline: 'L\'adresse de dépôt de l\'escroc est un contrat : l\'ETH repart aussitôt en transaction interne, les USDT attendent le reversement.',
  description:
    'Une épargnante a versé des USDT puis de l\'ETH à un faux conseiller en placement. L\'escroc a tout déposé sur un exchange dont les adresses de dépôt sont des contrats « forwarders » déployés par CREATE2. Distinguez le contrat de dépôt du hot wallet, de la fabrique et du portefeuille opérationnel, lisez les transactions internes et le reversement des jetons, puis préparez une réquisition qui vise la bonne adresse.',
  difficulty: 2,
  chains: ['eth'],
  skills: ['evm', 'tokens', 'exchange_id', 'requisition', 'typologies'],
  estMinutes: 35,
  lessons: ['contrats-depot-create2', 'transactions-internes', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victim = fakePerson(r)
    const g = victim.g
    const city = fakeCity(r)
    const brand = r.pick(['Nexora Capital', 'Valmont Patrimoine', 'Orféa Invest', 'Altiplan Gestion', 'Sylvane Finance'])
    const advisor = r.pick(['Thomas', 'Alexandre', 'Julia', 'Sarah', 'Maxime', 'Laura'])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const exKey = r.pick(['kraken', 'coinbase', 'bitstamp', 'okx'] as const)
    const fx = forwarderExchange(w, exKey, 'eth')
    const ch = exchange(w, 'coinhouse', 'eth')
    const other = exchange(w, exKey === 'kraken' ? 'binance' : 'kraken', 'eth')

    const scamE = w.customEntity({ name: `${brand} (faux placement)`, category: 'scam' })
    const S = w.addr('eth', { entity: scamE })
    const victimE = w.customEntity({ name: victim.name, category: 'victim' })
    const V = w.addr('eth', { entity: victimE })

    // ── Avant les faits ──────────────────────────────────────────────────────
    const g0 = roundAsset('ETH', r.float(0.06, 0.16))
    w.fundAccount(S, g0, 'ETH', w.at(-r.float(12, 20) * 24))
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
    const leftUsdt = roundAsset('USDT', w.balanceOf(S, 'USDT'))
    const totalDeposited = roundAsset('USDT', dA + dB)
    const nVictims = nBefore + 2

    // ── Bruit de fond ────────────────────────────────────────────────────────
    fx.noise(26, w.at(-6 * 24), w.at(8 * 24), 'USDT')
    fx.noise(18, w.at(-6 * 24), w.at(8 * 24), 'ETH')
    fx.noise(8, w.at(-6 * 24), w.at(8 * 24), 'USDC')
    ch.noise(10, w.at(-5 * 24), w.at(6 * 24), 'USDT')
    other.noise(10, w.at(-8 * 24), w.at(6 * 24), 'USDT')

    const exName = fx.entity.name
    const ob = othersBefore[0]
    const wrongs = [
      `Le hot wallet ${exName} (${A(w, fx.hot).slice(0, 10)}…), qui reçoit les fonds de tous les clients`,
      `La fabrique de contrats (${A(w, fx.factory).slice(0, 10)}…), appelée lors du premier reversement`,
      `Le portefeuille opérationnel (${A(w, fx.operator).slice(0, 10)}…), qui signe les reversements`,
    ]

    return {
      world: w,
      title: `Faux placement « ${brand} » — ${city}`,
      briefing:
        `${victim.name}, ${g('domicilié', 'domiciliée')} à ${city}, a été ${g('contacté', 'contactée')} par un « conseiller » de ${brand} qui lui promettait un rendement de 4 % par mois. ${g('Il', 'Elle')} a acheté des USDT et de l'ETH sur Coinhouse et les a envoyés, en trois fois, à l'adresse indiquée par son interlocuteur. Le compte de « trading » affichait des gains ; aucun retrait n'a jamais été possible.\n\n` +
        `L'escroc a déposé les fonds sur un exchange dont les adresses de dépôt sont des contrats « forwarders » : chaque client reçoit une adresse calculée d'avance (CREATE2). L'ETH envoyé à ce contrat repart aussitôt vers le hot wallet, en transaction interne ; les jetons y restent jusqu'à ce que la plateforme déclenche leur reversement.\n\n` +
        `Objectifs : identifier l'adresse de l'escroc et l'ampleur de la collecte, isoler le contrat de dépôt (ni le hot wallet, ni la fabrique, ni le portefeuille opérationnel), lire le reversement des USDT et la transaction interne de l'ETH, puis chiffrer ce qui a été crédité au compte client et ce qui reste gelable.`,
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
            `[${advisor}] Félicitations, votre portefeuille affiche +18 % ce mois-ci 📈\n` +
            `[${advisor}] Pour débloquer le retrait, notre service conformité exige ${amt(u2, 'USDT')} de frais, puis une taxe de sortie réglée en ETH (pas en USDT, c'est la règle de la blockchain).\n` +
            `[${advisor}] Une fois la taxe payée, les fonds sont sur votre compte sous 24 h.`,
        },
        {
          id: 'pharos', type: 'email', title: 'Rapprochement : signalement PHAROS', date: w.at(10 * 24), author: 'OCLCTIC — plateforme PHAROS',
          body:
            `Bonjour,\n\nL'adresse ${A(w, S)} figure dans un signalement de ${otherName} (${otherCity}), qui déclare avoir versé ${amt(ob.value, 'USDT')} le ${fmtDate(ob.time, false)} (transaction ${ob.tx}) à un conseiller se présentant au nom de ${brand}.\n\nD'autres versements semblent provenir de personnes non encore identifiées.\n\nCordialement`,
        },
        {
          id: 'conformite', type: 'pv', title: 'PV de renseignement : échange avec la conformité de la plateforme', date: w.at(11 * 24), author: 'Enquêteur en charge',
          body:
            `Contact téléphonique avec le service des réquisitions de ${exName}. Notre interlocuteur précise :\n` +
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
            `• Une adresse CREATE2 peut recevoir des fonds avant que le contrat n'existe ; le déploiement survient souvent lors du premier reversement.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 8,
          prompt: 'Quelle adresse a encaissé les trois versements de la victime ?',
          answer: [S],
          hint: 'Ouvrez les transactions citées dans la plainte : elles ont toutes le même destinataire, que l\'on retrouve dans la capture de la messagerie.',
          explanation: `Les trois transactions de la plainte créditent ${A(w, S)}, l'adresse communiquée par le faux conseiller. C'est un compte externe (EOA), pas un contrat : l'escroc en détient la clé privée et signe lui-même les envois suivants.`,
        },
        {
          id: 'o2', type: 'number', points: 8, unit: 'victimes', tolerance: 0,
          prompt: 'Combien de personnes différentes (plaignante comprise) ont envoyé des USDT à cette adresse ?',
          answer: nVictims,
          hint: 'Listez les flux entrants d\'USDT de l\'adresse de l\'escroc et comptez les expéditeurs distincts. Le premier ETH reçu, lui, sert seulement à payer le gas.',
          explanation: `${nVictims} expéditeurs distincts versent des USDT à ${A(w, S).slice(0, 12)}… : la plaignante, ${otherName} (signalement PHAROS) et ${nVictims - 2} autre(s) personne(s) non identifiée(s), chacune approvisionnée par un exchange juste avant son versement, schéma typique d'une victime guidée. Ces versements sont à joindre à la procédure : ils caractérisent l'habitude et l'ampleur de l'escroquerie (art. 313-1 du Code pénal), et chaque expéditeur peut être identifié par réquisition à l'exchange qui l'a approvisionné.`,
        },
        {
          id: 'o3', type: 'address', points: 10,
          prompt: 'Vers quelle adresse l\'escroc envoie-t-il les USDT collectés (première tranche) ?',
          answer: [deposit],
          hint: 'Suivez la première sortie d\'USDT de l\'escroc. L\'adresse de destination est un contrat ; vérifiez qu\'elle ne reçoit pas les fonds d\'autres clients.',
          explanation: `Le ${fmtDate(depA.tx.time)}, l'escroc envoie ${amt(dA, 'USDT')} à ${A(w, deposit)}. L'inspecteur la présente comme un contrat « Forwarder » : c'est l'adresse de dépôt propre à un client de ${exName}. Elle ne reçoit que les envois de l'escroc, contrairement au hot wallet qui centralise les fonds de toute la clientèle.`,
        },
        {
          id: 'o4', type: 'entity', points: 8,
          prompt: 'À quelle plateforme appartient ce contrat de dépôt ?',
          answer: [exKey],
          hint: 'Regardez l\'étiquette du contrat, ou celle de l\'adresse vers laquelle il reverse les fonds.',
          explanation: `Le contrat est attribué à ${exName} et reverse ses fonds au hot wallet de la plateforme. ${procedureFor(fx.entity)}`,
        },
        {
          id: 'o5', type: 'tx', points: 10,
          prompt: 'Quelle transaction fait sortir la première tranche d\'USDT du contrat de dépôt ?',
          answer: [flushA.id],
          hint: 'Ouvrez la liste des transactions du contrat de dépôt : après la réception des USDT, une transaction déplace les jetons vers le hot wallet. Elle n\'est pas signée par l\'escroc.',
          explanation: `La transaction ${flushA.hash.slice(0, 18)}… (${fmtDate(flushA.time)}) appelle createForwarder(address,bytes32) sur la fabrique : elle déploie le contrat de dépôt à l'adresse calculée d'avance (rubrique « Contrat(s) déployé(s) ») et, dans la même exécution, reverse les ${amt(dA, 'USDT')} au hot wallet (événement Transfer). Le second reversement, plus tard, appelle directement flushTokens(address) sur le contrat, désormais déployé.`,
        },
        {
          id: 'o6', type: 'address', points: 9,
          prompt: 'Quel compte a signé cette transaction de reversement ?',
          answer: [fx.operator],
          hint: 'Dans le détail de la transaction, distinguez le signataire (« De ») du contrat appelé et des adresses qui reçoivent les jetons.',
          explanation: `Le reversement est signé par ${A(w, fx.operator)}, portefeuille opérationnel de ${exName} qui déclenche les reversements de milliers de contrats de dépôt. Ni l'escroc ni le contrat ne signent : un contrat ne peut pas initier une transaction. Ce compte, comme la fabrique, est commun à tous les clients : il ne désigne personne.`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
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
          prompt: 'Quel montant d\'ETH le contrat de dépôt reverse-t-il au hot wallet lors du dépôt d\'ETH de l\'escroc ?',
          answer: eDep,
          hint: 'Ouvrez la transaction par laquelle l\'escroc envoie de l\'ETH au contrat de dépôt et lisez la rubrique « Transactions internes ».',
          explanation: `La transaction ${ethDep.tx.hash.slice(0, 18)}… envoie ${amt(eDep, 'ETH')} au contrat, qui les renvoie aussitôt (CALL interne) au hot wallet. Le montant dépasse l'ETH versé par la victime (${amt(e1, 'ETH')}) : l'escroc y ajoute une partie de son ETH de gas. Aucun événement Transfer n'est émis pour de l'ETH : seul ForwarderDeposited, propre au contrat, signale le dépôt.`,
        },
        {
          id: 'o9', type: 'address', points: 8,
          prompt: 'Dans cette même transaction, quelle adresse reçoit l\'ETH en transaction interne ?',
          answer: [fx.hot],
          hint: 'La transaction interne part du contrat de dépôt : regardez son destinataire.',
          explanation: `L'ETH aboutit sur ${A(w, fx.hot)}, hot wallet de ${exName}. Sur un explorateur, ce mouvement n'apparaît que dans l'onglet des transactions internes, jamais dans la liste « normale » du hot wallet : un enquêteur qui ne lit que les transferts conclurait à tort que l'ETH dort sur le contrat.`,
        },
        {
          id: 'o10', type: 'choice', points: 8,
          prompt: 'Quelle adresse citer dans la réquisition pour identifier le titulaire du compte ?',
          hint: 'Parmi les adresses rencontrées, laquelle est propre à un seul client ?',
          ...choice(r, `Le contrat de dépôt ${A(w, deposit).slice(0, 10)}…, propre à un client, avec les hash et dates des dépôts`, wrongs),
          explanation: `Seul le contrat de dépôt ${A(w, deposit)} est attribué à un client unique. La réquisition cite cette adresse et les transactions de dépôt (${depA.tx.hash.slice(0, 12)}…, ${ethDep.tx.hash.slice(0, 12)}…, ${depB.tx.hash.slice(0, 12)}…) et sollicite l'identité du titulaire (KYC), les adresses IP de connexion, l'historique du compte (dépôts, conversions, retraits vers un IBAN) et un gel conservatoire du solde.`,
        },
        {
          id: 'o11', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDT l\'escroc a-t-il crédité sur son compte via ce contrat de dépôt ?',
          answer: totalDeposited,
          hint: 'Il y a deux envois d\'USDT de l\'escroc vers le contrat de dépôt, chacun suivi d\'un reversement.',
          explanation: `${amt(dA, 'USDT')} (reversés par createForwarder) + ${amt(dB, 'USDT')} (reversés le ${fmtDate(flushB.time)} par flushTokens, signé par le même portefeuille opérationnel) = ${amt(totalDeposited, 'USDT')}, auxquels s'ajoutent ${amt(eDep, 'ETH')}. Ces montants, avec les hash, permettent à la plateforme de retrouver les crédits correspondants sur le compte client.`,
        },
        {
          id: 'o12', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT restent sur l\'adresse de l\'escroc à l\'issue de ses dépôts (montant dont le gel peut être demandé à Tether) ?',
          answer: leftUsdt,
          hint: 'Faites le bilan des USDT de l\'adresse de l\'escroc : tout ce qui est entré, moins les deux envois vers le contrat de dépôt.',
          explanation: `L'escroc n'a pas tout déposé : ${amt(leftUsdt, 'USDT')} restent sur ${A(w, S).slice(0, 12)}…. Tether peut placer une adresse sur liste noire à la demande motivée des autorités : le gel bloque ce reliquat sur place. Une demande rapide s'impose, avant que les fonds ne soient déplacés.`,
        },
      ],
      truth: {
        path: [...othersBefore.map((o) => `eth:${o.tx}`), p1.id, depA.tx.id, flushA.id, p2.id, lateTx.id, p3.id, ethDep.tx.id, depB.tx.id, flushB.id],
        addresses: [S, deposit],
        debrief:
          `1. ${victim.name} verse ${amt(u1, 'USDT')}, puis ${amt(u2, 'USDT')} de « frais » et ${amt(e1, 'ETH')} de « taxe » à ${A(w, S)}, adresse du faux conseiller, qui collecte aussi les fonds de ${nVictims - 1} autre(s) victime(s).\n` +
          `2. L'escroc envoie ${amt(dA, 'USDT')} au contrat de dépôt ${A(w, deposit)} (${exName}), alors que ce contrat n'est pas encore déployé. Le portefeuille opérationnel de la plateforme signe ensuite createForwarder sur la fabrique : le contrat est déployé et les USDT reversés au hot wallet dans la même transaction.\n` +
          `3. L'ETH (${amt(eDep, 'ETH')}) envoyé au même contrat repart vers le hot wallet en transaction interne, sans aucun délai.\n` +
          `4. Une seconde tranche de ${amt(dB, 'USDT')} est reversée par flushTokens. ${amt(leftUsdt, 'USDT')} restent sur l'adresse de l'escroc.\n\n` +
          `À retenir : quand l'adresse de dépôt est un contrat, l'heuristique « réception puis balayage » reste valable, mais le balayage prend la forme d'un appel de contrat signé par la plateforme, et l'ETH circule en transactions internes. Le hot wallet, la fabrique et le portefeuille opérationnel sont des infrastructures communes : seule l'adresse du contrat de dépôt, avec les hash des dépôts, identifie le client dans une réquisition.`,
      },
      hints: [
        'Partez des trois transactions de la plainte : elles mènent toutes à la même adresse.',
        'Suivez les sorties de l\'escroc : la destination est un contrat. Ouvrez sa fiche et sa liste de transactions.',
        'Un reversement de jetons est une transaction signée par un portefeuille de la plateforme : regardez qui signe et quel contrat est appelé.',
        'Pour l\'ETH, le mouvement vers le hot wallet ne figure qu\'en « Transactions internes » dans le détail de la transaction de dépôt.',
        'Pour le reliquat, faites le bilan des USDT de l\'adresse de l\'escroc (entrées moins sorties).',
      ],
    }
  },
}
