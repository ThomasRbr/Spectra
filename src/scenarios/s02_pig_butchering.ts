import { World } from '../engine/world'
import { exchange, HOUR } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakeName, fakePerson, fmtDate, procedureFor } from './util'

export const s02PigButchering: ScenarioTemplate = {
  id: 'pig-butchering-tron',
  title: 'Romance & faux trading (USDT-TRC20)',
  tagline: 'Escroquerie sentimentale à l\'investissement : plusieurs victimes, un collecteur, des USDT gelables.',
  description:
    'Une victime rencontrée sur une application de rencontre a « investi » sur AuroraTrade. Les USDT transitent sur Tron. Retrouvez le portefeuille collecteur, les autres victimes, le montant total, le financeur de gas du réseau, les plateformes de sortie et les fonds encore gelables.',
  difficulty: 2,
  chains: ['tron'],
  skills: ['tron', 'tokens', 'typologies', 'exchange_id', 'gel'],
  estMinutes: 40,
  lessons: ['comptes-evm', 'tron-usdt', 'typologies', 'gel-saisie'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const scamE = w.entity('aurora', { known: false })
    const operator = w.customEntity({ name: 'Réseau AuroraTrade (opérateurs)', category: 'suspect' })

    const cv = exchange(w, 'coinhouse', 'tron')
    const kz = exchange(w, 'okx', 'tron')
    const hx = exchange(w, 'huobex', 'tron')
    // Plateforme qui a fourni les TRX du réseau (pivot d'identification des opérateurs)
    const gasSrcKey = r.pick(['binance', 'kraken', 'bitstamp'] as const)
    const gasSrc = exchange(w, gasSrcKey, 'tron')
    const otc = w.entity('satsdesk')
    const otcAddr = w.addr('tron', { entity: otc, label: 'SatsDesk OTC — Collecte', tags: ['liquid'] })

    // Portefeuille collecteur + portefeuille de gas (TRX), ce dernier alimenté par un retrait d'exchange
    const collector = w.addr('tron', { entity: operator })
    const gasWallet = w.addr('tron', { entity: operator })
    const gasFundTx = gasSrc.withdraw(gasWallet, 25000, w.at(-40 * 24), 'TRX')
    w.transfer({ time: w.at(-30 * 24), from: gasWallet, to: collector, value: 600, asset: 'TRX', method: 'transfer' })

    // Victimes (dont la plaignante)
    const nVictims = r.int(4, 7)
    const victims: { name: string; addr: string; deposit: string; total: number; nPay: number; txs: string[] }[] = []
    let firstTx = ''
    for (let i = 0; i < nVictims; i++) {
      const name = i === 0 ? victimName : fakeName(r)
      const ve = w.customEntity({ name, category: 'victim' })
      const va = w.addr('tron', { entity: ve })
      // Chaque victime a une « adresse de dépôt AuroraTrade » propre
      const dep = w.addr('tron', { entity: scamE, label: 'AuroraTrade — dépôt' })
      w.transfer({ time: w.at(-25 * 24 + i * 24), from: gasWallet, to: dep, value: 60, asset: 'TRX' })
      const nPay = r.int(2, 4)
      let total = 0
      const txs: string[] = []
      for (let k = 0; k < nPay; k++) {
        const t = w.at(-20 * 24 + i * 50 + k * r.float(40, 120))
        const value = roundAsset('USDT', Math.round(r.float(1500, 18000) / 100) * 100)
        // La victime achète ses USDT sur Coinhouse
        cv.withdraw(va, value + r.int(5, 40), t - r.int(1, 6) * HOUR, 'USDT')
        const tx = w.transfer({ time: t, from: va, to: dep, value, asset: 'USDT' })
        if (i === 0 && k === 0) firstTx = tx.hash
        txs.push(tx.id)
        total += value
        // Remontée vers le collecteur
        const fw = w.transfer({ time: t + r.int(20, 180) * 60, from: dep, to: collector, value, asset: 'USDT', method: 'transfer (token)' })
        txs.push(fw.id)
      }
      victims.push({ name, addr: va, deposit: dep, total, nPay, txs })
    }

    // La plaignante paie ensuite la « taxe de déblocage » réclamée par « Kevin », sur la même adresse
    const plaignante = victims[0]
    const feeT = w.at(-r.float(20, 40))
    const unlockFee = roundAsset('USDT', Math.round((plaignante.total * r.float(0.25, 0.4)) / 50) * 50)
    cv.withdraw(plaignante.addr, unlockFee + r.int(5, 40), feeT - r.int(1, 6) * HOUR, 'USDT')
    const feeTx = w.transfer({ time: feeT, from: plaignante.addr, to: plaignante.deposit, value: unlockFee, asset: 'USDT' })
    const feeFw = w.transfer({ time: feeT + r.int(20, 180) * 60, from: plaignante.deposit, to: collector, value: unlockFee, asset: 'USDT', method: 'transfer (token)' })
    plaignante.txs.push(feeTx.id, feeFw.id)

    const grand = roundAsset('USDT', victims.reduce((s, v) => s + v.total, 0) + unlockFee)

    // Décaissement depuis le collecteur
    const tOut = w.at(r.float(2, 6) * 24)
    const kzShare = roundAsset('USDT', grand * r.float(0.38, 0.5))
    const hxShare = roundAsset('USDT', grand * r.float(0.12, 0.2))
    const otcShare = roundAsset('USDT', grand * r.float(0.1, 0.18))
    const kzRes = kz.receive(collector, kzShare, tOut, { asset: 'USDT' })
    const hxRes = hx.receive(collector, hxShare, tOut + r.int(2, 30) * HOUR, { asset: 'USDT' })
    const otcTx = w.transfer({ time: tOut + r.int(30, 60) * HOUR, from: collector, to: otcAddr, value: otcShare, asset: 'USDT' })
    const remaining = roundAsset('USDT', w.balanceOf(collector, 'USDT'))

    // Bruit
    kz.noise(18, w.at(-10 * 24), w.at(10 * 24), 'USDT')
    hx.noise(10, w.at(-10 * 24), w.at(10 * 24), 'USDT')
    cv.noise(10, w.at(-25 * 24), w.at(5 * 24), 'USDT')
    gasSrc.noise(8, w.at(-45 * 24), w.at(5 * 24), 'TRX')
    for (let i = 0; i < 6; i++) w.fundAccount(otcAddr, roundAsset('USDT', r.float(5000, 90000)), 'USDT', w.at(r.float(-15, 15) * 24))

    const handle = fakeHandle(r)
    const gasSrcName = gasSrc.entity.name

    return {
      world: w,
      title: `Opération Aurora — ${city}`,
      briefing:
        `${victimName} (${city}) a rencontré « Kevin », trader basé à Singapour, sur une application de rencontre. Après plusieurs semaines de conversation, il l'a ${g('incité', 'incitée')} à investir sur la plateforme AuroraTrade, qui affichait des gains spectaculaires.\n\n` +
        `${g('Il', 'Elle')} a acheté des USDT sur Coinhouse (réseau Tron) et les a envoyés à l'adresse de dépôt fournie par la plateforme. Quand ${g('il', 'elle')} a voulu retirer, on lui a réclamé des « frais de déblocage », qu'${g('il', 'elle')} a fini par payer.\n\n` +
        `Objectifs : remonter jusqu'au portefeuille collecteur du réseau, mesurer l'ampleur (autres victimes, montant total), identifier l'infrastructure du réseau (financement du gas), les plateformes de sortie et les fonds encore gelables.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Plainte — déclaration de la victime', date: w.at(7 * 24), author: victimName,
          body:
            `« J'ai effectué ${plaignante.nPay} versements d'« investissement », pour un total de ${amt(plaignante.total, 'USDT')}.\n` +
            `Mon adresse Tron (Coinhouse → portefeuille personnel) : ${A(w, plaignante.addr)}\n` +
            `Premier versement : ${firstTx}\n\n` +
            `Ensuite, le ${fmtDate(feeT, false)}, j'ai payé la « taxe de déblocage » que Kevin me réclamait, sur la même adresse de dépôt. Rien n'a jamais été débloqué et le site ne répond plus. »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture — page « Dépôt » d\'AuroraTrade', date: w.at(-20 * 24),
          body: `AuroraTrade · Dépôt USDT\nRéseau : TRC20 uniquement\nVotre adresse personnelle de dépôt :\n${A(w, plaignante.deposit)}\n⚠️ Les dépôts sur un autre réseau seront perdus.`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Conversation Telegram avec « Kevin »', author: `@${handle}`, date: w.at(-2 * 24),
          body: `Kevin : Mon cœur, ton compte est à +312% 🚀\nKevin : Pour retirer il faut payer 15% de taxe de déblocage, c'est la règle de Singapour\nKevin : Envoie sur la même adresse, le support valide en 24h`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : Tron, USDT et gas', date: w.at(8 * 24), author: 'Cellule d\'appui',
          body:
            `• Sur Tron, chaque transfert d'USDT (TRC-20) consomme de l'énergie et de la bande passante, payées en TRX par l'adresse émettrice. Une adresse qui ne détient que des USDT doit donc d'abord recevoir des TRX.\n` +
            `• Les réseaux d'escroquerie alimentent souvent toutes leurs adresses depuis un même portefeuille de TRX : il relie des adresses qui n'échangent jamais d'USDT entre elles, et son propre approvisionnement est un pivot d'identification.\n` +
            `• L'émetteur de l'USDT peut bloquer une adresse sur demande motivée des autorités ; les plateformes centralisées se requièrent sur l'adresse de dépôt du client, pas sur leur hot wallet.`,
        },
      ],
      seeds: [plaignante.addr],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Identifiez le portefeuille collecteur du réseau.',
          answer: [collector],
          hint: 'Suivez les USDT reçus par l\'adresse de dépôt AuroraTrade : où repartent-ils ?',
          explanation: 'Chaque victime reçoit une adresse de dépôt « personnelle », mais toutes remontent vers un même collecteur. C\'est la signature typique des fausses plateformes d\'investissement.',
        },
        {
          id: 'o6', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant la plaignante a-t-elle versé au titre de la « taxe de déblocage » ?',
          answer: unlockFee,
          hint: 'La plainte donne la date du paiement : cherchez, parmi les sorties de la plaignante vers son adresse de dépôt, le versement de ce jour-là (c\'est le dernier).',
          explanation: `Le ${fmtDate(feeT)}, la plaignante envoie ${amt(unlockFee, 'USDT')} sur la même adresse de dépôt AuroraTrade, remontés vers le collecteur comme les versements précédents. Les « frais de déblocage » sont un classique du pig butchering : ils n'ouvrent aucun retrait, ils servent à extraire un dernier versement. Ce montant s'ajoute au préjudice (${amt(plaignante.total + unlockFee, 'USDT')} pour la plaignante).`,
        },
        {
          id: 'o2', type: 'number', points: 10,
          prompt: 'Combien de victimes distinctes (adresses sources) alimentent le réseau via les adresses de dépôt ?',
          answer: nVictims,
          hint: 'Dépliez les entrées du collecteur, puis les entrées de chaque adresse de dépôt.',
          explanation: `${nVictims} victimes : chaque adresse de dépôt AuroraTrade correspond à une victime, financée depuis Coinhouse. Les autres victimes peuvent être identifiées par réquisition à Coinhouse.`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.03,
          prompt: 'Montant total d\'USDT collecté auprès des victimes (taxe de déblocage comprise) ?',
          answer: grand,
          hint: 'Additionnez les USDT reçus par le collecteur depuis les adresses de dépôt AuroraTrade (pas les TRX).',
          explanation: `${amt(grand, 'USDT')} au total, dont ${amt(unlockFee, 'USDT')} de « taxe de déblocage » versée par la plaignante.`,
        },
        {
          id: 'o7', type: 'address', points: 9,
          prompt: 'Quelle adresse fournit les TRX (gas) des adresses de dépôt et du collecteur ?',
          answer: [gasWallet],
          hint: 'Une adresse de dépôt AuroraTrade ne peut pas transférer d\'USDT sans TRX : regardez ses tout premiers flux entrants, colonne Actif = TRX.',
          explanation: `${A(w, gasWallet)} envoie 60 TRX à chaque adresse de dépôt AuroraTrade avant le premier versement de la victime, et 600 TRX au collecteur. Ce « financeur de gas » relie toutes les adresses du réseau, même celles qui n'échangent jamais d'USDT entre elles : c'est la preuve on-chain d'une infrastructure commune.`,
        },
        {
          id: 'o8', type: 'entity', points: 9,
          prompt: 'Quelle plateforme a approvisionné en TRX le portefeuille de gas du réseau ?',
          answer: [gasSrcKey],
          hint: 'Remontez le plus ancien flux entrant du financeur de gas : il provient d\'un hot wallet étiqueté.',
          explanation: `Le ${fmtDate(gasFundTx.time, false)}, ${gasSrcName} verse 25 000 TRX au financeur de gas depuis son hot wallet. Ce retrait est rattaché à un compte client : une réquisition sur ce hash (${gasFundTx.hash.slice(0, 16)}…) peut désigner un opérateur du réseau, indépendamment des fonds des victimes. ${procedureFor(gasSrc.entity)}`,
        },
        {
          id: 'o4', type: 'entity', points: 9,
          prompt: 'Quelle plateforme a reçu la plus grosse part des fonds ?',
          answer: ['okx'],
          hint: 'Dépliez les sorties d\'USDT du collecteur et comparez les montants par destinataire.',
          explanation: `OKX reçoit ${amt(kzShare, 'USDT')}, Huobex ${amt(hxShare, 'USDT')} et SatsDesk OTC ${amt(otcShare, 'USDT')}. ${procedureFor(kz.entity)}`,
        },
        {
          id: 'o9', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt faut-il citer dans la réquisition adressée à cette plateforme principale de sortie ?',
          answer: [kzRes.deposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit les USDT du collecteur avant d\'être balayée.',
          explanation: `Le ${fmtDate(kzRes.tx.time)}, le collecteur envoie ${amt(kzShare, 'USDT')} sur ${A(w, kzRes.deposit)}, adresse de dépôt propre à un client d'OKX, balayée ensuite vers le hot wallet. C'est elle qui désigne le titulaire du compte ; le hot wallet mélange tous les clients et ne désigne personne.`,
        },
        {
          id: 'o10', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT restent sur le collecteur après les décaissements ?',
          answer: remaining,
          hint: 'Faites la différence entre les USDT reçus et envoyés par le collecteur (son solde actuel).',
          explanation: `Il reste ${amt(remaining, 'USDT')} sur ${A(w, collector)} : ${amt(grand, 'USDT')} reçus, moins ${amt(kzShare, 'USDT')} (OKX), ${amt(hxShare, 'USDT')} (Huobex) et ${amt(otcShare, 'USDT')} (SatsDesk OTC). Ces fonds sont sur une adresse auto-hébergée, mais en USDT : ils peuvent être bloqués par l'émetteur.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Le collecteur détient encore des USDT. Quelle action prioritaire ?',
          hint: 'Qui, dans l\'écosystème de l\'USDT, a techniquement la main sur une adresse auto-hébergée ?',
          ...choice(r,
            'Demander en urgence le gel de l\'adresse à l\'émetteur de l\'USDT, puis requérir les plateformes de sortie',
            [
              'Demander à Coinhouse la clé privée du collecteur pour saisir immédiatement les USDT',
              'Attendre la fin des investigations pour ne pas alerter le réseau avant les interpellations',
              'Envoyer une petite somme d\'USDT au collecteur pour « marquer » les fonds avant leur départ',
            ]),
          explanation: 'L\'USDT est un jeton centralisé : son émetteur peut bloquer (blacklister) une adresse, souvent en quelques heures sur demande motivée des autorités. C\'est fréquemment la seule manière de préserver des fonds avant leur dispersion ; la saisie pénale proprement dite suit, selon le cadre procédural applicable. On requiert ensuite les plateformes de sortie. Coinhouse n\'a aucune prise sur une adresse auto-hébergée, et « marquer » des fonds n\'a aucun sens on-chain.',
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Que peut-on utilement demander à Coinhouse dans ce dossier ?',
          hint: 'Regardez d\'où viennent les USDT des adresses sources : quelles données Coinhouse détient-il sur ces retraits ?',
          ...choice(r,
            'L\'identité des clients dont les retraits d\'USDT alimentent les adresses sources des autres dépôts AuroraTrade, pour les entendre comme victimes',
            [
              'Le gel des USDT du collecteur, puisque ces fonds ont transité par sa plateforme',
              'L\'identité des opérateurs d\'AuroraTrade, que Coinhouse connaît forcément puisqu\'il a vendu les USDT',
              'Rien : une plateforme d\'achat n\'a aucune donnée utile sur des fonds qui ont quitté ses comptes',
            ]),
          explanation: 'Coinhouse est la rampe d\'achat des victimes : ses retraits vers les adresses sources sont rattachés à des comptes clients. La réquisition permet d\'identifier et de contacter les autres victimes (plaintes, préjudice, conversations avec les escrocs). Coinhouse n\'a en revanche aucune prise sur des adresses auto-hébergées (ni gel, ni identité des opérateurs, qui n\'ont jamais été ses clients dans ce schéma).',
        },
      ],
      truth: {
        path: [...victims.flatMap((v) => v.txs), kzRes.tx.id, ...(kzRes.sweep ? [kzRes.sweep.id] : []), hxRes.tx.id, otcTx.id, gasFundTx.id],
        addresses: [collector, gasWallet, ...victims.map((v) => v.deposit), kzRes.deposit, hxRes.deposit],
        debrief:
          `Le réseau a ouvert une adresse de dépôt par victime (${nVictims} victimes), toutes vidées vers le collecteur ${A(w, collector)}. La plaignante a versé ${amt(plaignante.total, 'USDT')} en ${plaignante.nPay} fois, puis ${amt(unlockFee, 'USDT')} de « taxe de déblocage » le ${fmtDate(feeT, false)}.\n\n` +
          `Total collecté : ${amt(grand, 'USDT')}. Décaissements : ${amt(kzShare, 'USDT')} vers OKX (adresse de dépôt ${A(w, kzRes.deposit)}), ${amt(hxShare, 'USDT')} vers Huobex, ${amt(otcShare, 'USDT')} vers un courtier OTC. Il reste ${amt(remaining, 'USDT')} sur le collecteur, gelables par l'émetteur de l'USDT.\n\n` +
          `Infrastructure : les adresses de dépôt et le collecteur reçoivent leurs TRX (gas) d'un même portefeuille ${A(w, gasWallet)}, lui-même approvisionné par un retrait ${gasSrcName}. Ce « financeur de gas » relie toutes les adresses du réseau, même sans flux d'USDT, et son approvisionnement offre une piste d'identification des opérateurs.\n\n` +
          `Réquisitions : OKX et Huobex (titulaires des dépôts), ${gasSrcName} (titulaire du compte qui a financé le gas), Coinhouse (identification des autres victimes).`,
      },
      hints: [
        'Sur Tron, les transferts d\'USDT (TRC-20) et de TRX apparaissent séparément : regardez la colonne Actif.',
        'Le collecteur reçoit de plusieurs adresses de dépôt, chacune alimentée par une seule victime.',
        'Qui a fourni les TRX nécessaires aux frais des adresses du réseau ? Et d\'où viennent ses propres TRX ?',
        'Pour chaque sortie du collecteur, arrêtez-vous à l\'adresse de dépôt de la plateforme : c\'est elle qu\'on cite en réquisition.',
      ],
    }
  },
}
