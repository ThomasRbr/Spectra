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
    'Une victime rencontrée sur une application de rencontre a « investi » sur AuroraTrade. Les USDT transitent sur Tron. Retrouvez le portefeuille collecteur, les autres victimes, le montant total et les fonds encore gelables.',
  difficulty: 2,
  chains: ['tron'],
  skills: ['tron', 'tokens', 'typologies', 'exchange_id', 'gel'],
  estMinutes: 20,
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
    const otc = w.entity('satsdesk')
    const otcAddr = w.addr('tron', { entity: otc, label: 'SatsDesk OTC — Collecte', tags: ['liquid'] })

    // Portefeuille collecteur + portefeuille de gas (TRX)
    const collector = w.addr('tron', { entity: operator })
    const gasWallet = w.addr('tron', { entity: operator })
    w.fundAccount(gasWallet, 25000, 'TRX', w.at(-40 * 24))
    w.transfer({ time: w.at(-30 * 24), from: gasWallet, to: collector, value: 600, asset: 'TRX', method: 'transfer' })

    // Victimes (dont la plaignante)
    const nVictims = r.int(4, 7)
    const victims: { name: string; addr: string; deposit: string; total: number; txs: string[] }[] = []
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
      victims.push({ name, addr: va, deposit: dep, total, txs })
    }
    const grand = victims.reduce((s, v) => s + v.total, 0)

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
    for (let i = 0; i < 6; i++) w.fundAccount(otcAddr, roundAsset('USDT', r.float(5000, 90000)), 'USDT', w.at(r.float(-15, 15) * 24))

    const plaignante = victims[0]
    const handle = fakeHandle(r)

    return {
      world: w,
      title: `Opération Aurora — ${city}`,
      briefing:
        `${victimName} (${city}) a rencontré « Kevin », trader basé à Singapour, sur une application de rencontre. Après plusieurs semaines de conversation, il l'a ${g('incité', 'incitée')} à investir sur la plateforme AuroraTrade, qui affichait des gains spectaculaires.\n\n` +
        `${g('Il', 'Elle')} a acheté des USDT sur Coinhouse (réseau Tron) et les a envoyés à l'adresse de dépôt fournie par la plateforme. Quand ${g('il', 'elle')} a voulu retirer, on lui a réclamé des « frais de déblocage ».\n\n` +
        `Objectifs : remonter jusqu'au portefeuille collecteur du réseau, mesurer l'ampleur (autres victimes, montant total), identifier les plateformes de sortie et les fonds encore gelables.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Plainte — déclaration de la victime', date: w.at(7 * 24), author: victimName,
          body:
            `« J'ai effectué ${plaignante.txs.length / 2} versements, pour un total de ${amt(plaignante.total, 'USDT')}.\n` +
            `Mon adresse Tron (Coinhouse → portefeuille personnel) : ${A(w, plaignante.addr)}\n` +
            `Premier versement : ${firstTx} »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture — page « Dépôt » d\'AuroraTrade', date: w.at(-20 * 24),
          body: `AuroraTrade · Dépôt USDT\nRéseau : TRC20 uniquement\nVotre adresse personnelle de dépôt :\n${A(w, plaignante.deposit)}\n⚠️ Les dépôts sur un autre réseau seront perdus.`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Conversation Telegram avec « Kevin »', author: `@${handle}`, date: w.at(-2 * 24),
          body: `Kevin : Mon cœur, ton compte est à +312% 🚀\nKevin : Pour retirer il faut payer 15% de taxe de déblocage, c'est la règle de Singapour\nKevin : Envoie sur la même adresse, le support valide en 24h`,
        },
      ],
      seeds: [plaignante.addr],
      objectives: [
        {
          id: 'o1', type: 'address', points: 20,
          prompt: 'Identifiez le portefeuille collecteur du réseau.',
          answer: [collector],
          hint: 'Suivez les USDT reçus par l\'adresse de dépôt AuroraTrade : où repartent-ils ?',
          explanation: 'Chaque victime reçoit une adresse de dépôt « personnelle », mais toutes remontent vers un même collecteur. C\'est la signature typique des fausses plateformes d\'investissement.',
        },
        {
          id: 'o2', type: 'number', points: 20,
          prompt: 'Combien de victimes distinctes (adresses sources) alimentent le réseau via les adresses de dépôt ?',
          answer: nVictims,
          hint: 'Dépliez les entrées du collecteur, puis les entrées de chaque adresse de dépôt.',
          explanation: `${nVictims} victimes : chaque adresse de dépôt AuroraTrade correspond à une victime, financée depuis Coinhouse. Les autres victimes peuvent être identifiées par réquisition à Coinhouse.`,
        },
        {
          id: 'o3', type: 'amount', points: 20, unit: 'USDT', tolerance: 0.03,
          prompt: 'Montant total d\'USDT collecté auprès des victimes ?',
          answer: grand,
          explanation: `${amt(grand, 'USDT')} au total.`,
        },
        {
          id: 'o4', type: 'entity', points: 20,
          prompt: 'Quelle plateforme a reçu la plus grosse part des fonds ?',
          answer: ['okx'],
          explanation: `OKX reçoit ${amt(kzShare, 'USDT')}, Huobex ${amt(hxShare, 'USDT')} et SatsDesk OTC ${amt(otcShare, 'USDT')}. ${procedureFor(kz.entity)}`,
        },
        {
          id: 'o5', type: 'choice', points: 20,
          prompt: `Le collecteur détient encore environ ${amt(remaining, 'USDT')}. Quelle action prioritaire ?`,
          ...choice(r,
            'Demander en urgence le gel de l\'adresse à l\'émetteur de l\'USDT, puis requérir les plateformes de sortie',
            [
              'Demander à Coinhouse la clé privée du collecteur pour saisir immédiatement les USDT',
              'Attendre la fin des investigations pour ne pas alerter le réseau avant les interpellations',
              'Envoyer une petite somme d\'USDT au collecteur pour « marquer » les fonds avant leur départ',
            ]),
          explanation: 'L\'USDT est un jeton centralisé : son émetteur peut bloquer (blacklister) une adresse, souvent en quelques heures sur demande motivée des autorités. C\'est fréquemment la seule manière de préserver des fonds avant leur dispersion ; la saisie pénale proprement dite suit (autorisation du JLD ou du juge d\'instruction). On requiert ensuite les plateformes de sortie. Coinhouse n\'a aucune prise sur une adresse auto-hébergée, et « marquer » des fonds n\'a aucun sens on-chain.',
        },
      ],
      truth: {
        path: [...victims.flatMap((v) => v.txs), kzRes.tx.id, ...(kzRes.sweep ? [kzRes.sweep.id] : []), hxRes.tx.id, otcTx.id],
        addresses: [collector, gasWallet, ...victims.map((v) => v.deposit), kzRes.deposit, hxRes.deposit],
        debrief:
          `Le réseau a ouvert une adresse de dépôt par victime (${nVictims} victimes), toutes vidées vers le collecteur ${A(w, collector)}.\n\n` +
          `Total collecté : ${amt(grand, 'USDT')}. Décaissements : ${amt(kzShare, 'USDT')} vers OKX, ${amt(hxShare, 'USDT')} vers Huobex, ${amt(otcShare, 'USDT')} vers un courtier OTC. Il reste ${amt(remaining, 'USDT')} sur le collecteur.\n\n` +
          `Piste bonus : les adresses de dépôt et le collecteur reçoivent leurs TRX (gas) d'un même portefeuille ${A(w, gasWallet)}. Ce « financeur de gas » relie toutes les adresses du réseau, même sans flux d'USDT.`,
      },
      hints: [
        'Sur Tron, les transferts d\'USDT (TRC-20) et de TRX apparaissent séparément : regardez la colonne Actif.',
        'Le collecteur reçoit de plusieurs adresses de dépôt, chacune alimentée par une seule victime.',
        'Qui a fourni les TRX nécessaires aux frais des adresses du réseau ?',
      ],
    }
  },
}

